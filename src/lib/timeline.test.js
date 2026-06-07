import { describe, it, expect } from "vitest";
import { VIC_MILESTONES, daysBetween, milestoneVariance, milestoneStatus, mustOrderBy, addDays, eotAffectedMilestones } from "./timeline";

describe("eotAffectedMilestones (cascade)", () => {
  const ms = [
    { id: "a", sort_order: 1 }, { id: "b", sort_order: 2 }, { id: "c", sort_order: 3 },
  ];
  it("cascades to the chosen stage + all later ones", () => {
    expect(eotAffectedMilestones(ms, "b", true).map(m => m.id)).toEqual(["b", "c"]);
  });
  it("affects only the chosen one when not cascading", () => {
    expect(eotAffectedMilestones(ms, "b", false).map(m => m.id)).toEqual(["b"]);
  });
  it("empty when the milestone isn't found", () => {
    expect(eotAffectedMilestones(ms, "z", true)).toEqual([]);
  });
});

describe("VIC skeleton", () => {
  it("has the 6 ordered VIC stages", () => {
    expect(VIC_MILESTONES.map(m => m.key)).toEqual(["site_start", "base", "frame", "lock_up", "fixing", "practical_completion"]);
    expect(VIC_MILESTONES.map(m => m.sequence)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("daysBetween / addDays", () => {
  it("counts whole days", () => expect(daysBetween("2025-03-10", "2025-03-04")).toBe(6));
  it("addDays moves forward", () => expect(addDays("2025-03-04", 21)).toBe("2025-03-25"));
  it("addDays moves backward", () => expect(addDays("2025-03-25", -21)).toBe("2025-03-04"));
  it("null-safe", () => { expect(daysBetween(null, "2025-01-01")).toBeNull(); expect(addDays(null, 5)).toBeNull(); });
});

describe("milestone variance + status", () => {
  it("variance = forecast − planned", () => {
    expect(milestoneVariance({ planned_date: "2025-06-01", forecast_date: "2025-06-05" })).toBe(4);
  });
  it("at_risk when slip > threshold (default 3)", () => {
    expect(milestoneStatus({ planned_date: "2025-06-01", forecast_date: "2025-06-05" })).toBe("at_risk");
  });
  it("not at_risk within threshold", () => {
    expect(milestoneStatus({ planned_date: "2025-06-01", forecast_date: "2025-06-03" })).toBe("upcoming");
  });
  it("complete wins regardless of dates", () => {
    expect(milestoneStatus({ planned_date: "2025-06-01", forecast_date: "2025-07-01", done: true })).toBe("complete");
    expect(milestoneStatus({ completed_date: "2025-06-02" })).toBe("complete");
  });
});

describe("mustOrderBy (lead-time math)", () => {
  // Headline "windows" example: required in 6 days, 21-day lead → must have ordered 15 days ago.
  it("subtracts lead time from required-by", () => {
    expect(mustOrderBy("2025-06-21", 21)).toBe("2025-05-31");
  });
  it("emits null when lead time missing (no risk, graceful degradation)", () => {
    expect(mustOrderBy("2025-06-21", null)).toBeNull();
    expect(mustOrderBy("2025-06-21", undefined)).toBeNull();
  });
  it("emits null when required-by missing", () => {
    expect(mustOrderBy(null, 21)).toBeNull();
  });
});
