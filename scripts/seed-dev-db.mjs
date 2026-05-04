import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const seedEmail = process.env.DEV_SEED_LOGIN_EMAIL;
const seedPassword = process.env.DEV_SEED_LOGIN_PASSWORD;
const seedDisplayName = process.env.DEV_SEED_DISPLAY_NAME || "Dev Test User";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase URL/public key in environment.");
}
if (!seedEmail || !seedPassword) {
  throw new Error(
    "Missing DEV_SEED_LOGIN_EMAIL / DEV_SEED_LOGIN_PASSWORD in environment.",
  );
}

const publicClient = createClient(supabaseUrl, supabaseAnonKey);

async function ensureDevAuthUser() {
  const { data: signInData, error: signInError } =
    await publicClient.auth.signInWithPassword({
      email: seedEmail,
      password: seedPassword,
    });

  if (!signInError && signInData.user) {
    return signInData.user;
  }

  const { data: signUpData, error: signUpError } = await publicClient.auth.signUp({
    email: seedEmail,
    password: seedPassword,
  });

  if (signUpError && !signUpError.message.toLowerCase().includes("already")) {
    throw signUpError;
  }

  const { data: retryData, error: retryError } =
    await publicClient.auth.signInWithPassword({
      email: seedEmail,
      password: seedPassword,
    });

  if (retryError || !retryData.user) {
    throw retryError || new Error("Unable to sign in dev seed user.");
  }

  return retryData.user;
}

async function ensureProfile(userId) {
  const { data: existing } = await publicClient
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (existing) {
    return existing;
  }

  const { data: inserted, error } = await publicClient
    .from("profiles")
    .insert({
      user_id: userId,
      display_name: seedDisplayName,
      email: seedEmail,
      role: "student",
    })
    .select("*")
    .single();

  if (error) throw error;
  return inserted;
}

async function ensureItems(profileId) {
  const fillerItems = [
    {
      title: "Black Water Bottle",
      description: "Found near Engineering building entrance.",
      category: "other",
      location_found: "Engineering Entrance",
    },
    {
      title: "Silver Laptop Charger",
      description: "Found in library study room.",
      category: "electronics",
      location_found: "Main Library",
    },
    {
      title: "Blue Backpack",
      description: "Found in cafeteria seating area.",
      category: "bag",
      location_found: "Student Center Cafeteria",
    },
  ];

  for (const item of fillerItems) {
    const { data: found } = await publicClient
      .from("items")
      .select("id")
      .eq("poster_id", profileId)
      .eq("title", item.title)
      .limit(1)
      .single();

    if (found) continue;

    const { error } = await publicClient.from("items").insert({
      poster_id: profileId,
      title: item.title,
      description: item.description,
      category: item.category,
      location_found: item.location_found,
      status: "unclaimed",
      custom_questions: [],
    });

    if (error) throw error;
  }
}

async function main() {
  const user = await ensureDevAuthUser();
  const profile = await ensureProfile(user.id);
  await ensureItems(profile.id);

  console.log("Dev seed complete:");
  console.log(`- user: ${seedEmail}`);
  console.log(`- profile_id: ${profile.id}`);
  console.log("- filler items ensured: 3");
}

main().catch((error) => {
  console.error("Dev seed failed:", error?.message ?? error);
  process.exit(1);
});
