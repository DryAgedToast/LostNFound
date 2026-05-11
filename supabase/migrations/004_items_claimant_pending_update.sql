-- Claim flow updates item to "pending" after inserting a claim; only poster/staff
-- could update items before, so claimants hit RLS. Allow this specific transition.

DROP POLICY IF EXISTS "items_update_claimant_pending" ON items;

CREATE POLICY "items_update_claimant_pending" ON items
FOR UPDATE
USING (
  status IN ('unclaimed', 'at_hotspot')
  AND EXISTS (
    SELECT 1
    FROM claims c
    WHERE c.item_id = items.id
      AND c.claimant_id = current_profile_id()
      AND c.status = 'pending'
  )
)
WITH CHECK (status = 'pending');
