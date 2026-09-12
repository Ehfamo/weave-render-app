export const BROWSER_ACTIONS = [
  "navigate",
  "inspect",
  "extract",
  "click",
  "type",
  "submit",
  "wait",
  "screenshot",
] as const;
export type BrowserAction = (typeof BROWSER_ACTIONS)[number];
export function validateBrowserAction(value: unknown, allowedOrigins: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (!BROWSER_ACTIONS.includes(v.action as BrowserAction)) return false;
  if (typeof v.url === "string") {
    try {
      const u = new URL(v.url);
      if (!allowedOrigins.includes(u.origin) || !["https:", "http:"].includes(u.protocol))
        return false;
    } catch {
      return false;
    }
  }
  return JSON.stringify(value).length <= 20_000;
}
export function browserActionRisk(action: BrowserAction) {
  return ["type", "submit"].includes(action)
    ? ("EXTERNAL_ACTION" as const)
    : action === "click"
      ? ("LOW_RISK_WRITE" as const)
      : ("SAFE_READ" as const);
}
