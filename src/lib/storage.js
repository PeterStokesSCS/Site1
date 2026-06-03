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
