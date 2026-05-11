import ClaimStatusBadge from "@/components/ClaimStatusBadge";
import MessageBubble from "@/components/MessageBubble";
import { Colors, Spacing } from "@/constants/theme";
import { getCurrentProfile } from "@/lib/auth";
import {
  isDatabaseUnavailableError,
  showDatabaseNotConnectedPopup,
} from "@/lib/db-alert";
import { supabase } from "@/lib/supabase";
import type { Claim, Hotspot, Item, MessageWithSender, Profile } from "@/types";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ClaimThread extends Claim {
  items: Item & {
    hotspots: Pick<Hotspot, "name"> | null;
    profiles: Profile;
  };
  profiles: Profile;
}

interface MessageRead {
  id?: string;
  message_id: string;
  claim_id: string;
  reader_profile_id: string;
  read_at: string;
}

interface ClaimChatHide {
  id?: string;
  claim_id: string;
  profile_id: string;
  hidden_at: string;
}

interface ThreadSummary {
  claim: ClaimThread;
  latestMessage: MessageWithSender | null;
  latestAt: string;
  unread: boolean;
  isManagedByMe: boolean;
}

type GroupKey = "claiming" | "postedOrManaged";
type InboxView = "active" | "archived";

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

function previewFor(message: MessageWithSender | null): string {
  if (!message) return "No messages yet";
  return message.content.replace(/\s+/g, " ").trim();
}

export default function MessagesScreen() {
  const { claimId } = useLocalSearchParams<{ claimId?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const scrollViewRef = useRef<ScrollView>(null);

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [messagesByClaim, setMessagesByClaim] = useState<
    Record<string, MessageWithSender[]>
  >({});
  const [reads, setReads] = useState<MessageRead[]>([]);
  const [chatHides, setChatHides] = useState<ClaimChatHide[]>([]);
  const [managerIdsByHotspot, setManagerIdsByHotspot] = useState<
    Record<string, string[]>
  >({});
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(
    claimId ?? null,
  );
  const [selectedInboxView, setSelectedInboxView] =
    useState<InboxView>("active");
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [resolvingAction, setResolvingAction] = useState<
    "pending" | "picked_up" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.claim.id === selectedClaimId) ?? null,
    [selectedClaimId, threads],
  );

  const selectedMessages = selectedClaimId
    ? messagesByClaim[selectedClaimId] ?? []
    : [];

  const selectedItemIsAtHotspot =
    selectedThread?.claim.items.hotspot_id !== null &&
    selectedThread?.claim.items.status === "at_hotspot";
  const canResolveSelected =
    currentProfile != null &&
    selectedThread != null &&
    selectedThread.claim.items.deleted_at === null &&
    selectedThread.claim.claimant_id !== currentProfile.id &&
    (
      (selectedThread.claim.items.poster_id === currentProfile.id && !selectedItemIsAtHotspot) ||
      selectedThread.isManagedByMe
    );

  const canMarkPendingPickup =
    canResolveSelected &&
    selectedThread?.claim.status === "pending" &&
    selectedThread?.claim.items.status !== "pending" &&
    selectedThread?.claim.items.status !== "claimed";

  const canMarkPickedUp =
    canResolveSelected &&
    selectedThread?.claim.items.status !== "claimed" &&
    selectedThread?.claim.status === "awaiting_in_person";

  const canRevertToUnclaimed =
    canResolveSelected &&
    selectedThread?.claim.status === "awaiting_in_person" &&
    selectedThread?.claim.items.status === "pending";

  const canWithdrawClaim =
    currentProfile != null &&
    selectedThread != null &&
    selectedThread.claim.claimant_id === currentProfile.id &&
    selectedThread.claim.status === "pending";

  const fetchThreads = useCallback(async () => {
    setError(null);
    try {
      const profile = await getCurrentProfile();
      if (!profile) throw new Error("Not authenticated");
      setCurrentProfile(profile);

      const { data: managedRows, error: managedError } = await supabase
        .from("hotspot_managers")
        .select("hotspot_id, profile_id")
        .eq("profile_id", profile.id);
      if (managedError) throw managedError;

      const managedHotspotIds = (
        (managedRows ?? []) as { hotspot_id: string; profile_id: string }[]
      ).map((row) => row.hotspot_id);

      const { data: postedItems, error: postedItemsError } = await supabase
        .from("items")
        .select("id")
        .eq("poster_id", profile.id);
      if (postedItemsError) throw postedItemsError;
      const postedItemIds = ((postedItems ?? []) as { id: string }[]).map(
        (row) => row.id,
      );

      const selects =
        "*, items!inner(*, hotspots(name), profiles!poster_id(*)), profiles!claimant_id(*)";
      const claimQueries = [
        supabase
          .from("claims")
          .select(selects)
          .eq("claimant_id", profile.id),
      ];

      if (postedItemIds.length > 0) {
        claimQueries.push(
          supabase.from("claims").select(selects).in("item_id", postedItemIds),
        );
      }
      if (managedHotspotIds.length > 0) {
        const { data: managedItemRows, error: managedItemsError } = await supabase
          .from("items")
          .select("id")
          .in("hotspot_id", managedHotspotIds)
          .is("deleted_at", null);
        if (managedItemsError) throw managedItemsError;
        const managedItemIds = ((managedItemRows ?? []) as { id: string }[]).map((r) => r.id);
        if (managedItemIds.length > 0) {
          claimQueries.push(
            supabase.from("claims").select(selects).in("item_id", managedItemIds),
          );
        }
      }

      const claimResults = await Promise.all(claimQueries);
      const byId = new Map<string, ClaimThread>();
      for (const result of claimResults) {
        if (result.error) throw result.error;
        ((result.data ?? []) as unknown as ClaimThread[]).forEach((thread) => {
          byId.set(thread.id, thread);
        });
      }

      const allClaims = [...byId.values()];
      const claimIds = allClaims.map((thread) => thread.id);
      const threadHotspotIds = [
        ...new Set(
          allClaims
            .map((thread) => thread.items.hotspot_id)
            .filter((id): id is string => id != null),
        ),
      ];

      let managerMap: Record<string, string[]> = {};
      if (threadHotspotIds.length > 0) {
        const { data: managerRows } = await supabase
          .from("hotspot_managers")
          .select("hotspot_id, profile_id")
          .in("hotspot_id", threadHotspotIds);

        for (const row of (managerRows ?? []) as {
          hotspot_id: string;
          profile_id: string;
        }[]) {
          managerMap[row.hotspot_id] = [
            ...(managerMap[row.hotspot_id] ?? []),
            row.profile_id,
          ];
        }
      }
      setManagerIdsByHotspot(managerMap);

      let messages: MessageWithSender[] = [];
      if (claimIds.length > 0) {
        const { data: messageRows, error: messageError } = await supabase
          .from("messages")
          .select("*, profiles!sender_id(*)")
          .in("claim_id", claimIds)
          .order("created_at", { ascending: true });
        if (messageError) throw messageError;
        messages = (messageRows ?? []) as unknown as MessageWithSender[];
      }

      const nextMessagesByClaim: Record<string, MessageWithSender[]> = {};
      for (const message of messages) {
        nextMessagesByClaim[message.claim_id] = [
          ...(nextMessagesByClaim[message.claim_id] ?? []),
          message,
        ];
      }
      setMessagesByClaim(nextMessagesByClaim);

      let readRows: MessageRead[] = [];
      let hideRows: ClaimChatHide[] = [];
      if (claimIds.length > 0) {
        const [
          { data: readData, error: readError },
          { data: hideData, error: hideError },
        ] = await Promise.all([
          supabase.from("message_reads").select("*").in("claim_id", claimIds),
          supabase
            .from("claim_chat_hides")
            .select("*")
            .eq("profile_id", profile.id)
            .in("claim_id", claimIds),
        ]);
        if (!readError) {
          readRows = (readData ?? []) as MessageRead[];
        }
        if (!hideError) {
          hideRows = (hideData ?? []) as ClaimChatHide[];
        }
      }
      setReads(readRows);
      setChatHides(hideRows);

      if (claimId && claimIds.includes(claimId)) {
        const { error: unhideError } = await supabase
          .from("claim_chat_hides")
          .delete()
          .eq("claim_id", claimId)
          .eq("profile_id", profile.id);
        if (!unhideError) {
          hideRows = hideRows.filter((row) => row.claim_id !== claimId);
          setChatHides(hideRows);
        }
      }

      const nextThreads = allClaims
        .filter((thread) => {
          const hide = hideRows.find((row) => row.claim_id === thread.id);
          if (!hide) return true;

          // Always keep withdrawn claims — they must appear in Archived
          if (thread.status === "withdrawn") return true;

          const hiddenAt = new Date(hide.hidden_at).getTime();
          const hasNewOtherMessage = (
            nextMessagesByClaim[thread.id] ?? []
          ).some(
            (message) =>
              message.sender_id !== profile.id &&
              new Date(message.created_at).getTime() > hiddenAt,
          );

          return hasNewOtherMessage;
        })
        .map((thread): ThreadSummary => {
          const threadMessages = nextMessagesByClaim[thread.id] ?? [];
          const latestMessage = threadMessages[threadMessages.length - 1] ?? null;
          const hotspotId = thread.items.hotspot_id;
          const managerIds = hotspotId ? managerMap[hotspotId] ?? [] : [];
          const isManagedByMe = managerIds.includes(profile.id);
          const unread = threadMessages.some((message) => {
            if (message.sender_id === profile.id) return false;
            if (isManagedByMe && hotspotId) {
              return !readRows.some(
                (read) =>
                  read.message_id === message.id &&
                  managerIds.includes(read.reader_profile_id),
              );
            }
            return !readRows.some(
              (read) =>
                read.message_id === message.id &&
                read.reader_profile_id === profile.id,
            );
          });

          return {
            claim: thread,
            latestMessage,
            latestAt: latestMessage?.created_at ?? thread.created_at,
            unread,
            isManagedByMe,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime(),
        );

      setThreads(nextThreads);
      setSelectedClaimId((prev) => {
        if (claimId && nextThreads.some((thread) => thread.claim.id === claimId)) {
          return claimId;
        }
        if (prev && nextThreads.some((thread) => thread.claim.id === prev)) {
          return prev;
        }
        return isWide ? nextThreads[0]?.claim.id ?? null : null;
      });
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        showDatabaseNotConnectedPopup();
      }
      setError(err instanceof Error ? err.message : "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, [claimId, isWide]);

  const markSelectedRead = useCallback(async () => {
    if (!currentProfile || !selectedThread) return;
    const hotspotId = selectedThread.claim.items.hotspot_id;
    const managerIds = hotspotId ? managerIdsByHotspot[hotspotId] ?? [] : [];
    const readerIds =
      selectedThread.isManagedByMe && managerIds.length > 0
        ? managerIds
        : [currentProfile.id];

    const unreadMessages = selectedMessages.filter(
      (message) =>
        message.sender_id !== currentProfile.id &&
        !reads.some(
          (read) =>
            read.message_id === message.id &&
            readerIds.includes(read.reader_profile_id),
        ),
    );
    if (unreadMessages.length === 0) return;

    const now = new Date().toISOString();
    const rows = unreadMessages.flatMap((message) =>
      readerIds.map((readerId) => ({
        message_id: message.id,
        claim_id: message.claim_id,
        reader_profile_id: readerId,
        read_at: now,
      })),
    );

    const { error: readError } = await supabase
      .from("message_reads")
      .upsert(rows as never, {
        onConflict: "message_id,reader_profile_id",
        ignoreDuplicates: true,
      });
    if (readError) return;

    setReads((prev) => [...prev, ...(rows as MessageRead[])]);
    setThreads((prev) =>
      prev.map((thread) =>
        thread.claim.id === selectedThread.claim.id
          ? { ...thread, unread: false }
          : thread,
      ),
    );
  }, [
    currentProfile,
    managerIdsByHotspot,
    reads,
    selectedMessages,
    selectedThread,
  ]);

  useFocusEffect(
    useCallback(() => {
      fetchThreads();
    }, [fetchThreads]),
  );

  useFocusEffect(
    useCallback(() => {
      markSelectedRead();
    }, [markSelectedRead]),
  );

  useEffect(() => {
    markSelectedRead();
  }, [markSelectedRead]);

  const handleSelectThread = (id: string) => {
    setSelectedClaimId(id);
    setInputText("");
  };

  const handleOpenSelectedItem = () => {
    if (!selectedThread) return;
    router.push(`/item/${selectedThread.claim.item_id}`);
  };

  const confirmDeleteChat = (thread: ThreadSummary) => {
    if (Platform.OS === "web") {
      const ok = window.confirm(
        "Archive this chat?\n\nThis moves the chat to Archived for you. A new reply from the other person will bring it back to Active.",
      );
      if (ok) handleDeleteChat(thread);
      return;
    }
    Alert.alert(
      "Archive chat?",
      "This moves the chat to Archived for you. Previous messages come back to Active if someone else replies.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive Chat",
          style: "destructive",
          onPress: () => handleDeleteChat(thread),
        },
      ],
    );
  };

  const handleDeleteChat = async (thread: ThreadSummary) => {
    if (!currentProfile) return;

    const hiddenAt = new Date().toISOString();
    const { data: hideAction, error: hideError } = await supabase.rpc(
      "delete_or_hide_claim_chat" as never,
      { p_claim_id: thread.claim.id } as never,
    );

    if (hideError) {
      setError("Unable to delete chat. Check your connection.");
      return;
    }

    const row = {
      claim_id: thread.claim.id,
      profile_id: currentProfile.id,
      hidden_at: hiddenAt,
    };

    if (hideAction === "deleted") {
      setChatHides((prev) =>
        prev.filter((hide) => hide.claim_id !== thread.claim.id),
      );
      setThreads((prev) =>
        prev.filter((existing) => existing.claim.id !== thread.claim.id),
      );
    } else {
      setChatHides((prev) => [
        ...prev.filter((hide) => hide.claim_id !== thread.claim.id),
        row,
      ]);
    }

    if (selectedClaimId === thread.claim.id) {
      setSelectedClaimId(null);
      setInputText("");
    }
  };

  const confirmUnarchiveChat = async (thread: ThreadSummary) => {
    if (!currentProfile) return;

    const { error: unhideError } = await supabase
      .from("claim_chat_hides")
      .delete()
      .eq("claim_id", thread.claim.id)
      .eq("profile_id", currentProfile.id);

    if (unhideError) {
      setError("Unable to unarchive. Check your connection.");
      return;
    }

    // If this was a withdrawn claim being restored by the claimant, reactivate it
    if (
      thread.claim.status === "withdrawn" &&
      thread.claim.claimant_id === currentProfile.id
    ) {
      const { error: claimError } = await supabase
        .from("claims")
        .update({ status: "pending" } as never)
        .eq("id", thread.claim.id);
      if (claimError) {
        setError("Unable to reactivate claim. Check your connection.");
        return;
      }

      // Restore item status to unclaimed if it was reverted when claim was withdrawn
      const { data: activeItems } = await supabase
        .from("items")
        .select("status")
        .eq("id", thread.claim.item_id)
        .single();
      if ((activeItems as { status: string } | null)?.status === "unclaimed") {
        await supabase
          .from("items")
          .update({ status: "unclaimed" } as never)
          .eq("id", thread.claim.item_id);
      }

      await fetchThreads();
      return;
    }

    setChatHides((prev) =>
      prev.filter((h) => h.claim_id !== thread.claim.id),
    );
  };

  const handleSend = async () => {
    const content = inputText.trim();
    if (!content || !currentProfile || !selectedClaimId || sending) return;

    setSending(true);
    setInputText("");
    try {
      const { data, error: sendError } = await supabase
        .from("messages")
        .insert({
          claim_id: selectedClaimId,
          sender_id: currentProfile.id,
          content,
          message_type: "user",
        } as never)
        .select("*, profiles!sender_id(*)")
        .single();

      if (sendError) throw sendError;

      const message = data as unknown as MessageWithSender;
      setMessagesByClaim((prev) => ({
        ...prev,
        [selectedClaimId]: [...(prev[selectedClaimId] ?? []), message],
      }));
      setThreads((prev) =>
        prev
          .map((thread) =>
            thread.claim.id === selectedClaimId
              ? {
                  ...thread,
                  latestMessage: message,
                  latestAt: message.created_at,
                  unread: false,
                }
              : thread,
          )
          .sort(
            (a, b) =>
              new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime(),
          ),
      );
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        showDatabaseNotConnectedPopup();
      }
      setInputText(content);
      setError("Unable to send. Check your connection.");
    } finally {
      setSending(false);
    }
  };

  const insertSystemMessagesForItem = async (
    itemId: string,
    selectedThreadId: string,
    selectedMessage: string,
    otherMessage = selectedMessage,
  ) => {
    if (!currentProfile) return;

    const { data: claimRows, error: claimsError } = await supabase
      .from("claims")
      .select("id")
      .eq("item_id", itemId);

    if (claimsError) throw claimsError;

    const rows = ((claimRows ?? []) as { id: string }[]).map((claim) => ({
      claim_id: claim.id,
      sender_id: currentProfile.id,
      content: claim.id === selectedThreadId ? selectedMessage : otherMessage,
      message_type: "system",
    }));

    if (rows.length === 0) return;

    const { error: messageError } = await supabase
      .from("messages")
      .insert(rows as never);

    if (messageError) throw messageError;
  };

  const handleMarkPendingPickup = async () => {
    if (!selectedThread || !currentProfile || resolvingAction) return;

    setResolvingAction("pending");
    setError(null);
    try {
      const now = new Date().toISOString();
      const itemId = selectedThread.claim.item_id;

      const { error: claimError } = await supabase
        .from("claims")
        .update({
          status: "awaiting_in_person",
          reviewed_by: currentProfile.id,
          reviewed_at: now,
        } as never)
        .eq("id", selectedThread.claim.id);
      if (claimError) throw claimError;

      const { error: itemError } = await supabase
        .from("items")
        .update({ status: "pending" } as never)
        .eq("id", itemId);
      if (itemError) throw itemError;

      await insertSystemMessagesForItem(
        itemId,
        selectedThread.claim.id,
        "This item is pending pickup.",
        "This item is pending pickup with another claimant.",
      );

      await fetchThreads();
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        showDatabaseNotConnectedPopup();
      }
      setError(
        err instanceof Error
          ? err.message
          : "Unable to mark this item pending pickup.",
      );
    } finally {
      setResolvingAction(null);
    }
  };

  const handleMarkPickedUp = async () => {
    if (!selectedThread || !currentProfile || resolvingAction) return;

    setResolvingAction("picked_up");
    setError(null);
    try {
      const now = new Date().toISOString();
      const itemId = selectedThread.claim.item_id;

      const { error: selectedClaimError } = await supabase
        .from("claims")
        .update({
          status: "approved",
          reviewed_by: currentProfile.id,
          reviewed_at: now,
        } as never)
        .eq("id", selectedThread.claim.id);
      if (selectedClaimError) throw selectedClaimError;

      const { error: itemError } = await supabase
        .from("items")
        .update({ status: "claimed" } as never)
        .eq("id", itemId);
      if (itemError) throw itemError;

      const { error: rejectError } = await supabase
        .from("claims")
        .update({
          status: "rejected",
          reviewed_by: currentProfile.id,
          reviewed_at: now,
        } as never)
        .eq("item_id", itemId)
        .neq("id", selectedThread.claim.id)
        .in("status", ["pending", "awaiting_in_person"]);
      if (rejectError) throw rejectError;

      await insertSystemMessagesForItem(
        itemId,
        selectedThread.claim.id,
        "This item has been picked up.",
      );

      await fetchThreads();
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        showDatabaseNotConnectedPopup();
      }
      setError(
        err instanceof Error
          ? err.message
          : "Unable to mark this item picked up.",
      );
    } finally {
      setResolvingAction(null);
    }
  };

  const handleRevertToUnclaimed = async () => {
    if (!selectedThread || !currentProfile || resolvingAction) return;
    setResolvingAction("pending");
    setError(null);
    try {
      const itemId = selectedThread.claim.item_id;

      const { error: claimError } = await supabase
        .from("claims")
        .update({
          status: "pending",
          reviewed_by: null,
          reviewed_at: null,
        } as never)
        .eq("id", selectedThread.claim.id);
      if (claimError) throw claimError;

      const { error: restoreError } = await supabase
        .from("claims")
        .update({
          status: "pending",
          reviewed_by: null,
          reviewed_at: null,
        } as never)
        .eq("item_id", itemId)
        .neq("id", selectedThread.claim.id)
        .eq("status", "rejected");
      if (restoreError) throw restoreError;

      const { error: itemError } = await supabase
        .from("items")
        .update({ status: "unclaimed" } as never)
        .eq("id", itemId);
      if (itemError) throw itemError;

      await insertSystemMessagesForItem(
        itemId,
        selectedThread.claim.id,
        "The pending pickup has been cancelled. This item is now available again.",
      );

      await fetchThreads();
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        showDatabaseNotConnectedPopup();
      }
      setError(
        err instanceof Error ? err.message : "Unable to revert item status.",
      );
    } finally {
      setResolvingAction(null);
    }
  };

  const handleWithdrawClaim = async () => {
    if (!selectedThread || !currentProfile) return;

    const doWithdraw = async () => {
      try {
        const itemId = selectedThread.claim.item_id;
        const claimId = selectedThread.claim.id;

        // Insert system message before status change so it stays in the thread
        const { error: msgError } = await supabase
          .from("messages")
          .insert({
            claim_id: claimId,
            sender_id: currentProfile.id,
            content: "The claimant has withdrawn their claim.",
            message_type: "system",
          } as never);
        if (msgError) throw msgError;

        // Soft-close the claim so messages are preserved
        const { error: claimError } = await supabase
          .from("claims")
          .update({ status: "withdrawn" } as never)
          .eq("id", claimId);
        if (claimError) throw claimError;

        // Restore item to unclaimed if no other active claims remain
        const { data: remainingClaims, error: remainingError } = await supabase
          .from("claims")
          .select("id")
          .eq("item_id", itemId)
          .in("status", ["pending", "awaiting_in_person", "approved"]);
        if (remainingError) throw remainingError;

        if ((remainingClaims ?? []).length === 0) {
          await supabase
            .from("items")
            .update({ status: "unclaimed" } as never)
            .eq("id", itemId);
        }

        // Auto-archive for the claimant so it moves to Archived tab immediately
        const hiddenAt = new Date().toISOString();
        const { error: hideError } = await supabase
          .from("claim_chat_hides")
          .upsert(
            { claim_id: claimId, profile_id: currentProfile.id, hidden_at: hiddenAt } as never,
            { onConflict: "claim_id,profile_id" },
          );
        if (hideError) throw hideError;

        setChatHides((prev) => [
          ...prev.filter((h) => h.claim_id !== claimId),
          { claim_id: claimId, profile_id: currentProfile.id, hidden_at: hiddenAt },
        ]);
        setSelectedInboxView("archived");
        await fetchThreads();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unable to withdraw claim.");
      }
    };

    if (Platform.OS === "web") {
      const ok = window.confirm(
        "Withdraw your claim?\n\nThe chat will be moved to Archived. You can restore it from there.",
      );
      if (ok) doWithdraw();
      return;
    }
    Alert.alert(
      "Withdraw claim?",
      "The chat will be moved to Archived. You can restore it from there.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Withdraw Claim", style: "destructive", onPress: doWithdraw },
      ],
    );
  };

  const groupedThreads = useMemo(() => {
    const claiming: ThreadSummary[] = [];
    const postedOrManaged = new Map<string, ThreadSummary>();

    for (const thread of threads) {
      const hide = chatHides.find((row) => row.claim_id === thread.claim.id);
      const hiddenAt = hide ? new Date(hide.hidden_at).getTime() : null;
      const hasNewOtherMessage =
        hiddenAt == null
          ? false
          : (messagesByClaim[thread.claim.id] ?? []).some(
              (message) =>
                message.sender_id !== currentProfile?.id &&
                new Date(message.created_at).getTime() > hiddenAt,
            );
      const isArchivedThread = (hide != null && !hasNewOtherMessage) || thread.claim.status === "withdrawn";

      if (
        (selectedInboxView === "active" && isArchivedThread) ||
        (selectedInboxView === "archived" && !isArchivedThread)
      ) {
        continue;
      }

      if (thread.claim.claimant_id === currentProfile?.id) {
        claiming.push(thread);
      }
      const itemIsAtHotspot =
        thread.claim.items.hotspot_id !== null &&
        thread.claim.items.status === "at_hotspot";
      const posterCanManage =
        thread.claim.items.poster_id === currentProfile?.id && !itemIsAtHotspot;
      if (posterCanManage || thread.isManagedByMe) {
        postedOrManaged.set(thread.claim.id, thread);
      }
    }

    return {
      claiming,
      postedOrManaged: [...postedOrManaged.values()],
    };
  }, [
    chatHides,
    currentProfile?.id,
    messagesByClaim,
    selectedInboxView,
    threads,
  ]);

  const styles = makeStyles(colors, isWide);

  const renderThreadRow = (thread: ThreadSummary, group: GroupKey) => {
    const selected = thread.claim.id === selectedClaimId;
    const itemIsAtHotspot =
      thread.claim.items.hotspot_id !== null &&
      thread.claim.items.status === "at_hotspot";
    const otherName =
      group === "claiming"
        ? thread.claim.items.profiles.display_name
        : itemIsAtHotspot
          ? null
          : thread.claim.profiles.display_name;
    return (
      <View
        key={`${group}-${thread.claim.id}`}
        style={[styles.threadRow, selected && styles.threadRowSelected]}
      >
        <TouchableOpacity
          style={styles.threadMain}
          onPress={() => handleSelectThread(thread.claim.id)}
          activeOpacity={0.75}
        >
          <View style={styles.threadRowTop}>
            <Text style={styles.threadTitle} numberOfLines={1}>
              {thread.claim.items.title}
            </Text>
            {thread.unread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.threadMeta} numberOfLines={1}>
            {otherName ? `${otherName}` : ""}
            {thread.claim.items.hotspots?.name
              ? `${otherName ? " · " : ""}${thread.claim.items.hotspots.name}`
              : ""}
          </Text>
          <View style={styles.threadPreviewRow}>
            <Text style={styles.threadPreview} numberOfLines={1}>
              {previewFor(thread.latestMessage)}
            </Text>
            <Text style={styles.threadTime}>{formatTime(thread.latestAt)}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.threadMenuButton}
          onPress={() =>
            selectedInboxView === "archived"
              ? confirmUnarchiveChat(thread)
              : confirmDeleteChat(thread)
          }
          activeOpacity={0.7}
        >
          <Text style={styles.threadMenuText}>
            {selectedInboxView === "archived" ? "↩" : "..."}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const sidebar = (
    <View style={styles.sidebar}>
      <Text style={styles.screenTitle}>Inbox</Text>
      <View style={styles.inboxSwitch}>
        <TouchableOpacity
          style={[
            styles.inboxSwitchButton,
            selectedInboxView === "active" && styles.inboxSwitchButtonActive,
          ]}
          onPress={() => setSelectedInboxView("active")}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.inboxSwitchText,
              {
                color:
                  selectedInboxView === "active"
                    ? "#FFFFFF"
                    : colors.textSecondary,
              },
            ]}
          >
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.inboxSwitchButton,
            selectedInboxView === "archived" && styles.inboxSwitchButtonActive,
          ]}
          onPress={() => setSelectedInboxView("archived")}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.inboxSwitchText,
              {
                color:
                  selectedInboxView === "archived"
                    ? "#FFFFFF"
                    : colors.textSecondary,
              },
            ]}
          >
            Archived
          </Text>
        </TouchableOpacity>
      </View>
      {error !== null && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.sectionHeader}>Items I am claiming</Text>
      {groupedThreads.claiming.length === 0 ? (
        <Text style={styles.emptyText}>No claim chats yet</Text>
      ) : (
        groupedThreads.claiming.map((thread) =>
          renderThreadRow(thread, "claiming"),
        )
      )}

      <Text style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
        Items I posted or manage
      </Text>
      {groupedThreads.postedOrManaged.length === 0 ? (
        <Text style={styles.emptyText}>No posted or managed chats yet</Text>
      ) : (
        groupedThreads.postedOrManaged.map((thread) =>
          renderThreadRow(thread, "postedOrManaged"),
        )
      )}
    </View>
  );

  const chatPane = (
    <KeyboardAvoidingView
      style={styles.chatPane}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      {selectedThread ? (
        <>
          {!isWide && (
            <TouchableOpacity
              style={styles.mobileBackButton}
              onPress={() => setSelectedClaimId(null)}
            >
              <Text style={styles.mobileBackText}>‹ Inbox</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.chatHeader}
            onPress={selectedThread.claim.items.deleted_at ? undefined : handleOpenSelectedItem}
            activeOpacity={selectedThread.claim.items.deleted_at ? 1 : 0.75}
          >
            <View style={styles.chatHeaderText}>
              <Text style={styles.chatTitle} numberOfLines={1}>
                {selectedThread.claim.items.title}
              </Text>
              <Text style={styles.chatSubtitle} numberOfLines={1}>
                {selectedThread.claim.items.deleted_at
                  ? "Post deleted — no longer available"
                  : selectedThread.claim.items.hotspots?.name ?? "Direct item claim"}
              </Text>
            </View>
            <ClaimStatusBadge status={selectedThread.claim.status} />
          </TouchableOpacity>

          {(canResolveSelected && (canMarkPendingPickup || canMarkPickedUp || canRevertToUnclaimed) || canWithdrawClaim) && (
            <View style={styles.resolutionBar}>
              {canMarkPendingPickup && (
                <TouchableOpacity
                  style={[
                    styles.resolutionButton,
                    styles.pendingButton,
                    resolvingAction != null && styles.buttonDisabled,
                  ]}
                  onPress={handleMarkPendingPickup}
                  disabled={resolvingAction != null}
                >
                  <Text style={styles.resolutionButtonText}>
                    {resolvingAction === "pending"
                      ? "Marking..."
                      : "Mark Pending Pickup"}
                  </Text>
                </TouchableOpacity>
              )}
              {canRevertToUnclaimed && (
                <TouchableOpacity
                  style={[
                    styles.resolutionButton,
                    styles.revertButton,
                    resolvingAction != null && styles.buttonDisabled,
                  ]}
                  onPress={handleRevertToUnclaimed}
                  disabled={resolvingAction != null}
                >
                  <Text style={styles.resolutionButtonText}>
                    {resolvingAction === "pending"
                      ? "Reverting..."
                      : "Revert to Unclaimed"}
                  </Text>
                </TouchableOpacity>
              )}
              {canMarkPickedUp && (
                <TouchableOpacity
                  style={[
                    styles.resolutionButton,
                    styles.claimedButton,
                    resolvingAction != null && styles.buttonDisabled,
                  ]}
                  onPress={handleMarkPickedUp}
                  disabled={resolvingAction != null}
                >
                  <Text style={styles.resolutionButtonText}>
                    {resolvingAction === "picked_up"
                      ? "Marking..."
                      : "Mark Picked Up"}
                  </Text>
                </TouchableOpacity>
              )}
              {canWithdrawClaim && (
                <TouchableOpacity
                  style={[styles.resolutionButton, styles.withdrawButton]}
                  onPress={handleWithdrawClaim}
                >
                  <Text style={styles.resolutionButtonText}>Withdraw Claim</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <ScrollView
            ref={scrollViewRef}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              scrollViewRef.current?.scrollToEnd({ animated: false })
            }
          >
            {selectedMessages.length === 0 ? (
              <Text style={styles.emptyChatText}>No messages yet</Text>
            ) : (
              selectedMessages.map((message) => {
                const isOwn = message.sender_id === currentProfile?.id;
                return (
                  <MessageBubble
                    key={message.id}
                    content={message.content}
                    isOwn={isOwn}
                    timestamp={message.created_at}
                    senderName={message.profiles?.display_name}
                    avatarUrl={message.profiles?.avatar_url ?? undefined}
                    messageType={message.message_type ?? "user"}
                  />
                );
              })
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor={colors.placeholder}
              value={inputText}
              onChangeText={setInputText}
              multiline
              editable={!sending}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || sending) && styles.buttonDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.sendButtonText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.emptyChatPane}>
          <Text style={styles.emptyChatText}>
            Select a chat to see messages
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1877F2" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layout}>
        {(isWide || selectedClaimId == null) && sidebar}
        {(isWide || selectedClaimId != null) && chatPane}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: typeof Colors.light, isWide: boolean) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    layout: {
      flex: 1,
      flexDirection: isWide ? "row" : "column",
    },
    sidebar: {
      width: isWide ? 340 : "100%",
      borderRightWidth: isWide ? StyleSheet.hairlineWidth : 0,
      borderRightColor: colors.border,
      padding: Spacing.three,
      backgroundColor: colors.background,
    },
    screenTitle: {
      fontSize: 26,
      fontWeight: "700",
      color: colors.text,
      marginBottom: Spacing.two,
    },
    inboxSwitch: {
      flexDirection: "row",
      backgroundColor: colors.backgroundSelected,
      borderRadius: 10,
      padding: 3,
      marginBottom: Spacing.three,
    },
    inboxSwitchButton: {
      flex: 1,
      borderRadius: 8,
      paddingVertical: Spacing.one + 2,
      alignItems: "center",
    },
    inboxSwitchButtonActive: {
      backgroundColor: "#1877F2",
    },
    inboxSwitchText: {
      fontSize: 13,
      fontWeight: "700",
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
    sectionHeader: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: Spacing.two,
    },
    sectionHeaderSpaced: {
      marginTop: Spacing.four,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontStyle: "italic",
      marginBottom: Spacing.two,
    },
    threadRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.backgroundElement,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.two,
      overflow: "hidden",
    },
    threadRowSelected: {
      borderColor: "#1877F2",
      backgroundColor: "#EBF3FD",
    },
    threadRowTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.two,
    },
    threadMain: {
      flex: 1,
      padding: Spacing.three,
      gap: Spacing.one,
    },
    threadMenuButton: {
      alignSelf: "stretch",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: Spacing.three,
    },
    threadMenuText: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: "700",
      letterSpacing: 1,
    },
    threadTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    unreadDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: "#1877F2",
    },
    threadMeta: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    threadPreviewRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.two,
    },
    threadPreview: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 13,
    },
    threadTime: {
      color: colors.placeholder,
      fontSize: 11,
    },
    chatPane: {
      flex: 1,
      backgroundColor: colors.background,
    },
    mobileBackButton: {
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.two,
    },
    mobileBackText: {
      color: "#1877F2",
      fontSize: 15,
      fontWeight: "600",
    },
    chatHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Spacing.three,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.backgroundElement,
    },
    chatHeaderText: {
      flex: 1,
    },
    chatTitle: {
      color: "#1877F2",
      fontSize: 17,
      fontWeight: "700",
    },
    chatSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    resolutionBar: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.two,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    resolutionButton: {
      borderRadius: 8,
      paddingHorizontal: Spacing.three,
      paddingVertical: 10,
    },
    pendingButton: {
      backgroundColor: "#65676B",
    },
    revertButton: {
      backgroundColor: "#F0A500",
    },
    withdrawButton: {
      backgroundColor: "#E02020",
    },
    claimedButton: {
      backgroundColor: "#42B72A",
    },
    resolutionButtonText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },
    messageList: {
      flex: 1,
    },
    messageListContent: {
      paddingVertical: Spacing.three,
    },
    emptyChatPane: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: Spacing.four,
    },
    emptyChatText: {
      color: colors.textSecondary,
      fontSize: 15,
      textAlign: "center",
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: Spacing.two,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      padding: Spacing.three,
      backgroundColor: colors.backgroundElement,
    },
    textInput: {
      flex: 1,
      minHeight: 42,
      maxHeight: 120,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      color: colors.text,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      fontSize: 15,
    },
    sendButton: {
      backgroundColor: "#1877F2",
      borderRadius: 10,
      paddingHorizontal: Spacing.three,
      paddingVertical: 11,
    },
    sendButtonText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "700",
    },
    buttonDisabled: {
      opacity: 0.5,
    },
  });
}
