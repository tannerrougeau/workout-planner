import { useMemo, useState } from "react";
import { History } from "./History";
import { LogWorkout } from "./LogWorkout";
import { Onboarding } from "./Onboarding";
import { EQUIPMENT, FOCUS_AREAS, GOALS, LEVELS, LIMITATIONS, labelOf } from "./options";
import { generatePlan } from "./planner";
import { DEFAULT_PROFILE, clearProfile, loadProfile, saveProfile, type UserProfile } from "./profile";
import { cyclePosition, nextTarget, suggestions, type Suggestion } from "./progress";
import { fromLocalDate, loadSessions, saveSessions, sortByDate, type SessionLog } from "./workoutLog";

export function App() {
  const [profile, setProfile] = useState<UserProfile | null>(() => loadProfile());
  const [editing, setEditing] = useState(false);
  const [sessions, setSessions] = useState<SessionLog[]>(() => loadSessions());

  const save = (next: UserProfile) => {
    saveProfile(next);
    setProfile(next);
    setEditing(false);
  };

  const updateSessions = (next: SessionLog[]) => {
    const sorted = sortByDate(next);
    saveSessions(sorted);
    setSessions(sorted);
  };

  if (!profile || editing) {
    return (
      <div className="app">
        <Onboarding
          initial={profile ?? DEFAULT_PROFILE}
          onComplete={save}
          onCancel={profile ? () => setEditing(false) : undefined}
        />
      </div>
    );
  }

  return (
    <PlanView
      profile={profile}
      sessions={sessions}
      onChange={save}
      onSessionsChange={updateSessions}
      onEdit={() => setEditing(true)}
      onReset={() => {
        clearProfile();
        setProfile(null);
      }}
    />
  );
}

type Screen = { kind: "plan" } | { kind: "history" } | { kind: "log"; day: number };

function PlanView({
  profile,
  sessions,
  onChange,
  onSessionsChange,
  onEdit,
  onReset,
}: {
  profile: UserProfile;
  sessions: SessionLog[];
  onChange: (profile: UserProfile) => void;
  onSessionsChange: (sessions: SessionLog[]) => void;
  onEdit: () => void;
  onReset: () => void;
}) {
  const plan = useMemo(() => generatePlan(profile), [profile]);
  const excluded = profile.excluded ?? [];
  const name = profile.name.trim();
  const [screen, setScreen] = useState<Screen>({ kind: "plan" });
  const [dismissed, setDismissed] = useState<string[]>([]);

  const cycle = cyclePosition(plan.progression.weeks, sessions, new Date());
  const tips = suggestions(sessions, profile.level, excluded).filter((s) => !dismissed.includes(s.text));
  const lastLogged = (title: string, weekday: string) =>
    [...sessions].reverse().find((s) => s.dayTitle === title && s.weekday === weekday)?.date;

  const act = (s: Suggestion) => {
    if (s.kind === "levelUp") onChange({ ...profile, level: s.level });
    else if (s.kind === "swap") onChange({ ...profile, excluded: [...excluded, s.exercise] });
    setDismissed([...dismissed, s.text]);
  };

  if (screen.kind === "log") {
    return (
      <div className="app">
        <LogWorkout
          day={plan.days[screen.day]}
          level={profile.level}
          units={profile.units}
          sessions={sessions}
          onUnitsChange={(units) => onChange({ ...profile, units })}
          onCancel={() => setScreen({ kind: "plan" })}
          onSave={(session) => {
            onSessionsChange([...sessions, session]);
            setScreen({ kind: "plan" });
          }}
        />
      </div>
    );
  }

  if (screen.kind === "history") {
    return (
      <div className="app">
        <History
          sessions={sessions}
          units={profile.units}
          onDelete={(id) => onSessionsChange(sessions.filter((s) => s.id !== id))}
          onClose={() => setScreen({ kind: "plan" })}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="plan-header">
        <div>
          <h1>{name ? `${name}'s plan` : "Your plan"}</h1>
          <p>{plan.splitName} · {plan.days.length} days/week · {labelOf(GOALS, profile.goal)}</p>
        </div>
        <button type="button" className="secondary" onClick={() => setScreen({ kind: "history" })}>
          Progress{sessions.length > 0 && ` (${sessions.length})`}
        </button>
      </header>

      <div className="banner">
        {cycle ? (
          <p>
            <strong>Week {cycle.week} of {cycle.cycleLength}</strong> · {plan.progression.weeks[cycle.index].effort}: {plan.progression.weeks[cycle.index].detail}
            {cycle.lightNext && " Next week is a lighter recovery week."}
          </p>
        ) : (
          <p>Log your first workout to start tracking your progress. The app then sets a target for each exercise.</p>
        )}
        {tips.map((s) => (
          <div key={s.text} className="suggestion">
            <span>{s.text}</span>
            {(s.kind === "levelUp" || s.kind === "swap") && (
              <button type="button" className="link" onClick={() => act(s)}>{s.kind === "levelUp" ? `Move up to ${s.level}` : "Swap it"}</button>
            )}
            <button type="button" className="link quiet" onClick={() => setDismissed([...dismissed, s.text])}>Dismiss</button>
          </div>
        ))}
      </div>

      <main>
        <aside className="panel">
          <h2>Your profile</h2>
          <dl className="summary">
            <dt>Goal</dt><dd>{labelOf(GOALS, profile.goal)}</dd>
            <dt>Level</dt><dd>{labelOf(LEVELS, profile.level)}</dd>
            <dt>Sessions</dt><dd>{profile.sessionMinutes} min</dd>
            <dt>Equipment</dt>
            <dd>{profile.equipment.map((e) => labelOf(EQUIPMENT, e)).join(", ") || "Bodyweight only"}</dd>
            {(profile.limitations ?? []).length > 0 && (
              <>
                <dt>Working around</dt>
                <dd>{profile.limitations!.map((l) => labelOf(LIMITATIONS, l)).join(", ")}</dd>
              </>
            )}
            {(profile.focus ?? []).length > 0 && (
              <>
                <dt>Extra focus</dt>
                <dd>{profile.focus!.map((f) => labelOf(FOCUS_AREAS, f)).join(", ")}</dd>
              </>
            )}
          </dl>
          <button type="button" className="primary" onClick={onEdit}>Edit answers</button>

          {excluded.length > 0 && (
            <div className="excluded">
              <h3>Removed exercises</h3>
              <ul>
                {excluded.map((n) => (
                  <li key={n}>
                    {n}
                    <button
                      type="button"
                      className="link"
                      onClick={() => onChange({ ...profile, excluded: excluded.filter((x) => x !== n) })}
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button type="button" className="link danger" onClick={onReset}>Start over</button>
        </aside>

        <section className="plan">
          <div className="days">
            {plan.days.map((day, i) => (
              <article key={i} className="day">
                <h3>
                  <span className="weekday">{day.weekday}</span> {day.title}
                  <span className="duration">~{day.estimatedMinutes} min</span>
                </h3>
                <div className="day-actions">
                  <button type="button" className="primary small" onClick={() => setScreen({ kind: "log", day: i })}>Log workout</button>
                  {(() => {
                    const last = lastLogged(day.title, day.weekday);
                    return last && <span className="last-logged">Last logged {fromLocalDate(last).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>;
                  })()}
                </div>
                <table>
                  <thead>
                    <tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Rest</th><th /></tr>
                  </thead>
                  <tbody>
                    {day.exercises.map((ex) => {
                      const target = nextTarget(ex, sessions, profile.units);
                      return (
                      <tr key={ex.name}>
                        <td>
                          {ex.name}
                          {target && <div className="next">Next: {target.text}</div>}
                          <div className="hint">{ex.progression}</div>
                        </td>
                        <td>{ex.sets}</td>
                        <td>{ex.reps}</td>
                        <td>{ex.restSeconds}s</td>
                        <td>
                          <button
                            type="button"
                            className="swap"
                            title="Don't like this one? Swap it out"
                            aria-label={`Swap out ${ex.name}`}
                            onClick={() => onChange({ ...profile, excluded: [...excluded, ex.name] })}
                          >
                            ⇄
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </article>
            ))}
          </div>

          <div className="notes">
            <p><strong>Warm-up:</strong> {plan.warmUp}</p>
            <p><strong>Cool-down:</strong> {plan.coolDown}</p>
          </div>

          <div className="notes progression">
            <h2>How to progress</h2>
            <p>{plan.progression.summary}</p>
            <table>
              <thead>
                <tr><th>When</th><th>Effort</th><th>What to do</th></tr>
              </thead>
              <tbody>
                {plan.progression.weeks.map((w, i) => (
                  <tr key={w.week} className={cycle?.index === i ? "current" : undefined}>
                    <td>{w.week}</td>
                    <td>{w.effort}</td>
                    <td>{w.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p><strong>For your goal:</strong> {plan.progression.goalTip}</p>
            <h3>When to back off</h3>
            <ul>
              {plan.progression.backOff.map((tip) => <li key={tip}>{tip}</li>)}
            </ul>
            {plan.progression.levelUp && (
              <p><strong>Moving up:</strong> {plan.progression.levelUp}</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
