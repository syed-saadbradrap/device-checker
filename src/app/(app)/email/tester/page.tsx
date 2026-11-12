"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Loader2, Moon, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EMAIL_CLIENT_PROFILES } from "@/lib/email/sanitize";
import { apiFetch } from "@/lib/api/client";
import { downloadBlob } from "@/lib/utils";

type EmailIssue = {
  id: string;
  severity: string;
  category: string;
  message: string;
  suggestion?: string;
};

type EmailAnalysis = {
  issues: EmailIssue[];
  stats: {
    imageCount: number;
    linkCount: number;
    tableCount: number;
    hasDoctype: boolean;
    hasViewportMeta: boolean;
    approxHtmlBytes: number;
    maxWidthHint: number | null;
  };
  unsupportedCss: string[];
  simulatedNote: string;
};

type AnalyzeResponse = {
  sanitizedHtml: string;
  analysis: EmailAnalysis;
};

type View = "preview" | "issues" | "widths";

const WIDTHS = [320, 375, 600, 680] as const;

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Welcome</title>
</head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:24px">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px">
          <tr>
            <td style="padding:32px">
              <h1 style="margin:0 0 12px;font-size:24px;color:#111">Welcome aboard!</h1>
              <p style="margin:0 0 20px;font-size:16px;line-height:24px;color:#444">
                Thanks for signing up. Click the button below to confirm your email.
              </p>
              <a href="https://example.com/confirm" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Confirm email</a>
              <p style="margin:24px 0 0;font-size:12px;color:#888;display:flex">You received this because you signed up at example.com.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export default function EmailTesterPage() {
  const [html, setHtml] = useState("");
  const [sanitized, setSanitized] = useState("");
  const [analysis, setAnalysis] = useState<EmailAnalysis | null>(null);
  const [profileId, setProfileId] = useState<string>(EMAIL_CLIENT_PROFILES[0].id);
  const [darkPreview, setDarkPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("preview");

  const profile = EMAIL_CLIENT_PROFILES.find((p) => p.id === profileId) ?? EMAIL_CLIENT_PROFILES[0];

  const body = sanitized || html;
  const previewHtml = useMemo(() => {
    if (!body) return "";
    if (!darkPreview) return body;
    return `<div style="background:#111;color:#f5f5f5;min-height:100%;padding:8px">${body}</div>`;
  }, [body, darkPreview]);

  function updateHtml(next: string) {
    setHtml(next);
    setSanitized("");
    setAnalysis(null);
    setError(null);
  }

  async function analyze() {
    if (!html.trim()) {
      toast.error("Paste or upload HTML first");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await apiFetch<AnalyzeResponse>("/api/email/analyze", {
      method: "POST",
      body: JSON.stringify({ html }),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    setSanitized(res.data.sanitizedHtml || html);
    setAnalysis(res.data.analysis);
    setView("issues");
    const count = res.data.analysis.issues.length;
    toast.success(count ? `Found ${count} thing${count === 1 ? "" : "s"} to review` : "No issues found");
  }

  function onUpload(file: File | null) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large (max 2MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateHtml(String(reader.result || ""));
    reader.onerror = () => toast.error("Could not read file");
    reader.readAsText(file);
  }

  function downloadHtml() {
    if (!body) return;
    downloadBlob(new Blob([body], { type: "text/html;charset=utf-8" }), "email-preview.html");
  }

  const issueCount = analysis?.issues.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Test Email"
        description="Paste your email HTML, then press Check email. Preview runs safely with scripts turned off."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>1. Your email HTML</CardTitle>
            <CardDescription>Paste code, upload an .html file, or try the sample.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={html}
              onChange={(e) => updateHtml(e.target.value)}
              placeholder="<!DOCTYPE html>..."
              className="min-h-[320px] font-mono text-xs"
              aria-label="Email HTML"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={analyze} disabled={loading || !html.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Check email
              </Button>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm hover:bg-[var(--accent)]">
                <Upload className="h-4 w-4" />
                Upload
                <input
                  type="file"
                  accept=".html,.htm,text/html"
                  className="hidden"
                  onChange={(e) => {
                    onUpload(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>
              {!html ? (
                <Button variant="outline" onClick={() => updateHtml(SAMPLE_HTML)}>
                  <FileText className="h-4 w-4" />
                  Load sample
                </Button>
              ) : (
                <Button variant="outline" onClick={downloadHtml}>
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              )}
            </div>
            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="space-y-3">
            <CardTitle>2. Results</CardTitle>
            <Tabs
              value={view}
              onChange={setView}
              tabs={[
                { id: "preview", label: "Preview" },
                {
                  id: "issues",
                  label: "Issues",
                  badge: analysis ? (
                    <Badge variant={issueCount ? "warning" : "success"}>{issueCount}</Badge>
                  ) : undefined,
                },
                { id: "widths", label: "Client widths" },
              ]}
            />
          </CardHeader>
          <CardContent>
            {!body ? (
              <EmptyState
                title="Nothing to show yet"
                description="Paste email HTML on the left (or click “Load sample”) to see a preview here."
              />
            ) : view === "preview" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={profileId}
                    onChange={(e) => setProfileId(e.target.value)}
                    className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
                    aria-label="Email client width"
                  >
                    {EMAIL_CLIENT_PROFILES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.width}px
                      </option>
                    ))}
                  </select>
                  <Button
                    variant={darkPreview ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDarkPreview((v) => !v)}
                  >
                    <Moon className="h-3.5 w-3.5" />
                    Dark background
                  </Button>
                  <Badge variant="warning">Simulated width</Badge>
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Shows your email at {profile.name}&apos;s typical width. It is not the real{" "}
                  {profile.name} rendering engine.
                  {sanitized ? " Showing the cleaned (sanitized) HTML." : ""}
                </p>
                <div className="overflow-auto rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-3">
                  <iframe
                    title="Email preview"
                    srcDoc={previewHtml}
                    sandbox="allow-same-origin"
                    className="mx-auto block bg-white"
                    style={{ width: profile.width, height: Math.min(profile.height, 720), maxWidth: "100%" }}
                  />
                </div>
              </div>
            ) : view === "issues" ? (
              !analysis ? (
                <EmptyState
                  title="Not checked yet"
                  description="Press “Check email” on the left to scan for layout, image, link and CSS problems."
                  action={
                    <Button onClick={analyze} disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Check email
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{analysis.stats.imageCount} images</Badge>
                    <Badge variant="outline">{analysis.stats.linkCount} links</Badge>
                    <Badge variant="outline">{analysis.stats.tableCount} tables</Badge>
                    <Badge variant="outline">
                      {(analysis.stats.approxHtmlBytes / 1024).toFixed(1)} KB
                    </Badge>
                  </div>
                  {analysis.unsupportedCss.length ? (
                    <div>
                      <p className="mb-2 text-sm font-medium">CSS some email apps ignore</p>
                      <div className="flex flex-wrap gap-1">
                        {analysis.unsupportedCss.map((c) => (
                          <Badge key={c} variant="outline">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {analysis.issues.length === 0 ? (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      No issues found by our checks.
                    </p>
                  ) : (
                    <ul className="divide-y divide-[var(--border)]">
                      {analysis.issues.map((issue) => (
                        <li key={issue.id} className="py-3">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <StatusBadge status={issue.severity} />
                            <span className="text-xs text-[var(--muted-foreground)]">
                              {issue.category}
                            </span>
                          </div>
                          <p className="text-sm">{issue.message}</p>
                          {issue.suggestion ? (
                            <p className="text-xs text-[var(--muted-foreground)]">
                              Tip: {issue.suggestion}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-[var(--muted-foreground)]">{analysis.simulatedNote}</p>
                </div>
              )
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[var(--muted-foreground)]">
                  Your email side by side at common widths. These are{" "}
                  <strong>simulated widths</strong>, not real Gmail/Outlook/Apple Mail engines.
                </p>
                <div className="overflow-x-auto">
                  <div className="flex min-w-max gap-4 pb-2">
                    {WIDTHS.map((width) => {
                      const names = EMAIL_CLIENT_PROFILES.filter((p) => p.width === width)
                        .map((p) => p.name)
                        .join(", ");
                      return (
                        <div
                          key={width}
                          className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-2"
                        >
                          <p className="mb-2 text-xs font-medium">
                            {width}px{names ? ` · ${names}` : ""}
                          </p>
                          <iframe
                            title={`Email at ${width}px`}
                            srcDoc={previewHtml}
                            sandbox="allow-same-origin"
                            className="block bg-white"
                            style={{ width, height: 560 }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
