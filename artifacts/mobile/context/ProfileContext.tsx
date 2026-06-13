/**
 * ProfileContext — local profile data (bio, avatar) keyed per-user.
 *
 * Syncs with AuthContext: when the user changes (login/logout),
 * the correct profile is loaded or cleared. This prevents data
 * leaking between accounts.
 *
 * updateProfile also persists to the server via PUT /auth/profile.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

function profileKey(userId: string | null): string | null {
  if (!userId) return null;
  return `@nexora_profile_${userId}`;
}

export interface Profile {
  name: string;
  bio: string;
  avatarColor: string;
  avatarImageUri?: string;
}

export const DEFAULT_PROFILE: Profile = {
  name: "مستخدم Nexora",
  bio: "",
  avatarColor: "#7C6EFA",
};

interface ProfileContextValue {
  profile: Profile;
  updateProfile: (updated: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: DEFAULT_PROFILE,
  updateProfile: async () => {},
  refreshProfile: async () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    const key = profileKey(user?.id ?? null);
    if (!key) {
      setProfile(DEFAULT_PROFILE);
      return;
    }

    // Try to load bio from the server first if we have a token
    let serverBio: string | null = null;
    if (token) {
      try {
        const { user: me } = await apiFetch<{ user: { bio?: string | null } }>(
          "/auth/me",
          { token },
        );
        serverBio = me.bio ?? null;
      } catch {
        // fall back to local
      }
    }

    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Profile>;
        const resolved: Profile = {
          name: saved.name ?? user?.name ?? DEFAULT_PROFILE.name,
          bio: serverBio !== null ? serverBio : (saved.bio ?? ""),
          avatarColor: saved.avatarColor ?? user?.avatarColor ?? DEFAULT_PROFILE.avatarColor,
          ...(saved.avatarImageUri ? { avatarImageUri: saved.avatarImageUri } : {}),
        };
        setProfile(resolved);
        // Persist server bio into local cache
        if (serverBio !== null) {
          await AsyncStorage.setItem(key, JSON.stringify({ ...resolved })).catch(() => {});
        }
      } else {
        const resolved: Profile = {
          name: user?.name ?? DEFAULT_PROFILE.name,
          bio: serverBio !== null ? serverBio : "",
          avatarColor: user?.avatarColor ?? DEFAULT_PROFILE.avatarColor,
          avatarImageUri: user?.avatarImageUri ?? undefined,
        };
        setProfile(resolved);
        if (serverBio !== null) {
          await AsyncStorage.setItem(key, JSON.stringify(resolved)).catch(() => {});
        }
      }
    } catch {
      setProfile(DEFAULT_PROFILE);
    }
  }, [user, token]);

  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (currentUserId === loadedUserId) return;
    setLoadedUserId(currentUserId);
    if (!currentUserId) {
      setProfile(DEFAULT_PROFILE);
      return;
    }
    refreshProfile();
  }, [user?.id, loadedUserId, refreshProfile]);

  const updateProfile = useCallback(
    async (updated: Partial<Profile>) => {
      const key = profileKey(user?.id ?? null);
      const next = { ...profile, ...updated };
      setProfile(next);
      if (key) {
        await AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
      }

      // Persist to server
      if (token) {
        try {
          await apiFetch("/auth/profile", {
            method: "PUT",
            token,
            body: JSON.stringify({
              name: next.name,
              bio: next.bio || null,
              avatarColor: next.avatarColor,
              ...(next.avatarImageUri !== undefined
                ? { avatarImageUri: next.avatarImageUri }
                : {}),
            }),
          });
        } catch {
          // local changes already applied — server sync is best-effort
        }
      }
    },
    [user?.id, token, profile],
  );

  return (
    <ProfileContext.Provider value={{ profile, updateProfile, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}
