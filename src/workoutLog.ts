import type { Level } from "./exercises";

export type Feeling = "easy" | "right" | "hard";
export type Units = "kg" | "lb";

export interface ExerciseLog {
  name: string;
  /** Load used, in the profile's units; absent for bodyweight and band exercises. */
  weight?: number;
  /** Reps (or seconds, or rounds) completed on each set. */
  values: number[];
  /** Flagged as causing pain or form trouble. */
  trouble?: boolean;
}

export interface SessionLog {
  id: string;
  /** Local date as YYYY-MM-DD. */
  date: string;
  weekday: string;
  dayTitle: string;
  /** Level when the session was logged, so suggestions reset after a level change. */
  level: Level;
  feeling?: Feeling;
  notes: string;
  exercises: ExerciseLog[];
}

const STORAGE_KEY = "workout-planner.log.v1";

export function loadSessions(): SessionLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? sortByDate(parsed as SessionLog[]) : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: SessionLog[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Storage unavailable (private mode, blocked site data): the log just won't persist.
  }
}

export function clearSessions(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Oldest first; same-day sessions keep the order they were logged in. */
export function sortByDate(sessions: SessionLog[]): SessionLog[] {
  return [...sessions].sort((a, b) => a.date.localeCompare(b.date));
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function toLocalDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
