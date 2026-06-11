import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, CalendarDays, Users, Ticket, User as UserIcon, Settings,
  CreditCard, Activity, BarChart3, FileText, Shield,
} from "lucide-react";

const main = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/events", label: "Events", icon: CalendarDays },
  { to: "/admin/attendees", label: "Attendees", icon: Ticket },
  { to: "/my-tickets", label: "My Tickets", icon: Ticket },
];

const manage = [
  { to: "/admin/users", label: "User management", icon: Users },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/activity", label: "Activity logs", icon: Activity },
  { to: "/admin/traffic", label: "Traffic", icon: BarChart3 },
  { to: "/admin/reports", label: "Reports", icon: FileText },
];

const account = [
  { to: "/admin/profile", label: "Profile", icon: UserIcon },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
  const loc = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  function isActive(to: string, exact?: boolean) {
    return exact ? loc.pathname === to : loc.pathname === to || loc.pathname.startsWith(to + "/");
  }

  function Section({ label, items }: { label: string; items: typeof main }) {
    return (
      <SidebarGroup>
        {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-wider">{label}</SidebarGroupLabel>}
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((it) => (
              <SidebarMenuItem key={it.to}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(it.to, (it as any).exact)}
                  tooltip={it.label}
                  className="border border-transparent data-[active=true]:border-primary/40 data-[active=true]:bg-primary/10 hover:border-sidebar-border rounded-lg transition-colors"
                >
                  <Link to={it.to} className="flex items-center gap-2.5">
                    <it.icon className="h-4 w-4 shrink-0" />
                    <span>{it.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1">
          <Logo withText={!collapsed} />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <Section label="Workspace" items={main} />
        <Section label="Management" items={manage} />
        <Section label="Account" items={account} />
        <div className="mt-auto px-3 py-3 text-[10px] text-muted-foreground flex items-center gap-1.5">
          <Shield className="h-3 w-3" /> {!collapsed && "Admin workspace"}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export function AdminTopbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between px-4 gap-2">
        <div className="flex items-center gap-2">
          <SidebarTriggerInline />
          <h2 className="text-sm font-medium text-muted-foreground hidden sm:block">Admin Console</h2>
        </div>
        <UserMenu />
      </div>
    </header>
  );
}

import { SidebarTrigger } from "@/components/ui/sidebar";
function SidebarTriggerInline() { return <SidebarTrigger />; }
