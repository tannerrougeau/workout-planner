import { EXERCISES } from "./exercises";
import type { PlannedExercise } from "./planner";
import type { ExerciseLog, Units } from "./workoutLog";

const LB_PER_KG = 2.20462;
const BY_NAME = new Map(EXERCISES.map((e) => [e.name, e]));

export function toUnit(weight: number, from: Units, to: Units): number {
  if (from === to) return weight;
  return to === "lb" ? weight * LB_PER_KG : weight / LB_PER_KG;
}

/**
 * A logged weight in the display units. Entries without a unit predate unit tagging
 * (the startup migration tags them), so they're read as already being in `units`.
 */
export function weightIn(log: Pick<ExerciseLog, "weight" | "unit">, units: Units): number | undefined {
  return log.weight === undefined ? undefined : toUnit(log.weight, log.unit ?? units, units);
}

/** At most one decimal, without trailing zeros: 220.46 → 220.5, 60 → 60. */
export function oneDecimal(w: number): number {
  return Number(w.toFixed(1));
}

/** The smallest jump in load you can actually set up: plates for barbells and machines, the next bell for dumbbells and kettlebells. */
export function loadIncrement(ex: Pick<PlannedExercise, "name">, units: Units): number {
  const equipment = BY_NAME.get(ex.name)?.equipment ?? [];
  if (equipment.includes("kettlebell")) return units === "kg" ? 4 : 5;
  if (equipment.includes("dumbbells")) return units === "kg" ? 2 : 5;
  return units === "kg" ? 2.5 : 5;
}

export function roundToLoadable(weight: number, ex: Pick<PlannedExercise, "name">, units: Units): number {
  const inc = loadIncrement(ex, units);
  return Math.max(inc, Math.round(weight / inc) * inc);
}
