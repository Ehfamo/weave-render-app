import type {
  ModelDescriptor,
  ProviderAdapter,
  ProviderHealth,
  ProviderMetadata,
} from "./contracts.ts";

export interface RegisteredProvider {
  provider: ProviderMetadata;
  enabled: boolean;
  health: ProviderHealth;
  models: readonly ModelDescriptor[];
}

/** Configuration belongs to XEOMX. Snapshots never contain adapter instances or credentials. */
export class ProviderRegistry {
  private entries = new Map<string, { adapter: ProviderAdapter; enabled: boolean }>();
  register(adapter: ProviderAdapter, enabled = true): void {
    if (!adapter.provider.id.trim() || this.entries.has(adapter.provider.id))
      throw new Error("Invalid or duplicate provider");
    this.entries.set(adapter.provider.id, { adapter, enabled });
  }
  setEnabled(id: string, enabled: boolean): void {
    const entry = this.entries.get(id);
    if (!entry) throw new Error("Unknown provider");
    entry.enabled = enabled;
  }
  getAdapter(id: string): ProviderAdapter | undefined {
    const entry = this.entries.get(id);
    return entry?.enabled ? entry.adapter : undefined;
  }
  async snapshot(): Promise<RegisteredProvider[]> {
    return Promise.all(
      [...this.entries.values()].map(async ({ adapter, enabled }) => {
        let health: ProviderHealth = {
          availability: "UNAVAILABLE",
          checkedAt: new Date().toISOString(),
        };
        let models: readonly ModelDescriptor[] = [];
        if (enabled) {
          try {
            health = await adapter.getHealth();
            if (["AVAILABLE", "DEGRADED"].includes(health.availability)) {
              models = (await adapter.discoverModels()).filter(
                (m) => m.identity.providerId === adapter.provider.id,
              );
            }
          } catch {
            health = { availability: "UNAVAILABLE", checkedAt: new Date().toISOString() };
          }
        }
        return {
          provider: { id: adapter.provider.id, displayName: adapter.provider.displayName },
          enabled,
          health: { availability: health.availability, checkedAt: health.checkedAt },
          models: models.map((m) => ({
            identity: { providerId: m.identity.providerId, modelId: m.identity.modelId },
            capabilities: [...m.capabilities],
            quality: m.quality,
            estimatedLatencyMs: m.estimatedLatencyMs,
            estimatedCostPer1kTokensUsd: m.estimatedCostPer1kTokensUsd,
          })),
        };
      }),
    );
  }
}
