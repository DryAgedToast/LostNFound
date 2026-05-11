import type { Profile, UserRole } from "@/types";
import { supabase } from "./supabase";

// DEV_MODE: shows dev bypass login button and developer features
export const DEV_MODE = process.env.EXPO_PUBLIC_DEV_MODE === "true";
// DEMO_MODE: uses mock/seed data when DB is empty, for presentations
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === "true";
export const DEV_LOGIN_EMAIL = process.env.EXPO_PUBLIC_DEV_LOGIN_EMAIL ?? "";
export const DEV_LOGIN_PASSWORD =
  process.env.EXPO_PUBLIC_DEV_LOGIN_PASSWORD ?? "";
const DEV_BYPASS_DISPLAY_NAME =
  process.env.EXPO_PUBLIC_DEV_BYPASS_DISPLAY_NAME ?? "Dev User";
export const DEV_TEACHER_EMAIL =
  process.env.EXPO_PUBLIC_DEV_TEACHER_EMAIL ?? "";
export const DEV_TEACHER_PASSWORD =
  process.env.EXPO_PUBLIC_DEV_TEACHER_PASSWORD ?? "";

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

    // Supabase Auth 500 errors — server-side issue, not a connectivity problem
    if (msg.includes("database error")) {
      return new Error(
        "Sign up is temporarily unavailable. Please try again in a moment.",
      );
    }
  }

  return new Error(
    "Something went wrong. Please check your connection and try again.",
  );
}

export async function devBypassLogin(): Promise<{
  profile: Profile;
  role: UserRole;
}> {
  // If we have real credentials, do a proper Supabase sign-in
  if (DEV_LOGIN_EMAIL.length > 0 && DEV_LOGIN_PASSWORD.length > 0) {
    return signIn(DEV_LOGIN_EMAIL, DEV_LOGIN_PASSWORD);
  }

  // Local-only bypass (no DB session), used only when no real dev credentials
  // are configured.
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

export async function devTeacherLogin(): Promise<{
  profile: Profile;
  role: UserRole;
}> {
  return signIn(DEV_TEACHER_EMAIL, DEV_TEACHER_PASSWORD);
}

export async function signUp(
  email: string,
  password: string,
  displayName: string,
  campusCode?: string,
): Promise<{ profile: Profile; isTeacher: boolean; campusCodeId?: string }> {
  try {
    let resolvedRole: UserRole = "student";
    let campusCodeId: string | undefined;

    if (campusCode) {
      const { data: codeData, error: codeError } = await supabase
        .from("campus_codes")
        .select("id, is_active")
        .eq("code", campusCode.trim().toUpperCase())
        .single();

      const codeRow = codeData as unknown as { id: string; is_active: boolean } | null;

      if (codeError || !codeRow) {
        throw new Error("Invalid or expired campus code.");
      }
      if (!codeRow.is_active) {
        throw new Error("This campus code has been deactivated.");
      }
      resolvedRole = "staff";
      campusCodeId = codeRow.id;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, role: resolvedRole },
      },
    });

    // "User already registered" means a previous signup created the auth user but
    // failed before writing the profile. Sign in with the same credentials to verify
    // ownership, then upsert the profile to recover.
    let userId: string;
    if (authError?.message.toLowerCase().includes("user already registered")) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      if (!signInData.user) throw new Error("Sign in failed");
      userId = signInData.user.id;
    } else {
      if (authError) throw authError;
      if (!authData.user) throw new Error("Sign up failed: no user returned");
      userId = authData.user.id;
    }

    // Upsert the profile so it's always created with the correct values even if
    // the handle_new_user trigger silently failed (e.g. search_path issue).
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        { user_id: userId, display_name: displayName, email, role: resolvedRole },
        { onConflict: "user_id" },
      )
      .select()
      .single();

    if (profileError) throw profileError;
    devSessionActive = false;
    return { profile: profile as Profile, isTeacher: resolvedRole === "staff", campusCodeId };
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
