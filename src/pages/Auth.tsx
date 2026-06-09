import { useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User as UserIcon, Phone, Sun, Moon, Sparkles, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import authHero from "@/assets/auth-hero.jpg";
import logo from "@/assets/logo.png";

const signInSchema = z.object({ email: z.string().email(), password: z.string().min(6) });
const signUpSchema = z.object({
  full_name: z.string().min(2).max(100),
  phone: z.string().min(6).max(20),
  email: z.string().email(),
  password: z.string().min(6).max(72),
});

function Auth() {
  const nav = useNavigate();
  const { user, isAdmin, loading: authLoading, roleResolved } = useAuth();
  const { theme, toggle } = useTheme();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user && roleResolved) {
      nav(isAdmin ? "/admin" : "/events", { replace: true });
    }
  }, [user, isAdmin, authLoading, roleResolved, nav]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({
      full_name: fd.get("full_name"),
      phone: fd.get("phone"),
      email: fd.get("email"),
      password: fd.get("password"),
    });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/events`,
        data: { full_name: parsed.data.full_name, phone: parsed.data.phone },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created - signing you in…");
    await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: hero image */}
      <div className="relative hidden lg:block overflow-hidden">
        <img src={authHero} alt="Traveler holding tickets" className="absolute inset-0 h-full w-full object-cover" />
        {/* Subtle brand tint across the image */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-transparent to-accent/20 mix-blend-multiply" />
        {/* Darken only the lower portion so bottom text stays readable */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/40 to-transparent" />
        <div className="relative h-full flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-white/90 backdrop-blur ring-1 ring-white/40 flex items-center justify-center shadow-lg">
              <img src={logo} alt="" className="h-8 w-8 rounded-md" />
            </div>
            <span className="font-display text-xl font-bold drop-shadow-lg">Smarticketing</span>
          </div>
          <div className="space-y-4 max-w-md">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" /> Trusted by thousands of event-goers
            </div>
            <h2 className="font-display text-4xl xl:text-5xl font-bold leading-[1.05] drop-shadow-2xl">
              Your next unforgettable event is one tap away.
            </h2>
            <p className="text-white/95 text-base leading-relaxed drop-shadow-lg">
              Discover events, book in seconds with secure checkout, and walk in with instant QR tickets.
            </p>
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex flex-col bg-muted/20">
        <div className="flex items-center justify-end p-4 lg:p-6">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md">
            {/* Elegant green-bordered card wrapping logo + form */}
            <div className="relative">
              {/* Soft outer glow */}
              <div
                aria-hidden
                className="absolute -inset-px rounded-[1.75rem] bg-gradient-to-br from-primary/40 via-accent/30 to-primary/40 blur-md opacity-60"
              />
              <div className="relative rounded-[1.5rem] border-2 border-primary/40 bg-card shadow-2xl px-6 pt-8 pb-7 sm:px-9 sm:pt-10 sm:pb-9">
                {/* Logo inside the card */}
                <div className="flex flex-col items-center mb-7">
                  <div className="h-16 w-16 rounded-2xl bg-primary/15 shadow-lg flex items-center justify-center mb-3 ring-2 ring-primary/40">
                    <img src={logo} alt="Smarticketing" className="h-12 w-12 rounded-lg" />
                  </div>
                  <span className="font-display text-2xl font-bold tracking-tight">
                    Smarticketing<span className="text-primary">.</span>
                  </span>
                </div>

                <div className="mb-6 text-center">
                <h1 className="font-display text-2xl font-bold tracking-tight">Welcome back</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">Sign in or create your account to book tickets.</p>
              </div>

              <Tabs defaultValue="signin">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Sign up</TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <FieldIcon icon={Mail} label="Email" name="email" type="email" required />
                    <PasswordField label="Password" name="password" required minLength={6} />
                    <Button type="submit" className="w-full glow-primary h-11" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <FieldIcon icon={UserIcon} label="Full name" name="full_name" required maxLength={100} />
                    <FieldIcon icon={Phone} label="Phone" name="phone" type="tel" required maxLength={20} />
                    <FieldIcon icon={Mail} label="Email" name="email" type="email" required />
                    <PasswordField label="Password" name="password" required minLength={6} maxLength={72} />
                    <Button type="submit" className="w-full glow-primary h-11" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create account
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              By continuing you agree to our terms and privacy policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldIcon({ icon: Icon, label, name, ...props }: any) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70" />
        <Input
          id={name}
          name={name}
          {...props}
          className="pl-10 h-11 border-2 border-primary/30 bg-background/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors"
        />
      </div>
    </div>
  );
}

function PasswordField({ label, name, ...props }: any) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70" />
        <Input
          id={name}
          name={name}
          type={show ? "text" : "password"}
          {...props}
          className="pl-10 pr-10 h-11 border-2 border-primary/30 bg-background/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default Auth;
