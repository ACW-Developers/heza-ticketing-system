
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS poster_urls text[] NOT NULL DEFAULT '{}'::text[];

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'phone',
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.activity_logs (actor_id, actor_email, actor_name, action, entity_type, entity_id, metadata)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name', 'user.signup', 'user', NEW.id,
          jsonb_build_object('provider', NEW.raw_app_meta_data ->> 'provider'));
  RETURN NEW;
END;
$function$;
