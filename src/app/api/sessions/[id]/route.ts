import { prisma } from "@/lib/db";
import { jsonError, jsonOk, publicErrorMessage } from "@/lib/api/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const session = await prisma.testSession.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        screenshots: { orderBy: { createdAt: "desc" } },
        reports: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!session) return jsonError("Session not found", 404);

    let parsedResults: unknown = null;
    if (session.results) {
      try {
        parsedResults = JSON.parse(session.results);
      } catch {
        parsedResults = session.results;
      }
    }

    return jsonOk({ ...session, parsedResults });
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to load session"), 500);
  }
}
