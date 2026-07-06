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

// Positions-Schnappschuss eines Stopps als Array {nr, art, qm} (leere weggefiltert).
function glasStopPositionen(s) {
  let pos = [];
  try { pos = JSON.parse((s && s.positionen) || "[]"); } catch (e) { pos = []; }
  return Array.isArray(pos) ? pos.filter((p) => p && (p.art || p.qm)) : [];
}

// Gesamt-qm eines Stopps aus dem Positions-Schnappschuss (deutsche Schreibweise).
function glasStopQm(s) {
  let sum = 0;
  try {
    JSON.parse(s.positionen || "[]").forEach((p) => {
      sum += parseFloat(String(p.qm || "").replace(",", ".")) || 0;
    });
  } catch (e) {}
  if (!sum) return "";
  return String(Math.round(sum * 100) / 100).replace(".", ",");
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

  if (pos.intervall_typ === "feste_monate" && !pos.faelligkeit_override) {
    const [fJahr, fMonat] = faelligkeit.split("-").map(Number);
    const heute = new Date(glasTodayIso() + "T00:00:00");
    const monatsDiff = (fJahr * 12 + fMonat) - (heute.getFullYear() * 12 + heute.getMonth() + 1);
    const status = monatsDiff < 0 ? "ueberfaellig" : monatsDiff === 0 ? "faellig" : monatsDiff === 1 ? "bald" : "geplant";
    const label = `${String(fMonat).padStart(2, "0")}.${String(fJahr).slice(-2)}`;
    return { faelligkeit, status, tage: null, label };
  }

  const today = glasTodayIso();
  const tage = Math.round((new Date(faelligkeit) - new Date(today)) / 86400000);
  const status = tage < 0 ? "ueberfaellig" : tage <= 14 ? "bald" : "geplant";
  return { faelligkeit, status, tage, label: formatGlasDate(faelligkeit) };
}

function glasStatusLabel(status) {
  return status === "ueberfaellig" ? "Überfällig"
    : status === "faellig" ? "Fällig"
    : status === "bald" ? "Bald fällig"
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

/* ---------------- Unterschreiben (von Mitarbeiter- UND Admin-Seite genutzt) ---------------- */

// Markiert einen Stopp als unterschrieben und setzt "zuletzt gereinigt" nur für die
// Positionen zurück, die tatsächlich auf diesem Schein enthalten waren (nicht automatisch
// für alle Positionen des Objekts) - inkl. Zurücksetzen einer evtl. manuellen Verschiebung.
async function glasSignStop(stopId, positionenJson, name, datum, unterschrift, zusatz, signedAt) {
  const payload = { name, datum, unterschrift, status: "erledigt", signed_at: signedAt || new Date().toISOString(), zusatz: (zusatz || "").trim() };
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

