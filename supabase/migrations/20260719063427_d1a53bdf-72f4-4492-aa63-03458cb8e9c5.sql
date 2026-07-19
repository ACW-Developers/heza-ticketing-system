
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'mpesa',
  ADD COLUMN IF NOT EXISTS mpesa_code text,
  ADD COLUMN IF NOT EXISTS mpesa_phone text,
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS orders_mpesa_code_key
  ON public.orders (lower(mpesa_code))
  WHERE mpesa_code IS NOT NULL;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS mpesa_code text;

-- Existing (Paystack/Stripe) tickets should remain treated as confirmed
UPDATE public.tickets t
  SET payment_status = 'confirmed'
  FROM public.orders o
  WHERE t.order_id = o.id
    AND o.status = 'paid'
    AND t.payment_status = 'pending';
