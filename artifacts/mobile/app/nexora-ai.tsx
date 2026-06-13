import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DS } from "@/constants/ds";
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";

export const NEXORA_AI_TASKS_KEY = "@nexora_ai_saved_tasks";

export interface AiSavedTask {
  id: string;
  title: string;
  source: "nexora-ai";
  goalLabel: string;
  createdAt: string;
}

interface AiResult {
  summary: string;
  tasks: string[];
  timeline: string;
  dailyActions: string[];
}

// ─── Mock AI Engine ────────────────────────────────────────────────────────────

function detectCategory(input: string): string {
  const t = input.toLowerCase();
  if (/برمج|كود|تقني|بايثون|جافا|ويب|موبايل|تطبيق|خوارزم/.test(t)) return "programming";
  if (/وزن|رياضة|لياقة|جيم|صحة|تغذية|بروتين|رشاق/.test(t))             return "fitness";
  if (/مشروع|شركة|ستارتب|تجارة|مبيعات|ربح|منتج|عمل تجاري/.test(t))     return "business";
  if (/إنجليزي|لغة|عربي|فرنسي|ألماني|ترجم|قاموس|محادثة/.test(t))       return "language";
  if (/قرآن|حفظ|ديني|صلاة|عبادة/.test(t))                               return "quran";
  if (/كتاب|قراءة|مطالعة|روائي|مقال|كتابة/.test(t))                     return "reading";
  if (/مال|توفير|استثمار|بورصة|عقار|ميزانية/.test(t))                   return "finance";
  return "general";
}

const CATEGORY_DATA: Record<string, AiResult> = {
  programming: {
    summary:
      "هدف رائع! تعلم البرمجة يفتح أبوابًا لا حدود لها. الخطوات المُقترحة تبني مهاراتك من الأساس وصولًا إلى مشاريع حقيقية.",
    tasks: [
      "تعلم أساسيات HTML وCSS",
      "إتقان لغة JavaScript أو Python",
      "بناء مشروع صغير (موقع أو تطبيق)",
      "دراسة هياكل البيانات والخوارزميات",
      "المساهمة في مشاريع مفتوحة المصدر",
    ],
    timeline: "6 أشهر — شهر لكل مرحلة، مع أسبوع مراجعة بين المراحل",
    dailyActions: [
      "⌨️ كود لمدة ساعة على الأقل يوميًا",
      "📹 شاهد درسًا واحدًا أو مقطعًا تعليميًا",
      "🐛 احل تحديًا برمجيًا واحدًا (LeetCode / HackerRank)",
    ],
  },
  fitness: {
    summary:
      "اللياقة البدنية رحلة تبدأ بخطوة. الخطة المقترحة تجمع بين التمرين التدريجي والتغذية السليمة لنتائج دائمة.",
    tasks: [
      "تحديد الوزن المستهدف وحساب السعرات",
      "وضع جدول تمرين أسبوعي (3-5 أيام)",
      "تتبع الطعام والسعرات يوميًا",
      "استشارة مدرب أو اختصاصي تغذية",
      "قياس التقدم كل أسبوعين",
    ],
    timeline: "3 أشهر — تغييرات ملحوظة في الشهر الثاني، نتائج واضحة في الثالث",
    dailyActions: [
      "🏃 30 دقيقة تمرين قلبي أو مشي سريع",
      "💧 اشرب 8 أكواب ماء على الأقل",
      "🥗 سجّل وجباتك في تطبيق تتبع الطعام",
    ],
  },
  business: {
    summary:
      "المشاريع الناجحة تبدأ بفكرة واضحة وتنفيذ صبور. الخطة أدناه تحول فكرتك إلى مشروع قابل للتطبيق خطوة بخطوة.",
    tasks: [
      "صياغة فكرة المشروع وتحديد الجمهور المستهدف",
      "دراسة السوق والمنافسين",
      "بناء نموذج أولي أو MVP",
      "التحقق من الفكرة مع العملاء الأوليين",
      "إطلاق الإصدار التجريبي وجمع التغذية الراجعة",
    ],
    timeline: "4 أشهر — شهر للبحث، شهران للبناء، شهر للإطلاق",
    dailyActions: [
      "📝 اكتب 3 مهام أساسية لمشروعك كل صباح",
      "📞 تواصل مع شخص في مجالك أو عميل محتمل",
      "📊 راجع أرقامك وتقدمك كل مساء",
    ],
  },
  language: {
    summary:
      "تعلم لغة جديدة يثري عقلك ويوسع آفاقك. بالتواظب اليومي وهذه الخطة ستصل إلى مستوى محادثة خلال أشهر.",
    tasks: [
      "تعلم 500 كلمة شائعة بالبطاقات التعليمية",
      "إتقان القواعد الأساسية (الجمل البسيطة)",
      "الاستماع لـ podcast أو مقاطع باللغة الهدف",
      "ممارسة المحادثة مع متحدث أصلي أسبوعيًا",
      "مشاهدة فيلم أو مسلسل بالترجمة ثم بدونها",
    ],
    timeline: "6 أشهر للوصول إلى مستوى B1 (متوسط)",
    dailyActions: [
      "🗣️ راجع 20 كلمة جديدة بتطبيق Anki أو Duolingo",
      "👂 استمع 15 دقيقة بالغة الهدف",
      "✍️ اكتب جملة أو فقرة قصيرة باللغة الهدف",
    ],
  },
  quran: {
    summary:
      "حفظ القرآن الكريم عمل جليل يحتاج إلى نظام وصبر. الخطة المقترحة تجعل الحفظ سهلًا ومستدامًا بإذن الله.",
    tasks: [
      "تحديد الحزب أو الجزء المراد حفظه أولًا",
      "حفظ صفحة واحدة يوميًا مع التكرار",
      "مراجعة المحفوظ القديم أسبوعيًا",
      "الاستماع لتلاوة القارئ المفضل",
      "الانضمام لحلقة حفظ أو دراسة مع مجموعة",
    ],
    timeline: "سنة لحفظ جزأين مع التثبيت الجيد",
    dailyActions: [
      "📖 حفظ ربع صفحة صباحًا وربع مساءً",
      "🔊 استمع لتلاوة صفحة حفظها بالأمس",
      "🤲 راجع السورة المحفوظة في الصلاة",
    ],
  },
  reading: {
    summary:
      "القراءة هي غذاء العقل. هذه الخطة تبني عادة قراءة قوية وتمكّنك من إنهاء 12 كتابًا أو أكثر سنويًا.",
    tasks: [
      "اختر قائمة من 5 كتب تريد قراءتها",
      "خصص 30 دقيقة يوميًا للقراءة",
      "دوّن ملاحظاتك وأفكارك بعد كل فصل",
      "انضم لنادي قراءة أو شارك ملخصاتك",
      "طبّق ما تعلمته من كل كتاب",
    ],
    timeline: "3 أشهر لبناء عادة قراءة راسخة",
    dailyActions: [
      "📚 اقرأ 20 صفحة على الأقل يوميًا",
      "🖊️ اكتب جملة واحدة تلخص ما قرأته",
      "📵 أغلق الهاتف 30 دقيقة وخصصها للقراءة",
    ],
  },
  finance: {
    summary:
      "إدارة المال مهارة تُبنى بالوعي والتخطيط. هذه الخطة تساعدك على التوفير والاستثمار الذكي لمستقبل مالي أفضل.",
    tasks: [
      "تتبع مصاريفك الشهرية وتصنيفها",
      "وضع ميزانية بقاعدة 50/30/20",
      "بناء صندوق طوارئ (3-6 أشهر من النفقات)",
      "تعلم أساسيات الاستثمار في الأسهم أو الصناديق",
      "وضع هدف مالي واضح وجدول زمني له",
    ],
    timeline: "6 أشهر لبناء عادات مالية سليمة",
    dailyActions: [
      "💳 سجّل كل مصروف مهما كان صغيرًا",
      "📈 اقرأ مقالًا ماليًا واحدًا يوميًا",
      "🏦 راجع رصيدك وميزانيتك كل مساء",
    ],
  },
  general: {
    summary:
      "هدفك واضح والطريق أمامك! هذه خطة عملية تأخذك من الفكرة إلى الإنجاز بخطوات منطقية ومتدرجة.",
    tasks: [
      "تحديد الهدف بوضوح ووضع معايير النجاح",
      "تقسيم الهدف إلى خطوات صغيرة قابلة للتنفيذ",
      "تخصيص وقت يومي ثابت للعمل عليه",
      "متابعة التقدم أسبوعيًا وتعديل الخطة",
      "الاحتفاء بكل إنجاز صغير على الطريق",
    ],
    timeline: "90 يومًا — كافية لترى نتائج ملموسة مع الالتزام",
    dailyActions: [
      "✅ نفّذ مهمة واحدة متعلقة بهدفك يوميًا",
      "📓 اكتب تقدمك في مفكرة أو تطبيق",
      "🔋 خصص 20 دقيقة صباحية للتخطيط",
    ],
  },
};

function runMockAI(goal: string): Promise<AiResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const category = detectCategory(goal);
      resolve(CATEGORY_DATA[category] ?? CATEGORY_DATA.general!);
    }, 1600);
  });
}

// ─── Example chips ─────────────────────────────────────────────────────────────
const EXAMPLES = [
  "تعلم البرمجة",
  "خسارة الوزن",
  "إنشاء مشروع",
  "تعلم الإنجليزية",
  "توفير المال",
  "حفظ القرآن",
];

// ─── Component ─────────────────────────────────────────────────────────────────
export default function NexoraAIScreen() {
  const insets = useSafeAreaInsets();
  const top    = Platform.OS === "web" ? 67 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  const { accent, isDark } = useSettings();
  const colors  = useColors();
  const styles  = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [goal, setGoal]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<AiResult | null>(null);
  const [saved, setSaved]       = useState(false);
  const scrollRef               = useRef<ScrollView>(null);

  const AI_COLOR = "#7C6EFA";

  async function analyse() {
    const trimmed = goal.trim();
    if (!trimmed) return;
    setLoading(true);
    setResult(null);
    setSaved(false);
    try {
      const res = await runMockAI(trimmed);
      setResult(res);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    } finally {
      setLoading(false);
    }
  }

  async function saveTasks() {
    if (!result) return;
    const trimmed = goal.trim();
    const now     = new Date().toISOString();
    const newTasks: AiSavedTask[] = result.tasks.map((title, i) => ({
      id:        `ai-${Date.now()}-${i}`,
      title,
      source:    "nexora-ai",
      goalLabel: trimmed,
      createdAt: now,
    }));

    const raw     = await AsyncStorage.getItem(NEXORA_AI_TASKS_KEY);
    const existing: AiSavedTask[] = raw ? JSON.parse(raw) : [];
    const merged  = [...newTasks, ...existing];
    await AsyncStorage.setItem(NEXORA_AI_TASKS_KEY, JSON.stringify(merged));
    setSaved(true);
    Alert.alert(
      "✅ تم الحفظ",
      `تم حفظ ${result.tasks.length} مهام. يمكنك إضافتها لصفحة المهام لاحقًا.`,
    );
  }

  return (
    <View style={[styles.root, { paddingTop: top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Nexora AI</Text>
          <View style={[styles.aiBadge, { backgroundColor: AI_COLOR + "22" }]}>
            <Text style={[styles.aiBadgeText, { color: AI_COLOR }]}>Beta</Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.videoBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.push("/video-import")}
        >
          <Feather name="video" size={15} color={AI_COLOR} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: 40 + bottom }]}
      >

        {/* ── Hero Banner ── */}
        <LinearGradient
          colors={[AI_COLOR + "28", AI_COLOR + "08", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={[styles.heroIconWrap, { backgroundColor: AI_COLOR + "22" }]}>
            <LinearGradient
              colors={[AI_COLOR, "#4F46E5"]}
              style={styles.heroIconGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Feather name="cpu" size={28} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>محلل الأهداف الذكي</Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            أدخل هدفك وسيقوم Nexora AI بتحليله وتقديم{"\n"}خطة مهام ومتابعة يومية مخصصة لك
          </Text>
        </LinearGradient>

        {/* ── Input ── */}
        <View style={styles.inputSection}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>هدفك أو فكرتك</Text>
          <View style={[styles.inputWrap, { borderColor: goal.trim() ? AI_COLOR + "66" : colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={goal}
              onChangeText={(t) => { setGoal(t); setResult(null); setSaved(false); }}
              placeholder="مثال: تعلم البرمجة، خسارة الوزن..."
              placeholderTextColor={colors.placeholder}
              textAlign="right"
              multiline
              maxLength={200}
              returnKeyType="done"
            />
            {goal.length > 0 && (
              <Pressable style={styles.clearBtn} onPress={() => { setGoal(""); setResult(null); setSaved(false); }}>
                <Feather name="x" size={16} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>

          {/* Example chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {EXAMPLES.map((ex) => (
              <Pressable
                key={ex}
                style={[
                  styles.chip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  goal === ex && { backgroundColor: AI_COLOR + "22", borderColor: AI_COLOR + "55" },
                ]}
                onPress={() => { setGoal(ex); setResult(null); setSaved(false); }}
              >
                <Text style={[
                  styles.chipText,
                  { color: goal === ex ? AI_COLOR : colors.textSecondary },
                ]}>
                  {ex}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Analyse Button */}
          <Pressable
            style={({ pressed }) => [
              styles.analyseBtn,
              { opacity: (!goal.trim() || loading) ? 0.45 : pressed ? 0.82 : 1 },
            ]}
            onPress={analyse}
            disabled={!goal.trim() || loading}
          >
            <LinearGradient
              colors={[AI_COLOR, "#4F46E5"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.analyseBtnGrad}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="zap" size={18} color="#FFFFFF" />
                  <Text style={styles.analyseBtnText}>تحليل الهدف</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        {/* ── Loading state ── */}
        {loading && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={AI_COLOR} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              جارٍ تحليل هدفك وإعداد الخطة...
            </Text>
          </View>
        )}

        {/* ── Results ── */}
        {result && !loading && (
          <View style={styles.resultsSection}>

            {/* Summary */}
            <View style={[styles.resultCard, { borderColor: AI_COLOR + "33" }]}>
              <View style={styles.resultCardHeader}>
                <View style={[styles.resultCardIcon, { backgroundColor: AI_COLOR + "22" }]}>
                  <Feather name="align-left" size={15} color={AI_COLOR} />
                </View>
                <Text style={[styles.resultCardTitle, { color: colors.text }]}>ملخص الهدف</Text>
              </View>
              <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                {result.summary}
              </Text>
            </View>

            {/* Tasks */}
            <View style={[styles.resultCard, { borderColor: "#34D39933" }]}>
              <View style={styles.resultCardHeader}>
                <View style={[styles.resultCardIcon, { backgroundColor: "#34D39922" }]}>
                  <Feather name="check-square" size={15} color="#34D399" />
                </View>
                <Text style={[styles.resultCardTitle, { color: colors.text }]}>المهام المقترحة</Text>
              </View>
              {result.tasks.map((task, i) => (
                <View key={i} style={styles.taskRow}>
                  <View style={[styles.taskDot, { backgroundColor: "#34D399" }]} />
                  <Text style={[styles.taskText, { color: colors.textSoft }]}>{task}</Text>
                </View>
              ))}
            </View>

            {/* Timeline */}
            <View style={[styles.resultCard, { borderColor: "#F59E0B33" }]}>
              <View style={styles.resultCardHeader}>
                <View style={[styles.resultCardIcon, { backgroundColor: "#F59E0B22" }]}>
                  <Feather name="calendar" size={15} color="#F59E0B" />
                </View>
                <Text style={[styles.resultCardTitle, { color: colors.text }]}>الجدول الزمني</Text>
              </View>
              <View style={styles.timelineRow}>
                <Feather name="clock" size={14} color="#F59E0B" />
                <Text style={[styles.timelineText, { color: colors.textSecondary }]}>
                  {result.timeline}
                </Text>
              </View>
            </View>

            {/* Daily Actions */}
            <View style={[styles.resultCard, { borderColor: "#3B82F633" }]}>
              <View style={styles.resultCardHeader}>
                <View style={[styles.resultCardIcon, { backgroundColor: "#3B82F622" }]}>
                  <Feather name="sun" size={15} color="#3B82F6" />
                </View>
                <Text style={[styles.resultCardTitle, { color: colors.text }]}>الإجراءات اليومية</Text>
              </View>
              {result.dailyActions.map((action, i) => (
                <View key={i} style={styles.dailyRow}>
                  <Text style={[styles.dailyText, { color: colors.textSoft }]}>{action}</Text>
                </View>
              ))}
            </View>

            {/* Save button */}
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                {
                  backgroundColor: saved ? "#34D39922" : colors.card,
                  borderColor:     saved ? "#34D39955" : colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              onPress={saveTasks}
              disabled={saved}
            >
              <Feather
                name={saved ? "check-circle" : "download"}
                size={18}
                color={saved ? "#34D399" : colors.textSecondary}
              />
              <Text style={[styles.saveBtnText, { color: saved ? "#34D399" : colors.textSecondary }]}>
                {saved ? "تم حفظ المهام ✓" : "حفظ المهام المقترحة"}
              </Text>
            </Pressable>

            <Text style={[styles.saveHint, { color: colors.textTertiary }]}>
              المهام المحفوظة ستكون متاحة في صفحة المهام لإضافتها لاحقًا
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
function makeStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingHorizontal: DS.spacing.xl },

    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: DS.spacing.xl, paddingVertical: DS.spacing.md,
      borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
    },
    backBtn:      { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    videoBtn:     { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#7C6EFA22", borderWidth: 1, borderColor: "#7C6EFA33" },
    headerCenter: { flexDirection: "row", alignItems: "center", gap: DS.spacing.sm },
    headerTitle:  { fontSize: DS.font.size.lg, fontFamily: DS.font.family.bold, color: colors.text },
    aiBadge:      { paddingHorizontal: DS.spacing.sm, paddingVertical: 2, borderRadius: DS.radius.pill },
    aiBadgeText:  { fontSize: DS.font.size.xxs, fontFamily: DS.font.family.bold, letterSpacing: 0.5 },

    heroBanner: {
      marginTop: DS.spacing.xl,
      borderRadius: DS.radius.xxl,
      padding: DS.spacing.xxl,
      alignItems: "center",
      gap: DS.spacing.sm,
      borderWidth: 1,
      borderColor: "#7C6EFA22",
    },
    heroIconWrap: { borderRadius: DS.radius.xl, padding: 6, marginBottom: DS.spacing.xs },
    heroIconGrad: { width: 64, height: 64, borderRadius: DS.radius.xl, alignItems: "center", justifyContent: "center" },
    heroTitle:    { fontSize: DS.font.size.xl, fontFamily: DS.font.family.bold, textAlign: "center", writingDirection: "rtl" },
    heroSub:      { fontSize: DS.font.size.sm, fontFamily: DS.font.family.regular, textAlign: "center", lineHeight: 20, writingDirection: "rtl" },

    inputSection: { marginTop: DS.spacing.xxl, gap: DS.spacing.md },
    inputLabel:   { fontSize: DS.font.size.sm, fontFamily: DS.font.family.semibold, writingDirection: "rtl" },
    inputWrap: {
      borderWidth: 1.5, borderRadius: DS.radius.xl,
      backgroundColor: colors.card,
      paddingHorizontal: DS.spacing.lg,
      paddingVertical: DS.spacing.md,
      minHeight: 80,
    },
    input: {
      fontSize: DS.font.size.md, fontFamily: DS.font.family.regular,
      writingDirection: "rtl", minHeight: 50, textAlignVertical: "top",
    },
    clearBtn: { alignSelf: "flex-start", padding: 4 },

    chipsRow: { gap: DS.spacing.sm, paddingVertical: DS.spacing.xs },
    chip: {
      paddingHorizontal: DS.spacing.md, paddingVertical: DS.spacing.xs,
      borderRadius: DS.radius.pill, borderWidth: 1,
    },
    chipText: { fontSize: DS.font.size.sm, fontFamily: DS.font.family.medium, writingDirection: "rtl" },

    analyseBtn: { borderRadius: DS.radius.xl, overflow: "hidden" },
    analyseBtnGrad: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: DS.spacing.sm, paddingVertical: DS.spacing.lg,
    },
    analyseBtnText: {
      fontSize: DS.font.size.md, fontFamily: DS.font.family.bold,
      color: "#FFFFFF", writingDirection: "rtl",
    },

    loadingCard: {
      marginTop: DS.spacing.xxl, alignItems: "center",
      gap: DS.spacing.md, paddingVertical: DS.spacing.xxxl,
    },
    loadingText: {
      fontSize: DS.font.size.sm, fontFamily: DS.font.family.regular,
      writingDirection: "rtl", textAlign: "center",
    },

    resultsSection: { marginTop: DS.spacing.xxl, gap: DS.spacing.md },

    resultCard: {
      backgroundColor: colors.card,
      borderRadius: DS.radius.xl,
      borderWidth: 1,
      padding: DS.spacing.lg,
      gap: DS.spacing.md,
      ...DS.shadow.sm,
    },
    resultCardHeader: { flexDirection: "row-reverse", alignItems: "center", gap: DS.spacing.sm },
    resultCardIcon:   { width: 32, height: 32, borderRadius: DS.radius.md, alignItems: "center", justifyContent: "center" },
    resultCardTitle:  { fontSize: DS.font.size.base, fontFamily: DS.font.family.bold, writingDirection: "rtl" },

    summaryText: {
      fontSize: DS.font.size.sm, fontFamily: DS.font.family.regular,
      lineHeight: 22, writingDirection: "rtl", textAlign: "right",
    },

    taskRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: DS.spacing.sm },
    taskDot: { width: 7, height: 7, borderRadius: DS.radius.full, marginTop: 6 },
    taskText: { flex: 1, fontSize: DS.font.size.sm, fontFamily: DS.font.family.medium, writingDirection: "rtl", lineHeight: 22 },

    timelineRow: { flexDirection: "row-reverse", alignItems: "center", gap: DS.spacing.sm },
    timelineText: { flex: 1, fontSize: DS.font.size.sm, fontFamily: DS.font.family.medium, writingDirection: "rtl" },

    dailyRow: { paddingVertical: DS.spacing.xs },
    dailyText: { fontSize: DS.font.size.sm, fontFamily: DS.font.family.regular, writingDirection: "rtl", lineHeight: 22 },

    saveBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: DS.spacing.sm, paddingVertical: DS.spacing.lg,
      borderRadius: DS.radius.xl, borderWidth: 1,
      marginTop: DS.spacing.sm,
    },
    saveBtnText: { fontSize: DS.font.size.base, fontFamily: DS.font.family.semibold, writingDirection: "rtl" },
    saveHint: {
      fontSize: DS.font.size.xs, fontFamily: DS.font.family.regular,
      textAlign: "center", writingDirection: "rtl",
      marginTop: DS.spacing.xs,
    },
  });
}
