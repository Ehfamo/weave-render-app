import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { object, uuid } from "../memory/service.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RuntimeRequest } from "./contracts.ts";
import { automationRuntimeState } from "./contracts.ts";
import { BUSINESS_PACKS } from "../business-agents/registry.ts";

type Context = { userId: string; supabase: unknown };
const token = () =>
  getRequest()
    .headers.get("authorization")
    ?.replace(/^Bearer /, "") ?? "";
const client = (ctx: Context) => ctx.supabase as SupabaseClient;
async function store(ctx: Context) {
  const { SupabaseRuntimeStore } = await import("./store.server.ts");
  const { supabaseAdmin } = await import("../../integrations/supabase/client.server");
  return new SupabaseRuntimeStore(
    ctx.userId,
    client(ctx),
    supabaseAdmin as unknown as SupabaseClient,
  );
}
async function safely<T>(run: () => Promise<T>) {
  try {
    return { ok: true as const, data: await run() };
  } catch {
    return { ok: false as const, error: "RUNTIME_UNAVAILABLE" };
  }
}
function text(value: unknown, limit: number) {
  if (typeof value !== "string" || !value.trim() || value.length > limit)
    throw Error("INVALID_INPUT");
  return value.trim();
}
export const capabilityReadFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ({ projectId: uuid(object(input).projectId) }))
  .handler(({ context, data }) =>
    safely(async () => {
      const s = await store(context);
      await s.authorize(data.projectId);
      const { publicJob } = await import("./runtime.server.ts");
      const { SupabaseP4Store } = await import("../automation/runtime.server.ts");
      const p4 = await SupabaseP4Store.create(client(context));
      const { database } = await import("./store.server.ts");
      const [jobs, artifacts, workflows, role, team, activity, approvals] = await Promise.all([
        s.list(data.projectId),
        s.artifacts(data.projectId),
        p4.workflows(data.projectId),
        p4.role(data.projectId),
        database(
          client(context)
            .from("project_members")
            .select("user_id,role")
            .eq("project_id", data.projectId),
        ),
        p4.activity(data.projectId),
        database(
          client(context)
            .from("approval_requests")
            .select("run_id,runtime_key,runtime_record,status")
            .eq("project_id", data.projectId)
            .eq("status", "pending")
            .not("runtime_key", "is", null),
        ),
      ]);
      return {
        jobs: jobs.map(publicJob),
        artifacts,
        workflows: workflows.map((workflow) => ({
          ...workflow,
          runtimeState: automationRuntimeState(workflow, jobs),
        })),
        role,
        team: team ?? [],
        activity,
        approvals: (approvals ?? []).map((x) => ({
          jobId: x.run_id,
          id: x.runtime_key as string,
          toolId: x.runtime_record?.toolId as string,
          risk: x.runtime_record?.risk as string,
        })),
      };
    }),
  );
export const capabilitySubmitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const v = object(input);
    const kind = v.kind;
    if (kind !== "creative" && kind !== "business") throw Error("INVALID_CAPABILITY");
    return {
      projectId: uuid(v.projectId),
      id: uuid(v.id),
      goal: text(v.goal, 20000),
      kind,
      selection: text(v.selection, 80),
    };
  })
  .handler(({ context, data }) =>
    safely(async () => {
      const task = {
        id: data.id,
        userId: context.userId,
        projectId: data.projectId,
        goal: data.goal,
        requestedAgent: data.kind === "creative" ? ("creative" as const) : undefined,
        createdAt: new Date().toISOString(),
      };
      const { runtimeForActor, publicJob } = await import("./runtime.server.ts");
      let request: RuntimeRequest;
      if (data.kind === "creative") {
        if (!["image", "video", "audio", "voice"].includes(data.selection))
          throw Error("INVALID_CREATIVE_CAPABILITY");
        const generation = {
          id: data.id,
          userId: context.userId,
          projectId: data.projectId,
          intent: data.selection as "image" | "video" | "audio" | "voice",
          prompt: { text: data.goal },
          references: [],
          characterIds: [],
          quality: "BALANCED" as const,
          createdAt: task.createdAt,
        };
        request = { task, idempotencyKey: data.id, capability: { kind: "creative", generation } };
        const runtime = await runtimeForActor(context.userId, client(context), token(), request);
        await runtime.creative.requestGeneration(generation);
        return publicJob(await runtime.store.get(data.id));
      }
      const agent = BUSINESS_PACKS.flatMap((x) => x.agents).find((x) => x.id === data.selection);
      if (!agent) throw Error("BUSINESS_AGENT_UNAVAILABLE");
      request = {
        task,
        idempotencyKey: data.id,
        capability: { kind: "business", agentId: agent.id },
      };
      const runtime = await runtimeForActor(context.userId, client(context), token(), request);
      return publicJob(await runtime.jobs.submit(request));
    }),
  );
export const capabilityJobFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const v = object(input);
    if (!["run", "cancel", "retry", "recover"].includes(String(v.action)))
      throw Error("INVALID_ACTION");
    return { id: uuid(v.id), action: String(v.action) };
  })
  .handler(({ context, data }) =>
    safely(async () => {
      const s = await store(context);
      const job = await s.get(data.id);
      const { runtimeForActor, publicJob } = await import("./runtime.server.ts");
      if (data.action === "cancel") return publicJob(await s.cancel(job.id));
      if (data.action === "recover")
        return publicJob(
          (await import("./store.server.ts")).runtimeRow((await s.command("recover", job.id))!),
        );
      if (data.action === "retry") return publicJob(await s.retry(job.id));
      const runtime = await runtimeForActor(context.userId, client(context), token(), job.request);
      return publicJob(await runtime.jobs.run(job.id, getRequest().signal));
    }),
  );
export const capabilityDecisionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const v = object(input);
    if (v.decision !== "approved" && v.decision !== "rejected") throw Error("INVALID_DECISION");
    return { id: uuid(v.id), approvalId: text(v.approvalId, 250), decision: v.decision };
  })
  .handler(({ context, data }) =>
    safely(async () => {
      const s = await store(context);
      await s.command("decide", data.id, data);
      return { recorded: true };
    }),
  );
export const automationControlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const v = object(input);
    return {
      projectId: uuid(v.projectId),
      action: text(v.action, 30),
      id: v.id ? uuid(v.id) : undefined,
      name: v.name ? text(v.name, 120) : undefined,
      goal: v.goal ? text(v.goal, 4000) : undefined,
      approval: v.approval === true,
    };
  })
  .handler(({ context, data }) =>
    safely(async () => {
      const { operationsForActor } = await import("./runtime.server.ts");
      const runtime = await operationsForActor(
        context.userId,
        client(context),
        token(),
        data.projectId,
      );
      const now = new Date().toISOString();
      if (data.action === "create") {
        if (!data.name || !data.goal) throw Error("INVALID_WORKFLOW");
        return {
          workflow: await runtime.automation.create({
            id: crypto.randomUUID(),
            ownerId: context.userId,
            projectId: data.projectId,
            name: data.name,
            status: "draft",
            trigger: { kind: "manual" },
            conditions: [],
            steps: [
              {
                id: "run",
                order: 0,
                actionId: "agent.run",
                input: { goal: data.goal },
                requiresApproval: data.approval,
                retries: 0,
              },
            ],
            version: 1,
            createdAt: now,
            updatedAt: now,
          }),
        };
      }
      if (!data.id || !(await runtime.p4.workflows(data.projectId)).some((x) => x.id === data.id))
        throw Error("WORKFLOW_NOT_FOUND");
      if (data.action === "enable" || data.action === "pause")
        return { workflow: await runtime.automation.setEnabled(data.id, data.action === "enable") };
      if (data.action === "run")
        return {
          execution: (
            await runtime.automation.manual(data.id, {
              id: crypto.randomUUID(),
              projectId: data.projectId,
              kind: "manual",
              correlationId: crypto.randomUUID(),
              payload: {},
              createdAt: now,
            })
          ).execution,
        };
      throw Error("INVALID_WORKFLOW_ACTION");
    }),
  );
export const teamRoleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const v = object(input);
    if (v.role !== "editor" && v.role !== "viewer") throw Error("INVALID_ROLE");
    return {
      projectId: uuid(v.projectId),
      userId: uuid(v.userId),
      role: v.role as "editor" | "viewer",
    };
  })
  .handler(({ context, data }) =>
    safely(async () => {
      const { CollaborationService } = await import("../collaboration/service.ts");
      const { SupabaseP4Store } = await import("../automation/runtime.server.ts");
      const service = new CollaborationService(await SupabaseP4Store.create(client(context)));
      return service.changeRole(data.projectId, data.userId, data.role);
    }),
  );
