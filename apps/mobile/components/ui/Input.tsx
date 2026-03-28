import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../../constants/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
  secure?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Input({
  label,
  error,
  hint,
  containerStyle,
  secure = false,
  secureTextEntry,
  multiline = false,
  style,
  ...rest
}: InputProps) {
  const [isSecureVisible, setIsSecureVisible] = useState(false);
  const isSecure = secure || secureTextEntry;
  const showPassword = isSecure && isSecureVisible;

  const hasError = Boolean(error);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          styles.inputWrapper,
          multiline && styles.inputWrapperMultiline,
          hasError && styles.inputWrapperError,
        ]}
      >
        <TextInput
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            isSecure && styles.inputWithToggle,
            style,
          ]}
          placeholderTextColor={Colors.textTertiary}
          selectionColor={Colors.accent}
          secureTextEntry={isSecure ? !isSecureVisible : false}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...rest}
        />

        {isSecure && (
          <TouchableOpacity
            style={styles.visibilityToggle}
            onPress={() => setIsSecureVisible((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {hasError && <Text style={styles.errorText}>{error}</Text>}
      {!hasError && hint && <Text style={styles.hintText}>{hint}</Text>}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.label,
    color: Colors.textSecondary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  inputWrapperMultiline: {
    alignItems: 'flex-start',
  },
  inputWrapperError: {
    borderColor: Colors.error,
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 50,
  },
  inputMultiline: {
    minHeight: 80,
    paddingTop: Spacing.md,
  },
  inputWithToggle: {
    paddingRight: 44,
  },
  visibilityToggle: {
    position: 'absolute',
    right: Spacing.md,
    alignSelf: 'center',
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
  },
  hintText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
});
