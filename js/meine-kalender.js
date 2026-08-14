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

const ONE_KAL_FARBEN = {
  glas: "#1f5d92",
  graffiti: "#a52d82",
  checkin: "#cf6a12",
  urlaub: "#1f7a4d",
};

let oneKalTermine = null;   // geladene Termine (Array) oder null = noch nicht geladen
let oneKalMonat = null;     // {jahr, monat} - angezeigter Monat, null = aktueller
let oneKalFehler = "";

function oneKalHeute() { return glasIsoFromDate(new Date()); }

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
      const { data } = await oneKalMitTimeout(sb.from("glas_touren").select("id, name, datum, datum_bis, archiviert_am, ma_versteckt").order("datum", { ascending: true }));
      (data || []).forEach((t) => {
        if (!t.datum || t.archiviert_am || t.ma_versteckt) return;
        eintraege.push({
          art: "glas", ico: "🧽", titel: t.name || "Tour",
          von: t.datum, bis: t.datum_bis || t.datum,
          sub: "Glas-Tour", ziel: "glas-mitarbeiter.html",
        });
      });
    })());
  }

  // --- Graffiti-Termine --------------------------------------------------------
  if (oneUser.zugang_graffiti === true) {
    aufgaben.push((async () => {
      const { data } = await oneKalMitTimeout(sb.from("scheine").select("id, kunde, adresse, termin, archiviert, datum").order("termin", { ascending: true }));
      (data || []).forEach((s) => {
        if (!s.termin || s.archiviert) return;
        const iso = String(s.termin).slice(0, 10);
        const zeit = glasUhrzeitVonTimestamp(s.termin);
        eintraege.push({
          art: "graffiti", ico: "🎨", titel: s.kunde || "Graffiti-Termin",
          von: iso, bis: iso, zeit,
          sub: (s.adresse || "").split("\n")[0] || "Graffiti",
          ziel: "mitarbeiter.html",
        });
      });
    })());
  }

  // --- Rundgänge (Check-ins) ---------------------------------------------------
  // Wiederkehrende Rundgänge an festen Wochentagen: für den angezeigten Monat
  // aufgelöst. Nur die, die diesem Mitarbeiter zugewiesen sind (oder allen).
  if (oneUser.zugang_checkin === true) {
    aufgaben.push((async () => {
      const { data } = await oneKalMitTimeout(sb.from("checkin_rundgaenge").select("id, name, mitarbeiter_id, mitarbeiter_ids, tage, fenster_von, fenster_bis, aktiv"));
      const m = oneKalMonatJetzt();
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
          eintraege.push({
            art: "checkin", ico: "📍", titel: r.name || "Rundgang",
            von: iso, bis: iso, zeit: r.fenster_von || "",
            sub: `Rundgang · ${r.fenster_von || "?"}–${r.fenster_bis || "?"}`,
            ziel: "checkins-ma.html", tage,
          });
        }
      });
    })());
  }

  // --- Eigener Urlaub (NUR der eigene - Datenschutz) ----------------------------
  aufgaben.push((async () => {
    const { data } = await oneKalMitTimeout(sb.from("glas_urlaub").select("id, von, bis, notiz, mitarbeiter_id").eq("mitarbeiter_id", ich));
    (data || []).forEach((u) => {
      if (!u.von) return;
      eintraege.push({
        art: "urlaub", ico: "🏖️", titel: "Urlaub",
        von: u.von, bis: u.bis || u.von,
        sub: u.notiz || "Dein Urlaub", ziel: null,
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

function oneKalMonatName(m) {
  return ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"][m];
}

function renderOneKalender() {
  if (oneKalTermine === null) {
    oneKalStarteLaden();
    return `<p class="muted" style="margin-top:20px;"><span class="spinner"></span> Lade deine Termine…</p>
      <p class="muted" style="margin-top:14px; font-size:12.5px;">Dauert es zu lange? <a href="#" onclick="event.preventDefault(); oneKalNeuLaden();" style="color:var(--blue);">Neu laden</a></p>`;
  }

  const m = oneKalMonatJetzt();
  const heute = oneKalHeute();
  const ersterTag = new Date(m.jahr, m.monat, 1);
  const letzterTag = new Date(m.jahr, m.monat + 1, 0).getDate();
  const startLuecke = (ersterTag.getDay() + 6) % 7; // Montag = 0

  // Monatsraster
  let zellen = "";
  for (let i = 0; i < startLuecke; i++) zellen += `<div class="okal-tag leer"></div>`;
  for (let tag = 1; tag <= letzterTag; tag++) {
    const iso = glasIsoFromDate(new Date(m.jahr, m.monat, tag));
    const eintraege = oneKalAmTag(iso);
    const arten = [...new Set(eintraege.map((e) => e.art))];
    zellen += `
      <button class="okal-tag${iso === heute ? " heute" : ""}${eintraege.length ? " hat" : ""}" onclick="oneKalTagWaehlen('${iso}')">
        <span class="okal-num">${tag}</span>
        <span class="okal-punkte">${arten.slice(0, 4).map((a) => `<i style="background:${ONE_KAL_FARBEN[a]}"></i>`).join("")}</span>
      </button>`;
  }

  // Kommende Termine (ab heute). Wiederkehrende Rundgänge werden dabei zusammengefasst:
  // Sonst stünde derselbe Rundgang 20x untereinander und würde Touren, Graffiti-Termine
  // und Urlaub verdrängen. Im Monatsraster bleiben trotzdem ALLE Tage markiert, und beim
  // Antippen eines Tages sieht man weiterhin alles, was an dem Tag ansteht.
  const gesehen = new Set();
  const kommend = (oneKalTermine || [])
    .filter((e) => (e.bis || e.von) >= heute)
    .filter((e) => {
      if (e.art !== "checkin") return true;
      if (gesehen.has(e.titel)) return false;
      gesehen.add(e.titel);
      return true;
    })
    .slice(0, 12);

  return `
    <div class="okal-kopf">
      <button class="btn btn-sm" onclick="oneKalBlaettern(-1)" aria-label="Vorheriger Monat">‹</button>
      <span style="flex:1; text-align:center; font-weight:700;">${oneKalMonatName(m.monat)} ${m.jahr}</span>
      <button class="btn btn-sm" onclick="oneKalNeuLaden()" aria-label="Aktualisieren" title="Aktualisieren">↻</button>
      <button class="btn btn-sm" onclick="oneKalBlaettern(1)" aria-label="Nächster Monat">›</button>
    </div>
    ${oneKalFehler ? `<p class="muted" style="margin:6px 2px; font-size:12.5px;">⚠️ ${escapeHtml(oneKalFehler)}</p>` : ""}
    <div class="okal-wochentage">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => `<span>${w}</span>`).join("")}</div>
    <div class="okal-raster">${zellen}</div>

    <div class="okal-legende">
      ${oneUser.zugang_glas !== false ? `<span><i style="background:${ONE_KAL_FARBEN.glas}"></i>Glas-Touren</span>` : ""}
      ${oneUser.zugang_graffiti === true ? `<span><i style="background:${ONE_KAL_FARBEN.graffiti}"></i>Graffiti</span>` : ""}
      ${oneUser.zugang_checkin === true ? `<span><i style="background:${ONE_KAL_FARBEN.checkin}"></i>Rundgänge</span>` : ""}
      <span><i style="background:${ONE_KAL_FARBEN.urlaub}"></i>Dein Urlaub</span>
    </div>

    <p class="one-label">${oneKalTagGewaehlt ? "AM " + formatGlasDate(oneKalTagGewaehlt) : "KOMMENDE TERMINE"}</p>
    ${oneKalListe(oneKalTagGewaehlt ? oneKalAmTag(oneKalTagGewaehlt) : kommend, !oneKalTagGewaehlt)}
    ${oneKalTagGewaehlt ? `<button class="btn btn-sm" style="margin-top:10px;" onclick="oneKalTagGewaehlt=null; renderOne();">Alle kommenden zeigen</button>` : ""}`;
}

let oneKalTagGewaehlt = null;

function oneKalTagWaehlen(iso) {
  oneKalTagGewaehlt = oneKalTagGewaehlt === iso ? null : iso;
  renderOne();
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
  const heute = oneKalHeute();
  return eintraege.map((e) => {
    // Vergangenes ist nur noch Verlauf - nicht mehr anklickbar (die Tour/der Schein
    // kann längst archiviert sein; ein Klick würde ins Leere führen). Wiederkehrende
    // Rundgänge bleiben immer anklickbar (die gibt es weiter).
    const vergangen = (e.bis || e.von) < heute && e.art !== "checkin";
    const ziel = vergangen ? null : e.ziel;
    const mehrtaegig = e.bis && e.bis !== e.von;
    // Zusammengefasste Rundgänge zeigen den Rhythmus statt eines einzelnen Datums
    const datum = (zusammengefasst && e.art === "checkin" && e.tage)
      ? `${oneKalTageText(e.tage)} · immer wieder`
      : mehrtaegig ? `${formatGlasDate(e.von)} – ${formatGlasDate(e.bis)}` : formatGlasDate(e.von);
    const inner = `
      <span class="okal-strich" style="background:${ONE_KAL_FARBEN[e.art]}"></span>
      <span style="flex:1; min-width:0;">
        <b>${e.ico} ${escapeHtml(e.titel)}</b>
        <span>${escapeHtml(e.sub)}${e.zeit ? " · " + escapeHtml(e.zeit) + " Uhr" : ""}</span>
        <span style="font-weight:600; color:var(--text-secondary);">${datum}</span>
      </span>
      ${ziel ? `<span class="m-pfeil">›</span>` : ""}`;
    return ziel
      ? `<a class="okal-eintrag" href="${ziel}">${inner}</a>`
      : `<div class="okal-eintrag" style="cursor:default;${vergangen ? "opacity:.7;" : ""}">${inner}</div>`;
  }).join("");
}
