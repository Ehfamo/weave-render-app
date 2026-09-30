import type { CommerceInput } from "./commerce.ts";
import type { JsonValue } from "../stage53-json.ts";
export type CommerceRow = Record<string, JsonValue>;
export const commerceRow = (value: JsonValue | undefined): CommerceRow =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
export const commerceRows = (value: JsonValue | undefined): CommerceRow[] =>
  Array.isArray(value) ? value.map(commerceRow) : [];
export function commerceMoney(row: CommerceRow) {
  const amount = Number(row.amount ?? 0),
    currency = String(row.currency ?? "UNKNOWN");
  return `${currency === "USD" ? (amount / 100).toFixed(2) : amount} ${currency}`;
}
/** Keep a request's key stable across uncertain transport retries, without persisting private data in a browser store. */
export function commerceRequestKey() {
  const keys = new Map<string, string>();
  return (action: string, input: CommerceInput) => {
    const key = JSON.stringify([action, input]);
    if (!keys.has(key)) keys.set(key, crypto.randomUUID());
    return keys.get(key)!;
  };
}
