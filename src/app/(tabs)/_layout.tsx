import { Colors } from "@/constants/theme";
import { getCurrentProfile } from "@/lib/auth";
import { Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";

export default function TabsLayout() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];
  // null = still loading, false = student, true = staff/admin
  const [isStaff, setIsStaff] = useState<boolean | null>(null);

  useEffect(() => {
    getCurrentProfile().then((profile) => {
      setIsStaff(
        profile?.role === "staff" || profile?.role === "admin" ? true : false
      );
    });
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.placeholder,
        tabBarStyle: {
          backgroundColor: colors.backgroundElement,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.backgroundElement,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          color: colors.text,
        },
        headerShown: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="messages" options={{ title: "Inbox" }} />
      <Tabs.Screen name="post" options={{ title: "Post" }} />
      <Tabs.Screen name="hotspots" options={{ title: "Hotspots" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      {/* isStaff === null means profile not yet loaded — keep hidden until resolved */}
      <Tabs.Screen
        name="staff"
        options={{
          title: "Staff",
          href: isStaff === true ? undefined : null,
        }}
      />
    </Tabs>
  );
}
