import { object, uuid } from "../memory/service.ts";
import { validatePolicy, effectivePolicy } from "./policy.ts";
import type { GovernancePolicy } from "./policy.ts";
import { safeCommerceInput } from "../marketplace/commerce.ts";
import type { JsonValue } from "../stage53-json.ts";
export interface GovernancePort {
  command(action: string, data: Record<string, JsonValue>): Promise<JsonValue>;
}
export const GOVERNANCE_ACTIONS = [
  "list",
  "create",
  "snapshot",
  "member",
  "attach",
  "policy",
] as const;
export class GovernanceService {
  private readonly port: GovernancePort;
  constructor(port: GovernancePort) {
    this.port = port;
  }
  async command(action: string, value: unknown = {}) {
    if (!(GOVERNANCE_ACTIONS as readonly string[]).includes(action)) throw Error("INVALID_ACTION");
    const data = safeCommerceInput(value);
    for (const key of ["workspaceId", "projectId", "userId"])
      if (data[key] !== undefined) uuid(data[key]);
    if (action === "policy") data.policy = validatePolicy(data.policy) as JsonValue;
    return this.port.command(action, data);
  }
  async policy(projectId: string, resource: GovernancePolicy = {}) {
    const snapshot = object(await this.command("snapshot", { projectId }));
    return effectivePolicy(
      snapshot.platform ?? {},
      snapshot.workspacePolicy ?? {},
      snapshot.projectPolicy ?? {},
      resource,
    );
  }
}
