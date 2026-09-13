import type { AutomationAction } from "../automation/contracts.ts";
import type { CollaborationService } from "../collaboration/service.ts";
import type { CreativeGenerationRequest } from "../creative/contracts.ts";
import type { CreativeWorkspaceService } from "../creative/workspace.ts";
import type { MemoryService } from "../memory/service.ts";
import type { ProjectBrainService } from "../project-brain/service.ts";
import type { BusinessRunContext } from "./contracts.ts";
import type { BusinessAgentService } from "./service.ts";

export function businessAutomationAction(service: BusinessAgentService): AutomationAction {
  return {
    id: "business.run",
    risk: "SAFE_READ",
    async execute(input) {
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw Error("INVALID_BUSINESS_RUN");
      return JSON.parse(JSON.stringify(await service.run(input as unknown as BusinessRunContext)));
    },
  };
}

export class BusinessPlatformIntegrations {
  private readonly service: BusinessAgentService;
  private readonly collaboration: CollaborationService;
  private readonly creative: CreativeWorkspaceService;
  private readonly brain: ProjectBrainService;
  private readonly memory: MemoryService;
  constructor(
    service: BusinessAgentService,
    collaboration: CollaborationService,
    creative: CreativeWorkspaceService,
    brain: ProjectBrainService,
    memory: MemoryService,
  ) {
    this.service = service;
    this.collaboration = collaboration;
    this.creative = creative;
    this.brain = brain;
    this.memory = memory;
  }
  async runAssignment(context: BusinessRunContext, assignmentId: string) {
    const result = await this.service.run(context);
    if (result.status === "completed")
      await this.collaboration.complete(context.projectId, assignmentId, result.artifacts[0].id);
    return result;
  }
  createCampaignAsset(request: CreativeGenerationRequest) {
    return this.creative.requestGeneration(request);
  }
  async retainAcceptedOutcome(input: {
    projectId: string;
    id: string;
    text: string;
    remember: boolean;
  }) {
    await this.brain.recordDecision(input.projectId, input.id, input.text);
    if (!input.remember) return;
    await this.memory.create({
      type: "InstructionMemory",
      scope: { kind: "project", projectId: input.projectId },
      content: input.text,
      importance: 0.85,
      source: { kind: "user", reference: `business:${input.id}` },
    });
  }
}
