import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../store/authStore';
import { GroupProvider } from '../store/groupStore';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { identifyUser, resetAnalyticsUser } from '../lib/analytics';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// ---------------------------------------------------------------------------
// Navigation guard: redirect based on auth state
// ---------------------------------------------------------------------------

function NavigationGuard() {
  const { isAuthenticated, isLoading, profile, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Identify the user in analytics once their auth state resolves
  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && user) {
      identifyUser(user.id, {
        first_name: profile?.first_name ?? profile?.display_name ?? undefined,
        onboarding_complete: profile?.onboarding_complete ?? false,
      });
    } else {
      resetAnalyticsUser();
    }
  }, [isAuthenticated, isLoading, user, profile]);

  useEffect(() => {
    if (isLoading) return;

    // Hide splash screen once auth state is resolved
    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';
    const inAppGroup = segments[0] === '(app)';

    if (!isAuthenticated) {
      // Not signed in — redirect to auth flow
      if (!inAuthGroup) {
        router.replace('/(auth)/welcome');
      }
      return;
    }

    // Signed in but onboarding not complete
    if (isAuthenticated && profile && !profile.onboarding_complete) {
      if (!inOnboardingGroup) {
        // Route to the right step: new users (no nickname yet) start at the
        // beginning; users who got interrupted mid-flow resume at questionnaire.
        const dest = profile.nickname
          ? '/(onboarding)/questionnaire'
          : '/(onboarding)/nickname';
        router.replace(dest);
      }
      return;
    }

    // Signed in and onboarding complete — go to app
    if (isAuthenticated && profile?.onboarding_complete) {
      if (inAuthGroup || inOnboardingGroup) {
        router.replace('/(app)');
      }
    }
  }, [isAuthenticated, isLoading, profile, segments]);

  return null;
}

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

function RootLayoutInner() {
  return (
    <>
      <NavigationGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <GroupProvider>
            <RootLayoutInner />
          </GroupProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
