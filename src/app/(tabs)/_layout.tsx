import { Colors } from "@/constants/theme";
import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";

/**
 * Mobile tab navigation (native apps)
 * Web uses sidebar layout from _layout.web.tsx
 */
export default function TabsLayout() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];

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
    </Tabs>
  );
}
