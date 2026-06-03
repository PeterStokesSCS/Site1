import { supabase } from "./supabase";

const BUCKET = "attachments";

// Uploads a File or Blob to Supabase Storage and returns its public URL.
// `forcedExt` is used when uploading a Blob (e.g. compressed JPEG) that has no name.
export async function uploadFile(file, folder = "misc", forcedExt) {
  const ext = (forcedExt || (file.name ? file.name.split(".").pop() : "") || "jpg").toLowerCase();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
  if (error) return { error };
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

// Deletes the stored object behind a public URL. Best-effort; ignores misses.
export async function removeFile(url) {
  if (!url) return { error: null };
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return { error: null };
  const path = decodeURIComponent(url.slice(i + marker.length));
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  return { error };
}
