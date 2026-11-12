import { validatePublicUrl } from "@/lib/security/url";
import {
  captureScreenshot,
  saveScreenshotBuffer,
  type BrowserEngine,
} from "@/lib/browser/playwright";
import {
  enforceRateLimit,
  jsonError,
  jsonOk,
  parseJsonBody,
  publicErrorMessage,
} from "@/lib/api/http";

const ALL_ENGINES: BrowserEngine[] = ["chromium", "firefox", "webkit"];

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "analyze-browsers", { max: 8 });
  if (!limited.allowed) return limited.response;

  try {
    const body = await parseJsonBody<{
      url?: string;
      engines?: string[];
      width?: number;
      height?: number;
    }>(request);

    const url = typeof body.url === "string" ? body.url : "";
    if (!url.trim()) return jsonError("URL is required", 400);

    const safe = await validatePublicUrl(url);
    if (!safe.ok) return jsonError(safe.error, 400);

    const engines = (
      Array.isArray(body.engines) && body.engines.length > 0
        ? body.engines
        : ALL_ENGINES
    ).filter((e): e is BrowserEngine => ALL_ENGINES.includes(e as BrowserEngine));

    if (engines.length === 0) {
      return jsonError("engines must include chromium, firefox, and/or webkit", 400);
    }

    const width = typeof body.width === "number" && body.width > 0 ? body.width : 1280;
    const height = typeof body.height === "number" && body.height > 0 ? body.height : 800;

    const captures = [];
    for (const engine of engines) {
      const capture = await captureScreenshot({
        url: safe.url,
        width,
        height,
        engine,
      });
      const filePath = await saveScreenshotBuffer(
        capture.buffer,
        `browser-${engine}-${Date.now()}.png`
      );
      captures.push({
        engine,
        title: capture.title,
        finalUrl: capture.finalUrl,
        browserVersion: capture.browserVersion,
        consoleErrors: capture.consoleErrors,
        pageErrors: capture.pageErrors,
        failedRequests: capture.failedRequests,
        imageBase64: capture.buffer.toString("base64"),
        filePath,
        width,
        height,
      });
    }

    return jsonOk({ url: safe.url, width, height, captures });
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Browser analysis failed"), 500);
  }
}
