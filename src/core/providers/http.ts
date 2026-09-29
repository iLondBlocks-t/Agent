export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RetryOptions { retries?: number; baseDelayMs?: number; maxDelayMs?: number; signal?: AbortSignal; }

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
  });
}

/** Exponential backoff with jitter. Retries on 408/429/5xx and network errors. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 600;
  const max = opts.maxDelayMs ?? 12_000;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await fn(); } catch (err) {
      lastErr = err;
      const retriable = err instanceof ApiError
        ? [408, 409, 425, 429, 500, 502, 503, 504].includes(err.status)
        : true;
      if (!retriable || attempt === retries) break;
      const delay = Math.min(max, base * 2 ** attempt) * (0.7 + Math.random() * 0.6);
      await sleep(delay, opts.signal);
    }
  }
  throw lastErr;
}

export async function httpJson<T = any>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const text = await httpText(url, init);
  if (!text) return {} as T;
  try { return JSON.parse(text) as T; } catch { throw new ApiError('Invalid JSON response', 0, text.slice(0, 500)); }
}

export async function httpText(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<string> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 120_000);
  const external = init.signal as AbortSignal | undefined;
  external?.addEventListener('abort', () => ctrl.abort(), { once: true });
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const body = await res.text();
    if (!res.ok) throw new ApiError(`HTTP ${res.status} ${res.statusText}`, res.status, body.slice(0, 1000));
    return body;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError((err as Error).message || 'Network error', 0);
  } finally { clearTimeout(timeout); }
}

export async function* sseLines(res: Response): AsyncGenerator<string> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n');
    buf = parts.pop() ?? '';
    for (const line of parts) { const t = line.trim(); if (t) yield t; }
  }
  if (buf.trim()) yield buf.trim();
}
