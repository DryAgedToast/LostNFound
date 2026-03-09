import { Colors, Spacing } from "@/constants/theme";
import { DEV_MODE, getCurrentProfile, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Profile, UserRole } from "@/types";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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

const ROLE_BADGE: Record<
  UserRole,
  { label: string; background: string; text: string }
> = {
  student: { label: "Student", background: "#EBF4FD", text: "#208AEF" },
  staff: { label: "Staff", background: "#FEF3E2", text: "#D97706" },
  admin: { label: "Admin", background: "#FDECEC", text: "#C0392B" },
};

export default function ProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [profile, setProfile] = useState<Profile | null>(null);
  const [itemCount, setItemCount] = useState<number>(0);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoadingProfile(true);
    setError(null);
    try {
      const currentProfile = await getCurrentProfile();
      if (!currentProfile) {
        router.replace("/auth/login");
        return;
      }
      setProfile(currentProfile);

      if (DEV_MODE) {
        setItemCount(0);
      } else {
        const { count, error: countError } = await supabase
          .from("items")
          .select("id", { count: "exact", head: true })
          .eq("poster_id", currentProfile.id);

        if (countError) throw countError;
        setItemCount(count ?? 0);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load profile.";
      setError(message);
    } finally {
      setLoadingProfile(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      router.replace("/auth/login");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign out failed.";
      setError(message);
      setLoggingOut(false);
    }
  };

  const styles = makeStyles(colors);

  if (loadingProfile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return null;
  }

  const badge = ROLE_BADGE[profile.role];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {profile.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.displayName}>{profile.display_name}</Text>
          <Text style={styles.email}>{profile.email}</Text>

          <View
            style={[styles.roleBadge, { backgroundColor: badge.background }]}
          >
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

        <View style={styles.statsCard}>
          <Text style={styles.statsValue}>{itemCount}</Text>
          <Text style={styles.statsLabel}>Items Posted</Text>
        </View>

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
            <Text
              style={styles.infoValue}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {profile.user_id}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, loggingOut && styles.buttonDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.8}
        >
          {loggingOut ? (
            <ActivityIndicator color="#C0392B" />
          ) : (
            <Text style={styles.logoutText}>Log Out</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: typeof Colors.light) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    scrollContent: {
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.five,
    },
    avatarSection: {
      alignItems: "center",
      marginBottom: Spacing.five,
    },
    avatarCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: "#208AEF",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: Spacing.three,
    },
    avatarInitial: {
      fontSize: 32,
      fontWeight: "700",
      color: "#ffffff",
    },
    displayName: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
      marginBottom: Spacing.one,
    },
    email: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: Spacing.two,
    },
    roleBadge: {
      borderRadius: 20,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.one,
      marginTop: Spacing.two,
    },
    roleBadgeText: {
      fontSize: 13,
      fontWeight: "700",
    },
    errorBox: {
      backgroundColor: "#FDECEA",
      borderRadius: 8,
      padding: Spacing.three,
      marginBottom: Spacing.three,
    },
    errorText: {
      color: "#C0392B",
      fontSize: 14,
    },
    statsCard: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      padding: Spacing.four,
      alignItems: "center",
      marginBottom: Spacing.three,
    },
    statsValue: {
      fontSize: 36,
      fontWeight: "800",
      color: "#208AEF",
    },
    statsLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: Spacing.one,
    },
    infoCard: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      padding: Spacing.three,
      marginBottom: Spacing.five,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: Spacing.two,
    },
    infoKey: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1,
    },
    infoValue: {
      fontSize: 14,
      color: colors.text,
      fontWeight: "500",
      flex: 2,
      textAlign: "right",
    },
    divider: {
      height: 1,
      backgroundColor: colors.backgroundSelected,
    },
    logoutButton: {
      borderWidth: 1.5,
      borderColor: "#C0392B",
      borderRadius: 10,
      paddingVertical: Spacing.three,
      alignItems: "center",
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    logoutText: {
      color: "#C0392B",
      fontSize: 16,
      fontWeight: "700",
    },
  });
}
