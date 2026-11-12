"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, Gauge, History, Mail, Play, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";

type StatsData = {
  counts?: {
    sessions?: number;
    screenshots?: number;
  };
  recentSessions?: Array<{
    id: string;
    type: string;
    target: string;
    status: string;
    createdAt: string;
  }>;
  unavailable?: boolean;
  message?: string;
};

const ACTIONS = [
  {
    title: "Test Website",
    href: "/testing/responsive",
    description: "See your site on phone, tablet and desktop at once.",
    icon: Smartphone,
  },
  {
    title: "Test Email",
    href: "/email/tester",
    description: "Paste email HTML, preview it safely and find problems.",
    icon: Mail,
  },
  {
    title: "Run Audit",
    href: "/audits",
    description: "Check speed, accessibility and SEO for any public URL.",
    icon: Gauge,
  },
  {
    title: "Take Screenshot",
    href: "/visual/screenshots",
    description: "Capture a real browser screenshot or compare two images.",
    icon: Camera,
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [quickUrl, setQuickUrl] = useState("");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await apiFetch<StatsData>("/api/stats");
        if (!alive) return;
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setError(null);
        setStats(res.data);
      } catch {
        if (alive) setError("Could not load activity");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const recent = stats?.recentSessions ?? [];
  const sessionCount = stats?.counts?.sessions ?? 0;
  const screenshotCount = stats?.counts?.screenshots ?? 0;

  function quickTest(e: React.FormEvent) {
    e.preventDefault();
    const value = quickUrl.trim();
    const target = value
      ? `/testing/responsive?url=${encodeURIComponent(value)}`
      : "/testing/responsive";
    router.push(target);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="What do you want to test?"
        description="Pick one of the options below. Every result comes from a real check — nothing is made up."
      />

      <Card className="mb-6">
        <CardContent className="p-5">
          <form onSubmit={quickTest} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={quickUrl}
              onChange={(e) => setQuickUrl(e.target.value)}
              placeholder="Paste a website, e.g. example.com"
              aria-label="Website URL"
              className="h-11 flex-1 text-base"
            />
            <Button type="submit" size="lg" className="h-11">
              <Play className="h-4 w-4" />
              Test website
            </Button>
          </form>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            Fastest way to start: paste a URL and we&apos;ll open it on popular devices.
          </p>
        </CardContent>
      </Card>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        {ACTIONS.map((action) => (
          <Link key={action.href} href={action.href} className="group">
            <Card className="h-full transition-colors group-hover:border-[var(--ring)]">
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]">
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="flex items-center gap-1 text-base">
                    {action.title}
                    <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </CardTitle>
                  <CardDescription className="mt-1">{action.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              {!stats && !error
                ? "Checking saved tests…"
                : sessionCount > 0 || screenshotCount > 0
                  ? `${sessionCount} saved test${sessionCount === 1 ? "" : "s"} · ${screenshotCount} screenshot${screenshotCount === 1 ? "" : "s"}`
                  : "Nothing saved yet"}
            </CardDescription>
          </div>
          {recent.length > 0 ? (
            <Link href="/history">
              <Button variant="outline" size="sm">
                <History className="h-3.5 w-3.5" />
                View all
              </Button>
            </Link>
          ) : null}
        </CardHeader>
        <CardContent>
          {error || stats?.unavailable ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              {stats?.message ||
                "Activity history is temporarily unavailable. You can still run tests above."}
            </div>
          ) : !stats ? (
            <p className="text-sm text-[var(--muted-foreground)]">Checking saved tests…</p>
          ) : recent.length === 0 ? (
            <EmptyState
              title="No tests yet"
              description="Start with “Test Website” above. Responsive checks you run will show up here."
              action={
                <Link href="/testing/responsive">
                  <Button>
                    <Smartphone className="h-4 w-4" />
                    Test a website
                  </Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {recent.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.target}</p>
                    <p className="text-xs capitalize text-[var(--muted-foreground)]">
                      {s.type} check · {formatDate(s.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
