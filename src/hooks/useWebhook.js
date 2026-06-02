import { useCallback, useState } from "react";
import { post } from "../lib/webhook";

export function useWebhook() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fire = useCallback(async (path, payload) => {
    setLoading(true);
    setError(null);
    try {
      await post(path, payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { fire, loading, error };
}
