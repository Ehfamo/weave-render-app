import type {
  ApprovalPolicy,
  SkillDefinition,
  ToolDefinition,
  ToolInvocation,
  ToolResult,
} from "./contracts.ts";

const safeError = (code: string, retryable = false): ToolResult => ({
  ok: false,
  error: { code, message: code, retryable },
});
export class AgentRegistry {
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly skills = new Map<string, SkillDefinition>();
  registerTool(tool: ToolDefinition) {
    if (!/^[a-z][a-z0-9.-]{1,80}$/.test(tool.id)) throw new Error("INVALID_TOOL_ID");
    if (this.tools.has(tool.id)) throw new Error("DUPLICATE_TOOL");
    this.tools.set(tool.id, Object.freeze({ ...tool }));
  }
  registerSkill(skill: SkillDefinition) {
    if (!/^[a-z][a-z0-9.-]{1,80}$/.test(skill.id)) throw new Error("INVALID_SKILL_ID");
    if (this.skills.has(skill.id)) throw new Error("DUPLICATE_SKILL");
    if (skill.toolIds.some((id) => !this.tools.has(id))) throw new Error("UNKNOWN_SKILL_TOOL");
    this.skills.set(
      skill.id,
      Object.freeze({
        ...skill,
        capabilities: [...skill.capabilities],
        toolIds: [...skill.toolIds],
      }),
    );
  }
  tool(id: string) {
    return this.tools.get(id);
  }
  skill(id: string) {
    return this.skills.get(id);
  }
  listTools() {
    return [...this.tools.values()];
  }
  listSkills() {
    return [...this.skills.values()];
  }
  async invoke(
    invocation: ToolInvocation,
    options: { policy: ApprovalPolicy; approved: boolean; signal?: AbortSignal },
  ): Promise<ToolResult> {
    const tool = this.tools.get(invocation.id);
    if (!tool) return safeError("TOOL_NOT_FOUND");
    if (!tool.enabled) return safeError("TOOL_DISABLED");
    if (!tool.validate(invocation.input)) return safeError("INVALID_TOOL_INPUT");
    if (options.policy.requiresApproval(options.policy.classify(tool)) && !options.approved)
      return safeError("APPROVAL_REQUIRED");
    if (options.signal?.aborted) return safeError("TOOL_CANCELLED");
    try {
      return {
        ok: true,
        value: structuredClone(
          await tool.execute(structuredClone(invocation.input), options.signal),
        ),
      };
    } catch {
      return safeError("TOOL_EXECUTION_FAILED", true);
    }
  }
}
