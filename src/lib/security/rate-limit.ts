type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  opts?: { windowMs?: number; max?: number }
): { allowed: boolean; remaining: number; resetAt: number } {
  const windowMs = opts?.windowMs ?? Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
  const max = opts?.max ?? Number(process.env.RATE_LIMIT_MAX || 60);
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: max - 1, resetAt };
  }

  if (existing.count >= max) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: max - existing.count, resetAt: existing.resetAt };
}

export function clientKey(request: Request, suffix = ""): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "local";
  return `${ip}:${suffix}`;
}
