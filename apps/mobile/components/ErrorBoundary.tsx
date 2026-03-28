import React, { Component, ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI. If omitted the default recovery screen is shown. */
  fallback?: ReactNode;
  /** Called after the error is caught — wire Sentry.captureException() here. */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// ErrorBoundary class — must be a class component (React requirement)
// ---------------------------------------------------------------------------

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Forward to Sentry / your monitoring service when integrated:
    //   import * as Sentry from '@sentry/react-native';
    //   Sentry.captureException(error, { extra: errorInfo });
    this.props.onError?.(error, errorInfo);

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error.message, '\n', errorInfo.componentStack);
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    this.reset();
    // Small delay so the state clears before navigation
    setTimeout(() => router.replace('/(app)'), 0);
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.reset}
          onGoHome={this.handleGoHome}
        />
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Default fallback UI
// ---------------------------------------------------------------------------

function ErrorFallback({
  error,
  onRetry,
  onGoHome,
}: {
  error: Error | null;
  onRetry: () => void;
  onGoHome: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="alert-circle-outline" size={56} color="#F87171" />
      </View>

      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.subtitle}>
        We hit an unexpected error. The team has been notified — try again or
        head back to home.
      </Text>

      {/* Dev-only error detail */}
      {__DEV__ && error && (
        <ScrollView style={styles.devBox} contentContainerStyle={styles.devBoxContent}>
          <Text style={styles.devLabel}>DEV — error detail</Text>
          <Text style={styles.devMessage}>{error.message}</Text>
        </ScrollView>
      )}

      <TouchableOpacity style={styles.primaryButton} onPress={onRetry} activeOpacity={0.85}>
        <Text style={styles.primaryButtonText}>Try Again</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={onGoHome} activeOpacity={0.75}>
        <Text style={styles.secondaryButtonText}>Go to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C1A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconWrap: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  devBox: {
    width: '100%',
    maxHeight: 160,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.25)',
    marginBottom: 28,
  },
  devBoxContent: {
    padding: 14,
  },
  devLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F87171',
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  devMessage: {
    fontSize: 12,
    color: '#FCA5A5',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#7B6CF6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#7B6CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    color: '#9CA3AF',
  },
});
