import type { AgentTrace } from "../agents/contracts.ts";
import type { CostLedgerEntry } from "./contracts.ts";

const SECRET_KEY = /authorization|cookie|secret|password|token|api[-_]?key|credential/i;
const SECRET_VALUE = /(bearer\s+[\w.-]+|sk-[a-z0-9_-]{12,}|-----BEGIN [A-Z ]+PRIVATE KEY-----)/i;
export function redactTelemetry(value: unknown): unknown {
  if (typeof value === "string") return SECRET_VALUE.test(value) ? "[REDACTED]" : value;
  if (Array.isArray(value)) return value.map(redactTelemetry);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SECRET_KEY.test(key) ? "[REDACTED]" : redactTelemetry(item),
      ]),
    );
  return value;
}
export interface TraceEnvelope {
  trace: AgentTrace;
  latencyMs: number;
  costs?: readonly CostLedgerEntry[];
  qualityScore?: number;
  errorClass?: string;
}
export class ObservabilityService {
  readonly #events: TraceEnvelope[] = [];
  ingest(event: TraceEnvelope): void {
    this.#events.push(redactTelemetry(structuredClone(event)) as TraceEnvelope);
  }
  query(scope: { userId: string; projectId: string }): readonly TraceEnvelope[] {
    return this.#events
      .filter((x) => x.trace.userId === scope.userId && x.trace.projectId === scope.projectId)
      .map((x) => structuredClone(x));
  }
  metrics(scope: { userId: string; projectId: string }) {
    const events = this.query(scope),
      count = events.length;
    return {
      count,
      successes: events.filter((x) => x.trace.status === "completed").length,
      failures: events.filter((x) => x.trace.status === "failed").length,
      cancellations: events.filter((x) => x.trace.status === "cancelled").length,
      retries: events.reduce((sum, x) => sum + x.trace.retries, 0),
      averageLatencyMs: count ? events.reduce((sum, x) => sum + x.latencyMs, 0) / count : 0,
      actualCostMinor: events
        .flatMap((x) => x.costs ?? [])
        .reduce((sum, x) => sum + (x.actual.minorUnits ?? 0), 0),
      approvalWaits: events.reduce(
        (sum, x) => sum + x.trace.events.filter((e) => e.type === "approval").length,
        0,
      ),
    };
  }
}
