import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { AdminUsageClient } from "@/components/admin/AdminUsageClient";

export const dynamic = "force-dynamic";

export default async function AdminUsagePage() {
  const supabase = createAdminClient();

  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString();

  const { data: rows } = await supabase
    .from("token_usage_log")
    .select(`user_id, feature, tokens_in, tokens_out, total, model, created_at,
             profiles!inner(email, full_name)`)
    .gte("created_at", startOfMonth)
    .order("created_at", { ascending: false })
    .limit(500);

  const grandTotal = (rows ?? []).reduce((s, r) => s + (r.total ?? 0), 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Token Usage</h1>
        <p className="text-muted-foreground text-sm mt-1">
          This month&apos;s Claude API consumption by user and feature
        </p>
      </div>

      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Total tokens this month</p>
          <p className="text-3xl font-bold">{grandTotal.toLocaleString()}</p>
        </CardContent>
      </Card>

      <AdminUsageClient rows={(rows ?? []) as Parameters<typeof AdminUsageClient>[0]["rows"]} />
    </div>
  );
}
