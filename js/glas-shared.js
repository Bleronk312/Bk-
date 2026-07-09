// Gemeinsame Hilfsfunktionen für das Glasreinigungs-Modul:
// Geocoding (OpenStreetMap Nominatim, kostenlos, kein API-Key), Fälligkeiten, PDF-Namen.

async function glasGeocodeRaw(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || !data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
}

// Versucht die volle Adresse; findet Nominatim nichts, wird die Anfrage schrittweise
// vereinfacht (z.B. nur Straße+Ort, dann nur PLZ+Ort), damit wenigstens eine ungefähre
// Position als Vorschlag zurückkommt, statt komplett zu scheitern.
async function glasGeocode(address) {
  const full = address.includes("Bochum") || /\d{4,5}/.test(address) ? address : `${address}, Deutschland`;
  const attempts = [full];

  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) attempts.push(parts.slice(-2).join(", ") + ", Deutschland"); // z.B. "44793 Bochum"
  if (parts.length > 1) attempts.push(parts[parts.length - 1] + ", Deutschland"); // nur Ort/PLZ

  let approximate = false;
  for (let i = 0; i < attempts.length; i++) {
    const result = await glasGeocodeRaw(attempts[i]);
    if (result) {
      if (i > 0) approximate = true;
      return { lat: result.lat, lng: result.lng, approximate, suggestion: result.display };
    }
    if (i < attempts.length - 1) await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error("Adresse nicht gefunden: " + address);
}

/* ---------------- Fälligkeits-Berechnung (Planungs-System) ---------------- */

// WICHTIG: alle Datums-Helfer rechnen in LOKALER Zeit (glasIsoFromDate), nie über
// toISOString() - das ist UTC und lag in Deutschland (UTC+1/+2) je nach Uhrzeit
// bzw. bei Mitternachts-Daten IMMER einen Tag daneben.
function glasTodayIso() {
  return glasIsoFromDate(new Date());
}

function glasAddDaysIso(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return glasIsoFromDate(d);
}

function glasAddMonthsIso(iso, months) {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return glasIsoFromDate(d);
}

// Robuste Text-/Nummern-Suche: findet auch Kd.-Nummern, wenn man sie OHNE die
// gespeicherten Leerzeichen/Trennzeichen tippt ("380651100" findet "3806 511 00")
// und umgekehrt. hay = zu durchsuchender Text, q = Eingabe.
function glasSearchMatch(hay, q) {
  hay = String(hay || "").toLowerCase();
  q = String(q || "").trim().toLowerCase();
  if (!q) return true;
  if (hay.includes(q)) return true;
  // Trennzeichen (Leerzeichen, Punkt, Schrägstrich, Bindestrich) ignorieren
  const strip = (s) => s.replace(/[\s.\-\/]/g, "");
  const hs = strip(hay), qs = strip(q);
  return qs.length >= 2 && hs.includes(qs);
}

// Lokales Datum (YYYY-MM-DD) aus einem Zeitstempel (z.B. signed_at, das als UTC-ISO
// gespeichert wird). Wird in Ortszeit umgerechnet - so steht auf dem Schein der Tag,
// an dem wirklich unterschrieben wurde, nicht irgendein Tour-Planungsdatum.
function glasDatumVonTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return isNaN(d.getTime()) ? "" : glasIsoFromDate(d);
}

// Uhrzeit "HH:MM" aus einem Zeitstempel (Ortszeit).
function glasUhrzeitVonTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Datum, das aufs Unterschrift-Feld des Scheins gehört = der Tag der Unterschrift.
// s.datum wird beim Unterschreiben auf den Signier-Tag gesetzt (nicht das Tour-Datum)
// und ist als eingefrorenes lokales Datum am stabilsten; signed_at ist der Fallback.
function glasSignaturDatum(s) {
  return (s && s.datum) || (s && glasDatumVonTimestamp(s.signed_at)) || "";
}

// Positions-Schnappschuss eines Stopps als Array {nr, art, qm} (leere weggefiltert).
function glasStopPositionen(s) {
  let pos = [];
  try { pos = JSON.parse((s && s.positionen) || "[]"); } catch (e) { pos = []; }
  return Array.isArray(pos) ? pos.filter((p) => p && (p.art || p.qm)) : [];
}

// Stunden-Positionen (Pos. 2 und 5 der Preisliste): hier trägt der Mitarbeiter vor Ort
// die tatsächlichen Stunden ein - die Menge ist KEINE Fläche und wird deshalb als "Std."
// angezeigt und nie in qm-Summen gezählt. Bewusst NUR über die Positionsnummer erkannt
// (nicht über den Namen), damit z.B. eine Extra-Position "2 Stunden zusätzlich" nicht
// versehentlich zur Pflicht-Eingabe wird.
function glasIstStundenPos(p) {
  if (!p) return false;
  if (p.einheit === "std") return true; // beim Unterschreiben bereits als Stunden erfasst
  const nr = String(p.nr || "").trim();
  return nr === "2" || nr === "5";
}

// Einheit einer Position für Anzeigen: "Std." bei Stunden-Positionen, sonst "qm".
function glasPosEinheit(p) {
  return glasIstStundenPos(p) ? "Std." : "qm";
}

// Gesamt-qm eines Stopps aus dem Positions-Schnappschuss (deutsche Schreibweise).
// Stunden-Positionen zählen nicht mit - Stunden sind keine Fläche.
function glasStopQm(s) {
  let sum = 0;
  try {
    JSON.parse(s.positionen || "[]").forEach((p) => {
      if (glasIstStundenPos(p)) return;
      sum += parseFloat(String(p.qm || "").replace(",", ".")) || 0;
    });
  } catch (e) {}
  if (!sum) return "";
  return String(Math.round(sum * 100) / 100).replace(".", ",");
}

// Trägt die vor Ort erfassten Stunden in den Positions-Schnappschuss ein. "werte" sind
// die Eingaben in derselben Reihenfolge, in der die Stunden-Positionen im Formular
// stehen. Liefert den aktualisierten JSON-String + ob eine Pflicht-Eingabe fehlt.
function glasMitStundenAktualisiert(positionenJson, werte) {
  let arr;
  try { arr = JSON.parse(positionenJson || "[]"); } catch (e) { return { json: positionenJson, fehlt: false }; }
  if (!Array.isArray(arr)) return { json: positionenJson, fehlt: false };
  let i = 0, fehlt = false;
  arr.forEach((p) => {
    if (!p || !(p.art || p.qm)) return;         // gleiche Filterung wie glasStopPositionen
    if (!glasIstStundenPos(p)) return;
    const v = String(werte[i++] ?? "").trim();
    if (!v) { fehlt = true; return; }
    p.qm = v;
    p.einheit = "std";
  });
  return { json: JSON.stringify(arr), fehlt };
}

function formatGlasDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// Nächstes Datum aus einer festen Monatsliste (z.B. "3,6,9,12").
// Mit letzter Reinigung: nächster Listen-Monat STRIKT NACH dem Monat der letzten Reinigung -
// sonst bliebe eine Position im selben Monat für immer "überfällig", obwohl sie gerade erst
// erledigt und unterschrieben wurde.
// Ohne letzte Reinigung: ab dem Anlage-Monat des Objekts (erstellungIso) - ein NEU
// angelegtes Objekt ist nie rückwirkend überfällig für Monate, die vor seiner Erfassung
// lagen. Beispiel: Objekt heute im Oktober angelegt, Monate Feb+Sep -> nächster Termin
// ist Februar (nicht sofort "überfällig").
function glasNaechsterFesterMonat(feste_monate, letzteReinigungIso, erstellungIso) {
  const monate = String(feste_monate || "")
    .split(",")
    .map((m) => parseInt(m.trim(), 10))
    .filter((m) => m >= 1 && m <= 12)
    .sort((a, b) => a - b);
  if (!monate.length) return null;

  let jahr, minMonat;
  if (letzteReinigungIso) {
    const d = new Date(letzteReinigungIso + "T00:00:00");
    jahr = d.getFullYear();
    minMonat = d.getMonth() + 2; // erst der Monat NACH der letzten Reinigung zählt wieder
  } else {
    // noch nie gereinigt: ab dem Monat, in dem das Objekt angelegt wurde (fällt es weiter
    // zurück, wäre es zwar irgendwann fällig gewesen, aber das Objekt gab es damals noch
    // gar nicht in der App - also kein rückwirkendes "überfällig")
    const start = new Date((erstellungIso || glasTodayIso()) + "T00:00:00");
    jahr = start.getFullYear();
    minMonat = start.getMonth() + 1;
  }

  let monat = monate.find((m) => m >= minMonat);
  if (monat === undefined) { monat = monate[0]; jahr++; }
  return `${jahr}-${String(monat).padStart(2, "0")}-01`;
}

// Berechnet die Fälligkeit einer Position. Rückgabe: ISO-Datum oder null (kein Intervall
// hinterlegt = rein manuell, taucht nirgends in Fällig-Listen auf).
function glasBerechneFaelligkeit(pos) {
  if (pos.faelligkeit_override) return pos.faelligkeit_override;
  if (pos.intervall_typ === "rollierend") {
    const wochen = parseInt(pos.intervall_wochen, 10);
    if (!wochen) return null;
    if (!pos.letzte_reinigung) return glasTodayIso(); // noch nie gereinigt -> sofort fällig
    return glasAddDaysIso(pos.letzte_reinigung, wochen * 7);
  }
  if (pos.intervall_typ === "feste_monate") {
    return glasNaechsterFesterMonat(pos.feste_monate, pos.letzte_reinigung || null, pos.created_at ? String(pos.created_at).slice(0, 10) : null);
  }
  return null;
}

const GLAS_MONATSNAMEN_KURZ = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

// Liefert Fälligkeit + Status ('ueberfaellig' | 'faellig' | 'bald' | 'geplant' | null) + eine
// zur Intervallart passende Anzeige-Beschriftung.
//
// Bei "feste Monate" wird nur auf Monatsebene verglichen, nicht auf den Tag genau (das
// Fälligkeitsdatum ist intern immer der 1. des Monats, das ist aber nur ein Rechenhilfswert,
// keine echte Deadline "am 1."). Im Zielmonat selbst gilt die Position als "faellig", nicht
// "ueberfaellig" - überfällig wird sie erst, sobald der Zielmonat vorbei ist. Einen Monat
// vorher gilt sie als "bald fällig". Bei rollierenden Intervallen bleibt es bei der genauen
// Tagesberechnung, weil da ein konkretes Datum gemeint ist.
function glasFaelligkeitStatus(pos) {
  const faelligkeit = glasBerechneFaelligkeit(pos);
  if (!faelligkeit) return { faelligkeit: null, status: null, tage: null, label: null };

  // Fünf-Zustands-Logik (Monatsgenau bei festen Monaten):
  //   Kommend      = der Monat VOR dem Fälligkeitsmonat            (monatsDiff +1)
  //   Fällig       = Fälligkeitsmonat UND der Folgemonat           (monatsDiff 0 oder -1)
  //   Überfällig   = alles danach                                  (monatsDiff <= -2)
  //   (weiter in der Zukunft = "geplant", noch nicht relevant)     (monatsDiff >= +2)
  if (pos.intervall_typ === "feste_monate" && !pos.faelligkeit_override) {
    const [fJahr, fMonat] = faelligkeit.split("-").map(Number);
    const heute = new Date(glasTodayIso() + "T00:00:00");
    const monatsDiff = (fJahr * 12 + fMonat) - (heute.getFullYear() * 12 + heute.getMonth() + 1);
    const status = monatsDiff <= -2 ? "ueberfaellig"
      : (monatsDiff === 0 || monatsDiff === -1) ? "faellig"
      : monatsDiff === 1 ? "kommend"
      : "geplant";
    const label = `${String(fMonat).padStart(2, "0")}.${String(fJahr).slice(-2)}`;
    return { faelligkeit, status, tage: null, label };
  }

  // Rollierende Intervalle analog auf Tagesbasis (~1 Monat Vorlauf/Nachlauf):
  //   Kommend    = fällig in den nächsten ~31 Tagen
  //   Fällig     = ab Fälligkeitstag bis ~31 Tage danach
  //   Überfällig = mehr als ~31 Tage über der Fälligkeit
  const today = glasTodayIso();
  const tage = Math.round((new Date(faelligkeit) - new Date(today)) / 86400000);
  const status = tage < -31 ? "ueberfaellig"
    : tage <= 0 ? "faellig"
    : tage <= 31 ? "kommend"
    : "geplant";
  return { faelligkeit, status, tage, label: formatGlasDate(faelligkeit) };
}

function glasStatusLabel(status) {
  return status === "ueberfaellig" ? "Überfällig"
    : status === "faellig" ? "Fällig"
    : status === "kommend" ? "Kommend"
    : "Geplant";
}

function glasIntervallLabel(pos) {
  if (pos.intervall_typ === "rollierend") return `alle ${pos.intervall_wochen || "?"} Wochen`;
  if (pos.intervall_typ === "feste_monate") {
    return String(pos.feste_monate || "")
      .split(",")
      .map((m) => GLAS_MONATSNAMEN_KURZ[parseInt(m.trim(), 10) - 1])
      .filter(Boolean)
      .join(", ");
  }
  return "Kein Intervall";
}

// Eingabezeilen für Stunden-Positionen (Pos. 2/5) im Unterschrift-Formular: vor Ort MUSS
// eingetragen werden, wie viele Stunden gemacht wurden - der Wert steht dann auf dem
// Schein. Von Mitarbeiter- UND Admin-Seite genutzt (cssKlasse: "gs-std" / "as-std").
function renderGlasStundenInputs(s, cssKlasse) {
  const stdPos = glasStopPositionen(s).filter(glasIstStundenPos);
  if (!stdPos.length) return "";
  return `
    <div class="field">
      <label class="muted">⏱️ Gemachte Stunden (Pflicht)</label>
      ${stdPos.map((p, i) => `
        <div style="display:flex; align-items:center; gap:10px; margin-top:6px;">
          <span style="flex:1; min-width:0; font-size:13.5px;">${p.nr ? `Pos. ${escapeHtml(p.nr)} – ` : ""}${escapeHtml(p.art || "Stunden")}</span>
          <input type="text" inputmode="decimal" class="${cssKlasse}" id="${cssKlasse}_${i}" value="${escapeHtml(String(p.qm || ""))}" placeholder="Std." style="flex:0 0 90px; font-size:16px; text-align:center;" />
        </div>`).join("")}
      <p class="muted" style="margin:6px 0 0; font-size:12px;">z.B. "3" oder "2,5" – steht mit auf dem Abnahmeschein.</p>
    </div>`;
}

/* ---------------- Unterschreiben (von Mitarbeiter- UND Admin-Seite genutzt) ---------------- */

// Markiert einen Stopp als unterschrieben und setzt "zuletzt gereinigt" nur für die
// Positionen zurück, die tatsächlich auf diesem Schein enthalten waren (nicht automatisch
// für alle Positionen des Objekts) - inkl. Zurücksetzen einer evtl. manuellen Verschiebung.
async function glasSignStop(stopId, positionenJson, name, datum, unterschrift, zusatz, signedAt) {
  const payload = { name, datum, unterschrift, status: "erledigt", signed_at: signedAt || new Date().toISOString(), zusatz: (zusatz || "").trim() };
  // Der Positions-Schnappschuss wird mitgespeichert, damit vor Ort erfasste Werte
  // (z.B. Stunden bei Pos. 2/5) fest auf dem Schein landen.
  if (typeof positionenJson === "string" && positionenJson) payload.positionen = positionenJson;
  let { error } = await sb.from("glas_stopps").update(payload).eq("id", stopId);
  if (error && /zusatz/.test(error.message || "")) {
    // Spalte existiert noch nicht (SQL-Datei nicht ausgeführt) - ohne Zusatz speichern
    delete payload.zusatz;
    ({ error } = await sb.from("glas_stopps").update(payload).eq("id", stopId));
  }
  if (error) return { error };

  try {
    const positionen = JSON.parse(positionenJson || "[]");
    const ids = positionen.map((p) => p.id).filter(Boolean);
    if (ids.length) {
      await sb.from("glas_objekt_positionen").update({ letzte_reinigung: datum, faelligkeit_override: null }).in("id", ids);
    }
  } catch (e) { /* kein/ungültiges JSON - Objekt ohne Intervall-Tracking, kein Problem */ }

  return { error: null, payload };
}

/* ---------------- Wochen-Layout für die TimeTree-artige Kalenderansicht ---------------- */

function glasIsoFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Liefert ein Array von Wochen (je 7 ISO-Datumsstrings, Montag-Sonntag), die den Bereich
// von "vonMonat" bis "bisMonat" (inklusive, {year, month} mit month 0-11) komplett abdecken,
// aufgerundet auf volle Wochen.
function glasWeeksInRange(vonMonat, bisMonat) {
  const start = new Date(vonMonat.year, vonMonat.month, 1);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // zurück auf den Montag
  const endMonat = new Date(bisMonat.year, bisMonat.month + 1, 0); // letzter Tag des Bis-Monats
  const weeks = [];
  let cur = new Date(start);
  while (cur <= endMonat) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(glasIsoFromDate(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(days);
  }
  return weeks;
}

