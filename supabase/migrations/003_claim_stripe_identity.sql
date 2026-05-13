-- Stripe Identity session created before/during claim (hosted flow).
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS stripe_verification_session_id TEXT;

COMMENT ON COLUMN claims.stripe_verification_session_id IS
  'Stripe Identity VerificationSession id (vs_...) when claimant verified via Stripe before submitting.';

