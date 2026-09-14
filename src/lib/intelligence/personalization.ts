import type { MemoryWriteClass, StructuredBrief } from "./contracts.ts";

export function classifyMemoryWrite(input: {
  kind: string;
  accepted: boolean;
  stable: boolean;
  sensitive: boolean;
  projectId?: string;
}): MemoryWriteClass {
  if (input.sensitive) return "DO_NOT_STORE";
  if (!input.accepted || !input.stable) return "EPHEMERAL";
  return input.projectId ? "PROJECT_RELEVANT" : "IMPORTANT_STABLE";
}
export function nextActions(brief: StructuredBrief, delivered: boolean): readonly string[] {
  if (!delivered) return [];
  const byType: Partial<Record<string, string[]>> = {
    CREATIVE: ["Create another format", "Adapt language", "Schedule after review"],
    RESEARCH: ["Turn research into a campaign", "Review sources"],
    AUTOMATION: ["Review the WHEN → DO proposal"],
  };
  const kind = brief.outputTypes.includes("creative")
    ? "CREATIVE"
    : brief.requiredApprovals.includes("EXTERNAL_ACTION")
      ? "AUTOMATION"
      : "RESEARCH";
  return (byType[kind] ?? ["Refine result"]).slice(0, 3);
}
