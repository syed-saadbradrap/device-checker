"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";

type Session = {
  id: string;
  type: string;
  target: string;
  status: string;
  error?: string | null;
  createdAt: string;
};

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<Session[] | { sessions: Session[] }>("/api/sessions");
        if (!alive) return;
        if (!res.ok) {
          setError(res.error);
          setSessions([]);
        } else {
          setError(null);
          const list = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data.sessions)
              ? res.data.sessions
              : [];
          setSessions(list);
        }
      } catch {
        if (alive) {
          setError("Could not load history");
          setSessions([]);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? sessions.filter(
        (s) =>
          s.type.toLowerCase().includes(q) ||
          s.target.toLowerCase().includes(q) ||
          s.status.toLowerCase().includes(q)
      )
    : sessions;

  return (
    <div>
      <PageHeader
        title="History"
        description="Your last 50 saved layout checks (from “Check layout” on Test Website)."
      />

      {sessions.length > 0 ? (
        <div className="mb-4">
          <Input
            placeholder="Filter by website or status…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-md"
          />
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t load history: {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="No saved tests yet"
          description="Open Test Website, launch a URL, then press “Check layout”. Each check is saved here."
          action={
            <Link href="/testing/responsive">
              <Button>
                <Play className="h-4 w-4" />
                Test a website
              </Button>
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" description="Try a different filter." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-[var(--border)]">
              {filtered.map((s) => (
                <li key={s.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.target}</p>
                    <p className="text-xs capitalize text-[var(--muted-foreground)]">
                      {s.type} check · {formatDate(s.createdAt)}
                    </p>
                    {s.error ? (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{s.error}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={s.status} />
                    <Link href={`/testing/responsive?url=${encodeURIComponent(s.target)}`}>
                      <Button size="sm" variant="outline">
                        Test again
                      </Button>
                    </Link>
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
