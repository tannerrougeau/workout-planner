import { useState } from "react";
import { ACTIVITIES } from "./activities";
import { createEvent, promoteEvent } from "./api";
import { EventMap } from "./EventMap";
import { toLocalInput, type LatLng } from "./format";
import { currentPosition } from "./push";

const DURATIONS = [30, 45, 60, 90, 120, 180];

export function EventForm({ near, onCreated, onCancel }: { near?: LatLng; onCreated: (id: string) => void; onCancel: () => void }) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(9, 0, 0, 0);
  const [title, setTitle] = useState("");
  const [activity, setActivity] = useState<string>("Running");
  const [when, setWhen] = useState(toLocalInput(tomorrow));
  const [duration, setDuration] = useState(60);
  const [place, setPlace] = useState("");
  const [spot, setSpot] = useState<LatLng | undefined>();
  const [capacity, setCapacity] = useState("");
  const [visibility, setVisibility] = useState<"public" | "invite">("public");
  const [description, setDescription] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const useMyLocation = async () => {
    setError("");
    try {
      setSpot(await currentPosition());
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const submit = async () => {
    setError("");
    const start = new Date(when);
    if (title.trim().length < 3) return setError("Give the event a title of at least 3 characters.");
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) return setError("Pick a start time in the future.");
    if (place.trim().length < 2) return setError("Name the meeting place, e.g. “Riverside Park, north entrance”.");
    if (!spot) return setError("Tap the map to mark the meeting place.");
    const cap = capacity ? Number(capacity) : null;
    if (cap !== null && (!Number.isInteger(cap) || cap < 2 || cap > 500)) return setError("Spots should be a number from 2 to 500, or left empty.");

    setBusy(true);
    try {
      const id = await createEvent({
        title: title.trim(),
        activity,
        description: description.trim(),
        starts_at: start.toISOString(),
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        duration_min: duration,
        place_name: place.trim(),
        lat: spot.lat,
        lng: spot.lng,
        capacity: cap,
        visibility,
      });
      if (notify && visibility === "public") await promoteEvent(id).catch(() => undefined);
      onCreated(id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <form
      className="screen"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="screen-head">
        <button type="button" className="ghost" onClick={onCancel}>← Hub</button>
        <h1>New event</h1>
      </div>

      <div className="card">
        <label className="field">
          Title
          <input id="ev-title" value={title} maxLength={80} placeholder="e.g. Saturday 5K easy run" onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          Sport or style
          <select id="ev-activity" value={activity} onChange={(e) => setActivity(e.target.value)}>
            {ACTIVITIES.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <div className="form-row">
          <label className="field">
            Starts
            <input id="ev-when" type="datetime-local" value={when} min={toLocalInput(new Date())} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <label className="field">
            Length
            <select id="ev-duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((d) => <option key={d} value={d}>{d < 60 ? `${d} min` : `${d / 60} h`}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        <label className="field">
          Meeting place
          <input id="ev-place" value={place} maxLength={120} placeholder="e.g. Riverside Park, north entrance" onChange={(e) => setPlace(e.target.value)} />
        </label>
        <p className="muted">Pick a public spot like a park, track or gym. Never use a home address.</p>
        <EventMap center={spot ?? near} pick={{ value: spot, onPick: setSpot }} height={240} />
        <div className="tip-actions">
          <button type="button" className="secondary small" onClick={useMyLocation}>Use my location</button>
          {spot ? <span className="muted">Pin placed. Drag it to adjust.</span> : <span className="muted">Or tap the map.</span>}
        </div>
      </div>

      <div className="card">
        <label className="field">
          Details <span className="optional">Optional</span>
          <textarea id="ev-desc" rows={3} maxLength={2000} placeholder="Pace, level, what to bring, where exactly to meet" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="field">
          Spots <span className="optional">Leave empty for no limit</span>
          <input id="ev-cap" type="number" inputMode="numeric" min={2} max={500} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </label>
        <fieldset className="field plain">
          <legend>Who can see it</legend>
          <div className="segmented" role="radiogroup" aria-label="Who can see it">
            <button type="button" role="radio" aria-checked={visibility === "public"} className={visibility === "public" ? "chip on" : "chip"} onClick={() => setVisibility("public")}>Anyone</button>
            <button type="button" role="radio" aria-checked={visibility === "invite"} className={visibility === "invite" ? "chip on" : "chip"} onClick={() => setVisibility("invite")}>Invite link only</button>
          </div>
        </fieldset>
        {visibility === "public" && (
          <label className="check">
            <input id="ev-notify" type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Alert people nearby who turned on event alerts
          </label>
        )}
      </div>

      {error && <p className="warn">{error}</p>}
      <div className="action-bar">
        <button type="submit" className="primary big" disabled={busy}>{busy ? "Publishing…" : "Publish event"}</button>
      </div>
    </form>
  );
}
