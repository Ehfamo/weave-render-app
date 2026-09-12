import type { AutomationEvent } from "./contracts.ts";
export interface ExternalAutomationAdapter {
  readonly id: string;
  readonly configured: boolean;
  dispatch(event: AutomationEvent, signal?: AbortSignal): Promise<{ externalRunId: string }>;
}
export class N8nIntegrationBoundary {
  private adapter: ExternalAutomationAdapter;
  constructor(adapter: ExternalAutomationAdapter) {
    this.adapter = adapter;
  }
  async dispatch(event: AutomationEvent, signal?: AbortSignal) {
    if (this.adapter.id !== "n8n" || !this.adapter.configured) throw Error("N8N_NOT_CONFIGURED");
    return this.adapter.dispatch(structuredClone(event), signal);
  }
}
