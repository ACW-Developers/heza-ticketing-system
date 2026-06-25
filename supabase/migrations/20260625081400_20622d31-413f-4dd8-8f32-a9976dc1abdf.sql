
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS id_number TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read activity" ON public.activity_logs;
CREATE POLICY "Admins read activity" ON public.activity_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Auth users insert activity" ON public.activity_logs;
CREATE POLICY "Auth users insert activity" ON public.activity_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  for_admin BOOLEAN NOT NULL DEFAULT true,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_by UUID[] DEFAULT ARRAY[]::UUID[],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read notifications" ON public.notifications;
CREATE POLICY "Admins read notifications" ON public.notifications
  FOR SELECT USING (for_admin AND public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins update notifications" ON public.notifications;
CREATE POLICY "Admins update notifications" ON public.notifications
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_on_ticket()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE evt_title TEXT;
BEGIN
  SELECT title INTO evt_title FROM public.events WHERE id = NEW.event_id;
  INSERT INTO public.notifications (for_admin, title, body, link, metadata)
  VALUES (true, 'New ticket sold',
    COALESCE(NEW.attendee_name, 'Guest') || ' purchased a ' || NEW.ticket_type::text || ' ticket' ||
      CASE WHEN evt_title IS NOT NULL THEN ' for ' || evt_title ELSE '' END,
    '/admin/attendees',
    jsonb_build_object('ticket_id', NEW.id, 'event_id', NEW.event_id, 'price', NEW.price));
  INSERT INTO public.activity_logs (actor_id, actor_email, actor_name, action, entity_type, entity_id, metadata)
  VALUES (NEW.user_id, NEW.attendee_email, NEW.attendee_name, 'ticket.purchased', 'ticket', NEW.id,
    jsonb_build_object('ticket_number', NEW.ticket_number, 'type', NEW.ticket_type, 'event_id', NEW.event_id, 'price', NEW.price));
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_notify_on_ticket ON public.tickets;
CREATE TRIGGER trg_notify_on_ticket AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_ticket();

CREATE OR REPLACE FUNCTION public.log_ticket_checkin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.checked_in = true AND (OLD.checked_in IS DISTINCT FROM true) THEN
    INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'ticket.checked_in', 'ticket', NEW.id,
      jsonb_build_object('ticket_number', NEW.ticket_number, 'event_id', NEW.event_id, 'attendee', NEW.attendee_name));
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_log_ticket_checkin ON public.tickets;
CREATE TRIGGER trg_log_ticket_checkin AFTER UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_checkin();

CREATE TABLE IF NOT EXISTS public.page_views (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  path TEXT NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  referrer TEXT,
  user_agent TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  country TEXT,
  language TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.page_views TO anon, authenticated;
GRANT SELECT ON public.page_views TO authenticated;
GRANT ALL ON public.page_views TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.page_views_id_seq TO anon, authenticated;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_views;
CREATE POLICY "Anyone can insert page views" ON public.page_views FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admins read page views" ON public.page_views;
CREATE POLICY "Admins read page views" ON public.page_views
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_page_views_created ON public.page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_event ON public.page_views(event_id);
