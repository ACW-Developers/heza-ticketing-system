// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";

const schema = z.object({
  orderId: z.string().uuid(),
  decision: z.enum(["confirm", "reject"]),
  note: z.string().max(500).optional().default(""),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = auth.slice(7);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Admin only" }, 403);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid input" }, 400);
    const { orderId, decision, note } = parsed.data;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const newOrderStatus = decision === "confirm" ? "paid" : "failed";
    const newTicketStatus = decision === "confirm" ? "confirmed" : "rejected";

    const { data: order, error } = await admin
      .from("orders")
      .update({
        status: newOrderStatus,
        admin_note: note || null,
        approved_at: new Date().toISOString(),
        approved_by: userData.user.id,
      })
      .eq("id", orderId)
      .select()
      .single();
    if (error || !order) return json({ error: "Order not found" }, 404);

    await admin
      .from("tickets")
      .update({ payment_status: newTicketStatus })
      .eq("order_id", orderId);

    await admin.from("activity_logs").insert({
      actor_id: userData.user.id,
      actor_email: userData.user.email,
      action: decision === "confirm" ? "payment.confirmed" : "payment.rejected",
      entity_type: "order",
      entity_id: orderId,
      metadata: { mpesa_code: order.mpesa_code, total: order.total_amount, note },
    });

    return json({ ok: true, order });
  } catch (e) {
    console.error("mpesa-approve error", e);
    return json({ error: e?.message ?? "Failed" }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
