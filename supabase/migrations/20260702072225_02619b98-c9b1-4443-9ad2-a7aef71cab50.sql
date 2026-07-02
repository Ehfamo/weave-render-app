
-- 1. Drop the overly-permissive SELECT policy
DROP POLICY IF EXISTS "authenticated can read waitlist" ON public.waitlist;

-- 2. Add basic email format validation on insert (replace existing insert policy)
DROP POLICY IF EXISTS "anyone can join waitlist" ON public.waitlist;
CREATE POLICY "anyone can join waitlist"
  ON public.waitlist
  FOR INSERT
  TO public
  WITH CHECK (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND length(email) <= 254
    AND length(section) <= 64
  );

-- 3. De-duplicate any existing rows then enforce uniqueness on (email, section)
DELETE FROM public.waitlist a
  USING public.waitlist b
  WHERE a.ctid < b.ctid
    AND lower(a.email) = lower(b.email)
    AND a.section = b.section;

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_section_unique
  ON public.waitlist (lower(email), section);
