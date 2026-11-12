import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ReportPayload = {
  title: string;
  url?: string;
  type: string;
  createdAt?: string;
  summary?: Record<string, unknown>;
  checks?: Array<{
    status?: string;
    category?: string;
    message?: string;
    suggestion?: string;
  }>;
  notes?: string[];
};

export function exportReportJson(payload: ReportPayload) {
  return new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
}

export function exportReportCsv(payload: ReportPayload) {
  const rows = [["status", "category", "message", "suggestion"]];
  for (const c of payload.checks || []) {
    rows.push([
      c.status || "",
      c.category || "",
      (c.message || "").replace(/"/g, '""'),
      (c.suggestion || "").replace(/"/g, '""'),
    ]);
  }
  const csv = rows.map((r) => r.map((cell) => `"${cell}"`).join(",")).join("\n");
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}

export function exportReportPdf(payload: ReportPayload) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(payload.title || "DeviceLab Report", 14, 18);
  doc.setFontSize(10);
  doc.text(`Type: ${payload.type}`, 14, 28);
  if (payload.url) doc.text(`URL: ${payload.url}`, 14, 34);
  if (payload.createdAt) doc.text(`Date: ${payload.createdAt}`, 14, 40);
  doc.text(
    "Only actual captured results are included. Simulated email clients are labeled in-app.",
    14,
    48
  );

  if (payload.checks?.length) {
    autoTable(doc, {
      startY: 56,
      head: [["Status", "Category", "Message"]],
      body: payload.checks.map((c) => [
        c.status || "",
        c.category || "",
        c.message || "",
      ]),
      styles: { fontSize: 8 },
    });
  }

  return doc.output("blob");
}
