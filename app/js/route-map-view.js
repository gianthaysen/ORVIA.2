/* ============================================================
   ORVIA · route-map-view — Kartenansicht zum Umsehen (v8-435)
   ------------------------------------------------------------
   Gians Auftrag 5.10.: Auf der Aktivitaetsseite oben auf die Karte tippen ⇒ die Karte
   oeffnet sich mit der Strecke, und man kann sich darin umsehen (verschieben, zoomen).

   Weg ueber Bildkacheln (bis v8-439 der einzige; seit v8-440 Rueckfall — siehe unten):
   dieselben Rasterkacheln wie im Standbild (route-map.js), nur beweglich. Dieses Modul kennt keinen Anbieter — Adressen, Logo und
   Quellenhinweis kommen ueber ORVIA.routeMap.cfg() aus map-config.js.

   Aufbau
     · „gelegte Ansicht" L: fuer sie liegen die Kacheln (Lage/Groesse in px). „aktuelle
       Ansicht" C: wohin der Finger sie gerade geschoben hat. Waehrend der Geste bewegt nur
       EINE Transformation die Kachelebene (kein Neulegen, kein Neuladen).
     · Der Streckenpfad wird EINMAL gerechnet (Bezugsansicht R0 = „ganze Strecke") und
       danach nur noch transformiert; seine Strichstaerke bleibt gleich (non-scaling-stroke).
     · Neu gelegt wird nur, wenn Kacheln fehlen oder sich die Zoomstufe geaendert hat; die
       bisherigen Kacheln bleiben als Unterlage liegen, bis die neuen da sind.
   Fluessigkeit (v8-437, Gian: „laedt noch laenger und ruckelt manchmal")
     · Vorher wurde beim Schieben alle 220 ms ALLES neu gelegt und der Pfad (zwei Mal einige
       tausend Punkte) neu geschrieben — das waren die Ruckler. Jetzt: Pfad einmal,
       Kacheln nur bei Bedarf; je Bild genau zwei Transformationen.
     · Kein Filter auf den Kachelbildern, keine Unschaerfe-Flaechen ueber der Karte.
     · Beim Oeffnen liegen sofort die Kacheln des Kartenfelds darunter (kommen aus dem
       Zwischenspeicher des Browsers), die scharfen ersetzen sie.
     · Loslassen im Schwung ⇒ die Karte gleitet aus.
   Anfragen sparen (abgerechnet wird je Kachel)
     · Waehrend zwei Finger zoomen, wird NICHTS angefragt — erst die Endstufe.
     · Geladene Kachelbilder bleiben fuer die Sitzung im Speicher: erneutes Oeffnen und
       Zurueckschieben kosten keine Anfrage. (Der Anbieter erlaubt dem Browser ausserdem
       acht Stunden Zwischenspeichern.)
     · Dieselbe Kachelstufe wie das Standbild (routeMap.level).
   Rueckfall
     · Scheitert eine Kachel, gilt die gemeinsame 5-Minuten-Pause von route-map.js; die
       Ansicht bleibt bedienbar und zeigt die Strecke ohne Hintergrund samt Hinweis.

   Alles Rechnen ist rein und testbar (fitView/panBy/zoomAt/delta/limits).

   v8-440 — zwei Wege, EINE Ansicht:
     · Zeichnet das Geraet die Karte selbst (map-config.js engine:'vector'), uebernimmt
       route-map-gl.js Karte, Strecke und Gesten; dieses Modul stellt nur noch Rahmen,
       Kopf, Knoepfe, Tastatur und Fokus. Bis die Karte steht, zeigt es die Strecke als
       Standbild (derselbe Ausschnitt — der Wechsel ist nicht zu sehen).
     · Sonst (engine:'raster', oder das Zeichnen geht auf dem Geraet nicht) gilt alles
       oben Beschriebene unveraendert: Bildkacheln, eigene Gesten.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'route-map-view@3';
  var Z_OUT = 3;            /* so viele Stufen weiter heraus als „ganze Strecke" */
  var Z_MAX = 18;           /* stufenlose Obergrenze (Welt = 256 · 2^Z) ⇒ 512er-Kachelstufe hoechstens 17 */
  var KEEP_MAX = 32;        /* Kachelbilder im Sitzungsspeicher dieser Ansicht (ein Bild ≈ 4 MB entpackt — auf dem Handy bewusst knapp;
                               was herausfaellt, liefert der Browser-Zwischenspeicher ohne neue Anfrage nach) */
  var MAX_PTS = 4000;       /* mehr Streckenpunkte werden fuer die Ansicht ausgeduennt */
  var PAN_CHECK_MS = 160;   /* beim Schieben hoechstens so oft pruefen, ob Kacheln fehlen */
  var SETTLE_MS = 140;
  var FLING_MIN = 0.25;     /* px/ms — ab diesem Schwung gleitet die Karte nach dem Loslassen aus */
  var FLING_TAU = 300;      /* ms — so schnell klingt der Schwung ab */
  var EDGE = 140;           /* px — so weit reicht die Streckenebene ueber den Bildschirm hinaus (siehe apply) */
  var GL_BAND = 40;         /* px — um so viel reicht das Band hinter dem Kopf ueber den Kopf hinaus (styles.css .rmv-glmode .rmv-dim) */

  function RM() { return O.routeMap; }
  function GL() { return O.routeMapGL; }
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
  var _keep = {}, _order = [], _req = 0, _reused = 0, _seeded = 0, _bakes = 0;
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
      var raw = R.valid(route);
      if (raw.length < 2) return false;
      /* gezeichnet wird die geglaettete, ausgeduennte Anzeige-Strecke; der Ausschnitt kommt aus den Rohpunkten */
      var pts = thin(R.display ? R.display(raw) : raw);
      if (pts.length < 2) pts = raw;
      if (S) close();
      opts = opts || {};
      var L = opts.labels || {}, c = R.cfg();
      var el = doc.createElement('div');
      el.className = 'rmv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', L.map || 'Karte');
      /* v8-439: Farbthema der Sportart (data-activity ⇒ --activity-primary, Werte in styles.css).
         Die Ansicht haengt am body, erbt das Thema der Aktivitaetsseite also nicht — es wird mitgegeben.
         opts.color bleibt als ausdrueckliche Einzelfarbe moeglich (ueberschreibt das Thema). */
      if (opts.activity) el.setAttribute('data-activity', String(opts.activity));
      if (opts.color) el.style.setProperty('--activity-primary', String(opts.color));
      el.innerHTML =
        '<div class="rmv-stage">' +
          '<div class="rmv-gl"></div>' +
          '<div class="rmv-layer"><div class="rmv-tiles"></div></div>' +
          '<div class="rmv-dim"></div>' +
          '<svg class="rmv-route" aria-hidden="true"><g class="rmv-g">' +
            '<path class="rmx-case" fill="none" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
            '<path class="rmx-line" fill="none" stroke="var(--activity-primary)" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
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
      /* v8-440: Zeichnet die Karte die Strecke selbst, liegt die Strecke UNTER dem dunklen Band hinter dem
         Kopf (bei Bildkacheln lag sie als SVG darueber). Der Innenrand oben reicht deshalb bis ans Ende des
         Bandes (40 px weiter) — die Strecke beginnt erst, wo die Karte wieder frei ist. */
      var glWant = c.engine === 'vector' && c.enabled && !R.paused();
      var pad = { t: clamp(padT + (glWant ? GL_BAND : 0), 60, h * 0.35), r: 44, b: clamp(Math.round(h * 0.16), 70, 150), l: 44 };
      var fit = fitView(raw, w, h, pad);
      if (!fit) { doc.body.removeChild(el); return false; }

      S = { el: el, stage: stage, layer: el.querySelector('.rmv-layer'), tilesEl: el.querySelector('.rmv-tiles'),
        svg: el.querySelector('.rmv-route'), g: el.querySelector('.rmv-g'), cas: el.querySelector('.rmx-case'), line: el.querySelector('.rmx-line'), B: null,
        start: el.querySelector('.rmx-start'), end: el.querySelector('.rmx-end'),
        pts: pts, raw: raw, pad: pad, fit: fit, lim: limits(fit.Z), L: copy(fit), C: copy(fit), R0: copy(fit),
        ptrs: {}, n: 0, raf: 0, settleT: 0, anim: 0, lastCheck: 0, tiles: {}, failed: false, moved: 0, down: null, lastTap: null, trail: [],
        gl: null, glBox: el.querySelector('.rmv-gl'),
        prevFocus: doc.activeElement, prevOverflow: doc.documentElement.style.overflow };
      try { doc.documentElement.style.overflow = 'hidden'; } catch (e) {}
      /* Pfad EINMAL in der Bezugsansicht (zwei Nachkommastellen: bleibt auch 100-fach vergroessert genau) */
      var d = R.pathD(pts, R.viewAt(fit.cx, fit.cy, fit.Z, w, h, c.tileSize), { round: R.ROUND_M, digits: 2 });
      S.cas.setAttribute('d', d); S.line.setAttribute('d', d);
      bind();
      if (!(glWant && startGL(S))) startRaster(S, opts.seed);
      try { el.querySelector('.rmv-close').focus(); } catch (e) {}
      return true;
    } catch (e) { try { close(); } catch (_) {} return false; }
  }

  /* Bildkacheln + eigene Gesten (bis v8-439 der einzige Weg; jetzt Rueckfall und engine:'raster') */
  function startRaster(st, sd) {
    if (S !== st) return;
    var R = RM(), c = R.cfg();
    st.gl = null; st.el.classList.remove('rmv-glmode'); st.el.classList.remove('rmv-glready');
    if (!c.enabled || R.paused()) noTiles(false);
    else if (sd) seed(sd, c);
    bindGestures();
    layout();
  }
  /* Karte, Strecke und Gesten von route-map-gl.js. false ⇒ nicht moeglich (Aufrufer nimmt Bildkacheln). */
  function startGL(st) {
    try {
      var G = GL(); if (!G || !G.usable()) return false;
      var el = st.el, cs = null, val = function (n, d) { try { var v = cs.getPropertyValue(n); v = v ? String(v).trim() : ''; return v || d; } catch (e) { return d; } };
      try { cs = root.getComputedStyle(el); } catch (e) { cs = null; }
      el.classList.add('rmv-glmode');
      apply();   /* Strecke als Standbild im Ausschnitt „ganze Strecke", bis die Karte steht */
      var ctl = G.viewer(st.glBox, {
        cam: G.cameraAt(st.fit.cx, st.fit.cy, st.fit.Z), minZoom: st.lim.min - 1, maxZoom: st.lim.max - 1, pts: st.pts,
        /* Farben aus dem Farbsystem (styles.css): Strecke = Thema der Sportart am Element, Start/Ziel = Zustandsfarben */
        colors: { line: val('--activity-primary', null), start: val('--orvia-route-start', null), finish: val('--orvia-route-finish', null), base: val('--orvia-bg-base', null) },
        widths: { line: 5, casing: 8 },
        onReady: function () { if (S === st) el.classList.add('rmv-glready'); },
        onFail: function (kind) {
          if (S !== st) return;
          if (kind === 'engine') { startRaster(st, null); return; }
          /* Kartendaten kommen nicht: Strecke bleibt bedienbar, Hinweis erscheint, 5 Minuten keine neuen Versuche */
          if (!st.failed) { st.failed = true; try { RM()._err(null); } catch (e) {} el.classList.add('rmv-notiles'); }
        } });
      if (!ctl) { el.classList.remove('rmv-glmode'); return false; }
      st.gl = ctl;
      return true;
    } catch (e) { try { st.el.classList.remove('rmv-glmode'); } catch (_) {} return false; }
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

  /* Unterlage beim Oeffnen: die Kacheln, die das Kartenfeld der Seite schon geladen hat. Sie kommen
     aus dem Zwischenspeicher des Browsers (keine Wartezeit) und liegen unscharf darunter, bis die
     scharfen Kacheln der Ansicht da sind. sd = { w, h, pad } des Felds. */
  function seed(sd, c) {
    try {
      var R = RM(), v = R.fit(S.raw, +sd.w, +sd.h, sd.pad, c.tileSize);
      if (!v) return;
      var t = R.tiles(v);
      for (var i = 0; i < t.length && i < 6; i++) {
        var url = R.tileUrl(t[i], c); if (S.tiles[url]) continue;
        var had = !!(_keep[url] && _keep[url].complete && _keep[url].naturalWidth > 0);
        S.tiles[url] = { img: tileImg(url, S), gx: (t[i].left + v.ox) / v.world, gy: (t[i].top + v.oy) / v.world, gs: (v.tile * v.scale) / v.world, cur: false, seed: true };
        if (!had) { _req--; _seeded++; }
        S.tilesEl.appendChild(S.tiles[url].img);
      }
    } catch (e) {}
  }
  /* need(): fehlt fuer die aktuelle Ansicht eine Kachel? (nur dann wird neu gelegt/geladen) */
  function need() {
    if (!S) return false;
    var R = RM(), c = R.cfg();
    if (S.failed || !c.enabled || R.paused()) return false;
    var v = R.viewAt(S.C.cx, S.C.cy, S.C.Z, S.C.w, S.C.h, c.tileSize);
    if (!v) return false;
    var t = R.tiles(v);
    for (var i = 0; i < t.length; i++) { var rec = S.tiles[R.tileUrl(t[i], c)]; if (!rec || !rec.cur) return true; }
    return false;
  }
  /* Neu legen: Kacheln der passenden Stufe fuer die aktuelle Ansicht, alte als Unterlage. */
  function layout() {
    if (!S) return;
    var R = RM(), c = R.cfg();
    S.L = copy(S.C); S.lastCheck = Date.now();
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
      rec.seed = false;
      /* Lage in Weltkoordinaten merken — damit die Kachel spaeter als Unterlage richtig liegt */
      rec.gx = (t.left + v.ox) / v.world; rec.gy = (t.top + v.oy) / v.world; rec.gs = (v.tile * v.scale) / v.world;
      rec.cur = true;
      rec.img.style.cssText = 'left:' + t.left + 'px;top:' + t.top + 'px;width:' + t.width + 'px;height:' + t.height + 'px;z-index:1';
    }
    /* Unterlage: Kacheln anderer Stufen/Stellen bleiben liegen, solange sie den Ausschnitt beruehren */
    for (k in S.tiles) {
      rec = S.tiles[k]; if (rec.cur) continue;
      var size = rec.gs * v.world, left = rec.gx * v.world - v.ox, tp = rec.gy * v.world - v.oy;
      var out = left > v.w || tp > v.h || left + size < 0 || tp + size < 0 || (!rec.seed && !(rec.img.complete && rec.img.naturalWidth > 0));
      if (out) { if (rec.img.parentNode) rec.img.parentNode.removeChild(rec.img); delete S.tiles[k]; continue; }
      rec.img.style.cssText = 'left:' + left.toFixed(1) + 'px;top:' + tp.toFixed(1) + 'px;width:' + size.toFixed(1) + 'px;height:' + size.toFixed(1) + 'px;z-index:0';
    }
    prune();
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
    /* Strecke: Gemessen kostet das Neuzeichnen des Pfads je Bild mehr als alles andere. Beim
       reinen Verschieben (gleiche Zoomstufe) wird die fertig gezeichnete Streckenebene deshalb
       nur verschoben — sie reicht EDGE px ueber den Bildschirm hinaus; erst wenn davon 60 %
       verbraucht sind, wird neu gezeichnet. Beim Zoomen wird je Bild neu gezeichnet (Linie
       bleibt scharf und gleich breit). */
    if (S.B && Math.abs(S.C.Z - S.B.Z) < 1e-9) {
      var m = delta(S.B, S.C);
      if (Math.abs(m.tx) <= EDGE * 0.6 && Math.abs(m.ty) <= EDGE * 0.6) { S.svg.style.transform = 'translate3d(' + m.tx.toFixed(2) + 'px,' + m.ty.toFixed(2) + 'px,0)'; return; }
    }
    bake();
  }
  /* bake(): Strecke fuer die aktuelle Ansicht zeichnen (Pfad bleibt, nur seine Transformation) */
  function bake() {
    var r = delta(S.R0, S.C);
    S.g.setAttribute('transform', 'translate(' + (r.tx + EDGE).toFixed(2) + ' ' + (r.ty + EDGE).toFixed(2) + ') scale(' + r.s.toFixed(6) + ')');
    var a = screenOf(S.pts[0][0], S.pts[0][1], S.C), b = screenOf(S.pts[S.pts.length - 1][0], S.pts[S.pts.length - 1][1], S.C);
    S.start.setAttribute('cx', (a[0] + EDGE).toFixed(1)); S.start.setAttribute('cy', (a[1] + EDGE).toFixed(1));
    S.end.setAttribute('cx', (b[0] + EDGE).toFixed(1)); S.end.setAttribute('cy', (b[1] + EDGE).toFixed(1));
    S.B = copy(S.C); S.svg.style.transform = 'translate3d(0,0,0)';
    _bakes++;
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
    S.settleT = setTimeout(function () { if (S === st) rest(); }, ms == null ? SETTLE_MS : ms);
  }
  /* Ruhe: neu legen nur bei geaenderter Zoomstufe (scharfe Kacheln) oder wenn Kacheln fehlen */
  function rest() { if (!S) return; if (Math.abs(S.C.Z - S.L.Z) > 1e-9 || need()) layout(); }
  /* Schwung nach dem Loslassen: gleitet aus, laedt unterwegs nur Fehlendes */
  function fling(vx, vy) {
    if (!S) return;
    var st = S, last = Date.now();
    var raf = root.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    (function step() {
      if (S !== st) return;
      var t = Date.now(), dt = Math.min(48, Math.max(1, t - last)), k = Math.exp(-dt / FLING_TAU); last = t;
      st.C = norm(panBy(st.C, vx * dt, vy * dt), st.lim); vx *= k; vy *= k; apply();
      if (t - st.lastCheck > PAN_CHECK_MS) { st.lastCheck = t; if (need()) layout(); }
      if (Math.sqrt(vx * vx + vy * vy) > 0.03) st.anim = raf(step); else { st.anim = 0; rest(); }
    })();
  }
  function stopAnim() { if (S && S.anim) { (root.cancelAnimationFrame || clearTimeout)(S.anim); S.anim = 0; } }
  /* animate(at): at(t) liefert die Ansicht fuer t = 0…1 */
  function animate(at, ms) {
    if (!S) return;
    stopAnim(); clearTimeout(S.settleT);
    var st = S, t0 = Date.now(), dur = ms || 220;
    var raf = root.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    var reduce = false; try { reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    if (reduce) { S.C = norm(at(1), S.lim); apply(); rest(); return; }
    (function step() {
      if (S !== st) return;
      var p = Math.min(1, (Date.now() - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      S.C = norm(at(e), S.lim); apply();
      if (p < 1) S.anim = raf(step); else { S.anim = 0; rest(); }
    })();
  }
  function zoomStep(dZ, px, py) {
    if (!S) return;
    if (S.gl) { S.gl.zoomBy(dZ); return; }
    var from = copy(S.C), x = px == null ? S.C.w / 2 : px, y = py == null ? S.C.h / 2 : py, lim = S.lim;
    animate(function (t) { return zoomAt(from, x, y, dZ * t, lim); });
  }
  function toFit() {
    if (!S) return;
    if (S.gl) { S.gl.fit(); return; }
    var from = copy(S.C), to = S.fit;
    animate(function (t) { return { cx: from.cx + (to.cx - from.cx) * t, cy: from.cy + (to.cy - from.cy) * t, Z: from.Z + (to.Z - from.Z) * t, w: from.w, h: from.h }; }, 320);
  }

  /* Eigene Gesten auf der Buehne — nur fuer Bildkacheln (die gezeichnete Karte bringt ihre Gesten mit) */
  function bindGestures() {
    var st = S, stage = S.stage;
    if (st.gestures) return; st.gestures = true;
    function at(e) { var r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function centroid() { var x = 0, y = 0, n = 0, k; for (k in st.ptrs) { x += st.ptrs[k].x; y += st.ptrs[k].y; n++; } return n ? { x: x / n, y: y / n, n: n } : null; }
    function spread() { var a = null, b = null, k; for (k in st.ptrs) { if (!a) a = st.ptrs[k]; else if (!b) b = st.ptrs[k]; } return (a && b) ? Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)) : 0; }
    stage.addEventListener('pointerdown', function (e) {
      if (S !== st || (e.pointerType === 'mouse' && e.button > 0)) return;
      stopAnim(); clearTimeout(st.settleT);
      st.ptrs[e.pointerId] = at(e); st.n++;
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      st.trail = [];
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
      var now = Date.now();
      if (c1.n === 1) {
        st.trail.push({ t: now, x: c1.x, y: c1.y }); if (st.trail.length > 6) st.trail.shift();
        /* nur beim Schieben mit einem Finger nachladen — nie mitten im Zoomen — und nur, wenn wirklich eine Kachel fehlt */
        if (now - st.lastCheck > PAN_CHECK_MS) { st.lastCheck = now; if (need()) layout(); }
      } else st.trail = [];
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
      /* Schwung: Geschwindigkeit der letzten ~100 ms; nur wenn der Finger bis zuletzt in Bewegung war */
      var tr = st.trail, vx = 0, vy = 0; st.trail = [];
      if (e.type === 'pointerup' && tr.length >= 2 && now - tr[tr.length - 1].t < 60) {
        var a = tr[0]; for (var i = 0; i < tr.length; i++) if (now - tr[i].t <= 110) { a = tr[i]; break; }
        var b = tr[tr.length - 1], dt = b.t - a.t;
        if (dt > 8) { vx = (b.x - a.x) / dt; vy = (b.y - a.y) / dt; }
      }
      var reduce = false; try { reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
      if (!reduce && Math.sqrt(vx * vx + vy * vy) >= FLING_MIN) { var cap = 3 / Math.max(3, Math.sqrt(vx * vx + vy * vy)); fling(vx * cap, vy * cap); }
      else settle(40);
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
  }
  function bind() {
    var st = S, el = S.el, stage = S.stage, doc = root.document;
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
      if (dx || dy) { e.preventDefault(); if (st.gl) { st.gl.panBy(-dx, -dy); return; } st.C = norm(panBy(st.C, dx, dy), st.lim); frame(); settle(); }
    };
    doc.addEventListener('keydown', st.onKey, true);
    st.onResize = function () {
      if (S !== st) return;
      var w = stage.clientWidth, h = stage.clientHeight;
      if (!(w > 0) || !(h > 0) || (w === st.C.w && h === st.C.h)) return;
      var f = fitView(st.raw, w, h, st.pad); if (!f) return;
      /* Bezugsansicht des Pfads behaelt ihre Groesse — die Umrechnung laeuft ueber Mittelpunkt und Zoomstufe */
      var f0 = fitView(st.raw, w, h, st.pad) || f;
      st.fit = f0; st.lim = limits(f0.Z); st.C.w = w; st.C.h = h; st.L.w = w; st.L.h = h; st.B = null; st.C = norm(st.C, st.lim);
      if (st.gl) { st.gl.resize(); st.gl.limits(st.lim.min - 1, st.lim.max - 1); st.gl.fit(GL().cameraAt(f0.cx, f0.cy, f0.Z)); return; }
      layout();
    };
    root.addEventListener('resize', st.onResize);
  }

  function close() {
    var st = S; if (!st) return false;
    S = null;
    try { clearTimeout(st.settleT); if (st.anim) (root.cancelAnimationFrame || clearTimeout)(st.anim); } catch (e) {}
    try { if (st.gl) st.gl.destroy(); } catch (e) {}
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
      return { open: !!S, engine: S ? (S.gl ? 'vector' : 'raster') : null, gl: (S && S.gl) ? S.gl.state() : null, requested: _req, seeded: _seeded, bakes: _bakes, reused: _reused, kept: _order.length, tiles: n, current: cur, points: S ? S.pts.length : null, failed: !!(S && S.failed), Z: S ? S.C.Z : null, cx: S ? S.C.cx : null, cy: S ? S.C.cy : null, fitZ: S ? S.fit.Z : null }; },
    /* nur fuer Tests: Ansicht setzen und sofort legen */
    _gl: function () { return S ? S.gl : null; },
    _set: function (v) { if (!S) return false;
      if (S.gl) { var g0 = S.gl.state() || {}, R0 = RM(); S.gl.jump(GL().cameraAt(v.cx == null ? R0.lonX(g0.lon) : v.cx, v.cy == null ? R0.latY(g0.lat) : v.cy, v.Z == null ? g0.zoom + 1 : v.Z)); return true; }
      S.C = norm({ cx: v.cx == null ? S.C.cx : v.cx, cy: v.cy == null ? S.C.cy : v.cy, Z: v.Z == null ? S.C.Z : v.Z, w: S.C.w, h: S.C.h }, S.lim); layout(); return true; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = O.routeMapView;
})(typeof window !== 'undefined' ? window : globalThis);
