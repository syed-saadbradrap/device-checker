import { validatePublicUrl } from "@/lib/security/url";
import { analyzeSeo } from "@/lib/analysis/seo";
import {
  enforceRateLimit,
  jsonError,
  jsonOk,
  parseJsonBody,
  publicErrorMessage,
} from "@/lib/api/http";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "analyze-seo", { max: 15 });
  if (!limited.allowed) return limited.response;

  try {
    const body = await parseJsonBody<{ url?: string }>(request);
    const url = typeof body.url === "string" ? body.url : "";
    if (!url.trim()) return jsonError("URL is required", 400);

    const safe = await validatePublicUrl(url);
    if (!safe.ok) return jsonError(safe.error, 400);

    const report = await analyzeSeo(safe.url);
    return jsonOk(report);
  } catch (e) {
    return jsonError(publicErrorMessage(e, "SEO analysis failed"), 500);
  }
}
