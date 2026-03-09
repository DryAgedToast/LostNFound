import ClaimStatusBadge from "@/components/ClaimStatusBadge";
import MessageBubble from "@/components/MessageBubble";
import { Colors, Spacing } from "@/constants/theme";
import { subscribeToMessages, unsubscribeFromClaim } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import type { Claim, ClaimStatus, MessageWithSender, Profile } from "@/types";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

// Shape returned by the joined claim query
interface ClaimWithItem extends Claim {
  items: {
    title: string;
    status: string;
  };
}

export default function MessageScreen() {
  const { claimId } = useLocalSearchParams<{ claimId: string }>();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [claim, setClaim] = useState<ClaimWithItem | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  // ── Initial data load ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!claimId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Current user profile
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("Not authenticated.");

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", authData.user.id)
        .single();

      if (profileError) throw profileError;
      setCurrentProfile(profileData as Profile);

      // 2. Claim with item info
      const { data: claimData, error: claimError } = await supabase
        .from("claims")
        .select("*, items!item_id(title, status)")
        .eq("id", claimId)
        .single();

      if (claimError) throw claimError;
      setClaim(claimData as unknown as ClaimWithItem);

      // 3. Existing messages ordered ascending
      const { data: msgData, error: msgError } = await supabase
        .from("messages")
        .select("*, profiles!sender_id(*)")
        .eq("claim_id", claimId)
        .order("created_at", { ascending: true });

      if (msgError) throw msgError;
      setMessages((msgData as unknown as MessageWithSender[]) ?? []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load messages.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!claimId) return;

    loadData();

    subscribeToMessages(claimId, (newMessage: MessageWithSender) => {
      setMessages((prev) => {
        // Avoid duplicates (in case the sender already appended optimistically)
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
    });

    return () => {
      unsubscribeFromClaim(claimId);
    };
  }, [claimId, loadData]);

  // ── Auto-scroll on new messages ────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = async () => {
    const content = inputText.trim();
    if (!content || !currentProfile || !claimId || sending) return;

    setSending(true);
    setInputText("");

    try {
      const { error: sendError } = await supabase.from("messages").insert({
        claim_id: claimId,
        sender_id: currentProfile.id,
        content,
      });

      if (sendError) throw sendError;
    } catch {
      // Restore the text so the user doesn't lose their message
      setInputText(content);
      setError("Unable to send. Check your connection.");
    } finally {
      setSending(false);
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const itemTitle = claim?.items?.title ?? "Claim";
  const claimStatus: ClaimStatus = claim?.status ?? "pending";

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color="#208AEF" />
      </SafeAreaView>
    );
  }

  return (
    <>
      {/* Dynamic header showing item title + status badge */}
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: () => (
            <View style={styles.headerTitle}>
              <Text
                style={[styles.headerItemTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                {itemTitle}
              </Text>
              <ClaimStatusBadge status={claimStatus} />
            </View>
          ),
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />

      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        {/* Messages list */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.flex}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: false })
          }
          keyboardShouldPersistTaps="handled"
        >
          {error != null && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {messages.length === 0 && !error && (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No messages yet
              </Text>
            </View>
          )}

          {messages.map((msg) => {
            const isOwn =
              currentProfile != null && msg.sender_id === currentProfile.id;
            const senderName = !isOwn ? msg.profiles?.display_name : undefined;
            return (
              <MessageBubble
                key={msg.id}
                content={msg.content}
                isOwn={isOwn}
                timestamp={msg.created_at}
                senderName={senderName}
              />
            );
          })}
        </ScrollView>

        {/* Input row */}
        <View
          style={[
            styles.inputRow,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.backgroundElement,
            },
          ]}
        >
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.backgroundElement,
                color: colors.text,
              },
            ]}
            placeholder="Type a message..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            returnKeyType="default"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  headerItemTitle: {
    fontSize: 15,
    fontWeight: "600",
    maxWidth: 200,
  },
  messagesContent: {
    paddingVertical: Spacing.three,
    paddingBottom: Spacing.two,
  },
  emptyContainer: {
    paddingTop: Spacing.six,
    alignItems: "center",
    paddingHorizontal: Spacing.five,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
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
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    gap: Spacing.two,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
    maxHeight: 120,
    lineHeight: 20,
  },
  sendButton: {
    backgroundColor: "#208AEF",
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 60,
    height: 40,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
});
