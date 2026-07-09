import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
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
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomNav from "@/components/BottomNav";
import CommentsSheet from "@/components/CommentsSheet";
import LikesSheet from "@/components/LikesSheet";
import { useAuth } from "@/context/AuthContext";
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import { API_BASE, apiFetch } from "@/lib/api";
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

interface PostImageItem {
  id: string;
  mimeType: string;
}

interface Post {
  id: string;
  content: string;
  images: PostImageItem[];
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  createdAt: string;
  author: PostAuthor;
}

/** Image selected locally, before it has been uploaded. */
interface PendingImage {
  localUri: string;   // for preview only
  base64: string;     // raw base64 (no data-URI prefix)
  mimeType: string;
}

// ─── Report reasons ───────────────────────────────────────────────────────────

const REPORT_REASONS = [
  { value: "spam",          label: "بريد مزعج أو إعلانات" },
  { value: "harassment",   label: "تحرش أو إساءة" },
  { value: "inappropriate", label: "محتوى غير لائق" },
  { value: "misinformation", label: "معلومات مضللة" },
  { value: "other",        label: "أخرى" },
] as const;

type ReportReason = typeof REPORT_REASONS[number]["value"] | "";

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

  const [feedMode, setFeedMode]               = useState<FeedMode>("discover");
  const [modeResolved, setModeResolved]       = useState(false);
  const [posts, setPosts]                     = useState<Post[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [composerText, setComposerText]       = useState("");
  const [posting, setPosting]                 = useState(false);
  const [pendingImage, setPendingImage]       = useState<PendingImage | null>(null);
  const [uploadingImage, setUploadingImage]   = useState(false);
  const [openPostId, setOpenPostId]           = useState<string | null>(null);
  const [likesSheetPostId, setLikesSheetPostId] = useState<string | null>(null);
  const [followingCount, setFollowingCount]   = useState(0);

  // Options menu (three-dot) — for any post
  const [optionsMenuPostId, setOptionsMenuPostId] = useState<string | null>(null);
  // Saved posts — tracked locally per session
  const [savedPostIds, setSavedPostIds]           = useState<Set<string>>(new Set());
  // Report modal
  const [reportingPostId, setReportingPostId]     = useState<string | null>(null);
  const [reportReason, setReportReason]           = useState<ReportReason>("");
  const [reportSaving, setReportSaving]           = useState(false);

  // Edit post
  const [editingPost, setEditingPost]   = useState<{ id: string; content: string } | null>(null);
  const [editSaving, setEditSaving]     = useState(false);
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

  // ── Comments count sync ────────────────────────────────────────────────────
  const handleCommentsCountChange = useCallback((postId: string, commentsCount: number) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, commentsCount } : p))
    );
  }, []);

  // ── Delete post ───────────────────────────────────────────────────────────
  const deletePost = useCallback((postId: string) => {
    setOptionsMenuPostId(null);
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
            setPosts((prev) => prev.filter((p) => p.id !== postId));
            try {
              await apiFetch(`/community/posts/${postId}`, { method: "DELETE", token });
            } catch {
              // WS broadcast will re-sync
            }
          },
        },
      ],
    );
  }, [token]);

  // ── Edit post ─────────────────────────────────────────────────────────────
  const openEdit = useCallback((post: Post) => {
    setOptionsMenuPostId(null);
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

  // ── Save / Unsave post ────────────────────────────────────────────────────
  const toggleSave = useCallback(async (postId: string) => {
    if (!token) return;
    const isSaved = savedPostIds.has(postId);
    setSavedPostIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(postId);
      else next.add(postId);
      return next;
    });
    setOptionsMenuPostId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (isSaved) {
        await apiFetch(`/community/posts/${postId}/save`, { method: "DELETE", token });
      } else {
        await apiFetch(`/community/posts/${postId}/save`, { method: "POST", token });
      }
    } catch {
      setSavedPostIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.add(postId);
        else next.delete(postId);
        return next;
      });
    }
  }, [token, savedPostIds]);

  // ── Copy post link ────────────────────────────────────────────────────────
  const copyPostLink = useCallback(async (postId: string) => {
    setOptionsMenuPostId(null);
    try {
      await Share.share({
        message: `nexora://post/${postId}`,
        title: "رابط المنشور",
      });
    } catch {
      // user cancelled share sheet
    }
  }, []);

  // ── Share post ────────────────────────────────────────────────────────────
  const sharePost = useCallback(async (postId: string) => {
    setOptionsMenuPostId(null);
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    try {
      await Share.share({
        message: post.content,
        title: `منشور بقلم ${post.author.name}`,
      });
    } catch {
      // user cancelled
    }
  }, [posts]);

  // ── Report post ────────────────────────────────────────────────────────────
  const submitReport = useCallback(async () => {
    if (!reportingPostId || !token || !reportReason || reportSaving) return;
    setReportSaving(true);
    try {
      await apiFetch(`/community/posts/${reportingPostId}/report`, {
        method: "POST",
        token,
        body: JSON.stringify({ reason: reportReason }),
      });
      setReportingPostId(null);
      setReportReason("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("شكراً", "تم إرسال بلاغك، سنراجعه قريباً.");
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.includes("409") || msg.includes("سابقاً")) {
        Alert.alert("تنبيه", "لقد أبلغت عن هذا المنشور سابقاً.");
      } else {
        Alert.alert("خطأ", "تعذّر إرسال البلاغ، حاول مجدداً.");
      }
    } finally {
      setReportSaving(false);
    }
  }, [reportingPostId, token, reportReason, reportSaving]);

  // ── Pick image from library ────────────────────────────────────────────────
  const pickImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("إذن مطلوب", "يرجى السماح بالوصول إلى معرض الصور لإرفاق صورة.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert("خطأ", "تعذّر قراءة الصورة. حاول اختيار صورة أخرى.");
        return;
      }

      // Derive MIME type from file extension or reported type.
      const rawType = asset.mimeType ?? "";
      const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      const mimeType = allowed.includes(rawType) ? rawType : "image/jpeg";

      setPendingImage({
        localUri: asset.uri,
        base64:   asset.base64,
        mimeType,
      });
    } catch {
      Alert.alert("خطأ", "تعذّر فتح معرض الصور.");
    }
  }, []);

  // ── Create post ───────────────────────────────────────────────────────────
  const submitPost = async () => {
    const content = composerText.trim();
    if ((!content && !pendingImage) || !token || posting) return;

    setPosting(true);
    try {
      let imageId: string | undefined;

      // Step 1: upload image if one is attached.
      if (pendingImage) {
        setUploadingImage(true);
        try {
          const { imageId: id } = await apiFetch<{ imageId: string }>(
            "/community/images",
            {
              method: "POST",
              token,
              body: JSON.stringify({
                mimeType: pendingImage.mimeType,
                data:     pendingImage.base64,
              }),
            },
          );
          imageId = id;
        } catch {
          Alert.alert("خطأ", "تعذّر رفع الصورة. تحقق من حجم الصورة (الحد الأقصى 5 ميغابايت).");
          setPosting(false);
          setUploadingImage(false);
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      // Step 2: create the post, optionally linking the uploaded image.
      const { post } = await apiFetch<{ post: Post }>("/community/posts", {
        method: "POST",
        token,
        body: JSON.stringify({ content: content || " ", imageId }),
      });
      setPosts((prev) => [post, ...prev]);
      setComposerText("");
      setPendingImage(null);
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
            <Pressable
              onPress={() => setOptionsMenuPostId(item.id)}
              hitSlop={8}
              style={styles.moreBtn}
            >
              <Feather name="more-horizontal" size={16} color={colors.placeholder} />
            </Pressable>
            <Pressable onPress={() => router.push(`/profile/${item.author.id}` as any)} hitSlop={6}>
              <Avatar author={item.author} size={38} />
            </Pressable>
          </View>
        </View>

        {/* Content */}
        {item.content.trim() ? (
          <Text style={styles.postContent}>{item.content}</Text>
        ) : null}

        {/* Images */}
        {item.images?.length > 0 ? (
          <View style={styles.postImagesWrap}>
            {item.images.map((img) => (
              <Image
                key={img.id}
                source={{ uri: `${API_BASE}/community/images/${img.id}` }}
                style={styles.postImage}
                resizeMode="cover"
              />
            ))}
          </View>
        ) : null}

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

          <View style={styles.postStat}>
            <Pressable
              onPress={() => toggleLike(item.id, item.isLiked)}
              hitSlop={8}
            >
              <Feather
                name="heart"
                size={14}
                color={item.isLiked ? "#EF4444" : colors.placeholder}
              />
            </Pressable>
            <Pressable
              onPress={() => setLikesSheetPostId(item.id)}
              hitSlop={8}
            >
              <Text style={[styles.postStatText, item.isLiked && styles.postStatLiked]}>
                {item.likesCount}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }, [styles, colors, user?.id, toggleLike]);

  // ── Options menu post (looked up when modal is open) ──────────────────────
  const optionsPost = posts.find((p) => p.id === optionsMenuPostId) ?? null;
  const optionsPostIsOwn = optionsPost?.author.id === user?.id;

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
      {/* Pending image preview */}
      {pendingImage ? (
        <View style={styles.pendingImageWrap}>
          <Image
            source={{ uri: pendingImage.localUri }}
            style={styles.pendingImageThumb}
            resizeMode="cover"
          />
          <Pressable
            style={styles.pendingImageRemove}
            onPress={() => setPendingImage(null)}
            hitSlop={8}
          >
            <Feather name="x" size={14} color="#FFFFFF" />
          </Pressable>
          {uploadingImage ? (
            <View style={styles.pendingImageUploading}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.composerActions}>
        <View style={styles.composerLeft}>
          <Pressable
            onPress={pickImage}
            hitSlop={8}
            style={[styles.imagePickerBtn, pendingImage ? { opacity: 0.4 } : null]}
            disabled={!!pendingImage}
          >
            <Feather name="image" size={18} color={COMMUNITY_COLOR} />
          </Pressable>
          <Text style={styles.composerCount}>{composerText.length}/5000</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.publishBtn,
            (!composerText.trim() && !pendingImage) && styles.publishBtnDisabled,
            pressed && (composerText.trim() || pendingImage) ? { opacity: 0.8 } : null,
          ]}
          onPress={submitPost}
          disabled={(!composerText.trim() && !pendingImage) || posting}
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

      <LikesSheet
        postId={likesSheetPostId}
        onClose={() => setLikesSheetPostId(null)}
      />

      {/* ── Options Menu Modal (three-dot) ───────────────────────────── */}
      <Modal
        visible={optionsMenuPostId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setOptionsMenuPostId(null)}
      >
        <Pressable style={styles.optionsOverlay} onPress={() => setOptionsMenuPostId(null)} />
        <View style={styles.optionsSheet}>
          <View style={styles.optionsHandle} />

          {/* Save / Unsave */}
          <Pressable
            style={styles.optionsItem}
            onPress={() => optionsMenuPostId && toggleSave(optionsMenuPostId)}
          >
            <Feather
              name={savedPostIds.has(optionsMenuPostId ?? "") ? "bookmark" : "bookmark"}
              size={18}
              color={savedPostIds.has(optionsMenuPostId ?? "") ? COMMUNITY_COLOR : colors.textSoft}
            />
            <Text style={[
              styles.optionsItemText,
              savedPostIds.has(optionsMenuPostId ?? "") && { color: COMMUNITY_COLOR },
            ]}>
              {savedPostIds.has(optionsMenuPostId ?? "") ? "إلغاء حفظ المنشور" : "حفظ المنشور"}
            </Text>
          </Pressable>

          {/* Copy link */}
          <Pressable
            style={styles.optionsItem}
            onPress={() => optionsMenuPostId && copyPostLink(optionsMenuPostId)}
          >
            <Feather name="copy" size={18} color={colors.textSoft} />
            <Text style={styles.optionsItemText}>نسخ رابط المنشور</Text>
          </Pressable>

          {/* Share */}
          <Pressable
            style={styles.optionsItem}
            onPress={() => optionsMenuPostId && sharePost(optionsMenuPostId)}
          >
            <Feather name="share-2" size={18} color={colors.textSoft} />
            <Text style={styles.optionsItemText}>مشاركة المنشور</Text>
          </Pressable>

          <View style={styles.optionsDivider} />

          {optionsPostIsOwn ? (
            /* Own post: Edit + Delete */
            <>
              <Pressable
                style={styles.optionsItem}
                onPress={() => optionsPost && openEdit(optionsPost)}
              >
                <Feather name="edit-2" size={18} color={colors.textSoft} />
                <Text style={styles.optionsItemText}>تعديل المنشور</Text>
              </Pressable>
              <Pressable
                style={styles.optionsItem}
                onPress={() => optionsMenuPostId && deletePost(optionsMenuPostId)}
              >
                <Feather name="trash-2" size={18} color="#EF4444" />
                <Text style={[styles.optionsItemText, { color: "#EF4444" }]}>حذف المنشور</Text>
              </Pressable>
            </>
          ) : (
            /* Other's post: Report */
            <Pressable
              style={styles.optionsItem}
              onPress={() => {
                if (!optionsMenuPostId) return;
                setReportingPostId(optionsMenuPostId);
                setReportReason("");
                setOptionsMenuPostId(null);
              }}
            >
              <Feather name="flag" size={18} color="#EF4444" />
              <Text style={[styles.optionsItemText, { color: "#EF4444" }]}>الإبلاغ عن المنشور</Text>
            </Pressable>
          )}
        </View>
      </Modal>

      {/* ── Report Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={reportingPostId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { setReportingPostId(null); setReportReason(""); }}
      >
        <Pressable
          style={styles.optionsOverlay}
          onPress={() => { setReportingPostId(null); setReportReason(""); }}
        />
        <View style={styles.optionsSheet}>
          <View style={styles.optionsHandle} />
          <Text style={styles.reportTitle}>الإبلاغ عن المنشور</Text>
          <Text style={styles.reportSubtitle}>اختر سبب البلاغ</Text>

          {REPORT_REASONS.map((r) => {
            const selected = reportReason === r.value;
            return (
              <Pressable
                key={r.value}
                style={[styles.optionsItem, selected && styles.optionsItemSelected]}
                onPress={() => setReportReason(r.value)}
              >
                <Feather
                  name={selected ? "check-circle" : "circle"}
                  size={18}
                  color={selected ? COMMUNITY_COLOR : colors.placeholder}
                />
                <Text style={[styles.optionsItemText, selected && { color: COMMUNITY_COLOR }]}>
                  {r.label}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            style={[
              styles.publishBtn,
              styles.reportSubmitBtn,
              (!reportReason || reportSaving) && styles.publishBtnDisabled,
            ]}
            onPress={submitReport}
            disabled={!reportReason || reportSaving}
          >
            {reportSaving
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text style={styles.publishBtnText}>إرسال البلاغ</Text>}
          </Pressable>
        </View>
      </Modal>

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
    composerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    imagePickerBtn: { padding: 2 },
    composerCount: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.textTertiary },

    // Pending image preview (composer)
    pendingImageWrap: {
      position: "relative",
      alignSelf: "flex-end",
      borderRadius: 10,
      overflow: "hidden",
    },
    pendingImageThumb: {
      width: 100,
      height: 100,
      borderRadius: 10,
    },
    pendingImageRemove: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    pendingImageUploading: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
    },

    // Images inside a post card
    postImagesWrap: { borderRadius: 12, overflow: "hidden" },
    postImage: {
      width: "100%",
      aspectRatio: 16 / 9,
      borderRadius: 12,
      backgroundColor: colors.border,
    },
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

    // ── Options bottom sheet ──────────────────────────────────────────────────
    optionsOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
    optionsSheet: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      backgroundColor: colors.card,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingTop: 12,
      paddingBottom: Platform.OS === "web" ? 24 : 40,
      paddingHorizontal: 20,
      borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border,
    },
    optionsHandle: {
      width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
      alignSelf: "center", marginBottom: 14,
    },
    optionsItem: {
      flexDirection: "row-reverse", alignItems: "center", gap: 14,
      paddingVertical: 14, paddingHorizontal: 4,
    },
    optionsItemSelected: {
      backgroundColor: colors.bg,
      borderRadius: 10,
      paddingHorizontal: 10,
    },
    optionsItemText: {
      fontSize: 15, fontFamily: "Inter_500Medium",
      color: colors.textSoft, writingDirection: "rtl", flex: 1, textAlign: "right",
    },
    optionsDivider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },

    // ── Report modal extras ───────────────────────────────────────────────────
    reportTitle: {
      fontSize: 18, fontFamily: "Inter_700Bold", color: colors.text,
      textAlign: "right", writingDirection: "rtl", marginBottom: 4,
    },
    reportSubtitle: {
      fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textSecondary,
      textAlign: "right", writingDirection: "rtl", marginBottom: 8,
    },
    reportSubmitBtn: { marginTop: 12, paddingVertical: 14 },

    // ── Edit modal ────────────────────────────────────────────────────────────
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
