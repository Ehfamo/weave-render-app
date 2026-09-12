import type { TaskOrchestrator } from "../agents/orchestrator.ts";
import type { AgentTask } from "../agents/contracts.ts";
import type { ProjectBrainService } from "../project-brain/service.ts";
import type { MemoryService } from "../memory/service.ts";
import type { CreativeWorkspaceService } from "../creative/workspace.ts";
import type { CreativeGenerationRequest } from "../creative/contracts.ts";
import type { AutomationAction } from "./contracts.ts";
const obj = (v: unknown) => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw Error("INVALID_ACTION_INPUT");
  return v as Record<string, unknown>;
};
export function canonicalAutomationActions(d: {
  orchestrator: TaskOrchestrator;
  brain: ProjectBrainService;
  memory: MemoryService;
  creative: CreativeWorkspaceService;
}): AutomationAction[] {
  return [
    {
      id: "agent.run",
      risk: "SAFE_READ",
      async execute(v) {
        const x = obj(v),
          r = await d.orchestrator.execute(x.task as AgentTask);
        return JSON.parse(JSON.stringify(r));
      },
    },
    {
      id: "brain.decision",
      risk: "LOW_RISK_WRITE",
      async execute(v) {
        const x = obj(v);
        await d.brain.recordDecision(x.projectId as string, x.id as string, x.text as string);
        return { recorded: true };
      },
    },
    {
      id: "memory.preference",
      risk: "LOW_RISK_WRITE",
      async execute(v) {
        const x = obj(v);
        const r = await d.memory.create({
          type: "PreferenceMemory",
          scope: { kind: "project", projectId: x.projectId as string },
          content: x.text as string,
          importance: (x.importance as number | undefined) ?? 0.8,
          source: { kind: "user", reference: "automation" },
        });
        return { id: r.id };
      },
    },
    {
      id: "creative.generate",
      risk: "LOW_RISK_WRITE",
      async execute(v) {
        return JSON.parse(
          JSON.stringify(
            await d.creative.requestGeneration(obj(v) as unknown as CreativeGenerationRequest),
          ),
        );
      },
    },
  ];
}
