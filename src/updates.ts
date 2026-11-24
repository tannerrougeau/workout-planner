import { registerSW } from "virtual:pwa-register";
import { loadDraft } from "./workoutLog";

const CHECK_EVERY_MS = 30 * 60 * 1000;

/**
 * Keeps an open app current: checks for a new deploy every 30 minutes and whenever the app comes
 * back into view, not only on page load. A new version reloads the page, so it waits until no
 * workout is in progress (the draft survives a reload, but the rest timer and scroll position don't).
 */
export function startUpdateChecks(): void {
  if (!("serviceWorker" in navigator)) return;
  let waiting = false;

  const applyIfIdle = () => {
    if (waiting && !loadDraft()) void updateSW(true);
  };

  const updateSW = registerSW({
    onNeedRefresh() {
      waiting = true;
      applyIfIdle();
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (waiting) applyIfIdle();
        else if (navigator.onLine) void registration.update().catch(() => undefined);
      };
      window.setInterval(check, CHECK_EVERY_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
  });
}
