
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS language text;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_display_name_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_display_name_len
  CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 60);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_bio_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_len
  CHECK (bio IS NULL OR char_length(bio) <= 300);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_website_fmt;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_website_fmt
  CHECK (website IS NULL OR website ~* '^https?://[^\s]{3,200}$');

-- Replace the case-sensitive unique constraint with case-insensitive index
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
DROP INDEX IF EXISTS public.profiles_username_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.reserved_usernames (name text PRIMARY KEY);
GRANT SELECT ON public.reserved_usernames TO anon, authenticated;
GRANT ALL ON public.reserved_usernames TO service_role;
ALTER TABLE public.reserved_usernames ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reserved_usernames_public_read" ON public.reserved_usernames;
CREATE POLICY "reserved_usernames_public_read" ON public.reserved_usernames FOR SELECT USING (true);

INSERT INTO public.reserved_usernames(name) VALUES
  ('admin'),('administrator'),('root'),('support'),('help'),('staff'),
  ('mod'),('moderator'),('system'),('security'),('official'),('team'),
  ('xeomx'),('lovable'),('supabase'),('billing'),('api'),('www'),
  ('mail'),('email'),('me'),('you'),('null'),('undefined'),('anonymous'),
  ('user'),('users'),('profile'),('settings'),('dashboard'),('auth'),
  ('login'),('logout'),('signup'),('signin'),('register'),('privacy'),
  ('terms'),('cookies'),('about'),('contact')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.username_available(_username text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _norm text := lower(trim(_username));
BEGIN
  IF _norm IS NULL OR _norm !~ '^[a-z0-9_]{3,20}$' THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.reserved_usernames WHERE name = _norm) THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = _norm
             AND id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid))
  THEN RETURN false; END IF;
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
CREATE POLICY "avatars_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
