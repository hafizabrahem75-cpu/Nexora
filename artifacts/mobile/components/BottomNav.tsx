import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotifications } from "@/context/NotificationsContext";
import { useColors, useSettings } from "@/context/SettingsContext";
import type { ThemeColors } from "@/context/SettingsContext";

export type Tab = "home" | "tasks" | "goals" | "notes" | "notifications" | "messages" | "profile";

interface TabDef {
  key: Tab;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  route: string;
}

const TABS: TabDef[] = [
  { key: "profile",       label: "الملف",      icon: "user",           route: "/profile"       },
  { key: "messages",      label: "الرسائل",    icon: "message-circle", route: "/conversations" },
  { key: "notifications", label: "الإشعارات",  icon: "bell",           route: "/notifications" },
  { key: "tasks",         label: "المهام",     icon: "check-square",   route: "/tasks"         },
  { key: "home",          label: "الرئيسية",   icon: "home",           route: "/home"          },
];

interface Props {
  active: Tab;
  unreadMessages?: number;
}

export default function BottomNav({ active, unreadMessages = 0 }: Props) {
  const insets = useSafeAreaInsets();
  const paddingBottom = Platform.OS === "web" ? 8 : insets.bottom;
  const { accent } = useSettings();
  const colors = useColors();
  const { unreadCount } = useNotifications();

  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingBottom }]}>
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          const showMsgBadge = tab.key === "messages" && unreadMessages > 0;
          const showNotifBadge = tab.key === "notifications" && unreadCount > 0;
          return (
            <Pressable
              key={tab.key}
              style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
              onPress={() => { if (!isActive) router.replace(tab.route as any); }}
            >
              <View style={[styles.iconWrap, isActive && { backgroundColor: accent + "22" }]}>
                <Feather
                  name={tab.icon}
                  size={20}
                  color={isActive ? accent : colors.textTertiary}
                />
                {showMsgBadge && (
                  <View style={[styles.badge, { borderColor: colors.navBg }]}>
                    <Text style={styles.badgeText}>
                      {unreadMessages > 9 ? "9+" : String(unreadMessages)}
                    </Text>
                  </View>
                )}
                {showNotifBadge && (
                  <View style={[styles.badge, { borderColor: colors.navBg }]}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 9 ? "9+" : String(unreadCount)}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, isActive && { color: accent }]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      position: "absolute",
      bottom: 0, left: 0, right: 0,
      backgroundColor: colors.navBg,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
    },
    bar: {
      flexDirection: "row",
      paddingTop: 10,
      paddingHorizontal: 4,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      paddingBottom: 4,
      gap: 3,
    },
    iconWrap: {
      width: 40,
      height: 28,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      fontSize: 9,
      fontFamily: "Inter_500Medium",
      color: colors.textTertiary,
      writingDirection: "rtl",
    },
    badge: {
      position: "absolute",
      top: -4, right: -4,
      minWidth: 16, height: 16,
      borderRadius: 8,
      backgroundColor: "#FF453A",
      alignItems: "center", justifyContent: "center",
      paddingHorizontal: 3,
      borderWidth: 1.5,
    },
    badgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  });
}
