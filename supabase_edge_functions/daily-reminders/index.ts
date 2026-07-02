// Supabase Edge Function: daily-reminders
// Wird einmal täglich um 8 Uhr per pg_cron aufgerufen.
// Sucht alle Abnahmescheine mit einem Termin heute und schickt Admin + Mitarbeiter eine Übersicht.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");

webpush.setVapidDetails(
  "mailto:info@example.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

function berlinDateString(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(date); // YYYY-MM-DD
}

function berlinTimeString(date) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function sendToRole(supabase, role, title, body) {
  const { data: subs } = await supabase.from("push_subscriptions").select("*").eq("role", role);
  const payload = JSON.stringify({ title, body, url: "/" });
  await Promise.allSettled(
    (subs || []).map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      ).catch(async (err) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      })
    )
  );
}

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const today = berlinDateString(new Date());

    const { data: scheine, error } = await supabase
      .from("scheine")
      .select("adresse, kategorie, termin")
      .not("termin", "is", null)
      .eq("archiviert", false);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    const todays = (scheine || [])
      .filter((s) => berlinDateString(new Date(s.termin)) === today)
      .sort((a, b) => new Date(a.termin) - new Date(b.termin));

    if (todays.length === 0) {
      return new Response(JSON.stringify({ message: "Keine Termine heute, keine Benachrichtigung gesendet" }));
    }

    const lines = todays.map((s) => {
      const strasse = (s.adresse || "").split("\n")[0];
      return `${berlinTimeString(new Date(s.termin))} – ${strasse}`;
    });

    const title = `☀️ ${todays.length} Termin${todays.length === 1 ? "" : "e"} heute!`;
    const body = lines.join("\n");

    await sendToRole(supabase, "admin", title, body);
    await sendToRole(supabase, "mitarbeiter", title, body);

    return new Response(JSON.stringify({ notified: todays.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
