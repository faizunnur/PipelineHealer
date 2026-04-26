import { createAdminClient } from "@/lib/supabase/admin";
import { Users, GitBranch, Wrench, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const supabase = createAdminClient();

  const [
    { count: totalUsers },
    { count: totalPipelines },
    { count: totalHealingEvents },
    { data: tokenUsage },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("pipelines").select("*", { count: "exact", head: true }),
    supabase.from("healing_events").select("*", { count: "exact", head: true }),
    supabase
      .from("token_usage_log")
      .select("total")
      .gte(
        "created_at",
        new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1
        ).toISOString()
      ),
  ]);

  const totalTokens = tokenUsage?.reduce((sum, r) => sum + (r.total ?? 0), 0) ?? 0;

  const stats = [
    {
      title: "Total Users",
      value: totalUsers ?? 0,
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Total Pipelines",
      value: totalPipelines ?? 0,
      icon: GitBranch,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      title: "Healing Events",
      value: totalHealingEvents ?? 0,
      icon: Wrench,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      title: "Tokens This Month",
      value: totalTokens.toLocaleString(),
      icon: Zap,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Admin Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Platform-wide statistics
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="p-5">
                <div
                  className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}
                >
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stat.title}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
