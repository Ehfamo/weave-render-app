import type { AgentCapability, SkillDefinition } from "../agents/contracts.ts";
import type { BusinessAgentDefinition } from "./contracts.ts";

export const BUSINESS_SKILL_IDS = [
  "research.workspace",
  "research.competitors",
  "research.market",
  "marketing.strategy",
  "marketing.copy",
  "marketing.seo",
  "marketing.social",
  "marketing.campaign",
  "sales.prospect-research",
  "sales.lead-qualification",
  "sales.draft-outreach",
  "sales.follow-up-draft",
  "sales.operations",
  "support.classify",
  "support.answer-draft",
  "support.knowledge-lookup",
  "data.analyze",
  "data.kpi",
  "data.report",
  "data.visualization-spec",
] as const;

const capabilities: readonly AgentCapability[] = [
  "workspace.search",
  "project.context",
  "memory.read",
  "model.reason",
];
export const businessSkillDefinitions: readonly SkillDefinition[] = BUSINESS_SKILL_IDS.map(
  (id) => ({
    id,
    description: `XEOMX shared business skill: ${id}`,
    capabilities,
    toolIds: ["workspace.search", "model.reason"],
    enabled: true,
  }),
);
export function assertAgentSkills(definition: BusinessAgentDefinition) {
  const available = new Set<string>(BUSINESS_SKILL_IDS);
  if (definition.skillIds.some((id) => !available.has(id))) throw Error("UNKNOWN_BUSINESS_SKILL");
}
