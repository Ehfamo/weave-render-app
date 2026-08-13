import { supabase } from "@/integrations/supabase/client";
import { fallbackCover, toPromptCard } from "@/lib/marketplace";
import type { PromptRow } from "@/lib/marketplace";
import type { Collection, Creator, Prompt } from "@/lib/prompts";

export type SearchCatalogResults = {
  prompts: Prompt[];
  creators: Creator[];
  collections: Collection[];
};

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type CollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  owner_id: string;
  is_public: boolean;
};

const PROMPT_SELECT =
  "id, slug, title, body, description, category, cover_url, price_cents, published_at, is_published, author_id, tags, " +
  "author:profiles!prompts_author_id_profiles_fkey(username, display_name, avatar_url)";

function cleanTerm(value: string) {
  return value.trim().replace(/[%_]/g, "").replace(/\s+/g, " ").slice(0, 120);
}

function uniqueBy<T>(rows: T[], key: (row: T) => string) {
  return [...new Map(rows.map((row) => [key(row), row])).values()];
}

function toCreator(row: ProfileRow): Creator {
  return {
    handle: row.username ? `@${row.username}` : "@creator",
    name: row.display_name || row.username || "Creator",
    tier: "Rising",
    followers: "0",
    copies: "0",
    cover: row.avatar_url || fallbackCover(row.id),
    bio: row.bio || "Building the future of prompts.",
  };
}

function toCollection(row: CollectionRow): Collection {
  return {
    id: row.slug,
    title: row.title,
    subtitle: row.description || "Public collection",
    count: 0,
    cover: row.cover_url || fallbackCover(row.slug),
    ids: [],
    badge: "Public",
  };
}

export async function searchCatalog(query: string, category?: string): Promise<SearchCatalogResults> {
  const term = cleanTerm(query);
  if (term.length < 2) return { prompts: [], creators: [], collections: [] };
  const pattern = `%${term}%`;
  const categoryScoped = !!category && category !== "All";

  const promptBase = () => {
    let request = supabase
      .from("prompts")
      .select(PROMPT_SELECT)
      .eq("is_published", true)
      .limit(24);
    if (categoryScoped) request = request.eq("category", category!);
    return request;
  };

  const promptRequests = [
    promptBase().ilike("title", pattern),
    promptBase().ilike("description", pattern),
    promptBase().ilike("body", pattern),
    promptBase().ilike("category", pattern),
  ];

  const creatorRequests = categoryScoped
    ? []
    : [
        supabase
          .from("profiles")
          .select("id, username, display_name, bio, avatar_url")
          .eq("is_creator", true)
          .ilike("username", pattern)
          .limit(12),
        supabase
          .from("profiles")
          .select("id, username, display_name, bio, avatar_url")
          .eq("is_creator", true)
          .ilike("display_name", pattern)
          .limit(12),
      ];

  const collectionRequests = categoryScoped
    ? []
    : [
        supabase
          .from("collections")
          .select("id, slug, title, description, cover_url, owner_id, is_public")
          .eq("is_public", true)
          .ilike("title", pattern)
          .limit(12),
        supabase
          .from("collections")
          .select("id, slug, title, description, cover_url, owner_id, is_public")
          .eq("is_public", true)
          .ilike("description", pattern)
          .limit(12),
      ];

  const responses = await Promise.all([...promptRequests, ...creatorRequests, ...collectionRequests]);
  const error = responses.find((response) => response.error)?.error;
  if (error) throw error;

  const promptResponses = responses.slice(0, promptRequests.length);
  const creatorStart = promptRequests.length;
  const collectionStart = creatorStart + creatorRequests.length;

  const promptRows = uniqueBy(
    promptResponses.flatMap((response) => (response.data ?? []) as unknown as PromptRow[]),
    (row) => row.id,
  );
  const creatorRows = uniqueBy(
    responses
      .slice(creatorStart, collectionStart)
      .flatMap((response) => (response.data ?? []) as unknown as ProfileRow[]),
    (row) => row.id,
  );
  const collectionRows = uniqueBy(
    responses
      .slice(collectionStart)
      .flatMap((response) => (response.data ?? []) as unknown as CollectionRow[]),
    (row) => row.id,
  );

  return {
    prompts: promptRows.slice(0, 24).map(toPromptCard),
    creators: creatorRows.slice(0, 12).map(toCreator),
    collections: collectionRows.slice(0, 12).map(toCollection),
  };
}
