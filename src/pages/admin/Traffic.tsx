import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  BarChart3,
  Download,
  Monitor,
  Smartphone,
  Globe,
  MousePointerClick,
  Clock,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  RadialBarChart,
  RadialBar,
  LineChart,
  Line,
} from "recharts";
import { format, subDays } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const GREEN = "var(--color-primary)";
const GRID = "var(--color-success)";
const COLORS = [
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-success)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "#10b981",
  "#84cc16",
];

const TOOLTIP_STYLE = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 8px 24px -12px rgba(0,0,0,0.25)",
};

function tally<T>(arr: T[], key: (x: T) => string | null | undefined, top = 8) {
  const map: Record<string, number> = {};
  for (const x of arr) {
    const k = key(x) || "Unknown";
    map[k] = (map[k] ?? 0) + 1;
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, top);
}

function Traffic() {
  const [views, setViews] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: pv }, { data: ev }] = await Promise.all([
        supabase
          .from("page_views")
          .select("*")
          .gte("created_at", subDays(new Date(), 30).toISOString())
          .limit(10000),
        supabase.from("events").select("id, title"),
      ]);
      setViews(pv ?? []);
      setEvents(ev ?? []);
      setLoading(false);
    })();
  }, []);

  const eventTitle = (id: string | null) => events.find((e) => e.id === id)?.title || "—";

  const trend = useMemo(() => {
    const days: any[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const k = format(d, "MMM d");
      const dayViews = views.filter((v) => format(new Date(v.created_at), "MMM d") === k);
      days.push({
        name: k,
        views: dayViews.length,
        unique: new Set(dayViews.map((v) => v.user_id || v.user_agent)).size,
      });
    }
    return days;
  }, [views]);

  const devices = useMemo(() => tally(views, (v) => v.device || "desktop"), [views]);
  const browsers = useMemo(() => tally(views, (v) => v.browser), [views]);
  const oses = useMemo(() => tally(views, (v) => v.os), [views]);
  const topPaths = useMemo(() => tally(views, (v) => v.path), [views]);
  const topEvents = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of views.filter((x) => x.event_id)) {
      const k = eventTitle(v.event_id);
      map[k] = (map[k] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views, events]);

  // Hourly distribution (0–23) — visits by hour of day
  const hourly = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ name: `${h}:00`, visits: 0 }));
    for (const v of views) {
      const h = new Date(v.created_at).getHours();
      buckets[h].visits++;
    }
    return buckets;
  }, [views]);

  // Weekday distribution
  const weekday = useMemo(() => {
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const buckets = labels.map((name) => ({ name, visits: 0 }));
    for (const v of views) buckets[new Date(v.created_at).getDay()].visits++;
    return buckets;
  }, [views]);

  // Engagement radial: % of visits on event pages
  const engagement = useMemo(() => {
    const evShare = views.length
      ? (views.filter((v) => v.event_id).length / views.length) * 100
      : 0;
    const mobile = views.length
      ? (views.filter((v) => v.device === "mobile").length / views.length) * 100
      : 0;
    const repeat = views.length
      ? (1 - new Set(views.map((v) => v.user_id || v.user_agent)).size / views.length) * 100
      : 0;
    return [
      { name: "Event focus", value: Math.round(evShare), fill: "var(--color-primary)" },
      { name: "Mobile", value: Math.round(mobile), fill: "var(--color-accent)" },
      { name: "Returning", value: Math.round(repeat), fill: "var(--color-success)" },
    ];
  }, [views]);

  const totalViews = views.length;
  const uniqueVisitors = new Set(views.map((v) => v.user_id || v.user_agent)).size;
  const eventViews = views.filter((v) => v.event_id).length;
  const mobileShare = views.length
    ? Math.round((views.filter((v) => v.device === "mobile").length / views.length) * 100)
    : 0;

  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Traffic Report", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Generated ${format(new Date(), "MMM d, yyyy · h:mm a")} · last 30 days`, 14, 25);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 32,
      head: [["Metric", "Value"]],
      body: [
        ["Total page views", String(totalViews)],
        ["Unique visitors", String(uniqueVisitors)],
        ["Event page views", String(eventViews)],
        ["Mobile share", `${mobileShare}%`],
      ],
      theme: "striped",
      headStyles: { fillColor: [34, 197, 94] },
    });

    const section = (title: string, rows: any[]) => {
      doc.addPage();
      doc.setFontSize(14);
      doc.text(title, 14, 16);
      autoTable(doc, {
        startY: 22,
        head: [["Name", "Visits"]],
        body: rows.map((r) => [r.name, r.value]),
        theme: "grid",
      });
    };
    section("Top pages", topPaths);
    section("Top events viewed", topEvents);
    section("Devices", devices);
    section("Browsers", browsers);
    section("Operating systems", oses);

    doc.save(`traffic-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  }

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" /> Traffic
          </h1>
          <p className="text-sm text-muted-foreground">Last 30 days of visitor activity</p>
        </div>
        <Button onClick={exportPDF}>
          <Download className="mr-1.5 h-4 w-4" /> Download PDF report
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={MousePointerClick} label="Page views" value={totalViews.toLocaleString()} />
        <Kpi icon={Globe} label="Unique visitors" value={uniqueVisitors.toLocaleString()} />
        <Kpi icon={Smartphone} label="Mobile" value={`${mobileShare}%`} />
        <Kpi icon={Monitor} label="Event page views" value={eventViews.toLocaleString()} />
      </div>

      {/* Hero area chart with green marginal grid lines */}
      <div className="surface-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-lg font-semibold">Daily traffic</h3>
          <span className="text-xs text-muted-foreground">Visits & unique visitors</span>
        </div>
        <div className="h-80">
          <ResponsiveContainer>
            <AreaChart data={trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GREEN} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 6" stroke={GRID} strokeOpacity={0.35} />
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
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="views"
                stroke={GREEN}
                fill="url(#gv)"
                strokeWidth={2.5}
              />
              <Area
                type="monotone"
                dataKey="unique"
                stroke="var(--color-accent)"
                fill="url(#gu)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Mixed visualizations row */}
      <div className="grid lg:grid-cols-3 gap-6">
        <DonutCard title="Devices" data={devices} />
        <DonutCard title="Browsers" data={browsers} />
        <div className="surface-card rounded-2xl p-5">
          <h3 className="font-display text-base font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Engagement
          </h3>
          <div className="h-56">
            <ResponsiveContainer>
              <RadialBarChart
                innerRadius="35%"
                outerRadius="100%"
                data={engagement}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar background dataKey="value" cornerRadius={8} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => `${v}%`} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} verticalAlign="bottom" />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="surface-card rounded-2xl p-5">
          <h3 className="font-display text-base font-semibold mb-1">Visits by hour</h3>
          <p className="text-xs text-muted-foreground mb-3">When your audience is most active</p>
          <div className="h-60">
            <ResponsiveContainer>
              <LineChart data={hourly}>
                <CartesianGrid
                  strokeDasharray="3 6"
                  stroke={GRID}
                  strokeOpacity={0.3}
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="var(--color-muted-foreground)"
                  fontSize={9}
                  interval={2}
                  tickLine={false}
                  axisLine={{ stroke: GRID, strokeOpacity: 0.4 }}
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: GRID, strokeOpacity: 0.4 }}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line
                  type="monotone"
                  dataKey="visits"
                  stroke={GREEN}
                  strokeWidth={2.5}
                  dot={{ r: 2.5, fill: GREEN }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <h3 className="font-display text-base font-semibold mb-1">Visits by weekday</h3>
          <p className="text-xs text-muted-foreground mb-3">Patterns across the week</p>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={weekday}>
                <CartesianGrid
                  strokeDasharray="3 6"
                  stroke={GRID}
                  strokeOpacity={0.3}
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
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
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: "var(--color-muted)", opacity: 0.3 }}
                />
                <Bar dataKey="visits" radius={[8, 8, 0, 0]}>
                  {weekday.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <BarCard title="Top events viewed" data={topEvents} />
        <BarCard title="Top pages" data={topPaths} />
      </div>

      <DonutCard title="Operating systems" data={oses} />
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: any) {
  return (
    <div className="surface-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="font-display text-2xl font-bold">{value}</div>
    </div>
  );
}

function DonutCard({ title, data }: { title: string; data: any[] }) {
  return (
    <div className="surface-card rounded-2xl p-5">
      <h3 className="font-display text-base font-semibold mb-3">{title}</h3>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground py-10 text-center">No data yet</p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={3}
              >
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={COLORS[i % COLORS.length]}
                    stroke="var(--color-card)"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function BarCard({ title, data }: { title: string; data: any[] }) {
  return (
    <div className="surface-card rounded-2xl p-5">
      <h3 className="font-display text-base font-semibold mb-3">{title}</h3>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground py-10 text-center">No data yet</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid
                strokeDasharray="3 6"
                stroke={GRID}
                strokeOpacity={0.3}
                horizontal={false}
              />
              <XAxis
                type="number"
                stroke="var(--color-muted-foreground)"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: GRID, strokeOpacity: 0.4 }}
              />
              <YAxis
                dataKey="name"
                type="category"
                stroke="var(--color-muted-foreground)"
                fontSize={10}
                width={80}
                tickLine={false}
                axisLine={{ stroke: GRID, strokeOpacity: 0.4 }}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "var(--color-muted)", opacity: 0.3 }}
              />
              <Bar dataKey="value" fill={GREEN} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default Traffic;
