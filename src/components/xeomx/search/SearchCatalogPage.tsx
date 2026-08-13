import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Filter, Search as SearchIcon, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/xeomx/Header";
import { PromptCard } from "@/components/xeomx/PromptCard";
import { CreatorCard } from "@/components/xeomx/CreatorCard";
import { CollectionCard } from "@/components/xeomx/CollectionCard";
import { searchCatalog } from "@/lib/search-catalog";

export const SEARCH_CATEGORIES = [
  "All",
  "Image",
  "Video",
  "Code",
  "Design",
  "Writing",
  "Marketing",
] as const;
export type SearchCatalogParams = { q?: string; category?: string };

export function SearchCatalogPage({ search }: { search: SearchCatalogParams }) {
  const navigate = useNavigate();
  const [input, setInput] = useState(search.q ?? "");
  const category = search.category ?? "All";

  useEffect(() => setInput(search.q ?? ""), [search.q]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (input === (search.q ?? "")) return;
      navigate({
        to: "/search",
        search: { q: input || undefined, category: category === "All" ? undefined : category },
        replace: true,
      });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const q = (search.q ?? "").trim();
  const enabled = q.length >= 2;
  const { data, isLoading, error } = useQuery({
    queryKey: ["search-catalog", q, category],
    enabled,
    queryFn: () => searchCatalog(q, category),
    staleTime: 30_000,
  });
  const prompts = data?.prompts ?? [];
  const creators = data?.creators ?? [];
  const collections = data?.collections ?? [];
  const total = prompts.length + creators.length + collections.length;

  function setCategory(next: string) {
    navigate({
      to: "/search",
      search: { q: q || undefined, category: next === "All" ? undefined : next },
      replace: true,
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <section
        className="mx-auto max-w-[1400px]"
        style={{ paddingInline: "var(--space-4)", paddingBlock: "var(--space-6)" }}
      >
        <h1 className="font-display text-3xl font-bold tracking-tight">Search</h1>
        <form
          className="relative mt-4 flex items-center"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            navigate({
              to: "/search",
              search: {
                q: input || undefined,
                category: category === "All" ? undefined : category,
              },
            });
          }}
        >
          <SearchIcon className="pointer-events-none absolute start-4 h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            data-testid="search-input"
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Search prompts, creators, collections, categories…"
            aria-label="Search XeomX catalog"
            className="w-full rounded-full border border-border bg-surface/60 py-3 pe-12 ps-10 text-sm outline-none focus:border-magenta/50 focus:ring-2 focus:ring-magenta/30"
          />
          {input ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setInput("");
                navigate({ to: "/search", search: {}, replace: true });
              }}
              className="absolute end-3 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </form>
        <div
          className="mt-4 flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label="Filter prompts by category"
        >
          <Filter className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          {SEARCH_CATEGORIES.map((item) => (
            <button
              key={item}
              role="tab"
              aria-selected={item === category}
              onClick={() => setCategory(item)}
              className={`min-h-8 rounded-full border px-3 py-1 text-xs transition ${item === category ? "border-magenta/60 bg-magenta/15 text-foreground" : "border-border bg-surface/40 text-muted-foreground hover:text-foreground"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="mt-8" data-testid="search-results">
          {!enabled ? (
            <p className="text-sm text-muted-foreground">Type at least 2 characters to search.</p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">Searching the live catalog…</p>
          ) : error ? (
            <p className="text-sm text-destructive" data-testid="search-error">
              Search failed. Try again in a moment.
            </p>
          ) : total === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/60 p-10 text-center">
              <h2 className="font-display text-2xl">No results for "{q}"</h2>
              <Link
                to="/explore"
                className="mt-4 inline-flex rounded-full border border-border px-4 py-2 text-sm"
              >
                Browse everything
              </Link>
            </div>
          ) : (
            <div className="space-y-10">
              {prompts.length ? (
                <section data-testid="search-prompts">
                  <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                    Prompts ({prompts.length})
                  </h2>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {prompts.map((prompt) => (
                      <PromptCard key={prompt.id} prompt={prompt} />
                    ))}
                  </div>
                </section>
              ) : null}
              {category === "All" && creators.length ? (
                <section data-testid="search-creators">
                  <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                    Creators ({creators.length})
                  </h2>
                  <div className="flex flex-wrap gap-4">
                    {creators.map((creator) => (
                      <CreatorCard key={creator.handle} c={creator} />
                    ))}
                  </div>
                </section>
              ) : null}
              {category === "All" && collections.length ? (
                <section data-testid="search-collections">
                  <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                    Collections ({collections.length})
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {collections.map((collection) => (
                      <CollectionCard key={collection.id} c={collection} />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
