# LostNFound — Backlog

> Living task list. Read alongside PROJECT.md at the start of every session.
> Update this file when tasks are completed or new issues are found.
> Use the `/lostnfound-fix-bug` and `/lostnfound-feature` Claude skills to work through these.

**Last updated:** 2026-05-10 (delete post web fix, claimed→Archived feed, hide claimant for hotspot items, profile card grid, inline edit on item detail, restore post, FK ambiguity fix)
**Current branch:** `suvilkaushik`
**Last commit:** `fc2033a` — "deleted expo-env.d.ts 2 file"

---

## Priority Legend

| Label | Meaning |
|-------|---------|
| **P0** | Broken. Blocks a core user flow. Fix before anything else. |
| **P1** | Missing core feature or significant bug. Fix before demo. |
| **P2** | Quality / UX improvement. Fix when time allows. |
| **P3** | Stretch goal. Post-demo. |

---

## P0 — Critical Bugs

### [BUG-09] Posting an item navigates to an error page

**Status:** ✅ Fixed (2026-05-10)

**Root cause:** `items` has two FK columns pointing to `profiles` — `poster_id` and `deleted_by`. PostgREST treats `profiles(*)` as ambiguous and returns an error. Both `item/[id].tsx` and `index.tsx` used the ambiguous form.

**Fix:** Changed `profiles(*)` to `profiles!poster_id(*)` in both the item detail fetch and the feed queries. The `messages.tsx` query was already using the explicit hint and was unaffected.

---

### [BUG-10] Chat archive 3-dot menu does nothing on web

**Status:** ✅ Fixed (2026-05-10)

**Root cause:** `Alert.alert` on web maps to `window.confirm` but the browser may silently suppress it or the button mapping is unreliable.

**Fix:** Added a `Platform.OS === "web"` branch in `confirmDeleteChat` that calls `window.confirm` directly. Native (iOS/Android) continues to use `Alert.alert`.

---

### [BUG-11] Clicking chat header for a deleted post shows an error

**Status:** ✅ Fixed (2026-05-10)

**Fix:** The chat header `TouchableOpacity` in `messages.tsx` now checks `selectedThread.claim.items.deleted_at`. If set, the `onPress` is disabled and the subtitle shows "Post deleted — no longer available" instead of the hotspot name.

---

### [BUG-01] Claiming an item: after claiming and reloading, the "Claim" button reappears instead of linking to the open message thread

**Status:** ✅ Fixed (2026-05-10)

**User-facing symptom:** Student claims an item. Reloads the page. Goes back to the item detail. The "This is Mine" button shows again instead of "View my claim" or a link to the message thread. Clicking it submits a duplicate claim.

**Root cause (confirmed by reading the code):**
Two separate problems:
1. `claim/[id].tsx` (`src/app/claim/[id].tsx:115`) inserts the claim but does **not** update `items.status` to `"pending"`. So the item stays `"unclaimed"` in the DB and the button keeps showing.
2. `item/[id].tsx` (`src/app/item/[id].tsx:312-313`) shows the claim button based only on `item.status`. It never checks whether the current user already has a claim on this item.

**Fix — two changes required:**

**Change 1** — `src/app/claim/[id].tsx`, inside `handleSubmit()`, after the claim insert succeeds, add:
```typescript
// Update item status to pending now that a claim exists
await supabase
  .from("items")
  .update({ status: "pending" })
  .eq("id", item.id);
```

**Change 2** — `src/app/item/[id].tsx`, in `fetchData()`, after loading the item, query for an existing claim by the current user:
```typescript
// Check if current user already has a claim on this item
const { data: existingClaim } = await supabase
  .from("claims")
  .select("id, status")
  .eq("item_id", id)
  .eq("claimant_id", fetchedProfile.id)
  .maybeSingle();

setExistingClaim(existingClaim ?? null);
```
Add `existingClaim` state. Change the button logic:
- If `existingClaim` exists → show "View Message Thread" button navigating to `/messages/${existingClaim.id}`
- If no existing claim and item is claimable → show "This is Mine" button

---

### [BUG-08] Signup shows misleading "demo mode" popup instead of a real error ✅ Fixed

**Status:** ✅ Fixed (2026-05-10)

**User-facing symptom:** Tapping "Create Account" shows a browser alert: *"Login is only available when database is connected. Currently in demo mode."* The DB is connected — the real error is a Supabase Auth 500.

**Root cause:** `toUserFacingAuthError` in `src/lib/auth.ts` converted any unknown Supabase error (including the 500) into `"Unable to connect. Please check your internet connection."` The `isDatabaseUnavailableError` check in `db-alert.ts` matched that string via `message.includes("unable to connect")` and triggered the popup.

**Fix applied:**
1. `src/lib/auth.ts` — added a `msg.includes("database error")` branch in `toUserFacingAuthError` returning `"Sign up is temporarily unavailable. Please try again in a moment."` Changed the default fallback to `"Something went wrong…"` (no longer contains "unable to connect").
2. `src/lib/db-alert.ts` — removed `"unable to connect"` and `"check your connection"` from `isDatabaseUnavailableError` — these were too broad and matched non-connectivity errors.

---

### [BUG-04] Staff tab claims list always empty — items posted without a hotspot are invisible to teachers

**Status:** Open

**User-facing symptom:** Teacher logs in → Staff tab → "No claims yet at your hotspots." Eight real claims exist in the DB. None appear.

**Root cause:** The staff tab query filters `items.hotspot_id IN (managedHotspotIds)`. Every existing item was posted with `hotspot_id = null` because the post form labels the field "Drop-off Hotspot (optional)" with no explanation. Null hotspot_id items never match the filter.

**Fix — two parts:**

**Part 1** — `src/app/(tabs)/post.tsx` — change the hotspot field label and add a hint so students understand why it matters:
```
// Change section label from:
"Drop-off Hotspot (optional)"
// To:
"Where is this item being held? *"

// Add hint text below the picker:
"Select the campus location where you dropped off the item so staff can manage it."
```
Consider making it required or at minimum adding a warning if skipped.

**Part 2** — Backfill existing items: any items already in the DB with `hotspot_id = null` will never appear for teachers. Existing data can be updated manually in the Supabase dashboard if needed for demo purposes.

---

### [BUG-05] Teacher and student signup returns 500 — new accounts cannot be created through the app

**Status:** ✅ Fixed (2026-05-10)

**User-facing symptom:** Any new user (student or teacher) taps "Create Account" → spinner → generic error. `supabase.auth.signUp()` returns `500 Database error saving new user` consistently.

**Root cause (confirmed):** The `handle_new_user` trigger was missing `SET search_path = public`. Without it, the `::user_role` cast failed inside the SECURITY DEFINER context (enum type not found), rolling back the `auth.users` INSERT and returning a 500. Additionally, `signUp()` in auth.ts was doing a manual `profiles.insert` after the trigger created the row, which would cause a duplicate-key on `user_id`.

**Fix applied:**
1. Updated `handle_new_user` on Supabase with `SECURITY DEFINER SET search_path = public` and added `EXCEPTION WHEN others THEN RETURN new` safety net.
2. Replaced the manual `profiles.insert` in `src/lib/auth.ts` with a `profiles.select` — fetch the trigger-created row instead of re-inserting.
3. See also BUG-08 for the misleading error message that was masking this failure.

---

### [BUG-02] Messages not received by the item poster

**Status:** Open

**User-facing symptom:** Claimant sends a message. The poster's inbox shows the claim in "Claims on My Items" but tapping it goes to the item detail screen, not the message thread. The poster never sees the messages.

**Root cause (confirmed by reading the code):**
1. In `messages.tsx` (`src/app/(tabs)/messages.tsx:156`), the "Claims on My Items" row navigates to `/item/${claim.item_id}` — the item detail page. It should navigate to `/messages/${claim.id}` — the message thread.
2. RLS policy on the `messages` table may not grant read access to the item poster (only claimant_id may be checked). Needs verification in Supabase dashboard.
3. Supabase Realtime may not be enabled on the `messages` table — must be turned on in the dashboard (Database → Replication → Enable realtime for `messages`).

**Fix — one code change + two config checks:**

**Code change** — `src/app/(tabs)/messages.tsx:156`:
```typescript
// WRONG (current):
onPress={() => router.push(`/item/${claim.item_id}`)}

// CORRECT:
onPress={() => router.push(`/messages/${claim.id}`)}
```

**Config check 1** — Supabase dashboard → Database → Replication → confirm `messages` table has realtime enabled.

**Config check 2** — Supabase dashboard → Authentication → Policies → `messages` table → confirm RLS policy allows both the claimant AND the item poster to SELECT and INSERT. Current policy may only check `claimant_id`. The poster is identified via: `claims.item_id → items.poster_id = auth.uid()`.

---

### [BUG-03] Back button crashes after posting a new item

**Status:** ✅ Fixed (2026-05-10)

**User-facing symptom:** After submitting a new item from the Post tab, the app navigates to the item detail page. Pressing the back button causes an error / crash.

**Root cause (confirmed by reading the code):**
`post.tsx` uses `router.replace(\`/item/${data.id}\`)` (line 232) — correct, this doesn't push onto the stack. But `item/[id].tsx` (line 330) calls `router.back()` unconditionally. When arrived via `replace()`, the navigation stack has no previous entry, so `back()` fails.

**Fix** — `src/app/item/[id].tsx`, replace the back button `onPress`:

```typescript
// Before the return statement, add:
const handleBack = () => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/(tabs)/");
  }
};

// In the JSX, change:
onPress={() => router.back()}
// to:
onPress={handleBack}
```

That's the entire fix — ~8 lines total.

---

## P1 — Core Features Missing / High Impact Bugs

### [BUG-06] dev@test.com login broken — dev bypass runs without a real auth session

**Status:** Open

**User-facing symptom:** Pressing "Dev Login (Bypass)" silently falls back to a mock local session because the real `dev@test.com` sign-in returns `500 unexpected_failure — Database error querying schema`. Any feature that calls `supabase.auth.getUser()` (e.g. getCurrentProfile, posting items, sending messages) will fail during dev testing because the mock session has no Supabase token.

**Fix:** Reset the dev@test.com password via the Supabase dashboard → Authentication → Users → Reset password. This recreates the auth entry with a proper identity record and avoids the schema error. Then update `EXPO_PUBLIC_DEV_LOGIN_PASSWORD` in `.env`.

---

### [BUG-07] RLS over-grant — teacher can read all claims system-wide, not just their hotspot's

**Status:** Open

**User-facing symptom:** A teacher at Morris Library can see and open claim threads for items at Trabant, Bob Carpenter, and every other hotspot. Privacy issue.

**Root cause:** The `claims_select` RLS policy grants SELECT to any user with `role = 'staff'` with no scoping — confirmed by audit: teacher token returns all 8 claims. The policy should scope staff access to claims at their managed hotspots only.

**Fix — SQL migration:**
```sql
DROP POLICY IF EXISTS claims_select ON claims;
CREATE POLICY claims_select ON claims
  FOR SELECT USING (
    -- Claimant can see their own claim
    auth.uid() = (SELECT user_id FROM profiles WHERE id = claims.claimant_id)
    -- Staff can see claims only at their managed hotspots
    OR EXISTS (
      SELECT 1 FROM hotspot_managers hm
      JOIN items i ON i.hotspot_id = hm.hotspot_id
      JOIN profiles p ON p.id = hm.profile_id
      WHERE i.id = claims.item_id AND p.user_id = auth.uid()
    )
  );
```
Also apply the same scoping to the `messages_select` policy (currently any authenticated user can read all messages).

---

### [FEAT-00] Teacher Accounts + Hotspot Manager System

**Status:** ✅ Completed (2026-05-10) — DB migrated, teachertest1 created via SQL, Staff tab added, dev teacher login wired up. See BUG-04, BUG-05, BUG-06, BUG-07 for known post-ship issues.

**Priority:** P1 — this is the next major feature to implement after the P0 bugs are fixed.

---

#### Overview

The app currently has three roles: `student`, `staff`, `admin`. The concept of "staff" is too broad. What's actually needed is a **Teacher Account** — a dedicated account type for campus staff (e.g. librarians, student centre workers) who physically manage a Lost & Found hotspot location. Teachers are the primary contact point when a student claims an item that has been dropped off at that location.

The full flow:
1. Support staff (admin) creates a **campus code** for an institution and distributes it to verified teachers out-of-band (email, in-person).
2. Teacher downloads the app and registers using the campus code on the signup screen — this elevates their role to `staff` and associates them with the campus.
3. Teacher selects which **hotspot** at that campus they manage (e.g. "Stauffer Library Front Desk"). This is stored in a new `hotspot_managers` table.
4. When a student posts a found item and selects that hotspot as the drop-off location, the teacher can see it in their dashboard.
5. When a student submits a **claim** on an item at that hotspot, the claim thread is visible to the teacher. The teacher can message the student directly through the existing messaging system.
6. The teacher can confirm pickup (update item status to `claimed`) or reject the claim.

---

#### Database Changes Required

All changes must be applied to `supabase-setup.sql` and reflected in `src/types/index.ts`.

**New table: `campus_codes`**
```sql
create table if not exists campus_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,          -- e.g. 'QUEENS-2026' — issued manually
  institution text not null,                 -- e.g. 'Queen''s University'
  created_by  uuid references profiles(id),  -- admin who created the code
  is_active   boolean not null default true, -- can be revoked
  created_at  timestamptz not null default now()
);
```

**New table: `hotspot_managers`**
```sql
create table if not exists hotspot_managers (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade not null,
  hotspot_id uuid references hotspots(id) on delete cascade not null,
  campus_code_id uuid references campus_codes(id),
  assigned_at timestamptz not null default now(),
  unique(profile_id, hotspot_id)  -- one record per teacher-hotspot pair
);
```

**Modify `hotspots` table** — add `campus_code_id` so hotspots are scoped to an institution:
```sql
alter table hotspots add column if not exists campus_code_id uuid references campus_codes(id);
```

**No change to `profiles.role` enum** — `staff` is the correct role for teachers. The `hotspot_managers` table is what distinguishes a teacher from general staff.

---

#### TypeScript Types to Add (`src/types/index.ts`)

```typescript
export interface CampusCode {
  id: string;
  code: string;
  institution: string;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
}

export interface HotspotManager {
  id: string;
  profile_id: string;
  hotspot_id: string;
  campus_code_id: string | null;
  assigned_at: string;
}
```

---

#### Auth Flow Changes (`src/lib/auth.ts` + `src/app/auth/signup.tsx`)

**Signup screen changes (`src/app/auth/signup.tsx`):**
- Add an optional "Campus Code" text field below the password fields.
- Label: "Campus Code (for teacher accounts only)"
- Placeholder: "e.g. QUEENS-2026"
- If the field is left blank → normal student signup (no change to existing flow).
- If a code is entered → validate it against the `campus_codes` table before creating the account.

**`signUp()` function changes (`src/lib/auth.ts`):**

Add an optional `campusCode?: string` parameter. If provided:
1. Query `campus_codes` where `code = campusCode AND is_active = true`.
2. If no match → throw `new Error("Invalid or expired campus code.")`.
3. If match → create the user account with `role: 'staff'` instead of `'student'`.
4. After profile is created, redirect to a **hotspot selection screen** instead of the main feed.

```typescript
export async function signUp(
  email: string,
  password: string,
  displayName: string,
  campusCode?: string,    // NEW optional param
): Promise<{ profile: Profile; isTeacher: boolean }> { ... }
```

---

#### New Screen: Hotspot Selection (`src/app/auth/select-hotspot.tsx`)

Shown immediately after teacher signup (before entering the main app). Purpose: let the teacher choose which hotspot(s) they manage.

**Behaviour:**
- Fetch all `hotspots` where `campus_code_id` matches the code used during signup AND `is_active = true`.
- Render a scrollable list of hotspot cards (name, building type, address).
- Teacher taps to select their hotspot (single-select for MVP, multi-select later).
- On confirm: insert a row into `hotspot_managers (profile_id, hotspot_id, campus_code_id)`.
- Navigate to `/(tabs)/` (main feed).

**Navigation:** Added to `src/app/_layout.tsx` as a new Stack screen: `auth/select-hotspot`.

---

#### Teacher Dashboard (`src/app/staff/dashboard.tsx` — extend existing)

The staff dashboard already exists. Add a new section: **"My Hotspot — Open Claims"**.

Query:
```typescript
// Get all claims for items at this teacher's managed hotspot(s)
const { data: hotspotClaims } = await supabase
  .from('claims')
  .select('*, items!inner(title, status, hotspot_id), profiles!claimant_id(display_name)')
  .in('items.hotspot_id', managedHotspotIds)
  .eq('status', 'pending')
  .order('created_at', { ascending: false });
```

Each claim row shows: item title, claimant name, time submitted, status badge. Tapping the row navigates to `/messages/${claim.id}` — the existing message thread.

The teacher sends and receives messages through the exact same `messages/[claimId].tsx` screen that students use. No new messaging UI needed.

---

#### RLS Policy Changes (`supabase-setup.sql`)

**`campus_codes` table:**
- Anyone can SELECT (needed for code validation during signup) — or restrict to service role for security (then validate via Supabase Edge Function).
- Only `admin` role can INSERT/UPDATE.

**`hotspot_managers` table:**
- `staff` and `admin` can INSERT their own record.
- Anyone authenticated can SELECT (needed to resolve which teacher manages which hotspot).

**`messages` table — update existing policy:**
The current RLS likely only allows the claimant to read/insert. It must be extended to also allow:
- The item poster
- Any `staff` user who manages the hotspot where `items.hotspot_id` is set

Suggested policy (pseudocode):
```sql
-- Allow access if: sender, claimant, item poster, OR staff managing the hotspot
create policy "messages_access" on messages
  for all using (
    auth.uid() = sender_id
    OR auth.uid() = (select claimant_id from claims where id = claim_id)
    OR auth.uid() = (
      select poster_id from items
      where id = (select item_id from claims where id = claim_id)
    )
    OR exists (
      select 1 from hotspot_managers hm
      join items i on i.hotspot_id = hm.hotspot_id
      join claims c on c.item_id = i.id
      where c.id = claim_id
        and hm.profile_id = (select id from profiles where user_id = auth.uid())
    )
  );
```

---

#### Implementation Order

Follow this sequence exactly — each step depends on the previous:

1. **DB migration** — Add `campus_codes`, `hotspot_managers`, and `campus_code_id` to `hotspots` in `supabase-setup.sql`. Run in Supabase SQL editor.
2. **Seed campus codes** — Insert at least one code manually in Supabase: `INSERT INTO campus_codes (code, institution) VALUES ('QUEENS-2026', 'Queen''s University');`
3. **Seed hotspots with campus_code_id** — see FEAT-01 SQL, add `campus_code_id` column values.
4. **TypeScript types** — Add `CampusCode` and `HotspotManager` to `src/types/index.ts`.
5. **Signup screen** — Add optional campus code field to `src/app/auth/signup.tsx`.
6. **`signUp()` function** — Update `src/lib/auth.ts` to accept + validate `campusCode`, set `role: 'staff'` on match.
7. **Hotspot selection screen** — Create `src/app/auth/select-hotspot.tsx`. Register in `_layout.tsx`.
8. **Staff dashboard** — Add "My Hotspot — Open Claims" section to `src/app/staff/dashboard.tsx`.
9. **RLS policies** — Update `messages` policy in Supabase dashboard + `supabase-setup.sql`.
10. **Test end-to-end** — Create campus code → teacher signup → select hotspot → student posts item at hotspot → student claims → teacher receives message → teacher responds.

---

#### Open Design Decisions (decide before implementing)

| Question | Options | Recommendation |
|----------|---------|----------------|
| Can a teacher manage multiple hotspots? | Single or multi-select | Single for MVP; `hotspot_managers` schema already supports multi |
| Who creates campus codes? | Admin panel (not built) vs. direct Supabase INSERT | Direct Supabase INSERT for now; admin panel is STRETCH-03 |
| Should codes be single-use? | Yes (one teacher per code) or reusable (many teachers per campus) | Reusable — one code per institution, many teachers can use it |
| How does a teacher change their hotspot? | Settings screen | Add to profile screen as a "Manage Hotspot" button — post-MVP |
| Should students see which teacher manages a hotspot? | Show teacher name on hotspot detail | Yes — display `profiles.display_name` of the manager on the hotspot card |

---

### [FEAT-01] Seed real hotspot data into the database

**Status:** ✅ Completed (2026-05-10) — 5 UDEL hotspots seeded: Morris Library, Trabant, Memorial Hall, Hullihen Hall, Bob Carpenter Center. teachertest1 assigned to Morris Library and Trabant.

**Description:** The `hotspots` table exists and is fully wired up, but has no data. The Hotspots tab shows empty. The Post screen's hotspot picker also shows nothing.

**Fix needed:**
Run this SQL in the Supabase SQL editor to seed campus hotspots (adjust names/addresses to match your campus):
```sql
INSERT INTO hotspots (name, building_type, address, latitude, longitude, is_active)
VALUES
  ('Stauffer Library Front Desk', 'library', '101 Union St, Kingston, ON', 44.2252, -76.4956, true),
  ('Student Life Centre Info Desk', 'student_center', '99 University Ave, Kingston, ON', 44.2257, -76.4948, true),
  ('Mackintosh-Corry Hall Lobby', 'lecture_hall', '65 Bader Lane, Kingston, ON', 44.2261, -76.4934, true),
  ('Athletics & Recreation Centre', 'gym', '801 Union St, Kingston, ON', 44.2272, -76.4968, true),
  ('Richardson Hall Main Office', 'admin_building', '75 University Ave, Kingston, ON', 44.2265, -76.4962, true);
```
Also update `src/lib/mock-data.ts` → `MOCK_HOTSPOTS` array with matching demo entries so DEMO_MODE still shows something.

---

### [FEAT-02] Staff / teacher account: manage hotspot claim threads

**Status:** Superseded by FEAT-00 — the full spec is documented there. FEAT-00 covers everything this item described plus the complete teacher account system. Implement FEAT-00 instead.

---

### [FEAT-03] Messages: split-pane layout on web (chat list + inline thread)

**Status:** Open — implementation was completed and then reverted. Full implementation below.

**User request:** On web, show a sidebar on the left with all conversations, and clicking one opens it on the right panel. On mobile, keep the current stack nav (list → navigate to thread). Also add a back button in the thread view on mobile (already exists via the root Stack header — this is fine).

**Exact implementation (already written, needs to be re-applied):**

**File to rewrite:** `src/app/(tabs)/messages.tsx`

The approach is a platform split using `Platform.OS === "web"`:
- Web: render a `320px` left panel (claim list) + right `ThreadPanel` component (inline thread, no route navigation)
- Mobile: existing `FlatList` with `router.push(\`/messages/${claim.id}\`)` on tap — unchanged

**`ThreadPanel` component** (web-only, defined inside `messages.tsx`):
- Props: `claimId: string`, `currentProfile: Profile`, `colors: typeof Colors.light`
- State: `claim`, `messages`, `inputText`, `loading`, `sending`, `error`
- On mount: parallel fetch of claim + messages from Supabase, call `subscribeToMessages(claimId, callback)` for realtime
- On unmount: call `unsubscribeFromClaim(claimId)`
- Render: header bar (item title + `ClaimStatusBadge`), `ScrollView` of `MessageBubble` components, input row (TextInput + Send button)
- Auto-scroll to bottom on new messages

**State in `MessagesScreen`** (web):
- Add `activeClaimId: string | null` state (default `null`)
- On data load: `setActiveClaimId(prev => prev === null ? allClaims[0].id : prev)` — auto-select first
- `handleClaimPress(claimId)`: on web calls `setActiveClaimId(claimId)`, on mobile calls `router.push(\`/messages/${claimId}\`)`
- Active claim row gets `borderWidth: 2, borderColor: '#1877F2'` highlight

**Web layout styles:**
```typescript
webContainer: { flex: 1, flexDirection: 'row' },
webSidebar: { width: 320, borderRightWidth: 1, borderRightColor: colors.border },
webThread: { flex: 1 },
```

**Imports to add** to `messages.tsx`:
```typescript
import MessageBubble from "@/components/MessageBubble";
import { subscribeToMessages, unsubscribeFromClaim } from "@/lib/realtime";
import type { ClaimStatus, MessageWithSender } from "@/types";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput } from "react-native";
import { useRef } from "react";
```

**Note on `fetchData` dep array:** Do NOT put `activeClaimId` in the `useCallback` deps — it will re-fetch on every click. Use the functional update form `setActiveClaimId(prev => ...)` instead.

---

## P2 — Quality & UX

### [QOL-07] Staff tab: `useCallback` called inside JSX props — React hooks violation

**Status:** ✅ Fixed (2026-05-10)
**File:** `src/app/(tabs)/staff.tsx:134`
**Fix:** Extract the inline `useCallback` out of the JSX prop and define it at component top level:
```typescript
const handleRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);
// Then: onRefresh={handleRefresh}
```

---

### [QOL-08] No UI path for a teacher to add or change their managed hotspots post-signup

**Status:** Open
**What happens:** `select-hotspot.tsx` is only reachable immediately after signup via a URL param redirect. teachertest1 can't change their hotspots from inside the app.
**Fix:** Add a "Manage Hotspots" button in the Staff tab footer (next to "Advanced Dashboard →") that navigates to `/auth/select-hotspot?campusCodeId=<UDEL_CAMPUS_CODE_ID>`.

---

### [QOL-09] Post form: hotspot field needs better copy — students skip it

**Status:** Open
**What happens:** "Drop-off Hotspot (optional)" → students skip it → items have `hotspot_id = null` → staff tab never shows their claims. Directly causes BUG-04.
**Fix:** Change label to "Where is this item being held?" and add hint: "Pick a campus drop-off point so staff can verify the owner. Required if you already dropped it off."

---

### [QOL-10] Advanced Dashboard has no back navigation on web / Android

**Status:** Open
**What happens:** "Advanced Dashboard →" link in the Staff tab opens `/staff/dashboard` as a standalone screen with no tab bar. On web and Android there is no back button; users are stranded.
**Fix:** Add a back button to the dashboard header: `router.canGoBack() ? router.back() : router.replace("/(tabs)/staff")`.

---

### [QOL-01] npm audit vulnerabilities

**Status:** Open
**Fix:** Run `npm audit fix`. Document anything that can't be auto-fixed.

### [QOL-02] Item detail: show existing claim status to the current user

**Status:** Open (tied to BUG-01 fix)
**Fix:** Once BUG-01 is fixed (existing claim query added), render a status card instead of the claim button: "Your claim is [pending/approved/rejected]" with a "View Thread" link.

### [QOL-03] Verify Supabase Realtime is enabled on `messages` table

**Status:** Open (config-only, no code change)
**Fix:** Supabase Dashboard → Database → Replication → enable realtime for `messages`. Also confirm the `messages` RLS allows the item poster to read/insert.

### [QOL-04] Dark mode: implement real dark color palette

**Status:** Open
**Fix:** `src/constants/theme.ts` — the `dark` object currently has identical values to `light`. Implement actual dark colors (dark backgrounds, light text).

### [QOL-05] Feed: item status badge should reflect actual claim state

**Status:** Open
**Fix:** After BUG-01 fix updates `items.status` to `"pending"` on claim submit, the feed will automatically show the correct badge. This may already resolve itself once BUG-01 is fixed.

### [QOL-06] Profile: add "My Posts" section

**Status:** ✅ Completed (2026-05-10) — Full 2-column card grid with Active/Archived toggle added to profile page. Hotspot items excluded. `useFocusEffect` for refresh on tab focus.

---

## P3 — Stretch Goals

### [STRETCH-01] Push notifications for messages and claim status changes
Using Expo Push Notifications. Notify when: new message received, claim approved/rejected.

### [STRETCH-02] Map view for hotspots
Interactive map using `expo-location` + `react-native-maps` or `expo-maps`. Show hotspot pins.

### [STRETCH-03] Admin panel
Admin-role dashboard: browse all items, all users, bulk actions.

### [STRETCH-04] Item auto-archive after 30 days
Supabase scheduled function or edge function to move unclaimed items to `archived` status.

### [STRETCH-05] Full-text search improvements
Supabase `fts` (full-text search) on `items.title + items.description`. Filter by hotspot, date range.

---

## Completed

- [x] Core feed with 2-column grid, search bar, category filter
- [x] Item posting flow (photo, title, category, location, custom verification questions, hotspot picker)
- [x] Claim submission flow with custom question answering
- [x] Real-time message thread screen (`src/app/messages/[claimId].tsx`) — code complete; needs RLS + Realtime config (see QOL-03)
- [x] Staff dashboard: hotspot drop-off logging
- [x] Staff verify screen: ID Analyzer integration + identity_records with SHA-256 hashed doc numbers
- [x] Theft claim report modal on item detail
- [x] Dev bypass login (DEV_MODE) with configurable credentials via `.env`
- [x] Facebook Marketplace-inspired UI design system (colors, spacing, typography)
- [x] Web sidebar navigation (`_layout.web.tsx` + `Sidebar.tsx`)
- [x] Supabase schema + RLS policy definitions (`supabase-setup.sql`)
- [x] TypeScript types for all DB tables (`src/types/index.ts`)
- [x] Documentation consolidated: README.md (quick start), PROJECT.md (full reference), BACKLOG.md (this file)
- [x] Teacher account system: campus codes, hotspot_managers table, staff role via signup code (FEAT-00)
- [x] 5 UDEL hotspots seeded into DB (FEAT-01)
- [x] Staff tab (tabs/staff.tsx): managed hotspot chips, claims list, co-managers section, Advanced Dashboard link
- [x] Tabs layout: Staff tab conditionally visible only to staff/admin roles
- [x] Dev mode: Teacher Test Login button + DB status badge on login/signup screens
- [x] select-hotspot.tsx: post-signup hotspot selection screen for new teacher accounts
- [x] StaffGuard component: role-gated wrapper for staff-only screens
- [x] Delete Post gating: poster loses delete when item is `at_hotspot`; hotspot manager retains it
- [x] Archive system message updated to "The finder has archived this post. Existing chats remain available."
- [x] Inbox Archived view: 3-dot now unarchives (↩) instead of trying to re-archive
- [x] Revert to Unclaimed: amber button in resolution bar when claim is `awaiting_in_person`; restores all rejected claims + item status
- [x] BUG-09: Post → error page — ambiguous `profiles(*)` FK fixed to `profiles!poster_id(*)` in item/[id] and index
- [x] BUG-10: Chat archive 3-dot menu silent on web — explicit `window.confirm` on web
- [x] BUG-11: Deleted-post chat header navigates to error — disabled + shows "Post deleted" notice
- [x] BUG-01: Claim button reappears — fixed by updating item status to `pending` in `claim/[id].tsx` on submit, and checking `existingClaim` in `item/[id].tsx`
- [x] BUG-03: Back button crash after posting — fixed with `router.canGoBack()` guard in `item/[id].tsx`
- [x] QOL-07: `useCallback` inside JSX `onRefresh` in `staff.tsx` — extracted to `handleRefresh` at component level
- [x] Post archive: soft-delete via `deleted_at` + system message + read-only deleted badge (item/[id].tsx)
- [x] Chat archive: per-user `claim_chat_hides`, Active/Archived inbox toggle, revive-on-reply, full-delete when all archive (messages.tsx)
- [x] Home feed: Active/Archived toggle, Archived shows only current user's own deleted posts
- [x] BUG-RLS-01: Student poster could not see claims on their own items — `claims_select` RLS only allowed claimants and staff. Fixed by adding item poster condition: `exists (select 1 from items where items.id = item_id and auth.uid() = (select user_id from profiles where id = items.poster_id))`. SQL migration must be run in Supabase dashboard.
- [x] Inbox routing: direct item claims (no hotspot) now correctly appear in poster's "Items I posted or manage" section; hotspot items only appear for the hotspot manager, not the original poster
- [x] Hotspot manager query fix: `.in("items.hotspot_id", ...)` is invalid PostgREST syntax — replaced with a two-step fetch: get item IDs for managed hotspots first, then `.in("item_id", managedItemIds)`
- [x] Withdraw Claim: claimant can withdraw a `pending` claim from the message thread. Inserts a gray system bubble "The claimant has withdrawn their claim.", soft-closes claim to `withdrawn` status (preserves message history), restores item to `unclaimed` if no other active claims remain, auto-archives the chat for the claimant and switches inbox to Archived tab
- [x] Unarchive reactivates withdrawn claim: tapping ↩ on an archived withdrawn claim restores claim status to `pending` (re-shows Withdraw Claim button) and switches inbox back to Active
- [x] `claim_status` enum: added `withdrawn` value — must run `alter type claim_status add value 'withdrawn';` in Supabase SQL Editor
- [x] `ClaimStatusBadge`: added `withdrawn` entry (gray, label "Withdrawn")
- [x] Withdrawn claims always appear in Archived tab regardless of message activity (fixed filter logic in both `nextThreads` and `groupedThreads`)
- [x] Delete Post button on web: `Alert.alert` unreliable on web — added explicit `window.confirm` branch in `confirmDeletePost` (`item/[id].tsx`)
- [x] Feed archived tab: claimed items moved from active feed to Archived tab; active feed now only shows `unclaimed | at_hotspot | pending` statuses; Archived = deleted posts (non-hotspot) + claimed direct posts + claimed hotspot items for managed hotspots, deduplicated by Map
- [x] Hotspot items excluded from poster's profile Active/Archived views — poster only sees their own directly-managed posts (`hotspot_id IS NULL`); hotspot manager sees hotspot items via staff tab instead
- [x] Hide claimant name for hotspot items in inbox: when item is `at_hotspot`, thread meta shows only the hotspot name — no claimant's display name shown to the hotspot manager
- [x] QOL-06: Profile page rewritten — 2-column `ItemCard` grid (same as home feed), Active/Archived toggle, clicking card navigates to item detail, `useFocusEffect` for tab-focus refresh
- [x] Inline edit on item detail: Edit button appears on owner's non-archived non-hotspot items; edit mode shows inline inputs for title, description, and custom questions (add/remove/reorder, max 5); Save/Cancel in header; updates Supabase `items` table and refreshes all views
- [x] Restore Post: green "Restore Post" button appears on archived/deleted items for the owner; clears `deleted_at`/`deleted_by` in Supabase and shows item as active again
- [x] BUG-FK-01: "Failed to load item" error on owner's item detail — `claims` has two FKs to `profiles` (`claimant_id` and `reviewed_by`), making `.select("*, profiles(*)")` ambiguous in PostgREST. Fixed by changing to `.select("*, profiles!claimant_id(*)")` in `fetchData()` in `item/[id].tsx`
- [x] Pending claims panel hidden for hotspot items: `isOwner && !isArchived && !itemIsAtHotspot` guard so original poster doesn't see claim list for items the hotspot manager now controls
- [x] `canResolveSelected` in messages.tsx: poster loses resolution buttons when item is `at_hotspot`; only hotspot manager can mark pending/picked up for those items
