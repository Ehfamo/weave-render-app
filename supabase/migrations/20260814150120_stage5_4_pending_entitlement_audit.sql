-- XEOMX Stage 5.4: audit every newly-created pending billing entitlement.
-- This remains provider-neutral and does not activate access or grant credits.

begin;

create or replace function private.xeomx_audit_pending_billing_entitlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  select intent.project_id into v_project_id
  from public.billing_checkout_intents as intent
  where intent.id = new.checkout_intent_id;

  insert into public.audit_events (
    actor_id,
    project_id,
    event_type,
    target_type,
    target_id,
    result,
    policy_context,
    metadata
  ) values (
    new.user_id,
    v_project_id,
    'billing.entitlement.pending.created',
    'billing_entitlement',
    new.id,
    'submitted',
    pg_catalog.jsonb_build_object('boundary', 'service-role-only'),
    pg_catalog.jsonb_build_object(
      'entitlement_key', new.entitlement_key,
      'resource_type', new.resource_type
    )
  );

  return new;
end;
$$;

revoke all on function private.xeomx_audit_pending_billing_entitlement()
  from public, anon, authenticated, service_role;

create trigger billing_entitlements_audit_pending_insert
  after insert on public.billing_entitlements
  for each row execute function private.xeomx_audit_pending_billing_entitlement();

commit;
