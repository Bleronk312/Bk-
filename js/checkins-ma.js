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
let ciData = { rundgaenge: [], punkte: {}, logs: [], orte: [], schichten: [] };
let ciBusyPunkt = null;                         // Punkt-ID, für den gerade eingecheckt wird
let ciBusyOrt = null;                           // Ort-ID, für den gerade gestempelt wird
let ciLang = "de";
let ciOpenRg = {};                              // {rundgangId: true} aufgeklappte Rundgänge
let ciOpenStop = {};                            // {"rg__pt": true} aufgeklappte Stopps
let ciTimer = null;                             // Intervall für den Live-Timer (Arbeitszeit)
const CI_SHIFT_QUEUE_KEY = "ci_pending_shifts"; // Offline-Warteschlange für Schichten

/* ---------------- Übersetzungen (Deutsch / Albanisch-Kosovo) ---------------- */
const CI_T = {
  de: {
    heute: "Heute", verlauf: "Verlauf",
    erledigtVon: "erledigt", jetzt: "JETZT", spaeter: "später", verpasst: "verpasst", erledigt: "erledigt", offen: "offen",
    fenster: "Fenster", jederzeit: "jederzeit", uhr: " Uhr", vomPunkt: "m",
    einchecken: "📍 Jetzt einchecken", gpsErmittelt: "GPS wird ermittelt…", wirdGespeichert: "Wird gespeichert…",
    route: "🧭 Route", nichtOffen: "– noch nicht offen.",
    verpasstInfo: "Zeitfenster vorbei – Einchecken ist nicht mehr möglich.",
    keinRundgang: "Heute ist kein Rundgang für dich geplant. 🎉",
    wirdGesendet: "· wird gesendet",
    meineWoche: "Rundgänge diese Woche", letzteCheckins: "Letzte Check-ins",
    vonKollege: (n) => ` · von ${n}`,
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
    // Arbeitszeit
    arbeitszeit: "Arbeitszeit", einchecken2: "📍 Einchecken", auschecken: "📍 Auschecken",
    eingecheckt: "Eingecheckt seit", feierabendUm: "Feierabend um", nochLabel: "noch",
    ueberFeierabend: "über Feierabend – bitte auschecken!",
    einAb: (h) => `Einchecken ab ${h}`, arbeitVorbei: "Arbeitszeit vorbei",
    heuteFrei: "Heute kein Dienst", heuteSchicht: (v, b) => `Heute ${v}–${b}`,
    gezaehlt: "gezählt", heuteFertig: "Heute erledigt", keinArbeitsort: "Dir ist heute kein Arbeitsort zugewiesen.",
    tEin: "✓ Eingecheckt", tAus: "✓ Ausgecheckt – schönen Feierabend!",
    tGpsErmittelnAus: "Auschecken – GPS wird geprüft…",
    bellHint: "Erinnerungen aufs Handy bekommen (Rundgänge & Auschecken)", bellOn: "Aktivieren", bellAktiv: "🔔 Erinnerungen sind aktiv",
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
    verpasstInfo: "Orari kaloi – check-in s'është më i mundur.",
    keinRundgang: "Sot s'ke turne të planifikuar. 🎉",
    wirdGesendet: "· po dërgohet",
    meineWoche: "Turnet këtë javë", letzteCheckins: "Check-in-et e fundit",
    vonKollege: (n) => ` · nga ${n}`,
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
    // Arbeitszeit
    arbeitszeit: "Orari i punës", einchecken2: "📍 Hyr", auschecken: "📍 Dil",
    eingecheckt: "I kyçur që nga", feierabendUm: "Mbaron në", nochLabel: "edhe",
    ueberFeierabend: "mbi orarin – dil tani!",
    einAb: (h) => `Hyrja nga ${h}`, arbeitVorbei: "Orari ka mbaruar",
    heuteFrei: "Sot pa turn", heuteSchicht: (v, b) => `Sot ${v}–${b}`,
    gezaehlt: "numëruar", heuteFertig: "Sot e kryer", keinArbeitsort: "Sot s'të është caktuar vend pune.",
    tEin: "✓ Hyre", tAus: "✓ Dole – ditë të mbarë!",
    tGpsErmittelnAus: "Dalje – po kontrollohet GPS…",
    bellHint: "Merr kujtesa në telefon (turnet & çkyçja)", bellOn: "Aktivizo", bellAktiv: "🔔 Kujtesat janë aktive",
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
  // Benachrichtigungen still erneuern (falls schon erlaubt) – für die Auscheck-Erinnerungen
  if (typeof autoRenewPushSubscription === "function") autoRenewPushSubscription("checkin_ma", ciUser && ciUser.id);
  ciTagAusLink(); // aus GEKO One direkt einen bestimmten Tag öffnen
  ciRender();
  await ciFlushQueue();
  await ciFlushShifts();
  await ciLoadData();
  ciRender();
  window.addEventListener("online", () => Promise.all([ciFlushQueue(), ciFlushShifts()]).then(() => ciLoadData()).then(ciRender));
  // Beim Zurückkehren in die App frische Daten holen: Hat ein Kollege inzwischen einen
  // Punkt eingecheckt, steht er sofort als erledigt da – ohne Runterziehen.
  // Nur wenn gerade kein Check-in/Stempel läuft (sonst würde die Ansicht darunter wegspringen).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (!ciUser || ciBusyPunkt || ciBusyOrt) return;
    ciSetHeaderDate();
    ciLoadData().then(ciRender);
  });
}

function ciSetLang(l) {
  ciLang = l;
  try { localStorage.setItem(CI_LANG_KEY, l); } catch (e) {}
  ciSetHeaderDate();
  ciSetHeaderWho();
  if (ciUser) ciRender(); else ciRenderLogin();
}

// Der Sprach-Umschalter sitzt nicht mehr in der Kopfzeile jeder einzelnen App,
// sondern zentral im GEKO-One-Menü ("Sprache / Gjuha"). Das hielt die Kopfzeilen
// uneinheitlich und war doppelt. Die Funktion bleibt leer, damit alte Aufrufe
// nicht ins Leere laufen.
function ciLangToggleHtml() { return ""; }

function ciSetHeaderDate() {
  const el = document.getElementById("ci_date");
  if (!el) return;
  const d = new Date();
  const ver = typeof ciAppVersion === "function" ? ciAppVersion() : "";
  el.textContent = t("datum")(t("tageLang")[ciIsoDay(d) - 1], d.getDate(), t("monate")[d.getMonth()]) + (ver ? ` · ${ver}` : "");
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
    const [rgRes, ptRes, logRes, orteRes, schichtRes] = await Promise.all([
      sb.from("checkin_rundgaenge").select("*").eq("aktiv", true),
      sb.from("checkin_punkte").select("*"),
      // BEWUSST ohne Mitarbeiter-Filter: Ein Rundgang ist eine GEMEINSAME Aufgabe.
      // Checkt ein Kollege einen Punkt ein, gilt der für alle Zugeteilten als erledigt –
      // niemand muss denselben Stopp ein zweites Mal abhaken.
      sb.from("checkin_logs").select("*").gte("datum", vonIso),
      sb.from("checkin_orte").select("*").eq("aktiv", true),
      sb.from("checkin_schichten").select("*").eq("mitarbeiter_id", ciUser.id).gte("datum", ciAddDays(vonIso, -7)),
    ]);
    const punkte = {};
    (ptRes.data || []).forEach((p) => { punkte[p.id] = p; });
    const rundgaenge = (rgRes.data || []).filter((r) => { const ids = ciRundgangMitarbeiter(r); return ids.length === 0 || ids.includes(ciUser.id); });
    const orte = (orteRes.data || []).filter((o) => ciOrtMitarbeiter(o).includes(ciUser.id));
    // Standardmäßig ersten Rundgang aufklappen, wenn noch nichts gewählt wurde
    if (!Object.keys(ciOpenRg).length && rundgaenge.length) {
      const heuteRg = rundgaenge.filter((r) => ciRundgangLaeuftAn(r, heute));
      if (heuteRg[0]) ciOpenRg[heuteRg[0].id] = true;
    }
    // Nur Check-ins der Rundgänge, denen dieser MA zugeteilt ist – fremde Touren
    // gehen ihn nichts an (und würden den Verlauf zumüllen).
    const rgIds = new Set(rundgaenge.map((r) => r.id));
    const logs = (logRes.data || []).filter((l) => rgIds.has(l.rundgang_id));
    ciData = { rundgaenge, punkte, logs, orte, schichten: (schichtRes.data || []), heute };
    await ciAutoCloseOldShifts();
  } catch (e) { /* offline: alte ciData behalten */ }
}

// Kleiner Datums-Helfer (Tage addieren auf "YYYY-MM-DD").
function ciAddDays(iso, days) {
  const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days);
  return ciIsoFromDate(d);
}

// Eigene offene Schichten aus VERGANGENEN Tagen automatisch schließen (Auschecken
// vergessen): auf das geplante Ende des jeweiligen Tages, als "automatisch beendet".
async function ciAutoCloseOldShifts() {
  const GRACE = 60 * 60000; // 1h Kulanz nach geplantem Ende (auch über Mitternacht)
  const nowMs = Date.now();
  const offen = (ciData.schichten || []).filter((s) => !s.aus_ts && s.datum && s.ein_ts);
  for (const s of offen) {
    const ort = (ciData.orte || []).find((o) => o.id === s.ort_id);
    const fenster = ort ? ciOrtFensterAn(ort, s.datum) : null;
    const endeMs = ciSchichtEndeMs(s.datum, fenster);
    if (nowMs <= endeMs + GRACE) continue; // noch innerhalb der Schicht -> offen lassen
    const endeIso = new Date(endeMs).toISOString();
    const patch = { aus_ts: endeIso, dauer_min: ciSchichtDauerMin(s.ein_ts, endeIso, fenster || { von: 0, bis: 1439 }), auto_beendet: true };
    Object.assign(s, patch);
    try { await sb.from("checkin_schichten").update(patch).eq("id", s.id); } catch (e) {}
  }
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

// Status eines Punkts HEUTE – immer ehrlich nach Uhrzeit (später/JETZT/verpasst).
// Das Go-Live-Datum gilt NUR für die Auswertung (Verlauf/Monat), nicht für die
// Live-Ansicht: hier soll die Uhr immer stimmen.
function ciStatusHeute(fenster, done) {
  return ciPunktStatus(fenster, ciNowMin(), done);
}

/* ---------------- Rendern ---------------- */
function ciRender() {
  if (!ciUser) return;
  const view = document.getElementById("view");
  if (!view) return;
  if (ciTimer) { clearInterval(ciTimer); ciTimer = null; }
  const hasArbeit = (ciData.orte || []).length > 0;
  if (ciSeg === "arbeit" && !hasArbeit) ciSeg = "heute";
  const tabs = [["heute", t("heute")]];
  if (hasArbeit) tabs.push(["arbeit", t("arbeitszeit")]);
  tabs.push(["verlauf", t("verlauf")]);
  const content = ciSeg === "heute" ? ciRenderHeute() : ciSeg === "arbeit" ? ciRenderArbeit() : ciRenderVerlauf();
  view.innerHTML = `
    <div class="seg">${tabs.map(([k, l]) => `<button class="${ciSeg === k ? "on" : ""}" onclick="ciSegTo('${k}')">${l}</button>`).join("")}</div>
    <div class="view on">${content}</div>`;
  if (ciSeg === "arbeit") { ciTick(); ciTimer = setInterval(ciTick, 1000); }
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
  // Glocken-Karte auch hier: Rundgang-MAs ohne Arbeitsort sehen den Arbeitszeit-Reiter
  // nie und könnten Benachrichtigungen sonst nirgends einschalten.
  html += ciPushBanner(true);
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
      // War es ein Kollege, den Namen dazuschreiben – sonst wirkt es, als hätte man
      // selbst eingecheckt (der Rundgang ist eine gemeinsame Aufgabe).
      const wer = info && info.mitarbeiter_id && ciUser && info.mitarbeiter_id !== ciUser.id
        ? t("vonKollege")(info.mitarbeiter_name || "Kollege") : "";
      body = `<div class="body" style="padding-top:9px;margin-top:9px;"><span class="meta-done">✓ ${escapeHtml(zeit)}${escapeHtml(dist)}${escapeHtml(wer)}${info && info.pending ? " " + t("wirdGesendet") : ""}</span></div>`;
    } else if (status === "later") {
      body = `<div class="body" style="padding-top:9px;margin-top:9px;"><span class="muted" style="font-size:12.5px;">${escapeHtml(t("fenster") + " " + ciFensterLabel(fenster))} ${escapeHtml(t("nichtOffen"))}</span></div>`;
    } else if (status === "miss") {
      // Verpasst = vorbei. Bewusst KEIN Einchecken-Knopf mehr - nachträgliches
      // Einchecken würde die Kontrolle aushebeln.
      body = `<div class="body" style="padding-top:9px;margin-top:9px;"><span style="font-size:12.5px;color:var(--red);font-weight:600;">⚠️ ${escapeHtml(t("verpasstInfo"))}</span></div>`;
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
  // Sicherheits-Prüfung BEIM TIPPEN: Lag die Seite offen und das Zeitfenster ist
  // inzwischen vorbei (oder noch nicht offen), wird NICHT eingecheckt - der alte
  // Knopf auf dem Bildschirm zählt nicht. Ansicht danach auf den ehrlichen Stand.
  const rgGuard = (ciData.rundgaenge || []).find((r) => r.id === rundgangId);
  const egGuard = rgGuard ? ciRundgangPunkte(rgGuard).find((e) => e.punkt_id === punktId) : null;
  if (rgGuard && egGuard) {
    const stJetzt = ciStatusHeute(ciEffFenster(rgGuard, egGuard, punkt), ciHatCheckin(rundgangId, punktId));
    if (stJetzt === "miss" || stJetzt === "later" || stJetzt === "done") {
      showToast(t("tNichtMoeglich"));
      ciRender();
      return;
    }
  }
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
    ciNotifyAdmin(`📍 ${ciUser.name || ciUser.username} · Check-in`, `${punkt.name}${dist != null ? ` · ${dist} m` : ""}`);
  } else {
    showToast(t("tOffline"));
  }
  ciBusyPunkt = null;
  ciOpenStop[id] = false; // erledigten Stopp wieder einklappen (Übersicht)
  ciRender();
}
function ciQueue(item) { const q = ciLoadQueue(); item.pending = true; q.push(item); ciSaveQueue(q); }

/* ---------------- Tages-Ansicht (aus dem GEKO-One-Kalender) ----------------
   Wird die Seite mit "?datum=YYYY-MM-DD" geöffnet, steht im Verlauf ganz oben
   genau dieser Tag: welche Punkte abgehakt wurden (mit Uhrzeit), welche gefehlt
   haben, und die Arbeitszeit an dem Tag. */

let ciTagDetail = null; // ISO-Datum oder null

function ciTagAusLink() {
  try {
    const d = new URLSearchParams(location.search).get("datum");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      ciTagDetail = d;
      ciSeg = "verlauf";
      // Parameter entfernen, damit ein Neuladen nicht ewig auf dem Tag klebt
      try { history.replaceState(null, "", location.pathname); } catch (e) {}
    }
  } catch (e) {}
}

function ciTagDetailSchliessen() { ciTagDetail = null; renderCheckinsMa(); }

// Dauer zweier Zeitstempel in "H:MM"
function ciDauerText(vonTs, bisTs) {
  if (!vonTs || !bisTs) return "";
  const min = Math.max(0, Math.round((new Date(bisTs) - new Date(vonTs)) / 60000));
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")} h`;
}

function ciRenderTagDetail(iso) {
  const logs = (ciData.logs || []).filter((l) => l.datum === iso);
  const rgs = (ciData.rundgaenge || []).filter((r) => ciRundgangLaeuftAn(r, iso));
  const d = new Date(iso + "T00:00:00");
  const titel = `${t("tageLang")[ciIsoDay(d) - 1]}, ${d.getDate()}. ${t("monate")[d.getMonth()]}`;

  const rgHtml = rgs.length ? rgs.map((rg) => {
    const eintraege = ciSortEintraege(rg, ciRundgangPunkte(rg), ciData.punkte).filter((e) => ciData.punkte[e.punkt_id]);
    const zeilen = eintraege.map((e) => {
      const log = logs.find((l) => l.rundgang_id === rg.id && l.punkt_id === e.punkt_id);
      const p = ciData.punkte[e.punkt_id];
      const wer = log && log.mitarbeiter_id && ciUser && log.mitarbeiter_id !== ciUser.id
        ? ` · ${escapeHtml(log.mitarbeiter_name || "Kollege")}` : "";
      return `<div class="hist-row">
        <span class="t">${log ? escapeHtml(ciUhrzeit(log.ts)) : "–"}</span>
        <span class="dotc" style="background:${log ? "var(--green)" : "var(--line)"}"></span>
        <span>${log ? "" : "<s>"}${escapeHtml((p && p.name) || "Punkt")}${log ? "" : "</s>"}${wer}</span>
      </div>`;
    }).join("");
    const done = eintraege.filter((e) => logs.some((l) => l.rundgang_id === rg.id && l.punkt_id === e.punkt_id)).length;
    return `<div class="week">
      <h4>${escapeHtml(rg.name)} · ${done}/${eintraege.length} ${done === eintraege.length && eintraege.length ? "✓" : ""}</h4>
      ${zeilen || `<p class="ci-empty">${t("keineWoche")}</p>`}
    </div>`;
  }).join("") : "";

  // Arbeitszeit an dem Tag
  const schichten = (ciData.schichten || []).filter((s) => s.datum === iso);
  const zeitHtml = schichten.length ? `<div class="week"><h4>⏱️ ${t("arbeitszeit") || "Arbeitszeit"}</h4>
    ${schichten.map((s) => {
      const ort = (ciData.orte || []).find((o) => o.id === s.ort_id);
      return `<div class="hist-row">
        <span class="t">${escapeHtml(ciUhrzeit(s.ein_ts))}${s.aus_ts ? "–" + escapeHtml(ciUhrzeit(s.aus_ts)) : ""}</span>
        <span class="dotc" style="background:var(--blue)"></span>
        <span>${escapeHtml((ort && ort.name) || "Arbeitsort")}${s.aus_ts ? ` · <b>${ciDauerText(s.ein_ts, s.aus_ts)}</b>` : " · läuft"}</span>
      </div>`;
    }).join("")}</div>` : "";

  return `
    <div class="week" style="border:2px solid var(--blue);">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
        <h4 style="margin:0; flex:1;">📅 ${escapeHtml(titel)}</h4>
        <button class="btn-x" style="font-size:12px; padding:6px 10px;" onclick="ciTagDetailSchliessen()">✕</button>
      </div>
      ${rgHtml || `<p class="ci-empty">An dem Tag war kein Rundgang für dich geplant.</p>`}
      ${zeitHtml}
    </div>`;
}

/* ---------------- Verlauf ---------------- */
function ciRenderVerlauf() {
  const tagHtml = ciTagDetail ? ciRenderTagDetail(ciTagDetail) : "";
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
    const wer = l.mitarbeiter_id && ciUser && l.mitarbeiter_id !== ciUser.id
      ? t("vonKollege")(l.mitarbeiter_name || "Kollege") : "";
    return `<div class="hist-row"><span class="t">${escapeHtml(ciUhrzeit(l.ts))}</span><span class="dotc" style="background:var(--green)"></span><span>${escapeHtml((p && p.name) || "Punkt")}${escapeHtml(dist)}${escapeHtml(wer)}</span></div>`;
  }).join("") : `<p class="ci-empty">${t("keineWoche")}</p>`;
  return `
    <div class="ci-stagger">
      ${tagHtml}
      <div class="week"><h4>${t("meineWoche")}</h4>${rgs.length ? grid : `<p class="ci-empty">${t("keinZugeteilt")}</p>`}</div>
      <div class="week"><h4>${t("letzteCheckins")}</h4>${letzteHtml}</div>
    </div>
    <p class="muted" style="font-size:11.5px;margin:4px 4px 0;">${t("volleAuswertung")}</p>`;
}

/* ==================== ARBEITSZEIT (Ein-/Auschecken) ==================== */
function ciMyOpenShift(ortId) { return (ciData.schichten || []).find((s) => s.ort_id === ortId && !s.aus_ts); }
function ciMyTodayDone(ortId) {
  const heute = ciTodayIso();
  return (ciData.schichten || []).find((s) => s.ort_id === ortId && s.datum === heute && s.aus_ts);
}

function ciRenderArbeit() {
  const heute = ciTodayIso();
  const orte = ciData.orte || [];
  if (!orte.length) return `<div class="card-x"><p class="ci-empty">${t("keinArbeitsort")}</p></div>`;
  const now = ciNowMin();
  return ciPushBanner() + `<div class="ci-stagger">` + orte.map((ort) => {
    const fensterHeute = ciOrtFensterAn(ort, heute);
    const puffer = parseInt(ort.puffer_min, 10) || 0;
    const open = ciMyOpenShift(ort.id);
    const done = ciMyTodayDone(ort.id);
    const status = ciOrtStatus(fensterHeute, now, puffer, !!open, !!done);
    // Für laufende/erledigte Schicht das Fenster des jeweiligen Starttags nehmen (Mitternacht).
    const fenster = open ? ciOrtFensterAn(ort, open.datum) : done ? ciOrtFensterAn(ort, done.datum) : fensterHeute;
    return ciRenderOrtKarte(ort, fenster, status, open, done);
  }).join("") + `</div>`;
}

function ciRenderOrtKarte(ort, fenster, status, open, done) {
  const planned = fenster ? t("heuteSchicht")(ciMinToTime(fenster.von), ciFmtBis(fenster.bis)) : t("heuteFrei");
  const adr = ort.adresse ? `<span class="pt-adr">${escapeHtml(ort.adresse)}</span>` : "";
  let body = "", cls = "";
  if (status === "laeuft") { cls = "az-run"; body = ciRenderLaeuft(ort, fenster, open); }
  else if (status === "ein") {
    body = `<button class="ci-btn" id="azbtn_${ort.id}" onclick="ciDoEin('${ort.id}')">${t("einchecken2")}</button>
            <div class="gps-err" id="azerr_${ort.id}"></div>`;
  } else if (status === "vor") {
    body = `<button class="ci-btn" disabled>${t("einAb")(ciMinToTime(fenster.von))}</button>`;
  } else if (status === "fertig") { cls = "az-done"; body = ciRenderFertig(ort, fenster, done); }
  else { cls = "az-miss"; body = `<div class="az-vorbei">⚠️ ${t("arbeitVorbei")}</div>`; }

  return `<div class="az ${cls}">
    <div class="az-head">
      <div class="az-ic">🏢</div>
      <div class="az-nm"><div class="pn">${escapeHtml(ort.name)}</div><div class="ps">${escapeHtml(planned)}${adr}</div></div>
    </div>
    ${body}
  </div>`;
}

function ciRenderLaeuft(ort, fenster, open) {
  const einZeit = ciUhrzeit(open.ein_ts);
  const feierabend = fenster ? ciFmtBis(fenster.bis) : "";
  return `
    <div class="az-live">
      <div class="az-ring">
        <svg viewBox="0 0 120 120">
          <circle class="az-ring-bg" cx="60" cy="60" r="52"></circle>
          <circle class="az-ring-fg" id="azring_${ort.id}" cx="60" cy="60" r="52"></circle>
        </svg>
        <div class="az-ring-txt"><b id="azel_${ort.id}">0h 00m</b><span>${t("eingecheckt")}<br>${escapeHtml(einZeit)}</span></div>
      </div>
      <div class="az-count" id="azcount_${ort.id}">${feierabend ? `${t("feierabendUm")} ${escapeHtml(feierabend)}` : ""}</div>
      <button class="ci-btn danger" id="azbtn_${ort.id}" onclick="ciDoAus('${ort.id}')">${t("auschecken")}</button>
      <div class="gps-err" id="azerr_${ort.id}"></div>
    </div>`;
}

function ciRenderFertig(ort, fenster, done) {
  const von = ciUhrzeit(done.ein_ts), bis = ciUhrzeit(done.aus_ts);
  const dauer = done.dauer_min != null ? done.dauer_min : ciSchichtDauerMin(done.ein_ts, done.aus_ts, fenster || { von: 0, bis: 1439 });
  return `<div class="az-fertig">✓ ${escapeHtml(von)}–${escapeHtml(bis)} · ${t("gezaehlt")} <b>${ciFmtDauer(dauer)}</b>${done.auto_beendet ? " ⚠️" : ""}</div>`;
}

// Live-Aktualisierung (jede Sekunde) für offene Schichten: Timer, Ring, Countdown.
// Rechnet relativ zur Mitternacht des Einchecktags -> läuft korrekt über Mitternacht.
function ciTick() {
  const nowMs = Date.now();
  (ciData.orte || []).forEach((ort) => {
    const open = ciMyOpenShift(ort.id);
    const el = document.getElementById(`azel_${ort.id}`);
    if (!open || !el) return;
    el.textContent = ciFmtDauer(Math.max(0, (nowMs - new Date(open.ein_ts).getTime()) / 60000));
    const fenster = ciOrtFensterAn(ort, open.datum);
    if (!fenster) return;
    const mitternacht = new Date(open.datum + "T00:00:00").getTime();
    const nowRel = (nowMs - mitternacht) / 60000; // Minuten seit Mitternacht des Starttags
    const total = Math.max(1, fenster.bis - fenster.von);
    const prog = Math.max(0, Math.min(1, (nowRel - fenster.von) / total));
    const ring = document.getElementById(`azring_${ort.id}`);
    if (ring) { const C = 2 * Math.PI * 52; ring.style.strokeDasharray = C; ring.style.strokeDashoffset = C * (1 - prog); }
    const count = document.getElementById(`azcount_${ort.id}`);
    const rest = Math.round(fenster.bis - nowRel);
    if (count) {
      if (rest > 0) { count.classList.remove("az-over"); count.innerHTML = `${t("feierabendUm")} ${ciFmtBis(fenster.bis)} · ${t("nochLabel")} <b>${ciFmtDauer(rest)}</b>`; }
      else { count.classList.add("az-over"); count.innerHTML = `⚠️ ${t("ueberFeierabend")}`; if (ring) ring.classList.add("az-over-ring"); }
    }
  });
}

/* ---- Stempeln (Ein/Aus) mit GPS ---- */
function ciGps(onOk, onErr) {
  if (!navigator.geolocation) { onErr({ code: 0 }); return; }
  navigator.geolocation.getCurrentPosition(onOk, onErr, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
}

function ciDoEin(ortId) { ciStartStempel(ortId, "ein"); }
function ciDoAus(ortId) { ciStartStempel(ortId, "aus"); }

function ciStartStempel(ortId, art) {
  if (ciBusyOrt) return;
  const ort = (ciData.orte || []).find((o) => o.id === ortId);
  if (!ort) return;
  const btn = document.getElementById(`azbtn_${ortId}`), err = document.getElementById(`azerr_${ortId}`);
  if (err) err.classList.remove("show");
  ciBusyOrt = ortId;
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spin"></span> ${art === "aus" ? t("tGpsErmittelnAus") : t("gpsErmittelt")}`; }
  ciGps((pos) => ciStempelSave(ort, art, pos), (e) => ciStempelGeoErr(ortId, art, e));
}

function ciResetAzBtn(ortId, art) {
  ciBusyOrt = null;
  const btn = document.getElementById(`azbtn_${ortId}`);
  if (btn) { btn.disabled = false; btn.innerHTML = art === "aus" ? t("auschecken") : t("einchecken2"); }
}

function ciStempelGeoErr(ortId, art, geoErr) {
  const err = document.getElementById(`azerr_${ortId}`);
  let msg = t("gpsKein");
  if (geoErr && geoErr.code === 1) msg = t("gpsBlock");
  else if (geoErr && geoErr.code === 3) msg = t("gpsTimeout");
  if (err) { err.innerHTML = msg; err.classList.add("show"); }
  showToast(t("tNichtMoeglich"));
  ciResetAzBtn(ortId, art);
}

async function ciStempelSave(ort, art, pos) {
  const err = document.getElementById(`azerr_${ort.id}`);
  const lat = pos.coords.latitude, lng = pos.coords.longitude;
  let dist = null;
  if (ort.lat != null && ort.lng != null) {
    dist = ciDistanzMeter(lat, lng, ort.lat, ort.lng);
    const radius = parseInt(ort.radius, 10) || 100;
    if (dist > radius) {
      if (err) { err.innerHTML = t("gpsWeit")(dist); err.classList.add("show"); }
      showToast(t("tZuWeit"));
      ciResetAzBtn(ort.id, art);
      return;
    }
  }
  const heute = ciTodayIso();
  const nm = ciUser.name || ciUser.username || "";
  if (art === "ein") {
    // Geplanten Start/Ende fest mitspeichern -> die Erinnerungs-Funktion braucht dann
    // keine Zeitzonen-Rechnung (funktioniert auch über Mitternacht).
    const fenster = ciOrtFensterAn(ort, heute);
    const mid = new Date(heute + "T00:00:00").getTime();
    const einTs = new Date().toISOString();
    const row = {
      id: genCode() + genCode(), ort_id: ort.id, mitarbeiter_id: ciUser.id,
      mitarbeiter_name: nm, datum: heute,
      ein_ts: einTs, ein_lat: lat, ein_lng: lng, ein_dist: dist,
      aus_ts: null, auto_beendet: false,
      plan_start_ts: fenster ? new Date(mid + fenster.von * 60000).toISOString() : null,
      plan_ende_ts: fenster ? new Date(ciSchichtEndeMs(heute, fenster)).toISOString() : null,
      erinnert_vor: false,
    };
    ciData.schichten = ciData.schichten || [];
    ciData.schichten.push(row);
    await ciShiftInsert(row);
    showToast(t("tEin"));
    ciNotifyAdmin(`🏢 ${nm} eingecheckt`, `${ort.name} · ${ciUhrzeit(einTs)} Uhr`);
  } else {
    const open = ciMyOpenShift(ort.id);
    if (!open) { ciResetAzBtn(ort.id, art); return; }
    const fenster = ciOrtFensterAn(ort, open.datum || heute);
    const ausTs = new Date().toISOString();
    const patch = {
      aus_ts: ausTs, aus_lat: lat, aus_lng: lng, aus_dist: dist,
      dauer_min: ciSchichtDauerMin(open.ein_ts, ausTs, fenster || { von: 0, bis: 1439 }),
    };
    Object.assign(open, patch);
    await ciShiftUpdate(open.id, patch);
    showToast(t("tAus"));
    ciNotifyAdmin(`🏁 ${nm} ausgecheckt`, `${ort.name} · ${ciFmtDauer(patch.dauer_min)}`);
  }
  ciBusyOrt = null;
  ciRender();
}

// Fire-and-forget: Admin über einen Check-in/Stempel informieren (blockiert nie).
function ciNotifyAdmin(title, body) {
  try {
    if (sb && sb.functions) sb.functions.invoke("send-push", { body: { role: "checkin_admin", title, body, url: "/checkins-admin.html" } }).catch(() => {});
  } catch (e) {}
}

/* ---- Benachrichtigungen aktivieren (für Auscheck-Erinnerungen) ---- */
async function ciEnablePush() {
  if (typeof enablePushNotifications !== "function") { showToast("Benachrichtigungen nicht verfügbar"); return; }
  await enablePushNotifications("checkin_ma", ciUser && ciUser.id);
  ciRender();
}
// Benachrichtigungen werden zentral in GEKO One (Menü) eingeschaltet und gelten dann
// für alles - Touren, Rundgänge, Dokumente. Deshalb gibt es hier keine eigene
// Aktivieren-Karte mehr; ciEnablePush() bleibt für den Notfall im Code.
function ciPushBanner(nurWennAus) { return ""; }

/* ---- Offline-Warteschlange für Schichten ---- */
function ciLoadShiftQueue() { try { return JSON.parse(localStorage.getItem(CI_SHIFT_QUEUE_KEY) || "[]"); } catch (e) { return []; } }
function ciSaveShiftQueue(q) { try { localStorage.setItem(CI_SHIFT_QUEUE_KEY, JSON.stringify(q)); } catch (e) {} }

async function ciShiftInsert(row) {
  try { const { error } = await sb.from("checkin_schichten").insert(row); if (error) ciQueueShift({ op: "insert", row }); }
  catch (e) { ciQueueShift({ op: "insert", row }); }
}
async function ciShiftUpdate(id, patch) {
  try { const { error } = await sb.from("checkin_schichten").update(patch).eq("id", id); if (error) ciQueueShift({ op: "update", id, patch }); }
  catch (e) { ciQueueShift({ op: "update", id, patch }); }
}
function ciQueueShift(item) { const q = ciLoadShiftQueue(); q.push(item); ciSaveShiftQueue(q); }

async function ciFlushShifts() {
  let q = ciLoadShiftQueue();
  if (!q.length) return;
  const rest = [];
  for (const it of q) {
    try {
      let error;
      if (it.op === "insert") ({ error } = await sb.from("checkin_schichten").insert(it.row));
      else ({ error } = await sb.from("checkin_schichten").update(it.patch).eq("id", it.id));
      if (error) rest.push(it);
    } catch (e) { rest.push(it); }
  }
  ciSaveShiftQueue(rest);
}
