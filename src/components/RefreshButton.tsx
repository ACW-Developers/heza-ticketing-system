import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function RefreshButton({ label = "Refresh" }: { label?: string }) {
  const [busy, setBusy] = useState(false);

  async function handleRefresh() {
    setBusy(true);
    try {
      // Clear browser caches
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      // Clear app-level cached data (preserve auth tokens)
      try {
        const preserve: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (
            k &&
            (k.startsWith("sb-") ||
              k.includes("supabase.auth") ||
              k.startsWith("smarticketing.") ||
              k === "theme")
          ) {
            preserve[k] = localStorage.getItem(k) ?? "";
          }
        }
        localStorage.clear();
        Object.entries(preserve).forEach(([k, v]) => localStorage.setItem(k, v));
        sessionStorage.clear();
      } catch {}
      toast.success("Refreshed to latest state");
      setTimeout(() => window.location.reload(), 300);
    } catch (e) {
      toast.error("Refresh failed");
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={busy}>
      <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
      {label}
    </Button>
  );
}