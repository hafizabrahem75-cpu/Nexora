import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomNav from "@/components/BottomNav";
import ReminderPicker from "@/components/ReminderPicker";
import { useAuth } from "@/context/AuthContext";
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import { apiFetch } from "@/lib/api";
import {
  cancelReminder,
  formatReminderLabel,
  scheduleReminder,
} from "@/utils/notifications";

const NOTIF_KEY = "@nexora_goal_notif_ids";
const AI_TASKS_KEY = "@nexora_ai_saved_tasks";
const AI_GOAL_CONVERSIONS_KEY = "@nexora_ai_goal_conversions";
const GOAL_ACCENT = "#34D399";
const AI_PURPLE = "#7C6EFA";

interface AiSavedTask {
  id: string;
  title: string;
  goalLabel: string;
  createdAt: string;
}

interface AiPlanGroup {
  goalLabel: string;
  tasks: AiSavedTask[];
  createdAt: string;
  alreadyConverted: boolean;
}

async function loadAiGoalConversions(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(AI_GOAL_CONVERSIONS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

async function saveAiGoalConversions(set: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(AI_GOAL_CONVERSIONS_KEY, JSON.stringify([...set]));
  } catch {}
}

interface ApiGoal {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  reminderAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Goal {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  reminderAt?: number;
  notificationId?: string;
}

async function loadNotifMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function saveNotifMap(map: Record<string, string>): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(map));
  } catch {}
}

function fromApi(raw: ApiGoal, notifMap: Record<string, string>): Goal {
  return {
    id: raw.id,
    title: raw.title,
    completed: raw.completed,
    createdAt: new Date(raw.createdAt).getTime(),
    reminderAt: raw.reminderAt ? new Date(raw.reminderAt).getTime() : undefined,
    notificationId: notifMap[raw.id],
  };
}

export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;

  const { token } = useAuth();
  const colors = useColors();
  const { accent: _accent } = useSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [inputText, setInputText] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [draftReminder, setDraftReminder] = useState<number | undefined>(undefined);

  const [reminderPickerVisible, setReminderPickerVisible] = useState(false);
  const reminderTargetId = useRef<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const notifMapRef = useRef<Record<string, string>>({});

  const [aiPlans, setAiPlans] = useState<AiPlanGroup[]>([]);
  const [aiConverting, setAiConverting] = useState<Set<string>>(new Set());
  const [aiSuccessLabel, setAiSuccessLabel] = useState("");
  const [aiShowSuccess, setAiShowSuccess] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      setLoading(true);
      Promise.all([
        apiFetch<{ goals: ApiGoal[] }>("/goals", { token }),
        loadNotifMap(),
        AsyncStorage.getItem(AI_TASKS_KEY),
        loadAiGoalConversions(),
      ])
        .then(([{ goals: raw }, notifMap, aiRaw, conversions]) => {
          notifMapRef.current = notifMap;
          setGoals(raw.map((g) => fromApi(g, notifMap)));

          const allTasks: AiSavedTask[] = aiRaw ? JSON.parse(aiRaw) : [];
          const groupMap = new Map<string, AiSavedTask[]>();
          for (const t of allTasks) {
            const label = t.goalLabel ?? "هدف AI";
            if (!groupMap.has(label)) groupMap.set(label, []);
            groupMap.get(label)!.push(t);
          }
          const plans: AiPlanGroup[] = [];
          groupMap.forEach((tasks, goalLabel) => {
            plans.push({
              goalLabel,
              tasks,
              createdAt: tasks[0]?.createdAt ?? new Date().toISOString(),
              alreadyConverted: conversions.has(goalLabel),
            });
          });
          setAiPlans(plans);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [token])
  );

  const createGoalFromPlan = async (plan: AiPlanGroup) => {
    if (!token || plan.alreadyConverted || aiConverting.has(plan.goalLabel)) return;
    setAiConverting((prev) => new Set([...prev, plan.goalLabel]));
    try {
      const goalData = await apiFetch<{ goal: ApiGoal }>("/goals", {
        method: "POST",
        token,
        body: JSON.stringify({ title: plan.goalLabel }),
      }).catch(() => null);
      if (!goalData) return;

      await Promise.all(
        plan.tasks.map((t) =>
          apiFetch("/tasks", {
            method: "POST",
            token,
            body: JSON.stringify({ title: t.title }),
          }).catch(() => null)
        )
      );

      const conversions = await loadAiGoalConversions();
      conversions.add(plan.goalLabel);
      await saveAiGoalConversions(conversions);

      setGoals((prev) => [fromApi(goalData.goal, notifMapRef.current), ...prev]);
      setAiPlans((prev) =>
        prev.map((p) =>
          p.goalLabel === plan.goalLabel ? { ...p, alreadyConverted: true } : p
        )
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAiSuccessLabel(plan.goalLabel);
      setAiShowSuccess(true);
      setTimeout(() => setAiShowSuccess(false), 3500);
    } finally {
      setAiConverting((prev) => {
        const next = new Set(prev);
        next.delete(plan.goalLabel);
        return next;
      });
    }
  };

  const openAdd = () => {
    setPendingDeleteId(null); setEditingGoal(null); setInputText(""); setDraftReminder(undefined);
    setModalVisible(true);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const openEdit = (goal: Goal) => {
    setPendingDeleteId(null); setEditingGoal(goal); setInputText(goal.title); setDraftReminder(goal.reminderAt);
    setModalVisible(true);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const closeModal = () => { setModalVisible(false); setEditingGoal(null); setInputText(""); setDraftReminder(undefined); };

  const saveGoal = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || !token) return;

    if (editingGoal) {
      const old = goals.find((g) => g.id === editingGoal.id);
      let notifId: string | undefined = notifMapRef.current[editingGoal.id];
      if (draftReminder !== old?.reminderAt) {
        notifId = await scheduleReminder(trimmed, draftReminder ?? 0, notifId);
        if (!draftReminder) notifId = undefined;
      }

      const data = await apiFetch<{ goal: ApiGoal }>(`/goals/${editingGoal.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          title: trimmed,
          reminderAt: draftReminder ? new Date(draftReminder).toISOString() : null,
        }),
      }).catch(() => null);
      if (!data) return;

      const newMap = { ...notifMapRef.current };
      if (notifId) newMap[editingGoal.id] = notifId;
      else delete newMap[editingGoal.id];
      notifMapRef.current = newMap;
      await saveNotifMap(newMap);

      setGoals((prev) =>
        prev.map((g) => (g.id === editingGoal.id ? fromApi(data.goal, newMap) : g))
      );
    } else {
      const notifId = draftReminder
        ? await scheduleReminder(trimmed, draftReminder)
        : undefined;

      const data = await apiFetch<{ goal: ApiGoal }>("/goals", {
        method: "POST",
        token,
        body: JSON.stringify({
          title: trimmed,
          reminderAt: draftReminder ? new Date(draftReminder).toISOString() : null,
        }),
      }).catch(() => null);
      if (!data) return;

      const newMap = { ...notifMapRef.current };
      if (notifId) newMap[data.goal.id] = notifId;
      notifMapRef.current = newMap;
      await saveNotifMap(newMap);

      setGoals((prev) => [fromApi(data.goal, newMap), ...prev]);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closeModal();
  };

  const toggleComplete = async (id: string) => {
    if (!token) return;
    setPendingDeleteId(null);
    const goal = goals.find((g) => g.id === id);
    if (!goal) return;
    const data = await apiFetch<{ goal: ApiGoal }>(`/goals/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ completed: !goal.completed }),
    }).catch(() => null);
    if (!data) return;
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? fromApi(data.goal, notifMapRef.current) : g))
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const confirmDelete = async (id: string) => {
    if (!token) return;
    const goal = goals.find((g) => g.id === id);
    if (goal?.notificationId) await cancelReminder(goal.notificationId);

    await apiFetch(`/goals/${id}`, { method: "DELETE", token }).catch(() => {});

    const newMap = { ...notifMapRef.current };
    delete newMap[id];
    notifMapRef.current = newMap;
    await saveNotifMap(newMap);

    setGoals((prev) => prev.filter((g) => g.id !== id));
    setPendingDeleteId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const openReminderFromForm = () => { reminderTargetId.current = null; setModalVisible(false); setReminderPickerVisible(true); };
  const openReminderForCard = (goal: Goal) => { reminderTargetId.current = goal.id; setReminderPickerVisible(true); };

  const handleReminderConfirm = async (ts: number) => {
    setReminderPickerVisible(false);
    if (reminderTargetId.current) {
      if (!token) return;
      const goal = goals.find((g) => g.id === reminderTargetId.current);
      if (!goal) return;
      const notifId = await scheduleReminder(goal.title, ts, goal.notificationId);
      const data = await apiFetch<{ goal: ApiGoal }>(`/goals/${goal.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ reminderAt: new Date(ts).toISOString() }),
      }).catch(() => null);
      if (!data) return;

      const newMap = { ...notifMapRef.current };
      if (notifId) newMap[goal.id] = notifId;
      notifMapRef.current = newMap;
      await saveNotifMap(newMap);

      setGoals((prev) =>
        prev.map((g) => (g.id === goal.id ? fromApi(data.goal, newMap) : g))
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reminderTargetId.current = null;
    } else { setDraftReminder(ts); setModalVisible(true); }
  };

  const handleReminderClear = async () => {
    setReminderPickerVisible(false);
    if (reminderTargetId.current) {
      if (!token) return;
      const goal = goals.find((g) => g.id === reminderTargetId.current);
      if (!goal) return;
      if (goal.notificationId) await cancelReminder(goal.notificationId);
      const data = await apiFetch<{ goal: ApiGoal }>(`/goals/${goal.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ reminderAt: null }),
      }).catch(() => null);
      if (!data) return;

      const newMap = { ...notifMapRef.current };
      delete newMap[goal.id];
      notifMapRef.current = newMap;
      await saveNotifMap(newMap);

      setGoals((prev) =>
        prev.map((g) => (g.id === goal.id ? fromApi(data.goal, newMap) : g))
      );
      reminderTargetId.current = null;
    } else { setDraftReminder(undefined); setModalVisible(true); }
  };

  const handleReminderClose = () => {
    setReminderPickerVisible(false);
    if (reminderTargetId.current === null) setModalVisible(true);
    reminderTargetId.current = null;
  };

  const completedCount = goals.filter((g) => g.completed).length;
  const totalCount = goals.length;

  const renderGoal = ({ item }: { item: Goal }) => {
    const isPendingDelete = pendingDeleteId === item.id;
    const hasReminder = !!item.reminderAt;
    const reminderPast = hasReminder && item.reminderAt! < Date.now();

    return (
      <View style={[styles.goalCard, item.completed && styles.goalCardDone]}>
        {isPendingDelete ? (
          <View style={styles.confirmRow}>
            <Pressable style={({ pressed }) => [styles.confirmCancel, pressed && { opacity: 0.7 }]} onPress={() => setPendingDeleteId(null)}>
              <Text style={styles.confirmCancelText}>إلغاء</Text>
            </Pressable>
            <Text style={styles.confirmQuestion}>حذف الهدف؟</Text>
            <Pressable style={({ pressed }) => [styles.confirmDelete, pressed && { opacity: 0.7 }]} onPress={() => confirmDelete(item.id)}>
              <Text style={styles.confirmDeleteText}>حذف</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable style={({ pressed }) => [styles.iconBtn, styles.deleteBtn, pressed && { opacity: 0.6 }]} onPress={() => setPendingDeleteId(item.id)} hitSlop={8}>
              <Feather name="trash-2" size={15} color="#FF453A" />
            </Pressable>
            <Pressable style={({ pressed }) => [styles.iconBtn, styles.editBtn, pressed && { opacity: 0.6 }]} onPress={() => openEdit(item)} hitSlop={8}>
              <Feather name="edit-2" size={15} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.iconBtn, hasReminder ? styles.bellBtnActive : styles.bellBtn, pressed && { opacity: 0.6 }]}
              onPress={() => openReminderForCard(item)} hitSlop={8}
            >
              <Feather name={hasReminder ? "bell" : "bell-off"} size={15} color={hasReminder ? (reminderPast ? colors.textSecondary : "#F59E0B") : colors.textSecondary} />
            </Pressable>
            <View style={styles.goalBody}>
              <Pressable onPress={() => toggleComplete(item.id)}>
                <Text style={[styles.goalTitle, item.completed && styles.goalTitleDone]} numberOfLines={2}>{item.title}</Text>
              </Pressable>
              {hasReminder && (
                <View style={[styles.reminderChip, reminderPast && styles.reminderChipPast]}>
                  <Feather name="clock" size={10} color={reminderPast ? colors.textSecondary : "#F59E0B"} />
                  <Text style={[styles.reminderChipText, reminderPast && styles.reminderChipTextPast]}>{formatReminderLabel(item.reminderAt!)}</Text>
                </View>
              )}
            </View>
            <Pressable style={[styles.checkbox, item.completed && styles.checkboxDone]} onPress={() => toggleComplete(item.id)} hitSlop={8}>
              {item.completed && <Feather name="check" size={13} color="#FFFFFF" />}
            </Pressable>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <View style={styles.header}>
        <View style={styles.statsChip}>
          <Text style={styles.statsText}>{completedCount}/{totalCount}</Text>
        </View>
        <Text style={styles.title}>الأهداف</Text>
      </View>

      {totalCount > 0 && (
        <View style={styles.progressWrap}>
          <View style={[styles.progressFill, { width: `${Math.round((completedCount / totalCount) * 100)}%` as any }]} />
        </View>
      )}

      {aiShowSuccess && (
        <View style={styles.aiSuccessBanner}>
          <Feather name="check-circle" size={15} color="#34D399" />
          <Text style={styles.aiSuccessBannerText} numberOfLines={2}>
            تم إنشاء هدف "{aiSuccessLabel}" مع {aiPlans.find((p) => p.goalLabel === aiSuccessLabel)?.tasks.length ?? 0} مهام ✓
          </Text>
        </View>
      )}

      {!loading && (
        <FlatList
          data={goals}
          keyExtractor={(item) => item.id}
          renderItem={renderGoal}
          contentContainerStyle={[styles.listContent, goals.length === 0 && styles.listEmpty]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            aiPlans.length > 0 ? (
              <View style={styles.aiSection}>
                <View style={styles.aiSectionHeader}>
                  <View style={styles.aiSectionIconWrap}>
                    <Feather name="cpu" size={12} color={AI_PURPLE} />
                  </View>
                  <Text style={styles.aiSectionTitle}>مهام AI</Text>
                </View>

                {aiPlans.map((plan) => {
                  const isConverting = aiConverting.has(plan.goalLabel);
                  const date = new Date(plan.createdAt);
                  const dateLabel = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

                  return (
                    <View key={plan.goalLabel} style={[styles.aiPlanCard, plan.alreadyConverted && styles.aiPlanCardDone]}>
                      <View style={styles.aiPlanBody}>
                        <Text style={[styles.aiPlanTitle, plan.alreadyConverted && styles.aiPlanTitleDone]} numberOfLines={2}>
                          {plan.goalLabel}
                        </Text>
                        <View style={styles.aiPlanMeta}>
                          <View style={styles.aiPlanChip}>
                            <Feather name="list" size={10} color={AI_PURPLE} />
                            <Text style={styles.aiPlanChipText}>{plan.tasks.length} مهام</Text>
                          </View>
                          <View style={styles.aiPlanChip}>
                            <Feather name="calendar" size={10} color={colors.textSecondary} />
                            <Text style={[styles.aiPlanChipText, { color: colors.textSecondary }]}>{dateLabel}</Text>
                          </View>
                        </View>
                      </View>

                      {plan.alreadyConverted ? (
                        <View style={styles.aiDoneChip}>
                          <Feather name="check" size={11} color="#34D399" />
                          <Text style={styles.aiDoneChipText}>تم الإنشاء مسبقاً</Text>
                        </View>
                      ) : (
                        <Pressable
                          style={({ pressed }) => [
                            styles.aiCreateBtn,
                            isConverting && { opacity: 0.5 },
                            pressed && { opacity: 0.75 },
                          ]}
                          onPress={() => createGoalFromPlan(plan)}
                          disabled={isConverting}
                        >
                          {isConverting ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.aiCreateBtnText}>إنشاء هدف</Text>
                          )}
                        </Pressable>
                      )}
                    </View>
                  );
                })}

                <View style={styles.aiSectionDivider} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Feather name="target" size={28} color={colors.placeholder} />
              </View>
              <Text style={styles.emptyTitle}>لا توجد أهداف</Text>
              <Text style={styles.emptySubtitle}>اضغط على + لإضافة هدف جديد</Text>
            </View>
          }
        />
      )}

      <Pressable style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]} onPress={openAdd}>
        <Feather name="plus" size={26} color="#FFFFFF" />
      </Pressable>

      <BottomNav active="goals" />

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.overlay} onPress={closeModal} />
        <KeyboardAvoidingView style={styles.modalPositioner} behavior={Platform.OS === "ios" ? "position" : "height"} keyboardVerticalOffset={0}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{editingGoal ? "تعديل الهدف" : "هدف جديد"}</Text>
            <TextInput
              ref={inputRef}
              style={styles.sheetInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="اكتب هدفك هنا..."
              placeholderTextColor={colors.placeholder}
              textAlign="right"
              multiline
              maxLength={200}
            />
            <Pressable style={({ pressed }) => [styles.reminderRow, pressed && { opacity: 0.75 }]} onPress={openReminderFromForm}>
              {draftReminder ? (
                <>
                  <Pressable hitSlop={8} onPress={(e) => { e.stopPropagation(); setDraftReminder(undefined); }}>
                    <Feather name="x" size={16} color={colors.textSecondary} />
                  </Pressable>
                  <Text style={styles.reminderRowValueText}>{formatReminderLabel(draftReminder)}</Text>
                  <Feather name="bell" size={16} color="#F59E0B" />
                </>
              ) : (
                <>
                  <Feather name="chevron-left" size={16} color={colors.textSecondary} />
                  <Text style={styles.reminderRowLabel}>تحديد تذكير</Text>
                  <Feather name="bell-off" size={16} color={colors.textSecondary} />
                </>
              )}
            </Pressable>
            <View style={styles.sheetActions}>
              <Pressable style={({ pressed }) => [styles.sheetBtn, styles.sheetBtnCancel, pressed && { opacity: 0.7 }]} onPress={closeModal}>
                <Text style={styles.sheetBtnCancelText}>إلغاء</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.sheetBtn, styles.sheetBtnSave, !inputText.trim() && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}
                onPress={saveGoal} disabled={!inputText.trim()}
              >
                <Text style={styles.sheetBtnSaveText}>{editingGoal ? "حفظ" : "إضافة"}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ReminderPicker
        visible={reminderPickerVisible}
        initialTimestamp={reminderTargetId.current ? goals.find((g) => g.id === reminderTargetId.current)?.reminderAt : draftReminder}
        onConfirm={handleReminderConfirm}
        onClear={handleReminderClear}
        onClose={handleReminderClose}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8, paddingBottom: 14 },
    title: { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.text, textAlign: "right", writingDirection: "rtl" },
    statsChip: { backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
    statsText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: GOAL_ACCENT },
    progressWrap: { height: 3, backgroundColor: colors.border, borderRadius: 2, marginBottom: 16, overflow: "hidden" },
    progressFill: { height: "100%", backgroundColor: GOAL_ACCENT, borderRadius: 2 },
    listContent: { paddingBottom: 140, gap: 10 },
    listEmpty: { flex: 1, justifyContent: "center" },
    goalCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border, gap: 8 },
    goalCardDone: { opacity: 0.6 },
    confirmRow: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    confirmQuestion: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.textSoft, writingDirection: "rtl" },
    confirmDelete: { backgroundColor: "#FF453A22", borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#FF453A55" },
    confirmDeleteText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FF453A", writingDirection: "rtl" },
    confirmCancel: { backgroundColor: colors.border, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8 },
    confirmCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.textSecondary, writingDirection: "rtl" },
    iconBtn: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    deleteBtn: { backgroundColor: "#2C1515" },
    editBtn: { backgroundColor: colors.border },
    bellBtn: { backgroundColor: colors.border },
    bellBtnActive: { backgroundColor: "#F59E0B18" },
    goalBody: { flex: 1, gap: 5 },
    goalTitle: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.text, textAlign: "right", writingDirection: "rtl", lineHeight: 20 },
    goalTitleDone: { textDecorationLine: "line-through", color: colors.textSecondary },
    reminderChip: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end", backgroundColor: "#F59E0B18", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: "#F59E0B33" },
    reminderChipPast: { backgroundColor: colors.border, borderColor: colors.placeholder },
    reminderChipText: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#F59E0B", writingDirection: "rtl" },
    reminderChipTextPast: { color: colors.textSecondary },
    checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: GOAL_ACCENT, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    checkboxDone: { backgroundColor: GOAL_ACCENT, borderColor: GOAL_ACCENT },
    emptyWrap: { alignItems: "center", gap: 10, paddingBottom: 80 },
    emptyIconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", marginBottom: 8 },
    emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.textSoft, textAlign: "center", writingDirection: "rtl" },
    emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textSecondary, textAlign: "center", writingDirection: "rtl" },
    aiSuccessBanner: {
      flexDirection: "row-reverse", alignItems: "center", gap: 8,
      backgroundColor: "#34D39918", borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, borderColor: "#34D39933", marginBottom: 10,
    },
    aiSuccessBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#34D399", writingDirection: "rtl" },
    aiSection: { marginBottom: 8 },
    aiSectionHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 10 },
    aiSectionIconWrap: {
      width: 24, height: 24, borderRadius: 7,
      backgroundColor: "#7C6EFA22", alignItems: "center", justifyContent: "center",
    },
    aiSectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.textSecondary, writingDirection: "rtl", textTransform: "uppercase", letterSpacing: 0.5 },
    aiPlanCard: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.card, borderRadius: 14,
      paddingVertical: 12, paddingHorizontal: 14,
      borderWidth: 1, borderColor: "#7C6EFA33",
      marginBottom: 8, gap: 12,
    },
    aiPlanCardDone: { borderColor: colors.border, opacity: 0.65 },
    aiPlanBody: { flex: 1, gap: 6 },
    aiPlanTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.text, writingDirection: "rtl", lineHeight: 20 },
    aiPlanTitleDone: { color: colors.textSecondary },
    aiPlanMeta: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
    aiPlanChip: { flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: "#7C6EFA14", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
    aiPlanChipText: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#7C6EFA", writingDirection: "rtl" },
    aiCreateBtn: {
      backgroundColor: "#7C6EFA", borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 8, minWidth: 82, alignItems: "center",
    },
    aiCreateBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#FFFFFF", writingDirection: "rtl" },
    aiDoneChip: {
      flexDirection: "row-reverse", alignItems: "center", gap: 5,
      backgroundColor: "#34D39918", borderRadius: 10,
      paddingHorizontal: 10, paddingVertical: 7,
      borderWidth: 1, borderColor: "#34D39933",
    },
    aiDoneChipText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#34D399", writingDirection: "rtl" },
    aiSectionDivider: { height: 1, backgroundColor: colors.border, marginTop: 4, marginBottom: 14 },
    fab: { position: "absolute", bottom: Platform.OS === "web" ? 34 + 70 : 90, left: 24, width: 56, height: 56, borderRadius: 18, backgroundColor: GOAL_ACCENT, alignItems: "center", justifyContent: "center", shadowColor: GOAL_ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
    fabPressed: { transform: [{ scale: 0.93 }], opacity: 0.9 },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
    modalPositioner: { position: "absolute", bottom: 0, left: 0, right: 0 },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: Platform.OS === "web" ? 34 : 40, paddingHorizontal: 20, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.placeholder, alignSelf: "center", marginBottom: 20 },
    sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.text, textAlign: "right", writingDirection: "rtl", marginBottom: 16 },
    sheetInput: { backgroundColor: colors.bg, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: "Inter_400Regular", color: colors.text, minHeight: 80, textAlignVertical: "top", marginBottom: 12, writingDirection: "rtl" },
    reminderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.bg, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 16 },
    reminderRowLabel: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.textSecondary, writingDirection: "rtl" },
    reminderRowValueText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#F59E0B", writingDirection: "rtl" },
    sheetActions: { flexDirection: "row", gap: 10 },
    sheetBtn: { flex: 1, borderRadius: 13, paddingVertical: 15, alignItems: "center" },
    sheetBtnCancel: { backgroundColor: colors.border },
    sheetBtnCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.textSoft, writingDirection: "rtl" },
    sheetBtnSave: { backgroundColor: GOAL_ACCENT },
    sheetBtnSaveText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFFFFF", writingDirection: "rtl" },
  });
}
