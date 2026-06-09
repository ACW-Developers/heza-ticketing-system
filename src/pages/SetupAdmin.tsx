import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

function SetupAdmin() {
  const nav = useNavigate();
  const [state, setState] = useState<"checking" | "blocked" | "ready">("checking");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.functions
      .invoke("setup-admin", { method: "GET" })
      .then(({ data, error }) => {
        if (error || !data) return setState("blocked");
        setState(data.hasAdmin ? "blocked" : "ready");
      })
      .catch(() => setState("blocked"));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("setup-admin", {
        body: {
          full_name: String(fd.get("full_name") ?? ""),
          phone: String(fd.get("phone") ?? ""),
          email: String(fd.get("email") ?? ""),
          password: String(fd.get("password") ?? ""),
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success("Admin created. You can sign in now.");
      nav("/auth");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create admin");
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "checking")
    return <Layout><div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div></Layout>;

  if (state === "blocked")
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center max-w-md">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary mb-4" />
          <h1 className="font-display text-2xl font-bold mb-2">Setup unavailable</h1>
          <p className="text-muted-foreground">An administrator already exists for this workspace.</p>
        </div>
      </Layout>
    );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <div className="w-full max-w-md surface-card rounded-2xl p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground glow-primary mb-3">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-bold">Create the first admin</h1>
            <p className="text-sm text-muted-foreground text-center">This page is one-time only and disappears once an admin exists.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" required maxLength={100} />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" required maxLength={20} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required minLength={8} maxLength={72} />
            </div>
            <Button type="submit" className="w-full glow-primary" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create admin
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
