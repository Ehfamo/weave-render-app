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
export interface CanonicalAction {
  id: ActionId;
  kind: "navigate" | "search" | "create-project" | "legacy";
  target?: string;
}
export const ACTIONS: CanonicalAction[] = [
  { id: "newProject", kind: "create-project" },
  { id: "recentProject", kind: "navigate" },
  { id: "search", kind: "search" },
  { id: "create", kind: "navigate", target: "/studio" },
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
