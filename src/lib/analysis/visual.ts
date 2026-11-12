import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import sharp from "sharp";

export interface DiffResult {
  width: number;
  height: number;
  diffPixels: number;
  totalPixels: number;
  diffRatio: number;
  diffPercent: number;
  passed: boolean;
  diffPng: Buffer;
}

async function toRawPng(buffer: Buffer, width: number, height: number) {
  const resized = await sharp(buffer)
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .png()
    .toBuffer();
  return PNG.sync.read(resized);
}

export async function compareScreenshots(
  baseline: Buffer,
  current: Buffer,
  opts?: { threshold?: number; maxDiffPercent?: number }
): Promise<DiffResult> {
  const threshold = opts?.threshold ?? 0.1;
  const maxDiffPercent = opts?.maxDiffPercent ?? 0.5;

  const metaA = await sharp(baseline).metadata();
  const metaB = await sharp(current).metadata();
  const width = Math.max(metaA.width || 1, metaB.width || 1);
  const height = Math.max(metaA.height || 1, metaB.height || 1);

  const imgA = await toRawPng(baseline, width, height);
  const imgB = await toRawPng(current, width, height);
  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(imgA.data, imgB.data, diff.data, width, height, {
    threshold,
    includeAA: true,
  });

  const totalPixels = width * height;
  const diffRatio = diffPixels / totalPixels;
  const diffPercent = diffRatio * 100;

  return {
    width,
    height,
    diffPixels,
    totalPixels,
    diffRatio,
    diffPercent,
    passed: diffPercent <= maxDiffPercent,
    diffPng: PNG.sync.write(diff),
  };
}
