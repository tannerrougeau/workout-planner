import { useMemo, useState } from "react";
import { Onboarding } from "./Onboarding";
import { EQUIPMENT, FOCUS_AREAS, GOALS, LEVELS, LIMITATIONS, labelOf } from "./options";
import { generatePlan } from "./planner";
import { DEFAULT_PROFILE, clearProfile, loadProfile, saveProfile, type UserProfile } from "./profile";

export function App() {
  const [profile, setProfile] = useState<UserProfile | null>(() => loadProfile());
  const [editing, setEditing] = useState(false);

  const save = (next: UserProfile) => {
    saveProfile(next);
    setProfile(next);
    setEditing(false);
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
      onChange={save}
      onEdit={() => setEditing(true)}
      onReset={() => {
        clearProfile();
        setProfile(null);
      }}
    />
  );
}

function PlanView({
  profile,
  onChange,
  onEdit,
  onReset,
}: {
  profile: UserProfile;
  onChange: (profile: UserProfile) => void;
  onEdit: () => void;
  onReset: () => void;
}) {
  const plan = useMemo(() => generatePlan(profile), [profile]);
  const excluded = profile.excluded ?? [];
  const name = profile.name.trim();

  return (
    <div className="app">
      <header>
        <h1>{name ? `${name}'s plan` : "Your plan"}</h1>
        <p>{plan.splitName} · {plan.days.length} days/week · {labelOf(GOALS, profile.goal)}</p>
      </header>

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
                <table>
                  <thead>
                    <tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Rest</th><th /></tr>
                  </thead>
                  <tbody>
                    {day.exercises.map((ex) => (
                      <tr key={ex.name}>
                        <td>
                          {ex.name}
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
                    ))}
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
                {plan.progression.weeks.map((w) => (
                  <tr key={w.week}>
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
