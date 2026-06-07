import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/context/AuthContext";
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";
import { addWsListener } from "@/lib/ws";

interface OtherUser {
  conversationId: string;
  id: string;
  name: string;
  username: string | null;
  avatarColor: string;
  avatarImageUri: string | null;
}

interface LastMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

interface ConversationItem {
  id: string;
  otherUser: OtherUser | null;
  lastMessage: LastMessage | null;
  unreadCount: number;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "الآن";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}د`;
  if (diff < 86_400_000) return d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
  if (diff < 7 * 86_400_000) {
    const days = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
    return days[d.getDay()] ?? "";
  }
  return d.toLocaleDateString("ar", { month: "short", day: "numeric" });
}

export default function ConversationsScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;
  const { token, user } = useAuth();
  const { accent } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ conversations: ConversationItem[] }>("/conversations", { token });
      setConversations(data.conversations);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token]);

  useFocusEffect(useCallback(() => { loadConversations(); }, [loadConversations]));

  useEffect(() => {
    return addWsListener((event) => {
      if (event.type === "new_message") loadConversations();
    });
  }, [loadConversations]);

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  const renderItem = ({ item }: { item: ConversationItem }) => {
    const other = item.otherUser;
    if (!other) return null;
    const initial = other.name.trim()[0] ?? "?";
    const isMe = item.lastMessage?.senderId === user?.id;

    return (
      <Pressable
        style={({ pressed }) => [styles.convRow, pressed && { backgroundColor: colors.bgElevated }]}
        onPress={() => router.push(`/chat/${item.id}` as any)}
      >
        <View style={styles.avatarWrap}>
          {other.avatarImageUri ? (
            <Image source={{ uri: other.avatarImageUri }} style={[styles.avatar, { borderColor: other.avatarColor + "55" }]} />
          ) : (
            <View style={[styles.avatarCircle, { backgroundColor: other.avatarColor + "22", borderColor: other.avatarColor + "55" }]}>
              <Text style={[styles.avatarInitial, { color: other.avatarColor }]}>{initial}</Text>
            </View>
          )}
          <View style={[styles.onlineDot, { borderColor: colors.bg }]} />
        </View>

        <View style={styles.convBody}>
          <View style={styles.convTop}>
            <Text style={styles.convTime}>{item.lastMessage ? formatTime(item.lastMessage.createdAt) : ""}</Text>
            <Text style={[styles.convName, item.unreadCount > 0 && { color: colors.text }]} numberOfLines={1}>
              {other.name}
            </Text>
          </View>
          <View style={styles.convBottom}>
            {item.unreadCount > 0 ? (
              <View style={[styles.unreadBadge, { backgroundColor: accent }]}>
                <Text style={styles.unreadText}>{item.unreadCount > 9 ? "9+" : item.unreadCount}</Text>
              </View>
            ) : (
              isMe ? <Feather name="check" size={14} color={colors.textTertiary} /> : <View style={{ width: 14 }} />
            )}
            <Text
              style={[styles.convPreview, item.unreadCount > 0 && { color: colors.textSoft, fontFamily: "Inter_500Medium" }]}
              numberOfLines={1}
            >
              {isMe ? `أنت: ${item.lastMessage?.content ?? ""}` : (item.lastMessage?.content ?? "ابدأ المحادثة")}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <View style={styles.header}>
        <Pressable
          style={[styles.addBtn, { backgroundColor: accent + "18", borderColor: accent + "44" }]}
          onPress={() => router.push("/friends" as any)}
        >
          <Feather name="user-plus" size={18} color={accent} />
        </Pressable>
        <Text style={styles.title}>الرسائل</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Feather name="message-circle" size={40} color={colors.placeholder} />
          </View>
          <Text style={styles.emptyTitle}>لا توجد رسائل بعد</Text>
          <Text style={styles.emptySub}>أضف أصدقاء وابدأ المحادثة</Text>
          <Pressable
            style={[styles.findBtn, { backgroundColor: accent + "18", borderColor: accent + "44" }]}
            onPress={() => router.push("/friends" as any)}
          >
            <Feather name="users" size={15} color={accent} />
            <Text style={[styles.findBtnText, { color: accent }]}>البحث عن أصدقاء</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: 90 + bottom }]}
        />
      )}

      <BottomNav active="messages" unreadMessages={totalUnread} />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    title: { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.text, writingDirection: "rtl" },
    addBtn: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1,
    },

    list: {},

    convRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 14,
      gap: 14,
    },

    avatarWrap: { position: "relative" },
    avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5 },
    avatarCircle: {
      width: 56, height: 56, borderRadius: 28,
      borderWidth: 1.5, alignItems: "center", justifyContent: "center",
    },
    avatarInitial: { fontSize: 22, fontFamily: "Inter_700Bold" },
    onlineDot: {
      position: "absolute", bottom: 2, right: 2,
      width: 12, height: 12, borderRadius: 6,
      backgroundColor: colors.border, borderWidth: 2,
    },

    convBody: { flex: 1, gap: 5 },
    convTop: {
      flexDirection: "row", alignItems: "center",
      justifyContent: "space-between",
    },
    convName: { fontSize: 15, fontFamily: "Inter_500Medium", color: colors.textSecondary, writingDirection: "rtl", flex: 1, textAlign: "right" },
    convTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.textTertiary },
    convBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    convPreview: {
      fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textTertiary,
      flex: 1, textAlign: "right", writingDirection: "rtl",
    },
    unreadBadge: {
      minWidth: 20, height: 20, borderRadius: 10,
      alignItems: "center", justifyContent: "center", paddingHorizontal: 5,
    },
    unreadText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#FFFFFF" },

    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
    emptyIconWrap: {
      width: 80, height: 80, borderRadius: 24,
      backgroundColor: colors.card, alignItems: "center", justifyContent: "center",
      marginBottom: 4, borderWidth: 1, borderColor: colors.border,
    },
    emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: colors.textSoft, writingDirection: "rtl" },
    emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textSecondary, writingDirection: "rtl", textAlign: "center" },
    findBtn: {
      flexDirection: "row", alignItems: "center", gap: 8,
      borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12,
      borderWidth: 1, marginTop: 4,
    },
    findBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", writingDirection: "rtl" },
  });
}
