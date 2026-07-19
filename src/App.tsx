import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { CurrencyProvider } from "@/hooks/useCurrency";
import { Toaster } from "@/components/ui/sonner";

import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import MyTickets from "@/pages/MyTickets";
import SetupAdmin from "@/pages/SetupAdmin";
import EventsIndex from "@/pages/events/EventsIndex";
import EventDetail from "@/pages/events/EventDetail";
import CheckoutSuccess from "@/pages/checkout/Success";
import ManualPayment from "@/pages/checkout/ManualPayment";
import AdminLayout from "@/pages/admin/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import AdminEvents from "@/pages/admin/Events";
import Attendees from "@/pages/admin/Attendees";
import AdminUsers from "@/pages/admin/Users";
import AdminPayments from "@/pages/admin/Payments";
import ActivityLog from "@/pages/admin/Activity";
import Traffic from "@/pages/admin/Traffic";
import Reports from "@/pages/admin/Reports";
import Scanner from "@/pages/admin/Scanner";
import Profile from "@/pages/admin/Profile";
import Settings from "@/pages/admin/Settings";
import { PageViewTracker } from "@/components/PageViewTracker";

const queryClient = new QueryClient();

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <a
          href="/"
          className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go home
        </a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <CurrencyProvider>
              <PageViewTracker />
              <Routes>
                <Route path="/" element={<Navigate to="/events" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/events" element={<EventsIndex />} />
                <Route path="/events/:id" element={<EventDetail />} />
                <Route path="/checkout/success" element={<CheckoutSuccess />} />
                <Route path="/checkout/mpesa" element={<ManualPayment />} />
                <Route path="/my-tickets" element={<MyTickets />} />
                <Route path="/setup-admin" element={<SetupAdmin />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="events" element={<AdminEvents />} />
                  <Route path="attendees" element={<Attendees />} />
                  <Route path="scanner" element={<Scanner />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="payments" element={<AdminPayments />} />
                  <Route path="activity" element={<ActivityLog />} />
                  <Route path="traffic" element={<Traffic />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              <Toaster position="top-right" />
            </CurrencyProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
