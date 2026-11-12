import { prisma } from "@/lib/db";
import { jsonError, jsonOk, publicErrorMessage } from "@/lib/api/http";

export async function GET() {
  try {
    const sessions = await prisma.testSession.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        project: { select: { id: true, name: true } },
        _count: { select: { screenshots: true, reports: true } },
      },
    });
    return jsonOk(sessions);
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to list sessions"), 500);
  }
}
