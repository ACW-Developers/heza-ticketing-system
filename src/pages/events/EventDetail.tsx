import { useNavigate, Link, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  const { id } = useParams() as Record<string, string>;
  const { user } = useAuth();
  const { format: fmt } = useCurrency();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState<Record<string, number>>({
    children: 0,
    regular: 0,
    vip: 0,
    vvip: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contact, setContact] = useState({
    name: "",
    email: "",
    phone: "",
    id_number: "",
    country: "",
    gender: "",
    notes: "",
    agree: false,
  });

  useEffect(() => {
    supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setEvent(data);
        setLoading(false);
      });
  }, [id]);

  // Prefill contact from profile
  useEffect(() => {
    if (!user) return;
    // Immediately seed email from the signed-in account so users always
    // see their login email pre-filled before profile data arrives.
    setContact((c) => ({
      ...c,
      email: c.email || user.email || "",
      name: c.name || (user.user_metadata?.full_name as string | undefined) || "",
      phone: c.phone || (user.user_metadata?.phone as string | undefined) || "",
    }));
    supabase
      .from("profiles")
      .select("full_name, phone, email")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setContact((c) => ({
          ...c,
          name: data?.full_name ?? c.name ?? "",
          email: data?.email ?? user.email ?? c.email ?? "",
          phone: data?.phone ?? c.phone ?? "",
        }));
      });
  }, [user]);

  function priceFor(t: string) {
    return Number(event?.[`price_${t}`] ?? 0);
  }
  function maxFor(t: string) {
    return Number(event?.[`qty_${t}`] ?? 0);
  }
  const total = TYPES.reduce((s, t) => s + qty[t.key] * priceFor(t.key), 0);
  const totalQty = Object.values(qty).reduce((a, b) => a + b, 0);

  function bump(key: string, delta: number) {
    setQty((q) => {
      const next = Math.max(0, Math.min(20, (q[key] ?? 0) + delta));
      return { ...q, [key]: next };
    });
  }

  // Restore selection + auto-open checkout after returning from /auth
  useEffect(() => {
    if (!event) return;
    const restore = searchParams.get("checkout");
    if (restore !== "1") return;
    const restored: Record<string, number> = { children: 0, regular: 0, vip: 0, vvip: 0 };
    TYPES.forEach((t) => {
      const v = parseInt(searchParams.get(t.key) || "0", 10);
      if (!isNaN(v) && v > 0) restored[t.key] = Math.min(v, maxFor(t.key));
    });
    const hasAny = Object.values(restored).some((n) => n > 0);
    if (hasAny) setQty(restored);
    // strip params from URL to avoid re-trigger
    const next = new URLSearchParams(searchParams);
    next.delete("checkout");
    TYPES.forEach((t) => next.delete(t.key));
    setSearchParams(next, { replace: true });
    if (user && hasAny) setContactOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, user]);

  function startCheckout() {
    if (totalQty === 0) return toast.error("Select at least one ticket");
    if (!user) {
      // Preserve selection and return path so user comes back to checkout after login
      const params = new URLSearchParams({ checkout: "1" });
      TYPES.forEach((t) => {
        if (qty[t.key] > 0) params.set(t.key, String(qty[t.key]));
      });
      const redirect = `/events/${id}?${params.toString()}`;
      nav(`/auth?redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    setContactOpen(true);
  }

  async function confirmCheckout() {
    if (!contact.name.trim() || !contact.email.trim() || !contact.phone.trim()) {
      return toast.error("Please fill in your name, email and phone");
    }
    if (!contact.agree) return toast.error("Please accept the terms to continue");
    setSubmitting(true);
    const items = TYPES.filter((t) => qty[t.key] > 0).map((t) => ({
      type: t.key,
      quantity: qty[t.key],
    }));
    nav("/checkout/mpesa", {
      state: {
        eventId: id,
        eventTitle: event?.title,
        items,
        attendee: contact,
        total,
      },
    });
  }

  if (loading)
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" />
        </div>
      </Layout>
    );
  if (!event)
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">Event not found.</div>
      </Layout>
    );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Link
          to="/events"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> All events
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <EventGallery
              cover={event.poster_url}
              urls={event.poster_urls ?? []}
              title={event.title}
            />

            <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
              {event.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-primary" />
                {format(new Date(event.event_date), "EEEE, MMM d, yyyy · h:mm a")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-primary" />
                {event.venue}
              </span>
            </div>
            {event.description && (
              <p className="mt-6 text-base text-muted-foreground whitespace-pre-line leading-relaxed">
                {event.description}
              </p>
            )}
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
                    <div
                      key={t.key}
                      className={`rounded-xl border border-border p-3 ${!available ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">{t.label}</div>
                          <div className="text-xs text-muted-foreground">{t.desc}</div>
                        </div>
                        <div className="font-display text-lg">{fmt(price, { decimals: 0 })}</div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {available ? `${max} max` : "Unavailable"}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            disabled={!available || qty[t.key] === 0}
                            onClick={() => bump(t.key, -1)}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="w-6 text-center font-semibold">{qty[t.key]}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            disabled={!available || qty[t.key] >= max}
                            onClick={() => bump(t.key, 1)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
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

              <Button
                className="w-full mt-4 glow-primary h-11"
                disabled={totalQty === 0}
                onClick={startCheckout}
              >
                Checkout · Pay with M-Pesa
              </Button>
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-center">
                <p className="text-xs font-semibold text-foreground">Manual M-Pesa payment</p>
                <p className="text-[10px] text-muted-foreground">
                  Send to <span className="font-mono">0702370395</span> (Omariba Jacinta). Enter your
                  transaction code on the next screen — tickets activate once confirmed.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <Dialog open={contactOpen} onOpenChange={(o) => !submitting && setContactOpen(o)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attendee details</DialogTitle>
            <DialogDescription>
              These details are printed on your ticket and used for entry verification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">Full name *</Label>
                <Input
                  id="c-name"
                  value={contact.name}
                  onChange={(e) => setContact({ ...contact, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-phone">Phone *</Label>
                <Input
                  id="c-phone"
                  type="tel"
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">Email *</Label>
              <Input
                id="c-email"
                type="email"
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-id">National ID / Passport *</Label>
                <Input
                  id="c-id"
                  value={contact.id_number}
                  onChange={(e) => setContact({ ...contact, id_number: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-country">Country *</Label>
                <Input
                  id="c-country"
                  value={contact.country}
                  onChange={(e) => setContact({ ...contact, country: e.target.value })}
                  placeholder="e.g. Rwanda"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-gender">Gender</Label>
              <Select
                value={contact.gender}
                onValueChange={(v) => setContact({ ...contact, gender: v })}
              >
                <SelectTrigger id="c-gender">
                  <SelectValue placeholder="Select (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer_not">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-notes">Special requests (optional)</Label>
              <Textarea
                id="c-notes"
                rows={2}
                value={contact.notes}
                onChange={(e) => setContact({ ...contact, notes: e.target.value })}
                placeholder="Accessibility needs, dietary, etc."
              />
            </div>
            <label className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                checked={contact.agree}
                onChange={(e) => setContact({ ...contact, agree: e.target.checked })}
              />
              <span>
                I confirm the details are correct and accept the event terms and refund policy.
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={confirmCheckout} disabled={submitting} className="glow-primary">
              {submitting ? "Please wait…" : "Continue to payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function EventGallery({
  cover,
  urls,
  title,
}: {
  cover: string | null;
  urls: string[];
  title: string;
}) {
  const all = Array.from(new Set([cover, ...urls].filter(Boolean) as string[]));
  const [active, setActive] = useState(all[0] ?? "");
  useEffect(() => {
    if (all[0]) setActive(all[0]); /* eslint-disable-next-line */
  }, [cover, urls.join("|")]);
  if (all.length === 0) {
    return (
      <div className="h-[420px] sm:h-auto sm:aspect-[16/9] surface-card rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-primary/20 to-accent/10" />
    );
  }
  return (
    <div className="mb-6">
      <div className="h-[420px] sm:h-auto sm:aspect-[16/9] surface-card rounded-2xl overflow-hidden bg-muted/40 flex items-center justify-center">
        <img
          src={active}
          alt={title}
          className="h-full w-full object-contain sm:object-cover"
        />
      </div>
      {all.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {all.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setActive(u)}
              className={`shrink-0 rounded-lg overflow-hidden border-2 transition ${active === u ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}
            >
              <img src={u} alt="" className="h-16 w-24 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default EventDetail;
