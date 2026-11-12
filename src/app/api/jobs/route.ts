import { prisma } from "@/lib/db";
import { enqueueJob } from "@/lib/jobs/queue";
import {
  enforceRateLimit,
  jsonError,
  jsonOk,
  parseJsonBody,
  publicErrorMessage,
} from "@/lib/api/http";

export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return jsonOk(jobs);
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to list jobs"), 500);
  }
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "jobs-create", { max: 20 });
  if (!limited.allowed) return limited.response;

  try {
    const body = await parseJsonBody<{ type?: string; payload?: unknown }>(request);
    const type = typeof body.type === "string" ? body.type.trim() : "";
    if (!type) return jsonError("type is required", 400);
    if (body.payload === undefined) return jsonError("payload is required", 400);

    const payloadString =
      typeof body.payload === "string" ? body.payload : JSON.stringify(body.payload);

    const job = await prisma.job.create({
      data: {
        type,
        payload: payloadString,
        status: "queued",
        progress: 0,
      },
    });

    enqueueJob(job.id, type);

    return jsonOk(job);
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to create job"), 500);
  }
}
