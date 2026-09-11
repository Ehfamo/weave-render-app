import "@tanstack/react-start/server-only";
import { createClient } from "@supabase/supabase-js";
import { NativeMemoryAdapter } from "./native-adapter.ts";
import { MemoryService } from "./service.ts";

/** No service-role key. Fresh user authentication binds each service to its caller. */
export async function createMemoryService(
  token: string,
  env: { SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string } = process.env,
) {
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY)
    throw new Error("MEMORY_AUTH_REQUIRED");
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("MEMORY_AUTH_REQUIRED");
  return new MemoryService(
    new NativeMemoryAdapter(data.user.id, {
      rpc: (name, args) => client.rpc(name, args),
    }),
  );
}
