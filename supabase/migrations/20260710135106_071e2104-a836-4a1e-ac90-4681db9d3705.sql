
CREATE OR REPLACE FUNCTION public.username_available(_username text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
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
