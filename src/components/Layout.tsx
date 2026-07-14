import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Phone } from "lucide-react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/60 mt-20">
        <div className="container mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div>© {new Date().getFullYear()} Heza Ticketing. Built for unforgettable events.</div>
          <a href="tel:+15207361677" className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
            <Phone className="h-4 w-4" /> +1 (520) 736-1677
          </a>
        </div>
      </footer>
    </div>
  );
}
