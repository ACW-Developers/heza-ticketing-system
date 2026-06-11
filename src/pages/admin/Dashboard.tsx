
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/useCurrency";
import { Calendar, Wallet, Ticket, Users, Loader2, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, LineChart, Line } from "recharts";
import { format, subDays } from "date-fns";
import { RefreshButton } from "@/components/RefreshButton";

function Stat({ icon: Icon, label, value, hint }: any) {
  return (
    <div className="surface-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="font-display text-3xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Dashboard() {
  const { format: fmt } = useCurrency();
  const [stats, setStats] = useState({ events: 0, tickets: 0, revenue: 0, attendees: 0, upcoming: 0 });
  const [chart, setChart] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: events }, { data: tickets }, { data: orders }] = await Promise.all([
        supabase.from("events").select("id, title, event_date"),
        supabase.from("tickets").select("id, event_id, user_id, created_at, price"),
        supabase.from("orders").select("total_amount, status"),
      ]);
      const paid = (orders ?? []).filter((o) => o.status === "paid");
      const revenue = paid.reduce((s, o) => s + Number(o.total_amount), 0);
      const upcoming = (events ?? []).filter((e) => new Date(e.event_date) > new Date()).length;
      const uniq = new Set((tickets ?? []).map((t) => t.user_id)).size;
      setStats({ events: events?.length ?? 0, tickets: tickets?.length ?? 0, revenue, attendees: uniq, upcoming });

      const byEvent: Record<string, { name: string; tickets: number }> = {};
      for (const e of events ?? []) byEvent[e.id] = { name: e.title.slice(0, 14), tickets: 0 };
      for (const t of tickets ?? []) if (byEvent[t.event_id]) byEvent[t.event_id].tickets++;
      setChart(Object.values(byEvent).slice(0, 8));

      // 7-day trend
      const days: any[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const key = format(d, "MMM d");
        const count = (tickets ?? []).filter((t) =>
          format(new Date(t.created_at), "MMM d") === key
        ).length;
        days.push({ name: key, tickets: count });
      }
      setTrend(days);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Overview · {format(new Date(), "EEEE, MMM d · h:mm a")}</p>
        </div>
        <RefreshButton />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat icon={Calendar} label="Events" value={stats.events} hint={`${stats.upcoming} upcoming`} />
        <Stat icon={Ticket} label="Tickets" value={stats.tickets} />
        <Stat icon={Wallet} label="Revenue" value={fmt(stats.revenue, { decimals: 0 })} />
        <Stat icon={Users} label="Attendees" value={stats.attendees} />
        <Stat icon={TrendingUp} label="Avg ticket" value={fmt(stats.tickets ? stats.revenue / stats.tickets : 0, { decimals: 0 })} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="surface-card rounded-xl p-6">
          <h3 className="font-display text-lg font-semibold mb-1">Sales - last 7 days</h3>
          <p className="text-xs text-muted-foreground mb-4">Tickets issued per day</p>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="tickets" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card rounded-xl p-6">
          <h3 className="font-display text-lg font-semibold mb-1">Tickets by event</h3>
          <p className="text-xs text-muted-foreground mb-4">Top events</p>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Bar dataKey="tickets" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
