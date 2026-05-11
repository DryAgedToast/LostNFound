import CategoryFilter from "@/components/CategoryFilter";
import ItemCard from "@/components/ItemCard";
import { Colors, Spacing } from "@/constants/theme";
import { DEMO_MODE, getCurrentProfile } from "@/lib/auth";
import { getMockItems } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import type { ItemCategory, ItemWithPoster } from "@/types";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

type FeedStatusFilter = "available" | "pending" | "all";
type FeedView = "active" | "archived";

const STATUS_FILTERS: { key: FeedStatusFilter; label: string }[] = [
  { key: "available", label: "Available" },
  { key: "pending", label: "Pending Pickup" },
  { key: "all", label: "All" },
];

export default function FeedScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];
  const router = useRouter();

  const [items, setItems] = useState<ItemWithPoster[]>([]);
  const [archivedItems, setArchivedItems] = useState<ItemWithPoster[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    ItemCategory | "all"
  >("all");
  const [selectedStatus, setSelectedStatus] =
    useState<FeedStatusFilter>("available");
  const [selectedView, setSelectedView] = useState<FeedView>("active");
  const [authChecked, setAuthChecked] = useState(false);

  // Auth gate
  useEffect(() => {
    getCurrentProfile()
      .then((profile) => {
        if (!profile) {
          router.replace("/auth/login");
        } else {
          setCurrentProfileId(profile.id);
          setAuthChecked(true);
        }
      })
      .catch(() => {
        router.replace("/auth/login");
      });
  }, [router]);

  const fetchItems = useCallback(async () => {
    try {
      // Active feed: unclaimed, at_hotspot, pending only — claimed items go to Archived
      const activeQuery = supabase
        .from("items")
        .select("*, profiles!poster_id(*), hotspots(*)")
        .in("status", ["unclaimed", "at_hotspot", "pending"])
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (currentProfileId == null) {
        const { data, error } = await activeQuery;
        if (error) throw error;
        const dbItems = (data ?? []) as unknown as ItemWithPoster[];
        setItems(dbItems.length === 0 && DEMO_MODE ? getMockItems() : dbItems);
        setArchivedItems([]);
        return;
      }

      // Archived = soft-deleted posts by this user (non-hotspot only)
      //          + claimed items posted by this user (direct items)
      //          + claimed hotspot items managed by this user
      const [activeResult, deletedResult, claimedPostedResult, managedHotspotResult] =
        await Promise.all([
          activeQuery,
          supabase
            .from("items")
            .select("*, profiles!poster_id(*), hotspots(*)")
            .eq("poster_id", currentProfileId)
            .not("deleted_at", "is", null)
            .order("deleted_at", { ascending: false }),
          supabase
            .from("items")
            .select("*, profiles!poster_id(*), hotspots(*)")
            .eq("poster_id", currentProfileId)
            .eq("status", "claimed")
            .is("deleted_at", null)
            .is("hotspot_id", null)
            .order("created_at", { ascending: false }),
          supabase
            .from("hotspot_managers")
            .select("hotspot_id")
            .eq("profile_id", currentProfileId),
        ]);

      if (activeResult.error) throw activeResult.error;
      if (deletedResult.error) throw deletedResult.error;
      if (claimedPostedResult.error) throw claimedPostedResult.error;
      if (managedHotspotResult.error) throw managedHotspotResult.error;

      const dbItems = (activeResult.data ?? []) as unknown as ItemWithPoster[];

      // Build archived list: deleted posts + claimed direct posts + claimed hotspot items
      const archivedById = new Map<string, ItemWithPoster>();
      for (const item of (deletedResult.data ?? []) as unknown as ItemWithPoster[]) {
        archivedById.set(item.id, item);
      }
      for (const item of (claimedPostedResult.data ?? []) as unknown as ItemWithPoster[]) {
        archivedById.set(item.id, item);
      }

      const managedHotspotIds = (
        (managedHotspotResult.data ?? []) as { hotspot_id: string }[]
      ).map((r) => r.hotspot_id);

      if (managedHotspotIds.length > 0) {
        const { data: claimedManagedData, error: claimedManagedError } = await supabase
          .from("items")
          .select("*, profiles!poster_id(*), hotspots(*)")
          .in("hotspot_id", managedHotspotIds)
          .eq("status", "claimed")
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        if (claimedManagedError) throw claimedManagedError;
        for (const item of (claimedManagedData ?? []) as unknown as ItemWithPoster[]) {
          archivedById.set(item.id, item);
        }
      }

      setItems(dbItems.length === 0 && DEMO_MODE ? getMockItems() : dbItems);
      setArchivedItems([...archivedById.values()]);
    } catch {
      // Fallback to mock data if database is unreachable
      setItems(getMockItems());
      setArchivedItems([]);
    }
  }, [currentProfileId]);

  const load = useCallback(async () => {
    setLoading(true);
    await fetchItems();
    setLoading(false);
  }, [fetchItems]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchItems();
    setRefreshing(false);
  }, [fetchItems]);

  useEffect(() => {
    if (authChecked) {
      load();
    }
  }, [authChecked, load]);

  // Client-side filtering
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description ?? "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" || item.category === selectedCategory;

    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "available" &&
        (item.status === "unclaimed" || item.status === "at_hotspot")) ||
      item.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const filteredArchivedItems = archivedItems.filter((item) => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description ?? "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" || item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const renderItem = useCallback(
    ({ item }: { item: ItemWithPoster }) => (
      <View style={styles.cardWrapper}>
        <ItemCard item={item} onPress={() => router.push(`/item/${item.id}`)} />
      </View>
    ),
    [router],
  );

  const keyExtractor = (item: ItemWithPoster) => item.id;

  if (!authChecked) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color="#1877F2" />
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.backgroundElement }]}>
      {/* Header with Search */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerTopRow}>
            <Text style={[styles.pageTitle, { color: colors.text }]}>
              Marketplace
            </Text>
            <View style={styles.viewSwitch}>
              <TouchableOpacity
                style={[
                  styles.viewSwitchButton,
                  selectedView === "active" && styles.viewSwitchButtonActive,
                ]}
                onPress={() => setSelectedView("active")}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.viewSwitchText,
                    {
                      color:
                        selectedView === "active"
                          ? "#FFFFFF"
                          : colors.textSecondary,
                    },
                  ]}
                >
                  Active
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.viewSwitchButton,
                  selectedView === "archived" && styles.viewSwitchButtonActive,
                ]}
                onPress={() => setSelectedView("archived")}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.viewSwitchText,
                    {
                      color:
                        selectedView === "archived"
                          ? "#FFFFFF"
                          : colors.textSecondary,
                    },
                  ]}
                >
                  Archived
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <TextInput
            style={[
              styles.searchInput,
              {
                color: colors.text,
                backgroundColor: colors.backgroundElement,
                borderColor: colors.border,
              },
            ]}
            placeholder="Search items..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Category filter */}
      <View
        style={[
          styles.filterContainer,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <CategoryFilter
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />
        {selectedView === "active" && (
          <View style={styles.statusFilterRow}>
            {STATUS_FILTERS.map((filter) => {
              const selected = selectedStatus === filter.key;
              return (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.statusFilterButton,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected
                        ? colors.backgroundSelected
                        : colors.backgroundElement,
                    },
                  ]}
                  onPress={() => setSelectedStatus(filter.key)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.statusFilterText,
                      { color: selected ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Feed */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={selectedView === "active" ? filteredItems : filteredArchivedItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery.trim() !== "" ||
                selectedCategory !== "all" ||
                (selectedView === "active" && selectedStatus !== "available")
                  ? "No items match your filters."
                  : selectedView === "archived"
                    ? "No archived posts yet"
                    : "No lost items posted yet"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: 1,
  },
  headerContent: {
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  viewSwitch: {
    flexDirection: "row",
    backgroundColor: "#E4E6EB",
    borderRadius: 10,
    padding: 3,
  },
  viewSwitchButton: {
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  viewSwitchButtonActive: {
    backgroundColor: "#1877F2",
  },
  viewSwitchText: {
    fontSize: 13,
    fontWeight: "700",
  },
  searchInput: {
    fontSize: 15,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
  },
  filterContainer: {
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  statusFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  statusFilterButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  statusFilterText: {
    fontSize: 13,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.six,
    paddingTop: Spacing.three,
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
  cardWrapper: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    paddingTop: Spacing.six,
    alignItems: "center",
    paddingHorizontal: Spacing.five,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
