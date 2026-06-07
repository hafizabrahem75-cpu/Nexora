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
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomNav from "@/components/BottomNav";
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";

const STORAGE_KEY = "@nexora_notes";
const NOTE_ACCENT = "#F59E0B";

interface Note {
  id: string;
  content: string;
  createdAt: number;
}

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
}

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;

  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [inputText, setInputText] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => { if (raw) setNotes(JSON.parse(raw)); })
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback((updated: Note[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const openAdd = () => {
    setPendingDeleteId(null);
    setEditingNote(null);
    setInputText("");
    setModalVisible(true);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const openEdit = (note: Note) => {
    setPendingDeleteId(null);
    setEditingNote(note);
    setInputText(note.content);
    setModalVisible(true);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingNote(null);
    setInputText("");
  };

  const saveNote = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    let updated: Note[];
    if (editingNote) {
      updated = notes.map((n) => n.id === editingNote.id ? { ...n, content: trimmed } : n);
    } else {
      updated = [{ id: genId(), content: trimmed, createdAt: Date.now() }, ...notes];
    }
    setNotes(updated);
    persist(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closeModal();
  };

  const confirmDelete = (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    persist(updated);
    setPendingDeleteId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const renderNote = ({ item }: { item: Note }) => {
    const isPendingDelete = pendingDeleteId === item.id;

    return (
      <View style={styles.noteCard}>
        {isPendingDelete ? (
          <View style={styles.confirmRow}>
            <Pressable style={({ pressed }) => [styles.confirmCancel, pressed && { opacity: 0.7 }]} onPress={() => setPendingDeleteId(null)}>
              <Text style={styles.confirmCancelText}>إلغاء</Text>
            </Pressable>
            <Text style={styles.confirmQuestion}>حذف الملاحظة؟</Text>
            <Pressable style={({ pressed }) => [styles.confirmDelete, pressed && { opacity: 0.7 }]} onPress={() => confirmDelete(item.id)}>
              <Text style={styles.confirmDeleteText}>حذف</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.cardActions}>
              <Pressable style={({ pressed }) => [styles.actionBtn, styles.deleteBtn, pressed && { opacity: 0.6 }]} onPress={() => setPendingDeleteId(item.id)} hitSlop={8}>
                <Feather name="trash-2" size={14} color="#FF453A" />
              </Pressable>
              <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
              <Pressable style={({ pressed }) => [styles.actionBtn, styles.editBtn, pressed && { opacity: 0.6 }]} onPress={() => openEdit(item)} hitSlop={8}>
                <Feather name="edit-2" size={14} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Pressable onPress={() => openEdit(item)} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
              <Text style={styles.noteContent} numberOfLines={6}>{item.content}</Text>
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
          <Text style={styles.statsText}>{notes.length}</Text>
        </View>
        <Text style={styles.title}>الملاحظات</Text>
      </View>

      {!loading && (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          renderItem={renderNote}
          contentContainerStyle={[styles.listContent, notes.length === 0 && styles.listEmpty]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Feather name="file-text" size={28} color={colors.placeholder} />
              </View>
              <Text style={styles.emptyTitle}>لا توجد ملاحظات</Text>
              <Text style={styles.emptySubtitle}>اضغط على + لإضافة ملاحظة جديدة</Text>
            </View>
          }
        />
      )}

      <Pressable style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]} onPress={openAdd}>
        <Feather name="plus" size={26} color="#FFFFFF" />
      </Pressable>

      <BottomNav active="home" />

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView style={styles.modalPositioner} behavior={Platform.OS === "ios" ? "position" : "height"} keyboardVerticalOffset={0}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{editingNote ? "تعديل الملاحظة" : "ملاحظة جديدة"}</Text>
            <TextInput
              ref={inputRef}
              style={styles.sheetInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="اكتب ملاحظتك هنا..."
              placeholderTextColor={colors.placeholder}
              textAlign="right"
              multiline
              maxLength={1000}
            />
            <View style={styles.sheetActions}>
              <Pressable style={({ pressed }) => [styles.sheetBtn, styles.sheetBtnCancel, pressed && { opacity: 0.7 }]} onPress={closeModal}>
                <Text style={styles.sheetBtnCancelText}>إلغاء</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.sheetBtn, styles.sheetBtnSave, !inputText.trim() && styles.sheetBtnDisabled, pressed && { opacity: 0.8 }]}
                onPress={saveNote} disabled={!inputText.trim()}
              >
                <Text style={styles.sheetBtnSaveText}>{editingNote ? "حفظ" : "إضافة"}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8, paddingBottom: 14 },
    title: { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.text, textAlign: "right", writingDirection: "rtl" },
    statsChip: { backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
    statsText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: NOTE_ACCENT },
    listContent: { paddingBottom: 140, gap: 12 },
    listEmpty: { flex: 1, justifyContent: "center" },
    noteCard: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 },
    cardActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    dateText: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.textSecondary, writingDirection: "rtl" },
    actionBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    editBtn: { backgroundColor: colors.border },
    deleteBtn: { backgroundColor: "#2C1515" },
    noteContent: { fontSize: 15, fontFamily: "Inter_400Regular", color: colors.textSoft, textAlign: "right", writingDirection: "rtl", lineHeight: 24 },
    confirmRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
    confirmQuestion: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.textSoft, writingDirection: "rtl" },
    confirmDelete: { backgroundColor: "#FF453A22", borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#FF453A55" },
    confirmDeleteText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FF453A", writingDirection: "rtl" },
    confirmCancel: { backgroundColor: colors.border, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8 },
    confirmCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.textSecondary, writingDirection: "rtl" },
    emptyWrap: { alignItems: "center", gap: 10, paddingBottom: 80 },
    emptyIconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", marginBottom: 8 },
    emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.textSoft, textAlign: "center", writingDirection: "rtl" },
    emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textSecondary, textAlign: "center", writingDirection: "rtl" },
    fab: { position: "absolute", bottom: Platform.OS === "web" ? 34 + 70 : 90, left: 24, width: 56, height: 56, borderRadius: 18, backgroundColor: NOTE_ACCENT, alignItems: "center", justifyContent: "center", shadowColor: NOTE_ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
    fabPressed: { transform: [{ scale: 0.93 }], opacity: 0.9 },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
    modalPositioner: { position: "absolute", bottom: 0, left: 0, right: 0 },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: Platform.OS === "web" ? 34 : 40, paddingHorizontal: 20, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.placeholder, alignSelf: "center", marginBottom: 20 },
    sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.text, textAlign: "right", writingDirection: "rtl", marginBottom: 16 },
    sheetInput: { backgroundColor: colors.bg, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: "Inter_400Regular", color: colors.text, minHeight: 120, textAlignVertical: "top", marginBottom: 16, writingDirection: "rtl" },
    sheetActions: { flexDirection: "row", gap: 10 },
    sheetBtn: { flex: 1, borderRadius: 13, paddingVertical: 15, alignItems: "center" },
    sheetBtnCancel: { backgroundColor: colors.border },
    sheetBtnCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.textSoft, writingDirection: "rtl" },
    sheetBtnSave: { backgroundColor: NOTE_ACCENT },
    sheetBtnDisabled: { opacity: 0.4 },
    sheetBtnSaveText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFFFFF", writingDirection: "rtl" },
  });
}
