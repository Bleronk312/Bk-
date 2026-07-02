document.title = (typeof FIRMA_NAME !== "undefined" ? FIRMA_NAME : "GEKO") + " - Glasreinigung";

(function initGlasHeader() {
  const wm = document.getElementById("watermarkImg");
  const badge = document.getElementById("badgeLogoImg");
  if (typeof GEKO_LOGO_TRANSPARENT_B64 !== "undefined") {
    if (wm) wm.src = GEKO_LOGO_TRANSPARENT_B64;
    if (badge) badge.src = GEKO_LOGO_TRANSPARENT_B64;
  }
})();

let glasKunden = [];
let glasObjekte = [];
let glasTouren = [];
let glasPositionen = [];
let glasTab = "touren";
let glasObjektEditing = null; // null = keine Bearbeitung, {} = neu, {...} = bestehendes Objekt
let glasObjektExpandedId = null;
let glasObjektSearch = "";
let glasTourSearch = "";
let glasBusy = false;
let glasProgressText = "";
let glasSelectedObjekte = new Set();
let glasObjektGroupsExpanded = new Set(); // Kunde-Namen, deren Gruppe in der Objekte-Liste aufgeklappt ist
let glasTourGroupsExpanded = new Set();   // Kunde-Namen, deren Gruppe in der Touren-Auswahl aufgeklappt ist
let glasShowNewTourForm = false;
let glasTourDetailId = null;
let glasRoutingMode = "smart"; // "smart" oder "manual"
let glasManualOrder = []; // Array von Objekt-IDs in der vom Admin festgelegten Reihenfolge

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

async function glasInit() {
  await Promise.all([loadGlasKunden(), loadGlasObjekte(), loadGlasTouren(), loadGlasPositionen()]);
  renderGlasAdmin();
}

async function loadGlasPositionen() {
  const { data, error } = await sb.from("glas_positionen").select("*").order("name", { ascending: true });
  if (!error) glasPositionen = data || [];
}

// Liest die Positionen eines Objekts (neues JSON-Feld, mit Fallback auf die alten
// Einzelfelder position/qm für Objekte aus einer früheren Version)
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

async function loadGlasKunden() {
  const { data, error } = await sb.from("kunden").select("*").order("name", { ascending: true });
  if (!error) glasKunden = data || [];
}

async function loadGlasObjekte() {
  const { data, error } = await sb.from("glas_objekte").select("*").order("name", { ascending: true });
  if (!error) glasObjekte = data || [];
}

async function loadGlasTouren() {
  const { data, error } = await sb
    .from("glas_touren")
    .select("*, glas_stopps(id, status)")
    .order("datum", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);
  if (!error) glasTouren = data || [];
}

function switchGlasTab(tab) {
  glasTab = tab;
  glasObjektEditing = null;
  glasShowNewTourForm = false;
  glasTourDetailId = null;
  glasPositionEditingId = null;
  glasRoutingMode = "smart";
  glasManualOrder = [];
  renderGlasAdmin();
}

function renderGlasAdmin() {
  const view = document.getElementById("view");
  view.innerHTML = `
    <div class="tabs">
      <button class="tab-btn ${glasTab === "touren" ? "active" : ""}" onclick="switchGlasTab('touren')">Touren planen</button>
      <button class="tab-btn ${glasTab === "objekte" ? "active" : ""}" onclick="switchGlasTab('objekte')">Objekte (Kitas)</button>
      <button class="tab-btn ${glasTab === "positionen" ? "active" : ""}" onclick="switchGlasTab('positionen')">Positionen</button>
    </div>
    <div id="glasTabContent"></div>
  `;
  const content = document.getElementById("glasTabContent");
  content.innerHTML = glasTab === "objekte" ? renderObjekteTab() : glasTab === "positionen" ? renderPositionenTab() : renderTourenTab();
  if (glasTab === "objekte") {
    const searchEl = document.getElementById("obj_search");
    if (searchEl) searchEl.oninput = (e) => { glasObjektSearch = e.target.value; renderGlasAdmin(); focusSearch("obj_search"); };
  }
  if (glasTab === "touren" && glasShowNewTourForm && !glasTourDetailId) {
    attachGlasCheckboxHandlers();
    const searchEl = document.getElementById("tour_obj_search");
    if (searchEl) searchEl.oninput = (e) => { glasTourSearch = e.target.value; renderGlasAdmin(); focusSearch("tour_obj_search"); };
  }
}

function focusSearch(id) {
  const el = document.getElementById(id);
  if (el) { el.focus(); const v = el.value; el.value = ""; el.value = v; }
}

function matchesSearch(o, q) {
  if (!q) return true;
  const hay = `${o.name} ${o.adresse} ${o.kunde_name} ${o.kdnr}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

/* ---------------- Objekte-Tab ---------------- */

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
          // Beim Suchen automatisch aufklappen, damit Treffer sichtbar sind
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
  const isOpen = glasObjektExpandedId === o.id;
  return `
    <div style="border-top:1px solid var(--border);">
      <div style="padding:12px 18px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="toggleGlasObjekt('${o.id}')">
        <div>
          <p style="margin:0; font-weight:500;">${escapeHtml(o.name)}</p>
          <p class="muted" style="margin:2px 0 0; font-size:12.5px;">${escapeHtml((o.adresse || "").split("\n").join(", "))}${o.lat ? "" : " · ⚠️ nicht geocodiert"}</p>
        </div>
        <span style="font-size:15px; color:var(--text-secondary);">${isOpen ? "▲" : "▼"}</span>
      </div>
      ${isOpen ? `
      <div style="padding:0 18px 14px;">
        <p class="muted" style="margin:0 0 12px;">Kd.-Nr.: ${escapeHtml(o.kdnr)} · ${glasParsePositionen(o).map((p) => `Pos. ${escapeHtml(p.nr)}: ${escapeHtml(p.art)} (${escapeHtml(p.qm)} qm)`).join(" · ")}</p>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-sm" onclick='editGlasObjekt(${JSON.stringify(o.id)})'>Bearbeiten</button>
          <button class="btn btn-sm" style="color:var(--danger);" onclick="deleteGlasObjekt('${o.id}')">Löschen</button>
        </div>
      </div>` : ""}
    </div>`;
}

function toggleGlasObjektGroup(kunde) {
  if (glasObjektGroupsExpanded.has(kunde)) glasObjektGroupsExpanded.delete(kunde);
  else glasObjektGroupsExpanded.add(kunde);
  renderGlasAdmin();
}

function toggleGlasObjekt(id) {
  glasObjektExpandedId = glasObjektExpandedId === id ? null : id;
  renderGlasAdmin();
}

function editGlasObjekt(id) {
  if (id === null) {
    const firstKunde = glasKunden[0];
    glasObjektEditing = {
      id: null,
      kunde_id: firstKunde ? firstKunde.id : "",
      kunde_adresse: firstKunde ? [firstKunde.name, firstKunde.adresse].filter(Boolean).join("\n") : "",
      name: "",
      adresse: "",
      kdnr: "",
      positionen: [{ nr: glasPositionen[0]?.nr || "10", art: glasPositionen[0]?.name || "", qm: "" }],
    };
  } else {
    const o = glasObjekte.find((x) => x.id === id);
    glasObjektEditing = { ...o, positionen: glasParsePositionen(o) };
  }
  renderGlasAdmin();
}

function cancelGlasObjektEdit() {
  glasObjektEditing = null;
  renderGlasAdmin();
}

function onGlasObjektKundeChange() {
  const sel = document.getElementById("o_kunde");
  const kunde = glasKunden.find((k) => k.id === sel.value);
  if (kunde) {
    document.getElementById("o_kunde_adresse").value = [kunde.name, kunde.adresse].filter(Boolean).join("\n");
  }
}

function renderObjektForm() {
  const o = glasObjektEditing;
  const { strasse, plz, ort } = glasSplitAdresse(o.adresse);
  const kundenOptions = glasKunden
    .map((k) => `<option value="${k.id}" ${k.id === o.kunde_id ? "selected" : ""}>${escapeHtml(k.name)}</option>`)
    .join("");

  return `
    <div class="card" style="margin-top:16px;">
      <h2>${o.id ? "Objekt bearbeiten" : "Neues Objekt"}</h2>
      ${glasKunden.length ? "" : `<p class="muted">Noch keine Kunden angelegt. Erst in der normalen Abnahme-App unter "Kunden" einen Kunden anlegen.</p>`}
      <div class="field">
        <label class="muted">Kunde / Träger</label>
        <select id="o_kunde" onchange="onGlasObjektKundeChange()">${kundenOptions}</select>
      </div>
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
      <label class="muted">Positionen</label>
      ${renderPositionenRows(o.positionen)}
      <button class="btn btn-sm" style="margin:8px 0 4px;" onclick="addPositionRow()">+ Position hinzufügen</button>
      <div style="display:flex; gap:8px; margin-top:12px;">
        <button class="btn btn-primary" onclick="saveGlasObjekt()" ${glasBusy ? "disabled" : ""}>
          ${glasBusy ? `<span class="spinner"></span> ${escapeHtml(glasProgressText || "Speichere...")}` : "Speichern"}
        </button>
        <button class="btn btn-sm" onclick="cancelGlasObjektEdit()">Abbrechen</button>
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
    .map(
      (pos, i) => `
      <div class="row" style="align-items:flex-end; margin-bottom:4px;">
        <div class="field" style="flex:0 0 70px;">
          <label class="muted">Nr.</label>
          <input type="text" id="pos_nr_${i}" value="${escapeHtml(pos.nr)}" />
        </div>
        <div class="field" style="flex:2;">
          <label class="muted">Art</label>
          <select id="pos_art_${i}" onchange="onGlasPositionArtChange(${i})">${positionenOptions(pos.art)}</select>
        </div>
        <div class="field" style="flex:1;">
          <label class="muted">QM</label>
          <input type="text" id="pos_qm_${i}" value="${escapeHtml(pos.qm)}" placeholder="144,50" />
        </div>
        ${positionen.length > 1 ? `<button class="btn btn-sm" style="margin-bottom:14px;" onclick="removePositionRow(${i})">✕</button>` : ""}
      </div>`
    )
    .join("");
}

function onGlasPositionArtChange(i) {
  const select = document.getElementById(`pos_art_${i}`);
  const nr = select.options[select.selectedIndex]?.getAttribute("data-nr");
  if (nr) document.getElementById(`pos_nr_${i}`).value = nr;
}

function syncPositionenFromDom() {
  if (!glasObjektEditing) return;
  glasObjektEditing.positionen = glasObjektEditing.positionen.map((pos, i) => ({
    nr: document.getElementById(`pos_nr_${i}`)?.value.trim() || pos.nr,
    art: document.getElementById(`pos_art_${i}`)?.value || pos.art,
    qm: document.getElementById(`pos_qm_${i}`)?.value.trim() ?? pos.qm,
  }));
}

function addPositionRow() {
  syncPositionenFromDom();
  glasObjektEditing.positionen.push({ nr: glasPositionen[0]?.nr || "10", art: glasPositionen[0]?.name || "", qm: "" });
  renderGlasAdmin();
}

function removePositionRow(idx) {
  syncPositionenFromDom();
  glasObjektEditing.positionen.splice(idx, 1);
  renderGlasAdmin();
}

async function saveGlasObjekt() {
  if (glasBusy) return;
  syncPositionenFromDom();
  const kundeSel = document.getElementById("o_kunde");
  const kundeId = kundeSel.value;
  const kundeName = kundeSel.options[kundeSel.selectedIndex]?.text || "";
  const kundeAdresse = document.getElementById("o_kunde_adresse").value.trim();
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

  const payload = {
    id: glasObjektEditing.id || genCode(),
    kunde_id: kundeId,
    kunde_name: kundeName,
    kunde_adresse: kundeAdresse,
    name,
    adresse,
    kdnr,
    positionen: JSON.stringify(positionen),
    lat: coords.lat,
    lng: coords.lng,
  };

  const { error } = await sb.from("glas_objekte").upsert(payload);
  glasBusy = false;
  glasProgressText = "";
  if (error) { showToast("Fehler: " + error.message); renderGlasAdmin(); return; }

  if (geocodeFailed) {
    showToast("Objekt gespeichert – Adresse konnte gar nicht gefunden werden (Route setzt es ans Ende)");
  } else if (geocodeApproximate) {
    showToast("Objekt gespeichert – nur ungefähre Position gefunden (Straße evtl. nicht exakt getroffen)");
  } else {
    showToast("Objekt gespeichert");
  }
  glasObjektEditing = null;
  await loadGlasObjekte();
  renderGlasAdmin();
}

async function deleteGlasObjekt(id) {
  if (!confirm("Dieses Objekt wirklich löschen? (Bereits erstellte Touren bleiben erhalten)")) return;
  const { error } = await sb.from("glas_objekte").delete().eq("id", id);
  if (error) { showToast("Fehler: " + error.message); return; }
  showToast("Objekt gelöscht");
  await loadGlasObjekte();
  renderGlasAdmin();
}

/* ---------------- Positionen-Tab ---------------- */

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

let glasTourDetailStops = [];

function renderTourenTab() {
  if (glasTourDetailId) return renderTourDetailView();
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
                  <p style="margin:0 0 4px; font-weight:600;">${t.name ? escapeHtml(t.name) : (t.datum ? formatGlasDate(t.datum) : "Ohne Namen")}</p>
                  <p class="muted" style="margin:0;">${t.datum ? formatGlasDate(t.datum) : "Ohne Datum"} · ${stops.length} Stopp(s) · ${done}/${stops.length} erledigt</p>
                </div>
                <span style="font-size:18px; color:var(--text-secondary);">›</span>
              </div>
            </div>`;
        })
        .join("")
    : `<p class="muted">Noch keine Touren angelegt.</p>`;

  return `
    <button class="btn btn-primary" style="margin:16px 0;" onclick="glasShowNewTourForm = true; glasRoutingMode = 'smart'; glasManualOrder = []; glasSelectedObjekte.clear(); renderGlasAdmin();">+ Neue Tour anlegen</button>
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
    <button class="btn btn-sm" style="margin:16px 0;" onclick="glasShowNewTourForm = false; renderGlasAdmin();">&larr; Zurück zu allen Touren</button>
    <div class="card">
      <h2>Neue Tour anlegen</h2>
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

    const stoppRows = ordered.map((o, idx) => ({
      id: genCode(),
      tour_id: tourId,
      objekt_id: o.id,
      reihenfolge: idx,
      objekt: o.name,
      adresse: o.adresse,
      kdnr: o.kdnr,
      kunde_adresse: o.kunde_adresse,
      position: o.position,
      qm: o.qm,
      positionen: o.positionen || "",
      lat: o.lat,
      lng: o.lng,
      status: "offen",
    }));
    const { error: stoppErr } = await sb.from("glas_stopps").insert(stoppRows);
    if (stoppErr) throw stoppErr;

    showToast(
      failedNames.length
        ? `Tour angelegt – Adresse(n) nicht gefunden, ans Ende gesetzt: ${failedNames.join(", ")}`
        : "Tour angelegt – erscheint jetzt im Mitarbeiter-Link"
    );
    glasSelectedObjekte.clear();
    glasManualOrder = [];
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
  await loadGlasTouren();
  renderGlasAdmin();
}

glasInit();
