document.title = "GEKO One - Meine Übersicht";

// GEKO One: EIN Login für alles. Die Mitarbeiter melden sich mit ihrem bestehenden
// Glas-/Check-ins-Konto an (glas_mitarbeiter) und sehen eine Übersicht mit genau den
// Bausteinen, die das Büro ihnen freigeschaltet hat. Diese Seite lebt auf einer eigenen
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

let oneUser = null;    // {id, name, username, zugang_glas, zugang_checkin, zugang_graffiti}
let oneScreen = "home"; // "home" | "pw" (Passwort ändern) | "pwZwang" (nach Büro-Reset)

function oneGoHome() { if (oneUser) { oneScreen = "home"; renderOne(); } }

async function oneInit() {
  const ok = await oneEnsureLoggedIn();
  if (!ok) return; // Login-Screen läuft
  renderOne();
}

// Gespeicherte Anmeldung prüfen. Wie in der Glas-App gilt: einmal angemeldet bleibt
// angemeldet - rausgeworfen wird NUR, wenn der Account online nachweislich gesperrt/
// gelöscht ist oder das Passwort geändert wurde. Ohne Netz nie ausloggen.
async function oneEnsureLoggedIn() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(ONE_AUTH_KEY) || "null"); } catch (e) {}
  if (!stored || !stored.id || !stored.tok) { oneRenderLogin(); return false; }
  try {
    const { data, error } = await sb.from("glas_mitarbeiter")
      .select("id, name, username, pass_hash, login_aktiv, zugang_glas, zugang_checkin, zugang_graffiti, pw_muss_wechsel")
      .eq("id", stored.id).maybeSingle();
    if (error) throw error; // Netz-/Serverfehler -> offline vertrauen (catch unten)
    if (!data || data.login_aktiv === false || !data.username) { oneLogout(); return false; }
    const tok = await gekoSessionTok(data.id, data.pass_hash);
    if (tok !== stored.tok) { oneLogout(); return false; } // Passwort geändert -> neu anmelden
    oneUser = data;
    if (data.pw_muss_wechsel) oneScreen = "pwZwang";
    return true;
  } catch (e) {
    oneUser = { id: stored.id, name: stored.name || "", username: stored.username || "" };
    return true;
  }
}

function oneRenderLogin(fehler) {
  const view = document.getElementById("view");
  if (!view) return;
  oneUser = null;
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
    // Die neuen Spalten (zugang_graffiti, pw_muss_wechsel) fehlen, solange die SQL-Datei
    // nicht ausgeführt wurde - dann ohne sie laden, damit der Login trotzdem geht.
    let { data, error } = await sb.from("glas_mitarbeiter")
      .select("id, name, username, pass_hash, pass_salt, login_aktiv, zugang_glas, zugang_checkin, zugang_graffiti, pw_muss_wechsel")
      .eq("username", user).maybeSingle();
    if (error && /(zugang_graffiti|pw_muss_wechsel)/i.test(error.message || "")) {
      ({ data, error } = await sb.from("glas_mitarbeiter")
        .select("id, name, username, pass_hash, pass_salt, login_aktiv, zugang_glas, zugang_checkin")
        .eq("username", user).maybeSingle());
    }
    if (error) throw error;
    if (!data || !data.username || !data.pass_hash) { oneRenderLogin("Benutzername oder Passwort falsch."); return; }
    if (data.login_aktiv === false) { oneRenderLogin("Dieser Zugang ist gesperrt. Bitte im Büro melden."); return; }
    const h = await gekoHashPw(pass, data.pass_salt || "");
    if (h !== data.pass_hash) { oneRenderLogin("Benutzername oder Passwort falsch."); return; }
    await oneStoreSessions(data);
    oneUser = data;
    oneScreen = data.pw_muss_wechsel ? "pwZwang" : "home";
    renderOne();
  } catch (e) {
    oneRenderLogin("Keine Verbindung. Bitte Internet prüfen und erneut versuchen.");
  }
}

// Schreibt die GEKO-One-Sitzung UND die Sitzungen der freigeschalteten Apps - dadurch
// öffnen sich Glas-Touren und Check-ins ohne erneute Anmeldung (gleicher Browser).
async function oneStoreSessions(data) {
  const tok = await gekoSessionTok(data.id, data.pass_hash);
  const sitz = JSON.stringify({ id: data.id, tok, name: data.name, username: data.username });
  try {
    localStorage.setItem(ONE_AUTH_KEY, sitz);
    if (data.zugang_glas !== false) localStorage.setItem(ONE_GLAS_KEY, sitz);
    if (data.zugang_checkin === true) localStorage.setItem(ONE_CI_KEY, sitz);
  } catch (e) {}
}

function oneLogout() {
  // Bewusst NUR die eigene Sitzung löschen: Wer sich z.B. nur aus GEKO One abmeldet,
  // soll nicht mitten am Arbeitstag aus der Glas-App fliegen.
  try { localStorage.removeItem(ONE_AUTH_KEY); } catch (e) {}
  oneUser = null;
  oneScreen = "home";
  oneRenderLogin();
}

/* ---------------- Übersicht ---------------- */

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

  if (oneScreen === "pw" || oneScreen === "pwZwang") { view.innerHTML = renderOnePwForm(oneScreen === "pwZwang"); return; }

  // Freigeschaltete Bausteine (zugang_glas ist historisch "an, außer ausdrücklich aus")
  const kacheln = [];
  let d = 0.1;
  if (oneUser.zugang_glas !== false) kacheln.push(oneKachel("glas-mitarbeiter.html", "#1f5d92", "🧽", "Glas-Touren", "Deine Touren & Unterschriften", (d += 0.07)));
  if (oneUser.zugang_graffiti === true) kacheln.push(oneKachel("mitarbeiter.html", "#a52d82", "🎨", "Graffiti", "Abnahmescheine & Fotos", (d += 0.07)));
  if (oneUser.zugang_checkin === true) kacheln.push(oneKachel("checkins-ma.html", "#cf6a12", "📍", "Check-ins", "Rundgänge & Arbeitszeit", (d += 0.07)));

  view.innerHTML = `
    <div class="glas-welcome">
      <img class="glas-welcome-logo" src="${typeof GEKO_LOGO_TRANSPARENT_B64 !== "undefined" ? GEKO_LOGO_TRANSPARENT_B64 : ""}" alt="GEKO" />
      <p class="glas-welcome-title">Moin, ${escapeHtml(oneVorname())} <span class="glas-welcome-heart">👋</span></p>
      <p class="glas-welcome-sub">Schön, dass du da bist!</p>
    </div>
    <p class="one-label">DEINE BEREICHE</p>
    ${kacheln.length
      ? `<div class="one-raster">${kacheln.join("")}</div>`
      : `<p class="muted" style="margin:10px 2px;">Noch keine Bereiche freigeschaltet - das Büro schaltet dir deine Bereiche frei.</p>`}
    <p class="one-label">BALD IN GEKO ONE</p>
    <div class="one-raster">
      ${oneKachelBald("📅", "Kalender", "Termine & Urlaub", d + 0.14)}
      ${oneKachelBald("📄", "Meine Dokumente", "Lohnabrechnungen & Infos", d + 0.21)}
    </div>
    <p class="one-label">DEIN KONTO</p>
    <div class="card" style="margin-top:10px;">
      <p style="margin:0; font-size:14px;">Angemeldet als <b>${escapeHtml(oneUser.name || oneUser.username || "")}</b></p>
      <p class="muted" style="margin:3px 0 12px; font-size:12.5px;">Benutzername: ${escapeHtml(oneUser.username || "")}</p>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn btn-sm" onclick="oneScreen='pw'; renderOne();">🔑 Passwort ändern</button>
        <button class="btn btn-sm" style="margin-left:auto; color:var(--danger);" onclick="oneLogout()">Abmelden</button>
      </div>
    </div>`;
}

/* ---------------- Passwort ändern ---------------- */

function renderOnePwForm(zwang) {
  return `
    ${zwang ? "" : `<button class="btn btn-sm" style="margin:16px 0;" onclick="oneScreen='home'; renderOne();">&larr; Zurück</button>`}
    <div class="card" style="margin-top:${zwang ? "24px" : "4px"};">
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
  if (neu.length < 6) { onePwFehler("Das neue Passwort braucht mindestens 6 Zeichen."); return; }
  if (neu !== neu2) { onePwFehler("Die beiden Eingaben sind nicht gleich."); return; }
  const btn = document.getElementById("pw_btn");
  if (btn) { btn.disabled = true; btn.textContent = "Speichere…"; }

  try {
    // Frischen Stand laden (Hash/Salt könnten sich geändert haben)
    const { data, error } = await sb.from("glas_mitarbeiter")
      .select("id, name, username, pass_hash, pass_salt, zugang_glas, zugang_checkin")
      .eq("id", oneUser.id).maybeSingle();
    if (error) throw error;
    if (!data) { onePwFehler("Konto nicht gefunden - bitte im Büro melden."); return; }

    if (!zwang) {
      const hAlt = await gekoHashPw(alt, data.pass_salt || "");
      if (hAlt !== data.pass_hash) { onePwFehler("Das aktuelle Passwort stimmt nicht."); if (btn) { btn.disabled = false; btn.textContent = "Passwort speichern"; } return; }
    }

    // Neues Passwort verhacken. pass_klar wird bewusst GELEERT: Ab jetzt kann niemand
    // mehr das Passwort einsehen - das Büro kann nur noch zurücksetzen.
    const salt = gekoMakeSalt();
    const hash = await gekoHashPw(neu, salt);
    const payload = { pass_salt: salt, pass_hash: hash, pass_klar: null, pw_selbst_gesetzt: true, pw_muss_wechsel: false };
    let { error: e2 } = await sb.from("glas_mitarbeiter").update(payload).eq("id", oneUser.id);
    if (e2 && /(pw_selbst_gesetzt|pw_muss_wechsel)/i.test(e2.message || "")) {
      // Neue Spalten fehlen noch (SQL nicht ausgeführt) - Passwortwechsel trotzdem durchführen
      delete payload.pw_selbst_gesetzt; delete payload.pw_muss_wechsel;
      ({ error: e2 } = await sb.from("glas_mitarbeiter").update(payload).eq("id", oneUser.id));
    }
    if (e2) throw e2;

    // Sitzungen auf das neue Passwort umschreiben - so bleibt man hier UND in den
    // verknüpften Apps angemeldet, statt überall rauszufliegen.
    await oneStoreSessions({ ...data, pass_hash: hash });
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
