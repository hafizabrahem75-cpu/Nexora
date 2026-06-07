import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
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
import { useAuth } from "@/context/AuthContext";
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";
import { addWsListener } from "@/lib/ws";

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

interface OtherUser {
  id: string;
  name: string;
  username: string | null;
  avatarColor: string;
  avatarImageUri: string | null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86_400_000 && d.getDate() === now.getDate()) return "اليوم";
  if (diff < 2 * 86_400_000) return "أمس";
  return d.toLocaleDateString("ar", { weekday: "long", month: "short", day: "numeric" });
}

function needsDateSeparator(prev: ChatMessage | undefined, curr: ChatMessage): boolean {
  if (!prev) return true;
  const a = new Date(prev.createdAt), b = new Date(curr.createdAt);
  return a.toDateString() !== b.toDateString();
}

function needsTimeSeparator(prev: ChatMessage | undefined, curr: ChatMessage): boolean {
  if (!prev) return false;
  return new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60_000;
}

function showComingSoon(feature: string) {
  Alert.alert(feature, "هذه الميزة ستكون متاحة قريباً 🚀", [{ text: "حسناً" }]);
}

function openChatMenu(other: OtherUser | null) {
  if (!other) return;
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ["عرض الملف الشخصي", "كتم المحادثة", "أرشفة المحادثة", "حذف المحادثة", "إلغاء"], destructiveButtonIndex: 3, cancelButtonIndex: 4 },
      (index) => {
        if (index === 0 && other.username) router.push(`/user/${other.username}` as any);
        else if (index === 1) showComingSoon("كتم المحادثة");
        else if (index === 2) showComingSoon("أرشفة المحادثة");
        else if (index === 3) showComingSoon("حذف المحادثة");
      },
    );
  } else {
    Alert.alert("خيارات المحادثة", undefined, [
      { text: "عرض الملف الشخصي", onPress: () => { if (other.username) router.push(`/user/${other.username}` as any); } },
      { text: "كتم المحادثة", onPress: () => showComingSoon("كتم المحادثة") },
      { text: "أرشفة المحادثة", onPress: () => showComingSoon("أرشفة المحادثة") },
      { text: "حذف المحادثة", style: "destructive", onPress: () => showComingSoon("حذف المحادثة") },
      { text: "إلغاء", style: "cancel" },
    ]);
  }
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;
  const bottom = Platform.OS === "web" ? 20 : insets.bottom;
  const { token, user } = useAuth();
  const { accent } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);

  const scrollBottom = (animated = true) =>
    setTimeout(() => flatRef.current?.scrollToEnd({ animated }), 50);

  const loadMessages = useCallback(async () => {
    if (!token || !id) return;
    try {
      const data = await apiFetch<{ messages: ChatMessage[] }>(
        `/conversations/${id}/messages`, { token },
      );
      setMessages(data.messages);
      scrollBottom(false);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token, id]);

  useEffect(() => {
    if (!token || !id) return;
    apiFetch<{ conversations: { id: string; otherUser: OtherUser | null }[] }>(
      "/conversations", { token },
    ).then((d) => {
      const conv = d.conversations.find((c) => c.id === id);
      if (conv?.otherUser) setOtherUser(conv.otherUser);
    }).catch(() => {});
    loadMessages();
  }, [token, id, loadMessages]);

  useEffect(() => {
    return addWsListener((event) => {
      if (
        event.type === "new_message" &&
        (event.payload as { conversationId: string }).conversationId === id
      ) {
        const msg = (event.payload as { conversationId: string; message: ChatMessage }).message;
        if (msg.senderId === user?.id) return;
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollBottom();
      }
    });
  }, [id, user?.id]);

  const send = async () => {
    const content = text.trim();
    if (!content || !token || !id || sending) return;
    setText("");
    setSending(true);
    try {
      const data = await apiFetch<{ message: ChatMessage }>(
        `/conversations/${id}/messages`,
        { method: "POST", body: JSON.stringify({ content }), token },
      );
      setMessages((prev) => [...prev, data.message]);
      scrollBottom();
    } catch { setText(content); }
    finally { setSending(false); }
  };

  const other = otherUser;
  const initial = other?.name.trim()[0] ?? "?";
  const hasText = text.trim().length > 0;

  const renderItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isMe = item.senderId === user?.id;
    const prev = messages[index - 1];
    const showDate = needsDateSeparator(prev, item);
    const showTime = needsTimeSeparator(prev, item);

    return (
      <View>
        {showDate && (
          <View style={styles.dateSeparator}>
            <View style={styles.dateLine} />
            <Text style={styles.dateLabel}>{formatDateLabel(item.createdAt)}</Text>
            <View style={styles.dateLine} />
          </View>
        )}
        {showTime && !showDate && (
          <Text style={styles.timeSeparator}>{formatTime(item.createdAt)}</Text>
        )}
        <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
          {!isMe && other && <View style={{ width: 8 }} />}
          <View style={[styles.bubble, isMe ? [styles.bubbleMe, { backgroundColor: accent }] : styles.bubbleOther]}>
            <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextOther]}>{item.content}</Text>
            <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimMe : styles.bubbleTimOther]}>{formatTime(item.createdAt)}</Text>
          </View>
          {isMe && <View style={{ width: 8 }} />}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={top}
    >
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={20} color={colors.text} />
        </Pressable>

        {other ? (
          <Pressable
            style={styles.headerCenter}
            onPress={() => other.username && router.push(`/user/${other.username}` as any)}
          >
            {other.avatarImageUri ? (
              <Image source={{ uri: other.avatarImageUri }} style={[styles.headerAvatar, { borderColor: other.avatarColor + "55" }]} />
            ) : (
              <View style={[styles.headerAvatarCircle, { backgroundColor: other.avatarColor + "22", borderColor: other.avatarColor + "55" }]}>
                <Text style={[styles.headerAvatarInitial, { color: other.avatarColor }]}>{initial}</Text>
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.headerName} numberOfLines={1}>{other.name}</Text>
              {other.username ? <Text style={styles.headerHandle}>@{other.username}</Text> : null}
            </View>
          </Pressable>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <Pressable style={styles.menuBtn} onPress={() => openChatMenu(other)}>
          <Feather name="more-vertical" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.msgList}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              {other && (
                <View style={[styles.emptyChatAvatar, { backgroundColor: other.avatarColor + "22" }]}>
                  <Text style={[styles.emptyChatInitial, { color: other.avatarColor }]}>{initial}</Text>
                </View>
              )}
              <Text style={styles.emptyChatTitle}>{other?.name ?? ""}</Text>
              <Text style={styles.emptyChatSub}>ابدأ المحادثة مع {other?.name ?? "هذا الصديق"} 👋</Text>
            </View>
          }
        />
      )}

      <View style={[styles.inputBar, { paddingBottom: bottom + 10 }]}>
        <Pressable
          style={[styles.sendBtn, { backgroundColor: hasText ? accent : colors.border }]}
          onPress={send}
          disabled={!hasText || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Feather name="send" size={17} color={hasText ? "#FFFFFF" : colors.textTertiary} />}
        </Pressable>
        <TextInput
          style={styles.textInput}
          value={text}
          onChangeText={setText}
          placeholder="اكتب رسالتك..."
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={4000}
          textAlign="right"
          onSubmitEditing={Platform.OS === "web" ? send : undefined}
        />
        <Pressable style={styles.attachBtn}>
          <Feather name="paperclip" size={18} color={colors.textTertiary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    header: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 12, paddingBottom: 12, gap: 8,
      borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: colors.card, alignItems: "center", justifyContent: "center", flexShrink: 0,
    },
    headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
    headerAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, flexShrink: 0 },
    headerAvatarCircle: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    headerAvatarInitial: { fontSize: 15, fontFamily: "Inter_700Bold" },
    headerInfo: { flex: 1 },
    headerName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.text, writingDirection: "rtl" },
    headerHandle: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.textSecondary },
    menuBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },

    msgList: { paddingHorizontal: 4, paddingVertical: 16, flexGrow: 1 },
    dateSeparator: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 16, paddingHorizontal: 12 },
    dateLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dateLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: colors.textSecondary },
    timeSeparator: { textAlign: "center", fontSize: 11, fontFamily: "Inter_400Regular", color: colors.textTertiary, marginVertical: 8 },

    msgRow: { flexDirection: "row", marginBottom: 3, paddingHorizontal: 4 },
    msgRowMe: { justifyContent: "flex-start" },
    msgRowOther: { justifyContent: "flex-end" },
    bubble: { maxWidth: "78%", borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, gap: 4 },
    bubbleMe: { borderBottomLeftRadius: 4 },
    bubbleOther: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomRightRadius: 4 },
    bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22, writingDirection: "rtl" },
    bubbleTextMe: { color: "#FFFFFF" },
    bubbleTextOther: { color: colors.textSoft },
    bubbleTime: { fontSize: 10, fontFamily: "Inter_400Regular", alignSelf: "flex-end" },
    bubbleTimMe: { color: "rgba(255,255,255,0.55)" },
    bubbleTimOther: { color: colors.textTertiary },

    inputBar: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 14, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: colors.borderSubtle, backgroundColor: colors.bg },
    attachBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
    textInput: { flex: 1, backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 11, fontSize: 15, fontFamily: "Inter_400Regular", color: colors.text, maxHeight: 120, writingDirection: "rtl" },
    sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },

    emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 10 },
    emptyChatAvatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    emptyChatInitial: { fontSize: 28, fontFamily: "Inter_700Bold" },
    emptyChatTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: colors.text, writingDirection: "rtl" },
    emptyChatSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.textSecondary, writingDirection: "rtl", textAlign: "center" },
  });
}
