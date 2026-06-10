import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, MapPin, Loader2, Download, Ticket as TicketIcon } from "lucide-react";
import { format } from "date-fns";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";

function MyTickets() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const ticketRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!loading && !user) nav("/auth");
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

  async function downloadTicket(t: any) {
    const el = ticketRefs.current[t.id];
    if (!el) return;
    try {
      const dataUrl = await toPng(el, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `ticket-${t.ticket_number}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Ticket download failed", err);
    }
  }

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
          <div className="grid sm:grid-cols-2 gap-6">
            {rows.map((t) => (
              <div key={t.id} className="space-y-2">
                <div
                  ref={(el) => { ticketRefs.current[t.id] = el; }}
                  className="relative flex rounded-2xl overflow-hidden shadow-xl bg-white text-neutral-900"
                  style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
                >
                  {/* Left accent bar */}
                  <div className="w-2 bg-gradient-to-b from-primary via-accent to-primary" />

                  {/* Main body */}
                  <div className="flex-1 p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500 font-semibold">
                        <TicketIcon className="h-3.5 w-3.5" />
                        Admit One
                      </div>
                      <span className="rounded-full bg-neutral-900 text-white px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-bold">
                        {t.ticket_type}
                      </span>
                    </div>

                    <h3 className="font-display text-2xl font-extrabold mt-3 leading-tight text-neutral-900">
                      {t.events?.title}
                    </h3>

                    <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Date</div>
                        <div className="mt-1 flex items-center gap-1.5 text-neutral-800 font-medium">
                          <Calendar className="h-3.5 w-3.5 text-neutral-500" />
                          {t.events?.event_date && format(new Date(t.events.event_date), "MMM d, yyyy · h:mm a")}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Venue</div>
                        <div className="mt-1 flex items-center gap-1.5 text-neutral-800 font-medium">
                          <MapPin className="h-3.5 w-3.5 text-neutral-500" />
                          {t.events?.venue}
                        </div>
                      </div>
                      {t.attendee_name && (
                        <div className="col-span-2">
                          <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Attendee</div>
                          <div className="mt-1 text-neutral-800 font-medium">{t.attendee_name}</div>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 pt-3 border-t border-dashed border-neutral-200">
                      <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Ticket No.</div>
                      <div className="mt-0.5 font-mono text-[11px] text-neutral-700 break-all">{t.ticket_number}</div>
                    </div>
                  </div>

                  {/* Perforated divider */}
                  <div className="relative flex flex-col items-center justify-center px-1">
                    <div className="absolute -top-2 h-4 w-4 rounded-full bg-background" />
                    <div className="h-full w-px border-l border-dashed border-neutral-300" />
                    <div className="absolute -bottom-2 h-4 w-4 rounded-full bg-background" />
                  </div>

                  {/* QR stub */}
                  <div className="w-36 bg-neutral-50 p-3 flex flex-col items-center justify-center">
                    {qrs[t.id] && <img src={qrs[t.id]} alt="QR" className="w-full" />}
                    <span className="mt-1.5 text-[9px] uppercase tracking-[0.15em] text-neutral-500 font-semibold">Scan at entry</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => downloadTicket(t)}
                >
                  <Download className="h-4 w-4 mr-2" /> Download ticket
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default MyTickets;
