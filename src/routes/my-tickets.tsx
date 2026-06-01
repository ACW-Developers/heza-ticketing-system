import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, MapPin, Loader2 } from "lucide-react";
import { format } from "date-fns";
import QRCode from "qrcode";

export const Route = createFileRoute("/my-tickets")({
  component: MyTickets,
  head: () => ({ meta: [{ title: "My Tickets - Smarticketing" }] }),
});

function MyTickets() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [qrs, setQrs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("tickets")
        .select("*, events(title, event_date, venue, poster_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setRows(data ?? []);
      const map: Record<string, string> = {};
      for (const t of data ?? []) {
        map[t.id] = await QRCode.toDataURL(t.ticket_number, { width: 160, margin: 1, color: { dark: "#0a0e1a", light: "#ffffff" } });
      }
      setQrs(map);
      setBusy(false);
    })();
  }, [user]);

  if (busy) return <Layout><div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div></Layout>;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <h1 className="font-display text-4xl font-bold mb-2">My tickets</h1>
        <p className="text-muted-foreground mb-8">Your QR is your entry. Show it at the door.</p>
        {rows.length === 0 ? (
          <div className="surface-card rounded-2xl p-10 text-center text-muted-foreground">
            No tickets yet. <Link to="/events" className="text-primary">Browse events</Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {rows.map((t) => (
              <div
                key={t.id}
                className="group relative rounded-2xl overflow-hidden flex border border-border/60 shadow-lg hover:shadow-2xl hover:-translate-y-0.5 transition-all"
              >
                {/* Background: event poster or gradient */}
                <div className="absolute inset-0">
                  {t.events?.poster_url ? (
                    <img
                      src={t.events.poster_url}
                      alt=""
                      className="h-full w-full object-cover scale-105 group-hover:scale-110 transition-transform duration-700"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-primary/60 via-accent/40 to-primary/30" />
                  )}
                </div>
                {/* Dark overlay + mesh pattern for legibility */}
                <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/85 to-background/70" />
                <div
                  className="absolute inset-0 opacity-30 mix-blend-overlay"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 20% 20%, hsl(var(--primary)/0.6) 0px, transparent 40%), radial-gradient(circle at 80% 80%, hsl(var(--accent)/0.5) 0px, transparent 45%)",
                  }}
                />

                {/* Content */}
                <div className="relative flex-1 p-5">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 ring-1 ring-primary/30 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-primary font-bold">
                    {t.ticket_type}
                  </div>
                  <h3 className="font-display text-lg font-bold mt-2 line-clamp-2 drop-shadow-sm">
                    {t.events?.title}
                  </h3>
                  <div className="mt-3 space-y-1 text-xs text-foreground/80">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      {t.events?.event_date && format(new Date(t.events.event_date), "MMM d, h:mm a")}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      {t.events?.venue}
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] font-mono break-all text-foreground/60">
                    {t.ticket_number}
                  </div>
                </div>

                {/* Perforated divider */}
                <div className="relative w-px my-4 bg-border [mask-image:repeating-linear-gradient(to_bottom,black_0_6px,transparent_6px_12px)]" />

                {/* QR stub */}
                <div className="relative w-32 bg-white/95 backdrop-blur p-2 flex flex-col items-center justify-center">
                  {qrs[t.id] && <img src={qrs[t.id]} alt="QR" className="w-full" />}
                  <span className="mt-1 text-[9px] uppercase tracking-wider text-black/60 font-semibold">Scan at entry</span>
                </div>

                {/* Notches */}
                <div className="absolute left-[calc(100%-8.5rem)] -translate-x-1/2 -top-2 h-4 w-4 rounded-full bg-background border border-border/60" />
                <div className="absolute left-[calc(100%-8.5rem)] -translate-x-1/2 -bottom-2 h-4 w-4 rounded-full bg-background border border-border/60" />
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
