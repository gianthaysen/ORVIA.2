/* ============================================================
   ORVIA · route-map-view — Kartenansicht zum Umsehen (v8-435)
   ------------------------------------------------------------
   Gians Auftrag 5.10.: Auf der Aktivitaetsseite oben auf die Karte tippen ⇒ die Karte
   oeffnet sich mit der Strecke, und man kann sich darin umsehen (verschieben, zoomen).

   Weiterhin KEINE Kartenbibliothek: dieselben Rasterkacheln wie im Standbild
   (route-map.js), nur beweglich. Dieses Modul kennt keinen Anbieter — Adressen, Logo und
   Quellenhinweis kommen ueber ORVIA.routeMap.cfg() aus map-config.js.

   Aufbau
     · „gelegte Ansicht" L: fuer sie liegen die Kacheln (Lage/Groesse in px) und der
       Streckenpfad. „aktuelle Ansicht" C: wohin der Finger sie gerade geschoben hat.
       Waehrend der Geste bewegt nur EINE Transformation die Kachelebene (kein Neulegen,
       kein Neuladen); der Streckenpfad bekommt dieselbe Transformation im SVG, seine
       Strichstaerke bleibt gleich (non-scaling-stroke).
     · Kommt die Geste zur Ruhe, wird neu gelegt: fehlende Kacheln der passenden Stufe
       werden angefragt, die bisherigen bleiben als Unterlage liegen, bis die neuen da sind.
   Anfragen sparen (abgerechnet wird je Kachel)
     · Waehrend zwei Finger zoomen, wird NICHTS angefragt — erst die Endstufe.
     · Geladene Kachelbilder bleiben fuer die Sitzung im Speicher: erneutes Oeffnen und
       Zurueckschieben kosten keine Anfrage. (Der Anbieter erlaubt dem Browser ausserdem
       acht Stunden Zwischenspeichern — Kacheln, die schon das Standbild geladen hat,
       kommen daher ohne Netz.)
     · Dieselbe Kachelstufe wie das Standbild (routeMap.level).
   Rueckfall
     · Scheitert eine Kachel, gilt die gemeinsame 5-Minuten-Pause von route-map.js; die
       Ansicht bleibt bedienbar und zeigt die Strecke ohne Hintergrund samt Hinweis.

   Alles Rechnen ist rein und testbar (fitView/panBy/zoomAt/delta/limits).
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'route-map-view@1';
  var Z_OUT = 3;            /* so viele Stufen weiter heraus als „ganze Strecke" */
  var Z_MAX = 18;           /* stufenlose Obergrenze (Welt = 256 · 2^Z) ⇒ 512er-Kachelstufe hoechstens 17 */
  var KEEP_MAX = 32;        /* Kachelbilder im Sitzungsspeicher dieser Ansicht (ein Bild ≈ 4 MB entpackt — auf dem Handy bewusst knapp;
                               was herausfaellt, liefert der Browser-Zwischenspeicher ohne neue Anfrage nach) */
  var MAX_PTS = 4000;       /* mehr Streckenpunkte werden fuer die Ansicht ausgeduennt */
  var PAN_LAYOUT_MS = 220;  /* beim Schieben hoechstens so oft neu legen/nachladen */
  var SETTLE_MS = 140;

  function RM() { return O.routeMap; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function world(Z) { return 256 * Math.pow(2, Z); }
  function copy(v) { return { cx: v.cx, cy: v.cy, Z: v.Z, w: v.w, h: v.h }; }

  /* ---- reine Rechnung ---- */
  /* fitView → Ansicht, in der die ganze Strecke innerhalb des Innenrands liegt (Mittelpunkt in Mercator 0…1). */
  function fitView(route, w, h, pad) {
    var R = RM(), v = R && R.fit(route, w, h, pad, 512);
    if (!v) return null;
    return { cx: (v.ox + w / 2) / v.world, cy: (v.oy + h / 2) / v.world, Z: v.Z, w: w, h: h };
  }
  function limits(fitZ) { return { min: Math.max(3, fitZ - Z_OUT), max: Math.max(Z_MAX, fitZ) }; }
  function norm(v, lim) {
    var o = copy(v);
    if (lim) o.Z = clamp(o.Z, lim.min, lim.max);
    o.cx = clamp(o.cx, 0, 1); o.cy = clamp(o.cy, 0, 1);
    return o;
  }
  function origin(v) { var W = world(v.Z); return { W: W, ox: v.cx * W - v.w / 2, oy: v.cy * W - v.h / 2 }; }
  function panBy(v, dx, dy) { var W = world(v.Z), o = copy(v); o.cx = v.cx - dx / W; o.cy = v.cy - dy / W; return o; }
  /* zoomAt: der Ort unter (px,py) bleibt unter dem Finger. */
  function zoomAt(v, px, py, dZ, lim) {
    var Z2 = lim ? clamp(v.Z + dZ, lim.min, lim.max) : v.Z + dZ;
    var W1 = world(v.Z), W2 = world(Z2), ax = px - v.w / 2, ay = py - v.h / 2;
    var gx = v.cx + ax / W1, gy = v.cy + ay / W1, o = copy(v);
    o.Z = Z2; o.cx = gx - ax / W2; o.cy = gy - ay / W2;
    return o;
  }
  /* delta(L,C): Bildschirm_C = s · Bildschirm_L + (tx,ty) */
  function delta(L, C) { var a = origin(L), b = origin(C), s = b.W / a.W; return { s: s, tx: s * a.ox - b.ox, ty: s * a.oy - b.oy }; }
  function screenOf(lat, lon, v) { var R = RM(), o = origin(v); return [R.lonX(lon) * o.W - o.ox, R.latY(lat) * o.W - o.oy]; }
  function thin(pts) {
    if (pts.length <= MAX_PTS) return pts;
    var step = Math.ceil(pts.length / MAX_PTS), out = [];
    for (var i = 0; i < pts.length; i += step) out.push(pts[i]);
    if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
    return out;
  }

  /* ---- Sitzungsspeicher ---- */
  var _keep = {}, _order = [], _req = 0, _reused = 0;
  function remember(url, img) {
    if (_keep[url]) return;
    _keep[url] = img; _order.push(url);
    while (_order.length > KEEP_MAX) delete _keep[_order.shift()];
  }

  function touch(url) { var i = _order.indexOf(url); if (i >= 0) { _order.splice(i, 1); _order.push(url); } }   /* zuletzt Benutztes bleibt am laengsten */

  var S = null;   /* die offene Ansicht */

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var ICON = {
    x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
    fit: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/><circle cx="12" cy="12" r="2.2"/></svg>'
  };

  function open(route, opts) {
    try {
      var R = RM(), doc = root.document;
      if (!R || !doc || !doc.body) return false;
      var pts = thin(R.valid(route));
      if (pts.length < 2) return false;
      if (S) close();
      opts = opts || {};
      var L = opts.labels || {}, c = R.cfg();
      var el = doc.createElement('div');
      el.className = 'rmv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', L.map || 'Karte');
      if (opts.color) el.style.setProperty('--acchi', String(opts.color));
      el.innerHTML =
        '<div class="rmv-stage">' +
          '<div class="rmv-layer"><div class="rmv-tiles"></div></div>' +
          '<div class="rmv-dim"></div>' +
          '<svg class="rmv-route" aria-hidden="true"><g class="rmv-g">' +
            '<path class="rmx-case" fill="none" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
            '<path class="rmx-line" fill="none" stroke="var(--acchi,var(--acc,#DCC79A))" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
          '</g><circle class="rmx-start" r="7"/><circle class="rmx-end" r="5"/></svg>' +
        '</div>' +
        '<div class="rmv-top"><div class="rmv-ttl"><b>' + esc(opts.title || '') + '</b><span>' + esc(opts.sub || '') + '</span></div>' +
          '<button type="button" class="rmv-btn rmv-close" aria-label="' + esc(L.close || 'Schließen') + '">' + ICON.x + '</button></div>' +
        '<div class="rmv-ctl">' +
          '<button type="button" class="rmv-btn rmv-in" aria-label="' + esc(L.zoomIn || '+') + '">' + ICON.plus + '</button>' +
          '<button type="button" class="rmv-btn rmv-out" aria-label="' + esc(L.zoomOut || '−') + '">' + ICON.minus + '</button>' +
          '<button type="button" class="rmv-btn rmv-fit" aria-label="' + esc(L.fit || 'Strecke') + '">' + ICON.fit + '</button>' +
        '</div>' +
        '<div class="rmv-note" role="status">' + esc(L.unavailable || '') + '</div>' +
        (c.enabled ? '<div class="rmx-attr">' + (c.logo ? '<img class="rmx-logo" alt="" referrerpolicy="strict-origin" src="' + esc(c.logo) + '">' : '') + '<span>' + esc(c.attribution) + '</span></div>' : '');
      doc.body.appendChild(el);

      var stage = el.querySelector('.rmv-stage');
      var w = stage.clientWidth || el.clientWidth, h = stage.clientHeight || el.clientHeight;
      if (!(w > 0) || !(h > 0)) { doc.body.removeChild(el); return false; }
      var top = el.querySelector('.rmv-top'), padT = 96;
      try { padT = Math.round(top.getBoundingClientRect().bottom - el.getBoundingClientRect().top) + 8; } catch (e) {}
      var pad = { t: clamp(padT, 60, h * 0.35), r: 44, b: clamp(Math.round(h * 0.16), 70, 150), l: 44 };
      var fit = fitView(pts, w, h, pad);
      if (!fit) { doc.body.removeChild(el); return false; }

      S = { el: el, stage: stage, layer: el.querySelector('.rmv-layer'), tilesEl: el.querySelector('.rmv-tiles'),
        g: el.querySelector('.rmv-g'), cas: el.querySelector('.rmx-case'), line: el.querySelector('.rmx-line'),
        start: el.querySelector('.rmx-start'), end: el.querySelector('.rmx-end'),
        pts: pts, pad: pad, fit: fit, lim: limits(fit.Z), L: copy(fit), C: copy(fit),
        ptrs: {}, n: 0, raf: 0, settleT: 0, anim: 0, lastLayout: 0, tiles: {}, failed: false, moved: 0, down: null, lastTap: null,
        prevFocus: doc.activeElement, prevOverflow: doc.documentElement.style.overflow };
      try { doc.documentElement.style.overflow = 'hidden'; } catch (e) {}
      if (!c.enabled || R.paused()) noTiles(false);
      bind();
      layout();
      try { el.querySelector('.rmv-close').focus(); } catch (e) {}
      return true;
    } catch (e) { try { close(); } catch (_) {} return false; }
  }

  function noTiles(countFail) {
    if (!S) return;
    S.failed = true;
    try {
      for (var k in S.tiles) { var im = S.tiles[k].img; if (im.parentNode) im.parentNode.removeChild(im); }
      S.tiles = {};
      S.el.classList.add('rmv-notiles');
    } catch (e) {}
  }

  function tileImg(url, st) {
    var k = _keep[url];
    if (k && k.complete && k.naturalWidth > 0) { _reused++; touch(url); return k; }
    var im = root.document.createElement('img');
    im.className = 'rmx-t'; im.alt = ''; im.draggable = false; im.decoding = 'async';
    im.setAttribute('referrerpolicy', 'strict-origin');
    im.onload = function () { try { im.classList.add('ok'); } catch (e) {} remember(url, im); if (S === st) prune(); };
    im.onerror = function () {
      /* gemeinsame 5-Minuten-Pause (route-map.js) — auch wenn die Ansicht schon wieder zu ist */
      try { RM()._err(null); } catch (e) {}
      if (S === st) noTiles(true);
    };
    im.src = url; _req++;
    return im;
  }

  /* Neu legen: Kacheln der passenden Stufe fuer die aktuelle Ansicht, alte als Unterlage. */
  function layout() {
    if (!S) return;
    var R = RM(), c = R.cfg();
    S.L = copy(S.C); S.lastLayout = Date.now();
    var v = R.viewAt(S.L.cx, S.L.cy, S.L.Z, S.L.w, S.L.h, c.tileSize);
    if (!v) return;
    var want = (S.failed || !c.enabled || R.paused()) ? [] : R.tiles(v);
    if (!S.failed && c.enabled && R.paused()) noTiles(false);
    var k, rec;
    for (k in S.tiles) S.tiles[k].cur = false;
    for (var i = 0; i < want.length; i++) {
      var t = want[i], url = R.tileUrl(t, c);
      rec = S.tiles[url];
      if (!rec) {
        rec = S.tiles[url] = { img: tileImg(url, S), gx: 0, gy: 0, gs: 0 };
        S.tilesEl.appendChild(rec.img);
      }
      /* Lage in Weltkoordinaten merken — damit die Kachel spaeter als Unterlage richtig liegt */
      rec.gx = (t.left + v.ox) / v.world; rec.gy = (t.top + v.oy) / v.world; rec.gs = (v.tile * v.scale) / v.world;
      rec.cur = true;
      rec.img.style.cssText = 'left:' + t.left + 'px;top:' + t.top + 'px;width:' + t.width + 'px;height:' + t.height + 'px;z-index:1';
    }
    /* Unterlage: Kacheln anderer Stufen/Stellen bleiben liegen, solange sie den Ausschnitt beruehren */
    for (k in S.tiles) {
      rec = S.tiles[k]; if (rec.cur) continue;
      var size = rec.gs * v.world, left = rec.gx * v.world - v.ox, tp = rec.gy * v.world - v.oy;
      var out = left > v.w || tp > v.h || left + size < 0 || tp + size < 0 || !(rec.img.complete && rec.img.naturalWidth > 0);
      if (out) { if (rec.img.parentNode) rec.img.parentNode.removeChild(rec.img); delete S.tiles[k]; continue; }
      rec.img.style.cssText = 'left:' + left.toFixed(1) + 'px;top:' + tp.toFixed(1) + 'px;width:' + size.toFixed(1) + 'px;height:' + size.toFixed(1) + 'px;z-index:0';
    }
    prune();
    var d = R.pathD(S.pts, v);
    S.cas.setAttribute('d', d); S.line.setAttribute('d', d);
    S.el.setAttribute('data-z', v.z);
    apply();
  }
  /* Sind alle Kacheln der aktuellen Stufe da, verschwindet die Unterlage. */
  function prune() {
    if (!S) return;
    var k, all = true, any = false;
    for (k in S.tiles) if (S.tiles[k].cur) { any = true; var im = S.tiles[k].img; if (!(im.complete && im.naturalWidth > 0)) { all = false; break; } }
    if (!any || !all) return;
    for (k in S.tiles) if (!S.tiles[k].cur) { var x = S.tiles[k].img; if (x.parentNode) x.parentNode.removeChild(x); delete S.tiles[k]; }
  }

  function apply() {
    if (!S) return;
    var d = delta(S.L, S.C);
    S.layer.style.transform = 'translate3d(' + d.tx.toFixed(2) + 'px,' + d.ty.toFixed(2) + 'px,0) scale(' + d.s.toFixed(5) + ')';
    S.g.setAttribute('transform', 'translate(' + d.tx.toFixed(2) + ' ' + d.ty.toFixed(2) + ') scale(' + d.s.toFixed(5) + ')');
    var a = screenOf(S.pts[0][0], S.pts[0][1], S.C), b = screenOf(S.pts[S.pts.length - 1][0], S.pts[S.pts.length - 1][1], S.C);
    S.start.setAttribute('cx', a[0].toFixed(1)); S.start.setAttribute('cy', a[1].toFixed(1));
    S.end.setAttribute('cx', b[0].toFixed(1)); S.end.setAttribute('cy', b[1].toFixed(1));
  }
  function frame() {
    if (!S || S.raf) return;
    var raf = root.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    S.raf = raf(function () { if (!S) return; S.raf = 0; apply(); });
  }
  function settle(ms) {
    if (!S) return;
    clearTimeout(S.settleT);
    var st = S;
    S.settleT = setTimeout(function () { if (S === st) layout(); }, ms == null ? SETTLE_MS : ms);
  }
  function stopAnim() { if (S && S.anim) { (root.cancelAnimationFrame || clearTimeout)(S.anim); S.anim = 0; } }
  /* animate(at): at(t) liefert die Ansicht fuer t = 0…1 */
  function animate(at, ms) {
    if (!S) return;
    stopAnim(); clearTimeout(S.settleT);
    var st = S, t0 = Date.now(), dur = ms || 220;
    var raf = root.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    var reduce = false; try { reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    if (reduce) { S.C = norm(at(1), S.lim); layout(); return; }
    (function step() {
      if (S !== st) return;
      var p = Math.min(1, (Date.now() - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      S.C = norm(at(e), S.lim); apply();
      if (p < 1) S.anim = raf(step); else { S.anim = 0; layout(); }
    })();
  }
  function zoomStep(dZ, px, py) {
    if (!S) return;
    var from = copy(S.C), x = px == null ? S.C.w / 2 : px, y = py == null ? S.C.h / 2 : py, lim = S.lim;
    animate(function (t) { return zoomAt(from, x, y, dZ * t, lim); });
  }
  function toFit() {
    if (!S) return;
    var from = copy(S.C), to = S.fit;
    animate(function (t) { return { cx: from.cx + (to.cx - from.cx) * t, cy: from.cy + (to.cy - from.cy) * t, Z: from.Z + (to.Z - from.Z) * t, w: from.w, h: from.h }; }, 320);
  }

  function bind() {
    var st = S, el = S.el, stage = S.stage, doc = root.document;
    function at(e) { var r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function centroid() { var x = 0, y = 0, n = 0, k; for (k in st.ptrs) { x += st.ptrs[k].x; y += st.ptrs[k].y; n++; } return n ? { x: x / n, y: y / n, n: n } : null; }
    function spread() { var a = null, b = null, k; for (k in st.ptrs) { if (!a) a = st.ptrs[k]; else if (!b) b = st.ptrs[k]; } return (a && b) ? Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)) : 0; }
    stage.addEventListener('pointerdown', function (e) {
      if (S !== st || (e.pointerType === 'mouse' && e.button > 0)) return;
      stopAnim(); clearTimeout(st.settleT);
      st.ptrs[e.pointerId] = at(e); st.n++;
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      if (st.n === 1) { st.moved = 0; st.down = { t: Date.now(), x: st.ptrs[e.pointerId].x, y: st.ptrs[e.pointerId].y }; } else st.down = null;
    });
    stage.addEventListener('pointermove', function (e) {
      if (S !== st || !st.ptrs[e.pointerId]) return;
      var c0 = centroid(), d0 = spread();
      st.ptrs[e.pointerId] = at(e);
      var c1 = centroid(), d1 = spread();
      var v = panBy(st.C, c1.x - c0.x, c1.y - c0.y);
      if (c1.n >= 2 && d0 > 8 && d1 > 8) v = zoomAt(v, c1.x, c1.y, Math.log(d1 / d0) / Math.LN2, st.lim);
      st.C = norm(v, st.lim);
      st.moved += Math.abs(c1.x - c0.x) + Math.abs(c1.y - c0.y);
      frame();
      /* nur beim Schieben mit einem Finger nachladen — nie mitten im Zoomen */
      if (c1.n === 1 && Date.now() - st.lastLayout > PAN_LAYOUT_MS) layout();
    });
    function up(e) {
      if (S !== st || !st.ptrs[e.pointerId]) return;
      var p = st.ptrs[e.pointerId];
      delete st.ptrs[e.pointerId]; st.n = Math.max(0, st.n - 1);
      try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
      if (st.n > 0) return;
      var now = Date.now();
      if (e.type === 'pointerup' && st.down && st.moved < 8 && now - st.down.t < 320) {
        /* Doppeltipp ⇒ eine Stufe hinein, auf die getippte Stelle */
        if (st.lastTap && now - st.lastTap.t < 340 && Math.abs(st.lastTap.x - p.x) < 34 && Math.abs(st.lastTap.y - p.y) < 34) { st.lastTap = null; zoomStep(1, p.x, p.y); return; }
        st.lastTap = { t: now, x: p.x, y: p.y };
      } else st.lastTap = null;
      settle(40);
    }
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', function (e) {
      if (S !== st) return;
      e.preventDefault(); stopAnim();
      var p = at(e), unit = e.deltaMode === 1 ? 32 : 1;
      st.C = norm(zoomAt(st.C, p.x, p.y, -clamp(e.deltaY * unit, -240, 240) / 240, st.lim), st.lim);
      frame(); settle();
    }, { passive: false });
    /* iOS: die Seite selbst darf weder scrollen noch zoomen */
    stage.addEventListener('touchmove', function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });
    el.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    el.querySelector('.rmv-close').addEventListener('click', function () { close(); });
    el.querySelector('.rmv-in').addEventListener('click', function () { zoomStep(1); });
    el.querySelector('.rmv-out').addEventListener('click', function () { zoomStep(-1); });
    el.querySelector('.rmv-fit').addEventListener('click', function () { toFit(); });
    st.onKey = function (e) {
      if (S !== st) return;
      var k = e.key;
      if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (k === 'Tab') {
        var bs = el.querySelectorAll('button'), i = Array.prototype.indexOf.call(bs, doc.activeElement);
        e.preventDefault(); bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus(); return;
      }
      if (k === '+' || k === '=') { e.preventDefault(); zoomStep(1); return; }
      if (k === '-' || k === '_') { e.preventDefault(); zoomStep(-1); return; }
      if (k === '0') { e.preventDefault(); toFit(); return; }
      var dx = k === 'ArrowLeft' ? 80 : (k === 'ArrowRight' ? -80 : 0), dy = k === 'ArrowUp' ? 80 : (k === 'ArrowDown' ? -80 : 0);
      if (dx || dy) { e.preventDefault(); st.C = norm(panBy(st.C, dx, dy), st.lim); frame(); settle(); }
    };
    doc.addEventListener('keydown', st.onKey, true);
    st.onResize = function () {
      if (S !== st) return;
      var w = stage.clientWidth, h = stage.clientHeight;
      if (!(w > 0) || !(h > 0) || (w === st.C.w && h === st.C.h)) return;
      var f = fitView(st.pts, w, h, st.pad); if (!f) return;
      st.fit = f; st.lim = limits(f.Z); st.C.w = w; st.C.h = h; st.C = norm(st.C, st.lim); layout();
    };
    root.addEventListener('resize', st.onResize);
  }

  function close() {
    var st = S; if (!st) return false;
    S = null;
    try { clearTimeout(st.settleT); if (st.anim) (root.cancelAnimationFrame || clearTimeout)(st.anim); } catch (e) {}
    try { root.document.removeEventListener('keydown', st.onKey, true); root.removeEventListener('resize', st.onResize); } catch (e) {}
    try { if (st.el.parentNode) st.el.parentNode.removeChild(st.el); } catch (e) {}
    try { root.document.documentElement.style.overflow = st.prevOverflow || ''; } catch (e) {}
    try { if (st.prevFocus && st.prevFocus.focus) st.prevFocus.focus(); } catch (e) {}
    return true;
  }

  O.routeMapView = { VERSION: VERSION, open: open, close: close, isOpen: function () { return !!S; },
    fitView: fitView, limits: limits, norm: norm, panBy: panBy, zoomAt: zoomAt, delta: delta, origin: origin, thin: thin,
    Z_OUT: Z_OUT, Z_MAX: Z_MAX,
    stats: function () { var n = 0, cur = 0, k; if (S) for (k in S.tiles) { n++; if (S.tiles[k].cur) cur++; }
      return { open: !!S, requested: _req, reused: _reused, kept: _order.length, tiles: n, current: cur, failed: !!(S && S.failed), Z: S ? S.C.Z : null, cx: S ? S.C.cx : null, cy: S ? S.C.cy : null, fitZ: S ? S.fit.Z : null }; },
    /* nur fuer Tests: Ansicht setzen und sofort legen */
    _set: function (v) { if (!S) return false; S.C = norm({ cx: v.cx == null ? S.C.cx : v.cx, cy: v.cy == null ? S.C.cy : v.cy, Z: v.Z == null ? S.C.Z : v.Z, w: S.C.w, h: S.C.h }, S.lim); layout(); return true; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = O.routeMapView;
})(typeof window !== 'undefined' ? window : globalThis);
