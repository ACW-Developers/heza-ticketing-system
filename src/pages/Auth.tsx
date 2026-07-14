import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { toast } from "sonner";
import {
  Loader2,
  Mail,
  Lock,
  User as UserIcon,
  Phone,
  Sun,
  Moon,
  Sparkles,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
} from "lucide-react";
import { z } from "zod";
import authHero from "@/assets/auth-hero.jpg";
import logo from "@/assets/logo.png";

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});
const signUpSchema = z.object({
  full_name: z.string().min(2, "Please enter your full name.").max(100, "Name is too long."),
  phone: z
    .string()
    .min(6, "Please enter a valid phone number.")
    .max(20, "Phone number is too long."),
  email: z.string().email("Please enter a valid email address."),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters.")
    .max(72, "Password is too long."),
});

// Convert raw auth errors into clear, friendly messages.
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials"))
    return "Wrong email or password. Please try again.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email address before signing in. Check your inbox.";
  if (
    m.includes("user already registered") ||
    m.includes("already registered") ||
    m.includes("already exists")
  )
    return "An account with this email already exists. Try signing in instead.";
  if (m.includes("password should be at least") || m.includes("password is too short"))
    return "Your password is too short. Use at least 6 characters.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("network") || m.includes("failed to fetch"))
    return "Network problem. Check your internet connection and try again.";
  if (m.includes("invalid email"))
    return "That email address doesn't look right. Please double-check it.";
  if (m.includes("signup") && m.includes("disabled"))
    return "New sign-ups are currently disabled. Please contact support.";
  return message || "Something went wrong. Please try again.";
}

function Auth() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const initialTab = params.get("mode") === "signup" ? "signup" : "signin";
  const { user, isAdmin, loading: authLoading, roleResolved } = useAuth();
  const { theme, toggle } = useTheme();
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && user && roleResolved) {
      const redirect = params.get("redirect");
      // Only allow internal redirects (must start with "/" and not "//")
      const safeRedirect =
        redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : null;
      if (safeRedirect && !isAdmin) {
        nav(safeRedirect, { replace: true });
      } else {
        nav(isAdmin ? "/admin" : "/events", { replace: true });
      }
    }
  }, [user, isAdmin, authLoading, roleResolved, nav, params]);

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z.string().email().safeParse(forgotEmail.trim());
    if (!parsed.success) return toast.error("Please enter a valid email address.");
    setForgotBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotBusy(false);
    if (error) return toast.error(friendlyAuthError(error.message));
    toast.success("Check your email for a reset link.");
    setForgotOpen(false);
  }

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) return toast.error(friendlyAuthError(error.message));
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
    if (error) return toast.error(friendlyAuthError(error.message));
    toast.success("Account created - signing you in…");
    await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: hero image */}
      <div className="relative hidden lg:block overflow-hidden">
        <img
          src={authHero}
          alt="Traveler holding tickets"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Subtle brand tint across the image */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-transparent to-accent/20 mix-blend-multiply" />
        {/* Darken only the lower portion so bottom text stays readable */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/40 to-transparent" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <div className="max-w-2xl space-y-4">
            <h2 className="font-display text-4xl xl:text-5xl font-bold leading-[1.05] drop-shadow-2xl">
              Your next unforgettable event is one tap away.
            </h2>

            <p className="text-base leading-relaxed text-white/95 drop-shadow-lg">
              Discover events, book in seconds with secure checkout, and walk in with instant QR
              tickets.
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

        <div className="flex-1 flex items-center justify-center px-3 pb-12">
          <div className="w-full max-w-md">
            {/* Elegant green-bordered card wrapping logo + form */}
            <div className="relative ">
              {/* Soft outer glow */}
              <div
                aria-hidden
                className="absolute -inset-px rounded-[1.75rem] bg-gradient-to-br from-primary/40 via-accent/30 to-primary/40 blur-md opacity-60"
              />
              <div className="relative rounded-[1.5rem] border border-primary/40 bg-card shadow-2xl px-6 pt-8 pb-7 sm:px-9 sm:pt-10 sm:pb-9">
                {/* Logo inside the card */}
                <div className="flex flex-col items-center mb-3">
                  <div className="h-16 w-16 rounded-2xl bg-primary/15 shadow-lg flex items-center justify-center mb-3 ring-2 ring-primary/40">
                    <img src={logo} alt="Heza Ticketing" className="h-14 w-14 rounded-lg" />
                  </div>
                  <span className="font-display text-2xl font-bold tracking-tight">
                    Heza Ticketing<span className="text-primary">.</span>
                  </span>
                </div>

                <div className="mb-6 text-center">
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Sign in or create your account to book tickets.
                  </p>
                </div>

                <Tabs defaultValue={initialTab}>
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50 border border-border rounded-lg">
                    <TabsTrigger value="signin" className="w-full rounded-md">
                      Sign in
                    </TabsTrigger>

                    <TabsTrigger value="signup" className="w-full rounded-md">
                      Sign up
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="signin">
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <FieldIcon
                        icon={Mail}
                        label="Email"
                        placeholder="Enter your email"
                        name="email"
                        type="email"
                        required
                      />
                      <PasswordField
                        label="Password"
                        placeholder="••••••••"
                        name="password"
                        required
                        minLength={6}
                      />
                      <div className="flex justify-end -mt-1">
                        <button
                          type="button"
                          onClick={() => setForgotOpen(true)}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <Button
                        type="submit"
                        disabled={loading}
                        className="group w-full h-10 px-6 rounded-xl font-semibold tracking-wide glow-primary border border-primary/50 hover:border-primary shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
                      >
                        {loading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <LogIn className="mr-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        )}
                        Sign in
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FieldIcon
                          icon={UserIcon}
                          label="Full name"
                          name="full_name"
                          placeholder="Your full name"
                          required
                          maxLength={100}
                        />

                        <FieldIcon
                          icon={Phone}
                          label="Phone"
                          name="phone"
                          type="tel"
                          placeholder="Your phone No"
                          required
                          maxLength={20}
                        />
                      </div>
                      <FieldIcon
                        icon={Mail}
                        label="Email"
                        Placeholder="Enter your email"
                        name="email"
                        type="email"
                        required
                      />
                      <PasswordField
                        label="Password"
                        name="password"
                        required
                        Placeholder="••••••••"
                        minLength={6}
                        maxLength={72}
                      />
                      <Button
                        type="submit"
                        disabled={loading}
                        className="group w-full h-10 px-6 rounded-xl font-semibold tracking-wide glow-primary border border-primary/50 hover:border-primary shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
                      >
                        {loading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
                        )}
                        Create account
                      </Button>
                    </form>
                    <div className="mt-6 flex items-start justify-center gap-2">
                      <input
                        id="terms"
                        type="checkbox"
                        name="terms"
                        required
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor="terms" className="text-sm text-primary cursor-pointer">
                        I agree to the{" "}
                        <a href="/terms" className="font-medium underline hover:text-primary/80">
                          Terms & Conditions
                        </a>{" "}
                        and{" "}
                        <a href="/privacy" className="font-medium underline hover:text-primary/80">
                          Privacy Policy
                        </a>
                        .
                      </label>
                    </div>
                  </TabsContent>
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    <Link to="/events" className="text-primary hover:text-secondary">
                      Browsing events without an account →
                    </Link>
                  </p>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={(o) => !forgotBusy && setForgotOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              Enter your account email and we'll send a secure link to set a new password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={sendReset} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70" />
                <Input
                  id="forgot-email"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="pl-10 h-11 border border-primary/30 focus-visible:border-primary"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setForgotOpen(false)}
                disabled={forgotBusy}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={forgotBusy}
                className="border border-primary/50 shadow-md shadow-primary/20"
              >
                {forgotBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldIcon({ icon: Icon, label, name, ...props }: any) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70" />
        <Input
          id={name}
          name={name}
          {...props}
          className="pl-10 h-11 border border-primary/30 bg-background/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors"
        />
      </div>
    </div>
  );
}

function PasswordField({ label, name, ...props }: any) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70" />
        <Input
          id={name}
          name={name}
          type={show ? "text" : "password"}
          {...props}
          className="pl-10 pr-10 h-11 border border-primary/30 bg-background/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors"
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
