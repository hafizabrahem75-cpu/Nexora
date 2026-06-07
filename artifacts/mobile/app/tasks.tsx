import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";
import {
  cancelReminder,
  formatReminderLabel,
  scheduleReminder,
} from "@/utils/notifications";

const STORAGE_KEY = "@nexora_tasks";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  reminderAt?: number;
  notificationId?: string;
}

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;

  const { accent } = useSettings();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors, accent), [colors, accent]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [inputText, setInputText] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [draftReminder, setDraftReminder] = useState<number | undefined>(undefined);

  const [reminderPickerVisible, setReminderPickerVisible] = useState(false);
  const reminderTargetId = useRef<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => { if (raw) setTasks(JSON.parse(raw)); })
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback((updated: Task[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const openAdd = () => {
    setPendingDeleteId(null);
    setEditingTask(null);
    setInputText("");
    setDraftReminder(undefined);
    setModalVisible(true);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const openEdit = (task: Task) => {
    setPendingDeleteId(null);
    setEditingTask(task);
    setInputText(task.title);
    setDraftReminder(task.reminderAt);
    setModalVisible(true);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingTask(null);
    setInputText("");
    setDraftReminder(undefined);
  };

  const saveTask = async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    let updated: Task[];
    if (editingTask) {
      const old = tasks.find((t) => t.id === editingTask.id);
      let notifId = old?.notificationId;
      if (draftReminder !== old?.reminderAt) {
        notifId = await scheduleReminder(trimmed, draftReminder ?? 0, notifId);
        if (!draftReminder) notifId = undefined;
      }
      updated = tasks.map((t) =>
        t.id === editingTask.id
          ? { ...t, title: trimmed, reminderAt: draftReminder, notificationId: notifId }
          : t
      );
    } else {
      const notifId = draftReminder ? await scheduleReminder(trimmed, draftReminder) : undefined;
      updated = [{ id: genId(), title: trimmed, completed: false, createdAt: Date.now(), reminderAt: draftReminder, notificationId: notifId }, ...tasks];
    }
    setTasks(updated);
    persist(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closeModal();
  };

  const toggleComplete = (id: string) => {
    setPendingDeleteId(null);
    const updated = tasks.map((t) => t.id === id ? { ...t, completed: !t.completed } : t);
    setTasks(updated);
    persist(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const confirmDelete = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (task?.notificationId) await cancelReminder(task.notificationId);
    const updated = tasks.filter((t) => t.id !== id);
    setTasks(updated);
    persist(updated);
    setPendingDeleteId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const openReminderFromForm = () => {
    reminderTargetId.current = null;
    setModalVisible(false);
    setReminderPickerVisible(true);
  };

  const openReminderForCard = (task: Task) => {
    reminderTargetId.current = task.id;
    setReminderPickerVisible(true);
  };

  const handleReminderConfirm = async (ts: number) => {
    setReminderPickerVisible(false);
    if (reminderTargetId.current) {
      const task = tasks.find((t) => t.id === reminderTargetId.current);
      if (!task) return;
      const notifId = await scheduleReminder(task.title, ts, task.notificationId);
      const updated = tasks.map((t) => t.id === reminderTargetId.current ? { ...t, reminderAt: ts, notificationId: notifId } : t);
      setTasks(updated);
      persist(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reminderTargetId.current = null;
    } else {
      setDraftReminder(ts);
      setModalVisible(true);
    }
  };

  const handleReminderClear = async () => {
    setReminderPickerVisible(false);
    if (reminderTargetId.current) {
      const task = tasks.find((t) => t.id === reminderTargetId.current);
      if (task?.notificationId) await cancelReminder(task.notificationId);
      const updated = tasks.map((t) => t.id === reminderTargetId.current ? { ...t, reminderAt: undefined, notificationId: undefined } : t);
      setTasks(updated);
      persist(updated);
      reminderTargetId.current = null;
    } else {
      setDraftReminder(undefined);
      setModalVisible(true);
    }
  };

  const handleReminderClose = () => {
    setReminderPickerVisible(false);
    if (reminderTargetId.current === null) setModalVisible(true);
    reminderTargetId.current = null;
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;

  const renderTask = ({ item }: { item: Task }) => {
    const isPendingDelete = pendingDeleteId === item.id;
    const hasReminder = !!item.reminderAt;
    const reminderPast = hasReminder && item.reminderAt! < Date.now();

    return (
      <View style={[styles.taskCard, item.completed && styles.taskCardDone]}>
        {isPendingDelete ? (
          <View style={styles.confirmRow}>
            <Pressable style={({ pressed }) => [styles.confirmCancel, pressed && { opacity: 0.7 }]} onPress={() => setPendingDeleteId(null)}>
              <Text style={styles.confirmCancelText}>إلغاء</Text>
            </Pressable>
            <Text style={styles.confirmQuestion}>حذف المهمة؟</Text>
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
            <View style={styles.taskBody}>
              <Pressable onPress={() => toggleComplete(item.id)}>
                <Text style={[styles.taskTitle, item.completed && styles.taskTitleDone]} numberOfLines={2}>{item.title}</Text>
              </Pressable>
              {hasReminder && (
                <View style={[styles.reminderChip, reminderPast && styles.reminderChipPast]}>
                  <Feather name="clock" size={10} color={reminderPast ? colors.textSecondary : "#F59E0B"} />
                  <Text style={[styles.reminderChipText, reminderPast && styles.reminderChipTextPast]}>{formatReminderLabel(item.reminderAt!)}</Text>
                </View>
              )}
            </View>
            <Pressable
              style={[styles.checkbox, item.completed && styles.checkboxDone]}
              onPress={() => toggleComplete(item.id)} hitSlop={8}
            >
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
          <Text style={[styles.statsText, { color: accent }]}>{completedCount}/{totalCount}</Text>
        </View>
        <Text style={styles.title}>المهام</Text>
      </View>

      {totalCount > 0 && (
        <View style={styles.progressWrap}>
          <View style={[styles.progressFill, { width: `${Math.round((completedCount / totalCount) * 100)}%` as any, backgroundColor: accent }]} />
        </View>
      )}

      {!loading && (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={renderTask}
          contentContainerStyle={[styles.listContent, tasks.length === 0 && styles.listEmpty]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Feather name="check-square" size={28} color={colors.placeholder} />
              </View>
              <Text style={styles.emptyTitle}>لا توجد مهام</Text>
              <Text style={styles.emptySubtitle}>اضغط على + لإضافة مهمة جديدة</Text>
            </View>
          }
        />
      )}

      <Pressable style={({ pressed }) => [styles.fab, { backgroundColor: accent, shadowColor: accent }, pressed && styles.fabPressed]} onPress={openAdd}>
        <Feather name="plus" size={26} color="#FFFFFF" />
      </Pressable>

      <BottomNav active="tasks" />

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.overlay} onPress={closeModal} />
        <KeyboardAvoidingView style={styles.modalPositioner} behavior={Platform.OS === "ios" ? "position" : "height"} keyboardVerticalOffset={0}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{editingTask ? "تعديل المهمة" : "مهمة جديدة"}</Text>
            <TextInput
              ref={inputRef}
              style={styles.sheetInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="اكتب المهمة هنا..."
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
                style={({ pressed }) => [styles.sheetBtn, { backgroundColor: accent }, !inputText.trim() && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}
                onPress={saveTask} disabled={!inputText.trim()}
              >
                <Text style={styles.sheetBtnSaveText}>{editingTask ? "حفظ" : "إضافة"}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ReminderPicker
        visible={reminderPickerVisible}
        initialTimestamp={reminderTargetId.current ? tasks.find((t) => t.id === reminderTargetId.current)?.reminderAt : draftReminder}
        onConfirm={handleReminderConfirm}
        onClear={handleReminderClear}
        onClose={handleReminderClose}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors, accent: string) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8, paddingBottom: 14 },
    title: { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.text, textAlign: "right", writingDirection: "rtl" },
    statsChip: { backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
    statsText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
    progressWrap: { height: 3, backgroundColor: colors.border, borderRadius: 2, marginBottom: 16, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 2 },
    listContent: { paddingBottom: 140, gap: 10 },
    listEmpty: { flex: 1, justifyContent: "center" },
    taskCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border, gap: 8 },
    taskCardDone: { opacity: 0.6 },
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
    taskBody: { flex: 1, gap: 5 },
    taskTitle: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.text, textAlign: "right", writingDirection: "rtl", lineHeight: 20 },
    taskTitleDone: { textDecorationLine: "line-through", color: colors.textSecondary },
    reminderChip: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end", backgroundColor: "#F59E0B18", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: "#F59E0B33" },
    reminderChipPast: { backgroundColor: colors.border, borderColor: colors.placeholder },
    reminderChipText: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#F59E0B", writingDirection: "rtl" },
    reminderChipTextPast: { color: colors.textSecondary },
    checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: accent, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    checkboxDone: { backgroundColor: accent, borderColor: accent },
    emptyWrap: { alignItems: "center", gap: 10, paddingBottom: 80 },
    emptyIconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", marginBottom: 8 },
    emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.textSoft, textAlign: "center", writingDirection: "rtl" },
    emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textSecondary, textAlign: "center", writingDirection: "rtl" },
    fab: { position: "absolute", bottom: Platform.OS === "web" ? 34 + 70 : 90, left: 24, width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
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
    sheetBtnSaveText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFFFFF", writingDirection: "rtl" },
  });
}
