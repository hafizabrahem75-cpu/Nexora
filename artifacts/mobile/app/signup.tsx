import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  const { signUp } = useAuth();
  const { accent } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && password.length >= 8;

  async function handleSignUp() {
    if (!canSubmit || loading) return;
    setError("");
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/home");
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
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
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

        <View style={styles.titleRow}>
          <Text style={styles.title}>إنشاء حساب</Text>
        </View>
        <Text style={styles.subtitle}>أدخل بياناتك للبدء</Text>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>الاسم</Text>
            <TextInput
              style={styles.input}
              placeholder="اسمك الكامل"
              placeholderTextColor={colors.placeholder}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              textAlign="right"
              returnKeyType="next"
            />
          </View>

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
                placeholder="8 أحرف على الأقل"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                textAlign="right"
                returnKeyType="done"
                onSubmitEditing={handleSignUp}
              />
            </View>
            {password.length > 0 && password.length < 8 && (
              <Text style={styles.hint}>كلمة المرور يجب أن تكون 8 أحرف على الأقل</Text>
            )}
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color="#FF453A" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            { backgroundColor: accent },
            (!canSubmit || loading) && { opacity: 0.4 },
            pressed && canSubmit && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
          onPress={handleSignUp}
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>إنشاء الحساب</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.switchLink, pressed && { opacity: 0.6 }]}
          onPress={() => router.replace("/login")}
        >
          <Text style={styles.switchLinkText}>لديك حساب بالفعل؟ سجّل الدخول</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
    scroll: { flexGrow: 1 },
    header: { paddingTop: 8, paddingBottom: 8, alignItems: "flex-start" },
    backButton: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.card, alignItems: "center", justifyContent: "center",
    },
    titleRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 24 },
    title: {
      fontSize: 30, fontFamily: "Inter_700Bold", color: colors.text,
      textAlign: "right", writingDirection: "rtl", marginBottom: 8,
    },
    subtitle: {
      fontSize: 15, fontFamily: "Inter_400Regular", color: colors.textSecondary,
      textAlign: "right", writingDirection: "rtl", marginBottom: 36,
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
    hint: {
      fontSize: 12, fontFamily: "Inter_400Regular", color: "#F59E0B",
      textAlign: "right", writingDirection: "rtl",
    },
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
    footer: { paddingTop: 16, gap: 12 },
    submitButton: { borderRadius: 14, paddingVertical: 18, alignItems: "center" },
    submitButtonText: {
      color: "#FFFFFF", fontSize: 17, fontFamily: "Inter_600SemiBold", writingDirection: "rtl",
    },
    switchLink: { alignItems: "center", paddingVertical: 6 },
    switchLinkText: {
      fontSize: 14, fontFamily: "Inter_400Regular", color: colors.textSecondary, writingDirection: "rtl",
    },
  });
}
