
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { EventCard } from "@/components/EventCard";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2 } from "lucide-react";

function EventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("events")
      .select("*")
      .eq("status", "published")
      .order("event_date", { ascending: true })
      .then(({ data }) => {
        setEvents(data ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = events.filter(
    (e) =>
      e.title.toLowerCase().includes(q.toLowerCase()) ||
      e.venue.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <Layout>
      <section className="container mx-auto px-4 pt-12 pb-6">
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Upcoming events</h1>
        <p className="mt-2 text-muted-foreground">Find your next event.</p>
        <div className="relative mt-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or venue…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 h-11"
          />
        </div>
      </section>

      <section className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-20 text-muted-foreground">No events found.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        )}
      </section>
    </Layout>
  );
}
