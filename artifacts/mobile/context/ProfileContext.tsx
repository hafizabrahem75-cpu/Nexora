/**
 * ProfileContext — local profile data (bio, avatar) keyed per-user.
 *
 * Syncs with AuthContext: when the user changes (login/logout),
 * the correct profile is loaded or cleared. This prevents data
 * leaking between accounts.
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
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    const key = profileKey(user?.id ?? null);
    if (!key) {
      setProfile(DEFAULT_PROFILE);
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Profile>;
        setProfile({
          name: saved.name ?? user?.name ?? DEFAULT_PROFILE.name,
          bio: saved.bio ?? "",
          avatarColor: saved.avatarColor ?? user?.avatarColor ?? DEFAULT_PROFILE.avatarColor,
          ...(saved.avatarImageUri ? { avatarImageUri: saved.avatarImageUri } : {}),
        });
      } else {
        setProfile({
          name: user?.name ?? DEFAULT_PROFILE.name,
          bio: "",
          avatarColor: user?.avatarColor ?? DEFAULT_PROFILE.avatarColor,
          avatarImageUri: user?.avatarImageUri ?? undefined,
        });
      }
    } catch {
      setProfile(DEFAULT_PROFILE);
    }
  }, [user]);

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
    },
    [user?.id, profile],
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
