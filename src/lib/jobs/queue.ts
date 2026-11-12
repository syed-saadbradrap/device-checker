import { prisma } from "@/lib/db";
import { validatePublicUrl } from "@/lib/security/url";
import {
  captureScreenshot,
  saveScreenshotBuffer,
  type BrowserEngine,
} from "@/lib/browser/playwright";
import { analyzeBreakpoints } from "@/lib/analysis/responsive";
import { runLighthouse } from "@/lib/analysis/lighthouse";

const MAX_CONCURRENCY = 2;
let activeCount = 0;
const waitQueue: Array<() => void> = [];

const HEAVY_TYPES = new Set(["responsive", "performance", "browsers"]);

async function acquireSlot(): Promise<void> {
  if (activeCount < MAX_CONCURRENCY) {
    activeCount += 1;
    return;
  }
  await new Promise<void>((resolve) => {
    waitQueue.push(resolve);
  });
  activeCount += 1;
}

function releaseSlot(): void {
  activeCount = Math.max(0, activeCount - 1);
  const next = waitQueue.shift();
  if (next) next();
}

function parsePayload(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

async function updateJob(
  id: string,
  data: {
    status?: string;
    progress?: number;
    result?: string | null;
    error?: string | null;
    completedAt?: Date | null;
  }
) {
  const existing = await prisma.job.findUnique({ where: { id } });
  if (!existing) return null;
  if (existing.status === "cancelled") return existing;
  return prisma.job.update({ where: { id }, data });
}

async function processResponsive(jobId: string, payload: Record<string, unknown>) {
  const url = typeof payload.url === "string" ? payload.url : "";
  const safe = await validatePublicUrl(url);
  if (!safe.ok) throw new Error(safe.error);

  const widths =
    Array.isArray(payload.widths) && payload.widths.every((w) => typeof w === "number")
      ? (payload.widths as number[])
      : [375, 768, 1024, 1280, 1440];

  await updateJob(jobId, { status: "running", progress: 0 });

  const results = await analyzeBreakpoints(safe.url, widths, async (done, total) => {
    const progress = Math.round((done / total) * 100);
    await updateJob(jobId, { progress });
  });

  const current = await prisma.job.findUnique({ where: { id: jobId } });
  if (current?.status === "cancelled") return;

  await updateJob(jobId, {
    status: "completed",
    progress: 100,
    result: JSON.stringify({ url: safe.url, widths, results }),
    completedAt: new Date(),
    error: null,
  });
}

async function processPerformance(jobId: string, payload: Record<string, unknown>) {
  const url = typeof payload.url === "string" ? payload.url : "";
  const safe = await validatePublicUrl(url);
  if (!safe.ok) throw new Error(safe.error);

  await updateJob(jobId, { status: "running", progress: 10 });
  const report = await runLighthouse(safe.url);

  const current = await prisma.job.findUnique({ where: { id: jobId } });
  if (current?.status === "cancelled") return;

  await updateJob(jobId, {
    status: "completed",
    progress: 100,
    result: JSON.stringify(report),
    completedAt: new Date(),
    error: null,
  });
}

async function processBrowsers(jobId: string, payload: Record<string, unknown>) {
  const url = typeof payload.url === "string" ? payload.url : "";
  const safe = await validatePublicUrl(url);
  if (!safe.ok) throw new Error(safe.error);

  const enginesRaw = Array.isArray(payload.engines)
    ? (payload.engines as unknown[]).filter((e): e is string => typeof e === "string")
    : ["chromium", "firefox", "webkit"];
  const allowed: BrowserEngine[] = ["chromium", "firefox", "webkit"];
  const engines = enginesRaw.filter((e): e is BrowserEngine =>
    allowed.includes(e as BrowserEngine)
  );
  const width = typeof payload.width === "number" ? payload.width : 1280;
  const height = typeof payload.height === "number" ? payload.height : 800;

  await updateJob(jobId, { status: "running", progress: 0 });

  const captures: Array<{
    engine: BrowserEngine;
    title: string;
    finalUrl: string;
    browserVersion: string;
    consoleErrors: string[];
    pageErrors: string[];
    failedRequests: Array<{ url: string; status?: number; error?: string }>;
    imageBase64: string;
    filePath: string;
  }> = [];

  for (let i = 0; i < engines.length; i++) {
    const current = await prisma.job.findUnique({ where: { id: jobId } });
    if (current?.status === "cancelled") return;

    const engine = engines[i]!;
    const capture = await captureScreenshot({
      url: safe.url,
      width,
      height,
      engine,
    });
    const filePath = await saveScreenshotBuffer(
      capture.buffer,
      `job-${jobId}-${engine}-${Date.now()}.png`
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
    });
    await updateJob(jobId, {
      progress: Math.round(((i + 1) / engines.length) * 100),
    });
  }

  const final = await prisma.job.findUnique({ where: { id: jobId } });
  if (final?.status === "cancelled") return;

  await updateJob(jobId, {
    status: "completed",
    progress: 100,
    result: JSON.stringify({ url: safe.url, width, height, captures }),
    completedAt: new Date(),
    error: null,
  });
}

async function runJob(jobId: string): Promise<void> {
  await acquireSlot();
  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.status === "cancelled") return;

    const payload = parsePayload(job.payload);

    if (job.type === "responsive") {
      await processResponsive(jobId, payload);
    } else if (job.type === "performance") {
      await processPerformance(jobId, payload);
    } else if (job.type === "browsers") {
      await processBrowsers(jobId, payload);
    } else {
      await updateJob(jobId, {
        status: "completed",
        progress: 100,
        result: JSON.stringify({ note: "No async processor for this job type", payload }),
        completedAt: new Date(),
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Job failed";
    try {
      const current = await prisma.job.findUnique({ where: { id: jobId } });
      if (current && current.status !== "cancelled") {
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: "failed",
            error: message,
            completedAt: new Date(),
          },
        });
      }
    } catch {
      /* ignore secondary failure */
    }
  } finally {
    releaseSlot();
  }
}

/** Enqueue async processing for heavy job types (in-process, concurrency ≤ 2). */
export function enqueueJob(jobId: string, type: string): void {
  if (!HEAVY_TYPES.has(type)) {
    // Light jobs: mark completed immediately with stored payload echo
    void (async () => {
      try {
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job || job.status === "cancelled") return;
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: "completed",
            progress: 100,
            result: job.payload,
            completedAt: new Date(),
          },
        });
      } catch {
        /* ignore */
      }
    })();
    return;
  }

  // setImmediate / void promise — fire-and-forget
  if (typeof setImmediate === "function") {
    setImmediate(() => {
      void runJob(jobId);
    });
  } else {
    void runJob(jobId);
  }
}

export function isHeavyJobType(type: string): boolean {
  return HEAVY_TYPES.has(type);
}
