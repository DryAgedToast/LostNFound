// ============================================================
// LostNFound — TypeScript Types matching DB schema exactly
// ============================================================

// ENUMS
export type UserRole = 'student' | 'staff' | 'admin';
export type ItemCategory = 'electronics' | 'clothing' | 'keys' | 'wallet' | 'id_card' | 'bag' | 'other';
export type ItemStatus = 'unclaimed' | 'pending' | 'claimed' | 'at_hotspot';
export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'awaiting_in_person';
export type IdType = 'drivers_license' | 'state_id' | 'passport' | 'student_id';
export type PurgeStatus = 'active' | 'scheduled_purge' | 'purged';
export type TheftClaimStatus = 'open' | 'under_review' | 'resolved';
export type BuildingType = 'library' | 'student_center' | 'lecture_hall' | 'gym' | 'admin_building' | 'other';

// TABLE INTERFACES

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

export interface Hotspot {
  id: string;
  name: string;
  building_type: BuildingType;
  address: string;
  latitude: number;
  longitude: number;
  staff_contact: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Item {
  id: string;
  poster_id: string;
  title: string;
  description: string | null;
  category: ItemCategory;
  location_found: string;
  hotspot_id: string | null;
  image_url: string | null;
  status: ItemStatus;
  custom_questions: CustomQuestion[];
  created_at: string;
}

export interface Claim {
  id: string;
  item_id: string;
  claimant_id: string;
  custom_answers: CustomAnswer[];
  status: ClaimStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  identity_verified: boolean;
  identity_record_id: string | null;
  created_at: string;
}

export interface IdentityRecord {
  id: string;
  user_id: string;
  id_image_front_url: string | null;
  id_image_back_url: string | null;
  id_type: IdType;
  full_name: string | null;
  id_number_hash: string;
  idanalyzer_result: Record<string, unknown> | null;
  recorded_by: string;
  recorded_at: string;
  expires_at: string;
  purge_status: PurgeStatus;
  theft_hold: boolean;
}

export interface TheftClaim {
  id: string;
  item_id: string;
  original_owner_id: string;
  disputed_claim_id: string;
  description: string;
  evidence_url: string | null;
  status: TheftClaimStatus;
  created_at: string;
}

export interface Message {
  id: string;
  claim_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface HotspotDropoff {
  id: string;
  item_id: string;
  hotspot_id: string;
  logged_by: string;
  notes: string | null;
  created_at: string;
}

// JSONB field types
export interface CustomQuestion {
  id: string;
  question: string;
}

export interface CustomAnswer {
  question_id: string;
  question: string;
  answer: string;
}

// Joined/extended types for UI
export interface ItemWithPoster extends Item {
  profiles: Profile;
  hotspots: Hotspot | null;
}

export interface ClaimWithItem extends Claim {
  items: ItemWithPoster;
  profiles: Profile;
}

export interface MessageWithSender extends Message {
  profiles: Profile;
}
