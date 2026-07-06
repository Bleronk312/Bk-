// ============================================================================
// Offline-Cache (App-Shell). Damit die App auch ohne Empfang öffnet - z.B. wenn
// im Objekt kein Netz ist. Strategie: "stale-while-revalidate" - es wird sofort
// die zwischengespeicherte Version ausgeliefert (schnell + offline), im Hintergrund
// aber frisch nachgeladen. Neue Versionen erscheinen daher beim übernächsten Öffnen
// (oder sofort per "nach unten ziehen zum Aktualisieren").
//
// Wichtig: Supabase-Anfragen (Daten) werden NIE aus dem Cache bedient, die gehen
// immer direkt ins Netz. Offline-Daten regelt die App selbst (Touren-Zwischenspeicher
// und Unterschriften-Warteschlange).
const GEKO_CACHE = "geko-cache-v1";

// Beim Installieren die Kern-Dateien schon mal einsammeln (Fehler einzelner Dateien
// dürfen die Installation nicht abbrechen -> allSettled statt addAll).
const GEKO_CORE = [
  "hub.html", "glas-admin.html", "glas-mitarbeiter.html", "admin.html", "mitarbeiter.html", "schein.html",
  "css/style.css",
  "js/config.js", "js/logo-asset.js", "js/pull-refresh.js", "js/supabase-client.js", "js/app-shared.js",
  "js/glas-shared.js", "js/pdf-fonts.js", "js/pdf-template.js", "js/glas-logo-sub.js", "js/glas-pdf-template.js",
  "js/push.js", "js/glas-admin.js", "js/glas-mitarbeiter.js", "js/admin.js", "js/mitarbeiter.js", "js/schein.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/signature_pad/4.1.7/signature_pad.umd.min.js",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(GEKO_CACHE).then((cache) =>
      Promise.allSettled(GEKO_CORE.map((u) => cache.add(u).catch(() => {})))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("geko-cache-") && k !== GEKO_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // POST/PATCH etc. immer direkt ins Netz
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  const sameOrigin = url.origin === self.location.origin;
  const isCdn = url.hostname === "cdn.jsdelivr.net" || url.hostname === "cdnjs.cloudflare.com";
  if (!sameOrigin && !isCdn) return; // Supabase & andere Dienste nie aus dem Cache
  event.respondWith(gekoStaleWhileRevalidate(req));
});

async function gekoStaleWhileRevalidate(req) {
  const cache = await caches.open(GEKO_CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok && (res.type === "basic" || res.type === "cors")) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

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
    // Ohne Ziel-URL IMMER auf die Mitarbeiter-Seite - "/" würde zu admin.html
    // weiterleiten und Mitarbeiter in die Admin-Ansicht lassen
    data: { url: data.url || "/mitarbeiter.html" },
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.error("showNotification fehlgeschlagen:", err);
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/mitarbeiter.html";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
