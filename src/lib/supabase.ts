import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Use placeholder URLs for demo mode when env vars are missing
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://demo.supabase.co";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "demo-key-placeholder";

if (
  !process.env.EXPO_PUBLIC_SUPABASE_URL ||
  !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
) {
  console.warn(
    "[LostNFound] Supabase env vars are missing. Running in offline-safe mode.",
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
