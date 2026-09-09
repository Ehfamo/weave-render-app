-- XEOMX Stage 5.3 — provider-neutral billing and entitlement boundary.
-- No payment provider is selected here. All mutations are server-owned and
-- entitlements can activate only from a locked, verified payment event.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE OR REPLACE FUNCTION private.xeomx_billing_metadata_is_safe(p_value JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_key TEXT;
  v_child JSONB;
BEGIN
  IF p_value IS NULL THEN
    RETURN false;
  END IF;

  IF jsonb_typeof(p_value) = 'object' THEN
    FOR v_key, v_child IN
      SELECT entry.key, entry.value FROM pg_catalog.jsonb_each(p_value) AS entry
    LOOP
      IF pg_catalog.lower(v_key) ~ (
        'secret|token|password|api[_-]?key|service[_-]?role|authorization|cookie|credential|'
        'raw[_-]?payload|webhook[_-]?signature'
      ) THEN
        RETURN false;
      END IF;
      IF NOT private.xeomx_billing_metadata_is_safe(v_child) THEN
        RETURN false;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(p_value) = 'array' THEN
    FOR v_child IN
      SELECT item.value FROM pg_catalog.jsonb_array_elements(p_value) AS item
    LOOP
      IF NOT private.xeomx_billing_metadata_is_safe(v_child) THEN
        RETURN false;
      END IF;
    END LOOP;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION private.xeomx_billing_metadata_is_safe(JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.xeomx_billing_metadata_is_safe(JSONB)
  TO service_role;

-- Serialize mutations by a stable aggregate key. This closes the classic
-- SELECT-missing-row/INSERT race while avoiding table locks. Hash collisions
-- can only serialize unrelated requests; they cannot weaken correctness.
CREATE OR REPLACE FUNCTION private.xeomx_billing_lock(p_scope TEXT)
RETURNS VOID
LANGUAGE sql
VOLATILE
SET search_path = ''
AS $$
  SELECT pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('xeomx:billing:' || COALESCE(p_scope, ''), 0)
  )
$$;

REVOKE ALL ON FUNCTION private.xeomx_billing_lock(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.xeomx_billing_lock(TEXT)
  TO service_role;

CREATE TABLE public.billing_checkout_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  product_key TEXT NOT NULL CHECK (char_length(product_key) BETWEEN 1 AND 160),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  provider TEXT NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 80),
  provider_session_id TEXT CHECK (
    provider_session_id IS NULL OR char_length(provider_session_id) BETWEEN 1 AND 240
  ),
  status TEXT NOT NULL DEFAULT 'created' CHECK (
    status IN (
      'created',
      'provider_pending',
      'session_created',
      'completed',
      'failed',
      'cancelled',
      'expired'
    )
  ),
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 250),
  failure_code TEXT CHECK (failure_code IS NULL OR char_length(failure_code) <= 100),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key),
  UNIQUE (provider, provider_session_id)
);

CREATE INDEX billing_checkout_intents_user_created_idx
  ON public.billing_checkout_intents(user_id, created_at DESC);
CREATE INDEX billing_checkout_intents_project_idx
  ON public.billing_checkout_intents(project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX billing_checkout_intents_status_idx
  ON public.billing_checkout_intents(status, created_at DESC);

CREATE TABLE public.billing_webhook_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkout_intent_id UUID NOT NULL
    REFERENCES public.billing_checkout_intents(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 80),
  provider_event_id TEXT NOT NULL CHECK (char_length(provider_event_id) BETWEEN 1 AND 240),
  payload_digest TEXT NOT NULL CHECK (char_length(payload_digest) BETWEEN 32 AND 160),
  signature_verified BOOLEAN NOT NULL CHECK (signature_verified = true),
  verification_method TEXT NOT NULL CHECK (char_length(verification_method) BETWEEN 1 AND 80),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX billing_webhook_receipts_user_received_idx
  ON public.billing_webhook_receipts(user_id, received_at DESC);
CREATE INDEX billing_webhook_receipts_checkout_idx
  ON public.billing_webhook_receipts(checkout_intent_id, received_at DESC);

CREATE TABLE public.billing_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkout_intent_id UUID NOT NULL
    REFERENCES public.billing_checkout_intents(id) ON DELETE RESTRICT,
  webhook_receipt_id UUID NOT NULL UNIQUE
    REFERENCES public.billing_webhook_receipts(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 80),
  provider_event_id TEXT NOT NULL CHECK (char_length(provider_event_id) BETWEEN 1 AND 240),
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'payment_pending',
      'payment_confirmed',
      'payment_failed',
      'payment_cancelled',
      'refund_pending',
      'refund_confirmed',
      'refund_failed',
      'subscription_created',
      'subscription_updated',
      'subscription_cancelled'
    )
  ),
  signature_verified BOOLEAN NOT NULL CHECK (signature_verified = true),
  amount_minor BIGINT CHECK (amount_minor IS NULL OR amount_minor >= 0),
  currency TEXT CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  payload_digest TEXT NOT NULL CHECK (char_length(payload_digest) BETWEEN 32 AND 160),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id),
  CHECK (amount_minor IS NULL OR currency IS NOT NULL)
);

CREATE INDEX billing_payment_events_user_recorded_idx
  ON public.billing_payment_events(user_id, recorded_at DESC);
CREATE INDEX billing_payment_events_checkout_idx
  ON public.billing_payment_events(checkout_intent_id, recorded_at DESC);
CREATE INDEX billing_payment_events_type_idx
  ON public.billing_payment_events(event_type, recorded_at DESC);

CREATE TABLE public.billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkout_intent_id UUID NOT NULL
    REFERENCES public.billing_checkout_intents(id) ON DELETE RESTRICT,
  source_payment_event_id UUID NOT NULL
    REFERENCES public.billing_payment_events(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 80),
  provider_subscription_id TEXT NOT NULL CHECK (
    char_length(provider_subscription_id) BETWEEN 1 AND 240
  ),
  plan_key TEXT NOT NULL CHECK (char_length(plan_key) BETWEEN 1 AND 160),
  status TEXT NOT NULL CHECK (
    status IN (
      'pending',
      'trialing',
      'active',
      'past_due',
      'cancelled',
      'expired',
      'refunded',
      'failed'
    )
  ),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subscription_id)
);

CREATE INDEX billing_subscriptions_user_status_idx
  ON public.billing_subscriptions(user_id, status);
CREATE INDEX billing_subscriptions_checkout_idx
  ON public.billing_subscriptions(checkout_intent_id);
CREATE INDEX billing_subscriptions_source_event_idx
  ON public.billing_subscriptions(source_payment_event_id);

CREATE TABLE public.billing_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkout_intent_id UUID NOT NULL
    REFERENCES public.billing_checkout_intents(id) ON DELETE RESTRICT,
  subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  activation_payment_event_id UUID
    REFERENCES public.billing_payment_events(id) ON DELETE RESTRICT,
  entitlement_key TEXT NOT NULL CHECK (char_length(entitlement_key) BETWEEN 1 AND 160),
  resource_type TEXT NOT NULL CHECK (char_length(resource_type) BETWEEN 1 AND 80),
  resource_ref TEXT NOT NULL DEFAULT 'account' CHECK (
    char_length(resource_ref) BETWEEN 1 AND 240
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'active', 'suspended', 'revoked', 'expired', 'refunded')
  ),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  revocation_reason TEXT CHECK (
    revocation_reason IS NULL OR char_length(revocation_reason) <= 240
  ),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, entitlement_key, resource_type, resource_ref),
  CHECK (status <> 'active' OR activation_payment_event_id IS NOT NULL),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from)
);

CREATE INDEX billing_entitlements_user_status_idx
  ON public.billing_entitlements(user_id, status);
CREATE INDEX billing_entitlements_checkout_idx
  ON public.billing_entitlements(checkout_intent_id);
CREATE INDEX billing_entitlements_subscription_idx
  ON public.billing_entitlements(subscription_id)
  WHERE subscription_id IS NOT NULL;
CREATE INDEX billing_entitlements_activation_event_idx
  ON public.billing_entitlements(activation_payment_event_id)
  WHERE activation_payment_event_id IS NOT NULL;

CREATE TRIGGER billing_checkout_intents_set_updated_at
  BEFORE UPDATE ON public.billing_checkout_intents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER billing_subscriptions_set_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER billing_entitlements_set_updated_at
  BEFORE UPDATE ON public.billing_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.billing_checkout_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their billing checkout intents"
  ON public.billing_checkout_intents FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users read their billing webhook receipts"
  ON public.billing_webhook_receipts FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users read their billing payment events"
  ON public.billing_payment_events FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users read their billing subscriptions"
  ON public.billing_subscriptions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users read their billing entitlements"
  ON public.billing_entitlements FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.billing_checkout_intents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.billing_webhook_receipts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.billing_payment_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.billing_subscriptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.billing_entitlements FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.billing_checkout_intents TO authenticated, service_role;
GRANT SELECT ON TABLE public.billing_webhook_receipts TO authenticated, service_role;
GRANT SELECT ON TABLE public.billing_payment_events TO authenticated, service_role;
GRANT SELECT ON TABLE public.billing_subscriptions TO authenticated, service_role;
GRANT SELECT ON TABLE public.billing_entitlements TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.xeomx_reject_billing_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'XEOMX_BILLING_LEDGER_IMMUTABLE';
END;
$$;

CREATE TRIGGER billing_webhook_receipts_immutable
  BEFORE UPDATE OR DELETE ON public.billing_webhook_receipts
  FOR EACH ROW EXECUTE FUNCTION private.xeomx_reject_billing_ledger_mutation();
CREATE TRIGGER billing_payment_events_immutable
  BEFORE UPDATE OR DELETE ON public.billing_payment_events
  FOR EACH ROW EXECUTE FUNCTION private.xeomx_reject_billing_ledger_mutation();

REVOKE ALL ON FUNCTION private.xeomx_reject_billing_ledger_mutation()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.xeomx_reject_billing_ledger_mutation()
  TO service_role;

CREATE OR REPLACE FUNCTION public.xeomx_create_billing_checkout_intent(
  p_user_id UUID,
  p_project_id UUID,
  p_product_key TEXT,
  p_amount_minor BIGINT,
  p_currency TEXT,
  p_provider TEXT,
  p_idempotency_key TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (checkout_intent_id UUID, checkout_status TEXT, created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_intent public.billing_checkout_intents%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_UNAUTHENTICATED';
  END IF;
  IF p_provider IS NULL OR btrim(p_provider) = '' THEN
    RAISE EXCEPTION USING MESSAGE = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
  END IF;
  IF p_product_key IS NULL OR char_length(p_product_key) NOT BETWEEN 1 AND 160
    OR p_amount_minor IS NULL OR p_amount_minor < 0
    OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$'
    OR p_idempotency_key IS NULL OR char_length(p_idempotency_key) NOT BETWEEN 8 AND 250
    OR jsonb_typeof(p_metadata) <> 'object'
    OR NOT private.xeomx_billing_metadata_is_safe(p_metadata)
  THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_BILLING_VALIDATION_FAILED';
  END IF;

  IF p_project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id AND p.owner_id = p_user_id
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_FORBIDDEN';
  END IF;

  PERFORM private.xeomx_billing_lock(
    'checkout-request:' || p_user_id::TEXT || ':' || p_idempotency_key
  );

  SELECT * INTO v_intent
  FROM public.billing_checkout_intents i
  WHERE i.user_id = p_user_id AND i.idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_intent.product_key <> p_product_key
      OR v_intent.amount_minor <> p_amount_minor
      OR v_intent.currency <> p_currency
      OR v_intent.provider <> p_provider
      OR v_intent.project_id IS DISTINCT FROM p_project_id
      OR v_intent.metadata IS DISTINCT FROM p_metadata
    THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_BILLING_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN QUERY SELECT v_intent.id, v_intent.status, false;
    RETURN;
  END IF;

  INSERT INTO public.billing_checkout_intents (
    user_id,
    project_id,
    product_key,
    amount_minor,
    currency,
    provider,
    status,
    idempotency_key,
    metadata
  ) VALUES (
    p_user_id,
    p_project_id,
    p_product_key,
    p_amount_minor,
    p_currency,
    p_provider,
    'created',
    p_idempotency_key,
    p_metadata
  ) RETURNING * INTO v_intent;

  INSERT INTO public.audit_events (
    actor_id, project_id, event_type, target_type, target_id, result, policy_context
  ) VALUES (
    p_user_id,
    p_project_id,
    'billing.checkout_intent.created',
    'billing_checkout_intent',
    v_intent.id,
    'submitted',
    jsonb_build_object('boundary', 'service-role-only', 'provider', p_provider)
  );

  RETURN QUERY SELECT v_intent.id, v_intent.status, true;
END;
$$;

CREATE OR REPLACE FUNCTION public.xeomx_transition_billing_checkout_intent(
  p_checkout_intent_id UUID,
  p_next_status TEXT,
  p_provider_session_id TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_failure_code TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_intent public.billing_checkout_intents%ROWTYPE;
BEGIN
  IF p_checkout_intent_id IS NULL
    OR p_next_status IS NULL OR p_next_status NOT IN (
      'created', 'provider_pending', 'session_created', 'completed',
      'failed', 'cancelled', 'expired'
    )
    OR (p_provider_session_id IS NOT NULL
      AND char_length(p_provider_session_id) NOT BETWEEN 1 AND 240)
    OR (p_failure_code IS NOT NULL AND char_length(p_failure_code) > 100)
  THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_BILLING_VALIDATION_FAILED';
  END IF;

  PERFORM private.xeomx_billing_lock('checkout:' || p_checkout_intent_id::TEXT);
  SELECT * INTO v_intent
  FROM public.billing_checkout_intents i
  WHERE i.id = p_checkout_intent_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_CHECKOUT_INTENT_NOT_FOUND';
  END IF;

  IF p_next_status = 'session_created' AND p_provider_session_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_PROVIDER_SESSION_REQUIRED';
  END IF;
  IF p_next_status = 'failed'
    AND (p_failure_code IS NULL OR btrim(p_failure_code) = '') THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_BILLING_FAILURE_CODE_REQUIRED';
  END IF;

  IF v_intent.status = p_next_status THEN
    IF p_provider_session_id IS NOT NULL
      AND v_intent.provider_session_id IS DISTINCT FROM p_provider_session_id
      OR p_failure_code IS NOT NULL
      AND v_intent.failure_code IS DISTINCT FROM p_failure_code
      OR p_expires_at IS NOT NULL
      AND v_intent.expires_at IS DISTINCT FROM p_expires_at THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_BILLING_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN true;
  END IF;

  IF NOT (
    (v_intent.status = 'created'
      AND p_next_status IN ('provider_pending', 'failed', 'cancelled'))
    OR (v_intent.status = 'provider_pending'
      AND p_next_status IN ('session_created', 'failed', 'cancelled'))
    OR (v_intent.status = 'session_created'
      AND p_next_status IN ('completed', 'failed', 'cancelled', 'expired'))
    OR (v_intent.status = 'failed'
      AND p_next_status IN ('provider_pending', 'cancelled'))
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_INVALID_BILLING_TRANSITION';
  END IF;

  IF v_intent.provider_session_id IS NOT NULL
    AND p_provider_session_id IS NOT NULL
    AND v_intent.provider_session_id <> p_provider_session_id THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_BILLING_IDEMPOTENCY_CONFLICT';
  END IF;

  UPDATE public.billing_checkout_intents
  SET status = p_next_status,
      provider_session_id = CASE
        WHEN p_next_status = 'session_created'
          THEN COALESCE(provider_session_id, p_provider_session_id)
        ELSE provider_session_id
      END,
      expires_at = COALESCE(p_expires_at, expires_at),
      failure_code = CASE WHEN p_next_status = 'failed' THEN p_failure_code ELSE NULL END,
      completed_at = CASE
        WHEN p_next_status IN ('completed', 'failed', 'cancelled', 'expired') THEN now()
        ELSE NULL
      END,
      updated_at = now()
  WHERE id = p_checkout_intent_id;

  INSERT INTO public.audit_events (
    actor_id, project_id, event_type, target_type, target_id, result, policy_context, metadata
  ) VALUES (
    v_intent.user_id,
    v_intent.project_id,
    'billing.checkout_intent.' || p_next_status,
    'billing_checkout_intent',
    p_checkout_intent_id,
    CASE WHEN p_next_status = 'cancelled' THEN 'cancelled'
      WHEN p_next_status = 'failed' THEN 'failed' ELSE 'succeeded' END,
    jsonb_build_object('boundary', 'service-role-only'),
    jsonb_build_object('previous_status', v_intent.status, 'next_status', p_next_status)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.xeomx_record_verified_billing_event(
  p_user_id UUID,
  p_checkout_intent_id UUID,
  p_provider TEXT,
  p_provider_event_id TEXT,
  p_event_type TEXT,
  p_payload_digest TEXT,
  p_signature_verified BOOLEAN,
  p_verification_method TEXT,
  p_amount_minor BIGINT,
  p_currency TEXT,
  p_occurred_at TIMESTAMPTZ,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (payment_event_id UUID, created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_intent public.billing_checkout_intents%ROWTYPE;
  v_receipt public.billing_webhook_receipts%ROWTYPE;
  v_event public.billing_payment_events%ROWTYPE;
BEGIN
  IF p_signature_verified IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_PAYMENT_WEBHOOK_UNVERIFIED';
  END IF;
  IF p_user_id IS NULL OR p_checkout_intent_id IS NULL
    OR p_provider IS NULL OR char_length(p_provider) NOT BETWEEN 1 AND 80
    OR p_provider_event_id IS NULL OR char_length(p_provider_event_id) NOT BETWEEN 1 AND 240
    OR p_payload_digest IS NULL OR char_length(p_payload_digest) NOT BETWEEN 32 AND 160
    OR p_verification_method IS NULL
    OR char_length(p_verification_method) NOT BETWEEN 1 AND 80
    OR p_event_type IS NULL OR p_event_type NOT IN (
      'payment_pending',
      'payment_confirmed',
      'payment_failed',
      'payment_cancelled',
      'refund_pending',
      'refund_confirmed',
      'refund_failed',
      'subscription_created',
      'subscription_updated',
      'subscription_cancelled'
    )
    OR p_occurred_at IS NULL
    OR (p_amount_minor IS NOT NULL AND p_amount_minor < 0)
    OR (p_amount_minor IS NOT NULL AND p_currency !~ '^[A-Z]{3}$')
    OR jsonb_typeof(p_metadata) <> 'object'
    OR NOT private.xeomx_billing_metadata_is_safe(p_metadata)
  THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_BILLING_VALIDATION_FAILED';
  END IF;

  PERFORM private.xeomx_billing_lock(
    'provider-event:' || p_provider || ':' || p_provider_event_id
  );
  PERFORM private.xeomx_billing_lock('checkout:' || p_checkout_intent_id::TEXT);

  SELECT * INTO v_intent
  FROM public.billing_checkout_intents i
  WHERE i.id = p_checkout_intent_id
  FOR UPDATE;
  IF NOT FOUND OR v_intent.user_id <> p_user_id OR v_intent.provider <> p_provider THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_FORBIDDEN';
  END IF;

  SELECT * INTO v_receipt
  FROM public.billing_webhook_receipts r
  WHERE r.provider = p_provider AND r.provider_event_id = p_provider_event_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_receipt.user_id <> p_user_id
      OR v_receipt.checkout_intent_id <> p_checkout_intent_id
      OR v_receipt.payload_digest <> p_payload_digest
      OR v_receipt.signature_verified IS DISTINCT FROM true
      OR v_receipt.verification_method <> p_verification_method
    THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_BILLING_IDEMPOTENCY_CONFLICT';
    END IF;
  ELSE
    INSERT INTO public.billing_webhook_receipts (
      user_id,
      checkout_intent_id,
      provider,
      provider_event_id,
      payload_digest,
      signature_verified,
      verification_method
    ) VALUES (
      p_user_id,
      p_checkout_intent_id,
      p_provider,
      p_provider_event_id,
      p_payload_digest,
      true,
      p_verification_method
    ) RETURNING * INTO v_receipt;
  END IF;

  SELECT * INTO v_event
  FROM public.billing_payment_events e
  WHERE e.provider = p_provider AND e.provider_event_id = p_provider_event_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_event.user_id <> p_user_id
      OR v_event.checkout_intent_id <> p_checkout_intent_id
      OR v_event.webhook_receipt_id <> v_receipt.id
      OR v_event.event_type <> p_event_type
      OR v_event.payload_digest <> p_payload_digest
      OR v_event.amount_minor IS DISTINCT FROM p_amount_minor
      OR v_event.currency IS DISTINCT FROM p_currency
      OR v_event.occurred_at IS DISTINCT FROM p_occurred_at
      OR v_event.metadata IS DISTINCT FROM p_metadata
    THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_BILLING_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN QUERY SELECT v_event.id, false;
    RETURN;
  END IF;

  INSERT INTO public.billing_payment_events (
    user_id,
    checkout_intent_id,
    webhook_receipt_id,
    provider,
    provider_event_id,
    event_type,
    signature_verified,
    amount_minor,
    currency,
    payload_digest,
    metadata,
    occurred_at
  ) VALUES (
    p_user_id,
    p_checkout_intent_id,
    v_receipt.id,
    p_provider,
    p_provider_event_id,
    p_event_type,
    true,
    p_amount_minor,
    p_currency,
    p_payload_digest,
    p_metadata,
    p_occurred_at
  ) RETURNING * INTO v_event;

  INSERT INTO public.audit_events (
    actor_id, project_id, event_type, target_type, target_id,
    result, policy_context, metadata
  ) VALUES (
    p_user_id,
    v_intent.project_id,
    'billing.payment_event.recorded',
    'billing_payment_event',
    v_event.id,
    'succeeded',
    jsonb_build_object('boundary', 'verified-webhook'),
    jsonb_build_object('provider', p_provider, 'event_type', p_event_type)
  );

  RETURN QUERY SELECT v_event.id, true;
END;
$$;

CREATE OR REPLACE FUNCTION public.xeomx_upsert_billing_subscription(
  p_user_id UUID,
  p_checkout_intent_id UUID,
  p_source_payment_event_id UUID,
  p_provider TEXT,
  p_provider_subscription_id TEXT,
  p_plan_key TEXT,
  p_status TEXT,
  p_cancel_at_period_end BOOLEAN,
  p_current_period_start TIMESTAMPTZ,
  p_current_period_end TIMESTAMPTZ,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event public.billing_payment_events%ROWTYPE;
  v_subscription public.billing_subscriptions%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_checkout_intent_id IS NULL OR p_source_payment_event_id IS NULL
    OR p_provider IS NULL OR char_length(p_provider) NOT BETWEEN 1 AND 80
    OR p_provider_subscription_id IS NULL
    OR char_length(p_provider_subscription_id) NOT BETWEEN 1 AND 240
    OR p_plan_key IS NULL OR char_length(p_plan_key) NOT BETWEEN 1 AND 160
    OR p_cancel_at_period_end IS NULL
    OR p_status IS NULL OR p_status NOT IN (
      'pending', 'trialing', 'active', 'past_due', 'cancelled', 'expired', 'refunded', 'failed'
    )
    OR jsonb_typeof(p_metadata) <> 'object'
    OR NOT private.xeomx_billing_metadata_is_safe(p_metadata)
    OR (
      p_current_period_start IS NOT NULL
      AND p_current_period_end IS NOT NULL
      AND p_current_period_end <= p_current_period_start
    )
  THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_BILLING_VALIDATION_FAILED';
  END IF;

  PERFORM private.xeomx_billing_lock(
    'provider-subscription:' || p_provider || ':' || p_provider_subscription_id
  );
  PERFORM private.xeomx_billing_lock('checkout:' || p_checkout_intent_id::TEXT);

  SELECT * INTO v_event
  FROM public.billing_payment_events e
  WHERE e.id = p_source_payment_event_id
  FOR UPDATE;
  IF NOT FOUND
    OR v_event.signature_verified IS DISTINCT FROM true
    OR v_event.user_id <> p_user_id
    OR v_event.checkout_intent_id <> p_checkout_intent_id
    OR v_event.provider <> p_provider
  THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_PAYMENT_CONFIRMATION_REQUIRED';
  END IF;
  IF p_status IN ('active', 'trialing') AND v_event.event_type <> 'payment_confirmed' THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_PAYMENT_CONFIRMATION_REQUIRED';
  END IF;
  IF p_status = 'refunded' AND v_event.event_type <> 'refund_confirmed' THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_REFUND_CONFIRMATION_REQUIRED';
  END IF;

  SELECT * INTO v_subscription
  FROM public.billing_subscriptions s
  WHERE s.provider = p_provider
    AND s.provider_subscription_id = p_provider_subscription_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_subscription.user_id <> p_user_id
      OR v_subscription.checkout_intent_id <> p_checkout_intent_id THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_FORBIDDEN';
    END IF;
    IF v_subscription.status <> p_status AND NOT (
      (v_subscription.status = 'pending'
        AND p_status IN ('trialing', 'active', 'failed', 'cancelled'))
      OR (v_subscription.status = 'trialing'
        AND p_status IN ('active', 'past_due', 'cancelled', 'expired'))
      OR (v_subscription.status = 'active'
        AND p_status IN ('past_due', 'cancelled', 'expired', 'refunded'))
      OR (v_subscription.status = 'past_due'
        AND p_status IN ('active', 'cancelled', 'expired', 'refunded'))
      OR (v_subscription.status = 'cancelled' AND p_status = 'refunded')
      OR (v_subscription.status = 'failed' AND p_status IN ('pending', 'cancelled'))
    ) THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_INVALID_BILLING_TRANSITION';
    END IF;

    UPDATE public.billing_subscriptions
    SET source_payment_event_id = p_source_payment_event_id,
        plan_key = p_plan_key,
        status = p_status,
        cancel_at_period_end = p_cancel_at_period_end,
        cancelled_at = CASE
          WHEN p_status = 'cancelled' THEN COALESCE(cancelled_at, now())
          ELSE cancelled_at
        END,
        current_period_start = p_current_period_start,
        current_period_end = p_current_period_end,
        metadata = p_metadata,
        updated_at = now()
    WHERE id = v_subscription.id
    RETURNING * INTO v_subscription;
  ELSE
    INSERT INTO public.billing_subscriptions (
      user_id, checkout_intent_id, source_payment_event_id, provider,
      provider_subscription_id, plan_key, status, cancel_at_period_end,
      cancelled_at, current_period_start, current_period_end, metadata
    ) VALUES (
      p_user_id, p_checkout_intent_id, p_source_payment_event_id, p_provider,
      p_provider_subscription_id, p_plan_key, p_status, p_cancel_at_period_end,
      CASE WHEN p_status = 'cancelled' THEN now() ELSE NULL END,
      p_current_period_start, p_current_period_end, p_metadata
    ) RETURNING * INTO v_subscription;
  END IF;

  INSERT INTO public.audit_events (
    actor_id, event_type, target_type, target_id, result, policy_context, metadata
  ) VALUES (
    p_user_id,
    'billing.subscription.' || p_status,
    'billing_subscription',
    v_subscription.id,
    CASE WHEN p_status = 'cancelled' THEN 'cancelled'
      WHEN p_status = 'failed' THEN 'failed' ELSE 'succeeded' END,
    jsonb_build_object('boundary', 'verified-payment-event'),
    jsonb_build_object('provider', p_provider, 'status', p_status)
  );

  RETURN v_subscription.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.xeomx_create_pending_billing_entitlement(
  p_user_id UUID,
  p_checkout_intent_id UUID,
  p_subscription_id UUID,
  p_entitlement_key TEXT,
  p_resource_type TEXT,
  p_resource_ref TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (entitlement_id UUID, created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entitlement public.billing_entitlements%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_checkout_intent_id IS NULL
    OR p_entitlement_key IS NULL OR char_length(p_entitlement_key) NOT BETWEEN 1 AND 160
    OR p_resource_type IS NULL OR char_length(p_resource_type) NOT BETWEEN 1 AND 80
    OR p_resource_ref IS NULL OR char_length(p_resource_ref) NOT BETWEEN 1 AND 240
    OR jsonb_typeof(p_metadata) <> 'object'
    OR NOT private.xeomx_billing_metadata_is_safe(p_metadata)
  THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_BILLING_VALIDATION_FAILED';
  END IF;

  PERFORM private.xeomx_billing_lock(
    'entitlement:' || p_user_id::TEXT || ':' || p_entitlement_key || ':'
      || p_resource_type || ':' || p_resource_ref
  );
  PERFORM private.xeomx_billing_lock('checkout:' || p_checkout_intent_id::TEXT);

  PERFORM 1 FROM public.billing_checkout_intents i
  WHERE i.id = p_checkout_intent_id AND i.user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_FORBIDDEN';
  END IF;

  IF p_subscription_id IS NOT NULL THEN
    PERFORM 1 FROM public.billing_subscriptions s
    WHERE s.id = p_subscription_id
      AND s.user_id = p_user_id
      AND s.checkout_intent_id = p_checkout_intent_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_FORBIDDEN';
    END IF;
  END IF;

  SELECT * INTO v_entitlement
  FROM public.billing_entitlements e
  WHERE e.user_id = p_user_id
    AND e.entitlement_key = p_entitlement_key
    AND e.resource_type = p_resource_type
    AND e.resource_ref = p_resource_ref
  FOR UPDATE;
  IF FOUND THEN
    IF v_entitlement.checkout_intent_id <> p_checkout_intent_id
      OR v_entitlement.subscription_id IS DISTINCT FROM p_subscription_id
      OR v_entitlement.metadata IS DISTINCT FROM p_metadata
    THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_BILLING_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN QUERY SELECT v_entitlement.id, false;
    RETURN;
  END IF;

  INSERT INTO public.billing_entitlements (
    user_id,
    checkout_intent_id,
    subscription_id,
    entitlement_key,
    resource_type,
    resource_ref,
    status,
    metadata
  ) VALUES (
    p_user_id,
    p_checkout_intent_id,
    p_subscription_id,
    p_entitlement_key,
    p_resource_type,
    p_resource_ref,
    'pending',
    p_metadata
  ) RETURNING * INTO v_entitlement;

  RETURN QUERY SELECT v_entitlement.id, true;
END;
$$;

CREATE OR REPLACE FUNCTION public.xeomx_activate_billing_entitlement(
  p_entitlement_id UUID,
  p_payment_event_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entitlement public.billing_entitlements%ROWTYPE;
  v_event public.billing_payment_events%ROWTYPE;
  v_checkout_intent_id UUID;
BEGIN
  SELECT e.checkout_intent_id INTO v_checkout_intent_id
  FROM public.billing_entitlements e
  WHERE e.id = p_entitlement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_ENTITLEMENT_NOT_FOUND';
  END IF;

  PERFORM private.xeomx_billing_lock('checkout:' || v_checkout_intent_id::TEXT);
  SELECT * INTO v_entitlement
  FROM public.billing_entitlements e
  WHERE e.id = p_entitlement_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_ENTITLEMENT_NOT_FOUND';
  END IF;

  SELECT * INTO v_event
  FROM public.billing_payment_events e
  WHERE e.id = p_payment_event_id
  FOR UPDATE;
  IF NOT FOUND
    OR v_event.signature_verified IS DISTINCT FROM true
    OR v_event.event_type <> 'payment_confirmed'
    OR v_event.user_id <> v_entitlement.user_id
    OR v_event.checkout_intent_id <> v_entitlement.checkout_intent_id
  THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_PAYMENT_CONFIRMATION_REQUIRED';
  END IF;

  IF v_entitlement.status = 'active' THEN
    IF v_entitlement.activation_payment_event_id = p_payment_event_id THEN
      RETURN true;
    END IF;
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_BILLING_IDEMPOTENCY_CONFLICT';
  END IF;
  IF v_entitlement.status NOT IN ('pending', 'suspended') THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_INVALID_ENTITLEMENT_TRANSITION';
  END IF;

  PERFORM 1
  FROM public.billing_payment_events adverse
  WHERE adverse.checkout_intent_id = v_entitlement.checkout_intent_id
    AND adverse.event_type IN ('payment_cancelled', 'refund_confirmed')
  FOR UPDATE;
  IF FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_PAYMENT_NO_LONGER_ELIGIBLE';
  END IF;

  UPDATE public.billing_entitlements
  SET status = 'active',
      activation_payment_event_id = p_payment_event_id,
      valid_from = COALESCE(valid_from, now()),
      revocation_reason = NULL,
      updated_at = now()
  WHERE id = p_entitlement_id;

  INSERT INTO public.audit_events (
    actor_id, event_type, target_type, target_id, result, policy_context, metadata
  ) VALUES (
    v_entitlement.user_id,
    'billing.entitlement.activated',
    'billing_entitlement',
    p_entitlement_id,
    'succeeded',
    jsonb_build_object('boundary', 'confirmed-payment-event'),
    jsonb_build_object('payment_event_id', p_payment_event_id)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.xeomx_set_billing_entitlement_status(
  p_entitlement_id UUID,
  p_status TEXT,
  p_source_payment_event_id UUID,
  p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entitlement public.billing_entitlements%ROWTYPE;
  v_event public.billing_payment_events%ROWTYPE;
  v_checkout_intent_id UUID;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('suspended', 'revoked', 'expired', 'refunded')
    OR p_reason IS NULL OR char_length(p_reason) NOT BETWEEN 1 AND 240
  THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_BILLING_VALIDATION_FAILED';
  END IF;

  SELECT e.checkout_intent_id INTO v_checkout_intent_id
  FROM public.billing_entitlements e
  WHERE e.id = p_entitlement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_ENTITLEMENT_NOT_FOUND';
  END IF;

  PERFORM private.xeomx_billing_lock('checkout:' || v_checkout_intent_id::TEXT);
  SELECT * INTO v_entitlement
  FROM public.billing_entitlements e
  WHERE e.id = p_entitlement_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_ENTITLEMENT_NOT_FOUND';
  END IF;
  IF v_entitlement.status IN ('revoked', 'expired', 'refunded') THEN
    RETURN v_entitlement.status = p_status;
  END IF;

  IF p_status = 'refunded' THEN
    SELECT * INTO v_event
    FROM public.billing_payment_events e
    WHERE e.id = p_source_payment_event_id
    FOR UPDATE;
    IF NOT FOUND
      OR v_event.signature_verified IS DISTINCT FROM true
      OR v_event.event_type <> 'refund_confirmed'
      OR v_event.user_id <> v_entitlement.user_id
      OR v_event.checkout_intent_id <> v_entitlement.checkout_intent_id
    THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_REFUND_CONFIRMATION_REQUIRED';
    END IF;
  END IF;

  UPDATE public.billing_entitlements
  SET status = p_status,
      revocation_reason = p_reason,
      valid_until = CASE WHEN p_status IN ('revoked', 'expired', 'refunded')
        THEN COALESCE(valid_until, now()) ELSE valid_until END,
      updated_at = now()
  WHERE id = p_entitlement_id;

  INSERT INTO public.audit_events (
    actor_id, event_type, target_type, target_id, result, policy_context, metadata
  ) VALUES (
    v_entitlement.user_id,
    'billing.entitlement.' || p_status,
    'billing_entitlement',
    p_entitlement_id,
    'succeeded',
    jsonb_build_object('boundary', 'service-role-only'),
    jsonb_build_object('source_payment_event_id', p_source_payment_event_id)
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.xeomx_create_billing_checkout_intent(
  UUID, UUID, TEXT, BIGINT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xeomx_transition_billing_checkout_intent(
  UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xeomx_record_verified_billing_event(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, BIGINT, TEXT, TIMESTAMPTZ, JSONB
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xeomx_upsert_billing_subscription(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, JSONB
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xeomx_create_pending_billing_entitlement(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xeomx_activate_billing_entitlement(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xeomx_set_billing_entitlement_status(UUID, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.xeomx_create_billing_checkout_intent(
  UUID, UUID, TEXT, BIGINT, TEXT, TEXT, TEXT, JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION public.xeomx_transition_billing_checkout_intent(
  UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.xeomx_record_verified_billing_event(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, BIGINT, TEXT, TIMESTAMPTZ, JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION public.xeomx_upsert_billing_subscription(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION public.xeomx_create_pending_billing_entitlement(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION public.xeomx_activate_billing_entitlement(UUID, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.xeomx_set_billing_entitlement_status(
  UUID, TEXT, UUID, TEXT
) TO service_role;
