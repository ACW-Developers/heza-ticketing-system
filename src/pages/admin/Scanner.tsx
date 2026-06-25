import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ScanLine, Camera, Keyboard, CheckCircle2, XCircle, AlertCircle, Search,
  UserCheck, Loader2, RefreshCw, Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type Result =
  | { kind: "ok"; ticket: any; wasAlready: boolean }
  | { kind: "wrong-event"; ticket: any }
  | { kind: "not-found"; query: string }
  | null;

function Scanner() {
  const [events, setEvents] = useState<any[]>([]);
  const [eventId, setEventId] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [manual, setManual] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, checkedIn: 0 });
  const [tab, setTab] = useState<"camera" | "scanner" | "search">("scanner");
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  // Load events
  useEffect(() => {
    supabase.from("events").select("id, title, event_date").order("event_date", { ascending: false })
      .then(({ data }) => {
        setEvents(data ?? []);
        if (data?.[0]) setEventId(data[0].id);
      });
  }, []);

  // Stats per event
  async function loadStats(eid: string) {
    if (!eid) return;
    const { data } = await supabase.from("tickets").select("id, checked_in").eq("event_id", eid);
    setStats({
      total: data?.length ?? 0,
      checkedIn: (data ?? []).filter((t) => t.checked_in).length,
    });
  }
  useEffect(() => { loadStats(eventId); }, [eventId]);

  // Keep manual input focused for hardware scanners
  useEffect(() => {
    if (tab !== "scanner") return;
    const t = setInterval(() => {
      if (document.activeElement?.tagName !== "INPUT") manualInputRef.current?.focus();
    }, 1500);
    manualInputRef.current?.focus();
    return () => clearInterval(t);
  }, [tab]);

  // Camera scanner lifecycle
  useEffect(() => {
    if (tab !== "camera") {
      stopCamera();
      return;
    }
    startCamera();
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function startCamera() {
    try {
      if (scannerRef.current) return;
      const el = document.getElementById("qr-camera");
      if (!el) return;
      const sc = new Html5Qrcode("qr-camera");
      scannerRef.current = sc;
      await sc.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (text) => handleScan(text),
        () => {}
      );
      setScannerActive(true);
    } catch (e: any) {
      toast.error("Camera unavailable: " + (e?.message ?? "permission denied"));
    }
  }
  async function stopCamera() {
    const sc = scannerRef.current;
    scannerRef.current = null;
    setScannerActive(false);
    try { await sc?.stop(); await sc?.clear(); } catch { /* */ }
  }

  async function handleScan(rawCode: string) {
    const code = rawCode.trim();
    if (!code) return;
    // debounce duplicates within 2s
    const last = lastScanRef.current;
    if (last && last.code === code && Date.now() - last.at < 2000) return;
    lastScanRef.current = { code, at: Date.now() };
    await verifyTicket(code);
  }

  async function verifyTicket(code: string) {
    const { data: ticket } = await supabase
      .from("tickets")
      .select("*, events(id, title, event_date, venue)")
      .eq("ticket_number", code)
      .maybeSingle();

    if (!ticket) {
      setResult({ kind: "not-found", query: code });
      navigator.vibrate?.(200);
      return;
    }
    if (eventId && ticket.event_id !== eventId) {
      setResult({ kind: "wrong-event", ticket });
      navigator.vibrate?.(200);
      return;
    }
    if (ticket.checked_in) {
      setResult({ kind: "ok", ticket, wasAlready: true });
      navigator.vibrate?.([60, 40, 60]);
      return;
    }
    const { data: updated } = await supabase
      .from("tickets")
      .update({ checked_in: true, checked_in_at: new Date().toISOString() })
      .eq("id", ticket.id)
      .select("*, events(id, title, event_date, venue)")
      .single();
    setResult({ kind: "ok", ticket: updated, wasAlready: false });
    navigator.vibrate?.(80);
    loadStats(eventId);
  }

  async function runSearch() {
    if (!searchQuery.trim() || !eventId) return;
    const q = `%${searchQuery.trim()}%`;
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .eq("event_id", eventId)
      .or(`attendee_name.ilike.${q},attendee_email.ilike.${q},attendee_phone.ilike.${q},id_number.ilike.${q},ticket_number.ilike.${q}`)
      .limit(20);
    setSearchResults(data ?? []);
    if (!data?.length) toast.error("No attendee matched on this event");
  }

  async function checkInById(t: any) {
    if (t.checked_in) { toast.info("Already checked in"); return; }
    const { data } = await supabase
      .from("tickets")
      .update({ checked_in: true, checked_in_at: new Date().toISOString() })
      .eq("id", t.id)
      .select("*, events(id, title, event_date, venue)")
      .single();
    setResult({ kind: "ok", ticket: data, wasAlready: false });
    setSearchResults((cur) => cur.map((x) => (x.id === t.id ? { ...x, checked_in: true } : x)));
    loadStats(eventId);
    toast.success("Checked in");
  }

  const event = events.find((e) => e.id === eventId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2"><ScanLine className="h-7 w-7 text-primary" /> Ticket scanner</h1>
          <p className="text-sm text-muted-foreground">Verify and check in attendees at the door</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs">Event</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger className="h-10 min-w-[220px]"><SelectValue placeholder="Pick event" /></SelectTrigger>
              <SelectContent>{events.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
              ))}</SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="icon" onClick={() => loadStats(eventId)}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {event && (
        <div className="surface-card rounded-2xl p-5 grid sm:grid-cols-3 gap-4">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Event</div>
            <div className="font-semibold">{event.title}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Calendar className="h-3 w-3" />{format(new Date(event.event_date), "MMM d, yyyy · h:mm a")}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Checked in</div>
            <div className="font-display text-3xl font-bold">{stats.checkedIn}<span className="text-base text-muted-foreground"> / {stats.total}</span></div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${stats.total ? (stats.checkedIn / stats.total) * 100 : 0}%` }} />
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Remaining</div>
            <div className="font-display text-3xl font-bold">{Math.max(0, stats.total - stats.checkedIn)}</div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
        <div className="surface-card rounded-2xl p-5 space-y-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="scanner"><Keyboard className="h-4 w-4 mr-1.5" />Hardware</TabsTrigger>
              <TabsTrigger value="camera"><Camera className="h-4 w-4 mr-1.5" />Camera</TabsTrigger>
              <TabsTrigger value="search"><Search className="h-4 w-4 mr-1.5" />Search</TabsTrigger>
            </TabsList>

            <TabsContent value="scanner" className="space-y-3 pt-4">
              <p className="text-xs text-muted-foreground">Plug in your USB / Bluetooth scanner and scan a ticket. You can also type a code and press Enter.</p>
              <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { verifyTicket(manual.trim()); setManual(""); } }} className="flex gap-2">
                <Input
                  ref={manualInputRef}
                  autoFocus
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="Awaiting scan… (TKT-XXX-XXXX)"
                  className="font-mono"
                />
                <Button type="submit">Verify</Button>
              </form>
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                <Keyboard className="h-6 w-6 mx-auto mb-2 opacity-60" /> Keep this tab focused. Scanner input lands here automatically.
              </div>
            </TabsContent>

            <TabsContent value="camera" className="pt-4">
              <div id="qr-camera" className="w-full rounded-xl overflow-hidden bg-black aspect-video" />
              <p className="text-xs text-muted-foreground mt-3 text-center">
                {scannerActive ? "Point camera at the QR code on the ticket" : "Starting camera..."}
              </p>
            </TabsContent>

            <TabsContent value="search" className="space-y-3 pt-4">
              <p className="text-xs text-muted-foreground">If a ticket fails to scan, search the attendee in this event's guest list.</p>
              <form onSubmit={(e) => { e.preventDefault(); runSearch(); }} className="flex gap-2">
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Name, email, phone, ID, ticket #" />
                <Button type="submit"><Search className="h-4 w-4" /></Button>
              </form>
              <div className="max-h-72 overflow-y-auto divide-y divide-border rounded-lg border border-border">
                {searchResults.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{t.attendee_name || "(no name)"}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.attendee_email} · {t.attendee_phone}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{t.ticket_number} · {t.ticket_type}</div>
                    </div>
                    {t.checked_in ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success rounded-full bg-success/10 px-2 py-1"><CheckCircle2 className="h-3 w-3" /> In</span>
                    ) : (
                      <Button size="sm" onClick={() => checkInById(t)}><UserCheck className="h-4 w-4 mr-1" /> Check in</Button>
                    )}
                  </div>
                ))}
                {searchResults.length === 0 && <div className="p-8 text-center text-xs text-muted-foreground">No results yet</div>}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <ResultPanel result={result} onClear={() => setResult(null)} />
      </div>
    </div>
  );
}

function ResultPanel({ result, onClear }: { result: Result; onClear: () => void }) {
  if (!result) {
    return (
      <div className="surface-card rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[280px]">
        <ScanLine className="h-12 w-12 text-muted-foreground opacity-40 mb-3" />
        <div className="font-semibold">Awaiting first scan</div>
        <p className="text-xs text-muted-foreground mt-1">Results will show up here</p>
      </div>
    );
  }
  if (result.kind === "not-found") {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 min-h-[280px]">
        <div className="flex items-center gap-2 text-destructive font-semibold"><XCircle className="h-6 w-6" /> Ticket not found</div>
        <p className="mt-2 text-sm">No ticket matches code <span className="font-mono">{result.query}</span>. Try the Search tab to look up the attendee.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>Dismiss</Button>
      </div>
    );
  }
  if (result.kind === "wrong-event") {
    return (
      <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/5 p-6 min-h-[280px]">
        <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 font-semibold"><AlertCircle className="h-6 w-6" /> Wrong event</div>
        <p className="mt-2 text-sm">This ticket is for <strong>{result.ticket.events?.title}</strong>, not the selected event.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>Dismiss</Button>
      </div>
    );
  }
  const t = result.ticket;
  const tone = result.wasAlready ? "border-yellow-500/40 bg-yellow-500/5" : "border-success/40 bg-success/5";
  const Icon = result.wasAlready ? AlertCircle : CheckCircle2;
  return (
    <div className={`rounded-2xl border p-6 ${tone} min-h-[280px]`}>
      <div className={`flex items-center gap-2 font-semibold ${result.wasAlready ? "text-yellow-600 dark:text-yellow-400" : "text-success"}`}>
        <Icon className="h-6 w-6" /> {result.wasAlready ? "Already checked in" : "Welcome — checked in"}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Field label="Attendee" value={t.attendee_name || "—"} />
        <Field label="Ticket type" value={String(t.ticket_type).toUpperCase()} />
        <Field label="Ticket #" mono value={t.ticket_number} />
        <Field label="Email" value={t.attendee_email || "—"} />
        <Field label="Phone" value={t.attendee_phone || "—"} />
        <Field label="ID / Passport" value={t.id_number || "—"} />
        <Field label="Country" value={t.country || "—"} />
        <Field label="Checked in at" value={t.checked_in_at ? format(new Date(t.checked_in_at), "MMM d, h:mm:ss a") : "—"} />
      </div>
      {t.notes && <p className="mt-3 text-xs italic text-muted-foreground">Note: {t.notes}</p>}
      <Button variant="outline" size="sm" className="mt-5" onClick={onClear}>Next scan</Button>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

export default Scanner;
