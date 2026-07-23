// ============================================================================
// GEKO Check-ins – Mitarbeiter-App
// Anmeldung mit denselben Konten wie die Glas-Touren-App (Tabelle glas_mitarbeiter),
// zusätzlich muss der Admin "zugang_checkin" freigeschaltet haben.
// Umschaltbar Deutsch / Albanisch (Kosovo). Rundgänge & Stopps zum Aufklappen.
// ============================================================================

const CI_AUTH_KEY = "geko_ci_auth";           // eigene Sitzung (getrennt von Glas)
const CI_QUEUE_KEY = "ci_pending_checkins";   // Offline-Warteschlange
const CI_LANG_KEY = "geko_ci_lang";
let ciUser = null;                             // {id, name, username}
let ciSeg = "heute";                           // aktueller Reiter
let ciData = { rundgaenge: [], punkte: {}, logs: [] };
let ciBusyPunkt = null;                         // Punkt-ID, für den gerade eingecheckt wird
let ciLang = "de";
let ciOpenRg = {};                              // {rundgangId: true} aufgeklappte Rundgänge
let ciOpenStop = {};                            // {"rg__pt": true} aufgeklappte Stopps

/* ---------------- Übersetzungen (Deutsch / Albanisch-Kosovo) ---------------- */
const CI_T = {
  de: {
    heute: "Heute", verlauf: "Verlauf",
    erledigtVon: "erledigt", jetzt: "JETZT", spaeter: "später", verpasst: "verpasst", erledigt: "erledigt", offen: "offen",
    fenster: "Fenster", jederzeit: "jederzeit", uhr: " Uhr", vomPunkt: "m",
    einchecken: "📍 Jetzt einchecken", gpsErmittelt: "GPS wird ermittelt…", wirdGespeichert: "Wird gespeichert…",
    route: "🧭 Route", nichtOffen: "– noch nicht offen.",
    keinRundgang: "Heute ist kein Rundgang für dich geplant. 🎉",
    wirdGesendet: "· wird gesendet",
    meineWoche: "Meine Woche", letzteCheckins: "Letzte Check-ins",
    keineWoche: "Noch keine Check-ins diese Woche.", keinZugeteilt: "Dir ist noch kein Rundgang zugeteilt.",
    volleAuswertung: "Die volle Monats-Auswertung sieht das Büro im Admin-Bereich.",
    loginTitel: "Check-ins", loginSub: "Melde dich mit deinem Benutzernamen an.<br>Du bleibst danach angemeldet.",
    benutzer: "Benutzername", passwort: "Passwort", anmelden: "Anmelden", pruefe: "Prüfe…",
    errFelder: "Bitte Benutzername und Passwort eingeben.", errFalsch: "Benutzername oder Passwort falsch.",
    errGesperrt: "Dieser Zugang ist gesperrt. Bitte im Büro melden.",
    errNichtFrei: "Für diesen Zugang sind die Check-ins nicht freigeschaltet. Bitte im Büro melden.",
    errVerbindung: "Keine Verbindung. Bitte Internet prüfen und erneut versuchen.",
    tGespeichert: "📍 Check-in gespeichert ✓", tOffline: "📴 Gespeichert – wird gesendet, sobald Empfang da ist",
    tZuWeit: "❌ Nicht gespeichert – zu weit weg", tNichtMoeglich: "Check-in nicht möglich",
    gpsWeit: (d) => `❌ Zu weit entfernt: <b>${d} m</b> vom Punkt.<br>Bitte vor Ort erneut einchecken – nichts wurde gespeichert.`,
    gpsKein: "❌ Dieses Gerät kann keine GPS-Position bestimmen.",
    gpsBlock: "❌ Standort ist blockiert. Bitte in den Einstellungen für den Browser erlauben.",
    gpsTimeout: "❌ GPS hat zu lange gebraucht. Bitte an einem freieren Ort erneut versuchen.",
    angemeldet: "Angemeldet als", abmelden: "Abmelden",
    offlineWartet: (n) => `📴 ${n} Check-in${n > 1 ? "s warten" : " wartet"} aufs Senden – wird automatisch nachgeholt`,
    tageKurz: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
    tageLang: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
    monate: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
    datum: (dLang, tag, monat) => `${dLang}, ${tag}. ${monat}`,
  },
  sq: {
    heute: "Sot", verlauf: "Historiku",
    erledigtVon: "kryer", jetzt: "TANI", spaeter: "më vonë", verpasst: "humbur", erledigt: "kryer", offen: "hapur",
    fenster: "Orari", jederzeit: "kurdo", uhr: "", vomPunkt: "m",
    einchecken: "📍 Bëj check-in", gpsErmittelt: "Po merret GPS…", wirdGespeichert: "Po ruhet…",
    route: "🧭 Rruga", nichtOffen: "– ende s'është hapur.",
    keinRundgang: "Sot s'ke turne të planifikuar. 🎉",
    wirdGesendet: "· po dërgohet",
    meineWoche: "Java ime", letzteCheckins: "Check-in-et e fundit",
    keineWoche: "Ende s'ka check-in këtë javë.", keinZugeteilt: "S'të është caktuar ende turne.",
    volleAuswertung: "Vlerësimin e plotë mujor e sheh vetëm zyra.",
    loginTitel: "Check-ins", loginSub: "Kyçu me emrin tënd të përdoruesit.<br>Mbetesh i kyçur.",
    benutzer: "Emri i përdoruesit", passwort: "Fjalëkalimi", anmelden: "Kyçu", pruefe: "Po kontrollohet…",
    errFelder: "Shkruaj emrin dhe fjalëkalimin.", errFalsch: "Emri ose fjalëkalimi gabim.",
    errGesperrt: "Ky akses është bllokuar. Lajmëro zyrën.",
    errNichtFrei: "Check-in-et s'janë aktivizuar për këtë akses. Lajmëro zyrën.",
    errVerbindung: "S'ka lidhje. Kontrollo internetin dhe provo prapë.",
    tGespeichert: "📍 Check-in u ruajt ✓", tOffline: "📴 U ruajt – dërgohet kur ka internet",
    tZuWeit: "❌ Nuk u ruajt – shumë larg", tNichtMoeglich: "Check-in s'është i mundur",
    gpsWeit: (d) => `❌ Shumë larg: <b>${d} m</b> nga pika.<br>Regjistrohu në vend – asgjë s'u ruajt.`,
    gpsKein: "❌ Kjo pajisje s'e gjen dot pozicionin GPS.",
    gpsBlock: "❌ Vendndodhja është e bllokuar. Lejo GPS-in te cilësimet e shfletuesit.",
    gpsTimeout: "❌ GPS-i mori shumë kohë. Provo në një vend më të hapur.",
    angemeldet: "I kyçur si", abmelden: "Dil",
    offlineWartet: (n) => `📴 ${n} check-in po pret dërgimin – dërgohet automatikisht`,
    tageKurz: ["Hën", "Mar", "Mër", "Enj", "Pre", "Sht", "Die"],
    tageLang: ["E hënë", "E martë", "E mërkurë", "E enjte", "E premte", "E shtunë", "E diel"],
    monate: ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"],
    datum: (dLang, tag, monat) => `${dLang}, ${tag} ${monat}`,
  },
};
function t(k) { const o = CI_T[ciLang] || CI_T.de; return o[k] !== undefined ? o[k] : CI_T.de[k]; }

document.addEventListener("DOMContentLoaded", ciInit);

async function ciInit() {
  try { ciLang = localStorage.getItem(CI_LANG_KEY) || "de"; } catch (e) {}
  ciSetHeaderDate();
  ciSetHeaderWho();
  const ok = await ciEnsureLoggedIn();
  if (!ok) return; // Login-Screen läuft
  ciRender();
  await ciFlushQueue();
  await ciLoadData();
  ciRender();
  window.addEventListener("online", () => ciFlushQueue().then(() => ciLoadData().then(ciRender)));
}

function ciSetLang(l) {
  ciLang = l;
  try { localStorage.setItem(CI_LANG_KEY, l); } catch (e) {}
  ciSetHeaderDate();
  ciSetHeaderWho();
  if (ciUser) ciRender(); else ciRenderLogin();
}

function ciLangToggleHtml() {
  return `<span class="ci-lang">
    <button class="${ciLang === "de" ? "on" : ""}" onclick="event.stopPropagation();ciSetLang('de')">🇩🇪 DE</button>
    <button class="${ciLang === "sq" ? "on" : ""}" onclick="event.stopPropagation();ciSetLang('sq')">🇦🇱 SQ</button></span>`;
}

function ciSetHeaderDate() {
  const el = document.getElementById("ci_date");
  if (!el) return;
  const d = new Date();
  el.textContent = t("datum")(t("tageLang")[ciIsoDay(d) - 1], d.getDate(), t("monate")[d.getMonth()]);
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
    if (data.zugang_checkin !== true) { ciLogout(t("errNichtFrei")); return false; }
    const tok = await gekoSessionTok(data.id, data.pass_hash);
    if (tok !== stored.tok) { ciLogout(); return false; }
    ciUser = { id: data.id, name: data.name, username: data.username };
    stored.name = data.name;
    try { localStorage.setItem(CI_AUTH_KEY, JSON.stringify(stored)); } catch (e) {}
    ciSetHeaderWho();
    return true;
  } catch (e) {
    ciUser = { id: stored.id, name: stored.name || "", username: stored.username || "" };
    ciSetHeaderWho();
    return true;
  }
}

function ciSetHeaderWho() {
  const el = document.getElementById("ci_who");
  if (!el) return;
  el.innerHTML = ciLangToggleHtml() + (ciUser
    ? `<div class="who-line">${t("angemeldet")}<br><b>${escapeHtml(ciUser.name || ciUser.username)}</b> · <button onclick="ciLogout()">${t("abmelden")}</button></div>`
    : "");
}

function ciRenderLogin(fehler) {
  ciUser = null;
  ciSetHeaderWho();
  const view = document.getElementById("view");
  if (!view) return;
  view.innerHTML = `
    <div class="ci-login">
      <div class="lg-badge">📍</div>
      <h2>${t("loginTitel")}</h2>
      <p class="sub">${t("loginSub")}</p>
      ${fehler ? `<div class="ci-login-err">${escapeHtml(fehler)}</div>` : ""}
      <div class="field"><label>${t("benutzer")}</label>
        <input class="f-in" type="text" id="ci_login_user" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" /></div>
      <div class="field"><label>${t("passwort")}</label>
        <input class="f-in" type="password" id="ci_login_pass" autocomplete="current-password" /></div>
      <button class="btn-pri" id="ci_login_btn" style="width:100%;margin-top:6px;padding:14px;" onclick="ciDoLogin()">${t("anmelden")}</button>
    </div>`;
  const pass = document.getElementById("ci_login_pass");
  if (pass) pass.addEventListener("keydown", (e) => { if (e.key === "Enter") ciDoLogin(); });
}

async function ciDoLogin() {
  const user = (document.getElementById("ci_login_user")?.value || "").trim().toLowerCase();
  const pass = document.getElementById("ci_login_pass")?.value || "";
  if (!user || !pass) { ciRenderLogin(t("errFelder")); return; }
  const btn = document.getElementById("ci_login_btn");
  if (btn) { btn.disabled = true; btn.textContent = t("pruefe"); }
  try {
    const { data, error } = await sb.from("glas_mitarbeiter")
      .select("id, name, username, pass_hash, pass_salt, login_aktiv, zugang_checkin").eq("username", user).maybeSingle();
    if (error) throw error;
    if (!data || !data.username || !data.pass_hash) { ciRenderLogin(t("errFalsch")); return; }
    if (data.login_aktiv === false) { ciRenderLogin(t("errGesperrt")); return; }
    const h = await gekoHashPw(pass, data.pass_salt || "");
    if (h !== data.pass_hash) { ciRenderLogin(t("errFalsch")); return; }
    if (data.zugang_checkin !== true) { ciRenderLogin(t("errNichtFrei")); return; }
    const tok = await gekoSessionTok(data.id, data.pass_hash);
    try { localStorage.setItem(CI_AUTH_KEY, JSON.stringify({ id: data.id, tok, name: data.name, username: data.username })); } catch (e) {}
    ciUser = { id: data.id, name: data.name, username: data.username };
    ciInit();
  } catch (e) {
    ciRenderLogin(t("errVerbindung"));
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
      const clean = { ...item }; delete clean.pending;
      const { error } = await sb.from("checkin_logs").insert(clean);
      if (error) rest.push(item);
    } catch (e) { rest.push(item); }
  }
  ciSaveQueue(rest);
}

/* ---------------- Daten laden ---------------- */
async function ciLoadData() {
  if (!ciUser) return;
  try {
    const heute = ciTodayIso();
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
    const rundgaenge = (rgRes.data || []).filter((r) => !r.mitarbeiter_id || r.mitarbeiter_id === ciUser.id);
    // Standardmäßig ersten Rundgang aufklappen, wenn noch nichts gewählt wurde
    if (!Object.keys(ciOpenRg).length && rundgaenge.length) {
      const heuteRg = rundgaenge.filter((r) => ciRundgangLaeuftAn(r, heute));
      if (heuteRg[0]) ciOpenRg[heuteRg[0].id] = true;
    }
    ciData = { rundgaenge, punkte, logs: (logRes.data || []), heute };
  } catch (e) { /* offline: alte ciData behalten */ }
}

function ciHatCheckin(rundgangId, punktId) {
  const heute = ciTodayIso();
  if ((ciData.logs || []).some((l) => l.rundgang_id === rundgangId && l.punkt_id === punktId && l.datum === heute)) return true;
  return ciLoadQueue().some((l) => l.rundgang_id === rundgangId && l.punkt_id === punktId && l.datum === heute);
}
function ciCheckinInfo(rundgangId, punktId) {
  const heute = ciTodayIso();
  return (ciData.logs || []).find((l) => l.rundgang_id === rundgangId && l.punkt_id === punktId && l.datum === heute)
    || ciLoadQueue().find((l) => l.rundgang_id === rundgangId && l.punkt_id === punktId && l.datum === heute)
    || null;
}

// Status eines Punkts HEUTE, inkl. Start-Gate: vor dem Go-Live-Tag wird nie "verpasst"
// angezeigt, damit man testen kann, ohne dass alles rot/unfertig aussieht.
function ciStatusHeute(fenster, done) {
  const heute = ciTodayIso();
  let st = ciPunktStatus(fenster, ciNowMin(), done);
  if (st === "miss" && !ciZaehltAb(heute)) st = "now"; // vor Start: als machbar zeigen, nicht verpasst
  return st;
}

/* ---------------- Rendern ---------------- */
function ciRender() {
  if (!ciUser) return;
  const view = document.getElementById("view");
  if (!view) return;
  view.innerHTML = `
    <div class="seg">
      <button class="${ciSeg === "heute" ? "on" : ""}" onclick="ciSegTo('heute')">${t("heute")}</button>
      <button class="${ciSeg === "verlauf" ? "on" : ""}" onclick="ciSegTo('verlauf')">${t("verlauf")}</button>
    </div>
    <div class="view on">${ciSeg === "heute" ? ciRenderHeute() : ciRenderVerlauf()}</div>`;
}
function ciSegTo(s) { ciSeg = s; ciRender(); }

// Einheitliche Status-Darstellung (Farbe/Emoji/Label) – ein klares Schema.
function ciStatusMeta(status) {
  return {
    done: { cls: "done", pill: "st-done", ic: "✅", label: t("erledigt") },
    now: { cls: "now", pill: "st-now", ic: "📍", label: t("jetzt") },
    open: { cls: "now", pill: "st-now", ic: "📍", label: t("jetzt") },
    later: { cls: "later", pill: "st-later", ic: "🕐", label: t("spaeter") },
    miss: { cls: "miss", pill: "st-miss", ic: "⚠️", label: t("verpasst") },
  }[status] || { cls: "", pill: "st-later", ic: "📍", label: "" };
}

function ciRenderHeute() {
  const queued = ciLoadQueue().length;
  const heute = ciTodayIso();
  const rgs = (ciData.rundgaenge || []).filter((r) => ciRundgangLaeuftAn(r, heute));
  let html = "";
  if (queued) html += `<div class="offline-chip">${t("offlineWartet")(queued)}</div>`;
  if (!rgs.length) return html + `<div class="card-x"><p class="ci-empty">${t("keinRundgang")}</p></div>`;

  html += `<div class="ci-stagger">`;
  rgs.forEach((rg) => {
    const eintraege = ciSortEintraege(rg, ciRundgangPunkte(rg), ciData.punkte).filter((e) => ciData.punkte[e.punkt_id]);
    const gesamt = eintraege.length;
    const erledigt = eintraege.filter((e) => ciHatCheckin(rg.id, e.punkt_id)).length;
    const proz = gesamt ? Math.round((erledigt / gesamt) * 100) : 0;
    const offen = !!ciOpenRg[rg.id];

    // Gesamtstatus des Rundgangs für die Farbe
    let hatMiss = false, hatNow = false;
    eintraege.forEach((e) => {
      const st = ciStatusHeute(ciEffFenster(rg, e, ciData.punkte[e.punkt_id]), ciHatCheckin(rg.id, e.punkt_id));
      if (st === "miss") hatMiss = true; else if (st === "now" || st === "open") hatNow = true;
    });
    const rgStatus = gesamt && erledigt >= gesamt ? "done" : hatMiss ? "miss" : (erledigt > 0 || hatNow) ? "now" : "later";
    const rgm = ciStatusMeta(rgStatus);

    html += `<div class="rg-block">
      <div class="rg ${offen ? "open" : ""}" onclick="ciToggleRg('${rg.id}')">
        <div class="rg-t">
          <span class="rg-name">${escapeHtml(rg.name)}</span>
          <span class="rg-right"><span class="rg-count"><b>${erledigt}</b> / ${gesamt} ${t("erledigtVon")}</span><span class="chev">▾</span></span>
        </div>
        <div class="bar"><i style="width:${proz}%;background:${rgStatus === "miss" ? "var(--red)" : "var(--green)"}"></i></div>
        <div class="rg-sub">${ciParseTage(rg.tage).map((x) => t("tageKurz")[x - 1]).join(", ")}</div>
      </div>
      ${offen ? `<div class="rg-stops">${eintraege.map((e) => ciRenderStop(rg, e)).join("")}</div>` : ""}
    </div>`;
  });
  html += `</div>`;
  return html;
}

function ciRenderStop(rg, eintrag) {
  const punkt = ciData.punkte[eintrag.punkt_id];
  const fenster = ciEffFenster(rg, eintrag, punkt);
  const done = ciHatCheckin(rg.id, eintrag.punkt_id);
  const status = ciStatusHeute(fenster, done);
  const m = ciStatusMeta(status);
  const id = `${rg.id}__${punkt.id}`;
  const offen = !!ciOpenStop[id];
  const fensterTxt = `${t("fenster")} ${ciFensterLabel(fenster)}`;
  const sub = punkt.adresse
    ? `${escapeHtml(fensterTxt)}<span class="pt-adr">${escapeHtml(punkt.adresse)}</span>`
    : escapeHtml(fensterTxt);

  let body = "";
  if (offen) {
    if (status === "done") {
      const info = ciCheckinInfo(rg.id, punkt.id);
      const dist = info && info.distanz_m != null ? ` · ${info.distanz_m} ${t("vomPunkt")}` : "";
      const zeit = info && info.ts ? ciUhrzeit(info.ts) + t("uhr") : t("erledigt");
      body = `<div class="body" style="padding-top:9px;margin-top:9px;"><span class="meta-done">✓ ${escapeHtml(zeit)}${escapeHtml(dist)}${info && info.pending ? " " + t("wirdGesendet") : ""}</span></div>`;
    } else if (status === "later") {
      body = `<div class="body" style="padding-top:9px;margin-top:9px;"><span class="muted" style="font-size:12.5px;">${escapeHtml(t("fenster") + " " + ciFensterLabel(fenster))} ${escapeHtml(t("nichtOffen"))}</span></div>`;
    } else {
      const mapUrl = (punkt.lat != null && punkt.lng != null)
        ? `https://www.google.com/maps/dir/?api=1&destination=${punkt.lat},${punkt.lng}` : "";
      body = `<div class="body">
        ${punkt.hinweis ? `<div class="hint">💡 <span>${escapeHtml(punkt.hinweis)}</span></div>` : ""}
        ${mapUrl ? `<div class="pt-actions"><a class="route-btn" href="${mapUrl}" target="_blank" rel="noopener">${t("route")}</a></div>` : ""}
        <button class="ci-btn" id="btn_${id}" onclick="event.stopPropagation();ciDoCheckin('${rg.id}','${punkt.id}')">${t("einchecken")}</button>
        <div class="gps-err" id="err_${id}"></div>
      </div>`;
    }
  }

  return `<div class="pt ${m.cls} ${offen ? "open" : ""}" id="card_${id}">
    <div class="head" onclick="ciToggleStop('${id}')">
      <div class="ic">${m.ic}</div>
      <div class="pm"><div class="pn">${escapeHtml(punkt.name)}</div><div class="ps">${sub}</div></div>
      <span class="st ${m.pill}">${m.label}</span>
      <span class="chev">▾</span>
    </div>
    ${body}
  </div>`;
}

function ciToggleRg(id) { ciOpenRg[id] = !ciOpenRg[id]; ciRender(); }
function ciToggleStop(id) { ciOpenStop[id] = !ciOpenStop[id]; ciRender(); }

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
    if (err) { err.innerHTML = t("gpsKein"); err.classList.add("show"); }
    return;
  }
  ciBusyPunkt = punktId;
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spin"></span> ${t("gpsErmittelt")}`; }
  navigator.geolocation.getCurrentPosition(
    (pos) => ciOnPosition(rundgangId, punkt, pos),
    (geoErr) => ciOnGeoError(id, geoErr),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function ciResetBtn(id) {
  ciBusyPunkt = null;
  const btn = document.getElementById(`btn_${id}`);
  if (btn) { btn.disabled = false; btn.innerHTML = t("einchecken"); }
}
function ciOnGeoError(id, geoErr) {
  const err = document.getElementById(`err_${id}`);
  let msg = t("gpsKein");
  if (geoErr && geoErr.code === 1) msg = t("gpsBlock");
  else if (geoErr && geoErr.code === 3) msg = t("gpsTimeout");
  if (err) { err.innerHTML = msg; err.classList.add("show"); }
  showToast(t("tNichtMoeglich"));
  ciResetBtn(id);
}

async function ciOnPosition(rundgangId, punkt, pos) {
  const id = `${rundgangId}__${punkt.id}`;
  const btn = document.getElementById(`btn_${id}`);
  const err = document.getElementById(`err_${id}`);
  const lat = pos.coords.latitude, lng = pos.coords.longitude;
  let dist = null;
  if (punkt.lat != null && punkt.lng != null) {
    dist = ciDistanzMeter(lat, lng, punkt.lat, punkt.lng);
    const radius = parseInt(punkt.radius, 10) || 100;
    if (dist > radius) {
      if (err) { err.innerHTML = t("gpsWeit")(dist); err.classList.add("show"); }
      showToast(t("tZuWeit"));
      ciResetBtn(id);
      return;
    }
  }
  if (btn) btn.innerHTML = `<span class="spin"></span> ${t("wirdGespeichert")}`;
  const eintrag = {
    id: genCode() + genCode(), rundgang_id: rundgangId, punkt_id: punkt.id,
    mitarbeiter_id: ciUser.id, mitarbeiter_name: ciUser.name || ciUser.username || "",
    ts: new Date().toISOString(), datum: ciTodayIso(), lat, lng, distanz_m: dist,
  };
  let gespeichert = false;
  try {
    const { error } = await sb.from("checkin_logs").insert(eintrag);
    if (!error) gespeichert = true; else ciQueue(eintrag);
  } catch (e) { ciQueue(eintrag); }
  if (gespeichert) {
    ciData.logs = ciData.logs || [];
    ciData.logs.push(eintrag);
    showToast(t("tGespeichert"));
  } else {
    showToast(t("tOffline"));
  }
  ciBusyPunkt = null;
  ciOpenStop[id] = false; // erledigten Stopp wieder einklappen (Übersicht)
  ciRender();
}
function ciQueue(item) { const q = ciLoadQueue(); item.pending = true; q.push(item); ciSaveQueue(q); }

/* ---------------- Verlauf ---------------- */
function ciRenderVerlauf() {
  const logs = (ciData.logs || []).slice();
  const now = new Date();
  const montag = new Date(now); montag.setDate(now.getDate() - (ciIsoDay(now) - 1));
  const wochenTage = [];
  for (let i = 0; i < 7; i++) { const d = new Date(montag); d.setDate(montag.getDate() + i); wochenTage.push(ciIsoFromDate(d)); }
  const rgs = ciData.rundgaenge || [];
  let grid = `<div class="wk-grid"><span></span>${t("tageKurz").map((x) => `<span class="hd">${x}</span>`).join("")}`;
  rgs.forEach((rg) => {
    const eintraege = ciRundgangPunkte(rg);
    grid += `<span class="lbl">${escapeHtml(rg.name)}</span>`;
    wochenTage.forEach((iso) => {
      if (!ciRundgangLaeuftAn(rg, iso) || iso > ciTodayIso() || !ciZaehltAb(iso)) { grid += `<span class="cellb c-off">·</span>`; return; }
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
    const dist = l.distanz_m != null ? ` · ${l.distanz_m} ${t("vomPunkt")}` : "";
    return `<div class="hist-row"><span class="t">${escapeHtml(ciUhrzeit(l.ts))}</span><span class="dotc" style="background:var(--green)"></span><span>${escapeHtml((p && p.name) || "Punkt")}${escapeHtml(dist)}</span></div>`;
  }).join("") : `<p class="ci-empty">${t("keineWoche")}</p>`;
  return `
    <div class="ci-stagger">
      <div class="week"><h4>${t("meineWoche")}</h4>${rgs.length ? grid : `<p class="ci-empty">${t("keinZugeteilt")}</p>`}</div>
      <div class="week"><h4>${t("letzteCheckins")}</h4>${letzteHtml}</div>
    </div>
    <p class="muted" style="font-size:11.5px;margin:4px 4px 0;">${t("volleAuswertung")}</p>`;
}
