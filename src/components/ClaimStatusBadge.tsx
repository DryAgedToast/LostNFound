import type { ClaimStatus } from "@/types";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface ClaimStatusBadgeProps {
  status: ClaimStatus;
}

const STATUS_CONFIG: Record<ClaimStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#1877F2" },
  approved: { label: "Approved", color: "#42B72A" },
  rejected: { label: "Rejected", color: "#65676B" },
  awaiting_in_person: { label: "In-Person Required", color: "#1877F2" },
  withdrawn: { label: "Withdrawn", color: "#65676B" },
};

export default function ClaimStatusBadge({ status }: ClaimStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.color }]}>
      <Text style={styles.label}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  label: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
});
