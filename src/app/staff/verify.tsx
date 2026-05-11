import ClaimReviewCard from "@/components/ClaimReviewCard";
import StaffGuard from "@/components/StaffGuard";
import { Colors, Spacing } from "@/constants/theme";
import { getCurrentProfile } from "@/lib/auth";
import { verifyIdentityForClaim } from "@/lib/idanalyzer";
import { openStripeIdentityForClaim } from "@/lib/stripeIdentity";
import { supabase } from "@/lib/supabase";
import type { Claim, Profile } from "@/types";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

// ── Types ──────────────────────────────────────────────────────────────────────

type ScanState =
  | "idle"
  | "scanning_front"
  | "scanning_back"
  | "processing"
  | "done";

interface ClaimDetail extends Claim {
  itemTitle: string;
  itemImageUrl: string | null;
  claimantName: string;
  claimantEmail: string;
}

// ── Verify Screen ──────────────────────────────────────────────────────────────

function VerifyContent() {
  const router = useRouter();
  const params = useLocalSearchParams<{ claimId: string }>();
  const claimId = params.claimId ?? "";
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [claimDetail, setClaimDetail] = useState<ClaimDetail | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [frontImageUri, setFrontImageUri] = useState<string | null>(null);
  const [backImageUri, setBackImageUri] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [capturedLocally, setCapturedLocally] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const [profile, claimResponse] = await Promise.all([
        getCurrentProfile(),
        supabase
          .from("claims")
          .select(
            "*, items!item_id(title, image_url, custom_questions), profiles!claimant_id(display_name, email)",
          )
          .eq("id", claimId)
          .single(),
      ]);

      setCurrentProfile(profile);

      if (claimResponse.error) throw claimResponse.error;

      const raw = claimResponse.data as Claim & {
        items: {
          title: string;
          image_url: string | null;
          custom_questions: Claim["custom_answers"];
        } | null;
        profiles: { display_name: string; email: string } | null;
      };

      setClaimDetail({
        id: raw.id,
        item_id: raw.item_id,
        claimant_id: raw.claimant_id,
        custom_answers: raw.custom_answers,
        status: raw.status,
        reviewed_by: raw.reviewed_by,
        reviewed_at: raw.reviewed_at,
        identity_verified: raw.identity_verified,
        identity_record_id: raw.identity_record_id,
        stripe_verification_session_id:
          raw.stripe_verification_session_id ?? null,
        created_at: raw.created_at,
        itemTitle: raw.items?.title ?? "Unknown Item",
        itemImageUrl: raw.items?.image_url ?? null,
        claimantName: raw.profiles?.display_name ?? "Unknown",
        claimantEmail: raw.profiles?.email ?? "",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load claim.";
      setDataError(message);
    } finally {
      setDataLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Camera capture ───────────────────────────────────────────────────────────

  const handleBeginScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          "Camera Permission Required",
          "Please allow camera access to scan ID documents.",
        );
        return;
      }
    }
    setFrontImageUri(null);
    setBackImageUri(null);
    setProcessingError(null);
    setScanState("scanning_front");
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) return;

      if (scanState === "scanning_front") {
        setFrontImageUri(photo.uri);
        setScanState("scanning_back");
      } else if (scanState === "scanning_back") {
        const front = frontImageUri;
        setBackImageUri(photo.uri);
        setScanState("processing");

        if (!front) {
          setProcessingError("Front image was lost. Please retry.");
          setScanState("idle");
          return;
        }

        if (!currentProfile || !claimDetail) {
          setProcessingError("Session data missing. Please retry.");
          setScanState("idle");
          return;
        }

        try {
          if (!process.env.EXPO_PUBLIC_IDANALYZER_KEY) {
            setCapturedLocally(true);
            setProcessingError(
              "ID verification service not configured — photo saved locally for review",
            );
            setScanState("done");
          } else {
            const result = await verifyIdentityForClaim({
              claimId,
              frontImageUri: front,
              backImageUri: photo.uri,
              idType: "drivers_license",
              claimantProfileId: claimDetail.claimant_id,
              recordedByProfileId: currentProfile.id,
            });

            if (!result.success) {
              throw new Error(result.error ?? "Verification failed.");
            }

            setScanState("done");
            fetchData();
          }
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Verification failed.";
          setProcessingError(message);
          setScanState("idle");
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to capture photo.";
      setProcessingError(message);
    }
  };

  const handleStripeIdentity = async () => {
    if (!claimId) return;
    setStripeLoading(true);
    try {
      const result = await openStripeIdentityForClaim(claimId);
      if (!result.ok) {
        Alert.alert("Stripe Identity", result.error);
        return;
      }
      Alert.alert(
        "Stripe Identity",
        "When Stripe marks the session verified, approve the claim here or add a webhook to update claims automatically.",
      );
    } finally {
      setStripeLoading(false);
    }
  };

  // ── Claim actions ────────────────────────────────────────────────────────────

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("claims")
        .update({ status: "approved" })
        .eq("id", claimId);
      if (error) throw error;
      router.back();
    } catch {
      setProcessingError("Unable to update claim status.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("claims")
        .update({ status: "rejected" })
        .eq("id", claimId);
      if (error) throw error;
      router.back();
    } catch {
      setProcessingError("Unable to update claim status.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveWithId = () => {
    handleBeginScan();
  };

  // ── Camera overlay ───────────────────────────────────────────────────────────

  if (scanState === "scanning_front" || scanState === "scanning_back") {
    const label =
      scanState === "scanning_front"
        ? "Capture Front of ID"
        : "Capture Back of ID";

    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraLabelContainer}>
              <Text style={styles.cameraLabel}>{label}</Text>
            </View>
            <View style={styles.cameraIdFrame} />
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCapture}
              activeOpacity={0.8}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelScanButton}
              onPress={() => setScanState("idle")}
            >
              <Text style={styles.cancelScanText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  if (scanState === "processing") {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: colors.background }]}
      >
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1877F2" />
          <Text
            style={[styles.processingText, { color: colors.textSecondary }]}
          >
            Verifying identity...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Loading / error ──────────────────────────────────────────────────────────

  if (dataLoading) {
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

  if (dataError !== null || claimDetail === null) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: colors.background }]}
      >
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: "#65676B" }]}>
            {dataError ?? "Claim not found."}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main content ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Item image + title */}
        <View style={styles.itemHeader}>
          {claimDetail.itemImageUrl !== null ? (
            <Image
              source={{ uri: claimDetail.itemImageUrl }}
              style={styles.itemThumbnail}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                styles.itemThumbnail,
                styles.itemThumbnailPlaceholder,
                { backgroundColor: colors.backgroundElement },
              ]}
            >
              <Text
                style={[
                  styles.thumbPlaceholderText,
                  { color: colors.textSecondary },
                ]}
              >
                No Photo
              </Text>
            </View>
          )}
          <Text style={[styles.itemTitle, { color: colors.text }]}>
            {claimDetail.itemTitle}
          </Text>
        </View>

        {/* Claimant info */}
        <View
          style={[
            styles.claimantCard,
            { backgroundColor: colors.backgroundElement },
          ]}
        >
          <Text style={[styles.claimantName, { color: colors.text }]}>
            {claimDetail.claimantName}
          </Text>
          <Text style={[styles.claimantEmail, { color: colors.textSecondary }]}>
            {claimDetail.claimantEmail}
          </Text>
        </View>

        {/* Success / Error banners */}
        {scanState === "done" && (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>
              {capturedLocally ? "ID photographed" : "Identity Verified!"}
            </Text>
          </View>
        )}

        {processingError !== null && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{processingError}</Text>
            <TouchableOpacity
              onPress={handleBeginScan}
              style={styles.retryInlineButtton}
            >
              <Text style={styles.retryInlineText}>Retry Scan</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Claim review card */}
        <ClaimReviewCard
          claim={claimDetail}
          claimantName={claimDetail.claimantName}
          itemTitle={claimDetail.itemTitle}
          onApprove={handleApprove}
          onReject={handleReject}
          onApproveWithId={handleApproveWithId}
          isLoading={actionLoading}
        />

        {/* Begin ID Scan button (idle state) */}
        {scanState === "idle" && (
          <TouchableOpacity
            style={styles.scanButton}
            onPress={handleBeginScan}
            activeOpacity={0.8}
          >
            <Text style={styles.scanButtonText}>Begin ID Scan</Text>
          </TouchableOpacity>
        )}

        {scanState === "idle" && (
          <TouchableOpacity
            style={[
              styles.stripeButton,
              (actionLoading || stripeLoading) && styles.disabledButton,
            ]}
            onPress={handleStripeIdentity}
            disabled={actionLoading || stripeLoading}
            activeOpacity={0.8}
          >
            {stripeLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.stripeButtonText}>Verify with Stripe Identity</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Approve Without ID */}
        <TouchableOpacity
          style={[
            styles.approveWithoutIdButton,
            { borderColor: colors.backgroundSelected },
            actionLoading && styles.disabledButton,
          ]}
          onPress={handleApprove}
          disabled={actionLoading}
          activeOpacity={0.8}
        >
          <Text style={[styles.approveWithoutIdText, { color: colors.text }]}>
            Approve Without ID
          </Text>
        </TouchableOpacity>

        {/* Reject */}
        <TouchableOpacity
          style={[styles.rejectButton, actionLoading && styles.disabledButton]}
          onPress={handleReject}
          disabled={actionLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.rejectButtonText}>Reject Claim</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function VerifyScreen() {
  return (
    <StaffGuard>
      <VerifyContent />
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
    padding: Spacing.four,
  },
  scrollContent: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  // Item header
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  itemThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  itemThumbnailPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  thumbPlaceholderText: {
    fontSize: 11,
  },
  itemTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
  },
  // Claimant
  claimantCard: {
    borderRadius: 10,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  claimantName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: Spacing.half,
  },
  claimantEmail: {
    fontSize: 13,
  },
  // Banners
  successBanner: {
    backgroundColor: "#E4E6EB",
    borderRadius: 8,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    alignItems: "center",
  },
  successBannerText: {
    color: "#1C1E21",
    fontSize: 16,
    fontWeight: "700",
  },
  errorBanner: {
    backgroundColor: "#E4E6EB",
    borderRadius: 8,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  errorBannerText: {
    color: "#65676B",
    fontSize: 14,
    marginBottom: Spacing.two,
  },
  retryInlineButtton: {
    alignSelf: "flex-start",
  },
  retryInlineText: {
    color: "#1877F2",
    fontSize: 14,
    fontWeight: "600",
  },
  // Action buttons
  scanButton: {
    backgroundColor: "#1877F2",
    borderRadius: 10,
    paddingVertical: Spacing.three,
    alignItems: "center",
    marginBottom: Spacing.two,
  },
  scanButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  stripeButton: {
    backgroundColor: "#635BFF",
    borderRadius: 10,
    paddingVertical: Spacing.three,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    marginBottom: Spacing.two,
  },
  stripeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  approveWithoutIdButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: Spacing.three,
    alignItems: "center",
    marginBottom: Spacing.two,
  },
  approveWithoutIdText: {
    fontSize: 15,
    fontWeight: "600",
  },
  rejectButton: {
    backgroundColor: "#65676B",
    borderRadius: 10,
    paddingVertical: Spacing.three,
    alignItems: "center",
    marginBottom: Spacing.two,
  },
  rejectButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
  // Camera
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.five,
  },
  cameraLabelContainer: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  cameraLabel: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  cameraIdFrame: {
    width: 300,
    height: 190,
    borderWidth: 2,
    borderColor: "#1877F2",
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  captureButtonInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
  },
  cancelScanButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  cancelScanText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  // Processing / error states
  processingText: {
    marginTop: Spacing.three,
    fontSize: 16,
  },
  errorText: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: Spacing.three,
  },
  retryButton: {
    backgroundColor: "#1877F2",
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
