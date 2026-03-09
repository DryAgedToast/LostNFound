import type { ClaimStatus } from "@/types";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface ClaimStatusBadgeProps {
  status: ClaimStatus;
}

const STATUS_CONFIG: Record<ClaimStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#EAB308" },
  approved: { label: "Approved", color: "#10B981" },
  rejected: { label: "Rejected", color: "#EF4444" },
  awaiting_in_person: { label: "In-Person Required", color: "#F59E0B" },
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
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
});
