// Alerts people nearby about a new public event, by phone notification and/or email,
// as each person chose. Called by the event's organizer from the app; each event can be
// promoted once, and each organizer at most 3 times a day.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://tannerrougeau.github.io/workout-planner/";
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM");
const EMAIL_FROM_NAME = Deno.env.get("EMAIL_FROM_NAME") ?? "Workout Planner";
const DAILY_LIMIT = 3;
const MAX_EMAILS = 300;

const vapidReady = Boolean(Deno.env.get("VAPID_PUBLIC_KEY") && Deno.env.get("VAPID_PRIVATE_KEY"));
if (vapidReady) {
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? `mailto:${EMAIL_FROM ?? "admin@example.com"}`,
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface EventRow {
  id: string;
  title: string;
  activity: string;
  starts_at: string;
  time_zone: string;
  place_name: string;
}

function localTime(e: EventRow): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  try {
    return new Date(e.starts_at).toLocaleString("en-US", { ...opts, timeZone: e.time_zone });
  } catch {
    return new Date(e.starts_at).toLocaleString("en-US", { ...opts, timeZone: "UTC" });
  }
}

async function sendEmail(to: string, e: EventRow, link: string): Promise<boolean> {
  const when = localTime(e);
  const html = `<!doctype html><html><body style="margin:0;background:#f2f4f8;font-family:Arial,Helvetica,sans-serif;color:#111a2b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;border-top:4px solid #2f6fde">
<tr><td style="padding:24px">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#737d91">New ${escapeHtml(e.activity)} event near you</p>
<h1 style="margin:0 0 12px;font-size:24px;line-height:1.2">${escapeHtml(e.title)}</h1>
<p style="margin:0 0 4px;font-size:16px">${escapeHtml(when)}</p>
<p style="margin:0 0 20px;font-size:16px;color:#4a5468">${escapeHtml(e.place_name)}</p>
<a href="${escapeHtml(link)}" style="display:inline-block;background:#2f6fde;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">See the event</a>
<p style="margin:24px 0 0;font-size:13px;color:#737d91">You're getting this because you turned on event alerts in Workout Planner. To stop them, open the app and go to Hub → Settings → Event alerts.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `New ${e.activity} event near you: ${e.title}\n${when}\n${e.place_name}\n\nSee the event: ${link}\n\nTo stop these emails, open the app and go to Hub → Settings → Event alerts.`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY!, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: EMAIL_FROM, name: EMAIL_FROM_NAME },
      to: [{ email: to }],
      subject: `${e.activity} near you: ${e.title}`,
      htmlContent: html,
      textContent: text,
    }),
  });
  return res.ok;
}

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
    .select("id, title, activity, starts_at, time_zone, place_name")
    .maybeSingle<EventRow>();
  if (!event) return reply(409, { error: "This event was already promoted, has started, or isn't public" });

  const { data: recipients } = await admin.rpc("users_to_notify", { eid: event.id });
  const people = (recipients ?? []) as { user_id: string; push: boolean; email: boolean; email_address: string | null }[];
  const link = `${APP_URL}?event=${event.id}`;
  let pushed = 0;
  let emailed = 0;

  const pushUsers = people.filter((p) => p.push).map((p) => p.user_id);
  if (vapidReady && pushUsers.length > 0) {
    const { data: subs } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth").in("user_id", pushUsers);
    // The phone formats startsAt in its own time zone (see public/push-sw.js).
    const payload = JSON.stringify({ title: `${event.activity} near you: ${event.title}`, place: event.place_name, startsAt: event.starts_at, url: link });
    await Promise.all((subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 6 });
        pushed++;
      } catch (err) {
        // The device unsubscribed or the subscription expired: forget it.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }));
  }

  const emailTo = people.filter((p) => p.email && p.email_address).slice(0, MAX_EMAILS);
  if (BREVO_API_KEY && EMAIL_FROM) {
    for (const p of emailTo) {
      if (await sendEmail(p.email_address!, event, link).catch(() => false)) emailed++;
    }
  }

  return reply(200, { pushed, emailed, sent: pushed + emailed });
});
