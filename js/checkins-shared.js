// ============================================================================
// GEKO Check-ins – gemeinsame Logik (Admin + Mitarbeiter)
// Reine Rechen-Helfer: Entfernung, Zeitfenster, Status eines Punkts/Rundgangs.
// Absichtlich ohne DOM/Netz, damit beide Apps EXAKT gleich rechnen und leicht
// testbar sind.
// ============================================================================

// ---- Wochentage: 1 = Montag … 7 = Sonntag (isoDay) --------------------------
const CI_TAGE_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const CI_TAGE_LANG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

// isoDay eines lokalen Datums (1=Mo … 7=So). getDay(): 0=So … 6=Sa.
function ciIsoDay(date) {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

// Ab DIESEM Datum wird ausgewertet. Alles davor gilt als "nicht erfasst" (grau) und
// zählt nirgends als verpasst – so startet die App sauber am Go-Live-Tag. Zum
// Verschieben einfach nur dieses eine Datum ändern (Format YYYY-MM-DD).
const CI_START = "2026-07-24";
function ciZaehltAb(iso) { return String(iso || "") >= CI_START; }

// Lokales Datum "YYYY-MM-DD" (nie toISOString – das wäre UTC und nachts daneben).
function ciTodayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function ciIsoFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "HH:MM" -> Minuten seit Mitternacht (oder null, wenn ungültig/leer).
// "24:00" ist als Tagesende (Mitternacht) erlaubt -> 1440.
function ciTimeToMin(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
  if (h === 24 && mi === 0) return 1440;
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

// Minuten seit Mitternacht -> "HH:MM".
function ciMinToTime(min) {
  min = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

// Aktuelle Uhrzeit als Minuten seit Mitternacht (lokal).
function ciNowMin(date) {
  const d = date || new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// Entfernung zweier Koordinaten in Metern (Haversine).
function ciDistanzMeter(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Tage-String "1,3,5" -> Array [1,3,5] (nur gültige 1..7, sortiert, ohne Dubletten).
function ciParseTage(tage) {
  const set = new Set(
    String(tage || "")
      .split(",")
      .map((t) => parseInt(t.trim(), 10))
      .filter((t) => t >= 1 && t <= 7)
  );
  return [...set].sort((a, b) => a - b);
}

// Zugewiesene Mitarbeiter eines Rundgangs (Array von IDs). Leeres Array = "alle dürfen".
// Fällt auf das alte Einzelfeld mitarbeiter_id zurück, solange noch nicht umgestellt.
function ciRundgangMitarbeiter(rg) {
  const a = ciJson(rg && rg.mitarbeiter_ids, null);
  if (Array.isArray(a) && a.length) return a;
  if (rg && rg.mitarbeiter_id) return [rg.mitarbeiter_id];
  return [];
}

// Punkte eines Rundgangs als Array (jsonb kann String ODER Array sein).
function ciRundgangPunkte(rg) {
  if (!rg) return [];
  let p = rg.punkte;
  if (typeof p === "string") { try { p = JSON.parse(p || "[]"); } catch (e) { p = []; } }
  return Array.isArray(p) ? p : [];
}

// Effektives Zeitfenster + Toleranz eines Punkts INNERHALB eines Rundgangs.
// Reihenfolge: Punkt-im-Rundgang-Override -> Standard des Rundgangs -> Standard des Punkts.
// Rückgabe { von, bis, tol } in Minuten (von/bis können null sein = kein Fenster).
function ciEffFenster(rg, eintrag, punkt) {
  const von = ciTimeToMin(eintrag && eintrag.fenster_von) ??
    ciTimeToMin(rg && rg.fenster_von) ??
    ciTimeToMin(punkt && punkt.fenster_von);
  const bis = ciTimeToMin(eintrag && eintrag.fenster_bis) ??
    ciTimeToMin(rg && rg.fenster_bis) ??
    ciTimeToMin(punkt && punkt.fenster_bis);
  let tol = eintrag && eintrag.toleranz_min;
  if (tol == null || tol === "") tol = (rg && rg.toleranz_min);
  if (tol == null || tol === "") tol = (punkt && punkt.toleranz_min);
  tol = parseInt(tol, 10);
  if (isNaN(tol)) tol = 0;
  return { von, bis, tol };
}

// Punkte eines Rundgangs nach effektiver Fenster-Startzeit sortiert (früh -> spät).
// Punkte ohne Zeitfenster ("jederzeit") kommen ans Ende. punkteMap: {id: punkt}.
function ciSortEintraege(rg, eintraege, punkteMap) {
  return (eintraege || []).slice().sort((a, b) => {
    const fa = ciEffFenster(rg, a, punkteMap[a.punkt_id]).von;
    const fb = ciEffFenster(rg, b, punkteMap[b.punkt_id]).von;
    const va = fa == null ? 100000 : fa;
    const vb = fb == null ? 100000 : fb;
    return va - vb;
  });
}

// Läuft der Rundgang an diesem Datum? (Wochentag in tage enthalten)
function ciRundgangLaeuftAn(rg, iso) {
  const d = new Date(iso + "T00:00:00");
  return ciParseTage(rg && rg.tage).includes(ciIsoDay(d));
}

// Status eines Punkts HEUTE für einen bestimmten Zeitpunkt.
//   "done"  – es liegt ein Check-in für heute vor
//   "now"   – Zeitfenster (inkl. Toleranz) läuft gerade -> fällig
//   "later" – Fenster noch nicht offen
//   "miss"  – Fenster (inkl. Toleranz) vorbei, kein Check-in
//   "open"  – kein Zeitfenster hinterlegt (jederzeit möglich), noch nicht erledigt
// nowMin = aktuelle Minute; hatCheckin = bool.
function ciPunktStatus(fenster, nowMin, hatCheckin) {
  if (hatCheckin) return "done";
  const { von, bis, tol } = fenster;
  if (von == null && bis == null) return "open";
  const start = (von == null ? 0 : von) - tol;
  const ende = (bis == null ? 1439 : bis) + tol;
  if (nowMin < start) return "later";
  if (nowMin > ende) return "miss";
  return "now";
}

// Ergebnis-Status eines Punkts für einen VERGANGENEN Tag (Auswertung):
// "ok" wenn Check-in vorhanden, sonst "miss".
function ciPunktErgebnis(hatCheckin) {
  return hatCheckin ? "ok" : "miss";
}

// Rundgang-Tagesstatus aus den Einzel-Ergebnissen.
//   gesamt = Anzahl Punkte, erledigt = Anzahl mit Check-in
//   "ok"   – alle erledigt
//   "part" – teils erledigt
//   "miss" – keiner erledigt
function ciRundgangErgebnis(erledigt, gesamt) {
  if (gesamt <= 0) return "off";
  if (erledigt >= gesamt) return "ok";
  if (erledigt <= 0) return "miss";
  return "part";
}

// Menschliches Zeitfenster-Label, z.B. "08:00–08:30 ±15" oder "jederzeit".
function ciFensterLabel(fenster) {
  const { von, bis, tol } = fenster;
  if (von == null && bis == null) return "jederzeit";
  const v = von == null ? "" : ciMinToTime(von);
  const b = bis == null ? "" : ciMinToTime(bis);
  const range = v && b ? `${v}–${b}` : (v ? `ab ${v}` : `bis ${b}`);
  return tol > 0 ? `${range} ±${tol}` : range;
}

// Uhrzeit "HH:MM" aus einem Zeitstempel (lokal).
function ciUhrzeit(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Für Tabellen/CSV: sauberes Datum "DD.MM.YYYY".
function ciFormatDatum(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/* ---------------- Arbeitszeit (Ein-/Auschecken an einem Objekt) ---------------- */

// jsonb kann String ODER Objekt/Array sein – robust parsen.
function ciJson(val, fallback) {
  if (val == null) return fallback;
  if (typeof val === "string") { try { return JSON.parse(val || "null") ?? fallback; } catch (e) { return fallback; } }
  return val;
}

// Zugewiesene Mitarbeiter-IDs eines Arbeitsorts.
function ciOrtMitarbeiter(ort) {
  const a = ciJson(ort && ort.mitarbeiter_ids, []);
  return Array.isArray(a) ? a : [];
}

// Geplantes Fenster eines Arbeitsorts an einem Datum -> {von, bis} in Minuten oder null.
// Endet die Schicht am Folgetag (Endzeit <= Startzeit, z.B. 07:00–05:15), wird bis um
// 1440 Minuten erhöht, sodass bis IMMER > von ist (durchgehende Zeitachse ab Starttag).
function ciOrtFensterAn(ort, iso) {
  const z = ciJson(ort && ort.zeiten, {});
  const d = new Date(iso + "T00:00:00");
  const key = String(ciIsoDay(d));
  const tag = z && z[key];
  if (!tag) return null;
  let von = ciTimeToMin(tag.von), bis = ciTimeToMin(tag.bis);
  if (von == null || bis == null) return null;
  if (bis <= von) bis += 1440; // über Mitternacht -> Ende am nächsten Tag
  return { von, bis };
}

// Endzeit lesbar: "24:00" für Mitternacht, "05:15 +1" für Folgetag.
function ciFmtBis(bisMin) {
  if (bisMin === 1440) return "24:00";
  if (bisMin > 1440) return ciMinToTime(bisMin) + " +1";
  return ciMinToTime(bisMin);
}

// Läuft an diesem Tag eine Schicht? (Zeiten hinterlegt)
function ciOrtLaeuftAn(ort, iso) { return !!ciOrtFensterAn(ort, iso); }

// Gezählte Dauer in Minuten – immer gecappt auf das geplante Fenster [von,bis].
// Nichts vor Start oder nach Ende zählt. Rechnet in ABSOLUTER Zeit (ab Mitternacht des
// Einchecktags), damit Schichten über Mitternacht korrekt zählen (bis kann > 1440 sein).
function ciSchichtDauerMin(einTs, ausTs, fenster) {
  if (!einTs || !ausTs || !fenster) return 0;
  const ein = new Date(einTs), aus = new Date(ausTs);
  const mitternacht = new Date(ein.getFullYear(), ein.getMonth(), ein.getDate()).getTime();
  const winStart = mitternacht + fenster.von * 60000;
  const winEnd = mitternacht + fenster.bis * 60000;
  const einC = Math.max(ein.getTime(), winStart);
  const ausC = Math.min(aus.getTime(), winEnd);
  return Math.max(0, Math.round((ausC - einC) / 60000));
}

// Geplantes Ende einer Schicht als absoluter Zeitstempel (ms) – für Countdown & Auto-Schließen.
function ciSchichtEndeMs(datum, fenster) {
  const mitternacht = new Date(datum + "T00:00:00").getTime();
  return mitternacht + (fenster ? fenster.bis : 1439) * 60000;
}

// Dauer schön formatiert: "8h 03m" bzw. "0h 45m".
function ciFmtDauer(min) {
  min = Math.max(0, Math.round(min || 0));
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

// Status eines Arbeitsorts HEUTE für den Mitarbeiter.
//   "vor"    – noch vor dem erlaubten Einchecken-Fenster (Knopf gesperrt)
//   "ein"    – Einchecken jetzt möglich
//   "laeuft" – bereits eingecheckt (offene Schicht)
//   "vorbei" – Fenster (inkl. Puffer) vorbei, nie eingecheckt = verpasst
//   "fertig" – heute schon ein- UND ausgecheckt
// nowMin=aktuelle Minute, puffer=Minuten, offen=bool (offene Schicht), fertig=bool.
function ciOrtStatus(fenster, nowMin, puffer, offen, fertig) {
  if (offen) return "laeuft";
  if (fertig) return "fertig";
  if (!fenster) return "vorbei";
  if (nowMin < fenster.von - puffer) return "vor";
  if (nowMin > fenster.bis + puffer) return "vorbei";
  return "ein";
}
