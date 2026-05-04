import { Colors, Spacing } from "@/constants/theme";
import type { Claim } from "@/types";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

interface ClaimReviewCardProps {
  claim: Claim;
  claimantName: string;
  itemTitle: string;
  onApprove: () => void;
  onReject: () => void;
  onApproveWithId: () => void;
  isLoading?: boolean;
}

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

export default function ClaimReviewCard({
  claim,
  claimantName,
  itemTitle,
  onApprove,
  onReject,
  onApproveWithId,
  isLoading = false,
}: ClaimReviewCardProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.backgroundElement,
          borderColor: colors.backgroundSelected,
        },
      ]}
    >
      {/* Header: claimant name + submitted time */}
      <View style={styles.header}>
        <Text style={[styles.claimantName, { color: colors.text }]}>
          {claimantName}
        </Text>
        <Text style={[styles.submittedTime, { color: colors.textSecondary }]}>
          {getRelativeTime(claim.created_at ?? new Date().toISOString())}
        </Text>
      </View>

      {/* Item title */}
      <Text style={[styles.itemTitle, { color: colors.textSecondary }]}>
        Re: {itemTitle}
      </Text>

      {/* Q&A section */}
      <View style={styles.qaSection}>
        {(claim.custom_answers ?? []).length === 0 ? (
          <Text style={[styles.noQa, { color: colors.textSecondary }]}>
            (No Q&amp;A)
          </Text>
        ) : (
          (claim.custom_answers ?? []).map((answer, index) => (
            <View key={`${answer.question_id}-${index}`} style={styles.qaRow}>
              <Text style={[styles.question, { color: colors.text }]}>
                {answer.question ?? "Question"}
              </Text>
              <Text style={[styles.answer, { color: colors.textSecondary }]}>
                {answer.answer ?? "No answer"}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Identity verified badge */}
      <View style={styles.badgeRow}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: claim.identity_verified
                ? "#E4E6EB"
                : colors.backgroundSelected,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                color: claim.identity_verified
                  ? "#1C1E21"
                  : colors.textSecondary,
              },
            ]}
          >
            {claim.identity_verified ? "ID Verified" : "Not Verified"}
          </Text>
        </View>
      </View>

      {/* Action buttons */}
      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#1877F2" />
        </View>
      ) : (
        <View style={styles.buttonRow}>
          {/* Reject */}
          <TouchableOpacity
            style={[
              styles.button,
              styles.rejectButton,
              { borderColor: "#65676B" },
            ]}
            onPress={onReject}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, { color: "#65676B" }]}>
              Reject
            </Text>
          </TouchableOpacity>

          {/* Approve */}
          <TouchableOpacity
            style={[
              styles.button,
              styles.approveButton,
              { backgroundColor: "#42B72A" },
            ]}
            onPress={onApprove}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, { color: "#FFFFFF" }]}>
              Approve
            </Text>
          </TouchableOpacity>

          {/* Approve with ID */}
          <TouchableOpacity
            style={[
              styles.button,
              styles.approveIdButton,
              { backgroundColor: "#1877F2" },
            ]}
            onPress={onApproveWithId}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, { color: "#FFFFFF" }]}>
              Approve{"\n"}with ID
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.one,
  },
  claimantName: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    marginRight: Spacing.two,
  },
  submittedTime: {
    fontSize: 12,
  },
  itemTitle: {
    fontSize: 13,
    marginBottom: Spacing.three,
  },
  qaSection: {
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  qaRow: {
    gap: Spacing.half,
  },
  question: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  answer: {
    fontSize: 13,
    lineHeight: 18,
  },
  noQa: {
    fontSize: 13,
    fontStyle: "italic",
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: Spacing.three,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  loadingRow: {
    alignItems: "center",
    paddingVertical: Spacing.three,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectButton: {
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  approveButton: {
    borderWidth: 0,
  },
  approveIdButton: {
    borderWidth: 0,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
