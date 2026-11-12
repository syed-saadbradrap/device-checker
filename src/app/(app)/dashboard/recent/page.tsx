"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";

type Session = {
  id: string;
  type: string;
  target: string;
  status: string;
  progress?: number;
  createdAt: string;
  completedAt?: string | null;
  error?: string | null;
};

export default function RecentSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await apiFetch<Session[] | { sessions: Session[] }>("/api/sessions");
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setSessions([]);
      } else {
        setError(null);
        const data = res.data;
        setSessions(Array.isArray(data) ? data : data.sessions ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Recent Tests"
        description="Latest TestSession records from /api/sessions."
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No tests yet"
          description="Run a test from Website Testing or Audits to see sessions here."
          action={
            <Link
              href="/testing/responsive"
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              Open Responsive Tester
            </Link>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-[var(--border)]">
              {sessions.map((s) => (
                <li key={s.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="font-medium">{s.type}</p>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="truncate text-sm text-[var(--muted-foreground)]">
                      {s.target}
                    </p>
                    {s.error ? (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{s.error}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-xs text-[var(--muted-foreground)] sm:text-right">
                    <p>{formatDate(s.createdAt)}</p>
                    {typeof s.progress === "number" ? <p>{s.progress}% progress</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
