import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  User as UserIcon,
  LogOut,
  Ticket,
  LayoutDashboard,
  Settings,
  CalendarDays,
  Sun,
  Moon,
  ChevronDown,
} from "lucide-react";

export function UserMenu() {
  const { user, isAdmin, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setAvatarUrl(null);
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      setAvatarUrl((data as any)?.avatar_url ?? null);
    };
    load();
    const handler = () => load();
    window.addEventListener("profile-updated", handler);
    return () => window.removeEventListener("profile-updated", handler);
  }, [user]);

  if (!user) {
    return (
      <Link to="/auth">
        <Button size="sm" className="glow-primary">
          Sign in
        </Button>
      </Link>
    );
  }

  const initials = (user.user_metadata?.full_name ?? user.email ?? "U")
    .split(" ")
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center  gap-2">
      <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
        {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 pr-2 pl-1.5 border-2 border-primary/50 h-9">
            <div className="flex h-7 w-7 items-center border-2 justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </div>
            <span className="hidden sm:inline text-sm font-medium max-w-[140px] truncate">
              {user.user_metadata?.full_name ?? user.email?.split("@")[0]}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <div className="text-xs text-muted-foreground font-normal">Signed in as</div>
            <div className="truncate text-sm">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Quick links
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => nav("/events")}>
            <CalendarDays className="mr-2 h-4 w-4" /> Browse events
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => nav("/my-tickets")}>
            <Ticket className="mr-2 h-4 w-4" /> My tickets
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem onClick={() => nav("/admin")}>
              <LayoutDashboard className="mr-2 h-4 w-4" /> Admin dashboard
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => nav("/admin/profile")}>
            <UserIcon className="mr-2 h-4 w-4" /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => nav("/admin/settings")}>
            <Settings className="mr-2 h-4 w-4" /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              await signOut();
              nav("/auth");
            }}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
