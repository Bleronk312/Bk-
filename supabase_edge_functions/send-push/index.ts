// Supabase Edge Function: send-push
// Verschickt eine Push-Benachrichtigung an die Abonnenten einer Rolle.
//
// ============================================================================
// SICHERHEIT - der wichtigste Teil dieser Datei. Bitte vor dem Aendern lesen.
// ============================================================================
// Diese Function war bis v206 OHNE Anmeldepruefung. Supabase laesst von sich
// aus jeden durch, der irgendeinen gueltigen Schluessel mitschickt - und der
// anon-Schluessel steht in js/config.js, ist also oeffentlich. Jeder, der die
// Adresse der Function kannte, konnte damit:
//
//   * eine Benachrichtigung an ALLE Mitarbeiter schicken,
//   * mit frei waehlbarem Text,
//   * und mit einer frei waehlbaren Ziel-Adresse.
//
// Der Service Worker oeffnet diese Adresse beim Antippen (clients.openWindow).
// Das ergab einen fertigen Phishing-Weg: "GEKO - Bitte Passwort bestaetigen",
// Tippen, und der Mitarbeiter steht auf einer nachgebauten Anmeldeseite.
//
// Drei Riegel dagegen:
//   1. Es muss ein echtes KONTO-Token dabei sein (der anon-Schluessel zaehlt
//      ausdruecklich nicht).
//   2. Mitarbeiter duerfen nur ans BUERO schicken, nie an andere Mitarbeiter.
//      Genau so nutzt die App es auch: jede Meldung aus einer Mitarbeiter-App
//      geht an glas / graffiti / checkin_admin.
//   3. Die Ziel-Adresse muss ein Pfad im eigenen Haus sein ("/..."). Damit
//      fuehrt kein Antippen mehr nach draussen.
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");

webpush.setVapidDetails(
  "mailto:info@example.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rollen, die zur VERWALTUNG gehoeren. An die darf jeder Angemeldete schicken -
// das ist der Weg "Mitarbeiter meldet dem Buero etwas".
const BUERO_ROLLEN = new Set(["admin", "glas", "graffiti", "kalender", "checkin_admin"]);
// Rollen, hinter denen Mitarbeiter-Geraete stehen. Nur die Verwaltung darf sie
// ansprechen - sonst koennte ein Mitarbeiterkonto die ganze Belegschaft anschreiben.
const ALLE_ROLLEN = new Set([...BUERO_ROLLEN, "mitarbeiter", "checkin_ma", "geko_one"]);

const MAX_TITEL = 120;
const MAX_TEXT = 400;

// Ziel-Adresse: nur Pfade im eigenen Haus. "//fremd.de" waere fuer den Browser
// eine vollwertige fremde Adresse - deshalb wird das zweite "/" ausdruecklich
// ausgeschlossen.
function sichereUrl(roh: unknown): string | null {
  if (typeof roh !== "string" || !roh) return null;
  if (!roh.startsWith("/") || roh.startsWith("//")) return null;
  if (roh.length > 300) return null;
  return roh;
}

// Wer fragt? Gibt Rolle und Mitarbeiter-Nummer aus dem Konto-Token zurueck.
// app_metadata kann nur der Server setzen - niemand kann sich selbst befoerdern.
async function aufrufer(req: Request, admin: ReturnType<typeof createClient>) {
  const kopf = req.headers.get("Authorization") || "";
  const token = kopf.replace(/^Bearer\s+/i, "").trim();
  if (!token || token === SUPABASE_ANON_KEY) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  const meta = (data.user.app_metadata || {}) as Record<string, unknown>;
  return {
    id: data.user.id,
    istAdmin: meta.geko_rolle === "admin",
    maId: typeof meta.mitarbeiter_id === "string" ? meta.mitarbeiter_id : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error("VAPID-Schlüssel fehlen!");
      return new Response(JSON.stringify({ error: "VAPID-Schlüssel sind nicht als Secrets hinterlegt" }), { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ---- Riegel 1: echtes Konto ------------------------------------------
    const wer = await aufrufer(req, supabase);
    if (!wer) {
      return new Response(JSON.stringify({ error: "Nur für angemeldete Konten." }), { status: 403, headers: corsHeaders });
    }

    const { role, title, body, url, mitarbeiter_id, endpoint } = await req.json();

    if (!role || !title) {
      return new Response(JSON.stringify({ error: "role und title sind Pflicht" }), { status: 400, headers: corsHeaders });
    }
    if (!ALLE_ROLLEN.has(String(role))) {
      return new Response(JSON.stringify({ error: "Unbekannte Rolle." }), { status: 400, headers: corsHeaders });
    }

    // ---- Riegel 2: wen darf der Aufrufer erreichen? ------------------------
    // Der Test-Knopf in den Einstellungen schickt an EIN Geraet (endpoint).
    // Das ist auch fuer Mitarbeiter erlaubt - aber nur an das eigene Geraet,
    // deshalb wird unten geprueft, wem der endpoint gehoert.
    if (!wer.istAdmin && !endpoint && !BUERO_ROLLEN.has(String(role))) {
      return new Response(JSON.stringify({ error: "Diese Empfänger darf nur die Verwaltung anschreiben." }), { status: 403, headers: corsHeaders });
    }
    // Gezielt an einen bestimmten Mitarbeiter: nur die Verwaltung.
    if (mitarbeiter_id && !wer.istAdmin && mitarbeiter_id !== wer.maId) {
      return new Response(JSON.stringify({ error: "Fremde Empfänger darf nur die Verwaltung wählen." }), { status: 403, headers: corsHeaders });
    }

    let abfrage = supabase.from("push_subscriptions").select("*").eq("role", role);
    if (mitarbeiter_id) abfrage = abfrage.eq("mitarbeiter_id", mitarbeiter_id);
    if (endpoint) abfrage = abfrage.eq("endpoint", endpoint);
    const { data: subs, error } = await abfrage;

    if (error) {
      console.error("Datenbank-Fehler:", error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }

    // Einzelgeraet: gehoert es dem Aufrufer? Sonst koennte man mit einer
    // fremden Geraete-Adresse gezielt EINE Person anschreiben.
    if (endpoint && !wer.istAdmin) {
      // JEDE gefundene Zeile muss dem Aufrufer gehoeren. Bewusst "every" statt
      // "keine fremde": ein Alt-Abo ohne Mitarbeiter-Nummer waere sonst
      // durchgerutscht, und genau ueber so eine Zeile koennte man gezielt EIN
      // fremdes Geraet anschreiben.
      const alleMeine = wer.maId
        && (subs || []).length > 0
        && (subs || []).every((s) => s.mitarbeiter_id === wer.maId);
      if (!alleMeine) {
        return new Response(JSON.stringify({ error: "Dieses Gerät gehört nicht zu deinem Konto." }), { status: 403, headers: corsHeaders });
      }
    }

    // Fallback-URL STRENG nach Rolle: jede App/Rolle öffnet nur ihre eigene Seite.
    const roleUrls: Record<string, string> = {
      admin: "/graffiti.html", graffiti: "/graffiti.html", mitarbeiter: "/mitarbeiter.html",
      glas: "/glas-admin.html#/tab/touren", kalender: "/kalender.html#/tab/kalender",
      checkin_admin: "/checkins-admin.html", checkin_ma: "/checkins-ma.html",
      geko_one: "/meine.html",
    };
    // ---- Riegel 3: Ziel-Adresse nur im eigenen Haus -----------------------
    const zielUrl = sichereUrl(url) || roleUrls[String(role)] || "/meine.html";

    const payload = JSON.stringify({
      title: String(title).slice(0, MAX_TITEL),
      body: String(body || "").slice(0, MAX_TEXT),
      url: zielUrl,
    });

    const results = await Promise.allSettled(
      (subs || []).map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        ).catch(async (err) => {
          console.error("Fehler beim Senden an", sub.endpoint, ":", err.message || err);
          // Veraltete/ungültige Anmeldung -> aus der Datenbank entfernen
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
          throw err;
        })
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - sent;

    return new Response(JSON.stringify({ sent, failed, total: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Unerwarteter Fehler in send-push:", e.message || e, e.stack || "");
    return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 500, headers: corsHeaders });
  }
});
