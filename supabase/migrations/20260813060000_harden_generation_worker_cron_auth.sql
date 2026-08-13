create schema if not exists xeomx_internal;
revoke all on schema xeomx_internal from public, anon, authenticated;

create table if not exists xeomx_internal.worker_auth (
  singleton boolean primary key default true check (singleton),
  token text not null
);

revoke all on xeomx_internal.worker_auth from public, anon, authenticated;

insert into xeomx_internal.worker_auth(singleton, token)
values (true, encode(gen_random_bytes(32), 'hex'))
on conflict (singleton) do nothing;

create or replace function public.xeomx_validate_worker_token(p_token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    p_token is not null
    and length(p_token) between 32 and 256
    and exists (
      select 1
      from xeomx_internal.worker_auth wa
      where wa.singleton = true
        and wa.token = p_token
    ),
    false
  );
$$;

revoke all on function public.xeomx_validate_worker_token(text) from public, anon, authenticated;
grant execute on function public.xeomx_validate_worker_token(text) to service_role;

select cron.alter_job(
  1,
  command := $cron$
    select extensions.http((
      'GET'::extensions.http_method,
      'https://bzoikmppvwiidyjdaqgv.supabase.co/functions/v1/xeomx-generation-worker'::varchar,
      array[
        extensions.http_header(
          'X-XEOMX-Worker-Token',
          (select token from xeomx_internal.worker_auth where singleton = true)
        )
      ]::extensions.http_header[],
      null::varchar,
      null::varchar
    )::extensions.http_request);
  $cron$
);
