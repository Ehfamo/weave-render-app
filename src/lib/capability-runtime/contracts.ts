import type { AgentCheckpoint, AgentExecution, AgentTask } from "../agents/contracts.ts";
import type { AutomationWorkflow } from "../automation/contracts.ts";
import type { BusinessAgentId } from "../business-agents/contracts.ts";
import type { CreativeGenerationRequest } from "../creative/contracts.ts";
export type CapabilityRequest =
  | { kind: "creative"; generation: CreativeGenerationRequest }
  | { kind: "business"; agentId: BusinessAgentId }
  | { kind: "automation"; workflow: AutomationWorkflow; eventId: string };
export interface RuntimeRequest {
  task: AgentTask;
  capability: CapabilityRequest;
  idempotencyKey: string;
}
export type JobState =
  "queued" | "running" | "waiting_approval" | "completed" | "failed" | "cancelled";
export interface RuntimeJob {
  id: string;
  projectId: string;
  userId: string;
  request: RuntimeRequest;
  state: JobState;
  createdAt: string;
  updatedAt: string;
  attempt: number;
  checkpoint?: AgentCheckpoint;
  resumeApprovalId?: string;
  approvalId?: string;
  errorCode?: string;
  artifactIds: string[];
  lease?: string;
}
export interface RuntimeArtifact {
  id: string;
  ownerId: string;
  projectId: string;
  jobId: string;
  type: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  text?: string;
  url?: string;
  mimeType?: string;
  provenance: { kind: "generation"; executionId: string };
  provider?: string;
  model?: string;
}
export interface RuntimeStore {
  actorId: string;
  authorize(projectId: string, write?: boolean): Promise<void>;
  submit(request: RuntimeRequest): Promise<RuntimeJob>;
  get(id: string): Promise<RuntimeJob>;
  list(projectId: string): Promise<RuntimeJob[]>;
  claim(id: string, lease: string): Promise<RuntimeJob | null>;
  checkpoint(id: string, lease: string, checkpoint: AgentCheckpoint): Promise<void>;
  finish(id: string, lease: string, execution: AgentExecution): Promise<RuntimeJob>;
  cancel(id: string): Promise<RuntimeJob>;
  retry(id: string): Promise<RuntimeJob>;
  artifacts(projectId: string): Promise<RuntimeArtifact[]>;
}

/** Definition controls eligibility; persisted invocation state supplies failure/approval state. */
export function automationRuntimeState(workflow: AutomationWorkflow, jobs: RuntimeJob[]) {
  if (workflow.status !== "enabled") return workflow.status === "draft" ? "draft" : "paused";
  const latest = jobs
    .filter(
      (job) =>
        job.projectId === workflow.projectId &&
        job.request.capability.kind === "automation" &&
        job.request.capability.workflow.id === workflow.id,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return latest?.state === "failed" || latest?.state === "waiting_approval"
    ? latest.state
    : "enabled";
}
