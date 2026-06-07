import { describe, it, expect } from "vitest";
import { VIC_MILESTONES, daysBetween, milestoneVariance, milestoneStatus, mustOrderBy, addDays, eotAffectedMilestones,
  isWithinDays, breachesOrderBy, isDeliveryLate, inspectionDueSoon, materialNotOnSite, doubleBooked, lookaheadBucket } from "./timeline";

describe("lookaheadBucket", () => {
  const t = "2025-06-15";
  it("today / tomorrow", () => {
    expect(lookaheadBucket("2025-06-15", t)).toBe("today");
    expect(lookaheadBucket("2025-06-16", t)).toBe("tomorrow");
  });
  it("this week (2–7 days out)", () => expect(lookaheadBucket("2025-06-20", t)).toBe("thisWeek"));
  it("next week (8–14 days out)", () => expect(lookaheadBucket("2025-06-25", t)).toBe("nextWeek"));
  it("null when past or beyond 2 weeks", () => {
    expect(lookaheadBucket("2025-06-10", t)).toBeNull();
    expect(lookaheadBucket("2025-07-15", t)).toBeNull();
  });
});

const TODAY = "2025-06-15";

describe("procurement.order_by_breach (the headline 'windows' rule)", () => {
  // required in 6 days (2025-06-21), 21-day lead → must_order_by 2025-05-31 < today → breach.
  const windows = { required_by_date: "2025-06-21", lead_time_days: 21, ordered_date: null, status: "required" };
  it("TRIGGER: fires when past must-order-by and not ordered", () => {
    expect(breachesOrderBy(windows, TODAY)).toBe(true);
  });
  it("RESOLUTION: stops once ordered", () => {
    expect(breachesOrderBy({ ...windows, ordered_date: "2025-06-15", status: "ordered" }, TODAY)).toBe(false);
  });
  it("GRACEFUL DEGRADATION: no lead time → emits nothing (no guessing)", () => {
    expect(breachesOrderBy({ ...windows, lead_time_days: null }, TODAY)).toBe(false);
  });
  it("silent when required-by date missing", () => {
    expect(breachesOrderBy({ ...windows, required_by_date: null }, TODAY)).toBe(false);
  });
  it("not yet breaching when there's still lead-time room", () => {
    expect(breachesOrderBy({ required_by_date: "2025-12-01", lead_time_days: 21, ordered_date: null }, TODAY)).toBe(false);
  });
});

describe("procurement.delivery_late", () => {
  it("fires when expected delivery is after required-by", () => {
    expect(isDeliveryLate({ ordered_date: "2025-06-01", expected_delivery_date: "2025-06-25", required_by_date: "2025-06-21" })).toBe(true);
  });
  it("silent when on time", () => {
    expect(isDeliveryLate({ ordered_date: "2025-06-01", expected_delivery_date: "2025-06-19", required_by_date: "2025-06-21" })).toBe(false);
  });
  it("silent when not ordered yet", () => {
    expect(isDeliveryLate({ ordered_date: null, expected_delivery_date: "2025-06-25", required_by_date: "2025-06-21" })).toBe(false);
  });
});

describe("inspection.due_soon", () => {
  it("fires within 2 days, not complete", () => {
    expect(inspectionDueSoon({ due_date: "2025-06-16", status: "not_started" }, TODAY)).toBe(true);
  });
  it("silent if completed", () => {
    expect(inspectionDueSoon({ due_date: "2025-06-16", status: "approved" }, TODAY)).toBe(false);
  });
  it("silent if far off", () => {
    expect(inspectionDueSoon({ due_date: "2025-07-16", status: "not_started" }, TODAY)).toBe(false);
  });
});

describe("task.material_not_on_site", () => {
  const procById = { p1: { id: "p1", actual_delivery_date: null }, p2: { id: "p2", actual_delivery_date: "2025-06-10" } };
  it("flags a task starting soon whose material is undelivered", () => {
    const tasks = [{ id: "t1", start_date: "2025-06-18", status: "todo", depends_on_procurement_ids: ["p1"] }];
    expect(materialNotOnSite(tasks, procById, TODAY).map(t => t.id)).toEqual(["t1"]);
  });
  it("clears when material is delivered", () => {
    const tasks = [{ id: "t2", start_date: "2025-06-18", status: "todo", depends_on_procurement_ids: ["p2"] }];
    expect(materialNotOnSite(tasks, procById, TODAY)).toEqual([]);
  });
  it("silent with no procurement dependency", () => {
    const tasks = [{ id: "t3", start_date: "2025-06-18", status: "todo", depends_on_procurement_ids: [] }];
    expect(materialNotOnSite(tasks, procById, TODAY)).toEqual([]);
  });
});

describe("labour.double_booked", () => {
  it("flags a worker on two projects same day", () => {
    const allocs = [
      { worker_or_subby_id: "w1", allocation_date: "2025-06-16", project_id: "A" },
      { worker_or_subby_id: "w1", allocation_date: "2025-06-16", project_id: "B" },
    ];
    expect(doubleBooked(allocs)).toEqual([{ worker: "w1", date: "2025-06-16" }]);
  });
  it("fine when on different days", () => {
    const allocs = [
      { worker_or_subby_id: "w1", allocation_date: "2025-06-16", project_id: "A" },
      { worker_or_subby_id: "w1", allocation_date: "2025-06-17", project_id: "B" },
    ];
    expect(doubleBooked(allocs)).toEqual([]);
  });
});

describe("isWithinDays", () => {
  it("true within the window", () => expect(isWithinDays("2025-06-18", 5, TODAY)).toBe(true));
  it("false past the window", () => expect(isWithinDays("2025-06-25", 5, TODAY)).toBe(false));
  it("false in the past", () => expect(isWithinDays("2025-06-10", 5, TODAY)).toBe(false));
});

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
