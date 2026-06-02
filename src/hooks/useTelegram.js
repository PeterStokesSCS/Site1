import { useState, useEffect, useRef, useCallback } from "react";
import { getUpdates, sendMessage } from "../lib/telegram";

const POLL_INTERVAL = parseInt(import.meta.env.VITE_TELEGRAM_POLL_INTERVAL || "3000");

export function useTelegramChat(chatId) {
  const [messages, setMessages] = useState([]);
  const offsetRef = useRef(0);

  const poll = useCallback(async () => {
    if (!chatId) return;
    try {
      const data = await getUpdates(offsetRef.current);
      if (data.ok && data.result.length) {
        const filtered = data.result
          .filter((u) => u.message?.chat?.id?.toString() === chatId?.toString())
          .map((u) => ({
            id: u.update_id,
            sender: u.message.from?.first_name || "Unknown",
            text: u.message.text || "",
            timestamp: new Date(u.message.date * 1000).toISOString(),
          }));
        if (filtered.length) {
          setMessages((prev) => [...prev, ...filtered]);
        }
        offsetRef.current = data.result[data.result.length - 1].update_id + 1;
      }
    } catch {}
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [chatId, poll]);

  const send = useCallback(
    async (text) => {
      if (!chatId) return;
      await sendMessage(chatId, text);
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), sender: "Me", text, timestamp: new Date().toISOString(), outgoing: true },
      ]);
    },
    [chatId]
  );

  return { messages, send };
}
