import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import { useColors } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";

interface FollowUser {
  id: string;
  name: string;
  username: string | null;
  avatarColor: string;
  avatarImageUri: string | null;
}

function Avatar({ user, size = 44 }: { user: FollowUser; size?: number }) {
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
        backgroundColor: user.avatarColor,
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.38, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>
        {(user.name?.trim() || "؟").charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export default function FollowersScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;
  const { token } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !userId) return;
    apiFetch<{ followers: FollowUser[] }>(`/follows/${userId}/followers`, { token })
      .then(({ followers }) => setUsers(followers))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, userId]);

  const renderItem = ({ item }: { item: FollowUser }) => (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={() => router.push(`/profile/${item.id}` as any)}
    >
      <View style={styles.rowLeft}>
        <Feather name="chevron-left" size={16} color={colors.textTertiary} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        {item.username ? (
          <Text style={styles.handle} numberOfLines={1}>@{item.username}</Text>
        ) : null}
      </View>
      <Avatar user={item} size={44} />
    </Pressable>
  );

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-right" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>المتابِعون</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>لا يوجد متابعون بعد</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    topBar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4,
    },
    title: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: colors.text, writingDirection: "rtl" },

    list: { paddingBottom: 40 },
    sep: { height: 1, backgroundColor: colors.borderSubtle, marginHorizontal: 16 },

    row: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingVertical: 12, gap: 12,
    },
    rowLeft: { marginLeft: 4 },
    rowInfo: { flex: 1, alignItems: "flex-end", gap: 2 },
    name: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.text, writingDirection: "rtl", textAlign: "right" },
    handle: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textTertiary },
    empty: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.textTertiary, writingDirection: "rtl" },
  });
}
