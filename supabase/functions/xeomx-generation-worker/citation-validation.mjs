export function validateResearchCitations(text, sourceIds) {
  const allowed = new Set(sourceIds.filter((value) => Number.isSafeInteger(value) && value > 0));
  const citationLike = [...String(text).matchAll(/\[(\d[^\]]*)\]/g)];

  if (!citationLike.length) {
    return { ok: false, reason: "missing_citation", citedIds: [] };
  }

  const citedIds = [];
  for (const match of citationLike) {
    const raw = match[1].trim();
    if (!/^\d+$/.test(raw)) {
      return { ok: false, reason: "malformed_citation", citedIds: [] };
    }

    const id = Number(raw);
    if (!allowed.has(id)) {
      return { ok: false, reason: "unknown_citation", citedIds: [] };
    }
    if (!citedIds.includes(id)) citedIds.push(id);
  }

  return { ok: true, reason: null, citedIds };
}
