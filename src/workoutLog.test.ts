import { describe, expect, it } from "vitest";
import { migrateUnits, type SessionLog } from "./workoutLog";

const session = (id: string, exercises: SessionLog["exercises"]): SessionLog => ({
  id, date: "2026-10-01", weekday: "Mon", dayTitle: "Full Body A", level: "beginner", notes: "", exercises,
});

describe("migrateUnits", () => {
  const before = [
    session("a", [{ name: "Back Squat", weight: 100, values: [8] }, { name: "Push-Up", values: [12] }]),
    session("b", [{ name: "Back Squat", weight: 225, unit: "lb", values: [5] }, { name: "Dumbbell Curl", weight: 12, values: [10] }]),
    session("c", [{ name: "Plank", values: [45] }]),
  ];

  it("tags only weighted entries without a unit, and counts them", () => {
    const { sessions, tagged } = migrateUnits(before, "kg");
    expect(tagged).toBe(2);
    expect(sessions[0].exercises).toEqual([{ name: "Back Squat", weight: 100, unit: "kg", values: [8] }, { name: "Push-Up", values: [12] }]);
    expect(sessions[1].exercises[0].unit).toBe("lb"); // already tagged: left alone
    expect(sessions[1].exercises[1].unit).toBe("kg");
    expect(sessions[2]).toBe(before[2]); // nothing to tag: same object
  });

  it("does nothing the second time", () => {
    const once = migrateUnits(before, "lb").sessions;
    const twice = migrateUnits(once, "kg");
    expect(twice.tagged).toBe(0);
    expect(twice.sessions).toEqual(once);
    expect(once[0].exercises[0].unit).toBe("lb");
  });

  it("leaves the stored weight exactly as typed", () => {
    expect(migrateUnits(before, "lb").sessions[0].exercises[0].weight).toBe(100);
  });
});
