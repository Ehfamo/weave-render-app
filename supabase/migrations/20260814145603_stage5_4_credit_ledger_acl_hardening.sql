-- XEOMX Stage 5.4: restore least-privilege grants for the credit ledger.
-- Target: staging first. This migration is additive, transactional, and data-preserving.

begin;

revoke all privileges on table public.credit_ledger from anon, authenticated;
grant select on table public.credit_ledger to authenticated;

commit;
