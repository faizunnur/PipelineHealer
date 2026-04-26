"use client";

import { useState } from "react";
import { MoreHorizontal, UserX, UserCheck, Shield, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface Props {
  userId: string;
  isSuspended: boolean;
  currentRole: string;
  currentBudget: number;
}

export function AdminUserActions({ userId, isSuspended, currentRole, currentBudget }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budget, setBudget] = useState(String(currentBudget));

  async function updateUser(data: Record<string, unknown>) {
    setLoading(true);
    const res = await fetch(`/api/admin/users?userId=${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setLoading(false);

    if (res.ok) {
      toast({ title: "User updated" });
      router.refresh();
    } else {
      toast({ title: "Failed to update user", variant: "destructive" });
    }
  }

  async function saveBudget() {
    await updateUser({ token_budget: parseInt(budget) });
    setBudgetOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MoreHorizontal className="w-4 h-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => updateUser({ is_suspended: !isSuspended })}
            className={isSuspended ? "text-success" : "text-destructive"}
          >
            {isSuspended ? (
              <><UserCheck className="w-4 h-4 mr-2" /> Activate Account</>
            ) : (
              <><UserX className="w-4 h-4 mr-2" /> Suspend Account</>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              updateUser({ role: currentRole === "admin" ? "user" : "admin" })
            }
          >
            <Shield className="w-4 h-4 mr-2" />
            {currentRole === "admin" ? "Demote to User" : "Promote to Admin"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setBudgetOpen(true)}>
            <Zap className="w-4 h-4 mr-2" />
            Edit Token Budget
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Token Budget</DialogTitle>
            <DialogDescription>
              Set the monthly Claude API token limit for this user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-2">
              <Label>Token Budget (per month)</Label>
              <Input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                min="0"
                step="10000"
              />
              <p className="text-xs text-muted-foreground">
                Current: {currentBudget.toLocaleString()} tokens
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setBudgetOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={saveBudget} disabled={loading}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
