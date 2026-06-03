# SITE1 — Photo System Instruction

---
# ⚠️ RECONCILIATION — STATUS 2026-06-04 (READ FIRST)
_A simpler photo system is ALREADY BUILT (Step 2). This spec is the fuller,
evidence-grade target. Reconcile — don't build a parallel system._

### Already built ✅
- Table `project_photos` (NOT `photos`) with: project_id, url, caption, taken_by,
  created_at, **category, linked_record_type, linked_record_id, client_visible**.
- Reusable `PhotoAttach.jsx` (record photo block) + `PhotosScreen.jsx` (project
  gallery, lightbox, CLIENT badge) + `FileUploadButton.jsx`.
- db: getPhotos, addPhoto, updatePhotoCaption, getPhotosForRecord,
  setPhotoClientVisible, getClientPhotos.
- Wired into Issues, Tasks, Daily Log, Worker gallery, Client gallery.
- client_visible role-gated (builder/supervisor edit; others read-only).
- Storage: PUBLIC bucket `attachments`.

### This spec ADDS (not yet built) ⬜
1. GPS capture + Haversine distance-from-site + on-site flag (projects.lat/lng exist).
2. Client-side compression (≤800KB, ≤1920px) → photoUtils.js.
3. Category system (progress/safety/defect/qa/delivery/general) + gallery filters.
4. Photo metadata: file_name, file_size_kb, gps_*, taken_at.
5. Chat/Comms photo sending (inline, per-channel client_visible default).
6. Offline photo queue (base64 retry).
7. Delete photo (uploader or supervisor/builder).
8. Linked-record navigation from the lightbox.
9. Builder cross-project recent photos.
10. Per-context client_visible defaults (daily log=true, safety/issue=false, chat per channel).

### KEY DECISIONS before building
- **Table:** extend `project_photos` (recommended — one table, keeps existing
  photos) vs migrate to a new `photos` table. → extend.
- **Bucket:** keep PUBLIC `attachments` (simple, works) vs spec's PRIVATE
  `site-photos` + signed URLs (more secure, more complex). → keep public now;
  private later with app-wide RLS hardening.
- **Components:** EVOLVE existing PhotoAttach/PhotosScreen (recommended) vs build
  new PhotoCapture/PhotoGallery/AddPhotoButton (duplicates working code). → evolve.

### Recommended order on top of what exists
1. Extend `project_photos` with gps_* + file metadata + taken_at (migration).
2. photoUtils.js (compress + Haversine + GPS label).
3. Evolve PhotoAttach + PhotosScreen: compress, capture GPS, GPS status, categories + filters.
4. Per-context client_visible defaults.
5. Then: chat photos, offline queue, delete, builder cross-project, private bucket.

---

## ORIGINAL SPEC FOLLOWS (unchanged — app is branded SITE1)

---

## OVERVIEW

Build a unified photo system that works consistently across every module.
Photos are evidence. They must be timestamped, located, attributed, and permanently linked to both the record they were taken for and the project gallery.

**Two homes for every photo — simultaneously:**
1. The record it was attached to (hazard, task, daily log, issue, comms message)
2. The project gallery (Photos module — every photo ever taken on this job)

A photo taken while reporting a hazard appears under that hazard AND in the project gallery. Always both. Never only one.

---

## CORE RULES — NON-NEGOTIABLE

1. Every photo is timestamped automatically — device time, cannot be edited after save
2. Every photo records GPS coordinates at moment of capture
3. GPS is cross-referenced against project address — flag if taken more than 500m from site
4. Every photo records who took it (auth.uid() — the logged-in user)
5. Every photo records which record it was attached to (record type + record ID)
6. Every photo records which project it belongs to
7. Client visible defaults to OFF — supervisor must consciously enable
8. Photos are compressed client-side before upload (max 800KB)
9. If upload fails, store locally and retry when connection returns (offline queue)
10. Video is NOT included in this phase — photos only

---

## DATABASE — PHOTOS TABLE

Run this migration in Supabase SQL Editor first:

```sql
CREATE TABLE IF NOT EXISTS photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade not null,
  uploaded_by uuid references profiles not null,
  caption text,
  category text check (category in ('progress','safety','defect','qa','delivery','general')) default 'general',
  linked_record_type text check (linked_record_type in ('task','daily_log','hazard','issue','message','defect','qa_item','procurement','variation','general')),
  linked_record_id uuid,
  client_visible boolean default false,
  file_url text not null,
  file_name text,
  file_size_kb int,
  gps_lat numeric,
  gps_lng numeric,
  gps_accuracy_m numeric,
  gps_on_site boolean,
  gps_distance_from_site_m numeric,
  taken_at timestamptz not null default now(),
  created_at timestamptz default now()
);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos_read" ON photos FOR SELECT TO authenticated USING (
  project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('builder','office')
  )
);

CREATE POLICY "photos_insert" ON photos FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = uploaded_by
);

CREATE POLICY "photos_update" ON photos FOR UPDATE TO authenticated USING (
  auth.uid() = uploaded_by
  OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('builder','office','supervisor')
  )
);
```

---

## SUPABASE STORAGE

Create a storage bucket in Supabase Dashboard → Storage → New Bucket:

- Bucket name: `site-photos`
- Public: NO (private — access via signed URLs only)
- File size limit: 5MB
- Allowed MIME types: image/jpeg, image/png, image/webp, image/heic

Storage path structure:
```
site-photos/
  {project_id}/
    {record_type}/
      {record_id}/
        {timestamp}_{uuid}.jpg
```

Example:
```
site-photos/
  abc-123-project-id/
    hazard/
      def-456-hazard-id/
        2026-06-03T07-15-00_xyz-789.jpg
```

---

## SHARED PHOTO COMPONENT

Create: `src/components/shared/PhotoCapture.jsx`

This single component is used everywhere. It handles capture, compression, GPS, upload, and preview.

### Props:
```javascript
<PhotoCapture
  projectId={project.id}           // required
  projectLat={project.lat}         // for GPS verification
  projectLng={project.lng}         // for GPS verification
  linkedRecordType="hazard"        // task|daily_log|hazard|issue|message|defect|qa_item|procurement|variation|general
  linkedRecordId={hazard.id}       // uuid of the record
  onPhotoSaved={(photo) => {}}     // callback when saved
  defaultCategory="safety"         // pre-select category
  defaultClientVisible={false}     // default toggle state
/>
```

### Internal behaviour:

```javascript
// 1. CAPTURE
// Show two buttons: [📷 Take Photo] [📁 Upload]
// Take Photo → input type="file" accept="image/*" capture="environment"
// Upload → input type="file" accept="image/*" (no capture attribute)

// 2. COMPRESS
// Before anything else, compress the image client-side
// Target: max 800KB, max 1920px on longest side
// Use canvas.toBlob() with quality 0.75
// Show original size vs compressed size to user

// 3. GET GPS
// navigator.geolocation.getCurrentPosition()
// Store: lat, lng, accuracy
// Calculate distance from project address using Haversine formula
// gps_on_site = distance < 500 (metres)
// If GPS unavailable: store nulls, flag as "Location unavailable"
// Do NOT block photo save if GPS fails — record what you can

// 4. PREVIEW SCREEN
// Show compressed photo thumbnail
// Caption input (placeholder: "Add a note about this photo...")
// Category selector: Progress / Safety / Defect / QA / Delivery / General
// Client visible toggle (default OFF, show padlock icon)
// GPS status line:
//   ✅ On site — 15 Beatrice Street (within 50m)
//   ⚠️ 320m from site — 15 Beatrice Street
//   ❌ 2.3km from site — flagged
//   📍 Location unavailable

// 5. SAVE
// Generate file path: {project_id}/{record_type}/{record_id}/{timestamp}_{uuid}.jpg
// Upload to Supabase storage bucket: site-photos
// On success: insert row into photos table with all metadata
// taken_at = NOW() at moment of save (not moment of capture — use capture timestamp if available)

// 6. OFFLINE HANDLING
// If upload fails (no connection):
//   Store photo as base64 in localStorage queue
//   Show "Saved locally — will upload when connected"
//   OfflineBar shows pending photo count
//   On reconnect: flush queue, upload, clear local storage

// 7. SUCCESS STATE
// Show: photo thumbnail + "Saved" checkmark
// Return photo object via onPhotoSaved callback
// Clear form for next photo (allow multiple)
```

### GPS distance calculation (Haversine):
```javascript
function distanceFromSite(lat1, lng1, lat2, lng2) {
  const R = 6371000; // metres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

---

## SHARED PHOTO GALLERY COMPONENT

Create: `src/components/shared/PhotoGallery.jsx`

Used to display photos attached to any record, and in the full project gallery.

### Props:
```javascript
<PhotoGallery
  photos={[]}                    // array of photo objects from Supabase
  allowDelete={true/false}       // can user delete?
  showClientToggle={true/false}  // show client visible toggle per photo
  emptyMessage="No photos yet"
/>
```

### Display:
- Grid: 3 columns on mobile, 4 on desktop
- Each thumbnail: photo, caption (truncated), category badge, client visible indicator
- Tap thumbnail → full screen lightbox
- Full screen shows: full photo, caption, category, taken by, timestamp, GPS status, client visible toggle
- Swipe left/right to navigate between photos
- Delete button (if allowDelete = true and user is the uploader or supervisor/builder)

---

## ADD PHOTO BUTTON COMPONENT

Create: `src/components/shared/AddPhotoButton.jsx`

A consistent button used at the bottom of every record detail screen.

```javascript
// Renders as:
// [ 📷 Add Photo ]
// Tapping opens PhotoCapture with correct props pre-filled
// After save, refreshes the photo list for that record
```

---

## db.js — ADD THESE FUNCTIONS

Add to `src/lib/db.js`:

```javascript
// Get photos for a specific record
export async function getPhotosByRecord(recordType, recordId) {
  const { data, error } = await supabase
    .from('photos')
    .select('*, uploaded_by:profiles(full_name, role)')
    .eq('linked_record_type', recordType)
    .eq('linked_record_id', recordId)
    .order('taken_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Get all photos for a project (gallery)
export async function getProjectPhotos(projectId, filters = {}) {
  let query = supabase
    .from('photos')
    .select('*, uploaded_by:profiles(full_name, role)')
    .eq('project_id', projectId)
    .order('taken_at', { ascending: false });

  if (filters.category) query = query.eq('category', filters.category);
  if (filters.clientVisible) query = query.eq('client_visible', true);
  if (filters.recordType) query = query.eq('linked_record_type', filters.recordType);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Save photo metadata after upload
export async function savePhoto(photoData) {
  const { data, error } = await supabase
    .from('photos')
    .insert([photoData])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Toggle client visible
export async function togglePhotoClientVisible(photoId, visible) {
  const { error } = await supabase
    .from('photos')
    .update({ client_visible: visible })
    .eq('id', photoId);
  if (error) throw error;
}

// Delete photo (also removes from Supabase storage)
export async function deletePhoto(photoId, filePath) {
  await supabase.storage.from('site-photos').remove([filePath]);
  const { error } = await supabase.from('photos').delete().eq('id', photoId);
  if (error) throw error;
}

// Get signed URL for display (private bucket)
export async function getPhotoUrl(filePath) {
  const { data, error } = await supabase
    .storage
    .from('site-photos')
    .createSignedUrl(filePath, 3600); // 1 hour expiry
  if (error) throw error;
  return data.signedUrl;
}
```

---

## MODULE INTEGRATION — ADD PHOTOS TO EACH MODULE

### TASKS (TasksFeature.jsx)

In the Task Detail screen (Page 3):

1. Add a PHOTOS section below the description and above comments:
```
PHOTOS  [ + Add Photo ]
[thumbnail] [thumbnail] [+ add]
```

2. On load: call getPhotosByRecord('task', task.id)
3. Render PhotoGallery with retrieved photos
4. Add AddPhotoButton with:
   - linkedRecordType="task"
   - linkedRecordId={task.id}
   - defaultCategory="progress"
5. When creating a task, allow photos to be added immediately after save
   (save task first to get ID, then attach photos)

---

### DAILY LOGS (SupervisorApp.jsx — Daily Log screen)

1. Add PHOTOS section to the daily log form:
```
Site Photos Today  [ 📷 Take Photo ]  [ 📁 Upload ]
[thumbnails if any]
```

2. Place between the questions section and the submit button
3. Photos taken here use:
   - linkedRecordType="daily_log"
   - linkedRecordId={dailyLog.id}
   - defaultCategory="progress"
   - defaultClientVisible={true} ← daily log photos default to client visible
4. After submitting daily log: show summary of photos attached
5. In daily log history view: each past log shows its photo count and thumbnails

**Note:** Daily log photos default to client_visible = TRUE because progress photos are typically what clients want to see. Supervisor can toggle off individually.

---

### SAFETY — HAZARDS (SupervisorApp.jsx / WorkerApp.jsx — Safety screens)

**When reporting a new hazard:**
1. Add photo capture step to the report form:
```
Evidence Photos (recommended)
[ 📷 Take Photo of Hazard ]
```
2. Position after description, before submit
3. On mobile: auto-open camera (capture="environment") when user taps
4. Photos use:
   - linkedRecordType="hazard"
   - linkedRecordId={hazard.id}
   - defaultCategory="safety"
   - defaultClientVisible={false} ← safety photos are internal by default

**In hazard detail view:**
1. Show existing photos
2. Allow additional photos to be added (for resolution evidence)
3. When resolving a hazard: prompt "Add resolution photo?" before confirming resolve

**Why this matters:** A high-risk hazard photo taken on site with GPS confirmation and timestamp is legal evidence that you identified and documented the risk. This is exactly what WorkSafe Victoria looks for.

---

### ISSUES (IssuesFeature.jsx)

**In Issue Detail (Page 3):**
1. Add PHOTOS section below description, above comments:
```
Photos  [ + Add Photo ]
[thumbnails]
```
2. Load: getPhotosByRecord('issue', issue.id)
3. Render PhotoGallery
4. AddPhotoButton with:
   - linkedRecordType="issue"
   - linkedRecordId={issue.id}
   - defaultCategory based on issue type:
     - safety-linked issue → "safety"
     - all others → "general"
5. When escalating an issue: prompt "Add photo before escalating?"

**When raising a new issue:**
1. After filling in title/description/priority, add:
```
Add Photo Evidence (optional but recommended)
[ 📷 Take Photo ]
```
2. Save issue first, then attach photo using returned issue.id

---

### COMMS / CHAT (SupervisorApp.jsx — Chat screen)

Photo sharing in chat is different from other modules — photos sent in chat should feel conversational, not form-based.

**In each channel (Team / Trades / Client):**
1. Next to the message input, add a camera icon button:
```
[message input field]  [📷]  [→ Send]
```

2. Tapping 📷:
   - Opens camera or file picker
   - NO preview screen with form fields (keep it fast for chat)
   - Only captures: caption (optional, one-liner), client_visible (auto: true for Client channel, false for Team/Trades)
   - Uploads immediately
   - Appears in chat as an image message with thumbnail
   - Also saved to photos table with:
     - linkedRecordType="message"
     - linkedRecordId={message.id}
     - category="general"

3. In the chat thread, photo messages render as:
   - Full-width thumbnail
   - Caption below (if any)
   - Sender name + timestamp
   - Tap → full screen view

**Channel-specific client_visible defaults:**
- Team channel: client_visible = false
- Trades channel: client_visible = false
- Client channel: client_visible = true (it's going to the client anyway)

---

## PROJECT PHOTOS GALLERY (full module)

Update the Photos tile in the Project Dashboard to use real data.

**Location:** Currently a placeholder in SupervisorApp.jsx

**Replace with a full gallery screen:**

```
Photos — 15 Beatrice Street

[ ALL ] [ PROGRESS ] [ SAFETY ] [ DEFECT ] [ QA ] [ DELIVERY ]
[ Client Visible Only toggle ]

[grid of thumbnails, newest first]

[Floating 📷 button — add photo to project general]
```

1. On load: call getProjectPhotos(project.id)
2. Apply category filter from tab selection
3. Client Visible toggle: filters to client_visible = true only
4. Floating + button: opens PhotoCapture with:
   - linkedRecordType="general"
   - linkedRecordId=null
   - No pre-selected category
5. Tap any photo → full screen lightbox with:
   - Full resolution photo
   - Caption (editable by uploader or supervisor)
   - Category badge
   - Taken by + timestamp
   - GPS status (on site / distance from site)
   - Linked record (e.g. "Attached to Hazard #H-014") → tappable → opens that record
   - Client visible toggle
   - Delete button (uploader or supervisor/builder only)

---

## CLIENT PORTAL — PHOTOS

In ClientApp.jsx Photos tile:

1. Load: getProjectPhotos(projectId, { clientVisible: true })
2. Display grid, newest first
3. No upload, no delete, no toggle — read only
4. Full screen on tap: photo, caption, date, category
5. Do NOT show: who took it, GPS data, linked record, internal metadata

---

## BUILDER VIEW — CROSS-PROJECT PHOTOS

In BuilderApp.jsx, add a Photos section under each project in the Project Dashboard:

- Recent photos (last 5) shown as thumbnails
- Link to full project gallery
- Filter: Client Visible / All / By Category
- Useful for Pete to quickly check what's been documented on each site

---

## PHOTO COMPRESSION UTILITY

Create: `src/lib/photoUtils.js`

```javascript
// Compress image before upload
export async function compressImage(file, maxSizeKB = 800, maxDimension = 1920) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      let { width, height } = img;

      // Scale down if too large
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Try quality 0.75 first, reduce if still too large
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob.size / 1024 > maxSizeKB) {
          canvas.toBlob((blob2) => resolve(blob2), 'image/jpeg', 0.5);
        } else {
          resolve(blob);
        }
      }, 'image/jpeg', 0.75);
    };

    img.src = url;
  });
}

// Generate storage file path
export function generatePhotoPath(projectId, recordType, recordId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const uuid = crypto.randomUUID().split('-')[0];
  const folder = recordId || 'general';
  return `${projectId}/${recordType}/${folder}/${timestamp}_${uuid}.jpg`;
}

// Calculate GPS distance from site (Haversine)
export function distanceFromSiteMetres(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GPS status label and colour
export function gpsStatusLabel(distanceMetres, projectAddress) {
  if (distanceMetres === null) return { label: '📍 Location unavailable', colour: '#888' };
  if (distanceMetres < 100) return { label: `✅ On site — ${projectAddress}`, colour: '#4a9d7f' };
  if (distanceMetres < 500) return { label: `⚠️ ${Math.round(distanceMetres)}m from site`, colour: '#e0a839' };
  return { label: `❌ ${(distanceMetres/1000).toFixed(1)}km from site — flagged`, colour: '#c0392b' };
}
```

---

## OFFLINE PHOTO QUEUE

Extend `useOfflineQueue.js` to handle photos:

```javascript
// When upload fails, store in localStorage:
const pendingPhoto = {
  id: crypto.randomUUID(),
  fileBase64: await blobToBase64(compressedBlob),
  metadata: { project_id, linked_record_type, linked_record_id, caption, category, client_visible, gps_lat, gps_lng, taken_at },
  filePath,
  retryCount: 0
};

// On reconnect, for each pending photo:
// 1. Convert base64 back to blob
// 2. Upload to Supabase storage
// 3. Save metadata to photos table
// 4. Remove from localStorage queue
// 5. Update UI
```

---

## TESTING CHECKLIST

Test each of the following before marking this feature complete:

- [ ] Take a photo while reporting a hazard → appears under that hazard AND in project gallery
- [ ] Take a photo in daily log → appears in daily log AND gallery, client_visible = true by default
- [ ] Take a photo in an issue → appears under issue AND in gallery, client_visible = false
- [ ] Send a photo in Team chat → appears in chat thread AND gallery, not client visible
- [ ] Send a photo in Client chat → appears in chat AND gallery, client_visible = true
- [ ] Toggle client_visible on a photo → immediately reflects in client portal (or not)
- [ ] Take a photo on site → GPS shows "On site — [address]" in green
- [ ] Take a photo away from site → GPS shows distance and flags it
- [ ] Take photo with no GPS/data → saves successfully with "Location unavailable"
- [ ] Take photo with no internet → stores locally, shows "Saved locally" message
- [ ] Reconnect after offline photo → auto-uploads, appears in gallery
- [ ] Client portal shows only client_visible = true photos
- [ ] Client portal does NOT show uploader name, GPS data, or linked record
- [ ] Photo gallery category filters work correctly
- [ ] Full screen lightbox: tap linked record → navigates to that record
- [ ] Delete photo: removes from gallery AND Supabase storage
- [ ] File size: compressed photo is under 800KB before upload
- [ ] Test on real iPhone — camera opens correctly, HEIC converts to JPEG

---

## OPENING INSTRUCTION FOR CLAUDE CODE

> "Read SCS_BuildHub_CurrentState.md and SCS_BuildHub_PhotoSystem.md.
> Build the unified photo system described in the photo system document.
> Start with Step 1: run the photos table SQL migration in Supabase.
> Step 2: create the Supabase storage bucket site-photos.
> Step 3: create src/lib/photoUtils.js.
> Step 4: create src/components/shared/PhotoCapture.jsx.
> Step 5: create src/components/shared/PhotoGallery.jsx.
> Step 6: add the db.js photo functions.
> Step 7: integrate into Hazards (Safety module) first — test end to end on iPhone before moving to other modules.
> Step 8: integrate into Tasks, Daily Logs, Issues, Comms in that order.
> Step 9: update the Photos tile in the Project Dashboard to use real data with filters.
> Do not move to the next step until the current one is tested and working."
