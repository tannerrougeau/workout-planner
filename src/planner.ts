import { EXERCISES, LEVEL_RANK, type Equipment, type Exercise, type Level, type Limitation, type Pattern } from "./exercises";

export type Goal = "strength" | "hypertrophy" | "endurance" | "general";

export type Focus = "arms" | "shoulders" | "glutes" | "core";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface PlanInput {
  goal: Goal;
  level: Level;
  /** 2–6 training days per week. */
  daysPerWeek: number;
  /** Total session length including warm-up and cool-down. */
  sessionMinutes: number;
  equipment: Equipment[];
  /** Days the user can train; overrides daysPerWeek and the default weekday layout when given. */
  weekdays?: Weekday[];
  /** Exercises that load these joints are left out. */
  limitations?: Limitation[];
  /** Muscle groups that get an extra accessory slot each day. */
  focus?: Focus[];
  /** Exercise names the user never wants to see. */
  excluded?: string[];
}

export interface PlannedExercise {
  name: string;
  pattern: Pattern;
  sets: number;
  /** e.g. "6–10" or "30–45s". */
  reps: string;
  restSeconds: number;
  /** What to change next time once this exercise feels manageable. */
  progression: string;
}

export interface ProgressionWeek {
  week: string;
  /** Target effort in plain words, e.g. "Easy" or "Light". */
  effort: string;
  detail: string;
}

export interface ProgressionGuide {
  summary: string;
  weeks: ProgressionWeek[];
  goalTip: string;
  backOff: string[];
  /** When to move up an experience level; absent for advanced lifters. */
  levelUp?: string;
}

export interface WorkoutDay {
  weekday: string;
  title: string;
  exercises: PlannedExercise[];
  estimatedMinutes: number;
}

export interface WorkoutPlan {
  input: PlanInput;
  splitName: string;
  days: WorkoutDay[];
  warmUp: string;
  coolDown: string;
  progression: ProgressionGuide;
}

type DayTemplate = { title: string; slots: Pattern[] };

const FULL_A: DayTemplate = { title: "Full Body A", slots: ["squat", "horizontalPush", "horizontalPull", "hinge", "verticalPush", "core", "biceps"] };
const FULL_B: DayTemplate = { title: "Full Body B", slots: ["hinge", "verticalPush", "verticalPull", "lunge", "horizontalPush", "core", "triceps"] };
const FULL_C: DayTemplate = { title: "Full Body C", slots: ["lunge", "horizontalPush", "verticalPull", "hinge", "horizontalPull", "core", "calves"] };
const UPPER: DayTemplate = { title: "Upper Body", slots: ["horizontalPush", "horizontalPull", "verticalPush", "verticalPull", "biceps", "triceps", "core"] };
const LOWER: DayTemplate = { title: "Lower Body", slots: ["squat", "hinge", "lunge", "calves", "core"] };
const PUSH: DayTemplate = { title: "Push", slots: ["horizontalPush", "verticalPush", "horizontalPush", "triceps", "triceps", "core"] };
const PULL: DayTemplate = { title: "Pull", slots: ["verticalPull", "horizontalPull", "horizontalPull", "verticalPull", "biceps", "core"] };
const LEGS: DayTemplate = { title: "Legs", slots: ["squat", "hinge", "lunge", "hinge", "calves", "core"] };

const SPLITS: Record<number, { name: string; days: DayTemplate[]; weekdays: string[] }> = {
  2: { name: "Full Body", days: [FULL_A, FULL_B], weekdays: ["Mon", "Thu"] },
  3: { name: "Full Body", days: [FULL_A, FULL_B, FULL_C], weekdays: ["Mon", "Wed", "Fri"] },
  4: { name: "Upper / Lower", days: [UPPER, LOWER, UPPER, LOWER], weekdays: ["Mon", "Tue", "Thu", "Fri"] },
  5: { name: "Upper / Lower + Push / Pull / Legs", days: [UPPER, LOWER, PUSH, PULL, LEGS], weekdays: ["Mon", "Tue", "Wed", "Fri", "Sat"] },
  6: { name: "Push / Pull / Legs ×2", days: [PUSH, PULL, LEGS, PUSH, PULL, LEGS], weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
};

const FOCUS_SLOTS: Record<Focus, Pattern[]> = {
  arms: ["biceps", "triceps"],
  shoulders: ["verticalPush"],
  glutes: ["hinge"],
  core: ["core"],
};

const ACCESSORY_PATTERNS: ReadonlySet<Pattern> = new Set(["biceps", "triceps", "core", "calves"]);

interface Prescription {
  sets: number;
  reps: string;
  restSeconds: number;
}

const PRESCRIPTIONS: Record<Goal, { compound: Prescription; accessory: Prescription }> = {
  strength: { compound: { sets: 5, reps: "3–5", restSeconds: 180 }, accessory: { sets: 3, reps: "8–10", restSeconds: 60 } },
  hypertrophy: { compound: { sets: 4, reps: "6–10", restSeconds: 120 }, accessory: { sets: 3, reps: "10–15", restSeconds: 60 } },
  endurance: { compound: { sets: 3, reps: "12–15", restSeconds: 45 }, accessory: { sets: 2, reps: "15–20", restSeconds: 30 } },
  general: { compound: { sets: 3, reps: "8–12", restSeconds: 90 }, accessory: { sets: 2, reps: "10–15", restSeconds: 60 } },
};

const WARM_UP_MINUTES = 5;
const COOL_DOWN_MINUTES = 5;
const WORK_SECONDS_PER_SET = 40;
const TRANSITION_SECONDS = 60;
const MIN_EXERCISES_PER_DAY = 3;

function prescribe(exercise: Exercise, goal: Goal, level: Level): Prescription {
  if (exercise.pattern === "conditioning") {
    return { sets: level === "beginner" ? 4 : 6, reps: "30s on / 30s off", restSeconds: 30 };
  }
  const base = ACCESSORY_PATTERNS.has(exercise.pattern) ? PRESCRIPTIONS[goal].accessory : PRESCRIPTIONS[goal].compound;
  const sets = level === "beginner" ? Math.min(base.sets, 3) : base.sets;
  const reps = exercise.timed ? "30–45s" : base.reps;
  return { ...base, sets, reps };
}

function exerciseSeconds(p: Prescription): number {
  return p.sets * (WORK_SECONDS_PER_SET + p.restSeconds) + TRANSITION_SECONDS;
}

function candidatesFor(pattern: Pattern, input: PlanInput): Exercise[] {
  const available = new Set<Equipment>([...input.equipment, "bodyweight"]);
  const limitations = new Set(input.limitations ?? []);
  const excluded = new Set(input.excluded ?? []);
  return EXERCISES.filter(
    (e) =>
      e.pattern === pattern &&
      LEVEL_RANK[e.minLevel] <= LEVEL_RANK[input.level] &&
      e.equipment.every((q) => available.has(q)) &&
      !(e.stresses ?? []).some((l) => limitations.has(l)) &&
      !excluded.has(e.name),
  ).sort((a, b) => isLoaded(b) - isLoaded(a) || LEVEL_RANK[b.minLevel] - LEVEL_RANK[a.minLevel]);
}

/** 1 if the exercise needs equipment, so loaded options are preferred over floor bodyweight ones. */
function isLoaded(e: Exercise): number {
  return e.equipment.some((q) => q !== "bodyweight") ? 1 : 0;
}

export function generatePlan(input: PlanInput): WorkoutPlan {
  const chosenDays = input.weekdays?.length
    ? WEEKDAYS.filter((d) => input.weekdays!.includes(d)).slice(0, 6)
    : undefined;
  const daysPerWeek = Math.min(6, Math.max(2, Math.round(chosenDays?.length ?? input.daysPerWeek)));
  const split = SPLITS[daysPerWeek];
  // Fewer than 2 chosen days can't hold the minimum split, so fall back to its default layout.
  const weekdays: string[] = chosenDays && chosenDays.length >= 2 ? chosenDays : split.weekdays;
  const focusSlots = (input.focus ?? []).flatMap((f) => FOCUS_SLOTS[f]);
  const budgetSeconds = (input.sessionMinutes - WARM_UP_MINUTES - COOL_DOWN_MINUTES) * 60;
  // How many times each pattern has been used this week, so repeated days rotate exercises.
  const patternUses = new Map<Pattern, number>();

  const days = split.days.map((template, i): WorkoutDay => {
    const slots: Pattern[] = [...template.slots, ...focusSlots];
    if (input.goal === "endurance" || input.goal === "general") slots.push("conditioning");

    const exercises: PlannedExercise[] = [];
    const usedToday = new Set<string>();
    let seconds = 0;

    for (const pattern of slots) {
      const candidates = candidatesFor(pattern, input).filter((e) => !usedToday.has(e.name));
      if (candidates.length === 0) continue;

      const uses = patternUses.get(pattern) ?? 0;
      const exercise = candidates[uses % candidates.length];
      const p = prescribe(exercise, input.goal, input.level);
      const cost = exerciseSeconds(p);
      if (exercises.length >= MIN_EXERCISES_PER_DAY && seconds + cost > budgetSeconds) continue;

      patternUses.set(pattern, uses + 1);
      usedToday.add(exercise.name);
      seconds += cost;
      exercises.push({ name: exercise.name, pattern, ...p, progression: exerciseProgression(exercise, p) });
    }

    return {
      weekday: weekdays[i],
      title: template.title,
      exercises,
      estimatedMinutes: Math.round(seconds / 60) + WARM_UP_MINUTES + COOL_DOWN_MINUTES,
    };
  });

  return {
    input: { ...input, daysPerWeek },
    splitName: split.name,
    days,
    warmUp: `${WARM_UP_MINUTES} min: light cardio, then dynamic mobility (leg swings, arm circles, hip openers) and 1–2 light sets of the first exercise.`,
    coolDown: `${COOL_DOWN_MINUTES} min: easy walk, then static stretches for the muscles trained, 20–30s each.`,
    progression: progressionGuide(input.goal, input.level),
  };
}

const LOWER_BODY_PATTERNS: ReadonlySet<Pattern> = new Set(["squat", "hinge", "lunge", "calves"]);

/** The next step for one exercise: double progression for loaded lifts, harder variations for bodyweight. */
function exerciseProgression(exercise: Exercise, p: Prescription): string {
  if (exercise.pattern === "conditioning") return "Add a round each week.";
  if (exercise.timed) return "Hold 5s longer each week.";

  const top = p.reps.split("–")[1];
  const target = `Hit ${top} reps on every set?`;
  const has = (q: Equipment) => exercise.equipment.includes(q);

  if (has("barbell") || has("machines")) {
    const step = LOWER_BODY_PATTERNS.has(exercise.pattern) && !ACCESSORY_PATTERNS.has(exercise.pattern) ? "5 kg / 10 lb" : "2.5 kg / 5 lb";
    return `${target} Add ${step}.`;
  }
  if (has("dumbbells")) return `${target} Go up one dumbbell.`;
  if (has("kettlebell")) return `${target} Use a heavier bell.`;
  if (has("bands")) return `${target} Use a heavier band.`;
  return `${target} Try a harder version.`;
}

const BLOCKS: Record<Level, { summary: string; weeks: ProgressionWeek[] }> = {
  beginner: {
    summary: "Add a little weight or one rep most sessions.",
    weeks: [
      { week: "Weeks 1–2", effort: "Easy", detail: "Learn the moves with light weights." },
      { week: "Weeks 3–8", effort: "Moderate", detail: "Add a little weight or a rep each session." },
      { week: "Week 9", effort: "Light", detail: "Do half the sets, then start again a bit heavier." },
    ],
  },
  intermediate: {
    summary: "Repeat a 4-week cycle, starting a bit heavier each time.",
    weeks: [
      { week: "Week 1", effort: "Easy", detail: "Set your weights." },
      { week: "Week 2", effort: "Moderate", detail: "Add a rep or a little weight." },
      { week: "Week 3", effort: "Hard", detail: "Beat last week." },
      { week: "Week 4", effort: "Light", detail: "Do half the sets to recover." },
    ],
  },
  advanced: {
    summary: "Repeat a 4-week cycle: more sets, then heavier, then recover.",
    weeks: [
      { week: "Week 1", effort: "Moderate", detail: "Add a set to your first two exercises." },
      { week: "Week 2", effort: "Moderate", detail: "Keep the extra set and add weight or reps." },
      { week: "Week 3", effort: "Hard", detail: "Drop the extra set and go heavy." },
      { week: "Week 4", effort: "Light", detail: "Do about half your usual sets." },
    ],
  },
};

const GOAL_TIPS: Record<Goal, string> = {
  strength: "Add weight to your first two lifts before anything else.",
  hypertrophy: "Push your last few exercises close to failure.",
  endurance: "Cut your rest by 5–10s every couple of weeks.",
  general: "Swap in new exercises every 4–6 weeks.",
};

const BACK_OFF = [
  "Stuck for 2 sessions? Drop the weight 10% and build back up.",
  "Joint pain? Swap the exercise with ⇄.",
  "Tired or missed a week? Repeat last week.",
];

const LEVEL_UP: Partial<Record<Level, string>> = {
  beginner: "Can't add weight each session anymore? Switch to Intermediate.",
  intermediate: "No progress over a couple of cycles? Switch to Advanced.",
};

function progressionGuide(goal: Goal, level: Level): ProgressionGuide {
  return { ...BLOCKS[level], goalTip: GOAL_TIPS[goal], backOff: BACK_OFF, levelUp: LEVEL_UP[level] };
}
