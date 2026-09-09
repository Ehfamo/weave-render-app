import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  ProjectSnapshot,
  ProjectSummary,
  VerticalSliceErrorCode,
  VerticalSliceRoutingMode,
} from "@/lib/backend/vertical-slice";
import { safeVerticalSliceError } from "@/lib/backend/vertical-slice";

export type Request7SafeError = {
  code: VerticalSliceErrorCode;
  message: string;
  retryable: boolean;
};

export type Request7Result<T> = { ok: true; data: T } | { ok: false; error: Request7SafeError };

type ProjectInput = {
  name: string;
  description?: string;
};

type UpdateProjectInput = ProjectInput & {
  projectId: string;
  routingMode: VerticalSliceRoutingMode;
  defaultModel?: string;
};

type ProjectIdInput = { projectId: string };

type GenerationInput = {
  projectId: string;
  conversationId?: string;
  prompt: string;
  routingMode: VerticalSliceRoutingMode;
  requestedProvider?: string;
  requestedModel?: string;
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

function optionalString(value: unknown, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredString(value, max);
}

function uuid(value: unknown): string {
  const normalized = requiredString(value, 36);
  if (!UUID_PATTERN.test(normalized)) throw new Error("XEOMX_VALIDATION_FAILED");
  return normalized;
}

function routingMode(value: unknown): VerticalSliceRoutingMode {
  if (value !== "auto" && value !== "manual") throw new Error("XEOMX_VALIDATION_FAILED");
  return value;
}

function validateProject(value: unknown): ProjectInput {
  const input = record(value);
  return {
    name: requiredString(input.name, 120),
    description: optionalString(input.description, 4_000),
  };
}

function validateProjectId(value: unknown): ProjectIdInput {
  const input = record(value);
  return { projectId: uuid(input.projectId) };
}

function validateProjectUpdate(value: unknown): UpdateProjectInput {
  const input = record(value);
  return {
    ...validateProject(input),
    projectId: uuid(input.projectId),
    routingMode: routingMode(input.routingMode),
    defaultModel: optionalString(input.defaultModel, 200),
  };
}

function validateGeneration(value: unknown): GenerationInput {
  const input = record(value);
  const mode = routingMode(input.routingMode);
  const requestedProvider = optionalString(input.requestedProvider, 120);
  const requestedModel = optionalString(input.requestedModel, 200);
  const idempotencyKey = requiredString(input.idempotencyKey, 200);

  if (idempotencyKey.length < 16 || !IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
    throw new Error("XEOMX_VALIDATION_FAILED");
  }
  if (mode === "manual" && (!requestedProvider || !requestedModel)) {
    throw new Error("XEOMX_VALIDATION_FAILED");
  }

  return {
    projectId: uuid(input.projectId),
    conversationId: input.conversationId ? uuid(input.conversationId) : undefined,
    prompt: requiredString(input.prompt, 50_000),
    routingMode: mode,
    requestedProvider,
    requestedModel,
    idempotencyKey,
  };
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

export const listProjectsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Request7Result<ProjectSummary[]>> =>
    safely(async () => {
      const { listProjects } = await import("@/lib/backend/vertical-slice.server");
      return listProjects(context.supabase);
    }),
  );

export const createProjectFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => value)
  .handler(async ({ context, data }): Promise<Request7Result<ProjectSummary>> =>
    safely(async () => {
      const { createProject } = await import("@/lib/backend/vertical-slice.server");
      return createProject(context.supabase, validateProject(data));
    }),
  );

export const updateProjectFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => value)
  .handler(async ({ context, data }): Promise<Request7Result<ProjectSummary>> =>
    safely(async () => {
      const { updateProject } = await import("@/lib/backend/vertical-slice.server");
      return updateProject(context.supabase, validateProjectUpdate(data));
    }),
  );

export const loadProjectFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => value)
  .handler(async ({ context, data }): Promise<Request7Result<ProjectSnapshot>> =>
    safely(async () => {
      const { loadProjectSnapshot } = await import("@/lib/backend/vertical-slice.server");
      return loadProjectSnapshot(context.supabase, validateProjectId(data).projectId);
    }),
  );

export const cancelGenerationJobFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => value)
  .handler(async ({ context, data }): Promise<Request7Result<{ cancelled: boolean }>> =>
    safely(async () => {
      const input = record(data);
      const { cancelGenerationJob } = await import("@/lib/backend/vertical-slice.server");
      return { cancelled: await cancelGenerationJob(context.supabase, uuid(input.jobId)) };
    }),
  );

export const submitTextGenerationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => value)
  .handler(async ({ context, data }) =>
    safely(async () => {
      const input = validateGeneration(data);
      const { submitTextGeneration } = await import("@/lib/backend/vertical-slice.server");
      return submitTextGeneration(context.supabase, { actorId: context.userId, ...input });
    }),
  );
