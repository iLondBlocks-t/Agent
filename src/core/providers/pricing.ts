/** Rough public pricing (USD per 1K tokens). Used for cost estimation & routing. */
export const PRICING: Record<string, { in: number; out: number }> = {
  'gpt-4o': { in: 0.0025, out: 0.01 },
  'gpt-4o-mini': { in: 0.00015, out: 0.0006 },
  'o4-mini': { in: 0.0011, out: 0.0044 },
  'claude-3-5-sonnet-latest': { in: 0.003, out: 0.015 },
  'claude-3-5-haiku-latest': { in: 0.0008, out: 0.004 },
  'gemini-1.5-pro': { in: 0.00125, out: 0.005 },
  'gemini-1.5-flash': { in: 0.000075, out: 0.0003 },
  'gemini-2.0-flash': { in: 0.0001, out: 0.0004 },
  'llama-3.3-70b-versatile': { in: 0.00059, out: 0.00079 },
  'deepseek-chat': { in: 0.00027, out: 0.0011 },
  'deepseek-reasoner': { in: 0.00055, out: 0.00219 },
};

export function findPricingKey(model: string): string | undefined {
  const m = model.toLowerCase();
  let best: string | undefined;
  for (const k of Object.keys(PRICING)) {
    if (!m.includes(k)) continue;
    if (best === undefined || k.length > best.length) best = k;
  }
  return best;
}

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const key = findPricingKey(model);
  const p = key ? PRICING[key] : { in: 0.0005, out: 0.0015 };
  return (promptTokens / 1000) * p.in + (completionTokens / 1000) * p.out;
}

/** Cheap heuristic when the API does not return usage. */
export function approxTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 3.6));
}
