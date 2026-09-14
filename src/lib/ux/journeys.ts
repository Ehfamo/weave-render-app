export interface UxJourney {
  id: string;
  group: "general" | "marketplace";
  entry: string;
  requiredInteractions: number;
  optionalInteractions: number;
  deadEnds: number;
  target: string;
}
export const UX_JOURNEYS: readonly UxJourney[] = [
  ["start-goal", "general", "home", 2, 1, 0, "result"],
  ["continue-project", "general", "home", 1, 0, 0, "project"],
  ["research", "general", "goal", 2, 0, 0, "result"],
  ["create-image", "general", "goal", 2, 1, 0, "creative"],
  ["create-video", "general", "goal", 2, 1, 0, "creative"],
  ["create-campaign", "general", "goal", 2, 1, 0, "project"],
  ["run-automation", "general", "command", 2, 0, 0, "execution"],
  ["assign-agent", "general", "project", 2, 1, 0, "assignment"],
  ["approve-action", "general", "notification", 2, 0, 0, "resumed"],
  ["upload-reference", "general", "project", 2, 1, 0, "asset"],
  ["correct-output", "general", "result", 2, 0, 0, "version"],
  ["inspect-history", "general", "project", 2, 0, 0, "history"],
  ["market-search", "marketplace", "marketplace", 2, 1, 0, "results"],
  ["inspect-listing", "marketplace", "results", 1, 0, 0, "listing"],
  ["permissions", "marketplace", "listing", 1, 0, 0, "trust"],
  ["compatibility", "marketplace", "listing", 1, 0, 0, "trust"],
  ["preview", "marketplace", "listing", 1, 0, 0, "preview"],
  ["compare", "marketplace", "results", 2, 1, 0, "comparison"],
  ["acquire", "marketplace", "listing", 2, 1, 0, "entitlement"],
  ["install", "marketplace", "acquired", 2, 0, 0, "installed"],
  ["use-now", "marketplace", "installed", 1, 0, 0, "project"],
  ["update", "marketplace", "library", 2, 1, 0, "installed"],
  ["disable", "marketplace", "library", 2, 0, 0, "disabled"],
  ["review", "marketplace", "library", 2, 1, 0, "review"],
  ["refund", "marketplace", "library", 2, 1, 0, "refund"],
  ["creator-create", "marketplace", "creator", 2, 2, 0, "draft"],
  ["creator-validate", "marketplace", "draft", 2, 1, 0, "findings"],
  ["creator-publish", "marketplace", "approved", 2, 1, 0, "published"],
  ["creator-earnings", "marketplace", "creator", 1, 0, 0, "ledger"],
  ["team-request", "marketplace", "listing", 3, 1, 0, "approval"],
].map(([id, group, entry, requiredInteractions, optionalInteractions, deadEnds, target]) => ({
  id: id as string,
  group: group as UxJourney["group"],
  entry: entry as string,
  requiredInteractions: requiredInteractions as number,
  optionalInteractions: optionalInteractions as number,
  deadEnds: deadEnds as number,
  target: target as string,
}));
export function journeyMetrics(journeys = UX_JOURNEYS) {
  const withinTwo = journeys.filter((x) => x.requiredInteractions <= 2).length,
    deadEnds = journeys.reduce((sum, x) => sum + x.deadEnds, 0);
  return {
    count: journeys.length,
    withinTwo,
    percentWithinTwo: journeys.length ? Math.round((withinTwo / journeys.length) * 100) : 0,
    deadEnds,
  };
}
export const PRIMARY_NAV_DESTINATIONS = ["projects", "marketplace"] as const;
