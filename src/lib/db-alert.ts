import { Alert, Platform } from "react-native";

const DB_NOT_CONNECTED_MESSAGE =
  "Login is only available when database is connected. Currently in demo mode.";

export function isDatabaseUnavailableError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes("cannot reach supabase") ||
    message.includes("fetch failed") ||
    message.includes("network request failed") ||
    message.includes("enotfound") ||
    message.includes("failed to fetch") ||
    message.includes("unable to connect") ||
    message.includes("check your connection")
  );
}

export function showDatabaseNotConnectedPopup() {
  if (Platform.OS === "web" && typeof globalThis.alert === "function") {
    globalThis.alert(DB_NOT_CONNECTED_MESSAGE);
    return;
  }

  Alert.alert("Database Not Connected", DB_NOT_CONNECTED_MESSAGE);
}
