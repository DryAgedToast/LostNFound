import type { MessageWithSender } from "@/types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

const activeChannels: Map<string, RealtimeChannel> = new Map();

/**
 * Subscribe to new messages for a claim.
 * Callback is called with each new message as it arrives.
 */
export function subscribeToMessages(
  claimId: string,
  callback: (message: MessageWithSender) => void,
): void {
  // Clean up any existing subscription for this claim
  unsubscribeFromClaim(claimId);

  try {
    const channel = supabase
      .channel(`messages:claim_id=eq.${claimId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `claim_id=eq.${claimId}`,
        },
        async (payload) => {
          try {
            const { data } = await supabase
              .from("messages")
              .select("*, profiles(*)")
              .eq("id", payload.new.id)
              .single();

            if (data) {
              callback(data as unknown as MessageWithSender);
            }
          } catch {
            // Keep UI stable when realtime/network is unavailable.
          }
        },
      )
      .subscribe();

    activeChannels.set(claimId, channel);
  } catch {
    // No-op in offline mode.
  }
}

/**
 * Unsubscribe from messages for a specific claim.
 */
export function unsubscribeFromClaim(claimId: string): void {
  const channel = activeChannels.get(claimId);
  if (channel) {
    try {
      supabase.removeChannel(channel);
    } catch {
      // No-op in offline mode.
    }
    activeChannels.delete(claimId);
  }
}

/**
 * Unsubscribe from all active realtime channels.
 * Call this on component unmount to prevent memory leaks.
 */
export function unsubscribeAll(): void {
  for (const [claimId, channel] of activeChannels.entries()) {
    try {
      supabase.removeChannel(channel);
    } catch {
      // No-op in offline mode.
    }
    activeChannels.delete(claimId);
  }
}
