import type { AutomationEvent } from "./contracts.ts";
export interface ExternalAutomationAdapter {
  readonly id: string;
  readonly configured: boolean;
  dispatch(event: AutomationEvent, signal?: AbortSignal): Promise<{ externalRunId: string }>;
}
export class N8nIntegrationBoundary {
  private adapter: ExternalAutomationAdapter;
  private governance?: { authorize(projectId: string, signal?: AbortSignal): Promise<void> };
  constructor(
    adapter: ExternalAutomationAdapter,
    governance?: { authorize(projectId: string, signal?: AbortSignal): Promise<void> },
  ) {
    this.governance = governance;
    this.adapter = adapter;
  }
  async dispatch(event: AutomationEvent, signal?: AbortSignal) {
    if (this.adapter.id !== "n8n" || !this.adapter.configured) throw Error("N8N_NOT_CONFIGURED");
    if (!this.governance) throw Error("CONNECTOR_GOVERNANCE_REQUIRED");
    await this.governance.authorize(event.projectId, signal);
    return this.adapter.dispatch(structuredClone(event), signal);
  }
}
