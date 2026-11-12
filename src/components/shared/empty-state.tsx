import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title = "No data yet",
  description,
  icon: Icon = Inbox,
  action,
  className,
}: {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--secondary)]">
        <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
      </div>
      <p className="text-sm font-medium text-[var(--foreground)]">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
