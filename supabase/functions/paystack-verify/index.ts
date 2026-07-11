// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const paystackKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackKey) return json({ error: "PAYSTACK_SECRET_KEY not configured" }, 500);

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = auth.slice(7);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { reference } = z.object({ reference: z.string().min(6) }).parse(await req.json());

    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackKey}` },
    });
    const body = await res.json();
    if (!res.ok || !body?.status) {
      console.error("paystack verify failed", body);
      return json({ error: body?.message ?? "Verification failed" }, 400);
    }

    const tx = body.data;
    if (tx.status !== "success") return json({ status: "pending" });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: order } = await admin
      .from("orders").select("*").eq("stripe_session_id", reference).maybeSingle();
    if (!order) return json({ error: "Order not found" }, 404);
    if (order.user_id !== userId) return json({ error: "Unauthorized" }, 403);

    if (order.status === "paid") {
      const { data: tickets } = await admin.from("tickets").select("*").eq("order_id", order.id);
      return json({ status: "paid", order, tickets: tickets ?? [] });
    }

    const meta = tx.metadata ?? {};
    const items = (meta.items ?? []) as Array<{ type: string; quantity: number }>;
    const attendee = meta.attendee ?? {};

    const { data: event } = await admin.from("events").select("*").eq("id", order.event_id).single();
    if (!event) return json({ error: "Event missing" }, 404);

    const priceMap: Record<string, number> = {
      children: Number(event.price_children),
      regular: Number(event.price_regular),
      vip: Number(event.price_vip),
      vvip: Number(event.price_vvip),
    };

    const ticketsToInsert: any[] = [];
    for (const it of items) {
      for (let i = 0; i < it.quantity; i++) {
        const num = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        ticketsToInsert.push({
          order_id: order.id,
          event_id: order.event_id,
          user_id: userId,
          ticket_type: it.type,
          ticket_number: num,
          attendee_name: attendee.name ?? null,
          attendee_email: attendee.email ?? null,
          attendee_phone: attendee.phone ?? null,
          id_number: attendee.id_number || null,
          country: attendee.country || null,
          gender: attendee.gender || null,
          notes: attendee.notes || null,
          price: priceMap[it.type],
        });
      }
    }

    const { data: inserted, error: tErr } = await admin.from("tickets").insert(ticketsToInsert).select();
    if (tErr) return json({ error: "Failed to issue tickets: " + tErr.message }, 500);

    await admin.from("orders").update({ status: "paid" }).eq("id", order.id);

    return json({ status: "paid", order: { ...order, status: "paid" }, tickets: inserted ?? [] });
  } catch (e) {
    console.error("paystack-verify error", e);
    return json({ error: e?.message ?? "Verify failed" }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
