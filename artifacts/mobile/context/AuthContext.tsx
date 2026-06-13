/**
 * AuthContext — single source of truth for authentication in Nexora.
 *
 * Responsibilities:
 *  - Persist the session token on-device (AsyncStorage)
 *  - Restore the session on app launch by calling GET /auth/me
 *  - Expose signUp / signIn / signOut / forgotPassword / verifyEmail actions
 *  - Expose the current PublicUser so any screen can read it
 *  - Connect/disconnect the real-time WebSocket on auth state changes
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { connectWs, disconnectWs } from "@/lib/ws";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  username: string | null;
  avatarColor: string;
  avatarImageUri?: string | null;
  emailVerified: boolean;
  profileVisibility: string;
  messagingPrivacy: string;
  isDeveloper: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuthState {
  user: PublicUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  signUp: (email: string, password: string, name: string, username: string, avatarColor?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (patch: {
    name?: string;
    username?: string;
    avatarColor?: string;
    avatarImageUri?: string | null;
    profileVisibility?: string;
    messagingPrivacy?: string;
  }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export type AuthContextValue = AuthState & AuthActions;

// ─── Token storage ────────────────────────────────────────────────────────────

const TOKEN_KEY = "@nexora_session_token";

const loadToken = (): Promise<string | null> =>
  AsyncStorage.getItem(TOKEN_KEY);

const saveToken = (token: string): Promise<void> =>
  AsyncStorage.setItem(TOKEN_KEY, token);

const clearToken = (): Promise<void> =>
  AsyncStorage.removeItem(TOKEN_KEY);

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  signUp: async (_e, _p, _n, _u) => {},
  signIn: async () => {},
  signOut: async () => {},
  forgotPassword: async () => {},
  verifyEmail: async () => {},
  refreshUser: async () => {},
  updateUser: async () => {},
  changePassword: async () => {},
  deleteAccount: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback((t: string, u: PublicUser) => {
    setToken(t);
    setUser(u);
    connectWs(t);
  }, []);

  const clearSession = useCallback(() => {
    disconnectWs();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const safetyTimer = setTimeout(() => {
      if (!cancelled) setIsLoading(false);
    }, 10_000);

    async function restore() {
      try {
        const saved = await loadToken();
        if (!saved) return;

        const data = await apiFetch<{ user: PublicUser }>("/auth/me", {
          token: saved,
          signal: AbortSignal.timeout(8_000),
        });

        if (!cancelled) applySession(saved, data.user);
      } catch {
        await clearToken().catch(() => {});
      } finally {
        clearTimeout(safetyTimer);
        if (!cancelled) setIsLoading(false);
      }
    }

    restore();
    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [applySession]);

  const signUp = useCallback(
    async (email: string, password: string, name: string, username: string, avatarColor?: string) => {
      const data = await apiFetch<{ token: string; user: PublicUser }>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({ email, password, name, username, avatarColor }),
        },
      );
      await saveToken(data.token);
      applySession(data.token, data.user);
    },
    [applySession],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const data = await apiFetch<{ token: string; user: PublicUser }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
      );
      await saveToken(data.token);
      applySession(data.token, data.user);
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    if (token) {
      await apiFetch("/auth/logout", { method: "POST", token }).catch(() => {});
    }
    await clearToken().catch(() => {});
    clearSession();
  }, [token, clearSession]);

  const forgotPassword = useCallback(async (email: string) => {
    await apiFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }, []);

  const verifyEmail = useCallback(
    async (verifyToken: string) => {
      await apiFetch("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token: verifyToken }),
        token: token ?? undefined,
      });
      if (user) setUser({ ...user, emailVerified: true });
    },
    [token, user],
  );

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ user: PublicUser }>("/auth/me", { token });
      setUser(data.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await clearToken().catch(() => {});
        clearSession();
      }
    }
  }, [token, clearSession]);

  const updateUser = useCallback(
    async (patch: {
      name?: string;
      username?: string;
      avatarColor?: string;
      avatarImageUri?: string | null;
      profileVisibility?: string;
      messagingPrivacy?: string;
    }) => {
      if (!token) return;
      const data = await apiFetch<{ user: PublicUser }>("/auth/profile", {
        method: "PUT",
        body: JSON.stringify(patch),
        token,
      });
      setUser(data.user);
    },
    [token],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!token) return;
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
        token,
      });
    },
    [token],
  );

  const deleteAccount = useCallback(async () => {
    if (!token) return;
    await apiFetch("/auth/account", {
      method: "DELETE",
      token,
    });
    await clearToken().catch(() => {});
    clearSession();
  }, [token, clearSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        signUp,
        signIn,
        signOut,
        forgotPassword,
        verifyEmail,
        refreshUser,
        updateUser,
        changePassword,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
