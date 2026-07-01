import { createFileRoute } from "@tanstack/react-router";
import { CREATORS } from "@/lib/prompts";
import { Header } from "@/components/xeomx/Header";
import { CreatorCard } from "@/components/xeomx/CreatorCard";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/creators")({
  head: () => ({
    meta: [
      { title: "Creators — XeomX" },
      { name: "description", content: "Founder & elite prompt engineers earning from copies, saves, and remixes." },
    ],
  }),
  component: CreatorsPage,
});

function CreatorsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <section className="mx-auto max-w-[1400px] px-4 py-12 sm:px-8">
        <p className="text-[11px] uppercase tracking-[0.28em] text-magenta/80">{m.creators_eyebrow()}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-6xl">
          {m.creators_title_1()} <span className="text-gradient-magenta italic">{m.creators_title_2()}</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          {m.creators_subtitle()}
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CREATORS.map((c) => (
            <div key={c.handle} className="w-full"><CreatorCard c={c} /></div>
          ))}
        </div>

        <div className="mt-16 rounded-3xl border border-border bg-surface/40 p-8 sm:p-12">
          <p className="text-[11px] uppercase tracking-[0.28em] text-gold/80">{m.creators_earnings_eyebrow()}</p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-4xl">
            {m.creators_earnings_formula()}
          </h2>
          <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
            {m.creators_earnings_desc()}
          </p>
        </div>
      </section>
    </div>
  );
}