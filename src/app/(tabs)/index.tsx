import CategoryFilter from "@/components/CategoryFilter";
import ItemCard from "@/components/ItemCard";
import { Colors, Spacing } from "@/constants/theme";
import { DEV_MODE, getCurrentProfile } from "@/lib/auth";
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
  useColorScheme,
  View,
} from "react-native";

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

  // Auth gate
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
      // Use mock data in DEV_MODE
      if (DEV_MODE) {
        setItems(getMockItems());
        return;
      }

      const { data, error } = await supabase
        .from("items")
        .select("*, profiles(*), hotspots(*)")
        .in("status", ["unclaimed", "at_hotspot"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems((data ?? []) as unknown as ItemWithPoster[]);
    } catch {
      // Fallback to mock data if database fails
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
        <ActivityIndicator size="large" color="#208AEF" />
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
          <Text style={[styles.pageTitle, { color: colors.text }]}>
            Marketplace
          </Text>
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
      </View>

      {/* Feed */}
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
                {searchQuery.trim() !== "" || selectedCategory !== "all"
                  ? "No items match your filters."
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
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.two,
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
