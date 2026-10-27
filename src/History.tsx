import { useMemo, useState, type PointerEvent } from "react";
import { exerciseSeries, formatWeight, personalBests, type SeriesPoint } from "./progress";
import { fromLocalDate, type SessionLog, type Units } from "./workoutLog";

const FEELING_LABEL = { easy: "Too easy", right: "Just right", hard: "Too hard" } as const;

interface Props {
  sessions: SessionLog[];
  units: Units;
  onDelete: (id: string) => void;
}

export function History({ sessions, units, onDelete }: Props) {
  const names = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) for (const e of s.exercises) if (e.values.length > 0) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }, [sessions]);
  const [chosen, setChosen] = useState<string | undefined>();
  const exercise = chosen && names.includes(chosen) ? chosen : names[0];
  const [confirming, setConfirming] = useState<string | undefined>();

  return (
    <section className="history">
      <header className="topbar">
        <h1>Progress</h1>
      </header>

      {sessions.length === 0 ? (
        <p className="empty">No workouts yet. Start a workout from the Today tab, and your progress will show up here.</p>
      ) : (
        <>
          <div className="chart-card">
            <label className="inline">
              Exercise
              <select id="chart-exercise" value={exercise} onChange={(e) => setChosen(e.target.value)}>
                {names.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            {exercise && <ProgressChart name={exercise} {...exerciseSeries(exercise, sessions, units)} />}
          </div>

          <ol className="sessions">
            {sessions.map((s, i) => ({ s, bests: personalBests(s, sessions.slice(0, i)) })).reverse().map(({ s, bests }) => (
              <li key={s.id} className="session">
                <div className="session-head">
                  <strong>{fromLocalDate(s.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</strong>
                  <span>{s.dayTitle}{s.durationMin !== undefined && ` · ${s.durationMin} min`}</span>
                  {s.feeling && <span className={`pill ${s.feeling}`}>{FEELING_LABEL[s.feeling]}</span>}
                  {confirming === s.id ? (
                    <span className="confirm">
                      Delete this workout?
                      <button type="button" className="link danger" onClick={() => onDelete(s.id)}>Delete</button>
                      <button type="button" className="link" onClick={() => setConfirming(undefined)}>Keep</button>
                    </span>
                  ) : (
                    <button type="button" className="link quiet" aria-label={`Delete workout from ${s.date}`} onClick={() => setConfirming(s.id)}>Delete</button>
                  )}
                </div>
                <ul>
                  {s.exercises.map((e) => (
                    <li key={e.name}>
                      {e.name}: {e.values.length > 0 ? `${e.weight !== undefined ? `${formatWeight(e.weight, units)} × ` : ""}${e.values.join(", ")}` : "not logged"}
                      {bests.includes(e.name) && <span className="pill best">New best</span>}
                      {e.trouble && <span className="pill trouble">Trouble</span>}
                    </li>
                  ))}
                </ul>
                {s.notes && <p className="session-notes">{s.notes}</p>}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

// Sized close to a phone's width so axis text stays readable when the SVG scales down.
const W = 400;
const H = 200;
const PAD = { top: 16, right: 48, bottom: 28, left: 40 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let t = Math.floor(min / step) * step; t <= max + step / 2; t += step) ticks.push(Number(t.toFixed(4)));
  return ticks;
}

/** One series over time: weight per session, or the best set for unweighted exercises. */
function ProgressChart({ name, points, measure }: { name: string; points: SeriesPoint[]; measure: string }) {
  const [hover, setHover] = useState<number | undefined>();
  if (points.length === 0) return <p className="empty">No sets logged for {name} yet.</p>;

  const times = points.map((p) => fromLocalDate(p.date).getTime());
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const ticks = niceTicks(Math.min(...points.map((p) => p.value)), Math.max(...points.map((p) => p.value)));
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + (t1 === t0 ? innerW / 2 : ((t - t0) / (t1 - t0)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - y0) / (y1 - y0)) * innerH;
  const xs = times.map(x);
  const shortDate = (s: string) => fromLocalDate(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const last = points.length - 1;
  const active = hover ?? last;

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    xs.forEach((cx, i) => {
      if (Math.abs(cx - px) < Math.abs(xs[best] - px)) best = i;
    });
    setHover(best);
  };

  return (
    <figure className="chart">
      <figcaption>{name} · {measure}</figcaption>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${name}, ${measure}, ${points.length} sessions, latest ${points[last].value}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
              <text className="axis" x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">{t}</text>
            </g>
          ))}
          <text className="axis" x={xs[0]} y={H - 8} textAnchor={points.length > 1 ? "start" : "middle"}>{shortDate(points[0].date)}</text>
          {points.length > 1 && <text className="axis" x={xs[last]} y={H - 8} textAnchor="end">{shortDate(points[last].date)}</text>}
          {hover !== undefined && <line className="crosshair" x1={xs[hover]} x2={xs[hover]} y1={PAD.top} y2={PAD.top + innerH} />}
          {points.length > 1 && <polyline className="series" points={points.map((p, i) => `${xs[i]},${y(p.value)}`).join(" ")} />}
          {points.map((p, i) => (
            <circle key={p.date + i} className={i === active ? "dot active" : "dot"} cx={xs[i]} cy={y(p.value)} r={i === active ? 5 : 4} />
          ))}
          <text className="direct-label" x={xs[last] + 10} y={y(points[last].value)} dy="0.32em">{points[last].value}</text>
          <rect
            className="hit"
            x={PAD.left - 12}
            y={PAD.top}
            width={innerW + 24}
            height={innerH}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(undefined)}
          />
        </svg>
        {hover !== undefined && (
          <div className="tooltip" style={{ left: `${(xs[hover] / W) * 100}%`, top: `${(y(points[hover].value) / H) * 100}%` }}>
            <strong>{shortDate(points[hover].date)}</strong>
            <span>{points[hover].detail}</span>
          </div>
        )}
      </div>
    </figure>
  );
}
