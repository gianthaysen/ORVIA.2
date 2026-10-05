/* ============================================================
   ORVIA · route-map-gl — die Karte wird auf dem Geraet gezeichnet (v8-440)
   ------------------------------------------------------------
   Gians Auftrag 5.10.: eigene ORVIA-Karte (kein Gruen, Navy/Graphit), scharf, die Strecke
   als Held. Ergebnis der Pruefung der bisherigen Technik (Bildkacheln, bis v8-439):
     · Schaerfe: Der Anbieter liefert Bildkacheln hoechstens in doppelter Aufloesung. Ein
       iPhone hat die dreifache Pixeldichte — die Bilder wurden also hochgerechnet, dazu
       um bis zu 57 % gestreckt (Stufenwahl). Das war der unscharfe Eindruck.
     · Farben: Ein fertiges Bild laesst sich nur per Filter umfaerben — genau das wirkte
       „wie ein Filter". Ein eigener Stil braucht entweder das Anbieter-Konto oder eine
       Karte, die erst auf dem Geraet gezeichnet wird.
     · Beschriftung wuchs und schrumpfte mit der Streckung der Kachel.
   Deshalb jetzt Vektordaten + Zeichnen auf dem Geraet (Bibliothek MapLibre GL JS, lokal
   mitgeliefert, erst beim ersten Kartenbedarf nachgeladen). Der Stil steht in map-style.js.

   Was dieses Modul tut — und NUR dieses Modul spricht mit der Bibliothek:
     · attach(): stehende Karte hinter der Strecke (Story, Kartenfeld). Die Strecke bleibt
       das SVG von route-map.js in derselben Projektion (Web-Mercator) — pixelgleich.
       Eine einmal gezeichnete Karte wird in der Sitzung wiederverwendet (die Story setzt
       ihr Markup bei jedem Seitenwechsel neu): dasselbe Element, keine neue Anfrage.
     · viewer(): bewegliche Karte fuer die Kartenansicht; die Strecke ist dort eine Ebene
       der Karte (bewegt und zoomt ohne Nachlauf).
   Rueckfall: Kann das Geraet die Karte nicht zeichnen (kein WebGL, Fehler beim Aufbau),
   gilt fuer den Rest der Sitzung wieder die bisherige Technik (Bildkacheln) — Meldung
   'engine'. Kommen Kartendaten oder Bibliothek nicht (offline, Kontingent, Schluessel),
   meldet attach()/viewer() 'tiles' — der Aufrufer zeigt die Strecke ohne Karte und
   versucht es nach der ueblichen Pause erneut (wie bisher).

   Dieses Modul kennt keinen Anbieter: Adressen kommen aus map-config.js (vector.*).
   Datenschutz wie bisher: Der Anbieter sieht IP-Adresse und Kartenausschnitt; mitgeschickt
   wird nur die Herkunft der Seite, nie Konto- oder Aktivitaetsdaten. Die Strecke selbst
   verlaesst das Geraet nicht.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'route-map-gl@1';
  var MAX_STATIC = 3;          /* so viele stehende Karten bleiben hoechstens im Speicher (je eine Zeichenflaeche) */
  var IDLE_MS = 45000;         /* nicht mehr sichtbare Karten werden danach freigegeben */
  var MAX_RATIO = 3;           /* Pixeldichte der Zeichenflaeche: voll bis zum Dreifachen (iPhone) */

  var _down = null;            /* 'engine' ⇒ fuer diese Sitzung nicht mehr versuchen */
  var _webgl = null, _libP = null;
  var _static = {}, _order = [], _sweepT = 0;
  var _n = { created: 0, reused: 0, removed: 0, failed: 0, viewers: 0 };

  function now() { return (typeof Date !== 'undefined') ? Date.now() : 0; }

  /* Einstellung lesen. Adressvorlagen bekommen hier den Schluessel eingesetzt; die Platzhalter
     {z}/{x}/{y} bzw. {fontstack}/{range} fuellt die Bibliothek. */
  function cfg() {
    var c = root.ORVIA_MAP_CONFIG || {}, v = c.vector || {};
    var key = String(c.key || '').trim();
    var sub = function (t) { return t ? String(t).replace('{key}', encodeURIComponent(key)) : null; };
    var needKey = !!v.tiles && String(v.tiles).indexOf('{key}') >= 0;
    return {
      on: c.engine === 'vector' && c.enabled !== false && !!v.lib && !!v.tiles && (!needKey || !!key),
      lib: v.lib ? String(v.lib) : null, tiles: sub(v.tiles), glyphs: sub(v.glyphs),
      maxzoom: (+v.maxzoom > 0) ? +v.maxzoom : 14,
      fonts: Array.isArray(v.fonts) && v.fonts.length ? v.fonts.slice() : null
    };
  }
  function supported() {
    if (_webgl != null) return _webgl;
    _webgl = false;
    try {
      var doc = root.document;
      if (!doc || !doc.createElement) return false;
      var cv = doc.createElement('canvas');
      var gl = cv.getContext('webgl2') || cv.getContext('webgl');
      _webgl = !!gl;
      /* die Probe-Flaeche sofort freigeben — Browser erlauben nur wenige gleichzeitig */
      try { var x = gl && gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) {}
    } catch (e) { _webgl = false; }
    return _webgl;
  }
  function usable() { return !_down && cfg().on && !!O.mapStyle && supported(); }

  /* Ausschnitt von route-map.js (Welt = 256 · 2^Z px, Ursprung ox/oy) → Kamera der Karte.
     Die Bibliothek rechnet mit einer 512er-Welt: ihre Zoomstufe ist deshalb Z − 1. */
  function camera(v) {
    if (!v || !(v.world > 0)) return null;
    var R = O.routeMap, cx = (v.ox + v.w / 2) / v.world, cy = (v.oy + v.h / 2) / v.world;
    return { lon: R.xLon(cx), lat: R.yLat(cy), zoom: v.Z - 1 };
  }
  function cameraAt(cx, cy, Z) { var R = O.routeMap; return { lon: R.xLon(cx), lat: R.yLat(cy), zoom: Z - 1 }; }

  function load() {
    if (_libP) return _libP;
    _libP = new Promise(function (res, rej) {
      try {
        if (root.maplibregl) { res(root.maplibregl); return; }
        var c = cfg(), doc = root.document;
        if (!c.lib || !doc) { rej(new Error('no-lib')); return; }
        var s = doc.createElement('script');
        s.src = c.lib; s.async = true;
        s.onload = function () { if (root.maplibregl) res(root.maplibregl); else rej(new Error('lib-empty')); };
        s.onerror = function () { rej(new Error('lib-load')); };
        doc.head.appendChild(s);
      } catch (e) { rej(e); }
    });
    /* Bibliothek nicht ladbar ist ein NETZproblem (offline, Seite gerade nicht erreichbar), kein
       Geraeteproblem: beim naechsten Mal neu versuchen statt die Sitzung auf Bildkacheln festzulegen. */
    _libP.catch(function () { _libP = null; });
    return _libP;
  }
  function style() { var c = cfg(); return O.mapStyle.build({ tiles: c.tiles, glyphs: c.glyphs, maxzoom: c.maxzoom, fonts: c.fonts }); }
  function ratio() { var d = +root.devicePixelRatio || 1; return Math.max(1, Math.min(MAX_RATIO, d)); }
  /* nur die Herkunft mitschicken (wie bei den Bildkacheln: referrerpolicy strict-origin) */
  function transform(url) { return { url: url, referrerPolicy: 'strict-origin' }; }
  /* Fehler der Bibliothek einordnen: 'tiles' = Kartendaten kommen nicht (offline, Kontingent,
     Schluessel), 'engine' = Zeichnen geht nicht, null = unkritisch (z. B. eine Schrift fehlt). */
  function classify(e) {
    try {
      var err = e && e.error, msg = String((err && (err.message || err)) || '');
      if (e && e.sourceId === O.mapStyle.SOURCE) return 'tiles';
      if (/webgl|context/i.test(msg)) return 'engine';
    } catch (_) {}
    return null;
  }
  function options(box, cam, extra) {
    var o = { container: box, style: style(), center: [cam.lon, cam.lat], zoom: cam.zoom, attributionControl: false,
      pixelRatio: ratio(), maxPitch: 0, pitchWithRotate: false, dragRotate: false, touchPitch: false,
      transformRequest: transform, validateStyle: false, refreshExpiredTiles: false };
    for (var k in (extra || {})) o[k] = extra[k];
    return o;
  }

  /* ---------- stehende Karte (Story, Kartenfeld) ---------- */
  function drop(key, why) {
    var e = _static[key]; if (!e) return;
    delete _static[key];
    var i = _order.indexOf(key); if (i >= 0) _order.splice(i, 1);
    try { if (e.map) e.map.remove(); } catch (_) {}
    try { if (e.box && e.box.parentNode) e.box.parentNode.removeChild(e.box); } catch (_) {}
    _n.removed++;
  }
  function visible(box) { try { return !!(box && box.isConnected && box.offsetParent !== null); } catch (e) { return false; } }
  /* Aufraeumen: Karten, deren Feld nicht mehr sichtbar ist, nach einer Weile freigeben; nie mehr als MAX_STATIC halten. */
  function sweep() {
    var t = now(), keys = _order.slice(), k;
    for (var i = 0; i < keys.length; i++) { k = keys[i]; var e = _static[k]; if (e && !visible(e.box) && t - e.used > IDLE_MS) drop(k, 'idle'); }
    for (var j = 0; _order.length > MAX_STATIC && j < _order.length;) { k = _order[j]; if (_static[k] && !visible(_static[k].box)) drop(k, 'lru'); else j++; }
    clearTimeout(_sweepT);
    if (_order.length) _sweepT = setTimeout(sweep, IDLE_MS + 1000);
  }
  function touch(key) { var i = _order.indexOf(key); if (i >= 0) _order.splice(i, 1); _order.push(key); }

  /* attach(holder, cam, opts) — setzt die stehende Karte in holder (fuellt ihn ganz).
     cam = { lon, lat, zoom }; opts.onFail(kind) bei 'tiles' | 'engine'. Rueckgabe: true, wenn
     eine Karte eingesetzt oder angefordert wurde. */
  function attach(holder, cam, opts) {
    opts = opts || {};
    try {
      if (!holder || !cam || !usable()) return false;
      var w = holder.clientWidth, h = holder.clientHeight;
      if (!(w > 0) || !(h > 0)) return false;
      var key = [cam.lon.toFixed(6), cam.lat.toFixed(6), cam.zoom.toFixed(3), w, h].join('|');
      var e = _static[key];
      if (e && e.box) {
        /* dieselbe Karte wieder einsetzen — keine Anfrage, kein Neuaufbau */
        e.used = now(); e.onFail = opts.onFail || null; touch(key);
        if (e.box.parentNode !== holder) holder.appendChild(e.box);
        try { if (e.map) { e.map.resize(); e.map.triggerRepaint(); } } catch (_) {}
        _n.reused++; sweep();
        return true;
      }
      var doc = root.document, box = doc.createElement('div');
      box.className = 'rmx-glbox';
      holder.appendChild(box);
      e = _static[key] = { box: box, map: null, used: now(), onFail: opts.onFail || null, dead: false };
      _order.push(key);
      var fail = function (kind) {
        if (e.dead) return; e.dead = true; _n.failed++;
        if (kind === 'engine') _down = 'engine';
        var cb = e.onFail; drop(key, kind);
        try { if (cb) cb(kind); } catch (_) {}
      };
      load().then(function (ml) {
        if (e.dead || _static[key] !== e) return;
        try {
          e.map = new ml.Map(options(box, cam, { interactive: false, fadeDuration: 0, trackResize: false }));
          _n.created++;
          e.map.on('error', function (ev) { var k = classify(ev); if (k) fail(k); });
          e.map.once('idle', function () { try { box.classList.add('ok'); } catch (_) {} });
        } catch (err) { fail('engine'); }
      }, function () { fail('tiles'); });
      sweep();
      return true;
    } catch (err) { return false; }
  }

  /* ---------- bewegliche Karte (Kartenansicht) ---------- */
  /* viewer(box, o) → Steuerung { zoomBy, panBy, fit, resize, state, destroy } oder null.
     o: cam {lon,lat,zoom} = „ganze Strecke", minZoom, maxZoom, pts [[lat,lon]…],
        colors { line, start, finish, base }, widths { line, casing }, onReady(), onFail(kind), onMove() */
  function viewer(box, o) {
    o = o || {};
    if (!box || !o.cam || !usable()) return null;
    var st = { map: null, dead: false, ready: false, cam: o.cam };
    var fail = function (kind) {
      if (st.dead) return;
      _n.failed++;
      if (kind === 'engine') { _down = 'engine'; api.destroy(); }
      try { if (o.onFail) o.onFail(kind); } catch (_) {}
    };
    var api = {
      zoomBy: function (d) { try { if (st.map) st.map.zoomTo(st.map.getZoom() + d, { duration: 220 }); } catch (_) {} },
      panBy: function (dx, dy) { try { if (st.map) st.map.panBy([dx, dy], { duration: 160 }); } catch (_) {} },
      fit: function (cam) { if (cam) st.cam = cam; try { if (st.map) st.map.easeTo({ center: [st.cam.lon, st.cam.lat], zoom: st.cam.zoom, duration: 320 }); } catch (_) {} },
      limits: function (minZ, maxZ) { try { if (st.map) { st.map.setMinZoom(minZ); st.map.setMaxZoom(maxZ); } } catch (_) {} },
      resize: function () { try { if (st.map) st.map.resize(); } catch (_) {} },
      state: function () {
        try { if (!st.map) return null; var c = st.map.getCenter(); return { lon: c.lng, lat: c.lat, zoom: st.map.getZoom(), ready: st.ready, moving: st.map.isMoving() }; } catch (_) { return null; }
      },
      /* Bildschirmpunkt eines Ortes — fuer Tests und Ausrichtung */
      project: function (lat, lon) { try { var p = st.map.project([lon, lat]); return [p.x, p.y]; } catch (_) { return null; } },
      jump: function (cam) { try { st.map.jumpTo({ center: [cam.lon, cam.lat], zoom: cam.zoom }); } catch (_) {} },
      destroy: function () { if (st.dead) return; st.dead = true; try { if (st.map) st.map.remove(); } catch (_) {} st.map = null; }
    };
    load().then(function (ml) {
      if (st.dead) return;
      try {
        var reduce = false; try { reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
        st.map = new ml.Map(options(box, o.cam, { interactive: true, keyboard: false, fadeDuration: reduce ? 0 : 120,
          minZoom: o.minZoom, maxZoom: o.maxZoom, trackResize: false, renderWorldCopies: true }));
        _n.viewers++;
        try { st.map.touchZoomRotate.disableRotation(); } catch (_) {}
        st.map.on('error', function (ev) { var k = classify(ev); if (k) fail(k); });
        if (o.onMove) st.map.on('move', function () { try { o.onMove(); } catch (_) {} });
        st.map.on('load', function () {
          if (st.dead) return;
          try {
            var C = o.colors || {}, W = o.widths || {}, pts = o.pts || [];
            var coords = pts.map(function (p) { return [p[1], p[0]]; });
            st.map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }, tolerance: 0.2 });
            st.map.addSource('route-ends', { type: 'geojson', data: { type: 'FeatureCollection', features: [
              { type: 'Feature', properties: { k: 's' }, geometry: { type: 'Point', coordinates: coords[0] } },
              { type: 'Feature', properties: { k: 'e' }, geometry: { type: 'Point', coordinates: coords[coords.length - 1] } }] } });
            var lay = { 'line-cap': 'round', 'line-join': 'round' };
            st.map.addLayer({ id: 'route-case', type: 'line', source: 'route', layout: lay, paint: { 'line-color': '#000000', 'line-opacity': 0.62, 'line-width': W.casing || 8 } });
            st.map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: lay, paint: { 'line-color': C.line || '#D8BB7A', 'line-width': W.line || 5 } });
            /* Start = offener Ring, Ziel = gefuellter Punkt (wie im Standbild; Masse so, dass der aeussere Rand gleich ist) */
            st.map.addLayer({ id: 'route-start', type: 'circle', source: 'route-ends', filter: ['==', ['get', 'k'], 's'],
              paint: { 'circle-radius': 5.5, 'circle-color': C.base || '#050910', 'circle-stroke-color': C.start || '#43D69E', 'circle-stroke-width': 3 } });
            st.map.addLayer({ id: 'route-end', type: 'circle', source: 'route-ends', filter: ['==', ['get', 'k'], 'e'],
              paint: { 'circle-radius': 4, 'circle-color': C.finish || '#FF6464', 'circle-stroke-color': C.base || '#050910', 'circle-stroke-width': 2 } });
          } catch (err) { fail('engine'); return; }
          st.ready = true;
          try { if (o.onReady) o.onReady(); } catch (_) {}
        });
      } catch (err) { fail('engine'); }
    }, function () { fail('tiles'); });
    return api;
  }

  O.routeMapGL = { VERSION: VERSION, cfg: cfg, supported: supported, usable: usable, camera: camera, cameraAt: cameraAt,
    load: load, attach: attach, viewer: viewer, sweep: sweep,
    down: function () { return _down; },
    stats: function () { return { created: _n.created, reused: _n.reused, removed: _n.removed, failed: _n.failed, viewers: _n.viewers, held: _order.length, down: _down }; },
    /* nur fuer Tests */
    _reset: function () { Object.keys(_static).forEach(function (k) { drop(k, 'reset'); }); _down = null; _webgl = null; _libP = null; },
    _maps: function () { return _order.map(function (k) { return _static[k] && _static[k].map; }).filter(Boolean); } };
  if (typeof module !== 'undefined' && module.exports) module.exports = O.routeMapGL;
})(typeof window !== 'undefined' ? window : globalThis);
