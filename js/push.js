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
    const { error } = await sb.from("push_subscriptions").upsert({
      role,
      endpoint: subJson.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
    }, { onConflict: "endpoint" });

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
