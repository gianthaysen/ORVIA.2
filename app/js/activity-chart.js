/* ============================================================
   ORVIA · activity-chart (v8-456) — gemeinsames Messreihen-Diagramm der Aktivitaetsseite (SVG, auf dem Geraet gezeichnet)

   Zeichnet GENAU die uebergebenen Messpunkte: keine Glaettung, keine Interpolation ueber Luecken, keine erfundenen Werte.
     - Luecke = Wert null ODER Zeitsprung > max(3 × Median-Abstand, 60 s) → die Linie bricht ab.
     - Markierte Punkte (spec.marks[i]) gehoeren NICHT zur Linie, bleiben aber sichtbar und auswaehlbar:
         'stop'  Stillstand (z. B. Geschwindigkeit 0) — kleiner Strich am Grund
         'flag'  moeglicherweise ungenau — hohler Ring in Warnfarbe
         'excl'  ausgeschlossen (z. B. schneller als Weltrekord) — Kreuz
         'out'   ausserhalb des dargestellten Bereichs (nur Tempo: robuste Achse 2.–98. Perzentil) — Dreieck am Rand
     - x = Sekunden seit Start (Gesamtzeit) oder Position (Bahn n). spec.compress: Abschnitte ohne Messwerte werden auf eine
       schmale Markierung verkuerzt („aktive Zeit"); Teilstriche zeigen dann die Zeit ohne diese Abschnitte. Nie gemischt.
   Auswahl: KEIN schwebender Hinweis im Diagramm — Markierung + Fuehrungslinie; der Wert geht an spec.onSelect und steht in
   einer festen Zeile ueber dem Diagramm (Aufrufer). Zeiger/Touch (horizontal waehlen, vertikal scrollt), Tastatur (← → Pos1 Ende,
   Umschalt = 10 Punkte). Gruppe: mehrere Diagramme derselben Messpunkte teilen die Auswahl (Vergleich untereinander).
   Keine Texte im Modul: Beschriftungen kommen vom Aufrufer (t()-Regime).
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};
  var VERSION = 'activity-chart@2';
  var NS = 'http://www.w3.org/2000/svg';
  var uid = 0;

  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function clock(sec) {
    if (sec === null || !isFinite(sec)) return '—';
    var t = Math.round(sec), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') : m + ':' + String(s).padStart(2, '0');
  }
  function niceStep(span, target) {
    var raw = span / Math.max(1, target), p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function paceStep(span, target) {
    var c = [5, 10, 15, 20, 30, 60, 120, 300], raw = span / Math.max(1, target);
    for (var i = 0; i < c.length; i++) if (c[i] >= raw) return c[i];
    return c[c.length - 1];
  }
  var TIME_STEPS = [30, 60, 120, 300, 600, 900, 1200, 1800, 3600, 5400, 7200, 10800];
  function timeStep(span, target) { var raw = span / Math.max(1, target); for (var i = 0; i < TIME_STEPS.length; i++) if (TIME_STEPS[i] >= raw) return TIME_STEPS[i]; return 14400; }
  function pct(sorted, q) { if (!sorted.length) return null; var i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1)))); return sorted[i]; }

  /* Reine Geometrie (testbar ohne DOM) */
  function model(spec, w, h) {
    var pad = { l: spec.padL != null ? spec.padL : 46, r: 14, t: 14, b: 28 };
    var vals = spec.values || [], xs = spec.x && spec.x.length === vals.length ? spec.x : null, marks = spec.marks && spec.marks.length === vals.length ? spec.marks : null;
    var pts = [];
    for (var i = 0; i < vals.length; i++) { var v = num(vals[i]); pts.push({ i: i, x: xs ? num(xs[i]) : i, v: v, mark: marks ? (marks[i] || null) : null }); }
    /* Stillstand ohne Wert (Tempo gibt es im Stehen nicht) bleibt als Punkt am Grund sichtbar und auswaehlbar */
    var have = pts.filter(function (p) { return p.x !== null && (p.v !== null || p.mark === 'stop'); });
    var lineable = have.filter(function (p) { return !p.mark && p.v !== null; });
    if (lineable.length < 2) return null;
    /* Wertebereich: aus den Linienpunkten; Tempo robust (2.–98. Perzentil, Gehpausen sprengen sonst die Achse) */
    var lv = lineable.map(function (p) { return p.v; }).sort(function (a, b) { return a - b; });
    var lo = lv[0], hi = lv[lv.length - 1];
    if (spec.pace && lv.length >= 20) { var p2 = pct(lv, 0.02), p98 = pct(lv, 0.98), sp = (p98 - p2) || 1; lo = Math.max(lo, p2 - sp * 0.15); hi = Math.min(hi, p98 + sp * 0.15); }
    if (spec.zeroBased && lo > 0) lo = 0;
    if (hi === lo) { hi += 1; lo -= 1; }
    var step = spec.pace ? paceStep(hi - lo, 3) : niceStep(hi - lo, 3);
    var y0 = Math.floor(lo / step) * step, y1 = Math.ceil(hi / step) * step;
    if (spec.zeroBased && lo >= 0) y0 = Math.max(0, y0);
    /* Punkte ausserhalb (nur robuste Tempoachse) */
    have.forEach(function (p) { if (!p.mark && p.v !== null && (p.v < y0 || p.v > y1)) p.mark = 'out'; });
    /* Luecken */
    var gaps = [], prevX = null, dxs = [];
    have.forEach(function (p) { if (prevX !== null) dxs.push(p.x - prevX); prevX = p.x; });
    var gs = dxs.slice().sort(function (a, b) { return a - b; }), med = gs.length ? gs[Math.floor(gs.length / 2)] : 1;
    var gapLimit = xs ? Math.max(med * 3, 60) : 1.5;
    /* Zeitachse ohne Abschnitte ohne Messwerte: jede Luecke schrumpft auf einen Median-Abstand */
    var shift = 0; prevX = null;
    have.forEach(function (p) {
      if (prevX !== null && xs && p.x - prevX > gapLimit) { var g = { from: prevX, to: p.x, dur: p.x - prevX }; if (spec.compress) { shift += g.dur - med; } g.at = p.x - shift; g.atFrom = prevX - (spec.compress ? shift - (g.dur - med) : 0); gaps.push(g); }
      p.xa = p.x - (spec.compress ? shift : 0); prevX = p.x;
    });
    pts.forEach(function (p) { if (p.xa === undefined) p.xa = p.x; });
    var x0 = have[0].xa, x1 = have[have.length - 1].xa; if (x1 === x0) x1 = x0 + 1;
    var iw = Math.max(10, w - pad.l - pad.r), ih = Math.max(10, h - pad.t - pad.b);
    var X = function (x) { return pad.l + (x - x0) / (x1 - x0) * iw; };
    var Y = function (v) { var r = (v - y0) / (y1 - y0); return spec.pace ? pad.t + r * ih : pad.t + (1 - r) * ih; };
    var segs = [], cur = [], last = null;
    pts.forEach(function (p) {
      if (p.v === null || p.x === null || p.mark) { if (cur.length) segs.push(cur); cur = []; last = null; return; }
      if (last && p.x - last.x > gapLimit) { if (cur.length) segs.push(cur); cur = []; }
      cur.push(p); last = p;
    });
    if (cur.length) segs.push(cur);
    var ticksY = []; for (var t = y0; t <= y1 + step * 1e-6; t += step) ticksY.push(Math.round(t * 1000) / 1000);
    var ticksX = [];
    if (xs) { var ts = timeStep(x1 - x0, w < 420 ? 4 : 8); for (var tx = Math.ceil(x0 / ts) * ts; tx <= x1; tx += ts) ticksX.push(tx); }
    else { var cs = niceStep(x1 - x0, w < 420 ? 4 : 8); cs = Math.max(1, Math.round(cs)); for (var cx = Math.ceil(x0 / cs) * cs; cx <= x1; cx += cs) ticksX.push(cx); }
    return { pad: pad, w: w, h: h, iw: iw, ih: ih, X: X, Y: Y, y0: y0, y1: y1, x0: x0, x1: x1, segs: segs, pts: pts, have: have, ticksY: ticksY, ticksX: ticksX, gapLimit: gapLimit,
             gaps: gaps, gapTotal: gaps.reduce(function (s, g) { return s + g.dur; }, 0), med: med, timeAxis: !!xs, compressed: !!(spec.compress && gaps.length) };
  }
  function pathOf(m, seg) { return seg.map(function (p, j) { return (j ? 'L' : 'M') + m.X(p.xa).toFixed(1) + ' ' + m.Y(p.v).toFixed(1); }).join(''); }
  function areaOf(m, seg, spec) {
    if (seg.length < 2) return '';
    var base = spec.pace ? m.pad.t + m.ih : m.Y(m.y0);
    return pathOf(m, seg) + 'L' + m.X(seg[seg.length - 1].xa).toFixed(1) + ' ' + base.toFixed(1) + 'L' + m.X(seg[0].xa).toFixed(1) + ' ' + base.toFixed(1) + 'Z';
  }
  /* Bildschirmposition eines Punkts (markierte Punkte am Grund bzw. am Rand) */
  function yOf(m, p) {
    if (p.mark === 'stop') return m.pad.t + m.ih - 3;
    if (p.mark === 'out') return p.v < m.y0 ? (m.Y(m.y0)) : m.Y(m.y1);
    return m.Y(Math.max(Math.min(p.v, Math.max(m.y0, m.y1)), Math.min(m.y0, m.y1)));
  }
  function nearest(m, px) {
    var best = null, bd = Infinity;
    m.have.forEach(function (p) { var d = Math.abs(m.X(p.xa) - px); if (d < bd) { bd = d; best = p; } });
    return best;
  }
  function el(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]); return e; }

  /* Gruppe: Diagramme mit DENSELBEN Messpunkten (gleicher Index = gleicher Zeitpunkt) teilen die Auswahl */
  function group() {
    var charts = [];
    return {
      add: function (c) { charts.push(c); },
      select: function (src, i) { charts.forEach(function (c) { if (c !== src) c.selectIndex(i, true); }); },
      clear: function (src) { charts.forEach(function (c) { if (c !== src) c.clear(true); }); },
      charts: charts
    };
  }

  /* spec: { values, x | null, marks, compress, xLabel(xa, p), fmt(v), pace, zeroBased, mean, area, dots, ariaLabel, group, height,
            onSelect(sel|null)  sel = { i, x, xa, v, mark } } */
  function mount(host, spec) {
    if (!host || !spec) return null;
    var id = 'aac' + (++uid);
    host.innerHTML = '';
    host.classList.add('aac');
    var wrap = document.createElement('div'); wrap.className = 'aac-wrap';
    host.appendChild(wrap);
    host.setAttribute('tabindex', '0'); host.setAttribute('role', 'group');
    if (spec.ariaLabel) host.setAttribute('aria-label', spec.ariaLabel);
    var fmtX = spec.xLabel || (spec.x ? function (xa) { return clock(xa); } : function (x) { return String(Math.round(x) + 1); });
    var fmtV = spec.fmt || function (v) { return String(Math.round(v)); };
    var m = null, cur = null, cross = null, dot = null, api;

    function draw() {
      var w = Math.round(host.clientWidth || 320), h = Math.round(spec.height || host.clientHeight || 220);
      m = model(spec, w, h); wrap.innerHTML = '';
      if (!m) return;
      var svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, width: w, height: h, class: 'aac-svg', 'aria-hidden': 'true', focusable: 'false' });
      var defs = el('defs', {}), lg = el('linearGradient', { id: id + 'g', x1: 0, y1: 0, x2: 0, y2: 1 });
      lg.appendChild(el('stop', { offset: '0%', class: 'aac-g0' })); lg.appendChild(el('stop', { offset: '100%', class: 'aac-g1' })); defs.appendChild(lg); svg.appendChild(defs);
      var gy = el('g', { class: 'aac-grid' });
      m.ticksY.forEach(function (t) {
        var y = m.Y(t); gy.appendChild(el('line', { x1: m.pad.l, x2: w - m.pad.r, y1: y.toFixed(1), y2: y.toFixed(1) }));
        var tx = el('text', { x: m.pad.l - 8, y: (y + 3.5).toFixed(1), 'text-anchor': 'end', class: 'aac-ty' }); tx.textContent = fmtV(t); gy.appendChild(tx);
      });
      m.ticksX.forEach(function (t) {
        var x = m.X(t); if (x < m.pad.l - 1 || x > w - m.pad.r + 1) return;
        var tx = el('text', { x: x.toFixed(1), y: h - 8, 'text-anchor': 'middle', class: 'aac-tx' }); tx.textContent = fmtX(t, null); gy.appendChild(tx);
      });
      svg.appendChild(gy);
      /* Abschnitte ohne Messwerte: gestrichelte Markierung (verkuerzte Achse) bzw. ruhige Flaeche (Gesamtzeit) */
      var gg = el('g', { class: 'aac-gaps' });
      m.gaps.forEach(function (g) {
        if (m.compressed) { var gx = m.X(g.at - m.med / 2); gg.appendChild(el('line', { x1: gx.toFixed(1), x2: gx.toFixed(1), y1: m.pad.t, y2: m.pad.t + m.ih, class: 'aac-gapline' })); }
        else { var a = m.X(g.from), b = m.X(g.to); gg.appendChild(el('rect', { x: a.toFixed(1), y: m.pad.t, width: Math.max(1, b - a).toFixed(1), height: m.ih, class: 'aac-gaprect' })); }
      });
      svg.appendChild(gg);
      var ga = el('g', { class: 'aac-data' });
      if (spec.area !== false) m.segs.forEach(function (sg) { var d = areaOf(m, sg, spec); if (d) ga.appendChild(el('path', { d: d, fill: 'url(#' + id + 'g)', class: 'aac-area' })); });
      m.segs.forEach(function (sg) {
        if (sg.length === 1) ga.appendChild(el('circle', { cx: m.X(sg[0].xa).toFixed(1), cy: m.Y(sg[0].v).toFixed(1), r: 1.6, class: 'aac-pt' }));
        else ga.appendChild(el('path', { d: pathOf(m, sg), class: 'aac-line', fill: 'none' }));
      });
      if (spec.dots) m.have.forEach(function (p) { if (!p.mark) ga.appendChild(el('circle', { cx: m.X(p.xa).toFixed(1), cy: m.Y(p.v).toFixed(1), r: 2.2, class: 'aac-pt' })); });
      /* markierte Punkte — sichtbar, nie Teil der Linie */
      m.have.forEach(function (p) {
        if (!p.mark) return; var x = m.X(p.xa), y = yOf(m, p);
        if (p.mark === 'stop') ga.appendChild(el('line', { x1: x.toFixed(1), x2: x.toFixed(1), y1: (y - 4).toFixed(1), y2: (y + 2).toFixed(1), class: 'aac-mk-stop' }));
        else if (p.mark === 'flag') ga.appendChild(el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 3.2, class: 'aac-mk-flag' }));
        else if (p.mark === 'excl') ga.appendChild(el('path', { d: 'M' + (x - 3) + ' ' + (y - 3) + 'L' + (x + 3) + ' ' + (y + 3) + 'M' + (x + 3) + ' ' + (y - 3) + 'L' + (x - 3) + ' ' + (y + 3), class: 'aac-mk-excl' }));
        else if (p.mark === 'out') { var up = (spec.pace ? p.v < m.y0 : p.v > m.y1); ga.appendChild(el('path', { d: up ? 'M' + (x - 3) + ' ' + (y + 4) + 'L' + x + ' ' + (y - 1) + 'L' + (x + 3) + ' ' + (y + 4) + 'Z' : 'M' + (x - 3) + ' ' + (y - 4) + 'L' + x + ' ' + (y + 1) + 'L' + (x + 3) + ' ' + (y - 4) + 'Z', class: 'aac-mk-out' })); }
      });
      if (num(spec.mean) !== null && spec.mean >= Math.min(m.y0, m.y1) && spec.mean <= Math.max(m.y0, m.y1)) {
        var my = m.Y(spec.mean);
        ga.appendChild(el('line', { x1: m.pad.l, x2: w - m.pad.r, y1: my.toFixed(1), y2: my.toFixed(1), class: 'aac-mean' }));
      }
      svg.appendChild(ga);
      cross = el('line', { x1: 0, x2: 0, y1: m.pad.t, y2: m.pad.t + m.ih, class: 'aac-cross', visibility: 'hidden' });
      dot = el('circle', { cx: 0, cy: 0, r: 4.5, class: 'aac-dot', visibility: 'hidden' });
      svg.appendChild(cross); svg.appendChild(dot);
      wrap.appendChild(svg);
      if (cur) showPoint(m.have.filter(function (p) { return p.i === cur.i; })[0] || null, true);
    }
    function showPoint(p, silent) {
      if (!m || !p) return;
      cur = p;
      var x = m.X(p.xa), y = yOf(m, p);
      cross.setAttribute('x1', x.toFixed(1)); cross.setAttribute('x2', x.toFixed(1)); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', y.toFixed(1)); dot.setAttribute('visibility', 'visible');
      dot.setAttribute('class', 'aac-dot' + (p.mark ? ' is-' + p.mark : ''));
      if (spec.onSelect) spec.onSelect({ i: p.i, x: p.x, xa: p.xa, v: p.v, mark: p.mark, fromGroup: !!silent });
    }
    function clear(fromGroup) {
      cur = null; if (cross) { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); }
      if (spec.onSelect && !fromGroup) spec.onSelect(null);
      if (!fromGroup && spec.group) spec.group.clear(api);
    }
    function pick(p) { if (!p) return; showPoint(p); if (spec.group) spec.group.select(api, p.i); }
    function onMove(ev) { if (!m) return; var r = host.getBoundingClientRect(); pick(nearest(m, ev.clientX - r.left)); }
    /* Touch: nur bei gedruecktem Finger waehlen (sonst scrollt die Seite); Maus/Stift folgen dem Zeiger */
    host.addEventListener('pointermove', function (ev) { if (ev.pointerType !== 'touch' || ev.buttons || ev.pressure > 0) onMove(ev); });
    host.addEventListener('pointerdown', onMove);
    host.addEventListener('keydown', function (ev) {
      if (!m) return; var k = ev.key, list = m.have, i = cur ? list.indexOf(list.filter(function (p) { return p.i === cur.i; })[0]) : -1;
      if (k === 'ArrowRight' || k === 'ArrowLeft') { i = i < 0 ? 0 : Math.max(0, Math.min(list.length - 1, i + (k === 'ArrowRight' ? 1 : -1) * (ev.shiftKey ? 10 : 1))); }
      else if (k === 'Home') i = 0; else if (k === 'End') i = list.length - 1;
      else if (k === 'Escape') { clear(); return; } else return;
      ev.preventDefault(); pick(list[i]);
    });
    api = {
      redraw: draw, clear: clear,
      selectIndex: function (i, fromGroup) { if (!m) return; var p = m.have.filter(function (q) { return q.i === i; })[0]; if (!p) { var best = null, bd = Infinity; m.have.forEach(function (q) { var d = Math.abs(q.i - i); if (d < bd) { bd = d; best = q; } }); p = best; } if (p) showPoint(p, fromGroup); },
      model: function () { return m; }, current: function () { return cur; }
    };
    draw();
    if (spec.group) spec.group.add(api);
    /* Breite aendert sich (Drehen, Desktop-Fenster) → neu zeichnen, nicht skalieren */
    try {
      if (typeof ResizeObserver === 'function') {
        var lastW = host.clientWidth, tmr = null;
        var ro = new ResizeObserver(function () { if (Math.abs(host.clientWidth - lastW) < 2) return; lastW = host.clientWidth; clearTimeout(tmr); tmr = setTimeout(draw, 60); });
        ro.observe(host); api.disconnect = function () { ro.disconnect(); };
      }
    } catch (e) { }
    return api;
  }

  var apiRoot = { VERSION: VERSION, mount: mount, group: group, model: model, clock: clock, niceStep: niceStep };
  if (typeof module !== 'undefined' && module.exports) module.exports = apiRoot;
  root.ORVIA.activityChart = apiRoot;
})(typeof globalThis !== 'undefined' ? globalThis : this);
