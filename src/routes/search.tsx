import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon, X, Filter, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/xeomx/Header";
import { PromptCard } from "@/components/xeomx/PromptCard";
import { fetchPromptsList } from "@/lib/marketplace";
import { PROMPTS } from "@/lib/prompts";
import type { Prompt } from "@/lib/prompts";
import { pageUrl } from "@/lib/seo";
import { FeatureStatusBadge } from "@/components/xeomx/status/FeatureStatusBadge";

const CATEGORIES = ["All", "Image", "Video", "Code", "Design", "Writing", "Marketing"] as const;

type SearchParams = { q?: string; category?: string };

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    q: typeof s.q === "string" ? s.q : undefined,
    category: typeof s.category === "string" ? s.category : undefined,
  }),
  component: SearchPage,
  head: ({ match }) => {
    const q = (match.search as SearchParams).q;
    const title = q ? `Search: ${q} — XeomX` : "Search — XeomX";
    return {
      meta: [
        { title },
        { name: "description", content: "Search prompts across the XeomX library." },
        { property: "og:title", content: title },
        { property: "og:description", content: "Search prompts across the XeomX library." },
        { property: "og:type", content: "website" },
        { property: "og:url", content: pageUrl("/search") },
        { name: "robots", content: "noindex" },
      ],
      links: [{ rel: "canonical", href: pageUrl("/search") }],
    };
  },
});

function localMatches(q: string, category: string | undefined): Prompt[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return PROMPTS.filter((p) => {
    if (category && category !== "All" && p.category !== category) return false;
    return (
      p.title.toLowerCase().includes(s) ||
      p.category.toLowerCase().includes(s) ||
      p.prompt.toLowerCase().includes(s)
    );
  }).slice(0, 12);
}

function SearchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [input, setInput] = useState(search.q ?? "");
  const category = search.category ?? "All";

  useEffect(() => {
    setInput(search.q ?? "");
  }, [search.q]);

  // Debounce URL updates as user types.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((input || "") === (search.q ?? "")) return;
      navigate({
        to: "/search",
        search: { q: input || undefined, category: category === "All" ? undefined : category },
        replace: true,
      });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const q = (search.q ?? "").trim();
  const enabled = q.length >= 2;

  const { data: dbResults = [], isLoading, error } = useQuery({
    queryKey: ["search", q, category],
    enabled,
    queryFn: () =>
      fetchPromptsList({
        search: q,
        category: category === "All" ? undefined : category,
        limit: 24,
      }),
    staleTime: 30_000,
  });

  const preview = useMemo(() => (enabled ? localMatches(q, category) : []), [q, category, enabled]);

  // Deduplicate DB vs preview by slug.
  const seen = new Set(dbResults.map((p) => p.id));
  const previewOnly = preview.filter((p) => !seen.has(p.id));

  function setCategory(next: string) {
    navigate({
      to: "/search",
      search: { q: q || undefined, category: next === "All" ? undefined : next },
      replace: true,
    });
  }

  function clearAll() {
    setInput("");
    navigate({ to: "/search", search: {}, replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <section
        className="mx-auto max-w-[1400px]"
        style={{ paddingInline: "var(--space-4)", paddingBlock: "var(--space-6)" }}
      >
        <h1
          className="font-display font-bold tracking-tight"
          style={{ fontSize: "clamp(1.75rem, 4vw, var(--font-size-h1))" }}
        >
          Search
        </h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate({
              to: "/search",
              search: { q: input || undefined, category: category === "All" ? undefined : category },
            });
          }}
          className="relative mt-4 flex items-center"
          role="search"
        >
          <SearchIcon className="pointer-events-none absolute start-4 h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search prompts, creators, categories…"
            aria-label="Search prompts"
            className="w-full rounded-full border border-border bg-surface/60 text-sm text-foreground placeholder:text-muted-foreground focus:border-magenta/50 focus:outline-none focus:ring-2 focus:ring-magenta/30"
            style={{ paddingInlineStart: "var(--space-8)", paddingInlineEnd: "var(--space-8)", paddingBlock: "var(--space-3)", minHeight: 44 }}
          />
          {input && (
            <button
              type="button"
              onClick={clearAll}
              aria-label="Clear search"
              className="absolute end-3 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <div
          className="mt-4 flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label="Filter by category"
        >
          <Filter className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          {CATEGORIES.map((c) => {
            const active = c === category;
            return (
              <button
                key={c}
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(c)}
                className={`min-h-8 rounded-full border px-3 py-1 text-xs transition ${
                  active
                    ? "border-magenta/60 bg-magenta/15 text-foreground"
                    : "border-border bg-surface/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>

        <div className="mt-8">
          {!enabled ? (
            <p className="text-sm text-muted-foreground">Type at least 2 characters to search.</p>
          ) : isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl border border-border/60 bg-surface/40" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">Search failed. Try again in a moment.</p>
          ) : dbResults.length === 0 && previewOnly.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/60 p-10 text-center">
              <h2 className="font-display text-2xl">No results for "{q}"</h2>
              <p className="mt-2 text-sm text-muted-foreground">Try a different phrase or clear filters.</p>
              <Link
                to="/explore"
                className="mt-4 inline-flex rounded-full border border-border px-4 py-2 text-sm"
              >
                Browse everything
              </Link>
            </div>
          ) : (
            <>
              {dbResults.length > 0 && (
                <div className="mb-8">
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-sm font-medium text-muted-foreground">
                      Live results ({dbResults.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {dbResults.map((p) => (
                      <PromptCard key={p.id} prompt={p} />
                    ))}
                  </div>
                </div>
              )}
              {previewOnly.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-sm font-medium text-muted-foreground">
                      From our curated catalog
                    </h2>
                    <FeatureStatusBadge status="preview" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {previewOnly.map((p) => (
                      <PromptCard key={p.id} prompt={p} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

// Kept for future filter expansion; suppresses unused-import lint.
void ChevronDown;