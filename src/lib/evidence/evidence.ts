import { canonicalJson, hasSensitiveJson, type JsonValue } from "../stage53-json.ts";

/** Validation only; project ownership and writes are enforced by existing SQL/RLS. */
export class EvidenceError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "EvidenceError";
    this.code = code;
  }
}
export const canonicalizeEvidence = canonicalJson;
export const containsSecretLikeKey = hasSensitiveJson;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const sha = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const optionalText = (value: unknown, max: number) =>
  value === null || value === undefined || (typeof value === "string" && value.length <= max);
function json(value: unknown): JsonValue {
  return JSON.parse(canonicalJson(value)) as JsonValue;
}
type Validation<T> = { ok: true; value: T; issues: string[] } | { ok: false; issues: string[] };
type DatasetDraft = { name: string; description: string | null; metadata: JsonValue };
export function validateDatasetDraft(input: unknown): Validation<DatasetDraft> {
  if (!object(input)) return { ok: false, issues: ["INVALID_DATASET"] };
  const metadata = input.metadata ?? {};
  if (
    !text(input.name, 120) ||
    !optionalText(input.description, 4000) ||
    !object(metadata) ||
    hasSensitiveJson(metadata)
  )
    return { ok: false, issues: ["INVALID_DATASET"] };
  return {
    ok: true,
    value: {
      name: (input.name as string).trim().replace(/\s+/g, " "),
      description: (input.description as string | null | undefined) ?? null,
      metadata: json(metadata),
    },
    issues: [],
  };
}
type DatasetItem = {
  externalKey: string;
  position: number;
  input: JsonValue;
  expectedOutput: JsonValue;
  contentSha256: string;
  metadata: JsonValue;
};
export function validateDatasetItem(input: unknown): Validation<DatasetItem> {
  if (!object(input)) return { ok: false, issues: ["INVALID_DATASET_ITEM"] };
  const metadata = input.metadata ?? {};
  const expectedOutput = input.expectedOutput ?? null;
  if (
    !text(input.externalKey, 200) ||
    input.externalKey !== (input.externalKey as string).trim() ||
    !Number.isSafeInteger(input.position) ||
    (input.position as number) < 0 ||
    (input.position as number) > 2147483647 ||
    input.input == null ||
    !sha(input.contentSha256) ||
    !object(metadata) ||
    hasSensitiveJson({ input: input.input, expectedOutput, metadata })
  )
    return { ok: false, issues: ["INVALID_DATASET_ITEM"] };
  return {
    ok: true,
    value: {
      externalKey: input.externalKey as string,
      position: input.position as number,
      input: json(input.input),
      expectedOutput: json(expectedOutput),
      contentSha256: input.contentSha256 as string,
      metadata: json(metadata),
    },
    issues: [],
  };
}
export function summarizeDatasetItems(items: readonly unknown[]) {
  const keys = new Set<string>();
  const positions = new Set<number>();
  const duplicateKeys = new Set<string>();
  const duplicatePositions = new Set<number>();
  let valid = 0;
  for (const item of items) {
    const result = validateDatasetItem(item);
    if (!result.ok) continue;
    valid++;
    if (keys.has(result.value.externalKey)) duplicateKeys.add(result.value.externalKey);
    if (positions.has(result.value.position)) duplicatePositions.add(result.value.position);
    keys.add(result.value.externalKey);
    positions.add(result.value.position);
  }
  return {
    total: items.length,
    valid,
    invalid: items.length - valid,
    empty: items.length === 0,
    duplicateKeys: [...duplicateKeys].sort(),
    duplicatePositions: [...duplicatePositions].sort((a, b) => a - b),
    state:
      valid === items.length && !duplicateKeys.size && !duplicatePositions.size
        ? "valid"
        : "invalid",
  };
}
export function canTransitionEvalRun(current: string, next: string) {
  return current === "queued"
    ? ["queued", "running", "failed", "cancelled", "blocked"].includes(next)
    : current === "running" && ["running", "succeeded", "failed", "cancelled"].includes(next);
}
export function canTransitionExperiment(current: string, next: string) {
  return current === "draft"
    ? ["draft", "running", "failed", "cancelled"].includes(next)
    : current === "running" && ["running", "completed", "failed", "cancelled"].includes(next);
}
export function buildEvalResult(input: {
  totalItems: number;
  passedItems: number;
  failedItems: number;
}) {
  if (
    ![input.totalItems, input.passedItems, input.failedItems].every(
      (n) => Number.isSafeInteger(n) && n >= 0 && n <= 2147483647,
    ) ||
    input.totalItems === 0 ||
    input.passedItems + input.failedItems !== input.totalItems
  )
    throw new EvidenceError("EVAL_RUN_RESULT_INVALID");
  return { ...input, score: input.passedItems / input.totalItems, status: "succeeded" as const };
}
export function evidenceSurfaceState(input: {
  loading?: boolean;
  error?: unknown;
  valid?: boolean;
  itemCount?: number;
}) {
  if (input.loading) return "loading";
  if (input.error) return "failure";
  if (input.valid === false) return "invalid";
  return (input.itemCount ?? 0) === 0 ? "empty" : "ready";
}
export const PROVIDER_EVAL_COMPUTE = Object.freeze({
  status: "DEPENDENCY_NOT_CONNECTED",
  runtimeVerified: false,
});
export function assertProviderComputeAvailable(status: string) {
  if (status !== "verified") throw new EvidenceError("PROVIDER_COMPUTE_DISCONNECTED");
}
export function buildEvidenceDraft(input: unknown) {
  if (
    !object(input) ||
    ![
      "dataset_validation",
      "eval_run",
      "benchmark",
      "experiment",
      "security",
      "quality",
      "manual",
    ].includes(String(input.kind)) ||
    ![
      "dataset",
      "dataset_version",
      "eval_definition",
      "eval_run",
      "experiment",
      "benchmark",
      "benchmark_result",
      "project",
      "external",
    ].includes(String(input.subjectType)) ||
    (input.subjectId !== null &&
      !(
        typeof input.subjectId === "string" &&
        /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(input.subjectId)
      )) ||
    !text(input.title, 200) ||
    !optionalText(input.summary, 8000) ||
    !sha(input.contentSha256) ||
    !object(input.payload) ||
    hasSensitiveJson(input.payload)
  )
    throw new EvidenceError("INVALID_EVIDENCE");
  return {
    kind: input.kind as string,
    subjectType: input.subjectType as string,
    subjectId: input.subjectId as string | null,
    title: (input.title as string).trim(),
    summary: (input.summary as string | null | undefined) ?? null,
    contentSha256: input.contentSha256 as string,
    payload: json(input.payload),
    status: "draft" as const,
  };
}
export function safeEvidenceError(error: unknown) {
  const allowed = [
    "PROVIDER_COMPUTE_DISCONNECTED",
    "EVAL_RUN_RESULT_INVALID",
    "INVALID_EVIDENCE",
    "INVALID_DATASET",
    "INVALID_DATASET_ITEM",
  ];
  const code =
    error instanceof EvidenceError
      ? error.code
      : error instanceof Error
        ? error.message.replace(/^XEOMX_/, "")
        : "";
  return new EvidenceError(allowed.includes(code) ? code : "DATABASE_FAILED");
}
