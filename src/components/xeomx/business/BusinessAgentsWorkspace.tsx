import { useState } from "react";
import { BarChart3, Check, Headphones, Megaphone, Search, TrendingUp } from "lucide-react";
import { m } from "@/paraglide/messages.js";

const packs = [
  ["research", Search, () => m.p5_research(), 3],
  ["marketing", Megaphone, () => m.p5_marketing(), 5],
  ["sales", TrendingUp, () => m.p5_sales(), 5],
  ["support", Headphones, () => m.p5_support(), 3],
  ["data", BarChart3, () => m.p5_data(), 4],
] as const;
export function BusinessAgentsWorkspace() {
  const [goal, setGoal] = useState("");
  const [ran, setRan] = useState(false);
  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6" dir="auto">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-sm text-muted-foreground">XEOMX</p>
          <h1 className="text-2xl font-semibold">{m.p5_title()}</h1>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (goal.trim()) setRan(true);
          }}
          className="rounded-xl border bg-card p-4 shadow-sm"
        >
          <label htmlFor="business-goal" className="text-sm font-medium">
            {m.p5_goal()}
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="business-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-md border bg-background px-3"
            />
            <button
              disabled={!goal.trim()}
              className="min-h-11 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {m.p5_run()}
            </button>
          </div>
        </form>
        <section aria-labelledby="packs-title">
          <h2 id="packs-title" className="mb-3 text-lg font-semibold">
            {m.p5_enabled_packs()}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {packs.map(([id, Icon, label, count]) => (
              <article key={id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <Icon className="size-5" aria-hidden="true" />
                  <Check className="size-4 text-emerald-500" aria-label="enabled" />
                </div>
                <h3 className="mt-3 font-medium">{label()}</h3>
                <p className="text-sm text-muted-foreground">{count} capabilities</p>
              </article>
            ))}
          </div>
        </section>
        <section aria-labelledby="runs-title" className="rounded-xl border p-4">
          <h2 id="runs-title" className="font-semibold">
            {m.p5_recent_runs()}
          </h2>
          {ran ? (
            <div role="status" className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <p className="rounded-md bg-muted p-3">{goal}</p>
              <p className="rounded-md bg-muted p-3">{m.p5_sources()}: workspace</p>
              <p className="rounded-md bg-muted p-3">{m.p5_review()}: not required</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">—</p>
          )}
        </section>
      </div>
    </main>
  );
}
