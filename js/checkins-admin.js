// ============================================================================
// GEKO Check-ins – Admin-App
// Fünf Reiter: Start (Dashboard), Heute (Tagesansicht), Monat (Matrix + PDF/Excel),
// Rundgänge (anlegen, MA zuordnen, Zeitfenster/Toleranz je Punkt), Punkte (Karte pinnen).
// ============================================================================

let ciaTab = "start";
let ciaData = { punkte: [], rundgaenge: [], mitarbeiter: [], todayLogs: [], orte: [], schichten: [] };
let ciaMonth = null;         // {year, month(0-11)} für die Matrix
let ciaMonthLogs = [];       // Logs des angezeigten Matrix-Monats
let ciaMonthSchichten = [];  // Schichten des angezeigten Monats (Stunden)
let ciaRgForm = null;        // Rundgang-Bearbeitung (Objekt) oder null
let ciaPtForm = null;        // Punkt-Bearbeitung (Objekt) oder null
let ciaOrtForm = null;       // Arbeitsort-Bearbeitung (Objekt) oder null
let ciaPin = null;           // {lat, lng} des aktuell gesetzten Punkt-Pins
let ciaMap = null, ciaMarker = null, ciaCircle = null; // Leaflet
let ciaSelDay = null;        // im Matrix-Detail ausgewählter Tag

const CI_MONATE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

document.addEventListener("DOMContentLoaded", ciaInit);

async function ciaInit() {
  const d = new Date();
  ciaMonth = { year: d.getFullYear(), month: d.getMonth() };
  ciaSetHeaderDate();
  await ciaLoadBase();
  await ciaLoadMonthLogs();
  ciaRender();
}

function ciaSetHeaderDate() {
  const el = document.getElementById("ci_date");
  if (!el) return;
  const d = new Date();
  el.textContent = `${CI_TAGE_LANG[ciIsoDay(d) - 1]}, ${d.getDate()}. ${CI_MONATE[d.getMonth()]} ${d.getFullYear()}`;
}

/* ---------------- Daten laden ---------------- */
async function ciaLoadBase() {
  try {
    const heute = ciTodayIso();
    const [ptRes, rgRes, maRes, logRes, orteRes, schichtRes] = await Promise.all([
      sb.from("checkin_punkte").select("*").order("created_at", { ascending: true }),
      sb.from("checkin_rundgaenge").select("*").order("created_at", { ascending: true }),
      sb.from("glas_mitarbeiter").select("id, name, username, login_aktiv").order("name", { ascending: true }),
      sb.from("checkin_logs").select("*").eq("datum", heute),
      sb.from("checkin_orte").select("*").order("created_at", { ascending: true }),
      sb.from("checkin_schichten").select("*").gte("datum", ciAddDaysA(heute, -10)),
    ]);
    ciaData.punkte = ptRes.data || [];
    ciaData.rundgaenge = rgRes.data || [];
    ciaData.mitarbeiter = (maRes.data || []).filter((m) => m.username); // nur Konten mit Login
    ciaData.todayLogs = logRes.data || [];
    ciaData.orte = orteRes.data || [];                 // Arbeitsorte (kann leer sein)
    ciaData.schichten = schichtRes.data || [];         // letzte Schichten inkl. offener
    if (ptRes.error && /checkin_punkte/i.test(ptRes.error.message || "")) ciaData._sqlFehlt = true;
    await ciaAutoCloseOldShifts();
  } catch (e) { ciaData._sqlFehlt = true; }
}

function ciAddDaysA(iso, days) { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days); return ciIsoFromDate(d); }

// Offene Schichten aus VERGANGENEN Tagen automatisch auf das geplante Ende schließen und
// als "auto_beendet" markieren (Auschecken vergessen). Läuft, wenn der Admin die Seite öffnet.
async function ciaAutoCloseOldShifts() {
  const heute = ciTodayIso();
  const offen = (ciaData.schichten || []).filter((s) => !s.aus_ts && s.datum && s.datum < heute);
  for (const s of offen) {
    const ort = (ciaData.orte || []).find((o) => o.id === s.ort_id);
    const fenster = ort ? ciOrtFensterAn(ort, s.datum) : null;
    const endeMin = fenster ? fenster.bis : 23 * 60 + 59;
    const ende = new Date(s.datum + "T00:00:00"); ende.setMinutes(endeMin);
    const patch = { aus_ts: ende.toISOString(), dauer_min: ciSchichtDauerMin(s.ein_ts, ende.toISOString(), fenster || { von: 0, bis: 1439 }), auto_beendet: true };
    Object.assign(s, patch);
    try { await sb.from("checkin_schichten").update(patch).eq("id", s.id); } catch (e) {}
  }
}

async function ciaLoadMonthLogs() {
  try {
    const von = `${ciaMonth.year}-${String(ciaMonth.month + 1).padStart(2, "0")}-01`;
    const bisD = new Date(ciaMonth.year, ciaMonth.month + 1, 0);
    const bis = ciIsoFromDate(bisD);
    const [logRes, schRes] = await Promise.all([
      sb.from("checkin_logs").select("*").gte("datum", von).lte("datum", bis),
      sb.from("checkin_schichten").select("*").gte("datum", von).lte("datum", bis),
    ]);
    ciaMonthLogs = logRes.data || [];
    ciaMonthSchichten = schRes.data || [];
  } catch (e) { ciaMonthLogs = []; ciaMonthSchichten = []; }
}

function ciaMaName(id) {
  const m = ciaData.mitarbeiter.find((x) => x.id === id);
  return m ? m.name : null;
}
function ciaPunkt(id) { return ciaData.punkte.find((p) => p.id === id); }

// Check-ins zu (rundgang, punkt, datum) aus einer Log-Liste.
function ciaLogFor(logs, rgId, ptId, iso) {
  return logs.find((l) => l.rundgang_id === rgId && l.punkt_id === ptId && l.datum === iso) || null;
}

/* ---------------- Rahmen rendern ---------------- */
function ciaRender() {
  const view = document.getElementById("view");
  if (!view) return;
  if (ciaData._sqlFehlt) {
    view.innerHTML = `<div class="card-x warncard"><h4>⚠️ Datenbank noch nicht eingerichtet</h4>
      <p>Bitte die Datei <b>supabase_add_checkins.sql</b> in Supabase ausführen. Danach diese Seite neu laden.</p></div>`;
    return;
  }
  const tabs = [["start","🏠 Start"],["heute","📅 Heute"],["monat","📊 Monat"],["rund","🗺️ Rundgänge"],["punkte","📍 Punkte"],["orte","🏢 Arbeitsorte"]];
  view.innerHTML = `
    <div class="seg">${tabs.map(([k,l]) => `<button class="${ciaTab===k?"on":""}" onclick="ciaGo('${k}')">${l}</button>`).join("")}</div>
    <div class="view on" id="ciaView">${ciaRenderTab()}</div>`;
  if ((ciaTab === "punkte" && ciaPtForm) || (ciaTab === "orte" && ciaOrtForm)) ciaInitMapSoon();
}

function ciaGo(tab) {
  ciaTab = tab;
  if (tab !== "rund") ciaRgForm = null;
  if (tab !== "punkte") { ciaPtForm = null; }
  if (tab !== "orte") { ciaOrtForm = null; }
  if (tab !== "punkte" && tab !== "orte") ciaDestroyMap();
  ciaRender();
}

function ciaRenderTab() {
  if (ciaTab === "start") return ciaRenderStart();
  if (ciaTab === "heute") return ciaRenderHeute();
  if (ciaTab === "monat") return ciaRenderMonat();
  if (ciaTab === "rund") return ciaRenderRund();
  if (ciaTab === "punkte") return ciaRenderPunkte();
  if (ciaTab === "orte") return ciaRenderOrte();
  return "";
}
function ciaActiveForm() { return ciaPtForm || ciaOrtForm; }

// Tagesstatus eines Rundgangs (heute) -> {status, erledigt, gesamt, missPts}
function ciaRgTagesstatus(rg, logs, iso, nowMin) {
  const eintraege = ciRundgangPunkte(rg);
  let erledigt = 0, hatMiss = false, hatNow = false, hatLater = false;
  eintraege.forEach((e) => {
    const punkt = ciaPunkt(e.punkt_id);
    if (!punkt) return;
    const fenster = ciEffFenster(rg, e, punkt);
    const done = !!ciaLogFor(logs, rg.id, e.punkt_id, iso);
    const st = ciPunktStatus(fenster, nowMin, done); // Live-Ansicht immer ehrlich nach Uhrzeit
    if (st === "done") erledigt++;
    else if (st === "miss") hatMiss = true;
    else if (st === "now" || st === "open") hatNow = true;
    else if (st === "later") hatLater = true;
  });
  const gesamt = eintraege.length;
  let status;
  if (gesamt === 0) status = "off";
  else if (erledigt >= gesamt) status = "ok";
  else if (hatMiss) status = "miss";
  else if (erledigt > 0 || hatNow) status = "run";
  else status = "later";
  return { status, erledigt, gesamt, hatMiss };
}

/* ---------------- START ---------------- */
function ciaRenderStart() {
  const iso = ciTodayIso();
  const now = ciNowMin();
  const logs = ciaData.todayLogs;
  const laufend = ciaData.rundgaenge.filter((r) => r.aktiv !== false && ciRundgangLaeuftAn(r, iso));
  let fertig = 0, laeuft = 0, verpasst = 0;
  const missNamen = [];
  laufend.forEach((rg) => {
    const s = ciaRgTagesstatus(rg, logs, iso, now);
    if (s.status === "ok") fertig++;
    else if (s.status === "miss") { verpasst++; missNamen.push(rg.name); }
    else if (s.status === "run") laeuft++;
  });

  const letzte = logs.slice().sort((a, b) => (b.ts || "").localeCompare(a.ts || "")).slice(0, 8);
  const letzteHtml = letzte.length ? letzte.map((l) => {
    const p = ciaPunkt(l.punkt_id);
    const dist = l.distanz_m != null ? ` · ${l.distanz_m} m` : "";
    return `<div class="feed-row"><span class="t">${escapeHtml(ciUhrzeit(l.ts))}</span><span class="fdot" style="background:var(--green)"></span><span>${escapeHtml((p&&p.name)||"Punkt")}${escapeHtml(dist)} · ${escapeHtml(l.mitarbeiter_name||"")}</span></div>`;
  }).join("") : `<p class="ci-empty">Heute noch keine Check-ins.</p>`;

  // Arbeitszeit: gerade eingecheckt (offene Schichten heute)
  const offen = (ciaData.schichten || []).filter((s) => !s.aus_ts && s.datum === iso);
  const nowMs = Date.now();
  const offenHtml = offen.length ? offen.map((s) => {
    const ort = (ciaData.orte || []).find((o) => o.id === s.ort_id);
    const dauer = ciFmtDauer((nowMs - new Date(s.ein_ts).getTime()) / 60000);
    return `<div class="feed-row"><span class="t">${escapeHtml(ciUhrzeit(s.ein_ts))}</span><span class="fdot" style="background:var(--blue)"></span><span><b>${escapeHtml(s.mitarbeiter_name||"")}</b> · ${escapeHtml((ort&&ort.name)||"Objekt")} · seit <b>${dauer}</b></span></div>`;
  }).join("") : "";

  return `
    <div class="ci-stagger">
      <div class="tiles">
        <div class="tile"><div class="k">Heute fällig</div><div class="v b">${laufend.length}</div></div>
        <div class="tile"><div class="k">Fertig</div><div class="v g">${fertig}</div></div>
        <div class="tile"><div class="k">Läuft</div><div class="v a">${laeuft}</div></div>
        <div class="tile"><div class="k">Verpasst</div><div class="v r">${verpasst}</div></div>
      </div>
      ${missNamen.length ? `<div class="card-x warncard"><h4>⚠️ Braucht deine Aufmerksamkeit</h4>
        <p>${missNamen.map((n)=>`<b>„${escapeHtml(n)}"</b>`).join(", ")} ${missNamen.length>1?"haben":"hat"} heute mindestens einen verpassten Punkt.</p></div>` : ""}
      ${offenHtml ? `<div class="card-x"><h4>🏢 Gerade eingecheckt (Arbeitszeit)</h4>${offenHtml}</div>` : ""}
      <div class="card-x"><h4>Letzte Check-ins</h4>${letzteHtml}</div>
    </div>`;
}

/* ---------------- HEUTE (Tagesansicht) ---------------- */
function ciaRenderHeute() {
  const iso = ciTodayIso();
  const now = ciNowMin();
  const logs = ciaData.todayLogs;
  const rgs = ciaData.rundgaenge.filter((r) => r.aktiv !== false && ciRundgangLaeuftAn(r, iso));
  if (!rgs.length) return `<div class="card-x"><p class="ci-empty">Heute ist kein Rundgang geplant.</p></div>`;

  return `<div class="ci-stagger">` + rgs.map((rg, idx) => {
    const s = ciaRgTagesstatus(rg, logs, iso, now);
    const pill = s.status === "ok" ? `<span class="stpill sp-ok">✓ fertig</span>`
      : s.status === "miss" ? `<span class="stpill sp-miss">✗ ${s.erledigt}/${s.gesamt}</span>`
      : s.status === "run" ? `<span class="stpill sp-run">läuft · ${s.erledigt}/${s.gesamt}</span>`
      : `<span class="stpill sp-off">${s.erledigt}/${s.gesamt}</span>`;
    const maName = rg.mitarbeiter_id ? ciaMaName(rg.mitarbeiter_id) : "alle";
    const offen = idx === 0 ? "block" : "none";
    const rows = ciRundgangPunkte(rg).map((e) => {
      const punkt = ciaPunkt(e.punkt_id);
      if (!punkt) return "";
      const fenster = ciEffFenster(rg, e, punkt);
      const log = ciaLogFor(logs, rg.id, e.punkt_id, iso);
      const st = ciPunktStatus(fenster, now, !!log);
      let res;
      if (st === "done") res = `<span class="res r-ok">✓ ${escapeHtml(ciUhrzeit(log.ts))}${log.distanz_m!=null?` · ${log.distanz_m} m`:""}</span>`;
      else if (st === "now" || st === "open") res = `<span class="res r-now">● offen</span>`;
      else if (st === "later") res = `<span class="res r-later">später</span>`;
      else res = `<span class="res r-miss">✗ verpasst</span>`;
      return `<div class="prow"><span class="w">${escapeHtml(ciFensterLabel(fenster))}</span><span class="nm2">${escapeHtml(punkt.name)}</span>${res}</div>`;
    }).join("");
    return `<div class="day-rg">
      <div class="hd" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
        <div><div class="nm">${escapeHtml(rg.name)}</div><div class="as">👤 ${escapeHtml(maName||"alle")} · ${ciParseTage(rg.tage).map((t)=>CI_TAGE_KURZ[t-1]).join(", ")}</div></div>
        ${pill}
      </div>
      <div class="pts" style="display:${offen};">${rows || '<p class="ci-empty">Keine Punkte.</p>'}</div>
    </div>`;
  }).join("") + `</div>`;
}

/* ---------------- MONAT ---------------- */
function ciaRenderMonat() {
  const y = ciaMonth.year, mo = ciaMonth.month;
  const heuteIso = ciTodayIso();
  const tage = new Date(y, mo + 1, 0).getDate();
  const rgs = ciaData.rundgaenge;

  // Erfüllung pro Rundgang + Gesamtzahlen (nur ab Go-Live-Datum zählen)
  let totalCheckins = ciaMonthLogs.filter((l) => ciZaehltAb(l.datum)).length;
  let erfPunkte = 0, sollPunkte = 0;
  const verpasstTage = new Set();
  const quota = rgs.map((rg) => {
    const eintraege = ciRundgangPunkte(rg);
    let soll = 0, ist = 0;
    for (let d = 1; d <= tage; d++) {
      const iso = `${y}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      if (iso > heuteIso || !ciZaehltAb(iso)) continue;
      if (!ciRundgangLaeuftAn(rg, iso)) continue;
      eintraege.forEach((e) => {
        soll++;
        if (ciaLogFor(ciaMonthLogs, rg.id, e.punkt_id, iso)) ist++;
        else verpasstTage.add(iso);
      });
    }
    erfPunkte += ist; sollPunkte += soll;
    const proz = soll ? Math.round((ist / soll) * 100) : null;
    return { rg, proz, soll };
  });
  const gesamtProz = sollPunkte ? Math.round((erfPunkte / sollPunkte) * 100) : null;

  // Matrix
  const WD = ["Mo","Di","Mi","Do","Fr","Sa","So"];
  let head = `<tr><th style="text-align:left;">Rundgang</th>`;
  for (let d = 1; d <= tage; d++) {
    const wd = ciIsoDay(new Date(y, mo, d));
    head += `<th class="${wd>=6?"we":""}">${d}<br>${WD[wd-1]}</th>`;
  }
  head += `</tr>`;
  let body = "";
  rgs.forEach((rg) => {
    const eintraege = ciRundgangPunkte(rg);
    body += `<tr><td class="lbl">${escapeHtml(rg.name)}</td>`;
    for (let d = 1; d <= tage; d++) {
      const iso = `${y}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      let cls = "off", txt = "";
      if (!ciRundgangLaeuftAn(rg, iso) || !ciZaehltAb(iso)) cls = "off"; // vor Go-Live: grau "nicht erfasst"
      else if (iso > heuteIso) cls = "fut";
      else {
        const done = eintraege.filter((e) => ciaLogFor(ciaMonthLogs, rg.id, e.punkt_id, iso)).length;
        const res = ciRundgangErgebnis(done, eintraege.length);
        cls = res === "ok" ? "ok" : res === "part" ? "part" : res === "miss" ? "miss" : "off";
        txt = res === "ok" ? "✓" : res === "part" ? "◐" : res === "miss" ? "✗" : "";
      }
      const click = (cls==="ok"||cls==="miss"||cls==="part") ? `onclick="ciaShowDay('${rg.id}','${iso}',this)"` : "";
      body += `<td><button class="mc ${cls}" ${click}>${txt}</button></td>`;
    }
    body += `</tr>`;
  });

  return `
    <div class="month-nav">
      <button onclick="ciaMonthStep(-1)">‹</button>
      <b>${CI_MONATE[mo]} ${y}</b>
      <button onclick="ciaMonthStep(1)">›</button>
    </div>
    <div class="exp-row">
      <button class="exp-btn" onclick="ciaExportPdf()">📄 Als PDF</button>
      <button class="exp-btn" onclick="ciaExportCsv()">📊 Excel (CSV)</button>
    </div>
    <div class="tiles" style="grid-template-columns:repeat(3,1fr);">
      <div class="tile"><div class="k">Check-ins gesamt</div><div class="v">${totalCheckins}</div></div>
      <div class="tile"><div class="k">Erfüllt</div><div class="v ${gesamtProz!=null&&gesamtProz<80?"r":"g"}">${gesamtProz!=null?gesamtProz+" %":"–"}</div></div>
      <div class="tile"><div class="k">Tage mit Lücke</div><div class="v r">${verpasstTage.size}</div></div>
    </div>
    ${rgs.length ? `<div class="card-x quota"><h4>Erfüllung pro Rundgang</h4>
      ${quota.map(({rg,proz,soll}) => `<div class="qrow"><span>${escapeHtml(rg.name)}</span>
        <span class="qbar"><i style="width:${proz||0}%;background:${proz==null?"var(--line)":proz<80?"var(--red)":"var(--green)"}"></i></span>
        <span class="qp" style="color:${proz==null?"var(--muted)":proz<80?"var(--red)":"var(--green)"}">${proz!=null?proz+" %":"–"}</span></div>`).join("")}
    </div>` : ""}
    <div class="card-x">
      <h4>Monats-Matrix <span style="font-weight:400;color:var(--muted);font-size:11.5px;">· Zelle antippen für Details</span></h4>
      ${rgs.length ? `<div class="mscroll"><table class="mx">${head}${body}</table></div>
      <div class="legend">
        <span><i style="background:var(--green-bg)"></i>komplett</span>
        <span><i style="background:var(--amber-bg)"></i>teilweise</span>
        <span><i style="background:var(--red-bg)"></i>verpasst</span>
        <span><i style="background:var(--line-2)"></i>kein Rundgang-Tag</span>
      </div>
      <div class="day-detail" id="ciaDayDetail"></div>` : `<p class="ci-empty">Noch keine Rundgänge angelegt.</p>`}
    </div>
    ${ciaRenderStundenCard()}`;
}

// Monats-Stunden je Mitarbeiter (Arbeitszeit). Nur ausgecheckte Schichten zählen.
function ciaStundenProMa() {
  const map = {}; // maId -> {name, min, tage:Set}
  (ciaMonthSchichten || []).forEach((s) => {
    if (!s.aus_ts) return;
    const m = map[s.mitarbeiter_id] || (map[s.mitarbeiter_id] = { name: s.mitarbeiter_name || ciaMaName(s.mitarbeiter_id) || "?", min: 0, tage: new Set() });
    m.min += s.dauer_min || 0;
    m.tage.add(s.datum);
  });
  return Object.values(map).sort((a, b) => b.min - a.min);
}

function ciaRenderStundenCard() {
  if (!(ciaData.orte || []).length && !(ciaMonthSchichten || []).length) return "";
  const rows = ciaStundenProMa();
  const gesamt = rows.reduce((a, r) => a + r.min, 0);
  return `<div class="card-x">
    <div class="list-head" style="margin-bottom:10px;"><h4>🏢 Arbeitszeit-Stunden</h4>
      <button class="exp-btn" style="flex:0 0 auto;padding:8px 12px;" onclick="ciaExportStundenCsv()">📊 Stunden-CSV</button></div>
    ${rows.length ? `<div class="quota">
      ${rows.map((r) => `<div class="qrow" style="grid-template-columns:1fr auto;"><span>${escapeHtml(r.name)} <span class="muted" style="font-size:11px;">· ${r.tage.size} Tag${r.tage.size!==1?"e":""}</span></span><span class="qp">${ciFmtDauer(r.min)}</span></div>`).join("")}
      <div class="qrow" style="grid-template-columns:1fr auto;border-top:1px solid var(--line);padding-top:8px;margin-top:4px;"><span><b>Gesamt</b></span><span class="qp"><b>${ciFmtDauer(gesamt)}</b></span></div>
    </div>` : `<p class="ci-empty">Diesen Monat noch keine erfassten Stunden.</p>`}
  </div>`;
}

function ciaExportStundenCsv() {
  const zeilen = (ciaMonthSchichten || []).filter((s) => s.aus_ts).slice().sort((a, b) => (a.datum + a.ein_ts).localeCompare(b.datum + b.ein_ts));
  if (!zeilen.length) { showToast("Keine Stunden für diesen Monat"); return; }
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ["Datum", "Mitarbeiter", "Objekt", "Ein", "Aus", "Stunden", "Auto-beendet"];
  const rows = zeilen.map((s) => {
    const ort = (ciaData.orte || []).find((o) => o.id === s.ort_id);
    return [ciFormatDatum(s.datum), s.mitarbeiter_name || "", (ort && ort.name) || s.ort_id, ciUhrzeit(s.ein_ts), ciUhrzeit(s.aus_ts), ciFmtDauer(s.dauer_min || 0), s.auto_beendet ? "ja" : ""].map(esc).join(";");
  });
  const csv = "﻿" + [head.map(esc).join(";"), ...rows].join("\r\n");
  ciaDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `arbeitszeit_${CI_MONATE[ciaMonth.month].toLowerCase()}_${ciaMonth.year}.csv`);
  showToast("📊 Stunden-CSV erstellt");
}

function ciaMonthStep(delta) {
  let m = ciaMonth.month + delta, y = ciaMonth.year;
  if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
  ciaMonth = { year: y, month: m };
  ciaLoadMonthLogs().then(ciaRender);
}

function ciaShowDay(rgId, iso, el) {
  document.querySelectorAll(".mc.sel").forEach((c) => c.classList.remove("sel"));
  el.classList.add("sel");
  const rg = ciaData.rundgaenge.find((r) => r.id === rgId);
  const box = document.getElementById("ciaDayDetail");
  if (!rg || !box) return;
  const rows = ciRundgangPunkte(rg).map((e) => {
    const punkt = ciaPunkt(e.punkt_id);
    if (!punkt) return "";
    const log = ciaLogFor(ciaMonthLogs, rg.id, e.punkt_id, iso);
    if (log) return `<div class="feed-row"><span class="t">${escapeHtml(ciUhrzeit(log.ts))}</span><span class="fdot" style="background:var(--green)"></span><span>${escapeHtml(punkt.name)}${log.distanz_m!=null?` · ${log.distanz_m} m`:""} · ${escapeHtml(log.mitarbeiter_name||"")}</span></div>`;
    return `<div class="feed-row"><span class="t">—</span><span class="fdot" style="background:var(--red)"></span><span>${escapeHtml(punkt.name)} – nicht eingecheckt</span></div>`;
  }).join("");
  box.innerHTML = `<h5>${escapeHtml(rg.name)} · ${ciFormatDatum(iso)}</h5>${rows}`;
  box.classList.add("show");
}

/* ---------------- Export ---------------- */
function ciaMonatSollIst() {
  // Baut Zeilen für Export: pro Rundgang-Tag-Punkt (nur vergangene aktive Tage)
  const y = ciaMonth.year, mo = ciaMonth.month;
  const tage = new Date(y, mo + 1, 0).getDate();
  const heuteIso = ciTodayIso();
  const zeilen = [];
  ciaData.rundgaenge.forEach((rg) => {
    const eintraege = ciRundgangPunkte(rg);
    for (let d = 1; d <= tage; d++) {
      const iso = `${y}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      if (iso > heuteIso || !ciZaehltAb(iso) || !ciRundgangLaeuftAn(rg, iso)) continue;
      eintraege.forEach((e) => {
        const punkt = ciaPunkt(e.punkt_id);
        const log = ciaLogFor(ciaMonthLogs, rg.id, e.punkt_id, iso);
        zeilen.push({
          datum: iso, rundgang: rg.name, punkt: (punkt && punkt.name) || e.punkt_id,
          uhrzeit: log ? ciUhrzeit(log.ts) : "", distanz: log && log.distanz_m != null ? log.distanz_m : "",
          ma: log ? (log.mitarbeiter_name || "") : "", status: log ? "erledigt" : "verpasst",
        });
      });
    }
  });
  return zeilen;
}

function ciaExportCsv() {
  const zeilen = ciaMonatSollIst();
  if (!zeilen.length) { showToast("Keine Daten für diesen Monat"); return; }
  const head = ["Datum","Rundgang","Punkt","Uhrzeit","Entfernung (m)","Mitarbeiter","Status"];
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = zeilen.map((z) => [ciFormatDatum(z.datum), z.rundgang, z.punkt, z.uhrzeit, z.distanz, z.ma, z.status].map(esc).join(";"));
  const csv = "﻿" + [head.map(esc).join(";"), ...rows].join("\r\n"); // BOM -> Excel erkennt UTF-8
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  ciaDownload(blob, `checkins_${CI_MONATE[ciaMonth.month].toLowerCase()}_${ciaMonth.year}.csv`);
  showToast("📊 Excel/CSV erstellt");
}

function ciaExportPdf() {
  if (!(window.jspdf && window.jspdf.jsPDF)) { showToast("PDF-Bibliothek lädt noch – kurz warten"); return; }
  const zeilen = ciaMonatSollIst();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let yy = 54;
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text("Bestreifungsnachweis", 40, yy);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(110);
  yy += 20; doc.text(`GEKO Clean · ${CI_MONATE[ciaMonth.month]} ${ciaMonth.year}`, 40, yy);
  doc.setTextColor(30); yy += 26;

  // Zusammenfassung pro Rundgang
  ciaData.rundgaenge.forEach((rg) => {
    const rgZeilen = zeilen.filter((z) => z.rundgang === rg.name);
    const soll = rgZeilen.length;
    const ist = rgZeilen.filter((z) => z.status === "erledigt").length;
    const proz = soll ? Math.round((ist / soll) * 100) : 0;
    if (yy > 760) { doc.addPage(); yy = 54; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(`${rg.name}`, 40, yy);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(110);
    doc.text(`${ist} / ${soll} Punkte erfüllt (${proz}%) · Tage: ${ciParseTage(rg.tage).map((t)=>CI_TAGE_KURZ[t-1]).join(", ")}`, 40, yy + 14);
    doc.setTextColor(30); yy += 34;

    // Tageszeilen (nur verpasste explizit + Zusammenfassung je Tag)
    const proTag = {};
    rgZeilen.forEach((z) => { (proTag[z.datum] = proTag[z.datum] || []).push(z); });
    Object.keys(proTag).sort().forEach((iso) => {
      const arr = proTag[iso];
      const done = arr.filter((z) => z.status === "erledigt").length;
      const ok = done >= arr.length;
      if (yy > 780) { doc.addPage(); yy = 54; }
      doc.setFontSize(10);
      doc.setTextColor(ok ? 31 : 181, ok ? 122 : 55, ok ? 77 : 31);
      doc.text(`${ok ? "OK " : "!! "}${ciFormatDatum(iso)}  –  ${done}/${arr.length} Punkte`, 52, yy);
      doc.setTextColor(30);
      yy += 15;
    });
    yy += 12;
  });
  if (!ciaData.rundgaenge.length) doc.text("Keine Rundgänge angelegt.", 40, yy);
  doc.save(`bestreifungsnachweis_${CI_MONATE[ciaMonth.month].toLowerCase()}_${ciaMonth.year}.pdf`);
  showToast("📄 PDF erstellt");
}

function ciaDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}

/* ---------------- RUNDGÄNGE ---------------- */
function ciaRenderRund() {
  if (ciaRgForm) return ciaRenderRgForm();
  const list = ciaData.rundgaenge.map((rg) => {
    const maName = rg.mitarbeiter_id ? ciaMaName(rg.mitarbeiter_id) : null;
    const eintraege = ciRundgangPunkte(rg);
    const chips = eintraege.map((e) => {
      const p = ciaPunkt(e.punkt_id);
      if (!p) return "";
      const f = ciEffFenster(rg, e, p);
      const hatEigen = (e.fenster_von || e.fenster_bis);
      return `<span class="chip">${escapeHtml(p.name)}${hatEigen?` <b class="tw">⏱ ${escapeHtml(ciFensterLabel(f))}</b>`:""}</span>`;
    }).join("");
    return `<div class="rgc" style="${rg.aktiv===false?"opacity:.62;":""}">
      <div class="top"><span class="nm">${escapeHtml(rg.name)}</span>
        <label class="sw-t"><input type="checkbox" ${rg.aktiv!==false?"checked":""} onchange="ciaToggleRg('${rg.id}',this.checked)"><i></i></label></div>
      <div class="meta">${eintraege.length} Punkt${eintraege.length!==1?"e":""} · ${ciParseTage(rg.tage).map((t)=>CI_TAGE_KURZ[t-1]).join(", ")} · ${escapeHtml(rg.fenster_von||"")}–${escapeHtml(rg.fenster_bis||"")}${rg.aktiv===false?` · <b style="color:var(--red);">pausiert</b>`:""}</div>
      ${maName?`<span class="ma-chip"><span class="av">${escapeHtml((maName[0]||"?").toUpperCase())}</span> ${escapeHtml(maName)}</span>`:`<span class="ma-chip"><span class="av">∀</span> alle</span>`}
      ${chips?`<div class="chips">${chips}</div>`:""}
      <div class="rgc-actions">
        <button onclick="ciaEditRg('${rg.id}')">✏️ Bearbeiten</button>
        <button class="del" onclick="ciaDeleteRg('${rg.id}')">Löschen</button>
      </div>
    </div>`;
  }).join("");
  return `<div class="list-head"><h4>Rundgänge</h4><button class="add-btn" onclick="ciaNewRg()">＋ Neuer Rundgang</button></div>
    ${ciaData.rundgaenge.length ? `<div class="ci-stagger">${list}</div>` : `<div class="card-x"><p class="ci-empty">Noch keine Rundgänge. Lege zuerst ein paar Punkte an, dann einen Rundgang.</p></div>`}`;
}

function ciaNewRg() {
  ciaRgForm = { id: null, name: "", mitarbeiter_id: "", tage: "1,2,3,4,5", fenster_von: "06:00", fenster_bis: "10:00", toleranz_min: 30, punkte: [], aktiv: true };
  ciaRender();
}
function ciaEditRg(id) {
  const rg = ciaData.rundgaenge.find((r) => r.id === id);
  if (!rg) return;
  ciaRgForm = JSON.parse(JSON.stringify({ ...rg, punkte: ciRundgangPunkte(rg) }));
  ciaRender();
}

function ciaRenderRgForm() {
  const f = ciaRgForm;
  const tage = ciParseTage(f.tage);
  const gewaehlt = {}; (f.punkte || []).forEach((e) => { gewaehlt[e.punkt_id] = e; });
  const maOpts = `<option value="">— alle dürfen —</option>` +
    ciaData.mitarbeiter.map((m) => `<option value="${m.id}" ${f.mitarbeiter_id===m.id?"selected":""}>${escapeHtml(m.name)}</option>`).join("");

  const punktRows = ciaData.punkte.length ? ciaData.punkte.map((p) => {
    const e = gewaehlt[p.id];
    const on = !!e;
    return `<div class="pt-check">
      <label class="l1"><input type="checkbox" id="rgpt_${p.id}" ${on?"checked":""} onchange="ciaTogglePtOv('${p.id}',this.checked)"> <b>${escapeHtml(p.name)}</b></label>
      <div class="ov" id="ov_${p.id}" style="display:${on?"flex":"none"};">eigenes Fenster:
        <input class="f-mini" id="rgvon_${p.id}" value="${escapeHtml((e&&e.fenster_von)||"")}" placeholder="${escapeHtml(f.fenster_von||"—")}" />–<input class="f-mini" id="rgbis_${p.id}" value="${escapeHtml((e&&e.fenster_bis)||"")}" placeholder="${escapeHtml(f.fenster_bis||"—")}" />
        · Tol. <select class="f-mini" id="rgtol_${p.id}">
          ${[["","Std."],["0","± 0"],["15","± 15"],["30","± 30"],["60","± 60"]].map(([v,l])=>`<option value="${v}" ${String((e&&e.toleranz_min)??"")===v?"selected":""}>${l}</option>`).join("")}
        </select>
      </div></div>`;
  }).join("") : `<p class="ci-empty">Erst im Reiter „Punkte" GPS-Punkte anlegen.</p>`;

  return `<div class="ci-form">
    <h5>${f.id?"Rundgang bearbeiten":"Neuer Rundgang"}</h5>
    <div class="f-lbl">Name</div>
    <input class="f-in" id="rg_name" value="${escapeHtml(f.name||"")}" placeholder="z.B. Innenstadt" />
    <div class="f-lbl">Zugeteilt an</div>
    <select class="f-in" id="rg_ma">${maOpts}</select>
    <div class="f-lbl">Tage</div>
    <div class="dayrow" id="rg_days">
      ${CI_TAGE_KURZ.map((t,i) => `<button type="button" class="dchip ${tage.includes(i+1)?"on":""}" data-d="${i+1}" onclick="this.classList.toggle('on')">${t}</button>`).join("")}
    </div>
    <div class="f-lbl">Standard-Zeitfenster (gilt, wenn ein Punkt nichts Eigenes hat)</div>
    <div style="display:flex;gap:8px;align-items:center;">
      <input class="f-in" id="rg_von" style="flex:1;" value="${escapeHtml(f.fenster_von||"")}" placeholder="06:00" />
      <span class="muted">bis</span>
      <input class="f-in" id="rg_bis" style="flex:1;" value="${escapeHtml(f.fenster_bis||"")}" placeholder="10:00" />
    </div>
    <div class="f-lbl">Standard-Toleranz</div>
    <select class="f-in" id="rg_tol" style="width:auto;">
      ${[0,15,30,60].map((t)=>`<option value="${t}" ${Number(f.toleranz_min)===t?"selected":""}>± ${t} Min</option>`).join("")}
    </select>
    <div class="f-lbl">Punkte – mit eigenem Fenster &amp; Toleranz pro Punkt</div>
    ${punktRows}
    <div class="form-foot">
      <button class="btn-sec" onclick="ciaRgForm=null;ciaRender();">Abbrechen</button>
      <button class="btn-pri" onclick="ciaSaveRg()">Rundgang speichern</button>
    </div>
  </div>`;
}

function ciaTogglePtOv(id, on) {
  const ov = document.getElementById(`ov_${id}`);
  if (ov) ov.style.display = on ? "flex" : "none";
}

async function ciaSaveRg() {
  const name = (document.getElementById("rg_name").value || "").trim();
  if (!name) { showToast("Bitte einen Namen eintragen"); return; }
  const days = [...document.querySelectorAll("#rg_days .dchip.on")].map((b) => b.dataset.d);
  if (!days.length) { showToast("Bitte mindestens einen Tag wählen"); return; }
  const punkte = [];
  ciaData.punkte.forEach((p) => {
    const cb = document.getElementById(`rgpt_${p.id}`);
    if (!cb || !cb.checked) return;
    const von = (document.getElementById(`rgvon_${p.id}`).value || "").trim();
    const bis = (document.getElementById(`rgbis_${p.id}`).value || "").trim();
    const tolRaw = document.getElementById(`rgtol_${p.id}`).value;
    const eintrag = { punkt_id: p.id };
    if (von) eintrag.fenster_von = von;
    if (bis) eintrag.fenster_bis = bis;
    if (tolRaw !== "") eintrag.toleranz_min = parseInt(tolRaw, 10);
    punkte.push(eintrag);
  });
  if (!punkte.length) { showToast("Bitte mindestens einen Punkt auswählen"); return; }

  const payload = {
    id: ciaRgForm.id || genCode(),
    name,
    mitarbeiter_id: document.getElementById("rg_ma").value || null,
    tage: days.join(","),
    fenster_von: (document.getElementById("rg_von").value || "06:00").trim(),
    fenster_bis: (document.getElementById("rg_bis").value || "10:00").trim(),
    toleranz_min: parseInt(document.getElementById("rg_tol").value, 10) || 0,
    punkte,
    aktiv: ciaRgForm.aktiv !== false,
  };
  const { error } = await sb.from("checkin_rundgaenge").upsert(payload);
  if (error) { showToast("Fehler: " + error.message); return; }
  showToast("Rundgang gespeichert ✓");
  ciaRgForm = null;
  await ciaLoadBase();
  ciaRender();
}

async function ciaToggleRg(id, aktiv) {
  const { error } = await sb.from("checkin_rundgaenge").update({ aktiv }).eq("id", id);
  if (error) { showToast("Fehler: " + error.message); return; }
  const rg = ciaData.rundgaenge.find((r) => r.id === id); if (rg) rg.aktiv = aktiv;
  showToast(aktiv ? "Rundgang aktiv" : "Rundgang pausiert");
}

async function ciaDeleteRg(id) {
  if (!confirm("Diesen Rundgang wirklich löschen? Die bisherigen Check-ins bleiben in der Auswertung.")) return;
  const { error } = await sb.from("checkin_rundgaenge").delete().eq("id", id);
  if (error) { showToast("Fehler: " + error.message); return; }
  showToast("Rundgang gelöscht");
  await ciaLoadBase();
  ciaRender();
}

/* ---------------- PUNKTE ---------------- */
function ciaRenderPunkte() {
  if (ciaPtForm) return ciaRenderPtForm();
  const anzahlInRg = (ptId) => ciaData.rundgaenge.filter((rg) => ciRundgangPunkte(rg).some((e) => e.punkt_id === ptId)).length;
  const list = ciaData.punkte.map((p) => {
    const n = anzahlInRg(p.id);
    const eigen = (p.fenster_von || p.fenster_bis) ? " · ⏱ eigenes Fenster" : "";
    return `<div class="ptc" onclick="ciaEditPt('${p.id}')">
      <div class="ic">📍</div>
      <div class="pm"><div class="pn">${escapeHtml(p.name)}</div>
        <div class="pa">${escapeHtml(p.adresse||"ohne Adresse")} · in ${n} Rundgang${n!==1?"en":""}${eigen}</div></div>
      <span class="rad">${p.radius||100} m</span>
    </div>`;
  }).join("");
  return `<div class="list-head"><h4>GPS-Punkte</h4><button class="add-btn" onclick="ciaNewPt()">＋ Neuer Punkt</button></div>
    ${ciaData.punkte.length ? `<div class="ci-stagger">${list}</div>` : `<div class="card-x"><p class="ci-empty">Noch keine Punkte angelegt.</p></div>`}`;
}

function ciaNewPt() {
  ciaPtForm = { id: null, name: "", adresse: "", lat: null, lng: null, radius: 100, fenster_von: "", fenster_bis: "", toleranz_min: 30, hinweis: "" };
  ciaPin = null;
  ciaRender();
}
function ciaEditPt(id) {
  const p = ciaData.punkte.find((x) => x.id === id);
  if (!p) return;
  ciaPtForm = JSON.parse(JSON.stringify(p));
  ciaPin = (p.lat != null && p.lng != null) ? { lat: p.lat, lng: p.lng } : null;
  ciaRender();
}

function ciaRenderPtForm() {
  const f = ciaPtForm;
  const radien = [50, 100, 150, 250];
  return `<div class="ci-form">
    <h5>${f.id?"Punkt bearbeiten":"Neuer Punkt"}</h5>
    <div class="f-lbl">Name</div>
    <input class="f-in" id="pt_name" value="${escapeHtml(f.name||"")}" placeholder="z.B. Rathaus – Haupteingang" />
    <div class="f-lbl">Adresse (oder direkt auf der Karte tippen)</div>
    <input class="f-in" id="pt_adresse" value="${escapeHtml(f.adresse||"")}" placeholder="Straße Nr, PLZ Ort" />
    <div class="map-btns">
      <button class="btn-sec" style="flex:1;" onclick="ciaGeocode()">🔎 Adresse suchen</button>
      <button class="btn-sec" style="flex:1;" onclick="ciaMeinePosition()">📱 Meine Position</button>
    </div>
    <div class="f-lbl">Karte – tippen, um den Pin exakt zu setzen</div>
    <div class="ci-map" id="ciaMap"></div>
    <div class="coords" id="ciaCoords">${f.lat!=null?`✓ Pin gesetzt: ${Number(f.lat).toFixed(5)}, ${Number(f.lng).toFixed(5)}`:'Noch kein Pin gesetzt – Adresse suchen oder auf die Karte tippen.'}</div>
    <div class="f-lbl">Erlaubter Umkreis</div>
    <div class="dayrow" id="pt_radius">
      ${radien.map((r) => `<button type="button" class="dchip ${Number(f.radius)===r?"on":""}" data-r="${r}" onclick="ciaSelRadius(${r})">${r} m</button>`).join("")}
    </div>
    <div class="f-lbl">Standard-Zeitfenster dieses Punkts (optional – ein Rundgang kann es überschreiben)</div>
    <div style="display:flex;gap:8px;align-items:center;">
      <input class="f-in" id="pt_von" style="flex:1;" value="${escapeHtml(f.fenster_von||"")}" placeholder="z.B. 11:00" />
      <span class="muted">bis</span>
      <input class="f-in" id="pt_bis" style="flex:1;" value="${escapeHtml(f.fenster_bis||"")}" placeholder="z.B. 12:00" />
    </div>
    <div class="f-lbl">Standard-Toleranz</div>
    <select class="f-in" id="pt_tol" style="width:auto;">
      ${[0,15,30,60].map((t)=>`<option value="${t}" ${Number(f.toleranz_min)===t?"selected":""}>± ${t} Min</option>`).join("")}
    </select>
    <div class="f-lbl">Hinweis für den Mitarbeiter (optional)</div>
    <input class="f-in" id="pt_hinweis" value="${escapeHtml(f.hinweis||"")}" placeholder="z.B. Seiteneingang neben der Bäckerei" />
    <div class="form-foot">
      <button class="btn-sec" onclick="ciaPtForm=null;ciaDestroyMap();ciaRender();">Abbrechen</button>
      ${f.id?`<button class="btn-sec" style="color:var(--red);" onclick="ciaDeletePt('${f.id}')">Löschen</button>`:""}
      <button class="btn-pri" onclick="ciaSavePt()">Punkt speichern</button>
    </div>
  </div>`;
}

function ciaSelRadius(r) {
  const f = ciaActiveForm(); if (f) f.radius = r;
  document.querySelectorAll("#pt_radius .dchip, #ort_radius .dchip").forEach((b) => b.classList.toggle("on", Number(b.dataset.r) === r));
  if (ciaCircle) ciaCircle.setRadius(r);
}

/* ---- Leaflet-Karte ---- */
function ciaInitMapSoon() { setTimeout(ciaInitMap, 60); }

function ciaInitMap() {
  const el = document.getElementById("ciaMap");
  if (!el || typeof L === "undefined") { if (el && typeof L === "undefined") el.innerHTML = '<p class="ci-empty">Karte konnte nicht geladen werden – nutze „Adresse suchen" oder „Meine Position".</p>'; return; }
  ciaDestroyMap();
  const start = ciaPin || { lat: 51.4818, lng: 7.2162 }; // Bochum als Standard
  ciaMap = L.map(el, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], ciaPin ? 17 : 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(ciaMap);
  ciaMap.on("click", (e) => ciaSetPin(e.latlng.lat, e.latlng.lng, false));
  if (ciaPin) ciaSetPin(ciaPin.lat, ciaPin.lng, false);
  setTimeout(() => { if (ciaMap) ciaMap.invalidateSize(); }, 120);
}

function ciaDestroyMap() {
  if (ciaMap) { try { ciaMap.remove(); } catch (e) {} }
  ciaMap = null; ciaMarker = null; ciaCircle = null;
}

function ciaSetPin(lat, lng, recenter) {
  ciaPin = { lat, lng };
  const f = ciaActiveForm(); if (f) { f.lat = lat; f.lng = lng; }
  const radius = (f && parseInt(f.radius, 10)) || 100;
  if (ciaMap) {
    if (!ciaMarker) { ciaMarker = L.marker([lat, lng], { draggable: true }).addTo(ciaMap);
      ciaMarker.on("dragend", () => { const p = ciaMarker.getLatLng(); ciaSetPin(p.lat, p.lng, false); });
    } else ciaMarker.setLatLng([lat, lng]);
    if (!ciaCircle) ciaCircle = L.circle([lat, lng], { radius, color: "#1f5d92", weight: 2, fillOpacity: .12 }).addTo(ciaMap);
    else { ciaCircle.setLatLng([lat, lng]); ciaCircle.setRadius(radius); }
    if (recenter) ciaMap.setView([lat, lng], 17);
  }
  const c = document.getElementById("ciaCoords");
  if (c) c.textContent = `✓ Pin gesetzt: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

async function ciaGeocode() {
  const el = document.getElementById("pt_adresse") || document.getElementById("ort_adresse");
  const adr = ((el && el.value) || "").trim();
  if (!adr) { showToast("Bitte zuerst eine Adresse eintragen"); return; }
  showToast("Suche Adresse…");
  try {
    const r = await glasGeocode(adr);
    ciaSetPin(r.lat, r.lng, true);
    showToast(r.approximate ? "Ungefähre Position gesetzt – Pin bei Bedarf verschieben" : "Adresse gefunden – Pin gesetzt");
  } catch (e) {
    showToast("Adresse nicht gefunden – bitte auf der Karte tippen");
  }
}

function ciaMeinePosition() {
  if (!navigator.geolocation) { showToast("Gerät kann keine Position bestimmen"); return; }
  showToast("Hole aktuelle Position…");
  navigator.geolocation.getCurrentPosition(
    (pos) => { ciaSetPin(pos.coords.latitude, pos.coords.longitude, true); showToast("Position übernommen"); },
    () => showToast("Standort nicht verfügbar – bitte erlauben oder Adresse suchen"),
    { enableHighAccuracy: true, timeout: 15000 }
  );
}

async function ciaSavePt() {
  const name = (document.getElementById("pt_name").value || "").trim();
  if (!name) { showToast("Bitte einen Namen eintragen"); return; }
  if (ciaPtForm.lat == null || ciaPtForm.lng == null) { showToast("Bitte einen Standort setzen (Adresse suchen, Position oder Karte)"); return; }
  const payload = {
    id: ciaPtForm.id || genCode(),
    name,
    adresse: (document.getElementById("pt_adresse").value || "").trim(),
    lat: ciaPtForm.lat, lng: ciaPtForm.lng,
    radius: parseInt(ciaPtForm.radius, 10) || 100,
    fenster_von: (document.getElementById("pt_von").value || "").trim(),
    fenster_bis: (document.getElementById("pt_bis").value || "").trim(),
    toleranz_min: parseInt(document.getElementById("pt_tol").value, 10) || 0,
    hinweis: (document.getElementById("pt_hinweis").value || "").trim(),
  };
  const { error } = await sb.from("checkin_punkte").upsert(payload);
  if (error) { showToast("Fehler: " + error.message); return; }
  showToast("Punkt gespeichert ✓");
  ciaPtForm = null; ciaDestroyMap();
  await ciaLoadBase();
  ciaRender();
}

async function ciaDeletePt(id) {
  const inRg = ciaData.rundgaenge.filter((rg) => ciRundgangPunkte(rg).some((e) => e.punkt_id === id));
  if (inRg.length) { showToast(`Punkt ist noch in ${inRg.length} Rundgang(en) – dort erst entfernen`); return; }
  if (!confirm("Diesen Punkt wirklich löschen?")) return;
  const { error } = await sb.from("checkin_punkte").delete().eq("id", id);
  if (error) { showToast("Fehler: " + error.message); return; }
  showToast("Punkt gelöscht");
  ciaPtForm = null; ciaDestroyMap();
  await ciaLoadBase();
  ciaRender();
}

/* ==================== ARBEITSORTE (Ein-/Auschecken) ==================== */
function ciaRenderOrte() {
  if (ciaOrtForm) return ciaRenderOrtForm();
  const list = (ciaData.orte || []).map((o) => {
    const maNamen = ciOrtMitarbeiter(o).map((id) => ciaMaName(id)).filter(Boolean);
    const z = ciJson(o.zeiten, {});
    const tage = Object.keys(z).map(Number).sort().map((wd) => `${CI_TAGE_KURZ[wd - 1]} ${z[wd].von}–${z[wd].bis}`);
    return `<div class="rgc" style="${o.aktiv === false ? "opacity:.62;" : ""}">
      <div class="top"><span class="nm">🏢 ${escapeHtml(o.name)}</span>
        <label class="sw-t"><input type="checkbox" ${o.aktiv !== false ? "checked" : ""} onchange="ciaToggleOrt('${o.id}',this.checked)"><i></i></label></div>
      <div class="meta">${escapeHtml(o.adresse || "ohne Adresse")} · ${o.radius || 100} m · Puffer ±${o.puffer_min != null ? o.puffer_min : 5} Min</div>
      ${maNamen.length ? `<div class="chips">${maNamen.map((n) => `<span class="chip">${escapeHtml(n)}</span>`).join("")}</div>` : `<div class="meta" style="color:var(--red);">⚠️ noch niemand zugewiesen</div>`}
      ${tage.length ? `<div class="chips">${tage.map((x) => `<span class="chip">${escapeHtml(x)}</span>`).join("")}</div>` : `<div class="meta" style="color:var(--red);">⚠️ keine Zeiten hinterlegt</div>`}
      <div class="rgc-actions">
        <button onclick="ciaEditOrt('${o.id}')">✏️ Bearbeiten</button>
        <button class="del" onclick="ciaDeleteOrt('${o.id}')">Löschen</button>
      </div>
    </div>`;
  }).join("");
  return `<div class="list-head"><h4>Arbeitsorte</h4><button class="add-btn" onclick="ciaNewOrt()">＋ Neuer Arbeitsort</button></div>
    <p class="muted" style="font-size:12px;margin:-4px 2px 12px;">Objekte zum Ein-/Auschecken. Nur zugewiesene Mitarbeiter sehen sie in ihrer App.</p>
    ${(ciaData.orte || []).length ? `<div class="ci-stagger">${list}</div>` : `<div class="card-x"><p class="ci-empty">Noch kein Arbeitsort angelegt.</p></div>`}`;
}

function ciaNewOrt() {
  ciaOrtForm = { id: null, name: "", adresse: "", lat: null, lng: null, radius: 100, zeiten: {}, puffer_min: 5, mitarbeiter_ids: [], aktiv: true };
  ciaPin = null;
  ciaRender();
}
function ciaEditOrt(id) {
  const o = (ciaData.orte || []).find((x) => x.id === id);
  if (!o) return;
  ciaOrtForm = { id: o.id, name: o.name, adresse: o.adresse, lat: o.lat, lng: o.lng, radius: o.radius, zeiten: ciJson(o.zeiten, {}), puffer_min: o.puffer_min != null ? o.puffer_min : 5, mitarbeiter_ids: ciOrtMitarbeiter(o), aktiv: o.aktiv };
  ciaPin = (o.lat != null && o.lng != null) ? { lat: o.lat, lng: o.lng } : null;
  ciaRender();
}

function ciaRenderOrtForm() {
  const f = ciaOrtForm;
  const radien = [50, 100, 150, 250];
  const assigned = f.mitarbeiter_ids || [];
  const dayRows = CI_TAGE_KURZ.map((tg, i) => {
    const wd = i + 1; const z = (f.zeiten && f.zeiten[wd]) || {}; const on = !!z.von;
    return `<div class="az-dayrow">
      <label class="az-daychk"><input type="checkbox" id="ortday_${wd}" ${on ? "checked" : ""} onchange="ciaOrtDayToggle(${wd})"> <b>${tg}</b></label>
      <input class="f-mini" id="ortvon_${wd}" value="${escapeHtml(z.von || "")}" placeholder="07:00" />
      <span class="muted">–</span>
      <input class="f-mini" id="ortbis_${wd}" value="${escapeHtml(z.bis || "")}" placeholder="16:00" />
    </div>`;
  }).join("");
  const maList = ciaData.mitarbeiter.length ? ciaData.mitarbeiter.map((m) =>
    `<label class="ort-ma"><input type="checkbox" id="ortma_${m.id}" ${assigned.includes(m.id) ? "checked" : ""}> ${escapeHtml(m.name)}</label>`).join("")
    : `<p class="ci-empty">Erst in „Mitarbeiter & Zugänge" (Glas-Admin) Konten anlegen.</p>`;

  return `<div class="ci-form">
    <h5>${f.id ? "Arbeitsort bearbeiten" : "Neuer Arbeitsort"}</h5>
    <div class="f-lbl">Name</div>
    <input class="f-in" id="ort_name" value="${escapeHtml(f.name || "")}" placeholder="z.B. Bürogebäude Hafenstraße" />
    <div class="f-lbl">Adresse (oder direkt auf der Karte tippen)</div>
    <input class="f-in" id="ort_adresse" value="${escapeHtml(f.adresse || "")}" placeholder="Straße Nr, PLZ Ort" />
    <div class="map-btns">
      <button class="btn-sec" style="flex:1;" onclick="ciaGeocode()">🔎 Adresse suchen</button>
      <button class="btn-sec" style="flex:1;" onclick="ciaMeinePosition()">📱 Meine Position</button>
    </div>
    <div class="f-lbl">Karte – tippen, um den Pin exakt zu setzen</div>
    <div class="ci-map" id="ciaMap"></div>
    <div class="coords" id="ciaCoords">${f.lat != null ? `✓ Pin gesetzt: ${Number(f.lat).toFixed(5)}, ${Number(f.lng).toFixed(5)}` : "Noch kein Pin gesetzt."}</div>
    <div class="f-lbl">Erlaubter Umkreis (für Ein- UND Auschecken)</div>
    <div class="dayrow" id="ort_radius">
      ${radien.map((r) => `<button type="button" class="dchip ${Number(f.radius) === r ? "on" : ""}" data-r="${r}" onclick="ciaSelRadius(${r})">${r} m</button>`).join("")}
    </div>
    <div class="f-lbl">Feste Zeiten je Wochentag (leer = an dem Tag kein Dienst)</div>
    <div class="az-days">${dayRows}</div>
    <div class="f-lbl">Puffer am Rand (Knopf früher/später nutzbar – zählt NICHT als Zeit)</div>
    <select class="f-in" id="ort_puffer" style="width:auto;">
      ${[0, 5, 10, 15, 30].map((p) => `<option value="${p}" ${Number(f.puffer_min) === p ? "selected" : ""}>± ${p} Min</option>`).join("")}
    </select>
    <div class="f-lbl">Zugewiesene Mitarbeiter (nur diese sehen den Arbeitsort)</div>
    <div class="ort-ma-list">${maList}</div>
    <div class="form-foot">
      <button class="btn-sec" onclick="ciaOrtForm=null;ciaDestroyMap();ciaRender();">Abbrechen</button>
      ${f.id ? `<button class="btn-sec" style="color:var(--red);" onclick="ciaDeleteOrt('${f.id}')">Löschen</button>` : ""}
      <button class="btn-pri" onclick="ciaSaveOrt()">Arbeitsort speichern</button>
    </div>
  </div>`;
}

function ciaOrtDayToggle(wd) {
  const on = document.getElementById(`ortday_${wd}`).checked;
  const von = document.getElementById(`ortvon_${wd}`), bis = document.getElementById(`ortbis_${wd}`);
  // Beim Anhaken sinnvolle Standardzeiten vorschlagen, wenn leer
  if (on && von && !von.value) { von.value = "07:00"; if (bis) bis.value = "16:00"; }
}

async function ciaSaveOrt() {
  const name = (document.getElementById("ort_name").value || "").trim();
  if (!name) { showToast("Bitte einen Namen eintragen"); return; }
  if (ciaOrtForm.lat == null || ciaOrtForm.lng == null) { showToast("Bitte einen Standort setzen (Adresse, Position oder Karte)"); return; }
  const zeiten = {};
  for (let wd = 1; wd <= 7; wd++) {
    const cb = document.getElementById(`ortday_${wd}`);
    if (!cb || !cb.checked) continue;
    const von = (document.getElementById(`ortvon_${wd}`).value || "").trim();
    const bis = (document.getElementById(`ortbis_${wd}`).value || "").trim();
    if (ciTimeToMin(von) == null || ciTimeToMin(bis) == null) { showToast(`Bitte gültige Zeiten für ${CI_TAGE_KURZ[wd - 1]} (z.B. 07:00)`); return; }
    if (ciTimeToMin(bis) <= ciTimeToMin(von)) { showToast(`${CI_TAGE_KURZ[wd - 1]}: Ende muss nach dem Start liegen`); return; }
    zeiten[wd] = { von, bis };
  }
  if (!Object.keys(zeiten).length) { showToast("Bitte für mindestens einen Tag Zeiten eintragen"); return; }
  const maIds = ciaData.mitarbeiter.filter((m) => document.getElementById(`ortma_${m.id}`)?.checked).map((m) => m.id);

  const payload = {
    id: ciaOrtForm.id || genCode(),
    name, adresse: (document.getElementById("ort_adresse").value || "").trim(),
    lat: ciaOrtForm.lat, lng: ciaOrtForm.lng, radius: parseInt(ciaOrtForm.radius, 10) || 100,
    zeiten, puffer_min: parseInt(document.getElementById("ort_puffer").value, 10) || 0,
    mitarbeiter_ids: maIds, aktiv: ciaOrtForm.aktiv !== false,
  };
  const { error } = await sb.from("checkin_orte").upsert(payload);
  if (error) { showToast("Fehler: " + error.message + " (SQL supabase_add_arbeitszeit.sql ausgeführt?)"); return; }
  showToast(maIds.length ? "Arbeitsort gespeichert ✓" : "Gespeichert – aber noch kein Mitarbeiter zugewiesen!");
  ciaOrtForm = null; ciaDestroyMap();
  await ciaLoadBase();
  ciaRender();
}

async function ciaToggleOrt(id, aktiv) {
  const { error } = await sb.from("checkin_orte").update({ aktiv }).eq("id", id);
  if (error) { showToast("Fehler: " + error.message); return; }
  const o = (ciaData.orte || []).find((x) => x.id === id); if (o) o.aktiv = aktiv;
  showToast(aktiv ? "Arbeitsort aktiv" : "Arbeitsort pausiert");
}

async function ciaDeleteOrt(id) {
  if (!confirm("Diesen Arbeitsort wirklich löschen? Bereits erfasste Stunden bleiben in der Auswertung.")) return;
  const { error } = await sb.from("checkin_orte").delete().eq("id", id);
  if (error) { showToast("Fehler: " + error.message); return; }
  showToast("Arbeitsort gelöscht");
  ciaOrtForm = null; ciaDestroyMap();
  await ciaLoadBase();
  ciaRender();
}
