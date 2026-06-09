
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/events")({ component: AdminEvents });

const empty = {
  id: "", title: "", description: "", event_date: "", venue: "", poster_url: "",
  price_children: 0, price_regular: 0, price_vip: 0, price_vvip: 0,
  qty_children: 0, qty_regular: 0, qty_vip: 0, qty_vvip: 0,
  status: "published",
};

function AdminEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("events").select("*").order("event_date", { ascending: false });
    setEvents(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function startNew() { setForm(empty); setOpen(true); }
  function startEdit(e: any) {
    setForm({ ...e, event_date: format(new Date(e.event_date), "yyyy-MM-dd'T'HH:mm") });
    setOpen(true);
  }

  async function handleUpload(file: File) {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("event-posters").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("event-posters").getPublicUrl(path);
    setForm((f: any) => ({ ...f, poster_url: data.publicUrl }));
    toast.success("Poster uploaded");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload: any = {
      title: form.title, description: form.description, venue: form.venue,
      event_date: new Date(form.event_date).toISOString(),
      poster_url: form.poster_url || null, status: form.status,
      price_children: Number(form.price_children), price_regular: Number(form.price_regular),
      price_vip: Number(form.price_vip), price_vvip: Number(form.price_vvip),
      qty_children: Number(form.qty_children), qty_regular: Number(form.qty_regular),
      qty_vip: Number(form.qty_vip), qty_vvip: Number(form.qty_vvip),
    };
    let error;
    if (form.id) ({ error } = await supabase.from("events").update(payload).eq("id", form.id));
    else ({ error } = await supabase.from("events").insert({ ...payload, created_by: user!.id }));
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Updated" : "Created");
    setOpen(false); load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this event and all its tickets?")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Events</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="glow-primary" onClick={startNew}><Plus className="mr-1 h-4 w-4" /> New event</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{form.id ? "Edit event" : "Create event"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div><Label>Title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Date & time</Label><Input type="datetime-local" required value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></div>
                <div><Label>Venue</Label><Input required value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></div>
              </div>
              <div>
                <Label>Poster image</Label>
                <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                {form.poster_url && <img src={form.poster_url} alt="poster" className="mt-2 h-20 rounded-lg object-cover" />}
              </div>
              <div className="grid grid-cols-4 gap-3">
                {(["children", "regular", "vip", "vvip"] as const).map((t) => (
                  <div key={t}>
                    <Label className="capitalize text-xs">{t} price</Label>
                    <Input type="number" min={0} step="0.01" value={form[`price_${t}`]} onChange={(e) => setForm({ ...form, [`price_${t}`]: e.target.value })} />
                  </div>
                ))}
                {(["children", "regular", "vip", "vvip"] as const).map((t) => (
                  <div key={"q"+t}>
                    <Label className="capitalize text-xs">{t} qty</Label>
                    <Input type="number" min={0} value={form[`qty_${t}`]} onChange={(e) => setForm({ ...form, [`qty_${t}`]: e.target.value })} />
                  </div>
                ))}
              </div>
              <div>
                <Label>Status</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">Draft</option><option value="published">Published</option>
                  <option value="cancelled">Cancelled</option><option value="completed">Completed</option>
                </select>
              </div>
              <Button type="submit" className="w-full glow-primary" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div> : (
        <div className="surface-card rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3">Event</th><th className="p-3">Date</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="p-3 font-semibold">{e.title}<div className="text-xs text-muted-foreground font-normal">{e.venue}</div></td>
                  <td className="p-3 text-muted-foreground">{format(new Date(e.event_date), "MMM d, yyyy")}</td>
                  <td className="p-3"><span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs capitalize">{e.status}</span></td>
                  <td className="p-3 text-right">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(e)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
              {events.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-muted-foreground">No events yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminEvents;
