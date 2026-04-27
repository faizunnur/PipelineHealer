"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GitBranch,
  Wrench,
  Plug,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  LogOut,
  Shield,
  Bell,
  FlaskConical,
  Gauge,
  ScanLine,
  Network,
  BarChart3,
  RotateCcw,
  FileBarChart,
  LayoutTemplate,
  ShieldCheck,
  Building2,
  FolderCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStore } from "@/stores/ui-store";

interface NavGroup {
  label?: string;
  items: { href: string; label: string; icon: React.ElementType }[];
}

const navGroups: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/pipelines", label: "Pipelines", icon: GitBranch },
      { href: "/healing", label: "Healing Events", icon: Wrench },
      { href: "/integrations", label: "Integrations", icon: Plug },
      { href: "/repos", label: "Code Browser", icon: FolderCode },
      { href: "/chat", label: "AI Assistant", icon: MessageSquare },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/flaky", label: "Flaky Tests", icon: FlaskConical },
      { href: "/optimize", label: "Optimizer", icon: Gauge },
      { href: "/scanner", label: "Security Scan", icon: ScanLine },
      { href: "/patterns", label: "Failure Patterns", icon: Network },
      { href: "/env-audit", label: "Env Audit", icon: ShieldCheck },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/sla", label: "SLA Dashboard", icon: BarChart3 },
      { href: "/rollback", label: "Rollback", icon: RotateCcw },
      { href: "/reports", label: "Health Reports", icon: FileBarChart },
      { href: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/templates", label: "Templates", icon: LayoutTemplate },
      { href: "/orgs", label: "Organizations", icon: Building2 },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, setSidebarOpen } = useStore();

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
  }

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "fixed left-0 top-0 z-30 h-full flex flex-col bg-card border-r border-border transition-all duration-300",
          sidebarOpen ? "w-56" : "w-16"
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            {sidebarOpen && (
              <span className="font-bold text-sm gradient-text truncate">
                PipelineHealer
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          {navGroups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? "mt-2" : ""}>
              {group.label && sidebarOpen && (
                <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {group.label}
                </p>
              )}
              {group.label && !sidebarOpen && gi > 0 && (
                <div className="my-1.5 mx-2 border-t border-border/50" />
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <Tooltip key={item.href} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "nav-item",
                            isActive && "active",
                            !sidebarOpen && "justify-center px-2"
                          )}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          {sidebarOpen && <span>{item.label}</span>}
                        </Link>
                      </TooltipTrigger>
                      {!sidebarOpen && (
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}

          {isAdmin && (
            <div className="mt-2">
              {sidebarOpen && (
                <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Admin
                </p>
              )}
              {!sidebarOpen && <div className="my-1.5 mx-2 border-t border-border/50" />}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link
                    href="/admin"
                    className={cn(
                      "nav-item",
                      pathname.startsWith("/admin") && "active",
                      !sidebarOpen && "justify-center px-2"
                    )}
                  >
                    <Shield className="w-4 h-4 flex-shrink-0" />
                    {sidebarOpen && <span>Admin Panel</span>}
                  </Link>
                </TooltipTrigger>
                {!sidebarOpen && (
                  <TooltipContent side="right">Admin Panel</TooltipContent>
                )}
              </Tooltip>
            </div>
          )}
        </nav>

        {/* Bottom actions */}
        <div className="py-4 px-2 border-t border-border space-y-1">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full text-muted-foreground hover:text-destructive",
                  !sidebarOpen && "px-2 justify-center"
                )}
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && <span className="ml-2">Sign Out</span>}
              </Button>
            </TooltipTrigger>
            {!sidebarOpen && (
              <TooltipContent side="right">Sign Out</TooltipContent>
            )}
          </Tooltip>

          {/* Collapse toggle */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-full text-muted-foreground",
              !sidebarOpen && "px-2 justify-center"
            )}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="ml-2 text-xs">Collapse</span>
              </>
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
