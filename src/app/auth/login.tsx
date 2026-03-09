import { Colors, Spacing } from "@/constants/theme";
import { signIn } from "@/lib/auth";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!email.trim()) return "Email is required.";
    if (!/\S+@\S+\.\S+/.test(email.trim()))
      return "Enter a valid email address.";
    if (!password) return "Password is required.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    return null;
  };

  const handleLogin = async () => {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const { role } = await signIn(email.trim(), password);
      if (role === "staff" || role === "admin") {
        router.replace("/staff/dashboard");
      } else {
        router.replace("/(tabs)/");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to connect. Please check your internet connection.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const styles = makeStyles(colors);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Sign in to your LostNFound account
            </Text>
          </View>

          <View style={styles.form}>
            {error !== null && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!loading}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              textContentType="password"
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Log In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => router.push("/auth/signup")}
              disabled={loading}
            >
              <Text style={styles.linkText}>
                Don't have an account?{" "}
                <Text style={styles.linkHighlight}>Sign up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: typeof Colors.light) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardAvoid: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.five,
    },
    header: {
      marginBottom: Spacing.five,
      alignItems: "center",
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.text,
      marginBottom: Spacing.one,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: "center",
    },
    form: {
      gap: Spacing.two,
    },
    errorBox: {
      backgroundColor: "#FDECEA",
      borderRadius: 8,
      padding: Spacing.three,
      marginBottom: Spacing.two,
    },
    errorText: {
      color: "#C0392B",
      fontSize: 14,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: Spacing.one,
      marginTop: Spacing.two,
    },
    input: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 10,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.backgroundSelected,
    },
    button: {
      backgroundColor: "#208AEF",
      borderRadius: 10,
      paddingVertical: Spacing.three,
      alignItems: "center",
      marginTop: Spacing.three,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "700",
    },
    linkRow: {
      alignItems: "center",
      marginTop: Spacing.three,
    },
    linkText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    linkHighlight: {
      color: "#208AEF",
      fontWeight: "600",
    },
  });
}
