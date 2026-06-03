// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@17.3.0?target=denonext";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";

const cartSchema = z.object({
  eventId: z.string().uuid(),
  origin: z.string().url(),
  items: z.array(
    z.object({
      type: z.enum(["children", "regular", "vip", "vvip"]),
      quantity: z.number().int().min(1).max(20),
    })
  ).min(1).max(8),
  attendee: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    phone: z.string().min(6).max(20),
  }),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "STRIPE_SECRET_KEY not configured" }, 500);

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = auth.slice(7);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;
    const userEmail = claims.claims.email as string | undefined;

    const data = cartSchema.parse(await req.json());

    const { data: event, error: evErr } = await supabase
      .from("events").select("*").eq("id", data.eventId).maybeSingle();
    if (evErr || !event) return json({ error: "Event not found" }, 404);

    const priceMap: Record<string, number> = {
      children: Number(event.price_children),
      regular: Number(event.price_regular),
      vip: Number(event.price_vip),
      vvip: Number(event.price_vvip),
    };
    const labelMap: Record<string, string> = { children: "Children", regular: "Regular", vip: "VIP", vvip: "VVIP" };

    let total = 0;
    const lineItems = data.items.map((it) => {
      const unit = priceMap[it.type];
      if (!unit || unit <= 0) throw new Error(`${it.type} tickets not available`);
      total += unit * it.quantity;
      return {
        quantity: it.quantity,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(unit * 100),
          product_data: { name: `${event.title} - ${labelMap[it.type]}`, description: event.venue },
        },
      };
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-09-30.acacia" });

    const { data: order, error: oErr } = await supabase
      .from("orders").insert({
        user_id: userId,
        event_id: data.eventId,
        total_amount: total,
        currency: "usd",
        status: "pending",
      }).select().single();
    if (oErr || !order) return json({ error: "Failed to create order" }, 500);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: data.attendee.email || userEmail,
      phone_number_collection: { enabled: true },
      billing_address_collection: "auto",
      success_url: `${data.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${data.origin}/events/${data.eventId}`,
      metadata: {
        order_id: order.id,
        event_id: data.eventId,
        user_id: userId,
        items: JSON.stringify(data.items),
        attendee_name: data.attendee.name,
        attendee_email: data.attendee.email,
        attendee_phone: data.attendee.phone,
      },
    });

    await supabase.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);

    return json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error("checkout error", e);
    return json({ error: e?.message ?? "Checkout failed" }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}