
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      setForm({
        full_name: data?.full_name ?? "",
        phone: data?.phone ?? "",
        email: data?.email ?? user.email ?? "",
      });
      setLoading(false);
    });
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles")
      .upsert({ user_id: user.id, ...form }, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  const initials = (form.full_name || form.email).split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-bold">Profile</h1>

      <div className="surface-card rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
            {initials || <UserIcon className="h-7 w-7" />}
          </div>
          <div>
            <div className="font-display text-lg font-semibold">{form.full_name || "Unnamed"}</div>
            <div className="text-sm text-muted-foreground">{form.email}</div>
          </div>
        </div>

        <form onSubmit={save} className="space-y-4">
          <div>
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={form.email} disabled />
            <p className="text-xs text-muted-foreground mt-1">Email cannot be changed here.</p>
          </div>
          <Button type="submit" className="glow-primary" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save changes
          </Button>
        </form>
      </div>
    </div>
  );
}

export default Profile;
