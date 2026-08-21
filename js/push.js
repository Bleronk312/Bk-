// Zwei Gruppen von Kanälen. Innerhalb einer Gruppe darf ein Gerät beliebig
// viele gleichzeitig haben; zwischen den Gruppen wird gewechselt, damit ein
// Mitarbeiter-Handy keine Büro-Meldungen bekommt (und andersherum).
const GEKO_PUSH_VERWALTUNG = ["admin", "glas", "kalender", "graffiti", "checkin_admin"];
const GEKO_PUSH_MITARBEITER = ["mitarbeiter", "geko_one", "checkin_ma"];

const VAPID_PUBLIC_KEY = "BH5svn75k_QSVlXToFm2CUppfk7vLY4Fdr34pxrFxKN9zSUdfOxJJDtTOg_ZT9WD-MfPMUPSTQJHI1jCOPN9dzM";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function enablePushNotifications(role, mitarbeiterId) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    showToast("Push-Benachrichtigungen werden auf diesem Gerät/Browser nicht unterstützt");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      showToast("Benachrichtigungen wurden nicht erlaubt");
      return;
    }

    const reg = await navigator.serviceWorker.register("sw.js");
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const subJson = sub.toJSON();
    const error = await pushUpsertSubscription(role, subJson, mitarbeiterId);

    if (error) {
      showToast("Fehler beim Aktivieren: " + error.message);
      return;
    }

    showToast("🔔 Benachrichtigungen aktiviert!");
    const btn = document.getElementById("pushBtn");
    if (btn) btn.textContent = "🔔 Aktiviert";
  } catch (e) {
    showToast("Fehler beim Aktivieren der Benachrichtigungen");
    console.error(e);
  }
}

// Ein Gerät kann Admin- UND Mitarbeiter-Benachrichtigungen gleichzeitig abonniert haben.
// (Früher überschrieb der Wechsel zwischen den Seiten die Rolle - dadurch "gingen
// Benachrichtigungen immer wieder aus".) Fallback auf das alte Verhalten, solange die
// SQL-Migration noch nicht ausgeführt wurde.
// Kurzbeschreibung des Geräts - "iPhone · App", "Mac · Browser".
// Zweck: In der Verwaltung soll man erkennen, WELCHES Gerät an einem Zugang
// hängt. Taucht bei einem Mitarbeiter plötzlich ein Windows-PC auf, obwohl er
// nur ein Diensthandy hat, ist das die Frage wert.
//
// Bewusst grob: Hersteller und "App oder Browser", mehr nicht. Es geht darum,
// Geräte auseinanderzuhalten, nicht darum, jemanden zu vermessen. Eine genaue
// Kennung wäre ein Personendatensatz, den hier niemand braucht.
function gekoGeraeteName() {
  try {
    const ua = navigator.userAgent || "";
    const alsApp = window.navigator.standalone === true
      || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    let art = "Unbekannt";
    if (/iPhone/i.test(ua)) art = "iPhone";
    else if (/iPad/i.test(ua)) art = "iPad";
    // iPadOS gibt sich als Mac aus, verrät sich aber über die Touch-Punkte.
    else if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) art = "iPad";
    else if (/Android/i.test(ua)) art = /Mobile/i.test(ua) ? "Android-Handy" : "Android-Tablet";
    else if (/Macintosh|Mac OS X/i.test(ua)) art = "Mac";
    else if (/Windows/i.test(ua)) art = "Windows-PC";
    else if (/Linux/i.test(ua)) art = "Linux-PC";
    return art + (alsApp ? " · App" : " · Browser");
  } catch (e) { return "Unbekannt"; }
}

async function pushUpsertSubscription(role, subJson, mitarbeiterId) {
  const row = { role, endpoint: subJson.endpoint, p256dh: subJson.keys.p256dh, auth: subJson.keys.auth };
  if (mitarbeiterId) row.mitarbeiter_id = mitarbeiterId; // für gezielte MA-Erinnerungen
  row.geraet = gekoGeraeteName();
  // ERST die neue Rolle sicher speichern ...
  let { error } = await sb.from("push_subscriptions").upsert(row, { onConflict: "endpoint,role" });
  // Spalte geraet fehlt evtl. noch (SQL nicht ausgeführt) -> ohne sie erneut versuchen
  if (error && /geraet/i.test(error.message || "")) {
    delete row.geraet;
    ({ error } = await sb.from("push_subscriptions").upsert(row, { onConflict: "endpoint,role" }));
  }
  // Spalte mitarbeiter_id fehlt evtl. noch (SQL nicht ausgeführt) -> ohne sie erneut versuchen
  if (error && /mitarbeiter_id/i.test(error.message || "")) {
    delete row.mitarbeiter_id;
    ({ error } = await sb.from("push_subscriptions").upsert(row, { onConflict: "endpoint,role" }));
  }
  if (error) ({ error } = await sb.from("push_subscriptions").upsert(row, { onConflict: "endpoint" }));
  // Aufräumen, aber nur GRUPPENWEISE. Ein Gerät der Verwaltung darf ruhig alle
  // Verwaltungs-Kanäle gleichzeitig haben - dafür ist der Schlüssel (endpoint,
  // role) da. Wechselt ein Gerät dagegen die Seite (Chef-Handy wird
  // Mitarbeiter-Handy oder umgekehrt), sollen die Kanäle der anderen Gruppe
  // weg, sonst bekäme ein Mitarbeiter die Meldungen des Büros.
  // (Vorher flog hier pauschal JEDE andere Rolle raus - dadurch konnte ein
  // Gerät immer nur einen einzigen Bereich empfangen.)
  if (!error) {
    const andere = GEKO_PUSH_VERWALTUNG.includes(role)
      ? GEKO_PUSH_MITARBEITER : GEKO_PUSH_VERWALTUNG;
    try {
      await sb.from("push_subscriptions").delete()
        .eq("endpoint", subJson.endpoint).in("role", andere);
    } catch (e) {}
  }
  return error;
}

// Meldet dieses Gerät in EINEM Rutsch für mehrere Kanäle an. Dahinter steckt
// eine einzige Browser-Anmeldung (ein Endpoint) - die Kanäle sind nur Zeilen
// in der Tabelle. Deshalb reicht ein Knopf für alles.
async function gekoPushAktivierenFuer(rollen, mitarbeiterId) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, grund: "nicht_unterstuetzt" };
  }
  try {
    const erlaubnis = await Notification.requestPermission();
    if (erlaubnis !== "granted") return { ok: false, grund: "abgelehnt" };

    const reg = await navigator.serviceWorker.register("sw.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const subJson = sub.toJSON();
    const fehler = [];
    for (const rolle of rollen) {
      const e = await pushUpsertSubscription(rolle, subJson, mitarbeiterId);
      if (e) fehler.push(rolle + ": " + (e.message || e));
    }
    return { ok: !fehler.length, fehler, endpoint: subJson.endpoint };
  } catch (e) {
    return { ok: false, grund: "fehler", fehler: [String((e && e.message) || e)] };
  }
}

// Hat der Nutzer Benachrichtigungen einmal erlaubt, erneuert jedes Öffnen der Seite die
// Anmeldung still im Hintergrund - so bleiben sie dauerhaft an, ohne erneutes Antippen.
async function autoRenewPushSubscription(role, mitarbeiterId) {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker.register("sw.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    await pushUpsertSubscription(role, sub.toJSON(), mitarbeiterId);
  } catch (e) { /* beim nächsten Öffnen erneut versuchen */ }
}

async function checkPushStatus() {
  const btn = document.getElementById("pushBtn");
  if (!btn) return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    btn.style.display = "none";
    return;
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration("sw.js");
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) btn.textContent = "🔔 Aktiviert";
    }
  } catch (e) {}
}
