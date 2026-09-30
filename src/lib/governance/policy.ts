import { object } from "../memory/service.ts";
export const POLICY_DOMAINS = [
  "models",
  "providers",
  "agents",
  "tools",
  "mcp",
  "marketplace",
  "network",
  "files",
  "memory",
  "export",
  "actions",
] as const;
export type PolicyDomain = (typeof POLICY_DOMAINS)[number];
export const LIMIT_KEYS = [
  "dailyMinor",
  "monthlyMinor",
  "runMinor",
  "concurrency",
  "contextChars",
  "retentionDays",
  "warningPercent",
] as const;
export type GovernancePolicy = {
  allow?: Partial<Record<PolicyDomain, string[]>>;
  deny?: Partial<Record<PolicyDomain, string[]>>;
  limits?: Partial<Record<(typeof LIMIT_KEYS)[number], number>>;
  requireApproval?: boolean;
  blockUnknownCost?: boolean;
};
/** Strict bounded contract. Missing allow means unrestricted; an empty allow means deny all. */
export function validatePolicy(value: unknown): GovernancePolicy {
  const p = object(value);
  if (
    JSON.stringify(p).length > 12000 ||
    Object.keys(p).some(
      (k) => !["allow", "deny", "limits", "requireApproval", "blockUnknownCost"].includes(k),
    )
  )
    throw Error("INVALID_POLICY");
  for (const kind of ["allow", "deny"] as const)
    if (p[kind] !== undefined) {
      for (const [domain, values] of Object.entries(object(p[kind]))) {
        if (
          !(POLICY_DOMAINS as readonly string[]).includes(domain) ||
          !Array.isArray(values) ||
          values.length > 100 ||
          values.some((v) => typeof v !== "string" || !v || v.length > 200 || /[\r\n]/.test(v))
        )
          throw Error("INVALID_POLICY");
      }
    }
  if (p.limits !== undefined)
    for (const [key, n] of Object.entries(object(p.limits))) {
      if (
        !(LIMIT_KEYS as readonly string[]).includes(key) ||
        !Number.isSafeInteger(n) ||
        Number(n) < 0 ||
        Number(n) > 1_000_000_000 ||
        (key === "warningPercent" && Number(n) > 100)
      )
        throw Error("INVALID_POLICY");
    }
  for (const key of ["requireApproval", "blockUnknownCost"])
    if (p[key] !== undefined && typeof p[key] !== "boolean") throw Error("INVALID_POLICY");
  return structuredClone(p) as GovernancePolicy;
}
/** AND every ancestor; union explicit denies; take the strictest ceiling. No child override. */
export function effectivePolicy(...layers: unknown[]): GovernancePolicy {
  const result: GovernancePolicy = { allow: {}, deny: {}, limits: {} };
  for (const input of layers) {
    const p = validatePolicy(input);
    for (const domain of POLICY_DOMAINS) {
      const next = p.allow?.[domain],
        previous = result.allow![domain];
      if (next !== undefined)
        result.allow![domain] = [
          ...new Set(previous === undefined ? next : previous.filter((x) => next.includes(x))),
        ].sort();
      result.deny![domain] = [
        ...new Set([...(result.deny![domain] ?? []), ...(p.deny?.[domain] ?? [])]),
      ].sort();
    }
    for (const key of LIMIT_KEYS)
      if (p.limits?.[key] !== undefined)
        result.limits![key] = Math.min(result.limits![key] ?? Infinity, p.limits[key]!);
    result.requireApproval ||= p.requireApproval === true;
    result.blockUnknownCost ||= p.blockUnknownCost === true;
  }
  return result;
}
export function policyAllows(p: GovernancePolicy, domain: PolicyDomain, value: string) {
  return (
    !(p.deny?.[domain] ?? []).some((x) => x === "*" || x === value) &&
    (p.allow?.[domain] === undefined || p.allow[domain]!.includes(value))
  );
}
export function requirePolicy(p: GovernancePolicy, domain: PolicyDomain, value: string) {
  if (!policyAllows(p, domain, value)) throw Error("GOVERNANCE_BLOCKED");
}
