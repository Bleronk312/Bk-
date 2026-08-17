// ============================================================================
// Offline-Cache (App-Shell). Damit die App auch ohne Empfang öffnet - z.B. wenn
// im Objekt kein Netz ist.
//
// Strategie: eigene Dateien (HTML/CSS/JS) kommen IMMER frisch aus dem Netz; nur
// wenn das Netz nicht antwortet (offline / kein Empfang), springt der Cache ein.
// So gibt es nie veraltete App-Versionen nach einem Deploy - die alte
// "stale-while-revalidate"-Variante lieferte erst die alte Datei aus und hat so
// z.B. die Kalender-App-Erkennung ausgehebelt. CDN-Bibliotheken (fest versionierte
// URLs, ändern sich nie) kommen weiterhin direkt aus dem Cache.
//
// Wichtig: Supabase-Anfragen (Daten) werden NIE aus dem Cache bedient, die gehen
// immer direkt ins Netz. Offline-Daten regelt die App selbst (Touren-Zwischenspeicher
// und Unterschriften-Warteschlange).
const GEKO_CACHE = "geko-cache-v197";

// Beim Installieren die Kern-Dateien schon mal einsammeln (Fehler einzelner Dateien
// dürfen die Installation nicht abbrechen -> allSettled statt addAll).
const GEKO_CORE = [
  "hub.html", "einstellungen.html", "glas-admin.html", "kalender.html", "glas-mitarbeiter.html", "admin.html", "mitarbeiter.html", "schein.html",
  "checkins-admin.html", "checkins-ma.html", "diagnose.html",
  "manifest.json", "manifest-hub.json", "manifest-glas.json", "manifest-kalender.json",
  "manifest-meine.json", "manifest-glas-ma.json", "manifest-checkins.json", "manifest-checkins-ma.json",
  "css/style.css", "css/checkins.css",
  "js/config.js", "js/fehler.js", "js/logo-asset.js", "js/pull-refresh.js", "js/supabase-client.js", "js/app-shared.js",
  "js/pdf-seiten.js", "js/glas-shared.js", "js/pdf-fonts.js", "js/pdf-template.js", "js/glas-logo-sub.js", "js/glas-pdf-template.js", "js/glas-lager-pdf.js",
  "js/push.js", "js/pdf-ansicht.js", "js/glas-admin.js", "js/glas-mitarbeiter.js", "js/admin.js", "js/mitarbeiter.js", "js/ma-i18n.js", "js/schein.js",
  "js/checkins-shared.js", "js/checkins-admin.js", "js/checkins-ma.js",
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
  // CDN-Bibliotheken: sofort aus dem Cache (schneller Start), im Hintergrund frisch
  // nachladen. Wichtig, weil z.B. supabase-js@2 eine BEWEGLICHE Versions-URL ist -
  // reines "Cache zuerst" würde sie für immer einfrieren.
  if (isCdn) { event.respondWith(gekoCdnStaleWhileRevalidate(req)); return; }
  // Eigene, VERSIONIERTE Dateien (…?v=NN) sind pro Version unveränderlich -> Cache
  // zuerst = blitzschneller Start, kein Warten aufs Netz. Nach einem Deploy laden die
  // HTML-Dateien automatisch die neuen ?v-URLs, also gibt es nie eine alte Version.
  if (/[?&]v=\d+/.test(url.search)) { event.respondWith(gekoCacheFirst(req)); return; }
  // HTML & unversionierte Anfragen: Zwischenspeicher SOFORT, frisch nachladen
  // im Hintergrund. Vorher war es andersherum (Netz zuerst) - dadurch stand
  // bei JEDEM Wechsel Hub -> Abteilung erst ein weisser Bildschirm, bis das
  // HTML uebers Netz da war; bei schlechtem Empfang bis zu 5 Sekunden. Jetzt
  // erscheint die Seite augenblicklich aus dem Speicher, und der naechste
  // Besuch hat automatisch den frischen Stand. Inhalte (Datenbank) waren nie
  // betroffen - die laufen am Speicher vorbei.
  event.respondWith(gekoShellSwr(req));
});

// Huelle sofort aus dem Speicher, Aktualisierung im Hintergrund. Gefahrlos,
// weil der Server die ?v-Anfragen ohnehin immer mit dem neuesten Inhalt
// beantwortet - die Stempel dienen nur dem Speicher-Umbruch.
async function gekoShellSwr(req) {
  const cache = await caches.open(GEKO_CACHE);
  const cached = await cache.match(req);
  if (cached) {
    fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); }).catch(() => {});
    return cached;
  }
  return gekoNetworkFirst(req);
}

// Cache zuerst; nur bei Fehltreffer ins Netz (und dann in den Cache legen). Fuer
// unveraenderliche ?v-URLs sicher und am schnellsten.
async function gekoCacheFirst(req) {
  const cache = await caches.open(GEKO_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    // Offline und genau diese Version fehlt -> gleiche Datei ohne ?v aus dem Cache
    const alt = await cache.match(req, { ignoreSearch: true });
    return alt || Response.error();
  }
}

async function gekoCdnStaleWhileRevalidate(req) {
  const cache = await caches.open(GEKO_CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

// Netz zuerst (mit Zeitlimit, damit 1-Balken-Empfang nicht ewig hängt), Cache nur als
// Offline-Fallback. ignoreSearch, damit z.B. "glas-admin.js?v=2" offline auch die
// vorgespeicherte "glas-admin.js" findet.
async function gekoNetworkFirst(req) {
  const cache = await caches.open(GEKO_CACHE);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(req, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(req, { ignoreSearch: true });
    return cached || Response.error();
  }
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
