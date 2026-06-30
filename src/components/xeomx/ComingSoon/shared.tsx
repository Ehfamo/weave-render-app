import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function BackToExplore() {
  return (
    <Link to="/explore" className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1.5 text-xs text-foreground backdrop-blur transition hover:border-amber-300/40">
      <ArrowLeft className="h-3.5 w-3.5" /> All sections
    </Link>
  );
}

export function NotifyForm({ label = "Notify Me" }: { label?: string }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const email = String(fd.get("email") ?? "");
        if (email) {
          (e.currentTarget as HTMLFormElement).reset();
          alert(`You're on the list. We'll reach out at ${email}.`);
        }
      }}
      className="flex flex-col gap-3 sm:flex-row"
    >
      <input
        name="email"
        type="email"
        required
        placeholder="you@domain.com"
        className="flex-1 rounded-full border border-white/10 bg-surface/60 px-5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-amber-300/40 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-full px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90"
        style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-glow)" }}
      >
        {label}
      </button>
    </form>
  );
}