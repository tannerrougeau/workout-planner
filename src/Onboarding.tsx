import { useState, type ReactNode } from "react";
import {
  LIFTS,
  PROGRESS_RATES,
  PUSH_UPS,
  TRAINING_TIME,
  assessLevel,
  isAssessmentComplete,
  type AssessmentAnswers,
} from "./assessment";
import { WEEKDAYS } from "./planner";
import {
  EQUIPMENT,
  EQUIPMENT_PRESETS,
  FOCUS_AREAS,
  GOALS,
  LEVELS,
  LIMITATIONS,
  SESSION_LENGTHS,
  labelOf,
  toggle,
  type Option,
} from "./options";
import type { UserProfile } from "./profile";

interface Props {
  initial: UserProfile;
  onComplete: (profile: UserProfile) => void;
  onCancel?: () => void;
}

const STEPS = ["About you", "Goal", "Experience", "Level", "Schedule", "Equipment", "Body", "Review"] as const;
type StepName = (typeof STEPS)[number];

export function Onboarding({ initial, onComplete, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<UserProfile>(initial);
  const update = (patch: Partial<UserProfile>) => setProfile((prev) => ({ ...prev, ...patch }));
  const goTo = (name: StepName) => setStep(STEPS.indexOf(name));

  // Changing any answer re-assigns the level; the user can still override it on the Level step.
  const answer = (patch: Partial<AssessmentAnswers>) =>
    setProfile((prev) => {
      const assessment = { ...prev.assessment, ...patch };
      return { ...prev, assessment, level: assessLevel(assessment).level };
    });

  const weekdays = profile.weekdays ?? [];
  const recommended = assessLevel(profile.assessment);
  const canContinue =
    (STEPS[step] !== "Schedule" || (weekdays.length >= 2 && weekdays.length <= 6)) &&
    (STEPS[step] !== "Experience" || isAssessmentComplete(profile.assessment));
  const isLast = step === STEPS.length - 1;

  const next = () => {
    if (!canContinue) return;
    if (isLast) onComplete({ ...profile, name: profile.name.trim(), daysPerWeek: weekdays.length });
    else setStep(step + 1);
  };

  return (
    <div className="onboarding">
      <div className="progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <span key={s} className={i < step ? "dot done" : i === step ? "dot current" : "dot"} title={s} />
        ))}
      </div>

      <form
        className="step"
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        {STEPS[step] === "About you" && (
          <Step title="Let's build your plan" subtitle="A few quick questions and you'll get a weekly plan made for you.">
            <label className="field">
              What should we call you?
              <input
                autoFocus
                type="text"
                placeholder="Your name (optional)"
                value={profile.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </label>
          </Step>
        )}

        {STEPS[step] === "Goal" && (
          <Step title="What's your main goal?">
            <Choices options={GOALS} selected={[profile.goal]} onPick={(goal) => update({ goal })} />
          </Step>
        )}

        {STEPS[step] === "Experience" && (
          <Step title="Let's find your starting level" subtitle="Answer honestly. We'll use this to pick exercises and how you progress.">
            <h3 className="sub">How long have you been training consistently?</h3>
            <Choices
              options={TRAINING_TIME}
              selected={profile.assessment.trainingTime ? [profile.assessment.trainingTime] : []}
              onPick={(trainingTime) => answer({ trainingTime })}
            />
            <h3 className="sub">How many push-ups can you do in a row with good form?</h3>
            <Choices
              row
              options={PUSH_UPS}
              selected={profile.assessment.pushUps ? [profile.assessment.pushUps] : []}
              onPick={(pushUps) => answer({ pushUps })}
            />
            <h3 className="sub">Which of these can you do with good form? <span className="optional">Pick any</span></h3>
            <Choices
              multi
              options={LIFTS}
              selected={profile.assessment.lifts}
              onPick={(lift) => answer({ lifts: toggle(profile.assessment.lifts, lift) })}
            />
            <h3 className="sub">How often do your lifts still go up?</h3>
            <Choices
              options={PROGRESS_RATES}
              selected={profile.assessment.progress ? [profile.assessment.progress] : []}
              onPick={(progress) => answer({ progress })}
            />
            {!canContinue && <p className="warn">Answer the questions above to continue.</p>}
          </Step>
        )}

        {STEPS[step] === "Level" && (
          <Step title={`You're starting as ${labelOf(LEVELS, recommended.level)}`} subtitle={recommended.reason}>
            <Choices
              options={LEVELS.map((o) => (o.value === recommended.level ? { ...o, label: `${o.label} (recommended)` } : o))}
              selected={[profile.level]}
              onPick={(level) => update({ level })}
            />
            {profile.level !== recommended.level && (
              <p className="warn">You've picked a different level than we recommend. You can change it any time.</p>
            )}
          </Step>
        )}

        {STEPS[step] === "Schedule" && (
          <Step title="When can you train?" subtitle="Pick 2 to 6 days. Rest days in between help you recover.">
            <div className="weekday-picker">
              {WEEKDAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={weekdays.includes(d) ? "chip on" : "chip"}
                  aria-pressed={weekdays.includes(d)}
                  onClick={() => update({ weekdays: toggle(weekdays, d) })}
                >
                  {d}
                </button>
              ))}
            </div>
            {!canContinue && <p className="warn">Choose between 2 and 6 days.</p>}
            <label className="field">
              How long is each session?
              <select value={profile.sessionMinutes} onChange={(e) => update({ sessionMinutes: Number(e.target.value) })}>
                {SESSION_LENGTHS.map((m) => (
                  <option key={m} value={m}>{m} minutes</option>
                ))}
              </select>
            </label>
          </Step>
        )}

        {STEPS[step] === "Equipment" && (
          <Step title="What equipment do you have?" subtitle="Bodyweight exercises are always included.">
            <div className="presets">
              {EQUIPMENT_PRESETS.map((p) => (
                <button key={p.label} type="button" className="chip" onClick={() => update({ equipment: p.equipment })}>
                  {p.label}
                </button>
              ))}
            </div>
            <Choices
              multi
              options={EQUIPMENT}
              selected={profile.equipment}
              onPick={(eq) => update({ equipment: toggle(profile.equipment, eq) })}
            />
          </Step>
        )}

        {STEPS[step] === "Body" && (
          <Step title="Anything we should work around?" subtitle="We'll skip exercises that load these joints heavily.">
            <Choices
              multi
              options={LIMITATIONS}
              selected={profile.limitations ?? []}
              onPick={(l) => update({ limitations: toggle(profile.limitations ?? [], l) })}
            />
            <h3 className="sub">Any areas you'd like extra work on?</h3>
            <Choices
              multi
              options={FOCUS_AREAS}
              selected={profile.focus ?? []}
              onPick={(f) => update({ focus: toggle(profile.focus ?? [], f) })}
            />
          </Step>
        )}

        {STEPS[step] === "Review" && (
          <Step title={profile.name.trim() ? `Looking good, ${profile.name.trim()}` : "Looking good"} subtitle="Check your answers, then build your plan.">
            <dl className="review">
              <ReviewRow label="Goal" value={labelOf(GOALS, profile.goal)} onEdit={() => goTo("Goal")} />
              <ReviewRow label="Level" value={labelOf(LEVELS, profile.level)} onEdit={() => goTo("Experience")} />
              <ReviewRow
                label="Schedule"
                value={`${WEEKDAYS.filter((d) => weekdays.includes(d)).join(", ")} · ${profile.sessionMinutes} min`}
                onEdit={() => goTo("Schedule")}
              />
              <ReviewRow
                label="Equipment"
                value={profile.equipment.map((e) => labelOf(EQUIPMENT, e)).join(", ") || "Bodyweight only"}
                onEdit={() => goTo("Equipment")}
              />
              <ReviewRow
                label="Work around"
                value={(profile.limitations ?? []).map((l) => labelOf(LIMITATIONS, l)).join(", ") || "Nothing"}
                onEdit={() => goTo("Body")}
              />
              <ReviewRow
                label="Extra focus"
                value={(profile.focus ?? []).map((f) => labelOf(FOCUS_AREAS, f)).join(", ") || "None"}
                onEdit={() => goTo("Body")}
              />
            </dl>
          </Step>
        )}

        <div className="nav">
          {step > 0 ? (
            <button type="button" className="secondary" onClick={() => setStep(step - 1)}>Back</button>
          ) : onCancel ? (
            <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
          ) : (
            <span />
          )}
          <button type="submit" className="primary" disabled={!canContinue}>
            {isLast ? "Build my plan" : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Step({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <>
      <h2>{title}</h2>
      {subtitle && <p className="subtitle">{subtitle}</p>}
      {children}
    </>
  );
}

function Choices<T extends string>({
  options,
  selected,
  onPick,
  multi = false,
  row = false,
}: {
  options: Option<T>[];
  selected: T[];
  onPick: (value: T) => void;
  multi?: boolean;
  /** Lay short single-choice options out side by side. */
  row?: boolean;
}) {
  return (
    <div className={multi || row ? "choices multi" : "choices"} role={multi ? "group" : "radiogroup"}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={on}
            className={on ? "choice on" : "choice"}
            onClick={() => onPick(o.value)}
          >
            <span className="choice-label">{o.label}</span>
            {o.hint && <span className="choice-hint">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="review-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
      <button type="button" className="link" onClick={onEdit}>Edit</button>
    </div>
  );
}
