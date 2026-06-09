
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/admin/attendees")({ component: Attendees });

function Attendees() {
  const [events, setEvents] = useState<any[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("events").select("id, title, event_date").order("event_date", { ascending: false })
      .then(({ data }) => {
        setEvents(data ?? []);
        if (data?.[0]) setEventId(data[0].id);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!eventId) return;
    supabase.from("tickets").select("*, orders(status, total_amount, stripe_session_id)").eq("event_id", eventId).order("created_at", { ascending: false })
      .then(({ data }) => setTickets(data ?? []));
  }, [eventId]);

  function downloadCSV() {
    const event = events.find((e) => e.id === eventId);
    const headers = ["Ticket #", "Type", "Attendee", "Email", "Phone", "Price", "Payment", "Issued"];
    const rows = tickets.map((t) => [
      t.ticket_number, t.ticket_type, t.attendee_name ?? "", t.attendee_email ?? "",
      t.attendee_phone ?? "", t.price, t.orders?.status ?? "", format(new Date(t.created_at), "yyyy-MM-dd HH:mm"),
    ]);
    const totalRev = tickets.reduce((s, t) => s + Number(t.price), 0);
    rows.push([], ["TOTAL TICKETS", String(tickets.length)], ["TOTAL REVENUE", `$${totalRev.toFixed(2)}`]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `attendees-${event?.title?.replace(/\s+/g, "_")}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  const totalRev = tickets.reduce((s, t) => s + Number(t.price), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h1 className="font-display text-3xl font-bold">Attendees</h1>
        <div className="flex gap-2">
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          <Button onClick={downloadCSV} disabled={!tickets.length}><Download className="mr-1 h-4 w-4" /> Report</Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="surface-card rounded-2xl p-5"><div className="text-sm text-muted-foreground">Tickets sold</div><div className="font-display text-3xl font-bold">{tickets.length}</div></div>
        <div className="surface-card rounded-2xl p-5"><div className="text-sm text-muted-foreground">Revenue</div><div className="font-display text-3xl font-bold">${totalRev.toFixed(2)}</div></div>
        <div className="surface-card rounded-2xl p-5"><div className="text-sm text-muted-foreground">Unique attendees</div><div className="font-display text-3xl font-bold">{new Set(tickets.map((t) => t.user_id)).size}</div></div>
      </div>

      <div className="surface-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-3">Ticket #</th><th className="p-3">Type</th><th className="p-3">Attendee</th><th className="p-3">Contact</th><th className="p-3">Price</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="p-3 font-mono text-xs">{t.ticket_number}</td>
                <td className="p-3 capitalize">{t.ticket_type}</td>
                <td className="p-3">{t.attendee_name ?? "-"}</td>
                <td className="p-3 text-muted-foreground text-xs">{t.attendee_email}<br/>{t.attendee_phone}</td>
                <td className="p-3">${Number(t.price).toFixed(2)}</td>
                <td className="p-3"><span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs">{t.orders?.status ?? "-"}</span></td>
              </tr>
            ))}
            {tickets.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">No tickets sold yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Attendees;
