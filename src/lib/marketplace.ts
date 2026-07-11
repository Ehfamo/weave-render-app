import { supabase } from "@/integrations/supabase/client";
import type { Prompt, Collection, Creator } from "@/lib/prompts";
import { _covers } from "@/lib/prompts";

// -------------------- Types --------------------

export type PromptRow = {
  id: string;
  slug: string;
  title: string;
  body: string;
  description: string | null;
  category: string | null;
  cover_url: string | null;
  price_cents: number;
  published_at: string | null;
  is_published: boolean;
  author_id: string;
  tags: string[];
  author?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  likes?: { count: number }[];
  saves?: { count: number }[];
  prompt_views?: { count: number }[];
  comments?: { count: number }[];
};

// -------------------- Helpers --------------------

const hashIndex = (s: string, mod: number) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
};

export function fallbackCover(seed: string) {
  return _covers[hashIndex(seed, _covers.length)];
}

export function formatCount(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(v >= 10_000 ? 0 : 1) + "k";
  return String(v);
}

const firstCount = (arr: { count: number }[] | undefined) =>
  Array.isArray(arr) && arr.length ? arr[0].count : 0;

export function toPromptCard(row: PromptRow): Prompt {
  const views = firstCount(row.prompt_views);
  const likes = firstCount(row.likes);
  const saves = firstCount(row.saves);
  const author = row.author?.username ? `@${row.author.username}` : "@creator";
  const state: Prompt["state"] =
    !row.is_published ? "soon" : row.price_cents > 0 ? "premium" : "free";
  return {
    id: row.slug,
    title: row.title,
    category: row.category ?? "General",
    state,
    cover: row.cover_url || fallbackCover(row.slug),
    author,
    views: formatCount(views),
    likes: formatCount(likes),
    prompt: row.body || row.description || "",
    breakdown: [],
    copies: views,
    saves,
    shares: 0,
    remixes: 0,
    viralScore: undefined,
    signal: null,
    tagline: row.description ?? undefined,
    related: [],
  };
}

const PROMPT_LIST_SELECT =
  "id, slug, title, body, description, category, cover_url, price_cents, published_at, is_published, author_id, tags, " +
  "author:profiles!prompts_author_id_profiles_fkey(username, display_name, avatar_url), " +
  "likes(count), saves(count), prompt_views(count), comments(count)";

// -------------------- Prompt queries --------------------

export async function fetchPromptsList(opts?: {
  category?: string;
  search?: string;
  limit?: number;
  orderBy?: "recent" | "trending";
}) {
  const limit = opts?.limit ?? 24;
  let q = supabase
    .from("prompts")
    .select(PROMPT_LIST_SELECT)
    .eq("is_published", true)
    .limit(limit);

  if (opts?.category && opts.category !== "All") q = q.eq("category", opts.category);
  if (opts?.search) {
    const s = opts.search.replace(/[%_]/g, "");
    q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%,body.ilike.%${s}%`);
  }
  q = q.order("published_at", { ascending: false, nullsFirst: false });

  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as PromptRow[]).map(toPromptCard);
}

export async function fetchViralPrompts(limit = 12) {
  // "viral" = most views in last 30d; fallback most-liked; ensures non-empty for empty DBs.
  const { data, error } = await supabase
    .from("prompts")
    .select(PROMPT_LIST_SELECT)
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data as unknown as PromptRow[]).map(toPromptCard);
  return rows.sort((a, b) => (b.copies ?? 0) - (a.copies ?? 0));
}

export async function fetchPromptBySlug(slug: string) {
  const { data, error } = await supabase
    .from("prompts")
    .select(PROMPT_LIST_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as PromptRow;
  return { row, prompt: toPromptCard(row) };
}

export async function fetchRelatedPrompts(row: PromptRow, limit = 4) {
  let q = supabase
    .from("prompts")
    .select(PROMPT_LIST_SELECT)
    .eq("is_published", true)
    .neq("id", row.id)
    .limit(limit);
  if (row.category) q = q.eq("category", row.category);
  q = q.order("published_at", { ascending: false, nullsFirst: false });
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as PromptRow[]).map(toPromptCard);
}

export async function recordPromptView(promptId: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const viewer = userRes?.user?.id ?? null;
  await supabase.from("prompt_views").insert({ prompt_id: promptId, viewer_id: viewer });
}

// -------------------- Engagement --------------------

export async function togglePromptLike(promptId: string, on: boolean) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) throw new Error("auth_required");
  if (on) {
    const { error } = await supabase.from("likes").insert({ prompt_id: promptId, user_id: uid });
    if (error && !/duplicate/i.test(error.message)) throw error;
  } else {
    const { error } = await supabase.from("likes").delete().eq("prompt_id", promptId).eq("user_id", uid);
    if (error) throw error;
  }
}

export async function togglePromptSave(promptId: string, on: boolean) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) throw new Error("auth_required");
  if (on) {
    const { error } = await supabase.from("saves").insert({ prompt_id: promptId, user_id: uid });
    if (error && !/duplicate/i.test(error.message)) throw error;
  } else {
    const { error } = await supabase.from("saves").delete().eq("prompt_id", promptId).eq("user_id", uid);
    if (error) throw error;
  }
}

export async function toggleFollow(followeeId: string, on: boolean) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) throw new Error("auth_required");
  if (uid === followeeId) return;
  if (on) {
    const { error } = await supabase.from("follows").insert({ follower_id: uid, followee_id: followeeId });
    if (error && !/duplicate/i.test(error.message)) throw error;
  } else {
    const { error } = await supabase.from("follows").delete().eq("follower_id", uid).eq("followee_id", followeeId);
    if (error) throw error;
  }
}

export async function fetchViewerEngagement(promptId: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) return { liked: false, saved: false, following: false };
  const [likeRes, saveRes] = await Promise.all([
    supabase.from("likes").select("prompt_id").eq("prompt_id", promptId).eq("user_id", uid).maybeSingle(),
    supabase.from("saves").select("prompt_id").eq("prompt_id", promptId).eq("user_id", uid).maybeSingle(),
  ]);
  return {
    liked: !!likeRes.data,
    saved: !!saveRes.data,
    following: false,
  };
}

export async function fetchIsFollowing(followeeId: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) return false;
  const { data } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", uid)
    .eq("followee_id", followeeId)
    .maybeSingle();
  return !!data;
}

// -------------------- Comments --------------------

export type CommentRow = {
  id: string;
  prompt_id: string;
  author_id: string;
  body: string;
  created_at: string;
  parent_id: string | null;
  author?: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
};

export async function fetchComments(promptId: string): Promise<CommentRow[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("id, prompt_id, author_id, body, created_at, parent_id, author:profiles!comments_author_id_profiles_fkey(username, display_name, avatar_url)")
    .eq("prompt_id", promptId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as CommentRow[];
}

export async function postComment(promptId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("empty");
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) throw new Error("auth_required");
  const { error } = await supabase.from("comments").insert({ prompt_id: promptId, author_id: uid, body: trimmed });
  if (error) throw error;
}

export async function deleteComment(commentId: string) {
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) throw error;
}

// -------------------- Collections --------------------

export type CollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  owner_id: string;
  is_public: boolean;
  updated_at: string;
  collection_items?: { count: number }[];
  owner?: { username: string | null; display_name: string | null } | null;
};

function toCollectionCard(row: CollectionRow): Collection {
  return {
    id: row.slug,
    title: row.title,
    subtitle: row.description || (row.owner?.username ? `Curated by @${row.owner.username}` : "Curated pack"),
    count: firstCount(row.collection_items),
    cover: row.cover_url || fallbackCover(row.slug),
    ids: [],
    badge: row.is_public ? "Public" : "Private",
  };
}

const COLLECTION_SELECT =
  "id, slug, title, description, cover_url, owner_id, is_public, updated_at, " +
  "collection_items(count), owner:profiles!collections_owner_id_profiles_fkey(username, display_name)";

export async function fetchCollections(limit = 24) {
  const { data, error } = await supabase
    .from("collections")
    .select(COLLECTION_SELECT)
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as CollectionRow[]).map(toCollectionCard);
}

export async function fetchCollectionBySlug(slug: string) {
  const { data, error } = await supabase
    .from("collections")
    .select(COLLECTION_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as CollectionRow;
  const { data: items } = await supabase
    .from("collection_items")
    .select("prompt_id, position, prompts(" + PROMPT_LIST_SELECT + ")")
    .eq("collection_id", row.id)
    .order("position", { ascending: true });
  const prompts = ((items ?? []) as unknown as Array<{ prompts: PromptRow | null }>)
    .map((it) => it.prompts)
    .filter((p): p is PromptRow => !!p && p.is_published)
    .map(toPromptCard);
  return { collection: toCollectionCard(row), prompts, raw: row };
}

// -------------------- Creators --------------------

type CreatorRow = {
  user_id: string | null;
  prompt_count: number | null;
  published_count: number | null;
  followers_count: number | null;
  following_count: number | null;
  likes_count: number | null;
  views_count: number | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

function tierFor(stats: CreatorRow): Creator["tier"] {
  const followers = stats.followers_count ?? 0;
  const views = stats.views_count ?? 0;
  if (followers >= 1000 || views >= 100_000) return "Founder";
  if (followers >= 100 || views >= 10_000) return "Elite";
  return "Rising";
}

export async function fetchCreators(limit = 24): Promise<{ creators: Creator[]; ids: string[] }> {
  const { data: statsRows, error } = await supabase
    .from("creator_stats")
    .select("*")
    .gt("published_count", 0)
    .limit(limit);
  if (error) throw error;
  const stats = (statsRows ?? []) as CreatorRow[];
  const ids = stats.map((s) => s.user_id).filter((v): v is string => !!v);
  if (ids.length === 0) return { creators: [], ids: [] };
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url")
    .in("id", ids);
  const profMap = new Map<string, ProfileRow>();
  for (const p of (profs ?? []) as ProfileRow[]) profMap.set(p.id, p);
  const creators: Creator[] = stats
    .filter((s) => s.user_id)
    .map((s) => {
      const p = profMap.get(s.user_id!);
      const handle = p?.username ? `@${p.username}` : "@creator";
      return {
        handle,
        name: p?.display_name || p?.username || "Creator",
        tier: tierFor(s),
        followers: formatCount(s.followers_count),
        copies: formatCount(s.views_count),
        cover: p?.avatar_url || fallbackCover(s.user_id!),
        bio: p?.bio || "Building the future of prompts.",
      };
    });
  return { creators, ids };
}

export async function searchAll(query: string) {
  const s = query.trim();
  if (!s) return { prompts: [] as Prompt[] };
  const prompts = await fetchPromptsList({ search: s, limit: 20 });
  return { prompts };
}