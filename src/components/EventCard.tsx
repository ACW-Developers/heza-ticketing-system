import { Link } from "@tanstack/react-router";
import { Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";
import { useCurrency } from "@/hooks/useCurrency";

export interface EventCardData {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  venue: string;
  poster_url: string | null;
  price_regular: number;
}

export function EventCard({ event }: { event: EventCardData }) {
  const { format: fmt } = useCurrency();
  return (
    <Link
      to="/events/$id"
      params={{ id: event.id }}
      className="group surface-card rounded-2xl overflow-hidden hover:border-primary/40 hover:-translate-y-0.5 transition-all"
    >
      <div className="aspect-[16/10] bg-muted relative overflow-hidden">
        {event.poster_url ? (
          <img
            src={event.poster_url}
            alt={event.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 via-accent/10 to-transparent flex items-center justify-center">
            <Calendar className="h-12 w-12 text-primary/40" />
          </div>
        )}
        <div className="absolute top-3 right-3 rounded-full bg-background/80 backdrop-blur px-3 py-1 text-xs font-semibold">
          From {fmt(Number(event.price_regular), { decimals: 0 })}
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Calendar className="h-3.5 w-3.5" />
          {format(new Date(event.event_date), "MMM d, yyyy · h:mm a")}
        </div>
        <h3 className="font-display text-lg font-semibold leading-tight mb-1 line-clamp-2 group-hover:text-primary transition-colors">
          {event.title}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> {event.venue}
        </div>
      </div>
    </Link>
  );
}
