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

  /* v8-425 (Gians Rueckmeldung 2.10.: „ein bisschen herzlos"): die Seite GEHT MIT.
     Sobald die Geste klar waagerecht ist, folgt die aktuelle Seite dem Finger (gedaempft,
     leicht ausblendend). Beim Loslassen: Wisch erkannt ⇒ Seite gleitet hinaus, die neue
     gleitet aus der Gegenrichtung herein; sonst federt sie zurueck. Am ersten/letzten
     Ziel gibt es nur einen kurzen Widerstand. Alles ueber transform/opacity (Compositor),
     Listener bleiben passiv; bei „Bewegung reduzieren" wird ohne Animation gewechselt. */
  var FOLLOW = 0.42, FOLLOW_EDGE = 0.14, LOCK_PX = 10, LOCK_RATIO = 1.6;
  function reduced() { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
  function paneOf(doc, tab) { try { return doc.getElementById('tab-' + tab); } catch (e) { return null; } }
  function clearPane(el) { if (!el) return; try { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; el.style.willChange = ''; } catch (e) {} }
  /* axis(dx,dy) → 'h' | 'v' | null — rein, testbar. */
  function axis(dx, dy) {
    var ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax >= LOCK_PX && ax >= ay * LOCK_RATIO) return 'h';
    if (ay >= LOCK_PX) return 'v';
    return null;
  }
  /* follow(dx,width,hasTarget) → {x, opacity} — rein, testbar. */
  function follow(dx, width, hasTarget) {
    var k = hasTarget ? FOLLOW : FOLLOW_EDGE;
    var x = Math.round(dx * k);
    var w = width > 0 ? width : 390;
    return { x: x, opacity: Math.max(0.55, 1 - Math.min(0.45, Math.abs(dx) / w * 0.7)) };
  }

  function bind() {
    var doc = root.document; if (!doc || !doc.addEventListener || doc.documentElement.dataset.tabSwipe) return;
    doc.documentElement.dataset.tabSwipe = '1';
    var st = null;
    doc.addEventListener('touchstart', function (e) {
      st = null;
      if (!e.touches || e.touches.length !== 1) return;
      if (overlayOpen(doc) || blockedStart(e.target, doc)) return;
      var t = e.touches[0]; var cur = currentTab(doc);
      st = { x: t.clientX, y: t.clientY, t: Date.now(), multi: false, lock: null, cur: cur, el: paneOf(doc, cur), calm: reduced() };
    }, { passive: true });
    doc.addEventListener('touchmove', function (e) {
      if (!st) return;
      if (e.touches && e.touches.length > 1) { st.multi = true; clearPane(st.el); return; }
      var t = e.touches && e.touches[0]; if (!t) return;
      var dx = t.clientX - st.x, dy = t.clientY - st.y;
      if (!st.lock) st.lock = axis(dx, dy);
      if (st.lock !== 'h' || st.calm || !st.el) return;
      var f = follow(dx, root.innerWidth || doc.documentElement.clientWidth, !!target(st.cur, dx < 0 ? 'next' : 'prev'));
      st.el.style.willChange = 'transform,opacity';
      st.el.style.transition = 'none';
      st.el.style.transform = 'translate3d(' + f.x + 'px,0,0)';
      st.el.style.opacity = String(f.opacity);
    }, { passive: true });
    doc.addEventListener('touchcancel', function () { if (st) clearPane(st.el); st = null; }, { passive: true });
    doc.addEventListener('touchend', function (e) {
      var s = st; st = null;
      if (!s) return;
      var back = function () {            /* zurueckfedern */
        if (!s.el) return;
        s.el.style.transition = 'transform .24s cubic-bezier(.2,.8,.2,1), opacity .24s ease';
        s.el.style.transform = 'translate3d(0,0,0)'; s.el.style.opacity = '1';
        root.setTimeout(function () { clearPane(s.el); }, 260);
      };
      if (s.multi || !e.changedTouches || !e.changedTouches.length || overlayOpen(doc)) { back(); return; }
      var t = e.changedTouches[0];
      var w = root.innerWidth || doc.documentElement.clientWidth;
      var dir = (s.lock === 'v') ? null : decide({ dx: t.clientX - s.x, dy: t.clientY - s.y, dt: Date.now() - s.t, startX: s.x, width: w });
      var to = dir ? target(s.cur, dir) : null;
      if (!to || typeof root._orviaGoTab !== 'function') { back(); return; }
      var go = function () {
        clearPane(s.el);
        try { doc.documentElement.setAttribute('data-swipe-dir', dir); } catch (_) {}
        root._orviaGoTab(to);
        root.setTimeout(function () { try { doc.documentElement.removeAttribute('data-swipe-dir'); } catch (_) {} }, 380);
      };
      if (s.calm || !s.el) { go(); return; }
      /* hinausgleiten, dann wechseln — die neue Seite kommt per CSS (data-swipe-dir) herein */
      s.el.style.transition = 'transform .15s cubic-bezier(.4,0,1,1), opacity .15s linear';
      s.el.style.transform = 'translate3d(' + (dir === 'next' ? -1 : 1) * Math.round(w * 0.28) + 'px,0,0)';
      s.el.style.opacity = '0';
      root.setTimeout(go, 150);
    }, { passive: true });
  }

  O.tabSwipe = { ORDER: ORDER, CFG: CFG, decide: decide, target: target, axis: axis, follow: follow, bind: bind, _overlayOpen: overlayOpen, _blockedStart: blockedStart, _currentTab: currentTab };
  if (root.document && root.document.addEventListener) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', bind); else bind();
  }
})(typeof window !== 'undefined' ? window : globalThis);
