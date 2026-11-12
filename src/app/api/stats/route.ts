import { prisma } from "@/lib/db";
import { DEVICE_PRESETS } from "@/lib/devices/presets";
import { jsonOk } from "@/lib/api/http";

const emptyStats = {
  counts: {
    projects: 0,
    sessions: 0,
    screenshots: 0,
    reports: 0,
    jobs: 0,
    customDevices: 0,
    favorites: 0,
    devicePresets: DEVICE_PRESETS.length,
    completedSessions: 0,
    failedSessions: 0,
  },
  sessionsByType: [] as Array<{ type: string; count: number }>,
  jobsByStatus: [] as Array<{ status: string; count: number }>,
  recentSessions: [] as Array<{
    id: string;
    type: string;
    target: string;
    status: string;
    progress: number;
    createdAt: Date;
    completedAt: Date | null;
  }>,
};

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
      completedSessions,
      failedSessions,
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
      prisma.testSession.count({ where: { status: "completed" } }),
      prisma.testSession.count({ where: { status: "failed" } }),
    ]);

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
      sessionsByType: sessionsByType.map((row) => ({
        type: row.type,
        count: row._count._all,
      })),
      jobsByStatus: jobsByStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      recentSessions,
    });
  } catch (e) {
    // Never surface raw Prisma/env internals on the home page
    console.error("[stats]", e instanceof Error ? e.message : e);
    return jsonOk({
      ...emptyStats,
      unavailable: true,
      message: "Activity history is temporarily unavailable. You can still run tests.",
    });
  }
}
