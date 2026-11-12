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
import {
  DEFAULT_EMAIL_PROFILE_ID,
  EMAIL_CLIENT_PROFILES,
  LATEST_EMAIL_DEVICE_WIDTHS,
} from "@/lib/email/profiles";
import { buildEmailPreviewHtml, emailHasDarkModeCss } from "@/lib/email/preview";
import { cn } from "@/lib/utils";
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

const LATEST_PHONES = EMAIL_CLIENT_PROFILES.filter((p) => p.group === "latest-phone");
const EMAIL_APPS = EMAIL_CLIENT_PROFILES.filter((p) => p.group === "email-app");

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Welcome</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .bg-page { background:#0f0f10 !important; }
      .bg-card { background:#1f1f22 !important; }
      .text-title { color:#f4f4f5 !important; }
      .text-body { color:#d4d4d8 !important; }
      .text-muted { color:#a1a1aa !important; }
      .btn { background:#f4f4f5 !important; color:#111111 !important; }
      .link { color:#93c5fd !important; }
    }
  </style>
</head>
<body class="bg-page" style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg-page" style="background:#f4f4f5">
    <tr>
      <td align="center" style="padding:24px">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="bg-card" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px">
          <tr>
            <td style="padding:32px">
              <h1 class="text-title" style="margin:0 0 12px;font-size:24px;color:#111">Welcome aboard!</h1>
              <p class="text-body" style="margin:0 0 20px;font-size:16px;line-height:24px;color:#444">
                Thanks for signing up. Click the button below to confirm your email.
              </p>
              <a href="https://example.com/confirm" class="btn" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Confirm email</a>
              <p class="text-muted" style="margin:24px 0 0;font-size:12px;color:#888">
                You received this because you signed up at example.com.
                <a href="https://example.com/unsubscribe" class="link">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

function DarkPreviewToggle({
  on,
  hasDarkCss,
  onToggle,
}: {
  on: boolean;
  hasDarkCss: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <Button
        variant={on ? "default" : "outline"}
        size="sm"
        aria-pressed={on}
        onClick={onToggle}
        title={on ? "Switch back to a light email client" : "Simulate a dark-mode email client"}
      >
        <Moon className={cn("h-3.5 w-3.5", on && "fill-current")} />
        Dark preview: {on ? "On" : "Off"}
      </Button>
      {on ? (
        <Badge className="bg-zinc-900 text-zinc-100 ring-1 ring-zinc-700">Dark client</Badge>
      ) : null}
      {on && !hasDarkCss ? (
        <Badge variant="info">No dark-mode CSS in email</Badge>
      ) : null}
    </>
  );
}

function DarkPreviewNote({ on, hasDarkCss }: { on: boolean; hasDarkCss: boolean }) {
  if (!on) return null;
  return (
    <p className="text-xs text-[var(--muted-foreground)]">
      {hasDarkCss
        ? "Dark preview applies your email’s @media (prefers-color-scheme: dark) styles on a dark email-client background, regardless of your computer’s theme."
        : "This email has no @media (prefers-color-scheme: dark) styles, so it is shown as written on a dark email-client background. Real apps such as Gmail or Outlook may still recolor it automatically."}
    </p>
  );
}

export default function EmailTesterPage() {
  const [html, setHtml] = useState("");
  const [sanitized, setSanitized] = useState("");
  const [analysis, setAnalysis] = useState<EmailAnalysis | null>(null);
  const [profileId, setProfileId] = useState<string>(DEFAULT_EMAIL_PROFILE_ID);
  const [darkPreview, setDarkPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("preview");

  const profile =
    EMAIL_CLIENT_PROFILES.find((p) => p.id === profileId) ?? EMAIL_CLIENT_PROFILES[0];

  const sourceHtml = sanitized || html;
  const previewHtml = useMemo(
    () => buildEmailPreviewHtml(sourceHtml, darkPreview),
    [sourceHtml, darkPreview]
  );
  const hasDarkCss = useMemo(() => emailHasDarkModeCss(sourceHtml), [sourceHtml]);
  const toggleDark = () => setDarkPreview((v) => !v);
  const frameClass = darkPreview
    ? "border-zinc-800 bg-[#1a1a1a]"
    : "border-[var(--border)] bg-[#f4f4f5]";

  function updateHtml(next: string) {
    setHtml(next);
    setSanitized("");
    setAnalysis(null);
    setError(null);
  }

  async function analyze(nextView: View = "issues") {
    if (!html.trim()) {
      toast.error("Paste or upload HTML first");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<AnalyzeResponse>("/api/email/analyze", {
        method: "POST",
        body: JSON.stringify({ html }),
      });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setSanitized(res.data.sanitizedHtml || html);
      setAnalysis(res.data.analysis);
      setView(nextView);
      const count = res.data.analysis.issues.length;
      toast.success(
        count
          ? `Found ${count} thing${count === 1 ? "" : "s"} to review`
          : "No issues found"
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Email check failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function onUpload(file: File | null) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large (max 2MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateHtml(String(reader.result || ""));
      setView("preview");
      toast.success("HTML loaded — preview updated");
    };
    reader.onerror = () => toast.error("Could not read file");
    reader.readAsText(file);
  }

  function downloadHtml() {
    if (!sourceHtml) return;
    downloadBlob(
      new Blob([sourceHtml], { type: "text/html;charset=utf-8" }),
      "email-preview.html"
    );
  }

  function loadSample() {
    updateHtml(SAMPLE_HTML);
    setView("preview");
    toast.success("Sample loaded — preview is on the right");
  }

  const issueCount = analysis?.issues.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Test Email"
        description="Paste HTML → see live preview → press Check email for issues. Scripts are blocked."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>1. Your email HTML</CardTitle>
            <CardDescription>Paste code, upload a file, or load the sample.</CardDescription>
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
              <Button onClick={() => analyze("issues")} disabled={loading || !html.trim()}>
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
                <Button variant="outline" onClick={loadSample}>
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
            {!sourceHtml ? (
              <EmptyState
                title="Nothing to show yet"
                description="Paste email HTML on the left, or click “Load sample”, to see a live preview."
                action={
                  <Button variant="outline" onClick={loadSample}>
                    <FileText className="h-4 w-4" />
                    Load sample
                  </Button>
                }
              />
            ) : view === "preview" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={profileId}
                    onChange={(e) => setProfileId(e.target.value)}
                    className="h-9 max-w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
                    aria-label="Device or email client width"
                  >
                    <optgroup label="Latest phones (2026)">
                      {LATEST_PHONES.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.width}×{p.height}
                          {p.estimated ? " *" : ""}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Email apps">
                      {EMAIL_APPS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.width}px
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <DarkPreviewToggle on={darkPreview} hasDarkCss={hasDarkCss} onToggle={toggleDark} />
                  <Badge variant="warning">Simulated width</Badge>
                  {sanitized ? <Badge variant="success">Sanitized</Badge> : null}
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Showing <strong>{profile.name}</strong> at {profile.width}×{profile.height} px
                  {profile.estimated ? " (estimated)" : ""}. This is a simulated screen width, not
                  the real Apple Mail or Gmail rendering engine. Scripts are disabled.
                  {profile.group === "latest-phone"
                    ? " Default is the latest iPhone Pro."
                    : ""}
                </p>
                <DarkPreviewNote on={darkPreview} hasDarkCss={hasDarkCss} />
                <div
                  className={cn(
                    "overflow-auto rounded-lg border p-3 transition-colors",
                    frameClass
                  )}
                >
                  <iframe
                    key={`${profileId}-${darkPreview}-${sourceHtml.length}`}
                    title="Email preview"
                    srcDoc={previewHtml}
                    sandbox=""
                    className="mx-auto block rounded-md shadow-sm"
                    style={{
                      width: profile.width,
                      height: Math.min(profile.height, 720),
                      maxWidth: "100%",
                      border: 0,
                    }}
                  />
                </div>
              </div>
            ) : view === "issues" ? (
              !analysis ? (
                <EmptyState
                  title="Not checked yet"
                  description="Press “Check email” to scan for layout, image, link and CSS problems."
                  action={
                    <Button onClick={() => analyze("issues")} disabled={loading || !html.trim()}>
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
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setView("preview")}>
                      Back to preview
                    </Button>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">{analysis.simulatedNote}</p>
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <DarkPreviewToggle on={darkPreview} hasDarkCss={hasDarkCss} onToggle={toggleDark} />
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Side by side at the latest phone and inbox widths. These are simulated screen
                  widths, not the real Gmail, Outlook or Apple Mail rendering engines.
                </p>
                <DarkPreviewNote on={darkPreview} hasDarkCss={hasDarkCss} />
                <div className="overflow-x-auto">
                  <div className="flex min-w-max gap-4 pb-2">
                    {LATEST_EMAIL_DEVICE_WIDTHS.map(({ width, label }) => (
                      <div
                        key={width}
                        className={cn("rounded-xl border p-2 transition-colors", frameClass)}
                      >
                        <p
                          className={cn(
                            "mb-2 text-xs font-medium",
                            darkPreview ? "text-zinc-300" : "text-zinc-700"
                          )}
                        >
                          {width}px · {label}
                        </p>
                        <iframe
                          key={`w-${width}-${darkPreview}-${sourceHtml.length}`}
                          title={`Email at ${width}px`}
                          srcDoc={previewHtml}
                          sandbox=""
                          className="block rounded-md"
                          style={{ width, height: 560, border: 0 }}
                        />
                      </div>
                    ))}
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
