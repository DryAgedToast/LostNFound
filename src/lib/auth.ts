import type { Profile, UserRole } from "@/types";
import { supabase } from "./supabase";

// DEV BYPASS — remove before production
export const DEV_MODE = true;
export const MOCK_USER: Profile = {
  id: "dev-user-001",
  user_id: "dev-user-001",
  display_name: "Test User",
  email: "test@example.com",
  avatar_url: null,
  role: "student",
  created_at: new Date(0).toISOString(),
};
let devSessionActive = true;

export async function signUp(
  email: string,
  password: string,
  displayName: string,
): Promise<Profile> {
  if (DEV_MODE) {
    devSessionActive = true;
    return {
      ...MOCK_USER,
      email,
      display_name: displayName || MOCK_USER.display_name,
    };
  }

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
    return profile as Profile;
  } catch {
    throw new Error(
      "Unable to connect. Please check your internet connection.",
    );
  }
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ profile: Profile; role: UserRole }> {
  if (DEV_MODE) {
    devSessionActive = true;
    return { profile: MOCK_USER, role: MOCK_USER.role };
  }

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
    return { profile: profile as Profile, role: (profile as Profile).role };
  } catch {
    throw new Error(
      "Unable to connect. Please check your internet connection.",
    );
  }
}

export async function signOut(): Promise<void> {
  if (DEV_MODE) {
    devSessionActive = false;
    return;
  }
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch {
    throw new Error(
      "Unable to connect. Please check your internet connection.",
    );
  }
}

export async function getCurrentProfile(): Promise<Profile | null> {
  if (DEV_MODE) return devSessionActive ? MOCK_USER : null;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

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
  if (DEV_MODE) {
    return devSessionActive ? { user: { id: MOCK_USER.user_id } } : null;
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  } catch {
    return null;
  }
}
