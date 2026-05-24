export interface RateLimiter {
  check(key: string): { allowed: boolean; retryAfter?: number };
}

interface Entry {
  count: number;
  firstAttempt: number;
}

export function createRateLimiter(maxAttempts: number, windowMs: number): RateLimiter {
  const store = new Map<string, Entry>();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.firstAttempt > windowMs) store.delete(key);
    }
  }, windowMs);
  if (typeof cleanup !== "number") cleanup.unref?.();

  return {
    check(key: string) {
      const now = Date.now();
      const entry = store.get(key);
      if (!entry || now - entry.firstAttempt > windowMs) {
        store.set(key, { count: 1, firstAttempt: now });
        return { allowed: true };
      }
      entry.count++;
      if (entry.count > maxAttempts) {
        const retryAfter = Math.ceil((entry.firstAttempt + windowMs - now) / 1000);
        return { allowed: false, retryAfter };
      }
      return { allowed: true };
    },
  };
}
