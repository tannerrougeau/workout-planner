import { describe, expect, it } from "vitest";
import { EXERCISES } from "./exercises";
import { generatePlan, type PlanInput } from "./planner";

const base: PlanInput = {
  goal: "hypertrophy",
  level: "intermediate",
  daysPerWeek: 4,
  sessionMinutes: 60,
  equipment: ["dumbbells", "barbell", "machines", "pullupBar"],
};

const byName = new Map(EXERCISES.map((e) => [e.name, e]));

describe("generatePlan", () => {
  it("creates one day per training day, for every supported frequency", () => {
    for (let days = 2; days <= 6; days++) {
      expect(generatePlan({ ...base, daysPerWeek: days }).days).toHaveLength(days);
    }
  });

  it("clamps out-of-range day counts", () => {
    expect(generatePlan({ ...base, daysPerWeek: 10 }).days).toHaveLength(6);
    expect(generatePlan({ ...base, daysPerWeek: 0 }).days).toHaveLength(2);
  });

  it("only uses equipment the user has", () => {
    const plan = generatePlan({ ...base, equipment: [] });
    for (const day of plan.days) {
      expect(day.exercises.length).toBeGreaterThan(0);
      for (const ex of day.exercises) {
        expect(byName.get(ex.name)?.equipment).toEqual(["bodyweight"]);
      }
    }
  });

  it("never gives beginners advanced exercises or more than 3 sets", () => {
    const plan = generatePlan({ ...base, level: "beginner", goal: "strength" });
    for (const ex of plan.days.flatMap((d) => d.exercises)) {
      expect(byName.get(ex.name)?.minLevel).toBe("beginner");
      expect(ex.sets).toBeLessThanOrEqual(3);
    }
  });

  it("does not repeat an exercise within a day", () => {
    for (const day of generatePlan({ ...base, daysPerWeek: 6 }).days) {
      const names = day.exercises.map((e) => e.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("fits sessions into the time budget", () => {
    for (const sessionMinutes of [45, 60, 90]) {
      for (const day of generatePlan({ ...base, sessionMinutes }).days) {
        expect(day.estimatedMinutes).toBeLessThanOrEqual(sessionMinutes);
      }
    }
  });
});

describe("personalization", () => {
  it("schedules training on the chosen weekdays", () => {
    const plan = generatePlan({ ...base, weekdays: ["Sat", "Tue", "Thu"] });
    expect(plan.days.map((d) => d.weekday)).toEqual(["Tue", "Thu", "Sat"]);
  });

  it("skips exercises that stress a reported limitation", () => {
    const plan = generatePlan({ ...base, limitations: ["knees", "lowerBack"] });
    for (const ex of plan.days.flatMap((d) => d.exercises)) {
      const stresses = byName.get(ex.name)?.stresses ?? [];
      expect(stresses).not.toContain("knees");
      expect(stresses).not.toContain("lowerBack");
    }
  });

  it("never includes excluded exercises", () => {
    const first = generatePlan(base).days[0].exercises[0].name;
    const names = generatePlan({ ...base, excluded: [first] }).days.flatMap((d) => d.exercises.map((e) => e.name));
    expect(names).not.toContain(first);
  });

  it("adds focus-area work when there is time", () => {
    const roomy = { ...base, sessionMinutes: 120, goal: "endurance" as const };
    const count = (focus: PlanInput["focus"]) =>
      generatePlan({ ...roomy, focus }).days.flatMap((d) => d.exercises).filter((e) => e.pattern === "biceps").length;
    expect(count(["arms"])).toBeGreaterThan(count([]));
  });
});
