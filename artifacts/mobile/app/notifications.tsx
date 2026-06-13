import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/context/AuthContext";
import { useNotifications, type AppNotification } from "@/context/NotificationsContext";
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

function dateKey(iso: string): string {
  return new Date(iso).toDateString();
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86_400_000 && d.getDate() === now.getDate()) return "اليوم";
  if (diff < 2 * 86_400_000) return "أمس";
  return d.toLocaleDateString("ar", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function notifIcon(type: AppNotification["type"]): React.ComponentProps<typeof Feather>["name"] {
  switch (type) {
    case "new_message":    return "message-circle";
    case "friend_request": return "user-plus";
    case "friend_accepted":return "users";
    case "announcement":   return "bell";
    case "post_liked":     return "heart";
    case "post_commented": return "message-square";
  }
}

function notifIconColor(type: AppNotification["type"], accent: string): string {
  switch (type) {
    case "new_message":    return accent;
    case "friend_request": return "#F59E0B";
    case "friend_accepted":return "#34D399";
    case "announcement":   return "#3B82F6";
    case "post_liked":     return "#EF4444";
    case "post_commented": return "#10B981";
  }
}

interface NotifSection {
  title: string;
  dateKey: string;
  data: AppNotification[];
}

function groupByDate(items: AppNotification[]): NotifSection[] {
  const map = new Map<string, NotifSection>();
  for (const n of items) {
    const key = dateKey(n.createdAt);
    if (!map.has(key)) {
      map.set(key, { title: dateLabel(n.createdAt), dateKey: key, data: [] });
    }
    map.get(key)!.data.push(n);
  }
  return Array.from(map.values());
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;
  const { token } = useAuth();
  const { accent } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { notifications, unreadCount, loading, fetchNotifications, markRead } = useNotifications();

  const sections = useMemo(() => groupByDate(notifications), [notifications]);

  const handleTap = useCallback(
    async (notif: AppNotification) => {
      if (!notif.read && token) {
        await markRead(token, [notif.id]);
      }
      const data = notif.data as Record<string, string> | null | undefined;
      if (notif.type === "new_message" && data?.conversationId) {
        router.push(`/chat/${data.conversationId}` as any);
      } else if (notif.type === "friend_request" || notif.type === "friend_accepted") {
        router.push("/friends" as any);
      } else if (notif.type === "post_liked" || notif.type === "post_commented") {
        router.push("/community" as any);
      }
    },
    [token, markRead],
  );

  const handleMarkAll = useCallback(async () => {
    if (!token || unreadCount === 0) return;
    await markRead(token, "all");
  }, [token, unreadCount, markRead]);

  const handleRefresh = useCallback(() => {
    if (token) fetchNotifications(token);
  }, [token, fetchNotifications]);

  const renderItem = ({ item }: { item: AppNotification }) => {
    const iconColor = notifIconColor(item.type, accent);
    return (
      <Pressable
        style={({ pressed }) => [
          styles.item,
          !item.read && styles.itemUnread,
          pressed && { opacity: 0.75 },
        ]}
        onPress={() => handleTap(item)}
      >
        <View style={[styles.iconWrap, { backgroundColor: iconColor + "22" }]}>
          <Feather name={notifIcon(item.type)} size={18} color={iconColor} />
        </View>
        <View style={styles.itemBody}>
          <View style={styles.itemTop}>
            <Text style={styles.itemTime}>{formatRelativeTime(item.createdAt)}</Text>
            {!item.read && <View style={[styles.dot, { backgroundColor: accent }]} />}
          </View>
          <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.itemText} numberOfLines={2}>{item.body}</Text>
        </View>
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section }: { section: NotifSection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الإشعارات</Text>
        {unreadCount > 0 && (
          <Pressable style={styles.markAllBtn} onPress={handleMarkAll}>
            <Text style={[styles.markAllText, { color: accent }]}>تحديد الكل كمقروء</Text>
          </Pressable>
        )}
      </View>

      {loading && notifications.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.list}
          onRefresh={handleRefresh}
          refreshing={loading}
          stickySectionHeadersEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: accent + "22" }]}>
                <Feather name="bell" size={32} color={accent} />
              </View>
              <Text style={styles.emptyTitle}>لا توجد إشعارات</Text>
              <Text style={styles.emptySub}>ستظهر الإشعارات الجديدة هنا</Text>
            </View>
          }
        />
      )}

      <BottomNav active="notifications" />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingBottom: 16,
    },
    headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: colors.text },
    markAllBtn: { paddingHorizontal: 4, paddingVertical: 4 },
    markAllText: { fontSize: 13, fontFamily: "Inter_500Medium" },

    list: { paddingBottom: 100 },
    sep: { height: 1, backgroundColor: colors.borderSubtle, marginHorizontal: 16 },

    sectionHeader: {
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
      backgroundColor: colors.bg,
    },
    sectionTitle: {
      fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.textSecondary,
      letterSpacing: 0.6, textTransform: "uppercase", textAlign: "right",
    },

    item: {
      flexDirection: "row", alignItems: "flex-start", gap: 14,
      paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.bg,
    },
    itemUnread: { backgroundColor: colors.bgElevated },

    iconWrap: {
      width: 42, height: 42, borderRadius: 12,
      alignItems: "center", justifyContent: "center", flexShrink: 0,
    },
    itemBody: { flex: 1, gap: 3 },
    itemTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    itemTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.textTertiary },
    dot: { width: 8, height: 8, borderRadius: 4 },
    itemTitle: {
      fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.text,
      textAlign: "right", writingDirection: "rtl",
    },
    itemText: {
      fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textSecondary,
      lineHeight: 18, textAlign: "right", writingDirection: "rtl",
    },

    empty: { alignItems: "center", paddingTop: 100, gap: 12 },
    emptyIcon: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: colors.text },
    emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.textTertiary },
  });
}
