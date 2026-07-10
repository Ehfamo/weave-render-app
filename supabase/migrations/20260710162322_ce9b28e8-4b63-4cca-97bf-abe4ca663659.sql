
-- Notification helper functions
create or replace function public.notify_on_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare _author uuid;
begin
  select author_id into _author from public.prompts where id = new.prompt_id;
  if _author is not null and _author <> new.user_id then
    insert into public.notifications(user_id, type, actor_id, entity_type, entity_id)
    values (_author, 'like', new.user_id, 'prompt', new.prompt_id);
  end if;
  return new;
end $$;

create or replace function public.notify_on_save()
returns trigger language plpgsql security definer set search_path = public as $$
declare _author uuid;
begin
  select author_id into _author from public.prompts where id = new.prompt_id;
  if _author is not null and _author <> new.user_id then
    insert into public.notifications(user_id, type, actor_id, entity_type, entity_id)
    values (_author, 'save', new.user_id, 'prompt', new.prompt_id);
  end if;
  return new;
end $$;

create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.follower_id <> new.followee_id then
    insert into public.notifications(user_id, type, actor_id, entity_type, entity_id)
    values (new.followee_id, 'follow', new.follower_id, 'user', new.follower_id);
  end if;
  return new;
end $$;

create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare _author uuid;
begin
  select author_id into _author from public.prompts where id = new.prompt_id;
  if _author is not null and _author <> new.author_id then
    insert into public.notifications(user_id, type, actor_id, entity_type, entity_id)
    values (_author, 'comment', new.author_id, 'comment', new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_like on public.likes;
create trigger trg_notify_like after insert on public.likes
  for each row execute function public.notify_on_like();

drop trigger if exists trg_notify_save on public.saves;
create trigger trg_notify_save after insert on public.saves
  for each row execute function public.notify_on_save();

drop trigger if exists trg_notify_follow on public.follows;
create trigger trg_notify_follow after insert on public.follows
  for each row execute function public.notify_on_follow();

drop trigger if exists trg_notify_comment on public.comments;
create trigger trg_notify_comment after insert on public.comments
  for each row execute function public.notify_on_comment();

-- Enable realtime for comments + notifications
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.comments';
  exception when duplicate_object then null;
  end;
  begin
    execute 'alter publication supabase_realtime add table public.notifications';
  exception when duplicate_object then null;
  end;
end $$;
