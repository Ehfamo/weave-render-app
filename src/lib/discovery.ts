/** Keep preview rails deterministic and exclude missing/duplicate prompt references. */
export function selectDiscoveryRows<T extends { ids: string[] }>(
  prompts: readonly { id: string }[],
  rows: readonly T[],
): T[] {
  const known = new Set(prompts.map((prompt) => prompt.id));
  return rows
    .map((row) => ({ ...row, ids: [...new Set(row.ids)].filter((id) => known.has(id)) }))
    .filter((row) => row.ids.length > 0);
}
