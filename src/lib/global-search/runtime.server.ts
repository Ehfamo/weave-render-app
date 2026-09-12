import "@tanstack/react-start/server-only";
import { createClient } from "@supabase/supabase-js";
import { MemoryService } from "../memory/service.ts";
import { NativeMemoryAdapter } from "../memory/native-adapter.ts";
import { createProjectBrainService } from "../project-brain/runtime.server.ts";
import { nativeSources } from "./sources.ts";
import { GlobalSearchService } from "./service.ts";
export async function createSearchService(token: string) {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) throw new Error("SEARCH_AUTH_REQUIRED");
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("SEARCH_AUTH_REQUIRED");
  const userId = data.user.id;
  const access = {
    userId,
    async canReadProject(id: string) {
      const r = await client.rpc("xeomx_project_role", { p_project_id: id });
      return !r.error && ["owner", "editor", "viewer"].includes(r.data);
    },
  };
  const memory = new MemoryService(
    new NativeMemoryAdapter(userId, { rpc: (name, args) => client.rpc(name, args) }),
  );
  const brain = await createProjectBrainService(token);
  return new GlobalSearchService(
    nativeSources(
      {
        async rows(type, projectId) {
          const table = {
            project: "projects",
            conversation: "conversations",
            prompt: "prompts",
            asset: "assets",
            generation: "generation_jobs",
          }[type];
          const fields = {
            project: "id,name,description,created_at,updated_at",
            conversation: "id,project_id,title,created_at,updated_at",
            prompt: "id,author_id,title,description,created_at,updated_at",
            asset: "id,owner_id,project_id,kind,mime_type,metadata,created_at,updated_at",
            generation: "id,user_id,project_id,capability,status,created_at,updated_at",
          }[type];
          let q = client.from(table).select(fields);
          if (projectId) {
            if (type === "prompt") return [];
            q = q.eq(type === "project" ? "id" : "project_id", projectId);
          }
          if (type === "prompt") q = q.eq("author_id", userId);
          if (type === "asset") q = q.eq("owner_id", userId).neq("status", "deleted");
          if (type === "generation") q = q.eq("user_id", userId);
          const r = await q
            .order("updated_at", { ascending: false })
            .order("id", { ascending: true })
            .limit(100);
          if (r.error) throw new Error("SEARCH_SOURCE_UNAVAILABLE");
          return r.data;
        },
      },
      memory,
      brain,
      access,
    ),
    access,
  );
}
