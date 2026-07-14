import { useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";
import { UAParser } from "ua-parser-js";
import { supabase } from "@/integrations/supabase/client";

/** Inserts a page_view row on every route change. Skips admin pages. */
export function PageViewTracker() {
  const loc = useLocation();
  const params = useParams();
  useEffect(() => {
    if (loc.pathname.startsWith("/admin")) return;
    try {
      const ua = new UAParser(navigator.userAgent).getResult();
      // event_id is best-effort from URL pattern /events/:id
      const m = loc.pathname.match(/^\/events\/([0-9a-f-]{36})/i);
      const event_id = m ? m[1] : null;
      const payload = {
        path: loc.pathname,
        event_id,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent.slice(0, 500),
        device: ua.device.type || "desktop",
        browser: ua.browser.name || "Unknown",
        os: ua.os.name || "Unknown",
        language: (navigator.language || "").slice(0, 12),
      };
      supabase
        .from("page_views")
        .insert(payload as any)
        .then(() => {});
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname]);
  return null;
}
