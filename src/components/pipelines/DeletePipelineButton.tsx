"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface DeletePipelineButtonProps {
  pipelineId: string;
  repoName: string;
  variant?: "icon" | "full";
  redirectAfter?: string;
}

export function DeletePipelineButton({
  pipelineId,
  repoName,
  variant = "icon",
  redirectAfter,
}: DeletePipelineButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/pipelines/${pipelineId}`, { method: "DELETE" });
    setDeleting(false);

    if (res.ok) {
      toast({ title: "Pipeline deleted", description: repoName });
      setOpen(false);
      router.push(redirectAfter ?? "/pipelines");
      router.refresh();
    } else {
      const { error } = await res.json().catch(() => ({}));
      toast({ title: "Delete failed", description: error ?? "Something went wrong", variant: "destructive" });
    }
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete pipeline"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
          <Trash2 className="w-3.5 h-3.5" />
          Delete Pipeline
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative bg-card border border-border rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold">Delete Pipeline?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium text-foreground">{repoName}</span> and all its
                  runs, healing events, SLA rules, scan results, and history will be
                  permanently deleted. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" disabled={deleting} onClick={handleDelete}>
                {deleting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting…</> : <><Trash2 className="w-3.5 h-3.5" /> Delete</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
