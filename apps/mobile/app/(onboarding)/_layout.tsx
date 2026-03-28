import React from 'react';
import { Stack } from 'expo-router';

// Tells Expo Router / React Navigation that this stack always starts at
// "nickname" — prevents cached navigation state (e.g. questionnaire) from
// being restored and causing the visual flash users reported.
export const unstable_settings = {
  initialRouteName: 'nickname',
};

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0C0C1A' },
        animation: 'slide_from_right',
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="nickname" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="intro" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="privacy" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="venue-flex" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="location" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="match-intro" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="questionnaire" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="availability" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="complete" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  );
}
