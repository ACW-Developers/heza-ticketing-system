// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";

const schema = z.object({
  eventId: z.string().uuid(),
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
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(255),
    phone: z.string().trim().min(6).max(20),
    id_number: z.string().max(60).optional().default(""),
    country: z.string().max(80).optional().default(""),
    gender: z.string().max(20).optional().default(""),
    notes: z.string().max(500).optional().default(""),
  }),
  mpesaCode: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{8,12}$/, "Invalid M-Pesa code format")),
  mpesaPhone: z.string().trim().min(6).max(20),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Please sign in to continue" }, 401);
    const token = auth.slice(7);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Please sign in to continue" }, 401);
    const userId = userData.user.id;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return json({ error: first?.message ?? "Invalid input" }, 400);
    }
    const data = parsed.data;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Prevent reuse of the same M-Pesa code
    const { data: existing } = await admin
      .from("orders")
      .select("id")
      .ilike("mpesa_code", data.mpesaCode)
      .maybeSingle();
    if (existing)
      return json(
        { error: "This M-Pesa code has already been submitted. Please double-check the code." },
        409,
      );

    const { data: event, error: evErr } = await admin
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

    const { data: order, error: oErr } = await admin
      .from("orders")
      .insert({
        user_id: userId,
        event_id: data.eventId,
        total_amount: total,
        currency: "kes",
        status: "pending",
        payment_method: "mpesa",
        mpesa_code: data.mpesaCode,
        mpesa_phone: data.mpesaPhone,
      })
      .select()
      .single();
    if (oErr || !order) {
      if ((oErr?.message ?? "").toLowerCase().includes("duplicate"))
        return json({ error: "This M-Pesa code has already been submitted." }, 409);
      return json({ error: "Failed to record your payment. Please try again." }, 500);
    }

    const rows: any[] = [];
    for (const it of data.items) {
      for (let i = 0; i < it.quantity; i++) {
        const num = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        rows.push({
          order_id: order.id,
          event_id: data.eventId,
          user_id: userId,
          ticket_type: it.type,
          ticket_number: num,
          attendee_name: data.attendee.name,
          attendee_email: data.attendee.email,
          attendee_phone: data.attendee.phone,
          id_number: data.attendee.id_number || null,
          country: data.attendee.country || null,
          gender: data.attendee.gender || null,
          notes: data.attendee.notes || null,
          price: priceMap[it.type],
          payment_status: "pending",
          mpesa_code: data.mpesaCode,
        });
      }
    }

    const { data: tickets, error: tErr } = await admin.from("tickets").insert(rows).select();
    if (tErr) {
      await admin.from("orders").delete().eq("id", order.id);
      return json({ error: "Failed to register your tickets. Please try again." }, 500);
    }

    return json({
      status: "pending",
      order_id: order.id,
      total,
      tickets: tickets ?? [],
      message:
        "Payment submitted. Your tickets will be activated once we confirm the M-Pesa transaction.",
    });
  } catch (e) {
    console.error("mpesa-checkout error", e);
    return json({ error: e?.message ?? "Checkout failed" }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
