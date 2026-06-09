import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
import { DS } from "@/constants/ds";
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

interface ApiTaskOrGoal {
  id: string;
  title: string;
  completed: boolean;
  reminderAt: string | null;
}

async function loadHomeCounts(token: string) {
  const [{ tasks }, { goals }, { notes }] = await Promise.all([
    apiFetch<{ tasks: ApiTaskOrGoal[] }>("/tasks", { token }),
    apiFetch<{ goals: ApiTaskOrGoal[] }>("/goals", { token }),
    apiFetch<{ notes: { id: string }[] }>("/notes", { token }),
  ]);
  const now = Date.now();
  const upcoming: ReminderItem[] = [
    ...tasks
      .filter((t) => t.reminderAt && new Date(t.reminderAt).getTime() > now && !t.completed)
      .map((t) => ({ id: t.id, title: t.title, reminderAt: new Date(t.reminderAt!).getTime(), type: "task" as const })),
    ...goals
      .filter((g) => g.reminderAt && new Date(g.reminderAt).getTime() > now && !g.completed)
      .map((g) => ({ id: g.id, title: g.title, reminderAt: new Date(g.reminderAt!).getTime(), type: "goal" as const })),
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
  const { accent, isDark } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [counts, setCounts] = React.useState({ tasks: 0, goals: 0, notes: 0 });
  const [upcoming, setUpcoming] = React.useState<ReminderItem[]>([]);
  const [conversations, setConversations] = React.useState<RecentConv[]>([]);

  const displayName = user?.name ?? profile.name;
  const avatarInitial = displayName.trim()[0] ?? "N";
  const avatarColor = user?.avatarColor ?? profile.avatarColor;
  const avatarUri = user?.avatarImageUri ?? profile.avatarImageUri;

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      loadHomeCounts(token)
        .then(({ tasks, goals, notes, upcoming: u }) => {
          setCounts({ tasks, goals, notes });
          setUpcoming(u);
        })
        .catch(() => {});
      apiFetch<{ conversations: RecentConv[] }>("/conversations", { token })
        .then((d) => setConversations(d.conversations.slice(0, 3)))
        .catch(() => {});
    }, [token])
  );

  const QUICK_ACTIONS = [
    { label: "مهامي",     icon: "check-square" as const, color: accent,      bg: accent + "18",   route: "/tasks"         },
    { label: "أهدافي",   icon: "target"        as const, color: "#34D399",   bg: "#34D39918",     route: "/goals"         },
    { label: "ملاحظاتي", icon: "file-text"     as const, color: "#F59E0B",   bg: "#F59E0B18",     route: "/notes"         },
    { label: "الرسائل",  icon: "message-circle" as const, color: "#3B82F6", bg: "#3B82F618",     route: "/conversations" },
  ];

  const STATS = [
    { label: "المهام",     value: counts.tasks, icon: "check-square" as const, color: accent     },
    { label: "الأهداف",   value: counts.goals, icon: "target"        as const, color: "#34D399" },
    { label: "الملاحظات", value: counts.notes, icon: "file-text"     as const, color: "#F59E0B" },
  ];

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + bottom }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Top Bar ── */}
        <View style={styles.topBar}>
          <Pressable style={styles.iconBtn} onPress={() => router.push("/conversations" as any)}>
            <Feather name="bell" size={18} color={colors.textSecondary} />
          </Pressable>

          <Text style={styles.brandName}>Nexora</Text>

          <Pressable onPress={() => router.push("/profile" as any)}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={[styles.topAvatar, { borderColor: avatarColor + "66" }]} />
            ) : (
              <View style={[styles.topAvatarCircle, { backgroundColor: avatarColor + "22", borderColor: avatarColor + "55" }]}>
                <Text style={[styles.topAvatarInitial, { color: avatarColor }]}>{avatarInitial}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* ── Hero Card ── */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={[accent + "22", accent + "08", "transparent"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroDecorRing} pointerEvents="none" />
          <View style={styles.heroContent}>
            <Text style={styles.heroGreeting}>{greeting()}،</Text>
            <Text style={styles.heroName}>{displayName} 👋</Text>
            {user?.username ? (
              <Text style={styles.heroHandle}>@{user.username}</Text>
            ) : null}
          </View>
        </View>

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          {STATS.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <View style={[styles.statTopStrip, { backgroundColor: s.color }]} />
              <View style={styles.statBody}>
                <View style={[styles.statIconWrap, { backgroundColor: s.color + "1E" }]}>
                  <Feather name={s.icon} size={15} color={s.color} />
                </View>
                <Text style={styles.statVal}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.section}>
          <SectionHeader title="إجراءات سريعة" accent={accent} />
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map((a) => (
              <Pressable
                key={a.label}
                style={({ pressed }) => [
                  styles.actionCard,
                  { backgroundColor: a.bg, borderColor: a.color + "35" },
                  pressed && { opacity: 0.72, transform: [{ scale: 0.96 }] },
                ]}
                onPress={() => router.push(a.route as any)}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: a.color + "28" }]}>
                  <Feather name={a.icon} size={24} color={a.color} />
                </View>
                <Text style={[styles.actionLabel, { color: a.color }]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Recent Messages ── */}
        {conversations.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="آخر الرسائل"
              accent={accent}
              right={
                <Pressable onPress={() => router.push("/conversations" as any)}>
                  <Text style={[styles.seeAll, { color: accent }]}>عرض الكل</Text>
                </Pressable>
              }
            />
            <View style={styles.listCard}>
              {conversations.map((conv, i) => {
                const other = conv.otherUser;
                if (!other) return null;
                const ini = other.name.trim()[0] ?? "?";
                return (
                  <React.Fragment key={conv.id}>
                    {i > 0 && <View style={styles.divider} />}
                    <Pressable
                      style={({ pressed }) => [styles.convRow, pressed && { opacity: 0.65 }]}
                      onPress={() => router.push(`/chat/${conv.id}` as any)}
                    >
                      {other.avatarImageUri ? (
                        <Image source={{ uri: other.avatarImageUri }} style={[styles.avatar, { borderColor: other.avatarColor + "55" }]} />
                      ) : (
                        <View style={[styles.avatarCircle, { backgroundColor: other.avatarColor + "22", borderColor: other.avatarColor + "55" }]}>
                          <Text style={[styles.avatarInitial, { color: other.avatarColor }]}>{ini}</Text>
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
                          <View style={[styles.badge, { backgroundColor: accent }]}>
                            <Text style={styles.badgeText}>{conv.unreadCount > 9 ? "9+" : conv.unreadCount}</Text>
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

        {/* ── Upcoming Reminders ── */}
        <View style={styles.section}>
          <SectionHeader title="التذكيرات القادمة" accent="#F59E0B" icon="bell" iconColor="#F59E0B" />

          {upcoming.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.cardAlt }]}>
                <Feather name="bell-off" size={22} color={colors.placeholder} />
              </View>
              <Text style={styles.emptyTitle}>لا توجد تذكيرات قادمة</Text>
              <Text style={styles.emptySub}>أضف تذكيرًا لأي مهمة أو هدف 🔔</Text>
            </View>
          ) : (
            <View style={styles.listCard}>
              {upcoming.map((item, i) => (
                <React.Fragment key={item.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <Pressable
                    style={({ pressed }) => [styles.reminderRow, pressed && { opacity: 0.7 }]}
                    onPress={() => router.push(item.type === "task" ? "/tasks" : "/goals")}
                  >
                    <View style={styles.reminderLeft}>
                      <Text style={styles.reminderTime}>{formatReminderLabel(item.reminderAt)}</Text>
                    </View>
                    <View style={styles.reminderRight}>
                      <Text style={styles.reminderTitle} numberOfLines={1}>{item.title}</Text>
                      <View style={styles.reminderBadgeRow}>
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
                    <Feather name="chevron-left" size={14} color={colors.placeholder} />
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

// ── Section Header Component ──────────────────────────────────────────────────
function SectionHeader({
  title,
  accent,
  icon,
  iconColor,
  right,
}: {
  title: string;
  accent: string;
  icon?: React.ComponentProps<typeof Feather>["name"];
  iconColor?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={sh.row}>
      {right ?? <View style={{ width: 48 }} />}
      <View style={sh.left}>
        <View style={[sh.accent, { backgroundColor: accent }]} />
        <View style={sh.titleRow}>
          {icon ? <Feather name={icon} size={13} color={iconColor ?? accent} style={{ marginLeft: 5 }} /> : null}
          <Text style={sh.title}>{title}</Text>
        </View>
      </View>
    </View>
  );
}

const sh = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: DS.spacing.md },
  left:     { flexDirection: "row", alignItems: "center", gap: DS.spacing.sm },
  accent:   { width: 3, height: 18, borderRadius: DS.radius.pill },
  titleRow: { flexDirection: "row", alignItems: "center" },
  title:    { fontSize: DS.font.size.lg, fontFamily: DS.font.family.semibold, color: "#FFFFFF", writingDirection: "rtl" },
});

// ── Main Styles ───────────────────────────────────────────────────────────────
function makeStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    root:          { flex: 1, backgroundColor: colors.bg },
    scroll:        { flex: 1 },
    scrollContent: { paddingHorizontal: DS.spacing.xl, paddingTop: DS.spacing.sm },

    // Top bar
    topBar: {
      flexDirection: "row", alignItems: "center",
      justifyContent: "space-between", marginBottom: DS.spacing.xxl,
    },
    brandName: {
      fontSize: DS.font.size.xl,
      fontFamily: DS.font.family.bold,
      color: colors.text,
      letterSpacing: -0.5,
    },
    iconBtn: {
      width: 38, height: 38, borderRadius: DS.radius.md,
      backgroundColor: colors.card,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: colors.border,
    },
    topAvatar:       { width: 38, height: 38, borderRadius: DS.radius.full, borderWidth: 1.5 },
    topAvatarCircle: { width: 38, height: 38, borderRadius: DS.radius.full, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
    topAvatarInitial:{ fontSize: 15, fontFamily: DS.font.family.bold },

    // Hero card
    heroCard: {
      borderRadius: DS.radius.xxl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: DS.spacing.xxl,
      overflow: "hidden",
      padding: DS.spacing.xxl,
      minHeight: 120,
      justifyContent: "flex-end",
    },
    heroDecorRing: {
      position: "absolute",
      width: 160,
      height: 160,
      borderRadius: DS.radius.full,
      borderWidth: 32,
      borderColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
      left: -60,
      top: -60,
    },
    heroContent:  { alignItems: "flex-end" },
    heroGreeting: {
      fontSize: DS.font.size.base,
      fontFamily: DS.font.family.regular,
      color: colors.textSecondary,
      writingDirection: "rtl",
      marginBottom: 2,
    },
    heroName: {
      fontSize: DS.font.size.xxl,
      fontFamily: DS.font.family.bold,
      color: colors.text,
      writingDirection: "rtl",
      letterSpacing: -0.5,
    },
    heroHandle: {
      fontSize: DS.font.size.sm,
      fontFamily: DS.font.family.regular,
      color: colors.textSecondary,
      marginTop: 4,
    },

    // Stats
    statsRow: {
      flexDirection: "row-reverse",
      gap: DS.spacing.sm,
      marginBottom: DS.spacing.section,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: DS.radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    statTopStrip: { height: 3, width: "100%" },
    statBody: {
      padding: DS.spacing.md,
      alignItems: "center",
      gap: DS.spacing.xs,
    },
    statIconWrap: {
      width: 34, height: 34, borderRadius: DS.radius.md,
      alignItems: "center", justifyContent: "center",
    },
    statVal:   { fontSize: DS.font.size.xl, fontFamily: DS.font.family.bold, color: colors.text },
    statLabel: { fontSize: DS.font.size.xxs, fontFamily: DS.font.family.medium, color: colors.textSecondary, writingDirection: "rtl", textAlign: "center" },

    // Section
    section: { marginBottom: DS.spacing.xxl },
    seeAll: { fontSize: DS.font.size.sm, fontFamily: DS.font.family.medium },

    // Actions grid
    actionsGrid: {
      flexDirection: "row-reverse",
      flexWrap: "wrap",
      gap: DS.spacing.sm,
    },
    actionCard: {
      width: "47%",
      borderRadius: DS.radius.xl,
      paddingVertical: DS.spacing.xl,
      paddingHorizontal: DS.spacing.md,
      alignItems: "center",
      gap: DS.spacing.md,
      borderWidth: 1,
    },
    actionIconWrap: {
      width: 54, height: 54, borderRadius: DS.radius.lg,
      alignItems: "center", justifyContent: "center",
    },
    actionLabel: { fontSize: DS.font.size.base, fontFamily: DS.font.family.semibold, writingDirection: "rtl" },

    // List card (messages + reminders share this)
    listCard: {
      backgroundColor: colors.card,
      borderRadius: DS.radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    divider: { height: 1, backgroundColor: colors.borderSubtle, marginHorizontal: DS.spacing.lg },

    // Conversation row
    convRow: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: DS.spacing.lg,
      paddingVertical: DS.spacing.md,
      gap: DS.spacing.md,
    },
    avatar:       { width: 44, height: 44, borderRadius: DS.radius.full, borderWidth: 1.5 },
    avatarCircle: { width: 44, height: 44, borderRadius: DS.radius.full, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
    avatarInitial:{ fontSize: 17, fontFamily: DS.font.family.bold },
    convInfo:     { flex: 1, alignItems: "flex-end", gap: 2 },
    convName:     { fontSize: DS.font.size.base, fontFamily: DS.font.family.semibold, color: colors.text, writingDirection: "rtl" },
    convPreview:  { fontSize: DS.font.size.sm,   fontFamily: DS.font.family.regular,  color: colors.textSecondary, writingDirection: "rtl" },
    convMeta:     { alignItems: "flex-end", gap: 4 },
    convTime:     { fontSize: DS.font.size.xxs, fontFamily: DS.font.family.regular, color: colors.textSecondary },
    badge:        { minWidth: 18, height: 18, borderRadius: DS.radius.full, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
    badgeText:    { fontSize: DS.font.size.xxs, fontFamily: DS.font.family.bold, color: "#FFFFFF" },

    // Empty state
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: DS.radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: DS.spacing.xxxl,
      alignItems: "center",
      gap: DS.spacing.sm,
    },
    emptyIconWrap:  { width: 52, height: 52, borderRadius: DS.radius.full, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    emptyTitle:     { fontSize: DS.font.size.md, fontFamily: DS.font.family.semibold, color: colors.textSoft, writingDirection: "rtl" },
    emptySub:       { fontSize: DS.font.size.sm, fontFamily: DS.font.family.regular,  color: colors.textSecondary, writingDirection: "rtl" },

    // Reminder row
    reminderRow: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: DS.spacing.lg,
      paddingVertical: DS.spacing.md,
      gap: DS.spacing.md,
    },
    reminderLeft:     { minWidth: 56, alignItems: "flex-start" },
    reminderTime:     { fontSize: DS.font.size.xs, fontFamily: DS.font.family.medium, color: "#F59E0B", writingDirection: "rtl" },
    reminderRight:    { flex: 1, alignItems: "flex-end", gap: 3 },
    reminderTitle:    { fontSize: DS.font.size.base, fontFamily: DS.font.family.medium, color: colors.text, writingDirection: "rtl" },
    reminderBadgeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    reminderType:     { fontSize: DS.font.size.xs, fontFamily: DS.font.family.medium, writingDirection: "rtl" },
  });
}
