import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const allowedOrigin = Deno.env.get("CLINIC_APP_ORIGIN")?.replace(/\/$/, "");

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = allowedOrigin && origin === allowedOrigin
    ? allowedOrigin
    : allowedOrigin ? "" : "null";
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": allowed } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function text(value: unknown, max: number) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max
    ? value.trim()
    : null;
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json(req, 405, { error: "Method not allowed" });
  if (!allowedOrigin) return json(req, 500, { error: "CLINIC_APP_ORIGIN is not configured" });
  if ((req.headers.get("Origin") || "") !== allowedOrigin) {
    return json(req, 403, { error: "Origin not allowed" });
  }

  try {
    const contentLength = Number(req.headers.get("Content-Length") || 0);
    if (contentLength > 16_384) return json(req, 413, { error: "Request too large" });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(req, 401, { error: "Authentication required" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json(req, 500, { error: "Server configuration is incomplete" });
    }

    const requester = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await requester.auth.getUser();
    if (userError || !userData.user) return json(req, 401, { error: "Authentication required" });

    const { data: profile, error: profileError } = await requester
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profileError || profile?.role !== "admin") {
      return json(req, 403, { error: "Admin access required" });
    }

    const body = await req.json();
    if (!body || typeof body !== "object") return json(req, 400, { error: "Invalid request body" });
    const action = body.action;
    if (!["create", "update", "delete"].includes(action)) {
      return json(req, 400, { error: "Invalid action" });
    }

    if (action === "create" || action === "update") {
      const fullName = text(body.full_name, 100);
      const email = text(body.email, 254);
      const role = text(body.role, 20);
      if (!fullName || !email || !role || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json(req, 400, { error: "Valid name, email, and role are required" });
      }
      if (!["admin", "doctor", "cashier"].includes(role)) {
        return json(req, 400, { error: "Invalid role" });
      }
      if (action === "create" && (typeof body.password !== "string" || body.password.length < 12)) {
        return json(req, 400, { error: "Password must contain at least 12 characters" });
      }
      if (action === "update" && body.password && (typeof body.password !== "string" || body.password.length < 12)) {
        return json(req, 400, { error: "Password must contain at least 12 characters" });
      }
      if (!body.password || typeof body.password !== "string" && action === "update") {
        // Update without password is valid.
      }
    }
    if (action !== "create" && !text(body.id, 36)) {
      return json(req, 400, { error: "Staff ID is required" });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (action === "create") {
      const { data, error } = await admin.auth.admin.createUser({
        email: body.email.trim(),
        password: body.password,
        email_confirm: true,
        user_metadata: { full_name: body.full_name.trim() },
      });
      if (error) return json(req, 400, { error: "Unable to create account" });
      const { error: profileError } = await admin.from("profiles").upsert({
        id: data.user.id,
        full_name: body.full_name.trim(),
        email: body.email.trim().toLowerCase(),
        role: body.role,
      });
      if (profileError) return json(req, 500, { error: "Account created but profile update failed" });
    } else if (action === "update") {
      if (!body.id || body.id === userData.user.id && body.role !== "admin") {
        return json(req, 400, { error: "Invalid account update" });
      }
      const attributes: Record<string, unknown> = {
        email: body.email.trim().toLowerCase(),
        email_confirm: true,
        user_metadata: { full_name: body.full_name.trim() },
      };
      if (body.password) attributes.password = body.password;
      const { error } = await admin.auth.admin.updateUserById(body.id, attributes);
      if (error) return json(req, 400, { error: "Unable to update account" });
      const { error: profileError } = await admin.from("profiles")
        .update({ full_name: body.full_name.trim(), email: body.email.trim().toLowerCase(), role: body.role })
        .eq("id", body.id);
      if (profileError) return json(req, 500, { error: "Profile update failed" });
    } else {
      if (body.id === userData.user.id) return json(req, 400, { error: "You cannot delete your own account" });
      const { error } = await admin.auth.admin.deleteUser(body.id, true);
      if (error) return json(req, 400, { error: "Unable to delete account" });
    }

    return json(req, 200, { ok: true });
  } catch {
    return json(req, 400, { error: "Invalid request" });
  }
});
