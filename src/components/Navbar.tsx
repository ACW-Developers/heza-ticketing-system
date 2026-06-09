import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { user } = useAuth();
  const loc = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Logo />
        <nav className="flex items-center gap-1">
          <Link to="/events">
            <Button variant="ghost" size="sm" className={loc.pathname.startsWith("/events") ? "text-primary" : ""}>
              Events
            </Button>
          </Link>
          {user && (
            <Link to="/my-tickets">
              <Button variant="ghost" size="sm" className={loc.pathname === "/my-tickets" ? "text-primary" : ""}>
                My Tickets
              </Button>
            </Link>
          )}
          <div className="ml-2">
            <UserMenu />
          </div>
        </nav>
      </div>
    </header>
  );
}
