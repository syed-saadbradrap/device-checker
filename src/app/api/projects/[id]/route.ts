import { prisma } from "@/lib/db";
import {
  enforceRateLimit,
  jsonError,
  jsonOk,
  parseJsonBody,
  publicErrorMessage,
} from "@/lib/api/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        urls: true,
        sessions: { orderBy: { createdAt: "desc" }, take: 20 },
        reports: { orderBy: { createdAt: "desc" }, take: 20 },
        _count: {
          select: { screenshots: true, emails: true },
        },
      },
    });
    if (!project) return jsonError("Project not found", 404);
    return jsonOk(project);
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to load project"), 500);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  const limited = enforceRateLimit(request, "projects-patch");
  if (!limited.allowed) return limited.response;

  try {
    const { id } = await ctx.params;
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) return jsonError("Project not found", 404);

    const body = await parseJsonBody<{ name?: string; description?: string | null }>(
      request
    );

    const data: { name?: string; description?: string | null } = {};
    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) return jsonError("name cannot be empty", 400);
      data.name = name;
    }
    if (body.description === null) {
      data.description = null;
    } else if (typeof body.description === "string") {
      data.description = body.description.trim() || null;
    }

    const project = await prisma.project.update({ where: { id }, data });
    return jsonOk(project);
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to update project"), 500);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const limited = enforceRateLimit(request, "projects-delete");
  if (!limited.allowed) return limited.response;

  try {
    const { id } = await ctx.params;
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) return jsonError("Project not found", 404);

    await prisma.project.delete({ where: { id } });
    return jsonOk({ id, deleted: true });
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to delete project"), 500);
  }
}
