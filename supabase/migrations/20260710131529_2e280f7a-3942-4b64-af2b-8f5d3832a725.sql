
-- 1. Username uniqueness
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_unique UNIQUE (username);

CREATE INDEX IF NOT EXISTS profiles_username_lower_idx ON public.profiles (lower(username));

-- 2. updated_at trigger on profiles
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Waitlist uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_unique_idx ON public.waitlist (lower(email));

-- 4. Storage RLS for avatars bucket (user-scoped folder: <uid>/filename)
DROP POLICY IF EXISTS "Avatars are readable by authenticated" ON storage.objects;
CREATE POLICY "Avatars are readable by authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
