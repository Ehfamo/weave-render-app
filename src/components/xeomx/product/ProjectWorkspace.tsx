import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, RefreshCw, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelGenerationJobFn,
  createProjectFn,
  listProjectsFn,
  loadProjectFn,
  submitTextGenerationFn,
  updateProjectFn,
} from "@/lib/backend/vertical-slice.functions";
import {
  REQUEST_7_LIVE_TEXT_PROVIDER,
  type ProjectSnapshot,
  type ProjectSummary,
} from "@/lib/backend/vertical-slice";

const POLL_MS = 2500;

type Props = {
  initialProjectId?: string;
  onProjectChange?: (projectId: string) => void;
};

function newIdempotencyKey() {
  return `browser:${Date.now()}:${crypto.randomUUID()}`;
}

function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}

function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
    >
      {error instanceof Error ? error.message : "Request failed."}
    </div>
  );
}

export function ProjectWorkspace({ initialProjectId, onProjectChange }: Props) {
  const queryClient = useQueryClient();
  const listProjects = useServerFn(listProjectsFn);
  const createProject = useServerFn(createProjectFn);
  const updateProject = useServerFn(updateProjectFn);
  const loadProject = useServerFn(loadProjectFn);
  const submitGeneration = useServerFn(submitTextGenerationFn);
  const cancelGeneration = useServerFn(cancelGenerationJobFn);

  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId ?? "");
  const [pendingJobId, setPendingJobId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");

  const projectsQuery = useQuery({
    queryKey: ["request7", "projects"],
    queryFn: async () => unwrap(await listProjects()),
  });

  useEffect(() => {
    if (selectedProjectId || !projectsQuery.data?.length) return;
    const id = projectsQuery.data[0].id;
    setSelectedProjectId(id);
    onProjectChange?.(id);
  }, [onProjectChange, projectsQuery.data, selectedProjectId]);

  const snapshotQuery = useQuery({
    queryKey: ["request7", "project", selectedProjectId],
    enabled: Boolean(selectedProjectId),
    queryFn: async () => unwrap(await loadProject({ data: { projectId: selectedProjectId } })),
    refetchInterval: (query) => {
      const snapshot = query.state.data as ProjectSnapshot | undefined;
      const submittedJob = pendingJobId
        ? snapshot?.jobs.find((job) => job.id === pendingJobId)
        : undefined;

      if (
        pendingJobId &&
        (!submittedJob || submittedJob.status === "queued" || submittedJob.status === "running")
      ) {
        return POLL_MS;
      }

      return snapshot?.jobs.some((job) => job.status === "queued" || job.status === "running")
        ? POLL_MS
        : false;
    },
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    const project = snapshotQuery.data?.project;
    if (!project) return;
    setName(project.name);
    setDescription(project.description ?? "");
  }, [snapshotQuery.data?.project]);

  useEffect(() => {
    if (!pendingJobId) return;
    const submittedJob = snapshotQuery.data?.jobs.find((job) => job.id === pendingJobId);
    if (!submittedJob) return;
    if (submittedJob.status !== "queued" && submittedJob.status !== "running") {
      setPendingJobId("");
    }
  }, [pendingJobId, snapshotQuery.data?.jobs]);

  const selectProject = (id: string) => {
    setPendingJobId("");
    setSelectedProjectId(id);
    onProjectChange?.(id);
  };

  const createMutation = useMutation({
    mutationFn: async () =>
      unwrap(
        await createProject({
          data: {
            name: name.trim() || "Untitled project",
            description: description.trim() || undefined,
          },
        }),
      ),
    onSuccess: async (project: ProjectSummary) => {
      await queryClient.invalidateQueries({ queryKey: ["request7", "projects"] });
      selectProject(project.id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjectId) throw new Error("Select a project first.");
      return unwrap(
        await updateProject({
          data: {
            projectId: selectedProjectId,
            name: name.trim(),
            description: description.trim() || undefined,
            routingMode: "manual",
            defaultModel: REQUEST_7_LIVE_TEXT_PROVIDER.model,
          },
        }),
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["request7", "projects"] }),
        queryClient.invalidateQueries({ queryKey: ["request7", "project", selectedProjectId] }),
      ]);
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjectId) throw new Error("Select a project first.");
      const text = prompt.trim();
      if (!text) throw new Error("Enter a prompt.");
      return unwrap(
        await submitGeneration({
          data: {
            projectId: selectedProjectId,
            prompt: text,
            routingMode: "manual",
            requestedProvider: REQUEST_7_LIVE_TEXT_PROVIDER.id,
            requestedModel: REQUEST_7_LIVE_TEXT_PROVIDER.model,
            idempotencyKey: newIdempotencyKey(),
          },
        }),
      );
    },
    onSuccess: async (result) => {
      setPendingJobId(result.jobId);
      setPrompt("");
      await queryClient.invalidateQueries({ queryKey: ["request7", "project", selectedProjectId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (jobId: string) => unwrap(await cancelGeneration({ data: { jobId } })),
    onSuccess: async () => {
      setPendingJobId("");
      await queryClient.invalidateQueries({ queryKey: ["request7", "project", selectedProjectId] });
    },
  });

  const latestJob = snapshotQuery.data?.jobs[0];
  const messages = snapshotQuery.data?.messages ?? [];
  const running =
    Boolean(pendingJobId) || latestJob?.status === "queued" || latestJob?.status === "running";
  const assistantMessages = useMemo(
    () => messages.filter((message) => message.role === "assistant"),
    [messages],
  );

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate();
  };
  const onSave = (event: FormEvent) => {
    event.preventDefault();
    updateMutation.mutate();
  };
  const onGenerate = (event: FormEvent) => {
    event.preventDefault();
    generateMutation.mutate();
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">XEOMX Project Workspace</h1>
          <span className="rounded-full border border-border bg-surface px-2 py-1 text-xs text-muted-foreground">
            LIVE STAGING
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Authenticated project → durable Cloudflare Workers AI job → persisted output, asset,
          usage, credit and audit.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4 rounded-xl border border-border bg-surface/30 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium">Projects</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void projectsQuery.refetch()}
              aria-label="Refresh projects"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
          <ErrorBox error={projectsQuery.error} />
          <div className="space-y-2">
            {projectsQuery.data?.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => selectProject(project.id)}
                className={`w-full rounded-lg border p-3 text-start text-sm transition ${selectedProjectId === project.id ? "border-foreground bg-background" : "border-border hover:bg-background/60"}`}
              >
                <span className="block truncate font-medium">{project.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{project.status}</span>
              </button>
            ))}
          </div>

          <form onSubmit={onCreate} className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Create project
            </p>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Project name"
              maxLength={120}
            />
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description"
              rows={3}
              maxLength={4000}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={createMutation.isPending || !name.trim()}
            >
              {createMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}{" "}
              Create
            </Button>
            <ErrorBox error={createMutation.error} />
          </form>
        </aside>

        <div className="space-y-6">
          {!selectedProjectId ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Create or select a project.
            </div>
          ) : (
            <>
              <section className="rounded-xl border border-border bg-surface/20 p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-medium">Project settings</h2>
                    <p className="text-xs text-muted-foreground">
                      Provider: Cloudflare · Model: {REQUEST_7_LIVE_TEXT_PROVIDER.model}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void snapshotQuery.refetch()}
                    disabled={snapshotQuery.isFetching}
                  >
                    <RefreshCw
                      className={`size-4 ${snapshotQuery.isFetching ? "animate-spin" : ""}`}
                    />{" "}
                    Reload
                  </Button>
                </div>
                <form onSubmit={onSave} className="grid gap-3 sm:grid-cols-2">
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Project name"
                    maxLength={120}
                  />
                  <Input value={REQUEST_7_LIVE_TEXT_PROVIDER.id} readOnly aria-label="Provider" />
                  <Textarea
                    className="sm:col-span-2"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Description"
                    rows={3}
                    maxLength={4000}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={updateMutation.isPending || !name.trim()}
                  >
                    Save project
                  </Button>
                </form>
                <ErrorBox error={snapshotQuery.error ?? updateMutation.error} />
              </section>

              <section className="rounded-xl border border-border bg-surface/20 p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-medium">Generate</h2>
                    <p className="text-xs text-muted-foreground">
                      Jobs are queued and processed by the independent cron worker.
                    </p>
                  </div>
                  {latestJob ? (
                    <span className="rounded-full border border-border px-2 py-1 text-xs">
                      {latestJob.status}
                    </span>
                  ) : null}
                </div>
                <form onSubmit={onGenerate} className="space-y-3">
                  <Textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Ask XEOMX…"
                    rows={4}
                    maxLength={50000}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="submit"
                      disabled={!prompt.trim() || generateMutation.isPending || running}
                    >
                      {generateMutation.isPending || running ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}{" "}
                      Send
                    </Button>
                    {running && latestJob ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => cancelMutation.mutate(latestJob.id)}
                        disabled={cancelMutation.isPending}
                      >
                        <Square className="size-4" /> Cancel
                      </Button>
                    ) : null}
                  </div>
                </form>
                <ErrorBox error={generateMutation.error ?? cancelMutation.error} />
              </section>

              <section className="rounded-xl border border-border bg-surface/20 p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-medium">Conversation</h2>
                  <div className="text-xs text-muted-foreground">
                    Credits: {snapshotQuery.data?.creditBalance ?? "—"}
                  </div>
                </div>
                <div className="space-y-3">
                  {messages.length ? (
                    messages.map((message) => (
                      <article
                        key={message.id}
                        className={`rounded-lg border p-3 ${message.role === "assistant" ? "border-foreground/20 bg-background" : "border-border"}`}
                      >
                        <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                          {message.role}
                          {message.provider ? ` · ${message.provider}` : ""}
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No messages yet.</p>
                  )}
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-4">
                <Metric label="Jobs" value={snapshotQuery.data?.jobs.length ?? 0} />
                <Metric label="Outputs" value={assistantMessages.length} />
                <Metric label="Assets" value={snapshotQuery.data?.assets.length ?? 0} />
                <Metric label="Audit" value={snapshotQuery.data?.auditEvents.length ?? 0} />
              </section>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface/20 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
