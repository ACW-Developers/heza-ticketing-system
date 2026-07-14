// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";

const cartSchema = z.object({
  eventId: z.string().uuid(),
  origin: z.string().url(),
  items: z
    .array(
      z.object({
        type: z.enum(["children", "regular", "vip", "vvip"]),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(8),
  attendee: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    phone: z.string().min(6).max(20),
    id_number: z.string().max(60).optional().default(""),
    country: z.string().max(80).optional().default(""),
    gender: z.string().max(20).optional().default(""),
    notes: z.string().max(500).optional().default(""),
  }),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const paystackKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackKey) return json({ error: "PAYSTACK_SECRET_KEY not configured" }, 500);

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = auth.slice(7);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const data = cartSchema.parse(await req.json());

    const { data: event, error: evErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", data.eventId)
      .maybeSingle();
    if (evErr || !event) return json({ error: "Event not found" }, 404);

    const priceMap: Record<string, number> = {
      children: Number(event.price_children),
      regular: Number(event.price_regular),
      vip: Number(event.price_vip),
      vvip: Number(event.price_vvip),
    };

    let total = 0;
    for (const it of data.items) {
      const unit = priceMap[it.type];
      if (!unit || unit <= 0) return json({ error: `${it.type} tickets not available` }, 400);
      total += unit * it.quantity;
    }

    const currency = (Deno.env.get("PAYSTACK_CURRENCY") ?? "KES").toUpperCase();
    // Amount is in the subunit (kobo/cents). KES/NGN/GHS/ZAR/USD all use *100.
    const amountSubunit = Math.round(total * 100);

    const { data: order, error: oErr } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        event_id: data.eventId,
        total_amount: total,
        currency: currency.toLowerCase(),
        status: "pending",
      })
      .select()
      .single();
    if (oErr || !order) return json({ error: "Failed to create order" }, 500);

    const reference =
      `ORD-${order.id.replace(/-/g, "").slice(0, 12)}-${Date.now().toString(36)}`.toUpperCase();

    const payload = {
      email: data.attendee.email,
      amount: amountSubunit,
      currency,
      reference,
      callback_url: `${data.origin}/checkout/success`,
      metadata: {
        order_id: order.id,
        event_id: data.eventId,
        user_id: userId,
        items: data.items,
        attendee: data.attendee,
        custom_fields: [
          { display_name: "Event", variable_name: "event", value: event.title },
          { display_name: "Attendee", variable_name: "attendee_name", value: data.attendee.name },
          { display_name: "Phone", variable_name: "phone", value: data.attendee.phone },
        ],
      },
    };

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok || !body?.status) {
      console.error("paystack init failed", body);
      return json({ error: body?.message ?? "Paystack initialization failed" }, 400);
    }

    await supabase.from("orders").update({ stripe_session_id: reference }).eq("id", order.id);

    return json({ url: body.data.authorization_url, reference, accessCode: body.data.access_code });
  } catch (e) {
    console.error("paystack-init error", e);
    return json({ error: e?.message ?? "Checkout failed" }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
