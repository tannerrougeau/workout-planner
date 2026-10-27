// Sends a push notification about a new public event to people who opted in nearby.
// Called by the event's organizer from the app; each event can be promoted once,
// and each organizer at most 3 times a day.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://tannerrougeau.github.io/workout-planner/";
const DAILY_LIMIT = 3;

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Use POST" });

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return reply(401, { error: "Sign in to promote an event" });

  const { event_id: eventId } = await req.json().catch(() => ({}));
  if (typeof eventId !== "string") return reply(400, { error: "Missing event_id" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin.from("events").select("id", { count: "exact", head: true })
    .eq("owner_id", user.id).gte("notified_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) return reply(429, { error: `You can promote up to ${DAILY_LIMIT} events a day` });

  // Claim the event: only the owner, only public upcoming events, only once.
  const { data: event } = await admin.from("events")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", eventId).eq("owner_id", user.id).eq("visibility", "public").eq("cancelled", false)
    .is("notified_at", null).gt("starts_at", new Date().toISOString())
    .select("id, title, activity, starts_at, place_name")
    .maybeSingle();
  if (!event) return reply(409, { error: "This event was already promoted, has started, or isn't public" });

  const { data: recipients } = await admin.rpc("users_to_notify", { eid: event.id });
  const userIds = (recipients ?? []).map((r: { user_id: string }) => r.user_id);
  if (userIds.length === 0) return reply(200, { sent: 0 });

  const { data: subs } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth").in("user_id", userIds);
  // The phone formats starts_at in its own time zone (see public/push-sw.js).
  const payload = JSON.stringify({
    title: `${event.activity} near you: ${event.title}`,
    place: event.place_name,
    startsAt: event.starts_at,
    url: `${APP_URL}?event=${event.id}`,
  });

  let sent = 0;
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 6 });
      sent++;
    } catch (err) {
      // The device unsubscribed or the subscription expired: forget it.
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
    }
  }));
  return reply(200, { sent });
});
