import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Lock, ShieldCheck } from "lucide-react";

function ResetPassword() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  useEffect(() => {
    // Supabase places a recovery token in the URL hash and signs the user in.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return toast.error("Password must be at least 6 characters.");
    if (pw !== pw2) return toast.error("Passwords do not match.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return toast.error(error.message || "Could not update password.");
    toast.success("Password updated. You're signed in.");
    nav("/events", { replace: true });
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-md">
        <div className="surface-card rounded-2xl border-2 border-primary/30 p-8 shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold">Set a new password</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            {ready
              ? "Choose a strong password you haven't used before."
              : "Open the password reset link from your email to continue."}
          </p>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw">New password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70" />
                <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="pl-10 h-11" required minLength={6} disabled={!ready} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw2">Confirm new password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70" />
                <Input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="pl-10 h-11" required minLength={6} disabled={!ready} />
              </div>
            </div>
            <Button type="submit" disabled={!ready || loading} className="w-full h-12 rounded-xl border-2 border-primary/50 shadow-lg shadow-primary/20 hover:shadow-primary/40">
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Update password"}
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
}

export default ResetPassword;