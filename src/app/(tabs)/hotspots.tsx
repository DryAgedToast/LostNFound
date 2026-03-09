import { Colors, Spacing } from "@/constants/theme";
import { DEV_MODE } from "@/lib/auth";
import { getMockHotspots, getMockItems } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import type { BuildingType, Hotspot, Item } from "@/types";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

// ── Constants ─────────────────────────────────────────────────────────────────

const BUILDING_EMOJI: Record<BuildingType, string> = {
  library: "📚",
  student_center: "🏛️",
  lecture_hall: "🎓",
  gym: "💪",
  admin_building: "🏢",
  other: "📍",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface HotspotWithCount extends Hotspot {
  itemCount: number;
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HotspotsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];
  const router = useRouter();

  const [hotspots, setHotspots] = useState<HotspotWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedHotspot, setSelectedHotspot] =
    useState<HotspotWithCount | null>(null);
  const [modalItems, setModalItems] = useState<Item[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // ── Fetch hotspots + counts ─────────────────────────────────────────────────

  const fetchHotspots = useCallback(async () => {
    setError(null);
    try {
      // Use mock data in DEV_MODE
      if (DEV_MODE) {
        const mockHotspots = getMockHotspots();
        const mockItems = getMockItems();
        const withCounts = mockHotspots.map((hotspot) => ({
          ...hotspot,
          itemCount: mockItems.filter(
            (item) =>
              item.status === "at_hotspot" && item.hotspot_id === hotspot.id,
          ).length,
        }));
        setHotspots(withCounts);
        return;
      }

      const { data: hotspotData, error: hotspotError } = await supabase
        .from("hotspots")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (hotspotError) throw hotspotError;
      const rawHotspots = (hotspotData as Hotspot[]) ?? [];

      // Fetch item counts per hotspot in parallel
      const withCounts = await Promise.all(
        rawHotspots.map(async (hotspot) => {
          try {
            const { count } = await supabase
              .from("items")
              .select("id", { count: "exact", head: true })
              .eq("status", "at_hotspot")
              .eq("hotspot_id", hotspot.id);

            return {
              ...hotspot,
              itemCount: count ?? 0,
            } satisfies HotspotWithCount;
          } catch {
            return { ...hotspot, itemCount: 0 } satisfies HotspotWithCount;
          }
        }),
      );

      setHotspots(withCounts);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load hotspots.";
      setError(message);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await fetchHotspots();
    setLoading(false);
  }, [fetchHotspots]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHotspots();
    setRefreshing(false);
  }, [fetchHotspots]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Open modal and fetch items for selected hotspot ────────────────────────

  const openModal = async (hotspot: HotspotWithCount) => {
    setSelectedHotspot(hotspot);
    setModalItems([]);
    setModalLoading(true);

    try {
      // Use mock data in DEV_MODE
      if (DEV_MODE) {
        const mockItems = getMockItems();
        const hotspotItems = mockItems
          .filter(
            (item) =>
              item.status === "at_hotspot" && item.hotspot_id === hotspot.id,
          )
          .map((item) => ({
            id: item.id,
            poster_id: item.poster_id,
            title: item.title,
            description: item.description,
            category: item.category,
            location_found: item.location_found,
            hotspot_id: item.hotspot_id,
            image_url: item.image_url,
            status: item.status,
            custom_questions: item.custom_questions,
            created_at: item.created_at,
          })) as Item[];
        setModalItems(hotspotItems);
        setModalLoading(false);
        return;
      }

      const { data, error: itemsError } = await supabase
        .from("items")
        .select("*")
        .eq("status", "at_hotspot")
        .eq("hotspot_id", hotspot.id)
        .order("created_at", { ascending: false });

      if (itemsError) throw itemsError;
      setModalItems((data ?? []) as Item[]);
    } catch {
      setModalItems([]);
    }

    setModalLoading(false);
  };

  const closeModal = () => {
    setSelectedHotspot(null);
    setModalItems([]);
  };

  // ── List item render ───────────────────────────────────────────────────────

  const renderHotspot = ({ item }: { item: HotspotWithCount }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.backgroundElement }]}
      onPress={() => openModal(item)}
      activeOpacity={0.8}
    >
      <View style={styles.cardLeft}>
        <Text style={styles.buildingEmoji}>
          {BUILDING_EMOJI[item.building_type]}
        </Text>
      </View>
      <View style={styles.cardMiddle}>
        <Text
          style={[styles.hotspotName, { color: colors.text }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text
          style={[styles.hotspotAddress, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {item.address}
        </Text>
        {item.staff_contact != null && (
          <Text
            style={[styles.staffContact, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            Contact: {item.staff_contact}
          </Text>
        )}
      </View>
      <View style={styles.cardRight}>
        <View
          style={[
            styles.countBadge,
            {
              backgroundColor:
                item.itemCount > 0 ? "#FEF3E2" : colors.backgroundElement,
            },
          ]}
        >
          <Text
            style={[
              styles.countText,
              { color: item.itemCount > 0 ? "#D97706" : colors.textSecondary },
            ]}
          >
            {item.itemCount} {item.itemCount === 1 ? "item" : "items"} here
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Hotspots</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Campus lost-and-found drop-off locations
        </Text>
      </View>

      {error != null && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : (
        <FlatList
          data={hotspots}
          keyExtractor={(item) => item.id}
          renderItem={renderHotspot}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#208AEF"
              colors={["#208AEF"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No drop-off locations available
              </Text>
            </View>
          }
        />
      )}

      {/* Hotspot detail modal */}
      <Modal
        visible={selectedHotspot != null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        {selectedHotspot != null && (
          <HotspotModal
            hotspot={selectedHotspot}
            items={modalItems}
            loading={modalLoading}
            onClose={closeModal}
            onViewItem={(itemId) => {
              closeModal();
              router.push(`/item/${itemId}`);
            }}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

// ── Modal component ────────────────────────────────────────────────────────────

interface HotspotModalProps {
  hotspot: HotspotWithCount;
  items: Item[];
  loading: boolean;
  onClose: () => void;
  onViewItem: (itemId: string) => void;
}

function HotspotModal({
  hotspot,
  items,
  loading,
  onClose,
  onViewItem,
}: HotspotModalProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];

  const buildingLabel: Record<BuildingType, string> = {
    library: "Library",
    student_center: "Student Center",
    lecture_hall: "Lecture Hall",
    gym: "Gym",
    admin_building: "Admin Building",
    other: "Other",
  };

  return (
    <SafeAreaView
      style={[modalStyles.root, { backgroundColor: colors.background }]}
    >
      {/* Modal header */}
      <View
        style={[
          modalStyles.modalHeader,
          { borderBottomColor: colors.backgroundElement },
        ]}
      >
        <Text
          style={[modalStyles.modalTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {hotspot.name}
        </Text>
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.7}
          style={modalStyles.closeButton}
        >
          <Text style={[modalStyles.closeButtonText, { color: "#208AEF" }]}>
            Close
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={modalStyles.scrollContent}>
        {/* Hotspot details */}
        <View
          style={[
            modalStyles.detailCard,
            { backgroundColor: colors.backgroundElement },
          ]}
        >
          <View style={modalStyles.detailRow}>
            <Text
              style={[modalStyles.detailLabel, { color: colors.textSecondary }]}
            >
              Building type
            </Text>
            <Text style={[modalStyles.detailValue, { color: colors.text }]}>
              {BUILDING_EMOJI[hotspot.building_type]}{" "}
              {buildingLabel[hotspot.building_type]}
            </Text>
          </View>
          <View
            style={[
              modalStyles.divider,
              { backgroundColor: colors.backgroundSelected },
            ]}
          />
          <View style={modalStyles.detailRow}>
            <Text
              style={[modalStyles.detailLabel, { color: colors.textSecondary }]}
            >
              Address
            </Text>
            <Text style={[modalStyles.detailValue, { color: colors.text }]}>
              {hotspot.address}
            </Text>
          </View>
          {hotspot.staff_contact != null && (
            <>
              <View
                style={[
                  modalStyles.divider,
                  { backgroundColor: colors.backgroundSelected },
                ]}
              />
              <View style={modalStyles.detailRow}>
                <Text
                  style={[
                    modalStyles.detailLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Staff contact
                </Text>
                <Text style={[modalStyles.detailValue, { color: colors.text }]}>
                  {hotspot.staff_contact}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Items at this hotspot */}
        <Text style={[modalStyles.sectionTitle, { color: colors.text }]}>
          Items here ({hotspot.itemCount})
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#208AEF"
            style={modalStyles.loader}
          />
        ) : items.length === 0 ? (
          <Text
            style={[modalStyles.noItemsText, { color: colors.textSecondary }]}
          >
            No items currently at this location.
          </Text>
        ) : (
          items.map((item) => (
            <View
              key={item.id}
              style={[
                modalStyles.itemRow,
                { backgroundColor: colors.backgroundElement },
              ]}
            >
              {item.image_url != null ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={modalStyles.itemThumbnail}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    modalStyles.itemThumbnail,
                    modalStyles.itemThumbnailPlaceholder,
                    { backgroundColor: colors.backgroundSelected },
                  ]}
                >
                  <Text style={modalStyles.thumbnailPlaceholderText}>?</Text>
                </View>
              )}
              <View style={modalStyles.itemInfo}>
                <Text
                  style={[modalStyles.itemTitle, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text
                  style={[
                    modalStyles.itemCategory,
                    { color: colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {item.category}
                </Text>
              </View>
              <TouchableOpacity
                style={modalStyles.viewButton}
                onPress={() => onViewItem(item.id)}
                activeOpacity={0.8}
              >
                <Text style={modalStyles.viewButtonText}>View</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: Spacing.one,
  },
  subtitle: {
    fontSize: 14,
  },
  errorBox: {
    margin: Spacing.three,
    backgroundColor: "#FDECEA",
    borderRadius: 8,
    padding: Spacing.three,
  },
  errorText: {
    color: "#C0392B",
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  card: {
    flexDirection: "row",
    borderRadius: 12,
    padding: Spacing.three,
    alignItems: "center",
    gap: Spacing.two,
  },
  cardLeft: {
    width: 40,
    alignItems: "center",
  },
  buildingEmoji: {
    fontSize: 24,
  },
  cardMiddle: {
    flex: 1,
    gap: Spacing.one,
  },
  hotspotName: {
    fontSize: 15,
    fontWeight: "700",
  },
  hotspotAddress: {
    fontSize: 13,
  },
  staffContact: {
    fontSize: 12,
  },
  cardRight: {
    alignItems: "flex-end",
  },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  countText: {
    fontSize: 12,
    fontWeight: "600",
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
  },
});

const modalStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    marginRight: Spacing.two,
  },
  closeButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  detailCard: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: 0,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  detailLabel: {
    fontSize: 14,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "500",
    flex: 2,
    textAlign: "right",
  },
  divider: {
    height: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  loader: {
    marginTop: Spacing.five,
  },
  noItemsText: {
    fontSize: 15,
    textAlign: "center",
    marginTop: Spacing.three,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  itemThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  itemThumbnailPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnailPlaceholderText: {
    fontSize: 22,
    color: "#9CA3AF",
  },
  itemInfo: {
    flex: 1,
    gap: Spacing.one,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  itemCategory: {
    fontSize: 12,
    textTransform: "capitalize",
  },
  viewButton: {
    backgroundColor: "#208AEF",
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  viewButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
});
