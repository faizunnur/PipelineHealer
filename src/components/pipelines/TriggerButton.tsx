"use client";

import { useState } from "react";
import { Play, Loader2, GitBranch, ChevronDown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface Workflow {
  id: number;
  name: string;
  file: string;
  path: string;
}

interface TriggerButtonProps {
  pipelineId: string;
  defaultBranch: string;
}

export function TriggerButton({ pipelineId, defaultBranch }: TriggerButtonProps) {
  const [open, setOpen] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [branch, setBranch] = useState(defaultBranch);
  const [triggering, setTriggering] = useState(false);
  const [workflowError, setWorkflowError] = useState("");

  async function handleOpen() {
    setOpen(true);
    setWorkflowError("");
    if (workflows.length === 0) {
      setLoadingWorkflows(true);
      const res = await fetch(`/api/pipelines/${pipelineId}/workflows`);
      const data = await res.json();
      setLoadingWorkflows(false);
      if (!res.ok) {
        setWorkflowError(data.error ?? "Failed to load workflows");
        return;
      }
      const list: Workflow[] = data.workflows ?? [];
      setWorkflows(list);
      if (list.length === 1) setSelectedWorkflow(list[0]);
    }
  }

  async function handleTrigger() {
    if (!selectedWorkflow) return;
    setTriggering(true);
    const res = await fetch(`/api/pipelines/${pipelineId}/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId: selectedWorkflow.id, branch }),
    });
    setTriggering(false);

    if (res.ok) {
      toast({ title: "Pipeline triggered!", description: `Running ${selectedWorkflow.name} on ${branch}` });
      setOpen(false);
    } else {
      const { error } = await res.json().catch(() => ({}));
      toast({ title: "Trigger failed", description: error, variant: "destructive" });
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={handleOpen}>
        <Play className="w-3.5 h-3.5" />
        Run Pipeline
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative bg-card border border-border rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div>
              <h3 className="font-semibold text-base">Run Pipeline</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manually trigger a GitHub Actions workflow
              </p>
            </div>

            {/* Workflow selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Workflow</label>
              {loadingWorkflows ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading workflows…
                </div>
              ) : workflowError ? (
                <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{workflowError}</span>
                </div>
              ) : workflows.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No active workflows found in this repository.</p>
              ) : (
                <div className="space-y-1">
                  {workflows.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setSelectedWorkflow(w)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors
                        ${selectedWorkflow?.id === w.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-muted-foreground/50"
                        }`}
                    >
                      <Play className="w-3.5 h-3.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{w.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{w.path}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Branch input */}
            {!workflowError && !loadingWorkflows && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1">
                  <GitBranch className="w-3.5 h-3.5" /> Branch
                </label>
                <input
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background outline-none focus:border-primary transition-colors"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                />
              </div>
            )}

            {selectedWorkflow && (
              <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                <span className="font-medium">Note:</span> The workflow must have{" "}
                <code className="bg-muted px-1 rounded">on: workflow_dispatch</code> in its YAML to allow manual triggers.
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 gap-1.5"
                disabled={!selectedWorkflow || !branch.trim() || triggering || !!workflowError}
                onClick={handleTrigger}
              >
                {triggering
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Triggering…</>
                  : <><Play className="w-3.5 h-3.5" /> Run Workflow</>
                }
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
