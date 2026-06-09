
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, Shield } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/admin/users")({ component: AdminUsers });

function AdminUsers() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap: Record<string, string[]> = {};
      for (const r of roles ?? []) (roleMap[r.user_id] ??= []).push(r.role);
      setRows((profiles ?? []).map((p) => ({ ...p, roles: roleMap[p.user_id] ?? ["user"] })));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">User management</h1>
          <p className="text-sm text-muted-foreground">{rows.length} registered users</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Users className="h-5 w-5" />
        </div>
      </div>

      <div className="surface-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-3">User</th><th className="p-3">Phone</th><th className="p-3">Role</th><th className="p-3">Joined</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                <td className="p-3">
                  <div className="font-semibold">{p.full_name ?? "-"}</div>
                  <div className="text-xs text-muted-foreground">{p.email}</div>
                </td>
                <td className="p-3 text-muted-foreground">{p.phone ?? "-"}</td>
                <td className="p-3">
                  {p.roles.includes("admin") ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs font-medium">
                      <Shield className="h-3 w-3" /> Admin
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs">User</span>
                  )}
                </td>
                <td className="p-3 text-muted-foreground">{format(new Date(p.created_at), "MMM d, yyyy")}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-muted-foreground">No users yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminUsers;
