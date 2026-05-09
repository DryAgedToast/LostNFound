import CategoryFilter from "@/components/CategoryFilter";
import ItemCard from "@/components/ItemCard";
import { Colors, Spacing } from "@/constants/theme";
import { DEMO_MODE, getCurrentProfile } from "@/lib/auth";
import { getMockItems } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import type { ItemCategory, ItemWithPoster } from "@/types";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

const BRAND = {
  navy: "#002855",
  blue: "#005BBB",
  blueBright: "#0072CE",
  gold: "#FFD200",
  background: "#F4F7FB",
  surface: "#FFFFFF",
  border: "#DDE5F0",
  text: "#10233F",
  textMuted: "#66758A",
  softBlue: "#EAF2FF",
  softGold: "#FFF8D6",
};

export default function FeedScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];
  const router = useRouter();

  const [items, setItems] = useState<ItemWithPoster[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    ItemCategory | "all"
  >("all");
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    getCurrentProfile()
      .then((profile) => {
        if (!profile) {
          router.replace("/auth/login");
        } else {
          setAuthChecked(true);
        }
      })
      .catch(() => {
        router.replace("/auth/login");
      });
  }, [router]);

  const fetchItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("items")
        .select("*, profiles(*), hotspots(*)")
        .in("status", ["unclaimed", "at_hotspot"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      const dbItems = (data ?? []) as unknown as ItemWithPoster[];

      setItems(dbItems.length === 0 && DEMO_MODE ? getMockItems() : dbItems);
    } catch {
      setItems(getMockItems());
    }
  }, []);

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

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        normalizedSearch === "" ||
        item.title.toLowerCase().includes(normalizedSearch) ||
        (item.description ?? "").toLowerCase().includes(normalizedSearch) ||
        item.location_found.toLowerCase().includes(normalizedSearch);

      const matchesCategory =
        selectedCategory === "all" || item.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, selectedCategory]);

  const stats = useMemo(() => {
    const unclaimed = items.filter((item) => item.status === "unclaimed").length;
    const atHotspot = items.filter((item) => item.status === "at_hotspot").length;

    return {
      total: items.length,
      unclaimed,
      atHotspot,
    };
  }, [items]);

  const hasActiveFilters = searchQuery.trim() !== "" || selectedCategory !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
  };

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
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View style={styles.titleBlock}>
            </View>
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search for lost items, locations, or keywords..."
                placeholderTextColor={BRAND.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>

            <TouchableOpacity style={styles.sortButton} activeOpacity={0.75}>
              <Text style={styles.sortButtonText}>Newest first ▾</Text>
            </TouchableOpacity>
          </View>

          
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Active items</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.unclaimed}</Text>
              <Text style={styles.statLabel}>Unclaimed</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.atHotspot}</Text>
              <Text style={styles.statLabel}>At hotspots</Text>
            </View>
            </View> 
          </View>
      </View>

      <View style={styles.filterSection}>
        <View style={styles.filterContent}>
          <CategoryFilter
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />

          <View style={styles.resultsRow}>
            <Text style={styles.resultsText}>
              Showing {filteredItems.length} of {items.length} items
            </Text>

            {hasActiveFilters ? (
              <TouchableOpacity onPress={clearFilters} activeOpacity={0.75}>
                <Text style={styles.clearFiltersText}>Clear filters</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={BRAND.blue}
              colors={[BRAND.blue]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔎</Text>
              <Text style={styles.emptyTitle}>
                {hasActiveFilters
                  ? "No items match your filters."
                  : "No lost items posted yet."}
              </Text>
              <Text style={styles.emptyText}>
                {hasActiveFilters
                  ? "Try searching with a different keyword or clearing your filters."
                  : "When students post found items, they will appear here."}
              </Text>

              {hasActiveFilters ? (
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={clearFilters}
                  activeOpacity={0.75}
                >
                  <Text style={styles.emptyButtonText}>Clear filters</Text>
                </TouchableOpacity>
              ) : null}
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
    backgroundColor: BRAND.background,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BRAND.background,
  },
  header: {
    backgroundColor: BRAND.surface,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    paddingVertical: 10,
    paddingHorizontal: Spacing.four,
  },
  headerContent: {
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 24,
    marginBottom: 24,
  },
  titleBlock: {
    flex: 1,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  searchInputWrap: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: BRAND.background,
    borderWidth: 1,
    borderColor: BRAND.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  searchIcon: {
    fontSize: 22,
    color: BRAND.textMuted,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 15,
    color: BRAND.text,
  },
  sortButton: {
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.surface,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        cursor: "pointer" as any,
      },
    }),
  },
  sortButtonText: {
    color: BRAND.navy,
    fontSize: 13,
    fontWeight: "800",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  statCard: {
    minWidth: 132,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: BRAND.softBlue,
    borderWidth: 1,
    borderColor: "#D6E7FF",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
    color: BRAND.blue,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: BRAND.textMuted,
  },
  filterSection: {
    backgroundColor: BRAND.surface,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  filterContent: {
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
    paddingBottom: 12,
  },
  resultsRow: {
    paddingHorizontal: Spacing.three,
    paddingTop: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultsText: {
    color: BRAND.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  clearFiltersText: {
    color: BRAND.blue,
    fontSize: 13,
    fontWeight: "800",
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
    marginTop: 48,
    paddingVertical: 48,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: BRAND.surface,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: BRAND.navy,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: BRAND.textMuted,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 420,
  },
  emptyButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: BRAND.blue,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});