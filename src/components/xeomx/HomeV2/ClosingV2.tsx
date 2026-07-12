import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function ClosingV2() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 100%, hsl(var(--magenta) / 0.22), transparent 70%)",
        }}
      />
      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 py-24 text-center">
        <h2 className="font-display text-3xl tracking-tight md:text-5xl">
          Ready when you are.
        </h2>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Sign in to unlock your dashboard, or keep exploring the public surface.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            to="/auth"
            search={{ next: undefined }}
            className="group inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
          >
            Sign in
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface/60 px-6 py-3 text-sm text-foreground/90 backdrop-blur transition hover:bg-surface"
          >
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}