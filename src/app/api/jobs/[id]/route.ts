import { prisma } from "@/lib/db";
import {
  enforceRateLimit,
  jsonError,
  jsonOk,
  publicErrorMessage,
} from "@/lib/api/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return jsonError("Job not found", 404);

    let parsedResult: unknown = null;
    if (job.result) {
      try {
        parsedResult = JSON.parse(job.result);
      } catch {
        parsedResult = job.result;
      }
    }

    let parsedPayload: unknown = job.payload;
    try {
      parsedPayload = JSON.parse(job.payload);
    } catch {
      /* keep raw */
    }

    return jsonOk({ ...job, parsedPayload, parsedResult });
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to load job"), 500);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const limited = enforceRateLimit(request, "jobs-cancel");
  if (!limited.allowed) return limited.response;

  try {
    const { id } = await ctx.params;
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return jsonError("Job not found", 404);

    if (job.status === "completed" || job.status === "failed") {
      return jsonOk({
        ...job,
        cancelled: false,
        message: `Job already ${job.status}`,
      });
    }

    const updated = await prisma.job.update({
      where: { id },
      data: {
        status: "cancelled",
        completedAt: new Date(),
        error: job.error ?? "Cancelled by user",
      },
    });

    return jsonOk({ ...updated, cancelled: true });
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to cancel job"), 500);
  }
}
