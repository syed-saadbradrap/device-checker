import { sanitizeEmailHtml, EMAIL_CLIENT_PROFILES } from "@/lib/email/sanitize";
import { analyzeEmailHtml } from "@/lib/email/analyze";
import {
  enforceRateLimit,
  jsonError,
  jsonOk,
  parseJsonBody,
  publicErrorMessage,
} from "@/lib/api/http";

const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "email-analyze", { max: 30 });
  if (!limited.allowed) return limited.response;

  try {
    const body = await parseJsonBody<{ html?: string }>(request);
    const html = typeof body.html === "string" ? body.html : "";
    if (!html.trim()) return jsonError("html is required", 400);

    const bytes = Buffer.byteLength(html, "utf8");
    if (bytes > MAX_HTML_BYTES) {
      return jsonError("HTML exceeds maximum size of 2MB", 413);
    }

    const sanitized = sanitizeEmailHtml(html);
    const analysis = analyzeEmailHtml(sanitized);

    return jsonOk({
      sanitizedHtml: sanitized,
      analysis,
      clientProfiles: EMAIL_CLIENT_PROFILES,
      inputBytes: bytes,
    });
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Email analysis failed"), 500);
  }
}
