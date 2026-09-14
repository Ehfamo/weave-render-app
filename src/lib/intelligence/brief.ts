import type {
  BriefContextSource,
  BriefMissingField,
  ExecutionIntent,
  IntentInterpretation,
  StructuredBrief,
} from "./contracts.ts";
import type { RoutingMode } from "../model-gateway/contracts.ts";

export interface IntentInput {
  id: string;
  userId: string;
  projectId: string;
  goal: string;
  locale?: string;
  project?: {
    audience?: string;
    channel?: string;
    locale?: string;
    constraints?: readonly string[];
  };
  context?: readonly {
    id: string;
    ownerId: string;
    projectId?: string;
    kind: string;
    value: string;
    relevant: boolean;
    accepted?: boolean;
  }[];
  selectedReferences?: readonly {
    id: string;
    kind: StructuredBrief["references"][number]["kind"];
  }[];
  explicitQuality?: RoutingMode;
}
const has = (text: string, terms: readonly string[]) => terms.some((x) => text.includes(x));
export function interpretIntent(goal: string, explicitQuality?: RoutingMode): IntentInterpretation {
  const g = goal.normalize("NFKC").toLowerCase();
  const continuation = /^(continue|finish|do the next|ادامه|بعدی|تمامش کن)/u.test(g);
  const modification = has(g, [
    "same ",
    "keep ",
    "shorter",
    "different",
    "previous",
    "همان",
    "همون",
    "قبلی",
    "کوتاه",
    "حفظ",
  ]);
  let kind: IntentInterpretation["kind"] = "GENERAL";
  if (has(g, ["research", "competitor", "market research", "تحقیق", "رقیب"])) kind = "RESEARCH";
  else if (has(g, ["when ", "automation", "automate", "وقتی", "اتوماسیون"])) kind = "AUTOMATION";
  else if (has(g, ["sales", "marketing", "support", "فروش", "بازاریابی", "پشتیبانی"]))
    kind = "BUSINESS";
  else if (
    /(^|\s)ad(\s|$)/u.test(g) ||
    has(g, ["image", "video", "episode", "creative", "campaign", "تصویر", "ویدیو", "قسمت", "تبلیغ"])
  )
    kind = "CREATIVE";
  else if (has(g, ["code", "repository", "patch", "test", "کد", "ریپو", "تست"])) kind = "CODE";
  else if (has(g, ["capability", "marketplace", "seo capability", "قابلیت", "مارکت‌پلیس"]))
    kind = "MARKETPLACE";
  const map = {
    GENERAL: ["general"],
    RESEARCH: ["research", "synthesis"],
    CREATIVE: modification ? ["creative.modify"] : ["creative.generate"],
    CODE: has(g, ["patch", "fix", "پیاده", "اصلاح"])
      ? ["code.inspect", "code.patch", "code.validate"]
      : ["code.inspect"],
    AUTOMATION: ["automation.propose"],
    BUSINESS: has(g, ["sales", "فروش"])
      ? ["marketing", "sales", "copywriting"]
      : ["marketing", "copywriting"],
    MARKETPLACE: ["marketplace.search"],
  } satisfies Record<IntentInterpretation["kind"], IntentInterpretation["capabilities"]>;
  return { kind, modification, continuation, explicitQuality, capabilities: map[kind] };
}
export function inferQuality(goal: string, explicit?: RoutingMode): RoutingMode {
  if (explicit) return explicit;
  const g = goal.toLowerCase();
  if (has(g, ["quick", "draft", "سریع", "پیش‌نویس"])) return "FAST";
  if (has(g, ["final", "production-ready", "best", "نهایی", "حرفه‌ای", "بهترین"])) return "BEST";
  return "BALANCED";
}
function criticalMissing(
  input: IntentInput,
  intent: IntentInterpretation,
  refs: StructuredBrief["references"],
): BriefMissingField[] {
  if (intent.continuation && !refs.some((x) => x.kind === "result"))
    return [
      {
        field: "referenceResultId",
        state: "CRITICAL_UNKNOWN",
        reason: "MULTIPLE_OR_MISSING_CONTINUATION_TARGET",
      },
    ];
  return [];
}
export function createExecutionIntent(input: IntentInput): ExecutionIntent {
  const interpretation = interpretIntent(input.goal, input.explicitQuality);
  const authorized = (input.context ?? []).filter(
    (x) =>
      x.ownerId === input.userId && (!x.projectId || x.projectId === input.projectId) && x.relevant,
  );
  const sources: BriefContextSource[] = authorized.map((x) => ({
    id: x.id,
    scope: x.projectId ? "project" : "user",
    kind: x.kind,
    affectedFields: [x.kind],
  }));
  const references = [
    ...(input.selectedReferences ?? []),
    ...authorized
      .filter((x) => ["brand", "character", "voice", "result", "asset"].includes(x.kind))
      .map((x) => ({ id: x.id, kind: x.kind as StructuredBrief["references"][number]["kind"] })),
  ];
  const missing = criticalMissing(input, interpretation, references);
  const critical = missing.find((x) => x.state === "CRITICAL_UNKNOWN");
  const defaults = [
    !input.locale && !input.project?.locale ? "locale:en" : "",
    !input.project?.channel ? "channel:auto" : "",
  ].filter(Boolean);
  const brief: StructuredBrief = {
    id: input.id,
    userId: input.userId,
    projectId: input.projectId,
    goal: input.goal,
    desiredOutcome: input.goal,
    ...(input.project?.audience ? { audience: input.project.audience } : {}),
    ...(input.project?.channel ? { channel: input.project.channel } : {}),
    locale: input.locale ?? input.project?.locale ?? "en",
    outputTypes: interpretation.kind === "CREATIVE" ? ["creative"] : ["result"],
    constraints: (input.project?.constraints ?? []).map((value, index) => ({
      id: `project:${index}`,
      value,
      source: "project" as const,
    })),
    references,
    contextSources: sources,
    missing,
    quality: inferQuality(input.goal, input.explicitQuality),
    confidence: {
      state: critical
        ? "BLOCKED_MISSING_CRITICAL_CONTEXT"
        : authorized.length || !interpretation.continuation
          ? "ADEQUATE"
          : "LOW_CONFIDENCE",
      grounds: critical ? [critical.reason] : ["INTENT_AND_AUTHORIZED_CONTEXT"],
    },
    requiredApprovals: interpretation.kind === "AUTOMATION" ? ["EXTERNAL_ACTION"] : [],
    preserve: interpretation.modification ? ["unmentioned_prior_properties"] : [],
    changes: interpretation.modification ? [input.goal] : [],
    ...(references.find((x) => x.kind === "result")
      ? { referenceResultId: references.find((x) => x.kind === "result")!.id }
      : {}),
  };
  return {
    brief,
    interpretation,
    clarification: {
      blocks: Boolean(critical),
      ...(critical
        ? { question: "Which previous result should I continue?", field: critical.field }
        : {}),
      defaultsApplied: defaults,
    },
  };
}
