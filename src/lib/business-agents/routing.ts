import type { BusinessAgentId } from "./contracts.ts";
const RULES: readonly [RegExp, BusinessAgentId][] = [
  [/competitor|رقیب|رقبا/i, "competitor"],
  [/market research|تحقیق بازار/i, "market-research"],
  [/seo|keyword|سئو/i, "seo"],
  [/social|instagram|شبکه اجتماعی/i, "social-media"],
  [/campaign|کمپین/i, "campaign"],
  [/copy|متن تبلیغ/i, "copywriter"],
  [/lead|prospect|سرنخ/i, "lead-generation"],
  [/follow.?up|پیگیری/i, "follow-up"],
  [/outreach|sdr|ارتباط فروش/i, "sdr"],
  [/sales|فروش/i, "sales-ops"],
  [/ticket|تیکت/i, "ticket"],
  [/support|پشتیبانی/i, "customer-support"],
  [/knowledge|دانش/i, "knowledge"],
  [/visuali[sz]|chart|نمودار/i, "visualization"],
  [/kpi|شاخص/i, "kpi"],
  [/report|گزارش/i, "report"],
  [/metric|data|داده|تحلیل/i, "data-analyst"],
  [/marketing|بازاریابی/i, "marketing"],
  [/research|تحقیق/i, "web-research"],
];
export function selectBusinessAgent(goal: string): BusinessAgentId {
  return RULES.find(([rule]) => rule.test(goal.normalize("NFKC")))?.[1] ?? "web-research";
}
