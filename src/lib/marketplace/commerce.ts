import { canonicalJson, hasSensitiveJson } from "../stage53-json.ts";
import type { JsonValue } from "../stage53-json.ts";
import { createBillingBoundary } from "../billing/index.ts";
import type { BillingProvider } from "../billing/index.ts";
import { sha256, verifyPackage } from "./integrity.ts";
import type { CatalogEntry } from "./catalog.ts";

export const COMMERCE_ACTIONS = [
  "publisher",
  "draft",
  "validate",
  "publish",
  "price",
  "acquire",
  "approve",
  "resume",
  "refund",
  "refund_decide",
  "refund_submit",
  "dispute",
  "dispute_decide",
  "payout",
  "payout_submit",
  "lifecycle",
  "policy",
  "dashboard",
  "order",
  "assert_execution",
] as const;
export type CommerceAction = (typeof COMMERCE_ACTIONS)[number];
export type CommerceInput = Record<string, JsonValue>;
export interface CommercePort {
  command(action: string, data: CommerceInput): Promise<JsonValue>;
}
export interface FinancialOperationProvider {
  id: string;
  configured: boolean;
  request(input: {
    kind: "refund" | "payout";
    id: string;
    amountMinor: number;
    currency: string;
    originalReference?: string;
  }): Promise<{ providerReference: string; state: "PENDING" }>;
  verify(input: {
    rawBody: Uint8Array;
    headers: Record<string, string>;
  }): Promise<{
    provider: string;
    eventId: string;
    entityId: string;
    state: "SETTLED" | "FAILED";
    payloadDigest: string;
    signatureVerified: boolean;
    amountMinor: number;
    currency: string;
  }>;
}
export interface CommerceProviders {
  payment?: BillingProvider;
  refund?: FinancialOperationProvider;
  payout?: FinancialOperationProvider;
  feeBps?: number;
}
export function validatePrice(value: unknown) {
  const x = value as Record<string, unknown>;
  if (
    !x ||
    !["FREE", "ONE_TIME", "SUBSCRIPTION"].includes(String(x.billing_model)) ||
    !Number.isSafeInteger(x.amount) ||
    Number(x.amount) < 0 ||
    !["USD", "IRR", "IRT"].includes(String(x.currency)) ||
    !["UNKNOWN", "INCLUDED", "EXCLUDED"].includes(String(x.tax_status)) ||
    !Number.isFinite(Date.parse(String(x.effective_from))) ||
    (x.billing_model === "FREE" ? x.amount !== 0 : Number(x.amount) === 0) ||
    (x.effective_until != null &&
      (!Number.isFinite(Date.parse(String(x.effective_until))) ||
        Date.parse(String(x.effective_until)) <= Date.parse(String(x.effective_from))))
  )
    throw Error("INVALID_PRICE");
  return {
    amount: x.amount as number,
    currency: x.currency as string,
    billing_model: x.billing_model as string,
    tax_status: x.tax_status as string,
    effective_from: x.effective_from as string,
    effective_until: x.effective_until ?? null,
    currency_identity: x.currency === "IRT" ? "TOMAN" : x.currency,
    minor_unit_scale: x.currency === "USD" ? 2 : 0,
    conversion: "UNKNOWN",
    provider_status: "NOT_CONFIGURED",
  } as CommerceInput;
}
export function safeCommerceInput(value: unknown): CommerceInput {
  const serialized = canonicalJson(value);
  if (
    serialized.length > 80000 ||
    hasSensitiveJson(value) ||
    /(?:sk-(?:proj-)?[a-zA-Z0-9_-]{20,}|gh[pousr]_[a-zA-Z0-9]{20,}|-----BEGIN .*PRIVATE KEY-----)/.test(
      serialized,
    )
  )
    throw Error("UNSAFE_COMMERCE_INPUT");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("INVALID_INPUT");
  return JSON.parse(serialized);
}
/** Extension behind MarketplaceService, sharing FI4 identity, store and validation.
 * No production provider is injected; deterministic adapters exist only in tests. */
export class MarketplaceCommerce {
  private port: CommercePort;
  private validatePublication: (entry: CatalogEntry) => Promise<unknown>;
  private providers: CommerceProviders;
  private loadEntry?: (id: string) => Promise<CatalogEntry>;
  constructor(
    port: CommercePort,
    validatePublication: (entry: CatalogEntry) => Promise<unknown>,
    providers: CommerceProviders = {},
    loadEntry?: (id: string) => Promise<CatalogEntry>,
  ) {
    this.port = port;
    this.validatePublication = validatePublication;
    this.providers = providers;
    this.loadEntry = loadEntry;
  }
  async command(action: CommerceAction, input: unknown = {}) {
    if (!(COMMERCE_ACTIONS as readonly string[]).includes(action)) throw Error("INVALID_ACTION");
    const data = safeCommerceInput(input);
    if (
      Object.keys(data).some(
        (k) =>
          k.startsWith("_") ||
          ["signatureVerified", "provider_status", "verified", "feeBps"].includes(k),
      )
    )
      throw Error("SERVER_FACT_REQUIRED");
    data._request_hash = await sha256(canonicalJson(data));
    if (action === "acquire") {
      if (!this.loadEntry) throw Error("NOT_CONFIGURED");
      data._digest = (await this.loadEntry(String(data.version_id))).manifest.integrity.digest;
    }
    if (action === "draft") {
      const e = data.entry as unknown as CatalogEntry;
      await verifyPackage(e.manifest);
      data.price = validatePrice(data.price);
    }
    if (action === "price") data.price = validatePrice(data.price);
    if (action === "validate") {
      const e = (await this.port.command("draft_get", data)) as unknown as { entry: CatalogEntry };
      try {
        if (!e.entry.manifest.disclosure.privacy) throw Error("PRIVACY_REQUIRED");
        await this.validatePublication(e.entry);
        const needsReview =
          e.entry.manifest.permissions.some((p) => p.risk !== "safe_read") ||
          /verified by xeomx|security certified|officially trusted/i.test(
            e.entry.manifest.description,
          );
        return await this.port.command("validate", {
          ...data,
          _stage: needsReview ? "REVIEW_REQUIRED" : "READY",
        });
      } catch {
        return this.port.command("validate", { ...data, _stage: "VALIDATION_FAILED" });
      }
    }
    // These facts are server-owned and never accepted from a browser.
    data._provider = this.providers.payment?.configured
      ? this.providers.payment.id
      : "NOT_CONFIGURED";
    data._fee_bps = this.providers.feeBps ?? null;
    if (action === "refund_submit" || action === "payout_submit") {
      // Durable reservation is established before invoking any provider. Retry does not
      // repeat a possibly completed external request; reconciliation uses verified events.
      const pending = (await this.port.command(action, data)) as Record<string, JsonValue>;
      const provider = action === "refund_submit" ? this.providers.refund : this.providers.payout;
      if (!provider?.configured || pending.claimed !== true) return pending;
      try {
        const result = await provider.request({
          kind: action === "refund_submit" ? "refund" : "payout",
          id: String(pending.id),
          amountMinor: Number(pending.amount),
          currency: String(pending.currency),
        });
        if (result.state !== "PENDING" || !result.providerReference)
          throw Error("INVALID_PROVIDER_RESPONSE");
        return this.port.command("operation_reference", {
          id: pending.id,
          kind: action === "refund_submit" ? "refund" : "payout",
          reference: result.providerReference,
          provider: provider.id,
        });
      } catch {
        return { ...pending, provider_status: "UNAVAILABLE" };
      }
    }
    return this.port.command(action, data);
  }
  /** Internal server adapter entry only. Browser actions cannot submit payment success. */
  async paymentEvent(rawBody: Uint8Array, headers: Record<string, string>) {
    const event = await createBillingBoundary(this.providers.payment).verifyWebhook({
      rawBody,
      headers,
    });
    if (event.payloadDigest !== (await sha256(new TextDecoder().decode(rawBody))))
      throw Error("PAYLOAD_DIGEST_MISMATCH");
    if (!event.money) throw Error("EVENT_AMOUNT_REQUIRED");
    return this.port.command("payment_event", {
      event: JSON.parse(canonicalJson(event)),
      _fee_bps: this.providers.feeBps ?? null,
    });
  }
  async operationEvent(
    kind: "refund" | "payout",
    rawBody: Uint8Array,
    headers: Record<string, string>,
  ) {
    const provider = this.providers[kind];
    if (!provider?.configured) throw Error("NOT_CONFIGURED");
    const event = await provider.verify({ rawBody, headers });
    if (
      !event.signatureVerified ||
      event.provider !== provider.id ||
      event.payloadDigest !== (await sha256(new TextDecoder().decode(rawBody))) ||
      !["SETTLED", "FAILED"].includes(event.state) ||
      !Number.isSafeInteger(event.amountMinor) ||
      event.amountMinor < 0
    )
      throw Error("PROVIDER_EVIDENCE_REQUIRED");
    return this.port.command("operation_event", { kind, event: JSON.parse(canonicalJson(event)) });
  }
}
