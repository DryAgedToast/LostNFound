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
  CustomQuestion,
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
  pending: "Pending Pickup",
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
  const [existingClaim, setExistingClaim] = useState<Claim | null>(null);
  const [isHotspotManager, setIsHotspotManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editQuestions, setEditQuestions] = useState<CustomQuestion[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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
          setExistingClaim(null);
          setIsHotspotManager(false);
        } else {
          throw new Error("Item not found");
        }
        return;
      }

      const [fetchedProfile, itemRes] = await Promise.all([
        getCurrentProfile(),
        supabase
          .from("items")
          .select("*, profiles!poster_id(*), hotspots(*)")
          .eq("id", id)
          .single(),
      ]);

      if (!fetchedProfile) throw new Error("Not authenticated");
      if (itemRes.error) throw itemRes.error;

      const fetchedItem = itemRes.data as ItemRow;

      setItem(fetchedItem);
      setCurrentProfile(fetchedProfile);
      setPendingClaims([]);
      setExistingClaim(null);
      setIsHotspotManager(false);

      if (
        fetchedItem.hotspot_id !== null &&
        fetchedItem.poster_id !== fetchedProfile.id
      ) {
        const { data: managerRows, error: managerError } = await supabase
          .from("hotspot_managers")
          .select("id")
          .eq("hotspot_id", fetchedItem.hotspot_id)
          .eq("profile_id", fetchedProfile.id)
          .limit(1);

        if (managerError) throw managerError;
        setIsHotspotManager((managerRows ?? []).length > 0);
      }

      if (fetchedItem.poster_id !== fetchedProfile.id) {
        const { data: ownClaims, error: ownClaimsErr } = await supabase
          .from("claims")
          .select("*")
          .eq("item_id", id)
          .eq("claimant_id", fetchedProfile.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (ownClaimsErr) throw ownClaimsErr;
        setExistingClaim(((ownClaims ?? []) as Claim[])[0] ?? null);
      }

      // If viewer is the poster, load pending claims
      if (
        fetchedItem.deleted_at === null &&
        fetchedItem.poster_id === fetchedProfile.id
      ) {
        const { data: claimsData, error: claimsErr } = await supabase
          .from("claims")
          .select("*, profiles!claimant_id(*)")
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

  const insertPostDeletedMessages = async (itemId: string, senderId: string) => {
    const { data: claimRows, error: claimsError } = await supabase
      .from("claims")
      .select("id")
      .eq("item_id", itemId);

    if (claimsError) throw claimsError;

    const rows = ((claimRows ?? []) as { id: string }[]).map((claim) => ({
      claim_id: claim.id,
      sender_id: senderId,
      content: "The finder has archived this post. Existing chats remain available.",
      message_type: "system",
    }));

    if (rows.length === 0) return;

    const { error: messageError } = await supabase
      .from("messages")
      .insert(rows as never);

    if (messageError) throw messageError;
  };

  const confirmDeletePost = () => {
    if (!item || !currentProfile || deletingPost) return;

    if (Platform.OS === "web") {
      const ok = window.confirm(
        "Delete this post?\n\nThis will remove the post from normal browsing, but existing claim chats will remain available.",
      );
      if (ok) handleDeletePost();
      return;
    }
    Alert.alert(
      "Delete this post?",
      "This will remove the post from normal browsing, but existing claim chats will remain available.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Post",
          style: "destructive",
          onPress: handleDeletePost,
        },
      ],
    );
  };

  const handleRestorePost = async () => {
    if (!item || !currentProfile) return;
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("items")
        .update({ deleted_at: null, deleted_by: null } as never)
        .eq("id", item.id);
      if (updateError) throw updateError;
      setItem({ ...item, deleted_at: null, deleted_by: null });
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) showDatabaseNotConnectedPopup();
      setError(err instanceof Error ? err.message : "Unable to restore post.");
    }
  };

  const handleDeletePost = async () => {
    if (!item || !currentProfile || deletingPost) return;

    setDeletingPost(true);
    setError(null);
    try {
      const deletedAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("items")
        .update({
          deleted_at: deletedAt,
          deleted_by: currentProfile.id,
        } as never)
        .eq("id", item.id);

      if (updateError) throw updateError;

      await insertPostDeletedMessages(item.id, currentProfile.id);
      setItem({
        ...item,
        deleted_at: deletedAt,
        deleted_by: currentProfile.id,
      });
      setPendingClaims([]);
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        showDatabaseNotConnectedPopup();
      }
      setError(err instanceof Error ? err.message : "Unable to delete post.");
    } finally {
      setDeletingPost(false);
    }
  };

  // ── Edit handlers ─────────────────────────────────────────────────────────

  const openEditMode = () => {
    if (!item) return;
    setEditTitle(item.title);
    setEditDescription(item.description ?? "");
    setEditQuestions(item.custom_questions ? [...item.custom_questions] : []);
    setEditError(null);
    setEditMode(true);
  };

  const cancelEditMode = () => {
    if (!item) return;
    const dirty =
      editTitle !== item.title ||
      editDescription !== (item.description ?? "") ||
      JSON.stringify(editQuestions) !== JSON.stringify(item.custom_questions ?? []);

    const doCancel = () => setEditMode(false);
    if (!dirty) { doCancel(); return; }
    if (Platform.OS === "web") {
      if (window.confirm("Discard changes?")) doCancel();
      return;
    }
    Alert.alert("Discard changes?", "Your edits will not be saved.", [
      { text: "Keep Editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: doCancel },
    ]);
  };

  const handleSaveEdit = async () => {
    if (!item) return;
    if (!editTitle.trim()) { setEditError("Title cannot be empty."); return; }
    setEditSaving(true);
    setEditError(null);
    try {
      const newTitle = editTitle.trim();
      const newDesc = editDescription.trim() || null;
      const newQuestions = editQuestions.filter((q) => q.question.trim() !== "");

      const { error: updateError } = await supabase
        .from("items")
        .update({
          title: newTitle,
          description: newDesc,
          custom_questions: newQuestions,
        } as never)
        .eq("id", item.id);
      if (updateError) throw updateError;

      setItem({ ...item, title: newTitle, description: newDesc, custom_questions: newQuestions });
      setEditMode(false);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Unable to save changes.");
    } finally {
      setEditSaving(false);
    }
  };

  const addQuestion = () => {
    if (editQuestions.length >= 5) return;
    setEditQuestions([
      ...editQuestions,
      { id: `q-${Date.now()}`, question: "" },
    ]);
  };

  const updateQuestion = (index: number, text: string) => {
    const updated = [...editQuestions];
    updated[index] = { ...updated[index], question: text };
    setEditQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    setEditQuestions(editQuestions.filter((_, i) => i !== index));
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
  const isArchived = item.deleted_at !== null;
  const itemIsAtHotspot = item.hotspot_id !== null && item.status === "at_hotspot";
  const canDeletePost = !isArchived && ((isOwner && !itemIsAtHotspot) || isHotspotManager);
  const canEdit = isOwner && !isArchived && !itemIsAtHotspot;
  const canClaim =
    !isArchived &&
    !isOwner &&
    existingClaim === null &&
    (item.status === "unclaimed" || item.status === "at_hotspot");
  const canReportTheft = !isArchived && !isOwner && item.status === "claimed";

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
        {/* Header row: back + optional edit controls */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => editMode ? cancelEditMode() : router.canGoBack() ? router.back() : router.replace("/(tabs)/")}
          >
            <Text style={styles.backButtonText}>
              {editMode ? "Cancel" : "← Back"}
            </Text>
          </TouchableOpacity>
          {editMode ? (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveEdit}
              disabled={editSaving}
            >
              <Text style={[styles.saveButtonText, editSaving && styles.buttonDisabled]}>
                {editSaving ? "Saving…" : "Save"}
              </Text>
            </TouchableOpacity>
          ) : canEdit ? (
            <TouchableOpacity style={styles.editButton} onPress={openEditMode}>
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          ) : null}
        </View>

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
          {editMode ? (
            /* ── Edit mode ── */
            <>
              {editError !== null && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{editError}</Text>
                </View>
              )}

              <Text style={styles.editLabel}>Title *</Text>
              <TextInput
                style={styles.editInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Item title"
                placeholderTextColor={colors.textSecondary}
                editable={!editSaving}
                autoFocus
              />

              <Text style={styles.editLabel}>Description</Text>
              <TextInput
                style={[styles.editInput, styles.editTextArea]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Optional description"
                placeholderTextColor={colors.textSecondary}
                multiline
                editable={!editSaving}
              />

              <View style={styles.questionsHeader}>
                <Text style={styles.editLabel}>Verification Questions</Text>
                {editQuestions.length < 5 && (
                  <TouchableOpacity onPress={addQuestion} disabled={editSaving}>
                    <Text style={styles.addQuestionText}>+ Add</Text>
                  </TouchableOpacity>
                )}
              </View>
              {editQuestions.length === 0 && (
                <Text style={styles.questionsEmpty}>
                  No questions yet. Add up to 5 questions claimants must answer.
                </Text>
              )}
              {editQuestions.map((q, index) => (
                <View key={q.id} style={styles.questionRow}>
                  <TextInput
                    style={[styles.editInput, styles.questionInput]}
                    value={q.question}
                    onChangeText={(text) => updateQuestion(index, text)}
                    placeholder={`Question ${index + 1}`}
                    placeholderTextColor={colors.textSecondary}
                    editable={!editSaving}
                  />
                  <TouchableOpacity
                    style={styles.removeQuestionButton}
                    onPress={() => removeQuestion(index)}
                    disabled={editSaving}
                  >
                    <Text style={styles.removeQuestionText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          ) : (
            /* ── View mode ── */
            <>
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
                    {
                      backgroundColor: isArchived
                        ? "#65676B"
                        : STATUS_COLORS[item.status],
                    },
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {isArchived ? "Deleted" : STATUS_LABELS[item.status]}
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

              {/* Custom questions (view only) */}
              {item.custom_questions && item.custom_questions.length > 0 && (
                <View style={styles.metaBlock}>
                  <Text style={styles.metaLabel}>Verification Questions</Text>
                  {item.custom_questions.map((q, i) => (
                    <Text key={q.id} style={styles.metaValue}>
                      {i + 1}. {q.question}
                    </Text>
                  ))}
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
            </>
          )}

          {/* Actions — hidden in edit mode */}
          {/* Error display */}
          {!editMode && error !== null && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Success message for theft claim */}
          {!editMode && theftSuccess && (
            <View style={styles.successBox}>
              <Text style={styles.successText}>
                Theft claim submitted. We will review your report.
              </Text>
            </View>
          )}

          {!editMode && isArchived && (
            <View style={styles.deletedNotice}>
              <Text style={styles.deletedNoticeText}>
                This post was deleted. Existing chats remain available.
              </Text>
            </View>
          )}

          {!editMode && isArchived && isOwner && (
            <TouchableOpacity
              style={styles.restorePostButton}
              onPress={handleRestorePost}
              activeOpacity={0.8}
            >
              <Text style={styles.restorePostButtonText}>Restore Post</Text>
            </TouchableOpacity>
          )}

          {!editMode && !isArchived && isOwner && (
            <View style={styles.ownerPlaceholderButton}>
              <Text style={styles.ownerPlaceholderButtonText}>
                You posted this item
              </Text>
            </View>
          )}

          {!editMode && canDeletePost && (
            <TouchableOpacity
              style={[styles.deletePostButton, deletingPost && styles.buttonDisabled]}
              onPress={confirmDeletePost}
              disabled={deletingPost}
              activeOpacity={0.8}
            >
              {deletingPost ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.deletePostButtonText}>Delete Post</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Viewer is NOT the poster, item is claimable */}
          {!editMode && !isArchived && !isOwner && existingClaim !== null && (
            <TouchableOpacity
              style={styles.viewClaimButton}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/messages",
                  params: { claimId: existingClaim.id },
                })
              }
              activeOpacity={0.8}
            >
              <Text style={styles.viewClaimButtonText}>View Claim</Text>
            </TouchableOpacity>
          )}

          {!editMode && canClaim && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push(`/claim/${item.id}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>This is Mine</Text>
            </TouchableOpacity>
          )}

          {/* Viewer is NOT the poster, item is claimed → theft report */}
          {!editMode && canReportTheft && (
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

          {/* Viewer IS the poster → pending claims list (direct items only, not hotspot) */}
          {!editMode && !isArchived && isOwner && !itemIsAtHotspot && (
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
                        onPress={() =>
                          router.push({
                            pathname: "/(tabs)/messages",
                            params: { claimId: claim.id },
                          })
                        }
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
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.two,
    },
    backButton: {},
    backButtonText: {
      color: "#1877F2",
      fontSize: 15,
      fontWeight: "600",
    },
    editButton: {},
    editButtonText: {
      color: "#1877F2",
      fontSize: 15,
      fontWeight: "600",
    },
    saveButton: {},
    saveButtonText: {
      color: "#1877F2",
      fontSize: 15,
      fontWeight: "700",
    },
    editLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: Spacing.one,
      marginTop: Spacing.two,
    },
    editInput: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 10,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      fontSize: 15,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.two,
    },
    editTextArea: {
      minHeight: 90,
      textAlignVertical: "top",
    },
    questionsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: Spacing.two,
      marginBottom: Spacing.one,
    },
    addQuestionText: {
      color: "#1877F2",
      fontSize: 14,
      fontWeight: "700",
    },
    questionsEmpty: {
      fontSize: 13,
      color: colors.textSecondary,
      fontStyle: "italic",
      marginBottom: Spacing.three,
    },
    questionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.two,
      marginBottom: Spacing.two,
    },
    questionInput: {
      flex: 1,
      marginBottom: 0,
    },
    removeQuestionButton: {
      padding: Spacing.two,
    },
    removeQuestionText: {
      color: "#E53935",
      fontSize: 16,
      fontWeight: "700",
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
    ownerPlaceholderButton: {
      backgroundColor: colors.backgroundSelected,
      borderRadius: 12,
      paddingVertical: Spacing.three,
      alignItems: "center",
      marginTop: Spacing.two,
    },
    ownerPlaceholderButtonText: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: "700",
    },
    deletedNotice: {
      backgroundColor: colors.backgroundSelected,
      borderRadius: 10,
      padding: Spacing.three,
      marginBottom: Spacing.three,
    },
    deletedNoticeText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "600",
      textAlign: "center",
    },
    restorePostButton: {
      backgroundColor: "#42B72A",
      borderRadius: 12,
      paddingVertical: Spacing.three,
      alignItems: "center",
      marginTop: Spacing.two,
    },
    restorePostButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
    deletePostButton: {
      backgroundColor: "#E53935",
      borderRadius: 12,
      paddingVertical: Spacing.three,
      alignItems: "center",
      marginTop: Spacing.two,
    },
    deletePostButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
    viewClaimButton: {
      backgroundColor: "#A8E6A3",
      borderRadius: 12,
      paddingVertical: Spacing.three,
      alignItems: "center",
      marginTop: Spacing.two,
    },
    viewClaimButtonText: {
      color: "#1C1E21",
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
