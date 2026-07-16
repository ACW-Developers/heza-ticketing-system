import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Calendar, MapPin, Ticket, Wallet } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
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

const STATUS_COLORS: Record<string, string> = {
  published: "#22c55e",
  draft: "#6b7280",
  cancelled: "#ef4444",
  completed: "#3b82f6",
};

const empty = {
  id: "",
  title: "",
  description: "",
  event_date: "",
  venue: "",
  poster_url: "",
  poster_urls: [] as string[],
  price_children: 0,
  price_regular: 0,
  price_vip: 0,
  price_vvip: 0,
  qty_children: 0,
  qty_regular: 0,
  qty_vip: 0,
  qty_vvip: 0,
  status: "published",
};

function AdminEvents() {
  const { user } = useAuth();
  const { format: fmt } = useCurrency();
  const [events, setEvents] = useState<any[]>([]);
  const [ticketStats, setTicketStats] = useState<
    Record<string, { tickets: number; revenue: number }>
  >({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: evts }, { data: tix }] = await Promise.all([
      supabase.from("events").select("*").order("event_date", { ascending: false }),
      supabase.from("tickets").select("event_id, price"),
    ]);
    const m: Record<string, { tickets: number; revenue: number }> = {};
    for (const t of tix ?? []) {
      const r = m[t.event_id] ?? { tickets: 0, revenue: 0 };
      r.tickets++;
      r.revenue += Number(t.price);
      m[t.event_id] = r;
    }
    setTicketStats(m);
    setEvents(evts ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const overview = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const e of events) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    const statusData = Object.entries(byStatus).map(([name, value]) => ({ name, value }));
    const topRevenue = events
      .map((e) => ({
        name: e.title.slice(0, 18),
        revenue: ticketStats[e.id]?.revenue ?? 0,
        tickets: ticketStats[e.id]?.tickets ?? 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
    const totalTickets = Object.values(ticketStats).reduce((s, x) => s + x.tickets, 0);
    const totalRevenue = Object.values(ticketStats).reduce((s, x) => s + x.revenue, 0);
    const upcoming = events.filter((e) => new Date(e.event_date) > new Date()).length;
    return { statusData, topRevenue, totalTickets, totalRevenue, upcoming };
  }, [events, ticketStats]);

  function startNew() {
    setForm({ ...empty, poster_urls: [] });
    setOpen(true);
  }
  function startEdit(e: any) {
    const existing = Array.isArray(e.poster_urls) ? e.poster_urls.filter(Boolean) : [];
    const merged =
      existing.length === 0 && e.poster_url ? [e.poster_url] : existing;
    setForm({
      ...e,
      event_date: format(new Date(e.event_date), "yyyy-MM-dd'T'HH:mm"),
      poster_urls: merged,
      poster_url: e.poster_url || merged[0] || "",
    });
    setOpen(true);
  }

  async function handleUpload(files: FileList) {
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage.from("event-posters").upload(path, file);
      if (error) {
        toast.error(error.message);
        continue;
      }
      const { data } = supabase.storage.from("event-posters").getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }
    if (!uploaded.length) return;
    setForm((f: any) => {
      const all = [...(f.poster_urls ?? []), ...uploaded];
      return { ...f, poster_urls: all, poster_url: f.poster_url || uploaded[0] };
    });
    toast.success(`${uploaded.length} image${uploaded.length > 1 ? "s" : ""} uploaded`);
  }

  function removeImage(url: string) {
    setForm((f: any) => {
      const all = (f.poster_urls ?? []).filter((u: string) => u !== url);
      return {
        ...f,
        poster_urls: all,
        poster_url: f.poster_url === url ? (all[0] ?? "") : f.poster_url,
      };
    });
  }
  function makeCover(url: string) {
    setForm((f: any) => ({ ...f, poster_url: url }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const posterUrls: string[] = form.poster_urls?.length
      ? form.poster_urls
      : form.poster_url
        ? [form.poster_url]
        : [];
    const cover = form.poster_url || posterUrls[0] || null;
    const payload: any = {
      title: form.title,
      description: form.description,
      venue: form.venue,
      event_date: new Date(form.event_date).toISOString(),
      poster_url: cover,
      poster_urls: posterUrls,
      status: form.status,
      price_children: Number(form.price_children),
      price_regular: Number(form.price_regular),
      price_vip: Number(form.price_vip),
      price_vvip: Number(form.price_vvip),
      qty_children: Number(form.qty_children),
      qty_regular: Number(form.qty_regular),
      qty_vip: Number(form.qty_vip),
      qty_vvip: Number(form.qty_vvip),
    };
    let error;
    if (form.id) ({ error } = await supabase.from("events").update(payload).eq("id", form.id));
    else ({ error } = await supabase.from("events").insert({ ...payload, created_by: user!.id }));
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Updated" : "Created");
    setOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this event and all its tickets?")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Events</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="glow-primary" onClick={startNew}>
              <Plus className="mr-1 h-4 w-4" /> New event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit event" : "Create event"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date & time</Label>
                  <Input
                    type="datetime-local"
                    required
                    value={form.event_date}
                    onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Venue</Label>
                  <Input
                    required
                    value={form.venue}
                    onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>
                  Event images{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    (add one or more)
                  </span>
                </Label>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => e.target.files?.length && handleUpload(e.target.files)}
                />
                {form.poster_urls?.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {form.poster_urls.map((url: string) => {
                      const isCover = url === form.poster_url;
                      return (
                        <div
                          key={url}
                          className="relative group rounded-lg overflow-hidden border border-border"
                        >
                          <img src={url} alt="event" className="h-20 w-full object-cover" />
                          {isCover && (
                            <span className="absolute top-1 left-1 text-[9px] font-semibold uppercase bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                              Cover
                            </span>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 flex items-center justify-center gap-1.5">
                            {!isCover && (
                              <button
                                type="button"
                                onClick={() => makeCover(url)}
                                className="text-[10px] bg-white/95 text-black rounded px-1.5 py-0.5 font-medium hover:bg-white"
                              >
                                Set cover
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeImage(url)}
                              className="text-[10px] bg-destructive text-destructive-foreground rounded px-1.5 py-0.5 font-medium hover:opacity-90"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-4 gap-3">
                {(["children", "regular", "vip", "vvip"] as const).map((t) => (
                  <div key={t}>
                    <Label className="capitalize text-xs">{t} price</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form[`price_${t}`]}
                      onChange={(e) => setForm({ ...form, [`price_${t}`]: e.target.value })}
                    />
                  </div>
                ))}
                {(["children", "regular", "vip", "vvip"] as const).map((t) => (
                  <div key={"q" + t}>
                    <Label className="capitalize text-xs">{t} qty</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form[`qty_${t}`]}
                      onChange={(e) => setForm({ ...form, [`qty_${t}`]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div>
                <Label>Status</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <Button type="submit" className="w-full glow-primary" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatBox
              icon={Calendar}
              label="Events"
              value={events.length}
              hint={`${overview.upcoming} upcoming`}
            />
            <StatBox icon={Ticket} label="Tickets sold" value={overview.totalTickets} />
            <StatBox
              icon={Wallet}
              label="Revenue"
              value={fmt(overview.totalRevenue, { decimals: 0 })}
            />
            <StatBox
              icon={MapPin}
              label="Venues"
              value={new Set(events.map((e) => e.venue)).size}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="surface-card rounded-2xl p-5">
              <h3 className="font-display text-base font-semibold mb-3">Events by status</h3>
              <div className="h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={overview.statusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {overview.statusData.map((s, i) => (
                        <Cell key={i} fill={STATUS_COLORS[s.name] ?? "var(--color-primary)"} />
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
              </div>
            </div>
            <div className="surface-card rounded-2xl p-5">
              <h3 className="font-display text-base font-semibold mb-3">Top events by revenue</h3>
              <div className="h-56 -ml-11">
                <ResponsiveContainer>
                  <BarChart data={overview.topRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={10} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="revenue" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="surface-card rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3">Event</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Tickets</th>
                  <th className="p-3 text-right">Revenue</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-border hover:bg-muted/20">
                    <td className="p-3 font-semibold">
                      {e.title}
                      <div className="text-xs text-muted-foreground font-normal">{e.venue}</div>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {format(new Date(e.event_date), "MMM d, yyyy")}
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs capitalize">
                        {e.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">{ticketStats[e.id]?.tickets ?? 0}</td>
                    <td className="p-3 text-right font-semibold">
                      {fmt(ticketStats[e.id]?.revenue ?? 0, { decimals: 0 })}
                    </td>
                    <td className="p-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(e)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(e.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-muted-foreground">
                      No events yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({ icon: Icon, label, value, hint }: any) {
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

export default AdminEvents;
