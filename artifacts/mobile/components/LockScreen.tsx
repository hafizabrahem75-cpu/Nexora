import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppLock } from "@/context/AppLockContext";
import { useColors, useSettings } from "@/context/SettingsContext";

const PIN_LENGTH = 6;

const KEYS = [
  ["١", "٢", "٣"],
  ["٤", "٥", "٦"],
  ["٧", "٨", "٩"],
  ["bio", "٠", "del"],
];

const ARABIC_TO_DIGIT: Record<string, string> = {
  "١": "1", "٢": "2", "٣": "3",
  "٤": "4", "٥": "5", "٦": "6",
  "٧": "7", "٨": "8", "٩": "9",
  "٠": "0",
};

export default function LockScreen() {
  const insets = useSafeAreaInsets();
  const paddingTop = Platform.OS === "web" ? 67 : insets.top;
  const paddingBottom = Platform.OS === "web" ? 34 : insets.bottom;

  const { accent } = useSettings();
  const colors = useColors();
  const { unlock, unlockWithBiometric, biometricEnabled, hasBiometric, biometricType } = useAppLock();

  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const canUseBiometric = biometricEnabled && hasBiometric;

  useEffect(() => {
    if (canUseBiometric) {
      handleBiometric();
    }
  }, []);

  const handleBiometric = async () => {
    const ok = await unlockWithBiometric();
    if (!ok) {
      setErrorMsg("فشل التحقق البيومتري");
    }
  };

  const handleKey = async (key: string) => {
    if (key === "bio") {
      if (canUseBiometric) handleBiometric();
      return;
    }

    if (key === "del") {
      setPin((p) => p.slice(0, -1));
      setErrorMsg("");
      Haptics.selectionAsync();
      return;
    }

    const digit = ARABIC_TO_DIGIT[key];
    if (!digit) return;

    const next = pin + digit;
    setPin(next);
    Haptics.selectionAsync();

    if (next.length === PIN_LENGTH) {
      const ok = await unlock(next);
      if (!ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setShake(true);
        setErrorMsg("رمز PIN غير صحيح");
        setPin("");
        setTimeout(() => setShake(false), 600);
      }
    }
  };

  const biometricIcon = biometricType === "face" ? "aperture" : "activity";

  const containerBg = { backgroundColor: colors.bg };

  return (
    <View style={[styles.root, containerBg, { paddingTop, paddingBottom }]}>
      <View style={styles.header}>
        <View style={[styles.lockIcon, { backgroundColor: accent + "22", borderColor: accent + "44" }]}>
          <Feather name="lock" size={28} color={accent} />
        </View>
        <Text style={[styles.brandName, { color: colors.text }]}>Nexora</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          أدخل رمز PIN للمتابعة
        </Text>
      </View>

      <View style={[styles.dotsRow, shake && styles.dotsShake]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i < pin.length ? accent : colors.card,
                borderColor: i < pin.length ? accent : colors.border,
              },
            ]}
          />
        ))}
      </View>

      {errorMsg ? (
        <Text style={[styles.errorText, { color: "#FF453A" }]}>{errorMsg}</Text>
      ) : (
        <View style={{ height: 20 }} />
      )}

      <View style={styles.keypad}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((key) => {
              if (key === "bio") {
                return (
                  <Pressable
                    key="bio"
                    style={({ pressed }) => [
                      styles.keyBtn,
                      { backgroundColor: canUseBiometric ? accent + "18" : "transparent" },
                      pressed && canUseBiometric && { opacity: 0.7 },
                    ]}
                    onPress={() => handleKey("bio")}
                    disabled={!canUseBiometric}
                  >
                    {canUseBiometric ? (
                      <Feather name={biometricIcon} size={24} color={accent} />
                    ) : null}
                  </Pressable>
                );
              }

              if (key === "del") {
                return (
                  <Pressable
                    key="del"
                    style={({ pressed }) => [
                      styles.keyBtn,
                      { backgroundColor: colors.card },
                      pressed && { opacity: 0.6 },
                    ]}
                    onPress={() => handleKey("del")}
                    disabled={pin.length === 0}
                  >
                    <Feather name="delete" size={20} color={pin.length > 0 ? colors.text : colors.textTertiary} />
                  </Pressable>
                );
              }

              return (
                <Pressable
                  key={key}
                  style={({ pressed }) => [
                    styles.keyBtn,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    pressed && { backgroundColor: colors.cardAlt, transform: [{ scale: 0.94 }] },
                  ]}
                  onPress={() => handleKey(key)}
                >
                  <Text style={[styles.keyText, { color: colors.text }]}>{key}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  header: { alignItems: "center", gap: 12, marginBottom: 40 },
  lockIcon: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, marginBottom: 4,
  },
  brandName: { fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: -0.8 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", writingDirection: "rtl" },

  dotsRow: { flexDirection: "row", gap: 14, marginBottom: 12 },
  dotsShake: { transform: [{ translateX: 8 }] },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", height: 20, writingDirection: "rtl" },

  keypad: { gap: 12, marginTop: 20 },
  keyRow: { flexDirection: "row", gap: 12 },
  keyBtn: {
    width: 78, height: 78, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  keyText: { fontSize: 28, fontFamily: "Inter_600SemiBold" },
});
