import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";

export function NotificationBell() {
  const { user, isAdmin } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin || !user) return;
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (mounted) setItems(data ?? []);
    };
    load();
    const ch = supabase
      .channel("notifications-stream")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (p) =>
        setItems((cur) => [p.new as any, ...cur].slice(0, 30)),
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [isAdmin, user]);

  const unread = items.filter((n) => !(n.read_by ?? []).includes(user?.id));

  async function markAllRead() {
    if (!user) return;
    const ids = unread.map((n) => n.id);
    if (!ids.length) return;
    for (const n of unread) {
      await supabase
        .from("notifications")
        .update({ read_by: [...((n.read_by as string[]) ?? []), user.id] })
        .eq("id", n.id);
    }
    setItems((cur) =>
      cur.map((n) =>
        ids.includes(n.id) ? { ...n, read_by: [...((n.read_by as string[]) ?? []), user.id] } : n,
      ),
    );
  }

  if (!isAdmin) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread.length > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="font-semibold text-sm">Notifications</div>
          {unread.length > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <Check className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-border">
          {items.length === 0 && (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No notifications yet
            </div>
          )}
          {items.map((n) => {
            const isUnread = !(n.read_by ?? []).includes(user?.id);
            return (
              <Link
                key={n.id}
                to={n.link ?? "#"}
                onClick={() => setOpen(false)}
                className={`block px-4 py-3 hover:bg-muted/50 transition-colors ${isUnread ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-start gap-2">
                  {isUnread && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{n.title}</div>
                    {n.body && (
                      <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
