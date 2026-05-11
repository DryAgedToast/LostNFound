import ItemCard from "@/components/ItemCard";
import { Colors, Spacing } from "@/constants/theme";
import { DEMO_MODE, getCurrentProfile, signOut } from "@/lib/auth";
import {
  isDatabaseUnavailableError,
  showDatabaseNotConnectedPopup,
} from "@/lib/db-alert";
import { supabase } from "@/lib/supabase";
import type { ItemWithPoster, Profile, UserRole } from "@/types";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type PostsView = "active" | "archived";

const ROLE_BADGE: Record<
  UserRole,
  { label: string; background: string; text: string }
> = {
  student: { label: "Student", background: "#E4E6EB", text: "#1877F2" },
  staff: { label: "Staff", background: "#E4E6EB", text: "#1877F2" },
  admin: { label: "Admin", background: "#E4E6EB", text: "#65676B" },
};

export default function ProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];

  const [profile, setProfile] = useState<Profile | null>(null);
  const [activePosts, setActivePosts] = useState<ItemWithPoster[]>([]);
  const [archivedPosts, setArchivedPosts] = useState<ItemWithPoster[]>([]);
  const [postsView, setPostsView] = useState<PostsView>("active");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const currentProfile = await getCurrentProfile();
      if (!currentProfile) {
        router.replace("/auth/login");
        return;
      }
      setProfile(currentProfile);

      if (DEMO_MODE) {
        setActivePosts([]);
        setArchivedPosts([]);
        return;
      }

      const sel = "*, profiles!poster_id(*), hotspots(*)";

      const [activeRes, deletedRes, claimedRes] = await Promise.all([
        // Active: direct posts (no hotspot) that are unclaimed or pending
        supabase
          .from("items")
          .select(sel)
          .eq("poster_id", currentProfile.id)
          .is("deleted_at", null)
          .is("hotspot_id", null)
          .in("status", ["unclaimed", "pending"])
          .order("created_at", { ascending: false }),
        // Archived: soft-deleted direct posts
        supabase
          .from("items")
          .select(sel)
          .eq("poster_id", currentProfile.id)
          .not("deleted_at", "is", null)
          .is("hotspot_id", null)
          .order("deleted_at", { ascending: false }),
        // Archived: claimed direct posts
        supabase
          .from("items")
          .select(sel)
          .eq("poster_id", currentProfile.id)
          .eq("status", "claimed")
          .is("deleted_at", null)
          .is("hotspot_id", null)
          .order("created_at", { ascending: false }),
      ]);

      if (activeRes.error) throw activeRes.error;
      if (deletedRes.error) throw deletedRes.error;
      if (claimedRes.error) throw claimedRes.error;

      setActivePosts((activeRes.data ?? []) as unknown as ItemWithPoster[]);

      const archivedById = new Map<string, ItemWithPoster>();
      for (const item of (deletedRes.data ?? []) as unknown as ItemWithPoster[]) {
        archivedById.set(item.id, item);
      }
      for (const item of (claimedRes.data ?? []) as unknown as ItemWithPoster[]) {
        archivedById.set(item.id, item);
      }
      setArchivedPosts([...archivedById.values()]);
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        showDatabaseNotConnectedPopup();
      }
      setError(err instanceof Error ? err.message : "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      router.replace("/auth/login");
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        showDatabaseNotConnectedPopup();
      }
      setError(err instanceof Error ? err.message : "Sign out failed.");
      setLoggingOut(false);
    }
  };

  const styles = makeStyles(colors);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1877F2" />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) return null;

  const badge = ROLE_BADGE[profile.role];
  const posts = postsView === "active" ? activePosts : archivedPosts;

  // Pair items into rows of 2 for the grid
  const rows: [ItemWithPoster, ItemWithPoster | null][] = [];
  for (let i = 0; i < posts.length; i += 2) {
    rows.push([posts[i], posts[i + 1] ?? null]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile header */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {profile.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.displayName}>{profile.display_name}</Text>
          <Text style={styles.email}>{profile.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: badge.background }]}>
            <Text style={[styles.roleBadgeText, { color: badge.text }]}>
              {badge.label}
            </Text>
          </View>
        </View>

        {error !== null && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Member since</Text>
            <Text style={styles.infoValue}>
              {new Date(profile.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Account ID</Text>
            <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
              {profile.user_id}
            </Text>
          </View>
        </View>

        {(profile.role === "staff" || profile.role === "admin") && (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => router.push("/staff/dashboard")}
            activeOpacity={0.8}
          >
            <Text style={styles.menuButtonText}>Staff Dashboard</Text>
            <Text style={styles.menuButtonChevron}>›</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.logoutButton, loggingOut && styles.buttonDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.8}
        >
          {loggingOut ? (
            <ActivityIndicator color="#65676B" />
          ) : (
            <Text style={styles.logoutText}>Log Out</Text>
          )}
        </TouchableOpacity>

        {/* My Posts */}
        <View style={styles.postsSectionHeader}>
          <Text style={styles.postsSectionTitle}>My Posts</Text>
          <View style={styles.postsSwitch}>
            <TouchableOpacity
              style={[
                styles.postsSwitchButton,
                postsView === "active" && styles.postsSwitchButtonActive,
              ]}
              onPress={() => setPostsView("active")}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.postsSwitchText,
                  { color: postsView === "active" ? "#FFFFFF" : colors.textSecondary },
                ]}
              >
                Active
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.postsSwitchButton,
                postsView === "archived" && styles.postsSwitchButtonActive,
              ]}
              onPress={() => setPostsView("archived")}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.postsSwitchText,
                  { color: postsView === "archived" ? "#FFFFFF" : colors.textSecondary },
                ]}
              >
                Archived
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {posts.length === 0 ? (
          <Text style={styles.emptyText}>
            {postsView === "active" ? "No active posts yet" : "No archived posts yet"}
          </Text>
        ) : (
          rows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.gridRow}>
              {row.map((item, colIndex) =>
                item === null ? (
                  <View key={`empty-${colIndex}`} style={styles.gridCell} />
                ) : (
                  <View key={item.id} style={styles.gridCell}>
                    <ItemCard
                      item={item}
                      onPress={() => router.push(`/item/${item.id}`)}
                    />
                  </View>
                ),
              )}
            </View>
          ))
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

function makeStyles(colors: typeof Colors.light) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    scrollContent: {
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.four,
      paddingBottom: Spacing.six,
    },
    avatarSection: { alignItems: "center", marginBottom: Spacing.four },
    avatarCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: "#1877F2",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: Spacing.three,
    },
    avatarInitial: { fontSize: 32, fontWeight: "700", color: "#FFFFFF" },
    displayName: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
      marginBottom: Spacing.one,
    },
    email: { fontSize: 14, color: colors.textSecondary, marginBottom: Spacing.two },
    roleBadge: {
      borderRadius: 20,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.one,
      marginTop: Spacing.two,
    },
    roleBadgeText: { fontSize: 13, fontWeight: "700" },
    errorBox: {
      backgroundColor: "#E4E6EB",
      borderRadius: 8,
      padding: Spacing.three,
      marginBottom: Spacing.three,
    },
    errorText: { color: "#65676B", fontSize: 14 },
    infoCard: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      padding: Spacing.three,
      marginBottom: Spacing.three,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: Spacing.two,
    },
    infoKey: { fontSize: 14, color: colors.textSecondary, flex: 1 },
    infoValue: {
      fontSize: 14,
      color: colors.text,
      fontWeight: "500",
      flex: 2,
      textAlign: "right",
    },
    divider: { height: 1, backgroundColor: colors.backgroundSelected },
    menuButton: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 10,
      paddingVertical: Spacing.three,
      paddingHorizontal: Spacing.three,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: Spacing.two,
    },
    menuButtonText: { fontSize: 16, fontWeight: "600", color: "#1877F2" },
    menuButtonChevron: { fontSize: 20, color: "#1877F2", fontWeight: "300" },
    logoutButton: {
      borderWidth: 1.5,
      borderColor: "#65676B",
      borderRadius: 10,
      paddingVertical: Spacing.three,
      alignItems: "center",
      marginBottom: Spacing.five,
    },
    logoutText: { color: "#65676B", fontSize: 16, fontWeight: "700" },
    buttonDisabled: { opacity: 0.5 },
    postsSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: Spacing.three,
      paddingHorizontal: Spacing.one,
    },
    postsSectionTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
    postsSwitch: {
      flexDirection: "row",
      backgroundColor: "#E4E6EB",
      borderRadius: 10,
      padding: 3,
    },
    postsSwitchButton: {
      borderRadius: 8,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.one,
    },
    postsSwitchButtonActive: { backgroundColor: "#1877F2" },
    postsSwitchText: { fontSize: 13, fontWeight: "700" },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontStyle: "italic",
      textAlign: "center",
      marginTop: Spacing.four,
    },
    gridRow: {
      flexDirection: "row",
      marginBottom: 0,
    },
    gridCell: {
      flex: 1,
      position: "relative",
    },
  });
}
