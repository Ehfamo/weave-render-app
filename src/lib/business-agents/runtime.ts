import type {
  AgentContext,
  AgentPlan,
  AgentResult,
  AgentRuntime,
  ToolResult,
} from "../agents/contracts.ts";
import type { BusinessAgentDefinition, BusinessSource } from "./contracts.ts";
import { assertAgentSkills } from "./skills.ts";

const successful = (outputs: readonly ToolResult[]) =>
  outputs.filter((x) => x.ok).map((x) => x.value);
export function createBusinessAgentRuntime(definition: BusinessAgentDefinition): AgentRuntime {
  assertAgentSkills(definition);
  return {
    definition: {
      id: `business.${definition.id}`,
      name: definition.name,
      enabled: true,
      capabilities: ["workspace.search", "project.context", "memory.read", "model.reason"],
    },
    async plan(context: AgentContext): Promise<AgentPlan> {
      const prompt = [
        `Business agent: ${definition.name}`,
        `Output schema: ${definition.outputSchema}`,
        ...definition.instructions,
        `Goal: ${context.task.goal}`,
        `Authorized bounded project context: ${context.boundedContext ?? context.projectSummary}`,
      ].join("\n");
      return {
        objective: context.task.goal,
        steps: [
          {
            id: "business-context",
            capability: "workspace.search",
            toolId: "workspace.search",
            input: { query: context.task.goal.slice(0, 300), projectId: context.task.projectId },
          },
          {
            id: "business-reason",
            capability: "model.reason",
            toolId: "model.reason",
            input: {
              task: definition.id,
              prompt,
              mode: context.task.routingMode ?? "BALANCED",
            },
          },
        ],
      };
    },
    async finish(context, outputs): Promise<AgentResult> {
      const values = successful(outputs);
      if (values.length !== outputs.length || typeof values[1] !== "string" || !values[1].trim())
        throw Error("BUSINESS_OUTPUT_UNAVAILABLE");
      const search = values[0] as
        { results?: { id: string; title: string; target?: string }[] } | undefined;
      const sources: BusinessSource[] = (search?.results ?? []).map((source) => ({
        ...source,
        provenance: "workspace",
      }));
      return {
        summary: values[1],
        data: {
          agentId: definition.id,
          pack: definition.pack,
          outputSchema: definition.outputSchema,
          values,
        } as never,
        sources: sources.map((source) => ({ ...source, provenance: "workspace" as const })),
      };
    },
  };
}
