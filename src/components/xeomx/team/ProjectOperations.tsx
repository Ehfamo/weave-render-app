import { useState } from "react";
import { Activity, CheckCircle2, Play, Plus, Settings2, Users, Workflow } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { WorkspaceRole } from "@/lib/collaboration/contracts";
type Tab = "automations" | "tasks" | "team" | "activity";
export function ProjectOperations({ role = "viewer" }: { role?: WorkspaceRole }) {
  const [tab, setTab] = useState<Tab>("automations"),
    [creating, setCreating] = useState(false),
    [enabled, setEnabled] = useState(true),
    [ran, setRan] = useState(false);
  const tabs: [Tab, typeof Workflow, string][] = [
    ["automations", Workflow, m.p4_automations()],
    ["tasks", CheckCircle2, m.p4_tasks()],
    ["team", Users, m.p4_team()],
    ["activity", Activity, m.p4_activity()],
  ];
  const canEdit = role === "owner" || role === "admin" || role === "editor";
  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6" dir="auto">
      <header className="mx-auto flex max-w-6xl items-center justify-between border-b pb-4">
        <h1 className="text-xl font-semibold">{m.p4_title()}</h1>
        <button
          disabled={!canEdit}
          onClick={() => setCreating((x) => !x)}
          className="flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm text-primary-foreground"
        >
          <Plus className="size-4" />
          {m.p4_new_workflow()}
        </button>
      </header>
      <div className="mx-auto mt-4 grid max-w-6xl gap-5 md:grid-cols-[13rem_1fr]">
        <nav aria-label={m.p4_title()} className="flex gap-2 overflow-x-auto md:flex-col">
          {tabs.map(([id, Icon, label]) => (
            <button
              disabled={!canEdit}
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm ${tab === id ? "bg-muted font-medium" : "hover:bg-muted/60"}`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>
        <section className="min-w-0">
          <h2 className="mb-4 text-lg font-semibold">{tabs.find((x) => x[0] === tab)?.[2]}</h2>
          {tab === "automations" ? (
            <div className="space-y-4">
              {creating ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setCreating(false);
                  }}
                  className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
                >
                  <label className="text-sm">
                    {m.p4_when()}
                    <select className="mt-1 min-h-11 w-full rounded-md border bg-background px-3">
                      <option>{m.p4_activity()}</option>
                      <option>{m.p4_run()}</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    {m.p4_do()}
                    <select className="mt-1 min-h-11 w-full rounded-md border bg-background px-3">
                      <option>{m.p4_tasks()}</option>
                      <option>{m.p4_run()}</option>
                    </select>
                  </label>
                  <details className="sm:col-span-2">
                    <summary className="cursor-pointer text-sm">
                      <Settings2 className="me-2 inline size-4" />
                      {m.p4_advanced()}
                    </summary>
                  </details>
                  <button className="min-h-11 rounded-md bg-primary px-4 text-sm text-primary-foreground sm:col-span-2">
                    {m.p4_create()}
                  </button>
                </form>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium">{m.p4_automations()}</p>
                  <p className="text-sm text-muted-foreground">
                    {ran ? m.p4_history() : m.p4_enabled()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEnabled((x) => !x)}
                    aria-pressed={enabled}
                    className="min-h-11 rounded-md border px-3 text-sm"
                  >
                    {m.p4_enabled()}
                  </button>
                  <button
                    disabled={!enabled || !canEdit}
                    onClick={() => setRan(true)}
                    className="flex min-h-11 items-center gap-2 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
                  >
                    <Play className="size-4" />
                    {m.p4_run()}
                  </button>
                </div>
              </div>
            </div>
          ) : tab === "tasks" ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[34rem] text-start text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-3 text-start">{m.p4_tasks()}</th>
                    <th className="p-3 text-start">{m.p4_assignee()}</th>
                    <th className="p-3 text-start">{m.p4_priority()}</th>
                    <th className="p-3 text-start">{m.p4_activity()}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3">{m.p4_tasks()}</td>
                    <td className="p-3">{m.p4_team()}</td>
                    <td className="p-3">{m.p4_priority()}</td>
                    <td className="p-3">{m.p4_waiting()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : tab === "team" ? (
            <div className="rounded-lg border p-4">
              <p className="font-medium">{m.p4_team()}</p>
              <p className="text-sm text-muted-foreground">{m.p4_enabled()}</p>
            </div>
          ) : (
            <ol className="space-y-3">
              <li className="rounded-lg border p-4 text-sm">
                {m.p4_waiting()} · {m.p4_automations()}
              </li>
              <li className="rounded-lg border p-4 text-sm">{m.p4_activity()}</li>
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
