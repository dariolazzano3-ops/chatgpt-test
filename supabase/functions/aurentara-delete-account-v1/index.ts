import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  }
});

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ ok: false, error: "AUTHENTICATED_USER_REQUIRED" }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "INVALID_JSON" }, 400); }
  if (body.confirm !== "DELETE_MY_AURENTARA_DATA") return json({ ok: false, error: "EXPLICIT_DELETION_CONFIRMATION_REQUIRED" }, 400);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const publishable = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const secret = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !publishable || !secret) return json({ ok: false, error: "SERVER_AUTH_CONFIGURATION_MISSING" }, 503);

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  });
  const token = authHeader.slice(7);
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ ok: false, error: "CUSTOMER_SESSION_INVALID" }, 401);

  const { data: memberships, error: membershipError } = await userClient
    .schema("aurentara_customer_ai")
    .from("memberships")
    .select("tenant_id,user_id,role,status")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (membershipError || !memberships?.length) return json({ ok: false, error: "ACTIVE_TENANT_MEMBERSHIP_REQUIRED" }, 403);
  const ownerMembership = memberships.find((item) => item.role === "owner");
  if (!ownerMembership) return json({ ok: false, error: "TENANT_OWNER_REQUIRED" }, 403);

  const tenantId = ownerMembership.tenant_id;
  const { data: activeMembers, error: memberCountError } = await userClient
    .schema("aurentara_customer_ai")
    .from("memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("status", "active");
  if (memberCountError) return json({ ok: false, error: "TENANT_MEMBERSHIP_CHECK_FAILED" }, 503);
  if ((activeMembers?.length || 0) !== 1) return json({ ok: false, error: "TENANT_DELETION_REQUIRES_SOLE_OWNER" }, 409);

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const auditId = `delete_${crypto.randomUUID()}`;
  const { data: deletionData, error: deletionError } = await admin
    .schema("aurentara_customer_ai")
    .rpc("hard_delete_tenant", { p_tenant_id: tenantId, p_audit_id: auditId });
  if (deletionError || !deletionData?.ok) return json({ ok: false, error: "CUSTOMER_DATA_DELETION_FAILED", audit_id: auditId }, 500);

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id, false);
  if (authDeleteError) {
    return json({
      ok: false,
      error: "CUSTOMER_AUTH_DELETION_FAILED_AFTER_DATA_PURGE",
      audit_id: auditId,
      tenant_fingerprint: deletionData.tenant_fingerprint || null,
      customer_data_deleted: true,
      auth_user_deleted: false
    }, 500);
  }

  return json({
    ok: true,
    audit_id: auditId,
    tenant_fingerprint: deletionData.tenant_fingerprint || null,
    deleted_counts: deletionData.deleted_counts || {},
    customer_data_deleted: true,
    auth_user_deleted: true
  });
});
