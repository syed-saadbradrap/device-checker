"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, Loader2, Play, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { filterDevices, type DeviceCategory } from "@/lib/devices/presets";
import { apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type CustomDevice = {
  id: string;
  name: string;
  brand: string;
  category: string;
  width: number;
  height: number;
  dpr: number;
  notes?: string | null;
};

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "phone", label: "Phones" },
  { id: "tablet", label: "Tablets" },
  { id: "foldable", label: "Foldables" },
  { id: "laptop", label: "Laptops" },
  { id: "desktop", label: "Desktops" },
];

function testHref(deviceId: string) {
  return `/testing/responsive?device=${encodeURIComponent(deviceId)}`;
}

export default function DevicesLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = use(searchParams);
  const [query, setQuery] = useState(typeof params.q === "string" ? params.q : "");
  const [category, setCategory] = useState("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [custom, setCustom] = useState<CustomDevice[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "phone" as DeviceCategory,
    width: 390,
    height: 844,
    dpr: 3,
  });

  const loadExtras = useCallback(async () => {
    const [favRes, customRes] = await Promise.all([
      apiFetch<{ favorites: Array<{ deviceId: string }> }>("/api/devices/favorites"),
      apiFetch<CustomDevice[]>("/api/devices/custom"),
    ]);
    if (favRes.ok) setFavorites(favRes.data.favorites.map((f) => f.deviceId));
    if (customRes.ok) setCustom(customRes.data);
  }, []);

  useEffect(() => {
    void loadExtras();
  }, [loadExtras]);

  const presets = useMemo(() => filterDevices({ query, category }), [query, category]);
  const visiblePresets = showFavoritesOnly
    ? presets.filter((d) => favorites.includes(d.id))
    : presets;

  async function toggleFavorite(deviceId: string) {
    const isFav = favorites.includes(deviceId);
    const res = await apiFetch<unknown>("/api/devices/favorites", {
      method: isFav ? "DELETE" : "POST",
      body: JSON.stringify({ deviceId }),
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setFavorites((prev) => (isFav ? prev.filter((id) => id !== deviceId) : [...prev, deviceId]));
    toast.success(isFav ? "Removed from favorites" : "Added to favorites");
  }

  async function createCustom() {
    if (!form.name.trim()) {
      toast.error("Give your device a name");
      return;
    }
    if (form.width < 200 || form.height < 200 || form.width > 3840 || form.height > 3840) {
      toast.error("Size must be between 200 and 3840 pixels");
      return;
    }
    setSaving(true);
    const res = await apiFetch<CustomDevice>("/api/devices/custom", {
      method: "POST",
      body: JSON.stringify({ ...form, brand: "Custom" }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Custom device saved");
    setForm((f) => ({ ...f, name: "" }));
    await loadExtras();
  }

  async function deleteCustom(id: string) {
    const res = await apiFetch<unknown>(`/api/devices/custom?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Custom device deleted");
    await loadExtras();
  }

  return (
    <div>
      <PageHeader
        title="Devices"
        description="Find a phone, tablet or computer screen size, then click “Test” to open your site on it."
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            placeholder="Search: iPhone 16, Galaxy, iPad…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            aria-label="Search devices"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={category === c.id ? "default" : "outline"}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </Button>
          ))}
          <Button
            variant={showFavoritesOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFavoritesOnly((v) => !v)}
          >
            <Heart className="h-3.5 w-3.5" />
            Favorites
          </Button>
        </div>
      </div>

      {custom.length > 0 ? (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-medium text-[var(--muted-foreground)]">Your custom devices</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {custom.map((d) => (
              <div key={d.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="font-medium">{d.name}</p>
                  <button
                    type="button"
                    aria-label="Delete custom device"
                    onClick={() => void deleteCustom(d.id)}
                    className="rounded-md p-1 hover:bg-[var(--accent)]"
                  >
                    <Trash2 className="h-4 w-4 text-[var(--muted-foreground)]" />
                  </button>
                </div>
                <p className="text-sm tabular-nums text-[var(--muted-foreground)]">
                  {d.width}×{d.height} · {d.category}
                </p>
                <Link href={testHref(`custom:${d.width}:${d.height}`)}>
                  <Button size="sm" className="mt-3 w-full">
                    <Play className="h-3.5 w-3.5" />
                    Test on this device
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {visiblePresets.length === 0 ? (
        <EmptyState
          title="No devices match"
          description={
            showFavoritesOnly
              ? "You haven't favorited any devices here yet. Turn off “Favorites” to see all."
              : "Try a shorter search like “iPhone” or pick “All”."
          }
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setCategory("all");
                setShowFavoritesOnly(false);
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visiblePresets.map((d) => {
            const fav = favorites.includes(d.id);
            return (
              <div
                key={d.id}
                className={cn(
                  "flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-4",
                  fav && "border-[var(--foreground)]/40"
                )}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="font-medium">{d.name}</p>
                  <button
                    type="button"
                    aria-label={fav ? "Remove from favorites" : "Add to favorites"}
                    onClick={() => void toggleFavorite(d.id)}
                    className="rounded-md p-1 hover:bg-[var(--accent)]"
                  >
                    <Heart
                      className={cn(
                        "h-4 w-4",
                        fav ? "fill-red-500 text-red-500" : "text-[var(--muted-foreground)]"
                      )}
                    />
                  </button>
                </div>
                <p className="text-sm tabular-nums text-[var(--muted-foreground)]">
                  {d.width}×{d.height} · <span className="capitalize">{d.category}</span>
                </p>
                {d.estimated ? (
                  <Badge variant="warning" className="mt-2 w-fit">
                    Estimated size
                  </Badge>
                ) : null}
                <Link href={testHref(d.id)} className="mt-auto pt-3">
                  <Button size="sm" variant="outline" className="w-full">
                    <Play className="h-3.5 w-3.5" />
                    Test on this device
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <details className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium">
          Can&apos;t find your device? Add a custom screen size
        </summary>
        <Card className="border-0 shadow-none">
          <CardHeader className="pt-0">
            <CardTitle className="text-sm">New custom device</CardTitle>
            <CardDescription>Width and height are in CSS pixels (what the browser reports).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              Name
              <Input
                placeholder="My phone"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-48"
              />
            </label>
            <label className="text-xs">
              Type
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as DeviceCategory }))}
                className="mt-1 block h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
              >
                <option value="phone">Phone</option>
                <option value="tablet">Tablet</option>
                <option value="laptop">Laptop</option>
                <option value="desktop">Desktop</option>
                <option value="foldable">Foldable</option>
              </select>
            </label>
            <label className="text-xs">
              Width
              <Input
                type="number"
                value={form.width}
                onChange={(e) => setForm((f) => ({ ...f, width: Number(e.target.value) }))}
                className="mt-1 w-24"
              />
            </label>
            <label className="text-xs">
              Height
              <Input
                type="number"
                value={form.height}
                onChange={(e) => setForm((f) => ({ ...f, height: Number(e.target.value) }))}
                className="mt-1 w-24"
              />
            </label>
            <Button onClick={createCustom} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Save device
            </Button>
          </CardContent>
        </Card>
      </details>
    </div>
  );
}
