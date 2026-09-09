-- XEOMX Stage 5: staging-only RLS and foreign-key index hardening.
-- Production application is explicitly not authorized in Stage 5.

begin;

create index if not exists credit_ledger_project_id_idx
  on public.credit_ledger (project_id);

create index if not exists generation_jobs_input_message_id_idx
  on public.generation_jobs (input_message_id);

create index if not exists usage_events_provider_request_id_idx
  on public.usage_events (provider_request_id);

-- prompts: preserve public published visibility and author ownership while
-- avoiding per-row auth.uid() re-evaluation and overlapping SELECT policies.
drop policy if exists "Authors can delete their own prompts" on public.prompts;
drop policy if exists "Authors can insert their own prompts" on public.prompts;
drop policy if exists "Authors can update their own prompts" on public.prompts;
drop policy if exists "Authors can view their own prompts" on public.prompts;
drop policy if exists "Published prompts are viewable by everyone" on public.prompts;

create policy "Published prompts are viewable by anonymous users"
  on public.prompts for select to anon
  using (is_published = true);

create policy "Authenticated users can view published or own prompts"
  on public.prompts for select to authenticated
  using (is_published = true or (select auth.uid()) = author_id);

create policy "Authors can insert their own prompts"
  on public.prompts for insert to authenticated
  with check ((select auth.uid()) = author_id);

create policy "Authors can update their own prompts"
  on public.prompts for update to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

create policy "Authors can delete their own prompts"
  on public.prompts for delete to authenticated
  using ((select auth.uid()) = author_id);

-- profiles: public read semantics remain unchanged; owner writes use init plans.
drop policy if exists "Users can delete their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can delete their own profile"
  on public.profiles for delete to authenticated
  using ((select auth.uid()) = id);

-- collections: split anonymous and authenticated visibility, preserving the
-- exact public-or-owner read semantics with one SELECT policy per role.
drop policy if exists "Owners can delete their collections" on public.collections;
drop policy if exists "Owners can insert their collections" on public.collections;
drop policy if exists "Owners can update their collections" on public.collections;
drop policy if exists "Owners can view their collections" on public.collections;
drop policy if exists "Public collections viewable by everyone" on public.collections;

create policy "Public collections viewable by anonymous users"
  on public.collections for select to anon
  using (is_public = true);

create policy "Authenticated users can view public or own collections"
  on public.collections for select to authenticated
  using (is_public = true or (select auth.uid()) = owner_id);

create policy "Owners can insert their collections"
  on public.collections for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Owners can update their collections"
  on public.collections for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their collections"
  on public.collections for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- collection_items: replace the previous ALL policy with action-specific
-- policies so SELECT does not overlap. Ownership remains derived from the
-- parent collection and public reads remain read-only.
drop policy if exists "Owners can modify their collection items" on public.collection_items;
drop policy if exists "Owners can view their collection items" on public.collection_items;
drop policy if exists "Public collection items viewable by everyone" on public.collection_items;

create policy "Public collection items viewable by anonymous users"
  on public.collection_items for select to anon
  using (
    exists (
      select 1 from public.collections as c
      where c.id = collection_items.collection_id
        and c.is_public = true
    )
  );

create policy "Authenticated users can view public or owned collection items"
  on public.collection_items for select to authenticated
  using (
    exists (
      select 1 from public.collections as c
      where c.id = collection_items.collection_id
        and (c.is_public = true or c.owner_id = (select auth.uid()))
    )
  );

create policy "Owners can insert collection items"
  on public.collection_items for insert to authenticated
  with check (
    exists (
      select 1 from public.collections as c
      where c.id = collection_items.collection_id
        and c.owner_id = (select auth.uid())
    )
  );

create policy "Owners can update collection items"
  on public.collection_items for update to authenticated
  using (
    exists (
      select 1 from public.collections as c
      where c.id = collection_items.collection_id
        and c.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.collections as c
      where c.id = collection_items.collection_id
        and c.owner_id = (select auth.uid())
    )
  );

create policy "Owners can delete collection items"
  on public.collection_items for delete to authenticated
  using (
    exists (
      select 1 from public.collections as c
      where c.id = collection_items.collection_id
        and c.owner_id = (select auth.uid())
    )
  );

commit;
