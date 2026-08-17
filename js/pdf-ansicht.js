// ===========================================================================
// GEKO · Hausinterner PDF-Viewer
// ===========================================================================
// Zeigt ein PDF IN der App an, statt es nach draußen zu öffnen. Nötig, weil
// window.open in der installierten iPhone-App je nach iOS-Version ins Leere
// führt oder die App verlässt - für Lohnabrechnungen inakzeptabel.
//
// Die eigentliche Darstellung übernimmt pdf.js (Mozilla, rendert auf Canvas,
// läuft überall). Die Bibliothek wird ERST beim ersten Öffnen geladen -
// ~1 MB, die niemand beim App-Start bezahlen soll. Der Service Worker legt
// sie danach in den Zwischenspeicher, ab dann öffnet der Viewer auch mit
// schlechtem Empfang.
//
// Aufruf:  gekoPdfZeigen(url, "August 2026")
// Fallback: schlägt das Laden der Bibliothek fehl, geht es wie bisher über
// window.open - besser draußen angezeigt als gar nicht.

const GEKO_PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const GEKO_PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

let _gekoPdfLib = null;      // Ladeversprechen der Bibliothek
let _gekoPdfDoc = null;      // aktuell offenes Dokument
let _gekoPdfZoom = 1;        // 1 = Seitenbreite
let _gekoPdfUrl = "";        // Quelle des offenen PDFs (fuer Sichern/Teilen)
let _gekoPdfTitel = "";      // Ueberschrift, wird zum Dateinamen

function _gekoPdfBibliothek() {
  if (_gekoPdfLib) return _gekoPdfLib;
  _gekoPdfLib = new Promise((erfuellt, gescheitert) => {
    const s = document.createElement("script");
    s.src = GEKO_PDFJS;
    s.onload = () => {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = GEKO_PDFJS_WORKER;
        erfuellt(window.pdfjsLib);
      } catch (e) { gescheitert(e); }
    };
    s.onerror = () => gescheitert(new Error("pdf.js nicht ladbar"));
    document.head.appendChild(s);
  });
  // Fehlgeschlagenes Laden nicht einfrieren - naechster Versuch darf neu laden
  _gekoPdfLib.catch(() => { _gekoPdfLib = null; });
  return _gekoPdfLib;
}

async function gekoPdfZeigen(url, titel) {
  _gekoPdfUrl = url;
  _gekoPdfTitel = titel || "Dokument";
  // Overlay sofort zeigen, damit der Tipp SPUERBAR etwas tut - gerendert
  // wird hinein, sobald Bibliothek und Datei da sind.
  _gekoPdfOverlay(_gekoPdfTitel);
  try {
    const lib = await _gekoPdfBibliothek();
    _gekoPdfDoc = await lib.getDocument({ url }).promise;
    _gekoPdfZoom = 1;
    await _gekoPdfRendern();
  } catch (e) {
    gekoPdfSchliessen();
    try { window.open(url, "_blank"); } catch (e2) {}
  }
}

function _gekoPdfOverlay(titel) {
  gekoPdfSchliessen();
  const o = document.createElement("div");
  o.id = "gekoPdfOverlay";
  o.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;"
    + "background:#20262e;";
  o.innerHTML = `
    <div style="flex:none;display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 10px) 14px 10px;background:#141920;color:#fff;">
      <b style="flex:1;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${String(titel).replace(/[<>&]/g, "")}</b>
      <button id="gekoPdfMinus" style="border:0;background:rgba(255,255,255,.12);color:#fff;border-radius:9px;padding:7px 13px;font-size:16px;font-weight:700;cursor:pointer;" aria-label="Kleiner">−</button>
      <button id="gekoPdfPlus" style="border:0;background:rgba(255,255,255,.12);color:#fff;border-radius:9px;padding:7px 13px;font-size:16px;font-weight:700;cursor:pointer;" aria-label="Größer">＋</button>
      <button id="gekoPdfSichern" style="border:0;background:rgba(255,255,255,.12);color:#fff;border-radius:9px;padding:7px 12px;font-size:15px;cursor:pointer;" aria-label="Sichern oder teilen">⤓</button>
      <button id="gekoPdfZu" style="border:0;background:rgba(255,255,255,.12);color:#fff;border-radius:9px;padding:7px 12px;font-size:15px;cursor:pointer;">✕</button>
    </div>
    <div id="gekoPdfRolle" style="flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:12px;">
      <p style="color:#9aa7b4;text-align:center;font-size:14px;margin-top:40px;">
        <span style="display:inline-block;width:16px;height:16px;border:2px solid #9aa7b4;border-top-color:transparent;border-radius:50%;animation:gekoPdfDreh .8s linear infinite;vertical-align:-3px;margin-right:8px;"></span>
        PDF wird geladen …</p>
    </div>
    <style>@keyframes gekoPdfDreh { to { transform: rotate(360deg); } }</style>`;
  document.body.appendChild(o);
  document.getElementById("gekoPdfZu").onclick = gekoPdfSchliessen;
  document.getElementById("gekoPdfSichern").onclick = gekoPdfSichern;
  document.getElementById("gekoPdfPlus").onclick = () => _gekoPdfZoomAendern(0.25);
  document.getElementById("gekoPdfMinus").onclick = () => _gekoPdfZoomAendern(-0.25);
}

function _gekoPdfZoomAendern(schritt) {
  _gekoPdfZoom = Math.min(3, Math.max(0.5, _gekoPdfZoom + schritt));
  _gekoPdfRendern();
}

async function _gekoPdfRendern() {
  const rolle = document.getElementById("gekoPdfRolle");
  if (!rolle || !_gekoPdfDoc) return;
  rolle.innerHTML = "";
  const breite = (rolle.clientWidth - 24) * _gekoPdfZoom;
  // dpr fuer scharfe Schrift: gerendert wird groesser, angezeigt in CSS-Breite
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  for (let nr = 1; nr <= _gekoPdfDoc.numPages; nr++) {
    const seite = await _gekoPdfDoc.getPage(nr);
    const basis = seite.getViewport({ scale: 1 });
    const scale = (breite / basis.width) * dpr;
    const vp = seite.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = vp.width;
    canvas.height = vp.height;
    canvas.style.cssText = `display:block;width:${Math.round(vp.width / dpr)}px;height:${Math.round(vp.height / dpr)}px;`
      + "margin:0 auto 12px;background:#fff;border-radius:6px;box-shadow:0 2px 14px rgba(0,0,0,.35);";
    rolle.appendChild(canvas);
    await seite.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    if (!document.getElementById("gekoPdfRolle")) return;  // inzwischen geschlossen
  }
}

// Sichern bzw. teilen. Auf dem iPhone ist ein Download-Link der falsche
// Weg: In der installierten App tut <a download> schlicht nichts. Richtig
// ist dort das System-Teilen-Blatt ("In Dateien sichern", weiterleiten,
// drucken). Am Rechner bleibt es beim gewohnten Download.
async function gekoPdfSichern() {
  const knopf = document.getElementById("gekoPdfSichern");
  const zurueck = knopf ? knopf.textContent : "";
  if (knopf) { knopf.disabled = true; knopf.textContent = "…"; }
  // Dateiname aus der Überschrift - alles, was Dateisysteme stört, raus.
  const name = (String(_gekoPdfTitel || "Dokument")
    .replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Dokument") + ".pdf";
  try {
    const antwort = await fetch(_gekoPdfUrl);
    if (!antwort.ok) throw new Error("Laden fehlgeschlagen");
    const blob = await antwort.blob();
    const datei = new File([blob], name, { type: "application/pdf" });

    // 1. Wahl: System-Teilen-Blatt (iPhone, Android)
    if (navigator.canShare && navigator.canShare({ files: [datei] }) && navigator.share) {
      try {
        await navigator.share({ files: [datei], title: _gekoPdfTitel });
        return;                       // fertig - oder vom Nutzer abgebrochen
      } catch (e) {
        // Abbruch ist kein Fehler; bei allem anderen weiter zum Download
        if (e && e.name === "AbortError") return;
      }
    }
    // 2. Wahl: klassischer Download (Rechner, Android-Browser)
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (e) {
    // 3. Wahl: im Browser oeffnen, dort kann man ueber Teilen sichern
    try { window.open(_gekoPdfUrl, "_blank"); } catch (e2) {}
  } finally {
    if (knopf) { knopf.disabled = false; knopf.textContent = zurueck || "⤓"; }
  }
}

function gekoPdfSchliessen() {
  const o = document.getElementById("gekoPdfOverlay");
  if (o) o.remove();
  _gekoPdfDoc = null;
  _gekoPdfUrl = "";
  _gekoPdfTitel = "";
}
