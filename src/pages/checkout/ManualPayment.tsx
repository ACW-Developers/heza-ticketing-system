import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import {
  Loader2,
  Smartphone,
  Copy,
  Check,
  ShieldCheck,
  Clock,
  ArrowLeft,
  Ticket as TicketIcon,
} from "lucide-react";
import { toast } from "sonner";

const MPESA_NUMBER = "0702370395";
const MPESA_NAME = "Omariba Jacinta";

type Item = { type: "children" | "regular" | "vip" | "vvip"; quantity: number };
type State = {
  eventId: string;
  eventTitle?: string;
  items: Item[];
  attendee: {
    name: string;
    email: string;
    phone: string;
    id_number?: string;
    country?: string;
    gender?: string;
    notes?: string;
  };
  total: number;
};

const TYPE_LABEL: Record<string, string> = {
  children: "Children",
  regular: "Regular",
  vip: "VIP",
  vvip: "VVIP",
};

function ManualPayment() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { format: fmt } = useCurrency();
  const state = loc.state as State | undefined;

  const [mpesaCode, setMpesaCode] = useState("");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<"num" | "amt" | null>(null);
  const [done, setDone] = useState<{ order_id: string; ticketsCount: number } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      nav(`/auth?redirect=${encodeURIComponent("/events")}`);
    }
  }, [loading, user, nav]);

  useEffect(() => {
    if (state?.attendee?.phone) setMpesaPhone(state.attendee.phone);
  }, [state]);

  const totalKes = useMemo(() => Math.round(Number(state?.total ?? 0)), [state]);

  if (!state || !state.items?.length) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-xl text-center">
          <p className="text-muted-foreground">No checkout in progress.</p>
          <Link to="/events" className="text-primary underline mt-4 inline-block">
            Browse events
          </Link>
        </div>
      </Layout>
    );
  }

  async function copy(text: string, key: "num" | "amt") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  async function submit() {
    if (!/^[A-Za-z0-9]{8,12}$/.test(mpesaCode.trim())) {
      return toast.error(
        "Enter a valid M-Pesa transaction code (10 letters/numbers, e.g. SFC1A2B3C4).",
      );
    }
    if (mpesaPhone.trim().length < 6) return toast.error("Enter the phone you paid from.");
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("mpesa-checkout", {
        body: {
          eventId: state!.eventId,
          items: state!.items,
          attendee: state!.attendee,
          mpesaCode: mpesaCode.trim().toUpperCase(),
          mpesaPhone: mpesaPhone.trim(),
        },
      });
      if (error) throw new Error(error.message || "Submission failed");
      if (data?.error) throw new Error(data.error);
      setDone({ order_id: data.order_id, ticketsCount: (data.tickets ?? []).length });
      toast.success("Payment submitted for confirmation");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit payment");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-xl">
          <div className="surface-card rounded-2xl p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary mb-4 glow-primary">
              <Clock className="h-8 w-8" />
            </div>
            <h1 className="font-display text-2xl font-bold mb-2">Payment received — pending confirmation</h1>
            <p className="text-muted-foreground text-sm mb-6">
              We've recorded your M-Pesa code <span className="font-mono font-semibold text-foreground">{mpesaCode.toUpperCase()}</span>.
              Your {done.ticketsCount} ticket{done.ticketsCount !== 1 ? "s" : ""} will be activated as soon
              as an admin verifies the transaction. You'll find them in <em>My tickets</em> marked as
              <span className="mx-1 rounded-full bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 text-xs font-medium">pending</span>.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link to="/my-tickets">
                <Button className="glow-primary w-full sm:w-auto">
                  <TicketIcon className="h-4 w-4 mr-2" /> View my tickets
                </Button>
              </Link>
              <Link to="/events">
                <Button variant="outline" className="w-full sm:w-auto">Back to events</Button>
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <button
          onClick={() => nav(-1)}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </button>

        <div className="grid md:grid-cols-5 gap-6">
          {/* Instructions */}
          <div className="md:col-span-3 surface-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <Smartphone className="h-5 w-5 text-primary" />
              <h1 className="font-display text-2xl font-bold">Pay with M-Pesa</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              While we finish setting up our payment gateway, ticket payments are processed manually via
              M-Pesa. Follow the steps below — it takes under a minute.
            </p>

            <ol className="space-y-3 text-sm">
              <li className="rounded-xl border border-border p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  Step 1 — Send money
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Till / Number</div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-base">{MPESA_NUMBER}</span>
                      <button
                        onClick={() => copy(MPESA_NUMBER, "num")}
                        className="text-primary hover:text-primary/80"
                        aria-label="Copy number"
                      >
                        {copied === "num" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Registered name</div>
                    <div className="font-semibold">{MPESA_NAME}</div>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-border/50">
                    <div className="text-xs text-muted-foreground">Amount</div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-xl font-bold">{fmt(totalKes)}</span>
                      <button
                        onClick={() => copy(String(totalKes), "amt")}
                        className="text-primary hover:text-primary/80"
                        aria-label="Copy amount"
                      >
                        {copied === "amt" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
              <li className="rounded-xl border border-border p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  Step 2 — Confirmation SMS
                </div>
                <p className="text-muted-foreground">
                  You'll receive an M-Pesa SMS from <b>MPESA</b> with a transaction code like
                  <span className="mx-1 font-mono font-semibold text-foreground">SFC1A2B3C4</span>.
                </p>
              </li>
              <li className="rounded-xl border border-border p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  Step 3 — Submit it below
                </div>
                <p className="text-muted-foreground">
                  Paste the code and the phone you paid from. We'll match it to your payment and
                  activate your tickets.
                </p>
              </li>
            </ol>

            <div className="mt-5 flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                If the amount matches and the code is valid, tickets are usually confirmed within a
                few minutes. Otherwise our team will follow up on the phone number you provide.
              </span>
            </div>
          </div>

          {/* Form + Summary */}
          <div className="md:col-span-2 space-y-4">
            <div className="surface-card rounded-2xl p-5">
              <h2 className="font-display text-lg font-semibold mb-3">Order summary</h2>
              <div className="text-sm space-y-1.5">
                {state.eventTitle && (
                  <div className="text-muted-foreground truncate">{state.eventTitle}</div>
                )}
                {state.items.map((it) => (
                  <div key={it.type} className="flex justify-between">
                    <span>
                      {TYPE_LABEL[it.type]} × {it.quantity}
                    </span>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-border flex justify-between items-center">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-display text-xl font-bold">{fmt(totalKes)}</span>
                </div>
              </div>
            </div>

            <div className="surface-card rounded-2xl p-5 space-y-3">
              <h2 className="font-display text-lg font-semibold">Confirm payment</h2>
              <div className="space-y-1.5">
                <Label htmlFor="mp-code">M-Pesa transaction code *</Label>
                <Input
                  id="mp-code"
                  placeholder="e.g. SFC1A2B3C4"
                  value={mpesaCode}
                  maxLength={12}
                  onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                  className="font-mono tracking-wider"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mp-phone">Phone you paid from *</Label>
                <Input
                  id="mp-phone"
                  type="tel"
                  placeholder="07XXXXXXXX"
                  value={mpesaPhone}
                  onChange={(e) => setMpesaPhone(e.target.value)}
                />
              </div>
              <Button
                className="w-full glow-primary h-11"
                disabled={submitting}
                onClick={submit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…
                  </>
                ) : (
                  "Submit payment"
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Temporary process while we restore our payment gateway.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default ManualPayment;
