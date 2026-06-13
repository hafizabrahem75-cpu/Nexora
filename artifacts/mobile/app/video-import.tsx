import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DS } from "@/constants/ds";
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import type { AiSavedTask } from "./nexora-ai";
import { NEXORA_AI_TASKS_KEY } from "./nexora-ai";

// ─── Constants ──────────────────────────────────────────────────────────────────
const VIDEO_IMPORTS_KEY = "@nexora_video_imports";
const AI_PURPLE = "#7C6EFA";
const AI_ORANGE = "#F59E0B";

// ─── Types ───────────────────────────────────────────────────────────────────────
type ProcessingStatus = "pending" | "processing" | "completed" | "error";

interface VideoImportRecord {
  id: string;
  fileName: string;
  duration: number;
  uploadDate: string;
  status: ProcessingStatus;
  goalLabel: string;
  tasks: string[];
}

// ─── Mock AI categories (reuse same content model as nexora-ai) ─────────────────
const VIDEO_GOAL_TEMPLATES = [
  {
    goalLabel: "إتقان مهارة جديدة من الفيديو",
    tasks: [
      "مشاهدة الفيديو مرة أخرى وتدوين النقاط الرئيسية",
      "تطبيق ما تعلمته في مشروع صغير",
      "البحث عن مصادر إضافية لتعمّق الفهم",
      "مشاركة ما تعلمته مع شخص آخر",
      "تقييم تقدمك بعد أسبوع من التطبيق",
    ],
  },
  {
    goalLabel: "تطبيق محتوى الفيديو التعليمي",
    tasks: [
      "تلخيص الفيديو في 5 نقاط رئيسية",
      "إنشاء خطة عمل أسبوعية بناءً على المحتوى",
      "تنفيذ التمارين أو الأنشطة المذكورة",
      "قياس النتائج بعد أسبوعين",
      "مراجعة ومشاركة ما اكتسبته",
    ],
  },
  {
    goalLabel: "تحقيق هدف مستوحى من الفيديو",
    tasks: [
      "تحديد الهدف الرئيسي المستخلص من الفيديو",
      "كتابة خطة عمل واضحة بخطوات محددة",
      "تخصيص ساعة يومياً للعمل على الهدف",
      "متابعة التقدم أسبوعياً وتعديل الخطة",
      "الاحتفال بكل إنجاز صغير على الطريق",
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────────
async function loadImports(): Promise<VideoImportRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(VIDEO_IMPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveImports(list: VideoImportRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(VIDEO_IMPORTS_KEY, JSON.stringify(list));
  } catch {}
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "غير معروف";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  } catch {
    return iso;
  }
}

// ─── Mock analysis ────────────────────────────────────────────────────────────────
function runMockVideoAnalysis(fileName: string): Promise<{ goalLabel: string; tasks: string[] }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const idx = Math.abs(fileName.length % VIDEO_GOAL_TEMPLATES.length);
      resolve(VIDEO_GOAL_TEMPLATES[idx] ?? VIDEO_GOAL_TEMPLATES[0]!);
    }, 2800);
  });
}

// ─── Component ───────────────────────────────────────────────────────────────────
export default function VideoImportScreen() {
  const insets = useSafeAreaInsets();
  const top    = Platform.OS === "web" ? 67 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  const colors = useColors();
  const { isDark } = useSettings();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [imports, setImports]         = useState<VideoImportRecord[]>([]);
  const [loaded, setLoaded]           = useState(false);
  const [picking, setPicking]         = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const scrollRef                     = useRef<ScrollView>(null);

  // Load history on mount
  React.useEffect(() => {
    loadImports().then((list) => {
      setImports(list);
      setLoaded(true);
    });
  }, []);

  const pickVideo = async () => {
    if (picking || processingId) return;
    setPicking(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("الإذن مطلوب", "يرجى السماح بالوصول إلى مكتبة الوسائط لاستيراد الفيديو.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "videos",
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0]!;
      const fileName = asset.fileName ?? asset.uri.split("/").pop() ?? "video.mp4";
      const duration = asset.duration ? Math.round(asset.duration) : 0;

      const record: VideoImportRecord = {
        id:         `vid-${Date.now()}`,
        fileName,
        duration,
        uploadDate: new Date().toISOString(),
        status:     "pending",
        goalLabel:  "",
        tasks:      [],
      };

      const updatedList = [record, ...imports];
      setImports(updatedList);
      await saveImports(updatedList);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Start processing
      processVideo(record, updatedList);
    } finally {
      setPicking(false);
    }
  };

  const processVideo = useCallback(async (record: VideoImportRecord, currentList: VideoImportRecord[]) => {
    setProcessingId(record.id);

    // Mark as processing
    const processingList = currentList.map((r) =>
      r.id === record.id ? { ...r, status: "processing" as ProcessingStatus } : r
    );
    setImports(processingList);
    await saveImports(processingList);

    try {
      const analysis = await runMockVideoAnalysis(record.fileName);

      // Mark as completed
      const completedRecord: VideoImportRecord = {
        ...record,
        status:     "completed",
        goalLabel:  analysis.goalLabel,
        tasks:      analysis.tasks,
      };
      const completedList = processingList.map((r) =>
        r.id === record.id ? completedRecord : r
      );
      setImports(completedList);
      await saveImports(completedList);

      // Save tasks to shared AI tasks store (compatible with import + goals systems)
      const now = new Date().toISOString();
      const aiTasks: AiSavedTask[] = analysis.tasks.map((title, i) => ({
        id:        `${record.id}-task-${i}`,
        title,
        source:    "nexora-ai" as const,
        goalLabel: analysis.goalLabel,
        createdAt: now,
      }));
      const rawExisting = await AsyncStorage.getItem(NEXORA_AI_TASKS_KEY);
      const existing: AiSavedTask[] = rawExisting ? JSON.parse(rawExisting) : [];
      await AsyncStorage.setItem(NEXORA_AI_TASKS_KEY, JSON.stringify([...aiTasks, ...existing]));

      setExpandedId(record.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 200);
    } catch {
      const errorList = processingList.map((r) =>
        r.id === record.id ? { ...r, status: "error" as ProcessingStatus } : r
      );
      setImports(errorList);
      await saveImports(errorList);
    } finally {
      setProcessingId(null);
    }
  }, [imports]);

  const deleteImport = async (id: string) => {
    const updated = imports.filter((r) => r.id !== id);
    setImports(updated);
    await saveImports(updated);
    if (expandedId === id) setExpandedId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const statusLabel = (status: ProcessingStatus) => {
    switch (status) {
      case "pending":    return "في الانتظار";
      case "processing": return "جارٍ التحليل...";
      case "completed":  return "اكتمل التحليل";
      case "error":      return "فشل التحليل";
    }
  };

  const statusColor = (status: ProcessingStatus) => {
    switch (status) {
      case "pending":    return colors.textSecondary;
      case "processing": return AI_ORANGE;
      case "completed":  return "#34D399";
      case "error":      return "#FF453A";
    }
  };

  const renderItem = ({ item }: { item: VideoImportRecord }) => {
    const isExpanded  = expandedId === item.id;
    const isProcessing = item.status === "processing";

    return (
      <View style={[styles.card, isExpanded && styles.cardExpanded]}>
        {/* Card Header */}
        <Pressable
          style={styles.cardRow}
          onPress={() => item.status === "completed" && setExpandedId(isExpanded ? null : item.id)}
        >
          <View style={styles.cardLeft}>
            <Pressable
              style={styles.deleteBtn}
              onPress={() => deleteImport(item.id)}
              hitSlop={8}
            >
              <Feather name="trash-2" size={14} color="#FF453A" />
            </Pressable>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.cardFileName} numberOfLines={1}>{item.fileName}</Text>
            <View style={styles.cardMeta}>
              {item.duration > 0 && (
                <View style={styles.cardChip}>
                  <Feather name="clock" size={10} color={colors.textSecondary} />
                  <Text style={styles.cardChipText}>{formatDuration(item.duration)}</Text>
                </View>
              )}
              <View style={styles.cardChip}>
                <Feather name="calendar" size={10} color={colors.textSecondary} />
                <Text style={styles.cardChipText}>{formatDate(item.uploadDate)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardRight}>
            {isProcessing ? (
              <ActivityIndicator size="small" color={AI_ORANGE} />
            ) : (
              <View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} />
            )}
            <Text style={[styles.statusText, { color: statusColor(item.status) }]} numberOfLines={1}>
              {statusLabel(item.status)}
            </Text>
            {item.status === "completed" && (
              <Feather
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={14}
                color={colors.textSecondary}
              />
            )}
          </View>
        </Pressable>

        {/* Result Card (expanded) */}
        {isExpanded && item.status === "completed" && (
          <View style={styles.resultSection}>
            <View style={styles.resultDivider} />

            {/* Goal */}
            <View style={styles.resultGoalRow}>
              <View style={styles.resultGoalIcon}>
                <Feather name="target" size={13} color={AI_PURPLE} />
              </View>
              <Text style={styles.resultGoalLabel} numberOfLines={2}>{item.goalLabel}</Text>
            </View>

            {/* Tasks */}
            <Text style={styles.resultTasksTitle}>المهام المقترحة</Text>
            {item.tasks.map((task, i) => (
              <View key={i} style={styles.resultTaskRow}>
                <View style={styles.resultTaskDot} />
                <Text style={styles.resultTaskText}>{task}</Text>
              </View>
            ))}

            {/* Hint */}
            <View style={styles.resultHint}>
              <Feather name="info" size={12} color={colors.textSecondary} />
              <Text style={styles.resultHintText}>
                تمت إضافة المهام إلى Nexora AI — يمكنك استيرادها من صفحة المهام أو تحويلها لهدف من صفحة الأهداف
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>استيراد فيديو</Text>
          <View style={styles.aiBadge}>
            <Feather name="cpu" size={11} color={AI_PURPLE} />
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: 40 + bottom }]}
      >

        {/* ── Hero Banner ── */}
        <LinearGradient
          colors={[AI_PURPLE + "28", AI_PURPLE + "08", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroIconWrap}>
            <LinearGradient
              colors={[AI_PURPLE, "#4F46E5"]}
              style={styles.heroIconGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Feather name="video" size={26} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <Text style={styles.heroTitle}>تحليل الفيديو بالذكاء الاصطناعي</Text>
          <Text style={styles.heroSub}>
            اختر فيديو من مكتبتك وسيقوم Nexora AI بتحليله{"\n"}
            وتوليد هدف ومهام قابلة للتنفيذ تلقائياً
          </Text>
        </LinearGradient>

        {/* ── Pick Button ── */}
        <Pressable
          style={({ pressed }) => [
            styles.pickBtn,
            (picking || !!processingId) && { opacity: 0.45 },
            pressed && { opacity: 0.8 },
          ]}
          onPress={pickVideo}
          disabled={picking || !!processingId}
        >
          <LinearGradient
            colors={[AI_PURPLE, "#4F46E5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.pickBtnGrad}
          >
            {picking ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="upload" size={18} color="#FFFFFF" />
                <Text style={styles.pickBtnText}>اختر فيديو من المكتبة</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        {processingId && (
          <View style={styles.processingBanner}>
            <ActivityIndicator size="small" color={AI_ORANGE} />
            <Text style={styles.processingBannerText}>
              جارٍ تحليل الفيديو... يرجى الانتظار
            </Text>
          </View>
        )}

        {/* ── History ── */}
        {loaded && (
          <>
            {imports.length > 0 ? (
              <>
                <View style={styles.sectionHeader}>
                  <Feather name="clock" size={13} color={colors.textSecondary} />
                  <Text style={styles.sectionTitle}>سجل الاستيراد</Text>
                </View>
                {imports.map((item) => (
                  <React.Fragment key={item.id}>
                    {renderItem({ item })}
                  </React.Fragment>
                ))}
              </>
            ) : (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconWrap}>
                  <Feather name="video-off" size={28} color={colors.placeholder} />
                </View>
                <Text style={styles.emptyTitle}>لا توجد فيديوهات مستوردة</Text>
                <Text style={styles.emptySubtitle}>
                  اضغط على الزر أعلاه لاختيار فيديو{"\n"}وتحليله بالذكاء الاصطناعي
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────────
function makeStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingHorizontal: DS.spacing.xl, paddingTop: DS.spacing.lg },

    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: DS.spacing.xl, paddingVertical: DS.spacing.md,
      borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
    },
    backBtn:      { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    headerCenter: { flexDirection: "row", alignItems: "center", gap: DS.spacing.sm },
    headerTitle:  { fontSize: DS.font.size.lg, fontFamily: DS.font.family.bold, color: colors.text, writingDirection: "rtl" },
    aiBadge:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: DS.spacing.sm, paddingVertical: 2, borderRadius: DS.radius.pill, backgroundColor: AI_PURPLE + "22" },
    aiBadgeText:  { fontSize: DS.font.size.xxs, fontFamily: DS.font.family.bold, color: AI_PURPLE, letterSpacing: 0.5 },

    heroBanner: {
      borderRadius: DS.radius.xxl, padding: DS.spacing.xxl,
      alignItems: "center", gap: DS.spacing.sm,
      borderWidth: 1, borderColor: AI_PURPLE + "22",
      marginBottom: DS.spacing.xl,
    },
    heroIconWrap: { borderRadius: DS.radius.xl, padding: 6, marginBottom: DS.spacing.xs, backgroundColor: AI_PURPLE + "22" },
    heroIconGrad: { width: 58, height: 58, borderRadius: DS.radius.xl, alignItems: "center", justifyContent: "center" },
    heroTitle:    { fontSize: DS.font.size.xl, fontFamily: DS.font.family.bold, color: colors.text, textAlign: "center", writingDirection: "rtl" },
    heroSub:      { fontSize: DS.font.size.sm, fontFamily: DS.font.family.regular, color: colors.textSecondary, textAlign: "center", lineHeight: 20, writingDirection: "rtl" },

    pickBtn: { borderRadius: DS.radius.xl, overflow: "hidden", marginBottom: DS.spacing.lg },
    pickBtnGrad: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: DS.spacing.sm, paddingVertical: 16,
    },
    pickBtnText: { fontSize: DS.font.size.md, fontFamily: DS.font.family.semibold, color: "#FFFFFF", writingDirection: "rtl" },

    processingBanner: {
      flexDirection: "row-reverse", alignItems: "center", gap: 10,
      backgroundColor: AI_ORANGE + "18", borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 12,
      borderWidth: 1, borderColor: AI_ORANGE + "33",
      marginBottom: DS.spacing.lg,
    },
    processingBannerText: { flex: 1, fontSize: DS.font.size.sm, fontFamily: DS.font.family.medium, color: AI_ORANGE, writingDirection: "rtl" },

    sectionHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: DS.spacing.md },
    sectionTitle:  { fontSize: DS.font.size.xs, fontFamily: DS.font.family.semibold, color: colors.textSecondary, writingDirection: "rtl", textTransform: "uppercase", letterSpacing: 0.5 },

    card: {
      backgroundColor: colors.card, borderRadius: DS.radius.xl,
      borderWidth: 1, borderColor: colors.border,
      marginBottom: DS.spacing.md, overflow: "hidden",
    },
    cardExpanded: { borderColor: AI_PURPLE + "44" },
    cardRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
    cardLeft: { flexShrink: 0 },
    cardBody: { flex: 1, gap: 5 },
    cardFileName: { fontSize: DS.font.size.sm, fontFamily: DS.font.family.semibold, color: colors.text, writingDirection: "rtl" },
    cardMeta: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
    cardChip: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
    cardChipText: { fontSize: DS.font.size.xxs, fontFamily: DS.font.family.regular, color: colors.textSecondary, writingDirection: "rtl" },
    cardRight: { flexDirection: "column", alignItems: "flex-start", gap: 4, flexShrink: 0, minWidth: 80 },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontSize: 10, fontFamily: DS.font.family.medium, writingDirection: "rtl" },

    deleteBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#FF453A1A", alignItems: "center", justifyContent: "center" },

    resultSection: { paddingHorizontal: 14, paddingBottom: 16, gap: 10 },
    resultDivider: { height: 1, backgroundColor: colors.border, marginBottom: 6 },
    resultGoalRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
    resultGoalIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: AI_PURPLE + "22", alignItems: "center", justifyContent: "center", flexShrink: 0 },
    resultGoalLabel: { flex: 1, fontSize: DS.font.size.sm, fontFamily: DS.font.family.semibold, color: colors.text, writingDirection: "rtl" },
    resultTasksTitle: { fontSize: DS.font.size.xs, fontFamily: DS.font.family.semibold, color: colors.textSecondary, writingDirection: "rtl", marginTop: 4 },
    resultTaskRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 8 },
    resultTaskDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: AI_PURPLE, marginTop: 7, flexShrink: 0 },
    resultTaskText: { flex: 1, fontSize: DS.font.size.sm, fontFamily: DS.font.family.regular, color: colors.textSoft, writingDirection: "rtl", lineHeight: 20 },
    resultHint: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 6, backgroundColor: colors.bg, borderRadius: 10, padding: 10, marginTop: 4 },
    resultHintText: { flex: 1, fontSize: 11, fontFamily: DS.font.family.regular, color: colors.textSecondary, writingDirection: "rtl", lineHeight: 16 },

    emptyWrap: { alignItems: "center", gap: 10, paddingTop: 40, paddingBottom: 40 },
    emptyIconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", marginBottom: 8 },
    emptyTitle: { fontSize: DS.font.size.md, fontFamily: DS.font.family.semibold, color: colors.textSoft, textAlign: "center", writingDirection: "rtl" },
    emptySubtitle: { fontSize: DS.font.size.sm, fontFamily: DS.font.family.regular, color: colors.textSecondary, textAlign: "center", writingDirection: "rtl", lineHeight: 20 },
  });
}
