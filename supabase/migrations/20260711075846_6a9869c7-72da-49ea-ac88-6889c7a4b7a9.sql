
-- Extend contact_messages for production support workflow
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS ticket_number text,
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_size integer;

-- Sequence-backed ticket numbers of the form XM-XXXXXX
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_seq START 10000 INCREMENT 1;
GRANT USAGE ON SEQUENCE public.support_ticket_seq TO service_role;

CREATE OR REPLACE FUNCTION public.set_support_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'XM-' || lpad(nextval('public.support_ticket_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_support_ticket_number ON public.contact_messages;
CREATE TRIGGER trg_set_support_ticket_number
BEFORE INSERT ON public.contact_messages
FOR EACH ROW EXECUTE FUNCTION public.set_support_ticket_number();

-- Backfill any existing rows lacking a ticket number
UPDATE public.contact_messages
SET ticket_number = 'XM-' || lpad(nextval('public.support_ticket_seq')::text, 6, '0')
WHERE ticket_number IS NULL;

ALTER TABLE public.contact_messages
  ALTER COLUMN ticket_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contact_messages_ticket_number_key
  ON public.contact_messages (ticket_number);

-- Constrain status values
DO $$ BEGIN
  ALTER TABLE public.contact_messages
    ADD CONSTRAINT contact_messages_status_chk
    CHECK (status IN ('open','pending','resolved','closed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helpful indexes for future admin dashboard
CREATE INDEX IF NOT EXISTS contact_messages_status_idx ON public.contact_messages (status);
CREATE INDEX IF NOT EXISTS contact_messages_category_idx ON public.contact_messages (category);
CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx ON public.contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS contact_messages_email_idx ON public.contact_messages (email);
