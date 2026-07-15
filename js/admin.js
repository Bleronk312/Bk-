document.title = FIRMA_NAME + " - Abnahmescheine";
document.getElementById("firmaTitle").textContent = FIRMA_NAME + " Abnahmescheine";

function initHeader() {
  const wm = document.getElementById("watermarkImg");
  const badge = document.getElementById("badgeLogoImg");
  if (wm) wm.src = GEKO_LOGO_TRANSPARENT_B64;
  if (badge) badge.src = GEKO_LOGO_TRANSPARENT_B64;
  const greeting = document.getElementById("greetingText");
  if (greeting) {
    const name = typeof GREETING_NAME !== "undefined" ? GREETING_NAME : FIRMA_NAME;
    greeting.innerHTML = `Hallo ${name}! &#128147;`;
  }
}
try { initHeader(); } catch (e) { console.error("Header-Init fehlgeschlagen:", e); }
try { checkPushStatus(); } catch (e) {}
try { autoRenewPushSubscription("graffiti"); } catch (e) {}

function updateHeaderStat(openCount) {
  const stat = document.getElementById("headerStat");
  if (stat) stat.textContent = `${openCount} offene Schein${openCount === 1 ? "" : "e"}`;
}

let scheine = [];
let archivScheine = [];
let kunden = [];
let kategorien = [];
let currentTab = "scheine";
let pendingAnhang = null; // {data, name, type} when a new file was chosen
let removeAnhangFlag = false;
let scheineSearchQuery = "";
let signFormOpen = false;
let materialSurveyOpen = false;
let materialAnsichtOpen = false; // Material-Angaben zuerst ansehen, dann erst bearbeiten
let photoEditOpen = false;
let sigPad = null;
let currentViewScheine = null;

// Hooks für die gemeinsame Foto-Sektion (js/app-shared.js)
function appGetCurrentSchein() { return currentViewScheine; }
function appRerenderDetail() { if (currentViewScheine) renderViewScheine(currentViewScheine); }







function openPhotoEditAdmin() {
  vorherFotos = parsePhotoJson(currentViewScheine.vorher_fotos);
  nachherFotos = parsePhotoJson(currentViewScheine.nachher_fotos);
  photoEditOpen = true;
  renderViewScheine(currentViewScheine);
}

function cancelPhotoEditAdmin() {
  photoEditOpen = false;
  renderViewScheine(currentViewScheine);
}

async function savePhotoEditAdmin(id) {
  const payload = {
    vorher_fotos: vorherFotos.length ? JSON.stringify(vorherFotos) : null,
    nachher_fotos: nachherFotos.length ? JSON.stringify(nachherFotos) : null,
  };

  const { error } = await sb.from("scheine").update(payload).eq("id", id);
  if (error) {
    showToast("Fehler beim Speichern: " + error.message);
    return;
  }

  Object.assign(currentViewScheine, payload);
  photoEditOpen = false;
  showToast("Gespeichert");
  renderViewScheine(currentViewScheine);
}


// Speichert Vorher-/Nachher-Fotos sofort auf dem aktuellen Schein, damit sie nicht verloren
// gehen, wenn man die Seite verlässt bevor unterschrieben wurde.







function openBase64File(dataUrl, filename) {
  try {
    const [header, base64] = dataUrl.split(",");
    const mimeMatch = header.match(/data:([^;]+);base64/);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    showToast("Datei konnte nicht geöffnet werden");
  }
}

function openAttachmentFileAdmin() {
  if (!currentViewScheine || !currentViewScheine.anhang) return;
  openBase64File(currentViewScheine.anhang, currentViewScheine.anhang_name || "anhang.pdf");
}


function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `(${d}.${m}.${y})`;
}

function todayIso() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ---------- Login ----------

async function showApp() {
  await Promise.all([loadKundenData(), loadKategorienData()]);
  // Deep-Link aus dem Glas-Kalender: admin.html#/schein/<id> öffnet direkt den Schein.
  const m = (location.hash || "").match(/#\/schein\/(.+)$/);
  if (m) { openEdit(decodeURIComponent(m[1])); return; }
  switchTab("scheine");
}
window.addEventListener("hashchange", () => {
  const m = (location.hash || "").match(/#\/schein\/(.+)$/);
  if (m) openEdit(decodeURIComponent(m[1]));
});

showApp();

// ---------- Tabs ----------

function switchTab(tab) {
  currentTab = tab;
  ["scheine", "kunden", "kategorien", "statistik", "archiv"].forEach((t) => {
    document.getElementById("tab-" + t).classList.toggle("active", t === tab);
  });
  if (tab === "scheine") loadScheineList();
  if (tab === "kunden") renderKundenList();
  if (tab === "kategorien") renderKategorienList();
  if (tab === "statistik") loadStatistik();
  if (tab === "archiv") loadArchivList();
}

// ---------- Week grouping helper ----------

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function groupByWeek(items, dateField) {
  const now = new Date();
  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);

  const groups = { "Diese Woche": [], "Letzte Woche": [], "Älter": [] };
  items.forEach((item) => {
    const d = new Date(item[dateField]);
    if (d >= thisWeekStart) groups["Diese Woche"].push(item);
    else if (d >= lastWeekStart) groups["Letzte Woche"].push(item);
    else groups["Älter"].push(item);
  });

  function sortByTermin(arr) {
    return arr.sort((a, b) => {
      if (a.termin && b.termin) return new Date(a.termin) - new Date(b.termin);
      if (a.termin && !b.termin) return -1;
      if (!a.termin && b.termin) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }
  groups["Diese Woche"] = sortByTermin(groups["Diese Woche"]);
  groups["Letzte Woche"] = sortByTermin(groups["Letzte Woche"]);
  groups["Älter"] = sortByTermin(groups["Älter"]);

  return groups;
}

// ---------- Scheine ----------

async function loadScheineList() {
  const view = document.getElementById("view");
  view.innerHTML = `<p class="muted"><span class="spinner"></span>Lade...</p>`;
  const { data, error } = await sb.from("scheine")
    .select("id, kunde, adresse, ansprechpartner, telefon, kategorie, leistungen, monat, kdnr, datum, unterschrift_name, anhang_name, anhang_type, interne_notiz, created_at, signed_at, termin, archiviert, material_erfasst, material_stunden, material_graffiti_ex_spray, material_graffiti_gel, material_paint_cleaner, material_streichen, material_hochdruck, material_sandstrahl, material_freitext")
    .eq("archiviert", false)
    .order("created_at", { ascending: false });
  if (error) {
    view.innerHTML = `<div class="card"><p style="color:#c0392b;">Fehler beim Laden: ${error.message}</p><p class="muted">Prüfe, ob js/config.js korrekt mit deinen Supabase-Daten gefüllt ist, und ob das Migrations-SQL (supabase_update.sql) ausgeführt wurde.</p></div>`;
    return;
  }
  scheine = data || [];
  renderScheineList();
}

async function loadArchivList() {
  const view = document.getElementById("view");
  view.innerHTML = `<p class="muted"><span class="spinner"></span>Lade...</p>`;
  const { data, error } = await sb.from("scheine")
    .select("id, kunde, adresse, ansprechpartner, telefon, kategorie, leistungen, monat, kdnr, datum, unterschrift_name, anhang_name, anhang_type, interne_notiz, created_at, signed_at, termin, archiviert, material_erfasst, material_stunden, material_graffiti_ex_spray, material_graffiti_gel, material_paint_cleaner, material_streichen, material_hochdruck, material_sandstrahl, material_freitext")
    .eq("archiviert", true)
    .order("signed_at", { ascending: false });
  if (error) {
    view.innerHTML = `<div class="card"><p style="color:#c0392b;">Fehler beim Laden: ${error.message}</p></div>`;
    return;
  }
  archivScheine = data || [];
  renderArchivList();
}

async function fetchFullScheine(id) {
  const { data, error } = await sb.from("scheine").select("*").eq("id", id).maybeSingle();
  if (error) {
    showToast("Fehler: " + error.message);
    return null;
  }
  return data;
}

function matchesSearch(s, query) {
  if (!query) return true;
  const haystack = [s.kunde, s.adresse, s.kategorie, s.ansprechpartner, s.kdnr].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

// Beim Tippen wird nur die Trefferliste unterhalb des Suchfelds neu gebaut - das Feld
// selbst bleibt unangetastet, Fokus und Tastatur springen nicht mehr.
function onScheineSearchInput(value) {
  scheineSearchQuery = value;
  const box = document.getElementById("scheineListResults");
  if (box) box.innerHTML = renderScheineListResults();
  else renderScheineList();
}

function renderScheineListResults() {
  const filtered = scheine.filter((s) => matchesSearch(s, scheineSearchQuery));
  const open = filtered.filter((s) => !s.signed_at);
  const signed = filtered.filter((s) => s.signed_at).sort((a, b) => new Date(b.signed_at) - new Date(a.signed_at));
  const groups = groupByWeek(open, "created_at");

  let html = `
    <p class="muted" style="margin:0 0 10px;">${filtered.length} von ${scheine.length} Schein(en)</p>
  `;
  let any = false;
  for (const [label, items] of Object.entries(groups)) {
    if (!items.length) continue;
    any = true;
    html += `<div class="week-heading">${label}</div><div class="card" style="padding:6px 20px;">`;
    html += items.map(renderScheineItem).join("");
    html += `</div>`;
  }
  if (signed.length) {
    any = true;
    html += `<div class="week-heading">Unterschriebene Scheine</div><div class="card" style="padding:6px 20px;">`;
    html += signed.map(renderScheineItem).join("");
    html += `</div>`;
  }
  if (!any) {
    html += `<div class="card"><div class="empty-state">${scheineSearchQuery ? "Keine Treffer für diese Suche." : "Noch keine Abnahmescheine.<br>Lege oben den ersten an."}</div></div>`;
  }
  return html;
}

function renderScheineList() {
  const view = document.getElementById("view");
  const allOpenCount = scheine.filter((s) => !s.signed_at).length;
  updateHeaderStat(allOpenCount);

  view.innerHTML = `
    <div style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:14px; gap:8px;">
      <button class="btn btn-sm" onclick="loadScheineList()" title="Aktualisieren">🔄</button>
      <button class="btn btn-primary" onclick="openEdit(null)">+ Neuer Schein</button>
    </div>
    <div class="field">
      <input type="text" id="scheineSearchInput" placeholder="Suche nach Kunde, Adresse, Kategorie..." value="${escapeHtml(scheineSearchQuery)}" oninput="onScheineSearchInput(this.value)" />
    </div>
    <div id="scheineListResults">${renderScheineListResults()}</div>
  `;
}


function renderScheineItem(s) {
  const signed = !!s.signed_at;
  return `
    <div class="scheine-item">
      <div class="ribbon ${signed ? "ribbon-done" : "ribbon-open"}">${signed ? "ERLEDIGT" : "OFFEN"}</div>
      <div class="scheine-item-content" style="flex:1; min-width:0;">
        <div style="font-weight:600; font-size:14.5px;">${escapeHtml(firstLine(s.kunde)) || "(ohne Kunde)"}</div>
        <div class="muted">${escapeHtml(firstLine(s.adresse))}</div>
        <div class="muted">${escapeHtml(s.kategorie || "")}</div>
        <div style="margin-top:6px;">
          ${s.termin ? `<span class="badge" style="background:#eaf3fb; color:#1f5d92;">📅 ${formatTermin(s.termin)}</span>` : ""}
          ${s.anhang_name ? `<span class="badge" style="background:#eef2f7; color:#475569;">📎 Anhang</span>` : ""}
          ${s.interne_notiz ? `<span class="badge" style="background:#fff4e0; color:#8a5a07;">📝 Notiz</span>` : ""}
          ${signed && !s.material_erfasst ? `<span class="badge" style="background:#fff8ec; color:#8a5a07;">📦 Material offen</span>` : ""}
        </div>
        <div class="scheine-actions">
          <button class="btn btn-sm" onclick="openView('${s.id}')">Öffnen</button>
          <button class="btn btn-sm" onclick="openEdit('${s.id}')">Bearbeiten</button>
          <button class="btn btn-sm" onclick="duplicateSchein('${s.id}')">⧉ Duplizieren</button>
          <button class="btn btn-sm" onclick="downloadPdf('${s.id}')">PDF</button>
          <button class="btn btn-sm" onclick="sharePdf('${s.id}')">Teilen</button>
          ${signed ? `<button class="btn btn-sm" onclick="archiveScheine('${s.id}')">Archivieren</button>` : ""}
          <button class="btn btn-sm btn-danger" onclick="deleteScheine('${s.id}')">Löschen</button>
        </div>
      </div>
    </div>
  `;
}

async function loadKundenData() {
  const { data, error } = await sb.from("kunden").select("*").order("name", { ascending: true });
  // Kunden sind nach Bereich getrennt: hier nur Graffiti (+ "beide"); Altbestand ohne
  // Bereich-Spalte (SQL noch nicht ausgeführt) bleibt überall sichtbar.
  if (!error) kunden = (data || []).filter((k) => !k.bereich || k.bereich === "graffiti" || k.bereich === "beide");
}

async function loadKategorienData() {
  const { data, error } = await sb.from("kategorien").select("*").order("name", { ascending: true });
  if (!error) kategorien = data || [];
}

async function openView(id) {
  signFormOpen = false;
  materialSurveyOpen = false;
  materialAnsichtOpen = false;
  photoEditOpen = false;
  vorherFotos = [];
  nachherFotos = [];
  currentViewScheine = null;

  const light = scheine.find((x) => x.id === id) || archivScheine.find((x) => x.id === id);

  if (light) {
    renderViewScheine({ ...light });

    const { data, error } = await sb.from("scheine")
      .select("anhang, anhang_name, anhang_type, unterschrift, vorher_fotos, nachher_fotos")
      .eq("id", id)
      .maybeSingle();

    if (!error && data && currentViewScheine && currentViewScheine.id === id) {
      const merged = { ...light, ...data };
      // Bereits zwischengespeicherte Vorher-/Nachher-Fotos in die Bearbeitungs-Arrays laden,
      // sonst wirken sie beim erneuten Öffnen verloren (und würden beim nächsten Speichern
      // sogar überschrieben).
      if (!merged.signed_at) {
        vorherFotos = parsePhotoJson(merged.vorher_fotos);
        nachherFotos = parsePhotoJson(merged.nachher_fotos);
      }
      if (!signFormOpen) renderViewScheine(merged);
      else currentViewScheine = merged;
    }
    return;
  }

  document.getElementById("view").innerHTML = `<p class="muted"><span class="spinner"></span>Lade...</p>`;
  const full = await fetchFullScheine(id);
  if (!full) { showToast("Fehler beim Laden"); switchTab("scheine"); return; }
  renderViewScheine(full);
}

function renderViewScheine(s) {
  currentViewScheine = s;
  const leistungenList = (s.leistungen || "").split("\n").filter((l) => l.trim())
    .map((l) => `<li>${escapeHtml(l.trim())}</li>`).join("");
  const signed = !!s.signed_at;

  let anhangHtml = "";
  if (s.anhang_name || s.anhang_type) {
    if (!s.anhang) {
      anhangHtml = `
        <div class="card">
          <div class="muted" style="margin-bottom:6px;">Anhang</div>
          <p class="muted" style="margin:0;">Lade...</p>
        </div>
      `;
    } else {
      const isImg = (s.anhang_type || "").startsWith("image/");
      anhangHtml = `
        <div class="card">
          <div class="muted" style="margin-bottom:6px;">Anhang</div>
          ${isImg
            ? `<img src="${s.anhang}" style="max-width:100%; border-radius:8px; border:1px solid var(--border);" />`
            : `<button class="btn btn-sm" onclick="openAttachmentFileAdmin()">📎 ${escapeHtml(s.anhang_name || "Anhang öffnen")}</button>`}
        </div>
      `;
    }
  }

  document.getElementById("view").innerHTML = `
    <button class="btn btn-sm" onclick="switchTab('scheine')" style="margin-bottom:14px;">&larr; Zurück</button>

    <div class="card">
      <div class="muted" style="font-size:12px; margin-bottom:10px;">${escapeHtml(firstLine(s.kunde))}</div>

      <div class="muted" style="margin-bottom:2px;">Objekt</div>
      <div class="highlight-box" style="white-space:pre-line;">${escapeHtml(s.adresse)}</div>
      <a href="${mapsLink(s.adresse)}" target="_blank" rel="noopener"><button class="btn btn-sm" style="margin-bottom:12px;">🧭 Route (Google Maps)</button></a>
      <a href="${wazeLink(s.adresse)}" target="_blank" rel="noopener"><button class="btn btn-sm" style="margin-bottom:12px;">🚗 Route (Waze)</button></a>

      ${s.ansprechpartner ? `<div class="muted" style="margin-bottom:2px;">Ansprechpartner vor Ort</div><div class="highlight-box">${escapeHtml(s.ansprechpartner)}${s.telefon ? " &middot; " + escapeHtml(s.telefon) : ""}</div>${s.telefon ? `<a href="${telLink(s.telefon)}"><button class="btn btn-sm" style="margin-bottom:12px;">📞 Anrufen</button></a>` : ""}` : ""}

      ${s.termin ? `<div class="muted" style="margin-bottom:2px;">Termin</div><div class="highlight-box">📅 ${formatTermin(s.termin)}</div>` : ""}

      <div class="divider"></div>

      <div style="font-weight:600; margin-bottom:8px;">${escapeHtml(s.kategorie || "")}</div>
      <div class="muted" style="margin-bottom:6px;">${escapeHtml(s.monat || "")}${s.kdnr ? " &middot; Kd.-Nr. " + escapeHtml(s.kdnr) : ""}</div>
      <ul class="bullet-list">${leistungenList}</ul>
    </div>

    ${s.interne_notiz ? `
      <div class="card glas-warncard" style="">
        <div style="font-weight:600; font-size:13px; color:#8a5a07; margin-bottom:4px;">📝 Interne Notiz</div>
        <div style="white-space:pre-line; font-size:14px;">${escapeHtml(s.interne_notiz)}</div>
      </div>
    ` : ""}

    ${anhangHtml}

    <div class="card">
      <p style="margin:0 0 8px;"><span class="badge ${signed ? "badge-signed" : "badge-open"}">${signed ? "Unterschrieben " + formatDate(s.datum) : "Offen"}</span></p>
      ${signed && s.unterschrift_name ? `<p class="muted" style="margin:0 0 8px;">Von: ${escapeHtml(s.unterschrift_name)}</p>` : ""}
      ${signed ? (s.unterschrift ? `<img src="${s.unterschrift}" style="max-width:100%; border:1px solid var(--border); border-radius:8px;" />` : `<p class="muted">Lade Unterschrift...</p>`) : ""}
    </div>

    ${signed && photoEditOpen ? `
      <div id="photoSectionWrap">${renderPhotoSection()}</div>
      <div style="display:flex; gap:8px; margin-bottom:14px;">
        <button class="btn btn-sm" onclick="cancelPhotoEditAdmin()">Abbrechen</button>
        <button class="btn btn-primary" style="flex:1;" onclick="savePhotoEditAdmin('${s.id}')">Fotos speichern</button>
      </div>
    ` : ""}
    ${signed && !photoEditOpen ? renderPhotoGallery("Vorher-Fotos", s.vorher_fotos) : ""}
    ${signed && !photoEditOpen ? renderPhotoGallery("Nachher-Fotos", s.nachher_fotos) : ""}
    ${signed && !photoEditOpen ? `<button class="btn btn-sm" onclick="openPhotoEditAdmin()" style="margin-bottom:14px;">📷 Fotos bearbeiten</button>` : ""}
    ${materialSurveyOpen ? renderMaterialSurvey(s) : !s.material_erfasst ? `
      <div class="material-reminder">
        <span>📦 Material eintragen (jederzeit möglich)</span>
        <button class="btn btn-sm" onclick="openMaterialSurvey()">Jetzt eintragen</button>
      </div>
    ` : materialAnsichtOpen ? renderMaterialAnzeige(s) : `
      <button class="btn btn-sm" onclick="openMaterialAnsicht()" style="margin-bottom:14px;">📦 Material-Angaben ansehen</button>
    `}
    ${signed && (s.vorher_fotos || s.nachher_fotos) ? `
      <div class="scheine-actions" style="margin-bottom:14px;">
        <button class="btn btn-sm" onclick="downloadPhotosPdf('${s.id}')">Fotos als PDF speichern</button>
        <button class="btn btn-sm" onclick="sharePhotosPdf('${s.id}')">Fotos als PDF teilen</button>
      </div>
    ` : ""}

    ${!signed ? `<div id="photoSectionWrap">${renderPhotoSection()}</div>` : ""}

    ${!signed && signFormOpen ? `
      <div class="card" id="signForm">
        <h2>Abnahme bestätigen</h2>
        <div class="field">
          <label>Name der unterschreibenden Person</label>
          <input type="text" id="f_name" placeholder="Vor- und Nachname" />
        </div>
        <div class="field">
          <label>Datum</label>
          <input type="date" id="f_datum" value="${todayIso()}" />
        </div>
        <label>Unterschrift</label>
        <div class="sig-pad-wrap">
          <canvas id="sigCanvas"></canvas>
        </div>
        <div style="display:flex; gap:8px; margin-top:8px; margin-bottom:16px;">
          <button class="btn btn-sm" onclick="clearSig()">Löschen</button>
          <button class="btn btn-sm" onclick="cancelSignFormAdmin()">Abbrechen</button>
        </div>
        <div class="field">
          <label>Schein sofort per E-Mail senden an (optional)</label>
          <input type="email" id="f_email" placeholder="kunde@firma.de – leer lassen = kein Versand" />
        </div>
        <button class="btn btn-primary btn-block" onclick="saveSignatureAdmin('${s.id}')">Speichern</button>
      </div>
    ` : ""}

    ${!signed && !signFormOpen ? `
      <button class="btn btn-primary btn-block" onclick="openSignFormAdmin()" style="margin-bottom:14px;">Jetzt unterschreiben</button>
    ` : ""}

    <div class="scheine-actions" style="margin-top:4px;">
      ${s.archiviert ? `
        <button class="btn btn-sm" onclick="downloadPdf('${s.id}')">PDF</button>
        <button class="btn btn-sm" onclick="sharePdf('${s.id}')">Teilen</button>
        <button class="btn btn-sm" onclick="duplicateSchein('${s.id}')">⧉ Duplizieren</button>
        <button class="btn btn-primary" onclick="restoreScheine('${s.id}')">Wiederherstellen</button>
      ` : `
        <button class="btn btn-primary" onclick="openEdit('${s.id}')">Bearbeiten</button>
        <button class="btn btn-sm" onclick="duplicateSchein('${s.id}')">⧉ Duplizieren</button>
        <button class="btn btn-sm" onclick="downloadPdf('${s.id}')">PDF</button>
        <button class="btn btn-sm" onclick="sharePdf('${s.id}')">Teilen</button>
        ${signed ? `<button class="btn btn-sm" onclick="archiveScheine('${s.id}')">Archivieren</button>` : ""}
        <button class="btn btn-sm btn-danger" onclick="deleteScheine('${s.id}')">Löschen</button>
      `}
    </div>
  `;

  if (!signed && signFormOpen) setupSigPad();
}

function openSignFormAdmin() {
  signFormOpen = true;
  renderViewScheine(currentViewScheine);
}

function cancelSignFormAdmin() {
  signFormOpen = false;
  renderViewScheine(currentViewScheine);
}



function setupSigPad() {
  const canvas = document.getElementById("sigCanvas");
  if (!canvas) return;
  resizeCanvas(canvas);
  sigPad = new SignaturePad(canvas, { minWidth: 0.8, maxWidth: 2.2 });
}

function resizeCanvas(canvas) {
  const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  canvas.getContext("2d").scale(ratio, ratio);
  if (sigPad) sigPad.clear();
}

function clearSig() {
  if (sigPad) sigPad.clear();
}

async function saveSignatureAdmin(id) {
  const name = document.getElementById("f_name").value.trim();
  const datum = document.getElementById("f_datum").value;
  if (!name) { showToast("Bitte Namen der unterschreibenden Person eintragen"); return; }
  if (!datum) { showToast("Bitte ein Datum wählen"); return; }
  if (!sigPad || sigPad.isEmpty()) { showToast("Bitte unterschreiben"); return; }

  const unterschrift = sigPad.toDataURL("image/png");
  const versandEmail = document.getElementById("f_email")?.value.trim() || "";
  const payload = {
    datum,
    unterschrift,
    unterschrift_name: name,
    signed_at: new Date().toISOString(),
  };
  if (vorherFotos.length) payload.vorher_fotos = JSON.stringify(vorherFotos);
  if (nachherFotos.length) payload.nachher_fotos = JSON.stringify(nachherFotos);

  gekoCleanPayload(payload);
  const { error } = await sb.from("scheine").update(payload).eq("id", id);

  if (error) { showToast("Fehler: " + error.message); return; }
  showToast("Gespeichert");
  signFormOpen = false;

  const idx = scheine.findIndex((x) => x.id === id);
  if (idx >= 0) {
    scheine[idx] = { ...scheine[idx], ...payload };
  }

  await openView(id);
  materialSurveyOpen = true;
  renderViewScheine(currentViewScheine);

  // Optionaler Sofort-Versand des unterschriebenen Scheins
  if (versandEmail && currentViewScheine) {
    const doc = generatePdf(currentViewScheine);
    await sendScheinPerMail(versandEmail, doc, `Abnahmeschein_${sanitizeFilenamePart(firstLine(currentViewScheine.adresse)) || "Schein"}.pdf`);
  }
}

// Einen bestehenden Schein (fertig, archiviert oder unfertig) duplizieren: öffnet direkt
// das Bearbeiten-Formular mit übernommenem Kunde/Objekt/Leistung, aber frischer ID und
// OHNE Unterschrift/Fotos/Material - gespeichert wird ein komplett neuer Schein.
async function duplicateSchein(id) {
  showToast("Wird dupliziert...");
  const s = await fetchFullScheine(id);
  if (!s) { showToast("Schein nicht gefunden"); return; }
  openEdit(null, {
    id: genCode(),
    kunde: s.kunde || "",
    adresse: s.adresse || "",
    ansprechpartner: s.ansprechpartner || "",
    telefon: s.telefon || "",
    kategorie: s.kategorie || "",
    leistungen: s.leistungen || "",
    monat: aktuellerMonatName(), // durchzuführender Monat = jetzt
    kdnr: s.kdnr || "",
    interne_notiz: s.interne_notiz || "",
    anhang: null, anhang_name: null, anhang_type: null,
  });
}

// Aktueller Monatsname auf Deutsch, z.B. "Juli" - für den Vorschlag beim neuen Schein.
function aktuellerMonatName() {
  return ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"][new Date().getMonth()];
}

async function openEdit(id, prefill) {
  pendingAnhang = null;
  removeAnhangFlag = false;

  let s;
  if (id) {
    document.getElementById("view").innerHTML = `<p class="muted"><span class="spinner"></span>Lade...</p>`;
    s = await fetchFullScheine(id);
    if (!s) { switchTab("scheine"); return; }
  } else if (prefill) {
    // Duplikat: Kunde/Objekt/Leistung sind schon hinterlegt, der Rest ist frei bearbeitbar
    s = prefill;
  } else {
    s = {
      id: genCode(), kunde: "", adresse: "", ansprechpartner: "", telefon: "",
      // Durchzuführender Monat = automatisch der Monat, in dem der Schein erstellt wird
      kategorie: "", leistungen: "", monat: aktuellerMonatName(), kdnr: "", anhang: null, anhang_name: null, interne_notiz: "",
    };
  }

  const kundenOptions = kunden.map((k) => {
    const addressHint = firstLine(k.adresse);
    const label = addressHint ? `${k.name} – ${addressHint}` : k.name;
    return `<option value="${k.id}">${escapeHtml(label)}</option>`;
  }).join("");
  const kategorienOptions = kategorien.map((k) => `<option value="${escapeHtml(k.name)}">${escapeHtml(k.name)}</option>`).join("");

  // Termin für den einfacheren Datum-/Zeit-Picker in Datum + Uhrzeit aufteilen (lokal).
  const _pad = (n) => String(n).padStart(2, "0");
  const _tdt = s.termin ? new Date(s.termin) : null;
  const terminDatum = _tdt && !isNaN(_tdt.getTime()) ? `${_tdt.getFullYear()}-${_pad(_tdt.getMonth() + 1)}-${_pad(_tdt.getDate())}` : "";
  const terminZeit = _tdt && !isNaN(_tdt.getTime()) ? `${_pad(_tdt.getHours())}:${_pad(_tdt.getMinutes())}` : "";

  document.getElementById("view").innerHTML = `
    <button class="btn btn-sm" onclick="switchTab('scheine')" style="margin-bottom:14px;">&larr; Zurück</button>
    <div class="card">
      <h2>${id ? "Schein bearbeiten" : prefill ? "Abnahmeschein duplizieren" : "Neuer Abnahmeschein"}</h2>
      ${prefill ? `<p class="muted" style="margin:-6px 0 12px;">Kunde &amp; Objektadresse sind übernommen. Alles andere kannst du anpassen – gespeichert wird ein neuer, noch nicht unterschriebener Schein.</p>` : ""}

      ${kunden.length ? `
      <div class="field">
        <label>Gespeicherten Kunden wählen (optional)</label>
        <select id="kundenSelect" onchange="applyKundeSelection()">
          <option value="">— Kunde auswählen —</option>
          ${kundenOptions}
        </select>
      </div>` : ""}

      <div class="field">
        <label>Kunde (mehrzeilig möglich)</label>
        <textarea id="f_kunde" rows="3" placeholder="Landeshauptstadt Düsseldorf&#10;OE-23331&#10;40213 Düsseldorf">${escapeHtml(s.kunde)}</textarea>
      </div>

      <div class="field">
        <label>Objektadresse (mehrzeilig möglich)</label>
        <textarea id="f_adresse" rows="2" placeholder="Friedrichstraße 127&#10;40217 Düsseldorf">${escapeHtml(s.adresse)}</textarea>
      </div>

      <div class="row">
        <div class="field">
          <label>Ansprechpartner vor Ort</label>
          <input id="f_ansprechpartner" value="${escapeHtml(s.ansprechpartner)}" placeholder="Frau Mustermann" />
        </div>
        <div class="field">
          <label>Telefon</label>
          <input id="f_telefon" value="${escapeHtml(s.telefon)}" placeholder="0211 ..." />
        </div>
      </div>

      ${kategorien.length ? `
      <div class="field">
        <label>Gespeicherte Kategorie wählen (optional)</label>
        <select id="kategorieSelect" onchange="applyKategorieSelection()">
          <option value="">— Kategorie auswählen —</option>
          ${kategorienOptions}
        </select>
      </div>` : ""}

      <div class="field">
        <label>Kategorie / Titel</label>
        <input id="f_kategorie" value="${escapeHtml(s.kategorie)}" placeholder="Graffiti-Entfernung" />
      </div>

      <div class="field">
        <label>Termin (optional, falls schon mit dem Ansprechpartner vereinbart)</label>
        <div class="row" style="align-items:flex-end;">
          <div class="field" style="margin:0;">
            <label class="muted" style="font-size:12px;">Datum</label>
            <input type="date" id="f_termin_datum" value="${terminDatum}" onchange="graffitiTerminDatumChanged()" />
          </div>
          <div class="field" style="margin:0; flex:0 0 118px;">
            <label class="muted" style="font-size:12px;">Uhrzeit</label>
            <input type="time" id="f_termin_zeit" value="${terminZeit}" step="300" />
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
          <button type="button" class="btn btn-sm" onclick="graffitiTerminQuick(0)">Heute</button>
          <button type="button" class="btn btn-sm" onclick="graffitiTerminQuick(1)">Morgen</button>
          <button type="button" class="btn btn-sm" onclick="graffitiTerminQuick(7)">+1 Woche</button>
          <button type="button" class="btn btn-sm" onclick="graffitiTerminZeit('08:00')">08:00</button>
          <button type="button" class="btn btn-sm" onclick="graffitiTerminZeit('10:00')">10:00</button>
          <button type="button" class="btn btn-sm" onclick="graffitiTerminZeit('13:00')">13:00</button>
          <button type="button" class="btn btn-sm" onclick="graffitiClearTermin()">✕ Kein Termin</button>
        </div>
      </div>

      <div class="row">
        <div class="field">
          <label>Monat</label>
          <input id="f_monat" value="${escapeHtml(s.monat)}" placeholder="Juni 2026" />
        </div>
        <div class="field">
          <label>Kd.-Nr.</label>
          <input id="f_kdnr" value="${escapeHtml(s.kdnr)}" placeholder="1012" />
        </div>
      </div>

      <div class="field">
        <label>Leistung, die erbracht wird <span style="color:var(--danger);">*</span></label>
        <textarea id="f_leistungen" rows="3" placeholder="z.B. Graffitientfernung an der Hausfassade">${escapeHtml(s.leistungen)}</textarea>
        <p class="muted" style="margin:4px 0 0; font-size:12px;">Pflichtfeld · steht so auf dem Abnahmeschein. Mehrere Zeilen = mehrere Aufzählungspunkte.</p>
      </div>

      <div class="field">
        <label>Interne Notiz (nur für Mitarbeiter sichtbar – erscheint NICHT im PDF, der Kunde sieht das nie)</label>
        <textarea id="f_notiz" rows="3" placeholder="z.B. genauer Ort: Schaufenster links neben dem Eingang">${escapeHtml(s.interne_notiz)}</textarea>
      </div>

      <div class="field">
        <label>Anhang für Mitarbeiter (Foto/PDF, optional – erscheint nicht im PDF, nur in der App)</label>
        <div id="anhangContainer">${renderAnhangPreview(s)}</div>
        <input type="file" id="f_anhang" accept="image/*,application/pdf" style="display:none;" onchange="handleAnhangChange(event)" />
      </div>

      <button class="btn btn-primary btn-block" onclick="saveScheine('${s.id}')">Speichern</button>
    </div>
  `;
}

function renderAnhangPreview(s) {
  if (pendingAnhang) {
    const isImg = pendingAnhang.type.startsWith("image/");
    return `
      <div class="attachment-preview">
        ${isImg ? `<img src="${pendingAnhang.data}" />` : `<div class="file-icon">PDF</div>`}
        <div style="flex:1; font-size:13.5px;">${escapeHtml(pendingAnhang.name)}</div>
        <button class="btn btn-sm" onclick="clearAnhangSelection()">Entfernen</button>
      </div>
    `;
  }
  if (s.anhang && !removeAnhangFlag) {
    const isImg = (s.anhang_type || "").startsWith("image/");
    return `
      <div class="attachment-preview">
        ${isImg ? `<img src="${s.anhang}" />` : `<div class="file-icon">PDF</div>`}
        <div style="flex:1; font-size:13.5px;">${escapeHtml(s.anhang_name || "Anhang")}</div>
        <button class="btn btn-sm" onclick="removeExistingAnhang('${s.id}')">Entfernen</button>
      </div>
    `;
  }
  return `
    <div class="file-input-wrap" id="anhangDrop" onclick="document.getElementById('f_anhang').click()"
      ondragover="graffitiDragOver(event)" ondragleave="graffitiDragLeave(event)" ondrop="graffitiDrop(event)">
      <span class="muted">Klicken oder Datei hierher ziehen – Foto oder PDF (Fotos werden verkleinert, PDF max. 4 MB)</span>
    </div>
  `;
}

/* Drag & Drop für den Anhang (Foto/PDF) */
function graffitiDragOver(e) { e.preventDefault(); e.currentTarget.classList.add("dragover"); }
function graffitiDragLeave(e) { e.currentTarget.classList.remove("dragover"); }
function graffitiDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("dragover");
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) processAnhangFile(f);
}

/* Termin-Picker (Datum + Uhrzeit getrennt, mit Schnellwahl) */
function graffitiTerminQuick(daysAhead) {
  const d = new Date(); d.setDate(d.getDate() + daysAhead);
  const p = (n) => String(n).padStart(2, "0");
  document.getElementById("f_termin_datum").value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  if (!document.getElementById("f_termin_zeit").value) document.getElementById("f_termin_zeit").value = "08:00";
}
function graffitiTerminZeit(t) {
  document.getElementById("f_termin_zeit").value = t;
  const dEl = document.getElementById("f_termin_datum");
  if (!dEl.value) { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); dEl.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
}
function graffitiTerminDatumChanged() {
  const z = document.getElementById("f_termin_zeit");
  if (document.getElementById("f_termin_datum").value && !z.value) z.value = "08:00";
}
function graffitiClearTermin() {
  document.getElementById("f_termin_datum").value = "";
  document.getElementById("f_termin_zeit").value = "";
}
function graffitiTerminFromForm() {
  const d = document.getElementById("f_termin_datum")?.value;
  if (!d) return null;
  const t = document.getElementById("f_termin_zeit")?.value || "08:00";
  const dt = new Date(`${d}T${t}`);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

function compressImageFile(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    reader.readAsDataURL(file);
  });
}

async function handleAnhangChange(e) {
  const file = e.target.files[0];
  if (file) await processAnhangFile(file);
}

async function processAnhangFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    showToast("Nur Fotos oder PDF möglich");
    return;
  }

  if (file.type.startsWith("image/")) {
    if (file.size > 15 * 1024 * 1024) {
      showToast("Bild zu groß (max. 15 MB)");
      return;
    }
    showToast("Bild wird komprimiert...");
    try {
      const compressed = await compressImageFile(file, 1280, 0.78);
      const jpegName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      pendingAnhang = { data: compressed, name: jpegName, type: "image/jpeg" };
      removeAnhangFlag = false;
      document.getElementById("anhangContainer").innerHTML = renderAnhangPreview({});
      showToast("Bild angehängt");
    } catch (err) {
      showToast("Bild konnte nicht verarbeitet werden");
    }
    return;
  }

  if (file.size > 4 * 1024 * 1024) {
    showToast("Datei zu groß (max. 4 MB)");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingAnhang = { data: reader.result, name: file.name, type: file.type };
    removeAnhangFlag = false;
    document.getElementById("anhangContainer").innerHTML = renderAnhangPreview({});
  };
  reader.readAsDataURL(file);
}

function clearAnhangSelection() {
  pendingAnhang = null;
  document.getElementById("f_anhang").value = "";
  document.getElementById("anhangContainer").innerHTML = renderAnhangPreview({});
}

function removeExistingAnhang(id) {
  removeAnhangFlag = true;
  pendingAnhang = null;
  document.getElementById("anhangContainer").innerHTML = renderAnhangPreview({});
}

function applyKundeSelection() {
  const id = document.getElementById("kundenSelect").value;
  if (!id) return;
  const k = kunden.find((x) => x.id === id);
  if (!k) return;
  const combined = [k.name, ...(k.adresse || "").split("\n")].filter((l) => l.trim()).join("\n");
  document.getElementById("f_kunde").value = combined;
  if (k.kdnr) document.getElementById("f_kdnr").value = k.kdnr;
}

function applyKategorieSelection() {
  const val = document.getElementById("kategorieSelect").value;
  if (!val) return;
  document.getElementById("f_kategorie").value = val;
}

async function saveScheine(id) {
  const isNew = !scheine.find((x) => x.id === id);
  const payload = {
    id,
    kunde: document.getElementById("f_kunde").value,
    adresse: document.getElementById("f_adresse").value,
    ansprechpartner: document.getElementById("f_ansprechpartner").value,
    telefon: document.getElementById("f_telefon").value,
    kategorie: document.getElementById("f_kategorie").value,
    termin: graffitiTerminFromForm(),
    monat: document.getElementById("f_monat").value,
    kdnr: document.getElementById("f_kdnr").value,
    leistungen: document.getElementById("f_leistungen").value,
    interne_notiz: document.getElementById("f_notiz").value,
  };

  // Leistung ist Pflichtfeld (steht auf dem Abnahmeschein)
  if (!payload.leistungen.trim()) {
    showToast("Bitte die Leistung eintragen (Pflichtfeld)");
    document.getElementById("f_leistungen")?.focus();
    return;
  }

  // Wurde einem BESTEHENDEN Schein nachträglich ein Anhang hinzugefügt? Dann bekommt
  // der Mitarbeiter unten eine Benachrichtigung, damit er den Anhang mitbekommt.
  const anhangNachtraeglich = !isNew && !!pendingAnhang;

  if (pendingAnhang) {
    payload.anhang = pendingAnhang.data;
    payload.anhang_name = pendingAnhang.name;
    payload.anhang_type = pendingAnhang.type;
  } else if (removeAnhangFlag) {
    payload.anhang = null;
    payload.anhang_name = null;
    payload.anhang_type = null;
  }

  gekoCleanPayload(payload); // NUL/Steuerzeichen aus eingefügtem Text entfernen (sonst DB-Fehler)
  const { error } = await sb.from("scheine").upsert(payload);
  if (error) {
    showToast("Fehler: " + error.message);
    return;
  }
  pendingAnhang = null;
  removeAnhangFlag = false;
  await loadScheineList();
  switchTab("scheine");
  showToast("Gespeichert");

  if (isNew) {
    try {
      sb.functions.invoke("send-push", {
        body: {
          role: "mitarbeiter",
          title: "📋 Neuer Schein verfügbar!",
          body: `${firstLine(payload.adresse) || "Ein neuer Auftrag"} wartet auf dich.`,
          url: "/mitarbeiter.html",
        },
      });
    } catch (e) {}
  } else if (anhangNachtraeglich) {
    try {
      sb.functions.invoke("send-push", {
        body: {
          role: "mitarbeiter",
          title: "📎 Anhang hinzugefügt",
          body: `${firstLine(payload.adresse) || "Ein Schein"}: Es wurde ein Anhang ergänzt – schau in die App.`,
          url: "/mitarbeiter.html",
        },
      });
    } catch (e) {}
  }
}



function customConfirm(title, message, confirmLabel, onConfirm, danger) {
  const existing = document.getElementById("customConfirmOverlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.id = "customConfirmOverlay";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      <div class="modal-actions">
        <button class="btn" id="customConfirmCancel">Abbrechen</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="customConfirmOk">${escapeHtml(confirmLabel)}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("customConfirmCancel").onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  document.getElementById("customConfirmOk").onclick = () => {
    overlay.remove();
    onConfirm();
  };
}

async function deleteScheine(id) {
  customConfirm(
    "Schein löschen",
    "Diesen Abnahmeschein wirklich löschen? Das kann nicht rückgängig gemacht werden.",
    "Löschen",
    async () => {
      const { error } = await sb.from("scheine").delete().eq("id", id);
      if (error) { showToast("Fehler: " + error.message); return; }
      await loadScheineList();
      showToast("Gelöscht");
    },
    true
  );
}

async function archiveScheine(id) {
  const { error } = await sb.from("scheine").update({ archiviert: true }).eq("id", id);
  if (error) { showToast("Fehler: " + error.message); return; }
  await loadScheineList();
  showToast("Archiviert");
}

async function restoreScheine(id) {
  const { error } = await sb.from("scheine").update({ archiviert: false }).eq("id", id);
  if (error) { showToast("Fehler: " + error.message); return; }
  await loadArchivList();
  showToast("Wiederhergestellt");
}

function renderArchivList() {
  const view = document.getElementById("view");
  const items = archivScheine.map((s) => `
    <div class="scheine-item">
      <div class="ribbon ribbon-done">ERLEDIGT</div>
      <div class="scheine-item-content" style="flex:1; min-width:0;">
        <div style="font-weight:600; font-size:14.5px;">${escapeHtml(firstLine(s.kunde)) || "(ohne Kunde)"}</div>
        <div class="muted">${escapeHtml(firstLine(s.adresse))}</div>
        <div class="muted">${escapeHtml(s.kategorie || "")}</div>
        <div class="scheine-actions">
          <button class="btn btn-sm" onclick="openView('${s.id}')">Öffnen</button>
          <button class="btn btn-sm" onclick="downloadPdf('${s.id}')">PDF</button>
          <button class="btn btn-sm" onclick="restoreScheine('${s.id}')">Wiederherstellen</button>
        </div>
      </div>
    </div>
  `).join("");

  view.innerHTML = `
    <p class="muted" style="margin:0 0 14px;">${archivScheine.length} archivierte(r) Schein(e)</p>
    <div class="card" style="padding:6px 20px;">
      ${items || `<div class="empty-state">Noch keine archivierten Scheine.</div>`}
    </div>
  `;
}

async function sharePdf(id) {
  showToast("PDF wird erstellt...");
  const s = await fetchFullScheine(id);
  if (!s) return;
  const doc = generatePdf(s);
  const strasse = sanitizeFilenamePart(firstLine(s.adresse)) || "Adresse";
  const kdnr = sanitizeFilenamePart(s.kdnr) || "ohneKdNr";
  const name = `Anhang_LN_${kdnr}_${strasse}.pdf`;
  const blob = doc.output("blob");
  const file = new File([blob], name, { type: "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
    } catch (e) {
      // Person hat das Teilen-Menü abgebrochen - kein Fehler
    }
  } else {
    showToast("Teilen wird hier nicht unterstützt - lade die PDF stattdessen herunter");
    doc.save(name);
  }
}

function sanitizeFilenamePart(s) {
  return (s || "").trim().replace(/\s+/g, "_").replace(/[\\/:*?"<>|]/g, "");
}

async function downloadPdf(id) {
  showToast("PDF wird erstellt...");
  const s = await fetchFullScheine(id);
  if (!s) return;
  const doc = generatePdf(s);
  const strasse = sanitizeFilenamePart(firstLine(s.adresse)) || "Adresse";
  const kdnr = sanitizeFilenamePart(s.kdnr) || "ohneKdNr";
  const name = `Anhang_LN_${kdnr}_${strasse}.pdf`;
  doc.save(name);
}

// ---------- Kunden ----------

function renderKundenList() {
  const view = document.getElementById("view");
  const items = kunden.map((k) => `
    <div class="scheine-item">
      <div style="flex:1; min-width:0;">
        <div style="font-weight:600; font-size:14.5px;">${escapeHtml(k.name)}</div>
        <div class="muted" style="white-space:pre-line;">${escapeHtml(k.adresse)}</div>
        ${k.kdnr ? `<div class="muted">Kd.-Nr.: ${escapeHtml(k.kdnr)}</div>` : ""}
        <div class="scheine-actions">
          <button class="btn btn-sm" onclick="openKundeEdit('${k.id}')">Bearbeiten</button>
          <button class="btn btn-sm btn-danger" onclick="deleteKunde('${k.id}')">Löschen</button>
        </div>
      </div>
    </div>
  `).join("");

  view.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
      <p class="muted" style="margin:0;">${kunden.length} Kunde(n)</p>
      <button class="btn btn-primary" onclick="openKundeEdit(null)">+ Neuer Kunde</button>
    </div>
    <div class="card" style="padding:6px 20px;">
      ${items || `<div class="empty-state">Noch keine Kunden angelegt.</div>`}
    </div>
  `;
}

function openKundeEdit(id) {
  const k = id ? kunden.find((x) => x.id === id) : { id: genCode(), name: "", adresse: "", kdnr: "", bereich: "graffiti" };
  document.getElementById("view").innerHTML = `
    <button class="btn btn-sm" onclick="switchTab('kunden')" style="margin-bottom:14px;">&larr; Zurück</button>
    <div class="card">
      <h2>${id ? "Kunde bearbeiten" : "Neuer Kunde"}</h2>
      <div class="field">
        <label>Name</label>
        <input id="k_name" value="${escapeHtml(k.name)}" placeholder="Landeshauptstadt Düsseldorf" />
      </div>
      <div class="field">
        <label>Adresse (mehrzeilig möglich)</label>
        <textarea id="k_adresse" rows="2" placeholder="OE-23331&#10;40213 Düsseldorf">${escapeHtml(k.adresse)}</textarea>
      </div>
      <div class="field">
        <label>Kd.-Nr.</label>
        <input id="k_kdnr" value="${escapeHtml(k.kdnr)}" placeholder="1012" />
      </div>
      <div class="field">
        <label>Bereich (wo dieser Kunde auftaucht)</label>
        <select id="k_bereich" style="width:auto;">
          <option value="graffiti" ${(k.bereich || "graffiti") === "graffiti" ? "selected" : ""}>Graffiti / Sonderreinigung</option>
          <option value="glas" ${k.bereich === "glas" ? "selected" : ""}>Glasreinigung</option>
          <option value="beide" ${k.bereich === "beide" ? "selected" : ""}>Beide Bereiche</option>
        </select>
      </div>
      <button class="btn btn-primary btn-block" onclick="saveKunde('${k.id}')">Speichern</button>
    </div>
  `;
}

async function saveKunde(id) {
  const payload = {
    id,
    name: document.getElementById("k_name").value,
    adresse: document.getElementById("k_adresse").value,
    kdnr: document.getElementById("k_kdnr").value,
    bereich: document.getElementById("k_bereich")?.value || "graffiti",
  };
  const { error } = await sb.from("kunden").upsert(payload);
  if (error) { showToast("Fehler: " + error.message); return; }
  await loadKundenData();
  switchTab("kunden");
  showToast("Gespeichert");
}

async function deleteKunde(id) {
  customConfirm("Kunde löschen", "Diesen Kunden wirklich löschen? Bestehende Scheine bleiben unverändert.", "Löschen", async () => {
    const { error } = await sb.from("kunden").delete().eq("id", id);
    if (error) { showToast("Fehler: " + error.message); return; }
    await loadKundenData();
    renderKundenList();
    showToast("Gelöscht");
  }, true);
}

// ---------- Kategorien ----------

function renderKategorienList() {
  const view = document.getElementById("view");
  const items = kategorien.map((k) => `
    <div class="scheine-item">
      <div style="flex:1; min-width:0;">
        <div style="font-weight:600; font-size:14.5px;">${escapeHtml(k.name)}</div>
        <div class="scheine-actions">
          <button class="btn btn-sm" onclick="openKategorieEdit('${k.id}')">Bearbeiten</button>
          <button class="btn btn-sm btn-danger" onclick="deleteKategorie('${k.id}')">Löschen</button>
        </div>
      </div>
    </div>
  `).join("");

  view.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
      <p class="muted" style="margin:0;">${kategorien.length} Kategorie(n)</p>
      <button class="btn btn-primary" onclick="openKategorieEdit(null)">+ Neue Kategorie</button>
    </div>
    <div class="card" style="padding:6px 20px;">
      ${items || `<div class="empty-state">Noch keine Kategorien angelegt.</div>`}
    </div>
  `;
}

function openKategorieEdit(id) {
  const k = id ? kategorien.find((x) => x.id === id) : { id: genCode(), name: "" };
  document.getElementById("view").innerHTML = `
    <button class="btn btn-sm" onclick="switchTab('kategorien')" style="margin-bottom:14px;">&larr; Zurück</button>
    <div class="card">
      <h2>${id ? "Kategorie bearbeiten" : "Neue Kategorie"}</h2>
      <div class="field">
        <label>Name</label>
        <input id="kat_name" value="${escapeHtml(k.name)}" placeholder="Graffiti-Entfernung" />
      </div>
      <button class="btn btn-primary btn-block" onclick="saveKategorie('${k.id}')">Speichern</button>
    </div>
  `;
}

async function saveKategorie(id) {
  const payload = { id, name: document.getElementById("kat_name").value };
  const { error } = await sb.from("kategorien").upsert(payload);
  if (error) { showToast("Fehler: " + error.message); return; }
  await loadKategorienData();
  switchTab("kategorien");
  showToast("Gespeichert");
}

async function deleteKategorie(id) {
  customConfirm("Kategorie löschen", "Diese Kategorie wirklich löschen?", "Löschen", async () => {
    const { error } = await sb.from("kategorien").delete().eq("id", id);
    if (error) { showToast("Fehler: " + error.message); return; }
    await loadKategorienData();
    renderKategorienList();
    showToast("Gelöscht");
  }, true);
}

// ---------- Statistik ----------

let statsData = [];
let statsPeriod = "woche";

async function loadStatistik() {
  document.getElementById("view").innerHTML = `<p class="muted"><span class="spinner"></span>Lade...</p>`;
  const { data, error } = await sb.from("scheine").select("id, created_at, signed_at").order("created_at", { ascending: true });
  if (error) {
    document.getElementById("view").innerHTML = `<div class="card"><p style="color:#c0392b;">Fehler beim Laden: ${error.message}</p></div>`;
    return;
  }
  statsData = data || [];
  renderStatistik();
}

function periodKeyWeek(dateStr) {
  const d = startOfWeek(new Date(dateStr)); // lokal formatieren, toISOString() wäre UTC (Vortag)
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function periodLabelWeek(key) {
  const start = new Date(key);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

function periodKeyMonth(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function periodLabelMonth(key) {
  const [y, m] = key.split("-");
  const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

function setStatsPeriod(p) {
  statsPeriod = p;
  renderStatistik();
}

function renderStatistik() {
  const total = statsData.length;
  const signed = statsData.filter((s) => s.signed_at).length;
  const open = total - signed;

  const keyFn = statsPeriod === "woche" ? periodKeyWeek : periodKeyMonth;
  const labelFn = statsPeriod === "woche" ? periodLabelWeek : periodLabelMonth;

  const groups = {};
  statsData.forEach((s) => {
    const key = keyFn(s.created_at);
    if (!groups[key]) groups[key] = { total: 0, signed: 0 };
    groups[key].total++;
    if (s.signed_at) groups[key].signed++;
  });

  const sortedKeys = Object.keys(groups).sort().reverse();

  const rows = sortedKeys.map((key) => {
    const g = groups[key];
    return `
      <div class="scheine-item">
        <div style="flex:1;">
          <div style="font-weight:600; font-size:14px;">${labelFn(key)}</div>
          <div class="muted" style="font-size:13px;">${g.total} Schein(e) &middot; ${g.signed} unterschrieben &middot; ${g.total - g.signed} offen</div>
        </div>
      </div>
    `;
  }).join("");

  document.getElementById("view").innerHTML = `
    <div class="row" style="margin-bottom:14px;">
      <div class="card" style="text-align:center;">
        <div class="muted" style="font-size:12px;">Gesamt</div>
        <div style="font-size:22px; font-weight:700;">${total}</div>
      </div>
      <div class="card" style="text-align:center;">
        <div class="muted" style="font-size:12px;">Unterschrieben</div>
        <div style="font-size:22px; font-weight:700; color:#1e7a34;">${signed}</div>
      </div>
      <div class="card" style="text-align:center;">
        <div class="muted" style="font-size:12px;">Offen</div>
        <div style="font-size:22px; font-weight:700; color:#8a5a07;">${open}</div>
      </div>
    </div>

    <div class="tabs" style="margin-bottom:14px;">
      <button class="tab-btn ${statsPeriod === "woche" ? "active" : ""}" onclick="setStatsPeriod('woche')">Pro Woche</button>
      <button class="tab-btn ${statsPeriod === "monat" ? "active" : ""}" onclick="setStatsPeriod('monat')">Pro Monat</button>
    </div>

    <div class="card" style="padding:6px 20px;">
      ${rows || `<div class="empty-state">Noch keine Daten.</div>`}
    </div>
  `;
}

// ---------- Vorher/Nachher Fotos als PDF ----------

function getImageDimensions(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve({ w: 100, h: 100 });
    img.src = src;
  });
}

async function generatePhotosPdf(s) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let vorher = [];
  let nachher = [];
  try { vorher = JSON.parse(s.vorher_fotos || "[]"); } catch (e) {}
  try { nachher = JSON.parse(s.nachher_fotos || "[]"); } catch (e) {}

  const maxW = 180;
  const maxH = 230;
  let first = true;

  const addPhotos = async (arr, label) => {
    for (let i = 0; i < arr.length; i++) {
      if (!first) doc.addPage();
      first = false;
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(`${label} ${i + 1} - ${firstLine(s.adresse) || ""}`, 15, 15);
      // Storage-URLs müssen fürs PDF erst als dataURL geladen werden (Base64-Altbestand
      // kommt unverändert zurück)
      let src = arr[i];
      try { src = await fotoAsDataUrl(src); } catch (e) { continue; }
      const dims = await getImageDimensions(src);
      let w = maxW;
      let h = (dims.h / dims.w) * w;
      if (h > maxH) {
        h = maxH;
        w = (dims.w / dims.h) * h;
      }
      try {
        doc.addImage(src, "JPEG", 15, 25, w, h);
      } catch (e) {}
    }
  };

  await addPhotos(vorher, "Vorher");
  await addPhotos(nachher, "Nachher");
  return doc;
}

async function downloadPhotosPdf(id) {
  const s = currentViewScheine && currentViewScheine.id === id ? currentViewScheine : await fetchFullScheine(id);
  if (!s) return;
  showToast("PDF wird erstellt...");
  const doc = await generatePhotosPdf(s);
  doc.save(fotosPdfName(s));
}

// Dateiname der Vorher-/Nachher-Foto-PDF - beginnt (wie der Abnahmeschein) mit "Anhang".
function fotosPdfName(s) {
  const kdnr = sanitizeFilenamePart(s.kdnr) || "ohneKdNr";
  const strasse = sanitizeFilenamePart(firstLine(s.adresse)) || "Adresse";
  return `Anhang_Fotos_${kdnr}_${strasse}.pdf`;
}

async function sharePhotosPdf(id) {
  const s = currentViewScheine && currentViewScheine.id === id ? currentViewScheine : await fetchFullScheine(id);
  if (!s) return;
  showToast("PDF wird erstellt...");
  const doc = await generatePhotosPdf(s);
  const name = fotosPdfName(s);
  const blob = doc.output("blob");
  const file = new File([blob], name, { type: "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
    } catch (e) {}
  } else {
    showToast("Teilen wird hier nicht unterstützt - lade stattdessen herunter");
    doc.save(name);
  }
}

// ---------- Material-Anzeige (Admin, nur lesend) ----------

const MATERIAL_FULL_CATEGORIES = ["graffitientfernung", "sonderreinigung", "grundreinigung"];

function isFullMaterialCategory(kategorie) {
  return MATERIAL_FULL_CATEGORIES.includes((kategorie || "").trim().toLowerCase());
}

function hourOptions(selected) {
  let html = `<option value="">–</option>`;
  for (let i = 0; i <= 20; i++) {
    const val = (i * 0.5).toFixed(1).replace(".0", "");
    const sel = selected && parseFloat(selected) === i * 0.5 ? "selected" : "";
    html += `<option value="${val}" ${sel}>${val} Std.</option>`;
  }
  return html;
}

function qtyOptions(selected) {
  let html = `<option value="">–</option>`;
  for (let i = 1; i <= 10; i++) {
    const sel = String(selected) === String(i) ? "selected" : "";
    html += `<option value="${i}" ${sel}>${i}</option>`;
  }
  return html;
}

function renderMaterialSurvey(s) {
  const full = isFullMaterialCategory(s.kategorie);
  return `
    <div class="card" id="materialSurvey">
      <h2>Kurze Angaben zum Einsatz</h2>
      <p class="muted" style="margin-top:-4px;">Optional – hilft bei der Material- und Zeitplanung.</p>

      <div class="field">
        <label>Wie viele Stunden war der Mitarbeiter insgesamt vor Ort?</label>
        <select id="m_stunden">${hourOptions(s.material_stunden)}</select>
      </div>

      ${full ? `
        <div class="section-title" style="margin-top:18px;">Materialverbrauch</div>
        <div class="qty-row">
          <span class="qty-label">Graffiti Ex Spray</span>
          <select id="m_ex_spray">${qtyOptions(s.material_graffiti_ex_spray)}</select>
        </div>
        <div class="qty-row">
          <span class="qty-label">Graffiti Gel</span>
          <select id="m_gel">${qtyOptions(s.material_graffiti_gel)}</select>
        </div>
        <div class="qty-row">
          <span class="qty-label">Paint Cleaner</span>
          <select id="m_cleaner">${qtyOptions(s.material_paint_cleaner)}</select>
        </div>

        <div class="section-title" style="margin-top:18px;">Verwendete Geräte</div>
        <label class="check-row">
          <input type="checkbox" id="m_streichen" ${s.material_streichen ? "checked" : ""} />
          <span class="check-label">Streichen mit Farbe</span>
        </label>
        <label class="check-row">
          <input type="checkbox" id="m_hochdruck" ${s.material_hochdruck ? "checked" : ""} />
          <span class="check-label">Hochdruckreiniger</span>
        </label>
        <label class="check-row">
          <input type="checkbox" id="m_sandstrahl" ${s.material_sandstrahl ? "checked" : ""} />
          <span class="check-label">Sandstrahlgerät</span>
        </label>
      ` : `
        <div class="field" style="margin-top:14px;">
          <label>Verwendetes Material (optional)</label>
          <textarea id="m_freitext" rows="2" placeholder="z.B. 2x Reiniger, 1x Lappenpaket">${escapeHtml(s.material_freitext || "")}</textarea>
        </div>
      `}

      <div style="display:flex; gap:8px; margin-top:16px;">
        <button class="btn btn-sm" onclick="skipMaterialSurvey()">Später ausfüllen</button>
        <button class="btn btn-primary" style="flex:1;" onclick="saveMaterialSurvey()">Speichern</button>
      </div>
    </div>
  `;
}

// Read-only Anzeige der Material-Angaben. Erst wenn man sie ansieht, erscheint der
// Bearbeiten-Button (damit man nicht aus Versehen bestehende Angaben überschreibt).
function renderMaterialAnzeige(s) {
  const full = isFullMaterialCategory(s.kategorie);
  const zeile = (label, wert) => `<div style="display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-top:1px solid var(--border); font-size:13.5px;"><span class="muted">${label}</span><span style="font-weight:500; text-align:right;">${wert}</span></div>`;
  const ja = (v) => v ? "Ja" : "–";
  let rows = zeile("Stunden vor Ort", s.material_stunden ? `${escapeHtml(String(s.material_stunden))} Std.` : "–");
  if (full) {
    rows += zeile("Graffiti Ex Spray", s.material_graffiti_ex_spray || "–");
    rows += zeile("Graffiti Gel", s.material_graffiti_gel || "–");
    rows += zeile("Paint Cleaner", s.material_paint_cleaner || "–");
    rows += zeile("Streichen mit Farbe", ja(s.material_streichen));
    rows += zeile("Hochdruckreiniger", ja(s.material_hochdruck));
    rows += zeile("Sandstrahlgerät", ja(s.material_sandstrahl));
  } else if (s.material_freitext) {
    rows += zeile("Verwendetes Material", escapeHtml(s.material_freitext));
  }
  return `
    <div class="card" style="margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <h2 style="margin:0;">📦 Material-Angaben</h2>
        <button class="btn btn-sm" onclick="closeMaterialAnsicht()">Schließen</button>
      </div>
      <div style="margin-top:8px;">${rows}</div>
      <button class="btn btn-primary btn-sm" style="margin-top:14px;" onclick="openMaterialSurvey()">✏️ Bearbeiten</button>
    </div>`;
}

function openMaterialAnsicht() {
  materialAnsichtOpen = true;
  renderViewScheine(currentViewScheine);
}
function closeMaterialAnsicht() {
  materialAnsichtOpen = false;
  renderViewScheine(currentViewScheine);
}

function openMaterialSurvey() {
  materialSurveyOpen = true;
  materialAnsichtOpen = false;
  renderViewScheine(currentViewScheine);
}

function skipMaterialSurvey() {
  materialSurveyOpen = false;
  renderViewScheine(currentViewScheine);
}

async function saveMaterialSurvey() {
  const full = isFullMaterialCategory(currentViewScheine.kategorie);
  const payload = {
    material_erfasst: true,
    material_stunden: document.getElementById("m_stunden").value || null,
  };
  if (full) {
    payload.material_graffiti_ex_spray = document.getElementById("m_ex_spray").value || null;
    payload.material_graffiti_gel = document.getElementById("m_gel").value || null;
    payload.material_paint_cleaner = document.getElementById("m_cleaner").value || null;
    payload.material_streichen = document.getElementById("m_streichen").checked;
    payload.material_hochdruck = document.getElementById("m_hochdruck").checked;
    payload.material_sandstrahl = document.getElementById("m_sandstrahl").checked;
  } else {
    payload.material_freitext = document.getElementById("m_freitext").value || null;
  }

  gekoCleanPayload(payload);
  const { error } = await sb.from("scheine").update(payload).eq("id", currentViewScheine.id);
  if (error) {
    showToast("Fehler beim Speichern: " + error.message);
    return;
  }

  Object.assign(currentViewScheine, payload);
  const listEntry = scheine.find((s) => s.id === currentViewScheine.id);
  if (listEntry) Object.assign(listEntry, payload);

  materialSurveyOpen = false;
  showToast("Gespeichert");
  renderViewScheine(currentViewScheine);
}
