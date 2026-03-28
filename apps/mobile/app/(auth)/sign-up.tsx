import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signUp } from '../../lib/api/auth';
import { useAuth } from '../../store/authStore';
import { track, identifyUser } from '../../lib/analytics';
import { Colors, Spacing, Radius, Typography } from '../../constants/theme';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const signUpSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(30, 'First name must be under 30 characters')
    .trim(),
  email: z
    .string()
    .email('Please enter a valid email address')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

type SignUpFormData = z.infer<typeof signUpSchema>;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SignUpScreen() {
  const router = useRouter();
  const { applySignUpResult } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      firstName: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: SignUpFormData) => {
    track('sign_up_started');
    setIsLoading(true);
    setSubmitError(null);
    try {
      const { data, error } = await signUp(values.email, values.password, values.firstName);

      if (error) {
        setSubmitError(error);
        return;
      }

      if (data) {
        // Identify the user in analytics immediately after sign-up
        identifyUser(data.user.id, { first_name: values.firstName });
        track('sign_up_completed', { method: 'email' });

        // Apply auth state atomically in one dispatch so NavigationGuard only
        // fires once. For a brand-new account nickname is always null, so the
        // guard routes straight to /(onboarding)/nickname with no flash.
        applySignUpResult(data.user, data.profile);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              Join Squad and start meeting your people, every week.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* First Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>First Name</Text>
              <Controller
                control={control}
                name="firstName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View
                    style={[
                      styles.inputWrapper,
                      errors.firstName ? styles.inputError : null,
                    ]}
                  >
                    <InputField
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="What's your first name?"
                      autoCapitalize="words"
                      autoCorrect={false}
                    />
                  </View>
                )}
              />
              {errors.firstName && (
                <Text style={styles.errorText}>{errors.firstName.message}</Text>
              )}
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View
                    style={[
                      styles.inputWrapper,
                      errors.email ? styles.inputError : null,
                    ]}
                  >
                    <InputField
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="you@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                )}
              />
              {errors.email && (
                <Text style={styles.errorText}>{errors.email.message}</Text>
              )}
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View
                    style={[
                      styles.inputWrapper,
                      errors.password ? styles.inputError : null,
                    ]}
                  >
                    <InputField
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="At least 8 characters"
                      secureTextEntry
                    />
                  </View>
                )}
              />
              {errors.password && (
                <Text style={styles.errorText}>{errors.password.message}</Text>
              )}
            </View>
          </View>

          {/* Submit error */}
          {submitError && (
            <View style={styles.submitError}>
              <Text style={styles.submitErrorText}>{submitError}</Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            <Text style={styles.submitButtonText}>
              {isLoading ? 'Creating account…' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          {/* Sign in link */}
          <TouchableOpacity
            style={styles.signInLink}
            onPress={() => router.push('/(auth)/sign-in')}
          >
            <Text style={styles.signInLinkText}>
              Already have an account?{' '}
              <Text style={styles.signInLinkAccent}>Sign in</Text>
            </Text>
          </TouchableOpacity>

          {/* Terms */}
          <Text style={styles.termsText}>
            By creating an account, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Inline InputField helper
// ---------------------------------------------------------------------------

function InputField(props: TextInputProps) {
  return (
    <TextInput
      style={styles.textInput}
      placeholderTextColor={Colors.textTertiary}
      selectionColor={Colors.accent}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  form: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  inputWrapper: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  inputError: {
    borderColor: Colors.error,
  },
  textInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 50,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
  },
  submitError: {
    backgroundColor: 'rgba(220,38,38,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.3)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  submitErrorText: {
    ...Typography.bodySmall,
    color: '#f87171',
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  signInLink: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  signInLinkText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  signInLinkAccent: {
    color: Colors.accent,
    fontWeight: '600',
  },
  termsText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
