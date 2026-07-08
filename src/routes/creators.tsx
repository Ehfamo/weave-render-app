import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { CREATORS } from "@/lib/prompts";
import { Header } from "@/components/xeomx/Header";
import { CreatorCard } from "@/components/xeomx/CreatorCard";
import { pageUrl } from "@/lib/seo";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/creators")({
  head: () => ({
    meta: [
      { title: "Creators — XeomX" },
      { name: "description", content: "Founder & elite prompt engineers earning from copies, saves, and remixes." },
      { property: "og:title", content: "Creators — XeomX" },
      { property: "og:description", content: "Founder & elite prompt engineers earning from copies, saves, and remixes." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: pageUrl("/creators") },
    ],
    links: [{ rel: "canonical", href: pageUrl("/creators") }],
  }),
  component: CreatorsPage,
});

function CreatorsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <section
        className="mx-auto max-w-[1400px]"
        style={{ paddingInline: "var(--space-4)", paddingBlock: "var(--space-6)" }}
      >
        <p
          className="uppercase tracking-[0.28em] text-magenta/80"
          style={{ fontSize: "var(--font-size-micro)" }}
        >
          {m.creators_eyebrow()}
        </p>
        <h1
          className="font-display font-bold tracking-tight"
          style={{ marginTop: "var(--space-2)", fontSize: "clamp(2rem, 5vw, var(--font-size-h1))" }}
        >
          {m.creators_title_1()} <span className="text-gradient-magenta italic">{m.creators_title_2()}</span>
        </h1>
        <p
          className="max-w-xl"
          style={{ marginTop: "var(--space-3)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}
        >
          {m.creators_subtitle()}
        </p>
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.04 } },
          }}
          className="grid sm:grid-cols-2 lg:grid-cols-3"
          style={{ marginTop: "var(--space-6)", gap: "var(--space-5)" }}
        >
          {CREATORS.map((c) => (
            <motion.div
              key={c.handle}
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
                },
              }}
              className="w-full [&>div]:w-full"
            >
              <CreatorCard c={c} />
            </motion.div>
          ))}
        </motion.div>

        <div
          className="surface-elevated rounded-3xl"
          style={{ marginTop: "var(--space-8)", padding: "var(--space-6)" }}
        >
          <p
            className="uppercase tracking-[0.28em] text-gold/80"
            style={{ fontSize: "var(--font-size-micro)" }}
          >
            {m.creators_earnings_eyebrow()}
          </p>
          <h2
            className="font-display font-semibold tracking-tight"
            style={{ marginTop: "var(--space-2)", fontSize: "clamp(1.5rem, 3vw, var(--font-size-h2))" }}
          >
            {m.creators_earnings_formula()}
          </h2>
          <p
            className="max-w-2xl"
            style={{ marginTop: "var(--space-4)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}
          >
            {m.creators_earnings_desc()}
          </p>
        </div>
      </section>
    </div>
  );
}