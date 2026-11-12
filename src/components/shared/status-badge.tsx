import { Badge } from "@/components/ui/badge";

const VARIANT_MAP: Record<
  string,
  "default" | "success" | "warning" | "danger" | "outline" | "info"
> = {
  pass: "success",
  passed: "success",
  success: "success",
  completed: "success",
  fail: "danger",
  failed: "danger",
  error: "danger",
  critical: "danger",
  serious: "danger",
  warning: "warning",
  moderate: "warning",
  pending: "info",
  queued: "info",
  running: "info",
  info: "info",
  minor: "outline",
  cancelled: "outline",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const key = status.toLowerCase();
  const variant = VARIANT_MAP[key] ?? "outline";
  return (
    <Badge variant={variant} className={className}>
      {status}
    </Badge>
  );
}
