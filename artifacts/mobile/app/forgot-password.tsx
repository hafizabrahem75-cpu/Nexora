import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import { ApiError } from "@/lib/api";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  const { forgotPassword } = useAuth();
  const { accent } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!email.trim() || loading) return;
    setError("");
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "حدث خطأ ما، يرجى المحاولة مجدداً";
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: top, paddingBottom: bottom }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
          hitSlop={12}
        >
          <Feather name="arrow-right" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.content}>
        {sent ? (
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Feather name="mail" size={32} color="#34D399" />
            </View>
            <Text style={styles.successTitle}>تم الإرسال!</Text>
            <Text style={styles.successBody}>
              إذا كان البريد الإلكتروني مسجلاً، ستصل رسالة استعادة كلمة المرور قريباً. تحقق من بريدك الوارد.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.backToLogin, { backgroundColor: accent }, pressed && { opacity: 0.7 }]}
              onPress={() => router.replace("/login")}
            >
              <Text style={styles.backToLoginText}>العودة لتسجيل الدخول</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.titleRow}>
              <Text style={styles.title}>نسيت كلمة المرور؟</Text>
            </View>
            <Text style={styles.subtitle}>
              أدخل بريدك الإلكتروني وسنرسل لك رابط استعادة كلمة المرور.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>البريد الإلكتروني</Text>
              <TextInput
                style={styles.input}
                placeholder="example@email.com"
                placeholderTextColor={colors.placeholder}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textAlign="right"
                returnKeyType="send"
                onSubmitEditing={handleSubmit}
                autoFocus
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={14} color="#FF453A" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                { backgroundColor: accent },
                (!email.trim() || loading) && { opacity: 0.4 },
                pressed && email.trim() && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={handleSubmit}
              disabled={!email.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>إرسال رابط الاستعادة</Text>
              )}
            </Pressable>
          </>
        )}
      </View>

      {!sent && (
        <View style={[styles.footer, { paddingBottom: bottom || 16 }]}>
          <Pressable
            style={({ pressed }) => [styles.switchLink, pressed && { opacity: 0.6 }]}
            onPress={() => router.replace("/login")}
          >
            <Text style={styles.switchLinkText}>العودة لتسجيل الدخول</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
    header: { paddingTop: 8, paddingBottom: 8, alignItems: "flex-start" },
    backButton: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.card, alignItems: "center", justifyContent: "center",
    },
    content: { flex: 1, paddingTop: 32 },
    titleRow: { flexDirection: "row", justifyContent: "flex-end" },
    title: {
      fontSize: 28, fontFamily: "Inter_700Bold", color: colors.text,
      textAlign: "right", writingDirection: "rtl", marginBottom: 10,
    },
    subtitle: {
      fontSize: 15, fontFamily: "Inter_400Regular", color: colors.textSecondary,
      textAlign: "right", writingDirection: "rtl", marginBottom: 36, lineHeight: 24,
    },
    fieldGroup: { gap: 8, marginBottom: 20 },
    label: {
      fontSize: 14, fontFamily: "Inter_500Medium", color: colors.textSoft,
      textAlign: "right", writingDirection: "rtl",
    },
    input: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16,
      fontSize: 15, fontFamily: "Inter_400Regular", color: colors.text,
    },
    errorBox: {
      flexDirection: "row", alignItems: "center", justifyContent: "flex-end",
      gap: 6, backgroundColor: "#2C1515", borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, borderColor: "#FF453A33", marginBottom: 16,
    },
    errorText: {
      fontSize: 13, fontFamily: "Inter_500Medium", color: "#FF453A",
      textAlign: "right", writingDirection: "rtl", flex: 1,
    },
    submitButton: { borderRadius: 14, paddingVertical: 18, alignItems: "center" },
    submitButtonText: {
      color: "#FFFFFF", fontSize: 17, fontFamily: "Inter_600SemiBold", writingDirection: "rtl",
    },
    footer: { paddingTop: 8 },
    switchLink: { alignItems: "center", paddingVertical: 6 },
    switchLinkText: {
      fontSize: 14, fontFamily: "Inter_400Regular", color: colors.textSecondary, writingDirection: "rtl",
    },
    successContainer: { alignItems: "center", paddingTop: 40, gap: 16 },
    successIcon: {
      width: 80, height: 80, borderRadius: 24,
      backgroundColor: "#34D39922", alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: "#34D39944", marginBottom: 8,
    },
    successTitle: {
      fontSize: 26, fontFamily: "Inter_700Bold", color: colors.text, writingDirection: "rtl",
    },
    successBody: {
      fontSize: 15, fontFamily: "Inter_400Regular", color: colors.textSecondary,
      textAlign: "center", writingDirection: "rtl", lineHeight: 24, paddingHorizontal: 16,
    },
    backToLogin: {
      marginTop: 16, borderRadius: 14,
      paddingVertical: 16, paddingHorizontal: 40, alignItems: "center",
    },
    backToLoginText: {
      color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_600SemiBold", writingDirection: "rtl",
    },
  });
}
