
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CreditCard, DollarSign, TrendingUp } from "lucide-react";
import { format } from "date-fns";

function AdminPayments() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, events(title)")
        .order("created_at", { ascending: false })
        .limit(100);
      setOrders(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  const paid = orders.filter((o) => o.status === "paid");
  const pending = orders.filter((o) => o.status === "pending");
  const revenue = paid.reduce((s, o) => s + Number(o.total_amount), 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="font-display text-3xl font-bold">Payments</h1>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card icon={DollarSign} label="Total revenue" value={`$${revenue.toFixed(2)}`} />
        <Card icon={CreditCard} label="Paid orders" value={paid.length} />
        <Card icon={TrendingUp} label="Pending" value={pending.length} />
      </div>

      <div className="surface-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Date</th><th className="p-3">Event</th><th className="p-3">Amount</th>
              <th className="p-3">Status</th><th className="p-3">Stripe Session</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="p-3 text-muted-foreground text-xs">{format(new Date(o.created_at), "MMM d, h:mm a")}</td>
                <td className="p-3">{o.events?.title ?? "-"}</td>
                <td className="p-3 font-semibold">${Number(o.total_amount).toFixed(2)}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    o.status === "paid" ? "bg-primary/15 text-primary" :
                    o.status === "pending" ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" :
                    "bg-destructive/15 text-destructive"
                  }`}>{o.status}</span>
                </td>
                <td className="p-3 font-mono text-[10px] text-muted-foreground truncate max-w-[200px]">{o.stripe_session_id ?? "-"}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">No payments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value }: any) {
  return (
    <div className="surface-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
      </div>
      <div className="font-display text-3xl font-bold">{value}</div>
    </div>
  );
}

export default AdminPayments;
