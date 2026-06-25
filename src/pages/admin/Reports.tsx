import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, Download, FileDown } from "lucide-react";
import { format } from "date-fns";
import { useCurrency } from "@/hooks/useCurrency";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function Reports() {
  const { format: fmt } = useCurrency();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState("all");
  const [tickets, setTickets] = useState<any[]>([]);

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

  useEffect(() => {
    if (picked === "all") { setTickets([]); return; }
    supabase.from("tickets").select("*, orders(status)").eq("event_id", picked).order("created_at", { ascending: false })
      .then(({ data }) => setTickets(data ?? []));
  }, [picked]);

  const overall = useMemo(() => ({
    tickets: events.reduce((s, e) => s + e.tickets, 0),
    revenue: events.reduce((s, e) => s + e.revenue, 0),
  }), [events]);

  function exportOverallPDF() {
    const doc = new jsPDF();
    doc.setFontSize(20); doc.text("Sales Report", 14, 18);
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`All events · generated ${format(new Date(), "MMM d, yyyy · h:mm a")}`, 14, 25);
    doc.setTextColor(0);
    autoTable(doc, {
      startY: 32,
      head: [["Event", "Date", "Venue", "Status", "Tickets", "Revenue"]],
      body: events.map((e) => [
        e.title, format(new Date(e.event_date), "MMM d, yyyy"), e.venue, e.status, e.tickets, fmt(e.revenue),
      ]),
      foot: [["TOTAL", "", "", "", overall.tickets, fmt(overall.revenue)]],
      headStyles: { fillColor: [99, 102, 241] },
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
      theme: "striped",
    });
    doc.save(`sales-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  }

  function exportEventPDF() {
    const ev = events.find((e) => e.id === picked);
    if (!ev) return;
    const doc = new jsPDF();
    doc.setFontSize(22); doc.text("Event Attendance List", 14, 18);
    doc.setFontSize(14); doc.setTextColor(60); doc.text(ev.title, 14, 27);
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`${ev.venue} · ${format(new Date(ev.event_date), "EEEE MMM d, yyyy · h:mm a")}`, 14, 33);
    doc.setTextColor(0);

    const checkedIn = tickets.filter((t) => t.checked_in).length;
    const revenue = tickets.reduce((s, t) => s + Number(t.price), 0);
    autoTable(doc, {
      startY: 40,
      head: [["Tickets", "Checked in", "Revenue", "Generated"]],
      body: [[tickets.length, checkedIn, fmt(revenue), format(new Date(), "MMM d, h:mm a")]],
      theme: "grid", headStyles: { fillColor: [99, 102, 241] },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 6,
      head: [["#", "Ticket", "Type", "Attendee", "Email", "Phone", "ID/Passport", "Country", "Gender", "Status"]],
      body: tickets.map((t, i) => [
        i + 1, t.ticket_number, String(t.ticket_type).toUpperCase(),
        t.attendee_name || "—", t.attendee_email || "—", t.attendee_phone || "—",
        t.id_number || "—", t.country || "—", t.gender || "—",
        t.checked_in ? "Checked in" : "Pending",
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [99, 102, 241], fontSize: 8 },
      theme: "striped",
      didDrawPage: (data) => {
        const str = `Page ${doc.getNumberOfPages()}`;
        doc.setFontSize(8); doc.setTextColor(150);
        doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 8);
      },
    });

    doc.save(`attendees-${ev.title.replace(/\s+/g, "_")}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Generate sales summary and per-event attendance lists</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={picked} onValueChange={setPicked}>
            <SelectTrigger className="min-w-[220px] h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events — overall</SelectItem>
              {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
            </SelectContent>
          </Select>
          {picked === "all" ? (
            <Button onClick={exportOverallPDF}><FileDown className="mr-1.5 h-4 w-4" /> Sales PDF</Button>
          ) : (
            <Button onClick={exportEventPDF}><Download className="mr-1.5 h-4 w-4" /> Attendance PDF</Button>
          )}
        </div>
      </div>

      {picked === "all" ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <KpiBox label="Events" value={events.length} />
            <KpiBox label="Tickets sold" value={overall.tickets} />
            <KpiBox label="Total revenue" value={fmt(overall.revenue, { decimals: 0 })} />
          </div>
          <div className="surface-card rounded-2xl overflow-hidden">
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
                    <td className="p-3 text-right font-semibold">{fmt(e.revenue)}</td>
                  </tr>
                ))}
                {events.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />No events yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiBox label="Tickets" value={tickets.length} />
            <KpiBox label="Checked in" value={tickets.filter((t) => t.checked_in).length} />
            <KpiBox label="Pending" value={tickets.filter((t) => !t.checked_in).length} />
            <KpiBox label="Revenue" value={fmt(tickets.reduce((s, t) => s + Number(t.price), 0), { decimals: 0 })} />
          </div>
          <div className="surface-card rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3">#</th><th className="p-3">Ticket</th><th className="p-3">Attendee</th>
                  <th className="p-3">Contact</th><th className="p-3">ID / Country</th>
                  <th className="p-3">Type</th><th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t, i) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="p-3 text-muted-foreground">{i + 1}</td>
                    <td className="p-3 font-mono text-xs">{t.ticket_number}</td>
                    <td className="p-3 font-semibold">{t.attendee_name || "—"}<div className="text-xs text-muted-foreground font-normal capitalize">{t.gender || ""}</div></td>
                    <td className="p-3 text-xs text-muted-foreground">{t.attendee_email}<br />{t.attendee_phone}</td>
                    <td className="p-3 text-xs">{t.id_number || "—"}<div className="text-muted-foreground">{t.country || "—"}</div></td>
                    <td className="p-3 capitalize">{t.ticket_type}</td>
                    <td className="p-3">{t.checked_in
                      ? <span className="rounded-full bg-success/15 text-success px-2 py-0.5 text-xs">Checked in</span>
                      : <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs">Pending</span>}</td>
                  </tr>
                ))}
                {tickets.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No attendees for this event.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function KpiBox({ label, value }: { label: string; value: any }) {
  return (
    <div className="surface-card rounded-xl p-5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

export default Reports;
