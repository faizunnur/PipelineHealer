import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminUsagePage() {
  const supabase = createAdminClient();

  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString();

  const { data: usageByUser } = await supabase
    .from("token_usage_log")
    .select(`user_id, feature, tokens_in, tokens_out, total, model, created_at,
             profiles!inner(email, full_name)`)
    .gte("created_at", startOfMonth)
    .order("created_at", { ascending: false })
    .limit(200);

  // Aggregate by user
  const userMap = new Map<string, {
    email: string;
    name: string | null;
    healing: number;
    chat: number;
    total: number;
  }>();

  for (const row of usageByUser ?? []) {
    const profile = row.profiles as { email: string; full_name: string | null } | null;
    if (!profile) continue;

    const entry = userMap.get(row.user_id) ?? {
      email: profile.email,
      name: profile.full_name,
      healing: 0,
      chat: 0,
      total: 0,
    };

    if (row.feature === "healing") entry.healing += row.total ?? 0;
    if (row.feature === "chat") entry.chat += row.total ?? 0;
    entry.total += row.total ?? 0;

    userMap.set(row.user_id, entry);
  }

  const aggregated = Array.from(userMap.entries())
    .sort((a, b) => b[1].total - a[1].total);

  const grandTotal = aggregated.reduce((s, [, v]) => s + v.total, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Token Usage</h1>
        <p className="text-muted-foreground text-sm mt-1">
          This month&apos;s Claude API consumption
        </p>
      </div>

      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Total tokens this month</p>
          <p className="text-3xl font-bold">{grandTotal.toLocaleString()}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-User Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">User</th>
                <th className="text-right py-2 px-2 text-muted-foreground font-medium">Healing</th>
                <th className="text-right py-2 px-2 text-muted-foreground font-medium">Chat</th>
                <th className="text-right py-2 px-2 text-muted-foreground font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {aggregated.map(([userId, data]) => (
                <tr key={userId} className="border-b border-border/50">
                  <td className="py-3 px-2">
                    <p className="font-medium">{data.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{data.email}</p>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <Badge variant="secondary" className="text-xs font-mono">
                      {data.healing.toLocaleString()}
                    </Badge>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <Badge variant="outline" className="text-xs font-mono">
                      {data.chat.toLocaleString()}
                    </Badge>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="font-semibold font-mono">
                      {data.total.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
              {aggregated.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground text-sm">
                    No usage data this month yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
