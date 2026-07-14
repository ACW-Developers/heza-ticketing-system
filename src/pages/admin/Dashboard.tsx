import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/useCurrency";
import { Calendar, Wallet, Ticket, Users, Loader2, TrendingUp, CheckCircle2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, subDays } from "date-fns";
import { RefreshButton } from "@/components/RefreshButton";

const GREEN = "var(--color-primary)";
const GRID = "var(--color-success)";
const PALETTE = [
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-success)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];
const TOOLTIP = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 8px 24px -12px rgba(0,0,0,0.25)",
};

function Stat({ icon: Icon, label, value, hint, accent = "primary" }: any) {
  const tone =
    accent === "success"
      ? "bg-success/10 text-success"
      : accent === "accent"
        ? "bg-accent/30 text-accent-foreground"
        : "bg-primary/10 text-primary";
  return (
    <div className="surface-card rounded-2xl p-5 relative overflow-hidden group">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/5 group-hover:scale-110 transition-transform" />
      <div className="flex items-center justify-between mb-3 relative">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="font-display text-3xl font-bold tracking-tight relative">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground relative">{hint}</div>}
    </div>
  );
}

function Dashboard() {
  const { format: fmt } = useCurrency();
  const [stats, setStats] = useState({
    events: 0,
    tickets: 0,
    revenue: 0,
    attendees: 0,
    upcoming: 0,
    checkedIn: 0,
  });
  const [chart, setChart] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [typeMix, setTypeMix] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: events }, { data: tickets }, { data: orders }] = await Promise.all([
        supabase.from("events").select("id, title, event_date"),
        supabase
          .from("tickets")
          .select("id, event_id, user_id, created_at, price, ticket_type, checked_in"),
        supabase.from("orders").select("total_amount, status, created_at"),
      ]);
      const paid = (orders ?? []).filter((o) => o.status === "paid");
      const revenue = paid.reduce((s, o) => s + Number(o.total_amount), 0);
      const upcoming = (events ?? []).filter((e) => new Date(e.event_date) > new Date()).length;
      const uniq = new Set((tickets ?? []).map((t) => t.user_id)).size;
      const checkedIn = (tickets ?? []).filter((t) => t.checked_in).length;
      setStats({
        events: events?.length ?? 0,
        tickets: tickets?.length ?? 0,
        revenue,
        attendees: uniq,
        upcoming,
        checkedIn,
      });

      const byEvent: Record<string, { name: string; tickets: number; revenue: number }> = {};
      for (const e of events ?? [])
        byEvent[e.id] = { name: e.title.slice(0, 14), tickets: 0, revenue: 0 };
      for (const t of tickets ?? [])
        if (byEvent[t.event_id]) {
          byEvent[t.event_id].tickets++;
          byEvent[t.event_id].revenue += Number(t.price);
        }
      setChart(
        Object.values(byEvent)
          .sort((a, b) => b.tickets - a.tickets)
          .slice(0, 7),
      );

      const days: any[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const key = format(d, "MMM d");
        const dayTickets = (tickets ?? []).filter(
          (t) => format(new Date(t.created_at), "MMM d") === key,
        );
        const dayRevenue = dayTickets.reduce((s, t) => s + Number(t.price), 0);
        days.push({ name: key, tickets: dayTickets.length, revenue: Math.round(dayRevenue) });
      }
      setTrend(days);

      const byType: Record<string, number> = {};
      for (const t of tickets ?? []) byType[t.ticket_type] = (byType[t.ticket_type] ?? 0) + 1;
      setTypeMix(Object.entries(byType).map(([name, value]) => ({ name, value })));

      setLoading(false);
    })();
  }, []);

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  const checkinPct = stats.tickets ? Math.round((stats.checkedIn / stats.tickets) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Overview · {format(new Date(), "EEEE, MMM d · h:mm a")}
          </p>
        </div>
        <RefreshButton />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          icon={Wallet}
          label="Revenue"
          value={fmt(stats.revenue, { decimals: 0 })}
          hint={`${stats.tickets} tickets sold`}
          accent="success"
        />
        <Stat
          icon={Ticket}
          label="Tickets"
          value={stats.tickets}
          hint={`Avg ${fmt(stats.tickets ? stats.revenue / stats.tickets : 0, { decimals: 0 })}`}
        />
        <Stat
          icon={Calendar}
          label="Events"
          value={stats.events}
          hint={`${stats.upcoming} upcoming`}
          accent="accent"
        />
        <Stat
          icon={Users}
          label="Attendees"
          value={stats.attendees}
          hint={`${checkinPct}% checked in`}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="surface-card rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="font-display text-lg font-semibold">Sales · last 14 days</h3>
              <p className="text-xs text-muted-foreground">Tickets issued per day</p>
            </div>
            <span className="text-xs text-success bg-success/10 rounded-full px-2 py-1 inline-flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> live
            </span>
          </div>
          <div className="h-72 mt-3">
            <ResponsiveContainer>
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GREEN} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 6"
                  stroke={GRID}
                  strokeOpacity={0.3}
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="var(--color-muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: GRID, strokeOpacity: 0.4 }}
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: GRID, strokeOpacity: 0.4 }}
                />
                <Tooltip contentStyle={TOOLTIP} />
                <Area
                  type="monotone"
                  dataKey="tickets"
                  stroke={GREEN}
                  strokeWidth={2.5}
                  fill="url(#dashGreen)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card rounded-2xl p-6">
          <h3 className="font-display text-lg font-semibold">Ticket mix</h3>
          <p className="text-xs text-muted-foreground mb-3">Share by tier</p>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={typeMix}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {typeMix.map((_, i) => (
                    <Cell
                      key={i}
                      fill={PALETTE[i % PALETTE.length]}
                      stroke="var(--color-card)"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 11, textTransform: "capitalize" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="surface-card rounded-2xl p-6 lg:col-span-2">
          <h3 className="font-display text-lg font-semibold">Top events by tickets sold</h3>
          <p className="text-xs text-muted-foreground mb-3">Best performers</p>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid
                  strokeDasharray="4 6"
                  stroke={GRID}
                  strokeOpacity={0.3}
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="var(--color-muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: GRID, strokeOpacity: 0.4 }}
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: GRID, strokeOpacity: 0.4 }}
                />
                <Tooltip
                  contentStyle={TOOLTIP}
                  cursor={{ fill: "var(--color-muted)", opacity: 0.3 }}
                />
                <Bar dataKey="tickets" radius={[8, 8, 0, 0]}>
                  {chart.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card rounded-2xl p-6 flex flex-col">
          <h3 className="font-display text-lg font-semibold">Check-in rate</h3>
          <p className="text-xs text-muted-foreground mb-4">Door progress</p>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative h-44 w-44">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="var(--color-muted)"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke={GREEN}
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${(checkinPct / 100) * 314} 314`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-4xl font-bold">{checkinPct}%</span>
                <span className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-success" /> attended
                </span>
              </div>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              {stats.checkedIn} of {stats.tickets} tickets
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
