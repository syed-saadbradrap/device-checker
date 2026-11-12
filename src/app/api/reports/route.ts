import { prisma } from "@/lib/db";
import {
  enforceRateLimit,
  jsonError,
  jsonOk,
  parseJsonBody,
  publicErrorMessage,
} from "@/lib/api/http";

export async function GET() {
  try {
    const reports = await prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        project: { select: { id: true, name: true } },
        session: { select: { id: true, type: true, target: true } },
      },
    });
    return jsonOk(reports);
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to list reports"), 500);
  }
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "reports-create");
  if (!limited.allowed) return limited.response;

  try {
    const body = await parseJsonBody<{
      title?: string;
      type?: string;
      data?: unknown;
      projectId?: string;
      sessionId?: string;
      format?: string;
    }>(request);

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const type = typeof body.type === "string" ? body.type.trim() : "";
    if (!title) return jsonError("title is required", 400);
    if (!type) return jsonError("type is required", 400);
    if (body.data === undefined) return jsonError("data is required", 400);

    const dataString =
      typeof body.data === "string" ? body.data : JSON.stringify(body.data);

    const report = await prisma.report.create({
      data: {
        title,
        type,
        data: dataString,
        format: typeof body.format === "string" ? body.format : "json",
        projectId: typeof body.projectId === "string" ? body.projectId : undefined,
        sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
      },
    });

    return jsonOk(report);
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to save report"), 500);
  }
}
