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
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: {
            urls: true,
            sessions: true,
            screenshots: true,
            reports: true,
          },
        },
      },
    });
    return jsonOk(projects);
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to list projects"), 500);
  }
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "projects-create");
  if (!limited.allowed) return limited.response;

  try {
    const body = await parseJsonBody<{ name?: string; description?: string }>(request);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return jsonError("name is required", 400);

    const project = await prisma.project.create({
      data: {
        name,
        description:
          typeof body.description === "string" ? body.description.trim() || null : null,
      },
    });

    return jsonOk(project);
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to create project"), 500);
  }
}
