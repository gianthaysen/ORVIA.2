/* ============================================================
   ORVIA · tab-swipe — Tabwechsel per waagerechtem Wischen (v8-424)
   ------------------------------------------------------------
   Gians Wunsch 2.10.: zwischen Dashboard · Plan · Aktivitaet · Analyse · Profil hin-
   und herwischen koennen — auch wenn die untere Leiste gerade nicht sichtbar ist —,
   aber NUR bei einem deutlichen Wisch, nicht aus Versehen beim Scrollen.

   decide() ist rein und testbar. Ein Wisch zaehlt nur, wenn ALLE Bedingungen gelten:
     · Weg  ≥ max(96 px, 30 % der Bildschirmbreite)
     · klar waagerecht: |dx| ≥ 2,5 × |dy|
     · zuegig: ≤ 700 ms und ≥ 0,35 px/ms
     · Start nicht in den aeusseren 20 px (System-Gesten: Zurueck, App-Wechsel)
   Der Listener ist passiv — senkrechtes Scrollen wird nie beeinflusst. Gesperrt ist
   der Wisch, sobald ein Sheet/eine Unterseite/Story/Modal offen ist oder der Finger
   in einem waagerecht scrollbaren Bereich, einem Eingabefeld, Diagramm oder der
   Karte beginnt. Kein Umlauf: am ersten/letzten Ziel passiert nichts.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var ORDER = ['heute', 'plan', 'akt', 'dash', 'mehr'];
  var CFG = { minPx: 96, minFrac: 0.30, ratio: 2.5, maxMs: 700, minV: 0.35, edge: 20 };

  function decide(g, cfg) {
    var c = cfg || CFG; if (!g) return null;
    var dx = +g.dx || 0, dy = +g.dy || 0, dt = +g.dt || 0, w = +g.width || 0, sx = +g.startX;
    if (!(dt > 0) || dt > c.maxMs) return null;
    var ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax < Math.max(c.minPx, w * c.minFrac)) return null;
    if (ax < ay * c.ratio) return null;
    if (ax / dt < c.minV) return null;
    if (isFinite(sx) && w > 0 && (sx < c.edge || sx > w - c.edge)) return null;
    return dx < 0 ? 'next' : 'prev';     /* Finger nach links ⇒ naechstes Ziel rechts */
  }
  /* target(cur, dir) → Tab-Name oder null (kein Umlauf). */
  function target(cur, dir) {
    var i = ORDER.indexOf(cur); if (i < 0) return null;
    var j = dir === 'next' ? i + 1 : dir === 'prev' ? i - 1 : -1;
    return (j >= 0 && j < ORDER.length) ? ORDER[j] : null;
  }

  var BLOCK_SEL = 'input,textarea,select,[contenteditable="true"],[draggable="true"],canvas,.route-map,.tabbar,.fab,.noswipe,[data-noswipe]';
  function overlayOpen(doc) {
    try {
      if (doc.body.classList.contains('story-open')) return true;
      return !!doc.querySelector('.sheet.on,.gm-page.on,.gm-story.on,.orvia-modal-bg,#suppModal.show,.spot-hole,.wo-sheet.on');
    } catch (e) { return false; }
  }
  function blockedStart(el, doc) {
    try {
      if (!el || !el.closest) return false;
      if (el.closest(BLOCK_SEL)) return true;
      for (var n = el; n && n !== doc.body && n.nodeType === 1; n = n.parentNode) {
        if (n.scrollWidth > n.clientWidth + 4) {
          var ox = root.getComputedStyle ? root.getComputedStyle(n).overflowX : '';
          if (ox === 'auto' || ox === 'scroll') return true;      /* waagerecht scrollbarer Bereich */
        }
      }
    } catch (e) {}
    return false;
  }
  function currentTab(doc) {
    try {
      if (doc.body.classList.contains('profile-open')) return 'mehr';
      var b = doc.querySelector('.tabwrap button[data-tab].on');
      return b ? b.dataset.tab : 'heute';
    } catch (e) { return 'heute'; }
  }

  function bind() {
    var doc = root.document; if (!doc || !doc.addEventListener || doc.documentElement.dataset.tabSwipe) return;
    doc.documentElement.dataset.tabSwipe = '1';
    var st = null;
    doc.addEventListener('touchstart', function (e) {
      st = null;
      if (!e.touches || e.touches.length !== 1) return;
      if (overlayOpen(doc) || blockedStart(e.target, doc)) return;
      var t = e.touches[0];
      st = { x: t.clientX, y: t.clientY, t: Date.now(), multi: false };
    }, { passive: true });
    doc.addEventListener('touchmove', function (e) { if (st && e.touches && e.touches.length > 1) st.multi = true; }, { passive: true });
    doc.addEventListener('touchcancel', function () { st = null; }, { passive: true });
    doc.addEventListener('touchend', function (e) {
      var s = st; st = null;
      if (!s || s.multi || !e.changedTouches || !e.changedTouches.length) return;
      if (overlayOpen(doc)) return;
      var t = e.changedTouches[0];
      var dir = decide({ dx: t.clientX - s.x, dy: t.clientY - s.y, dt: Date.now() - s.t, startX: s.x, width: root.innerWidth || doc.documentElement.clientWidth });
      if (!dir) return;
      var to = target(currentTab(doc), dir);
      if (!to || typeof root._orviaGoTab !== 'function') return;
      try { doc.documentElement.setAttribute('data-swipe-dir', dir); } catch (_) {}
      root._orviaGoTab(to);
      root.setTimeout(function () { try { doc.documentElement.removeAttribute('data-swipe-dir'); } catch (_) {} }, 260);
    }, { passive: true });
  }

  O.tabSwipe = { ORDER: ORDER, CFG: CFG, decide: decide, target: target, bind: bind, _overlayOpen: overlayOpen, _blockedStart: blockedStart, _currentTab: currentTab };
  if (root.document && root.document.addEventListener) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', bind); else bind();
  }
})(typeof window !== 'undefined' ? window : globalThis);
