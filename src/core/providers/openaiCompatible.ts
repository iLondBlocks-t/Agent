import type {
  ChatRequest, ChatResponse, ModelInfo, Provider, ProviderConfig, ProviderKind, ToolCall, ToolSchema,
} from '@/types';
import { ApiError, httpJson, sseLines, withRetry } from './http';
import { approxTokens, estimateCost } from './pricing';

export interface OpenAICompatOptions {
  kind: ProviderKind;
  defaultBaseUrl: string;
  supportsTools?: boolean;
  authHeader?: (key: string) => Record<string, string>;
  extraHeaders?: Record<string, string>;
  fallbackModels?: ModelInfo[];
}

function toolsToOpenAI(tools?: ToolSchema[]) {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

function parseArgs(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  try { return JSON.parse(String(raw)); } catch { return { _raw: String(raw) }; }
}

export class OpenAICompatibleProvider implements Provider {
  readonly kind: ProviderKind;
  readonly id: string;
  readonly name: string;
  readonly supportsTools: boolean;
  protected baseUrl: string;
  protected apiKey: string;

  constructor(protected config: ProviderConfig, protected opts: OpenAICompatOptions) {
    this.kind = opts.kind;
    this.id = config.id;
    this.name = config.name;
    this.supportsTools = opts.supportsTools ?? true;
    this.baseUrl = (config.baseUrl || opts.defaultBaseUrl).replace(/\/+$/, '');
    this.apiKey = config.apiKey || '';
  }

  protected headers(): Record<string, string> {
    const auth = this.opts.authHeader
      ? this.opts.authHeader(this.apiKey)
      : this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
    return { 'Content-Type': 'application/json', ...auth, ...(this.opts.extraHeaders ?? {}) };
  }

  protected body(req: ChatRequest, stream: boolean) {
    return {
      model: req.model,
      stream,
      temperature: req.temperature ?? 0.4,
      max_tokens: req.maxTokens ?? 4096,
      messages: req.messages.map((m) =>
        m.role === 'tool'
          ? { role: 'tool', content: m.content, tool_call_id: m.toolCallId }
          : m.toolCalls?.length
            ? {
                role: m.role, content: m.content || null,
                tool_calls: m.toolCalls.map((c) => ({
                  id: c.id, type: 'function',
                  function: { name: c.name, arguments: JSON.stringify(c.arguments) },
                })),
              }
            : { role: m.role, content: m.content },
      ),
      ...(this.supportsTools && req.tools?.length ? { tools: toolsToOpenAI(req.tools), tool_choice: 'auto' } : {}),
    };
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const data = await withRetry(
      () => httpJson<any>(`${this.baseUrl}/chat/completions`, {
        method: 'POST', headers: this.headers(), body: JSON.stringify(this.body(req, false)), signal: req.signal,
      }),
      { signal: req.signal },
    );
    const choice = data.choices?.[0];
    const msg = choice?.message ?? {};
    const toolCalls: ToolCall[] = (msg.tool_calls ?? []).map((c: any, i: number) => ({
      id: c.id || `call_${i}`, name: c.function?.name ?? 'unknown', arguments: parseArgs(c.function?.arguments),
    }));
    const pt = data.usage?.prompt_tokens ?? approxTokens(JSON.stringify(req.messages));
    const ct = data.usage?.completion_tokens ?? approxTokens(msg.content ?? '');
    return {
      content: msg.content ?? '',
      toolCalls,
      model: data.model ?? req.model,
      usage: { promptTokens: pt, completionTokens: ct, totalTokens: pt + ct, costUsd: estimateCost(req.model, pt, ct) },
      raw: data,
    };
  }

  async stream(req: ChatRequest, onDelta: (c: string) => void): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify(this.body(req, true)), signal: req.signal,
    }).catch((e) => { throw new ApiError(e.message || 'Network error', 0); });
    if (!res.ok || !res.body) {
      if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status, (await res.text()).slice(0, 800));
      return this.chat(req);
    }
    let content = '';
    const acc = new Map<number, { id: string; name: string; args: string }>();
    for await (const line of sseLines(res)) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') break;
      let j: any; try { j = JSON.parse(payload); } catch { continue; }
      const d = j.choices?.[0]?.delta ?? {};
      if (typeof d.content === 'string' && d.content) { content += d.content; onDelta(d.content); }
      for (const tc of d.tool_calls ?? []) {
        const idx = tc.index ?? 0;
        const cur = acc.get(idx) ?? { id: tc.id || `call_${idx}`, name: '', args: '' };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.name += tc.function.name;
        if (tc.function?.arguments) cur.args += tc.function.arguments;
        acc.set(idx, cur);
      }
    }
    const toolCalls: ToolCall[] = [...acc.values()].map((c) => ({ id: c.id, name: c.name, arguments: parseArgs(c.args) }));
    const pt = approxTokens(JSON.stringify(req.messages));
    const ct = approxTokens(content);
    return {
      content, toolCalls, model: req.model,
      usage: { promptTokens: pt, completionTokens: ct, totalTokens: pt + ct, costUsd: estimateCost(req.model, pt, ct) },
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const data = await httpJson<any>(`${this.baseUrl}/models`, { headers: this.headers(), timeoutMs: 20_000 });
      const arr = data.data ?? data.models ?? [];
      const models: ModelInfo[] = arr.map((m: any) => ({
        id: m.id ?? m.name, name: m.name ?? m.id,
        contextLength: m.context_length ?? m.context_window,
        promptCostPer1k: m.pricing?.prompt ? Number(m.pricing.prompt) * 1000 : undefined,
        completionCostPer1k: m.pricing?.completion ? Number(m.pricing.completion) * 1000 : undefined,
      })).filter((m: ModelInfo) => !!m.id);
      return models.length ? models : (this.opts.fallbackModels ?? []);
    } catch { return this.opts.fallbackModels ?? []; }
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const models = await this.listModels();
      if (!models.length) return { ok: false, message: 'لا توجد نماذج متاحة — تحقق من المفتاح أو الرابط' };
      return { ok: true, message: `تم الاتصال بنجاح (${models.length} نموذج)` };
    } catch (e) { return { ok: false, message: (e as Error).message }; }
  }
}
