import { prisma } from "@/lib/db";
import { jsonError, jsonOk, publicErrorMessage } from "@/lib/api/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        session: { select: { id: true, type: true, target: true, status: true } },
      },
    });
    if (!report) return jsonError("Report not found", 404);

    let parsedData: unknown = report.data;
    try {
      parsedData = JSON.parse(report.data);
    } catch {
      /* keep raw string */
    }

    return jsonOk({ ...report, parsedData });
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to load report"), 500);
  }
}
