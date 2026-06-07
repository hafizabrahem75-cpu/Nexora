import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";

interface SearchUser {
  id: string;
  name: string;
  username: string | null;
  avatarColor: string;
  avatarImageUri: string | null;
}

interface FriendRequestStatus {
  [userId: string]: "pending" | "friend" | null;
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;
  const { token } = useAuth();
  const { accent } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState<FriendRequestStatus>({});
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch<{ users: SearchUser[] }>(
          `/users/search?q=${encodeURIComponent(query.trim())}`,
          { token: token ?? undefined },
        );
        setResults(data.users);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [query, token]);

  const sendRequest = async (userId: string) => {
    if (!token) return;
    setSendingTo(userId);
    try {
      await apiFetch("/friends/request", {
        method: "POST",
        body: JSON.stringify({ receiverId: userId }),
        token,
      });
      setRequestStatus((s) => ({ ...s, [userId]: "pending" }));
    } catch { /* ignore */ } finally {
      setSendingTo(null);
    }
  };

  const renderItem = ({ item }: { item: SearchUser }) => {
    const initial = item.name.trim()[0] ?? "?";
    const status = requestStatus[item.id];

    return (
      <Pressable
        style={styles.userRow}
        onPress={() => item.username ? router.push(`/user/${item.username}` as any) : null}
      >
        <View style={styles.userInfo}>
          {item.avatarImageUri ? (
            <Image source={{ uri: item.avatarImageUri }} style={[styles.avatar, { borderColor: item.avatarColor + "55" }]} />
          ) : (
            <View style={[styles.avatarCircle, { backgroundColor: item.avatarColor + "22", borderColor: item.avatarColor + "55" }]}>
              <Text style={[styles.avatarInitial, { color: item.avatarColor }]}>{initial}</Text>
            </View>
          )}
          <View style={styles.userText}>
            <Text style={styles.userName}>{item.name}</Text>
            {item.username ? (
              <Text style={styles.userHandle}>@{item.username}</Text>
            ) : null}
          </View>
        </View>
        {status === "pending" ? (
          <View style={styles.sentBadge}>
            <Text style={styles.sentText}>تم الإرسال</Text>
          </View>
        ) : status === "friend" ? (
          <View style={styles.friendBadge}>
            <Text style={styles.friendText}>صديق</Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.addBtn, { backgroundColor: accent + "18", borderColor: accent + "44" }, pressed && { opacity: 0.7 }]}
            onPress={() => sendRequest(item.id)}
            disabled={sendingTo === item.id}
          >
            {sendingTo === item.id ? (
              <ActivityIndicator size="small" color={accent} />
            ) : (
              <>
                <Feather name="user-plus" size={14} color={accent} />
                <Text style={[styles.addBtnText, { color: accent }]}>إضافة</Text>
              </>
            )}
          </Pressable>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>البحث عن أصدقاء</Text>
      </View>

      <View style={styles.searchWrap}>
        <Feather name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث عن طريق اسم المستخدم..."
          placeholderTextColor={colors.placeholder}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          textAlign="right"
        />
        {loading && <ActivityIndicator size="small" color={accent} />}
      </View>

      {results.length === 0 && query.trim().length >= 2 && !loading ? (
        <View style={styles.empty}>
          <Feather name="users" size={40} color={colors.border} />
          <Text style={styles.emptyTitle}>لا توجد نتائج</Text>
          <Text style={styles.emptySub}>جرب اسم مستخدم مختلف</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },

    header: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingHorizontal: 20, paddingBottom: 16,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: colors.card, alignItems: "center", justifyContent: "center",
    },
    title: { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.text, writingDirection: "rtl" },

    searchWrap: {
      flexDirection: "row", alignItems: "center",
      marginHorizontal: 20, marginBottom: 16,
      backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 14, gap: 10, height: 48,
    },
    searchIcon: {},
    searchInput: {
      flex: 1, fontSize: 15, fontFamily: "Inter_400Regular",
      color: colors.text, writingDirection: "rtl",
    },

    list: { paddingHorizontal: 20 },
    sep: { height: 1, backgroundColor: colors.border },

    userRow: {
      flexDirection: "row", alignItems: "center",
      justifyContent: "space-between", paddingVertical: 14, gap: 12,
    },
    userInfo: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
    avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5 },
    avatarCircle: {
      width: 44, height: 44, borderRadius: 22,
      borderWidth: 1.5, alignItems: "center", justifyContent: "center",
    },
    avatarInitial: { fontSize: 17, fontFamily: "Inter_700Bold" },
    userText: { flex: 1, alignItems: "flex-end" },
    userName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.text, writingDirection: "rtl" },
    userHandle: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textSecondary },

    addBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
      borderWidth: 1, minWidth: 80, justifyContent: "center",
    },
    addBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", writingDirection: "rtl" },

    sentBadge: {
      backgroundColor: colors.border, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 8, minWidth: 80, alignItems: "center",
    },
    sentText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.textSecondary, writingDirection: "rtl" },

    friendBadge: {
      backgroundColor: "#34D39918", borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 8,
      borderWidth: 1, borderColor: "#34D39944", minWidth: 80, alignItems: "center",
    },
    friendText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#34D399", writingDirection: "rtl" },

    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
    emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.textSoft, writingDirection: "rtl" },
    emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textSecondary, writingDirection: "rtl" },
  });
}
