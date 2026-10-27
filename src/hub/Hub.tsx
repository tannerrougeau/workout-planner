import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ACTIVITIES } from "./activities";
import {
  blockedIds,
  getNotifyPrefs,
  joinWithCode,
  listEvents,
  listPosts,
  myEvents,
  myName,
  previewInvite,
  saveDevice,
  saveNotifyPrefs,
  sendSignInLink,
  setMyName,
  signOut,
  unblock,
  type HubEvent,
  type HubPost,
  type NotifyPrefs,
} from "./api";
import { hubConfigured, supabase } from "./config";
import { EventDetail } from "./EventDetail";
import { EventForm } from "./EventForm";
import { EventMap } from "./EventMap";
import { distanceKm, eventStatus, formatDistance, roundToKm, type LatLng } from "./format";
import { Composer, PostList } from "./Posts";
import { currentPosition, pushProblem, subscribeDevice } from "./push";

type View =
  | { kind: "home" }
  | { kind: "event"; id: string }
  | { kind: "create" }
  | { kind: "invite"; id: string; code: string };

type Section = "events" | "feed" | "settings";

const LOCATION_KEY = "workout-planner.hub.near";
const RADII = [5, 10, 25, 50];

function savedNear(): LatLng | undefined {
  try {
    const raw = sessionStorage.getItem(LOCATION_KEY);
    return raw ? (JSON.parse(raw) as LatLng) : undefined;
  } catch {
    return undefined;
  }
}

export function Hub({ initialLink, onLinkUsed }: { initialLink?: { eventId: string; code?: string }; onLinkUsed?: () => void }) {
  const [session, setSession] = useState<Session | null | undefined>(hubConfigured ? undefined : null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!hubConfigured) {
    return (
      <section className="screen">
        <header className="topbar"><h1>Hub</h1></header>
        <div className="card">
          <h2>Coming soon</h2>
          <p className="muted">The community hub needs its online service connected before it can be used.</p>
        </div>
      </section>
    );
  }
  if (session === undefined) return <p className="empty">Loading…</p>;
  if (!session) return <SignIn invited={Boolean(initialLink)} />;
  return <HubHome userId={session.user.id} initialLink={initialLink} onLinkUsed={onLinkUsed} />;
}

function SignIn({ invited }: { invited: boolean }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      await sendSignInLink(email.trim());
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="screen">
      <header className="topbar">
        <p className="eyebrow">Community</p>
        <h1>Hub</h1>
      </header>
      <div className="hero">
        <h2>{invited ? "You've been invited to a workout" : "Train with people near you"}</h2>
        <p className="hero-meta">Find and join meetups for your sport or favorite style, organize your own, and share photos and videos from the session.</p>
        {sent ? (
          <p className="ok">Check {email} for a sign-in link. Open it on this device to continue.</p>
        ) : (
          <form className="signin" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <label className="field">
              Email
              <input id="hub-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <button type="submit" className="primary big" disabled={busy || !email.includes("@")}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
            <p className="muted">No password needed. Your email is never shown to other members.</p>
          </form>
        )}
        {error && <p className="warn">{error}</p>}
      </div>
    </section>
  );
}

function HubHome({ userId, initialLink, onLinkUsed }: { userId: string; initialLink?: { eventId: string; code?: string }; onLinkUsed?: () => void }) {
  useEffect(() => onLinkUsed?.(), [onLinkUsed]);
  const [view, setView] = useState<View>(() =>
    initialLink?.code ? { kind: "invite", id: initialLink.eventId, code: initialLink.code } : initialLink ? { kind: "event", id: initialLink.eventId } : { kind: "home" },
  );
  const [section, setSection] = useState<Section>("events");
  const [near, setNear] = useState<LatLng | undefined>(savedNear);

  const setLocation = (p: LatLng | undefined) => {
    setNear(p);
    try {
      if (p) sessionStorage.setItem(LOCATION_KEY, JSON.stringify(p));
      else sessionStorage.removeItem(LOCATION_KEY);
    } catch {
      // Location just won't be remembered for this visit.
    }
  };

  if (view.kind === "event") return <EventDetail id={view.id} userId={userId} onBack={() => setView({ kind: "home" })} />;
  if (view.kind === "create") return <EventForm near={near} onCreated={(id) => setView({ kind: "event", id })} onCancel={() => setView({ kind: "home" })} />;
  if (view.kind === "invite") return <Invite id={view.id} code={view.code} onDone={(id) => setView(id ? { kind: "event", id } : { kind: "home" })} />;

  return (
    <section className="screen">
      <header className="topbar">
        <p className="eyebrow">Community</p>
        <h1>Hub</h1>
      </header>
      <div className="segmented tabs-inline" role="tablist" aria-label="Hub sections">
        {(["events", "feed", "settings"] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={section === s} className={section === s ? "chip on" : "chip"} onClick={() => setSection(s)}>
            {s === "events" ? "Events" : s === "feed" ? "Feed" : "Settings"}
          </button>
        ))}
      </div>
      {section === "events" && <EventsSection userId={userId} near={near} onNear={setLocation} onOpen={(id) => setView({ kind: "event", id })} onCreate={() => setView({ kind: "create" })} />}
      {section === "feed" && <FeedSection userId={userId} onOpenEvent={(id) => setView({ kind: "event", id })} />}
      {section === "settings" && <SettingsSection userId={userId} />}
    </section>
  );
}

function EventsSection({
  userId,
  near,
  onNear,
  onOpen,
  onCreate,
}: {
  userId: string;
  near?: LatLng;
  onNear: (p: LatLng | undefined) => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const [events, setEvents] = useState<HubEvent[] | undefined>();
  const [mine, setMine] = useState<HubEvent[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [radius, setRadius] = useState(25);
  const [activity, setActivity] = useState<string>("All");
  const [mode, setMode] = useState<"list" | "map">("list");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [all, own, b] = await Promise.all([listEvents(near, radius), myEvents(userId), blockedIds()]);
      setEvents(all);
      setMine(own.filter((e) => eventStatus(e, new Date()) !== "ended" && !e.cancelled));
      setBlocked(b);
    } catch (e) {
      setError((e as Error).message);
      setEvents([]);
    }
  }, [near, radius, userId]);
  useEffect(() => void load(), [load]);

  const locate = async () => {
    setError("");
    try {
      onNear(await currentPosition());
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const shown = useMemo(
    () => (events ?? []).filter((e) => !blocked.includes(e.owner_id) && (activity === "All" || e.activity === activity)),
    [events, blocked, activity],
  );
  const pins = useMemo(() => shown.map((e) => ({ id: e.id, lat: e.lat, lng: e.lng, label: `${e.title} · ${e.activity}` })), [shown]);
  const activitiesInUse = useMemo(() => ACTIVITIES.filter((a) => (events ?? []).some((e) => e.activity === a)), [events]);

  return (
    <>
      <button type="button" className="primary big" onClick={onCreate}>Create an event</button>

      {mine.length > 0 && (
        <>
          <h2 className="section-title">Your upcoming events</h2>
          <ul className="event-list">{mine.map((e) => <EventCard key={e.id} event={e} near={near} onOpen={onOpen} />)}</ul>
        </>
      )}

      <h2 className="section-title">{near ? "Near you" : "Upcoming events"}</h2>
      <div className="filters">
        {near ? (
          <label className="inline">
            Within
            <select id="hub-radius" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
              {RADII.map((r) => <option key={r} value={r}>{r} km</option>)}
            </select>
            <button type="button" className="ghost small" onClick={() => onNear(undefined)}>Show all</button>
          </label>
        ) : (
          <button type="button" className="secondary small" onClick={locate}>Show events near me</button>
        )}
        <div className="segmented">
          <button type="button" className={mode === "list" ? "chip small on" : "chip small"} aria-pressed={mode === "list"} onClick={() => setMode("list")}>List</button>
          <button type="button" className={mode === "map" ? "chip small on" : "chip small"} aria-pressed={mode === "map"} onClick={() => setMode("map")}>Map</button>
        </div>
      </div>
      {activitiesInUse.length > 1 && (
        <div className="chip-row" role="group" aria-label="Filter by sport or style">
          {["All", ...activitiesInUse].map((a) => (
            <button key={a} type="button" className={activity === a ? "chip small on" : "chip small"} aria-pressed={activity === a} onClick={() => setActivity(a)}>{a}</button>
          ))}
        </div>
      )}
      {error && <p className="warn">{error}</p>}

      {events === undefined ? (
        <p className="empty">Loading events…</p>
      ) : mode === "map" ? (
        <EventMap pins={pins} center={near} onSelect={onOpen} height={360} />
      ) : shown.length === 0 ? (
        <p className="empty">{near ? `No upcoming events within ${radius} km. Create one and invite people.` : "No upcoming events yet. Create the first one."}</p>
      ) : (
        <ul className="event-list">{shown.map((e) => <EventCard key={e.id} event={e} near={near} onOpen={onOpen} />)}</ul>
      )}
    </>
  );
}

function EventCard({ event, near, onOpen }: { event: HubEvent; near?: LatLng; onOpen: (id: string) => void }) {
  const start = new Date(event.starts_at);
  const status = eventStatus(event, new Date());
  return (
    <li>
      <button type="button" className="event-card" onClick={() => onOpen(event.id)}>
        <span className="date-block">
          <span className="date-month">{start.toLocaleDateString(undefined, { month: "short" })}</span>
          <span className="date-day">{start.getDate()}</span>
        </span>
        <span className="event-card-main">
          <span className="event-card-title">{event.title}</span>
          <span className="muted">
            {start.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })} · {event.place_name}
          </span>
          <span className="event-card-meta">
            <span className="pill activity">{event.activity}</span>
            <span className="muted">{event.going} going{near ? ` · ${formatDistance(distanceKm(near, event))}` : ""}</span>
            {event.joined && <span className="pill right">Going</span>}
            {status === "live" && <span className="pill hard">Now</span>}
            {status === "full" && !event.joined && <span className="pill">Full</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

function FeedSection({ userId, onOpenEvent }: { userId: string; onOpenEvent: (id: string) => void }) {
  const [posts, setPosts] = useState<HubPost[] | undefined>();
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [p, b] = await Promise.all([listPosts(), blockedIds()]);
      setPosts(p.filter((x) => !b.includes(x.author_id)));
    } catch (e) {
      setError((e as Error).message);
      setPosts([]);
    }
  }, []);
  useEffect(() => void load(), [load]);

  return (
    <>
      <Composer userId={userId} onPosted={load} />
      {error && <p className="warn">{error}</p>}
      {posts === undefined ? <p className="empty">Loading posts…</p> : <PostList posts={posts} userId={userId} onChanged={load} onOpenEvent={onOpenEvent} />}
    </>
  );
}

function Invite({ id, code, onDone }: { id: string; code: string; onDone: (id?: string) => void }) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof previewInvite>> | null | undefined>();
  const [error, setError] = useState("");
  useEffect(() => {
    previewInvite(id, code).then((i) => setInfo(i ?? null), (e: Error) => { setError(e.message); setInfo(null); });
  }, [id, code]);

  const join = async () => {
    try {
      await joinWithCode(id, code);
      onDone(id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section className="screen">
      <div className="screen-head"><button type="button" className="ghost" onClick={() => onDone()}>← Hub</button></div>
      {info === undefined ? (
        <p className="empty">Loading invite…</p>
      ) : info === null ? (
        <p className="empty">This invite link isn't valid anymore. Ask the organizer for a new one.</p>
      ) : (
        <div className="hero">
          <p className="eyebrow">{info.owner_name} invited you · {info.activity}</p>
          <h2>{info.title}</h2>
          <p className="hero-meta">
            {new Date(info.starts_at).toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
          <p className="hero-meta">{info.place_name}</p>
          <div className="tip-actions">
            <button type="button" className="primary" onClick={join}>Join event</button>
            <button type="button" className="ghost" onClick={() => onDone()}>Not now</button>
          </div>
        </div>
      )}
      {error && <p className="warn">{error}</p>}
    </section>
  );
}

function SettingsSection({ userId }: { userId: string }) {
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [prefs, setPrefs] = useState<NotifyPrefs | undefined>();
  const [radius, setRadius] = useState(25);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([myName(userId), getNotifyPrefs(), blockedIds()]).then(
      ([n, p, b]) => {
        setName(n);
        setSavedName(n);
        setPrefs(p);
        if (p) setRadius(p.radius_km);
        setBlocked(b);
      },
      (e: Error) => setError(e.message),
    );
  }, [userId]);

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(done);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const turnOnAlerts = () =>
    run(async () => {
      const sub = await subscribeDevice();
      const spot = roundToKm(await currentPosition());
      const next = { enabled: true, ...spot, radius_km: radius };
      await saveDevice(userId, sub);
      await saveNotifyPrefs(userId, next);
      setPrefs(next);
    }, "Alerts are on for this device.");

  const problem = pushProblem();

  return (
    <>
      <div className="card">
        <h2>Your name</h2>
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); void run(async () => { await setMyName(userId, name); setSavedName(name.trim()); }, "Name saved."); }}>
          <label className="visually-hidden" htmlFor="hub-name">Name shown to other members</label>
          <input id="hub-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="primary small" disabled={busy || !name.trim() || name.trim() === savedName}>Save</button>
        </form>
        <p className="muted">This is the only thing other members see about you.</p>
      </div>

      <div className="card">
        <h2>Event alerts</h2>
        <p className="muted">Get a notification when someone near you publishes an event. Your location is rounded to about 1 km and never shown to anyone.</p>
        <label className="inline">
          Within
          <select id="alert-radius" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
            {RADII.map((r) => <option key={r} value={r}>{r} km</option>)}
          </select>
        </label>
        {problem ? (
          <p className="warn">{problem}</p>
        ) : prefs?.enabled ? (
          <div className="tip-actions">
            <button type="button" className="secondary small" disabled={busy} onClick={turnOnAlerts}>Update location and distance</button>
            <button type="button" className="ghost small" disabled={busy} onClick={() => run(async () => {
              const next = { ...prefs, enabled: false };
              await saveNotifyPrefs(userId, next);
              setPrefs(next);
            }, "Alerts are off.")}>Turn off</button>
          </div>
        ) : (
          <button type="button" className="primary small" disabled={busy} onClick={turnOnAlerts}>Turn on event alerts</button>
        )}
      </div>

      {blocked.length > 0 && (
        <div className="card">
          <h2>Blocked members ({blocked.length})</h2>
          <p className="muted">You won't see their events or posts.</p>
          <button type="button" className="ghost small" disabled={busy} onClick={() => run(async () => {
            await Promise.all(blocked.map(unblock));
            setBlocked([]);
          }, "Everyone is unblocked.")}>Unblock everyone</button>
        </div>
      )}

      <div className="card">
        <h2>Meet safely</h2>
        <ul className="safety">
          <li>Meet in public places and tell a friend where you're going.</li>
          <li>Report events or posts that feel unsafe; several reports hide a post until it's reviewed.</li>
          <li>Block anyone you don't want to see. They aren't told.</li>
        </ul>
      </div>

      {message && <p className="ok">{message}</p>}
      {error && <p className="warn">{error}</p>}
      <button type="button" className="ghost" onClick={() => void signOut()}>Sign out</button>
    </>
  );
}
