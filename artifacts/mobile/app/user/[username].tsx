import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors, useSettings, useT } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";

interface UserProfile {
  id: string;
  name: string;
  username: string | null;
  avatarColor: string;
  avatarImageUri: string | null;
}

type FriendStatus = "none" | "pending" | "friends";

export default function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  const { username } = useLocalSearchParams<{ username: string }>();
  const { token, user: me } = useAuth();
  const { accent } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>("none");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!username) return;
    async function load() {
      setLoading(true);
      try {
        const data = await apiFetch<{ user: UserProfile }>(
          `/users/${encodeURIComponent(username as string)}`,
          { token: token ?? undefined },
        );
        setProfile(data.user);
        if (token && data.user) {
          try {
            const [friendsRes, requestsRes] = await Promise.all([
              apiFetch<{ friends: { id: string }[] }>("/friends", { token }),
              apiFetch<{ incoming: any[]; outgoing: any[] }>("/friends/requests", { token }),
            ]);
            const isFriend = friendsRes.friends.some((f) => f.id === data.user.id);
            const isPending = requestsRes.outgoing.some((r) => r.receiverId === data.user.id);
            setFriendStatus(isFriend ? "friends" : isPending ? "pending" : "none");
          } catch { /* ignore */ }
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [username, token]);

  const sendFriendRequest = async () => {
    if (!token || !profile) return;
    setActionLoading(true);
    try {
      await apiFetch("/friends/request", {
        method: "POST", body: JSON.stringify({ receiverId: profile.id }), token,
      });
      setFriendStatus("pending");
    } catch { /* already sent */ } finally {
      setActionLoading(false);
    }
  };

  const startChat = async () => {
    if (!token || !profile) return;
    setActionLoading(true);
    try {
      const data = await apiFetch<{ conversationId: string }>("/conversations", {
        method: "POST", body: JSON.stringify({ friendId: profile.id }), token,
      });
      router.push(`/chat/${data.conversationId}` as any);
    } catch { /* ignore */ } finally {
      setActionLoading(false);
    }
  };

  const initial = profile?.name.trim()[0] ?? "?";
  const isMe = me?.id === profile?.id;

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-right" size={20} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      </View>
    );
  }

  if (notFound || !profile) {
    return (
      <View style={[styles.root, { paddingTop: top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-right" size={20} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Feather name="user-x" size={48} color={colors.placeholder} />
          <Text style={styles.notFoundTitle}>المستخدم غير موجود</Text>
          <Text style={styles.notFoundSub}>تحقق من اسم المستخدم وأعد المحاولة</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {profile.username ? `@${profile.username}` : profile.name}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: 40 + bottom }]}
      >
        <View style={styles.avatarSection}>
          {profile.avatarImageUri ? (
            <Image source={{ uri: profile.avatarImageUri }} style={[styles.avatar, { borderColor: profile.avatarColor }]} />
          ) : (
            <View style={[styles.avatarCircle, { backgroundColor: profile.avatarColor + "22", borderColor: profile.avatarColor }]}>
              <Text style={[styles.avatarInitial, { color: profile.avatarColor }]}>{initial}</Text>
            </View>
          )}
          <Text style={styles.name}>{profile.name}</Text>
          {profile.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}
        </View>

        {!isMe && (
          <View style={styles.actions}>
            {friendStatus === "friends" ? (
              <Pressable style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={startChat} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                  <>
                    <Feather name="message-circle" size={16} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>{t.profile.message}</Text>
                  </>
                )}
              </Pressable>
            ) : friendStatus === "pending" ? (
              <View style={[styles.actionBtn, styles.actionBtnDisabled]}>
                <Feather name="clock" size={16} color={colors.textSecondary} />
                <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>{t.profile.requestSent}</Text>
              </View>
            ) : (
              <Pressable style={[styles.actionBtn, { backgroundColor: accent }]} onPress={sendFriendRequest} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                  <>
                    <Feather name="user-plus" size={16} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>{t.profile.addFriend}</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        )}

        {isMe && (
          <View style={styles.actions}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: accent }]}
              onPress={() => { router.back(); setTimeout(() => router.push("/profile" as any), 50); }}
            >
              <Feather name="edit-3" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>{t.profile.editProfile}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Feather name="user" size={15} color={colors.textSecondary} />
            <Text style={styles.cardLabel}>{t.auth.name}</Text>
            <Text style={styles.cardValue}>{profile.name}</Text>
          </View>
          {profile.username ? (
            <>
              <View style={styles.cardDiv} />
              <View style={styles.cardRow}>
                <Feather name="at-sign" size={15} color={colors.textSecondary} />
                <Text style={styles.cardLabel}>اسم المستخدم</Text>
                <Text style={styles.cardValue}>@{profile.username}</Text>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },

    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingBottom: 16,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: colors.card, alignItems: "center", justifyContent: "center",
    },
    headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: colors.text },

    scroll: { paddingHorizontal: 20, paddingTop: 16, alignItems: "center" },

    avatarSection: { alignItems: "center", gap: 10, marginBottom: 24 },
    avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 2.5 },
    avatarCircle: {
      width: 100, height: 100, borderRadius: 50, borderWidth: 2.5,
      alignItems: "center", justifyContent: "center",
    },
    avatarInitial: { fontSize: 38, fontFamily: "Inter_700Bold" },
    name: { fontSize: 24, fontFamily: "Inter_700Bold", color: colors.text, textAlign: "center" },
    handle: { fontSize: 15, fontFamily: "Inter_400Regular", color: colors.textSecondary },

    actions: { flexDirection: "row", gap: 12, marginBottom: 24, width: "100%" },
    actionBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, paddingVertical: 14, borderRadius: 12,
    },
    actionBtnSecondary: { backgroundColor: "#1C2A4A" },
    actionBtnDisabled: { backgroundColor: colors.card },
    actionBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },

    card: {
      width: "100%", backgroundColor: colors.bgElevated, borderRadius: 14,
      borderWidth: 1, borderColor: colors.borderSubtle, overflow: "hidden",
    },
    cardRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingHorizontal: 16, paddingVertical: 14,
    },
    cardLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.textSecondary, flex: 1, textAlign: "right" },
    cardValue: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.text },
    cardDiv: { height: 1, backgroundColor: colors.borderSubtle, marginHorizontal: 16 },

    notFoundTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: colors.text, textAlign: "center" },
    notFoundSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.textSecondary, textAlign: "center" },
  });
}
