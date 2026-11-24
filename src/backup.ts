import { DEFAULT_PROFILE, clearProfile, loadProfile, saveProfile, type UserProfile } from "./profile";
import { clearDraft, loadDraft, loadSessions, migrateUnits, saveDraft, saveSessions, sortByDate, toLocalDate, type Draft, type SessionLog } from "./workoutLog";

export const BACKUP_FORMAT = 1;
const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_DAYS = 14;
const REMINDER_MIN_WORKOUTS = 5;
const UNDO_DAYS = 7;

const STATE_KEY = "workout-planner.backup.v1";
const PRERESTORE_KEY = "workout-planner.prerestore.v1";

export interface Backup {
  app: "workout-planner";
  format: number;
  appVersion: string;
  /** ISO timestamp. */
  exportedAt: string;
  profile: UserProfile;
  sessions: SessionLog[];
  draft: Draft | null;
}

export interface AppData {
  profile: UserProfile | null;
  sessions: SessionLog[];
  draft: Draft | undefined;
}

export function createBackup(data: { profile: UserProfile; sessions: SessionLog[]; draft?: Draft }, now: Date, appVersion = __APP_VERSION__): Backup {
  return {
    app: "workout-planner",
    format: BACKUP_FORMAT,
    appVersion,
    exportedAt: now.toISOString(),
    profile: data.profile,
    sessions: data.sessions,
    draft: data.draft ?? null,
  };
}

export function backupFileName(now: Date): string {
  return `workout-planner-backup-${toLocalDate(now)}.json`;
}

// ---- Validation -------------------------------------------------------------------------------

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isUnit = (x: unknown) => x === "kg" || x === "lb";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validExercise(e: unknown): boolean {
  return (
    isObject(e) &&
    typeof e.name === "string" &&
    Array.isArray(e.values) &&
    e.values.every(isNum) &&
    (e.weight === undefined || isNum(e.weight)) &&
    (e.unit === undefined || isUnit(e.unit))
  );
}

function validSession(s: unknown): boolean {
  return isObject(s) && typeof s.id === "string" && typeof s.date === "string" && DATE_RE.test(s.date) && Array.isArray(s.exercises) && s.exercises.every(validExercise);
}

function validDraft(d: unknown): boolean {
  return d === null || d === undefined || (isObject(d) && typeof d.weekday === "string" && Array.isArray(d.entries));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "42 workouts, Oct 1 – Nov 20", with years when the range crosses one. */
export function summarize(backup: Pick<Backup, "sessions" | "draft">): string {
  const dates = backup.sessions.map((s) => s.date).sort();
  const n = dates.length;
  const fmt = (d: string, withYear: boolean) => {
    const [y, m, day] = d.split("-").map(Number);
    return `${MONTHS[m - 1]} ${day}${withYear ? `, ${y}` : ""}`;
  };
  let text = n === 0 ? "No workouts" : `${n} workout${n === 1 ? "" : "s"}`;
  if (n > 0) {
    const first = dates[0];
    const last = dates[n - 1];
    const years = first.slice(0, 4) !== last.slice(0, 4);
    text += first === last ? `, ${fmt(first, false)}` : `, ${fmt(first, years)} – ${fmt(last, years)}`;
  }
  if (backup.draft) text += ", plus a workout in progress";
  return text;
}

export type ParseResult = { ok: true; backup: Backup; summary: string } | { ok: false; error: string };

export function parseBackup(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't a backup: it couldn't be read as JSON." };
  }
  if (!isObject(data) || data.app !== "workout-planner") return { ok: false, error: "This file isn't a Workout Planner backup." };
  if (!isNum(data.format) || data.format > BACKUP_FORMAT) {
    return { ok: false, error: "This backup was made by a newer version of the app. Update the app and try again." };
  }
  const p = data.profile;
  if (!isObject(p) || typeof p.goal !== "string" || typeof p.level !== "string" || !isUnit(p.units)) {
    return { ok: false, error: "The backup's profile is missing or damaged." };
  }
  if (!Array.isArray(data.sessions)) return { ok: false, error: "The backup's workout log is missing." };
  const bad = data.sessions.findIndex((s) => !validSession(s));
  if (bad >= 0) return { ok: false, error: `Workout ${bad + 1} in the backup is damaged.` };
  if (!validDraft(data.draft)) return { ok: false, error: "The backup's workout in progress is damaged." };

  const backup = data as unknown as Backup;
  return { ok: true, backup, summary: summarize(backup) };
}

// ---- Restore and undo -------------------------------------------------------------------------

interface Snapshot extends AppData {
  savedAt: number;
}

export function loadAppData(): AppData {
  return { profile: loadProfile(), sessions: loadSessions(), draft: loadDraft() };
}

function writeAppData(data: AppData): void {
  if (data.profile) saveProfile(data.profile);
  else clearProfile();
  saveSessions(sortByDate(data.sessions));
  if (data.draft) saveDraft(data.draft);
  else clearDraft();
}

/**
 * Replaces the current data with a backup's, keeping the current data for "Undo restore".
 * Weights in older backups without units are tagged with the backup's own profile unit.
 */
export function applyRestore(backup: Backup, now = Date.now()): { tagged: number } {
  const snapshot: Snapshot = { ...loadAppData(), savedAt: now };
  try {
    localStorage.setItem(PRERESTORE_KEY, JSON.stringify(snapshot));
  } catch {
    // Without room for the snapshot there's no undo; the restore itself still goes ahead.
  }
  const profile = { ...DEFAULT_PROFILE, ...backup.profile };
  const { sessions, tagged } = migrateUnits(backup.sessions, profile.units);
  writeAppData({ profile, sessions, draft: backup.draft ?? undefined });
  return { tagged };
}

/** When the last restore can still be undone, the time it was made. */
export function undoAvailableSince(now = Date.now()): number | undefined {
  try {
    const raw = localStorage.getItem(PRERESTORE_KEY);
    if (!raw) return undefined;
    const snap = JSON.parse(raw) as Snapshot;
    return now - snap.savedAt < UNDO_DAYS * DAY_MS ? snap.savedAt : undefined;
  } catch {
    return undefined;
  }
}

/** Puts back the data from before the last restore. Returns false if there's nothing to undo. */
export function undoRestore(now = Date.now()): boolean {
  if (undoAvailableSince(now) === undefined) return false;
  const snap = JSON.parse(localStorage.getItem(PRERESTORE_KEY)!) as Snapshot;
  writeAppData({ profile: snap.profile, sessions: snap.sessions, draft: snap.draft ?? undefined });
  localStorage.removeItem(PRERESTORE_KEY);
  return true;
}

// ---- Reminder ---------------------------------------------------------------------------------

export interface BackupState {
  lastBackupAt?: number;
  dismissedAt?: number;
}

export function loadBackupState(): BackupState {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STATE_KEY) ?? "{}");
    return isObject(parsed) ? (parsed as BackupState) : {};
  } catch {
    return {};
  }
}

export function updateBackupState(patch: BackupState): BackupState {
  const next = { ...loadBackupState(), ...patch };
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable; the reminder may show again.
  }
  return next;
}

/** At least 5 workouts, no backup in 14 days, and not dismissed in the last 14 days. */
export function reminderDue(state: BackupState, workouts: number, now: number): boolean {
  const recent = (t?: number) => t !== undefined && now - t < REMINDER_DAYS * DAY_MS;
  return workouts >= REMINDER_MIN_WORKOUTS && !recent(state.lastBackupAt) && !recent(state.dismissedAt);
}

// ---- Saving the file --------------------------------------------------------------------------

/**
 * Hands the backup to the user. Phones get the share sheet (Save to Files on iPhone, Files or Drive
 * on Android), which also works inside an installed iOS app where download links don't; everything
 * else downloads the file. Resolves true once the file was shared or downloaded, false if cancelled.
 */
export async function saveBackupFile(backup: Backup, now: Date): Promise<boolean> {
  const name = backupFileName(now);
  const json = JSON.stringify(backup, null, 2);
  const file = new File([json], name, { type: "application/json" });

  const touch = window.matchMedia?.("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return false;
      // Sharing failed for another reason: fall back to a download.
    }
  }

  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
