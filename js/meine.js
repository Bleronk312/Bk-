document.title = "GEKO One - Meine Übersicht";

// GEKO One: EIN Login für alles. Die Mitarbeiter melden sich mit ihrem bestehenden
// Glas-/Check-ins-Konto an (glas_mitarbeiter) und sehen eine Übersicht mit genau den
// Bausteinen, die das Büro ihnen freigeschaltet hat - plus ein Menü mit Einstellungen
// (Benachrichtigungen, Passwort ändern, Darstellung). Diese Seite lebt auf einer eigenen
// Adresse und fasst KEINE bestehende App an - der laufende Betrieb bleibt unberührt.

(function initOneHeader() {
  const wm = document.getElementById("watermarkImg");
  const badge = document.getElementById("badgeLogoImg");
  if (typeof GEKO_LOGO_TRANSPARENT_B64 !== "undefined") {
    if (wm) wm.src = GEKO_LOGO_TRANSPARENT_B64;
    if (badge) badge.src = GEKO_LOGO_TRANSPARENT_B64;
  }
})();

// Eigene Sitzung + die Sitzungen der verknüpften Apps: Wer sich hier anmeldet, ist
// danach auch in der Glas- und Check-ins-App angemeldet (gleiche Konten, gleiches
// Token-Schema) - ein Login statt drei.
const ONE_AUTH_KEY = "geko_one_auth";
const ONE_GLAS_KEY = "geko_ma_auth";  // Sitzung der Glas-Touren-App
const ONE_CI_KEY = "geko_ci_auth";    // Sitzung der Check-ins-App
const ONE_PUSH_ROLE = "geko_one";     // eigene Push-Rolle: alle MA-Benachrichtigungen laufen hierüber

let oneUser = null;    // {id, name, username, zugang_glas, zugang_checkin, zugang_graffiti, pw_muss_wechsel}
let oneScreen = "home"; // "home" | "kalender" | "urlaub" | "menu" | "pw" | "pwZwang"

function oneGoHome() { if (oneUser) { oneScreen = oneUser.pw_muss_wechsel ? "pwZwang" : "home"; renderOne(); } }

// Weiche Aktualisierung fürs Runterziehen: nur die Daten neu holen statt die
// ganze Seite neu zu starten. Bildschirm und Scrollposition bleiben erhalten.
window.gekoSoftRefresh = async function () {
  if (!oneUser) return;
  try { await oneEnsureLoggedIn(); } catch (e) {} // Freischaltungen mit auffrischen
  const warten = [];
  // Urlaubsanträge
  oneMeineAntraege = null;
  if (typeof oneLadeMeineAntraege === "function") warten.push(oneLadeMeineAntraege().catch(() => {}));
  // Lager-Plan
  if (typeof oneLagerLaden === "function") { oneLagerPlan = []; warten.push(oneLagerLaden().catch(() => {})); }
  else oneLagerPlan = null;
  // Kalender nur, wenn er gerade offen ist - sonst lädt er beim nächsten Öffnen
  if (oneScreen === "kalender" && typeof oneKalLeiseNachladen === "function") oneKalLeiseNachladen();
  else oneKalTermine = null;
  await Promise.all(warten);
  renderOne();
};

async function oneInit() {
  const ok = await oneEnsureLoggedIn();
  if (!ok) return; // Login-Screen läuft
  renderOne();
  // Benachrichtigungen still erneuern, falls dieses Gerät sie schon erlaubt hat -
  // so bleiben sie dauerhaft an, ohne erneutes Antippen.
  try { if (typeof autoRenewPushSubscription === "function") autoRenewPushSubscription(ONE_PUSH_ROLE, oneUser.id); } catch (e) {}
}

// Lädt den Mitarbeiter robust: erst mit den neuen Spalten (zugang_graffiti,
// pw_muss_wechsel), und falls die noch fehlen (SQL nicht ausgeführt) ohne sie.
// So verschwinden Bausteine NICHT mehr beim erneuten Öffnen (der alte Bug).
async function oneLoadUser(feld, wert) {
  const voll = "id, name, username, login_aktiv, zugang_glas, zugang_checkin, zugang_graffiti, zugang_lager, pw_muss_wechsel";
  const mittel = "id, name, username, login_aktiv, zugang_glas, zugang_checkin, zugang_graffiti, pw_muss_wechsel";
  const schlank = "id, name, username, login_aktiv, zugang_glas, zugang_checkin";
  let { data, error } = await sb.from("glas_mitarbeiter").select(voll).eq(feld, wert).maybeSingle();
  if (error && /zugang_lager/i.test(error.message || "")) {
    ({ data, error } = await sb.from("glas_mitarbeiter").select(mittel).eq(feld, wert).maybeSingle());
  }
  if (error && /(zugang_graffiti|pw_muss_wechsel)/i.test(error.message || "")) {
    ({ data, error } = await sb.from("glas_mitarbeiter").select(schlank).eq(feld, wert).maybeSingle());
  }
  return { data, error };
}

// Gespeicherte Anmeldung prüfen. Wie in der Glas-App gilt: einmal angemeldet bleibt
// angemeldet - rausgeworfen wird NUR, wenn der Account online nachweislich gesperrt/
// gelöscht ist oder das Passwort geändert wurde. Ohne Netz nie ausloggen - und die
// zuletzt bekannten Freischaltungen aus der Sitzung weiterverwenden, damit die Kacheln
// auch offline stehen bleiben.
async function oneEnsureLoggedIn() {
  // Profil-Zwischenspeicher fuers Offline-Oeffnen (Kacheln bleiben stehen).
  // Er ist KEIN Anmeldenachweis mehr - der liegt jetzt bei Supabase, das seine
  // Sitzung selbst im Browser haelt und erneuert.
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(ONE_AUTH_KEY) || "null"); } catch (e) {}

  let session = null;
  try { session = (await sb.auth.getSession()).data.session; } catch (e) {}
  if (!session) { oneRenderLogin(); return false; }

  // Schnellstart: Ist das Profil vom letzten Mal da, geht es SOFORT los -
  // ohne auf die Abfrage übers Netz zu warten. Geprüft wird trotzdem, nur
  // im Hintergrund (siehe oneNachpruefen). Ohne das hing beim Öffnen jedes
  // Mal ein leerer Moment davor.
  if (stored && stored.id) {
    oneUser = {
      id: stored.id, name: stored.name || "", username: stored.username || "",
      zugang_glas: stored.zugang_glas, zugang_checkin: stored.zugang_checkin,
      zugang_graffiti: stored.zugang_graffiti, zugang_lager: stored.zugang_lager,
    };
    oneNachpruefen(session);
    return true;
  }

  try {
    const { data, error } = await oneLoadUser("auth_user_id", session.user.id);
    if (error) throw error; // Netz-/Serverfehler -> offline vertrauen (catch unten)
    if (!data) { oneRenderLogin("Dieses Konto ist keinem Mitarbeiter zugeordnet."); return false; }
    if (data.login_aktiv === false) { await oneLogout(); return false; }
    oneUser = data;
    oneCacheZugaenge(data, stored);
    // Erstanmeldung / nach Zuruecksetzen: Passwort setzen UND Benachrichtigungen
    // einschalten - zentral in geko-auth.js, damit alle Apps es gleich machen.
    if (data.pw_muss_wechsel) {
      gekoWillkommenAblauf({ maId: data.id, pushRolle: ONE_PUSH_ROLE, fertig: () => location.reload() });
      return false;
    }
    return true;
  } catch (e) {
    // Kein Netz: letzte bekannte Freischaltungen aus dem Zwischenspeicher (Kacheln bleiben)
    if (stored && stored.id) {
      oneUser = {
        id: stored.id, name: stored.name || "", username: stored.username || "",
        zugang_glas: stored.zugang_glas, zugang_checkin: stored.zugang_checkin, zugang_graffiti: stored.zugang_graffiti,
        zugang_lager: stored.zugang_lager,
      };
      return true;
    }
    oneRenderLogin("Keine Verbindung. Bitte Internet prüfen und erneut versuchen.");
    return false;
  }
}

// Läuft nach dem Schnellstart, während die App schon benutzbar ist.
// Gilt die Anmeldung nicht mehr (Büro hat das Passwort zurückgesetzt oder den
// Zugang gesperrt), wird hier sauber abgemeldet. Ohne Netz bleibt alles, wie
// es ist - am Objekt ohne Empfang darf niemand rausfliegen.
async function oneNachpruefen(session) {
  try {
    const { data: konto, error: kontoFehler } = await sb.auth.getUser();
    if (kontoFehler || !konto || !konto.user) {
      // Anmeldung serverseitig ungültig - das ist der Fall nach einem
      // Passwort-Zurücksetzen durchs Büro.
      await oneLogout();
      return;
    }
    const { data, error } = await oneLoadUser("auth_user_id", session.user.id);
    if (error) return;                       // Netzproblem: nichts ändern
    if (!data || data.login_aktiv === false) { await oneLogout(); return; }

    if (data.pw_muss_wechsel) {
      gekoWillkommenAblauf({ maId: data.id, pushRolle: ONE_PUSH_ROLE, fertig: () => location.reload() });
      return;
    }
    // Freischaltungen könnten sich geändert haben -> Kacheln auffrischen
    const vorher = JSON.stringify([oneUser.zugang_glas, oneUser.zugang_checkin, oneUser.zugang_graffiti, oneUser.zugang_lager]);
    const nachher = JSON.stringify([data.zugang_glas, data.zugang_checkin, data.zugang_graffiti, data.zugang_lager]);
    oneUser = data;
    oneCacheZugaenge(data, null);
    if (vorher !== nachher) renderOne();
  } catch (e) { /* offline: unverändert weiterlaufen lassen */ }
}

// Freischaltungen + Name mit in die gespeicherte Sitzung schreiben, damit sie beim
// nächsten (evtl. offline) Öffnen sofort da sind.
function oneCacheZugaenge(data, stored) {
  try {
    const s = stored || JSON.parse(localStorage.getItem(ONE_AUTH_KEY) || "{}");
    s.name = data.name; s.zugang_glas = data.zugang_glas;
    s.zugang_checkin = data.zugang_checkin; s.zugang_graffiti = data.zugang_graffiti;
    s.zugang_lager = data.zugang_lager;
    localStorage.setItem(ONE_AUTH_KEY, JSON.stringify(s));
  } catch (e) {}
}

function oneRenderLogin(fehler) {
  const view = document.getElementById("view");
  if (!view) return;
  oneUser = null;
  oneRenderTopbar();
  view.innerHTML = `
    <div class="glas-login">
      <p class="glas-login-title">Anmelden</p>
      <p class="glas-login-sub">Melde dich mit deinem gewohnten Benutzernamen und Passwort an - denselben wie in der Glas- oder Check-ins-App. Du bleibst danach angemeldet.</p>
      ${fehler ? `<div class="glas-login-err">${escapeHtml(fehler)}</div>` : ""}
      <div class="field"><label class="muted">Benutzername</label>
        <input type="text" id="login_user" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" style="font-size:16px;" /></div>
      <div class="field"><label class="muted">Passwort</label>
        <input type="password" id="login_pass" autocomplete="current-password" style="font-size:16px;" /></div>
      <button class="btn btn-primary" id="login_btn" style="width:100%; justify-content:center; padding:14px; font-size:16px; margin-top:6px;" onclick="oneDoLogin()">Anmelden</button>
      <p class="muted" style="margin-top:14px; font-size:12.5px;">Passwort vergessen? Das Büro kann dir ein neues Einmal-Passwort geben.</p>
    </div>`;
  const pass = document.getElementById("login_pass");
  if (pass) pass.addEventListener("keydown", (e) => { if (e.key === "Enter") oneDoLogin(); });
}

async function oneDoLogin() {
  const user = (document.getElementById("login_user")?.value || "").trim().toLowerCase();
  const pass = document.getElementById("login_pass")?.value || "";
  if (!user || !pass) { oneRenderLogin("Bitte Benutzername und Passwort eingeben."); return; }
  const btn = document.getElementById("login_btn");
  if (btn) { btn.disabled = true; btn.textContent = "Prüfe…"; }
  try {
    // Passwort prueft jetzt der Server - hier kommt nie mehr ein Hash an.
    const anm = await gekoAnmelden(user, pass);
    if (!anm.ok) { oneRenderLogin(anm.fehler); return; }
    const { data, error } = await oneLoadUser("auth_user_id", anm.user.id);
    if (error) throw error;
    if (!data) {
      await gekoAbmelden();
      oneRenderLogin("Dieses Konto ist keinem Mitarbeiter zugeordnet. Bitte im Büro melden.");
      return;
    }
    if (data.login_aktiv === false) {
      await gekoAbmelden();
      oneRenderLogin("Dieser Zugang ist gesperrt. Bitte im Büro melden.");
      return;
    }
    await oneStoreSessions(data);
    oneUser = data;
    if (data.pw_muss_wechsel) {
      gekoWillkommenAblauf({ maId: data.id, pushRolle: ONE_PUSH_ROLE, fertig: () => location.reload() });
      return;
    }
    oneScreen = "home";
    renderOne();
    try { if (typeof autoRenewPushSubscription === "function") autoRenewPushSubscription(ONE_PUSH_ROLE, oneUser.id); } catch (e) {}
  } catch (e) {
    oneRenderLogin("Keine Verbindung. Bitte Internet prüfen und erneut versuchen.");
  }
}

// Schreibt die GEKO-One-Sitzung UND die Sitzungen der freigeschalteten Apps - dadurch
// öffnen sich Glas-Touren und Check-ins ohne erneute Anmeldung (gleicher Browser).
async function oneStoreSessions(data) {
  // Nur noch Profil-Zwischenspeicher (Name + Freischaltungen) fuer Offline.
  // Angemeldet ist man ueber die Supabase-Sitzung, die fuer alle GEKO-Seiten
  // auf dieser Domain gilt - Glas- und Check-ins-App brauchen kein eigenes Token mehr.
  const sitz = {
    id: data.id, name: data.name, username: data.username,
    zugang_glas: data.zugang_glas, zugang_checkin: data.zugang_checkin, zugang_graffiti: data.zugang_graffiti,
    zugang_lager: data.zugang_lager,
  };
  const roh = JSON.stringify(sitz);
  const schlank = JSON.stringify({ id: data.id, name: data.name, username: data.username });
  try {
    localStorage.setItem(ONE_AUTH_KEY, roh);
    if (data.zugang_glas !== false) localStorage.setItem(ONE_GLAS_KEY, schlank);
    if (data.zugang_checkin === true) localStorage.setItem(ONE_CI_KEY, schlank);
  } catch (e) {}
}

// Vom Abmelden-Knopf: erst fragen. Rausfliegen mitten im Arbeitstag, weil man
// den Knopf gestreift hat, ist besonders aergerlich - danach braucht man
// Benutzername und Passwort.
async function oneAbmeldenFragen() {
  if (!confirm("Wirklich abmelden?\n\nDu musst dich danach mit Benutzername und Passwort neu anmelden.")) return;
  await oneLogout();
}

async function oneLogout() {
  // Es gibt jetzt EINE Anmeldung fuer alle GEKO-Seiten - abmelden heisst also
  // ueberall abmelden. Das alte "nur hier abmelden" gibt es nicht mehr; halb
  // angemeldet zu sein war vorher schon eher verwirrend als hilfreich.
  try { await sb.auth.signOut(); } catch (e) {}
  try {
    localStorage.removeItem(ONE_AUTH_KEY);
    localStorage.removeItem(ONE_GLAS_KEY);
    localStorage.removeItem(ONE_CI_KEY);
  } catch (e) {}
  oneUser = null;
  oneScreen = "home";
  oneRenderLogin();
}

/* ---------------- Kopf-Navigation (Zurück/Menü immer oben LINKS) ---------------- */

function oneRenderTopbar() {
  const bar = document.getElementById("oneTopbar");
  if (!bar) return;
  const brand = `<span class="one-brand"><span class="dot"></span>GEKO One</span>`;
  let links = "";
  if (oneUser) {
    if (oneScreen === "home") {
      links = `<button class="geko-navbtn" onclick="oneMenuDropdown()">☰ Menü</button>`;
    } else if (oneScreen !== "pwZwang") {
      links = `<button class="geko-navbtn" onclick="oneGoHome()">‹ Zurück</button>
               <button class="geko-navbtn" onclick="oneGoHome()">🏠 Start</button>`;
    }
    // pwZwang: bewusst KEINE Navigation (Passwort muss erst gesetzt werden)
  }
  bar.innerHTML = links + brand;
}

function oneSetGreeting(txt) {
  const g = document.getElementById("oneGreeting");
  if (g) g.textContent = txt;
}

/* ---------------- Übersicht ---------------- */

// Tageszeit-passender Untertitel - kleine Aufmerksamkeit, die die Startseite
// lebendig macht, ohne zusätzlichen Platz zu kosten.
function oneBegruessung() {
  const h = new Date().getHours();
  if (h < 10) return "Guten Morgen – auf einen guten Tag!";
  if (h < 14) return "Schön, dass du da bist!";
  if (h < 18) return "Guten Nachmittag!";
  return "Feierabend in Sicht 🌙";
}

// Vorname für die Begrüßung ("Adnan B." -> "Adnan")
function oneVorname() {
  const n = (oneUser && (oneUser.name || oneUser.username)) || "";
  return n.split(/\s+/)[0] || n;
}

function oneKachel(href, farbe, ico, titel, sub, delay) {
  return `<a class="one-kachel" href="${href}" style="animation-delay:${delay}s;">
    <span class="k-ico" style="background:${farbe};">${ico}</span>
    <b>${titel}</b><span>${sub}</span>
  </a>`;
}

function oneKachelBald(ico, titel, sub, delay) {
  return `<div class="one-kachel bald" style="animation-delay:${delay}s;" onclick="showToast('${titel} kommt als Nächstes - bald verfügbar')">
    <span class="k-ico">${ico}</span>
    <b>${titel}</b><span>${sub}</span>
  </div>`;
}

function renderOne() {
  const view = document.getElementById("view");
  if (!view) return;
  oneRenderTopbar();

  if (oneScreen === "kalender") {
    oneSetGreeting("Mein Kalender");
    view.innerHTML = renderOneKalender();
    if (typeof oneKalWischAktivieren === "function") oneKalWischAktivieren();
    return;
  }
  if (oneScreen === "urlaub") { oneSetGreeting("Meine Urlaubsanträge"); view.innerHTML = renderOneUrlaubHistorie(); return; }
  if (oneScreen === "lager") { oneSetGreeting("Lager-Plan"); view.innerHTML = renderOneLager(); return; }
  if (oneScreen === "lohn") { oneSetGreeting("Lohnabrechnungen"); view.innerHTML = renderOneLohn(); oneLohnLaden(); return; }
  if (oneScreen === "menu") { oneSetGreeting("Menü"); view.innerHTML = renderOneMenu(); return; }
  if (oneScreen === "pw" || oneScreen === "pwZwang") { oneSetGreeting(oneScreen === "pwZwang" ? "Passwort festlegen" : "Passwort ändern"); view.innerHTML = renderOnePwForm(oneScreen === "pwZwang"); return; }

  oneSetGreeting("Meine Übersicht");
  // Eigene Urlaubsanträge einmalig holen - entschiedene, noch nicht bestätigte
  // erscheinen oben als Hinweis mit "Verstanden"-Knopf. Hier (statt in oneInit),
  // damit es auch nach einer frischen Anmeldung greift.
  if (typeof oneLadeMeineAntraege === "function" && typeof oneMeineAntraege !== "undefined" && oneMeineAntraege === null) {
    oneLadeMeineAntraege().then(() => { if (oneScreen === "home") renderOne(); });
  }
  // Lager-Plan des Büros: der nächste eigene Termin steht ganz oben.
  if (oneUser.zugang_lager === true && typeof oneLagerStarteLaden === "function") oneLagerStarteLaden();
  // Freigeschaltete Bausteine (zugang_glas ist historisch "an, außer ausdrücklich aus")
  const kacheln = [];
  let d = 0.1;
  if (oneUser.zugang_glas !== false) kacheln.push(oneKachel("glas-mitarbeiter.html", "#1f5d92", "🧽", "Glas-Touren", "Deine Touren & Unterschriften", (d += 0.07)));
  if (oneUser.zugang_graffiti === true) kacheln.push(oneKachel("mitarbeiter.html", "#a52d82", "🎨", "Graffiti", "Abnahmescheine & Fotos", (d += 0.07)));
  if (oneUser.zugang_checkin === true) kacheln.push(oneKachel("checkins-ma.html", "#cf6a12", "📍", "Check-ins", "Rundgänge & Arbeitszeit", (d += 0.07)));
  // Lager ist keine eigene App, sondern eine Seite hier drin - deshalb ein Knopf
  // statt eines Links. Die Kachel steht da, sobald das Büro freischaltet, auch
  // wenn noch gar nichts eingeteilt ist. Sonst sähe Freischalten nach nichts aus.
  if (oneUser.zugang_lager === true) {
    kacheln.push(`<button class="one-kachel" style="animation-delay:${(d += 0.07)}s;" onclick="oneScreen='lager'; renderOne();">
      <span class="k-ico" style="background:#6b4ee6;">📦</span>
      <b>Lager</b><span>${escapeHtml(typeof oneLagerKachelSub === "function" ? oneLagerKachelSub() : "Wann du im Lager sein sollst")}</span>
    </button>`);
  }
  // Lohnabrechnungen: fuer jeden da. Die Zugriffsregeln des Datei-Speichers
  // geben ohnehin nur die eigenen Dateien her - die Kachel zeigt also
  // hoechstens eine leere Liste, nie fremde Abrechnungen.
  kacheln.push(`<button class="one-kachel" style="animation-delay:${(d += 0.07)}s;" onclick="oneScreen='lohn'; renderOne();">
    <span class="k-ico" style="background:#0f8a6d;">💶</span>
    <b>Lohn</b><span>Deine Abrechnungen als PDF</span>
  </button>`);

  view.innerHTML = `
    <div class="one-welcome">
      <p class="w-titel">Moin, ${escapeHtml(oneVorname())} <span class="glas-welcome-heart">👋</span></p>
      <p class="w-sub">${oneBegruessung()}</p>
    </div>
    ${typeof renderOneEntscheidungen === "function" ? renderOneEntscheidungen() : ""}
    ${typeof renderOneLagerHinweis === "function" ? renderOneLagerHinweis() : ""}
    <p class="one-label">DEINE BEREICHE</p>
    ${kacheln.length
      ? `<div class="one-raster">${kacheln.join("")}</div>`
      : `<p class="muted" style="margin:10px 2px;">Noch keine Bereiche freigeschaltet - das Büro schaltet dir deine Bereiche frei.</p>`}
    <p class="one-label">FÜR DICH</p>
    <div class="one-raster">
      <button class="one-kachel" style="animation-delay:${d + 0.14}s;" onclick="oneScreen='kalender'; renderOne();">
        <span class="k-ico" style="background:#0f7d74;">📅</span>
        <b>Mein Kalender</b><span>Touren, Termine & dein Urlaub</span>
      </button>
      ${oneKachelBald("📄", "Meine Dokumente", "Lohnabrechnungen & Infos", d + 0.21)}
    </div>`;
}

/* ---------------- Menü ----------------
   Zwei Stufen: ein kleines Dropdown mit dem, was man täglich braucht - und
   dahinter "Mehr Einstellungen" mit allem übrigen. So steht man nicht bei
   jedem Antippen vor einer vollen Seite. */

function oneMenuDropdown() {
  if (document.getElementById("oneDrop")) { oneMenuSchliessen(); return; }
  const el = document.createElement("div");
  el.id = "oneDrop";
  el.className = "one-drop-ov";
  el.onclick = (e) => { if (e.target === el) oneMenuSchliessen(); };
  el.innerHTML = `
    <div class="one-drop">
      <div class="one-drop-kopf">
        <b>${escapeHtml(oneUser.name || oneUser.username || "")}</b>
        <span>${escapeHtml(oneUser.username || "")}</span>
      </div>
      <button class="one-drop-row" onclick="oneMenuGeh('urlaub')">
        <span class="d-ico">🏖️</span><span class="d-txt">Meine Urlaubsanträge</span><span class="d-pfeil">›</span>
      </button>
      <button class="one-drop-row" onclick="oneMenuGeh('kalender')">
        <span class="d-ico">📅</span><span class="d-txt">Mein Kalender</span><span class="d-pfeil">›</span>
      </button>
      <button class="one-drop-row" onclick="oneMenuGeh('pw')">
        <span class="d-ico">🔑</span><span class="d-txt">Passwort ändern</span><span class="d-pfeil">›</span>
      </button>
      <div class="one-drop-trenner"></div>
      <button class="one-drop-row" onclick="oneMenuGeh('menu')">
        <span class="d-ico">⚙️</span><span class="d-txt">Mehr Einstellungen</span><span class="d-pfeil">›</span>
      </button>
      <button class="one-drop-row abmelden" onclick="oneMenuSchliessen(); oneAbmeldenFragen();">
        <span class="d-ico">🚪</span><span class="d-txt">Abmelden</span>
      </button>
    </div>`;
  document.body.appendChild(el);
  if (typeof window.gekoI18nApply === "function") window.gekoI18nApply(); // ggf. albanisch
  requestAnimationFrame(() => el.classList.add("auf"));
  // Zurück-Taste des Handys schließt erst das Menü, statt die Seite zu verlassen
  try { history.pushState({ oneDrop: 1 }, ""); } catch (e) {}
  window.addEventListener("popstate", oneMenuPop);
}

function oneMenuPop() { oneMenuSchliessen(true); }

function oneMenuSchliessen(vonPopstate) {
  const el = document.getElementById("oneDrop");
  window.removeEventListener("popstate", oneMenuPop);
  if (!el) return;
  el.classList.remove("auf");
  setTimeout(() => el.remove(), 180);
  // Den eigenen History-Eintrag wieder abräumen (außer wir kamen GERADE von dort)
  if (!vonPopstate) { try { if (history.state && history.state.oneDrop) history.back(); } catch (e) {} }
}

function oneMenuGeh(ziel) {
  oneMenuSchliessen();
  oneScreen = ziel;
  renderOne();
}

/* ---------------- Mehr Einstellungen (ganze Seite) ---------------- */

/* ---------------- Lohnabrechnungen ----------------
   Die PDFs liegen im privaten Datei-Speicher; die Regeln dort geben einem
   Mitarbeiter ausschliesslich den eigenen Ordner her (supabase_add_lohn.sql).
   Diese Seite listet und oeffnet also nur, was ohnehin ihm gehoert. */
let oneLohnListe = null;   // null = noch nicht geladen
let oneLohnFehler = "";

const ONE_LOHN_MON = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
function oneLohnLabel(name) {
  const m = String(name || "").match(/^(\d{4})-(\d{2})\.pdf$/);
  if (!m) return name;
  return `${ONE_LOHN_MON[parseInt(m[2], 10) - 1] || m[2]} ${m[1]}`;
}

async function oneLohnLaden() {
  if (oneLohnListe !== null) return;
  try {
    const { data, error } = await sb.storage.from("lohn")
      .list(oneUser.id, { limit: 100, sortBy: { column: "name", order: "desc" } });
    if (error) throw error;
    oneLohnListe = (data || []).filter((f) => f.name.endsWith(".pdf"));
    oneLohnFehler = "";
  } catch (e) {
    oneLohnListe = [];
    oneLohnFehler = "Die Liste konnte nicht geladen werden. Bitte später erneut versuchen.";
  }
  if (oneScreen === "lohn") renderOne();
}

function renderOneLohn() {
  if (oneLohnListe === null) {
    return `<p class="muted" style="margin-top:20px;"><span class="spinner"></span> Lade deine Abrechnungen…</p>`;
  }
  if (oneLohnFehler) return `<div class="card"><p class="muted" style="margin:0;">${escapeHtml(oneLohnFehler)}</p></div>`;
  if (!oneLohnListe.length) {
    return `<div class="card" style="text-align:center; padding:26px 16px;">
      <div style="font-size:30px; margin-bottom:8px;">💶</div>
      <p class="muted" style="margin:0;">Noch keine Abrechnung da.<br>Sobald das Büro eine hochlädt, findest du sie hier – du bekommst dann eine Benachrichtigung.</p>
    </div>`;
  }
  return oneLohnListe.map((f) => `
    <button class="one-menu-row" onclick="oneLohnOeffnen('${escapeHtml(f.name)}')">
      <span style="font-size:20px;">💶</span>
      <span style="flex:1; text-align:left;"><b>${escapeHtml(oneLohnLabel(f.name))}</b>
        <span class="muted" style="display:block; font-size:12px;">PDF ansehen</span></span>
      <span class="muted">›</span>
    </button>`).join("");
}

async function oneLohnOeffnen(name) {
  try {
    const { data, error } = await sb.storage.from("lohn")
      .createSignedUrl(`${oneUser.id}/${name}`, 300);
    if (error || !data) throw error;
    window.open(data.signedUrl, "_blank");
  } catch (e) {
    showToast("Konnte die Abrechnung nicht öffnen – bitte erneut versuchen.");
  }
}

function renderOneMenu() {
  setTimeout(oneUpdatePushStatus, 60);
  const t = oneGetTheme();
  return `
    <div class="card" style="margin-top:6px;">
      <p style="margin:0; font-size:14px;">Angemeldet als <b>${escapeHtml(oneUser.name || oneUser.username || "")}</b></p>
      <p class="muted" style="margin:3px 0 0; font-size:12.5px;">Benutzername: ${escapeHtml(oneUser.username || "")}</p>
    </div>

    <p class="one-label">EINSTELLUNGEN</p>

    <div class="one-menu-row" style="cursor:default; align-items:flex-start;">
      <span class="m-ico">🔔</span>
      <span style="flex:1;">
        <b>Benachrichtigungen</b>
        <span id="onePushStatus">Prüfe…</span>
        <button class="btn btn-sm btn-primary" style="margin-top:9px;" onclick="oneEnablePush()">Auf diesem Gerät aktivieren</button>
        <span style="margin-top:8px; font-size:11.5px;">Du wirst über alles benachrichtigt, was dich betrifft - Touren, Rundgänge, neue Dokumente. iPhone: geht nur, wenn GEKO One als App auf dem Home-Bildschirm liegt.</span>
      </span>
    </div>

    <div class="one-menu-row" style="cursor:default; align-items:flex-start;">
      <span class="m-ico">🌐</span>
      <span style="flex:1;">
        <b>Sprache / Gjuha</b>
        <span style="margin-bottom:9px;">Gilt für alle deine GEKO-Apps auf diesem Gerät.</span>
        <div class="one-seg">
          <button class="${oneGetLang() === "de" ? "on" : ""}" onclick="oneSetLang('de')">🇩🇪 Deutsch</button>
          <button class="${oneGetLang() === "sq" ? "on" : ""}" onclick="oneSetLang('sq')">🇦🇱 Shqip</button>
        </div>
      </span>
    </div>

    <div class="one-menu-row" style="cursor:default; align-items:flex-start;">
      <span class="m-ico">🌙</span>
      <span style="flex:1;">
        <b>Darstellung</b>
        <span style="margin-bottom:9px;">„Automatisch" folgt dem Handy.</span>
        <div class="one-seg">
          <button class="${t === "auto" ? "on" : ""}" onclick="oneSetTheme('auto')">📱 Auto</button>
          <button class="${t === "light" ? "on" : ""}" onclick="oneSetTheme('light')">☀️ Hell</button>
          <button class="${t === "dark" ? "on" : ""}" onclick="oneSetTheme('dark')">🌙 Dunkel</button>
        </div>
      </span>
    </div>

    <button class="one-menu-row" onclick="oneAbmeldenFragen()">
      <span class="m-ico">🚪</span>
      <span style="flex:1;"><b style="color:var(--danger);">Abmelden</b><span>Nur aus GEKO One auf diesem Gerät</span></span>
      <span class="m-pfeil">›</span>
    </button>

    <button class="one-menu-row" onclick="oneScreen='pw'; renderOne();">
      <span class="m-ico">🔑</span>
      <span style="flex:1;"><b>Passwort ändern</b><span>Nur du kennst es danach</span></span>
      <span class="m-pfeil">›</span>
    </button>

    <p class="muted" style="text-align:center; margin:18px 0 0; font-size:11.5px;">GEKO One</p>`;
}

/* ---------------- Sprache (gilt für alle MA-Apps) ---------------- */

// Die Apps benutzen historisch zwei verschiedene Speicherschlüssel: die Graffiti-App
// "geko_ma_lang" (ma-i18n.js), die Check-ins-App "geko_ci_lang". Hier werden BEIDE
// gesetzt, damit die im Menü gewählte Sprache wirklich überall gilt.
const ONE_LANG_KEYS = ["geko_ma_lang", "geko_ci_lang"];
function oneGetLang() { try { return localStorage.getItem(ONE_LANG_KEYS[0]) || "de"; } catch (e) { return "de"; } }
function oneSetLang(l) {
  if (oneGetLang() === l) return;
  try { ONE_LANG_KEYS.forEach((k) => localStorage.setItem(k, l)); } catch (e) {}
  // Neu laden ist hier der einzig saubere Weg: Die Übersetzung legt sich über den
  // bereits gerenderten deutschen Text - zurück auf Deutsch käme man ohne Neuladen
  // nicht mehr. Die Anmeldung bleibt dabei erhalten.
  showToast(l === "sq" ? "Gjuha: Shqip ✓" : "Sprache: Deutsch ✓");
  setTimeout(() => location.reload(), 350);
}

/* ---------------- Darstellung (Hell / Dunkel / Auto) ---------------- */

function oneGetTheme() { try { return localStorage.getItem("geko_theme") || "auto"; } catch (e) { return "auto"; } }
function oneSetTheme(mode) {
  try { localStorage.setItem("geko_theme", mode); } catch (e) {}
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  document.documentElement.classList.toggle("dark", mode === "dark" || (mode === "auto" && mq.matches));
  renderOne();
}

/* ---------------- Benachrichtigungen ---------------- */

async function oneEnablePush() {
  if (typeof enablePushNotifications !== "function") { showToast("Push-Skript nicht geladen"); return; }
  await enablePushNotifications(ONE_PUSH_ROLE, oneUser.id);
  oneUpdatePushStatus();
}

async function oneUpdatePushStatus() {
  const el = document.getElementById("onePushStatus");
  if (!el) return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    el.textContent = "❌ Auf diesem Gerät/Browser nicht unterstützt (iPhone: als App auf den Home-Bildschirm legen)."; return;
  }
  if (typeof Notification !== "undefined" && Notification.permission === "denied") {
    el.textContent = "🚫 In den Geräte-Einstellungen blockiert."; return;
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration("sw.js");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    el.textContent = sub ? "✅ Auf diesem Gerät aktiv." : "Auf diesem Gerät noch nicht aktiviert.";
  } catch (e) { el.textContent = ""; }
}

/* ---------------- Passwort ändern ---------------- */

function renderOnePwForm(zwang) {
  return `
    <div class="card" style="margin-top:${zwang ? "18px" : "6px"};">
      <h2 style="margin-top:0;">🔑 ${zwang ? "Neues Passwort festlegen" : "Passwort ändern"}</h2>
      ${zwang
        ? `<p class="muted" style="margin:0 0 14px;">Das Büro hat dir ein Einmal-Passwort gegeben. Leg jetzt dein eigenes fest - danach kennt es <b>nur noch du</b>, auch das Büro kann es nicht sehen.</p>`
        : `<p class="muted" style="margin:0 0 14px;">Dein neues Passwort kennt danach <b>nur noch du</b> - auch das Büro kann es nicht einsehen, sondern nur zurücksetzen, falls du es vergisst.</p>`}
      <div id="pw_err"></div>
      ${zwang ? "" : `<div class="field"><label class="muted">Aktuelles Passwort</label>
        <input type="password" id="pw_alt" autocomplete="current-password" style="font-size:16px;" /></div>`}
      <div class="field"><label class="muted">Neues Passwort (mindestens 6 Zeichen)</label>
        <input type="password" id="pw_neu" autocomplete="new-password" style="font-size:16px;" /></div>
      <div class="field"><label class="muted">Neues Passwort wiederholen</label>
        <input type="password" id="pw_neu2" autocomplete="new-password" style="font-size:16px;" /></div>
      <button class="btn btn-primary" id="pw_btn" style="width:100%; justify-content:center; padding:14px; font-size:16px;" onclick="oneChangePw(${zwang ? "true" : "false"})">Passwort speichern</button>
    </div>`;
}

function onePwFehler(msg) {
  const el = document.getElementById("pw_err");
  if (el) el.innerHTML = `<div class="glas-login-err">${escapeHtml(msg)}</div>`;
}

async function oneChangePw(zwang) {
  const alt = document.getElementById("pw_alt")?.value || "";
  const neu = document.getElementById("pw_neu")?.value || "";
  const neu2 = document.getElementById("pw_neu2")?.value || "";
  if (neu.length < 8) { onePwFehler("Das neue Passwort braucht mindestens 8 Zeichen."); return; }
  if (neu !== neu2) { onePwFehler("Die beiden Eingaben sind nicht gleich."); return; }
  const btn = document.getElementById("pw_btn");
  if (btn) { btn.disabled = true; btn.textContent = "Speichere…"; }

  try {
    // Das Passwort lebt jetzt bei Supabase - in unseren Tabellen wird es weder
    // gespeichert noch gehasht. Beim freiwilligen Wechsel wird das alte Passwort
    // durch eine Probe-Anmeldung geprueft (Supabase kennt kein "altes Passwort
    // pruefen" beim Aendern).
    if (!zwang) {
      const { data: { user: aktUser } } = await sb.auth.getUser();
      const mail = aktUser && aktUser.email;
      if (!mail) throw new Error("keine Sitzung");
      const { error: eAlt } = await sb.auth.signInWithPassword({ email: mail, password: alt });
      if (eAlt) {
        onePwFehler("Das aktuelle Passwort stimmt nicht.");
        if (btn) { btn.disabled = false; btn.textContent = "Passwort speichern"; }
        return;
      }
    }

    const { error: e2 } = await sb.auth.updateUser({ password: neu });
    if (e2) {
      onePwFehler(/weak|short|least/i.test(e2.message || "")
        ? "Das Passwort ist zu kurz oder zu einfach."
        : "Fehler beim Speichern. Bitte erneut versuchen.");
      if (btn) { btn.disabled = false; btn.textContent = "Passwort speichern"; }
      return;
    }

    // Merker in der Mitarbeiter-Tabelle nachziehen (fuers Buero sichtbar).
    const payload = { pw_selbst_gesetzt: true, pw_muss_wechsel: false, pass_klar: null };
    let { error: e3 } = await sb.from("glas_mitarbeiter").update(payload).eq("id", oneUser.id);
    if (e3) {
      // Aeltere Datenbank ohne diese Spalten: nicht schlimm, Passwort ist geaendert.
      try { await sb.from("glas_mitarbeiter").update({ pw_muss_wechsel: false }).eq("id", oneUser.id); } catch (e) {}
    }

    oneUser.pw_muss_wechsel = false;
    oneScreen = "home";
    renderOne();
    showToast("Passwort geändert - es kennt jetzt nur noch du ✓");
  } catch (e) {
    onePwFehler("Keine Verbindung oder Fehler beim Speichern. Bitte erneut versuchen.");
    if (btn) { btn.disabled = false; btn.textContent = "Passwort speichern"; }
  }
}

oneInit();
