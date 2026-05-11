import { supabase } from "@/lib/supabase";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Status = "checking" | "connected" | "disconnected";

export default function DbStatusBadge() {
  const [status, setStatus] = useState<Status>("checking");

  const check = useCallback(async () => {
    setStatus("checking");
    try {
      const { error } = await supabase
        .from("campus_codes")
        .select("id", { count: "exact", head: true });
      setStatus(error ? "disconnected" : "connected");
    } catch {
      setStatus("disconnected");
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  const dotColor =
    status === "connected" ? "#42B72A" : status === "disconnected" ? "#E53935" : "#FFA726";
  const label =
    status === "connected"
      ? "DB Connected"
      : status === "disconnected"
      ? "DB Unavailable — tap to retry"
      : "Checking DB…";

  return (
    <TouchableOpacity
      style={styles.badge}
      onPress={status === "disconnected" ? check : undefined}
      activeOpacity={status === "disconnected" ? 0.6 : 1}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.label, { color: dotColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 5,
    marginTop: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
  },
});
