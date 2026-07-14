import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { UAParser } from "ua-parser-js";
import { supabase } from "@/integrations/supabase/client";

export function usePageView(extra?: { event_id?: string | null }) {
  const loc = useLocation();
  useEffect(() => {
    try {
      const ua = new UAParser(navigator.userAgent).getResult();
      const payload = {
        path: loc.pathname,
        event_id: extra?.event_id ?? null,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent.slice(0, 500),
        device: ua.device.type || "desktop",
        browser: ua.browser.name || "Unknown",
        os: ua.os.name || "Unknown",
        language: (navigator.language || "").slice(0, 12),
        country: null,
      };
      supabase
        .from("page_views")
        .insert(payload as any)
        .then(() => {});
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname, extra?.event_id]);
}
