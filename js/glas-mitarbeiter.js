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
let glasMaScreen = "home"; // "home" (Logo-Startseite) | "touren"
let glasOpenTourId = null; // gerade geöffnete Tour im Vollbild (ersetzt die Liste)
let glasOpenStopId = null; // aufgeklappter Stopp (Akkordeon)
let glasSignStopId = null; // Stopp, bei dem gerade das Unterschrift-Formular offen ist
let glasSigPad = null;
let glasFrueherExpanded = false; // "Frühere Touren"-Abschnitt aufgeklappt

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
  renderGlasMa(); // Startseite sofort zeigen, Touren laden im Hintergrund
  await glasFlushSignQueue(); // eventuell offline gesammelte Unterschriften zuerst nachsenden
  await loadGlasTouren();
  renderGlasMa();
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

// Logo oben links -> zurück zur Startseite (schließt auch eine offene Tour)
function glasMaGoHome() {
  glasMaScreen = "home";
  glasOpenTourId = null;
  glasOpenStopId = null;
  glasSignStopId = null;
  renderGlasMa();
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

function renderGlasMa() {
  const view = document.getElementById("view");

  // Sicherheitsnetz: Ist kein Unterschrift-Sheet (mehr) offen, darf die Seite NIE in
  // overflow:hidden 'eingefroren' bleiben. Sonst koennte man nach dem Unterschreiben
  // nicht mehr weiterscrollen (z.B. zum naechsten Stopp).
  if (!document.getElementById("glasSignSheet")) document.body.classList.remove("glas-sheet-open");

  // Nur bei echtem Screen-Wechsel animieren. Hintergrund-Refreshes (Touren nachgeladen,
  // Offline-Sync, Intervall) bauen denselben Screen neu auf - dann NICHT erneut animieren,
  // sonst flackert/„ruckelt" die Ansicht (Animation lief scheinbar zweimal).
  let screenKey;
  if (glasMaScreen === "home") screenKey = "home";
  else if (glasOpenTourId && glasTouren.find((x) => x.id === glasOpenTourId)) screenKey = "tour:" + glasOpenTourId;
  else screenKey = "touren";
  view.classList.toggle("glas-static", screenKey === glasMaRenderedScreen);
  glasMaRenderedScreen = screenKey;

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

  if (!glasTouren.length) {
    view.innerHTML = `
      <button class="btn btn-sm" style="margin:16px 0;" onclick="glasMaScreen = 'home'; renderGlasMa();">&larr; Start</button>
      ${glasOfflineBanner()}
      <div class="glas-empty">
        <div class="glas-empty-icon">${glasOfflineModus ? "📴" : "🧽"}</div>
        <p style="font-weight:600; font-size:16px;">${glasOfflineModus ? "Offline – noch nichts gespeichert" : "Noch keine Tour für dich"}</p>
        <p class="muted" style="margin-top:4px;">${glasOfflineModus ? "Bitte die App einmal mit Internet öffnen – danach sind deine Touren auch offline da." : "Sobald eine Tour für dich geplant ist, erscheint sie hier automatisch."}</p>
      </div>`;
    return;
  }

  view.innerHTML = `
    <button class="btn btn-sm" style="margin:16px 0 4px;" onclick="glasMaScreen = 'home'; renderGlasMa();">&larr; Start</button>
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
  renderGlasMa();
  const el = document.getElementById("gstop-" + glasOpenStopId);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderGlasTourScreen(t) {
  return `
    <button class="btn btn-sm" style="margin-bottom:12px;" onclick="closeGlasTour()">&larr; Alle Touren</button>
    ${renderGlasTourBar(t)}
    ${t.notiz ? `<div class="glas-hinweis-box" style="margin-top:12px;"><span class="glas-hinweis-icon">📌</span><div><p class="glas-hinweis-title">Notiz zur Tour</p><p class="glas-hinweis-text" style="white-space:pre-line;">${escapeHtml(t.notiz)}</p></div></div>` : ""}
    ${renderGlasStopsList(t)}
  `;
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
      return `
        <div class="gsm-stopp${isOpen ? " offen" : ""}${isDone ? " fertig" : ""}${isNg ? " ng" : ""}" id="gstop-${s.id}" onclick="toggleGlasStop('${s.id}')">
          <div class="gsm-z1">
            <div class="gsm-kugel">${isDone ? "✓" : isNg ? "–" : idx + 1}</div>
            <div style="flex:1; min-width:0;">
              <p class="gsm-nam">${s.objekt ? escapeHtml(s.objekt) : `Stopp ${idx + 1}`}</p>
              ${isOpen ? "" : `<p class="gsm-ort">${escapeHtml((s.adresse || "").split("\n")[0])}</p>`}
            </div>
            <div class="gsm-rechts">
              ${isOpen ? "" : `${qm ? `<b>${qm} qm</b>` : ""}<span class="gsm-merk">${s.hinweise ? "⚠️" : ""}${s.notiz ? "📝" : ""}</span>`}
              <span class="gsm-pfeil">${isOpen ? "▲" : "▼"}</span>
            </div>
          </div>
          ${isOpen ? renderGlasStopDetails(t, s, isDone, isNg) : ""}
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
  renderGlasMa();
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
