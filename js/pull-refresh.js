// Pull-to-Refresh: Am oberen Seitenrand nach unten ziehen lädt neu - mit
// mitwachsendem Spinner wie in nativen Apps. Rein additiv, keine Abhängigkeiten.
//
// Bewusst "fest statt wackelig":
//   - Richtungssperre: erst wenn die Geste eindeutig senkrecht ist, wird gezogen.
//     Ein schräger oder seitlicher Wisch (z.B. Monat blättern) läuft normal weiter.
//   - Abbruch: zieht man wieder nach oben oder scrollt die Seite doch, wird die
//     Geste sauber zurückgesetzt statt halb hängen zu bleiben.
//   - Ein Finger: sobald ein zweiter dazukommt (Zoom), ist Schluss.
//   - Gummiband: der Weg wird gedämpft, je weiter man zieht - kein Springen.
//   - Weiche Aktualisierung: Definiert die Seite window.gekoSoftRefresh, wird die
//     aufgerufen statt die ganze Seite neu zu laden.
(function () {
  const AUSLOESER = 72;   // px gedämpfter Zugweg, ab dem beim Loslassen aktualisiert wird
  const MAX = 110;        // weiter lässt sich nicht ziehen
  const START_SCHWELLE = 8; // px, bevor über die Richtung entschieden wird

  const indicator = document.createElement("div");
  indicator.className = "ptr-indicator";
  indicator.innerHTML = `<div class="ptr-spinner"></div>`;
  const anhaengen = () => { if (document.body && !indicator.parentNode) document.body.appendChild(indicator); };
  document.addEventListener("DOMContentLoaded", anhaengen);
  anhaengen();

  let startY = null, startX = null;
  let richtung = null;   // null = noch unentschieden, "zieh" | "aus"
  let dist = 0;
  let laeuft = false;    // Aktualisierung angestoßen - keine neue Geste annehmen

  function scrollOben() {
    // Seiten mit App-Shell (z.B. Glas-Admin) scrollen in #glasScroller statt im Fenster
    const sc = document.getElementById("glasScroller");
    return Math.max(window.scrollY || document.documentElement.scrollTop || 0, sc ? sc.scrollTop : 0);
  }

  // Gedämpfter Zugweg: die ersten Pixel folgen fast 1:1, danach wird es zäher.
  // Fühlt sich an wie das native Gummiband und verhindert das nervöse Zittern.
  function daempfen(dy) {
    return Math.min(MAX, dy < 40 ? dy * 0.62 : 24.8 + (dy - 40) * 0.3);
  }

  function zeichnen(weich) {
    indicator.style.transition = weich ? "transform .25s ease, opacity .25s ease" : "none";
    indicator.style.transform = `translateX(-50%) translateY(${dist}px)`;
    indicator.style.opacity = String(Math.min(dist / AUSLOESER, 1));
    const sp = indicator.querySelector(".ptr-spinner");
    if (sp) sp.style.transform = `rotate(${dist * 3}deg)`;
    indicator.classList.toggle("ready", dist >= AUSLOESER);
  }

  function zuruecksetzen() {
    dist = 0;
    indicator.style.transition = "transform .25s ease, opacity .25s ease";
    indicator.style.transform = "translateX(-50%) translateY(-56px)";
    indicator.style.opacity = "0";
    indicator.classList.remove("ready");
    startY = null; startX = null; richtung = null;
  }

  function darfZiehen(ziel) {
    if (laeuft) return false;
    // Solange ein Sheet/Modal offen ist (Unterschreiben, Kalender-Tages-Sheet,
    // Info-Karten, Menü), NIE aktualisieren - ein Abwärts-Wisch dort ist zum
    // Schließen oder Scrollen gedacht, nicht fürs Neuladen.
    if (document.querySelector(".glas-sign-sheet, .glas-day-sheet, .modal-overlay, .glas-graffiti-ov, .one-drop-ov, .okal-sheet-ov")) return false;
    // Nie auf Zeichenflächen/Eingaben: ein Abwärts-Strich auf dem Unterschrift-Canvas
    // löste sonst das Neuladen aus - und die Unterschrift war weg.
    if (ziel && ziel.closest && ziel.closest("canvas, input, textarea, select, [contenteditable], .no-ptr")) return false;
    return scrollOben() <= 2;
  }

  window.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1 || !darfZiehen(e.target)) { startY = null; return; }
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    richtung = null;
    dist = 0;
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (startY === null) return;
    if (e.touches.length !== 1) { zuruecksetzen(); return; } // zweiter Finger = Zoom
    const dy = e.touches[0].clientY - startY;
    const dx = e.touches[0].clientX - startX;

    if (richtung === null) {
      if (Math.abs(dy) < START_SCHWELLE && Math.abs(dx) < START_SCHWELLE) return;
      // Nur ein klar senkrechter Zug NACH UNTEN zählt. Alles andere (seitwärts
      // wischen, nach oben scrollen) läuft normal weiter und wird nie zum Ziehen.
      richtung = (dy > 0 && dy > Math.abs(dx) * 1.6) ? "zieh" : "aus";
      if (richtung === "aus") { startY = null; return; }
    }
    if (richtung !== "zieh") return;

    // Zurückgezogen oder die Seite scrollt doch: Geste sauber beenden
    if (dy <= 0 || scrollOben() > 2) { zuruecksetzen(); return; }
    dist = daempfen(dy);
    zeichnen(false);
  }, { passive: true });

  function loslassen() {
    if (richtung !== "zieh" || startY === null) { startY = null; richtung = null; return; }
    if (dist >= AUSLOESER) {
      laeuft = true;
      indicator.classList.add("refreshing");
      indicator.style.transition = "transform .2s ease";
      indicator.style.transform = `translateX(-50%) translateY(${AUSLOESER * 0.7}px)`;
      // Kann die Seite sich selbst frisch ziehen, dann ohne kompletten Neustart -
      // das ist spürbar schneller und die Stelle im Bildschirm bleibt erhalten.
      const weich = window.gekoSoftRefresh;
      if (typeof weich === "function") {
        Promise.resolve().then(weich).catch(() => {}).then(() => {
          setTimeout(() => {
            indicator.classList.remove("refreshing");
            laeuft = false;
            zuruecksetzen();
          }, 260);
        });
      } else {
        setTimeout(() => location.reload(), 320);
      }
      startY = null; richtung = null;
      return;
    }
    zuruecksetzen();
  }

  window.addEventListener("touchend", loslassen, { passive: true });
  window.addEventListener("touchcancel", () => { if (!laeuft) zuruecksetzen(); }, { passive: true });
})();
