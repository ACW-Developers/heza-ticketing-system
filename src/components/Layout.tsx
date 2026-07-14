import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Phone } from "lucide-react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer className="mt-20 border-t border-border/60">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row">
          <div>© {new Date().getFullYear()} Heza Ticketing. Built for unforgettable events.</div>

          <a
            href="tel:+15207361677"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-primary"
          >
            <Phone className="h-4 w-4" /> Call/WhatsApp: +1 (520) 736-1677
          </a>

          <a
            href="http://amosclinton.site/"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-primary"
          >
            <span className="font-semibold text-primary">Designed by ACW</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
