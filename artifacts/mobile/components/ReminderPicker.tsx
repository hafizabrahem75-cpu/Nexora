import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/* Short 3-char day abbreviations, Sunday=index 0 */
const DAY_HEADERS = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];

/* Build rows of 7 (Sunday-first). Empty slots = null */
function buildCalendarRows(year: number, month: number): (number | null)[][] {
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const flat: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) flat.push(null);
  for (let d = 1; d <= daysInMonth; d++) flat.push(d);
  while (flat.length % 7 !== 0) flat.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < flat.length; i += 7) rows.push(flat.slice(i, i + 7));
  return rows;
}

function formatDDMMYYYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface Props {
  visible: boolean;
  initialTimestamp?: number;
  onConfirm: (timestamp: number) => void;
  onClear: () => void;
  onClose: () => void;
}

export default function ReminderPicker({
  visible,
  initialTimestamp,
  onConfirm,
  onClear,
  onClose,
}: Props) {
  const today = new Date();

  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const base = initialTimestamp ? new Date(initialTimestamp) : today;
    setCalYear(base.getFullYear());
    setCalMonth(base.getMonth());
    setSelectedDate(new Date(base));
    setHour(initialTimestamp ? base.getHours() : 9);
    setMinute(initialTimestamp ? base.getMinutes() : 0);
  }, [visible]);

  const goPrevMonth = () => {
    Haptics.selectionAsync();
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  };

  const goNextMonth = () => {
    Haptics.selectionAsync();
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  };

  const selectDay = (day: number) => {
    setSelectedDate(new Date(calYear, calMonth, day));
    Haptics.selectionAsync();
  };

  const changeHour = (delta: number) => {
    setHour((h) => (h + delta + 24) % 24);
    Haptics.selectionAsync();
  };

  const changeMinute = (delta: number) => {
    setMinute((m) => (m + delta + 60) % 60);
    Haptics.selectionAsync();
  };

  const handleConfirm = () => {
    const result = new Date(selectedDate);
    result.setHours(hour, minute, 0, 0);
    onConfirm(result.getTime());
  };

  const pad = (n: number) => String(n).padStart(2, "0");
  const rows = buildCalendarRows(calYear, calMonth);

  const isSelected = (day: number) =>
    selectedDate.getFullYear() === calYear &&
    selectedDate.getMonth() === calMonth &&
    selectedDate.getDate() === day;

  const isToday = (day: number) =>
    today.getFullYear() === calYear &&
    today.getMonth() === calMonth &&
    today.getDate() === day;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title + Clear */}
          <View style={styles.titleRow}>
            {initialTimestamp ? (
              <Pressable
                style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }]}
                onPress={onClear}
              >
                <Feather name="x-circle" size={14} color="#FF453A" />
                <Text style={styles.clearText}>مسح التذكير</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Text style={styles.title}>تحديد التذكير</Text>
          </View>

          {/* DD/MM/YYYY date display */}
          <View style={styles.dateField}>
            <Text style={styles.dateFieldValue}>{formatDDMMYYYY(selectedDate)}</Text>
            <View style={styles.dateFieldLeft}>
              <Feather name="calendar" size={14} color="#8E8E93" />
              <Text style={styles.dateFieldLabel}>التاريخ</Text>
            </View>
          </View>

          {/* Month navigation */}
          <View style={styles.monthNav}>
            {/* In RTL: first item renders on the RIGHT = prev month */}
            <Pressable
              style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.6 }]}
              onPress={goPrevMonth}
            >
              <Feather name="chevron-right" size={20} color="#7C6EFA" />
            </Pressable>
            <Text style={styles.monthLabel}>
              {ARABIC_MONTHS[calMonth]} {calYear}
            </Text>
            {/* In RTL: last item renders on the LEFT = next month */}
            <Pressable
              style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.6 }]}
              onPress={goNextMonth}
            >
              <Feather name="chevron-left" size={20} color="#7C6EFA" />
            </Pressable>
          </View>

          {/* Day headers */}
          <View style={styles.calRow}>
            {DAY_HEADERS.map((h) => (
              <View key={h} style={styles.calCell}>
                <Text style={styles.dayHeader}>{h}</Text>
              </View>
            ))}
          </View>

          {/* Calendar rows */}
          {rows.map((row, ri) => (
            <View key={ri} style={styles.calRow}>
              {row.map((day, ci) => (
                <View key={ci} style={styles.calCell}>
                  {day !== null ? (
                    <Pressable
                      style={[
                        styles.dayCell,
                        isSelected(day) && styles.dayCellSelected,
                        !isSelected(day) && isToday(day) && styles.dayCellToday,
                      ]}
                      onPress={() => selectDay(day)}
                    >
                      <Text
                        style={[
                          styles.dayNum,
                          isSelected(day) && styles.dayNumSelected,
                          !isSelected(day) && isToday(day) && styles.dayNumToday,
                        ]}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={styles.dayCell} />
                  )}
                </View>
              ))}
            </View>
          ))}

          {/* Time section */}
          <Text style={styles.sectionLabel}>الوقت</Text>
          <View style={styles.timeRow}>
            {/* Minutes column */}
            <View style={styles.timeUnit}>
              <Pressable
                style={({ pressed }) => [styles.timeBtn, pressed && { opacity: 0.7 }]}
                onPress={() => changeMinute(1)}
              >
                <Feather name="chevron-up" size={20} color="#7C6EFA" />
              </Pressable>
              <View style={styles.timeBox}>
                <Text style={styles.timeValue}>{pad(minute)}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.timeBtn, pressed && { opacity: 0.7 }]}
                onPress={() => changeMinute(-1)}
              >
                <Feather name="chevron-down" size={20} color="#7C6EFA" />
              </Pressable>
              <Text style={styles.timeUnitLabel}>دقيقة</Text>
            </View>

            <Text style={styles.timeSep}>:</Text>

            {/* Hours column */}
            <View style={styles.timeUnit}>
              <Pressable
                style={({ pressed }) => [styles.timeBtn, pressed && { opacity: 0.7 }]}
                onPress={() => changeHour(1)}
              >
                <Feather name="chevron-up" size={20} color="#7C6EFA" />
              </Pressable>
              <View style={styles.timeBox}>
                <Text style={styles.timeValue}>{pad(hour)}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.timeBtn, pressed && { opacity: 0.7 }]}
                onPress={() => changeHour(-1)}
              >
                <Feather name="chevron-down" size={20} color="#7C6EFA" />
              </Pressable>
              <Text style={styles.timeUnitLabel}>ساعة</Text>
            </View>
          </View>

          {/* Preview bar */}
          <View style={styles.preview}>
            <Feather name="bell" size={14} color="#7C6EFA" />
            <Text style={styles.previewText}>
              {formatDDMMYYYY(selectedDate)} — {pad(hour)}:{pad(minute)}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.cancelBtn, pressed && { opacity: 0.7 }]}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>إلغاء</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.saveBtn, pressed && { opacity: 0.85 }]}
              onPress={handleConfirm}
            >
              <Feather name="bell" size={15} color="#FFFFFF" />
              <Text style={styles.saveText}>حفظ التذكير</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "92%",
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#2C2C2E",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3A3A3C",
    alignSelf: "center",
    marginBottom: 18,
  },

  /* Title */
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    writingDirection: "rtl",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#2C1515",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#FF453A33",
  },
  clearText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#FF453A",
    writingDirection: "rtl",
  },

  /* DD/MM/YYYY field */
  dateField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0D0D0F",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 16,
  },
  dateFieldLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateFieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#8E8E93",
    writingDirection: "rtl",
  },
  dateFieldValue: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },

  /* Month nav */
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#2C2C2E",
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    writingDirection: "rtl",
  },

  /* Calendar */
  calRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  calCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  dayHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#8E8E93",
    writingDirection: "rtl",
  },
  dayCell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellSelected: {
    backgroundColor: "#7C6EFA",
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: "#7C6EFA",
  },
  dayNum: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#EBEBF5",
  },
  dayNumSelected: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
  },
  dayNumToday: {
    color: "#7C6EFA",
    fontFamily: "Inter_600SemiBold",
  },

  /* Time */
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#8E8E93",
    textAlign: "right",
    writingDirection: "rtl",
    marginTop: 14,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginBottom: 14,
  },
  timeUnit: {
    alignItems: "center",
    gap: 6,
  },
  timeUnitLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#8E8E93",
    writingDirection: "rtl",
  },
  timeBtn: {
    width: 50,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#2C2C2E",
    alignItems: "center",
    justifyContent: "center",
  },
  timeBox: {
    width: 68,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#0D0D0F",
    borderWidth: 1,
    borderColor: "#2C2C2E",
    alignItems: "center",
    justifyContent: "center",
  },
  timeValue: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  timeSep: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#7C6EFA",
    marginBottom: 24,
  },

  /* Preview */
  preview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#7C6EFA18",
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#7C6EFA33",
  },
  previewText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#7C6EFA",
    writingDirection: "rtl",
  },

  /* Actions */
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 36,
  },
  btn: {
    flex: 1,
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
  },
  cancelBtn: { backgroundColor: "#2C2C2E" },
  cancelText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#EBEBF5",
    writingDirection: "rtl",
  },
  saveBtn: { backgroundColor: "#7C6EFA" },
  saveText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
    writingDirection: "rtl",
  },
});
