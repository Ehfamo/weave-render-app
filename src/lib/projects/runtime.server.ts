import "@tanstack/react-start/server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createProject,
  listProjects,
  loadProjectSnapshot,
  updateProject,
} from "../backend/vertical-slice.server";
import { projectBrainForClient } from "../project-brain/runtime.server.ts";
import { MemoryService } from "../memory/service.ts";
import { NativeMemoryAdapter } from "../memory/native-adapter.ts";
import { ProjectsService, type ProjectActivity } from "./service.ts";

export function projectsForClient(userId: string, client: SupabaseClient) {
  async function safe<T>(request: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
    try {
      const r = await request;
      if (r.error) throw new Error();
      return r.data;
    } catch {
      throw new Error("PROJECT_STORAGE_ERROR");
    }
  }
  const brain = projectBrainForClient(userId, client);
  const memory = new MemoryService(
    new NativeMemoryAdapter(userId, { rpc: (name, args) => client.rpc(name, args) }),
  );
  return new ProjectsService(
    {
      userId,
      async authorize(id, write = false) {
        const role = await safe(client.rpc("xeomx_project_role", { p_project_id: id }));
        if (!(write ? ["owner", "editor"] : ["owner", "editor", "viewer"]).includes(role))
          throw new Error("PROJECT_ACCESS_DENIED");
      },
      list: () => listProjects(client),
      create: (input) => createProject(client, input),
      load: (id) => loadProjectSnapshot(client, id, { recentMessages: true }),
      async rename(id, name) {
        const { project } = await loadProjectSnapshot(client, id);
        await updateProject(client, {
          projectId: id,
          name,
          description: project.description ?? undefined,
          routingMode: project.defaultRoutingMode,
          defaultModel: project.defaultModel ?? undefined,
        });
      },
      async activity(id) {
        const rows = await safe(
          client
            .from("conversations")
            .select("id,project_id,title,updated_at,core_execution")
            .eq("project_id", id)
            .eq("created_by", userId)
            .order("updated_at", { ascending: false })
            .limit(10),
        );
        return (rows ?? []).map((row): ProjectActivity => ({
          id: row.id,
          projectId: row.project_id,
          title: row.title,
          updatedAt: row.updated_at,
          ...(row.core_execution?.state ? { state: row.core_execution.state } : {}),
        }));
      },
      async begin(input) {
        return safe(
          client.rpc("xeomx_begin_core_execution", {
            p_project_id: input.projectId,
            p_execution_id: input.executionId,
            p_previous_conversation_id: input.conversationId ?? null,
            p_goal: input.goal,
            p_key: input.idempotencyKey,
            p_hash: input.requestHash,
          }),
        );
      },
      async finish(id, response) {
        await safe(
          client.rpc("xeomx_finish_core_execution", {
            p_conversation_id: id,
            p_response: response,
          }),
        );
      },
    },
    brain,
    memory,
  );
}
