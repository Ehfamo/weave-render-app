import { createFileRoute } from "@tanstack/react-router";
import {
  SearchCatalogPage,
  type SearchCatalogParams,
} from "@/components/xeomx/search/SearchCatalogPage";
import { pageUrl } from "@/lib/seo";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchCatalogParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
    category: typeof search.category === "string" ? search.category : undefined,
  }),
  component: SearchRoutePage,
  head: ({ match }) => {
    const q = (match.search as SearchCatalogParams).q;
    const title = q ? `Search: ${q} — XeomX` : "Search — XeomX";
    const description = "Search public prompts, creators, collections, and categories on XeomX.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: pageUrl("/search") },
        { name: "robots", content: "noindex" },
      ],
      links: [{ rel: "canonical", href: pageUrl("/search") }],
    };
  },
});

function SearchRoutePage() {
  return <SearchCatalogPage search={Route.useSearch()} />;
}
