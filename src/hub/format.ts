/** Pure helpers for the hub: links, distances, media checks and event status. */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(100, Math.round(km * 10) * 100)} m`;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** Rounds a position to about 1 km so a home location is never stored exactly. */
export function roundToKm(p: LatLng): LatLng {
  return { lat: Math.round(p.lat * 100) / 100, lng: Math.round(p.lng * 100) / 100 };
}

/** A shareable link that opens an event in the app; invite-only events carry their code. */
export function eventLink(appUrl: string, eventId: string, inviteCode?: string): string {
  const url = new URL(appUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set("event", eventId);
  if (inviteCode) url.searchParams.set("code", inviteCode);
  return url.toString();
}

export function parseEventLink(search: string): { eventId: string; code?: string } | undefined {
  const params = new URLSearchParams(search);
  const eventId = params.get("event");
  if (!eventId || !/^[0-9a-f-]{36}$/i.test(eventId)) return undefined;
  const code = params.get("code");
  return code && /^[0-9a-f]{12}$/i.test(code) ? { eventId, code } : { eventId };
}

export const MAX_MEDIA_MB = 50;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

/** Why a file can't be posted, or undefined if it can. */
export function mediaProblem(file: { type: string; size: number }): string | undefined {
  if (![...IMAGE_TYPES, ...VIDEO_TYPES].includes(file.type)) {
    return "Use a JPG, PNG, WebP or GIF photo, or an MP4, MOV or WebM video.";
  }
  if (file.size > MAX_MEDIA_MB * 1024 * 1024) return `Files can be up to ${MAX_MEDIA_MB} MB. Try a shorter clip.`;
  return undefined;
}

export function mediaKind(type: string): "image" | "video" {
  return type.startsWith("video/") ? "video" : "image";
}

export type EventStatus = "cancelled" | "ended" | "live" | "full" | "open";

export function eventStatus(
  e: { cancelled: boolean; starts_at: string; duration_min: number; capacity: number | null; going: number },
  now: Date,
): EventStatus {
  if (e.cancelled) return "cancelled";
  const start = new Date(e.starts_at).getTime();
  const end = start + e.duration_min * 60_000;
  if (now.getTime() > end) return "ended";
  if (now.getTime() >= start) return "live";
  if (e.capacity !== null && e.going >= e.capacity) return "full";
  return "open";
}

/** Value for a datetime-local input, in local time. */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
