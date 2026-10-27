import { useState, type CSSProperties } from "react";
import type { WorkoutDay } from "./planner";
import { measureOf, nextTarget, recentLogs, setsToLog, takesWeight } from "./progress";
import { newId, toLocalDate, type ExerciseLog, type Feeling, type SessionLog, type Units } from "./workoutLog";
import type { Level } from "./exercises";

interface Props {
  day: WorkoutDay;
  level: Level;
  units: Units;
  sessions: SessionLog[];
  onUnitsChange: (units: Units) => void;
  onSave: (session: SessionLog) => void;
  onCancel: () => void;
}

interface Entry {
  weight: string;
  values: string[];
  trouble: boolean;
}

const FEELINGS: { value: Feeling; label: string }[] = [
  { value: "easy", label: "Too easy" },
  { value: "right", label: "Just right" },
  { value: "hard", label: "Too hard" },
];

const MEASURE_LABEL = { reps: "Reps", seconds: "Seconds", rounds: "Rounds" } as const;

export function LogWorkout({ day, level, units, sessions, onUnitsChange, onSave, onCancel }: Props) {
  const [date, setDate] = useState(() => toLocalDate(new Date()));
  const [feeling, setFeeling] = useState<Feeling | undefined>();
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<Entry[]>(() =>
    day.exercises.map((ex) => {
      // Start from the target weight, or the last weight used.
      const weight = nextTarget(ex, sessions, units)?.weight ?? recentLogs(ex.name, sessions, 1)[0]?.weight;
      return { weight: weight !== undefined ? String(weight) : "", values: Array(setsToLog(ex)).fill(""), trouble: false };
    }),
  );
  const [error, setError] = useState("");

  const updateEntry = (i: number, patch: Partial<Entry>) =>
    setEntries((prev) => prev.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const save = () => {
    const exercises: ExerciseLog[] = day.exercises.flatMap((ex, i) => {
      const entry = entries[i];
      const values = entry.values.filter((v) => v !== "").map(Number).filter((v) => Number.isFinite(v) && v > 0);
      const weight = Number(entry.weight);
      if (values.length === 0 && !entry.trouble) return [];
      return [{
        name: ex.name,
        values,
        ...(takesWeight(ex) && entry.weight !== "" && weight > 0 ? { weight } : {}),
        ...(entry.trouble ? { trouble: true } : {}),
      }];
    });
    if (!exercises.some((e) => e.values.length > 0)) {
      setError("Enter what you did on at least one set.");
      return;
    }
    onSave({ id: newId(), date, weekday: day.weekday, dayTitle: day.title, level, feeling, notes: notes.trim(), exercises });
  };

  return (
    <form
      className="log"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="log-head">
        <h2>Log {day.weekday} · {day.title}</h2>
        <label className="inline">
          Date
          <input id="log-date" type="date" value={date} max={toLocalDate(new Date())} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="segmented" role="radiogroup" aria-label="Weight units">
          {(["kg", "lb"] as const).map((u) => (
            <button key={u} type="button" role="radio" aria-checked={units === u} className={units === u ? "chip on" : "chip"} onClick={() => onUnitsChange(u)}>
              {u}
            </button>
          ))}
        </div>
      </div>

      {day.exercises.map((ex, i) => {
        const target = nextTarget(ex, sessions, units);
        const entry = entries[i];
        const measure = measureOf(ex);
        return (
          <fieldset key={ex.name} className="log-exercise">
            <legend>{ex.name}</legend>
            <p className="target">
              {target ? <>Target: <strong>{target.text}</strong>{target.why === "backOff" && " (backing off to break a plateau)"}</> : <>Plan: {ex.sets} × {ex.reps}</>}
            </p>
            <div className="log-inputs">
              {takesWeight(ex) && (
                <label className="inline">
                  Weight ({units})
                  <input
                    id={`w-${i}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={entry.weight}
                    onChange={(e) => updateEntry(i, { weight: e.target.value })}
                  />
                </label>
              )}
              <div className="sets" style={{ "--sets": entry.values.length } as CSSProperties}>
                <span className="sets-label">{MEASURE_LABEL[measure]}</span>
                {entry.values.map((v, s) => (
                  <input
                    key={s}
                    id={`v-${i}-${s}`}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    aria-label={`${ex.name} set ${s + 1} ${MEASURE_LABEL[measure].toLowerCase()}`}
                    placeholder={String(target?.value ?? (ex.reps.match(/\d+/)?.[0] ?? ""))}
                    value={v}
                    onChange={(e) => updateEntry(i, { values: entry.values.map((x, k) => (k === s ? e.target.value : x)) })}
                  />
                ))}
              </div>
            </div>
            <label className="check">
              <input id={`t-${i}`} type="checkbox" checked={entry.trouble} onChange={(e) => updateEntry(i, { trouble: e.target.checked })} />
              Gave me trouble (pain or form)
            </label>
          </fieldset>
        );
      })}

      <fieldset className="log-exercise">
        <legend>How did it feel?</legend>
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
      </fieldset>

      {error && <p className="warn">{error}</p>}
      <div className="nav">
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary">Save workout</button>
      </div>
    </form>
  );
}
