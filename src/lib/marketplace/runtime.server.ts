import "@tanstack/react-start/server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseMarketplaceStore } from "./store.server.ts";
import { MarketplaceService } from "./service.ts";
import { sandboxRuntime } from "./sandbox.ts";
import { ephemeralServices } from "../core-execution/runtime.server.ts";
import { createModelGatewayRuntime } from "../model-gateway/runtime.server.ts";
export async function marketplaceForRequest(authorization: string | null) {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw Error("NOT_CONFIGURED");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(authorization ? { global: { headers: { Authorization: authorization } } } : {}),
  });
  let userId: string | undefined;
  if (authorization) {
    if (!authorization.startsWith("Bearer ")) throw Error("AUTH_REQUIRED");
    const result = await client.auth.getClaims(authorization.slice(7));
    if (result.error || !result.data?.claims.sub) throw Error("AUTH_REQUIRED");
    userId = result.data.claims.sub;
  }
  return new MarketplaceService(
    new SupabaseMarketplaceStore(userId, client, supabaseAdmin as unknown as SupabaseClient),
    sandboxRuntime((actor) => ({
      ...ephemeralServices(actor, actor),
      gateway: createModelGatewayRuntime().gateway,
    })),
  );
}
