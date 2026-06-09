// SITE1 k6 load test. Drives the real Supabase REST + Auth endpoints (which ARE the API —
// db.js is a thin client over PostgREST) as authenticated sandbox users, simulating a
// realistic read-heavy field-app mix. Proves the stack toward the 1,000+ user goal and
// surfaces slow endpoints / auth / DB ceilings.
//
// Prereqs: k6 (`brew install k6`) and a seeded sandbox (`npm run sandbox:reseed`) so the
// manifest + users exist. Then:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... PROFILE=100 k6 run tests/load/site1-load.js
// PROFILE ∈ smoke|100|250|500|1000. Run ONLY against a sandbox project; reset after
// (writes create LOAD-tagged rows under sandbox projects, cleaned by `npm run sandbox:reset`).
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const URL = __ENV.SUPABASE_URL;
const ANON = __ENV.SUPABASE_ANON_KEY;
const REST = `${URL}/rest/v1`;

const writes = new Counter("site1_writes");

// VU ramp profiles. Each holds a plateau so percentiles are meaningful.
const PROFILES = {
  smoke: [{ duration: "20s", target: 5 }, { duration: "20s", target: 5 }, { duration: "10s", target: 0 }],
  "100": [{ duration: "1m", target: 100 }, { duration: "3m", target: 100 }, { duration: "1m", target: 0 }],
  "250": [{ duration: "1m", target: 250 }, { duration: "3m", target: 250 }, { duration: "1m", target: 0 }],
  "500": [{ duration: "2m", target: 500 }, { duration: "4m", target: 500 }, { duration: "1m", target: 0 }],
  "1000": [{ duration: "3m", target: 1000 }, { duration: "5m", target: 1000 }, { duration: "2m", target: 0 }],
};
const PROFILE = __ENV.PROFILE || "smoke";

export const options = {
  scenarios: { load: { executor: "ramping-vus", startVUs: 0, stages: PROFILES[PROFILE] || PROFILES.smoke } },
  thresholds: {
    http_req_failed: ["rate<0.05"],            // <5% errors
    http_req_duration: ["p(95)<1500"],         // 95th percentile under 1.5s
    "http_req_duration{kind:read}": ["p(95)<1200"],
    "http_req_duration{kind:write}": ["p(95)<2000"],
  },
};

// Authenticate a pool of sandbox users once; VUs share the tokens.
export function setup() {
  if (!URL || !ANON) throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY");
  const manifest = JSON.parse(open("../sandbox/.manifest.json"));
  const pwd = __ENV.SANDBOX_PASSWORD || manifest.password;
  const sessions = [];
  for (const org of manifest.orgs) {
    const pool = [
      ...(org.users.builder || []),
      ...(org.users.supervisor || []).slice(0, 2),
      ...(org.users.worker || []).slice(0, 3),
    ];
    for (const u of pool) {
      const res = http.post(
        `${URL}/auth/v1/token?grant_type=password`,
        JSON.stringify({ email: u.email, password: pwd }),
        { headers: { "Content-Type": "application/json", apikey: ANON } }
      );
      if (res.status === 200) {
        sessions.push({ token: res.json("access_token"), projectIds: org.projects.map((p) => p.id) });
      }
    }
  }
  if (!sessions.length) throw new Error("No sandbox users could authenticate — reseed first?");
  return { sessions };
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export default function (data) {
  const s = pick(data.sessions);
  const pid = pick(s.projectIds);
  const auth = { apikey: ANON, Authorization: `Bearer ${s.token}` };
  const read = (path, name) =>
    check(http.get(`${REST}/${path}`, { headers: auth, tags: { kind: "read", name } }),
      { [`${name} ok`]: (r) => r.status === 200 });
  const write = (table, body, name) => {
    writes.add(1);
    return check(http.post(`${REST}/${table}`, JSON.stringify(body),
      { headers: { ...auth, "Content-Type": "application/json", Prefer: "return=minimal" }, tags: { kind: "write", name } }),
      { [`${name} ok`]: (r) => r.status === 201 || r.status === 200 });
  };

  // Realistic field mix: ~85% reads, ~15% writes.
  const r = Math.random();
  if (r < 0.30) read("projects?select=*", "dashboard");
  else if (r < 0.52) read(`tasks?project_id=eq.${pid}&select=*`, "open_project");
  else if (r < 0.66) read(`daily_logs?project_id=eq.${pid}&select=*&order=log_date.desc&limit=30`, "daily_logs");
  else if (r < 0.76) read(`hazards?project_id=eq.${pid}&select=*`, "hazards");
  else if (r < 0.85) read("tasks?title=ilike.*SANDBOX*&select=id,title&limit=20", "search");
  else if (r < 0.93) write("tasks", { project_id: pid, title: `LOAD ${Date.now()}`, status: "todo" }, "create_task");
  else write("daily_logs", { project_id: pid, log_date: new Date().toISOString().slice(0, 10), progress_notes: "LOAD" }, "submit_log");

  sleep(Math.random() * 2 + 0.5); // 0.5–2.5s think time
}

// Persist a machine-readable summary alongside the console output.
export function handleSummary(data) {
  return { stdout: textSummary(data), [`tests/load/${PROFILE}-summary.json`]: JSON.stringify(data, null, 2) };
}

// Minimal console summary (avoids importing the remote k6 summary lib).
function textSummary(data) {
  const m = data.metrics;
  const ms = (x) => (x == null ? "?" : `${Math.round(x)}ms`);
  const dur = m.http_req_duration ? m.http_req_duration.values : {};
  const failed = m.http_req_failed ? m.http_req_failed.values.rate : 0;
  return [
    ``,
    `SITE1 load — profile ${PROFILE}`,
    `  requests:     ${m.http_reqs ? m.http_reqs.values.count : 0}`,
    `  failed:       ${(failed * 100).toFixed(2)}%`,
    `  writes:       ${m.site1_writes ? m.site1_writes.values.count : 0}`,
    `  duration avg: ${ms(dur.avg)}  p95: ${ms(dur["p(95)"])}  max: ${ms(dur.max)}`,
    ``,
  ].join("\n");
}
