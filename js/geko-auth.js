// ===========================================================================
// GEKO · Zentrale Anmeldung
// ===========================================================================
// Ersetzt die alte Prüfung im Browser (Passwort-Hash laden und selbst
// vergleichen). Der Unterschied ist grundsätzlich:
//
//   vorher:  Der Browser lädt die Mitarbeiterzeile inkl. pass_hash und
//            entscheidet SELBST, ob das Passwort stimmt. Wer die Zeile lesen
//            kann - und das konnte jeder -, kann sich den Sitzungs-Token
//            ausrechnen und als beliebiger Mitarbeiter auftreten.
//
//   jetzt:   Der Server prüft das Passwort und stellt ein Token aus, das der
//            Browser nicht fälschen kann. Jede Datenbankabfrage trägt dieses
//            Token; die Datenbank entscheidet, was der Betreffende sehen darf.
//
// Wichtig: supabase-js legt die Sitzung selbst im Browser ab und erneuert sie.
// Weil sie an der Domain hängt, gilt eine Anmeldung automatisch für ALLE
// GEKO-Seiten - das bisherige Verhalten (in GEKO One anmelden, Glas-Touren
// gehen mit auf) bleibt also erhalten, ohne dass wir Tokens weiterreichen.
// ===========================================================================

// Die Mitarbeiter tippen weiterhin nur ihren Benutzernamen. Supabase braucht
// eine E-Mail-artige Kennung, also hängen wir sie hier an. Die Adresse muss
// keine Mails empfangen können.
const GEKO_MAIL_DOMAIN = "ma.gekoclean.de";

function gekoZuMail(eingabe) {
  const roh = String(eingabe || "").trim().toLowerCase();
  if (!roh) return "";
  // Wer eine echte Adresse eintippt (Admins), soll sie auch benutzen dürfen.
  return roh.includes("@") ? roh : roh + "@" + GEKO_MAIL_DOMAIN;
}

// Zwischenspeicher, damit nicht jede Seite die Mitarbeiterzeile neu lädt.
let _gekoSitzung = null;

// ---------------------------------------------------------------------------
// Anmelden
// ---------------------------------------------------------------------------
async function gekoAnmelden(benutzername, passwort) {
  const { data, error } = await sb.auth.signInWithPassword({
    email: gekoZuMail(benutzername),
    password: String(passwort || ""),
  });
  if (error) {
    // Absichtlich immer dieselbe Meldung, egal ob es den Namen nicht gibt oder
    // nur das Passwort falsch war. Sonst kann man durch Ausprobieren
    // herausfinden, welche Benutzernamen existieren.
    const gesperrt = /banned|disabled/i.test(error.message || "");
    return { ok: false, fehler: gesperrt
      ? "Dieser Zugang ist gesperrt. Bitte im Büro melden."
      : "Benutzername oder Passwort ist falsch." };
  }
  _gekoSitzung = null;
  return { ok: true, user: data.user };
}

async function gekoAbmelden() {
  _gekoSitzung = null;
  try { await sb.auth.signOut(); } catch (e) {}
}

// ---------------------------------------------------------------------------
// Wer ist gerade angemeldet?
// ---------------------------------------------------------------------------
// Liefert { user, ma, rolle, istAdmin } oder null. "ma" ist die Zeile aus
// glas_mitarbeiter - daran hängen alle bestehenden Daten und die
// Zugangsrechte (zugang_glas, zugang_checkin, ...).
async function gekoSitzung(neuLaden) {
  if (_gekoSitzung && !neuLaden) return _gekoSitzung;

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { _gekoSitzung = null; return null; }

  const rolle = session.user?.app_metadata?.geko_rolle || "mitarbeiter";

  // Dank der neuen Zugriffsregeln liefert diese Abfrage einem Mitarbeiter nur
  // seine eigene Zeile - die Einschränkung steht in der Datenbank, nicht hier.
  const { data: ma } = await sb.from("glas_mitarbeiter")
    .select("id, name, username, login_aktiv, pw_muss_wechsel, zugang_glas, zugang_checkin, zugang_graffiti, zugang_lager")
    .eq("auth_user_id", session.user.id).maybeSingle();

  _gekoSitzung = { user: session.user, ma: ma || null, rolle, istAdmin: rolle === "admin" };
  return _gekoSitzung;
}

// Darf der Angemeldete diesen Bereich sehen?
// Admins dürfen überall hin. Bei Mitarbeitern zählt der Schalter: Glas ist
// historisch "an, außer ausdrücklich aus", alle anderen Bereiche müssen
// ausdrücklich freigeschaltet sein - exakt dieselbe Logik wie in den
// Datenbank-Regeln (geko_darf in supabase_auth_4_rls.sql).
function gekoDarf(sitzung, bereich) {
  if (!sitzung) return false;
  if (sitzung.istAdmin) return true;
  const ma = sitzung.ma;
  if (!ma || ma.login_aktiv === false) return false;
  switch (bereich) {
    case "glas":     return ma.zugang_glas !== false;
    case "checkin":  return ma.zugang_checkin === true;
    case "graffiti": return ma.zugang_graffiti === true;
    case "lager":    return ma.zugang_lager === true;
    default:         return true;
  }
}

// ---------------------------------------------------------------------------
// Seitenschutz
// ---------------------------------------------------------------------------
// Aufruf am Anfang einer Seite:
//   gekoSchuetze({ bereich: "glas", weiter: (s) => appStarten(s) });
//   gekoSchuetze({ nurAdmin: true, weiter: (s) => adminStarten(s) });
//
// Ist niemand angemeldet, erscheint das Anmeldeformular. Erst danach läuft
// "weiter". Das ersetzt sowohl die alten Mitarbeiter-Logins als auch die
// Admin-PIN-Abfragen.
async function gekoSchuetze(optionen) {
  const opt = optionen || {};
  const sitzung = await gekoSitzung(true);

  if (!sitzung) { gekoZeigeLogin(opt); return; }

  if (opt.nurAdmin && !sitzung.istAdmin) {
    gekoZeigeSperre("Dieser Bereich ist der Verwaltung vorbehalten.", sitzung, opt);
    return;
  }
  if (opt.bereich && !gekoDarf(sitzung, opt.bereich)) {
    gekoZeigeSperre("Für diesen Bereich ist dein Zugang nicht freigeschaltet.", sitzung, opt);
    return;
  }
  // Erstpasswort noch nicht geändert -> erst das, dann weiter.
  if (sitzung.ma?.pw_muss_wechsel && !opt.nurAdmin) {
    gekoZeigePasswortWechsel(opt, sitzung);
    return;
  }
  _gekoOverlayWeg();
  if (typeof opt.weiter === "function") opt.weiter(sitzung);
}

// ---------------------------------------------------------------------------
// Oberflächen (bewusst schlicht und ohne Abhängigkeiten)
// ---------------------------------------------------------------------------
// Zwei Darstellungen:
//  - normal:  ersetzt die ganze Seite (für reine Verwaltungsseiten wie benutzer.html)
//  - overlay: legt sich VOR eine fertige App (admin.html & Co.) - deren Aufbau
//    bleibt unangetastet, bis die Anmeldung steht. Danach wird das Overlay entfernt.
function _gekoRahmen(inhalt, opt) {
  const karte =
    '<div style="width:100%;max-width:380px;background:#fff;border-radius:16px;padding:26px;'
    + 'box-shadow:0 2px 12px rgba(0,0,0,.09);color:#1c2530">' + inhalt + '</div>';
  if (opt && opt.overlay) {
    let o = document.getElementById("gekoAuthOverlay");
    if (!o) {
      o = document.createElement("div");
      o.id = "gekoAuthOverlay";
      o.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;"
        + "justify-content:center;padding:20px;background:linear-gradient(160deg,#1f5d92,#132d47);"
        + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
      document.body.appendChild(o);
    }
    o.innerHTML = karte;
    return;
  }
  document.body.innerHTML =
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;'
    + 'padding:20px;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'
    + '\'Segoe UI\',Roboto,sans-serif">' + karte + '</div>';
}

function _gekoOverlayWeg() {
  const o = document.getElementById("gekoAuthOverlay");
  if (o) o.remove();
}

const _gekoFeld = 'width:100%;padding:13px;font-size:16px;border:1px solid #ccd3da;'
  + 'border-radius:10px;margin-top:5px;box-sizing:border-box';
const _gekoKnopf = 'width:100%;padding:14px;font-size:16px;font-weight:600;margin-top:18px;'
  + 'border:0;border-radius:10px;background:#1668c1;color:#fff;cursor:pointer';
const _gekoLabel = 'display:block;font-size:13px;font-weight:600;margin-top:14px;color:#3a4652';

function gekoZeigeLogin(opt) {
  const titel = (opt && opt.titel) || (typeof FIRMA_NAME !== "undefined" ? FIRMA_NAME : "GEKO");
  _gekoRahmen(
    '<h1 style="font-size:21px;margin:0 0 4px">' + titel + '</h1>'
    + '<p style="color:#6b7785;font-size:14px;margin:0 0 6px">Bitte anmelden.</p>'
    + '<label style="' + _gekoLabel + '">Benutzername</label>'
    + '<input id="gekoUser" style="' + _gekoFeld + '" autocapitalize="none" autocorrect="off" '
    + 'spellcheck="false" autocomplete="username">'
    + '<label style="' + _gekoLabel + '">Passwort</label>'
    + '<input id="gekoPw" type="password" style="' + _gekoFeld + '" autocomplete="current-password">'
    + '<button id="gekoLos" style="' + _gekoKnopf + '">Anmelden</button>'
    + '<div id="gekoFehler" style="display:none;margin-top:13px;padding:11px;border-radius:9px;'
    + 'background:#fdeaea;border-left:4px solid #d13438;font-size:14px;color:#8a1c20"></div>', opt);

  const knopf = document.getElementById("gekoLos");
  const fehler = document.getElementById("gekoFehler");
  const senden = async () => {
    const nutzer = document.getElementById("gekoUser").value;
    const pw = document.getElementById("gekoPw").value;
    if (!nutzer || !pw) { fehler.style.display = "block"; fehler.textContent = "Bitte beides ausfüllen."; return; }
    knopf.disabled = true; knopf.textContent = "Moment …";
    const erg = await gekoAnmelden(nutzer, pw);
    if (!erg.ok) {
      fehler.style.display = "block"; fehler.textContent = erg.fehler;
      knopf.disabled = false; knopf.textContent = "Anmelden";
      return;
    }
    // Im Overlay-Modus hat sich die App dahinter schon ohne Anmeldung
    // aufgebaut - einmal neu laden, damit sie mit Anmeldung frisch startet.
    if (opt && opt.overlay) { location.reload(); return; }
    gekoSchuetze(opt);   // gleiche Prüfung nochmal, jetzt angemeldet
  };
  knopf.onclick = senden;
  document.getElementById("gekoPw").onkeydown = (e) => { if (e.key === "Enter") senden(); };
  document.getElementById("gekoUser").focus();
}

function gekoZeigeSperre(text, sitzung, opt) {
  _gekoRahmen(
    '<h1 style="font-size:19px;margin:0 0 8px">Kein Zugriff</h1>'
    + '<p style="color:#3a4652;font-size:15px;line-height:1.5;margin:0">' + text + '</p>'
    + '<p style="color:#6b7785;font-size:13px;margin:14px 0 0">Angemeldet als '
    + ((sitzung && (sitzung.ma?.name || sitzung.user?.email)) || "unbekannt") + '</p>'
    + '<button id="gekoRaus" style="' + _gekoKnopf + ';background:#58636e">Abmelden</button>', opt);
  document.getElementById("gekoRaus").onclick = async () => { await gekoAbmelden(); location.reload(); };
}

// Erstpasswort ändern. Das Passwort geht direkt an Supabase - es wird nirgends
// in unseren Tabellen abgelegt, auch nicht verschlüsselt.
function gekoZeigePasswortWechsel(opt, sitzung) {
  _gekoRahmen(
    '<h1 style="font-size:20px;margin:0 0 4px">Neues Passwort</h1>'
    + '<p style="color:#6b7785;font-size:14px;margin:0;line-height:1.5">Du hast ein Passwort vom '
    + 'Büro bekommen. Bitte setz dir jetzt dein eigenes - danach kennt es niemand außer dir.</p>'
    + '<label style="' + _gekoLabel + '">Neues Passwort (mind. 8 Zeichen)</label>'
    + '<input id="gekoNeu1" type="password" style="' + _gekoFeld + '" autocomplete="new-password">'
    + '<label style="' + _gekoLabel + '">Nochmal zur Sicherheit</label>'
    + '<input id="gekoNeu2" type="password" style="' + _gekoFeld + '" autocomplete="new-password">'
    + '<button id="gekoSpeichern" style="' + _gekoKnopf + '">Speichern und weiter</button>'
    + '<div id="gekoPwFehler" style="display:none;margin-top:13px;padding:11px;border-radius:9px;'
    + 'background:#fdeaea;border-left:4px solid #d13438;font-size:14px;color:#8a1c20"></div>', opt);

  const knopf = document.getElementById("gekoSpeichern");
  const fehler = document.getElementById("gekoPwFehler");
  knopf.onclick = async () => {
    const a = document.getElementById("gekoNeu1").value;
    const b = document.getElementById("gekoNeu2").value;
    const meckern = (t) => { fehler.style.display = "block"; fehler.textContent = t; };
    if (a.length < 8) return meckern("Das Passwort braucht mindestens 8 Zeichen.");
    if (a !== b) return meckern("Die beiden Eingaben sind nicht gleich.");

    knopf.disabled = true; knopf.textContent = "Moment …";
    const { error } = await sb.auth.updateUser({ password: a });
    if (error) { meckern(error.message); knopf.disabled = false; knopf.textContent = "Speichern und weiter"; return; }

    await sb.from("glas_mitarbeiter").update({ pw_muss_wechsel: false }).eq("id", sitzung.ma.id);
    _gekoSitzung = null;
    if (opt && opt.overlay) { location.reload(); return; }
    gekoSchuetze(opt);
  };
}
