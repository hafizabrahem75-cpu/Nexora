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

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  const { signIn } = useAuth();
  const { accent } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = email.trim().length > 0 && password.length > 0;

  async function handleLogin() {
    if (!canSubmit || loading) return;
    setError("");
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/home");
    } catch (err) {
      let msg = "حدث خطأ ما، يرجى المحاولة مجدداً";
      if (err instanceof ApiError) {
        if (err.message === "email_not_verified") {
          msg = "يرجى تفعيل بريدك الإلكتروني أولاً. تحقق من صندوق الوارد ثم أعد المحاولة.";
        } else {
          msg = err.message;
        }
      }
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
        <View style={styles.titleRow}>
          <Text style={styles.title}>تسجيل الدخول</Text>
        </View>
        <Text style={styles.subtitle}>أدخل بياناتك للمتابعة</Text>

        <View style={styles.form}>
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
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>كلمة المرور</Text>
            <View style={styles.passwordRow}>
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eyeButton}
                hitSlop={8}
              >
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.textSecondary} />
              </Pressable>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                textAlign="right"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color="#FF453A" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.forgotLink, pressed && { opacity: 0.6 }]}
            onPress={() => router.push("/forgot-password")}
          >
            <Text style={[styles.forgotLinkText, { color: accent }]}>نسيت كلمة المرور؟</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.loginButton,
            { backgroundColor: accent },
            (!canSubmit || loading) && { opacity: 0.4 },
            pressed && canSubmit && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
          onPress={handleLogin}
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.loginButtonText}>دخول</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.switchLink, pressed && { opacity: 0.6 }]}
          onPress={() => router.replace("/signup")}
        >
          <Text style={styles.switchLinkText}>ليس لديك حساب؟ إنشاء حساب جديد</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 28 },
    header: { paddingTop: 8, paddingBottom: 8, alignItems: "flex-start" },
    backButton: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.card, alignItems: "center", justifyContent: "center",
    },
    content: { flex: 1, paddingTop: 32 },
    titleRow: { flexDirection: "row", justifyContent: "flex-end" },
    title: {
      fontSize: 30, fontFamily: "Inter_700Bold", color: colors.text,
      textAlign: "right", writingDirection: "rtl", marginBottom: 8,
    },
    subtitle: {
      fontSize: 15, fontFamily: "Inter_400Regular", color: colors.textSecondary,
      textAlign: "right", writingDirection: "rtl", marginBottom: 40,
    },
    form: { gap: 20 },
    fieldGroup: { gap: 8 },
    label: {
      fontSize: 14, fontFamily: "Inter_500Medium", color: colors.textSoft,
      textAlign: "right", writingDirection: "rtl",
    },
    input: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16,
      fontSize: 15, fontFamily: "Inter_400Regular", color: colors.text, flex: 1,
    },
    passwordRow: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 16,
    },
    passwordInput: {
      backgroundColor: "transparent", borderWidth: 0, borderRadius: 0,
      paddingHorizontal: 0, flex: 1,
    },
    eyeButton: { padding: 4 },
    errorBox: {
      flexDirection: "row", alignItems: "center", justifyContent: "flex-end",
      gap: 6, backgroundColor: "#2C1515", borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, borderColor: "#FF453A33",
    },
    errorText: {
      fontSize: 13, fontFamily: "Inter_500Medium", color: "#FF453A",
      textAlign: "right", writingDirection: "rtl", flex: 1,
    },
    forgotLink: { alignItems: "flex-start" },
    forgotLinkText: { fontSize: 13, fontFamily: "Inter_500Medium", writingDirection: "rtl" },
    footer: { paddingBottom: 16, gap: 12 },
    loginButton: { borderRadius: 14, paddingVertical: 18, alignItems: "center" },
    loginButtonText: {
      color: "#FFFFFF", fontSize: 17, fontFamily: "Inter_600SemiBold", writingDirection: "rtl",
    },
    switchLink: { alignItems: "center", paddingVertical: 6 },
    switchLinkText: {
      fontSize: 14, fontFamily: "Inter_400Regular", color: colors.textSecondary, writingDirection: "rtl",
    },
  });
}
