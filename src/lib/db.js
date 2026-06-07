import { supabase } from "./supabase";

// ── Projects ───────────────────────────────────────────────────────────────────
export async function getProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function getProjectsByUser(userId) {
  const { data, error } = await supabase
    .from("project_members")
    .select("project_id, projects(*)")
    .eq("user_id", userId);
  const projects = (data || []).map(r => r.projects).filter(Boolean);
  return { data: projects, error };
}

export async function createProject(payload) {
  const { data, error } = await supabase
    .from("projects")
    .insert(payload)
    .select()
    .single();
  return { data, error };
}

export async function updateProject(id, payload) {
  const { data, error } = await supabase
    .from("projects")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  return { data, error };
}

// ── Tasks ──────────────────────────────────────────────────────────────────────
export async function getTasksByProject(projectId) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, assignee:profiles(id, full_name)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function getMyTasksToday(workerId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("tasks")
    .select("*, projects(street, job_number)")
    .eq("assignee_id", workerId)
    .eq("due_date", today)
    .neq("status", "completed");
  return { data: data || [], error };
}

// All open tasks assigned to a user across every project they can see (RLS scopes
// to member projects). Powers the supervisor's personal cross-project dashboard.
export async function getMyTasks(userId) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, projects(street, job_number)")
    .eq("assignee_id", userId)
    .neq("status", "completed")
    .order("due_date", { ascending: true });
  return { data: data || [], error };
}

// A user's own recent timesheets (newest first), for the personal dashboard.
export async function getMyTimesheets(userId, limit = 30) {
  const { data, error } = await supabase
    .from("timesheets")
    .select("*, project:projects(street, job_number)")
    .eq("worker_id", userId)
    .order("clock_in", { ascending: false })
    .limit(limit);
  return { data: data || [], error };
}

export async function updateTaskStatus(id, status) {
  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", id);
  return { error };
}

export async function createTask(payload) {
  const { data, error } = await supabase
    .from("tasks")
    .insert(payload)
    .select()
    .single();
  return { data, error };
}

// ── Hazards ────────────────────────────────────────────────────────────────────
export async function getHazardsByProject(projectId) {
  const { data, error } = await supabase
    .from("hazards")
    .select("*, reported_by:profiles(full_name)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function createHazard(payload) {
  const { data, error } = await supabase
    .from("hazards")
    .insert(payload)
    .select()
    .single();
  return { data, error };
}

export async function resolveHazard(id) {
  const { error } = await supabase
    .from("hazards")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id);
  return { error };
}

// ── Timesheets / Clock ─────────────────────────────────────────────────────────
export async function clockIn(workerId, projectId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("timesheets")
    .insert({
      worker_id: workerId,
      project_id: projectId,
      work_date: today,
      clock_in: new Date().toISOString(),
      status: "pending",
    })
    .select()
    .single();
  return { data, error };
}

export async function clockOut(workerId) {
  const clockOutTime = new Date().toISOString();

  // Find the worker's latest OPEN shift (no clock_out) — date-agnostic so a
  // pre-10am (UTC-yesterday) clock-in still closes correctly.
  const { data: existing } = await supabase
    .from("timesheets")
    .select("*")
    .eq("worker_id", workerId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) return { error: new Error("No active clock-in found") };

  const hours = (new Date(clockOutTime) - new Date(existing.clock_in)) / 3600000;

  const { data, error } = await supabase
    .from("timesheets")
    .update({
      clock_out: clockOutTime,
      hours_worked: Math.round(hours * 100) / 100,
    })
    .eq("id", existing.id)
    .select()
    .single();

  return { data, error };
}

// "Are you currently on site" = do you have an open shift (clock_out is null).
export async function getTodayClockIn(workerId) {
  const { data } = await supabase
    .from("timesheets")
    .select("*")
    .eq("worker_id", workerId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getAllTimesheets() {
  // Disambiguate the worker embed — timesheets has two FKs to profiles
  // (worker_id + approved_by).
  const { data, error } = await supabase
    .from("timesheets")
    .select("*, worker:profiles!timesheets_worker_id_fkey(full_name), project:projects(street, job_number)")
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function approveTimesheet(id, approverId) {
  const { error } = await supabase
    .from("timesheets")
    .update({ status: "approved", approved_by: approverId })
    .eq("id", id);
  return { error };
}

// Everyone who was on site on a given LOCAL day (dateStr = YYYY-MM-DD) for a project —
// workers (timesheets) + visitors/subs (site_visits), with durations. Captures anyone
// whose shift started that day, whether they've left or are still on site.
export async function getAttendanceForDay(projectId, dateStr) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  const [ts, sv, pr] = await Promise.all([
    supabase.from("timesheets").select("*").eq("project_id", projectId).gte("clock_in", start.toISOString()).lt("clock_in", end.toISOString()),
    supabase.from("site_visits").select("*").eq("project_id", projectId).gte("sign_in", start.toISOString()).lt("sign_in", end.toISOString()),
    supabase.from("profiles").select("id, full_name, role"),
  ]);
  const pmap = Object.fromEntries((pr.data || []).map(p => [p.id, p]));
  const hrs = (inIso, outIso) => outIso ? Math.round(((new Date(outIso) - new Date(inIso)) / 3600000) * 10) / 10 : null;
  const workers = (ts.data || []).map(t => ({
    id: t.id, kind: "worker", name: pmap[t.worker_id]?.full_name || "Worker", role: pmap[t.worker_id]?.role || "worker",
    inIso: t.clock_in, outIso: t.clock_out, hours: t.hours_worked ?? hrs(t.clock_in, t.clock_out),
  }));
  const visits = (sv.data || []).map(v => ({
    id: v.id, kind: "visit", name: v.visitor_name, role: v.type || "visitor",
    inIso: v.sign_in, outIso: v.sign_out, hours: hrs(v.sign_in, v.sign_out),
  }));
  return { data: [...workers, ...visits].sort((a, b) => (a.inIso || "").localeCompare(b.inIso || "")) };
}

// ── Daily Logs ─────────────────────────────────────────────────────────────────
export async function getDailyLogs(projectId) {
  const { data, error } = await supabase
    .from("daily_logs")
    .select("*, submitted_by:profiles(full_name)")
    .eq("project_id", projectId)
    .order("log_date", { ascending: false })
    .limit(90);
  return { data: data || [], error };
}

export async function createDailyLog(payload) {
  const { data, error } = await supabase
    .from("daily_logs")
    .insert(payload)
    .select()
    .single();
  return { data, error };
}

// ── Issues ─────────────────────────────────────────────────────────────────────
export async function getIssues(projectId) {
  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function createIssue(payload) {
  const { data, error } = await supabase
    .from("issues")
    .insert(payload)
    .select()
    .single();
  return { data, error };
}

// ── Variations ─────────────────────────────────────────────────────────────────
export async function getVariations(projectId) {
  const { data, error } = await supabase
    .from("variations")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function createVariation(payload) {
  const { data, error } = await supabase
    .from("variations")
    .insert(payload)
    .select()
    .single();
  return { data, error };
}

export async function getAllVariations() {
  const { data, error } = await supabase
    .from("variations")
    .select("*, project:projects(job_number, street)")
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function updateVariationStatus(id, status, approverId) {
  const patch = { status };
  if (approverId) patch.approved_by = approverId;
  const { error } = await supabase.from("variations").update(patch).eq("id", id);
  return { error };
}

// Generic variation update (used for issuing to client + capturing digital sign-off).
export async function updateVariation(id, patch) {
  const { data, error } = await supabase.from("variations").update(patch).eq("id", id).select().single();
  return { data, error };
}

export async function deleteVariation(id) {
  const { error } = await supabase.from("variations").delete().eq("id", id);
  return { error };
}

// ── Messages ───────────────────────────────────────────────────────────────────
export async function getMessages(projectId, channel) {
  const query = supabase
    .from("messages")
    .select("*, sender:profiles(full_name, role)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (channel) query.eq("channel", channel);
  const { data, error } = await query;
  return { data: data || [], error };
}

export async function sendMessage(payload) {
  const { data, error } = await supabase
    .from("messages")
    .insert(payload)
    .select()
    .single();
  return { data, error };
}

// ── Documents ──────────────────────────────────────────────────────────────────
export async function getDocuments(projectId) {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function getAllDocuments() {
  const { data, error } = await supabase
    .from("documents")
    .select("*, project:projects(job_number, street)")
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function createDocument(payload) {
  const { data, error } = await supabase
    .from("documents")
    .insert(payload)
    .select()
    .single();
  return { data, error };
}

export async function setDocumentSuperseded(id, superseded) {
  const { error } = await supabase.from("documents").update({ superseded }).eq("id", id);
  return { error };
}

// ── Commercial items (contracts, POs, quotes, invoices, receipts) ──────────────
export async function getCommercialItems(projectId) {
  const { data, error } = await supabase
    .from("commercial_items")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

// All commercial items across projects (RLS-scoped). Powers the Team → Suppliers
// directory, which is derived from vendor names (suppliers aren't user profiles).
export async function getAllCommercialItems() {
  const { data, error } = await supabase
    .from("commercial_items")
    .select("*")
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function createCommercialItem(payload) {
  const { data, error } = await supabase
    .from("commercial_items")
    .insert(payload)
    .select()
    .single();
  return { data, error };
}

export async function updateCommercialStatus(id, status) {
  const { error } = await supabase.from("commercial_items").update({ status }).eq("id", id);
  return { error };
}

// ── Project photos ─────────────────────────────────────────────────────────────
export async function getPhotos(projectId) {
  const { data, error } = await supabase
    .from("project_photos")
    .select("*, taken_by:profiles(id, full_name)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function addPhoto(payload) {
  const { data, error } = await supabase
    .from("project_photos")
    .insert(payload)
    .select("*, taken_by:profiles(id, full_name)")
    .single();
  return { data, error };
}

export async function updatePhotoCaption(id, caption) {
  const { error } = await supabase.from("project_photos").update({ caption }).eq("id", id);
  return { error };
}

// Photos attached to a specific record (issue, task, hazard, daily log, etc.)
export async function getPhotosForRecord(recordType, recordId) {
  const { data, error } = await supabase
    .from("project_photos")
    .select("*, taken_by:profiles(id, full_name)")
    .eq("linked_record_type", recordType)
    .eq("linked_record_id", recordId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function deletePhoto(id) {
  const { error } = await supabase.from("project_photos").delete().eq("id", id);
  return { error };
}

export async function updatePhotoCategory(id, category) {
  const { error } = await supabase.from("project_photos").update({ category }).eq("id", id);
  return { error };
}

export async function setPhotoClientVisible(id, value) {
  const { error } = await supabase.from("project_photos").update({ client_visible: value }).eq("id", id);
  return { error };
}

// Client-facing gallery — only photos explicitly marked visible to the client
export async function getClientPhotos(projectId) {
  const { data, error } = await supabase
    .from("project_photos")
    .select("*")
    .eq("project_id", projectId)
    .eq("client_visible", true)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

// ── Milestones ─────────────────────────────────────────────────────────────────
export async function getMilestones(projectId) {
  const { data, error } = await supabase
    .from("milestones")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  return { data: data || [], error };
}

// Seed the VIC stage skeleton for a new project (no-op if any milestones already exist).
export async function seedProjectMilestones(projectId, skeleton) {
  const { data: existing } = await supabase.from("milestones").select("id").eq("project_id", projectId).limit(1);
  if (existing && existing.length) return { data: null, skipped: true };
  const rows = skeleton.map(m => ({ project_id: projectId, key: m.key, name: m.label, sort_order: m.sequence }));
  const { data, error } = await supabase.from("milestones").insert(rows).select();
  return { data, error };
}

export async function createMilestone(payload) {
  const { data, error } = await supabase.from("milestones").insert(payload).select().single();
  return { data, error };
}

export async function updateMilestone(id, patch) {
  const { data, error } = await supabase.from("milestones").update(patch).eq("id", id).select().single();
  return { data, error };
}

export async function deleteMilestone(id) {
  const { error } = await supabase.from("milestones").delete().eq("id", id);
  return { error };
}

// Audit a confirmed forecast change (for EOT substantiation).
export async function recordForecastChange(payload) {
  const { data, error } = await supabase.from("forecast_changes").insert(payload).select().single();
  return { data, error };
}

// ── Defects (snagging / punch list) ─────────────────────────────────────────────
export async function getDefects(projectId) {
  const { data, error } = await supabase
    .from("defects")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function createDefect(payload) {
  const { data, error } = await supabase.from("defects").insert(payload).select().single();
  return { data, error };
}

export async function updateDefect(id, patch) {
  const { data, error } = await supabase.from("defects").update(patch).eq("id", id).select().single();
  return { data, error };
}

export async function deleteDefect(id) {
  const { error } = await supabase.from("defects").delete().eq("id", id);
  return { error };
}

// ── Inspections / QA ────────────────────────────────────────────────────────────
export async function getQaItems(projectId) {
  const { data, error } = await supabase
    .from("qa_items")
    .select("*")
    .eq("project_id", projectId)
    .order("due_date", { ascending: true, nullsFirst: false });
  return { data: data || [], error };
}

export async function createQaItem(payload) {
  const { data, error } = await supabase.from("qa_items").insert(payload).select().single();
  return { data, error };
}

export async function updateQaItem(id, patch) {
  const { data, error } = await supabase.from("qa_items").update(patch).eq("id", id).select().single();
  return { data, error };
}

export async function deleteQaItem(id) {
  const { error } = await supabase.from("qa_items").delete().eq("id", id);
  return { error };
}

// ── Procurement (materials / ordering / delivery tracking) ──────────────────────
export async function getProcurementItems(projectId) {
  const { data, error } = await supabase
    .from("procurement_items")
    .select("*")
    .eq("project_id", projectId)
    .order("required_by_date", { ascending: true, nullsFirst: false });
  return { data: data || [], error };
}

export async function createProcurementItem(payload) {
  const { data, error } = await supabase.from("procurement_items").insert(payload).select().single();
  return { data, error };
}

export async function updateProcurementItem(id, patch) {
  const { data, error } = await supabase.from("procurement_items").update(patch).eq("id", id).select().single();
  return { data, error };
}

export async function deleteProcurementItem(id) {
  const { error } = await supabase.from("procurement_items").delete().eq("id", id);
  return { error };
}

// ── Subbie variation requests ──────────────────────────────────────────────────
export async function createSubbieRequest(payload) {
  const { data, error } = await supabase.from("subbie_requests").insert(payload).select().single();
  return { data, error };
}

export async function getMySubbieRequests(userId) {
  const { data, error } = await supabase
    .from("subbie_requests")
    .select("*, project:projects(job_number, street)")
    .eq("submitted_by", userId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function getSubbieRequests(projectId) {
  const { data, error } = await supabase
    .from("subbie_requests")
    .select("*, submitted_by:profiles(id, full_name, company)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function updateSubbieRequest(id, patch) {
  const { data, error } = await supabase.from("subbie_requests").update(patch).eq("id", id).select().single();
  return { data, error };
}

// Mark a subby's decided (approved/rejected) requests as viewed — clears the
// `request.outcome_unviewed` action item once they've seen the outcome.
export async function markSubbieRequestsViewed(userId) {
  const { error } = await supabase
    .from("subbie_requests")
    .update({ viewed_at: new Date().toISOString() })
    .eq("submitted_by", userId)
    .in("status", ["approved", "rejected"])
    .is("viewed_at", null);
  return { error };
}

// ── Purchase orders (issued to subbies on approved variations) ──────────────────
export async function createPurchaseOrder(payload) {
  const { data, error } = await supabase.from("purchase_orders").insert(payload).select().single();
  return { data, error };
}

export async function getPurchaseOrders(projectId) {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*, subbie:profiles(full_name, company)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function getMyPurchaseOrders(subbieId) {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*, project:projects(job_number, street)")
    .eq("subbie_id", subbieId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function updatePurchaseOrder(id, patch) {
  const { data, error } = await supabase.from("purchase_orders").update(patch).eq("id", id).select().single();
  return { data, error };
}

export async function getPoMessages(poId) {
  const { data, error } = await supabase
    .from("po_messages")
    .select("*, sender:profiles(full_name, role)")
    .eq("po_id", poId)
    .order("created_at", { ascending: true });
  return { data: data || [], error };
}

export async function sendPoMessage(payload) {
  const { data, error } = await supabase.from("po_messages").insert(payload).select("*, sender:profiles(full_name, role)").single();
  return { data, error };
}

// ── Users ──────────────────────────────────────────────────────────────────────
export async function getProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");
  return { data: data || [], error };
}

export async function updateProfile(id, payload) {
  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  return { data, error };
}

// ── Project membership (who is assigned to which project) ───────────────────────
export async function getAllProjectMembers() {
  const { data, error } = await supabase.from("project_members").select("*");
  return { data: data || [], error };
}

export async function addProjectMember(projectId, userId, role) {
  const { data, error } = await supabase
    .from("project_members")
    .insert({ project_id: projectId, user_id: userId, role: role || null })
    .select()
    .single();
  return { data, error };
}

export async function removeProjectMember(projectId, userId) {
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
  return { error };
}

// ── Profile credentials (licences / certs / qualifications) ─────────────────────
export async function getProfileCredentials(profileId) {
  const { data, error } = await supabase
    .from("profile_credentials")
    .select("*")
    .eq("profile_id", profileId)
    .order("expiry_date", { ascending: true, nullsFirst: false });
  return { data: data || [], error };
}

export async function addProfileCredential(payload) {
  const { data, error } = await supabase.from("profile_credentials").insert(payload).select().single();
  return { data, error };
}

export async function deleteProfileCredential(id) {
  const { error } = await supabase.from("profile_credentials").delete().eq("id", id);
  return { error };
}

// Total approved hours a worker has logged (for the team-member history).
export async function getWorkerApprovedHours(workerId) {
  const { data } = await supabase.from("timesheets").select("hours_worked").eq("worker_id", workerId).eq("status", "approved");
  return (data || []).reduce((s, t) => s + (Number(t.hours_worked) || 0), 0);
}

export async function inviteUser(email, fullName, role) {
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role },
  });
  return { data, error };
}
