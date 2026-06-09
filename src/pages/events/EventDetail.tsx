import { useNavigate, Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import { Calendar, MapPin, Loader2, Minus, Plus, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const TYPES = [
  { key: "children", label: "Children", desc: "Ages 12 and under" },
  { key: "regular", label: "Regular", desc: "General admission" },
  { key: "vip", label: "VIP", desc: "Priority entry & lounge" },
  { key: "vvip", label: "VVIP", desc: "Backstage + premium seating" },
] as const;

function EventDetail() {
  const { id } = useParams() as Record<string,string>;
  const { user } = useAuth();
  const { format: fmt } = useCurrency();
  const nav = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState<Record<string, number>>({ children: 0, regular: 0, vip: 0, vvip: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });

  useEffect(() => {
    supabase.from("events").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      setEvent(data);
      setLoading(false);
    });
  }, [id]);

  // Prefill contact from profile
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, phone, email").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        setContact({
          name: data?.full_name ?? "",
          email: data?.email ?? user.email ?? "",
          phone: data?.phone ?? "",
        });
      });
  }, [user]);

  function priceFor(t: string) { return Number(event?.[`price_${t}`] ?? 0); }
  function maxFor(t: string) { return Number(event?.[`qty_${t}`] ?? 0); }
  const total = TYPES.reduce((s, t) => s + qty[t.key] * priceFor(t.key), 0);
  const totalQty = Object.values(qty).reduce((a, b) => a + b, 0);

  function bump(key: string, delta: number) {
    setQty((q) => {
      const next = Math.max(0, Math.min(20, (q[key] ?? 0) + delta));
      return { ...q, [key]: next };
    });
  }

  function startCheckout() {
    if (!user) { nav("/auth"); return; }
    if (totalQty === 0) return toast.error("Select at least one ticket");
    setContactOpen(true);
  }

  async function confirmCheckout() {
    if (!contact.name.trim() || !contact.email.trim() || !contact.phone.trim()) {
      return toast.error("Please fill in all contact details");
    }
    setSubmitting(true);
    try {
      const items = TYPES.filter((t) => qty[t.key] > 0).map((t) => ({ type: t.key, quantity: qty[t.key] }));
      const { data, error } = await supabase.functions.invoke("checkout", {
        body: { eventId: id, origin: window.location.origin, items, attendee: contact },
      });
      if (error) throw new Error(error.message || "Checkout failed");
      if (data?.error) throw new Error(data.error);
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Checkout failed");
      setSubmitting(false);
    }
  }

  if (loading) return <Layout><div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div></Layout>;
  if (!event) return <Layout><div className="container mx-auto px-4 py-20 text-center">Event not found.</div></Layout>;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Link to="/events" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" /> All events
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="aspect-[16/9] surface-card rounded-2xl overflow-hidden mb-6">
              {event.poster_url ? (
                <img src={event.poster_url} alt={event.title} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/20 to-accent/10" />
              )}
            </div>
            <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight">{event.title}</h1>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4 text-primary" />{format(new Date(event.event_date), "EEEE, MMM d, yyyy · h:mm a")}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" />{event.venue}</span>
            </div>
            {event.description && <p className="mt-6 text-base text-muted-foreground whitespace-pre-line leading-relaxed">{event.description}</p>}
          </div>

          <aside className="lg:col-span-1">
            <div className="surface-card rounded-2xl p-6 sticky top-24">
              <h2 className="font-display text-xl font-semibold mb-4">Select tickets</h2>
              <div className="space-y-3">
                {TYPES.map((t) => {
                  const price = priceFor(t.key);
                  const max = maxFor(t.key);
                  const available = price > 0 && max > 0;
                  return (
                    <div key={t.key} className={`rounded-xl border border-border p-3 ${!available ? "opacity-50" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">{t.label}</div>
                          <div className="text-xs text-muted-foreground">{t.desc}</div>
                        </div>
                        <div className="font-display text-lg">{fmt(price, { decimals: 0 })}</div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{available ? `${max} max` : "Unavailable"}</span>
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="outline" className="h-8 w-8" disabled={!available || qty[t.key] === 0} onClick={() => bump(t.key, -1)}><Minus className="h-3.5 w-3.5" /></Button>
                          <span className="w-6 text-center font-semibold">{qty[t.key]}</span>
                          <Button size="icon" variant="outline" className="h-8 w-8" disabled={!available || qty[t.key] >= max} onClick={() => bump(t.key, 1)}><Plus className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 pt-5 border-t border-border flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-display text-2xl font-bold">{fmt(total)}</span>
              </div>

              <Button className="w-full mt-4 glow-primary h-11" disabled={submitting || totalQty === 0} onClick={startCheckout}>
                {user ? "Continue to checkout" : "Sign in to checkout"}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">Secure payment by Stripe</p>
            </div>
          </aside>
        </div>
      </div>

      <Dialog open={contactOpen} onOpenChange={(o) => !submitting && setContactOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attendee contact details</DialogTitle>
            <DialogDescription>We'll send tickets and updates to this contact.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Full name</Label>
              <Input id="c-name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Phone</Label>
              <Input id="c-phone" type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={confirmCheckout} disabled={submitting} className="glow-primary">
              {submitting ? <Loader2 className="animate-spin h-4 w-4" /> : `Pay ${fmt(total)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
