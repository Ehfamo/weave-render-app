
-- ============================================================
-- Shared trigger for updated_at
-- ============================================================
-- public.set_updated_at() already exists.

-- ============================================================
-- 1. prompts
-- ============================================================
CREATE TABLE public.prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX prompts_author_idx ON public.prompts(author_id);
CREATE INDEX prompts_published_idx ON public.prompts(is_published, published_at DESC);
CREATE INDEX prompts_category_idx ON public.prompts(category) WHERE is_published;
CREATE INDEX prompts_tags_idx ON public.prompts USING GIN (tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompts TO authenticated;
GRANT SELECT ON public.prompts TO anon;
GRANT ALL ON public.prompts TO service_role;

ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published prompts are viewable by everyone"
  ON public.prompts FOR SELECT USING (is_published = true);
CREATE POLICY "Authors can view their own prompts"
  ON public.prompts FOR SELECT TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "Authors can insert their own prompts"
  ON public.prompts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update their own prompts"
  ON public.prompts FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can delete their own prompts"
  ON public.prompts FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE TRIGGER prompts_set_updated_at BEFORE UPDATE ON public.prompts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. collections
-- ============================================================
CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  slug TEXT NOT NULL CHECK (length(slug) BETWEEN 1 AND 120),
  description TEXT CHECK (description IS NULL OR length(description) <= 2000),
  cover_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, slug)
);
CREATE INDEX collections_owner_idx ON public.collections(owner_id);
CREATE INDEX collections_public_idx ON public.collections(is_public, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT SELECT ON public.collections TO anon;
GRANT ALL ON public.collections TO service_role;

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public collections viewable by everyone"
  ON public.collections FOR SELECT USING (is_public = true);
CREATE POLICY "Owners can view their collections"
  ON public.collections FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners can insert their collections"
  ON public.collections FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update their collections"
  ON public.collections FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can delete their collections"
  ON public.collections FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER collections_set_updated_at BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. collection_items
-- ============================================================
CREATE TABLE public.collection_items (
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, prompt_id)
);
CREATE INDEX collection_items_prompt_idx ON public.collection_items(prompt_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_items TO authenticated;
GRANT SELECT ON public.collection_items TO anon;
GRANT ALL ON public.collection_items TO service_role;

ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public collection items viewable by everyone"
  ON public.collection_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.is_public = true)
  );
CREATE POLICY "Owners can view their collection items"
  ON public.collection_items FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.owner_id = auth.uid())
  );
CREATE POLICY "Owners can modify their collection items"
  ON public.collection_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.owner_id = auth.uid()));

-- ============================================================
-- 4. likes
-- ============================================================
CREATE TABLE public.likes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, prompt_id)
);
CREATE INDEX likes_prompt_idx ON public.likes(prompt_id);

GRANT SELECT, INSERT, DELETE ON public.likes TO authenticated;
GRANT SELECT ON public.likes TO anon;
GRANT ALL ON public.likes TO service_role;

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes are viewable by everyone"
  ON public.likes FOR SELECT USING (true);
CREATE POLICY "Users can like as themselves"
  ON public.likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike their own likes"
  ON public.likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 5. saves
-- ============================================================
CREATE TABLE public.saves (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, prompt_id)
);
CREATE INDEX saves_prompt_idx ON public.saves(prompt_id);
CREATE INDEX saves_user_created_idx ON public.saves(user_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.saves TO authenticated;
GRANT ALL ON public.saves TO service_role;

ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their saves"
  ON public.saves FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can save as themselves"
  ON public.saves FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave their own saves"
  ON public.saves FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 6. follows
-- ============================================================
CREATE TABLE public.follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX follows_followee_idx ON public.follows(followee_id);

GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT SELECT ON public.follows TO anon;
GRANT ALL ON public.follows TO service_role;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follows are viewable by everyone"
  ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can follow as themselves"
  ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow their own follows"
  ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- ============================================================
-- 7. prompt_views (analytics)
-- ============================================================
CREATE TABLE public.prompt_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX prompt_views_prompt_idx ON public.prompt_views(prompt_id, created_at DESC);
CREATE INDEX prompt_views_viewer_idx ON public.prompt_views(viewer_id) WHERE viewer_id IS NOT NULL;

GRANT SELECT, INSERT ON public.prompt_views TO authenticated;
GRANT SELECT, INSERT ON public.prompt_views TO anon;
GRANT ALL ON public.prompt_views TO service_role;

ALTER TABLE public.prompt_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prompt view counts are aggregatable"
  ON public.prompt_views FOR SELECT USING (true);
CREATE POLICY "Anyone can record a view on published prompts"
  ON public.prompt_views FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.prompts p WHERE p.id = prompt_id AND p.is_published = true)
    AND (viewer_id IS NULL OR viewer_id = auth.uid())
  );

-- ============================================================
-- 8. comments
-- ============================================================
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_prompt_idx ON public.comments(prompt_id, created_at DESC);
CREATE INDEX comments_author_idx ON public.comments(author_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT SELECT ON public.comments TO anon;
GRANT ALL ON public.comments TO service_role;

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments on published prompts are viewable by everyone"
  ON public.comments FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.prompts p WHERE p.id = prompt_id AND p.is_published = true)
  );
CREATE POLICY "Authors can insert their own comments"
  ON public.comments FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (SELECT 1 FROM public.prompts p WHERE p.id = prompt_id AND p.is_published = true)
  );
CREATE POLICY "Authors can update their own comments"
  ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can delete their own comments"
  ON public.comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE TRIGGER comments_set_updated_at BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 9. notifications
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (length(type) BETWEEN 1 AND 64),
  entity_type TEXT,
  entity_id UUID,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread_idx ON public.notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their notifications"
  ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can mark their notifications read"
  ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- No INSERT/DELETE policies: only service_role can create/remove notifications.

-- ============================================================
-- 10. earnings
-- ============================================================
CREATE TABLE public.earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (length(currency) = 3),
  source TEXT NOT NULL CHECK (source IN ('sale', 'subscription', 'tip', 'payout', 'adjustment')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'reversed', 'canceled')),
  prompt_id UUID REFERENCES public.prompts(id) ON DELETE SET NULL,
  subscription_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX earnings_user_idx ON public.earnings(user_id, occurred_at DESC);
CREATE INDEX earnings_status_idx ON public.earnings(user_id, status);

GRANT SELECT ON public.earnings TO authenticated;
GRANT ALL ON public.earnings TO service_role;

ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their earnings"
  ON public.earnings FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE: server-side only.

-- ============================================================
-- 11. subscriptions
-- ============================================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'standard' CHECK (length(tier) BETWEEN 1 AND 64),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (length(currency) = 3),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'expired', 'trialing')),
  current_period_end TIMESTAMPTZ,
  provider TEXT,
  provider_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (subscriber_id <> creator_id)
);
CREATE UNIQUE INDEX subscriptions_active_unique
  ON public.subscriptions(subscriber_id, creator_id)
  WHERE status IN ('active', 'trialing', 'past_due');
CREATE INDEX subscriptions_creator_idx ON public.subscriptions(creator_id, status);
CREATE INDEX subscriptions_subscriber_idx ON public.subscriptions(subscriber_id, status);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subscribers can view their subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = subscriber_id);
CREATE POLICY "Creators can view subscriptions to them"
  ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = creator_id);
-- No INSERT/UPDATE/DELETE: server-side (billing webhooks) only.

CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- creator_stats — derived view
-- ============================================================
CREATE OR REPLACE VIEW public.creator_stats
WITH (security_invoker = true)
AS
SELECT
  p.id AS user_id,
  COALESCE(pr.prompt_count, 0) AS prompt_count,
  COALESCE(pr.published_count, 0) AS published_count,
  COALESCE(f.followers_count, 0) AS followers_count,
  COALESCE(fo.following_count, 0) AS following_count,
  COALESCE(l.likes_count, 0) AS likes_count,
  COALESCE(v.views_count, 0) AS views_count
FROM public.profiles p
LEFT JOIN (
  SELECT author_id,
         COUNT(*)::bigint AS prompt_count,
         COUNT(*) FILTER (WHERE is_published)::bigint AS published_count
  FROM public.prompts GROUP BY author_id
) pr ON pr.author_id = p.id
LEFT JOIN (
  SELECT followee_id, COUNT(*)::bigint AS followers_count
  FROM public.follows GROUP BY followee_id
) f ON f.followee_id = p.id
LEFT JOIN (
  SELECT follower_id, COUNT(*)::bigint AS following_count
  FROM public.follows GROUP BY follower_id
) fo ON fo.follower_id = p.id
LEFT JOIN (
  SELECT pr2.author_id, COUNT(l2.*)::bigint AS likes_count
  FROM public.prompts pr2
  LEFT JOIN public.likes l2 ON l2.prompt_id = pr2.id
  GROUP BY pr2.author_id
) l ON l.author_id = p.id
LEFT JOIN (
  SELECT pr3.author_id, COUNT(v2.*)::bigint AS views_count
  FROM public.prompts pr3
  LEFT JOIN public.prompt_views v2 ON v2.prompt_id = pr3.id
  GROUP BY pr3.author_id
) v ON v.author_id = p.id;

GRANT SELECT ON public.creator_stats TO anon, authenticated, service_role;
