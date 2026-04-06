import { Colors, Spacing } from "@/constants/theme";
import { getCurrentProfile } from "@/lib/auth";
import {
  isDatabaseUnavailableError,
  showDatabaseNotConnectedPopup,
} from "@/lib/db-alert";
import { supabase } from "@/lib/supabase";
import type { CustomQuestion, Hotspot, ItemCategory, Profile } from "@/types";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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

export default function PostScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];
  const router = useRouter();

  // Auth / profile state
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Form state
  const [imageUri, setImageUri] = useState<string | null>(null);
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
      setImageUri(result.assets[0].uri);
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
  ): Promise<string> => {
    try {
      const ext = uri.split(".").pop() ?? "jpg";
      const fileName = `${posterId}-${Date.now()}.${ext}`;

      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("item-images")
        .upload(fileName, arrayBuffer, {
          contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("item-images")
        .getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch {
      throw new Error("Unable to upload image.");
    }
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
        imageUrl = await uploadImage(imageUri, profile.user_id);
      }

      const customQuestions: CustomQuestion[] = questions
        .filter((q) => q.question.trim() !== "")
        .map((q) => ({ id: generateLocalId(), question: q.question.trim() }));

      const { data, error: insertError } = await supabase
        .from("items")
        .insert({
          poster_id: profile.user_id,
          title: title.trim(),
          category,
          description: description.trim() || null,
          location_found: locationFound.trim(),
          hotspot_id: hotspotId,
          image_url: imageUrl,
          status: "unclaimed",
          custom_questions: customQuestions,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      if (!data) throw new Error("No item returned after insert.");

      router.replace(`/item/${data.id}`);
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        showDatabaseNotConnectedPopup();
      }
      setError("Unable to save. Check your connection.");
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
            style={[
              styles.imagePicker,
              { backgroundColor: colors.backgroundElement },
            ]}
            onPress={pickImage}
            activeOpacity={0.8}
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
                  Tap to choose a photo
                </Text>
              </View>
            )}
          </TouchableOpacity>
          {imageUri && (
            <TouchableOpacity onPress={() => setImageUri(null)}>
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
  imagePicker: {
    width: "100%",
    height: 180,
    borderRadius: 12,
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
});
