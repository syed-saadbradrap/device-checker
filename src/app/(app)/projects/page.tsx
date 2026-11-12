"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<Project[] | { projects: Project[] }>("/api/projects");
    if (!res.ok) {
      setError(res.error);
      setProjects([]);
    } else {
      setError(null);
      setProjects(Array.isArray(res.data) ? res.data : res.data.projects ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createOrUpdate() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    if (editingId) {
      const res = await apiFetch<Project>(`/api/projects/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, description: description || undefined }),
      });
      setSaving(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Project updated");
    } else {
      const res = await apiFetch<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name, description: description || undefined }),
      });
      setSaving(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Project created");
    }
    setName("");
    setDescription("");
    setEditingId(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this project?")) return;
    const res = await apiFetch<unknown>(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Project deleted");
    await load();
  }

  function startEdit(p: Project) {
    setEditingId(p.id);
    setName(p.name);
    setDescription(p.description || "");
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Create and manage projects that group URLs, sessions, and reports."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{editingId ? "Edit project" : "New project"}</CardTitle>
          <CardDescription>POST /api/projects · PATCH /api/projects/[id]</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[80px]"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={createOrUpdate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editingId ? "Save changes" : "Create project"}
            </Button>
            {editingId ? (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setName("");
                  setDescription("");
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState title="No projects yet" description="Create a project to organize tests." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>{p.name}</CardTitle>
                    <CardDescription>{formatDate(p.createdAt)}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(p)} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => void remove(p.id)} aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {p.description ? (
                <CardContent>
                  <p className="text-sm text-[var(--muted-foreground)]">{p.description}</p>
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
