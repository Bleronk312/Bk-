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
let glasTourLfd = new Map(); // objekt_id -> Dietrich LFD-Nr. (pro Schein/Intervall neu, händisch)
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
// Firma einer Position/Tour: 'geko' = GEKO Clean, 'sub' = Dietrich (Namensgebung wie beim
// Tour-Template). glasFirmaLabel liefert die Anzeige.
function glasFirmaLabel(tpl) { return tpl === "sub" ? "Dietrich" : "GEKO Clean"; }

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

// Eigene Lager-App: Die Hub-Kachel öffnet mit ?app=lager DIREKT den Lager-Plan -
// ohne Glas-Reiter drumherum. Kopfzeile und Titel werden entsprechend umgestellt.
const glasLagerApp = new URLSearchParams(location.search).get("app") === "lager";
if (glasLagerApp) {
  document.title = "GEKO Hub - Lager & Einsatzplan";
  document.addEventListener("DOMContentLoaded", () => {
    const g = document.querySelector(".app-header .greeting");
    if (g) g.textContent = "Lager & Einsatzplan";
  });
}

// App-Shell-Höhe hart in ECHTEN Pixeln setzen: iOS berechnet 100vh/100dvh (und teils
// sogar position:fixed-Höhen) im Standalone-/Safari-Modus falsch, wodurch der Rahmen
// samt unterer Leiste über dem Bildschirmrand endete. window.innerHeight bzw. der
// visualViewport liefern dagegen die tatsächlich sichtbare Höhe - die nehmen wir
// wörtlich und führen sie bei jeder Viewport-Änderung nach.
function glasShellHoehe() {
  if (!document.body.classList.contains("glas-shell")) return;
  if (!window.matchMedia("(max-width: 759px)").matches) {
    document.body.style.height = "";
    document.documentElement.style.background = "";
    return;
  }
  // iOS-Standalone reserviert unterhalb der Seite eine tote Zone (am Gerät per Lineal
  // nachgemessen: sichtbare Kante = exakt innerHeight; alles darüber hinaus wird nie
  // angezeigt). innerHeight ist also die Wahrheit - KEINE Korrektur nach unten. Damit
  // die tote Zone nicht als grauer Fremdkörper wirkt, bekommt der Zeichen-Untergrund
  // (html) die Leisten-Farbe: Zone und Leiste verschmelzen optisch.
  document.documentElement.style.background = "var(--card)";
  // Feintuning am Gerät: ?bh=820 erzwingt eine exakte Pixel-Höhe (nur zum Testen)
  const bhParam = parseInt(new URLSearchParams(location.search).get("bh"), 10);
  if (bhParam > 0) { document.body.style.height = bhParam + "px"; glasDebugOverlay(); return; }
  const h = Math.round((window.visualViewport && window.visualViewport.height) || window.innerHeight);
  if (h > 0) document.body.style.height = h + "px";
  glasDebugOverlay();
}

// Mess-Overlay für die Fehlersuche am echten Gerät: nur aktiv mit ?debug=1 in der URL.
function glasDebugOverlay() {
  if (!/[?&]debug=1/.test(location.search)) return;
  let el = document.getElementById("glasDbg");
  if (!el) {
    el = document.createElement("div");
    el.id = "glasDbg";
    el.style.cssText = "position:fixed;top:70px;left:8px;z-index:2147483647;background:rgba(0,0,0,.85);color:#7CFC00;font:11px/1.6 monospace;padding:8px 10px;border-radius:8px;pointer-events:none;white-space:pre;";
    document.body.appendChild(el);
  }
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);width:1px;visibility:hidden;";
  document.body.appendChild(probe);
  const nav = document.querySelector("#glasNavHost .glas-bottomnav");
  const b = document.body.getBoundingClientRect();
  const n = nav ? nav.getBoundingClientRect() : null;
  el.textContent =
    `innerH ${window.innerHeight}  screenH ${screen.height}\n` +
    `vvH ${window.visualViewport ? Math.round(window.visualViewport.height) : "-"}  vvTop ${window.visualViewport ? Math.round(window.visualViewport.offsetTop) : "-"}\n` +
    `body ${Math.round(b.top)}..${Math.round(b.bottom)}  h ${Math.round(b.height)}\n` +
    `nav ${n ? Math.round(n.top) + ".." + Math.round(n.bottom) : "-"}\n` +
    `safeB ${Math.round(probe.getBoundingClientRect().height)}  standalone ${!!(navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches))}\n` +
    `scrollY ${Math.round(window.scrollY)}  bodyH(style) ${document.body.style.height || "-"}`;
  probe.remove();

  // Lineal am unteren Body-Rand: 10px-Streifen mit Pixel-Beschriftung. Auf einem
  // Screenshot lässt sich damit exakt ablesen, welche Body-Koordinate am physischen
  // Bildschirmrand bzw. am Home-Balken liegt.
  let lineal = document.getElementById("glasDbgLineal");
  if (!lineal) {
    lineal = document.createElement("div");
    lineal.id = "glasDbgLineal";
    document.body.appendChild(lineal);
  }
  lineal.style.cssText = "position:absolute;left:0;right:0;bottom:0;height:120px;z-index:2147483646;pointer-events:none;";
  const H = Math.round(document.body.getBoundingClientRect().height);
  let s = "";
  for (let k = 0; k < 12; k++) {
    s += `<div style="position:absolute;left:0;right:0;bottom:${k * 10}px;height:10px;background:${k % 2 ? "rgba(255,0,180,.55)" : "rgba(255,220,0,.65)"};color:#000;font:9px/10px monospace;padding-left:${k % 2 ? 60 : 6}px;">${H - k * 10}</div>`;
  }
  lineal.innerHTML = s;
}

// Graffiti-Abnahmescheine mit Termin, damit sie im Haupt-Kalender miterscheinen.
// (Eigene Tabelle "scheine" - die Glas-Termine sind glas_termine. Anzeige read-only,
// bearbeitet wird in der Graffiti-App.)
let glasGraffitiTermine = [];
let glasKalGraffitiEinblenden = true;
const GLAS_GRAFFITI_COL = "#b0308a";        // offen/geplant: Magenta
const GLAS_GRAFFITI_DONE = "#7a2a6b";       // unterschrieben: dunkleres Magenta (klar anders als Glas-Grün)
async function loadGlasGraffitiTermine() {
  const spalten = "id, kunde, adresse, ansprechpartner, telefon, kategorie, leistungen, termin, kdnr, monat, unterschrift_name, signed_at";
  // Scheine mit geplantem Termin ODER mit Unterschrift laden (letztere auch OHNE Termin ->
  // erscheinen dann am Tag der Unterschrift im Kalender).
  let { data, error } = await sb.from("scheine").select(spalten).or("termin.not.is.null,signed_at.not.is.null").eq("archiviert", false);
  if (error) {
    // Fallback auf das alte Verhalten (nur terminierte), falls die or-Abfrage nicht klappt
    ({ data, error } = await sb.from("scheine").select(spalten).not("termin", "is", null).eq("archiviert", false));
  }
  glasGraffitiTermine = error ? [] : (data || []);
}

// Tag, an dem ein Graffiti-Schein im Kalender steht: geplanter Termin, sonst der Tag der
// Unterschrift (für Scheine ohne Termin).
function glasGraffitiTag(g) {
  return g.termin ? glasDatumVonTimestamp(g.termin) : glasDatumVonTimestamp(g.signed_at);
}

async function glasInit() {
  glasShellHoehe();
  if (window.visualViewport) window.visualViewport.addEventListener("resize", glasShellHoehe);
  window.addEventListener("resize", glasShellHoehe);
  window.addEventListener("orientationchange", () => setTimeout(glasShellHoehe, 250));
  window.addEventListener("pageshow", glasShellHoehe);
  setInterval(glasDebugOverlay, 1500); // ohne ?debug=1 ein No-Op
  // Manche Home-Bildschirm-Verknüpfungen verlieren den #-Teil der URL -
  // ?tab=kalender funktioniert deshalb als gleichwertiger Einstieg.
  const qTab = new URLSearchParams(location.search).get("tab");
  if (!location.hash && qTab) location.hash = "#/tab/" + qTab;
  if (glasCalApp && !location.hash) location.hash = "#/tab/kalender";
  glasPage = glasParseHash();
  if (glasLagerApp) { glasLagerOffen = true; loadGlasLagerPlan().then(renderGlasAdmin); }
  renderGlasAdmin(); // Startseite sofort zeigen, Daten laden im Hintergrund
  await Promise.all([loadGlasKunden(), loadGlasObjekte(), loadGlasObjektPositionen(), loadGlasTouren(), loadGlasPositionen(), loadGlasTermine(), loadGlasEingeplantePositionen(), loadGlasEinstellungen(), loadGlasMitarbeiter(), loadGlasUrlaub(), loadGlasGraffitiTermine()]);
  window.addEventListener("hashchange", () => {
    // Browser-Zurück soll die Lager-Unterseite verlassen (außer sie IST die App)
    if (!glasLagerApp) glasLagerOffen = false;
    glasPage = glasParseHash();
    renderGlasAdmin();
  });
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
  if (o.position || o.qm) return [{ nr: o.position || "10", art: "Glas- und Rahmenreinigung", qm: o.qm || "", template: "geko" }];
  const ersteGeko = glasPositionen.find((p) => (p.template || "geko") === "geko");
  return [{ nr: ersteGeko?.nr || "10", art: ersteGeko?.name || "", qm: "", template: "geko" }];
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
    id: null, objekt_id: objektId, nr: p.nr, art: p.art, qm: p.qm, pos_text: p.pos_text || "",
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
  // lfd_nr im Stopp-Embed: für den "LFD-Nr. fehlt"-Hinweis auf Dietrich-Tourkarten.
  // Fallback ohne die Spalte, solange die SQL-Migration noch nicht ausgeführt wurde.
  let { data, error } = await sb
    .from("glas_touren")
    .select("*, glas_stopps(id, status, lfd_nr)")
    .order("datum", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(120);
  if (error && /lfd_nr/.test(error.message || "")) {
    ({ data, error } = await sb
      .from("glas_touren")
      .select("*, glas_stopps(id, status)")
      .order("datum", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(120));
  }
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
  if (kind === "objektliste" && id) return { type: "objektliste", filter: id };
  if (kind === "kunde" && id) return { type: "kunde", id };
  if (kind === "tab" && id) return { type: "tabs", tab: id };
  if (kind === "statistik") return { type: "statistik" };
  if (kind === "jahr") return { type: "jahr" };
  return { type: "home" };
}

function glasHashFor(page) {
  if (page.type === "objekt") return `#/objekt/${page.id}`;
  if (page.type === "objektliste") return `#/objektliste/${page.filter}`;
  if (page.type === "kunde") return `#/kunde/${page.id}`;
  if (page.type === "objekt-form") return location.hash || "#/tab/kunden"; // kein eigener Hash nötig
  if (page.type === "home") return "#/";
  if (page.type === "statistik") return "#/statistik";
  if (page.type === "jahr") return "#/jahr";
  return `#/tab/${page.tab}`;
}

// Einmalige Eintritts-Animation nur bei echten Navigationswechseln (nicht beim Tippen
// in Suchfeldern oder Checkbox-Klicks - dort würde es flackern)
let glasContentAnimPending = false;
let glasCalAnimDir = null;

// Slide-Richtung aus der Reiter-Reihenfolge ableiten (alter -> neuer Tab)
function glasSetTabAnimDir(neuerKey) {
  const alterKey = glasPage && glasPage.type === "tabs" ? glasPage.tab : "";
  const a = GLAS_TAB_ORDNUNG[alterKey] ?? 0;
  const b = GLAS_TAB_ORDNUNG[neuerKey] ?? 0;
  glasTabAnimDir = b === a ? 0 : (b > a ? 1 : -1);
}

// Nach oben scrollen - auf dem Handy scrollt der App-Shell-Container (#glasScroller),
// auf dem Desktop das Fenster. Beide zurücksetzen deckt beide Fälle ab.
function glasScrollTop() {
  window.scrollTo(0, 0);
  const sc = document.getElementById("glasScroller");
  if (sc) sc.scrollTop = 0;
}

function goGlasHome() {
  glasContentAnimPending = true;
  glasSetTabAnimDir("");
  glasScrollTop(); // neuer Reiter startet oben - verhindert Scroll-Sprünge der fixen Leiste
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
  if (!glasLagerApp) glasLagerOffen = false; // Unterseite - Navigation schließt sie (außer als eigene App)
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

function goGlasObjekt(id) { glasContentAnimPending = true; glasScrollTop(); glasAuswahl = { modus: null, ids: new Set() }; glasNavigate({ type: "objekt", id }); }
function goGlasObjektListe(filter) { glasContentAnimPending = true; glasScrollTop(); glasAuswahl = { modus: null, ids: new Set() }; glasNavigate({ type: "objektliste", filter }); }
function goGlasKunde(id) {
  glasContentAnimPending = true;
  glasScrollTop();
  glasAuswahl = { modus: null, ids: new Set() };
  glasKundeObjFilter = "alle";
  glasKundeErlMonat = { year: new Date().getFullYear(), month: new Date().getMonth() };
  // Verlauf direkt anstoßen: der "Erledigt"-Chip zeigt dann sofort die Zahl des Monats
  if (!glasKundeTermineCache[id]) loadGlasKundeTermine(id);
  glasNavigate({ type: "kunde", id });
}
function goGlasTab(tab) {
  glasContentAnimPending = true;
  glasSetTabAnimDir(tab);
  glasScrollTop(); // neuer Reiter startet oben - verhindert Scroll-Sprünge der fixen Leiste
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

// Einmaliger, weicher Eintritt für Detailseiten (Kunde/Objekt/Statistik/Formular) beim
// ECHTEN Navigieren. Interaktionen auf der Seite rendern ohne Animation (kein Flackern).
// Modal-Overlays (z.B. das Kalender-Tages-Sheet) als DIREKTES body-Kind hosten statt
// tief in #glasScroller: sonst lässt sich ihr Inhalt auf iOS im Standalone-Modus NICHT
// scrollen (fixe Elemente in einem Scroll-Container fangen die Wischgeste nicht ab -
// derselbe Grund, warum die untere Leiste als #glasNavHost am body hängt).
function glasPortalModals() {
  const view = document.getElementById("view");
  let host = document.getElementById("glasModalHost");
  const modals = view ? [...view.querySelectorAll(".modal-overlay")] : [];
  if (modals.length) {
    if (!host) { host = document.createElement("div"); host.id = "glasModalHost"; document.body.appendChild(host); }
    host.innerHTML = "";
    modals.forEach((m) => host.appendChild(m));
    host.querySelectorAll(".glas-day-sheet").forEach((sh) => glasAttachSheetSwipe(sh, sh.closest(".modal-overlay")));
    // Hintergrund (Kalender-Scroller) sperren, solange ein Sheet offen ist - sonst
    // scrollt beim Runterwischen des Tages-Sheets der Kalender dahinter mit.
    document.body.classList.add("glas-modal-open");
  } else {
    if (host && host.innerHTML) host.innerHTML = "";
    document.body.classList.remove("glas-modal-open");
  }
}

// Nach-unten-Wischen schließt das Sheet - ABER nur, wenn es ganz oben steht (sonst
// scrollt der Inhalt normal). Die Entscheidung fällt einmal beim Antippen (Start-
// Scrollposition), es wird also NIE mitten in einer Scrollgeste umgeschaltet -> kein
// Ruckeln, kein versehentliches Zuklappen.
function glasAttachSheetSwipe(sheet, overlay) {
  let startY = 0, startScroll = 0, dragging = false, dy = 0;
  const close = () => {
    if (overlay && overlay.classList.contains("glas-graffiti-ov")) glasGraffitiInfoId = null;
    else glasKalenderSelectedDay = null;
    renderGlasAdmin();
  };
  sheet.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
    startScroll = sheet.scrollTop;
    dragging = false; dy = 0;
    sheet.style.transition = "";
    sheet.style.animation = "none"; // Eintritts-Animation nicht mit dem Ziehen kollidieren lassen
  }, { passive: true });
  sheet.addEventListener("touchmove", (e) => {
    const delta = e.touches[0].clientY - startY;
    if (!dragging) {
      if (delta > 4 && startScroll <= 0 && sheet.scrollTop <= 0) dragging = true;
      else return; // normales Scrollen zulassen
    }
    dy = Math.max(0, delta);
    sheet.style.transform = `translateY(${dy}px)`;
    if (overlay) overlay.style.background = `rgba(20,25,35,${(0.45 * Math.max(0, 1 - dy / 420)).toFixed(3)})`;
    if (e.cancelable) e.preventDefault(); // verhindert gleichzeitiges Scrollen/Gummiband
  }, { passive: false });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = "transform .28s cubic-bezier(.32,.72,0,1)";
    if (dy > 90) {
      sheet.style.transform = "translateY(100%)";
      if (overlay) { overlay.style.transition = "background .28s"; overlay.style.background = "rgba(20,25,35,0)"; }
      setTimeout(close, 250);
    } else {
      sheet.style.transform = "translateY(0)";
      if (overlay) overlay.style.background = "";
    }
    dy = 0;
  };
  sheet.addEventListener("touchend", end, { passive: true });
  sheet.addEventListener("touchcancel", end, { passive: true });
}

function glasViewEintritt(view) {
  if (!glasContentAnimPending) return;
  glasContentAnimPending = false;
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  view.style.transition = "none";
  view.style.transform = "translateY(12px)";
  view.style.opacity = "0";
  void view.offsetHeight; // Style-Flush: Startwerte festschreiben, sonst springt die Transition
  requestAnimationFrame(() => {
    view.style.transition = "opacity 0.22s ease, transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)";
    view.style.transform = "";
    view.style.opacity = "1";
    setTimeout(() => { view.style.transition = "none"; }, 330);
  });
}

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

  if (glasPage.type === "objekt") { view.innerHTML = renderObjektDetailPage(glasPage.id); glasViewEintritt(view); glasPortalModals(); return; }
  if (glasPage.type === "objektliste") { view.innerHTML = renderObjektListePage(glasPage.filter); glasViewEintritt(view); glasPortalModals(); return; }
  if (glasPage.type === "kunde") { view.innerHTML = renderKundeDetailPage(glasPage.id); glasViewEintritt(view); glasPortalModals(); return; }
  if (glasPage.type === "objekt-form") { view.innerHTML = renderObjektForm(); glasViewEintritt(view); glasPortalModals(); return; }
  if (glasPage.type === "statistik") { view.innerHTML = renderStatistikPage(); glasViewEintritt(view); glasAnimateProgress(); glasPortalModals(); return; }
  if (glasPage.type === "jahr") { view.innerHTML = renderJahrPage(); glasViewEintritt(view); glasPortalModals(); return; }
  if (glasLagerOffen) { view.innerHTML = renderLagerPlan(); glasViewEintritt(view); glasPortalModals(); return; }

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
  // badge: kleine rote Zahl am Reiter (z.B. offene Urlaubsanträge am Kalender)
  const tb = (active, ic, lb, onclick, badge) =>
    `<button class="tab-btn ${active ? "active" : ""}" onclick="${onclick}"><span class="tb-ic">${ic}${badge ? `<i class="tb-badge">${badge > 9 ? "9+" : badge}</i>` : ""}</span><span class="tb-lb">${lb}</span></button>`;
  const offeneUrlaube = (typeof glasOffeneUrlaubsantraege === "function") ? glasOffeneUrlaubsantraege().length : 0;
  const glasNav = glasCalApp
    ? `<div class="tabs"><button class="tab-btn active" style="justify-content:flex-start; gap:6px;" onclick="goGlasTab('kalender')">‹ Zurück zum Kalender</button></div>`
    : `<div class="glas-bottomnav"><div class="tabs">
      ${tb(isHome, "🏠", "Start", "goGlasHome()")}
      ${tb(tab === "touren", "🚐", "Touren", "goGlasTab('touren')")}
      ${tb(tab === "kunden", "👥", "Kunden", "goGlasTab('kunden')")}
      ${tb(tab === "kalender", "📅", "Kalender", "goGlasTab('kalender')", offeneUrlaube)}
      ${tb(tab === "scheine", "📄", "Scheine", "goGlasTab('scheine')")}
      ${tb(["faellig", "einstellungen", "mehr"].includes(tab), "☰", "Mehr", "goGlasTab('mehr')")}
    </div></div>`;

  // Handy: die feste untere Leiste lebt als DIREKTES body-Kind (#glasNavHost) - so wird
  // sie bei Tab-Wechseln nicht mit dem Content zerstört/neu aufgebaut (kein Springen) und
  // hängt nie in animierten/transformierten Vorfahren. Desktop nutzt die Kopie im Fluss
  // oben (CSS blendet je nach Breite die richtige ein).
  if (!glasCalApp) {
    let navHost = document.getElementById("glasNavHost");
    if (!navHost) { navHost = document.createElement("div"); navHost.id = "glasNavHost"; document.body.appendChild(navHost); }
    // Die fixe Leiste wird nach dem ersten Aufbau NIE ersetzt (innerHTML-Neuaufbau ließ
    // sie auf iOS beim Tab-Wechsel kurz springen) - nur die Aktiv-Klasse wandert.
    const hostBtns = navHost.querySelectorAll(".tab-btn");
    if (hostBtns.length === 6) {
      const aktivIdx = isHome ? 0 : { touren: 1, kunden: 2, kalender: 3, scheine: 4, mehr: 5, faellig: 5, einstellungen: 5 }[tab] ?? -1;
      hostBtns.forEach((b, i) => b.classList.toggle("active", i === aktivIdx));
      // Der Zähler am Kalender-Reiter muss hier von Hand nachgezogen werden, weil die
      // feste Leiste bewusst nicht neu aufgebaut wird (sonst springt sie auf iOS).
      const kalIc = hostBtns[3] && hostBtns[3].querySelector(".tb-ic");
      if (kalIc) {
        let b = kalIc.querySelector(".tb-badge");
        if (offeneUrlaube) {
          if (!b) { b = document.createElement("i"); b.className = "tb-badge"; kalIc.appendChild(b); }
          b.textContent = offeneUrlaube > 9 ? "9+" : String(offeneUrlaube);
        } else if (b) b.remove();
      }
    } else {
      navHost.innerHTML = glasNav;
    }
  } else {
    const navHost = document.getElementById("glasNavHost");
    if (navHost) { navHost.innerHTML = ""; navHost.__html = ""; }
  }

  // Die Shell (Reiter-Kopie im Fluss, Such-Slot, Content-Container) wird nur EINMAL
  // gebaut und danach wiederverwendet: So bleibt beim Tab-Wechsel der ALTE Inhalt für
  // die Hinaus-Animation stehen, und das Suchfeld verliert nie Fokus/Tastatur.
  const suchHtml = glasCalApp || (glasPage.type === "tabs" && ["kalender", "scheine", "mehr"].includes(glasPage.tab)) ? "" : renderGlobalSearchBar();
  const bindGlobalSearch = () => {
    const gsEl = document.getElementById("global_search");
    if (gsEl) gsEl.oninput = (e) => { glasGlobalSearch = e.target.value; glasUpdateTabContent(); };
  };

  if (glasCalApp || !document.getElementById("glasTabContent") || !view.querySelector(".glas-nav-inflow")) {
    view.innerHTML = `
      ${glasCalApp ? glasNav : `<div class="glas-nav-inflow">${glasNav}</div>`}
      <div id="glasSearchSlot">${suchHtml}</div>
      <div id="glasTabContent"></div>
    `;
    view.__suchHtml = suchHtml;
    bindGlobalSearch();
  } else {
    const inflow = view.querySelector(".glas-nav-inflow");
    if (inflow.__html !== glasNav) { inflow.innerHTML = glasNav; inflow.__html = glasNav; }
    if (view.__suchHtml !== suchHtml) {
      const slot = document.getElementById("glasSearchSlot");
      if (slot) slot.innerHTML = suchHtml;
      view.__suchHtml = suchHtml;
      bindGlobalSearch();
    }
  }
  glasUpdateTabContent();
}

// Richtung des Tab-Wechsels (für den Slide): Reihenfolge der Reiter in der Leiste.
// dir < 0 = neuer Tab liegt links (Inhalt kommt von links), dir > 0 = rechts.
const GLAS_TAB_ORDNUNG = { "": 0, touren: 1, kunden: 2, kalender: 3, scheine: 4, mehr: 5, faellig: 5, einstellungen: 5 };
let glasTabAnimDir = 0;
let glasTabAnimBusy = false;

// Baut NUR den Tab-Inhalt (#glasTabContent) neu auf - Reiterleiste und globales Suchfeld
// bleiben stehen. Bei einem echten Reiter-Wechsel (glasContentAnimPending) gleitet der
// alte Inhalt kurz hinaus und der neue aus der Wechsel-Richtung herein - GPU-freundlich
// nur über transform/opacity. Interaktionen INNERHALB eines Tabs aktualisieren ohne
// Animation an Ort und Stelle (kein Flackern).
function glasUpdateTabContent() {
  const content = document.getElementById("glasTabContent");
  if (!content) { renderGlasAdmin(); return; }
  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hatAlt = content.innerHTML.trim() !== ""; // alter Inhalt vorhanden -> Hinaus-Phase möglich
  const animieren = glasContentAnimPending && !reduceMotion && !glasTabAnimBusy;
  const dir = glasTabAnimDir;
  glasContentAnimPending = false;
  glasTabAnimDir = 0;

  const isHome = glasPage.type === "home";
  const tab = isHome ? "" : glasPage.tab;
  const html = glasGlobalSearch.trim() ? renderGlobalSearchResults()
    : isHome ? renderGlasHome()
    : tab === "kunden" ? renderKundenTab()
    : tab === "faellig" ? renderFaelligTab()
    : tab === "kalender" ? renderKalenderTab()
    : tab === "scheine" ? renderScheineTab()
    : tab === "einstellungen" ? renderEinstellungenTab()
    : tab === "mehr" ? renderMehrTab()
    : renderTourenTab();

  const anwenden = () => {
    content.innerHTML = html;
    glasAnimateProgress();
    glasAttachTabHandlers(tab);
    glasPortalModals();
  };

  if (!animieren) {
    content.style.transition = "none";
    content.style.transform = "";
    content.style.opacity = "";
    anwenden();
    return;
  }

  // Phase 2 (Herein): neuer Inhalt kommt aus der Wechsel-Richtung
  const herein = () => {
    anwenden();
    content.style.transition = "none";
    content.style.transform = dir ? `translateX(${dir * 18}px)` : "translateY(10px)";
    content.style.opacity = "0";
    void content.offsetHeight; // Style-Flush: Startwerte festschreiben, sonst springt die Transition
    requestAnimationFrame(() => {
      content.style.transition = "opacity 0.22s ease, transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)";
      content.style.transform = "";
      content.style.opacity = "1";
      setTimeout(() => { glasTabAnimBusy = false; content.style.transition = "none"; }, 320);
    });
  };

  glasTabAnimBusy = true;
  if (!hatAlt) { herein(); return; }

  // Phase 1 (Hinaus): alter Inhalt gleitet kurz weg, dann Phase 2
  content.style.transition = "opacity 0.12s ease, transform 0.12s ease";
  content.style.transform = dir ? `translateX(${dir * -16}px)` : "scale(0.988)";
  content.style.opacity = "0";
  setTimeout(herein, 120);
}

// Suchfeld-/Interaktions-Handler des frisch gerenderten Tab-Inhalts anhängen
function glasAttachTabHandlers(tab) {

  // Widget-Karussell (Kunden-Tab): gemerkte Seite wiederherstellen + Wischerkennung
  const caro = document.querySelector(".glas-caro");
  if (caro) glasKarusselInit(caro);

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

// Bottom-Sheet ANIMIERT schließen (nach unten gleiten + Abdunkelung ausblenden),
// danach den eigentlichen Schließen-Code ausführen. el = beliebiges Element im Sheet.
function glasSheetZu(el, danach) {
  const ov = el.closest ? el.closest(".glas-day-sheet-ov") : null;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!ov || reduce) { danach(); return; }
  const sheet = ov.querySelector(".glas-day-sheet");
  ov.style.transition = "opacity 0.22s ease";
  ov.style.opacity = "0";
  ov.style.pointerEvents = "none";
  if (sheet) {
    sheet.style.transition = "transform 0.26s cubic-bezier(0.32, 0.72, 0, 1)";
    sheet.style.transform = "translateY(105%)";
  }
  setTimeout(danach, 240);
}

// "Mehr" ist eine EIGENE SEITE wie jeder andere Reiter (kein Bottom-Sheet/Dropdown
// mehr - die blieben auf dem iPhone teils offen hängen). Öffnet ganz normal mit der
// Tab-Animation und schließt sich von selbst, sobald man ein Ziel antippt.
/* ==========================================================================
   LAGER-PLAN
   Bewusst geradeaus: Datum wählen -> Uhrzeit wählen -> Leute antippen -> senden.
   Für die nächste Gruppe (andere Uhrzeit) dasselbe nochmal. Keine Ausnahmen,
   keine Regeln - was dasteht, ist genau das, was verschickt wurde.
   ========================================================================== */

let glasLagerOffen = false;        // Bildschirm sichtbar?
let glasLagerPlan = [];            // geladene Einträge
let glasLagerDatum = null;         // gewähltes Datum (ISO), null = morgen
let glasLagerUhrzeit = "06:00";    // Uhrzeit der Gruppe, die gerade zusammengestellt wird
let glasLagerAuswahl = new Set();  // markierte Mitarbeiter
let glasLagerNotiz = "";
let glasLagerBusy = false;
let glasLagerFehlt = false;        // Tabelle glas_lager_plan fehlt noch (SQL nicht ausgeführt)

function glasOpenLager() {
  glasLagerOffen = true;
  glasLagerAuswahl = new Set();
  glasLagerNotiz = "";
  glasLagerEigeneZeit = false;
  loadGlasLagerPlan().then(renderGlasAdmin);
  renderGlasAdmin();
}

function glasLagerSchliessen() { glasLagerOffen = false; renderGlasAdmin(); }

// Standard-Datum: morgen (das ist der übliche Fall - abends den nächsten Tag planen)
function glasLagerDatumJetzt() {
  if (glasLagerDatum && glasLagerDatum < glasTodayIso()) glasLagerDatum = null;
  return glasLagerDatum || glasAddDaysIso(glasTodayIso(), 1);
}

async function loadGlasLagerPlan() {
  const { data, error } = await sb.from("glas_lager_plan").select("*").order("uhrzeit", { ascending: true });
  if (!error) { glasLagerPlan = data || []; glasLagerFehlt = false; return; }
  if (/glas_lager_plan/i.test(error.message || "")) glasLagerFehlt = true;
}

// Fehlt die Spalte zugang_lager noch, kommt sie bei KEINEM Mitarbeiter mit. Genau
// daran lässt sich "SQL noch nicht ausgeführt" von "noch niemand freigeschaltet"
// unterscheiden - sonst sucht man ewig, warum das Freischalten nichts bewirkt.
function glasLagerSpalteFehlt() {
  return glasMitarbeiter.length > 0 && glasMitarbeiter.every((m) => m.zugang_lager === undefined);
}

// Nur Mitarbeiter, die den Lager-Baustein freigeschaltet haben - genau die sehen
// die Nachricht auch in GEKO One.
function glasLagerMitarbeiter() {
  return glasMitarbeiter.filter((m) => m.zugang_lager === true);
}

// Wer ist an dem Tag schon in einer anderen Gruppe eingeteilt? (dann nicht doppelt)
function glasLagerSchonEingeteilt(datum, ausserId) {
  const drin = new Set();
  glasLagerPlan.filter((p) => p.datum === datum && p.id !== ausserId).forEach((p) => {
    (glasLagerIds(p) || []).forEach((id) => drin.add(id));
  });
  return drin;
}

function glasLagerIds(p) {
  try { return Array.isArray(p.mitarbeiter_ids) ? p.mitarbeiter_ids : JSON.parse(p.mitarbeiter_ids || "[]"); }
  catch (e) { return []; }
}

function glasLagerToggle(id) {
  if (glasLagerAuswahl.has(id)) glasLagerAuswahl.delete(id); else glasLagerAuswahl.add(id);
  glasLagerSyncForm();
  renderGlasAdmin();
}

// Notiz aus dem Feld lesen, damit sie beim Neuzeichnen nicht verloren geht.
// Die Uhrzeit kommt aus den Chips (State), nur die eigene Uhrzeit aus dem Feld.
function glasLagerSyncForm() {
  const u = document.getElementById("lager_uhrzeit");
  const n = document.getElementById("lager_notiz");
  if (u && u.value) glasLagerUhrzeit = u.value;
  if (n) glasLagerNotiz = n.value;
}

function glasLagerDatumSetzen(v) {
  glasLagerSyncForm();
  glasLagerDatum = v;
  glasLagerAuswahl = new Set();
  renderGlasAdmin();
}

// Die üblichen Lager-Zeiten als Schnellwahl. Angetippt = bleibt markiert.
// "Andere…" öffnet ein Zeitfeld für alles, was nicht im Raster liegt.
const GLAS_LAGER_ZEITEN = ["05:30", "05:45", "06:00", "06:15", "06:30", "06:45", "07:00"];
let glasLagerEigeneZeit = false; // Zeitfeld für eigene Uhrzeit sichtbar?

function glasLagerZeitWaehlen(z) {
  glasLagerSyncForm();
  glasLagerUhrzeit = z;
  glasLagerEigeneZeit = false;
  renderGlasAdmin();
}

function glasLagerEigeneZeitAn() {
  glasLagerSyncForm();
  glasLagerEigeneZeit = true;
  renderGlasAdmin();
  // Direkt ins Feld springen, damit man nicht zweimal tippen muss
  setTimeout(() => { const u = document.getElementById("lager_uhrzeit"); if (u && u.focus) u.focus(); }, 60);
}

function glasLagerEigeneZeitSetzen(v) {
  if (v) glasLagerUhrzeit = v;
  renderGlasAdmin();
}

// Initialen für den Farbkreis am Mitarbeiter-Chip ("Adnan Beispiel" -> "AB")
function glasLagerInitialen(name) {
  const teile = String(name || "?").trim().split(/\s+/);
  return ((teile[0] || "")[0] || "?").toUpperCase() + (teile.length > 1 ? ((teile[teile.length - 1][0] || "").toUpperCase()) : "");
}

// Kurze Tages-Beschriftung für die Datums-Chips: "Heute", "Morgen", sonst "Mo 17.08."
function glasLagerTagLabel(iso) {
  const heute = glasTodayIso();
  if (iso === heute) return "Heute";
  if (iso === glasAddDaysIso(heute, 1)) return "Morgen";
  const d = new Date(iso + "T12:00:00");
  const wt = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
  return `${wt} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}

function renderLagerPlan() {
  const datum = glasLagerDatumJetzt();
  const heute = glasTodayIso();
  const leute = glasLagerMitarbeiter();
  const eintraege = glasLagerPlan.filter((p) => p.datum === datum).sort((a, b) => (a.uhrzeit || "").localeCompare(b.uhrzeit || ""));
  const schon = glasLagerSchonEingeteilt(datum);
  const offen = leute.filter((m) => !schon.has(m.id));

  // ---- Tag: die nächsten 14 Tage als Chips (kein Datumsfeld - das lief auf dem
  // iPhone aus dem Bildschirm und die Tastatur verschob alles) ----
  const tage = [];
  for (let i = 0; i < 14; i++) tage.push(glasAddDaysIso(heute, i));
  const tageHtml = tage.map((iso) => {
    const d = new Date(iso + "T12:00:00");
    const oben = iso === heute ? "Heute" : iso === glasAddDaysIso(heute, 1) ? "Morgen" : ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
    return `
    <button class="glas-lager-tag${iso === datum ? " an" : ""}" onclick="glasLagerDatumSetzen('${iso}')">
      <span class="lt-wt">${oben}</span>
      <span class="lt-nr">${d.getDate()}</span>
      <span class="lt-punkt${glasLagerPlan.some((p) => p.datum === iso) ? " da" : ""}"></span>
    </button>`;
  }).join("");

  // ---- Uhrzeit: Schnellwahl-Chips, eigene Uhrzeit bei Bedarf ----
  const eigene = !GLAS_LAGER_ZEITEN.includes(glasLagerUhrzeit);
  const zeitenHtml = GLAS_LAGER_ZEITEN.map((z) => `
    <button class="glas-lager-zeit${!glasLagerEigeneZeit && glasLagerUhrzeit === z ? " an" : ""}" onclick="glasLagerZeitWaehlen('${z}')">${z}</button>`).join("")
    + (glasLagerEigeneZeit || eigene
      ? `<input type="time" id="lager_uhrzeit" class="glas-lager-zeitfeld" value="${escapeHtml(glasLagerUhrzeit)}" step="300" onchange="glasLagerEigeneZeitSetzen(this.value)" />`
      : `<button class="glas-lager-zeit" onclick="glasLagerEigeneZeitAn()">Andere…</button>`);

  // ---- Übersicht: was ist an dem Tag schon verschickt? ----
  const uebersicht = eintraege.length ? eintraege.map((p) => {
    const ids = glasLagerIds(p);
    const best = p.bestaetigt || {};
    const gelesen = ids.filter((id) => best[id]).length;
    // Jeder Name als kleines Etikett: GRÜN mit Haken = hat in GEKO One abgehakt,
    // grau = noch nicht gelesen. So sieht das Büro auf einen Blick, wer Bescheid weiß.
    const namenHtml = ids.map((id) => {
      const nm = glasMaName(id);
      if (!nm) return "";
      return `<span class="glas-lager-gelesen${best[id] ? " ok" : ""}">${best[id] ? "✓ " : ""}${escapeHtml(nm)}</span>`;
    }).join("");
    return `
      <div class="card" style="margin:0 0 10px; padding:13px 15px; border-left:4px solid #6b4ee6;">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:20px; font-weight:800; color:#6b4ee6; flex:none; min-width:56px;">${escapeHtml(p.uhrzeit)}</span>
          <span style="flex:1; min-width:0;">
            <span style="display:flex; flex-wrap:wrap; gap:5px;">${namenHtml || `<span class="muted">niemand</span>`}</span>
            ${p.notiz ? `<span style="display:block; font-size:12.5px; color:var(--text-secondary); margin-top:4px;">📝 ${escapeHtml(p.notiz)}</span>` : ""}
            <span style="display:block; font-size:11.5px; color:var(--text-secondary); margin-top:4px;">
              ${p.gesendet_am ? "✓ verschickt" : "noch nicht verschickt"}
              &nbsp;·&nbsp; ${ids.length && gelesen === ids.length ? `<b style="color:#12a150;">von allen gelesen ✓</b>` : `gelesen von ${gelesen}/${ids.length}`}
            </span>
          </span>
          <button class="btn btn-sm" style="color:var(--danger); flex:none;" onclick="glasLagerLoeschen('${p.id}')">✕</button>
        </div>
      </div>`;
  }).join("") : "";

  // ---- Leute-Auswahl ----
  const auswahlHtml = offen.length ? offen.map((m) => {
    const an = glasLagerAuswahl.has(m.id);
    return `
      <button class="glas-lager-chip${an ? " an" : ""}" onclick="glasLagerToggle('${m.id}')">
        <span class="glas-lager-avatar" style="background:${glasMaFarbe(m.id)};">${an ? "✓" : glasLagerInitialen(m.name)}</span>
        ${escapeHtml(m.name)}
      </button>`;
  }).join("") : `<p class="muted" style="margin:6px 2px;">Alle freigeschalteten Mitarbeiter sind für diesen Tag schon eingeteilt.</p>`;

  // Ohne die SQL-Datei läuft nichts: Freischalten wird nicht gespeichert und der
  // Mitarbeiter sieht nie etwas. Das gehört deutlich sichtbar hierher, nicht in
  // einen Hinweis, der nach drei Sekunden weg ist.
  const fehlt = glasLagerFehlt || glasLagerSpalteFehlt();
  const fehltHtml = fehlt ? `
    <div class="card" style="margin:0 0 14px; border-left:4px solid var(--danger);">
      <p style="margin:0; font-weight:700; font-size:14px;">⚠️ Der Lager-Plan ist in der Datenbank noch nicht angelegt.</p>
      <p class="muted" style="margin:6px 0 0; font-size:12.5px;">Solange das fehlt, wird das Freischalten <b>nicht gespeichert</b> und die Mitarbeiter sehen nichts.
      Bitte <code>supabase_add_lager.sql</code> in Supabase ausführen (SQL Editor &rarr; einfügen &rarr; Run) und die Seite neu laden.</p>
    </div>` : "";

  const n = glasLagerAuswahl.size;
  return `
    ${glasLagerApp ? "" : `<button class="btn btn-sm" style="margin:4px 0 14px;" onclick="glasLagerSchliessen()">&larr; Zurück</button>`}
    <h2 style="margin:${glasLagerApp ? "10px" : "0"} 0 4px;">📦 Lager-Plan</h2>
    <p class="muted" style="margin:0 0 14px;">Uhrzeit antippen, Leute antippen, senden. Für die nächste Uhrzeit einfach nochmal.</p>
    ${fehltHtml}

    <div class="glas-lager-tage">${tageHtml}</div>

    ${uebersicht ? `<p class="glas-section-title" style="margin:18px 0 8px;">Eingeteilt · ${glasLagerTagLabel(datum)}</p>${uebersicht}` : ""}

    <p class="glas-section-title" style="margin:18px 0 8px;">Uhrzeit</p>
    <div class="glas-lager-zeiten">${zeitenHtml}</div>

    <p class="glas-section-title" style="margin:18px 0 8px;">Wer soll um ${escapeHtml(glasLagerUhrzeit)} Uhr da sein?</p>
    ${leute.length ? `<div class="glas-lager-chips">${auswahlHtml}</div>` : `
      <p class="muted" style="margin:6px 2px;">${fehlt
        ? "Erst die SQL-Datei ausführen – danach lässt sich hier freischalten."
        : "Noch niemand für den Lager-Plan freigeschaltet. Das stellst du beim Mitarbeiter (Kalender → Urlaub → Mitarbeiter bearbeiten) unter „📦 Lager-Plan“ ein."}</p>`}

    <div class="field" style="margin:16px 0 0;">
      <label class="muted">Notiz (optional)</label>
      <input type="text" id="lager_notiz" class="glas-lager-notiz" value="${escapeHtml(glasLagerNotiz)}" placeholder="z.B. Material für Kreishaus mitnehmen" oninput="glasLagerSyncForm()" />
    </div>

    <button class="glas-lager-senden" onclick="glasLagerSenden()" ${glasLagerBusy || !n ? "disabled" : ""}>
      ${glasLagerBusy ? `<span class="spinner"></span> Sende…` : n ? `📲 Senden an ${n} ${n === 1 ? "Person" : "Personen"} · ${escapeHtml(glasLagerUhrzeit)} Uhr` : `Erst Leute antippen`}
    </button>

    ${renderLagerPdfBlock()}`;
}

/* ---- Einsatzplan als PDF ----
   Ein Monat auf einen Blick: entweder ALLE Mitarbeiter (der komplette Monatsplan)
   oder EIN Mitarbeiter (wann war er im Einsatz, wann nicht) - im GEKO-Briefkopf. */

let glasLagerPdfMonat = null; // {year, month} - null = aktueller Monat
let glasLagerPdfWer = "alle"; // "alle" oder Mitarbeiter-ID
let glasLagerPdfOffen = false; // Block eingeklappt, bis man ihn braucht - weniger auf einmal

function glasLagerPdfToggle() {
  glasLagerPdfOffen = !glasLagerPdfOffen;
  glasLagerSyncForm();
  renderGlasAdmin();
}

function glasLagerPdfMonatJetzt() {
  if (glasLagerPdfMonat) return glasLagerPdfMonat;
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}

function glasLagerPdfBlaettern(schritt) {
  const m = glasLagerPdfMonatJetzt();
  const d = new Date(m.year, m.month + schritt, 1);
  glasLagerPdfMonat = { year: d.getFullYear(), month: d.getMonth() };
  glasLagerSyncForm();
  renderGlasAdmin();
}

function glasLagerPdfWerSetzen(v) {
  glasLagerPdfWer = v;
  glasLagerSyncForm();
  renderGlasAdmin();
}

function renderLagerPdfBlock() {
  const m = glasLagerPdfMonatJetzt();
  const label = `${["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"][m.month]} ${m.year}`;
  // Zur Auswahl: alle Freigeschalteten PLUS alle, die im gewählten Monat im Plan
  // stehen (auch wenn ihnen der Baustein inzwischen weggenommen wurde).
  const von = `${m.year}-${String(m.month + 1).padStart(2, "0")}-01`;
  const bis = `${m.year}-${String(m.month + 1).padStart(2, "0")}-31`;
  const imMonat = new Set();
  glasLagerPlan.filter((p) => p.datum >= von && p.datum <= bis).forEach((p) => glasLagerIds(p).forEach((id) => imMonat.add(id)));
  const wer = glasMitarbeiter.filter((x) => x.zugang_lager === true || imMonat.has(x.id));
  if (glasLagerPdfWer !== "alle" && !wer.some((x) => x.id === glasLagerPdfWer)) glasLagerPdfWer = "alle";
  const anzahl = glasLagerPlan.filter((p) => p.datum >= von && p.datum <= bis).length;

  const kopf = `
    <button class="glas-lager-pdfkopf${glasLagerPdfOffen ? " auf" : ""}" onclick="glasLagerPdfToggle()">
      <span style="font-size:19px;">📄</span>
      <span style="flex:1; text-align:left;">
        <b style="display:block; font-size:14.5px;">Einsatzplan als PDF</b>
        <span style="display:block; font-size:12px; color:var(--text-secondary); margin-top:1px;">Monatsplan für alle oder einen Mitarbeiter</span>
      </span>
      <span class="pk-pfeil">›</span>
    </button>`;
  if (!glasLagerPdfOffen) return `<div style="margin-top:26px;">${kopf}</div>`;

  return `
    <div style="margin-top:26px;">${kopf}</div>
    <div class="card" style="padding:14px 15px; border-top-left-radius:0; border-top-right-radius:0; border-top:none; margin-top:0;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
        <button class="btn btn-sm" style="flex:none;" onclick="glasLagerPdfBlaettern(-1)">‹</button>
        <span style="flex:1; text-align:center; font-weight:700; font-size:14.5px;">${label}</span>
        <button class="btn btn-sm" style="flex:none;" onclick="glasLagerPdfBlaettern(1)">›</button>
      </div>
      <div class="glas-lager-chips glas-lager-pdfwer" style="margin-bottom:12px;">
        <button class="glas-lager-chip${glasLagerPdfWer === "alle" ? " an" : ""}" style="padding-left:15px;" onclick="glasLagerPdfWerSetzen('alle')">👥 Alle Mitarbeiter</button>
        ${wer.map((x) => `<button class="glas-lager-chip${glasLagerPdfWer === x.id ? " an" : ""}" onclick="glasLagerPdfWerSetzen('${x.id}')">
          <span class="glas-lager-avatar" style="background:${glasMaFarbe(x.id)};">${glasLagerInitialen(x.name)}</span>${escapeHtml(x.name)}</button>`).join("")}
      </div>
      <button class="btn btn-primary" style="width:100%; justify-content:center; padding:12px;" onclick="glasLagerPdf()">
        📄 PDF erstellen${glasLagerPdfWer === "alle" ? ` (${anzahl} ${anzahl === 1 ? "Einteilung" : "Einteilungen"})` : ""}
      </button>
      <p class="muted" style="margin:8px 0 0; font-size:12px;">Ein Mitarbeiter = kompletter Monat Tag für Tag (Einsatz, Urlaub, frei). Alle = der gesamte Monatsplan.</p>
    </div>`;
}

function glasLagerPdf() {
  if (typeof glasLagerPdfErstellen !== "function" || !(window.jspdf && window.jspdf.jsPDF)) {
    showToast("PDF-Bibliothek lädt noch – kurz warten"); return;
  }
  const m = glasLagerPdfMonatJetzt();
  const werId = glasLagerPdfWer === "alle" ? null : glasLagerPdfWer;
  try {
    glasLagerPdfErstellen(m, werId);
    showToast("📄 Einsatzplan erstellt");
  } catch (e) {
    showToast("PDF-Fehler: " + (e && e.message || e));
  }
}

async function glasLagerSenden() {
  if (glasLagerBusy || !glasLagerAuswahl.size) return;
  glasLagerSyncForm();
  const datum = glasLagerDatumJetzt();
  const ids = [...glasLagerAuswahl];
  glasLagerBusy = true; renderGlasAdmin();
  try {
    const zeile = {
      id: genCode(), datum, uhrzeit: glasLagerUhrzeit || "06:00",
      mitarbeiter_ids: ids, notiz: glasLagerNotiz || "",
      gesendet_am: new Date().toISOString(),
    };
    const { error } = await sb.from("glas_lager_plan").insert(zeile);
    if (error) {
      showToast(/glas_lager_plan/i.test(error.message || "")
        ? "Bitte supabase_add_lager.sql in Supabase ausführen"
        : "Fehler: " + error.message);
      return;
    }
    // Benachrichtigung gezielt an die eingeteilten Mitarbeiter
    const an = !glasEinstellungen || glasEinstellungen.push_lager !== false;
    if (an) {
      const datumTxt = formatGlasDate(datum);
      ids.forEach((id) => {
        try {
          sb.functions.invoke("send-push", { body: {
            role: "geko_one",
            title: `📦 Lager: ${zeile.uhrzeit} Uhr`,
            body: `${datumTxt} · bitte um ${zeile.uhrzeit} im Lager sein${zeile.notiz ? " · " + zeile.notiz : ""}`,
            url: "/meine.html",
            mitarbeiter_id: id,
          } }).catch(() => {});
        } catch (e) {}
      });
    }
    glasLagerAuswahl = new Set();
    glasLagerNotiz = "";
    await loadGlasLagerPlan();
    showToast(`Verschickt an ${ids.length} ${ids.length === 1 ? "Person" : "Personen"} ✓`);
  } finally {
    glasLagerBusy = false;
    renderGlasAdmin();
  }
}

async function glasLagerLoeschen(id) {
  const p = glasLagerPlan.find((x) => x.id === id);
  if (!p) return;
  if (!confirm(`Einteilung um ${p.uhrzeit} Uhr wirklich entfernen?\n\nDie Mitarbeiter sehen den Eintrag dann nicht mehr.`)) return;
  const { error } = await sb.from("glas_lager_plan").delete().eq("id", id);
  if (error) { showToast("Fehler: " + error.message); return; }
  await loadGlasLagerPlan();
  renderGlasAdmin();
  showToast("Entfernt");
}

function renderMehrTab() {
  const item = (icon, label, sub, onclick) => `
    <button class="glas-menu-item" style="padding:16px;" onclick="${onclick}">
      <span style="display:flex; align-items:center; gap:13px; min-width:0;">
        <span style="font-size:22px;">${icon}</span>
        <span style="min-width:0;">
          <span style="display:block; font-size:15px; font-weight:600;">${label}</span>
          <span style="display:block; font-size:12px; color:var(--text-secondary); margin-top:2px;">${sub}</span>
        </span>
      </span>
      <span style="color:var(--text-secondary); font-size:18px; flex-shrink:0;">›</span>
    </button>`;
  return `
    <h2 style="margin:2px 0 12px;">Mehr</h2>
    <div class="card" style="padding:0; overflow:hidden;">
      ${item("📦", "Lager-Plan", "Wer muss morgens wann im Lager sein – mit Benachrichtigung", "glasOpenLager()")}
      ${item("📅", "Jahresvorschau", "Anstehende Reinigungen pro Monat – erledigt, geplant, offen", "glasOpenJahr()")}
      ${item("📊", "Statistiken", "Reinigungen, Jahres-QM und Kunden-Auswertung", "glasOpenStatistik()")}
      ${item("👥", "Mitarbeiter & Zugänge", "Benutzer & Passwörter anlegen, App-Zugang sperren/entsperren", "goGlasMaVerwaltung()")}
      ${item("⚙️", "Weitere Einstellungen", "Urlaub & Benachrichtigungen", "goGlasTab('einstellungen')")}
    </div>`;
}

// Direkt zur Mitarbeiter-Verwaltung (Login/Passwort/Sperren). goGlasTab setzt die
// Flags zurück, darum ERST wechseln, DANN die Verwaltung öffnen.
function goGlasMaVerwaltung() {
  goGlasTab("kalender");
  glasKalenderAnsicht = "urlaub";
  glasUrlaubVerwaltung = true;
  renderGlasAdmin();
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
  const naechsteTermine = glasTermine
    .filter((t) => t.datum && t.datum > today)
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .slice(0, 3);

  // Farbige Status-Kachel. Die Zahl steht sofort da (kein Hochzählen mehr - das
  // flackerte bei jedem Auf-/Zuklappen der Startseiten-Bereiche neu).
  const tile = (cls, icon, num, label, onclick) => `
    <div class="glas-home-tile ${cls}" onclick="${onclick}">
      <span class="ght-ic">${icon}</span>
      <span class="ght-num">${num}</span>
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
    // Dietrich-Tour: dezent an der Karte zeigen, ob die LFD-Nr(n). schon dran sind.
    // ("lfd_nr" in s: vor der SQL-Migration gibt es die Spalte nicht -> nichts zeigen.)
    const lfdFehlt = t.template === "sub"
      ? stops.filter((s) => "lfd_nr" in s && !(s.lfd_nr || "").trim()).length
      : 0;
    return `
      <div class="glas-tour-card" onclick="glasNavigate({type:'tabs', tab:'touren'}); openGlasTourDetail('${t.id}');">
        <div class="gtc-row">
          ${leading}
          <div class="gtc-grow">
            <p class="gtc-name">${t.name ? escapeHtml(t.name) : (t.frei ? "Einzelschein" : "Tour")}</p>
            <p class="gtc-meta">${formatGlasDateRange(t.datum, t.datum_bis)}${total ? ` · ${done}/${total} erledigt` : ""}${lfdFehlt ? ` · <span style="color:var(--warning-text); font-weight:700;">🔢 ${lfdFehlt === total ? "LFD-Nr. fehlt" : lfdFehlt + "× LFD-Nr. fehlt"}</span>` : ""}</p>
          </div>
          ${pill}
        </div>
        ${t.notiz ? `<div class="gtc-notiz">📝 ${escapeHtml(t.notiz)}</div>` : ""}
      </div>`;
  };

  const terminCard = (t) => {
    const c = GLAS_TERMIN_FARBEN[t.farbe] || GLAS_TERMIN_FARBEN.tuerkis;
    // Datum zeigen, sobald der Termin nicht (nur) heute ist - bei "Als Nächstes" wichtig
    const meta = t.datum_bis && t.datum_bis !== t.datum
      ? formatGlasDateRange(t.datum, t.datum_bis)
      : (t.datum !== today ? formatGlasDate(t.datum) : "");
    return `
      <div class="glas-tour-card" onclick="goGlasTab('kalender'); openGlasTermin('${t.id}');">
        <div class="gtc-row">
          <div class="gtc-ic" style="background:${c.dot}22; color:${c.dot};">📌</div>
          <div class="gtc-grow">
            <p class="gtc-name">${escapeHtml(t.titel)}</p>
            ${meta ? `<p class="gtc-meta">${meta}</p>` : ""}
          </div>
          <span class="gtc-pill p-plan">Termin</span>
        </div>
      </div>`;
  };

  // Einklappbarer Startseiten-Bereich mit Zähler im Titel. Der Inhalt liegt IMMER im
  // DOM und wird nur per CSS-Klasse ein-/ausgeblendet - so klappt das Auf-/Zuklappen
  // ohne Neuaufbau der ganzen Startseite (kein Flackern).
  const sektion = (key, titel, count, inhalt, leerText) => `
    <div class="glas-home-sec${glasHomeOffen[key] ? " open" : ""}" data-sec="${key}">
      <div class="glas-home-sec-head" onclick="glasToggleHomeSektion('${key}')">
        <span>${titel} <span class="muted" style="font-weight:600;">(${count})</span></span>
        <span class="chev">${glasHomeOffen[key] ? "▲" : "▼"}</span>
      </div>
      <div class="glas-home-sec-body">${count ? inhalt : `<p class="glas-home-empty">${leerText}</p>`}</div>
    </div>`;

  return `
    <div class="glas-dash">
      <div class="glas-dash-hello">
        <div>
          <p class="glas-dash-hi">Hallo GEKO Clean <span class="glas-welcome-heart">❤️</span></p>
          <p class="muted" style="margin:2px 0 0;">${glasHeuteLangDatum()}</p>
        </div>
      </div>

      ${renderUrlaubBanner()}

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

      <button class="glas-jahr-card" onclick="glasOpenJahr()">
        <span class="gjc-ic">📅</span>
        <span class="gjc-txt"><span class="gjc-t">Jahresvorschau</span><span class="gjc-s">Fällige Objekte pro Monat · erledigt, geplant, offen</span></span>
        <span class="gjc-arr">›</span>
      </button>

      ${sektion("heuteTouren", "🚐 Heute · Touren", heuteTouren.length, heuteTouren.map(tourCard).join(""), "Heute keine Touren.")}
      ${sektion("heuteTermine", "📌 Heute · Termine", heuteTermine.length, heuteTermine.map(terminCard).join(""), "Heute keine Termine.")}
      ${sektion("naechsteTouren", "🚐 Als Nächstes · Touren", naechsteTouren.length, naechsteTouren.map(tourCard).join(""), "Keine kommenden Touren geplant.")}
      ${sektion("naechsteTermine", "📌 Als Nächstes · Termine", naechsteTermine.length, naechsteTermine.map(terminCard).join(""), "Keine kommenden Termine.")}
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

// Standardmäßig sind die beiden Heute-Bereiche aufgeklappt, "Als Nächstes" eingeklappt
let glasHomeOffen = { heuteTouren: true, heuteTermine: true, naechsteTouren: false, naechsteTermine: false };
function glasToggleHomeSektion(key) {
  glasHomeOffen[key] = !glasHomeOffen[key];
  // Nur den einen Bereich umschalten - kein Neuaufbau der Startseite (sonst flackert alles).
  const sec = document.querySelector(`.glas-home-sec[data-sec="${key}"]`);
  if (!sec) { glasUpdateTabContent(); return; }
  sec.classList.toggle("open", glasHomeOffen[key]);
  const chev = sec.querySelector(".chev");
  if (chev) chev.textContent = glasHomeOffen[key] ? "▲" : "▼";
}

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

// Firma-Filter der Kundenliste: "alle" | "geko" | "sub" (Dietrich)
let glasKundenFirmaFilter = "alle";

// qm-Wert einer Position als Zahl ("144,50" -> 144.5); Stunden-Positionen zählen nicht
function glasQmZahl(v) { return parseFloat(String(v || "").replace(",", ".")) || 0; }
function glasObjektQm(o) {
  let sum = 0;
  glasGetObjektPositionen(o.id).forEach((p) => { if (!glasIstStundenPos(p)) sum += glasQmZahl(p.qm); });
  return sum;
}

// Reinigungen pro Jahr laut Intervall: rollierend = 52/X Wochen, feste Monate = Anzahl
// der Monate in der Liste. Ohne Intervall zählt die Position nicht (0 Reinigungen).
function glasPosReinigungenProJahr(p) {
  if (p.intervall_typ === "rollierend") {
    const wochen = parseInt(p.intervall_wochen, 10);
    return wochen > 0 ? 52 / wochen : 0;
  }
  if (p.intervall_typ === "feste_monate") {
    return String(p.feste_monate || "").split(",").map((m) => parseInt(m.trim(), 10)).filter((m) => m >= 1 && m <= 12).length;
  }
  return 0;
}

// Jahres-QM eines Objekts: Fläche × Reinigungen pro Jahr, über alle Positionen summiert.
// 500 qm alle 2 Monate (6 feste Monate) = 3.000 qm/Jahr.
function glasObjektJahresQm(o) {
  let sum = 0;
  glasGetObjektPositionen(o.id).forEach((p) => { if (!glasIstStundenPos(p)) sum += glasQmZahl(p.qm) * glasPosReinigungenProJahr(p); });
  return sum;
}

// Monate seit einem ISO-Datum (für "am längsten nicht gereinigt")
function glasMonateSeit(iso) {
  const d = new Date(iso + "T00:00:00"), n = new Date();
  return (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth());
}

// Widget-Karussell (Kunden-Tab): bewusst OHNE nativen Scroll-Container umgesetzt -
// scroll-snap brach auf iOS die Wischgesten immer wieder ab. Die Seiten liegen auf
// einer Schiene, die per transform verschoben wird (gleiche Mechanik wie die
// Tab-Übergänge). Gesteuert über Punkte/Pfeile-Tippen und eigene Wisch-Erkennung.
let glasCaroIdx = 0; // gemerkte Seite, überlebt Re-Renders des Kunden-Tabs

function glasKarusselGo(i) {
  const caro = document.querySelector(".glas-caro");
  const track = caro && caro.querySelector(".glas-caro-track");
  if (!track) return;
  const n = track.children.length;
  glasCaroIdx = Math.max(0, Math.min(n - 1, i));
  track.style.transform = glasCaroIdx ? `translateX(-${glasCaroIdx * 100}%)` : "";
  const wrap = caro.parentElement;
  wrap.querySelectorAll(".glas-caro-dots .cd").forEach((d, j) => d.classList.toggle("on", j === glasCaroIdx));
  wrap.querySelectorAll(".glas-caro-arrow.left, .glas-caro-step.left").forEach((a) => a.classList.toggle("off", glasCaroIdx <= 0));
  wrap.querySelectorAll(".glas-caro-arrow.right, .glas-caro-step.right").forEach((a) => a.classList.toggle("off", glasCaroIdx >= n - 1));
  // Container-Höhe folgt der aktiven Seite (sonst klafft unter kurzen Seiten die
  // Lücke bis zur höchsten Seite)
  const seite = track.children[glasCaroIdx];
  if (seite) caro.style.height = seite.offsetHeight + "px";
}

function glasKarusselStep(d) { glasKarusselGo(glasCaroIdx + d); }

// Nach jedem (Re-)Aufbau: gemerkte Seite OHNE Animation wiederherstellen und die
// Wisch-Erkennung anhängen (Fingerbewegung >40px, klar horizontal = eine Seite).
function glasKarusselInit(caro) {
  const track = caro.querySelector(".glas-caro-track");
  if (!track) return;
  track.style.transition = "none";
  caro.style.transition = "none";
  glasKarusselGo(glasCaroIdx);
  void caro.offsetHeight; // Style-Flush, damit die Wiederherstellung nicht animiert
  track.style.transition = "";
  caro.style.transition = "";
  if (caro.__swipe) return;
  caro.__swipe = true;
  let sx = null, sy = null;
  caro.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  caro.addEventListener("touchend", (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    sx = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) glasKarusselStep(dx < 0 ? 1 : -1);
  }, { passive: true });
}

// Wischbares Widget-Karussell über der Kundenliste (4 Seiten)
function renderKundenWidgets(kunden, objekte) {
  const objUeberf = objekte.filter((o) => glasObjektStatus(o.id) === "ueberfaellig").length;
  const objFaellig = objekte.filter((o) => glasObjektStatus(o.id) === "faellig").length;

  // Flächen: alles in JAHRES-QM (Fläche × Reinigungen pro Jahr laut Intervall) -
  // Positionen ohne Intervall zählen nicht, dafür gibt es die eigene Kachel.
  const kundeQm = new Map();
  let gesamtQm = 0;
  kunden.forEach((k) => {
    let s = 0;
    objekte.forEach((o) => { if (o.kunde_id === k.id) s += glasObjektJahresQm(o); });
    kundeQm.set(k.id, s);
    gesamtQm += s;
  });
  const objMitJahresQm = objekte.filter((o) => glasObjektJahresQm(o) > 0).length;
  const avgQm = objMitJahresQm ? gesamtQm / objMitJahresQm : 0;
  const top5 = [...kunden].sort((a, b) => (kundeQm.get(b.id) || 0) - (kundeQm.get(a.id) || 0)).slice(0, 5).filter((k) => (kundeQm.get(k.id) || 0) > 0);
  const bester = top5[0] || null;
  const ohneIntervall = objekte.filter((o) => glasGetObjektPositionen(o.id).every((p) => !p.intervall_typ)).length;
  const ohneQm = objekte.filter((o) => glasObjektQm(o) === 0).length;
  const topMax = bester ? kundeQm.get(bester.id) : 1;

  // Am längsten nicht gereinigt: pro Kunde die JÜNGSTE letzte_reinigung über alle
  // Positionen; ohne jede Reinigung = "noch nie" (steht ganz oben)
  const alt = kunden.map((k) => {
    let letzte = null;
    objekte.forEach((o) => {
      if (o.kunde_id !== k.id) return;
      glasGetObjektPositionen(o.id).forEach((p) => { if (p.letzte_reinigung && (!letzte || p.letzte_reinigung > letzte)) letzte = p.letzte_reinigung; });
    });
    return { k, letzte };
  }).filter((x) => objekte.some((o) => o.kunde_id === x.k.id))
    .sort((a, b) => (a.letzte || "0000").localeCompare(b.letzte || "0000"))
    .slice(0, 5);
  const altLabel = (x) => !x.letzte ? "noch nie"
    : (() => { const m = glasMonateSeit(x.letzte); return m <= 0 ? "diesen Monat" : `vor ${m} Mon.`; })();

  const tile = (cls, n, l, onclick) => `<div class="glas-home-tile ${cls}" ${onclick ? `style="cursor:pointer;" onclick="${onclick}"` : `style="cursor:default;"`}><span class="ght-num">${n}</span><span class="ght-lbl">${l}</span></div>`;
  const rank = (pos, name, barPct, wert, onclick, warnv) => `
    <div class="glas-rankrow" ${onclick ? `style="cursor:pointer;" onclick="${onclick}"` : ""}>
      <span class="rp">${pos}.</span>
      <span class="rn">${escapeHtml(name)}</span>
      ${barPct !== null ? `<span class="rb"><i style="width:${barPct}%"></i></span>` : ""}
      <span class="rv${warnv ? " warnv" : ""}">${wert}</span>
    </div>`;

  return `
    <div class="glas-caro-wrap">
      <button class="glas-caro-arrow left off" onclick="glasKarusselStep(-1)" aria-label="Vorherige Infos">‹</button>
      <button class="glas-caro-arrow right" onclick="glasKarusselStep(1)" aria-label="Weitere Infos">›</button>
      <div class="glas-caro"><div class="glas-caro-track">
        <div class="glas-cpage">
          <div class="glas-home-tiles" style="margin-bottom:0;">
            ${tile("t-info", kunden.length, "Kunden")}
            ${tile("t-neu", objekte.length, "Objekte")}
            ${tile("t-crit", objUeberf, "Überfällig")}
            ${tile("t-warn", objFaellig, "Fällig")}
          </div>
        </div>
        <div class="glas-cpage">
          <div class="glas-home-tiles" style="margin-bottom:0;">
            ${tile("t-info t-fit", glasStatQmText(gesamtQm) + " m²", "Jahres-QM gesamt")}
            ${tile("t-neu t-fit", glasStatQmText(avgQm) + " m²", "Ø Jahres-QM pro Objekt")}
            ${tile("t-warn", ohneIntervall, "Objekte ohne Intervall", "goGlasObjektListe('ohne_intervall')")}
            ${tile("t-crit", ohneQm, "Objekte ohne QM-Angabe", "goGlasObjektListe('ohne_qm')")}
          </div>
        </div>
        <div class="glas-cpage">
          <div class="glas-rankcard">
            <p class="rt">🏆 Top 5 Kunden nach Jahres-QM</p>
            ${top5.length ? top5.map((k, i) => rank(i + 1, k.name, Math.max(4, Math.round((kundeQm.get(k.id) / topMax) * 100)), glasStatQmText(kundeQm.get(k.id)) + " qm", `goGlasKunde('${k.id}')`)).join("") : `<p class="muted" style="margin:6px 0 2px;">Noch keine QM mit Intervall hinterlegt.</p>`}
          </div>
        </div>
        <div class="glas-cpage">
          <div class="glas-rankcard">
            <p class="rt">⏳ Am längsten nicht gereinigt</p>
            ${alt.length ? alt.map((x, i) => rank(i + 1, x.k.name, null, altLabel(x), `goGlasKunde('${x.k.id}')`, true)).join("") : `<p class="muted" style="margin:6px 0 2px;">Keine Kunden mit Objekten.</p>`}
          </div>
        </div>
      </div></div>
      <div class="glas-caro-dots">
        <button class="glas-caro-step left off" onclick="glasKarusselStep(-1)" aria-label="Vorherige Infos">‹</button>
        ${[0, 1, 2, 3].map((i) => `<span class="cd${i === 0 ? " on" : ""}" onclick="glasKarusselGo(${i})"></span>`).join("")}
        <button class="glas-caro-step right" onclick="glasKarusselStep(1)" aria-label="Weitere Infos">›</button>
      </div>
      <div class="glas-caro-hint">Wischen oder ‹ › tippen für weitere Infos</div>
    </div>`;
}

function renderKundenTab() {
  if (glasKundeEditing !== null) return renderKundeForm();

  // Eigenes Suchfeld hier bewusst entfernt - die globale Suche oben (Kunde, Objekt, Kd.-Nr.)
  // deckt das bereits vollständig ab, ein zweites Feld war redundant.
  const statusRang = { ueberfaellig: 0, faellig: 1 };
  const gefiltert = glasKunden.filter((k) => glasKundenFirmaFilter === "alle" || (k.firma || "geko") === glasKundenFirmaFilter);
  const mitStatus = gefiltert.map((k) => ({ k, status: glasKundeStatus(k.id) }));
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
        // Kd.-Nr.: fällt auf die Kd.-Nr. der Objekte zurück, wenn am Kunden selbst keine
        // hinterlegt ist (bei etlichen Dietrich-Kunden steckt sie nur am Objekt).
        const kdnrAnzeige = (k.kdnr || "").trim() || (objekte.find((o) => (o.kdnr || "").trim())?.kdnr || "").trim();
        return `
          <div class="card" style="cursor:pointer; display:flex; gap:10px; justify-content:space-between; align-items:center; ${glasStatusTint(status)}" onclick="${auswahl ? `glasAuswahlToggle('${k.id}')` : `goGlasKunde('${k.id}')`}">
            ${auswahl ? `<span class="glas-pick ${glasAuswahl.ids.has(k.id) ? "on" : ""}"></span>` : ""}
            <div style="flex:1; min-width:0;">
              <p style="margin:0; font-weight:600;">${escapeHtml(k.name)}${kdnrAnzeige ? ` <span class="muted" style="font-weight:500; font-size:12.5px;">· Kd.-Nr. ${escapeHtml(kdnrAnzeige)}</span>` : ""}${(k.firma || "geko") === "sub" ? ` <span class="badge" style="background:var(--border); color:var(--text-secondary); font-size:10px;">Dietrich</span>` : ""}</p>
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

  // Widgets über der Kundenliste: wischbares Karussell (Status · Flächen · Top 5 ·
  // Länger nicht gereinigt), rechnet immer für die gerade gewählte Firma
  const objekteGefiltert = glasObjekte.filter((o) => gefiltert.some((k) => k.id === o.kunde_id));
  const kennzahlen = gefiltert.length ? renderKundenWidgets(gefiltert, objekteGefiltert) : "";

  return `
    ${kennzahlen}
    <div style="display:flex; gap:8px; margin:16px 0 10px; align-items:center; flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="editGlasKunde(null)">+ Neuer Kunde</button>
      <button class="btn btn-sm" onclick="editGlasObjekt(null)">+ Neues Objekt</button>
      ${sortiert.length && !auswahl ? `<button class="btn btn-sm" style="margin-left:auto;" title="Mehrere auswählen" onclick="glasAuswahlStart('kunden')">☑️ Auswählen</button>` : ""}
    </div>
    <div class="glas-seg" style="margin-bottom:8px;">
      <button class="glas-seg-btn ${glasKundenFirmaFilter === "alle" ? "on" : ""}" onclick="glasKundenFirmaFilter='alle'; glasUpdateTabContent();">Alle</button>
      <button class="glas-seg-btn ${glasKundenFirmaFilter === "geko" ? "on" : ""}" onclick="glasKundenFirmaFilter='geko'; glasUpdateTabContent();">GEKO</button>
      <button class="glas-seg-btn ${glasKundenFirmaFilter === "sub" ? "on" : ""}" onclick="glasKundenFirmaFilter='sub'; glasUpdateTabContent();">Dietrich</button>
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
  if (get("k_firma") !== undefined) glasKundeEditing.firma = get("k_firma");
}

function editGlasKunde(id) {
  if (id === null) {
    glasKundeEditing = { id: null, name: "", adresse: "", kdnr: "", bereich: "glas", firma: "geko" };
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
        <label class="muted">Firma (wessen Kunde ist das?)</label>
        <select id="k_firma" style="width:auto;">
          <option value="geko" ${(k.firma || "geko") === "geko" ? "selected" : ""}>GEKO Clean (eigener Kunde)</option>
          <option value="sub" ${k.firma === "sub" ? "selected" : ""}>Dietrich (Generalauftraggeber)</option>
        </select>
      </div>
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
  const payload = { id: glasKundeEditing.id || genCode(), name, adresse: (glasKundeEditing.adresse || "").trim(), kdnr: (glasKundeEditing.kdnr || "").trim(), bereich: glasKundeEditing.bereich || "glas", firma: glasKundeEditing.firma === "sub" ? "sub" : "geko" };
  gekoCleanPayload(payload);
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
  glasKundeTermineCache[kundeId] = stops.filter((s) => s.glas_touren); // inkl. archivierter Touren
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
  // Haupt-Kd.-Nr. des Kunden; hat er keine, die erste aus seinen Objekten
  // (gleiche Regel wie in der Kundenliste, damit beide Ansichten dasselbe zeigen).
  const kdnrAnzeige = (k.kdnr || "").trim() || (objekte.find((o) => (o.kdnr || "").trim())?.kdnr || "").trim();

  return `
    <button class="btn btn-sm" style="margin:16px 0;" onclick="goGlasTab('kunden')">&larr; Alle Kunden</button>
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <p style="margin:0 0 4px; font-weight:700; font-size:19px;">${escapeHtml(k.name)}</p>
          ${kdnrAnzeige ? `<p style="margin:0 0 6px;"><span class="glas-kdnr">Kd.-Nr. ${escapeHtml(kdnrAnzeige)}</span></p>` : ""}
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
                  <p class="muted" style="margin:2px 0 0; font-size:12.5px;">${formatGlasDate(glasSignaturDatum(s))}${manuell ? " · ✔️ als unterschrieben markiert" : s.name ? ` · ✓ ${escapeHtml(s.name)}` : ""}${s.erfasst_von ? ` · 👤 ${escapeHtml(s.erfasst_von)}` : ""}${qm ? ` · ${qm} qm` : ""}${s.glas_touren?.name ? ` · ${escapeHtml(s.glas_touren.name)}` : ""}</p>
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
          <p class="muted" style="margin:2px 0 0; font-size:12.5px;">${formatGlasDate(glasSignaturDatum(s))}${manuell ? " · ✔️ als unterschrieben markiert" : s.name ? " · ✓ " + escapeHtml(s.name) : ""}${s.erfasst_von ? " · 👤 " + escapeHtml(s.erfasst_von) : ""}${s.glas_touren?.name ? " · " + escapeHtml(s.glas_touren.name) : ""}</p>
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
      positionen: glasGetObjektPositionen(id).map((p) => ({ ...p, template: p.template || "geko", pos_text: p.pos_text || "", custom: !!p.art && !glasPositionen.some((sp) => sp.name === p.art) })),
    };
  }
  glasObjektFormReturn = opts.returnTo || (glasObjektEditing.kunde_id ? { type: "kunde", id: glasObjektEditing.kunde_id } : { type: "tabs", tab: "kunden" });
  glasNavigate({ type: "objekt-form" });
}

function glasLeerePosition() {
  return {
    id: null, nr: "", art: "", qm: "", template: "geko", pos_text: "",
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
          <label class="muted">Dietrich Objekt-Nr. (optional – steht auf dem Schein neben der Haupt-Kd.-Nr. des Kunden, z.B. „1586 <b>501</b>")</label>
          <input type="text" id="o_kdnr" value="${escapeHtml(o.kdnr)}" placeholder="z.B. 501 00" />
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
  // Im Objekt-Formular ist pos.template gesetzt (geko/sub) -> nur die Positionen dieser
  // Firma anbieten. Beim Einzelschein (ohne template) werden alle gezeigt.
  const liste = pos.template ? glasPositionen.filter((p) => (p.template || "geko") === pos.template) : glasPositionen;
  const gespeichert = liste
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
        ${pos.template ? `
        <div class="field" style="margin-bottom:8px;">
          <label class="muted">Firma</label>
          <select id="pos_firma_${i}" onchange="onGlasPositionFirmaChange(${i})">
            <option value="geko" ${(pos.template || "geko") === "geko" ? "selected" : ""}>GEKO Clean</option>
            <option value="sub" ${pos.template === "sub" ? "selected" : ""}>Dietrich</option>
          </select>
        </div>` : ""}
        <div class="row" style="align-items:flex-end; margin-bottom:8px;">
          <div class="field" style="flex:2; margin-bottom:0;">
            <label class="muted">Position</label>
            <select id="pos_art_${i}" onchange="onGlasPositionArtChange(${i})">${positionenOptions(pos)}</select>
          </div>
          <div class="field" style="flex:1; margin-bottom:0;">
            <label class="muted">${glasIstStundenPos(pos) ? "Stunden" : "QM"}</label>
            <input type="text" id="pos_qm_${i}" value="${escapeHtml(pos.qm)}" placeholder="${glasIstStundenPos(pos) ? "z.B. 3" : "144,50"}" />
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
          <div class="field" style="flex:0 0 110px; margin-bottom:0;">
            <label class="muted">Einheit</label>
            <select id="pos_einheit_${i}" onchange="onGlasPositionEinheitChange(${i})">
              <option value="qm" ${glasIstStundenPos(pos) ? "" : "selected"}>QM</option>
              <option value="std" ${glasIstStundenPos(pos) ? "selected" : ""}>Stunden</option>
            </select>
          </div>
        </div>` : (pos.art && pos.nr ? `<p class="muted" style="margin:-2px 0 8px; font-size:11.5px;">Pos.-Nr. ${escapeHtml(pos.nr)}</p>` : "")}
        <div class="field" style="margin-bottom:8px;">
          <label class="muted">Positionstext (optional)</label>
          <textarea id="pos_text_${i}" rows="2" placeholder="Zusätzlicher Text zu dieser Position – erscheint im PDF direkt unter Pos. ${escapeHtml(pos.nr || "…")}">${escapeHtml(pos.pos_text || "")}</textarea>
        </div>
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
    if (!pos.einheit) pos.einheit = "qm"; // eigene Position: Standard QM, umschaltbar
  } else {
    pos.custom = false;
    pos.art = val;
    pos.nr = select.options[select.selectedIndex]?.getAttribute("data-nr") || pos.nr;
    pos.einheit = ""; // Katalog-Position: Einheit folgt wieder der Pos.-Nr.-Regel
  }
  renderGlasAdmin();
}

// Firma der Position umgestellt (GEKO <-> Dietrich): die zuvor gewählte Position gehört zur
// anderen Firma und wird zurückgesetzt, damit man aus der gefilterten Liste neu wählt.
function onGlasPositionFirmaChange(i) {
  syncObjektFormFromDom();
  const pos = glasObjektEditing.positionen[i];
  pos.template = document.getElementById(`pos_firma_${i}`).value;
  if (!pos.custom) { pos.art = ""; pos.nr = ""; }
  renderGlasAdmin();
}

function onGlasIntervallTypChange(i) {
  syncObjektFormFromDom();
  glasObjektEditing.positionen[i].intervall_typ = document.getElementById(`pos_ivtyp_${i}`).value;
  renderGlasAdmin();
}

// Einheit (QM/Stunden) einer eigenen Position umgestellt -> Label des Wert-Felds anpassen
function onGlasPositionEinheitChange(i) {
  syncObjektFormFromDom();
  renderGlasAdmin();
}

function syncPositionenFromDom() {
  if (!glasObjektEditing) return;
  glasObjektEditing.positionen = glasObjektEditing.positionen.map((pos, i) => ({
    ...pos,
    template: document.getElementById(`pos_firma_${i}`)?.value ?? pos.template,
    pos_text: document.getElementById(`pos_text_${i}`) ? document.getElementById(`pos_text_${i}`).value : pos.pos_text,
    nr: pos.custom ? (document.getElementById(`pos_custom_nr_${i}`)?.value.trim() ?? pos.nr) : pos.nr,
    art: pos.custom ? (document.getElementById(`pos_custom_art_${i}`)?.value.trim() ?? pos.art) : pos.art,
    einheit: pos.custom ? (document.getElementById(`pos_einheit_${i}`)?.value ?? pos.einheit ?? "") : (pos.einheit || ""),
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

  gekoCleanPayload(payload);
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
    template: p.template || "geko",
    pos_text: p.pos_text || "",
    nr: p.nr || "",
    art: p.art || "",
    einheit: p.einheit || "",
    qm: p.qm || "",
    intervall_typ: p.intervall_typ || "",
    intervall_wochen: p.intervall_typ === "rollierend" ? (p.intervall_wochen || null) : null,
    feste_monate: p.intervall_typ === "feste_monate" ? (p.feste_monate || "") : "",
    letzte_reinigung: p.letzte_reinigung || null,
    faelligkeit_override: p.faelligkeit_override || null,
    reihenfolge: i,
  }));
  if (posPayload.length) {
    let { error: posErr } = await sb.from("glas_objekt_positionen").upsert(posPayload);
    if (posErr && /einheit/i.test(posErr.message || "")) {
      // Spalte fehlt noch (SQL nicht ausgeführt) - ohne Einheit speichern, damit nichts verloren geht
      posPayload.forEach((p) => delete p.einheit);
      ({ error: posErr } = await sb.from("glas_objekt_positionen").upsert(posPayload));
      if (!posErr) showToast("Hinweis: Einheit (QM/Std.) noch nicht gespeichert – bitte supabase_add_einheit.sql ausführen");
    }
  }

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

// Gefilterte Objektliste (z.B. "Objekte ohne Intervall" / "ohne QM-Angabe"),
// erreichbar über die Kacheln im Kunden-Karussell. Jede Zeile führt zum Objekt.
function renderObjektListePage(filter) {
  const defs = {
    ohne_intervall: {
      icon: "🔁", titel: "Objekte ohne Intervall",
      hint: "Diese Objekte haben (noch) kein Reinigungsintervall – sie zählen daher nicht in die Jahres-QM.",
      leer: "Alle Objekte haben ein Intervall hinterlegt. 👍",
      test: (o) => glasGetObjektPositionen(o.id).every((p) => !p.intervall_typ),
    },
    ohne_qm: {
      icon: "📐", titel: "Objekte ohne QM-Angabe",
      hint: "Diesen Objekten fehlt die Quadratmeter-Angabe – ohne QM zählen sie nicht in die Flächen-Statistik.",
      leer: "Alle Objekte haben eine QM-Angabe. 👍",
      test: (o) => glasObjektQm(o) === 0,
    },
  };
  const def = defs[filter] || defs.ohne_intervall;
  const kundeName = (o) => o.kunde_name || glasKunden.find((k) => k.id === o.kunde_id)?.name || "Ohne Kunde";
  const objekte = glasObjekte
    .filter((o) => glasKundenFirmaFilter === "alle" || (glasKunden.find((k) => k.id === o.kunde_id)?.firma || "geko") === glasKundenFirmaFilter)
    .filter(def.test)
    .sort((a, b) => kundeName(a).localeCompare(kundeName(b), "de") || (a.name || "").localeCompare(b.name || "", "de"));

  const rows = objekte.length
    ? objekte.map((o) => `
      <div class="card" style="cursor:pointer; display:flex; gap:10px; justify-content:space-between; align-items:center;" onclick="goGlasObjekt('${o.id}')">
        <div style="flex:1; min-width:0;">
          <p style="margin:0; font-weight:600;">${escapeHtml(o.name)}</p>
          <p class="muted" style="margin:2px 0 0; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(kundeName(o))}${o.adresse ? " · " + escapeHtml((o.adresse || "").split("\n")[0]) : ""}</p>
        </div>
        <span style="font-size:18px; color:var(--text-secondary);">›</span>
      </div>`).join("")
    : `<p class="muted">${def.leer}</p>`;

  return `
    <button class="btn btn-sm" style="margin:16px 0;" onclick="goGlasTab('kunden')">&larr; Kunden</button>
    <h2 style="margin:0 0 2px;">${def.icon} ${def.titel}</h2>
    <p class="muted" style="margin:0 0 6px;">${objekte.length} Objekt${objekte.length === 1 ? "" : "e"}</p>
    <p class="muted" style="margin:0 0 14px; font-size:12.5px;">${def.hint}</p>
    ${rows}`;
}

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
      <p class="muted" style="margin:6px 0 0;">Haupt-Kd.-Nr.: ${escapeHtml(glasKunden.find((k) => k.id === o.kunde_id)?.kdnr || "–")}${o.kdnr ? ` · Dietrich Objekt-Nr.: ${escapeHtml(o.kdnr)}` : ""}</p>
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
                  : `${formatGlasDate(glasSignaturDatum(s))} · ${escapeHtml(s.name || "")}${s.erfasst_von ? " · 👤 " + escapeHtml(s.erfasst_von) : ""}`;
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
  const positionen = glasGetObjektPositionen(objektId).map((p) => ({ nr: p.nr, art: p.art, einheit: p.einheit || "", qm: p.qm, pos_text: p.pos_text || "" }));
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
  glasTourLfd = new Map();
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
      <input type="checkbox" style="width:auto;" ${e.push_urlaub !== false ? "checked" : ""} onchange="glasSavePushSchalter('push_urlaub', this.checked)" />
      <span style="font-size:13.5px;">🏖️ Neue Urlaubsanträge der Mitarbeiter &middot; <span class="muted">Glasreinigung-App</span></span>
    </label>
    <label style="display:flex; align-items:center; gap:10px; padding:9px 0; border-top:1px solid var(--border); cursor:pointer;">
      <input type="checkbox" style="width:auto;" ${e.push_lager !== false ? "checked" : ""} onchange="glasSavePushSchalter('push_lager', this.checked)" />
      <span style="font-size:13.5px;">📦 Lager-Plan an die Mitarbeiter schicken &middot; <span class="muted">GEKO One</span></span>
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
  const posCard = (p) => `
    <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
      ${glasPositionEditingId === p.id ? `
        <div style="display:flex; gap:8px; flex:1; margin-right:10px; flex-wrap:wrap;">
          <input type="text" id="pos_edit_nr_${p.id}" value="${escapeHtml(p.nr || "")}" placeholder="Nr." style="flex:0 0 55px;" />
          <input type="text" id="pos_edit_${p.id}" value="${escapeHtml(p.name)}" style="flex:1; min-width:120px;" />
          <select id="pos_edit_template_${p.id}" style="flex:0 0 auto;">
            <option value="geko" ${(p.template || "geko") === "geko" ? "selected" : ""}>GEKO Clean</option>
            <option value="sub" ${p.template === "sub" ? "selected" : ""}>Dietrich</option>
          </select>
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
    </div>`;

  const gruppe = (tpl) => {
    const items = glasPositionen.filter((p) => (p.template || "geko") === tpl);
    return `
      <p class="glas-section-title" style="margin-top:18px;">${glasFirmaLabel(tpl)} <span class="muted" style="font-weight:400;">· ${items.length}</span></p>
      ${items.length ? items.map(posCard).join("") : `<p class="muted" style="margin:0 0 4px;">Noch keine ${glasFirmaLabel(tpl)}-Positionen.</p>`}`;
  };

  return `
    <p class="muted" style="margin:0 0 10px; font-weight:600;">Neue Position</p>
    <p class="muted" style="margin:0 0 10px;">Leistungsarten mit fester Standard-Positionsnummer (z.B. Pos. 10 Glas- und Rahmenreinigung). Jede Position gehört zu <b>GEKO Clean</b> oder <b>Dietrich</b> – beim Objekt wählt man erst die Firma, dann die Position.</p>
    <div style="display:flex; gap:8px; margin-bottom:8px;">
      <input type="text" id="pos_new_nr" placeholder="Nr." style="flex:0 0 60px;" value="" />
      <input type="text" id="pos_new_name" placeholder="z.B. Grundreinigung" />
    </div>
    <div style="display:flex; gap:8px; margin-bottom:14px; align-items:center;">
      <select id="pos_new_template" style="flex:1;">
        <option value="geko">GEKO Clean</option>
        <option value="sub">Dietrich</option>
      </select>
      <button class="btn btn-primary" style="flex:0 0 auto;" onclick="addGlasPosition()">+ Hinzufügen</button>
    </div>
    ${gruppe("geko")}
    ${gruppe("sub")}
  `;
}

async function addGlasPosition() {
  const nameInput = document.getElementById("pos_new_name");
  const nrInput = document.getElementById("pos_new_nr");
  const name = nameInput.value.trim();
  const nr = nrInput.value.trim();
  const template = document.getElementById("pos_new_template")?.value || "geko";
  if (!name) { showToast("Bitte einen Namen eintragen"); return; }
  const { error } = await sb.from("glas_positionen").insert({ id: genCode(), name, nr, template });
  if (error) { showToast("Fehler: " + error.message + " (SQL supabase_add_positionen_firma.sql schon ausgeführt?)"); return; }
  nameInput.value = "";
  nrInput.value = "";
  await loadGlasPositionen();
  renderGlasAdmin();
}

async function saveGlasPosition(id) {
  const name = document.getElementById(`pos_edit_${id}`).value.trim();
  const nr = document.getElementById(`pos_edit_nr_${id}`).value.trim();
  const template = document.getElementById(`pos_edit_template_${id}`)?.value || "geko";
  if (!name) { showToast("Bitte einen Namen eintragen"); return; }
  const { error } = await sb.from("glas_positionen").update({ name, nr, template }).eq("id", id);
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
  // Sichtbarkeit in der Mitarbeiter-Ansicht: manuell versteckt (ma_versteckt) ODER
  // automatisch ausgeblendet, weil die Tour fertig ist und ihr Datum vorbei ist
  // (die MA-App blendet alte fertige Touren am Folgetag aus).
  const alteFertig = allDone && (t.datum_bis || t.datum) && (t.datum_bis || t.datum) < glasTodayIso();
  const maSichtbar = !t.ma_versteckt && !alteFertig;
  const maLabel = maSichtbar
    ? `<span style="color:var(--text-secondary);">👁️ bei MA</span>`
    : `<span style="color:var(--text-secondary);">🙈 nicht bei MA</span>`;
  // Dietrich-Tour mit Stopps ohne LFD-Nr.: dicker Hinweis direkt auf der Karte.
  // ("lfd_nr" in s: solange die SQL-Migration fehlt, gibt es die Spalte nicht - dann
  // keinen falschen Alarm zeigen.)
  const lfdFehlt = t.template === "sub"
    ? (t.glas_stopps || []).filter((s) => "lfd_nr" in s && !(s.lfd_nr || "").trim()).length
    : 0;
  return `
    <div class="glas-tour-card" onclick="${auswahl ? `glasAuswahlToggle('${t.id}')` : `openGlasTourDetail('${t.id}')`}">
      <div class="gtc-row">
        ${leading}
        <div class="gtc-grow">
          <p class="gtc-name">${t.name ? escapeHtml(t.name) : formatGlasDateRange(t.datum, t.datum_bis)}</p>
          <p class="gtc-meta">${formatGlasDateRange(t.datum, t.datum_bis)}${total ? ` · ${done}/${total} erledigt` : ""}${z.nichtGeschafft ? ` · ${z.nichtGeschafft} nicht geschafft` : ""}${t.frei ? " · Einzelschein" : ""} · ${maLabel}</p>
        </div>
        ${pill}
      </div>
      ${lfdFehlt ? `<div class="gtc-notiz" style="color:var(--danger); font-weight:800;">⚠️ ${lfdFehlt === 1 ? "1 Schein ohne LFD-Nr." : lfdFehlt + " Scheine ohne LFD-Nr."} – bitte nachtragen!</div>` : ""}
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
  glasTourLfd = new Map();
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
    </div>${p.pos_text && p.pos_text.trim() ? `<div class="muted" style="margin:-2px 0 4px 30px; font-size:12px; white-space:pre-line;">${escapeHtml(p.pos_text.trim())}</div>` : ""}`).join("")}</div>`;
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
            ${t.template === "sub" ? renderStopLfdZeile(s) : ""}
            ${s.hinweise ? `<div class="glas-hinweis-box" style="margin-top:8px;"><span class="glas-hinweis-icon">⚠️</span><div><p class="glas-hinweis-text" style="margin:0;">${escapeHtml(s.hinweise)}</p></div></div>` : ""}
            ${s.notiz ? `<div class="glas-notiz-box" style="margin-top:8px;">📝 ${escapeHtml(s.notiz)}</div>` : ""}
            ${isDone ? `
              ${s.zusatz ? `<div class="glas-notiz-box" style="margin-top:8px; white-space:pre-line;">➕ Zusätzlich gemacht: ${escapeHtml(s.zusatz)}</div>` : ""}
              <p class="muted" style="margin:8px 0 0; font-size:12px;">${(!s.unterschrift && s.manuell_erledigt_am)
                ? `✔️ Als unterschrieben markiert am ${formatGlasDate(glasDatumVonTimestamp(s.manuell_erledigt_am))}${glasUhrzeitVonTimestamp(s.manuell_erledigt_am) ? ` um ${glasUhrzeitVonTimestamp(s.manuell_erledigt_am)} Uhr` : ""} (ohne Unterschrift)`
                : `Unterschrieben von ${escapeHtml(s.name || "")} am ${formatGlasDate(glasSignaturDatum(s))}${glasUhrzeitVonTimestamp(s.signed_at) ? ` um ${glasUhrzeitVonTimestamp(s.signed_at)} Uhr` : ""}`}</p>
              ${s.erfasst_von ? `<p style="margin:4px 0 0; font-size:12.5px; font-weight:600; color:var(--text);">👤 Vor Ort: ${escapeHtml(s.erfasst_von)}</p>` : ""}
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
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
      <button class="btn btn-sm" onclick="toggleGlasTourKalender('${t.id}')">${t.kalender_versteckt ? "🗓️ Wieder im Kalender zeigen" : "🗓️ Aus Kalender ausblenden"}</button>
      ${t.archiviert_am
        ? `<button class="btn btn-sm" onclick="restoreGlasTour('${t.id}')">↩️ Aus dem Archiv wiederherstellen</button>`
        : `<button class="btn btn-sm" style="color:var(--danger);" onclick="deleteGlasTour('${t.id}')">Tour löschen (wandert ins Archiv)</button>`
      }
    </div>
    ${t.kalender_versteckt ? `<p class="muted" style="margin:8px 0 0; font-size:12px;">🗓️ Aus dem Kalender ausgeblendet – Touren-Liste &amp; Statistik bleiben unberührt.</p>` : ""}
    ${glasMergePickerFor === t.id ? renderGlasMergePicker(t) : ""}
  `;
}

// Dietrich LFD-Nr. am Stopp im Tour-Detail: vorhandene Nummer fett anzeigen (mit
// "ändern"), fehlende mit dickem rotem Hinweis + Feld zum Nachtragen.
let glasLfdEditStopId = null;
function renderStopLfdZeile(s) {
  const lfd = (s.lfd_nr || "").trim();
  if (lfd && glasLfdEditStopId !== s.id) {
    return `<p style="margin:8px 0 0; font-size:13px;">🔢 <b>LFD-Nr.: ${escapeHtml(lfd)}</b> <a href="javascript:void(0)" style="font-size:12px; color:var(--text-secondary);" onclick="glasLfdEditStopId='${s.id}'; renderGlasAdmin();">ändern</a></p>`;
  }
  return `
    <div style="margin-top:8px; background:var(--warning-bg); border:1.5px solid var(--danger); border-radius:8px; padding:8px 10px;">
      ${lfd ? "" : `<p style="margin:0 0 6px; font-weight:800; color:var(--danger); font-size:13px;">⚠️ LFD-Nr. fehlt – bitte nachtragen!</p>`}
      <div style="display:flex; gap:6px;">
        <input type="text" id="stop_lfd_${s.id}" value="${escapeHtml(lfd)}" placeholder="z.B. 99883" inputmode="numeric" style="flex:1; font-weight:700; letter-spacing:.5px;" onclick="event.stopPropagation();" />
        <button class="btn btn-sm btn-primary" onclick="glasSaveStopLfd('${s.id}')">Speichern</button>
      </div>
    </div>`;
}

async function glasSaveStopLfd(stopId) {
  const val = (document.getElementById(`stop_lfd_${stopId}`)?.value || "").trim();
  const { error } = await sb.from("glas_stopps").update({ lfd_nr: val }).eq("id", stopId);
  if (error) {
    showToast(/lfd_nr/.test(error.message || "") ? "Bitte zuerst supabase_add_lfd.sql in Supabase ausführen" : "Fehler: " + error.message);
    return;
  }
  const stop = glasTourDetailStops.find((x) => x.id === stopId);
  if (stop) stop.lfd_nr = val;
  glasLfdEditStopId = null;
  showToast(val ? "LFD-Nr. gespeichert" : "LFD-Nr. entfernt");
  await loadGlasTouren(); // Tourkarten-Hinweis ("LFD fehlt") aktuell halten
  renderGlasAdmin();
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

// Einzelne Tour aus dem Kalender aus-/einblenden (z.B. nicht geklappte Tour, doppelter
// Blanko). Betrifft NUR den Kalender – Liste & Statistik bleiben unberührt.
async function toggleGlasTourKalender(tourId) {
  if (glasBusy) return;
  const t = glasTouren.find((x) => x.id === tourId);
  if (!t) return;
  const neu = !t.kalender_versteckt;
  const { error } = await sb.from("glas_touren").update({ kalender_versteckt: neu }).eq("id", tourId);
  if (error && /kalender_versteckt/i.test(error.message || "")) {
    showToast("Bitte supabase_add_kalender_versteckt.sql in Supabase ausführen");
    return;
  }
  if (error) { showToast("Fehler: " + error.message); return; }
  t.kalender_versteckt = neu; // optimistisch, damit der Button sofort umschaltet
  showToast(neu ? "Aus dem Kalender ausgeblendet" : "Wieder im Kalender sichtbar");
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
  // LFD-Nummern (Dietrich) aus den Feldern zurücklesen (überlebt Re-Renders)
  document.querySelectorAll("input[id^='tour_lfd_']").forEach((el) => {
    glasTourLfd.set(el.id.replace("tour_lfd_", ""), el.value);
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
        <select id="t_template" onchange="syncNewTourFormFromDom(); renderGlasAdmin();">
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
        // Dietrich-Objekt (Kunde bei Dietrich ODER Tour mit Dietrich-Template): jeder
        // Schein braucht eine eigene LFD-Nr. (von Dietrich vergeben, neu pro Intervall).
        const istDietrich = glasNewTour.template === "sub"
          || (glasKunden.find((k) => k.id === o.kunde_id)?.firma === "sub");
        const lfdWert = glasTourLfd.get(o.id) || "";
        return `
        <div style="padding:10px 0; border-top:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:14px; font-weight:600;">${escapeHtml(o.name)} <span class="muted" style="font-weight:400;">· ${escapeHtml(o.kunde_name || "")}</span></span>
            <button class="btn btn-sm" style="padding:3px 8px;" onclick="glasToggleTourObjekt('${o.id}')">✕</button>
          </div>
          ${istDietrich ? `
          <div style="margin-top:8px; background:var(--warning-bg); border:1.5px solid ${lfdWert.trim() ? "var(--border)" : "var(--danger)"}; border-radius:8px; padding:8px 10px;">
            <label style="display:block; font-size:12.5px; font-weight:800;">🔢 Dietrich LFD-Nr. für diesen Schein${o.kdnr ? ` <span class="muted" style="font-weight:500;">· Objekt-Nr. ${escapeHtml(o.kdnr)}</span>` : ""}</label>
            <input type="text" id="tour_lfd_${o.id}" value="${escapeHtml(lfdWert)}" placeholder="z.B. 99883" inputmode="numeric" style="margin-top:5px; font-weight:700; letter-spacing:.5px;" />
            <p style="margin:5px 0 0; font-size:11.5px; ${lfdWert.trim() ? `color:var(--text-secondary);">Steht oben rechts auf Dietrichs Schein – für jedes Intervall neu.` : `color:var(--danger); font-weight:700;">⚠️ Ohne LFD-Nr. speichern geht – die Tour zeigt dann aber einen fetten Hinweis, bitte unbedingt nachtragen!`}</p>
          </div>` : ""}
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
    const { error: tourErr } = await sb.from("glas_touren").upsert(gekoCleanPayload({
      id: tourId,
      name,
      datum: datum || null,
      datum_bis: datumBis || null,
      template,
      notiz,
    }));
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
      // Geänderte Dietrich LFD-Nr. am bestehenden Stopp mitschreiben
      if (s.objekt_id && glasTourLfd.has(s.objekt_id)) {
        const neueLfd = (glasTourLfd.get(s.objekt_id) || "").trim();
        if (neueLfd !== (s.lfd_nr || "")) updates.lfd_nr = neueLfd;
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
        lfd_nr: (glasTourLfd.get(o.id) || "").trim(),
        positionen: JSON.stringify([...positionenForStop.map((p) => ({ id: p.id, nr: p.nr, art: p.art, einheit: p.einheit || "", qm: p.qm, pos_text: p.pos_text || "" })), ...glasCleanExtras(o.id)]),
        lat: o.lat,
        lng: o.lng,
        status: "offen",
      };
    });
    if (stoppRows.length) {
      stoppRows.forEach(gekoCleanPayload);
      let { error: stoppErr } = await sb.from("glas_stopps").insert(stoppRows);
      if (stoppErr && /lfd_nr/.test(stoppErr.message || "")) {
        // Spalte existiert noch nicht (SQL-Migration nicht ausgeführt) - Tour trotzdem
        // speichern, nur die LFD-Nr. geht dann verloren.
        ({ error: stoppErr } = await sb.from("glas_stopps").insert(stoppRows.map(({ lfd_nr, ...rest }) => rest)));
        if (!stoppErr) showToast("Hinweis: LFD-Nr. noch nicht gespeichert – bitte supabase_add_lfd.sql ausführen");
      }
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
  glasTourLfd = new Map();
  stops.filter((s) => s.status !== "erledigt" && s.objekt_id).forEach((s) => {
    glasTourNotizen.set(s.objekt_id, { use: !!s.notiz, text: s.notiz || "" });
    if (s.lfd_nr) glasTourLfd.set(s.objekt_id, s.lfd_nr);
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
    lfd: "",
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
    id: p.id || null, nr: p.nr || "", art: p.art || "", einheit: p.einheit || "", qm: p.qm != null ? String(p.qm) : "",
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
    lfd: stop.lfd_nr || "",
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
        <label class="muted">Dietrich Objekt-Nr. (optional, nur fürs Dietrich-Template – erscheint auf dem Schein neben der Haupt-Kd.-Nr. des Kunden)</label>
        <input type="text" id="es_kdnr" value="${escapeHtml(d.kdnr)}" placeholder="z.B. 501 00" />
      </div>
      <div class="field">
        <label class="muted"><b>Dietrich LFD-Nr.</b> (nur fürs Dietrich-Template – steht oben rechts auf dem Schein, für jedes Intervall neu)</label>
        <input type="text" id="es_lfd" value="${escapeHtml(d.lfd || "")}" placeholder="z.B. 99883" inputmode="numeric" style="font-weight:700; letter-spacing:.5px;" />
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
            <label class="muted">${glasIstStundenPos(pos) ? "Stunden" : "QM"}</label>
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
          <div class="field" style="flex:0 0 110px; margin-bottom:0;">
            <label class="muted">Einheit</label>
            <select id="es_pos_einheit_${i}" onchange="onEsPositionEinheitChange(${i})">
              <option value="qm" ${glasIstStundenPos(pos) ? "" : "selected"}>QM</option>
              <option value="std" ${glasIstStundenPos(pos) ? "selected" : ""}>Stunden</option>
            </select>
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
    if (!pos.einheit) pos.einheit = "qm"; // eigene Position: Standard QM, umschaltbar
  } else {
    pos.custom = false;
    pos.art = val;
    pos.nr = select.options[select.selectedIndex]?.getAttribute("data-nr") || pos.nr;
    pos.einheit = ""; // Katalog-Position: Einheit folgt wieder der Pos.-Nr.-Regel
  }
  // Leistung geändert -> nicht mehr die übernommene Objekt-Position; deren Fälligkeit
  // darf beim Unterschreiben dieses Scheins nicht mehr zurückgesetzt werden
  pos.id = null;
  renderGlasAdmin();
}

function onEsPositionEinheitChange(i) {
  syncEsFromDom();
  renderGlasAdmin();
}

function syncEsFromDom() {
  const d = glasEinzelscheinData;
  d.positionen = d.positionen.map((pos, i) => ({
    ...pos,
    nr: pos.custom ? (document.getElementById(`es_pos_custom_nr_${i}`)?.value.trim() ?? pos.nr) : pos.nr,
    art: pos.custom ? (document.getElementById(`es_pos_custom_art_${i}`)?.value.trim() ?? pos.art) : pos.art,
    einheit: pos.custom ? (document.getElementById(`es_pos_einheit_${i}`)?.value ?? pos.einheit ?? "") : (pos.einheit || ""),
    qm: document.getElementById(`es_pos_qm_${i}`)?.value.trim() ?? pos.qm,
  }));
  d.kunde_adresse = document.getElementById("es_kunde_adresse")?.value ?? d.kunde_adresse;
  d.objekt = document.getElementById("es_objekt_name")?.value ?? d.objekt;
  d.name = document.getElementById("es_name")?.value ?? d.name;
  d.adresse = document.getElementById("es_adresse")?.value ?? d.adresse;
  d.kdnr = document.getElementById("es_kdnr")?.value ?? d.kdnr;
  d.lfd = document.getElementById("es_lfd")?.value ?? d.lfd;
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
        id: p.id || null, nr: p.nr, art: p.art, einheit: p.einheit || "", qm: p.qm,
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
  const positionen = d.positionen.filter((p) => p.art || p.qm).map((p) => ({ id: p.id || null, nr: p.nr, art: p.art, einheit: p.einheit || "", qm: p.qm }));
  const esObjekt = d.objekt_id ? glasObjekte.find((x) => x.id === d.objekt_id) : null;

  const tourName = (d.name || "").trim() || `Einzelschein – ${d.objekt}`;
  const { error: tourErr } = await sb.from("glas_touren").upsert(gekoCleanPayload({
    id: tourId, name: tourName, datum: datum || null, template, frei: true,
  }));
  if (tourErr) { glasBusy = false; showToast("Fehler: " + tourErr.message); renderGlasAdmin(); return; }

  // Beim Bearbeiten NUR die editierbaren Felder des bestehenden Stopps aktualisieren -
  // Status/Unterschrift bleiben unangetastet. Beim Neuanlegen einen frischen Stopp einfügen.
  const stopFelder = {
    objekt_id: d.objekt_id || null,
    // Kunde am Stopp verankern: so taucht auch ein Blanko OHNE gewähltes Objekt sicher
    // im Verlauf/Termine-Reiter des Kunden auf.
    kunde_id: d.kunde_id || "",
    objekt: d.objekt, adresse: d.adresse, kdnr: d.kdnr,
    lfd_nr: (d.lfd || "").trim(),
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
  // Fehlende Spalten (SQL-Dateien noch nicht ausgeführt) einzeln weglassen und erneut
  // versuchen, statt das Speichern komplett zu blockieren.
  const felder = gekoCleanPayload({ ...stopFelder });
  let { error: stoppErr } = await stopSchreiben(felder);
  if (stoppErr && /kunde_id/.test(stoppErr.message || "")) {
    delete felder.kunde_id;
    ({ error: stoppErr } = await stopSchreiben(felder));
  }
  if (stoppErr && /lfd_nr/.test(stoppErr.message || "")) {
    delete felder.lfd_nr;
    ({ error: stoppErr } = await stopSchreiben(felder));
    if (!stoppErr && (d.lfd || "").trim()) showToast("Hinweis: LFD-Nr. noch nicht gespeichert – bitte supabase_add_lfd.sql ausführen");
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
      <button class="btn btn-sm" style="flex:0 0 auto;" title="Jahresvorschau – fällige Objekte pro Monat" onclick="glasOpenJahr()">📅 Jahr</button>
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
  // Nur gültiger Urlaub zählt gegen den Anspruch: noch offene Anträge sind nicht
  // entschieden, abgelehnte gelten gar nicht. (Ohne Status = alter Eintrag = gültig.)
  const meine = glasUrlaub.filter((u) => u.mitarbeiter_id === m.id && (!u.status || u.status === "genehmigt"));
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
    ${renderUrlaubAntraege()}
    ${chips}
    ${statCard}
    <div style="display:flex; justify-content:flex-end; gap:8px; margin:0 0 4px;">
      <button class="btn btn-sm" onclick="glasUrlaubVerwaltung=true; renderGlasAdmin();">⚙️ Mitarbeiter</button>
      <button class="btn btn-sm btn-primary" onclick="glasOpenUrlaub(null)">+ Urlaub eintragen</button>
    </div>
    ${renderUrlaubMonat()}
  `;
}

/* ---------------- Urlaubsanträge aus GEKO One ----------------
   Die Mitarbeiter beantragen Urlaub selbst in GEKO One; hier landen die offenen
   Anträge ganz oben im Urlaubskalender, damit sie nicht übersehen werden. */

function glasOffeneUrlaubsantraege() {
  return glasUrlaub.filter((u) => u.status === "offen");
}

// Auffälliger Hinweis ganz oben auf der Startseite, sobald Anträge warten - damit sie
// nicht im Kalender-Reiter untergehen. Ein Tipp führt direkt zur Bearbeitung.
function renderUrlaubBanner() {
  const n = glasOffeneUrlaubsantraege().length;
  if (!n) return "";
  const namen = [...new Set(glasOffeneUrlaubsantraege().map((u) => glasMaName(u.mitarbeiter_id)))];
  return `
    <button class="glas-urlaub-banner" onclick="glasOpenUrlaubsantraege()">
      <span class="gub-ic">🏖️</span>
      <span class="gub-txt">
        <span class="gub-t">${n === 1 ? "1 Urlaubsantrag wartet" : `${n} Urlaubsanträge warten`} auf dich</span>
        <span class="gub-s">${escapeHtml(namen.slice(0, 3).join(", "))}${namen.length > 3 ? " +" + (namen.length - 3) : ""} · jetzt entscheiden</span>
      </span>
      <span class="gub-arr">›</span>
    </button>`;
}

// Springt direkt in den Urlaubskalender mit den offenen Anträgen oben.
function glasOpenUrlaubsantraege() {
  glasKalenderAnsicht = "urlaub";
  glasUrlaubMaFilter = null;
  glasKalenderSelectedDay = null;
  goGlasTab("kalender");
}

function renderUrlaubAntraege() {
  const offene = glasOffeneUrlaubsantraege();
  if (!offene.length) return "";
  return `
    <div class="card" style="border:1.5px solid var(--warning-bg); background:var(--warning-bg); margin-bottom:14px;">
      <p style="margin:0 0 10px; font-weight:800; font-size:14.5px;">🏖️ ${offene.length} offene${offene.length === 1 ? "r" : ""} Urlaubsantrag${offene.length === 1 ? "" : "e"}</p>
      ${offene.map((u) => `
        <div style="background:var(--card); border-radius:11px; padding:11px 13px; margin-bottom:8px;">
          <p style="margin:0; font-weight:700; font-size:14px;">${escapeHtml(glasMaName(u.mitarbeiter_id))}</p>
          <p class="muted" style="margin:2px 0 0; font-size:13px;">${formatGlasDateRange(u.von, u.bis)}${u.notiz ? ` · ${escapeHtml(u.notiz)}` : ""}</p>
          ${(() => {
            const b = glasUrlaubBilanzOhneOffene(u.mitarbeiter_id, parseInt(u.von.slice(0, 4), 10));
            const tage = glasUrlaubTageZaehlen(u);
            return `<p class="muted" style="margin:3px 0 0; font-size:12.5px;">Beantragt: <b>${tage} Tag${tage === 1 ? "" : "e"}</b> · danach noch <b>${b.uebrig - tage}</b> von ${b.anspruch} übrig</p>`;
          })()}
          <div style="display:flex; gap:8px; margin-top:9px;">
            <button class="btn btn-sm btn-primary" onclick="glasUrlaubEntscheiden('${u.id}', 'genehmigt')">✓ Genehmigen</button>
            <button class="btn btn-sm" style="color:var(--danger);" onclick="glasUrlaubEntscheiden('${u.id}', 'abgelehnt')">✕ Ablehnen</button>
          </div>
        </div>`).join("")}
    </div>`;
}

// Arbeitstage eines Antrags zählen (wie die Bilanz: je nach 5- oder 6-Tage-Woche)
function glasUrlaubTageZaehlen(u) {
  const m = glasMitarbeiter.find((x) => x.id === u.mitarbeiter_id);
  const sa = m && m.arbeitstage === "mo_sa";
  let tage = 0;
  let d = new Date(u.von + "T00:00:00");
  const bis = new Date((u.bis || u.von) + "T00:00:00");
  while (d <= bis) {
    const wt = d.getDay(); // 0=So
    if (wt !== 0 && (sa || wt !== 6)) tage++;
    d.setDate(d.getDate() + 1);
  }
  return tage;
}

// Bilanz ohne die noch offenen Anträge - zeigt, was NACH einer Genehmigung übrig bliebe
function glasUrlaubBilanzOhneOffene(maId, jahr) {
  const m = glasMitarbeiter.find((x) => x.id === maId) || {};
  return glasUrlaubBilanz(m, jahr);
}

async function glasUrlaubEntscheiden(id, status) {
  const u = glasUrlaub.find((x) => x.id === id);
  if (!u) return;
  const name = glasMaName(u.mitarbeiter_id);
  let antwort = "";
  if (status === "abgelehnt") {
    const grund = prompt(`Urlaub von ${name} (${formatGlasDateRange(u.von, u.bis)}) ablehnen.\n\nKurze Begründung für den Mitarbeiter (optional):`, "");
    if (grund === null) return; // abgebrochen
    antwort = String(grund).trim();
  } else if (!confirm(`Urlaub von ${name} (${formatGlasDateRange(u.von, u.bis)}) genehmigen?`)) {
    return;
  }
  const payload = { status, antwort, entschieden_am: new Date().toISOString(), entschieden_von: "Büro" };
  let { error } = await sb.from("glas_urlaub").update(payload).eq("id", id);
  if (error && /(status|antwort|entschieden)/i.test(error.message || "")) {
    showToast("Bitte supabase_add_urlaub_antrag.sql in Supabase ausführen");
    return;
  }
  if (error) { showToast("Fehler: " + error.message); return; }
  await loadGlasUrlaub();
  renderGlasAdmin();
  showToast(status === "genehmigt" ? `Urlaub von ${name} genehmigt ✓` : `Urlaub von ${name} abgelehnt`);
  // Den Mitarbeiter über die Entscheidung benachrichtigen. Bewusst OHNE den
  // Büro-Schalter: das ist eine Antwort auf seinen eigenen Antrag, die will er immer.
  // Rolle "geko_one" = die Mitarbeiter-App (dort wird Push zentral aktiviert).
  try {
    sb.functions.invoke("send-push", { body: {
      role: "geko_one",
      title: status === "genehmigt" ? "🏖️ Urlaub genehmigt ✓" : "🏖️ Urlaubsantrag abgelehnt",
      body: `${formatGlasDateRange(u.von, u.bis)}${antwort ? " · " + antwort : ""}`,
      url: "/meine.html",
      mitarbeiter_id: u.mitarbeiter_id, // nur an diesen Mitarbeiter, nicht an alle
    } }).catch(() => {});
  } catch (e) {}
}

function renderUrlaubMonat() {
  const { year, month } = glasKalenderMonth;
  const monatsNamen = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const todayIso = glasTodayIso();
  const weeks = glasWeeksInRange({ year, month }, { year, month });

  // Nur entschiedener (genehmigter) Urlaub steht im Kalender - offene Anträge stehen
  // oben in der Antragsliste, abgelehnte gelten nicht.
  let urlaube = glasUrlaub.filter((u) => !u.status || u.status === "genehmigt");
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
          <p style="margin:0; font-weight:600;">${escapeHtml(m.name)}
            ${m.username
              ? (m.login_aktiv === false
                ? `<span class="badge" style="background:#fbe0e0; color:#b5371f;">🔒 gesperrt</span>`
                : `<span class="badge" style="background:#e3f3ea; color:#1f7a4d;">🔑 ${escapeHtml(m.username)}</span>`)
              : `<span class="badge" style="background:#eef2f7; color:#6b7683;">kein Login</span>`}
          </p>
          ${m.username && m.pass_klar ? `<p class="muted" style="margin:3px 0 0; font-size:12.5px;">🔑 <b>${escapeHtml(m.username)}</b> · Passwort: <b>${escapeHtml(m.pass_klar)}</b></p>` : ""}
          ${m.username && !m.pass_klar ? `<p class="muted" style="margin:3px 0 0; font-size:12.5px;">🔒 Eigenes Passwort gesetzt – nicht einsehbar. Vergessen? Beim Bearbeiten zurücksetzen.</p>` : ""}
          ${m.username ? `<p class="muted" style="margin:2px 0 0; font-size:12.5px;">${glasMaZugangBadges(m)}</p>` : ""}
          <p class="muted" style="margin:2px 0 0; font-size:12.5px;">${m.arbeitstage === "mo_sa" ? "Mo–Sa" : "Mo–Fr"} · <b style="color:${uebrigFarbe};">${b.uebrig} von ${b.anspruch} Urlaubstagen übrig</b></p>
        </div>
        <button class="btn btn-sm" onclick="glasMaEditing=${JSON.stringify(m).replace(/"/g, "&quot;")}; renderGlasAdmin();">Bearbeiten</button>
      </div>`;
    }).join("") : `<p class="muted">Noch keine Mitarbeiter angelegt.</p>`}
  `;
}

// Zeigt auf einen Blick, welche Bereiche dieser Login sehen darf (= die Kacheln,
// die in GEKO One erscheinen). zugang_glas ist historisch "an, außer ausdrücklich aus".
function glasMaZugangBadges(m) {
  const frei = [];
  if (m.zugang_glas !== false) frei.push("🧽 Glas");
  if (m.zugang_graffiti === true) frei.push("🎨 Graffiti");
  if (m.zugang_checkin === true) frei.push("📍 Check-ins");
  if (m.zugang_lager === true) frei.push("📦 Lager");
  return frei.length ? escapeHtml(frei.join(" · ")) : "<i>keine Bereiche freigeschaltet</i>";
}

// Passwort zurücksetzen: Das Büro vergibt ein Einmal-Passwort. Der Mitarbeiter MUSS
// sich danach beim nächsten Anmelden ein eigenes setzen (pw_muss_wechsel) - das alte
// ist ab sofort tot. Das Klartext-Feld bleibt nur bis zu diesem ersten Login gefüllt.
async function glasMaPasswortReset(id) {
  const m = glasMitarbeiter.find((x) => x.id === id);
  if (!m) return;
  const vorschlag = "Start" + Math.floor(1000 + Math.random() * 9000);
  const neu = prompt(`Einmal-Passwort für ${m.name} vergeben.\n\nDer Mitarbeiter meldet sich damit an und MUSS sich sofort ein eigenes Passwort setzen. Das alte Passwort funktioniert danach nicht mehr.`, vorschlag);
  if (neu === null) return;
  const pw = String(neu).trim();
  if (pw.length < 6) { showToast("Bitte mindestens 6 Zeichen"); return; }
  const salt = gekoMakeSalt();
  const payload = { pass_salt: salt, pass_hash: await gekoHashPw(pw, salt), pass_klar: pw, pw_muss_wechsel: true, pw_selbst_gesetzt: false };
  let { error } = await sb.from("glas_mitarbeiter").update(payload).eq("id", id);
  if (error && /(pw_muss_wechsel|pw_selbst_gesetzt)/i.test(error.message || "")) {
    delete payload.pw_muss_wechsel; delete payload.pw_selbst_gesetzt;
    showToast("Hinweis: Pflicht-Wechsel nicht gesetzt – bitte supabase_add_geko_one.sql ausführen");
    ({ error } = await sb.from("glas_mitarbeiter").update(payload).eq("id", id));
  }
  if (error) { showToast("Fehler: " + error.message); return; }
  await loadGlasMitarbeiter();
  if (glasMaEditing && glasMaEditing.id === id) glasMaEditing = glasMitarbeiter.find((x) => x.id === id) || glasMaEditing;
  renderGlasAdmin();
  alert(`Einmal-Passwort für ${m.name}:\n\n${pw}\n\nBitte dem Mitarbeiter mitteilen. Beim nächsten Anmelden muss er sich ein eigenes Passwort setzen.`);
}

function renderMaForm() {
  const m = glasMaEditing;
  // Monatsauswahl für den Einsatzplan: aktueller Monat + die 11 davor
  const pdfMonate = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    pdfMonate.push({ v: `${d.getFullYear()}-${d.getMonth()}`, t: `${["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"][d.getMonth()]} ${d.getFullYear()}` });
  }
  const teil = (titel, inhalt) => `
    <div class="card" style="margin:0 0 12px; padding:14px 15px;">
      <p style="margin:0 0 12px; font-weight:700; font-size:14px;">${titel}</p>
      ${inhalt}
    </div>`;

  return `
    <button class="btn btn-sm" style="margin:4px 0 14px;" onclick="glasMaEditing=null; renderGlasAdmin();">&larr; Zurück</button>
    <h2 style="margin:0 0 12px;">${m.id ? "Mitarbeiter bearbeiten" : "Neuer Mitarbeiter"}</h2>

    ${teil("👤 Name", `
      <div class="field" style="margin:0;"><input type="text" id="ma_name" value="${escapeHtml(m.name || "")}" placeholder="z.B. Manuel" /></div>`)}

    ${teil("🔑 Anmeldung &amp; Passwort", `
      <div class="field"><label class="muted">Benutzername</label>
        <input type="text" id="ma_username" value="${escapeHtml(m.username || "")}" placeholder="z.B. manuel" autocapitalize="none" autocorrect="off" spellcheck="false" />
        <p class="muted" style="margin:4px 0 0; font-size:12px;">Klein &amp; ohne Leerzeichen. Leer lassen = dieser MA kann sich nicht anmelden.</p></div>
      ${m.id && m.username && !m.pass_klar ? `
      <div class="field">
        <label class="muted">Passwort</label>
        <div class="card" style="margin:0; padding:11px 13px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span style="flex:1; min-width:140px; font-size:13px;">🔒 <b>Eigenes Passwort gesetzt</b> – aus Sicherheitsgründen nicht einsehbar.</span>
          <button class="btn btn-sm" onclick="glasMaPasswortReset('${m.id}')">🔄 Zurücksetzen</button>
        </div>
        <p class="muted" style="margin:5px 0 0; font-size:12px;">Beim Zurücksetzen vergibst du ein Einmal-Passwort; der Mitarbeiter muss sich danach sofort ein eigenes setzen.</p>
      </div>` : `
      <div class="field"><label class="muted">Passwort <span class="muted" style="font-weight:400;">(sichtbar – zum Nachschauen &amp; Ändern)</span></label>
        <input type="text" id="ma_pass" value="${escapeHtml(m.pass_klar || "")}" placeholder="Passwort vergeben" autocapitalize="none" autocorrect="off" spellcheck="false" />
        ${m.id && m.username ? `<p class="muted" style="margin:5px 0 0; font-size:12px;">Sobald der Mitarbeiter sich in GEKO One ein eigenes Passwort setzt, verschwindet es hier – dann geht nur noch Zurücksetzen.</p>` : ""}</div>`}
      ${m.id ? `<label class="glas-aktiv-toggle" style="margin:0;"><input type="checkbox" id="ma_aktiv" ${m.login_aktiv === false ? "" : "checked"} /> <span>Zugang aktiv &nbsp;<span class="muted">(Haken raus = gesperrt)</span></span></label>` : ""}`)}

    ${teil("🧩 Bausteine &nbsp;<span class=\"muted\" style=\"font-weight:400; font-size:12px;\">= Kacheln in GEKO One</span>", `
      <label class="glas-aktiv-toggle"><input type="checkbox" id="ma_zugang_glas" ${m.zugang_glas === false ? "" : "checked"} /> <span>🧽 Glas-Touren</span></label>
      <label class="glas-aktiv-toggle" style="margin-top:8px;"><input type="checkbox" id="ma_zugang_graffiti" ${m.zugang_graffiti === true ? "checked" : ""} /> <span>🎨 Graffiti</span></label>
      <label class="glas-aktiv-toggle" style="margin-top:8px;"><input type="checkbox" id="ma_zugang_checkin" ${m.zugang_checkin === true ? "checked" : ""} /> <span>📍 Check-ins</span></label>
      <label class="glas-aktiv-toggle" style="margin-top:8px;"><input type="checkbox" id="ma_zugang_lager" ${m.zugang_lager === true ? "checked" : ""} /> <span>📦 Lager-Plan</span></label>
      <p class="muted" style="margin:8px 0 0; font-size:12px;">Ein Konto, du bestimmst was er sieht – in GEKO One und in den einzelnen Apps.</p>`)}

    ${teil("🏖️ Urlaub &amp; Arbeitswoche", `
      <div class="row" style="display:flex; gap:12px; flex-wrap:wrap;">
        <div class="field" style="flex:1; min-width:150px; margin:0;">
          <label class="muted">Arbeitswoche</label>
          <select id="ma_tage">
            <option value="mo_fr" ${m.arbeitstage !== "mo_sa" ? "selected" : ""}>Mo–Fr (5 Tage)</option>
            <option value="mo_sa" ${m.arbeitstage === "mo_sa" ? "selected" : ""}>Mo–Sa (6 Tage)</option>
          </select>
        </div>
        <div class="field" style="flex:1; min-width:120px; margin:0;">
          <label class="muted">Urlaubstage / Jahr</label>
          <input type="number" id="ma_anspruch" min="0" max="366" value="${m.urlaubsanspruch != null ? m.urlaubsanspruch : 30}" />
        </div>
      </div>
      <p class="muted" style="margin:8px 0 0; font-size:12px;">Die App zieht genommene Tage ab und zeigt den Rest an.</p>`)}

    ${m.id ? teil("📄 Einsatzplan (Lager) als PDF", `
      <div class="row" style="display:flex; gap:10px; align-items:stretch;">
        <select id="ma_pdf_monat" style="flex:1;">
          ${pdfMonate.map((x) => `<option value="${x.v}">${x.t}</option>`).join("")}
        </select>
        <button class="btn btn-primary" style="flex:none;" onclick="glasMaEinsatzplanPdf('${m.id}')">📄 PDF</button>
      </div>
      <p class="muted" style="margin:8px 0 0; font-size:12px;">Tag für Tag: wann ${escapeHtml(m.name || "der Mitarbeiter")} im Lager-Einsatz war, wann Urlaub, wann frei – im GEKO-Briefkopf.</p>`) : ""}

    <div style="display:flex; gap:8px; margin-top:4px;">
      <button class="btn btn-primary" onclick="saveGlasMa()">Speichern</button>
      ${m.id ? `<button class="btn btn-sm" style="color:var(--danger); margin-left:auto;" onclick="deleteGlasMa('${m.id}')">Löschen</button>` : ""}
    </div>`;
}

// Einsatzplan-PDF direkt aus dem Mitarbeiter-Formular (Monat aus dem Auswahlfeld)
async function glasMaEinsatzplanPdf(maId) {
  if (typeof glasLagerPdfErstellen !== "function" || !(window.jspdf && window.jspdf.jsPDF)) {
    showToast("PDF-Bibliothek lädt noch – kurz warten"); return;
  }
  const v = (document.getElementById("ma_pdf_monat")?.value || "").split("-");
  const monat = v.length === 2 ? { year: parseInt(v[0], 10), month: parseInt(v[1], 10) } : { year: new Date().getFullYear(), month: new Date().getMonth() };
  if (!glasLagerPlan.length) await loadGlasLagerPlan(); // Plan evtl. noch nie geladen
  try {
    glasLagerPdfErstellen(monat, maId);
    showToast("📄 Einsatzplan erstellt");
  } catch (e) {
    showToast("PDF-Fehler: " + (e && e.message || e));
  }
}

async function saveGlasMa() {
  const m = glasMaEditing;
  const name = (document.getElementById("ma_name").value || "").trim();
  if (!name) { showToast("Bitte einen Namen eintragen"); return; }
  const anspruch = parseInt(document.getElementById("ma_anspruch").value, 10);
  const payload = { id: m.id || genCode(), name, arbeitstage: document.getElementById("ma_tage").value, urlaubsanspruch: isNaN(anspruch) ? 30 : Math.max(0, anspruch) };

  // ---- App-Zugang (Benutzername/Passwort/gesperrt) ----
  const username = (document.getElementById("ma_username")?.value || "").trim().toLowerCase().replace(/\s+/g, "");
  const passRaw = document.getElementById("ma_pass")?.value || "";
  const aktivEl = document.getElementById("ma_aktiv");
  if (username) {
    const konflikt = glasMitarbeiter.find((x) => x.id !== payload.id && (x.username || "").toLowerCase() === username);
    if (konflikt) { showToast(`Benutzername „${username}" ist schon vergeben (${konflikt.name})`); return; }
    if (!m.pass_hash && !passRaw) { showToast("Bitte ein Passwort für den neuen Zugang vergeben"); return; }
    payload.username = username;
    payload.login_aktiv = aktivEl ? aktivEl.checked : true;
  } else {
    payload.username = null; // kein Login für diesen MA
  }
  // WICHTIG: Nur neu verschlüsseln, wenn das Passwort auch WIRKLICH geändert wurde.
  // Das Feld ist mit dem bisherigen Passwort vorausgefüllt - würde man bei jedem
  // Speichern neu hashen (neues Salt = neuer Hash), verlieren alle Geräte des
  // Mitarbeiters ihre Anmeldung und er müsste sich jedes Mal neu einloggen, nur
  // weil im Büro z.B. ein Haken gesetzt wurde. Genau das war der Fehler.
  if (passRaw && passRaw !== (m.pass_klar || "")) {
    const salt = gekoMakeSalt();
    payload.pass_salt = salt;
    payload.pass_hash = await gekoHashPw(passRaw, salt);
    payload.pass_klar = passRaw; // zum Nachschauen im Büro (Admin-only, hinter PIN)
  }

  // Per-App-Zugang: bestimmt, WO sich dieser Login anmelden darf (Glas / Check-ins).
  const zGlasEl = document.getElementById("ma_zugang_glas");
  const zGraffitiEl = document.getElementById("ma_zugang_graffiti");
  const zCheckinEl = document.getElementById("ma_zugang_checkin");
  const zLagerEl = document.getElementById("ma_zugang_lager");
  if (zGlasEl) payload.zugang_glas = zGlasEl.checked;
  if (zGraffitiEl) payload.zugang_graffiti = zGraffitiEl.checked;
  if (zCheckinEl) payload.zugang_checkin = zCheckinEl.checked;
  if (zLagerEl) payload.zugang_lager = zLagerEl.checked;

  let { error } = await sb.from("glas_mitarbeiter").upsert(payload);
  // Lager-Spalte fehlt evtl. noch (supabase_add_lager.sql nicht ausgeführt)
  if (error && /zugang_lager/i.test(error.message || "")) {
    delete payload.zugang_lager;
    showToast("Lager-Freischaltung nicht gespeichert – bitte supabase_add_lager.sql in Supabase ausführen");
    ({ error } = await sb.from("glas_mitarbeiter").upsert(payload));
  }
  // Graffiti-Spalte fehlt evtl. noch (neueste SQL nicht ausgeführt) -> ohne sie erneut versuchen
  if (error && /zugang_graffiti/i.test(error.message || "")) {
    delete payload.zugang_graffiti;
    showToast("Graffiti-Freischaltung nicht gespeichert – bitte supabase_add_geko_one.sql in Supabase ausführen");
    ({ error } = await sb.from("glas_mitarbeiter").upsert(payload));
  }
  if (error && /(zugang_glas|zugang_checkin)/i.test(error.message || "")) {
    // Zugangs-Spalten fehlen noch -> ohne sie speichern und Hinweis geben
    delete payload.zugang_glas; delete payload.zugang_graffiti; delete payload.zugang_checkin; delete payload.zugang_lager;
    showToast("Per-App-Zugang nicht gespeichert – bitte supabase_add_checkins.sql in Supabase ausführen");
    ({ error } = await sb.from("glas_mitarbeiter").upsert(payload));
  }
  if (error && /(username|pass_hash|pass_salt|pass_klar|login_aktiv)/i.test(error.message || "")) {
    // Login-Spalten fehlen noch -> ohne sie speichern und Hinweis geben
    delete payload.username; delete payload.pass_hash; delete payload.pass_salt; delete payload.pass_klar; delete payload.login_aktiv;
    delete payload.zugang_glas; delete payload.zugang_graffiti; delete payload.zugang_checkin; delete payload.zugang_lager;
    showToast("App-Zugang nicht gespeichert – bitte supabase_add_ma_login.sql in Supabase ausführen");
    ({ error } = await sb.from("glas_mitarbeiter").upsert(payload));
  }
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
// Uhrzeit per Schnellwahl setzen ("ganztägig" = leeren). Nur das Zeitfeld und die
// Chips werden angefasst – kein Neuzeichnen, damit die Tastatur/das Sheet ruhig bleibt.
function glasSetTerminZeit(z) {
  if (!glasTerminEditing) return;
  glasTerminEditing.uhrzeit = z;
  const inp = document.getElementById("tm_uhrzeit");
  if (inp) inp.value = z;
  glasSyncZeitChips();
}
function glasSyncZeitChips() {
  const box = document.getElementById("tm_zeit_chips");
  if (!box) return;
  const jetzt = (glasTerminEditing && glasTerminEditing.uhrzeit) || "";
  box.querySelectorAll(".glas-zeit-chip").forEach((b) => b.classList.toggle("on", b.dataset.z === jetzt));
}

// Uhrzeit lesbar machen: "08:40" -> "8:40 Uhr" (führende Null weg, wie man es sagt).
function glasZeitLabel(z) {
  if (!z) return "";
  const m = String(z).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  return `${parseInt(m[1], 10)}:${m[2]} Uhr`;
}

function openGlasTermin(id, presetDatum) {
  glasTerminMenuOpen = false;
  if (id === null) {
    // Neue Termine bekommen die Erinnerung standardmäßig auf "Am selben Tag" –
    // ohne Erinnerung geht ein Termin im Alltag zu leicht unter.
    glasTerminEditing = { id: null, titel: "", datum: presetDatum || glasKalenderSelectedDay || glasTodayIso(), datum_bis: "", uhrzeit: "", farbe: "tuerkis", erinnerung: "same_day", notiz: "", adresse: "", wiederholung: glasWiederholungToObj(""), anhaenge: [] };
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
// Formular-Form: { freq:"nie"|"taeglich"|"woechentlich"|"monatlich"|"jaehrlich",
//                  intervall:1..99 (alle N Tage/Wochen/Monate/Jahre), wochentage:[0-6], ende:"" }
function glasIntervallClamp(v) { const n = parseInt(v, 10); return n >= 1 && n <= 99 ? n : 1; }
function glasWiederholungToObj(raw) {
  const leer = { freq: "nie", intervall: 1, wochentage: [], ende: "" };
  if (!raw) return leer;
  if (typeof raw === "object") return { freq: raw.freq || "nie", intervall: glasIntervallClamp(raw.intervall), wochentage: Array.isArray(raw.wochentage) ? raw.wochentage.slice() : [], ende: raw.ende || "" };
  try {
    const w = JSON.parse(raw);
    if (!w || !w.freq) return leer;
    return { freq: w.freq, intervall: glasIntervallClamp(w.intervall), wochentage: Array.isArray(w.wochentage) ? w.wochentage.slice() : [], ende: w.ende || "" };
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
  if (get("tm_uhrzeit") !== undefined) glasTerminEditing.uhrzeit = get("tm_uhrzeit");
  if (get("tm_erinnerung") !== undefined) glasTerminEditing.erinnerung = get("tm_erinnerung");
  if (get("tm_notiz") !== undefined) glasTerminEditing.notiz = get("tm_notiz");
  if (get("tm_adresse") !== undefined) glasTerminEditing.adresse = get("tm_adresse");
  if (get("tm_freq") !== undefined && glasTerminEditing.wiederholung) glasTerminEditing.wiederholung.freq = get("tm_freq");
  if (get("tm_intervall") !== undefined && glasTerminEditing.wiederholung) glasTerminEditing.wiederholung.intervall = glasIntervallClamp(get("tm_intervall"));
  if (get("tm_wieder_ende") !== undefined && glasTerminEditing.wiederholung) glasTerminEditing.wiederholung.ende = get("tm_wieder_ende");
}

// Wird der Beginn nach hinten geschoben, kann ein bereits gesetztes Ende davor liegen.
// Das Ende wird dann sofort entfernt (statt den Termin still unsichtbar zu machen).
function glasTerminBeginnGeaendert() {
  syncTerminFormFromDom();
  const t = glasTerminEditing;
  if (!t) return;
  if (t.datum_bis && t.datum && t.datum_bis < t.datum) {
    t.datum_bis = "";
    showToast("Ende lag vor dem Beginn – Ende wurde entfernt");
  }
  renderGlasAdmin();
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
        <input type="date" id="tm_datum" value="${t.datum || ""}" onchange="glasTerminBeginnGeaendert()" style="width:auto; margin-left:auto;" />
      </div>
      <div class="glas-sheet-row">
        <span class="glas-sheet-ico"></span>
        <span class="muted">Ende <span style="font-size:11px;">(optional)</span></span>
        <input type="date" id="tm_datum_bis" value="${t.datum_bis || ""}" min="${t.datum || ""}" style="width:auto; margin-left:auto;" />
      </div>
      <div class="glas-sheet-row">
        <span class="glas-sheet-ico">🕐</span>
        <span>Uhrzeit <span style="font-size:11px;" class="muted">(optional)</span></span>
        <input type="time" id="tm_uhrzeit" class="glas-time" value="${t.uhrzeit || ""}"
          oninput="glasTerminEditing.uhrzeit=this.value; glasSyncZeitChips();" style="margin-left:auto;" />
      </div>
      <div class="glas-sheet-row" style="padding-top:0;">
        <span class="glas-sheet-ico"></span>
        <div class="glas-zeit-chips" id="tm_zeit_chips">
          ${["07:00","08:00","09:00","10:00","13:00","14:00"].map((z) =>
            `<button type="button" class="glas-zeit-chip${t.uhrzeit === z ? " on" : ""}" data-z="${z}"
               onclick="glasSetTerminZeit('${z}')">${z}</button>`).join("")}
          <button type="button" class="glas-zeit-chip glas-zeit-clear${!t.uhrzeit ? " on" : ""}" data-z=""
            onclick="glasSetTerminZeit('')">ganztägig</button>
        </div>
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
      ${w.freq !== "nie" ? `
      <div class="glas-sheet-row">
        <span class="glas-sheet-ico"></span>
        <span class="muted">Alle</span>
        <input type="number" id="tm_intervall" min="1" max="99" inputmode="numeric" value="${glasIntervallClamp(w.intervall)}" onchange="syncTerminFormFromDom(); renderGlasAdmin();" style="width:62px; margin:0 8px; text-align:center;" />
        <span class="muted">${(GLAS_FREQ_EINHEIT[w.freq] || ["", ""])[glasIntervallClamp(w.intervall) > 1 ? 1 : 0]}</span>
      </div>` : ""}
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
const GLAS_FREQ_EINHEIT = { taeglich: ["Tag", "Tage"], woechentlich: ["Woche", "Wochen"], monatlich: ["Monat", "Monate"], jaehrlich: ["Jahr", "Jahre"] };
function glasWiederholungLabel(raw) {
  const w = glasWiederholungToObj(raw);
  if (w.freq === "nie") return "";
  const wt = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const n = glasIntervallClamp(w.intervall);
  let s = n > 1
    ? `Alle ${n} ${(GLAS_FREQ_EINHEIT[w.freq] || ["", ""])[1]}`
    : ({ taeglich: "Täglich", woechentlich: "Wöchentlich", monatlich: "Monatlich", jaehrlich: "Jährlich" }[w.freq] || "");
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
          <p style="margin:0; font-weight:700; font-size:${mehrtaegig ? "16px" : "19px"};">${glasDatumGross(t.datum)}${t.uhrzeit && !mehrtaegig ? `<span style="color:${c.dot};"> · ${escapeHtml(glasZeitLabel(t.uhrzeit))}</span>` : ""}</p>
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
    uhrzeit: (t.uhrzeit || "").trim() || null,
    farbe: t.farbe || "tuerkis",
    erinnerung: t.erinnerung || "",
    notiz: t.notiz || "",
    adresse: (t.adresse || "").trim(),
    wiederholung: glasWiederholungToStr(t.wiederholung),
    anhaenge: JSON.stringify(t.anhaenge || []),
  };
  // Ende vor dem Beginn kann nur ein Versehen sein (z.B. Beginn nachträglich verschoben).
  // Statt es zu speichern - was den Termin unsichtbar machen würde - wird der Termin
  // eintägig gespeichert und der Nutzer darauf hingewiesen.
  let endeVerworfen = false;
  if (payload.datum_bis && payload.datum_bis < payload.datum) {
    payload.datum_bis = null;
    endeVerworfen = true;
  }
  const warNeu = !t.id;
  gekoCleanPayload(payload);
  let { error } = await sb.from("glas_termine").upsert(payload);
  if (error && /wiederholung|adresse|uhrzeit/.test(error.message || "")) {
    // Spalten existieren noch nicht (neueste SQL-Datei nicht ausgeführt) - Termin
    // trotzdem ohne die neuen Felder speichern, statt komplett zu blockieren.
    delete payload.wiederholung;
    delete payload.adresse;
    delete payload.uhrzeit;
    ({ error } = await sb.from("glas_termine").upsert(payload));
    if (!error) showToast("Hinweis: Uhrzeit/Wiederholung/Adresse noch nicht gespeichert – bitte neueste SQL-Datei ausführen");
  }
  glasBusy = false;
  if (error) { showToast("Fehler: " + error.message); renderGlasAdmin(); return; }
  showToast(endeVerworfen ? "Termin gespeichert – das Ende lag vor dem Beginn und wurde entfernt" : "Termin gespeichert");
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
  if (glasIntervallClamp(w.intervall) > 1) obj.intervall = glasIntervallClamp(w.intervall);
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
  // Ein Ende VOR dem Beginn (z.B. Beginn nachträglich nach hinten geschoben) ergibt eine
  // negative Dauer - der Termin fiele dann aus jeder Ansicht heraus und wäre unsichtbar.
  // Solche Termine werden als eintägig behandelt, damit sie nie verschwinden.
  const dauer = t.datum_bis && t.datum_bis > t.datum ? glasDaysBetween(t.datum, t.datum_bis) : 0;
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
  const N = glasIntervallClamp(w.intervall); // "alle N ..."
  let guard = 0;
  if (w.freq === "taeglich") {
    // Nur jeden N-ten Tag ab dem Startdatum (ausgerichtet an t.datum)
    let cur = t.datum;
    while (cur < scanFrom && guard++ < 4000) cur = glasAddDaysIso(cur, N);
    while (cur <= hardStop && guard++ < 4000) { addOcc(cur); cur = glasAddDaysIso(cur, N); }
  } else if (w.freq === "woechentlich") {
    const tage = Array.isArray(w.wochentage) && w.wochentage.length ? w.wochentage : [new Date(t.datum + "T00:00:00").getDay()];
    const startMontag = glasMontagVon(t.datum); // Kalenderwochen ab der Startwoche zählen
    let cur = scanFrom;
    while (cur <= hardStop && guard++ < 1500) {
      if (tage.includes(new Date(cur + "T00:00:00").getDay())) {
        const wochen = Math.round(glasDaysBetween(startMontag, glasMontagVon(cur)) / 7);
        if (wochen >= 0 && wochen % N === 0) addOcc(cur);
      }
      cur = glasAddDaysIso(cur, 1);
    }
  } else if (w.freq === "monatlich") {
    let cur = t.datum;
    while (cur < scanFrom && guard++ < 1200) cur = glasAddMonthsIso(cur, N);
    while (cur <= hardStop && guard++ < 1200) { addOcc(cur); cur = glasAddMonthsIso(cur, N); }
  } else if (w.freq === "jaehrlich") {
    let cur = t.datum;
    while (cur < scanFrom && guard++ < 800) cur = glasAddMonthsIso(cur, N * 12);
    while (cur <= hardStop && guard++ < 800) { addOcc(cur); cur = glasAddMonthsIso(cur, N * 12); }
  } else {
    addOcc(t.datum);
  }
  return out;
}

// Termine eines Tages – nach Uhrzeit sortiert (ganztägige zuerst, dann chronologisch).
function glasTermineAmTag(iso) {
  return glasTermine
    .filter((t) => t.datum && glasTerminVorkommen(t, iso, iso).length)
    .slice()
    .sort((a, b) => (a.uhrzeit || "").localeCompare(b.uhrzeit || ""));
}

function glasTourenAmTag(iso) {
  // Bewusst INKL. archivierter Touren: Archivieren ist nur eine Aufräum-Ansicht in der
  // Touren-Liste und darf Touren nicht aus dem Kalender entfernen. AUSGENOMMEN Touren,
  // die der Admin bewusst aus dem Kalender ausgeblendet hat (kalender_versteckt).
  return glasTouren.filter((t) => !t.kalender_versteckt && t.datum && iso >= t.datum && iso <= (t.datum_bis || t.datum));
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
function glasToggleKalGraffiti() { glasKalGraffitiEinblenden = !glasKalGraffitiEinblenden; glasUpdateTabContent(); }

// Sucht Termine, Touren und Objekte - direkt aus dem Kalender heraus
function renderKalenderSuchErgebnisse() {
  const q = glasKalSearch.trim().toLowerCase();
  if (q.length < 2) return `<p class="muted" style="margin:8px 2px 2px;">Mindestens 2 Zeichen eingeben…</p>`;
  const termine = glasTermine.filter((t) => glasSearchMatch(t.titel, q)).slice(0, 8);
  const touren = glasTouren.filter((t) => glasSearchMatch(t.name, q)).slice(0, 8);
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
  // INKL. archivierter Touren – der Kalender zeigt IMMER alle Touren (auch unterschriebene,
  // archivierte). Archivieren betrifft nur die Übersichts-Liste, nicht den Kalender.
  // Ausnahme: einzeln aus dem Kalender ausgeblendete Touren (kalender_versteckt).
  const activeTouren = glasTouren.filter((t) => t.datum && !t.kalender_versteckt);

  // Touren und freie Termine werden gemeinsam als Balken einsortiert
  const events = [
    // 🚐 Glas-Touren (für die Mitarbeiter). Farbe: orange = geplant, grün = fertig.
    // In den kleinen Monats-Chips bewusst OHNE Emoji-Präfix - die Farbe sagt schon, was
    // es ist (Legende unten), und jedes Emoji kostet 2-3 Zeichen Text pro Chip.
    ...(glasKalTourenEinblenden ? activeTouren.map((t) => ({
      datum: t.datum, datum_bis: t.datum_bis,
      col: glasTourKalenderFarbe(t),
      done: glasTourAllDone(t), // erledigte Touren im Kalender durchgestrichen anzeigen
      label: t.name ? t.name : (t.frei ? "Blanko" : "Tour"),
    })) : []),
    // Eigene Büro-Termine (📌-Schalter)
    ...(glasKalTermineEinblenden ? glasTermine.filter((t) => t.datum).flatMap((t) => {
      const c = GLAS_TERMIN_FARBEN[t.farbe] || GLAS_TERMIN_FARBEN.tuerkis;
      // Wiederkehrende Termine erscheinen an jedem Vorkommen im sichtbaren Zeitraum
      return glasTerminVorkommen(t, rangeVon, rangeBis).map((occ) => ({
        datum: occ.datum, datum_bis: occ.datum_bis,
        // Uhrzeit vor den Titel – im Monat sieht man so auf einen Blick, wann es losgeht
        col: c.dot, label: (t.uhrzeit ? t.uhrzeit + " " : "") + (t.titel || "Termin"),
      }));
    }) : []),
    // 🎨 Graffiti-Termine aus der Graffiti-App (scheine.termin) - eigene Farbe.
    ...(glasKalGraffitiEinblenden ? glasGraffitiTermine.map((g) => {
      const iso = glasGraffitiTag(g); // Termin-Tag oder (ohne Termin) Unterschrifts-Tag
      const gdone = !!(g.unterschrift_name || g.signed_at);
      return {
        datum: iso, datum_bis: iso,
        // Unterschrieben -> durchgestrichen in dunklem Magenta (eigene Graffiti-Farbe,
        // klar anders als die grünen Glas-Touren); offen -> helles Magenta.
        col: gdone ? GLAS_GRAFFITI_DONE : GLAS_GRAFFITI_COL,
        done: gdone,
        label: (g.kunde || "").split("\n")[0] || "Graffiti",
      };
    }).filter((e) => e.datum) : []),
    // Urlaube (einblendbar über 🏖️): bewusst dezenter/transparenter gestylt als Touren/
    // Termine, damit man sie klar unterscheiden kann (is-urlaub)
    ...(glasKalUrlaubEinblenden ? glasUrlaub.filter((u) => u.von).map((u) => ({
      datum: u.von, datum_bis: u.bis || u.von,
      col: glasMaFarbe(u.mitarbeiter_id), urlaub: true,
      label: glasMaName(u.mitarbeiter_id),
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
  // Mehrtägige Balken reservieren ihre Lane inkl. 1 Tag Rand links/rechts - sonst dockt
  // direkt daneben ein (womöglich gleichfarbiger) Einzeltermin in derselben Zeile an und
  // wirkt wie ein abgerissenes Stück des Balkens.
  const laneEnds = []; // laneEnds[l] = belegt-bis-Datum der Lane l
  events
    .map((e, i) => {
      const mehrtaegig = e.datum_bis && e.datum_bis !== e.datum;
      return {
        e, i,
        s: mehrtaegig ? glasAddDaysIso(e.datum, -1) : e.datum,
        en: mehrtaegig ? glasAddDaysIso(e.datum_bis, 1) : (e.datum_bis || e.datum),
      };
    })
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
            return `<div class="glas-cal-chip${contLeft ? " continues-left" : ""}${contRight ? " continues-right" : ""}${t.urlaub ? " is-urlaub" : ""}${t.done ? " is-done" : ""}" style="--c:${t.col};">${contLeft ? "&nbsp;" : escapeHtml(t.label)}</div>`;
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
        <button class="btn btn-sm${glasKalGraffitiEinblenden ? " btn-primary" : ""}" title="Graffiti-Termine (🎨) ein-/ausblenden" onclick="glasToggleKalGraffiti()">🎨</button>
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
        <span style="margin-left:6px;"><span style="display:inline-block; width:9px; height:9px; border-radius:2px; background:${GLAS_GRAFFITI_COL}; vertical-align:middle;"></span> 🎨 Graffiti${glasKalGraffitiEinblenden ? "" : " <b>(ausgeblendet)</b>"}</span>
      </div>
      <button class="btn btn-sm" style="margin:8px 6px 0;" onclick="glasKalenderMonth = { year: new Date().getFullYear(), month: new Date().getMonth() }; glasKalenderSelectedDay = glasTodayIso(); renderGlasAdmin();">Heute</button>
    </div>
    ${glasKalenderSelectedDay ? renderKalenderTagPanel(glasKalenderSelectedDay) : ""}
    ${glasGraffitiInfoId ? renderGraffitiInfoModal() : ""}
  `;
  glasCalAnimDir = null;
  return html;
}

// Read-only Info zu einem Graffiti-Termin im Kalender + Sprung in die Graffiti-App.
let glasGraffitiInfoId = null;
function glasOpenGraffitiInfo(id) { glasGraffitiInfoId = id; renderGlasAdmin(); }
function glasCloseGraffitiInfo() { glasGraffitiInfoId = null; renderGlasAdmin(); }
function glasOpenGraffitiInApp(id) { window.location.href = "admin.html#/schein/" + id; }
function renderGraffitiInfoModal() {
  const g = glasGraffitiTermine.find((x) => x.id === glasGraffitiInfoId);
  if (!g) return "";
  const done = !!(g.unterschrift_name || g.signed_at);
  const zeit = glasUhrzeitVonTimestamp(g.termin);
  const datum = formatGlasDate(glasDatumVonTimestamp(g.termin));
  const adresse = (g.adresse || "").trim();
  const kundeLines = (g.kunde || "").split("\n").filter((l) => l.trim());
  return `
    <div class="modal-overlay glas-graffiti-ov" style="z-index:10000;" onclick="if(event.target===this)glasCloseGraffitiInfo()">
      <div class="glas-day-sheet">
        <div class="glas-sheet-grip"></div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <p style="margin:0; font-weight:800; font-size:17px;">🎨 Graffiti-Termin</p>
          <button class="btn btn-sm" onclick="glasCloseGraffitiInfo()">✕</button>
        </div>
        ${done
          ? `<div class="glas-notiz-box" style="background:var(--success-bg); color:var(--success-text); margin-bottom:10px;">✓ Bereits unterschrieben${g.unterschrift_name ? " von " + escapeHtml(g.unterschrift_name) : ""}</div>`
          : `<div class="glas-notiz-box" style="margin-bottom:10px;">🕐 ${datum}${zeit ? " · " + zeit + " Uhr" : ""}</div>`}
        <div class="glas-sheet-row"><span class="glas-sheet-ico">🏢</span><span style="white-space:pre-line;">${kundeLines.map(escapeHtml).join("\n") || "—"}</span></div>
        ${adresse ? `<a class="glas-sheet-row" href="${wazeLink(adresse)}" target="_blank" rel="noopener" style="text-decoration:none; color:inherit;"><span class="glas-sheet-ico">📍</span><span style="flex:1; min-width:0; white-space:pre-line;">${escapeHtml(adresse)}</span><span style="color:var(--blue); font-size:12px; font-weight:600; white-space:nowrap;">Route ›</span></a>` : ""}
        ${g.kategorie ? `<div class="glas-sheet-row"><span class="glas-sheet-ico">🏷️</span><span>${escapeHtml(g.kategorie)}</span></div>` : ""}
        ${g.leistungen ? `<div class="glas-sheet-row" style="align-items:flex-start;"><span class="glas-sheet-ico">🧹</span><span style="white-space:pre-line;">${escapeHtml(g.leistungen)}</span></div>` : ""}
        ${g.ansprechpartner ? `<div class="glas-sheet-row"><span class="glas-sheet-ico">👤</span><span>${escapeHtml(g.ansprechpartner)}</span></div>` : ""}
        ${g.telefon ? `<a class="glas-sheet-row" href="tel:${escapeHtml(g.telefon)}" style="text-decoration:none; color:inherit;"><span class="glas-sheet-ico">📞</span><span style="flex:1;">${escapeHtml(g.telefon)}</span><span style="color:var(--blue); font-size:12px; font-weight:600;">Anrufen ›</span></a>` : ""}
        <button class="btn btn-primary" style="width:100%; justify-content:center; margin-top:14px;" onclick="glasOpenGraffitiInApp('${g.id}')">🎨 In Graffiti-App öffnen</button>
        <p class="muted" style="text-align:center; font-size:11.5px; margin:8px 0 0;">Bearbeiten &amp; Unterschreiben in der Graffiti-App.</p>
      </div>
    </div>`;
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
    const allDone = glasTourAllDone(t);
    return `
      <div style="display:flex; align-items:center; gap:12px; padding:12px 0; border-top:1px solid var(--border); cursor:pointer;" onclick="glasNavigate({type:'tabs', tab:'touren'}); openGlasTourDetail('${t.id}');">
        <span style="width:4px; align-self:stretch; border-radius:2px; background:${glasTourKalenderFarbe(t)};"></span>
        <div style="flex:1; min-width:0;">
          <p style="margin:0; font-weight:600; ${allDone ? "text-decoration:line-through; color:var(--success-text);" : ""}">🚐 ${t.name ? escapeHtml(t.name) : (t.frei ? "Blanko" : "Tour")}${allDone ? " ✓" : ""}</p>
          <p class="muted" style="margin:2px 0 0; font-size:12.5px;">${formatGlasDateRange(t.datum, t.datum_bis)} · ${done}/${stops.length} erledigt</p>
        </div>
        <span style="color:var(--text-secondary);">›</span>
      </div>`;
  }).join("");

  // 🎨 Graffiti-Termine dieses Tages (read-only Info + Sprung in die Graffiti-App)
  const graffitiAmTag = glasKalGraffitiEinblenden
    ? glasGraffitiTermine.filter((g) => glasGraffitiTag(g) === iso)
    : [];
  const graffitiRows = graffitiAmTag.map((g) => {
    const done = !!(g.unterschrift_name || g.signed_at);
    const zeit = glasUhrzeitVonTimestamp(g.termin || g.signed_at);
    const strasse = (g.adresse || "").split("\n")[0];
    return `
      <div style="display:flex; align-items:center; gap:12px; padding:12px 0; border-top:1px solid var(--border); cursor:pointer;" onclick="glasOpenGraffitiInfo('${g.id}')">
        <span style="width:4px; align-self:stretch; border-radius:2px; background:${done ? GLAS_GRAFFITI_DONE : GLAS_GRAFFITI_COL};"></span>
        <div style="flex:1; min-width:0;">
          <p style="margin:0; font-weight:600; ${done ? `text-decoration:line-through; color:${GLAS_GRAFFITI_DONE};` : ""}">🎨 ${escapeHtml((g.kunde || "").split("\n")[0] || "Graffiti")}${done ? " ✓" : ""}</p>
          <p class="muted" style="margin:2px 0 0; font-size:12.5px;">${zeit ? zeit + " Uhr · " : ""}${escapeHtml(g.kategorie || "Graffiti")}${strasse ? " · " + escapeHtml(strasse) : ""}</p>
        </div>
        <span style="color:var(--text-secondary);">›</span>
      </div>`;
  }).join("");

  const terminRows = (glasKalTermineEinblenden ? termine : []).map((t) => {
    const c = GLAS_TERMIN_FARBEN[t.farbe] || GLAS_TERMIN_FARBEN.tuerkis;
    return `
      <div style="display:flex; align-items:flex-start; gap:12px; padding:12px 0; border-top:1px solid var(--border); cursor:pointer;" onclick="openGlasTermin('${t.id}')">
        <span style="width:4px; align-self:stretch; border-radius:2px; background:${c.dot};"></span>
        ${t.uhrzeit ? `<span style="flex:none; width:52px; font-weight:800; font-size:14px; color:${c.dot}; font-variant-numeric:tabular-nums; padding-top:1px;">${escapeHtml(t.uhrzeit)}</span>` : ""}
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
    <div class="modal-overlay glas-day-sheet-ov" onclick="if(event.target===this){glasSheetZu(this, () => { glasKalenderSelectedDay=null; renderGlasAdmin(); });}">
      <div class="glas-day-sheet">
        <div class="glas-sheet-grip"></div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <p style="margin:0; font-weight:700; font-size:16px;">${wt}, ${formatGlasDate(iso)}</p>
          <div style="display:flex; gap:6px; flex-shrink:0;">
            <button class="btn btn-sm" onclick="openGlasTermin(null, '${iso}')">+ Termin</button>
            <button class="btn btn-sm" onclick="glasSheetZu(this, () => { glasKalenderSelectedDay=null; renderGlasAdmin(); });">✕</button>
          </div>
        </div>
        ${tourRows}${terminRows}${graffitiRows}${urlaubRows}
        ${!(glasKalTourenEinblenden && touren.length) && !(glasKalTermineEinblenden && termine.length) && !graffitiAmTag.length && !urlaubeAmTag.length ? `<p class="muted" style="margin:12px 0 4px;">Nichts geplant an diesem Tag.</p>` : ""}
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
    .map((p) => ({ id: p.id, nr: p.nr, art: p.art, einheit: p.einheit || "", qm: p.qm, pos_text: p.pos_text || "" }));

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
    gekoCleanPayload(stopFelder);
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
  glasTourLfd = new Map();
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
  const spalten = "id, objekt_id, objekt, adresse, kdnr, kunde_id, kunde_kdnr, kunde_adresse, positionen, zusatz, name, datum, signed_at, manuell_erledigt_am, unterschrift, tour_id, glas_touren(name, datum, template, archiviert_am, frei)";
  let { data, error } = await sb
    .from("glas_stopps")
    .select(spalten + ", lfd_nr")
    .eq("status", "erledigt");
  // Fallback ohne lfd_nr, solange supabase_add_lfd.sql noch nicht ausgeführt wurde
  if (error && /lfd_nr/.test(error.message || "")) {
    ({ data, error } = await sb.from("glas_stopps").select(spalten).eq("status", "erledigt"));
  }
  glasScheineDaten = error ? [] : (data || [])
    .filter((s) => s.glas_touren && glasSignaturDatum(s)) // inkl. archivierter Touren – unterschriebene Scheine bleiben immer sichtbar
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
  if (gran === "jahr") {
    const y = anker.slice(0, 4);
    return { von: `${y}-01-01`, bis: `${y}-12-31`, label: y };
  }
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
  if (gran === "jahr") return `${Number(anker.slice(0, 4)) + dir}${anker.slice(4)}`;
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
    + `${manuell ? " · ✔️ markiert" : s.name ? ` · ✓ ${escapeHtml(s.name)}${uhr ? ` ${uhr}` : ""}` : ""}`
    + `${s.lfd_nr ? ` · <b>LFD ${escapeHtml(s.lfd_nr)}</b>` : (s.glas_touren?.template === "sub" && "lfd_nr" in s ? ` · <b style="color:var(--danger);">⚠️ LFD fehlt</b>` : "")}`;
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
    const gefiltert = (glasScheineDaten || []).filter((s) => glasSearchMatch(`${s.objekt || ""} ${glasScheinKunde(s)} ${s.name || ""} ${s.glas_touren?.name || ""} ${s.kdnr || ""} ${s.kunde_kdnr || ""} ${s.lfd_nr || ""}`, q));
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
let glasStatFirma = "alle";      // "alle" | "geko" | "sub" (Dietrich)
let glasStatGran = "jahr";       // "woche" | "monat" | "jahr" - gewählter Zeitraum
let glasStatAnker = "";          // ISO-Tag im gewählten Zeitraum (leer = heute)
let glasStatSelKey = null;       // angetippter Balken (Unter-Zeitraum), null = automatisch

function glasStatSetSel(key) { glasStatSelKey = glasStatSelKey === key ? null : key; renderGlasAdmin(); }
function glasStatSetAnker(iso) { if (iso) { glasStatAnker = iso; glasStatSelKey = null; renderGlasAdmin(); } }
function glasStatSetGran(g) { glasStatGran = g; glasStatSelKey = null; renderGlasAdmin(); }
function glasStatSetFirma(f) { glasStatFirma = f; renderGlasAdmin(); }

// Firma eines Statistik-Stopps: über Objekt -> Kunde. Unbekannt zählt als GEKO.
function glasStatFirmaVon(stop) {
  const o = glasObjekte.find((x) => x.id === stop.objekt_id);
  const k = o ? glasKunden.find((x) => x.id === o.kunde_id) : null;
  return k && k.firma === "sub" ? "sub" : "geko";
}

// Balken (Unter-Zeiträume) des gewählten Zeitraums: Jahr -> 12 Monate, Monat/Woche -> Tage
function glasStatBalken(von, bis, gran) {
  const list = [];
  if (gran === "jahr") {
    const y = von.slice(0, 4);
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      list.push({ key: `${y}-${mm}`, label: GLAS_STAT_MONATE[m - 1] });
    }
  } else {
    let d = von, i = 0;
    while (d <= bis && i < 40) {
      list.push({ key: d, label: gran === "woche" ? ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][i] || "" : String(Number(d.slice(8, 10))) });
      d = glasAddDaysIso(d, 1); i++;
    }
  }
  return list;
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
  // Große Werte ohne Nachkommastelle, aber mit Tausenderpunkt ("131.640"),
  // kleine mit maximal einer Nachkommastelle ("756,5")
  const gerundet = Math.round(qm * 10) / 10;
  return gerundet.toLocaleString("de-DE", { maximumFractionDigits: gerundet >= 1000 ? 0 : 1 });
}

const GLAS_STAT_MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function glasStatMonatLabel(ym) {
  return `${GLAS_STAT_MONATE[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
}

// ---- Neue Statistik-Seite: Firma-Filter, Woche/Monat/Jahr, tappbares Balken-Chart ----
function renderStatistikPage() {
  if (glasStatistikDaten === null) {
    loadGlasStatistik();
    return `
      <button class="btn btn-sm" style="margin:16px 0;" onclick="goGlasTab('einstellungen')">&larr; Zur\u00fcck</button>
      <p class="muted"><span class="spinner"></span> Statistiken werden berechnet...</p>`;
  }
  if (!glasStatAnker) glasStatAnker = glasTodayIso();

  const { von, bis, label } = glasPeriodeGrenzen(glasStatAnker, glasStatGran);
  const rows = glasStatistikDaten.filter((x) => x.datum >= von && x.datum <= bis
    && (glasStatFirma === "alle" || glasStatFirmaVon(x) === glasStatFirma));

  // KPIs \u00fcber den ganzen Zeitraum
  let qmGesamt = 0;
  rows.forEach((x) => { qmGesamt += glasStatQmVon(x); });
  const avg = rows.length ? Math.round(qmGesamt / rows.length) : 0;

  // Balken + Werte je Unter-Zeitraum (Jahr: Monate, Monat/Woche: Tage)
  const balken = glasStatBalken(von, bis, glasStatGran);
  const keyVon = (x) => (glasStatGran === "jahr" ? x.datum.slice(0, 7) : x.datum);
  const proKey = new Map();
  rows.forEach((x) => {
    const k = keyVon(x);
    const cur = proKey.get(k) || { qm: 0, n: 0 };
    cur.qm += glasStatQmVon(x); cur.n++;
    proKey.set(k, cur);
  });
  balken.forEach((b) => { const c = proKey.get(b.key); b.qm = c ? c.qm : 0; b.n = c ? c.n : 0; });
  const maxQm = Math.max(1, ...balken.map((b) => b.qm));

  // Auswahl: angetippter Balken, sonst automatisch der letzte mit Daten
  let selKey = glasStatSelKey;
  if (!selKey || !balken.some((b) => b.key === selKey)) {
    const mitWert = balken.filter((b) => b.n > 0);
    selKey = mitWert.length ? mitWert[mitWert.length - 1].key : null;
  }
  const sel = balken.find((b) => b.key === selKey) || null;
  const selIdx = sel ? balken.indexOf(sel) : -1;
  const prev = selIdx > 0 ? balken[selIdx - 1] : null;
  const delta = sel && prev && prev.qm > 0 ? Math.round(((sel.qm - prev.qm) / prev.qm) * 100) : null;

  // Top-Objekte im ausgew\u00e4hlten Balken
  const selRows = sel ? rows.filter((x) => keyVon(x) === sel.key) : [];
  const proObjekt = new Map();
  selRows.forEach((x) => { const k = x.objekt || "?"; proObjekt.set(k, (proObjekt.get(k) || 0) + glasStatQmVon(x)); });
  const topObjekte = [...proObjekt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topMax = Math.max(1, ...topObjekte.map((t) => t[1]));

  // Bei 31 Tages-Balken nur jedes 5. Label zeigen, sonst wird es unleserlich
  const zeigeLabel = (b) => glasStatGran !== "monat" || b.label === "1" || Number(b.label) % 5 === 0;
  const granBtn = (g, lb) => `<button class="glas-seg-btn ${glasStatGran === g ? "on" : ""}" onclick="glasStatSetGran('${g}')">${lb}</button>`;
  const firmaBtn = (f, lb) => `<button class="glas-seg-btn ${glasStatFirma === f ? "on" : ""}" onclick="glasStatSetFirma('${f}')">${lb}</button>`;
  const kpi = (wert, lb, extra) => `
    <div class="glas-kpi"><div class="n">${wert}</div><div class="l">${lb}</div>${extra || ""}</div>`;
  const selLabel = sel ? (glasStatGran === "jahr" ? GLAS_MONATE_LANG[Number(sel.key.slice(5, 7)) - 1] : formatGlasDate(sel.key)) : "";

  return `
    <button class="btn btn-sm" style="margin:16px 0;" onclick="goGlasTab('einstellungen')">&larr; Zur\u00fcck zu den Einstellungen</button>
    <h1 style="margin:0 0 10px;">\ud83d\udcca Statistiken</h1>
    <div class="glas-seg" style="margin-bottom:8px;">
      ${firmaBtn("alle", "Alle")}${firmaBtn("geko", "GEKO")}${firmaBtn("sub", "Dietrich")}
    </div>
    <div class="glas-seg" style="margin-bottom:8px;">
      ${granBtn("woche", "Woche")}${granBtn("monat", "Monat")}${granBtn("jahr", "Jahr")}
    </div>
    ${renderPeriodeNavigator(glasStatAnker, glasStatGran, "glasStatSetAnker")}
    <p class="muted" style="margin:-4px 0 10px; font-size:12px;">${escapeHtml(label)} \u00b7 nur unterschriebene Abnahmen z\u00e4hlen</p>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-bottom:12px;">
      ${kpi(glasStatQmText(qmGesamt), "qm gereinigt")}
      ${kpi(String(rows.length), "Abnahmescheine")}
      ${kpi(String(avg), "\u00d8 qm pro Schein")}
      ${sel ? kpi(glasStatQmText(sel.qm) + " qm", escapeHtml(selLabel),
        delta !== null ? `<span class="d ${delta >= 0 ? "up" : "dn"}">${delta >= 0 ? "\u25b2" : "\u25bc"} ${Math.abs(delta)}% vs. Vorperiode</span>` : "") : kpi("\u2013", "Auswahl")}
    </div>

    <div class="card">
      <h2 style="margin:0 0 2px;">Gereinigte qm pro ${glasStatGran === "jahr" ? "Monat" : "Tag"}</h2>
      <p class="muted" style="margin:0 0 10px; font-size:12px;">Balken antippen \u2192 Details darunter</p>
      <div class="glas-vchart">
        ${balken.map((b) => `
          <div class="glas-vbar${sel && b.key === sel.key ? " sel" : ""}" onclick="glasStatSetSel('${b.key}')" title="${glasStatQmText(b.qm)} qm \u00b7 ${b.n} Schein${b.n === 1 ? "" : "e"}">
            <div class="vfill" style="height:${Math.max(2, Math.round((b.qm / maxQm) * 100))}%"></div>
            <div class="vxl">${zeigeLabel(b) ? escapeHtml(b.label) : ""}</div>
          </div>`).join("")}
      </div>
    </div>

    ${sel ? `
    <div class="card">
      <h2 style="margin:0 0 2px;">Top-Objekte \u00b7 ${escapeHtml(selLabel)}</h2>
      <p class="muted" style="margin:0 0 8px; font-size:12px;">${glasStatQmText(sel.qm)} qm \u00b7 ${sel.n} Schein${sel.n === 1 ? "" : "e"}${glasStatFirma !== "alle" ? " \u00b7 " + glasFirmaLabel(glasStatFirma === "sub" ? "sub" : "geko") : ""}</p>
      ${topObjekte.length ? topObjekte.map(([nameObj, wert], i) => `
        <div class="glas-rankrow">
          <span class="rp">${i + 1}.</span>
          <span class="rn">${escapeHtml(nameObj)}</span>
          <span class="rb"><i style="width:${Math.max(4, Math.round((wert / topMax) * 100))}%"></i></span>
          <span class="rv">${glasStatQmText(wert)} qm</span>
        </div>`).join("") : `<p class="muted" style="margin:6px 0 2px;">Keine Abnahmen in diesem Zeitraum.</p>`}
    </div>` : ""}
  `;
}

/* ============================================================================
   Jahresvorschau: fällige Objekte pro Monat (feste Monate + rollierende
   Intervalle als Vorschau), mit Status erledigt / geplant / offen.
   Ersetzt zusammen mit der Kunden-Ansicht die alte "Fällige"-Liste.
   ============================================================================ */
let glasJvMode = "monat";                 // "monat" | "jahr"
let glasJvMonat = new Date().getMonth() + 1;
const GLAS_JV_JAHR = new Date().getFullYear();
let glasJvDueCache = new Map();            // objekt_id -> Set faelliger Monate (pro Öffnen neu)
let glasJvStatusCache = new Map();         // objekt_id -> {monat: status} (pro Öffnen neu)
const GLAS_JV_TOLERANZ = 2;                // Monate Puffer: vorgezogene/nachgeholte Reinigung zählt
const GLAS_JV_KURZ = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function glasOpenJahr() {
  glasContentAnimPending = true;
  glasJvDueCache = new Map();
  glasJvStatusCache = new Map();
  glasJvMode = "monat";
  glasJvMonat = Math.min(12, new Date().getMonth() + 1);
  if (!glasStatistikDaten) loadGlasStatistik(); // liefert die "erledigt"-Info (unterschriebene Scheine)
  glasScrollTop();
  glasNavigate({ type: "jahr" });
}
function glasJvBack() { if (history.length > 1) history.back(); else goGlasTab("kalender"); }

// In welchen Monaten des Jahres wird das Objekt fällig? Feste Monate exakt, rollierende
// als Vorschau ab der letzten Reinigung (sonst ab Jahresanfang).
function glasJvDueMonths(o) {
  const set = new Set();
  glasGetObjektPositionen(o.id).forEach((p) => {
    if (glasIstStundenPos(p) || !p.intervall_typ) return;
    if (p.intervall_typ === "feste_monate") {
      String(p.feste_monate || "").split(",").map((x) => parseInt(x.trim(), 10)).filter((m) => m >= 1 && m <= 12).forEach((m) => set.add(m));
    } else if (p.intervall_typ === "rollierend") {
      const wk = parseInt(p.intervall_wochen, 10);
      if (wk > 0) {
        const startIso = p.letzte_reinigung || `${GLAS_JV_JAHR}-01-01`;
        const d = new Date(startIso + "T12:00:00Z");
        d.setUTCDate(d.getUTCDate() + wk * 7); // erste Fälligkeit NACH der letzten Reinigung
        let g = 0;
        while (d.getUTCFullYear() < GLAS_JV_JAHR && g++ < 800) d.setUTCDate(d.getUTCDate() + wk * 7);
        while (d.getUTCFullYear() === GLAS_JV_JAHR && g++ < 800) { set.add(d.getUTCMonth() + 1); d.setUTCDate(d.getUTCDate() + wk * 7); }
      }
    }
  });
  return set;
}
function glasJvDue(o) { if (!glasJvDueCache.has(o.id)) glasJvDueCache.set(o.id, glasJvDueMonths(o)); return glasJvDueCache.get(o.id); }

// Ordnet die tatsächlichen Reinigungen eines Objekts seinen fälligen Monaten zu -
// mit Toleranz (GLAS_JV_TOLERANZ Monate): eine im Nachbarmonat vorgezogene ODER
// nachgeholte Reinigung zählt für den fälligen Monat. Jede Reinigung wird nur EINEM
// fälligen Monat zugeordnet (nächstgelegener zuerst) -> monatliche Objekte werden nie
// doppelt gezählt. Die Intervall-Logik selbst bleibt komplett unberührt.
// Ergebnis je fälligem Monat: "done" | "plan" | "open" | "none" (vergangen, nicht erfasst).
function glasJvObjektStatusMap(o) {
  if (glasJvStatusCache.has(o.id)) return glasJvStatusCache.get(o.id);
  const due = [...glasJvDue(o)].sort((a, b) => a - b);
  // Reinigungs-Monate dieses Objekts im Jahr (evtl. mehrere)
  const clean = [];
  (glasStatistikDaten || []).forEach((s) => {
    if (s.objekt_id === o.id && s.datum && Number(s.datum.slice(0, 4)) === GLAS_JV_JAHR) {
      const mm = Number(s.datum.slice(5, 7));
      if (mm >= 1 && mm <= 12) clean.push(mm);
    }
  });
  // Paare (fälliger Monat, Reinigung) im Toleranzfenster, nach Abstand -> greedy zuordnen
  const paare = [];
  due.forEach((dm, di) => clean.forEach((cm, ci) => {
    const dist = Math.abs(dm - cm);
    if (dist <= GLAS_JV_TOLERANZ) paare.push({ di, ci, dist });
  }));
  paare.sort((a, b) => a.dist - b.dist || a.di - b.di || a.ci - b.ci);
  const dueDone = new Set(), cleanUsed = new Set();
  for (const p of paare) {
    if (dueDone.has(p.di) || cleanUsed.has(p.ci)) continue;
    dueDone.add(p.di); cleanUsed.add(p.ci);
  }
  const heute = new Date(), hM = heute.getMonth() + 1, hY = heute.getFullYear();
  const eingeplant = glasGetObjektPositionen(o.id).some(glasIstEingeplant);
  const map = {};
  due.forEach((dm, di) => {
    const past = (GLAS_JV_JAHR < hY) || (GLAS_JV_JAHR === hY && dm < hM);
    if (dueDone.has(di)) map[dm] = "done";
    else if (past) map[dm] = "none";       // vergangen ohne Aufzeichnung -> grau "nicht erfasst"
    else if (eingeplant) map[dm] = "plan";
    else map[dm] = "open";
  });
  glasJvStatusCache.set(o.id, map);
  return map;
}
function glasJvStatusOf(o, m) { return glasJvObjektStatusMap(o)[m] || "open"; }
function glasJvFirmaOk(k) { return glasKundenFirmaFilter === "alle" || (k.firma || "geko") === glasKundenFirmaFilter; }
function glasJvMonthStats(m) {
  let obj = 0, qm = 0; const st = { done: 0, plan: 0, open: 0, none: 0 }; const kun = new Set();
  glasObjekte.forEach((o) => {
    const k = glasKunden.find((x) => x.id === o.kunde_id);
    if (!k || !glasJvFirmaOk(k) || !glasJvDue(o).has(m)) return;
    obj++; kun.add(k.id); qm += glasObjektQm(o); st[glasJvStatusOf(o, m)]++;
  });
  return { obj, qm, st, kun: kun.size };
}
const GLAS_JV_STL = { done: ["✓ erledigt", "jv-done"], plan: ["📅 geplant", "jv-plan"], open: ['<span class="jv-ring"></span> offen', "jv-open"], none: ["– nicht erfasst", "jv-none"] };
function glasJvMini(st) {
  const p = [];
  if (st.done) p.push(`<span style="color:var(--jv-done); font-weight:700;">✓${st.done}</span>`);
  if (st.plan) p.push(`<span style="color:var(--jv-plan); font-weight:700;">📅${st.plan}</span>`);
  if (st.open) p.push(`<span style="color:var(--jv-open); font-weight:700;"><span class="jv-ring"></span>${st.open}</span>`);
  if (st.none) p.push(`<span style="color:var(--jv-none); font-weight:700;">–${st.none}</span>`);
  return p.join(" ");
}
// Kurzes Intervall-Label für die Jahresvorschau (NICHT die volle Monatsliste - die
// wurde bei monatlichen Objekten "Jan, Feb, … Dez" und überlappte die Kachel).
function glasJvIntervalInfo(o) {
  const ps = glasGetObjektPositionen(o.id).filter((p) => !glasIstStundenPos(p) && p.intervall_typ);
  if (!ps.length) return ["manuell", "var(--text-secondary)"];
  const p = ps[0];
  if (p.intervall_typ === "rollierend") {
    const w = parseInt(p.intervall_wochen, 10);
    return [w > 0 ? `alle ${w} Wo.` : "rollierend", "var(--jv-plan)"];
  }
  const n = Math.round(ps.reduce((a, q) => a + glasPosReinigungenProJahr(q), 0));
  const label = n >= 12 ? "monatlich" : n === 4 ? "quartalsweise" : `${n}×/Jahr`;
  const col = n >= 12 ? "var(--danger)" : n >= 4 ? "var(--blue)" : n >= 2 ? "var(--jv-done)" : "var(--text-secondary)";
  return [label, col];
}
function glasJvBadge(k) {
  return (k.firma || "geko") === "geko"
    ? `<span class="badge" style="background:var(--success-bg); color:var(--success-text); font-size:10px;">GEKO</span>`
    : `<span class="badge" style="background:var(--border); color:var(--text-secondary); font-size:10px;">Dietrich</span>`;
}

function renderJahrPage() {
  return `
    <button class="btn btn-sm" style="margin:16px 0;" onclick="glasJvBack()">&larr; Zurück</button>
    <h2 style="margin:0 0 2px;">Jahresvorschau <span class="muted" style="font-weight:600; font-size:16px;">${GLAS_JV_JAHR}</span></h2>
    <p class="muted" style="margin:0 0 12px; font-size:12.5px;">Fällige Objekte pro Monat – erledigt, geplant oder noch offen. Rollierende Intervalle sind eine Vorschau.</p>
    <div class="glas-seg" style="margin-bottom:8px;">
      <button class="glas-seg-btn ${glasJvMode === "monat" ? "on" : ""}" onclick="glasJvSetMode('monat')">📅 Monat</button>
      <button class="glas-seg-btn ${glasJvMode === "jahr" ? "on" : ""}" onclick="glasJvSetMode('jahr')">▦ Jahr</button>
    </div>
    <div class="glas-seg" style="margin-bottom:12px;">
      <button class="glas-seg-btn ${glasKundenFirmaFilter === "alle" ? "on" : ""}" onclick="glasJvSetFirma('alle')">Alle</button>
      <button class="glas-seg-btn ${glasKundenFirmaFilter === "geko" ? "on" : ""}" onclick="glasJvSetFirma('geko')">GEKO</button>
      <button class="glas-seg-btn ${glasKundenFirmaFilter === "sub" ? "on" : ""}" onclick="glasJvSetFirma('sub')">Dietrich</button>
    </div>
    <div id="glasJvContent">${glasJvMode === "monat" ? glasJvRenderMonat() : glasJvRenderJahr()}</div>`;
}

function glasJvRenderRail() {
  const counts = []; let max = 1;
  for (let i = 1; i <= 12; i++) { const c = glasJvMonthStats(i).obj; counts[i] = c; if (c > max) max = c; }
  return `<div class="jv-rail">` + Array.from({ length: 12 }, (_, i) => {
    const m = i + 1, c = counts[m];
    return `<div class="jv-chip ${m === glasJvMonat ? "on" : ""}" onclick="glasJvGoMonat(${m})"><div class="mo">${GLAS_JV_KURZ[i]}</div><div class="cnt">${c}</div><div class="load"><i style="width:${Math.round(c / max * 100)}%"></i></div></div>`;
  }).join("") + `</div>`;
}
function glasJvRenderBody() {
  const m = glasJvMonat, s = glasJvMonthStats(m);
  let list = "";
  glasKunden.forEach((k) => {
    if (!glasJvFirmaOk(k)) return;
    const due = glasObjekte.filter((o) => o.kunde_id === k.id && glasJvDue(o).has(m));
    if (!due.length) return;
    const local = { done: 0, plan: 0, open: 0, none: 0 }; due.forEach((o) => local[glasJvStatusOf(o, m)]++);
    const initials = (k.name.match(/[A-ZÄÖÜ0-9]/g) || ["G"]).slice(0, 2).join("");
    const orows = due.map((o) => {
      const [sl, sc] = GLAS_JV_STL[glasJvStatusOf(o, m)];
      const [ilbl, icol] = glasJvIntervalInfo(o);
      return `<div class="jv-orow" style="cursor:pointer;" onclick="goGlasObjekt('${o.id}')"><span class="jv-obar" style="background:${icol}"></span><div class="jv-oinfo"><div class="jv-oname">${escapeHtml(o.name)}</div><div class="jv-oqm">${glasStatQmText(glasObjektQm(o))} m² <span class="jv-spill ${sc}">${sl}</span></div></div><span class="jv-ichip">${escapeHtml(ilbl)}</span><span class="jv-orow-arr">›</span></div>`;
    }).join("");
    list += `<div class="jv-kg"><div class="jv-khead" onclick="glasJvToggleK(this)"><div class="jv-kav">${escapeHtml(initials)}</div><div class="jv-kmeta"><div class="jv-kname">${escapeHtml(k.name)}</div><div class="jv-ksub">${due.length} ${due.length === 1 ? "Objekt" : "Objekte"} ${glasJvMini(local)}</div></div>${glasJvBadge(k)}<span class="jv-kcount">${due.length}</span><span class="jv-chev">▾</span></div><div class="jv-objs"><div class="jv-objs-in">${orows}</div></div></div>`;
  });
  if (!list) list = `<p class="muted" style="text-align:center; padding:34px 0;">In diesem Monat steht nichts an. 🎉</p>`;
  return `
    <div class="jv-mhead"><button class="jv-nav" onclick="glasJvStep(-1)">‹</button><h2>${GLAS_MONATE_LANG[m - 1]} ${GLAS_JV_JAHR}</h2><button class="jv-nav" onclick="glasJvStep(1)">›</button></div>
    <div class="jv-tiles"><div class="jv-tile"><div class="n a">${s.obj}</div><div class="l">Objekte fällig</div></div><div class="jv-tile"><div class="n">${s.kun}</div><div class="l">Kunden</div></div><div class="jv-tile"><div class="n">${glasStatQmText(s.qm)}</div><div class="l">m² Reinigung</div></div></div>
    <div class="jv-sbar"><span class="jv-sb jv-done">✓ ${s.st.done} erledigt</span><span class="jv-sb jv-plan">📅 ${s.st.plan} geplant</span><span class="jv-sb jv-open"><span class="jv-ring"></span> ${s.st.open} offen</span>${s.st.none ? `<span class="jv-sb jv-none">– ${s.st.none} nicht erfasst</span>` : ""}</div>
    ${list}`;
}
function glasJvRenderMonat() { return glasJvRenderRail() + `<div id="glasJvBody">${glasJvRenderBody()}</div>`; }

function glasJvRenderJahr() {
  const data = []; let max = 1;
  for (let i = 1; i <= 12; i++) { const s = glasJvMonthStats(i); data[i] = s; if (s.obj > max) max = s.obj; }
  const heuteM = new Date().getMonth() + 1, isNow = (GLAS_JV_JAHR === new Date().getFullYear());
  const legend = `<div class="jv-legend"><span><i class="jv-ldot" style="background:var(--jv-done)"></i>erledigt</span><span><i class="jv-ldot" style="background:var(--jv-plan)"></i>geplant</span><span><i class="jv-ldot" style="background:var(--jv-open)"></i>offen</span><span><i class="jv-ldot" style="background:var(--jv-none)"></i>nicht erfasst</span></div>`;
  const grid = `<div class="jv-grid">` + Array.from({ length: 12 }, (_, i) => {
    const m = i + 1, { obj, st } = data[m];
    const now = isNow && m === heuteM ? `<span class="jv-ynow">jetzt</span>` : "";
    if (!obj) return `<button class="jv-ytile zero" style="animation-delay:${i * 0.03}s" onclick="glasJvJump(${m})">${now}<div class="jv-ytm">${GLAS_MONATE_LANG[i]}</div><div class="jv-ytn">–</div><div class="jv-ytl">nichts fällig</div></button>`;
    const seg = (v, c) => v ? `<i style="flex:${v};background:${c}"></i>` : "";
    const heavy = obj >= max * 0.75;
    return `<button class="jv-ytile ${heavy ? "heavy" : ""}" style="animation-delay:${i * 0.03}s" onclick="glasJvJump(${m})">${now}<div class="jv-ytm">${GLAS_MONATE_LANG[i]}</div><div class="jv-ytn">${obj}</div><div class="jv-ytl">Objekte fällig</div><div class="jv-ystack">${seg(st.done, "var(--jv-done)")}${seg(st.plan, "var(--jv-plan)")}${seg(st.open, "var(--jv-open)")}${seg(st.none, "var(--jv-none)")}</div><div class="jv-ycounts"><b style="color:var(--jv-done)">✓${st.done}</b><b style="color:var(--jv-plan)">📅${st.plan}</b><b style="color:var(--jv-open)"><span class="jv-ring"></span>${st.open}</b>${st.none ? `<b style="color:var(--jv-none)">–${st.none}</b>` : ""}</div></button>`;
  }).join("") + `</div>`;
  return legend + grid;
}

function glasJvSetMode(x) { glasJvMode = x; renderGlasAdmin(); }
function glasJvSetFirma(f) { glasKundenFirmaFilter = f; renderGlasAdmin(); }
function glasJvToggleK(el) { el.parentNode.classList.toggle("open"); }
function glasJvGoMonat(m) { const d = Math.sign(m - glasJvMonat); glasJvMonat = m; glasJvUpdateMonat(d); }
function glasJvStep(d) { glasJvMonat = ((glasJvMonat - 1 + d) + 12) % 12 + 1; glasJvUpdateMonat(d); }
function glasJvJump(m) { glasJvMode = "monat"; glasJvMonat = m; renderGlasAdmin(); }
function glasJvUpdateMonat(dir) {
  const body = document.getElementById("glasJvBody");
  if (!body) { renderGlasAdmin(); return; }
  body.innerHTML = glasJvRenderBody();
  body.classList.remove("jv-anim-l", "jv-anim-r"); void body.offsetWidth;
  if (dir) body.classList.add(dir > 0 ? "jv-anim-l" : "jv-anim-r");
  document.querySelectorAll(".jv-chip").forEach((el, i) => el.classList.toggle("on", i + 1 === glasJvMonat));
  const on = document.querySelector(".jv-chip.on"); if (on) on.scrollIntoView({ inline: "center", block: "nearest" });
}

glasInit();
