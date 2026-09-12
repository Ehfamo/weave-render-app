import type { Timeline, TimelineItem } from "./contracts.ts";
const valid = (i: TimelineItem) =>
  /^[\w-]{1,80}$/.test(i.id) &&
  i.start >= 0 &&
  i.duration > 0 &&
  Number.isFinite(i.start + i.duration) &&
  Number.isSafeInteger(i.order);
export function normalizeTimeline(t: Timeline): Timeline {
  const scenes = [...t.scenes].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const sceneIds = new Set(scenes.map((s) => s.id)),
    trackIds = new Set(t.tracks.map((x) => x.id));
  if (sceneIds.size !== scenes.length || trackIds.size !== t.tracks.length)
    throw Error("INVALID_TIMELINE");
  const tracks = [...t.tracks]
    .map((x) => ({
      ...x,
      items: [...x.items]
        .filter((i) => i.status === "active")
        .map((i) => {
          if (!valid(i) || i.trackId !== x.id || !sceneIds.has(i.sceneId))
            throw Error("INVALID_TIMELINE_ITEM");
          return structuredClone(i);
        })
        .sort((a, b) => a.start - b.start || a.order - b.order || a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return { ...structuredClone(t), scenes, tracks };
}
export function totalDuration(t: Timeline) {
  let max = 0;
  for (const track of normalizeTimeline(t).tracks)
    for (const i of track.items) max = Math.max(max, i.start + i.duration);
  return max;
}
export function moveItem(
  t: Timeline,
  itemId: string,
  trackId: string,
  start: number,
  order: number,
) {
  const next = structuredClone(t);
  let found = false;
  if (!Number.isFinite(start) || start < 0 || !Number.isSafeInteger(order))
    throw Error("INVALID_MOVE");
  for (const track of next.tracks) {
    const at = track.items.findIndex((i) => i.id === itemId);
    if (at >= 0) {
      const [item] = track.items.splice(at, 1);
      item.trackId = trackId;
      item.start = start;
      item.order = order;
      const target = next.tracks.find((x) => x.id === trackId);
      if (!target) throw Error("TRACK_NOT_FOUND");
      target.items.push(item);
      found = true;
      break;
    }
  }
  if (!found) throw Error("ITEM_NOT_FOUND");
  return normalizeTimeline(next);
}
export function serializeTimeline(t: Timeline) {
  return JSON.stringify(normalizeTimeline(t));
}
