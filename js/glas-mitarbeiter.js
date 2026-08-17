document.title = "Glasreinigung - Meine Touren";

(function initGlasHeader() {
  const wm = document.getElementById("watermarkImg");
  const badge = document.getElementById("badgeLogoImg");
  if (typeof GEKO_LOGO_TRANSPARENT_B64 !== "undefined") {
    if (wm) wm.src = GEKO_LOGO_TRANSPARENT_B64;
    if (badge) badge.src = GEKO_LOGO_TRANSPARENT_B64;
  }
})();

let glasTouren = [];
// Startet direkt in der Tourenliste: GEKO One ist jetzt die Startseite, eine zweite
// Begrüßungsseite davor wäre doppelt gemoppelt.
let glasMaScreen = "touren"; // "touren" | "home" (alte Logo-Startseite, nicht mehr angesteuert)
let glasOpenTourId = null; // gerade geöffnete Tour im Vollbild (ersetzt die Liste)
let glasOpenStopId = null; // aufgeklappter Stopp (Akkordeon)
let glasSignStopId = null; // Stopp, bei dem gerade das Unterschrift-Formular offen ist
let glasSigPad = null;
let glasFrueherExpanded = false; // "Frühere Touren"-Abschnitt aufgeklappt
// false, solange noch NIE Touren geladen wurden (weder aus dem Netz noch aus dem
// Speicher). Nur dann zeigt die Liste ein Ladebild statt "Noch keine Tour für dich".
let glasTourenGeladen = false;

// ---------------- Login ----------------
const GLAS_AUTH_KEY = "geko_ma_auth";
let glasCurrentUser = null; // {id, name, username} des angemeldeten Mitarbeiters



// Link zur Installations-Anleitung – nur im Browser sichtbar. Wer die App schon vom
// Home-Bildschirm nutzt, sieht ihn nie. Spart im Büro das ständige "kannst du mir das
// aufs neue Handy machen?".
function glasAppLinkKarte() {
  const alsApp = navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
  if (alsApp) return "";
  return `<a href="install.html" style="display:flex; align-items:center; gap:11px; text-decoration:none;
      max-width:340px; margin:16px auto 0; background:var(--card); border:1px solid var(--border); border-radius:14px;
      padding:13px 15px; box-shadow:0 2px 10px rgba(16,42,67,.07); text-align:left;">
    <span style="font-size:24px; flex:none;">📲</span>
    <span style="flex:1; min-width:0;">
      <span style="display:block; font-size:14.5px; font-weight:700; color:var(--text);">App aufs Handy holen</span>
      <span style="display:block; font-size:12.5px; color:var(--text-secondary); margin-top:2px;">Eigenes Symbol statt Browser · 1 Minute</span>
    </span>
    <span style="font-size:18px; color:var(--text-secondary); flex:none;">›</span>
  </a>`;
}

function todayIso() {
  const d = new Date(); // lokale Zeit - toISOString() wäre UTC und nachts einen Tag daneben
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

async function glasMaInit() {
  const ok = await glasEnsureLoggedIn();
  if (!ok) return; // Es läuft der Login-Screen
  // Zuletzt gespeicherte Touren SOFORT anzeigen - dadurch steht die Liste beim Öffnen
  // ohne Wartezeit da, statt kurz "Noch keine Tour für dich" zu zeigen und sie zwei
  // Sekunden später nachzuladen. Im Hintergrund wird trotzdem aktualisiert.
  const cached = glasLoadTourenCache();
  if (cached && cached.length) glasTouren = glasOhneAlteFertigeTouren(cached);
  renderGlasMa();
  await glasFlushSignQueue(); // eventuell offline gesammelte Unterschriften zuerst nachsenden
  await loadGlasTouren();
  glasOeffneTourAusLink(); // aus GEKO One direkt in eine bestimmte Tour springen
  renderGlasMa();
}

// Wird die App mit "?tour=ID" geöffnet (z.B. per Klick im GEKO-One-Kalender), springt
// sie direkt in DIESE Tour statt nur in die Tourenliste. Gibt es die Tour nicht (mehr),
// bleibt es bei der Liste plus kurzem Hinweis - nie eine leere Seite.
function glasOeffneTourAusLink() {
  let id = null;
  try { id = new URLSearchParams(location.search).get("tour"); } catch (e) {}
  if (!id) return;
  // Parameter aus der Adresszeile entfernen, damit ein späteres Neuladen bzw. der
  // Zurück-Knopf nicht immer wieder in dieselbe Tour zurückspringt.
  try { history.replaceState(null, "", location.pathname); } catch (e) {}
  if (glasTouren.find((t) => t.id === id)) {
    glasOpenTourId = id;
    glasMaScreen = "touren";
  } else {
    showToast("Diese Tour ist nicht mehr verfügbar.");
  }
}

// Prüft die gespeicherte Anmeldung. Rückgabe true = angemeldet, weiter mit der App.
// WICHTIG (bugfrei nach Wunsch): einmal angemeldet, bleibt man angemeldet - rausgeworfen
// wird NUR, wenn der Account online nachweislich gesperrt/gelöscht ist. Bei fehlendem
// Netz (Objekt ohne Empfang) NIE ausloggen, sonst blockiert das Unterschreiben.
async function glasEnsureLoggedIn() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(GLAS_AUTH_KEY) || "null"); } catch (e) {}
  if (!stored || !stored.id || !stored.tok) { glasRenderLogin(); return false; }
  try {
    const { data, error } = await sb.from("glas_mitarbeiter")
      .select("id, name, username, pass_hash, login_aktiv, zugang_glas").eq("id", stored.id).maybeSingle();
    if (error) throw error; // Netz-/Serverfehler -> offline vertrauen (catch unten)
    if (!data || data.login_aktiv === false || !data.username) { glasLogout(); return false; } // gesperrt/gelöscht
    if (data.zugang_glas === false) { glasLogout(); return false; } // für Glas gesperrt (nur wenn ausdrücklich)
    const tok = await gekoSessionTok(data.id, data.pass_hash);
    if (tok !== stored.tok) { glasLogout(); return false; } // Passwort geändert -> neu anmelden
    glasCurrentUser = { id: data.id, name: data.name, username: data.username };
    stored.name = data.name;
    try { localStorage.setItem(GLAS_AUTH_KEY, JSON.stringify(stored)); } catch (e) {}
    return true;
  } catch (e) {
    // Kein Netz: der zuletzt gespeicherten Anmeldung vertrauen (nicht ausloggen)
    glasCurrentUser = { id: stored.id, name: stored.name || "", username: stored.username || "" };
    return true;
  }
}

function glasRenderLogin(fehler) {
  const view = document.getElementById("view");
  if (!view) return;
  glasCurrentUser = null;
  view.innerHTML = `
    <div class="glas-login">
      <p class="glas-login-title">Anmelden</p>
      <p class="glas-login-sub">Melde dich mit deinem Benutzernamen an. Du bleibst danach angemeldet.</p>
      ${fehler ? `<div class="glas-login-err">${escapeHtml(fehler)}</div>` : ""}
      <div class="field"><label class="muted">Benutzername</label>
        <input type="text" id="login_user" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" style="font-size:16px;" /></div>
      <div class="field"><label class="muted">Passwort</label>
        <input type="password" id="login_pass" autocomplete="current-password" style="font-size:16px;" /></div>
      <button class="btn btn-primary" id="login_btn" style="width:100%; justify-content:center; padding:14px; font-size:16px; margin-top:6px;" onclick="glasDoLogin()">Anmelden</button>
    </div>`;
  const pass = document.getElementById("login_pass");
  if (pass) pass.addEventListener("keydown", (e) => { if (e.key === "Enter") glasDoLogin(); });
}

async function glasDoLogin() {
  const userEl = document.getElementById("login_user");
  const passEl = document.getElementById("login_pass");
  const user = (userEl ? userEl.value : "").trim().toLowerCase();
  const pass = passEl ? passEl.value : "";
  if (!user || !pass) { glasRenderLogin("Bitte Benutzername und Passwort eingeben."); return; }
  const btn = document.getElementById("login_btn");
  if (btn) { btn.disabled = true; btn.textContent = "Prüfe…"; }
  try {
    const { data, error } = await sb.from("glas_mitarbeiter")
      .select("id, name, username, pass_hash, pass_salt, login_aktiv, zugang_glas").eq("username", user).maybeSingle();
    if (error) throw error;
    if (!data || !data.username || !data.pass_hash) { glasRenderLogin("Benutzername oder Passwort falsch."); return; }
    if (data.login_aktiv === false) { glasRenderLogin("Dieser Zugang ist gesperrt. Bitte im Büro melden."); return; }
    if (data.zugang_glas === false) { glasRenderLogin("Für diesen Zugang ist die Glas-App nicht freigeschaltet. Bitte im Büro melden."); return; }
    const h = await gekoHashPw(pass, data.pass_salt || "");
    if (h !== data.pass_hash) { glasRenderLogin("Benutzername oder Passwort falsch."); return; }
    const tok = await gekoSessionTok(data.id, data.pass_hash);
    try { localStorage.setItem(GLAS_AUTH_KEY, JSON.stringify({ id: data.id, tok, name: data.name, username: data.username })); } catch (e) {}
    glasCurrentUser = { id: data.id, name: data.name, username: data.username };
    glasMaInit();
  } catch (e) {
    glasRenderLogin("Keine Verbindung. Bitte Internet prüfen und erneut versuchen.");
  }
}

function glasLogout() {
  try { localStorage.removeItem(GLAS_AUTH_KEY); } catch (e) {}
  glasCurrentUser = null;
  glasMaScreen = "home";
  glasOpenTourId = null; glasOpenStopId = null;
  glasRenderLogin();
}

// ---------------- Offline-Unterschriften ----------------
// Im Objekt ist oft kein Empfang. Unterschriften werden dann lokal in einer Warteschlange
// gesichert und automatisch gesendet, sobald wieder Netz da ist. Der Stopp erscheint sofort
// als erledigt (mit Hinweis "wird gesendet"), damit der Mitarbeiter weitermachen kann.

function glasLoadSignQueue() {
  try { return JSON.parse(localStorage.getItem("glas_pending_signs") || "[]"); } catch (e) { return []; }
}

function glasSaveSignQueue(q) {
  try { localStorage.setItem("glas_pending_signs", JSON.stringify(q)); } catch (e) {}
}

function glasQueueSign(item) {
  const q = glasLoadSignQueue();
  q.push(item);
  glasSaveSignQueue(q);
}

// supabase-js WIRFT bei Netzproblemen nicht, sondern gibt den Fehler zurück - deshalb
// hier unterscheiden: Netzfehler -> offline zwischenspeichern; echte Server-Antwort
// (z.B. Constraint/RLS) -> Fehler anzeigen, NICHT als "gespeichert" ausgeben.
function glasIstNetzFehler(err) {
  const m = String((err && err.message) || err || "").toLowerCase();
  return m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed")
    || m.includes("fetch failed") || m.includes("network request failed") || m.includes("timeout")
    || m.includes("abgebrochen") || m.includes("internet");
}

// Legt die noch nicht gesendeten Unterschriften über die geladenen Touren, damit die
// Stopps auch nach einem Neuladen als erledigt erscheinen, bis sie wirklich in der DB sind.
function glasApplyPendingSigns() {
  const q = glasLoadSignQueue();
  if (!q.length) return;
  for (const item of q) {
    for (const t of glasTouren) {
      const stop = t.stopps.find((s) => s.id === item.stopId);
      if (stop) Object.assign(stop, { name: item.name, datum: item.datum, unterschrift: item.unterschrift, zusatz: item.zusatz, positionen: item.positionen || stop.positionen, status: "erledigt", signed_at: item.signedAt, erfasst_von: item.erfasstVon || stop.erfasst_von, __pendingSync: true });
    }
  }
}

// Sendet die Warteschlange ab. Nur bei Erfolg wird ein Eintrag entfernt.
async function glasFlushSignQueue() {
  let q = glasLoadSignQueue();
  if (!q.length) return;
  const remaining = [];
  let sent = 0;
  for (const item of q) {
    try {
      const { error } = await glasSignStop(item.stopId, item.positionen, item.name, item.datum, item.unterschrift, item.zusatz, item.signedAt, item.erfasstVon);
      if (error) { remaining.push(item); } else {
        sent++;
        // Büro benachrichtigen - genauso wie bei einer direkt online erfassten Unterschrift
        glasPushUnterschriftAnAdmin({ objekt: item.objekt }, item.name, item.zusatz, item.tour);
      }
    } catch (e) { remaining.push(item); }
  }
  glasSaveSignQueue(remaining);
  if (sent > 0) showToast(sent === 1 ? "Offline-Unterschrift wurde gesendet" : `${sent} Offline-Unterschriften wurden gesendet`);
}

// Nachsenden anstoßen (Warteschlange leeren + Ansicht auffrischen). Wird an mehreren
// Stellen ausgelöst, damit die Unterschriften zuverlässig im Büro ankommen, ohne dass
// der Mitarbeiter etwas tun muss.
let glasFlushLaeuft = false;
async function glasTrySync() {
  if (glasFlushLaeuft || !navigator.onLine) return;
  if (!glasLoadSignQueue().length) return;
  glasFlushLaeuft = true;
  try {
    await glasFlushSignQueue();
    await loadGlasTouren();
    renderGlasMa();
  } finally {
    glasFlushLaeuft = false;
  }
}

// 1) Sobald das Gerät wieder online meldet.
window.addEventListener("online", glasTrySync);
// 2) Sobald die App wieder in den Vordergrund kommt (z.B. Mitarbeiter ist zurück im Büro
//    und holt das Handy raus) - das "online"-Event ist besonders auf iPhones unzuverlässig.
document.addEventListener("visibilitychange", () => { if (!document.hidden) glasTrySync(); });
// 3) Als Sicherheitsnetz alle 60 Sekunden, solange etwas in der Warteschlange liegt.
setInterval(glasTrySync, 60000);

// Logo antippen -> zurück zur Tourenliste (schließt auch eine offene Tour)
function glasMaGoHome() {
  glasMaScreen = "touren";
  glasOpenTourId = null;
  glasOpenStopId = null;
  glasSignStopId = null;
  renderGlasMa();
}

// "Zurück" oben links: erst innerhalb der App eine Ebene hoch (offene Tour schließen),
// und erst von der Tourenliste aus zurück nach GEKO One.
function glasMaZurueck() {
  if (glasOpenTourId) { glasMaGoHome(); return; }
  location.href = "meine.html";
}

async function loadGlasTouren() {
  try {
    const { data: touren, error } = await sb
      .from("glas_touren")
      .select("*")
      .order("datum", { ascending: false })
      .limit(60);
    if (error) throw error;
    const { data: stops, error: e2 } = await sb
      .from("glas_stopps")
      .select("*")
      .order("reihenfolge", { ascending: true });
    if (e2) throw e2;

    glasTouren = (touren || [])
      // archivierte + vom Admin ausgeblendete Touren gehören nicht in die Mitarbeiter-Ansicht
      .filter((t) => !t.archiviert_am && !t.ma_versteckt)
      .map((t) => ({
        ...t,
        stopps: (stops || []).filter((s) => s.tour_id === t.id),
      }));
    glasTouren = glasOhneAlteFertigeTouren(glasTouren);
    // Letzten Stand für den Offline-Fall sichern (im Objekt oft kein Empfang).
    // Unterschrift-Bilder (große Base64-PNGs) werden dabei weggelassen, sonst sprengen
    // ein paar unterschriebene Touren das localStorage-Limit und es gäbe GAR keinen
    // Offline-Fallback mehr. Offline fehlt dann nur das Bild bei alten Unterschriften.
    try {
      const schlank = glasTouren.map((t) => ({ ...t, stopps: t.stopps.map((s) => ({ ...s, unterschrift: s.unterschrift ? "" : s.unterschrift })) }));
      localStorage.setItem("glas_touren_cache", JSON.stringify(schlank));
    } catch (e) {}
    glasOfflineModus = false;
  } catch (err) {
    // Offline oder Serverfehler -> auf die zuletzt gespeicherten Touren zurückfallen
    glasOfflineModus = true;
    const cached = glasLoadTourenCache();
    if (cached && cached.length) {
      glasTouren = glasOhneAlteFertigeTouren(cached);
    } else {
      glasTouren = [];
    }
  }
  // Offline unterschriebene Stopps lokal drüberlegen, bis sie gesendet sind
  glasApplyPendingSigns();
  // Ab jetzt ist "keine Tour" eine echte Aussage und kein Ladezustand mehr.
  glasTourenGeladen = true;
}

// Fetter "Aktualisieren"-Knopf: Ersatz fuers fruehere Pull-to-Refresh (das auf den
// MA-Seiten entfernt wurde). Laedt die Touren neu vom Server und baut die Ansicht neu.
function glasRefreshButton() {
  return `<button class="btn glas-refresh-btn" onclick="glasRefreshTouren(this)">
    <span class="glas-refresh-ic">🔄</span> Aktualisieren
  </button>`;
}

async function glasRefreshTouren(btn) {
  if (btn && btn.classList) btn.classList.add("is-loading");
  try {
    await glasFlushSignQueue(); // offline gesammelte Unterschriften zuerst senden
    await loadGlasTouren();
  } catch (e) {}
  renderGlasMa(); // baut die Ansicht inkl. Knopf neu auf
  showToast(glasOfflineModus ? "Kein Netz – zuletzt gespeicherter Stand" : "Aktualisiert ✓");
}

// Fertige Touren (kein offener Stopp mehr) verschwinden AB DEM FOLGETAG automatisch
// aus der Mitarbeiter-Ansicht - am Erledigungstag selbst bleiben sie sichtbar (PDF,
// Kontrolle). Im Admin bleiben sie natürlich vollständig erhalten.
function glasOhneAlteFertigeTouren(touren) {
  const heute = todayIso();
  return touren.filter((t) => {
    const stopps = t.stopps || [];
    if (!stopps.length) return true;
    if (stopps.some((s) => s.status === "offen")) return true;
    let letzter = "";
    stopps.forEach((s) => {
      const d = glasDatumVonTimestamp(s.signed_at) || s.datum || glasDatumVonTimestamp(s.ng_am) || "";
      if (d > letzter) letzter = d;
    });
    if (!letzter) letzter = t.datum_bis || t.datum || "";
    return !letzter || letzter >= heute;
  });
}

let glasOfflineModus = false;

function glasLoadTourenCache() {
  try { return JSON.parse(localStorage.getItem("glas_touren_cache") || "[]"); } catch (e) { return []; }
}

function glasSingleMapLinks(stop) {
  const query = encodeURIComponent(`${stop.adresse || ""}`.replace(/\n/g, ", "));
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}&travelmode=driving`,
    apple: `https://maps.apple.com/?daddr=${stop.lat},${stop.lng}&q=${query}`,
    waze: `https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes`,
  };
}

let glasMaRenderedScreen = null; // welcher Screen zuletzt gebaut wurde (gegen Doppel-Animation)
let glasMaRenderedTiefe = 0;     // 0 Start, 1 Tourenliste, 2 offene Tour - gibt die Richtung vor
let glasGeradeErledigt = null;   // Stopp, der eben unterschrieben wurde (einmaliger Jubel-Effekt)
// Trennt "Nutzer hat getippt" von "Hintergrund-Aktualisierung". Beim Auf-/Zuklappen
// eines Stopps bleibt der Bildschirm derselbe - ohne diese Unterscheidung wuerde die
// Flacker-Bremse (glas-static) auch die gewollte Aufklapp-Animation verschlucken.
let glasTippAnimation = false;

function renderGlasMa() {
  const view = document.getElementById("view");

  // Sicherheitsnetz: Ist kein Unterschrift-Sheet (mehr) offen, darf die Seite NIE in
  // overflow:hidden 'eingefroren' bleiben. Sonst koennte man nach dem Unterschreiben
  // nicht mehr weiterscrollen (z.B. zum naechsten Stopp).
  if (!document.getElementById("glasSignSheet")) document.body.classList.remove("glas-sheet-open");

  // Nur bei echtem Screen-Wechsel animieren. Hintergrund-Refreshes (Touren nachgeladen,
  // Offline-Sync, Intervall) bauen denselben Screen neu auf - dann NICHT erneut animieren,
  // sonst flackert/„ruckelt" die Ansicht (Animation lief scheinbar zweimal).
  let screenKey, tiefe;
  if (glasMaScreen === "home") { screenKey = "home"; tiefe = 0; }
  else if (glasOpenTourId && glasTouren.find((x) => x.id === glasOpenTourId)) { screenKey = "tour:" + glasOpenTourId; tiefe = 2; }
  else { screenKey = "touren"; tiefe = 1; }
  const gleicherSchirm = screenKey === glasMaRenderedScreen;
  view.classList.toggle("glas-static", gleicherSchirm);
  view.classList.toggle("glas-tipp", glasTippAnimation);
  glasTippAnimation = false;

  // Richtung des Uebergangs wie in einer nativen App: tiefer hinein = von rechts
  // herein, zurueck = von links. Bei einem Hintergrund-Neuaufbau (gleicher Schirm)
  // laeuft bewusst gar nichts, sonst flackert die Seite bei jeder Kleinigkeit.
  view.classList.remove("glas-vor", "glas-zurueck");
  if (!gleicherSchirm && glasMaRenderedScreen !== null) {
    view.classList.add(tiefe >= glasMaRenderedTiefe ? "glas-vor" : "glas-zurueck");
    // Neustart der Animation erzwingen, auch wenn dieselbe Klasse erneut gesetzt wird
    void view.offsetWidth;
  }
  glasMaRenderedScreen = screenKey;
  glasMaRenderedTiefe = tiefe;

  if (glasMaScreen === "home") {
    const heute = glasTouren.filter((t) => t.datum && t.datum <= todayIso() && todayIso() <= (t.datum_bis || t.datum)).length;
    view.innerHTML = `
      <div class="glas-welcome">
        <img class="glas-welcome-logo" src="${typeof GEKO_LOGO_TRANSPARENT_B64 !== "undefined" ? GEKO_LOGO_TRANSPARENT_B64 : ""}" alt="GEKO" />
        <p class="glas-welcome-title">Hallo GEKO Clean <span class="glas-welcome-heart">❤️</span></p>
        <p class="glas-welcome-sub">Schön, dass du da bist!</p>
        <div class="glas-welcome-buttons">
          <button class="btn btn-primary glas-welcome-btn" style="animation-delay:0.35s;" onclick="glasMaScreen = 'touren'; renderGlasMa();">
            🚐 Meine Touren${heute ? ` <span class="badge" style="background:rgba(255,255,255,0.25); color:white; margin-left:6px;">${heute} heute</span>` : ""}
          </button>
        </div>
        ${glasAppLinkKarte()}
        ${glasCurrentUser ? `<p class="glas-welcome-user">Angemeldet als <b>${escapeHtml(glasCurrentUser.name || glasCurrentUser.username || "")}</b> · <a href="#" onclick="event.preventDefault(); glasLogout();">Abmelden</a></p>` : ""}
      </div>`;
    return;
  }

  if (glasOpenTourId) {
    const t = glasTouren.find((x) => x.id === glasOpenTourId);
    if (t) {
      view.innerHTML = renderGlasTourScreen(t);
      // Das Unterschrift-Formular läuft als eigenes Vollbild-Sheet (glasSignSheet),
      // NICHT inline in #view. Darum hier bewusst kein setupGlasSigPad - sonst würde
      // ein Hintergrund-Refresh die schon begonnene Unterschrift zurücksetzen.
      return;
    }
  }

  // Solange noch NIE geladen wurde und auch kein gespeicherter Stand da ist, ein
  // ruhiges Ladebild zeigen - NICHT "Noch keine Tour für dich". Diese Meldung ist erst
  // richtig, wenn die Abfrage durch ist und wirklich nichts da war.
  if (!glasTouren.length && !glasTourenGeladen) {
    view.innerHTML = `
      <div class="glas-skelett">
        <div class="glas-skelett-karte"></div>
        <div class="glas-skelett-karte"></div>
        <div class="glas-skelett-karte"></div>
      </div>`;
    return;
  }

  if (!glasTouren.length) {
    view.innerHTML = `
      ${glasOfflineBanner()}
      <div class="glas-empty">
        <div class="glas-empty-icon">${glasOfflineModus ? "📴" : "🧽"}</div>
        <p style="font-weight:600; font-size:16px;">${glasOfflineModus ? "Offline – noch nichts gespeichert" : "Noch keine Tour für dich"}</p>
        <p class="muted" style="margin-top:4px;">${glasOfflineModus ? "Bitte die App einmal mit Internet öffnen – danach sind deine Touren auch offline da." : "Sobald eine Tour für dich geplant ist, erscheint sie hier automatisch."}</p>
      </div>`;
    return;
  }

  view.innerHTML = `
    ${glasRefreshButton()}
    ${glasOfflineBanner()}
    ${renderGlasTourList()}`;
}

// Deutlich sichtbarer Hinweis, dass gerade der zuletzt gespeicherte (Offline-)Stand
// gezeigt wird - damit klar ist, dass die App NICHT hängt, sondern nur kein Netz hat.
function glasOfflineBanner() {
  if (!glasOfflineModus) return "";
  const wartend = glasLoadSignQueue().length;
  return `<div style="background:var(--warning-bg); border:1px solid #e0b64a; border-radius:10px; padding:10px 12px; margin:6px 0 12px; font-size:13px;">
    📴 <b>Offline</b> – zuletzt gespeicherter Stand.${wartend ? ` ${wartend} Unterschrift(en) warten aufs Senden.` : ""} Sobald wieder Empfang da ist, aktualisiert sich alles automatisch.
  </div>`;
}

function glasTourProgress(t) {
  const total = t.stopps.length;
  const done = t.stopps.filter((s) => s.status === "erledigt").length;
  const allDone = total > 0 && done === total;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { total, done, allDone, pct };
}

function renderGlasTourCard(t) {
  const { total, done, allDone, pct } = glasTourProgress(t);
  const isToday = !!t.datum && t.datum <= todayIso() && todayIso() <= (t.datum_bis || t.datum);
  const ringColor = allDone ? "#1e7a34" : "var(--blue)";
  const border = allDone ? "var(--success-border)" : isToday ? "var(--blue)" : "var(--border)";
  const bg = allDone ? "var(--success-bg)" : isToday ? "var(--info-bg)" : "var(--card)";
  return `
    <div class="card" style="cursor:pointer; display:flex; align-items:center; gap:14px; background:${bg}; border-color:${border};" onclick="openGlasTour('${t.id}')">
      <div class="glas-ring" style="--pct:${pct}%; --ring-color:${ringColor};">
        <div class="glas-ring-inner">${allDone ? "✓" : `${done}/${total}`}</div>
      </div>
      <div style="flex:1; min-width:0;">
        <p style="margin:0; font-weight:700; font-size:16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t.name ? escapeHtml(t.name) : (t.datum ? formatGlasDate(t.datum) : "Ohne Namen")}</p>
        <p class="muted" style="margin:3px 0 0;">${t.datum ? formatGlasDate(t.datum) : "Ohne Datum"}${isToday ? " · Heute" : ""}${t.notiz ? ` · <span style="color:var(--text-primary);">📌 Notiz</span>` : ""}</p>
      </div>
      <span style="font-size:20px; color:var(--text-secondary); flex-shrink:0;">›</span>
    </div>`;
}

function renderGlasTourList() {
  const today = todayIso();
  const heute = [];
  const kommend = [];
  const frueher = [];
  glasTouren.forEach((t) => {
    // Mehrtägige Touren zählen an JEDEM Tag ihres Zeitraums als "Heute" -
    // sonst verschwindet eine gestern gestartete Tour in "Frühere Touren"
    if (t.datum && t.datum <= today && today <= (t.datum_bis || t.datum)) heute.push(t);
    else if (t.datum && t.datum > today) kommend.push(t);
    else frueher.push(t);
  });
  kommend.sort((a, b) => (a.datum || "").localeCompare(b.datum || ""));
  frueher.sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));

  let html = "";
  if (heute.length) {
    html += `<p class="glas-section-title">Heute</p>` + heute.map(renderGlasTourCard).join("");
  }
  if (kommend.length) {
    html += `<p class="glas-section-title">Kommende Touren</p>` + kommend.map(renderGlasTourCard).join("");
  }
  if (frueher.length) {
    html += `
      <p class="glas-section-title" style="cursor:pointer; display:flex; align-items:center; gap:6px;" onclick="glasFrueherExpanded = !glasFrueherExpanded; renderGlasMa();">
        Frühere Touren (${frueher.length}) <span>${glasFrueherExpanded ? "▲" : "▼"}</span>
      </p>
      ${glasFrueherExpanded ? frueher.map(renderGlasTourCard).join("") : ""}`;
  }
  if (!heute.length && !kommend.length && !frueher.length) {
    html = `<p class="muted">Keine Touren gefunden.</p>`;
  }
  return html;
}

function openGlasTour(id) {
  glasSammelAn = false; glasSammelIds = new Set();
  document.body.classList.remove("glas-sammel-offen");
  glasOpenTourId = id;
  glasSignStopId = null;
  // Der erste noch offene Stopp klappt gleich auf - das ist fast immer der, der dran
  // ist. Ist alles erledigt, bleibt die Liste zu (dann gibt es nichts mehr zu tun).
  const t = glasTouren.find((x) => x.id === id);
  const naechster = t ? t.stopps.find((s) => s.status === "offen") : null;
  glasOpenStopId = naechster ? naechster.id : null;
  renderGlasMa();
}

function closeGlasTour() {
  glasSammelAn = false; glasSammelIds = new Set();
  document.body.classList.remove("glas-sammel-offen");
  glasOpenTourId = null;
  glasOpenStopId = null;
  glasSignStopId = null;
  renderGlasMa();
}

// Kopfleiste der geoeffneten Tour. Bleibt beim Scrollen oben kleben, damit Fortschritt
// und die Pfeile immer erreichbar sind. Frueher standen hier ein grosser
// "Aktualisieren"-Knopf, eine Tour-Karte und ein Erklaertext - zusammen ueber die halbe
// Bildschirmhoehe, bevor der erste Stopp kam. Aktualisieren ist jetzt ein Symbol.
function renderGlasTourBar(t) {
  const { total, done } = glasTourProgress(t);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const idx = t.stopps.findIndex((s) => s.id === glasOpenStopId);
  const links = idx === -1 ? "" : `Stopp ${idx + 1} von ${total}`;
  const offen = total - done;
  return `
    <div class="gsm-bar">
      <div class="gsm-bar-oben">
        <span class="gsm-tour">${t.name ? escapeHtml(t.name) : (t.datum ? formatGlasDate(t.datum) : "Tour")}</span>
        <button class="gsm-ic gsm-refresh" onclick="glasRefreshTouren(this)" aria-label="Aktualisieren"><span class="glas-refresh-ic">⟳</span></button>
      </div>
      <div class="gsm-bar-unten">
        <button class="gsm-ic" onclick="glasStopSchritt(-1)" ${idx <= 0 ? "disabled" : ""} aria-label="Vorheriger Stopp">‹</button>
        <div class="gsm-mitte">
          <div class="gsm-zeile">
            <span>${links || `${done} von ${total} erledigt`}</span>
            <span>${offen === 0 ? "alles erledigt" : `noch ${offen} offen`}</span>
          </div>
          <div class="gsm-track"><div class="gsm-fill" style="width:${pct}%;"></div></div>
        </div>
        <button class="gsm-ic" onclick="glasStopSchritt(1)" ${idx === -1 || idx >= total - 1 ? "disabled" : ""} aria-label="Nächster Stopp">›</button>
      </div>
    </div>`;
}

// Springt einen Stopp vor oder zurueck - unabhaengig davon, welche schon erledigt sind.
function glasStopSchritt(richtung) {
  const t = glasTouren.find((x) => x.id === glasOpenTourId);
  if (!t || !t.stopps.length) return;
  const i = t.stopps.findIndex((s) => s.id === glasOpenStopId);
  const start = i === -1 ? (richtung > 0 ? -1 : t.stopps.length) : i;
  const ziel = start + richtung;
  if (ziel < 0 || ziel >= t.stopps.length) return;
  glasOpenStopId = t.stopps[ziel].id;
  glasSignStopId = null;
  glasTippAnimation = true;
  renderGlasMa();
  const el = document.getElementById("gstop-" + glasOpenStopId);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderGlasTourScreen(t) {
  const offene = (t.stopps || []).filter((s) => s.status === "offen");
  return `
    <button class="btn btn-sm" style="margin-bottom:12px;" onclick="closeGlasTour()">&larr; Alle Touren</button>
    ${renderGlasTourBar(t)}
    ${t.notiz ? `<div class="glas-hinweis-box" style="margin-top:12px;"><span class="glas-hinweis-icon">📌</span><div><p class="glas-hinweis-title">Notiz zur Tour</p><p class="glas-hinweis-text" style="white-space:pre-line;">${escapeHtml(t.notiz)}</p></div></div>` : ""}
    ${offene.length > 1 && !glasSammelAn
      ? `<button class="btn gsm-sammel-start" onclick="glasSammelStart()">✍️ Mehrere auf einmal unterschreiben lassen</button>`
      : ""}
    ${glasSammelAn ? renderGlasSammelKopf(t) : ""}
    ${renderGlasStopsList(t)}
    ${glasSammelAn ? renderGlasSammelLeiste() : ""}
  `;
}

/* ---------------- Mehrere auf einmal unterschreiben lassen ----------------
   Der Normalfall vor Ort: ein Hausmeister hat 13 Objekte desselben Kunden in
   derselben Tour und unterschreibt EINMAL für alles. Statt 13x dasselbe Sheet:
   Objekte antippen, einmal unterschreiben - die Unterschrift landet auf jedem
   gewählten Schein (jeder bleibt ein eigenes PDF).
   Funktioniert auch ohne Empfang: was nicht durchgeht, wandert einzeln in die
   bestehende Warteschlange und wird später nachgesendet. */

let glasSammelAn = false;
let glasSammelIds = new Set();

function glasSammelStart() {
  glasSammelAn = true;
  glasSammelIds = new Set();
  document.body.classList.add("glas-sammel-offen");
  glasOpenStopId = null;      // Akkordeon zu - im Auswahlmodus wird nur getippt
  glasTippAnimation = false;
  renderGlasMa();
}

function glasSammelAus() {
  glasSammelAn = false;
  glasSammelIds = new Set();
  document.body.classList.remove("glas-sammel-offen");
  renderGlasMa();
}

function glasSammelToggle(id) {
  if (glasSammelIds.has(id)) glasSammelIds.delete(id); else glasSammelIds.add(id);
  renderGlasMa();
}

function glasSammelOffene(t) {
  return (t && t.stopps ? t.stopps : []).filter((s) => s.status === "offen");
}

function glasSammelAlle(t) {
  const offene = glasSammelOffene(t);
  const alleDrin = offene.every((s) => glasSammelIds.has(s.id));
  glasSammelIds = alleDrin ? new Set() : new Set(offene.map((s) => s.id));
  renderGlasMa();
}

// Alle offenen Objekte DESSELBEN Kunden - der häufigste Griff
function glasSammelKunde(kunde) {
  const t = glasTouren.find((x) => x.id === glasOpenTourId);
  glasSammelOffene(t).forEach((s) => { if (glasSammelKundeSchluessel(s) === kunde) glasSammelIds.add(s.id); });
  renderGlasMa();
}

function glasSammelKundeSchluessel(s) {
  return String(s.kunde_id || s.kunde_kdnr || (s.kunde_adresse || "").split("\n")[0] || "");
}

function renderGlasSammelKopf(t) {
  const offene = glasSammelOffene(t);
  const alleDrin = offene.length && offene.every((s) => glasSammelIds.has(s.id));
  // Kunden mit mehreren offenen Objekten anbieten
  const proKunde = new Map();
  offene.forEach((s) => {
    const k = glasSammelKundeSchluessel(s);
    const label = (s.kunde_adresse || "").split("\n")[0] || s.kunde_kdnr || "";
    if (!k || !label) return;
    if (!proKunde.has(k)) proKunde.set(k, { label, n: 0 });
    proKunde.get(k).n++;
  });
  const chips = [...proKunde.entries()].filter(([, v]) => v.n > 1)
    .map(([k, v]) => `<button class="gsm-sammel-chip" onclick="glasSammelKunde('${escapeHtml(k).replace(/'/g, "&#39;")}')">${escapeHtml(v.label)} · ${v.n}</button>`).join("");
  return `
    <div class="gsm-sammel-kopf">
      <div class="gsk-z1">
        <b>Objekte antippen</b>
        <button class="btn btn-sm" onclick="glasSammelAus()">Abbrechen</button>
      </div>
      <p class="gsk-hint">Die Unterschrift gilt für alle gewählten Objekte.</p>
      <div class="gsk-chips">
        <button class="gsm-sammel-chip" onclick="glasSammelAlle(glasTouren.find(function(x){return x.id===glasOpenTourId;}))">${alleDrin ? "Auswahl leeren" : `Alle offenen · ${offene.length}`}</button>
        ${chips}
      </div>
    </div>`;
}

// Feste Leiste unten: zeigt immer, wie viele gewählt sind, und führt weiter.
function renderGlasSammelLeiste() {
  const n = glasSammelIds.size;
  return `
    <div class="gsm-sammel-leiste">
      <span>${n} ${n === 1 ? "Objekt" : "Objekte"} gewählt</span>
      <button class="btn btn-primary" ${n ? "" : "disabled"} onclick="openGlasSammelSheet()">Weiter zur Unterschrift</button>
    </div>`;
}

// Gesamt-qm aus dem Positions-Schnappschuss des Stopps (deutsche Schreibweise)
// Jeder Stopp ist eine Karte: zugeklappt nur Objekt, Adresse, qm und ein Vermerk,
// ob Hinweis/Notiz dran hängt - Tippen klappt alle Details samt Unterschrift auf.
function renderGlasStopsList(t) {
  return t.stopps
    .map((s, idx) => {
      const isOpen = glasOpenStopId === s.id;
      const isDone = s.status === "erledigt";
      const isNg = s.status === "nicht_geschafft";
      const qm = glasStopQm(s);
      // Reihenfolge steht fest: erledigte Stopps bleiben an ihrem Platz und werden nur
      // gruen/kompakt. So findet man ein Objekt immer an derselben Stelle der Liste.
      // Gestaffelter Eintritt: die Karten laufen nacheinander herein. Nach dem achten
      // Stopp bleibt die Verzoegerung stehen - sonst wartet man bei langen Touren zu lang.
      const verzug = Math.min(idx, 8) * 0.045;
      const frisch = glasGeradeErledigt === s.id ? " frisch-fertig" : "";
      // Auswahlmodus: offene Stopps werden zu Auswahlflächen, alles andere ruht
      const waehlbar = glasSammelAn && s.status === "offen";
      const gewaehlt = waehlbar && glasSammelIds.has(s.id);
      const auf = isOpen && !glasSammelAn;
      const klick = glasSammelAn
        ? (waehlbar ? `glasSammelToggle('${s.id}')` : "")
        : `toggleGlasStop('${s.id}')`;
      return `
        <div class="gsm-stopp${auf ? " offen" : ""}${isDone ? " fertig" : ""}${isNg ? " ng" : ""}${frisch}${waehlbar ? " waehlbar" : ""}${gewaehlt ? " gewaehlt" : ""}${glasSammelAn && !waehlbar ? " ruht" : ""}" id="gstop-${s.id}" style="animation-delay:${verzug}s;"${klick ? ` onclick="${klick}"` : ""}>
          <div class="gsm-z1">
            <div class="gsm-kugel">${waehlbar ? (gewaehlt ? "✓" : "") : isDone ? "✓" : isNg ? "–" : idx + 1}</div>
            <div style="flex:1; min-width:0;">
              <p class="gsm-nam">${s.objekt ? escapeHtml(s.objekt) : `Stopp ${idx + 1}`}</p>
              ${auf ? "" : `<p class="gsm-ort">${escapeHtml((s.adresse || "").split("\n")[0])}</p>`}
            </div>
            <div class="gsm-rechts">
              ${auf ? "" : `${qm ? `<b>${qm} qm</b>` : ""}<span class="gsm-merk">${s.hinweise ? "⚠️" : ""}${s.notiz ? "📝" : ""}</span>`}
              ${glasSammelAn ? "" : `<span class="gsm-pfeil">${isOpen ? "▲" : "▼"}</span>`}
            </div>
          </div>
          ${auf ? renderGlasStopDetails(t, s, isDone, isNg) : ""}
        </div>`;
    })
    .join("");
}

// Mini-Vorschau der Positionen, damit der Mitarbeiter vor dem Unterschreiben sicher ist,
// dass es der richtige Abnahmeschein ist (Nr · Leistung · qm). Inklusive Positionstext
// (z.B. "Eingangsbereich und Flure · 4x jährlich") - der Mitarbeiter muss ja wissen,
// welche Bereiche zu der Position gehören, nicht nur die Quadratmeter.
function renderMaStopPositionen(s) {
  const pos = glasStopPositionen(s);
  if (!pos.length) return "";
  return `<div class="gsm-posbox">
    <p class="gsm-poskopf">${pos.length === 1 ? "LEISTUNG" : "LEISTUNGEN"}</p>
    ${pos.map((p) => `<div class="gsm-pos">
      <span class="gsm-posnr">${escapeHtml(p.nr || "–")}</span>
      <span class="gsm-posart">${escapeHtml(p.art || "")}</span>
      ${p.qm ? `<span class="gsm-posqm">${escapeHtml(String(p.qm))} ${glasPosEinheit(p)}</span>` : glasIstStundenPos(p) ? `<span class="gsm-posqm">Std. vor Ort</span>` : ""}
    </div>${p.pos_text && String(p.pos_text).trim() ? `<div class="gsm-postext">${escapeHtml(String(p.pos_text).trim())}</div>` : ""}`).join("")}
  </div>`;
}

// Die beiden Kacheln unter der Adresse: Flaeche und Ansprechpartner. Das sind die
// zwei Angaben, die man vor Ort am haeufigsten braucht - als Kachel sind sie auf
// einen Blick da statt im Fliesstext. Fehlt eine, nimmt die andere die ganze Breite.
function renderGlasStopKacheln(s) {
  const qm = glasStopQm(s);
  const k = [];
  if (qm) k.push({ t: "FLÄCHE", v: `${qm} qm`, klein: false });
  if (s.ansprechpartner) k.push({ t: "VOR ORT", v: s.ansprechpartner, klein: true });
  if (!k.length) return "";
  return `<div class="gsm-kacheln${k.length === 1 ? " einzeln" : ""}">
    ${k.map((x) => `<div class="gsm-ka"><div class="k">${x.t}</div><div class="v${x.klein ? " s" : ""}">${escapeHtml(x.v)}</div></div>`).join("")}
  </div>`;
}

// Die Knoepfe sitzen am Fuss der Karte in einem eigenen, durch eine Linie
// abgesetzten Block - nicht mehr verstreut zwischen den Angaben.
function renderGlasStopAktionen(t, s, isDone, isNg) {
  const telNr = s.telefon ? String(s.telefon).replace(/[^0-9+]/g, "") : "";
  const neben = [];
  if (telNr) neben.push(`<a class="btn gsm-abtn" href="tel:${escapeHtml(telNr)}">📞 Anrufen</a>`);
  if (s.lat) neben.push(`<button class="btn gsm-abtn" onclick="event.stopPropagation(); openGlasNaviSheet('${s.id}')">🧭 Navigation</button>`);
  let haupt = "";
  if (isDone) haupt = `<button class="btn gsm-ahaupt" onclick="downloadGlasPdf('${t.id}','${s.id}')">📄 Abnahmeschein öffnen</button>`;
  else if (!isNg) haupt = `<button class="btn btn-primary gsm-ahaupt" onclick="event.stopPropagation(); openGlasSignSheet('${s.id}')">✍️ Jetzt unterschreiben</button>`;
  if (!neben.length && !haupt) return "";
  return `<div class="gsm-aktionen">
    ${neben.length ? `<div class="gsm-akt-zwei">${neben.join("")}</div>` : ""}
    ${haupt}
  </div>`;
}

function renderGlasStopDetails(t, s, isDone, isNg) {
  return `
    <div class="gsm-auf" onclick="event.stopPropagation();">
      <p class="gsm-adr">${escapeHtml(s.adresse)}</p>
      ${renderGlasStopKacheln(s)}
      ${s.hinweise ? `
      <div class="glas-hinweis-box">
        <span class="glas-hinweis-icon">⚠️</span>
        <div>
          <p class="glas-hinweis-title">Hinweis fürs Team</p>
          <p class="glas-hinweis-text">${escapeHtml(s.hinweise)}</p>
        </div>
      </div>` : ""}
      ${s.notiz ? `<div class="glas-notiz-box">📝 ${escapeHtml(s.notiz)}</div>` : ""}
      ${renderMaStopPositionen(s)}
      ${isDone
        ? `
      <div class="gsm-abschluss">
        <p class="muted" style="margin:0 0 8px;">${!s.unterschrift && s.manuell_erledigt_am
          ? `✔️ Vom Büro als erledigt markiert am ${formatGlasDate(glasSignaturDatum(s))}`
          : `✍️ Unterschrieben von <b>${escapeHtml(s.name || "")}</b> am ${formatGlasDate(glasSignaturDatum(s))}`}</p>
        ${s.__pendingSync ? `<div class="glas-notiz-box" style="margin:0 0 8px; background:var(--warning-bg); border-color:#e0b64a;">⏳ Sicher gespeichert – wird automatisch ans Büro gesendet, sobald wieder Empfang da ist.</div>` : ""}
        ${s.zusatz ? `<div class="glas-notiz-box" style="margin:0 0 8px; white-space:pre-line;">➕ Zusätzlich: ${escapeHtml(s.zusatz)}</div>` : ""}
        ${s.unterschrift ? `<img src="${s.unterschrift}" style="max-width:100%; border:1px solid var(--border); border-radius:8px; background:white;" />` : ""}
      </div>`
        : isNg
          ? `<div class="glas-notiz-box">🚫 Vom Büro als <b>nicht geschafft</b> markiert${s.ng_grund ? ` – ${escapeHtml(s.ng_grund)}` : ""}. Dieser Stopp wird neu eingeplant.</div>`
          : ""
      }
      ${renderGlasStopAktionen(t, s, isDone, isNg)}
    </div>`;
}

// Nur die Eingabefelder. Der "Speichern"-Knopf sitzt in der festen Fußleiste des
// Vollbild-Sheets (openGlasSignSheet) - so ist er auf jedem Handy immer erreichbar,
// ohne am Unterschrift-Canvas vorbeiscrollen zu müssen.
function renderGlasSignForm(s) {
  const today = todayIso();
  return `
    ${renderGlasStundenInputs(s, "gs-std")}
    <div class="field">
      <label class="muted">Name der unterschreibenden Person</label>
      <input type="text" id="gs_name" placeholder="Vor- und Nachname" style="font-size:16px;" />
    </div>
    <div class="field">
      <label class="muted">Unterschrift</label>
      <canvas id="gs_sigCanvas" style="width:100%; height:190px; border:1px solid var(--border); border-radius:10px; background:white; touch-action:none;"></canvas>
      <p class="muted" style="margin:8px 2px 0; font-size:12px;">Zum Weiterscrollen einfach neben dem Unterschriftfeld wischen.</p>
    </div>
    <div class="field">
      <label class="muted">➕ Extra was gemacht? (optional)</label>
      <div id="gs_zusatz_list">
        <textarea class="gs-zusatz" rows="2" style="font-size:16px;" placeholder="z.B. 2 Stunden zusätzlich"></textarea>
      </div>
      <button class="btn btn-sm" style="margin-top:8px;" onclick="glasZusatzAddField()">+ Noch etwas hinzufügen</button>
      <p class="muted" style="margin:6px 0 0; font-size:12px;">Jede Zeile steht als eigene Position mit auf dem Abnahmeschein.</p>
    </div>
    <input type="hidden" id="gs_datum" value="${today}" />`;
}

// Vollbild-Unterschrift-Sheet: Kopf + scrollbarer Inhalt + feste Fußleiste.
// Bewusst als eigenes Overlay am <body> (nicht inline in #view), damit
//   - der Speichern-Knopf in der Fußleiste IMMER sichtbar/tippbar ist,
//   - man neben dem Canvas frei scrollen kann (das Canvas selbst braucht
//     touch-action:none zum Zeichnen und "schluckt" sonst das Scrollen),
//   - ein Hintergrund-Refresh der Touren-Liste die Unterschrift nicht wegräumt.
function openGlasSignSheet(stopId) {
  let stop = null;
  for (const t of glasTouren) {
    const s = t.stopps.find((x) => x.id === stopId);
    if (s) stop = s;
  }
  if (!stop) return;
  closeGlasSignSheet();
  glasSignStopId = stopId;
  const el = document.createElement("div");
  el.className = "glas-sign-sheet";
  el.id = "glasSignSheet";
  el.innerHTML = `
    <div class="gss-head">
      <button class="gss-close" onclick="closeGlasSignSheet()" aria-label="Schließen">✕</button>
      <div class="gss-title">
        <p class="gss-t">Abnahmeschein unterschreiben</p>
        <p class="gss-s">${escapeHtml(stop.objekt || "Stopp")}</p>
      </div>
    </div>
    <div class="gss-body">
      ${renderGlasSignForm(stop)}
    </div>
    <div class="gss-foot">
      <button class="btn gss-clear" onclick="clearGlasSig()">🗑️ Neu</button>
      <button class="btn btn-primary" onclick="saveGlasSignature('${stop.id}')">✓ Unterschrift speichern</button>
    </div>`;
  document.body.appendChild(el);
  document.body.classList.add("glas-sheet-open");
  // Canvas braucht seine endgültige Breite, bevor SignaturePad initialisiert wird
  setTimeout(() => setupGlasSigPad(), 40);
}

// Dasselbe Vollbild-Sheet wie beim einzelnen Stopp - nur mit einer Liste der
// gewählten Objekte oben und Stunden-Feldern je Objekt, das welche braucht.
function openGlasSammelSheet() {
  const t = glasTouren.find((x) => x.id === glasOpenTourId);
  if (!t) return;
  const gewaehlt = glasSammelOffene(t).filter((s) => glasSammelIds.has(s.id));
  if (!gewaehlt.length) { showToast("Bitte mindestens ein Objekt antippen"); return; }
  closeGlasSignSheet();
  glasSignStopId = "__sammel";
  const el = document.createElement("div");
  el.className = "glas-sign-sheet";
  el.id = "glasSignSheet";
  el.innerHTML = `
    <div class="gss-head">
      <button class="gss-close" onclick="closeGlasSignSheet()" aria-label="Schließen">✕</button>
      <div class="gss-title">
        <p class="gss-t">${gewaehlt.length} Scheine unterschreiben</p>
        <p class="gss-s">Eine Unterschrift für alle</p>
      </div>
    </div>
    <div class="gss-body">
      <div class="gsm-sammel-liste">
        ${gewaehlt.map((s) => `<div class="gsl-zeile"><span class="gsl-hak">✓</span><span>${escapeHtml(s.objekt || s.adresse || "Objekt")}</span></div>`).join("")}
      </div>
      ${renderGlasSammelStunden(gewaehlt)}
      <div class="field">
        <label class="muted">Name der unterschreibenden Person</label>
        <input type="text" id="gs_name" placeholder="Vor- und Nachname" style="font-size:16px;" />
      </div>
      <div class="field">
        <label class="muted">Unterschrift <span class="muted" style="font-weight:400;">(gilt für alle ${gewaehlt.length})</span></label>
        <canvas id="gs_sigCanvas" style="width:100%; height:190px; border:1px solid var(--border); border-radius:10px; background:white; touch-action:none;"></canvas>
        <p class="muted" style="margin:8px 2px 0; font-size:12px;">Zum Weiterscrollen einfach neben dem Unterschriftfeld wischen.</p>
      </div>
      <div class="field">
        <label class="muted">➕ Extra was gemacht? (optional, steht auf allen)</label>
        <div id="gs_zusatz_list">
          <textarea class="gs-zusatz" rows="2" style="font-size:16px;" placeholder="z.B. 2 Stunden zusätzlich"></textarea>
        </div>
        <button class="btn btn-sm" style="margin-top:8px;" onclick="glasZusatzAddField()">+ Noch etwas hinzufügen</button>
      </div>
      <input type="hidden" id="gs_datum" value="${todayIso()}" />
    </div>
    <div class="gss-foot">
      <button class="btn gss-clear" onclick="clearGlasSig()">🗑️ Neu</button>
      <button class="btn btn-primary" id="gs_sammel_btn" onclick="saveGlasSammelSignature()">✓ ${gewaehlt.length} unterschreiben</button>
    </div>`;
  document.body.appendChild(el);
  document.body.classList.add("glas-sheet-open");
  setTimeout(() => setupGlasSigPad(), 40);
}

// Stunden je Objekt - ohne die Zuordnung landeten sie sonst auf dem falschen Schein
function renderGlasSammelStunden(gewaehlt) {
  const noetig = gewaehlt.filter((s) => glasStopPositionen(s).filter(glasIstStundenPos).length);
  if (!noetig.length) return "";
  return `
    <div class="field">
      <label class="muted">⏱️ Gemachte Stunden (Pflicht)</label>
      ${noetig.map((s) => `
        <p style="margin:10px 0 2px; font-size:13px; font-weight:700;">${escapeHtml(s.objekt || "Objekt")}</p>
        ${glasStopPositionen(s).filter(glasIstStundenPos).map((p, i) => `
          <div style="display:flex; align-items:center; gap:10px; margin-top:6px;">
            <span style="flex:1; min-width:0; font-size:13px;">${p.nr ? `Pos. ${escapeHtml(p.nr)} – ` : ""}${escapeHtml(p.art || "Stunden")}</span>
            <input type="text" inputmode="decimal" data-gsstd="${s.id}|${i}" value="${escapeHtml(String(p.qm || ""))}"
              placeholder="Std." style="flex:0 0 90px; font-size:16px; text-align:center;" />
          </div>`).join("")}`).join("")}
      <p class="muted" style="margin:8px 0 0; font-size:12px;">Je Objekt eigene Stunden – landet auf dem jeweiligen Schein.</p>
    </div>`;
}

async function saveGlasSammelSignature() {
  const btn = document.getElementById("gs_sammel_btn");
  if (btn && btn.disabled) return;
  const t = glasTouren.find((x) => x.id === glasOpenTourId);
  if (!t) return;
  const name = (document.getElementById("gs_name")?.value || "").trim();
  const datum = document.getElementById("gs_datum")?.value || todayIso();
  if (!name) { showToast("Bitte Namen eintragen"); return; }
  if (!glasSigPad || glasSigPad.isEmpty()) { showToast("Bitte unterschreiben lassen"); return; }

  const gewaehlt = glasSammelOffene(t).filter((s) => glasSammelIds.has(s.id));
  if (!gewaehlt.length) { showToast("Keine offenen Objekte gewählt"); return; }

  // Stunden je Objekt einsammeln und KOMPLETT prüfen, bevor irgendetwas gespeichert
  // wird - sonst wäre die Hälfte unterschrieben und die andere nicht.
  const werte = {};
  document.querySelectorAll("[data-gsstd]").forEach((el) => { werte[el.dataset.gsstd] = el.value; });
  const arbeit = [];
  for (const s of gewaehlt) {
    let posJson = s.positionen || "[]";
    const anzahl = glasStopPositionen(s).filter(glasIstStundenPos).length;
    if (anzahl) {
      const w = [];
      for (let i = 0; i < anzahl; i++) w.push(werte[s.id + "|" + i] || "");
      const res = glasMitStundenAktualisiert(posJson, w);
      if (res.fehlt) { showToast(`Bitte die Stunden für „${s.objekt || "Objekt"}" eintragen`); return; }
      posJson = res.json;
    }
    arbeit.push({ stop: s, posJson });
  }

  const unterschrift = glasSigPad.toDataURL("image/png");
  const zusatz = [...document.querySelectorAll(".gs-zusatz")].map((x) => x.value.trim()).filter(Boolean).join("\n");
  const signedAt = new Date().toISOString();   // alle bekommen denselben Zeitstempel
  const erfasstVon = (glasCurrentUser && glasCurrentUser.name) || "";

  if (btn) { btn.disabled = true; btn.textContent = "Speichere…"; }
  let online = 0, wartend = 0, serverFehler = null;
  for (const a of arbeit) {
    let ok = false;
    if (navigator.onLine && !serverFehler) {
      try {
        const { error, payload } = await glasSignStop(a.stop.id, a.posJson, name, datum, unterschrift, zusatz, signedAt, erfasstVon);
        if (!error) { Object.assign(a.stop, payload, { __pendingSync: false }); ok = true; online++; }
        else if (!glasIstNetzFehler(error)) serverFehler = error;
      } catch (e) { if (!glasIstNetzFehler(e)) serverFehler = e; }
    }
    if (!ok && !serverFehler) {
      // Kein Empfang: in die bestehende Warteschlange, damit vor Ort nichts verloren geht
      glasQueueSign({ stopId: a.stop.id, objekt: a.stop.objekt || "", tour: t.name || "", positionen: a.posJson, name, datum, unterschrift, zusatz, signedAt, erfasstVon });
      Object.assign(a.stop, { name, datum, unterschrift, zusatz, positionen: a.posJson, status: "erledigt", signed_at: signedAt, erfasst_von: erfasstVon, __pendingSync: true });
      wartend++;
    }
  }

  if (serverFehler && !online && !wartend) {
    if (btn) { btn.disabled = false; btn.textContent = `✓ ${gewaehlt.length} unterschreiben`; }
    showToast("Fehler beim Speichern: " + (serverFehler.message || serverFehler));
    return; // Sheet bleibt offen, nichts geht verloren
  }

  const gesamt = online + wartend;
  if (online) glasPushUnterschriftAnAdmin(arbeit[0].stop, name, zusatz, t.name || "");
  closeGlasSignSheet();
  glasSammelAn = false;
  glasSammelIds = new Set();
  document.body.classList.remove("glas-sammel-offen");
  glasOpenStopId = null;
  glasTippAnimation = true;
  renderGlasMa();
  showToast(wartend
    ? `${gesamt} unterschrieben – ${wartend} wird gesendet, sobald wieder Empfang da ist`
    : `${gesamt} ${gesamt === 1 ? "Schein" : "Scheine"} unterschrieben ✓`);
  if (serverFehler) showToast("Achtung: nicht alle konnten gespeichert werden");
}

function closeGlasSignSheet() {
  const el = document.getElementById("glasSignSheet");
  if (el) el.remove();
  document.body.classList.remove("glas-sheet-open");
  glasSigPad = null;
  glasSignStopId = null;
}

// Auswahl der Navigations-App. Frueher standen Google/Apple/Waze als drei kleine
// Knoepfe nebeneinander im Stopp - das war eng und auf schmalen Handys kaum zu
// treffen. Jetzt: EIN Knopf "Navigation", der dieses Auswahl-Blatt oeffnet.
function openGlasNaviSheet(stopId) {
  let stop = null;
  for (const t of glasTouren) {
    const s = (t.stopps || []).find((x) => x.id === stopId);
    if (s) stop = s;
  }
  if (!stop || !stop.lat) return;
  closeGlasNaviSheet();
  const links = glasSingleMapLinks(stop);
  const el = document.createElement("div");
  el.className = "glas-navi-back";
  el.id = "glasNaviSheet";
  el.onclick = function (e) { if (e.target === el) closeGlasNaviSheet(); };
  el.innerHTML = `
    <div class="glas-navi-sheet" role="dialog" aria-label="Navigation starten">
      <div class="glas-sheet-grip"></div>
      <p class="glas-navi-t">Navigation starten</p>
      <p class="glas-navi-s">${escapeHtml(String(stop.adresse || "").replace(/\n/g, ", "))}</p>
      <a class="glas-navi-opt" href="${links.google}" target="_blank" rel="noopener" onclick="closeGlasNaviSheet()">
        <span class="glas-navi-ico">🧭</span><span>Google Maps</span><span class="glas-navi-pf">›</span>
      </a>
      <a class="glas-navi-opt" href="${links.apple}" onclick="closeGlasNaviSheet()">
        <span class="glas-navi-ico">🗺️</span><span>Apple Karten</span><span class="glas-navi-pf">›</span>
      </a>
      <a class="glas-navi-opt" href="${links.waze}" target="_blank" rel="noopener" onclick="closeGlasNaviSheet()">
        <span class="glas-navi-ico">📍</span><span>Waze</span><span class="glas-navi-pf">›</span>
      </a>
      <button class="btn glas-navi-abbruch" onclick="closeGlasNaviSheet()">Abbrechen</button>
    </div>`;
  document.body.appendChild(el);
}

function closeGlasNaviSheet() {
  const el = document.getElementById("glasNaviSheet");
  if (el) el.remove();
}

// Fügt ein weiteres Zusatz-Feld hinzu, ohne die Seite neu zu bauen (Unterschrift bleibt).
function glasZusatzAddField() {
  const list = document.getElementById("gs_zusatz_list");
  if (!list) return;
  const ta = document.createElement("textarea");
  ta.className = "gs-zusatz";
  ta.rows = 2;
  ta.style.fontSize = "16px";
  ta.style.marginTop = "8px";
  ta.placeholder = "z.B. 5 Fenster extra";
  list.appendChild(ta);
  ta.focus();
}

function toggleGlasStop(id) {
  glasOpenStopId = glasOpenStopId === id ? null : id;
  glasSignStopId = null;
  glasTippAnimation = true; // bewusste Aktion -> Aufklapp-Animation darf laufen
  renderGlasMa();
}

function setupGlasSigPad() {
  const canvas = document.getElementById("gs_sigCanvas");
  if (!canvas) return;
  const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  canvas.getContext("2d").scale(ratio, ratio);
  glasSigPad = new SignaturePad(canvas, { minWidth: 0.8, maxWidth: 2.2 });
}

function clearGlasSig() {
  if (glasSigPad) glasSigPad.clear();
}

async function saveGlasSignature(stopId) {
  const name = document.getElementById("gs_name").value.trim();
  const datum = document.getElementById("gs_datum").value;
  if (!name) { showToast("Bitte Namen eintragen"); return; }
  if (!datum) { showToast("Bitte Datum wählen"); return; }
  if (!glasSigPad || glasSigPad.isEmpty()) { showToast("Bitte unterschreiben lassen"); return; }

  const unterschrift = glasSigPad.toDataURL("image/png");
  const zusatz = [...document.querySelectorAll(".gs-zusatz")].map((t) => t.value.trim()).filter(Boolean).join("\n");
  const signedAt = new Date().toISOString();
  let stopRef = null;
  let tourName = "";
  for (const t of glasTouren) {
    const stop = t.stopps.find((s) => s.id === stopId);
    if (stop) { stopRef = stop; tourName = t.name || ""; }
  }

  // Stunden-Positionen: Eingaben sind Pflicht und wandern in den Positions-Schnappschuss
  let posJson = stopRef?.positionen || "[]";
  const stdInputs = [...document.querySelectorAll(".gs-std")].map((el) => el.value);
  if (stdInputs.length) {
    const res = glasMitStundenAktualisiert(posJson, stdInputs);
    if (res.fehlt) { showToast("Bitte die gemachten Stunden eintragen (Pflichtfeld)"); return; }
    posJson = res.json;
  }

  // Erst online versuchen; bei fehlendem Empfang / Netzfehler in die Warteschlange legen,
  // damit im Objekt ohne Netz nichts verloren geht. Eine ECHTE Server-Ablehnung wird
  // dagegen als Fehler angezeigt (Formular bleibt offen) - sie darf nicht als
  // "gespeichert" durchgehen.
  const erfasstVon = (glasCurrentUser && glasCurrentUser.name) || "";
  let saved = false;
  let serverFehler = null;
  if (navigator.onLine) {
    try {
      const { error, payload } = await glasSignStop(stopId, posJson, name, datum, unterschrift, zusatz, signedAt, erfasstVon);
      if (!error) {
        if (stopRef) Object.assign(stopRef, payload, { __pendingSync: false });
        saved = true;
      } else if (!glasIstNetzFehler(error)) {
        serverFehler = error;
      }
    } catch (e) { if (!glasIstNetzFehler(e)) serverFehler = e; }
  }

  if (serverFehler) {
    showToast("Fehler beim Speichern: " + (serverFehler.message || serverFehler));
    return; // Formular + Unterschrift bleiben stehen, nichts geht verloren
  }

  if (saved) {
    showToast("Gespeichert");
    glasPushUnterschriftAnAdmin(stopRef, name, zusatz, tourName);
  } else {
    glasQueueSign({ stopId, objekt: stopRef?.objekt || "", tour: tourName, positionen: posJson, name, datum, unterschrift, zusatz, signedAt, erfasstVon });
    if (stopRef) Object.assign(stopRef, { name, datum, unterschrift, zusatz, positionen: posJson, status: "erledigt", signed_at: signedAt, erfasst_von: erfasstVon, __pendingSync: true });
    showToast("Offline gespeichert – wird gesendet, sobald wieder Empfang da ist");
  }

  // Sheet schließen. Danach klappt der naechste noch offene Stopp auf, damit es ohne
  // Suchen weitergeht. Gibt es keinen mehr, bleibt der gerade unterschriebene offen
  // und zeigt den gruenen "Unterschrieben"-Block.
  closeGlasSignSheet();
  const tourJetzt = glasTouren.find((x) => x.id === glasOpenTourId);
  const naechster = tourJetzt ? tourJetzt.stopps.find((s) => s.status === "offen") : null;
  glasOpenStopId = naechster ? naechster.id : stopId;
  // Der eben unterschriebene Stopp bekommt EINMAL den gruenen Jubel-Effekt. Danach
  // zuruecksetzen, damit er bei Hintergrund-Neuaufbauten nicht erneut losgeht.
  glasGeradeErledigt = stopId;
  glasTippAnimation = true;
  renderGlasMa();
  setTimeout(() => { glasGeradeErledigt = null; }, 1200);
  if (naechster) {
    const el = document.getElementById("gstop-" + naechster.id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function downloadGlasPdf(tourId, stopId) {
  const t = glasTouren.find((x) => x.id === tourId);
  const s = t?.stopps.find((x) => x.id === stopId);
  if (!s) return;
  const doc = generateGlasPdf(s, t.template, t.datum);
  doc.save(glasScheinFilename(s, t.template));
}

// Meldet dem Admin eine frisch eingegangene Unterschrift (wenn der Schalter in den
// Admin-Einstellungen an ist). Fehler hier dürfen den Mitarbeiter nie stören.
async function glasPushUnterschriftAnAdmin(stop, name, zusatz, tourName) {
  try {
    const { data } = await sb.from("glas_einstellungen").select("push_unterschrift").eq("id", "default").limit(1);
    if (!data || !data[0] || !data[0].push_unterschrift) return;
    sb.functions.invoke("send-push", {
      body: {
        role: "glas",
        title: `✍️ Unterschrift: ${tourName || "Tour"}`,
        body: `${stop?.objekt || "Stopp"} – unterschrieben von ${name}${zusatz ? " · Zusatz: " + zusatz : ""}`,
        url: "/glas-admin.html#/tab/touren",
      },
    }).catch(() => {});
  } catch (e) {}
}

glasMaInit();
