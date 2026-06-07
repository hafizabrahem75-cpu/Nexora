import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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
import { useAuth } from "@/context/AuthContext";
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";
import { addWsListener } from "@/lib/ws";

type FriendTab = "friends" | "incoming" | "outgoing";

interface SocialUser {
  id: string;
  name: string;
  username: string | null;
  avatarColor: string;
  avatarImageUri: string | null;
}

interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: string;
  createdAt: string;
  sender?: SocialUser;
  receiver?: SocialUser;
}

function Avatar({ user, size = 44 }: { user: SocialUser; size?: number }) {
  const initial = user.name.trim()[0] ?? "?";
  return user.avatarImageUri ? (
    <Image
      source={{ uri: user.avatarImageUri }}
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: user.avatarColor + "55" }}
    />
  ) : (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: user.avatarColor + "22",
        borderWidth: 1.5, borderColor: user.avatarColor + "55",
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.38, fontFamily: "Inter_700Bold", color: user.avatarColor }}>{initial}</Text>
    </View>
  );
}

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;
  const { token } = useAuth();
  const { accent } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors, accent), [colors, accent]);

  const [tab, setTab] = useState<FriendTab>("friends");
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        apiFetch<{ friends: SocialUser[] }>("/friends", { token }),
        apiFetch<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>("/friends/requests", { token }),
      ]);
      setFriends(friendsRes.friends);
      setIncoming(requestsRes.incoming);
      setOutgoing(requestsRes.outgoing);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  React.useEffect(() => {
    return addWsListener((event) => {
      if (event.type === "friend_request" || event.type === "friend_accepted") {
        loadData();
      }
    });
  }, [loadData]);

  const acceptRequest = async (requestId: string) => {
    if (!token) return;
    setActingOn(requestId);
    try {
      await apiFetch(`/friends/accept/${requestId}`, { method: "POST", token });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadData();
    } catch {
    } finally {
      setActingOn(null);
    }
  };

  const rejectRequest = async (requestId: string) => {
    if (!token) return;
    setActingOn(requestId);
    try {
      await apiFetch(`/friends/reject/${requestId}`, { method: "POST", token });
      await loadData();
    } catch {
    } finally {
      setActingOn(null);
    }
  };

  const cancelRequest = async (requestId: string) => {
    if (!token) return;
    setActingOn(requestId);
    try {
      await apiFetch(`/friends/request/${requestId}`, { method: "DELETE", token });
      await loadData();
    } catch {
    } finally {
      setActingOn(null);
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!token) return;
    setActingOn(friendId);
    try {
      await apiFetch(`/friends/${friendId}`, { method: "DELETE", token });
      await loadData();
    } catch {
    } finally {
      setActingOn(null);
    }
  };

  const startChat = async (friendId: string) => {
    if (!token) return;
    try {
      const data = await apiFetch<{ conversationId: string }>("/conversations", {
        method: "POST",
        body: JSON.stringify({ friendId }),
        token,
      });
      router.push(`/chat/${data.conversationId}` as any);
    } catch {
      /* ignore */
    }
  };

  const TABS: { key: FriendTab; label: string; count?: number }[] = [
    { key: "friends", label: "الأصدقاء", count: friends.length },
    { key: "incoming", label: "الواردة", count: incoming.length },
    { key: "outgoing", label: "الصادرة", count: outgoing.length },
  ];

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>الأصدقاء</Text>
        <Pressable
          style={styles.searchBtn}
          onPress={() => router.push("/search" as any)}
        >
          <Feather name="user-plus" size={20} color={accent} />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
              {t.count ? ` (${t.count})` : ""}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : tab === "friends" ? (
        <FlatList
          data={friends}
          keyExtractor={(f) => f.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="users" size={40} color={colors.border} />
              <Text style={styles.emptyTitle}>لا يوجد أصدقاء بعد</Text>
              <Pressable style={styles.findBtn} onPress={() => router.push("/search" as any)}>
                <Text style={styles.findBtnText}>ابحث عن أصدقاء</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar user={item} />
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{item.name}</Text>
                {item.username ? <Text style={styles.rowHandle}>@{item.username}</Text> : null}
              </View>
              <View style={styles.rowActions}>
                {item.username ? (
                  <Pressable style={styles.viewBtn} onPress={() => router.push(`/user/${item.username}` as any)}>
                    <Feather name="user" size={16} color={accent} />
                  </Pressable>
                ) : null}
                <Pressable style={styles.chatBtn} onPress={() => startChat(item.id)}>
                  <Feather name="message-square" size={16} color="#34D399" />
                </Pressable>
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => removeFriend(item.id)}
                  disabled={actingOn === item.id}
                >
                  {actingOn === item.id ? (
                    <ActivityIndicator size="small" color="#FF453A" />
                  ) : (
                    <Feather name="user-minus" size={16} color="#FF453A" />
                  )}
                </Pressable>
              </View>
            </View>
          )}
        />
      ) : tab === "incoming" ? (
        <FlatList
          data={incoming}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={40} color={colors.border} />
              <Text style={styles.emptyTitle}>لا توجد طلبات واردة</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.sender ? <Avatar user={item.sender} /> : null}
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{item.sender?.name ?? "—"}</Text>
                {item.sender?.username ? <Text style={styles.rowHandle}>@{item.sender.username}</Text> : null}
              </View>
              <View style={styles.rowActions}>
                <Pressable
                  style={styles.acceptBtn}
                  onPress={() => acceptRequest(item.id)}
                  disabled={actingOn === item.id}
                >
                  {actingOn === item.id ? (
                    <ActivityIndicator size="small" color="#34D399" />
                  ) : (
                    <Feather name="check" size={16} color="#34D399" />
                  )}
                </Pressable>
                <Pressable
                  style={styles.rejectBtn}
                  onPress={() => rejectRequest(item.id)}
                  disabled={actingOn === item.id}
                >
                  <Feather name="x" size={16} color="#FF453A" />
                </Pressable>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={outgoing}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="send" size={40} color={colors.border} />
              <Text style={styles.emptyTitle}>لا توجد طلبات صادرة</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.receiver ? <Avatar user={item.receiver} /> : null}
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{item.receiver?.name ?? "—"}</Text>
                {item.receiver?.username ? <Text style={styles.rowHandle}>@{item.receiver.username}</Text> : null}
              </View>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => cancelRequest(item.id)}
                disabled={actingOn === item.id}
              >
                {actingOn === item.id ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : (
                  <Text style={styles.cancelBtnText}>إلغاء</Text>
                )}
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors, accent: string) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingBottom: 16,
      gap: 12,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: colors.card, alignItems: "center", justifyContent: "center",
    },
    title: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", color: colors.text, writingDirection: "rtl" },
    searchBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: accent + "18", alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: accent + "44",
    },

    tabs: { flexDirection: "row-reverse", paddingHorizontal: 20, gap: 8, marginBottom: 16 },
    tabBtn: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    tabBtnActive: { backgroundColor: accent + "22", borderColor: accent + "44" },
    tabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.textSecondary, writingDirection: "rtl" },
    tabTextActive: { color: accent, fontFamily: "Inter_600SemiBold" },

    list: { paddingHorizontal: 20, paddingBottom: 20 },
    sep: { height: 1, backgroundColor: colors.border },

    row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 12 },
    rowText: { flex: 1, alignItems: "flex-end" },
    rowName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.text, writingDirection: "rtl" },
    rowHandle: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textSecondary },
    rowActions: { flexDirection: "row", gap: 8 },

    chatBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: "#34D39918", alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: "#34D39944",
    },
    acceptBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: "#34D39918", alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: "#34D39944",
    },
    rejectBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: "#FF453A18", alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: "#FF453A44",
    },
    removeBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: "#FF453A18", alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: "#FF453A44",
    },
    cancelBtn: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
      backgroundColor: colors.border,
    },
    cancelBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.textSecondary, writingDirection: "rtl" },
    viewBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: accent + "18", alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: accent + "44",
    },

    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
    emptyTitle: { fontSize: 15, fontFamily: "Inter_500Medium", color: colors.textSecondary, writingDirection: "rtl" },
    findBtn: {
      backgroundColor: accent + "22", borderRadius: 12,
      paddingHorizontal: 20, paddingVertical: 10,
      borderWidth: 1, borderColor: accent + "44",
    },
    findBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: accent, writingDirection: "rtl" },
  });
}
