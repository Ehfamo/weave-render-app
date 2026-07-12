import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";

/**
 * Isolated hero for /home-v2. Does not import from other Home components.
 */
export function HeroV2() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, hsl(var(--magenta) / 0.25), transparent 70%), radial-gradient(40% 40% at 80% 60%, hsl(var(--primary) / 0.18), transparent 70%)",
        }}
      />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 py-24 text-center md:py-32">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface/60 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-muted-foreground backdrop-blur"
        >
          <Sparkles className="h-3 w-3 text-magenta" />
          A New Way to Land on XEOMX
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="font-display text-4xl leading-[1.05] tracking-tight md:text-6xl lg:text-7xl"
        >
          Build with intent.
          <br />
          <span className="text-gradient-magenta">Ship at the speed of thought.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-6 max-w-2xl text-balance text-base text-muted-foreground md:text-lg"
        >
          A fresh entry point into the XEOMX ecosystem — curated prompts, creators, and
          the tools that turn ideas into production-ready workflows.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Link
            to="/explore"
            className="group inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
          >
            Explore the ecosystem
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface/60 px-6 py-3 text-sm text-foreground/90 backdrop-blur transition hover:bg-surface"
          >
            View original homepage
          </Link>
        </motion.div>
      </div>
    </section>
  );
}