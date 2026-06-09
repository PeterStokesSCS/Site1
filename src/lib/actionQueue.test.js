import { describe, it, expect } from "vitest";
import {
  hoursSince, isSignoffOverdue, isShiftTooLong, isTaskOverdue, dueAtIso,
  sortItems, melbourneTodayStr, melbourneDayStartUtc, melbourneDayRangeUtc, CONFIG,
  melbourneCutoffUtc, openShiftHoursToCutoff, isShiftPastCutoff, groupPendingLabour,
  variationLabourCost, groupItems,
} from "./actionQueue";

const HOURS = (h) => new Date(Date.now() - h * 3600000).toISOString();

describe("hoursSince", () => {
  it("computes age in hours", () => {
    expect(hoursSince(HOURS(5))).toBeGreaterThan(4.9);
    expect(hoursSince(HOURS(5))).toBeLessThan(5.1);
  });
  it("returns null for missing input", () => expect(hoursSince(null)).toBeNull());
});

describe("variation.signoff_overdue logic", () => {
  // Acceptance §9: sent 4 days ago, no response → overdue (default window 3 days).
  it("flags a variation sent 4 days ago", () => {
    expect(isSignoffOverdue(HOURS(96))).toBe(true);
  });
  it("does NOT flag one sent 2 days ago", () => {
    expect(isSignoffOverdue(HOURS(48))).toBe(false);
  });
  it("resolution: once approved the predicate no longer runs (status != sent), so nothing to flag", () => {
    // Resolution is by source-state change (status leaves 'sent'); the registry query
    // filters on status='sent', so an approved variation is never even fetched.
    expect(CONFIG.signoffOverdueDays).toBe(3);
  });
});

describe("shift.open_too_long logic", () => {
  // Acceptance §9: open shift clocked in 11h ago → flagged (default max 10h).
  it("flags an 11-hour open shift", () => expect(isShiftTooLong(HOURS(11))).toBe(true));
  it("does NOT flag a 6-hour open shift", () => expect(isShiftTooLong(HOURS(6))).toBe(false));
});

describe("task.overdue logic", () => {
  it("flags a past-due incomplete task", () => {
    expect(isTaskOverdue("2020-01-01", "09:00", "todo")).toBe(true);
  });
  it("never flags a completed task", () => {
    expect(isTaskOverdue("2020-01-01", "09:00", "completed")).toBe(false);
  });
  it("not overdue when due in the far future", () => {
    expect(isTaskOverdue("2999-01-01", "09:00", "todo")).toBe(false);
  });
  it("dueAtIso defaults missing time to 17:00", () => {
    expect(dueAtIso("2025-03-04")).toBe("2025-03-04T17:00:00+10:00");
  });
});

describe("groupItems (#3 consolidation)", () => {
  const overdue = (i) => ({ type: "task.overdue", projectId: "p1", priority: "high", ageHours: i, target: { kind: "task", projectId: "p1", entityId: `t${i}` } });
  it("groups >3 of the same type in the same project into one (deep-links to filtered view)", () => {
    const g = groupItems([overdue(1), overdue(2), overdue(3), overdue(4), overdue(5)]);
    expect(g.length).toBe(1);
    expect(g[0].grouped).toBe(true);
    expect(g[0].count).toBe(5);
    expect(g[0].target.entityId).toBe("group:overdue");
    expect(g[0].description).toMatch(/5 overdue tasks/);
  });
  it("keeps <=3 individual", () => {
    expect(groupItems([overdue(1), overdue(2), overdue(3)]).length).toBe(3);
  });
  it("does not group types without group metadata", () => {
    const v = (i) => ({ type: "variation.signoff_overdue", projectId: "p1", priority: "high", ageHours: i, target: {} });
    expect(groupItems([v(1), v(2), v(3), v(4)]).length).toBe(4);
  });
  it("groups per project, not across projects", () => {
    const a = (i) => ({ type: "task.overdue", projectId: "pA", priority: "high", ageHours: i, target: {} });
    const b = (i) => ({ type: "task.overdue", projectId: "pB", priority: "high", ageHours: i, target: {} });
    // 4 in pA -> grouped; 2 in pB -> individual
    const g = groupItems([a(1), a(2), a(3), a(4), b(1), b(2)]);
    expect(g.filter(x => x.grouped).length).toBe(1);
    expect(g.length).toBe(3); // 1 group + 2 individual
  });
});

describe("sortItems", () => {
  it("supervisor order: hazards before tasks before inspections (not raw priority)", () => {
    const items = [
      { type: "inspection.due_soon", priority: "high", ageHours: 1 },
      { type: "task.overdue", priority: "high", ageHours: 1 },
      { type: "hazard.open", priority: "high", ageHours: 1 },
    ];
    expect(sortItems(items, "supervisor").map(i => i.type)).toEqual(["hazard.open", "task.overdue", "inspection.due_soon"]);
  });
  it("sorts by priority (high→low) then age (oldest first)", () => {
    const items = [
      { priority: "low", ageHours: 100 },
      { priority: "high", ageHours: 2 },
      { priority: "high", ageHours: 50 },
      { priority: "medium", ageHours: 5 },
    ];
    const sorted = sortItems(items);
    expect(sorted.map(i => i.priority)).toEqual(["high", "high", "medium", "low"]);
    expect(sorted[0].ageHours).toBe(50); // older high first
  });
});

describe("melbourne time", () => {
  it("formats today as YYYY-MM-DD", () => {
    expect(melbourneTodayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  // melbourneTodayStr(d) must report the Melbourne calendar day of an instant,
  // not the UTC date — the bug this change fixes. 2025-06-09T20:00Z is 10 Jun 06:00 in Melbourne.
  it("reports the Melbourne calendar day of an instant, not UTC", () => {
    expect(melbourneTodayStr(new Date("2025-06-09T20:00:00Z"))).toBe("2025-06-10");
  });
});

describe("Tier 2 #7 — end-of-day labour (pure)", () => {
  it("melbourneCutoffUtc = 17:00 Melbourne (AEST winter -> 07:00 UTC)", () => {
    expect(melbourneCutoffUtc("2025-06-10").toISOString()).toBe("2025-06-10T07:00:00.000Z");
  });
  it("openShiftHoursToCutoff counts clock-in -> cutoff, never negative", () => {
    expect(openShiftHoursToCutoff("2025-06-10T01:00:00Z", "2025-06-10T07:00:00Z")).toBe(6);
    expect(openShiftHoursToCutoff("2025-06-10T09:00:00Z", "2025-06-10T07:00:00Z")).toBe(0);
  });
  it("isShiftPastCutoff flips once the day's 17:00 Melbourne has passed", () => {
    const clockIn = "2025-06-10T00:00:00Z"; // 10:00 Melbourne; cutoff = 07:00 UTC
    expect(isShiftPastCutoff(clockIn, Date.parse("2025-06-10T08:00:00Z"))).toBe(true);
    expect(isShiftPastCutoff(clockIn, Date.parse("2025-06-10T06:00:00Z"))).toBe(false);
  });
  it("groupPendingLabour = one group per project/day, completed+unapproved only", () => {
    const ts = [
      { project_id: "p1", work_date: "2025-06-10", clock_out: "x", hours_worked: 8,   status: "pending" },
      { project_id: "p1", work_date: "2025-06-10", clock_out: "x", hours_worked: 6.5, status: "pending" },
      { project_id: "p1", work_date: "2025-06-10", clock_out: null, hours_worked: 0,  status: "pending" },  // open -> ignored
      { project_id: "p1", work_date: "2025-06-10", clock_out: "x", hours_worked: 7,   status: "approved" }, // approved -> ignored
      { project_id: "p2", work_date: "2025-06-10", clock_out: "x", hours_worked: 4,   status: "pending" },
    ];
    const g = groupPendingLabour(ts);
    expect(g.length).toBe(2);
    expect(g.find(x => x.projectId === "p1").count).toBe(2);
    expect(g.find(x => x.projectId === "p1").hours).toBe(14.5);
  });
  it("variationLabourCost = sum of hours x each worker's rate", () => {
    const entries = [
      { hours: 2, worker_ids: ["a", "b"] },  // 2*(50+60) = 220
      { hours: 3, worker_ids: ["a"] },       // 3*50      = 150
      { hours: 1, worker_ids: ["c"] },       // 1*0 (no rate) = 0
    ];
    expect(variationLabourCost(entries, { a: 50, b: 60 })).toBe(370);
    expect(variationLabourCost([], {})).toBe(0);
  });
});

describe("melbourne day boundaries (DST-aware)", () => {
  it("AEST (winter) midnight is UTC+10", () => {
    expect(melbourneDayStartUtc("2025-06-10").toISOString()).toBe("2025-06-09T14:00:00.000Z");
  });
  it("AEDT (summer) midnight is UTC+11", () => {
    expect(melbourneDayStartUtc("2025-01-10").toISOString()).toBe("2025-01-09T13:00:00.000Z");
  });
  it("a normal day spans 24h", () => {
    const { startUtc, endUtc } = melbourneDayRangeUtc("2025-06-10");
    expect((endUtc - startUtc) / 3600000).toBe(24);
  });
  it("the DST-start day (Oct) spans 23h", () => {
    const { startUtc, endUtc } = melbourneDayRangeUtc("2025-10-05");
    expect((endUtc - startUtc) / 3600000).toBe(23);
  });
  it("the DST-end day (Apr) spans 25h", () => {
    const { startUtc, endUtc } = melbourneDayRangeUtc("2025-04-06");
    expect((endUtc - startUtc) / 3600000).toBe(25);
  });
});
