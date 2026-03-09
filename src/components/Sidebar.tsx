import { Colors } from "@/constants/theme";
import { DEV_MODE } from "@/lib/auth";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface SidebarItemProps {
  icon: string;
  label: string;
  href: string;
  isActive: boolean;
  isPrimary?: boolean;
  onPress: () => void;
}

function SidebarItem({
  icon,
  label,
  href,
  isActive,
  isPrimary,
  onPress,
}: SidebarItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.sidebarItem,
        isActive && styles.sidebarItemActive,
        isPrimary && styles.sidebarItemPrimary,
      ]}
      activeOpacity={0.7}
    >
      <Text
        style={[styles.sidebarIcon, isPrimary && styles.sidebarIconPrimary]}
      >
        {icon}
      </Text>
      <Text
        style={[
          styles.sidebarLabel,
          isActive && styles.sidebarLabelActive,
          isPrimary && styles.sidebarLabelPrimary,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const navigationItems = [
    { icon: "🏠", label: "Home", href: "/(tabs)" },
    { icon: "📥", label: "Inbox", href: "/(tabs)/messages" },
    { icon: "📍", label: "Hotspots", href: "/(tabs)/hotspots" },
    { icon: "👤", label: "Profile", href: "/(tabs)/profile" },
  ];

  const handleNavigation = (href: string) => {
    router.push(href as any);
  };

  const handleCreatePost = () => {
    router.push("/(tabs)/post" as any);
  };

  const handleLogin = () => {
    if (DEV_MODE) {
      alert(
        "Login is only available when database is connected. Currently in demo mode.",
      );
    } else {
      router.push("/auth/login" as any);
    }
  };

  return (
    <View style={styles.sidebar}>
      {/* Header */}
      <View style={styles.sidebarHeader}>
        <Text style={styles.sidebarTitle}>Lost & Found</Text>
        <Text style={styles.sidebarSubtitle}>Marketplace</Text>
      </View>

      {/* Create Post Button - Primary */}
      <SidebarItem
        icon="➕"
        label="Make a Post"
        href="/(tabs)/post"
        isActive={pathname === "/(tabs)/post"}
        isPrimary={true}
        onPress={handleCreatePost}
      />

      {/* Divider */}
      <View style={styles.divider} />

      {/* Navigation Items */}
      {navigationItems.map((item) => (
        <SidebarItem
          key={item.href}
          icon={item.icon}
          label={item.label}
          href={item.href}
          isActive={
            pathname === item.href ||
            (item.href === "/(tabs)" && pathname === "/(tabs)/index")
          }
          onPress={() => handleNavigation(item.href)}
        />
      ))}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Login Button (placeholder until DB connected) */}
      <TouchableOpacity
        onPress={handleLogin}
        style={styles.loginButton}
        activeOpacity={0.7}
      >
        <Text style={styles.loginIcon}>🔐</Text>
        <Text style={styles.loginLabel}>
          {DEV_MODE ? "Login (Demo Mode)" : "Login"}
        </Text>
      </TouchableOpacity>

      {/* Footer */}
      {DEV_MODE && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>Demo Mode Active</Text>
          <Text style={styles.footerSubtext}>
            Connect database to enable all features
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 280,
    height: "100%",
    backgroundColor: Colors.light.background,
    borderRightWidth: 1,
    borderRightColor: Colors.light.border,
    paddingVertical: 20,
    paddingHorizontal: 12,
    ...Platform.select({
      web: {
        position: "fixed" as any,
        left: 0,
        top: 0,
        bottom: 0,
        overflowY: "auto" as any,
      },
    }),
  },
  sidebarHeader: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    marginBottom: 8,
  },
  sidebarTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 2,
  },
  sidebarSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: "transparent",
    ...Platform.select({
      web: {
        cursor: "pointer" as any,
        transition: "background-color 0.2s ease" as any,
      },
    }),
  },
  sidebarItemActive: {
    backgroundColor: Colors.light.backgroundSelected,
  },
  sidebarItemPrimary: {
    backgroundColor: Colors.light.primary,
    marginBottom: 12,
  },
  sidebarIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  sidebarIconPrimary: {
    fontSize: 20,
  },
  sidebarLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.light.text,
  },
  sidebarLabelActive: {
    fontWeight: "600",
  },
  sidebarLabelPrimary: {
    color: "#ffffff",
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 12,
  },
  loginButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.light.backgroundElement,
    marginTop: 8,
    ...Platform.select({
      web: {
        cursor: "pointer" as any,
        transition: "background-color 0.2s ease" as any,
      },
    }),
  },
  loginIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  loginLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.light.text,
  },
  footer: {
    marginTop: "auto" as any,
    paddingTop: 16,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.primary,
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
});
