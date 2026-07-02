document.title = (typeof FIRMA_NAME !== "undefined" ? FIRMA_NAME : "GEKO") + " - Glasreinigung";

(function initGlasHeader() {
  const wm = document.getElementById("watermarkImg");
  const badge = document.getElementById("badgeLogoImg");
  if (typeof GEKO_LOGO_TRANSPARENT_B64 !== "undefined") {
    if (wm) wm.src = GEKO_LOGO_TRANSPARENT_B64;
    if (badge) badge.src = GEKO_LOGO_TRANSPARENT_B64;
  }
})();

/* ========================================================================
   State
   ======================================================================== */

let glasKunden = [];
let glasObjekte = [];
let glasObjektPositionen = []; // ALLE Positionen aller Objekte (global geladen, für Fällig-Berechnung)
let glasTouren = [];
let glasPositionen = []; // Leistungsarten-Stammdaten (Reiter "Positionen")

// Aktuelle Ansicht. { type: "tabs", tab: "touren"|"kalender"|"objekte"|"kunden"|"positionen" }
// | { type: "objekt", id } | { type: "kunde", id }
let glasPage = { type: "tabs", tab: "touren" };

let glasObjektEditing = null; // null = keine Bearbeitung, {} = neu, {...} = bestehendes Objekt
let glasObjektSearch = "";
let glasTourSearch = "";
let glasKundenSearch = "";
let glasBusy = false;
let glasProgressText = "";
let glasSelectedObjekte = new Set();
let glasObjektGroupsExpanded = new Set(); // Kunde-Namen, deren Gruppe in der Objekte-Liste aufgeklappt ist
let glasTourGroupsExpanded = new Set();   // Kunde-Namen, deren Gruppe in der Touren-Auswahl aufgeklappt ist
let glasShowNewTourForm = false;
let glasTourDetailId = null;
let glasRoutingMode = "smart"; // "smart" oder "manual"
let glasManualOrder = []; // Array von Objekt-IDs in der vom Admin festgelegten Reihenfolge
let glasPreselectPositionen = null; // Map objekt_id -> Set(position_id), gesetzt beim Sprung aus der Offenen Liste

let glasKundePickerOpen = false;
let glasKundePickerSearch = "";

let glasObjektDetailHistory = {}; // objekt_id -> Array Stopps (Cache)
let glasObjektDetailShowAllHistory = false;

let glasKalenderSub = "kalender"; // "kalender" | "offen"
let glasKalenderMonth = (() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; })();
let glasKalenderSelectedDay = null;
let glasOffeneSearch = "";
let glasOffeneSelected = new Set(); // Set von "objektId::positionId"

let glasShowEinzelschein = false;

/* ========================================================================
   Hilfsfunktionen
   ======================================================================== */

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function formatGlasDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// Adresse wird intern als "Straße Hausnummer\nPLZ Ort" gespeichert (2 Zeilen)
function glasSplitAdresse(adresse) {
  const lines = (adresse || "").split("\n");
  const strasse = lines[0] || "";
  const zweite = lines[1] || "";
  const m = zweite.match(/^(\d{4,5})\s*(.*)$/);
  return { strasse, plz: m ? m[1] : "", ort: m ? m[2] : zweite };
}
function glasJoinAdresse(strasse, plz, ort) {
  return `${strasse.trim()}\n${plz.trim()} ${ort.trim()}`.trim();
}

function matchesSearch(o, q) {
  if (!q) return true;
  const hay = `${o.name} ${o.adresse} ${o.kunde_name} ${o.kdnr}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

/* ========================================================================
   Init & Laden
   ======================================================================== */

async function glasInit() {
  await Promise.all([loadGlasKunden(), loadGlasObjekte(), loadGlasObjektPositionen(), loadGlasTouren(), loadGlasPositionen()]);
  glasPage = glasParseHash();
  window.addEventListener("hashchange", () => { glasPage = glasParseHash(); renderGlasAdmin(); });
  renderGlasAdmin();
}

async function loadGlasPositionen() {
  const { data, error } = await sb.from("glas_positionen").select("*").order("name", { ascending: true });
  if (!error) glasPositionen = data || [];
}

// Liest die Positionen eines Objekts aus dem alten JSON-Feld (Fallback für Objekte, die
// noch nie mit dem neuen Formular gespeichert wurden - siehe glasGetObjektPositionen).
function glasParsePositionen(o) {
  if (o.positionen) {
    try {
      const arr = JSON.parse(o.positionen);
      if (Array.isArray(arr) && arr.length) return arr;
    } catch (e) {}
  }
  if (o.position || o.qm) return [{ nr: o.position || "10", art: "Glas- und Rahmenreinigung", qm: o.qm || "" }];
  return [{ nr: glasPositionen[0]?.nr || "10", art: glasPositionen[0]?.name || "", qm: "" }];
}

// Einheitlicher Zugriff auf die Positionen eines Objekts: bevorzugt die neue Tabelle
// (mit Intervall-Tracking), fällt sonst auf das alte JSON-Feld zurück (ohne Intervall -
// taucht dann einfach nirgends in der Fällig-Liste auf, bis das Objekt einmal im neuen
// Formular gespeichert wird).
function glasGetObjektPositionen(objektId) {
  const rows = glasObjektPositionen.filter((p) => p.objekt_id === objektId).sort((a, b) => a.reihenfolge - b.reihenfolge);
  if (rows.length) return rows;
  const o = glasObjekte.find((x) => x.id === objektId);
  if (!o) return [];
  return glasParsePositionen(o).map((p, i) => ({
    id: null, objekt_id: objektId, nr: p.nr, art: p.art, qm: p.qm,
    intervall_typ: "", intervall_wochen: null, feste_monate: "", letzte_reinigung: null,
    faelligkeit_override: null, reihenfolge: i, _legacy: true,
  }));
}

async function loadGlasKunden() {
  const { data, error } = await sb.from("kunden").select("*").order("name", { ascending: true });
  if (!error) glasKunden = data || [];
}

async function loadGlasObjekte() {
  const { data, error } = await sb.from("glas_objekte").select("*").order("name", { ascending: true });
  if (!error) glasObjekte = data || [];
}

async function loadGlasObjektPositionen() {
  const { data, error } = await sb.from("glas_objekt_positionen").select("*").order("reihenfolge", { ascending: true });
  if (!error) glasObjektPositionen = data || [];
}

async function loadGlasTouren() {
  const { data, error } = await sb
    .from("glas_touren")
    .select("*, glas_stopps(id, status)")
    .order("datum", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60);
  if (!error) glasTouren = data || [];
}

/* ========================================================================
   Routing (einfaches Hash-Routing, damit Objekt-/Kunden-Seiten verlinkbar
   sind und der Zurück-Button des Browsers funktioniert)
   ======================================================================== */

function glasParseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [kind, id] = h.split("/");
  if (kind === "objekt" && id) return { type: "objekt", id };
  if (kind === "kunde" && id) return { type: "kunde", id };
  if (kind === "tab" && id) return { type: "tabs", tab: id };
  return { type: "tabs", tab: "touren" };
}

function glasHashFor(page) {
  if (page.type === "objekt") return `#/objekt/${page.id}`;
  if (page.type === "kunde") return `#/kunde/${page.id}`;
  return `#/tab/${page.tab}`;
}

function glasNavigate(page) {
  glasPage = page;
  const h = glasHashFor(page);
  if (location.hash !== h) location.href = h;
  else renderGlasAdmin();
}

function goGlasObjekt(id) { glasNavigate({ type: "objekt", id }); }
function goGlasKunde(id) { glasNavigate({ type: "kunde", id }); }
function goGlasTab(tab) {
  glasObjektEditing = null;
  glasShowNewTourForm = false;
  glasTourDetailId = null;
  glasPositionEditingId = null;
  glasRoutingMode = "smart";
  glasManualOrder = [];
  glasNavigate({ type: "tabs", tab });
}

/* ========================================================================
   Root-Render
   ======================================================================== */

function renderGlasAdmin() {
  // Falls das Objekt-Formular gerade offen ist und noch im DOM steht, zuerst die
  // eingetippten Werte sichern - sonst würde renderObjektForm() das Formular gleich
  // wieder aus dem (veralteten) glasObjektEditing aufbauen und alles Eingetippte verwerfen.
  if (glasObjektEditing && document.getElementById("o_name")) syncObjektFormFromDom();

  const view = document.getElementById("view");

  if (glasPage.type === "objekt") { view.innerHTML = renderObjektDetailPage(glasPage.id); return; }
  if (glasPage.type === "kunde") { view.innerHTML = renderKundeDetailPage(glasPage.id); return; }

  const tab = glasPage.tab;
  view.innerHTML = `
    <div class="tabs">
      <button class="tab-btn ${tab === "touren" ? "active" : ""}" onclick="goGlasTab('touren')">🚐 Touren</button>
      <button class="tab-btn ${tab === "kalender" ? "active" : ""}" onclick="goGlasTab('kalender')">📅 Kalender</button>
      <button class="tab-btn ${tab === "objekte" ? "active" : ""}" onclick="goGlasTab('objekte')">🏢 Objekte</button>
      <button class="tab-btn ${tab === "kunden" ? "active" : ""}" onclick="goGlasTab('kunden')">👥 Kunden</button>
      <button class="tab-btn ${tab === "positionen" ? "active" : ""}" onclick="goGlasTab('positionen')">📋 Positionen</button>
    </div>
    <div id="glasTabContent"></div>
  `;
  const content = document.getElementById("glasTabContent");
  content.innerHTML =
    tab === "objekte" ? renderObjekteTab() :
    tab === "kunden" ? renderKundenTab() :
    tab === "kalender" ? renderKalenderTab() :
    tab === "positionen" ? renderPositionenTab() :
    renderTourenTab();

  if (tab === "objekte") {
    const searchEl = document.getElementById("obj_search");
    if (searchEl) searchEl.oninput = (e) => { glasObjektSearch = e.target.value; renderGlasAdmin(); focusSearch("obj_search"); };
  }
  if (tab === "kunden") {
    const searchEl = document.getElementById("kunden_search");
    if (searchEl) searchEl.oninput = (e) => { glasKundenSearch = e.target.value; renderGlasAdmin(); focusSearch("kunden_search"); };
  }
  if (tab === "kalender" && glasKalenderSub === "offen") {
    const searchEl = document.getElementById("offen_search");
    if (searchEl) searchEl.oninput = (e) => { glasOffeneSearch = e.target.value; renderGlasAdmin(); focusSearch("offen_search"); };
  }
  if (tab === "touren" && glasShowNewTourForm && !glasTourDetailId) {
    attachGlasCheckboxHandlers();
    const searchEl = document.getElementById("tour_obj_search");
    if (searchEl) searchEl.oninput = (e) => { glasTourSearch = e.target.value; renderGlasAdmin(); focusSearch("tour_obj_search"); };
  }
  if (tab === "touren" && glasShowEinzelschein) {
    const kundeSearchEl = document.getElementById("es_kunde_search");
    if (kundeSearchEl) kundeSearchEl.oninput = (e) => { glasKundePickerSearch = e.target.value; renderGlasAdmin(); focusSearch("es_kunde_search"); };
  }
  if (glasObjektEditing && glasKundePickerOpen) {
    const kpSearchEl = document.getElementById("kp_search");
    if (kpSearchEl) kpSearchEl.oninput = (e) => { glasKundePickerSearch = e.target.value; renderGlasAdmin(); focusSearch("kp_search"); };
  }
}

function focusSearch(id) {
  const el = document.getElementById(id);
  if (el) { el.focus(); const v = el.value; el.value = ""; el.value = v; }
}

/* ========================================================================
   Kunden-Picker (ersetzt das native Dropdown im Objekt-Formular)
   ======================================================================== */

function renderKundePicker(selectedKundeId, selectedKundeName) {
  if (!glasKundePickerOpen) {
    return `
      <div class="card" style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;" onclick="glasKundePickerOpen = true; glasKundePickerSearch = ''; renderGlasAdmin();">
        <div>
          <p class="muted" style="margin:0 0 2px; font-size:12px;">Kunde / Träger</p>
          <p style="margin:0; font-weight:600;">${selectedKundeName ? escapeHtml(selectedKundeName) : "— auswählen —"}</p>
        </div>
        <button class="btn btn-sm" type="button" onclick="event.stopPropagation(); glasKundePickerOpen = true; glasKundePickerSearch = ''; renderGlasAdmin();">Ändern</button>
      </div>`;
  }
  const q = glasKundePickerSearch.trim().toLowerCase();
  const filtered = glasKunden.filter((k) => !q || k.name.toLowerCase().includes(q));
  return `
    <div class="card" style="margin-bottom:14px;">
      <input type="text" id="kp_search" placeholder="🔍 Kunde suchen..." value="${escapeHtml(glasKundePickerSearch)}" style="margin-bottom:10px;" />
      <div style="max-height:240px; overflow-y:auto;">
        ${filtered.length ? filtered.map((k) => `
          <div style="padding:10px 4px; border-top:1px solid var(--border); cursor:pointer;" onclick='selectGlasKundeForObjekt(${JSON.stringify(k.id)})'>
            <p style="margin:0; font-weight:500;">${escapeHtml(k.name)}</p>
          </div>`).join("") : `<p class="muted" style="padding:8px 4px;">Keine Kunden gefunden.</p>`}
      </div>
      <button class="btn btn-sm" type="button" style="margin-top:10px;" onclick="glasKundePickerOpen = false; renderGlasAdmin();">Abbrechen</button>
    </div>`;
}

function selectGlasKundeForObjekt(kundeId) {
  const kunde = glasKunden.find((k) => k.id === kundeId);
  if (!kunde || !glasObjektEditing) return;
  glasObjektEditing.kunde_id = kunde.id;
  glasObjektEditing.kunde_name = kunde.name;
  glasObjektEditing.kunde_adresse = [kunde.name, kunde.adresse].filter(Boolean).join("\n");
  glasKundePickerOpen = false;
  renderGlasAdmin();
}

/* ========================================================================
   Objekte-Tab (Liste)
   ======================================================================== */

function renderObjekteTab() {
  if (glasObjektEditing !== null) return renderObjektForm();

  const filtered = glasObjekte.filter((o) => matchesSearch(o, glasObjektSearch));
  const searching = glasObjektSearch.trim().length > 0;

  const groups = {};
  filtered.forEach((o) => {
    const key = o.kunde_name || "Ohne Kunde";
    if (!groups[key]) groups[key] = [];
    groups[key].push(o);
  });

  const groupsHtml = Object.keys(groups).length
    ? Object.keys(groups)
        .sort()
        .map((kunde) => {
          const isOpen = searching || glasObjektGroupsExpanded.has(kunde);
          const items = groups[kunde];
          return `
            <div class="card" style="padding:0; overflow:hidden;">
              <div style="padding:14px 18px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick='toggleGlasObjektGroup(${JSON.stringify(kunde)})'>
                <p style="margin:0; font-weight:600;">${escapeHtml(kunde)} <span class="muted" style="font-weight:400;">(${items.length})</span></p>
                <span style="font-size:18px; color:var(--text-secondary);">${isOpen ? "▲" : "▼"}</span>
              </div>
              ${isOpen ? `<div style="padding:0 0 6px;">${items.map(renderGlasObjektRow).join("")}</div>` : ""}
            </div>`;
        })
        .join("")
    : `<p class="muted">Keine Objekte gefunden.</p>`;

  return `
    <div style="display:flex; gap:8px; margin:16px 0;">
      <input type="text" id="obj_search" placeholder="🔍 Suchen (Name, Adresse, Kunde)..." value="${escapeHtml(glasObjektSearch)}" />
    </div>
    <button class="btn btn-primary" style="margin-bottom:14px;" onclick="editGlasObjekt(null)">+ Neues Objekt anlegen</button>
    <p class="muted" style="margin:0 0 10px;">${filtered.length} von ${glasObjekte.length} Objekt(en)</p>
    ${groupsHtml}
  `;
}

function renderGlasObjektRow(o) {
  const positionen = glasGetObjektPositionen(o.id);
  const status = positionen.map(glasFaelligkeitStatus).filter((s) => s.status);
  const ueberfaellig = status.some((s) => s.status === "ueberfaellig");
  const bald = status.some((s) => s.status === "bald");
  const dot = ueberfaellig ? "🔴" : bald ? "🟡" : "";
  return `
    <div style="border-top:1px solid var(--border); padding:12px 18px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="goGlasObjekt('${o.id}')">
      <div style="min-width:0;">
        <p style="margin:0; font-weight:500;">${dot ? dot + " " : ""}${escapeHtml(o.name)}</p>
        <p class="muted" style="margin:2px 0 0; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml((o.adresse || "").split("\n").join(", "))}${o.lat ? "" : " · ⚠️ nicht geocodiert"}</p>
      </div>
      <span style="font-size:15px; color:var(--text-secondary); flex-shrink:0;">›</span>
    </div>`;
}

function toggleGlasObjektGroup(kunde) {
  if (glasObjektGroupsExpanded.has(kunde)) glasObjektGroupsExpanded.delete(kunde);
  else glasObjektGroupsExpanded.add(kunde);
  renderGlasAdmin();
}

/* ========================================================================
   Objekt-Formular (Anlegen / Bearbeiten)
   ======================================================================== */

function editGlasObjekt(id, presetKundeId) {
  glasKundePickerOpen = false;
  glasKundePickerSearch = "";
  if (id === null) {
    const kunde = glasKunden.find((k) => k.id === presetKundeId) || glasKunden[0];
    glasObjektEditing = {
      id: null,
      kunde_id: kunde ? kunde.id : "",
      kunde_name: kunde ? kunde.name : "",
      kunde_adresse: kunde ? [kunde.name, kunde.adresse].filter(Boolean).join("\n") : "",
      name: "",
      adresse: "",
      kdnr: "",
      positionen: [glasLeerePosition()],
    };
  } else {
    const o = glasObjekte.find((x) => x.id === id);
    glasObjektEditing = { ...o, positionen: glasGetObjektPositionen(id).map((p) => ({ ...p })) };
  }
  // Bewusst glasNavigate() statt goGlasTab(): goGlasTab() würde glasObjektEditing sofort
  // wieder auf null zurücksetzen, das gerade erst gesetzt wurde.
  glasNavigate({ type: "tabs", tab: "objekte" });
}

function glasLeerePosition() {
  return {
    id: null, nr: glasPositionen[0]?.nr || "10", art: glasPositionen[0]?.name || "", qm: "",
    intervall_typ: "", intervall_wochen: null, feste_monate: "", letzte_reinigung: null, faelligkeit_override: null,
  };
}

function cancelGlasObjektEdit() {
  glasObjektEditing = null;
  renderGlasAdmin();
}

function renderObjektForm() {
  const o = glasObjektEditing;
  const { strasse, plz, ort } = glasSplitAdresse(o.adresse);

  return `
    <div class="card" style="margin-top:16px;">
      <h2>${o.id ? "Objekt bearbeiten" : "Neues Objekt"}</h2>
      ${glasKunden.length ? "" : `<p class="muted">Noch keine Kunden angelegt. Erst in der normalen Abnahme-App unter "Kunden" einen Kunden anlegen.</p>`}
      ${renderKundePicker(o.kunde_id, o.kunde_name)}
      <div class="field">
        <label class="muted">Kunde-Adresse (Briefkopf oben links auf dem Schein)</label>
        <textarea id="o_kunde_adresse" rows="4" placeholder="Zweckverband Katholische Tageseinrichtungen für Kinder
Im Gildehof 8
45127 Essen">${escapeHtml(o.kunde_adresse)}</textarea>
      </div>
      <div class="field">
        <label class="muted">Objekt-Name (Kita-Name + Kita-Nr.)</label>
        <input type="text" id="o_name" value="${escapeHtml(o.name)}" placeholder="St. Anna / 407" />
      </div>
      <div class="field">
        <label class="muted">Straße + Hausnummer</label>
        <input type="text" id="o_strasse" value="${escapeHtml(strasse)}" placeholder="Goldhammer Straße 14a" />
      </div>
      <div class="row">
        <div class="field">
          <label class="muted">PLZ</label>
          <input type="text" id="o_plz" value="${escapeHtml(plz)}" placeholder="44793" />
        </div>
        <div class="field" style="flex:2;">
          <label class="muted">Ort</label>
          <input type="text" id="o_ort" value="${escapeHtml(ort)}" placeholder="Bochum" />
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label class="muted">Kd.-Nr.</label>
          <input type="text" id="o_kdnr" value="${escapeHtml(o.kdnr)}" placeholder="3806 590 00" />
        </div>
      </div>
      <label class="muted">Positionen &amp; Intervalle</label>
      ${renderPositionenRows(o.positionen)}
      <button class="btn btn-sm" style="margin:8px 0 4px;" onclick="addPositionRow()">+ Position hinzufügen</button>
      <div style="display:flex; gap:8px; margin-top:12px;">
        <button class="btn btn-primary" onclick="saveGlasObjekt()" ${glasBusy ? "disabled" : ""}>
          ${glasBusy ? `<span class="spinner"></span> ${escapeHtml(glasProgressText || "Speichere...")}` : "Speichern"}
        </button>
        <button class="btn btn-sm" onclick="cancelGlasObjektEdit()">Abbrechen</button>
        ${o.id ? `<button class="btn btn-sm" style="color:var(--danger); margin-left:auto;" onclick="deleteGlasObjekt('${o.id}')">Löschen</button>` : ""}
      </div>
    </div>
  `;
}

function renderPositionenRows(positionen) {
  const positionenOptions = (art) =>
    glasPositionen
      .map((p) => `<option value="${escapeHtml(p.name)}" data-nr="${escapeHtml(p.nr || "10")}" ${p.name === art ? "selected" : ""}>Pos. ${escapeHtml(p.nr || "10")} – ${escapeHtml(p.name)}</option>`)
      .join("") + (art && !glasPositionen.some((p) => p.name === art) ? `<option value="${escapeHtml(art)}" selected>${escapeHtml(art)}</option>` : "");

  return positionen
    .map((pos, i) => {
      const faellig = glasFaelligkeitStatus(pos);
      return `
      <div class="card" style="padding:14px; margin-bottom:10px; background:var(--bg);">
        <div class="row" style="align-items:flex-end; margin-bottom:8px;">
          <div class="field" style="flex:0 0 70px; margin-bottom:0;">
            <label class="muted">Nr.</label>
            <input type="text" id="pos_nr_${i}" value="${escapeHtml(pos.nr)}" />
          </div>
          <div class="field" style="flex:2; margin-bottom:0;">
            <label class="muted">Art</label>
            <select id="pos_art_${i}" onchange="onGlasPositionArtChange(${i})">${positionenOptions(pos.art)}</select>
          </div>
          <div class="field" style="flex:1; margin-bottom:0;">
            <label class="muted">QM</label>
            <input type="text" id="pos_qm_${i}" value="${escapeHtml(pos.qm)}" placeholder="144,50" />
          </div>
          ${positionen.length > 1 ? `<button class="btn btn-sm" onclick="removePositionRow(${i})">✕</button>` : ""}
        </div>
        <div class="row" style="align-items:flex-end;">
          <div class="field" style="flex:1.3; margin-bottom:0;">
            <label class="muted">Intervall</label>
            <select id="pos_ivtyp_${i}" onchange="onGlasIntervallTypChange(${i})">
              <option value="" ${!pos.intervall_typ ? "selected" : ""}>Kein Intervall (rein manuell)</option>
              <option value="rollierend" ${pos.intervall_typ === "rollierend" ? "selected" : ""}>Rollierend (alle X Wochen)</option>
              <option value="feste_monate" ${pos.intervall_typ === "feste_monate" ? "selected" : ""}>Feste Monate</option>
            </select>
          </div>
          ${pos.intervall_typ === "rollierend" ? `
          <div class="field" style="flex:1; margin-bottom:0;">
            <label class="muted">Alle X Wochen</label>
            <input type="text" id="pos_ivw_${i}" value="${escapeHtml(pos.intervall_wochen || "")}" placeholder="z.B. 12" />
          </div>` : ""}
          ${pos.intervall_typ === "feste_monate" ? `
          <div class="field" style="flex:1.6; margin-bottom:0;">
            <label class="muted">Monate (1-12, kommagetrennt)</label>
            <input type="text" id="pos_ivm_${i}" value="${escapeHtml(pos.feste_monate || "")}" placeholder="z.B. 3,6,9,12" />
          </div>` : ""}
        </div>
        ${pos.intervall_typ ? `
        <p class="muted" style="margin:8px 0 0; font-size:12px;">
          Zuletzt: ${pos.letzte_reinigung ? formatGlasDate(pos.letzte_reinigung) : "noch nie"}
          ${faellig.faelligkeit ? ` · Fällig: ${formatGlasDate(faellig.faelligkeit)}${faellig.status === "ueberfaellig" ? " (überfällig)" : ""}` : ""}
        </p>` : ""}
      </div>`;
    })
    .join("");
}

function onGlasPositionArtChange(i) {
  const select = document.getElementById(`pos_art_${i}`);
  const nr = select.options[select.selectedIndex]?.getAttribute("data-nr");
  if (nr) document.getElementById(`pos_nr_${i}`).value = nr;
}

function onGlasIntervallTypChange(i) {
  syncObjektFormFromDom();
  glasObjektEditing.positionen[i].intervall_typ = document.getElementById(`pos_ivtyp_${i}`).value;
  renderGlasAdmin();
}

function syncPositionenFromDom() {
  if (!glasObjektEditing) return;
  glasObjektEditing.positionen = glasObjektEditing.positionen.map((pos, i) => ({
    ...pos,
    nr: document.getElementById(`pos_nr_${i}`)?.value.trim() || pos.nr,
    art: document.getElementById(`pos_art_${i}`)?.value || pos.art,
    qm: document.getElementById(`pos_qm_${i}`)?.value.trim() ?? pos.qm,
    intervall_typ: document.getElementById(`pos_ivtyp_${i}`)?.value ?? pos.intervall_typ,
    intervall_wochen: document.getElementById(`pos_ivw_${i}`) ? (parseInt(document.getElementById(`pos_ivw_${i}`).value, 10) || null) : pos.intervall_wochen,
    feste_monate: document.getElementById(`pos_ivm_${i}`) ? document.getElementById(`pos_ivm_${i}`).value.trim() : pos.feste_monate,
  }));
}

// Liest ALLE Formularfelder aus dem DOM zurück in glasObjektEditing, bevor renderGlasAdmin()
// das Formular neu aufbaut - sonst gehen bereits eingetippte Werte (Name, Adresse, ...)
// verloren, sobald z.B. eine Position hinzugefügt/entfernt wird (renderObjektForm baut das
// Formular immer aus glasObjektEditing neu auf, nicht aus dem aktuellen DOM-Zustand).
function syncObjektFormFromDom() {
  if (!glasObjektEditing) return;
  syncPositionenFromDom();
  const get = (id) => document.getElementById(id)?.value;
  if (get("o_kunde_adresse") !== undefined) glasObjektEditing.kunde_adresse = get("o_kunde_adresse");
  if (get("o_name") !== undefined) glasObjektEditing.name = get("o_name");
  if (get("o_kdnr") !== undefined) glasObjektEditing.kdnr = get("o_kdnr");
  const strasse = get("o_strasse");
  const plz = get("o_plz");
  const ort = get("o_ort");
  if (strasse !== undefined) glasObjektEditing.adresse = glasJoinAdresse(strasse, plz || "", ort || "");
}

function addPositionRow() {
  syncObjektFormFromDom();
  glasObjektEditing.positionen.push(glasLeerePosition());
  renderGlasAdmin();
}

function removePositionRow(idx) {
  syncObjektFormFromDom();
  glasObjektEditing.positionen.splice(idx, 1);
  renderGlasAdmin();
}

async function saveGlasObjekt() {
  if (glasBusy) return;
  syncObjektFormFromDom();
  const kundeId = glasObjektEditing.kunde_id;
  const kundeName = glasObjektEditing.kunde_name;
  const kundeAdresse = (document.getElementById("o_kunde_adresse")?.value || "").trim();
  const name = document.getElementById("o_name").value.trim();
  const strasse = document.getElementById("o_strasse").value.trim();
  const plz = document.getElementById("o_plz").value.trim();
  const ort = document.getElementById("o_ort").value.trim();
  const kdnr = document.getElementById("o_kdnr").value.trim();
  const positionen = glasObjektEditing.positionen.filter((p) => p.art || p.qm);

  if (!kundeId) { showToast("Bitte einen Kunden auswählen"); return; }
  if (!name) { showToast("Bitte einen Objekt-Namen eintragen"); return; }
  if (!strasse || !plz || !ort) { showToast("Bitte Straße, PLZ und Ort eintragen"); return; }

  const adresse = glasJoinAdresse(strasse, plz, ort);
  const geocodeQuery = `${strasse}, ${plz} ${ort}`;

  glasBusy = true;
  glasProgressText = "Adresse wird geocodiert...";
  renderGlasAdmin();

  let coords = { lat: glasObjektEditing.lat, lng: glasObjektEditing.lng };
  const addressChanged = adresse !== glasObjektEditing.adresse;
  let geocodeFailed = false;
  let geocodeApproximate = false;
  if (addressChanged || !coords.lat) {
    try {
      const result = await glasGeocode(geocodeQuery);
      coords = result;
      geocodeApproximate = !!result.approximate;
    } catch (e) {
      coords = { lat: null, lng: null };
      geocodeFailed = true;
    }
  }

  const objektId = glasObjektEditing.id || genCode();
  const payload = {
    id: objektId,
    kunde_id: kundeId,
    kunde_name: kundeName,
    kunde_adresse: kundeAdresse,
    name,
    adresse,
    kdnr,
    lat: coords.lat,
    lng: coords.lng,
  };

  const { error } = await sb.from("glas_objekte").upsert(payload);
  if (error) { glasBusy = false; glasProgressText = ""; showToast("Fehler: " + error.message); renderGlasAdmin(); return; }

  // Positionen abgleichen: bestehende Zeilen aktualisieren, neue einfügen,
  // entfernte Zeilen löschen.
  glasProgressText = "Positionen werden gespeichert...";
  renderGlasAdmin();
  const existingIds = glasObjektPositionen.filter((p) => p.objekt_id === objektId).map((p) => p.id);
  const keptIds = positionen.filter((p) => p.id).map((p) => p.id);
  const toDelete = existingIds.filter((id) => !keptIds.includes(id));
  if (toDelete.length) await sb.from("glas_objekt_positionen").delete().in("id", toDelete);

  const posPayload = positionen.map((p, i) => ({
    id: p.id || genCode(),
    objekt_id: objektId,
    nr: p.nr || "10",
    art: p.art || "",
    qm: p.qm || "",
    intervall_typ: p.intervall_typ || "",
    intervall_wochen: p.intervall_typ === "rollierend" ? (p.intervall_wochen || null) : null,
    feste_monate: p.intervall_typ === "feste_monate" ? (p.feste_monate || "") : "",
    letzte_reinigung: p.letzte_reinigung || null,
    faelligkeit_override: p.faelligkeit_override || null,
    reihenfolge: i,
  }));
  if (posPayload.length) await sb.from("glas_objekt_positionen").upsert(posPayload);

  glasBusy = false;
  glasProgressText = "";
  if (geocodeFailed) {
    showToast("Objekt gespeichert – Adresse konnte gar nicht gefunden werden (Route setzt es ans Ende)");
  } else if (geocodeApproximate) {
    showToast("Objekt gespeichert – nur ungefähre Position gefunden (Straße evtl. nicht exakt getroffen)");
  } else {
    showToast("Objekt gespeichert");
  }
  glasObjektEditing = null;
  await Promise.all([loadGlasObjekte(), loadGlasObjektPositionen()]);
  renderGlasAdmin();
}

async function deleteGlasObjekt(id) {
  if (!confirm("Dieses Objekt wirklich löschen? (Bereits erstellte Touren bleiben erhalten)")) return;
  const { error } = await sb.from("glas_objekte").delete().eq("id", id);
  if (error) { showToast("Fehler: " + error.message); return; }
  showToast("Objekt gelöscht");
  glasObjektEditing = null;
  await Promise.all([loadGlasObjekte(), loadGlasObjektPositionen()]);
  goGlasTab("objekte");
}

/* ========================================================================
   Objekt-Detail-Seite
   ======================================================================== */

function renderObjektDetailPage(id) {
  const o = glasObjekte.find((x) => x.id === id);
  if (!o) return `<button class="btn btn-sm" style="margin:16px 0;" onclick="goGlasTab('objekte')">&larr; Zurück</button><p class="muted">Objekt nicht gefunden.</p>`;

  if (!glasObjektDetailHistory[id]) loadGlasObjektHistory(id);
  const history = glasObjektDetailHistory[id] || [];
  const signed = history.filter((s) => s.status === "erledigt");
  const positionen = glasGetObjektPositionen(id);

  const naechste = positionen
    .map(glasFaelligkeitStatus)
    .filter((s) => s.faelligkeit)
    .sort((a, b) => a.faelligkeit.localeCompare(b.faelligkeit))[0];

  const shown = glasObjektDetailShowAllHistory ? signed : signed.slice(0, 5);

  return `
    <button class="btn btn-sm" style="margin:16px 0;" onclick="goGlasTab('objekte')">&larr; Alle Objekte</button>

    <div class="card">
      <p style="margin:0 0 4px; font-weight:700; font-size:19px;">${escapeHtml(o.name)}</p>
      <p class="muted" style="margin:0 0 10px;"><a href="javascript:void(0)" onclick="goGlasKunde('${o.kunde_id}')">${escapeHtml(o.kunde_name || "Ohne Kunde")}</a></p>
      <p style="margin:0; white-space:pre-line;">${escapeHtml(o.adresse)}</p>
      <p class="muted" style="margin:6px 0 0;">Kd.-Nr.: ${escapeHtml(o.kdnr || "–")}</p>
      ${o.lat ? `<a class="btn btn-sm" style="margin-top:10px;" href="https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}" target="_blank">🧭 Navigation</a>` : `<p class="muted" style="margin-top:8px;">⚠️ Nicht geocodiert</p>`}
    </div>

    <div class="card" style="background:${naechste ? (naechste.status === "ueberfaellig" ? "#fdeceb" : naechste.status === "bald" ? "#fdf3e3" : "var(--card)") : "var(--card)"};">
      <p style="margin:0; font-weight:600;">
        ${naechste
          ? `Nächste Reinigung: ${formatGlasDate(naechste.faelligkeit)}${naechste.status === "ueberfaellig" ? " (überfällig)" : ""}`
          : "Kein Intervall hinterlegt – rein manuell"}
      </p>
      ${signed.length ? `<p class="muted" style="margin:4px 0 0;">Zuletzt gereinigt: ${formatGlasDate(signed[0].datum)} von ${escapeHtml(signed[0].name || "")}</p>` : ""}
    </div>

    <div class="card">
      <h2>Positionen</h2>
      ${positionen.map((p) => {
        const f = glasFaelligkeitStatus(p);
        return `
        <div style="padding:10px 0; border-top:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <p style="margin:0; font-weight:500;">Pos. ${escapeHtml(p.nr)} – ${escapeHtml(p.art)} ${p.qm ? `(${escapeHtml(p.qm)} qm)` : ""}</p>
            ${f.status ? `<span class="badge ${f.status === "ueberfaellig" ? "badge-danger" : f.status === "bald" ? "badge-open" : "badge-signed"}">${f.status === "ueberfaellig" ? "Überfällig" : f.status === "bald" ? "Bald fällig" : "Geplant"}</span>` : ""}
          </div>
          <p class="muted" style="margin:3px 0 0; font-size:12.5px;">${glasIntervallLabel(p)}${f.faelligkeit ? ` · Fällig: ${formatGlasDate(f.faelligkeit)}` : ""}${p.letzte_reinigung ? ` · Zuletzt: ${formatGlasDate(p.letzte_reinigung)}` : ""}</p>
        </div>`;
      }).join("")}
      <button class="btn btn-sm" style="margin-top:12px;" onclick='editGlasObjekt(${JSON.stringify(o.id)})'>Objekt bearbeiten</button>
    </div>

    <div class="card">
      <h2>Verlauf</h2>
      ${!glasObjektDetailHistory[id]
        ? `<p class="muted"><span class="spinner"></span> Lade...</p>`
        : !signed.length
          ? `<p class="muted">Noch nie unterschrieben.</p>`
          : shown.map((s) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 0; border-top:1px solid var(--border);">
              <span style="font-size:13.5px;">${formatGlasDate(s.datum)} · ${escapeHtml(s.name || "")}</span>
              <button class="btn btn-sm" style="padding:4px 8px;" onclick="downloadGlasPdfHistory('${id}','${s.id}')">📄 PDF</button>
            </div>`).join("") + (signed.length > 5 && !glasObjektDetailShowAllHistory
              ? `<button class="btn btn-sm" style="margin-top:10px;" onclick="glasObjektDetailShowAllHistory = true; renderGlasAdmin();">Alle ${signed.length} anzeigen</button>`
              : "")
      }
    </div>

    <div style="display:flex; gap:8px; margin-top:4px;">
      <button class="btn btn-sm" style="color:var(--danger);" onclick="deleteGlasObjekt('${o.id}')">Objekt löschen</button>
    </div>
  `;
}

async function loadGlasObjektHistory(id) {
  const { data, error } = await sb
    .from("glas_stopps")
    .select("*, glas_touren(name, datum, template)")
    .eq("objekt_id", id)
    .order("created_at", { ascending: false });
  glasObjektDetailHistory[id] = error ? [] : data || [];
  renderGlasAdmin();
}

function downloadGlasPdfHistory(objektId, stopId) {
  const s = (glasObjektDetailHistory[objektId] || []).find((x) => x.id === stopId);
  if (!s) return;
  const doc = generateGlasPdf(s, s.glas_touren?.template || "geko", s.glas_touren?.datum);
  doc.save(`Abnahmeschein_${(s.adresse || "").replace(/[^a-z0-9]+/gi, "_")}.pdf`);
}

/* ========================================================================
   Kunden-Tab & Kunden-Detail-Seite
   ======================================================================== */

function renderKundenTab() {
  const q = glasKundenSearch.trim().toLowerCase();
  const filtered = glasKunden.filter((k) => !q || k.name.toLowerCase().includes(q));
  const rows = filtered.length
    ? filtered.map((k) => {
        const objekte = glasObjekte.filter((o) => o.kunde_id === k.id);
        return `
          <div class="card" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onclick="goGlasKunde('${k.id}')">
            <div>
              <p style="margin:0; font-weight:600;">${escapeHtml(k.name)}</p>
              <p class="muted" style="margin:3px 0 0;">${objekte.length} Objekt(e)</p>
            </div>
            <span style="font-size:18px; color:var(--text-secondary);">›</span>
          </div>`;
      }).join("")
    : `<p class="muted">Keine Kunden gefunden.</p>`;

  return `
    <div style="display:flex; gap:8px; margin:16px 0;">
      <input type="text" id="kunden_search" placeholder="🔍 Kunde suchen..." value="${escapeHtml(glasKundenSearch)}" />
    </div>
    ${rows}
  `;
}

function renderKundeDetailPage(id) {
  const k = glasKunden.find((x) => x.id === id);
  if (!k) return `<button class="btn btn-sm" style="margin:16px 0;" onclick="goGlasTab('kunden')">&larr; Zurück</button><p class="muted">Kunde nicht gefunden.</p>`;

  const objekte = glasObjekte.filter((o) => o.kunde_id === id);
  let faelligeCount = 0;
  const rows = objekte.map((o) => {
    const positionen = glasGetObjektPositionen(o.id);
    const stats = positionen.map(glasFaelligkeitStatus);
    const ueberfaellig = stats.some((s) => s.status === "ueberfaellig");
    const bald = stats.some((s) => s.status === "bald");
    if (ueberfaellig || bald) faelligeCount++;
    const dot = ueberfaellig ? "🔴" : bald ? "🟡" : "";
    return `
      <div style="border-top:1px solid var(--border); padding:12px 4px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="goGlasObjekt('${o.id}')">
        <div>
          <p style="margin:0; font-weight:500;">${dot ? dot + " " : ""}${escapeHtml(o.name)}</p>
          <p class="muted" style="margin:2px 0 0; font-size:12.5px;">${escapeHtml((o.adresse || "").split("\n")[0])}</p>
        </div>
        <span style="font-size:15px; color:var(--text-secondary);">›</span>
      </div>`;
  }).join("");

  return `
    <button class="btn btn-sm" style="margin:16px 0;" onclick="goGlasTab('kunden')">&larr; Alle Kunden</button>
    <div class="card">
      <p style="margin:0 0 4px; font-weight:700; font-size:19px;">${escapeHtml(k.name)}</p>
      <p class="muted" style="margin:0; white-space:pre-line;">${escapeHtml(k.adresse || "")}</p>
    </div>
    <div class="card">
      <p style="margin:0; font-weight:600;">${objekte.length} Objekt(e)${faelligeCount ? ` · ${faelligeCount} bald/überfällig` : ""}</p>
    </div>
    <div class="card" style="padding:6px 18px;">
      ${objekte.length ? rows : `<p class="muted" style="padding:10px 0;">Noch keine Objekte für diesen Kunden angelegt.</p>`}
    </div>
    <button class="btn btn-primary" onclick="editGlasObjekt(null, '${k.id}')">+ Neues Objekt für diesen Kunden</button>
  `;
}

/* ========================================================================
   Positionen-Tab (Leistungsarten-Stammdaten)
   ======================================================================== */

let glasPositionEditingId = null; // null = keine Bearbeitung, "" = neu, sonst id

function renderPositionenTab() {
  const list = glasPositionen.length
    ? glasPositionen
        .map(
          (p) => `
        <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
          ${glasPositionEditingId === p.id ? `
            <div style="display:flex; gap:8px; flex:1; margin-right:10px;">
              <input type="text" id="pos_edit_nr_${p.id}" value="${escapeHtml(p.nr || "10")}" style="flex:0 0 60px;" />
              <input type="text" id="pos_edit_${p.id}" value="${escapeHtml(p.name)}" />
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-sm btn-primary" onclick="saveGlasPosition('${p.id}')">Speichern</button>
              <button class="btn btn-sm" onclick="glasPositionEditingId = null; renderGlasAdmin();">Abbrechen</button>
            </div>
          ` : `
            <p style="margin:0; font-weight:500;">Pos. ${escapeHtml(p.nr || "10")} – ${escapeHtml(p.name)}</p>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-sm" onclick="glasPositionEditingId = '${p.id}'; renderGlasAdmin();">Bearbeiten</button>
              <button class="btn btn-sm" style="color:var(--danger);" onclick="deleteGlasPosition('${p.id}')">Löschen</button>
            </div>
          `}
        </div>`
        )
        .join("")
    : `<p class="muted">Noch keine Positionen angelegt.</p>`;

  return `
    <div class="card" style="margin-top:16px;">
      <h2>Neue Position</h2>
      <p class="muted" style="margin:0 0 10px;">Leistungsarten mit fester Standard-Positionsnummer (z.B. Pos. 10 Glas- und Rahmenreinigung, Pos. 15 Hubsteigereinsatz). Wird beim Objekt einfach ausgewählt.</p>
      <div style="display:flex; gap:8px;">
        <input type="text" id="pos_new_nr" placeholder="Nr." style="flex:0 0 60px;" value="10" />
        <input type="text" id="pos_new_name" placeholder="z.B. Grundreinigung" />
        <button class="btn btn-primary" onclick="addGlasPosition()">+ Hinzufügen</button>
      </div>
    </div>
    ${list}
  `;
}

async function addGlasPosition() {
  const nameInput = document.getElementById("pos_new_name");
  const nrInput = document.getElementById("pos_new_nr");
  const name = nameInput.value.trim();
  const nr = nrInput.value.trim() || "10";
  if (!name) { showToast("Bitte einen Namen eintragen"); return; }
  const { error } = await sb.from("glas_positionen").insert({ id: genCode(), name, nr });
  if (error) { showToast("Fehler: " + error.message); return; }
  nameInput.value = "";
  nrInput.value = "10";
  await loadGlasPositionen();
  renderGlasAdmin();
}

async function saveGlasPosition(id) {
  const name = document.getElementById(`pos_edit_${id}`).value.trim();
  const nr = document.getElementById(`pos_edit_nr_${id}`).value.trim() || "10";
  if (!name) { showToast("Bitte einen Namen eintragen"); return; }
  const { error } = await sb.from("glas_positionen").update({ name, nr }).eq("id", id);
  if (error) { showToast("Fehler: " + error.message); return; }
  glasPositionEditingId = null;
  await loadGlasPositionen();
  renderGlasAdmin();
}

async function deleteGlasPosition(id) {
  if (!confirm("Diese Position wirklich löschen?")) return;
  const { error } = await sb.from("glas_positionen").delete().eq("id", id);
  if (error) { showToast("Fehler: " + error.message); return; }
  await loadGlasPositionen();
  renderGlasAdmin();
}

/* ========================================================================
   Touren-Tab
   ======================================================================== */

let glasTourDetailStops = [];

function renderTourenTab() {
  if (glasTourDetailId) return renderTourDetailView();
  if (glasShowEinzelschein) return renderEinzelscheinForm();
  if (glasShowNewTourForm) return renderNewTourForm();
  return renderTourenListView();
}

function renderTourenListView() {
  const tourenList = glasTouren.length
    ? glasTouren
        .map((t) => {
          const stops = t.glas_stopps || [];
          const done = stops.filter((s) => s.status === "erledigt").length;
          const allDone = stops.length && done === stops.length;
          return `
            <div class="card" style="cursor:pointer; ${allDone ? "background:#f2faf3;" : ""}" onclick="openGlasTourDetail('${t.id}')">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <p style="margin:0 0 4px; font-weight:600;">${t.name ? escapeHtml(t.name) : (t.datum ? formatGlasDate(t.datum) : "Ohne Namen")}${t.frei ? ` <span class="badge badge-open">Einzelschein</span>` : ""}</p>
                  <p class="muted" style="margin:0;">${t.datum ? formatGlasDate(t.datum) : "Ohne Datum"} · ${stops.length} Stopp(s) · ${done}/${stops.length} erledigt</p>
                </div>
                <span style="font-size:18px; color:var(--text-secondary);">›</span>
              </div>
            </div>`;
        })
        .join("")
    : `<p class="muted">Noch keine Touren angelegt.</p>`;

  return `
    <div style="display:flex; gap:8px; margin:16px 0;">
      <button class="btn btn-primary" onclick="glasShowNewTourForm = true; glasRoutingMode = 'smart'; glasManualOrder = []; glasSelectedObjekte.clear(); glasPreselectPositionen = null; renderGlasAdmin();">+ Neue Tour anlegen</button>
      <button class="btn btn-sm" onclick="openGlasEinzelschein()">+ Einzelnen Schein erstellen</button>
    </div>
    ${tourenList}
  `;
}

async function openGlasTourDetail(tourId) {
  glasTourDetailId = tourId;
  glasTourDetailStops = [];
  renderGlasAdmin();
  const { data, error } = await sb
    .from("glas_stopps")
    .select("*")
    .eq("tour_id", tourId)
    .order("reihenfolge", { ascending: true });
  if (!error) glasTourDetailStops = data || [];
  renderGlasAdmin();
}

function closeGlasTourDetail() {
  glasTourDetailId = null;
  glasTourDetailStops = [];
  renderGlasAdmin();
}

function renderTourDetailView() {
  const t = glasTouren.find((x) => x.id === glasTourDetailId);
  if (!t) return `<p class="muted">Tour nicht gefunden.</p>`;

  const rows = glasTourDetailStops.length
    ? glasTourDetailStops
        .map((s, idx) => {
          const isDone = s.status === "erledigt";
          return `
        <div class="card" style="${isDone ? "background:#f2faf3;" : ""}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
            <div>
              <p class="muted" style="margin:0 0 2px;">Stopp ${idx + 1}${s.objekt ? " · " + escapeHtml(s.objekt) : ""}</p>
              <p style="margin:0; font-weight:600; white-space:pre-line;">${escapeHtml(s.adresse)}</p>
            </div>
            <span class="badge ${isDone ? "badge-signed" : "badge-open"}">${isDone ? "Erledigt" : "Offen"}</span>
          </div>
          ${isDone ? `
            <p class="muted" style="margin:10px 0 8px;">Unterschrieben von ${escapeHtml(s.name || "")} am ${formatGlasDate(s.datum)}</p>
            <button class="btn btn-sm" onclick="downloadGlasPdfAdmin('${s.id}')">📄 PDF herunterladen</button>
          ` : `<p class="muted" style="margin:10px 0 0;">Noch nicht unterschrieben</p>`}
        </div>`;
        })
        .join("")
    : `<p class="muted"><span class="spinner"></span> Lade Stopps...</p>`;

  return `
    <button class="btn btn-sm" style="margin:16px 0;" onclick="closeGlasTourDetail()">&larr; Zurück zu allen Touren</button>
    <div class="card">
      <p style="margin:0 0 4px; font-weight:600;">${t.name ? escapeHtml(t.name) : "Ohne Namen"}</p>
      <p class="muted" style="margin:0;">${t.datum ? formatGlasDate(t.datum) : "Ohne Datum"} · Template: ${t.template === "sub" ? "Subunternehmen" : "GEKO"}</p>
    </div>
    ${rows}
    <button class="btn btn-sm" style="color:var(--danger); margin-top:10px;" onclick="deleteGlasTour('${t.id}')">Tour löschen</button>
  `;
}

function downloadGlasPdfAdmin(stopId) {
  const t = glasTouren.find((x) => x.id === glasTourDetailId);
  const s = glasTourDetailStops.find((x) => x.id === stopId);
  if (!s || !t) return;
  const doc = generateGlasPdf(s, t.template, t.datum);
  doc.save(`Abnahmeschein_${(s.adresse || "").replace(/[^a-z0-9]+/gi, "_")}.pdf`);
}

function renderNewTourForm() {
  const filtered = glasObjekte.filter((o) => matchesSearch(o, glasTourSearch));
  const searching = glasTourSearch.trim().length > 0;
  const groups = {};
  filtered.forEach((o) => {
    const key = o.kunde_name || "Ohne Kunde";
    if (!groups[key]) groups[key] = [];
    groups[key].push(o);
  });

  const objekteHtml = Object.keys(groups).length
    ? Object.keys(groups)
        .sort()
        .map((kunde) => {
          const isOpen = searching || glasTourGroupsExpanded.has(kunde);
          const items = groups[kunde];
          const selectedCount = items.filter((o) => glasSelectedObjekte.has(o.id)).length;
          return `
            <div class="card" style="padding:0; overflow:hidden;">
              <div style="padding:12px 18px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick='toggleGlasTourGroup(${JSON.stringify(kunde)})'>
                <p style="margin:0; font-weight:600;">${escapeHtml(kunde)} <span class="muted" style="font-weight:400;">(${selectedCount}/${items.length})</span></p>
                <span style="font-size:16px; color:var(--text-secondary);">${isOpen ? "▲" : "▼"}</span>
              </div>
              ${isOpen ? items
                .map(
                  (o) => `
                <label style="display:flex; align-items:center; gap:10px; padding:10px 18px; border-top:1px solid var(--border); cursor:pointer;">
                  <input type="checkbox" class="glas-obj-check" value="${o.id}" ${glasSelectedObjekte.has(o.id) ? "checked" : ""} style="width:auto;" />
                  <span>
                    <span style="font-weight:500;">${escapeHtml(o.name)}</span><br/>
                    <span class="muted" style="font-size:12.5px; white-space:pre-line;">${escapeHtml(o.adresse)}</span>
                  </span>
                </label>`
                )
                .join("") : ""}
            </div>`;
        })
        .join("")
    : `<p class="muted">Keine Objekte gefunden. Wechsle ggf. zum Reiter "Objekte" und lege zuerst Kitas an.</p>`;

  return `
    <button class="btn btn-sm" style="margin:16px 0;" onclick="glasShowNewTourForm = false; glasPreselectPositionen = null; renderGlasAdmin();">&larr; Zurück zu allen Touren</button>
    <div class="card">
      <h2>Neue Tour anlegen</h2>
      ${glasPreselectPositionen ? `<p class="muted" style="margin:0 0 12px;">Aus der Fällig-Liste übernommen – es werden nur die dort ausgewählten Positionen auf den Schein gesetzt, nicht automatisch alle Positionen der Objekte.</p>` : ""}
      <div class="field">
        <label class="muted">Tourname</label>
        <input type="text" id="t_name" placeholder="z.B. Tour Bochum Nord" />
      </div>
      <div class="row">
        <div class="field">
          <label class="muted">Datum</label>
          <input type="date" id="t_datum" value="${new Date().toISOString().slice(0, 10)}" />
        </div>
        <div class="field">
          <label class="muted">Template (Briefkopf des Abnahmescheins)</label>
          <select id="t_template">
            <option value="geko">GEKO Clean</option>
            <option value="sub">Subunternehmen (Dietrich)</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label class="muted">Routenplanung</label>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-sm ${glasRoutingMode === "smart" ? "btn-primary" : ""}" onclick="setGlasRoutingMode('smart')" style="flex:1; justify-content:center;">🧠 Smart sortieren</button>
          <button class="btn btn-sm ${glasRoutingMode === "manual" ? "btn-primary" : ""}" onclick="setGlasRoutingMode('manual')" style="flex:1; justify-content:center;">✋ Manuell festlegen</button>
        </div>
      </div>
      <div class="field">
        <label class="muted">Objekte suchen</label>
        <input type="text" id="tour_obj_search" placeholder="🔍 Suchen (Name, Adresse, Kunde)..." value="${escapeHtml(glasTourSearch)}" />
      </div>
      <label class="muted">Objekte für diese Tour auswählen (${glasSelectedObjekte.size} ausgewählt)</label>
      ${objekteHtml}
      ${glasRoutingMode === "manual" ? renderManualOrderList() : ""}
      <button class="btn btn-primary" style="margin-top:16px;" onclick="createGlasTour()" ${glasBusy ? "disabled" : ""}>
        ${glasBusy ? `<span class="spinner"></span> ${escapeHtml(glasProgressText || "Wird angelegt...")}` : "Tour anlegen"}
      </button>
    </div>
  `;
}

function renderManualOrderList() {
  if (!glasManualOrder.length) return `<p class="muted" style="margin-top:12px;">Noch keine Objekte ausgewählt.</p>`;
  const rows = glasManualOrder
    .map((id, idx) => {
      const o = glasObjekte.find((x) => x.id === id);
      if (!o) return "";
      return `
        <div style="display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--border);">
          <span class="badge badge-open" style="min-width:24px; text-align:center;">${idx + 1}</span>
          <span style="flex:1;">
            <span style="font-weight:500;">${escapeHtml(o.name)}</span><br/>
            <span class="muted" style="font-size:12.5px;">${escapeHtml(o.adresse)}</span>
          </span>
          <button class="btn btn-sm" onclick="moveManualOrder('${id}', -1)" ${idx === 0 ? "disabled" : ""}>▲</button>
          <button class="btn btn-sm" onclick="moveManualOrder('${id}', 1)" ${idx === glasManualOrder.length - 1 ? "disabled" : ""}>▼</button>
        </div>`;
    })
    .join("");
  return `
    <div class="card" style="margin-top:14px;">
      <p class="muted" style="margin:0 0 6px; font-weight:600;">Reihenfolge festlegen</p>
      ${rows}
    </div>`;
}

function toggleGlasTourGroup(kunde) {
  if (glasTourGroupsExpanded.has(kunde)) glasTourGroupsExpanded.delete(kunde);
  else glasTourGroupsExpanded.add(kunde);
  renderGlasAdmin();
}

function attachGlasCheckboxHandlers() {
  document.querySelectorAll(".glas-obj-check").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) {
        glasSelectedObjekte.add(cb.value);
        if (!glasManualOrder.includes(cb.value)) glasManualOrder.push(cb.value);
      } else {
        glasSelectedObjekte.delete(cb.value);
        glasManualOrder = glasManualOrder.filter((id) => id !== cb.value);
      }
      if (glasRoutingMode === "manual") renderGlasAdmin();
    });
  });
}

function moveManualOrder(id, dir) {
  const idx = glasManualOrder.indexOf(id);
  const newIdx = idx + dir;
  if (idx < 0 || newIdx < 0 || newIdx >= glasManualOrder.length) return;
  [glasManualOrder[idx], glasManualOrder[newIdx]] = [glasManualOrder[newIdx], glasManualOrder[idx]];
  renderGlasAdmin();
}

function setGlasRoutingMode(mode) {
  glasRoutingMode = mode;
  renderGlasAdmin();
}

async function createGlasTour() {
  if (glasBusy) return;
  const name = document.getElementById("t_name").value.trim();
  const datum = document.getElementById("t_datum").value;
  const template = document.getElementById("t_template").value;
  const selected = glasObjekte.filter((o) => glasSelectedObjekte.has(o.id));

  if (!selected.length) { showToast("Bitte mindestens ein Objekt auswählen"); return; }

  glasBusy = true;
  glasProgressText = "Route wird optimiert...";
  renderGlasAdmin();

  try {
    // Objekte ohne Koordinaten (z.B. Geocoding beim Anlegen fehlgeschlagen) nachträglich versuchen.
    // Schlägt es wieder fehl, wird die Tour trotzdem angelegt - das Objekt landet dann
    // einfach am Ende der Route statt die ganze Tour-Erstellung abzubrechen.
    const failedNames = [];
    for (const o of selected) {
      if (!o.lat || !o.lng) {
        glasProgressText = `Geocodiere ${o.name}...`;
        renderGlasAdmin();
        try {
          const { strasse, plz, ort } = glasSplitAdresse(o.adresse);
          const coords = await glasGeocode(`${strasse}, ${plz} ${ort}`);
          o.lat = coords.lat;
          o.lng = coords.lng;
          await sb.from("glas_objekte").update({ lat: coords.lat, lng: coords.lng }).eq("id", o.id);
          await new Promise((r) => setTimeout(r, 1100));
        } catch (e) {
          failedNames.push(o.name);
        }
      }
    }

    const ordered = glasRoutingMode === "manual"
      ? glasManualOrder.map((id) => selected.find((o) => o.id === id)).filter(Boolean)
      : glasOptimizeRoute(selected);

    const tourId = genCode();
    const { error: tourErr } = await sb.from("glas_touren").insert({
      id: tourId,
      name,
      datum: datum || null,
      template,
    });
    if (tourErr) throw tourErr;

    const stoppRows = ordered.map((o, idx) => {
      // Normalerweise gehen alle Positionen des Objekts auf den Schein. Kommt die Auswahl
      // aus der "Offenen Liste" (glasPreselectPositionen gesetzt), werden nur die dort
      // ausgewählten Positionen aufgenommen - so wird z.B. nicht versehentlich eine noch
      // nicht fällige Hubsteiger-Position mit "erledigt" markiert, nur weil man zufällig
      // gleichzeitig die fällige Glasreinigung am selben Objekt einplant.
      const alle = glasGetObjektPositionen(o.id);
      const auswahl = glasPreselectPositionen?.get(o.id);
      const positionenForStop = auswahl ? alle.filter((p) => auswahl.has(p.id)) : alle;
      return {
        id: genCode(),
        tour_id: tourId,
        objekt_id: o.id,
        reihenfolge: idx,
        objekt: o.name,
        adresse: o.adresse,
        kdnr: o.kdnr,
        kunde_adresse: o.kunde_adresse,
        positionen: JSON.stringify(positionenForStop.map((p) => ({ id: p.id, nr: p.nr, art: p.art, qm: p.qm }))),
        lat: o.lat,
        lng: o.lng,
        status: "offen",
      };
    });
    const { error: stoppErr } = await sb.from("glas_stopps").insert(stoppRows);
    if (stoppErr) throw stoppErr;

    showToast(
      failedNames.length
        ? `Tour angelegt – Adresse(n) nicht gefunden, ans Ende gesetzt: ${failedNames.join(", ")}`
        : "Tour angelegt – erscheint jetzt im Mitarbeiter-Link"
    );
    glasSelectedObjekte.clear();
    glasManualOrder = [];
    glasPreselectPositionen = null;
    glasShowNewTourForm = false;
    await loadGlasTouren();
  } catch (e) {
    showToast("Fehler: " + e.message);
  } finally {
    glasBusy = false;
    glasProgressText = "";
    renderGlasAdmin();
  }
}

async function deleteGlasTour(tourId) {
  if (!confirm("Diese Tour inkl. aller Abnahmescheine wirklich löschen?")) return;
  const { error } = await sb.from("glas_touren").delete().eq("id", tourId);
  if (error) { showToast("Fehler: " + error.message); return; }
  showToast("Tour gelöscht");
  glasTourDetailId = null;
  await loadGlasTouren();
  goGlasTab("touren");
}

/* ========================================================================
   Freier Einzelschein
   ======================================================================== */

function openGlasEinzelschein() {
  glasShowEinzelschein = true;
  glasKundePickerSearch = "";
  glasEinzelscheinData = {
    kunde_id: glasKunden[0]?.id || "",
    kunde_name: glasKunden[0]?.name || "",
    kunde_adresse: glasKunden[0] ? [glasKunden[0].name, glasKunden[0].adresse].filter(Boolean).join("\n") : "",
    objekt_id: "",
    objekt: "",
    adresse: "",
    kdnr: "",
    positionen: [{ nr: "10", art: glasPositionen[0]?.name || "", qm: "" }],
  };
  renderGlasAdmin();
}

let glasEinzelscheinData = null;

function closeGlasEinzelschein() {
  glasShowEinzelschein = false;
  glasEinzelscheinData = null;
  renderGlasAdmin();
}

function renderEinzelscheinForm() {
  const d = glasEinzelscheinData;
  const kundenOptions = glasKunden.map((k) => `<option value="${k.id}" ${k.id === d.kunde_id ? "selected" : ""}>${escapeHtml(k.name)}</option>`).join("");
  const objektOptions = glasObjekte
    .filter((o) => o.kunde_id === d.kunde_id)
    .map((o) => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join("");

  return `
    <button class="btn btn-sm" style="margin:16px 0;" onclick="closeGlasEinzelschein()">&larr; Zurück zu allen Touren</button>
    <div class="card">
      <h2>Einzelnen Schein erstellen</h2>
      <p class="muted" style="margin:0 0 12px;">Für spontane Termine ohne feste Routenplanung. Erscheint sofort im Mitarbeiter-Link.</p>
      <div class="field">
        <label class="muted">Kunde</label>
        <select id="es_kunde" onchange="onEsKundeChange()">${kundenOptions}</select>
      </div>
      <div class="field">
        <label class="muted">Bestehendes Objekt übernehmen (optional)</label>
        <select id="es_objekt" onchange="onEsObjektChange()">
          <option value="">— frei eintragen —</option>
          ${objektOptions}
        </select>
      </div>
      <div class="field">
        <label class="muted">Kunde-Adresse (Briefkopf)</label>
        <textarea id="es_kunde_adresse" rows="3">${escapeHtml(d.kunde_adresse)}</textarea>
      </div>
      <div class="field">
        <label class="muted">Objekt-Name</label>
        <input type="text" id="es_objekt_name" value="${escapeHtml(d.objekt)}" placeholder="Kita XY" />
      </div>
      <div class="field">
        <label class="muted">Adresse</label>
        <textarea id="es_adresse" rows="2" placeholder="Straße 1
44793 Bochum">${escapeHtml(d.adresse)}</textarea>
      </div>
      <div class="field">
        <label class="muted">Kd.-Nr.</label>
        <input type="text" id="es_kdnr" value="${escapeHtml(d.kdnr)}" />
      </div>
      <div class="row">
        <div class="field">
          <label class="muted">Datum</label>
          <input type="date" id="es_datum" value="${new Date().toISOString().slice(0, 10)}" />
        </div>
        <div class="field">
          <label class="muted">Template</label>
          <select id="es_template">
            <option value="geko">GEKO Clean</option>
            <option value="sub">Subunternehmen (Dietrich)</option>
          </select>
        </div>
      </div>
      <label class="muted">Positionen</label>
      ${renderEsPositionenRows(d.positionen)}
      <button class="btn btn-sm" style="margin:8px 0 4px;" onclick="addEsPositionRow()">+ Position hinzufügen</button>
      <button class="btn btn-primary" style="margin-top:14px;" onclick="saveEinzelschein()" ${glasBusy ? "disabled" : ""}>
        ${glasBusy ? `<span class="spinner"></span> Wird angelegt...` : "Schein erstellen"}
      </button>
    </div>
  `;
}

function renderEsPositionenRows(positionen) {
  return positionen
    .map((pos, i) => `
      <div class="row" style="align-items:flex-end; margin-bottom:4px;">
        <div class="field" style="flex:0 0 70px;"><label class="muted">Nr.</label><input type="text" id="es_pos_nr_${i}" value="${escapeHtml(pos.nr)}" /></div>
        <div class="field" style="flex:2;"><label class="muted">Art</label><input type="text" id="es_pos_art_${i}" value="${escapeHtml(pos.art)}" /></div>
        <div class="field" style="flex:1;"><label class="muted">QM</label><input type="text" id="es_pos_qm_${i}" value="${escapeHtml(pos.qm)}" /></div>
        ${positionen.length > 1 ? `<button class="btn btn-sm" style="margin-bottom:14px;" onclick="removeEsPositionRow(${i})">✕</button>` : ""}
      </div>`)
    .join("");
}

function syncEsFromDom() {
  const d = glasEinzelscheinData;
  d.positionen = d.positionen.map((pos, i) => ({
    nr: document.getElementById(`es_pos_nr_${i}`)?.value.trim() || pos.nr,
    art: document.getElementById(`es_pos_art_${i}`)?.value.trim() || pos.art,
    qm: document.getElementById(`es_pos_qm_${i}`)?.value.trim() ?? pos.qm,
  }));
  d.kunde_adresse = document.getElementById("es_kunde_adresse")?.value ?? d.kunde_adresse;
  d.objekt = document.getElementById("es_objekt_name")?.value ?? d.objekt;
  d.adresse = document.getElementById("es_adresse")?.value ?? d.adresse;
  d.kdnr = document.getElementById("es_kdnr")?.value ?? d.kdnr;
}

function addEsPositionRow() {
  syncEsFromDom();
  glasEinzelscheinData.positionen.push({ nr: "10", art: "", qm: "" });
  renderGlasAdmin();
}
function removeEsPositionRow(idx) {
  syncEsFromDom();
  glasEinzelscheinData.positionen.splice(idx, 1);
  renderGlasAdmin();
}

function onEsKundeChange() {
  syncEsFromDom();
  const sel = document.getElementById("es_kunde");
  const kunde = glasKunden.find((k) => k.id === sel.value);
  if (kunde) {
    glasEinzelscheinData.kunde_id = kunde.id;
    glasEinzelscheinData.kunde_name = kunde.name;
    glasEinzelscheinData.kunde_adresse = [kunde.name, kunde.adresse].filter(Boolean).join("\n");
  }
  renderGlasAdmin();
}

function onEsObjektChange() {
  syncEsFromDom();
  const sel = document.getElementById("es_objekt");
  const o = glasObjekte.find((x) => x.id === sel.value);
  if (o) {
    glasEinzelscheinData.objekt_id = o.id;
    glasEinzelscheinData.objekt = o.name;
    glasEinzelscheinData.adresse = o.adresse;
    glasEinzelscheinData.kdnr = o.kdnr;
    const positionen = glasGetObjektPositionen(o.id);
    if (positionen.length) glasEinzelscheinData.positionen = positionen.map((p) => ({ nr: p.nr, art: p.art, qm: p.qm }));
  } else {
    glasEinzelscheinData.objekt_id = "";
  }
  renderGlasAdmin();
}

async function saveEinzelschein() {
  if (glasBusy) return;
  syncEsFromDom();
  const d = glasEinzelscheinData;
  const datum = document.getElementById("es_datum").value;
  const template = document.getElementById("es_template").value;
  if (!d.objekt.trim()) { showToast("Bitte einen Objekt-Namen eintragen"); return; }
  if (!d.adresse.trim()) { showToast("Bitte eine Adresse eintragen"); return; }

  glasBusy = true;
  renderGlasAdmin();

  let coords = { lat: null, lng: null };
  if (d.objekt_id) {
    const o = glasObjekte.find((x) => x.id === d.objekt_id);
    coords = { lat: o?.lat, lng: o?.lng };
  } else {
    try {
      const { strasse, plz, ort } = glasSplitAdresse(d.adresse);
      coords = await glasGeocode(`${strasse}, ${plz} ${ort}`);
    } catch (e) { /* keine Koordinaten - für einen Einzelschein nicht kritisch */ }
  }

  const tourId = genCode();
  const positionen = d.positionen.filter((p) => p.art || p.qm);
  const { error: tourErr } = await sb.from("glas_touren").insert({
    id: tourId, name: `Einzelschein – ${d.objekt}`, datum: datum || null, template, frei: true,
  });
  if (tourErr) { glasBusy = false; showToast("Fehler: " + tourErr.message); renderGlasAdmin(); return; }

  const { error: stoppErr } = await sb.from("glas_stopps").insert({
    id: genCode(), tour_id: tourId, objekt_id: d.objekt_id || null, reihenfolge: 0,
    objekt: d.objekt, adresse: d.adresse, kdnr: d.kdnr, kunde_adresse: d.kunde_adresse,
    positionen: JSON.stringify(positionen), lat: coords.lat, lng: coords.lng, status: "offen",
  });
  glasBusy = false;
  if (stoppErr) { showToast("Fehler: " + stoppErr.message); renderGlasAdmin(); return; }

  showToast("Einzelschein erstellt – erscheint jetzt im Mitarbeiter-Link");
  closeGlasEinzelschein();
  await loadGlasTouren();
}

/* ========================================================================
   Kalender-Tab (Geplant + Offene Liste)
   ======================================================================== */

function renderKalenderTab() {
  return `
    <div style="display:flex; gap:8px; margin:16px 0;">
      <button class="btn btn-sm ${glasKalenderSub === "kalender" ? "btn-primary" : ""}" style="flex:1; justify-content:center;" onclick="glasKalenderSub = 'kalender'; renderGlasAdmin();">📅 Kalender</button>
      <button class="btn btn-sm ${glasKalenderSub === "offen" ? "btn-primary" : ""}" style="flex:1; justify-content:center;" onclick="glasKalenderSub = 'offen'; renderGlasAdmin();">⏰ Offene Liste</button>
    </div>
    ${glasKalenderSub === "offen" ? renderOffeneListe() : renderKalenderMonat()}
  `;
}

function glasTourenAmTag(iso) {
  return glasTouren.filter((t) => t.datum === iso);
}

function renderKalenderMonat() {
  const { year, month } = glasKalenderMonth; // month: 0-11
  const monatsNamen = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7; // Montag = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = glasTodayIso();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const cellsHtml = cells
    .map((d) => {
      if (!d) return `<div></div>`;
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const touren = glasTourenAmTag(iso);
      const isToday = iso === todayIso;
      const isSelected = iso === glasKalenderSelectedDay;
      return `
        <div onclick="glasKalenderSelectedDay = '${iso}'; renderGlasAdmin();" style="aspect-ratio:1; display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:10px; cursor:pointer; gap:3px; ${isSelected ? "background:var(--blue); color:white;" : isToday ? "background:#eaf2fb;" : ""}">
          <span style="font-size:13px; font-weight:${isToday || isSelected ? "700" : "500"};">${d}</span>
          ${touren.length ? `<span style="width:5px; height:5px; border-radius:50%; background:${isSelected ? "white" : "var(--blue)"};"></span>` : ""}
        </div>`;
    })
    .join("");

  const selectedTouren = glasKalenderSelectedDay ? glasTourenAmTag(glasKalenderSelectedDay) : [];

  return `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <button class="btn btn-sm" onclick="glasKalenderShiftMonth(-1)">‹</button>
        <p style="margin:0; font-weight:700;">${monatsNamen[month]} ${year}</p>
        <button class="btn btn-sm" onclick="glasKalenderShiftMonth(1)">›</button>
      </div>
      <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px; margin-bottom:6px;">
        ${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => `<div class="muted" style="text-align:center; font-size:11px; font-weight:600;">${d}</div>`).join("")}
      </div>
      <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px;">${cellsHtml}</div>
      <button class="btn btn-sm" style="margin-top:14px;" onclick="glasKalenderMonth = { year: new Date().getFullYear(), month: new Date().getMonth() }; glasKalenderSelectedDay = new Date().toISOString().slice(0,10); renderGlasAdmin();">Heute</button>
    </div>
    ${glasKalenderSelectedDay ? `
    <div class="card">
      <p style="margin:0 0 10px; font-weight:600;">${formatGlasDate(glasKalenderSelectedDay)}</p>
      ${selectedTouren.length ? selectedTouren.map((t) => `
        <div style="padding:10px 0; border-top:1px solid var(--border); cursor:pointer;" onclick="glasNavigate({type:'tabs', tab:'touren'}); openGlasTourDetail('${t.id}');">
          <p style="margin:0; font-weight:500;">${t.name ? escapeHtml(t.name) : "Ohne Namen"}</p>
          <p class="muted" style="margin:2px 0 0; font-size:12.5px;">${(t.glas_stopps || []).length} Stopp(s)</p>
        </div>`).join("") : `<p class="muted">Keine Tour an diesem Tag geplant.</p>`}
    </div>` : ""}
  `;
}

function glasKalenderShiftMonth(delta) {
  let { year, month } = glasKalenderMonth;
  month += delta;
  if (month < 0) { month = 11; year--; }
  if (month > 11) { month = 0; year++; }
  glasKalenderMonth = { year, month };
  renderGlasAdmin();
}

// Alle Positionen aller Objekte, die überfällig oder demnächst fällig sind (rutscht aus
// Vormonaten automatisch durch, bis erledigt oder manuell verschoben).
function glasAlleOffenenPositionen() {
  const result = [];
  glasObjekte.forEach((o) => {
    glasGetObjektPositionen(o.id).forEach((p) => {
      const f = glasFaelligkeitStatus(p);
      if (f.status === "ueberfaellig" || f.status === "bald") {
        result.push({ objekt: o, position: p, ...f });
      }
    });
  });
  result.sort((a, b) => a.faelligkeit.localeCompare(b.faelligkeit));
  return result;
}

function renderOffeneListe() {
  const all = glasAlleOffenenPositionen();
  const q = glasOffeneSearch.trim().toLowerCase();
  const filtered = q ? all.filter((x) => `${x.objekt.name} ${x.objekt.kunde_name}`.toLowerCase().includes(q)) : all;

  const rows = filtered.map((x) => {
    const key = `${x.objekt.id}::${x.position.id || x.position.nr}`;
    const checked = glasOffeneSelected.has(key);
    return `
      <div class="card" style="display:flex; align-items:flex-start; gap:12px; ${x.status === "ueberfaellig" ? "border-color:#f3c9c2;" : "border-color:#f0dca6;"}">
        <input type="checkbox" style="width:auto; margin-top:3px;" ${checked ? "checked" : ""} onchange="toggleGlasOffeneSelect('${key}')" />
        <div style="flex:1; min-width:0; cursor:pointer;" onclick="goGlasObjekt('${x.objekt.id}')">
          <p style="margin:0; font-weight:600;">${escapeHtml(x.objekt.name)}</p>
          <p class="muted" style="margin:2px 0 0; font-size:12.5px;">${escapeHtml(x.objekt.kunde_name || "")} · Pos. ${escapeHtml(x.position.nr)} ${escapeHtml(x.position.art)}</p>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <span class="badge ${x.status === "ueberfaellig" ? "badge-danger" : "badge-open"}">${x.status === "ueberfaellig" ? `${Math.abs(x.tage)}T überfällig` : `in ${x.tage}T`}</span>
          <br/>
          <button class="btn btn-sm" style="margin-top:6px; padding:4px 8px; font-size:11.5px;" onclick="glasVerschiebePosition('${x.objekt.id}','${x.position.id}')">📅 Verschieben</button>
        </div>
      </div>`;
  }).join("");

  return `
    <div style="display:flex; gap:8px; margin-bottom:14px;">
      <input type="text" id="offen_search" placeholder="🔍 Objekt/Kunde suchen..." value="${escapeHtml(glasOffeneSearch)}" />
    </div>
    ${glasOffeneSelected.size ? `
      <button class="btn btn-primary" style="width:100%; justify-content:center; margin-bottom:14px;" onclick="glasOffeneZuTourHinzufuegen()">
        ${glasOffeneSelected.size} ausgewählte zu neuer Tour hinzufügen
      </button>` : ""}
    ${filtered.length ? rows : `<p class="muted">Aktuell nichts fällig oder überfällig. 🎉</p>`}
  `;
}

function toggleGlasOffeneSelect(key) {
  if (glasOffeneSelected.has(key)) glasOffeneSelected.delete(key);
  else glasOffeneSelected.add(key);
  renderGlasAdmin();
}

function glasVerschiebePosition(objektId, positionId) {
  const neuesDatum = prompt("Neue Fälligkeit (JJJJ-MM-TT):", glasAddDaysIso(glasTodayIso(), 30));
  if (!neuesDatum) return;
  sb.from("glas_objekt_positionen").update({ faelligkeit_override: neuesDatum }).eq("id", positionId).then(({ error }) => {
    if (error) { showToast("Fehler: " + error.message); return; }
    showToast("Fälligkeit verschoben");
    loadGlasObjektPositionen().then(renderGlasAdmin);
  });
}

function glasOffeneZuTourHinzufuegen() {
  const map = new Map();
  const objektIds = new Set();
  glasOffeneSelected.forEach((key) => {
    const [objektId, positionId] = key.split("::");
    objektIds.add(objektId);
    if (!map.has(objektId)) map.set(objektId, new Set());
    map.get(objektId).add(positionId);
  });
  glasOffeneSelected.clear();
  // goGlasTab() setzt u.a. glasShowNewTourForm zurück auf false, deshalb erst danach setzen.
  goGlasTab("touren");
  glasSelectedObjekte = objektIds;
  glasPreselectPositionen = map;
  glasShowNewTourForm = true;
  renderGlasAdmin();
}

glasInit();
