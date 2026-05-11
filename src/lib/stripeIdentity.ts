import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

export type StripeIdentitySessionResult =
  | { ok: true; verificationSessionId: string | undefined }
  | { ok: false; error: string };

async function invokeCreateSession(body: {
  return_url: string;
  claim_id?: string;
  item_id?: string;
}): Promise<StripeIdentitySessionResult> {
  const { data, error } = await supabase.functions.invoke<{
    url?: string;
    verification_session_id?: string;
    error?: string;
  }>("create-stripe-identity-session", { body });

  if (error) {
    return {
      ok: false,
      error: error.message ?? "Could not start Stripe Identity",
    };
  }

  if (data?.error) {
    return { ok: false, error: data.error };
  }

  const url = data?.url;
  if (!url) {
    return { ok: false, error: "No verification URL returned" };
  }

  const browserResult = await WebBrowser.openAuthSessionAsync(
    url,
    body.return_url,
  );

  if (browserResult.type === "success") {
    return {
      ok: true,
      verificationSessionId: data?.verification_session_id,
    };
  }

  const message =
    browserResult.type === "cancel"
      ? "Verification was cancelled"
      : "Verification did not complete";
  return { ok: false, error: message };
}

/**
 * Staff: Identity session for an existing claim (returns to staff verify screen).
 */
export async function openStripeIdentityForClaim(
  claimId: string,
): Promise<StripeIdentitySessionResult> {
  const returnUrl = Linking.createURL("/staff/verify", {
    queryParams: { claimId },
  });
  return invokeCreateSession({ claim_id: claimId, return_url: returnUrl });
}

/**
 * Claimant: Identity session before submitting a claim (returns to this item’s claim screen).
 */
export async function openStripeIdentityBeforeClaim(
  itemId: string,
): Promise<StripeIdentitySessionResult> {
  const returnUrl = Linking.createURL(`/claim/${itemId}`);
  return invokeCreateSession({ item_id: itemId, return_url: returnUrl });
}
