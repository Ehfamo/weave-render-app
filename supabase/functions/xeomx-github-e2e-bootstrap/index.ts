import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.2";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "xeomx-staging-e2e";
const REPOSITORY = "Ehfamo/weave-render-app";
const REF = "refs/heads/staging/xeomx-request7-cloudflare-live";
const JWKS = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
);

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function authorize(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) throw new Error("missing bearer token");

  const { payload } = await jwtVerify(header.slice(7), JWKS, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  if (payload.repository !== REPOSITORY) throw new Error("repository denied");
  if (payload.ref !== REF) throw new Error("ref denied");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  try {
    await authorize(req);
  } catch {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!url || !secretKeysRaw) {
    return json({ ok: false, error: "server_config_missing" }, 500);
  }

  let serviceKey: string | undefined;
  try {
    serviceKey = JSON.parse(secretKeysRaw)?.default;
  } catch {
    return json({ ok: false, error: "server_config_invalid" }, 500);
  }
  if (!serviceKey) return json({ ok: false, error: "server_key_missing" }, 500);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    user_id?: string;
  };

  if (body.action === "create") {
    const stamp = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const email = `xeomx.browser.e2e.${stamp}@gmail.com`;
    const password = `X7!${crypto.randomUUID()}z9A`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { purpose: "xeomx_request7_browser_e2e" },
    });

    if (created.error || !created.data.user) {
      return json({ ok: false, error: "create_user_failed" }, 500);
    }

    const userId = created.data.user.id;
    const grant = await admin.from("credit_ledger").insert({
      user_id: userId,
      project_id: null,
      job_id: null,
      usage_event_id: null,
      delta: 25,
      reason: "grant",
      idempotency_key: `browser-e2e-grant:${userId}`,
      metadata: { purpose: "request7_browser_e2e" },
    });

    if (grant.error) {
      await admin.auth.admin.deleteUser(userId);
      return json({ ok: false, error: "credit_grant_failed" }, 500);
    }

    return json({ ok: true, user_id: userId, email, password });
  }

  if (body.action === "cleanup") {
    if (!body.user_id || !/^[0-9a-f-]{36}$/i.test(body.user_id)) {
      return json({ ok: false, error: "invalid_user_id" }, 400);
    }

    const deleted = await admin.auth.admin.deleteUser(body.user_id);
    if (deleted.error) {
      return json({ ok: false, error: "delete_user_failed" }, 500);
    }
    return json({ ok: true });
  }

  return json({ ok: false, error: "invalid_action" }, 400);
});
