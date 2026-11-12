"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

export default function DevicesLibraryPage() {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("all");
  const [category, setCategory] = useState("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [custom, setCustom] = useState<CustomDevice[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    brand: "Custom",
    category: "phone" as DeviceCategory,
    width: 390,
    height: 844,
    dpr: 3,
    notes: "",
  });

  const loadExtras = useCallback(async () => {
    const [favRes, customRes] = await Promise.all([
      apiFetch<{ favorites: Array<{ deviceId: string }> }>("/api/devices/favorites"),
      apiFetch<CustomDevice[]>("/api/devices/custom"),
    ]);
    if (favRes.ok) {
      setFavorites(favRes.data.favorites.map((f) => f.deviceId));
    }
    if (customRes.ok) {
      setCustom(customRes.data);
    }
  }, []);

  useEffect(() => {
    void loadExtras();
  }, [loadExtras]);

  const presets = useMemo(
    () => filterDevices({ query, brand, category }),
    [query, brand, category]
  );

  const visiblePresets = showFavoritesOnly
    ? presets.filter((d) => favorites.includes(d.id))
    : presets;

  async function toggleFavorite(deviceId: string) {
    const isFav = favorites.includes(deviceId);
    if (isFav) {
      const res = await apiFetch<unknown>("/api/devices/favorites", {
        method: "DELETE",
        body: JSON.stringify({ deviceId }),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setFavorites((prev) => prev.filter((id) => id !== deviceId));
      toast.success("Removed from favorites");
    } else {
      const res = await apiFetch<unknown>("/api/devices/favorites", {
        method: "POST",
        body: JSON.stringify({ deviceId }),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setFavorites((prev) => [...prev, deviceId]);
      toast.success("Added to favorites");
    }
  }

  async function createCustom() {
    if (!form.name.trim()) {
      toast.error("Name required");
      return;
    }
    setSaving(true);
    const res = await apiFetch<CustomDevice>("/api/devices/custom", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Custom device created");
    setForm((f) => ({ ...f, name: "", notes: "" }));
    await loadExtras();
  }

  async function deleteCustom(id: string) {
    const res = await apiFetch<unknown>(
      `/api/devices/custom?id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
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
        title="Device Presets"
        description="Search the full library, star favorites, and create custom devices."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create custom device</CardTitle>
          <CardDescription>POST /api/devices/custom</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            placeholder="Brand"
            value={form.brand}
            onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
          />
          <select
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value as DeviceCategory }))
            }
            className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
          >
            <option value="phone">Phone</option>
            <option value="tablet">Tablet</option>
            <option value="laptop">Laptop</option>
            <option value="desktop">Desktop</option>
            <option value="foldable">Foldable</option>
          </select>
          <Input
            type="number"
            placeholder="Width"
            value={form.width}
            onChange={(e) => setForm((f) => ({ ...f, width: Number(e.target.value) }))}
          />
          <Input
            type="number"
            placeholder="Height"
            value={form.height}
            onChange={(e) => setForm((f) => ({ ...f, height: Number(e.target.value) }))}
          />
          <Input
            type="number"
            step="0.1"
            placeholder="DPR"
            value={form.dpr}
            onChange={(e) => setForm((f) => ({ ...f, dpr: Number(e.target.value) }))}
          />
          <Textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="min-h-[72px] sm:col-span-2 lg:col-span-3"
          />
          <Button onClick={createCustom} disabled={saving} className="sm:col-span-2 lg:col-span-3 sm:w-fit">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create device
          </Button>
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs"
        />
        <select
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
        >
          <option value="all">All brands</option>
          <option value="Apple">Apple</option>
          <option value="Samsung">Samsung</option>
          <option value="Google">Google</option>
          <option value="OnePlus">OnePlus</option>
          <option value="Xiaomi">Xiaomi</option>
          <option value="Generic">Generic</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
        >
          <option value="all">All categories</option>
          <option value="phone">Phone</option>
          <option value="tablet">Tablet</option>
          <option value="laptop">Laptop</option>
          <option value="desktop">Desktop</option>
          <option value="foldable">Foldable</option>
        </select>
        <Button
          variant={showFavoritesOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFavoritesOnly((v) => !v)}
        >
          <Heart className="h-3.5 w-3.5" />
          Favorites
        </Button>
      </div>

      {custom.length > 0 ? (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-medium text-[var(--muted-foreground)]">Custom devices</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {custom.map((d) => (
              <Card key={d.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle>{d.name}</CardTitle>
                      <CardDescription>
                        {d.brand} · {d.category}
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => void deleteCustom(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm tabular-nums">
                    {d.width}×{d.height} @ {d.dpr}x
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {visiblePresets.length === 0 ? (
        <EmptyState title="No devices match" description="Try a different filter or clear favorites-only." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visiblePresets.map((d) => {
            const fav = favorites.includes(d.id);
            return (
              <div
                key={d.id}
                className={cn(
                  "rounded-xl border border-[var(--border)] bg-[var(--card)] p-4",
                  fav && "border-[var(--foreground)]/40"
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-medium">{d.name}</p>
                  <button
                    type="button"
                    aria-label={fav ? "Unfavorite" : "Favorite"}
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
                <p className="text-xs text-[var(--muted-foreground)]">
                  {d.brand} · {d.category}
                </p>
                <p className="mt-2 text-sm tabular-nums">
                  {d.width}×{d.height} @ {d.dpr}x
                </p>
                {d.estimated ? (
                  <Badge variant="warning" className="mt-2">
                    Estimated
                  </Badge>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
