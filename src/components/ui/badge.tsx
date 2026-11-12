import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "danger" | "outline" | "info";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variant === "default" && "bg-[var(--secondary)] text-[var(--secondary-foreground)]",
        variant === "success" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        variant === "warning" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        variant === "danger" && "bg-red-500/15 text-red-600 dark:text-red-400",
        variant === "info" && "bg-sky-500/15 text-sky-700 dark:text-sky-400",
        variant === "outline" && "border border-[var(--border)] text-[var(--foreground)]",
        className
      )}
      {...props}
    />
  );
}
