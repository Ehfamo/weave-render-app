export const VERTICAL_SLICE_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "PROJECT_NOT_FOUND",
  "CONVERSATION_NOT_FOUND",
  "JOB_NOT_FOUND",
  "INSUFFICIENT_CREDITS",
  "PROVIDER_UNAVAILABLE",
  "MODEL_UNAVAILABLE",
  "PROVIDER_TIMEOUT",
  "GENERATION_FAILED",
  "STORAGE_FAILED",
  "DATABASE_FAILED",
  "IDEMPOTENCY_CONFLICT",
  "VALIDATION_FAILED",
] as const;

export type VerticalSliceErrorCode = (typeof VERTICAL_SLICE_ERROR_CODES)[number];

const SAFE_ERROR_MESSAGES: Record<VerticalSliceErrorCode, string> = {
  UNAUTHENTICATED: "Sign in to continue.",
  FORBIDDEN: "You do not have permission to perform this action.",
  PROJECT_NOT_FOUND: "The project was not found or is not available to this account.",
  CONVERSATION_NOT_FOUND: "The conversation was not found in this project.",
  JOB_NOT_FOUND: "The generation job could not be found.",
  INSUFFICIENT_CREDITS: "There are not enough credits to start this generation.",
  PROVIDER_UNAVAILABLE: "No verified text provider is configured for this environment.",
  MODEL_UNAVAILABLE: "The requested model is not available for this environment.",
  PROVIDER_TIMEOUT:
    "The provider did not respond in time. No successful-generation charge was kept.",
  GENERATION_FAILED: "Generation failed. The prompt and project history were preserved.",
  STORAGE_FAILED: "The result could not be persisted safely.",
  DATABASE_FAILED: "The project service is temporarily unavailable.",
  IDEMPOTENCY_CONFLICT: "This request identity was already used for different input.",
  VALIDATION_FAILED: "Check the request and try again.",
};

export class VerticalSliceError extends Error {
  readonly code: VerticalSliceErrorCode;
  readonly retryable: boolean;

  constructor(
    code: VerticalSliceErrorCode,
    options?: { message?: string; retryable?: boolean; cause?: unknown },
  ) {
    super(options?.message ?? SAFE_ERROR_MESSAGES[code], { cause: options?.cause });
    this.name = "VerticalSliceError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
  }
}

export function safeVerticalSliceError(error: unknown): VerticalSliceError {
  if (error instanceof VerticalSliceError) return error;
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const normalized = raw.toUpperCase();
  const databaseCode = normalized.match(/XEOMX_([A-Z_]+)/)?.[1];
  const aliases: Record<string, VerticalSliceErrorCode> = {
    UNAUTHENTICATED: "UNAUTHENTICATED",
    FORBIDDEN: "FORBIDDEN",
    PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
    CONVERSATION_NOT_FOUND: "CONVERSATION_NOT_FOUND",
    JOB_NOT_FOUND: "JOB_NOT_FOUND",
    INSUFFICIENT_CREDITS: "INSUFFICIENT_CREDITS",
    PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
    MODEL_UNAVAILABLE: "MODEL_UNAVAILABLE",
    PROVIDER_TIMEOUT: "PROVIDER_TIMEOUT",
    GENERATION_FAILED: "GENERATION_FAILED",
    STORAGE_FAILED: "STORAGE_FAILED",
    DATABASE_FAILED: "DATABASE_FAILED",
    IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
    VALIDATION_FAILED: "VALIDATION_FAILED",
  };
  const code =
    (databaseCode && aliases[databaseCode]) ||
    (databaseCode?.startsWith("VALIDATION_") ? "VALIDATION_FAILED" : "DATABASE_FAILED");
  return new VerticalSliceError(code, {
    retryable: ["PROVIDER_TIMEOUT", "GENERATION_FAILED", "DATABASE_FAILED"].includes(code),
    cause: error,
  });
}

export type VerticalSliceRoutingMode = "auto" | "manual";

export const REQUEST_7_LIVE_TEXT_PROVIDER = {
  id: "cloudflare",
  model: "@cf/meta/llama-3.1-8b-instruct-fast",
  reservedCreditUnits: 5,
} as const;
export type PersistedJobState = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  defaultRoutingMode: VerticalSliceRoutingMode;
  defaultModel: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationSummary = {
  id: string;
  projectId: string;
  title: string;
  routingMode: VerticalSliceRoutingMode;
  selectedProvider: string | null;
  selectedModel: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  provider: string | null;
  model: string | null;
  generationJobId: string | null;
  createdAt: string;
};

export type GenerationJobSummary = {
  id: string;
  projectId: string;
  conversationId: string;
  status: PersistedJobState;
  routingMode: VerticalSliceRoutingMode;
  selectedProvider: string | null;
  selectedModel: string | null;
  errorCode: VerticalSliceErrorCode | null;
  errorMessage: string | null;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type AssetSummary = {
  id: string;
  projectId: string;
  generationJobId: string | null;
  kind: "text" | "image" | "video" | "audio" | "document" | "code" | "file";
  mimeType: string;
  status: "pending" | "processing" | "ready" | "failed" | "deleted";
  storageBucket: string | null;
  storagePath: string | null;
  createdAt: string;
};

export type ProjectAuditEvent = {
  id: string;
  eventType: string;
  result: "submitted" | "allowed" | "succeeded" | "failed" | "cancelled";
  jobId: string | null;
  errorCategory: string | null;
  createdAt: string;
};

export type UsageEventSummary = {
  id: string;
  jobId: string;
  provider: string;
  model: string;
  inputUnits: number | null;
  outputUnits: number | null;
  usageUnavailable: boolean;
  createdAt: string;
};

export type CreditLedgerEntrySummary = {
  id: string;
  jobId: string | null;
  delta: number;
  reason: "grant" | "reservation" | "consume" | "release" | "refund" | "adjustment";
  createdAt: string;
};

export type ProjectSnapshot = {
  project: ProjectSummary;
  conversations: readonly ConversationSummary[];
  messages: readonly ProjectMessage[];
  jobs: readonly GenerationJobSummary[];
  assets: readonly AssetSummary[];
  usageEvents: readonly UsageEventSummary[];
  creditLedger: readonly CreditLedgerEntrySummary[];
  auditEvents: readonly ProjectAuditEvent[];
  creditBalance: number;
};

export type TextProviderUsage = {
  inputUnits: number | null;
  outputUnits: number | null;
  estimatedCostMicrounits: number | null;
  actualCostMicrounits: number | null;
  actualCreditUnits: number;
  unavailable: boolean;
};

export type TextProviderOutput = {
  text: string;
  providerRequestId: string | null;
  finishReason: string | null;
  usage: TextProviderUsage;
};

export type TextProviderDescriptor = {
  id: string;
  model: string;
  capabilities: readonly string[];
  verifiedAvailable: boolean;
  evidenceReference?: string;
  reservedCreditUnits: number;
};

export interface TextGenerationProvider {
  readonly descriptor: TextProviderDescriptor;
  generate(input: {
    prompt: string;
    projectId: string;
    jobId: string;
    signal?: AbortSignal;
  }): Promise<TextProviderOutput>;
}

export type TextProviderRouteDecision =
  | { state: "ready"; provider: TextGenerationProvider }
  | {
      state: "unavailable";
      code: "PROVIDER_UNAVAILABLE" | "MODEL_UNAVAILABLE";
    };

export function routeTextProvider(input: {
  mode: VerticalSliceRoutingMode;
  providers: readonly TextGenerationProvider[];
  requestedProvider?: string;
  requestedModel?: string;
}): TextProviderRouteDecision {
  const supportsText = (provider: TextGenerationProvider) =>
    provider.descriptor.verifiedAvailable &&
    Boolean(provider.descriptor.evidenceReference) &&
    provider.descriptor.id.trim().length > 0 &&
    provider.descriptor.model.trim().length > 0 &&
    provider.descriptor.capabilities.includes("text-generation") &&
    Number.isSafeInteger(provider.descriptor.reservedCreditUnits) &&
    provider.descriptor.reservedCreditUnits >= 0;

  if (input.mode === "manual") {
    const requested = input.providers.find(
      (provider) =>
        provider.descriptor.id === input.requestedProvider &&
        provider.descriptor.model === input.requestedModel,
    );
    if (!requested) return { state: "unavailable", code: "MODEL_UNAVAILABLE" };
    return supportsText(requested)
      ? { state: "ready", provider: requested }
      : { state: "unavailable", code: "PROVIDER_UNAVAILABLE" };
  }

  const provider = input.providers.find(supportsText);
  return provider
    ? { state: "ready", provider }
    : { state: "unavailable", code: "PROVIDER_UNAVAILABLE" };
}

export type GenerationSubmissionInput = {
  actorId: string;
  projectId: string;
  conversationId?: string;
  prompt: string;
  routingMode: VerticalSliceRoutingMode;
  requestedProvider?: string;
  requestedModel?: string;
  idempotencyKey: string;
  requestHash: string;
};

export type PersistedSubmission = {
  jobId: string;
  conversationId: string;
  created: boolean;
  status: PersistedJobState;
};

export type GenerationExecutionResult = PersistedSubmission & {
  error?: { code: VerticalSliceErrorCode; message: string; retryable: boolean };
};

export interface VerticalSlicePersistence {
  recordUnavailable(
    input: GenerationSubmissionInput & {
      errorCode: "PROVIDER_UNAVAILABLE" | "MODEL_UNAVAILABLE";
    },
  ): Promise<PersistedSubmission>;
  createSubmission(
    input: GenerationSubmissionInput & {
      selectedProvider: string;
      selectedModel: string;
      reservedCreditUnits: number;
    },
  ): Promise<PersistedSubmission>;
  markRunning(jobId: string): Promise<boolean>;
  complete(
    jobId: string,
    output: TextProviderOutput,
  ): Promise<{ outputId: string; assetId: string; messageId: string }>;
  fail(
    jobId: string,
    error: Pick<VerticalSliceError, "code" | "message">,
    providerRequestId?: string | null,
  ): Promise<void>;
  readSubmission(jobId: string): Promise<PersistedSubmission>;
}

export async function executeTextGeneration(input: {
  request: GenerationSubmissionInput;
  providers: readonly TextGenerationProvider[];
  persistence: VerticalSlicePersistence;
  signal?: AbortSignal;
}): Promise<GenerationExecutionResult> {
  const { request, persistence } = input;
  if (!request.actorId) throw new VerticalSliceError("UNAUTHENTICATED");
  if (!request.projectId || request.prompt.trim().length === 0) {
    throw new VerticalSliceError("VALIDATION_FAILED");
  }

  const route = routeTextProvider({
    mode: request.routingMode,
    providers: input.providers,
    requestedProvider: request.requestedProvider,
    requestedModel: request.requestedModel,
  });

  if (route.state === "unavailable") {
    const submission = await persistence.recordUnavailable({
      ...request,
      errorCode: route.code,
    });
    const error = new VerticalSliceError(route.code);
    return {
      ...submission,
      error: { code: error.code, message: error.message, retryable: error.retryable },
    };
  }

  const submission = await persistence.createSubmission({
    ...request,
    selectedProvider: route.provider.descriptor.id,
    selectedModel: route.provider.descriptor.model,
    reservedCreditUnits: route.provider.descriptor.reservedCreditUnits,
  });

  if (!submission.created) return persistence.readSubmission(submission.jobId);
  const started = await persistence.markRunning(submission.jobId);
  if (!started) return persistence.readSubmission(submission.jobId);

  try {
    const output = await route.provider.generate({
      prompt: request.prompt,
      projectId: request.projectId,
      jobId: submission.jobId,
      signal: input.signal,
    });
    if (!output.text.trim()) throw new VerticalSliceError("GENERATION_FAILED", { retryable: true });
    await persistence.complete(submission.jobId, output);
    return { ...submission, status: "succeeded" };
  } catch (error) {
    const safe =
      error instanceof VerticalSliceError
        ? error
        : new VerticalSliceError("GENERATION_FAILED", { retryable: true, cause: error });
    await persistence.fail(submission.jobId, safe);
    return {
      ...submission,
      status: "failed",
      error: { code: safe.code, message: safe.message, retryable: safe.retryable },
    };
  }
}

export const REQUEST_7_WORKFLOW_MATURITY = {
  W03: "CONNECTED",
  W04: "CONNECTED",
  W05: "CONNECTED",
  W08: "CONNECTED",
  W09: "CONNECTED",
  W20: "CONNECTED",
} as const satisfies Record<
  "W03" | "W04" | "W05" | "W08" | "W09" | "W20",
  "DESIGNED" | "CONNECTED" | "LIVE_VERIFIED"
>;
