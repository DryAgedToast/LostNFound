import type { Profile, UserRole } from "@/types";
import { supabase } from "./supabase";

export const DEV_MODE = process.env.EXPO_PUBLIC_DEV_MODE !== "false";
export const DEV_LOGIN_EMAIL = process.env.EXPO_PUBLIC_DEV_LOGIN_EMAIL ?? "";
export const DEV_LOGIN_PASSWORD =
  process.env.EXPO_PUBLIC_DEV_LOGIN_PASSWORD ?? "";
const DEV_BYPASS_DISPLAY_NAME =
  process.env.EXPO_PUBLIC_DEV_BYPASS_DISPLAY_NAME ?? "Dev User";

export const MOCK_USER: Profile = {
  id: "dev-bypass-user",
  user_id: "dev-bypass-user",
  display_name: DEV_BYPASS_DISPLAY_NAME,
  email: DEV_LOGIN_EMAIL,
  avatar_url: null,
  role: "student",
  created_at: new Date(0).toISOString(),
};
let devSessionActive = false;
let devBypassProfile: Profile = MOCK_USER;

function toUserFacingAuthError(error: unknown): Error {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("fetch failed") ||
      msg.includes("network request failed") ||
      msg.includes("enotfound") ||
      msg.includes("failed to fetch")
    ) {
      return new Error(
        "Cannot reach Supabase. Check EXPO_PUBLIC_SUPABASE_URL, internet connection, and DNS/project ref.",
      );
    }

    if (
      msg.includes("invalid login credentials") ||
      msg.includes("email not confirmed") ||
      msg.includes("user already registered")
    ) {
      return error;
    }
  }

  return new Error(
    "Unable to connect. Please check your internet connection.",
  );
}

export async function devBypassLogin(): Promise<{
  profile: Profile;
  role: UserRole;
}> {
  try {
    if (DEV_LOGIN_EMAIL.length > 0) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", DEV_LOGIN_EMAIL)
        .single();

      if (profile != null) {
        devBypassProfile = profile as Profile;
      }
    }
  } catch {
    // Keep local bypass active even when DB is unreachable.
  }

  devSessionActive = true;
  return { profile: devBypassProfile, role: devBypassProfile.role };
}

export async function signUp(
  email: string,
  password: string,
  displayName: string,
): Promise<Profile> {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError) throw authError;
    if (!authData.user) throw new Error("Sign up failed: no user returned");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        user_id: authData.user.id,
        display_name: displayName,
        email,
        role: "student" as UserRole,
      })
      .select()
      .single();

    if (profileError) throw profileError;
    // If a real auth session is created, stop using any demo bypass session.
    devSessionActive = false;
    return profile as Profile;
  } catch (error: unknown) {
    throw toUserFacingAuthError(error);
  }
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ profile: Profile; role: UserRole }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (!data.user) throw new Error("Sign in failed");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", data.user.id)
      .single();

    if (profileError) throw profileError;
    // If sign-in succeeded, prefer real auth-backed data paths.
    devSessionActive = false;
    return { profile: profile as Profile, role: (profile as Profile).role };
  } catch (error: unknown) {
    throw toUserFacingAuthError(error);
  }
}

export async function signOut(): Promise<void> {
  if (DEV_MODE && devSessionActive) {
    devSessionActive = false;
    return;
  }
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error: unknown) {
    throw toUserFacingAuthError(error);
  }
}

export async function getCurrentProfile(): Promise<Profile | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      if (DEV_MODE && devSessionActive) return devBypassProfile;
      return null;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    return (profile as Profile) ?? null;
  } catch {
    return null;
  }
}

export async function getSession() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) return session;
    if (DEV_MODE && devSessionActive) {
      return { user: { id: devBypassProfile.user_id } };
    }
    return session;
  } catch {
    if (DEV_MODE && devSessionActive) {
      return { user: { id: devBypassProfile.user_id } };
    }
    return null;
  }
}
