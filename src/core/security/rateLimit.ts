/** Simple token-bucket rate limiter, per key (agent/tool/provider). */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; last: number }>();
  constructor(private capacity = 12, private refillPerSec = 2) {}

  tryConsume(key: string, cost = 1): boolean {
    const now = Date.now();
    const b = this.buckets.get(key) ?? { tokens: this.capacity, last: now };
    const elapsed = (now - b.last) / 1000;
    b.tokens = Math.min(this.capacity, b.tokens + elapsed * this.refillPerSec);
    b.last = now;
    if (b.tokens < cost) { this.buckets.set(key, b); return false; }
    b.tokens -= cost;
    this.buckets.set(key, b);
    return true;
  }

  async consume(key: string, cost = 1): Promise<void> {
    for (let i = 0; i < 100; i++) {
      if (this.tryConsume(key, cost)) return;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error('تجاوز حد المعدل (rate limit)');
  }
}

export const globalLimiter = new RateLimiter(20, 4);
