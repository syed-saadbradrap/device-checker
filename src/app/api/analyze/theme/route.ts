import { validatePublicUrl } from "@/lib/security/url";
import { captureScreenshot, saveScreenshotBuffer } from "@/lib/browser/playwright";
import {
  enforceRateLimit,
  jsonError,
  jsonOk,
  parseJsonBody,
  publicErrorMessage,
} from "@/lib/api/http";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "analyze-theme", { max: 10 });
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

    const width = typeof body.width === "number" && body.width > 0 ? body.width : 1280;
    const height = typeof body.height === "number" && body.height > 0 ? body.height : 800;

    const themes = ["light", "dark"] as const;
    const screenshots = [];

    for (const colorScheme of themes) {
      const capture = await captureScreenshot({
        url: safe.url,
        width,
        height,
        colorScheme,
        engine: "chromium",
      });
      const filePath = await saveScreenshotBuffer(
        capture.buffer,
        `theme-${colorScheme}-${Date.now()}.png`
      );
      screenshots.push({
        colorScheme,
        title: capture.title,
        finalUrl: capture.finalUrl,
        imageBase64: capture.buffer.toString("base64"),
        filePath,
        consoleErrors: capture.consoleErrors,
        pageErrors: capture.pageErrors,
      });
    }

    return jsonOk({ url: safe.url, width, height, screenshots });
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Theme analysis failed"), 500);
  }
}
