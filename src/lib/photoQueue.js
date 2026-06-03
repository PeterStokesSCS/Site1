// Offline photo outbox. When a capture can't upload (no signal), the compressed
// blob + the intended database action are stored in IndexedDB and retried
// automatically when the device comes back online.
import { uploadFile } from "./storage";
import { addPhoto, sendMessage } from "./db";

const DB_NAME = "site1-photos";
const STORE = "outbox";
const VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run(mode, op) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const r = op(store);
    tx.oncomplete = () => resolve(r && r.result);
    tx.onerror = () => reject(tx.error);
  }));
}

// ── pub/sub so UI can show "N queued" ───────────────────────────
const listeners = new Set();
let cachedCount = 0;
export function subscribe(fn) { listeners.add(fn); fn(cachedCount); return () => listeners.delete(fn); }
async function notify() {
  cachedCount = await count();
  listeners.forEach(fn => fn(cachedCount));
}

export function count() { return run("readonly", s => s.count()); }
async function getAll() { return run("readonly", s => s.getAll()); }
async function remove(id) { await run("readwrite", s => s.delete(id)); }

// Queue a capture. `action` describes how to persist it once uploaded:
//   { type: "addPhoto", payload: {...addPhoto fields without url} }
//   { type: "chatPhoto", payload: { message: {...}, photo: {...} } }
export async function enqueue({ blob, folder, meta, action }) {
  const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, blob, folder, meta, action, created_at: Date.now() };
  await run("readwrite", s => s.add(item));
  await notify();
  return item.id;
}

// Complete one item: upload the blob, then run its database action.
async function complete(item) {
  const { url, error } = await uploadFile(item.blob, item.folder, "jpg");
  if (error || !url) throw error || new Error("upload failed");
  const m = item.meta || {};
  const gps = {
    file_name: m.file_name, file_size_kb: m.file_size_kb,
    gps_lat: m.gps_lat, gps_lng: m.gps_lng, gps_accuracy_m: m.gps_accuracy_m,
    gps_on_site: m.gps_on_site, gps_distance_from_site_m: m.gps_distance_from_site_m,
    taken_at: m.taken_at,
  };
  if (item.action.type === "addPhoto") {
    await addPhoto({ ...item.action.payload, ...gps, url });
  } else if (item.action.type === "chatPhoto") {
    const { message, photo } = item.action.payload;
    const { data: msg } = await sendMessage({ ...message, image_url: url });
    if (msg) await addPhoto({ ...photo, ...gps, url, linked_record_id: msg.id });
  }
}

let flushing = false;
// Try to upload everything queued. Safe to call repeatedly. Stops on first
// failure (likely still offline) and leaves the rest queued.
export async function flush() {
  if (flushing || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
  flushing = true;
  try {
    const items = await getAll();
    for (const item of items.sort((a, b) => a.created_at - b.created_at)) {
      try {
        await complete(item);
        await remove(item.id);
        await notify();
      } catch {
        break; // network likely down again — keep the rest for next time
      }
    }
    window.dispatchEvent(new CustomEvent("photoqueue:flushed"));
  } finally {
    flushing = false;
  }
}

// Wire automatic flushing once per app load.
let inited = false;
export function initPhotoQueue() {
  if (inited || typeof window === "undefined") return;
  inited = true;
  window.addEventListener("online", flush);
  notify();
  flush();
}
