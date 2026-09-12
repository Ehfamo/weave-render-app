import "@tanstack/react-start/server-only";
import { createClient } from "@supabase/supabase-js";
import { NativeMemoryAdapter } from "../memory/native-adapter.ts";
import { MemoryService } from "../memory/service.ts";
import { createProjectDomain } from "./native-domain.ts";
import { ProjectBrainService } from "./service.ts";

export async function createProjectBrainService(
  token: string,
  env: { SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string } = process.env,
) {
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY)
    throw new Error("BRAIN_AUTH_REQUIRED");
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("BRAIN_AUTH_REQUIRED");
  async function safe(read: () => PromiseLike<{ data: unknown; error: unknown }>) {
    try {
      const r = await read();
      if (r.error) throw new Error();
      return r.data;
    } catch {
      throw new Error("PROJECT_STORAGE_ERROR");
    }
  }
  const domain = createProjectDomain(data.user.id, {
    role: (id) => safe(() => client.rpc("xeomx_project_role", { p_project_id: id })),
    project: (id) =>
      safe(() =>
        client.from("projects").select("id,name,description,updated_at").eq("id", id).maybeSingle(),
      ),
    conversations: (id, cid) =>
      safe(() => {
        let q = client
          .from("conversations")
          .select("id,project_id,title,updated_at")
          .eq("project_id", id);
        if (cid) q = q.eq("id", cid);
        return q
          .order("updated_at", { ascending: false })
          .order("id", { ascending: true })
          .limit(10);
      }),
  });
  return new ProjectBrainService(
    new MemoryService(
      new NativeMemoryAdapter(data.user.id, { rpc: (name, args) => client.rpc(name, args) }),
    ),
    domain,
  );
}
