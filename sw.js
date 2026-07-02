self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "GEKO Abnahmescheine", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "GEKO Abnahmescheine";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    data: { url: data.url || "/" },
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.error("showNotification fehlgeschlagen:", err);
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
