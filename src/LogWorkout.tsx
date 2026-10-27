import { useEffect, useRef, useState } from "react";
import type { Level } from "./exercises";
import type { WorkoutDay } from "./planner";
import { formatWeight, measureOf, nextTarget, personalBests, recentLogs, sessionVolume, setsToLog, takesWeight } from "./progress";
import {
  clearDraft,
  newId,
  saveDraft,
  toLocalDate,
  type Draft,
  type DraftEntry,
  type ExerciseLog,
  type Feeling,
  type SessionLog,
  type Units,
} from "./workoutLog";

interface Props {
  day: WorkoutDay;
  level: Level;
  units: Units;
  sessions: SessionLog[];
  /** A saved workout in progress for this day, to resume. */
  draft?: Draft;
  onUnitsChange: (units: Units) => void;
  onSave: (session: SessionLog) => void;
  onClose: () => void;
}

const FEELINGS: { value: Feeling; label: string }[] = [
  { value: "easy", label: "Too easy" },
  { value: "right", label: "Just right" },
  { value: "hard", label: "Too hard" },
];

const MEASURE_LABEL = { reps: "Reps", seconds: "Secs", rounds: "Rounds" } as const;

function freshDraft(day: WorkoutDay, sessions: SessionLog[], units: Units): Draft {
  return {
    weekday: day.weekday,
    dayTitle: day.title,
    startedAt: Date.now(),
    entries: day.exercises.map((ex) => {
      const weight = nextTarget(ex, sessions, units)?.weight ?? recentLogs(ex.name, sessions, 1)[0]?.weight;
      return {
        weight: weight !== undefined ? String(weight) : "",
        sets: Array.from({ length: setsToLog(ex) }, () => ({ value: "", done: false })),
        trouble: false,
      };
    }),
  };
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Keeps the screen on during a workout where the browser allows it. */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined;
    const request = async () => {
      try {
        lock = await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<typeof lock> } }).wakeLock?.request("screen");
      } catch {
        // Not supported or not allowed; the screen just follows normal sleep settings.
      }
    };
    void request();
    const onVisible = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

export function LogWorkout({ day, level, units, sessions, draft: resumed, onUnitsChange, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<Draft>(() =>
    resumed && resumed.entries.length === day.exercises.length ? resumed : freshDraft(day, sessions, units),
  );
  const [phase, setPhase] = useState<"workout" | "finish">("workout");
  const [restEnd, setRestEnd] = useState<number | undefined>();
  const [now, setNow] = useState(Date.now());
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [date, setDate] = useState(() => toLocalDate(new Date()));
  const [feeling, setFeeling] = useState<Feeling | undefined>();
  const [notes, setNotes] = useState("");
  const buzzed = useRef(false);
  useWakeLock();

  useEffect(() => saveDraft(draft), [draft]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const restLeft = restEnd !== undefined ? restEnd - now : undefined;
  useEffect(() => {
    if (restLeft !== undefined && restLeft <= 0 && !buzzed.current) {
      buzzed.current = true;
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [restLeft]);

  const updateEntry = (i: number, patch: Partial<DraftEntry>) =>
    setDraft((d) => ({ ...d, entries: d.entries.map((e, j) => (j === i ? { ...e, ...patch } : e)) }));

  const toggleSet = (i: number, s: number, fallback: string, restSeconds: number) => {
    const entry = draft.entries[i];
    const set = entry.sets[s];
    const done = !set.done;
    updateEntry(i, { sets: entry.sets.map((x, k) => (k === s ? { value: x.value || (done ? fallback : ""), done } : x)) });
    if (done) {
      buzzed.current = false;
      setRestEnd(Date.now() + restSeconds * 1000);
    }
  };

  const exercises: ExerciseLog[] = day.exercises.flatMap((ex, i) => {
    const entry = draft.entries[i];
    const values = entry.sets.filter((s) => s.value !== "").map((s) => Number(s.value)).filter((v) => Number.isFinite(v) && v > 0);
    const weight = Number(entry.weight);
    if (values.length === 0 && !entry.trouble) return [];
    return [{
      name: ex.name,
      values,
      ...(takesWeight(ex) && entry.weight !== "" && weight > 0 ? { weight } : {}),
      ...(entry.trouble ? { trouble: true } : {}),
    }];
  });
  const setsDone = draft.entries.reduce((n, e) => n + e.sets.filter((s) => s.value !== "").length, 0);
  const totalSets = draft.entries.reduce((n, e) => n + e.sets.length, 0);
  const elapsed = now - draft.startedAt;

  const discard = () => {
    clearDraft();
    onClose();
  };

  const save = () => {
    clearDraft();
    onSave({
      id: newId(),
      date,
      weekday: day.weekday,
      dayTitle: day.title,
      level,
      feeling,
      notes: notes.trim(),
      exercises,
      durationMin: Math.max(1, Math.round(elapsed / 60000)),
    });
  };

  if (phase === "finish") {
    const bests = personalBests({ exercises }, sessions);
    const volume = sessionVolume({ exercises });
    return (
      <section className="workout finish">
        <div className="screen-head">
          <button type="button" className="ghost" onClick={() => setPhase("workout")}>← Back</button>
        </div>
        <div className="finish-hero">
          <p className="eyebrow">Workout complete</p>
          <h1>{day.title}</h1>
          <dl className="stats">
            <div><dt>Time</dt><dd>{clock(elapsed)}</dd></div>
            <div><dt>Sets</dt><dd>{setsDone}</dd></div>
            {volume > 0 && <div><dt>Volume</dt><dd>{Math.round(volume).toLocaleString()} <small>{units}</small></dd></div>}
          </dl>
          {bests.length > 0 && (
            <div className="bests">
              <p className="eyebrow">New personal best{bests.length > 1 && "s"}</p>
              <ul>
                {bests.map((name) => {
                  const e = exercises.find((x) => x.name === name)!;
                  return <li key={name}><strong>{name}</strong> {e.weight !== undefined ? formatWeight(e.weight, units) : `${Math.max(...e.values)}`}</li>;
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="card">
          <h2>How did it feel?</h2>
          <div className="segmented" role="radiogroup" aria-label="How did it feel">
            {FEELINGS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={feeling === f.value}
                className={feeling === f.value ? "chip on" : "chip"}
                onClick={() => setFeeling(feeling === f.value ? undefined : f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="field">
            Comments or difficulties
            <textarea
              id="log-notes"
              rows={3}
              placeholder="e.g. left knee felt off on lunges, slept badly"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <label className="inline">
            Date
            <input id="log-date" type="date" value={date} max={toLocalDate(new Date())} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <div className="action-bar">
          <button type="button" className="primary big" onClick={save}>Save workout</button>
        </div>
      </section>
    );
  }

  return (
    <section className="workout">
      <div className="workout-head">
        <div>
          <p className="eyebrow">{day.weekday} · {clock(elapsed)}</p>
          <h1>{day.title}</h1>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Weight units">
          {(["kg", "lb"] as const).map((u) => (
            <button key={u} type="button" role="radio" aria-checked={units === u} className={units === u ? "chip small on" : "chip small"} onClick={() => onUnitsChange(u)}>
              {u}
            </button>
          ))}
        </div>
      </div>
      <div className="workout-progress" role="progressbar" aria-valuemin={0} aria-valuemax={totalSets} aria-valuenow={setsDone} aria-label="Sets done">
        <span style={{ width: `${totalSets ? (setsDone / totalSets) * 100 : 0}%` }} />
      </div>

      {day.exercises.map((ex, i) => {
        const entry = draft.entries[i];
        const target = nextTarget(ex, sessions, units);
        const previous = recentLogs(ex.name, sessions, 1)[0];
        const measure = measureOf(ex);
        const fallback = String(target?.value ?? ex.reps.match(/\d+/)?.[0] ?? "");
        return (
          <article key={ex.name} className="log-exercise">
            <header className="log-exercise-head">
              <h2>{ex.name}</h2>
              <p className="target">
                {target ? <>Target <strong>{target.text}</strong>{target.why === "backOff" && " · backing off to break a plateau"}</> : <>Plan {ex.sets} × {ex.reps}</>}
              </p>
            </header>
            {takesWeight(ex) && (
              <label className="inline weight">
                Weight
                <input
                  id={`w-${i}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={entry.weight}
                  onChange={(e) => updateEntry(i, { weight: e.target.value })}
                />
                <span className="unit">{units}</span>
              </label>
            )}
            <table className="set-table">
              <thead>
                <tr><th>Set</th><th>Previous</th><th>{MEASURE_LABEL[measure]}</th><th><span className="visually-hidden">Done</span></th></tr>
              </thead>
              <tbody>
                {entry.sets.map((set, s) => (
                  <tr key={s} className={set.done ? "done" : undefined}>
                    <td className="set-no">{s + 1}</td>
                    <td className="prev">
                      {previous?.values[s] !== undefined
                        ? `${previous.weight !== undefined ? `${Number(previous.weight.toFixed(1))} × ` : ""}${previous.values[s]}`
                        : "–"}
                    </td>
                    <td>
                      <input
                        id={`v-${i}-${s}`}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        aria-label={`${ex.name} set ${s + 1} ${MEASURE_LABEL[measure].toLowerCase()}`}
                        placeholder={fallback}
                        value={set.value}
                        onChange={(e) => updateEntry(i, { sets: entry.sets.map((x, k) => (k === s ? { ...x, value: e.target.value } : x)) })}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={set.done ? "tick on" : "tick"}
                        aria-pressed={set.done}
                        aria-label={`Set ${s + 1} done`}
                        onClick={() => toggleSet(i, s, fallback, ex.restSeconds)}
                      >
                        ✓
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <label className="check">
              <input id={`t-${i}`} type="checkbox" checked={entry.trouble} onChange={(e) => updateEntry(i, { trouble: e.target.checked })} />
              Gave me trouble (pain or form)
            </label>
          </article>
        );
      })}

      {confirmDiscard ? (
        <div className="card confirm">
          <p>Discard this workout? Nothing you've entered will be saved.</p>
          <div className="tip-actions">
            <button type="button" className="danger small" onClick={discard}>Discard</button>
            <button type="button" className="ghost small" onClick={() => setConfirmDiscard(false)}>Keep going</button>
          </div>
        </div>
      ) : (
        <button type="button" className="ghost danger-text discard" onClick={() => setConfirmDiscard(true)}>Discard workout</button>
      )}

      <div className="action-bar">
        {restLeft !== undefined && (
          <div className={restLeft > 0 ? "rest" : "rest over"} role="timer" aria-live="polite">
            <span className="rest-label">{restLeft > 0 ? "Rest" : "Rest over"}</span>
            <span className="rest-clock">{clock(restLeft)}</span>
            <button type="button" className="ghost small" onClick={() => setRestEnd((r) => (r ?? Date.now()) - 15000)}>−15s</button>
            <button type="button" className="ghost small" onClick={() => { buzzed.current = false; setRestEnd((r) => Math.max(r ?? 0, Date.now()) + 15000); }}>+15s</button>
            <button type="button" className="ghost small" onClick={() => setRestEnd(undefined)}>{restLeft > 0 ? "Skip" : "Close"}</button>
          </div>
        )}
        <div className="action-row">
          <button type="button" className="secondary" onClick={onClose}>Minimize</button>
          <button type="button" className="primary" disabled={setsDone === 0} onClick={() => setPhase("finish")}>
            Finish{setsDone > 0 && ` · ${setsDone}/${totalSets} sets`}
          </button>
        </div>
      </div>
    </section>
  );
}
