import assert from "node:assert/strict";
import { test } from "node:test";
import {
  REQUEST_7_WORKFLOW_MATURITY,
  VerticalSliceError,
  executeTextGeneration,
  routeTextProvider,
} from "../src/lib/backend/vertical-slice.ts";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER_USER = "22222222-2222-4222-8222-222222222222";

function id(prefix, sequence) {
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}

class InMemoryRequest7Backend {
  constructor() {
    this.sequence = 0;
    this.projects = new Map();
    this.members = new Map();
    this.conversations = new Map();
    this.messages = [];
    this.jobs = new Map();
    this.idempotency = new Map();
    this.assets = [];
    this.outputs = [];
    this.usage = [];
    this.ledger = [];
    this.audit = [];
  }

  next(prefix) {
    this.sequence += 1;
    return id(prefix, this.sequence);
  }

  balance(actorId) {
    return this.ledger
      .filter((entry) => entry.actorId === actorId)
      .reduce((total, entry) => total + entry.delta, 0);
  }

  grant(actorId, amount) {
    this.ledger.push({
      id: this.next("ledger"),
      actorId,
      jobId: null,
      delta: amount,
      reason: "grant",
      key: `grant:${actorId}:${this.sequence}`,
    });
  }

  createProject(actorId, name) {
    if (!actorId) throw new VerticalSliceError("UNAUTHENTICATED");
    const project = { id: this.next("project"), actorId, name, updatedAt: this.sequence };
    this.projects.set(project.id, project);
    this.members.set(`${project.id}:${actorId}`, "owner");
    this.audit.push({
      id: this.next("audit"),
      actorId,
      projectId: project.id,
      jobId: null,
      type: "project.created",
      result: "succeeded",
    });
    return project;
  }

  assertWriter(actorId, projectId) {
    const role = this.members.get(`${projectId}:${actorId}`);
    if (!role) throw new VerticalSliceError("PROJECT_NOT_FOUND");
    if (role !== "owner" && role !== "editor") throw new VerticalSliceError("FORBIDDEN");
  }

  conversation(input) {
    if (input.conversationId) {
      const existing = this.conversations.get(input.conversationId);
      if (!existing || existing.projectId !== input.projectId) {
        throw new VerticalSliceError("CONVERSATION_NOT_FOUND");
      }
      return existing;
    }
    const conversation = {
      id: this.next("conversation"),
      projectId: input.projectId,
      title: input.prompt.slice(0, 120),
    };
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  prior(input) {
    const key = `${input.actorId}:${input.idempotencyKey}`;
    const jobId = this.idempotency.get(key);
    if (!jobId) return null;
    const job = this.jobs.get(jobId);
    if (job.requestHash !== input.requestHash) {
      throw new VerticalSliceError("IDEMPOTENCY_CONFLICT");
    }
    return job;
  }

  persistInput(input, fields) {
    const conversation = this.conversation(input);
    const message = {
      id: this.next("message"),
      projectId: input.projectId,
      conversationId: conversation.id,
      role: "user",
      content: input.prompt,
    };
    this.messages.push(message);
    const job = {
      id: this.next("job"),
      actorId: input.actorId,
      projectId: input.projectId,
      conversationId: conversation.id,
      requestHash: input.requestHash,
      idempotencyKey: input.idempotencyKey,
      status: fields.status,
      selectedProvider: fields.selectedProvider ?? null,
      selectedModel: fields.selectedModel ?? null,
      reserved: fields.reserved ?? 0,
      errorCode: fields.errorCode ?? null,
    };
    this.jobs.set(job.id, job);
    this.idempotency.set(`${input.actorId}:${input.idempotencyKey}`, job.id);
    return job;
  }

  async recordUnavailable(input) {
    this.assertWriter(input.actorId, input.projectId);
    const prior = this.prior(input);
    if (prior) return this.submission(prior, false);
    const job = this.persistInput(input, { status: "failed", errorCode: input.errorCode });
    this.audit.push({
      id: this.next("audit"),
      actorId: input.actorId,
      projectId: input.projectId,
      jobId: job.id,
      type: "generation.failed",
      result: "failed",
    });
    return this.submission(job, true);
  }

  async createSubmission(input) {
    this.assertWriter(input.actorId, input.projectId);
    const prior = this.prior(input);
    if (prior) return this.submission(prior, false);
    if (input.reservedCreditUnits > this.balance(input.actorId)) {
      throw new VerticalSliceError("INSUFFICIENT_CREDITS");
    }
    const job = this.persistInput(input, {
      status: "queued",
      selectedProvider: input.selectedProvider,
      selectedModel: input.selectedModel,
      reserved: input.reservedCreditUnits,
    });
    if (job.reserved > 0) {
      this.ledger.push({
        id: this.next("ledger"),
        actorId: input.actorId,
        jobId: job.id,
        delta: -job.reserved,
        reason: "reservation",
        key: `reserve:${job.id}`,
      });
    }
    this.audit.push({
      id: this.next("audit"),
      actorId: input.actorId,
      projectId: input.projectId,
      jobId: job.id,
      type: "generation.submitted",
      result: "submitted",
    });
    return this.submission(job, true);
  }

  async markRunning(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) throw new VerticalSliceError("JOB_NOT_FOUND");
    if (job.status === "running") return true;
    if (job.status !== "queued") return false;
    job.status = "running";
    this.audit.push({
      id: this.next("audit"),
      actorId: job.actorId,
      projectId: job.projectId,
      jobId,
      type: "provider.requested",
      result: "submitted",
    });
    return true;
  }

  async complete(jobId, output) {
    const job = this.jobs.get(jobId);
    if (!job) throw new VerticalSliceError("JOB_NOT_FOUND");
    const existing = this.outputs.find((item) => item.jobId === jobId);
    if (existing) return existing;
    assert.ok(job.status === "running" || job.status === "queued");
    assert.ok(output.usage.actualCreditUnits <= job.reserved);

    const message = {
      id: this.next("message"),
      projectId: job.projectId,
      conversationId: job.conversationId,
      role: "assistant",
      content: output.text,
    };
    this.messages.push(message);
    const asset = {
      id: this.next("asset"),
      projectId: job.projectId,
      jobId,
      kind: "document",
      status: "ready",
    };
    this.assets.push(asset);
    const usage = {
      id: this.next("usage"),
      actorId: job.actorId,
      projectId: job.projectId,
      jobId,
      provider: job.selectedProvider,
      model: job.selectedModel,
      ...output.usage,
    };
    this.usage.push(usage);
    this.ledger.push({
      id: this.next("ledger"),
      actorId: job.actorId,
      jobId,
      delta: 0,
      reason: "consume",
      key: `consume:${jobId}`,
    });
    const release = job.reserved - output.usage.actualCreditUnits;
    if (release > 0) {
      this.ledger.push({
        id: this.next("ledger"),
        actorId: job.actorId,
        jobId,
        delta: release,
        reason: "release",
        key: `success-release:${jobId}`,
      });
    }
    const persisted = {
      outputId: this.next("output"),
      assetId: asset.id,
      messageId: message.id,
      jobId,
    };
    this.outputs.push(persisted);
    job.status = "succeeded";
    this.audit.push({
      id: this.next("audit"),
      actorId: job.actorId,
      projectId: job.projectId,
      jobId,
      type: "generation.succeeded",
      result: "succeeded",
    });
    return persisted;
  }

  async fail(jobId, error) {
    const job = this.jobs.get(jobId);
    if (!job) throw new VerticalSliceError("JOB_NOT_FOUND");
    if (job.status === "failed") return;
    if (job.reserved > 0) {
      this.ledger.push({
        id: this.next("ledger"),
        actorId: job.actorId,
        jobId,
        delta: job.reserved,
        reason: "release",
        key: `failure-release:${jobId}`,
      });
    }
    job.status = "failed";
    job.errorCode = error.code;
    this.audit.push({
      id: this.next("audit"),
      actorId: job.actorId,
      projectId: job.projectId,
      jobId,
      type: "generation.failed",
      result: "failed",
    });
  }

  cancel(actorId, jobId) {
    const job = this.jobs.get(jobId);
    if (!job) throw new VerticalSliceError("JOB_NOT_FOUND");
    this.assertWriter(actorId, job.projectId);
    if (job.actorId !== actorId) throw new VerticalSliceError("FORBIDDEN");
    if (job.status === "cancelled") return true;
    if (job.status !== "queued" && job.status !== "running") return false;
    if (job.reserved > 0) {
      this.ledger.push({
        id: this.next("ledger"),
        actorId: job.actorId,
        jobId,
        delta: job.reserved,
        reason: "release",
        key: `cancel-release:${jobId}`,
      });
    }
    job.status = "cancelled";
    this.audit.push({
      id: this.next("audit"),
      actorId,
      projectId: job.projectId,
      jobId,
      type: "generation.cancelled",
      result: "cancelled",
    });
    return true;
  }

  async readSubmission(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) throw new VerticalSliceError("JOB_NOT_FOUND");
    return this.submission(job, false);
  }

  submission(job, created) {
    return {
      jobId: job.id,
      conversationId: job.conversationId,
      created,
      status: job.status,
    };
  }

  reloadProject(actorId, projectId) {
    this.assertWriter(actorId, projectId);
    return {
      project: this.projects.get(projectId),
      conversations: [...this.conversations.values()].filter(
        (item) => item.projectId === projectId,
      ),
      messages: this.messages.filter((item) => item.projectId === projectId),
      jobs: [...this.jobs.values()].filter((item) => item.projectId === projectId),
      assets: this.assets.filter((item) => item.projectId === projectId),
      usage: this.usage.filter((item) => item.projectId === projectId),
      ledger: this.ledger.filter((item) => {
        const job = item.jobId ? this.jobs.get(item.jobId) : null;
        return job?.projectId === projectId;
      }),
      audit: this.audit.filter((item) => item.projectId === projectId),
      balance: this.balance(actorId),
    };
  }
}

function deterministicProvider({ calls, fail = false, reserved = 3, actual = 2 } = {}) {
  return {
    descriptor: {
      id: "ci-deterministic-provider",
      model: "ci-text-v1",
      capabilities: ["text-generation"],
      verifiedAvailable: true,
      evidenceReference: "CI_TEST_ONLY",
      reservedCreditUnits: reserved,
    },
    async generate({ prompt, jobId }) {
      calls?.push(jobId);
      if (fail) throw new Error("deterministic CI failure");
      return {
        text: `CI result: ${prompt}`,
        providerRequestId: `ci-request:${jobId}`,
        finishReason: "stop",
        usage: {
          inputUnits: 4,
          outputUnits: 6,
          estimatedCostMicrounits: 20,
          actualCostMicrounits: 18,
          actualCreditUnits: actual,
          unavailable: false,
        },
      };
    },
  };
}

function request(projectId, overrides = {}) {
  return {
    actorId: USER,
    projectId,
    prompt: "Explain the verified project state",
    routingMode: "auto",
    idempotencyKey: "request7:test:00000001",
    requestHash: "a".repeat(64),
    ...overrides,
  };
}

test("Request 7 workflow maturity is connected but never falsely live-verified", () => {
  assert.deepEqual(REQUEST_7_WORKFLOW_MATURITY, {
    W03: "CONNECTED",
    W04: "CONNECTED",
    W05: "CONNECTED",
    W08: "CONNECTED",
    W09: "CONNECTED",
    W20: "CONNECTED",
  });
});

test("authentication is required before the generation path", async () => {
  const backend = new InMemoryRequest7Backend();
  await assert.rejects(
    executeTextGeneration({
      request: request("project-missing", { actorId: "" }),
      providers: [],
      persistence: backend,
    }),
    (error) => error instanceof VerticalSliceError && error.code === "UNAUTHENTICATED",
  );
});

test("project ownership is enforced before unavailable requests are persisted", async () => {
  const backend = new InMemoryRequest7Backend();
  const project = backend.createProject(USER, "Private project");
  await assert.rejects(
    executeTextGeneration({
      request: request(project.id, { actorId: OTHER_USER }),
      providers: [],
      persistence: backend,
    }),
    (error) => error instanceof VerticalSliceError && error.code === "PROJECT_NOT_FOUND",
  );
  assert.equal(backend.jobs.size, 0);
});

test("provider unavailable is persisted honestly without a credit charge", async () => {
  const backend = new InMemoryRequest7Backend();
  const project = backend.createProject(USER, "Unavailable provider");
  backend.grant(USER, 10);
  const before = backend.balance(USER);
  const result = await executeTextGeneration({
    request: request(project.id),
    providers: [],
    persistence: backend,
  });
  assert.equal(result.status, "failed");
  assert.equal(result.error?.code, "PROVIDER_UNAVAILABLE");
  assert.equal(backend.balance(USER), before);
  assert.equal(backend.jobs.get(result.jobId).errorCode, "PROVIDER_UNAVAILABLE");
});

test("successful CI provider execution persists output, asset, usage, ledger and audit", async () => {
  const backend = new InMemoryRequest7Backend();
  const project = backend.createProject(USER, "Integration project");
  backend.grant(USER, 10);
  const result = await executeTextGeneration({
    request: request(project.id),
    providers: [deterministicProvider()],
    persistence: backend,
  });
  const reloaded = backend.reloadProject(USER, project.id);

  assert.equal(result.status, "succeeded");
  assert.equal(reloaded.project.name, "Integration project");
  assert.deepEqual(
    reloaded.messages.map((message) => message.role),
    ["user", "assistant"],
  );
  assert.equal(reloaded.jobs[0].status, "succeeded");
  assert.equal(reloaded.assets.length, 1);
  assert.equal(reloaded.usage.length, 1);
  assert.equal(reloaded.balance, 8);
  assert.ok(reloaded.audit.some((event) => event.type === "generation.succeeded"));
});

test("failed provider execution releases the full reservation and records failure", async () => {
  const backend = new InMemoryRequest7Backend();
  const project = backend.createProject(USER, "Failure recovery");
  backend.grant(USER, 10);
  const result = await executeTextGeneration({
    request: request(project.id),
    providers: [deterministicProvider({ fail: true })],
    persistence: backend,
  });
  assert.equal(result.status, "failed");
  assert.equal(result.error?.code, "GENERATION_FAILED");
  assert.equal(backend.balance(USER), 10);
  assert.equal(backend.usage.length, 0);
  assert.ok(backend.audit.some((event) => event.type === "generation.failed"));
});

test("cancelling a queued job is authorized, idempotent and releases its reservation once", async () => {
  const backend = new InMemoryRequest7Backend();
  const project = backend.createProject(USER, "Cancellation");
  backend.grant(USER, 10);
  const input = request(project.id);
  const submission = await backend.createSubmission({
    ...input,
    selectedProvider: "ci-deterministic-provider",
    selectedModel: "ci-text-v1",
    reservedCreditUnits: 3,
  });
  assert.equal(backend.balance(USER), 7);
  assert.equal(backend.cancel(USER, submission.jobId), true);
  assert.equal(backend.cancel(USER, submission.jobId), true);
  assert.equal(backend.balance(USER), 10);
  assert.equal(
    backend.ledger.filter((entry) => entry.key === `cancel-release:${submission.jobId}`).length,
    1,
  );
  assert.equal(backend.jobs.get(submission.jobId).status, "cancelled");
});

test("insufficient credits creates no job, message, usage or charge", async () => {
  const backend = new InMemoryRequest7Backend();
  const project = backend.createProject(USER, "Credit gate");
  backend.grant(USER, 1);
  await assert.rejects(
    executeTextGeneration({
      request: request(project.id),
      providers: [deterministicProvider({ reserved: 3 })],
      persistence: backend,
    }),
    (error) => error instanceof VerticalSliceError && error.code === "INSUFFICIENT_CREDITS",
  );
  assert.equal(backend.jobs.size, 0);
  assert.equal(backend.messages.length, 0);
  assert.equal(backend.usage.length, 0);
  assert.equal(backend.balance(USER), 1);
});

test("an idempotent retry does not execute the provider or charge twice", async () => {
  const backend = new InMemoryRequest7Backend();
  const project = backend.createProject(USER, "Idempotency");
  backend.grant(USER, 10);
  const calls = [];
  const input = request(project.id);
  const provider = deterministicProvider({ calls });
  const first = await executeTextGeneration({
    request: input,
    providers: [provider],
    persistence: backend,
  });
  const second = await executeTextGeneration({
    request: input,
    providers: [provider],
    persistence: backend,
  });

  assert.equal(first.jobId, second.jobId);
  assert.equal(calls.length, 1);
  assert.equal(backend.usage.length, 1);
  assert.equal(backend.balance(USER), 8);
  assert.equal(backend.ledger.filter((entry) => entry.reason === "reservation").length, 1);
});

test("reusing an idempotency key for different input is rejected", async () => {
  const backend = new InMemoryRequest7Backend();
  const project = backend.createProject(USER, "Idempotency conflict");
  backend.grant(USER, 10);
  const provider = deterministicProvider();
  await executeTextGeneration({
    request: request(project.id),
    providers: [provider],
    persistence: backend,
  });
  await assert.rejects(
    executeTextGeneration({
      request: request(project.id, { requestHash: "b".repeat(64), prompt: "Different input" }),
      providers: [provider],
      persistence: backend,
    }),
    (error) => error instanceof VerticalSliceError && error.code === "IDEMPOTENCY_CONFLICT",
  );
});

test("manual routing requires the exact verified provider and model", () => {
  const provider = deterministicProvider();
  assert.equal(
    routeTextProvider({
      mode: "manual",
      providers: [provider],
      requestedProvider: provider.descriptor.id,
      requestedModel: provider.descriptor.model,
    }).state,
    "ready",
  );
  assert.deepEqual(
    routeTextProvider({
      mode: "manual",
      providers: [provider],
      requestedProvider: provider.descriptor.id,
      requestedModel: "unavailable-model",
    }),
    { state: "unavailable", code: "MODEL_UNAVAILABLE" },
  );
});

test("full CI vertical slice survives project reload", async () => {
  const backend = new InMemoryRequest7Backend();
  const project = backend.createProject(USER, "Reloadable project");
  backend.grant(USER, 20);
  await executeTextGeneration({
    request: request(project.id, { idempotencyKey: "request7:integration:0001" }),
    providers: [deterministicProvider()],
    persistence: backend,
  });

  const afterRefresh = backend.reloadProject(USER, project.id);
  assert.equal(afterRefresh.conversations.length, 1);
  assert.equal(afterRefresh.messages.length, 2);
  assert.equal(afterRefresh.jobs.length, 1);
  assert.equal(afterRefresh.assets.length, 1);
  assert.equal(afterRefresh.usage.length, 1);
  assert.ok(afterRefresh.ledger.length >= 3);
  assert.ok(afterRefresh.audit.length >= 4);
});
