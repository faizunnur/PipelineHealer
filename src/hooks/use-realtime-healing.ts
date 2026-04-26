"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeHealingCount(userId: string | undefined) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    // Initial count
    supabase
      .from("healing_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending_review")
      .then(({ count }) => setCount(count ?? 0));

    // Subscribe to changes
    const channel = supabase
      .channel("healing-count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "healing_events",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          supabase
            .from("healing_events")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "pending_review")
            .then(({ count }) => setCount(count ?? 0));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return count;
}
