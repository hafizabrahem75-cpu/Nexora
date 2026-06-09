import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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

import { DS } from "@/constants/ds";
import { useAuth } from "@/context/AuthContext";
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";

const FEATURES: { icon: React.ComponentProps<typeof Feather>["name"]; label: string }[] = [
  { icon: "check-square", label: "إدارة المهام والأهداف بذكاء" },
  { icon: "users",        label: "التواصل مع الأصدقاء بسهولة" },
  { icon: "trending-up",  label: "تتبع تقدمك وإنجازاتك يومياً" },
];

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const top    = Platform.OS === "web" ? 67 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  const { isAuthenticated, isLoading } = useAuth();
  const { accent, isDark } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/home");
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <View style={[styles.loadingRoot, { paddingTop: top }]}>
        <View style={styles.loadingLogo}>
          <Text style={styles.wordmark}>Nexora</Text>
          <View style={[styles.wordmarkDot, { backgroundColor: accent }]} />
        </View>
        <ActivityIndicator color={accent} style={{ marginTop: 32 }} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: top, paddingBottom: bottom }]}>
      {/* Blurred gradient blobs */}
      <View style={[styles.blob, styles.blobTR, { backgroundColor: accent }]} />
      <View style={[styles.blob, styles.blobBL, { backgroundColor: accent }]} />

      {/* Center hero */}
      <View style={styles.hero}>
        {/* Decorative rings + icon */}
        <View style={styles.ringStack}>
          <View style={[styles.ring, styles.ringOuter, { borderColor: accent + "0D" }]} />
          <View style={[styles.ring, styles.ringMid,   { borderColor: accent + "1A" }]} />
          <View style={[styles.ring, styles.ringInner, { borderColor: accent + "33" }]} />
          <LinearGradient
            colors={[accent + "40", accent + "20"]}
            style={styles.iconCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Feather name="zap" size={30} color="#FFFFFF" />
          </LinearGradient>
        </View>

        {/* Wordmark */}
        <View style={styles.wordmarkRow}>
          <Text style={styles.wordmark}>Nexora</Text>
          <View style={[styles.wordmarkDot, { backgroundColor: accent }]} />
        </View>
        <Text style={styles.tagline}>تنظيم، تواصل، وتطوّر</Text>

        {/* Feature list */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.label} style={styles.featureRow}>
              <Text style={styles.featureLabel}>{f.label}</Text>
              <View style={[styles.featureIcon, { backgroundColor: accent + "1E" }]}>
                <Feather name={f.icon} size={14} color={accent} />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* CTA buttons */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: accent },
            pressed && { opacity: 0.85, transform: [{ scale: 0.975 }] },
          ]}
          onPress={() => router.push("/signup")}
        >
          <Feather name="arrow-left" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>إنشاء حساب جديد</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.65 }]}
          onPress={() => router.push("/login")}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.textSoft }]}>
            لديك حساب؟ سجّل الدخول
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    loadingRoot: {
      flex: 1, backgroundColor: colors.bg,
      alignItems: "center", justifyContent: "center",
    },
    loadingLogo: { alignItems: "center", gap: DS.spacing.sm },

    root: {
      flex: 1, backgroundColor: colors.bg,
      paddingHorizontal: DS.spacing.xl, overflow: "hidden",
    },

    /* Decorative blobs */
    blob: {
      position: "absolute", borderRadius: DS.radius.full,
      opacity: isDark ? 0.07 : 0.10,
    },
    blobTR: { width: 320, height: 320, top: -130, right: -110 },
    blobBL: { width: 220, height: 220, bottom: 60,  left:  -90 },

    /* Hero */
    hero: {
      flex: 1, alignItems: "center", justifyContent: "center",
      gap: DS.spacing.xl,
    },

    /* Rings */
    ringStack: { alignItems: "center", justifyContent: "center" },
    ring: {
      position: "absolute", borderWidth: 1.5,
      borderRadius: DS.radius.full,
    },
    ringOuter: { width: 168, height: 168 },
    ringMid:   { width: 124, height: 124 },
    ringInner: { width: 90,  height: 90  },
    iconCircle: {
      width: 68, height: 68, borderRadius: 34,
      alignItems: "center", justifyContent: "center",
    },

    /* Wordmark */
    wordmarkRow: { alignItems: "center", gap: DS.spacing.sm },
    wordmark: {
      fontSize: 46, fontFamily: DS.font.family.bold,
      color: colors.text, letterSpacing: -1.5,
    },
    wordmarkDot: { width: 9, height: 9, borderRadius: DS.radius.full },
    tagline: {
      fontSize: DS.font.size.lg, fontFamily: DS.font.family.regular,
      color: colors.textSecondary, textAlign: "center", writingDirection: "rtl",
    },

    /* Features */
    features: { width: "100%", gap: DS.spacing.sm },
    featureRow: {
      flexDirection: "row", alignItems: "center",
      justifyContent: "flex-end", gap: DS.spacing.md,
      backgroundColor: colors.card, borderRadius: DS.radius.lg,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: DS.spacing.lg, paddingVertical: DS.spacing.md,
    },
    featureIcon: {
      width: 34, height: 34, borderRadius: DS.radius.md,
      alignItems: "center", justifyContent: "center",
    },
    featureLabel: {
      flex: 1, fontSize: DS.font.size.base, fontFamily: DS.font.family.medium,
      color: colors.textSoft, textAlign: "right", writingDirection: "rtl",
    },

    /* Buttons */
    footer: { gap: DS.spacing.md, paddingTop: DS.spacing.lg },
    primaryBtn: {
      borderRadius: DS.radius.xl, paddingVertical: DS.spacing.xl,
      flexDirection: "row", alignItems: "center",
      justifyContent: "center", gap: DS.spacing.sm,
    },
    primaryBtnText: {
      color: "#FFFFFF", fontSize: DS.font.size.lg,
      fontFamily: DS.font.family.semibold, writingDirection: "rtl",
    },
    secondaryBtn: {
      backgroundColor: colors.card, borderRadius: DS.radius.xl,
      borderWidth: 1, borderColor: colors.border,
      paddingVertical: DS.spacing.xl, alignItems: "center",
    },
    secondaryBtnText: {
      fontSize: DS.font.size.lg,
      fontFamily: DS.font.family.semibold, writingDirection: "rtl",
    },
  });
}
