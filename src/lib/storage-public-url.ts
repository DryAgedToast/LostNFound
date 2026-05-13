/**
 * Item images are stored as public object URLs. If the DB has URLs from a
 * different origin (local Supabase, emulator loopback, etc.) but the app is
 * configured for a hosted project, remap to EXPO_PUBLIC_SUPABASE_URL so
 * devices can actually fetch the bytes.
 */
export function resolveSupabaseItemImageUrl(
  url: string | null | undefined,
): string | null {
  if (url == null || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const rawBase = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  if (!rawBase) return trimmed;

  const base = new URL(rawBase.startsWith("http") ? rawBase : `https://${rawBase}`);

  // Storage object key only (no scheme) — build public URL
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    const key = trimmed.replace(/^\/+/, "").replace(/^item-images\//, "");
    if (key.length > 0 && !key.includes("://") && !key.includes(" ")) {
      return `${base.origin}/storage/v1/object/public/item-images/${key}`;
    }
    return trimmed;
  }

  const itemImagesSegment = "/storage/v1/object/public/item-images/";
  if (!trimmed.includes(itemImagesSegment)) return trimmed;

  try {
    const parsed = new URL(trimmed);
    if (!parsed.pathname.includes(itemImagesSegment)) return trimmed;

    const localish =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "10.0.2.2" ||
      parsed.hostname.endsWith(".local");

    if (localish || parsed.origin !== base.origin) {
      return `${base.origin}${parsed.pathname}${parsed.search}`;
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}
