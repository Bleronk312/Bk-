// GEKO One · Kalender für Mitarbeiter
//
// Führt alle Termine zusammen, die den angemeldeten Mitarbeiter betreffen - und NUR die.
// Quellen (je nach Freischaltung):
//   🧽 Glas-Touren      (zugang_glas)      -> glas_touren, über Start-/Endedatum
//   🎨 Graffiti-Termine (zugang_graffiti)  -> scheine.termin
//   📍 Rundgänge        (zugang_checkin)   -> checkin_rundgaenge (Wochentage)
//   🏖️ Urlaub           immer               -> glas_urlaub, AUSSCHLIESSLICH der eigene
//
// DATENSCHUTZ: Urlaub wird strikt auf die eigene mitarbeiter_id gefiltert - der Urlaub
// von Kollegen taucht hier nie auf. Auch Rundgänge erscheinen nur, wenn sie dem
// Mitarbeiter zugewiesen sind (oder ausdrücklich für alle gelten).

// Kräftige, klar unterscheidbare Farben je Bereich - im Monatsraster sind das nur
// kleine Punkte, deshalb bewusst satt statt pastellig.
const ONE_KAL_FARBEN = {
  glas: "#1668b8",      // Blau
  graffiti: "#c2189c",       // Lila/Magenta - offen
  graffitiFertig: "#7a2a6b", // dieselbe Familie, nur dunkler - erledigt
  checkin: "#ef7d00",   // Orange
  urlaub: "#12a150",    // Grün
  lager: "#6b4ee6",     // Violett
  erledigt: "#2e9e4f",  // Grün: in der Vergangenheit erledigt
  verpasst: "#d13438",  // Rot: Termin ist vorbei und wurde nicht erledigt
  grau: "#8e99a6",      // Vergangenes ohne Erledigt-Begriff (z.B. Urlaub)
};

let oneKalTermine = null;   // geladene Termine (Array) oder null = noch nicht geladen
let oneKalMonat = null;     // {jahr, monat} - angezeigter Monat, null = aktueller
let oneKalFehler = "";

function oneKalHeute() { return glasIsoFromDate(new Date()); }

/* ---- Feiertage (NRW) ----
   Osterabhängige Feiertage über die Gaußsche Osterformel, der Rest steht fest.
   Wird je Jahr einmal berechnet und gemerkt. */
const oneFeiertageCache = {};

function oneOstersonntag(jahr) {
  const a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);   // 3 = März, 4 = April
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(jahr, monat - 1, tag);
}

function oneFeiertage(jahr) {
  if (oneFeiertageCache[jahr]) return oneFeiertageCache[jahr];
  const o = oneOstersonntag(jahr);
  const plus = (n) => glasIsoFromDate(new Date(o.getFullYear(), o.getMonth(), o.getDate() + n));
  const fest = (mo, tg) => `${jahr}-${String(mo).padStart(2, "0")}-${String(tg).padStart(2, "0")}`;
  const map = {
    [fest(1, 1)]: "Neujahr",
    [plus(-2)]: "Karfreitag",
    [plus(0)]: "Ostersonntag",
    [plus(1)]: "Ostermontag",
    [fest(5, 1)]: "Tag der Arbeit",
    [plus(39)]: "Christi Himmelfahrt",
    [plus(49)]: "Pfingstsonntag",
    [plus(50)]: "Pfingstmontag",
    [plus(60)]: "Fronleichnam",
    [fest(10, 3)]: "Tag der Deutschen Einheit",
    [fest(11, 1)]: "Allerheiligen",
    [fest(12, 25)]: "1. Weihnachtstag",
    [fest(12, 26)]: "2. Weihnachtstag",
  };
  oneFeiertageCache[jahr] = map;
  return map;
}

// Name des Feiertags oder "" - gilt für Nordrhein-Westfalen (Bochum).
function oneFeiertagName(iso) {
  const jahr = parseInt(String(iso).slice(0, 4), 10);
  if (!jahr) return "";
  return oneFeiertage(jahr)[iso] || "";
}

function oneKalMonatJetzt() {
  if (oneKalMonat) return oneKalMonat;
  const d = new Date();
  return { jahr: d.getFullYear(), monat: d.getMonth() }; // monat 0-11
}

function oneKalBlaettern(schritt) {
  const m = oneKalMonatJetzt();
  const d = new Date(m.jahr, m.monat + schritt, 1);
  oneKalMonat = { jahr: d.getFullYear(), monat: d.getMonth() };
  renderOne();
  // Rundgänge und Lager-Einteilungen werden für den ANGEZEIGTEN Monat aufgelöst -
  // nach dem Blättern also still nachladen. Bewusst ohne oneKalTermine=null: die
  // alten Einträge bleiben stehen, bis die neuen da sind (kein leeres Aufblitzen).
  oneKalLeiseNachladen();
}

// Lädt neu, ohne die Ansicht zwischendurch zu leeren.
function oneKalLeiseNachladen() {
  if (oneKalLaeuft) return;
  oneKalLaeuft = true;
  oneKalLaden()
    .catch(() => {})
    .finally(() => { oneKalLaeuft = false; if (oneScreen === "kalender") renderOne(); });
}

// Seitwärts wischen blättert den Monat. Bewusst mit Richtungssperre: erst wenn
// die Geste eindeutig waagerecht ist, wird sie als Blättern gewertet - sonst
// bliebe das normale Hoch/Runter-Scrollen (und Pull-to-Refresh) hängen.
function oneKalWischAktivieren() {
  const el = document.getElementById("okalRaster");
  if (!el || el.dataset.wisch) return;
  el.dataset.wisch = "1";
  let x0 = null, y0 = null, richtung = null;
  el.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) { x0 = null; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; richtung = null;
  }, { passive: true });
  el.addEventListener("touchmove", (e) => {
    if (x0 === null) return;
    const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
    if (!richtung && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) {
      // Deutlich waagerecht (mehr als das 1.4-fache) = blättern, sonst scrollen
      richtung = Math.abs(dx) > Math.abs(dy) * 1.4 ? "x" : "y";
    }
    if (richtung === "x") {
      el.style.transform = `translateX(${Math.max(-70, Math.min(70, dx * 0.35))}px)`;
      el.style.opacity = String(1 - Math.min(Math.abs(dx) / 320, 0.4));
    }
  }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = (e.changedTouches[0] || {}).clientX - x0;
    el.style.transition = "transform .18s ease, opacity .18s ease";
    el.style.transform = ""; el.style.opacity = "";
    setTimeout(() => { el.style.transition = ""; }, 200);
    if (richtung === "x" && Math.abs(dx) > 55) oneKalBlaettern(dx < 0 ? 1 : -1);
    x0 = null; richtung = null;
  }, { passive: true });
}

// Verhindert, dass eine einzelne hängende Abfrage den ganzen Kalender blockiert:
// Nach spätestens 8 Sekunden gibt eine Quelle auf (leeres Ergebnis) statt ewig zu warten.
function oneKalMitTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Zeitüberschreitung")), ms || 8000)),
  ]);
}

let oneKalLaeuft = false; // schützt vor doppeltem Laden

// Lädt alle Quellen parallel. Jede Quelle einzeln abgesichert: fällt eine aus (Tabelle
// fehlt, kein Netz, Zeitüberschreitung), bleiben die anderen trotzdem stehen. Der
// Kalender kann dadurch NIE ewig im Ladekreis hängen.
async function oneKalLaden() {
  const eintraege = [];
  const ich = oneUser.id;
  const aufgaben = [];

  // --- Glas-Touren -------------------------------------------------------------
  if (oneUser.zugang_glas !== false) {
    aufgaben.push((async () => {
      // Stopps mitladen: nur damit steht fest, ob eine Tour in der Touren-App
      // überhaupt noch geöffnet werden KANN. Die App blendet alte, komplett
      // erledigte Touren aus - ohne diese Prüfung landete ein Klick darauf in
      // einer leeren Liste statt bei der Tour.
      const [tRes, sRes] = await Promise.all([
        oneKalMitTimeout(sb.from("glas_touren").select("id, name, datum, datum_bis, archiviert_am, ma_versteckt").order("datum", { ascending: true })),
        oneKalMitTimeout(sb.from("glas_stopps").select("tour_id, status, signed_at, datum")).catch(() => ({ data: [] })),
      ]);
      const stopps = (sRes && sRes.data) || [];
      const heute = oneKalHeute();
      (tRes.data || []).forEach((t) => {
        // Vom Admin ausgeblendete Touren gehören nie in die MA-Ansicht.
        if (!t.datum || t.ma_versteckt) return;
        const meine = stopps.filter((s) => s.tour_id === t.id);
        const offen = meine.some((s) => s.status === "offen");
        const ende = t.datum_bis || t.datum;
        // "Abgelaufen" = in der Touren-App nicht mehr vorhanden: entweder archiviert
        // oder vorbei UND vollständig erledigt. Eine vergangene Tour mit noch offenen
        // Stopps bleibt bewusst öffenbar - die muss der Mitarbeiter ja nacharbeiten.
        const abgelaufen = !!t.archiviert_am || (ende < heute && meine.length > 0 && !offen);
        // Für die Kalenderfarbe zählt etwas anderes als für die Öffenbarkeit:
        // erledigt = kein Stopp mehr offen. Eine vergangene Tour mit offenen
        // Stopps ist NICHT erledigt und erscheint deshalb rot.
        const erledigt = meine.length > 0 && !offen;
        const fertigeStopps = meine.filter((x) => x.status !== "offen").length;
        eintraege.push({
          art: "glas", ico: "🧽", titel: t.name || "Tour",
          von: t.datum, bis: ende,
          sub: erledigt
            ? `Glas-Tour · erledigt${meine.length ? ` (${meine.length}/${meine.length})` : ""}`
            : (ende < heute && meine.length)
              ? `Glas-Tour · offen (${fertigeStopps}/${meine.length})`
              : "Glas-Tour",
          // Direkt IN die Tour springen (nicht nur in die App)
          ziel: abgelaufen ? null : `glas-mitarbeiter.html?tour=${encodeURIComponent(t.id)}`,
          abgelaufen, erledigt,
        });
      });
    })());
  }

  // --- Graffiti-Termine --------------------------------------------------------
  if (oneUser.zugang_graffiti === true) {
    aufgaben.push((async () => {
      // Archivierte bewusst MIT: Archivieren räumt nur die Arbeitsliste der
      // Graffiti-App auf. Im Kalender bleibt jede Entfernung stehen - er ist die
      // Chronik, an der man auch später ablesen kann, wann was gemacht wurde.
      // Ohne Termin, aber unterschrieben -> der Tag der Unterschrift ist der Tag
      // der Arbeit; sonst würden gerade die erledigten Fälle fehlen.
      const { data } = await oneKalMitTimeout(sb.from("scheine").select("id, kunde, adresse, termin, archiviert, datum, signed_at, unterschrift_name").order("termin", { ascending: true }));
      (data || []).forEach((s) => {
        const quelle = s.termin || s.signed_at;
        if (!quelle) return;
        const iso = String(quelle).slice(0, 10);
        const zeit = glasUhrzeitVonTimestamp(quelle);
        const fertig = !!(s.signed_at || s.unterschrift_name);
        eintraege.push({
          art: "graffiti", ico: "🎨", titel: s.kunde || "Graffiti-Termin",
          von: iso, bis: iso, zeit,
          sub: ((s.adresse || "").split("\n")[0] || "Graffiti") + (fertig ? " · erledigt" : ""),
          // Direkt IN den Abnahmeschein springen, nicht nur in die Graffiti-App
          ziel: "mitarbeiter.html#/schein/" + encodeURIComponent(s.id),
          fertig,
        });
      });
    })());
  }

  // --- Rundgänge (Check-ins) ---------------------------------------------------
  // Wiederkehrende Rundgänge an festen Wochentagen: für den angezeigten Monat
  // aufgelöst. Nur die, die diesem Mitarbeiter zugewiesen sind (oder allen).
  if (oneUser.zugang_checkin === true) {
    aufgaben.push((async () => {
      const m = oneKalMonatJetzt();
      const vonIso = glasIsoFromDate(new Date(m.jahr, m.monat, 1));
      const bisIso = glasIsoFromDate(new Date(m.jahr, m.monat + 1, 0));
      // Rundgänge + die eigenen Check-ins des Monats gemeinsam laden. Aus den Logs
      // ergibt sich, welche Rundgänge an welchem Tag schon erledigt wurden.
      const [rRes, lRes] = await Promise.all([
        oneKalMitTimeout(sb.from("checkin_rundgaenge").select("id, name, mitarbeiter_id, mitarbeiter_ids, tage, fenster_von, fenster_bis, aktiv, punkte")),
        // BEWUSST ohne Mitarbeiter-Filter: Ein Rundgang ist eine GEMEINSAME
        // Aufgabe - checkt ein Kollege einen Punkt ein, ist der erledigt, egal
        // für wen. Vorher zählte hier nur der eigene Check-in, dadurch stand im
        // Kalender "0/5" (und ein roter Balken), obwohl der Rundgang gelaufen war.
        oneKalMitTimeout(sb.from("checkin_logs").select("rundgang_id, punkt_id, datum")
          .gte("datum", vonIso).lte("datum", bisIso)).catch(() => ({ data: [] })),
      ]);
      const data = rRes.data;
      const logs = (lRes && lRes.data) || [];
      // "rundgang_id|datum" -> Menge der abgehakten PUNKTE an dem Tag.
      // Eine Menge, kein Zähler: Checken zwei Leute denselben Punkt ein, ist er
      // trotzdem nur einmal erledigt - sonst käme man auf 6/5.
      const erledigt = new Map();
      logs.forEach((l) => {
        if (!l.rundgang_id || !l.datum) return;
        const k = l.rundgang_id + "|" + l.datum;
        if (!erledigt.has(k)) erledigt.set(k, new Set());
        erledigt.get(k).add(l.punkt_id || "?");
      });
      const letzter = new Date(m.jahr, m.monat + 1, 0).getDate();
      (data || []).forEach((r) => {
        if (r.aktiv === false) return;
        // Zuweisung: neue Liste (mitarbeiter_ids) hat Vorrang, sonst Einzelfeld.
        let ids = [];
        try { ids = Array.isArray(r.mitarbeiter_ids) ? r.mitarbeiter_ids : JSON.parse(r.mitarbeiter_ids || "[]"); } catch (e) { ids = []; }
        const fuerAlle = !ids.length && !r.mitarbeiter_id;
        const meiner = ids.includes(ich) || r.mitarbeiter_id === ich;
        if (!fuerAlle && !meiner) return;
        const tage = String(r.tage || "").split(",").map((x) => parseInt(x.trim(), 10)).filter((x) => x >= 1 && x <= 7);
        for (let tag = 1; tag <= letzter; tag++) {
          const d = new Date(m.jahr, m.monat, tag);
          const wt = d.getDay() === 0 ? 7 : d.getDay(); // 1=Mo … 7=So
          if (!tage.includes(wt)) continue;
          const iso = glasIsoFromDate(d);
          // Wie viele Punkte hat der Rundgang, und wie viele davon sind an dem Tag
          // schon abgehakt? Daraus ergibt sich "erledigt" bzw. "teilweise".
          let punkte = [];
          try { punkte = Array.isArray(r.punkte) ? r.punkte : JSON.parse(r.punkte || "[]"); } catch (e) { punkte = []; }
          const gemacht = (erledigt.get(r.id + "|" + iso) || new Set()).size;
          const fertig = punkte.length > 0 && gemacht >= punkte.length;
          const teilweise = gemacht > 0 && !fertig;
          eintraege.push({
            art: "checkin", ico: fertig ? "✅" : "📍", titel: r.name || "Rundgang",
            von: iso, bis: iso, zeit: r.fenster_von || "",
            sub: fertig
              ? `Rundgang · erledigt${punkte.length ? ` (${gemacht}/${punkte.length})` : ""}`
              : teilweise
                ? `Rundgang · ${gemacht}/${punkte.length} erledigt`
                : `Rundgang · ${r.fenster_von || "?"}–${r.fenster_bis || "?"}`,
            // Direkt zu DIESEM Tag springen (nicht nur in die App): dort steht dann,
            // was an dem Tag abgehakt wurde und wie lange gearbeitet wurde.
            // Vergangene Tage bleiben ausdruecklich anklickbar: dort steht,
            // wann wo eingecheckt wurde - genau das will man rueckblickend sehen.
            ziel: `checkins-ma.html?datum=${iso}`, tage, fertig,
          });
        }
      });
    })());
  }

  // --- Lager-Plan (vom Büro verschickt) ----------------------------------------
  // Nur die Gruppen, in denen dieser Mitarbeiter selbst steht - wer sonst noch
  // eingeteilt ist, geht ihn nichts an (dasselbe Prinzip wie beim Urlaub).
  if (oneUser.zugang_lager === true) {
    aufgaben.push((async () => {
      const m = oneKalMonatJetzt();
      const vonIso = glasIsoFromDate(new Date(m.jahr, m.monat, 1));
      const bisIso = glasIsoFromDate(new Date(m.jahr, m.monat + 1, 0));
      const res = await oneKalMitTimeout(oneLagerAbfrage(vonIso, bisIso));
      (res.data || []).filter((p) => oneLagerIds(p).includes(ich)).forEach((p) => {
        const abw = !!(p.abwesend && p.abwesend[ich]);
        eintraege.push({
          art: "lager", ico: abw ? "✗" : "📦", titel: "Lager",
          von: p.datum, bis: p.datum, zeit: p.uhrzeit || "",
          // Die Uhrzeit hängt die Liste selbst an - hier nur, WORUM es geht.
          sub: abw ? "Nicht da gewesen (Vermerk vom Büro)" : p.notiz ? "Im Lager sein · " + p.notiz : "Im Lager sein",
          ziel: null,
        });
      });
    })());
  }

  // --- Eigener Urlaub (NUR der eigene - Datenschutz) ----------------------------
  aufgaben.push((async () => {
    // Mit Status; fehlt die Spalte noch (SQL nicht ausgeführt), ohne sie laden.
    let res = await oneKalMitTimeout(sb.from("glas_urlaub").select("id, von, bis, notiz, mitarbeiter_id, status, antwort").eq("mitarbeiter_id", ich));
    if (res.error && /(status|antwort)/i.test(res.error.message || "")) {
      res = await oneKalMitTimeout(sb.from("glas_urlaub").select("id, von, bis, notiz, mitarbeiter_id").eq("mitarbeiter_id", ich));
    }
    (res.data || []).forEach((u) => {
      if (!u.von) return;
      const st = u.status || "genehmigt";
      if (st === "abgelehnt") return; // abgelehnte Anträge nicht als Termin zeigen
      eintraege.push({
        art: "urlaub", ico: st === "offen" ? "⏳" : "🏖️",
        titel: st === "offen" ? "Urlaub beantragt" : "Urlaub",
        von: u.von, bis: u.bis || u.von,
        sub: st === "offen" ? "Wartet auf das Büro" : (u.notiz || "Dein Urlaub"),
        ziel: null, offen: st === "offen",
      });
    });
  })());

  const ergebnisse = await Promise.allSettled(aufgaben);
  oneKalFehler = ergebnisse.some((r) => r.status === "rejected") ? "Ein Teil der Termine konnte nicht geladen werden." : "";
  eintraege.sort((a, b) => (a.von === b.von ? (a.zeit || "").localeCompare(b.zeit || "") : a.von.localeCompare(b.von)));
  oneKalTermine = eintraege;
}

// Startet das Laden GENAU EINMAL und zeichnet danach neu. Egal was passiert (Fehler,
// Zeitüberschreitung), am Ende steht ein Array in oneKalTermine - der Ladekreis
// verschwindet also immer.
function oneKalStarteLaden() {
  if (oneKalLaeuft) return;
  oneKalLaeuft = true;
  if (oneMeineAntraege === null) oneLadeMeineAntraege(); // eigene Anträge parallel holen
  oneKalLaden()
    .catch(() => { oneKalTermine = oneKalTermine || []; oneKalFehler = "Termine konnten nicht geladen werden. Bitte erneut versuchen."; })
    .finally(() => { oneKalLaeuft = false; if (oneScreen === "kalender") renderOne(); });
}

// Vom "Aktualisieren"-Knopf: neu laden erzwingen.
function oneKalNeuLaden() {
  oneKalTermine = null;
  oneKalStarteLaden();
  renderOne();
}

// Alle Termine, die einen bestimmten Tag berühren (mehrtägige Touren zählen an jedem Tag)
function oneKalAmTag(iso) {
  return (oneKalTermine || []).filter((e) => e.von <= iso && iso <= (e.bis || e.von));
}

// Die Legende zeigt AUSSCHLIESSLICH das, was auch wirklich freigeschaltet ist -
// abgeleitet aus den geladenen Terminen. Nimmt das Büro einen Bereich weg, sind
// dessen Termine beim nächsten Laden weg und die Zeile verschwindet automatisch
// mit. Kommt einer dazu, erscheint sie von selbst.
function renderOneKalLegende() {
  const heute = oneKalHeute();
  const vorhanden = new Set();
  (oneKalTermine || []).forEach((e) => {
    vorhanden.add(e.art);
    // Grün und Rot nur erklären, wenn es sie im angezeigten Monat auch gibt.
    const vorbei = (e.bis || e.von) < heute;
    // Graffiti bleibt lila und wird nie grün/rot - also auch nicht so erklären.
    if (vorbei && e.art !== "urlaub" && e.art !== "lager" && e.art !== "graffiti") {
      vorhanden.add((e.fertig || e.erledigt) ? "erledigt" : "verpasst");
    }
  });
  const zeilen = [
    ["glas", "Glas-Touren"],
    ["graffiti", "Graffiti"],
    ["checkin", "Rundgänge"],
    ["lager", "Lager"],
    ["urlaub", "Dein Urlaub"],
    ["erledigt", "Erledigt"],
    ["verpasst", "Offen geblieben"],
  ].filter(([k]) => vorhanden.has(k));
  if (!zeilen.length) return "";
  return `<div class="okal-legende">${zeilen
    .map(([k, txt]) => `<span><i style="background:${ONE_KAL_FARBEN[k]}"></i>${txt}</span>`)
    .join("")}</div>`;
}

function oneKalMonatName(m) {
  return ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"][m];
}

/* ---------------- Monatsraster mit durchgehenden Balken ----------------
   Dieselbe Optik wie der Kalender im Büro: ein mehrtägiger Termin ist EIN Balken
   mit EINER Beschriftung quer über seine Tage - statt an jedem Tag nur ein Punkt.
   Man sieht dadurch sofort, ob etwas ein zusammenhängender Zeitraum ist (Tour über
   drei Tage, Urlaubswoche) oder mehrere einzelne Termine.

   Die DATEN bleiben davon unberührt: hier stehen weiterhin ausschließlich die
   eigenen Termine (siehe oneKalLaden) - vom Kalender der Kollegen ist nichts zu
   sehen. Kopiert wurde nur das Aussehen, nicht der Inhalt. */

const ONE_KAL_MAX_BALKEN = 4; // mehr passt auf dem Handy nicht in eine Tageszelle

// Beschriftung des Balkens. Beim Lager steht die UHRZEIT drin, nicht das Wort
// "Lager": dass es ums Lager geht, sagt schon die Farbe (Legende) - wichtig ist
// morgens einzig, um wann man da sein soll.
function oneKalBalkenLabel(e) {
  if (e.art === "lager") return e.zeit || "Lager";
  return e.titel || "";
}

// Die geladenen Termine als Balken: Zeitraum, Farbe, Beschriftung.
// Welche Farbe bekommt ein Balken?
//   Zukunft/heute : Farbe des Bereichs (blau Glas, orange Check-ins, ...)
//   Vergangenheit : grün wenn erledigt, rot wenn nicht
// Vorher war beides grau - man sah also nicht, ob eine vergangene Tour
// abgearbeitet wurde oder liegengeblieben ist. Genau darum geht es aber beim
// Blick zurück.
function oneKalBalkenFarbe(e) {
  const heute = oneKalHeute();
  const bis = e.bis || e.von;
  const vorbei = bis < heute;

  // Urlaub kennt kein "erledigt" - vergangener Urlaub tritt einfach zurück.
  if (e.art === "urlaub") return vorbei ? ONE_KAL_FARBEN.grau : ONE_KAL_FARBEN.urlaub;
  // Lager ebenso: dass man da war, hakt das Büro ab, nicht der Kalender.
  if (e.art === "lager") return vorbei ? ONE_KAL_FARBEN.grau : ONE_KAL_FARBEN.lager;
  // Graffiti behält IMMER sein Lila - erledigt nur dunkler, wie im Büro-Kalender.
  // Grün/Rot wäre hier eine Wertung, die niemand einlösen kann: unterschrieben
  // wird beim Kunden, ein Schein ohne Unterschrift ist deshalb nicht "verpasst".
  if (e.art === "graffiti") return e.fertig ? ONE_KAL_FARBEN.graffitiFertig : ONE_KAL_FARBEN.graffiti;

  if (!vorbei) return ONE_KAL_FARBEN[e.art] || ONE_KAL_FARBEN.glas;
  return (e.fertig || e.erledigt) ? ONE_KAL_FARBEN.erledigt : ONE_KAL_FARBEN.verpasst;
}

function oneKalBalken() {
  const heute = oneKalHeute();
  return (oneKalTermine || []).map((e, i) => ({
    _i: i,
    datum: e.von,
    datum_bis: e.bis || e.von,
    col: oneKalBalkenFarbe(e),
    // "done" streicht den Balken durch und macht ihn blasser. Nur für wirklich
    // Erledigtes - Verpasstes soll ins Auge fallen, nicht zurücktreten.
    // Graffiti zählt schon ab der Unterschrift als fertig, nicht erst wenn der
    // Tag vorbei ist: unterschrieben ist unterschrieben.
    done: e.art === "graffiti" ? !!e.fertig : (!!(e.fertig || e.erledigt) && (e.bis || e.von) < heute),
    // Urlaub (auch beantragter) bewusst dezent/kursiv - klar anders als Arbeit
    urlaub: e.art === "urlaub",
    label: oneKalBalkenLabel(e),
  }));
}

// Baut die Tageszellen. Kernstück ist die feste "Lane" (Zeile) je Termin über den
// gesamten Zeitraum: nur so liegt ein mehrtägiger Balken an jedem Tag auf derselben
// Höhe und läuft lückenlos durch. Mehrtägige Balken halten sich links und rechts
// einen Tag Abstand frei, damit direkt daneben kein Einzeltermin andockt und wie ein
// abgerissenes Stück des Balkens wirkt.
function oneKalRasterZellen(weeks, heute) {
  const m = oneKalMonatJetzt();
  const events = oneKalBalken();

  const laneEnds = []; // laneEnds[l] = belegt-bis-Datum der Zeile l
  events
    .map((e) => {
      const mehrtaegig = e.datum_bis !== e.datum;
      return {
        e,
        s: mehrtaegig ? glasAddDaysIso(e.datum, -1) : e.datum,
        en: mehrtaegig ? glasAddDaysIso(e.datum_bis, 1) : e.datum_bis,
      };
    })
    .sort((a, b) => a.s.localeCompare(b.s) || b.en.localeCompare(a.en) || a.e._i - b.e._i)
    .forEach((it) => {
      let lane = 0;
      while (lane < laneEnds.length && laneEnds[lane] >= it.s) lane++;
      it.e._lane = lane;
      laneEnds[lane] = it.en;
    });

  // Je Woche und Termin: den vollen Namen auf das sichtbare Segment legen
  const texte = new Map();
  weeks.forEach((week) => {
    events.forEach((t) => {
      const seg = week.filter((iso) => iso >= t.datum && iso <= t.datum_bis);
      if (!seg.length) return;
      const teile = glasCalBalkenText(t.label, seg.length);
      seg.forEach((iso, i) => texte.set(t._i + "|" + iso, teile[i]));
    });
  });

  return weeks
    .map((week) => week.map((iso) => {
      const tag = parseInt(iso.slice(8, 10), 10);
      const inMonth = parseInt(iso.slice(0, 4), 10) === m.jahr && parseInt(iso.slice(5, 7), 10) - 1 === m.monat;
      // Sonntage und Feiertage heben sich ab - sonst zählt man mit dem Finger nach,
      // ob ein Termin auf einen freien Tag fällt.
      const wt = new Date(iso + "T12:00:00").getDay();
      const feiertag = oneFeiertagName(iso);
      const frei = wt === 0 || !!feiertag;

      const dayEvents = events.filter((t) => iso >= t.datum && iso <= t.datum_bis);
      const byLane = [];
      let overflow = 0;
      dayEvents.forEach((t) => { if (t._lane < ONE_KAL_MAX_BALKEN) byLane[t._lane] = t; else overflow++; });

      const chips = byLane.length
        ? Array.from({ length: byLane.length }, (_, l) => {
            const t = byLane[l];
            // Leere Zeile dazwischen: unsichtbarer Platzhalter gleicher Höhe, damit
            // die Balken darunter Tag für Tag auf einer Linie bleiben.
            if (!t) return `<div class="glas-cal-chip glas-cal-chip-spacer">&nbsp;</div>`;
            const contLeft = t.datum < iso;
            const contRight = t.datum_bis > iso;
            const teil = texte.get(t._i + "|" + iso) || { text: "", span: 0 };
            // Der unsichtbare Platzhalter hält die Zeilenhöhe (der Balkentext liegt
            // absolut darüber und trägt selbst keine Höhe bei).
            const txt = `<span class="ccal-h">&nbsp;</span>` + (teil.text
              ? `<span class="ccal-txt" style="--span:${teil.span};">${escapeHtml(teil.text)}</span>`
              : "");
            return `<div class="glas-cal-chip${contLeft ? " continues-left" : ""}${contRight ? " continues-right" : ""}${teil.span > 1 ? " chip-mittext" : ""}${t.urlaub ? " is-urlaub" : ""}${t.done ? " is-done" : ""}" style="--c:${t.col};">${txt}</div>`;
          }).join("")
        : "";

      return `
        <div class="glas-cal-cell${iso === oneKalTagGewaehlt ? " is-selected" : ""}${inMonth ? "" : " out-month"}${frei ? " okal-frei" : ""}${feiertag ? " okal-feiertag" : ""}"
          data-iso="${iso}" onclick="oneKalTagWaehlen('${iso}')"${feiertag ? ` title="${escapeHtml(feiertag)}"` : ""}>
          <span class="glas-cal-daynum${iso === heute ? " is-today" : ""}">${tag}</span>
          ${chips}${overflow ? `<div class="glas-cal-more">+${overflow}</div>` : ""}
        </div>`;
    }).join(""))
    .join("");
}

function renderOneKalender() {
  if (oneKalTermine === null) {
    oneKalStarteLaden();
    return `<p class="muted" style="margin-top:20px;"><span class="spinner"></span> Lade deine Termine…</p>
      <p class="muted" style="margin-top:14px; font-size:12.5px;">Dauert es zu lange? <a href="#" onclick="event.preventDefault(); oneKalNeuLaden();" style="color:var(--blue);">Neu laden</a></p>`;
  }

  const m = oneKalMonatJetzt();
  const heute = oneKalHeute();
  const weeks = glasWeeksInRange({ year: m.jahr, month: m.monat }, { year: m.jahr, month: m.monat });
  const zellen = oneKalRasterZellen(weeks, heute);

  // Bewusst KEINE "Kommende Termine"-Liste mehr unter dem Kalender: was ansteht,
  // steht als Balken im Monat, und beim Antippen eines Tages zeigt das Tages-Blatt
  // alle Einzelheiten. Die doppelte Liste hat nur Platz gekostet - den bekommt
  // jetzt das Raster, damit die Tage nicht mehr gequetscht wirken.
  return `
    <div class="okal-kopf">
      <button class="btn btn-sm" onclick="oneKalBlaettern(-1)" aria-label="Vorheriger Monat">‹</button>
      <span style="flex:1; text-align:center; font-weight:700;">${oneKalMonatName(m.monat)} ${m.jahr}</span>
      <button class="btn btn-sm" onclick="oneKalNeuLaden()" aria-label="Aktualisieren" title="Aktualisieren">↻</button>
      <button class="btn btn-sm" onclick="oneKalBlaettern(1)" aria-label="Nächster Monat">›</button>
    </div>
    ${oneKalFehler ? `<p class="muted" style="margin:6px 2px; font-size:12.5px;">⚠️ ${escapeHtml(oneKalFehler)}</p>` : ""}
    <div class="okal-cal-card">
      <div class="glas-cal-grid okal-dow">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w, i) => `<div${i === 6 ? ` class="frei"` : ""}>${w}</div>`).join("")}</div>
      <div class="glas-cal-grid" id="okalRaster">${zellen}</div>
    </div>

    ${renderOneKalLegende()}

    ${oneUrlaubFormOffen ? "" : `<button class="btn btn-sm" style="margin-top:14px;" onclick="oneUrlaubFormOeffnen()">🏖️ Urlaub beantragen</button>`}
    ${renderOneUrlaubForm()}
    ${renderOneMeineAntraege()}`;
}

let oneKalTagGewaehlt = null;

/* ---------------- Lager-Plan ----------------
   Das Büro legt fest, wer wann morgens im Lager sein soll, und verschickt es.
   Hier steht nur, was DIESEN Mitarbeiter betrifft - direkt auf der Startseite,
   damit man abends nicht erst suchen muss, wann man morgen da sein soll. */

let oneLagerPlan = null;      // eigene Einträge (null = noch nicht geladen)
let oneLagerFehlt = false;    // Tabelle/Spalte fehlt noch (SQL nicht ausgeführt)
let oneLagerFehler = false;   // Laden fehlgeschlagen (kein Netz o.ä.) - nicht als "leer" ausgeben

function oneLagerIds(p) {
  try { return Array.isArray(p.mitarbeiter_ids) ? p.mitarbeiter_ids : JSON.parse(p.mitarbeiter_ids || "[]"); }
  catch (e) { return []; }
}

// Fragt den Zeitraum ab und filtert schon in der Datenbank auf die eigene ID.
// Kann die Umgebung den jsonb-Filter nicht (ältere PostgREST-Version), wird ohne
// ihn geholt und hier ausgesiebt - das Ergebnis ist in beiden Fällen dasselbe.
async function oneLagerAbfrage(vonIso, bisIso) {
  let spalten = "id, datum, uhrzeit, mitarbeiter_ids, notiz, bestaetigt, abwesend";
  const basis = () => sb.from("glas_lager_plan").select(spalten).gte("datum", vonIso).lte("datum", bisIso).order("datum", { ascending: true });
  const mitFilter = async () => { try { return await basis().filter("mitarbeiter_ids", "cs", JSON.stringify([oneUser.id])); } catch (e) { return { error: e }; } };
  let res = await mitFilter();
  // Neuere Spalten fehlen evtl. noch (SQL nicht erneut ausgefuehrt) -> stufenweise ohne sie
  if (res && res.error && /abwesend/i.test(res.error.message || "")) {
    spalten = "id, datum, uhrzeit, mitarbeiter_ids, notiz, bestaetigt";
    res = await mitFilter();
  }
  if (res && res.error && /bestaetigt/i.test(res.error.message || "")) {
    spalten = "id, datum, uhrzeit, mitarbeiter_ids, notiz";
    res = await mitFilter();
  }
  if (res && res.error) { try { res = await basis(); } catch (e) { res = { data: [], error: e }; } }
  // Fehlt die Tabelle noch, wird das gemerkt statt still verschluckt - sonst sieht
  // es aus, als wäre einfach nichts eingeteilt, und keiner weiß warum.
  if (res && res.error && /glas_lager_plan/i.test(res.error.message || "")) oneLagerFehlt = true;
  else if (res && res.error) oneLagerFehler = true; // Netz-/Serverfehler - kein leerer Plan
  return res && !res.error ? res : { data: [] };
}

async function oneLagerLaden() {
  if (!oneUser) { oneLagerPlan = []; return; }
  oneLagerFehler = false;
  const heute = oneKalHeute();
  // Rückblick von 60 Tagen (für den Verlauf) und ein Jahr nach vorne - der
  // Lager-Plan wird tageweise gemacht, mehr braucht es nicht.
  const res = await oneLagerAbfrage(glasAddDaysIso(heute, -60), glasAddDaysIso(heute, 365));
  oneLagerPlan = (res.data || []).filter((p) => oneLagerIds(p).includes(oneUser.id));
}

// Lädt einmalig nach und zeichnet danach neu. Von der Startseite UND von der
// Lager-Seite aus aufrufbar, ohne dass doppelt geladen wird.
function oneLagerStarteLaden() {
  if (oneLagerPlan !== null) return;
  oneLagerPlan = [];  // sperrt weitere Läufe
  oneLagerLaden()
    .catch(() => { oneLagerFehler = true; })
    .then(() => { if (oneScreen === "home" || oneScreen === "lager") renderOne(); });
}

// "Erneut versuchen" nach einem Netzfehler
function oneLagerNeuLaden() {
  oneLagerPlan = null;
  oneLagerStarteLaden();
  renderOne();
}

// Der nächste Termin ab heute - genau der gehört auf die Startseite.
function oneLagerNaechster() {
  const heute = oneKalHeute();
  return (oneLagerPlan || [])
    .filter((p) => p.datum >= heute && !oneLagerIstAbwesend(p))
    .sort((a, b) => (a.datum === b.datum ? (a.uhrzeit || "").localeCompare(b.uhrzeit || "") : a.datum.localeCompare(b.datum)))[0] || null;
}

const ONE_WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

// Wie viele Tage liegt iso von heute entfernt? (negativ = Vergangenheit)
function oneTageDifferenz(iso) {
  const a = new Date(oneKalHeute() + "T12:00:00");
  const b = new Date(iso + "T12:00:00");
  return Math.round((b - a) / 86400000);
}

// So, wie man es auch sagen würde: "Heute", "Morgen", "am Dienstag" - und erst
// wenn es weiter weg ist, ein Datum. Niemand rechnet gern ein Datum in einen
// Wochentag um, wenn es um übermorgen geht.
function oneLagerTagText(iso) {
  const d = oneTageDifferenz(iso);
  if (d === 0) return "Heute";
  if (d === 1) return "Morgen";
  if (d === 2) return "Übermorgen";
  const wt = ONE_WOCHENTAGE[new Date(iso + "T12:00:00").getDay()];
  if (d > 2 && d <= 7) return wt;                       // diese Woche: nur der Tag
  if (d > 7 && d <= 13) return "nächsten " + wt;        // nächste Woche
  if (d === -1) return "Gestern";
  if (d === -2) return "Vorgestern";
  if (d < -2 && d >= -7) return "letzten " + wt;
  return formatGlasDate(iso);                           // weiter weg: Datum
}

// Hat DIESER Mitarbeiter die Einteilung schon abgehakt?
function oneLagerIstBestaetigt(p) {
  return !!(p && p.bestaetigt && oneUser && p.bestaetigt[oneUser.id]);
}

// Hat das Büro vermerkt, dass DIESER Mitarbeiter nicht da war?
function oneLagerIstAbwesend(p) {
  return !!(p && p.abwesend && oneUser && p.abwesend[oneUser.id]);
}

let oneLagerBestBusy = false;

// Haken antippen: Bestätigung in die Zeile schreiben - das Büro sieht dann im
// Lager-Plan, dass gelesen wurde. Erst frisch lesen, dann zusammenführen, damit
// die Haken der Kollegen nicht überschrieben werden.
async function oneLagerBestaetigen(id, ev) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  if (oneLagerBestBusy || !oneUser) return;
  const p = (oneLagerPlan || []).find((x) => x.id === id);
  if (!p || oneLagerIstBestaetigt(p)) return;
  oneLagerBestBusy = true;
  // Sofort grün zeigen - das Speichern läuft im Hintergrund
  p.bestaetigt = Object.assign({}, p.bestaetigt, { [oneUser.id]: new Date().toISOString() });
  renderOne();
  try {
    const { data } = await sb.from("glas_lager_plan").select("bestaetigt").eq("id", id).maybeSingle();
    const zusammen = Object.assign({}, (data && data.bestaetigt) || {}, { [oneUser.id]: p.bestaetigt[oneUser.id] });
    const { error } = await sb.from("glas_lager_plan").update({ bestaetigt: zusammen }).eq("id", id);
    if (error) throw error;
    showToast("Bestätigt ✓");

    // Dem Büro Bescheid geben. Ob alle bestätigt haben oder erst ein Teil,
    // steht gleich mit drin - sonst müsste man dafür extra nachsehen.
    try {
      const eingeteilt = Array.isArray(p.mitarbeiter_ids) ? p.mitarbeiter_ids.length : 0;
      const bestaetigt = Object.keys(zusammen || {}).length;
      const wann = p.datum ? formatGlasDate(p.datum) : "";
      sb.functions.invoke("send-push", { body: {
        role: "glas",
        title: "📦 Lager bestätigt",
        body: `${oneUser.name || oneUser.username} hat die Einteilung${wann ? " für " + wann : ""} bestätigt`
          + (eingeteilt ? ` (${bestaetigt} von ${eingeteilt})` : ""),
        url: "/glas-admin.html?app=lager",
      } }).catch(() => {});
    } catch (e) { /* Meldung ist Beiwerk - das Bestätigen selbst hat geklappt */ }
  } catch (e) {
    if (/bestaetigt/i.test((e && e.message) || "")) showToast("Bitte supabase_add_lager.sql erneut ausführen");
    else showToast("Keine Verbindung – bitte später erneut abhaken");
    delete p.bestaetigt[oneUser.id];
    renderOne();
  } finally {
    oneLagerBestBusy = false;
  }
}

function renderOneLagerHinweis() {
  if (!oneUser || oneUser.zugang_lager !== true) return "";
  const p = oneLagerNaechster();
  if (!p) return "";
  const ok = oneLagerIstBestaetigt(p);
  // Rot = noch nicht abgehakt (Handlung nötig), Grün = bestätigt. Die Karte bleibt
  // auch nach dem Abhaken stehen - man soll ja weiter sehen, wann man da sein muss.
  return `
    <div class="one-lager-karte ${ok ? "gruen" : "rot"}" onclick="oneScreen='lager'; renderOne();">
      <span class="l-ico">📦</span>
      <span class="l-text">
        <b>${escapeHtml(oneLagerTagText(p.datum))} um ${escapeHtml(p.uhrzeit || "?")} Uhr im Lager</b>
        <span>${ok
          ? "✓ Bestätigt" + (p.notiz ? " · " + escapeHtml(p.notiz) : " – das Büro weiß Bescheid.")
          : p.notiz ? escapeHtml(p.notiz) : "Das Büro hat dich eingeteilt."}</span>
      </span>
      ${ok
        ? `<span class="l-check ok">✓</span>`
        : `<button class="l-check" onclick="oneLagerBestaetigen('${p.id}', event)" title="Gelesen – bin da!">✓</button>`}
    </div>`;
}

// Untertitel der Kachel: sagt schon von außen, ob überhaupt etwas ansteht.
function oneLagerKachelSub() {
  if (oneLagerPlan === null || oneLagerFehler) return "Wann du im Lager sein sollst";
  const p = oneLagerNaechster();
  return p ? `${oneLagerTagText(p.datum)} um ${p.uhrzeit || "?"} Uhr` : "Nichts eingeteilt";
}

// Eigene Seite: was ansteht und was schon war. Beides nur für einen selbst.
function renderOneLager() {
  oneLagerStarteLaden();
  const heute = oneKalHeute();
  const alle = (oneLagerPlan || []).slice()
    .sort((a, b) => (a.datum === b.datum ? (a.uhrzeit || "").localeCompare(b.uhrzeit || "") : a.datum.localeCompare(b.datum)));
  const kommend = alle.filter((p) => p.datum >= heute);
  const vergangen = alle.filter((p) => p.datum < heute).reverse();

  const zeile = (p, alt) => {
    const abw = oneLagerIstAbwesend(p);
    const ok = oneLagerIstBestaetigt(p);
    // Farbe = Status, nicht Dekoration: ROT solange nicht bestätigt (da muss noch
    // was passieren), GRÜN sobald abgehakt, grau für Vergangenes.
    const farbe = alt ? "" : abw ? " abw" : ok ? " gruen" : " rot";
    return `
    <div class="one-lager-zeile${alt ? " alt" : ""}${farbe}">
      <span class="lz-zeit">${escapeHtml(p.uhrzeit || "?")}</span>
      <span class="lz-txt">
        <b>${escapeHtml(oneLagerTagText(p.datum))}</b>
        <span>${abw
          ? `<b style="color:#b23a1e;">✗ Als „nicht da" vermerkt</b>`
          : !alt && !ok
            ? `<b style="color:#c2452a;">Noch nicht bestätigt</b>${p.notiz ? " · " + escapeHtml(p.notiz) : ""}`
            : p.notiz ? escapeHtml(p.notiz) : "Im Lager sein"}</span>
      </span>
      ${alt || abw ? "" : oneLagerIstBestaetigt(p)
        ? `<span class="l-check ok" style="flex:none;">✓</span>`
        : `<button class="l-check" style="flex:none;" onclick="oneLagerBestaetigen('${p.id}', event)" title="Gelesen – bin da!">✓</button>`}
    </div>`;
  };

  if (oneLagerFehlt) {
    return `<div class="card" style="margin-top:10px;">
      <p style="margin:0; font-size:14px;">📦 Der Lager-Plan ist noch nicht eingerichtet.</p>
      <p class="muted" style="margin:6px 0 0; font-size:12.5px;">Bitte im Büro Bescheid geben.</p>
    </div>`;
  }
  if (oneLagerFehler) {
    return `<div class="card" style="margin-top:10px;">
      <p style="margin:0; font-size:14px;">Keine Verbindung – dein Lager-Plan konnte nicht geladen werden.</p>
      <button class="btn btn-primary" style="margin-top:12px;" onclick="oneLagerNeuLaden()">↻ Erneut versuchen</button>
    </div>`;
  }

  return `
    <p class="one-label" style="margin-top:6px;">DEMNÄCHST</p>
    ${kommend.length
      ? kommend.map((p) => zeile(p, false)).join("")
      : `<div class="card" style="margin-top:10px;">
          <p style="margin:0; font-size:14px;">Für dich ist gerade nichts eingeteilt.</p>
          <p class="muted" style="margin:6px 0 0; font-size:12.5px;">Sobald das Büro dich einteilt, steht es hier – und du bekommst eine Benachrichtigung aufs Handy.</p>
        </div>`}
    ${vergangen.length ? `<p class="one-label">WAR SCHON</p>${vergangen.map((p) => zeile(p, true)).join("")}` : ""}`;
}

/* ---------------- Urlaub beantragen ---------------- */

let oneUrlaubFormOffen = false;
let oneMeineAntraege = null; // eigene Anträge inkl. offener/abgelehnter (null = ungeladen)
let oneUrlaubBusy = false;

function oneUrlaubFormOeffnen() {
  oneUrlaubFormOffen = !oneUrlaubFormOffen;
  renderOne();
}

function oneUrlaubFormZu() {
  oneUrlaubFormOffen = false;
  renderOne();
}

// Eigenes, festes Layout statt der allgemeinen .field-Bausteine: die Datumsfelder
// sind auf dem iPhone der Knackpunkt (Safari zentriert den Wert und ignoriert die
// Feldbreite), deshalb bekommen sie hier eine klare eigene Form.
function renderOneUrlaubForm() {
  if (!oneUrlaubFormOffen) return "";
  const heute = oneKalHeute();
  const vor = oneKalTagGewaehlt && oneKalTagGewaehlt >= heute ? oneKalTagGewaehlt : "";
  return `
    <div class="card one-urlform">
      <div class="uf-kopf">
        <b>🏖️ Urlaub beantragen</b>
        <button class="uf-zu" onclick="oneUrlaubFormZu()" aria-label="Schließen" title="Schließen">✕</button>
      </div>
      <div id="url_err"></div>
      <div class="uf-zeile">
        <label class="uf-feld"><span>Von</span>
          <input type="date" id="url_von" min="${heute}" value="${vor}" /></label>
        <label class="uf-feld"><span>Bis</span>
          <input type="date" id="url_bis" min="${heute}" value="${vor}" /></label>
      </div>
      <label class="uf-feld"><span>Notiz ans Büro (optional)</span>
        <input type="text" id="url_notiz" placeholder="z.B. Familienbesuch" /></label>
      <div class="uf-aktionen">
        <button class="btn btn-sm" onclick="oneUrlaubFormZu()">Abbrechen</button>
        <button class="btn btn-primary btn-sm" onclick="oneUrlaubSenden()" ${oneUrlaubBusy ? "disabled" : ""}>
          ${oneUrlaubBusy ? "Sende…" : "Antrag senden"}</button>
      </div>
      <p class="uf-hinweis">Das Büro sieht deinen Antrag sofort und gibt ihn frei oder lehnt ab. Du siehst den Stand hier.</p>
    </div>`;
}

// Im Kalender stehen nur die Anträge, die noch WARTEN. Entscheidungen (genehmigt/
// abgelehnt) meldet die Startseite einmalig mit "Verstanden"-Knopf; danach stehen
// sie in der Historie unter "Meine Urlaubsanträge". So klebt nichts monatelang.
function renderOneMeineAntraege() {
  const liste = (oneMeineAntraege || []).filter((u) => (u.status || "genehmigt") === "offen");
  if (!liste.length) return "";
  return `
    <p class="one-label">DEINE ANTRÄGE</p>
    ${liste.map((u) => {
      const offen = (u.status || "") === "offen";
      const zeit = u.bis && u.bis !== u.von ? `${formatGlasDate(u.von)} – ${formatGlasDate(u.bis)}` : formatGlasDate(u.von);
      return `<div class="okal-eintrag" style="cursor:default;">
        <span class="okal-strich" style="background:${offen ? "#b5730b" : "#b23a1e"}"></span>
        <span style="flex:1; min-width:0;">
          <b>${offen ? "⏳ Wartet auf Freigabe" : "❌ Abgelehnt"}</b>
          <span>${escapeHtml(zeit)}${u.notiz ? " · " + escapeHtml(u.notiz) : ""}</span>
          ${u.antwort ? `<span>Büro: ${escapeHtml(u.antwort)}</span>` : ""}
        </span>
        ${offen ? `<button class="btn btn-sm" style="align-self:center;" onclick="oneUrlaubZuruecknehmen('${u.id}')">Zurückziehen</button>` : ""}
      </div>`;
    }).join("")}`;
}

async function oneUrlaubSenden() {
  const von = document.getElementById("url_von")?.value || "";
  const bis = document.getElementById("url_bis")?.value || von;
  const notiz = (document.getElementById("url_notiz")?.value || "").trim();
  const fehler = (m) => { const el = document.getElementById("url_err"); if (el) el.innerHTML = `<div class="glas-login-err">${escapeHtml(m)}</div>`; };
  if (!von) { fehler("Bitte ein Von-Datum wählen."); return; }
  if (bis && bis < von) { fehler("Das Bis-Datum liegt vor dem Von-Datum."); return; }
  if (von < oneKalHeute()) { fehler("Urlaub kann nur ab heute beantragt werden."); return; }

  oneUrlaubBusy = true; renderOne();
  try {
    const zeile = {
      id: (typeof genCode === "function" ? genCode() : String(Date.now())),
      mitarbeiter_id: oneUser.id, von, bis: bis || von, notiz,
      status: "offen", beantragt_am: new Date().toISOString(),
    };
    let { error } = await sb.from("glas_urlaub").insert(zeile);
    if (error && /(status|beantragt_am)/i.test(error.message || "")) {
      showToast("Bitte supabase_add_urlaub_antrag.sql in Supabase ausführen – ohne sie kann das Büro Anträge nicht freigeben.");
      oneUrlaubBusy = false; renderOne(); return;
    }
    if (error) throw error;
    oneUrlaubFormOffen = false;
    oneKalTermine = null; oneMeineAntraege = null; // neu laden
    // Das Büro sofort benachrichtigen (Glas-Admin-App) - aber nur, wenn der Schalter
    // "Neue Urlaubsanträge" dort an ist. Läuft im Hintergrund: schlägt es fehl, ist der
    // Antrag trotzdem gestellt und steht im Admin in der Liste.
    try {
      const an = true;  // Urlaubsantraege werden immer gemeldet (Haken entfallen)
      if (an) {
        const zeit = zeile.bis && zeile.bis !== zeile.von
          ? `${formatGlasDate(zeile.von)} – ${formatGlasDate(zeile.bis)}` : formatGlasDate(zeile.von);
        sb.functions.invoke("send-push", { body: {
          role: "glas",
          title: "🏖️ Neuer Urlaubsantrag",
          body: `${oneUser.name || oneUser.username}: ${zeit}${notiz ? " · " + notiz : ""}`,
          url: "/glas-admin.html#/tab/kalender",
        } }).catch(() => {});
      }
    } catch (e) {}
    showToast("Antrag gesendet – das Büro entscheidet zeitnah ✓");
  } catch (e) {
    fehler("Konnte nicht gesendet werden. Bitte Internet prüfen.");
  } finally {
    oneUrlaubBusy = false;
    renderOne();
  }
}

async function oneUrlaubZuruecknehmen(id) {
  try {
    const { error } = await sb.from("glas_urlaub").delete().eq("id", id).eq("mitarbeiter_id", oneUser.id);
    if (error) throw error;
    oneKalTermine = null; oneMeineAntraege = null;
    showToast("Antrag zurückgezogen");
    renderOne();
  } catch (e) { showToast("Konnte nicht zurückgezogen werden"); }
}

/* ---------------- Alle Urlaubsanträge (Menüpunkt, mit Vergangenheit) ---------------- */

function renderOneUrlaubHistorie() {
  if (oneMeineAntraege === null) {
    oneLadeMeineAntraege().then(() => { if (oneScreen === "urlaub") renderOne(); });
    return `<p class="muted" style="margin-top:20px;"><span class="spinner"></span> Lade deine Anträge…</p>`;
  }
  const heute = oneKalHeute();
  // Neueste zuerst
  const alle = (oneMeineAntraege || []).slice().sort((a, b) => (b.von || "").localeCompare(a.von || ""));
  if (!alle.length) {
    return `<p class="muted" style="margin:18px 2px;">Du hast noch keinen Urlaub beantragt.</p>
      <button class="btn btn-primary btn-sm" onclick="oneScreen='kalender'; oneUrlaubFormOffen=true; renderOne();">🏖️ Jetzt Urlaub beantragen</button>`;
  }
  const laufend = alle.filter((u) => (u.bis || u.von) >= heute);
  const vorbei = alle.filter((u) => (u.bis || u.von) < heute);
  const block = (titel, liste) => liste.length ? `
    <p class="one-label">${titel}</p>
    ${liste.map(oneAntragZeile).join("")}` : "";
  return `
    ${block("AKTUELL & GEPLANT", laufend)}
    ${block("VERGANGENE ANTRÄGE", vorbei)}
    <button class="btn btn-sm" style="margin-top:14px;" onclick="oneScreen='kalender'; oneUrlaubFormOffen=true; renderOne();">🏖️ Neuen Urlaub beantragen</button>`;
}

function oneAntragZeile(u) {
  const st = u.status || "genehmigt";
  const farbe = st === "offen" ? "#b5730b" : st === "abgelehnt" ? "#b23a1e" : ONE_KAL_FARBEN.urlaub;
  const label = st === "offen" ? "⏳ Wartet auf Freigabe" : st === "abgelehnt" ? "❌ Abgelehnt" : "✓ Genehmigt";
  const zeit = u.bis && u.bis !== u.von ? `${formatGlasDate(u.von)} – ${formatGlasDate(u.bis)}` : formatGlasDate(u.von);
  const vergangen = (u.bis || u.von) < oneKalHeute();
  return `<div class="okal-eintrag" style="cursor:default;${vergangen ? "opacity:.72;" : ""}">
    <span class="okal-strich" style="background:${farbe}"></span>
    <span style="flex:1; min-width:0;">
      <b>${label}</b>
      <span>${escapeHtml(zeit)}${u.notiz ? " · " + escapeHtml(u.notiz) : ""}</span>
      ${u.antwort ? `<span>Büro: ${escapeHtml(u.antwort)}</span>` : ""}
    </span>
    ${st === "offen" ? `<button class="btn btn-sm" style="align-self:center;" onclick="oneUrlaubZuruecknehmen('${u.id}')">Zurückziehen</button>` : ""}
  </div>`;
}

// Eigene Anträge laden (nur die eigenen - Datenschutz wie beim Urlaub selbst)
async function oneLadeMeineAntraege() {
  try {
    // Mit gesehen_am; fehlt die Spalte noch, ohne sie laden.
    let res = await sb.from("glas_urlaub")
      .select("id, von, bis, notiz, status, antwort, gesehen_am, beantragt_am").eq("mitarbeiter_id", oneUser.id);
    if (res.error && /(gesehen_am|beantragt_am)/i.test(res.error.message || "")) {
      res = await sb.from("glas_urlaub").select("id, von, bis, notiz, status, antwort").eq("mitarbeiter_id", oneUser.id);
    }
    oneMeineAntraege = res.error ? [] : (res.data || []);
  } catch (e) { oneMeineAntraege = []; }
}

/* ---------------- Entscheidung des Büros: Hinweis auf der Startseite ----------------
   Sobald das Büro entschieden hat (genehmigt ODER abgelehnt), steht das Ergebnis
   auf der GEKO-One-Startseite - bis der Mitarbeiter es bestätigt. Danach ist es
   nur noch in seiner Antrags-Historie zu finden. */

// Entschiedene, noch nicht bestätigte Anträge. Wichtig: NUR solche, die auch
// wirklich beantragt wurden (beantragt_am gesetzt) - vom Büro direkt eingetragener
// Urlaub ist keine "Entscheidung" und braucht keine Bestätigung.
function oneNeueEntscheidungen() {
  return (oneMeineAntraege || []).filter((u) => {
    const st = u.status || "genehmigt";
    if (st !== "genehmigt" && st !== "abgelehnt") return false;
    if (u.gesehen_am) return false;
    return !!u.beantragt_am;
  });
}

function renderOneEntscheidungen() {
  const liste = oneNeueEntscheidungen();
  if (!liste.length) return "";
  return liste.map((u) => {
    const ok = (u.status || "") === "genehmigt";
    const zeit = u.bis && u.bis !== u.von ? `${formatGlasDate(u.von)} – ${formatGlasDate(u.bis)}` : formatGlasDate(u.von);
    return `
      <div class="one-info ${ok ? "gut" : "schlecht"}">
        <span class="oi-ic">${ok ? "🎉" : "😕"}</span>
        <span class="oi-txt">
          <b>${ok ? "Dein Urlaub wurde genehmigt" : "Dein Urlaubsantrag wurde abgelehnt"}</b>
          <span>${escapeHtml(zeit)}${u.notiz ? " · " + escapeHtml(u.notiz) : ""}</span>
          ${u.antwort ? `<span>Büro: ${escapeHtml(u.antwort)}</span>` : ""}
        </span>
        <button class="oi-btn" onclick="oneEntscheidungBestaetigen('${u.id}')">Verstanden</button>
      </div>`;
  }).join("");
}

async function oneEntscheidungBestaetigen(id) {
  // Sofort ausblenden - das Speichern läuft im Hintergrund. Klappt es nicht (kein
  // Netz), steht der Hinweis beim nächsten Öffnen wieder da; nichts geht verloren.
  const u = (oneMeineAntraege || []).find((x) => x.id === id);
  if (u) u.gesehen_am = new Date().toISOString();
  renderOne();
  try {
    const { error } = await sb.from("glas_urlaub")
      .update({ gesehen_am: new Date().toISOString() }).eq("id", id).eq("mitarbeiter_id", oneUser.id);
    if (error && /gesehen_am/i.test(error.message || "")) {
      showToast("Bitte supabase_add_urlaub_antrag.sql ausführen – der Hinweis kommt sonst wieder.");
    }
  } catch (e) {}
}

/* ---------------- Tages-Sheet ----------------
   Ein Tag wird nicht mehr weiter unten auf der Seite aufgeklappt, sondern kommt
   als Blatt von unten hoch - so wie man es von Handy-Kalendern kennt. Man bleibt
   dabei mit dem Blick am angetippten Tag und muss nicht erst runterscrollen.
   Es hängt bewusst am <body>: als Teil von #view würde es beim nächsten
   renderOne() mitten in der Animation verschwinden. */

let oneKalSheetIso = null;

const ONE_MONATE_LANG = ["Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"];

// "Montag, 17. August" - im Sheet steht der Tag ausgeschrieben, dort ist Platz.
function oneKalDatumLang(iso) {
  const d = new Date(iso + "T12:00:00");
  return `${ONE_WOCHENTAGE[d.getDay()]}, ${d.getDate()}. ${ONE_MONATE_LANG[d.getMonth()]}`;
}

function oneKalTagWaehlen(iso) {
  if (oneKalSheetIso === iso) { oneKalSheetZu(); return; }
  oneKalTagGewaehlt = iso;
  oneKalSheetOeffnen(iso);
  // Nur die Markierung im Raster nachziehen - ein volles renderOne() würde den
  // Inhalt unter dem Sheet neu aufbauen und flackern.
  document.querySelectorAll("#okalRaster .glas-cal-cell.is-selected").forEach((c) => c.classList.remove("is-selected"));
  const zelle = document.querySelector(`#okalRaster .glas-cal-cell[data-iso="${iso}"]`);
  if (zelle) zelle.classList.add("is-selected");
}

function oneKalSheetOeffnen(iso) {
  oneKalSheetZu(false);
  oneKalSheetIso = iso;
  const eintraege = oneKalAmTag(iso);
  const feiertag = oneFeiertagName(iso);
  const el = document.createElement("div");
  el.id = "oneKalSheet";
  el.className = "okal-sheet-ov";
  el.onclick = (e) => { if (e.target === el) oneKalSheetZu(); };
  el.innerHTML = `
    <div class="okal-sheet" role="dialog" aria-modal="true">
      <div class="okal-sheet-grip"></div>
      <div class="okal-sheet-kopf">
        <span class="ks-txt">
          <b>${escapeHtml(oneKalDatumLang(iso))}</b>
          <span>${feiertag ? "🎉 " + escapeHtml(feiertag)
            : eintraege.length === 0 ? "Nichts eingetragen"
            : eintraege.length === 1 ? "1 Termin" : eintraege.length + " Termine"}</span>
        </span>
        <button class="okal-sheet-zu" onclick="oneKalSheetZu()" aria-label="Schließen">✕</button>
      </div>
      <div class="okal-sheet-inhalt">
        ${oneKalListe(eintraege, false)}
        <button class="btn btn-sm" style="margin-top:6px;" onclick="oneKalUrlaubAbTag('${iso}')">🏖️ Urlaub ab diesem Tag beantragen</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  if (typeof window.gekoI18nApply === "function") window.gekoI18nApply(); // ggf. albanisch
  requestAnimationFrame(() => el.classList.add("auf"));
  oneKalSheetWischen(el);
  // Zurück-Taste des Handys schließt erst das Blatt, statt die Seite zu verlassen
  try { history.pushState({ oneKalSheet: 1 }, ""); } catch (e) {}
  window.addEventListener("popstate", oneKalSheetPop);
}

function oneKalSheetPop() { oneKalSheetZu(true); }

function oneKalSheetZu(vonPopstate) {
  const el = document.getElementById("oneKalSheet");
  window.removeEventListener("popstate", oneKalSheetPop);
  oneKalSheetIso = null;
  if (!el) return;
  el.classList.remove("auf");
  setTimeout(() => el.remove(), 220);
  if (vonPopstate !== false && !vonPopstate) {
    try { if (history.state && history.state.oneKalSheet) history.back(); } catch (e) {}
  }
}

// Nach unten wischen schließt das Blatt - dieselbe Geste wie in nativen Apps.
// Bewusst mit Richtungssperre und nur, wenn der Inhalt schon ganz oben steht,
// damit ein normaler Scroll in der Terminliste nicht versehentlich schließt.
function oneKalSheetWischen(ov) {
  const blatt = ov.querySelector(".okal-sheet");
  const inhalt = ov.querySelector(".okal-sheet-inhalt");
  if (!blatt) return;
  let y0 = null, x0 = null, richtung = null, dy = 0;
  blatt.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1 || (inhalt && inhalt.scrollTop > 2)) { y0 = null; return; }
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; richtung = null; dy = 0;
  }, { passive: true });
  blatt.addEventListener("touchmove", (e) => {
    if (y0 === null) return;
    const d = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
    if (!richtung) {
      if (Math.abs(d) < 8 && Math.abs(dx) < 8) return;
      richtung = d > 0 && d > Math.abs(dx) * 1.4 ? "zu" : "aus";
      if (richtung === "aus") { y0 = null; return; }
    }
    dy = Math.max(0, d);
    blatt.style.transition = "none";
    blatt.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  blatt.addEventListener("touchend", () => {
    if (y0 === null) return;
    blatt.style.transition = "";
    blatt.style.transform = "";
    if (dy > 90) oneKalSheetZu();
    y0 = null; richtung = null;
  }, { passive: true });
}

// Aus dem Tages-Blatt heraus Urlaub beantragen - mit diesem Tag vorbelegt.
function oneKalUrlaubAbTag(iso) {
  oneKalTagGewaehlt = iso;
  oneUrlaubFormOffen = true;
  oneKalSheetZu();
  renderOne();
  setTimeout(() => {
    const el = document.getElementById("url_von");
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 120);
}

// Wochentage eines wiederkehrenden Rundgangs kurz benennen ("Mo–Fr" bzw. "Mo, Mi, Fr")
function oneKalTageText(tage) {
  const namen = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const l = (tage || []).slice().sort((a, b) => a - b);
  if (!l.length) return "";
  const luecken = l.every((t, i) => i === 0 || t === l[i - 1] + 1);
  return luecken && l.length > 2 ? `${namen[l[0] - 1]}–${namen[l[l.length - 1] - 1]}` : l.map((t) => namen[t - 1]).join(", ");
}

function oneKalListe(eintraege, zusammengefasst) {
  if (!eintraege.length) return `<p class="muted" style="margin:10px 2px;">Keine Termine.</p>`;
  return eintraege.map((e) => {
    // Nur ARCHIVIERTE Touren lassen sich nicht mehr öffnen - dann kommt ein kurzer
    // Hinweis statt einer Navigation ins Leere. Alles andere (auch vergangene, aber
    // noch nicht archivierte Touren) bleibt normal anklickbar und springt direkt in
    // die jeweilige Tour bzw. den Schein.
    const ziel = e.abgelaufen ? null : e.ziel;
    const mehrtaegig = e.bis && e.bis !== e.von;
    // Zusammengefasste Rundgänge zeigen den Rhythmus statt eines einzelnen Datums
    // Nahe Termine als Wochentag ("Donnerstag"), erst weiter entfernte als Datum -
    // niemand rechnet gern ein Datum in einen Wochentag um.
    const datum = (zusammengefasst && e.art === "checkin" && e.tage)
      ? `${oneKalTageText(e.tage)} · immer wieder`
      : mehrtaegig ? `${oneLagerTagText(e.von)} – ${oneLagerTagText(e.bis)}` : oneLagerTagText(e.von);
    const inner = `
      <span class="okal-strich" style="background:${oneKalBalkenFarbe(e)}"></span>
      <span style="flex:1; min-width:0;">
        <b${e.fertig ? ` class="okal-fertig"` : ""}>${e.ico} ${escapeHtml(e.titel)}</b>
        <span>${escapeHtml(e.sub)}${e.zeit ? " · " + escapeHtml(e.zeit) + " Uhr" : ""}</span>
        <span style="font-weight:600; color:var(--text-secondary);">${datum}</span>
      </span>
      ${ziel ? `<span class="m-pfeil">›</span>` : e.abgelaufen ? `<span class="okal-schloss">🔒</span>` : ""}`;
    if (ziel) return `<a class="okal-eintrag" href="${ziel}">${inner}</a>`;
    if (e.abgelaufen) return `<button class="okal-eintrag" style="opacity:.72;" onclick="oneKalAbgelaufen()">${inner}</button>`;
    return `<div class="okal-eintrag" style="cursor:default;">${inner}</div>`;
  }).join("");
}

// Kurzer Hinweis beim Antippen einer archivierten Tour - statt einer Navigation,
// die nur in einer leeren Liste enden würde.
function oneKalAbgelaufen() {
  showToast("🔒 Diese Tour ist abgeschlossen und kann nicht mehr geöffnet werden.");
}
