document.title = "Glasreinigung - Meine Touren";

(function initGlasHeader() {
  const wm = document.getElementById("watermarkImg");
  const badge = document.getElementById("badgeLogoImg");
  if (typeof GEKO_LOGO_TRANSPARENT_B64 !== "undefined") {
    if (wm) wm.src = GEKO_LOGO_TRANSPARENT_B64;
    if (badge) badge.src = GEKO_LOGO_TRANSPARENT_B64;
  }
})();

let glasTouren = [];
let glasMaScreen = "home"; // "home" (Logo-Startseite) | "touren"
let glasOpenTourId = null; // gerade geöffnete Tour im Vollbild (ersetzt die Liste)
let glasOpenStopId = null; // aufgeklappter Stopp (Akkordeon)
let glasSignStopId = null; // Stopp, bei dem gerade das Unterschrift-Formular offen ist
let glasSigPad = null;
let glasFrueherExpanded = false; // "Frühere Touren"-Abschnitt aufgeklappt



function todayIso() {
  const d = new Date(); // lokale Zeit - toISOString() wäre UTC und nachts einen Tag daneben
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

async function glasMaInit() {
  renderGlasMa(); // Startseite sofort zeigen, Touren laden im Hintergrund
  await glasFlushSignQueue(); // eventuell offline gesammelte Unterschriften zuerst nachsenden
  await loadGlasTouren();
  renderGlasMa();
}

// ---------------- Offline-Unterschriften ----------------
// Im Objekt ist oft kein Empfang. Unterschriften werden dann lokal in einer Warteschlange
// gesichert und automatisch gesendet, sobald wieder Netz da ist. Der Stopp erscheint sofort
// als erledigt (mit Hinweis "wird gesendet"), damit der Mitarbeiter weitermachen kann.

function glasLoadSignQueue() {
  try { return JSON.parse(localStorage.getItem("glas_pending_signs") || "[]"); } catch (e) { return []; }
}

function glasSaveSignQueue(q) {
  try { localStorage.setItem("glas_pending_signs", JSON.stringify(q)); } catch (e) {}
}

function glasQueueSign(item) {
  const q = glasLoadSignQueue();
  q.push(item);
  glasSaveSignQueue(q);
}

// supabase-js WIRFT bei Netzproblemen nicht, sondern gibt den Fehler zurück - deshalb
// hier unterscheiden: Netzfehler -> offline zwischenspeichern; echte Server-Antwort
// (z.B. Constraint/RLS) -> Fehler anzeigen, NICHT als "gespeichert" ausgeben.
function glasIstNetzFehler(err) {
  const m = String((err && err.message) || err || "").toLowerCase();
  return m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed")
    || m.includes("fetch failed") || m.includes("network request failed") || m.includes("timeout")
    || m.includes("abgebrochen") || m.includes("internet");
}

// Legt die noch nicht gesendeten Unterschriften über die geladenen Touren, damit die
// Stopps auch nach einem Neuladen als erledigt erscheinen, bis sie wirklich in der DB sind.
function glasApplyPendingSigns() {
  const q = glasLoadSignQueue();
  if (!q.length) return;
  for (const item of q) {
    for (const t of glasTouren) {
      const stop = t.stopps.find((s) => s.id === item.stopId);
      if (stop) Object.assign(stop, { name: item.name, datum: item.datum, unterschrift: item.unterschrift, zusatz: item.zusatz, status: "erledigt", signed_at: item.signedAt, __pendingSync: true });
    }
  }
}

// Sendet die Warteschlange ab. Nur bei Erfolg wird ein Eintrag entfernt.
async function glasFlushSignQueue() {
  let q = glasLoadSignQueue();
  if (!q.length) return;
  const remaining = [];
  let sent = 0;
  for (const item of q) {
    try {
      const { error } = await glasSignStop(item.stopId, item.positionen, item.name, item.datum, item.unterschrift, item.zusatz, item.signedAt);
      if (error) { remaining.push(item); } else {
        sent++;
        // Büro benachrichtigen - genauso wie bei einer direkt online erfassten Unterschrift
        glasPushUnterschriftAnAdmin({ objekt: item.objekt }, item.name, item.zusatz, item.tour);
      }
    } catch (e) { remaining.push(item); }
  }
  glasSaveSignQueue(remaining);
  if (sent > 0) showToast(sent === 1 ? "Offline-Unterschrift wurde gesendet" : `${sent} Offline-Unterschriften wurden gesendet`);
}

// Nachsenden anstoßen (Warteschlange leeren + Ansicht auffrischen). Wird an mehreren
// Stellen ausgelöst, damit die Unterschriften zuverlässig im Büro ankommen, ohne dass
// der Mitarbeiter etwas tun muss.
let glasFlushLaeuft = false;
async function glasTrySync() {
  if (glasFlushLaeuft || !navigator.onLine) return;
  if (!glasLoadSignQueue().length) return;
  glasFlushLaeuft = true;
  try {
    await glasFlushSignQueue();
    await loadGlasTouren();
    renderGlasMa();
  } finally {
    glasFlushLaeuft = false;
  }
}

// 1) Sobald das Gerät wieder online meldet.
window.addEventListener("online", glasTrySync);
// 2) Sobald die App wieder in den Vordergrund kommt (z.B. Mitarbeiter ist zurück im Büro
//    und holt das Handy raus) - das "online"-Event ist besonders auf iPhones unzuverlässig.
document.addEventListener("visibilitychange", () => { if (!document.hidden) glasTrySync(); });
// 3) Als Sicherheitsnetz alle 60 Sekunden, solange etwas in der Warteschlange liegt.
setInterval(glasTrySync, 60000);

// Logo oben links -> zurück zur Startseite (schließt auch eine offene Tour)
function glasMaGoHome() {
  glasMaScreen = "home";
  glasOpenTourId = null;
  glasOpenStopId = null;
  glasSignStopId = null;
  renderGlasMa();
}

async function loadGlasTouren() {
  try {
    const { data: touren, error } = await sb
      .from("glas_touren")
      .select("*")
      .order("datum", { ascending: false })
      .limit(60);
    if (error) throw error;
    const { data: stops, error: e2 } = await sb
      .from("glas_stopps")
      .select("*")
      .order("reihenfolge", { ascending: true });
    if (e2) throw e2;

    glasTouren = (touren || [])
      // archivierte + vom Admin ausgeblendete Touren gehören nicht in die Mitarbeiter-Ansicht
      .filter((t) => !t.archiviert_am && !t.ma_versteckt)
      .map((t) => ({
        ...t,
        stopps: (stops || []).filter((s) => s.tour_id === t.id),
      }));
    // Letzten Stand für den Offline-Fall sichern (im Objekt oft kein Empfang).
    // Unterschrift-Bilder (große Base64-PNGs) werden dabei weggelassen, sonst sprengen
    // ein paar unterschriebene Touren das localStorage-Limit und es gäbe GAR keinen
    // Offline-Fallback mehr. Offline fehlt dann nur das Bild bei alten Unterschriften.
    try {
      const schlank = glasTouren.map((t) => ({ ...t, stopps: t.stopps.map((s) => ({ ...s, unterschrift: s.unterschrift ? "" : s.unterschrift })) }));
      localStorage.setItem("glas_touren_cache", JSON.stringify(schlank));
    } catch (e) {}
    glasOfflineModus = false;
  } catch (err) {
    // Offline oder Serverfehler -> auf die zuletzt gespeicherten Touren zurückfallen
    glasOfflineModus = true;
    const cached = glasLoadTourenCache();
    if (cached && cached.length) {
      glasTouren = cached;
    } else {
      glasTouren = [];
    }
  }
  // Offline unterschriebene Stopps lokal drüberlegen, bis sie gesendet sind
  glasApplyPendingSigns();
}

let glasOfflineModus = false;

function glasLoadTourenCache() {
  try { return JSON.parse(localStorage.getItem("glas_touren_cache") || "[]"); } catch (e) { return []; }
}

function glasSingleMapLinks(stop) {
  const query = encodeURIComponent(`${stop.adresse || ""}`.replace(/\n/g, ", "));
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}&travelmode=driving`,
    apple: `https://maps.apple.com/?daddr=${stop.lat},${stop.lng}&q=${query}`,
    waze: `https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes`,
  };
}

function renderGlasMa() {
  const view = document.getElementById("view");

  if (glasMaScreen === "home") {
    const heute = glasTouren.filter((t) => t.datum && t.datum <= todayIso() && todayIso() <= (t.datum_bis || t.datum)).length;
    view.innerHTML = `
      <div class="glas-welcome">
        <img class="glas-welcome-logo" src="${typeof GEKO_LOGO_TRANSPARENT_B64 !== "undefined" ? GEKO_LOGO_TRANSPARENT_B64 : ""}" alt="GEKO" />
        <p class="glas-welcome-title">Hallo GEKO Clean <span class="glas-welcome-heart">❤️</span></p>
        <p class="glas-welcome-sub">Schön, dass du da bist!</p>
        <div class="glas-welcome-buttons">
          <button class="btn btn-primary glas-welcome-btn" style="animation-delay:0.35s;" onclick="glasMaScreen = 'touren'; renderGlasMa();">
            🚐 Meine Touren${heute ? ` <span class="badge" style="background:rgba(255,255,255,0.25); color:white; margin-left:6px;">${heute} heute</span>` : ""}
          </button>
        </div>
      </div>`;
    return;
  }

  if (glasOpenTourId) {
    const t = glasTouren.find((x) => x.id === glasOpenTourId);
    if (t) {
      view.innerHTML = renderGlasTourScreen(t);
      if (glasSignStopId) setTimeout(() => setupGlasSigPad(), 30);
      return;
    }
  }

  if (!glasTouren.length) {
    view.innerHTML = `
      <button class="btn btn-sm" style="margin:16px 0;" onclick="glasMaScreen = 'home'; renderGlasMa();">&larr; Start</button>
      ${glasOfflineBanner()}
      <div class="glas-empty">
        <div class="glas-empty-icon">${glasOfflineModus ? "📴" : "🧽"}</div>
        <p style="font-weight:600; font-size:16px;">${glasOfflineModus ? "Offline – noch nichts gespeichert" : "Noch keine Tour für dich"}</p>
        <p class="muted" style="margin-top:4px;">${glasOfflineModus ? "Bitte die App einmal mit Internet öffnen – danach sind deine Touren auch offline da." : "Sobald eine Tour für dich geplant ist, erscheint sie hier automatisch."}</p>
      </div>`;
    return;
  }

  view.innerHTML = `
    <button class="btn btn-sm" style="margin:16px 0 4px;" onclick="glasMaScreen = 'home'; renderGlasMa();">&larr; Start</button>
    ${glasOfflineBanner()}
    ${renderGlasTourList()}`;
}

// Deutlich sichtbarer Hinweis, dass gerade der zuletzt gespeicherte (Offline-)Stand
// gezeigt wird - damit klar ist, dass die App NICHT hängt, sondern nur kein Netz hat.
function glasOfflineBanner() {
  if (!glasOfflineModus) return "";
  const wartend = glasLoadSignQueue().length;
  return `<div style="background:var(--warning-bg); border:1px solid #e0b64a; border-radius:10px; padding:10px 12px; margin:6px 0 12px; font-size:13px;">
    📴 <b>Offline</b> – zuletzt gespeicherter Stand.${wartend ? ` ${wartend} Unterschrift(en) warten aufs Senden.` : ""} Sobald wieder Empfang da ist, aktualisiert sich alles automatisch.
  </div>`;
}

function glasTourProgress(t) {
  const total = t.stopps.length;
  const done = t.stopps.filter((s) => s.status === "erledigt").length;
  const allDone = total > 0 && done === total;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { total, done, allDone, pct };
}

function renderGlasTourCard(t) {
  const { total, done, allDone, pct } = glasTourProgress(t);
  const isToday = !!t.datum && t.datum <= todayIso() && todayIso() <= (t.datum_bis || t.datum);
  const ringColor = allDone ? "#1e7a34" : "var(--blue)";
  const border = allDone ? "var(--success-border)" : isToday ? "var(--blue)" : "var(--border)";
  const bg = allDone ? "var(--success-bg)" : isToday ? "var(--info-bg)" : "var(--card)";
  return `
    <div class="card" style="cursor:pointer; display:flex; align-items:center; gap:14px; background:${bg}; border-color:${border};" onclick="openGlasTour('${t.id}')">
      <div class="glas-ring" style="--pct:${pct}%; --ring-color:${ringColor};">
        <div class="glas-ring-inner">${allDone ? "✓" : `${done}/${total}`}</div>
      </div>
      <div style="flex:1; min-width:0;">
        <p style="margin:0; font-weight:700; font-size:16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t.name ? escapeHtml(t.name) : (t.datum ? formatGlasDate(t.datum) : "Ohne Namen")}</p>
        <p class="muted" style="margin:3px 0 0;">${t.datum ? formatGlasDate(t.datum) : "Ohne Datum"}${isToday ? " · Heute" : ""}</p>
      </div>
      <span style="font-size:20px; color:var(--text-secondary); flex-shrink:0;">›</span>
    </div>`;
}

function renderGlasTourList() {
  const today = todayIso();
  const heute = [];
  const kommend = [];
  const frueher = [];
  glasTouren.forEach((t) => {
    // Mehrtägige Touren zählen an JEDEM Tag ihres Zeitraums als "Heute" -
    // sonst verschwindet eine gestern gestartete Tour in "Frühere Touren"
    if (t.datum && t.datum <= today && today <= (t.datum_bis || t.datum)) heute.push(t);
    else if (t.datum && t.datum > today) kommend.push(t);
    else frueher.push(t);
  });
  kommend.sort((a, b) => (a.datum || "").localeCompare(b.datum || ""));
  frueher.sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));

  let html = "";
  if (heute.length) {
    html += `<p class="glas-section-title">Heute</p>` + heute.map(renderGlasTourCard).join("");
  }
  if (kommend.length) {
    html += `<p class="glas-section-title">Kommende Touren</p>` + kommend.map(renderGlasTourCard).join("");
  }
  if (frueher.length) {
    html += `
      <p class="glas-section-title" style="cursor:pointer; display:flex; align-items:center; gap:6px;" onclick="glasFrueherExpanded = !glasFrueherExpanded; renderGlasMa();">
        Frühere Touren (${frueher.length}) <span>${glasFrueherExpanded ? "▲" : "▼"}</span>
      </p>
      ${glasFrueherExpanded ? frueher.map(renderGlasTourCard).join("") : ""}`;
  }
  if (!heute.length && !kommend.length && !frueher.length) {
    html = `<p class="muted">Keine Touren gefunden.</p>`;
  }
  return html;
}

function openGlasTour(id) {
  glasOpenTourId = id;
  glasOpenStopId = null;
  glasSignStopId = null;
  renderGlasMa();
}

function closeGlasTour() {
  glasOpenTourId = null;
  glasOpenStopId = null;
  glasSignStopId = null;
  renderGlasMa();
}

function renderGlasTourScreen(t) {
  const done = t.stopps.filter((s) => s.status === "erledigt").length;

  return `
    <button class="btn btn-sm" style="margin-bottom:12px;" onclick="closeGlasTour()">&larr; Alle Touren</button>
    <div class="card">
      <p style="margin:0 0 4px; font-weight:700; font-size:17px;">${t.name ? escapeHtml(t.name) : (t.datum ? formatGlasDate(t.datum) : "Ohne Namen")}</p>
      <p class="muted" style="margin:0;">${t.datum ? formatGlasDate(t.datum) : ""}${t.datum ? " · " : ""}${done}/${t.stopps.length} erledigt</p>
    </div>
    <p class="muted" style="margin:14px 2px 4px; font-size:12.5px;">Auf einen Stopp tippen – dort stehen alle Infos und die Unterschrift.</p>
    ${renderGlasStopsList(t)}
  `;
}

// Gesamt-qm aus dem Positions-Schnappschuss des Stopps (deutsche Schreibweise)
// Jeder Stopp ist eine Karte: zugeklappt nur Objekt, Adresse, qm und ein Vermerk,
// ob Hinweis/Notiz dran hängt - Tippen klappt alle Details samt Unterschrift auf.
function renderGlasStopsList(t) {
  return t.stopps
    .map((s, idx) => {
      const isOpen = glasOpenStopId === s.id;
      const isDone = s.status === "erledigt";
      const isNg = s.status === "nicht_geschafft";
      const qm = glasStopQm(s);
      return `
        <div style="border-radius:12px; padding:13px 14px; margin-top:10px; cursor:pointer; background:${isDone ? "var(--success-bg)" : "var(--card)"}; border:1px solid ${isDone ? "var(--success-border)" : "var(--border)"};${isNg ? " opacity:0.66;" : ""}" onclick="toggleGlasStop('${s.id}')">
          <div style="display:flex; align-items:center; gap:11px;">
            <div style="flex-shrink:0; width:26px; height:26px; border-radius:50%; background:${isDone ? "#1e7a34" : isNg ? "var(--text-secondary)" : "#2d7dc4"}; color:white; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px;">${isDone ? "✓" : isNg ? "–" : idx + 1}</div>
            <div style="flex:1; min-width:0;">
              <p style="margin:0; font-weight:600; font-size:14.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.objekt ? escapeHtml(s.objekt) : `Stopp ${idx + 1}`}</p>
              <p class="muted" style="margin:2px 0 0; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml((s.adresse || "").split("\n")[0])}</p>
            </div>
            <div style="flex-shrink:0; text-align:right;">
              ${qm ? `<p style="margin:0; font-weight:700; font-size:13.5px; white-space:nowrap;">${qm} qm</p>` : ""}
              <p style="margin:2px 0 0; font-size:12px;">${s.hinweise ? "⚠️" : ""}${s.notiz ? "📝" : ""}<span style="color:var(--text-secondary);"> ${isOpen ? "▲" : "▼"}</span></p>
            </div>
          </div>
          ${isOpen ? renderGlasStopDetails(t, s, isDone, isNg) : ""}
        </div>`;
    })
    .join("");
}

// Mini-Vorschau der Positionen, damit der Mitarbeiter vor dem Unterschreiben sicher ist,
// dass es der richtige Abnahmeschein ist (Nr · Leistung · qm).
function renderMaStopPositionen(s) {
  const pos = glasStopPositionen(s);
  if (!pos.length) return "";
  return `<div style="margin-top:8px; border-left:2px solid var(--border); padding-left:9px; display:flex; flex-direction:column; gap:3px;">
    ${pos.map((p) => `<div style="display:flex; align-items:baseline; gap:7px; font-size:12.5px;">
      <span style="flex-shrink:0; font-size:10.5px; font-weight:700; color:var(--text-secondary); background:var(--bg); border:1px solid var(--border); border-radius:5px; padding:0 5px; line-height:16px;">${escapeHtml(p.nr || "–")}</span>
      <span style="flex:1; min-width:0;">${escapeHtml(p.art || "")}</span>
      ${p.qm ? `<span class="muted" style="flex-shrink:0;">${escapeHtml(String(p.qm))} qm</span>` : ""}
    </div>`).join("")}
  </div>`;
}

function renderGlasStopDetails(t, s, isDone, isNg) {
  const links = glasSingleMapLinks(s);
  const qm = glasStopQm(s);
  return `
    <div style="margin-top:12px; border-top:1px solid ${isDone ? "var(--success-border)" : "var(--border)"}; padding-top:12px;" onclick="event.stopPropagation();">
      <p style="margin:0; font-weight:600; font-size:15px; white-space:pre-line;">${escapeHtml(s.adresse)}</p>
      ${qm ? `<p class="muted" style="margin:6px 0 0;">Fläche: <b>${qm} qm</b></p>` : ""}
      ${renderMaStopPositionen(s)}
      ${s.hinweise ? `
      <div class="glas-hinweis-box">
        <span class="glas-hinweis-icon">⚠️</span>
        <div>
          <p class="glas-hinweis-title">Hinweis fürs Team</p>
          <p class="glas-hinweis-text">${escapeHtml(s.hinweise)}</p>
        </div>
      </div>` : ""}
      ${s.notiz ? `<div class="glas-notiz-box">📝 ${escapeHtml(s.notiz)}</div>` : ""}
      ${(s.ansprechpartner || s.telefon) ? `
      <div style="margin-top:10px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <span class="muted" style="font-size:13px;">👤 ${escapeHtml(s.ansprechpartner || "Ansprechpartner")}${s.telefon ? " · " + escapeHtml(s.telefon) : ""}</span>
        ${s.telefon ? `<a class="btn btn-sm" href="tel:${escapeHtml(String(s.telefon).replace(/[^0-9+]/g, ""))}" style="justify-content:center;">📞 Anrufen</a>` : ""}
      </div>` : ""}
      ${!isDone && s.lat ? `
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:12px;">
        <a class="btn btn-sm" href="${links.google}" target="_blank" style="justify-content:center;">🧭 Google</a>
        <a class="btn btn-sm" href="${links.apple}" style="justify-content:center;">🗺️ Apple</a>
        <a class="btn btn-sm" href="${links.waze}" style="justify-content:center;">📍 Waze</a>
      </div>` : ""}
      ${isDone
        ? `
      <div style="margin-top:12px; border-top:1px solid var(--success-border); padding-top:12px;">
        <p class="muted" style="margin:0 0 8px;">✍️ Unterschrieben von <b>${escapeHtml(s.name || "")}</b> am ${formatGlasDate(glasSignaturDatum(s))}</p>
        ${s.__pendingSync ? `<div class="glas-notiz-box" style="margin:0 0 8px; background:var(--warning-bg); border-color:#e0b64a;">⏳ Sicher gespeichert – wird automatisch ans Büro gesendet, sobald wieder Empfang da ist.</div>` : ""}
        ${s.zusatz ? `<div class="glas-notiz-box" style="margin:0 0 8px; white-space:pre-line;">➕ Zusätzlich: ${escapeHtml(s.zusatz)}</div>` : ""}
        ${s.unterschrift ? `<img src="${s.unterschrift}" style="max-width:100%; border:1px solid var(--border); border-radius:8px; background:white;" />` : ""}
        <button class="btn btn-sm" style="margin-top:10px;" onclick="downloadGlasPdf('${t.id}','${s.id}')">📄 PDF öffnen</button>
      </div>`
        : isNg
          ? `<div class="glas-notiz-box" style="margin-top:12px;">🚫 Vom Büro als <b>nicht geschafft</b> markiert${s.ng_grund ? ` – ${escapeHtml(s.ng_grund)}` : ""}. Dieser Stopp wird neu eingeplant.</div>`
          : glasSignStopId === s.id
            ? renderGlasSignForm(s)
            : `<button class="btn btn-primary" style="width:100%; justify-content:center; margin-top:12px; padding:13px; font-size:15.5px;" onclick="glasSignStopId = '${s.id}'; renderGlasMa();">✍️ Abnahmeschein unterschreiben</button>`
      }
    </div>`;
}

function renderGlasSignForm(s) {
  const today = todayIso();
  return `
    <div style="margin-top:12px; border-top:1px solid var(--border); padding-top:12px;">
      <div class="field">
        <label class="muted">Name der unterschreibenden Person</label>
        <input type="text" id="gs_name" placeholder="Vor- und Nachname" style="font-size:16px;" />
      </div>
      <div class="field">
        <label class="muted">Unterschrift</label>
        <canvas id="gs_sigCanvas" style="width:100%; height:180px; border:1px solid var(--border); border-radius:10px; background:white; touch-action:none;"></canvas>
        <button class="btn btn-sm" style="margin-top:8px;" onclick="clearGlasSig()">🗑️ Löschen & neu</button>
      </div>
      <div class="field">
        <label class="muted">➕ Extra was gemacht? (optional)</label>
        <div id="gs_zusatz_list">
          <textarea class="gs-zusatz" rows="2" style="font-size:16px;" placeholder="z.B. 2 Stunden zusätzlich"></textarea>
        </div>
        <button class="btn btn-sm" style="margin-top:8px;" onclick="glasZusatzAddField()">+ Noch etwas hinzufügen</button>
        <p class="muted" style="margin:6px 0 0; font-size:12px;">Jede Zeile steht als eigene Position mit auf dem Abnahmeschein.</p>
      </div>
      <input type="hidden" id="gs_datum" value="${today}" />
      <button class="btn btn-primary" style="width:100%; justify-content:center; padding:14px; font-size:16px;" onclick="saveGlasSignature('${s.id}')">✓ Unterschrift speichern</button>
    </div>`;
}

// Fügt ein weiteres Zusatz-Feld hinzu, ohne die Seite neu zu bauen (Unterschrift bleibt).
function glasZusatzAddField() {
  const list = document.getElementById("gs_zusatz_list");
  if (!list) return;
  const ta = document.createElement("textarea");
  ta.className = "gs-zusatz";
  ta.rows = 2;
  ta.style.fontSize = "16px";
  ta.style.marginTop = "8px";
  ta.placeholder = "z.B. 5 Fenster extra";
  list.appendChild(ta);
  ta.focus();
}

function toggleGlasStop(id) {
  glasOpenStopId = glasOpenStopId === id ? null : id;
  glasSignStopId = null;
  renderGlasMa();
}

function setupGlasSigPad() {
  const canvas = document.getElementById("gs_sigCanvas");
  if (!canvas) return;
  const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  canvas.getContext("2d").scale(ratio, ratio);
  glasSigPad = new SignaturePad(canvas, { minWidth: 0.8, maxWidth: 2.2 });
}

function clearGlasSig() {
  if (glasSigPad) glasSigPad.clear();
}

async function saveGlasSignature(stopId) {
  const name = document.getElementById("gs_name").value.trim();
  const datum = document.getElementById("gs_datum").value;
  if (!name) { showToast("Bitte Namen eintragen"); return; }
  if (!datum) { showToast("Bitte Datum wählen"); return; }
  if (!glasSigPad || glasSigPad.isEmpty()) { showToast("Bitte unterschreiben lassen"); return; }

  const unterschrift = glasSigPad.toDataURL("image/png");
  const zusatz = [...document.querySelectorAll(".gs-zusatz")].map((t) => t.value.trim()).filter(Boolean).join("\n");
  const signedAt = new Date().toISOString();
  let stopRef = null;
  let tourName = "";
  for (const t of glasTouren) {
    const stop = t.stopps.find((s) => s.id === stopId);
    if (stop) { stopRef = stop; tourName = t.name || ""; }
  }

  // Erst online versuchen; bei fehlendem Empfang / Netzfehler in die Warteschlange legen,
  // damit im Objekt ohne Netz nichts verloren geht. Eine ECHTE Server-Ablehnung wird
  // dagegen als Fehler angezeigt (Formular bleibt offen) - sie darf nicht als
  // "gespeichert" durchgehen.
  let saved = false;
  let serverFehler = null;
  if (navigator.onLine) {
    try {
      const { error, payload } = await glasSignStop(stopId, stopRef?.positionen, name, datum, unterschrift, zusatz, signedAt);
      if (!error) {
        if (stopRef) Object.assign(stopRef, payload, { __pendingSync: false });
        saved = true;
      } else if (!glasIstNetzFehler(error)) {
        serverFehler = error;
      }
    } catch (e) { if (!glasIstNetzFehler(e)) serverFehler = e; }
  }

  if (serverFehler) {
    showToast("Fehler beim Speichern: " + (serverFehler.message || serverFehler));
    return; // Formular + Unterschrift bleiben stehen, nichts geht verloren
  }

  if (saved) {
    showToast("Gespeichert");
    glasPushUnterschriftAnAdmin(stopRef, name, zusatz, tourName);
  } else {
    glasQueueSign({ stopId, objekt: stopRef?.objekt || "", tour: tourName, positionen: stopRef?.positionen || "[]", name, datum, unterschrift, zusatz, signedAt });
    if (stopRef) Object.assign(stopRef, { name, datum, unterschrift, zusatz, status: "erledigt", signed_at: signedAt, __pendingSync: true });
    showToast("Offline gespeichert – wird gesendet, sobald wieder Empfang da ist");
  }

  // Stopp bleibt aufgeklappt und zeigt jetzt den grünen "Unterschrieben"-Block
  glasSignStopId = null;
  glasOpenStopId = stopId;
  renderGlasMa();
}

function downloadGlasPdf(tourId, stopId) {
  const t = glasTouren.find((x) => x.id === tourId);
  const s = t?.stopps.find((x) => x.id === stopId);
  if (!s) return;
  const doc = generateGlasPdf(s, t.template, t.datum);
  doc.save(glasScheinFilename(s, t.template));
}

// Meldet dem Admin eine frisch eingegangene Unterschrift (wenn der Schalter in den
// Admin-Einstellungen an ist). Fehler hier dürfen den Mitarbeiter nie stören.
async function glasPushUnterschriftAnAdmin(stop, name, zusatz, tourName) {
  try {
    const { data } = await sb.from("glas_einstellungen").select("push_unterschrift").eq("id", "default").limit(1);
    if (!data || !data[0] || !data[0].push_unterschrift) return;
    sb.functions.invoke("send-push", {
      body: {
        role: "glas",
        title: `✍️ Unterschrift: ${tourName || "Tour"}`,
        body: `${stop?.objekt || "Stopp"} – unterschrieben von ${name}${zusatz ? " · Zusatz: " + zusatz : ""}`,
        url: "/glas-admin.html#/tab/touren",
      },
    }).catch(() => {});
  } catch (e) {}
}

glasMaInit();
