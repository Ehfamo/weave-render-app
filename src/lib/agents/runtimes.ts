import type {
  AgentContext,
  AgentPlan,
  AgentResult,
  AgentRuntime,
  ToolResult,
} from "./contracts.ts";

const resultValues = (outputs: readonly ToolResult[]) =>
  outputs.filter((x) => x.ok).map((x) => x.value);
export const researchAgent: AgentRuntime = {
  definition: {
    id: "research",
    name: "Research Agent",
    enabled: true,
    capabilities: ["workspace.search", "project.context", "memory.read", "model.reason"],
  },
  async plan(context): Promise<AgentPlan> {
    return {
      objective: context.task.goal,
      steps: [
        {
          id: "research-search",
          capability: "workspace.search",
          toolId: "workspace.search",
          input: { query: context.task.goal, projectId: context.task.projectId },
        },
        {
          id: "research-synthesis",
          capability: "model.reason",
          toolId: "model.reason",
          input: { task: "research", prompt: context.task.goal },
        },
      ],
    };
  },
  async finish(context, outputs): Promise<AgentResult> {
    const values = resultValues(outputs);
    const search = values[0] as
      { results?: { id: string; title: string; target?: string }[] } | undefined;
    return {
      summary:
        typeof values[1] === "string" ? values[1] : `Research completed for: ${context.task.goal}`,
      data: values as never,
      sources: (search?.results ?? []).map((s) => ({ ...s, provenance: "workspace" as const })),
    };
  },
};

export const codingAgent: AgentRuntime = {
  definition: {
    id: "coding",
    name: "Coding Agent",
    enabled: true,
    capabilities: ["code.read", "code.propose", "code.validate", "model.reason"],
  },
  async plan(context): Promise<AgentPlan> {
    return {
      objective: context.task.goal,
      steps: [
        {
          id: "code-context",
          capability: "code.read",
          toolId: "code.read",
          input: { query: context.task.goal, projectId: context.task.projectId },
        },
        {
          id: "code-proposal",
          capability: "code.propose",
          toolId: "model.reason",
          input: { task: "code-proposal", prompt: context.task.goal },
        },
      ],
    };
  },
  async finish(context, outputs): Promise<AgentResult> {
    const values = resultValues(outputs);
    return {
      summary:
        typeof values.at(-1) === "string"
          ? (values.at(-1) as string)
          : `Change proposal prepared for: ${context.task.goal}`,
      data: values as never,
    };
  },
};

export const browserAgent: AgentRuntime = {
  definition: {
    id: "browser",
    name: "Browser Agent",
    enabled: true,
    capabilities: ["browser.navigate", "browser.inspect", "browser.interact"],
  },
  async plan(context): Promise<AgentPlan> {
    return {
      objective: context.task.goal,
      steps: [
        {
          id: "browser-inspect",
          capability: "browser.inspect",
          toolId: "browser.action",
          input: { action: "inspect", goal: context.task.goal },
        },
      ],
    };
  },
  async finish(context, outputs): Promise<AgentResult> {
    return {
      summary: `Browser inspection completed for: ${context.task.goal}`,
      data: resultValues(outputs) as never,
    };
  },
};

export const DEFAULT_AGENTS = [researchAgent, codingAgent, browserAgent] as const;
export function selectAgent(goal: string) {
  const value = goal.normalize("NFKC").toLocaleLowerCase("en");
  if (/\b(code|coding|repository|test|bug|patch)\b|کد|باگ|مخزن/.test(value)) return codingAgent;
  if (/\b(website|browser|page|url|click|navigate)\b|وب.?سایت|مرورگر|صفحه/.test(value))
    return browserAgent;
  return researchAgent;
}
