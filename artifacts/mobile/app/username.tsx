import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import { apiFetch } from "@/lib/api";

type AvailabilityState = "idle" | "checking" | "available" | "taken" | "invalid";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function UsernameScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;
  const { user, token, refreshUser } = useAuth();

  const [draft, setDraft] = useState(user?.username ?? "");
  const [availability, setAvailability] = useState<AvailabilityState>("idle");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const handleChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setDraft(clean);
    setSaved(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!clean || clean === user?.username) {
      setAvailability("idle");
      return;
    }

    if (!USERNAME_RE.test(clean)) {
      setAvailability("invalid");
      return;
    }

    setAvailability("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiFetch<{ available: boolean }>(
          `/users/check-username?username=${encodeURIComponent(clean)}`,
        );
        setAvailability(data.available ? "available" : "taken");
      } catch {
        setAvailability("idle");
      }
    }, 400);
  };

  const save = async () => {
    if (!token || !draft || availability === "taken" || availability === "invalid") return;
    setSaving(true);
    try {
      await apiFetch("/users/username", {
        method: "PUT",
        body: JSON.stringify({ username: draft }),
        token,
      });
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
      setAvailability("idle");
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const canSave =
    draft.length >= 3 &&
    draft !== user?.username &&
    (availability === "available" || availability === "idle") &&
    !saving;

  const AvailabilityIcon =
    availability === "available" ? (
      <Feather name="check-circle" size={18} color="#34D399" />
    ) : availability === "taken" ? (
      <Feather name="x-circle" size={18} color="#FF453A" />
    ) : availability === "checking" ? (
      <ActivityIndicator size="small" color="#8E8E93" />
    ) : null;

  const availabilityMsg =
    availability === "available"
      ? "اسم المستخدم متاح ✓"
      : availability === "taken"
      ? "اسم المستخدم مأخوذ"
      : availability === "invalid"
      ? "3-20 حرف: أحرف إنجليزية صغيرة، أرقام، أو _"
      : null;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-right" size={22} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.title}>اسم المستخدم</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>اسم المستخدم</Text>
          <View style={styles.inputWrap}>
            <View style={styles.inputIcon}>{AvailabilityIcon}</View>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={draft}
              onChangeText={handleChange}
              placeholder="مثال: ahmed_x"
              placeholderTextColor="#3A3A3C"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              textAlign="right"
            />
            <Text style={styles.atSign}>@</Text>
          </View>
          {availabilityMsg ? (
            <Text
              style={[
                styles.hint,
                availability === "available" && { color: "#34D399" },
                availability === "taken" && { color: "#FF453A" },
                availability === "invalid" && { color: "#F59E0B" },
              ]}
            >
              {availabilityMsg}
            </Text>
          ) : (
            <Text style={styles.hintGray}>
              يستخدمه الأصدقاء للبحث عنك • 3-20 حرف
            </Text>
          )}
        </View>

        {saved ? (
          <View style={styles.savedBanner}>
            <Feather name="check" size={16} color="#34D399" />
            <Text style={styles.savedText}>تم الحفظ بنجاح</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            !canSave && styles.saveBtnDisabled,
            pressed && canSave && { opacity: 0.85 },
          ]}
          onPress={save}
          disabled={!canSave}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>حفظ</Text>
          )}
        </Pressable>

        {user?.username ? (
          <View style={styles.currentWrap}>
            <Text style={styles.currentLabel}>الحالي:</Text>
            <Text style={styles.currentValue}>@{user.username}</Text>
          </View>
        ) : (
          <Text style={styles.hintGray}>لم تقم بتعيين اسم مستخدم بعد</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D0D0F" },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 24,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#1C1C1E", alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFFFFF", writingDirection: "rtl" },

  card: {
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  fieldLabel: {
    fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#8E8E93",
    textAlign: "right", writingDirection: "rtl",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D0D0F",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    paddingHorizontal: 14,
    height: 50,
    gap: 8,
  },
  atSign: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#8E8E93" },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
    writingDirection: "rtl",
  },
  inputIcon: { width: 24, alignItems: "center" },

  hint: {
    fontSize: 12, fontFamily: "Inter_500Medium",
    textAlign: "right", writingDirection: "rtl",
  },
  hintGray: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: "#8E8E93",
    textAlign: "right", writingDirection: "rtl",
  },

  saveBtn: {
    backgroundColor: "#7C6EFA",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 16,
  },
  saveBtnDisabled: { backgroundColor: "#2C2C2E" },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFFFFF", writingDirection: "rtl" },

  savedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#34D39918",
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#34D39944",
    marginBottom: 16,
  },
  savedText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#34D399", writingDirection: "rtl" },

  currentWrap: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  currentLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#8E8E93", writingDirection: "rtl" },
  currentValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#7C6EFA" },
});
