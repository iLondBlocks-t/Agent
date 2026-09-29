import type { ChatRequest, ChatResponse, ModelInfo, Provider, ProviderConfig, ToolCall } from '@/types';
import { httpJson, sseLines, withRetry, ApiError } from './http';
import { approxTokens, estimateCost } from './pricing';

export class GeminiProvider implements Provider {
  readonly kind = 'gemini' as const;
  readonly id: string;
  readonly name: string;
  readonly supportsTools = true;
  private baseUrl: string;
  private apiKey: string;

  constructor(config: ProviderConfig) {
    this.id = config.id;
    this.name = config.name;
    this.baseUrl = (config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    this.apiKey = config.apiKey || '';
  }

  private payload(req: ChatRequest) {
    const system = req.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const contents = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'tool') {
          return { role: 'user', parts: [{ functionResponse: { name: m.name || 'tool', response: { result: m.content } } }] };
        }
        const parts: any[] = [];
        if (m.content) parts.push({ text: m.content });
        for (const c of m.toolCalls ?? []) parts.push({ functionCall: { name: c.name, args: c.arguments } });
        if (!parts.length) parts.push({ text: '' });
        return { role: m.role === 'assistant' ? 'model' : 'user', parts };
      });
    return {
      contents,
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: { temperature: req.temperature ?? 0.4, maxOutputTokens: req.maxTokens ?? 4096 },
      ...(req.tools?.length
        ? { tools: [{ functionDeclarations: req.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }] }
        : {}),
    };
  }

  private parse(data: any, req: ChatRequest): ChatResponse {
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    let content = '';
    const toolCalls: ToolCall[] = [];
    parts.forEach((p: any, i: number) => {
      if (typeof p.text === 'string') content += p.text;
      if (p.functionCall) toolCalls.push({ id: `gm_${i}`, name: p.functionCall.name, arguments: p.functionCall.args ?? {} });
    });
    const pt = data.usageMetadata?.promptTokenCount ?? approxTokens(JSON.stringify(req.messages));
    const ct = data.usageMetadata?.candidatesTokenCount ?? approxTokens(content);
    return { content, toolCalls, model: req.model, usage: { promptTokens: pt, completionTokens: ct, totalTokens: pt + ct, costUsd: estimateCost(req.model, pt, ct) }, raw: data };
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const url = `${this.baseUrl}/models/${encodeURIComponent(req.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const data = await withRetry(() => httpJson<any>(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.payload(req)), signal: req.signal,
    }), { signal: req.signal });
    return this.parse(data, req);
  }

  async stream(req: ChatRequest, onDelta: (c: string) => void): Promise<ChatResponse> {
    const url = `${this.baseUrl}/models/${encodeURIComponent(req.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.payload(req)), signal: req.signal,
    }).catch((e) => { throw new ApiError(e.message, 0); });
    if (!res.ok || !res.body) return this.chat(req);
    let content = '';
    const toolCalls: ToolCall[] = [];
    let usage: any = null;
    for await (const line of sseLines(res)) {
      if (!line.startsWith('data:')) continue;
      let j: any; try { j = JSON.parse(line.slice(5).trim()); } catch { continue; }
      if (j.usageMetadata) usage = j.usageMetadata;
      for (const p of j.candidates?.[0]?.content?.parts ?? []) {
        if (typeof p.text === 'string' && p.text) { content += p.text; onDelta(p.text); }
        if (p.functionCall) toolCalls.push({ id: `gm_${toolCalls.length}`, name: p.functionCall.name, arguments: p.functionCall.args ?? {} });
      }
    }
    const pt = usage?.promptTokenCount ?? approxTokens(JSON.stringify(req.messages));
    const ct = usage?.candidatesTokenCount ?? approxTokens(content);
    return { content, toolCalls, model: req.model, usage: { promptTokens: pt, completionTokens: ct, totalTokens: pt + ct, costUsd: estimateCost(req.model, pt, ct) } };
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const data = await httpJson<any>(`${this.baseUrl}/models?key=${encodeURIComponent(this.apiKey)}`, { timeoutMs: 20_000 });
      return (data.models ?? [])
        .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m: any) => ({ id: String(m.name).replace(/^models\//, ''), name: m.displayName ?? m.name, contextLength: m.inputTokenLimit }));
    } catch {
      return [
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      ];
    }
  }

  async testConnection() {
    try {
      const m = await this.listModels();
      return m.length ? { ok: true, message: `تم الاتصال بنجاح (${m.length} نموذج)` } : { ok: false, message: 'فشل جلب النماذج' };
    } catch (e) { return { ok: false, message: (e as Error).message }; }
  }
}
