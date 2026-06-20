import { Link } from "@tanstack/react-router";
import { Search, Sparkles } from "lucide-react";

export function Header({ onSearch, query }: { onSearch?: (v: string) => void; query?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3 sm:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "var(--gradient-magenta)" }}>
            <Sparkles className="h-4 w-4 text-white" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            Xeom<span className="text-gradient-magenta">X</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {["Discover", "Viral", "Premium", "Drops"].map((l) => (
            <a
              key={l}
              href="#"
              className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground"
            >
              {l}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex flex-1 items-center gap-3 sm:flex-none">
          <label className="group relative flex w-full items-center sm:w-80">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <input
              value={query ?? ""}
              onChange={(e) => onSearch?.(e.target.value)}
              placeholder="Search prompts, styles, creators…"
              className="w-full rounded-full border border-border bg-surface/60 py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-magenta/50 focus:outline-none focus:ring-2 focus:ring-magenta/30"
            />
          </label>
          <button className="hidden rounded-full border border-border bg-surface/60 px-4 py-2 text-sm text-foreground transition hover:border-magenta/40 sm:inline-flex">
            Sign in
          </button>
          <button
            className="rounded-full px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            style={{ background: "var(--gradient-magenta)", boxShadow: "var(--shadow-glow)" }}
          >
            Go Pro
          </button>
        </div>
      </div>
    </header>
  );
}