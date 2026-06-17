import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LikeUser {
  id: string;
  name: string;
  username: string;
  avatarColor: string;
  avatarImageUri: string | null;
}

interface LikeItem {
  likedAt: string;
  user: LikeUser;
}

interface Props {
  postId: string | null;
  onClose: () => void;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ user, size = 40 }: { user: LikeUser; size?: number }) {
  if (user.avatarImageUri) {
    return (
      <Image
        source={{ uri: user.avatarImageUri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: user.avatarColor || "#10B981",
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.38, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
        {(user.name?.trim() || "؟").charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LikesSheet({ postId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const colors = useColors();
  const styles = makeStyles(colors);

  const [likes, setLikes]           = useState<LikeItem[]>([]);
  const [loading, setLoading]       = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const visible = !!postId;

  const loadLikes = useCallback(
    async (id: string, cursor?: string) => {
      if (!token) return;
      cursor ? setLoadingMore(true) : setLoading(true);
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (cursor) params.set("cursor", cursor);
        const data = await apiFetch<{ likes: LikeItem[]; nextCursor: string | null }>(
          `/community/posts/${id}/likes?${params.toString()}`,
          { token },
        );
        setLikes((prev) => (cursor ? [...prev, ...data.likes] : data.likes));
        setNextCursor(data.nextCursor);
      } catch {
        // silent — empty state handles it
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!postId || !token) return;
    setLikes([]);
    setNextCursor(null);
    loadLikes(postId);
  }, [postId, token, loadLikes]);

  const loadMore = useCallback(() => {
    if (!postId || !nextCursor || loadingMore) return;
    loadLikes(postId, nextCursor);
  }, [postId, nextCursor, loadingMore, loadLikes]);

  const handleClose = () => {
    setLikes([]);
    setNextCursor(null);
    onClose();
  };

  const renderItem = useCallback(
    ({ item }: { item: LikeItem }) => (
      <Pressable
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        onPress={() => {
          handleClose();
          router.push(`/profile/${item.user.id}` as any);
        }}
      >
        <View style={styles.rowLeft}>
          <Text style={styles.rowName}>{item.user.name}</Text>
          <Text style={styles.rowUsername}>@{item.user.username}</Text>
        </View>
        <Avatar user={item.user} size={40} />
      </Pressable>
    ),
    [styles, colors],
  );

  const ListFooter = loadingMore ? (
    <View style={styles.footerLoader}>
      <ActivityIndicator size="small" color="#10B981" />
    </View>
  ) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={handleClose} />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={8}>
            <Feather name="x" size={20} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>الإعجابات</Text>
          <View style={{ width: 20 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#10B981" />
          </View>
        ) : likes.length === 0 ? (
          <View style={styles.center}>
            <Feather name="heart" size={28} color={colors.placeholder} />
            <Text style={styles.emptyText}>لا توجد إعجابات بعد</Text>
          </View>
        ) : (
          <FlatList
            data={likes}
            keyExtractor={(item) => item.user.id}
            renderItem={renderItem}
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={ListFooter}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
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
    sheet: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "75%",
      minHeight: 300,
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
    center: {
      flex: 1, alignItems: "center", justifyContent: "center",
      paddingVertical: 48, gap: 10,
    },
    emptyText: {
      fontSize: 14, fontFamily: "Inter_400Regular",
      color: colors.placeholder, writingDirection: "rtl",
    },
    listContent: {
      paddingVertical: 8,
    },
    row: {
      flexDirection: "row-reverse",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    rowLeft: {
      flex: 1,
      alignItems: "flex-end",
      gap: 2,
    },
    rowName: {
      fontSize: 14, fontFamily: "Inter_600SemiBold",
      color: colors.text, writingDirection: "rtl",
    },
    rowUsername: {
      fontSize: 12, fontFamily: "Inter_400Regular",
      color: colors.textSecondary, writingDirection: "rtl",
    },
    separator: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 16,
    },
    footerLoader: {
      paddingVertical: 16,
      alignItems: "center",
    },
  });
}
