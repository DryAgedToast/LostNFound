import StaffGuard from "@/components/StaffGuard";
import { Colors, Spacing } from "@/constants/theme";
import { getCurrentProfile } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Hotspot, HotspotManager, Item, Profile } from "@/types";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
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

interface ManagedHotspotRow extends HotspotManager {
  hotspots: Hotspot;
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
  const [claimCounts, setClaimCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Teacher-specific state
  const [managedHotspots, setManagedHotspots] = useState<ManagedHotspotRow[]>([]);

  // Hotspot management dropdown
  const [allHotspots, setAllHotspots] = useState<Hotspot[]>([]);
  const [coManagersByHotspot, setCoManagersByHotspot] = useState<Record<string, string[]>>({});
  const [hotspotDropdownOpen, setHotspotDropdownOpen] = useState(false);
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
  // pendingHotspotIds: local draft while the dropdown is open (null = not editing)
  const [pendingHotspotIds, setPendingHotspotIds] = useState<Set<string> | null>(null);
  const [savingHotspots, setSavingHotspots] = useState(false);
  const [hotspotSaveError, setHotspotSaveError] = useState<string | null>(null);

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await getCurrentProfile();
      setCurrentProfile(profile);

      // Fetch teacher's managed hotspots
      if (profile) {
        const { data: managedData } = await supabase
          .from("hotspot_managers")
          .select("*, hotspots(*)")
          .eq("profile_id", profile.id);

        const managed = (managedData ?? []) as ManagedHotspotRow[];
        setManagedHotspots(managed);
        const managedHotspotIds = managed.map((hm) => hm.hotspot_id);

        // Fetch all hotspots for this campus and all their managers (for the dropdown).
        // If no campus can be inferred yet, fall back to active hotspots so a new staff
        // account can pick its first managed locations.
        const campusCodeId = managed.length > 0 ? managed[0].campus_code_id : null;
        const allHotspotsQuery = supabase
            .from("hotspots")
            .select("*")
            .eq("is_active", true)
            .order("name");
        const { data: allHotspotsData } = campusCodeId
          ? await allHotspotsQuery.eq("campus_code_id", campusCodeId)
          : await allHotspotsQuery;

        const allHots = (allHotspotsData ?? []) as Hotspot[];
        setAllHotspots(allHots);

        if (allHots.length > 0) {
          const { data: allManagersData } = await supabase
            .from("hotspot_managers")
            .select("hotspot_id, profiles!profile_id(display_name)")
            .in("hotspot_id", allHots.map((h) => h.id))
            .neq("profile_id", profile.id);

          const byHotspot: Record<string, string[]> = {};
          ((allManagersData ?? []) as unknown as { hotspot_id: string; profiles: { display_name: string } | null }[])
            .forEach((row) => {
              if (!byHotspot[row.hotspot_id]) byHotspot[row.hotspot_id] = [];
              if (row.profiles?.display_name) byHotspot[row.hotspot_id].push(row.profiles.display_name);
            });
          setCoManagersByHotspot(byHotspot);
        }

        // Fetch at_hotspot items only at this teacher's managed hotspots.
        if (managedHotspotIds.length === 0) {
          setHotspotItems([]);
          setClaimCounts({});
          return;
        }

        const { data: itemsData, error: itemsError } = await supabase
          .from("items")
          .select("*")
          .eq("status", "at_hotspot")
          .in("hotspot_id", managedHotspotIds)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        if (itemsError) throw itemsError;

        const items = (itemsData ?? []) as Item[];
        setHotspotItems(items);

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
        } else {
          setClaimCounts({});
        }
      }
    } catch {
      setHotspotItems([]);
      setClaimCounts({});
      setError("Unable to load staff data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const openDropoffModal = async () => {
    setDropoffVisible(true);
    setModalLoading(true);
    setDropoffError(null);
    setSelectedItemId(null);
    setSelectedHotspotId(null);
    setDropoffNotes("");

    try {
      const managedHotspotIds = managedHotspots.map((hotspot) => hotspot.hotspot_id);
      const [
        { data: itemsData, error: itemsError },
        { data: hotspotsData, error: hotspotsError },
      ] = await Promise.all([
        supabase
          .from("items")
          .select("*")
          .eq("status", "unclaimed")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("hotspots")
          .select("*")
          .eq("is_active", true)
          .in("id", managedHotspotIds.length > 0 ? managedHotspotIds : [""])
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

  const openHotspotDropdown = () => {
    const currentIds = new Set(managedHotspots.map((hm) => hm.hotspot_id));
    setPendingHotspotIds(currentIds);
    setHotspotSaveError(null);
    setActiveTooltipId(null);
    setHotspotDropdownOpen(true);
  };

  const cancelHotspotEdit = () => {
    setHotspotDropdownOpen(false);
    setPendingHotspotIds(null);
    setHotspotSaveError(null);
    setActiveTooltipId(null);
  };

  const togglePendingHotspot = (hotspotId: string) => {
    setPendingHotspotIds((prev) => {
      if (!prev) return prev;
      const next = new Set(prev);
      if (next.has(hotspotId)) {
        next.delete(hotspotId);
      } else {
        next.add(hotspotId);
      }
      return next;
    });
  };

  const saveHotspotChanges = async () => {
    if (!currentProfile || !pendingHotspotIds) return;
    setSavingHotspots(true);
    setHotspotSaveError(null);
    try {
      const savedIds = new Set(managedHotspots.map((hm) => hm.hotspot_id));

      const toAdd = [...pendingHotspotIds].filter((id) => !savedIds.has(id));
      const toRemove = [...savedIds].filter((id) => !pendingHotspotIds.has(id));

      if (toAdd.length > 0) {
        const rows = toAdd.map((hotspotId) => ({
          profile_id: currentProfile.id,
          hotspot_id: hotspotId,
          campus_code_id: allHotspots.find((h) => h.id === hotspotId)?.campus_code_id ?? null,
        }));
        const { error } = await supabase.from("hotspot_managers").insert(rows);
        if (error) throw error;
      }

      for (const hotspotId of toRemove) {
        const { error } = await supabase
          .from("hotspot_managers")
          .delete()
          .eq("profile_id", currentProfile.id)
          .eq("hotspot_id", hotspotId);
        if (error) throw error;
      }

      await fetchData();
      setHotspotDropdownOpen(false);
      setPendingHotspotIds(null);
      setHotspotSaveError(null);
    } catch (err: unknown) {
      setHotspotSaveError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSavingHotspots(false);
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
            <Text style={styles.backButtonText}>‹ Profile</Text>
          </TouchableOpacity>
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

        {/* Manage Hotspots Dropdown */}
        {allHotspots.length > 0 && (
          <View style={styles.hotspotDropdownWrapper}>
            <TouchableOpacity
              style={[styles.hotspotDropdownHeader, { backgroundColor: colors.backgroundElement }]}
              onPress={hotspotDropdownOpen ? cancelHotspotEdit : openHotspotDropdown}
              activeOpacity={0.75}
            >
              <View style={styles.hotspotDropdownHeaderLeft}>
                <Text style={[styles.hotspotDropdownTitle, { color: colors.text }]}>
                  Managed Hotspots
                </Text>
                {managedHotspots.length > 0 && (
                  <View style={styles.managedCountBadge}>
                    <Text style={styles.managedCountText}>{managedHotspots.length}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.dropdownCaret, { color: colors.textSecondary }]}>
                {hotspotDropdownOpen ? "▲" : "▼"}
              </Text>
            </TouchableOpacity>

            {hotspotDropdownOpen && pendingHotspotIds !== null && (
              <View style={[styles.hotspotDropdownBody, { backgroundColor: colors.backgroundElement }]}>
                {allHotspots.map((hotspot, idx) => {
                  const isPending = pendingHotspotIds.has(hotspot.id);
                  const others = coManagersByHotspot[hotspot.id] ?? [];
                  const tooltipVisible = activeTooltipId === hotspot.id;
                  const isLast = idx === allHotspots.length - 1;

                  return (
                    <View key={hotspot.id}>
                      <View style={styles.hotspotDropdownRow}>
                        <TouchableOpacity
                          style={styles.hotspotDropdownRowLeft}
                          onPress={() => togglePendingHotspot(hotspot.id)}
                          disabled={savingHotspots}
                          activeOpacity={0.75}
                        >
                          <View style={[styles.rowCheckbox, isPending && styles.rowCheckboxChecked]}>
                            {isPending && <Text style={styles.rowCheckmark}>✓</Text>}
                          </View>
                          <Text style={[styles.hotspotDropdownName, { color: colors.text }, isPending && styles.hotspotDropdownNameActive]}>
                            {hotspot.name}
                          </Text>
                        </TouchableOpacity>
                        {others.length > 0 && (
                          <TouchableOpacity
                            style={styles.othersCountBadge}
                            onPress={() => setActiveTooltipId(tooltipVisible ? null : hotspot.id)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.othersCountText}>
                              {others.length} other{others.length !== 1 ? "s" : ""}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {tooltipVisible && (
                        <View style={[styles.othersTooltip, { backgroundColor: colors.background }]}>
                          {others.map((name, i) => (
                            <Text key={i} style={[styles.othersTooltipName, { color: colors.textSecondary }]}>
                              • {name}
                            </Text>
                          ))}
                        </View>
                      )}
                      {!isLast && (
                        <View style={[styles.rowDivider, { backgroundColor: colors.backgroundSelected }]} />
                      )}
                    </View>
                  );
                })}

                {hotspotSaveError !== null && (
                  <View style={[styles.errorBox, { marginTop: Spacing.two, marginBottom: 0 }]}>
                    <Text style={styles.errorText}>{hotspotSaveError}</Text>
                  </View>
                )}

                <View style={styles.hotspotDropdownActions}>
                  <TouchableOpacity
                    style={[styles.hotspotCancelButton, { borderColor: colors.border }]}
                    onPress={cancelHotspotEdit}
                    disabled={savingHotspots}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.hotspotCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.hotspotSaveButton, savingHotspots && styles.disabledButton]}
                    onPress={saveHotspotChanges}
                    disabled={savingHotspots}
                    activeOpacity={0.8}
                  >
                    {savingHotspots ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.hotspotSaveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* At Hotspot Items section */}
        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.text,
              marginTop: managedHotspots.length > 0 ? Spacing.four : 0,
            },
          ]}
        >
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
              No items at your managed hotspots
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
                    <Text style={styles.viewClaimsText}>View Item</Text>
                  </TouchableOpacity>
                </View>
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
    flexDirection: "column",
    alignItems: "flex-start",
    marginBottom: Spacing.three,
    gap: Spacing.one,
  },
  backButton: {
    marginBottom: Spacing.one,
  },
  backButtonText: {
    fontSize: 15,
    color: "#1877F2",
    fontWeight: "500",
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
  // Hotspot management dropdown
  hotspotDropdownWrapper: {
    marginBottom: Spacing.three,
  },
  hotspotDropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    padding: Spacing.three,
  },
  hotspotDropdownHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  hotspotDropdownTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  managedCountBadge: {
    backgroundColor: "#1877F2",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  managedCountText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  dropdownCaret: {
    fontSize: 12,
  },
  hotspotDropdownBody: {
    marginTop: 2,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    overflow: "hidden",
  },
  hotspotDropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.two + 2,
  },
  hotspotDropdownRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Spacing.two,
  },
  rowCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#C0C0C0",
    alignItems: "center",
    justifyContent: "center",
  },
  rowCheckboxChecked: {
    backgroundColor: "#1877F2",
    borderColor: "#1877F2",
  },
  rowCheckmark: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  hotspotDropdownName: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  hotspotDropdownNameActive: {
    color: "#1877F2",
    fontWeight: "600",
  },
  othersCountBadge: {
    backgroundColor: "#E4E6EB",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  othersCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#65676B",
  },
  othersTooltip: {
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.one,
    gap: 4,
  },
  othersTooltipName: {
    fontSize: 13,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
  },
  hotspotDropdownActions: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  hotspotCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  hotspotCancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
  hotspotSaveButton: {
    flex: 2,
    backgroundColor: "#1877F2",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  hotspotSaveText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  claimRow: {
    borderRadius: 10,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  claimRowInfo: {
    flex: 1,
    gap: 4,
  },
  claimRowTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  claimRowMeta: {
    fontSize: 12,
  },
  claimRowArrow: {
    fontSize: 22,
    color: "#1877F2",
    marginLeft: Spacing.two,
  },
});
