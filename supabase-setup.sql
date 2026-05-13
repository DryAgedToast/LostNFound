-- ============================================================
-- LostNFound — Full Database Setup
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ENUMS
do $$ begin
  create type user_role as enum ('student', 'staff', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type item_category as enum ('electronics', 'clothing', 'keys', 'wallet', 'id_card', 'bag', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type item_status as enum ('unclaimed', 'pending', 'claimed', 'at_hotspot');
exception when duplicate_object then null; end $$;

do $$ begin
  create type claim_status as enum ('pending', 'approved', 'rejected', 'awaiting_in_person', 'withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type id_type as enum ('drivers_license', 'state_id', 'passport', 'student_id');
exception when duplicate_object then null; end $$;

do $$ begin
  create type purge_status as enum ('active', 'scheduled_purge', 'purged');
exception when duplicate_object then null; end $$;

do $$ begin
  create type theft_claim_status as enum ('open', 'under_review', 'resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type building_type as enum ('library', 'student_center', 'lecture_hall', 'gym', 'admin_building', 'other');
exception when duplicate_object then null; end $$;

-- TABLES

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  display_name text not null,
  email text not null,
  avatar_url text,
  role user_role not null default 'student',
  created_at timestamptz not null default now()
);

create table if not exists campus_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  institution text not null,
  created_by  uuid references profiles(id),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists hotspots (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  building_type  building_type not null,
  address        text not null,
  latitude       double precision not null,
  longitude      double precision not null,
  staff_contact  text,
  campus_code_id uuid references campus_codes(id),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  description text,
  category item_category not null,
  location_found text not null,
  hotspot_id uuid references hotspots(id),
  image_url text,
  status item_status not null default 'unclaimed',
  custom_questions jsonb not null default '[]',
  deleted_at timestamptz,
  deleted_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table items add column if not exists found_latitude double precision;
alter table items add column if not exists found_longitude double precision;

create table if not exists claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade not null,
  claimant_id uuid references profiles(id) on delete cascade not null,
  custom_answers jsonb not null default '[]',
  status claim_status not null default 'pending',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  identity_verified boolean not null default false,
  identity_record_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists identity_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  id_image_front_url text,
  id_image_back_url text,
  id_type id_type not null,
  full_name text,
  id_number_hash text not null,
  idanalyzer_result jsonb,
  recorded_by uuid references profiles(id) not null,
  recorded_at timestamptz not null default now(),
  expires_at timestamptz not null,
  purge_status purge_status not null default 'active',
  theft_hold boolean not null default false
);

create table if not exists theft_claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade not null,
  original_owner_id uuid references profiles(id) on delete cascade not null,
  disputed_claim_id uuid references claims(id) on delete cascade not null,
  description text not null,
  evidence_url text,
  status theft_claim_status not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  message_type text not null default 'user' check (message_type in ('user', 'system')),
  created_at timestamptz not null default now()
);

create table if not exists message_reads (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references messages(id) on delete cascade not null,
  claim_id uuid references claims(id) on delete cascade not null,
  reader_profile_id uuid references profiles(id) on delete cascade not null,
  read_at timestamptz not null default now(),
  unique(message_id, reader_profile_id)
);

create table if not exists claim_chat_hides (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete cascade not null,
  hidden_at timestamptz not null default now(),
  unique(claim_id, profile_id)
);

create table if not exists hotspot_dropoffs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade not null,
  hotspot_id uuid references hotspots(id) on delete cascade not null,
  logged_by uuid references profiles(id) on delete cascade not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists hotspot_managers (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid references profiles(id) on delete cascade not null,
  hotspot_id     uuid references hotspots(id) on delete cascade not null,
  campus_code_id uuid references campus_codes(id),
  assigned_at    timestamptz not null default now(),
  unique(profile_id, hotspot_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table items enable row level security;
alter table claims enable row level security;
alter table messages enable row level security;
alter table message_reads enable row level security;
alter table claim_chat_hides enable row level security;
alter table hotspots enable row level security;
alter table identity_records enable row level security;
alter table theft_claims enable row level security;
alter table hotspot_dropoffs enable row level security;
alter table campus_codes enable row level security;
alter table hotspot_managers enable row level security;

-- Drop existing policies before recreating
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- Profiles: users can read all, update their own
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_insert" on profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update" on profiles for update using (auth.uid() = user_id);

-- Items: everyone can read, authenticated users can insert
create policy "items_select" on items for select using (true);
create policy "items_insert" on items for insert with check (auth.role() = 'authenticated');
create policy "items_update" on items for update using (auth.role() = 'authenticated');

-- Claims: claimant, item poster, or staff can see
create policy "claims_select" on claims for select using (
  auth.uid() = (select user_id from profiles where id = claimant_id)
  or exists (select 1 from items where items.id = item_id and auth.uid() = (select user_id from profiles where id = items.poster_id))
  or exists (select 1 from profiles where user_id = auth.uid() and role in ('staff', 'admin'))
);
create policy "claims_insert" on claims for insert with check (auth.role() = 'authenticated');
create policy "claims_update" on claims for update using (auth.role() = 'authenticated');

-- Messages: sender or claim participant
create policy "messages_select" on messages for select using (auth.role() = 'authenticated');
create policy "messages_insert" on messages for insert with check (auth.role() = 'authenticated');

-- Message reads: authenticated users can read/mark read for inbox unread state
create policy "message_reads_select" on message_reads for select using (auth.role() = 'authenticated');
create policy "message_reads_insert" on message_reads for insert with check (auth.role() = 'authenticated');

-- Chat hides: each user manages only their own hidden inbox rows
create policy "claim_chat_hides_select" on claim_chat_hides for select using (
  profile_id = (select id from profiles where user_id = auth.uid())
);
create policy "claim_chat_hides_insert" on claim_chat_hides for insert with check (
  profile_id = (select id from profiles where user_id = auth.uid())
  and exists (
    select 1
    from claims c
    join items i on i.id = c.item_id
    where c.id = claim_chat_hides.claim_id
    and (
      c.claimant_id = profile_id
      or i.poster_id = profile_id
      or exists (
        select 1
        from hotspot_managers hm
        where hm.hotspot_id = i.hotspot_id
        and hm.profile_id = profile_id
      )
    )
  )
);
create policy "claim_chat_hides_update" on claim_chat_hides for update using (
  profile_id = (select id from profiles where user_id = auth.uid())
);
create policy "claim_chat_hides_delete" on claim_chat_hides for delete using (
  profile_id = (select id from profiles where user_id = auth.uid())
);

create or replace function current_profile_id()
returns uuid
language sql
stable
as $$
  select id from profiles where user_id = auth.uid()
$$;

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

-- Hotspots: public read, authenticated can insert (teachers creating new hotspots)
create policy "hotspots_select" on hotspots for select using (true);
create policy "hotspots_insert" on hotspots for insert with check (auth.role() = 'authenticated');

-- Campus codes: public read (needed for signup validation), admin-only write
create policy "campus_codes_select" on campus_codes for select using (true);
create policy "campus_codes_insert" on campus_codes for insert with check (
  exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
);

-- Hotspot managers: authenticated read, staff can insert their own record
create policy "hotspot_managers_select" on hotspot_managers
  for select using (auth.role() = 'authenticated');
create policy "hotspot_managers_insert" on hotspot_managers
  for insert with check (
    auth.role() = 'authenticated'
    and profile_id = (select id from profiles where user_id = auth.uid())
  );

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- DEV USER: dev@test.com / password123
-- Creates auth user + profile if not already present
-- ============================================================

do $$
declare
  dev_uid uuid;
begin
  -- Check if user already exists
  select id into dev_uid from auth.users where email = 'dev@test.com';

  if dev_uid is null then
    -- Insert into auth.users
    insert into auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      aud, role
    ) values (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'dev@test.com',
      crypt('password123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"display_name":"Dev User"}',
      'authenticated',
      'authenticated'
    )
    returning id into dev_uid;
  end if;

  -- Ensure profile exists
  insert into public.profiles (user_id, display_name, email, role)
  values (dev_uid, 'Dev User', 'dev@test.com', 'student')
  on conflict (user_id) do nothing;
end $$;

-- Also ensure profile exists for suvilk@udel.edu if they signed up
insert into public.profiles (user_id, display_name, email, role)
select id, split_part(email, '@', 1), email, 'student'
from auth.users
where email = 'suvilk@udel.edu'
on conflict (user_id) do nothing;

-- Stripe Identity (claim flow); safe to re-run
alter table public.claims
  add column if not exists stripe_verification_session_id text;

-- ============================================================
-- SEED: Teacher Feature — Campus Codes + Hotspots
-- ============================================================

insert into campus_codes (code, institution)
values ('UDEL-TEACHER', 'University of Delaware')
on conflict (code) do nothing;

do $$
declare
  udel_code_id uuid;
begin
  select id into udel_code_id from campus_codes where code = 'UDEL-TEACHER';

  insert into hotspots (name, building_type, address, latitude, longitude, campus_code_id, is_active)
  values
    ('Morris Library Front Desk',        'library',        '181 S College Ave, Newark, DE 19716', 39.6562, -75.7510, udel_code_id, true),
    ('Trabant Student Center Info Desk', 'student_center', '17 W Main St, Newark, DE 19716',      39.6580, -75.7518, udel_code_id, true),
    ('Memorial Hall Lobby',              'lecture_hall',   '104 The Green, Newark, DE 19716',      39.6570, -75.7497, udel_code_id, true),
    ('Bob Carpenter Center',             'gym',            '631 S College Ave, Newark, DE 19716',  39.6531, -75.7513, udel_code_id, true),
    ('Hullihen Hall Main Office',        'admin_building', '104 Hullihen Hall, Newark, DE 19716',  39.6577, -75.7508, udel_code_id, true)
  on conflict do nothing;
end $$;

-- ============================================================
-- STORAGE: item-images (bucket + RLS; mirrors migrations/005)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "item_images_public_read" on storage.objects;
drop policy if exists "item_images_auth_insert" on storage.objects;

create policy "item_images_public_read" on storage.objects
for select using (bucket_id = 'item-images');

create policy "item_images_auth_insert" on storage.objects
for insert with check (bucket_id = 'item-images' and auth.uid() is not null);
