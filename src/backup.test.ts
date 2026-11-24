import { beforeEach, describe, expect, it } from "vitest";
import { applyRestore, backupFileName, createBackup, loadAppData, parseBackup, reminderDue, undoAvailableSince, undoRestore } from "./backup";
import { DEFAULT_PROFILE, saveProfile, type UserProfile } from "./profile";
import { saveDraft, saveSessions, type Draft, type SessionLog } from "./workoutLog";

// Vitest runs in Node, which has no localStorage: a minimal in-memory stand-in.
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

beforeEach(() => {
  globalThis.localStorage = memoryStorage();
});

const DAY = 24 * 60 * 60 * 1000;
const profile: UserProfile = { ...DEFAULT_PROFILE, name: "Sam", units: "lb", equipment: ["barbell"] };
const sessions: SessionLog[] = [
  { id: "a", date: "2026-10-01", weekday: "Thu", dayTitle: "Full Body A", level: "beginner", notes: "", exercises: [{ name: "Back Squat", weight: 135, unit: "lb", values: [8, 8, 8] }] },
  { id: "b", date: "2026-11-20", weekday: "Fri", dayTitle: "Full Body B", level: "beginner", feeling: "right", notes: "good", exercises: [{ name: "Push-Up", values: [12, 10] }], durationMin: 41 },
];
const draft: Draft = { weekday: "Mon", dayTitle: "Full Body A", startedAt: 1, units: "lb", entries: [{ name: "Back Squat", weight: "140", sets: [{ value: "8", done: true }], trouble: false }] };

describe("backup file", () => {
  it("round-trips: exporting then restoring gives identical data", () => {
    saveProfile(profile);
    saveSessions(sessions);
    saveDraft(draft);
    const before = loadAppData();

    const file = JSON.stringify(createBackup({ profile, sessions, draft }, new Date(2026, 10, 24), "0.1.0"));
    globalThis.localStorage = memoryStorage(); // a fresh install
    const parsed = parseBackup(file);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup).toMatchObject({ app: "workout-planner", format: 1, appVersion: "0.1.0" });
    applyRestore(parsed.backup);

    expect(loadAppData()).toEqual(before);
  });

  it("summarizes what a backup contains", () => {
    const parsed = parseBackup(JSON.stringify(createBackup({ profile, sessions, draft }, new Date())));
    expect(parsed.ok && parsed.summary).toBe("2 workouts, Oct 1 – Nov 20, plus a workout in progress");
    const crossYear = [{ ...sessions[0], date: "2025-12-30" }, sessions[1]];
    const p2 = parseBackup(JSON.stringify(createBackup({ profile, sessions: crossYear }, new Date())));
    expect(p2.ok && p2.summary).toBe("2 workouts, Dec 30, 2025 – Nov 20, 2026");
  });

  it("is named by date", () => {
    expect(backupFileName(new Date(2026, 10, 4))).toBe("workout-planner-backup-2026-11-04.json");
  });

  it("rejects bad files without touching the current data", () => {
    const good = createBackup({ profile, sessions }, new Date());
    const bad: [string, string][] = [
      ["not json {", "couldn't be read as JSON"],
      [JSON.stringify({ hello: "world" }), "isn't a Workout Planner backup"],
      [JSON.stringify({ ...good, format: 99 }), "newer version"],
      [JSON.stringify({ ...good, profile: undefined }), "profile is missing"],
      [JSON.stringify({ ...good, profile: { ...profile, units: "stone" } }), "profile is missing"],
      [JSON.stringify({ ...good, sessions: [sessions[0], { ...sessions[1], date: "20 Nov" }] }), "Workout 2"],
      [JSON.stringify({ ...good, sessions: [{ ...sessions[0], exercises: [{ name: "Back Squat", values: ["8"] }] }] }), "Workout 1"],
      [JSON.stringify({ ...good, sessions: [{ ...sessions[0], exercises: [{ name: "Back Squat", weight: "heavy", values: [8] }] }] }), "Workout 1"],
    ];
    for (const [text, message] of bad) {
      const result = parseBackup(text);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain(message);
    }
  });

  it("tags untagged weights in an older backup with that backup's unit", () => {
    const old = { ...createBackup({ profile, sessions }, new Date()), sessions: [{ ...sessions[0], exercises: [{ name: "Back Squat", weight: 135, values: [8] }] }] };
    expect(applyRestore(old)).toEqual({ tagged: 1 });
    expect(loadAppData().sessions[0].exercises[0].unit).toBe("lb");
  });
});

describe("undo restore", () => {
  it("puts back exactly the data from before the restore", () => {
    saveProfile(profile);
    saveSessions(sessions);
    saveDraft(draft);
    const before = loadAppData();

    const other = createBackup({ profile: { ...profile, name: "Alex", units: "kg" }, sessions: [sessions[1]] }, new Date());
    applyRestore(other, 1000);
    expect(loadAppData().profile?.name).toBe("Alex");
    expect(loadAppData().draft).toBeUndefined();

    expect(undoAvailableSince(1000 + DAY)).toBe(1000);
    expect(undoRestore(1000 + DAY)).toBe(true);
    expect(loadAppData()).toEqual(before);
    expect(undoAvailableSince(1000 + DAY)).toBeUndefined();
  });

  it("restores 'no profile' too, when there was none before", () => {
    applyRestore(createBackup({ profile, sessions }, new Date()), 0);
    undoRestore(0);
    expect(loadAppData()).toEqual({ profile: null, sessions: [], draft: undefined });
  });

  it("expires after 7 days, and a later restore replaces the snapshot", () => {
    saveProfile(profile);
    applyRestore(createBackup({ profile: { ...profile, name: "B" }, sessions }, new Date()), 0);
    expect(undoAvailableSince(7 * DAY - 1)).toBe(0);
    expect(undoAvailableSince(7 * DAY)).toBeUndefined();
    expect(undoRestore(7 * DAY)).toBe(false);

    applyRestore(createBackup({ profile: { ...profile, name: "C" }, sessions }, new Date()), 8 * DAY);
    undoRestore(8 * DAY);
    expect(loadAppData().profile?.name).toBe("B");
  });
});

describe("backup reminder", () => {
  const now = 100 * DAY;
  it("shows with 5+ workouts and no backup in 14 days", () => {
    expect(reminderDue({}, 5, now)).toBe(true);
    expect(reminderDue({}, 4, now)).toBe(false);
    expect(reminderDue({ lastBackupAt: now - 13 * DAY }, 5, now)).toBe(false);
    expect(reminderDue({ lastBackupAt: now - 15 * DAY }, 5, now)).toBe(true);
  });

  it("stays hidden for 14 days after being dismissed", () => {
    expect(reminderDue({ dismissedAt: now - 2 * DAY }, 9, now)).toBe(false);
    expect(reminderDue({ dismissedAt: now - 15 * DAY }, 9, now)).toBe(true);
  });
});
