// PDF für die Glasreinigung im GEKO-Layout (gleiche Koordinaten/Typografie wie
// js/pdf-template.js), ergänzt um: Kunde/Auftraggeber oben links, "Auszuführende
// Arbeiten [Monat] [Jahr]" + Kd.-Nr., Position + QM-Zeile, Name/Datum/Unterschrift.
//
// Zwei Templates (Branding):
//   "geko" -> GEKO Logo + ISO-Badges
//   "sub"  -> Dietrich-Logo + TÜV-NORD-Badges (siehe js/glas-logo-sub.js)
//
// Der Schein bricht automatisch auf mehrere Blaetter um, wenn die Positionen nicht
// auf eines passen - mit vollem Kopf UND Unterschrift auf jedem Blatt (siehe
// generateGlasPdf weiter unten).

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

// Wo die Positionsliste spaetestens enden muss. Darunter beginnt der feste Fuss:
// Gesamt-Reinigungsflaeche (disclaimerY - 16), Hinweistext, Unterschriftsfeld, Badges.
const GLAS_POS_MAX_Y = GLAS_LAYOUT.disclaimerY - 19;

// s: { kunde_adresse, objekt, adresse, kdnr, position, qm, name, datum, unterschrift }
// tourDatum: ISO-Datum der Tour, bestimmt "Auszuführende Arbeiten Monat: ..."
// existingDoc (optional): wird ein bestehendes jsPDF-Dokument übergeben, hängt dieser
// Schein als NEUE Seite an (für "alle Scheine einer Tour in EIN PDF"). Ohne den
// Parameter verhält sich alles exakt wie bisher.
//
// MEHRERE BLAETTER: Passen die Positionen nicht auf ein Blatt, laeuft der Schein auf
// dem naechsten weiter. Jedes Blatt bekommt den KOMPLETTEN Kopf (Auftraggeber, Objekt,
// Kd.-Nr.) UND den kompletten Fuss inklusive Unterschrift - jedes Blatt ist damit fuer
// sich allein ein gueltiger, unterschriebener Abnahmeschein. Unten rechts steht
// "Blatt 1 von 2". Vorher lief alles stumm ueber den Seitenrand hinaus und die
// Positionen ueberdruckten Hinweistext und Unterschrift.
function generateGlasPdf(s, templateKey, tourDatum, existingDoc) {
  const { jsPDF } = window.jspdf;
  const doc = existingDoc || new jsPDF({ unit: "mm", format: "a4" });
  const tpl = GLAS_TEMPLATES[templateKey] || GLAS_TEMPLATES.geko;
  // Kennung fuer die Bild-Wiederverwendung im PDF: pro Vorlage eigene Namen, damit
  // in einer Sammel-PDF nicht alle Scheine dasselbe Logo bekommen.
  const tplKey = GLAS_TEMPLATES[templateKey] ? templateKey : "geko";
  const L = GLAS_LAYOUT;

  // Eingebettete Unicode-Schrift, damit Ä/Ö/Ü/ß im PDF korrekt erscheinen (die jsPDF-
  // Standard-Helvetica kann diese Zeichen nicht darstellen). Fällt bei Problemen auf
  // Helvetica zurück.
  const FONT = (typeof glasRegisterPdfFont === "function" && glasRegisterPdfFont(doc)) ? "LibSans" : "helvetica";
  doc.setFont(FONT, "normal");

  const logo = tpl.logo();
  const posX = L.left;
  const descX = 48;
  const artBreite = L.qmX - descX - 4; // endet sicher vor der qm-Spalte

  /* ----------------------------------------------------------------------
     1. Kopf-Geometrie AUSRECHNEN (noch nichts zeichnen). Sie haengt nur an
     der Zahl der Adresszeilen und ist deshalb auf jedem Blatt gleich - nur so
     laesst sich vorab sagen, wie viel Platz die Positionen pro Blatt haben.
     ---------------------------------------------------------------------- */
  const kundeLines = (s.kunde_adresse || "").split("\n").filter((l) => l.trim());
  const objektLine = s.objekt ? [s.objekt] : [];
  const adresseLines = (s.adresse || "").split("\n").filter((l) => l.trim());
  const allLines = [...objektLine, ...adresseLines];

  const kundeStartY = L.auftraggeberLabel.y + L.auftraggeberFirstLineGap;
  const kundeEndY = kundeStartY + Math.max(kundeLines.length, 1) * L.lineGap - L.lineGap;
  const objektLabelY = kundeEndY + L.objektLabelGap;
  const objektStartY = objektLabelY + L.objektFirstLineGap;
  const objektEndY = objektStartY + Math.max(allLines.length, 1) * L.lineGap - L.lineGap;
  const lineY = objektEndY + 18;     // Trennlinie unter dem Objekt-Block
  const rowY = lineY + L.rowGapAfterLine1;
  const line2Y = rowY + L.line2GapAfterRow;
  const startY = line2Y + L.bulletGapAfterLine2; // erste Positionszeile

  // Auszuführende Arbeiten Monat / Kd.-Nr.
  // GEKO-Template: immer die Haupt-Kundennummer des Kunden.
  // Dietrich-Template: Haupt-Kd.-Nr. + Objekt-Nr. kombiniert ("2443 504 00" - so steht
  // es auf Dietrichs Original-Schein). Enthält die Objekt-Kdnr die Haupt-Nummer bereits
  // (Altbestand mit voll eingetippter Nummer), wird nichts doppelt vorangestellt.
  const kdnrForPdf = templateKey === "sub"
    ? glasDietrichKdnr(s)
    : (s.kunde_kdnr || s.kdnr || "");

  function zeichneKopf() {
    doc.setTextColor(0, 0, 0);

    // Titel
    doc.setFontSize(L.title.size);
    doc.setFont(FONT, "bold");
    doc.text("Abnahmebescheinigung", L.title.x, L.title.y);

    // Logo oben rechts
    if (logo) {
      doc.addImage(logo, "PNG", L.right - tpl.logoTop.w, 12.9, tpl.logoTop.w, tpl.logoTop.h, "glas-logo-" + tplKey, "MEDIUM");
    }

    // Auftraggeber (Kunde, oben links)
    doc.setFontSize(11);
    doc.setFont(FONT, "bold");
    doc.text("Auftraggeber", L.auftraggeberLabel.x, L.auftraggeberLabel.y);
    doc.setFont(FONT, "normal");
    doc.setFontSize(10.5);
    kundeLines.forEach((line, i) => doc.text(line, L.auftraggeberContentX, kundeStartY + i * L.lineGap));

    // Objekt
    doc.setFontSize(11);
    doc.setFont(FONT, "bold");
    doc.text("Objekt", L.objektLabel.x, objektLabelY);
    doc.setFont(FONT, "normal");
    doc.setFontSize(10.5);
    allLines.forEach((line, i) => doc.text(line, L.objektContentX, objektStartY + i * L.lineGap));

    // Trennlinie
    doc.setDrawColor(140, 140, 140);
    doc.setLineWidth(0.2);
    doc.line(L.left, lineY, L.right, lineY);

    // Dietrich: LFD-Nr. (von Dietrich pro Schein/Intervall vergeben) - steht wie auf dem
    // Original oben rechts ÜBER der Kd.-Nr.-Zeile.
    if (templateKey === "sub" && (s.lfd_nr || "").trim()) {
      doc.setFont(FONT, "bold");
      doc.setFontSize(10.5);
      doc.text(`LFD Nr.:  ${String(s.lfd_nr).trim()}`, L.kdnrX, lineY - 4);
    }

    doc.setFont(FONT, "normal");
    doc.setFontSize(10.5);
    doc.text(`Auszuführende Arbeiten Monat:  ${glasMonatJahr(tourDatum)}`, L.left, rowY);
    doc.text(`Kd.-Nr.:  ${kdnrForPdf}`, L.kdnrX, rowY);

    // Linie 2
    doc.line(L.left, line2Y, L.right, line2Y);
  }

  /* ----------------------------------------------------------------------
     2. Positionen in ZEILEN zerlegen und ausmessen. Jede Zeile weiss, wie
     hoch sie ist und wie sie sich auf einer gegebenen Hoehe zeichnet - erst
     danach wird entschieden, welche Zeile auf welches Blatt kommt.
     ---------------------------------------------------------------------- */
  let positionen = [];
  try {
    const parsed = JSON.parse(s.positionen || "[]");
    if (Array.isArray(parsed) && parsed.length) positionen = parsed;
  } catch (e) {}
  if (!positionen.length && (s.position || s.qm)) {
    positionen = [{ nr: s.position || "10", art: "Glas- und Rahmenreinigung", qm: s.qm || "" }];
  }

  const teile = (text, breite) =>
    (typeof doc.splitTextToSize === "function" ? doc.splitTextToSize(text, breite) : [text]);

  const bloecke = []; // je Position ein Block; Bloecke bleiben moeglichst zusammen
  let gesamtQm = 0;

  positionen.forEach((pos) => {
    const istStd = typeof glasIstStundenPos === "function" && glasIstStundenPos(pos);
    const qmText = glasFormatQm(pos.qm);

    // Lange Bezeichnungen umbrechen, damit sie nicht in die qm-Spalte laufen. Die
    // qm-Angabe steht auf der ersten Zeile; Folgezeilen laufen darunter weiter.
    doc.setFont(FONT, "normal");
    doc.setFontSize(10.5);
    let artLines = teile(pos.art || "", artBreite);
    if (!artLines.length) artLines = [""];

    // Freier Positionstext direkt unter der Position (der Position zugeordnet), etwas
    // kleiner. Fällt bei ÄLTEREN Stopps (Momentaufnahme ohne pos_text) auf den aktuell
    // am Objekt hinterlegten Text zurück. Keine Kappung mehr - was nicht mehr passt,
    // wandert jetzt aufs naechste Blatt statt verloren zu gehen.
    let posText = (pos.pos_text || "").trim();
    if (!posText && pos.id && typeof glasObjektPositionen !== "undefined") {
      const aktuell = (glasObjektPositionen || []).find((x) => x.id === pos.id);
      if (aktuell && aktuell.pos_text) posText = String(aktuell.pos_text).trim();
    }
    doc.setFontSize(9.5);
    const textLines = posText ? teile(posText, artBreite) : [];
    doc.setFontSize(10.5);

    const zeilen = [];
    artLines.forEach((ln, li) => {
      zeilen.push({
        h: L.bulletLineGap,
        zeichne: (y) => {
          doc.setFontSize(10.5);
          if (li === 0) {
            doc.setFont(FONT, "bold");
            if (pos.nr) doc.text(`Pos.: ${pos.nr}`, posX, y);
            doc.setFont(FONT, "normal");
            if (qmText) doc.text(`${qmText} ${istStd ? "Std." : "qm"}`, L.qmX, y);
          } else {
            doc.setFont(FONT, "normal");
          }
          doc.text(ln, descX, y);
        },
      });
    });
    textLines.forEach((ln, li) => {
      zeilen.push({
        h: L.bulletLineGap - 0.7 + (li === textLines.length - 1 ? 1 : 0),
        zeichne: (y) => {
          doc.setFont(FONT, "normal");
          doc.setFontSize(9.5);
          doc.text(ln, descX, y);
          doc.setFontSize(10.5);
        },
      });
    });

    bloecke.push({ zeilen, hoehe: zeilen.reduce((a, z) => a + z.h, 0) });

    if (!istStd) {
      const num = parseFloat(String(pos.qm).replace(",", "."));
      if (!isNaN(num)) gesamtQm += num;
    }
  });

  // Zusatzleistungen, die der Mitarbeiter vor Ort eingetragen hat (z.B. Extra-Stunden)
  if (s.zusatz) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(10.5);
    // Jede eingegebene Zeile ist eine eigene Zusatz-Position
    const eintraege = String(s.zusatz).split("\n").map((x) => x.trim()).filter(Boolean);
    let zLines = [];
    eintraege.forEach((e) => { zLines = zLines.concat(teile("- " + e, 110)); });
    if (zLines.length) {
      const zeilen = [{ h: 2, zeichne: () => {} }]; // kleiner Abstand vor dem Block
      zLines.forEach((ln, li) => {
        zeilen.push({
          h: L.bulletLineGap,
          zeichne: (y) => {
            doc.setFontSize(10.5);
            if (li === 0) {
              doc.setFont(FONT, "bold");
              doc.text("Zusätzlich:", posX, y);
            }
            doc.setFont(FONT, "normal");
            doc.text(ln, descX, y);
          },
        });
      });
      bloecke.push({ zeilen, hoehe: zeilen.reduce((a, z) => a + z.h, 0) });
    }
  }

  /* ----------------------------------------------------------------------
     3. Bloecke auf Blaetter verteilen. Eine Position bleibt zusammen; nur
     wenn ein einzelner Block groesser ist als ein ganzes Blatt, wird er
     zeilenweise umgebrochen (sonst liefe er wieder aus dem Blatt heraus).
     ---------------------------------------------------------------------- */
  const kapazitaet = GLAS_POS_MAX_Y - startY;
  const seiten = [];
  let aktuell = [];
  let y = startY;
  const blattWechsel = () => { seiten.push(aktuell); aktuell = []; y = startY; };

  bloecke.forEach((b) => {
    if (b.hoehe > kapazitaet) {
      b.zeilen.forEach((z) => {
        if (aktuell.length && y + z.h > GLAS_POS_MAX_Y) blattWechsel();
        aktuell.push(z);
        y += z.h;
      });
      return;
    }
    if (aktuell.length && y + b.hoehe > GLAS_POS_MAX_Y) blattWechsel();
    b.zeilen.forEach((z) => aktuell.push(z));
    y += b.hoehe;
  });
  seiten.push(aktuell);

  /* ----------------------------------------------------------------------
     4. Fuss - steht auf JEDEM Blatt, inklusive Unterschrift. Die Gesamt-
     Reinigungsflaeche nur auf dem letzten Blatt (sie gilt fuer den ganzen
     Schein und stuende sonst mehrfach da).
     ---------------------------------------------------------------------- */
  const sigDatum = (typeof glasSignaturDatum === "function" ? glasSignaturDatum(s) : s.datum);

  function zeichneFuss(blattNr, blaetter, summeQm) {
    // "Gesamt Reinigungsfläche" bewusst weiter unten, kurz über dem Hinweistext -
    // dort, wo genug Platz ist, unabhängig davon wie viele Positionen es gibt
    if (summeQm > 0) {
      const gesamtY = L.disclaimerY - 16;
      doc.setFont(FONT, "bold");
      doc.setFontSize(10.5);
      doc.text("Gesamt Reinigungsfläche:", descX, gesamtY);
      doc.setFont(FONT, "normal");
      doc.text(`${glasFormatQm(summeQm)} qm`, L.qmX, gesamtY);
    }

    // Hinweistext
    doc.setFontSize(10.5);
    doc.setFont(FONT, "normal");
    doc.text("Die ordnungsgemäße Durchführung der Arbeiten wird bestätigt!", L.left, L.disclaimerY);
    doc.text("Spätere Reklamationen können nicht anerkannt werden.", L.left, L.disclaimerY + L.disclaimerLineGap);

    // Unterschrift - bewusst auf jedem Blatt, damit auch Blatt 2 unterschrieben ist
    const sigX = 135;
    const sigW = 45;
    const sigH = 18;
    if (s.unterschrift) {
      try {
        // alias bewusst undefined: jsPDF leitet sie aus den Bilddaten ab, sonst wuerden
        // verschiedene Unterschriften in einer Sammel-PDF alle gleich aussehen.
        doc.addImage(s.unterschrift, "PNG", sigX, L.sigLineY - sigH - 2, sigW, sigH, undefined, "MEDIUM");
      } catch (e) {}
    }
    if (s.name) {
      doc.setFontSize(8.5);
      doc.setFont(FONT, "italic");
      doc.text(s.name, sigX, L.sigLineY - 1.5);
    }
    // Datum am Unterschrift-Feld = Tag der Unterschrift (aus signed_at abgeleitet,
    // Fallback s.datum) - NICHT das Tour-Planungsdatum.
    doc.setFont(FONT, "normal");
    if (sigDatum) {
      doc.setFontSize(10.5);
      doc.text(formatGlasDate(sigDatum), L.left, L.sigLineY - 1.5);
    }

    doc.setDrawColor(140, 140, 140);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(L.left, L.sigLineY, L.right, L.sigLineY);
    doc.setLineDashPattern([], 0);

    doc.setFontSize(9.5);
    doc.text("Datum", L.left, L.sigLineY + L.sigLabelGap);
    doc.text("Unterschrift des Auftraggebers", L.unterschriftLabelX, L.sigLineY + L.sigLabelGap);

    // Footer-Badges
    (tpl.badges() || []).forEach((b, i) => {
      doc.addImage(b.src, "PNG", b.x, L.badgeY, b.w, tpl.badgeH, "badge-" + tplKey + "-" + i, "MEDIUM");
    });

    // Blattzaehler nur, wenn es wirklich mehr als ein Blatt gibt
    if (blaetter > 1) {
      doc.setFont(FONT, "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 120);
      doc.text(`Blatt ${blattNr} von ${blaetter}`, L.right, 280, { align: "right" });
      doc.setTextColor(0, 0, 0);
    }
  }

  /* ---------------------------------------------------------------------- */
  // 5. Zeichnen
  seiten.forEach((zeilen, i) => {
    // Erstes Blatt: nur bei Sammel-PDF eine neue Seite anlegen (sonst nutzt es die
    // frische Seite des neuen Dokuments). Jedes Folgeblatt immer.
    if (existingDoc || i > 0) doc.addPage();
    zeichneKopf();
    let cy = startY;
    zeilen.forEach((z) => { z.zeichne(cy); cy += z.h; });
    zeichneFuss(i + 1, seiten.length, i === seiten.length - 1 ? gesamtQm : 0);
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
