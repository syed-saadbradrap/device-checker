import { prisma } from "@/lib/db";
import { DEVICE_PRESETS } from "@/lib/devices/presets";
import { jsonError, jsonOk, publicErrorMessage } from "@/lib/api/http";

export async function GET() {
  try {
    const [
      projectCount,
      sessionCount,
      screenshotCount,
      reportCount,
      jobCount,
      customDeviceCount,
      favoriteCount,
      recentSessions,
      sessionsByType,
      jobsByStatus,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.testSession.count(),
      prisma.screenshot.count(),
      prisma.report.count(),
      prisma.job.count(),
      prisma.customDevice.count(),
      prisma.deviceFavorite.count(),
      prisma.testSession.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          type: true,
          target: true,
          status: true,
          progress: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      prisma.testSession.groupBy({
        by: ["type"],
        _count: { _all: true },
      }),
      prisma.job.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    const completedSessions = await prisma.testSession.count({
      where: { status: "completed" },
    });
    const failedSessions = await prisma.testSession.count({
      where: { status: "failed" },
    });

    return jsonOk({
      counts: {
        projects: projectCount,
        sessions: sessionCount,
        screenshots: screenshotCount,
        reports: reportCount,
        jobs: jobCount,
        customDevices: customDeviceCount,
        favorites: favoriteCount,
        devicePresets: DEVICE_PRESETS.length,
        completedSessions,
        failedSessions,
      },
      sessionsByType: sessionsByType.map((row: { type: string; _count: { _all: number } }) => ({
        type: row.type,
        count: row._count._all,
      })),
      jobsByStatus: jobsByStatus.map((row: { status: string; _count: { _all: number } }) => ({
        status: row.status,
        count: row._count._all,
      })),
      recentSessions,
    });
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to load stats"), 500);
  }
}
