// ============================================================================
// GEKO Check-ins – Mitarbeiter-App
// Anmeldung mit denselben Konten wie die Glas-Touren-App (Tabelle glas_mitarbeiter),
// zusätzlich muss der Admin "zugang_checkin" freigeschaltet haben.
// Kernablauf: Punkt vor Ort antippen -> GPS holen -> Entfernung prüfen -> speichern
// (oder offline zwischenspeichern und automatisch nachsenden).
// ============================================================================

const CI_AUTH_KEY = "geko_ci_auth";           // eigene Sitzung (getrennt von Glas)
const CI_QUEUE_KEY = "ci_pending_checkins";   // Offline-Warteschlange
let ciUser = null;                             // {id, name, username}
let ciSeg = "heute";                           // aktueller Reiter
let ciData = { rundgaenge: [], punkte: {}, logs: [] }; // logs = MEINE Logs (heute + Woche)
let ciBusyPunkt = null;                         // Punkt-ID, für den gerade eingecheckt wird

document.addEventListener("DOMContentLoaded", ciInit);

async function ciInit() {
  ciSetHeaderDate();
  const ok = await ciEnsureLoggedIn();
  if (!ok) return; // Login-Screen läuft
  ciRender();
  await ciFlushQueue();
  await ciLoadData();
  ciRender();
  // Beim Wiederverbinden automatisch nachsenden
  window.addEventListener("online", () => ciFlushQueue().then(() => { ciLoadData().then(ciRender); }));
}

function ciSetHeaderDate() {
  const el = document.getElementById("ci_date");
  if (!el) return;
  const d = new Date();
  el.textContent = `${CI_TAGE_LANG[ciIsoDay(d) - 1]}, ${d.getDate()}. ${["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"][d.getMonth()]}`;
}

/* ---------------- Login ---------------- */
async function ciEnsureLoggedIn() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(CI_AUTH_KEY) || "null"); } catch (e) {}
  if (!stored || !stored.id || !stored.tok) { ciRenderLogin(); return false; }
  try {
    const { data, error } = await sb.from("glas_mitarbeiter")
      .select("id, name, username, pass_hash, login_aktiv, zugang_checkin").eq("id", stored.id).maybeSingle();
    if (error) throw error;
    if (!data || data.login_aktiv === false || !data.username) { ciLogout(); return false; }
    if (data.zugang_checkin !== true) { ciLogout("Für diesen Zugang sind die Check-ins nicht freigeschaltet."); return false; }
    const tok = await gekoSessionTok(data.id, data.pass_hash);
    if (tok !== stored.tok) { ciLogout(); return false; }
    ciUser = { id: data.id, name: data.name, username: data.username };
    stored.name = data.name;
    try { localStorage.setItem(CI_AUTH_KEY, JSON.stringify(stored)); } catch (e) {}
    ciSetHeaderWho();
    return true;
  } catch (e) {
    // Kein Netz -> der gespeicherten Anmeldung vertrauen (nicht ausloggen)
    ciUser = { id: stored.id, name: stored.name || "", username: stored.username || "" };
    ciSetHeaderWho();
    return true;
  }
}

function ciSetHeaderWho() {
  const el = document.getElementById("ci_who");
  if (el) el.innerHTML = ciUser
    ? `Angemeldet als<br><b>${escapeHtml(ciUser.name || ciUser.username)}</b> · <button onclick="ciLogout()">Abmelden</button>`
    : "";
}

function ciRenderLogin(fehler) {
  ciUser = null;
  const who = document.getElementById("ci_who"); if (who) who.innerHTML = "";
  const view = document.getElementById("view");
  if (!view) return;
  view.innerHTML = `
    <div class="ci-login">
      <div class="lg-badge">📍</div>
      <h2>Check-ins</h2>
      <p class="sub">Melde dich mit deinem Benutzernamen an.<br>Du bleibst danach angemeldet.</p>
      ${fehler ? `<div class="ci-login-err">${escapeHtml(fehler)}</div>` : ""}
      <div class="field"><label>Benutzername</label>
        <input class="f-in" type="text" id="ci_login_user" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" /></div>
      <div class="field"><label>Passwort</label>
        <input class="f-in" type="password" id="ci_login_pass" autocomplete="current-password" /></div>
      <button class="btn-pri" id="ci_login_btn" style="width:100%;margin-top:6px;padding:14px;" onclick="ciDoLogin()">Anmelden</button>
    </div>`;
  const pass = document.getElementById("ci_login_pass");
  if (pass) pass.addEventListener("keydown", (e) => { if (e.key === "Enter") ciDoLogin(); });
}

async function ciDoLogin() {
  const user = (document.getElementById("ci_login_user")?.value || "").trim().toLowerCase();
  const pass = document.getElementById("ci_login_pass")?.value || "";
  if (!user || !pass) { ciRenderLogin("Bitte Benutzername und Passwort eingeben."); return; }
  const btn = document.getElementById("ci_login_btn");
  if (btn) { btn.disabled = true; btn.textContent = "Prüfe…"; }
  try {
    const { data, error } = await sb.from("glas_mitarbeiter")
      .select("id, name, username, pass_hash, pass_salt, login_aktiv, zugang_checkin").eq("username", user).maybeSingle();
    if (error) throw error;
    if (!data || !data.username || !data.pass_hash) { ciRenderLogin("Benutzername oder Passwort falsch."); return; }
    if (data.login_aktiv === false) { ciRenderLogin("Dieser Zugang ist gesperrt. Bitte im Büro melden."); return; }
    const h = await gekoHashPw(pass, data.pass_salt || "");
    if (h !== data.pass_hash) { ciRenderLogin("Benutzername oder Passwort falsch."); return; }
    if (data.zugang_checkin !== true) { ciRenderLogin("Für diesen Zugang sind die Check-ins nicht freigeschaltet. Bitte im Büro melden."); return; }
    const tok = await gekoSessionTok(data.id, data.pass_hash);
    try { localStorage.setItem(CI_AUTH_KEY, JSON.stringify({ id: data.id, tok, name: data.name, username: data.username })); } catch (e) {}
    ciUser = { id: data.id, name: data.name, username: data.username };
    ciInit();
  } catch (e) {
    ciRenderLogin("Keine Verbindung. Bitte Internet prüfen und erneut versuchen.");
  }
}

function ciLogout(msg) {
  try { localStorage.removeItem(CI_AUTH_KEY); } catch (e) {}
  ciUser = null;
  ciRenderLogin(msg);
}

/* ---------------- Offline-Warteschlange ---------------- */
function ciLoadQueue() { try { return JSON.parse(localStorage.getItem(CI_QUEUE_KEY) || "[]"); } catch (e) { return []; } }
function ciSaveQueue(q) { try { localStorage.setItem(CI_QUEUE_KEY, JSON.stringify(q)); } catch (e) {} }

async function ciFlushQueue() {
  let q = ciLoadQueue();
  if (!q.length) return;
  const rest = [];
  for (const item of q) {
    try {
      const { error } = await sb.from("checkin_logs").insert(item);
      if (error) { rest.push(item); } // Server erreichbar, aber abgelehnt -> behalten (nächster Versuch)
    } catch (e) {
      rest.push(item); // Netzfehler -> behalten
    }
  }
  ciSaveQueue(rest);
}

/* ---------------- Daten laden ---------------- */
async function ciLoadData() {
  if (!ciUser) return;
  try {
    const heute = ciTodayIso();
    // Wochengrenzen (Mo–So dieser Woche) für den Verlauf
    const now = new Date();
    const montag = new Date(now); montag.setDate(now.getDate() - (ciIsoDay(now) - 1));
    const vonIso = ciIsoFromDate(montag);

    const [rgRes, ptRes, logRes] = await Promise.all([
      sb.from("checkin_rundgaenge").select("*").eq("aktiv", true),
      sb.from("checkin_punkte").select("*"),
      sb.from("checkin_logs").select("*").eq("mitarbeiter_id", ciUser.id).gte("datum", vonIso),
    ]);
    const punkte = {};
    (ptRes.data || []).forEach((p) => { punkte[p.id] = p; });
    // nur Rundgänge für mich (mir zugeteilt oder "alle")
    const rundgaenge = (rgRes.data || []).filter((r) => !r.mitarbeiter_id || r.mitarbeiter_id === ciUser.id);
    ciData = { rundgaenge, punkte, logs: (logRes.data || []), heute };
  } catch (e) {
    // offline: alte ciData behalten
  }
}

// Hat MEIN Nutzer heute an diesem (rundgang, punkt) eingecheckt? Berücksichtigt auch
// die Offline-Warteschlange, damit der Punkt sofort als erledigt erscheint.
function ciHatCheckin(rundgangId, punktId) {
  const heute = ciTodayIso();
  const inLogs = (ciData.logs || []).some((l) => l.rundgang_id === rundgangId && l.punkt_id === punktId && l.datum === heute);
  if (inLogs) return true;
  return ciLoadQueue().some((l) => l.rundgang_id === rundgangId && l.punkt_id === punktId && l.datum === heute);
}

// Log-Eintrag (heute) für Anzeige (Uhrzeit/Entfernung) – aus Logs oder Queue.
function ciCheckinInfo(rundgangId, punktId) {
  const heute = ciTodayIso();
  return (ciData.logs || []).find((l) => l.rundgang_id === rundgangId && l.punkt_id === punktId && l.datum === heute)
    || ciLoadQueue().find((l) => l.rundgang_id === rundgangId && l.punkt_id === punktId && l.datum === heute)
    || null;
}

/* ---------------- Rendern ---------------- */
function ciRender() {
  if (!ciUser) return;
  const view = document.getElementById("view");
  if (!view) return;
  view.innerHTML = `
    <div class="seg">
      <button class="${ciSeg === "heute" ? "on" : ""}" onclick="ciSegTo('heute')">Heute</button>
      <button class="${ciSeg === "verlauf" ? "on" : ""}" onclick="ciSegTo('verlauf')">Verlauf</button>
    </div>
    <div class="view on">${ciSeg === "heute" ? ciRenderHeute() : ciRenderVerlauf()}</div>`;
}

function ciSegTo(s) { ciSeg = s; ciRender(); }

function ciRenderHeute() {
  const queued = ciLoadQueue().length;
  const heute = ciTodayIso();
  const rgs = (ciData.rundgaenge || []).filter((r) => ciRundgangLaeuftAn(r, heute));
  let html = "";
  if (queued) html += `<div class="offline-chip">📴 ${queued} Check-in${queued > 1 ? "s warten" : " wartet"} aufs Senden – wird automatisch nachgeholt</div>`;

  if (!rgs.length) {
    return html + `<div class="card-x"><p class="ci-empty">Heute ist kein Rundgang für dich geplant. 🎉</p></div>`;
  }

  const now = ciNowMin();
  html += `<div class="ci-stagger">`;
  rgs.forEach((rg) => {
    const eintraege = ciRundgangPunkte(rg);
    const gesamt = eintraege.length;
    const erledigt = eintraege.filter((e) => ciHatCheckin(rg.id, e.punkt_id)).length;
    const proz = gesamt ? Math.round((erledigt / gesamt) * 100) : 0;

    html += `<div class="rg">
      <div class="rg-t"><span class="rg-name">${escapeHtml(rg.name)}</span><span class="rg-count"><b>${erledigt}</b> / ${gesamt} erledigt</span></div>
      <div class="bar"><i style="width:${proz}%"></i></div>
      <div class="rg-sub">${ciParseTage(rg.tage).map((t) => CI_TAGE_KURZ[t - 1]).join(", ")}</div>
    </div>`;

    eintraege.forEach((e) => {
      const punkt = ciData.punkte[e.punkt_id];
      if (!punkt) return;
      const fenster = ciEffFenster(rg, e, punkt);
      const done = ciHatCheckin(rg.id, e.punkt_id);
      const status = ciPunktStatus(fenster, now, done);
      html += ciRenderPunktKarte(rg, e, punkt, fenster, status);
    });
  });
  html += `</div>`;
  return html;
}

function ciRenderPunktKarte(rg, eintrag, punkt, fenster, status) {
  const id = `${rg.id}__${punkt.id}`;
  const fensterTxt = ciFensterLabel(fenster);
  const stMeta = {
    done: ["done", "st-done", "erledigt", "✅"],
    now: ["now", "st-now", "JETZT", "📍"],
    later: ["later", "st-later", "später", "🕐"],
    miss: ["miss", "st-miss", "verpasst", "⚠️"],
    open: ["", "st-open", "offen", "📍"],
  }[status];

  let body = "";
  if (status === "done") {
    const info = ciCheckinInfo(rg.id, punkt.id);
    const dist = info && info.distanz_m != null ? ` · ${info.distanz_m} m` : "";
    const zeit = info && info.ts ? ciUhrzeit(info.ts) + " Uhr" : "erledigt";
    body = `<div class="body" style="padding-top:8px;margin-top:8px;"><span class="meta-done">✓ ${escapeHtml(zeit)}${escapeHtml(dist)}${info && info.pending ? " · wird gesendet" : ""}</span></div>`;
  } else if (status === "now" || status === "open") {
    const mapUrl = (punkt.lat != null && punkt.lng != null)
      ? `https://www.google.com/maps/dir/?api=1&destination=${punkt.lat},${punkt.lng}` : "";
    body = `<div class="body">
      ${punkt.hinweis ? `<div class="hint">💡 <span>${escapeHtml(punkt.hinweis)}</span></div>` : ""}
      <div class="pt-actions">
        ${mapUrl ? `<a class="route-btn" href="${mapUrl}" target="_blank" rel="noopener">🧭 Route</a>` : ""}
        ${punkt.adresse ? `<span class="route-btn" style="cursor:default;">${escapeHtml(punkt.adresse)}</span>` : ""}
      </div>
      <button class="ci-btn" id="btn_${id}" onclick="ciDoCheckin('${rg.id}','${punkt.id}')">📍 Jetzt einchecken</button>
      <div class="gps-err" id="err_${id}"></div>
    </div>`;
  } else if (status === "later") {
    body = `<div class="body" style="padding-top:8px;margin-top:8px;"><span class="muted" style="font-size:12.5px;">Zeitfenster ${escapeHtml(fensterTxt)} – noch nicht offen.</span></div>`;
  }

  return `<div class="pt ${stMeta[0]}" id="card_${id}">
    <div class="head">
      <div class="ic">${stMeta[3]}</div>
      <div class="pm">
        <div class="pn">${escapeHtml(punkt.name)}</div>
        <div class="ps">Fenster ${escapeHtml(fensterTxt)}</div>
      </div>
      <span class="st ${stMeta[1]}">${stMeta[2]}</span>
    </div>
    ${body}
  </div>`;
}

/* ---------------- Check-in durchführen ---------------- */
function ciDoCheckin(rundgangId, punktId) {
  if (ciBusyPunkt) return;
  const punkt = ciData.punkte[punktId];
  if (!punkt) return;
  const id = `${rundgangId}__${punktId}`;
  const btn = document.getElementById(`btn_${id}`);
  const err = document.getElementById(`err_${id}`);
  if (err) err.classList.remove("show");

  if (!navigator.geolocation) {
    if (err) { err.innerHTML = "❌ Dieses Gerät kann keine GPS-Position bestimmen."; err.classList.add("show"); }
    return;
  }
  ciBusyPunkt = punktId;
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spin"></span> GPS wird ermittelt…`; }

  navigator.geolocation.getCurrentPosition(
    (pos) => ciOnPosition(rundgangId, punkt, pos),
    (geoErr) => ciOnGeoError(id, geoErr),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function ciResetBtn(id) {
  ciBusyPunkt = null;
  const btn = document.getElementById(`btn_${id}`);
  if (btn) { btn.disabled = false; btn.innerHTML = "📍 Jetzt einchecken"; }
}

function ciOnGeoError(id, geoErr) {
  const err = document.getElementById(`err_${id}`);
  let msg = "❌ GPS-Position konnte nicht ermittelt werden. Bitte erneut versuchen.";
  if (geoErr && geoErr.code === 1) msg = "❌ Standort ist blockiert. Bitte in den Einstellungen für den Browser erlauben.";
  else if (geoErr && geoErr.code === 3) msg = "❌ GPS hat zu lange gebraucht. Bitte an einem freieren Ort erneut versuchen.";
  if (err) { err.innerHTML = msg; err.classList.add("show"); }
  showToast("Check-in nicht möglich");
  ciResetBtn(id);
}

async function ciOnPosition(rundgangId, punkt, pos) {
  const id = `${rundgangId}__${punkt.id}`;
  const btn = document.getElementById(`btn_${id}`);
  const err = document.getElementById(`err_${id}`);
  const lat = pos.coords.latitude, lng = pos.coords.longitude;

  // Kein hinterlegter Punkt-Standort -> Entfernung unbekannt, trotzdem protokollieren.
  let dist = null;
  if (punkt.lat != null && punkt.lng != null) {
    dist = ciDistanzMeter(lat, lng, punkt.lat, punkt.lng);
    const radius = parseInt(punkt.radius, 10) || 100;
    if (dist > radius) {
      if (err) { err.innerHTML = `❌ Zu weit entfernt: <b>${dist} m</b> vom Punkt (erlaubt: ${radius} m).<br>Bitte vor Ort erneut einchecken – nichts wurde gespeichert.`; err.classList.add("show"); }
      showToast("❌ Nicht gespeichert – zu weit weg");
      ciResetBtn(id);
      return;
    }
  }

  if (btn) btn.innerHTML = `<span class="spin"></span> Wird gespeichert…`;

  const eintrag = {
    id: genCode() + genCode(),
    rundgang_id: rundgangId,
    punkt_id: punkt.id,
    mitarbeiter_id: ciUser.id,
    mitarbeiter_name: ciUser.name || ciUser.username || "",
    ts: new Date().toISOString(),
    datum: ciTodayIso(),
    lat, lng, distanz_m: dist,
  };

  let gespeichert = false;
  try {
    const { error } = await sb.from("checkin_logs").insert(eintrag);
    if (!error) gespeichert = true;
    else { ciQueue(eintrag); } // Server abgelehnt (z.B. offline-Antwort) -> Warteschlange
  } catch (e) {
    ciQueue(eintrag); // Netzfehler -> Warteschlange, wird automatisch nachgesendet
  }

  if (gespeichert) {
    ciData.logs = ciData.logs || [];
    ciData.logs.push(eintrag);
    showToast("📍 Check-in gespeichert ✓");
  } else {
    showToast("📴 Gespeichert – wird gesendet, sobald Empfang da ist");
  }
  ciBusyPunkt = null;
  ciRender();
}

function ciQueue(item) {
  const q = ciLoadQueue();
  item.pending = true;
  q.push(item);
  ciSaveQueue(q);
}

/* ---------------- Verlauf ---------------- */
function ciRenderVerlauf() {
  const logs = (ciData.logs || []).slice();
  // Woche Mo–So
  const now = new Date();
  const montag = new Date(now); montag.setDate(now.getDate() - (ciIsoDay(now) - 1));
  const wochenTage = [];
  for (let i = 0; i < 7; i++) { const d = new Date(montag); d.setDate(montag.getDate() + i); wochenTage.push(ciIsoFromDate(d)); }

  const rgs = ciData.rundgaenge || [];
  let grid = `<div class="wk-grid"><span></span>${CI_TAGE_KURZ.map((t) => `<span class="hd">${t}</span>`).join("")}`;
  rgs.forEach((rg) => {
    const eintraege = ciRundgangPunkte(rg);
    grid += `<span class="lbl">${escapeHtml(rg.name)}</span>`;
    wochenTage.forEach((iso) => {
      if (!ciRundgangLaeuftAn(rg, iso) || iso > ciTodayIso()) { grid += `<span class="cellb c-off">·</span>`; return; }
      const done = eintraege.filter((e) => logs.some((l) => l.rundgang_id === rg.id && l.punkt_id === e.punkt_id && l.datum === iso)).length;
      const res = ciRundgangErgebnis(done, eintraege.length);
      const cls = res === "ok" ? "c-ok" : res === "part" ? "c-part" : res === "miss" ? "c-miss" : "c-off";
      const txt = res === "ok" ? "✓" : res === "part" ? `${done}/${eintraege.length}` : res === "miss" ? "✗" : "·";
      grid += `<span class="cellb ${cls}">${txt}</span>`;
    });
  });
  grid += `</div>`;

  const letzte = logs.slice().sort((a, b) => (b.ts || "").localeCompare(a.ts || "")).slice(0, 12);
  const letzteHtml = letzte.length ? letzte.map((l) => {
    const p = ciData.punkte[l.punkt_id];
    const dist = l.distanz_m != null ? ` · ${l.distanz_m} m` : "";
    return `<div class="hist-row"><span class="t">${escapeHtml(ciUhrzeit(l.ts))}</span><span class="dotc" style="background:var(--green)"></span><span>${escapeHtml((p && p.name) || "Punkt")}${escapeHtml(dist)}</span></div>`;
  }).join("") : `<p class="ci-empty">Noch keine Check-ins diese Woche.</p>`;

  return `
    <div class="ci-stagger">
      <div class="week"><h4>Meine Woche</h4>${rgs.length ? grid : `<p class="ci-empty">Dir ist noch kein Rundgang zugeteilt.</p>`}</div>
      <div class="week"><h4>Letzte Check-ins</h4>${letzteHtml}</div>
    </div>
    <p class="muted" style="font-size:11.5px;margin:4px 4px 0;">Die volle Monats-Auswertung sieht das Büro im Admin-Bereich.</p>`;
}
