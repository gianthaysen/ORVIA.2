/* ============================================================
   ORVIA · route-map — echte Karte hinter der GPS-Strecke (v8-432)
   ------------------------------------------------------------
   Gians Auftrag 5.10.: Die Strecke soll nicht mehr als Linie im Nichts schweben —
   darunter gehoert eine echte, extrem zurueckgenommene dunkle Karte.

   Bewusst KEINE Kartenbibliothek (MapLibre GL waeren ~800 KB + WebGL fuer ein Bild,
   das sich nie bewegt): Die Karte ist ein STANDBILD aus fertigen Rasterkacheln
   (512-px-Bilder im ueblichen z/x/y-Schema), die hier selbst zum Ausschnitt gelegt
   werden; die Strecke liegt als eigenes SVG in derselben Projektion (Web-Mercator)
   darueber. Damit: kein Zoom, keine Bedienelemente, pixelgenau zur Seite passend,
   Kachelbilder liegen danach im Browser-Cache.

   Quelle der Kacheln: frei einstellbar (ORVIA_MAP_CONFIG in map-config.js). Ohne
   Schluessel gibt es KEINE Anfrage an irgendeinen Anbieter — dann zeichnet dieses Modul
   nur die Strecke (ruhiger Rueckfall). Scheitert eine Kachel, blendet sich die ganze
   Kartenebene aus; die Strecke bleibt.

   Datenschutz: Der Anbieter sieht bei eingeschalteter Karte die IP-Adresse des Geraets
   und, welche Kacheln (= welcher Ort) geladen werden. Mitgeschickt wird nur die
   Herkunft der Seite (referrerpolicy strict-origin), nie Konto- oder Aktivitaetsdaten.
   trim() kann Anfang/Ende der Strecke ausblenden (vorbereitet fuer geteilte Stories).

   Alles Rechnen ist rein und testbar (fit/project/tiles/trim); html() baut nur Text.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'route-map@1';
  var TILE = 256;                 /* Kachelkante in CSS-px bei scale 1 (Bild selbst 512 px = @2x) */
  var MAX_Z = 16.6, MIN_Z = 3;    /* nie bis auf Hausnummern hinein, nie die halbe Welt */

  function cfg() {
    var c = root.ORVIA_MAP_CONFIG || {};
    var key = String(c.key || '').trim();
    var provider = c.provider || 'maptiler';
    /* Eigene Kachelquelle: url mit {z} {x} {y} {r} — braucht dann keinen Schluessel. */
    var url = c.url ? String(c.url) : null;
    return {
      provider: provider, key: key, style: c.style || 'dataviz-dark', url: url,
      enabled: c.enabled !== false && (!!key || !!url),
      attribution: c.attribution || (provider === 'maptiler' && !url ? '© MapTiler © OpenStreetMap contributors' : '© OpenStreetMap contributors'),
      logo: (c.logo === undefined) ? (provider === 'maptiler' && !url ? 'https://api.maptiler.com/resources/logo.svg' : null) : c.logo
    };
  }

  /* ---- Web-Mercator, normiert auf 0…1 ---- */
  function lonX(lon) { return (lon + 180) / 360; }
  function latY(lat) {
    var s = Math.sin(Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  }
  function xLon(x) { return x * 360 - 180; }
  function yLat(y) { return Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI; }

  function valid(route) {
    if (!Array.isArray(route)) return [];
    var out = [];
    for (var i = 0; i < route.length; i++) {
      var p = route[i];
      if (p && isFinite(p[0]) && isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180) out.push([+p[0], +p[1]]);
    }
    return out;
  }
  function haversineM(a, b) {
    var R = 6371000, r = Math.PI / 180;
    var dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  /* trim(route,{startM,endM}) — blendet die ersten/letzten Meter aus (Wohnort-Schutz bei
     geteilten Strecken). Bleiben weniger als 2 Punkte, kommt die Strecke unveraendert
     zurueck (lieber alles als nichts — der Aufrufer entscheidet, ob er dann teilt). */
  function trim(route, o) {
    var pts = valid(route); o = o || {};
    var a = Math.max(0, +o.startM || 0), b = Math.max(0, +o.endM || 0);
    if ((!a && !b) || pts.length < 3) return pts;
    var cum = [0], i;
    for (i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversineM(pts[i - 1], pts[i]));
    var total = cum[cum.length - 1], out = [];
    for (i = 0; i < pts.length; i++) if (cum[i] >= a && cum[i] <= total - b) out.push(pts[i]);
    return out.length >= 2 ? out : pts;
  }

  /* fit(route,w,h,pad) → Ausschnitt, in dem die GANZE Strecke innerhalb des Innenrands liegt.
     Z ist die stufenlose Zoomstufe, z die Kachelstufe, scale = 2^(Z−z) streckt die Kacheln. */
  function fit(route, w, h, pad) {
    var pts = valid(route);
    if (pts.length < 2 || !(w > 0) || !(h > 0)) return null;
    pad = pad || {};
    var pT = +pad.t || 0, pR = +pad.r || 0, pB = +pad.b || 0, pL = +pad.l || 0;
    var aw = Math.max(40, w - pL - pR), ah = Math.max(40, h - pT - pB);
    var x0 = 1, x1 = 0, y0 = 1, y1 = 0;
    pts.forEach(function (p) { var x = lonX(p[1]), y = latY(p[0]); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
    var sx = x1 - x0, sy = y1 - y0;
    var Z = Math.log(Math.min(sx > 0 ? aw / (sx * TILE) : Infinity, sy > 0 ? ah / (sy * TILE) : Infinity)) / Math.LN2;
    if (!isFinite(Z)) Z = MAX_Z;
    Z = Math.max(MIN_Z, Math.min(MAX_Z, Z));
    var z = Math.max(1, Math.min(18, Math.round(Z)));
    var world = TILE * Math.pow(2, Z);
    var cx = (x0 + x1) / 2 * world, cy = (y0 + y1) / 2 * world;
    return { w: w, h: h, Z: Z, z: z, scale: Math.pow(2, Z - z), world: world,
      ox: cx - (pL + aw / 2), oy: cy - (pT + ah / 2), pad: { t: pT, r: pR, b: pB, l: pL } };
  }
  function project(lat, lon, v) { return [lonX(lon) * v.world - v.ox, latY(lat) * v.world - v.oy]; }
  /* tiles(view) → alle Kacheln, die den Ausschnitt lueckenlos decken. Kanten ganzzahlig
     gerundet und von Nachbarn geteilt — sonst blitzen zwischen gestreckten Bildern Fugen. */
  function tiles(v) {
    if (!v) return [];
    var ts = TILE * v.scale, n = Math.pow(2, v.z), out = [];
    var tx0 = Math.floor(v.ox / ts), tx1 = Math.floor((v.ox + v.w - 0.001) / ts);
    var ty0 = Math.floor(v.oy / ts), ty1 = Math.floor((v.oy + v.h - 0.001) / ts);
    for (var ty = ty0; ty <= ty1; ty++) {
      if (ty < 0 || ty >= n) continue;
      for (var tx = tx0; tx <= tx1; tx++) {
        var l = Math.round(tx * ts - v.ox), t = Math.round(ty * ts - v.oy);
        out.push({ z: v.z, x: ((tx % n) + n) % n, y: ty, left: l, top: t,
          width: Math.round((tx + 1) * ts - v.ox) - l, height: Math.round((ty + 1) * ts - v.oy) - t });
      }
    }
    return out;
  }
  function tileUrl(t, c) {
    c = c || cfg();
    if (c.url) return c.url.replace('{z}', t.z).replace('{x}', t.x).replace('{y}', t.y).replace('{r}', '@2x');
    return 'https://api.maptiler.com/maps/' + encodeURIComponent(c.style) + '/256/' + t.z + '/' + t.x + '/' + t.y + '@2x.png?key=' + encodeURIComponent(c.key);
  }
  function pathD(pts, v) {
    var d = '';
    for (var i = 0; i < pts.length; i++) { var p = project(pts[i][0], pts[i][1], v); d += (i ? ' L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); }
    return d;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  var _fails = 0;
  /* Eine Kachel fehlt (offline, Kontingent, falscher Schluessel) ⇒ die ganze Kartenebene
     dieser Karte geht aus. Eine halbe Karte saehe kaputt aus; die Strecke allein nicht. */
  function _err(img) {
    _fails++;
    try {
      var box = img && img.closest ? img.closest('.rmx') : null;
      if (box && !box.classList.contains('tiles-failed')) {
        box.classList.remove('has-tiles'); box.classList.add('tiles-failed');
        /* Der Aufrufer kann darauf reagieren (Aktivitaetsseite stellt die alte Zeichnung wieder her). */
        if (typeof CustomEvent === 'function') box.dispatchEvent(new CustomEvent('orvia:rmx-failed', { bubbles: true }));
      }
    } catch (e) {}
  }
  function _ok(img) { try { img.classList.add('ok'); } catch (e) {} }

  /* html(route, opts) → fertiges Markup (Text). opts: w,h (CSS-px, Pflicht), pad{t,r,b,l},
     cls, color, width, draw (Zeichen-Animation), tiles:false (Karte erzwungen aus),
     trimStartM/trimEndM. Rueckgabe '' bei unbrauchbarer Strecke. */
  function html(route, opts) {
    opts = opts || {};
    var pts = trim(route, { startM: opts.trimStartM, endM: opts.trimEndM });
    var w = Math.round(+opts.w || 0), h = Math.round(+opts.h || 0);
    var v = fit(pts, w, h, opts.pad);
    if (!v) return '';
    var c = cfg(), useTiles = c.enabled && opts.tiles !== false;
    var d = pathD(pts, v);
    var a = project(pts[0][0], pts[0][1], v), b = project(pts[pts.length - 1][0], pts[pts.length - 1][1], v);
    var col = opts.color ? esc(opts.color) : 'var(--acchi,var(--acc,#DCC79A))';
    var sw = +opts.width || 4;
    var tl = '';
    if (useTiles) {
      tl = '<div class="rmx-tiles">' + tiles(v).map(function (t) {
        return '<img class="rmx-t" alt="" draggable="false" decoding="async" referrerpolicy="strict-origin" src="' + esc(tileUrl(t, c)) + '" style="left:' + t.left + 'px;top:' + t.top + 'px;width:' + t.width + 'px;height:' + t.height + 'px" onload="ORVIA.routeMap._ok(this)" onerror="ORVIA.routeMap._err(this)">';
      }).join('') + '</div>';
    }
    var cx = function (p) { return p[0].toFixed(1); }, cy = function (p) { return p[1].toFixed(1); };
    return '<div class="rmx' + (useTiles ? ' has-tiles' : '') + (opts.cls ? ' ' + esc(opts.cls) : '') + '" style="width:' + w + 'px;height:' + h + 'px" data-z="' + v.z + '">' +
      tl +
      '<svg class="rmx-route" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true">' +
        /* dunkler Rand unter der Strecke — zeichnet sich MIT der Strecke (sonst stuende die
           ganze Form schon da, bevor die Linie sie abfaehrt) */
        '<path class="rmx-case' + (opts.draw ? ' gm-route-line' : '') + '"' + (opts.draw ? ' pathLength="1" style="--rl:1"' : '') + ' d="' + d + '" fill="none" stroke-width="' + (sw + 4) + '" stroke-linejoin="round" stroke-linecap="round"/>' +
        '<path class="rmx-line' + (opts.draw ? ' gm-route-line' : '') + '"' + (opts.draw ? ' pathLength="1" style="--rl:1"' : '') + ' d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + sw + '" stroke-linejoin="round" stroke-linecap="round"/>' +
        /* Start = offener Ring, Ziel = gefuellter Punkt: bei Rundkursen liegen beide
           uebereinander und bleiben trotzdem beide lesbar. */
        '<circle class="rmx-start" cx="' + cx(a) + '" cy="' + cy(a) + '" r="6.5"/>' +
        '<circle class="rmx-end" cx="' + cx(b) + '" cy="' + cy(b) + '" r="4.5"/>' +
      '</svg>' +
      (useTiles ? '<div class="rmx-attr">' + (c.logo ? '<img class="rmx-logo" alt="" referrerpolicy="strict-origin" src="' + esc(c.logo) + '" onerror="this.style.display=\'none\'">' : '') + '<span>' + esc(c.attribution) + '</span></div>' : '') +
      '</div>';
  }
  /* mount(el, route, opts) — misst den Behaelter und setzt die Karte hinein (Aktivitaetsseite). */
  function mount(el, route, opts) {
    try {
      if (!el) return false;
      var o = {}; for (var k in (opts || {})) o[k] = opts[k];
      o.w = el.clientWidth; o.h = el.clientHeight;
      var m = html(route, o);
      if (!m) return false;
      el.innerHTML = m; return true;
    } catch (e) { return false; }
  }

  O.routeMap = { VERSION: VERSION, cfg: cfg, enabled: function () { return cfg().enabled; },
    lonX: lonX, latY: latY, xLon: xLon, yLat: yLat, haversineM: haversineM,
    trim: trim, fit: fit, project: project, tiles: tiles, tileUrl: tileUrl, pathD: pathD,
    html: html, mount: mount, _err: _err, _ok: _ok, fails: function () { return _fails; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = O.routeMap;
})(typeof window !== 'undefined' ? window : globalThis);
