import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { apiFetch } from "@/lib/api";
import { addWsListener } from "@/lib/ws";

export interface AppNotification {
  id: string;
  userId: string;
  type: "new_message" | "friend_request" | "friend_accepted" | "announcement" | "post_liked" | "post_commented" | "new_follower";
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: (token: string) => Promise<void>;
  markRead: (token: string, ids: string[] | "all") => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  fetchNotifications: async () => {},
  markRead: async () => {},
});

export function NotificationsProvider({
  children,
  token,
}: {
  children: React.ReactNode;
  token: string | null;
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const fetchUnreadCount = useCallback(async (tkn: string) => {
    try {
      const data = await apiFetch<{ count: number }>(
        "/notifications/unread-count",
        { token: tkn },
      );
      setUnreadCount(data.count);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchNotifications = useCallback(async (tkn: string) => {
    setLoading(true);
    try {
      const [listData] = await Promise.all([
        apiFetch<{ notifications: AppNotification[] }>("/notifications", { token: tkn }),
        fetchUnreadCount(tkn),
      ]);
      setNotifications(listData.notifications);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [fetchUnreadCount]);

  const markRead = useCallback(
    async (tkn: string, ids: string[] | "all") => {
      try {
        const body = ids === "all" ? { all: true } : { ids };
        await apiFetch("/notifications/mark-read", {
          method: "POST",
          body: JSON.stringify(body),
          token: tkn,
        });
        setNotifications((prev) =>
          prev.map((n) => {
            if (ids === "all") return { ...n, read: true };
            if (Array.isArray(ids) && ids.includes(n.id)) return { ...n, read: true };
            return n;
          }),
        );
        if (ids === "all") {
          setUnreadCount(0);
        } else {
          setUnreadCount((prev) => Math.max(0, prev - (ids as string[]).length));
        }
      } catch {
        /* ignore */
      }
    },
    [],
  );

  // initial fetch when token becomes available
  useEffect(() => {
    if (token) {
      fetchNotifications(token);
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [token, fetchNotifications]);

  // real-time: prepend new notifications from WS and refresh unread count
  useEffect(() => {
    const remove = addWsListener((event) => {
      if (event.type === "notification") {
        const notif = event.payload as AppNotification;
        setNotifications((prev) => {
          if (prev.find((n) => n.id === notif.id)) return prev;
          return [notif, ...prev];
        });
        // Increment unread count directly — avoids a network round-trip and is
        // accurate since new WS notifications always arrive as unread.
        setUnreadCount((prev) => prev + 1);
      }
    });
    return remove;
  }, []);

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, loading, fetchNotifications, markRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}
