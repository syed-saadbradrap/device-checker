import { compareScreenshots } from "@/lib/analysis/visual";
import {
  enforceRateLimit,
  jsonError,
  jsonOk,
  publicErrorMessage,
} from "@/lib/api/http";

function stripDataUrl(input: string): string {
  const idx = input.indexOf("base64,");
  if (idx !== -1) return input.slice(idx + "base64,".length);
  return input;
}

function bufferFromBase64(value: string): Buffer {
  return Buffer.from(stripDataUrl(value.trim()), "base64");
}

async function readImages(
  request: Request
): Promise<{
  baseline: Buffer;
  current: Buffer;
  threshold?: number;
  maxDiffPercent?: number;
}> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const thresholdRaw = form.get("threshold");
    const maxDiffRaw = form.get("maxDiffPercent");
    const threshold =
      typeof thresholdRaw === "string" && thresholdRaw !== ""
        ? Number(thresholdRaw)
        : undefined;
    const maxDiffPercent =
      typeof maxDiffRaw === "string" && maxDiffRaw !== ""
        ? Number(maxDiffRaw)
        : undefined;

    const baselineField = form.get("baseline") ?? form.get("imageA") ?? form.get("a");
    const currentField = form.get("current") ?? form.get("imageB") ?? form.get("b");

    let baseline: Buffer | null = null;
    let current: Buffer | null = null;

    if (baselineField instanceof File) {
      baseline = Buffer.from(await baselineField.arrayBuffer());
    } else if (typeof baselineField === "string") {
      baseline = bufferFromBase64(baselineField);
    }

    if (currentField instanceof File) {
      current = Buffer.from(await currentField.arrayBuffer());
    } else if (typeof currentField === "string") {
      current = bufferFromBase64(currentField);
    }

    if (!baseline || !current) {
      throw new Error("baseline and current images are required");
    }

    return { baseline, current, threshold, maxDiffPercent };
  }

  const body = (await request.json()) as {
    baseline?: string;
    current?: string;
    imageA?: string;
    imageB?: string;
    a?: string;
    b?: string;
    threshold?: number;
    maxDiffPercent?: number;
  };

  const baselineB64 = body.baseline ?? body.imageA ?? body.a;
  const currentB64 = body.current ?? body.imageB ?? body.b;
  if (typeof baselineB64 !== "string" || typeof currentB64 !== "string") {
    throw new Error("baseline and current base64 images are required");
  }

  return {
    baseline: bufferFromBase64(baselineB64),
    current: bufferFromBase64(currentB64),
    threshold: typeof body.threshold === "number" ? body.threshold : undefined,
    maxDiffPercent:
      typeof body.maxDiffPercent === "number" ? body.maxDiffPercent : undefined,
  };
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "visual-compare", { max: 20 });
  if (!limited.allowed) return limited.response;

  try {
    const { baseline, current, threshold, maxDiffPercent } = await readImages(request);

    if (baseline.length === 0 || current.length === 0) {
      return jsonError("Images must be non-empty", 400);
    }

    const result = await compareScreenshots(baseline, current, {
      threshold,
      maxDiffPercent,
    });

    return jsonOk({
      width: result.width,
      height: result.height,
      diffPixels: result.diffPixels,
      totalPixels: result.totalPixels,
      diffRatio: result.diffRatio,
      diffPercent: result.diffPercent,
      passed: result.passed,
      diffBase64: result.diffPng.toString("base64"),
      mimeType: "image/png",
    });
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Visual comparison failed"), 500);
  }
}
