export const SEARCH_TYPES = [
  "project",
  "conversation",
  "memory",
  "prompt",
  "asset",
  "generation",
] as const;
export type GlobalSearchResultType = (typeof SEARCH_TYPES)[number];
export type GlobalSearchSort = "relevance" | "recent";
export interface GlobalSearchFilters {
  types?: GlobalSearchResultType[];
  projectId?: string;
}
export interface GlobalSearchQuery {
  text: string;
  filters?: GlobalSearchFilters;
  sort?: GlobalSearchSort;
  offset?: number;
  limit?: number;
}
export interface GlobalSearchResult {
  id: string;
  type: GlobalSearchResultType;
  title: string;
  snippet: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  relevance: number;
  target: string;
  source: { id: string; method: "lexical" | "semantic" };
}
/** Private authorization metadata never leaves the service response. */
export interface SearchCandidate extends Omit<
  GlobalSearchResult,
  "relevance" | "target" | "source"
> {
  ownerId?: string;
  importance?: number;
}
export interface GlobalSearchSource {
  id: string;
  type: GlobalSearchResultType;
  read(query: GlobalSearchQuery): Promise<SearchCandidate[]>;
}
export interface SearchAccess {
  userId: string;
  canReadProject(id: string): Promise<boolean>;
}
export interface GlobalSearchPage {
  results: GlobalSearchResult[];
  nextOffset: number | null;
  totalInWindow: number;
  coverage: "bounded";
  sources: { id: string; status: "available" | "unavailable" }[];
}
/** Future semantic retrieval must produce the same authorized canonical candidates. */
export interface SemanticSearchSource extends GlobalSearchSource {
  method: "semantic";
}
