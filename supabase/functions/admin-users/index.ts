// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = auth.slice(7);

    const supa = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData } = await supa.auth.getUser(token);
    const requester = userData?.user;
    if (!requester) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: roleRow } = await admin.from("user_roles")
      .select("role").eq("user_id", requester.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Admins only" }, 403);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action || new URL(req.url).searchParams.get("action") || "list";

    if (action === "list") {
      const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) return json({ error: error.message }, 500);
      const ids = list.users.map((u) => u.id);
      const [{ data: profiles }, { data: roles }, { data: tickets }] = await Promise.all([
        admin.from("profiles").select("*").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
        admin.from("user_roles").select("user_id, role").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
        admin.from("tickets").select("user_id"),
      ]);
      const pMap: Record<string, any> = {};
      for (const p of profiles ?? []) pMap[p.user_id] = p;
      const rMap: Record<string, string[]> = {};
      for (const r of roles ?? []) (rMap[r.user_id] ??= []).push(r.role);
      const tMap: Record<string, number> = {};
      for (const t of tickets ?? []) tMap[t.user_id] = (tMap[t.user_id] ?? 0) + 1;

      const users = list.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed_at: u.email_confirmed_at,
        full_name: pMap[u.id]?.full_name ?? u.user_metadata?.full_name ?? null,
        phone: pMap[u.id]?.phone ?? u.user_metadata?.phone ?? null,
        roles: rMap[u.id] ?? ["user"],
        ticket_count: tMap[u.id] ?? 0,
        banned: !!u.banned_until,
      }));
      return json({ users });
    }

    if (action === "set_role") {
      const { user_id, role, enabled } = body;
      if (!user_id || !role) return json({ error: "Missing fields" }, 400);
      if (enabled) {
        await admin.from("user_roles").upsert({ user_id, role }, { onConflict: "user_id,role" });
      } else {
        if (user_id === requester.id && role === "admin") return json({ error: "Cannot remove your own admin role" }, 400);
        await admin.from("user_roles").delete().eq("user_id", user_id).eq("role", role);
      }
      await admin.from("activity_logs").insert({
        actor_id: requester.id, actor_email: requester.email,
        action: enabled ? "user.role.granted" : "user.role.revoked",
        entity_type: "user", entity_id: user_id, metadata: { role },
      });
      return json({ ok: true });
    }

    if (action === "send_password_reset") {
      const { email, redirect_to } = body;
      if (!email) return json({ error: "Missing email" }, 400);
      const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo: redirect_to });
      if (error) return json({ error: error.message }, 400);
      await admin.from("activity_logs").insert({
        actor_id: requester.id, actor_email: requester.email,
        action: "user.password_reset_sent", entity_type: "user", metadata: { email },
      });
      return json({ ok: true });
    }

    if (action === "delete_user") {
      const { user_id } = body;
      if (!user_id) return json({ error: "Missing user_id" }, 400);
      if (user_id === requester.id) return json({ error: "Cannot delete yourself" }, 400);
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) return json({ error: error.message }, 400);
      await admin.from("activity_logs").insert({
        actor_id: requester.id, actor_email: requester.email,
        action: "user.deleted", entity_type: "user", entity_id: user_id,
      });
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("admin-users error", e);
    return json({ error: e?.message ?? "Failed" }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
