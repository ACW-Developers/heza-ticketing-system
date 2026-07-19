import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CreditCard, Wallet, TrendingUp, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function AdminPayments() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("orders")
      .select("*, events(title)")
      .order("created_at", { ascending: false })
      .limit(200);
    setOrders(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(orderId: string, decision: "confirm" | "reject") {
    if (decision === "reject" && !confirm("Reject this payment? Tickets will be marked rejected."))
      return;
    setBusyId(orderId);
    try {
      const { data, error } = await supabase.functions.invoke("mpesa-approve", {
        body: { orderId, decision },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(decision === "confirm" ? "Payment confirmed" : "Payment rejected");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  const paid = orders.filter((o) => o.status === "paid");
  const pending = orders.filter((o) => o.status === "pending");
  const revenue = paid.reduce((s, o) => s + Number(o.total_amount), 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Payments</h1>
        <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard icon={Wallet} label="Total revenue" value={`Ksh ${revenue.toFixed(0)}`} />
        <StatCard icon={CreditCard} label="Confirmed" value={paid.length} />
        <StatCard icon={Clock} label="Awaiting review" value={pending.length} accent />
      </div>

      {pending.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-semibold mb-3">Awaiting confirmation</h2>
          <div className="grid gap-3">
            {pending.map((o) => (
              <div
                key={o.id}
                className="surface-card rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">{o.events?.title ?? "Event"}</span>
                    <span className="text-muted-foreground text-xs">
                      {format(new Date(o.created_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <Field label="Amount" value={`Ksh ${Number(o.total_amount).toFixed(0)}`} />
                    <Field label="M-Pesa code" value={o.mpesa_code ?? "—"} mono />
                    <Field label="Paid from" value={o.mpesa_phone ?? "—"} mono />
                    <Field label="Method" value={o.payment_method ?? "—"} />
                  </div>
                </div>
                <div className="flex gap-2 md:shrink-0">
                  <Button
                    size="sm"
                    disabled={busyId === o.id}
                    onClick={() => decide(o.id, "confirm")}
                    className="glow-primary"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" /> Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === o.id}
                    onClick={() => decide(o.id, "reject")}
                  >
                    <XCircle className="h-4 w-4 mr-1.5" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-lg font-semibold mb-3">All orders</h2>
        <div className="surface-card rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Event</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Method</th>
                <th className="p-3">M-Pesa code</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="p-3 text-muted-foreground text-xs">
                    {format(new Date(o.created_at), "MMM d, h:mm a")}
                  </td>
                  <td className="p-3">{o.events?.title ?? "-"}</td>
                  <td className="p-3 font-semibold">Ksh {Number(o.total_amount).toFixed(0)}</td>
                  <td className="p-3 capitalize">{o.payment_method ?? "-"}</td>
                  <td className="p-3 font-mono text-[11px] text-muted-foreground">
                    {o.mpesa_code ?? o.stripe_session_id ?? "-"}
                  </td>
                  <td className="p-3">
                    <StatusPill status={o.status} />
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-muted-foreground">
                    No payments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-xs" : "text-xs font-medium"}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "paid"
      ? "bg-primary/15 text-primary"
      : status === "pending"
        ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
        : "bg-destructive/15 text-destructive";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>
  );
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  return (
    <div className={`surface-card rounded-xl p-5 ${accent ? "border-primary/40" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="font-display text-3xl font-bold">{value}</div>
    </div>
  );
}

export default AdminPayments;
