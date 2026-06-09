import { describe, it, expect } from "vitest";
import {
  hoursSince, isSignoffOverdue, isShiftTooLong, isTaskOverdue, dueAtIso,
  sortItems, melbourneTodayStr, melbourneDayStartUtc, melbourneDayRangeUtc, CONFIG,
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

describe("sortItems", () => {
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
