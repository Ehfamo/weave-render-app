import { Activity, AlertTriangle, CheckCircle2, Clock3, Coins, HeartPulse } from "lucide-react";
import { m } from "@/paraglide/messages.js";

const cards = [
  [HeartPulse, "99.2%", () => m.p7_success_rate()],
  [Clock3, "842 ms", () => m.p7_latency()],
  [Coins, "—", () => m.p7_cost()],
  [CheckCircle2, "PASS", () => m.p7_quality_gate()],
] as const;
export function ProductionOperations() {
  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6" dir="auto">
      <header className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <p className="text-sm text-muted-foreground">{m.p7_internal()}</p>
          <h1 className="text-xl font-semibold">{m.p7_title()}</h1>
        </div>
        <button
          aria-label={m.p7_refresh()}
          className="min-h-11 rounded-md border px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {m.p7_refresh()}
        </button>
      </header>
      <section
        aria-label={m.p7_overview()}
        className="mx-auto mt-5 grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {cards.map(([Icon, value, label]) => (
          <article key={label()} className="min-w-0 rounded-lg border p-4">
            <Icon aria-hidden="true" className="mb-3 size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{label()}</p>
            <p className="mt-1 text-2xl font-semibold" dir="ltr">
              {value}
            </p>
          </article>
        ))}
      </section>
      <section
        aria-label={m.p7_provider_health()}
        className="mx-auto mt-5 grid max-w-6xl gap-5 lg:grid-cols-[1fr_20rem]"
      >
        <div className="min-w-0 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">{m.p7_recent_runs()}</caption>
            <thead>
              <tr className="border-b">
                <th className="p-3 text-start">{m.p7_run()}</th>
                <th className="p-3 text-start">{m.p7_status()}</th>
                <th className="p-3 text-start">{m.p7_latency()}</th>
                <th className="p-3 text-start">{m.p7_cost()}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-3">task_•••4821</td>
                <td className="p-3">
                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-700">
                    {m.p7_healthy()}
                  </span>
                </td>
                <td className="p-3" dir="ltr">
                  842 ms
                </td>
                <td className="p-3">{m.p7_unavailable()}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <aside className="rounded-lg border p-4">
          <h2 className="font-semibold">{m.p7_release()}</h2>
          <p className="mt-2 flex items-center gap-2 text-sm">
            <Activity className="size-4" />
            {m.p7_source_pass()}
          </p>
          <p className="mt-2 flex items-start gap-2 text-sm text-amber-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {m.p7_rendered_deferred()}
          </p>
        </aside>
      </section>
    </main>
  );
}
