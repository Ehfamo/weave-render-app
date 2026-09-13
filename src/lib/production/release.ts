import type { EvidenceStatus, GateStatus, ReleaseGateResult } from "./contracts.ts";

export const PERFORMANCE_TARGETS = Object.freeze({ lcpMs: 1500, inpMs: 120, cls: 0.05 });
export interface ReleaseEvidence {
  tests: boolean;
  typecheck: boolean;
  lint: boolean;
  build: boolean;
  security: boolean;
  authorization: boolean;
  evalRegression: GateStatus;
  costGuardrails: boolean;
  localizationParity: boolean;
  dependencyIntegrity: boolean;
  mobileSource: boolean;
  performanceSource: boolean;
  accessibilitySource: boolean;
  external: Readonly<Record<string, EvidenceStatus>>;
}
export function evaluateReleaseReadiness(evidence: ReleaseEvidence): ReleaseGateResult {
  const dimensions: Record<string, GateStatus> = {
    tests: evidence.tests ? "PASS" : "BLOCKED",
    typecheck: evidence.typecheck ? "PASS" : "BLOCKED",
    lint: evidence.lint ? "PASS" : "BLOCKED",
    build: evidence.build ? "PASS" : "BLOCKED",
    security: evidence.security ? "PASS" : "BLOCKED",
    authorization: evidence.authorization ? "PASS" : "BLOCKED",
    evalRegression: evidence.evalRegression,
    costGuardrails: evidence.costGuardrails ? "PASS" : "BLOCKED",
    localization: evidence.localizationParity ? "PASS" : "BLOCKED",
    dependencyIntegrity: evidence.dependencyIntegrity ? "PASS" : "BLOCKED",
    mobile: evidence.mobileSource ? "PASS" : "BLOCKED",
    performanceSource: evidence.performanceSource ? "PASS" : "BLOCKED",
    accessibilitySource: evidence.accessibilitySource ? "PASS" : "BLOCKED",
  };
  const blocked = Object.values(dimensions).includes("BLOCKED"),
    warned = Object.values(dimensions).includes("WARN");
  return {
    status: blocked ? "BLOCKED" : warned ? "WARN" : "PASS",
    dimensions,
    external: evidence.external,
    reasons: Object.entries(dimensions)
      .filter(([, value]) => value !== "PASS")
      .map(([key]) => key),
  };
}
export function validateDependencyIntegrity(lock: {
  lockfileVersion?: unknown;
  packages?: unknown;
}): boolean {
  return (
    Number.isInteger(lock.lockfileVersion) && !!lock.packages && typeof lock.packages === "object"
  );
}
export function sourceAccessibilityGate(source: string): boolean {
  return (
    /<main\b/.test(source) &&
    /aria-label=/.test(source) &&
    /min-h-11/.test(source) &&
    /focus-visible/.test(source)
  );
}
export function sourceMobileGate(source: string): boolean {
  return /sm:|md:|lg:/.test(source) && /min-w-0|overflow-x-auto/.test(source);
}
