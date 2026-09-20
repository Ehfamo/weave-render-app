import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { object, uuid } from "../memory/service.ts";
import type { ProjectsService } from "./service.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

type Context = { userId: string; supabase: unknown };
async function service(context: Context) {
  const { projectsForClient } = await import("./runtime.server.ts");
  return projectsForClient(context.userId, context.supabase as SupabaseClient);
}
async function safely<T>(work: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try { return { ok: true, data: await work() }; }
  catch { return { ok: false, error: "PROJECT_UNAVAILABLE" }; }
}
export const projectsHomeFn = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(({ context }) => safely(async () => (await service(context)).home()));
export const projectWorkspaceFn = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .validator((value: unknown) => { const v=object(value); return {projectId:uuid(v.projectId),conversationId:v.conversationId?uuid(v.conversationId):undefined}; })
  .handler(({ context, data }) => safely(async () => (await service(context)).open(data.projectId,data.conversationId)));
export const createDurableProjectFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((value: unknown) => { const v = object(value); return { name: v.name as string, goal: v.goal as string | undefined }; })
  .handler(({ context, data }) => safely(async () => (await service(context)).create(data)));
export const editDurableProjectFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((value: unknown) => {
    const v = object(value);
    return { projectId: uuid(v.projectId), name: v.name as string | undefined, goal: v.goal as string | undefined };
  })
  .handler(({ context, data }) => safely(async () => (await service(context)).edit(data.projectId, data)));
export const memoryControlFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((value: unknown) => value)
  .handler(({ context, data }) => safely(async (): Promise<Awaited<ReturnType<ProjectsService["memoryControl"]>>> =>
    (await service(context)).memoryControl(data)));
