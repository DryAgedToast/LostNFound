-- ============================================================
-- LostNFound — Teacher Feature Migration
-- Run this ONCE in the Supabase SQL Editor on your connected DB.
-- Safe to run on an existing database (uses IF NOT EXISTS / ALTER IF NOT EXISTS).
-- ============================================================

-- ── New table: campus_codes ────────────────────────────────────────────────
create table if not exists campus_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  institution text not null,
  created_by  uuid references profiles(id),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── New table: hotspot_managers ───────────────────────────────────────────
create table if not exists hotspot_managers (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid references profiles(id) on delete cascade not null,
  hotspot_id     uuid references hotspots(id) on delete cascade not null,
  campus_code_id uuid references campus_codes(id),
  assigned_at    timestamptz not null default now(),
  unique(profile_id, hotspot_id)
);

-- ── Add campus_code_id to hotspots ────────────────────────────────────────
alter table hotspots add column if not exists campus_code_id uuid references campus_codes(id);

-- ── Add system-message support to messages ───────────────────────────────
alter table messages add column if not exists message_type text not null default 'user';
alter table items add column if not exists deleted_at timestamptz;
alter table items add column if not exists deleted_by uuid references profiles(id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messages_message_type_check'
  ) then
    alter table messages
      add constraint messages_message_type_check
      check (message_type in ('user', 'system'));
  end if;
end $$;

-- ── New table: message_reads ──────────────────────────────────────────────
create table if not exists message_reads (
  id                uuid primary key default gen_random_uuid(),
  message_id        uuid references messages(id) on delete cascade not null,
  claim_id          uuid references claims(id) on delete cascade not null,
  reader_profile_id uuid references profiles(id) on delete cascade not null,
  read_at           timestamptz not null default now(),
  unique(message_id, reader_profile_id)
);

-- ── New table: claim_chat_hides ───────────────────────────────────────────
create table if not exists claim_chat_hides (
  id         uuid primary key default gen_random_uuid(),
  claim_id   uuid references claims(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete cascade not null,
  hidden_at  timestamptz not null default now(),
  unique(claim_id, profile_id)
);

-- ── Enable RLS on new tables ──────────────────────────────────────────────
alter table campus_codes enable row level security;
alter table hotspot_managers enable row level security;
alter table message_reads enable row level security;
alter table claim_chat_hides enable row level security;

-- ── Helper: current profile id ────────────────────────────────────────────
create or replace function current_profile_id()
returns uuid
language sql
stable
as $$
  select id from profiles where user_id = auth.uid()
$$;

-- ── RLS: campus_codes ─────────────────────────────────────────────────────
drop policy if exists "campus_codes_select" on campus_codes;
drop policy if exists "campus_codes_insert" on campus_codes;

-- Public read so signup screen can validate codes without being logged in
create policy "campus_codes_select" on campus_codes for select using (true);

-- Only admins can create campus codes
create policy "campus_codes_insert" on campus_codes for insert with check (
  exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
);

-- ── RLS: hotspot_managers ─────────────────────────────────────────────────
drop policy if exists "hotspot_managers_select" on hotspot_managers;
drop policy if exists "hotspot_managers_insert" on hotspot_managers;

-- Authenticated users can read all hotspot manager assignments
create policy "hotspot_managers_select" on hotspot_managers
  for select using (auth.role() = 'authenticated');

-- Staff can insert their own hotspot manager record
create policy "hotspot_managers_insert" on hotspot_managers
  for insert with check (
    auth.role() = 'authenticated'
    and profile_id = (select id from profiles where user_id = auth.uid())
  );

-- ── RLS: messages ─────────────────────────────────────────────────────────
-- Claimant, poster, and hotspot managers for the item's hotspot can participate.
drop policy if exists "messages_select_claim_parties" on messages;
drop policy if exists "messages_insert_claim_parties" on messages;

create policy "messages_select_claim_parties" on messages for select using (
  exists (
    select 1
    from claims c
    join items i on i.id = c.item_id
    where c.id = messages.claim_id
    and (
      c.claimant_id = current_profile_id()
      or i.poster_id = current_profile_id()
      or exists (
        select 1 from hotspot_managers hm
        where hm.hotspot_id = i.hotspot_id
        and hm.profile_id = current_profile_id()
      )
    )
  )
);

create policy "messages_insert_claim_parties" on messages for insert with check (
  sender_id = current_profile_id()
  and exists (
    select 1
    from claims c
    join items i on i.id = c.item_id
    where c.id = messages.claim_id
    and (
      c.claimant_id = current_profile_id()
      or i.poster_id = current_profile_id()
      or exists (
        select 1 from hotspot_managers hm
        where hm.hotspot_id = i.hotspot_id
        and hm.profile_id = current_profile_id()
      )
    )
  )
);

-- ── RLS: message_reads ────────────────────────────────────────────────────
drop policy if exists "message_reads_select_claim_parties" on message_reads;
drop policy if exists "message_reads_insert_claim_parties" on message_reads;

create policy "message_reads_select_claim_parties" on message_reads for select using (
  exists (
    select 1
    from claims c
    join items i on i.id = c.item_id
    where c.id = message_reads.claim_id
    and (
      c.claimant_id = current_profile_id()
      or i.poster_id = current_profile_id()
      or exists (
        select 1 from hotspot_managers hm
        where hm.hotspot_id = i.hotspot_id
        and hm.profile_id = current_profile_id()
      )
    )
  )
);

create policy "message_reads_insert_claim_parties" on message_reads for insert with check (
  exists (
    select 1
    from claims c
    join items i on i.id = c.item_id
    where c.id = message_reads.claim_id
    and message_reads.message_id in (
      select id from messages where claim_id = c.id
    )
    and (
      (
        message_reads.reader_profile_id = current_profile_id()
        and (
          c.claimant_id = current_profile_id()
          or i.poster_id = current_profile_id()
        )
      )
      or exists (
        select 1
        from hotspot_managers current_hm
        join hotspot_managers reader_hm
          on reader_hm.hotspot_id = current_hm.hotspot_id
        where current_hm.hotspot_id = i.hotspot_id
        and current_hm.profile_id = current_profile_id()
        and reader_hm.profile_id = message_reads.reader_profile_id
      )
    )
  )
);

-- ── RLS: claim_chat_hides ─────────────────────────────────────────────────
drop policy if exists "claim_chat_hides_select_own" on claim_chat_hides;
drop policy if exists "claim_chat_hides_insert_own" on claim_chat_hides;
drop policy if exists "claim_chat_hides_update_own" on claim_chat_hides;
drop policy if exists "claim_chat_hides_delete_own" on claim_chat_hides;

create policy "claim_chat_hides_select_own" on claim_chat_hides for select using (
  profile_id = current_profile_id()
);

create policy "claim_chat_hides_insert_own" on claim_chat_hides for insert with check (
  profile_id = current_profile_id()
  and exists (
    select 1
    from claims c
    join items i on i.id = c.item_id
    where c.id = claim_chat_hides.claim_id
    and (
      c.claimant_id = current_profile_id()
      or i.poster_id = current_profile_id()
      or exists (
        select 1
        from hotspot_managers hm
        where hm.hotspot_id = i.hotspot_id
        and hm.profile_id = current_profile_id()
      )
    )
  )
);

create policy "claim_chat_hides_update_own" on claim_chat_hides for update using (
  profile_id = current_profile_id()
) with check (
  profile_id = current_profile_id()
);

create policy "claim_chat_hides_delete_own" on claim_chat_hides for delete using (
  profile_id = current_profile_id()
);

-- ── Chat delete helper ────────────────────────────────────────────────────
-- Hides a claim chat for the current user. If every participant has hidden it,
-- deletes the claim so messages/reads/hides cascade away.
create or replace function delete_or_hide_claim_chat(p_claim_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_item_id uuid;
  v_claimant_id uuid;
  v_poster_id uuid;
  v_hotspot_id uuid;
  v_participant_count integer;
  v_hidden_count integer;
begin
  v_profile_id := current_profile_id();
  if v_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  select c.item_id, c.claimant_id, i.poster_id, i.hotspot_id
  into v_item_id, v_claimant_id, v_poster_id, v_hotspot_id
  from claims c
  join items i on i.id = c.item_id
  where c.id = p_claim_id;

  if not found then
    raise exception 'Claim chat not found';
  end if;

  if not (
    v_claimant_id = v_profile_id
    or v_poster_id = v_profile_id
    or exists (
      select 1
      from hotspot_managers hm
      where hm.hotspot_id = v_hotspot_id
      and hm.profile_id = v_profile_id
    )
  ) then
    raise exception 'Not authorized for this claim chat';
  end if;

  insert into claim_chat_hides (claim_id, profile_id, hidden_at)
  values (p_claim_id, v_profile_id, now())
  on conflict (claim_id, profile_id)
  do update set hidden_at = excluded.hidden_at;

  with participants as (
    select v_claimant_id as profile_id
    union
    select v_poster_id
    union
    select hm.profile_id
    from hotspot_managers hm
    where hm.hotspot_id = v_hotspot_id
  )
  select count(*) into v_participant_count
  from participants
  where profile_id is not null;

  with participants as (
    select v_claimant_id as profile_id
    union
    select v_poster_id
    union
    select hm.profile_id
    from hotspot_managers hm
    where hm.hotspot_id = v_hotspot_id
  )
  select count(distinct h.profile_id) into v_hidden_count
  from claim_chat_hides h
  join participants p on p.profile_id = h.profile_id
  where h.claim_id = p_claim_id;

  if v_participant_count > 0 and v_hidden_count >= v_participant_count then
    delete from claims where id = p_claim_id;
    return 'deleted';
  end if;

  return 'hidden';
end;
$$;

grant execute on function delete_or_hide_claim_chat(uuid) to authenticated;

-- ── Update handle_new_user trigger to respect role from metadata ──────────
-- This allows teacher signups to get role='staff' via user metadata
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, display_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student')::user_role
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ── Seed: University of Delaware campus code ──────────────────────────────
insert into campus_codes (code, institution)
values ('UDEL-TEACHER', 'University of Delaware')
on conflict (code) do nothing;

-- ── Seed: hotspot locations for UDEL ─────────────────────────────────────
-- After running, the campus_code_id for UDEL-TEACHER will be linked to these hotspots.
-- Run the UPDATE below to associate existing/new hotspots with the UDEL code.
do $$
declare
  udel_code_id uuid;
begin
  select id into udel_code_id from campus_codes where code = 'UDEL-TEACHER';

  insert into hotspots (name, building_type, address, latitude, longitude, campus_code_id, is_active)
  values
    ('Morris Library Front Desk',       'library',        '181 S College Ave, Newark, DE 19716', 39.6562, -75.7510, udel_code_id, true),
    ('Trabant Student Center Info Desk', 'student_center', '17 W Main St, Newark, DE 19716',     39.6580, -75.7518, udel_code_id, true),
    ('Memorial Hall Lobby',              'lecture_hall',   '104 The Green, Newark, DE 19716',     39.6570, -75.7497, udel_code_id, true),
    ('Bob Carpenter Center',             'gym',            '631 S College Ave, Newark, DE 19716', 39.6531, -75.7513, udel_code_id, true),
    ('Hullihen Hall Main Office',        'admin_building', '104 Hullihen Hall, Newark, DE 19716', 39.6577, -75.7508, udel_code_id, true)
  on conflict do nothing;
end $$;
