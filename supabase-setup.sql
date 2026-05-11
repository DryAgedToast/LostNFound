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
  create type claim_status as enum ('pending', 'approved', 'rejected', 'awaiting_in_person');
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

create table if not exists hotspots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  building_type building_type not null,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  staff_contact text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now()
);

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
  created_at timestamptz not null default now()
);

create table if not exists hotspot_dropoffs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade not null,
  hotspot_id uuid references hotspots(id) on delete cascade not null,
  logged_by uuid references profiles(id) on delete cascade not null,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table items enable row level security;
alter table claims enable row level security;
alter table messages enable row level security;
alter table hotspots enable row level security;
alter table identity_records enable row level security;
alter table theft_claims enable row level security;
alter table hotspot_dropoffs enable row level security;

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

-- Claims: claimant or staff can see
create policy "claims_select" on claims for select using (
  auth.uid() = (select user_id from profiles where id = claimant_id)
  or exists (select 1 from profiles where user_id = auth.uid() and role in ('staff', 'admin'))
);
create policy "claims_insert" on claims for insert with check (auth.role() = 'authenticated');
create policy "claims_update" on claims for update using (auth.role() = 'authenticated');

-- Messages: sender or claim participant
create policy "messages_select" on messages for select using (auth.role() = 'authenticated');
create policy "messages_insert" on messages for insert with check (auth.role() = 'authenticated');

-- Hotspots: public read
create policy "hotspots_select" on hotspots for select using (true);

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
    'student'
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
