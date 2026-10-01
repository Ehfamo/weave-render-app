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
  "export",
  "audit",
  "usage",
  "data_controls",
  "identity",
  "identity_configure",
  "connectors",
  "connector",
  "connector_revoke",
  "connector_check",
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
    const result = await this.port.command(action, data);
    return action === "export" ? redactExport(result) : result;
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

/** Allowlisted SQL projections omit credential columns; scrub recognizable secrets in user-authored text. */
export function redactExport(value: JsonValue): JsonValue {
  if (typeof value === "string")
    return value
      .replace(
        /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
        "[REDACTED]",
      )
      .replace(
        /\b(?:gh[pousr]_[A-Za-z0-9_]{15,}|sk_(?:live|test)_[A-Za-z0-9]{8,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g,
        "[REDACTED]",
      )
      .replace(
        /((?:password|api[_ -]?key|access[_ -]?token|secret|authorization)\s*[:=]\s*)[^\s,;]+/gi,
        "$1[REDACTED]",
      );
  if (Array.isArray(value)) return value.map(redactExport);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !/credential|secret|password|token|private.?key/i.test(k))
        .map(([k, v]) => [k, redactExport(v)]),
    );
  return value;
}
