import { useRef, useState } from "react";
import {
  createBackup,
  loadBackupState,
  parseBackup,
  reminderDue,
  saveBackupFile,
  undoAvailableSince,
  updateBackupState,
  type Backup,
} from "./backup";
import { loadMeta, updateMeta } from "./meta";
import type { UserProfile } from "./profile";
import type { Draft, SessionLog } from "./workoutLog";

const shortDay = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** Settings card: back up to a file, restore from one (with confirmation and a 7-day undo), and a gentle reminder. */
export function BackupCard({
  profile,
  sessions,
  draft,
  onRestore,
  onUndoRestore,
}: {
  profile: UserProfile;
  sessions: SessionLog[];
  draft: Draft | undefined;
  onRestore: (backup: Backup) => void;
  onUndoRestore: () => void;
}) {
  const [state, setState] = useState(loadBackupState);
  const [pending, setPending] = useState<{ backup: Backup; summary: string } | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const undoSince = undoAvailableSince();
  const showReminder = reminderDue(state, sessions.length, Date.now());

  const backUp = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const now = new Date();
      if (await saveBackupFile(createBackup({ profile, sessions, draft }, now), now)) {
        setState(updateBackupState({ lastBackupAt: now.getTime() }));
      }
    } catch {
      setError("Couldn't create the backup file. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (file: File | undefined) => {
    setPending(undefined);
    setError(undefined);
    if (!file) return;
    const result = parseBackup(await file.text());
    if (result.ok) setPending({ backup: result.backup, summary: result.summary });
    else setError(result.error);
  };

  return (
    <div className="card">
      <h2>Backup</h2>
      {showReminder && (
        <div className="backup-reminder" role="status">
          <span>Back up your training data</span>
          <button
            type="button"
            className="link quiet"
            aria-label="Dismiss backup reminder"
            onClick={() => setState(updateBackupState({ dismissedAt: Date.now() }))}
          >
            ✕
          </button>
        </div>
      )}
      <p className="muted">
        Your data is stored only on this device.{" "}
        {state.lastBackupAt ? `Last backup ${shortDay(state.lastBackupAt)}.` : "Keep a backup file somewhere safe, like Files, Drive or email."}
      </p>
      <div className="backup-actions">
        <button type="button" className="primary" disabled={busy} onClick={() => void backUp()}>Back up my data</button>
        <button type="button" className="secondary" onClick={() => fileInput.current?.click()}>Restore from backup</button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            void pickFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {pending && (
        <div className="confirm">
          <p>
            This backup has <strong>{pending.summary}</strong>. Replace the data on this device with it? You can undo this for 7 days.
          </p>
          <div className="tip-actions">
            <button
              type="button"
              className="danger small"
              onClick={() => {
                onRestore(pending.backup);
                setPending(undefined);
              }}
            >
              Replace
            </button>
            <button type="button" className="ghost small" onClick={() => setPending(undefined)}>Cancel</button>
          </div>
        </div>
      )}
      {undoSince !== undefined && !pending && (
        <p className="muted">
          Restored from a backup on {shortDay(undoSince)}.{" "}
          <button type="button" className="link" onClick={onUndoRestore}>Undo restore</button>
        </p>
      )}
    </div>
  );
}

/** One-time note after earlier logged weights were tagged with a unit. */
export function UnitsMigrationNotice() {
  const [migration, setMigration] = useState(() => loadMeta().unitsMigration);
  if (!migration || migration.dismissed) return null;
  return (
    <p className="muted">
      {migration.count} earlier logged weight{migration.count === 1 ? " was" : "s were"} marked as {migration.unit}, so switching units now converts them.{" "}
      <button
        type="button"
        className="link"
        onClick={() => setMigration(updateMeta({ unitsMigration: { ...migration, dismissed: true } }).unitsMigration)}
      >
        OK
      </button>
    </p>
  );
}
