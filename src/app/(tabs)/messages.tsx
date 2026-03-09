import ClaimStatusBadge from "@/components/ClaimStatusBadge";
import { Colors, Spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import type { Claim, Item, Profile } from "@/types";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Shapes returned by the joined Supabase queries
interface ClaimOnMyItem extends Claim {
  items: Item;
  profiles: Profile; // claimant profile
}

interface MyClaim extends Claim {
  items: Item & { profiles: Profile }; // item + poster profile
}

export default function MessagesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];

  const [claimsOnMyItems, setClaimsOnMyItems] = useState<ClaimOnMyItem[]>([]);
  const [myClaims, setMyClaims] = useState<MyClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error("Not authenticated");

      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profileErr || !profileData)
        throw profileErr ?? new Error("Profile not found");
      const profile = profileData as Profile;

      // Query 1: claims on items I posted
      const { data: onMyItems, error: onMyErr } = await supabase
        .from("claims")
        .select("*, items!inner(*), profiles(*)")
        .eq("items.poster_id", profile.id)
        .order("created_at", { ascending: false });

      if (onMyErr) throw onMyErr;

      // Query 2: claims I submitted
      const { data: myClaimsData, error: myClaimsErr } = await supabase
        .from("claims")
        .select("*, items!inner(*, profiles(*))")
        .eq("claimant_id", profile.id)
        .order("created_at", { ascending: false });

      if (myClaimsErr) throw myClaimsErr;

      setClaimsOnMyItems((onMyItems ?? []) as ClaimOnMyItem[]);
      setMyClaims((myClaimsData ?? []) as MyClaim[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load inbox");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const styles = makeStyles(colors);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={[]}
        renderItem={null}
        keyExtractor={() => ""}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#208AEF"
          />
        }
        ListHeaderComponent={
          <View style={styles.container}>
            <Text style={styles.screenTitle}>Inbox</Text>

            {error !== null && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {claimsOnMyItems.length === 0 && myClaims.length === 0 && (
              <Text style={styles.emptyText}>No messages yet</Text>
            )}

            {/* Section 1: Claims on My Items */}
            <Text style={styles.sectionHeader}>Claims on My Items</Text>

            {claimsOnMyItems.length === 0 ? (
              <Text style={styles.emptyText}>No claims on your items</Text>
            ) : (
              claimsOnMyItems.map((claim) => (
                <TouchableOpacity
                  key={claim.id}
                  style={styles.row}
                  onPress={() => router.push(`/item/${claim.item_id}`)}
                  activeOpacity={0.75}
                >
                  <View style={styles.rowContent}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {claim.items?.title ?? "Unknown Item"}
                    </Text>
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      Claimed by: {claim.profiles?.display_name ?? "Unknown"}
                    </Text>
                    <Text style={styles.rowTime}>
                      {formatTime(claim.created_at)}
                    </Text>
                  </View>
                  <ClaimStatusBadge status={claim.status} />
                </TouchableOpacity>
              ))
            )}

            {/* Section 2: My Claims */}
            <Text style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
              My Claims
            </Text>

            {myClaims.length === 0 ? (
              <Text style={styles.emptyText}>You haven't claimed anything</Text>
            ) : (
              myClaims.map((claim) => (
                <TouchableOpacity
                  key={claim.id}
                  style={styles.row}
                  onPress={() => router.push(`/messages/${claim.id}`)}
                  activeOpacity={0.75}
                >
                  <View style={styles.rowContent}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {claim.items?.title ?? "Unknown Item"}
                    </Text>
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      Posted by:{" "}
                      {claim.items?.profiles?.display_name ?? "Unknown"}
                    </Text>
                    <Text style={styles.rowTime}>
                      {formatTime(claim.created_at)}
                    </Text>
                  </View>
                  <ClaimStatusBadge status={claim.status} />
                </TouchableOpacity>
              ))
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
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
    container: {
      padding: Spacing.four,
      paddingBottom: Spacing.six,
    },
    screenTitle: {
      fontSize: 26,
      fontWeight: "700",
      color: colors.text,
      marginBottom: Spacing.four,
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
    sectionHeader: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: Spacing.two,
    },
    sectionHeaderSpaced: {
      marginTop: Spacing.five,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: Spacing.three,
      fontStyle: "italic",
    },
    row: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      padding: Spacing.three,
      marginBottom: Spacing.two,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Spacing.two,
    },
    rowContent: {
      flex: 1,
      gap: Spacing.one,
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
    },
    rowSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    rowTime: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  });
}
