import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useProjectsHome } from "@/hooks/use-projects";
import { marketplaceCommerceFn } from "@/lib/marketplace/functions";
import type { CommerceAction, CommerceInput } from "@/lib/marketplace/commerce";
import {
  commerceMoney,
  commerceRow,
  commerceRows,
  commerceRequestKey,
} from "@/lib/marketplace/commerce-view";
import type { CommerceRow } from "@/lib/marketplace/commerce-view";
import type { JsonValue } from "@/lib/stage53-json";
import { m } from "@/paraglide/messages.js";
const button =
  "min-h-11 rounded-xl border px-4 py-2 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const field =
  "block min-h-11 w-full rounded-lg border bg-background p-2 focus-visible:ring-2 focus-visible:ring-ring";
const text = (key: string) =>
  (m as unknown as Record<string, () => string>)[`fi5_${key.toLowerCase()}`]?.() ?? m.fi4_unknown();
const value = (r: CommerceRow, key: string) => String(r[key] ?? "");
function useCommerce() {
  const { user } = useAuth();
  const actor = useRef(user?.id);
  actor.current = user?.id;
  const keys = useRef(commerceRequestKey());
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const run = useCallback(async (action: CommerceAction, input: CommerceInput = {}) => {
    if (busyRef.current) return null;
    const identity = actor.current;
    if (!identity) return null;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const data = ["acquire", "refund", "dispute", "payout"].includes(action)
        ? { ...input, idempotency_key: keys.current(action, input) }
        : input;
      const response = await marketplaceCommerceFn({ data: { action, input: data } });
      if (actor.current !== identity) return null;
      if (!response.ok) {
        setError(response.error);
        return null;
      }
      return response.data;
    } catch {
      if (actor.current === identity) setError("UNAVAILABLE");
      return null;
    } finally {
      busyRef.current = false;
      if (actor.current === identity) setBusy(false);
    }
  }, []);
  return { run, busy, error };
}
function ErrorState({ code }: { code: string }) {
  if (!code) return null;
  const category = /ENTERPRISE|POLICY|VERSION_PIN|LICENSE_POLICY|SECURITY_NOT_VERIFIED/.test(code)
    ? "policy_block"
    : /ACCESS_DENIED|OWNER|APPROVER/.test(code)
      ? "access_denied"
      : /APPROVAL|REAPPROVAL/.test(code)
        ? "approval_needed"
        : /REFUND_CEILING/.test(code)
          ? "refund_limit"
          : /HELD|ELIGIB|AVAILABLE_EARNINGS/.test(code)
            ? "payout_ineligible"
            : code === "NOT_CONFIGURED"
              ? "not_configured"
              : "request_failed";
  return <p role="alert">{text(category)}</p>;
}
export function MarketplaceAcquisition({
  versionId,
  projectId,
}: {
  versionId: string;
  projectId: string;
}) {
  const { run, busy, error } = useCommerce();
  const [quote, setQuote] = useState<CommerceRow>({}),
    [result, setResult] = useState<CommerceRow>({});
  useEffect(() => {
    let cancelled = false;
    void run("quote", { version_id: versionId }).then((r) => {
      if (!cancelled) setQuote(commerceRow(r ?? null));
    });
    return () => {
      cancelled = true;
    };
  }, [run, versionId]);
  const snapshot = commerceRow(quote.snapshot);
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">{text("acquisition")}</h3>
      <ErrorState code={error} />
      <p>
        {quote.id
          ? `${commerceMoney(snapshot)} · ${text(value(snapshot, "billing_model"))}`
          : text("price_unknown")}
      </p>
      <p>{text("provider_notice")}</p>
      <button
        className={button}
        disabled={busy || !quote.id || !projectId}
        onClick={() =>
          void run("acquire", {
            version_id: versionId,
            price_id: quote.id,
            project_id: projectId,
          }).then((r) => {
            if (r) setResult(commerceRow(r));
          })
        }
      >
        {text("acquire")}
      </button>
      {!projectId ? <p>{text("choose_project")}</p> : null}
      {result.id ? (
        <p role="status">
          {text(value(result, "phase"))} · {text("orders_hint")}
        </p>
      ) : null}
    </section>
  );
}
function PriceFields() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label>
        {text("billing_model")}
        <select className={field} name="billing_model" defaultValue="FREE">
          {["FREE", "ONE_TIME", "SUBSCRIPTION"].map((x) => (
            <option key={x} value={x}>
              {text(x)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {text("amount_minor")}
        <input
          className={field}
          name="amount"
          type="number"
          min="0"
          step="1"
          defaultValue="0"
          required
        />
      </label>
      <label>
        {text("currency")}
        <select className={field} name="currency" defaultValue="USD">
          <option value="USD">USD</option>
          <option value="IRR">IRR</option>
          <option value="IRT">IRT · {text("toman")}</option>
        </select>
      </label>
    </div>
  );
}
function formPrice(form: FormData) {
  return {
    amount: Number(form.get("amount")),
    currency: String(form.get("currency")),
    billing_model: String(form.get("billing_model")),
    tax_status: "UNKNOWN",
    effective_from: new Date().toISOString(),
  };
}
export function MarketplaceCommercePanel() {
  const { user } = useAuth();
  // Parent keys this private component by authenticated user; no cross-account cache.
  const { run, busy, error } = useCommerce();
  const projects = useProjectsHome();
  const [open, setOpen] = useState(false),
    [loaded, setLoaded] = useState(false),
    [dashboard, setDashboard] = useState<CommerceRow>({}),
    [order, setOrder] = useState<CommerceRow>({}),
    [localError, setLocalError] = useState("");
  const refresh = useCallback(async () => {
    const r = await run("dashboard");
    if (r) {
      setDashboard(commerceRow(r));
      setLoaded(true);
    }
  }, [run]);
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);
  async function act(action: CommerceAction, input: CommerceInput = {}) {
    const r = await run(action, input);
    if (r) {
      await refresh();
      return commerceRow(r);
    }
    return null;
  }
  if (!user) return null;
  const publisher = commerceRow(dashboard.publisher),
    analytics = commerceRow(dashboard.analytics);
  return (
    <details
      className="space-y-4 rounded-xl border p-4"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer font-semibold focus-visible:ring-2">
        {text("commerce")}
      </summary>
      {open && !loaded ? (
        <div role="status">
          <p>{text("loading")}</p>
          <ErrorState code={error} />
          <button className={button} disabled={busy} onClick={() => void refresh()}>
            {text("refresh")}
          </button>
        </div>
      ) : null}
      {open && loaded ? (
        <div className="space-y-5">
          <p>{text("provider_notice")}</p>
          <ErrorState code={error || localError} />
          <button className={button} disabled={busy} onClick={() => void refresh()}>
            {text("refresh")}
          </button>
          <section className="space-y-3">
            <h3 className="font-semibold">{text("orders")}</h3>
            {!commerceRows(dashboard.orders).length ? <p>{text("empty")}</p> : null}
            <ul className="space-y-2">
              {commerceRows(dashboard.orders).map((row) => (
                <li className="rounded-lg border p-3" key={value(row, "id")}>
                  <p>
                    {commerceMoney(commerceRow(row.price))} · {text(value(row, "phase"))}
                  </p>
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() =>
                      void run("order", { id: row.id }).then((r) => {
                        if (r) setOrder(commerceRow(r));
                      })
                    }
                  >
                    {text("inspect")}
                  </button>
                  {row.phase === "WAITING_APPROVAL" ? (
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() => void act("resume", { id: row.id })}
                    >
                      {text("resume")}
                    </button>
                  ) : null}
                  {row.phase === "PROVIDER_PENDING" ? (
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        void run("checkout", { id: row.id }).then((r) => {
                          if (r)
                            setOrder({ ...row, provider_status: commerceRow(r).provider_status });
                        })
                      }
                    >
                      {text("start_checkout")}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {order.id ? (
              <article className="space-y-3 rounded-xl border p-3">
                <h4>
                  {text("transaction")} · <bdi>{value(order, "id")}</bdi>
                </h4>
                <p>
                  {text(value(order, "phase"))} · {text(value(order, "provider_status"))}
                </p>
                <p>
                  {text("entitlement")}: {text(value(commerceRow(order.entitlement), "status"))}
                </p>
                <details>
                  <summary className="focus-visible:ring-2">{text("license_snapshot")}</summary>
                  <dl>
                    {Object.entries(commerceRow(order.license)).map(([k, v]) => (
                      <div key={k}>
                        <dt>{text("license_" + k.toLowerCase())}</dt>
                        <dd>{typeof v === "boolean" ? text(v ? "yes" : "no") : String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
                {["SETTLED", "PARTIALLY_REFUNDED"].includes(value(order, "phase")) &&
                commerceRow(order.price).billing_model !== "FREE" ? (
                  <form
                    className="space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const action = String(fd.get("kind")) as "refund" | "dispute";
                      void act(action, {
                        id: order.id,
                        amount: Number(fd.get("amount")),
                        currency: commerceRow(order.price).currency,
                        reason: String(fd.get("reason")),
                        evidence: String(fd.get("evidence") || "")
                          .split("\n")
                          .filter(Boolean),
                      });
                    }}
                  >
                    <label>
                      {text("request_type")}
                      <select className={field} name="kind">
                        <option value="refund">{text("refund")}</option>
                        <option value="dispute">{text("dispute")}</option>
                      </select>
                    </label>
                    <label>
                      {text("amount_minor")}
                      <input
                        className={field}
                        name="amount"
                        type="number"
                        min="1"
                        max={Number(commerceRow(order.price).amount)}
                        step="1"
                        required
                      />
                    </label>
                    <label>
                      {text("reason")}
                      <textarea
                        className={field}
                        name="reason"
                        minLength={2}
                        maxLength={1000}
                        required
                      />
                    </label>
                    <label>
                      {text("evidence_refs")}
                      <textarea className={field} name="evidence" maxLength={2000} />
                    </label>
                    <button className={button} disabled={busy}>
                      {text("request")}
                    </button>
                  </form>
                ) : null}
              </article>
            ) : null}
          </section>
          <section className="space-y-3">
            <h3 className="font-semibold">{text("approvals")}</h3>
            {!commerceRows(dashboard.approvals).length ? <p>{text("empty")}</p> : null}
            {commerceRows(dashboard.approvals).map((row) => (
              <article className="rounded-lg border p-3" key={value(row, "id")}>
                <p>
                  {text(value(commerceRow(row.runtime_record), "action"))} ·{" "}
                  {text(value(row, "status"))}
                </p>
                <p>
                  <bdi>{value(commerceRow(row.runtime_record), "entityId")}</bdi>
                </p>
                {row.status === "pending"
                  ? ["approved", "denied"].map((decision) => (
                      <button
                        className={button}
                        disabled={busy}
                        key={decision}
                        onClick={() => void act("approve", { id: row.id, decision })}
                      >
                        {text(decision === "approved" ? "approve" : "reject")}
                      </button>
                    ))
                  : null}
              </article>
            ))}
          </section>
          <section className="space-y-3">
            <h3 className="font-semibold">{text("refunds_disputes")}</h3>
            {!commerceRows(dashboard.adjustments).length ? <p>{text("empty")}</p> : null}
            {commerceRows(dashboard.adjustments).map((row) => (
              <article className="space-y-2 rounded-lg border p-3" key={value(row, "id")}>
                <p>
                  {text(value(row, "kind"))} · {text(value(row, "state"))} · {commerceMoney(row)}
                </p>
                <p>{value(row, "reason")}</p>
                {row.kind === "REFUND" &&
                ["REQUESTED", "UNDER_REVIEW", "APPROVED"].includes(value(row, "state")) ? (
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => void act("refund_submit", { id: row.id })}
                  >
                    {text("resume")}
                  </button>
                ) : null}
                {row.kind === "DISPUTE" ? (
                  <form
                    className="space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      void act("dispute_decide", {
                        id: row.id,
                        state: String(fd.get("state")),
                        reason: String(fd.get("reason")),
                        evidence: String(fd.get("evidence") || "")
                          .split("\n")
                          .filter(Boolean),
                      });
                    }}
                  >
                    <label>
                      {text("state")}
                      <select className={field} name="state">
                        {[
                          "EVIDENCE_REQUIRED",
                          "UNDER_REVIEW",
                          "RESOLVED_BUYER",
                          "RESOLVED_CREATOR",
                          "CLOSED",
                        ].map((s) => (
                          <option value={s} key={s}>
                            {text(s)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {text("reason")}
                      <input className={field} name="reason" required maxLength={1000} />
                    </label>
                    <label>
                      {text("evidence_refs")}
                      <textarea
                        className={field}
                        name="evidence"
                        defaultValue={Array.isArray(row.evidence) ? row.evidence.join("\n") : ""}
                      />
                    </label>
                    <button className={button} disabled={busy}>
                      {text("submit_decision")}
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </section>
          <details className="space-y-3">
            <summary className="font-semibold focus-visible:ring-2">{text("publisher")}</summary>
            <p>
              {text(value(publisher, "state") || "DRAFT")} ·{" "}
              {text(value(publisher, "identity_state") || "NOT_VERIFIED")}
            </p>
            <p>
              {text("payout_eligibility")}:{" "}
              {text(publisher.payout_eligible ? "ready" : "eligibility_required")}
            </p>
            {["DRAFT", "ACTIVE", "DEPRECATED"].map((state) => (
              <button
                className={button}
                key={state}
                disabled={busy}
                onClick={() => void act("publisher", { state })}
              >
                {text(state)}
              </button>
            ))}
            <form
              className="space-y-3 rounded-lg border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const file = fd.get("package") as File;
                setLocalError("");
                if (!file || file.size > 80000) {
                  setLocalError("INVALID_INPUT");
                  return;
                }
                void file
                  .text()
                  .then((content) =>
                    act("draft", { entry: JSON.parse(content) as JsonValue, price: formPrice(fd) }),
                  )
                  .catch(() => setLocalError("INVALID_INPUT"));
              }}
            >
              <h4>{text("new_draft")}</h4>
              <label>
                {text("package_file")}
                <input
                  className={field}
                  type="file"
                  name="package"
                  accept="application/json,.json"
                  required
                />
              </label>
              <PriceFields />
              <p>{text("minor_unit_hint")}</p>
              <button className={button} disabled={busy}>
                {text("save_draft")}
              </button>
            </form>
            {commerceRows(dashboard.drafts).map((row) => {
              const entry = commerceRow(row.entry),
                manifest = commerceRow(entry.manifest);
              return (
                <article className="space-y-2 rounded-lg border p-3" key={value(row, "id")}>
                  <h4>
                    {value(manifest, "title")} · {value(manifest, "version")}
                  </h4>
                  <p>
                    {text(value(row, "stage"))}
                    {row.lifecycle ? ` · ${text(value(row, "lifecycle"))}` : ""}
                  </p>
                  {row.stage !== "PUBLISHED" ? (
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        void act(row.stage === "READY" ? "publish" : "validate", { id: row.id })
                      }
                    >
                      {text(row.stage === "READY" ? "publish" : "validate")}
                    </button>
                  ) : (
                    <>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void act("price", {
                            version_id: row.id,
                            price: formPrice(new FormData(e.currentTarget)),
                          });
                        }}
                      >
                        <PriceFields />
                        <button className={button} disabled={busy}>
                          {text("update_price")}
                        </button>
                      </form>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          void act("lifecycle", {
                            version_id: row.id,
                            state: String(fd.get("state")),
                            scope: String(fd.get("scope")),
                          });
                        }}
                      >
                        <label>
                          {text("lifecycle")}
                          <select name="state" className={field}>
                            {["DEPRECATED", "WITHDRAWN", "SECURITY_BLOCKED"].map((s) => (
                              <option key={s} value={s}>
                                {text(s)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          {text("scope")}
                          <select name="scope" className={field}>
                            <option value="version">{text("version")}</option>
                            <option value="package">{text("package")}</option>
                          </select>
                        </label>
                        <button className={button} disabled={busy}>
                          {text("update_lifecycle")}
                        </button>
                      </form>
                    </>
                  )}
                </article>
              );
            })}
          </details>
          <details className="space-y-3">
            <summary className="font-semibold focus-visible:ring-2">
              {text("earnings_payouts")}
            </summary>
            <p>
              {text("paid_settlements")}: {Number(analytics.paid_settlements ?? 0)} ·{" "}
              {text("free_acquisitions")}: {Number(analytics.free_acquisitions ?? 0)}
            </p>
            {!commerceRows(dashboard.earnings).length ? <p>{text("empty")}</p> : null}
            <ul>
              {commerceRows(dashboard.earnings).map((row) => (
                <li key={value(row, "id")}>
                  {text(value(row, "kind"))} · {text(value(row, "state"))} · {text("gross")}:{" "}
                  {commerceMoney({ ...row, amount: row.gross })} · {text("platform_fee")}:{" "}
                  {row.platform_fee === null
                    ? m.fi4_unknown()
                    : commerceMoney({ ...row, amount: row.platform_fee })}{" "}
                  · {text("net")}:{" "}
                  {row.creator_net === null
                    ? m.fi4_unknown()
                    : commerceMoney({ ...row, amount: row.creator_net })}
                </li>
              ))}
            </ul>
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                void act("payout", {
                  project_id: String(fd.get("project")),
                  currency: String(fd.get("currency")),
                });
              }}
            >
              <label>
                {text("project")}
                <select className={field} name="project" required>
                  <option value="">{text("choose_project")}</option>
                  {projects.data?.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {text("currency")}
                <select className={field} name="currency">
                  {["USD", "IRR", "IRT"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <button className={button} disabled={busy}>
                {text("request_payout")}
              </button>
            </form>
            {commerceRows(dashboard.payouts).map((row) => (
              <article key={value(row, "id")}>
                <p>
                  {commerceMoney(row)} · {text(value(row, "state"))}
                </p>
                {row.state === "DRAFT" ? (
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => void act("payout_submit", { id: row.id })}
                  >
                    {text("resume")}
                  </button>
                ) : null}
              </article>
            ))}
          </details>
          <details className="space-y-3">
            <summary className="font-semibold focus-visible:ring-2">
              {text("enterprise_policy")}
            </summary>
            <p>{text("policy_notice")}</p>
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const file = fd.get("policy") as File;
                setLocalError("");
                if (!file || file.size > 10000) {
                  setLocalError("INVALID_INPUT");
                  return;
                }
                void file
                  .text()
                  .then((content) =>
                    act("policy", {
                      project_id: String(fd.get("project")),
                      policy: JSON.parse(content) as JsonValue,
                    }),
                  )
                  .catch(() => setLocalError("INVALID_INPUT"));
              }}
            >
              <label>
                {text("project")}
                <select className={field} name="project" required>
                  <option value="">{text("choose_project")}</option>
                  {projects.data?.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {text("policy_file")}
                <input
                  className={field}
                  type="file"
                  name="policy"
                  accept="application/json,.json"
                  required
                />
              </label>
              <button className={button} disabled={busy}>
                {text("save_policy")}
              </button>
            </form>
          </details>
        </div>
      ) : null}
    </details>
  );
}
