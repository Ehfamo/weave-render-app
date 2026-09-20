import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Header } from "@/components/xeomx/Header";
import { useAuth } from "@/hooks/use-auth";
import { memoryControlFn } from "@/lib/projects/functions";
import { MEMORY_TYPES, type MemoryRecord, type MemoryScope } from "@/lib/memory/contracts";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

export function MemoryControls({ scope }: { scope: MemoryScope }) {
  const client = useQueryClient();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const queryKey = ["fi2-memory", user?.id, scope];
  const q = useQuery({
    queryKey,
    enabled: !!user,
    retry: false,
    gcTime: 0,
    queryFn: async () => {
      const r = await memoryControlFn({ data: { action: "list", scope } });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
  });
  const data = user && !q.isError ? q.data : undefined;
  async function action(input: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const r = await memoryControlFn({ data: { ...input, scope } });
      if (!r.ok) throw new Error();
      setDeleting(null);
      client.setQueryData(queryKey, r.data);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  const labels = {
    UserMemory: m.fi2_type_user(),
    ProjectMemory: m.fi2_type_project(),
    ConversationMemory: m.fi2_type_conversation(),
    CharacterMemory: m.fi2_type_character(),
    VoiceMemory: m.fi2_type_voice(),
    BrandMemory: m.fi2_type_brand(),
    PreferenceMemory: m.fi2_type_preference(),
    InstructionMemory: m.fi2_type_instruction(),
  };
  return (
    <div
      className="min-h-screen bg-background text-foreground"
      dir={getLocale() === "fa" || getLocale() === "ar" ? "rtl" : "ltr"}
    >
      <Header />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <h1 className="text-3xl font-semibold">{m.fi2_memory()}</h1>
        <p>
          {scope.kind === "user"
            ? m.fi2_scope_user()
            : scope.kind === "project"
              ? m.fi2_scope_project()
              : m.fi2_scope_conversation()}
        </p>
        {scope.kind !== "user" ? (
          <Link
            to="/projects/$projectId"
            params={{ projectId: scope.projectId }}
            className="inline-block min-h-11 py-2 text-primary underline"
          >
            {m.p8_project()}
          </Link>
        ) : null}
        {!data ? (
          <p role={q.isError ? "alert" : "status"}>
            {q.isError ? m.fi2_error() : m.common_loading()}{" "}
            {q.isError ? (
              <button onClick={() => void q.refetch()} className="min-h-11 underline">
                {m.common_retry()}
              </button>
            ) : null}
          </p>
        ) : (
          <>
            <fieldset disabled={busy} className="space-y-3 rounded-xl border p-5">
              <legend className="px-2 font-semibold">{m.fi2_memory_settings()}</legend>
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  checked={data.settings.enabled}
                  onChange={(e) =>
                    void action({
                      action: "settings",
                      settings: { ...data.settings, enabled: e.target.checked },
                    })
                  }
                />
                {m.fi2_memory_enabled()}
              </label>
              <p className="text-sm text-muted-foreground">{m.fi2_memory_off_explained()}</p>
              <p className="font-semibold">{m.fi2_supported_types()}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {MEMORY_TYPES.map((type) => (
                  <label key={type} className="flex min-h-11 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!data.settings.disabledTypes.includes(type)}
                      onChange={(e) =>
                        void action({
                          action: "settings",
                          settings: {
                            ...data.settings,
                            disabledTypes: e.target.checked
                              ? data.settings.disabledTypes.filter((t) => t !== type)
                              : [...data.settings.disabledTypes, type],
                          },
                        })
                      }
                    />
                    {labels[type]}
                  </label>
                ))}
              </div>
            </fieldset>
            <section>
              <h2 className="text-xl font-semibold">{m.fi2_saved_memories()}</h2>
              {!data.memories.length ? <p className="mt-3">{m.fi2_empty_memories()}</p> : null}
              <div className="mt-4 space-y-4">
                {data.memories.map((record: MemoryRecord) => (
                  <article key={record.id} className="rounded-xl border p-5">
                    <h3 className="font-semibold">
                      {labels[record.type]} ·{" "}
                      {record.status === "active" ? m.fi2_active() : m.fi2_archived()}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {record.source.kind === "user"
                        ? m.fi2_source_user()
                        : record.source.kind === "conversation"
                          ? m.fi2_source_conversation()
                          : m.fi2_source_import()}{" "}
                      ·{" "}
                      <time dateTime={record.updatedAt}>
                        {new Date(record.updatedAt).toLocaleString(getLocale())}
                      </time>
                    </p>
                    <form
                      key={record.updatedAt + record.content}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void action({
                          action: "edit",
                          id: record.id,
                          patch: {
                            content: String(f.get("content")),
                            importance: Number(f.get("importance")),
                          },
                        });
                      }}
                      className="mt-4 space-y-3"
                    >
                      <label className="block">
                        {m.fi2_content()}
                        <textarea
                          name="content"
                          required
                          maxLength={8000}
                          defaultValue={record.content}
                          rows={3}
                          disabled={busy}
                          className="mt-1 w-full rounded-lg border bg-background p-3 focus-visible:ring-2"
                        />
                      </label>
                      <label className="block">
                        {m.fi2_importance()}
                        <input
                          type="number"
                          name="importance"
                          min={0}
                          max={1}
                          step="any"
                          required
                          defaultValue={record.importance}
                          disabled={busy}
                          className="ms-3 min-h-11 w-24 rounded-lg border bg-background px-2"
                        />
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <button
                          disabled={busy}
                          className="min-h-11 rounded-lg border px-4 focus-visible:ring-2"
                        >
                          {m.fi2_save()}
                        </button>
                        {record.status === "active" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void action({ action: "archive", id: record.id })}
                            className="min-h-11 rounded-lg border px-4 focus-visible:ring-2"
                          >
                            {m.fi2_archive()}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setDeleting(record.id)}
                          className="min-h-11 rounded-lg border px-4 text-destructive focus-visible:ring-2"
                        >
                          {m.fi2_delete()}
                        </button>
                      </div>
                    </form>
                    {deleting === record.id ? (
                      <div className="mt-4 rounded-lg border border-destructive p-3">
                        <p>{m.fi2_delete_confirm()}</p>
                        <button
                          disabled={busy}
                          onClick={() => void action({ action: "delete", id: record.id })}
                          className="min-h-11 px-3 text-destructive underline"
                        >
                          {m.fi2_delete()}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => setDeleting(null)}
                          className="min-h-11 px-3 underline"
                        >
                          {m.fi2_cancel()}
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
        {failed ? <p role="alert">{m.fi2_error()}</p> : null}
      </main>
    </div>
  );
}
