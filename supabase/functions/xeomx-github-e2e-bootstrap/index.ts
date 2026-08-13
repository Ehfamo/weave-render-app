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
    const searchTerm = `xeomxsearch${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
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
    const profile = await admin.from("profiles").insert({
      id: userId,
      username: searchTerm,
      display_name: `Creator ${searchTerm}`,
      bio: `Search fixture ${searchTerm}`,
      is_creator: true,
    });
    if (profile.error) {
      await admin.auth.admin.deleteUser(userId);
      return json({ ok: false, error: "profile_fixture_failed" }, 500);
    }

    const promptSlug = `${searchTerm}-prompt`;
    const prompt = await admin
      .from("prompts")
      .insert({
        author_id: userId,
        title: `Live Search ${searchTerm}`,
        slug: promptSlug,
        description: `Published Search fixture ${searchTerm}`,
        body: `This is the real Search V1 browser fixture for ${searchTerm}.`,
        category: "Writing",
        tags: ["search-v1", searchTerm],
        is_published: true,
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (prompt.error || !prompt.data) {
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      return json({ ok: false, error: "prompt_fixture_failed" }, 500);
    }

    const collectionSlug = `${searchTerm}-collection`;
    const collection = await admin
      .from("collections")
      .insert({
        owner_id: userId,
        title: `Collection ${searchTerm}`,
        slug: collectionSlug,
        description: `Public Search fixture ${searchTerm}`,
        is_public: true,
      })
      .select("id")
      .single();
    if (collection.error || !collection.data) {
      await admin.from("prompts").delete().eq("author_id", userId);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      return json({ ok: false, error: "collection_fixture_failed" }, 500);
    }

    const item = await admin.from("collection_items").insert({
      collection_id: collection.data.id,
      prompt_id: prompt.data.id,
      position: 0,
    });
    if (item.error) {
      await admin.from("collections").delete().eq("owner_id", userId);
      await admin.from("prompts").delete().eq("author_id", userId);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      return json({ ok: false, error: "collection_item_fixture_failed" }, 500);
    }

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
      await admin.from("collection_items").delete().eq("collection_id", collection.data.id);
      await admin.from("collections").delete().eq("owner_id", userId);
      await admin.from("prompts").delete().eq("author_id", userId);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      return json({ ok: false, error: "credit_grant_failed" }, 500);
    }

    return json({
      ok: true,
      user_id: userId,
      email,
      password,
      search_term: searchTerm,
      search_prompt_slug: promptSlug,
      search_collection_slug: collectionSlug,
    });
  }

  if (body.action === "cleanup") {
    if (!body.user_id || !/^[0-9a-f-]{36}$/i.test(body.user_id)) {
      return json({ ok: false, error: "invalid_user_id" }, 400);
    }

    const collections = await admin.from("collections").select("id").eq("owner_id", body.user_id);
    if (collections.error) return json({ ok: false, error: "cleanup_lookup_failed" }, 500);

    const collectionIds = (collections.data ?? []).map((row) => row.id);
    if (collectionIds.length) {
      const items = await admin.from("collection_items").delete().in("collection_id", collectionIds);
      if (items.error) return json({ ok: false, error: "cleanup_items_failed" }, 500);
    }

    const collectionDelete = await admin.from("collections").delete().eq("owner_id", body.user_id);
    if (collectionDelete.error) return json({ ok: false, error: "cleanup_collections_failed" }, 500);

    const promptDelete = await admin.from("prompts").delete().eq("author_id", body.user_id);
    if (promptDelete.error) return json({ ok: false, error: "cleanup_prompts_failed" }, 500);

    const profileDelete = await admin.from("profiles").delete().eq("id", body.user_id);
    if (profileDelete.error) return json({ ok: false, error: "cleanup_profile_failed" }, 500);

    const deleted = await admin.auth.admin.deleteUser(body.user_id);
    if (deleted.error) {
      return json({ ok: false, error: "delete_user_failed" }, 500);
    }
    return json({ ok: true });
  }

  return json({ ok: false, error: "invalid_action" }, 400);
});
