"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { downloadBlob, formatDate } from "@/lib/utils";
import { exportReportCsv, exportReportPdf, type ReportPayload } from "@/lib/reports/export";

type Report = {
  id: string;
  title: string;
  type: string;
  format?: string;
  data?: string;
  createdAt: string;
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("manual");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<Report[] | { reports: Report[] }>("/api/reports");
    if (!res.ok) {
      setError(res.error);
      setReports([]);
    } else {
      setError(null);
      setReports(Array.isArray(res.data) ? res.data : res.data.reports ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSample() {
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    setSaving(true);
    const payload = {
      title,
      type,
      data: {
        savedAt: new Date().toISOString(),
        note: "Manual report snapshot from DeviceLab UI",
      },
    };
    const res = await apiFetch<Report>("/api/reports", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Report saved");
    setTitle("");
    await load();
  }

  async function exportJson(report: Report) {
    let data = report.data;
    if (!data) {
      const res = await apiFetch<Report>(`/api/reports/${report.id}`);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      data = res.data.data;
    }
    let parsed: unknown = data;
    if (typeof data === "string") {
      try {
        parsed = JSON.parse(data);
      } catch {
        parsed = { raw: data };
      }
    }
    const base = report.title.replace(/\s+/g, "-").toLowerCase() || "report";
    downloadBlob(
      new Blob([JSON.stringify({ ...report, data: parsed }, null, 2)], {
        type: "application/json",
      }),
      `${base}.json`
    );

    const payload: ReportPayload = {
      title: report.title,
      type: report.type,
      createdAt: report.createdAt,
      summary: typeof parsed === "object" && parsed ? (parsed as Record<string, unknown>) : undefined,
      checks: Array.isArray((parsed as { checks?: unknown })?.checks)
        ? ((parsed as { checks: ReportPayload["checks"] }).checks)
        : undefined,
    };
    downloadBlob(exportReportCsv(payload), `${base}.csv`);
    downloadBlob(exportReportPdf(payload), `${base}.pdf`);
    toast.success("Exported JSON, CSV, and PDF");
  }

  return (
    <div>
      <PageHeader
        title="Saved Reports"
        description="List and export stored reports as JSON."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Save report</CardTitle>
          <CardDescription>POST /api/reports with title, type, and data.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Report title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="sm:max-w-[160px]"
          />
          <Button onClick={saveSample} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : reports.length === 0 ? (
        <EmptyState title="No saved reports" description="Save a report or run an audit that persists one." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-[var(--border)]">
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {r.type} · {formatDate(r.createdAt)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void exportJson(r)}>
                    <Download className="h-4 w-4" />
                    Export JSON
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
