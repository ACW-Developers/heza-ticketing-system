
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Activity, UserPlus, Ticket, CreditCard } from "lucide-react";
import { format } from "date-fns";

function ActivityLog() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: tickets }, { data: orders }] = await Promise.all([
        supabase.from("profiles").select("full_name, email, created_at").order("created_at", { ascending: false }).limit(20),
        supabase.from("tickets").select("ticket_number, ticket_type, attendee_name, created_at, events(title)").order("created_at", { ascending: false }).limit(20),
        supabase.from("orders").select("total_amount, status, created_at, events(title)").order("created_at", { ascending: false }).limit(20),
      ]);
      const events: any[] = [];
      for (const p of profiles ?? []) events.push({ type: "signup", at: p.created_at, label: `${p.full_name ?? p.email} signed up`, icon: UserPlus });
      for (const t of tickets ?? []) events.push({ type: "ticket", at: t.created_at, label: `Ticket issued - ${t.ticket_type.toUpperCase()} for ${t.events?.title ?? "event"}`, icon: Ticket });
      for (const o of orders ?? []) events.push({ type: "order", at: o.created_at, label: `Order ${o.status} - $${Number(o.total_amount).toFixed(2)} (${o.events?.title ?? "event"})`, icon: CreditCard });
      events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setItems(events.slice(0, 50));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Activity logs</h1>
          <p className="text-sm text-muted-foreground">Recent platform activity</p>
        </div>
        <Activity className="h-6 w-6 text-primary" />
      </div>

      <div className="surface-card rounded-xl divide-y divide-border">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <it.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{it.label}</p>
              <p className="text-xs text-muted-foreground">{format(new Date(it.at), "MMM d, yyyy · h:mm a")}</p>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="p-10 text-center text-muted-foreground">No activity yet.</p>}
      </div>
    </div>
  );
}

export default ActivityLog;
