"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
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
  progress?: number;
  error?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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
        setSessions(Array.isArray(res.data) ? res.data : res.data.sessions ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = sessions.filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      s.type.toLowerCase().includes(q) ||
      s.target.toLowerCase().includes(q) ||
      s.status.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageHeader
        title="Test History"
        description="Full session history from /api/sessions."
      />

      <div className="mb-4">
        <Input
          placeholder="Filter by type, target, or status…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No history yet" description="Completed and failed sessions appear here." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Target</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-5 py-3 font-medium">{s.type}</td>
                    <td className="max-w-[320px] truncate px-5 py-3 text-[var(--muted-foreground)]">
                      {s.target}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-5 py-3 text-[var(--muted-foreground)]">
                      {formatDate(s.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
