import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/xeomx/Header";
import { XeomxAiWorkspace } from "@/components/xeomx/ai/XeomxAiWorkspace";
import { useProjectContext } from "@/components/xeomx/os/ProjectContextProvider";
import { useAuth } from "@/hooks/use-auth";
import { editDurableProjectFn, projectWorkspaceFn } from "@/lib/projects/functions";
import { m } from "@/paraglide/messages.js";
import { ProjectRuntimeOutputs } from "@/components/xeomx/runtime/ProjectRuntimeOutputs";
import { getLocale } from "@/paraglide/runtime.js";

export function ProjectWorkspace({
  projectId,
  initialConversationId,
}: {
  projectId: string;
  initialConversationId?: string;
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const { bindProject, clearProject } = useProjectContext();
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const q = useQuery({
    queryKey: ["fi2-project", user?.id, projectId, initialConversationId],
    enabled: !!user,
    gcTime: 0,
    retry: false,
    queryFn: async () => {
      const r = await projectWorkspaceFn({
        data: { projectId, conversationId: initialConversationId },
      });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
  });
  const data = user && !q.isError ? q.data : undefined;
  useEffect(() => {
    if (data && user) bindProject(data.project.id, user.id);
    return () => clearProject(projectId);
  }, [data, user, bindProject, clearProject, projectId]);
  async function refresh() {
    await Promise.all([q.refetch(), client.invalidateQueries({ queryKey: ["fi2-projects"] })]);
  }
  async function edit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFailed(false);
    const form = new FormData(event.currentTarget);
    try {
      const r = await editDurableProjectFn({
        data: {
          projectId,
          name: String(form.get("name")),
          goal: String(form.get("goal")) || undefined,
        },
      });
      if (!r.ok) throw new Error();
      await refresh();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div
      className="min-h-screen bg-background text-foreground"
      dir={getLocale() === "fa" || getLocale() === "ar" ? "rtl" : "ltr"}
    >
      <Header />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
        {!data ? (
          <section>
            <h1 className="text-2xl font-semibold">{m.p8_project()}</h1>
            <p role={q.isError ? "alert" : "status"}>
              {q.isError ? m.fi2_error() : m.common_loading()}
            </p>
            {q.isError ? (
              <button onClick={() => void q.refetch()} className="min-h-11 underline">
                {m.common_retry()}
              </button>
            ) : null}
          </section>
        ) : (
          <>
            <header>
              <h1 className="text-3xl font-semibold">{data.project.name}</h1>
              <p className="mt-3">{data.brain.goal?.text ?? m.fi2_no_goal()}</p>
              <Link
                to="/memory"
                search={{ projectId }}
                className="inline-block min-h-11 py-3 text-primary underline"
              >
                {m.fi2_memory()}
              </Link>
            </header>
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer focus-visible:ring-2">
                {m.fi2_edit_project()}
              </summary>
              <form onSubmit={edit} className="mt-4 space-y-3" key={data.project.updatedAt}>
                <label className="block">
                  {m.fi2_name()}
                  <input
                    name="name"
                    required
                    maxLength={120}
                    defaultValue={data.project.name}
                    className="mt-1 min-h-11 w-full rounded-lg border bg-background p-2"
                  />
                </label>
                <label className="block">
                  {m.fi2_goal()}
                  <textarea
                    name="goal"
                    maxLength={1500}
                    defaultValue={data.brain.goal?.text ?? ""}
                    className="mt-1 w-full rounded-lg border bg-background p-2"
                  />
                </label>
                <button
                  disabled={saving}
                  className="min-h-11 rounded-lg border px-4 focus-visible:ring-2"
                >
                  {m.fi2_save()}
                </button>
                {failed ? <p role="alert">{m.fi2_error()}</p> : null}
              </form>
            </details>
            <nav className="flex flex-wrap gap-4" aria-label={m.fi3_capabilities()}>
              <Link to="/creative-workspace" search={{ projectId }} className="min-h-11 underline">
                {m.creative_title()}
              </Link>
              <Link to="/business-agents" search={{ projectId }} className="min-h-11 underline">
                {m.p5_title()}
              </Link>
              <Link to="/project-operations" search={{ projectId }} className="min-h-11 underline">
                {m.p4_title()}
              </Link>
            </nav>
            <ProjectRuntimeOutputs projectId={projectId} />
            <XeomxAiWorkspace
              key={`${user?.id}:${projectId}`}
              embedded
              projectId={projectId}
              conversationId={conversationId ?? data.activity[0]?.id}
              onPersisted={async (id) => {
                setConversationId(id);
                await refresh();
              }}
            />
            {data.messages
              .filter(
                (row) =>
                  row.role === "assistant" &&
                  row.conversationId === (conversationId ?? data.activity[0]?.id),
              )
              .slice(-1)
              .map((row) => (
                <article key={row.id} className="rounded-xl border p-5">
                  <h2 className="font-semibold">{m.fi2_saved_result()}</h2>
                  <p className="mt-3 whitespace-pre-wrap">{row.content}</p>
                </article>
              ))}
            <section className="rounded-xl border p-5">
              <h2 className="text-xl font-semibold">{m.fi2_activity()}</h2>
              {!data.activity.length ? (
                <p className="mt-3">{m.fi2_empty_activity()}</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {data.activity.map((a) => (
                    <li key={a.id}>
                      <button
                        onClick={() => {
                          setConversationId(a.id);
                          document.getElementById("xeomx-goal")?.focus();
                        }}
                        className="flex min-h-11 w-full items-start justify-between gap-4 rounded-lg border p-3 text-start focus-visible:ring-2"
                      >
                        <span>
                          {a.title}
                          <small className="block text-muted-foreground">
                            {a.state === "COMPLETED"
                              ? m.fi1_completed()
                              : a.state === "RUNNING"
                                ? m.fi1_running()
                                : a.state
                                  ? m.fi1_not_completed()
                                  : m.fi2_conversation()}
                          </small>
                        </span>
                        <time dateTime={a.updatedAt} className="text-xs">
                          {new Date(a.updatedAt).toLocaleString(getLocale())}
                        </time>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <details className="rounded-xl border p-5">
              <summary className="cursor-pointer focus-visible:ring-2">{m.fi2_brain()}</summary>
              <p className="mt-3">{data.brain.summary.text}</p>
              <h2 className="mt-4 font-semibold">{m.fi2_open_items()}</h2>
              <ul className="list-inside list-disc">
                {data.brain.openItems.map((e) => (
                  <li key={e.id}>{e.text}</li>
                ))}
              </ul>
              <ul className="mt-3 list-inside list-disc">
                {data.brain.entries
                  .filter((e) => e.kind !== "goal" && e.kind !== "openItem")
                  .map((e) => (
                    <li key={e.id}>{e.text}</li>
                  ))}
              </ul>
            </details>
            {data.assets.length ? (
              <section className="rounded-xl border p-5">
                <h2 className="text-xl font-semibold">{m.fi2_files()}</h2>
                <ul>
                  {data.assets.map((a) => (
                    <li key={a.id}>
                      {a.mimeType} ·{" "}
                      <time dateTime={a.createdAt}>
                        {new Date(a.createdAt).toLocaleDateString(getLocale())}
                      </time>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
