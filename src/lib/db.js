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
  const today = new Date().toISOString().slice(0, 10);
  const clockOutTime = new Date().toISOString();

  // Find today's open timesheet
  const { data: existing } = await supabase
    .from("timesheets")
    .select("*")
    .eq("worker_id", workerId)
    .eq("work_date", today)
    .is("clock_out", null)
    .single();

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

export async function getTodayClockIn(workerId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("timesheets")
    .select("*")
    .eq("worker_id", workerId)
    .eq("work_date", today)
    .is("clock_out", null)
    .maybeSingle();
  return data;
}

export async function getAllTimesheets() {
  const { data, error } = await supabase
    .from("timesheets")
    .select("*, worker:profiles(full_name), project:projects(street, job_number)")
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

// ── Daily Logs ─────────────────────────────────────────────────────────────────
export async function getDailyLogs(projectId) {
  const { data, error } = await supabase
    .from("daily_logs")
    .select("*, submitted_by:profiles(full_name)")
    .eq("project_id", projectId)
    .order("log_date", { ascending: false })
    .limit(14);
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

// ── Milestones ─────────────────────────────────────────────────────────────────
export async function getMilestones(projectId) {
  const { data, error } = await supabase
    .from("milestones")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  return { data: data || [], error };
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

export async function inviteUser(email, fullName, role) {
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role },
  });
  return { data, error };
}
