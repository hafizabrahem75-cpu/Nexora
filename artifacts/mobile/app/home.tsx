import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/context/ProfileContext";
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";
import { formatReminderLabel } from "@/utils/notifications";

interface ReminderItem {
  id: string;
  title: string;
  reminderAt: number;
  type: "task" | "goal";
}

interface RecentConv {
  id: string;
  otherUser: { name: string; avatarColor: string; avatarImageUri: string | null } | null;
  lastMessage: { content: string; createdAt: string } | null;
  unreadCount: number;
}

async function loadHomeCounts() {
  const [tasksRaw, goalsRaw, notesRaw] = await Promise.all([
    AsyncStorage.getItem("@nexora_tasks"),
    AsyncStorage.getItem("@nexora_goals"),
    AsyncStorage.getItem("@nexora_notes"),
  ]);
  const tasks = tasksRaw ? (JSON.parse(tasksRaw) as any[]) : [];
  const goals = goalsRaw ? (JSON.parse(goalsRaw) as any[]) : [];
  const notes = notesRaw ? (JSON.parse(notesRaw) as any[]) : [];
  const now = Date.now();
  const upcoming: ReminderItem[] = [
    ...tasks.filter((t: any) => t.reminderAt && t.reminderAt > now && !t.completed)
      .map((t: any) => ({ id: t.id, title: t.title, reminderAt: t.reminderAt, type: "task" as const })),
    ...goals.filter((g: any) => g.reminderAt && g.reminderAt > now && !g.completed)
      .map((g: any) => ({ id: g.id, title: g.title, reminderAt: g.reminderAt, type: "goal" as const })),
  ].sort((a, b) => a.reminderAt - b.reminderAt).slice(0, 3);
  return { tasks: tasks.length, goals: goals.length, notes: notes.length, upcoming };
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return "مساء الخير";
  if (h < 12) return "صباح الخير";
  if (h < 18) return "مرحباً";
  return "مساء الخير";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "الآن";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}د`;
  if (diff < 86_400_000) return d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ar", { month: "short", day: "numeric" });
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  const { user, token } = useAuth();
  const { profile } = useProfile();
  const { accent } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [counts, setCounts] = React.useState({ tasks: 0, goals: 0, notes: 0 });
  const [upcoming, setUpcoming] = React.useState<ReminderItem[]>([]);
  const [conversations, setConversations] = React.useState<RecentConv[]>([]);

  const displayName = user?.name ?? profile.name;
  const avatarInitial = displayName.trim()[0] ?? "N";
  const avatarColor = user?.avatarColor ?? profile.avatarColor;
  const avatarUri = user?.avatarImageUri ?? profile.avatarImageUri;

  useFocusEffect(
    useCallback(() => {
      loadHomeCounts().then(({ tasks, goals, notes, upcoming: u }) => {
        setCounts({ tasks, goals, notes });
        setUpcoming(u);
      });
      if (token) {
        apiFetch<{ conversations: RecentConv[] }>("/conversations", { token })
          .then((d) => setConversations(d.conversations.slice(0, 3)))
          .catch(() => {});
      }
    }, [token])
  );

  const QUICK_ACTIONS = [
    { label: "مهامي",    icon: "check-square" as const, color: accent,    bg: accent + "15", route: "/tasks" },
    { label: "أهدافي",  icon: "target"        as const, color: "#34D399", bg: "#34D39915",  route: "/goals" },
    { label: "ملاحظاتي",icon: "file-text"     as const, color: "#F59E0B", bg: "#F59E0B15",  route: "/notes" },
    { label: "الرسائل", icon: "message-circle" as const, color: "#3B82F6", bg: "#3B82F615",  route: "/conversations" },
  ];

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable style={styles.notifBtn} onPress={() => router.push("/conversations" as any)}>
            <Feather name="bell" size={20} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.brandName}>Nexora</Text>
          <Pressable onPress={() => router.push("/profile" as any)}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={[styles.topAvatar, { borderColor: avatarColor + "66" }]} />
            ) : (
              <View style={[styles.topAvatarCircle, { backgroundColor: avatarColor + "20", borderColor: avatarColor + "55" }]}>
                <Text style={[styles.topAvatarInitial, { color: avatarColor }]}>{avatarInitial}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.greetSmall}>{greeting()}،</Text>
          <Text style={styles.greetName}>{displayName} 👋</Text>
          {user?.username ? (
            <Text style={styles.greetHandle}>@{user.username}</Text>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          {[
            { label: "المهام",    value: counts.tasks, icon: "check-square" as const, color: accent },
            { label: "الأهداف",  value: counts.goals, icon: "target"        as const, color: "#34D399" },
            { label: "الملاحظات",value: counts.notes, icon: "file-text"     as const, color: "#F59E0B" },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: s.color + "20" }]}>
                <Feather name={s.icon} size={16} color={s.color} />
              </View>
              <Text style={styles.statVal}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map((a) => (
              <Pressable
                key={a.label}
                style={({ pressed }) => [
                  styles.actionCard,
                  { backgroundColor: a.bg, borderColor: a.color + "30" },
                  pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] },
                ]}
                onPress={() => router.push(a.route as any)}
              >
                <View style={[styles.actionIcon, { backgroundColor: a.color + "25" }]}>
                  <Feather name={a.icon} size={22} color={a.color} />
                </View>
                <Text style={[styles.actionLabel, { color: a.color }]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {conversations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Pressable onPress={() => router.push("/conversations" as any)}>
                <Text style={[styles.seeAll, { color: accent }]}>عرض الكل</Text>
              </Pressable>
              <Text style={styles.sectionTitle}>آخر الرسائل</Text>
            </View>
            <View style={styles.convCard}>
              {conversations.map((conv, i) => {
                const other = conv.otherUser;
                if (!other) return null;
                const ini = other.name.trim()[0] ?? "?";
                return (
                  <React.Fragment key={conv.id}>
                    {i > 0 && <View style={styles.convSep} />}
                    <Pressable
                      style={({ pressed }) => [styles.convRow, pressed && { opacity: 0.7 }]}
                      onPress={() => router.push(`/chat/${conv.id}` as any)}
                    >
                      {other.avatarImageUri ? (
                        <Image source={{ uri: other.avatarImageUri }} style={[styles.convAvatar, { borderColor: other.avatarColor + "55" }]} />
                      ) : (
                        <View style={[styles.convAvatarCircle, { backgroundColor: other.avatarColor + "22", borderColor: other.avatarColor + "55" }]}>
                          <Text style={[styles.convAvatarInitial, { color: other.avatarColor }]}>{ini}</Text>
                        </View>
                      )}
                      <View style={styles.convInfo}>
                        <Text style={styles.convName} numberOfLines={1}>{other.name}</Text>
                        <Text style={styles.convPreview} numberOfLines={1}>
                          {conv.lastMessage?.content ?? "ابدأ المحادثة"}
                        </Text>
                      </View>
                      <View style={styles.convMeta}>
                        {conv.lastMessage ? (
                          <Text style={styles.convTime}>{formatTime(conv.lastMessage.createdAt)}</Text>
                        ) : null}
                        {conv.unreadCount > 0 && (
                          <View style={[styles.unreadBadge, { backgroundColor: accent }]}>
                            <Text style={styles.unreadText}>{conv.unreadCount > 9 ? "9+" : conv.unreadCount}</Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <View style={{ width: 50 }} />
            <View style={styles.sectionTitleRow}>
              <Feather name="bell" size={14} color="#F59E0B" />
              <Text style={styles.sectionTitle}>التذكيرات القادمة</Text>
            </View>
          </View>

          {upcoming.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="bell-off" size={24} color={colors.placeholder} />
              <Text style={styles.emptyTitle}>لا توجد تذكيرات قادمة</Text>
              <Text style={styles.emptySub}>أضف تذكيرًا لأي مهمة أو هدف 🔔</Text>
            </View>
          ) : (
            <View style={styles.reminderCard}>
              {upcoming.map((item, i) => (
                <React.Fragment key={item.id}>
                  {i > 0 && <View style={styles.convSep} />}
                  <Pressable
                    style={({ pressed }) => [styles.reminderRow, pressed && { opacity: 0.75 }]}
                    onPress={() => router.push(item.type === "task" ? "/tasks" : "/goals")}
                  >
                    <View style={styles.reminderLeft}>
                      <Text style={styles.reminderTime}>{formatReminderLabel(item.reminderAt)}</Text>
                    </View>
                    <View style={styles.reminderRight}>
                      <Text style={styles.reminderTitle} numberOfLines={1}>{item.title}</Text>
                      <View style={styles.reminderBadge}>
                        <Feather
                          name={item.type === "task" ? "check-square" : "target"}
                          size={10}
                          color={item.type === "task" ? accent : "#34D399"}
                        />
                        <Text style={[styles.reminderType, { color: item.type === "task" ? accent : "#34D399" }]}>
                          {item.type === "task" ? "مهمة" : "هدف"}
                        </Text>
                      </View>
                    </View>
                    <Feather name="chevron-left" size={15} color={colors.placeholder} />
                  </Pressable>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <BottomNav active="home" />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 8 },

    topBar: {
      flexDirection: "row", alignItems: "center",
      justifyContent: "space-between", marginBottom: 24,
    },
    brandName: { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.text, letterSpacing: -0.5 },
    notifBtn: {
      width: 38, height: 38, borderRadius: 11,
      backgroundColor: colors.card, alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: colors.border,
    },
    topAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5 },
    topAvatarCircle: {
      width: 38, height: 38, borderRadius: 19,
      borderWidth: 1.5, alignItems: "center", justifyContent: "center",
    },
    topAvatarInitial: { fontSize: 15, fontFamily: "Inter_700Bold" },

    hero: { alignItems: "flex-end", marginBottom: 28 },
    greetSmall: { fontSize: 16, fontFamily: "Inter_400Regular", color: colors.textSecondary, writingDirection: "rtl" },
    greetName: { fontSize: 30, fontFamily: "Inter_700Bold", color: colors.text, writingDirection: "rtl", marginTop: 2 },
    greetHandle: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.textSecondary, marginTop: 2 },

    statsRow: { flexDirection: "row-reverse", gap: 10, marginBottom: 28 },
    statCard: {
      flex: 1, backgroundColor: colors.card, borderRadius: 16,
      padding: 14, alignItems: "center", gap: 6,
      borderWidth: 1, borderColor: colors.border,
    },
    statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    statVal: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.text },
    statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: colors.textSecondary, writingDirection: "rtl", textAlign: "center" },

    section: { marginBottom: 24 },
    sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    sectionTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: colors.text, writingDirection: "rtl" },
    seeAll: { fontSize: 13, fontFamily: "Inter_500Medium", writingDirection: "rtl" },

    actionsGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
    actionCard: {
      width: "47%", borderRadius: 16, padding: 16,
      alignItems: "center", gap: 10, borderWidth: 1,
    },
    actionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    actionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", writingDirection: "rtl" },

    convCard: {
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    convRow: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 14, paddingVertical: 12, gap: 12,
    },
    convSep: { height: 1, backgroundColor: colors.border, marginHorizontal: 14 },
    convAvatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5 },
    convAvatarCircle: {
      width: 46, height: 46, borderRadius: 23,
      borderWidth: 1.5, alignItems: "center", justifyContent: "center",
    },
    convAvatarInitial: { fontSize: 18, fontFamily: "Inter_700Bold" },
    convInfo: { flex: 1, alignItems: "flex-end", gap: 3 },
    convName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.text, writingDirection: "rtl" },
    convPreview: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textSecondary, writingDirection: "rtl" },
    convMeta: { alignItems: "flex-end", gap: 4 },
    convTime: { fontSize: 10, fontFamily: "Inter_400Regular", color: colors.textSecondary },
    unreadBadge: {
      minWidth: 18, height: 18, borderRadius: 9,
      alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
    },
    unreadText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#FFFFFF" },

    emptyCard: {
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border,
      paddingVertical: 28, alignItems: "center", gap: 8,
    },
    emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.textSoft, writingDirection: "rtl" },
    emptySub: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textSecondary, writingDirection: "rtl" },

    reminderCard: {
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    reminderRow: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 14, paddingVertical: 13, gap: 12,
    },
    reminderLeft: { minWidth: 60, alignItems: "flex-start" },
    reminderTime: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#F59E0B", writingDirection: "rtl" },
    reminderRight: { flex: 1, alignItems: "flex-end", gap: 4 },
    reminderTitle: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.text, writingDirection: "rtl" },
    reminderBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
    reminderType: { fontSize: 11, fontFamily: "Inter_500Medium", writingDirection: "rtl" },
  });
}
