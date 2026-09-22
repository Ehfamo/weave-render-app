import { MarketplaceWorkspace } from "@/components/xeomx/marketplace/MarketplaceWorkspace";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "@/components/xeomx/Header";
import { useAuth } from "@/hooks/use-auth";
import type { CoreExecutionResponse } from "@/lib/core-execution/contracts";
import { executeGoalFn } from "@/lib/core-execution/functions";
import {
  consumePendingGoal,
  createPendingGoal,
  type PendingGoal,
} from "@/lib/core-execution/handoff";
import { m } from "@/paraglide/messages.js";

const active = new Map<string, Promise<CoreExecutionResponse>>();
function executeOnce(
  pending: PendingGoal,
  actorId: string,
  projectId?: string,
  conversationId?: string,
) {
  const key = `${actorId}:${projectId ?? "session"}:${pending.idempotencyKey}`;
  const existing = active.get(key);
  if (existing) return existing;
  const request = executeGoalFn({
    data: {
      goal: pending.goal,
      ...(projectId ? { projectId, ...(conversationId ? { conversationId } : {}) } : {}),
      idempotencyKey: pending.idempotencyKey,
      quality: pending.quality,
      locale: document.documentElement.lang || "en",
    },
  }).finally(() => active.delete(key));
  active.set(key, request);
  return request;
}

export function XeomxAiWorkspace({
  embedded = false,
  projectId,
  conversationId,
  onPersisted,
}: {
  embedded?: boolean;
  projectId?: string;
  conversationId?: string;
  onPersisted?: (id: string) => Promise<void>;
} = {}) {
  const [marketplace, setMarketplace] = useState(false);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [goal, setGoal] = useState("");
  const [response, setResponse] = useState<CoreExecutionResponse | null>(null);
  const [phase, setPhase] = useState<"IDLE" | "PREPARING" | "RUNNING">("IDLE");
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const lastPending = useRef<PendingGoal | null>(null);
  const currentActor = useRef(user?.id);
  currentActor.current = user?.id;
  useEffect(() => {
    setResponse(null);
    setGoal("");
  }, [user?.id]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (pending: PendingGoal) => {
      if (!user || inFlight.current) return;
      const actorId = user.id;
      inFlight.current = true;
      lastPending.current = pending;
      setGoal(pending.goal);
      setPhase("PREPARING");
      setResponse(null);
      try {
        const result = await executeOnce(pending, actorId, projectId, conversationId);
        if (mounted.current && currentActor.current === actorId) {
          setResponse(result);
          if (result.data.conversationId) await onPersisted?.(result.data.conversationId);
        }
      } catch {
        if (mounted.current && currentActor.current === actorId)
          setResponse({
            ok: false,
            data: {
              executionId: pending.idempotencyKey,
              state: "FAILED",
              goal: pending.goal,
              errorCode: "REQUEST_FAILED",
              quality: { confidence: "NOT_INDEPENDENTLY_VERIFIED", findings: [], repairCount: 0 },
              nextAction: "RETRY",
            },
          });
      } finally {
        inFlight.current = false;
        if (mounted.current && currentActor.current === actorId) setPhase("IDLE");
      }
    },
    [projectId, conversationId, onPersisted, user],
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", search: { next: "/xeomx-ai" }, replace: true });
      return;
    }
    const pending = consumePendingGoal(window.localStorage, Date.now(), user.id, { projectId });
    if (pending) void run(pending);
  }, [loading, navigate, run, user, projectId]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = goal.trim();
    if (value.length >= 2) void run(createPendingGoal(value, undefined));
  }

  const Title = embedded ? "h2" : "h1";
  const result = response?.data;
  const busy = loading || phase !== "IDLE";
  return (
    <div
      className={
        embedded ? "bg-background text-foreground" : "min-h-screen bg-background text-foreground"
      }
      dir="auto"
    >
      {embedded ? null : <Header />}
      <div
        className={
          embedded ? "space-y-4" : "mx-auto w-full max-w-4xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12"
        }
      >
        <header>
          <p className="text-sm font-medium text-primary">XEOMX AI</p>
          <Title className="mt-1 text-3xl font-semibold tracking-tight">
            {embedded ? m.p8_continue() : m.fi1_workspace_title()}
          </Title>
          <p className="mt-2 text-muted-foreground">{m.fi1_workspace_subtitle()}</p>
        </header>

        <form onSubmit={submit} className="mt-6 rounded-2xl border bg-card p-3 shadow-sm">
          <label htmlFor="xeomx-goal" className="sr-only">
            {m.p8_goal_title()}
          </label>
          <textarea
            id="xeomx-goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            rows={3}
            disabled={busy}
            placeholder={m.p8_goal_placeholder()}
            className="min-h-24 w-full resize-none bg-transparent p-3 text-base outline-none disabled:opacity-60"
          />
          <div className="flex justify-end border-t pt-3">
            <button
              type="submit"
              disabled={busy || goal.trim().length < 2}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
            >
              <Send className="size-4 rtl:rotate-180" /> {m.p8_start()}
            </button>
          </div>
        </form>

        {busy ? (
          <section aria-live="polite" aria-busy="true" className="mt-6 rounded-2xl border p-5">
            <div className="flex items-center gap-3">
              <LoaderCircle className="size-5 animate-spin text-primary" />
              <div>
                <h2 className="font-semibold">
                  {phase === "PREPARING" ? m.fi1_preparing() : m.fi1_running()}
                </h2>
                <p className="text-sm text-muted-foreground">{m.fi1_coordinating()}</p>
              </div>
            </div>
          </section>
        ) : null}

        {result ? (
          <section aria-live="polite" className="mt-6 space-y-4">
            <div
              className={`rounded-2xl border p-5 ${response?.ok ? "border-emerald-500/35" : "border-destructive/35"}`}
            >
              <div className="flex items-start gap-3">
                {response?.ok ? (
                  <CheckCircle2 className="mt-0.5 size-5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-5 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {m.fi1_status()}
                  </p>
                  <h2 className="mt-1 font-semibold">
                    {response?.ok ? m.fi1_completed() : m.fi1_not_completed()}
                  </h2>
                  {!response?.ok ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {failureMessage(result.errorCode)}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {!response?.ok &&
            [
              "PROVIDER_NOT_CONFIGURED",
              "CAPABILITY_NOT_YET_INTEGRATED",
              "NO_CAPABLE_AGENT",
              "MISSING_CAPABILITY",
            ].includes(result.errorCode ?? "") ? (
              <section>
                <button
                  type="button"
                  className="min-h-11 rounded-xl border px-4 focus-visible:ring-2"
                  onClick={() => setMarketplace(!marketplace)}
                >
                  {marketplace ? m.fi4_return_task() : m.fi4_find_capability()}
                </button>
                {marketplace ? (
                  <MarketplaceWorkspace
                    embedded
                    initialGoal={result.goal}
                    reference={result.conversationId}
                    kind="conversation"
                  />
                ) : null}
              </section>
            ) : null}
            {result.output ? (
              <article className="rounded-2xl border bg-card p-5">
                <h2 className="text-sm font-semibold">{m.fi1_result()}</h2>
                <p className="mt-3 whitespace-pre-wrap leading-7">{result.output}</p>
              </article>
            ) : null}

            <div className="rounded-2xl border p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                <h2 className="font-semibold">{m.fi1_quality_status()}</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {qualityMessage(result.quality.confidence)}
              </p>
              {result.quality.findings.some((finding) => finding.status === "NOT_EVALUATED") ? (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                  {m.fi1_not_evaluated()}
                </p>
              ) : null}
            </div>

            {result.sources?.length ? (
              <div className="rounded-2xl border p-5">
                <h2 className="font-semibold">{m.fi1_sources()}</h2>
                <ul className="mt-2 list-inside list-disc text-sm">
                  {result.sources.map((source) => (
                    <li key={source.id}>{source.title}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.trace ? (
              <details className="rounded-2xl border p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {m.fi1_safe_details()} <ChevronDown className="size-4" />
                </summary>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">{m.fi1_capabilities()}</dt>
                    <dd>{result.trace.capabilityIds.join(", ")}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{m.fi1_quality_status()}</dt>
                    <dd>{result.quality.confidence}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{m.fi1_repairs()}</dt>
                    <dd>{result.quality.repairCount}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{m.fi1_context_sources()}</dt>
                    <dd>{result.trace.contextReferenceIds.length}</dd>
                  </div>
                </dl>
              </details>
            ) : null}

            <button
              type="button"
              onClick={() => {
                if (response?.ok) setGoal("");
                else
                  void run(
                    [
                      "REQUEST_FAILED",
                      "PROJECT_EXECUTION_UNAVAILABLE",
                      "EXECUTION_IN_PROGRESS",
                    ].includes(result.errorCode ?? "") && lastPending.current
                      ? lastPending.current
                      : createPendingGoal(result.goal, undefined),
                  );
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="size-4" /> {response?.ok ? m.fi1_new_goal() : m.common_retry()}
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function failureMessage(code?: string) {
  if (code === "PROVIDER_NOT_CONFIGURED") return m.fi1_provider_not_configured();
  if (code === "APPROVAL_REQUIRED") return m.fi1_approval_required();
  if (code === "BUDGET_EXCEEDED") return m.fi1_budget_stopped();
  if (code === "CAPABILITY_NOT_YET_INTEGRATED") return m.fi1_capability_later();
  if (code === "MISSING_CRITICAL_CONTEXT") return m.fi1_missing_context();
  if (code === "CANCELLED") return m.fi1_cancelled();
  return m.fi1_safe_failure();
}

function qualityMessage(confidence: string) {
  if (confidence === "VERIFIED") return m.fi1_verified();
  if (confidence === "PARTIALLY_VERIFIED") return m.fi1_partially_verified();
  if (confidence === "NEEDS_USER_REVIEW") return m.fi1_needs_review();
  return m.fi1_not_independently_verified();
}
