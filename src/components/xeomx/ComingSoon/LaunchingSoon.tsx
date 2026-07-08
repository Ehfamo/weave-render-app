import { Check } from "lucide-react";
import { type ExploreSection } from "@/lib/explore-sections";
import { getIcon } from "@/lib/icon-map";
import { BackToExplore, NotifyForm } from "./shared";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export function LaunchingSoon({ section }: { section: ExploreSection }) {
  const Icon = getIcon(section.icon);
  return (
    <div className="relative min-h-svh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0" style={{ background: "var(--gradient-spotlight)" }} />
      <div className="pointer-events-none absolute -left-40 top-20 h-80 w-80 rounded-full opacity-25 blur-3xl" style={{ background: "var(--gradient-gold)" }} />

      <div className="relative mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10 sm:px-8 sm:py-16">
        <BackToExplore />
        <div>
          <span className="grid h-20 w-20 place-items-center rounded-3xl ring-1 ring-amber-300/30" style={{ background: "var(--gradient-gold)" }}>
            <Icon className="h-9 w-9 text-black" />
          </span>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200">
            {m.launching_badge()}
          </div>
          <h1 className="mt-4 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            {section.name}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">{section.tagline}</p>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground/80">{section.description}</p>
        </div>

        {section.features && section.features.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {section.features.map((f) => (
              <li key={f} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-surface/40 p-4 backdrop-blur">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
                  <Check className="h-3.5 w-3.5 text-black" />
                </span>
                <span className="text-sm text-foreground">{f}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-3xl border border-amber-300/20 bg-surface/40 p-6 backdrop-blur">
          <h3 className="font-display text-xl font-bold">{m.launching_waitlist_title()}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{m.launching_waitlist_desc({ name: section.name })}</p>
          <div className="mt-4"><NotifyForm label={m.notify_waitlist_button()} sectionSlug={section.slug} /></div>
        </div>
      </div>
    </div>
  );
}