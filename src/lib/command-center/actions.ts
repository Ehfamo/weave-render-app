import { normalize } from "../global-search/service.ts";
export const ACTION_IDS = [
  "newProject",
  "recentProject",
  "search",
  "create",
  "chat",
  "memory",
  "generations",
  "settings",
  "more",
] as const;
export type ActionId = (typeof ACTION_IDS)[number];
export type AgentTaskIntent =
  "research" | "coding" | "browser" | "continue" | "automation" | "assignment" | "approval";
export function classifyAgentTaskIntent(
  input: string,
): { intent: AgentTaskIntent; goal: string } | null {
  const goal = normalize(input);
  if (/^(create|run).*(workflow|automation)|^(ساخت|اجرای).*(گردش.?کار|اتوماسیون)/.test(goal))
    return { intent: "automation", goal };
  if (/^(assign|delegate)|^(واگذار|اختصاص)/.test(goal)) return { intent: "assignment", goal };
  if (/waiting.*approval|منتظر.*تایید/.test(goal)) return { intent: "approval", goal };
  if (/^(research|compare|investigate)\b|^(تحقیق|بررسی رقبا)/.test(goal))
    return { intent: "research", goal };
  if (/^(analyze|review|fix|change).*(code|repository)|^(کد|مخزن).*(تحلیل|بررسی)/.test(goal))
    return { intent: "coding", goal };
  if (/^(check|inspect|open).*(website|page|url)|^(وب.?سایت|صفحه).*(بررسی|باز)/.test(goal))
    return { intent: "browser", goal };
  if (/^(continue my|ادامه).*(campaign|project|کمپین|پروژه)/.test(goal))
    return { intent: "continue", goal };
  return null;
}
export interface CanonicalAction {
  id: ActionId;
  kind: "navigate" | "search" | "create-project" | "legacy";
  target?: string;
}
export const ACTIONS: CanonicalAction[] = [
  { id: "newProject", kind: "create-project" },
  { id: "recentProject", kind: "navigate" },
  { id: "search", kind: "search" },
  { id: "create", kind: "navigate", target: "/creative-workspace" },
  { id: "chat", kind: "navigate", target: "/xeomx-ai" },
  { id: "memory", kind: "navigate", target: "/workspace?type=memory" },
  { id: "generations", kind: "navigate", target: "/workspace?type=generation" },
  { id: "settings", kind: "navigate", target: "/settings" },
  { id: "more", kind: "legacy" },
];
export function classifyIntent(input: string): { action?: ActionId; query: string } {
  const q = normalize(input);
  if (/^(open my last project|continue recent project|آخرین پروژه|افتح آخر مشروع)$/.test(q))
    return { action: "recentProject", query: "" };
  if (/^(show recent generations|آخرین تولیدها|اعرض آخر النتائج)$/.test(q))
    return { action: "generations", query: "" };
  if (/^(create an ad|ساخت تبلیغ|أنشئ إعلان)/.test(q)) return { action: "create", query: "" };
  return { query: q.replace(/^(find my |find |search |پیدا کن |ابحث عن )/, "") };
}
export function isCommandShortcut(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
}) {
  return !e.isComposing && !e.altKey && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
}
export function actionTarget(id: ActionId, recent?: string) {
  const a = ACTIONS.find((a) => a.id === id);
  if (!a) throw new Error("UNKNOWN_ACTION");
  return id === "recentProject" ? recent : a.target;
}

export interface ActionHandlers {
  recent?: string;
  navigate(target: string): void;
  createProject(): Promise<string>;
  search(): void;
  more(): void;
}
/** Explicit selection only: intent classification never executes a side effect. */
export async function runAction(id: ActionId, handlers: ActionHandlers) {
  const action = ACTIONS.find((a) => a.id === id);
  if (!action) throw new Error("UNKNOWN_ACTION");
  if (action.kind === "create-project") {
    handlers.navigate(await handlers.createProject());
    return;
  }
  if (action.kind === "search") {
    handlers.search();
    return;
  }
  if (action.kind === "legacy") {
    handlers.more();
    return;
  }
  const target = actionTarget(id, handlers.recent);
  if (!target) throw new Error("ACTION_UNAVAILABLE");
  handlers.navigate(target);
}
