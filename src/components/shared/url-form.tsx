"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function UrlForm({
  onSubmit,
  loading,
  placeholder = "example.com",
  submitLabel = "Run",
  defaultValue = "",
  className,
  disabled,
  secondaryLabel,
  onSecondary,
}: {
  onSubmit: (url: string) => void | Promise<void>;
  loading?: boolean;
  placeholder?: string;
  submitLabel?: string;
  defaultValue?: string;
  className?: string;
  disabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: (url: string) => void | Promise<void>;
}) {
  const [url, setUrl] = useState(defaultValue);
  const busy = loading || disabled;

  return (
    <form
      className={cn("flex flex-col gap-2 sm:flex-row", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const normalized = normalizeUrl(url);
        if (!normalized) return;
        void onSubmit(normalized);
      }}
    >
      <Input
        type="text"
        inputMode="url"
        autoComplete="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={placeholder}
        disabled={busy}
        className="flex-1"
        aria-label="Website URL"
      />
      <Button type="submit" disabled={busy || !url.trim()}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitLabel}
      </Button>
      {secondaryLabel && onSecondary ? (
        <Button
          type="button"
          variant="outline"
          disabled={busy || !url.trim()}
          onClick={() => {
            const normalized = normalizeUrl(url);
            if (normalized) void onSecondary(normalized);
          }}
        >
          {secondaryLabel}
        </Button>
      ) : null}
    </form>
  );
}
