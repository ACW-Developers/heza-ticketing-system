
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Download } from "lucide-react";
import { format } from "date-fns";

function Reports() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: evts } = await supabase.from("events").select("*").order("event_date", { ascending: false });
      const { data: tix } = await supabase.from("tickets").select("event_id, price");
      const enriched = (evts ?? []).map((e) => {
        const ts = (tix ?? []).filter((t) => t.event_id === e.id);
        return { ...e, tickets: ts.length, revenue: ts.reduce((s, t) => s + Number(t.price), 0) };
      });
      setEvents(enriched);
      setLoading(false);
    })();
  }, []);

  function exportAll() {
    const rows = [["Event", "Date", "Venue", "Status", "Tickets", "Revenue"]];
    for (const e of events) rows.push([e.title, format(new Date(e.event_date), "yyyy-MM-dd"), e.venue, e.status, String(e.tickets), e.revenue.toFixed(2)]);
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Sales summary across all events</p>
        </div>
        <Button onClick={exportAll}><Download className="mr-1.5 h-4 w-4" /> Export CSV</Button>
      </div>

      <div className="surface-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-3">Event</th><th className="p-3">Date</th><th className="p-3">Status</th><th className="p-3 text-right">Tickets</th><th className="p-3 text-right">Revenue</th></tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="p-3 font-semibold">{e.title}<div className="text-xs text-muted-foreground font-normal">{e.venue}</div></td>
                <td className="p-3 text-muted-foreground">{format(new Date(e.event_date), "MMM d, yyyy")}</td>
                <td className="p-3"><span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs capitalize">{e.status}</span></td>
                <td className="p-3 text-right">{e.tickets}</td>
                <td className="p-3 text-right font-semibold">${e.revenue.toFixed(2)}</td>
              </tr>
            ))}
            {events.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />No events yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Reports;
