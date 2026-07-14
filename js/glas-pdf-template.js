// PDF für die Glasreinigung im GEKO-Layout (gleiche Koordinaten/Typografie wie
// js/pdf-template.js), ergänzt um: Kunde/Auftraggeber oben links, "Auszuführende
// Arbeiten [Monat] [Jahr]" + Kd.-Nr., Position + QM-Zeile, Name/Datum/Unterschrift.
//
// Zwei Templates (Branding):
//   "geko" -> GEKO Logo + ISO-Badges
//   "sub"  -> Dietrich-Logo + TÜV-NORD-Badges (siehe js/glas-logo-sub.js)

const GLAS_TEMPLATES = {
  geko: {
    label: "GEKO Clean",
    logo: () => (typeof GEKO_LOGO_B64 !== "undefined" ? GEKO_LOGO_B64 : ""),
    logoTop: { w: 23, h: 37.1 },
    badges: () =>
      typeof ISO14001_LOGO_B64 !== "undefined"
        ? [
            { src: ISO14001_LOGO_B64, x: 98, w: 40 },
            { src: ISO9001_LOGO_B64, x: 140, w: 40 },
          ]
        : [],
    badgeH: 15.06,
  },
  sub: {
    label: "Dietrich",
    logo: () => (typeof SUB_LOGO_B64 !== "undefined" ? SUB_LOGO_B64 : ""),
    logoTop: { w: 40, h: 9.5 },
    // 4 TÜV-NORD-Kreise (aus dem Original-Schein gescannt), Seitenverhältnis 4:1 -
    // klein und rechtsbündig wie auf dem Papier-Vordruck
    badges: () =>
      typeof SUB_BADGES_B64 !== "undefined" ? [{ src: SUB_BADGES_B64, x: 106, w: 64 }] : [],
    badgeH: 16,
  },
};

const GLAS_LAYOUT = {
  left: 25.08,
  right: 184.8,
  title: { x: 25.08, y: 31.3, size: 14 },

  auftraggeberLabel: { x: 26.15, y: 57.39 },
  auftraggeberContentX: 37.57,
  auftraggeberFirstLineGap: 10.41,

  objektLabel: { x: 26.15 },
  objektLabelGap: 10.25,
  objektContentX: 37.57,
  objektFirstLineGap: 5.16,

  lineGap: 5.16,

  kdnrX: 131.68,

  rowGapAfterLine1: 7.68,
  line2GapAfterRow: 2.48,
  bulletGapAfterLine2: 10.04,
  bulletLineGap: 5.16,
  qmX: 148,

  disclaimerY: 226.97,
  disclaimerLineGap: 5.17,

  sigLineY: 243.82,
  sigLabelGap: 5.17,
  unterschriftLabelX: 87.52,

  badgeY: 258.4,
};

const GLAS_MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function glasMonatJahr(isoDate) {
  const d = isoDate ? new Date(isoDate + "T00:00:00") : new Date(); // lokal parsen, nicht UTC
  return `${GLAS_MONATE[d.getMonth()]} ${d.getFullYear()}`;
}

function glasFormatQm(qm) {
  if (qm === undefined || qm === null || qm === "") return "";
  const num = parseFloat(String(qm).replace(",", "."));
  if (isNaN(num)) return String(qm);
  return num.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// s: { kunde_adresse, objekt, adresse, kdnr, position, qm, name, datum, unterschrift }
// tourDatum: ISO-Datum der Tour, bestimmt "Auszuführende Arbeiten Monat: ..."
// existingDoc (optional): wird ein bestehendes jsPDF-Dokument übergeben, hängt dieser
// Schein als NEUE Seite an (für "alle Scheine einer Tour in EIN PDF"). Ohne den
// Parameter verhält sich alles exakt wie bisher (neues Ein-Seiten-PDF).
function generateGlasPdf(s, templateKey, tourDatum, existingDoc) {
  const { jsPDF } = window.jspdf;
  const doc = existingDoc || new jsPDF({ unit: "mm", format: "a4" });
  if (existingDoc) doc.addPage();
  const tpl = GLAS_TEMPLATES[templateKey] || GLAS_TEMPLATES.geko;
  const L = GLAS_LAYOUT;

  // Eingebettete Unicode-Schrift, damit Ä/Ö/Ü/ß im PDF korrekt erscheinen (die jsPDF-
  // Standard-Helvetica kann diese Zeichen nicht darstellen). Fällt bei Problemen auf
  // Helvetica zurück.
  const FONT = (typeof glasRegisterPdfFont === "function" && glasRegisterPdfFont(doc)) ? "LibSans" : "helvetica";
  doc.setFont(FONT, "normal");

  // Titel
  doc.setFontSize(L.title.size);
  doc.setFont(FONT, "bold");
  doc.text("Abnahmebescheinigung", L.title.x, L.title.y);

  // Logo oben rechts
  const logo = tpl.logo();
  if (logo) {
    doc.addImage(logo, "PNG", L.right - tpl.logoTop.w, 12.9, tpl.logoTop.w, tpl.logoTop.h);
  }

  // Auftraggeber (Kunde, oben links)
  let y = L.auftraggeberLabel.y;
  doc.setFontSize(11);
  doc.setFont(FONT, "bold");
  doc.text("Auftraggeber", L.auftraggeberLabel.x, y);

  y += L.auftraggeberFirstLineGap;
  doc.setFont(FONT, "normal");
  doc.setFontSize(10.5);
  const kundeLines = (s.kunde_adresse || "").split("\n").filter((l) => l.trim());
  kundeLines.forEach((line, i) => doc.text(line, L.auftraggeberContentX, y + i * L.lineGap));
  y += Math.max(kundeLines.length, 1) * L.lineGap - L.lineGap;

  // Objekt
  y += L.objektLabelGap;
  doc.setFontSize(11);
  doc.setFont(FONT, "bold");
  doc.text("Objekt", L.objektLabel.x, y);

  let objY = y + L.objektFirstLineGap;
  doc.setFont(FONT, "normal");
  doc.setFontSize(10.5);
  const objektLine = s.objekt ? [s.objekt] : [];
  const adresseLines = (s.adresse || "").split("\n").filter((l) => l.trim());
  const allLines = [...objektLine, ...adresseLines];
  allLines.forEach((line, i) => doc.text(line, L.objektContentX, objY + i * L.lineGap));
  const objektEndY = objY + Math.max(allLines.length, 1) * L.lineGap - L.lineGap;

  // Trennlinie (direkt unter dem Objekt-Block, ohne separate Kategorie-Zeile)
  let lineY = objektEndY + 18;
  doc.setDrawColor(140, 140, 140);
  doc.setLineWidth(0.2);
  doc.line(L.left, lineY, L.right, lineY);

  // Auszuführende Arbeiten Monat / Kd.-Nr.
  // GEKO-Template: immer die Haupt-Kundennummer des Kunden.
  // Dietrich-Template: Haupt-Kd.-Nr. + Objekt-Nr. kombiniert ("2443 504 00" - so steht
  // es auf Dietrichs Original-Schein). Enthält die Objekt-Kdnr die Haupt-Nummer bereits
  // (Altbestand mit voll eingetippter Nummer), wird nichts doppelt vorangestellt.
  const kdnrForPdf = templateKey === "sub"
    ? glasDietrichKdnr(s)
    : (s.kunde_kdnr || s.kdnr || "");

  // Dietrich: LFD-Nr. (von Dietrich pro Schein/Intervall vergeben) - steht wie auf dem
  // Original oben rechts ÜBER der Kd.-Nr.-Zeile.
  if (templateKey === "sub" && (s.lfd_nr || "").trim()) {
    doc.setFont(FONT, "bold");
    doc.setFontSize(10.5);
    doc.text(`LFD Nr.:  ${String(s.lfd_nr).trim()}`, L.kdnrX, lineY - 4);
  }

  const rowY = lineY + L.rowGapAfterLine1;
  doc.setFont(FONT, "normal");
  doc.setFontSize(10.5);
  doc.text(`Auszuführende Arbeiten Monat:  ${glasMonatJahr(tourDatum)}`, L.left, rowY);
  doc.text(`Kd.-Nr.:  ${kdnrForPdf}`, L.kdnrX, rowY);

  // Linie 2
  const line2Y = rowY + L.line2GapAfterRow;
  doc.line(L.left, line2Y, L.right, line2Y);

  // Positionen (mehrere möglich) + Gesamt-Reinigungsfläche
  const posX = L.left;
  const descX = 48;
  let by = line2Y + L.bulletGapAfterLine2;
  let positionen = [];
  try {
    const parsed = JSON.parse(s.positionen || "[]");
    if (Array.isArray(parsed) && parsed.length) positionen = parsed;
  } catch (e) {}
  if (!positionen.length && (s.position || s.qm)) {
    positionen = [{ nr: s.position || "10", art: "Glas- und Rahmenreinigung", qm: s.qm || "" }];
  }

  let gesamtQm = 0;
  positionen.forEach((pos) => {
    const istStd = typeof glasIstStundenPos === "function" && glasIstStundenPos(pos);
    const qmText = glasFormatQm(pos.qm);
    doc.setFont(FONT, "bold");
    if (pos.nr) doc.text(`Pos.: ${pos.nr}`, posX, by);
    doc.setFont(FONT, "normal");
    // Lange Bezeichnungen umbrechen, damit sie nicht in die qm-Spalte laufen. Die
    // qm-Angabe steht auf der ersten Zeile; Folgezeilen laufen darunter weiter.
    const artBreite = L.qmX - descX - 4; // endet sicher vor der qm-Spalte
    const artLines = typeof doc.splitTextToSize === "function"
      ? doc.splitTextToSize(pos.art || "", artBreite)
      : [pos.art || ""];
    artLines.slice(0, 5).forEach((ln, li) => {
      doc.text(ln, descX, by);
      if (li === 0 && qmText) doc.text(`${qmText} ${istStd ? "Std." : "qm"}`, L.qmX, by);
      by += L.bulletLineGap;
    });
    if (!artLines.length) by += L.bulletLineGap;
    if (!istStd) {
      const num = parseFloat(String(pos.qm).replace(",", "."));
      if (!isNaN(num)) gesamtQm += num;
    }
    // Freier Positionstext direkt unter der Position (der Position zugeordnet), etwas
    // kleiner. Fällt bei ÄLTEREN Stopps (Momentaufnahme ohne pos_text) auf den aktuell
    // am Objekt hinterlegten Text zurück. Max. 6 Zeilen zum Schutz des Layouts.
    let posText = (pos.pos_text || "").trim();
    if (!posText && pos.id && typeof glasObjektPositionen !== "undefined") {
      const aktuell = (glasObjektPositionen || []).find((x) => x.id === pos.id);
      if (aktuell && aktuell.pos_text) posText = String(aktuell.pos_text).trim();
    }
    if (posText) {
      doc.setFontSize(9.5);
      const wrapped = typeof doc.splitTextToSize === "function" ? doc.splitTextToSize(posText, artBreite) : [posText];
      wrapped.slice(0, 6).forEach((ln) => { doc.text(ln, descX, by); by += L.bulletLineGap - 0.7; });
      doc.setFontSize(10.5);
      by += 1;
    }
  });

  // Zusatzleistungen, die der Mitarbeiter vor Ort eingetragen hat (z.B. Extra-Stunden)
  if (s.zusatz) {
    by += 2;
    doc.setFont(FONT, "bold");
    doc.text("Zusätzlich:", posX, by);
    doc.setFont(FONT, "normal");
    // Jede eingegebene Zeile ist eine eigene Zusatz-Position
    const eintraege = String(s.zusatz).split("\n").map((x) => x.trim()).filter(Boolean);
    let zLines = [];
    eintraege.forEach((e) => {
      const wrapped = typeof doc.splitTextToSize === "function" ? doc.splitTextToSize("- " + e, 110) : ["- " + e];
      zLines = zLines.concat(wrapped);
    });
    zLines.slice(0, 6).forEach((ln) => { doc.text(ln, descX, by); by += L.bulletLineGap; });
  }

  // "Gesamt Reinigungsfläche" bewusst weiter unten, kurz über dem Hinweistext -
  // dort, wo genug Platz ist, unabhängig davon wie viele Positionen es gibt
  if (gesamtQm > 0) {
    const gesamtY = L.disclaimerY - 16;
    doc.setFont(FONT, "bold");
    doc.text("Gesamt Reinigungsfläche:", descX, gesamtY);
    doc.setFont(FONT, "normal");
    doc.text(`${glasFormatQm(gesamtQm)} qm`, L.qmX, gesamtY);
  }

  // Hinweistext
  doc.setFontSize(10.5);
  doc.setFont(FONT, "normal");
  doc.text("Die ordnungsgemäße Durchführung der Arbeiten wird bestätigt!", L.left, L.disclaimerY);
  doc.text("Spätere Reklamationen können nicht anerkannt werden.", L.left, L.disclaimerY + L.disclaimerLineGap);

  // Unterschrift
  const sigX = 135;
  const sigW = 45;
  const sigH = 18;
  if (s.unterschrift) {
    try {
      doc.addImage(s.unterschrift, "PNG", sigX, L.sigLineY - sigH - 2, sigW, sigH);
    } catch (e) {}
  }
  if (s.name) {
    doc.setFontSize(8.5);
    doc.setFont(FONT, "italic");
    doc.text(s.name, sigX, L.sigLineY - 1.5);
  }
  // Datum am Unterschrift-Feld = Tag der Unterschrift (aus signed_at abgeleitet,
  // Fallback s.datum) - NICHT das Tour-Planungsdatum.
  const sigDatum = (typeof glasSignaturDatum === "function" ? glasSignaturDatum(s) : s.datum);
  if (sigDatum) {
    doc.setFontSize(10.5);
    doc.setFont(FONT, "normal");
    doc.text(formatGlasDate(sigDatum), L.left, L.sigLineY - 1.5);
  }

  doc.setLineDashPattern([1, 1], 0);
  doc.line(L.left, L.sigLineY, L.right, L.sigLineY);
  doc.setLineDashPattern([], 0);

  doc.setFontSize(9.5);
  doc.text("Datum", L.left, L.sigLineY + L.sigLabelGap);
  doc.text("Unterschrift des Auftraggebers", L.unterschriftLabelX, L.sigLineY + L.sigLabelGap);

  // Footer-Badges
  (tpl.badges() || []).forEach((b) => {
    doc.addImage(b.src, "PNG", b.x, L.badgeY, b.w, tpl.badgeH);
  });

  return doc;
}

// formatGlasDate kommt aus js/glas-shared.js (beide Glas-Seiten laden das vorher)

// Dietrich-Kd.-Nr. eines Stopps: Haupt-Kd.-Nr. des Kunden + Objekt-Nr. kombiniert
// (z.B. "2443  504 00" wie auf Dietrichs Original-Schein). Steckt die Haupt-Nummer schon
// in der Objekt-Kdnr (Altbestand, komplett eingetippt), bleibt nur die Objekt-Kdnr.
function glasDietrichKdnr(s) {
  const haupt = String(s.kunde_kdnr || "").trim();
  const obj = String(s.kdnr || "").trim();
  if (!obj) return haupt;
  if (!haupt || obj.includes(haupt)) return obj;
  return `${haupt} ${obj}`;
}

// Einheitlicher Dateiname für alle Abnahmescheine: LN_<Kd.-Nr.>_<Straße>.pdf
// (LN = Leistungsnachweis). Straße = erste Adresszeile. Kd.-Nr. nach gleicher Logik wie im
// PDF (Dietrich-Template: Haupt- + Objekt-Nr. kombiniert, sonst Haupt-Kdnr des Kunden).
function glasScheinFilename(s, templateKey) {
  const kdnr = templateKey === "sub"
    ? glasDietrichKdnr(s)
    : (s.kunde_kdnr || s.kdnr || "");
  const strasse = (s.adresse || "").split("\n")[0] || s.objekt || "";
  const clean = (v) => String(v || "").replace(/[^a-z0-9äöüß]+/gi, "_").replace(/^_+|_+$/g, "");
  const parts = ["LN", clean(kdnr), clean(strasse)].filter(Boolean);
  return parts.join("_") + ".pdf";
}
