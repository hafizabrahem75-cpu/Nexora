import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/context/ProfileContext";
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";

const AVATAR_COLORS = [
  "#7C6EFA","#34D399","#F59E0B","#3B82F6",
  "#EC4899","#EF4444","#06B6D4","#F97316",
];

async function loadCounts() {
  const [tasksRaw, goalsRaw, notesRaw] = await Promise.all([
    AsyncStorage.getItem("@nexora_tasks"),
    AsyncStorage.getItem("@nexora_goals"),
    AsyncStorage.getItem("@nexora_notes"),
  ]);
  return {
    tasks: tasksRaw ? (JSON.parse(tasksRaw) as any[]).length : 0,
    goals: goalsRaw ? (JSON.parse(goalsRaw) as any[]).length : 0,
    notes: notesRaw ? (JSON.parse(notesRaw) as any[]).length : 0,
  };
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { accent } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [counts, setCounts] = useState({ tasks: 0, goals: 0, notes: 0 });
  const [editModal, setEditModal] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [draftColor, setDraftColor] = useState(AVATAR_COLORS[0]);
  const [draftImageUri, setDraftImageUri] = useState<string | undefined>(undefined);
  const [pickingImage, setPickingImage] = useState(false);
  const nameRef = useRef<TextInput>(null);

  const displayName = user?.name ?? profile.name;
  const avatarColor = user?.avatarColor ?? profile.avatarColor;
  const avatarUri = user?.avatarImageUri ?? profile.avatarImageUri;
  const initial = displayName.trim()[0] ?? "N";

  useFocusEffect(useCallback(() => {
    loadCounts().then(setCounts);
  }, []));

  const openEdit = () => {
    setDraftName(displayName);
    setDraftBio(profile.bio ?? "");
    setDraftColor(avatarColor);
    setDraftImageUri(avatarUri ?? undefined);
    setEditModal(true);
    setTimeout(() => nameRef.current?.focus(), 150);
  };

  const saveEdit = async () => {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    await updateProfile({
      name: trimmed,
      bio: draftBio.trim(),
      avatarColor: draftColor,
      ...(draftImageUri ? { avatarImageUri: draftImageUri } : {}),
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditModal(false);
  };

  const pickImage = async () => {
    if (pickingImage) return;
    setPickingImage(true);
    try {
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setDraftImageUri(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
        Haptics.selectionAsync();
      }
    } catch { /* ignore */ }
    finally { setPickingImage(false); }
  };

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: 100 + bottom }]}
      >
        <View style={styles.pageHeader}>
          <Pressable
            style={[styles.settingsBtn, { backgroundColor: accent + "18", borderColor: accent + "33" }]}
            onPress={() => router.push("/settings" as any)}
          >
            <Feather name="settings" size={18} color={accent} />
          </Pressable>
          <Text style={styles.pageTitle}>الملف الشخصي</Text>
        </View>

        <View style={styles.hero}>
          <Pressable style={[styles.avatarRing, { borderColor: avatarColor + "55" }]} onPress={openEdit}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarCircle, { backgroundColor: avatarColor + "20" }]}>
                <Text style={[styles.avatarInitial, { color: avatarColor }]}>{initial}</Text>
              </View>
            )}
            <View style={[styles.editBadge, { backgroundColor: accent, borderColor: colors.bg }]}>
              <Feather name="camera" size={12} color="#FFFFFF" />
            </View>
          </Pressable>

          <Text style={styles.userName}>{displayName}</Text>

          {user?.username ? (
            <Text style={styles.userHandle}>@{user.username}</Text>
          ) : (
            <Pressable style={styles.usernameHint} onPress={() => router.push("/username" as any)}>
              <Feather name="at-sign" size={13} color={accent} />
              <Text style={[styles.usernameHintText, { color: accent }]}>تعيين اسم المستخدم</Text>
            </Pressable>
          )}

          {profile.bio ? (
            <Text style={styles.userBio}>{profile.bio}</Text>
          ) : (
            <Pressable onPress={openEdit}>
              <Text style={[styles.addBioText, { color: accent }]}>+ أضف نبذة عنك</Text>
            </Pressable>
          )}

          {user?.email ? <Text style={styles.userEmail}>{user.email}</Text> : null}

          <View style={styles.heroActions}>
            <Pressable
              style={({ pressed }) => [styles.heroBtn, { backgroundColor: accent + "18", borderColor: accent + "44" }, pressed && { opacity: 0.7 }]}
              onPress={openEdit}
            >
              <Feather name="edit-3" size={15} color={accent} />
              <Text style={[styles.heroBtnText, { color: accent }]}>تعديل</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.heroBtn, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
              onPress={() => router.push("/friends" as any)}
            >
              <Feather name="users" size={15} color={colors.textSecondary} />
              <Text style={styles.heroBtnTextGray}>الأصدقاء</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.heroBtn, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
              onPress={() => router.push("/search" as any)}
            >
              <Feather name="search" size={15} color={colors.textSecondary} />
              <Text style={styles.heroBtnTextGray}>بحث</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.statsRow}>
          {[
            { label: "المهام",    value: counts.tasks, icon: "check-square" as const, color: accent },
            { label: "الأهداف",  value: counts.goals, icon: "target"        as const, color: "#34D399" },
            { label: "الملاحظات",value: counts.notes, icon: "file-text"     as const, color: "#F59E0B" },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>معلومات الحساب</Text>
          <View style={styles.infoCard}>
            {user?.email && (
              <>
                <InfoRow icon="mail" label="البريد الإلكتروني" value={user.email} colors={colors} />
                <View style={styles.rowDivider} />
              </>
            )}
            <InfoRow icon="user" label="الاسم المعروض" value={displayName} colors={colors} />
            <View style={styles.rowDivider} />
            <Pressable onPress={() => router.push("/username" as any)}>
              <InfoRow icon="at-sign" label="اسم المستخدم" value={user?.username ? `@${user.username}` : "لم يُعيَّن"} action colors={colors} />
            </Pressable>
            <View style={styles.rowDivider} />
            <InfoRow
              icon="smartphone" label="النظام"
              value={Platform.OS === "web" ? "Web" : Platform.OS === "ios" ? "iOS" : "Android"}
              colors={colors}
            />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.settingsCard, pressed && { opacity: 0.75 }]}
          onPress={() => router.push("/settings" as any)}
        >
          <Feather name="chevron-left" size={18} color={colors.textTertiary} />
          <Text style={styles.settingsCardText}>الإعدادات والخصوصية</Text>
          <View style={[styles.settingsCardIcon, { backgroundColor: accent + "22" }]}>
            <Feather name="settings" size={18} color={accent} />
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.7 }]}
          onPress={async () => { await signOut(); router.replace("/"); }}
        >
          <Feather name="log-out" size={18} color="#FF453A" />
          <Text style={styles.signOutText}>تسجيل الخروج</Text>
        </Pressable>
      </ScrollView>

      <BottomNav active="profile" />

      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setEditModal(false)} />
        <KeyboardAvoidingView
          style={styles.sheetWrap}
          behavior={Platform.OS === "ios" ? "position" : "height"}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>تعديل الملف الشخصي</Text>

            <View style={styles.avatarPickerRow}>
              {draftImageUri ? (
                <Pressable style={styles.removeImgBtn} onPress={() => setDraftImageUri(undefined)}>
                  <Feather name="trash-2" size={13} color="#FF453A" />
                  <Text style={styles.removeImgText}>إزالة</Text>
                </Pressable>
              ) : <View style={{ width: 68 }} />}

              <Pressable style={styles.avatarPickerWrap} onPress={pickImage}>
                {draftImageUri ? (
                  <Image source={{ uri: draftImageUri }} style={styles.avatarPickerImg} />
                ) : (
                  <View style={[styles.avatarPickerCircle, { backgroundColor: draftColor + "22", borderColor: draftColor + "55" }]}>
                    <Text style={[styles.avatarPickerInitial, { color: draftColor }]}>
                      {draftName.trim()[0] ?? "N"}
                    </Text>
                  </View>
                )}
                <View style={[styles.cameraOverlay, { backgroundColor: accent, borderColor: colors.card }]}>
                  <Feather name="camera" size={13} color="#FFFFFF" />
                </View>
              </Pressable>

              <Pressable style={[styles.galleryBtn, { backgroundColor: accent + "18", borderColor: accent + "33" }]} onPress={pickImage}>
                <Feather name="image" size={13} color={accent} />
                <Text style={[styles.galleryBtnText, { color: accent }]}>معرض</Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>الاسم</Text>
            <TextInput
              ref={nameRef}
              style={styles.nameInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="أدخل اسمك..."
              placeholderTextColor={colors.placeholder}
              textAlign="right"
              maxLength={40}
            />

            <Text style={styles.fieldLabel}>نبذة عنك</Text>
            <TextInput
              style={[styles.nameInput, { height: 80, textAlignVertical: "top", paddingTop: 12 }]}
              value={draftBio}
              onChangeText={setDraftBio}
              placeholder="أخبر الناس عنك..."
              placeholderTextColor={colors.placeholder}
              textAlign="right"
              maxLength={160}
              multiline
            />

            <Text style={styles.fieldLabel}>لون الإطار</Text>
            <View style={styles.colorRow}>
              {AVATAR_COLORS.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.colorSwatch, { backgroundColor: c }, draftColor === c && styles.colorActive]}
                  onPress={() => { setDraftColor(c); Haptics.selectionAsync(); }}
                >
                  {draftColor === c && <Feather name="check" size={13} color="#FFFFFF" />}
                </Pressable>
              ))}
            </View>

            <View style={styles.sheetActions}>
              <Pressable style={[styles.sheetBtn, styles.cancelBtn]} onPress={() => setEditModal(false)}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </Pressable>
              <Pressable
                style={[styles.sheetBtn, { backgroundColor: accent }, !draftName.trim() && { opacity: 0.4 }]}
                onPress={saveEdit}
                disabled={!draftName.trim()}
              >
                <Text style={styles.saveBtnText}>حفظ</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function InfoRow({
  icon, label, value, action, colors,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  action?: boolean;
  colors: ThemeColors;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1, justifyContent: "flex-start" }}>
        <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textSecondary, writingDirection: "rtl", flexShrink: 1 }} numberOfLines={1}>{value}</Text>
        {action && <Feather name="chevron-left" size={14} color={colors.textTertiary} />}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.textSoft, writingDirection: "rtl" }}>{label}</Text>
        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }}>
          <Feather name={icon} size={14} color={colors.textSecondary} />
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingHorizontal: 20, paddingTop: 8 },

    pageHeader: {
      flexDirection: "row", alignItems: "center",
      justifyContent: "space-between", paddingBottom: 20,
    },
    pageTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.text, writingDirection: "rtl" },
    settingsBtn: {
      width: 38, height: 38, borderRadius: 11,
      alignItems: "center", justifyContent: "center", borderWidth: 1,
    },

    hero: { alignItems: "center", paddingBottom: 28, gap: 8 },
    avatarRing: {
      width: 120, height: 120, borderRadius: 60,
      borderWidth: 2.5, alignItems: "center", justifyContent: "center",
      marginBottom: 4, position: "relative",
    },
    avatarImage: { width: 116, height: 116, borderRadius: 58 },
    avatarCircle: { width: 112, height: 112, borderRadius: 56, alignItems: "center", justifyContent: "center" },
    avatarInitial: { fontSize: 44, fontFamily: "Inter_700Bold" },
    editBadge: {
      position: "absolute", bottom: 4, right: 4,
      width: 30, height: 30, borderRadius: 15,
      alignItems: "center", justifyContent: "center", borderWidth: 2,
    },

    userName: { fontSize: 24, fontFamily: "Inter_700Bold", color: colors.text, writingDirection: "rtl" },
    userHandle: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.textSecondary },
    usernameHint: { flexDirection: "row", alignItems: "center", gap: 4 },
    usernameHintText: { fontSize: 13, fontFamily: "Inter_500Medium", writingDirection: "rtl" },
    userBio: {
      fontSize: 14, fontFamily: "Inter_400Regular", color: colors.textSecondary,
      textAlign: "center", writingDirection: "rtl", maxWidth: 260, lineHeight: 21,
    },
    addBioText: { fontSize: 13, fontFamily: "Inter_500Medium", writingDirection: "rtl" },
    userEmail: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textTertiary },

    heroActions: { flexDirection: "row", gap: 10, marginTop: 4 },
    heroBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1,
    },
    heroBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", writingDirection: "rtl" },
    heroBtnTextGray: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.textSecondary, writingDirection: "rtl" },

    statsRow: {
      flexDirection: "row-reverse",
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border,
      marginBottom: 24, overflow: "hidden",
    },
    statCard: {
      flex: 1, alignItems: "center", paddingVertical: 16, gap: 4,
      borderRightWidth: 1, borderRightColor: colors.border,
    },
    statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
    statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: colors.textSecondary, writingDirection: "rtl" },

    section: { marginBottom: 16 },
    sectionTitle: {
      fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.textSecondary,
      textAlign: "right", writingDirection: "rtl",
      marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5, marginHorizontal: 4,
    },
    infoCard: {
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    rowDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },

    settingsCard: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 16, paddingVertical: 16,
      marginBottom: 12, gap: 12,
    },
    settingsCardText: {
      flex: 1, fontSize: 15, fontFamily: "Inter_500Medium",
      color: colors.textSoft, textAlign: "right", writingDirection: "rtl",
    },
    settingsCardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },

    signOutBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 10, backgroundColor: "#2C1515", borderRadius: 16,
      paddingVertical: 16, borderWidth: 1, borderColor: "#FF453A33", marginBottom: 8,
    },
    signOutText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FF453A", writingDirection: "rtl" },

    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)" },
    sheetWrap: { position: "absolute", bottom: 0, left: 0, right: 0 },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingTop: 12, paddingBottom: Platform.OS === "web" ? 34 : 44,
      paddingHorizontal: 20,
      borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border,
    },
    sheetHandle: {
      width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
      alignSelf: "center", marginBottom: 20,
    },
    sheetTitle: {
      fontSize: 18, fontFamily: "Inter_700Bold", color: colors.text,
      textAlign: "right", writingDirection: "rtl", marginBottom: 16,
    },

    avatarPickerRow: {
      flexDirection: "row", alignItems: "center",
      justifyContent: "space-between", marginBottom: 20,
    },
    avatarPickerWrap: {
      width: 90, height: 90, borderRadius: 45,
      alignItems: "center", justifyContent: "center", position: "relative",
    },
    avatarPickerImg: { width: 90, height: 90, borderRadius: 45 },
    avatarPickerCircle: {
      width: 90, height: 90, borderRadius: 45,
      borderWidth: 2, alignItems: "center", justifyContent: "center",
    },
    avatarPickerInitial: { fontSize: 34, fontFamily: "Inter_700Bold" },
    cameraOverlay: {
      position: "absolute", bottom: 0, right: 0,
      width: 28, height: 28, borderRadius: 14,
      alignItems: "center", justifyContent: "center", borderWidth: 2,
    },
    galleryBtn: {
      flexDirection: "column", alignItems: "center", gap: 5,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, width: 68,
    },
    galleryBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", writingDirection: "rtl" },
    removeImgBtn: {
      flexDirection: "column", alignItems: "center", gap: 5,
      backgroundColor: "#2C1515", borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, borderColor: "#FF453A33", width: 68,
    },
    removeImgText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#FF453A", writingDirection: "rtl" },

    fieldLabel: {
      fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.textSecondary,
      textAlign: "right", writingDirection: "rtl", marginBottom: 8,
    },
    nameInput: {
      backgroundColor: colors.bg, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 16, paddingVertical: 13,
      fontSize: 15, fontFamily: "Inter_400Regular", color: colors.text,
      marginBottom: 16, writingDirection: "rtl",
    },
    colorRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10, marginBottom: 22 },
    colorSwatch: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
    colorActive: { borderWidth: 3, borderColor: "#FFFFFF" },

    sheetActions: { flexDirection: "row", gap: 10 },
    sheetBtn: { flex: 1, borderRadius: 13, paddingVertical: 15, alignItems: "center" },
    cancelBtn: { backgroundColor: colors.border },
    cancelBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.textSoft, writingDirection: "rtl" },
    saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFFFFF", writingDirection: "rtl" },
  });
}
