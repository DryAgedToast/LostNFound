import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

export type StripeIdentitySessionResult =
  | { ok: true; verificationSessionId: string | undefined }
  | { ok: false; error: string };

/** Supabase FunctionsHttpError carries the Response in `context`. */
async function messageFromInvokeError(error: unknown): Promise<string | null> {
  if (!error || typeof error !== "object") return null;
  const e = error as { name?: string; context?: unknown };
  if (e.name !== "FunctionsHttpError" || !(e.context instanceof Response)) {
    return null;
  }
  try {
    const json = (await e.context.clone().json()) as { error?: unknown };
    if (typeof json.error === "string") return json.error;
  } catch {
    try {
      const text = await (e.context as Response).clone().text();
      if (text) return text.slice(0, 400);
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Optional override: HTTPS page used as Stripe `return_url` and as the second
 * argument to `openAuthSessionAsync` (must match Stripe’s redirect exactly).
 * Normally the Edge Function returns `stripe_return_url` (Supabase-hosted HTTPS)
 * so you do not need to set this.
 */
function claimReturnUrlFallback(itemId: string): string {
  const bridge = process.env.EXPO_PUBLIC_STRIPE_IDENTITY_RETURN_URL?.trim();
  if (bridge) {
    const u = new URL(bridge);
    u.searchParams.set("claim_item_id", itemId);
    return u.toString();
  }
  return Linking.createURL(`/claim/${itemId}`);
}

async function invokeCreateSession(body: {
  return_url?: string;
  claim_id?: string;
  item_id?: string;
}): Promise<StripeIdentitySessionResult> {
  const { data, error } = await supabase.functions.invoke<{
    url?: string;
    verification_session_id?: string;
    stripe_return_url?: string;
    error?: string;
  }>("create-stripe-identity-session", { body });

  if (error) {
    const detail = await messageFromInvokeError(error);
    return {
      ok: false,
      error:
        detail ??
        error.message ??
        "Could not start Stripe Identity (Edge Function error).",
    };
  }

  if (data?.error) {
    return { ok: false, error: data.error };
  }

  const url = data?.url;
  if (!url) {
    return { ok: false, error: "No verification URL returned" };
  }

  // Must match the `return_url` sent to Stripe (HTTPS). Edge returns this;
  // fall back for older deployed functions.
  const redirectUrl =
    data.stripe_return_url ??
    body.return_url ??
    (body.item_id ? claimReturnUrlFallback(body.item_id) : undefined);
  if (!redirectUrl) {
    return {
      ok: false,
      error:
        "Missing redirect URL. Redeploy Edge Functions (create-stripe-identity-session + stripe-identity-return).",
    };
  }

  const browserResult = await WebBrowser.openAuthSessionAsync(url, redirectUrl);

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
  return invokeCreateSession({
    claim_id: claimId,
    return_url: Linking.createURL("/staff/verify", {
      queryParams: { claimId },
    }),
  });
}

/**
 * Claimant: Identity session before submitting a claim (returns to this item’s claim screen).
 */
export async function openStripeIdentityBeforeClaim(
  itemId: string,
): Promise<StripeIdentitySessionResult> {
  return invokeCreateSession({
    item_id: itemId,
    return_url: claimReturnUrlFallback(itemId),
  });
}
