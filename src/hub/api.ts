import { db, HUB_CONFIG } from "./config";
import type { LatLng } from "./format";

export interface HubEvent {
  id: string;
  owner_id: string;
  owner_name: string;
  title: string;
  activity: string;
  description: string;
  starts_at: string;
  duration_min: number;
  place_name: string;
  lat: number;
  lng: number;
  capacity: number | null;
  visibility: "public" | "invite";
  invite_code: string;
  cancelled: boolean;
  notified_at: string | null;
  going: number;
  joined: boolean;
}

export interface HubPost {
  id: string;
  author_id: string;
  author_name: string;
  event_id: string | null;
  event_title: string | null;
  body: string;
  media_path: string | null;
  media_type: "image" | null;
  created_at: string;
}

export interface NewEvent {
  title: string;
  activity: string;
  description: string;
  starts_at: string;
  time_zone: string;
  duration_min: number;
  place_name: string;
  lat: number;
  lng: number;
  capacity: number | null;
  visibility: "public" | "invite";
}

/** Supabase errors carry a message meant for developers; keep the first line. */
function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message.split("\n")[0]);
}

// Account

export async function sendSignInLink(email: string): Promise<void> {
  const redirect = window.location.origin + window.location.pathname;
  const { error } = await db().auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
  fail(error);
}

export async function signOut(): Promise<void> {
  fail((await db().auth.signOut()).error);
}

export async function myName(userId: string): Promise<string> {
  const { data, error } = await db().from("profiles").select("display_name").eq("id", userId).single();
  fail(error);
  return data!.display_name as string;
}

export async function setMyName(userId: string, name: string): Promise<void> {
  fail((await db().from("profiles").update({ display_name: name.trim() }).eq("id", userId)).error);
}

// Events

export async function listEvents(near?: LatLng, radiusKm = 50): Promise<HubEvent[]> {
  const { data, error } = await db().rpc("events_near", near ? { p_lat: near.lat, p_lng: near.lng, p_radius_km: radiusKm } : {});
  fail(error);
  return (data ?? []) as HubEvent[];
}

export async function myEvents(userId: string): Promise<HubEvent[]> {
  const { data: rows, error: e1 } = await db().from("event_members").select("event_id").eq("user_id", userId);
  fail(e1);
  const ids = (rows ?? []).map((r) => r.event_id as string);
  if (ids.length === 0) return [];
  const { data, error } = await db().from("event_cards").select("*").in("id", ids).order("starts_at");
  fail(error);
  return (data ?? []) as HubEvent[];
}

export async function getEvent(id: string): Promise<HubEvent | undefined> {
  const { data, error } = await db().from("event_cards").select("*").eq("id", id).maybeSingle();
  fail(error);
  return (data ?? undefined) as HubEvent | undefined;
}

export async function eventMembers(id: string): Promise<{ user_id: string; name: string }[]> {
  const { data, error } = await db().from("event_members").select("user_id, profiles(display_name)").eq("event_id", id).order("created_at");
  fail(error);
  return (data ?? []).map((r) => ({
    user_id: r.user_id as string,
    name: (r.profiles as unknown as { display_name: string } | null)?.display_name ?? "Member",
  }));
}

export async function createEvent(input: NewEvent): Promise<string> {
  const { data, error } = await db().from("events").insert(input).select("id").single();
  fail(error);
  return data!.id as string;
}

export async function cancelEvent(id: string): Promise<void> {
  fail((await db().from("events").update({ cancelled: true }).eq("id", id)).error);
}

export async function joinEvent(id: string, userId: string): Promise<void> {
  fail((await db().from("event_members").insert({ event_id: id, user_id: userId })).error);
}

export async function leaveEvent(id: string, userId: string): Promise<void> {
  fail((await db().from("event_members").delete().eq("event_id", id).eq("user_id", userId)).error);
}

export async function previewInvite(id: string, code: string) {
  const { data, error } = await db().rpc("preview_invite", { eid: id, code });
  fail(error);
  return ((data ?? []) as { title: string; activity: string; starts_at: string; place_name: string; owner_name: string }[])[0];
}

export async function joinWithCode(id: string, code: string): Promise<void> {
  fail((await db().rpc("join_event_with_code", { eid: id, code })).error);
}

/** Alerts opted-in people near the event by phone and/or email. Returns how many alerts went out. */
export async function promoteEvent(id: string): Promise<number> {
  const { data, error } = await db().functions.invoke("notify-nearby", { body: { event_id: id } });
  if (error) {
    const body = await (error as { context?: Response }).context?.json?.().catch(() => undefined);
    throw new Error(body?.error ?? "Couldn't send notifications. Try again later.");
  }
  return (data as { sent: number }).sent;
}

// Posts

export async function listPosts(eventId?: string): Promise<HubPost[]> {
  let q = db().from("post_cards").select("*").order("created_at", { ascending: false }).limit(60);
  if (eventId) q = q.eq("event_id", eventId);
  const { data, error } = await q;
  fail(error);
  return (data ?? []) as HubPost[];
}

export function mediaUrl(path: string): string {
  return db().storage.from("media").getPublicUrl(path).data.publicUrl;
}

export async function createPost(userId: string, body: string, file?: File, eventId?: string): Promise<void> {
  let media: { media_path: string; media_type: "image" } | undefined;
  if (file) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    fail((await db().storage.from("media").upload(path, file, { contentType: file.type })).error);
    media = { media_path: path, media_type: "image" };
  }
  const { error } = await db().from("posts").insert({ body: body.trim(), event_id: eventId ?? null, ...media });
  if (error && media) await db().storage.from("media").remove([media.media_path]);
  fail(error);
}

export async function deletePost(post: HubPost): Promise<void> {
  fail((await db().from("posts").delete().eq("id", post.id)).error);
  if (post.media_path) await db().storage.from("media").remove([post.media_path]);
}

// Safety

export async function report(target: { postId: string } | { eventId: string }, reason: string): Promise<void> {
  const row = "postId" in target ? { post_id: target.postId } : { event_id: target.eventId };
  const { error } = await db().from("reports").insert({ ...row, reason });
  // Reporting twice is fine; the first report stands.
  if (error && !/duplicate/i.test(error.message)) fail(error);
}

export async function blockedIds(): Promise<string[]> {
  const { data, error } = await db().from("blocks").select("blocked_id");
  fail(error);
  return (data ?? []).map((r) => r.blocked_id as string);
}

export async function block(userId: string): Promise<void> {
  fail((await db().from("blocks").insert({ blocked_id: userId })).error);
}

export async function unblock(userId: string): Promise<void> {
  fail((await db().from("blocks").delete().eq("blocked_id", userId)).error);
}

// Notifications

export interface NotifyPrefs {
  enabled: boolean;
  lat: number;
  lng: number;
  radius_km: number;
  push: boolean;
  email: boolean;
}

export async function getNotifyPrefs(): Promise<NotifyPrefs | undefined> {
  const { data, error } = await db().from("notify_prefs").select("enabled, lat, lng, radius_km, push, email").maybeSingle();
  fail(error);
  return (data ?? undefined) as NotifyPrefs | undefined;
}

export async function saveNotifyPrefs(userId: string, prefs: NotifyPrefs): Promise<void> {
  fail((await db().from("notify_prefs").upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() })).error);
}

export async function saveDevice(userId: string, sub: PushSubscriptionJSON): Promise<void> {
  const keys = sub.keys ?? {};
  fail((await db().from("push_subscriptions").upsert({ endpoint: sub.endpoint, user_id: userId, p256dh: keys.p256dh, auth: keys.auth })).error);
}

export const pushSupported = () => Boolean(HUB_CONFIG.vapidPublicKey);
