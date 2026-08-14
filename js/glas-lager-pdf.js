// Einsatzplan Lager als PDF - im gleichen modernen GEKO-Layout wie der
// Wächterkontroll-Bericht (blaues Kopfband, Logo-Karte, Kennzahlen, Tabelle).
//
// Zwei Varianten über werId:
//   null            -> der komplette Monatsplan (alle Mitarbeiter)
//   Mitarbeiter-ID  -> ein Mitarbeiter, Tag für Tag: Einsatz / Urlaub / frei
//
// Die Datenaufbereitung ist bewusst eine eigene Funktion (glasLagerPdfDaten),
// damit sie ohne PDF-Bibliothek testbar bleibt.

const GLAS_LAGER_MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function glasLagerPdfIds(p) {
  try { return Array.isArray(p.mitarbeiter_ids) ? p.mitarbeiter_ids : JSON.parse(p.mitarbeiter_ids || "[]"); }
  catch (e) { return []; }
}

// Hat der Mitarbeiter an dem Tag GENEHMIGTEN Urlaub? (offene/abgelehnte zählen nicht)
function glasLagerPdfUrlaub(maId, iso) {
  return (typeof glasUrlaub !== "undefined" ? glasUrlaub : []).some((u) =>
    u.mitarbeiter_id === maId
    && (!u.status || u.status === "genehmigt")
    && u.von && u.von <= iso && iso <= (u.bis || u.von));
}

function glasLagerPdfDaten(monat, werId) {
  const von = `${monat.year}-${String(monat.month + 1).padStart(2, "0")}-01`;
  const bis = `${monat.year}-${String(monat.month + 1).padStart(2, "0")}-31`;
  const plan = (typeof glasLagerPlan !== "undefined" ? glasLagerPlan : [])
    .filter((p) => p.datum >= von && p.datum <= bis)
    .sort((a, b) => (a.datum === b.datum ? (a.uhrzeit || "").localeCompare(b.uhrzeit || "") : a.datum.localeCompare(b.datum)));
  const letzter = new Date(monat.year, monat.month + 1, 0).getDate();
  const wtNamen = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

  if (werId) {
    // ---- Ein Mitarbeiter: JEDER Tag des Monats bekommt eine Zeile ----
    const tage = [];
    let einsaetze = 0, urlaubstage = 0;
    for (let t = 1; t <= letzter; t++) {
      const iso = `${monat.year}-${String(monat.month + 1).padStart(2, "0")}-${String(t).padStart(2, "0")}`;
      const d = new Date(monat.year, monat.month, t);
      const meine = plan.filter((p) => p.datum === iso && glasLagerPdfIds(p).includes(werId));
      const urlaub = glasLagerPdfUrlaub(werId, iso);
      if (meine.length) einsaetze += meine.length;
      else if (urlaub) urlaubstage++;
      tage.push({
        iso, tag: t,
        label: `${wtNamen[d.getDay()]}  ${String(t).padStart(2, "0")}.${String(monat.month + 1).padStart(2, "0")}.`,
        wochenende: d.getDay() === 0 || d.getDay() === 6,
        einsaetze: meine.map((p) => ({ uhrzeit: p.uhrzeit || "?", notiz: p.notiz || "" })),
        urlaub,
      });
    }
    return { modus: "einer", tage, einsaetze, urlaubstage, frei: letzter - tage.filter((x) => x.einsaetze.length || x.urlaub).length };
  }

  // ---- Alle: nur Tage MIT Einteilungen, gruppiert ----
  const proTag = new Map();
  plan.forEach((p) => {
    if (!proTag.has(p.datum)) proTag.set(p.datum, []);
    proTag.get(p.datum).push(p);
  });
  const tage = [...proTag.keys()].sort().map((iso) => {
    const d = new Date(iso + "T12:00:00");
    return {
      iso,
      label: `${wtNamen[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`,
      zeilen: proTag.get(iso).map((p) => ({
        uhrzeit: p.uhrzeit || "?",
        namen: glasLagerPdfIds(p).map((id) => (typeof glasMaName === "function" ? glasMaName(id) : id)).filter(Boolean),
        notiz: p.notiz || "",
      })),
    };
  });
  // Einsätze je Mitarbeiter (für die Zusammenfassung)
  const zaehler = new Map();
  plan.forEach((p) => glasLagerPdfIds(p).forEach((id) => zaehler.set(id, (zaehler.get(id) || 0) + 1)));
  const proMa = [...zaehler.entries()]
    .map(([id, anzahl]) => ({ id, name: (typeof glasMaName === "function" ? glasMaName(id) : id) || id, anzahl }))
    .sort((a, b) => b.anzahl - a.anzahl || a.name.localeCompare(b.name));
  return { modus: "alle", tage, einteilungen: plan.length, einsatztage: tage.length, proMa };
}

function glasLagerPdfErstellen(monat, werId) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 46;
  const CW = W - M * 2;
  const FONT = (typeof glasRegisterPdfFont === "function" && glasRegisterPdfFont(doc)) ? "LibSans" : "helvetica";
  const monatLabel = `${GLAS_LAGER_MONATE[monat.month]} ${monat.year}`;
  const maName = werId && typeof glasMaName === "function" ? (glasMaName(werId) || "Mitarbeiter") : "";
  const daten = glasLagerPdfDaten(monat, werId);

  const BLAU = [31, 93, 146], TIEF = [18, 48, 76], VIOLETT = [93, 66, 200], GRUEN = [31, 122, 77],
        GRAU = [112, 120, 130], DUNKEL = [28, 36, 46], ZEBRA = [247, 249, 252],
        WE = [240, 243, 248], LINIE = [225, 231, 238];
  const fc = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const tc = (c) => doc.setTextColor(c[0], c[1], c[2]);

  /* ---- Kopfband ---- */
  fc(BLAU); doc.rect(0, 0, W, 118, "F");
  fc(TIEF); doc.rect(0, 118, W, 5, "F");
  doc.setFont(FONT, "bold"); doc.setFontSize(9); tc([167, 197, 224]);
  doc.text("GEKO CLEAN   –   EINSATZPLAN LAGER", M, 40);
  doc.setFontSize(23); tc([255, 255, 255]);
  doc.text(werId ? maName : "Einsatzplan Lager", M, 70);
  doc.setFont(FONT, "normal"); doc.setFontSize(11); tc([214, 228, 242]);
  doc.text(werId ? `Einsatzplan Lager – ${monatLabel}` : `Alle Mitarbeiter – ${monatLabel}`, M, 92);
  if (typeof GEKO_LOGO_TRANSPARENT_B64 !== "undefined") {
    fc([255, 255, 255]); doc.roundedRect(W - M - 58, 20, 58, 78, 9, 9, "F");
    doc.addImage(GEKO_LOGO_TRANSPARENT_B64, "PNG", W - M - 58 + 11, 29, 36, 58, "geko-lager-logo", "MEDIUM");
  }

  /* ---- Kennzahlen ---- */
  const boxW = (CW - 24) / 3;
  const boxen = werId
    ? [[`${daten.einsaetze}`, daten.einsaetze === 1 ? "LAGER-EINSATZ" : "LAGER-EINSÄTZE"],
       [`${daten.urlaubstage}`, daten.urlaubstage === 1 ? "URLAUBSTAG" : "URLAUBSTAGE"],
       [`${daten.frei}`, "TAGE OHNE EINSATZ"]]
    : [[`${daten.einteilungen}`, daten.einteilungen === 1 ? "EINTEILUNG" : "EINTEILUNGEN"],
       [`${daten.einsatztage}`, daten.einsatztage === 1 ? "EINSATZTAG" : "EINSATZTAGE"],
       [`${daten.proMa.length}`, daten.proMa.length === 1 ? "PERSON" : "PERSONEN"]];
  boxen.forEach((b, i) => {
    const bx = M + i * (boxW + 12);
    fc([241, 245, 249]); doc.roundedRect(bx, 146, boxW, 54, 8, 8, "F");
    doc.setFont(FONT, "bold"); doc.setFontSize(17); tc(BLAU);
    doc.text(b[0], bx + 14, 172);
    doc.setFontSize(7.5); tc(GRAU);
    doc.text(b[1], bx + 14, 188);
  });

  /* ---- Folgeseiten & Fußzeile ---- */
  let yy = 232;
  const kopfzeile = () => {
    doc.setFont(FONT, "bold"); doc.setFontSize(9); tc(BLAU);
    doc.text("Einsatzplan Lager", M, 32);
    doc.setFont(FONT, "normal"); tc(GRAU);
    doc.text(`GEKO Clean – ${werId ? maName + " – " : ""}${monatLabel}`, W - M, 32, { align: "right" });
    doc.setDrawColor(LINIE[0], LINIE[1], LINIE[2]); doc.setLineWidth(1);
    doc.line(M, 42, W - M, 42);
  };
  const neueSeite = () => { doc.addPage(); yy = 66; kopfzeile(); };
  const brauche = (h) => { if (yy + h > H - 58) neueSeite(); };

  if (werId) {
    /* ================= EIN MITARBEITER: Tag für Tag ================= */
    const cDatum = M + 10, cEinsatz = M + 128, cNotiz = M + 250;
    brauche(40);
    fc([236, 241, 247]); doc.roundedRect(M, yy, CW, 20, 4, 4, "F");
    doc.setFont(FONT, "bold"); doc.setFontSize(7.5); tc(GRAU);
    doc.text("DATUM", cDatum, yy + 13);
    doc.text("EINSATZ", cEinsatz, yy + 13);
    doc.text("NOTIZ", cNotiz, yy + 13);
    yy += 24;

    daten.tage.forEach((t, i) => {
      const zeilenH = Math.max(t.einsaetze.length, 1) * 15 + 5;
      brauche(zeilenH);
      if (t.wochenende) { fc(WE); doc.rect(M, yy - 10, CW, zeilenH, "F"); }
      else if (i % 2 === 1) { fc(ZEBRA); doc.rect(M, yy - 10, CW, zeilenH, "F"); }
      doc.setFont(FONT, t.einsaetze.length ? "bold" : "normal"); doc.setFontSize(9);
      tc(t.wochenende && !t.einsaetze.length ? GRAU : DUNKEL);
      doc.text(t.label, cDatum, yy + 2);
      if (t.einsaetze.length) {
        t.einsaetze.forEach((e, k) => {
          doc.setFont(FONT, "bold"); tc(VIOLETT);
          doc.text(`${e.uhrzeit} Uhr – Lager`, cEinsatz, yy + 2 + k * 15);
          if (e.notiz) {
            doc.setFont(FONT, "normal"); doc.setFontSize(8.5); tc(GRAU);
            doc.text(doc.splitTextToSize(e.notiz, W - M - cNotiz - 6)[0] || "", cNotiz, yy + 2 + k * 15);
            doc.setFontSize(9);
          }
        });
      } else if (t.urlaub) {
        doc.setFont(FONT, "bold"); tc(GRUEN);
        doc.text("Urlaub", cEinsatz, yy + 2);
      } else {
        doc.setFont(FONT, "normal"); tc([175, 182, 192]);
        doc.text("–", cEinsatz, yy + 2);
      }
      yy += zeilenH;
    });
  } else {
    /* ================= ALLE: Monatsplan ================= */
    if (!daten.tage.length) {
      doc.setFont(FONT, "normal"); doc.setFontSize(11); tc(GRAU);
      doc.text(`Im ${monatLabel} wurde niemand eingeteilt.`, M, yy + 10);
    }
    const cZeit = M + 10, cWer = M + 92, cNotiz = M + 330;
    daten.tage.forEach((t) => {
      brauche(58 + t.zeilen.length * 17);
      doc.setFont(FONT, "bold"); doc.setFontSize(12); tc(DUNKEL);
      doc.text(t.label, M, yy + 4);
      yy += 14;
      fc([236, 241, 247]); doc.roundedRect(M, yy, CW, 18, 4, 4, "F");
      doc.setFont(FONT, "bold"); doc.setFontSize(7.5); tc(GRAU);
      doc.text("UHRZEIT", cZeit, yy + 12);
      doc.text("MITARBEITER", cWer, yy + 12);
      doc.text("NOTIZ", cNotiz, yy + 12);
      yy += 22;
      t.zeilen.forEach((z, i) => {
        brauche(20);
        if (i % 2 === 1) { fc(ZEBRA); doc.rect(M, yy - 9, CW, 17, "F"); }
        doc.setFont(FONT, "bold"); doc.setFontSize(9.5); tc(VIOLETT);
        doc.text(`${z.uhrzeit} Uhr`, cZeit, yy + 3);
        doc.setFont(FONT, "normal"); tc(DUNKEL);
        doc.text(doc.splitTextToSize(z.namen.join(", ") || "–", cNotiz - cWer - 10)[0] || "–", cWer, yy + 3);
        if (z.notiz) {
          doc.setFontSize(8.5); tc(GRAU);
          doc.text(doc.splitTextToSize(z.notiz, W - M - cNotiz - 6)[0] || "", cNotiz, yy + 3);
        }
        yy += 17;
      });
      yy += 16;
    });

    /* ---- Zusammenfassung je Mitarbeiter ---- */
    if (daten.proMa.length) {
      brauche(60 + daten.proMa.length * 17);
      doc.setFont(FONT, "bold"); doc.setFontSize(12); tc(DUNKEL);
      doc.text("Einsätze je Mitarbeiter", M, yy + 6);
      yy += 20;
      daten.proMa.forEach((z, i) => {
        brauche(20);
        if (i % 2 === 0) { fc(ZEBRA); doc.rect(M, yy - 9, CW, 17, "F"); }
        doc.setFont(FONT, "normal"); doc.setFontSize(9.5); tc(DUNKEL);
        doc.text(z.name, M + 10, yy + 3);
        doc.setFont(FONT, "bold"); tc(BLAU);
        doc.text(`${z.anzahl} ${z.anzahl === 1 ? "Einsatz" : "Einsätze"}`, W - M - 10, yy + 3, { align: "right" });
        yy += 17;
      });
    }
  }

  /* ---- Fußzeilen auf allen Seiten ---- */
  const seiten = doc.getNumberOfPages();
  for (let i = 1; i <= seiten; i++) {
    doc.setPage(i);
    doc.setFont(FONT, "normal"); doc.setFontSize(7.5); tc(GRAU);
    doc.text(`GEKO Clean · Einsatzplan Lager · erstellt am ${new Date().toLocaleDateString("de-DE")}`, M, H - 30);
    doc.text(`Seite ${i} von ${seiten}`, W - M, H - 30, { align: "right" });
  }

  const slug = (t) => String(t).toLowerCase().replace(/[äöüß]/g, (c) => ({ "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss" }[c])).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  doc.save(`einsatzplan_lager_${werId ? slug(maName) + "_" : ""}${slug(GLAS_LAGER_MONATE[monat.month])}_${monat.year}.pdf`);
}
