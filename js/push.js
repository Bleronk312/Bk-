const VAPID_PUBLIC_KEY = "BH5svn75k_QSVlXToFm2CUppfk7vLY4Fdr34pxrFxKN9zSUdfOxJJDtTOg_ZT9WD-MfPMUPSTQJHI1jCOPN9dzM";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function enablePushNotifications(role) {
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
    const error = await pushUpsertSubscription(role, subJson);

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
async function pushUpsertSubscription(role, subJson) {
  const row = { role, endpoint: subJson.endpoint, p256dh: subJson.keys.p256dh, auth: subJson.keys.auth };
  let { error } = await sb.from("push_subscriptions").upsert(row, { onConflict: "endpoint,role" });
  if (error) ({ error } = await sb.from("push_subscriptions").upsert(row, { onConflict: "endpoint" }));
  return error;
}

// Hat der Nutzer Benachrichtigungen einmal erlaubt, erneuert jedes Öffnen der Seite die
// Anmeldung still im Hintergrund - so bleiben sie dauerhaft an, ohne erneutes Antippen.
async function autoRenewPushSubscription(role) {
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
    await pushUpsertSubscription(role, sub.toJSON());
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
