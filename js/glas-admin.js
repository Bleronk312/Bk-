document.title = (typeof FIRMA_NAME !== "undefined" ? FIRMA_NAME : "GEKO") + (window.__gekoKalender === true || /(^|\/)kalender\.html$/i.test(location.pathname) ? " - Kalender" : " - Glasreinigung");

(function initGlasHeader() {
  const wm = document.getElementById("watermarkImg");
  const badge = document.getElementById("badgeLogoImg");
  if (typeof GEKO_LOGO_TRANSPARENT_B64 !== "undefined") {
    if (wm) wm.src = GEKO_LOGO_TRANSPARENT_B64;
    if (badge) badge.src = GEKO_LOGO_TRANSPARENT_B64;
  }
})();

/* ========================================================================
   State
   ======================================================================== */

let glasKunden = [];
let glasObjekte = [];
let glasObjektPositionen = []; // ALLE Positionen aller Objekte (global geladen, für Fällig-Berechnung)
let glasTouren = [];
let glasPositionen = []; // Leistungsarten-Stammdaten (Reiter "Positionen")

// Aktuelle Ansicht. { type: "tabs", tab: "touren"|"kalender"|"kunden"|"einstellungen" }
// | { type: "objekt", id } | { type: "kunde", id } | { type: "objekt-form" }
let glasPage = { type: "tabs", tab: "touren" };

let glasObjektEditing = null; // null = keine Bearbeitung, {} = neu, {...} = bestehendes Objekt
let glasObjektFormReturn = null; // wohin Abbrechen/Löschen im Objekt-Formular zurückspringt
let glasGlobalSearch = "";
let glasBusy = false;
let glasProgressText = "";
let glasSelectedObjekte = new Set();
let glasTourSearch = "";
let glasShowNewTourForm = false;
let glasTourDetailId = null;
let glasManualOrder = []; // Array von Objekt-IDs in der vom Admin festgelegten Reihenfolge
let glasPreselectPositionen = null; // Map objekt_id -> Set(position_id|nr), gesetzt bei "Jetzt planen"
// Pro Objekt in der Tour: soll die Objekt-Notiz an den Stopp? (Text dort noch anpassbar)
let glasTourNotizen = new Map(); // objekt_id -> { use: boolean, text: string }
let glasTourExtras = new Map(); // objekt_id -> [{ nr, art, qm }] - händisch zusätzlich eingetragene Positionen (z.B. Extra-Stunden)
let glasNewTour = { name: "", datum: "", datum_bis: "", template: "geko", notiz: "" }; // Zustand des Tour-Formulars (überlebt Re-Renders)
let glasTourenErledigtExpanded = false;
let glasEditingTourId = null; // gesetzt, wenn eine bestehende Tour bearbeitet statt neu angelegt wird
let glasAdminSignOpenStopId = null; // Stopp, dessen Unterschrift-Bereich in der Admin-Ansicht gerade offen ist
let glasAdminSigPad = null;
let glasNgOpenStopId = null; // Stopp, dessen "Nicht geschafft"-Grundauswahl gerade offen ist (nur Admin)
let glasNgGrund = "";        // aktuell gewählter Grund im Picker (überlebt Re-Render)
const GLAS_NG_GRUENDE = ["Kein Zugang / niemand da", "Keine Zeit mehr", "Wetter", "Baustelle / gesperrt", "Sonstiges"];
let glasStopMenuOpenId = null; // Stopp, dessen ⋯-Aktionsmenü gerade offen ist (Tour-Detail)

function toggleGlasStopMenu(id) {
  glasStopMenuOpenId = glasStopMenuOpenId === id ? null : id;
  renderGlasAdmin();
}
function closeGlasStopMenu() { glasStopMenuOpenId = null; renderGlasAdmin(); }

// Aktionsmenü eines Stopps in der Tour-Detailansicht (Admin). Bündelt alle Aktionen
// (Route, Anrufen, Unterschreiben, markieren, nicht geschafft, PDF, löschen) in einem
// aufklappbaren ⋯-Menü, damit die Stopp-Karte nicht mit Buttons zugepflastert ist.
function renderGlasStopMenu(s) {
  const isDone = s.status === "erledigt";
  const isNg = s.status === "nicht_geschafft";
  const wazeUrl = s.lat ? `https://waze.com/ul?ll=${s.lat},${s.lng}&navigate=yes` : wazeLink(s.adresse);
  const it = (inner) => `<div class="glas-stopmenu-item">${inner}</div>`;
  let actions = "";
  if (isDone) {
    actions =
      it(`<button class="glas-stopmenu-btn" onclick="glasStopMenuOpenId=null; downloadGlasPdfAdmin('${s.id}')">📄 PDF öffnen</button>`) +
      it(`<button class="glas-stopmenu-btn danger" onclick="glasStopMenuOpenId=null; deleteGlasSignatur('${s.id}')">${(!s.unterschrift && s.manuell_erledigt_am) ? "↩️ Markierung zurücknehmen" : "🗑️ Unterschrift löschen"}</button>`);
  } else if (isNg) {
    actions = it(`<button class="glas-stopmenu-btn" onclick="glasStopMenuOpenId=null; revertGlasNg('${s.id}')">↩️ Doch offen / zurücknehmen</button>`);
  } else {
    actions =
      it(`<button class="glas-stopmenu-btn" onclick="glasStopMenuOpenId=null; toggleGlasAdminSign('${s.id}')">✍️ Unterschreiben lassen</button>`) +
      it(`<button class="glas-stopmenu-btn" onclick="glasStopMenuOpenId=null; markGlasStopErledigt('${s.id}')">✔️ Als unterschrieben markieren</button>`) +
      it(`<button class="glas-stopmenu-btn danger" onclick="glasStopMenuOpenId=null; toggleGlasNg('${s.id}')">🚫 Nicht geschafft</button>`);
  }
  return `
    <div class="glas-stopmenu">
      ${it(`<a class="glas-stopmenu-btn" href="${wazeUrl}" target="_blank" rel="noopener">📍 Route (Waze)</a>`)}
      ${s.telefon ? it(`<a class="glas-stopmenu-btn" href="${telLink(s.telefon)}">📞 Anrufen</a>`) : ""}
      ${actions}
    </div>`;
}

let glasKundePickerOpen = false;
let glasKundePickerSearch = "";
let glasKundeEditing = null; // null | {id:null,...} | {...}

let glasObjektDetailHistory = {}; // objekt_id -> Array Stopps (Cache)
let glasObjektDetailShowAllHistory = false;

let glasKalenderMonth = (() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; })();
let glasKalenderSelectedDay = null;
let glasOffeneSearch = "";
let glasOffeneSelected = new Set(); // Set von "objektId::positionId"
let glasAuswahl = { modus: null, ids: new Set() }; // Mehrfach-Auswahl: 'kunden' | 'objekte' | 'touren'

let glasShowEinzelschein = false;

let glasTermine = []; // freie Kalender-Termine (glas_termine)
let glasTerminEditing = null; // null | {id:null,...} | {...} - Termin-Formular offen
let glasTerminViewing = null; // null | {...} - Read-only "Ansehen"-Ansicht eines bestehenden Termins
let glasKundeSubTab = "objekte"; // "objekte" | "termine" auf der Kunden-Seite

// Farbpalette für freie Termine (TimeTree-artig, dezent)
// Farben für eigene Büro-Termine. Standard ist bewusst TÜRKIS, damit sich Termine schon
// ohne Zutun von den Glas-Touren (blau/orange/grün) unterscheiden. Kann pro Termin geändert
// werden - die Tour-Farben (blau/orange/grün) sind hier absichtlich NICHT wählbar, damit
// die Bedeutung im Kalender eindeutig bleibt.
const GLAS_TERMIN_FARBEN = {
  tuerkis: { bg: "#d2eff1", fg: "#0b6870", dot: "#0f9aa6" },
  lila: { bg: "#eadff5", fg: "#5e3d8f", dot: "#8f6cc9" },
  pink: { bg: "#fbe0ec", fg: "#9b2d5e", dot: "#d6538a" },
  gelb: { bg: "#fdf3d7", fg: "#8a5a07", dot: "#e8b931" },
  rot: { bg: "#fbe0dc", fg: "#a33224", dot: "#e05c4a" },
  grau: { bg: "#e8eaee", fg: "#4b5563", dot: "#9aa2af" },
  blau: { bg: "#dbe9f8", fg: "#1f5d92", dot: "#2d7dc4" },
  gruen: { bg: "#d9f2dd", fg: "#1e7a34", dot: "#2e9e4f" },
};

// Farbe einer Tour im Kalender: eingeplant/offen = orange, fertig = grün.
// (Kein eigenes "heute"-Blau mehr - das war dem Termin-Türkis zu ähnlich.)
const GLAS_TOUR_FARBE = { fertig: "#2e9e4f", geplant: "#e8833a" };
function glasTourKalenderFarbe(t) {
  return glasTourAllDone(t) ? GLAS_TOUR_FARBE.fertig : GLAS_TOUR_FARBE.geplant;
}

/* ========================================================================
   Hilfsfunktionen
   ======================================================================== */



function formatGlasDateRange(datum, datumBis) {
  if (!datum) return "Ohne Datum";
  if (!datumBis || datumBis === datum) return formatGlasDate(datum);
  return `${formatGlasDate(datum)} – ${formatGlasDate(datumBis)}`;
}

// Adresse wird intern als "Straße Hausnummer\nPLZ Ort" gespeichert (2 Zeilen)
function glasSplitAdresse(adresse) {
  const lines = (adresse || "").split("\n");
  const strasse = lines[0] || "";
  const zweite = lines[1] || "";
  const m = zweite.match(/^(\d{4,5})\s*(.*)$/);
  return { strasse, plz: m ? m[1] : "", ort: m ? m[2] : zweite };
}
function glasJoinAdresse(strasse, plz, ort) {
  return `${strasse.trim()}\n${plz.trim()} ${ort.trim()}`.trim();
}

function matchesSearch(o, q) {
  return glasSearchMatch(`${o.name} ${o.adresse} ${o.kunde_name} ${o.kdnr}`, q);
}

// Höchste Dringlichkeit unter allen Positionen eines Objekts: 'ueberfaellig' | 'faellig' | null.
// NUR diese beiden zählen als "fällig" (in Zahlen/Chips). "Kommend" (1 Monat vorher, weiß)
// ist bewusst NICHT dabei - ein Objekt, das erst kommt, taucht nicht in der Fällig-Zahl auf.
// Bereits eingeplante Positionen (offener Stopp in aktiver Tour) zählen ebenfalls nicht.
const GLAS_STATUS_RANG = { ueberfaellig: 3, faellig: 2 };
function glasHoechsterStatus(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (GLAS_STATUS_RANG[a] || 0) >= (GLAS_STATUS_RANG[b] || 0) ? a : b;
}

function glasObjektStatus(objektId) {
  let hoechster = null;
  for (const p of glasGetObjektPositionen(objektId)) {
    if (glasIstEingeplant(p)) continue;
    const s = glasFaelligkeitStatus(p).status;
    // Nur echte Dringlichkeit (überfällig/fällig/bald) zählt. "geplant" = erst in der
    // Zukunft dran und ist KEIN offener Status - sonst gelten frisch erledigte Objekte
    // weiter als fällig (Bug: 87 "fällig" bei nur 60 wirklich anstehenden).
    if (!GLAS_STATUS_RANG[s]) continue;
    hoechster = glasHoechsterStatus(hoechster, s);
  }
  return hoechster;
}

// Höchste Dringlichkeit unter allen Objekten eines Kunden
function glasKundeStatus(kundeId) {
  let hoechster = null;
  for (const o of glasObjekte.filter((x) => x.kunde_id === kundeId)) {
    hoechster = glasHoechsterStatus(hoechster, glasObjektStatus(o.id));
  }
  return hoechster;
}

// Karten-Tönung: Überfällig = rot, Fällig = orange, Kommend/sonst = neutral (weiß).
function glasStatusTint(status) {
  return status === "ueberfaellig" ? "background:var(--tint-ueberfaellig-bg); border-color:var(--tint-ueberfaellig-bd);"
    : status === "faellig" ? "background:var(--tint-bald-bg); border-color:var(--tint-bald-bd);"
    : "";
}
function glasStatusDot(status) {
  return status === "ueberfaellig" ? "🔴 " : status === "faellig" ? "🟠 " : status === "kommend" ? "⚪ " : "";
}

// Deutsche qm-Zahl ("87,6" / "1.234,5") in eine Zahl umwandeln.
function glasQmZahl(qm) {
  const n = parseFloat(String(qm || "").replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

// Kurz-Zusammenfassung eines Objekts für die Listen: Gesamt-qm, Positionsangabe und die
// nächste anstehende Fälligkeit (Status + Label). Für die Übersicht auf der Kundenseite.
function glasObjektZusammenfassung(objektId) {
  const positionen = glasGetObjektPositionen(objektId);
  let totalQm = 0;
  let naechste = null; // { status, label, faelligkeit }
  positionen.forEach((p) => {
    if (!glasIstStundenPos(p)) totalQm += glasQmZahl(p.qm);
    const f = glasFaelligkeitStatus(p);
    if (f.faelligkeit && (!naechste || f.faelligkeit < naechste.faelligkeit)) naechste = f;
  });
  let posText;
  if (!positionen.length) posText = "";
  else if (positionen.length === 1) posText = `${positionen[0].nr ? `Pos. ${positionen[0].nr} ` : ""}${positionen[0].art}`;
  else posText = `${positionen.length} Positionen`;
  const qmText = totalQm ? `${glasZahlDe(totalQm)} qm` : "";
  return { positionen, totalQm, qmText, posText, naechste };
}

// Zahl deutsch formatieren (Komma, keine unnötigen Nullen): 131 -> "131", 87.6 -> "87,6"
function glasZahlDe(n) {
  return (Math.round(n * 100) / 100).toString().replace(".", ",");
}

// Farbe des Status-Balkens links an einer Objekt-Karte: Überfällig rot, Fällig orange,
// Kommend/sonst neutral (Terminiert = blau wird in der Karte separat gesetzt).
function glasStatusStripe(status) {
  return status === "ueberfaellig" ? "var(--danger)"
    : status === "faellig" ? "#d08a1f"
    : "var(--border)";
}

// Kennzahlen-Kacheln: items = [{ num, label, tone? }] mit tone 'accent'|'crit'|'warn'.
function glasStatTiles(items) {
  return `<div class="glas-stat-tiles">${items.map((it) => `
    <div class="glas-stat-tile${it.tone ? " tone-" + it.tone : ""}">
      <span class="glas-stat-tile-num">${it.num}</span>
      <span class="glas-stat-tile-lbl">${escapeHtml(it.label)}</span>
    </div>`).join("")}</div>`;
}

// Eine Objekt-Karte für die Kunden-Detailseite: Name, Position(en), qm, nächste Fälligkeit.
function renderGlasObjektKarte(o, opts) {
  opts = opts || {};
  const status = glasObjektStatus(o.id);
  const info = glasObjektZusammenfassung(o.id);
  const n = info.naechste;
  const auswahl = opts.auswahl;
  const terminiert = !status && glasGetObjektPositionen(o.id).some(glasIstEingeplant);
  return `
    <div class="glas-objekt-card" style="${glasStatusTint(status)} --stripe:${terminiert ? "var(--blue)" : glasStatusStripe(status)};" onclick="${auswahl ? `glasAuswahlToggle('${o.id}')` : `goGlasObjekt('${o.id}')`}">
      <div class="glas-objekt-card-top">
        <div style="min-width:0;">
          <p class="glas-objekt-card-name">${auswahl ? `<span class="glas-pick ${glasAuswahl.ids.has(o.id) ? "on" : ""}" style="margin-right:6px; vertical-align:middle;"></span>` : ""}${escapeHtml(o.name)}</p>
          <p class="glas-objekt-card-sub">${escapeHtml((o.adresse || "").split("\n")[0])}</p>
          ${info.posText ? `<p class="glas-objekt-card-sub">🪟 ${escapeHtml(info.posText)}</p>` : ""}
        </div>
        ${terminiert ? `<span class="badge" style="flex-shrink:0; background:var(--info-bg); color:var(--blue);">📅 Terminiert</span>`
          : n && n.status && n.status !== "geplant" ? `<span class="badge ${glasStatusBadgeClass(n.status)}" style="flex-shrink:0;">${glasStatusLabel(n.status)}</span>` : ""}
      </div>
      <div class="glas-objekt-card-meta">
        <span class="muted">${n && n.label
          ? (terminiert ? `nächste Reinigung ${escapeHtml(n.label)} · in Tour eingeplant`
            : n.status === "kommend" ? `kommend ${escapeHtml(n.label)}`
            : n.status === "ueberfaellig" ? `überfällig seit ${escapeHtml(n.label)}`
            : n.status === "faellig" ? `fällig ${escapeHtml(n.label)}`
            : `nächste Reinigung ${escapeHtml(n.label)}`)
          : "kein Intervall"}</span>
        ${info.qmText ? `<span class="glas-objekt-card-qm">${info.qmText}</span>` : ""}
      </div>
    </div>`;
}

// Wie viele Objekte eines Kunden haben welchen Status (für Kennzahlen/Badges).
// glasObjektStatus liefert nur noch 'ueberfaellig' | 'faellig' | null ("kommend" zählt
// bewusst nicht mit, siehe GLAS_STATUS_RANG).
function glasKundeStatusZaehler(kundeId) {
  let ueberfaellig = 0, faellig = 0;
  glasObjekte.filter((o) => o.kunde_id === kundeId).forEach((o) => {
    const s = glasObjektStatus(o.id);
    if (s === "ueberfaellig") ueberfaellig++;
    else if (s === "faellig") faellig++;
  });
  return { ueberfaellig, faellig };
}
function glasStatusBadgeClass(status) {
  return status === "ueberfaellig" ? "badge-danger"
    : status === "faellig" ? "badge-faellig"
    : status === "kommend" ? "badge-kommend"
    : "badge-signed";
}

/* ========================================================================
   Init & Laden
   ======================================================================== */

// Reine Kalender-App: die Home-Bildschirm-Verknüpfung mit ?app=kalender zeigt den
// Kalender ohne Kopf und Reiter (wie TimeTree). Gilt nur, solange man im Kalender ist -
// navigiert man von dort weg (z.B. Tour aus dem Tages-Fenster), erscheint die normale
// Oberfläche mit allen Reitern, und der Kalender-Reiter führt zurück in die Pur-Ansicht.
// Kalender-App-Erkennung: eigene Datei kalender.html (zuverlässig auch nach "Zum
// Home-Bildschirm"), Marker aus dem <head>, oder der alte ?app=kalender-Parameter.
const glasCalApp = window.__gekoKalender === true
  || /(^|\/)kalender\.html$/i.test(location.pathname)
  || new URLSearchParams(location.search).get("app") === "kalender";

async function glasInit() {
  // Manche Home-Bildschirm-Verknüpfungen verlieren den #-Teil der URL -
  // ?tab=kalender funktioniert deshalb als gleichwertiger Einstieg.
  const qTab = new URLSearchParams(location.search).get("tab");
  if (!location.hash && qTab) location.hash = "#/tab/" + qTab;
  if (glasCalApp && !location.hash) location.hash = "#/tab/kalender";
  glasPage = glasParseHash();
  renderGlasAdmin(); // Startseite sofort zeigen, Daten laden im Hintergrund
  await Promise.all([loadGlasKunden(), loadGlasObjekte(), loadGlasObjektPositionen(), loadGlasTouren(), loadGlasPositionen(), loadGlasTermine(), loadGlasEingeplantePositionen(), loadGlasEinstellungen(), loadGlasMitarbeiter(), loadGlasUrlaub()]);
  window.addEventListener("hashchange", () => { glasPage = glasParseHash(); renderGlasAdmin(); });
  renderGlasAdmin();
  glasGeocodeFehlende();
  try { if (typeof autoRenewPushSubscription === "function") autoRenewPushSubscription(glasPushRole()); } catch (e) {}
}

// Importierte Objekte (z.B. aus der KITA-Excel-Liste) kommen ohne Koordinaten an -
// die holen wir hier still im Hintergrund nach, damit Navigation und Route sofort
// funktionieren. Nominatim erlaubt max. 1 Anfrage pro Sekunde.
async function glasGeocodeFehlende() {
  const fehlende = glasObjekte.filter((o) => !o.lat && (o.adresse || "").trim());
  let ergaenzt = 0;
  for (const o of fehlende) {
    try {
      const { strasse, plz, ort } = glasSplitAdresse(o.adresse);
      const coords = await glasGeocode(`${strasse}, ${plz} ${ort}`);
      if (!coords || !coords.lat) continue;
      const { error } = await sb.from("glas_objekte").update({ lat: coords.lat, lng: coords.lng }).eq("id", o.id);
      if (!error) { o.lat = coords.lat; o.lng = coords.lng; ergaenzt++; }
      await new Promise((r) => setTimeout(r, 1100));
    } catch (e) { /* nächster Versuch beim nächsten Laden der Seite */ }
  }
  if (ergaenzt && !glasObjektEditing && !glasKundeEditing && !glasShowNewTourForm && !glasShowEinzelschein) renderGlasAdmin();
}

async function loadGlasTermine() {
  const { data, error } = await sb.from("glas_termine").select("*").order("datum", { ascending: true });
  if (!error) glasTermine = data || [];
}

let glasMitarbeiter = [];
let glasUrlaub = [];

async function loadGlasMitarbeiter() {
  const { data, error } = await sb.from("glas_mitarbeiter").select("*").order("name", { ascending: true });
  if (!error) glasMitarbeiter = data || [];
}
async function loadGlasUrlaub() {
  const { data, error } = await sb.from("glas_urlaub").select("*").order("von", { ascending: true });
  if (!error) glasUrlaub = data || [];
}

// Positionen, die bereits auf einem offenen Stopp einer aktiven Tour stehen: die gelten
// als "eingeplant" und tauchen nicht mehr als überfällig in der Offenen Liste auf.
let glasEingeplantePositionIds = new Set();

async function loadGlasEingeplantePositionen() {
  const { data } = await sb
    .from("glas_stopps")
    .select("positionen, status, glas_touren(archiviert_am)")
    .eq("status", "offen");
  glasEingeplantePositionIds = new Set();
  (data || []).forEach((s) => {
    if (s.glas_touren && s.glas_touren.archiviert_am) return;
    try {
      JSON.parse(s.positionen || "[]").forEach((p) => { if (p.id) glasEingeplantePositionIds.add(p.id); });
    } catch (e) {}
  });
}

function glasIstEingeplant(pos) {
  return !!pos.id && glasEingeplantePositionIds.has(pos.id);
}

async function loadGlasPositionen() {
  const { data, error } = await sb.from("glas_positionen").select("*").order("name", { ascending: true });
  if (!error) glasPositionen = data || [];
}

// Liest die Positionen eines Objekts aus dem alten JSON-Feld (Fallback für Objekte, die
// noch nie mit dem neuen Formular gespeichert wurden - siehe glasGetObjektPositionen).
function glasParsePositionen(o) {
  if (o.positionen) {
    try {
      const arr = JSON.parse(o.positionen);
      if (Array.isArray(arr) && arr.length) return arr;
    } catch (e) {}
  }
  if (o.position || o.qm) return [{ nr: o.position || "10", art: "Glas- und Rahmenreinigung", qm: o.qm || "" }];
  return [{ nr: glasPositionen[0]?.nr || "10", art: glasPositionen[0]?.name || "", qm: "" }];
}

// Einheitlicher Zugriff auf die Positionen eines Objekts: bevorzugt die neue Tabelle
// (mit Intervall-Tracking), fällt sonst auf das alte JSON-Feld zurück (ohne Intervall -
// taucht dann einfach nirgends in der Fällig-Liste auf, bis das Objekt einmal im neuen
// Formular gespeichert wird).
function glasGetObjektPositionen(objektId) {
  const rows = glasObjektPositionen.filter((p) => p.objekt_id === objektId).sort((a, b) => a.reihenfolge - b.reihenfolge);
  if (rows.length) return rows;
  const o = glasObjekte.find((x) => x.id === objektId);
  if (!o) return [];
  return glasParsePositionen(o).map((p, i) => ({
    id: null, objekt_id: objektId, nr: p.nr, art: p.art, qm: p.qm,
    intervall_typ: "", intervall_wochen: null, feste_monate: "", letzte_reinigung: null,
    faelligkeit_override: null, reihenfolge: i, _legacy: true,
  }));
}

async function loadGlasKunden() {
  const { data, error } = await sb.from("kunden").select("*").order("name", { ascending: true });
  // Kunden sind nach Bereich getrennt: hier nur Glasreinigung (+ "beide"); Altbestand
  // ohne Bereich-Spalte (SQL noch nicht ausgeführt) bleibt überall sichtbar.
  if (!error) glasKunden = (data || []).filter((k) => !k.bereich || k.bereich === "glas" || k.bereich === "beide");
}

async function loadGlasObjekte() {
  const { data, error } = await sb.from("glas_objekte").select("*").order("name", { ascending: true });
  if (!error) glasObjekte = data || [];
}

async function loadGlasObjektPositionen() {
  const { data, error } = await sb.from("glas_objekt_positionen").select("*").order("reihenfolge", { ascending: true });
  if (!error) glasObjektPositionen = data || [];
}

async function loadGlasTouren() {
  const { data, error } = await sb
    .from("glas_touren")
    .select("*, glas_stopps(id, status)")
    .order("datum", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(120);
  if (!error) glasTouren = data || [];
}

/* ========================================================================
   Routing (einfaches Hash-Routing, damit Objekt-/Kunden-Seiten verlinkbar
   sind und der Zurück-Button des Browsers funktioniert)
   ======================================================================== */

function glasParseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [kind, id] = h.split("/");
  if (kind === "objekt" && id) return { type: "objekt", id };
  if (kind === "kunde" && id) return { type: "kunde", id };
  if (kind === "tab" && id) return { type: "tabs", tab: id };
  if (kind === "statistik") return { type: "statistik" };
  return { type: "home" };
}

function glasHashFor(page) {
  if (page.type === "objekt") return `#/objekt/${page.id}`;
  if (page.type === "kunde") return `#/kunde/${page.id}`;
  if (page.type === "objekt-form") return location.hash || "#/tab/kunden"; // kein eigener Hash nötig
  if (page.type === "home") return "#/";
  if (page.type === "statistik") return "#/statistik";
  return `#/tab/${page.tab}`;
}

// Einmalige Eintritts-Animation nur bei echten Navigationswechseln (nicht beim Tippen
// in Suchfeldern oder Checkbox-Klicks - dort würde es flackern)
let glasContentAnimPending = false;
let glasCalAnimDir = null;

function goGlasHome() {
  glasContentAnimPending = true;
  // In der reinen Kalender-App gibt es keine Verwaltungs-Startseite - das Logo/Zuhause
  // führt zurück in den Kalender (aktueller Monat), nicht in die Glas-Verwaltung.
  if (glasCalApp) {
    glasKalenderMonth = { year: new Date().getFullYear(), month: new Date().getMonth() };
    glasNavigate({ type: "tabs", tab: "kalender" });
  } else {
    glasNavigate({ type: "home" });
  }
}

function glasNavigate(page) {
  glasMenuOpen = false; // offenes ☰-Menü schließt bei jeder Navigation
  // Beim Öffnen des Kalenders die Ebenen auf Standard: Touren+Termine an, Urlaub aus.
  if (page.type === "tabs" && page.tab === "kalender" && !(glasPage && glasPage.type === "tabs" && glasPage.tab === "kalender")) {
    glasResetKalEbenen();
  }
  glasPage = page;
  glasGlobalSearch = ""; // alte Suche nicht über die Navigation hinweg stehen lassen
  if (page.type === "objekt-form") { renderGlasAdmin(); return; }
  const h = glasHashFor(page);
  if (location.hash !== h) location.href = h;
  else renderGlasAdmin();
}

function goGlasObjekt(id) { glasAuswahl = { modus: null, ids: new Set() }; glasNavigate({ type: "objekt", id }); }
function goGlasKunde(id) {
  glasAuswahl = { modus: null, ids: new Set() };
  glasKundeObjFilter = "alle";
  glasKundeErlMonat = { year: new Date().getFullYear(), month: new Date().getMonth() };
  // Verlauf direkt anstoßen: der "Erledigt"-Chip zeigt dann sofort die Zahl des Monats
  if (!glasKundeTermineCache[id]) loadGlasKundeTermine(id);
  glasNavigate({ type: "kunde", id });
}
function goGlasTab(tab) {
  glasContentAnimPending = true;
  glasAuswahl = { modus: null, ids: new Set() };
  glasUrlaubEditing = null;
  glasMaEditing = null;
  glasUrlaubVerwaltung = false;
  glasObjektEditing = null;
  glasKundeEditing = null;
  glasShowNewTourForm = false;
  glasShowEinzelschein = false;
  glasTourDetailId = null;
  glasPositionEditingId = null;
  glasManualOrder = [];
  glasNavigate({ type: "tabs", tab });
}

/* ========================================================================
   Root-Render
   ======================================================================== */

function renderGlasAdmin() {
  // Offene Formulare vor jedem Neuaufbau aus dem DOM sichern - sonst würden Re-Renders
  // (z.B. durch einen Klick anderswo) bereits eingetippte Werte verwerfen.
  if (glasObjektEditing && document.getElementById("o_name")) syncObjektFormFromDom();
  if (glasKundeEditing && document.getElementById("k_name")) syncKundeFormFromDom();
  if (glasShowNewTourForm && !glasTourDetailId && document.getElementById("t_name")) syncNewTourFormFromDom();

  const view = document.getElementById("view");

  // Kalender darf die ganze Breite nutzen, alle anderen Seiten bleiben schmal/zentriert
  document.body.classList.toggle("glas-fullwidth", glasPage.type === "tabs" && glasPage.tab === "kalender");
  document.body.classList.toggle("glas-cal-pur", glasCalApp && glasPage.type === "tabs" && glasPage.tab === "kalender");

  if (glasPage.type === "objekt") { view.innerHTML = renderObjektDetailPage(glasPage.id); return; }
  if (glasPage.type === "kunde") { view.innerHTML = renderKundeDetailPage(glasPage.id); return; }
  if (glasPage.type === "objekt-form") { view.innerHTML = renderObjektForm(); return; }
  if (glasPage.type === "statistik") { view.innerHTML = renderStatistikPage(); return; }

  // Startseite (Dashboard) und alle Reiter teilen sich dieselbe Reiter-Leiste, damit die
  // Navigation immer erreichbar ist - auch direkt vom Dashboard aus.
  const isHome = glasPage.type === "home";
  const tab = isHome ? "" : glasPage.tab;
  // Kalender-App: keine Glas-Reiterleiste (Touren/Kunden gehören dort nicht hin) - auf
  // Unterseiten wie den Einstellungen stattdessen ein klarer Zurück-zum-Kalender-Balken.
  // Auf dem Kalender selbst wird diese Leiste per CSS (glas-cal-pur) ausgeblendet.
  // Reiterleiste. Auf dem Handy sitzt sie fest am UNTEREN Rand (Bottom-Nav, Icon über
  // Label); auf dem Desktop bleibt sie oben (per CSS). Icon + Beschriftung getrennt,
  // damit sie sich unten sauber stapeln lassen.
  const tb = (active, ic, lb, onclick) =>
    `<button class="tab-btn ${active ? "active" : ""}" onclick="${onclick}"><span class="tb-ic">${ic}</span><span class="tb-lb">${lb}</span></button>`;
  const glasNav = glasCalApp
    ? `<div class="tabs"><button class="tab-btn active" style="justify-content:flex-start; gap:6px;" onclick="goGlasTab('kalender')">‹ Zurück zum Kalender</button></div>`
    : `<div class="glas-bottomnav"><div class="tabs">
      ${tb(isHome, "🏠", "Start", "goGlasHome()")}
      ${tb(tab === "touren", "🚐", "Touren", "goGlasTab('touren')")}
      ${tb(tab === "kunden", "👥", "Kunden", "goGlasTab('kunden')")}
      ${tb(tab === "kalender", "📅", "Kalender", "goGlasTab('kalender')")}
      ${tb(tab === "scheine", "📄", "Scheine", "goGlasTab('scheine')")}
      ${tb(["faellig", "einstellungen"].includes(tab) || glasMenuOpen, "☰", "Mehr", "glasToggleMenu()")}
    </div></div>
    ${glasMenuOpen ? renderGlasMehrMenu(tab) : ""}`;
  view.innerHTML = `
    ${glasNav}
    ${glasCalApp || (glasPage.type === "tabs" && (glasPage.tab === "kalender" || glasPage.tab === "scheine")) ? "" : renderGlobalSearchBar()}
    <div id="glasTabContent"></div>
  `;
  glasUpdateTabContent();

  // Die globale Suche liegt AUSSERHALB des Content-Bereichs: Beim Tippen wird nur der
  // Inhalt darunter neu gebaut, das Suchfeld selbst bleibt unangetastet - so bleiben
  // Fokus und Tastatur stabil (kein focusSearch-Hack mehr nötig).
  const gsEl = document.getElementById("global_search");
  if (gsEl) gsEl.oninput = (e) => { glasGlobalSearch = e.target.value; glasUpdateTabContent(); };
}

// Baut NUR den Tab-Inhalt (#glasTabContent) neu auf - Reiterleiste und globales Suchfeld
// bleiben stehen. Kern der flüssigeren Bedienung: Tipp-Interaktionen ersetzen nicht mehr
// die komplette Seite.
function glasUpdateTabContent() {
  const content = document.getElementById("glasTabContent");
  if (!content) { renderGlasAdmin(); return; }
  content.classList.toggle("glas-content-in", glasContentAnimPending);
  glasContentAnimPending = false;
  const isHome = glasPage.type === "home";
  const tab = isHome ? "" : glasPage.tab;

  content.innerHTML = glasGlobalSearch.trim() ? renderGlobalSearchResults()
    : isHome ? renderGlasHome()
    : tab === "kunden" ? renderKundenTab()
    : tab === "faellig" ? renderFaelligTab()
    : tab === "kalender" ? renderKalenderTab()
    : tab === "scheine" ? renderScheineTab()
    : tab === "einstellungen" ? renderEinstellungenTab()
    : renderTourenTab();

  if (isHome && !glasGlobalSearch.trim()) glasAnimateHome();
  glasAnimateProgress();

  // Suchfelder INNERHALB des Contents aktualisieren beim Tippen nur ihren jeweiligen
  // Ergebnis-Container - das Eingabefeld selbst wird nie mit ersetzt.
  if (tab === "kalender") {
    attachGlasCalSwipe();
    const ks = document.getElementById("kal_search");
    if (ks) ks.oninput = (e) => {
      glasKalSearch = e.target.value;
      const box = document.getElementById("kalSearchResults");
      if (box) box.innerHTML = renderKalenderSuchErgebnisse();
    };
  }
  if (!glasGlobalSearch.trim() && tab === "faellig") {
    const searchEl = document.getElementById("offen_search");
    if (searchEl) searchEl.oninput = (e) => {
      glasOffeneSearch = e.target.value;
      const box = document.getElementById("offeneListeErgebnisse");
      if (box) box.innerHTML = renderOffeneListeErgebnisse();
    };
  }
  if (!glasGlobalSearch.trim() && tab === "scheine") {
    const searchEl = document.getElementById("scheine_search");
    if (searchEl) searchEl.oninput = (e) => {
      glasScheineSearch = e.target.value;
      const box = document.getElementById("scheineListe");
      if (box) box.innerHTML = renderScheineListe();
    };
  }
  if (!glasGlobalSearch.trim() && tab === "touren" && glasShowNewTourForm && !glasTourDetailId) {
    attachGlasReorderHandlers();
    const searchEl = document.getElementById("tour_obj_search");
    if (searchEl) searchEl.oninput = (e) => {
      glasTourSearch = e.target.value;
      const box = document.getElementById("tourSearchResults");
      if (box) box.innerHTML = renderTourObjektSearchResults();
    };
  }
  if (!glasGlobalSearch.trim() && tab === "touren" && glasShowEinzelschein) {
    const kundeSearchEl = document.getElementById("es_kunde_search");
    // Nur die Trefferliste aktualisieren - das Suchfeld behält Fokus + Tastatur
    if (kundeSearchEl) kundeSearchEl.oninput = (e) => {
      glasKundePickerSearch = e.target.value;
      const box = document.getElementById("esKundeResults");
      if (box) box.innerHTML = renderEsKundeResults();
    };
  }
}

function focusSearch(id) {
  const el = document.getElementById(id);
  if (el) { el.focus(); const v = el.value; el.value = ""; el.value = v; }
}

/* ========================================================================
   Startseite (Hallo GEKO Clean)
   ======================================================================== */

let glasMenuOpen = false;

function glasToggleMenu() { glasMenuOpen = !glasMenuOpen; renderGlasAdmin(); }

// Aufklapp-Menü hinter "☰ Mehr": alles, was nicht in die oberste Reiterzeile passt.
function renderGlasMehrMenu(tab) {
  const item = (aktiv, icon, label, onclick) => `
    <button class="glas-menu-item ${aktiv ? "on" : ""}" onclick="${onclick}">
      <span>${icon} ${label}</span>${aktiv ? '<span style="color:var(--blue);">●</span>' : '<span style="color:var(--text-secondary);">›</span>'}
    </button>`;
  return `
    <div class="glas-menu-dd">
      ${item(tab === "faellig", "⏰", "Fällige Objekte", "glasMenuOpen=false; goGlasTab('faellig')")}
      ${item(false, "📊", "Statistiken", "glasMenuOpen=false; glasOpenStatistik()")}
      ${item(tab === "einstellungen", "⚙️", "Weitere Einstellungen", "glasMenuOpen=false; goGlasTab('einstellungen')")}
    </div>`;
}

// Eigener Reiter für die fälligen Objekte (früher Unterreiter im Kalender).
function renderFaelligTab() {
  return renderOffeneListe();
}

function renderGlasHome() {
  const today = glasTodayIso();
  const offene = glasAlleOffenenPositionen();

  // Kennzahlen pro OBJEKT (dringendster Status), damit die Zahlen zu den Karten passen.
  const rang = { ueberfaellig: 0, faellig: 1, kommend: 2 };
  const perObj = new Map();
  offene.forEach((x) => {
    const cur = perObj.get(x.objekt.id);
    if (cur === undefined || rang[x.status] < rang[cur]) perObj.set(x.objekt.id, x.status);
  });
  const vals = [...perObj.values()];
  const uCount = vals.filter((s) => s === "ueberfaellig").length;
  const fCount = vals.filter((s) => s === "faellig").length;
  const terminiert = glasObjekte.filter((o) => glasGetObjektPositionen(o.id).some((p) => glasIstEingeplant(p))).length;

  const aktiveTouren = glasTouren.filter((t) => !t.archiviert_am);
  const heuteTouren = aktiveTouren.filter((t) => t.datum && today >= t.datum && today <= (t.datum_bis || t.datum));
  const naechsteTouren = aktiveTouren
    .filter((t) => t.datum && t.datum > today && !glasTourAllDone(t))
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .slice(0, 3);
  const heuteTermine = glasTermine.filter((t) => t.datum && today >= t.datum && today <= (t.datum_bis || t.datum));

  // Farbige Status-Kachel (Zahl zählt beim Öffnen hoch -> data-count)
  const tile = (cls, icon, num, label, onclick) => `
    <div class="glas-home-tile ${cls}" onclick="${onclick}">
      <span class="ght-ic">${icon}</span>
      <span class="ght-num" data-count="${num}">0</span>
      <span class="ght-lbl">${label}</span>
    </div>`;

  const tourCard = (t) => {
    const stops = t.glas_stopps || [];
    const done = stops.filter((s) => s.status === "erledigt").length;
    const total = stops.length;
    const allDone = glasTourAllDone(t);
    const farbe = glasTourKalenderFarbe(t);
    const pill = allDone
      ? `<span class="gtc-pill p-ok">Fertig</span>`
      : done ? `<span class="gtc-pill p-run">Läuft</span>` : `<span class="gtc-pill p-plan">Geplant</span>`;
    const leading = total ? glasMiniRing(done, total) : `<div class="gtc-ic" style="background:${farbe}22; color:${farbe};">🚐</div>`;
    return `
      <div class="glas-tour-card" onclick="glasNavigate({type:'tabs', tab:'touren'}); openGlasTourDetail('${t.id}');">
        <div class="gtc-row">
          ${leading}
          <div class="gtc-grow">
            <p class="gtc-name">${t.name ? escapeHtml(t.name) : (t.frei ? "Einzelschein" : "Tour")}</p>
            <p class="gtc-meta">${formatGlasDateRange(t.datum, t.datum_bis)}${total ? ` · ${done}/${total} erledigt` : ""}</p>
          </div>
          ${pill}
        </div>
        ${t.notiz ? `<div class="gtc-notiz">📝 ${escapeHtml(t.notiz)}</div>` : ""}
      </div>`;
  };

  const terminCard = (t) => {
    const c = GLAS_TERMIN_FARBEN[t.farbe] || GLAS_TERMIN_FARBEN.tuerkis;
    return `
      <div class="glas-tour-card" onclick="goGlasTab('kalender'); openGlasTermin('${t.id}');">
        <div class="gtc-row">
          <div class="gtc-ic" style="background:${c.dot}22; color:${c.dot};">📌</div>
          <div class="gtc-grow">
            <p class="gtc-name">${escapeHtml(t.titel)}</p>
            ${t.datum_bis && t.datum_bis !== t.datum ? `<p class="gtc-meta">${formatGlasDateRange(t.datum, t.datum_bis)}</p>` : ""}
          </div>
          <span class="gtc-pill p-plan">Termin</span>
        </div>
      </div>`;
  };

  return `
    <div class="glas-dash">
      <div class="glas-dash-hello">
        <div>
          <p class="glas-dash-hi">Hallo GEKO Clean <span class="glas-welcome-heart">❤️</span></p>
          <p class="muted" style="margin:2px 0 0;">${glasHeuteLangDatum()}</p>
        </div>
      </div>

      <div class="glas-home-tiles">
        ${tile("t-crit", "🔴", uCount, "Überfällig", "glasKundenSort='dringend'; goGlasTab('kunden')")}
        ${tile("t-warn", "🟠", fCount, "Fällig", "glasKundenSort='dringend'; goGlasTab('kunden')")}
        ${tile("t-info", "📅", terminiert, "Terminiert", "goGlasTab('touren')")}
        ${tile("t-ok", "🚐", heuteTouren.length, "Touren heute", "goGlasTab('touren')")}
      </div>

      <div class="glas-dash-actions">
        <button class="btn btn-primary" style="flex:1; justify-content:center;" onclick="glasStartNewTourForm(); glasNavigate({type:'tabs', tab:'touren'});">+ Neue Tour</button>
        <button class="btn" style="flex:1; justify-content:center;" onclick="goGlasTab('touren'); openGlasEinzelschein();">📄 Blanko erstellen</button>
      </div>

      <div class="glas-home-sec">
        <div class="glas-home-sec-head" onclick="glasToggleHomeSektion('heute')">
          <span>Heute</span><span class="chev">${glasHomeOffen.heute ? "▲" : "▼"}</span>
        </div>
        ${!glasHomeOffen.heute ? "" : (heuteTouren.length || heuteTermine.length
          ? heuteTouren.map(tourCard).join("") + heuteTermine.map(terminCard).join("")
          : `<p class="glas-home-empty">Heute ist nichts geplant. 🎉</p>`)}
      </div>

      ${naechsteTouren.length ? `
      <div class="glas-home-sec">
        <div class="glas-home-sec-head" onclick="glasToggleHomeSektion('naechste')">
          <span>Als Nächstes</span><span class="chev">${glasHomeOffen.naechste ? "▲" : "▼"}</span>
        </div>
        ${glasHomeOffen.naechste ? naechsteTouren.map(tourCard).join("") : ""}
      </div>` : ""}
    </div>`;
}

// Kleiner Fortschritts-Ring für Touren-Karten: zeigt X/Y erledigt (füllt sich per
// glasAnimateProgress auf). Nutzt viewBox 92 (r=40, Umfang 251.2) wie der große Ring.
function glasMiniRing(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const col = (total > 0 && done === total) ? "#2e9e4f" : "var(--blue)";
  return `<div class="glas-mini-ring">
      <svg width="46" height="46" viewBox="0 0 92 92">
        <circle cx="46" cy="46" r="40" fill="none" stroke="var(--prog-track)" stroke-width="11"></circle>
        <circle class="glas-ring-fill" cx="46" cy="46" r="40" fill="none" stroke="${col}" stroke-width="11" stroke-linecap="round" stroke-dasharray="251.2" stroke-dashoffset="251.2" data-pct="${pct}"></circle>
      </svg>
      <span class="glas-mini-ring-txt">${done}/${total}</span>
    </div>`;
}

// Nach dem Rendern der Startseite: Kachel-Zahlen hochzählen.
function glasAnimateHome() {
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll(".glas-home-tile .ght-num[data-count]").forEach((n) => {
    const to = parseInt(n.getAttribute("data-count"), 10) || 0;
    if (reduce || to === 0) { n.textContent = to; return; }
    const start = performance.now(), dur = 650;
    const step = (t) => {
      const p = Math.min(1, (t - start) / dur);
      n.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// Fortschrittsbalken (Touren-Karten) + Fortschritts-Ring (Tour-Detail) füllen sich beim
// Rendern flüssig auf. Läuft nach jedem Tab-Render (Start, Touren, Tour-Detail).
function glasAnimateProgress() {
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll(".glas-prog-fill[data-w]").forEach((f) => {
    const w = f.getAttribute("data-w") || "0";
    if (reduce) { f.style.width = w + "%"; return; }
    requestAnimationFrame(() => setTimeout(() => { f.style.width = w + "%"; }, 60));
  });
  document.querySelectorAll(".glas-ring-fill[data-pct]").forEach((c) => {
    const pct = parseFloat(c.getAttribute("data-pct")) || 0;
    const circ = 251.2;
    const off = (circ * (1 - pct / 100)).toFixed(1);
    if (reduce) { c.style.strokeDashoffset = off; return; }
    requestAnimationFrame(() => setTimeout(() => { c.style.strokeDashoffset = off; }, 120));
  });
}

let glasHomeOffen = { heute: true, naechste: true };
function glasToggleHomeSektion(key) { glasHomeOffen[key] = !glasHomeOffen[key]; glasUpdateTabContent(); }

// "Donnerstag, 2. Juli 2026"
function glasHeuteLangDatum() {
  const wt = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const mo = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const d = new Date();
  return `${wt[d.getDay()]}, ${d.getDate()}. ${mo[d.getMonth()]} ${d.getFullYear()}`;
}

/* ========================================================================
   Globale Suche (immer sichtbar, über allen Reitern)
   ======================================================================== */

function renderGlobalSearchBar() {
  return `<input type="text" id="global_search" placeholder="🔍 Alles durchsuchen (Kunde, Objekt, Kd.-Nr. ...)" value="${escapeHtml(glasGlobalSearch)}" style="margin:14px 0;" />`;
}

function renderGlobalSearchResults() {
  const q = glasGlobalSearch.trim().toLowerCase();
  const kundenHits = glasKunden.filter((k) => glasSearchMatch(`${k.name} ${k.adresse} ${k.kdnr}`, q));
  const objekteHits = glasObjekte.filter((o) => glasSearchMatch(`${o.name} ${o.adresse} ${o.kdnr} ${o.kunde_name}`, q));
  if (!kundenHits.length && !objekteHits.length) return `<p class="muted">Keine Treffer für „${escapeHtml(glasGlobalSearch)}".</p>`;
  return `
    ${kundenHits.length ? `
    <p class="muted" style="margin:6px 0 8px; font-weight:600;">Kunden (${kundenHits.length})</p>
    <div class="card" style="padding:6px 18px;">
      ${kundenHits.map((k) => `<div style="padding:10px 0; border-top:1px solid var(--border); cursor:pointer;" onclick="goGlasKunde('${k.id}')">${escapeHtml(k.name)}</div>`).join("")}
    </div>` : ""}
    ${objekteHits.length ? `
    <p class="muted" style="margin:16px 0 8px; font-weight:600;">Objekte (${objekteHits.length})</p>
    <div class="card" style="padding:6px 18px;">
      ${objekteHits.map((o) => {
        const status = glasObjektStatus(o.id);
        return `<div style="padding:10px 0; border-top:1px solid var(--border); cursor:pointer;" onclick="goGlasObjekt('${o.id}')">
          <b>${glasStatusDot(status)}${escapeHtml(o.name)}</b><br/>
          <span class="muted" style="font-size:12px;">${escapeHtml(o.kunde_name)} · Kd.-Nr. ${escapeHtml(o.kdnr)}</span>
        </div>`;
      }).join("")}
    </div>` : ""}
  `;
}

/* ========================================================================
   Kunden-Picker (ersetzt das native Dropdown im Objekt-Formular)
   ======================================================================== */

function renderKundePicker(selectedKundeId, selectedKundeName) {
  if (!glasKundePickerOpen) {
    return `
      <div class="card" style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;" onclick="glasKundePickerOpen = true; glasKundePickerSearch = ''; renderGlasAdmin();">
        <div>
          <p class="muted" style="margin:0 0 2px; font-size:12px;">Kunde / Träger</p>
          <p style="margin:0; font-weight:600;">${selectedKundeName ? escapeHtml(selectedKundeName) : "— auswählen —"}</p>
        </div>
        <button class="btn btn-sm" type="button" onclick="event.stopPropagation(); glasKundePickerOpen = true; glasKundePickerSearch = ''; renderGlasAdmin();">Ändern</button>
      </div>`;
  }
  const q = glasKundePickerSearch.trim().toLowerCase();
  const filtered = glasKunden.filter((k) => glasSearchMatch(`${k.name} ${k.kdnr || ""} ${k.adresse || ""}`, q));
  return `
    <div class="card" style="margin-bottom:14px;">
      <input type="text" id="kp_search" placeholder="🔍 Kunde suchen..." value="${escapeHtml(glasKundePickerSearch)}" style="margin-bottom:10px;" />
      <div style="max-height:240px; overflow-y:auto;">
        ${filtered.length ? filtered.map((k) => `
          <div style="padding:10px 4px; border-top:1px solid var(--border); cursor:pointer;" onclick='selectGlasKundeForObjekt(${JSON.stringify(k.id)})'>
            <p style="margin:0; font-weight:500;">${escapeHtml(k.name)}</p>
          </div>`).join("") : `<p class="muted" style="padding:8px 4px;">Keine Kunden gefunden.</p>`}
      </div>
      <button class="btn btn-sm" type="button" style="margin-top:10px;" onclick="glasKundePickerOpen = false; renderGlasAdmin();">Abbrechen</button>
    </div>`;
}

function selectGlasKundeForObjekt(kundeId) {
  const kunde = glasKunden.find((k) => k.id === kundeId);
  if (!kunde || !glasObjektEditing) return;
  glasObjektEditing.kunde_id = kunde.id;
  glasObjektEditing.kunde_name = kunde.name;
  glasObjektEditing.kunde_adresse = [kunde.name, kunde.adresse].filter(Boolean).join("\n");
  glasKundePickerOpen = false;
  renderGlasAdmin();
}

/* ========================================================================
   Kunden-Tab, Kunden-Formular & Kunden-Detail-Seite
   ======================================================================== */

// Sortierung der Kundenliste: alphabetisch oder nach Dringlichkeit (in beide Richtungen)
let glasKundenSort = "az"; // "az" | "dringend" | "ok"

function renderKundenTab() {
  if (glasKundeEditing !== null) return renderKundeForm();

  // Eigenes Suchfeld hier bewusst entfernt - die globale Suche oben (Kunde, Objekt, Kd.-Nr.)
  // deckt das bereits vollständig ab, ein zweites Feld war redundant.
  const statusRang = { ueberfaellig: 0, faellig: 1 };
  const mitStatus = glasKunden.map((k) => ({ k, status: glasKundeStatus(k.id) }));
  const sortiert = [...mitStatus].sort((a, b) => {
    if (glasKundenSort === "az") return a.k.name.localeCompare(b.k.name, "de");
    const ra = a.status in statusRang ? statusRang[a.status] : 3;
    const rb = b.status in statusRang ? statusRang[b.status] : 3;
    const diff = glasKundenSort === "dringend" ? ra - rb : rb - ra;
    return diff || a.k.name.localeCompare(b.k.name, "de");
  });

  const auswahl = glasAuswahl.modus === "kunden";
  const rows = sortiert.length
    ? sortiert.map(({ k, status }) => {
        const objekte = glasObjekte.filter((o) => o.kunde_id === k.id);
        const z = glasKundeStatusZaehler(k.id);
        return `
          <div class="card" style="cursor:pointer; display:flex; gap:10px; justify-content:space-between; align-items:center; ${glasStatusTint(status)}" onclick="${auswahl ? `glasAuswahlToggle('${k.id}')` : `goGlasKunde('${k.id}')`}">
            ${auswahl ? `<span class="glas-pick ${glasAuswahl.ids.has(k.id) ? "on" : ""}"></span>` : ""}
            <div style="flex:1; min-width:0;">
              <p style="margin:0; font-weight:600;">${escapeHtml(k.name)}${k.kdnr ? ` <span class="muted" style="font-weight:500; font-size:12.5px;">· Kd.-Nr. ${escapeHtml(k.kdnr)}</span>` : ""}</p>
              ${k.adresse ? `<p class="muted" style="margin:2px 0 0; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml((k.adresse || "").split("\n").join(", "))}</p>` : ""}
              <p class="muted" style="margin:4px 0 0; display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                <span>${objekte.length} Objekt${objekte.length === 1 ? "" : "e"}</span>
                ${z.ueberfaellig ? `<span class="badge ${glasStatusBadgeClass("ueberfaellig")}">${z.ueberfaellig} überfällig</span>` : ""}
                ${z.faellig ? `<span class="badge ${glasStatusBadgeClass("faellig")}">${z.faellig} fällig</span>` : ""}
              </p>
            </div>
            <span style="font-size:18px; color:var(--text-secondary);">›</span>
          </div>`;
      }).join("")
    : `<p class="muted">Keine Kunden gefunden.</p>`;

  // Kennzahlen über der Kundenliste
  const objGesamt = glasObjekte.length;
  const objUeberf = glasObjekte.filter((o) => glasObjektStatus(o.id) === "ueberfaellig").length;
  const objFaellig = glasObjekte.filter((o) => glasObjektStatus(o.id) === "faellig").length;
  const kennzahlen = glasKunden.length ? glasStatTiles([
    { num: glasKunden.length, label: "Kunden", tone: "accent" },
    { num: objGesamt, label: "Objekte" },
    { num: objUeberf, label: "Objekte überfällig", tone: objUeberf ? "crit" : null },
    { num: objFaellig, label: "fällig", tone: objFaellig ? "warn" : null },
  ]) : "";

  return `
    ${kennzahlen}
    <div style="display:flex; gap:8px; margin:16px 0 10px; align-items:center; flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="editGlasKunde(null)">+ Neuer Kunde</button>
      <button class="btn btn-sm" onclick="editGlasObjekt(null)">+ Neues Objekt</button>
      ${sortiert.length && !auswahl ? `<button class="btn btn-sm" style="margin-left:auto;" title="Mehrere auswählen" onclick="glasAuswahlStart('kunden')">☑️ Auswählen</button>` : ""}
    </div>
    <div class="glas-seg" style="margin-bottom:14px;">
      <button class="glas-seg-btn ${glasKundenSort === "az" ? "on" : ""}" onclick="glasKundenSort='az'; glasUpdateTabContent();">A–Z</button>
      <button class="glas-seg-btn ${glasKundenSort === "dringend" ? "on" : ""}" onclick="glasKundenSort='dringend'; glasUpdateTabContent();">Überfällig zuerst</button>
      <button class="glas-seg-btn ${glasKundenSort === "ok" ? "on" : ""}" onclick="glasKundenSort='ok'; glasUpdateTabContent();">OK zuerst</button>
    </div>
    ${auswahl ? glasAuswahlLeiste() : ""}
    ${rows}
  `;
}

/* ========================================================================
   Mehrfach-Auswahl (Kunden / Objekte / Touren): auswählen und gesammelt löschen
   ======================================================================== */

function glasAuswahlStart(modus) { glasAuswahl = { modus, ids: new Set() }; renderGlasAdmin(); }
function glasAuswahlEnde() { glasAuswahl = { modus: null, ids: new Set() }; renderGlasAdmin(); }
function glasAuswahlToggle(id) {
  if (glasAuswahl.ids.has(id)) glasAuswahl.ids.delete(id); else glasAuswahl.ids.add(id);
  renderGlasAdmin();
}

function glasAuswahlLeiste() {
  const n = glasAuswahl.ids.size;
  const label = glasAuswahl.modus === "touren" ? "🗑️ Ins Archiv" : "🗑️ Löschen";
  return `
    <div class="glas-auswahl-bar">
      <span class="glas-auswahl-count">${n}</span>
      <span style="font-weight:600;">ausgewählt</span>
      <button class="btn btn-sm" style="margin-left:auto;" onclick="glasAuswahlEnde()">Abbrechen</button>
      <button class="btn btn-sm" style="background:var(--danger); border-color:var(--danger); color:#fff;" onclick="glasAuswahlLoeschen()" ${n ? "" : "disabled"}>${label}</button>
    </div>`;
}

async function glasAuswahlLoeschen() {
  const ids = [...glasAuswahl.ids];
  if (!ids.length) return;
  if (glasAuswahl.modus === "touren") {
    if (!confirm(`${ids.length} Tour(en) ins Archiv verschieben? Du kannst sie dort wiederherstellen oder endgültig löschen.`)) return;
    const { error } = await sb.from("glas_touren").update({ archiviert_am: new Date().toISOString() }).in("id", ids);
    if (error) { showToast("Fehler: " + error.message); return; }
    showToast(`${ids.length} Tour(en) ins Archiv verschoben`);
  } else if (glasAuswahl.modus === "objekte") {
    if (!confirm(`${ids.length} Objekt(e) löschen? Geplante (noch nicht unterschriebene) Termine werden mit entfernt, unterschriebene Scheine bleiben erhalten.`)) return;
    const fehler = await glasDeleteObjekteCascade(ids);
    if (fehler) { showToast("Fehler: " + fehler); return; }
    showToast(`${ids.length} Objekt(e) gelöscht`);
  } else if (glasAuswahl.modus === "kunden") {
    const objektIds = glasObjekte.filter((o) => ids.includes(o.kunde_id)).map((o) => o.id);
    if (!confirm(`${ids.length} Kunde(n) inkl. ${objektIds.length} Objekt(en) löschen? Geplante (noch nicht unterschriebene) Termine werden mit entfernt.`)) return;
    const fehler = await glasDeleteObjekteCascade(objektIds);
    if (fehler) { showToast("Fehler: " + fehler); return; }
    const { error } = await sb.from("kunden").delete().in("id", ids);
    if (error) { showToast("Fehler: " + error.message); return; }
    showToast(`${ids.length} Kunde(n) gelöscht`);
  }
  glasAuswahl = { modus: null, ids: new Set() };
  await glasReloadNachLoeschen();
  renderGlasAdmin();
}

// Nach Lösch-Aktionen alles neu laden, was Objekte/Touren anzeigt (Startseite,
// Offene Liste, Kalender), damit nirgendwo Reste hängen bleiben.
async function glasReloadNachLoeschen() {
  glasKundeTermineCache = {}; glasScheineDaten = null; glasStatistikDaten = null;
  glasObjektDetailHistory = {};
  await Promise.all([loadGlasKunden(), loadGlasObjekte(), loadGlasObjektPositionen(), loadGlasTouren(), loadGlasEingeplantePositionen()]);
}

function syncKundeFormFromDom() {
  if (!glasKundeEditing) return;
  const get = (id) => document.getElementById(id)?.value;
  if (get("k_name") !== undefined) glasKundeEditing.name = get("k_name");
  if (get("k_adresse") !== undefined) glasKundeEditing.adresse = get("k_adresse");
  if (get("k_kdnr") !== undefined) glasKundeEditing.kdnr = get("k_kdnr");
  if (get("k_bereich") !== undefined) glasKundeEditing.bereich = get("k_bereich");
}

function editGlasKunde(id) {
  if (id === null) {
    glasKundeEditing = { id: null, name: "", adresse: "", kdnr: "", bereich: "glas" };
  } else {
    glasKundeEditing = { ...glasKunden.find((k) => k.id === id) };
  }
  renderGlasAdmin();
}

function cancelGlasKundeEdit() {
  glasKundeEditing = null;
  renderGlasAdmin();
}

function renderKundeForm() {
  const k = glasKundeEditing;
  return `
    <div class="card" style="margin-top:16px;">
      <h2>${k.id ? "Kunde bearbeiten" : "Neuer Kunde"}</h2>
      <div class="field"><label class="muted">Name</label><input type="text" id="k_name" value="${escapeHtml(k.name)}" placeholder="Zweckverband Kath. Tageseinrichtungen" /></div>
      <div class="field"><label class="muted">Adresse</label><textarea id="k_adresse" rows="3" placeholder="Im Gildehof 8
45127 Essen">${escapeHtml(k.adresse)}</textarea></div>
      <div class="field"><label class="muted">Haupt-Kd.-Nr. (erscheint auf den Abnahmescheinen)</label><input type="text" id="k_kdnr" value="${escapeHtml(k.kdnr)}" /></div>
      <div class="field">
        <label class="muted">Bereich (wo dieser Kunde auftaucht)</label>
        <select id="k_bereich" style="width:auto;">
          <option value="glas" ${(k.bereich || "glas") === "glas" ? "selected" : ""}>Glasreinigung</option>
          <option value="graffiti" ${k.bereich === "graffiti" ? "selected" : ""}>Graffiti / Sonderreinigung</option>
          <option value="beide" ${k.bereich === "beide" ? "selected" : ""}>Beide Bereiche</option>
        </select>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-primary" onclick="saveGlasKunde()" ${glasBusy ? "disabled" : ""}>${glasBusy ? '<span class="spinner"></span> Speichere...' : "Speichern"}</button>
        <button class="btn btn-sm" onclick="cancelGlasKundeEdit()">Abbrechen</button>
        ${k.id ? `<button class="btn btn-sm" style="color:var(--danger); margin-left:auto;" onclick="deleteGlasKunde('${k.id}')">Löschen</button>` : ""}
      </div>
    </div>`;
}

async function saveGlasKunde() {
  if (glasBusy) return;
  syncKundeFormFromDom();
  const name = glasKundeEditing.name.trim();
  if (!name) { showToast("Bitte einen Namen eintragen"); return; }
  glasBusy = true;
  renderGlasAdmin();
  const payload = { id: glasKundeEditing.id || genCode(), name, adresse: (glasKundeEditing.adresse || "").trim(), kdnr: (glasKundeEditing.kdnr || "").trim(), bereich: glasKundeEditing.bereich || "glas" };
  const { error } = await sb.from("kunden").upsert(payload);
  glasBusy = false;
  if (error) { showToast("Fehler: " + error.message); renderGlasAdmin(); return; }
  showToast("Kunde gespeichert");
  const wasNew = !glasKundeEditing.id;
  glasKundeEditing = null;
  await loadGlasKunden();
  if (wasNew) goGlasKunde(payload.id); else renderGlasAdmin();
}

async function deleteGlasKunde(id) {
  const objekte = glasObjekte.filter((o) => o.kunde_id === id);
  const msg = objekte.length
    ? `Diesen Kunden inkl. seiner ${objekte.length} Objekt(e) löschen? Geplante (noch nicht unterschriebene) Termine werden überall mit entfernt, unterschriebene Scheine bleiben erhalten.`
    : "Diesen Kunden wirklich löschen?";
  if (!confirm(msg)) return;
  const fehler = await glasDeleteObjekteCascade(objekte.map((o) => o.id));
  if (fehler) { showToast("Fehler: " + fehler); return; }
  const { error } = await sb.from("kunden").delete().eq("id", id);
  if (error) { showToast("Fehler: " + error.message); return; }
  showToast("Kunde gelöscht");
  glasKundeEditing = null;
  await glasReloadNachLoeschen();
  goGlasTab("kunden");
}

let glasKundeTermineCache = {}; // kunde_id -> Array Stopps mit glas_touren (Vergangenheit + Zukunft)

async function loadGlasKundeTermine(kundeId) {
  const objektIds = glasObjekte.filter((o) => o.kunde_id === kundeId).map((o) => o.id);
  const sel = "*, glas_touren(name, datum, datum_bis, template, archiviert_am, frei)";
  let stops = [];
  if (objektIds.length) {
    const { data, error } = await sb.from("glas_stopps").select(sel).in("objekt_id", objektIds);
    if (!error) stops = data || [];
  }
  // Blankos ohne Objekt-Bezug hängen über kunde_id direkt am Kunden
  try {
    const { data } = await sb.from("glas_stopps").select(sel).eq("kunde_id", kundeId);
    (data || []).forEach((s) => { if (!s.objekt_id && !stops.some((x) => x.id === s.id)) stops.push(s); });
  } catch (e) { /* kunde_id-Spalte fehlt noch - dann nur Objekt-Termine */ }
  glasKundeTermineCache[kundeId] = stops.filter((s) => s.glas_touren && !s.glas_touren.archiviert_am);
  renderGlasAdmin();
}

// Smart-Filter der Objektliste eines Kunden: jedes Objekt fällt in genau eine Kategorie.
// "faellig"   = braucht Planung (mind. eine Position überfällig/fällig/bald, nicht eingeplant)
// "terminiert"= in einer Tour eingeplant (und nichts weiteres offen)
// "ok"        = aktuell nichts fällig (nur unter "Alle" sichtbar)
// Der Chip "✓ Erledigt" ist KEINE Objekt-Kategorie, sondern der Arbeits-Verlauf des
// Kunden: alle unterschriebenen/markierten Scheine, nach Monat blätterbar.
let glasKundeObjFilter = "alle"; // "alle" | "faellig" | "terminiert" | "erledigt"
let glasKundeErlMonat = null;    // { year, month } für den Erledigt-Verlauf

function glasKundeObjKategorie(o) {
  const s = glasObjektStatus(o.id);
  if (s === "ueberfaellig") return "ueberfaellig";
  if (s === "faellig") return "faellig";
  if (glasGetObjektPositionen(o.id).some(glasIstEingeplant)) return "terminiert";
  return "ok";
}

function glasKundeErlMonatWechsel(delta) {
  const m = glasKundeErlMonat || { year: new Date().getFullYear(), month: new Date().getMonth() };
  m.month += delta;
  if (m.month < 0) { m.month = 11; m.year--; }
  if (m.month > 11) { m.month = 0; m.year++; }
  glasKundeErlMonat = m;
  renderGlasAdmin();
}

// Sortierung innerhalb der Karten: Dringendstes zuerst, dann Terminierte, dann Erledigte.
function glasKundeObjSortRang(o) {
  const s = glasObjektStatus(o.id);
  if (s === "ueberfaellig") return 0;
  if (s === "faellig") return 1;
  return glasKundeObjKategorie(o) === "terminiert" ? 3 : 4;
}

function renderKundeDetailPage(id) {
  if (glasKundeEditing !== null) return renderKundeForm();

  const k = glasKunden.find((x) => x.id === id);
  if (!k) return `<button class="btn btn-sm" style="margin:16px 0;" onclick="goGlasTab('kunden')">&larr; Zurück</button><p class="muted">Kunde nicht gefunden.</p>`;

  const objekte = glasObjekte.filter((o) => o.kunde_id === id);
  let faelligeCount = 0;
  objekte.forEach((o) => { if (glasObjektStatus(o.id)) faelligeCount++; });

  return `
    <button class="btn btn-sm" style="margin:16px 0;" onclick="goGlasTab('kunden')">&larr; Alle Kunden</button>
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <p style="margin:0 0 4px; font-weight:700; font-size:19px;">${escapeHtml(k.name)}</p>
          <p class="muted" style="margin:0; white-space:pre-line;">${escapeHtml(k.adresse || "")}</p>
        </div>
        <button class="btn btn-sm" onclick="editGlasKunde('${k.id}')">Bearbeiten</button>
      </div>
    </div>
    <div style="display:flex; gap:8px; margin-bottom:14px;">
      <button class="btn btn-sm ${glasKundeSubTab === "objekte" ? "btn-primary" : ""}" style="flex:1; justify-content:center;" onclick="glasKundeSubTab = 'objekte'; renderGlasAdmin();">🏢 Objekte (${objekte.length})</button>
      <button class="btn btn-sm ${glasKundeSubTab === "termine" ? "btn-primary" : ""}" style="flex:1; justify-content:center;" onclick="glasKundeSubTab = 'termine'; if (!glasKundeTermineCache['${id}']) loadGlasKundeTermine('${id}'); renderGlasAdmin();">📅 Termine</button>
    </div>
    ${glasKundeSubTab === "termine" ? renderKundeTermine(id) : `
      ${(() => {
        const gesamtQm = objekte.reduce((sum, o) => sum + glasObjektZusammenfassung(o.id).totalQm, 0);
        return objekte.length ? `<p class="muted" style="margin:-4px 0 10px; font-size:13px;">${objekte.length} Objekt${objekte.length === 1 ? "" : "e"}${gesamtQm ? ` · ${glasZahlDe(gesamtQm)} qm gesamt` : ""}</p>` : "";
      })()}
      ${glasAuswahl.modus === "objekte" ? glasAuswahlLeiste() : ""}
      ${(() => {
        if (!objekte.length && !(glasKundeTermineCache[id] || []).length) return `<div class="card"><p class="muted" style="padding:8px 0;">Noch keine Objekte für diesen Kunden angelegt.</p></div>`;
        // Überfällig + Fällig + Terminiert + Nichts fällig = Alle (jedes Objekt genau eine
        // Kategorie). "Erledigt" ist bewusst KEINE Objekt-Kategorie, sondern der Monats-Verlauf.
        const zaehler = { alle: objekte.length, ueberfaellig: 0, faellig: 0, terminiert: 0, ok: 0 };
        objekte.forEach((o) => { const kat = glasKundeObjKategorie(o); if (zaehler[kat] !== undefined) zaehler[kat]++; });

        // Erledigt-Verlauf: unterschriebene/markierte Scheine im gewählten Monat
        const cache = glasKundeTermineCache[id];
        const m = glasKundeErlMonat || { year: new Date().getFullYear(), month: new Date().getMonth() };
        const mPrefix = `${m.year}-${String(m.month + 1).padStart(2, "0")}`;
        const imMonat = (cache || [])
          .filter((s) => s.status === "erledigt" && (glasSignaturDatum(s) || "").startsWith(mPrefix))
          .sort((a, b) => (glasSignaturDatum(b) || "").localeCompare(glasSignaturDatum(a) || ""));

        const chip = (key, label, count) => `<button class="glas-seg-btn ${glasKundeObjFilter === key ? "on" : ""}" onclick="glasKundeObjFilter='${key}'; renderGlasAdmin();">${label}${count === null ? "" : ` (${count})`}</button>`;
        const chips = `
          <div class="glas-seg" style="margin:0 0 12px; flex-wrap:wrap;">
            ${chip("alle", "Alle", zaehler.alle)}${zaehler.ueberfaellig ? chip("ueberfaellig", "🔴 Überfällig", zaehler.ueberfaellig) : ""}${chip("faellig", "🟠 Fällig", zaehler.faellig)}${chip("terminiert", "📅 Terminiert", zaehler.terminiert)}${chip("ok", "✅ Nichts fällig", zaehler.ok)}${chip("erledigt", "✓ Erledigt", cache ? imMonat.length : null)}
          </div>`;

        if (glasKundeObjFilter === "erledigt") {
          const monatsNamen = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
          const zeile = (s) => {
            const manuell = !s.unterschrift && s.manuell_erledigt_am;
            const qm = glasStopQm(s);
            return `
              <div style="display:flex; align-items:center; gap:12px; padding:11px 0; border-top:1px solid var(--border);${s.objekt_id ? " cursor:pointer;" : ""}" ${s.objekt_id ? `onclick="goGlasObjekt('${s.objekt_id}')"` : ""}>
                <span style="width:4px; align-self:stretch; border-radius:2px; background:#2e9e4f;"></span>
                <div style="flex:1; min-width:0;">
                  <p style="margin:0; font-weight:500;">${escapeHtml(s.objekt)}${s.glas_touren && s.glas_touren.frei ? ` <span class="badge badge-open" style="font-size:10px;">Blanko</span>` : ""}</p>
                  <p class="muted" style="margin:2px 0 0; font-size:12.5px;">${formatGlasDate(glasSignaturDatum(s))}${manuell ? " · ✔️ als unterschrieben markiert" : s.name ? ` · ✓ ${escapeHtml(s.name)}` : ""}${qm ? ` · ${qm} qm` : ""}${s.glas_touren?.name ? ` · ${escapeHtml(s.glas_touren.name)}` : ""}</p>
                </div>
                ${s.objekt_id ? `<span style="color:var(--text-secondary);">›</span>` : ""}
              </div>`;
          };
          return `${chips}
            <div class="card">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px;">
                <button class="btn btn-sm" onclick="glasKundeErlMonatWechsel(-1)">‹</button>
                <p style="margin:0; font-weight:700;">${monatsNamen[m.month]} ${m.year}</p>
                <button class="btn btn-sm" onclick="glasKundeErlMonatWechsel(1)">›</button>
              </div>
              ${!cache
                ? `<p class="muted"><span class="spinner"></span> Lade Verlauf...</p>`
                : imMonat.length
                  ? `<p class="muted" style="margin:0 0 2px; font-size:12.5px;">${imMonat.length} Schein${imMonat.length === 1 ? "" : "e"} erledigt</p>` + imMonat.map(zeile).join("")
                  : `<p class="muted" style="margin:10px 0 4px;">Im ${monatsNamen[m.month]} ${m.year} wurde nichts erledigt.</p>`}
            </div>`;
        }

        const gefiltert = (glasKundeObjFilter === "alle" ? objekte : objekte.filter((o) => glasKundeObjKategorie(o) === glasKundeObjFilter))
          .slice()
          .sort((a, b) => (glasKundeObjSortRang(a) - glasKundeObjSortRang(b)) || a.name.localeCompare(b.name, "de"));
        return `${chips}
          ${gefiltert.length
            ? `<div class="glas-objekt-cards">${gefiltert.map((o) => renderGlasObjektKarte(o, { auswahl: glasAuswahl.modus === "objekte" })).join("")}</div>`
            : `<div class="card"><p class="muted" style="padding:8px 0;">Kein Objekt in dieser Kategorie.</p></div>`}`;
      })()}
      <div style="display:flex; gap:8px; margin-top:14px;">
        <button class="btn btn-primary" onclick="editGlasObjekt(null, {presetKundeId:'${k.id}', returnTo:{type:'kunde', id:'${k.id}'}})">+ Neues Objekt für diesen Kunden</button>
        ${objekte.length && glasAuswahl.modus !== "objekte" ? `<button class="btn btn-sm" title="Mehrere auswählen" onclick="glasAuswahlStart('objekte')">☑️ Auswählen</button>` : ""}
      </div>
    `}
  `;
}

function renderKundeTermine(kundeId) {
  const cached = glasKundeTermineCache[kundeId];
  if (!cached) return `<p class="muted"><span class="spinner"></span> Lade Termine...</p>`;

  // Anstehend = noch OFFENE Stopps in aktiven Touren (egal welches Datum - solange nicht
  //   unterschrieben, steht es an, auch wenn das Tour-Datum schon vorbei ist).
  // Erledigt = NUR wirklich unterschriebene / als unterschrieben markierte Scheine.
  // "Nicht geschafft" wird bewusst NICHT gezeigt - diese Objekte sind über die
  //   Fällig-/Überfällig-Logik automatisch zurückgestuft.
  const anstehend = cached.filter((s) => s.status === "offen")
    .sort((a, b) => (a.glas_touren?.datum || "9999").localeCompare(b.glas_touren?.datum || "9999"));
  const erledigt = cached.filter((s) => s.status === "erledigt")
    .sort((a, b) => (glasSignaturDatum(b) || "").localeCompare(glasSignaturDatum(a) || ""));

  if (!anstehend.length && !erledigt.length) return `<p class="muted">Noch keine Termine für diesen Kunden.</p>`;

  const rowAnstehend = (s) => `
      <div style="display:flex; align-items:center; gap:12px; padding:11px 0; border-top:1px solid var(--border);">
        <span style="width:4px; align-self:stretch; border-radius:2px; background:#e8833a;"></span>
        <div style="flex:1; min-width:0;${s.objekt_id ? " cursor:pointer;" : ""}" ${s.objekt_id ? `onclick="goGlasObjekt('${s.objekt_id}')"` : ""}>
          <p style="margin:0; font-weight:500;">${escapeHtml(s.objekt)}${s.glas_touren?.frei ? ` <span class="badge badge-open" style="font-size:10px;">Blanko</span>` : ""}</p>
          <p class="muted" style="margin:2px 0 0; font-size:12.5px;">${s.glas_touren?.datum ? formatGlasDateRange(s.glas_touren.datum, s.glas_touren.datum_bis) : "ohne Datum"}${s.glas_touren?.name ? " · " + escapeHtml(s.glas_touren.name) : ""}</p>
        </div>
        <span class="badge" style="background:#fdeede; color:#b26a08;">Anstehend</span>
      </div>`;

  const rowErledigt = (s) => {
    const manuell = !s.unterschrift && s.manuell_erledigt_am;
    return `
      <div style="display:flex; align-items:center; gap:12px; padding:11px 0; border-top:1px solid var(--border);">
        <span style="width:4px; align-self:stretch; border-radius:2px; background:#2e9e4f;"></span>
        <div style="flex:1; min-width:0;${s.objekt_id ? " cursor:pointer;" : ""}" ${s.objekt_id ? `onclick="goGlasObjekt('${s.objekt_id}')"` : ""}>
          <p style="margin:0; font-weight:500;">${escapeHtml(s.objekt)}${s.glas_touren?.frei ? ` <span class="badge badge-open" style="font-size:10px;">Blanko</span>` : ""}</p>
          <p class="muted" style="margin:2px 0 0; font-size:12.5px;">${formatGlasDate(glasSignaturDatum(s))}${manuell ? " · ✔️ als unterschrieben markiert" : s.name ? " · ✓ " + escapeHtml(s.name) : ""}${s.glas_touren?.name ? " · " + escapeHtml(s.glas_touren.name) : ""}</p>
        </div>
        <span class="badge badge-signed">Erledigt</span>
      </div>`;
  };

  return `
    ${anstehend.length ? `<p class="glas-section-title">Anstehend (${anstehend.length})</p><div class="card" style="padding:4px 18px;">${anstehend.map(rowAnstehend).join("")}</div>` : ""}
    ${erledigt.length ? `<p class="glas-section-title">Erledigt (${erledigt.length})</p><div class="card" style="padding:4px 18px;">${erledigt.map(rowErledigt).join("")}</div>` : ""}
  `;
}

/* ========================================================================
   Objekt-Formular (eigenständige Seite, nicht mehr in einem Reiter)
   ======================================================================== */

function editGlasObjekt(id, opts) {
  opts = opts || {};
  glasKundePickerOpen = false;
  glasKundePickerSearch = "";
  if (id === null) {
    const kunde = glasKunden.find((k) => k.id === opts.presetKundeId) || glasKunden[0];
    glasObjektEditing = {
      id: null,
      kunde_id: kunde ? kunde.id : "",
      kunde_name: kunde ? kunde.name : "",
      kunde_adresse: kunde ? [kunde.name, kunde.adresse].filter(Boolean).join("\n") : "",
      name: "",
      adresse: "",
      kdnr: "",
      ansprechpartner: "",
      telefon: "",
      hinweise: "",
      notiz: "",
      template: "geko",
      positionen: [glasLeerePosition()],
    };
  } else {
    const o = glasObjekte.find((x) => x.id === id);
    glasObjektEditing = {
      ...o,
      positionen: glasGetObjektPositionen(id).map((p) => ({ ...p, custom: !!p.art && !glasPositionen.some((sp) => sp.name === p.art) })),
    };
  }
  glasObjektFormReturn = opts.returnTo || (glasObjektEditing.kunde_id ? { type: "kunde", id: glasObjektEditing.kunde_id } : { type: "tabs", tab: "kunden" });
  glasNavigate({ type: "objekt-form" });
}

function glasLeerePosition() {
  return {
    id: null, nr: "", art: "", qm: "",
    intervall_typ: "", intervall_wochen: null, feste_monate: "", letzte_reinigung: null, faelligkeit_override: null,
    custom: false,
  };
}

function cancelGlasObjektEdit() {
  glasObjektEditing = null;
  glasNavigate(glasObjektFormReturn || { type: "tabs", tab: "kunden" });
}

function renderObjektForm() {
  const o = glasObjektEditing;
  const { strasse, plz, ort } = glasSplitAdresse(o.adresse);

  return `
    <button class="btn btn-sm" style="margin:16px 0;" onclick="cancelGlasObjektEdit()">&larr; Zurück</button>
    <div class="card">
      <h2>${o.id ? "Objekt bearbeiten" : "Neues Objekt"}</h2>
      ${glasKunden.length ? "" : `<p class="muted">Noch keine Kunden angelegt. Erst im Reiter "Kunden" einen Kunden anlegen.</p>`}
      ${renderKundePicker(o.kunde_id, o.kunde_name)}
      <div class="field">
        <label class="muted">Kunde-Adresse (Briefkopf oben links auf dem Schein)</label>
        <textarea id="o_kunde_adresse" rows="4" placeholder="Zweckverband Katholische Tageseinrichtungen für Kinder
Im Gildehof 8
45127 Essen">${escapeHtml(o.kunde_adresse)}</textarea>
      </div>
      <div class="field">
        <label class="muted">Objekt-Name</label>
        <input type="text" id="o_name" value="${escapeHtml(o.name)}" placeholder="z.B. Objekt Musterstraße / Nr. 12" />
      </div>
      <div class="field">
        <label class="muted">Straße + Hausnummer</label>
        <input type="text" id="o_strasse" value="${escapeHtml(strasse)}" placeholder="Goldhammer Straße 14a" />
      </div>
      <div class="row">
        <div class="field">
          <label class="muted">PLZ</label>
          <input type="text" id="o_plz" value="${escapeHtml(plz)}" placeholder="44793" />
        </div>
        <div class="field" style="flex:2;">
          <label class="muted">Ort</label>
          <input type="text" id="o_ort" value="${escapeHtml(ort)}" placeholder="Bochum" />
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label class="muted">Zusätzliche Dietrich Kd.-Nr. (optional)</label>
          <input type="text" id="o_kdnr" value="${escapeHtml(o.kdnr)}" placeholder="3806 590 00" />
          <p class="muted" style="margin:4px 0 0; font-size:11.5px;">Erscheint nur auf Scheinen mit dem Dietrich-Template. Leer lassen = Haupt-Kd.-Nr. des Kunden wird verwendet. Das GEKO-Template nutzt immer die Haupt-Kd.-Nr.</p>
        </div>
      </div>
      <div class="field">
        <label class="muted">Schein-Vorlage (wird bei Touren &amp; Scheinen automatisch vorausgewählt)</label>
        <select id="o_template" style="width:auto;">
          <option value="geko" ${o.template === "sub" ? "" : "selected"}>GEKO Clean</option>
          <option value="sub" ${o.template === "sub" ? "selected" : ""}>Dietrich (SUB)</option>
        </select>
      </div>
      <div class="row">
        <div class="field">
          <label class="muted">Ansprechpartner (A.P.), optional</label>
          <input type="text" id="o_ansprechpartner" value="${escapeHtml(o.ansprechpartner || "")}" placeholder="z.B. Frau Müller" />
        </div>
        <div class="field">
          <label class="muted">Telefon, optional</label>
          <input type="text" id="o_telefon" value="${escapeHtml(o.telefon || "")}" placeholder="0234 12345" />
        </div>
      </div>
      <div class="field">
        <label class="muted">Hinweise für Mitarbeiter (optional)</label>
        <textarea id="o_hinweise" rows="2" placeholder="z.B. Zugangscode 4711, Hausmeister nur bis 14 Uhr, Parken im Hof">${escapeHtml(o.hinweise || "")}</textarea>
        <p class="muted" style="margin:4px 0 0; font-size:11.5px;">Erscheint deutlich sichtbar am Tour-Stopp in der Mitarbeiter-Ansicht – aber nur, wenn hier etwas steht.</p>
      </div>
      <div class="field">
        <label class="muted">Standard-Tour-Notiz (optional)</label>
        <textarea id="o_notiz" rows="2" placeholder="z.B. Schlüssel beim Hausmeister abholen">${escapeHtml(o.notiz || "")}</textarea>
        <p class="muted" style="margin:4px 0 0; font-size:11.5px;">📝 Erscheint automatisch bei <b>jeder neuen Tour</b> mit diesem Objekt als Stopp-Notiz (Häkchen ist dann schon gesetzt) – im Tour-Formular änderbar.</p>
      </div>
      <label class="muted">Positionen &amp; Intervalle</label>
      ${renderPositionenRows(o.positionen)}
      <button class="btn btn-sm" style="margin:8px 0 4px;" onclick="addPositionRow()">+ Position hinzufügen</button>
      <div style="display:flex; gap:8px; margin-top:12px;">
        <button class="btn btn-primary" onclick="saveGlasObjekt()" ${glasBusy ? "disabled" : ""}>
          ${glasBusy ? `<span class="spinner"></span> ${escapeHtml(glasProgressText || "Speichere...")}` : "Speichern"}
        </button>
        <button class="btn btn-sm" onclick="cancelGlasObjektEdit()">Abbrechen</button>
        ${o.id ? `<button class="btn btn-sm" style="color:var(--danger); margin-left:auto;" onclick="deleteGlasObjekt('${o.id}')">Löschen</button>` : ""}
      </div>
    </div>
  `;
}

const GLAS_CUSTOM_POS = "__custom__";

// Gemeinsamer Dropdown-Options-Baustein für die Positionsauswahl - genutzt vom
// Objekt-Formular (renderPositionenRows) UND vom Einzelschein-Formular (renderEsPositionenRows),
// damit man überall entweder eine vorgespeicherte Position wählt oder manuell eine einträgt.
function glasPositionSelectOptions(pos) {
  const placeholder = !pos.art && !pos.custom ? `<option value="" selected disabled>Position wählen...</option>` : "";
  const gespeichert = glasPositionen
    .map((p) => `<option value="${escapeHtml(p.name)}" data-nr="${escapeHtml(p.nr || "")}" ${!pos.custom && p.name === pos.art ? "selected" : ""}>${p.nr ? `Pos. ${escapeHtml(p.nr)} – ` : ""}${escapeHtml(p.name)}</option>`)
    .join("");
  const custom = `<option value="${GLAS_CUSTOM_POS}" ${pos.custom ? "selected" : ""}>✏️ Eigene Position eintragen</option>`;
  return placeholder + gespeichert + custom;
}

function renderPositionenRows(positionen) {
  const positionenOptions = glasPositionSelectOptions;

  return positionen
    .map((pos, i) => {
      const faellig = glasFaelligkeitStatus(pos);
      return `
      <div class="card glas-pos-row" style="padding:14px 40px 14px 14px; margin-bottom:10px; background:var(--bg);">
        ${positionen.length > 1 ? `<button type="button" class="glas-pos-remove" title="Position entfernen" onclick="removePositionRow(${i})">✕</button>` : ""}
        <div class="row" style="align-items:flex-end; margin-bottom:8px;">
          <div class="field" style="flex:2; margin-bottom:0;">
            <label class="muted">Position</label>
            <select id="pos_art_${i}" onchange="onGlasPositionArtChange(${i})">${positionenOptions(pos)}</select>
          </div>
          <div class="field" style="flex:1; margin-bottom:0;">
            <label class="muted">QM</label>
            <input type="text" id="pos_qm_${i}" value="${escapeHtml(pos.qm)}" placeholder="144,50" />
          </div>
        </div>
        ${pos.custom ? `
        <div class="row" style="align-items:flex-end; margin-bottom:8px;">
          <div class="field" style="flex:0 0 70px; margin-bottom:0;">
            <label class="muted">Nr. (optional)</label>
            <input type="text" id="pos_custom_nr_${i}" value="${escapeHtml(pos.nr)}" placeholder="–" />
          </div>
          <div class="field" style="flex:2; margin-bottom:0;">
            <label class="muted">Bezeichnung</label>
            <input type="text" id="pos_custom_art_${i}" value="${escapeHtml(pos.art)}" placeholder="z.B. Sonderreinigung Fassade" />
          </div>
        </div>` : (pos.art && pos.nr ? `<p class="muted" style="margin:-2px 0 8px; font-size:11.5px;">Pos.-Nr. ${escapeHtml(pos.nr)}</p>` : "")}
        <div class="row" style="align-items:flex-end;">
          <div class="field" style="flex:1.3; margin-bottom:0;">
            <label class="muted">Intervall</label>
            <select id="pos_ivtyp_${i}" onchange="onGlasIntervallTypChange(${i})">
              <option value="" ${!pos.intervall_typ ? "selected" : ""}>Kein Intervall (rein manuell)</option>
              <option value="rollierend" ${pos.intervall_typ === "rollierend" ? "selected" : ""}>Rollierend (alle X Wochen)</option>
              <option value="feste_monate" ${pos.intervall_typ === "feste_monate" ? "selected" : ""}>Feste Monate</option>
            </select>
          </div>
          ${pos.intervall_typ === "rollierend" ? `
          <div class="field" style="flex:1; margin-bottom:0;">
            <label class="muted">Alle X Wochen</label>
            <input type="text" id="pos_ivw_${i}" value="${escapeHtml(pos.intervall_wochen || "")}" placeholder="z.B. 12" />
          </div>` : ""}
          ${pos.intervall_typ === "feste_monate" ? `
          <div class="field" style="flex:1.6; margin-bottom:0;">
            <label class="muted">Monate (1-12, kommagetrennt)</label>
            <input type="text" id="pos_ivm_${i}" value="${escapeHtml(pos.feste_monate || "")}" placeholder="z.B. 3,6,9,12" />
          </div>` : ""}
        </div>
        ${pos.intervall_typ ? `
        <p class="muted" style="margin:8px 0 0; font-size:12px;">
          Zuletzt: ${pos.letzte_reinigung ? formatGlasDate(pos.letzte_reinigung) : "noch nie"}
          ${faellig.faelligkeit ? ` · ${glasStatusLabel(faellig.status)}: ${faellig.label}` : ""}
        </p>` : ""}
      </div>`;
    })
    .join("");
}

function onGlasPositionArtChange(i) {
  syncObjektFormFromDom();
  const select = document.getElementById(`pos_art_${i}`);
  const val = select.value;
  const pos = glasObjektEditing.positionen[i];
  if (val === GLAS_CUSTOM_POS) {
    pos.custom = true;
    pos.art = "";
    pos.nr = "";
  } else {
    pos.custom = false;
    pos.art = val;
    pos.nr = select.options[select.selectedIndex]?.getAttribute("data-nr") || pos.nr;
  }
  renderGlasAdmin();
}

function onGlasIntervallTypChange(i) {
  syncObjektFormFromDom();
  glasObjektEditing.positionen[i].intervall_typ = document.getElementById(`pos_ivtyp_${i}`).value;
  renderGlasAdmin();
}

function syncPositionenFromDom() {
  if (!glasObjektEditing) return;
  glasObjektEditing.positionen = glasObjektEditing.positionen.map((pos, i) => ({
    ...pos,
    nr: pos.custom ? (document.getElementById(`pos_custom_nr_${i}`)?.value.trim() ?? pos.nr) : pos.nr,
    art: pos.custom ? (document.getElementById(`pos_custom_art_${i}`)?.value.trim() ?? pos.art) : pos.art,
    qm: document.getElementById(`pos_qm_${i}`)?.value.trim() ?? pos.qm,
    intervall_typ: document.getElementById(`pos_ivtyp_${i}`)?.value ?? pos.intervall_typ,
    intervall_wochen: document.getElementById(`pos_ivw_${i}`) ? (parseInt(document.getElementById(`pos_ivw_${i}`).value, 10) || null) : pos.intervall_wochen,
    feste_monate: document.getElementById(`pos_ivm_${i}`) ? document.getElementById(`pos_ivm_${i}`).value.trim() : pos.feste_monate,
  }));
}

// Liest ALLE Formularfelder aus dem DOM zurück in glasObjektEditing, bevor renderGlasAdmin()
// das Formular neu aufbaut - sonst gehen bereits eingetippte Werte (Name, Adresse, ...)
// verloren, sobald z.B. eine Position hinzugefügt/entfernt wird (renderObjektForm baut das
// Formular immer aus glasObjektEditing neu auf, nicht aus dem aktuellen DOM-Zustand).
function syncObjektFormFromDom() {
  if (!glasObjektEditing) return;
  syncPositionenFromDom();
  const get = (id) => document.getElementById(id)?.value;
  if (get("o_kunde_adresse") !== undefined) glasObjektEditing.kunde_adresse = get("o_kunde_adresse");
  if (get("o_name") !== undefined) glasObjektEditing.name = get("o_name");
  if (get("o_kdnr") !== undefined) glasObjektEditing.kdnr = get("o_kdnr");
  if (get("o_ansprechpartner") !== undefined) glasObjektEditing.ansprechpartner = get("o_ansprechpartner");
  if (get("o_telefon") !== undefined) glasObjektEditing.telefon = get("o_telefon");
  if (get("o_hinweise") !== undefined) glasObjektEditing.hinweise = get("o_hinweise");
  if (get("o_notiz") !== undefined) glasObjektEditing.notiz = get("o_notiz");
  if (get("o_template") !== undefined) glasObjektEditing.template = get("o_template");
  const strasse = get("o_strasse");
  const plz = get("o_plz");
  const ort = get("o_ort");
  if (strasse !== undefined) glasObjektEditing.adresse = glasJoinAdresse(strasse, plz || "", ort || "");
}

function addPositionRow() {
  syncObjektFormFromDom();
  glasObjektEditing.positionen.push(glasLeerePosition());
  renderGlasAdmin();
}

function removePositionRow(idx) {
  syncObjektFormFromDom();
  glasObjektEditing.positionen.splice(idx, 1);
  renderGlasAdmin();
}

async function saveGlasObjekt() {
  if (glasBusy) return;
  syncObjektFormFromDom();
  const kundeId = glasObjektEditing.kunde_id;
  const kundeName = glasObjektEditing.kunde_name;
  const kundeAdresse = (document.getElementById("o_kunde_adresse")?.value || "").trim();
  const name = document.getElementById("o_name").value.trim();
  const strasse = document.getElementById("o_strasse").value.trim();
  const plz = document.getElementById("o_plz").value.trim();
  const ort = document.getElementById("o_ort").value.trim();
  const kdnr = document.getElementById("o_kdnr").value.trim();
  const ansprechpartner = document.getElementById("o_ansprechpartner").value.trim();
  const telefon = document.getElementById("o_telefon").value.trim();
  const hinweise = document.getElementById("o_hinweise").value.trim();
  const notiz = document.getElementById("o_notiz").value.trim();
  const positionen = glasObjektEditing.positionen.filter((p) => p.art || p.qm);

  if (!kundeId) { showToast("Bitte einen Kunden auswählen"); return; }
  if (!name) { showToast("Bitte einen Objekt-Namen eintragen"); return; }
  if (!strasse || !plz || !ort) { showToast("Bitte Straße, PLZ und Ort eintragen"); return; }

  const adresse = glasJoinAdresse(strasse, plz, ort);
  const geocodeQuery = `${strasse}, ${plz} ${ort}`;

  glasBusy = true;
  glasProgressText = "Adresse wird geocodiert...";
  renderGlasAdmin();

  let coords = { lat: glasObjektEditing.lat, lng: glasObjektEditing.lng };
  const addressChanged = adresse !== glasObjektEditing.adresse;
  let geocodeFailed = false;
  let geocodeApproximate = false;
  if (addressChanged || !coords.lat) {
    try {
      const result = await glasGeocode(geocodeQuery);
      coords = result;
      geocodeApproximate = !!result.approximate;
    } catch (e) {
      coords = { lat: null, lng: null };
      geocodeFailed = true;
    }
  }

  const objektId = glasObjektEditing.id || genCode();
  const payload = {
    id: objektId,
    kunde_id: kundeId,
    kunde_name: kundeName,
    kunde_adresse: kundeAdresse,
    name,
    adresse,
    kdnr,
    ansprechpartner,
    telefon,
    hinweise,
    notiz,
    template: glasObjektEditing.template === "sub" ? "sub" : "geko",
    lat: coords.lat,
    lng: coords.lng,
  };

  const { error } = await sb.from("glas_objekte").upsert(payload);
  if (error) { glasBusy = false; glasProgressText = ""; showToast("Fehler: " + error.message); renderGlasAdmin(); return; }

  // Positionen abgleichen: bestehende Zeilen aktualisieren, neue einfügen,
  // entfernte Zeilen löschen.
  glasProgressText = "Positionen werden gespeichert...";
  renderGlasAdmin();
  const existingIds = glasObjektPositionen.filter((p) => p.objekt_id === objektId).map((p) => p.id);
  const keptIds = positionen.filter((p) => p.id).map((p) => p.id);
  const toDelete = existingIds.filter((id) => !keptIds.includes(id));
  if (toDelete.length) await sb.from("glas_objekt_positionen").delete().in("id", toDelete);

  const posPayload = positionen.map((p, i) => ({
    id: p.id || genCode(),
    objekt_id: objektId,
    nr: p.nr || "",
    art: p.art || "",
    qm: p.qm || "",
    intervall_typ: p.intervall_typ || "",
    intervall_wochen: p.intervall_typ === "rollierend" ? (p.intervall_wochen || null) : null,
    feste_monate: p.intervall_typ === "feste_monate" ? (p.feste_monate || "") : "",
    letzte_reinigung: p.letzte_reinigung || null,
    faelligkeit_override: p.faelligkeit_override || null,
    reihenfolge: i,
  }));
  if (posPayload.length) await sb.from("glas_objekt_positionen").upsert(posPayload);

  glasBusy = false;
  glasProgressText = "";
  if (geocodeFailed) {
    showToast("Objekt gespeichert – Adresse konnte gar nicht gefunden werden (Route setzt es ans Ende)");
  } else if (geocodeApproximate) {
    showToast("Objekt gespeichert – nur ungefähre Position gefunden (Straße evtl. nicht exakt getroffen)");
  } else {
    showToast("Objekt gespeichert");
  }
  glasObjektEditing = null;
  await Promise.all([loadGlasObjekte(), loadGlasObjektPositionen()]);
  goGlasObjekt(objektId);
}

// Löscht Objekte inkl. aller offenen (noch nicht unterschriebenen) Stopps. Touren, die
// dadurch komplett leer werden, verschwinden mit - sonst blieben leere Balken im
// Kalender stehen. Unterschriebene Scheine bleiben als Schnappschuss erhalten.
// Gibt bei Fehler die Fehlermeldung zurück, sonst null.
async function glasDeleteObjekteCascade(objektIds) {
  if (!objektIds.length) return null;
  const { data: stopps, error: stoppErr } = await sb.from("glas_stopps").select("id, tour_id, status, objekt_id").in("objekt_id", objektIds);
  if (stoppErr) return stoppErr.message;
  const offene = (stopps || []).filter((s) => s.status !== "erledigt");
  if (offene.length) {
    const { error } = await sb.from("glas_stopps").delete().in("id", offene.map((s) => s.id));
    if (error) return error.message;
    const tourIds = [...new Set(offene.map((s) => s.tour_id).filter(Boolean))];
    if (tourIds.length) {
      const { data: rest } = await sb.from("glas_stopps").select("id, tour_id").in("tour_id", tourIds);
      const nochBelegt = new Set((rest || []).map((s) => s.tour_id));
      const leere = tourIds.filter((tid) => !nochBelegt.has(tid));
      if (leere.length) await sb.from("glas_touren").delete().in("id", leere);
    }
  }
  await sb.from("glas_objekt_positionen").delete().in("objekt_id", objektIds);
  const { error: objErr } = await sb.from("glas_objekte").delete().in("id", objektIds);
  return objErr ? objErr.message : null;
}

async function deleteGlasObjekt(id) {
  if (!confirm("Dieses Objekt wirklich löschen? Geplante (noch nicht unterschriebene) Termine werden überall mit entfernt, unterschriebene Scheine bleiben erhalten.")) return;
  const kundeId = glasObjekte.find((o) => o.id === id)?.kunde_id;
  const fehler = await glasDeleteObjekteCascade([id]);
  if (fehler) { showToast("Fehler: " + fehler); return; }
  showToast("Objekt gelöscht");
  glasObjektEditing = null;
  await glasReloadNachLoeschen();
  if (kundeId && glasKunden.some((k) => k.id === kundeId)) goGlasKunde(kundeId); else goGlasTab("kunden");
}

/* ========================================================================
   Objekt-Detail-Seite
   ======================================================================== */

function renderObjektDetailPage(id) {
  if (glasObjektEditing !== null) return renderObjektForm();

  const o = glasObjekte.find((x) => x.id === id);
  if (!o) return `<button class="btn btn-sm" style="margin:16px 0;" onclick="goGlasTab('kunden')">&larr; Zurück</button><p class="muted">Objekt nicht gefunden.</p>`;

  if (!glasObjektDetailHistory[id]) loadGlasObjektHistory(id);
  const history = glasObjektDetailHistory[id] || [];
  const signed = history.filter((s) => s.status === "erledigt");
  const positionen = glasGetObjektPositionen(id);

  // "Nächste Reinigung": eingeplante Positionen zählen nicht mehr als offen/überfällig -
  // ist alles Fällige bereits eingeplant, zeigt das Banner "Eingeplant" statt "überfällig"
  const alleEingeplant = positionen.some(glasIstEingeplant) && positionen.filter((p) => !glasIstEingeplant(p)).every((p) => {
    const s = glasFaelligkeitStatus(p).status;
    return s !== "ueberfaellig" && s !== "faellig";
  });
  const naechste = positionen
    .filter((p) => !glasIstEingeplant(p))
    .map((p) => ({ position: p, ...glasFaelligkeitStatus(p) }))
    .filter((s) => s.faelligkeit)
    .sort((a, b) => a.faelligkeit.localeCompare(b.faelligkeit))[0];

  const shown = glasObjektDetailShowAllHistory ? signed : signed.slice(0, 5);
  const alleVerschiebbarIds = positionen.filter((p) => p.intervall_typ && p.id && !glasIstEingeplant(p)).map((p) => p.id);
  const zeigeAlleVerschieben = glasVerschiebeTarget && glasVerschiebeTarget.objektId === o.id && glasVerschiebeTarget.scope === "alle";

  return `
    <button class="btn btn-sm" style="margin:16px 0;" onclick="goGlasKunde('${o.kunde_id}')">&larr; ${escapeHtml(o.kunde_name || "Zurück")}</button>

    <div class="card">
      <p style="margin:0 0 4px; font-weight:700; font-size:19px;">${escapeHtml(o.name)}</p>
      <p class="muted" style="margin:0 0 10px;"><a href="javascript:void(0)" onclick="goGlasKunde('${o.kunde_id}')">${escapeHtml(o.kunde_name || "Ohne Kunde")}</a></p>
      <p style="margin:0; white-space:pre-line;">${escapeHtml(o.adresse)}</p>
      <p class="muted" style="margin:6px 0 0;">Haupt-Kd.-Nr.: ${escapeHtml(glasKunden.find((k) => k.id === o.kunde_id)?.kdnr || "–")}${o.kdnr ? ` · Dietrich Kd.-Nr.: ${escapeHtml(o.kdnr)}` : ""}</p>
      ${o.ansprechpartner ? `<p class="muted" style="margin:4px 0 0;">👤 A.P.: ${escapeHtml(o.ansprechpartner)}</p>` : ""}
      ${o.telefon ? `<p class="muted" style="margin:4px 0 0;">📞 Tel.: <a href="tel:${escapeHtml(o.telefon)}">${escapeHtml(o.telefon)}</a></p>` : ""}
      ${o.hinweise ? `<div class="glas-hinweis-box" style="margin-top:10px;"><span class="glas-hinweis-icon">⚠️</span><div><p class="glas-hinweis-title">Hinweis fürs Team</p><p class="glas-hinweis-text">${escapeHtml(o.hinweise)}</p></div></div>` : ""}
      ${o.notiz ? `<div class="glas-notiz-box" style="margin-top:8px;">📝 ${escapeHtml(o.notiz)}</div>` : ""}
      <div class="glas-quick-actions">
        <button class="btn btn-sm" onclick="glasJetztPlanen('${o.id}', null)">📅 Einplanen</button>
        ${alleVerschiebbarIds.length ? `<button class="btn btn-sm" onclick='glasOpenVerschieben(${JSON.stringify(o.id)}, ${JSON.stringify(alleVerschiebbarIds)}, "alle")'>🔁 Verschieben</button>` : ""}
        <select id="objekt_schein_template_${o.id}" style="width:auto;">
          <option value="geko" ${o.template === "sub" ? "" : "selected"}>Vorlage: GEKO</option>
          <option value="sub" ${o.template === "sub" ? "selected" : ""}>Vorlage: Dietrich</option>
        </select>
        <button class="btn btn-sm" onclick="downloadBlankGlasSchein('${o.id}')">📄 Schein erstellen</button>
        ${o.lat ? `<a class="btn btn-sm" href="https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}" target="_blank">🧭 Navigation</a>` : `<span class="muted">⚠️ Nicht geocodiert</span>`}
      </div>
      ${zeigeAlleVerschieben ? renderVerschiebePicker() : ""}
    </div>

    <div class="card" style="${alleEingeplant ? "background:var(--info-bg); border-color:var(--info-border);" : glasStatusTint(naechste ? naechste.status : null)}">
      <p style="margin:0; font-weight:600;">
        ${alleEingeplant
          ? "📅 In einer Tour eingeplant"
          : naechste
            ? `Nächste Reinigung: ${naechste.label}${naechste.status === "ueberfaellig" ? " (überfällig)" : ""}`
            : "Kein Intervall hinterlegt – rein manuell"}
      </p>
      ${signed.length ? `<p class="muted" style="margin:4px 0 0;">Zuletzt gereinigt: ${formatGlasDate(signed[0].datum)}${signed[0].name ? ` von ${escapeHtml(signed[0].name)}` : (!signed[0].unterschrift && signed[0].manuell_erledigt_am) ? " (als unterschrieben markiert)" : ""}</p>` : ""}
    </div>

    <div class="card">
      <h2>Positionen</h2>
      ${positionen.map((p) => {
        const f = glasFaelligkeitStatus(p);
        const eingeplant = glasIstEingeplant(p);
        return `
        <div style="padding:10px 0; border-top:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <p style="margin:0; font-weight:500;">${p.nr ? `Pos. ${escapeHtml(p.nr)} – ` : ""}${escapeHtml(p.art)} ${p.qm ? `(${escapeHtml(p.qm)} ${glasPosEinheit(p)})` : ""}</p>
            ${eingeplant
              ? `<span class="badge" style="background:var(--info-bg); color:var(--blue);">📅 Eingeplant</span>`
              : f.status && f.status !== "geplant" ? `<span class="badge ${glasStatusBadgeClass(f.status)}">${glasStatusLabel(f.status)}</span>` : ""}
          </div>
          <p class="muted" style="margin:3px 0 0; font-size:12.5px;">${glasIntervallLabel(p)}${f.faelligkeit ? ` · ${f.status === "geplant" ? "fällig" : glasStatusLabel(f.status)}: ${f.label}` : ""}${p.letzte_reinigung ? ` · Zuletzt: ${formatGlasDate(p.letzte_reinigung)}` : ""}</p>
        </div>`;
      }).join("")}
      <button class="btn btn-sm" style="margin-top:12px;" onclick='editGlasObjekt(${JSON.stringify(o.id)}, {returnTo:{type:"objekt", id:${JSON.stringify(o.id)}}})'>Objekt bearbeiten</button>
    </div>

    <div class="card">
      <h2>Verlauf</h2>
      ${!glasObjektDetailHistory[id]
        ? `<p class="muted"><span class="spinner"></span> Lade...</p>`
        : !signed.length
          ? `<p class="muted">Noch nie unterschrieben.</p>`
          : shown.map((s) => {
              const pos = glasStopPositionen(s);
              const istManuellGereinigt = s.manuell_erledigt_am && s.glas_touren?.name === GLAS_MANUELL_CLEAN_NAME;
              const kopf = istManuellGereinigt
                ? `${formatGlasDate(glasSignaturDatum(s))} · ✔️ als gereinigt vermerkt`
                : (!s.unterschrift && s.manuell_erledigt_am)
                  ? `${formatGlasDate(glasSignaturDatum(s))} · ✔️ als unterschrieben markiert`
                  : `${formatGlasDate(glasSignaturDatum(s))} · ${escapeHtml(s.name || "")}`;
              return `
            <div style="padding:10px 0; border-top:1px solid var(--border);">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                <span style="font-size:13.5px; font-weight:600;">${kopf}</span>
                ${istManuellGereinigt
                  ? `<button class="btn btn-sm" style="padding:4px 8px; flex-shrink:0; color:var(--danger);" onclick="glasUndoManuellGereinigt('${id}','${s.id}')">↩️ rückgängig</button>`
                  : `<button class="btn btn-sm" style="padding:4px 8px; flex-shrink:0;" onclick="downloadGlasPdfHistory('${id}','${s.id}')">📄 PDF</button>`}
              </div>
              ${(s.glas_touren?.name && !istManuellGereinigt) ? `<p class="muted" style="margin:2px 0 0; font-size:12px;">🚐 ${escapeHtml(s.glas_touren.name)}</p>` : ""}
              ${pos.length ? `<div style="margin-top:5px; display:flex; flex-direction:column; gap:2px;">${pos.map((p) => `<span class="muted" style="font-size:12px;">• ${escapeHtml(p.art || "")}${p.qm ? ` (${escapeHtml(String(p.qm))} ${glasPosEinheit(p)})` : ""}</span>`).join("")}</div>` : ""}
              ${s.zusatz ? `<p class="muted" style="margin:4px 0 0; font-size:12px;">➕ ${escapeHtml(s.zusatz)}</p>` : ""}
            </div>`; }).join("") + (signed.length > 5 && !glasObjektDetailShowAllHistory
              ? `<button class="btn btn-sm" style="margin-top:10px;" onclick="glasObjektDetailShowAllHistory = true; renderGlasAdmin();">Alle ${signed.length} anzeigen</button>`
              : "")
      }
    </div>

    <div style="display:flex; gap:8px; margin-top:4px;">
      <button class="btn btn-sm" style="color:var(--danger);" onclick="deleteGlasObjekt('${o.id}')">Objekt löschen</button>
    </div>
  `;
}

async function loadGlasObjektHistory(id) {
  const { data, error } = await sb
    .from("glas_stopps")
    .select("*, glas_touren(name, datum, template)")
    .eq("objekt_id", id)
    .order("created_at", { ascending: false });
  glasObjektDetailHistory[id] = error ? [] : data || [];
  renderGlasAdmin();
}

function downloadGlasPdfHistory(objektId, stopId) {
  const s = (glasObjektDetailHistory[objektId] || []).find((x) => x.id === stopId);
  if (!s) return;
  const template = s.glas_touren?.template || "geko";
  const doc = generateGlasPdf(s, template, s.glas_touren?.datum);
  doc.save(glasScheinFilename(s, template));
}

// Erzeugt sofort einen leeren, unterschriftslosen Abnahmeschein direkt von der
// Objekt-Seite aus - ohne dafür erst eine Tour/einen Stopp anzulegen.
function downloadBlankGlasSchein(objektId) {
  const o = glasObjekte.find((x) => x.id === objektId);
  if (!o) return;
  const template = document.getElementById(`objekt_schein_template_${objektId}`)?.value || "geko";
  const positionen = glasGetObjektPositionen(objektId).map((p) => ({ nr: p.nr, art: p.art, qm: p.qm }));
  const s = {
    kunde_adresse: o.kunde_adresse,
    objekt: o.name,
    adresse: o.adresse,
    kdnr: o.kdnr,
    kunde_kdnr: glasKunden.find((k) => k.id === o.kunde_id)?.kdnr || "",
    positionen: JSON.stringify(positionen),
  };
  const doc = generateGlasPdf(s, template, glasTodayIso());
  doc.save(glasScheinFilename(s, template));
  showToast("Schein erstellt");
}

/* ========================================================================
   "Jetzt planen" - Schnellzugriff aus Objekt-Seite / Offener Liste, springt
   direkt in ein vorausgefülltes neues-Tour-Formular.
   ======================================================================== */

// Schein-Vorlage, die für eine Objektauswahl vorausgewählt wird: sind alle gewählten
// Objekte Dietrich-Objekte (template 'sub'), startet die Tour direkt mit Dietrich.
function glasTemplateFuerObjekte(objektIds) {
  const objs = [...objektIds].map((oid) => glasObjekte.find((o) => o.id === oid)).filter(Boolean);
  return objs.length && objs.every((o) => o.template === "sub") ? "sub" : "geko";
}

function glasJetztPlanen(objektId, positionIds) {
  glasTourNotizen = new Map();
  glasTourExtras = new Map();
  const alle = glasGetObjektPositionen(objektId);
  const ids = positionIds || alle.map((p) => p.id || p.nr);
  glasSelectedObjekte = new Set([objektId]);
  glasManualOrder = [objektId];
  glasPreselectPositionen = new Map([[objektId, new Set(ids)]]);
  glasEditingTourId = null;
  glasTourSearch = "";
  glasNewTour = { name: "", datum: glasTodayIso(), datum_bis: "", template: glasTemplateFuerObjekte([objektId]), notiz: "" };
  glasShowEinzelschein = false;
  glasTourDetailId = null;
  glasShowNewTourForm = true;
  glasNavigate({ type: "tabs", tab: "touren" });
}

/* ========================================================================
   Weitere Einstellungen (Benachrichtigungen + Positionen + Archiv als Kacheln)
   ======================================================================== */

let glasEinstellungen = { id: "default", standort_adresse: "", standort_lat: null, standort_lng: null };

async function loadGlasEinstellungen() {
  // localStorage zuerst (funktioniert immer, auch wenn die Supabase-Tabelle fehlt),
  // Supabase überschreibt danach, wenn vorhanden - so sind die Einstellungen geräteübergreifend
  // UND lokal sofort da.
  try {
    const local = JSON.parse(localStorage.getItem("glas_einstellungen") || "null");
    if (local) glasEinstellungen = local;
  } catch (e) {}
  const { data, error } = await sb.from("glas_einstellungen").select("*").eq("id", "default").limit(1);
  if (!error && data && data[0]) glasEinstellungen = data[0];
}

// Die drei Bereiche stehen als einklappbare Kacheln da (statt alles auf einmal auszubreiten)
// - antippen öffnet/schließt jeweils nur einen Bereich.
let glasEinstellungenOpen = null; // null | "standort" | "positionen" | "archiv"

function glasToggleEinstellungenSection(key) {
  glasEinstellungenOpen = glasEinstellungenOpen === key ? null : key;
  renderGlasAdmin();
}

function renderEinstellungenKachel(key, titel, inhaltHtml) {
  const open = glasEinstellungenOpen === key;
  return `
    <div class="card glas-settings-tile" style="margin-top:16px;">
      <div class="glas-settings-tile-head" onclick="glasToggleEinstellungenSection('${key}')">
        <p style="margin:0; font-weight:600;">${titel}</p>
        <span class="glas-settings-tile-chevron${open ? " open" : ""}">›</span>
      </div>
      ${open ? `<div class="glas-settings-tile-body">${inhaltHtml}</div>` : ""}
    </div>`;
}

function renderEinstellungenTab() {
  // Die reine Kalender-App zeigt nur die für sie relevanten Einstellungen
  // (Design + Benachrichtigungen) - Statistik/Positionen/Archiv sind Glas-Verwaltung.
  if (glasCalApp) {
    return `
      ${renderEinstellungenKachel("darstellung", "🌙 Darstellung", renderDarstellungEinstellung())}
      ${renderEinstellungenKachel("push", "🔔 Benachrichtigungen", renderPushEinstellungen())}
    `;
  }
  return `
    <div class="card" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onclick="glasOpenStatistik()">
      <div>
        <p style="margin:0; font-weight:600;">📊 Statistiken</p>
        <p class="muted" style="margin:3px 0 0;">Gereinigte qm, Objekte, Kunden, beste Tage &amp; Monate</p>
      </div>
      <span style="font-size:18px; color:var(--text-secondary);">›</span>
    </div>
    ${renderEinstellungenKachel("darstellung", "🌙 Darstellung", renderDarstellungEinstellung())}
    ${renderEinstellungenKachel("push", "🔔 Benachrichtigungen", renderPushEinstellungen())}
    ${renderEinstellungenKachel("positionen", "📋 Positionen", renderPositionenTab())}
    ${renderEinstellungenKachel("archiv", "🗑️ Archiv", renderArchivTab())}
  `;
}

/* ---------------- Darstellung: Hell / Dunkel / wie das Handy ---------------- */

function glasGetTheme() {
  try { return localStorage.getItem("geko_theme") || "auto"; } catch (e) { return "auto"; }
}

function glasSetTheme(mode) {
  try { localStorage.setItem("geko_theme", mode); } catch (e) {}
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  document.documentElement.classList.toggle("dark", mode === "dark" || (mode === "auto" && mq.matches));
  renderGlasAdmin();
}

function renderDarstellungEinstellung() {
  const t = glasGetTheme();
  return `
    <p class="muted" style="margin:0 0 10px;">„Automatisch" folgt der Hell-/Dunkel-Einstellung des Handys. Gilt für dieses Gerät auf allen GEKO-Seiten.</p>
    <div class="glas-seg">
      <button class="glas-seg-btn ${t === "auto" ? "on" : ""}" onclick="glasSetTheme('auto')">📱 Automatisch</button>
      <button class="glas-seg-btn ${t === "light" ? "on" : ""}" onclick="glasSetTheme('light')">☀️ Hell</button>
      <button class="glas-seg-btn ${t === "dark" ? "on" : ""}" onclick="glasSetTheme('dark')">🌙 Dunkel</button>
    </div>`;
}

/* ---------------- Benachrichtigungen (nur Admin) ---------------- */

function renderPushEinstellungen() {
  const e = glasEinstellungen || {};
  setTimeout(glasUpdatePushStatus, 80);
  return `
    <p class="muted" style="margin:0 0 6px;">In <b>jeder</b> App (Glasreinigung, Kalender, Graffiti) einmal „aktivieren" antippen – dann bekommt jede App genau ihre eigenen Benachrichtigungen, ohne Doppelungen. iPhone: geht nur, wenn die Seite als App auf dem Home-Bildschirm liegt.</p>
    <p class="muted" style="margin:0 0 10px; font-size:12px;">Dieses Gerät zählt aktuell als: <b>${glasCalApp ? "📅 Kalender-App" : "🪟 Glasreinigung-App"}</b>.</p>
    <button class="btn btn-primary" onclick="glasPushAktivieren()">🔔 Auf diesem Gerät aktivieren</button>
    <p class="muted" id="glasPushStatus" style="margin:8px 0 14px; font-size:12px;"></p>
    <p class="glas-section-title" style="margin:6px 0 2px;">Wovon möchtest du benachrichtigt werden?</p>
    <label style="display:flex; align-items:center; gap:10px; padding:9px 0; border-top:1px solid var(--border); cursor:pointer;">
      <input type="checkbox" style="width:auto;" ${e.push_touren ? "checked" : ""} onchange="glasSavePushSchalter('push_touren', this.checked)" />
      <span style="font-size:13.5px;">🚐 Touren (neu/geändert/archiviert) &middot; <span class="muted">Glasreinigung-App</span></span>
    </label>
    <label style="display:flex; align-items:center; gap:10px; padding:9px 0; border-top:1px solid var(--border); cursor:pointer;">
      <input type="checkbox" style="width:auto;" ${e.push_unterschrift ? "checked" : ""} onchange="glasSavePushSchalter('push_unterschrift', this.checked)" />
      <span style="font-size:13.5px;">✍️ Eingehende Unterschriften &middot; <span class="muted">Glasreinigung-App</span></span>
    </label>
    <label style="display:flex; align-items:center; gap:10px; padding:9px 0; border-top:1px solid var(--border); cursor:pointer;">
      <input type="checkbox" style="width:auto;" ${e.push_kalender ? "checked" : ""} onchange="glasSavePushSchalter('push_kalender', this.checked)" />
      <span style="font-size:13.5px;">📅 Kalender-Termine (neu/geändert/gelöscht) &middot; <span class="muted">Kalender-App</span></span>
    </label>
    <p class="muted" style="margin:10px 0 0; font-size:12px;">⏰ Termin-Erinnerungen stellst du direkt am jeweiligen Termin ein – sie kommen morgens gegen 8 Uhr in der Kalender-App an.</p>
  `;
}

async function glasPushAktivieren() {
  if (typeof enablePushNotifications !== "function") { showToast("Push-Skript nicht geladen"); return; }
  await enablePushNotifications(glasPushRole());
  glasUpdatePushStatus();
}

async function glasUpdatePushStatus() {
  const el = document.getElementById("glasPushStatus");
  if (!el) return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    el.textContent = "❌ Auf diesem Gerät/Browser nicht unterstützt (iPhone: Seite als Home-Bildschirm-App öffnen).";
    return;
  }
  if (typeof Notification !== "undefined" && Notification.permission === "denied") {
    el.textContent = "🚫 Benachrichtigungen sind in den Geräte-Einstellungen blockiert.";
    return;
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration("sw.js");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    el.textContent = sub
      ? "✅ Auf diesem Gerät aktiv – erneuert sich bei jedem Öffnen von selbst."
      : "Auf diesem Gerät noch nicht aktiviert.";
  } catch (e) { el.textContent = ""; }
}

async function glasSavePushSchalter(schalter, wert) {
  glasEinstellungen = { ...(glasEinstellungen || {}), id: "default", [schalter]: wert };
  try { localStorage.setItem("glas_einstellungen", JSON.stringify(glasEinstellungen)); } catch (e) {}
  const { error } = await sb.from("glas_einstellungen").upsert({ id: "default", [schalter]: wert });
  if (error) { showToast("Fehler: " + error.message + " (neueste SQL-Datei schon ausgeführt?)"); return; }
  showToast(wert ? "Eingeschaltet – bleibt dauerhaft an" : "Ausgeschaltet");
}

let glasPositionEditingId = null; // null = keine Bearbeitung, "" = neu, sonst id

function renderPositionenTab() {
  const list = glasPositionen.length
    ? glasPositionen
        .map(
          (p) => `
        <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
          ${glasPositionEditingId === p.id ? `
            <div style="display:flex; gap:8px; flex:1; margin-right:10px;">
              <input type="text" id="pos_edit_nr_${p.id}" value="${escapeHtml(p.nr || "")}" placeholder="Nr. (optional)" style="flex:0 0 60px;" />
              <input type="text" id="pos_edit_${p.id}" value="${escapeHtml(p.name)}" />
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-sm btn-primary" onclick="saveGlasPosition('${p.id}')">Speichern</button>
              <button class="btn btn-sm" onclick="glasPositionEditingId = null; renderGlasAdmin();">Abbrechen</button>
            </div>
          ` : `
            <p style="margin:0; font-weight:500;">${p.nr ? `Pos. ${escapeHtml(p.nr)} – ` : ""}${escapeHtml(p.name)}</p>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-sm" onclick="glasPositionEditingId = '${p.id}'; renderGlasAdmin();">Bearbeiten</button>
              <button class="btn btn-sm" style="color:var(--danger);" onclick="deleteGlasPosition('${p.id}')">Löschen</button>
            </div>
          `}
        </div>`
        )
        .join("")
    : `<p class="muted">Noch keine Positionen angelegt.</p>`;

  return `
    <p class="muted" style="margin:0 0 10px; font-weight:600;">Neue Position</p>
    <p class="muted" style="margin:0 0 10px;">Leistungsarten mit fester Standard-Positionsnummer (z.B. Pos. 10 Glas- und Rahmenreinigung, Pos. 15 Hubsteigereinsatz). Wird beim Objekt einfach ausgewählt.</p>
    <div style="display:flex; gap:8px; margin-bottom:14px;">
      <input type="text" id="pos_new_nr" placeholder="Nr." style="flex:0 0 60px;" value="" />
      <input type="text" id="pos_new_name" placeholder="z.B. Grundreinigung" />
      <button class="btn btn-primary" onclick="addGlasPosition()">+ Hinzufügen</button>
    </div>
    ${list}
  `;
}

async function addGlasPosition() {
  const nameInput = document.getElementById("pos_new_name");
  const nrInput = document.getElementById("pos_new_nr");
  const name = nameInput.value.trim();
  const nr = nrInput.value.trim();
  if (!name) { showToast("Bitte einen Namen eintragen"); return; }
  const { error } = await sb.from("glas_positionen").insert({ id: genCode(), name, nr });
  if (error) { showToast("Fehler: " + error.message); return; }
  nameInput.value = "";
  nrInput.value = "";
  await loadGlasPositionen();
  renderGlasAdmin();
}

async function saveGlasPosition(id) {
  const name = document.getElementById(`pos_edit_${id}`).value.trim();
  const nr = document.getElementById(`pos_edit_nr_${id}`).value.trim();
  if (!name) { showToast("Bitte einen Namen eintragen"); return; }
  const { error } = await sb.from("glas_positionen").update({ name, nr }).eq("id", id);
  if (error) { showToast("Fehler: " + error.message); return; }
  glasPositionEditingId = null;
  await loadGlasPositionen();
  renderGlasAdmin();
}

async function deleteGlasPosition(id) {
  if (!confirm("Diese Position wirklich löschen?")) return;
  const { error } = await sb.from("glas_positionen").delete().eq("id", id);
  if (error) { showToast("Fehler: " + error.message); return; }
  await loadGlasPositionen();
  renderGlasAdmin();
}

/* ========================================================================
   Touren-Tab
   ======================================================================== */

let glasTourDetailStops = [];

function renderTourenTab() {
  if (glasTourDetailId) return renderTourDetailView();
  if (glasShowEinzelschein) return renderEinzelscheinForm();
  if (glasShowNewTourForm) return renderNewTourForm();
  return renderTourenListView();
}

// Eine Tour ist ABGESCHLOSSEN, sobald kein Stopp mehr "offen" ist - jeder Stopp ist
// also entweder unterschrieben ("erledigt") oder bewusst als "nicht geschafft" markiert.
// So bleibt eine Tour, bei der 2 von 7 nicht geschafft wurden, nicht ewig als offen
// hängen, sondern gilt als durch (wandert ins Erledigt, verschwindet am Folgetag bei den MA).
function glasTourAllDone(t) {
  const stops = t.glas_stopps || [];
  return stops.length > 0 && stops.every((s) => s.status === "erledigt" || s.status === "nicht_geschafft");
}
// Nur die wirklich unterschriebenen Stopps (für "X erledigt"-Zähler)
function glasTourZaehler(t) {
  const stops = t.glas_stopps || [];
  return {
    gesamt: stops.length,
    erledigt: stops.filter((s) => s.status === "erledigt").length,
    nichtGeschafft: stops.filter((s) => s.status === "nicht_geschafft").length,
    offen: stops.filter((s) => s.status === "offen").length,
  };
}

function renderTourenCard(t) {
  const z = glasTourZaehler(t);
  const allDone = glasTourAllDone(t);
  const auswahl = glasAuswahl.modus === "touren";
  const total = z.gesamt;
  const done = z.erledigt;
  const farbe = glasTourKalenderFarbe(t);
  const pill = allDone
    ? `<span class="gtc-pill p-ok">Fertig</span>`
    : done ? `<span class="gtc-pill p-run">Läuft</span>` : `<span class="gtc-pill p-plan">Geplant</span>`;
  const leading = auswahl
    ? `<span class="glas-pick ${glasAuswahl.ids.has(t.id) ? "on" : ""}"></span>`
    : total ? glasMiniRing(done, total)
    : `<div class="gtc-ic" style="background:${farbe}22; color:${farbe};">${t.frei ? "📄" : "🚐"}</div>`;
  return `
    <div class="glas-tour-card" onclick="${auswahl ? `glasAuswahlToggle('${t.id}')` : `openGlasTourDetail('${t.id}')`}">
      <div class="gtc-row">
        ${leading}
        <div class="gtc-grow">
          <p class="gtc-name">${t.name ? escapeHtml(t.name) : formatGlasDateRange(t.datum, t.datum_bis)}${t.ma_versteckt ? ` <span class="badge" style="background:var(--border); color:var(--text-secondary); font-size:10px;">🙈</span>` : ""}</p>
          <p class="gtc-meta">${formatGlasDateRange(t.datum, t.datum_bis)}${total ? ` · ${done}/${total} erledigt` : ""}${z.nichtGeschafft ? ` · ${z.nichtGeschafft} nicht geschafft` : ""}${t.frei ? " · Einzelschein" : ""}</p>
        </div>
        ${pill}
      </div>
      ${t.notiz ? `<div class="gtc-notiz">📝 ${escapeHtml(t.notiz)}</div>` : ""}
    </div>`;
}

function renderTourenListView() {
  const aktiv = glasTouren.filter((t) => !t.archiviert_am);
  const offen = aktiv.filter((t) => !glasTourAllDone(t)).sort((a, b) => (a.datum || "9999").localeCompare(b.datum || "9999"));
  const erledigt = aktiv.filter((t) => glasTourAllDone(t)).sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));

  return `
    <div style="display:flex; gap:8px; margin:16px 0;">
      <button class="btn btn-primary" onclick="glasStartNewTourForm();">+ Neue Tour anlegen</button>
      <button class="btn btn-sm" onclick="openGlasEinzelschein()">+ Blanko erstellen</button>
      ${(offen.length || erledigt.length) && glasAuswahl.modus !== "touren" ? `<button class="btn btn-sm" title="Mehrere auswählen" style="margin-left:auto;" onclick="glasAuswahlStart('touren')">☑️</button>` : ""}
    </div>
    ${glasAuswahl.modus === "touren" ? glasAuswahlLeiste() : ""}
    ${offen.length ? offen.map(renderTourenCard).join("") : `<p class="muted">Keine offenen Touren.</p>`}
    ${erledigt.length ? `
      <p class="glas-section-title" style="cursor:pointer;" onclick="glasTourenErledigtExpanded = !glasTourenErledigtExpanded; renderGlasAdmin();">
        ✓ Erledigte Touren (${erledigt.length}) ${glasTourenErledigtExpanded ? "▲" : "▼"}
      </p>
      ${glasTourenErledigtExpanded ? erledigt.map(renderTourenCard).join("") : ""}` : ""}
  `;
}

function glasStartNewTourForm() {
  glasTourNotizen = new Map();
  glasTourExtras = new Map();
  glasShowNewTourForm = true;
  glasEditingTourId = null;
  glasManualOrder = [];
  glasSelectedObjekte.clear();
  glasPreselectPositionen = null;
  glasTourSearch = "";
  glasNewTour = { name: "", datum: glasTodayIso(), datum_bis: "", template: "geko", notiz: "" };
  renderGlasAdmin();
}

function renderArchivTab() {
  const archiv = glasTouren.filter((t) => t.archiviert_am);
  if (!archiv.length) return `<p class="muted">Das Archiv ist leer.</p>`;
  return `
    <p class="muted" style="margin:0 0 12px;">Gelöschte Touren bleiben hier, bis du sie endgültig löschst.</p>
    ${archiv.map((t) => `
      <div class="card" style="opacity:0.75;">
        <p style="margin:0 0 4px; font-weight:600;">${t.name ? escapeHtml(t.name) : formatGlasDateRange(t.datum, t.datum_bis)}</p>
        <p class="muted" style="margin:0 0 10px;">${formatGlasDateRange(t.datum, t.datum_bis)}</p>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-sm" onclick="restoreGlasTour('${t.id}')">↩️ Wiederherstellen</button>
          <button class="btn btn-sm" style="color:var(--danger);" onclick="deleteGlasTourEndgueltig('${t.id}')">Endgültig löschen</button>
        </div>
      </div>`).join("")}
  `;
}

async function openGlasTourDetail(tourId) {
  glasTourDetailId = tourId;
  glasTourDetailStops = [];
  glasMergePickerFor = null;
  renderGlasAdmin();
  const { data, error } = await sb
    .from("glas_stopps")
    .select("*")
    .eq("tour_id", tourId)
    .order("reihenfolge", { ascending: true });
  if (!error) glasTourDetailStops = data || [];
  renderGlasAdmin();
}

function closeGlasTourDetail() {
  glasTourDetailId = null;
  glasTourDetailStops = [];
  glasMergePickerFor = null;
  renderGlasAdmin();
}

// Kompakte Vorschau der geplanten Positionen eines Stopps: zeigt in der Tour-Ansicht
// auf einen Blick, WAS genau eingeplant wurde (Nr · Art · qm), ohne den Stopp zu öffnen.
function renderStopPositionenVorschau(s) {
  const pos = glasStopPositionen(s);
  if (!pos.length) return "";
  return `<div class="glas-stop-positionen">${pos.map((p) => `
    <div class="glas-stop-pos-row">
      <span class="glas-stop-pos-nr">${escapeHtml(p.nr || "–")}</span>
      <span style="flex:1; min-width:0;">${escapeHtml(p.art || "")}</span>
      ${p.qm ? `<span class="muted" style="flex-shrink:0;">${escapeHtml(String(p.qm))} ${glasPosEinheit(p)}</span>` : glasIstStundenPos(p) ? `<span class="muted" style="flex-shrink:0;">Std. vor Ort</span>` : ""}
    </div>`).join("")}</div>`;
}

function renderTourDetailView() {
  const t = glasTouren.find((x) => x.id === glasTourDetailId);
  if (!t) return `<p class="muted">Tour nicht gefunden.</p>`;

  const done = glasTourDetailStops.filter((s) => s.status === "erledigt").length;
  const ngDetail = glasTourDetailStops.filter((s) => s.status === "nicht_geschafft").length;
  const totalStops = glasTourDetailStops.length;
  const pctStops = totalStops ? Math.round((done / totalStops) * 100) : 0;
  const offenGesamt = glasTourDetailStops.filter((s) => s.status === "offen").length;
  const firstOpenIdx = glasTourDetailStops.findIndex((s) => s.status === "offen");
  const rows = glasTourDetailStops.length
    ? glasTourDetailStops
        .map((s, idx) => {
          const isDone = s.status === "erledigt";
          const isNg = s.status === "nicht_geschafft";
          const isNext = idx === firstOpenIdx;
          const isSigning = glasAdminSignOpenStopId === s.id;
          const isNgOpen = glasNgOpenStopId === s.id;
          const qm = glasStopQm(s);
          const wazeUrl = s.lat ? `https://waze.com/ul?ll=${s.lat},${s.lng}&navigate=yes` : wazeLink(s.adresse);
          const badge = isDone
            ? `<span class="badge badge-signed" style="flex-shrink:0;">Erledigt</span>`
            : isNg
              ? `<span class="badge" style="flex-shrink:0; background:var(--border); color:var(--text-secondary);">🚫 Nicht geschafft</span>`
              : `<span class="badge badge-open" style="flex-shrink:0;">Offen</span>`;
          const menuOpen = glasStopMenuOpenId === s.id;
          return `
        <div class="glas-stop-row${isDone ? " done" : ""}${isNg ? " ng" : ""}${isNext ? " next" : ""}">
          <div class="glas-stop-num">${isDone ? "✓" : (idx + 1)}</div>
          <div style="flex:1; min-width:0;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
              <div style="min-width:0;">
                ${isNext ? `<span class="glas-next-tag">Als Nächstes</span>` : ""}
                ${s.objekt ? `<p style="margin:0; font-weight:600; font-size:13.5px;">${escapeHtml(s.objekt)}${qm ? ` <span style="color:var(--text-secondary); font-weight:500;">· ${qm} qm</span>` : ""}</p>` : ""}
                <p class="muted" style="margin:1px 0 0; font-size:12.5px; white-space:pre-line;">${escapeHtml(s.adresse)}</p>
              </div>
              <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
                ${badge}
                <button class="glas-stopmenu-toggle${menuOpen ? " on" : ""}" title="Aktionen" onclick="toggleGlasStopMenu('${s.id}')">⋯</button>
              </div>
            </div>
            ${menuOpen ? renderGlasStopMenu(s) : ""}
            ${renderStopPositionenVorschau(s)}
            ${s.hinweise ? `<div class="glas-hinweis-box" style="margin-top:8px;"><span class="glas-hinweis-icon">⚠️</span><div><p class="glas-hinweis-text" style="margin:0;">${escapeHtml(s.hinweise)}</p></div></div>` : ""}
            ${s.notiz ? `<div class="glas-notiz-box" style="margin-top:8px;">📝 ${escapeHtml(s.notiz)}</div>` : ""}
            ${isDone ? `
              ${s.zusatz ? `<div class="glas-notiz-box" style="margin-top:8px; white-space:pre-line;">➕ Zusätzlich gemacht: ${escapeHtml(s.zusatz)}</div>` : ""}
              <p class="muted" style="margin:8px 0 0; font-size:12px;">${(!s.unterschrift && s.manuell_erledigt_am)
                ? `✔️ Als unterschrieben markiert am ${formatGlasDate(glasDatumVonTimestamp(s.manuell_erledigt_am))}${glasUhrzeitVonTimestamp(s.manuell_erledigt_am) ? ` um ${glasUhrzeitVonTimestamp(s.manuell_erledigt_am)} Uhr` : ""} (ohne Unterschrift)`
                : `Unterschrieben von ${escapeHtml(s.name || "")} am ${formatGlasDate(glasSignaturDatum(s))}${glasUhrzeitVonTimestamp(s.signed_at) ? ` um ${glasUhrzeitVonTimestamp(s.signed_at)} Uhr` : ""}`}</p>
            ` : isNg ? `
              <div class="glas-ng-box">🚫 <strong>Nicht geschafft:</strong> ${escapeHtml(s.ng_grund || "")}${s.ng_notiz ? ` – ${escapeHtml(s.ng_notiz)}` : ""}${s.ng_am ? ` <span class="muted">(${formatGlasDate(glasDatumVonTimestamp(s.ng_am))})</span>` : ""}<br><span class="muted">Das Objekt steht wieder unter „Fällige Objekte" und kann neu eingeplant werden.</span></div>
            ` : `
              ${isSigning ? renderAdminSignArea(s) : ""}
              ${isNgOpen ? renderGlasNgArea(s) : ""}
            `}
          </div>
        </div>`;
        })
        .join("")
    : `<p class="muted"><span class="spinner"></span> Lade Stopps...</p>`;

  return `
    <button class="btn btn-sm" style="margin:16px 0;" onclick="closeGlasTourDetail()">&larr; Zurück zu allen Touren</button>
    <div class="card">
      <p style="margin:0 0 4px; font-weight:700; font-size:17px;">${t.name ? escapeHtml(t.name) : "Ohne Namen"}</p>
      <p class="muted" style="margin:0;">${formatGlasDateRange(t.datum, t.datum_bis)} · ${t.template === "sub" ? "Dietrich" : "GEKO"}</p>
      ${totalStops ? `
      <div class="glas-ring-hero">
        <div class="glas-ring">
          <svg width="78" height="78" viewBox="0 0 92 92">
            <circle cx="46" cy="46" r="40" fill="none" stroke="var(--prog-track)" stroke-width="9"></circle>
            <circle class="glas-ring-fill" cx="46" cy="46" r="40" fill="none" stroke="${done === totalStops ? "#2e9e4f" : "var(--blue)"}" stroke-width="9" stroke-linecap="round" stroke-dasharray="251.2" stroke-dashoffset="251.2" data-pct="${pctStops}"></circle>
          </svg>
          <div class="glas-ring-txt"><b>${done}/${totalStops}</b><span>erledigt</span></div>
        </div>
        <div class="glas-ring-info">
          <p class="grh-t">${offenGesamt > 0 ? `Noch ${offenGesamt} Objekt${offenGesamt === 1 ? "" : "e"}` : (ngDetail ? "Durch – teils nicht geschafft" : "Alles erledigt 🎉")}</p>
          <p class="grh-m">${glasTourAllDone(t) ? `<span class="gtc-pill p-ok">Fertig</span>` : done ? `<span class="gtc-pill p-run">Läuft</span>` : `<span class="gtc-pill p-plan">Geplant</span>`}${ngDetail ? ` <span class="muted" style="font-size:12px;">· ${ngDetail} nicht geschafft</span>` : ""}</p>
        </div>
      </div>` : ""}
      ${t.notiz ? `<div class="glas-notiz-box" style="margin-top:10px; white-space:pre-line;">📌 <b>Tour-Notiz (für die MA):</b> ${escapeHtml(t.notiz)}</div>` : ""}
      ${!t.archiviert_am ? `
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
        <button class="btn btn-sm" onclick="${t.frei ? `editEinzelschein('${t.id}')` : `editGlasTour('${t.id}')`}">${t.frei ? "Schein bearbeiten" : "Tour bearbeiten"}</button>
        <button class="btn btn-sm" onclick="openGlasMergePicker('${t.id}')">🔀 ${t.frei ? "In andere Tour übernehmen" : "Mit anderer Tour zusammenführen"}</button>
        <button class="btn btn-sm" onclick="toggleGlasTourMaSichtbar('${t.id}')">${t.ma_versteckt ? "👁️ Zur MA-Ansicht hinzufügen" : "🙈 Aus MA-Ansicht rausnehmen"}</button>
      </div>
      ${t.ma_versteckt ? `<p class="muted" style="margin:8px 0 0; font-size:12px;">🙈 Diese Tour ist für die Mitarbeiter ausgeblendet – hier im Admin bleibt sie sichtbar.</p>` : ""}
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:12px; padding-top:12px; border-top:1px solid var(--border);">
        <span class="muted" style="font-size:13px;">Schein-Vorlage:</span>
        <button class="btn btn-sm ${t.template !== "sub" ? "btn-primary" : ""}" onclick="setGlasTourTemplate('${t.id}','geko')">GEKO Clean</button>
        <button class="btn btn-sm ${t.template === "sub" ? "btn-primary" : ""}" onclick="setGlasTourTemplate('${t.id}','sub')">Dietrich</button>
        <span class="muted" style="font-size:11.5px; flex-basis:100%;">Kann jederzeit geändert werden – auch nach dem Unterschreiben. Ändert nur die PDF-Optik, nicht die Unterschrift.</span>
      </div>` : ""}
      <div class="glas-stop-list">${rows}</div>
      ${glasTourDetailStops.length ? `<button class="btn btn-sm" style="margin-top:12px;" onclick="downloadAlleGlasPdfs()">📄 Alle PDFs herunterladen (${glasTourDetailStops.length})</button>` : ""}
    </div>
    ${t.archiviert_am
      ? `<button class="btn btn-sm" onclick="restoreGlasTour('${t.id}')">↩️ Aus dem Archiv wiederherstellen</button>`
      : `<button class="btn btn-sm" style="color:var(--danger); margin-top:10px;" onclick="deleteGlasTour('${t.id}')">Tour löschen (wandert ins Archiv)</button>`
    }
    ${glasMergePickerFor === t.id ? renderGlasMergePicker(t) : ""}
  `;
}

function downloadGlasPdfAdmin(stopId) {
  const t = glasTouren.find((x) => x.id === glasTourDetailId);
  const s = glasTourDetailStops.find((x) => x.id === stopId);
  if (!s || !t) return;
  const doc = generateGlasPdf(s, t.template, t.datum);
  doc.save(glasScheinFilename(s, t.template));
}

// Alle Scheine einer Tour in EIN PDF (eine Seite pro Stopp) - praktisch am Ende einer
// Tour zum Sammel-Download/Archivieren. Nur Admin.
function downloadAlleGlasPdfs() {
  const t = glasTouren.find((x) => x.id === glasTourDetailId);
  if (!t || !glasTourDetailStops.length) { showToast("Keine Scheine vorhanden"); return; }
  try {
    let doc = null;
    glasTourDetailStops.forEach((s) => { doc = generateGlasPdf(s, t.template, t.datum, doc); });
    const clean = (v) => String(v || "").replace(/[^a-z0-9äöüß]+/gi, "_").replace(/^_+|_+$/g, "");
    doc.save(`Scheine_${clean(t.name || "Tour")}${t.datum ? "_" + t.datum : ""}.pdf`);
  } catch (e) {
    showToast("PDF-Erstellung fehlgeschlagen: " + e.message);
  }
}

// Schein-Vorlage (GEKO/Dietrich) einer Tour ändern - auch NACH dem Unterschreiben.
// Die Vorlage steckt an der Tour und bestimmt nur die PDF-Optik; Unterschriften und
// alle Stopp-Daten bleiben unangetastet. Behebt das versehentlich falsch gewählte Template.
// Tour aus der Mitarbeiter-Ansicht aus-/einblenden. Die Tour bleibt im Admin komplett
// erhalten (Stopps, Unterschriften, PDFs) – nur die MA-App zeigt ausgeblendete Touren
// nicht mehr an (loadGlasTouren filtert ma_versteckt). Hält die MA-Liste übersichtlich.
async function toggleGlasTourMaSichtbar(tourId) {
  if (glasBusy) return;
  const t = glasTouren.find((x) => x.id === tourId);
  if (!t) return;
  const neu = !t.ma_versteckt;
  const { error } = await sb.from("glas_touren").update({ ma_versteckt: neu }).eq("id", tourId);
  if (error) { showToast("Fehler: " + error.message); return; }
  t.ma_versteckt = neu; // optimistisch, damit der Button sofort umschaltet
  showToast(neu ? "Aus Mitarbeiter-Ansicht entfernt" : "Wieder in Mitarbeiter-Ansicht");
  await loadGlasTouren();
  renderGlasAdmin();
}

async function setGlasTourTemplate(tourId, tmpl) {
  if (glasBusy) return;
  const t = glasTouren.find((x) => x.id === tourId);
  if (!t || (t.template || "geko") === tmpl) return;
  const { error } = await sb.from("glas_touren").update({ template: tmpl }).eq("id", tourId);
  if (error) { showToast("Fehler: " + error.message); return; }
  showToast("Vorlage geändert: " + (tmpl === "sub" ? "Dietrich" : "GEKO Clean"));
  await loadGlasTouren();
  renderGlasAdmin();
}

/* ---------------- Touren/Einzelscheine zusammenführen ----------------
   Stopps einer Tour (z.B. eines Einzelscheins) in eine andere Tour übernehmen -
   praktisch, um zwei Einzelscheine oder einen Sonder-Einzelschein und eine Tour
   für denselben Tag zu bündeln. Die Stopps behalten alles (inkl. Unterschrift/
   Status); die Quell-Tour wird erst aufgelöst, wenn ALLE Stopps sicher drüben sind. */
let glasMergePickerFor = null; // tourId, dessen Stopps verschoben werden sollen

function openGlasMergePicker(tourId) { glasMergePickerFor = tourId; renderGlasAdmin(); }
function closeGlasMergePicker() { glasMergePickerFor = null; renderGlasAdmin(); }

function renderGlasMergePicker(sourceTour) {
  const ziele = glasTouren.filter((t) => !t.archiviert_am && t.id !== sourceTour.id);
  const zeilen = ziele.length ? ziele.map((t) => {
    const anzahl = (t.glas_stopps || []).length;
    const tmplWarn = (t.template || "geko") !== (sourceTour.template || "geko");
    return `
      <div style="display:flex; align-items:center; gap:10px; padding:11px 2px; border-top:1px solid var(--border); cursor:pointer;" onclick="mergeGlasTourInto('${sourceTour.id}','${t.id}')">
        <div style="flex:1; min-width:0;">
          <p style="margin:0; font-weight:600; font-size:14px;">${t.name ? escapeHtml(t.name) : "Ohne Namen"}</p>
          <p class="muted" style="margin:2px 0 0; font-size:12px;">${t.datum ? formatGlasDate(t.datum) : "Ohne Datum"} · ${anzahl} Stopp${anzahl === 1 ? "" : "s"} · ${t.template === "sub" ? "Dietrich" : "GEKO"}${tmplWarn ? ` <span style="color:var(--danger);">· andere Vorlage!</span>` : ""}</p>
        </div>
        <span style="color:var(--text-secondary);">›</span>
      </div>`;
  }).join("") : `<p class="muted" style="margin:10px 0;">Keine andere aktive Tour vorhanden. Lege zuerst eine Tour an.</p>`;

  return `
    <div class="modal-overlay" onclick="if(event.target===this) closeGlasMergePicker();">
      <div class="modal-box glas-screen-in" style="max-width:460px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <p style="margin:0; font-weight:700; font-size:16px;">In welche Tour übernehmen?</p>
          <button class="btn btn-sm" onclick="closeGlasMergePicker()">✕</button>
        </div>
        <p class="muted" style="margin:0 0 8px; font-size:12.5px;">Alle Stopps von „${escapeHtml(sourceTour.name || "diesem Schein")}" wandern ans Ende der gewählten Tour. Dieser Eintrag wird danach aufgelöst. Unterschriebene Stopps bleiben unverändert.</p>
        ${zeilen}
      </div>
    </div>`;
}

async function mergeGlasTourInto(sourceId, targetId) {
  if (glasBusy) return;
  const target = glasTouren.find((t) => t.id === targetId);
  const source = glasTouren.find((t) => t.id === sourceId);
  if (!target || !source) { showToast("Tour nicht gefunden"); return; }
  const tmplWarn = (target.template || "geko") !== (source.template || "geko");
  if (!confirm(`Stopps von „${source.name || "diesem Schein"}" nach „${target.name || "Tour"}" verschieben und diesen Eintrag auflösen?${tmplWarn ? "\n\nAchtung: Die Ziel-Tour nutzt eine andere Schein-Vorlage – die Scheine werden dann mit deren Vorlage gedruckt." : ""}`)) return;

  glasBusy = true; glasMergePickerFor = null; glasProgressText = "Wird zusammengeführt..."; renderGlasAdmin();
  try {
    const { data: srcStops, error: e1 } = await sb.from("glas_stopps").select("*").eq("tour_id", sourceId).order("reihenfolge", { ascending: true });
    if (e1) throw e1;
    const { data: tgtStops, error: e2 } = await sb.from("glas_stopps").select("id, reihenfolge").eq("tour_id", targetId);
    if (e2) throw e2;
    const startR = (tgtStops && tgtStops.length) ? Math.max(...tgtStops.map((s) => s.reihenfolge || 0)) + 1 : 0;

    // Jeden Stopp einzeln umhängen; nur bei komplettem Erfolg wird die Quell-Tour gelöscht.
    let alleOk = true;
    for (let i = 0; i < (srcStops || []).length; i++) {
      const { error } = await sb.from("glas_stopps").update({ tour_id: targetId, reihenfolge: startR + i }).eq("id", srcStops[i].id);
      if (error) { alleOk = false; break; }
    }
    if (!alleOk) { throw new Error("Nicht alle Stopps konnten verschoben werden – nichts wurde aufgelöst, bitte erneut versuchen."); }

    // Quell-Tour ist jetzt leer -> auflösen (endgültig, da keine Daten mehr dranhängen)
    await sb.from("glas_touren").delete().eq("id", sourceId);

    glasBusy = false; glasProgressText = "";
    showToast("Zusammengeführt");
    await loadGlasTouren();
    openGlasTourDetail(targetId);
  } catch (err) {
    glasBusy = false; glasProgressText = "";
    showToast("Fehler: " + err.message);
    await loadGlasTouren();
    renderGlasAdmin();
  }
}

/* ---------------- Unterschreiben direkt in der Admin-Ansicht ---------------- */

function toggleGlasAdminSign(stopId) {
  glasAdminSignOpenStopId = glasAdminSignOpenStopId === stopId ? null : stopId;
  renderGlasAdmin();
  if (glasAdminSignOpenStopId) setTimeout(setupGlasAdminSigPad, 30);
}

function renderAdminSignArea(s) {
  return `
    <div style="margin-top:12px; border-top:1px solid var(--border); padding-top:12px;">
      ${renderGlasStundenInputs(s, "as-std")}
      <div class="field">
        <label class="muted">Name der unterschreibenden Person</label>
        <input type="text" id="as_name" placeholder="Vor- und Nachname" style="font-size:16px;" />
      </div>
      <div class="field">
        <label class="muted">Unterschrift</label>
        <canvas id="as_sigCanvas" style="width:100%; height:180px; border:1px solid var(--border); border-radius:10px; background:white; touch-action:none;"></canvas>
        <button class="btn btn-sm" style="margin-top:8px;" onclick="glasAdminSigPad && glasAdminSigPad.clear();">🗑️ Löschen &amp; neu</button>
      </div>
      <input type="hidden" id="as_datum" value="${glasTodayIso()}" />
      <div class="field">
        <label class="muted">➕ Extra was gemacht? (optional, steht mit auf dem Schein)</label>
        <textarea id="as_zusatz" rows="2" placeholder="z.B. 2 Stunden zusätzlich, 5 Fenster extra"></textarea>
      </div>
      <div class="field">
        <label class="muted">Schein sofort per E-Mail senden an (optional)</label>
        <input type="email" id="as_email" placeholder="kunde@firma.de – leer lassen = kein Versand" style="font-size:16px;" />
      </div>
      <button class="btn btn-primary" style="width:100%; justify-content:center; padding:14px; font-size:16px;" onclick="saveGlasAdminSignature('${s.id}')">✓ Unterschrift speichern</button>
    </div>`;
}

function setupGlasAdminSigPad() {
  const canvas = document.getElementById("as_sigCanvas");
  if (!canvas) return;
  const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  canvas.getContext("2d").scale(ratio, ratio);
  glasAdminSigPad = new SignaturePad(canvas, { minWidth: 0.8, maxWidth: 2.2 });
}

async function saveGlasAdminSignature(stopId) {
  const name = document.getElementById("as_name").value.trim();
  const datum = document.getElementById("as_datum").value;
  if (!name) { showToast("Bitte Namen eintragen"); return; }
  if (!glasAdminSigPad || glasAdminSigPad.isEmpty()) { showToast("Bitte unterschreiben lassen"); return; }

  const unterschrift = glasAdminSigPad.toDataURL("image/png");
  const versandEmail = document.getElementById("as_email")?.value.trim() || "";
  const zusatz = document.getElementById("as_zusatz")?.value.trim() || "";
  const stop = glasTourDetailStops.find((s) => s.id === stopId);

  // Stunden-Positionen (Pos. 2/5): Eingabe ist Pflicht und wandert auf den Schein
  let posJson = stop?.positionen || "[]";
  const stdInputs = [...document.querySelectorAll(".as-std")].map((el) => el.value);
  if (stdInputs.length) {
    const res = glasMitStundenAktualisiert(posJson, stdInputs);
    if (res.fehlt) { showToast("Bitte die gemachten Stunden eintragen (Pflichtfeld)"); return; }
    posJson = res.json;
  }

  const { error, payload } = await glasSignStop(stopId, posJson, name, datum, unterschrift, zusatz);
  if (error) { showToast("Fehler: " + error.message); return; }
  if (stop) Object.assign(stop, payload);

  showToast("Unterschrieben");
  glasKundeTermineCache = {}; glasScheineDaten = null; glasStatistikDaten = null;
  const signTourName = glasTouren.find((x) => x.id === glasTourDetailId)?.name || "Tour";
  glasPushSend("glas", "push_unterschrift", `✍️ Unterschrift: ${signTourName}`, `${stop?.objekt || "Stopp"} – unterschrieben von ${name}${zusatz ? " · Zusatz: " + zusatz : ""}`, "/glas-admin.html#/tab/touren");
  glasAdminSignOpenStopId = null;
  await Promise.all([loadGlasTouren(), loadGlasObjektPositionen(), loadGlasEingeplantePositionen()]);
  renderGlasAdmin();

  // Optionaler Sofort-Versand des fertigen Scheins
  if (versandEmail && stop) {
    const t = glasTouren.find((x) => x.id === glasTourDetailId);
    const doc = generateGlasPdf(stop, t?.template || "geko", t?.datum);
    await sendScheinPerMail(versandEmail, doc, glasScheinFilename(stop, t?.template || "geko"));
  }
}

/* ---------------- Unterschrift löschen / manuell erledigen (nur Admin) ----------------
   deleteGlasSignatur: versehentlich unterschriebene Scheine zurücksetzen. Der Stopp wird
   wieder "offen", und "zuletzt gereinigt" der betroffenen Positionen wird aus dem übrigen
   Verlauf zurückgerechnet (letzte ANDERE Unterschrift, sonst leer) - das Objekt gilt
   damit wieder als nicht erledigt.
   markGlasStopErledigt: Schein ohne Unterschrift abhaken (z.B. Blanko, das nie
   unterschrieben zurückkam). Zählt wie eine Unterschrift (Fälligkeit rückt weiter),
   wird aber überall als "als unterschrieben markiert am ..." ausgewiesen. */
async function deleteGlasSignatur(stopId) {
  if (glasBusy) return;
  const stop = glasTourDetailStops.find((s) => s.id === stopId);
  if (!stop) return;
  const manuell = !stop.unterschrift && stop.manuell_erledigt_am;
  if (!confirm(manuell
    ? "Erledigt-Markierung zurücknehmen? Der Stopp gilt danach wieder als offen."
    : "Unterschrift wirklich löschen? Der Stopp gilt danach wieder als offen und das Objekt als noch nicht erledigt. Das kann nicht rückgängig gemacht werden.")) return;

  glasBusy = true; glasProgressText = "Wird zurückgesetzt..."; renderGlasAdmin();
  try {
    // 1) "Zuletzt gereinigt" der Schein-Positionen aus dem übrigen Verlauf zurückrechnen.
    // Zählt nur echte Nachweise: keine archivierten Touren, kein "erledigt" ohne
    // Unterschrift/Markierung (sonst entstehen Geister-Reinigungen wie bei KITA 402).
    const ids = glasStopPositionen(stop).map((p) => p.id).filter(Boolean);
    if (ids.length) {
      const { data } = await sb.from("glas_stopps").select("id, datum, signed_at, positionen, name, manuell_erledigt_am, glas_touren(archiviert_am)").eq("status", "erledigt");
      const andere = (data || []).filter((x) => x.id !== stopId
        && !(x.glas_touren && x.glas_touren.archiviert_am)
        && ((x.name || "").trim() !== "" || x.manuell_erledigt_am));
      for (const pid of ids) {
        let letzte = null;
        andere.forEach((x) => {
          try {
            if (JSON.parse(x.positionen || "[]").some((p) => p && p.id === pid)) {
              const d = glasSignaturDatum(x);
              if (d && (!letzte || d > letzte)) letzte = d;
            }
          } catch (e) {}
        });
        await sb.from("glas_objekt_positionen").update({ letzte_reinigung: letzte }).eq("id", pid);
      }
    }

    // 2) Stopp zurück auf offen (Unterschrift wird entfernt)
    const payload = { status: "offen", name: null, datum: null, unterschrift: null, signed_at: null, zusatz: "", manuell_erledigt_am: null };
    let { error } = await sb.from("glas_stopps").update(payload).eq("id", stopId);
    if (error && /manuell_erledigt_am/.test(error.message || "")) {
      delete payload.manuell_erledigt_am;
      ({ error } = await sb.from("glas_stopps").update(payload).eq("id", stopId));
    }
    if (error) throw error;
    Object.assign(stop, { status: "offen", name: null, datum: null, unterschrift: null, signed_at: null, zusatz: "", manuell_erledigt_am: null });

    glasBusy = false; glasProgressText = "";
    showToast(manuell ? "Markierung zurückgenommen – Stopp ist wieder offen" : "Unterschrift gelöscht – Stopp ist wieder offen");
    glasKundeTermineCache = {}; glasScheineDaten = null; glasStatistikDaten = null;
    await Promise.all([loadGlasTouren(), loadGlasObjektPositionen(), loadGlasEingeplantePositionen()]);
    renderGlasAdmin();
  } catch (err) {
    glasBusy = false; glasProgressText = "";
    showToast("Fehler: " + err.message);
    renderGlasAdmin();
  }
}

async function markGlasStopErledigt(stopId) {
  if (glasBusy) return;
  const stop = glasTourDetailStops.find((s) => s.id === stopId);
  if (!stop) return;
  if (!confirm(`„${stop.objekt || "Stopp"}" ohne Unterschrift als unterschrieben markieren? Der Schein zählt dann als erledigt und die Fälligkeit rückt weiter.`)) return;

  const heute = glasTodayIso();
  const jetzt = new Date().toISOString();
  const payload = { status: "erledigt", datum: heute, signed_at: jetzt, manuell_erledigt_am: jetzt, unterschrift: null };
  let { error } = await sb.from("glas_stopps").update(payload).eq("id", stopId);
  if (error && /manuell_erledigt_am/.test(error.message || "")) {
    showToast("Bitte zuerst die neue SQL-Zeile in Supabase ausführen (manuell_erledigt_am)");
    return;
  }
  if (error) { showToast("Fehler: " + error.message); return; }
  Object.assign(stop, payload);

  // Fälligkeit weiterrücken - exakt wie beim echten Unterschreiben
  try {
    const ids = glasStopPositionen(stop).map((p) => p.id).filter(Boolean);
    if (ids.length) await sb.from("glas_objekt_positionen").update({ letzte_reinigung: heute, faelligkeit_override: null }).in("id", ids);
  } catch (e) {}

  showToast("Als unterschrieben markiert");
  glasKundeTermineCache = {}; glasScheineDaten = null; glasStatistikDaten = null;
  await Promise.all([loadGlasTouren(), loadGlasObjektPositionen(), loadGlasEingeplantePositionen()]);
  renderGlasAdmin();
}

/* ---------------- „Nicht geschafft" (nur Admin) ----------------
   Ein geplanter Stopp konnte nicht erledigt werden (kein Zugang, keine Zeit …).
   Der Admin markiert ihn mit Grund; Status wird 'nicht_geschafft'. Weil nur Stopps
   mit status='offen' als "eingeplant" zählen (loadGlasEingeplantePositionen), fällt
   das Objekt automatisch zurück in die Fällige-Liste und kann neu eingeplant werden.
   Nichts wird gelöscht, der Stopp bleibt als Beleg in der Tour. Jederzeit umkehrbar. */
function toggleGlasNg(stopId) {
  glasNgOpenStopId = glasNgOpenStopId === stopId ? null : stopId;
  glasNgGrund = "";
  glasAdminSignOpenStopId = null; // ein Bereich pro Stopp offen
  renderGlasAdmin();
}

function setGlasNgGrund(g) { glasNgGrund = g; renderGlasAdmin(); }

function renderGlasNgArea(s) {
  return `
    <div style="margin-top:12px; border-top:1px solid var(--border); padding-top:12px;">
      <p style="margin:0 0 8px; font-weight:600; font-size:13px;">Warum wurde dieser Stopp nicht geschafft?</p>
      <div style="display:flex; flex-wrap:wrap; gap:8px;">
        ${GLAS_NG_GRUENDE.map((g) => `<button class="btn btn-sm ${glasNgGrund === g ? "btn-primary" : ""}" onclick="setGlasNgGrund('${g.replace(/'/g, "\\'")}')">${escapeHtml(g)}</button>`).join("")}
      </div>
      <div class="field" style="margin-top:10px;">
        <label class="muted">Notiz (optional)</label>
        <textarea id="ng_notiz" rows="2" placeholder="z.B. Schlüssel fehlte, Kunde nicht erreichbar"></textarea>
      </div>
      <button class="btn btn-primary" style="width:100%; justify-content:center; padding:12px;" onclick="saveGlasNg('${s.id}')">✓ Als nicht geschafft markieren</button>
    </div>`;
}

async function saveGlasNg(stopId) {
  if (glasBusy) return;
  if (!glasNgGrund) { showToast("Bitte einen Grund wählen"); return; }
  const notiz = document.getElementById("ng_notiz")?.value.trim() || "";
  const stop = glasTourDetailStops.find((s) => s.id === stopId);
  const payload = { status: "nicht_geschafft", ng_grund: glasNgGrund, ng_notiz: notiz, ng_am: new Date().toISOString() };
  const { error } = await sb.from("glas_stopps").update(payload).eq("id", stopId);
  if (error) { showToast("Fehler: " + error.message); return; }
  if (stop) Object.assign(stop, payload);
  glasNgOpenStopId = null; glasNgGrund = "";
  showToast("Als nicht geschafft markiert – Objekt ist wieder fällig");
  await Promise.all([loadGlasTouren(), loadGlasObjektPositionen(), loadGlasEingeplantePositionen()]);
  renderGlasAdmin();
}

async function revertGlasNg(stopId) {
  if (glasBusy) return;
  const stop = glasTourDetailStops.find((s) => s.id === stopId);
  const payload = { status: "offen", ng_grund: "", ng_notiz: "", ng_am: null };
  const { error } = await sb.from("glas_stopps").update(payload).eq("id", stopId);
  if (error) { showToast("Fehler: " + error.message); return; }
  if (stop) Object.assign(stop, payload);
  showToast("Wieder als offen markiert");
  await Promise.all([loadGlasTouren(), loadGlasObjektPositionen(), loadGlasEingeplantePositionen()]);
  renderGlasAdmin();
}

function syncNewTourFormFromDom() {
  const get = (id) => document.getElementById(id)?.value;
  glasTourNotizen.forEach((n, objektId) => {
    const el = document.getElementById(`tour_notiz_${objektId}`);
    if (el) n.text = el.value;
  });
  // Händische Extra-Positionen aus den Feldern zurücklesen (überlebt Re-Renders)
  glasTourExtras.forEach((liste, objektId) => {
    liste.forEach((ex, i) => {
      const nr = document.getElementById(`tour_extra_nr_${objektId}_${i}`);
      const art = document.getElementById(`tour_extra_art_${objektId}_${i}`);
      const qm = document.getElementById(`tour_extra_qm_${objektId}_${i}`);
      if (nr) ex.nr = nr.value;
      if (art) ex.art = art.value;
      if (qm) ex.qm = qm.value;
    });
  });
  if (get("t_name") !== undefined) glasNewTour.name = get("t_name");
  if (get("t_datum") !== undefined) glasNewTour.datum = get("t_datum");
  if (get("t_datum_bis") !== undefined) glasNewTour.datum_bis = get("t_datum_bis");
  if (get("t_template") !== undefined) glasNewTour.template = get("t_template");
  if (get("t_notiz") !== undefined) glasNewTour.notiz = get("t_notiz");
}

function renderNewTourForm() {
  const selectedItems = [...glasSelectedObjekte].map((id) => glasObjekte.find((o) => o.id === id)).filter(Boolean);

  return `
    <button class="btn btn-sm" style="margin:16px 0;" onclick="glasShowNewTourForm = false; glasEditingTourId = null; glasPreselectPositionen = null; renderGlasAdmin();">&larr; Zurück zu allen Touren</button>
    <div class="card">
      <h2>${glasEditingTourId ? "Tour bearbeiten" : "Neue Tour anlegen"}</h2>
      <p class="muted" style="margin:0 0 12px;">Pro Objekt kannst du unten abhaken, welche Positionen auf den Schein kommen – fällige sind vorausgewählt.</p>
      ${glasEditingTourId ? `<p class="muted" style="margin:0 0 12px;">Bestehende Stopps bleiben exakt so, wie sie eingetragen wurden (inkl. handgeänderter Namen/Positionen). Abwählen entfernt einen offenen Stopp, neu Auswählen fügt ihn aus den Objekt-Daten hinzu. Unterschriebene Stopps bleiben immer erhalten.</p>` : ""}
      <div class="field">
        <label class="muted">Tourname</label>
        <input type="text" id="t_name" value="${escapeHtml(glasNewTour.name)}" placeholder="z.B. Tour Bochum Nord" />
      </div>
      <div class="row">
        <div class="field">
          <label class="muted">Datum (Start)</label>
          <input type="date" id="t_datum" value="${glasNewTour.datum || glasTodayIso()}" />
        </div>
        <div class="field">
          <label class="muted">Bis (optional, für mehrtägige Touren)</label>
          <input type="date" id="t_datum_bis" value="${glasNewTour.datum_bis || ""}" />
        </div>
      </div>
      <div class="field">
        <label class="muted">Template (Briefkopf des Abnahmescheins)</label>
        <select id="t_template">
          <option value="geko" ${glasNewTour.template === "geko" ? "selected" : ""}>GEKO Clean</option>
          <option value="sub" ${glasNewTour.template === "sub" ? "selected" : ""}>Subunternehmen (Dietrich)</option>
        </select>
      </div>
      <div class="field">
        <label class="muted">Tour-Notiz für die Mitarbeiter (optional)</label>
        <textarea id="t_notiz" rows="2" placeholder="z.B. Schlüssel im Büro abholen · mit 2 Mann · zuerst bei Herz Mariä">${escapeHtml(glasNewTour.notiz || "")}</textarea>
        <p class="muted" style="margin:5px 0 0; font-size:12px;">Steht dem Mitarbeiter ganz oben, wenn er die Tour öffnet.</p>
      </div>
      <label class="muted">Ausgewählte Objekte (${selectedItems.length})</label>
      ${selectedItems.length ? renderTourSelectedSummary(selectedItems) : `<p class="muted" style="margin:6px 0 14px;">Noch keine Objekte ausgewählt.</p>`}

      <label class="muted">Objekte hinzufügen</label>
      <div class="field">
        <input type="text" id="tour_obj_search" placeholder="🔍 Kunde oder Objekt suchen..." value="${escapeHtml(glasTourSearch)}" autocomplete="off" />
      </div>
      <div id="tourSearchResults">${renderTourObjektSearchResults()}</div>

      ${renderManualOrderList()}
      <button class="btn btn-primary" style="margin-top:16px;" onclick="createGlasTour()" ${glasBusy ? "disabled" : ""}>
        ${glasBusy ? `<span class="spinner"></span> ${escapeHtml(glasProgressText || "Wird gespeichert...")}` : glasEditingTourId ? "Änderungen speichern" : "Tour anlegen"}
      </button>
    </div>
  `;
}

// Legt fest, welche Positionen eines gerade ausgewählten Objekts vorausgewählt sind:
// Sind Positionen fällig/überfällig, nur diese - sonst alle. Kann danach pro Position
// per Checkbox umentschieden werden.
function glasInitTourPosSelection(objektId) {
  if (!glasPreselectPositionen) glasPreselectPositionen = new Map();
  if (glasPreselectPositionen.has(objektId)) return;
  const positionen = glasGetObjektPositionen(objektId);
  const faellige = positionen.filter((p) => {
    const s = glasFaelligkeitStatus(p).status;
    return s === "ueberfaellig" || s === "faellig" || s === "kommend";
  });
  const auswahl = (faellige.length ? faellige : positionen).map((p) => p.id || p.nr);
  glasPreselectPositionen.set(objektId, new Set(auswahl));
}

function glasToggleTourPosition(objektId, posKey) {
  glasInitTourPosSelection(objektId);
  const set = glasPreselectPositionen.get(objektId);
  if (set.has(posKey)) set.delete(posKey);
  else set.add(posKey);
  syncNewTourFormFromDom();
  renderGlasAdmin();
}

function renderTourSelectedSummary(items) {
  return `
    <div class="card" style="margin-bottom:14px; padding:6px 16px;">
      ${items.map((o) => {
        const positionen = glasGetObjektPositionen(o.id);
        const set = glasPreselectPositionen?.get(o.id);
        return `
        <div style="padding:10px 0; border-top:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:14px; font-weight:600;">${escapeHtml(o.name)} <span class="muted" style="font-weight:400;">· ${escapeHtml(o.kunde_name || "")}</span></span>
            <button class="btn btn-sm" style="padding:3px 8px;" onclick="glasToggleTourObjekt('${o.id}')">✕</button>
          </div>
          ${(() => { glasInitTourNotiz(o.id); const n = glasTourNotizen.get(o.id); return `
          <div style="margin-top:8px;">
            <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
              <input type="checkbox" style="width:auto;" ${n.use ? "checked" : ""} onchange="glasToggleTourNotiz('${o.id}')" />
              <span>📝 Notiz an den Stopp anhängen${o.notiz ? ` <span class="badge" style="background:var(--info-bg); color:var(--blue); font-size:10px;">Standard-Notiz vom Objekt – wird angehängt</span>` : ""}</span>
            </label>
            ${n.use ? `<textarea id="tour_notiz_${o.id}" rows="2" style="margin-top:6px; font-size:13px;" placeholder="Notiz für diesen Stopp">${escapeHtml(n.text)}</textarea>` : ""}
          </div>`; })()}
          <div style="margin-top:6px; display:flex; flex-direction:column; gap:4px;">
            ${positionen.map((p) => {
              const key = p.id || p.nr;
              const checked = set ? set.has(key) : true;
              const f = glasFaelligkeitStatus(p);
              return `
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                <input type="checkbox" style="width:auto;" ${checked ? "checked" : ""} onchange="glasToggleTourPosition('${o.id}', '${key}')" />
                <span>Pos. ${escapeHtml(p.nr)} ${escapeHtml(p.art)}${p.qm ? ` (${escapeHtml(p.qm)} qm)` : ""}</span>
                ${f.status && f.status !== "geplant" ? `<span class="badge ${glasStatusBadgeClass(f.status)}" style="font-size:10px;">${glasStatusLabel(f.status)}</span>` : ""}
              </label>`;
            }).join("")}
          </div>
          ${(glasTourExtras.get(o.id) || []).map((ex, i) => `
          <div style="display:flex; gap:6px; align-items:flex-end; margin-top:8px; background:var(--info-bg); border:1px solid var(--info-border); border-radius:8px; padding:8px;">
            <div class="field" style="flex:0 0 54px; margin:0;"><label class="muted" style="font-size:11px;">Nr.</label><input type="text" id="tour_extra_nr_${o.id}_${i}" value="${escapeHtml(ex.nr)}" placeholder="20" /></div>
            <div class="field" style="flex:2; margin:0;"><label class="muted" style="font-size:11px;">Extra-Leistung</label><input type="text" id="tour_extra_art_${o.id}_${i}" value="${escapeHtml(ex.art)}" placeholder="z.B. Extra-Stunden Sonderreinigung" /></div>
            <div class="field" style="flex:0 0 64px; margin:0;"><label class="muted" style="font-size:11px;">qm/Anz.</label><input type="text" id="tour_extra_qm_${o.id}_${i}" value="${escapeHtml(ex.qm)}" placeholder="" /></div>
            <button class="btn btn-sm" style="color:var(--danger); padding:6px 8px;" title="Entfernen" onclick="glasTourRemoveExtra('${o.id}', ${i})">✕</button>
          </div>`).join("")}
          <button class="btn btn-sm" style="margin-top:8px;" onclick="glasTourAddExtra('${o.id}')">+ Extra-Position (z.B. Stunden)</button>
        </div>`;
      }).join("")}
    </div>`;
}

// Händische Zusatzposition zu einem Stopp hinzufügen/entfernen (für Extra-Stunden o.Ä.),
// die der Mitarbeiter dann auf dem Schein sieht.
function glasTourAddExtra(objektId) {
  syncNewTourFormFromDom();
  if (!glasTourExtras.has(objektId)) glasTourExtras.set(objektId, []);
  glasTourExtras.get(objektId).push({ nr: "", art: "", qm: "" });
  renderGlasAdmin();
}

function glasTourRemoveExtra(objektId, idx) {
  syncNewTourFormFromDom();
  const liste = glasTourExtras.get(objektId);
  if (liste) liste.splice(idx, 1);
  renderGlasAdmin();
}

// Nur ausgefüllte Extra-Positionen eines Objekts, sauber als {id:null,nr,art,qm}.
function glasCleanExtras(objektId) {
  return (glasTourExtras.get(objektId) || [])
    .filter((ex) => (ex.art || "").trim() || (ex.qm || "").trim())
    .map((ex) => ({ id: null, nr: (ex.nr || "").trim(), art: (ex.art || "").trim(), qm: (ex.qm || "").trim() }));
}

function glasInitTourNotiz(objektId) {
  if (glasTourNotizen.has(objektId)) return;
  const o = glasObjekte.find((x) => x.id === objektId);
  glasTourNotizen.set(objektId, { use: !!(o && o.notiz), text: (o && o.notiz) || "" });
}

function glasToggleTourNotiz(objektId) {
  glasInitTourNotiz(objektId);
  syncNewTourFormFromDom();
  const n = glasTourNotizen.get(objektId);
  n.use = !n.use;
  renderGlasAdmin();
}

function glasToggleTourObjekt(id) {
  if (glasSelectedObjekte.has(id)) {
    glasSelectedObjekte.delete(id);
    glasManualOrder = glasManualOrder.filter((x) => x !== id);
    if (glasPreselectPositionen) glasPreselectPositionen.delete(id);
    glasTourNotizen.delete(id);
  } else {
    glasSelectedObjekte.add(id);
    if (!glasManualOrder.includes(id)) glasManualOrder.push(id);
    glasInitTourPosSelection(id);
    glasInitTourNotiz(id);
  }
  syncNewTourFormFromDom();
  // Erstes Objekt einer neuen Tour bestimmt die vorausgewählte Schein-Vorlage
  if (!glasEditingTourId && glasSelectedObjekte.size === 1 && glasSelectedObjekte.has(id)) {
    glasNewTour.template = glasTemplateFuerObjekte([id]);
  }
  renderGlasAdmin();
}

// Einheitliche Live-Suche über alle Objekte (Kunde- oder Objekt-Name, Adresse, Kd.-Nr.) zum
// Hinzufügen zur Tour - ein Tippen/Antippen statt des früheren zweistufigen "erst Kunde,
// dann Objekt"-Auswahlflows.
function renderTourObjektSearchResults() {
  const results = glasObjekte.filter((o) => matchesSearch(o, glasTourSearch));
  if (!results.length) return `<p class="muted" style="margin:6px 0 14px;">Keine Objekte gefunden.</p>`;
  return `
    ${results.length > 6 ? `<p class="muted" style="margin:0 2px 4px; font-size:12px;">${results.length} Objekte – in der Liste scrollen</p>` : ""}
    <div class="card glas-tour-search-list" style="padding:0; overflow-y:auto; max-height:340px; margin-bottom:14px;">
      ${results.map((o) => {
        const selected = glasSelectedObjekte.has(o.id);
        return `
        <div class="glas-tour-search-row${selected ? " selected" : ""}" onclick="glasToggleTourObjekt('${o.id}')">
          <span>
            <span style="font-weight:500;">${escapeHtml(o.name)}</span>
            <span class="muted" style="font-size:12px;"> · ${escapeHtml(o.kunde_name || "")}</span><br/>
            <span class="muted" style="font-size:12px; white-space:pre-line;">${escapeHtml(o.adresse)}</span>
          </span>
          <span class="glas-tour-search-check">${selected ? "✓" : "+"}</span>
        </div>`;
      }).join("")}
    </div>`;
}

function renderManualOrderList() {
  if (!glasManualOrder.length) return `<p class="muted" style="margin-top:12px;">Noch keine Objekte ausgewählt.</p>`;
  const rows = glasManualOrder
    .map((id, idx) => {
      const o = glasObjekte.find((x) => x.id === id);
      if (!o) return "";
      return `
        <div class="glas-reorder-row" data-id="${id}">
          <span class="glas-reorder-handle">☰</span>
          <span style="min-width:24px; font-weight:700; color:var(--text-secondary);">${idx + 1}.</span>
          <span style="flex:1;">
            <span style="font-weight:500;">${escapeHtml(o.name)}</span><br/>
            <span class="muted" style="font-size:12.5px;">${escapeHtml(o.adresse)}</span>
          </span>
        </div>`;
    })
    .join("");
  return `
    <div class="card" style="margin-top:14px;">
      <p class="muted" style="margin:0 0 6px; font-weight:600;">Reihenfolge festlegen (am ☰ ziehen zum Sortieren)</p>
      <div id="manualOrderList">${rows}</div>
    </div>`;
}

// Drag-Reorder über Pointer Events (funktioniert mit Maus UND Touch, anders als natives
// HTML5-Drag&Drop, das auf iOS Safari bei Touch nicht zuverlässig ist). Während des Ziehens
// wird nur die DOM-Reihenfolge verschoben (kein renderGlasAdmin(), sonst bricht die Geste
// ab) - glasManualOrder + die Nummern werden erst beim Loslassen aktualisiert.
function attachGlasReorderHandlers() {
  const container = document.getElementById("manualOrderList");
  if (!container) return;
  container.querySelectorAll(".glas-reorder-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const dragEl = handle.closest(".glas-reorder-row");
      dragEl.classList.add("dragging");
      const onMove = (ev) => {
        const rows = [...container.querySelectorAll(".glas-reorder-row")].filter((r) => r !== dragEl);
        const y = ev.clientY;
        let target = null, before = true;
        for (const r of rows) {
          const rect = r.getBoundingClientRect();
          if (y < rect.top + rect.height / 2) { target = r; before = true; break; }
        }
        if (!target && rows.length) { target = rows[rows.length - 1]; before = false; }
        if (target) {
          if (before) container.insertBefore(dragEl, target);
          else container.insertBefore(dragEl, target.nextSibling);
        }
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        dragEl.classList.remove("dragging");
        glasManualOrder = [...container.querySelectorAll(".glas-reorder-row")].map((r) => r.dataset.id);
        renderGlasAdmin();
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  });
}

// Rolle dieses Geräts fürs Push-Abo: die reine Kalender-App bekommt nur
// Kalender-Benachrichtigungen, die normale Glas-App die Glas-Benachrichtigungen.
function glasPushRole() { return glasCalApp ? "kalender" : "glas"; }

// Push gezielt an die richtige App-Gruppe (role), wenn deren Schalter an ist.
// Läuft im Hintergrund - Fehler stören den normalen Ablauf nie.
function glasPushSend(role, schalter, title, body, url) {
  try {
    if (!glasEinstellungen || !glasEinstellungen[schalter]) return;
    const fallback = role === "kalender" ? "/kalender.html#/tab/kalender" : "/glas-admin.html#/tab/touren";
    sb.functions.invoke("send-push", { body: { role, title, body, url: url || fallback } }).catch(() => {});
  } catch (e) {}
}

async function createGlasTour() {
  if (glasBusy) return;
  let name = document.getElementById("t_name").value.trim();
  const datum = document.getElementById("t_datum").value;
  const datumBis = document.getElementById("t_datum_bis").value;
  const template = document.getElementById("t_template").value;
  const notiz = (document.getElementById("t_notiz")?.value || "").trim();
  const selected = glasObjekte.filter((o) => glasSelectedObjekte.has(o.id));

  // Beim Bearbeiten darf die Auswahl leer sein (z.B. Einzelschein mit frei eingetragenem
  // Stopp, der gar kein Objekt referenziert) - nur beim Neuanlegen ist sie Pflicht.
  if (!selected.length && !glasEditingTourId) { showToast("Bitte mindestens ein Objekt auswählen"); return; }

  // Ohne eigenen Namen heißt die Tour wie ihr erstes Objekt (beim Bearbeiten: alter Name bleibt)
  if (!name) {
    const erstesId = glasManualOrder[0] || selected[0]?.id;
    name = glasObjekte.find((o) => o.id === erstesId)?.name || selected[0]?.name
      || (glasEditingTourId ? glasTouren.find((t) => t.id === glasEditingTourId)?.name : "") || "";
  }

  // Kein Objekt darf ganz ohne Positionen auf den Schein - sonst entstünde ein leerer Schein
  const ohnePositionen = selected.filter((o) => {
    const set = glasPreselectPositionen?.get(o.id);
    return set && set.size === 0;
  });
  if (ohnePositionen.length) {
    showToast(`Bitte mindestens eine Position wählen bei: ${ohnePositionen.map((o) => o.name).join(", ")}`);
    return;
  }

  glasBusy = true;
  glasProgressText = "Tour wird gespeichert...";
  renderGlasAdmin();

  try {
    // Objekte ohne Koordinaten (z.B. Geocoding beim Anlegen fehlgeschlagen) nachträglich versuchen.
    // Schlägt es wieder fehl, wird die Tour trotzdem angelegt - das Objekt landet dann
    // einfach am Ende der Route statt die ganze Tour-Erstellung abzubrechen.
    const failedNames = [];
    for (const o of selected) {
      if (!o.lat || !o.lng) {
        glasProgressText = `Geocodiere ${o.name}...`;
        renderGlasAdmin();
        try {
          const { strasse, plz, ort } = glasSplitAdresse(o.adresse);
          const coords = await glasGeocode(`${strasse}, ${plz} ${ort}`);
          o.lat = coords.lat;
          o.lng = coords.lng;
          await sb.from("glas_objekte").update({ lat: coords.lat, lng: coords.lng }).eq("id", o.id);
          await new Promise((r) => setTimeout(r, 1100));
        } catch (e) {
          failedNames.push(o.name);
        }
      }
    }

    const tourId = glasEditingTourId || genCode();
    const { error: tourErr } = await sb.from("glas_touren").upsert({
      id: tourId,
      name,
      datum: datum || null,
      datum_bis: datumBis || null,
      template,
      notiz,
    });
    if (tourErr) throw tourErr;

    // Beim Bearbeiten gilt: BESTEHENDE Stopps werden NIE neu aus den Objekt-Stammdaten
    // aufgebaut - was einmal auf dem Stopp steht (auch handgeänderte Namen oder frei
    // eingetragene Positionen, z.B. beim Einzelschein), bleibt exakt so erhalten.
    // Es passiert nur, was der Admin aktiv auswählt:
    //   - Objekt abgewählt  -> offener Stopp wird entfernt (unterschriebene nie)
    //   - Objekt neu gewählt -> neuer Stopp aus den Objekt-Stammdaten
    //   - sonst nur Reihenfolge/Notiz-Anpassungen
    let signedStops = [];
    let keptStops = [];
    if (glasEditingTourId) {
      const { data: existing } = await sb.from("glas_stopps").select("*").eq("tour_id", tourId);
      const stops = existing || [];
      signedStops = stops.filter((s) => s.status === "erledigt");
      const offene = stops.filter((s) => s.status !== "erledigt");
      // Nur offene Stopps löschen, deren Objekt aktiv abgewählt wurde. Freihand-Stopps
      // (ohne objekt_id) können nicht abgewählt werden und bleiben immer bestehen.
      const abgewaehlt = offene.filter((s) => s.objekt_id && !glasSelectedObjekte.has(s.objekt_id));
      keptStops = offene.filter((s) => !abgewaehlt.includes(s));
      const wuerdenBleiben = signedStops.length + keptStops.length
        + selected.filter((o) => ![...signedStops, ...keptStops].some((s) => s.objekt_id === o.id)).length;
      if (!wuerdenBleiben) throw new Error("Eine Tour braucht mindestens einen Stopp – bitte ein Objekt ausgewählt lassen.");
      if (abgewaehlt.length) await sb.from("glas_stopps").delete().in("id", abgewaehlt.map((s) => s.id));
    }
    const vorhandeneObjektIds = new Set([...signedStops, ...keptStops].map((s) => s.objekt_id).filter(Boolean));
    const toCreate = selected.filter((o) => !vorhandeneObjektIds.has(o.id));

    // Reihenfolge = die per Drag festgelegte Liste (Smart-Sortierung wurde entfernt -
    // die Reihenfolge bestimmt ihr selbst)
    const startReihenfolge = signedStops.length ? Math.max(...signedStops.map((s) => s.reihenfolge)) + 1 : 0;
    const orderIdx = new Map(glasManualOrder.map((id, i) => [id, i]));

    // Behaltene offene Stopps: nur Reihenfolge (per Drag) und ggf. aktiv geänderte Notiz
    // aktualisieren - alle anderen Felder bleiben unverändert.
    for (const s of keptStops) {
      const updates = {};
      if (s.objekt_id && orderIdx.has(s.objekt_id)) updates.reihenfolge = startReihenfolge + orderIdx.get(s.objekt_id);
      if (s.objekt_id && glasTourNotizen.has(s.objekt_id)) {
        const n = glasTourNotizen.get(s.objekt_id);
        const neueNotiz = n.use ? (n.text || "").trim() : "";
        if (neueNotiz !== (s.notiz || "")) updates.notiz = neueNotiz;
      }
      // Händisch ergänzte Extra-Positionen an den bestehenden Stopp anhängen
      const extras = glasCleanExtras(s.objekt_id);
      if (extras.length) {
        let cur = [];
        try { cur = JSON.parse(s.positionen || "[]"); } catch (e) { cur = []; }
        updates.positionen = JSON.stringify([...(Array.isArray(cur) ? cur : []), ...extras]);
      }
      if (Object.keys(updates).length) await sb.from("glas_stopps").update(updates).eq("id", s.id);
    }

    const ordered = glasManualOrder.map((id) => toCreate.find((o) => o.id === id)).filter(Boolean);
    const stoppRows = ordered.map((o) => {
      const idx = orderIdx.has(o.id) ? orderIdx.get(o.id) : glasManualOrder.length;
      // Normalerweise gehen alle Positionen des Objekts auf den Schein. Kommt die Auswahl
      // aus "Jetzt planen" / der Offenen Liste (glasPreselectPositionen gesetzt), werden nur
      // die dort ausgewählten Positionen aufgenommen - so wird z.B. nicht versehentlich eine
      // noch nicht fällige Hubsteiger-Position mit "erledigt" markiert, nur weil man zufällig
      // gleichzeitig die fällige Glasreinigung am selben Objekt einplant.
      const alle = glasGetObjektPositionen(o.id);
      const auswahl = glasPreselectPositionen?.get(o.id);
      const positionenForStop = auswahl ? alle.filter((p) => auswahl.has(p.id) || auswahl.has(p.nr)) : alle;
      return {
        id: genCode(),
        tour_id: tourId,
        objekt_id: o.id,
        reihenfolge: startReihenfolge + idx,
        objekt: o.name,
        adresse: o.adresse,
        kdnr: o.kdnr,
        kunde_kdnr: glasKunden.find((k) => k.id === o.kunde_id)?.kdnr || "",
        kunde_adresse: o.kunde_adresse,
        ansprechpartner: o.ansprechpartner || "",
        telefon: o.telefon || "",
        hinweise: o.hinweise || "",
        notiz: (() => { const n = glasTourNotizen.get(o.id); return n && n.use ? (n.text || "").trim() : ""; })(),
        positionen: JSON.stringify([...positionenForStop.map((p) => ({ id: p.id, nr: p.nr, art: p.art, qm: p.qm })), ...glasCleanExtras(o.id)]),
        lat: o.lat,
        lng: o.lng,
        status: "offen",
      };
    });
    if (stoppRows.length) {
      const { error: stoppErr } = await sb.from("glas_stopps").insert(stoppRows);
      if (stoppErr) throw stoppErr;
    }

    showToast(
      failedNames.length
        ? `Gespeichert – Adresse(n) nicht gefunden, ans Ende gesetzt: ${failedNames.join(", ")}`
        : glasEditingTourId ? "Tour aktualisiert" : "Tour angelegt – erscheint jetzt im Mitarbeiter-Link"
    );
    glasPushSend("glas", "push_touren", "🚐 Touren", `${glasEditingTourId ? "Tour geändert" : "Neue Tour"}: ${name} – ${formatGlasDate(datum)}${datumBis ? " bis " + formatGlasDate(datumBis) : ""}`);
    glasSelectedObjekte.clear();
    glasManualOrder = [];
    glasPreselectPositionen = null;
    glasEditingTourId = null;
    glasShowNewTourForm = false;
    await Promise.all([loadGlasTouren(), loadGlasEingeplantePositionen()]);
  } catch (e) {
    showToast("Fehler: " + e.message);
  } finally {
    glasBusy = false;
    glasProgressText = "";
    renderGlasAdmin();
  }
}

async function editGlasTour(tourId) {
  const t = glasTouren.find((x) => x.id === tourId);
  if (!t) return;
  glasBusy = true;
  renderGlasAdmin();
  const { data } = await sb.from("glas_stopps").select("*").eq("tour_id", tourId).order("reihenfolge", { ascending: true });
  glasBusy = false;
  const stops = data || [];
  const allObjektIds = stops.map((s) => s.objekt_id).filter(Boolean);
  const unsignedObjektIds = stops.filter((s) => s.status !== "erledigt").map((s) => s.objekt_id).filter(Boolean);

  glasSelectedObjekte = new Set(allObjektIds);
  glasManualOrder = unsignedObjektIds; // aktuelle Reihenfolge der noch offenen Stopps beibehalten
  glasPreselectPositionen = null;
  // Notizen aus den BESTEHENDEN Stopps vorbefüllen (nicht aus den Objekt-Stammdaten) -
  // so zeigt das Formular, was wirklich auf dem Stopp steht, und unangetastete Notizen
  // bleiben beim Speichern exakt erhalten.
  glasTourNotizen = new Map();
  glasTourExtras = new Map();
  stops.filter((s) => s.status !== "erledigt" && s.objekt_id).forEach((s) => {
    glasTourNotizen.set(s.objekt_id, { use: !!s.notiz, text: s.notiz || "" });
  });
  glasEditingTourId = tourId;
  glasTourSearch = "";
  glasNewTour = { name: t.name || "", datum: t.datum || "", datum_bis: t.datum_bis || "", template: t.template || "geko", notiz: t.notiz || "" };
  glasShowNewTourForm = true;
  glasTourDetailId = null;
  renderGlasAdmin();
}

async function deleteGlasTour(tourId) {
  if (!confirm("Diese Tour ins Archiv verschieben? Du kannst sie dort jederzeit wiederherstellen oder endgültig löschen.")) return;
  const tourName = glasTouren.find((x) => x.id === tourId)?.name || "";
  const { error } = await sb.from("glas_touren").update({ archiviert_am: new Date().toISOString() }).eq("id", tourId);
  if (error) { showToast("Fehler: " + error.message); return; }
  showToast("Tour ins Archiv verschoben");
  glasTourDetailId = null;
  await Promise.all([loadGlasTouren(), loadGlasEingeplantePositionen()]);
  goGlasTab("touren");
}

async function restoreGlasTour(tourId) {
  const { error } = await sb.from("glas_touren").update({ archiviert_am: null }).eq("id", tourId);
  if (error) { showToast("Fehler: " + error.message); return; }
  showToast("Tour wiederhergestellt");
  glasTourDetailId = null;
  await Promise.all([loadGlasTouren(), loadGlasEingeplantePositionen()]);
  renderGlasAdmin();
}

async function deleteGlasTourEndgueltig(tourId) {
  if (!confirm("Diese Tour inkl. aller Abnahmescheine endgültig und unwiderruflich löschen?")) return;
  const { error } = await sb.from("glas_touren").delete().eq("id", tourId);
  if (error) { showToast("Fehler: " + error.message); return; }
  showToast("Endgültig gelöscht");
  await Promise.all([loadGlasTouren(), loadGlasEingeplantePositionen()]);
  renderGlasAdmin();
}

/* ========================================================================
   Freier Einzelschein
   ======================================================================== */

function openGlasEinzelschein() {
  glasShowEinzelschein = true;
  glasKundePickerSearch = "";
  glasEinzelscheinData = {
    kunde_id: glasKunden[0]?.id || "",
    kunde_name: glasKunden[0]?.name || "",
    kunde_adresse: glasKunden[0] ? [glasKunden[0].name, glasKunden[0].adresse].filter(Boolean).join("\n") : "",
    objekt_id: "",
    objekt: "",
    name: "",
    adresse: "",
    kdnr: "",
    template: "geko",
    positionen: [{ id: null, nr: "", art: "", qm: "", custom: false }],
  };
  renderGlasAdmin();
}

let glasEinzelscheinData = null;

// Einen bestehenden Einzelschein (freie Tour) im Einzelschein-Formular bearbeiten -
// NICHT im Touren-Objekt-Baukasten, der freie/handgeänderte Positionen nicht abbilden
// kann (genau das war die Ursache der "komischen vorausgewählten Positionen").
async function editEinzelschein(tourId) {
  const t = glasTouren.find((x) => x.id === tourId);
  if (!t) return;
  glasBusy = true; renderGlasAdmin();
  const { data } = await sb.from("glas_stopps").select("*").eq("tour_id", tourId).order("reihenfolge", { ascending: true });
  glasBusy = false;
  const stop = (data || [])[0];
  if (!stop) { showToast("Kein Stopp zu diesem Schein gefunden"); renderGlasAdmin(); return; }
  if (stop.status === "erledigt") { showToast("Bereits unterschrieben – kann nicht mehr bearbeitet werden"); renderGlasAdmin(); return; }

  const positionen = glasStopPositionen(stop).map((p) => ({
    id: p.id || null, nr: p.nr || "", art: p.art || "", qm: p.qm != null ? String(p.qm) : "",
    custom: !!p.art && !glasPositionen.some((sp) => sp.name === p.art),
  }));
  const kunde = glasKunden.find((k) => stop.kunde_id && k.id === stop.kunde_id)
    || glasKunden.find((k) => stop.kunde_kdnr && k.kdnr && stop.kunde_kdnr === k.kdnr)
    || glasKunden.find((k) => stop.kunde_adresse && k.name && stop.kunde_adresse.startsWith(k.name))
    || null;

  // Erst auf den Touren-Reiter navigieren (goGlasTab würde das Einzelschein-Flag gleich
  // wieder zurücksetzen - deshalb glasNavigate + Flags danach setzen).
  glasNavigate({ type: "tabs", tab: "touren" });
  glasShowNewTourForm = false;
  glasTourDetailId = null;
  glasKundePickerSearch = "";
  glasShowEinzelschein = true;
  glasEinzelscheinData = {
    edit_tour_id: tourId,
    edit_stop_id: stop.id,
    kunde_id: kunde?.id || "",
    kunde_name: kunde?.name || "",
    kunde_adresse: stop.kunde_adresse || "",
    objekt_id: stop.objekt_id || "",
    objekt: stop.objekt || "",
    name: t.name || "",
    adresse: stop.adresse || "",
    kdnr: stop.kdnr || "",
    template: t.template === "sub" ? "sub" : "geko",
    datum: t.datum || glasTodayIso(),
    positionen: positionen.length ? positionen : [{ id: null, nr: "", art: "", qm: "", custom: false }],
  };
  renderGlasAdmin();
}

function closeGlasEinzelschein() {
  glasShowEinzelschein = false;
  glasEinzelscheinData = null;
  renderGlasAdmin();
}

function renderEinzelscheinForm() {
  const d = glasEinzelscheinData;
  const istEdit = !!d.edit_tour_id;
  const objekteDesKunden = glasObjekte.filter((o) => o.kunde_id === d.kunde_id);
  const objektOptions = objekteDesKunden
    .map((o) => `<option value="${o.id}" ${o.id === d.objekt_id ? "selected" : ""}>${escapeHtml(o.name)}</option>`).join("");

  return `
    <button class="btn btn-sm" style="margin:16px 0;" onclick="closeGlasEinzelschein()">&larr; Zurück zu allen Touren</button>
    <div class="card">
      <h2>${istEdit ? "Blanko bearbeiten" : "Blanko erstellen"}</h2>
      <p class="muted" style="margin:0 0 12px;">Für spontane Termine ohne feste Routenplanung. Erscheint sofort im Mitarbeiter-Link.</p>
      <div class="field">
        <label class="muted">Kunde</label>
        <input type="text" id="es_kunde_search" placeholder="🔍 Kunde suchen (${glasKunden.length})..." value="${escapeHtml(glasKundePickerSearch)}" autocomplete="off" />
        <p class="muted" style="margin:5px 0 0; font-size:12.5px;">Gewählt: <b>${d.kunde_name ? escapeHtml(d.kunde_name) : "—"}</b></p>
        <div id="esKundeResults">${renderEsKundeResults()}</div>
      </div>
      <div class="field">
        <label class="muted">Bestehendes Objekt übernehmen (optional)</label>
        <select id="es_objekt" size="1" onchange="onEsObjektChange()" style="max-height:none;">
          <option value="" ${d.objekt_id ? "" : "selected"}>— frei eintragen —</option>
          ${objektOptions}
        </select>
        ${objekteDesKunden.length > 8 ? `<p class="muted" style="margin:4px 0 0; font-size:12px;">${objekteDesKunden.length} Objekte – im Auswahlfeld scrollen.</p>` : ""}
      </div>
      <div class="field">
        <label class="muted">Kunde-Adresse (Briefkopf)</label>
        <textarea id="es_kunde_adresse" rows="3">${escapeHtml(d.kunde_adresse)}</textarea>
      </div>
      <div class="field">
        <label class="muted">Objekt-Name</label>
        <input type="text" id="es_objekt_name" value="${escapeHtml(d.objekt)}" placeholder="z.B. Objekt Musterstraße" />
      </div>
      <div class="field">
        <label class="muted">Bezeichnung des Scheins (optional)</label>
        <input type="text" id="es_name" value="${escapeHtml(d.name || "")}" placeholder="Standard: „Einzelschein – ${escapeHtml(d.objekt || "Objektname")}"" />
        <p class="muted" style="margin:4px 0 0; font-size:12px;">So heißt der Schein in der Touren-Liste. Leer lassen = automatisch nach dem Objekt-Namen.</p>
      </div>
      <div class="field">
        <label class="muted">Adresse</label>
        <textarea id="es_adresse" rows="2" placeholder="Straße 1
44793 Bochum">${escapeHtml(d.adresse)}</textarea>
      </div>
      <div class="field">
        <label class="muted">Zusätzliche Dietrich Kd.-Nr. (optional, nur fürs Dietrich-Template – sonst gilt die Haupt-Kd.-Nr. des Kunden)</label>
        <input type="text" id="es_kdnr" value="${escapeHtml(d.kdnr)}" />
      </div>
      <div class="row">
        <div class="field">
          <label class="muted">Datum</label>
          <input type="date" id="es_datum" value="${d.datum || glasTodayIso()}" />
        </div>
        <div class="field">
          <label class="muted">Template</label>
          <select id="es_template">
            <option value="geko" ${d.template === "sub" ? "" : "selected"}>GEKO Clean</option>
            <option value="sub" ${d.template === "sub" ? "selected" : ""}>Subunternehmen (Dietrich)</option>
          </select>
        </div>
      </div>
      <label class="muted">Positionen</label>
      ${renderEsPositionenRows(d.positionen)}
      <button class="btn btn-sm" style="margin:8px 0 4px;" onclick="addEsPositionRow()">+ Position hinzufügen</button>
      <button class="btn btn-primary" style="margin-top:14px;" onclick="saveEinzelschein()" ${glasBusy ? "disabled" : ""}>
        ${glasBusy ? `<span class="spinner"></span> ${istEdit ? "Wird gespeichert..." : "Wird angelegt..."}` : (istEdit ? "Änderungen speichern" : "Schein erstellen")}
      </button>
    </div>
  `;
}

function renderEsPositionenRows(positionen) {
  return positionen
    .map((pos, i) => `
      <div class="card glas-pos-row" style="padding:14px 40px 14px 14px; margin-bottom:10px; background:var(--bg);">
        ${positionen.length > 1 ? `<button type="button" class="glas-pos-remove" title="Position entfernen" onclick="removeEsPositionRow(${i})">✕</button>` : ""}
        <div class="row" style="align-items:flex-end; margin-bottom:${pos.custom ? "8px" : "0"};">
          <div class="field" style="flex:2; margin-bottom:0;">
            <label class="muted">Position</label>
            <select id="es_pos_art_${i}" onchange="onEsPositionArtChange(${i})">${glasPositionSelectOptions(pos)}</select>
          </div>
          <div class="field" style="flex:1; margin-bottom:0;">
            <label class="muted">QM</label>
            <input type="text" id="es_pos_qm_${i}" value="${escapeHtml(pos.qm)}" />
          </div>
        </div>
        ${pos.custom ? `
        <div class="row" style="align-items:flex-end;">
          <div class="field" style="flex:0 0 70px; margin-bottom:0;">
            <label class="muted">Nr.</label>
            <input type="text" id="es_pos_custom_nr_${i}" value="${escapeHtml(pos.nr)}" placeholder="–" />
          </div>
          <div class="field" style="flex:2; margin-bottom:0;">
            <label class="muted">Bezeichnung</label>
            <input type="text" id="es_pos_custom_art_${i}" value="${escapeHtml(pos.art)}" placeholder="z.B. Sonderreinigung Fassade" />
          </div>
        </div>` : ""}
      </div>`)
    .join("");
}

function onEsPositionArtChange(i) {
  syncEsFromDom();
  const select = document.getElementById(`es_pos_art_${i}`);
  const val = select.value;
  const pos = glasEinzelscheinData.positionen[i];
  if (val === GLAS_CUSTOM_POS) {
    pos.custom = true;
    pos.art = "";
    pos.nr = "";
  } else {
    pos.custom = false;
    pos.art = val;
    pos.nr = select.options[select.selectedIndex]?.getAttribute("data-nr") || pos.nr;
  }
  // Leistung geändert -> nicht mehr die übernommene Objekt-Position; deren Fälligkeit
  // darf beim Unterschreiben dieses Scheins nicht mehr zurückgesetzt werden
  pos.id = null;
  renderGlasAdmin();
}

function syncEsFromDom() {
  const d = glasEinzelscheinData;
  d.positionen = d.positionen.map((pos, i) => ({
    ...pos,
    nr: pos.custom ? (document.getElementById(`es_pos_custom_nr_${i}`)?.value.trim() ?? pos.nr) : pos.nr,
    art: pos.custom ? (document.getElementById(`es_pos_custom_art_${i}`)?.value.trim() ?? pos.art) : pos.art,
    qm: document.getElementById(`es_pos_qm_${i}`)?.value.trim() ?? pos.qm,
  }));
  d.kunde_adresse = document.getElementById("es_kunde_adresse")?.value ?? d.kunde_adresse;
  d.objekt = document.getElementById("es_objekt_name")?.value ?? d.objekt;
  d.name = document.getElementById("es_name")?.value ?? d.name;
  d.adresse = document.getElementById("es_adresse")?.value ?? d.adresse;
  d.kdnr = document.getElementById("es_kdnr")?.value ?? d.kdnr;
  d.template = document.getElementById("es_template")?.value ?? d.template;
}

function addEsPositionRow() {
  syncEsFromDom();
  glasEinzelscheinData.positionen.push({ id: null, nr: "", art: "", qm: "", custom: false });
  renderGlasAdmin();
}
function removeEsPositionRow(idx) {
  syncEsFromDom();
  glasEinzelscheinData.positionen.splice(idx, 1);
  renderGlasAdmin();
}

// Such-Trefferliste für die Kundenauswahl im Einzelschein (statt eines langen Dropdowns -
// bei 100+ Kunden tippt man den Namen an). Zeigt bis zu 12 Treffer als klickbare Zeilen.
function renderEsKundeResults() {
  const q = (glasKundePickerSearch || "").trim().toLowerCase();
  if (!q) return "";
  const treffer = glasKunden
    .filter((k) => glasSearchMatch(`${k.name} ${k.kdnr || ""} ${k.adresse || ""}`, q))
    .slice(0, 12);
  if (!treffer.length) return `<p class="muted" style="margin:6px 0 0; font-size:12.5px;">Kein Kunde gefunden.</p>`;
  return `<div class="card glas-tour-search-list" style="padding:0; overflow-y:auto; max-height:240px; margin-top:6px;">
    ${treffer.map((k) => `
      <div class="glas-tour-search-row${k.id === glasEinzelscheinData.kunde_id ? " selected" : ""}" onclick="selectEsKunde('${k.id}')">
        <span><span style="font-weight:500;">${escapeHtml(k.name)}</span>${k.kdnr ? `<span class="muted" style="font-size:12px;"> · ${escapeHtml(k.kdnr)}</span>` : ""}</span>
      </div>`).join("")}
  </div>`;
}

function selectEsKunde(id) {
  syncEsFromDom();
  const kunde = glasKunden.find((k) => k.id === id);
  if (kunde) {
    glasEinzelscheinData.kunde_id = kunde.id;
    glasEinzelscheinData.kunde_name = kunde.name;
    glasEinzelscheinData.kunde_adresse = [kunde.name, kunde.adresse].filter(Boolean).join("\n");
  }
  glasKundePickerSearch = ""; // Auswahl getroffen -> Suche zuklappen
  renderGlasAdmin();
}

function onEsObjektChange() {
  syncEsFromDom();
  const sel = document.getElementById("es_objekt");
  const o = glasObjekte.find((x) => x.id === sel.value);
  if (o) {
    glasEinzelscheinData.objekt_id = o.id;
    glasEinzelscheinData.objekt = o.name;
    glasEinzelscheinData.adresse = o.adresse;
    glasEinzelscheinData.kdnr = o.kdnr;
    glasEinzelscheinData.template = o.template === "sub" ? "sub" : "geko";
    const positionen = glasGetObjektPositionen(o.id);
    if (positionen.length) {
      glasEinzelscheinData.positionen = positionen.map((p) => ({
        id: p.id || null, nr: p.nr, art: p.art, qm: p.qm,
        custom: !!p.art && !glasPositionen.some((sp) => sp.name === p.art),
      }));
    }
  } else {
    glasEinzelscheinData.objekt_id = "";
  }
  renderGlasAdmin();
}

async function saveEinzelschein() {
  if (glasBusy) return;
  syncEsFromDom();
  const d = glasEinzelscheinData;
  const datum = document.getElementById("es_datum").value;
  const template = document.getElementById("es_template").value;
  if (!d.objekt.trim()) { showToast("Bitte einen Objekt-Namen eintragen"); return; }
  if (!d.adresse.trim()) { showToast("Bitte eine Adresse eintragen"); return; }

  glasBusy = true;
  renderGlasAdmin();

  let coords = { lat: null, lng: null };
  if (d.objekt_id) {
    const o = glasObjekte.find((x) => x.id === d.objekt_id);
    coords = { lat: o?.lat, lng: o?.lng };
  } else {
    try {
      const { strasse, plz, ort } = glasSplitAdresse(d.adresse);
      coords = await glasGeocode(`${strasse}, ${plz} ${ort}`);
    } catch (e) { /* keine Koordinaten - für einen Einzelschein nicht kritisch */ }
  }

  const istEdit = !!d.edit_tour_id;
  const tourId = d.edit_tour_id || genCode();
  // id unbedingt mitschreiben: nur so setzt das Unterschreiben "zuletzt gereinigt" der
  // Objekt-Position zurück und die Position zählt als "eingeplant" (war der Grund, warum
  // per Blanko erledigte Objekte weiter als fällig standen).
  const positionen = d.positionen.filter((p) => p.art || p.qm).map((p) => ({ id: p.id || null, nr: p.nr, art: p.art, qm: p.qm }));
  const esObjekt = d.objekt_id ? glasObjekte.find((x) => x.id === d.objekt_id) : null;

  const tourName = (d.name || "").trim() || `Einzelschein – ${d.objekt}`;
  const { error: tourErr } = await sb.from("glas_touren").upsert({
    id: tourId, name: tourName, datum: datum || null, template, frei: true,
  });
  if (tourErr) { glasBusy = false; showToast("Fehler: " + tourErr.message); renderGlasAdmin(); return; }

  // Beim Bearbeiten NUR die editierbaren Felder des bestehenden Stopps aktualisieren -
  // Status/Unterschrift bleiben unangetastet. Beim Neuanlegen einen frischen Stopp einfügen.
  const stopFelder = {
    objekt_id: d.objekt_id || null,
    // Kunde am Stopp verankern: so taucht auch ein Blanko OHNE gewähltes Objekt sicher
    // im Verlauf/Termine-Reiter des Kunden auf.
    kunde_id: d.kunde_id || "",
    objekt: d.objekt, adresse: d.adresse, kdnr: d.kdnr,
    kunde_kdnr: glasKunden.find((k) => k.id === d.kunde_id)?.kdnr || "",
    kunde_adresse: d.kunde_adresse,
    positionen: JSON.stringify(positionen), lat: coords.lat, lng: coords.lng,
  };
  const stopSchreiben = async (felder) => istEdit
    ? sb.from("glas_stopps").update(felder).eq("id", d.edit_stop_id)
    : sb.from("glas_stopps").insert({
        id: genCode(), tour_id: tourId, reihenfolge: 0, status: "offen",
        ansprechpartner: esObjekt?.ansprechpartner || "",
        telefon: esObjekt?.telefon || "",
        hinweise: esObjekt?.hinweise || "",
        notiz: esObjekt?.notiz || "",
        ...felder,
      });
  let { error: stoppErr } = await stopSchreiben(stopFelder);
  if (stoppErr && /kunde_id/.test(stoppErr.message || "")) {
    // Spalte existiert noch nicht (SQL-Datei nicht ausgeführt) - ohne kunde_id speichern
    const { kunde_id, ...ohne } = stopFelder;
    ({ error: stoppErr } = await stopSchreiben(ohne));
  }
  if (stoppErr) { glasBusy = false; showToast("Fehler: " + stoppErr.message); renderGlasAdmin(); return; }

  glasPushSend("glas", "push_touren", "🚐 Touren", `${istEdit ? "Einzelschein geändert" : "Einzelschein angelegt"}: ${tourName}${datum ? " – " + formatGlasDate(datum) : ""}`);

  // Erst die Daten neu laden, DANN das Formular schließen und rendern - so ist der
  // Schein in der Touren-Liste sofort da (nicht erst nach manuellem Aktualisieren).
  await Promise.all([loadGlasTouren(), loadGlasEingeplantePositionen()]);
  glasBusy = false;
  showToast(istEdit ? "Blanko gespeichert" : "Blanko erstellt – erscheint jetzt im Mitarbeiter-Link");
  closeGlasEinzelschein();
}

/* ========================================================================
   Kalender-Tab (Geplant + Offene Liste)
   ======================================================================== */

function renderKalenderTab() {
  if (glasTerminEditing) return renderTerminForm();
  if (glasTerminViewing) return renderTerminView();
  return `
    <div style="display:flex; gap:8px; align-items:center; margin:12px 0 10px;">
      <div class="glas-seg" style="flex:1;">
        <button class="glas-seg-btn ${glasKalenderAnsicht === "termine" ? "on" : ""}" onclick="glasKalenderAnsicht='termine'; glasUpdateTabContent();">📅 Termine</button>
        <button class="glas-seg-btn ${glasKalenderAnsicht === "urlaub" ? "on" : ""}" onclick="glasKalenderAnsicht='urlaub'; glasUpdateTabContent();">🏖️ Urlaub</button>
      </div>
      ${glasCalApp ? `<button class="btn btn-sm" style="flex:0 0 auto;" title="Einstellungen (Benachrichtigungen, Design)" onclick="goGlasTab('einstellungen')">⚙️</button>` : ""}
    </div>
    ${glasKalenderAnsicht === "urlaub" ? renderUrlaubKalender() : renderKalenderMonat()}
    ${glasKalenderAnsicht === "termine" ? `<button class="glas-fab" title="Termin eintragen" onclick="openGlasTermin(null)">+</button>` : ""}
  `;
}

let glasKalenderAnsicht = "termine"; // "termine" | "urlaub"
let glasUrlaubMaFilter = null;   // ausgewählter Mitarbeiter (id) für Hervorhebung + Statistik
let glasUrlaubEditing = null;    // Urlaubs-Eintrag im Formular
let glasMaEditing = null;        // Mitarbeiter im Formular
let glasUrlaubVerwaltung = false; // Mitarbeiter-Verwaltung offen

const GLAS_MA_FARBEN = ["#3b82c4", "#e0682f", "#8b5cbf", "#2e9e4f", "#c0392b", "#d69e2e", "#0d9488", "#db2777", "#5b6b7b"];
function glasMaFarbe(maId) {
  const idx = glasMitarbeiter.findIndex((m) => m.id === maId);
  return GLAS_MA_FARBEN[(idx < 0 ? 0 : idx) % GLAS_MA_FARBEN.length];
}
function glasMaName(maId) {
  return glasMitarbeiter.find((m) => m.id === maId)?.name || "?";
}

// Zählt Urlaubstage in mehreren Zeiträumen für ein Jahr, getrennt nach Arbeitswoche:
// Mo-Fr (ohne Sa+So) und Mo-Sa (ohne So). So sieht man je nach MA-Modell den richtigen Wert.
function glasZaehleUrlaubstage(ranges, jahr) {
  let moFr = 0, moSa = 0;
  ranges.forEach((r) => {
    let d = new Date(r.von + "T00:00:00");
    const end = new Date((r.bis || r.von) + "T00:00:00");
    let guard = 0;
    while (d <= end && guard++ < 800) {
      if (d.getFullYear() === jahr) {
        const wd = d.getDay(); // 0=So ... 6=Sa
        if (wd !== 0) moSa++;
        if (wd !== 0 && wd !== 6) moFr++;
      }
      d.setDate(d.getDate() + 1);
    }
  });
  return { moFr, moSa };
}

// Urlaubs-Bilanz eines Mitarbeiters: Jahres-Anspruch minus genommene Tage = Rest.
// "genommen" zählt je nach Arbeitswoche (Mo–Fr oder Mo–Sa) die passenden Tage.
function glasUrlaubBilanz(m, jahr) {
  const meine = glasUrlaub.filter((u) => u.mitarbeiter_id === m.id);
  const { moFr, moSa } = glasZaehleUrlaubstage(meine, jahr);
  const genommen = m.arbeitstage === "mo_sa" ? moSa : moFr;
  const anspruch = m.urlaubsanspruch != null ? m.urlaubsanspruch : 30;
  return { anspruch, genommen, uebrig: anspruch - genommen, moFr, moSa };
}

function renderUrlaubKalender() {
  if (glasUrlaubEditing) return renderUrlaubForm();
  if (glasMaEditing !== null) return renderMaForm();
  if (glasUrlaubVerwaltung) return renderMaVerwaltung();

  // Mitarbeiter-Auswahl (Chips)
  const chips = `
    <div style="display:flex; gap:7px; flex-wrap:wrap; align-items:center; margin-bottom:12px;">
      <button class="glas-ma-chip ${glasUrlaubMaFilter === null ? "on" : ""}" onclick="glasUrlaubMaFilter=null; glasUpdateTabContent();">Alle</button>
      ${glasMitarbeiter.map((m) => `
        <button class="glas-ma-chip ${glasUrlaubMaFilter === m.id ? "on" : ""}" onclick="glasUrlaubMaFilter='${m.id}'; glasUpdateTabContent();">
          <span class="glas-ma-dot" style="background:${glasMaFarbe(m.id)};"></span>${escapeHtml(m.name)}
        </button>`).join("")}
    </div>`;

  // Statistik-Karte, wenn ein MA ausgewählt ist
  let statCard = "";
  if (glasUrlaubMaFilter) {
    const m = glasMitarbeiter.find((x) => x.id === glasUrlaubMaFilter);
    const jahr = new Date().getFullYear();
    const meine = glasUrlaub.filter((u) => u.mitarbeiter_id === glasUrlaubMaFilter);
    const b = m ? glasUrlaubBilanz(m, jahr) : { anspruch: 0, genommen: 0, uebrig: 0 };
    const uebrigFarbe = b.uebrig < 0 ? "var(--danger)" : b.uebrig <= 3 ? "#d08a1f" : "#2e9e4f";
    const liste = [...meine].sort((a, b) => (a.von || "").localeCompare(b.von || ""));
    statCard = `
      <div class="card" style="border-left:4px solid ${glasMaFarbe(glasUrlaubMaFilter)};">
        <p style="margin:0 0 2px; font-weight:700;">${escapeHtml(m ? m.name : "")} <span class="muted" style="font-weight:400;">· ${m && m.arbeitstage === "mo_sa" ? "arbeitet Mo–Sa" : "arbeitet Mo–Fr"}</span></p>
        <p class="muted" style="margin:0 0 10px;">Urlaub ${jahr}</p>
        <div style="display:flex; gap:10px;">
          <div class="glas-stat" style="flex:1;">
            <span class="glas-stat-num">${b.anspruch}</span><span class="glas-stat-label">Anspruch</span>
          </div>
          <div class="glas-stat" style="flex:1;">
            <span class="glas-stat-num">${b.genommen}</span><span class="glas-stat-label">Genommen</span>
          </div>
          <div class="glas-stat" style="flex:1; background:${uebrigFarbe}1a; border-color:${uebrigFarbe}55;">
            <span class="glas-stat-num" style="color:${uebrigFarbe};">${b.uebrig}</span><span class="glas-stat-label">Übrig</span>
          </div>
        </div>
        <p class="muted" style="margin:10px 0 6px; font-size:12px;">${b.uebrig < 0 ? `⚠️ <b style="color:var(--danger);">${Math.abs(b.uebrig)} Tage über dem Anspruch.</b>` : `Noch <b>${b.uebrig} von ${b.anspruch} Tagen</b> übrig.`} Gezählt werden ${m && m.arbeitstage === "mo_sa" ? "Mo–Sa" : "Mo–Fr"}-Tage.</p>
        ${liste.length ? `<div style="border-top:1px solid var(--border); padding-top:6px;">${liste.map((u) => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:7px 0; border-top:1px solid var(--border);">
            <span style="font-size:13px;">${formatGlasDateRange(u.von, u.bis)}${u.notiz ? ` · ${escapeHtml(u.notiz)}` : ""}</span>
            <span style="display:flex; gap:6px;">
              <button class="btn btn-sm" onclick="glasOpenUrlaub('${u.id}')">Bearb.</button>
            </span>
          </div>`).join("")}</div>` : `<p class="muted" style="margin:6px 0 0;">Noch kein Urlaub eingetragen.</p>`}
      </div>`;
  }

  return `
    ${chips}
    ${statCard}
    <div style="display:flex; justify-content:flex-end; gap:8px; margin:0 0 4px;">
      <button class="btn btn-sm" onclick="glasUrlaubVerwaltung=true; renderGlasAdmin();">⚙️ Mitarbeiter</button>
      <button class="btn btn-sm btn-primary" onclick="glasOpenUrlaub(null)">+ Urlaub eintragen</button>
    </div>
    ${renderUrlaubMonat()}
  `;
}

function renderUrlaubMonat() {
  const { year, month } = glasKalenderMonth;
  const monatsNamen = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const todayIso = glasTodayIso();
  const weeks = glasWeeksInRange({ year, month }, { year, month });

  let urlaube = glasUrlaub;
  if (glasUrlaubMaFilter) urlaube = urlaube.filter((u) => u.mitarbeiter_id === glasUrlaubMaFilter);
  const events = urlaube.map((u) => ({
    datum: u.von, datum_bis: u.bis || u.von,
    bg: glasMaFarbe(u.mitarbeiter_id), fg: "#fff",
    label: glasMaName(u.mitarbeiter_id),
  }));

  const maxChips = 6;
  const cellsHtml = weeks.flat().map((iso) => {
    const d = parseInt(iso.slice(8, 10), 10);
    const isToday = iso === todayIso;
    const inMonth = parseInt(iso.slice(5, 7), 10) - 1 === month;
    const dayEvents = events.filter((t) => iso >= t.datum && iso <= (t.datum_bis || t.datum));
    const chips = dayEvents.slice(0, maxChips).map((t) => {
      const contLeft = t.datum < iso, contRight = (t.datum_bis || t.datum) > iso;
      return `<div class="glas-cal-chip${contLeft ? " continues-left" : ""}${contRight ? " continues-right" : ""}" style="background:${t.bg}; color:${t.fg};">${contLeft ? "&nbsp;" : escapeHtml(t.label)}</div>`;
    }).join("");
    const more = dayEvents.length > maxChips ? `<div class="glas-cal-more">+${dayEvents.length - maxChips}</div>` : "";
    return `
      <div class="glas-cal-cell${inMonth ? "" : " out-month"}" onclick="glasOpenUrlaubAmTag('${iso}')">
        <span class="glas-cal-daynum${isToday ? " is-today" : ""}">${d}</span>
        ${chips}${more}
      </div>`;
  }).join("");

  return `
    <div class="card glas-cal-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:0 6px;">
        <button class="btn btn-sm" onclick="glasKalenderShiftMonth(-1)">‹</button>
        <p style="margin:0; font-weight:700; font-size:17px;">${monatsNamen[month]} ${year}</p>
        <button class="btn btn-sm" onclick="glasKalenderShiftMonth(1)">›</button>
      </div>
      <div class="glas-cal-grid" style="margin-bottom:4px;">
        ${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => `<div class="muted" style="text-align:center; font-size:11px; font-weight:600;">${d}</div>`).join("")}
      </div>
      <div class="glas-cal-grid">${cellsHtml}</div>
      <p class="muted" style="margin:10px 6px 0; font-size:12px;">Auf einen Tag tippen, um Urlaub ab diesem Tag einzutragen.</p>
    </div>`;
}

function glasOpenUrlaubAmTag(iso) {
  if (!glasMitarbeiter.length) { showToast("Erst einen Mitarbeiter anlegen (⚙️ Mitarbeiter)"); glasUrlaubVerwaltung = true; renderGlasAdmin(); return; }
  glasUrlaubEditing = { id: null, mitarbeiter_id: glasUrlaubMaFilter || glasMitarbeiter[0].id, von: iso, bis: iso, notiz: "" };
  renderGlasAdmin();
}
function glasOpenUrlaub(id) {
  if (!id) {
    if (!glasMitarbeiter.length) { showToast("Erst einen Mitarbeiter anlegen (⚙️ Mitarbeiter)"); glasUrlaubVerwaltung = true; renderGlasAdmin(); return; }
    glasUrlaubEditing = { id: null, mitarbeiter_id: glasUrlaubMaFilter || glasMitarbeiter[0].id, von: glasTodayIso(), bis: glasTodayIso(), notiz: "" };
  } else {
    glasUrlaubEditing = { ...glasUrlaub.find((u) => u.id === id) };
  }
  renderGlasAdmin();
}

function renderUrlaubForm() {
  const u = glasUrlaubEditing;
  return `
    <button class="btn btn-sm" style="margin:4px 0 14px;" onclick="glasUrlaubEditing=null; renderGlasAdmin();">&larr; Zurück</button>
    <div class="card">
      <h2>${u.id ? "Urlaub bearbeiten" : "Urlaub eintragen"}</h2>
      <div class="field">
        <label class="muted">Mitarbeiter</label>
        <select id="u_ma">${glasMitarbeiter.map((m) => `<option value="${m.id}" ${m.id === u.mitarbeiter_id ? "selected" : ""}>${escapeHtml(m.name)}</option>`).join("")}</select>
      </div>
      <div class="row">
        <div class="field"><label class="muted">Von</label><input type="date" id="u_von" value="${u.von || ""}" /></div>
        <div class="field"><label class="muted">Bis</label><input type="date" id="u_bis" value="${u.bis || u.von || ""}" /></div>
      </div>
      <div class="field"><label class="muted">Notiz (optional)</label><input type="text" id="u_notiz" value="${escapeHtml(u.notiz || "")}" placeholder="z.B. Sommerurlaub" /></div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-primary" onclick="saveGlasUrlaub()">Speichern</button>
        ${u.id ? `<button class="btn btn-sm" style="color:var(--danger); margin-left:auto;" onclick="deleteGlasUrlaub('${u.id}')">Löschen</button>` : ""}
      </div>
    </div>`;
}

async function saveGlasUrlaub() {
  const u = glasUrlaubEditing;
  const mitarbeiter_id = document.getElementById("u_ma").value;
  const von = document.getElementById("u_von").value;
  let bis = document.getElementById("u_bis").value || von;
  if (!von) { showToast("Bitte ein Von-Datum wählen"); return; }
  if (bis < von) bis = von;
  const payload = { id: u.id || genCode(), mitarbeiter_id, von, bis, notiz: (document.getElementById("u_notiz").value || "").trim() };
  const { error } = await sb.from("glas_urlaub").upsert(payload);
  if (error) { showToast("Fehler: " + error.message + " (SQL schon ausgeführt?)"); return; }
  showToast("Urlaub gespeichert");
  glasUrlaubEditing = null;
  await loadGlasUrlaub();
  renderGlasAdmin();
}

async function deleteGlasUrlaub(id) {
  if (!confirm("Diesen Urlaubseintrag löschen?")) return;
  const { error } = await sb.from("glas_urlaub").delete().eq("id", id);
  if (error) { showToast("Fehler: " + error.message); return; }
  showToast("Urlaub gelöscht");
  glasUrlaubEditing = null;
  await loadGlasUrlaub();
  renderGlasAdmin();
}

// ---- Mitarbeiter-Verwaltung ----
function renderMaVerwaltung() {
  return `
    <button class="btn btn-sm" style="margin:4px 0 14px;" onclick="glasUrlaubVerwaltung=false; renderGlasAdmin();">&larr; Zurück zum Urlaubskalender</button>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <h2 style="margin:0;">Mitarbeiter</h2>
      <button class="btn btn-sm btn-primary" onclick="glasMaEditing={id:null,name:'',arbeitstage:'mo_fr',urlaubsanspruch:30}; renderGlasAdmin();">+ Neuer Mitarbeiter</button>
    </div>
    ${glasMitarbeiter.length ? glasMitarbeiter.map((m) => {
      const b = glasUrlaubBilanz(m, new Date().getFullYear());
      const uebrigFarbe = b.uebrig < 0 ? "var(--danger)" : b.uebrig <= 3 ? "#d08a1f" : "#2e9e4f";
      return `
      <div class="card" style="display:flex; align-items:center; gap:10px;">
        <span class="glas-ma-dot" style="background:${glasMaFarbe(m.id)}; width:14px; height:14px;"></span>
        <div style="flex:1;">
          <p style="margin:0; font-weight:600;">${escapeHtml(m.name)}</p>
          <p class="muted" style="margin:2px 0 0; font-size:12.5px;">${m.arbeitstage === "mo_sa" ? "Mo–Sa" : "Mo–Fr"} · <b style="color:${uebrigFarbe};">${b.uebrig} von ${b.anspruch} Urlaubstagen übrig</b></p>
        </div>
        <button class="btn btn-sm" onclick="glasMaEditing=${JSON.stringify(m).replace(/"/g, "&quot;")}; renderGlasAdmin();">Bearbeiten</button>
      </div>`;
    }).join("") : `<p class="muted">Noch keine Mitarbeiter angelegt.</p>`}
  `;
}

function renderMaForm() {
  const m = glasMaEditing;
  return `
    <button class="btn btn-sm" style="margin:4px 0 14px;" onclick="glasMaEditing=null; renderGlasAdmin();">&larr; Zurück</button>
    <div class="card">
      <h2>${m.id ? "Mitarbeiter bearbeiten" : "Neuer Mitarbeiter"}</h2>
      <div class="field"><label class="muted">Name</label><input type="text" id="ma_name" value="${escapeHtml(m.name || "")}" placeholder="z.B. Manuel" /></div>
      <div class="field">
        <label class="muted">Arbeitswoche (für die Urlaubstage-Zählung)</label>
        <select id="ma_tage" style="width:auto;">
          <option value="mo_fr" ${m.arbeitstage !== "mo_sa" ? "selected" : ""}>Mo–Fr (5-Tage-Woche)</option>
          <option value="mo_sa" ${m.arbeitstage === "mo_sa" ? "selected" : ""}>Mo–Sa (6-Tage-Woche)</option>
        </select>
      </div>
      <div class="field">
        <label class="muted">Urlaubstage pro Jahr</label>
        <input type="number" id="ma_anspruch" min="0" max="366" value="${m.urlaubsanspruch != null ? m.urlaubsanspruch : 30}" style="width:auto;" />
        <p class="muted" style="margin:4px 0 0; font-size:12px;">Die App zieht die genommenen Tage ab und zeigt dir den Rest an.</p>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-primary" onclick="saveGlasMa()">Speichern</button>
        ${m.id ? `<button class="btn btn-sm" style="color:var(--danger); margin-left:auto;" onclick="deleteGlasMa('${m.id}')">Löschen</button>` : ""}
      </div>
    </div>`;
}

async function saveGlasMa() {
  const m = glasMaEditing;
  const name = (document.getElementById("ma_name").value || "").trim();
  if (!name) { showToast("Bitte einen Namen eintragen"); return; }
  const anspruch = parseInt(document.getElementById("ma_anspruch").value, 10);
  const payload = { id: m.id || genCode(), name, arbeitstage: document.getElementById("ma_tage").value, urlaubsanspruch: isNaN(anspruch) ? 30 : Math.max(0, anspruch) };
  let { error } = await sb.from("glas_mitarbeiter").upsert(payload);
  if (error && /urlaubsanspruch/.test(error.message || "")) {
    // Spalte fehlt noch (neueste SQL-Datei nicht ausgeführt) - ohne Anspruch speichern
    delete payload.urlaubsanspruch;
    ({ error } = await sb.from("glas_mitarbeiter").upsert(payload));
    if (!error) showToast("Hinweis: Urlaubstage-Anspruch noch nicht gespeichert – bitte neueste SQL-Datei ausführen");
  }
  if (error) { showToast("Fehler: " + error.message + " (SQL schon ausgeführt?)"); return; }
  showToast("Mitarbeiter gespeichert");
  glasMaEditing = null;
  await loadGlasMitarbeiter();
  renderGlasAdmin();
}

async function deleteGlasMa(id) {
  const anzahl = glasUrlaub.filter((u) => u.mitarbeiter_id === id).length;
  if (!confirm(anzahl ? `Diesen Mitarbeiter inkl. ${anzahl} Urlaubseintrag/-einträgen löschen?` : "Diesen Mitarbeiter löschen?")) return;
  if (anzahl) await sb.from("glas_urlaub").delete().eq("mitarbeiter_id", id);
  const { error } = await sb.from("glas_mitarbeiter").delete().eq("id", id);
  if (error) { showToast("Fehler: " + error.message); return; }
  showToast("Mitarbeiter gelöscht");
  glasMaEditing = null;
  if (glasUrlaubMaFilter === id) glasUrlaubMaFilter = null;
  await Promise.all([loadGlasMitarbeiter(), loadGlasUrlaub()]);
  renderGlasAdmin();
}

/* ---------------- Freie Termine (TimeTree-artig) ---------------- */

// Ein bestehender Termin öffnet zunächst nur die Ansehen-Ansicht (renderTerminView) -
// erst über den expliziten "Bearbeiten"-Button geht es in den Bearbeitungsmodus. Ein neuer
// Termin (id === null) springt weiterhin direkt ins leere Formular.
function openGlasTermin(id, presetDatum) {
  glasTerminMenuOpen = false;
  if (id === null) {
    glasTerminEditing = { id: null, titel: "", datum: presetDatum || glasKalenderSelectedDay || glasTodayIso(), datum_bis: "", farbe: "tuerkis", erinnerung: "", notiz: "", adresse: "", wiederholung: glasWiederholungToObj(""), anhaenge: [] };
    glasTerminViewing = null;
  } else {
    const t = { ...glasTermine.find((x) => x.id === id) };
    t.anhaenge = glasParseTerminAnhaenge(t);
    glasTerminViewing = t;
    glasTerminEditing = null;
  }
  renderGlasAdmin();
}

function glasParseTerminAnhaenge(t) {
  try {
    const a = JSON.parse(t.anhaenge || "[]");
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
}

function editGlasTerminFromView() {
  glasTerminEditing = { ...glasTerminViewing, wiederholung: glasWiederholungToObj(glasTerminViewing.wiederholung) };
  glasTerminViewing = null;
  renderGlasAdmin();
}

// Wiederholung normalisieren: aus dem DB-String (JSON) ein Formular-Objekt machen.
// Formular-Form: { freq:"nie"|"taeglich"|"woechentlich"|"monatlich"|"jaehrlich", wochentage:[0-6], ende:"" }
function glasWiederholungToObj(raw) {
  const leer = { freq: "nie", wochentage: [], ende: "" };
  if (!raw) return leer;
  if (typeof raw === "object") return { freq: raw.freq || "nie", wochentage: Array.isArray(raw.wochentage) ? raw.wochentage.slice() : [], ende: raw.ende || "" };
  try {
    const w = JSON.parse(raw);
    if (!w || !w.freq) return leer;
    return { freq: w.freq, wochentage: Array.isArray(w.wochentage) ? w.wochentage.slice() : [], ende: w.ende || "" };
  } catch (e) { return leer; }
}

function closeGlasTermin() {
  glasTerminEditing = null;
  glasTerminViewing = null;
  renderGlasAdmin();
}

function syncTerminFormFromDom() {
  if (!glasTerminEditing) return;
  const get = (id) => document.getElementById(id)?.value;
  if (get("tm_titel") !== undefined) glasTerminEditing.titel = get("tm_titel");
  if (get("tm_datum") !== undefined) glasTerminEditing.datum = get("tm_datum");
  if (get("tm_datum_bis") !== undefined) glasTerminEditing.datum_bis = get("tm_datum_bis");
  if (get("tm_erinnerung") !== undefined) glasTerminEditing.erinnerung = get("tm_erinnerung");
  if (get("tm_notiz") !== undefined) glasTerminEditing.notiz = get("tm_notiz");
  if (get("tm_adresse") !== undefined) glasTerminEditing.adresse = get("tm_adresse");
  if (get("tm_freq") !== undefined && glasTerminEditing.wiederholung) glasTerminEditing.wiederholung.freq = get("tm_freq");
  if (get("tm_wieder_ende") !== undefined && glasTerminEditing.wiederholung) glasTerminEditing.wiederholung.ende = get("tm_wieder_ende");
}

function setGlasTerminFarbe(farbe) {
  syncTerminFormFromDom();
  glasTerminEditing.farbe = farbe;
  renderGlasAdmin();
}

// "+ Wiederholung"-Chip: blendet die Wiederholungs-Steuerung ein
function glasTerminChipWiederholung() {
  syncTerminFormFromDom();
  glasTerminEditing.__wiederOffen = true;
  if (glasTerminEditing.wiederholung.freq === "nie") glasTerminEditing.wiederholung.freq = "woechentlich";
  renderGlasAdmin();
}

// "+ Adresse"-Chip: blendet das Adressfeld ein und springt hinein
function glasTerminChipAdresse() {
  syncTerminFormFromDom();
  glasTerminEditing.__adresseOffen = true;
  renderGlasAdmin();
  setTimeout(() => document.getElementById("tm_adresse")?.focus(), 60);
}

function glasTerminSetFreq(freq) {
  syncTerminFormFromDom();
  glasTerminEditing.wiederholung.freq = freq;
  if (freq === "woechentlich" && !glasTerminEditing.wiederholung.wochentage.length && glasTerminEditing.datum) {
    // Standard: der Wochentag des Startdatums ist vorausgewählt
    glasTerminEditing.wiederholung.wochentage = [new Date(glasTerminEditing.datum + "T00:00:00").getDay()];
  }
  renderGlasAdmin();
}

function glasTerminToggleWochentag(d) {
  syncTerminFormFromDom();
  const arr = glasTerminEditing.wiederholung.wochentage;
  const i = arr.indexOf(d);
  if (i >= 0) arr.splice(i, 1); else arr.push(d);
  renderGlasAdmin();
}

function renderTerminForm() {
  const t = glasTerminEditing;
  const farbChips = Object.keys(GLAS_TERMIN_FARBEN)
    .map((f) => {
      const c = GLAS_TERMIN_FARBEN[f];
      const active = t.farbe === f;
      return `<button type="button" onclick="setGlasTerminFarbe('${f}')" style="width:26px; height:26px; border-radius:50%; border:${active ? "3px solid var(--text)" : "2px solid var(--border)"}; background:${c.dot}; cursor:pointer; flex:0 0 auto; ${active ? "transform:scale(1.15);" : ""} transition:transform 0.15s ease;"></button>`;
    })
    .join("");
  const notizSichtbar = !!(t.notiz || t.__notizOffen);
  const w = t.wiederholung || { freq: "nie", wochentage: [], ende: "" };
  const wiederSichtbar = !!(t.__wiederOffen || w.freq !== "nie");
  const adresseSichtbar = !!(t.adresse || t.__adresseOffen);
  const freqLabels = { nie: "Nie", taeglich: "Täglich", woechentlich: "Wöchentlich", monatlich: "Monatlich", jaehrlich: "Jährlich" };
  const wochentagBtns = [
    { d: 1, l: "Mo" }, { d: 2, l: "Di" }, { d: 3, l: "Mi" }, { d: 4, l: "Do" }, { d: 5, l: "Fr" }, { d: 6, l: "Sa" }, { d: 0, l: "So" },
  ].map(({ d, l }) => {
    const on = (w.wochentage || []).includes(d);
    return `<button type="button" onclick="glasTerminToggleWochentag(${d})" style="width:34px; height:34px; border-radius:50%; border:1px solid ${on ? "var(--blue)" : "var(--border)"}; background:${on ? "var(--blue)" : "transparent"}; color:${on ? "#fff" : "var(--text)"}; font-size:12px; font-weight:600; cursor:pointer; flex:0 0 auto;">${l}</button>`;
  }).join("");

  return `
    <div class="glas-termin-sheet glas-screen-in">
      <div class="glas-sheet-top">
        <button class="btn btn-sm" onclick="closeGlasTermin()">✕</button>
        <button class="btn btn-primary" style="border-radius:100px; padding:8px 18px;" onclick="saveGlasTermin()" ${glasBusy ? "disabled" : ""}>Speichern</button>
      </div>
      <input type="text" id="tm_titel" class="glas-sheet-titel" value="${escapeHtml(t.titel)}" placeholder="Titel" />

      <div class="glas-sheet-row">
        <span class="glas-sheet-ico">📅</span>
        <span>Beginn</span>
        <input type="date" id="tm_datum" value="${t.datum || ""}" style="width:auto; margin-left:auto;" />
      </div>
      <div class="glas-sheet-row">
        <span class="glas-sheet-ico"></span>
        <span class="muted">Ende <span style="font-size:11px;">(optional)</span></span>
        <input type="date" id="tm_datum_bis" value="${t.datum_bis || ""}" style="width:auto; margin-left:auto;" />
      </div>
      <div class="glas-sheet-row">
        <span class="glas-sheet-ico">🏷️</span>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">${farbChips}</div>
      </div>
      <div class="glas-sheet-row">
        <span class="glas-sheet-ico">⏰</span>
        <span>Erinnerung</span>
        <select id="tm_erinnerung" style="width:auto; margin-left:auto;">
          <option value="" ${!t.erinnerung ? "selected" : ""}>Keine</option>
          <option value="same_day" ${t.erinnerung === "same_day" ? "selected" : ""}>Am selben Tag</option>
          <option value="1d" ${t.erinnerung === "1d" ? "selected" : ""}>1 Tag vorher</option>
          <option value="2d" ${t.erinnerung === "2d" ? "selected" : ""}>2 Tage vorher</option>
          <option value="7d" ${t.erinnerung === "7d" ? "selected" : ""}>1 Woche vorher</option>
        </select>
      </div>

      ${wiederSichtbar ? `
      <div class="glas-sheet-row">
        <span class="glas-sheet-ico">🔁</span>
        <span>Wiederholung</span>
        <select id="tm_freq" onchange="glasTerminSetFreq(this.value)" style="width:auto; margin-left:auto;">
          ${Object.keys(freqLabels).map((f) => `<option value="${f}" ${w.freq === f ? "selected" : ""}>${freqLabels[f]}</option>`).join("")}
        </select>
      </div>
      ${w.freq === "woechentlich" ? `
      <div class="glas-sheet-row" style="align-items:flex-start;">
        <span class="glas-sheet-ico"></span>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">${wochentagBtns}</div>
      </div>` : ""}
      ${w.freq !== "nie" ? `
      <div class="glas-sheet-row">
        <span class="glas-sheet-ico"></span>
        <span class="muted">Endet am <span style="font-size:11px;">(optional)</span></span>
        <input type="date" id="tm_wieder_ende" value="${w.ende || ""}" style="width:auto; margin-left:auto;" />
      </div>` : ""}` : ""}

      ${adresseSichtbar ? `
      <div class="glas-sheet-row" style="align-items:flex-start;">
        <span class="glas-sheet-ico">📍</span>
        <input type="text" id="tm_adresse" value="${escapeHtml(t.adresse || "")}" placeholder="Adresse (für Route per Waze)" style="border:none; padding:2px 0; background:transparent; border-radius:0; margin-left:0;" />
      </div>` : ""}

      ${notizSichtbar ? `
      <div class="glas-sheet-row" style="align-items:flex-start;">
        <span class="glas-sheet-ico">📝</span>
        <textarea id="tm_notiz" rows="3" placeholder="Notiz..." style="border:none; padding:2px 0; background:transparent; border-radius:0;">${escapeHtml(t.notiz)}</textarea>
      </div>` : ""}

      ${(t.anhaenge || []).length ? `
      <div class="glas-sheet-row" style="align-items:flex-start;">
        <span class="glas-sheet-ico">📎</span>
        <div style="display:flex; flex-wrap:wrap; gap:10px;">
          ${t.anhaenge.map((a, i) => `
            <div style="position:relative; width:64px; height:64px;">
              <img src="${a.dataUrl}" style="width:64px; height:64px; object-fit:cover; border-radius:8px; border:1px solid var(--border);" />
              <button type="button" class="glas-pos-remove" style="top:-8px; right:-8px;" title="Anhang entfernen" onclick="removeGlasTerminAnhang(${i})">✕</button>
            </div>`).join("")}
        </div>
      </div>` : ""}

      <!-- Optionale Extras als +Chips (wie TimeTree): erst beim Antippen erscheint das Feld -->
      <div class="glas-sheet-chips">
        <span style="color:var(--danger); font-weight:700; font-size:17px;">+</span>
        ${!wiederSichtbar ? `<button class="glas-sheet-chip" onclick="glasTerminChipWiederholung()">🔁 Wiederholung</button>` : ""}
        ${!adresseSichtbar ? `<button class="glas-sheet-chip" onclick="glasTerminChipAdresse()">📍 Adresse</button>` : ""}
        ${!notizSichtbar ? `<button class="glas-sheet-chip" onclick="glasTerminChipNotiz()">📝 Notiz</button>` : ""}
        <button class="glas-sheet-chip" onclick="document.getElementById('tm_file').click()">📎 Datei</button>
      </div>
      <input type="file" id="tm_file" accept="image/*" multiple style="display:none;" onchange="handleGlasTerminFiles(this.files); this.value='';" />

      ${t.id ? `<button class="btn btn-sm" style="color:var(--danger); margin-top:18px;" onclick="deleteGlasTermin('${t.id}')">Termin löschen</button>` : ""}
    </div>`;
}

// "+ Notiz"-Chip: blendet das Notizfeld ein und springt direkt hinein
function glasTerminChipNotiz() {
  syncTerminFormFromDom();
  glasTerminEditing.__notizOffen = true;
  renderGlasAdmin();
  setTimeout(() => document.getElementById("tm_notiz")?.focus(), 60);
}

// Bilder werden vor dem Speichern per Canvas client-seitig stark verkleinert/komprimiert
// (max. 1000px Kante, JPEG q=0.6) - Termine landen sonst mit vollen Handyfotos in der DB.
function glasCompressImageFile(file, maxDim = 1000, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleGlasTerminFiles(fileList) {
  if (!glasTerminEditing) return;
  syncTerminFormFromDom();
  if (!glasTerminEditing.anhaenge) glasTerminEditing.anhaenge = [];
  for (const file of [...fileList]) {
    try {
      const dataUrl = await glasCompressImageFile(file);
      // In den Storage hochladen (URL statt Base64 in der DB); fällt bei fehlendem Bucket
      // automatisch auf die Base64-dataURL zurück (siehe app-shared.js)
      const stored = await uploadFotoToStorage(dataUrl, "termin");
      glasTerminEditing.anhaenge.push({ name: file.name, dataUrl: stored });
    } catch (e) {
      showToast("Anhang konnte nicht verarbeitet werden: " + file.name);
    }
  }
  renderGlasAdmin();
}

function removeGlasTerminAnhang(idx) {
  syncTerminFormFromDom();
  const [removed] = glasTerminEditing.anhaenge.splice(idx, 1);
  if (removed) deleteFotoFromStorage(removed.dataUrl);
  renderGlasAdmin();
}

// Read-only "Ansehen"-Ansicht: Öffnen eines bestehenden Termins zeigt zuerst nur diese
// Übersicht, Bearbeiten ist ein expliziter Schritt (statt sofort ins Formular zu springen).
let glasTerminMenuOpen = false;

// "Sa. 11. Juli 2026" - großes Datum wie im TimeTree-Detail
function glasDatumGross(iso) {
  if (!iso) return "";
  const wt = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const mo = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const d = new Date(iso + "T00:00:00");
  return `${wt[d.getDay()]}. ${d.getDate()}. ${mo[d.getMonth()]} ${d.getFullYear()}`;
}

// Menschenlesbare Wiederholungs-Beschreibung, z.B. "Wöchentlich (Mo, Mi, Fr) bis 31.12.2026"
function glasWiederholungLabel(raw) {
  const w = glasWiederholungToObj(raw);
  if (w.freq === "nie") return "";
  const wt = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  let s = { taeglich: "Täglich", woechentlich: "Wöchentlich", monatlich: "Monatlich", jaehrlich: "Jährlich" }[w.freq] || "";
  if (w.freq === "woechentlich" && w.wochentage && w.wochentage.length) {
    const tage = w.wochentage.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => wt[d]);
    s += ` (${tage.join(", ")})`;
  }
  if (w.ende) s += ` bis ${formatGlasDate(w.ende)}`;
  return s;
}

function renderTerminView() {
  const t = glasTerminViewing;
  const c = GLAS_TERMIN_FARBEN[t.farbe] || GLAS_TERMIN_FARBEN.tuerkis;
  const erinnerungLabel = { same_day: "Am selben Tag", "1d": "1 Tag vorher", "2d": "2 Tage vorher", "7d": "1 Woche vorher" }[t.erinnerung] || "Keine";
  const mehrtaegig = t.datum_bis && t.datum_bis !== t.datum;
  return `
    <div class="glas-termin-sheet glas-screen-in">
      <div class="glas-sheet-top">
        <button class="btn btn-sm" onclick="closeGlasTermin()">←</button>
        <div style="position:relative;">
          <button class="btn btn-sm" onclick="glasTerminMenuOpen = !glasTerminMenuOpen; renderGlasAdmin();">⋯</button>
          ${glasTerminMenuOpen ? `
          <div class="glas-menu-dd" style="position:absolute; right:0; top:38px; min-width:180px; margin:0; z-index:50;">
            <button class="glas-menu-item" onclick="glasTerminMenuOpen=false; editGlasTerminFromView();"><span>✏️ Bearbeiten</span></button>
            <button class="glas-menu-item" style="color:var(--danger);" onclick="glasTerminMenuOpen=false; deleteGlasTermin('${t.id}');"><span>🗑️ Löschen</span></button>
          </div>` : ""}
        </div>
      </div>

      ${(t.anhaenge || []).length ? `
      <div style="display:flex; gap:10px; overflow-x:auto; margin:0 0 14px; -webkit-overflow-scrolling:touch;">
        ${t.anhaenge.map((a) => `<a href="${a.dataUrl}" target="_blank" style="flex:0 0 auto;"><img src="${a.dataUrl}" style="height:130px; border-radius:12px; border:1px solid var(--border);" /></a>`).join("")}
      </div>` : ""}

      <div style="display:flex; align-items:center; gap:10px;">
        <span style="width:5px; align-self:stretch; border-radius:3px; background:${c.dot}; flex:0 0 auto;"></span>
        <h2 style="margin:0; font-size:20px;">${escapeHtml(t.titel)}</h2>
      </div>

      <div style="display:flex; align-items:center; gap:14px; margin:16px 0 4px; padding:0 2px;">
        <div>
          <p class="muted" style="margin:0; font-size:12px;">${t.datum ? t.datum.slice(0, 4) : ""}</p>
          <p style="margin:0; font-weight:700; font-size:${mehrtaegig ? "16px" : "19px"};">${glasDatumGross(t.datum)}</p>
        </div>
        ${mehrtaegig ? `
        <span style="color:${c.dot}; font-size:18px;">›</span>
        <div>
          <p class="muted" style="margin:0; font-size:12px;">${t.datum_bis.slice(0, 4)}</p>
          <p style="margin:0; font-weight:700; font-size:16px;">${glasDatumGross(t.datum_bis)}</p>
        </div>` : ""}
      </div>

      <div class="glas-sheet-row" style="margin-top:12px;">
        <span class="glas-sheet-ico">⏰</span><span>${erinnerungLabel}</span>
      </div>
      ${glasWiederholungLabel(t.wiederholung) ? `
      <div class="glas-sheet-row">
        <span class="glas-sheet-ico">🔁</span><span>${glasWiederholungLabel(t.wiederholung)}</span>
      </div>` : ""}
      ${t.adresse ? `
      <a class="glas-sheet-row" href="${wazeLink(t.adresse)}" target="_blank" rel="noopener" style="text-decoration:none; color:inherit;">
        <span class="glas-sheet-ico">📍</span>
        <span style="flex:1; min-width:0;">${escapeHtml(t.adresse)}</span>
        <span style="color:var(--blue); font-size:12px; font-weight:600; white-space:nowrap;">Route ›</span>
      </a>` : ""}
      ${t.notiz ? `
      <div class="glas-sheet-row" style="align-items:flex-start;">
        <span class="glas-sheet-ico">📝</span>
        <p style="margin:0; font-size:14px; white-space:pre-line;">${escapeHtml(t.notiz)}</p>
      </div>` : ""}
    </div>`;
}

async function saveGlasTermin() {
  if (glasBusy) return;
  syncTerminFormFromDom();
  const t = glasTerminEditing;
  if (!t.titel.trim()) { showToast("Bitte einen Titel eintragen"); return; }
  if (!t.datum) { showToast("Bitte ein Datum wählen"); return; }
  glasBusy = true;
  renderGlasAdmin();
  const payload = {
    id: t.id || genCode(),
    titel: t.titel.trim(),
    datum: t.datum,
    datum_bis: t.datum_bis || null,
    farbe: t.farbe || "tuerkis",
    erinnerung: t.erinnerung || "",
    notiz: t.notiz || "",
    adresse: (t.adresse || "").trim(),
    wiederholung: glasWiederholungToStr(t.wiederholung),
    anhaenge: JSON.stringify(t.anhaenge || []),
  };
  const warNeu = !t.id;
  let { error } = await sb.from("glas_termine").upsert(payload);
  if (error && /wiederholung|adresse/.test(error.message || "")) {
    // Spalten existieren noch nicht (neueste SQL-Datei nicht ausgeführt) - Termin
    // trotzdem ohne die neuen Felder speichern, statt komplett zu blockieren.
    delete payload.wiederholung;
    delete payload.adresse;
    ({ error } = await sb.from("glas_termine").upsert(payload));
    if (!error) showToast("Hinweis: Wiederholung/Adresse noch nicht gespeichert – bitte neueste SQL-Datei ausführen");
  }
  glasBusy = false;
  if (error) { showToast("Fehler: " + error.message); renderGlasAdmin(); return; }
  showToast("Termin gespeichert");
  glasPushSend("kalender", "push_kalender", "📅 Kalender", `${warNeu ? "Neuer Termin" : "Termin geändert"}: ${payload.titel} – ${formatGlasDate(payload.datum)}`);
  glasTerminEditing = null;
  glasKalenderSelectedDay = payload.datum;
  await loadGlasTermine();
  renderGlasAdmin();
}

async function deleteGlasTermin(id) {
  if (!confirm("Diesen Termin wirklich löschen?")) return;
  const geloeschterTitel = glasTermine.find((t) => t.id === id)?.titel || "";
  const { error } = await sb.from("glas_termine").delete().eq("id", id);
  if (error) { showToast("Fehler: " + error.message); return; }
  showToast("Termin gelöscht");
  glasPushSend("kalender", "push_kalender", "📅 Kalender", `Termin gelöscht: ${geloeschterTitel}`);
  glasTerminEditing = null;
  glasTerminViewing = null;
  await loadGlasTermine();
  renderGlasAdmin();
}

// Formular-Objekt -> DB-String. "Nie" wird als leerer String gespeichert (= einmaliger Termin).
function glasWiederholungToStr(w) {
  if (!w || !w.freq || w.freq === "nie") return "";
  const obj = { freq: w.freq };
  if (w.freq === "woechentlich" && Array.isArray(w.wochentage) && w.wochentage.length) obj.wochentage = w.wochentage.slice().sort((a, b) => a - b);
  if (w.ende) obj.ende = w.ende;
  return JSON.stringify(obj);
}

function glasDaysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}

// Alle Vorkommen eines Termins (inkl. Wiederholung) im Bereich [von, bis] als {datum, datum_bis}.
// Bei einmaligen Terminen ist das höchstens eines. Mehrtägige Termine behalten ihre Dauer.
function glasTerminVorkommen(t, von, bis) {
  if (!t.datum) return [];
  const dauer = t.datum_bis && t.datum_bis !== t.datum ? glasDaysBetween(t.datum, t.datum_bis) : 0;
  const w = glasWiederholungToObj(t.wiederholung);
  const out = [];
  const addOcc = (startIso) => {
    if (startIso < t.datum) return;
    const endIso = dauer ? glasAddDaysIso(startIso, dauer) : startIso;
    if (endIso >= von && startIso <= bis) out.push({ datum: startIso, datum_bis: dauer ? endIso : null });
  };
  if (w.freq === "nie") { addOcc(t.datum); return out; }
  // Nicht über das Ende der Wiederholung hinaus rechnen
  const hardStop = w.ende && w.ende < bis ? w.ende : bis;
  // Scan-Start etwas vor "von", damit mehrtägige Vorkommen, die schon vorher begonnen haben, erfasst werden
  const scanFrom = (() => {
    const back = glasAddDaysIso(von, -(dauer + 1));
    return back > t.datum ? back : t.datum;
  })();
  let guard = 0;
  if (w.freq === "taeglich") {
    let cur = scanFrom;
    while (cur <= hardStop && guard++ < 800) { addOcc(cur); cur = glasAddDaysIso(cur, 1); }
  } else if (w.freq === "woechentlich") {
    const tage = Array.isArray(w.wochentage) && w.wochentage.length ? w.wochentage : [new Date(t.datum + "T00:00:00").getDay()];
    let cur = scanFrom;
    while (cur <= hardStop && guard++ < 800) {
      if (tage.includes(new Date(cur + "T00:00:00").getDay())) addOcc(cur);
      cur = glasAddDaysIso(cur, 1);
    }
  } else if (w.freq === "monatlich") {
    let cur = t.datum;
    while (cur < scanFrom && guard++ < 600) cur = glasAddMonthsIso(cur, 1);
    while (cur <= hardStop && guard++ < 600) { addOcc(cur); cur = glasAddMonthsIso(cur, 1); }
  } else if (w.freq === "jaehrlich") {
    let cur = t.datum;
    while (cur < scanFrom && guard++ < 400) cur = glasAddMonthsIso(cur, 12);
    while (cur <= hardStop && guard++ < 400) { addOcc(cur); cur = glasAddMonthsIso(cur, 12); }
  } else {
    addOcc(t.datum);
  }
  return out;
}

function glasTermineAmTag(iso) {
  return glasTermine.filter((t) => t.datum && glasTerminVorkommen(t, iso, iso).length);
}

function glasTourenAmTag(iso) {
  return glasTouren.filter((t) => !t.archiviert_am && t.datum && iso >= t.datum && iso <= (t.datum_bis || t.datum));
}

// TimeTree-artige Ansicht: durchgehende Liste von Wochenzeilen, Touren als farbige Balken,
// die über die Tage laufen, auf die sie fallen (statt nur einem Punkt pro Tag). Mehrere
// Touren in derselben Woche stapeln sich in eigenen Zeilen ("Lanes"), wenn sie sich
// überschneiden.
// ISO-Kalenderwoche (Mo-So) für die KW-Spalte am linken Kalenderrand
function glasIsoWeek(iso) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

// Kalender-Ebenen: Touren (🚐) + Termine (📌) sind beim Öffnen IMMER an, Urlaub (🏖️)
// beim Öffnen IMMER aus. Die Schalter wirken nur für die aktuelle Kalender-Sitzung und
// werden bei jedem erneuten Öffnen zurückgesetzt (glasResetKalEbenen).
let glasKalSearchOpen = false;
let glasKalSearch = "";
let glasKalTourenEinblenden = true;
let glasKalTermineEinblenden = true;
let glasKalUrlaubEinblenden = false;

function glasResetKalEbenen() {
  glasKalTourenEinblenden = true;
  glasKalTermineEinblenden = true;
  glasKalUrlaubEinblenden = false;
}

function glasToggleKalSearch() {
  glasKalSearchOpen = !glasKalSearchOpen;
  if (!glasKalSearchOpen) glasKalSearch = "";
  glasUpdateTabContent();
  if (glasKalSearchOpen) setTimeout(() => document.getElementById("kal_search")?.focus(), 60);
}

function glasToggleKalTouren() { glasKalTourenEinblenden = !glasKalTourenEinblenden; glasUpdateTabContent(); }
function glasToggleKalTermine() { glasKalTermineEinblenden = !glasKalTermineEinblenden; glasUpdateTabContent(); }
function glasToggleKalUrlaub() { glasKalUrlaubEinblenden = !glasKalUrlaubEinblenden; glasUpdateTabContent(); }

// Sucht Termine, Touren und Objekte - direkt aus dem Kalender heraus
function renderKalenderSuchErgebnisse() {
  const q = glasKalSearch.trim().toLowerCase();
  if (q.length < 2) return `<p class="muted" style="margin:8px 2px 2px;">Mindestens 2 Zeichen eingeben…</p>`;
  const termine = glasTermine.filter((t) => glasSearchMatch(t.titel, q)).slice(0, 8);
  const touren = glasTouren.filter((t) => !t.archiviert_am && glasSearchMatch(t.name, q)).slice(0, 8);
  const objekte = glasObjekte.filter((o) => glasSearchMatch(`${o.name} ${o.kunde_name} ${o.kdnr}`, q)).slice(0, 8);
  if (!termine.length && !touren.length && !objekte.length) return `<p class="muted" style="margin:8px 2px 2px;">Keine Treffer für „${escapeHtml(glasKalSearch)}".</p>`;
  const row = (onclick, farbe, titel, sub) => `
    <div style="display:flex; align-items:center; gap:10px; padding:9px 2px; border-top:1px solid var(--border); cursor:pointer;" onclick="${onclick}">
      <span style="width:4px; align-self:stretch; border-radius:2px; background:${farbe}; flex-shrink:0;"></span>
      <div style="flex:1; min-width:0;">
        <p style="margin:0; font-weight:600; font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${titel}</p>
        ${sub ? `<p class="muted" style="margin:1px 0 0; font-size:12px;">${sub}</p>` : ""}
      </div>
      <span style="color:var(--text-secondary);">›</span>
    </div>`;
  return `<div style="margin-top:6px;">
    ${termine.map((t) => { const c = GLAS_TERMIN_FARBEN[t.farbe] || GLAS_TERMIN_FARBEN.tuerkis; return row(`openGlasTermin('${t.id}')`, c.dot, `📌 ${escapeHtml(t.titel)}`, formatGlasDateRange(t.datum, t.datum_bis)); }).join("")}
    ${touren.map((t) => row(`glasNavigate({type:'tabs', tab:'touren'}); openGlasTourDetail('${t.id}')`, glasTourKalenderFarbe(t), `🚐 ${escapeHtml(t.name || "Tour")}`, formatGlasDateRange(t.datum, t.datum_bis))).join("")}
    ${objekte.map((o) => row(`goGlasObjekt('${o.id}')`, "#8b9bb0", `🏢 ${escapeHtml(o.name)}`, escapeHtml(o.kunde_name || ""))).join("")}
  </div>`;
}

// Wischen über den Kalender blättert die Monate (zusätzlich zu den Pfeilen)
function attachGlasCalSwipe() {
  const el = document.querySelector(".glas-cal-card");
  if (!el || el.__swipeAttached) return;
  el.__swipeAttached = true;
  let sx = null, sy = null;
  el.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    sx = sy = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) glasKalenderShiftMonth(dx < 0 ? 1 : -1);
  }, { passive: true });
}

function renderKalenderMonat() {
  const { year, month } = glasKalenderMonth; // month: 0-11
  const monatsNamen = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const todayIso = glasTodayIso();
  const weeks = glasWeeksInRange({ year, month }, { year, month });
  const rangeVon = weeks[0][0];
  const rangeBis = weeks[weeks.length - 1][6];
  const activeTouren = glasTouren.filter((t) => !t.archiviert_am && t.datum);

  // Touren und freie Termine werden gemeinsam als Balken einsortiert
  const events = [
    // 🚐 Glas-Touren (für die Mitarbeiter). Farbe: orange = geplant, grün = fertig.
    ...(glasKalTourenEinblenden ? activeTouren.map((t) => ({
      datum: t.datum, datum_bis: t.datum_bis,
      col: glasTourKalenderFarbe(t),
      label: `🚐 ${t.name ? t.name : (t.frei ? "Blanko" : "Tour")}`,
    })) : []),
    // 📌 Eigene Büro-Termine - über den Schalter ausblendbar
    ...(glasKalTermineEinblenden ? glasTermine.filter((t) => t.datum).flatMap((t) => {
      const c = GLAS_TERMIN_FARBEN[t.farbe] || GLAS_TERMIN_FARBEN.tuerkis;
      // Wiederkehrende Termine erscheinen an jedem Vorkommen im sichtbaren Zeitraum
      return glasTerminVorkommen(t, rangeVon, rangeBis).map((occ) => ({
        datum: occ.datum, datum_bis: occ.datum_bis,
        col: c.dot, label: `📌 ${t.titel || "Termin"}`,
      }));
    }) : []),
    // Urlaube (einblendbar über 🏖️): bewusst dezenter/transparenter gestylt als Touren/
    // Termine, damit man sie klar unterscheiden kann (is-urlaub)
    ...(glasKalUrlaubEinblenden ? glasUrlaub.filter((u) => u.von).map((u) => ({
      datum: u.von, datum_bis: u.bis || u.von,
      col: glasMaFarbe(u.mitarbeiter_id), urlaub: true,
      label: `🏖️ ${glasMaName(u.mitarbeiter_id)}`,
    })) : []),
  ];

  // Pro Tag die Events sammeln (mehrtägige erscheinen auf jedem betroffenen Tag als Chip,
  // an den Rändern abgerundet, damit es wie ein durchgehender Balken wirkt). Im Kalender
  // selbst ist NICHTS direkt anklickbar außer dem Tag - erst im Tages-Modal wählt man
  // dann Tour oder Termin aus (verhindert Fehlklicks auf dem Handy).
  const maxChips = 6;

  // Feste "Lane" (Zeile) je Termin über den GESAMTEN Zeitraum: mehrtägige Balken liegen
  // damit auf jedem Tag in derselben Zeile und laufen lückenlos durch. Ohne das drückt ein
  // Einzeltermin den Mehrtages-Balken an einem Tag nach unten -> Balken bricht (der Bug).
  // Greedy-Packing: nach Startdatum sortiert (längere zuerst -> bekommen niedrige Lanes),
  // jeder Termin in die erste freie Lane, die sich in seinem Zeitraum nicht überschneidet.
  const laneEnds = []; // laneEnds[l] = Enddatum des letzten Termins in Lane l
  events
    .map((e, i) => ({ e, i, s: e.datum, en: e.datum_bis || e.datum }))
    .sort((a, b) => a.s.localeCompare(b.s) || b.en.localeCompare(a.en) || a.i - b.i)
    .forEach((it) => {
      let lane = 0;
      while (lane < laneEnds.length && laneEnds[lane] >= it.s) lane++;
      it.e._lane = lane;
      laneEnds[lane] = it.en;
    });

  const cellsHtml = weeks
    .map((week) => `<div class="glas-cal-kw">${glasIsoWeek(week[0])}</div>` + week.map((iso) => {
      const d = parseInt(iso.slice(8, 10), 10);
      const isToday = iso === todayIso;
      const isSelected = iso === glasKalenderSelectedDay;
      const inMonth = parseInt(iso.slice(5, 7), 10) - 1 === month;
      const dayEvents = events.filter((t) => iso >= t.datum && iso <= (t.datum_bis || t.datum));

      // Termine an ihrer festen Lane platzieren; leere Lanes dazwischen als unsichtbarer
      // Platzhalter (gleiche Höhe) -> die Balken bleiben Tag für Tag auf einer Linie.
      const byLane = [];
      let overflow = 0;
      dayEvents.forEach((t) => { if (t._lane < maxChips) byLane[t._lane] = t; else overflow++; });
      const chips = byLane.length
        ? Array.from({ length: byLane.length }, (_, l) => {
            const t = byLane[l];
            if (!t) return `<div class="glas-cal-chip glas-cal-chip-spacer">&nbsp;</div>`;
            const contLeft = t.datum < iso;
            const contRight = (t.datum_bis || t.datum) > iso;
            return `<div class="glas-cal-chip${contLeft ? " continues-left" : ""}${contRight ? " continues-right" : ""}${t.urlaub ? " is-urlaub" : ""}" style="--c:${t.col};">${contLeft ? "&nbsp;" : escapeHtml(t.label)}</div>`;
          }).join("")
        : "";
      const more = overflow ? `<div class="glas-cal-more">+${overflow}</div>` : "";

      return `
        <div class="glas-cal-cell${isSelected ? " is-selected" : ""}${inMonth ? "" : " out-month"}" onclick="glasKalenderSelectedDay = glasKalenderSelectedDay === '${iso}' ? null : '${iso}'; renderGlasAdmin();">
          <span class="glas-cal-daynum${isToday ? " is-today" : ""}">${d}</span>
          ${chips}${more}
        </div>`;
    }).join(""))
    .join("");

  const html = `
    <div class="card glas-cal-card">
      <div style="display:flex; align-items:center; gap:6px; margin-bottom:10px; padding:0 8px;">
        <p style="margin:0; font-weight:700; font-size:17px; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${monatsNamen[month]} ${year}</p>
        <button class="btn btn-sm${glasKalSearchOpen ? " btn-primary" : ""}" title="Suchen" onclick="glasToggleKalSearch()">🔍</button>
        <button class="btn btn-sm${glasKalTourenEinblenden ? " btn-primary" : ""}" title="Touren (🚐) ein-/ausblenden" onclick="glasToggleKalTouren()">🚐</button>
        <button class="btn btn-sm${glasKalTermineEinblenden ? " btn-primary" : ""}" title="Eigene Termine (📌) ein-/ausblenden" onclick="glasToggleKalTermine()">📌</button>
        <button class="btn btn-sm${glasKalUrlaubEinblenden ? " btn-primary" : ""}" title="Urlaube ein-/ausblenden" onclick="glasToggleKalUrlaub()">🏖️</button>
        <button class="btn btn-sm" onclick="glasKalenderShiftMonth(-1)">‹</button>
        <button class="btn btn-sm" onclick="glasKalenderShiftMonth(1)">›</button>
      </div>
      ${glasKalSearchOpen ? `
      <div style="padding:0 8px 10px;">
        <input type="text" id="kal_search" placeholder="🔍 Termin, Tour, Objekt, Kunde suchen..." value="${escapeHtml(glasKalSearch)}" />
        <div id="kalSearchResults">${renderKalenderSuchErgebnisse()}</div>
      </div>` : ""}
      <div class="glas-cal-grid with-kw" style="margin-bottom:4px;">
        <div></div>
        ${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => `<div class="muted" style="text-align:center; font-size:11px; font-weight:600;">${d}</div>`).join("")}
      </div>
      <div class="glas-cal-grid with-kw${glasCalAnimDir ? ` glas-cal-anim-${glasCalAnimDir}` : ""}">${cellsHtml}</div>
      <div class="muted" style="margin:8px 8px 0; font-size:11.5px; display:flex; flex-wrap:wrap; gap:4px 12px; align-items:center;">
        <span>🚐 Tour:</span>
        <span><span style="display:inline-block; width:9px; height:9px; border-radius:2px; background:${GLAS_TOUR_FARBE.geplant}; vertical-align:middle;"></span> geplant</span>
        <span><span style="display:inline-block; width:9px; height:9px; border-radius:2px; background:${GLAS_TOUR_FARBE.fertig}; vertical-align:middle;"></span> fertig${glasKalTourenEinblenden ? "" : " <b>(ausgeblendet)</b>"}</span>
        <span style="margin-left:6px;"><span style="display:inline-block; width:9px; height:9px; border-radius:2px; background:${GLAS_TERMIN_FARBEN.tuerkis.dot}; vertical-align:middle;"></span> 📌 eigener Termin${glasKalTermineEinblenden ? "" : " <b>(ausgeblendet)</b>"}</span>
      </div>
      <button class="btn btn-sm" style="margin:8px 6px 0;" onclick="glasKalenderMonth = { year: new Date().getFullYear(), month: new Date().getMonth() }; glasKalenderSelectedDay = glasTodayIso(); renderGlasAdmin();">Heute</button>
    </div>
    ${glasKalenderSelectedDay ? renderKalenderTagPanel(glasKalenderSelectedDay) : ""}
  `;
  glasCalAnimDir = null;
  return html;
}

// Aufklappender "Tages-Reiter" unter dem Kalender: alle Touren + freien Termine des Tages,
// inkl. Notizen, mit Schnellzugriff auf Bearbeiten und "+ Termin an diesem Tag".
function renderKalenderTagPanel(iso) {
  const touren = glasTourenAmTag(iso);
  const termine = glasTermineAmTag(iso);
  const wochentage = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const wt = wochentage[new Date(iso + "T00:00:00").getDay()];

  // Das Tages-Panel zeigt NUR die aktuell eingeblendeten Ebenen (🚐/📌/🏖️) - hat man
  // z.B. Termine ausgeblendet, tauchen sie hier auch nicht auf.
  const tourRows = (glasKalTourenEinblenden ? touren : []).map((t) => {
    const stops = t.glas_stopps || [];
    const done = stops.filter((s) => s.status === "erledigt").length;
    return `
      <div style="display:flex; align-items:center; gap:12px; padding:12px 0; border-top:1px solid var(--border); cursor:pointer;" onclick="glasNavigate({type:'tabs', tab:'touren'}); openGlasTourDetail('${t.id}');">
        <span style="width:4px; align-self:stretch; border-radius:2px; background:${glasTourKalenderFarbe(t)};"></span>
        <div style="flex:1; min-width:0;">
          <p style="margin:0; font-weight:600;">🚐 ${t.name ? escapeHtml(t.name) : (t.frei ? "Blanko" : "Tour")}</p>
          <p class="muted" style="margin:2px 0 0; font-size:12.5px;">${formatGlasDateRange(t.datum, t.datum_bis)} · ${done}/${stops.length} erledigt</p>
        </div>
        <span style="color:var(--text-secondary);">›</span>
      </div>`;
  }).join("");

  const terminRows = (glasKalTermineEinblenden ? termine : []).map((t) => {
    const c = GLAS_TERMIN_FARBEN[t.farbe] || GLAS_TERMIN_FARBEN.tuerkis;
    return `
      <div style="display:flex; align-items:flex-start; gap:12px; padding:12px 0; border-top:1px solid var(--border); cursor:pointer;" onclick="openGlasTermin('${t.id}')">
        <span style="width:4px; align-self:stretch; border-radius:2px; background:${c.dot};"></span>
        <div style="flex:1; min-width:0;">
          <p style="margin:0; font-weight:600;">📌 ${escapeHtml(t.titel)}</p>
          ${t.datum_bis && t.datum_bis !== t.datum ? `<p class="muted" style="margin:2px 0 0; font-size:12.5px;">${formatGlasDateRange(t.datum, t.datum_bis)}</p>` : ""}
          ${glasWiederholungLabel(t.wiederholung) ? `<p class="muted" style="margin:2px 0 0; font-size:12px;">🔁 ${glasWiederholungLabel(t.wiederholung)}</p>` : ""}
          ${t.adresse ? `<p class="muted" style="margin:2px 0 0; font-size:12px;">📍 ${escapeHtml(t.adresse)}</p>` : ""}
          ${t.notiz ? `<p style="margin:6px 0 0; font-size:13px; background:${c.bg}; color:${c.fg}; border-radius:8px; padding:8px 10px; white-space:pre-line;">${escapeHtml(t.notiz)}</p>` : ""}
        </div>
        <span style="color:var(--text-secondary);">›</span>
      </div>`;
  }).join("");

  const urlaubeAmTag = glasKalUrlaubEinblenden
    ? glasUrlaub.filter((u) => u.von && iso >= u.von && iso <= (u.bis || u.von))
    : [];
  const urlaubRows = urlaubeAmTag.map((u) => {
    const c = glasMaFarbe(u.mitarbeiter_id);
    return `
      <div style="display:flex; align-items:center; gap:12px; padding:12px 0; border-top:1px solid var(--border); cursor:pointer;" onclick="glasKalenderSelectedDay=null; glasKalenderAnsicht='urlaub'; glasUrlaubMaFilter='${u.mitarbeiter_id}'; renderGlasAdmin();">
        <span style="width:4px; align-self:stretch; border-radius:2px; background:${c};"></span>
        <div style="flex:1; min-width:0;">
          <p style="margin:0; font-weight:600;">🏖️ ${escapeHtml(glasMaName(u.mitarbeiter_id))} im Urlaub</p>
          <p class="muted" style="margin:2px 0 0; font-size:12.5px;">${formatGlasDateRange(u.von, u.bis)}${u.notiz ? " · " + escapeHtml(u.notiz) : ""}</p>
        </div>
        <span style="color:var(--text-secondary);">›</span>
      </div>`;
  }).join("");

  return `
    <div class="modal-overlay glas-day-sheet-ov" onclick="if(event.target===this){glasKalenderSelectedDay=null; renderGlasAdmin();}">
      <div class="glas-day-sheet">
        <div class="glas-sheet-grip"></div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <p style="margin:0; font-weight:700; font-size:16px;">${wt}, ${formatGlasDate(iso)}</p>
          <div style="display:flex; gap:6px; flex-shrink:0;">
            <button class="btn btn-sm" onclick="openGlasTermin(null, '${iso}')">+ Termin</button>
            <button class="btn btn-sm" onclick="glasKalenderSelectedDay=null; renderGlasAdmin();">✕</button>
          </div>
        </div>
        ${tourRows}${terminRows}${urlaubRows}
        ${!(glasKalTourenEinblenden && touren.length) && !(glasKalTermineEinblenden && termine.length) && !urlaubeAmTag.length ? `<p class="muted" style="margin:12px 0 4px;">Nichts geplant an diesem Tag.</p>` : ""}
      </div>
    </div>`;
}

function glasKalenderShiftMonth(delta) {
  glasCalAnimDir = delta > 0 ? "l" : "r";
  let { year, month } = glasKalenderMonth;
  month += delta;
  if (month < 0) { month = 11; year--; }
  if (month > 11) { month = 0; year++; }
  glasKalenderMonth = { year, month };
  renderGlasAdmin();
}

// Alle Positionen aller Objekte, die überfällig oder demnächst fällig sind (rutscht aus
// Vormonaten automatisch durch, bis erledigt oder manuell verschoben).
function glasAlleOffenenPositionen() {
  const result = [];
  glasObjekte.forEach((o) => {
    glasGetObjektPositionen(o.id).forEach((p) => {
      if (glasIstEingeplant(p)) return; // ist schon in einer offenen Tour -> nicht mehr "offen"
      const f = glasFaelligkeitStatus(p);
      if (f.status === "ueberfaellig" || f.status === "faellig" || f.status === "kommend") {
        result.push({ objekt: o, position: p, ...f });
      }
    });
  });
  // überfällig zuerst, dann fällig, dann kommend - innerhalb einer Gruppe nach Datum
  const rang = { ueberfaellig: 0, faellig: 1, kommend: 2 };
  result.sort((a, b) => (rang[a.status] - rang[b.status]) || a.faelligkeit.localeCompare(b.faelligkeit));
  return result;
}

// Offene Liste: nach OBJEKT gruppiert (eine Karte pro Objekt, nicht pro Position).
// Welche Positionen genau drankommen, entscheidet man erst beim Planen (Checkboxen im
// Tour-Formular) bzw. beim Verschieben (Checkboxen im Picker).
function renderOffeneListe() {
  // Kennzahlen über der Liste: pro Objekt der dringendste Status (nicht pro Position),
  // damit die Zahlen zur Karten-Anzahl darunter passen.
  const alle = glasAlleOffenenPositionen();
  const rang = { ueberfaellig: 0, faellig: 1, kommend: 2 };
  const perObj = new Map();
  alle.forEach((x) => {
    const cur = perObj.get(x.objekt.id);
    if (!cur || rang[x.status] < rang[cur]) perObj.set(x.objekt.id, x.status);
  });
  const vals = [...perObj.values()];
  const u = vals.filter((s) => s === "ueberfaellig").length;
  const f = vals.filter((s) => s === "faellig").length;
  const k = vals.filter((s) => s === "kommend").length;
  const kennzahlen = vals.length ? glasStatTiles([
    { num: u, label: "überfällig", tone: u ? "crit" : null },
    { num: f, label: "fällig", tone: f ? "warn" : null },
    { num: k, label: "kommend" },
  ]) : "";

  return `
    ${kennzahlen}
    <div style="display:flex; gap:8px; margin-bottom:14px;">
      <input type="text" id="offen_search" placeholder="🔍 Objekt/Kunde suchen..." value="${escapeHtml(glasOffeneSearch)}" />
    </div>
    <div id="offeneListeErgebnisse">${renderOffeneListeErgebnisse()}</div>
  `;
}

function renderOffeneListeErgebnisse() {
  const all = glasAlleOffenenPositionen();
  const q = glasOffeneSearch.trim().toLowerCase();
  const filtered = q ? all.filter((x) => glasSearchMatch(`${x.objekt.name} ${x.objekt.kunde_name} ${x.objekt.kdnr || ""}`, q)) : all;

  // Gruppieren: pro Objekt der höchste Status + früheste Fälligkeit + alle offenen Positionen
  const gruppen = new Map();
  filtered.forEach((x) => {
    let g = gruppen.get(x.objekt.id);
    if (!g) { g = { objekt: x.objekt, eintraege: [] }; gruppen.set(x.objekt.id, g); }
    g.eintraege.push(x);
  });
  const rang = { ueberfaellig: 0, faellig: 1, kommend: 2 };
  const liste = [...gruppen.values()].map((g) => {
    g.status = g.eintraege.reduce((s, e) => (rang[e.status] < rang[s] ? e.status : s), "kommend");
    g.fruehestes = g.eintraege.reduce((min, e) => (e.faelligkeit < min ? e.faelligkeit : min), g.eintraege[0].faelligkeit);
    return g;
  }).sort((a, b) => (rang[a.status] - rang[b.status]) || a.fruehestes.localeCompare(b.fruehestes));

  const rows = liste.map((g) => {
    const o = g.objekt;
    const checked = glasOffeneSelected.has(o.id);
    const erstes = g.eintraege[0];
    // Bei sehr lange zurückliegender Fälligkeit ist "5000T überfällig" nutzlos - dann
    // lieber das Datum zeigen.
    const zeitLabel = erstes.tage === null ? erstes.label
      : erstes.status === "ueberfaellig" ? (Math.abs(erstes.tage) > 60 ? `überfällig seit ${erstes.label}` : `${Math.abs(erstes.tage)}T überfällig`)
      : erstes.tage === 0 ? "heute" : `in ${erstes.tage}T`;
    const posIds = g.eintraege.map((e) => e.position.id).filter(Boolean);
    const zeigeVerschieben = glasVerschiebeTarget && glasVerschiebeTarget.objektId === o.id;
    return `
      <div style="margin-bottom:10px;">
        <div class="card" style="display:flex; align-items:flex-start; gap:12px; margin-bottom:0; ${glasStatusTint(g.status)}">
          <input type="checkbox" style="width:auto; margin-top:3px;" ${checked ? "checked" : ""} onchange="toggleGlasOffeneSelect('${o.id}')" />
          <div style="flex:1; min-width:0; cursor:pointer;" onclick="goGlasObjekt('${o.id}')">
            <p style="margin:0; font-weight:600;">${escapeHtml(o.name)}</p>
            <p class="muted" style="margin:2px 0 0; font-size:12px;">${escapeHtml(o.kunde_name || "")} · ${g.eintraege.length} offene Position${g.eintraege.length === 1 ? "" : "en"}</p>
          </div>
          <div style="text-align:right; flex-shrink:0;">
            <span class="badge ${glasStatusBadgeClass(g.status)}">${zeitLabel}</span>
            <div style="display:flex; flex-direction:column; gap:4px; margin-top:6px;">
              <button class="btn btn-sm btn-primary" style="padding:4px 8px; font-size:11.5px;" onclick='glasJetztPlanen(${JSON.stringify(o.id)}, ${JSON.stringify(posIds.length ? posIds : null)})'>📅 Jetzt planen</button>
              ${posIds.length ? `<button class="btn btn-sm" style="padding:4px 8px; font-size:11.5px;" onclick='glasOpenVerschieben(${JSON.stringify(o.id)}, ${JSON.stringify(posIds)}, "alle")'>Verschieben</button>` : ""}
            </div>
          </div>
        </div>
        ${zeigeVerschieben ? renderVerschiebePicker() : ""}
      </div>`;
  }).join("");

  return `
    ${glasOffeneSelected.size ? `
      <button class="btn btn-primary" style="width:100%; justify-content:center; margin-bottom:14px;" onclick="glasOffeneZuTourHinzufuegen()">
        ${glasOffeneSelected.size} Objekt${glasOffeneSelected.size === 1 ? "" : "e"} zu neuer Tour hinzufügen
      </button>` : ""}
    ${liste.length ? rows : `<p class="muted">Aktuell nichts fällig oder überfällig. 🎉</p>`}
  `;
}

function toggleGlasOffeneSelect(objektId) {
  if (glasOffeneSelected.has(objektId)) glasOffeneSelected.delete(objektId);
  else glasOffeneSelected.add(objektId);
  renderGlasAdmin();
}

// Verschieben-Picker: feste Offsets (+2 Wochen/+1 Monat/+3 Monate) plus Datumsauswahl.
// Geöffnet von der Objekt-Seite oder der Offenen Liste - im Picker hakt man ab, welche
// Positionen des Objekts mitverschoben werden (alle vorausgewählt).
let glasVerschiebeTarget = null; // { objektId, positionIds: [...], scope } | null

function glasOpenVerschieben(objektId, positionIds, scope) {
  glasVerschiebeTarget = { objektId, positionIds, scope };
  renderGlasAdmin();
}

function glasCloseVerschieben() {
  glasVerschiebeTarget = null;
  renderGlasAdmin();
}

function glasToggleVerschiebePos(posId) {
  if (!glasVerschiebeTarget) return;
  const ids = glasVerschiebeTarget.positionIds;
  const idx = ids.indexOf(posId);
  if (idx >= 0) ids.splice(idx, 1);
  else ids.push(posId);
  renderGlasAdmin();
}

function renderVerschiebePicker() {
  const t = glasVerschiebeTarget;
  // Auswahl, welche Positionen des Objekts mitverschoben werden - vorausgewählt sind alle
  // verschiebbaren (bzw. die eine, aus der Offenen Liste angestoßene).
  const kandidaten = glasGetObjektPositionen(t.objektId).filter((p) => p.intervall_typ && p.id && !glasIstEingeplant(p));
  const auswahlHtml = kandidaten.length > 1 ? `
      <div style="margin:0 0 10px; display:flex; flex-direction:column; gap:4px;">
        ${kandidaten.map((p) => `
          <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
            <input type="checkbox" style="width:auto;" ${t.positionIds.includes(p.id) ? "checked" : ""} onchange="glasToggleVerschiebePos('${p.id}')" />
            <span>Pos. ${escapeHtml(p.nr)} ${escapeHtml(p.art)}</span>
          </label>`).join("")}
      </div>` : "";
  return `
    <div class="card glas-verschieben-picker" style="margin-top:8px; background:var(--bg);">
      <p class="muted" style="margin:0 0 8px; font-weight:600;">Fälligkeit verschieben auf...</p>
      ${auswahlHtml}
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn btn-sm" onclick="glasVerschiebeUmTage(14)">+2 Wochen</button>
        <button class="btn btn-sm" onclick="glasVerschiebeUmMonate(1)">+1 Monat</button>
        <button class="btn btn-sm" onclick="glasVerschiebeUmMonate(3)">+3 Monate</button>
        <button class="btn btn-sm" style="background:var(--success-bg); border-color:#cdeed3; color:var(--success-text);" onclick="glasVerschiebeSchonGereinigt()">✓ Schon gereinigt – nächster Termin</button>
      </div>
      <p class="muted" style="margin:8px 0 0; font-size:11.5px;">„Schon gereinigt“ vermerkt heute als letzte Reinigung (z.B. ohne Schein erledigt) – die Fälligkeit springt automatisch auf den nächsten regulären Termin.</p>
      <div style="display:flex; gap:8px; align-items:flex-end; margin-top:10px; flex-wrap:wrap;">
        <div class="field" style="margin-bottom:0;">
          <label class="muted">Oder Datum wählen</label>
          <input type="date" id="verschieben_datum" value="${glasAddMonthsIso(glasTodayIso(), 1)}" />
        </div>
        <button class="btn btn-sm btn-primary" onclick="glasVerschiebeAufDatum()">Übernehmen</button>
      </div>
      <button class="btn btn-sm" style="margin-top:10px;" onclick="glasCloseVerschieben()">Abbrechen</button>
    </div>`;
}

function glasVerschiebeUmTage(tage) {
  glasSpeichereVerschiebung(glasAddDaysIso(glasTodayIso(), tage));
}

function glasVerschiebeUmMonate(monate) {
  glasSpeichereVerschiebung(glasAddMonthsIso(glasTodayIso(), monate));
}

function glasVerschiebeAufDatum() {
  const val = document.getElementById("verschieben_datum")?.value;
  if (!val) { showToast("Bitte ein Datum wählen"); return; }
  glasSpeichereVerschiebung(val);
}

// Name der versteckten "Als gereinigt vermerkt"-Blanko-Touren, an denen die manuellen
// Reinigungs-Vermerke hängen (damit sie im Verlauf/Scheinen auftauchen und umkehrbar sind).
const GLAS_MANUELL_CLEAN_NAME = "Manuell als gereinigt vermerkt";

// "Schon gereinigt": legt einen echten Verlaufs-Eintrag an (versteckter Blanko-Schein,
// manuell als gereinigt markiert) UND rückt die Fälligkeit auf den nächsten Termin.
// So erscheint es im Verlauf des Objekts, in den Scheinen und beim Kunden - und ist
// über "↩️ rückgängig" jederzeit umkehrbar.
async function glasVerschiebeSchonGereinigt() {
  if (glasBusy || !glasVerschiebeTarget) return;
  const { objektId, positionIds } = glasVerschiebeTarget;
  if (!positionIds.length) { showToast("Bitte mindestens eine Position anhaken"); return; }
  const o = glasObjekte.find((x) => x.id === objektId);
  if (!o) return;
  const kunde = glasKunden.find((k) => k.id === o.kunde_id);
  const heute = glasTodayIso();
  const jetzt = new Date().toISOString();
  const positionen = glasGetObjektPositionen(objektId)
    .filter((p) => positionIds.includes(p.id) || positionIds.includes(p.nr))
    .map((p) => ({ id: p.id, nr: p.nr, art: p.art, qm: p.qm }));

  glasBusy = true; renderGlasAdmin();
  try {
    // 1) Verlaufs-Eintrag als versteckte Blanko-Tour + erledigter Stopp (manuell markiert)
    const tourId = genCode();
    const tourFelder = { id: tourId, name: GLAS_MANUELL_CLEAN_NAME, datum: heute, template: o.template === "sub" ? "sub" : "geko", frei: true, ma_versteckt: true };
    let { error: te } = await sb.from("glas_touren").upsert(tourFelder);
    if (te && /ma_versteckt/.test(te.message || "")) { const { ma_versteckt, ...ohne } = tourFelder; ({ error: te } = await sb.from("glas_touren").upsert(ohne)); }
    if (te) throw te;

    const stopFelder = {
      id: genCode(), tour_id: tourId, reihenfolge: 0, status: "erledigt",
      objekt_id: objektId, kunde_id: o.kunde_id || "",
      objekt: o.name, adresse: o.adresse, kdnr: o.kdnr,
      kunde_kdnr: kunde?.kdnr || "", kunde_adresse: [kunde?.name, kunde?.adresse].filter(Boolean).join("\n"),
      positionen: JSON.stringify(positionen), datum: heute, signed_at: jetzt, manuell_erledigt_am: jetzt,
      lat: o.lat, lng: o.lng,
    };
    let { error: se } = await sb.from("glas_stopps").insert(stopFelder);
    if (se && /(kunde_id|manuell_erledigt_am)/.test(se.message || "")) {
      const { kunde_id, manuell_erledigt_am, ...ohne } = stopFelder;
      ({ error: se } = await sb.from("glas_stopps").insert(ohne));
    }
    if (se) throw se;

    // 2) Fälligkeit weiterrücken (letzte Reinigung = heute, evtl. Verschiebung aufheben)
    await sb.from("glas_objekt_positionen").update({ letzte_reinigung: heute, faelligkeit_override: null }).in("id", positionIds);

    glasBusy = false; glasVerschiebeTarget = null;
    glasKundeTermineCache = {}; glasScheineDaten = null; glasStatistikDaten = null;
    delete glasObjektDetailHistory[objektId];
    showToast("Als gereinigt vermerkt – steht im Verlauf, Fälligkeit rückt weiter");
    await Promise.all([loadGlasObjektPositionen(), loadGlasTouren(), loadGlasEingeplantePositionen()]);
    renderGlasAdmin();
  } catch (err) {
    glasBusy = false; showToast("Fehler: " + err.message); renderGlasAdmin();
  }
}

// Setzt "zuletzt gereinigt" der Positionen aus dem übrigen GÜLTIGEN Verlauf neu (nach dem
// Entfernen eines Eintrags): gültig = nicht archiviert und mit Unterschrift ODER manueller
// Markierung. Ohne Nachweis -> leer.
async function glasSetzeLetzteReinigungAusVerlauf(ids, excludeStopId) {
  const { data } = await sb.from("glas_stopps").select("id, datum, signed_at, positionen, name, manuell_erledigt_am, glas_touren(archiviert_am)").eq("status", "erledigt");
  const gueltig = (data || []).filter((x) => x.id !== excludeStopId && !(x.glas_touren && x.glas_touren.archiviert_am) && ((x.name || "").trim() !== "" || x.manuell_erledigt_am));
  for (const pid of ids) {
    let letzte = null;
    gueltig.forEach((x) => { try { if (JSON.parse(x.positionen || "[]").some((p) => p && p.id === pid)) { const dtx = glasSignaturDatum(x); if (dtx && (!letzte || dtx > letzte)) letzte = dtx; } } catch (e) {} });
    await sb.from("glas_objekt_positionen").update({ letzte_reinigung: letzte }).eq("id", pid);
  }
}

// "Als gereinigt vermerkt" rückgängig machen: den Blanko-Schein (Stopp + versteckte Tour)
// löschen und die Fälligkeit aus dem übrigen Verlauf neu berechnen.
async function glasUndoManuellGereinigt(objektId, stopId) {
  if (glasBusy) return;
  if (!confirm("Diesen „als gereinigt\" vermerkten Eintrag rückgängig machen? Er verschwindet aus dem Verlauf und die Fälligkeit wird neu berechnet.")) return;
  glasBusy = true; renderGlasAdmin();
  try {
    const stop = (glasObjektDetailHistory[objektId] || []).find((x) => x.id === stopId);
    const ids = stop ? glasStopPositionen(stop).map((p) => p.id).filter(Boolean) : [];
    const tourId = stop?.tour_id;
    await sb.from("glas_stopps").delete().eq("id", stopId);
    if (tourId) await sb.from("glas_touren").delete().eq("id", tourId);
    if (ids.length) await glasSetzeLetzteReinigungAusVerlauf(ids, stopId);
    glasBusy = false;
    glasKundeTermineCache = {}; glasScheineDaten = null; glasStatistikDaten = null;
    delete glasObjektDetailHistory[objektId];
    showToast("Rückgängig gemacht");
    await Promise.all([loadGlasObjektPositionen(), loadGlasTouren(), loadGlasEingeplantePositionen()]);
    renderGlasAdmin();
  } catch (err) {
    glasBusy = false; showToast("Fehler: " + err.message); renderGlasAdmin();
  }
}

async function glasSpeichereVerschiebung(neuesDatum) {
  if (!glasVerschiebeTarget) return;
  const { positionIds } = glasVerschiebeTarget;
  if (!positionIds.length) { showToast("Bitte mindestens eine Position anhaken"); return; }
  const { error } = await sb.from("glas_objekt_positionen").update({ faelligkeit_override: neuesDatum }).in("id", positionIds);
  if (error) { showToast("Fehler: " + error.message); return; }
  showToast(positionIds.length > 1 ? "Fälligkeiten verschoben" : "Fälligkeit verschoben");
  glasVerschiebeTarget = null;
  await loadGlasObjektPositionen();
  renderGlasAdmin();
}

function glasOffeneZuTourHinzufuegen() {
  // Ausgewählt werden ganze Objekte - vorausgewählt sind deren offene Positionen,
  // final entscheidet man per Checkbox im Tour-Formular.
  const offene = glasAlleOffenenPositionen();
  const map = new Map();
  const objektIds = new Set();
  glasOffeneSelected.forEach((objektId) => {
    objektIds.add(objektId);
    const ids = offene.filter((x) => x.objekt.id === objektId).map((x) => x.position.id || x.position.nr);
    map.set(objektId, new Set(ids));
  });
  glasOffeneSelected.clear();
  glasTourNotizen = new Map();
  glasTourExtras = new Map();
  // goGlasTab() setzt u.a. glasShowNewTourForm zurück auf false, deshalb erst danach setzen.
  goGlasTab("touren");
  glasSelectedObjekte = objektIds;
  glasManualOrder = [...objektIds];
  glasPreselectPositionen = map;
  glasEditingTourId = null;
  glasTourSearch = "";
  glasNewTour = { name: "", datum: glasTodayIso(), datum_bis: "", template: glasTemplateFuerObjekte(objektIds), notiz: "" };
  glasShowNewTourForm = true;
  renderGlasAdmin();
}

/* ========================================================================
   Abnahmescheine-Reiter: alle unterschriebenen/abgehakten Scheine, gruppiert nach
   Tag / Woche / Monat, durchsuchbar. Schnellzugriff zum Wiederfinden + PDF.
   ======================================================================== */

let glasScheineDaten = null;      // alle erledigten Stopps (ohne Unterschriftsbild) - einmal geladen
let glasScheineGran = "tag";      // "tag" | "woche" | "monat"
let glasScheineAnker = "";        // Anker-Tag des gewählten Zeitraums (leer = heute)
let glasScheineSearch = "";

let glasScheineLaden = false;
async function loadGlasScheine() {
  if (glasScheineLaden) return;
  glasScheineLaden = true;
  // Unterschriftsbild NICHT mitladen (spart Speicher bei vielen Scheinen) - wird beim
  // PDF-Download gezielt für den einen Schein nachgeladen.
  const { data, error } = await sb
    .from("glas_stopps")
    .select("id, objekt_id, objekt, adresse, kdnr, kunde_id, kunde_kdnr, kunde_adresse, positionen, zusatz, name, datum, signed_at, manuell_erledigt_am, unterschrift, tour_id, glas_touren(name, datum, template, archiviert_am, frei)")
    .eq("status", "erledigt");
  glasScheineDaten = error ? [] : (data || [])
    .filter((s) => s.glas_touren && !s.glas_touren.archiviert_am && glasSignaturDatum(s))
    .map((s) => ({ ...s, __hatBild: !!s.unterschrift, unterschrift: undefined })); // Bild-Flag merken, Bild droppen
  glasScheineLaden = false;
  renderGlasAdmin();
}

const GLAS_WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const GLAS_MONATE_LANG = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

// Montag (ISO) der Woche, in der 'iso' liegt
function glasMontagVon(iso) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return glasIsoFromDate(d);
}

// Perioden-Schlüssel + Kopfzeile für einen Schein-Tag je nach Granularität
function glasScheinPeriode(iso, gran) {
  if (gran === "monat") {
    const [y, m] = iso.split("-");
    return { key: `${y}-${m}`, label: `${GLAS_MONATE_LANG[Number(m) - 1]} ${y}` };
  }
  if (gran === "woche") {
    const mo = glasMontagVon(iso);
    const so = glasAddDaysIso(mo, 6);
    return { key: mo, label: `KW ${glasIsoWeek(iso)} · ${formatGlasDate(mo)} – ${formatGlasDate(so)}` };
  }
  // Tag
  const heute = glasTodayIso();
  const d = new Date(iso + "T00:00:00");
  let prefix = "";
  if (iso === heute) prefix = "Heute · ";
  else if (iso === glasAddDaysIso(heute, -1)) prefix = "Gestern · ";
  return { key: iso, label: `${prefix}${GLAS_WOCHENTAGE[d.getDay()]}, ${formatGlasDate(iso)}` };
}

function glasScheinKunde(s) {
  if (s.kunde_id) { const k = glasKunden.find((x) => x.id === s.kunde_id); if (k) return k.name; }
  const o = s.objekt_id ? glasObjekte.find((x) => x.id === s.objekt_id) : null;
  if (o && o.kunde_name) return o.kunde_name;
  return (s.kunde_adresse || "").split("\n")[0] || "";
}

// Grenzen (von/bis ISO) + Label des Zeitraums, in dem der Anker-Tag liegt - je nach
// Granularität ein einzelner Tag, eine Woche (Mo–So) oder ein ganzer Monat.
function glasPeriodeGrenzen(anker, gran) {
  if (gran === "woche") {
    const mo = glasMontagVon(anker);
    const so = glasAddDaysIso(mo, 6);
    return { von: mo, bis: so, label: `KW ${glasIsoWeek(anker)} · ${formatGlasDate(mo)} – ${formatGlasDate(so)}` };
  }
  if (gran === "monat") {
    const [y, m] = anker.split("-").map(Number);
    return { von: `${anker.slice(0, 7)}-01`, bis: glasIsoFromDate(new Date(y, m, 0)), label: `${GLAS_MONATE_LANG[m - 1]} ${y}` };
  }
  const heute = glasTodayIso();
  const d = new Date(anker + "T00:00:00");
  const prefix = anker === heute ? "Heute · " : anker === glasAddDaysIso(heute, -1) ? "Gestern · " : "";
  return { von: anker, bis: anker, label: `${prefix}${GLAS_WOCHENTAGE[d.getDay()]}, ${formatGlasDate(anker)}` };
}

// Anker um eine Periode vor/zurück (Tag ±1, Woche ±7 Tage, Monat ±1 Monat)
function glasAnkerStep(anker, gran, dir) {
  if (gran === "woche") return glasAddDaysIso(anker, 7 * dir);
  if (gran === "monat") return glasAddMonthsIso(`${anker.slice(0, 7)}-01`, dir);
  return glasAddDaysIso(anker, dir);
}

// Perioden-Navigator: ‹ Label › + Datums-Picker zum gezielten Springen. setterFn ist der
// Name einer globalen Funktion, die den neuen Anker (ISO-Tag) entgegennimmt.
function renderPeriodeNavigator(anker, gran, setterFn) {
  const { label } = glasPeriodeGrenzen(anker, gran);
  return `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
      <button class="btn btn-sm" title="Zurück" onclick="${setterFn}(glasAnkerStep('${anker}','${gran}',-1))">‹</button>
      <b style="flex:1; text-align:center; min-width:130px; font-size:14px;">${escapeHtml(label)}</b>
      <button class="btn btn-sm" title="Weiter" onclick="${setterFn}(glasAnkerStep('${anker}','${gran}',1))">›</button>
      <input type="date" value="${anker}" title="Zu einem Tag springen" onchange="${setterFn}(this.value)" style="width:auto;" />
      <button class="btn btn-sm" onclick="${setterFn}(glasTodayIso())">Heute</button>
    </div>`;
}

function glasScheineSetAnker(iso) { if (iso) { glasScheineAnker = iso; glasUpdateTabContent(); } }

function renderScheineTab() {
  if (glasScheineDaten === null) {
    loadGlasScheine();
    return `<p class="muted" style="margin-top:16px;"><span class="spinner"></span> Abnahmescheine werden geladen...</p>`;
  }
  if (!glasScheineAnker) glasScheineAnker = glasTodayIso();
  const seg = (val, label) => `<button class="glas-seg-btn ${glasScheineGran === val ? "on" : ""}" onclick="glasScheineGran='${val}'; glasUpdateTabContent();">${label}</button>`;
  return `
    <div style="margin:14px 0 10px;">
      <input type="text" id="scheine_search" placeholder="🔍 Über alle suchen: Objekt, Kunde, Unterzeichner, Kd.-Nr. ..." value="${escapeHtml(glasScheineSearch)}" autocomplete="off" />
    </div>
    <div class="glas-seg" style="margin-bottom:10px;">
      ${seg("tag", "Tag")}${seg("woche", "Woche")}${seg("monat", "Monat")}
    </div>
    <div style="display:flex; gap:8px; margin-bottom:10px; align-items:center; flex-wrap:wrap;">
      ${glasScheineSelMode
        ? `<button class="btn btn-sm" onclick="glasScheineSelAllVisible()">Alle</button>
           <button class="btn btn-primary btn-sm" onclick="glasScheineDownloadSel()"${glasScheineSel.size ? "" : " disabled"}>📄 ${glasScheineSel.size} als PDF</button>
           <button class="btn btn-sm" style="margin-left:auto;" onclick="glasToggleScheineSelMode()">Fertig</button>`
        : `<button class="btn btn-sm" onclick="downloadGlasScheineVisible()">📄 Alle als PDF</button>
           <button class="btn btn-sm" onclick="glasToggleScheineSelMode()">☑️ Auswählen</button>`}
    </div>
    <div id="scheineListe">${renderScheineListe()}</div>`;
}

function glasScheinZeile(s, showDate = true) {
  const manuell = !s.name && s.manuell_erledigt_am;
  const qm = glasStopQm(s);
  const uhr = glasUhrzeitVonTimestamp(s.signed_at);
  const sub = `${escapeHtml(glasScheinKunde(s))}${qm ? ` · ${qm} qm` : ""}`
    + `${showDate ? ` · ${formatGlasDate(glasSignaturDatum(s))}` : ""}`
    + `${manuell ? " · ✔️ markiert" : s.name ? ` · ✓ ${escapeHtml(s.name)}${uhr ? ` ${uhr}` : ""}` : ""}`;
  const titel = `<p class="glas-schein-t">${escapeHtml(s.objekt || "Schein")}${s.glas_touren?.frei ? ` <span class="badge badge-open" style="font-size:10px;">Blanko</span>` : ""}</p>`;
  if (glasScheineSelMode) {
    const on = glasScheineSel.has(s.id);
    return `
      <div class="glas-schein-card" style="cursor:pointer;" onclick="glasScheineSelToggle('${s.id}')">
        <span class="glas-pick ${on ? "on" : ""}"></span>
        <div class="glas-schein-grow">${titel}<p class="glas-schein-s">${sub}</p></div>
      </div>`;
  }
  return `
      <div class="glas-schein-card">
        <div class="glas-schein-ic${manuell ? " manuell" : ""}">📄</div>
        <div class="glas-schein-grow"${s.objekt_id ? ` style="cursor:pointer;" onclick="goGlasObjekt('${s.objekt_id}')"` : ""}>
          ${titel}
          <p class="glas-schein-s">${sub}</p>
        </div>
        <button class="glas-schein-dl" title="PDF herunterladen" onclick="downloadGlasScheinPdf('${s.id}')">⬇</button>
      </div>`;
}

// Inhalt von #scheineListe. Mit Suchtext: alle Treffer gruppiert. Ohne Suchtext: der über
// den Navigator gewählte Zeitraum (bestimmter Tag / Woche / Monat).
function renderScheineListe() {
  const q = glasScheineSearch.trim().toLowerCase();

  if (q) {
    const gefiltert = (glasScheineDaten || []).filter((s) => glasSearchMatch(`${s.objekt || ""} ${glasScheinKunde(s)} ${s.name || ""} ${s.glas_touren?.name || ""} ${s.kdnr || ""} ${s.kunde_kdnr || ""}`, q));
    const gruppen = new Map();
    gefiltert.forEach((s) => {
      const per = glasScheinPeriode(glasSignaturDatum(s), glasScheineGran);
      let g = gruppen.get(per.key);
      if (!g) { g = { label: per.label, sortKey: per.key, items: [] }; gruppen.set(per.key, g); }
      g.items.push(s);
    });
    const liste = [...gruppen.values()].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    liste.forEach((g) => g.items.sort((a, b) => (glasSignaturDatum(b) || "").localeCompare(glasSignaturDatum(a) || "")));
    glasScheineVisibleIds = gefiltert.map((s) => s.id);
    return `
      <p class="muted" style="margin:0 0 12px; font-size:12.5px;">${gefiltert.length} Treffer für „${escapeHtml(glasScheineSearch.trim())}"</p>
      ${liste.length
        ? liste.map((g) => `<p class="glas-section-title">${escapeHtml(g.label)} <span class="muted" style="font-weight:400;">· ${g.items.length}</span></p>${g.items.map((s) => glasScheinZeile(s, true)).join("")}`).join("")
        : `<div class="card"><p class="muted" style="padding:8px 0;">Keine Treffer.</p></div>`}`;
  }

  // Gewählter Zeitraum
  const { von, bis } = glasPeriodeGrenzen(glasScheineAnker, glasScheineGran);
  const items = (glasScheineDaten || [])
    .filter((s) => { const d = glasSignaturDatum(s); return d >= von && d <= bis; })
    .sort((a, b) => (glasSignaturDatum(b) || "").localeCompare(glasSignaturDatum(a) || ""));
  glasScheineVisibleIds = items.map((s) => s.id);

  // Innerhalb von Woche/Monat nach Tagen gruppieren (mit Tages-Überschrift). Bei "Tag"
  // reicht der Navigator oben als Datum -> keine zusätzliche Überschrift.
  const wtLang = (iso) => ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"][new Date(iso + "T00:00:00").getDay()];
  let listeHtml;
  if (glasScheineGran === "tag") {
    listeHtml = items.map((s) => glasScheinZeile(s, false)).join("");
  } else {
    const byDay = new Map();
    items.forEach((s) => { const d = glasSignaturDatum(s); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(s); });
    listeHtml = [...byDay.keys()].sort((a, b) => b.localeCompare(a))
      .map((d) => `<div class="glas-schein-day">${wtLang(d)}, ${formatGlasDate(d)}</div>${byDay.get(d).map((s) => glasScheinZeile(s, false)).join("")}`).join("");
  }

  return `
    ${renderPeriodeNavigator(glasScheineAnker, glasScheineGran, "glasScheineSetAnker")}
    <p class="muted" style="margin:0 0 12px; font-size:12.5px;">${items.length} Abnahmeschein${items.length === 1 ? "" : "e"} in diesem Zeitraum</p>
    ${items.length
      ? listeHtml
      : `<div class="card"><p class="muted" style="padding:8px 0;">In diesem Zeitraum wurde nichts unterschrieben. Nutze ‹ ›, den Datums-Picker oder die Suche oben.</p></div>`}`;
}

// Auswahl-Modus für die Scheine-Liste: mehrere ankreuzen und gebündelt als EIN PDF laden.
let glasScheineSelMode = false;
let glasScheineSel = new Set();
let glasScheineVisibleIds = []; // die aktuell in der Liste sichtbaren Schein-IDs
function glasToggleScheineSelMode() {
  glasScheineSelMode = !glasScheineSelMode;
  if (!glasScheineSelMode) glasScheineSel.clear();
  glasUpdateTabContent();
}
function glasScheineSelToggle(id) {
  if (glasScheineSel.has(id)) glasScheineSel.delete(id); else glasScheineSel.add(id);
  glasUpdateTabContent();
}
function glasScheineSelAllVisible() {
  const alleDa = glasScheineVisibleIds.every((i) => glasScheineSel.has(i));
  if (alleDa) glasScheineVisibleIds.forEach((i) => glasScheineSel.delete(i));
  else glasScheineVisibleIds.forEach((i) => glasScheineSel.add(i));
  glasUpdateTabContent();
}
function glasScheineDownloadSel() { downloadGlasScheineBulk([...glasScheineSel]); }
function downloadGlasScheineVisible() { downloadGlasScheineBulk(glasScheineVisibleIds); }

// Mehrere Abnahmescheine in EIN PDF (eine Seite pro Schein). Lädt die Unterschriftsbilder
// der ausgewählten Scheine gezielt nach (sie werden aus Speichergründen nicht mitgeladen).
async function downloadGlasScheineBulk(ids) {
  const items = (glasScheineDaten || []).filter((s) => ids.includes(s.id));
  if (!items.length) { showToast("Keine Scheine ausgewählt"); return; }
  showToast(`${items.length} Schein${items.length === 1 ? "" : "e"} werden geladen…`);
  try {
    const mitBild = items.filter((s) => s.__hatBild).map((s) => s.id);
    const bilder = {};
    for (let i = 0; i < mitBild.length; i += 100) {
      const { data } = await sb.from("glas_stopps").select("id, unterschrift").in("id", mitBild.slice(i, i + 100));
      (data || []).forEach((r) => { bilder[r.id] = r.unterschrift; });
    }
    let doc = null;
    items.forEach((s) => {
      const tmpl = s.glas_touren?.template || "geko";
      doc = generateGlasPdf({ ...s, unterschrift: bilder[s.id] || null }, tmpl, s.glas_touren?.datum, doc);
    });
    const clean = (v) => String(v || "").replace(/[^a-z0-9äöüß]+/gi, "_").replace(/^_+|_+$/g, "");
    doc.save(`Abnahmescheine_${items.length}${glasScheineAnker ? "_" + clean(glasScheineAnker) : ""}.pdf`);
    if (glasScheineSelMode) { glasScheineSelMode = false; glasScheineSel.clear(); glasUpdateTabContent(); }
  } catch (e) { showToast("PDF-Erstellung fehlgeschlagen: " + e.message); }
}

async function downloadGlasScheinPdf(stopId) {
  const s = (glasScheineDaten || []).find((x) => x.id === stopId);
  if (!s) return;
  let unterschrift = null;
  if (s.__hatBild) {
    const { data } = await sb.from("glas_stopps").select("unterschrift").eq("id", stopId).maybeSingle();
    unterschrift = data?.unterschrift || null;
  }
  const tmpl = s.glas_touren?.template || "geko";
  const full = { ...s, unterschrift };
  try {
    const doc = generateGlasPdf(full, tmpl, s.glas_touren?.datum);
    doc.save(glasScheinFilename(full, tmpl));
  } catch (e) { showToast("PDF-Erstellung fehlgeschlagen: " + e.message); }
}

/* ========================================================================
   Statistiken: alles aus den unterschriebenen Stopps (Schnappschüsse) berechnet.
   Eigene Seite unter #/statistik, erreichbar über "Weitere Einstellungen".
   ======================================================================== */

let glasStatistikDaten = null;   // alle erledigten Stopps (einmal geladen, dann gecacht)
let glasStatZeitraum = "12m";    // "12m" | "jahr" | "vorjahr" | "alles"
let glasStatMetrik = "qm";       // "qm" | "scheine"
let glasStatGran = "monat";      // "tag" | "woche" | "monat" - Granularität des Verlaufs
let glasStatSelKey = null;       // angeklickte Verlaufs-Periode -> Detailansicht dieses Tags/Woche/Monats
function glasStatSetSel(key) { glasStatSelKey = glasStatSelKey === key ? null : key; renderGlasAdmin(); }

// Perioden-Schlüssel + kompaktes Label für den Statistik-Verlauf je nach Granularität
function glasStatPeriode(datum, gran) {
  if (gran === "tag") return { key: datum, label: `${datum.slice(8, 10)}.${datum.slice(5, 7)}.` };
  if (gran === "woche") { const mo = glasMontagVon(datum); return { key: mo, label: `KW ${glasIsoWeek(datum)}` }; }
  const ym = datum.slice(0, 7); return { key: ym, label: glasStatMonatLabel(ym) };
}

function glasOpenStatistik() {
  glasContentAnimPending = true;
  if (!glasStatistikDaten) loadGlasStatistik();
  glasNavigate({ type: "statistik" });
}

let glasStatistikLaden = false;
async function loadGlasStatistik() {
  if (glasStatistikLaden) return;
  glasStatistikLaden = true;
  const { data, error } = await sb
    .from("glas_stopps")
    .select("objekt_id, objekt, kunde_adresse, positionen, zusatz, datum, status")
    .eq("status", "erledigt");
  glasStatistikDaten = error ? [] : (data || []).filter((x) => x.datum);
  glasStatistikLaden = false;
  renderGlasAdmin();
}

function glasStatQmVon(stop) {
  let sum = 0;
  try {
    JSON.parse(stop.positionen || "[]").forEach((p) => { sum += parseFloat(String(p.qm || "").replace(",", ".")) || 0; });
  } catch (e) {}
  return sum;
}

function glasStatKundeVon(stop) {
  const o = glasObjekte.find((x) => x.id === stop.objekt_id);
  if (o && o.kunde_name) return o.kunde_name;
  return (stop.kunde_adresse || "").split("\n")[0] || "Unbekannt";
}

function glasStatQmText(qm) {
  return String(Math.round(qm * 10) / 10).replace(".", ",");
}

function glasStatZeitraumGrenzen() {
  const heute = glasTodayIso();
  const jahr = heute.slice(0, 4);
  if (glasStatZeitraum === "jahr") return { von: `${jahr}-01-01`, bis: heute, label: `Jahr ${jahr}` };
  if (glasStatZeitraum === "vorjahr") {
    const vj = String(Number(jahr) - 1);
    return { von: `${vj}-01-01`, bis: `${vj}-12-31`, label: `Jahr ${vj}` };
  }
  if (glasStatZeitraum === "alles") return { von: "0000-01-01", bis: "9999-12-31", label: "Gesamter Zeitraum" };
  return { von: glasAddMonthsIso(heute, -12), bis: heute, label: "Letzte 12 Monate" };
}

const GLAS_STAT_MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function glasStatMonatLabel(ym) {
  return `${GLAS_STAT_MONATE[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
}

// Detail des angeklickten Verlaufs-Zeitraums (ein Tag / eine Woche / ein Monat)
function renderStatEinzelPeriode(rows) {
  const sel = rows.filter((x) => glasStatPeriode(x.datum, glasStatGran).key === glasStatSelKey);
  const label = sel.length ? glasStatPeriode(sel[0].datum, glasStatGran).label : glasStatSelKey;
  let qm = 0; const objekte = new Set(); const kunden = new Set();
  sel.forEach((x) => { qm += glasStatQmVon(x); objekte.add(x.objekt_id || x.objekt); kunden.add(glasStatKundeVon(x)); });
  const liste = [...sel].sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));
  return `
    <div class="card" style="border-color:var(--info-border); background:var(--info-bg);">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px;">
        <p style="margin:0; font-weight:700;">📅 ${escapeHtml(label)}</p>
        <button class="btn btn-sm" onclick="glasStatSelKey=null; renderGlasAdmin();">✕ zurück</button>
      </div>
      <p class="muted" style="margin:0 0 6px; font-size:13px;">${glasStatQmText(qm)} qm · ${sel.length} Schein${sel.length === 1 ? "" : "e"} · ${objekte.size} Objekt${objekte.size === 1 ? "" : "e"} · ${kunden.size} Kunde${kunden.size === 1 ? "" : "n"}</p>
      ${liste.map((x) => `
        <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-top:1px solid var(--border);">
          <div style="flex:1; min-width:0;">
            <p style="margin:0; font-weight:500; font-size:13.5px;">${escapeHtml(x.objekt || "Schein")}</p>
            <p class="muted" style="margin:1px 0 0; font-size:12px;">${escapeHtml(glasStatKundeVon(x))} · ${formatGlasDate(x.datum)}${glasStatQmVon(x) ? " · " + glasStatQmText(glasStatQmVon(x)) + " qm" : ""}</p>
          </div>
        </div>`).join("")}
    </div>`;
}

function renderStatistikPage() {
  if (glasStatistikDaten === null) {
    loadGlasStatistik();
    return `
      <button class="btn btn-sm" style="margin:16px 0;" onclick="goGlasTab('einstellungen')">&larr; Zurück</button>
      <p class="muted"><span class="spinner"></span> Statistiken werden berechnet...</p>`;
  }

  const { von, bis, label } = glasStatZeitraumGrenzen();
  const rows = glasStatistikDaten.filter((x) => x.datum >= von && x.datum <= bis);

  // KPIs
  let qmGesamt = 0;
  const objekte = new Set();
  const kunden = new Set();
  rows.forEach((x) => {
    qmGesamt += glasStatQmVon(x);
    objekte.add(x.objekt_id || x.objekt);
    kunden.add(glasStatKundeVon(x));
  });

  const metrikVon = (x) => (glasStatMetrik === "qm" ? glasStatQmVon(x) : 1);
  const metrikText = (wert) => (glasStatMetrik === "qm" ? `${glasStatQmText(wert)} qm` : `${wert} Schein${wert === 1 ? "" : "e"}`);

  // Gruppierungen: Verlauf (je nach Granularität), Tag (für "bester Tag"), Objekt
  const proPeriode = new Map(); // key -> { label, wert }
  const proTag = new Map();
  const proObjekt = new Map();
  rows.forEach((x) => {
    const per = glasStatPeriode(x.datum, glasStatGran);
    const cur = proPeriode.get(per.key) || { label: per.label, wert: 0 };
    cur.wert += metrikVon(x);
    proPeriode.set(per.key, cur);
    proTag.set(x.datum, (proTag.get(x.datum) || 0) + metrikVon(x));
    const key = x.objekt || "?";
    proObjekt.set(key, (proObjekt.get(key) || 0) + metrikVon(x));
  });

  const perioden = [...proPeriode.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const maxPeriode = Math.max(1, ...perioden.map(([, v]) => v.wert));
  const besterTag = [...proTag.entries()].sort((a, b) => b[1] - a[1])[0];
  const besterMonatMap = new Map();
  rows.forEach((x) => { const m = x.datum.slice(0, 7); besterMonatMap.set(m, (besterMonatMap.get(m) || 0) + metrikVon(x)); });
  const besterMonat = [...besterMonatMap.entries()].sort((a, b) => b[1] - a[1])[0];
  const topObjekte = [...proObjekt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const granLabel = glasStatGran === "tag" ? "Tag" : glasStatGran === "woche" ? "Woche" : "Monat";

  const kpi = (wert, beschriftung) => `
    <div class="card" style="text-align:center; margin-bottom:0;">
      <p style="margin:0; font-size:21px; font-weight:800; color:var(--blue);">${wert}</p>
      <p class="muted" style="margin:3px 0 0;">${beschriftung}</p>
    </div>`;

  return `
    <button class="btn btn-sm" style="margin:16px 0;" onclick="goGlasTab('einstellungen')">&larr; Zurück zu den Einstellungen</button>
    <div style="display:flex; gap:8px; align-items:center; margin-bottom:14px; flex-wrap:wrap;">
      <h1 style="margin:0;">📊 Statistiken</h1>
      <select style="width:auto; margin-left:auto; font-size:13px;" onchange="glasStatZeitraum = this.value; glasStatSelKey = null; renderGlasAdmin();">
        <option value="12m" ${glasStatZeitraum === "12m" ? "selected" : ""}>Letzte 12 Monate</option>
        <option value="jahr" ${glasStatZeitraum === "jahr" ? "selected" : ""}>Dieses Jahr</option>
        <option value="vorjahr" ${glasStatZeitraum === "vorjahr" ? "selected" : ""}>Letztes Jahr</option>
        <option value="alles" ${glasStatZeitraum === "alles" ? "selected" : ""}>Alles</option>
      </select>
      <select style="width:auto; font-size:13px;" onchange="glasStatMetrik = this.value; renderGlasAdmin();">
        <option value="qm" ${glasStatMetrik === "qm" ? "selected" : ""}>nach qm</option>
        <option value="scheine" ${glasStatMetrik === "scheine" ? "selected" : ""}>nach Scheinen</option>
      </select>
      <select style="width:auto; font-size:13px;" onchange="glasStatGran = this.value; glasStatSelKey = null; renderGlasAdmin();">
        <option value="tag" ${glasStatGran === "tag" ? "selected" : ""}>pro Tag</option>
        <option value="woche" ${glasStatGran === "woche" ? "selected" : ""}>pro Woche</option>
        <option value="monat" ${glasStatGran === "monat" ? "selected" : ""}>pro Monat</option>
      </select>
    </div>
    <p class="muted" style="margin:0 0 10px;">${label} · nur unterschriebene Abnahmen zählen</p>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
      ${kpi(glasStatQmText(qmGesamt) + " qm", "gereinigte Fläche")}
      ${kpi(String(rows.length), "Abnahmescheine")}
      ${kpi(String(objekte.size), "verschiedene Objekte")}
      ${kpi(String(kunden.size), "verschiedene Kunden")}
    </div>

    <div class="card">
      <h2>Verlauf pro ${granLabel}</h2>
      <p class="muted" style="margin:-4px 0 8px; font-size:12px;">Auf einen Balken tippen zeigt genau diesen ${granLabel} im Detail.</p>
      <div style="max-height:${glasStatGran === "tag" ? "340px" : "none"}; overflow-y:auto;">
      ${perioden.length ? perioden.map(([key, v]) => `
        <div style="display:flex; align-items:center; gap:10px; padding:3px 0; cursor:pointer; border-radius:6px; ${glasStatSelKey === key ? "background:var(--info-bg);" : ""}" onclick="glasStatSetSel('${key}')">
          <span class="muted" style="flex:0 0 56px; font-size:12px;">${escapeHtml(v.label)}</span>
          <div style="flex:1; background:var(--bg); border-radius:5px; overflow:hidden;">
            <div style="width:${Math.max(2, Math.round((v.wert / maxPeriode) * 100))}%; background:${glasStatSelKey === key ? "#1e7a34" : "var(--blue)"}; border-radius:5px; padding:3px 6px; color:white; font-size:11px; font-weight:600; white-space:nowrap;">${metrikText(Math.round(v.wert * 10) / 10)}</div>
          </div>
        </div>`).join("") : `<p class="muted">Noch keine unterschriebenen Abnahmen in diesem Zeitraum.</p>`}
      </div>
    </div>

    ${glasStatSelKey ? renderStatEinzelPeriode(rows) : ""}

    ${rows.length ? `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
      <div class="card" style="margin-bottom:0;">
        <p class="muted" style="margin:0 0 4px;">🏆 Bester Tag</p>
        <p style="margin:0; font-weight:700;">${besterTag ? formatGlasDate(besterTag[0]) : "–"}</p>
        <p class="muted" style="margin:2px 0 0;">${besterTag ? metrikText(Math.round(besterTag[1] * 10) / 10) : ""}</p>
      </div>
      <div class="card" style="margin-bottom:0;">
        <p class="muted" style="margin:0 0 4px;">🏆 Bester Monat</p>
        <p style="margin:0; font-weight:700;">${besterMonat ? glasStatMonatLabel(besterMonat[0]) : "–"}</p>
        <p class="muted" style="margin:2px 0 0;">${besterMonat ? metrikText(Math.round(besterMonat[1] * 10) / 10) : ""}</p>
      </div>
    </div>

    <div class="card">
      <h2>Top-Objekte</h2>
      ${topObjekte.map(([nameObj, wert], i) => `
        <div style="display:flex; justify-content:space-between; gap:10px; padding:8px 0; ${i ? "border-top:1px solid var(--border);" : ""}">
          <span style="font-size:13.5px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${i + 1}. ${escapeHtml(nameObj)}</span>
          <span style="font-weight:700; font-size:13px; white-space:nowrap;">${metrikText(Math.round(wert * 10) / 10)}</span>
        </div>`).join("")}
    </div>` : ""}
  `;
}

glasInit();
