import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const existingPerms = await Notifications.getPermissionsAsync();
    if ((existingPerms as unknown as { granted: boolean }).granted) return true;
    const newPerms = await Notifications.requestPermissionsAsync();
    return (newPerms as unknown as { granted: boolean }).granted;
  } catch {
    return false;
  }
}

export async function scheduleReminder(
  title: string,
  reminderAt: number,
  existingId?: string
): Promise<string | undefined> {
  if (Platform.OS === "web") return undefined;
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId).catch(() => {});
  }
  if (reminderAt <= Date.now()) return undefined;
  try {
    const granted = await requestPermission();
    if (!granted) return undefined;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "تذكير Nexora 🔔",
        body: title,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(reminderAt),
      },
    });
    return id;
  } catch {
    return undefined;
  }
}

export async function cancelReminder(id?: string): Promise<void> {
  if (Platform.OS === "web" || !id) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

export function formatDateDDMMYYYY(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function formatReminderLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  if (isSameDay(d, now)) return `اليوم ${time}`;
  if (isSameDay(d, tomorrow)) return `غداً ${time}`;

  const diffDays = Math.floor(
    (d.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000
  );
  if (diffDays <= 6) {
    const weekday = new Date(ts).toLocaleDateString("ar-SA", { weekday: "long" });
    return `${weekday} ${time}`;
  }

  const dd = String(new Date(ts).getDate()).padStart(2, "0");
  const mm = String(new Date(ts).getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm} ${time}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
