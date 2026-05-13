import FeedHeaderBrand from "@/components/FeedHeaderBrand";
import { Colors } from "@/constants/theme";
import { getCurrentProfile } from "@/lib/auth";
import { Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { Text, useColorScheme, View } from "react-native";

const UD_HEADER_BLUE = "#02569e";

function TabBarEmoji({
  emoji,
  focused,
}: {
  emoji: string;
  focused: boolean;
}) {
  return (
    <Text
      style={{
        fontSize: 24,
        lineHeight: 28,
        opacity: focused ? 1 : 0.45,
      }}
    >
      {emoji}
    </Text>
  );
}

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

  const headerDefault = {
    backgroundColor: colors.backgroundElement,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.placeholder,
        tabBarStyle: {
          backgroundColor: colors.backgroundElement,
          borderTopColor: colors.border,
        },
        headerStyle: headerDefault,
        headerTintColor: colors.text,
        headerTitleStyle: {
          color: colors.text,
        },
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Lost Items",
          tabBarLabel: "Lost Items",
          tabBarIcon: ({ focused }) => (
            <TabBarEmoji emoji="🔎" focused={focused} />
          ),
          headerStyle: {
            ...headerDefault,
            backgroundColor: UD_HEADER_BLUE,
            borderBottomWidth: 1,
            borderBottomColor: "rgba(255,255,255,0.28)",
          },
          headerTintColor: "#FFFFFF",
          headerTitle: () => (
            <View style={{ paddingBottom: 12 }}>
              <FeedHeaderBrand />
            </View>
          ),
          headerTitleAlign: "left",
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Inbox",
          tabBarIcon: ({ focused }) => (
            <TabBarEmoji emoji="📥" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: "Post",
          tabBarIcon: ({ focused }) => (
            <TabBarEmoji emoji="📷" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="hotspots"
        options={{
          title: "Hotspots",
          tabBarIcon: ({ focused }) => (
            <TabBarEmoji emoji="📍" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabBarEmoji emoji="👤" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="staff"
        options={{
          title: "Staff",
          href: isStaff === true ? undefined : null,
          tabBarIcon: ({ focused }) => (
            <TabBarEmoji emoji="🛡️" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
