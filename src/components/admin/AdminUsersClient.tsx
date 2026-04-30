"use client";

import { useState, useMemo } from "react";
import { Shield, UserX, UserCheck, Zap, Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatRelativeTime } from "@/lib/utils";
import { AdminUserActions } from "@/components/admin/AdminUserActions";

type User = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_suspended: boolean;
  approval_mode: string;
  tokens_used: number;
  token_budget: number;
  created_at: string;
};

const ROLE_OPTS = [
  { value: "all", label: "All Roles" },
  { value: "admin", label: "Admin" },
  { value: "user", label: "User" },
];

const STATUS_OPTS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

export function AdminUsersClient({ users }: { users: User[] }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (users ?? []).filter((u) => {
      if (q && !(
        (u.full_name ?? "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      )) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter === "active" && u.is_suspended) return false;
      if (statusFilter === "suspended" && !u.is_suspended) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const hasFilters = search || roleFilter !== "all" || statusFilter !== "all";

  function clearFilters() {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            className="pl-9 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-xs"
        >
          {ROLE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-xs"
        >
          {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs h-9 px-3 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}

        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {users.length} users
        </span>
      </div>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">User</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Role</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Status</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Tokens</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Mode</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Joined</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted-foreground text-sm">
                      {hasFilters ? (
                        <span>
                          No users match your filters.{" "}
                          <button onClick={clearFilters} className="text-primary hover:underline">Clear filters</button>
                        </span>
                      ) : "No users found."}
                    </td>
                  </tr>
                ) : filtered.map((user) => {
                  const tokenPercent = Math.round((user.tokens_used / user.token_budget) * 100);
                  return (
                    <tr key={user.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{user.full_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-xs">
                          {user.role === "admin" && <Shield className="w-2.5 h-2.5 mr-1" />}
                          {user.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1.5">
                          {user.is_suspended ? (
                            <>
                              <UserX className="w-3.5 h-3.5 text-destructive" />
                              <span className="text-destructive text-xs">Suspended</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5 text-success" />
                              <span className="text-success text-xs">Active</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="w-20">
                          <div className="flex justify-between text-xs mb-1">
                            <span>{tokenPercent}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                tokenPercent > 80 ? "bg-destructive" : tokenPercent > 60 ? "bg-warning" : "bg-success"
                              }`}
                              style={{ width: `${Math.min(tokenPercent, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {user.tokens_used.toLocaleString()} / {user.token_budget.toLocaleString()}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1">
                          <Zap className={`w-3 h-3 ${user.approval_mode === "auto" ? "text-warning" : "text-muted-foreground"}`} />
                          <span className="text-xs capitalize">{user.approval_mode}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground text-xs">
                        {formatRelativeTime(user.created_at)}
                      </td>
                      <td className="py-3 px-2">
                        <AdminUserActions
                          userId={user.id}
                          isSuspended={user.is_suspended}
                          currentRole={user.role}
                          currentBudget={user.token_budget}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
