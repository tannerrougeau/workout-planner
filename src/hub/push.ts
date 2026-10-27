import { HUB_CONFIG } from "./config";

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInstalled = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Why this device can't get notifications, or undefined if it can. */
export function pushProblem(): string | undefined {
  if (!HUB_CONFIG.vapidPublicKey) return "Notifications aren't set up for this app yet.";
  if (isIOS() && !isInstalled()) return "On iPhone, add the app to your Home Screen first (Share → Add to Home Screen), then turn this on from the installed app.";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "This browser can't receive notifications.";
  }
  if (Notification.permission === "denied") return "Notifications are blocked for this app. Allow them in your browser or phone settings, then try again.";
  return undefined;
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Asks permission and subscribes this device to push notifications. */
export async function subscribeDevice(): Promise<PushSubscriptionJSON> {
  const problem = pushProblem();
  if (problem) throw new Error(problem);
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications weren't allowed.");
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(HUB_CONFIG.vapidPublicKey) }));
  return sub.toJSON();
}

export function currentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("This device can't share its location."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? "Location access was turned down." : "Couldn't get your location. Try again.")),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
    );
  });
}
