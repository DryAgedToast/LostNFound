import StaffGuard from "@/components/StaffGuard";
import { Colors, Spacing } from "@/constants/theme";
import { getCurrentProfile } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Item } from "@/types";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

interface ManagedHotspot {
  hotspot_id: string;
  hotspots: { name: string };
}

function StaffScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];

  const [managedHotspots, setManagedHotspots] = useState<ManagedHotspot[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const profile = await getCurrentProfile();
      if (!profile) return;

      const { data: hotspotData, error: hotspotError } = await supabase
        .from("hotspot_managers")
        .select("hotspot_id, hotspots(name)")
        .eq("profile_id", profile.id);
      if (hotspotError) throw hotspotError;

      const managed = (hotspotData ?? []) as unknown as ManagedHotspot[];
      setManagedHotspots(managed);

      const hotspotIds = managed.map((hotspot) => hotspot.hotspot_id);
      if (hotspotIds.length === 0) {
        setItems([]);
        return;
      }

      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select("*")
        .eq("status", "at_hotspot")
        .in("hotspot_id", hotspotIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (itemError) throw itemError;

      setItems((itemData ?? []) as Item[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load staff data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const styles = makeStyles(colors);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>My Hotspots</Text>
          {managedHotspots.length === 0 ? (
            <Text style={styles.emptyText}>
              No hotspots assigned yet. Use Advanced Dashboard to choose the
              desks you manage.
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipRow}
            >
              {managedHotspots.map((hotspot) => (
                <View key={hotspot.hotspot_id} style={styles.chip}>
                  <Text style={styles.chipText}>{hotspot.hotspots.name}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          <Text style={[styles.sectionTitle, { marginTop: Spacing.four }]}>
            Items at My Hotspots
          </Text>
        </>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.itemRow}
          onPress={() => router.push(`/item/${item.id}`)}
          activeOpacity={0.75}
        >
          <View style={styles.itemMain}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.itemMeta} numberOfLines={1}>
              {item.category} · {item.location_found}
            </Text>
          </View>
          <Text style={styles.itemAction}>View</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <Text style={styles.emptyText}>
          No items are currently available at your managed hotspots.
        </Text>
      }
      ListFooterComponent={
        <TouchableOpacity
          style={styles.advancedLink}
          onPress={() => router.push("/staff/dashboard")}
        >
          <Text style={styles.advancedLinkText}>Advanced Dashboard</Text>
        </TouchableOpacity>
      }
    />
  );
}

export default function StaffTab() {
  return (
    <StaffGuard>
      <StaffScreen />
    </StaffGuard>
  );
}

function makeStyles(colors: typeof Colors.light) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.three,
      paddingBottom: Spacing.six,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    errorBox: {
      backgroundColor: colors.backgroundSelected,
      borderRadius: 8,
      padding: Spacing.three,
      marginBottom: Spacing.three,
    },
    errorText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: Spacing.two,
    },
    chipScroll: {
      marginHorizontal: -Spacing.four,
    },
    chipRow: {
      paddingHorizontal: Spacing.four,
      gap: Spacing.two,
    },
    chip: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    chipText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "600",
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.backgroundElement,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.three,
      marginBottom: Spacing.two,
      gap: Spacing.two,
    },
    itemMain: {
      flex: 1,
      gap: 3,
    },
    itemTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    itemMeta: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    itemAction: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "700",
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: Spacing.three,
      lineHeight: 22,
    },
    advancedLink: {
      alignItems: "center",
      marginTop: Spacing.five,
      paddingVertical: Spacing.two,
    },
    advancedLinkText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: "600",
    },
  });
}
