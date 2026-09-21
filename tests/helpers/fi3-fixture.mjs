import { session, actor, other } from "./fi2-fixture.mjs";
import { composeCapabilityRuntime } from "../../src/lib/capability-runtime/composition.ts";
import { DurableApprovalAuthority } from "../../src/lib/agents/durable-approval.ts";
import { ModelGateway } from "../../src/lib/model-gateway/gateway.ts";
import { GlobalSearchService } from "../../src/lib/global-search/service.ts";
export { actor, other };
const clone = (x) => structuredClone(x);
export async function fixture() {
  const fi2 = session();
  const project = (
    await fi2.projects.create({ name: "Durable project", goal: "Preserve campaign identity" })
  ).project.id;
  const jobs = new Map(),
    approvals = new Map(),
    artifacts = new Map(),
    calls = [];
  const store = {
    actorId: actor,
    authorize: (id, write) => fi2.projects.authorize(id, write),
    async submit(request) {
      await this.authorize(request.task.projectId, true);
      if (request.task.userId !== actor) throw Error("DENIED");
      const old = [...jobs.values()].find(
        (j) => j.request.idempotencyKey === request.idempotencyKey,
      );
      if (old) return clone(old);
      const now = new Date().toISOString();
      const j = {
        id: request.task.id,
        projectId: project,
        userId: actor,
        request: clone(request),
        state: "queued",
        attempt: 1,
        artifactIds: [],
        createdAt: now,
        updatedAt: now,
      };
      jobs.set(j.id, j);
      return clone(j);
    },
    async get(id) {
      const j = jobs.get(id);
      if (!j || j.userId !== actor) throw Error("DENIED");
      await this.authorize(j.projectId);
      return clone(j);
    },
    async list(p) {
      await this.authorize(p);
      return [...jobs.values()].filter((j) => j.projectId === p).map(clone);
    },
    async claim(id, lease) {
      const j = jobs.get(id);
      if (j.state !== "queued") return null;
      j.state = "running";
      j.lease = lease;
      return clone(j);
    },
    async checkpoint(id, lease, cp) {
      const j = jobs.get(id);
      if (j.state !== "running" || j.lease !== lease) throw Error("LEASE_LOST");
      j.checkpoint = clone(cp);
    },
    async finish(id, lease, e) {
      const j = jobs.get(id);
      if (j.state === "cancelled") return clone(j);
      if (j.lease !== lease) throw Error("LEASE_LOST");
      j.state = e.trace.status;
      j.errorCode = e.error?.code;
      j.trace = clone(e.trace);
      if (e.result) {
        const id = crypto.randomUUID();
        const a = {
          id,
          ownerId: actor,
          projectId: project,
          jobId: j.id,
          text: e.result.summary,
          output: e.result.data,
        };
        artifacts.set(id, a);
        j.artifactIds = [id];
      }
      return clone(j);
    },
    async cancel(id) {
      const j = jobs.get(id);
      j.state = "cancelled";
      return clone(j);
    },
    async retry(id) {
      const j = jobs.get(id);
      if (j.state !== "failed" || j.attempt >= 3 || j.checkpoint?.inFlight?.consequential)
        throw Error("RETRY_NOT_SAFE");
      j.state = "queued";
      j.attempt++;
      return clone(j);
    },
    async artifacts(p) {
      await this.authorize(p);
      return [...artifacts.values()].filter((a) => a.projectId === p).map(clone);
    },
  };
  const adapter = {
    async createExact(r) {
      if (!approvals.has(r.id)) approvals.set(r.id, clone(r));
      jobs.get(r.executionId).approvalId = r.id;
      return clone(approvals.get(r.id));
    },
    async decideExact(d, a) {
      const r = approvals.get(d.requestId);
      if (!r || a.userId !== actor || a.projectId !== r.projectId) throw Error("DENIED");
      if (r.status === "pending") {
        r.status = d.decision;
        const j = jobs.get(r.executionId);
        j.state = d.decision === "approved" ? "queued" : "cancelled";
        j.resumeApprovalId = r.id;
      }
      return clone(r);
    },
    async consumeApproved(i) {
      const r = approvals.get(i.approvalId);
      if (
        !r ||
        r.status !== "approved" ||
        r.consumedAt ||
        ["taskId", "executionId", "stepId", "toolId", "projectId"].some((k) => r[k] !== i[k])
      )
        return null;
      r.consumedAt = i.now;
      return clone(r);
    },
    async taskState(t, e) {
      return t === e ? jobs.get(e)?.state : null;
    },
  };
  const authority = new DurableApprovalAuthority(adapter, undefined, true);
  function request(kind, selection = "image", goal = "Prepare campaign") {
    const id = crypto.randomUUID(),
      task = {
        id,
        userId: actor,
        projectId: project,
        goal,
        requestedAgent: kind === "business" ? undefined : kind,
        createdAt: new Date().toISOString(),
      };
    const capability =
      kind === "creative"
        ? {
            kind,
            generation: {
              id,
              userId: actor,
              projectId: project,
              intent: selection,
              prompt: { text: goal },
              references: [],
              characterIds: [],
              quality: "BALANCED",
              createdAt: task.createdAt,
            },
          }
        : kind === "business"
          ? { kind, agentId: selection }
          : { kind, workflow: selection, eventId: crypto.randomUUID() };
    return { task, capability, idempotencyKey: id };
  }
  let provider = true,
    delay;
  const gateway = new ModelGateway([
    {
      provider: { id: "deterministic", displayName: "Test only" },
      getHealth: async () => ({
        availability: provider ? "AVAILABLE" : "UNAVAILABLE",
        checkedAt: new Date().toISOString(),
      }),
      discoverModels: async () =>
        ["text", "image", "video", "audio", "voice"].map((kind) => ({
          identity: { providerId: "deterministic", modelId: kind },
          capabilities: [kind],
          quality: 1,
          estimatedLatencyMs: 1,
          estimatedCostPer1kTokensUsd: 0,
        })),
      async execute(r) {
        calls.push(clone(r));
        if (delay) await delay();
        return {
          ok: true,
          output:
            r.capability === "text"
              ? { kind: "text", text: "Fixture response based on requested task" }
              : {
                  kind: r.capability,
                  url: "https://example.test/generated-output",
                  mimeType: r.capability === "video" ? "video/mp4" : "image/png",
                },
        };
      },
    },
  ]);
  const creative = {
    async requestGeneration() {
      throw Error("Not used by this fixture");
    },
  };
  function runtime(r) {
    return composeCapabilityRuntime({
      store,
      request: r,
      brain: fi2.brain,
      memory: fi2.memory,
      search: new GlobalSearchService([], {
        userId: actor,
        canReadProject: async (id) => id === project,
      }),
      gateway,
      approvals: authority,
      creative,
    });
  }
  return {
    fi2,
    project,
    jobs,
    store,
    authority,
    approvals,
    artifacts,
    calls,
    request,
    runtime,
    provider: (value) => (provider = value),
    delay: (fn) => (delay = fn),
  };
}
