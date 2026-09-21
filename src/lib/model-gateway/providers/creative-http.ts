import type {
  AdapterResult,
  ModelCapability,
  ModelDescriptor,
  ModelRequest,
  ProviderAdapter,
} from "../contracts.ts";

/** Configured provider bridge. The endpoint implements the documented ModelRequest/AdapterResult
 * contract; it is server configuration, never a browser-supplied URL. No simulated outputs. */
export class CreativeHttpAdapter implements ProviderAdapter {
  readonly provider = { id: "creative-http", displayName: "Configured Creative Provider" };
  private config: { endpoint?: string; key?: string; models: readonly ModelDescriptor[] };
  constructor(config: { endpoint?: string; key?: string; models: readonly ModelDescriptor[] }) {
    this.config = config;
  }
  private configured() {
    try {
      const url = new URL(this.config.endpoint ?? "");
      return url.protocol === "https:" && !url.username && !url.password && !!this.config.key;
    } catch {
      return false;
    }
  }
  async discoverModels() {
    return this.configured() ? this.config.models : [];
  }
  async getHealth() {
    return {
      availability: this.configured() ? ("AVAILABLE" as const) : ("UNAVAILABLE" as const),
      checkedAt: new Date().toISOString(),
    };
  }
  async execute(
    request: Readonly<ModelRequest>,
    model: Readonly<{ providerId: string; modelId: string }>,
    signal?: AbortSignal,
  ): Promise<AdapterResult> {
    if (!this.configured())
      return {
        ok: false,
        error: { code: "PROVIDER_UNAVAILABLE", message: "NOT_CONFIGURED", retryable: false },
      };
    const response = await fetch(this.config.endpoint!, {
      method: "POST",
      redirect: "error",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.key}`,
        "Idempotency-Key": request.requestId,
      },
      body: JSON.stringify({ ...request, model: model.modelId }),
    });
    if (!response.ok)
      return {
        ok: false,
        error: { code: "PROVIDER_UNAVAILABLE", message: "PROVIDER_UNAVAILABLE", retryable: false },
      };
    return (await response.json()) as AdapterResult;
  }
}
export const creativeCapabilities: readonly ModelCapability[] = [
  "image",
  "video",
  "audio",
  "voice",
];
