/** XEOMX-owned boundary. No credentials, SDK objects, identity or persistence authority. */
export type RoutingMode = "FAST" | "BALANCED" | "BEST";
export type ModelCapability = "text" | "structured" | "embedding";
export interface ModelIdentity {
  providerId: string;
  modelId: string;
}
export interface ProviderMetadata {
  id: string;
  displayName: string;
}
export interface ModelDescriptor {
  identity: ModelIdentity;
  capabilities: readonly ModelCapability[];
  /** Comparable XEOMX configuration: quality in [0,1], latency ms, USD per 1K tokens. */
  quality: number;
  estimatedLatencyMs: number;
  estimatedCostPer1kTokensUsd: number;
}
export interface ModelRequest {
  requestId: string;
  task: string;
  mode: RoutingMode;
  capability: ModelCapability;
  input: string;
  maxOutputTokens?: number;
}
export type ModelOutput =
  | { kind: "text"; text: string }
  | { kind: "structured"; value: JsonValue }
  | { kind: "embedding"; values: number[] };
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
}
export type ModelErrorCode =
  | "AUTH_ERROR"
  | "RATE_LIMIT"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "TIMEOUT"
  | "CONTENT_REJECTED"
  | "UNKNOWN_PROVIDER_ERROR";
export interface ModelError {
  code: ModelErrorCode;
  message: string;
  retryable: boolean;
}
export type Availability = "AVAILABLE" | "UNAVAILABLE" | "DEGRADED";
export interface ProviderHealth {
  availability: Availability;
  checkedAt: string;
}
export type AdapterResult =
  { ok: true; output: ModelOutput; usage?: ModelUsage } | { ok: false; error: ModelError };
export type ModelResponse = AdapterResult & {
  requestId: string;
  model?: ModelIdentity;
  latencyMs: number;
};
export interface ProviderAdapter {
  readonly provider: ProviderMetadata;
  discoverModels(): Promise<readonly ModelDescriptor[]>;
  getHealth(): Promise<ProviderHealth>;
  execute(
    request: Readonly<ModelRequest>,
    model: Readonly<ModelIdentity>,
    signal?: AbortSignal,
  ): Promise<AdapterResult>;
}
