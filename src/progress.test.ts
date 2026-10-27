import { describe, expect, it } from "vitest";
import type { PlannedExercise } from "./planner";
import { cyclePosition, exerciseSeries, nextTarget, suggestions } from "./progress";
import type { ExerciseLog, Feeling, SessionLog } from "./workoutLog";

const squat: PlannedExercise = { name: "Back Squat", pattern: "squat", sets: 3, reps: "8–12", restSeconds: 90, progression: "" };
const curl: PlannedExercise = { name: "Dumbbell Curl", pattern: "biceps", sets: 2, reps: "10–15", restSeconds: 60, progression: "" };
const pushUp: PlannedExercise = { name: "Push-Up", pattern: "horizontalPush", sets: 3, reps: "8–12", restSeconds: 90, progression: "" };
const plank: PlannedExercise = { name: "Plank", pattern: "core", sets: 3, reps: "30–45s", restSeconds: 60, progression: "" };
const jacks: PlannedExercise = { name: "Jumping Jacks", pattern: "conditioning", sets: 4, reps: "30s on / 30s off", restSeconds: 30, progression: "" };

let n = 0;
function session(date: string, exercises: ExerciseLog[], feeling?: Feeling, level: SessionLog["level"] = "intermediate"): SessionLog {
  return { id: String(n++), date, weekday: "Mon", dayTitle: "Full Body A", level, feeling, notes: "", exercises };
}

describe("nextTarget", () => {
  it("has no target before the first log", () => {
    expect(nextTarget(squat, [], "kg")).toBeUndefined();
  });

  it("adds weight and resets reps after hitting the top of the range on every set", () => {
    const t = nextTarget(squat, [session("2026-10-01", [{ name: "Back Squat", weight: 60, values: [12, 12, 12] }])], "kg");
    expect(t).toMatchObject({ weight: 65, value: 8, text: "65 kg × 8", why: "up" });
  });

  it("uses smaller steps for upper-body dumbbell work and pounds", () => {
    const t = nextTarget(curl, [session("2026-10-01", [{ name: "Dumbbell Curl", weight: 25, values: [15, 15] }])], "lb");
    expect(t?.text).toBe("30 lb × 10");
  });

  it("keeps the weight and aims for one more rep otherwise", () => {
    const t = nextTarget(squat, [session("2026-10-01", [{ name: "Back Squat", weight: 60, values: [10, 9, 8] }])], "kg");
    expect(t).toMatchObject({ weight: 60, value: 9, why: "repeat" });
  });

  it("backs off 10% after two sessions at the same weight with no more reps", () => {
    const sessions = [
      session("2026-10-01", [{ name: "Back Squat", weight: 100, values: [9, 9, 8] }]),
      session("2026-10-03", [{ name: "Back Squat", weight: 100, values: [9, 8, 8] }]),
    ];
    expect(nextTarget(squat, sessions, "kg")).toMatchObject({ weight: 90, value: 8, why: "backOff" });
  });

  it("suggests a harder version for bodyweight moves at the top of the range", () => {
    const t = nextTarget(pushUp, [session("2026-10-01", [{ name: "Push-Up", values: [12, 12, 12] }])], "kg");
    expect(t).toMatchObject({ why: "harder", value: 12 });
  });

  it("adds time to holds and a round to conditioning", () => {
    expect(nextTarget(plank, [session("2026-10-01", [{ name: "Plank", values: [40, 35, 30] }])], "kg")?.text).toBe("Hold 45s");
    expect(nextTarget(jacks, [session("2026-10-01", [{ name: "Jumping Jacks", values: [5] }])], "kg")?.text).toBe("6 rounds");
  });
});

describe("cyclePosition", () => {
  const weeks = [
    { week: "Week 1", effort: "Easy", detail: "" },
    { week: "Week 2", effort: "Moderate", detail: "" },
    { week: "Week 3", effort: "Hard", detail: "" },
    { week: "Week 4", effort: "Light", detail: "" },
  ];
  const start = [session("2026-10-05", [])];

  it("counts weeks from the first logged session and wraps around", () => {
    expect(cyclePosition(weeks, start, new Date(2026, 9, 5))).toMatchObject({ week: 1, index: 0 });
    expect(cyclePosition(weeks, start, new Date(2026, 9, 20))).toMatchObject({ week: 3, index: 2, lightNext: true });
    expect(cyclePosition(weeks, start, new Date(2026, 10, 2))).toMatchObject({ week: 1, index: 0 });
  });

  it("maps multi-week ranges like 'Weeks 3–8'", () => {
    const beginner = [
      { week: "Weeks 1–2", effort: "Easy", detail: "" },
      { week: "Weeks 3–8", effort: "Moderate", detail: "" },
      { week: "Week 9", effort: "Light", detail: "" },
    ];
    expect(cyclePosition(beginner, start, new Date(2026, 9, 26))).toMatchObject({ week: 4, index: 1, cycleLength: 9 });
  });

  it("is unknown before anything is logged", () => {
    expect(cyclePosition(weeks, [], new Date())).toBeUndefined();
  });
});

describe("suggestions", () => {
  it("suggests moving up after 3 easy sessions at the current level", () => {
    const easy = ["2026-10-01", "2026-10-03", "2026-10-05"].map((d) => session(d, [], "easy"));
    expect(suggestions(easy, "intermediate", [])).toContainEqual(expect.objectContaining({ kind: "levelUp", level: "advanced" }));
    expect(suggestions(easy, "beginner", [])).toEqual([]);
  });

  it("suggests easing off after 2 hard sessions", () => {
    const hard = ["2026-10-01", "2026-10-03"].map((d) => session(d, [], "hard"));
    expect(suggestions(hard, "intermediate", [])[0]?.kind).toBe("ease");
  });

  it("suggests swapping an exercise flagged twice, unless already removed", () => {
    const flagged = ["2026-10-01", "2026-10-03"].map((d) => session(d, [{ name: "Back Squat", values: [8], trouble: true }]));
    expect(suggestions(flagged, "intermediate", [])).toContainEqual(expect.objectContaining({ kind: "swap", exercise: "Back Squat" }));
    expect(suggestions(flagged, "intermediate", ["Back Squat"])).toEqual([]);
  });
});

describe("exerciseSeries", () => {
  it("charts weight when logged, otherwise the best set", () => {
    const sessions = [
      session("2026-10-01", [{ name: "Back Squat", weight: 60, values: [10, 10, 9] }, { name: "Push-Up", values: [8, 10, 9] }]),
      session("2026-10-03", [{ name: "Back Squat", weight: 62.5, values: [10, 10, 10] }]),
    ];
    expect(exerciseSeries("Back Squat", sessions, "kg")).toMatchObject({ measure: "Weight (kg)", points: [{ value: 60 }, { value: 62.5 }] });
    expect(exerciseSeries("Push-Up", sessions, "kg")).toMatchObject({ measure: "Best set", points: [{ value: 10 }] });
  });
});
