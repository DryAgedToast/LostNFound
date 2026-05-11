import DbStatusBadge from "@/components/DbStatusBadge";
import { Colors, Spacing } from "@/constants/theme";
import { DEV_MODE, signUp } from "@/lib/auth";
import {
  isDatabaseUnavailableError,
  showDatabaseNotConnectedPopup,
} from "@/lib/db-alert";
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

type AccountType = "student" | "teacher";

export default function SignupScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];

  const [accountType, setAccountType] = useState<AccountType>("student");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [campusCode, setCampusCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!displayName.trim()) return "Display name is required.";
    if (displayName.trim().length < 2)
      return "Display name must be at least 2 characters.";
    if (!email.trim()) return "Email is required.";
    if (!/\S+@\S+\.\S+/.test(email.trim()))
      return "Enter a valid email address.";
    if (!password) return "Password is required.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    if (accountType === "teacher" && !campusCode.trim())
      return "Campus code is required for teacher accounts.";
    return null;
  };

  const handleSignup = async () => {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const result = await signUp(
        email.trim(),
        password,
        displayName.trim(),
        accountType === "teacher" ? campusCode.trim() : undefined,
      );

      if (result.isTeacher && result.campusCodeId) {
        router.replace({
          pathname: "/auth/select-hotspot",
          params: { campusCodeId: result.campusCodeId },
        });
      } else {
        router.replace("/(tabs)/");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to connect. Please check your internet connection.";
      if (isDatabaseUnavailableError(err)) {
        showDatabaseNotConnectedPopup();
      }
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
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join LostNFound to report, recover, or manage campus items
            </Text>
          </View>

          {/* Account type toggle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                styles.toggleLeft,
                accountType === "student" && styles.toggleActive,
              ]}
              onPress={() => setAccountType("student")}
              disabled={loading}
            >
              <Text
                style={[
                  styles.toggleLabel,
                  accountType === "student" && styles.toggleLabelActive,
                ]}
              >
                Student
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                styles.toggleRight,
                accountType === "teacher" && styles.toggleActive,
              ]}
              onPress={() => setAccountType("teacher")}
              disabled={loading}
            >
              <Text
                style={[
                  styles.toggleLabel,
                  accountType === "teacher" && styles.toggleLabelActive,
                ]}
              >
                Teacher / Staff
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {error !== null && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              editable={!loading}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!loading}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                disabled={loading}
              >
                <Text style={styles.toggleText}>
                  {showPassword ? "Hide" : "Show"}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter your password"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showConfirmPassword}
                textContentType="newPassword"
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword((prev) => !prev)}
                disabled={loading}
              >
                <Text style={styles.toggleText}>
                  {showConfirmPassword ? "Hide" : "Show"}
                </Text>
              </TouchableOpacity>
            </View>

            {accountType === "teacher" && (
              <>
                <Text style={styles.label}>Teacher Campus Code</Text>
                <TextInput
                  style={styles.input}
                  value={campusCode}
                  onChangeText={setCampusCode}
                  placeholder="e.g. UDEL-TEACHER"
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!loading}
                />
                <Text style={styles.hintText}>
                  This verifies that you can manage Lost & Found desks for
                  your campus.
                </Text>
              </>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.backgroundElement} />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => router.push("/auth/login")}
              disabled={loading}
            >
              <Text style={styles.linkText}>
                Already have an account?{" "}
                <Text style={styles.linkHighlight}>Log in</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {DEV_MODE && <DbStatusBadge />}
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
      marginBottom: Spacing.three,
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
    toggleRow: {
      flexDirection: "row",
      marginBottom: Spacing.three,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    toggleButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      backgroundColor: colors.backgroundElement,
    },
    toggleLeft: {
      borderRightWidth: 0.5,
      borderRightColor: colors.border,
    },
    toggleRight: {
      borderLeftWidth: 0.5,
      borderLeftColor: colors.border,
    },
    toggleActive: {
      backgroundColor: "#1877F2",
    },
    toggleLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    toggleLabelActive: {
      color: "#FFFFFF",
    },
    form: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.three,
      shadowColor: "#000000",
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 12,
      elevation: 2,
      gap: Spacing.two,
    },
    errorBox: {
      backgroundColor: colors.backgroundSelected,
      borderRadius: 8,
      padding: Spacing.three,
      marginBottom: Spacing.two,
    },
    errorText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: Spacing.one,
      marginTop: Spacing.two,
    },
    hintText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: -Spacing.one,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    passwordRow: {
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Spacing.two,
    },
    passwordInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
    },
    toggleText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "600",
    },
    button: {
      backgroundColor: "#42B72A",
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: Spacing.three,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.backgroundElement,
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
      color: colors.primary,
      fontWeight: "600",
    },
  });
}
