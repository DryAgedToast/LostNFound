# LostNFound — Project Description

> This file is the authoritative source of truth for what this app is, who it's for, and how it works.
> It must be read at the start of every Claude session involving this project.

---

## What Is This App?

**LostNFound** is a campus lost-and-found mobile + web application built for university students and staff. Think of it as a Facebook Marketplace-style platform, but exclusively for lost and found items on a university campus. Students can report found items, browse the feed to look for their lost belongings, and submit claims with verification answers to prove ownership. Staff can manage item drop-offs at physical hotspot locations and verify claimant identity via ID scanning.

**Course context:** This is a capstone project (CISC499, Queen's University, Winter/Spring 2026) built by Suvil Kaushik.

---

## Core User Roles

| Role    | Description |
|---------|-------------|
| Student | Default role. Can post found items, browse the feed, claim items, and message. |
| Staff   | Elevated role. Can manage hotspot drop-offs, verify ID for claims, and resolve theft disputes. |
| Admin   | Highest role. Same as staff, with potential future admin panel access. |

---

## Tech Stack

| Layer       | Technology |
|-------------|------------|
| Frontend    | React Native 0.83.2 + Expo ~55.0.4 |
| Routing     | Expo Router ~55.0.3 (file-based) |
| Backend     | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Language    | TypeScript ~5.9.2 |
| ID Verify   | ID Analyzer API (document scan + data extraction) |
| Testing     | Jest 30.2.0 + jest-expo |
| Navigation  | React Navigation 7 (bottom tabs mobile, sidebar web) |

---

## App Structure

```
src/app/
├── (tabs)/
│   ├── index.tsx       — Feed: browse found items (2-col grid, search, category filter, Active/Archived toggle)
│   ├── messages.tsx    — Inbox: claims on my items + my claims + messaging entry + resolution actions
│   ├── post.tsx        — Post a found item (photo, title, category, location, hotspot, questions)
│   ├── hotspots.tsx    — Hotspot locations: see items waiting at each drop-off point
│   ├── staff.tsx       — Staff tab: managed hotspots + items at hotspots (staff/admin only)
│   └── profile.tsx     — User profile, role badge, 2-col post grid (Active/Archived), logout
├── auth/
│   ├── login.tsx       — Login with dev bypass button (DEV_MODE)
│   ├── signup.tsx      — Registration (+ campus code for teacher accounts)
│   └── select-hotspot.tsx — Post-signup hotspot selection for new teacher accounts
├── item/[id].tsx       — Item detail: claim button, inline edit, restore post, owner pending-claims panel, theft report
├── claim/[id].tsx      — Submit a claim: answer verification questions
├── messages/[claimId].tsx — Real-time message thread (claimant ↔ poster/manager)
└── staff/
    ├── dashboard.tsx   — Staff: log hotspot drop-offs, resolve theft claims
    └── verify.tsx      — Staff: ID scan → approve/reject claim
```

---

## Database Schema (Supabase PostgreSQL)

### `profiles`
Auto-created on auth signup. Fields: `id`, `user_id`, `display_name`, `email`, `avatar_url`, `role` (student/staff/admin), `created_at`.

### `hotspots`
Physical collection points on campus. Fields: `id`, `name`, `building_type` (library/student_center/lecture_hall/gym/admin_building/other), `address`, `latitude`, `longitude`, `staff_contact`, `is_active`.

### `items`
Posted found items. Fields: `id`, `poster_id`, `title`, `description`, `category` (electronics/clothing/keys/wallet/id_card/bag/other), `location_found`, `hotspot_id` (nullable), `image_url`, `status` (unclaimed/pending/claimed/at_hotspot), `custom_questions` (JSONB array of `{id, question}`), `created_at`.

### `claims`
Ownership claims on items. Fields: `id`, `item_id`, `claimant_id`, `custom_answers` (JSONB), `status` (pending/approved/rejected/awaiting_in_person/**withdrawn**), `reviewed_by`, `reviewed_at`, `identity_verified`, `identity_record_id`.

> **PostgREST FK note:** `claims` has two FKs to `profiles` (`claimant_id` and `reviewed_by`). Always use explicit FK hints in selects: `profiles!claimant_id(*)` — never `profiles(*)` (ambiguous, causes PostgREST error).

- `withdrawn` — claimant voluntarily retracted their claim. Preserves message history. Chat auto-archived for claimant; can be restored (which reactivates claim to `pending`).

### `messages`
Per-claim chat messages. Fields: `id`, `claim_id`, `sender_id`, `content`, `message_type` (user/system), `created_at`.

- `message_type = "system"` renders as a centered gray bubble (not attributed to sender). Used for status change notifications.

### `claim_chat_hides`
Per-user soft-archive of a claim thread. Fields: `id`, `claim_id`, `profile_id`, `hidden_at`. A thread with a hide row is classified as Archived for that user. Deleting the row unarchives it. The `delete_or_hide_claim_chat(uuid)` RPC either hides (if other participant hasn't hidden) or fully deletes the claim+messages (if both have hidden).

### `hotspot_managers`
Links staff profiles to the hotspots they manage. Fields: `id`, `profile_id`, `hotspot_id`, `campus_code_id`, `assigned_at`. A staff user can manage multiple hotspots.

### `identity_records`
Scanned ID data. Fields: `id`, `user_id`, `id_image_front_url`, `id_image_back_url`, `id_type`, `full_name`, `id_number_hash` (SHA-256 only, never raw), `idanalyzer_result` (JSONB), `recorded_by`, `recorded_at`, `expires_at`, `purge_status`, `theft_hold`.

### `theft_claims`
Disputes when original owner contests an approved claim. Fields: `id`, `item_id`, `original_owner_id`, `disputed_claim_id`, `description`, `evidence_url`, `status` (open/under_review/resolved).

### `hotspot_dropoffs`
Audit log when staff move an item to a hotspot. Fields: `id`, `item_id`, `hotspot_id`, `logged_by`, `notes`, `created_at`.

---

## Key User Flows

### Posting a Found Item
1. Tap "Post" tab
2. Upload optional photo → fill title, category, location found
3. Optionally choose a hotspot for planned drop-off
4. Add 1–5 custom verification questions (e.g. "What color is the case?")
5. Submit → item created with `status=unclaimed`

### Claiming an Item
1. Browse feed → tap item → tap "This is Mine"
2. Answer custom questions (or generic prompt if none set)
3. Submit → `claim` created with `status=pending`, item status updated to `pending`; item detail now shows "View Thread" button instead of "This is Mine"
4. Both parties can now message via the claim thread
5. Claimant can **Withdraw Claim** from the thread (sets claim to `withdrawn`, gray system bubble sent, auto-archives chat for claimant, switches inbox to Archived tab, restores item to `unclaimed` if no other active claims)
6. Withdrawn claim can be reactivated by tapping ↩ in the Archived inbox tab → claim restored to `pending`, chat moved back to Active

### Editing a Post
1. Owner taps an item card on their profile (or from the feed)
2. On item detail, an "Edit" button appears (top right) for non-archived, non-hotspot items
3. Edit mode shows inputs for title, description, and custom questions (add/remove, max 5)
4. Save → updates `items` table, all views refresh (feed, messages thread header, claim screen)
5. Cancel → discards changes

### Restoring an Archived Post
1. Owner views a deleted item (via profile Archived tab or direct URL)
2. Green "Restore Post" button appears (only for owner, only when archived)
3. Tap → clears `deleted_at`/`deleted_by`, item reappears in active feed

### Messaging & Inbox
- After a claim is submitted, a thread is created per `claim_id`
- **Claimant** sees threads under "Items I am claiming"
- **Poster** (direct items only, no hotspot) sees threads under "Items I posted or manage"
- **Hotspot manager** sees threads under "Items I posted or manage" for items `at_hotspot` at their hotspot. The original poster does NOT see these — manager takes over once item is physically received.
- Inbox has Active / Archived tabs. Archiving is per-user via `claim_chat_hides`. A new reply from the other participant auto-restores an archived thread to Active.
- System messages (gray centered bubbles) are inserted automatically on key events: claim withdrawn, post archived, pending pickup marked, pickup confirmed, revert to unclaimed.
- Messages use Supabase Realtime (postgres_changes on `messages` table)

### Resolution Flow (Poster / Hotspot Manager)
- **Mark Pending Pickup** (gray button) — claim `pending` → `awaiting_in_person`, item → `pending`. Available to poster on direct items, manager on hotspot items.
- **Revert to Unclaimed** (amber button) — undoes pending pickup. Restores claim and all previously-rejected claims on the item back to `pending`, item back to `unclaimed`.
- **Mark Picked Up** (green button) — claim → `approved`, item → `claimed`. Rejects all other open claims on the item.

### Staff Hotspot Drop-off
1. Staff takes physical item to hotspot location
2. Opens Staff Dashboard → logs drop-off: select item + select hotspot + notes
3. Item status changes to `at_hotspot`
4. `hotspot_dropoffs` audit record created

### ID Verification (Staff)
1. From pending claim, staff goes to `/staff/verify/[claimId]`
2. Camera captures front + back of claimant's ID
3. ID Analyzer API extracts name, DOB, doc number
4. Doc number stored as SHA-256 hash only (never raw)
5. Claim updated: `status=approved`, `identity_verified=true`

---

## Environment Variables (`.env`)

```
EXPO_PUBLIC_SUPABASE_URL=           — Supabase project URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=      — Supabase anon key
EXPO_PUBLIC_DEV_LOGIN_EMAIL=        — Dev bypass login email
EXPO_PUBLIC_DEV_LOGIN_PASSWORD=     — Dev bypass login password
EXPO_PUBLIC_DEV_BYPASS_DISPLAY_NAME= — Name shown for dev user
EXPO_PUBLIC_DEV_MODE=true           — Enables dev bypass button
EXPO_PUBLIC_DEMO_MODE=false         — Uses mock data if true
```

---

## Design System

- **Primary color:** `#1877F2` (Facebook blue)
- **Background:** `#F0F2F5`
- **Cards/Elements:** `#FFFFFF`
- **Text:** `#1C1E21`
- **Secondary text:** `#65676B`
- **Success/Claimed:** `#42B72A`
- **Spacing scale:** 2, 4, 8, 16, 24, 32, 64 px (`Spacing.half` → `Spacing.six`)
- **Border radius:** 8–12px on cards and inputs
- UI inspiration: Facebook Marketplace

---

## Running the App

```bash
npm install
npm run web        # Web (best for rapid UI iteration)
npm start          # Expo dev server (scan QR for device)
npm run android    # Android emulator
npm run ios        # iOS simulator
npm run lint       # ESLint
```

---

## Key Source Files

| File | Purpose |
|------|---------|
| [src/lib/auth.ts](src/lib/auth.ts) | Auth functions, DEV_MODE, session management |
| [src/lib/supabase.ts](src/lib/supabase.ts) | Supabase client init |
| [src/lib/realtime.ts](src/lib/realtime.ts) | Realtime message subscriptions |
| [src/lib/mock-data.ts](src/lib/mock-data.ts) | Demo mode mock data |
| [src/types/index.ts](src/types/index.ts) | All TypeScript interfaces |
| [src/constants/theme.ts](src/constants/theme.ts) | Colors and spacing |
| [supabase-setup.sql](supabase-setup.sql) | Full DB schema + RLS policies |
| [src/app/(tabs)/messages.tsx](src/app/(tabs)/messages.tsx) | Inbox: thread list, split-pane chat, all resolution actions, withdraw claim, unarchive, revert to unclaimed |
| [src/app/(tabs)/index.tsx](src/app/(tabs)/index.tsx) | Feed: Active/Archived toggle, category + status filters, search |
| [src/app/(tabs)/profile.tsx](src/app/(tabs)/profile.tsx) | Profile: 2-col ItemCard grid, Active/Archived toggle, staff dashboard link |
| [src/app/(tabs)/staff.tsx](src/app/(tabs)/staff.tsx) | Staff tab: managed hotspots + items at hotspots |
| [src/app/item/[id].tsx](src/app/item/[id].tsx) | Item detail: claim button, inline edit, restore post, delete post, poster/manager controls |
| [src/components/ClaimStatusBadge.tsx](src/components/ClaimStatusBadge.tsx) | Status badge for claims (pending/approved/rejected/awaiting_in_person/withdrawn) |
| [src/components/StaffGuard.tsx](src/components/StaffGuard.tsx) | Role gate — wraps staff-only screens, redirects students |

---

## Pending SQL Migrations (must be run manually in Supabase SQL Editor)

These changes are in `supabase-setup.sql` but must also be applied to the live DB:

```sql
-- 1. Add withdrawn to claim_status enum (if not already done)
alter type claim_status add value if not exists 'withdrawn';

-- 2. Fix claims_select RLS to allow item posters to read claims on their items (if not already done)
drop policy if exists "claims_select" on claims;
create policy "claims_select" on claims for select using (
  auth.uid() = (select user_id from profiles where id = claimant_id)
  or exists (select 1 from items where items.id = item_id and auth.uid() = (select user_id from profiles where id = items.poster_id))
  or exists (select 1 from profiles where user_id = auth.uid() and role in ('staff', 'admin'))
);
```

> Both of these were applied to the live DB on 2026-05-10. Included here for reference in case DB is reset or re-provisioned.
