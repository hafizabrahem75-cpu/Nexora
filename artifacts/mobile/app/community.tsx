import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomNav from "@/components/BottomNav";
import CommentsSheet from "@/components/CommentsSheet";
import { useAuth } from "@/context/AuthContext";
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";
import { addWsListener } from "@/lib/ws";

const COMMUNITY_COLOR = "#10B981";

// ─── Types ────────────────────────────────────────────────────────────────────

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

function formatRelativeDate(iso: string): string {
  const now = Date.now();
  const ms = now - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1)  return "الآن";
  if (minutes < 60) return `منذ ${minutes} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days < 7)     return `منذ ${days} أيام`;
  return new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
}

function initials(name: string): string {
  return (name?.trim() || "؟").charAt(0).toUpperCase();
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ author, size = 38 }: { author: PostAuthor; size?: number }) {
  if (author.avatarImageUri) {
    return (
      <Image
        source={{ uri: author.avatarImageUri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: author.avatarColor || COMMUNITY_COLOR,
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.38, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
        {initials(author.name)}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 0 : insets.top;

  const { token, user } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [posts, setPosts]               = useState<Post[]>([]);
  const [loading, setLoading]           = useState(true);
  const [composerText, setComposerText] = useState("");
  const [posting, setPosting]           = useState(false);
  const [openPostId, setOpenPostId]     = useState<string | null>(null);

  const inputRef = useRef<TextInput>(null);

  // ── Load posts on focus ────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      setLoading(true);
      apiFetch<{ posts: Post[] }>("/community/posts", { token })
        .then(({ posts: data }) => setPosts(data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [token])
  );

  // ── Real-time like updates ─────────────────────────────────────────────────
  useEffect(() => {
    const remove = addWsListener((event) => {
      if (event.type === "post_liked") {
        const { postId, likesCount } = event.payload as { postId: string; likesCount: number };
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, likesCount } : p))
        );
      }
    });
    return remove;
  }, []);

  // ── Comments count sync from CommentsSheet ─────────────────────────────────
  const handleCommentsCountChange = useCallback((postId: string, commentsCount: number) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, commentsCount } : p))
    );
  }, []);

  // ── Toggle like (optimistic) ───────────────────────────────────────────────
  const toggleLike = useCallback(async (postId: string, isLiked: boolean) => {
    if (!token) return;

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, isLiked: !isLiked, likesCount: p.likesCount + (isLiked ? -1 : 1) }
          : p
      )
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (isLiked) {
        await apiFetch(`/community/posts/${postId}/like`, { method: "DELETE", token });
      } else {
        await apiFetch(`/community/posts/${postId}/like`, { method: "POST", token });
      }
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, isLiked, likesCount: p.likesCount + (isLiked ? 1 : -1) }
            : p
        )
      );
    }
  }, [token]);

  // ── Create post ───────────────────────────────────────────────────────────
  const submitPost = async () => {
    const content = composerText.trim();
    if (!content || !token || posting) return;

    setPosting(true);
    try {
      const { post } = await apiFetch<{ post: Post }>("/community/posts", {
        method: "POST",
        token,
        body: JSON.stringify({ content }),
      });
      setPosts((prev) => [post, ...prev]);
      setComposerText("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      inputRef.current?.blur();
    } catch {
      // silent
    } finally {
      setPosting(false);
    }
  };

  // ── Post card ─────────────────────────────────────────────────────────────
  const renderPost = useCallback(({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      {/* Header */}
      <View style={styles.postHeader}>
        <View style={styles.postMeta}>
          <Text style={styles.postDate}>{formatRelativeDate(item.createdAt)}</Text>
          <Pressable
            style={styles.postAuthorInfo}
            onPress={() => router.push(`/profile/${item.author.id}` as any)}
            hitSlop={6}
          >
            <Text style={styles.postAuthorName}>{item.author.name}</Text>
            <Text style={styles.postAuthorHandle}>@{item.author.username}</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => router.push(`/profile/${item.author.id}` as any)} hitSlop={6}>
          <Avatar author={item.author} size={38} />
        </Pressable>
      </View>

      {/* Content */}
      <Text style={styles.postContent}>{item.content}</Text>

      {/* Footer */}
      <View style={styles.postFooter}>
        {/* Comments button */}
        <Pressable
          style={styles.postStat}
          onPress={() => setOpenPostId(item.id)}
          hitSlop={8}
        >
          <Feather name="message-circle" size={14} color={colors.placeholder} />
          <Text style={styles.postStatText}>{item.commentsCount}</Text>
        </Pressable>

        {/* Like button */}
        <Pressable
          style={styles.postStat}
          onPress={() => toggleLike(item.id, item.isLiked)}
          hitSlop={8}
        >
          <Feather
            name="heart"
            size={14}
            color={item.isLiked ? "#EF4444" : colors.placeholder}
          />
          <Text style={[styles.postStatText, item.isLiked && styles.postStatLiked]}>
            {item.likesCount}
          </Text>
        </Pressable>
      </View>
    </View>
  ), [styles, colors, toggleLike]);

  // ── Composer (list header) ────────────────────────────────────────────────
  const ListHeader = (
    <View style={styles.composer}>
      <View style={styles.composerRow}>
        {user ? (
          <Avatar
            author={{
              id: user.id,
              name: user.name ?? "",
              username: user.username ?? "",
              avatarColor: user.avatarColor ?? COMMUNITY_COLOR,
              avatarImageUri: (user.avatarImageUri as string | null | undefined) ?? null,
            }}
            size={36}
          />
        ) : null}
        <TextInput
          ref={inputRef}
          style={styles.composerInput}
          value={composerText}
          onChangeText={setComposerText}
          placeholder="شارك شيئاً مع المجتمع..."
          placeholderTextColor={colors.placeholder}
          textAlign="right"
          multiline
          maxLength={5000}
          textAlignVertical="top"
        />
      </View>
      <View style={styles.composerActions}>
        <Text style={styles.composerCount}>{composerText.length}/5000</Text>
        <Pressable
          style={({ pressed }) => [
            styles.publishBtn,
            !composerText.trim() && styles.publishBtnDisabled,
            pressed && composerText.trim() && { opacity: 0.8 },
          ]}
          onPress={submitPost}
          disabled={!composerText.trim() || posting}
        >
          {posting
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Text style={styles.publishBtnText}>نشر</Text>}
        </Pressable>
      </View>
    </View>
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  const EmptyState = (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        <Feather name="users" size={30} color={colors.placeholder} />
      </View>
      <Text style={styles.emptyTitle}>لا توجد منشورات بعد</Text>
      <Text style={styles.emptySubtitle}>كن أول من يشارك المجتمع شيئاً!</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerChip}>
          <Text style={styles.headerChipText}>{posts.length}</Text>
        </View>
        <Text style={styles.headerTitle}>المجتمع</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COMMUNITY_COLOR} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={EmptyState}
          contentContainerStyle={[
            styles.listContent,
            posts.length === 0 && styles.listEmpty,
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      <BottomNav active="community" />

      {/* Comments bottom sheet */}
      <CommentsSheet
        postId={openPostId}
        onClose={() => setOpenPostId(null)}
        onCommentsCountChange={handleCommentsCountChange}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14,
    },
    headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.text, writingDirection: "rtl" },
    headerChip: {
      backgroundColor: colors.card, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 5,
      borderWidth: 1, borderColor: colors.border,
    },
    headerChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: COMMUNITY_COLOR },

    listContent: { paddingHorizontal: 16, paddingBottom: 120, gap: 12 },
    listEmpty: { flex: 1, justifyContent: "center" },

    composer: {
      backgroundColor: colors.card, borderRadius: 18,
      borderWidth: 1, borderColor: colors.border,
      padding: 14, marginBottom: 12, gap: 10,
    },
    composerRow: { flexDirection: "row-reverse", gap: 10, alignItems: "flex-start" },
    composerInput: {
      flex: 1, minHeight: 60, maxHeight: 140,
      fontSize: 14, fontFamily: "Inter_400Regular",
      color: colors.text, writingDirection: "rtl",
    },
    composerActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    composerCount: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.textTertiary },
    publishBtn: {
      backgroundColor: COMMUNITY_COLOR, borderRadius: 12,
      paddingHorizontal: 22, paddingVertical: 10,
      minWidth: 64, alignItems: "center",
    },
    publishBtnDisabled: { opacity: 0.35 },
    publishBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFFFFF", writingDirection: "rtl" },

    postCard: {
      backgroundColor: colors.card, borderRadius: 18,
      borderWidth: 1, borderColor: colors.border,
      padding: 14, gap: 10,
    },
    postHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
    postMeta: { flex: 1, alignItems: "flex-end", gap: 2, paddingRight: 10 },
    postAuthorInfo: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
    postAuthorName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.text, writingDirection: "rtl" },
    postAuthorHandle: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textTertiary, writingDirection: "rtl" },
    postDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.textSecondary, writingDirection: "rtl" },
    postContent: {
      fontSize: 14, fontFamily: "Inter_400Regular",
      color: colors.textSoft, writingDirection: "rtl",
      lineHeight: 22, textAlign: "right",
    },
    postFooter: { flexDirection: "row", gap: 16, paddingTop: 2 },
    postStat: { flexDirection: "row-reverse", alignItems: "center", gap: 5 },
    postStatText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.placeholder },
    postStatLiked: { color: "#EF4444" },

    emptyWrap: { alignItems: "center", gap: 10, paddingBottom: 80 },
    emptyIconWrap: {
      width: 64, height: 64, borderRadius: 20,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      alignItems: "center", justifyContent: "center", marginBottom: 8,
    },
    emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.textSoft, writingDirection: "rtl" },
    emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textSecondary, writingDirection: "rtl", textAlign: "center" },
  });
}
