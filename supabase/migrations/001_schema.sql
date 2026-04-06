-- ============================================================
-- LostNFound — Full Database Schema
-- ============================================================

-- ENUMS
CREATE TYPE user_role AS ENUM ('student', 'staff', 'admin');
CREATE TYPE item_category AS ENUM ('electronics', 'clothing', 'keys', 'wallet', 'id_card', 'bag', 'other');
CREATE TYPE item_status AS ENUM ('unclaimed', 'pending', 'claimed', 'at_hotspot');
CREATE TYPE claim_status AS ENUM ('pending', 'approved', 'rejected', 'awaiting_in_person');
CREATE TYPE id_type AS ENUM ('drivers_license', 'state_id', 'passport', 'student_id');
CREATE TYPE purge_status AS ENUM ('active', 'scheduled_purge', 'purged');
CREATE TYPE theft_claim_status AS ENUM ('open', 'under_review', 'resolved');
CREATE TYPE building_type AS ENUM ('library', 'student_center', 'lecture_hall', 'gym', 'admin_building', 'other');

-- TABLES

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE hotspots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  building_type building_type NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  staff_contact TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category item_category NOT NULL,
  location_found TEXT NOT NULL,
  hotspot_id UUID REFERENCES hotspots(id) ON DELETE SET NULL,
  image_url TEXT,
  status item_status NOT NULL DEFAULT 'unclaimed',
  custom_questions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE identity_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  id_image_front_url TEXT,
  id_image_back_url TEXT,
  id_type id_type NOT NULL,
  full_name TEXT,
  id_number_hash TEXT NOT NULL,
  idanalyzer_result JSONB,
  recorded_by UUID NOT NULL REFERENCES profiles(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL GENERATED ALWAYS AS (recorded_at + INTERVAL '90 days') STORED,
  purge_status purge_status NOT NULL DEFAULT 'active',
  theft_hold BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  claimant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  custom_answers JSONB NOT NULL DEFAULT '[]',
  status claim_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  identity_verified BOOLEAN NOT NULL DEFAULT false,
  identity_record_id UUID REFERENCES identity_records(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE theft_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  original_owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  disputed_claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  evidence_url TEXT,
  status theft_claim_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hotspot_dropoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  hotspot_id UUID NOT NULL REFERENCES hotspots(id) ON DELETE CASCADE,
  logged_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('item-images', 'item-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('identity-records', 'identity-records', false);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotspots ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE theft_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotspot_dropoffs ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's profile
CREATE OR REPLACE FUNCTION current_profile_id() RETURNS UUID AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS user_role AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- PROFILES
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (user_id = auth.uid());

-- HOTSPOTS
CREATE POLICY "hotspots_select_all" ON hotspots FOR SELECT USING (true);
CREATE POLICY "hotspots_insert_admin" ON hotspots FOR INSERT WITH CHECK (current_user_role() IN ('staff', 'admin'));
CREATE POLICY "hotspots_update_admin" ON hotspots FOR UPDATE USING (current_user_role() = 'admin');

-- ITEMS: students can see unclaimed/at_hotspot; staff/admin see all
CREATE POLICY "items_select_student" ON items FOR SELECT USING (
  status IN ('unclaimed', 'at_hotspot')
  OR poster_id = current_profile_id()
  OR current_user_role() IN ('staff', 'admin')
);
CREATE POLICY "items_insert_auth" ON items FOR INSERT WITH CHECK (poster_id = current_profile_id());
CREATE POLICY "items_update_own_or_staff" ON items FOR UPDATE USING (
  poster_id = current_profile_id() OR current_user_role() IN ('staff', 'admin')
);

-- CLAIMS
CREATE POLICY "claims_select_involved" ON claims FOR SELECT USING (
  claimant_id = current_profile_id()
  OR EXISTS (SELECT 1 FROM items WHERE items.id = claims.item_id AND items.poster_id = current_profile_id())
  OR current_user_role() IN ('staff', 'admin')
);
CREATE POLICY "claims_insert_student" ON claims FOR INSERT WITH CHECK (claimant_id = current_profile_id());
CREATE POLICY "claims_update_staff" ON claims FOR UPDATE USING (
  current_user_role() IN ('staff', 'admin')
  OR EXISTS (SELECT 1 FROM items WHERE items.id = claims.item_id AND items.poster_id = current_profile_id())
);

-- IDENTITY RECORDS
CREATE POLICY "identity_records_select_staff_admin" ON identity_records FOR SELECT USING (
  current_user_role() IN ('staff', 'admin')
  OR user_id = current_profile_id()
);
CREATE POLICY "identity_records_insert_staff" ON identity_records FOR INSERT WITH CHECK (
  current_user_role() IN ('staff', 'admin')
);
CREATE POLICY "identity_records_update_admin" ON identity_records FOR UPDATE USING (
  current_user_role() = 'admin'
);

-- THEFT CLAIMS
CREATE POLICY "theft_claims_select" ON theft_claims FOR SELECT USING (
  original_owner_id = current_profile_id()
  OR current_user_role() IN ('staff', 'admin')
);
CREATE POLICY "theft_claims_insert" ON theft_claims FOR INSERT WITH CHECK (
  original_owner_id = current_profile_id()
);
CREATE POLICY "theft_claims_update_admin" ON theft_claims FOR UPDATE USING (
  current_user_role() = 'admin'
);

-- MESSAGES
CREATE POLICY "messages_select_claim_parties" ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM claims c
    WHERE c.id = messages.claim_id
    AND (
      c.claimant_id = current_profile_id()
      OR EXISTS (SELECT 1 FROM items i WHERE i.id = c.item_id AND i.poster_id = current_profile_id())
    )
  )
  OR current_user_role() IN ('staff', 'admin')
);
CREATE POLICY "messages_insert_claim_parties" ON messages FOR INSERT WITH CHECK (
  sender_id = current_profile_id()
  AND EXISTS (
    SELECT 1 FROM claims c
    WHERE c.id = messages.claim_id
    AND (
      c.claimant_id = current_profile_id()
      OR EXISTS (SELECT 1 FROM items i WHERE i.id = c.item_id AND i.poster_id = current_profile_id())
    )
  )
);

-- HOTSPOT DROPOFFS
CREATE POLICY "hotspot_dropoffs_select_staff" ON hotspot_dropoffs FOR SELECT USING (
  current_user_role() IN ('staff', 'admin')
);
CREATE POLICY "hotspot_dropoffs_insert_staff" ON hotspot_dropoffs FOR INSERT WITH CHECK (
  current_user_role() IN ('staff', 'admin')
);

-- ============================================================
-- STORAGE RLS
-- ============================================================

-- item-images: public read, authenticated insert
CREATE POLICY "item_images_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'item-images');
CREATE POLICY "item_images_auth_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'item-images' AND auth.uid() IS NOT NULL
);

-- identity-records: no public access; staff/admin only
CREATE POLICY "identity_records_storage_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'identity-records'
  AND current_user_role() IN ('staff', 'admin')
);
CREATE POLICY "identity_records_storage_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'identity-records'
  AND current_user_role() IN ('staff', 'admin')
);
CREATE POLICY "identity_records_storage_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'identity-records'
  AND current_user_role() IN ('staff', 'admin')
);

-- No seed/filler records included in base schema migration.
