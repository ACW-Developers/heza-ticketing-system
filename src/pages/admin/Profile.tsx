import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User as UserIcon, Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";

function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", avatar_url: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setForm({
          full_name: data?.full_name ?? "",
          phone: data?.phone ?? "",
          email: data?.email ?? user.email ?? "",
          avatar_url: (data as any)?.avatar_url ?? "",
        });
        setLoading(false);
      });
  }, [user]);

  async function uploadAvatar(file: File) {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("event-posters")
      .upload(path, file, { upsert: true });
    if (upErr) {
      setUploading(false);
      return toast.error(upErr.message);
    }
    const { data } = supabase.storage.from("event-posters").getPublicUrl(path);
    const url = data.publicUrl;
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: user.id, avatar_url: url }, { onConflict: "user_id" });
    setUploading(false);
    if (error) return toast.error(error.message);
    setForm((f) => ({ ...f, avatar_url: url }));
    toast.success("Profile photo updated");
    window.dispatchEvent(new Event("profile-updated"));
  }

  async function removeAvatar() {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: user.id, avatar_url: null }, { onConflict: "user_id" });
    if (error) return toast.error(error.message);
    setForm((f) => ({ ...f, avatar_url: "" }));
    toast.success("Photo removed");
    window.dispatchEvent(new Event("profile-updated"));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert(
        { user_id: user.id, full_name: form.full_name, phone: form.phone, email: form.email },
        { onConflict: "user_id" },
      );
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile saved");
      window.dispatchEvent(new Event("profile-updated"));
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  const initials = (form.full_name || form.email)
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-bold">Profile</h1>

      <div className="surface-card rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative group">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold overflow-hidden ring-2 ring-primary/30">
              {form.avatar_url ? (
                <img src={form.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
              ) : initials ? (
                initials
              ) : (
                <UserIcon className="h-8 w-8" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:scale-105 transition"
              aria-label="Change photo"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-semibold truncate">
              {form.full_name || "Unnamed"}
            </div>
            <div className="text-sm text-muted-foreground truncate">{form.email}</div>
            {form.avatar_url && (
              <button
                type="button"
                onClick={removeAvatar}
                className="mt-1 text-xs text-destructive hover:underline inline-flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" /> Remove photo
              </button>
            )}
          </div>
        </div>

        <form onSubmit={save} className="space-y-4">
          <div>
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
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
