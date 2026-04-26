import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  Zap,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

const adminNavItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/usage", label: "Usage", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <div className="min-h-screen flex bg-background">
      {/* Admin Sidebar */}
      <aside className="w-56 border-r border-border flex flex-col bg-card fixed top-0 left-0 h-full z-30">
        <div className="h-16 flex items-center gap-2 px-4 border-b border-border">
          <div className="w-7 h-7 rounded-lg bg-destructive/20 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-destructive" />
          </div>
          <span className="font-bold text-sm">Admin Panel</span>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="nav-item"
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-border">
          <Link
            href="/dashboard"
            className="nav-item text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 ml-56 min-h-screen">
        <div className="h-16 border-b border-border flex items-center px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
          <h2 className="text-sm font-medium text-muted-foreground">
            PipelineHealer Admin
          </h2>
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
