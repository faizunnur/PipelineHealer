import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MainContent } from "@/components/layout/MainContent";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const db = createAdminClient();

  const { data: profile } = await db
    .from("profiles")
    .select("full_name, avatar_url, role, is_suspended")
    .eq("id", session.userId)
    .single();

  if (profile?.is_suspended) {
    redirect("/suspended");
  }

  const { count: pendingCount } = await db
    .from("healing_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", session.userId)
    .eq("status", "pending_review");

  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isAdmin={isAdmin} />
      <Topbar
        userEmail={session.email}
        userName={profile?.full_name ?? undefined}
        userAvatar={profile?.avatar_url ?? undefined}
        pendingHealingCount={pendingCount ?? 0}
      />
      <MainContent>{children}</MainContent>
    </div>
  );
}
