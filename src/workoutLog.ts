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
  /** Minutes from starting to finishing the workout in the app. */
  durationMin?: number;
}

/** A workout in progress, saved on every change so leaving the app doesn't lose it. */
export interface Draft {
  weekday: string;
  dayTitle: string;
  startedAt: number;
  entries: DraftEntry[];
}

export interface DraftEntry {
  /** The exercise this entry belongs to, so a resumed workout matches entries by name. */
  name: string;
  weight: string;
  sets: { value: string; done: boolean }[];
  trouble: boolean;
}

/**
 * Lines up a saved workout's entries with today's exercises by name. An exercise that was
 * swapped out, or whose set count changed, gets undefined (start it fresh). Entries saved
 * before names were recorded can't be matched safely, so they're all dropped.
 */
export function matchDraftEntries(draft: Draft, exercises: { name: string; sets: number }[]): (DraftEntry | undefined)[] {
  return exercises.map((ex) => draft.entries.find((e) => e.name === ex.name && e.sets.length === ex.sets));
}

const STORAGE_KEY = "workout-planner.log.v1";
const DRAFT_KEY = "workout-planner.draft.v1";

export function loadDraft(): Draft | undefined {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : undefined;
    return parsed && typeof parsed === "object" && "entries" in parsed ? (parsed as Draft) : undefined;
  } catch {
    return undefined;
  }
}

export function saveDraft(draft: Draft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // The draft just won't survive leaving the app.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}

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
