import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { useColors } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";
import { addWsListener } from "@/lib/ws";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommentAuthor {
  id: string;
  name: string;
  username: string;
  avatarColor: string;
  avatarImageUri: string | null;
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: CommentAuthor;
}

interface Props {
  postId: string | null;
  onClose: () => void;
  onCommentsCountChange: (postId: string, count: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeDate(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1)  return "الآن";
  if (minutes < 60) return `منذ ${minutes} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days < 7)     return `منذ ${days} أيام`;
  return new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
}

function initials(name: string) {
  return (name?.trim() || "؟").charAt(0).toUpperCase();
}

function Avatar({ author, size = 34 }: { author: CommentAuthor; size?: number }) {
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
        backgroundColor: author.avatarColor || "#10B981",
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.38, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
        {initials(author.name)}
      </Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CommentsSheet({ postId, onClose, onCommentsCountChange }: Props) {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const colors = useColors();
  const styles = makeStyles(colors);

  const [comments, setComments]     = useState<Comment[]>([]);
  const [loading, setLoading]       = useState(false);
  const [inputText, setInputText]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const inputRef  = useRef<TextInput>(null);

  const visible = !!postId;

  // Load comments when sheet opens
  useEffect(() => {
    if (!postId || !token) return;
    setComments([]);
    setLoading(true);
    apiFetch<{ comments: Comment[] }>(`/community/posts/${postId}/comments`, { token })
      .then(({ comments: data }) => setComments(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId, token]);

  // Real-time new comments via WebSocket
  useEffect(() => {
    if (!postId) return;
    const remove = addWsListener((event) => {
      if (event.type !== "post_commented") return;
      const { postId: pid, comment, commentsCount } = event.payload as {
        postId: string;
        comment: Comment;
        commentsCount: number;
      };
      if (pid !== postId) return;
      setComments((prev) => {
        if (prev.some((c) => c.id === comment.id)) return prev;
        return [...prev, comment];
      });
      onCommentsCountChange(pid, commentsCount);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return remove;
  }, [postId, onCommentsCountChange]);

  const submitComment = useCallback(async () => {
    const content = inputText.trim();
    if (!content || !postId || !token || submitting) return;

    // Optimistic insert
    const optimisticId = `opt-${Date.now()}`;
    const optimistic: Comment = {
      id: optimisticId,
      content,
      createdAt: new Date().toISOString(),
      author: {
        id:             user!.id,
        name:           user!.name,
        username:       user!.username ?? "",
        avatarColor:    user!.avatarColor,
        avatarImageUri: (user!.avatarImageUri as string | null | undefined) ?? null,
      },
    };
    setComments((prev) => [...prev, optimistic]);
    setInputText("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    setSubmitting(true);
    try {
      const { comment, commentsCount } = await apiFetch<{ comment: Comment; commentsCount: number }>(
        `/community/posts/${postId}/comments`,
        { method: "POST", token, body: JSON.stringify({ content }) },
      );
      // Replace optimistic with real comment
      setComments((prev) => prev.map((c) => (c.id === optimisticId ? comment : c)));
      onCommentsCountChange(postId, commentsCount);
    } catch {
      // Revert optimistic
      setComments((prev) => prev.filter((c) => c.id !== optimisticId));
      setInputText(content);
    } finally {
      setSubmitting(false);
    }
  }, [inputText, postId, token, submitting, user, onCommentsCountChange]);

  const handleClose = () => {
    setInputText("");
    setComments([]);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={handleClose} />

      <KeyboardAvoidingView
        style={styles.sheetWrapper}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
            <Text style={styles.headerTitle}>التعليقات</Text>
            <View style={{ width: 20 }} />
          </View>

          {/* Comments list */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#10B981" />
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {comments.length === 0 ? (
                <View style={styles.empty}>
                  <Feather name="message-circle" size={28} color={colors.placeholder} />
                  <Text style={styles.emptyText}>لا توجد تعليقات بعد</Text>
                </View>
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={styles.commentRow}>
                    <Avatar author={c.author} size={32} />
                    <View style={styles.commentBubble}>
                      <View style={styles.commentMeta}>
                        <Text style={styles.commentTime}>{formatRelativeDate(c.createdAt)}</Text>
                        <Text style={styles.commentName}>{c.author.name}</Text>
                      </View>
                      <Text style={styles.commentText}>{c.content}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {/* Input row */}
          <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
            {user ? (
              <Avatar
                author={{
                  id:             user.id,
                  name:           user.name,
                  username:       user.username ?? "",
                  avatarColor:    user.avatarColor,
                  avatarImageUri: (user.avatarImageUri as string | null | undefined) ?? null,
                }}
                size={32}
              />
            ) : null}
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: colors.text }]}
              placeholder="أضف تعليقاً..."
              placeholderTextColor={colors.placeholder}
              value={inputText}
              onChangeText={setInputText}
              textAlign="right"
              multiline
              maxLength={2000}
              returnKeyType="send"
              onSubmitEditing={submitComment}
            />
            <Pressable
              onPress={submitComment}
              disabled={!inputText.trim() || submitting}
              style={[styles.sendBtn, (!inputText.trim() || submitting) && styles.sendBtnDisabled]}
              hitSlop={8}
            >
              {submitting
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Feather name="send" size={16} color="#FFFFFF" />}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    sheetWrapper: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
    },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "80%",
      minHeight: 360,
      overflow: "hidden",
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginTop: 10, marginBottom: 4,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 16, fontFamily: "Inter_600SemiBold",
      color: colors.text, writingDirection: "rtl",
    },
    center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
    list: { flex: 1 },
    listContent: { padding: 16, gap: 14 },
    empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
    emptyText: {
      fontSize: 13, fontFamily: "Inter_400Regular",
      color: colors.placeholder, writingDirection: "rtl",
    },
    commentRow: {
      flexDirection: "row-reverse",
      gap: 10,
      alignItems: "flex-start",
    },
    commentBubble: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 10,
      gap: 4,
    },
    commentMeta: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
    },
    commentName: {
      fontSize: 13, fontFamily: "Inter_600SemiBold",
      color: colors.text, writingDirection: "rtl",
    },
    commentTime: {
      fontSize: 11, fontFamily: "Inter_400Regular",
      color: colors.textSecondary, writingDirection: "rtl",
    },
    commentText: {
      fontSize: 13, fontFamily: "Inter_400Regular",
      color: colors.textSoft, writingDirection: "rtl",
      textAlign: "right", lineHeight: 20,
    },
    inputRow: {
      flexDirection: "row-reverse",
      alignItems: "flex-end",
      gap: 10,
      paddingHorizontal: 14,
      paddingTop: 10,
      borderTopWidth: 1,
    },
    input: {
      flex: 1,
      fontSize: 14, fontFamily: "Inter_400Regular",
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === "ios" ? 10 : 8,
      maxHeight: 100,
      writingDirection: "rtl",
      textAlign: "right",
    },
    sendBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: "#10B981",
      alignItems: "center", justifyContent: "center",
    },
    sendBtnDisabled: { opacity: 0.35 },
  });
}
