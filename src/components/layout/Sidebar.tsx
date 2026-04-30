"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, GitBranch, Wrench, Plug, MessageSquare, Settings,
  ChevronLeft, ChevronRight, ChevronDown, Zap, LogOut, Shield, Bell,
  FlaskConical, Gauge, ScanLine, Network, BarChart3, RotateCcw,
  FileBarChart, LayoutTemplate, ShieldCheck, Building2, FolderCode,
  TrendingUp, Rocket, Package, GitPullRequestDraft, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStore } from "@/stores/ui-store";

interface NavItem { href: string; label: string; icon: React.ElementType }
interface NavGroup { label?: string; key: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    key: "core",
    items: [
      { href: "/dashboard",    label: "Dashboard",     icon: LayoutDashboard },
      { href: "/pipelines",    label: "Pipelines",     icon: GitBranch },
      { href: "/healing",      label: "Healing Events",icon: Wrench },
      { href: "/integrations", label: "Integrations",  icon: Plug },
      { href: "/repos",        label: "Code Browser",  icon: FolderCode },
      { href: "/chat",         label: "AI Assistant",  icon: MessageSquare },
    ],
  },
  {
    key: "intelligence",
    label: "Intelligence",
    items: [
      { href: "/flaky",    label: "Flaky Tests",     icon: FlaskConical },
      { href: "/optimize", label: "Optimizer",       icon: Gauge },
      { href: "/scanner",  label: "Security Scan",   icon: ScanLine },
      { href: "/patterns", label: "Failure Patterns",icon: Network },
      { href: "/env-audit",label: "Env Audit",       icon: ShieldCheck },
    ],
  },
  {
    key: "devops",
    label: "DevOps",
    items: [
      { href: "/dora",        label: "DORA Metrics",   icon: TrendingUp },
      { href: "/analytics",   label: "Build Analytics",icon: BarChart3 },
      { href: "/deployments", label: "Deployments",    icon: Rocket },
      { href: "/artifacts",   label: "Artifacts",      icon: Package },
      { href: "/incidents",   label: "Incidents",      icon: AlertTriangle },
      { href: "/auto-issues", label: "Auto Issues",    icon: GitPullRequestDraft },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    items: [
      { href: "/sla",           label: "SLA Dashboard", icon: Gauge },
      { href: "/rollback",      label: "Rollback",      icon: RotateCcw },
      { href: "/reports",       label: "Health Reports",icon: FileBarChart },
      { href: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    key: "workspace",
    label: "Workspace",
    items: [
      { href: "/templates", label: "Templates",     icon: LayoutTemplate },
      { href: "/orgs",      label: "Organizations", icon: Building2 },
      { href: "/settings",  label: "Settings",      icon: Settings },
    ],
  },
];

export function Sidebar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, setSidebarOpen } = useStore();

  // Groups collapsed by default: devops and operations to save space
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    devops: false,
    operations: false,
    workspace: false,
  });

  function toggleGroup(key: string) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // If any item in a group is active, auto-expand that group
  function isGroupActive(group: NavGroup) {
    return group.items.some(
      (item) => pathname === item.href || pathname.startsWith(item.href + "/")
    );
  }

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
  }

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "fixed left-0 top-0 z-30 h-full flex flex-col bg-card border-r border-border transition-all duration-300",
          sidebarOpen ? "w-52" : "w-14"
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-primary" />
            </div>
            {sidebarOpen && (
              <span className="font-bold text-sm gradient-text truncate">PipelineHealer</span>
            )}
          </div>
          {/* Collapse toggle in header when open */}
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-1.5 overflow-y-auto scrollbar-thin">
          {navGroups.map((group, gi) => {
            const groupActive = isGroupActive(group);
            // If group is active, always show it expanded
            const isCollapsed = group.label ? (collapsed[group.key] && !groupActive) : false;

            return (
              <div key={group.key} className={gi > 0 ? "mt-1" : ""}>
                {/* Group header — only when sidebar is open and group has a label */}
                {group.label && sidebarOpen && (
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center gap-1 px-2 py-1 rounded hover:bg-muted/50 transition-colors group/header"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 flex-1 text-left">
                      {group.label}
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-3 h-3 text-muted-foreground/40 transition-transform group-hover/header:text-muted-foreground",
                        isCollapsed && "-rotate-90"
                      )}
                    />
                  </button>
                )}

                {/* Divider when collapsed (icon-only mode) */}
                {group.label && !sidebarOpen && gi > 0 && (
                  <div className="my-1 mx-1 border-t border-border/40" />
                )}

                {/* Items */}
                {!isCollapsed && (
                  <div className="space-y-0.5 mt-0.5">
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
                                !sidebarOpen && "justify-center px-0"
                              )}
                            >
                              <Icon className="w-4 h-4 flex-shrink-0" />
                              {sidebarOpen && <span className="truncate">{item.label}</span>}
                            </Link>
                          </TooltipTrigger>
                          {!sidebarOpen && (
                            <TooltipContent side="right">{item.label}</TooltipContent>
                          )}
                        </Tooltip>
                      );
                    })}
                  </div>
                )}

                {/* When collapsed, show a single icon row for the group if sidebar is open */}
                {isCollapsed && sidebarOpen && (
                  <div className="flex gap-0.5 px-1 mt-0.5 flex-wrap">
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
                                "w-7 h-7 flex items-center justify-center rounded-md transition-colors",
                                isActive
                                  ? "bg-primary/15 text-primary"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right">{item.label}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Admin */}
          {isAdmin && (
            <div className="mt-1">
              {sidebarOpen && (
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Admin
                </p>
              )}
              {!sidebarOpen && <div className="my-1 mx-1 border-t border-border/40" />}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link
                    href="/admin"
                    className={cn(
                      "nav-item",
                      pathname.startsWith("/admin") && "active",
                      !sidebarOpen && "justify-center px-0"
                    )}
                  >
                    <Shield className="w-4 h-4 flex-shrink-0" />
                    {sidebarOpen && <span>Admin Panel</span>}
                  </Link>
                </TooltipTrigger>
                {!sidebarOpen && <TooltipContent side="right">Admin Panel</TooltipContent>}
              </Tooltip>
            </div>
          )}
        </nav>

        {/* Bottom */}
        <div className="py-2 px-1.5 border-t border-border space-y-0.5 flex-shrink-0">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full h-8 text-muted-foreground hover:text-destructive text-xs",
                  !sidebarOpen && "px-0 justify-center"
                )}
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && <span className="ml-2">Sign Out</span>}
              </Button>
            </TooltipTrigger>
            {!sidebarOpen && <TooltipContent side="right">Sign Out</TooltipContent>}
          </Tooltip>

          {/* Expand toggle (only visible when collapsed) */}
          {!sidebarOpen && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 px-0 justify-center text-muted-foreground"
              onClick={() => setSidebarOpen(true)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
