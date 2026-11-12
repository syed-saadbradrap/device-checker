"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Camera,
  FileText,
  FolderKanban,
  Gauge,
  GitCompare,
  Mail,
  Smartphone,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";

type StatsData = {
  counts?: {
    projects?: number;
    sessions?: number;
    screenshots?: number;
    reports?: number;
    completedSessions?: number;
    failedSessions?: number;
  };
  sessionsByType?: Array<{ type: string; count: number }>;
  recentSessions?: Array<{
    id: string;
    type: string;
    target: string;
    status: string;
    createdAt: string;
  }>;
};

const QUICK_ACTIONS = [
  {
    title: "Responsive Tester",
    href: "/testing/responsive",
    description: "Multi-device viewport workspace",
    icon: Smartphone,
  },
  {
    title: "Email Tester",
    href: "/email/tester",
    description: "Sanitize and preview HTML email",
    icon: Mail,
  },
  {
    title: "Screenshot Compare",
    href: "/visual/compare",
    description: "Diff two captures or uploads",
    icon: GitCompare,
  },
  {
    title: "Performance",
    href: "/audits/performance",
    description: "Run a real Lighthouse audit",
    icon: Gauge,
  },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await apiFetch<StatsData>("/api/stats");
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setStats(null);
      } else {
        setError(null);
        setStats(res.data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sessionCount = stats?.counts?.sessions ?? 0;
  const projectCount = stats?.counts?.projects ?? 0;
  const reportCount = stats?.counts?.reports ?? 0;
  const screenshotCount = stats?.counts?.screenshots ?? 0;
  const byType = stats?.sessionsByType ?? [];
  const recent = stats?.recentSessions ?? [];
  const hasTests = sessionCount > 0 || byType.some((b) => b.count > 0);

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Real activity from your DeviceLab database — never fabricated scores."
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Sessions", value: sessionCount, icon: Activity },
          { label: "Projects", value: projectCount, icon: FolderKanban },
          { label: "Reports", value: reportCount, icon: FileText },
          { label: "Screenshots", value: screenshotCount, icon: Camera },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>{item.label}</CardDescription>
              <item.icon className="h-4 w-4 text-[var(--muted-foreground)]" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-semibold tabular-nums">{item.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href} className="group">
            <Card className="h-full transition-colors group-hover:border-[var(--ring)]">
              <CardHeader>
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--secondary)]">
                  <action.icon className="h-4 w-4" />
                </div>
                <CardTitle>{action.title}</CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sessions by type</CardTitle>
            <CardDescription>
              {hasTests
                ? "Counts from stored TestSession records"
                : "Chart structure only — no tests recorded yet"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : !hasTests ? (
              <EmptyState title="No tests yet" description="Run a responsive, audit, or browser test to populate this chart." />
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="type" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <RechartsTooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="count" fill="var(--foreground)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              Latest sessions from the database
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : recent.length === 0 ? (
              <EmptyState title="No tests yet" description="Completed sessions will appear here." />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {recent.slice(0, 8).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.type}</p>
                      <p className="truncate text-[var(--muted-foreground)]">{s.target}</p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-[var(--muted-foreground)]">
                      <p>{s.status}</p>
                      <p>{formatDate(s.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
