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

// "HH:MM" -> Minuten (24:00 = 1440), sonst null.
function timeToMin(s) {
  const m = String(s || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h === 24 && mi === 0) return 1440;
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

// Effektives Zeitfenster eines Punkts im Rundgang: Punkt-Override > Rundgang > Punkt-Standard.
function effFenster(rg, e, p) {
  const von = timeToMin(e && e.fenster_von) ?? timeToMin(rg && rg.fenster_von) ?? timeToMin(p && p.fenster_von);
  const bis = timeToMin(e && e.fenster_bis) ?? timeToMin(rg && rg.fenster_bis) ?? timeToMin(p && p.fenster_bis);
  let tol = e && e.toleranz_min;
  if (tol == null || tol === "") tol = rg && rg.toleranz_min;
  if (tol == null || tol === "") tol = p && p.toleranz_min;
  tol = parseInt(tol, 10);
  if (isNaN(tol)) tol = 0;
  return { von, bis, tol };
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

    // ============================================================================
    // RUNDGÄNGE: fällig / läuft ab / verpasst
    // ============================================================================
    let faellig = 0, ablauf = 0, verpasstN = 0;
    try {
      // "Jetzt" in deutscher Zeit (die Zeitfenster sind in Ortszeit gemeint).
      const berlinDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
      const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
      const nowMin = (+hm.split(":")[0]) * 60 + (+hm.split(":")[1]);
      const heuteIsoDay = (() => { const x = new Date(berlinDate + "T12:00:00Z").getUTCDay(); return x === 0 ? 7 : x; })();

      const [rgRes, ptRes, logRes, stRes, maRes] = await Promise.all([
        supabase.from("checkin_rundgaenge").select("*").eq("aktiv", true),
        supabase.from("checkin_punkte").select("*"),
        supabase.from("checkin_logs").select("*").eq("datum", berlinDate),
        supabase.from("checkin_erinnerungen").select("*").eq("datum", berlinDate),
        supabase.from("glas_mitarbeiter").select("id, name"),
      ]);
      const ptMap = {}; (ptRes.data || []).forEach((p) => { ptMap[p.id] = p; });
      const stMap = {}; (stRes.data || []).forEach((s) => { stMap[s.id] = s; });
      const maName = {}; (maRes.data || []).forEach((m) => { maName[m.id] = m.name; });
      const maSubCache = {};
      const getMaSubs = async (id) => {
        if (!id) return [];
        if (maSubCache[id]) return maSubCache[id];
        const { data } = await supabase.from("push_subscriptions").select("*").eq("mitarbeiter_id", id);
        return (maSubCache[id] = data || []);
      };

      for (const rg of (rgRes.data || [])) {
        const tage = String(rg.tage || "").split(",").map((x) => parseInt(x.trim(), 10)).filter((x) => x >= 1 && x <= 7);
        if (!tage.includes(heuteIsoDay)) continue;
        let punkte = rg.punkte;
        if (typeof punkte === "string") { try { punkte = JSON.parse(punkte || "[]"); } catch (_e) { punkte = []; } }
        if (!Array.isArray(punkte)) punkte = [];

        for (const e of punkte) {
          const p = ptMap[e.punkt_id];
          if (!p) continue;
          const f = effFenster(rg, e, p);
          if (f.von == null || f.bis == null) continue; // nur Punkte mit Zeitfenster
          const done = (logRes.data || []).some((l) => l.rundgang_id === rg.id && l.punkt_id === e.punkt_id && l.datum === berlinDate);
          if (done) continue;

          const startTol = f.von - f.tol, endTol = f.bis + f.tol;
          const sid = `${rg.id}__${e.punkt_id}__${berlinDate}`;
          const st = stMap[sid] || {};

          // c) Verpasst -> Admin (nur frisch, bis 60 Min nach Ablauf, damit kein Nachholen)
          if (nowMin >= endTol && nowMin <= endTol + 60 && !st.verpasst) {
            if (adminSubs && adminSubs.length) {
              const wem = rg.mitarbeiter_id ? ` · zugeteilt: ${maName[rg.mitarbeiter_id] || "?"}` : "";
              await sendPush(supabase, adminSubs, "⚠️ Punkt verpasst", `${p.name} · Rundgang ${rg.name}${wem}`, "/checkins-admin.html");
            }
            await supabase.from("checkin_erinnerungen").upsert({ id: sid, datum: berlinDate, verpasst: true });
            verpasstN++;
            continue;
          }
          // b) Läuft in <=15 Min ab -> zugeteilter MA
          if (nowMin >= endTol - 15 && nowMin < endTol && !st.ablauf) {
            const subs = await getMaSubs(rg.mitarbeiter_id);
            if (subs.length) await sendPush(supabase, subs, "⏳ Fenster läuft ab", `${p.name} · noch ${endTol - nowMin} Min – bitte einchecken.`, "/checkins-ma.html");
            await supabase.from("checkin_erinnerungen").upsert({ id: sid, datum: berlinDate, ablauf: true });
            ablauf++;
            continue;
          }
          // a) Jetzt fällig -> zugeteilter MA (bis 15 Min vor Ablauf, danach greift b)
          if (nowMin >= startTol && nowMin < endTol - 15 && !st.faellig) {
            const subs = await getMaSubs(rg.mitarbeiter_id);
            if (subs.length) await sendPush(supabase, subs, "📍 Punkt jetzt fällig", `${p.name} · Rundgang ${rg.name}`, "/checkins-ma.html");
            await supabase.from("checkin_erinnerungen").upsert({ id: sid, datum: berlinDate, faellig: true });
            faellig++;
          }
        }
      }
      // Alte Merker aufräumen (älter als 10 Tage)
      const alt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date(now - 10 * 86400000));
      await supabase.from("checkin_erinnerungen").delete().lt("datum", alt);
    } catch (e) {
      console.error("Rundgang-Erinnerungen fehlgeschlagen:", e);
    }

    return new Response(JSON.stringify({ vor, nach, autoClosed, faellig, ablauf, verpasst: verpasstN }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
