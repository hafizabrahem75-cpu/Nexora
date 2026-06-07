import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import { ApiError } from "@/lib/api";

type Status = "verifying" | "success" | "error" | "idle";

export default function VerifyEmailScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  const { token } = useLocalSearchParams<{ token?: string }>();
  const { verifyEmail } = useAuth();
  const { accent } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [status, setStatus] = useState<Status>(token ? "verifying" : "idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function run() {
      try {
        await verifyEmail(token!);
        if (!cancelled) {
          setStatus("success");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof ApiError ? err.message : "حدث خطأ ما";
          setErrorMsg(msg);
          setStatus("error");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    }
    run();
    return () => { cancelled = true; };
  }, [token, verifyEmail]);

  return (
    <View style={[styles.container, { paddingTop: top, paddingBottom: bottom }]}>
      <View style={styles.content}>
        {status === "verifying" && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={accent} />
            <Text style={styles.loadingText}>جارٍ التحقق...</Text>
          </View>
        )}

        {status === "success" && (
          <View style={styles.centered}>
            <View style={[styles.iconWrap, { backgroundColor: "#34D39922", borderColor: "#34D39944" }]}>
              <Feather name="check-circle" size={40} color="#34D399" />
            </View>
            <Text style={styles.title}>تم التحقق!</Text>
            <Text style={styles.body}>
              تم التحقق من بريدك الإلكتروني بنجاح. يمكنك الآن الاستمتاع بجميع مزايا Nexora.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.button, { backgroundColor: accent }, pressed && { opacity: 0.85 }]}
              onPress={() => router.replace("/home")}
            >
              <Text style={styles.buttonText}>الذهاب للرئيسية</Text>
            </Pressable>
          </View>
        )}

        {status === "error" && (
          <View style={styles.centered}>
            <View style={[styles.iconWrap, { backgroundColor: "#FF453A22", borderColor: "#FF453A44" }]}>
              <Feather name="x-circle" size={40} color="#FF453A" />
            </View>
            <Text style={styles.title}>فشل التحقق</Text>
            <Text style={styles.body}>{errorMsg || "الرابط غير صالح أو منتهي الصلاحية."}</Text>
            <Pressable
              style={({ pressed }) => [styles.button, { backgroundColor: accent }, pressed && { opacity: 0.85 }]}
              onPress={() => router.replace("/home")}
            >
              <Text style={styles.buttonText}>العودة للرئيسية</Text>
            </Pressable>
          </View>
        )}

        {status === "idle" && (
          <View style={styles.centered}>
            <View style={[styles.iconWrap, { backgroundColor: accent + "22", borderColor: accent + "44" }]}>
              <Feather name="mail" size={40} color={accent} />
            </View>
            <Text style={styles.title}>تحقق من بريدك</Text>
            <Text style={styles.body}>
              أرسلنا رابط التحقق إلى بريدك الإلكتروني عند التسجيل. افتح الرابط من بريدك للتحقق من حسابك.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.button, { backgroundColor: accent }, pressed && { opacity: 0.85 }]}
              onPress={() => router.back()}
            >
              <Text style={styles.buttonText}>العودة</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
    content: { flex: 1, justifyContent: "center" },
    centered: { alignItems: "center", gap: 16 },
    iconWrap: {
      width: 88, height: 88, borderRadius: 28,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1, marginBottom: 8,
    },
    title: {
      fontSize: 26, fontFamily: "Inter_700Bold", color: colors.text,
      writingDirection: "rtl", textAlign: "center",
    },
    body: {
      fontSize: 15, fontFamily: "Inter_400Regular", color: colors.textSecondary,
      textAlign: "center", writingDirection: "rtl",
      lineHeight: 24, paddingHorizontal: 12,
    },
    loadingText: {
      marginTop: 16, fontSize: 16, fontFamily: "Inter_500Medium",
      color: colors.textSecondary, writingDirection: "rtl",
    },
    button: {
      marginTop: 8, borderRadius: 14,
      paddingVertical: 16, paddingHorizontal: 48, alignItems: "center",
    },
    buttonText: {
      color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_600SemiBold", writingDirection: "rtl",
    },
  });
}
