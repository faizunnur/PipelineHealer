import { createAdminClient } from "@/lib/supabase/admin";
import { Shield, UserX, UserCheck, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import { AdminUserActions } from "@/components/admin/AdminUserActions";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const supabase = createAdminClient();

  const { data: users } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, role, is_suspended, approval_mode, tokens_used, token_budget, created_at"
    )
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {users?.length ?? 0} total accounts
        </p>
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
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">
                    User
                  </th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">
                    Role
                  </th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">
                    Status
                  </th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">
                    Tokens
                  </th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">
                    Mode
                  </th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">
                    Joined
                  </th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user) => {
                  const tokenPercent = Math.round(
                    (user.tokens_used / user.token_budget) * 100
                  );
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-border/50 hover:bg-muted/30"
                    >
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">
                            {user.full_name ?? "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge
                          variant={
                            user.role === "admin" ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {user.role === "admin" && (
                            <Shield className="w-2.5 h-2.5 mr-1" />
                          )}
                          {user.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1.5">
                          {user.is_suspended ? (
                            <>
                              <UserX className="w-3.5 h-3.5 text-destructive" />
                              <span className="text-destructive text-xs">
                                Suspended
                              </span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5 text-success" />
                              <span className="text-success text-xs">
                                Active
                              </span>
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
                                tokenPercent > 80
                                  ? "bg-destructive"
                                  : tokenPercent > 60
                                  ? "bg-warning"
                                  : "bg-success"
                              }`}
                              style={{
                                width: `${Math.min(tokenPercent, 100)}%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {user.tokens_used.toLocaleString()} /{" "}
                            {user.token_budget.toLocaleString()}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1">
                          <Zap
                            className={`w-3 h-3 ${
                              user.approval_mode === "auto"
                                ? "text-warning"
                                : "text-muted-foreground"
                            }`}
                          />
                          <span className="text-xs capitalize">
                            {user.approval_mode}
                          </span>
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
