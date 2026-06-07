import { router } from "expo-router";
import React, { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading } = useAuth();
  const { accent } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/home");
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.logoText}>Nexora</Text>
        <View style={[styles.logoDot, { backgroundColor: accent }]} />
        <ActivityIndicator color={accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Platform.OS === "web" ? 67 : insets.top,
          paddingBottom: Platform.OS === "web" ? 34 : insets.bottom,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>Nexora</Text>
          <View style={[styles.logoDot, { backgroundColor: accent }]} />
        </View>
        <Text style={styles.tagline}>مرحباً بك</Text>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.button, { backgroundColor: accent }, pressed && styles.buttonPressed]}
          onPress={() => router.push("/signup")}
        >
          <Text style={styles.buttonText}>إنشاء حساب</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.7 }]}
          onPress={() => router.push("/login")}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.textSoft }]}>تسجيل الدخول</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    loadingContainer: {
      flex: 1, backgroundColor: colors.bg,
      alignItems: "center", justifyContent: "center", gap: 8,
    },
    container: {
      flex: 1, backgroundColor: colors.bg, paddingHorizontal: 28,
    },
    content: {
      flex: 1, alignItems: "center", justifyContent: "center", gap: 12,
    },
    logoContainer: { alignItems: "center", gap: 8 },
    logoText: {
      fontSize: 52, fontFamily: "Inter_700Bold",
      color: colors.text, letterSpacing: -1.5,
    },
    logoDot: {
      width: 8, height: 8, borderRadius: 4,
    },
    tagline: {
      fontSize: 18, fontFamily: "Inter_400Regular",
      color: colors.textSecondary, textAlign: "center", writingDirection: "rtl",
    },
    footer: { paddingBottom: 16, gap: 12 },
    button: {
      borderRadius: 14,
      paddingVertical: 18, alignItems: "center",
    },
    buttonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    buttonText: {
      color: "#FFFFFF", fontSize: 17,
      fontFamily: "Inter_600SemiBold", writingDirection: "rtl",
    },
    secondaryButton: {
      backgroundColor: colors.card, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, paddingVertical: 18, alignItems: "center",
    },
    secondaryButtonText: {
      fontSize: 17,
      fontFamily: "Inter_600SemiBold", writingDirection: "rtl",
    },
  });
}
