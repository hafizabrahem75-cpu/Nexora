import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { I18nManager } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import LockScreen from "@/components/LockScreen";
import { AppLockProvider, useAppLock } from "@/context/AppLockContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { SettingsProvider, useColors } from "@/context/SettingsContext";

I18nManager.allowRTL(true);
if (!I18nManager.isRTL) {
  I18nManager.forceRTL(true);
}

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: "fade",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="home" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="notes" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="username" />
      <Stack.Screen name="search" />
      <Stack.Screen name="friends" />
      <Stack.Screen name="conversations" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="chat/[id]" options={{ animation: "slide_from_left" }} />
    </Stack>
  );
}

function AuthenticatedProviders({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  return (
    <NotificationsProvider token={token}>
      <ProfileProvider>
        {children}
      </ProfileProvider>
    </NotificationsProvider>
  );
}

function AppLockGate({ children }: { children: React.ReactNode }) {
  const { isLocked } = useAppLock();
  return (
    <>
      {children}
      {isLocked && <LockScreen />}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SettingsProvider>
            <AppLockProvider>
              <AuthProvider>
                <AuthenticatedProviders>
                  <AppLockGate>
                    <RootLayoutNav />
                  </AppLockGate>
                </AuthenticatedProviders>
              </AuthProvider>
            </AppLockProvider>
          </SettingsProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
