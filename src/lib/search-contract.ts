/** Recovered catalog semantics: bounded text, no caller-supplied LIKE wildcards. */
export function sanitizeSearchTerm(value: string): string {
  return value
    .replace(/[%_\\*]/g, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 120);
}

export function searchCatalogPlan(query: string, category?: string) {
  const term = sanitizeSearchTerm(query);
  const categoryValue = category?.trim();
  const categoryScoped = Boolean(categoryValue && categoryValue !== "All");
  return {
    term,
    enabled: term.length >= 2,
    pattern: `%${term}%`,
    category: categoryScoped ? categoryValue! : null,
    categoryScoped,
  };
}

export function uniqueSearchRows<T>(rows: readonly T[], key: (row: T) => string): T[] {
  return [...new Map(rows.map((row) => [key(row), row])).values()];
}

/** PostgREST OR values must be quoted; commas/parentheses must stay inside the value. */
export function promptSearchFilter(pattern: string): string {
  const value = JSON.stringify(pattern);
  return ["title", "description", "body"].map((column) => `${column}.ilike.${value}`).join(",");
}
