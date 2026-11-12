import { NextResponse } from "next/server";
import { rateLimit, clientKey } from "@/lib/security/rate-limit";

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: string };

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data } satisfies ApiOk<T>, {
    status: 200,
    ...init,
  });
}

export function jsonError(error: string, status = 400) {
  return NextResponse.json({ ok: false, error } satisfies ApiErr, { status });
}

export function enforceRateLimit(
  request: Request,
  suffix: string,
  opts?: { windowMs?: number; max?: number }
): { allowed: true } | { allowed: false; response: NextResponse } {
  const result = rateLimit(clientKey(request, suffix), opts);
  if (!result.allowed) {
    return {
      allowed: false,
      response: jsonError("Rate limit exceeded. Try again later.", 429),
    };
  }
  return { allowed: true };
}

export function publicErrorMessage(e: unknown, fallback = "Request failed"): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}
