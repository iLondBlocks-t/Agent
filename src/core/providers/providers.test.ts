import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { OpenAICompatibleProvider } from './openaiCompatible';
import { createProvider, PROVIDER_CATALOG, metaFor } from './registry';
import { approxTokens, estimateCost } from './pricing';
import { ApiError, withRetry } from './http';
import type { ProviderConfig } from '@/types';

const cfg = (kind: ProviderConfig['kind']): ProviderConfig => ({
  id: `id-${kind}`, kind, name: kind, baseUrl: 'https://example.test/v1',
  apiKey: 'sk-test-key', defaultModel: 'm1', enabled: true, createdAt: 0,
});

function mockFetchJson(payload: unknown, ok = true, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(payload), { status: ok ? status : status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('registry', () => {
  it('creates a provider for every catalog entry', () => {
    for (const meta of PROVIDER_CATALOG) {
      const p = createProvider(cfg(meta.kind));
      expect(p.kind).toBe(meta.kind);
      expect(typeof p.chat).toBe('function');
      expect(typeof p.stream).toBe('function');
      expect(typeof p.listModels).toBe('function');
    }
  });

  it('falls back to the custom OpenAI adapter for unknown kinds', () => {
    expect(metaFor('openai-compatible').kind).toBe('openai-compatible');
  });
});

describe('pricing', () => {
  it('estimates tokens and cost', () => {
    expect(approxTokens('hello world')).toBeGreaterThan(0);
    expect(estimateCost('gpt-4o-mini', 1000, 1000)).toBeCloseTo(0.00075, 5);
  });
});

describe('OpenAICompatibleProvider', () => {
  it('parses chat responses and tool calls', async () => {
    mockFetchJson({
      model: 'm1',
      choices: [{ message: { content: 'مرحبا', tool_calls: [{ id: 'c1', function: { name: 'file_write', arguments: '{"path":"a.ts"}' } }] } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
    const p = createProvider(cfg('openai-compatible'));
    const res = await p.chat({ model: 'm1', messages: [{ role: 'user', content: 'hi' }] });
    expect(res.content).toBe('مرحبا');
    expect(res.toolCalls[0].name).toBe('file_write');
    expect(res.toolCalls[0].arguments).toEqual({ path: 'a.ts' });
    expect(res.usage.totalTokens).toBe(15);
  });

  it('lists models', async () => {
    mockFetchJson({ data: [{ id: 'model-a' }, { id: 'model-b' }] });
    const models = await createProvider(cfg('groq')).listModels();
    expect(models.map((m) => m.id)).toEqual(['model-a', 'model-b']);
  });

  it('returns fallback models when listing fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    const models = await createProvider(cfg('openrouter')).listModels();
    expect(models.length).toBeGreaterThan(0);
  });

  it('builds tool payloads only when tools are given', async () => {
    const fetchMock = mockFetchJson({ choices: [{ message: { content: 'ok' } }] });
    const p = new OpenAICompatibleProvider(cfg('openai-compatible'), { kind: 'openai-compatible', defaultBaseUrl: 'https://example.test/v1' });
    await p.chat({ model: 'm1', messages: [{ role: 'user', content: 'x' }] });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.tools).toBeUndefined();
  });
});

describe('GeminiProvider', () => {
  it('parses candidates and function calls', async () => {
    mockFetchJson({
      candidates: [{ content: { parts: [{ text: 'أهلا' }, { functionCall: { name: 'web_search', args: { query: 'x' } } }] } }],
      usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 6 },
    });
    const p = new GeminiProvider(cfg('gemini'));
    const res = await p.chat({ model: 'gemini-1.5-flash', messages: [{ role: 'user', content: 'hi' }] });
    expect(res.content).toBe('أهلا');
    expect(res.toolCalls[0].name).toBe('web_search');
    expect(res.usage.totalTokens).toBe(10);
  });
});

describe('AnthropicProvider', () => {
  it('parses content blocks and tool_use', async () => {
    mockFetchJson({
      model: 'claude-3-5-haiku-latest',
      content: [{ type: 'text', text: 'تم' }, { type: 'tool_use', id: 'tu1', name: 'file_read', input: { path: 'a' } }],
      usage: { input_tokens: 7, output_tokens: 3 },
    });
    const p = new AnthropicProvider(cfg('anthropic'));
    const res = await p.chat({ model: 'claude-3-5-haiku-latest', messages: [{ role: 'user', content: 'hi' }] });
    expect(res.content).toBe('تم');
    expect(res.toolCalls[0].id).toBe('tu1');
    expect(res.usage.promptTokens).toBe(7);
  });
});

describe('withRetry', () => {
  it('retries retriable errors then succeeds', async () => {
    let calls = 0;
    const out = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new ApiError('rate limited', 429);
      return 'ok';
    }, { retries: 3, baseDelayMs: 1 });
    expect(out).toBe('ok');
    expect(calls).toBe(3);
  });

  it('does not retry non-retriable errors', async () => {
    let calls = 0;
    await expect(withRetry(async () => { calls++; throw new ApiError('bad key', 401); }, { retries: 3, baseDelayMs: 1 }))
      .rejects.toThrow('bad key');
    expect(calls).toBe(1);
  });
});
