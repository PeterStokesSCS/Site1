import { supabase } from "./supabase";

const BUCKET = "attachments";
const SIGN_TTL = 60 * 60; // 1h signed URLs

// Multi-tenant storage. Objects are written under "<org_id>/<folder>/<file>" so the
// storage RLS policy (see supabase_migration_storage_private.sql) can gate access by org,
// and served via short-lived SIGNED urls instead of public ones. The value persisted in
// the DB is the PATH (not a URL); call signedUrl(path) at render time to get a viewable src.
//
// Backward compatible: legacy rows hold full public http URLs — signedUrl() passes those
// through unchanged so they keep working until the bucket is flipped private (at which
// point legacy objects must be migrated under an org prefix).

let orgCache = null; // { uid, orgId }

// The caller's org. Uploads are stamped with it so paths are org-scoped. Prefers an
// admin (builder/office) membership, mirroring the Phase 2 set_org_from_user trigger.
async function currentOrgId() {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return null;
  if (orgCache && orgCache.uid === uid) return orgCache.orgId;
  const { data } = await supabase.from("org_members").select("org_id, role").eq("user_id", uid);
  if (!data?.length) return null;
  const admin = data.find((m) => m.role === "builder" || m.role === "office");
  const orgId = (admin || data[0]).org_id;
  orgCache = { uid, orgId };
  return orgId;
}

const isHttpUrl = (s) => typeof s === "string" && /^https?:\/\//.test(s);

// Uploads a File/Blob and returns { url } where `url` is the storage PATH to persist.
// `forcedExt` is used for Blobs (e.g. compressed JPEG) with no filename. `orgId` may be
// passed when the caller already knows it (e.g. project.org_id); otherwise it's resolved.
export async function uploadFile(file, folder = "misc", forcedExt, orgId) {
  const ext = (forcedExt || (file.name ? file.name.split(".").pop() : "") || "jpg").toLowerCase();
  const org = orgId || (await currentOrgId());
  const prefix = org ? `${org}/` : ""; // never block an upload if org can't be resolved
  const path = `${prefix}${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false, contentType: file.type || "image/jpeg",
  });
  if (error) return { error };
  return { url: path }; // persist the path; resolve to a signed URL on read
}

// Resolves a stored value to a viewable URL. Legacy http URLs pass through; paths are
// signed (short TTL). Cached briefly to avoid re-signing the same path on every render.
const signCache = new Map(); // path -> { url, exp }
export async function signedUrl(value, expiresIn = SIGN_TTL) {
  if (!value) return null;
  if (isHttpUrl(value)) return value; // legacy public URL
  const hit = signCache.get(value);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(value, expiresIn);
  if (error || !data?.signedUrl) return null;
  signCache.set(value, { url: data.signedUrl, exp: Date.now() + (expiresIn - 60) * 1000 });
  return data.signedUrl;
}

// Deletes the object behind a stored value (path or legacy public URL). Best-effort.
export async function removeFile(value) {
  if (!value) return { error: null };
  let path = value;
  if (isHttpUrl(value)) {
    const marker = `/object/public/${BUCKET}/`;
    const i = value.indexOf(marker);
    if (i === -1) return { error: null };
    path = decodeURIComponent(value.slice(i + marker.length));
  }
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  signCache.delete(value);
  return { error };
}
