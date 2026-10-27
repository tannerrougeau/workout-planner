import { useCallback, useEffect, useState } from "react";
import {
  cancelEvent,
  eventMembers,
  getEvent,
  joinEvent,
  leaveEvent,
  listPosts,
  promoteEvent,
  report,
  type HubEvent,
  type HubPost,
} from "./api";
import { EventMap } from "./EventMap";
import { eventLink, eventStatus } from "./format";
import { Composer, PostList } from "./Posts";

const STATUS_LABEL = { cancelled: "Cancelled", ended: "Ended", live: "Happening now", full: "Full", open: "" } as const;

export function EventDetail({ id, userId, onBack }: { id: string; userId: string; onBack: () => void }) {
  const [event, setEvent] = useState<HubEvent | null | undefined>();
  const [members, setMembers] = useState<{ user_id: string; name: string }[]>([]);
  const [posts, setPosts] = useState<HubPost[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"cancel" | "report" | undefined>();
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      const [e, m, p] = await Promise.all([getEvent(id), eventMembers(id), listPosts(id)]);
      setEvent(e ?? null);
      setMembers(m);
      setPosts(p);
    } catch (err) {
      setError((err as Error).message);
      setEvent(null);
    }
  }, [id]);
  useEffect(() => void load(), [load]);

  const act = async (action: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      if (done) setMessage(done);
      setConfirm(undefined);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (event === undefined) return <p className="empty">Loading event…</p>;
  if (event === null) {
    return (
      <section className="screen">
        <div className="screen-head"><button type="button" className="ghost" onClick={onBack}>← Hub</button></div>
        <p className="empty">This event isn't available. It may have been removed, or it's invite-only.</p>
        {error && <p className="warn">{error}</p>}
      </section>
    );
  }

  const isOwner = event.owner_id === userId;
  const status = eventStatus(event, new Date());
  const start = new Date(event.starts_at);
  const link = eventLink(window.location.href, event.id, event.visibility === "invite" ? event.invite_code : undefined);

  const share = async () => {
    const text = `${event.title} · ${start.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${event.place_name}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text, url: link });
        return;
      } catch {
        // Share sheet dismissed; fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${link}`);
      setMessage("Link copied. Paste it anywhere to invite people.");
    } catch {
      setMessage(`Share this link: ${link}`);
    }
  };

  return (
    <section className="screen event-detail">
      <div className="screen-head">
        <button type="button" className="ghost" onClick={onBack}>← Hub</button>
      </div>

      <div className="hero event-hero">
        <p className="eyebrow">
          {event.activity}{event.visibility === "invite" && " · Invite only"}
          {STATUS_LABEL[status] && <> · <span className={`status ${status}`}>{STATUS_LABEL[status]}</span></>}
        </p>
        <h2>{event.title}</h2>
        <p className="hero-meta">
          {start.toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          {" · "}{event.duration_min < 60 ? `${event.duration_min} min` : `${event.duration_min / 60} h`}
        </p>
        <p className="hero-meta">{event.place_name}</p>
        <p className="muted">Organized by {event.owner_name} · {event.going} going{event.capacity ? ` of ${event.capacity}` : ""}</p>

        <div className="tip-actions">
          {!isOwner && status !== "cancelled" && status !== "ended" && (
            event.joined
              ? <button type="button" className="secondary" disabled={busy} onClick={() => act(() => leaveEvent(event.id, userId), "You've left this event.")}>Leave</button>
              : <button type="button" className="primary" disabled={busy || status === "full"} onClick={() => act(() => joinEvent(event.id, userId), "You're going.")}>{status === "full" ? "Full" : "Join"}</button>
          )}
          <button type="button" className="secondary" onClick={share}>{event.visibility === "invite" ? "Invite" : "Share"}</button>
          {isOwner && event.visibility === "public" && !event.notified_at && status === "open" && (
            <button type="button" className="secondary" disabled={busy} onClick={() => act(async () => {
              const sent = await promoteEvent(event.id);
              setMessage(sent > 0 ? `Sent ${sent} ${sent === 1 ? "alert" : "alerts"} to people nearby.` : "Promoted. Nobody nearby has alerts on yet.");
            })}>Alert people nearby</button>
          )}
        </div>
        {event.notified_at && isOwner && <p className="muted">People nearby with alerts on were alerted.</p>}
        {message && <p className="ok">{message}</p>}
        {error && <p className="warn">{error}</p>}
      </div>

      {event.description && <div className="card"><p className="pre">{event.description}</p></div>}

      <EventMap pins={[{ id: event.id, lat: event.lat, lng: event.lng, label: event.place_name }]} height={200} />
      <a className="link" href={`https://www.openstreetmap.org/?mlat=${event.lat}&mlon=${event.lng}#map=17/${event.lat}/${event.lng}`} target="_blank" rel="noopener noreferrer">
        Get directions
      </a>

      <div className="card">
        <h2>Going ({members.length})</h2>
        <ul className="members">
          {members.map((m) => (
            <li key={m.user_id}><span className="avatar" aria-hidden="true">{m.name.slice(0, 1).toUpperCase()}</span>{m.name}{m.user_id === event.owner_id && <span className="pill right">Organizer</span>}</li>
          ))}
        </ul>
      </div>

      <h2 className="section-title">Photos</h2>
      {(event.joined || isOwner) && <Composer userId={userId} eventId={event.id} onPosted={load} />}
      <PostList posts={posts} userId={userId} eventOwnerId={event.owner_id} onChanged={load} />

      <div className="card">
        {isOwner ? (
          confirm === "cancel" ? (
            <div className="confirm">
              <p>Cancel this event? People who joined will see it as cancelled.</p>
              <div className="tip-actions">
                <button type="button" className="danger small" disabled={busy} onClick={() => act(() => cancelEvent(event.id), "Event cancelled.")}>Cancel event</button>
                <button type="button" className="ghost small" onClick={() => setConfirm(undefined)}>Keep it</button>
              </div>
            </div>
          ) : (
            status !== "cancelled" && <button type="button" className="ghost danger-text" onClick={() => setConfirm("cancel")}>Cancel event…</button>
          )
        ) : confirm === "report" ? (
          <form className="confirm" onSubmit={(e) => { e.preventDefault(); void act(() => report({ eventId: event.id }, reason.trim()), "Thanks, the report was sent."); }}>
            <label className="field">
              What's wrong with this event?
              <input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="e.g. unsafe location, spam" />
            </label>
            <div className="tip-actions">
              <button type="submit" className="primary small" disabled={busy || reason.trim().length < 2}>Send report</button>
              <button type="button" className="ghost small" onClick={() => setConfirm(undefined)}>Cancel</button>
            </div>
          </form>
        ) : (
          <button type="button" className="ghost" onClick={() => setConfirm("report")}>Report this event</button>
        )}
      </div>
    </section>
  );
}
