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
  };

  // placeholder / title (Attribute)
  const ATTR = {
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
      targets.forEach((t) => { if (t) { walkText(t); walkAttrs(t); } });
    } catch (e) { /* nie die App wegen Übersetzung crashen lassen */ }
    applying = false;
  }

  function injectSelector() {
    const row = document.querySelector(".app-header .brand-row");
    if (!row || document.getElementById("maLangBtn")) return;
    const btn = document.createElement("button");
    btn.id = "maLangBtn";
    // Gleicher Knopf-Stil wie Start/Zurück (geko-navbtn), damit die Kopfzeile
    // einheitlich aussieht. Kompakt (nur Flagge + Kürzel), damit alles nebeneinander
    // passt; die Leiste bricht bei sehr schmalen Geräten sauber um.
    btn.className = "geko-navbtn";
    btn.type = "button";
    btn.textContent = lang() === "sq" ? "🇦🇱" : "🇩🇪";
    btn.title = lang() === "sq" ? "Gjuha: Shqip (ndrysho)" : "Sprache: Deutsch (wechseln)";
    btn.setAttribute("aria-label", "Sprache wechseln / Ndrysho gjuhën");
    btn.addEventListener("click", () => {
      const next = lang() === "sq" ? "de" : "sq";
      try { localStorage.setItem(LS, next); } catch (e) {}
      location.reload();
    });
    // Vor den ersten Nav-Knopf (Start) setzen, damit die Reihenfolge
    // [Sprache][Start][Zurück] bleibt und die drei als Gruppe rechts stehen.
    const ersterNav = row.querySelector(".geko-navbtn.right");
    if (ersterNav) { ersterNav.classList.remove("right"); btn.classList.add("right"); row.insertBefore(btn, ersterNav); }
    else row.appendChild(btn);
  }

  function setup() {
    injectSelector();
    apply();
    try {
      const obs = new MutationObserver(() => { if (!applying) apply(); });
      [document.querySelector(".app-header"), document.getElementById("view"), document.getElementById("toast")]
        .filter(Boolean)
        .forEach((t) => obs.observe(t, { childList: true, subtree: true, characterData: true }));
    } catch (e) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();
