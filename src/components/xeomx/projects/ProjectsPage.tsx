import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/xeomx/Header";
import { useProjectsHome } from "@/hooks/use-projects";
import { createDurableProjectFn } from "@/lib/projects/functions";
import {
  consumePendingGoal,
  createPendingGoal,
  savePendingGoal,
  type PendingGoal,
} from "@/lib/core-execution/handoff";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

export function ProjectsPage() {
  const query = useProjectsHome();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [pending, setPending] = useState<PendingGoal | null>(null);
  const [busy, setBusy] = useState(false);
  const [incompleteProject, setIncompleteProject] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!query.user) return;
    const intent = consumePendingGoal(window.localStorage, Date.now(), query.user.id, {
      createProject: true,
    });
    if (intent) {
      setPending(intent);
      setName(intent.goal.slice(0, 120));
      setGoal(intent.goal.slice(0, 1500));
    }
  }, [query.user]);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !query.user) return;
    setBusy(true);
    setFailed(false);
    try {
      const r = await createDurableProjectFn({ data: { name, goal: goal || undefined } });
      if (!r.ok) throw new Error();
      if (!r.data.goalSaved) {
        setIncompleteProject(r.data.project.id);
        await query.refetch();
        return;
      }
      if (pending)
        savePendingGoal(window.localStorage, {
          ...createPendingGoal(pending.goal, pending.quality),
          projectId: r.data.project.id,
          ownerId: query.user.id,
        });
      await navigate({ to: "/projects/$projectId", params: { projectId: r.data.project.id } });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="min-h-screen bg-background text-foreground"
      dir={getLocale() === "fa" || getLocale() === "ar" ? "rtl" : "ltr"}
    >
      <Header />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        <h1 className="text-3xl font-semibold">{m.p8_projects()}</h1>
        <form onSubmit={create} className="space-y-4 rounded-2xl border p-5">
          <h2 className="text-xl font-semibold">{m.p8_new_project()}</h2>
          <label className="block">
            {m.fi2_name()}
            <input
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border bg-background p-3 focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="block">
            {m.fi2_goal_optional()}
            <textarea
              maxLength={1500}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background p-3 focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button
            disabled={busy || !!incompleteProject || !name.trim()}
            className="min-h-11 rounded-lg bg-primary px-5 text-primary-foreground focus-visible:ring-2 disabled:opacity-40"
          >
            {busy ? m.common_loading() : m.p8_new_project()}
          </button>
          {incompleteProject ? (
            <p role="alert">
              {m.fi2_goal_not_saved()}{" "}
              <Link
                to="/projects/$projectId"
                params={{ projectId: incompleteProject }}
                className="underline"
              >
                {m.p8_project()}
              </Link>
            </p>
          ) : null}
          {failed ? <p role="alert">{m.fi2_error()}</p> : null}
        </form>
        {query.loading ? (
          <p role="status">{m.common_loading()}</p>
        ) : query.isError ? (
          <p role="alert">
            {m.fi2_error()}{" "}
            <button onClick={() => void query.refetch()} className="min-h-11 underline">
              {m.common_retry()}
            </button>
          </p>
        ) : null}
        {query.data?.projects.length === 0 ? <p>{m.fi2_empty_projects()}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {query.data?.projects.map((p) => (
            <Link
              key={p.id}
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              className="space-y-2 rounded-2xl border p-5 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <h2 className="text-xl font-semibold">{p.name}</h2>
              <p>{p.goal ?? m.fi2_no_goal()}</p>
              <p className="text-sm text-muted-foreground">
                {m.fi2_updated()}:{" "}
                <time dateTime={p.updatedAt}>
                  {new Date(p.updatedAt).toLocaleString(getLocale())}
                </time>
              </p>
              {p.activity[0] ? <p className="truncate text-sm">{p.activity[0].title}</p> : null}
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
