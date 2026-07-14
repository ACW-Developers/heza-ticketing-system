import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Download, Users, CheckCircle2, Clock, Globe } from "lucide-react";
import { format } from "date-fns";
import { useCurrency } from "@/hooks/useCurrency";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const COLORS = [
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-success)",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
];

function tally(arr: any[], key: (x: any) => string | null | undefined, top = 8) {
  const map: Record<string, number> = {};
  for (const x of arr) {
    const k = (key(x) || "Unknown").toString();
    map[k] = (map[k] ?? 0) + 1;
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, top);
}

function Attendees() {
  const { format: fmt } = useCurrency();
  const [events, setEvents] = useState<any[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("events")
      .select("id, title, event_date")
      .order("event_date", { ascending: false })
      .then(({ data }) => {
        setEvents(data ?? []);
        if (data?.[0]) setEventId(data[0].id);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!eventId) return;
    supabase
      .from("tickets")
      .select("*, orders(status, total_amount)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setTickets(data ?? []));
  }, [eventId]);

  const stats = useMemo(
    () => ({
      total: tickets.length,
      checkedIn: tickets.filter((t) => t.checked_in).length,
      revenue: tickets.reduce((s, t) => s + Number(t.price), 0),
      unique: new Set(tickets.map((t) => t.user_id)).size,
    }),
    [tickets],
  );

  const byType = useMemo(() => tally(tickets, (t) => t.ticket_type), [tickets]);
  const byCountry = useMemo(() => tally(tickets, (t) => t.country), [tickets]);
  const byGender = useMemo(() => tally(tickets, (t) => t.gender), [tickets]);
  const checkinProgress = useMemo(
    () => [
      { name: "Checked in", value: stats.checkedIn },
      { name: "Pending", value: Math.max(0, stats.total - stats.checkedIn) },
    ],
    [stats],
  );
  const byHour = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const t of tickets) {
      const k = format(new Date(t.created_at), "MMM d");
      buckets[k] = (buckets[k] ?? 0) + 1;
    }
    return Object.entries(buckets)
      .map(([name, value]) => ({ name, value }))
      .slice(-14);
  }, [tickets]);

  function downloadCSV() {
    const event = events.find((e) => e.id === eventId);
    const headers = [
      "#",
      "Ticket",
      "Type",
      "Name",
      "Email",
      "Phone",
      "ID/Passport",
      "Country",
      "Gender",
      "Price",
      "Checked in",
      "Created",
    ];
    const rows = tickets.map((t, i) => [
      i + 1,
      t.ticket_number,
      t.ticket_type,
      t.attendee_name ?? "",
      t.attendee_email ?? "",
      t.attendee_phone ?? "",
      t.id_number ?? "",
      t.country ?? "",
      t.gender ?? "",
      t.price,
      t.checked_in ? "Yes" : "No",
      format(new Date(t.created_at), "yyyy-MM-dd HH:mm"),
    ]);
    rows.push(
      [] as any,
      ["TOTAL", String(tickets.length)] as any,
      ["REVENUE", fmt(stats.revenue)] as any,
    );
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `attendees-${event?.title?.replace(/\s+/g, "_")}.csv`;
    a.click();
  }

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Attendees</h1>
          <p className="text-sm text-muted-foreground">Full guest list with demographic insights</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger className="min-w-[220px] h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={downloadCSV} disabled={!tickets.length}>
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Users} label="Tickets sold" value={stats.total} />
        <Kpi
          icon={CheckCircle2}
          label="Checked in"
          value={stats.checkedIn}
          hint={`${stats.total ? Math.round((stats.checkedIn / stats.total) * 100) : 0}%`}
        />
        <Kpi icon={Clock} label="Pending" value={stats.total - stats.checkedIn} />
        <Kpi icon={Globe} label="Unique buyers" value={stats.unique} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <ChartCard title="Ticket types">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={byType}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
              >
                {byType.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Check-in progress">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={checkinProgress}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={75}
              >
                <Cell fill="var(--color-success)" />
                <Cell fill="var(--color-muted)" />
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Gender">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={byGender} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>
                {byGender.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="surface-card rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Ticket #</th>
              <th className="p-3">Attendee</th>
              <th className="p-3">Contact</th>
              <th className="p-3">ID / Country</th>
              <th className="p-3">Type</th>
              <th className="p-3">Price</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-t border-border hover:bg-muted/20">
                <td className="p-3 font-mono text-xs">{t.ticket_number}</td>
                <td className="p-3 font-semibold">
                  {t.attendee_name ?? "-"}
                  <div className="text-xs text-muted-foreground font-normal capitalize">
                    {t.gender || ""}
                  </div>
                </td>
                <td className="p-3 text-muted-foreground text-xs">
                  {t.attendee_email}
                  <br />
                  {t.attendee_phone}
                </td>
                <td className="p-3 text-xs">
                  {t.id_number || "—"}
                  <div className="text-muted-foreground">{t.country || "—"}</div>
                </td>
                <td className="p-3 capitalize">{t.ticket_type}</td>
                <td className="p-3">{fmt(Number(t.price))}</td>
                <td className="p-3">
                  {t.checked_in ? (
                    <span className="rounded-full bg-success/15 text-success px-2 py-0.5 text-xs">
                      Checked in
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs">
                      Pending
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-muted-foreground">
                  No tickets sold yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }: any) {
  return (
    <div className="surface-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="font-display text-2xl font-bold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: any }) {
  return (
    <div className="surface-card rounded-2xl p-5">
      <h3 className="font-display text-base font-semibold mb-3">{title}</h3>
      <div className="h-60">{children}</div>
    </div>
  );
}

export default Attendees;
