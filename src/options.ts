import type { Equipment, Level, Limitation } from "./exercises";
import type { Focus, Goal } from "./planner";

export interface Option<T> {
  value: T;
  label: string;
  hint?: string;
}

export const GOALS: Option<Goal>[] = [
  { value: "strength", label: "Get stronger", hint: "Heavy, low-rep work with long rests" },
  { value: "hypertrophy", label: "Build muscle", hint: "Moderate weights, more volume" },
  { value: "endurance", label: "Improve endurance", hint: "Higher reps, short rests, conditioning" },
  { value: "general", label: "General fitness", hint: "A balanced mix of everything" },
];

export const LEVELS: Option<Level>[] = [
  { value: "beginner", label: "Under 6 months", hint: "New to training, or coming back after a long break" },
  { value: "intermediate", label: "6 months – 2 years", hint: "Comfortable with the main lifts" },
  { value: "advanced", label: "2+ years", hint: "Consistent training with steady progress" },
];

export const EQUIPMENT: Option<Equipment>[] = [
  { value: "dumbbells", label: "Dumbbells" },
  { value: "barbell", label: "Barbell & rack" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "machines", label: "Gym machines / cables" },
  { value: "bands", label: "Resistance bands" },
  { value: "pullupBar", label: "Pull-up bar" },
];

export const EQUIPMENT_PRESETS: { label: string; equipment: Equipment[] }[] = [
  { label: "Bodyweight only", equipment: [] },
  { label: "Home setup", equipment: ["dumbbells", "bands", "pullupBar"] },
  { label: "Full gym", equipment: ["dumbbells", "barbell", "kettlebell", "machines", "bands", "pullupBar"] },
];

export const LIMITATIONS: Option<Limitation>[] = [
  { value: "knees", label: "Knees" },
  { value: "lowerBack", label: "Lower back" },
  { value: "shoulders", label: "Shoulders" },
  { value: "wrists", label: "Wrists" },
];

export const FOCUS_AREAS: Option<Focus>[] = [
  { value: "arms", label: "Arms" },
  { value: "shoulders", label: "Shoulders" },
  { value: "glutes", label: "Glutes & hamstrings" },
  { value: "core", label: "Core" },
];

export const SESSION_LENGTHS = [30, 45, 60, 75, 90];

export function labelOf<T>(options: Option<T>[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? String(value);
}

export function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
