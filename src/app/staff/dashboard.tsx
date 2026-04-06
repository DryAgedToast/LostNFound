import StaffGuard from "@/components/StaffGuard";
import { Colors, Spacing } from "@/constants/theme";
import { getCurrentProfile } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Hotspot, Item, Profile, TheftClaim } from "@/types";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TheftClaimWithTitle extends TheftClaim {
  itemTitle: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// ── Dashboard Screen ───────────────────────────────────────────────────────────

function DashboardContent() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [hotspotItems, setHotspotItems] = useState<Item[]>([]);
  const [openTheftClaims, setOpenTheftClaims] = useState<TheftClaimWithTitle[]>(
    [],
  );
  const [claimCounts, setClaimCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drop-off modal state
  const [dropoffVisible, setDropoffVisible] = useState(false);
  const [unclaimedItems, setUnclaimedItems] = useState<Item[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(
    null,
  );
  const [dropoffNotes, setDropoffNotes] = useState("");
  const [dropoffLoading, setDropoffLoading] = useState(false);
  const [dropoffError, setDropoffError] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Theft resolve loading
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await getCurrentProfile();
      setCurrentProfile(profile);

      // Fetch at_hotspot items
      const { data: itemsData, error: itemsError } = await supabase
        .from("items")
        .select("*")
        .eq("status", "at_hotspot")
        .order("created_at", { ascending: false });
      if (itemsError) throw itemsError;

      const items = (itemsData ?? []) as Item[];
      setHotspotItems(items);

      // Fetch claim counts per item
      if (items.length > 0) {
        const itemIds = items.map((i) => i.id);
        const { data: countsData, error: countsError } = await supabase
          .from("claims")
          .select("item_id")
          .in("item_id", itemIds);
        if (countsError) throw countsError;

        const counts: Record<string, number> = {};
        (countsData ?? []).forEach((row: { item_id: string }) => {
          counts[row.item_id] = (counts[row.item_id] ?? 0) + 1;
        });
        setClaimCounts(counts);
      }

      // Fetch open theft claims with item titles
      const { data: theftData, error: theftError } = await supabase
        .from("theft_claims")
        .select("*, items!item_id(title)")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (theftError) throw theftError;

      const theftClaims: TheftClaimWithTitle[] = (theftData ?? []).map(
        (row: TheftClaim & { items: { title: string } | null }) => ({
          ...row,
          itemTitle: row.items?.title ?? "Unknown Item",
        }),
      );
      setOpenTheftClaims(theftClaims);
    } catch {
      setHotspotItems([]);
      setOpenTheftClaims([]);
      setClaimCounts({});
      setError("Unable to load staff data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDropoffModal = async () => {
    setDropoffVisible(true);
    setModalLoading(true);
    setDropoffError(null);
    setSelectedItemId(null);
    setSelectedHotspotId(null);
    setDropoffNotes("");

    try {
      const [
        { data: itemsData, error: itemsError },
        { data: hotspotsData, error: hotspotsError },
      ] = await Promise.all([
        supabase
          .from("items")
          .select("*")
          .eq("status", "unclaimed")
          .order("created_at", { ascending: false }),
        supabase
          .from("hotspots")
          .select("*")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);
      if (itemsError) throw itemsError;
      if (hotspotsError) throw hotspotsError;
      setUnclaimedItems((itemsData ?? []) as Item[]);
      setHotspots((hotspotsData ?? []) as Hotspot[]);
    } catch {
      setUnclaimedItems([]);
      setHotspots([]);
    } finally {
      setModalLoading(false);
    }
  };

  const handleConfirmDropoff = async () => {
    if (!selectedItemId) {
      setDropoffError("Please select an item.");
      return;
    }
    if (!selectedHotspotId) {
      setDropoffError("Please select a hotspot.");
      return;
    }
    if (!currentProfile) {
      setDropoffError("Could not determine current user.");
      return;
    }

    setDropoffLoading(true);
    setDropoffError(null);

    try {
      const { error: insertError } = await supabase
        .from("hotspot_dropoffs")
        .insert({
          item_id: selectedItemId,
          hotspot_id: selectedHotspotId,
          logged_by: currentProfile.id,
          notes: dropoffNotes.trim() || null,
        });

      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from("items")
        .update({ status: "at_hotspot", hotspot_id: selectedHotspotId })
        .eq("id", selectedItemId);

      if (updateError) throw updateError;

      setDropoffVisible(false);
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Drop-off failed.";
      setDropoffError(message);
    } finally {
      setDropoffLoading(false);
    }
  };

  const handleResolveTheft = async (theftClaimId: string) => {
    setResolvingId(theftClaimId);
    try {
      const { error: resolveError } = await supabase
        .from("theft_claims")
        .update({ status: "resolved" })
        .eq("id", theftClaimId);
      if (resolveError) throw resolveError;
      fetchData();
    } catch {
      setError("Unable to resolve theft claim.");
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: colors.background }]}
      >
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1877F2" />
        </View>
      </SafeAreaView>
    );
  }

  const isAdmin = currentProfile?.role === "admin";
  const roleLabel = isAdmin ? "Admin" : "Staff";
  const roleBadgeColor = isAdmin ? "#1877F2" : "#1877F2";

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>
            Staff Dashboard
          </Text>
          <View style={[styles.roleBadge, { backgroundColor: roleBadgeColor }]}>
            <Text style={styles.roleBadgeText}>{roleLabel}</Text>
          </View>
        </View>

        {/* Log Drop-off button */}
        <TouchableOpacity
          style={styles.dropoffButton}
          onPress={openDropoffModal}
          activeOpacity={0.8}
        >
          <Text style={styles.dropoffButtonText}>+ Log Drop-off</Text>
        </TouchableOpacity>

        {error !== null && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* At Hotspot Items section */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          At Hotspot Items
        </Text>

        {hotspotItems.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.backgroundElement },
            ]}
          >
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No items at this location
            </Text>
          </View>
        ) : (
          hotspotItems.map((item) => (
            <View
              key={item.id}
              style={[
                styles.itemCard,
                { backgroundColor: colors.backgroundElement },
              ]}
            >
              <View style={styles.itemCardBody}>
                <View style={styles.itemCardInfo}>
                  <Text style={[styles.itemCardTitle, { color: colors.text }]}>
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      styles.itemCardMeta,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {item.category} · {item.location_found}
                  </Text>
                </View>
                <View style={styles.itemCardRight}>
                  {(claimCounts[item.id] ?? 0) > 0 && (
                    <View style={styles.claimCountBadge}>
                      <Text style={styles.claimCountText}>
                        {claimCounts[item.id]} claim
                        {(claimCounts[item.id] ?? 0) !== 1 ? "s" : ""}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.viewClaimsButton}
                    onPress={() => router.push(`/item/${item.id}`)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.viewClaimsText}>View Claims</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}

        {/* Open Theft Claims section */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text, marginTop: Spacing.four },
          ]}
        >
          Open Theft Claims
        </Text>

        {openTheftClaims.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.backgroundElement },
            ]}
          >
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No open theft claims.
            </Text>
          </View>
        ) : (
          openTheftClaims.map((tc) => (
            <View
              key={tc.id}
              style={[
                styles.theftCard,
                {
                  backgroundColor: colors.backgroundElement,
                  borderLeftColor: "#65676B",
                },
              ]}
            >
              <Text style={[styles.theftItemTitle, { color: colors.text }]}>
                {tc.itemTitle}
              </Text>
              <Text
                style={[
                  styles.theftDescription,
                  { color: colors.textSecondary },
                ]}
                numberOfLines={2}
              >
                {tc.description}
              </Text>
              <Text style={[styles.theftTime, { color: colors.textSecondary }]}>
                {getRelativeTime(tc.created_at)}
              </Text>
              <View style={styles.theftActions}>
                <TouchableOpacity
                  style={[
                    styles.reviewButton,
                    { borderColor: colors.backgroundSelected },
                  ]}
                  onPress={() => router.push(`/item/${tc.item_id}`)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.reviewButtonText, { color: colors.text }]}
                  >
                    Review
                  </Text>
                </TouchableOpacity>
                {isAdmin && (
                  <TouchableOpacity
                    style={[
                      styles.resolveButton,
                      resolvingId === tc.id && styles.disabledButton,
                    ]}
                    onPress={() => handleResolveTheft(tc.id)}
                    disabled={resolvingId === tc.id}
                    activeOpacity={0.8}
                  >
                    {resolvingId === tc.id ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.resolveButtonText}>Resolve</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Drop-off Modal */}
      <Modal
        visible={dropoffVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDropoffVisible(false)}
      >
        <SafeAreaView
          style={[styles.modalRoot, { backgroundColor: colors.background }]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Log Drop-off
            </Text>
            <Pressable onPress={() => setDropoffVisible(false)} hitSlop={12}>
              <Text
                style={[styles.modalClose, { color: colors.textSecondary }]}
              >
                Cancel
              </Text>
            </Pressable>
          </View>

          {modalLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#1877F2" />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
            >
              {dropoffError !== null && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{dropoffError}</Text>
                </View>
              )}

              {/* Item selector */}
              <Text style={[styles.modalLabel, { color: colors.text }]}>
                Select Item
              </Text>
              {unclaimedItems.length === 0 ? (
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  No unclaimed items available.
                </Text>
              ) : (
                unclaimedItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.selectRow,
                      {
                        backgroundColor:
                          selectedItemId === item.id
                            ? colors.backgroundSelected
                            : colors.backgroundElement,
                        borderColor:
                          selectedItemId === item.id
                            ? "#1877F2"
                            : colors.backgroundSelected,
                      },
                    ]}
                    onPress={() => setSelectedItemId(item.id)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.radio,
                        {
                          borderColor:
                            selectedItemId === item.id
                              ? "#1877F2"
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {selectedItemId === item.id && (
                        <View style={styles.radioDot} />
                      )}
                    </View>
                    <View style={styles.selectRowInfo}>
                      <Text
                        style={[styles.selectRowTitle, { color: colors.text }]}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={[
                          styles.selectRowMeta,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {item.category} · {item.location_found}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}

              {/* Hotspot selector */}
              <Text
                style={[
                  styles.modalLabel,
                  { color: colors.text, marginTop: Spacing.three },
                ]}
              >
                Select Hotspot
              </Text>
              {hotspots.length === 0 ? (
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  No active hotspots available.
                </Text>
              ) : (
                hotspots.map((hotspot) => (
                  <TouchableOpacity
                    key={hotspot.id}
                    style={[
                      styles.selectRow,
                      {
                        backgroundColor:
                          selectedHotspotId === hotspot.id
                            ? colors.backgroundSelected
                            : colors.backgroundElement,
                        borderColor:
                          selectedHotspotId === hotspot.id
                            ? "#1877F2"
                            : colors.backgroundSelected,
                      },
                    ]}
                    onPress={() => setSelectedHotspotId(hotspot.id)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.radio,
                        {
                          borderColor:
                            selectedHotspotId === hotspot.id
                              ? "#1877F2"
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {selectedHotspotId === hotspot.id && (
                        <View style={styles.radioDot} />
                      )}
                    </View>
                    <View style={styles.selectRowInfo}>
                      <Text
                        style={[styles.selectRowTitle, { color: colors.text }]}
                      >
                        {hotspot.name}
                      </Text>
                      <Text
                        style={[
                          styles.selectRowMeta,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {hotspot.address}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}

              {/* Notes */}
              <Text
                style={[
                  styles.modalLabel,
                  { color: colors.text, marginTop: Spacing.three },
                ]}
              >
                Notes (optional)
              </Text>
              <TextInput
                style={[
                  styles.notesInput,
                  {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.backgroundSelected,
                    color: colors.text,
                  },
                ]}
                placeholder="Any additional notes..."
                placeholderTextColor={colors.textSecondary}
                value={dropoffNotes}
                onChangeText={setDropoffNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Confirm button */}
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  dropoffLoading && styles.disabledButton,
                ]}
                onPress={handleConfirmDropoff}
                disabled={dropoffLoading}
                activeOpacity={0.8}
              >
                {dropoffLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirm Drop-off</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

export default function StaffDashboard() {
  return (
    <StaffGuard>
      <DashboardContent />
    </StaffGuard>
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
  scrollContent: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  roleBadge: {
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.half,
    borderRadius: 8,
  },
  roleBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dropoffButton: {
    backgroundColor: "#1877F2",
    borderRadius: 10,
    paddingVertical: Spacing.three,
    alignItems: "center",
    marginBottom: Spacing.four,
  },
  dropoffButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: Spacing.two,
  },
  emptyCard: {
    borderRadius: 10,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: "italic",
  },
  itemCard: {
    borderRadius: 10,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  itemCardBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemCardInfo: {
    flex: 1,
    marginRight: Spacing.two,
  },
  itemCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: Spacing.half,
  },
  itemCardMeta: {
    fontSize: 12,
  },
  itemCardRight: {
    alignItems: "flex-end",
    gap: Spacing.two,
  },
  claimCountBadge: {
    backgroundColor: "#E4E6EB",
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 6,
  },
  claimCountText: {
    color: "#1C1E21",
    fontSize: 11,
    fontWeight: "600",
  },
  viewClaimsButton: {
    backgroundColor: "#1877F2",
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: 8,
  },
  viewClaimsText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  theftCard: {
    borderRadius: 10,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    borderLeftWidth: 4,
  },
  theftItemTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: Spacing.half,
  },
  theftDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.one,
  },
  theftTime: {
    fontSize: 11,
    marginBottom: Spacing.two,
  },
  theftActions: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  reviewButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: Spacing.two,
    alignItems: "center",
  },
  reviewButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  resolveButton: {
    flex: 1,
    backgroundColor: "#42B72A",
    borderRadius: 8,
    paddingVertical: Spacing.two,
    alignItems: "center",
  },
  resolveButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.6,
  },
  // Modal styles
  modalRoot: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E4E6EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalClose: {
    fontSize: 16,
  },
  modalScroll: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.two,
  },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.two,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1877F2",
  },
  selectRowInfo: {
    flex: 1,
  },
  selectRowTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.half,
  },
  selectRowMeta: {
    fontSize: 12,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.three,
    fontSize: 15,
    minHeight: 80,
  },
  confirmButton: {
    backgroundColor: "#1877F2",
    borderRadius: 10,
    paddingVertical: Spacing.three,
    alignItems: "center",
    marginTop: Spacing.four,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  errorBox: {
    backgroundColor: "#E4E6EB",
    borderRadius: 8,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  errorText: {
    color: "#65676B",
    fontSize: 14,
  },
});
