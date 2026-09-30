-- FI5 MIGRATION_SOURCE_ONLY. Never applied to a hosted database by this sprint.
-- Reuse billing checkout/events/entitlements, approval_requests, audit_events and FI4 identities.
BEGIN;
CREATE TABLE public.marketplace_publishers (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id), state text NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','ACTIVE','RESTRICTED','SUSPENDED','DEPRECATED')),
 identity_state text NOT NULL DEFAULT 'NOT_VERIFIED', commerce_eligible boolean NOT NULL DEFAULT false,
 payout_eligible boolean NOT NULL DEFAULT false, verification_reference text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT payout_eligible OR (identity_state='VERIFIED' AND verification_reference IS NOT NULL))
);
CREATE TABLE public.marketplace_drafts (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES auth.users(id), entry jsonb NOT NULL, price jsonb NOT NULL,
 stage text NOT NULL DEFAULT 'DRAFT' CHECK(stage IN ('DRAFT','VALIDATION','READY','PUBLISHED','VALIDATION_FAILED','REVIEW_REQUIRED','REJECTED')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.marketplace_prices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version_id uuid NOT NULL REFERENCES public.marketplace_versions(id),
 snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX marketplace_price_version ON public.marketplace_prices(version_id,created_at DESC);
ALTER TABLE public.marketplace_packages ADD COLUMN lifecycle text NOT NULL DEFAULT 'ACTIVE' CHECK(lifecycle IN ('ACTIVE','DEPRECATED','WITHDRAWN','SECURITY_BLOCKED'));
ALTER TABLE public.marketplace_listings DROP CONSTRAINT marketplace_listings_state_check;
ALTER TABLE public.marketplace_listings ADD CONSTRAINT marketplace_listings_state_check CHECK(state IN ('published','suspended','deprecated','withdrawn','security_blocked'));
-- Acquisitions are Marketplace-specific snapshots anchored to the existing billing transaction.
CREATE TABLE public.marketplace_acquisitions (
 id uuid PRIMARY KEY REFERENCES public.billing_checkout_intents(id), version_id uuid NOT NULL REFERENCES public.marketplace_versions(id),
 buyer_id uuid NOT NULL REFERENCES auth.users(id), publisher_id uuid NOT NULL REFERENCES auth.users(id), project_id uuid NOT NULL REFERENCES public.projects(id),
 price jsonb NOT NULL, license jsonb NOT NULL, digest text NOT NULL, request_hash text NOT NULL,
 entitlement_id uuid REFERENCES public.billing_entitlements(id), phase text NOT NULL CHECK(phase IN ('WAITING_APPROVAL','PROVIDER_PENDING','SETTLED','FAILED','CANCELLED','REFUNDED','PARTIALLY_REFUNDED')),
 approval_id uuid REFERENCES public.approval_requests(id), fee_bps int CHECK(fee_bps BETWEEN 0 AND 10000), created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.billing_entitlements ADD COLUMN marketplace_free boolean NOT NULL DEFAULT false;
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.billing_entitlements'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%activation_payment_event_id%' LOOP
 EXECUTE format('ALTER TABLE public.billing_entitlements DROP CONSTRAINT %I',c.conname); END LOOP;
END $$;
ALTER TABLE public.billing_entitlements ADD CONSTRAINT entitlement_authoritative_activation CHECK(status<>'active' OR activation_payment_event_id IS NOT NULL OR marketplace_free);
CREATE FUNCTION private.fi5_free_entitlement_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NEW.marketplace_free AND NOT EXISTS(SELECT 1 FROM public.marketplace_acquisitions a JOIN public.billing_checkout_intents i ON i.id=a.id WHERE a.id=NEW.checkout_intent_id AND a.buyer_id=NEW.user_id AND a.phase='SETTLED' AND i.amount_minor=0 AND a.price->>'billing_model'='FREE') THEN RAISE EXCEPTION 'AUTHORITATIVE_FREE_ACQUISITION_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fi5_free_entitlement_guard BEFORE INSERT OR UPDATE ON public.billing_entitlements FOR EACH ROW EXECUTE FUNCTION private.fi5_free_entitlement_guard();
CREATE TABLE public.marketplace_adjustments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), acquisition_id uuid NOT NULL REFERENCES public.marketplace_acquisitions(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id), kind text NOT NULL CHECK(kind IN ('REFUND','DISPUTE')),
 state text NOT NULL CHECK(state IN ('REQUESTED','UNDER_REVIEW','APPROVED','REJECTED','PROVIDER_PENDING','REFUNDED','FAILED','OPEN','EVIDENCE_REQUIRED','RESOLVED_BUYER','RESOLVED_CREATOR','CLOSED')),
 amount bigint NOT NULL CHECK(amount>=0), currency text NOT NULL, reason text NOT NULL CHECK(length(reason) BETWEEN 2 AND 1000), evidence jsonb NOT NULL DEFAULT '[]',
 idempotency_key text NOT NULL, request_hash text NOT NULL, approval_id uuid REFERENCES public.approval_requests(id),
 provider text NOT NULL DEFAULT 'NOT_CONFIGURED', provider_reference text, execution_claimed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(actor_id,kind,idempotency_key)
);
CREATE INDEX marketplace_adjustments_transaction ON public.marketplace_adjustments(acquisition_id);
CREATE TABLE public.marketplace_earnings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), acquisition_id uuid NOT NULL REFERENCES public.marketplace_acquisitions(id), publisher_id uuid NOT NULL REFERENCES auth.users(id),
 source_event_id uuid NOT NULL UNIQUE REFERENCES public.billing_payment_events(id), kind text NOT NULL CHECK(kind IN ('SALE','REFUND','DISPUTE_ADJUSTMENT')),
 gross bigint NOT NULL, platform_fee bigint, creator_net bigint, currency text NOT NULL,
 state text NOT NULL CHECK(state IN ('PENDING','AVAILABLE','HELD','REVERSED','PAID')),
 created_at timestamptz NOT NULL DEFAULT now(), CHECK(platform_fee IS NULL OR creator_net+platform_fee=gross)
);
CREATE INDEX marketplace_earning_owner ON public.marketplace_earnings(publisher_id,acquisition_id);
CREATE TABLE public.marketplace_payouts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), publisher_id uuid NOT NULL REFERENCES auth.users(id),project_id uuid NOT NULL REFERENCES public.projects(id),
 amount bigint NOT NULL CHECK(amount>0),currency text NOT NULL,state text NOT NULL CHECK(state IN ('DRAFT','ELIGIBILITY_REQUIRED','READY','PROVIDER_PENDING','PAID','FAILED','CANCELLED')),
 eligibility_snapshot jsonb NOT NULL,approval_id uuid REFERENCES public.approval_requests(id),provider text NOT NULL DEFAULT 'NOT_CONFIGURED',provider_reference text,
 idempotency_key text NOT NULL,request_hash text NOT NULL,execution_claimed boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(publisher_id,idempotency_key)
);
CREATE TABLE public.marketplace_payout_items (payout_id uuid NOT NULL REFERENCES public.marketplace_payouts(id),earning_id uuid NOT NULL REFERENCES public.marketplace_earnings(id),active boolean NOT NULL DEFAULT true, PRIMARY KEY(payout_id,earning_id));
CREATE UNIQUE INDEX marketplace_earning_reservation ON public.marketplace_payout_items(earning_id) WHERE active;
CREATE TABLE public.marketplace_settlement_receipts (
 provider text NOT NULL,event_id text NOT NULL,entity_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('refund','payout')),payload_digest text NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 processing_state text NOT NULL CHECK(processing_state='PROCESSED'),record jsonb NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(provider,event_id)
);
CREATE TABLE public.marketplace_enterprise_policies (
 project_id uuid PRIMARY KEY REFERENCES public.projects(id), policy jsonb NOT NULL, updated_by uuid NOT NULL REFERENCES auth.users(id),updated_at timestamptz NOT NULL DEFAULT now()
);
-- Immutable acquisition terms and append-oriented financial evidence.
CREATE FUNCTION private.fi5_snapshot_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'COMMERCE_HISTORY_IMMUTABLE'; END IF;
 IF (TG_TABLE_NAME='marketplace_acquisitions' AND (to_jsonb(OLD)-ARRAY['phase','approval_id','entitlement_id','updated_at']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['phase','approval_id','entitlement_id','updated_at'])) OR
    (TG_TABLE_NAME='marketplace_earnings' AND (to_jsonb(OLD)-'state') IS DISTINCT FROM (to_jsonb(NEW)-'state')) OR
    (TG_TABLE_NAME='marketplace_payouts' AND (to_jsonb(OLD)-ARRAY['state','approval_id','provider','provider_reference','execution_claimed','updated_at']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['state','approval_id','provider','provider_reference','execution_claimed','updated_at'])) THEN RAISE EXCEPTION 'COMMERCE_SNAPSHOT_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fi5_acquisition_snapshot BEFORE UPDATE OR DELETE ON public.marketplace_acquisitions FOR EACH ROW EXECUTE FUNCTION private.fi5_snapshot_guard();
CREATE TRIGGER fi5_earning_snapshot BEFORE UPDATE OR DELETE ON public.marketplace_earnings FOR EACH ROW EXECUTE FUNCTION private.fi5_snapshot_guard();
CREATE TRIGGER fi5_payout_snapshot BEFORE UPDATE OR DELETE ON public.marketplace_payouts FOR EACH ROW EXECUTE FUNCTION private.fi5_snapshot_guard();
CREATE TRIGGER fi5_receipt_immutable BEFORE UPDATE OR DELETE ON public.marketplace_settlement_receipts FOR EACH ROW EXECUTE FUNCTION public.xeomx_marketplace_immutable();
CREATE INDEX fi5_acquisition_buyer_project ON public.marketplace_acquisitions(buyer_id,project_id,created_at DESC);
CREATE INDEX fi5_acquisition_publisher ON public.marketplace_acquisitions(publisher_id,created_at DESC);
CREATE INDEX fi5_draft_owner ON public.marketplace_drafts(owner_id,updated_at DESC);
CREATE INDEX fi5_adjustment_actor ON public.marketplace_adjustments(actor_id,created_at DESC);
CREATE INDEX fi5_payout_project ON public.marketplace_payouts(project_id,publisher_id);
CREATE INDEX fi5_payout_item_earning ON public.marketplace_payout_items(earning_id);

ALTER TABLE public.approval_requests ADD COLUMN commerce_key text UNIQUE;
ALTER TABLE public.approval_requests ALTER COLUMN run_id DROP NOT NULL;
ALTER TABLE public.approval_requests ADD CONSTRAINT approval_subject_required CHECK(run_id IS NOT NULL OR commerce_key IS NOT NULL);
CREATE FUNCTION private.fi5_member(p_actor uuid,p_project uuid,p_write boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.project_members m JOIN public.projects p ON p.id=m.project_id WHERE m.user_id=p_actor AND m.project_id=p_project AND p.status='active' AND (NOT p_write OR m.role IN ('owner','editor')))
$$;
CREATE FUNCTION private.fi5_audit(p_actor uuid,p_project uuid,p_action text,p_id uuid,p_before text,p_after text,p_reason text DEFAULT NULL) RETURNS void LANGUAGE sql SET search_path='' AS $$
 INSERT INTO public.audit_events(actor_id,project_id,event_type,target_type,target_id,result,metadata) VALUES(p_actor,p_project,'marketplace.'||p_action,'marketplace_commerce',p_id,'succeeded',jsonb_build_object('before',p_before,'after',p_after,'reason',left(p_reason,1000)))
$$;
CREATE FUNCTION private.fi5_approval(p_actor uuid,p_project uuid,p_id uuid,p_action text,p_approver uuid) RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE aid uuid; BEGIN
 INSERT INTO public.approval_requests(project_id,requested_by,commerce_key,runtime_key,runtime_record,expires_at)
 VALUES(p_project,p_actor,p_action||':'||p_id,'commerce:'||p_action||':'||p_id,jsonb_build_object('entityId',p_id,'action',p_action,'approver',p_approver),now()+interval '24 hours') ON CONFLICT(commerce_key) DO NOTHING;
 SELECT id INTO aid FROM public.approval_requests WHERE commerce_key=p_action||':'||p_id; RETURN aid;
END $$;
CREATE FUNCTION private.fi5_consume(p_id uuid) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE a public.approval_requests; BEGIN
 SELECT * INTO a FROM public.approval_requests WHERE id=p_id FOR UPDATE;
 IF a.id IS NULL OR a.status<>'approved' OR a.expires_at<=now() OR a.consumed_at IS NOT NULL THEN RAISE EXCEPTION 'APPROVAL_REQUIRED'; END IF;
 UPDATE public.approval_requests SET consumed_at=now() WHERE id=p_id;
END $$;
-- Narrow, service-only RPCs enforce actor/resource authorization again. Clients have SELECT only.
DO $$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['marketplace_publishers','marketplace_drafts','marketplace_prices','marketplace_acquisitions','marketplace_adjustments','marketplace_earnings','marketplace_payouts','marketplace_payout_items','marketplace_settlement_receipts','marketplace_enterprise_policies'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',n);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',n);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',n);
 END LOOP;
END $$;
GRANT SELECT ON public.marketplace_publishers,public.marketplace_drafts,public.marketplace_acquisitions,public.marketplace_adjustments,public.marketplace_earnings,public.marketplace_payouts,public.marketplace_enterprise_policies TO authenticated;
GRANT SELECT ON public.marketplace_prices TO anon,authenticated;
CREATE POLICY fi5_publisher_owner ON public.marketplace_publishers FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY fi5_draft_owner ON public.marketplace_drafts FOR SELECT TO authenticated USING(owner_id=auth.uid());
CREATE POLICY fi5_price_visible ON public.marketplace_prices FOR SELECT TO anon,authenticated USING(public.xeomx_marketplace_visible(version_id));
CREATE POLICY fi5_acquisition_owner ON public.marketplace_acquisitions FOR SELECT TO authenticated USING(buyer_id=auth.uid() AND public.xeomx_project_role(project_id) IS NOT NULL);
CREATE POLICY fi5_adjustment_owner ON public.marketplace_adjustments FOR SELECT TO authenticated USING(actor_id=auth.uid() AND EXISTS(SELECT 1 FROM public.marketplace_acquisitions a WHERE a.id=acquisition_id));
CREATE POLICY fi5_earning_owner ON public.marketplace_earnings FOR SELECT TO authenticated USING(publisher_id=auth.uid());
CREATE POLICY fi5_payout_owner ON public.marketplace_payouts FOR SELECT TO authenticated USING(publisher_id=auth.uid() AND public.xeomx_project_role(project_id) IS NOT NULL);
CREATE POLICY fi5_policy_member ON public.marketplace_enterprise_policies FOR SELECT TO authenticated USING(public.xeomx_project_role(project_id) IS NOT NULL);

REVOKE ALL ON FUNCTION private.fi5_member(uuid,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.fi5_member(uuid,uuid,boolean) TO service_role;
REVOKE ALL ON FUNCTION private.fi5_audit(uuid,uuid,text,uuid,text,text,text),private.fi5_approval(uuid,uuid,uuid,text,uuid),private.fi5_consume(uuid) FROM PUBLIC,anon,authenticated;
-- Existing publish is retained as a private implementation behind governed publishing.
ALTER FUNCTION public.xeomx_marketplace_publish(uuid,jsonb) RENAME TO xeomx_marketplace_publish_fi4;
CREATE FUNCTION public.xeomx_marketplace_publish(p_actor uuid,p_entry jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.marketplace_drafts; out_entry jsonb; BEGIN
 SELECT * INTO d FROM public.marketplace_drafts WHERE id=(p_entry->>'id')::uuid FOR UPDATE;
 IF d.owner_id IS DISTINCT FROM p_actor OR d.stage<>'READY' OR d.entry IS DISTINCT FROM p_entry THEN RAISE EXCEPTION 'GOVERNED_PUBLICATION_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.marketplace_publishers WHERE user_id=p_actor AND state='ACTIVE') THEN RAISE EXCEPTION 'PUBLISHER_INELIGIBLE'; END IF;
 out_entry:=public.xeomx_marketplace_publish_fi4(p_actor,p_entry);
 INSERT INTO public.marketplace_prices(version_id,snapshot) VALUES(d.id,d.price);
 UPDATE public.marketplace_drafts SET stage='PUBLISHED',updated_at=now() WHERE id=d.id;
 RETURN out_entry;
END $$;
REVOKE ALL ON FUNCTION public.xeomx_marketplace_publish(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xeomx_marketplace_publish(uuid,jsonb) TO service_role;
CREATE TRIGGER fi5_price_immutable BEFORE UPDATE OR DELETE ON public.marketplace_prices FOR EACH ROW EXECUTE FUNCTION public.xeomx_marketplace_immutable();
-- Financial mutations share publisher locks, including negative balance adjustments.
-- This is an internal extension of the existing Marketplace RPC, not another payment ledger.
CREATE FUNCTION private.fi5_release_earnings(p_acquisition uuid) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.marketplace_adjustments x WHERE x.acquisition_id=p_acquisition AND ((x.kind='REFUND' AND x.state IN ('REQUESTED','UNDER_REVIEW','APPROVED','PROVIDER_PENDING')) OR (x.kind='DISPUTE' AND x.state IN ('OPEN','EVIDENCE_REQUIRED','UNDER_REVIEW','RESOLVED_BUYER')))) THEN
  UPDATE public.marketplace_earnings e SET state='AVAILABLE' WHERE e.acquisition_id=p_acquisition AND e.state='HELD' AND e.creator_net IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.marketplace_payout_items pi WHERE pi.earning_id=e.id AND pi.active);
 END IF;
END $$;
REVOKE ALL ON FUNCTION private.fi5_release_earnings(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.fi5_finance(p_actor uuid,p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
 v_a public.marketplace_acquisitions; v_i public.billing_checkout_intents; v_r public.marketplace_adjustments;
 v_pay public.marketplace_payouts; v_pub public.marketplace_publishers; v_ap public.approval_requests;
 v_receipt public.marketplace_settlement_receipts; v_event jsonb; v_id uuid; v_event_id uuid;
 v_amount bigint; v_total bigint; v_fee bigint; v_old text; v_target text; v_kind text; v_created boolean; v_claim boolean:=false;
 v_hash text:=p_data->>'_request_hash'; v_key text:=p_data->>'idempotency_key'; v_provider text; v_result jsonb;
BEGIN
 IF p_action IN ('checkout_claim','checkout_reference') THEN
  SELECT * INTO v_a FROM public.marketplace_acquisitions WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF v_a.id IS NULL OR v_a.buyer_id<>p_actor OR NOT private.fi5_member(p_actor,v_a.project_id,true) THEN RAISE EXCEPTION 'TRANSACTION_ACCESS_DENIED'; END IF;
  IF v_a.phase<>'PROVIDER_PENDING' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  SELECT * INTO v_i FROM public.billing_checkout_intents WHERE id=v_a.id FOR UPDATE;
  IF p_action='checkout_claim' THEN
   IF v_i.provider='NOT_CONFIGURED' THEN RETURN jsonb_build_object('id',v_i.id,'provider_status','NOT_CONFIGURED','claimed',false); END IF;
   IF v_i.metadata->>'fi5_checkout_claimed'='true' THEN RETURN jsonb_build_object('id',v_i.id,'provider_status','PENDING_PROVIDER','claimed',false,'checkout_url',v_i.metadata->>'fi5_checkout_url'); END IF;
   IF v_i.provider IS DISTINCT FROM p_data->>'_provider' THEN RAISE EXCEPTION 'PROVIDER_MISMATCH'; END IF;
   UPDATE public.billing_checkout_intents SET metadata=metadata||jsonb_build_object('fi5_checkout_claimed',true) WHERE id=v_i.id;
   RETURN to_jsonb(v_i)||jsonb_build_object('claimed',true);
  END IF;
  IF v_i.provider IS DISTINCT FROM p_data->>'provider' OR v_i.metadata->>'fi5_checkout_claimed' IS DISTINCT FROM 'true' OR v_i.provider_session_id IS NOT NULL THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  UPDATE public.billing_checkout_intents SET provider_session_id=p_data->>'reference',status='session_created',expires_at=(p_data->>'expires_at')::timestamptz,metadata=metadata||jsonb_build_object('fi5_checkout_url',p_data->>'checkout_url') WHERE id=v_i.id;
  PERFORM private.fi5_audit(p_actor,v_a.project_id,'checkout',v_a.id,'PROVIDER_PENDING','SESSION_CREATED');
  RETURN jsonb_build_object('id',v_a.id,'phase','PROVIDER_PENDING','provider_status','AVAILABLE','checkout_url',p_data->>'checkout_url');
 ELSIF p_action='payment_event' THEN
  v_event:=p_data->'event';
  SELECT * INTO v_a FROM public.marketplace_acquisitions WHERE id=(v_event->>'checkoutIntentId')::uuid;
  IF v_a.id IS NULL OR v_a.buyer_id<>p_actor OR v_event->>'userId'<>p_actor::text OR v_event->>'signatureVerified' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'PROVIDER_EVIDENCE_REQUIRED'; END IF;
  PERFORM private.xeomx_billing_lock('fi5-publisher:'||v_a.publisher_id);
  SELECT * INTO v_a FROM public.marketplace_acquisitions WHERE id=v_a.id FOR UPDATE;
  SELECT * INTO v_i FROM public.billing_checkout_intents WHERE id=v_a.id FOR UPDATE;
  IF v_i.provider='NOT_CONFIGURED' OR v_i.provider IS DISTINCT FROM v_event->>'provider' OR v_i.amount_minor IS DISTINCT FROM (v_event#>>'{money,amountMinor}')::bigint OR v_i.currency IS DISTINCT FROM v_event#>>'{money,currency}' THEN RAISE EXCEPTION 'EVENT_BINDING_MISMATCH'; END IF;
  IF v_event->>'eventType' NOT IN ('payment_pending','payment_confirmed','payment_failed','payment_cancelled') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  SELECT payment_event_id,created INTO v_event_id,v_created FROM public.xeomx_record_verified_billing_event(p_actor,v_a.id,v_i.provider,v_event->>'providerEventId',v_event->>'eventType',v_event->>'payloadDigest',true,'provider-adapter',v_i.amount_minor,v_i.currency,(v_event->>'occurredAt')::timestamptz,'{}');
  IF NOT v_created THEN RETURN to_jsonb(v_a); END IF;
  IF v_a.phase<>'PROVIDER_PENDING' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF v_a.price->>'billing_model'='SUBSCRIPTION' AND v_event->>'eventType'='payment_confirmed' THEN RAISE EXCEPTION 'SUBSCRIPTION_PERIOD_EVIDENCE_REQUIRED'; END IF;
  v_target:=CASE v_event->>'eventType' WHEN 'payment_confirmed' THEN 'SETTLED' WHEN 'payment_failed' THEN 'FAILED' WHEN 'payment_cancelled' THEN 'CANCELLED' ELSE 'PROVIDER_PENDING' END;
  UPDATE public.marketplace_acquisitions SET phase=v_target,updated_at=now() WHERE id=v_a.id;
  IF v_target='SETTLED' THEN
   PERFORM public.xeomx_activate_billing_entitlement(v_a.entitlement_id,v_event_id);
   UPDATE public.billing_checkout_intents SET status='completed' WHERE id=v_a.id;
   v_fee:=CASE WHEN v_a.fee_bps IS NULL THEN NULL ELSE floor(v_i.amount_minor::numeric*v_a.fee_bps/10000)::bigint END;
   INSERT INTO public.marketplace_earnings(acquisition_id,publisher_id,source_event_id,kind,gross,platform_fee,creator_net,currency,state)
   VALUES(v_a.id,v_a.publisher_id,v_event_id,'SALE',v_i.amount_minor,v_fee,v_i.amount_minor-v_fee,v_i.currency,CASE WHEN v_fee IS NULL THEN 'HELD' ELSE 'AVAILABLE' END);
  ELSIF v_target IN ('FAILED','CANCELLED') THEN
   UPDATE public.billing_checkout_intents SET status=lower(v_target) WHERE id=v_a.id;
   UPDATE public.billing_entitlements SET status='revoked' WHERE id=v_a.entitlement_id;
  END IF;
  PERFORM private.fi5_audit(p_actor,v_a.project_id,'payment',v_a.id,v_a.phase,v_target,v_event_id::text);
  RETURN (SELECT to_jsonb(x) FROM public.marketplace_acquisitions x WHERE x.id=v_a.id);
 ELSIF p_action IN ('refund','dispute') THEN
  v_kind:=upper(p_action);
  SELECT * INTO v_a FROM public.marketplace_acquisitions WHERE id=(p_data->>'id')::uuid;
  IF v_a.id IS NULL OR v_a.buyer_id<>p_actor OR NOT private.fi5_member(p_actor,v_a.project_id) THEN RAISE EXCEPTION 'TRANSACTION_ACCESS_DENIED'; END IF;
  PERFORM private.xeomx_billing_lock('fi5-publisher:'||v_a.publisher_id);
  SELECT * INTO v_a FROM public.marketplace_acquisitions WHERE id=v_a.id FOR UPDATE;
  SELECT * INTO v_r FROM public.marketplace_adjustments WHERE actor_id=p_actor AND kind=v_kind AND idempotency_key=v_key;
  IF v_r.id IS NOT NULL THEN
   IF v_r.request_hash IS DISTINCT FROM v_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   RETURN to_jsonb(v_r);
  END IF;
  IF v_key IS NULL OR length(v_key)<8 OR v_a.phase NOT IN ('SETTLED','PARTIALLY_REFUNDED') OR v_a.price->>'billing_model'='FREE' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  v_amount:=CASE WHEN v_kind='REFUND' THEN (p_data->>'amount')::bigint ELSE (v_a.price->>'amount')::bigint END;
  IF p_data->>'currency' IS DISTINCT FROM v_a.price->>'currency' THEN RAISE EXCEPTION 'CURRENCY_MISMATCH'; END IF;
  IF jsonb_typeof(coalesce(p_data->'evidence','[]'))<>'array' OR jsonb_array_length(coalesce(p_data->'evidence','[]'))>20 THEN RAISE EXCEPTION 'INVALID_EVIDENCE'; END IF;
  IF EXISTS(SELECT 1 FROM public.marketplace_earnings e JOIN public.marketplace_payout_items pi ON pi.earning_id=e.id JOIN public.marketplace_payouts po ON po.id=pi.payout_id WHERE e.acquisition_id=v_a.id AND pi.active AND po.state IN ('DRAFT','READY','PROVIDER_PENDING')) THEN RAISE EXCEPTION 'PAYOUT_RECONCILIATION_REQUIRED'; END IF;
  SELECT coalesce(sum(x.amount),0) INTO v_total FROM public.marketplace_adjustments x WHERE x.acquisition_id=v_a.id AND x.kind='REFUND' AND x.state NOT IN ('REJECTED','FAILED');
  IF v_amount IS NULL OR v_amount<=0 OR (v_kind='REFUND' AND v_amount+v_total>(v_a.price->>'amount')::bigint) THEN RAISE EXCEPTION 'REFUND_CEILING'; END IF;
  INSERT INTO public.marketplace_adjustments(acquisition_id,actor_id,kind,state,amount,currency,reason,evidence,idempotency_key,request_hash)
  VALUES(v_a.id,p_actor,v_kind,CASE WHEN v_kind='REFUND' THEN 'REQUESTED' ELSE 'OPEN' END,v_amount,p_data->>'currency',p_data->>'reason',coalesce(p_data->'evidence','[]'),v_key,v_hash) RETURNING * INTO v_r;
  IF v_kind='REFUND' THEN
   v_id:=private.fi5_approval(p_actor,v_a.project_id,v_r.id,'refund',v_a.publisher_id);
   UPDATE public.marketplace_adjustments SET approval_id=v_id WHERE id=v_r.id RETURNING * INTO v_r;
  END IF;
  UPDATE public.marketplace_earnings SET state='HELD' WHERE acquisition_id=v_a.id AND state='AVAILABLE';
  PERFORM private.fi5_audit(p_actor,v_a.project_id,p_action,v_r.id,NULL,v_r.state,v_r.reason);
  RETURN to_jsonb(v_r);
 ELSIF p_action IN ('refund_decide','refund_submit','dispute_decide') THEN
  SELECT * INTO v_r FROM public.marketplace_adjustments WHERE id=(p_data->>'id')::uuid;
  SELECT * INTO v_a FROM public.marketplace_acquisitions WHERE id=v_r.acquisition_id;
  IF v_r.id IS NULL OR (p_actor<>v_a.publisher_id AND p_actor<>v_a.buyer_id) OR (p_actor=v_a.buyer_id AND NOT private.fi5_member(p_actor,v_a.project_id)) THEN RAISE EXCEPTION 'ADJUSTMENT_ACCESS_DENIED'; END IF;
  PERFORM private.xeomx_billing_lock('fi5-publisher:'||v_a.publisher_id);
  SELECT * INTO v_r FROM public.marketplace_adjustments WHERE id=v_r.id FOR UPDATE;
  v_old:=v_r.state;
  IF p_action='dispute_decide' THEN
   v_target:=p_data->>'state';
   IF v_r.kind<>'DISPUTE' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
   IF v_target=v_old THEN RETURN to_jsonb(v_r); END IF;
   IF NOT ((v_old='OPEN' AND v_target IN ('EVIDENCE_REQUIRED','UNDER_REVIEW')) OR (v_old='EVIDENCE_REQUIRED' AND v_target='UNDER_REVIEW') OR (v_old='UNDER_REVIEW' AND v_target IN ('RESOLVED_BUYER','RESOLVED_CREATOR')) OR (v_old IN ('RESOLVED_BUYER','RESOLVED_CREATOR') AND v_target='CLOSED')) THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
   -- Without external adjudication, only explicit counterparty concession can resolve.
   IF (v_target='RESOLVED_BUYER' AND p_actor<>v_a.publisher_id) OR (v_target='RESOLVED_CREATOR' AND p_actor<>v_a.buyer_id) THEN RAISE EXCEPTION 'COUNTERPARTY_DECISION_REQUIRED'; END IF;
   IF v_target='CLOSED' AND v_old='RESOLVED_BUYER' AND v_a.phase<>'REFUNDED' THEN RAISE EXCEPTION 'REFUND_RECONCILIATION_REQUIRED'; END IF;
   IF p_data ? 'evidence' AND (jsonb_typeof(p_data->'evidence')<>'array' OR jsonb_array_length(p_data->'evidence')>20) THEN RAISE EXCEPTION 'INVALID_EVIDENCE'; END IF;
   INSERT INTO public.audit_events(actor_id,project_id,event_type,target_type,target_id,result,metadata) VALUES(p_actor,v_a.project_id,'marketplace.dispute_evidence','marketplace_commerce',v_r.id,'succeeded',jsonb_build_object('references',coalesce(p_data->'evidence',v_r.evidence)));
   UPDATE public.marketplace_adjustments SET state=v_target,evidence=coalesce(p_data->'evidence',evidence),updated_at=now() WHERE id=v_r.id;
  ELSE
   IF v_r.kind<>'REFUND' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
   SELECT * INTO v_ap FROM public.approval_requests WHERE id=v_r.approval_id;
   IF v_r.state IN ('REQUESTED','UNDER_REVIEW') THEN
    v_target:=CASE v_ap.status WHEN 'approved' THEN 'APPROVED' WHEN 'denied' THEN 'REJECTED' ELSE 'UNDER_REVIEW' END;
    UPDATE public.marketplace_adjustments SET state=v_target,updated_at=now() WHERE id=v_r.id RETURNING * INTO v_r;
   END IF;
   IF p_action='refund_submit' AND v_r.state='APPROVED' THEN
    PERFORM private.fi5_consume(v_r.approval_id);
    v_provider:=coalesce(p_data->>'_operation_provider','NOT_CONFIGURED');
    v_claim:=v_provider<>'NOT_CONFIGURED';
    UPDATE public.marketplace_adjustments SET state='PROVIDER_PENDING',provider=v_provider,execution_claimed=v_claim,updated_at=now() WHERE id=v_r.id RETURNING * INTO v_r;
   END IF;
   v_target:=v_r.state;
  END IF;
  IF v_old<>v_target THEN PERFORM private.fi5_audit(p_actor,v_a.project_id,p_action,v_r.id,v_old,v_target,left(coalesce(p_data->>'reason',v_r.reason),1000)); END IF;
  PERFORM private.fi5_release_earnings(v_a.id);
  RETURN (SELECT to_jsonb(x)||jsonb_build_object('claimed',v_claim,'provider_status',CASE WHEN x.provider='NOT_CONFIGURED' THEN 'NOT_CONFIGURED' ELSE 'AVAILABLE' END) FROM public.marketplace_adjustments x WHERE x.id=v_r.id);
 ELSIF p_action='payout' THEN
  SELECT * INTO v_pub FROM public.marketplace_publishers WHERE user_id=p_actor;
  IF v_pub.user_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.projects WHERE id=(p_data->>'project_id')::uuid AND owner_id=p_actor AND status='active') THEN RAISE EXCEPTION 'PUBLISHER_OWNER_REQUIRED'; END IF;
  PERFORM private.xeomx_billing_lock('fi5-publisher:'||p_actor);
  SELECT * INTO v_pay FROM public.marketplace_payouts WHERE publisher_id=p_actor AND idempotency_key=v_key;
  IF v_pay.id IS NOT NULL THEN
   IF v_pay.request_hash IS DISTINCT FROM v_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   RETURN to_jsonb(v_pay);
  END IF;
  IF v_key IS NULL OR length(v_key)<8 THEN RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY'; END IF;
  IF p_data->>'currency' NOT IN ('USD','IRR','IRT') THEN RAISE EXCEPTION 'CURRENCY_MISMATCH'; END IF;
  IF EXISTS(SELECT 1 FROM public.marketplace_earnings e WHERE e.publisher_id=p_actor AND e.state='HELD') THEN RAISE EXCEPTION 'HELD_EARNINGS'; END IF;
  -- Payout the entire available currency balance, including negative refund entries.
  SELECT coalesce(sum(e.creator_net),0) INTO v_total FROM public.marketplace_earnings e WHERE e.publisher_id=p_actor AND e.currency=p_data->>'currency' AND e.state='AVAILABLE' AND NOT EXISTS(SELECT 1 FROM public.marketplace_payout_items pi WHERE pi.earning_id=e.id AND pi.active);
  IF v_total<=0 THEN RAISE EXCEPTION 'NO_AVAILABLE_EARNINGS'; END IF;
  v_target:=CASE WHEN v_pub.payout_eligible AND v_pub.state='ACTIVE' THEN 'DRAFT' ELSE 'ELIGIBILITY_REQUIRED' END;
  INSERT INTO public.marketplace_payouts(publisher_id,project_id,amount,currency,state,eligibility_snapshot,idempotency_key,request_hash)
  VALUES(p_actor,(p_data->>'project_id')::uuid,v_total,p_data->>'currency',v_target,jsonb_build_object('eligible',v_pub.payout_eligible,'identity_state',v_pub.identity_state,'verification_reference',v_pub.verification_reference),v_key,v_hash) RETURNING * INTO v_pay;
  IF v_target='DRAFT' THEN
   v_id:=private.fi5_approval(p_actor,v_pay.project_id,v_pay.id,'payout',p_actor);
   UPDATE public.marketplace_payouts SET approval_id=v_id WHERE id=v_pay.id RETURNING * INTO v_pay;
   INSERT INTO public.marketplace_payout_items(payout_id,earning_id) SELECT v_pay.id,e.id FROM public.marketplace_earnings e WHERE e.publisher_id=p_actor AND e.currency=v_pay.currency AND e.state='AVAILABLE' AND NOT EXISTS(SELECT 1 FROM public.marketplace_payout_items pi WHERE pi.earning_id=e.id AND pi.active);
   UPDATE public.marketplace_earnings e SET state='HELD' WHERE e.id IN (SELECT pi.earning_id FROM public.marketplace_payout_items pi WHERE pi.payout_id=v_pay.id);
  END IF;
  PERFORM private.fi5_audit(p_actor,v_pay.project_id,'payout',v_pay.id,NULL,v_target);
  RETURN to_jsonb(v_pay);
 ELSIF p_action='payout_submit' THEN
  SELECT * INTO v_pay FROM public.marketplace_payouts WHERE id=(p_data->>'id')::uuid;
  IF v_pay.id IS NULL OR v_pay.publisher_id<>p_actor OR NOT EXISTS(SELECT 1 FROM public.projects WHERE id=v_pay.project_id AND owner_id=p_actor AND status='active') THEN RAISE EXCEPTION 'PAYOUT_ACCESS_DENIED'; END IF;
  PERFORM private.xeomx_billing_lock('fi5-publisher:'||p_actor);
  SELECT * INTO v_pay FROM public.marketplace_payouts WHERE id=v_pay.id FOR UPDATE;
  v_old:=v_pay.state;
  IF v_pay.state='DRAFT' THEN
   SELECT * INTO v_ap FROM public.approval_requests WHERE id=v_pay.approval_id;
   IF v_ap.status='denied' THEN
    UPDATE public.marketplace_payouts SET state='CANCELLED',updated_at=now() WHERE id=v_pay.id RETURNING * INTO v_pay;
    UPDATE public.marketplace_payout_items SET active=false WHERE payout_id=v_pay.id;
    UPDATE public.marketplace_earnings e SET state='AVAILABLE' WHERE e.id IN (SELECT pi.earning_id FROM public.marketplace_payout_items pi WHERE pi.payout_id=v_pay.id);
   ELSE
    SELECT * INTO v_pub FROM public.marketplace_publishers WHERE user_id=p_actor;
    IF NOT v_pub.payout_eligible OR v_pub.state<>'ACTIVE' THEN RAISE EXCEPTION 'PAYOUT_INELIGIBLE'; END IF;
    PERFORM private.fi5_consume(v_pay.approval_id);
    PERFORM private.fi5_audit(p_actor,v_pay.project_id,'payout',v_pay.id,v_old,'READY');
    v_provider:=coalesce(p_data->>'_operation_provider','NOT_CONFIGURED');
    v_claim:=v_provider<>'NOT_CONFIGURED';
    UPDATE public.marketplace_payouts SET state='PROVIDER_PENDING',provider=v_provider,execution_claimed=v_claim,updated_at=now() WHERE id=v_pay.id RETURNING * INTO v_pay;
   END IF;
  END IF;
  IF v_old<>v_pay.state THEN PERFORM private.fi5_audit(p_actor,v_pay.project_id,'payout',v_pay.id,v_old,v_pay.state); END IF;
  RETURN to_jsonb(v_pay)||jsonb_build_object('claimed',v_claim,'provider_status',CASE WHEN v_pay.provider='NOT_CONFIGURED' THEN 'NOT_CONFIGURED' ELSE 'AVAILABLE' END);
 ELSIF p_action='operation_reference' THEN
  v_kind:=p_data->>'kind'; v_provider:=p_data->>'provider';
  IF length(p_data->>'reference') NOT BETWEEN 1 AND 240 OR v_provider='NOT_CONFIGURED' THEN RAISE EXCEPTION 'INVALID_PROVIDER_REFERENCE'; END IF;
  IF v_kind='refund' THEN
   SELECT * INTO v_r FROM public.marketplace_adjustments WHERE id=(p_data->>'id')::uuid FOR UPDATE;
   SELECT * INTO v_a FROM public.marketplace_acquisitions WHERE id=v_r.acquisition_id;
   IF p_actor NOT IN (v_a.buyer_id,v_a.publisher_id) OR v_r.state<>'PROVIDER_PENDING' OR NOT v_r.execution_claimed OR v_r.provider IS DISTINCT FROM v_provider THEN RAISE EXCEPTION 'ADJUSTMENT_ACCESS_DENIED'; END IF;
   IF v_r.provider_reference IS NOT NULL AND v_r.provider_reference<>p_data->>'reference' THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   UPDATE public.marketplace_adjustments SET provider_reference=p_data->>'reference' WHERE id=v_r.id RETURNING to_jsonb(marketplace_adjustments) INTO v_result;
  ELSIF v_kind='payout' THEN
   SELECT * INTO v_pay FROM public.marketplace_payouts WHERE id=(p_data->>'id')::uuid FOR UPDATE;
   IF v_pay.publisher_id IS DISTINCT FROM p_actor OR v_pay.state<>'PROVIDER_PENDING' OR NOT v_pay.execution_claimed OR v_pay.provider IS DISTINCT FROM v_provider THEN RAISE EXCEPTION 'PAYOUT_ACCESS_DENIED'; END IF;
   IF v_pay.provider_reference IS NOT NULL AND v_pay.provider_reference<>p_data->>'reference' THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   UPDATE public.marketplace_payouts SET provider_reference=p_data->>'reference' WHERE id=v_pay.id RETURNING to_jsonb(marketplace_payouts) INTO v_result;
  ELSE RAISE EXCEPTION 'INVALID_OPERATION'; END IF;
  RETURN v_result;
 ELSIF p_action='operation_event' THEN
  v_event:=p_data->'event'; v_kind:=p_data->>'kind';
  IF v_event->>'signatureVerified' IS DISTINCT FROM 'true' OR v_event->>'state' NOT IN ('SETTLED','FAILED') OR v_event->>'provider'='NOT_CONFIGURED' THEN RAISE EXCEPTION 'PROVIDER_EVIDENCE_REQUIRED'; END IF;
  PERFORM private.xeomx_billing_lock('fi5-operation:'||(v_event->>'provider')||':'||(v_event->>'eventId'));
  SELECT * INTO v_receipt FROM public.marketplace_settlement_receipts WHERE provider=v_event->>'provider' AND event_id=v_event->>'eventId';
  IF v_kind='refund' THEN
   SELECT * INTO v_r FROM public.marketplace_adjustments WHERE id=(v_event->>'entityId')::uuid;
   SELECT * INTO v_a FROM public.marketplace_acquisitions WHERE id=v_r.acquisition_id;
   IF v_r.id IS NULL OR p_actor NOT IN (v_a.buyer_id,v_a.publisher_id) OR v_r.provider IS DISTINCT FROM v_event->>'provider' OR v_r.amount IS DISTINCT FROM (v_event->>'amountMinor')::bigint OR v_r.currency IS DISTINCT FROM v_event->>'currency' THEN RAISE EXCEPTION 'EVENT_BINDING_MISMATCH'; END IF;
  ELSIF v_kind='payout' THEN
   SELECT * INTO v_pay FROM public.marketplace_payouts WHERE id=(v_event->>'entityId')::uuid;
   IF v_pay.id IS NULL OR v_pay.publisher_id<>p_actor OR v_pay.provider IS DISTINCT FROM v_event->>'provider' OR v_pay.amount IS DISTINCT FROM (v_event->>'amountMinor')::bigint OR v_pay.currency IS DISTINCT FROM v_event->>'currency' THEN RAISE EXCEPTION 'EVENT_BINDING_MISMATCH'; END IF;
  ELSE RAISE EXCEPTION 'INVALID_OPERATION'; END IF;
  IF v_receipt.event_id IS NOT NULL THEN
   IF v_receipt.record IS DISTINCT FROM v_event OR v_receipt.kind<>v_kind THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   RETURN jsonb_build_object('state','ALREADY_PROCESSED');
  END IF;
  PERFORM private.xeomx_billing_lock('fi5-publisher:'||CASE WHEN v_kind='refund' THEN v_a.publisher_id ELSE v_pay.publisher_id END);
  IF v_kind='refund' THEN
   SELECT * INTO v_r FROM public.marketplace_adjustments WHERE id=v_r.id FOR UPDATE;
   SELECT * INTO v_a FROM public.marketplace_acquisitions WHERE id=v_a.id FOR UPDATE;
   IF v_r.state<>'PROVIDER_PENDING' OR v_r.provider_reference IS NULL OR NOT v_r.execution_claimed THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
   v_target:=CASE WHEN v_event->>'state'='SETTLED' THEN 'REFUNDED' ELSE 'FAILED' END;
   IF v_target='REFUNDED' THEN
    SELECT * INTO v_i FROM public.billing_checkout_intents WHERE id=v_a.id;
    SELECT payment_event_id INTO v_event_id FROM public.xeomx_record_verified_billing_event(v_a.buyer_id,v_a.id,v_i.provider,'refund:'||v_r.id||':'||(v_event->>'eventId'),'refund_confirmed',v_event->>'payloadDigest',true,'refund-adapter',v_r.amount,v_r.currency,now(),jsonb_build_object('refund_id',v_r.id,'refund_provider',v_r.provider));
    SELECT coalesce(sum(x.amount),0)+v_r.amount INTO v_total FROM public.marketplace_adjustments x WHERE x.acquisition_id=v_a.id AND x.kind='REFUND' AND x.state='REFUNDED';
    IF v_total>(v_a.price->>'amount')::bigint THEN RAISE EXCEPTION 'REFUND_CEILING'; END IF;
    -- Cumulative rounding means many small partial refunds cannot over-reverse a fee.
    v_fee:=CASE WHEN v_a.fee_bps IS NULL THEN NULL ELSE floor(v_total::numeric*v_a.fee_bps/10000)::bigint-floor((v_total-v_r.amount)::numeric*v_a.fee_bps/10000)::bigint END;
    INSERT INTO public.marketplace_earnings(acquisition_id,publisher_id,source_event_id,kind,gross,platform_fee,creator_net,currency,state) VALUES(v_a.id,v_a.publisher_id,v_event_id,'REFUND',-v_r.amount,-v_fee,-v_r.amount+v_fee,v_r.currency,'HELD');
    UPDATE public.marketplace_acquisitions SET phase=CASE WHEN v_total=(v_a.price->>'amount')::bigint THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END,updated_at=now() WHERE id=v_a.id;
    IF v_total=(v_a.price->>'amount')::bigint THEN PERFORM public.xeomx_set_billing_entitlement_status(v_a.entitlement_id,'refunded',v_event_id,'verified-refund'); END IF;
   END IF;
   UPDATE public.marketplace_adjustments SET state=v_target,updated_at=now() WHERE id=v_r.id;
   PERFORM private.fi5_release_earnings(v_a.id);
   PERFORM private.fi5_audit(p_actor,v_a.project_id,'refund_settlement',v_r.id,'PROVIDER_PENDING',v_target,v_event_id::text);
  ELSE
   SELECT * INTO v_pay FROM public.marketplace_payouts WHERE id=v_pay.id FOR UPDATE;
   IF v_pay.state<>'PROVIDER_PENDING' OR v_pay.provider_reference IS NULL OR NOT v_pay.execution_claimed THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
   v_target:=CASE WHEN v_event->>'state'='SETTLED' THEN 'PAID' ELSE 'FAILED' END;
   UPDATE public.marketplace_payouts SET state=v_target,updated_at=now() WHERE id=v_pay.id;
   UPDATE public.marketplace_earnings e SET state=CASE WHEN v_target='PAID' THEN 'PAID' ELSE 'AVAILABLE' END WHERE e.id IN(SELECT pi.earning_id FROM public.marketplace_payout_items pi WHERE pi.payout_id=v_pay.id);
   IF v_target='FAILED' THEN UPDATE public.marketplace_payout_items SET active=false WHERE payout_id=v_pay.id; END IF;
   PERFORM private.fi5_audit(p_actor,v_pay.project_id,'payout_settlement',v_pay.id,'PROVIDER_PENDING',v_target,v_event->>'eventId');
  END IF;
  INSERT INTO public.marketplace_settlement_receipts(provider,event_id,entity_id,kind,payload_digest,processing_state,record) VALUES(v_event->>'provider',v_event->>'eventId',(v_event->>'entityId')::uuid,v_kind,v_event->>'payloadDigest','PROCESSED',v_event);
  RETURN jsonb_build_object('state',v_target);
 ELSIF p_action='dashboard' THEN
  RETURN jsonb_build_object(
   'publisher',(SELECT to_jsonb(x) FROM public.marketplace_publishers x WHERE x.user_id=p_actor),
   'drafts',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM public.marketplace_drafts WHERE owner_id=p_actor ORDER BY updated_at DESC LIMIT 100) x),'[]'),
   'orders',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM public.marketplace_acquisitions WHERE buyer_id=p_actor AND private.fi5_member(p_actor,project_id) ORDER BY created_at DESC LIMIT 100) x),'[]'),
   'earnings',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM public.marketplace_earnings WHERE publisher_id=p_actor ORDER BY created_at DESC LIMIT 100) x),'[]'),
   'payouts',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM public.marketplace_payouts WHERE publisher_id=p_actor AND private.fi5_member(p_actor,project_id) ORDER BY created_at DESC LIMIT 100) x),'[]'),
   'adjustments',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT adj.* FROM public.marketplace_adjustments adj JOIN public.marketplace_acquisitions acq ON acq.id=adj.acquisition_id WHERE acq.publisher_id=p_actor OR (acq.buyer_id=p_actor AND private.fi5_member(p_actor,acq.project_id)) ORDER BY adj.created_at DESC LIMIT 100) x),'[]'),
   'approvals',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,status,runtime_record,expires_at FROM public.approval_requests WHERE commerce_key IS NOT NULL AND runtime_record->>'approver'=p_actor::text ORDER BY created_at DESC LIMIT 100) x),'[]'),
   'analytics',jsonb_build_object('free_acquisitions',(SELECT count(*) FROM public.marketplace_acquisitions WHERE publisher_id=p_actor AND phase='SETTLED' AND marketplace_acquisitions.price->>'billing_model'='FREE'),'paid_settlements',(SELECT count(*) FROM public.marketplace_earnings WHERE publisher_id=p_actor AND kind='SALE'),'conversion','NOT_ENOUGH_DATA','currency_totals',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT currency,sum(gross) gross,sum(platform_fee) platform_fee,sum(creator_net) creator_net,bool_and(platform_fee IS NOT NULL) fees_known FROM public.marketplace_earnings WHERE publisher_id=p_actor GROUP BY currency) x),'[]')),
   'providers',jsonb_build_object('payment','NOT_CONFIGURED','refund','NOT_CONFIGURED','payout','NOT_CONFIGURED'));
 END IF;
 RAISE EXCEPTION 'COMMERCE_ACTION_NOT_IMPLEMENTED';
END $$;
REVOKE ALL ON FUNCTION private.fi5_finance(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.xeomx_marketplace_commerce(p_actor uuid,p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.marketplace_versions; d public.marketplace_drafts; a public.marketplace_acquisitions; i public.billing_checkout_intents;
 r public.marketplace_adjustments; pay public.marketplace_payouts; pub public.marketplace_publishers; ap public.approval_requests;
 price public.marketplace_prices; policy jsonb; result jsonb; event jsonb; receipt public.marketplace_settlement_receipts;
 pid uuid; eid uuid; new_id uuid; owner uuid; amount bigint; fee bigint; total bigint; old_state text; target text; typ text; created boolean; requires boolean; fingerprint text; key text;
BEGIN
 IF COALESCE(NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' OR p_actor IS NULL THEN RAISE EXCEPTION 'COMMERCE_SERVER_REQUIRED'; END IF;
 IF jsonb_typeof(p_data)<>'object' OR octet_length(p_data::text)>100000 OR NOT private.xeomx_billing_metadata_is_safe(p_data) THEN RAISE EXCEPTION 'UNSAFE_COMMERCE_INPUT'; END IF;
 -- The canonical billing lock serializes same-actor idempotent creates.
 key:=coalesce(p_data->>'idempotency_key','');
 IF key<>'' THEN
  IF length(key) NOT BETWEEN 8 AND 200 THEN RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY'; END IF;
  PERFORM private.xeomx_billing_lock('marketplace:'||p_actor||':'||key);
 END IF;
 fingerprint:=coalesce(p_data->>'_request_hash','');
 IF p_action='publisher' THEN
  target:=coalesce(p_data->>'state','DRAFT');
  IF target NOT IN ('DRAFT','ACTIVE','DEPRECATED') THEN RAISE EXCEPTION 'PUBLISHER_POLICY_REQUIRED'; END IF;
  SELECT * INTO pub FROM public.marketplace_publishers WHERE user_id=p_actor FOR UPDATE;
  IF pub.state IN ('RESTRICTED','SUSPENDED','DEPRECATED') AND target<>pub.state THEN RAISE EXCEPTION 'PUBLISHER_POLICY_REQUIRED'; END IF;
  INSERT INTO public.marketplace_publishers(user_id,state,commerce_eligible) VALUES(p_actor,target,target='ACTIVE') ON CONFLICT(user_id) DO UPDATE SET state=excluded.state,commerce_eligible=excluded.commerce_eligible,updated_at=now() RETURNING * INTO pub;
  PERFORM private.fi5_audit(p_actor,NULL,'publisher',p_actor,NULL,target);
  RETURN to_jsonb(pub);
 ELSIF p_action='draft' THEN
  new_id:=(p_data#>>'{entry,id}')::uuid;
  IF (p_data#>>'{entry,manifest,creatorId}')::uuid IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM public.marketplace_packages WHERE id=p_data#>>'{entry,manifest,packageId}' AND owner_id<>p_actor) THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
  SELECT * INTO d FROM public.marketplace_drafts WHERE id=new_id FOR UPDATE;
  IF d.id IS NOT NULL AND (d.owner_id<>p_actor OR d.stage='PUBLISHED') THEN RAISE EXCEPTION 'PUBLISHED_VERSION_IMMUTABLE'; END IF;
  INSERT INTO public.marketplace_drafts(id,owner_id,entry,price) VALUES(new_id,p_actor,p_data->'entry',p_data->'price') ON CONFLICT(id) DO UPDATE SET entry=excluded.entry,price=excluded.price,stage='DRAFT',updated_at=now() RETURNING * INTO d;
  PERFORM private.fi5_audit(p_actor,NULL,'draft',d.id,NULL,'DRAFT'); RETURN to_jsonb(d);
 ELSIF p_action IN ('draft_get','validate','publish') THEN
  SELECT * INTO d FROM public.marketplace_drafts WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF d.id IS NULL OR d.owner_id<>p_actor THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
  IF p_action='draft_get' THEN RETURN to_jsonb(d); END IF;
  IF d.stage='PUBLISHED' THEN
   IF p_action='publish' THEN RETURN to_jsonb(d); END IF;
   RAISE EXCEPTION 'PUBLISHED_VERSION_IMMUTABLE';
  END IF;
  IF p_action='validate' THEN
   target:=p_data->>'_stage';
   IF target IS NULL OR target NOT IN ('READY','REVIEW_REQUIRED','VALIDATION_FAILED') THEN RAISE EXCEPTION 'VALIDATION_REQUIRED'; END IF;
   PERFORM private.fi5_audit(p_actor,NULL,'publication_validation',d.id,d.stage,'VALIDATION');
   UPDATE public.marketplace_drafts SET stage=target,updated_at=now() WHERE id=d.id;
  ELSE
   PERFORM public.xeomx_marketplace_publish(p_actor,d.entry); target:='PUBLISHED';
  END IF;
  PERFORM private.fi5_audit(p_actor,NULL,'publication',d.id,d.stage,target);
  RETURN (SELECT to_jsonb(x) FROM public.marketplace_drafts x WHERE id=d.id);
 ELSIF p_action='policy' THEN
  pid:=(p_data->>'project_id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id=pid AND owner_id=p_actor AND status='active') THEN RAISE EXCEPTION 'PROJECT_OWNER_REQUIRED'; END IF;
  policy:=p_data->'policy';
  IF jsonb_typeof(policy)<>'object' OR octet_length(policy::text)>10000 THEN RAISE EXCEPTION 'INVALID_POLICY'; END IF;
  INSERT INTO public.marketplace_enterprise_policies(project_id,policy,updated_by) VALUES(pid,policy,p_actor) ON CONFLICT(project_id) DO UPDATE SET policy=excluded.policy,updated_by=p_actor,updated_at=now();
  PERFORM private.fi5_audit(p_actor,pid,'policy',pid,NULL,'UPDATED'); RETURN policy;
 ELSIF p_action='price' THEN
  SELECT * INTO v FROM public.marketplace_versions WHERE id=(p_data->>'version_id')::uuid;
  IF v.id IS NULL OR (v.entry#>>'{manifest,creatorId}')::uuid<>p_actor THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
  INSERT INTO public.marketplace_prices(version_id,snapshot) VALUES(v.id,p_data->'price') RETURNING * INTO price;
  PERFORM private.fi5_audit(p_actor,NULL,'price',price.id,NULL,'CREATED'); RETURN to_jsonb(price);
 ELSIF p_action='quote' THEN
  SELECT * INTO v FROM public.marketplace_versions WHERE id=(p_data->>'version_id')::uuid;
  IF v.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.marketplace_packages p WHERE p.id=v.package_id AND (p.visibility='public' OR p.owner_id=p_actor OR private.fi5_member(p_actor,p.scope_project_id))) THEN RAISE EXCEPTION 'CAPABILITY_UNAVAILABLE'; END IF;
  SELECT * INTO price FROM public.marketplace_prices WHERE version_id=v.id AND (snapshot->>'effective_from')::timestamptz<=now() AND ((snapshot->>'effective_until') IS NULL OR (snapshot->>'effective_until')::timestamptz>now()) ORDER BY created_at DESC,id DESC LIMIT 1;
  RETURN coalesce(to_jsonb(price),'null');
 ELSIF p_action='lifecycle' THEN
  SELECT * INTO v FROM public.marketplace_versions WHERE id=(p_data->>'version_id')::uuid;
  IF v.id IS NULL OR (v.entry#>>'{manifest,creatorId}')::uuid<>p_actor THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
  target:=p_data->>'state';
  IF target IS NULL OR target NOT IN ('DEPRECATED','WITHDRAWN','SECURITY_BLOCKED') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF p_data->>'scope'='package' THEN
   SELECT lifecycle INTO old_state FROM public.marketplace_packages WHERE id=v.package_id FOR UPDATE;
   IF old_state='SECURITY_BLOCKED' AND target<>'SECURITY_BLOCKED' THEN RAISE EXCEPTION 'SECURITY_REVIEW_REQUIRED'; END IF;
   UPDATE public.marketplace_packages SET lifecycle=target WHERE id=v.package_id;
   UPDATE public.marketplace_listings SET state=lower(target),updated_at=now() WHERE id IN (SELECT id FROM public.marketplace_versions WHERE package_id=v.package_id);
  ELSE
   SELECT state INTO old_state FROM public.marketplace_listings WHERE id=v.id FOR UPDATE;
   IF old_state='security_blocked' AND target<>'SECURITY_BLOCKED' THEN RAISE EXCEPTION 'SECURITY_REVIEW_REQUIRED'; END IF;
   UPDATE public.marketplace_listings SET state=lower(target),updated_at=now() WHERE id=v.id;
  END IF;
  PERFORM private.fi5_audit(p_actor,NULL,'lifecycle',v.id,old_state,target); RETURN jsonb_build_object('state',target);
 ELSIF p_action='acquire_lookup' THEN
  SELECT * INTO i FROM public.billing_checkout_intents WHERE user_id=p_actor AND idempotency_key='marketplace:'||key;
  IF i.id IS NULL THEN RETURN 'null'::jsonb; END IF;
  SELECT * INTO a FROM public.marketplace_acquisitions WHERE id=i.id;
  IF a.id IS NULL OR NOT private.fi5_member(p_actor,a.project_id,true) THEN RAISE EXCEPTION 'TRANSACTION_ACCESS_DENIED'; END IF;
  IF a.request_hash IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  RETURN to_jsonb(a);
 ELSIF p_action='acquire' THEN
  pid:=(p_data->>'project_id')::uuid;
  IF key='' OR NOT private.fi5_member(p_actor,pid,true) THEN RAISE EXCEPTION 'PROJECT_ACCESS_DENIED'; END IF;
  SELECT * INTO i FROM public.billing_checkout_intents WHERE user_id=p_actor AND idempotency_key='marketplace:'||key FOR UPDATE;
  IF i.id IS NOT NULL THEN
   SELECT * INTO a FROM public.marketplace_acquisitions WHERE id=i.id;
   IF a.request_hash IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   RETURN to_jsonb(a);
  END IF;
  SELECT * INTO v FROM public.marketplace_versions WHERE id=(p_data->>'version_id')::uuid;
  IF v.id IS NULL OR v.digest IS DISTINCT FROM p_data->>'_digest' OR NOT EXISTS(SELECT 1 FROM public.marketplace_packages p JOIN public.marketplace_listings l ON l.id=v.id WHERE p.id=v.package_id AND p.lifecycle='ACTIVE' AND l.state='published' AND (p.visibility='public' OR p.owner_id=p_actor OR private.fi5_member(p_actor,p.scope_project_id))) THEN RAISE EXCEPTION 'CAPABILITY_UNAVAILABLE'; END IF;
  SELECT * INTO pub FROM public.marketplace_publishers WHERE user_id=(v.entry#>>'{manifest,creatorId}')::uuid;
  IF pub.state IS DISTINCT FROM 'ACTIVE' OR NOT pub.commerce_eligible THEN RAISE EXCEPTION 'PUBLISHER_INELIGIBLE'; END IF;
  SELECT * INTO price FROM public.marketplace_prices WHERE id=(p_data->>'price_id')::uuid AND version_id=v.id;
  IF price.id IS NULL OR (price.snapshot->>'effective_from')::timestamptz>now() OR (price.snapshot->>'effective_until')::timestamptz<=now() THEN RAISE EXCEPTION 'PRICE_EXPIRED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.marketplace_permission_grants WHERE user_id=p_actor AND project_id=pid AND version_id=v.id AND digest=v.digest) THEN RAISE EXCEPTION 'REAPPROVAL_REQUIRED'; END IF;
  policy:=coalesce((SELECT ep.policy FROM public.marketplace_enterprise_policies ep WHERE project_id=pid),'{}');
  amount:=(price.snapshot->>'amount')::bigint;
  IF (policy ? 'max_amount' AND (policy->>'currency' IS DISTINCT FROM price.snapshot->>'currency' OR amount>(policy->>'max_amount')::bigint)) THEN RAISE EXCEPTION 'ENTERPRISE_PRICE_POLICY'; END IF;
  IF (policy ? 'allowed_publishers' AND NOT (policy->'allowed_publishers' ? pub.user_id::text)) OR (policy->'blocked_publishers' ? pub.user_id::text) THEN RAISE EXCEPTION 'ENTERPRISE_PUBLISHER_POLICY'; END IF;
  IF policy ? 'allowed_types' AND NOT (policy->'allowed_types' ? (v.entry#>>'{manifest,objectType}')) THEN RAISE EXCEPTION 'ENTERPRISE_TYPE_POLICY'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(v.entry#>'{manifest,permissions}') pm WHERE (policy ? 'allowed_permissions' AND NOT(policy->'allowed_permissions' ? (pm->>'id'))) OR (coalesce((policy->>'prohibit_consequential')::boolean,true) AND pm->>'risk'<>'safe_read')) THEN RAISE EXCEPTION 'ENTERPRISE_PERMISSION_POLICY'; END IF;
  IF policy ? 'allowed_hosts' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(v.entry#>'{manifest,disclosure,privacy,destinations}','[]')||coalesce(v.entry#>'{manifest,disclosure,mcp,hosts}','[]')) h WHERE NOT(policy->'allowed_hosts' ? h)) THEN RAISE EXCEPTION 'ENTERPRISE_NETWORK_POLICY'; END IF;
  IF coalesce((policy->>'require_security_review')::boolean,false) THEN RAISE EXCEPTION 'SECURITY_NOT_VERIFIED'; END IF;
  IF policy ? 'pinned_versions' AND policy->'pinned_versions' ? v.package_id AND policy#>>ARRAY['pinned_versions',v.package_id]<>v.version THEN RAISE EXCEPTION 'VERSION_PIN_REQUIRED'; END IF;
  IF coalesce((policy->>'require_commercial_license')::boolean,false) AND v.entry#>>'{manifest,license,commercialUse}' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'LICENSE_POLICY'; END IF;
  requires:=amount>0 OR coalesce((policy->>'admin_approval')::boolean,false);
  -- Membership is checked above; legacy account billing ownership semantics remain unchanged.
  INSERT INTO public.billing_checkout_intents(user_id,project_id,product_key,amount_minor,currency,provider,status,idempotency_key,metadata)
  VALUES(p_actor,pid,left(v.package_id||'@'||v.version,160),amount,price.snapshot->>'currency',coalesce(p_data->>'_provider','NOT_CONFIGURED'),CASE WHEN amount=0 AND NOT requires THEN 'completed' ELSE 'provider_pending' END,'marketplace:'||key,jsonb_build_object('marketplace',true)) RETURNING * INTO i;
  INSERT INTO public.marketplace_acquisitions(id,version_id,buyer_id,publisher_id,project_id,price,license,digest,request_hash,phase,fee_bps)
  VALUES(i.id,v.id,p_actor,pub.user_id,pid,price.snapshot,v.entry#>'{manifest,license}',v.digest,fingerprint,CASE WHEN requires THEN 'WAITING_APPROVAL' ELSE 'SETTLED' END,(p_data->>'_fee_bps')::int) RETURNING * INTO a;
  INSERT INTO public.billing_entitlements(user_id,checkout_intent_id,entitlement_key,resource_type,resource_ref,status,marketplace_free,metadata)
  VALUES(p_actor,i.id,'marketplace:'||v.id||':'||a.id,'marketplace_version',pid||':'||v.id,CASE WHEN requires THEN 'pending' ELSE 'active' END,NOT requires,jsonb_build_object('license',a.license)) RETURNING id INTO eid;
  UPDATE public.marketplace_acquisitions SET entitlement_id=eid WHERE id=a.id;
  IF requires THEN
   SELECT owner_id INTO owner FROM public.projects WHERE id=pid;
   new_id:=private.fi5_approval(p_actor,pid,a.id,'acquire',owner);
   UPDATE public.marketplace_acquisitions SET approval_id=new_id WHERE id=a.id;
  END IF;
  PERFORM private.fi5_audit(p_actor,pid,'acquisition',a.id,'CREATED',a.phase);
  RETURN (SELECT to_jsonb(x) FROM public.marketplace_acquisitions x WHERE id=a.id);
 ELSIF p_action='approve' THEN
  SELECT * INTO ap FROM public.approval_requests WHERE id=(p_data->>'id')::uuid AND commerce_key IS NOT NULL FOR UPDATE;
  IF ap.id IS NULL OR ap.runtime_record->>'approver'<>p_actor::text THEN RAISE EXCEPTION 'APPROVER_REQUIRED'; END IF;
  target:=p_data->>'decision';
  IF target IS NULL OR target NOT IN ('approved','denied') THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
  IF ap.status<>'pending' THEN IF ap.status=target THEN RETURN to_jsonb(ap); END IF; RAISE EXCEPTION 'ALREADY_DECIDED'; END IF;
  IF ap.runtime_record->>'action' IN ('acquire','payout') AND NOT EXISTS(SELECT 1 FROM public.projects WHERE id=ap.project_id AND owner_id=p_actor AND status='active') THEN RAISE EXCEPTION 'APPROVER_REQUIRED'; END IF;
  IF ap.expires_at<=now() THEN RAISE EXCEPTION 'APPROVAL_EXPIRED'; END IF;
  UPDATE public.approval_requests SET status=target,decided_by=p_actor,decided_at=now(),decision_reason=left(p_data->>'reason',1000) WHERE id=ap.id RETURNING * INTO ap;
  PERFORM private.fi5_audit(p_actor,ap.project_id,'approval',ap.id,'pending',target,ap.decision_reason);
  RETURN to_jsonb(ap);
 ELSIF p_action IN ('resume','order','assert_execution') THEN
  SELECT * INTO a FROM public.marketplace_acquisitions WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF a.id IS NULL OR a.buyer_id<>p_actor OR NOT private.fi5_member(p_actor,a.project_id) THEN RAISE EXCEPTION 'TRANSACTION_ACCESS_DENIED'; END IF;
  IF p_action='resume' AND a.phase='WAITING_APPROVAL' THEN
   SELECT * INTO ap FROM public.approval_requests WHERE id=a.approval_id;
   IF ap.status='denied' THEN
    UPDATE public.marketplace_acquisitions SET phase='CANCELLED' WHERE id=a.id;
    UPDATE public.billing_checkout_intents SET status='cancelled' WHERE id=a.id;
    UPDATE public.billing_entitlements SET status='revoked' WHERE id=a.entitlement_id;
    PERFORM private.fi5_audit(p_actor,a.project_id,'resume',a.id,a.phase,'CANCELLED');
   ELSE
    PERFORM private.fi5_consume(a.approval_id);
    target:=CASE WHEN a.price->>'billing_model'='FREE' THEN 'SETTLED' ELSE 'PROVIDER_PENDING' END;
    UPDATE public.marketplace_acquisitions SET phase=target,updated_at=now() WHERE id=a.id;
    IF target='SETTLED' THEN
     UPDATE public.billing_checkout_intents SET status='completed' WHERE id=a.id;
     UPDATE public.billing_entitlements SET status='active',marketplace_free=true WHERE id=a.entitlement_id;
    END IF;
    PERFORM private.fi5_audit(p_actor,a.project_id,'resume',a.id,a.phase,target);
   END IF;
  END IF;
  IF p_action='assert_execution' THEN
   IF NOT EXISTS(SELECT 1 FROM public.billing_entitlements e JOIN public.marketplace_versions fi5row_v ON fi5row_v.id=a.version_id JOIN public.marketplace_packages p ON p.id=fi5row_v.package_id JOIN public.marketplace_listings l ON l.id=fi5row_v.id WHERE e.id=a.entitlement_id AND e.status='active' AND (e.valid_until IS NULL OR e.valid_until>now()) AND p.lifecycle<>'SECURITY_BLOCKED' AND l.state<>'security_blocked' AND fi5row_v.digest=a.digest) THEN RAISE EXCEPTION 'ENTITLEMENT_NOT_EXECUTABLE'; END IF;
  END IF;
  RETURN (SELECT to_jsonb(x)||jsonb_build_object('entitlement',(SELECT to_jsonb(e) FROM public.billing_entitlements e WHERE e.id=x.entitlement_id),'provider_status',(SELECT provider FROM public.billing_checkout_intents WHERE id=x.id),'adjustments',coalesce((SELECT jsonb_agg(to_jsonb(fi5row_r)) FROM public.marketplace_adjustments fi5row_r WHERE acquisition_id=x.id),'[]')) FROM public.marketplace_acquisitions x WHERE id=a.id);
 END IF;
 RETURN private.fi5_finance(p_actor,p_action,p_data);
END $$;
REVOKE ALL ON FUNCTION public.xeomx_marketplace_commerce(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xeomx_marketplace_commerce(uuid,text,jsonb) TO service_role;
COMMIT;
-- Rollback: disable FI5 endpoints; export acquisitions, approvals, financial events and all
-- dependent accounting records before reversing FI5 additions. Never delete billing history.
