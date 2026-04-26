import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MainContent } from "@/components/layout/MainContent";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, role, is_suspended")
    .eq("id", user.id)
    .single();

  if (profile?.is_suspended) {
    redirect("/suspended");
  }

  // Count pending healing events for notification badge
  const { count: pendingCount } = await supabase
    .from("healing_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pending_review");

  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isAdmin={isAdmin} />
      <Topbar
        userEmail={user.email}
        userName={profile?.full_name ?? undefined}
        userAvatar={profile?.avatar_url ?? undefined}
        pendingHealingCount={pendingCount ?? 0}
      />
      <MainContent>{children}</MainContent>
    </div>
  );
}
