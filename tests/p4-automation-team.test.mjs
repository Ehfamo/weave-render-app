import test from "node:test";
import assert from "node:assert/strict";
import { AutomationService } from "../src/lib/automation/service.ts";
import { CollaborationService } from "../src/lib/collaboration/service.ts";
import { permits } from "../src/lib/collaboration/permissions.ts";
import { classifyAgentTaskIntent } from "../src/lib/command-center/actions.ts";
const now = "2026-09-13T00:00:00Z",
  projectId = "p1",
  actorId = "u1";
function automation() {
  const workflows = new Map(),
    exec = [];
  const store = {
    actorId,
    role: async (p) => (p === projectId ? "owner" : null),
    saveWorkflow: async (w) => workflows.set(w.id, structuredClone(w)),
    workflow: async (id) => workflows.get(id),
    workflows: async () => [...workflows.values()],
    saveExecution: async (x) => exec.push(structuredClone(x)),
    executions: async () => exec,
    seenEvent: async (w, e) => exec.some((x) => x.workflowId === w && x.eventId === e),
  };
  const order = [];
  return {
    service: new AutomationService(
      store,
      [
        { id: "read", risk: "SAFE_READ", execute: async (x) => (order.push(x), x) },
        { id: "write", risk: "LOW_RISK_WRITE", execute: async (x) => x },
      ],
      () => now,
    ),
    order,
  };
}
const workflow = (
  steps = [
    { id: "a", order: 0, actionId: "read", input: "a" },
    { id: "b", order: 1, actionId: "read", input: "b" },
  ],
) => ({
  id: "w",
  ownerId: actorId,
  projectId,
  name: "Weekly",
  status: "enabled",
  trigger: { kind: "manual" },
  conditions: [],
  steps,
  version: 1,
  createdAt: now,
  updatedAt: now,
});
const event = (id = "e") => ({
  id,
  projectId,
  kind: "manual",
  correlationId: "c",
  payload: {},
  createdAt: now,
});
test("workflow validates and executes manual steps deterministically", async () => {
  const { service, order } = automation();
  await service.create(workflow());
  const r = await service.manual("w", event());
  assert.equal(r.execution.status, "completed");
  assert.deepEqual(order, ["a", "b"]);
});
test("disabled duplicate recursive unauthorized and bounded workflows fail closed", async () => {
  const { service } = automation();
  await service.create(workflow());
  await service.manual("w", event());
  await assert.rejects(() => service.manual("w", event()), /DUPLICATE/);
  await assert.rejects(
    () => service.trigger("w", { ...event("r"), sourceWorkflowId: "w" }),
    /RECURSION/,
  );
  await service.setEnabled("w", false);
  await assert.rejects(() => service.manual("w", event("x")), /DISABLED/);
  assert.throws(
    () =>
      service.validate(
        workflow(
          Array.from({ length: 13 }, (_, i) => ({
            id: `s${i}`,
            order: i,
            actionId: "read",
            input: {},
          })),
        ),
      ),
    /INVALID/,
  );
});
test("risky action pauses for canonical approval", async () => {
  const { service } = automation();
  await service.create(workflow([{ id: "x", order: 0, actionId: "write", input: {} }]));
  const r = await service.manual("w", event());
  assert.equal(r.execution.status, "waiting_approval");
  assert.match(r.execution.approvalId, /w:e:x/);
});
test("roles are server authoritative", () => {
  assert.equal(permits("owner", "manage_members"), true);
  assert.equal(permits("editor", "assign"), true);
  assert.equal(permits("viewer", "edit"), false);
});
test("human and agent assignments preserve result and activity", async () => {
  const assignments = [],
    activity = [];
  const members = new Map([
    ["u1", "owner"],
    ["u2", "viewer"],
  ]);
  const store = {
    actorId,
    member: async (p, u) =>
      p === projectId && members.has(u)
        ? { userId: u, projectId: p, role: members.get(u), joinedAt: now }
        : null,
    saveAssignment: async (a) => {
      const i = assignments.findIndex((x) => x.id === a.id);
      i < 0 ? assignments.push(a) : (assignments[i] = a);
    },
    assignments: async () => assignments,
    appendActivity: async (a) => activity.push(a),
    activity: async () => activity,
    saveComment: async () => {},
  };
  const s = new CollaborationService(store),
    a = {
      id: "t",
      projectId,
      creatorId: actorId,
      assigneeId: "research",
      assigneeType: "agent",
      description: "Research",
      priority: "normal",
      status: "queued",
      requiredApproval: false,
      createdAt: now,
      updatedAt: now,
    };
  await s.assign(a);
  assert.equal((await s.complete(projectId, "t", "result:1")).resultReference, "result:1");
  assert.equal((await s.listActivity(projectId))[0].kind, "assignment");
  await assert.rejects(
    () => s.assign({ ...a, id: "bad", assigneeType: "human", assigneeId: "alien" }),
    /ASSIGNEE/,
  );
});
test("Command Center recognizes automation assignment and approval goals", () => {
  assert.equal(classifyAgentTaskIntent("Run this workflow").intent, "automation");
  assert.equal(classifyAgentTaskIntent("Assign research").intent, "assignment");
  assert.equal(classifyAgentTaskIntent("Show tasks waiting approval").intent, "approval");
});
