import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { projectsHomeFn } from "@/lib/projects/functions";
import {
  capabilityReadFn,
  capabilitySubmitFn,
  capabilityJobFn,
  capabilityDecisionFn,
} from "@/lib/capability-runtime/functions";
import { m } from "@/paraglide/messages.js";
export const runtimeButton =
  "min-h-11 rounded-md border px-3 focus-visible:ring-2 disabled:opacity-50";
export function jobState(state: string) {
  return state === "completed"
    ? m.fi1_completed()
    : state === "running"
      ? m.fi3_running()
      : state === "waiting_approval"
        ? m.p4_waiting()
        : state === "cancelled"
          ? m.fi3_cancelled()
          : state === "failed"
            ? m.fi3_failed()
            : m.fi3_queued();
}
export function useCapabilityProject(fixedProjectId?: string) {
  const { user } = useAuth();
  const search = useSearch({ strict: false }) as { projectId?: string };
  const [chosen, setChosen] = useState(search.projectId ?? "");
  const projectId = fixedProjectId ?? chosen;
  const cache = useQueryClient();
  const projects = useQuery({
    queryKey: ["fi2-projects", user?.id],
    enabled: !!user && !fixedProjectId,
    gcTime: 0,
    retry: false,
    queryFn: async () => {
      const r = await projectsHomeFn();
      if (!r.ok) throw Error();
      return r.data;
    },
  });
  const q = useQuery({
    queryKey: ["fi3-runtime", user?.id, projectId],
    enabled: !!user && !!projectId,
    gcTime: 0,
    retry: false,
    refetchInterval: 5000,
    queryFn: async () => {
      const r = await capabilityReadFn({ data: { projectId } });
      if (!r.ok) throw Error();
      return r.data;
    },
  });
  const [pending, setPending] = useState(0);
  const busy = pending > 0;
  const [failed, setFailed] = useState(false);
  async function act(work: () => Promise<{ ok: boolean }>, concurrent = false) {
    if (busy && !concurrent) return;
    setPending((n) => n + 1);
    setFailed(false);
    try {
      if (!(await work()).ok) throw Error();
      await Promise.all([
        q.refetch(),
        cache.invalidateQueries({ queryKey: ["fi2-projects"] }),
        cache.invalidateQueries({ queryKey: ["fi2-project"] }),
      ]);
    } catch {
      setFailed(true);
    } finally {
      setPending((n) => n - 1);
    }
  }
  const data = user && !q.isError ? q.data : undefined;
  return { user, projectId, setChosen, projects, q, data, busy, failed, act };
}
export function ProjectChooser({ runtime }: { runtime: ReturnType<typeof useCapabilityProject> }) {
  return (
    <label className="block max-w-lg">
      {m.p8_project()}
      <select
        aria-label={m.p8_project()}
        className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
        value={runtime.projectId}
        onChange={(e) => runtime.setChosen(e.target.value)}
      >
        <option value="">{m.fi3_choose_project()}</option>
        {runtime.projects.data?.projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {runtime.projects.isError ? <span role="alert">{m.fi2_error()}</span> : null}
      <Link to="/projects" className="inline-block min-h-11 py-2 underline">
        {m.p8_projects()}
      </Link>
    </label>
  );
}
export function JobArtifacts({ runtime }: { runtime: ReturnType<typeof useCapabilityProject> }) {
  const { data, projectId, act, busy } = runtime;
  return (
    <div className="space-y-4">
      {runtime.failed || runtime.q.isError ? <p role="alert">{m.fi3_unavailable()}</p> : null}
      {projectId && runtime.q.isLoading ? <p role="status">{m.common_loading()}</p> : null}
      <section aria-label={m.fi3_jobs()} className="rounded-lg border p-4">
        <h2 className="font-semibold">{m.fi3_jobs()}</h2>
        {!data?.jobs.length ? (
          <p>{m.fi2_empty_activity()}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.jobs.map((job) => (
              <li key={job.id} className="rounded-lg border p-3">
                <p>{job.title}</p>
                <p role="status">
                  {job.errorCode === "NOT_CONFIGURED" || job.errorCode === "PROVIDER_UNAVAILABLE"
                    ? m.fi1_provider_not_configured()
                    : jobState(job.state)}
                </p>
                {job.state === "failed" ? (
                  <Link
                    className={runtimeButton}
                    to="/marketplace"
                    search={{ reference: job.id, kind: "job" }}
                  >
                    {m.fi4_find_capability()}
                  </Link>
                ) : null}
                <time className="text-xs">{job.updatedAt}</time>
                <div className="mt-2 flex flex-wrap gap-2">
                  {job.state === "queued" ? (
                    <button
                      disabled={busy}
                      className={runtimeButton}
                      onClick={() =>
                        void act(() => capabilityJobFn({ data: { id: job.id, action: "run" } }))
                      }
                    >
                      {m.p4_run()}
                    </button>
                  ) : null}
                  {["queued", "running", "waiting_approval"].includes(job.state) ? (
                    <button
                      className={runtimeButton}
                      onClick={() =>
                        void act(
                          () => capabilityJobFn({ data: { id: job.id, action: "cancel" } }),
                          true,
                        )
                      }
                    >
                      {m.fi3_cancel()}
                    </button>
                  ) : null}
                  {job.state === "running" && Date.now() - Date.parse(job.updatedAt) > 300000 ? (
                    <button
                      disabled={busy}
                      className={runtimeButton}
                      onClick={() =>
                        void act(() => capabilityJobFn({ data: { id: job.id, action: "recover" } }))
                      }
                    >
                      {m.fi3_recover()}
                    </button>
                  ) : null}
                  {job.state === "failed" &&
                  job.attempt < 3 &&
                  job.errorCode !== "ACTION_OUTCOME_UNKNOWN" ? (
                    <button
                      disabled={busy}
                      className={runtimeButton}
                      onClick={() =>
                        void act(() => capabilityJobFn({ data: { id: job.id, action: "retry" } }))
                      }
                    >
                      {m.common_retry()}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {data?.approvals.length ? (
        <section className="rounded-lg border p-4">
          <h2>{m.p7_approval()}</h2>
          {data.approvals.map((a) => (
            <article key={a.id} className="py-3">
              <p>
                {a.toolId} · {a.risk}
              </p>
              <div className="flex gap-2">
                {(["approved", "rejected"] as const).map((decision) => (
                  <button
                    key={decision}
                    className={runtimeButton}
                    disabled={busy || data.role !== "owner"}
                    onClick={() =>
                      void act(() =>
                        capabilityDecisionFn({ data: { id: a.jobId, approvalId: a.id, decision } }),
                      )
                    }
                  >
                    {decision === "approved" ? m.p7_approve() : m.p7_reject()}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : null}
      <section className="rounded-lg border p-4">
        <h2 className="font-semibold">{m.fi3_artifacts()}</h2>
        {!data?.artifacts.length ? (
          <p>{m.fi3_empty_artifacts()}</p>
        ) : (
          <ul className="space-y-3">
            {data.artifacts.map((a) => (
              <li key={a.id}>
                <h3>{a.title}</h3>
                {a.url ? (
                  <a
                    className="inline-block min-h-11 py-2 underline"
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {m.fi3_open_output()}
                  </a>
                ) : (
                  <p className="whitespace-pre-wrap">{a.text}</p>
                )}
                <small className="block">{a.updatedAt}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
export function CapabilityPanel({ kind }: { kind: "creative" | "business" }) {
  const runtime = useCapabilityProject();
  const [goal, setGoal] = useState("");
  const [selection, setSelection] = useState(kind === "creative" ? "image" : "web-research");
  const selections =
    kind === "creative"
      ? [
          ["image", m.creative_image()],
          ["video", m.creative_video()],
          ["audio", m.creative_audio()],
          ["voice", m.fi3_voice()],
        ]
      : [
          ["web-research", m.p5_research()],
          ["marketing", m.p5_marketing()],
          ["sales-research", m.p5_sales()],
          ["customer-support", m.p5_support()],
          ["data-analyst", m.p5_data()],
        ];
  return (
    <div className="space-y-5">
      <ProjectChooser runtime={runtime} />
      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <section className="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runtime.act(async () => {
                const r = await capabilitySubmitFn({
                  data: {
                    id: crypto.randomUUID(),
                    projectId: runtime.projectId,
                    goal,
                    kind,
                    selection,
                  },
                });
                return r;
              });
            }}
            className="space-y-3 rounded-lg border p-4"
          >
            <label className="block">
              {kind === "creative" ? m.creative_create() : m.p5_goal()}
              <textarea
                aria-label={m.p5_goal()}
                required
                maxLength={20000}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="mt-2 min-h-28 w-full rounded-md border bg-background p-3"
              />
            </label>
            <label className="block">
              {m.p5_capabilities()}
              <select
                value={selection}
                onChange={(e) => setSelection(e.target.value)}
                className="ms-3 min-h-11 rounded-md border bg-background px-3"
              >
                {selections.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={runtimeButton}
              disabled={
                runtime.busy || !runtime.data || runtime.data.role === "viewer" || !goal.trim()
              }
            >
              {kind === "creative" ? m.creative_generate() : m.p5_run()}
            </button>
            <p className="text-sm text-muted-foreground">{m.fi3_queued_hint()}</p>
          </form>
          <JobArtifacts runtime={runtime} />
        </section>
        <aside className="rounded-lg border p-4">
          <h2>{kind === "creative" ? m.creative_assets() : m.p5_enabled_packs()}</h2>
          <p className="mt-2 text-sm">{m.fi3_runtime_hint()}</p>
        </aside>
      </div>
    </div>
  );
}
