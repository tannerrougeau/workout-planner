import { useMemo, useState } from "react";
import { History } from "./History";
import { LogWorkout } from "./LogWorkout";
import { Onboarding } from "./Onboarding";
import { EQUIPMENT, FOCUS_AREAS, GOALS, LEVELS, LIMITATIONS, labelOf } from "./options";
import { WEEKDAYS, generatePlan, type WorkoutPlan } from "./planner";
import { DEFAULT_PROFILE, clearProfile, loadProfile, saveProfile, type UserProfile } from "./profile";
import { cyclePosition, nextTarget, suggestions, weeklyProgress, type Suggestion, type WeeklyProgress } from "./progress";
import { fromLocalDate, loadDraft, loadSessions, saveSessions, sortByDate, type SessionLog } from "./workoutLog";

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

type Screen = { kind: "plan" } | { kind: "history" } | { kind: "profile" } | { kind: "log"; day: number };

/** Today's weekday in the plan's Mon–Sun labels. */
function todayLabel(): string {
  return WEEKDAYS[(new Date().getDay() + 6) % 7];
}

/** Today's training day, or the next one coming up this week (wrapping to next week). */
function defaultDay(plan: WorkoutPlan, today: string): number {
  const start = WEEKDAYS.indexOf(today as (typeof WEEKDAYS)[number]);
  for (let offset = 0; offset < 7; offset++) {
    const label = WEEKDAYS[(start + offset) % 7];
    const i = plan.days.findIndex((d) => d.weekday === label);
    if (i >= 0) return i;
  }
  return 0;
}

const shortDate = (date: string) => fromLocalDate(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });

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
  const today = todayLabel();
  const [screen, setScreen] = useState<Screen>({ kind: "plan" });
  const [selected, setSelected] = useState(() => defaultDay(plan, today));
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [draft, setDraft] = useState(() => loadDraft());
  const draftDay = draft ? plan.days.findIndex((d) => d.weekday === draft.weekday && d.title === draft.dayTitle) : -1;
  const week = weeklyProgress(sessions, plan.days.length, new Date());
  const startWorkout = (i: number) => setScreen({ kind: "log", day: i });
  const tab = (kind: "plan" | "history" | "profile") => (
    <TabBar current={kind} logged={sessions.length} onSelect={(k) => setScreen({ kind: k })} />
  );

  const dayIndex = Math.min(selected, plan.days.length - 1);
  const day = plan.days[dayIndex];
  const todayIndex = plan.days.findIndex((d) => d.weekday === today);
  const upNext = plan.days[defaultDay(plan, today)];
  const cycle = cyclePosition(plan.progression.weeks, sessions, new Date());
  const cycleWeek = cycle && plan.progression.weeks[cycle.index];
  const tips = suggestions(sessions, profile.level, excluded).filter((s) => !dismissed.includes(s.text));
  const lastLogged = [...sessions].reverse().find((s) => s.dayTitle === day.title && s.weekday === day.weekday)?.date;
  const loggedToday = todayIndex >= 0 && sessions.some((s) => s.weekday === today && fromLocalDate(s.date).toDateString() === new Date().toDateString());

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
          draft={draftDay === screen.day ? draft : undefined}
          onUnitsChange={(units) => onChange({ ...profile, units })}
          onClose={() => {
            setDraft(loadDraft());
            setScreen({ kind: "plan" });
          }}
          onSave={(session) => {
            onSessionsChange([...sessions, session]);
            setDraft(undefined);
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
        />
        {tab("history")}
      </div>
    );
  }

  if (screen.kind === "profile") {
    return (
      <div className="app">
        <ProfileScreen profile={profile} onChange={onChange} onEdit={onEdit} onReset={onReset} />
        {tab("profile")}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <p className="eyebrow">{plan.splitName} · {labelOf(GOALS, profile.goal)}</p>
        <h1>{name ? `Hi, ${name}` : "Your plan"}</h1>
      </header>

      <section className="hero" aria-label="Today">
        <div className="hero-top">
          <div className="hero-text">
            <p className="eyebrow">
              Today · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </p>
            {draft && draftDay >= 0 ? (
              <>
                <h2>{plan.days[draftDay].title}</h2>
                <p className="hero-meta">Workout in progress · started {new Date(draft.startedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</p>
              </>
            ) : todayIndex >= 0 ? (
              <>
                <h2>{plan.days[todayIndex].title}</h2>
                <p className="hero-meta">
                  {plan.days[todayIndex].exercises.length} exercises · about {plan.days[todayIndex].estimatedMinutes} min
                  {loggedToday && " · Done today"}
                </p>
              </>
            ) : (
              <>
                <h2>Rest day</h2>
                <p className="hero-meta">Recovery is part of the plan. Next up: {upNext.weekday} · {upNext.title}</p>
              </>
            )}
          </div>
          <GoalRing week={week} />
        </div>
        {draft && draftDay >= 0 ? (
          <button type="button" className="primary big" onClick={() => startWorkout(draftDay)}>Resume workout</button>
        ) : todayIndex >= 0 ? (
          <button type="button" className={loggedToday ? "secondary big" : "primary big"} onClick={() => startWorkout(todayIndex)}>
            {loggedToday ? "Start another session" : "Start today's workout"}
          </button>
        ) : null}
        <div className="cycle">
          {cycle && cycleWeek ? (
            <>
              <span className={`effort ${cycleWeek.effort.toLowerCase()}`}>Week {cycle.week} of {cycle.cycleLength} · {cycleWeek.effort}</span>
              <span>{cycleWeek.detail}{cycle.lightNext && " Next week is a lighter week."}</span>
            </>
          ) : (
            <span>Log your first workout and the app starts setting a target for each exercise.</span>
          )}
        </div>
      </section>

      {tips.length > 0 && (
        <ul className="tips">
          {tips.map((s) => (
            <li key={s.text} className="tip">
              <p>{s.text}</p>
              <div className="tip-actions">
                {(s.kind === "levelUp" || s.kind === "swap") && (
                  <button type="button" className="primary small" onClick={() => act(s)}>
                    {s.kind === "levelUp" ? `Move up to ${s.level}` : "Swap it"}
                  </button>
                )}
                <button type="button" className="ghost small" onClick={() => setDismissed([...dismissed, s.text])}>Dismiss</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <nav className="week" aria-label="Choose a day">
        {WEEKDAYS.map((label) => {
          const i = plan.days.findIndex((d) => d.weekday === label);
          const isToday = label === today;
          if (i < 0) {
            return (
              <span key={label} className={isToday ? "week-day rest today" : "week-day rest"}>
                <span className="week-label">{label}</span>
                <span className="week-sub">Rest</span>
              </span>
            );
          }
          return (
            <button
              key={label}
              type="button"
              aria-pressed={i === dayIndex}
              className={["week-day", i === dayIndex && "on", isToday && "today"].filter(Boolean).join(" ")}
              onClick={() => setSelected(i)}
            >
              <span className="week-label">{label}</span>
              <span className="week-sub">{plan.days[i].title.replace("Full Body", "Full").replace(" Body", "")}</span>
            </button>
          );
        })}
      </nav>

      <section className="day" aria-label={`${day.weekday} workout`}>
        <div className="day-head">
          <div>
            <h2>{day.weekday} · {day.title}</h2>
            <p className="muted">
              About {day.estimatedMinutes} min{lastLogged && ` · Last logged ${shortDate(lastLogged)}`}
            </p>
          </div>
          {dayIndex !== todayIndex && (
            <button type="button" className="secondary small" onClick={() => startWorkout(dayIndex)}>Start this workout</button>
          )}
        </div>
        <ol className="exercises">
          {day.exercises.map((ex) => {
            const target = nextTarget(ex, sessions, profile.units);
            return (
              <li key={ex.name} className="exercise">
                <div className="exercise-main">
                  <h3>{ex.name}</h3>
                  <p className="prescription">
                    <span className="num">{ex.sets}</span> sets × <span className="num">{ex.reps}</span>
                    <span className="sep">·</span>rest {ex.restSeconds}s
                  </p>
                  {target && <p className="target-chip">Next: <strong>{target.text}</strong></p>}
                  <p className="hint">{ex.progression}</p>
                </div>
                <button
                  type="button"
                  className="swap"
                  title="Swap for a different exercise"
                  aria-label={`Swap out ${ex.name}`}
                  onClick={() => onChange({ ...profile, excluded: [...excluded, ex.name] })}
                >
                  ⇄
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <details className="guide">
        <summary>How to progress</summary>
        <div className="guide-body">
          <p>{plan.progression.summary}</p>
          <ol className="weeks">
            {plan.progression.weeks.map((w, i) => (
              <li key={w.week} className={cycle?.index === i ? "current" : undefined}>
                <span className="weeks-when">{w.week}</span>
                <span className={`effort ${w.effort.toLowerCase()}`}>{w.effort}</span>
                <span className="weeks-what">{w.detail}</span>
              </li>
            ))}
          </ol>
          <p><strong>For your goal:</strong> {plan.progression.goalTip}</p>
          <h3>When to back off</h3>
          <ul>
            {plan.progression.backOff.map((tip) => <li key={tip}>{tip}</li>)}
          </ul>
          {plan.progression.levelUp && <p><strong>Moving up:</strong> {plan.progression.levelUp}</p>}
        </div>
      </details>

      <details className="guide">
        <summary>Warm-up and cool-down</summary>
        <div className="guide-body">
          <p><strong>Warm-up:</strong> {plan.warmUp}</p>
          <p><strong>Cool-down:</strong> {plan.coolDown}</p>
        </div>
      </details>
      {tab("plan")}
    </div>
  );
}

const TABS = [
  { kind: "plan", label: "Today", icon: "M4 11h3v2H4zm13 0h3v2h-3zM7 7h3v10H7zm7 0h3v10h-3zm-4 4h4v2h-4z" },
  { kind: "history", label: "Progress", icon: "M4 19h16v2H4zm1-3 4-5 3 3 5-7 2 1.5-6.5 9-3-3L6.6 17.2z" },
  { kind: "profile", label: "Profile", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z" },
] as const;

function TabBar({ current, logged, onSelect }: { current: string; logged: number; onSelect: (kind: (typeof TABS)[number]["kind"]) => void }) {
  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((t) => (
        <button key={t.kind} type="button" className={t.kind === current ? "tab on" : "tab"} aria-current={t.kind === current ? "page" : undefined} onClick={() => onSelect(t.kind)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.icon} /></svg>
          <span>{t.label}</span>
          {t.kind === "history" && logged > 0 && <span className="tab-badge">{logged}</span>}
        </button>
      ))}
    </nav>
  );
}

/** This week's training days against the plan, as a ring, with the current streak. */
function GoalRing({ week }: { week: WeeklyProgress }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const share = Math.min(1, week.done / week.goal);
  return (
    <div className="goal" role="img" aria-label={`${week.done} of ${week.goal} workouts this week${week.streak > 1 ? `, ${week.streak}-week streak` : ""}`}>
      <svg viewBox="0 0 64 64">
        <circle className="goal-track" cx="32" cy="32" r={r} />
        {share > 0 && <circle className="goal-fill" cx="32" cy="32" r={r} strokeDasharray={`${share * c} ${c}`} transform="rotate(-90 32 32)" />}
        <text x="32" y="32" dy="0.35em" textAnchor="middle">{week.done}/{week.goal}</text>
      </svg>
      <span className="goal-label">{week.streak > 1 ? `${week.streak}-week streak` : "this week"}</span>
    </div>
  );
}

function ProfileScreen({
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
  const excluded = profile.excluded ?? [];
  const [confirmReset, setConfirmReset] = useState(false);
  const rows: [string, string][] = [
    ["Goal", labelOf(GOALS, profile.goal)],
    ["Level", labelOf(LEVELS, profile.level)],
    ["Schedule", `${WEEKDAYS.filter((d) => (profile.weekdays ?? []).includes(d)).join(", ")} · ${profile.sessionMinutes} min`],
    ["Equipment", profile.equipment.map((e) => labelOf(EQUIPMENT, e)).join(", ") || "Bodyweight only"],
    ["Working around", (profile.limitations ?? []).map((l) => labelOf(LIMITATIONS, l)).join(", ") || "Nothing"],
    ["Extra focus", (profile.focus ?? []).map((f) => labelOf(FOCUS_AREAS, f)).join(", ") || "None"],
  ];

  return (
    <section className="screen">
      <header className="topbar">
        <h1>Profile</h1>
      </header>

      <div className="card">
        <dl className="summary">
          {rows.map(([k, v]) => (
            <div key={k} className="summary-row">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="primary" onClick={onEdit}>Edit answers</button>
      </div>

      <div className="card">
        <h2>Weight units</h2>
        <div className="segmented" role="radiogroup" aria-label="Weight units">
          {(["kg", "lb"] as const).map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={profile.units === u}
              className={profile.units === u ? "chip on" : "chip"}
              onClick={() => onChange({ ...profile, units: u })}
            >
              {u}
            </button>
          ))}
        </div>
        <p className="muted">Changing units doesn't convert weights you've already logged.</p>
      </div>

      <div className="card">
        <h2>Removed exercises</h2>
        {excluded.length === 0 ? (
          <p className="muted">None. Tap ⇄ next to an exercise in your plan to swap it out.</p>
        ) : (
          <ul className="removed">
            {excluded.map((n) => (
              <li key={n}>
                <span>{n}</span>
                <button type="button" className="ghost small" onClick={() => onChange({ ...profile, excluded: excluded.filter((x) => x !== n) })}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        {confirmReset ? (
          <div className="confirm">
            <p>Start over with new onboarding answers? Your workout history is kept.</p>
            <div className="tip-actions">
              <button type="button" className="danger small" onClick={onReset}>Start over</button>
              <button type="button" className="ghost small" onClick={() => setConfirmReset(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" className="ghost danger-text" onClick={() => setConfirmReset(true)}>Start over…</button>
        )}
      </div>
    </section>
  );
}
