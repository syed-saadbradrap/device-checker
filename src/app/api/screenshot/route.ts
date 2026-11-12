import { validatePublicUrl } from "@/lib/security/url";
import {
  captureScreenshot,
  saveScreenshotBuffer,
  type BrowserEngine,
} from "@/lib/browser/playwright";
import { getDeviceById } from "@/lib/devices/presets";
import {
  enforceRateLimit,
  jsonError,
  jsonOk,
  parseJsonBody,
  publicErrorMessage,
} from "@/lib/api/http";

type ScreenshotBody = {
  url?: string;
  width?: number;
  height?: number;
  dpr?: number;
  engine?: string;
  colorScheme?: "light" | "dark" | "no-preference";
  deviceId?: string;
  fullPage?: boolean;
};

const ENGINES: BrowserEngine[] = ["chromium", "firefox", "webkit"];

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "screenshot", { max: 20 });
  if (!limited.allowed) return limited.response;

  try {
    const body = await parseJsonBody<ScreenshotBody>(request);
    const url = typeof body.url === "string" ? body.url : "";
    if (!url.trim()) return jsonError("URL is required", 400);

    const safe = await validatePublicUrl(url);
    if (!safe.ok) return jsonError(safe.error, 400);

    const device = body.deviceId ? getDeviceById(body.deviceId) : undefined;

    const width = body.width ?? device?.width;
    const height = body.height ?? device?.height;
    if (!width || !height || width < 1 || height < 1) {
      return jsonError("width and height are required (or provide a valid deviceId)", 400);
    }

    const engine = (body.engine ?? "chromium") as BrowserEngine;
    if (!ENGINES.includes(engine)) {
      return jsonError("engine must be chromium, firefox, or webkit", 400);
    }

    const capture = await captureScreenshot({
      url: safe.url,
      width,
      height,
      dpr: body.dpr ?? device?.dpr ?? 1,
      engine,
      colorScheme: body.colorScheme,
      userAgent: device?.userAgent,
      fullPage: body.fullPage ?? false,
    });

    const filename = `shot-${Date.now()}-${engine}-${width}x${height}.png`;
    const filePath = await saveScreenshotBuffer(capture.buffer, filename);

    return jsonOk({
      imageBase64: capture.buffer.toString("base64"),
      mimeType: "image/png",
      filePath,
      metadata: {
        url: safe.url,
        finalUrl: capture.finalUrl,
        title: capture.title,
        width,
        height,
        dpr: body.dpr ?? device?.dpr ?? 1,
        engine: capture.engine,
        browserVersion: capture.browserVersion,
        deviceId: body.deviceId ?? null,
        colorScheme: body.colorScheme ?? "no-preference",
        fullPage: body.fullPage ?? false,
        consoleErrors: capture.consoleErrors,
        pageErrors: capture.pageErrors,
        failedRequests: capture.failedRequests,
      },
    });
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Screenshot capture failed"), 500);
  }
}
