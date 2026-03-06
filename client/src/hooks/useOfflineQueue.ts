import { useEffect, useState } from "react";

export type QueuedScan = {
  id: string;
  timestamp: number;
  imageDataUrl: string; // base64 data URL stored locally
  company?: string;
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  linkedin?: string;
  location?: string;
  notes?: string;
  eventTag: string;
};

const QUEUE_KEY = "lektra-offline-scan-queue";

function loadQueue(): QueuedScan[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedScan[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueuedScan[]>(loadQueue);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const enqueue = (scan: Omit<QueuedScan, "id" | "timestamp">) => {
    const item: QueuedScan = {
      ...scan,
      id: `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
    };
    setQueue((prev) => {
      const next = [...prev, item];
      saveQueue(next);
      return next;
    });
    return item.id;
  };

  const remove = (id: string) => {
    setQueue((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveQueue(next);
      return next;
    });
  };

  const clear = () => {
    setQueue([]);
    saveQueue([]);
  };

  return { queue, isOnline, enqueue, remove, clear };
}
