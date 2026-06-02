// ── Users ──────────────────────────────────────────────────────────────────────
export const MOCK_USERS = {
  builder:       { id: "u0", name: "Pete Stokes",   role: "builder",       avatar: "PS", company: "SCS Builders" },
  supervisor:    { id: "u1", name: "Jake Thornton",  role: "supervisor",    avatar: "JT" },
  worker:        { id: "u2", name: "Sam O'Brien",    role: "worker",        avatar: "SO" },
  subcontractor: { id: "u3", name: "Mick Parrish",   role: "subcontractor", avatar: "MP", trade: "Concreter" },
  client:        { id: "u4", name: "Sarah Brennan",  role: "client",        avatar: "SB", projectId: "p1" },
  office:        { id: "u5", name: "Lena Kovac",     role: "office",        avatar: "LK" },
};

export const mockWorkers = [
  { id: "w1", name: "Jake Thornton", avatar: "JT", trade: "Carpenter",   role: "supervisor" },
  { id: "w2", name: "Sam O'Brien",   avatar: "SO", trade: "Labourer",    role: "worker" },
  { id: "w3", name: "Mick Parrish",  avatar: "MP", trade: "Concreter",   role: "subcontractor" },
  { id: "w4", name: "Lena Kovac",    avatar: "LK", trade: "Electrician", role: "subcontractor" },
  { id: "w5", name: "Chris Webb",    avatar: "CW", trade: "Plumber",     role: "subcontractor" },
];

// ── Projects ───────────────────────────────────────────────────────────────────
export const mockProjects = [
  {
    id: "p1",
    jobNumber: "SCS-001",
    street: "15 Beatrice Street",
    suburb: "Sassafras VIC 3787",
    client: "Sarah & Mike Brennan",
    clientEmail: "sarah.brennan@email.com",
    clientPhone: "0412 345 678",
    phase: "Framing",
    manager: "Pete Stokes",
    supervisorId: "w1",
    budget: 420000,
    spent: 185000,
    progress: 38,
    priority: "high",
    status: "active",
    health: "green",
    startDate: "2026-02-10",
    estimatedEnd: "2026-11-20",
    telegramChatId: "-1001234567890",
    milestones: [
      { name: "Site Setup",  done: true,  date: "2026-02-15" },
      { name: "Foundation",  done: true,  date: "2026-03-28" },
      { name: "Framing",     done: false, date: null },
      { name: "Lock-up",     done: false, date: null },
      { name: "Fitout",      done: false, date: null },
      { name: "Handover",    done: false, date: null },
    ],
  },
  {
    id: "p2",
    jobNumber: "SCS-002",
    street: "42 Ringwood East Drive",
    suburb: "Ringwood East VIC 3135",
    client: "Tom & Linda Maguire",
    clientEmail: "tmaguire@email.com",
    clientPhone: "0498 765 432",
    phase: "Fitout",
    manager: "Pete Stokes",
    supervisorId: "w1",
    budget: 180000,
    spent: 161000,
    progress: 72,
    priority: "medium",
    status: "active",
    health: "amber",
    startDate: "2025-11-03",
    estimatedEnd: "2026-07-15",
    telegramChatId: "-1009876543210",
    milestones: [
      { name: "Site Setup",  done: true,  date: "2025-11-10" },
      { name: "Foundation",  done: true,  date: "2025-12-05" },
      { name: "Framing",     done: true,  date: "2026-02-14" },
      { name: "Lock-up",     done: true,  date: "2026-04-02" },
      { name: "Fitout",      done: false, date: null },
      { name: "Handover",    done: false, date: null },
    ],
  },
  {
    id: "p3",
    jobNumber: "SCS-003",
    street: "7 Clunes Road",
    suburb: "Clunes VIC 3370",
    client: "David Chen",
    clientEmail: "david.chen@email.com",
    clientPhone: "0433 111 222",
    phase: "Planning",
    manager: "Pete Stokes",
    supervisorId: null,
    budget: 650000,
    spent: 28000,
    progress: 5,
    priority: "low",
    status: "planning",
    health: "red",
    startDate: "2026-07-01",
    estimatedEnd: "2027-06-30",
    telegramChatId: null,
    milestones: [
      { name: "Site Setup",  done: false, date: null },
      { name: "Foundation",  done: false, date: null },
      { name: "Framing",     done: false, date: null },
      { name: "Lock-up",     done: false, date: null },
      { name: "Fitout",      done: false, date: null },
      { name: "Handover",    done: false, date: null },
    ],
  },
];

export function projectLabel(p) {
  return p.jobNumber ? `${p.jobNumber} · ${p.street}` : p.street;
}

// ── Tasks ──────────────────────────────────────────────────────────────────────
export const mockTasks = [
  { id: "t1", title: "Install roof trusses — west wing",   projectId: "p1", assignee: "w1", dueDate: "2026-06-02", priority: "high",   done: false },
  { id: "t2", title: "Brace external walls north side",     projectId: "p1", assignee: "w2", dueDate: "2026-06-02", priority: "high",   done: false },
  { id: "t3", title: "Fix bottom plate — garage slab",      projectId: "p1", assignee: "w2", dueDate: "2026-06-02", priority: "medium", done: true  },
  { id: "t4", title: "Deliver framing timber",              projectId: "p1", assignee: "w1", dueDate: "2026-06-03", priority: "medium", done: false },
  { id: "t5", title: "Set up scaffolding east facade",      projectId: "p2", assignee: "w1", dueDate: "2026-06-03", priority: "high",   done: false },
  { id: "t6", title: "Plumbing rough-in inspection",        projectId: "p2", assignee: "w5", dueDate: "2026-06-04", priority: "low",    done: false },
  { id: "t7", title: "Install kitchen cabinetry rough-in",  projectId: "p2", assignee: "w3", dueDate: "2026-06-05", priority: "medium", done: false },
  { id: "t8", title: "Council permit submission",           projectId: "p3", assignee: "w1", dueDate: "2026-06-10", priority: "high",   done: false },
];

// ── Hazards ────────────────────────────────────────────────────────────────────
export const mockHazards = [
  { id: "h1", title: "Unsecured scaffolding on east facade",     riskLevel: "high",   category: "Falls",                    control: "Immediately secure all scaffold clamps. Do not work at height until inspected.", reporter: "Jake Thornton", date: "2026-06-01", status: "open",     projectId: "p2" },
  { id: "h2", title: "Silica dust from cutting operations",       riskLevel: "medium", category: "Dust/Hazardous Substances", control: "Wet cutting required. P2 respirators mandatory in cutting zone.",               reporter: "Pete Stokes",   date: "2026-05-28", status: "open",     projectId: "p1" },
  { id: "h3", title: "Exposed nail ends — floor framing",         riskLevel: "low",    category: "Manual Handling",          control: "All exposed nails bent over or removed at end of each shift.",                  reporter: "Jake Thornton", date: "2026-05-25", status: "resolved", projectId: "p1" },
  { id: "h4", title: "Overhead powerlines near crane path",       riskLevel: "high",   category: "Electrical",               control: "Crane exclusion zone marked. Spotter required. Notify Powercor before lift.",   reporter: "Mick Parrish",  date: "2026-05-20", status: "open",     projectId: "p1" },
  { id: "h5", title: "Uneven ground causing trip hazard at entry",riskLevel: "low",    category: "Manual Handling",          control: "Temporary matting laid. Warning signage placed.",                               reporter: "Sam O'Brien",   date: "2026-05-18", status: "resolved", projectId: "p2" },
];

// ── Issues / Blockers ──────────────────────────────────────────────────────────
export const mockIssues = [
  { id: "i1", title: "Engineering response overdue",       projectId: "p1", category: "Design",    priority: "high",   status: "open",     date: "2026-05-29", assignee: "w1", notes: "Waiting on structural calcs for beam over garage opening. Framing cannot proceed." },
  { id: "i2", title: "Variation SCS-001-V02 awaiting approval", projectId: "p1", category: "Commercial", priority: "high", status: "open", date: "2026-06-01", assignee: "w1", notes: "Client has not responded to variation for additional underpinning." },
  { id: "i3", title: "Tiling delivery delayed 2 weeks",   projectId: "p2", category: "Delivery",  priority: "medium", status: "open",     date: "2026-06-01", assignee: "w1", notes: "Supplier back-ordered. May delay bathroom fitout start." },
  { id: "i4", title: "Inspection not booked — frame stage",projectId: "p2", category: "Inspection",priority: "medium", status: "open",    date: "2026-06-02", assignee: "w1", notes: "Need to book private building surveyor before lock-up." },
  { id: "i5", title: "Client colour selection outstanding",projectId: "p1", category: "Client",   priority: "low",    status: "open",     date: "2026-05-20", assignee: "w1", notes: "Kitchen cabinet colours and benchtop selection needed by end of month." },
];

// ── Variations ─────────────────────────────────────────────────────────────────
export const mockVariations = [
  { id: "v1", ref: "SCS-001-V01", projectId: "p1", title: "Additional soil removal — unexpected rock",  amount: 4800,  status: "approved",   date: "2026-04-10", raisedBy: "Supervisor" },
  { id: "v2", ref: "SCS-001-V02", projectId: "p1", title: "Underpinning to south boundary wall",        amount: 12500, status: "pending",    date: "2026-06-01", raisedBy: "Supervisor" },
  { id: "v3", ref: "SCS-002-V01", projectId: "p2", title: "Upgrade to 600×600 floor tiles",             amount: 3200,  status: "approved",   date: "2026-05-15", raisedBy: "Client" },
  { id: "v4", ref: "SCS-002-V02", projectId: "p2", title: "Add third bathroom exhaust fan",             amount: 650,   status: "pending",    date: "2026-05-28", raisedBy: "Supervisor" },
];

// ── Timesheets ─────────────────────────────────────────────────────────────────
export const mockTimesheets = [
  { id: "ts1", workerId: "w1", workerName: "Jake Thornton", projectId: "p1", projectName: "SCS-001 · 15 Beatrice Street", weekEnding: "2026-05-31", hours: 38.5, status: "pending" },
  { id: "ts2", workerId: "w1", workerName: "Jake Thornton", projectId: "p2", projectName: "SCS-002 · 42 Ringwood East Dr", weekEnding: "2026-05-24", hours: 40,   status: "approved" },
  { id: "ts3", workerId: "w2", workerName: "Sam O'Brien",   projectId: "p1", projectName: "SCS-001 · 15 Beatrice Street", weekEnding: "2026-05-31", hours: 35,   status: "pending" },
  { id: "ts4", workerId: "w3", workerName: "Mick Parrish",  projectId: "p2", projectName: "SCS-002 · 42 Ringwood East Dr", weekEnding: "2026-05-31", hours: 40,   status: "pending" },
  { id: "ts5", workerId: "w4", workerName: "Lena Kovac",    projectId: "p2", projectName: "SCS-002 · 42 Ringwood East Dr", weekEnding: "2026-05-24", hours: 32,   status: "approved" },
];

// ── Shifts ─────────────────────────────────────────────────────────────────────
export const mockShifts = [
  { id: "sh1",  workerId: "w1", projectId: "p1", date: "2026-06-02", start: "07:00", end: "15:30" },
  { id: "sh2",  workerId: "w2", projectId: "p1", date: "2026-06-02", start: "07:00", end: "15:30" },
  { id: "sh3",  workerId: "w3", projectId: "p2", date: "2026-06-02", start: "06:30", end: "14:30" },
  { id: "sh4",  workerId: "w1", projectId: "p1", date: "2026-06-03", start: "07:00", end: "15:30" },
  { id: "sh5",  workerId: "w2", projectId: "p2", date: "2026-06-03", start: "07:00", end: "15:30" },
  { id: "sh6",  workerId: "w4", projectId: "p2", date: "2026-06-03", start: "08:00", end: "16:00" },
  { id: "sh7",  workerId: "w1", projectId: "p1", date: "2026-06-04", start: "07:00", end: "15:30" },
  { id: "sh8",  workerId: "w3", projectId: "p1", date: "2026-06-04", start: "06:30", end: "14:30" },
  { id: "sh9",  workerId: "w1", projectId: "p1", date: "2026-06-05", start: "07:00", end: "15:30" },
  { id: "sh10", workerId: "w4", projectId: "p2", date: "2026-06-05", start: "08:00", end: "16:00" },
  { id: "sh11", workerId: "w1", projectId: "p1", date: "2026-06-06", start: "07:00", end: "13:00" },
  { id: "sh12", workerId: "w2", projectId: "p1", date: "2026-06-06", start: "07:00", end: "13:00" },
];

// ── Messages ───────────────────────────────────────────────────────────────────
export const mockMessages = [
  { id: "msg1", projectId: "p1", channel: "client",  sender: "Pete Stokes",   senderRole: "builder",    text: "Framing inspection booked for Thursday 9am.", timestamp: "2026-06-01T14:23:00Z" },
  { id: "msg2", projectId: "p1", channel: "client",  sender: "Sarah Brennan", senderRole: "client",     text: "Great! Will we need to be on site?",          timestamp: "2026-06-01T15:05:00Z" },
  { id: "msg3", projectId: "p1", channel: "client",  sender: "Pete Stokes",   senderRole: "builder",    text: "Not required but you're welcome.",             timestamp: "2026-06-01T15:12:00Z" },
  { id: "msg4", projectId: "p1", channel: "team",    sender: "Jake Thornton", senderRole: "supervisor", text: "Engineering drawings still outstanding — chasing today.", timestamp: "2026-06-02T07:45:00Z" },
  { id: "msg5", projectId: "p2", channel: "client",  sender: "Pete Stokes",   senderRole: "builder",    text: "Tiling subcontractor confirmed for Monday.",    timestamp: "2026-05-30T09:00:00Z" },
  { id: "msg6", projectId: "p2", channel: "trades",  sender: "Mick Parrish",  senderRole: "subcontractor", text: "Concreting done. Ready for inspection.", timestamp: "2026-06-01T11:30:00Z" },
];

// ── Documents ──────────────────────────────────────────────────────────────────
export const mockDocuments = [
  { id: "doc1", projectId: "p1", category: "Permits",      name: "Building Permit",               type: "pdf", date: "2026-02-10", size: "1.2 MB", current: true  },
  { id: "doc2", projectId: "p1", category: "Architectural", name: "Architectural Drawings — Rev C", type: "pdf", date: "2026-01-22", size: "3.8 MB", current: true  },
  { id: "doc3", projectId: "p1", category: "Architectural", name: "Architectural Drawings — Rev B", type: "pdf", date: "2025-12-10", size: "3.5 MB", current: false },
  { id: "doc4", projectId: "p1", category: "Engineering",  name: "Structural Drawings",            type: "pdf", date: "2026-01-15", size: "8.1 MB", current: true  },
  { id: "doc5", projectId: "p1", category: "Contracts",    name: "Signed Contract",                type: "pdf", date: "2025-12-10", size: "0.5 MB", current: true  },
  { id: "doc6", projectId: "p2", category: "Permits",      name: "Building Permit",               type: "pdf", date: "2025-10-20", size: "1.1 MB", current: true  },
  { id: "doc7", projectId: "p2", category: "Architectural", name: "Extension Plans — Final",       type: "pdf", date: "2025-10-05", size: "4.2 MB", current: true  },
  { id: "doc8", projectId: "p2", category: "Contracts",    name: "Signed Contract",                type: "pdf", date: "2025-10-01", size: "0.4 MB", current: true  },
];

// ── Daily Logs ─────────────────────────────────────────────────────────────────
export const mockDailyLogs = [
  { id: "dl1", projectId: "p1", date: "2026-06-01", supervisor: "Jake Thornton", weather: "Fine", workers: 3, progress: "Completed internal wall framing level 1. Started roof truss layout.", deliveries: "Timber delivery 9am — all accounted for.", visitors: "Engineer onsite 2pm", issues: "Waiting on engineering drawings for beam over garage." },
  { id: "dl2", projectId: "p1", date: "2026-05-31", supervisor: "Jake Thornton", weather: "Overcast", workers: 4, progress: "Completed floor framing. Structural bearer and joist installation complete.", deliveries: "None", visitors: "Client site visit 11am", issues: "" },
  { id: "dl3", projectId: "p2", date: "2026-06-01", supervisor: "Jake Thornton", weather: "Fine", workers: 2, progress: "Started kitchen fit-out. Cabinets being installed.", deliveries: "Cabinet delivery — 2 units damaged, logged.", visitors: "", issues: "2 cabinet doors damaged in delivery — claim lodged." },
];

// ── Material Requests ──────────────────────────────────────────────────────────
export const mockMaterialRequests = [
  { id: "mr1", item: "90×45 MGP10 framing timber — 6m", qty: 40, unit: "lengths", projectId: "p1", urgency: "today",     requestedBy: "w2", date: "2026-06-01", status: "pending" },
  { id: "mr2", item: "M12 coach screws",                  qty: 200, unit: "box",     projectId: "p1", urgency: "this-week", requestedBy: "w2", date: "2026-05-30", status: "ordered" },
];

export const HAZARD_CATEGORIES = ["Falls", "Equipment", "Manual Handling", "Dust/Hazardous Substances", "Electrical", "Excavation", "Other"];
export const ISSUE_CATEGORIES  = ["Design", "Commercial", "Delivery", "Inspection", "Client", "Labour", "Safety", "Other"];
