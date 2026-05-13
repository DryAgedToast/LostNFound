import { getCurrentProfile, signOut } from "@/lib/auth";
import { usePathname, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Profile } from "@/types";

const delawareLogo = require("./NEWUDLOGO.png");

const BRAND = {
  navy: "#002855",
  blue: "#005BBB",
  blueBright: "#0072CE",
  gold: "#FFD200",
  white: "#FFFFFF",
  mutedWhite: "rgba(255,255,255,0.72)",
  softBorder: "rgba(255,255,255,0.16)",
  activeBg: "rgba(255,255,255,0.14)",
  udBackground: "#02569e",
};

interface SidebarItemProps {
  icon: string;
  label: string;
  isActive: boolean;
  isPrimary?: boolean;
  badge?: string;
  onPress: () => void;
}

function SidebarItem({
  icon,
  label,
  isActive,
  isPrimary,
  badge,
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
      activeOpacity={0.78}
    >
      <Text style={[styles.sidebarIcon, isPrimary && styles.sidebarIconPrimary]}>
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

      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    getCurrentProfile().then(setProfile).catch(() => setProfile(null));
  }, [pathname]);

  const navigationItems = (() => {
    const items: {
      icon: string;
      label: string;
      href: string;
      badge?: string;
    }[] = [
      { icon: "🏠", label: "Home", href: "/(tabs)" },
      { icon: "📥", label: "Inbox", href: "/(tabs)/messages" },
      { icon: "🏝️", label: "Hotspots", href: "/(tabs)/hotspots" },
    ];
    if (profile?.role === "staff" || profile?.role === "admin") {
      items.push({
        icon: "🛡️",
        label: "Staff",
        href: "/staff/dashboard",
      });
    }
    items.push({ icon: "👤", label: "Profile", href: "/(tabs)/profile" });
    return items;
  })();

  const isActiveRoute = (href: string) => {
    if (href === "/(tabs)") {
      return (
        pathname === "/" ||
        pathname === "/(tabs)" ||
        pathname === "/(tabs)/index"
      );
    }
    if (href === "/staff/dashboard") {
      return (
        pathname === "/staff/dashboard" || pathname.startsWith("/staff/")
      );
    }
    const cleanHref = href.replace("/(tabs)", "");
    return (
      pathname === href ||
      pathname === cleanHref ||
      pathname.startsWith(cleanHref)
    );
  };

  const handleNavigation = (href: string) => {
    router.push(href as any);
  };

  const handleCreatePost = () => {
    router.push("/(tabs)/post" as any);
  };

  const handleLogout = async () => {
    await signOut();
    setProfile(null);
    router.replace("/auth/login" as any);
  };

  const initials =
    profile?.display_name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "BC";

  return (
    <View style={styles.sidebar}>
      <View style={styles.topPanel}>
        <View style={styles.sidebarHeader}>
          <Image
            source={delawareLogo}
            style={styles.delawareLogo}
            resizeMode="contain"
          />

          <View>
            <Text style={styles.sidebarTitle}>DELAWARE</Text>
            <Text style={styles.sidebarSubtitle}>LOST & FOUND</Text>
          </View>
        </View>

        <SidebarItem
          icon="+"
          label="Make a Post"
          isActive={isActiveRoute("/(tabs)/post")}
          isPrimary
          onPress={handleCreatePost}
        />
      </View>

      <View style={styles.divider} />

      {navigationItems.map((item) => (
        <SidebarItem
          key={item.href}
          icon={item.icon}
          label={item.label}
          badge={item.badge}
          isActive={isActiveRoute(item.href)}
          onPress={() => handleNavigation(item.href)}
        />
      ))}

      <View style={styles.communityCard}>
        <Text style={styles.communityIcon}>🕵️</Text>
        <Text style={styles.communityTitle}>
          Help our campus community thrive.
        </Text>
        <Text style={styles.communityText}>
          Report found items and reunite what matters.
        </Text>
      </View>

      {profile ? (
        <View style={styles.footer}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>

            <View style={styles.profileTextWrap}>
              <Text style={styles.footerText} numberOfLines={1}>
                {profile.display_name}
              </Text>
              <Text style={styles.footerSubtext} numberOfLines={1}>
                {profile.email}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleLogout}
            style={styles.loginButton}
            activeOpacity={0.75}
          >
            <Text style={styles.loginIcon}>↪</Text>
            <Text style={styles.loginLabel}>Log Out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => router.push("/auth/login" as any)}
          style={styles.loginButton}
          activeOpacity={0.75}
        >
          <Text style={styles.loginIcon}>🔐</Text>
          <Text style={styles.loginLabel}>Login</Text>
        </TouchableOpacity>
      )}

      <View style={styles.universityMark}>
        <Text style={styles.universitySmall}>UNIVERSITY OF</Text>
        <Text style={styles.universityLarge}>DELAWARE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 292,
    height: "100%",
    backgroundColor: BRAND.navy,
    paddingVertical: 24,
    paddingHorizontal: 18,
    borderRightWidth: 1,
    borderRightColor: BRAND.softBorder,
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
  delawareLogo: {
    width: 48,
    height: 52,
    borderRadius: 8,
  },
  topPanel: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 22,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderTopRightRadius: 18,
    borderTopLeftRadius: 18,
    marginBottom: 10,
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  sidebarTitle: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.5,
    color: BRAND.udBackground,
  },
  sidebarSubtitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.8,
    color: BRAND.gold,
    marginTop: 2,
  },
  sidebarItem: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: "transparent",
    ...Platform.select({
      web: {
        cursor: "pointer" as any,
        transition: "background-color 0.2s ease, transform 0.2s ease" as any,
      },
    }),
  },
  sidebarItemActive: {
    backgroundColor: BRAND.activeBg,
  },
  sidebarItemPrimary: {
    backgroundColor: BRAND.blueBright,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
  },
  sidebarIcon: {
    width: 28,
    fontSize: 21,
    marginRight: 10,
    color: BRAND.gold,
    textAlign: "center",
  },
  sidebarIconPrimary: {
    color: BRAND.white,
    fontSize: 24,
  },
  sidebarLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: BRAND.white,
  },
  sidebarLabelActive: {
    fontWeight: "800",
  },
  sidebarLabelPrimary: {
    color: BRAND.white,
    fontWeight: "800",
  },
  badge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: BRAND.blueBright,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: BRAND.white,
    fontSize: 12,
    fontWeight: "800",
  },
  divider: {
    height: 1,
    backgroundColor: BRAND.softBorder,
    marginVertical: 14,
  },
  communityCard: {
    marginTop: 28,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  communityIcon: {
    fontSize: 24,
    marginBottom: 12,
  },
  communityTitle: {
    color: BRAND.white,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
    marginBottom: 8,
  },
  communityText: {
    color: BRAND.mutedWhite,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    marginTop: "auto" as any,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: BRAND.softBorder,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blue,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  avatarText: {
    color: BRAND.white,
    fontSize: 15,
    fontWeight: "800",
  },
  profileTextWrap: {
    flex: 1,
  },
  footerText: {
    fontSize: 13,
    fontWeight: "800",
    color: BRAND.white,
    marginBottom: 3,
  },
  footerSubtext: {
    fontSize: 12,
    color: BRAND.mutedWhite,
  },
  loginButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    ...Platform.select({
      web: {
        cursor: "pointer" as any,
        transition: "background-color 0.2s ease" as any,
      },
    }),
  },
  loginIcon: {
    fontSize: 19,
    marginRight: 12,
    color: BRAND.gold,
  },
  loginLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: BRAND.white,
  },
  universityMark: {
    marginTop: 22,
    alignItems: "center",
  },
  universitySmall: {
    color: BRAND.white,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  universityLarge: {
    color: BRAND.gold,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
});
