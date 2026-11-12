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
    const devices = await prisma.customDevice.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return jsonOk(devices);
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to list custom devices"), 500);
  }
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "devices-custom-create");
  if (!limited.allowed) return limited.response;

  try {
    const body = await parseJsonBody<{
      name?: string;
      brand?: string;
      category?: string;
      width?: number;
      height?: number;
      dpr?: number;
      physicalW?: number;
      physicalH?: number;
      userAgent?: string;
      notes?: string;
    }>(request);

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const width = body.width;
    const height = body.height;

    if (!name) return jsonError("name is required", 400);
    if (!category) return jsonError("category is required", 400);
    if (typeof width !== "number" || width < 1) return jsonError("width is required", 400);
    if (typeof height !== "number" || height < 1) {
      return jsonError("height is required", 400);
    }

    const device = await prisma.customDevice.create({
      data: {
        name,
        brand: typeof body.brand === "string" && body.brand.trim() ? body.brand.trim() : "Custom",
        category,
        width,
        height,
        dpr: typeof body.dpr === "number" && body.dpr > 0 ? body.dpr : 1,
        physicalW: typeof body.physicalW === "number" ? body.physicalW : null,
        physicalH: typeof body.physicalH === "number" ? body.physicalH : null,
        userAgent: typeof body.userAgent === "string" ? body.userAgent : null,
        notes: typeof body.notes === "string" ? body.notes : null,
      },
    });

    return jsonOk(device);
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to create custom device"), 500);
  }
}

export async function DELETE(request: Request) {
  const limited = enforceRateLimit(request, "devices-custom-delete");
  if (!limited.allowed) return limited.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return jsonError("id query parameter is required", 400);

    const existing = await prisma.customDevice.findUnique({ where: { id } });
    if (!existing) return jsonError("Custom device not found", 404);

    await prisma.customDevice.delete({ where: { id } });
    return jsonOk({ id, deleted: true });
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to delete custom device"), 500);
  }
}
