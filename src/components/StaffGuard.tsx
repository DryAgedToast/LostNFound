import { getCurrentProfile } from "@/lib/auth";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

interface StaffGuardProps {
  children: React.ReactNode;
}

export default function StaffGuard({ children }: StaffGuardProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const p = await getCurrentProfile();
        if (cancelled) return;

        if (!p || (p.role !== "staff" && p.role !== "admin")) {
          router.replace("/(tabs)/");
        } else {
          setAuthorized(true);
        }
      } catch {
        if (!cancelled) {
          router.replace("/(tabs)/");
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  if (!authorized) {
    return null;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
});
