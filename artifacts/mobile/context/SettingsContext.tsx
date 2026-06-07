import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import { getTranslations, type Translations } from "@/lib/translations";

const SETTINGS_KEY = "@nexora_settings";

export const ACCENT_COLORS = [
  { id: "purple", value: "#7C6EFA", label: "البنفسجي" },
  { id: "blue",   value: "#3B82F6", label: "الأزرق"   },
  { id: "green",  value: "#34D399", label: "الأخضر"   },
  { id: "gold",   value: "#F59E0B", label: "الذهبي"   },
  { id: "red",    value: "#EF4444", label: "الأحمر"   },
  { id: "orange", value: "#F97316", label: "البرتقالي" },
];

export const LANGUAGES = [
  { code: "ar", label: "العربية",    nativeLabel: "العربية"   },
  { code: "en", label: "الإنجليزية", nativeLabel: "English"   },
  { code: "fr", label: "الفرنسية",   nativeLabel: "Français"  },
  { code: "es", label: "الإسبانية",  nativeLabel: "Español"   },
  { code: "tr", label: "التركية",    nativeLabel: "Türkçe"    },
  { code: "de", label: "الألمانية",  nativeLabel: "Deutsch"   },
  { code: "hi", label: "الهندية",    nativeLabel: "हिन्दी"      },
];

export interface ThemeColors {
  bg: string;
  bgElevated: string;
  card: string;
  cardAlt: string;
  border: string;
  borderSubtle: string;
  text: string;
  textSoft: string;
  textSecondary: string;
  textTertiary: string;
  placeholder: string;
  navBg: string;
  overlay: string;
}

export const DARK_COLORS: ThemeColors = {
  bg: "#0D0D0F",
  bgElevated: "#131316",
  card: "#1C1C1E",
  cardAlt: "#232326",
  border: "#2C2C2E",
  borderSubtle: "#1E1E28",
  text: "#FFFFFF",
  textSoft: "#EBEBF5",
  textSecondary: "#8E8E93",
  textTertiary: "#555566",
  placeholder: "#3A3A3C",
  navBg: "#0F0F12",
  overlay: "rgba(0,0,0,0.6)",
};

export const LIGHT_COLORS: ThemeColors = {
  bg: "#F2F2F7",
  bgElevated: "#FFFFFF",
  card: "#FFFFFF",
  cardAlt: "#F0F0F5",
  border: "#E5E5EA",
  borderSubtle: "#D1D1D6",
  text: "#000000",
  textSoft: "#1C1C1E",
  textSecondary: "#6C6C70",
  textTertiary: "#8E8E93",
  placeholder: "#AEAEB2",
  navBg: "#FFFFFF",
  overlay: "rgba(0,0,0,0.4)",
};

export interface AppSettings {
  theme: "dark" | "light" | "system";
  accentColor: string;
  language: string;
  notifyMessages: boolean;
  notifyFriendRequests: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  accentColor: "#7C6EFA",
  language: "ar",
  notifyMessages: true,
  notifyFriendRequests: true,
};

interface SettingsContextValue {
  settings: AppSettings;
  accent: string;
  isDark: boolean;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  accent: DEFAULT_SETTINGS.accentColor,
  isDark: true,
  updateSettings: async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const systemScheme = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((raw) => {
        if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      })
      .catch(() => {});
  }, []);

  const isDark = useMemo(() => {
    if (settings.theme === "system") return systemScheme !== "light";
    return settings.theme === "dark";
  }, [settings.theme, systemScheme]);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
  }, [settings]);

  return (
    <SettingsContext.Provider
      value={{ settings, accent: settings.accentColor, isDark, updateSettings }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}

export function useColors(): ThemeColors {
  const { isDark } = useSettings();
  return isDark ? DARK_COLORS : LIGHT_COLORS;
}

export function useT(): Translations {
  const { settings } = useSettings();
  return getTranslations(settings.language);
}
