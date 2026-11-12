import { validatePublicUrl } from "@/lib/security/url";
import { runAccessibilityAudit } from "@/lib/analysis/accessibility";
import {
  enforceRateLimit,
  jsonError,
  jsonOk,
  parseJsonBody,
  publicErrorMessage,
} from "@/lib/api/http";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "analyze-accessibility", { max: 10 });
  if (!limited.allowed) return limited.response;

  try {
    const body = await parseJsonBody<{
      url?: string;
      width?: number;
      height?: number;
    }>(request);

    const url = typeof body.url === "string" ? body.url : "";
    if (!url.trim()) return jsonError("URL is required", 400);

    const safe = await validatePublicUrl(url);
    if (!safe.ok) return jsonError(safe.error, 400);

    const report = await runAccessibilityAudit(safe.url, {
      width: typeof body.width === "number" ? body.width : undefined,
      height: typeof body.height === "number" ? body.height : undefined,
    });

    return jsonOk(report);
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Accessibility audit failed"), 500);
  }
}
