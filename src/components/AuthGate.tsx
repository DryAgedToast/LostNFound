import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getSession } from '@/lib/auth';

interface AuthGateProps {
  children: React.ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const session = await getSession();
        if (cancelled) return;

        if (!session) {
          router.replace('/auth/login');
        } else {
          setAuthenticated(true);
        }
      } catch {
        if (!cancelled) {
          router.replace('/auth/login');
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
        <ActivityIndicator size="large" color="#1877F2" />
      </View>
    );
  }

  if (!authenticated) {
    return null;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});
