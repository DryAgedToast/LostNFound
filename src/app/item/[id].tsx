import { Colors, Spacing } from "@/constants/theme";
import { DEMO_MODE, getCurrentProfile } from "@/lib/auth";
import {
  isDatabaseUnavailableError,
  showDatabaseNotConnectedPopup,
} from "@/lib/db-alert";
import { getMockItemById } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import type {
  Claim,
  ClaimStatus,
  Hotspot,
  Item,
  ItemCategory,
  ItemStatus,
  Profile,
} from "@/types";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ── Joined shape returned from Supabase ──────────────────────────────────────

interface ItemRow extends Item {
  profiles: Profile;
  hotspots: Hotspot | null;
}

interface ClaimWithProfile extends Claim {
  profiles: Profile;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  electronics: "Electronics",
  clothing: "Clothing",
  keys: "Keys",
  wallet: "Wallet",
  id_card: "ID Card",
  bag: "Bag",
  other: "Other",
};

const STATUS_LABELS: Record<ItemStatus, string> = {
  unclaimed: "Unclaimed",
  pending: "Pending",
  claimed: "Claimed",
  at_hotspot: "At Hotspot",
};

const STATUS_COLORS: Record<ItemStatus, string> = {
  unclaimed: "#42B72A",
  pending: "#1877F2",
  claimed: "#65676B",
  at_hotspot: "#1877F2",
};

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];

  const [item, setItem] = useState<ItemRow | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [pendingClaims, setPendingClaims] = useState<ClaimWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Theft modal state
  const [theftModalVisible, setTheftModalVisible] = useState(false);
  const [theftDescription, setTheftDescription] = useState("");
  const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
  const [submittingTheft, setSubmittingTheft] = useState(false);
  const [theftError, setTheftError] = useState<string | null>(null);
  const [theftSuccess, setTheftSuccess] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      // Use mock data in DEMO_MODE
      if (DEMO_MODE) {
        const mockItem = getMockItemById(id as string);
        if (mockItem) {
          setItem(mockItem as ItemRow);
          const profile = await getCurrentProfile();
          setCurrentProfile(profile);
          setPendingClaims([]);
        } else {
          throw new Error("Item not found");
        }
        return;
      }

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error("Not authenticated");

      const [itemRes, profileRes] = await Promise.all([
        supabase
          .from("items")
          .select("*, profiles!poster_id(*), hotspots(*)")
          .eq("id", id)
          .single(),
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      ]);

      if (itemRes.error) throw itemRes.error;
      if (profileRes.error) throw profileRes.error;

      const fetchedItem = itemRes.data as ItemRow;
      const fetchedProfile = profileRes.data as Profile;

      setItem(fetchedItem);
      setCurrentProfile(fetchedProfile);

      // If viewer is the poster, load pending claims
      if (fetchedItem.poster_id === fetchedProfile.id) {
        const { data: claimsData, error: claimsErr } = await supabase
          .from("claims")
          .select("*, profiles(*)")
          .eq("item_id", id)
          .eq("status", "pending" as ClaimStatus)
          .order("created_at", { ascending: false });

        if (claimsErr) throw claimsErr;
        setPendingClaims((claimsData ?? []) as ClaimWithProfile[]);
      }
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        showDatabaseNotConnectedPopup();
      }
      setError(err instanceof Error ? err.message : "Failed to load item");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // ── Theft claim submission ─────────────────────────────────────────────────

  const pickEvidencePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Camera roll access is needed to attach evidence.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      setEvidenceUri(result.assets[0].uri);
    }
  };

  const handleSubmitTheft = async () => {
    if (!item || !currentProfile) return;
    if (!theftDescription.trim()) {
      setTheftError("Please describe why this item was stolen from you.");
      return;
    }
    setSubmittingTheft(true);
    setTheftError(null);

    try {
      // 1. Find the approved claim
      const { data: approvedClaims, error: approvedErr } = await supabase
        .from("claims")
        .select("*")
        .eq("item_id", item.id)
        .eq("status", "approved" as ClaimStatus)
        .limit(1);

      if (approvedErr) throw approvedErr;
      if (!approvedClaims || approvedClaims.length === 0) {
        throw new Error("Could not find the approved claim for this item.");
      }

      const approvedClaim = approvedClaims[0] as Claim;

      // 2. Upload evidence photo if provided
      let evidenceUrl: string | null = null;
      if (evidenceUri !== null) {
        const filename = `theft-evidence/${Date.now()}.jpg`;
        const response = await fetch(evidenceUri);
        const blob = await response.blob();

        const { error: uploadErr } = await supabase.storage
          .from("item-images")
          .upload(filename, blob, { contentType: "image/jpeg", upsert: false });

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from("item-images")
          .getPublicUrl(filename);

        evidenceUrl = urlData.publicUrl;
      }

      // 3. Insert theft claim
      const { error: insertErr } = await supabase.from("theft_claims").insert({
        item_id: item.id,
        original_owner_id: currentProfile.id,
        disputed_claim_id: approvedClaim.id,
        description: theftDescription.trim(),
        evidence_url: evidenceUrl,
        status: "open",
      });

      if (insertErr) throw insertErr;

      // 4. Set theft_hold on identity record if present
      if (approvedClaim.identity_record_id !== null) {
        const { error: holdErr } = await supabase
          .from("identity_records")
          .update({ theft_hold: true })
          .eq("id", approvedClaim.identity_record_id);

        if (holdErr) throw holdErr;
      }

      setTheftSuccess(true);
      setTheftModalVisible(false);
      setTheftDescription("");
      setEvidenceUri(null);
      Alert.alert(
        "Report Submitted",
        "Your theft claim has been submitted for review. We will follow up with you shortly.",
      );
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        showDatabaseNotConnectedPopup();
      }
      setTheftError("Unable to submit. Check your connection.");
    } finally {
      setSubmittingTheft(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const styles = makeStyles(colors);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1877F2" />
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? "Item not found"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner =
    currentProfile !== null && item.poster_id === currentProfile.id;
  const canClaim =
    !isOwner && (item.status === "unclaimed" || item.status === "at_hotspot");
  const canReportTheft = !isOwner && item.status === "claimed";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1877F2"
          />
        }
      >
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        {/* Hero image */}
        {item.image_url !== null ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Text style={styles.heroPlaceholderText}>No Image Available</Text>
          </View>
        )}

        <View style={styles.body}>
          {/* Title */}
          <Text style={styles.title}>{item.title}</Text>

          {/* Badges */}
          <View style={styles.badgeRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {CATEGORY_LABELS[item.category]}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: STATUS_COLORS[item.status] },
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {STATUS_LABELS[item.status]}
              </Text>
            </View>
          </View>

          {/* Location */}
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Location Found</Text>
            <Text style={styles.metaValue}>{item.location_found}</Text>
          </View>

          {/* Hotspot */}
          {item.hotspots !== null && (
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Drop-off Hotspot</Text>
              <Text style={styles.metaValue}>{item.hotspots.name}</Text>
              <Text style={styles.metaSubValue}>{item.hotspots.address}</Text>
            </View>
          )}

          {/* Description */}
          {item.description !== null && (
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Description</Text>
              <Text style={styles.metaValue}>{item.description}</Text>
            </View>
          )}

          {/* Posted by */}
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Posted By</Text>
            <Text style={styles.metaValue}>{item.profiles.display_name}</Text>
            <Text style={styles.metaSubValue}>
              {formatTime(item.created_at)}
            </Text>
          </View>

          {/* Error display */}
          {error !== null && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Success message for theft claim */}
          {theftSuccess && (
            <View style={styles.successBox}>
              <Text style={styles.successText}>
                Theft claim submitted. We will review your report.
              </Text>
            </View>
          )}

          {/* Viewer is NOT the poster, item is claimable */}
          {canClaim && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push(`/claim/${item.id}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>This is Mine</Text>
            </TouchableOpacity>
          )}

          {/* Viewer is NOT the poster, item is claimed → theft report */}
          {canReportTheft && (
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={() => setTheftModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.dangerButtonText}>
                This Item Was Stolen From Me
              </Text>
            </TouchableOpacity>
          )}

          {/* Viewer IS the poster → pending claims list */}
          {isOwner && (
            <View style={styles.claimsSection}>
              <Text style={styles.claimsSectionTitle}>Pending Claims</Text>
              {pendingClaims.length === 0 ? (
                <Text style={styles.emptyClaimsText}>
                  No claims submitted yet
                </Text>
              ) : (
                pendingClaims.map((claim) => (
                  <View key={claim.id} style={styles.claimRow}>
                    <View style={styles.claimRowInfo}>
                      <Text style={styles.claimantName}>
                        {claim.profiles?.display_name ?? "Unknown"}
                      </Text>
                      <Text style={styles.claimTime}>
                        {formatTime(claim.created_at)}
                      </Text>
                    </View>
                    <View style={styles.claimRowActions}>
                      <TouchableOpacity
                        style={styles.reviewButton}
                        onPress={() => router.push(`/claim/${claim.id}`)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.reviewButtonText}>Review</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.messageButton}
                        onPress={() => router.push(`/messages/${claim.id}`)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.messageButtonText}>Message</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Theft Report Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={theftModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTheftModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Report Theft</Text>
                <TouchableOpacity
                  onPress={() => {
                    setTheftModalVisible(false);
                    setTheftDescription("");
                    setEvidenceUri(null);
                    setTheftError(null);
                  }}
                >
                  <Text style={styles.modalClose}>Cancel</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                If you believe this item was wrongfully claimed, please provide
                details below. A staff member will review your report.
              </Text>

              {theftError !== null && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{theftError}</Text>
                </View>
              )}

              <Text style={styles.inputLabel}>Description *</Text>
              <TextInput
                style={styles.textArea}
                value={theftDescription}
                onChangeText={setTheftDescription}
                placeholder="Describe why this item was stolen from you, including any identifying details…"
                placeholderTextColor={colors.textSecondary}
                multiline
                editable={!submittingTheft}
              />

              {/* Evidence photo */}
              <TouchableOpacity
                style={styles.evidenceButton}
                onPress={pickEvidencePhoto}
                disabled={submittingTheft}
                activeOpacity={0.8}
              >
                <Text style={styles.evidenceButtonText}>
                  {evidenceUri !== null
                    ? "Change Evidence Photo"
                    : "Add Evidence Photo"}
                </Text>
              </TouchableOpacity>

              {evidenceUri !== null && (
                <Image
                  source={{ uri: evidenceUri }}
                  style={styles.evidencePreview}
                  resizeMode="cover"
                />
              )}

              <TouchableOpacity
                style={[
                  styles.submitTheftButton,
                  submittingTheft && styles.buttonDisabled,
                ]}
                onPress={handleSubmitTheft}
                disabled={submittingTheft}
                activeOpacity={0.8}
              >
                {submittingTheft ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitTheftButtonText}>
                    Submit Theft Claim
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(colors: typeof Colors.light) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    backButton: {
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.two,
    },
    backButtonText: {
      color: "#1877F2",
      fontSize: 15,
      fontWeight: "600",
    },
    heroImage: {
      width: "100%",
      height: 280,
    },
    heroPlaceholder: {
      width: "100%",
      height: 280,
      backgroundColor: colors.backgroundElement,
      justifyContent: "center",
      alignItems: "center",
    },
    heroPlaceholderText: {
      color: colors.textSecondary,
      fontSize: 16,
    },
    body: {
      padding: Spacing.four,
      paddingBottom: Spacing.six,
    },
    title: {
      fontSize: 26,
      fontWeight: "700",
      color: colors.text,
      marginBottom: Spacing.three,
    },
    badgeRow: {
      flexDirection: "row",
      gap: Spacing.two,
      marginBottom: Spacing.four,
      flexWrap: "wrap",
    },
    categoryBadge: {
      backgroundColor: colors.backgroundElement,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 12,
    },
    categoryBadgeText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 12,
    },
    statusBadgeText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "600",
    },
    metaBlock: {
      marginBottom: Spacing.three,
    },
    metaLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: Spacing.one,
    },
    metaValue: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
    },
    metaSubValue: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
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
    successBox: {
      backgroundColor: "#E4E6EB",
      borderRadius: 8,
      padding: Spacing.three,
      marginBottom: Spacing.three,
    },
    successText: {
      color: "#1C1E21",
      fontSize: 14,
    },
    primaryButton: {
      backgroundColor: "#1877F2",
      borderRadius: 12,
      paddingVertical: Spacing.three,
      alignItems: "center",
      marginTop: Spacing.two,
    },
    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
    dangerButton: {
      backgroundColor: "#65676B",
      borderRadius: 12,
      paddingVertical: Spacing.three,
      alignItems: "center",
      marginTop: Spacing.two,
    },
    dangerButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
    // Poster claims section
    claimsSection: {
      marginTop: Spacing.four,
    },
    claimsSectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginBottom: Spacing.three,
    },
    emptyClaimsText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontStyle: "italic",
    },
    claimRow: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      padding: Spacing.three,
      marginBottom: Spacing.two,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Spacing.two,
    },
    claimRowInfo: {
      flex: 1,
    },
    claimantName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
    },
    claimTime: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    claimRowActions: {
      flexDirection: "row",
      gap: Spacing.two,
    },
    reviewButton: {
      backgroundColor: "#1877F2",
      borderRadius: 8,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
    },
    reviewButtonText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "600",
    },
    messageButton: {
      backgroundColor: colors.backgroundSelected,
      borderRadius: 8,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
    },
    messageButtonText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
    },
    // Modal
    modalSafeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalContent: {
      padding: Spacing.four,
      paddingBottom: Spacing.six,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.three,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
    },
    modalClose: {
      fontSize: 16,
      color: "#1877F2",
      fontWeight: "600",
    },
    modalSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: Spacing.three,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: Spacing.two,
    },
    textArea: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 10,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
      fontSize: 15,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.backgroundSelected,
      minHeight: 120,
      textAlignVertical: "top",
      marginBottom: Spacing.three,
    },
    evidenceButton: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 10,
      paddingVertical: Spacing.three,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.backgroundSelected,
      marginBottom: Spacing.three,
    },
    evidenceButtonText: {
      color: "#1877F2",
      fontSize: 15,
      fontWeight: "600",
    },
    evidencePreview: {
      width: "100%",
      height: 200,
      borderRadius: 10,
      marginBottom: Spacing.three,
    },
    submitTheftButton: {
      backgroundColor: "#65676B",
      borderRadius: 12,
      paddingVertical: Spacing.three,
      alignItems: "center",
      marginTop: Spacing.two,
    },
    submitTheftButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });
}
