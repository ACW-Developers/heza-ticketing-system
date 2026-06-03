// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";

const schema = z.object({
  full_name: z.string().min(2).max(100),
  phone: z.string().min(6).max(20),
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const hasAdmin = async () => {
      const { count, error } = await admin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      if (error) throw new Error(error.message);
      return (count ?? 0) > 0;
    };

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? (req.method === "GET" ? "check" : "create");

    if (action === "check") {
      return json({ hasAdmin: await hasAdmin() });
    }

    if (action === "create") {
      if (await hasAdmin()) return json({ error: "An admin already exists" }, 403);

      const data = schema.parse(await req.json());

      const { data: created, error } = await admin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name, phone: data.phone },
      });
      if (error || !created.user) return json({ error: error?.message ?? "Failed to create user" }, 400);

      const uid = created.user.id;
      await admin.from("profiles").upsert(
        { user_id: uid, full_name: data.full_name, phone: data.phone, email: data.email },
        { onConflict: "user_id" }
      );
      const { error: roleErr } = await admin.from("user_roles").insert({ user_id: uid, role: "admin" });
      if (roleErr) return json({ error: roleErr.message }, 400);

      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("setup-admin error", e);
    return json({ error: e?.message ?? "Setup failed" }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}