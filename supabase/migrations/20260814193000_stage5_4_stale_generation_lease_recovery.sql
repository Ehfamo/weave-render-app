-- XEOMX Stage 5.4: recover abandoned running generation jobs without retrying a billable provider.
-- Stale jobs are failed closed and their reserved credits are released by the canonical failure RPC.

create index if not exists generation_jobs_running_started_at_idx
  on public.generation_jobs (started_at)
  where status = 'running';

create or replace function public.xeomx_fail_stale_generation_jobs(
  p_lease_seconds integer default 600,
  p_limit integer default 25
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
  v_failed integer := 0;
begin
  if p_lease_seconds is null or p_lease_seconds < 60 or p_lease_seconds > 3600 then
    raise exception using message = 'XEOMX_VALIDATION_LEASE_SECONDS';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception using message = 'XEOMX_VALIDATION_LIMIT';
  end if;

  for v_job_id in
    select gj.id
    from public.generation_jobs as gj
    where gj.status = 'running'
      and gj.started_at is not null
      and gj.started_at < pg_catalog.now() - pg_catalog.make_interval(secs => p_lease_seconds)
    order by gj.started_at asc
    for update skip locked
    limit p_limit
  loop
    if public.xeomx_fail_generation_job(
      v_job_id,
      'GENERATION_FAILED',
      'generation worker lease expired; retry safely',
      null
    ) then
      v_failed := v_failed + 1;
    end if;
  end loop;

  return v_failed;
end;
$$;

revoke all on function public.xeomx_fail_stale_generation_jobs(integer, integer)
  from public, anon, authenticated;
grant execute on function public.xeomx_fail_stale_generation_jobs(integer, integer)
  to service_role;
