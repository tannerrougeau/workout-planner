import { EXERCISES, type Level } from "./exercises";
import type { PlannedExercise, ProgressionWeek } from "./planner";
import { fromLocalDate, type ExerciseLog, type SessionLog, type Units } from "./workoutLog";

const BY_NAME = new Map(EXERCISES.map((e) => [e.name, e]));
const LOWER_COMPOUND = new Set(["squat", "hinge", "lunge"]);
const NEXT_LEVEL: Partial<Record<Level, Level>> = { beginner: "intermediate", intermediate: "advanced" };
const DAY_MS = 24 * 60 * 60 * 1000;

/** What gets logged per set: reps for most exercises, seconds for holds, rounds for conditioning. */
export type Measure = "reps" | "seconds" | "rounds";

export function measureOf(ex: PlannedExercise): Measure {
  if (ex.pattern === "conditioning") return "rounds";
  return BY_NAME.get(ex.name)?.timed ? "seconds" : "reps";
}

/** Sets to log: conditioning is logged as one total of rounds. */
export function setsToLog(ex: PlannedExercise): number {
  return measureOf(ex) === "rounds" ? 1 : ex.sets;
}

/** Whether the exercise takes an external load worth recording. */
export function takesWeight(ex: PlannedExercise): boolean {
  const equipment = BY_NAME.get(ex.name)?.equipment ?? [];
  return ex.pattern !== "conditioning" && equipment.some((q) => q === "barbell" || q === "machines" || q === "dumbbells" || q === "kettlebell");
}

export function weightStep(ex: PlannedExercise, units: Units): number {
  const equipment = BY_NAME.get(ex.name)?.equipment ?? [];
  const kg = units === "kg";
  if (equipment.includes("kettlebell")) return kg ? 4 : 10;
  if (equipment.includes("dumbbells")) return kg ? 2 : 5;
  return LOWER_COMPOUND.has(ex.pattern) ? (kg ? 5 : 10) : kg ? 2.5 : 5;
}

function repRange(reps: string): { bottom: number; top: number } | undefined {
  const m = /^(\d+)–(\d+)/.exec(reps);
  return m ? { bottom: Number(m[1]), top: Number(m[2]) } : undefined;
}

export function formatWeight(w: number, units: Units): string {
  return `${Number(w.toFixed(1))} ${units}`;
}

/** Most recent logs of an exercise that recorded at least one set, newest first. */
export function recentLogs(name: string, sessions: SessionLog[], count: number): ExerciseLog[] {
  const logs: ExerciseLog[] = [];
  for (let i = sessions.length - 1; i >= 0 && logs.length < count; i--) {
    const log = sessions[i].exercises.find((e) => e.name === name && e.values.length > 0);
    if (log) logs.push(log);
  }
  return logs;
}

export interface Target {
  weight?: number;
  /** Reps, seconds or rounds to aim for on each set. */
  value: number;
  /** e.g. "40 kg × 8" or "Hold 50s". */
  text: string;
  why: "up" | "repeat" | "backOff" | "harder";
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** The next session's target for one exercise, from its last one or two logs. */
export function nextTarget(ex: PlannedExercise, sessions: SessionLog[], units: Units): Target | undefined {
  const [last, prev] = recentLogs(ex.name, sessions, 2);
  if (!last) return undefined;

  const measure = measureOf(ex);
  if (measure === "rounds") {
    const value = Math.max(...last.values) + 1;
    return { value, text: `${value} rounds`, why: "up" };
  }
  if (measure === "seconds") {
    const value = Math.max(...last.values) + 5;
    return { value, text: `Hold ${value}s`, why: "up" };
  }

  const range = repRange(ex.reps);
  if (!range) return undefined;
  const weight = takesWeight(ex) ? last.weight : undefined;
  const step = weightStep(ex, units);
  const withWeight = (w: number | undefined, reps: number) => (w ? `${formatWeight(w, units)} × ${reps}` : `${reps} reps`);

  const hitTop = last.values.length >= ex.sets && last.values.every((v) => v >= range.top);
  if (hitTop) {
    if (weight) return { weight: weight + step, value: range.bottom, text: withWeight(weight + step, range.bottom), why: "up" };
    return { value: range.top, text: `${range.top} reps, harder version`, why: "harder" };
  }

  // Stuck: same load as the time before and no more total reps.
  const stalled = prev !== undefined && prev.weight === last.weight && sum(last.values) <= sum(prev.values);
  if (stalled && weight) {
    const lighter = Math.max(step, Math.round((weight * 0.9) / step) * step);
    return { weight: lighter, value: range.bottom, text: withWeight(lighter, range.bottom), why: "backOff" };
  }

  const value = Math.min(range.top, Math.max(range.bottom, Math.min(...last.values) + 1));
  return { weight, value, text: withWeight(weight, value), why: "repeat" };
}

export interface CyclePosition {
  /** Index into the plan's progression weeks. */
  index: number;
  /** 1-based week within the cycle. */
  week: number;
  cycleLength: number;
  /** Whether next week is a lighter recovery week. */
  lightNext: boolean;
}

/** Week ranges from labels like "Weeks 3–8" or "Week 4". */
function weekRanges(weeks: ProgressionWeek[]): [number, number][] {
  return weeks.map((w) => {
    const nums = (w.week.match(/\d+/g) ?? ["1"]).map(Number);
    return [nums[0], nums[nums.length - 1]];
  });
}

/** Where today falls in the progression cycle, counted from the first logged session. */
export function cyclePosition(weeks: ProgressionWeek[], sessions: SessionLog[], today: Date): CyclePosition | undefined {
  if (sessions.length === 0 || weeks.length === 0) return undefined;
  const ranges = weekRanges(weeks);
  const cycleLength = ranges[ranges.length - 1][1];
  const start = fromLocalDate(sessions[0].date);
  const elapsedWeeks = Math.max(0, Math.floor((today.getTime() - start.getTime()) / (7 * DAY_MS)));
  const weekAt = (n: number) => (n % cycleLength) + 1;
  const indexOf = (week: number) => ranges.findIndex(([a, b]) => week >= a && week <= b);

  const week = weekAt(elapsedWeeks);
  const index = indexOf(week);
  const nextIndex = indexOf(weekAt(elapsedWeeks + 1));
  return { index, week, cycleLength, lightNext: nextIndex !== index && weeks[nextIndex]?.effort === "Light" };
}

export type Suggestion =
  | { kind: "levelUp"; level: Level; text: string }
  | { kind: "ease"; text: string }
  | { kind: "faster"; text: string }
  | { kind: "swap"; exercise: string; text: string };

/** Suggestions from recent how-it-felt ratings and trouble flags. */
export function suggestions(sessions: SessionLog[], level: Level, excluded: string[]): Suggestion[] {
  const out: Suggestion[] = [];
  const rated = sessions.filter((s) => s.level === level && s.feeling).slice(-3);

  if (rated.length === 3 && rated.every((s) => s.feeling === "easy")) {
    const next = NEXT_LEVEL[level];
    out.push(
      next
        ? { kind: "levelUp", level: next, text: `Your last 3 workouts felt too easy. Ready to move up to ${next}?` }
        : { kind: "faster", text: "Your last 3 workouts felt too easy. Add weight a little faster than the targets suggest." },
    );
  } else if (rated.length >= 2 && rated.slice(-2).every((s) => s.feeling === "hard")) {
    out.push({ kind: "ease", text: "Your last 2 workouts felt too hard. Repeat your current weights and drop the last set of each exercise until it feels right." });
  }

  const flags = new Map<string, number>();
  for (const s of sessions.slice(-6)) {
    for (const e of s.exercises) if (e.trouble) flags.set(e.name, (flags.get(e.name) ?? 0) + 1);
  }
  for (const [exercise, count] of flags) {
    if (count >= 2 && !excluded.includes(exercise)) {
      out.push({ kind: "swap", exercise, text: `${exercise} gave you trouble ${count} times recently. Swap it for something else?` });
    }
  }
  return out;
}

export interface SeriesPoint {
  date: string;
  /** Weight if the exercise was logged with one, otherwise the best set. */
  value: number;
  detail: string;
}

/** One point per session for charting an exercise over time. */
export function exerciseSeries(name: string, sessions: SessionLog[], units: Units): { points: SeriesPoint[]; measure: string } {
  const logs = sessions.flatMap((s) => {
    const e = s.exercises.find((x) => x.name === name && x.values.length > 0);
    return e ? [{ date: s.date, e }] : [];
  });
  const byWeight = logs.some(({ e }) => e.weight !== undefined);
  return {
    measure: byWeight ? `Weight (${units})` : "Best set",
    points: logs
      .filter(({ e }) => !byWeight || e.weight !== undefined)
      .map(({ date, e }) => ({
        date,
        value: byWeight ? e.weight! : Math.max(...e.values),
        detail: `${e.weight !== undefined ? `${formatWeight(e.weight, units)} × ` : ""}${e.values.join(", ")}`,
      })),
  };
}
