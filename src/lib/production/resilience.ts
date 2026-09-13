import type { OperationalError, OperationalErrorCode } from "./contracts.ts";

const messages: Record<OperationalErrorCode, string> = {
  PROVIDER_UNAVAILABLE: "Service is temporarily unavailable",
  TIMEOUT: "The operation timed out",
  RATE_LIMIT: "The service is busy",
  BUDGET_EXCEEDED: "Budget limit reached",
  PERMISSION_DENIED: "Permission denied",
  INVALID_INPUT: "Invalid input",
  DEPENDENCY_UNAVAILABLE: "A dependency is unavailable",
  CANCELLED: "Operation cancelled",
  INTERNAL_SAFE_FAILURE: "The operation could not be completed",
};
export function normalizeOperationalError(value: unknown): OperationalError {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const code =
    typeof raw.code === "string" && Object.hasOwn(messages, raw.code)
      ? (raw.code as OperationalErrorCode)
      : "INTERNAL_SAFE_FAILURE";
  return {
    code,
    message: messages[code],
    retryable: ["PROVIDER_UNAVAILABLE", "TIMEOUT", "RATE_LIMIT", "DEPENDENCY_UNAVAILABLE"].includes(
      code,
    ),
  };
}
export interface DurableJob {
  id: string;
  userId: string;
  projectId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  attempts: number;
  updatedAt: string;
  resumeToken: string;
}
export function canResumeJob(
  job: DurableJob,
  actor: { userId: string; projectId: string },
  now: Date,
  staleAfterMs: number,
): boolean {
  return (
    job.userId === actor.userId &&
    job.projectId === actor.projectId &&
    !["completed", "cancelled"].includes(job.status) &&
    now.getTime() - Date.parse(job.updatedAt) <= staleAfterMs
  );
}
export function recoverStaleJob(job: DurableJob, now: Date, staleAfterMs: number): DurableJob {
  return job.status === "running" && now.getTime() - Date.parse(job.updatedAt) > staleAfterMs
    ? { ...job, status: "queued", updatedAt: now.toISOString() }
    : job;
}
export async function retryBounded<T>(
  operation: (attempt: number) => Promise<T>,
  policy: { maxAttempts: number; baseDelayMs: number; signal?: AbortSignal },
): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    if (policy.signal?.aborted) throw { code: "CANCELLED" };
    try {
      return await operation(attempt);
    } catch (error) {
      last = error;
      const normalized = normalizeOperationalError(error);
      if (!normalized.retryable || attempt === policy.maxAttempts) throw normalized;
      if (policy.baseDelayMs > 0)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(policy.baseDelayMs * 2 ** (attempt - 1), 5_000)),
        );
    }
  }
  throw last;
}
