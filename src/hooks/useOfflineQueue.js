import { useState, useEffect, useCallback } from "react";
import { queueLength, flushQueue } from "../lib/webhook";

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(queueLength());

  const sync = useCallback(async () => {
    const remaining = await flushQueue();
    setPending(remaining ?? 0);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      sync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [sync]);

  const refreshPending = useCallback(() => {
    setPending(queueLength());
  }, []);

  return { isOnline, pending, sync, refreshPending };
}
