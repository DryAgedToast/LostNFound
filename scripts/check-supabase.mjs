import { createClient } from "@supabase/supabase-js";
import { lookup } from "node:dns/promises";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY/ANON_KEY");
  process.exit(1);
}

const host = supabaseUrl.replace(/^https?:\/\//, "").split("/")[0];
console.log("Supabase URL:", supabaseUrl);
console.log("Host:", host);

try {
  const dns = await lookup(host);
  console.log("DNS: OK", dns.address);
} catch (error) {
  console.error("DNS: FAIL", error.message);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

try {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Auth API: FAIL", error.message);
    process.exit(1);
  }
  console.log("Auth API: OK");
  console.log("Session:", data.session ? "present" : "none");
} catch (error) {
  console.error("Auth API: FAIL", error.message);
  process.exit(1);
}

console.log("Supabase connectivity check passed.");
