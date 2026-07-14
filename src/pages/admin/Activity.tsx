import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Activity,
  UserPlus,
  Ticket,
  CreditCard,
  Shield,
  KeyRound,
  ScanLine,
  Search,
  UserX,
  Filter,
  Eye,
  LogIn,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ACTION_META: Record<string, { icon: any; tone: string; label: string }> = {
  "ticket.purchased": {
    icon: Ticket,
    tone: "text-primary bg-primary/10",
    label: "Ticket purchased",
  },
  "ticket.checked_in": {
    icon: ScanLine,
    tone: "text-success bg-success/10",
    label: "Ticket checked in",
  },
  "user.role.granted": {
    icon: Shield,
    tone: "text-blue-500 bg-blue-500/10",
    label: "Admin granted",
  },
  "user.role.revoked": {
    icon: Shield,
    tone: "text-orange-500 bg-orange-500/10",
    label: "Admin revoked",
  },
  "user.password_reset_sent": {
    icon: KeyRound,
    tone: "text-yellow-500 bg-yellow-500/10",
    label: "Password reset sent",
  },
  "user.deleted": {
    icon: UserX,
    tone: "text-destructive bg-destructive/10",
    label: "User deleted",
  },
  "user.signup": {
    icon: UserPlus,
    tone: "text-accent-foreground bg-accent/30",
    label: "User signed up",
  },
  "user.signin": { icon: LogIn, tone: "text-primary bg-primary/10", label: "User signed in" },
  "order.paid": { icon: CreditCard, tone: "text-success bg-success/10", label: "Order paid" },
  "page.view": { icon: Eye, tone: "text-muted-foreground bg-muted", label: "Page viewed" },
};

function ActivityLog() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterAction, setFilterAction] = useState("all");

  useEffect(() => {
    (async () => {
      const [{ data: logs }, { data: views }] = await Promise.all([
        supabase
          .from("activity_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("page_views")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(300),
      ]);
      const viewItems = (views ?? []).map((v: any) => ({
        id: "pv-" + v.id,
        created_at: v.created_at,
        actor_id: v.user_id,
        actor_email: null,
        actor_name: v.device ? `${v.device} · ${v.browser ?? ""}`.trim() : "Visitor",
        action: "page.view",
        metadata: {
          path: v.path,
          referrer: v.referrer,
          country: v.country,
          os: v.os,
          browser: v.browser,
        },
      }));
      const merged = [...(logs ?? []), ...viewItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setItems(merged);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const byAction: Record<string, number> = {};
    for (const i of items) byAction[i.action] = (byAction[i.action] ?? 0) + 1;
    const today = items.filter(
      (i) => new Date(i.created_at).toDateString() === new Date().toDateString(),
    ).length;
    return { total: items.length, today, byAction };
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filterAction !== "all" && i.action !== filterAction) return false;
      if (q.trim()) {
        const s = q.toLowerCase();
        const hay =
          `${i.actor_email ?? ""} ${i.actor_name ?? ""} ${i.action} ${JSON.stringify(i.metadata ?? {})}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [items, q, filterAction]);

  const actionTypes = Object.keys(stats.byAction);

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
          <h1 className="font-display text-3xl font-bold">Activity logs</h1>
          <p className="text-sm text-muted-foreground">Who did what, when. Last 500 actions.</p>
        </div>
        <Activity className="h-6 w-6 text-primary" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Total" value={stats.total} />
        <Stat label="Today" value={stats.today} />
        <Stat label="Tickets" value={stats.byAction["ticket.purchased"] ?? 0} />
        <Stat label="Check-ins" value={stats.byAction["ticket.checked_in"] ?? 0} />
      </div>

      <div className="surface-card rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actor or detail…"
            className="border-0 focus-visible:ring-0 px-0 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actionTypes.map((a) => (
                <SelectItem key={a} value={a}>
                  {ACTION_META[a]?.label ?? a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setQ("");
              setFilterAction("all");
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="surface-card rounded-2xl overflow-hidden">
        <div className="divide-y divide-border">
          {filtered.map((it) => {
            const meta = ACTION_META[it.action] ?? {
              icon: Activity,
              tone: "text-muted-foreground bg-muted",
              label: it.action,
            };
            const Icon = meta.icon;
            return (
              <div
                key={it.id}
                className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${meta.tone}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{meta.label}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {it.actor_name || it.actor_email || "System"}
                    </span>
                  </div>
                  {it.metadata && Object.keys(it.metadata).length > 0 && (
                    <div className="text-xs text-muted-foreground mt-0.5 font-mono break-all line-clamp-2">
                      {Object.entries(it.metadata)
                        .slice(0, 5)
                        .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
                        .join(" · ")}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground text-right whitespace-nowrap shrink-0">
                  <div>{formatDistanceToNow(new Date(it.created_at), { addSuffix: true })}</div>
                  <div className="text-[10px]">
                    {format(new Date(it.created_at), "MMM d, HH:mm:ss")}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">
              No activity matches your filters.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

export default ActivityLog;
