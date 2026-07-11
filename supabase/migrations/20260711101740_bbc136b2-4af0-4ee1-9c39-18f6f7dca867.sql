-- Tighten contact_messages INSERT policy: require honest user_id binding.
-- Anonymous users may insert only when user_id IS NULL.
-- Authenticated users may insert only when user_id matches their own auth.uid().
-- Payload size caps prevent oversized-body abuse at the DB layer as a defense-in-depth
-- backstop for the server function's sanitizer.

DROP POLICY IF EXISTS "Anyone can submit a contact message" ON public.contact_messages;

CREATE POLICY "Contact insert: anon null user_id or self"
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND length(name) BETWEEN 1 AND 200
  AND length(email) BETWEEN 3 AND 320
  AND length(subject) BETWEEN 1 AND 300
  AND length(message) BETWEEN 1 AND 8000
  AND length(category) BETWEEN 1 AND 40
  AND (attachment_path IS NULL OR length(attachment_path) <= 1000)
  AND (attachment_size IS NULL OR attachment_size <= 15728640) -- 15 MB hard cap
);