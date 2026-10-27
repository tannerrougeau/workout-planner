// Loaded into the app's service worker (see vite.config.ts): shows nearby-event
// notifications and opens the event when one is tapped.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "" };
  }
  const when = data.startsAt
    ? new Date(data.startsAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";
  event.waitUntil(
    self.registration.showNotification(data.title || "New event near you", {
      body: [data.place, when].filter(Boolean).join(" · "),
      icon: "pwa-192x192.png",
      badge: "pwa-64x64.png",
      data: { url: data.url || self.registration.scope },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.startsWith(self.registration.scope) && "focus" in w) return w.navigate(url).then((c) => (c || w).focus());
      }
      return self.clients.openWindow(url);
    }),
  );
});
