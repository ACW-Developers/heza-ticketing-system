
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, BarChart3 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { format, subDays } from "date-fns";

export const Route = createFileRoute("/admin/traffic")({ component: Traffic });

function Traffic() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: profiles } = await supabase.from("profiles").select("created_at");
      const { data: tickets } = await supabase.from("tickets").select("created_at");
      const days: any[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "MMM d");
        const signups = (profiles ?? []).filter((p) => format(new Date(p.created_at), "MMM d") === d).length;
        const sales = (tickets ?? []).filter((t) => format(new Date(t.created_at), "MMM d") === d).length;
        days.push({ name: d, signups, sales });
      }
      setData(days);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Traffic</h1>
          <p className="text-sm text-muted-foreground">30-day platform activity</p>
        </div>
        <BarChart3 className="h-6 w-6 text-primary" />
      </div>

      <div className="surface-card rounded-xl p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Signups vs ticket sales</h3>
        <div className="h-80">
          <ResponsiveContainer>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={10} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Area type="monotone" dataKey="signups" stroke="var(--color-primary)" fill="url(#g1)" strokeWidth={2} />
              <Area type="monotone" dataKey="sales" stroke="var(--color-accent)" fill="url(#g2)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default Traffic;
