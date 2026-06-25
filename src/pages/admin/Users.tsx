import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Users, Shield, KeyRound, Trash2, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function AdminUsers() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "list" } });
    if (error || data?.error) {
      toast.error(error?.message || data?.error || "Failed to load users");
      setRows([]);
    } else {
      setRows(data.users ?? []);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) =>
      (r.email ?? "").toLowerCase().includes(s) ||
      (r.full_name ?? "").toLowerCase().includes(s) ||
      (r.phone ?? "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  const stats = useMemo(() => ({
    total: rows.length,
    admins: rows.filter((r) => r.roles.includes("admin")).length,
    buyers: rows.filter((r) => r.ticket_count > 0).length,
  }), [rows]);

  async function toggleAdmin(u: any, enabled: boolean) {
    setBusyId(u.id);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "set_role", user_id: u.id, role: "admin", enabled },
    });
    setBusyId(null);
    if (error || data?.error) return toast.error(error?.message || data?.error || "Failed");
    toast.success(enabled ? "Granted admin" : "Revoked admin");
    setRows((cur) => cur.map((r) => r.id === u.id ? {
      ...r,
      roles: enabled
        ? Array.from(new Set([...r.roles, "admin"]))
        : r.roles.filter((x: string) => x !== "admin"),
    } : r));
  }

  async function sendReset(u: any) {
    setBusyId(u.id);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "send_password_reset", email: u.email, redirect_to: `${window.location.origin}/reset-password` },
    });
    setBusyId(null);
    if (error || data?.error) return toast.error(error?.message || data?.error || "Failed");
    toast.success(`Password reset email sent to ${u.email}`);
  }

  async function doDelete() {
    if (!confirmDelete) return;
    const u = confirmDelete;
    setBusyId(u.id); setConfirmDelete(null);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "delete_user", user_id: u.id },
    });
    setBusyId(null);
    if (error || data?.error) return toast.error(error?.message || data?.error || "Failed");
    toast.success("User deleted");
    setRows((cur) => cur.filter((r) => r.id !== u.id));
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">User management</h1>
          <p className="text-sm text-muted-foreground">Manage roles, send password resets, remove accounts</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="h-5 w-5" /></div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Total users" value={stats.total} />
        <StatCard label="Admins" value={stats.admins} />
        <StatCard label="Ticket buyers" value={stats.buyers} />
      </div>

      <div className="surface-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, phone" className="border-0 focus-visible:ring-0 px-0 h-8" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Tickets</th>
                <th className="p-3">Joined</th>
                <th className="p-3">Last sign-in</th>
                <th className="p-3">Admin</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isAdmin = p.roles.includes("admin");
                const isSelf = p.id === user?.id;
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                    <td className="p-3">
                      <div className="font-semibold flex items-center gap-1.5">
                        {p.full_name ?? "—"}
                        {isAdmin && <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-medium"><Shield className="h-2.5 w-2.5" /> Admin</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </td>
                    <td className="p-3 text-muted-foreground">{p.phone ?? "—"}</td>
                    <td className="p-3 font-semibold">{p.ticket_count}</td>
                    <td className="p-3 text-muted-foreground text-xs">{format(new Date(p.created_at), "MMM d, yyyy")}</td>
                    <td className="p-3 text-muted-foreground text-xs">{p.last_sign_in_at ? format(new Date(p.last_sign_in_at), "MMM d, h:mm a") : "Never"}</td>
                    <td className="p-3">
                      <Switch
                        checked={isAdmin}
                        disabled={busyId === p.id || isSelf}
                        onCheckedChange={(v) => toggleAdmin(p, v)}
                      />
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <Button size="sm" variant="ghost" disabled={busyId === p.id} onClick={() => sendReset(p)}>
                        <KeyRound className="h-3.5 w-3.5 mr-1" /> Reset
                      </Button>
                      <Button size="icon" variant="ghost" disabled={busyId === p.id || isSelf} onClick={() => setConfirmDelete(p)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{confirmDelete?.email}</strong>, their profile, tickets, and orders. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card rounded-xl p-5">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="font-display text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}

export default AdminUsers;
