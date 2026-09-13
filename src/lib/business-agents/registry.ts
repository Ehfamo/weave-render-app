import type {
  BusinessAgentDefinition,
  BusinessAgentId,
  BusinessAgentPack,
  BusinessPackId,
} from "./contracts.ts";

const agent = (
  pack: BusinessPackId,
  id: BusinessAgentId,
  name: string,
  capabilities: BusinessAgentDefinition["capabilities"],
  skillIds: string[],
  outputSchema: string,
  reviewActions: BusinessAgentDefinition["reviewActions"] = [],
): BusinessAgentDefinition =>
  Object.freeze({
    id,
    pack,
    name,
    capabilities,
    skillIds,
    outputSchema,
    reviewActions,
    instructions: Object.freeze([
      "Use only authorized project context and registered skills.",
      "Never invent sources, contact facts, metrics, external access, or completed external actions.",
      "Return structured output with provenance and explicitly identify missing evidence.",
    ]),
  });

export const BUSINESS_PACKS = Object.freeze([
  {
    id: "research",
    name: "Research",
    agents: [
      agent(
        "research",
        "web-research",
        "Web Research Agent",
        ["research.web"],
        ["research.workspace"],
        "research-with-sources",
      ),
      agent(
        "research",
        "competitor",
        "Competitor Agent",
        ["research.competitors"],
        ["research.workspace", "research.competitors"],
        "competitor-comparison",
      ),
      agent(
        "research",
        "market-research",
        "Market Research Agent",
        ["research.market"],
        ["research.workspace", "research.market"],
        "market-brief",
      ),
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    agents: [
      agent(
        "marketing",
        "marketing",
        "Marketing Agent",
        ["marketing.strategy"],
        ["marketing.strategy"],
        "marketing-strategy",
      ),
      agent("marketing", "seo", "SEO Agent", ["marketing.seo"], ["marketing.seo"], "seo-brief"),
      agent(
        "marketing",
        "social-media",
        "Social Media Agent",
        ["marketing.social"],
        ["marketing.social"],
        "channel-plan",
        ["external_publish", "public_content"],
      ),
      agent(
        "marketing",
        "campaign",
        "Campaign Agent",
        ["marketing.campaign"],
        ["marketing.campaign"],
        "campaign-brief",
        ["campaign_publish", "public_content"],
      ),
      agent(
        "marketing",
        "copywriter",
        "Copywriter Agent",
        ["marketing.copy"],
        ["marketing.copy"],
        "copy-variations",
        ["public_content"],
      ),
    ],
  },
  {
    id: "sales",
    name: "Sales",
    agents: [
      agent(
        "sales",
        "sales-research",
        "Sales Research Agent",
        ["sales.research"],
        ["sales.prospect-research"],
        "account-research",
      ),
      agent(
        "sales",
        "lead-generation",
        "Lead Generation Agent",
        ["sales.leads"],
        ["sales.lead-qualification"],
        "qualified-leads",
      ),
      agent(
        "sales",
        "sdr",
        "SDR Agent",
        ["sales.outreach-draft"],
        ["sales.draft-outreach"],
        "outreach-draft",
        ["sales_outreach", "external_send"],
      ),
      agent(
        "sales",
        "follow-up",
        "Follow-up Agent",
        ["sales.follow-up-draft"],
        ["sales.follow-up-draft"],
        "follow-up-draft",
        ["sales_outreach", "external_send"],
      ),
      agent(
        "sales",
        "sales-ops",
        "Sales Ops Agent",
        ["sales.operations"],
        ["sales.operations"],
        "sales-operations-summary",
      ),
    ],
  },
  {
    id: "support",
    name: "Support",
    agents: [
      agent(
        "support",
        "customer-support",
        "Customer Support Agent",
        ["support.answer-draft"],
        ["support.answer-draft"],
        "support-answer",
        ["customer_response", "external_send"],
      ),
      agent(
        "support",
        "ticket",
        "Ticket Agent",
        ["support.ticket"],
        ["support.classify"],
        "ticket-classification",
      ),
      agent(
        "support",
        "knowledge",
        "Knowledge Agent",
        ["support.knowledge"],
        ["support.knowledge-lookup"],
        "knowledge-answer",
      ),
    ],
  },
  {
    id: "data",
    name: "Data",
    agents: [
      agent(
        "data",
        "data-analyst",
        "Data Analyst Agent",
        ["data.analyze"],
        ["data.analyze"],
        "structured-analysis",
      ),
      agent("data", "report", "Report Agent", ["data.report"], ["data.report"], "executive-report"),
      agent(
        "data",
        "visualization",
        "Visualization Agent",
        ["data.visualization-spec"],
        ["data.visualization-spec"],
        "visualization-spec",
      ),
      agent("data", "kpi", "KPI Agent", ["data.kpi"], ["data.kpi"], "kpi-definition"),
    ],
  },
] satisfies readonly BusinessAgentPack[]);

export class BusinessPackRegistry {
  private readonly packs = new Map(BUSINESS_PACKS.map((pack) => [pack.id, pack]));
  private readonly enabled = new Map<string, Set<BusinessPackId>>();
  discover(projectId: string) {
    const selected = this.enabled.get(projectId);
    return [...this.packs.values()].map((pack) => ({
      ...pack,
      enabled: selected?.has(pack.id) ?? true,
    }));
  }
  agents(projectId: string) {
    return this.discover(projectId)
      .filter((x) => x.enabled)
      .flatMap((x) => x.agents);
  }
  agent(projectId: string, id: BusinessAgentId) {
    return this.agents(projectId).find((x) => x.id === id);
  }
  setEnabled(projectId: string, packId: BusinessPackId, value: boolean) {
    if (!this.packs.has(packId)) throw Error("PACK_NOT_FOUND");
    const set = this.enabled.get(projectId) ?? new Set(BUSINESS_PACK_IDS);
    if (value) set.add(packId);
    else set.delete(packId);
    this.enabled.set(projectId, set);
  }
}
const BUSINESS_PACK_IDS: readonly BusinessPackId[] = [
  "research",
  "marketing",
  "sales",
  "support",
  "data",
];

export const defaultHumanReviewPolicy = {
  requiredActions: [
    "external_send",
    "external_publish",
    "public_content",
    "customer_response",
    "sales_outreach",
    "campaign_publish",
    "destructive_data",
  ] as const,
  requiresReview(action: string) {
    return this.requiredActions.includes(action as never);
  },
};
