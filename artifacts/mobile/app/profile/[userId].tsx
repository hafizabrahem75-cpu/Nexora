import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
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
import { useAuth } from "@/context/AuthContext";
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileUser {
  id: string;
  name: string;
  username: string | null;
  avatarColor: string;
  avatarImageUri: string | null;
  createdAt: string;
}

interface ProfileStats {
  postsCount: number;
  friendsCount: number;
  followersCount: number;
}

interface PostAuthor {
  id: string;
  name: string;
  username: string;
  avatarColor: string;
  avatarImageUri: string | null;
}

interface Post {
  id: string;
  content: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  createdAt: string;
  author: PostAuthor;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar", { year: "numeric", month: "long" });
}

function formatRelativeDate(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `منذ ${days} أيام`;
  return new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
}

function initials(name: string): string {
  return (name?.trim() || "؟").charAt(0).toUpperCase();
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function UserAvatar({
  avatarColor,
  avatarImageUri,
  name,
  size,
}: {
  avatarColor: string;
  avatarImageUri: string | null;
  name: string;
  size: number;
}) {
  if (avatarImageUri) {
    return (
      <Image
        source={{ uri: avatarImageUri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColor,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: size * 0.38,
          fontFamily: "Inter_700Bold",
          color: "#FFFFFF",
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;

  const { token, user: me } = useAuth();
  const { accent } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const isOwnProfile = me?.id === userId;

  useEffect(() => {
    if (!token || !userId) return;
    setLoadingProfile(true);
    apiFetch<{ user: ProfileUser; stats: ProfileStats }>(`/users/profile/${userId}`, { token })
      .then(({ user, stats: s }) => {
        setProfileUser(user);
        setStats(s);
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, [token, userId]);

  useEffect(() => {
    if (!token || !userId) return;
    setLoadingPosts(true);
    apiFetch<{ posts: Post[] }>(`/users/profile/${userId}/posts`, { token })
      .then(({ posts: data }) => setPosts(data))
      .catch(() => {})
      .finally(() => setLoadingPosts(false));
  }, [token, userId]);

  const openChat = useCallback(async () => {
    if (!token || !userId) return;
    setChatLoading(true);
    setChatError(null);
    try {
      const { conversationId } = await apiFetch<{ conversationId: string }>(
        "/conversations",
        { method: "POST", token, body: JSON.stringify({ friendId: userId }) },
      );
      router.push(`/chat/${conversationId}` as any);
    } catch (e: any) {
      setChatError(e?.message ?? "لا يمكن فتح المحادثة");
    } finally {
      setChatLoading(false);
    }
  }, [token, userId]);

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <Text style={styles.postDate}>{formatRelativeDate(item.createdAt)}</Text>
        </View>
        <Text style={styles.postContent}>{item.content}</Text>
        <View style={styles.postFooter}>
          <View style={styles.postStat}>
            <Feather name="message-circle" size={13} color={colors.placeholder} />
            <Text style={styles.postStatText}>{item.commentsCount}</Text>
          </View>
          <View style={styles.postStat}>
            <Feather
              name="heart"
              size={13}
              color={item.isLiked ? "#EF4444" : colors.placeholder}
            />
            <Text style={[styles.postStatText, item.isLiked && { color: "#EF4444" }]}>
              {item.likesCount}
            </Text>
          </View>
        </View>
      </View>
    ),
    [styles, colors],
  );

  const ListHeader = useMemo(() => {
    if (loadingProfile || !profileUser) return null;
    return (
      <View style={styles.profileSection}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <UserAvatar
            avatarColor={profileUser.avatarColor}
            avatarImageUri={profileUser.avatarImageUri}
            name={profileUser.name}
            size={80}
          />
        </View>

        {/* Name + username */}
        <Text style={styles.displayName}>{profileUser.name}</Text>
        {profileUser.username ? (
          <Text style={styles.handle}>@{profileUser.username}</Text>
        ) : null}

        {/* Join date */}
        <View style={styles.joinRow}>
          <Feather name="calendar" size={12} color={colors.textTertiary} />
          <Text style={styles.joinText}>انضم في {formatJoinDate(profileUser.createdAt)}</Text>
        </View>

        {/* Stats */}
        {stats && (
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={[styles.statValue, { color: accent }]}>{stats.postsCount}</Text>
              <Text style={styles.statLabel}>منشور</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statChip}>
              <Text style={[styles.statValue, { color: accent }]}>{stats.friendsCount}</Text>
              <Text style={styles.statLabel}>صديق</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statChip}>
              <Text style={[styles.statValue, { color: accent }]}>{stats.followersCount}</Text>
              <Text style={styles.statLabel}>متابع</Text>
            </View>
          </View>
        )}

        {/* Chat button */}
        {!isOwnProfile && (
          <View style={styles.actionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.chatBtn,
                { backgroundColor: accent },
                pressed && { opacity: 0.8 },
                chatLoading && { opacity: 0.6 },
              ]}
              onPress={openChat}
              disabled={chatLoading}
            >
              {chatLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="message-circle" size={15} color="#fff" />
                  <Text style={styles.chatBtnText}>مراسلة</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {chatError ? (
          <Text style={styles.chatError}>{chatError}</Text>
        ) : null}

        {/* Posts section header */}
        <View style={styles.postsSectionHeader}>
          <Text style={styles.postsSectionTitle}>المنشورات</Text>
        </View>
      </View>
    );
  }, [loadingProfile, profileUser, stats, styles, colors, accent, isOwnProfile, chatLoading, chatError, openChat]);

  if (loadingProfile) {
    return (
      <View style={[styles.root, { paddingTop: top }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="arrow-right" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      </View>
    );
  }

  if (!profileUser) {
    return (
      <View style={[styles.root, { paddingTop: top }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="arrow-right" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>المستخدم غير موجود</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-right" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {profileUser.username ? `@${profileUser.username}` : profileUser.name}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loadingPosts ? (
            <View style={styles.postsLoader}>
              <ActivityIndicator size="small" color={accent} />
            </View>
          ) : (
            <View style={styles.postsEmpty}>
              <Text style={styles.postsEmptyText}>لا توجد منشورات بعد</Text>
            </View>
          )
        }
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    errorText: { fontSize: 15, fontFamily: "Inter_400Regular", color: colors.textSecondary },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 12,
      paddingTop: 4,
    },
    topBarTitle: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.text,
      writingDirection: "rtl",
      maxWidth: 200,
    },

    listContent: { paddingBottom: 60 },

    profileSection: {
      alignItems: "center",
      paddingHorizontal: 20,
      paddingBottom: 8,
      gap: 6,
    },
    avatarWrap: {
      marginBottom: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
    displayName: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.text,
      writingDirection: "rtl",
      textAlign: "center",
    },
    handle: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.textTertiary,
      writingDirection: "ltr",
    },
    joinRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 2,
    },
    joinText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.textTertiary,
      writingDirection: "rtl",
    },

    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      paddingHorizontal: 24,
      gap: 0,
      marginTop: 10,
      alignSelf: "stretch",
    },
    statChip: { flex: 1, alignItems: "center", gap: 2 },
    statDivider: {
      width: 1,
      height: 30,
      backgroundColor: colors.border,
    },
    statValue: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
    },
    statLabel: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.textTertiary,
      writingDirection: "rtl",
    },

    actionsRow: {
      flexDirection: "row",
      marginTop: 6,
      gap: 10,
      alignSelf: "stretch",
    },
    chatBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      borderRadius: 14,
      paddingVertical: 12,
    },
    chatBtnText: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: "#FFFFFF",
      writingDirection: "rtl",
    },
    chatError: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: "#EF4444",
      writingDirection: "rtl",
      textAlign: "center",
    },

    postsSectionHeader: {
      alignSelf: "stretch",
      paddingTop: 20,
      paddingBottom: 6,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
      marginTop: 12,
    },
    postsSectionTitle: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.textSecondary,
      writingDirection: "rtl",
      textAlign: "right",
      letterSpacing: 0.5,
    },

    postCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 10,
    },
    postHeader: {
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    postDate: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
      writingDirection: "rtl",
    },
    postContent: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.textSoft,
      writingDirection: "rtl",
      lineHeight: 22,
      textAlign: "right",
    },
    postFooter: {
      flexDirection: "row",
      gap: 14,
      paddingTop: 2,
    },
    postStat: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 4,
    },
    postStatText: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.placeholder,
    },

    postsLoader: { paddingVertical: 32, alignItems: "center" },
    postsEmpty: { paddingVertical: 32, alignItems: "center" },
    postsEmptyText: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.textTertiary,
      writingDirection: "rtl",
    },
  });
}
