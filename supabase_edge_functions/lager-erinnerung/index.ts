// Supabase Edge Function: lager-erinnerung
//
// Erinnert das Büro, wenn der Lager-Plan für den NÄCHSTEN Tag noch nicht
// verschickt wurde. Ist er raus, passiert nichts - das ist der ganze Witz an
// der Sache: eine Erinnerung, die man ignorieren muss, weil sie sowieso immer
// kommt, liest nach zwei Wochen niemand mehr.
//
// Läuft stündlich per Zeitplan und entscheidet SELBST, ob gerade die
// eingestellte Uhrzeit ist. Dadurch lässt sich die Uhrzeit in der App ändern,
// ohne jedes Mal den Zeitplan in der Datenbank anzufassen.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");

webpush.setVapidDetails("mailto:info@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// Alles in Berliner Zeit rechnen - der Server läuft in UTC, und im Sommer
// liegen dazwischen zwei Stunden. Ohne das käme die 18-Uhr-Erinnerung im
// Sommer um 20 Uhr.
function berlinDatum(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(d);
}
function berlinStunde(d: Date): number {
  return parseInt(new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", hour: "2-digit", hour12: false,
  }).format(d), 10);
}
function berlinWochentag(d: Date): number {
  // 0 = Sonntag
  const kurz = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", weekday: "short" }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(kurz);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const jetzt = new Date();

  try {
    // ---- 1) Ist die eingestellte Uhrzeit erreicht? -------------------------
    const { data: einst } = await db.from("glas_einstellungen")
      .select("lager_erinnerung_zeit, lager_erinnerung_zuletzt, lager_erinnerung_an")
      .eq("id", "default").maybeSingle();

    const zeit = einst?.lager_erinnerung_zeit;
    if (!zeit) return new Response(JSON.stringify({ uebersprungen: "abgeschaltet" }), { headers: cors });

    const sollStunde = parseInt(String(zeit).split(":")[0], 10);
    if (isNaN(sollStunde) || berlinStunde(jetzt) !== sollStunde) {
      return new Response(JSON.stringify({ uebersprungen: "andere Stunde" }), { headers: cors });
    }

    const heute = berlinDatum(jetzt);
    if (einst?.lager_erinnerung_zuletzt === heute) {
      return new Response(JSON.stringify({ uebersprungen: "heute schon erinnert" }), { headers: cors });
    }

    // ---- 2) Auf welchen Tag bezieht sich die Erinnerung? -------------------
    const morgenDatum = new Date(jetzt.getTime() + 24 * 60 * 60 * 1000);
    const morgen = berlinDatum(morgenDatum);

    // Sonntags wird nicht ins Lager eingeteilt - dafür muss niemand erinnert
    // werden. (Samstag bleibt drin: es gibt Mitarbeiter mit Mo-Sa-Woche.)
    if (berlinWochentag(morgenDatum) === 0) {
      return new Response(JSON.stringify({ uebersprungen: "morgen ist Sonntag" }), { headers: cors });
    }

    // ---- 3) Ist für morgen schon etwas verschickt worden? ------------------
    const { data: plaene, error } = await db.from("glas_lager_plan")
      .select("id, gesendet_am, mitarbeiter_ids").eq("datum", morgen);
    if (error) throw new Error("Lager-Plan lesen: " + error.message);

    const schonRaus = (plaene || []).some((p) => !!p.gesendet_am);
    if (schonRaus) {
      return new Response(JSON.stringify({ uebersprungen: "schon verschickt", datum: morgen }), { headers: cors });
    }

    // ---- 4) Erinnern ------------------------------------------------------
    const angelegtAberNichtRaus = (plaene || []).length > 0;
    const text = angelegtAberNichtRaus
      ? "Für morgen ist eine Einteilung angelegt, aber noch nicht verschickt."
      : "Für morgen ist noch keine Lager-Einteilung verschickt.";

    // An wen? Ist in den Einstellungen eine Auswahl hinterlegt, gilt die -
    // sonst an alle, die Glasreinigungs-Meldungen empfangen (bisheriges
    // Verhalten, damit nach einer Umstellung nichts stillschweigend ausfällt).
    const empfaenger = Array.isArray(einst?.lager_erinnerung_an) ? einst.lager_erinnerung_an : [];
    let abfrage = db.from("push_subscriptions").select("*").eq("role", "glas");
    if (empfaenger.length) abfrage = abfrage.in("auth_user_id", empfaenger);
    const { data: subs } = await abfrage;

    // Ausgewählte Personen, aber kein einziges angemeldetes Gerät: dann würde
    // die Erinnerung ins Leere laufen. Lieber melden als schweigen.
    if (!subs || !subs.length) {
      return new Response(JSON.stringify({
        erinnert: false,
        grund: empfaenger.length
          ? "ausgewählte Empfänger haben kein angemeldetes Gerät"
          : "kein Gerät empfängt Glasreinigungs-Meldungen",
        datum: morgen,
      }), { headers: cors });
    }
    const payload = JSON.stringify({
      title: "📦 Lager-Plan für morgen",
      body: text,
      url: "/glas-admin.html?app=lager",
    });

    const ergebnisse = await Promise.allSettled(
      (subs || []).map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        ).catch(async (err) => {
          // Veraltete Anmeldung aufräumen, damit die Liste nicht zuwächst
          if (err.statusCode === 410 || err.statusCode === 404) {
            await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
          throw err;
        }),
      ),
    );

    // Merken, dass heute erinnert wurde - so bleibt es bei einer Meldung,
    // selbst wenn der Zeitplan einmal doppelt anlaufen sollte.
    await db.from("glas_einstellungen")
      .update({ lager_erinnerung_zuletzt: heute }).eq("id", "default");

    const zugestellt = ergebnisse.filter((r) => r.status === "fulfilled").length;
    return new Response(JSON.stringify({ erinnert: true, datum: morgen, zugestellt }), { headers: cors });
  } catch (e) {
    console.error("lager-erinnerung:", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), { status: 500, headers: cors });
  }
});
