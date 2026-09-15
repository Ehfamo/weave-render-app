export class BoundedIdempotencyCache<T> {
  private readonly ttlMs: number;
  private readonly entries = new Map<
    string,
    { hash: string; expiresAt: number; value: Promise<T> }
  >();
  constructor(ttlMs = 10 * 60 * 1000) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > 60 * 60 * 1000)
      throw new Error("INVALID_IDEMPOTENCY_TTL");
    this.ttlMs = ttlMs;
  }
  run(key: string, hash: string, operation: () => Promise<T>, now = Date.now()): Promise<T> {
    for (const [id, entry] of this.entries) if (entry.expiresAt <= now) this.entries.delete(id);
    const existing = this.entries.get(key);
    if (existing) {
      if (existing.hash !== hash) throw new Error("IDEMPOTENCY_CONFLICT");
      return existing.value;
    }
    const value = operation();
    this.entries.set(key, { hash, expiresAt: now + this.ttlMs, value });
    return value;
  }
}
