import { prisma } from "@/lib/db";
import { validatePublicUrl } from "@/lib/security/url";
import { analyzeBreakpoints } from "@/lib/analysis/responsive";
import {
  enforceRateLimit,
  jsonError,
  jsonOk,
  parseJsonBody,
  publicErrorMessage,
} from "@/lib/api/http";

const DEFAULT_WIDTHS = [375, 768, 1024, 1280, 1440];

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "analyze-responsive", { max: 10 });
  if (!limited.allowed) return limited.response;

  try {
    const body = await parseJsonBody<{
      url?: string;
      widths?: number[];
      projectId?: string;
    }>(request);

    const url = typeof body.url === "string" ? body.url : "";
    if (!url.trim()) return jsonError("URL is required", 400);

    const safe = await validatePublicUrl(url);
    if (!safe.ok) return jsonError(safe.error, 400);

    const widths =
      Array.isArray(body.widths) &&
      body.widths.length > 0 &&
      body.widths.every((w) => typeof w === "number" && w > 0)
        ? body.widths
        : DEFAULT_WIDTHS;

    const session = await prisma.testSession.create({
      data: {
        type: "responsive",
        target: safe.url,
        status: "running",
        progress: 0,
        projectId: typeof body.projectId === "string" ? body.projectId : undefined,
      },
    });

    try {
      const results = await analyzeBreakpoints(
        safe.url,
        widths,
        async (done, total) => {
          await prisma.testSession.update({
            where: { id: session.id },
            data: { progress: Math.round((done / total) * 100) },
          });
        }
      );

      const updated = await prisma.testSession.update({
        where: { id: session.id },
        data: {
          status: "completed",
          progress: 100,
          results: JSON.stringify({ url: safe.url, widths, results }),
          completedAt: new Date(),
        },
      });

      return jsonOk({
        sessionId: updated.id,
        url: safe.url,
        widths,
        results,
      });
    } catch (inner) {
      await prisma.testSession.update({
        where: { id: session.id },
        data: {
          status: "failed",
          error: publicErrorMessage(inner, "Responsive analysis failed"),
          completedAt: new Date(),
        },
      });
      throw inner;
    }
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Responsive analysis failed"), 500);
  }
}
