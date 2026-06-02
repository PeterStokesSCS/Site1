const TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || "";
const BASE = `https://api.telegram.org/bot${TOKEN}`;

export async function sendMessage(chatId, text) {
  if (!TOKEN) return;
  return fetch(`${BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function sendPhoto(chatId, photoUrl, caption) {
  if (!TOKEN) return;
  return fetch(`${BASE}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption }),
  });
}

export async function getUpdates(offset) {
  if (!TOKEN) return { ok: false, result: [] };
  const res = await fetch(`${BASE}/getUpdates?offset=${offset || 0}&timeout=5`);
  return res.json();
}
