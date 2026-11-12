import { validatePublicUrl } from "@/lib/security/url";
import { probeFrameEmbedding } from "@/lib/browser/playwright";
import {
  enforceRateLimit,
  jsonError,
  jsonOk,
  parseJsonBody,
  publicErrorMessage,
} from "@/lib/api/http";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "validate-url");
  if (!limited.allowed) return limited.response;

  try {
    const body = await parseJsonBody<{ url?: string }>(request);
    const url = typeof body.url === "string" ? body.url : "";
    if (!url.trim()) return jsonError("URL is required", 400);

    const safe = await validatePublicUrl(url);
    if (!safe.ok) return jsonError(safe.error, 400);

    const embedding = await probeFrameEmbedding(safe.url);

    return jsonOk({
      url: safe.url,
      hostname: safe.hostname,
      resolvedIps: safe.resolvedIps,
      embedding,
    });
  } catch (e) {
    return jsonError(publicErrorMessage(e, "URL validation failed"), 500);
  }
}
