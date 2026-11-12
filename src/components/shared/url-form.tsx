"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function UrlForm({
  onSubmit,
  loading,
  placeholder = "https://example.com",
  submitLabel = "Run",
  defaultValue = "",
  className,
  disabled,
}: {
  onSubmit: (url: string) => void | Promise<void>;
  loading?: boolean;
  placeholder?: string;
  submitLabel?: string;
  defaultValue?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [url, setUrl] = useState(defaultValue);

  return (
    <form
      className={cn("flex flex-col gap-2 sm:flex-row", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = url.trim();
        if (!trimmed) return;
        void onSubmit(trimmed);
      }}
    >
      <Input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={placeholder}
        disabled={loading || disabled}
        className="flex-1"
        required
      />
      <Button type="submit" disabled={loading || disabled || !url.trim()}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitLabel}
      </Button>
    </form>
  );
}
