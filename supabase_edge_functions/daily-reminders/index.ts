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

async function sendToRole(supabase, role, title, body, url) {
  const { data: subs } = await supabase.from("push_subscriptions").select("*").eq("role", role);
  // Niemals "/" als Ziel: index.html leitet zu admin.html weiter - Mitarbeiter
  // bekommen immer ihre eigene Seite als Ziel.
  const payload = JSON.stringify({ title, body, url: url || (role === "admin" ? "/admin.html" : "/mitarbeiter.html") });
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

    let gesendet = 0;

    if (todays.length > 0) {
      const lines = todays.map((s) => {
        const strasse = (s.adresse || "").split("\n")[0];
        return `${berlinTimeString(new Date(s.termin))} – ${strasse}`;
      });
      const title = `☀️ ${todays.length} Termin${todays.length === 1 ? "" : "e"} heute!`;
      const body = lines.join("\n");
      await sendToRole(supabase, "graffiti", title, body, "/admin.html");
      await sendToRole(supabase, "mitarbeiter", title, body, "/mitarbeiter.html");
      gesendet += todays.length;
    }

    // ---- Glasreinigung: Erinnerungen für Kalender-Termine (nur Admin) ----
    // erinnerung: '' | 'same_day' | '1d' | '2d' | '7d' (X Tage vor dem Termin-Datum)
    // Wiederkehrende Termine (Spalte "wiederholung", JSON wie in der App) erinnern an
    // JEDEM Vorkommen - nicht nur am allerersten Startdatum.
    const offsets: Record<string, number> = { same_day: 0, "1d": 1, "2d": 2, "7d": 7 };
    const { data: glasTermine } = await supabase
      .from("glas_termine")
      .select("titel, datum, erinnerung, notiz, wiederholung");

    const addDays = (iso: string, days: number) => {
      const d = new Date(iso + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };
    const addMonths = (iso: string, months: number) => {
      const d = new Date(iso + "T12:00:00Z");
      d.setUTCMonth(d.getUTCMonth() + months);
      return d.toISOString().slice(0, 10);
    };
    const wochentag = (iso: string) => new Date(iso + "T12:00:00Z").getUTCDay();

    // Beginnt am Zieltag (heute + Vorlauf) ein Vorkommen dieses Termins?
    const vorkommenAm = (t, ziel: string) => {
      if (!t.datum || ziel < t.datum) return false;
      let w = null;
      try { w = t.wiederholung ? JSON.parse(t.wiederholung) : null; } catch (_e) { w = null; }
      if (!w || !w.freq) return ziel === t.datum;
      if (w.ende && ziel > w.ende) return false;
      if (w.freq === "taeglich") return true;
      if (w.freq === "woechentlich") {
        const tage = Array.isArray(w.wochentage) && w.wochentage.length ? w.wochentage : [wochentag(t.datum)];
        return tage.includes(wochentag(ziel));
      }
      if (w.freq === "monatlich" || w.freq === "jaehrlich") {
        const schritt = w.freq === "monatlich" ? 1 : 12;
        let cur = t.datum;
        for (let i = 0; i < 500 && cur <= ziel; i++) {
          if (cur === ziel) return true;
          cur = addMonths(cur, schritt);
        }
        return false;
      }
      return ziel === t.datum;
    };

    for (const t of glasTermine || []) {
      if (!(t.erinnerung in offsets)) continue;
      const ziel = addDays(today, offsets[t.erinnerung]); // der Tag, an den erinnert wird
      if (!vorkommenAm(t, ziel)) continue;
      const [y, m, d] = ziel.split("-");
      const wann = t.erinnerung === "same_day" ? "Heute" : `Am ${d}.${m}.${y}`;
      await sendToRole(
        supabase,
        "kalender",
        `⏰ Erinnerung: ${t.titel}`,
        `${wann}${t.notiz ? " · " + String(t.notiz).slice(0, 120) : ""}`,
        "/kalender.html#/tab/kalender"
      );
      gesendet++;
    }

    // ---- Glasreinigung: heutige Touren als Morgen-Übersicht (nur Admin) ----
    const { data: glasTouren } = await supabase
      .from("glas_touren")
      .select("name, datum, datum_bis, archiviert_am")
      .is("archiviert_am", null);

    const heutigeTouren = (glasTouren || []).filter(
      (t) => t.datum && t.datum <= today && today <= (t.datum_bis || t.datum)
    );
    if (heutigeTouren.length > 0) {
      await sendToRole(
        supabase,
        "glas",
        `🚐 ${heutigeTouren.length} Glas-Tour${heutigeTouren.length === 1 ? "" : "en"} heute`,
        heutigeTouren.map((t) => t.name || t.datum).join("\n"),
        "/glas-admin.html#/tab/touren"
      );
      gesendet += heutigeTouren.length;
    }

    if (gesendet === 0) {
      return new Response(JSON.stringify({ message: "Nichts fällig heute, keine Benachrichtigung gesendet" }));
    }

    return new Response(JSON.stringify({ notified: gesendet }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
