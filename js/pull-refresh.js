// Pull-to-Refresh: Am oberen Seitenrand nach unten ziehen lädt die Seite neu -
// mit mitwachsendem Spinner wie in nativen Apps. Rein additiv, keine Abhängigkeiten.
(function () {
  const THRESHOLD = 78; // px Zugweg, ab dem beim Loslassen neu geladen wird
  const MAX_PULL = 120;

  const indicator = document.createElement("div");
  indicator.className = "ptr-indicator";
  indicator.innerHTML = `<div class="ptr-spinner"></div>`;
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(indicator));
  if (document.body) document.body.appendChild(indicator);

  let startY = null;
  let pulling = false;
  let dist = 0;

  function scrollTopNow() {
    // Seiten mit App-Shell (z.B. Glas-Admin) scrollen in #glasScroller statt im Fenster
    const sc = document.getElementById("glasScroller");
    return Math.max(window.scrollY || document.documentElement.scrollTop || 0, sc ? sc.scrollTop : 0);
  }

  window.addEventListener("touchstart", (e) => {
    // Nie auf Zeichenflächen/Eingaben auslösen: ein Abwärts-Strich auf dem
    // Unterschrift-Canvas löste sonst Pull-to-Refresh aus -> die Seite lud beim
    // Loslassen neu und die Unterschrift war weg (v.a. auf Android; iPhone-Nutzer
    // waren meist schon runtergescrollt, wo Pull-to-Refresh ohnehin aus ist).
    const t = e.target;
    if (t && t.closest && t.closest("canvas, input, textarea, select, [contenteditable], .no-ptr")) { startY = null; return; }
    if (scrollTopNow() > 2) { startY = null; return; }
    startY = e.touches[0].clientY;
    pulling = false;
    dist = 0;
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0 || scrollTopNow() > 2) return;
    pulling = true;
    dist = Math.min(dy * 0.5, MAX_PULL); // Widerstand beim Ziehen
    indicator.style.transition = "none";
    indicator.style.transform = `translateX(-50%) translateY(${dist}px)`;
    indicator.style.opacity = Math.min(dist / THRESHOLD, 1);
    indicator.querySelector(".ptr-spinner").style.transform = `rotate(${dist * 3}deg)`;
    indicator.classList.toggle("ready", dist >= THRESHOLD);
  }, { passive: true });

  window.addEventListener("touchend", () => {
    if (!pulling) { startY = null; return; }
    indicator.style.transition = "transform 0.25s ease, opacity 0.25s ease";
    if (dist >= THRESHOLD) {
      indicator.classList.add("refreshing");
      indicator.style.transform = `translateX(-50%) translateY(${THRESHOLD * 0.7}px)`;
      setTimeout(() => location.reload(), 350);
    } else {
      indicator.style.transform = "translateX(-50%) translateY(-56px)";
      indicator.style.opacity = "0";
      indicator.classList.remove("ready");
    }
    startY = null;
    pulling = false;
    dist = 0;
  }, { passive: true });
})();
