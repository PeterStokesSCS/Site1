const WEBHOOK_BASE = import.meta.env.VITE_WEBHOOK_BASE || "";
const QUEUE_KEY = "bsp_offline_queue";

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function enqueue(path, payload) {
  const q = getQueue();
  q.push({ path, payload, timestamp: Date.now() });
  saveQueue(q);
}

export async function flushQueue() {
  const q = getQueue();
  if (!q.length) return;
  const remaining = [];
  for (const item of q) {
    try {
      await post(item.path, item.payload, false);
    } catch {
      remaining.push(item);
    }
  }
  saveQueue(remaining);
  return remaining.length;
}

export async function post(path, payload, offline = true) {
  if (!WEBHOOK_BASE) {
    console.info("[webhook] WEBHOOK_BASE not configured — skipping event:", path);
    return;
  }
  try {
    // text/plain is a CORS-safelisted content type, so the browser sends the POST
    // directly without a preflight (these are fire-and-forget; we never read the
    // response). The body is still JSON — n8n/webhook receivers parse it the same.
    const res = await fetch(`${WEBHOOK_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (err) {
    if (offline) {
      enqueue(path, payload);
    }
    throw err;
  }
}

export function queueLength() {
  return getQueue().length;
}
