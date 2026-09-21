import "@tanstack/react-start/server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../integrations/supabase/client.server";
import { providerSignals } from "../core-execution/runtime.server.ts";
import { projectsForClient } from "../projects/runtime.server.ts";
import { createSearchService } from "../global-search/runtime.server.ts";
import { createModelGatewayRuntime } from "../model-gateway/runtime.server.ts";
import { DurableApprovalAuthority } from "../agents/durable-approval.ts";
import { CreativeWorkspaceService } from "../creative/workspace.ts";
import { AssetLibrary } from "../creative/asset-library.ts";
import type { CreativeAsset, CreativeWorkspace } from "../creative/contracts.ts";
import { AutomationService } from "../automation/service.ts";
import { canonicalAutomationActions } from "../automation/actions.ts";
import { SupabaseP4Store } from "../automation/runtime.server.ts";
import { CollaborationService } from "../collaboration/service.ts";
import { composeCapabilityRuntime } from "./composition.ts";
import { SupabaseRuntimeStore, database } from "./store.server.ts";
import type { RuntimeJob, RuntimeRequest } from "./contracts.ts";

export async function runtimeForActor(
  userId: string,
  client: SupabaseClient,
  token: string,
  request: RuntimeRequest,
) {
  const store = new SupabaseRuntimeStore(
    userId,
    client,
    supabaseAdmin as unknown as SupabaseClient,
  );
  await store.authorize(request.task.projectId, true);
  const projects = projectsForClient(userId, client);
  const approvals = new DurableApprovalAuthority(store.approvals(), undefined, true);
  const search = await createSearchService(token, {
    projectId: request.task.projectId,
    conversationId: request.task.conversationId,
  });
  const { gateway, registry: providers } = createModelGatewayRuntime();
  async function creativeAssets(projectId: string): Promise<CreativeAsset[]> {
    await store.authorize(projectId);
    const rows = await database(
      client.from("assets").select("*").eq("project_id", projectId).eq("owner_id", userId),
    );
    return (rows ?? [])
      .filter((r) => r.status !== "deleted")
      .map((r) => ({
        id: r.id,
        ownerId: r.owner_id,
        projectId: r.project_id,
        type: ["image", "video", "audio", "voice", "document"].includes(r.kind)
          ? r.kind
          : "generation-output",
        name: r.metadata?.title ?? r.kind,
        status: "active",
        mimeType: r.mime_type,
        generationId: r.controlled_run_id ?? r.generation_job_id,
        metadata: r.metadata,
        provenance: {
          kind: r.origin === "generation" ? "generation" : "upload",
          sourceId: r.controlled_run_id ?? r.generation_job_id,
        },
        version: r.version,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
  }
  const assets = new AssetLibrary({
    userId,
    async canAccessProject(id) {
      await store.authorize(id);
      return true;
    },
    list: creativeAssets,
    async create() {
      throw Error("USE_CANONICAL_OUTPUT_PERSISTENCE");
    },
    async archive() {
      throw Error("ASSET_ARCHIVE_NOT_EXPOSED");
    },
  });
  const creative = new CreativeWorkspaceService(
    {
      userId,
      async canEditProject(id) {
        await store.authorize(id, true);
        return true;
      },
      async loadWorkspace(id) {
        const row = await database(
          client.from("projects").select("creative_workspace").eq("id", id).single(),
        );
        return (
          (row?.creative_workspace as CreativeWorkspace) ?? {
            projectId: id,
            selectedCharacterIds: [],
            timeline: {
              id,
              projectId: id,
              version: 1,
              scenes: [],
              tracks: [],
              updatedAt: new Date().toISOString(),
            },
          }
        );
      },
      async saveWorkspace(value) {
        await store.authorize(value.projectId, true);
        await database(
          (supabaseAdmin as unknown as SupabaseClient)
            .from("projects")
            .update({ creative_workspace: value })
            .eq("id", value.projectId),
        );
      },
      async listCharacters() {
        return [];
      },
      async listVoices() {
        return [];
      },
      async listBrands() {
        return [];
      },
      async listGenerations(id) {
        return (await store.list(id))
          .filter((x) => x.request.capability.kind === "creative")
          .map((x) => ({
            requestId: x.id,
            jobId: x.id,
            status:
              x.state === "waiting_approval" || x.state === "cancelled"
                ? ("failed" as const)
                : x.state,
            assetId: x.artifactIds[0],
            errorCode: x.errorCode,
            version: 1,
            createdAt: x.createdAt,
          }));
      },
      async submitGeneration(generation) {
        const next: RuntimeRequest = {
          idempotencyKey: generation.id,
          task: {
            id: generation.id,
            userId,
            projectId: generation.projectId,
            goal: generation.prompt.text,
            requestedAgent: "creative",
            routingMode: generation.quality,
            createdAt: generation.createdAt,
          },
          capability: { kind: "creative", generation },
        };
        const saved = await store.submit(next);
        return {
          requestId: saved.id,
          jobId: saved.id,
          status:
            saved.state === "completed"
              ? "completed"
              : saved.state === "failed"
                ? "failed"
                : "queued",
          version: 1,
          createdAt: saved.createdAt,
          errorCode: saved.errorCode,
          assetId: saved.artifactIds[0],
        };
      },
    },
    assets,
    projects.brain,
  );
  const runtime = composeCapabilityRuntime({
    store,
    request,
    brain: projects.brain,
    memory: projects.memory,
    search,
    gateway,
    approvals,
    creative,
    providers: providerSignals(await providers.snapshot()),
  });
  return { ...runtime, store, creative, approvals, projects };
}
export function publicJob(job: RuntimeJob) {
  return {
    id: job.id,
    projectId: job.projectId,
    state: job.state,
    errorCode: job.errorCode,
    title: job.request.task.goal.slice(0, 120),
    kind: job.request.capability.kind,
    approvalId: job.approvalId,
    artifactIds: job.artifactIds,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    attempt: job.attempt,
  };
}
export async function operationsForActor(
  userId: string,
  client: SupabaseClient,
  token: string,
  projectId: string,
) {
  const placeholder: RuntimeRequest = {
    task: {
      id: crypto.randomUUID(),
      userId,
      projectId,
      goal: "Automation",
      createdAt: new Date().toISOString(),
      requestedAgent: "automation",
    },
    capability: { kind: "business", agentId: "web-research" },
    idempotencyKey: crypto.randomUUID(),
  };
  const runtime = await runtimeForActor(userId, client, token, placeholder);
  const p4 = await SupabaseP4Store.create(client);
  const store = Object.assign(p4, {
    async dispatch(
      workflow: import("../automation/contracts.ts").AutomationWorkflow,
      event: import("../automation/contracts.ts").AutomationEvent,
    ) {
      const id = crypto.randomUUID();
      const job = await runtime.store.submit({
        idempotencyKey: `fi3:${workflow.id}:${event.id}`,
        task: {
          id,
          userId,
          projectId: workflow.projectId,
          goal: workflow.name,
          requestedAgent: "automation",
          createdAt: new Date().toISOString(),
        },
        capability: { kind: "automation", workflow, eventId: event.id },
      });
      return {
        execution: {
          id: job.id,
          workflowId: workflow.id,
          projectId: job.projectId,
          eventId: event.id,
          correlationId: event.correlationId,
          status: job.state,
          completedStepIds: job.checkpoint?.completedStepIds ?? [],
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        },
        outputs: [],
      };
    },
  });
  const automation = new AutomationService(
    store,
    canonicalAutomationActions({
      orchestrator: runtime.orchestrator,
      brain: runtime.projects.brain,
      memory: runtime.projects.memory,
      creative: runtime.creative,
    }),
    undefined,
    runtime.approvals,
  );
  return { ...runtime, p4, automation, collaboration: new CollaborationService(p4) };
}
