-- XEOMX Search V1 catalog schema.
-- Restores only the existing public marketplace entities required by live Search.
-- Auth schema and auth triggers are intentionally untouched.

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_creator BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS public.prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 120),
  description TEXT CHECK (description IS NULL OR length(description) <= 2000),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
  cover_url TEXT,
  model TEXT,
  category TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT prompts_author_id_profiles_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS prompts_author_idx ON public.prompts(author_id);
CREATE INDEX IF NOT EXISTS prompts_published_idx ON public.prompts(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS prompts_category_idx ON public.prompts(category) WHERE is_published;
CREATE INDEX IF NOT EXISTS prompts_tags_idx ON public.prompts USING GIN(tags);
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.prompts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompts TO authenticated;
GRANT ALL ON public.prompts TO service_role;
CREATE POLICY "Published prompts are viewable by everyone" ON public.prompts FOR SELECT USING (is_published = true);
CREATE POLICY "Authors can view their own prompts" ON public.prompts FOR SELECT TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "Authors can insert their own prompts" ON public.prompts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update their own prompts" ON public.prompts FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can delete their own prompts" ON public.prompts FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT collections_owner_id_profiles_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS collections_owner_slug_key ON public.collections(owner_id, slug);
CREATE INDEX IF NOT EXISTS collections_owner_idx ON public.collections(owner_id);
CREATE INDEX IF NOT EXISTS collections_public_idx ON public.collections(is_public, created_at DESC);
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.collections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT ALL ON public.collections TO service_role;
CREATE POLICY "Public collections viewable by everyone" ON public.collections FOR SELECT USING (is_public = true);
CREATE POLICY "Owners can view their collections" ON public.collections FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners can insert their collections" ON public.collections FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update their collections" ON public.collections FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can delete their collections" ON public.collections FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.collection_items (
  collection_id UUID NOT NULL,
  prompt_id UUID NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, prompt_id),
  CONSTRAINT collection_items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id),
  CONSTRAINT collection_items_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.prompts(id)
);
CREATE INDEX IF NOT EXISTS collection_items_prompt_idx ON public.collection_items(prompt_id);
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.collection_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_items TO authenticated;
GRANT ALL ON public.collection_items TO service_role;
CREATE POLICY "Public collection items viewable by everyone" ON public.collection_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.is_public = true));
CREATE POLICY "Owners can view their collection items" ON public.collection_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.owner_id = auth.uid()));
CREATE POLICY "Owners can modify their collection items" ON public.collection_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.owner_id = auth.uid()));

NOTIFY pgrst, 'reload schema';
