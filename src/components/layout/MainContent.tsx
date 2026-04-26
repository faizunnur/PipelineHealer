"use client";

import { useStore } from "@/stores/ui-store";

export function MainContent({ children }: { children: React.ReactNode }) {
  const { sidebarOpen } = useStore();

  return (
    <main
      className="transition-all duration-300"
      style={{
        paddingTop: "4rem",
        paddingLeft: sidebarOpen ? "14rem" : "4rem",
      }}
    >
      <div className="min-h-[calc(100vh-4rem)]">{children}</div>
    </main>
  );
}
