"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AppNotification } from "@/lib/db/notifications";

interface NotificationCounts {
  activities: number;
  timeline: number;
  calendar: number;
  total: number;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  counts: NotificationCounts;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  counts: { activities: 0, timeline: 0, calendar: 0, total: 0 },
  loading: false,
  refresh: async () => {},
  markRead: async () => {},
  markAllRead: async () => {},
});

const POLL_INTERVAL = 30_000; // 30 seconds

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch {
      // Ignore network errors silently
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchNotifications();
    setLoading(false);
  }, [fetchNotifications]);

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchNotifications, refresh]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    } catch {
      // Silently fail — optimistic update stays
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch("/api/notifications", { method: "PATCH" });
    } catch {
      // Silently fail — optimistic update stays
    }
  }, []);

  const counts = useMemo<NotificationCounts>(() => {
    let activities = 0;
    let timeline = 0;
    let calendar = 0;
    for (const n of notifications) {
      if (n.read) continue;
      if (n.type === "activity_assigned") activities++;
      if (n.type === "project_assigned") timeline++;
      if (n.type === "calendar_assigned") calendar++;
    }
    return { activities, timeline, calendar, total: activities + timeline + calendar };
  }, [notifications]);

  return (
    <NotificationContext.Provider
      value={{ notifications, counts, loading, refresh, markRead, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
