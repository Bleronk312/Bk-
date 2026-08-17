// ============================================================================
// Sprach-Umschaltung NUR für die Graffiti-Mitarbeiter-App (mitarbeiter.html).
//
// Prinzip (bewusst robust/bugfrei): Deutsch bleibt der UNVERÄNDERTE Standard. Wird
// Albanisch gewählt, legt sich diese Datei als Übersetzung über das schon gerenderte
// Deutsch (Textknoten + placeholder/title). Fehlt eine Übersetzung, bleibt der
// deutsche Text stehen - es kann also nichts kaputtgehen oder abstürzen.
//
// Umschalten lädt die Seite neu (sauberster Weg, kein halber Zustand).
// ============================================================================
(function () {
  const LS = "geko_ma_lang";
  function lang() { try { return localStorage.getItem(LS) || "de"; } catch (e) { return "de"; } }

  const MONATE = {
    Januar: "Janar", Februar: "Shkurt", "März": "Mars", April: "Prill", Mai: "Maj",
    Juni: "Qershor", Juli: "Korrik", August: "Gusht", September: "Shtator",
    Oktober: "Tetor", November: "Nëntor", Dezember: "Dhjetor",
  };

  // Exakte Phrasen (ganzer Textknoten, getrimmt) -> Albanisch (Kosovo)
  const TX = {
    // Kopf / Navigation
    "Abnahmescheine": "Fletëpranime",
    "🔔 Benachrichtigungen": "🔔 Njoftimet",
    "Lade...": "Duke ngarkuar...",
    "📅 Kalender": "📅 Kalendari",
    "← Zurück zur Liste": "← Kthehu te lista",
    "← Zurück": "← Kthehu",
    // Liste
    "Diese Woche": "Kjo javë",
    "Letzte Woche": "Java e kaluar",
    "Älter": "Më të vjetra",
    "Unterschriebene Scheine": "Fletëpranime të nënshkruara",
    "Keine Treffer für diese Suche.": "Asnjë rezultat për këtë kërkim.",
    "Aktuell keine Abnahmescheine vorhanden.": "Momentalisht nuk ka fletëpranime.",
    "ERLEDIGT": "KRYER",
    "OFFEN": "HAPUR",
    "(ohne Adresse)": "(pa adresë)",
    "📎 Anhang": "📎 Bashkëngjitje",
    "📝 Notiz": "📝 Shënim",
    "📦 Material eintragen": "📦 Fut materialin",
    // Detail
    "Objekt": "Objekti",
    "🗺️ Route (Apple Karten)": "🗺️ Rruga (Apple Maps)",
    "🧭 Route (Google Maps)": "🧭 Rruga (Google Maps)",
    "Ansprechpartner vor Ort": "Personi kontaktues në vend",
    "📞 Anrufen": "📞 Telefono",
    "Termin": "Termini",
    "📝 Interne Notiz": "📝 Shënim i brendshëm",
    "Lade Unterschrift...": "Duke ngarkuar nënshkrimin...",
    // Fotos / Material
    "Abbrechen": "Anulo",
    "Fotos speichern": "Ruaj fotot",
    "Vorher-Fotos": "Fotot para",
    "Nachher-Fotos": "Fotot pas",
    "📷 Fotos bearbeiten": "📷 Modifiko fotot",
    "📦 Hier noch Material eintragen!": "📦 Fut edhe materialin këtu!",
    "Jetzt eintragen": "Fut tani",
    "📦 Material-Angaben bearbeiten": "📦 Modifiko të dhënat e materialit",
    "📦 Material eintragen (jederzeit möglich)": "📦 Fut materialin (kurdo)",
    "Kurze Angaben zum Einsatz": "Të dhëna të shkurtra për punën",
    "Optional – hilft uns bei der Material- und Zeitplanung.": "Opsionale – na ndihmon në planifikimin e materialit dhe kohës.",
    "Wie viele Stunden warst du insgesamt vor Ort?": "Sa orë ishe gjithsej në vend?",
    "Materialverbrauch": "Konsumi i materialit",
    "Verwendete Geräte": "Pajisjet e përdorura",
    "Streichen mit Farbe": "Lyerje me ngjyrë",
    "Hochdruckreiniger": "Pastrues me presion të lartë",
    "Sandstrahlgerät": "Pajisje me rërë",
    "Verwendetes Material (optional)": "Materiali i përdorur (opsionale)",
    "Später ausfüllen": "Plotëso më vonë",
    // Unterschrift
    "Abnahme bestätigen": "Konfirmo pranimin",
    "Die ordnungsgemäße Durchführung der Arbeiten wird bestätigt. Spätere Reklamationen können nicht anerkannt werden.":
      "Konfirmohet kryerja e rregullt e punëve. Reklamimet e mëvonshme nuk mund të pranohen.",
    "Name der unterschreibenden Person": "Emri i personit që nënshkruan",
    "Datum": "Data",
    "Unterschrift": "Nënshkrimi",
    "Löschen": "Fshij",
    "Schein sofort per E-Mail senden an (optional)": "Dërgo fletëpranimin menjëherë me email te (opsionale)",
    "Speichern": "Ruaj",
    "Jetzt unterschreiben": "Nënshkruaj tani",
    // Kalender
    "MO": "HË", "DI": "MA", "MI": "MË", "DO": "EN", "FR": "PR", "SA": "SH", "SO": "DI",
    "Erledigt": "Kryer",
    "Offen": "Hapur",
    // Toasts
    "Gespeichert": "U ruajt",
    "Bitte Namen der unterschreibenden Person eintragen": "Ju lutem shënoni emrin e personit që nënshkruan",
    "Bitte ein Datum wählen": "Ju lutem zgjidhni një datë",
    "Bitte unterschreiben": "Ju lutem nënshkruani",
    "Kein Empfang – wird automatisch gesendet, sobald wieder Netz da ist": "Nuk ka sinjal – dërgohet automatikisht sapo të ketë përsëri internet",
    "PDF-Versand fehlgeschlagen": "Dërgimi i PDF dështoi",
    "Datei konnte nicht geöffnet werden": "Skedari nuk mund të hapej",

    // ---- GEKO One (meine.html): Übersicht, Menü, Kalender, Urlaub ----
    "Meine Übersicht": "Përmbledhja ime",
    "Menü": "Menyja",
    "☰ Menü": "☰ Menyja",
    "🏠 Start": "🏠 Fillimi",
    "‹ Zurück": "‹ Kthehu",
    "Anmelden": "Kyçu",
    "Benutzername": "Emri i përdoruesit",
    "Passwort": "Fjalëkalimi",
    "Prüfe…": "Duke kontrolluar…",
    "Schön, dass du da bist!": "Mirë që je këtu!",
    "Guten Morgen – auf einen guten Tag!": "Mirëmëngjes – ditë të mbarë!",
    "Guten Nachmittag!": "Mirëdita!",
    "Feierabend in Sicht 🌙": "Fundi i punës po afron 🌙",
    "DEINE BEREICHE": "FUSHAT E TUA",
    "FÜR DICH": "PËR TY",
    "EINSTELLUNGEN": "CILËSIMET",
    "DEIN KONTO": "LLOGARIA JOTE",
    "Glas-Touren": "Turne xhami",
    "Deine Touren & Unterschriften": "Turnet dhe nënshkrimet e tua",
    "Graffiti": "Grafiti",
    "Abnahmescheine & Fotos": "Fletëpranime dhe foto",
    "Check-ins": "Check-in",
    "Rundgänge & Arbeitszeit": "Rondat dhe orari i punës",
    "Mein Kalender": "Kalendari im",
    "Touren, Termine & dein Urlaub": "Turnet, terminet dhe pushimi yt",
    "Meine Dokumente": "Dokumentet e mia",
    "Lohnabrechnungen & Infos": "Fletëpagesat dhe informacionet",
    "Passwort ändern": "Ndrysho fjalëkalimin",
    "Nur du kennst es danach": "Pastaj vetëm ti e di",
    "Benachrichtigungen": "Njoftimet",
    "Auf diesem Gerät aktivieren": "Aktivizo në këtë pajisje",
    "Auf diesem Gerät noch nicht aktiviert.": "Ende i paaktivizuar në këtë pajisje.",
    "✅ Auf diesem Gerät aktiv.": "✅ Aktiv në këtë pajisje.",
    "Darstellung": "Pamja",
    "„Automatisch\" folgt dem Handy.": "„Automatik\" ndjek telefonin.",
    "📱 Auto": "📱 Auto",
    "☀️ Hell": "☀️ E ndritshme",
    "🌙 Dunkel": "🌙 E errët",
    "Sprache / Gjuha": "Gjuha",
    "Gilt für alle deine GEKO-Apps auf diesem Gerät.": "Vlen për të gjitha aplikacionet GEKO në këtë pajisje.",
    "Abmelden": "Dilni",
    "Nur aus GEKO One auf diesem Gerät": "Vetëm nga GEKO One në këtë pajisje",
    "Angemeldet als": "I kyçur si",
    // Kalender
    "KOMMENDE TERMINE": "TERMINET E ARDHSHME",
    "DEINE ANTRÄGE": "KËRKESAT E TUA",
    "Keine Termine.": "Asnjë termin.",
    "Lade deine Termine…": "Duke ngarkuar terminet…",
    "Neu laden": "Ngarko sërish",
    "Glas-Touren ": "Turne xhami ",
    "Rundgänge": "Rondat",
    "Dein Urlaub": "Pushimi yt",
    "Lager": "Depoja",
    "Lager-Plan": "Plani i depos",
    "Im Lager sein": "Të jesh në depo",
    "Das Büro hat dich eingeteilt.": "Zyra të ka caktuar.",
    "✓ Bestätigt – das Büro weiß Bescheid.": "✓ Konfirmuar – zyra e di.",
    "Bestätigt ✓": "Konfirmuar ✓",
    "Gelesen – bin da!": "E lexova – do të jem aty!",
    "Keine Verbindung – dein Lager-Plan konnte nicht geladen werden.": "S'ka lidhje – plani i depos nuk u ngarkua.",
    "↻ Erneut versuchen": "↻ Provo përsëri",
    "Keine Verbindung – bitte später erneut abhaken": "S'ka lidhje – provo ta konfirmosh më vonë",
    "✗ Als „nicht da\" vermerkt": "✗ Shënuar si „nuk ishte aty\"",
    "Nicht da gewesen (Vermerk vom Büro)": "Nuk ishe aty (shënim i zyrës)",
    "Noch nicht bestätigt": "Ende e pakonfirmuar",
    "Übermorgen": "Pasnesër",
    "Gestern": "Dje",
    "Vorgestern": "Pardje",
    "Montag": "E hënë", "Dienstag": "E martë", "Mittwoch": "E mërkurë",
    "Donnerstag": "E enjte", "Freitag": "E premte", "Samstag": "E shtunë", "Sonntag": "E diel",
    "Mehr Einstellungen": "Më shumë cilësime",
    "Meine Urlaubsanträge": "Kërkesat e mia për pushim",
    "Alle Anträge – auch vergangene": "Të gjitha kërkesat – edhe të kaluarat",
    "Neujahr": "Viti i Ri", "Karfreitag": "E Premtja e Madhe",
    "Ostersonntag": "E Diela e Pashkëve", "Ostermontag": "E Hëna e Pashkëve",
    "Tag der Arbeit": "Dita e Punës", "Christi Himmelfahrt": "Ngjitja e Krishtit",
    "Pfingstsonntag": "Rrëshajët", "Pfingstmontag": "E Hëna e Rrëshajëve",
    "Fronleichmam": "Corpus Christi", "Fronleichnam": "Corpus Christi",
    "Tag der Deutschen Einheit": "Dita e Bashkimit Gjerman",
    "Allerheiligen": "Të gjithë Shenjtorët",
    "1. Weihnachtstag": "Krishtlindje (dita 1)", "2. Weihnachtstag": "Krishtlindje (dita 2)",
    "Wann du im Lager sein sollst": "Kur duhet të jesh në depo",
    "Nichts eingeteilt": "Asgjë e caktuar",
    "DEMNÄCHST": "SË SHPEJTI",
    "WAR SCHON": "TASHMË KALUAR",
    "Für dich ist gerade nichts eingeteilt.": "Për ty nuk është caktuar asgjë për momentin.",
    "Sobald das Büro dich einteilt, steht es hier – und du bekommst eine Benachrichtigung aufs Handy.": "Sapo zyra të të caktojë, do të shfaqet këtu – dhe do të marrësh njoftim në telefon.",
    "📦 Der Lager-Plan ist noch nicht eingerichtet.": "📦 Plani i depos ende nuk është konfiguruar.",
    "Bitte im Büro Bescheid geben.": "Të lutem njofto zyrën.",
    "Erledigt": "Kryer",
    "Glas-Tour": "Turn xhami",
    "Glas-Tour · abgeschlossen": "Turn xhami · i përfunduar",
    "Alle kommenden zeigen": "Shfaq të gjitha të ardhshmet",
    // Urlaub
    "🏖️ Urlaub beantragen": "🏖️ Kërko pushim",
    "Urlaub beantragen": "Kërko pushim",
    "Von": "Nga",
    "Bis": "Deri",
    "Notiz ans Büro (optional)": "Shënim për zyrën (opsionale)",
    "Antrag senden": "Dërgo kërkesën",
    "Sende…": "Duke dërguar…",
    "Abbrechen": "Anulo",
    "Urlaub": "Pushim",
    "Urlaub beantragt": "Pushim i kërkuar",
    "Wartet auf das Büro": "Në pritje të zyrës",
    "⏳ Wartet auf Freigabe": "⏳ Në pritje të miratimit",
    "❌ Abgelehnt": "❌ E refuzuar",
    "Zurückziehen": "Tërhiq",
    "Antrag zurückgezogen": "Kërkesa u tërhoq",
    "Das Büro sieht deinen Antrag sofort und gibt ihn frei oder lehnt ab. Du siehst den Stand hier.":
      "Zyra e sheh menjëherë kërkesën tënde dhe e miraton ose e refuzon. Statusin e sheh këtu.",
    "Antrag gesendet – das Büro entscheidet zeitnah ✓": "Kërkesa u dërgua – zyra vendos së shpejti ✓",
    "Bitte ein Von-Datum wählen.": "Të lutem zgjidh një datë fillimi.",
    "Das Bis-Datum liegt vor dem Von-Datum.": "Data e mbarimit është para datës së fillimit.",
    "Urlaub kann nur ab heute beantragt werden.": "Pushimi mund të kërkohet vetëm nga sot e tutje.",
  };

  // placeholder / title (Attribute)
  const ATTR = {
    "z.B. Familienbesuch": "p.sh. vizitë familjare",
    "Aktualisieren": "Rifresko",
    "Suche nach Kunde, Adresse, Kategorie...": "Kërko klient, adresë, kategori...",
    "Vor- und Nachname": "Emri dhe mbiemri",
    "kunde@firma.de – leer lassen = kein Versand": "klienti@firma.de – lëre bosh = pa dërgim",
    "z.B. 2x Reiniger, 1x Lappenpaket": "p.sh. 2x pastrues, 1x pako leckash",
    "Aktualisieren": "Rifresko",
  };

  // Teilstring-Ersetzungen (in gemischten Knoten wie "August · Kd.-Nr. 123")
  const SUBSTR = [["Kd.-Nr.", "Nr. klienti"]];

  // Dynamische Muster
  const RX = [
    [/^Hallo (.+)$/, (m, a) => "Përshëndetje " + a],
    [/^Moin, (.+)$/, (m, a) => "Tungjatjeta, " + a],
    // Lager-Plan: "Morgen um 05:30 Uhr im Lager" / "15.08.2026 um 06:00 Uhr im Lager"
    [/^Heute um (\d{1,2}:\d{2}) Uhr im Lager$/, (m, z) => `Sot në orën ${z} në depo`],
    [/^Morgen um (\d{1,2}:\d{2}) Uhr im Lager$/, (m, z) => `Nesër në orën ${z} në depo`],
    [/^(\d{2}\.\d{2}\.\d{4}) um (\d{1,2}:\d{2}) Uhr im Lager$/, (m, d, z) => `${d} në orën ${z} në depo`],
    [/^Im Lager sein · (.+)$/, (m, a) => "Të jesh në depo · " + a],
    [/^✓ Bestätigt · (.+)$/, (m, a) => "✓ Konfirmuar · " + a],
    [/^nächsten (Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)$/, (m, t) => "të " + t],
    [/^letzten (Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)$/, (m, t) => "të kaluarën " + t],
    [/^Heute um (\d{1,2}:\d{2}) Uhr$/, (m, z) => `Sot në orën ${z}`],
    [/^Morgen um (\d{1,2}:\d{2}) Uhr$/, (m, z) => `Nesër në orën ${z}`],
    [/^(\d{2}\.\d{2}\.\d{4}) um (\d{1,2}:\d{2}) Uhr$/, (m, d, z) => `${d} në orën ${z}`],
    // Kalender-Tagesüberschrift "AM 14.08.2026"
    [/^AM (\d{2}\.\d{2}\.\d{4})$/, (m, d) => "MË " + d],
    // Rundgang-Zeilen im GEKO-One-Kalender
    [/^Rundgang · erledigt \((\d+)\/(\d+)\)$/, (m, a, b) => `Ronda · kryer (${a}/${b})`],
    [/^Rundgang · (\d+)\/(\d+) erledigt$/, (m, a, b) => `Ronda · ${a}/${b} kryer`],
    [/^Rundgang · (\d{2}:\d{2})–(\d{2}:\d{2})$/, (m, a, b) => `Ronda · ${a}–${b}`],
    [/^(Mo|Di|Mi|Do|Fr|Sa|So)[–-](Mo|Di|Mi|Do|Fr|Sa|So) · immer wieder$/, () => "Çdo javë"],
    [/^(\d+) offene Scheine$/, (m, n) => n + " fletëpranime të hapura"],
    [/^1 offene Schein$/, () => "1 fletëpranim i hapur"],
    [/^Bereits unterschrieben am (.+)$/, (m, a) => "Tashmë i nënshkruar më " + a],
    [/^Von: (.+)$/, (m, a) => "Nga: " + a],
    [/^Fehler beim Speichern: (.+)$/, (m, a) => "Gabim gjatë ruajtjes: " + a],
    [/^([\d.,]+) Std\.$/, (m, a) => a + " orë"],
    [/^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember) (\d{4})$/,
      (m, mo, y) => (MONATE[mo] || mo) + " " + y],
    [/^(Termine am|Keine Termine am) (\d+)\. (Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember) (\d{4})$/,
      (m, kopf, d, mo, y) => (kopf === "Termine am" ? "Terminet më" : "Asnjë termin më") + " " + d + ". " + (MONATE[mo] || mo) + " " + y],
  ];

  function translate(str) {
    const key = str.trim();
    if (!key) return null;
    if (TX[key] !== undefined) return str.replace(key, TX[key]);
    for (const [rx, rep] of RX) { if (rx.test(key)) return str.replace(key, key.replace(rx, rep)); }
    // Teilstrings
    let out = str, hit = false;
    for (const [de, sq] of SUBSTR) { if (out.indexOf(de) !== -1) { out = out.split(de).join(sq); hit = true; } }
    return hit ? out : null;
  }

  function walkText(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) { if (n.nodeValue && n.nodeValue.trim()) nodes.push(n); }
    for (const node of nodes) {
      const t = translate(node.nodeValue);
      if (t !== null && t !== node.nodeValue) node.nodeValue = t;
    }
  }

  function walkAttrs(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll("[placeholder]").forEach((el) => {
      const v = ATTR[(el.getAttribute("placeholder") || "").trim()];
      if (v) el.setAttribute("placeholder", v);
    });
    root.querySelectorAll("[title]").forEach((el) => {
      const v = ATTR[(el.getAttribute("title") || "").trim()];
      if (v) el.setAttribute("title", v);
    });
  }

  let applying = false;
  function apply() {
    if (lang() !== "sq" || applying) return;
    applying = true;
    try {
      const targets = [document.querySelector(".app-header"), document.getElementById("view"), document.getElementById("toast")];
      // Overlays (Menü-Dropdown, Sheets, Modale) hängen direkt am body und lägen
      // sonst außerhalb der festen Ziele - sie blieben deutsch.
      document.body.querySelectorAll(":scope > .one-drop-ov, :scope > .modal-overlay, :scope > #glasModalHost")
        .forEach((el) => targets.push(el));
      targets.forEach((t) => { if (t) { walkText(t); walkAttrs(t); } });
    } catch (e) { /* nie die App wegen Übersetzung crashen lassen */ }
    applying = false;
  }

  // Die Sprache wird NICHT mehr in der Kopfzeile umgeschaltet - das machte die Leiste
  // uneinheitlich (jede App sah anders aus). Sie sitzt jetzt zentral im GEKO-One-Menü
  // unter "Sprache" und gilt über denselben Speicherschlüssel für alle MA-Apps.
  function entferneAltenSelector() {
    const alt = document.getElementById("maLangBtn");
    if (alt) alt.remove();
  }

  function setup() {
    entferneAltenSelector();
    apply();
    try {
      const obs = new MutationObserver(() => { if (!applying) apply(); });
      [document.querySelector(".app-header"), document.getElementById("view"), document.getElementById("toast")]
        .filter(Boolean)
        .forEach((t) => obs.observe(t, { childList: true, subtree: true, characterData: true }));
      // Overlays (Menü-Dropdown, Sheets) hängen direkt am body und lägen sonst
      // außerhalb der beobachteten Bereiche - sie blieben deutsch.
      obs.observe(document.body, { childList: true });
    } catch (e) {}
  }

  // Damit Seiten nach dem Einhängen eines Overlays sofort übersetzen können
  window.gekoI18nApply = () => { if (!applying) apply(); };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();
