import { Colors, Spacing } from "@/constants/theme";
import { getCurrentProfile } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { BuildingType, Hotspot } from "@/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BUILDING_TYPES: { label: string; value: BuildingType }[] = [
  { label: "Library", value: "library" },
  { label: "Student Center", value: "student_center" },
  { label: "Lecture Hall", value: "lecture_hall" },
  { label: "Gym", value: "gym" },
  { label: "Admin Building", value: "admin_building" },
  { label: "Other", value: "other" },
];

export default function SelectHotspotScreen() {
  const router = useRouter();
  const { campusCodeId } = useLocalSearchParams<{ campusCodeId: string }>();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];

  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create hotspot form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newBuildingType, setNewBuildingType] = useState<BuildingType>("library");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    fetchHotspots();
  }, [campusCodeId]);

  const fetchHotspots = async () => {
    if (!campusCodeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("hotspots")
        .select("*")
        .eq("campus_code_id", campusCodeId)
        .eq("is_active", true)
        .order("name");

      if (fetchError) throw fetchError;
      setHotspots((data as Hotspot[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load hotspots.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreateHotspot = async () => {
    setCreateError(null);
    if (!newName.trim()) {
      setCreateError("Name is required.");
      return;
    }
    if (!newAddress.trim()) {
      setCreateError("Address is required.");
      return;
    }

    setCreating(true);
    try {
      const { data, error: insertError } = await supabase
        .from("hotspots")
        .insert({
          name: newName.trim(),
          address: newAddress.trim(),
          building_type: newBuildingType,
          campus_code_id: campusCodeId,
          latitude: 0,
          longitude: 0,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const created = data as Hotspot;
      setHotspots((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedIds((prev) => new Set([...prev, created.id]));

      setNewName("");
      setNewAddress("");
      setNewBuildingType("library");
      setShowCreateForm(false);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create hotspot.");
    } finally {
      setCreating(false);
    }
  };

  const handleConfirm = async () => {
    if (selectedIds.size === 0) return;

    setSaving(true);
    setError(null);
    try {
      const profile = await getCurrentProfile();
      if (!profile) throw new Error("Not authenticated.");

      const rows = Array.from(selectedIds).map((hotspotId) => ({
        profile_id: profile.id,
        hotspot_id: hotspotId,
        campus_code_id: campusCodeId ?? null,
      }));

      const { error: insertError } = await supabase
        .from("hotspot_managers")
        .upsert(rows, {
          onConflict: "profile_id,hotspot_id",
          ignoreDuplicates: true,
        });

      if (insertError) throw insertError;

      router.replace("/(tabs)/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const styles = makeStyles(colors);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Choose Lost & Found Desks</Text>
            <Text style={styles.subtitle}>
              A hotspot is a campus pickup or drop-off desk. Select every desk
              you manage so claims and drop-offs route to you.
            </Text>
          </View>

          {error !== null && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {loading ? (
            <ActivityIndicator
              size="large"
              color="#1877F2"
              style={{ marginTop: Spacing.five }}
            />
          ) : (
            <>
              {hotspots.length === 0 && !showCreateForm && (
                <Text style={styles.emptyText}>
                  No desks are linked to this campus code yet. Add the first
                  Lost & Found desk below.
                </Text>
              )}

              {hotspots.map((hotspot) => {
                const selected = selectedIds.has(hotspot.id);
                return (
                  <TouchableOpacity
                    key={hotspot.id}
                    style={[styles.hotspotCard, selected && styles.hotspotCardSelected]}
                    onPress={() => toggleSelection(hotspot.id)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.hotspotCardContent}>
                      <Text style={[styles.hotspotName, selected && styles.hotspotNameSelected]}>
                        {hotspot.name}
                      </Text>
                      <Text style={styles.hotspotMeta}>
                        {hotspot.building_type.replace(/_/g, " ")} · {hotspot.address}
                      </Text>
                    </View>
                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                      {selected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Create new hotspot form */}
              {showCreateForm ? (
                <View style={styles.createForm}>
                  <Text style={styles.createFormTitle}>Add Lost & Found Desk</Text>

                  {createError !== null && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{createError}</Text>
                    </View>
                  )}

                  <Text style={styles.fieldLabel}>Desk Name</Text>
                  <TextInput
                    style={styles.input}
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="e.g. Morris Library Front Desk"
                    placeholderTextColor={colors.placeholder}
                    editable={!creating}
                  />

                  <Text style={styles.fieldLabel}>Building Address</Text>
                  <TextInput
                    style={styles.input}
                    value={newAddress}
                    onChangeText={setNewAddress}
                    placeholder="e.g. 181 S College Ave, Newark, DE"
                    placeholderTextColor={colors.placeholder}
                    editable={!creating}
                  />

                  <Text style={styles.fieldLabel}>Location Type</Text>
                  <View style={styles.buildingTypeRow}>
                    {BUILDING_TYPES.map((bt) => (
                      <TouchableOpacity
                        key={bt.value}
                        style={[
                          styles.buildingTypeChip,
                          newBuildingType === bt.value && styles.buildingTypeChipSelected,
                        ]}
                        onPress={() => setNewBuildingType(bt.value)}
                        disabled={creating}
                      >
                        <Text
                          style={[
                            styles.buildingTypeLabel,
                            newBuildingType === bt.value && styles.buildingTypeLabelSelected,
                          ]}
                        >
                          {bt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.createFormActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setShowCreateForm(false);
                        setCreateError(null);
                      }}
                      disabled={creating}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.addButton, creating && styles.buttonDisabled]}
                      onPress={handleCreateHotspot}
                      disabled={creating}
                    >
                      {creating ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.addButtonText}>Add Desk</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={() => setShowCreateForm(true)}
                >
                  <Text style={styles.createButtonText}>+ Add a new Lost & Found desk</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {!loading && selectedIds.size === 0 && (
            <Text style={styles.selectionHint}>
              Select at least one desk to start managing claims, or skip and
              add desks later from the Staff Dashboard.
            </Text>
          )}

          <TouchableOpacity
            style={[
              styles.confirmButton,
              (selectedIds.size === 0 || saving) && styles.buttonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={selectedIds.size === 0 || saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.confirmButtonText}>
                Save Desk Access
                {selectedIds.size > 0 ? ` (${selectedIds.size} selected)` : ""}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => router.replace("/(tabs)/")}
            disabled={saving}
          >
            <Text style={styles.skipText}>
              Skip for now - add desks later
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: typeof Colors.light) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.five,
    },
    header: {
      marginBottom: Spacing.four,
    },
    title: {
      fontSize: 26,
      fontWeight: "700",
      color: colors.text,
      marginBottom: Spacing.one,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 21,
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
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontStyle: "italic",
      marginBottom: Spacing.three,
    },
    hotspotCard: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: Spacing.three,
      marginBottom: Spacing.two,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Spacing.two,
    },
    hotspotCardSelected: {
      borderColor: "#1877F2",
      backgroundColor: "#EBF3FD",
    },
    hotspotCardContent: {
      flex: 1,
      gap: 4,
    },
    hotspotName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
    },
    hotspotNameSelected: {
      color: "#1877F2",
    },
    hotspotMeta: {
      fontSize: 13,
      color: colors.textSecondary,
      textTransform: "capitalize",
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxSelected: {
      backgroundColor: "#1877F2",
      borderColor: "#1877F2",
    },
    checkmark: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },
    createButton: {
      paddingVertical: Spacing.three,
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: "#1877F2",
      borderStyle: "dashed",
      marginBottom: Spacing.three,
    },
    createButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#1877F2",
    },
    createForm: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.three,
      marginBottom: Spacing.three,
      gap: Spacing.two,
    },
    createFormTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: Spacing.one,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    buildingTypeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.one,
    },
    buildingTypeChip: {
      paddingHorizontal: Spacing.two,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    buildingTypeChipSelected: {
      backgroundColor: "#1877F2",
      borderColor: "#1877F2",
    },
    buildingTypeLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    buildingTypeLabelSelected: {
      color: "#FFFFFF",
      fontWeight: "600",
    },
    createFormActions: {
      flexDirection: "row",
      gap: Spacing.two,
      marginTop: Spacing.one,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    addButton: {
      flex: 2,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: "#1877F2",
      alignItems: "center",
    },
    addButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    selectionHint: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginTop: Spacing.one,
      marginBottom: Spacing.two,
      textAlign: "center",
    },
    confirmButton: {
      backgroundColor: "#42B72A",
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: Spacing.three,
    },
    confirmButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    skipButton: {
      alignItems: "center",
      paddingVertical: Spacing.three,
    },
    skipText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
  });
}
