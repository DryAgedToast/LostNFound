import { Colors, Spacing } from "@/constants/theme";
import { getCurrentProfile } from "@/lib/auth";
import {
  isDatabaseUnavailableError,
  showDatabaseNotConnectedPopup,
} from "@/lib/db-alert";
import { supabase } from "@/lib/supabase";
import type { CustomQuestion, Hotspot, ItemCategory, Profile } from "@/types";
import { CameraView, useCameraPermissions } from "expo-camera";
import { File as ExpoFsFile } from "expo-file-system";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CATEGORIES: ItemCategory[] = [
  "electronics",
  "clothing",
  "keys",
  "wallet",
  "id_card",
  "bag",
  "other",
];

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  electronics: "Electronics",
  clothing: "Clothing",
  keys: "Keys",
  wallet: "Wallet",
  id_card: "ID Card",
  bag: "Bag",
  other: "Other",
};

interface QuestionField {
  localId: string;
  question: string;
}

function generateLocalId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Native `file://` URIs often fail with `fetch`+blob; read bytes explicitly. */
async function readLocalImageAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    if (!res.ok) {
      throw new Error(`Could not read image (HTTP ${res.status})`);
    }
    return await res.blob().then((b) => b.arrayBuffer());
  }

  try {
    return await new ExpoFsFile(uri).arrayBuffer();
  } catch {
    const res = await fetch(uri);
    if (!res.ok) {
      throw new Error(`Could not read image (HTTP ${res.status})`);
    }
    return await res.blob().then((b) => b.arrayBuffer());
  }
}

export default function PostScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Auth / profile state
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Form state
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraVisible, setCameraVisible] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const pickedImageMimeRef = useRef<string | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ItemCategory>("other");
  const [description, setDescription] = useState("");
  const [locationFound, setLocationFound] = useState("");
  const [hotspotId, setHotspotId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionField[]>([
    { localId: generateLocalId(), question: "" },
  ]);

  // Hotspot data
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [hotspotModalVisible, setHotspotModalVisible] = useState(false);

  // Auth gate
  useEffect(() => {
    getCurrentProfile().then((p) => {
      if (!p) {
        router.replace("/auth/login");
      } else {
        setProfile(p);
        setAuthChecked(true);
      }
    });
  }, [router]);

  // Fetch active hotspots
  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("hotspots")
          .select("*")
          .eq("is_active", true)
          .order("name");

        if (error) throw error;
        setHotspots((data ?? []) as Hotspot[]);
      } catch {
        setHotspots([]);
      }
    })();
  }, [authChecked]);

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      pickedImageMimeRef.current =
        typeof asset.mimeType === "string" ? asset.mimeType : undefined;
      setImageUri(asset.uri);
    }
  }, []);

  const openCamera = useCallback(async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow camera access to take a photo.",
        );
        return;
      }
    }

    setCameraVisible(true);
  }, [cameraPermission?.granted, requestCameraPermission]);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current) return;

    try {
      const captured = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (captured?.uri) {
        pickedImageMimeRef.current = undefined;
        setImageUri(captured.uri);
      }
      setCameraVisible(false);
    } catch {
      Alert.alert("Camera Error", "Unable to capture photo. Please try again.");
    }
  }, []);

  const addQuestion = useCallback(() => {
    if (questions.length >= 5) return;
    setQuestions((prev) => [
      ...prev,
      { localId: generateLocalId(), question: "" },
    ]);
  }, [questions.length]);

  const removeQuestion = useCallback((localId: string) => {
    setQuestions((prev) => prev.filter((q) => q.localId !== localId));
  }, []);

  const updateQuestion = useCallback((localId: string, text: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.localId === localId ? { ...q, question: text } : q)),
    );
  }, []);

  const uploadImage = async (
    uri: string,
    posterId: string,
    mimeHint?: string,
  ): Promise<string> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw new Error(
        "You must be signed in to upload a photo. Try logging out and back in.",
      );
    }

    const maybeExt = uri.split(".").pop()?.toLowerCase();
    const ext =
      maybeExt && maybeExt.length <= 5 && /^[a-z0-9]+$/.test(maybeExt)
        ? maybeExt
        : "jpg";

    const contentType =
      mimeHint && mimeHint.startsWith("image/")
        ? mimeHint
        : `image/${ext === "jpg" ? "jpeg" : ext}`;

    const fileName = `${posterId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await readLocalImageAsArrayBuffer(uri);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Could not read the image from your device.";
      throw new Error(msg);
    }

    const bytes = new Uint8Array(arrayBuffer);
    const body =
      typeof Blob !== "undefined"
        ? new Blob([bytes], { type: contentType })
        : bytes;

    const { error: uploadError } = await supabase.storage
      .from("item-images")
      .upload(fileName, body, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      const hint =
        uploadError.message?.includes("row-level security") ||
        uploadError.message?.includes("RLS")
          ? " Storage policy blocked the upload. Apply migration 005_storage_item_images_bucket.sql (or add INSERT policy on storage.objects for bucket item-images)."
          : "";
      throw new Error(
        (uploadError.message || "Storage rejected the upload.") + hint,
      );
    }

    const { data: urlData } = supabase.storage
      .from("item-images")
      .getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;
    if (!publicUrl?.trim()) {
      throw new Error("Upload succeeded but no public URL was returned.");
    }
    return publicUrl;
  };

  const handleSubmit = useCallback(async () => {
    if (!profile) return;

    setError(null);

    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    if (!locationFound.trim()) {
      setError("Please enter where the item was found.");
      return;
    }

    setSubmitting(true);

    try {
      let imageUrl: string | null = null;
      if (imageUri) {
        imageUrl = await uploadImage(
          imageUri,
          profile.user_id,
          pickedImageMimeRef.current,
        );
      }

      const customQuestions: CustomQuestion[] = questions
        .filter((q) => q.question.trim() !== "")
        .map((q) => ({ id: generateLocalId(), question: q.question.trim() }));

      const { data, error: insertError } = await supabase
        .from("items")
        .insert({
          poster_id: profile.id,
          title: title.trim(),
          category,
          description: description.trim() || null,
          location_found: locationFound.trim(),
          hotspot_id: hotspotId,
          image_url: imageUrl,
          status: "unclaimed",
          custom_questions: customQuestions,
        } as never)
        .select("id")
        .single();

      if (insertError) throw insertError;
      if (!data) throw new Error("No item returned after insert.");

      const inserted = data as { id: string };
      // Use push so the stack keeps a parent screen; replace after post often left
      // nothing to go back to (GO_BACK / development warning).
      router.replace(`/item/${inserted.id}?from=post`);
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        showDatabaseNotConnectedPopup();
      }
      const message =
        err !== null &&
        typeof err === "object" &&
        "message" in err &&
        typeof (err as { message: unknown }).message === "string"
          ? (err as { message: string }).message
          : err instanceof Error
            ? err.message
            : "Unable to save. Check your connection and Supabase env.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [
    profile,
    title,
    category,
    description,
    locationFound,
    hotspotId,
    imageUri,
    questions,
    router,
  ]);

  const selectedHotspot = hotspots.find((h) => h.id === hotspotId) ?? null;

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
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.screenTitle, { color: colors.text }]}>
            Post a Found Item
          </Text>

          {/* Image picker */}
          <SectionLabel label="Photo (optional)" colors={colors} />
          <TouchableOpacity
            style={styles.imagePickerOuter}
            onPress={pickImage}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.imagePreviewFrame,
                { backgroundColor: colors.backgroundElement },
              ]}
            >
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={styles.imagePreview}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.imagePlaceholderContent}>
                  <Text
                    style={[
                      styles.imagePlaceholderText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Add a photo from camera or library
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.photoActionsRow}>
            <TouchableOpacity
              style={styles.photoActionButton}
              onPress={openCamera}
              activeOpacity={0.85}
            >
              <Text style={styles.photoActionText}>Take photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.photoActionButton}
              onPress={pickImage}
              activeOpacity={0.85}
            >
              <Text style={styles.photoActionText}>Choose from library</Text>
            </TouchableOpacity>
          </View>
          {imageUri && (
            <TouchableOpacity
              onPress={() => {
                pickedImageMimeRef.current = undefined;
                setImageUri(null);
              }}
            >
              <Text style={styles.removePhotoText}>Remove photo</Text>
            </TouchableOpacity>
          )}

          {/* Title */}
          <SectionLabel label="Title *" colors={colors} />
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.backgroundElement, color: colors.text },
            ]}
            placeholder="e.g. Blue backpack"
            placeholderTextColor={colors.textSecondary}
            value={title}
            onChangeText={setTitle}
            returnKeyType="next"
          />

          {/* Category */}
          <SectionLabel label="Category *" colors={colors} />
          <TouchableOpacity
            style={[
              styles.pickerButton,
              { backgroundColor: colors.backgroundElement },
            ]}
            onPress={() => setCategoryModalVisible(true)}
          >
            <Text style={[styles.pickerButtonText, { color: colors.text }]}>
              {CATEGORY_LABELS[category]}
            </Text>
            <Text
              style={[styles.pickerChevron, { color: colors.textSecondary }]}
            >
              ▾
            </Text>
          </TouchableOpacity>

          {/* Description */}
          <SectionLabel label="Description" colors={colors} />
          <TextInput
            style={[
              styles.input,
              styles.multilineInput,
              { backgroundColor: colors.backgroundElement, color: colors.text },
            ]}
            placeholder="Describe the item in detail..."
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Location Found */}
          <SectionLabel label="Location Found *" colors={colors} />
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.backgroundElement, color: colors.text },
            ]}
            placeholder="e.g. Stauffer Library, 2nd floor"
            placeholderTextColor={colors.textSecondary}
            value={locationFound}
            onChangeText={setLocationFound}
            returnKeyType="next"
          />

          {/* Hotspot */}
          <SectionLabel label="Drop-off Hotspot (optional)" colors={colors} />
          <TouchableOpacity
            style={[
              styles.pickerButton,
              { backgroundColor: colors.backgroundElement },
            ]}
            onPress={() => setHotspotModalVisible(true)}
          >
            <Text style={[styles.pickerButtonText, { color: colors.text }]}>
              {selectedHotspot ? selectedHotspot.name : "None selected"}
            </Text>
            <Text
              style={[styles.pickerChevron, { color: colors.textSecondary }]}
            >
              ▾
            </Text>
          </TouchableOpacity>

          {/* Custom Questions */}
          <SectionLabel label="Verification Questions" colors={colors} />
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            Claimants must answer these to prove ownership.
          </Text>
          {questions.map((q, idx) => (
            <View key={q.localId} style={styles.questionRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.questionInput,
                  {
                    backgroundColor: colors.backgroundElement,
                    color: colors.text,
                  },
                ]}
                placeholder={`Question ${idx + 1}`}
                placeholderTextColor={colors.textSecondary}
                value={q.question}
                onChangeText={(text) => updateQuestion(q.localId, text)}
                returnKeyType="next"
              />
              {questions.length > 1 && (
                <TouchableOpacity
                  style={styles.removeQuestionButton}
                  onPress={() => removeQuestion(q.localId)}
                >
                  <Text style={styles.removeQuestionText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {questions.length < 5 && (
            <TouchableOpacity
              style={[styles.addQuestionButton, { borderColor: "#1877F2" }]}
              onPress={addQuestion}
            >
              <Text style={styles.addQuestionText}>+ Add Question</Text>
            </TouchableOpacity>
          )}

          {/* Error */}
          {error !== null && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              submitting && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Post Item</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Category Modal */}
      <Modal
        visible={categoryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setCategoryModalVisible(false)}
        >
          <View
            style={[styles.modalSheet, { backgroundColor: colors.background }]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Select Category
            </Text>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.modalOption,
                  category === cat && {
                    backgroundColor: colors.backgroundSelected,
                  },
                ]}
                onPress={() => {
                  setCategory(cat);
                  setCategoryModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    { color: category === cat ? "#1877F2" : colors.text },
                  ]}
                >
                  {CATEGORY_LABELS[cat]}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setCategoryModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Hotspot Modal */}
      <Modal
        visible={hotspotModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHotspotModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setHotspotModalVisible(false)}
        >
          <View
            style={[styles.modalSheet, { backgroundColor: colors.background }]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Select Hotspot
            </Text>
            <TouchableOpacity
              style={[
                styles.modalOption,
                hotspotId === null && {
                  backgroundColor: colors.backgroundSelected,
                },
              ]}
              onPress={() => {
                setHotspotId(null);
                setHotspotModalVisible(false);
              }}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  { color: hotspotId === null ? "#1877F2" : colors.text },
                ]}
              >
                None
              </Text>
            </TouchableOpacity>
            {hotspots.map((h) => (
              <TouchableOpacity
                key={h.id}
                style={[
                  styles.modalOption,
                  hotspotId === h.id && {
                    backgroundColor: colors.backgroundSelected,
                  },
                ]}
                onPress={() => {
                  setHotspotId(h.id);
                  setHotspotModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    { color: hotspotId === h.id ? "#1877F2" : colors.text },
                  ]}
                >
                  {h.name}
                </Text>
                {h.address ? (
                  <Text
                    style={[
                      styles.modalOptionSub,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {h.address}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setHotspotModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={cameraVisible}
        animationType="slide"
        onRequestClose={() => setCameraVisible(false)}
      >
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back">
            <View style={styles.cameraOverlay}>
              <View
                style={[
                  styles.cameraTopBar,
                  { paddingTop: Spacing.three + insets.top },
                ]}
              >
                <Text style={styles.cameraLabel}>Take Item Photo</Text>
              </View>
              <View style={styles.cameraSpacer} />
              <View
                style={[
                  styles.cameraBottomBar,
                  { paddingBottom: Spacing.four + insets.bottom },
                ]}
              >
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={takePhoto}
                  activeOpacity={0.8}
                >
                  <View style={styles.captureButtonInner} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cameraCancelButton}
                  onPress={() => setCameraVisible(false)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.cameraCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </CameraView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Small helper component to keep label styling consistent
function SectionLabel({
  label,
  colors,
}: {
  label: string;
  colors: { textSecondary: string };
}) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    paddingTop: Spacing.three,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.four,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  sectionHint: {
    fontSize: 12,
    marginBottom: Spacing.two,
    lineHeight: 17,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: Spacing.two + Spacing.one,
  },
  /** Centered square preview so photos are not stretched wide/short */
  imagePickerOuter: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  imagePreviewFrame: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 0,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholderContent: {
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.two,
  },
  imagePlaceholderText: {
    fontSize: 14,
    fontWeight: "500",
  },
  removePhotoText: {
    color: "#65676B",
    fontSize: 13,
    fontWeight: "600",
    marginTop: Spacing.one,
    textAlign: "center",
  },
  photoActionsRow: {
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  photoActionButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1877F2",
    paddingVertical: Spacing.two,
    alignItems: "center",
  },
  photoActionText: {
    color: "#1877F2",
    fontSize: 13,
    fontWeight: "600",
  },
  pickerButton: {
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerButtonText: {
    fontSize: 15,
  },
  pickerChevron: {
    fontSize: 16,
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.two,
    gap: Spacing.two,
  },
  questionInput: {
    flex: 1,
  },
  removeQuestionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#65676B",
    justifyContent: "center",
    alignItems: "center",
  },
  removeQuestionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  addQuestionButton: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: Spacing.two + Spacing.one,
    alignItems: "center",
    marginTop: Spacing.one,
  },
  addQuestionText: {
    color: "#1877F2",
    fontSize: 14,
    fontWeight: "600",
  },
  errorContainer: {
    backgroundColor: "#E4E6EB",
    borderRadius: 8,
    padding: Spacing.three,
    marginTop: Spacing.three,
  },
  errorText: {
    color: "#65676B",
    fontSize: 13,
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: "#1877F2",
    borderRadius: 12,
    paddingVertical: Spacing.three,
    alignItems: "center",
    marginTop: Spacing.four,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    paddingHorizontal: Spacing.three,
    maxHeight: "70%",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: Spacing.two,
    textAlign: "center",
  },
  modalOption: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: 8,
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: "500",
  },
  modalOptionSub: {
    fontSize: 12,
    marginTop: 2,
  },
  modalCancelButton: {
    marginTop: Spacing.three,
    alignItems: "center",
    paddingVertical: Spacing.two,
  },
  modalCancelText: {
    color: "#65676B",
    fontSize: 15,
    fontWeight: "600",
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
  },
  cameraTopBar: {
    alignItems: "center",
    paddingHorizontal: Spacing.four,
  },
  cameraSpacer: {
    flex: 1,
  },
  cameraBottomBar: {
    alignItems: "center",
    paddingTop: Spacing.two,
  },
  cameraLabel: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 10,
    overflow: "hidden",
  },
  captureButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.three,
  },
  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
  },
  cameraCancelButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  cameraCancelText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
