import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
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
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";
import { addWsListener } from "@/lib/ws";
import { NEXORA_AI_TASKS_KEY } from "@/app/nexora-ai";
import type { AiSavedTask } from "@/app/nexora-ai";

// ─── AI Engine ──────────────────────────────────────────────────────────────────

const AI_PURPLE = "#7C6EFA";

type AiAction = "summarize" | "extract-tasks" | "extract-goals" | "action-plan";

interface AiChatResult {
  action: AiAction;
  summary?: string;
  tasks: string[];
  goals: string[];
  goalLabel: string;
  createdAt: string;
}

const TASK_PATTERNS =
  /يجب|ينبغي|سأ|سنقوم|اتفقنا|قم بـ|قومي بـ|تعال|أرسل|ابعث|اشتر|احجز|راجع|تواصل|ذكّر|لا تنسى|اعمل على|نحتاج|حضّر|جهّز|خطط|نرتب|دعنا ن/;
const GOAL_PATTERNS =
  /نريد|أريد|هدف|نخطط|مشروع|سنبدأ|نبني|نطمح|نسعى|حلمنا|خطتنا|نحاول|أتمنى|نتمنى|نحلم|نفكر في|ننوي/;

function cleanTitle(msg: string): string {
  return msg.replace(/[^\u0600-\u06FFa-zA-Z0-9\s.,!؟?]/g, "").trim().slice(0, 80);
}

function runLocalAI(
  action: AiAction,
  messages: ChatMessage[],
  otherName: string,
): AiChatResult {
  const goalLabel = `محادثة مع ${otherName}`;
  const now = new Date().toISOString();
  const bodies = messages.map((m) => m.content);

  if (action === "summarize") {
    const total = messages.length;
    const topics: string[] = [];
    if (bodies.some((b) => TASK_PATTERNS.test(b))) topics.push("مهام ومسؤوليات");
    if (bodies.some((b) => GOAL_PATTERNS.test(b)))  topics.push("أهداف ومشاريع");
    if (bodies.some((b) => /موعد|اجتماع|لقاء|ساعة|يوم/.test(b))) topics.push("مواعيد");
    const topicLine = topics.length
      ? `تشمل مواضيع: ${topics.join("، ")}.`
      : "محتوى عام وتواصل اجتماعي.";
    const summary = `المحادثة تحتوي على ${total} رسالة مع ${otherName}. ${topicLine} آخر نشاط: ${
      messages.length ? new Date(messages[messages.length - 1]!.createdAt).toLocaleDateString("ar") : "—"
    }.`;
    return { action, summary, tasks: [], goals: [], goalLabel, createdAt: now };
  }

  if (action === "extract-tasks") {
    const tasks = bodies
      .filter((b) => TASK_PATTERNS.test(b))
      .map(cleanTitle)
      .filter(Boolean)
      .slice(0, 8);
    const deduped = [...new Set(tasks)];
    return { action, tasks: deduped.length ? deduped : ["لم يتم العثور على مهام واضحة في المحادثة"], goals: [], goalLabel, createdAt: now };
  }

  if (action === "extract-goals") {
    const goals = bodies
      .filter((b) => GOAL_PATTERNS.test(b))
      .map(cleanTitle)
      .filter(Boolean)
      .slice(0, 5);
    const deduped = [...new Set(goals)];
    return { action, tasks: [], goals: deduped.length ? deduped : ["لم يتم العثور على أهداف واضحة في المحادثة"], goalLabel, createdAt: now };
  }

  // action-plan: combine both
  const tasks = [...new Set(
    bodies.filter((b) => TASK_PATTERNS.test(b)).map(cleanTitle).filter(Boolean).slice(0, 5)
  )];
  const goals = [...new Set(
    bodies.filter((b) => GOAL_PATTERNS.test(b)).map(cleanTitle).filter(Boolean).slice(0, 3)
  )];
  const fallbackTasks = tasks.length ? tasks : ["مراجعة نتائج المحادثة", "التواصل مجدداً لمتابعة التفاصيل"];
  const fallbackGoals = goals.length ? goals : ["تطوير التعاون مع " + otherName];
  const summary = `خطة عمل مُستخلصة من محادثتك مع ${otherName}: ${fallbackTasks.length} مهمة و${fallbackGoals.length} هدف.`;
  return { action, summary, tasks: fallbackTasks, goals: fallbackGoals, goalLabel, createdAt: now };
}

async function saveAiChatResult(result: AiChatResult): Promise<void> {
  const toSave: string[] = [
    ...(result.action === "extract-goals" || result.action === "action-plan" ? result.goals : []),
    ...(result.action !== "extract-goals" && result.action !== "summarize" ? result.tasks : []),
  ];
  if (!toSave.length) return;
  const raw = await AsyncStorage.getItem(NEXORA_AI_TASKS_KEY).catch(() => null);
  const existing: AiSavedTask[] = raw ? JSON.parse(raw) : [];
  const newTasks: AiSavedTask[] = toSave.map((title, i) => ({
    id:        `chat-ai-${Date.now()}-${i}`,
    title,
    source:    "nexora-ai" as const,
    goalLabel: result.goalLabel,
    createdAt: result.createdAt,
  }));
  await AsyncStorage.setItem(NEXORA_AI_TASKS_KEY, JSON.stringify([...newTasks, ...existing]));
}

// ─── Smart Reply Engine ──────────────────────────────────────────────────────────

const SMART_REPLY_POOLS: Record<string, string[]> = {
  question:     ["نعم، بالتأكيد", "لا، للأسف", "سأعود إليك بالإجابة قريباً"],
  plan:         ["فكرة رائعة!", "موافق على الخطة 👍", "متى نبدأ؟"],
  task:         ["سأتكفل بذلك", "تم الأخذ بالملاحظة", "سأعمل على ذلك اليوم"],
  greeting:     ["أهلاً! كيف حالك؟", "مرحباً! بخير والحمدلله", "أهلاً وسهلاً 😊"],
  thanks:       ["العفو 😊", "بكل سرور!", "لا شكر على واجب"],
  confirmation: ["شكراً جزيلاً!", "ممتاز، شكراً", "عظيم! سأتابع ذلك"],
  general:      ["👍", "شكراً", "حسناً، سأتابع الأمر"],
};

const SR_QUESTION   = /\?|؟|كيف|متى|أين|هل|ما |من |لماذا|ماذا|هل أنت|هل يمكن/;
const SR_PLAN       = /نخطط|مشروع|هدف|اتفقنا|سنقوم|سنبدأ|خطة|نفكر في|ننوي|نريد أن/;
const SR_TASK       = /يجب|ينبغي|اعمل|أرسل|ابعث|احجز|راجع|تواصل|حضّر|جهّز/;
const SR_GREETING   = /مرحبا|أهلا|السلام|صباح|مساء|أهلاً|هاي|هاى|كيف حال/;
const SR_THANKS     = /شكرا|شكراً|متشكر|ممنون|جزاك|بارك/;
const SR_CONFIRM    = /تمام|موافق|اوكي|أوكي|حسناً|بالتأكيد|صحيح|رائع|ممتاز/;

function generateSmartReplies(
  messages: { id: string; senderId: string; content: string }[],
  myId: string | undefined,
): string[] {
  if (!messages.length) return [];

  // Find the last message from the other person
  const lastOther = [...messages].reverse().find((m) => m.senderId !== myId);
  if (!lastOther) return [];

  const body = lastOther.content;

  let category = "general";
  if (SR_GREETING.test(body))   category = "greeting";
  else if (SR_THANKS.test(body)) category = "thanks";
  else if (SR_CONFIRM.test(body)) category = "confirmation";
  else if (SR_QUESTION.test(body)) category = "question";
  else if (SR_PLAN.test(body))   category = "plan";
  else if (SR_TASK.test(body))   category = "task";

  const pool = SMART_REPLY_POOLS[category] ?? SMART_REPLY_POOLS.general!;
  // Always return exactly 3 (or all if fewer)
  return pool.slice(0, 3);
}

// ─── Types ───────────────────────────────────────────────────────────────────────

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

  // AI state
  const [aiOpen, setAiOpen]       = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiResult, setAiResult]   = useState<AiChatResult | null>(null);
  const [aiSaved, setAiSaved]     = useState(false);

  // Smart Reply state
  const [smartReplies, setSmartReplies] = useState<string[]>([]);

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

  // Refresh smart replies whenever messages change
  useEffect(() => {
    setSmartReplies(generateSmartReplies(messages, user?.id));
  }, [messages, user?.id]);

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

  const runAi = async (action: AiAction) => {
    if (!messages.length) {
      Alert.alert("لا توجد رسائل", "لا توجد رسائل في هذه المحادثة لتحليلها.");
      return;
    }
    setAiRunning(true);
    setAiResult(null);
    setAiSaved(false);
    // Small delay for UX — makes it feel like processing
    await new Promise((r) => setTimeout(r, 900));
    try {
      const result = runLocalAI(action, messages, other?.name ?? "المحادثة");
      setAiResult(result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setAiRunning(false);
    }
  };

  const saveAiResults = async () => {
    if (!aiResult) return;
    await saveAiChatResult(aiResult);
    setAiSaved(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const closeAi = () => {
    setAiOpen(false);
    setAiResult(null);
    setAiSaved(false);
    setAiRunning(false);
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

        <Pressable
          style={({ pressed }) => [styles.aiBtn, pressed && { opacity: 0.7 }]}
          onPress={() => { setAiOpen(true); setAiResult(null); setAiSaved(false); }}
        >
          <Feather name="cpu" size={16} color={AI_PURPLE} />
        </Pressable>

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

      {/* ── Smart Reply chips (hidden while typing) ── */}
      {smartReplies.length > 0 && text.length === 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.srRow}
          contentContainerStyle={styles.srRowContent}
        >
          {smartReplies.map((reply, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.srChip, pressed && { opacity: 0.7 }]}
              onPress={() => setText(reply)}
            >
              <Feather name="zap" size={11} color={AI_PURPLE} style={styles.srChipIcon} />
              <Text style={styles.srChipText}>{reply}</Text>
            </Pressable>
          ))}
        </ScrollView>
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

      {/* ── AI Chat Assistant Modal ── */}
      <Modal visible={aiOpen} transparent animationType="slide" onRequestClose={closeAi}>
        <Pressable style={styles.aiOverlay} onPress={closeAi} />
        <View style={[styles.aiSheet, { paddingBottom: bottom + 20 }]}>
          <View style={styles.aiSheetHandle} />

          {/* Header */}
          <View style={styles.aiSheetHeader}>
            <Pressable onPress={closeAi} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
            <View style={styles.aiSheetTitleRow}>
              <View style={styles.aiSheetIconWrap}>
                <LinearGradient
                  colors={[AI_PURPLE, "#4F46E5"]}
                  style={styles.aiSheetIconGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Feather name="cpu" size={13} color="#FFFFFF" />
                </LinearGradient>
              </View>
              <Text style={styles.aiSheetTitle}>مساعد AI للمحادثة</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.aiSheetScroll}>

            {/* ── Option cards (shown when no result yet) ── */}
            {!aiResult && !aiRunning && (
              <View style={styles.aiOptions}>
                <Text style={styles.aiOptionsLabel}>
                  {messages.length} رسالة في هذه المحادثة — اختر ما تريد:
                </Text>

                {(
                  [
                    { action: "summarize"     as AiAction, icon: "align-left"   as const, label: "تلخيص المحادثة",   sub: "ملخص موجز لأبرز محتوى الرسائل"            },
                    { action: "extract-tasks" as AiAction, icon: "check-square" as const, label: "استخراج المهام",    sub: "يبحث عن مهام ومسؤوليات مذكورة في الرسائل" },
                    { action: "extract-goals" as AiAction, icon: "target"       as const, label: "استخراج الأهداف",  sub: "يستخلص أهدافًا ومشاريع من المحادثة"        },
                    { action: "action-plan"   as AiAction, icon: "zap"          as const, label: "توليد خطة عمل",    sub: "يجمع المهام والأهداف في خطة متكاملة"       },
                  ] as const
                ).map(({ action, icon, label, sub }) => (
                  <Pressable
                    key={action}
                    style={({ pressed }) => [styles.aiOptionCard, pressed && { opacity: 0.72, transform: [{ scale: 0.98 }] }]}
                    onPress={() => runAi(action)}
                  >
                    <View style={styles.aiOptionIcon}>
                      <Feather name={icon} size={18} color={AI_PURPLE} />
                    </View>
                    <View style={styles.aiOptionBody}>
                      <Text style={styles.aiOptionLabel}>{label}</Text>
                      <Text style={styles.aiOptionSub}>{sub}</Text>
                    </View>
                    <Feather name="chevron-left" size={14} color={colors.placeholder} />
                  </Pressable>
                ))}
              </View>
            )}

            {/* ── Processing spinner ── */}
            {aiRunning && (
              <View style={styles.aiLoadingWrap}>
                <ActivityIndicator size="large" color={AI_PURPLE} />
                <Text style={styles.aiLoadingText}>جارٍ التحليل بالذكاء الاصطناعي...</Text>
              </View>
            )}

            {/* ── Results ── */}
            {aiResult && !aiRunning && (
              <View style={styles.aiResultWrap}>

                {/* Result type badge */}
                <View style={styles.aiResultBadgeRow}>
                  <Pressable
                    style={styles.aiBackBtn}
                    onPress={() => { setAiResult(null); setAiSaved(false); }}
                  >
                    <Feather name="arrow-right" size={14} color={colors.textSecondary} />
                    <Text style={styles.aiBackText}>خيارات أخرى</Text>
                  </Pressable>
                  <View style={styles.aiResultBadge}>
                    <Text style={styles.aiResultBadgeText}>
                      {{
                        "summarize":     "ملخص",
                        "extract-tasks": "مهام",
                        "extract-goals": "أهداف",
                        "action-plan":   "خطة عمل",
                      }[aiResult.action]}
                    </Text>
                  </View>
                </View>

                {/* Summary block */}
                {aiResult.summary ? (
                  <View style={styles.aiSummaryCard}>
                    <View style={styles.aiSummaryHeader}>
                      <Feather name="align-left" size={14} color={AI_PURPLE} />
                      <Text style={styles.aiSummaryTitle}>الملخص</Text>
                    </View>
                    <Text style={styles.aiSummaryText}>{aiResult.summary}</Text>
                  </View>
                ) : null}

                {/* Tasks block */}
                {aiResult.tasks.length > 0 && (
                  <View style={styles.aiResultCard}>
                    <View style={styles.aiResultCardHeader}>
                      <Feather name="check-square" size={14} color="#34D399" />
                      <Text style={[styles.aiResultCardTitle, { color: "#34D399" }]}>
                        المهام ({aiResult.tasks.length})
                      </Text>
                    </View>
                    {aiResult.tasks.map((t, i) => (
                      <View key={i} style={styles.aiListRow}>
                        <View style={[styles.aiListDot, { backgroundColor: "#34D399" }]} />
                        <Text style={styles.aiListText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Goals block */}
                {aiResult.goals.length > 0 && (
                  <View style={styles.aiResultCard}>
                    <View style={styles.aiResultCardHeader}>
                      <Feather name="target" size={14} color={AI_PURPLE} />
                      <Text style={[styles.aiResultCardTitle, { color: AI_PURPLE }]}>
                        الأهداف ({aiResult.goals.length})
                      </Text>
                    </View>
                    {aiResult.goals.map((g, i) => (
                      <View key={i} style={styles.aiListRow}>
                        <View style={[styles.aiListDot, { backgroundColor: AI_PURPLE }]} />
                        <Text style={styles.aiListText}>{g}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Compat hint */}
                {(aiResult.tasks.length > 0 || aiResult.goals.length > 0) && (
                  <View style={styles.aiHint}>
                    <Feather name="info" size={11} color={colors.textSecondary} />
                    <Text style={styles.aiHintText}>
                      بعد الحفظ ستظهر في صفحة المهام (استيراد من AI) وصفحة الأهداف (مهام AI)
                    </Text>
                  </View>
                )}

                {/* Save / Saved button */}
                {(aiResult.tasks.length > 0 || aiResult.goals.length > 0) && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.aiSaveBtn,
                      aiSaved && styles.aiSaveBtnDone,
                      pressed && !aiSaved && { opacity: 0.8 },
                    ]}
                    onPress={saveAiResults}
                    disabled={aiSaved}
                  >
                    {aiSaved ? (
                      <>
                        <Feather name="check-circle" size={16} color="#34D399" />
                        <Text style={[styles.aiSaveBtnText, { color: "#34D399" }]}>تم الحفظ ✓</Text>
                      </>
                    ) : (
                      <>
                        <Feather name="download" size={16} color="#FFFFFF" />
                        <Text style={styles.aiSaveBtnText}>حفظ النتائج</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            )}

          </ScrollView>
        </View>
      </Modal>
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

    // ── Smart Reply chips ──
    srRow: { flexShrink: 0, borderTopWidth: 1, borderTopColor: colors.border },
    srRowContent: { flexDirection: "row-reverse", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
    srChip: {
      flexDirection: "row-reverse", alignItems: "center", gap: 5,
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: "#7C6EFA33",
      borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    },
    srChipIcon: { marginLeft: 2 },
    srChipText: {
      fontSize: 13, fontFamily: "Inter_500Medium",
      color: colors.text, writingDirection: "rtl",
    },

    // ── AI button ──
    aiBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: "#7C6EFA22", borderWidth: 1, borderColor: "#7C6EFA33",
      alignItems: "center", justifyContent: "center", flexShrink: 0,
    },

    // ── AI modal ──
    aiOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
    aiSheet: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      backgroundColor: colors.card,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border,
      maxHeight: "82%",
    },
    aiSheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.placeholder, alignSelf: "center", marginTop: 12, marginBottom: 4 },
    aiSheetHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingVertical: 14,
    },
    aiSheetTitleRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
    aiSheetIconWrap: { borderRadius: 10, overflow: "hidden" },
    aiSheetIconGrad: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
    aiSheetTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: colors.text, writingDirection: "rtl" },
    aiSheetScroll: { paddingHorizontal: 20 },

    // Options view
    aiOptions: { gap: 10, paddingBottom: 20 },
    aiOptionsLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textSecondary, writingDirection: "rtl", marginBottom: 4, textAlign: "right" },
    aiOptionCard: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: colors.bg, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border,
      paddingVertical: 14, paddingHorizontal: 16,
    },
    aiOptionIcon: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: "#7C6EFA18", alignItems: "center", justifyContent: "center", flexShrink: 0,
    },
    aiOptionBody: { flex: 1, gap: 3 },
    aiOptionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.text, writingDirection: "rtl" },
    aiOptionSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.textSecondary, writingDirection: "rtl" },

    // Loading
    aiLoadingWrap: { alignItems: "center", gap: 14, paddingVertical: 50 },
    aiLoadingText: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.textSecondary, writingDirection: "rtl" },

    // Results view
    aiResultWrap: { gap: 10, paddingBottom: 24 },
    aiResultBadgeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
    aiResultBadge: { backgroundColor: "#7C6EFA22", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    aiResultBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#7C6EFA", writingDirection: "rtl" },
    aiBackBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
    aiBackText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.textSecondary, writingDirection: "rtl" },
    aiSummaryCard: {
      backgroundColor: "#7C6EFA0D", borderRadius: 14,
      borderWidth: 1, borderColor: "#7C6EFA22", padding: 14, gap: 8,
    },
    aiSummaryHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 7 },
    aiSummaryTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#7C6EFA", writingDirection: "rtl" },
    aiSummaryText: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textSoft, writingDirection: "rtl", lineHeight: 20 },
    aiResultCard: {
      backgroundColor: colors.bg, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8,
    },
    aiResultCardHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 7 },
    aiResultCardTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", writingDirection: "rtl" },
    aiListRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 8 },
    aiListDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
    aiListText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textSoft, writingDirection: "rtl", lineHeight: 20 },
    aiHint: {
      flexDirection: "row-reverse", alignItems: "flex-start", gap: 6,
      backgroundColor: colors.cardAlt ?? colors.bg, borderRadius: 10, padding: 10,
    },
    aiHintText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: colors.textSecondary, writingDirection: "rtl", lineHeight: 16 },
    aiSaveBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, backgroundColor: "#7C6EFA", borderRadius: 14,
      paddingVertical: 14, marginTop: 4,
    },
    aiSaveBtnDone: { backgroundColor: "#34D39918", borderWidth: 1, borderColor: "#34D39933" },
    aiSaveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFFFFF", writingDirection: "rtl" },
  });
}
