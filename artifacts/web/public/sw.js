self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "ibhub", body: event.data.text() };
  }

  const title = payload.title ?? "ibhub";
  const targetUrl = payload.url ?? "/";
  const tag = payload.tag ?? "ibhub-push";

  // If the user already has the app open on this exact conversation,
  // skip the system notification (the in-app toast already handles it).
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        const isConvOpen = windowClients.some((c) => {
          if (!c.url.includes(self.location.origin)) return false;
          // For DM tags like "dm-<id>" or group tags like "group-<id>",
          // check if the client URL contains that conversation id.
          const convId = tag.replace(/^(dm|group)-/, "");
          return convId && c.url.includes(convId) && c.visibilityState === "visible";
        });

        if (isConvOpen) return; // suppress — user is already watching

        return self.registration.showNotification(title, {
          body: payload.body ?? "",
          icon: "/favicon-ibhub.png",
          badge: "/favicon-ibhub.png",
          data: { url: targetUrl },
          tag,
          renotify: true,
        });
      })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
