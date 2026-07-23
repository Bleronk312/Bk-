// Supabase Edge Function: send-push
// Verschickt eine Push-Benachrichtigung an alle Abonnenten einer Rolle ("admin" oder "mitarbeiter").

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { role, title, body, url } = await req.json();

    if (!role || !title) {
      return new Response(JSON.stringify({ error: "role und title sind Pflicht" }), { status: 400, headers: corsHeaders });
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error("VAPID-Schlüssel fehlen! VAPID_PUBLIC_KEY:", !!VAPID_PUBLIC_KEY, "VAPID_PRIVATE_KEY:", !!VAPID_PRIVATE_KEY);
      return new Response(JSON.stringify({ error: "VAPID-Schlüssel sind nicht als Secrets hinterlegt" }), { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("role", role);

    if (error) {
      console.error("Datenbank-Fehler:", error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }

    // Fallback-URL STRENG nach Rolle: jede App/Rolle öffnet nur ihre eigene Seite.
    const roleUrls = {
      admin: "/admin.html", graffiti: "/admin.html", mitarbeiter: "/mitarbeiter.html",
      glas: "/glas-admin.html#/tab/touren", kalender: "/kalender.html#/tab/kalender",
      checkin_admin: "/checkins-admin.html", checkin_ma: "/checkins-ma.html",
    };
    const fallbackUrl = roleUrls[role] || "/mitarbeiter.html";
    const payload = JSON.stringify({ title, body: body || "", url: url || fallbackUrl });

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
