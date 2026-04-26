"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export function DeleteIntegrationButton({
  integrationId,
}: {
  integrationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    const res = await fetch(`/api/integrations/${integrationId}`, {
      method: "DELETE",
    });
    setLoading(false);

    if (res.ok) {
      toast({ title: "Integration removed" });
      setOpen(false);
      router.refresh();
    } else {
      toast({
        title: "Failed to remove integration",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive h-8 w-8"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Integration</DialogTitle>
          <DialogDescription>
            This will disconnect the integration and stop monitoring all
            associated pipelines. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Remove
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
