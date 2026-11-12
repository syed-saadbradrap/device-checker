export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function apiFetch<T>(
  input: string,
  init?: RequestInit
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(input, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...init?.headers,
      },
    });
    const json = (await res.json().catch(() => null)) as ApiResult<T> | null;
    if (!json || typeof json !== "object" || !("ok" in json)) {
      return { ok: false, error: `Unexpected response (${res.status})` };
    }
    if (!json.ok) {
      return { ok: false, error: json.error || `Request failed (${res.status})` };
    }
    return json;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network request failed",
    };
  }
}
