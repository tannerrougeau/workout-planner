import type { Level } from "./exercises";
import type { Option } from "./options";

export type TrainingTime = "none" | "under6m" | "6mto2y" | "over2y";
export type PushUps = "0-5" | "6-15" | "16-30" | "30+";
export type Lift = "squat" | "deadlift" | "bench" | "overheadPress" | "pullUp";
export type ProgressRate = "notLifting" | "everySession" | "weekly" | "stalled";

export interface AssessmentAnswers {
  trainingTime?: TrainingTime;
  pushUps?: PushUps;
  lifts: Lift[];
  progress?: ProgressRate;
}

export const EMPTY_ASSESSMENT: AssessmentAnswers = { lifts: [] };

export const TRAINING_TIME: Option<TrainingTime>[] = [
  { value: "none", label: "I'm just starting" },
  { value: "under6m", label: "Less than 6 months" },
  { value: "6mto2y", label: "6 months to 2 years" },
  { value: "over2y", label: "More than 2 years" },
];

export const PUSH_UPS: Option<PushUps>[] = [
  { value: "0-5", label: "0–5" },
  { value: "6-15", label: "6–15" },
  { value: "16-30", label: "16–30" },
  { value: "30+", label: "More than 30" },
];

export const LIFTS: Option<Lift>[] = [
  { value: "squat", label: "Squat" },
  { value: "deadlift", label: "Deadlift" },
  { value: "bench", label: "Bench press" },
  { value: "overheadPress", label: "Overhead press" },
  { value: "pullUp", label: "Pull-up" },
];

export const PROGRESS_RATES: Option<ProgressRate>[] = [
  { value: "notLifting", label: "I don't lift weights yet" },
  { value: "everySession", label: "Almost every session", hint: "Weights still go up each workout" },
  { value: "weekly", label: "Every week or two", hint: "Progress comes, but more slowly" },
  { value: "stalled", label: "Rarely", hint: "Gains take months or a planned program" },
];

const TIME_POINTS: Record<TrainingTime, number> = { none: 0, under6m: 1, "6mto2y": 3, over2y: 5 };
const PUSH_UP_POINTS: Record<PushUps, number> = { "0-5": 0, "6-15": 1, "16-30": 2, "30+": 3 };
const PROGRESS_POINTS: Record<ProgressRate, number> = { notLifting: 0, everySession: 0, weekly: 2, stalled: 3 };

export function isAssessmentComplete(a: AssessmentAnswers): boolean {
  return a.trainingTime !== undefined && a.pushUps !== undefined && a.progress !== undefined;
}

export interface Assessment {
  level: Level;
  reason: string;
}

/**
 * Scores training history, a push-up test, lift familiarity and how fast the user still progresses
 * (0–13 points), then applies guards so a high score can't skip the basics.
 */
export function assessLevel(a: AssessmentAnswers): Assessment {
  const time = a.trainingTime ?? "none";
  const progress = a.progress ?? "notLifting";
  const liftPoints = a.lifts.length >= 4 ? 2 : a.lifts.length >= 2 ? 1 : 0;
  const score = TIME_POINTS[time] + PUSH_UP_POINTS[a.pushUps ?? "0-5"] + liftPoints + PROGRESS_POINTS[progress];
  const scored: Level = score >= 10 ? "advanced" : score >= 5 ? "intermediate" : "beginner";

  if (progress === "everySession" && scored !== "beginner") {
    return { level: "beginner", reason: "You're still adding weight almost every session, so a beginner plan will move you fastest." };
  }
  if ((time === "none" || time === "under6m") && scored === "advanced") {
    return { level: "intermediate", reason: "You're strong for your training age, but with under 6 months in, intermediate is the right place to start." };
  }
  if (time !== "over2y" && scored === "advanced") {
    return { level: "intermediate", reason: "Advanced plans assume 2+ years of consistent training, so you'll start at intermediate." };
  }

  const reasons: Record<Level, string> = {
    beginner: "We'll focus on learning the movements and building a base, adding a little almost every session.",
    intermediate: "You have a solid base, so you'll progress week to week in 4-week waves.",
    advanced: "Your training history and strength support block-based programming.",
  };
  return { level: scored, reason: reasons[scored] };
}
