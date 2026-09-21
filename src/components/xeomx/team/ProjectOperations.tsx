import { useState } from "react";
import { m } from "@/paraglide/messages.js";
import { automationControlFn, teamRoleFn } from "@/lib/capability-runtime/functions";
import {
  useCapabilityProject,
  ProjectChooser,
  JobArtifacts,
  runtimeButton,
} from "@/components/xeomx/runtime/CapabilityPanel";
type Tab = "automations" | "tasks" | "team" | "activity";
export function ProjectOperations() {
  const runtime = useCapabilityProject();
  const [tab, setTab] = useState<Tab>("automations");
  const [creating, setCreating] = useState(false);
  const tabs: [Tab, string][] = [
    ["automations", m.p4_automations()],
    ["tasks", m.p4_tasks()],
    ["team", m.p4_team()],
    ["activity", m.p4_activity()],
  ];
  const canEdit = runtime.data?.role === "owner" || runtime.data?.role === "editor";
  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6" dir="auto">
      <header className="mx-auto max-w-6xl space-y-4">
        <h1 className="text-xl font-semibold">{m.p4_title()}</h1>
        <ProjectChooser runtime={runtime} />
      </header>
      <div className="mx-auto mt-4 grid max-w-6xl gap-5 md:grid-cols-[13rem_1fr]">
        <nav className="flex gap-2 overflow-x-auto md:flex-col" aria-label={m.p4_title()}>
          {tabs.map(([id, label]) => (
            <button
              key={id}
              className={runtimeButton}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <section className="min-w-0">
          <h2 className="mb-4 text-lg font-semibold">{tabs.find((x) => x[0] === tab)?.[1]}</h2>
          {runtime.failed || runtime.q.isError ? <p role="alert">{m.fi3_unavailable()}</p> : null}
          {tab === "automations" ? (
            <div className="space-y-4">
              <button
                className={runtimeButton}
                disabled={!canEdit}
                aria-pressed={creating}
                onClick={() => setCreating((v) => !v)}
              >
                {m.p4_new_workflow()}
              </button>
              {creating ? (
                <form
                  className="space-y-3 rounded-lg border p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    void runtime.act(() =>
                      automationControlFn({
                        data: {
                          projectId: runtime.projectId,
                          action: "create",
                          name: String(form.get("name")),
                          goal: String(form.get("goal")),
                          approval: form.get("approval") === "on",
                        },
                      }),
                    );
                  }}
                >
                  <label className="block">
                    {m.fi2_name()}
                    <input
                      name="name"
                      required
                      maxLength={120}
                      className="ms-2 min-h-11 rounded border bg-background px-2"
                    />
                  </label>
                  <label className="block">
                    {m.fi2_goal()}
                    <textarea
                      name="goal"
                      required
                      maxLength={4000}
                      className="mt-2 block w-full rounded border bg-background p-2"
                    />
                  </label>
                  <label className="flex min-h-11 items-center gap-2">
                    <input type="checkbox" name="approval" />
                    {m.p7_approval()}
                  </label>
                  <button className={runtimeButton} disabled={runtime.busy}>
                    {m.p4_create()}
                  </button>
                </form>
              ) : null}
              {runtime.data?.workflows.length ? (
                runtime.data.workflows.map((w) => (
                  <article key={w.id} className="rounded-lg border p-4">
                    <h3>{w.name}</h3>
                    <p>
                      {w.runtimeState === "waiting_approval"
                        ? m.p4_waiting()
                        : w.runtimeState === "failed"
                          ? m.fi3_failed()
                          : w.status === "draft"
                            ? m.fi3_draft()
                            : w.status === "enabled"
                              ? m.p4_enabled()
                              : m.fi3_paused()}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className={runtimeButton}
                        disabled={runtime.busy || !canEdit}
                        aria-pressed={w.status === "enabled"}
                        onClick={() =>
                          void runtime.act(() =>
                            automationControlFn({
                              data: {
                                projectId: runtime.projectId,
                                id: w.id,
                                action: w.status === "enabled" ? "pause" : "enable",
                              },
                            }),
                          )
                        }
                      >
                        {w.status === "enabled" ? m.fi3_pause() : m.p4_enabled()}
                      </button>
                      <button
                        className={runtimeButton}
                        disabled={runtime.busy || !canEdit || w.status !== "enabled"}
                        onClick={() =>
                          void runtime.act(() =>
                            automationControlFn({
                              data: { projectId: runtime.projectId, id: w.id, action: "run" },
                            }),
                          )
                        }
                      >
                        {m.p4_run()}
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p>{m.fi2_empty_activity()}</p>
              )}
              <p className="text-sm">{m.fi3_schedule_hint()}</p>
              <JobArtifacts runtime={runtime} />
            </div>
          ) : tab === "team" ? (
            <ul className="space-y-3">
              {runtime.data?.team.map((member) => (
                <li key={member.user_id} className="rounded border p-3">
                  <span>{member.user_id}</span>
                  <label className="ms-3">
                    {m.fi3_role()}
                    <select
                      className="ms-2 min-h-11 rounded border bg-background px-2"
                      value={member.role}
                      disabled={
                        runtime.busy || runtime.data?.role !== "owner" || member.role === "owner"
                      }
                      onChange={(e) =>
                        void runtime.act(() =>
                          teamRoleFn({
                            data: {
                              projectId: runtime.projectId,
                              userId: member.user_id,
                              role: e.target.value as "editor" | "viewer",
                            },
                          }),
                        )
                      }
                    >
                      <option value="owner">{m.fi3_owner()}</option>
                      <option value="editor">{m.fi3_editor()}</option>
                      <option value="viewer">{m.fi3_viewer()}</option>
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          ) : tab === "activity" ? (
            <div className="space-y-4">
              <JobArtifacts runtime={runtime} />
              <ol>
                {runtime.data?.activity.map((a) => (
                  <li key={a.id} className="rounded border p-3">
                    <span>{a.summary}</span>
                    <time className="ms-3">{a.createdAt}</time>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <JobArtifacts runtime={runtime} />
          )}
        </section>
      </div>
    </main>
  );
}
