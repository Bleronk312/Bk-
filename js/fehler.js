// ============================================================================
// Flugschreiber – zeichnet Programmfehler auf, damit "geht nicht" zu einer
// konkreten Meldung wird (welche Version, welches Gerät, welche Zeile).
//
// Grundregeln, an die sich diese Datei strikt hält:
//   1. Sie darf die App NIE stören. Alles läuft in try/catch; schlägt das
//      Aufzeichnen fehl, passiert einfach nichts.
//   2. Sie funktioniert OHNE Internet: Fehler landen zuerst im Gerät selbst
//      (localStorage). Erst wenn eine Verbindung da ist, gehen sie zusätzlich
//      in die Datenbank – klappt das nicht, bleiben sie lokal liegen.
//   3. Sie speichert KEINE Passwörter und keine Formularinhalte – nur was zum
//      Finden des Fehlers nötig ist.
//   4. Sie kann sich nicht selbst hochschaukeln: gleiche Fehler werden
//      zusammengefasst, pro Seitenaufruf ist bei 12 Einträgen Schluss.
// ============================================================================

const GEKO_FEHLER_KEY = "geko_fehler";   // lokaler Speicher (Ringpuffer)
const GEKO_FEHLER_MAX = 30;              // so viele Fehler bleiben auf dem Gerät
const GEKO_FEHLER_PRO_AUFRUF = 12;       // Notbremse gegen Endlos-Schleifen
let gekoFehlerGezaehlt = 0;
let gekoFehlerSendeLaeuft = false;

// ---- kleine Helfer (bewusst ohne Abhängigkeit zu anderen Dateien) ----
function gekoFehlerListe() {
  try { return JSON.parse(localStorage.getItem(GEKO_FEHLER_KEY) || "[]"); } catch (e) { return []; }
}
function gekoFehlerSpeichern(liste) {
  try { localStorage.setItem(GEKO_FEHLER_KEY, JSON.stringify(liste.slice(-GEKO_FEHLER_MAX))); } catch (e) {}
}

// Welche App läuft gerade? (aus dem Dateinamen der Seite)
function gekoFehlerApp() {
  try {
    const p = (location.pathname.split("/").pop() || "hub").replace(".html", "") || "hub";
    return p;
  } catch (e) { return "?"; }
}

// Version aus einer beliebigen versionierten Script-URL (…?v=NN).
function gekoFehlerVersion() {
  try {
    const s = document.querySelector('script[src*="?v="]');
    const m = s && s.src.match(/[?&]v=(\d+)/);
    return m ? "v" + m[1] : "";
  } catch (e) { return ""; }
}

// Grobe Geräte-Kennung – reicht zum Einordnen, ist keine Personen-Kennung.
function gekoFehlerGeraet() {
  try {
    const ua = navigator.userAgent || "";
    let os = "?";
    if (/iPhone|iPad|iPod/.test(ua)) {
      const v = ua.match(/OS (\d+)[._](\d+)/);
      os = "iOS" + (v ? " " + v[1] + "." + v[2] : "");
    } else if (/Android/.test(ua)) {
      const v = ua.match(/Android (\d+)/);
      os = "Android" + (v ? " " + v[1] : "");
    } else if (/Windows/.test(ua)) os = "Windows";
    else if (/Mac/.test(ua)) os = "Mac";
    const standalone = (window.navigator.standalone === true) ||
      (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
    return os + (standalone ? " · Home-Bildschirm" : " · Browser");
  } catch (e) { return "?"; }
}

// Wer ist angemeldet? Nur Anzeigename/Benutzername – NIE Passwörter.
function gekoFehlerBenutzer() {
  try {
    for (const k of ["geko_ci_auth", "geko_ma_auth", "geko_glas_auth"]) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const o = JSON.parse(raw);
      if (o && (o.name || o.username)) return (o.name || o.username) + " (" + k.replace("geko_", "").replace("_auth", "") + ")";
    }
  } catch (e) {}
  return "";
}

// ---- Kern: einen Fehler aufzeichnen ----
function gekoFehlerMerken(meldung, quelle, stack) {
  try {
    if (gekoFehlerGezaehlt >= GEKO_FEHLER_PRO_AUFRUF) return;
    gekoFehlerGezaehlt++;
    const txt = String(meldung || "").slice(0, 400);
    if (!txt) return;
    const liste = gekoFehlerListe();
    // Gleicher Fehler auf derselben Seite? Nur hochzählen statt neu anlegen.
    const gleich = liste.find((f) => f.meldung === txt && f.seite === gekoFehlerApp());
    if (gleich) {
      gleich.anzahl = (gleich.anzahl || 1) + 1;
      gleich.ts = new Date().toISOString();
      gleich.gesendet = false;
      gekoFehlerSpeichern(liste);
      return;
    }
    liste.push({
      id: (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
      ts: new Date().toISOString(),
      seite: gekoFehlerApp(),
      version: gekoFehlerVersion(),
      benutzer: gekoFehlerBenutzer(),
      geraet: gekoFehlerGeraet(),
      meldung: txt,
      quelle: String(quelle || "").slice(0, 200),
      stack: String(stack || "").split("\n").slice(0, 4).join(" | ").slice(0, 600),
      online: navigator.onLine !== false,
      anzahl: 1,
      gesendet: false,
    });
    gekoFehlerSpeichern(liste);
    gekoFehlerSenden();
  } catch (e) { /* der Flugschreiber darf niemals selbst Ärger machen */ }
}

// ---- Noch nicht übertragene Fehler in die Datenbank schieben ----
// Fehlt die Tabelle oder ist kein Netz da, bleibt alles lokal liegen und wird
// beim nächsten Öffnen erneut versucht.
async function gekoFehlerSenden() {
  if (gekoFehlerSendeLaeuft) return;
  gekoFehlerSendeLaeuft = true;
  try {
    if (typeof sb === "undefined" || !sb || navigator.onLine === false) return;
    const liste = gekoFehlerListe();
    const offen = liste.filter((f) => !f.gesendet).slice(0, 10);
    if (!offen.length) return;
    const rows = offen.map((f) => ({
      id: f.id, ts: f.ts, seite: f.seite, version: f.version, benutzer: f.benutzer,
      geraet: f.geraet, meldung: f.meldung, quelle: f.quelle, stack: f.stack,
      online: f.online, anzahl: f.anzahl,
    }));
    // Bewusst insert und NICHT upsert: ein "on conflict"-Zugriff verlangt Leserecht
    // auf die Tabelle, und das hat ein Mitarbeiter nicht (Fehlerprotokolle sind
    // Verwaltungssache). Mit upsert kam von jedem Mitarbeiter-Gerät nur eine
    // Ablehnung zurück - der Flugschreiber war also genau dort blind, wo man am
    // wenigsten hinschauen kann. Die Kennung wird pro Vorfall neu gewürfelt, ein
    // Zusammenstoß ist praktisch ausgeschlossen; kommt er doch vor (erneuter
    // Sendeversuch einer schon angekommenen Zeile), ist die Zeile ja bereits da -
    // Fehlercode 23505 zählt deshalb als erledigt.
    const { error } = await sb.from("app_fehler").insert(rows);
    if (!error || error.code === "23505") {
      offen.forEach((f) => { const t = liste.find((x) => x.id === f.id); if (t) t.gesendet = true; });
      gekoFehlerSpeichern(liste);
    }
  } catch (e) {
  } finally { gekoFehlerSendeLaeuft = false; }
}

// ---- Aufzeichnung starten ----
(function () {
  try {
    window.addEventListener("error", (e) => {
      // Fehler beim Laden von Bildern/Skripten haben kein .error-Objekt
      if (e && e.target && e.target !== window && e.target.src) {
        gekoFehlerMerken("Datei konnte nicht geladen werden: " + e.target.src, "laden", "");
        return;
      }
      gekoFehlerMerken(
        (e && e.message) || "Unbekannter Fehler",
        e && e.filename ? e.filename.split("/").pop() + ":" + e.lineno : "",
        e && e.error && e.error.stack
      );
    }, true);

    window.addEventListener("unhandledrejection", (e) => {
      const r = e && e.reason;
      gekoFehlerMerken(
        (r && (r.message || r)) || "Abgelehnte Zusage (unhandled rejection)",
        "promise",
        r && r.stack
      );
    });

    // Beim Start und sobald wieder Netz da ist: liegengebliebene Fehler nachreichen
    window.addEventListener("online", () => setTimeout(gekoFehlerSenden, 1200));
    document.addEventListener("DOMContentLoaded", () => setTimeout(gekoFehlerSenden, 2500));
  } catch (e) {}
})();
