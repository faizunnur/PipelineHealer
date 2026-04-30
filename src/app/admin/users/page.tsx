import { createAdminClient } from "@/lib/supabase/admin";
import { AdminUsersClient } from "@/components/admin/AdminUsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const supabase = createAdminClient();

  const { data: users } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, role, is_suspended, approval_mode, tokens_used, token_budget, created_at"
    )
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {users?.length ?? 0} total accounts
        </p>
      </div>

      <AdminUsersClient users={users ?? []} />
    </div>
  );
}
