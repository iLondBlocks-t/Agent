import type { ChatRequest, ChatResponse, ModelInfo, Provider, ProviderConfig, ToolCall } from '@/types';
import { ApiError, httpJson, sseLines, withRetry } from './http';
import { approxTokens, estimateCost } from './pricing';

export class AnthropicProvider implements Provider {
  readonly kind = 'anthropic' as const;
  readonly id: string;
  readonly name: string;
  readonly supportsTools = true;
  private baseUrl: string;
  private apiKey: string;

  constructor(config: ProviderConfig) {
    this.id = config.id;
    this.name = config.name;
    this.baseUrl = (config.baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    this.apiKey = config.apiKey || '';
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
  }

  private payload(req: ChatRequest, stream: boolean) {
    const system = req.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const messages = req.messages.filter((m) => m.role !== 'system').map((m) => {
      if (m.role === 'tool') {
        return { role: 'user', content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }] };
      }
      const content: any[] = [];
      if (m.content) content.push({ type: 'text', text: m.content });
      for (const c of m.toolCalls ?? []) content.push({ type: 'tool_use', id: c.id, name: c.name, input: c.arguments });
      return { role: m.role, content: content.length ? content : [{ type: 'text', text: '' }] };
    });
    return {
      model: req.model, stream, max_tokens: req.maxTokens ?? 4096, temperature: req.temperature ?? 0.4,
      ...(system ? { system } : {}), messages,
      ...(req.tools?.length ? { tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) } : {}),
    };
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const data = await withRetry(() => httpJson<any>(`${this.baseUrl}/messages`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify(this.payload(req, false)), signal: req.signal,
    }), { signal: req.signal });
    let content = '';
    const toolCalls: ToolCall[] = [];
    for (const b of data.content ?? []) {
      if (b.type === 'text') content += b.text;
      if (b.type === 'tool_use') toolCalls.push({ id: b.id, name: b.name, arguments: b.input ?? {} });
    }
    const pt = data.usage?.input_tokens ?? approxTokens(JSON.stringify(req.messages));
    const ct = data.usage?.output_tokens ?? approxTokens(content);
    return { content, toolCalls, model: data.model ?? req.model, usage: { promptTokens: pt, completionTokens: ct, totalTokens: pt + ct, costUsd: estimateCost(req.model, pt, ct) }, raw: data };
  }

  async stream(req: ChatRequest, onDelta: (c: string) => void): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify(this.payload(req, true)), signal: req.signal,
    }).catch((e) => { throw new ApiError(e.message, 0); });
    if (!res.ok || !res.body) return this.chat(req);
    let content = '';
    const blocks = new Map<number, { id: string; name: string; json: string }>();
    let pt = 0, ct = 0;
    for await (const line of sseLines(res)) {
      if (!line.startsWith('data:')) continue;
      let j: any; try { j = JSON.parse(line.slice(5).trim()); } catch { continue; }
      if (j.type === 'message_start') pt = j.message?.usage?.input_tokens ?? 0;
      if (j.type === 'content_block_start' && j.content_block?.type === 'tool_use') {
        blocks.set(j.index, { id: j.content_block.id, name: j.content_block.name, json: '' });
      }
      if (j.type === 'content_block_delta') {
        if (j.delta?.type === 'text_delta') { content += j.delta.text; onDelta(j.delta.text); }
        if (j.delta?.type === 'input_json_delta') {
          const b = blocks.get(j.index); if (b) b.json += j.delta.partial_json ?? '';
        }
      }
      if (j.type === 'message_delta') ct = j.usage?.output_tokens ?? ct;
    }
    const toolCalls: ToolCall[] = [...blocks.values()].map((b) => {
      let args: Record<string, unknown> = {};
      try { args = b.json ? JSON.parse(b.json) : {}; } catch { args = {}; }
      return { id: b.id, name: b.name, arguments: args };
    });
    pt = pt || approxTokens(JSON.stringify(req.messages));
    ct = ct || approxTokens(content);
    return { content, toolCalls, model: req.model, usage: { promptTokens: pt, completionTokens: ct, totalTokens: pt + ct, costUsd: estimateCost(req.model, pt, ct) } };
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const data = await httpJson<any>(`${this.baseUrl}/models`, { headers: this.headers(), timeoutMs: 20_000 });
      const arr = (data.data ?? []).map((m: any) => ({ id: m.id, name: m.display_name ?? m.id }));
      if (arr.length) return arr;
    } catch { /* fall through */ }
    return [
      { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
    ];
  }

  async testConnection() {
    try {
      await this.chat({ model: (await this.listModels())[0]?.id ?? 'claude-3-5-haiku-latest', messages: [{ role: 'user', content: 'ping' }], maxTokens: 8 });
      return { ok: true, message: 'تم الاتصال بنجاح' };
    } catch (e) { return { ok: false, message: (e as Error).message }; }
  }
}
