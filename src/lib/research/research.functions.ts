import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Request7Result } from "@/lib/backend/vertical-slice.functions";
import { safeVerticalSliceError } from "@/lib/backend/vertical-slice";
import type { ResearchSourcesByJob, ResearchSubmission } from "@/lib/research/research";

type ResearchInput = {
  projectId: string;
  conversationId?: string;
  question: string;
  idempotencyKey: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9:_-]+$/;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("XEOMX_VALIDATION_FAILED");
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, max: number): string {
  if (typeof value !== "string") throw new Error("XEOMX_VALIDATION_FAILED");
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error("XEOMX_VALIDATION_FAILED");
  return normalized;
}

function uuid(value: unknown): string {
  const normalized = requiredString(value, 36);
  if (!UUID_PATTERN.test(normalized)) throw new Error("XEOMX_VALIDATION_FAILED");
  return normalized;
}

function validateResearch(value: unknown): ResearchInput {
  const input = record(value);
  const idempotencyKey = requiredString(input.idempotencyKey, 200);
  if (idempotencyKey.length < 16 || !IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
    throw new Error("XEOMX_VALIDATION_FAILED");
  }
  const question = requiredString(input.question, 50_000);
  if (question.length < 3) throw new Error("XEOMX_VALIDATION_FAILED");
  return {
    projectId: uuid(input.projectId),
    conversationId: input.conversationId ? uuid(input.conversationId) : undefined,
    question,
    idempotencyKey,
  };
}

function validateProjectId(value: unknown): string {
  return uuid(record(value).projectId);
}

async function safely<T>(operation: () => Promise<T>): Promise<Request7Result<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    const safe = safeVerticalSliceError(error);
    return {
      ok: false,
      error: { code: safe.code, message: safe.message, retryable: safe.retryable },
    };
  }
}

export const submitWebResearchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => value)
  .handler(async ({ context, data }): Promise<Request7Result<ResearchSubmission>> =>
    safely(async () => {
      const input = validateResearch(data);
      const { submitWebResearch } = await import("@/lib/research/research.server");
      return submitWebResearch(context.supabase, { actorId: context.userId, ...input });
    }),
  );

export const listProjectResearchSourcesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => value)
  .handler(async ({ context, data }): Promise<Request7Result<ResearchSourcesByJob>> =>
    safely(async () => {
      const projectId = validateProjectId(data);
      const { listProjectResearchSources } = await import("@/lib/research/research.server");
      return listProjectResearchSources(context.supabase, projectId);
    }),
  );
