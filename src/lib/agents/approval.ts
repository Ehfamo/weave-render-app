import type {
  ApprovalDecision,
  ApprovalPolicy,
  ApprovalRequest,
  RiskClass,
  ToolDefinition,
} from "./contracts.ts";

const approvalRisks = new Set<RiskClass>([
  "LOW_RISK_WRITE",
  "EXTERNAL_ACTION",
  "DESTRUCTIVE",
  "SENSITIVE",
]);
export const defaultApprovalPolicy: ApprovalPolicy = {
  classify: (tool) => tool.risk,
  requiresApproval: (risk) => approvalRisks.has(risk),
};

export interface ApprovalStore {
  create(request: ApprovalRequest): Promise<void>;
  get(id: string): Promise<ApprovalRequest | null>;
  decide(decision: ApprovalDecision): Promise<ApprovalRequest>;
}

export class InMemoryApprovalStore implements ApprovalStore {
  private readonly requests = new Map<string, ApprovalRequest>();
  async create(request: ApprovalRequest) {
    if (this.requests.has(request.id)) throw new Error("DUPLICATE_APPROVAL");
    this.requests.set(request.id, structuredClone(request));
  }
  async get(id: string) {
    const value = this.requests.get(id);
    return value ? structuredClone(value) : null;
  }
  async decide(decision: ApprovalDecision) {
    const request = this.requests.get(decision.requestId);
    if (!request || request.status !== "pending") throw new Error("APPROVAL_NOT_PENDING");
    const next: ApprovalRequest = {
      ...request,
      status: decision.decision,
      decidedAt: new Date().toISOString(),
      decidedBy: decision.decidedBy,
      ...(decision.reason ? { reason: decision.reason } : {}),
    };
    this.requests.set(next.id, next);
    return structuredClone(next);
  }
}
