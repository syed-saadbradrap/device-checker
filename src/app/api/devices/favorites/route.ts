import { prisma } from "@/lib/db";
import { getDeviceById, DEVICE_PRESETS } from "@/lib/devices/presets";
import {
  enforceRateLimit,
  jsonError,
  jsonOk,
  parseJsonBody,
  publicErrorMessage,
} from "@/lib/api/http";

export async function GET() {
  try {
    const favorites = await prisma.deviceFavorite.findMany({
      orderBy: { id: "asc" },
    });

    const enriched = favorites.map((fav: { id: string; deviceId: string }) => {
      const preset = getDeviceById(fav.deviceId);
      return {
        ...fav,
        device: preset ?? null,
      };
    });

    return jsonOk({
      favorites: enriched,
      presetCount: DEVICE_PRESETS.length,
    });
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to list favorites"), 500);
  }
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "devices-favorites-add");
  if (!limited.allowed) return limited.response;

  try {
    const body = await parseJsonBody<{ deviceId?: string }>(request);
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    if (!deviceId) return jsonError("deviceId is required", 400);

    const existing = await prisma.deviceFavorite.findUnique({ where: { deviceId } });
    if (existing) return jsonOk(existing);

    const favorite = await prisma.deviceFavorite.create({
      data: { deviceId },
    });
    return jsonOk(favorite);
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to add favorite"), 500);
  }
}

export async function DELETE(request: Request) {
  const limited = enforceRateLimit(request, "devices-favorites-delete");
  if (!limited.allowed) return limited.response;

  try {
    const body = await parseJsonBody<{ deviceId?: string }>(request);
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    if (!deviceId) return jsonError("deviceId is required", 400);

    const existing = await prisma.deviceFavorite.findUnique({ where: { deviceId } });
    if (!existing) return jsonError("Favorite not found", 404);

    await prisma.deviceFavorite.delete({ where: { deviceId } });
    return jsonOk({ deviceId, deleted: true });
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to remove favorite"), 500);
  }
}
