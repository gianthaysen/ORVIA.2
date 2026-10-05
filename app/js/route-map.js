/* ============================================================
   ORVIA · route-map — echte Karte hinter der GPS-Strecke (v8-432)
   ------------------------------------------------------------
   Gians Auftrag 5.10.: Die Strecke soll nicht mehr als Linie im Nichts schweben —
   darunter gehoert eine echte, extrem zurueckgenommene dunkle Karte.

   Bewusst KEINE Kartenbibliothek (MapLibre GL waeren ~800 KB + WebGL fuer ein Bild,
   das sich nie bewegt): Die Karte ist ein STANDBILD aus fertigen Rasterkacheln
   (512er-Kacheln im ueblichen z/x/y-Schema, doppelte Aufloesung), die hier selbst zum Ausschnitt gelegt
   werden; die Strecke liegt als eigenes SVG in derselben Projektion (Web-Mercator)
   darueber. Damit: kein Zoom, keine Bedienelemente, pixelgenau zur Seite passend,
   Kachelbilder liegen danach im Browser-Cache.

   Quelle der Kacheln: steht ALLEIN in map-config.js (ORVIA_MAP_CONFIG) — Anbieter,
   Schluessel, Adressvorlagen, Logo, Quellenhinweis. Dieses Modul kennt keinen Anbieter
   und keine Anbieter-Adresse (v8-434); es setzt nur {style} {key} {z} {x} {y} {r} ein. Ohne
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
  var VERSION = 'route-map@5';
  var BASE = 256;                 /* Bezugsraster der Zoomstufe Z (Welt = 256 · 2^Z CSS-px) */
  var MAX_Z = 16.6, MIN_Z = 3;    /* nie bis auf Hausnummern hinein, nie die halbe Welt */
  /* v8-433 — Anfragen sparen (abgerechnet wird je Kachel):
     · 512er-Kacheln statt 256er: eine Anfrage deckt die vierfache Flaeche.
     · Kachelstufe eher eine Stufe NIEDRIGER waehlen und das Bild etwas strecken
       (Streckung 0,78…1,57 statt 0,71…1,41): auf dem Handy reichen damit
       typisch 4, hoechstens 6 Kacheln fuer die Story-Karte.
     · Geladene Kachelbilder bleiben fuer die Sitzung im Speicher und werden beim
       naechsten Aufbau wieder eingesetzt (hydrate) — die Story setzt ihr Markup bei
       JEDEM Seitenwechsel neu; ohne das wuerde jede Kachel mehrfach angefragt. */
  var Z_BIAS = 0.35;
  var KEEP_MAX = 96;

  function cfg() {
    var c = root.ORVIA_MAP_CONFIG || {};
    var key = String(c.key || '').trim();
    var ts = (+c.tileSize === 256) ? 256 : 512;
    /* Adressvorlagen kommen NUR aus der Einstellung: tiles[512] / tiles[256] je Kachelgroesse,
       oder url als eine Vorlage fuer alles. Fehlt die Vorlage der gewuenschten Groesse, gilt
       die vorhandene andere; fehlt jede, bleibt die Karte aus. */
    var tl = c.tiles || {};
    if (!c.url && !tl[ts] && tl[ts === 512 ? 256 : 512]) ts = (ts === 512) ? 256 : 512;
    var url = c.url ? String(c.url) : (tl[ts] ? String(tl[ts]) : null);
    var needKey = !!url && url.indexOf('{key}') >= 0;
    return {
      provider: c.provider || null, key: key, style: String(c.style || ''), url: url, tileSize: ts,
      /* Wo die Karte erscheint: Story ja; Aktivitaetsseite erst, wenn die Optik abgestimmt ist. */
      story: c.story !== false, detail: c.detail === true,
      /* an nur mit Vorlage — und mit Schluessel, wenn die Vorlage einen verlangt */
      enabled: c.enabled !== false && !!url && (!needKey || !!key),
      attribution: c.attribution ? String(c.attribution) : '© OpenStreetMap contributors',
      logo: c.logo ? String(c.logo) : null
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
  function fit(route, w, h, pad, tileSize) {
    var pts = valid(route);
    if (pts.length < 2 || !(w > 0) || !(h > 0)) return null;
    pad = pad || {};
    var pT = +pad.t || 0, pR = +pad.r || 0, pB = +pad.b || 0, pL = +pad.l || 0;
    var aw = Math.max(40, w - pL - pR), ah = Math.max(40, h - pT - pB);
    var x0 = 1, x1 = 0, y0 = 1, y1 = 0;
    pts.forEach(function (p) { var x = lonX(p[1]), y = latY(p[0]); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
    var sx = x1 - x0, sy = y1 - y0;
    var Z = Math.log(Math.min(sx > 0 ? aw / (sx * BASE) : Infinity, sy > 0 ? ah / (sy * BASE) : Infinity)) / Math.LN2;
    if (!isFinite(Z)) Z = MAX_Z;
    Z = Math.max(MIN_Z, Math.min(MAX_Z, Z));
    var T = (+tileSize === 256) ? 256 : (tileSize ? 512 : cfg().tileSize);
    var lv = level(Z, T);
    var world = BASE * Math.pow(2, Z);
    var cx = (x0 + x1) / 2 * world, cy = (y0 + y1) / 2 * world;
    return { w: w, h: h, Z: Z, z: lv.z, tile: T, scale: lv.scale, world: world,
      ox: cx - (pL + aw / 2), oy: cy - (pT + ah / 2), pad: { t: pT, r: pR, b: pB, l: pL } };
  }
  /* level(Z,T) → Kachelstufe z und Streckung fuer die stufenlose Zoomstufe Z (EINE Stelle:
     Standbild und Kartenansicht waehlen dieselbe Stufe und teilen sich so die Kacheln). */
  function level(Z, T) {
    var Zt = Z - Math.log(T / BASE) / Math.LN2;            /* Zoomstufe im Raster der Kachelgroesse */
    var z = Math.max(0, Math.min(18, Math.floor(Zt + Z_BIAS)));
    return { z: z, scale: Math.pow(2, Zt - z) };
  }
  /* viewAt(cx,cy,Z,w,h) → derselbe Ausschnitt wie fit(), aber aus Mittelpunkt (Mercator 0…1)
     und Zoomstufe — fuer die Kartenansicht zum Umsehen (route-map-view.js). */
  function viewAt(cx, cy, Z, w, h, tileSize) {
    if (!(w > 0) || !(h > 0) || !isFinite(cx) || !isFinite(cy) || !isFinite(Z)) return null;
    var T = (+tileSize === 256) ? 256 : (tileSize ? 512 : cfg().tileSize);
    var lv = level(Z, T), world = BASE * Math.pow(2, Z);
    return { w: w, h: h, Z: Z, z: lv.z, tile: T, scale: lv.scale, world: world,
      ox: cx * world - w / 2, oy: cy * world - h / 2, pad: { t: 0, r: 0, b: 0, l: 0 } };
  }
  function project(lat, lon, v) { return [lonX(lon) * v.world - v.ox, latY(lat) * v.world - v.oy]; }
  /* tiles(view) → alle Kacheln, die den Ausschnitt lueckenlos decken. Kanten ganzzahlig
     gerundet und von Nachbarn geteilt — sonst blitzen zwischen gestreckten Bildern Fugen. */
  function tiles(v) {
    if (!v) return [];
    var ts = v.tile * v.scale, n = Math.pow(2, v.z), out = [];
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
    if (!c.url) return '';
    return c.url.replace('{style}', encodeURIComponent(c.style)).replace('{key}', encodeURIComponent(c.key))
      .replace('{z}', t.z).replace('{x}', t.x).replace('{y}', t.y).replace('{r}', '@2x');
  }
  /* ---- Darstellung der Strecke (v8-437) ----
     Gian 5.10.: „bei Runna ist alles deutlich smoother". Die Aufzeichnung zittert um wenige
     Meter (GPS); gezeichnet sah man jede Zacke. Fuer die ANZEIGE wird deshalb
       1. geglaettet  (gewichtetes Mittel ueber je zwei Nachbarn davor/danach, nur wenn sie
                       hoechstens 25 m entfernt sind — echte Ecken und duenne Aufzeichnungen
                       bleiben stehen; Start und Ziel bleiben exakt),
       2. ausgeduennt (Punkte, die weniger als 0,7 m von der Linie abweichen, fallen weg —
                       weniger Arbeit beim Zeichnen und Verschieben),
       3. mit gerundeten Ecken gezeichnet (pathD: Radius hoechstens 6 m).
     Die gespeicherten GPS-Daten bleiben unberuehrt — hier entsteht nur eine Kopie.
     Was das NICHT kann: einen ganzen Abschnitt, den das GPS um 10 m daneben gelegt hat,
     auf die Strasse zurueckschieben (das waere Kartenabgleich ueber einen Routendienst). */
  var SMOOTH_W = [1, 2, 3, 2, 1], SMOOTH_MAX_M = 25, SIMPLIFY_M = 0.7, ROUND_M = 6;
  function smooth(pts) {
    var n = pts.length;
    if (n < 5) return pts.slice();
    var out = [pts[0]];
    for (var i = 1; i < n - 1; i++) {
      var sa = 0, so = 0, sw = 0;
      for (var k = -2; k <= 2; k++) {
        var j = i + k; if (j < 0 || j >= n) continue;
        if (k !== 0 && haversineM(pts[i], pts[j]) > SMOOTH_MAX_M) continue;
        var w = SMOOTH_W[k + 2]; sa += pts[j][0] * w; so += pts[j][1] * w; sw += w;
      }
      out.push(sw === SMOOTH_W[2] ? pts[i] : [sa / sw, so / sw]);   /* ohne nahen Nachbarn bleibt der Punkt, wie er ist */
    }
    out.push(pts[n - 1]);
    return out;
  }
  /* simplify: Douglas-Peucker in Metern (ohne Rekursion — lange Strecken) */
  function simplify(pts, tolM) {
    var n = pts.length, tol = (tolM == null) ? SIMPLIFY_M : +tolM;
    if (n < 3 || !(tol > 0)) return pts.slice();
    var k = Math.cos(pts[0][0] * Math.PI / 180), MX = 111320 * k, MY = 110540;
    var X = new Array(n), Y = new Array(n), keep = new Array(n), i;
    for (i = 0; i < n; i++) { X[i] = pts[i][1] * MX; Y[i] = pts[i][0] * MY; keep[i] = false; }
    keep[0] = keep[n - 1] = true;
    var stack = [[0, n - 1]];
    while (stack.length) {
      var seg = stack.pop(), a = seg[0], b = seg[1], dx = X[b] - X[a], dy = Y[b] - Y[a], len2 = dx * dx + dy * dy, best = -1, bi = -1;
      for (i = a + 1; i < b; i++) {
        var px = X[i] - X[a], py = Y[i] - Y[a], d2;
        if (len2 > 0) { var t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2)), ex = px - t * dx, ey = py - t * dy; d2 = ex * ex + ey * ey; }
        else d2 = px * px + py * py;
        if (d2 > best) { best = d2; bi = i; }
      }
      if (bi > 0 && best > tol * tol) { keep[bi] = true; stack.push([a, bi]); stack.push([bi, b]); }
    }
    var out = [];
    for (i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
    return out;
  }
  /* display(route) → die Strecke, wie sie gezeichnet wird (Kopie; Rohdaten bleiben) */
  function display(route) { return simplify(smooth(valid(route))); }
  /* pathD(pts, view, opts) — opts.round: Eckenradius in Metern (0/ohne = Kanten), opts.digits */
  function pathD(pts, v, opts) {
    opts = opts || {};
    var n = pts.length, dg = opts.digits == null ? 1 : opts.digits, P = new Array(n), i;
    for (i = 0; i < n; i++) P[i] = project(pts[i][0], pts[i][1], v);
    var f = function (p) { return p[0].toFixed(dg) + ',' + p[1].toFixed(dg); };
    if (!n) return '';
    var d = 'M' + f(P[0]);
    var R = 0;
    if (opts.round > 0 && n > 2) R = opts.round * v.world / (40075016.686 * Math.cos(pts[0][0] * Math.PI / 180));   /* Meter → px */
    for (i = 1; i < n; i++) {
      if (!(R > 0) || i === n - 1) { d += ' L' + f(P[i]); continue; }
      var a = P[i - 1], b = P[i], c = P[i + 1];
      var ax = a[0] - b[0], ay = a[1] - b[1], cx = c[0] - b[0], cy = c[1] - b[1];
      var la = Math.sqrt(ax * ax + ay * ay), lc = Math.sqrt(cx * cx + cy * cy);
      /* fast gerade weiter (Knick < ~6°) oder Punkte uebereinander ⇒ normale Kante */
      if (la < 0.01 || lc < 0.01 || (ax * cx + ay * cy) / (la * lc) < -0.9945) { d += ' L' + f(b); continue; }
      var ra = Math.min(R, la / 2), rc = Math.min(R, lc / 2);
      d += ' L' + f([b[0] + ax * ra / la, b[1] + ay * ra / la]) + ' Q' + f(b) + ' ' + f([b[0] + cx * rc / lc, b[1] + cy * rc / lc]);
    }
    return d;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  var _fails = 0, _downUntil = 0;
  var DOWN_MS = 5 * 60 * 1000;    /* nach einem Kachelfehler 5 min keine neuen Versuche (offline, Kontingent, Schluessel) */
  function _now() { return (typeof Date !== 'undefined') ? Date.now() : 0; }
  function _markFailed(box) {
    try {
      if (box && !box.classList.contains('tiles-failed')) {
        box.classList.remove('has-tiles'); box.classList.add('tiles-failed');
        /* Der Aufrufer kann darauf reagieren (Aktivitaetsseite stellt die alte Zeichnung wieder her). */
        if (typeof CustomEvent === 'function') box.dispatchEvent(new CustomEvent('orvia:rmx-failed', { bubbles: true }));
      }
    } catch (e) {}
  }
  /* Eine Kachel fehlt (offline, Kontingent, falscher Schluessel) ⇒ die ganze Kartenebene
     dieser Karte geht aus. Eine halbe Karte saehe kaputt aus; die Strecke allein nicht. */
  function _err(img) {
    _fails++; _downUntil = _now() + DOWN_MS;
    _markFailed(img && img.closest ? img.closest('.rmx') : null);
  }
  function _ok(img) { try { img.classList.add('ok'); } catch (e) {} }

  /* html(route, opts) → fertiges Markup (Text). opts: w,h (CSS-px, Pflicht), pad{t,r,b,l},
     cls, color, width, draw (Zeichen-Animation), tiles:false (Karte erzwungen aus),
     trimStartM/trimEndM. Rueckgabe '' bei unbrauchbarer Strecke. */
  function html(route, opts) {
    opts = opts || {};
    var pts = trim(route, { startM: opts.trimStartM, endM: opts.trimEndM });
    var w = Math.round(+opts.w || 0), h = Math.round(+opts.h || 0);
    var c = cfg(), useTiles = c.enabled && opts.tiles !== false;
    var v = fit(pts, w, h, opts.pad, c.tileSize);
    if (!v) return '';
    /* Ausschnitt aus den Rohpunkten (die geglaettete Linie liegt immer innerhalb), gezeichnet wird die Anzeige-Strecke */
    var d = pathD(simplify(smooth(pts)), v, { round: ROUND_M });
    var a = project(pts[0][0], pts[0][1], v), b = project(pts[pts.length - 1][0], pts[pts.length - 1][1], v);
    var col = opts.color ? esc(opts.color) : 'var(--acchi,var(--acc,#DCC79A))';
    var sw = +opts.width || 4;
    var tl = '';
    if (useTiles) {
      tl = '<div class="rmx-tiles">' + tiles(v).map(function (t) {
        /* KEIN src im Markup: erst hydrate() laedt — und nimmt Bilder, die in dieser Sitzung
           schon geladen wurden, aus dem Speicher statt sie erneut anzufragen. */
        return '<img class="rmx-t" alt="" draggable="false" decoding="async" referrerpolicy="strict-origin" data-rmx-src="' + esc(tileUrl(t, c)) + '" style="left:' + t.left + 'px;top:' + t.top + 'px;width:' + t.width + 'px;height:' + t.height + 'px">';
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
      (useTiles ? '<div class="rmx-attr">' + (c.logo ? '<img class="rmx-logo" alt="" referrerpolicy="strict-origin" data-rmx-src="' + esc(c.logo) + '">' : '') + '<span>' + esc(c.attribution) + '</span></div>' : '') +
      '</div>';
  }
  /* ---- Sitzungsspeicher fuer geladene Kachelbilder ---- */
  var _keep = {}, _keepOrder = [], _started = 0, _reused = 0;
  function _remember(url, img) {
    if (_keep[url]) return;
    _keep[url] = img; _keepOrder.push(url);
    while (_keepOrder.length > KEEP_MAX) delete _keep[_keepOrder.shift()];
  }
  /* hydrate(root) — laedt die Kacheln aller Karten unter root. Bereits geladene Bilder
     werden als DASSELBE Element wieder eingesetzt (kein Netz, kein Einblenden).
     Gibt { started, reused } zurueck. Ohne Aufruf bleibt die Karte leer und die Strecke
     steht allein — nie ein Fehler. */
  function hydrate(root) {
    var res = { started: 0, reused: 0 };
    try {
      if (!root || !root.querySelectorAll) return res;
      var list = root.querySelectorAll('img[data-rmx-src]');
      /* Anbieter gerade nicht erreichbar ⇒ gar nicht erst anfragen; Karte aus, Strecke bleibt. */
      if (_downUntil > _now()) {
        for (var d = 0; d < list.length; d++) if (list[d].closest && !list[d].classList.contains('rmx-logo')) _markFailed(list[d].closest('.rmx'));
        res.skipped = list.length; return res;
      }
      for (var i = 0; i < list.length; i++) {
        (function (ph) {
          var url = ph.getAttribute('data-rmx-src'); if (!url) return;
          var logo = ph.classList.contains('rmx-logo');
          var have = _keep[url];
          if (have && have !== ph && have.complete && have.naturalWidth > 0) {
            have.style.cssText = ph.style.cssText;
            if (ph.parentNode) ph.parentNode.replaceChild(have, ph);
            res.reused++; _reused++; return;
          }
          ph.removeAttribute('data-rmx-src');
          ph.onload = function () { if (!logo) _ok(ph); _remember(url, ph); };
          ph.onerror = function () { if (logo) ph.style.display = 'none'; else _err(ph); };
          ph.src = url; res.started++; _started++;
        })(list[i]);
      }
    } catch (e) {}
    return res;
  }

  /* mount(el, route, opts) — misst den Behaelter und setzt die Karte hinein (Aktivitaetsseite). */
  function mount(el, route, opts) {
    try {
      if (!el) return false;
      var o = {}; for (var k in (opts || {})) o[k] = opts[k];
      o.w = el.clientWidth; o.h = el.clientHeight;
      var m = html(route, o);
      if (!m) return false;
      el.innerHTML = m; hydrate(el); return true;
    } catch (e) { return false; }
  }

  O.routeMap = { VERSION: VERSION, cfg: cfg, enabled: function () { return cfg().enabled; },
    lonX: lonX, latY: latY, xLon: xLon, yLat: yLat, haversineM: haversineM,
    trim: trim, fit: fit, viewAt: viewAt, level: level, valid: valid, smooth: smooth, simplify: simplify, display: display, ROUND_M: ROUND_M,
    project: project, tiles: tiles, tileUrl: tileUrl, pathD: pathD,
    MAX_Z: MAX_Z, MIN_Z: MIN_Z, paused: function () { return _downUntil > _now(); },
    html: html, mount: mount, hydrate: hydrate, _err: _err, _ok: _ok,
    stats: function () { return { started: _started, reused: _reused, failed: _fails, kept: _keepOrder.length, pausedMs: Math.max(0, _downUntil - _now()) }; },
    _resume: function () { _downUntil = 0; },
    fails: function () { return _fails; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = O.routeMap;
})(typeof window !== 'undefined' ? window : globalThis);
