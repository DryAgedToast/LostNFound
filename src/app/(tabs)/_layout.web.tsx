import Sidebar from "@/components/Sidebar";
import { Colors } from "@/constants/theme";
import { Slot } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

/**
 * Web-specific layout with sidebar navigation (Facebook Marketplace style)
 */
export default function WebTabsLayout() {
  return (
    <View style={styles.container}>
      <Sidebar />
      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.light.background,
  },
  content: {
    flex: 1,
    marginLeft: Platform.OS === "web" ? 292 : 0, // Sidebar width
    backgroundColor: Colors.light.backgroundElement,
    ...Platform.select({
      web: {
        overflowY: "auto" as any,
      },
    }),
  },
});
