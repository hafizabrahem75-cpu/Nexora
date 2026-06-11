import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { useAuth } from "@/context/AuthContext";
import { ACCENT_COLORS, useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import { ApiError } from "@/lib/api";

const TOTAL_STEPS = 5;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

interface FormData {
  name:            string;
  username:        string;
  email:           string;
  phone:           string;
  password:        string;
  confirmPassword: string;
  avatarColor:     string;
}

const STEP_META: {
  icon:     React.ComponentProps<typeof Feather>["name"];
  title:    string;
  subtitle: string;
}[] = [
  { icon: "user",   title: "معلوماتك الأساسية", subtitle: "أخبرنا باسمك واسم المستخدم"       },
  { icon: "mail",   title: "بيانات التواصل",    subtitle: "سيُستخدم بريدك لتأكيد الحساب"    },
  { icon: "lock",   title: "كلمة المرور",        subtitle: "اختر كلمة مرور قوية وآمنة"        },
  { icon: "smile",  title: "شخصيتك",             subtitle: "اختر لوناً يمثّلك في ملفك الشخصي" },
  { icon: "check-circle", title: "مراجعة البيانات", subtitle: "تأكد من صحة المعلومات قبل الإنشاء" },
];

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const top    = Platform.OS === "web" ? 67 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  const { signUp } = useAuth();
  const { accent } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({
    name: "", username: "", email: "", phone: "",
    password: "", confirmPassword: "",
    avatarColor: accent,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  function patch(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  function canAdvance(): boolean {
    switch (step) {
      case 1:
        return (
          form.name.trim().length >= 2 &&
          USERNAME_RE.test(form.username)
        );
      case 2: return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
      case 3: return form.password.length >= 8 && form.password === form.confirmPassword;
      default: return true;
    }
  }

  async function handleNext() {
    setError("");
    if (step < TOTAL_STEPS) {
      Haptics.selectionAsync();
      setStep((s) => s + 1);
    } else {
      await handleSubmit();
    }
  }

  async function handleSubmit() {
    if (loading) return;
    setLoading(true);
    try {
      await signUp(
        form.email.trim(),
        form.password,
        form.name.trim(),
        form.username.trim(),
        form.avatarColor,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/home");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "حدث خطأ ما، يرجى المحاولة مجدداً";
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLoading(false);
    }
  }

  const meta = STEP_META[step - 1];

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: top, paddingBottom: bottom }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => (step > 1 ? setStep((s) => s - 1) : router.back())}
          hitSlop={12}
        >
          <Feather name="arrow-right" size={20} color={colors.textSecondary} />
        </Pressable>

        <StepIndicator current={step} total={TOTAL_STEPS} accent={accent} colors={colors} />

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Step hero ── */}
        <View style={styles.stepHero}>
          <View style={[styles.stepIconWrap, { backgroundColor: accent + "1E", borderColor: accent + "44" }]}>
            <Feather name={meta.icon} size={30} color={accent} />
          </View>
          <Text style={styles.stepTitle}>{meta.title}</Text>
          <Text style={styles.stepSubtitle}>{meta.subtitle}</Text>
        </View>

        {/* ── Step 1: Name + Username ── */}
        {step === 1 && (
          <View style={styles.form}>
            <FieldGroup label="الاسم الكامل" required styles={styles}>
              <TextInput
                style={styles.input}
                placeholder="محمد أحمد"
                placeholderTextColor={colors.placeholder}
                value={form.name}
                onChangeText={(v) => patch("name", v)}
                autoCapitalize="words"
                textAlign="right"
                returnKeyType="next"
              />
            </FieldGroup>

            <FieldGroup label="اسم المستخدم" required styles={styles}>
              <View style={[
                styles.inputContainer,
                form.username.length > 0 && !USERNAME_RE.test(form.username) && { borderColor: "#F59E0B66" },
              ]}>
                <TextInput
                  style={styles.inputInner}
                  placeholder="username"
                  placeholderTextColor={colors.placeholder}
                  value={form.username}
                  onChangeText={(v) => patch("username", v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textAlign="left"
                  returnKeyType="done"
                  maxLength={20}
                />
                <Text style={[styles.inputAffix, { color: colors.textSecondary }]}>@</Text>
              </View>
              {form.username.length > 0 && !USERNAME_RE.test(form.username) && (
                <Text style={styles.fieldHint}>3-20 حرف: أحرف إنجليزية صغيرة، أرقام، أو _</Text>
              )}
            </FieldGroup>
          </View>
        )}

        {/* ── Step 2: Email + Phone ── */}
        {step === 2 && (
          <View style={styles.form}>
            <FieldGroup label="البريد الإلكتروني" required styles={styles}>
              <TextInput
                style={styles.input}
                placeholder="example@email.com"
                placeholderTextColor={colors.placeholder}
                value={form.email}
                onChangeText={(v) => patch("email", v)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textAlign="right"
                returnKeyType="next"
              />
            </FieldGroup>

            <FieldGroup label="رقم الهاتف" hint="اختياري" styles={styles}>
              <TextInput
                style={styles.input}
                placeholder="+966 5xx xxx xxxx"
                placeholderTextColor={colors.placeholder}
                value={form.phone}
                onChangeText={(v) => patch("phone", v)}
                keyboardType="phone-pad"
                textAlign="right"
                returnKeyType="done"
              />
            </FieldGroup>
          </View>
        )}

        {/* ── Step 3: Password ── */}
        {step === 3 && (
          <View style={styles.form}>
            <FieldGroup label="كلمة المرور" required styles={styles}>
              <View style={[styles.inputContainer, form.password.length > 0 && form.password.length < 8 && { borderColor: "#F59E0B66" }]}>
                <TextInput
                  style={styles.inputInner}
                  placeholder="8 أحرف على الأقل"
                  placeholderTextColor={colors.placeholder}
                  value={form.password}
                  onChangeText={(v) => patch("password", v)}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  textAlign="right"
                  returnKeyType="next"
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8} style={styles.eyeBtn}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
              {form.password.length > 0 && form.password.length < 8 && (
                <Text style={styles.fieldHint}>كلمة المرور يجب أن تكون 8 أحرف على الأقل</Text>
              )}
            </FieldGroup>

            <FieldGroup label="تأكيد كلمة المرور" required styles={styles}>
              <View style={[
                styles.inputContainer,
                form.confirmPassword.length > 0 && form.password !== form.confirmPassword && { borderColor: "#FF453A66" },
              ]}>
                <TextInput
                  style={styles.inputInner}
                  placeholder="أعد إدخال كلمة المرور"
                  placeholderTextColor={colors.placeholder}
                  value={form.confirmPassword}
                  onChangeText={(v) => patch("confirmPassword", v)}
                  secureTextEntry={!showConfirm}
                  autoComplete="new-password"
                  textAlign="right"
                  returnKeyType="done"
                  onSubmitEditing={handleNext}
                />
                <Pressable onPress={() => setShowConfirm((v) => !v)} hitSlop={8} style={styles.eyeBtn}>
                  <Feather name={showConfirm ? "eye-off" : "eye"} size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
              {form.confirmPassword.length > 0 && form.password !== form.confirmPassword && (
                <Text style={[styles.fieldHint, { color: "#FF453A" }]}>كلمتا المرور غير متطابقتان</Text>
              )}
            </FieldGroup>

            {/* Strength indicator */}
            {form.password.length > 0 && (
              <PasswordStrength password={form.password} accent={accent} styles={styles} />
            )}
          </View>
        )}

        {/* ── Step 4: Avatar Color ── */}
        {step === 4 && (
          <View style={styles.form}>
            <FieldGroup label="لون ملفك الشخصي" styles={styles}>
              <View style={styles.colorGrid}>
                {ACCENT_COLORS.map((c) => (
                  <Pressable
                    key={c.id}
                    style={({ pressed }) => [
                      styles.colorSwatch,
                      { backgroundColor: c.value },
                      form.avatarColor === c.value && styles.colorSwatchActive,
                      pressed && { transform: [{ scale: 0.88 }] },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      patch("avatarColor", c.value);
                    }}
                  >
                    {form.avatarColor === c.value && (
                      <Feather name="check" size={20} color="#FFFFFF" />
                    )}
                  </Pressable>
                ))}
              </View>
            </FieldGroup>

            {/* Live preview */}
            <View style={styles.previewCard}>
              <View style={[styles.previewAvatar, {
                backgroundColor: form.avatarColor + "2A",
                borderColor: form.avatarColor + "55",
              }]}>
                <Text style={[styles.previewInitial, { color: form.avatarColor }]}>
                  {form.name.trim()[0]?.toUpperCase() ?? "N"}
                </Text>
              </View>
              <Text style={styles.previewName}>{form.name || "اسمك"}</Text>
              {form.username ? (
                <Text style={styles.previewUsername}>@{form.username}</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* ── Step 5: Review ── */}
        {step === 5 && (
          <View style={styles.form}>
            <ReviewCard form={form} accent={accent} colors={colors} styles={styles} />
          </View>
        )}

        {/* Error */}
        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color="#FF453A" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.nextBtn,
            { backgroundColor: accent },
            (!canAdvance() || loading) && { opacity: 0.35 },
            pressed && canAdvance() && { opacity: 0.85, transform: [{ scale: 0.975 }] },
          ]}
          onPress={handleNext}
          disabled={!canAdvance() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              {step < TOTAL_STEPS && <Feather name="arrow-left" size={18} color="#FFFFFF" />}
              <Text style={styles.nextBtnText}>
                {step < TOTAL_STEPS ? "التالي" : "إنشاء الحساب"}
              </Text>
            </>
          )}
        </Pressable>

        {step === TOTAL_STEPS && (
          <Pressable
            style={({ pressed }) => [styles.loginLink, pressed && { opacity: 0.6 }]}
            onPress={() => router.replace("/login")}
          >
            <Text style={styles.loginLinkText}>لديك حساب بالفعل؟ سجّل الدخول</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({
  current, total, accent, colors,
}: {
  current: number; total: number; accent: string; colors: ThemeColors;
}) {
  return (
    <View style={si.row}>
      {Array.from({ length: total }).map((_, i) => {
        const n    = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <React.Fragment key={n}>
            {i > 0 && (
              <View style={[si.line, { backgroundColor: done ? accent : colors.border }]} />
            )}
            <View style={[
              si.dot,
              active && { backgroundColor: accent,    borderColor: accent         },
              done   && { backgroundColor: accent,    borderColor: accent         },
              !active && !done && { backgroundColor: colors.bg, borderColor: colors.border },
            ]}>
              {done ? (
                <Feather name="check" size={10} color="#FFFFFF" />
              ) : (
                <Text style={[si.num, { color: active ? "#FFFFFF" : colors.placeholder }]}>{n}</Text>
              )}
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const si = StyleSheet.create({
  row:  { flexDirection: "row", alignItems: "center" },
  line: { flex: 1, height: 1.5, marginHorizontal: 2 },
  dot:  { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  num:  { fontSize: DS.font.size.xxs, fontFamily: DS.font.family.bold },
});

function FieldGroup({
  label, required, hint, children, styles,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.labelRow}>
        {hint ? <Text style={styles.hintTag}>{hint}</Text> : <View />}
        <Text style={styles.fieldLabel}>
          {label}
          {required ? <Text style={{ color: "#FF453A" }}> *</Text> : null}
        </Text>
      </View>
      {children}
    </View>
  );
}

function PasswordStrength({
  password, accent, styles,
}: {
  password: string; accent: string; styles: ReturnType<typeof makeStyles>;
}) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const label  = ["ضعيفة", "مقبولة", "جيدة", "قوية"][score - 1] ?? "ضعيفة";
  const color  = ["#FF453A", "#F59E0B", "#34D399", "#34D399"][score - 1] ?? "#FF453A";

  return (
    <View style={styles.strengthWrap}>
      <Text style={[styles.strengthLabel, { color }]}>{label}</Text>
      <View style={styles.strengthBars}>
        {[1, 2, 3, 4].map((n) => (
          <View
            key={n}
            style={[
              styles.strengthBar,
              { backgroundColor: n <= score ? color : "#2C2C2E" },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function ReviewCard({
  form, accent, colors, styles,
}: {
  form: FormData; accent: string; colors: ThemeColors; styles: ReturnType<typeof makeStyles>;
}) {
  const rows: { icon: React.ComponentProps<typeof Feather>["name"]; label: string; value: string }[] = [
    { icon: "user",     label: "الاسم",          value: form.name                                   },
    { icon: "at-sign",  label: "المستخدم",        value: form.username ? "@" + form.username : "—"  },
    { icon: "mail",     label: "البريد",          value: form.email                                  },
    { icon: "phone",    label: "الهاتف",          value: form.phone || "—"                           },
    { icon: "lock",     label: "كلمة المرور",     value: "•".repeat(Math.min(form.password.length, 10)) },
  ];

  return (
    <View style={styles.reviewCard}>
      {/* Avatar preview */}
      <View style={styles.reviewAvatarWrap}>
        <View style={[styles.reviewAvatar, {
          backgroundColor: form.avatarColor + "2A",
          borderColor:     form.avatarColor + "55",
        }]}>
          <Text style={[styles.reviewAvatarInitial, { color: form.avatarColor }]}>
            {form.name.trim()[0]?.toUpperCase() ?? "N"}
          </Text>
        </View>
        <Text style={styles.reviewAvatarName}>{form.name}</Text>
        {form.username ? (
          <Text style={styles.reviewAvatarHandle}>@{form.username}</Text>
        ) : null}
      </View>

      {/* Info rows */}
      {rows.map((r, i) => (
        <View
          key={r.label}
          style={[styles.reviewRow, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}
        >
          <Text style={styles.reviewValue} numberOfLines={1}>{r.value}</Text>
          <View style={styles.reviewLabelWrap}>
            <Text style={styles.reviewLabel}>{r.label}</Text>
            <View style={[styles.reviewIconWrap, { backgroundColor: accent + "1A" }]}>
              <Feather name={r.icon} size={12} color={accent} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1, backgroundColor: colors.bg, paddingHorizontal: DS.spacing.xl,
    },

    /* Header */
    header: {
      flexDirection: "row", alignItems: "center",
      justifyContent: "space-between", paddingVertical: DS.spacing.md,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: DS.radius.md,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      alignItems: "center", justifyContent: "center",
    },

    scroll: { flexGrow: 1, paddingBottom: DS.spacing.xl },

    /* Step hero */
    stepHero: {
      alignItems: "flex-end",
      marginTop: DS.spacing.xxl, marginBottom: DS.spacing.xxxl,
    },
    stepIconWrap: {
      width: 72, height: 72, borderRadius: DS.radius.xxl,
      borderWidth: 1.5, alignItems: "center", justifyContent: "center",
      marginBottom: DS.spacing.lg,
    },
    stepTitle: {
      fontSize: DS.font.size.xxl, fontFamily: DS.font.family.bold,
      color: colors.text, writingDirection: "rtl", textAlign: "right",
      letterSpacing: -0.5, marginBottom: DS.spacing.xs,
    },
    stepSubtitle: {
      fontSize: DS.font.size.base, fontFamily: DS.font.family.regular,
      color: colors.textSecondary, writingDirection: "rtl", textAlign: "right",
    },

    /* Form */
    form: { gap: DS.spacing.xl },
    fieldGroup: { gap: DS.spacing.sm },
    labelRow: {
      flexDirection: "row", alignItems: "center",
      justifyContent: "space-between",
    },
    fieldLabel: {
      fontSize: DS.font.size.base, fontFamily: DS.font.family.medium,
      color: colors.textSoft, textAlign: "right", writingDirection: "rtl",
    },
    hintTag: {
      fontSize: DS.font.size.xs, fontFamily: DS.font.family.regular,
      color: colors.textSecondary,
    },

    /* Inputs */
    input: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: DS.radius.lg,
      paddingHorizontal: DS.spacing.lg, paddingVertical: DS.spacing.lg,
      fontSize: DS.font.size.md, fontFamily: DS.font.family.regular, color: colors.text,
    },
    inputContainer: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: DS.radius.lg, paddingHorizontal: DS.spacing.lg,
      gap: DS.spacing.sm,
    },
    inputInner: {
      flex: 1, paddingVertical: DS.spacing.lg,
      fontSize: DS.font.size.md, fontFamily: DS.font.family.regular, color: colors.text,
    },
    inputAffix: {
      fontSize: DS.font.size.lg, fontFamily: DS.font.family.semibold,
    },
    eyeBtn: { padding: DS.spacing.xs },
    fieldHint: {
      fontSize: DS.font.size.xs, fontFamily: DS.font.family.regular,
      color: "#F59E0B", textAlign: "right", writingDirection: "rtl",
    },

    /* Password strength */
    strengthWrap: {
      flexDirection: "row", alignItems: "center",
      justifyContent: "flex-end", gap: DS.spacing.sm,
    },
    strengthLabel: {
      fontSize: DS.font.size.xs, fontFamily: DS.font.family.medium, writingDirection: "rtl",
    },
    strengthBars: { flexDirection: "row", gap: 4 },
    strengthBar:  { width: 28, height: 4, borderRadius: 2 },

    /* Color picker */
    colorGrid: {
      flexDirection: "row", gap: DS.spacing.md, flexWrap: "wrap",
    },
    colorSwatch: {
      width: 54, height: 54, borderRadius: DS.radius.full,
      alignItems: "center", justifyContent: "center",
      borderWidth: 3, borderColor: "transparent",
    },
    colorSwatchActive: {
      borderColor: "#FFFFFF",
      ...DS.shadow.sm,
    },

    /* Avatar preview (step 4) */
    previewCard: {
      backgroundColor: colors.card, borderRadius: DS.radius.xl,
      borderWidth: 1, borderColor: colors.border,
      paddingVertical: DS.spacing.xxl, alignItems: "center", gap: DS.spacing.sm,
    },
    previewAvatar: {
      width: 80, height: 80, borderRadius: DS.radius.full,
      borderWidth: 2.5, alignItems: "center", justifyContent: "center",
    },
    previewInitial: { fontSize: DS.font.size.xxl, fontFamily: DS.font.family.bold },
    previewName:    { fontSize: DS.font.size.lg,  fontFamily: DS.font.family.semibold, color: colors.text, writingDirection: "rtl" },
    previewUsername:{ fontSize: DS.font.size.sm,  fontFamily: DS.font.family.regular,  color: colors.textSecondary },

    /* Review card (step 5) */
    reviewCard: {
      backgroundColor: colors.card, borderRadius: DS.radius.xl,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    reviewAvatarWrap: {
      alignItems: "center", paddingVertical: DS.spacing.xxl,
      borderBottomWidth: 1, borderBottomColor: colors.border, gap: DS.spacing.xs,
    },
    reviewAvatar: {
      width: 72, height: 72, borderRadius: DS.radius.full,
      borderWidth: 2, alignItems: "center", justifyContent: "center",
      marginBottom: DS.spacing.xs,
    },
    reviewAvatarInitial: { fontSize: DS.font.size.xxl, fontFamily: DS.font.family.bold },
    reviewAvatarName:    { fontSize: DS.font.size.lg,  fontFamily: DS.font.family.semibold, color: colors.text,          writingDirection: "rtl" },
    reviewAvatarHandle:  { fontSize: DS.font.size.sm,  fontFamily: DS.font.family.regular,  color: colors.textSecondary },
    reviewRow: {
      flexDirection: "row", alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: DS.spacing.lg, paddingVertical: DS.spacing.md,
    },
    reviewValue: {
      flex: 1, fontSize: DS.font.size.base, fontFamily: DS.font.family.medium,
      color: colors.text, textAlign: "right", writingDirection: "rtl",
      paddingLeft: DS.spacing.sm,
    },
    reviewLabelWrap: { flexDirection: "row", alignItems: "center", gap: DS.spacing.sm },
    reviewLabel:     { fontSize: DS.font.size.sm, fontFamily: DS.font.family.regular, color: colors.textSecondary, writingDirection: "rtl" },
    reviewIconWrap:  { width: 28, height: 28, borderRadius: DS.radius.md, alignItems: "center", justifyContent: "center" },

    /* Error */
    errorBox: {
      flexDirection: "row", alignItems: "center", justifyContent: "flex-end",
      gap: DS.spacing.sm,
      backgroundColor: "#2C151540", borderRadius: DS.radius.md,
      paddingHorizontal: DS.spacing.lg, paddingVertical: DS.spacing.md,
      borderWidth: 1, borderColor: "#FF453A33", marginTop: DS.spacing.md,
    },
    errorText: {
      fontSize: DS.font.size.sm, fontFamily: DS.font.family.medium,
      color: "#FF453A", textAlign: "right", writingDirection: "rtl", flex: 1,
    },

    /* Footer */
    footer: { paddingTop: DS.spacing.md, gap: DS.spacing.md },
    nextBtn: {
      borderRadius: DS.radius.xl, paddingVertical: DS.spacing.xl,
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: DS.spacing.sm,
    },
    nextBtnText: {
      color: "#FFFFFF", fontSize: DS.font.size.lg,
      fontFamily: DS.font.family.semibold, writingDirection: "rtl",
    },
    loginLink: { alignItems: "center", paddingVertical: DS.spacing.xs },
    loginLinkText: {
      fontSize: DS.font.size.base, fontFamily: DS.font.family.regular,
      color: colors.textSecondary, writingDirection: "rtl",
    },
  });
}
