// Supabase Edge Function: checkin-reminders
// Wird per pg_cron alle paar Minuten aufgerufen. Erinnert Mitarbeiter mit einer OFFENEN
// Arbeitszeit-Schicht ans Auschecken – einmal kurz VOR dem geplanten Ende und danach
// mehrmals, bis ausgecheckt ist. Schichten, die deutlich über dem Ende liegen, werden
// zuverlässig automatisch geschlossen (Auschecken vergessen) und der Admin informiert.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");

webpush.setVapidDetails("mailto:info@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const VOR_MIN = 15;        // Minuten VOR dem Ende erinnern
const NACH_INTERVALL = 15; // Minuten Abstand der Nach-Erinnerungen
const AUTO_STUNDEN = 2;    // Stunden nach dem Ende automatisch schließen

async function sendPush(supabase, subs, title, body, url) {
  const payload = JSON.stringify({ title, body, url });
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

function fmtDauer(min) {
  min = Math.max(0, Math.round(min || 0));
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = Date.now();

    // Offene Schichten (noch nicht ausgecheckt)
    const { data: schichten, error } = await supabase
      .from("checkin_schichten").select("*").is("aus_ts", null);
    if (error) throw error;
    if (!schichten || !schichten.length) {
      return new Response(JSON.stringify({ message: "keine offenen Schichten" }));
    }

    // Orte für schönere Texte
    const { data: orte } = await supabase.from("checkin_orte").select("id, name");
    const ortName = {};
    (orte || []).forEach((o) => { ortName[o.id] = o.name; });

    // Admin-Abos (für Auto-Schließen-Hinweis) einmal laden
    const { data: adminSubs } = await supabase.from("push_subscriptions").select("*").eq("role", "checkin_admin");

    let vor = 0, nach = 0, autoClosed = 0;

    for (const s of schichten) {
      if (!s.plan_ende_ts || !s.ein_ts) continue;
      const endMs = new Date(s.plan_ende_ts).getTime();
      const einMs = new Date(s.ein_ts).getTime();
      const startMs = s.plan_start_ts ? new Date(s.plan_start_ts).getTime() : einMs;
      const oName = ortName[s.ort_id] || "Arbeitsort";

      // MA-Abos gezielt (per mitarbeiter_id)
      const { data: maSubs } = await supabase
        .from("push_subscriptions").select("*").eq("mitarbeiter_id", s.mitarbeiter_id);

      // ---- Automatisch schließen (deutlich über dem Ende) ----
      if (now >= endMs + AUTO_STUNDEN * 3600000) {
        const dauer = Math.round((endMs - Math.max(einMs, startMs)) / 60000);
        await supabase.from("checkin_schichten").update({
          aus_ts: s.plan_ende_ts, dauer_min: Math.max(0, dauer), auto_beendet: true,
        }).eq("id", s.id);
        if (maSubs && maSubs.length) {
          await sendPush(supabase, maSubs, "⏱️ Automatisch ausgecheckt", `${oName} · Auschecken wurde vergessen – bitte im Büro melden.`, "/checkins-ma.html");
        }
        if (adminSubs && adminSubs.length) {
          await sendPush(supabase, adminSubs, "⚠️ Auschecken vergessen", `${s.mitarbeiter_name || "Mitarbeiter"} · ${oName} – automatisch beendet (${fmtDauer(dauer)}).`, "/checkins-admin.html");
        }
        autoClosed++;
        continue;
      }

      if (!maSubs || !maSubs.length) continue; // kein Gerät für Erinnerungen

      // ---- Nach dem Ende: mehrmals erinnern ----
      if (now >= endMs) {
        const letzte = s.erinnert_nach_ts ? new Date(s.erinnert_nach_ts).getTime() : 0;
        if (now - letzte >= NACH_INTERVALL * 60000) {
          await sendPush(supabase, maSubs, "🏁 Bitte auschecken!", `${oName} · dein Feierabend ist vorbei – jetzt auschecken nicht vergessen.`, "/checkins-ma.html");
          await supabase.from("checkin_schichten").update({ erinnert_nach_ts: new Date(now).toISOString() }).eq("id", s.id);
          nach++;
        }
        continue;
      }

      // ---- Kurz VOR dem Ende: einmal erinnern ----
      if (!s.erinnert_vor && now >= endMs - VOR_MIN * 60000) {
        const restMin = Math.round((endMs - now) / 60000);
        await sendPush(supabase, maSubs, "⏰ Feierabend naht", `${oName} · in ${restMin} Min ist Feierabend – ans Auschecken denken.`, "/checkins-ma.html");
        await supabase.from("checkin_schichten").update({ erinnert_vor: true }).eq("id", s.id);
        vor++;
      }
    }

    return new Response(JSON.stringify({ vor, nach, autoClosed }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
