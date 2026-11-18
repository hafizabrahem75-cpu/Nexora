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
const PIN_FAILURES_KEY = "@nexora_pin_failures";
const BIOMETRIC_KEY = "@nexora_biometric_enabled";
const LOCK_TIMEOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 15 * 60_000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}`,
  );
}

async function verifyPin(pin: string, stored: string): Promise<{ valid: boolean; upgraded?: string }> {
  if (stored.startsWith("v2:")) {
    const [, salt, digest] = stored.split(":");
    if (!salt || !digest) return { valid: false };
    return { valid: (await hashPin(pin, salt)) === digest };
  }

  // One-time migration from the old fixed-salt format.
  const legacyDigest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin + "nexora_salt_2026",
  );
  if (legacyDigest !== stored) return { valid: false };
  const salt = toHex(await Crypto.getRandomBytesAsync(16));
  return { valid: true, upgraded: `v2:${salt}:${await hashPin(pin, salt)}` };
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
  if (Platform.OS === "web") throw new Error("قفل التطبيق غير مدعوم على الويب");
  await SecureStore.setItemAsync(key, value);
}

async function deleteStoredValue(key: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {}
}

type PinFailureState = { count: number; lockUntil: number };

async function readPinFailures(): Promise<PinFailureState> {
  const raw = await getStoredValue(PIN_FAILURES_KEY);
  if (!raw) return { count: 0, lockUntil: 0 };
  try {
    const parsed = JSON.parse(raw) as Partial<PinFailureState>;
    return {
      count: Number.isSafeInteger(parsed.count) && (parsed.count ?? 0) >= 0 ? parsed.count! : 0,
      lockUntil: Number.isFinite(parsed.lockUntil) ? parsed.lockUntil! : 0,
    };
  } catch {
    return { count: 0, lockUntil: 0 };
  }
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
  disablePin: () => Promise<boolean>;
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
  disablePin: async () => false,
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
    let mounted = true;
    async function init() {
      const [storedPin, storedBiometric] = await Promise.all([
        getStoredValue(PIN_KEY),
        getStoredValue(BIOMETRIC_KEY),
      ]);
      if (!mounted) return;
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
        if (!mounted) return;
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
    void init();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        backgroundTimestamp.current = Date.now();
      } else if (nextState === "active") {
        if (backgroundTimestamp.current !== null && pinHash) {
          if (Date.now() - backgroundTimestamp.current >= LOCK_TIMEOUT_MS) setIsLocked(true);
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
    const failures = await readPinFailures();
    if (failures.lockUntil > Date.now()) return false;

    const result = await verifyPin(pin, pinHash);
    if (result.valid) {
      if (result.upgraded) {
        await setStoredValue(PIN_KEY, result.upgraded);
        setPinHash(result.upgraded);
      }
      await deleteStoredValue(PIN_FAILURES_KEY);
      setIsLocked(false);
      return true;
    }

    const count = failures.count + 1;
    const delay = count >= 5
      ? Math.min(30_000 * (2 ** (count - 5)), MAX_LOCKOUT_MS)
      : 0;
    await setStoredValue(PIN_FAILURES_KEY, JSON.stringify({
      count,
      lockUntil: delay ? Date.now() + delay : 0,
    }));
    return false;
  }, [pinHash]);

  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web" || !biometricEnabled) return false;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "أثبت هويتك لفتح التطبيق",
        cancelLabel: "إلغاء",
        disableDeviceFallback: false,
      });
      if (result.success) {
        await deleteStoredValue(PIN_FAILURES_KEY);
        setIsLocked(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [biometricEnabled]);

  const enablePin = useCallback(async (pin: string): Promise<void> => {
    if (!/^\d{6}$/.test(pin)) throw new Error("رمز PIN يجب أن يتكون من 6 أرقام");
    const salt = toHex(await Crypto.getRandomBytesAsync(16));
    const stored = `v2:${salt}:${await hashPin(pin, salt)}`;
    await setStoredValue(PIN_KEY, stored);
    await deleteStoredValue(PIN_FAILURES_KEY);
    setPinHash(stored);
  }, []);

  const disablePin = useCallback(async (): Promise<boolean> => {
    if (!pinHash || Platform.OS === "web") return false;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "تحقق من هويتك لإيقاف قفل Nexora",
        cancelLabel: "إلغاء",
        disableDeviceFallback: false,
      });
      if (!result.success) return false;
      await Promise.all([
        deleteStoredValue(PIN_KEY),
        deleteStoredValue(PIN_FAILURES_KEY),
        deleteStoredValue(BIOMETRIC_KEY),
      ]);
      setPinHash(null);
      setBiometricEnabled(false);
      setIsLocked(false);
      return true;
    } catch {
      return false;
    }
  }, [pinHash]);

  const toggleBiometric = useCallback(async (): Promise<boolean> => {
    if (biometricEnabled) {
      await deleteStoredValue(BIOMETRIC_KEY);
      setBiometricEnabled(false);
      return true;
    }
    if (Platform.OS === "web" || !hasBiometric) return false;
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
  }, [biometricEnabled, hasBiometric]);

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
