import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { apiFetch } from "@/lib/api";

const ADMIN_SECRET = process.env.EXPO_PUBLIC_ADMIN_SECRET ?? "";

function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    headers: {
      "x-admin-secret": ADMIN_SECRET,
      ...(options.headers as Record<string, string>),
    },
  });
}

interface Stats {
  users: number;
  tasks: number;
  goals: number;
  notes: number;
  conversations: number;
  friendships: number;
  messages: number;
  supportSubmissions: number;
}

type ServerStatus = "checking" | "online" | "offline";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  username: string | null;
  emailVerified: boolean;
  suspendedAt: string | null;
  createdAt: string;
}

interface SupportTicket {
  id: string;
  userId: string;
  username: string | null;
  email: string;
  type: string;
  content: string;
  screenshotUri: string | null;
  createdAt: string;
}

type TabKey = "stats" | "tickets" | "users" | "announce";

const TABS: { key: TabKey; label: string; icon: React.ComponentProps<typeof Feather>["name"] }[] = [
  { key: "stats", label: "الإحصاء", icon: "bar-chart-2" },
  { key: "tickets", label: "التذاكر", icon: "inbox" },
  { key: "users", label: "المستخدمون", icon: "users" },
  { key: "announce", label: "إعلان", icon: "bell" },
];

const TICKET_TYPES = [
  { value: "", label: "الكل" },
  { value: "report", label: "بلاغ" },
  { value: "help", label: "مساعدة" },
  { value: "feature", label: "مقترح" },
  { value: "feedback", label: "تعليق" },
];

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;
  const { accent } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token, user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>("stats");
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("checking");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketFilter, setTicketFilter] = useState("");
  const [users2, setUsers2] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceBody, setAnnounceBody] = useState("");
  const [announcing, setAnnouncing] = useState(false);

  const isDev = !!user?.isDeveloper;

  useEffect(() => {
    if (!isDev) { router.replace("/settings" as any); }
  }, [isDev]);

  const checkServerStatus = useCallback(async () => {
    setServerStatus("checking");
    try {
      await adminFetch("/healthz");
      setServerStatus("online");
    } catch {
      setServerStatus("offline");
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    checkServerStatus();
    try {
      const data = await adminFetch<Stats>("/admin/stats");
      setStats(data);
    } catch (e: any) {
      Alert.alert("خطأ", e?.message ?? "فشل تحميل الإحصاءات");
    } finally { setStatsLoading(false); }
  }, [checkServerStatus]);

  const loadTickets = useCallback(async (typeFilter = ticketFilter) => {
    setTicketsLoading(true);
    try {
      const path = `/admin/support${typeFilter ? `?type=${typeFilter}` : ""}`;
      const data = await adminFetch<{ submissions: SupportTicket[] }>(path);
      setTickets(data.submissions);
    } catch (e: any) {
      Alert.alert("خطأ", e?.message ?? "فشل تحميل التذاكر");
    } finally { setTicketsLoading(false); }
  }, [ticketFilter]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const data = await adminFetch<{ users: AdminUser[] }>("/admin/users");
      setUsers2(data.users);
    } catch (e: any) {
      Alert.alert("خطأ", e?.message ?? "فشل تحميل المستخدمين");
    } finally { setUsersLoading(false); }
  }, []);

  useEffect(() => {
    if (!isDev) return;
    if (activeTab === "stats") loadStats();
    else if (activeTab === "tickets") loadTickets();
    else if (activeTab === "users") loadUsers();
  }, [activeTab, isDev]);

  const suspendUser = async (id: string, suspend: boolean) => {
    try {
      await adminFetch(`/admin/users/${id}/${suspend ? "suspend" : "unsuspend"}`, { method: "PATCH" });
      setUsers2((prev) => prev.map((u) => u.id === id ? { ...u, suspendedAt: suspend ? new Date().toISOString() : null } : u));
    } catch (e: any) { Alert.alert("خطأ", e?.message ?? "فشلت العملية"); }
  };

  const deleteUser = (id: string, name: string) => {
    Alert.alert("حذف المستخدم", `هل تريد حذف حساب "${name}"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        try {
          await adminFetch(`/admin/users/${id}`, { method: "DELETE" });
          setUsers2((prev) => prev.filter((u) => u.id !== id));
        } catch (e: any) { Alert.alert("خطأ", e?.message ?? "فشل الحذف"); }
      }},
    ]);
  };

  const deleteTicket = (id: string) => {
    Alert.alert("حذف التذكرة", "هل تريد حذف هذه التذكرة؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        try {
          await adminFetch(`/admin/content/support/${id}`, { method: "DELETE" });
          setTickets((prev) => prev.filter((t) => t.id !== id));
        } catch (e: any) { Alert.alert("خطأ", e?.message ?? "فشل الحذف"); }
      }},
    ]);
  };

  const sendAnnouncement = async () => {
    if (!announceTitle.trim() || !announceBody.trim()) return;
    setAnnouncing(true);
    try {
      const res = await adminFetch<{ ok: boolean; recipients: number }>("/admin/announce", {
        method: "POST",
        body: JSON.stringify({ title: announceTitle.trim(), body: announceBody.trim() }),
        headers: { "Content-Type": "application/json" },
      });
      Alert.alert("تم الإرسال", `تم إرسال الإعلان لـ ${res.recipients} مستخدم`);
      setAnnounceTitle(""); setAnnounceBody("");
    } catch (e: any) {
      Alert.alert("خطأ", e?.message ?? "فشل الإرسال");
    } finally { setAnnouncing(false); }
  };

  if (!isDev) return null;

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>لوحة المطور</Text>
        <View style={[styles.badge, { backgroundColor: "#34D39922" }]}>
          <Text style={[styles.badgeText, { color: "#34D399" }]}>DEV</Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tabBtn, active && { borderBottomColor: accent, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Feather name={tab.icon} size={16} color={active ? accent : colors.textTertiary} />
              <Text style={[styles.tabLabel, active && { color: accent }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === "stats" && (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Server status */}
          <View style={[styles.serverCard, {
            borderColor: serverStatus === "online" ? "#34D39944" : serverStatus === "offline" ? "#FF453A44" : colors.border,
          }]}>
            <View style={[styles.serverDot, {
              backgroundColor: serverStatus === "online" ? "#34D399" : serverStatus === "offline" ? "#FF453A" : colors.textTertiary,
            }]} />
            <Text style={[styles.serverLabel, { color: colors.textSecondary }]}>الخادم:</Text>
            <Text style={[styles.serverStatus, {
              color: serverStatus === "online" ? "#34D399" : serverStatus === "offline" ? "#FF453A" : colors.textSecondary,
            }]}>
              {serverStatus === "online" ? "متصل ✓" : serverStatus === "offline" ? "غير متصل ✗" : "جارٍ الفحص..."}
            </Text>
            <Pressable style={styles.refreshSmallBtn} onPress={() => { loadStats(); }} disabled={statsLoading}>
              {statsLoading
                ? <ActivityIndicator size="small" color={accent} />
                : <Feather name="refresh-cw" size={14} color={accent} />}
            </Pressable>
          </View>

          {statsLoading && !stats ? (
            <ActivityIndicator size="large" color={accent} style={{ marginTop: 40 }} />
          ) : stats ? (
            <View style={styles.statsGrid}>
              {[
                { label: "المستخدمون", value: stats.users,             icon: "users"          as const, color: accent    },
                { label: "المهام",     value: stats.tasks,             icon: "check-square"   as const, color: "#34D399" },
                { label: "الأهداف",   value: stats.goals,             icon: "target"         as const, color: "#F59E0B" },
                { label: "الملاحظات", value: stats.notes,             icon: "file-text"      as const, color: "#3B82F6" },
                { label: "المحادثات", value: stats.conversations,     icon: "message-circle" as const, color: "#EC4899" },
                { label: "الرسائل",   value: stats.messages,          icon: "send"           as const, color: "#22D3EE" },
                { label: "التذاكر",   value: stats.supportSubmissions, icon: "inbox"          as const, color: "#EF4444" },
              ].map((s) => (
                <View key={s.label} style={[styles.statCard, { borderColor: s.color + "33" }]}>
                  <View style={[styles.statIcon, { backgroundColor: s.color + "22" }]}>
                    <Feather name={s.icon} size={20} color={s.color} />
                  </View>
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value.toLocaleString("ar")}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Pressable style={[styles.reloadBtn, { borderColor: accent }]} onPress={loadStats}>
              <Text style={[styles.reloadText, { color: accent }]}>إعادة التحميل</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      {activeTab === "tickets" && (
        <View style={{ flex: 1 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {TICKET_TYPES.map((t) => {
              const active = ticketFilter === t.value;
              return (
                <Pressable
                  key={t.value}
                  style={[styles.filterChip, active && { backgroundColor: accent, borderColor: accent }]}
                  onPress={() => { setTicketFilter(t.value); loadTickets(t.value); }}
                >
                  <Text style={[styles.filterChipText, active && { color: "#FFFFFF" }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {ticketsLoading ? (
            <ActivityIndicator size="large" color={accent} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={tickets}
              keyExtractor={(t) => t.id}
              contentContainerStyle={styles.content}
              onRefresh={() => loadTickets()}
              refreshing={ticketsLoading}
              ListEmptyComponent={<Text style={styles.emptyText}>لا توجد تذاكر</Text>}
              renderItem={({ item }) => (
                <View style={styles.ticketCard}>
                  <View style={styles.ticketHeader}>
                    <Pressable onPress={() => deleteTicket(item.id)}>
                      <Feather name="trash-2" size={16} color="#FF453A" />
                    </Pressable>
                    <View style={styles.ticketMeta}>
                      <Text style={styles.ticketUser}>{item.username ?? item.email}</Text>
                      <View style={[styles.typeTag, { backgroundColor: accent + "22" }]}>
                        <Text style={[styles.typeTagText, { color: accent }]}>{item.type}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.ticketContent}>{item.content}</Text>
                  <Text style={styles.ticketTime}>{new Date(item.createdAt).toLocaleDateString("ar")}</Text>
                </View>
              )}
            />
          )}
        </View>
      )}

      {activeTab === "users" && (
        <View style={{ flex: 1 }}>
          {usersLoading ? (
            <ActivityIndicator size="large" color={accent} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={users2}
              keyExtractor={(u) => u.id}
              contentContainerStyle={styles.content}
              onRefresh={loadUsers}
              refreshing={usersLoading}
              ListEmptyComponent={<Text style={styles.emptyText}>لا يوجد مستخدمون</Text>}
              renderItem={({ item }) => (
                <View style={styles.userCard}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userEmail}>{item.email}</Text>
                    {item.suspendedAt && (
                      <View style={styles.suspendedTag}>
                        <Text style={styles.suspendedText}>موقوف</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.userActions}>
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: item.suspendedAt ? "#34D39922" : "#F59E0B22" }]}
                      onPress={() => suspendUser(item.id, !item.suspendedAt)}
                    >
                      <Feather name={item.suspendedAt ? "user-check" : "user-x"} size={14}
                        color={item.suspendedAt ? "#34D399" : "#F59E0B"} />
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: "#FF453A22" }]}
                      onPress={() => deleteUser(item.id, item.name)}
                    >
                      <Feather name="trash-2" size={14} color="#FF453A" />
                    </Pressable>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      )}

      {activeTab === "announce" && (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.announceLabel}>عنوان الإعلان</Text>
          <TextInput
            style={styles.announceInput}
            value={announceTitle}
            onChangeText={setAnnounceTitle}
            placeholder="مثال: تحديث جديد"
            placeholderTextColor={colors.textTertiary}
            textAlign="right"
            maxLength={200}
          />
          <Text style={styles.announceLabel}>نص الإعلان</Text>
          <TextInput
            style={[styles.announceInput, styles.announceTextArea]}
            value={announceBody}
            onChangeText={setAnnounceBody}
            placeholder="اكتب رسالتك هنا..."
            placeholderTextColor={colors.textTertiary}
            multiline
            textAlign="right"
            textAlignVertical="top"
            maxLength={2000}
          />
          <Pressable
            style={[styles.sendBtn, { backgroundColor: accent, opacity: announceTitle && announceBody ? 1 : 0.4 }]}
            onPress={sendAnnouncement}
            disabled={announcing || !announceTitle.trim() || !announceBody.trim()}
          >
            {announcing
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Text style={styles.sendBtnText}>إرسال لجميع المستخدمين</Text>}
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },

    header: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingHorizontal: 20, paddingBottom: 16,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: colors.card, alignItems: "center", justifyContent: "center",
    },
    headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: colors.text },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },

    tabBar: {
      flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
    },
    tabBtn: {
      flex: 1, alignItems: "center", paddingVertical: 12, gap: 4,
      borderBottomWidth: 2, borderBottomColor: "transparent",
    },
    tabLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: colors.textTertiary },

    content: { padding: 16, gap: 12, paddingBottom: 40 },

    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    statCard: {
      flex: 1, minWidth: "44%", padding: 16, borderRadius: 14,
      backgroundColor: colors.bgElevated, borderWidth: 1,
      alignItems: "center", gap: 8,
    },
    statIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    statValue: { fontSize: 28, fontFamily: "Inter_700Bold" },
    statLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.textSecondary },

    serverCard: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.card, borderRadius: 12, borderWidth: 1,
      paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4,
    },
    serverDot:    { width: 8, height: 8, borderRadius: 4 },
    serverLabel:  { fontSize: 13, fontFamily: "Inter_500Medium" },
    serverStatus: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right" },
    refreshSmallBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },

    reloadBtn: {
      marginTop: 40, alignSelf: "center", paddingHorizontal: 24, paddingVertical: 12,
      borderRadius: 12, borderWidth: 1.5,
    },
    reloadText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

    filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    filterChip: {
      paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.textSecondary },

    ticketCard: {
      backgroundColor: colors.bgElevated, borderRadius: 12, borderWidth: 1,
      borderColor: colors.borderSubtle, padding: 14, gap: 8,
    },
    ticketHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    ticketMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
    ticketUser: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.text },
    typeTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    typeTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
    ticketContent: {
      fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textSecondary,
      lineHeight: 18, textAlign: "right",
    },
    ticketTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.placeholder, textAlign: "right" },

    userCard: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.bgElevated, borderRadius: 12, borderWidth: 1,
      borderColor: colors.borderSubtle, padding: 14, gap: 12,
    },
    userInfo: { flex: 1, gap: 2 },
    userName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.text, textAlign: "right" },
    userEmail: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textTertiary, textAlign: "right" },
    suspendedTag: {
      backgroundColor: "#FF453A22", paddingHorizontal: 8, paddingVertical: 2,
      borderRadius: 6, alignSelf: "flex-end",
    },
    suspendedText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#FF453A" },
    userActions: { flexDirection: "row", gap: 8 },
    actionBtn: {
      width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center",
    },

    announceLabel: {
      fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.textSecondary,
      textAlign: "right", marginBottom: -4,
    },
    announceInput: {
      backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, fontFamily: "Inter_400Regular", color: colors.text,
    },
    announceTextArea: { minHeight: 120, paddingTop: 12 },
    sendBtn: { paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 8 },
    sendBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },

    emptyText: {
      textAlign: "center", color: colors.textTertiary,
      fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 40,
    },
  });
}
