import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { requestContactsPermission } from "@/utils/contactsPermission";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useAppLock } from "@/context/AppLockContext";
import { ACCENT_COLORS, LANGUAGES, useColors, useSettings, useT } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";

const APP_VERSION = "1.0.0";
const BUILD = "2026.1";

type PrivacyValue = "everyone" | "friends" | "nobody";
type SupportType = "report" | "help" | "feature" | "feedback";

function SectionHeader({ title, colors }: { title: string; colors: ThemeColors }) {
  return <Text style={[sharedStyles.sectionHeader, { color: colors.textSecondary }]}>{title}</Text>;
}

function SettingRow({
  icon, iconColor = "#8E8E93", iconBg,
  label, value, danger, onPress, rightEl, hideChevron, colors,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  iconColor?: string; iconBg?: string; label: string; value?: string;
  danger?: boolean; onPress?: () => void;
  rightEl?: React.ReactNode; hideChevron?: boolean;
  colors: ThemeColors;
}) {
  return (
    <Pressable
      style={({ pressed }) => [sharedStyles.row, { backgroundColor: "transparent" }, pressed && onPress && { opacity: 0.7 }]}
      onPress={onPress}
      disabled={!onPress && !rightEl}
    >
      <View style={sharedStyles.rowRight}>
        <View style={[sharedStyles.rowIcon, { backgroundColor: iconBg ?? colors.border }]}>
          <Feather name={icon} size={15} color={iconColor} />
        </View>
        <Text style={[sharedStyles.rowLabel, { color: colors.text }, danger && { color: "#FF453A" }]}>{label}</Text>
      </View>
      <View style={sharedStyles.rowLeft}>
        {value ? <Text style={[sharedStyles.rowValue, { color: colors.textSecondary }]}>{value}</Text> : null}
        {rightEl ?? null}
        {!hideChevron && onPress && !rightEl ? (
          <Feather name="chevron-left" size={15} color={colors.textTertiary} />
        ) : null}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  const { signOut, user, token, changePassword, deleteAccount, updateUser } = useAuth();
  const { settings, accent, updateSettings } = useSettings();
  const { pinEnabled, biometricEnabled, hasBiometric, enablePin, disablePin, toggleBiometric } = useAppLock();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const [pwModal, setPwModal] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [privacyModal, setPrivacyModal] = useState(false);
  const [privacyField, setPrivacyField] = useState<"profileVisibility" | "messagingPrivacy">("profileVisibility");
  const [privacySaving, setPrivacySaving] = useState(false);

  const [supportType, setSupportType] = useState<SupportType | null>(null);
  const [supportText, setSupportText] = useState("");
  const [reportImage, setReportImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [pinModal, setPinModal] = useState(false);
  const [pinStep, setPinStep] = useState<"enter" | "confirm">("enter");
  const [pinFirst, setPinFirst] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  const [contactsSynced, setContactsSynced] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsConsentModal, setContactsConsentModal] = useState(false);

  const CONTACTS_KEY = "@nexora_contacts_sync";

  useEffect(() => {
    AsyncStorage.getItem(CONTACTS_KEY).then((v) => {
      if (v === "granted") setContactsSynced(true);
    });
  }, []);

  const profileVisibility = (user?.profileVisibility ?? "everyone") as PrivacyValue;
  const messagingPrivacy = (user?.messagingPrivacy ?? "everyone") as PrivacyValue;

  function visibilityLabel(v: PrivacyValue) {
    return v === "everyone" ? t.settings.visibilityEveryone
      : v === "friends" ? t.settings.visibilityFriends
      : t.settings.visibilityNobody;
  }

  const openPrivacyPicker = (field: typeof privacyField) => {
    setPrivacyField(field);
    setPrivacyModal(true);
    Haptics.selectionAsync();
  };

  const savePrivacy = async (value: PrivacyValue) => {
    setPrivacySaving(true);
    try {
      await updateUser({ [privacyField]: value });
    } catch { /* ignore */ } finally {
      setPrivacySaving(false);
      setPrivacyModal(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) { Alert.alert(t.common.error, t.settings.passwordMismatch); return; }
    if (newPw.length < 8) { Alert.alert(t.common.error, t.settings.passwordTooShort); return; }
    setPwLoading(true);
    try {
      await changePassword(currentPw, newPw);
      setPwModal(false);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      Alert.alert(t.common.success, t.settings.passwordChanged);
    } catch (err: any) {
      const msg = err?.message ?? t.common.error;
      Alert.alert(t.common.error, msg.includes("incorrect") || msg.includes("غير صحيحة") ? t.settings.wrongCurrentPassword : msg);
    } finally { setPwLoading(false); }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm.trim().toLowerCase() !== t.settings.deleteConfirmWord.toLowerCase()) return;
    setDeleting(true);
    try {
      await deleteAccount();
      router.replace("/");
    } catch { /* ignore */ } finally { setDeleting(false); }
  };

  const openSupport = (type: SupportType) => {
    setSupportType(type);
    setSupportText("");
    setReportImage(null);
  };

  const pickReportImage = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 0.5 });
    if (!result.canceled && result.assets[0]) setReportImage(result.assets[0].uri);
  };

  const submitSupport = async () => {
    if (!supportText.trim() || !supportType) return;
    setSubmitting(true);
    try {
      await apiFetch("/support", { method: "POST", body: JSON.stringify({ type: supportType, content: supportText.trim(), screenshotUri: reportImage ?? null }), token: token ?? undefined });
      setSupportType(null); setSupportText(""); setReportImage(null);
      Alert.alert(t.settings.submitted, t.settings.submittedMsg);
    } catch {
      Alert.alert(t.common.error, t.common.error);
    } finally { setSubmitting(false); }
  };

  function supportTitle() {
    switch (supportType) {
      case "report": return t.settings.reportTitle;
      case "help": return t.settings.helpTitle;
      case "feature": return t.settings.featureTitle;
      case "feedback": return t.settings.feedbackTitle;
      default: return "";
    }
  }

  function supportPlaceholder() {
    switch (supportType) {
      case "report": return t.settings.reportPlaceholder;
      case "help": return t.settings.helpPlaceholder;
      case "feature": return t.settings.featurePlaceholder;
      case "feedback": return t.settings.feedbackPlaceholder;
      default: return "";
    }
  }

  const handleTogglePin = () => {
    if (pinEnabled) {
      Alert.alert("إيقاف قفل PIN", "هل تريد إيقاف قفل التطبيق بـ PIN؟", [
        { text: "إلغاء", style: "cancel" },
        { text: "إيقاف", style: "destructive", onPress: () => disablePin() },
      ]);
    } else {
      setPinStep("enter");
      setPinFirst("");
      setPinInput("");
      setPinError("");
      setPinModal(true);
    }
    Haptics.selectionAsync();
  };

  const PIN_REQUIRED_LENGTH = 6;

  const handlePinConfirm = async () => {
    if (pinStep === "enter") {
      if (pinInput.length !== PIN_REQUIRED_LENGTH) {
        setPinError(`يجب أن يكون الرمز ${PIN_REQUIRED_LENGTH} أرقام بالضبط`);
        return;
      }
      setPinFirst(pinInput);
      setPinInput("");
      setPinStep("confirm");
      setPinError("");
    } else {
      if (pinInput.length !== PIN_REQUIRED_LENGTH) {
        setPinError(`يجب أن يكون الرمز ${PIN_REQUIRED_LENGTH} أرقام بالضبط`);
        return;
      }
      if (pinInput !== pinFirst) { setPinError("الرمزان غير متطابقين، حاول مرة أخرى"); setPinInput(""); return; }
      setPinLoading(true);
      try {
        await enablePin(pinInput);
        setPinModal(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("تم التفعيل", "تم تفعيل قفل التطبيق بـ PIN بنجاح");
      } catch (e: any) {
        setPinError(e?.message ?? "حدث خطأ ما");
      } finally { setPinLoading(false); }
    }
  };

  const handleChangePinPress = () => {
    setPinStep("enter");
    setPinFirst("");
    setPinInput("");
    setPinError("");
    setPinModal(true);
  };

  const handleContactSyncToggle = async () => {
    if (contactsSynced) {
      await AsyncStorage.setItem(CONTACTS_KEY, "disabled");
      setContactsSynced(false);
      return;
    }
    const persisted = await AsyncStorage.getItem(CONTACTS_KEY);
    if (persisted === "denied") {
      Alert.alert(
        "إذن مرفوض سابقاً",
        "لقد رفضت الإذن سابقاً. لتفعيل المزامنة، اذهب إلى إعدادات الجهاز وامنح Nexora إذن الوصول لجهات الاتصال.",
        [{ text: "حسناً" }],
      );
      return;
    }
    setContactsConsentModal(true);
  };

  const doRequestContactsPermission = async () => {
    setContactsConsentModal(false);
    if (Platform.OS === "web") {
      Alert.alert("غير مدعوم", "مزامنة جهات الاتصال غير متاحة على الويب. استخدم تطبيق الجوال.");
      return;
    }
    setContactsLoading(true);
    try {
      const status = await requestContactsPermission();
      if (status === "granted") {
        await AsyncStorage.setItem(CONTACTS_KEY, "granted");
        setContactsSynced(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await AsyncStorage.setItem(CONTACTS_KEY, "denied");
        setContactsSynced(false);
        Alert.alert("تم الرفض", "لم يتم منح الإذن. يمكنك السماح به من إعدادات الجهاز.");
      }
    } catch {
      Alert.alert("خطأ", "فشل طلب الإذن");
    } finally {
      setContactsLoading(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t.settings.title}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: 40 + bottom }]}>

        <SectionHeader title={t.settings.account} colors={colors} />
        <View style={styles.card}>
          <SettingRow colors={colors} icon="edit-3" iconColor={accent} iconBg={accent + "22"} label={t.settings.editProfile}
            onPress={() => { router.back(); setTimeout(() => router.push("/profile" as any), 50); }}
          />
          <View style={styles.div} />
          <SettingRow colors={colors} icon="lock" iconColor="#F59E0B" iconBg="#F59E0B22" label={t.settings.changePassword} onPress={() => setPwModal(true)} />
          <View style={styles.div} />
          <SettingRow colors={colors} icon="log-out" iconColor="#FF453A" iconBg="#FF453A22" label={t.settings.logout} danger
            onPress={async () => { await signOut(); router.replace("/"); }}
          />
          <View style={styles.div} />
          <SettingRow colors={colors} icon="trash-2" iconColor="#FF453A" iconBg="#2C1515" label={t.settings.deleteAccount} danger onPress={() => setDeleteModal(true)} />
        </View>

        <SectionHeader title={t.settings.privacy} colors={colors} />
        <View style={styles.card}>
          <SettingRow colors={colors} icon="eye" iconColor={accent} iconBg={accent + "22"} label={t.settings.profileVisibility} value={visibilityLabel(profileVisibility)} onPress={() => openPrivacyPicker("profileVisibility")} />
          <View style={styles.div} />
          <SettingRow colors={colors} icon="message-circle" iconColor="#34D399" iconBg="#34D39922" label={t.settings.messagingPrivacy} value={visibilityLabel(messagingPrivacy)} onPress={() => openPrivacyPicker("messagingPrivacy")} />
          <View style={styles.div} />
          <SettingRow
            colors={colors}
            icon="shield"
            iconColor={pinEnabled ? accent : colors.textSecondary}
            iconBg={pinEnabled ? accent + "22" : colors.border}
            label="قفل التطبيق بـ PIN"
            rightEl={
              <Switch
                value={pinEnabled}
                onValueChange={handleTogglePin}
                trackColor={{ false: colors.border, true: accent + "88" }}
                thumbColor={accent}
              />
            }
            hideChevron
          />
          {pinEnabled && (
            <>
              <View style={styles.div} />
              <SettingRow colors={colors} icon="refresh-cw" iconColor="#F59E0B" iconBg="#F59E0B22" label="تغيير رمز PIN" onPress={handleChangePinPress} />
              {hasBiometric && (
                <>
                  <View style={styles.div} />
                  <SettingRow
                    colors={colors}
                    icon="activity"
                    iconColor="#34D399"
                    iconBg="#34D39922"
                    label="مصادقة بيومترية"
                    rightEl={
                      <Switch
                        value={biometricEnabled}
                        onValueChange={async () => {
                          const ok = await toggleBiometric();
                          if (ok) Haptics.selectionAsync();
                          else if (!biometricEnabled) Alert.alert("فشل التحقق", "لم يتم التحقق من الهوية. الوصول البيومتري لم يُفعَّل.");
                        }}
                        trackColor={{ false: colors.border, true: "#34D39988" }}
                        thumbColor="#34D399"
                      />
                    }
                    hideChevron
                  />
                </>
              )}
            </>
          )}
          <View style={styles.div} />
          <SettingRow
            colors={colors}
            icon="users"
            iconColor="#3B82F6"
            iconBg="#3B82F622"
            label="مزامنة جهات الاتصال"
            rightEl={
              contactsLoading
                ? <ActivityIndicator size="small" color={accent} />
                : <Switch
                    value={contactsSynced}
                    onValueChange={handleContactSyncToggle}
                    trackColor={{ false: colors.border, true: "#3B82F688" }}
                    thumbColor="#3B82F6"
                  />
            }
            hideChevron
          />
        </View>

        <SectionHeader title={t.settings.notifications} colors={colors} />
        <View style={styles.card}>
          <SettingRow colors={colors} icon="message-circle" iconColor={accent} iconBg={accent + "22"} label={t.settings.messageNotifs}
            rightEl={
              <Switch
                value={settings.notifyMessages}
                onValueChange={(v) => { updateSettings({ notifyMessages: v }); Haptics.selectionAsync(); }}
                trackColor={{ false: colors.border, true: accent + "88" }}
                thumbColor={accent}
              />
            }
            hideChevron
          />
          <View style={styles.div} />
          <SettingRow colors={colors} icon="users" iconColor="#F59E0B" iconBg="#F59E0B22" label={t.settings.friendNotifs}
            rightEl={
              <Switch
                value={settings.notifyFriendRequests}
                onValueChange={(v) => { updateSettings({ notifyFriendRequests: v }); Haptics.selectionAsync(); }}
                trackColor={{ false: colors.border, true: "#F59E0B88" }}
                thumbColor="#F59E0B"
              />
            }
            hideChevron
          />
        </View>

        <SectionHeader title={t.settings.appearance} colors={colors} />
        <View style={styles.card}>
          <View style={styles.inCardSection}>
            <Text style={[styles.inCardLabel, { color: colors.textSecondary }]}>{t.settings.mode}</Text>
            <View style={styles.themeRow}>
              {(["dark", "light", "system"] as const).map((th) => {
                const labels = { dark: t.settings.dark, light: t.settings.light, system: t.settings.system };
                const icons: Record<string, React.ComponentProps<typeof Feather>["name"]> = { dark: "moon", light: "sun", system: "monitor" };
                const active = settings.theme === th;
                return (
                  <Pressable
                    key={th}
                    style={[styles.themeBtn, { backgroundColor: colors.card, borderColor: colors.border }, active && { borderColor: accent, backgroundColor: accent + "18" }]}
                    onPress={() => { updateSettings({ theme: th }); Haptics.selectionAsync(); }}
                  >
                    <Feather name={icons[th]} size={16} color={active ? accent : colors.textSecondary} />
                    <Text style={[styles.themeBtnText, { color: colors.textSecondary }, active && { color: accent }]}>{labels[th]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.div} />
          <View style={styles.inCardSection}>
            <Text style={[styles.inCardLabel, { color: colors.textSecondary }]}>{t.settings.accentColor}</Text>
            <View style={styles.colorRow}>
              {ACCENT_COLORS.map((c) => {
                const active = settings.accentColor === c.value;
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.colorSwatch, { backgroundColor: c.value }, active && styles.colorActive]}
                    onPress={() => { updateSettings({ accentColor: c.value }); Haptics.selectionAsync(); }}
                  >
                    {active && <Feather name="check" size={13} color="#FFFFFF" />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <SectionHeader title={t.settings.language} colors={colors} />
        <View style={styles.card}>
          {LANGUAGES.map((lang, i) => {
            const active = settings.language === lang.code;
            return (
              <React.Fragment key={lang.code}>
                {i > 0 && <View style={styles.div} />}
                <Pressable
                  style={[sharedStyles.row, active && { backgroundColor: accent + "0A" }]}
                  onPress={() => { updateSettings({ language: lang.code }); Haptics.selectionAsync(); }}
                >
                  <View style={sharedStyles.rowRight}>
                    <View style={[sharedStyles.rowIcon, { backgroundColor: active ? accent + "22" : colors.border }]}>
                      <Feather name="globe" size={15} color={active ? accent : colors.textSecondary} />
                    </View>
                    <View>
                      <Text style={[sharedStyles.rowLabel, { color: colors.text }, active && { color: accent }]}>{lang.label}</Text>
                      <Text style={[styles.langNative, { color: colors.textSecondary }]}>{lang.nativeLabel}</Text>
                    </View>
                  </View>
                  {active && <Feather name="check" size={16} color={accent} />}
                </Pressable>
              </React.Fragment>
            );
          })}
        </View>

        <SectionHeader title={t.settings.support} colors={colors} />
        <View style={styles.card}>
          <SettingRow colors={colors} icon="help-circle" iconColor="#3B82F6" iconBg="#3B82F622" label={t.settings.requestHelp} onPress={() => openSupport("help")} />
          <View style={styles.div} />
          <SettingRow colors={colors} icon="alert-triangle" iconColor="#F59E0B" iconBg="#F59E0B22" label={t.settings.reportProblem} onPress={() => openSupport("report")} />
          <View style={styles.div} />
          <SettingRow colors={colors} icon="message-square" iconColor="#34D399" iconBg="#34D39922" label={t.settings.sendFeedback} onPress={() => openSupport("feedback")} />
          <View style={styles.div} />
          <SettingRow colors={colors} icon="star" iconColor="#F59E0B" iconBg="#F59E0B22" label={t.settings.suggestFeature} onPress={() => openSupport("feature")} />
        </View>

        {!!user?.isDeveloper && (
          <>
            <SectionHeader title="المطور" colors={colors} />
            <View style={styles.card}>
              <SettingRow colors={colors} icon="terminal" iconColor="#34D399" iconBg="#34D39922" label="لوحة التحكم" onPress={() => router.push("/admin" as any)} />
            </View>
          </>
        )}

        <SectionHeader title={t.settings.about} colors={colors} />
        <View style={styles.card}>
          <SettingRow colors={colors} icon="info" iconColor={accent} iconBg={accent + "22"} label={t.settings.version} value={`v${APP_VERSION} (${BUILD})`} hideChevron />
          <View style={styles.div} />
          <SettingRow colors={colors} icon="zap" label={t.settings.app} value="Nexora" hideChevron />
          <View style={styles.div} />
          <SettingRow colors={colors} icon="shield" iconColor="#34D399" iconBg="#34D39922" label={t.settings.privacyPolicy}
            onPress={() => { Alert.alert("Nexora", "سياسة الخصوصية قيد الإعداد"); }}
          />
          <View style={styles.div} />
          <SettingRow colors={colors} icon="file-text" label={t.settings.termsOfUse}
            onPress={() => { Alert.alert("Nexora", "شروط الاستخدام قيد الإعداد"); }}
          />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>{t.settings.madeWith}</Text>
          <Text style={[styles.footerSub, { color: colors.textTertiary }]}>Nexora · {APP_VERSION}</Text>
        </View>
      </ScrollView>

      {/* ── Change Password Modal ── */}
      <Modal visible={pwModal} transparent animationType="slide" onRequestClose={() => setPwModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setPwModal(false)} />
        <KeyboardAvoidingView style={styles.sheetWrap} behavior={Platform.OS === "ios" ? "position" : "height"}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t.settings.changePwTitle}</Text>
            <TextInput style={styles.input} placeholder={t.settings.currentPassword} placeholderTextColor={colors.placeholder} secureTextEntry value={currentPw} onChangeText={setCurrentPw} textAlign="right" />
            <TextInput style={styles.input} placeholder={t.settings.newPassword} placeholderTextColor={colors.placeholder} secureTextEntry value={newPw} onChangeText={setNewPw} textAlign="right" />
            <TextInput style={styles.input} placeholder={t.settings.confirmPassword} placeholderTextColor={colors.placeholder} secureTextEntry value={confirmPw} onChangeText={setConfirmPw} textAlign="right" />
            <View style={styles.modalBtns}>
              <Pressable style={[styles.modalBtn, styles.cancelModalBtn]} onPress={() => setPwModal(false)}>
                <Text style={styles.cancelBtnText}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: accent }]} onPress={handleChangePassword} disabled={pwLoading}>
                {pwLoading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.confirmBtnText}>{t.common.save}</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Delete Account Modal ── */}
      <Modal visible={deleteModal} transparent animationType="slide" onRequestClose={() => setDeleteModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setDeleteModal(false)} />
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.dangerIcon}><Feather name="alert-triangle" size={28} color="#FF453A" /></View>
            <Text style={styles.sheetTitle}>{t.settings.deleteTitle}</Text>
            <Text style={[styles.deleteWarning, { color: colors.textSecondary }]}>{t.settings.deleteWarning}</Text>
            <Text style={styles.deleteHint}>{t.settings.deleteHint}</Text>
            <TextInput style={[styles.input, { borderColor: "#FF453A44" }]} placeholder={t.settings.deleteConfirmWord} placeholderTextColor={colors.placeholder} value={deleteConfirm} onChangeText={setDeleteConfirm} textAlign="right" />
            <View style={styles.modalBtns}>
              <Pressable style={[styles.modalBtn, styles.cancelModalBtn]} onPress={() => setDeleteModal(false)}>
                <Text style={styles.cancelBtnText}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: deleteConfirm.trim().toLowerCase() === t.settings.deleteConfirmWord.toLowerCase() ? "#FF453A" : "#2C1515" }]}
                onPress={handleDeleteAccount}
                disabled={deleting || deleteConfirm.trim().toLowerCase() !== t.settings.deleteConfirmWord.toLowerCase()}
              >
                {deleting ? <ActivityIndicator size="small" color="#FFF" /> : (
                  <Text style={[styles.confirmBtnText, deleteConfirm.trim().toLowerCase() !== t.settings.deleteConfirmWord.toLowerCase() && { color: "#FF453A44" }]}>{t.common.delete}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Privacy Picker Modal ── */}
      <Modal visible={privacyModal} transparent animationType="slide" onRequestClose={() => setPrivacyModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setPrivacyModal(false)} />
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{privacyField === "profileVisibility" ? t.settings.profileVisibility : t.settings.messagingPrivacy}</Text>
            {(["everyone", "friends", "nobody"] as PrivacyValue[]).map((v) => {
              const icons: Record<PrivacyValue, React.ComponentProps<typeof Feather>["name"]> = { everyone: "globe", friends: "users", nobody: "lock" };
              const currentVal = privacyField === "profileVisibility" ? profileVisibility : messagingPrivacy;
              const isActive = currentVal === v;
              return (
                <Pressable
                  key={v}
                  style={[styles.privacyOption, { borderColor: colors.border, backgroundColor: colors.bg }, isActive && { backgroundColor: accent + "12", borderColor: accent + "44" }]}
                  onPress={() => savePrivacy(v)}
                  disabled={privacySaving}
                >
                  <View style={[styles.privacyOptionIcon, { backgroundColor: isActive ? accent + "22" : colors.border }]}>
                    <Feather name={icons[v]} size={16} color={isActive ? accent : colors.textSecondary} />
                  </View>
                  <Text style={[styles.privacyOptionLabel, { color: colors.text }, isActive && { color: accent }]}>{visibilityLabel(v)}</Text>
                  {privacySaving && isActive ? <ActivityIndicator size="small" color={accent} /> : isActive ? <Feather name="check-circle" size={18} color={accent} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* ── Contact Sync Consent Modal ── */}
      <Modal visible={contactsConsentModal} transparent animationType="slide" onRequestClose={() => setContactsConsentModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setContactsConsentModal(false)} />
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.dangerIcon}>
              <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "#3B82F622", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#3B82F644" }}>
                <Feather name="users" size={24} color="#3B82F6" />
              </View>
            </View>
            <Text style={styles.sheetTitle}>مزامنة جهات الاتصال</Text>
            <Text style={[styles.deleteWarning, { color: colors.textSecondary }]}>
              يتيح هذا الإذن لـ Nexora الوصول إلى جهات اتصال جهازك لمساعدتك في إيجاد أصدقائك على التطبيق. لن يتم مشاركة جهات اتصالك مع أي طرف ثالث.
            </Text>
            <View style={styles.modalBtns}>
              <Pressable style={[styles.modalBtn, styles.cancelModalBtn]} onPress={() => setContactsConsentModal(false)}>
                <Text style={styles.cancelBtnText}>لاحقاً</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: "#3B82F6" }]} onPress={doRequestContactsPermission}>
                <Text style={styles.confirmBtnText}>السماح</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── PIN Setup Modal ── */}
      <Modal visible={pinModal} transparent animationType="slide" onRequestClose={() => setPinModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setPinModal(false)} />
        <KeyboardAvoidingView style={styles.sheetWrap} behavior={Platform.OS === "ios" ? "position" : "height"}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{pinStep === "enter" ? "أدخل رمز PIN الجديد" : "أكّد رمز PIN"}</Text>
            <Text style={[styles.deleteWarning, { color: colors.textSecondary }]}>
              {pinStep === "enter" ? `أدخل رمزاً مكوناً من ${PIN_REQUIRED_LENGTH} أرقام لحماية التطبيق. لن يُشارَك مع أحد.` : "أدخل الرمز مرة أخرى للتأكيد."}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={"•".repeat(PIN_REQUIRED_LENGTH)}
              placeholderTextColor={colors.placeholder}
              value={pinInput}
              onChangeText={(t) => { setPinInput(t.replace(/\D/g, "").slice(0, PIN_REQUIRED_LENGTH)); setPinError(""); }}
              keyboardType="numeric"
              secureTextEntry
              textAlign="center"
              maxLength={PIN_REQUIRED_LENGTH}
              autoFocus
            />
            {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
            <View style={styles.modalBtns}>
              <Pressable style={[styles.modalBtn, styles.cancelModalBtn]} onPress={() => setPinModal(false)}>
                <Text style={styles.cancelBtnText}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: accent }, (!pinInput.trim() || pinLoading) && { opacity: 0.4 }]}
                onPress={handlePinConfirm}
                disabled={!pinInput.trim() || pinLoading}
              >
                {pinLoading ? <ActivityIndicator size="small" color="#FFF" /> : (
                  <Text style={styles.confirmBtnText}>{pinStep === "enter" ? "التالي" : "تأكيد"}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Support Modal ── */}
      <Modal visible={supportType !== null} transparent animationType="slide" onRequestClose={() => setSupportType(null)}>
        <Pressable style={styles.overlay} onPress={() => setSupportType(null)} />
        <KeyboardAvoidingView style={styles.sheetWrap} behavior={Platform.OS === "ios" ? "position" : "height"}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{supportTitle()}</Text>
            {user && (
              <View style={[styles.supportUserBadge, { backgroundColor: colors.card }]}>
                <Feather name="user" size={12} color={colors.textSecondary} />
                <Text style={[styles.supportUserText, { color: colors.textSecondary }]}>{user.name} · {user.email}</Text>
              </View>
            )}
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={supportPlaceholder()}
              placeholderTextColor={colors.placeholder}
              multiline numberOfLines={5}
              value={supportText}
              onChangeText={setSupportText}
              textAlign="right"
              textAlignVertical="top"
            />
            {supportType === "report" && (
              reportImage ? (
                <View style={styles.attachedImg}>
                  <Image source={{ uri: reportImage }} style={styles.attachThumb} />
                  <Pressable onPress={() => setReportImage(null)} style={[styles.removeImg, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <Feather name="x" size={14} color="#FF453A" />
                  </Pressable>
                </View>
              ) : (
                <Pressable style={[styles.attachBtn, { backgroundColor: colors.card }]} onPress={pickReportImage}>
                  <Feather name="image" size={16} color={colors.textSecondary} />
                  <Text style={[styles.attachBtnText, { color: colors.textSecondary }]}>{t.settings.attachScreenshot}</Text>
                </Pressable>
              )
            )}
            <View style={styles.modalBtns}>
              <Pressable style={[styles.modalBtn, styles.cancelModalBtn]} onPress={() => setSupportType(null)}>
                <Text style={styles.cancelBtnText}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: accent, opacity: supportText.trim() ? 1 : 0.4 }]}
                onPress={submitSupport}
                disabled={submitting || !supportText.trim()}
              >
                {submitting ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.confirmBtnText}>{t.common.send}</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const sharedStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 15, fontFamily: "Inter_400Regular" },
  rowValue: { fontSize: 13, fontFamily: "Inter_400Regular" },
  sectionHeader: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8, textTransform: "uppercase",
    marginTop: 28, marginBottom: 8, paddingHorizontal: 4,
    textAlign: "right",
  },
});

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },

    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingBottom: 16,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: colors.card, alignItems: "center", justifyContent: "center",
    },
    headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.text },

    scroll: { paddingHorizontal: 20 },
    card: {
      backgroundColor: colors.bgElevated, borderRadius: 14,
      borderWidth: 1, borderColor: colors.borderSubtle, overflow: "hidden",
    },
    div: { height: 1, backgroundColor: colors.borderSubtle, marginHorizontal: 16 },

    inCardSection: { paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
    inCardLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right" },

    themeRow: { flexDirection: "row", gap: 8 },
    themeBtn: {
      flex: 1, flexDirection: "column", alignItems: "center", gap: 6,
      paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
    },
    themeBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },

    colorRow: { flexDirection: "row", gap: 10 },
    colorSwatch: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    colorActive: { borderWidth: 2.5, borderColor: "#FFFFFF" },

    langNative: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },

    footer: { alignItems: "center", paddingTop: 32, gap: 6 },
    footerText: { fontSize: 14, fontFamily: "Inter_500Medium" },
    footerSub: { fontSize: 12, fontFamily: "Inter_400Regular" },

    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
    sheetWrap: { position: "absolute", bottom: 0, left: 0, right: 0, justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.bgElevated, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, paddingBottom: 36, gap: 14,
      borderTopWidth: 1, borderColor: colors.border,
    },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.placeholder, alignSelf: "center", marginBottom: 4 },
    sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.text, textAlign: "right" },

    input: {
      backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, fontFamily: "Inter_400Regular", color: colors.text,
    },
    textArea: { minHeight: 100, paddingTop: 12 },

    modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
    modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    cancelModalBtn: { backgroundColor: colors.card },
    cancelBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.text },
    confirmBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },

    dangerIcon: { alignItems: "center", paddingVertical: 8 },
    deleteWarning: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "right", lineHeight: 20 },
    deleteHint: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#FF453A", textAlign: "right" },

    privacyOption: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, marginVertical: 3 },
    privacyOptionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    privacyOptionLabel: { flex: 1, fontSize: 16, fontFamily: "Inter_500Medium", textAlign: "right" },

    supportUserBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    supportUserText: { fontSize: 12, fontFamily: "Inter_400Regular" },
    attachBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
    attachBtnText: { fontSize: 14, fontFamily: "Inter_400Regular" },
    attachedImg: { position: "relative", alignSelf: "flex-start" },
    attachThumb: { width: 80, height: 80, borderRadius: 8 },
    removeImg: { position: "absolute", top: -8, right: -8, borderRadius: 10, width: 22, height: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },

    pinError: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#FF453A", textAlign: "center", writingDirection: "rtl" },
  });
}
