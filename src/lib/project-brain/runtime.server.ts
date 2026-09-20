import "@tanstack/react-start/server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
  return projectBrainForClient(data.user.id, client);
}

/** Client must come from the authenticated server boundary. Never accepts a browser actor ID. */
export function projectBrainForClient(userId: string, client: SupabaseClient) {
  async function safe(read: () => PromiseLike<{ data: unknown; error: unknown }>) {
    try {
      const r = await read();
      if (r.error) throw new Error();
      return r.data;
    } catch {
      throw new Error("PROJECT_STORAGE_ERROR");
    }
  }
  const domain = createProjectDomain(userId, {
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
          .eq("project_id", id)
          .eq("created_by", userId);
        if (cid) q = q.eq("id", cid);
        return q
          .order("updated_at", { ascending: false })
          .order("id", { ascending: true })
          .limit(10);
      }),
  });
  domain.readBrain = async (id) => {
    await domain.getAuthorizedProject(id);
    const row = await safe(() =>
      client.from("projects").select("brain_entries").eq("id", id).single(),
    );
    return (row as { brain_entries: unknown }).brain_entries;
  };
  domain.writeBrain = async (id, next, expected) => {
    await domain.getAuthorizedProject(id);
    await safe(() =>
      client.rpc("xeomx_put_project_brain", {
        p_project_id: id,
        p_entries: next,
        p_expected: expected,
      }),
    );
  };
  domain.recentMessages = async (id, cid) => {
    if (!(await domain.authorizeConversation(id, cid)))
      throw new Error("CONVERSATION_ACCESS_DENIED");
    const rows = await safe(() =>
      client
        .from("messages")
        .select("id,role,content")
        .eq("project_id", id)
        .eq("conversation_id", cid)
        .in("role", ["user", "assistant"])
        .order("created_at", { ascending: false })
        .limit(4),
    );
    return (rows as { id: string; role: string; content: string }[]).reverse();
  };
  return new ProjectBrainService(
    new MemoryService(
      new NativeMemoryAdapter(userId, { rpc: (name, args) => client.rpc(name, args) }),
    ),
    domain,
  );
}
