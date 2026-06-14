import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
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

type FeedMode = "following" | "discover";

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
  const { accent } = useSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [feedMode, setFeedMode]             = useState<FeedMode>("discover");
  const [modeResolved, setModeResolved]     = useState(false); // true once we've picked the default
  const [posts, setPosts]                   = useState<Post[]>([]);
  const [loading, setLoading]               = useState(true);
  const [composerText, setComposerText]     = useState("");
  const [posting, setPosting]               = useState(false);
  const [openPostId, setOpenPostId]         = useState<string | null>(null);
  // Following-feed metadata
  const [followingCount, setFollowingCount] = useState(0);
  // Post management
  const [menuPostId, setMenuPostId]         = useState<string | null>(null);
  const [editingPost, setEditingPost]       = useState<{ id: string; content: string } | null>(null);
  const [editSaving, setEditSaving]         = useState(false);
  const editInputRef = useRef<TextInput>(null);

  const inputRef = useRef<TextInput>(null);

  // ── Load posts ─────────────────────────────────────────────────────────────
  const loadPosts = useCallback(
    async (mode: FeedMode, tkn: string) => {
      setLoading(true);
      try {
        if (mode === "following") {
          const data = await apiFetch<{ posts: Post[]; followingCount: number }>(
            "/community/posts/following",
            { token: tkn },
          );
          setPosts(data.posts);
          setFollowingCount(data.followingCount);
        } else {
          const data = await apiFetch<{ posts: Post[] }>("/community/posts", { token: tkn });
          setPosts(data.posts);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ── On focus: resolve default mode once, then reload ──────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!token) return;

      if (!modeResolved) {
        // Fetch following feed first to determine if user follows anyone
        apiFetch<{ posts: Post[]; followingCount: number }>(
          "/community/posts/following",
          { token },
        )
          .then((data) => {
            setFollowingCount(data.followingCount);
            const defaultMode: FeedMode = data.followingCount > 0 ? "following" : "discover";
            setFeedMode(defaultMode);
            setPosts(data.posts);
            setModeResolved(true);
          })
          .catch(() => {
            setFeedMode("discover");
            setModeResolved(true);
            loadPosts("discover", token);
          })
          .finally(() => setLoading(false));
        return;
      }

      loadPosts(feedMode, token);
    }, [token, modeResolved, feedMode, loadPosts]),
  );

  // ── Switch feed mode ───────────────────────────────────────────────────────
  const switchMode = useCallback(
    (mode: FeedMode) => {
      if (mode === feedMode || !token) return;
      setFeedMode(mode);
      loadPosts(mode, token);
    },
    [feedMode, token, loadPosts],
  );

  // ── Real-time post updates ─────────────────────────────────────────────────
  useEffect(() => {
    const remove = addWsListener((event) => {
      if (event.type === "post_liked") {
        const { postId, likesCount } = event.payload as { postId: string; likesCount: number };
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likesCount } : p)));
      } else if (event.type === "post_deleted") {
        const { postId } = event.payload as { postId: string };
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      } else if (event.type === "post_updated") {
        const { postId, content } = event.payload as { postId: string; content: string };
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, content } : p)));
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

  // ── Delete post ───────────────────────────────────────────────────────────
  const deletePost = useCallback((postId: string) => {
    Alert.alert(
      "حذف المنشور",
      "هل أنت متأكد من حذف هذا المنشور؟ لا يمكن التراجع.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            // Optimistic: remove immediately
            setPosts((prev) => prev.filter((p) => p.id !== postId));
            setMenuPostId(null);
            try {
              await apiFetch(`/community/posts/${postId}`, { method: "DELETE", token });
            } catch {
              // WS broadcast will re-sync; no rollback needed for delete
            }
          },
        },
      ],
    );
  }, [token]);

  // ── Edit post ─────────────────────────────────────────────────────────────
  const openEdit = useCallback((post: Post) => {
    setMenuPostId(null);
    setEditingPost({ id: post.id, content: post.content });
    setTimeout(() => editInputRef.current?.focus(), 150);
  }, []);

  const submitEdit = useCallback(async () => {
    if (!editingPost || !token || editSaving) return;
    const content = editingPost.content.trim();
    if (!content) return;
    setEditSaving(true);
    try {
      await apiFetch(`/community/posts/${editingPost.id}`, {
        method: "PUT",
        token,
        body: JSON.stringify({ content }),
      });
      // WS broadcast will update the post in the feed
      setEditingPost(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // silent
    } finally {
      setEditSaving(false);
    }
  }, [editingPost, token, editSaving]);

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
  const renderPost = useCallback(({ item }: { item: Post }) => {
    const isOwn = item.author.id === user?.id;
    const menuOpen = menuPostId === item.id;
    return (
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
          <View style={styles.postHeaderRight}>
            {isOwn && (
              <Pressable
                onPress={() => setMenuPostId(menuOpen ? null : item.id)}
                hitSlop={8}
                style={styles.moreBtn}
              >
                <Feather name="more-horizontal" size={16} color={colors.placeholder} />
              </Pressable>
            )}
            <Pressable onPress={() => router.push(`/profile/${item.author.id}` as any)} hitSlop={6}>
              <Avatar author={item.author} size={38} />
            </Pressable>
          </View>
        </View>

        {/* Content */}
        <Text style={styles.postContent}>{item.content}</Text>

        {/* Footer */}
        <View style={styles.postFooter}>
          <Pressable
            style={styles.postStat}
            onPress={() => setOpenPostId(item.id)}
            hitSlop={8}
          >
            <Feather name="message-circle" size={14} color={colors.placeholder} />
            <Text style={styles.postStatText}>{item.commentsCount}</Text>
          </Pressable>

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

        {/* Inline post actions (own posts only) */}
        {menuOpen && (
          <View style={styles.postMenu}>
            <Pressable
              style={styles.postMenuItem}
              onPress={() => openEdit(item)}
            >
              <Feather name="edit-2" size={14} color={colors.textSoft} />
              <Text style={styles.postMenuText}>تعديل</Text>
            </Pressable>
            <View style={styles.postMenuDivider} />
            <Pressable
              style={styles.postMenuItem}
              onPress={() => deletePost(item.id)}
            >
              <Feather name="trash-2" size={14} color="#EF4444" />
              <Text style={[styles.postMenuText, { color: "#EF4444" }]}>حذف</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }, [styles, colors, user?.id, menuPostId, toggleLike, openEdit, deletePost]);

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

  // ── Empty states ──────────────────────────────────────────────────────────
  const EmptyFollowing = (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        <Feather name="users" size={30} color={colors.placeholder} />
      </View>
      <Text style={styles.emptyTitle}>
        {followingCount === 0 ? "لا تتابع أحداً بعد" : "لا توجد منشورات"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {followingCount === 0
          ? "تابع مستخدمين لترى منشوراتهم هنا"
          : "المستخدمون الذين تتابعهم لم ينشروا بعد"}
      </Text>
      {followingCount === 0 && (
        <Pressable
          style={[styles.discoverBtn, { borderColor: COMMUNITY_COLOR }]}
          onPress={() => switchMode("discover")}
        >
          <Text style={[styles.discoverBtnText, { color: COMMUNITY_COLOR }]}>
            استكشف المستخدمين
          </Text>
        </Pressable>
      )}
    </View>
  );

  const EmptyDiscover = (
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
        {/* Feed toggle */}
        <View style={[styles.toggle, { borderColor: colors.border }]}>
          <Pressable
            style={[
              styles.toggleTab,
              feedMode === "following" && [styles.toggleTabActive, { backgroundColor: COMMUNITY_COLOR }],
            ]}
            onPress={() => switchMode("following")}
          >
            <Text style={[
              styles.toggleText,
              feedMode === "following" ? styles.toggleTextActive : { color: colors.textSecondary },
            ]}>
              المتابَعون
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggleTab,
              feedMode === "discover" && [styles.toggleTabActive, { backgroundColor: COMMUNITY_COLOR }],
            ]}
            onPress={() => switchMode("discover")}
          >
            <Text style={[
              styles.toggleText,
              feedMode === "discover" ? styles.toggleTextActive : { color: colors.textSecondary },
            ]}>
              اكتشف
            </Text>
          </Pressable>
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
          ListEmptyComponent={feedMode === "following" ? EmptyFollowing : EmptyDiscover}
          contentContainerStyle={[
            styles.listContent,
            posts.length === 0 && styles.listEmpty,
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      <BottomNav active="community" />

      <CommentsSheet
        postId={openPostId}
        onClose={() => setOpenPostId(null)}
        onCommentsCountChange={handleCommentsCountChange}
      />

      {/* ── Edit Post Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={!!editingPost}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingPost(null)}
      >
        <Pressable style={styles.editOverlay} onPress={() => setEditingPost(null)} />
        <KeyboardAvoidingView
          style={styles.editSheetWrap}
          behavior={Platform.OS === "ios" ? "position" : "height"}
        >
          <View style={styles.editSheet}>
            <View style={styles.editHandle} />
            <Text style={styles.editTitle}>تعديل المنشور</Text>
            <TextInput
              ref={editInputRef}
              style={styles.editInput}
              value={editingPost?.content ?? ""}
              onChangeText={(t) => setEditingPost((prev) => prev ? { ...prev, content: t } : prev)}
              placeholder="اكتب محتوى المنشور..."
              placeholderTextColor={colors.placeholder}
              textAlign="right"
              multiline
              maxLength={5000}
              textAlignVertical="top"
            />
            <Text style={styles.editCount}>{(editingPost?.content ?? "").length}/5000</Text>
            <View style={styles.editActions}>
              <Pressable
                style={[styles.editBtn, styles.editCancelBtn]}
                onPress={() => setEditingPost(null)}
              >
                <Text style={styles.editCancelText}>إلغاء</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.editBtn,
                  { backgroundColor: COMMUNITY_COLOR },
                  (!editingPost?.content.trim() || editSaving) && { opacity: 0.4 },
                ]}
                onPress={submitEdit}
                disabled={!editingPost?.content.trim() || editSaving}
              >
                {editSaving
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={styles.editSaveText}>حفظ</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

    toggle: {
      flexDirection: "row",
      borderRadius: 12,
      borderWidth: 1,
      overflow: "hidden",
    },
    toggleTab: {
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    toggleTabActive: {
      borderRadius: 10,
    },
    toggleText: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      writingDirection: "rtl",
    },
    toggleTextActive: {
      color: "#FFFFFF",
    },

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
    postHeaderRight: { flexDirection: "column", alignItems: "center", gap: 6 },
    moreBtn: { padding: 2 },
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
    postMenu: {
      borderTopWidth: 1, borderTopColor: colors.border,
      flexDirection: "row", paddingTop: 8,
    },
    postMenuItem: {
      flex: 1, flexDirection: "row-reverse", alignItems: "center",
      justifyContent: "center", gap: 6, paddingVertical: 6,
    },
    postMenuDivider: { width: 1, backgroundColor: colors.border, marginVertical: 2 },
    postMenuText: {
      fontSize: 13, fontFamily: "Inter_500Medium",
      color: colors.textSoft, writingDirection: "rtl",
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
    discoverBtn: {
      marginTop: 8, borderRadius: 12, borderWidth: 1.5,
      paddingHorizontal: 20, paddingVertical: 9,
    },
    discoverBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", writingDirection: "rtl" },

    editOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)" },
    editSheetWrap: { position: "absolute", bottom: 0, left: 0, right: 0 },
    editSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingTop: 12, paddingBottom: Platform.OS === "web" ? 34 : 44,
      paddingHorizontal: 20,
      borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border,
    },
    editHandle: {
      width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
      alignSelf: "center", marginBottom: 18,
    },
    editTitle: {
      fontSize: 18, fontFamily: "Inter_700Bold", color: colors.text,
      textAlign: "right", writingDirection: "rtl", marginBottom: 14,
    },
    editInput: {
      backgroundColor: colors.bg, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 16, paddingVertical: 13,
      fontSize: 14, fontFamily: "Inter_400Regular", color: colors.text,
      minHeight: 100, maxHeight: 200,
      writingDirection: "rtl", textAlign: "right",
      marginBottom: 6,
    },
    editCount: {
      fontSize: 11, fontFamily: "Inter_400Regular", color: colors.textTertiary,
      textAlign: "left", marginBottom: 16,
    },
    editActions: { flexDirection: "row", gap: 10 },
    editBtn: { flex: 1, borderRadius: 13, paddingVertical: 15, alignItems: "center" },
    editCancelBtn: { backgroundColor: colors.border },
    editCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.textSoft, writingDirection: "rtl" },
    editSaveText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFFFFF", writingDirection: "rtl" },
  });
}
