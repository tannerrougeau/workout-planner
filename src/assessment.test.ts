import { describe, expect, it } from "vitest";
import { assessLevel, isAssessmentComplete, type AssessmentAnswers } from "./assessment";

const ALL_LIFTS: AssessmentAnswers["lifts"] = ["squat", "deadlift", "bench", "overheadPress", "pullUp"];

describe("assessLevel", () => {
  it("assigns beginner to someone just starting", () => {
    expect(assessLevel({ trainingTime: "none", pushUps: "0-5", lifts: [], progress: "notLifting" }).level).toBe("beginner");
  });

  it("assigns intermediate to a steady lifter of about a year", () => {
    expect(
      assessLevel({ trainingTime: "6mto2y", pushUps: "16-30", lifts: ["squat", "deadlift", "bench", "pullUp"], progress: "weekly" }).level,
    ).toBe("intermediate");
  });

  it("assigns advanced to an experienced lifter who has plateaued", () => {
    expect(assessLevel({ trainingTime: "over2y", pushUps: "30+", lifts: ALL_LIFTS, progress: "stalled" }).level).toBe("advanced");
  });

  it("keeps anyone still progressing every session on a beginner plan", () => {
    const result = assessLevel({ trainingTime: "over2y", pushUps: "30+", lifts: ALL_LIFTS, progress: "everySession" });
    expect(result.level).toBe("beginner");
    expect(result.reason).toMatch(/every session/);
  });

  it("requires 2+ years of training for advanced", () => {
    expect(assessLevel({ trainingTime: "6mto2y", pushUps: "30+", lifts: ALL_LIFTS, progress: "stalled" }).level).toBe("intermediate");
    expect(assessLevel({ trainingTime: "under6m", pushUps: "30+", lifts: ALL_LIFTS, progress: "stalled" }).level).toBe("intermediate");
  });

  it("is complete only once every single-choice question is answered", () => {
    expect(isAssessmentComplete({ lifts: [] })).toBe(false);
    expect(isAssessmentComplete({ trainingTime: "none", pushUps: "0-5", lifts: [], progress: "notLifting" })).toBe(true);
  });
});
