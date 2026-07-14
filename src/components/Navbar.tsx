import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus } from "lucide-react";

export function Navbar() {
  const { user } = useAuth();
  const loc = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link to="/events" className="hidden sm:inline-flex">
            <Button
              variant="ghost"
              size="sm"
              className={loc.pathname.startsWith("/events") ? "text-primary" : ""}
            >
              Events
            </Button>
          </Link>
          {user && (
            <Link to="/my-tickets" className="hidden sm:inline-flex">
              <Button
                variant="ghost"
                size="sm"
                className={loc.pathname === "/my-tickets" ? "text-primary" : ""}
              >
                My Tickets
              </Button>
            </Link>
          )}
          {user ? (
            <div className="ml-1">
              <UserMenu />
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-1">
              <Link to="/auth?mode=signin">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 sm:px-4 rounded-full border-2 border-primary/40 hover:border-primary hover:bg-primary/5 font-semibold"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sign in
                </Button>
              </Link>
              <Link to="/auth?mode=signup" className="hidden sm:block">
                <Button
                  size="sm"
                  className="h-9 px-3 sm:px-4 rounded-full border-2 border-primary/60 shadow-md shadow-primary/20 hover:shadow-primary/40 font-semibold glow-primary"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Sign up
                </Button>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
