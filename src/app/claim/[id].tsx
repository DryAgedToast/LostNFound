import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getCurrentProfile } from '@/lib/auth';
import {
  isDatabaseUnavailableError,
  showDatabaseNotConnectedPopup,
} from '@/lib/db-alert';
import { Colors, Spacing } from '@/constants/theme';
import { openStripeIdentityBeforeClaim } from '@/lib/stripeIdentity';
import type { Item, Profile, CustomQuestion, CustomAnswer } from '@/types';

const SKIP_STRIPE_IDENTITY =
  process.env.EXPO_PUBLIC_SKIP_STRIPE_IDENTITY_ON_CLAIM === 'true';

export default function ClaimScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [item, setItem] = useState<Item | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [defaultAnswer, setDefaultAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [profile, itemRes] = await Promise.all([
        getCurrentProfile(),
        supabase.from('items').select('*').eq('id', id).single(),
      ]);

      if (!profile) throw new Error('Not authenticated');
      if (itemRes.error) throw itemRes.error;

      setItem(itemRes.data as Item);
      setCurrentProfile(profile);

      // Initialise answer map
      const q = (itemRes.data as Item).custom_questions ?? [];
      const init: Record<string, string> = {};
      q.forEach((cq: CustomQuestion) => { init[cq.id] = ''; });
      setAnswers(init);
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        showDatabaseNotConnectedPopup();
      }
      setError(err instanceof Error ? err.message : 'Failed to load item');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    if (!item || !currentProfile) return;

    const hasCustomQuestions = item.custom_questions && item.custom_questions.length > 0;

    if (hasCustomQuestions) {
      const unanswered = item.custom_questions.some(
        (cq: CustomQuestion) => !(answers[cq.id] ?? '').trim()
      );
      if (unanswered) {
        setError('Please answer all questions before submitting.');
        return;
      }
    } else {
      if (!defaultAnswer.trim()) {
        setError('Please explain why you believe this item is yours.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      let stripeVerificationSessionId: string | null = null;

      if (!SKIP_STRIPE_IDENTITY) {
        const identity = await openStripeIdentityBeforeClaim(item.id);
        if (!identity.ok) {
          setError(identity.error);
          return;
        }
        stripeVerificationSessionId =
          identity.verificationSessionId ?? null;
        if (!stripeVerificationSessionId) {
          setError('Identity check did not return a session id. Try again.');
          return;
        }
      }

      let customAnswers: CustomAnswer[];

      if (hasCustomQuestions) {
        customAnswers = item.custom_questions.map((cq: CustomQuestion): CustomAnswer => ({
          question_id: cq.id,
          question: cq.question,
          answer: answers[cq.id] ?? '',
        }));
      } else {
        customAnswers = [
          {
            question_id: 'default',
            question: 'Why do you believe this is yours?',
            answer: defaultAnswer.trim(),
          },
        ];
      }

      const { error: insertErr } = await supabase.from('claims').insert({
        item_id: item.id,
        claimant_id: currentProfile.id,
        custom_answers: customAnswers,
        status: 'pending',
        ...(stripeVerificationSessionId !== null && {
          stripe_verification_session_id: stripeVerificationSessionId,
        }),
      } as never);

      if (insertErr) throw insertErr;

      router.replace('/(tabs)/messages');
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        showDatabaseNotConnectedPopup();
      }
      setError(err instanceof Error ? err.message : 'Failed to submit claim');
    } finally {
      setSubmitting(false);
    }
  };

  const styles = makeStyles(colors);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1877F2" />
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'Item not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasCustomQuestions = item.custom_questions && item.custom_questions.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/");
              }
            }}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.screenTitle}>Submit a Claim</Text>

          {/* Item preview */}
          {item.image_url !== null ? (
            <Image
              source={{ uri: item.image_url }}
              style={styles.itemImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>No Image</Text>
            </View>
          )}

          <Text style={styles.itemTitle}>{item.title}</Text>

          <Text style={styles.instruction}>
            {SKIP_STRIPE_IDENTITY
              ? 'Answer the following questions to support your claim. Be as specific as possible.'
              : 'Answer the following questions to support your claim. When you submit, you will verify your identity with Stripe (government ID) before the claim is sent.'}
          </Text>

          {/* Questions */}
          {error !== null && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {hasCustomQuestions ? (
            item.custom_questions.map((cq: CustomQuestion) => (
              <View key={cq.id} style={styles.questionBlock}>
                <Text style={styles.questionLabel}>{cq.question}</Text>
                <TextInput
                  style={styles.input}
                  value={answers[cq.id] ?? ''}
                  onChangeText={(text) =>
                    setAnswers((prev) => ({ ...prev, [cq.id]: text }))
                  }
                  placeholder="Your answer…"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  editable={!submitting}
                />
              </View>
            ))
          ) : (
            <View style={styles.questionBlock}>
              <Text style={styles.questionLabel}>Why do you believe this is yours?</Text>
              <TextInput
                style={styles.input}
                value={defaultAnswer}
                onChangeText={setDefaultAnswer}
                placeholder="Describe identifying details, when/where you lost it…"
                placeholderTextColor={colors.textSecondary}
                multiline
                editable={!submitting}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Claim</Text>
            )}
          </TouchableOpacity>
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
    flex: {
      flex: 1,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      padding: Spacing.four,
      paddingBottom: Spacing.six,
    },
    backButton: {
      marginBottom: Spacing.three,
    },
    backButtonText: {
      color: '#1877F2',
      fontSize: 15,
      fontWeight: '600',
    },
    screenTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: Spacing.three,
    },
    itemImage: {
      width: '100%',
      height: 200,
      borderRadius: 12,
      marginBottom: Spacing.three,
    },
    imagePlaceholder: {
      width: '100%',
      height: 200,
      borderRadius: 12,
      backgroundColor: colors.backgroundElement,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.three,
    },
    imagePlaceholderText: {
      color: colors.textSecondary,
      fontSize: 15,
    },
    itemTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: Spacing.two,
    },
    instruction: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: Spacing.three,
      lineHeight: 20,
    },
    errorBox: {
      backgroundColor: '#E4E6EB',
      borderRadius: 8,
      padding: Spacing.three,
      marginBottom: Spacing.three,
    },
    errorText: {
      color: '#65676B',
      fontSize: 14,
    },
    questionBlock: {
      marginBottom: Spacing.three,
    },
    questionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: Spacing.two,
    },
    input: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 10,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
      fontSize: 15,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.backgroundSelected,
      minHeight: 90,
      textAlignVertical: 'top',
    },
    submitButton: {
      backgroundColor: '#1877F2',
      borderRadius: 10,
      paddingVertical: Spacing.three,
      alignItems: 'center',
      marginTop: Spacing.three,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
