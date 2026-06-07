import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";

const PIN_KEY = "@nexora_pin_hash";
const BIOMETRIC_KEY = "@nexora_biometric_enabled";
const LOCK_TIMEOUT_MS = 30_000;

async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin + "nexora_salt_2026",
  );
}

async function getStoredValue(key: string): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setStoredValue(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {}
}

async function deleteStoredValue(key: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {}
}

interface AppLockContextValue {
  isLocked: boolean;
  pinEnabled: boolean;
  biometricEnabled: boolean;
  hasBiometric: boolean;
  biometricType: "fingerprint" | "face" | "iris" | null;
  lock: () => void;
  unlock: (pin: string) => Promise<boolean>;
  unlockWithBiometric: () => Promise<boolean>;
  enablePin: (pin: string) => Promise<void>;
  disablePin: () => Promise<void>;
  toggleBiometric: () => Promise<boolean>;
}

const AppLockContext = createContext<AppLockContextValue>({
  isLocked: false,
  pinEnabled: false,
  biometricEnabled: false,
  hasBiometric: false,
  biometricType: null,
  lock: () => {},
  unlock: async () => false,
  unlockWithBiometric: async () => false,
  enablePin: async () => {},
  disablePin: async () => {},
  toggleBiometric: async () => false,
});

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const [pinHash, setPinHash] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [biometricType, setBiometricType] = useState<"fingerprint" | "face" | "iris" | null>(null);

  const backgroundTimestamp = useRef<number | null>(null);

  useEffect(() => {
    async function init() {
      const [storedPin, storedBiometric] = await Promise.all([
        getStoredValue(PIN_KEY),
        getStoredValue(BIOMETRIC_KEY),
      ]);
      if (storedPin) {
        setPinHash(storedPin);
        setIsLocked(true);
      }
      if (storedBiometric === "true") setBiometricEnabled(true);

      if (Platform.OS !== "web") {
        const [compatible, enrolled, types] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          LocalAuthentication.supportedAuthenticationTypesAsync(),
        ]);
        if (compatible && enrolled) {
          setHasBiometric(true);
          if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            setBiometricType("face");
          } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
            setBiometricType("iris");
          } else {
            setBiometricType("fingerprint");
          }
        }
      }
    }
    init();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        backgroundTimestamp.current = Date.now();
      } else if (nextState === "active") {
        if (backgroundTimestamp.current !== null && pinHash) {
          const elapsed = Date.now() - backgroundTimestamp.current;
          if (elapsed >= LOCK_TIMEOUT_MS) {
            setIsLocked(true);
          }
        }
        backgroundTimestamp.current = null;
      }
    });
    return () => sub.remove();
  }, [pinHash]);

  const lock = useCallback(() => {
    if (pinHash) setIsLocked(true);
  }, [pinHash]);

  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    if (!pinHash) return true;
    const hash = await hashPin(pin);
    if (hash === pinHash) {
      setIsLocked(false);
      return true;
    }
    return false;
  }, [pinHash]);

  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") return false;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "أثبت هويتك لفتح التطبيق",
        cancelLabel: "إلغاء",
        disableDeviceFallback: false,
      });
      if (result.success) {
        setIsLocked(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const enablePin = useCallback(async (pin: string): Promise<void> => {
    const hash = await hashPin(pin);
    await setStoredValue(PIN_KEY, hash);
    setPinHash(hash);
  }, []);

  const disablePin = useCallback(async (): Promise<void> => {
    await Promise.all([
      deleteStoredValue(PIN_KEY),
      deleteStoredValue(BIOMETRIC_KEY),
    ]);
    setPinHash(null);
    setBiometricEnabled(false);
    setIsLocked(false);
  }, []);

  const toggleBiometric = useCallback(async (): Promise<boolean> => {
    if (biometricEnabled) {
      await deleteStoredValue(BIOMETRIC_KEY);
      setBiometricEnabled(false);
      return true;
    }
    if (Platform.OS === "web") return false;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "تحقق من هويتك لتفعيل الفتح البيومتري",
        cancelLabel: "إلغاء",
        disableDeviceFallback: false,
      });
      if (result.success) {
        await setStoredValue(BIOMETRIC_KEY, "true");
        setBiometricEnabled(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [biometricEnabled]);

  return (
    <AppLockContext.Provider
      value={{
        isLocked,
        pinEnabled: !!pinHash,
        biometricEnabled,
        hasBiometric,
        biometricType,
        lock,
        unlock,
        unlockWithBiometric,
        enablePin,
        disablePin,
        toggleBiometric,
      }}
    >
      {children}
    </AppLockContext.Provider>
  );
}

export function useAppLock(): AppLockContextValue {
  return useContext(AppLockContext);
}
