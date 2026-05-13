import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
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

function appScheme(): string {
  const s = Constants.expoConfig?.scheme;
  if (typeof s === "string" && s.length > 0) return s;
  if (Array.isArray(s) && s.length > 0 && typeof s[0] === "string") return s[0];
  return "lostnfound";
}

/**
 * Must match `stripe-identity-return` Location for native (lostnfound://…).
 * Expo Go uses exp://… which will not match; use a dev build or web for Identity.
 */
function nativeStripeIdentityRedirectUrl(body: {
  item_id?: string;
  claim_id?: string;
}): string | undefined {
  const scheme = appScheme();
  if (typeof body.item_id === "string") {
    return `${scheme}://claim/${body.item_id}`;
  }
  if (typeof body.claim_id === "string") {
    return `${scheme}://staff/verify?claimId=${encodeURIComponent(body.claim_id)}`;
  }
  return undefined;
}

function webStripeIdentityRedirectUrl(body: {
  item_id?: string;
  claim_id?: string;
}): string | undefined {
  if (typeof body.item_id === "string") {
    return Linking.createURL(`/claim/${body.item_id}`);
  }
  if (typeof body.claim_id === "string") {
    return Linking.createURL("/staff/verify", {
      queryParams: { claimId: body.claim_id },
    });
  }
  return undefined;
}

/**
 * Optional HTTPS bridge for Stripe `return_url` when using a custom hosted page
 * (sets `claim_item_id` on `EXPO_PUBLIC_STRIPE_IDENTITY_RETURN_URL`).
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
  const authSessionRedirectUrl =
    Platform.OS === "web"
      ? webStripeIdentityRedirectUrl(body)
      : nativeStripeIdentityRedirectUrl(body);

  if (!authSessionRedirectUrl) {
    return {
      ok: false,
      error:
        "Missing item_id or claim_id for redirect. Redeploy create-stripe-identity-session if needed.",
    };
  }

  const invokeBody: Record<string, unknown> = { ...body };
  if (
    Platform.OS === "web" &&
    (authSessionRedirectUrl.startsWith("https:") ||
      authSessionRedirectUrl.startsWith("http://"))
  ) {
    invokeBody.web_completion_url = authSessionRedirectUrl;
  }

  const { data, error } = await supabase.functions.invoke<{
    url?: string;
    verification_session_id?: string;
    stripe_return_url?: string;
    error?: string;
  }>("create-stripe-identity-session", { body: invokeBody });

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

  const browserResult = await WebBrowser.openAuthSessionAsync(
    url,
    authSessionRedirectUrl,
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
