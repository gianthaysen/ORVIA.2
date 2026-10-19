/* ============================================================
   ORVIA · activity-chart (v8-454.1) — Leistungsdiagramm der Aktivitaetsseite (SVG, auf dem Geraet gezeichnet)

   Zeichnet GENAU die uebergebenen Messpunkte: keine Glaettung, keine Interpolation ueber Luecken, keine erfundenen Werte.
     - Luecke = Wert null ODER Zeitsprung > max(3 × Median-Abstand, 60 s) → die Linie bricht ab (Pause, Datenluecke).
     - x = Sekunden seit Start (Gesamtzeit-Achse der Aufzeichnung) oder Position (z. B. Bahn n) — nie gemischt.
     - y: „schoene" Teilstriche; Tempo invertiert (schneller oben).
   Bedienung: Zeiger/Touch (horizontal ziehen, vertikal scrollt weiter), Tastatur (← → Pos1 Ende), Fadenkreuz + Tooltip.
   Gruppe: mehrere Diagramme derselben Zeitachse teilen das Fadenkreuz (Vergleich zweier Reihen untereinander — nie zwei
   y-Achsen in einem Diagramm).
   Keine Texte im Modul: Beschriftungen kommen vom Aufrufer (t()-Regime).
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};
  var VERSION = 'activity-chart@1';
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
  /* Tempo-Achse: Teilstriche auf 5/10/15/30/60 s */
  function paceStep(span, target) {
    var c = [5, 10, 15, 20, 30, 60, 120, 300], raw = span / Math.max(1, target);
    for (var i = 0; i < c.length; i++) if (c[i] >= raw) return c[i];
    return c[c.length - 1];
  }
  var TIME_STEPS = [30, 60, 120, 300, 600, 900, 1200, 1800, 3600, 5400, 7200, 10800];
  function timeStep(span, target) { var raw = span / Math.max(1, target); for (var i = 0; i < TIME_STEPS.length; i++) if (TIME_STEPS[i] >= raw) return TIME_STEPS[i]; return 14400; }

  /* Reine Geometrie (testbar ohne DOM) */
  function model(spec, w, h) {
    var pad = { l: spec.padL != null ? spec.padL : 46, r: 14, t: 14, b: 28 };
    var vals = spec.values || [], xs = spec.x && spec.x.length === vals.length ? spec.x : null;
    var pts = [];
    for (var i = 0; i < vals.length; i++) { var v = num(vals[i]); pts.push({ i: i, x: xs ? num(xs[i]) : i, v: v }); }
    var have = pts.filter(function (p) { return p.v !== null && p.x !== null; });
    if (have.length < 2) return null;
    var lo = Infinity, hi = -Infinity; have.forEach(function (p) { if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v; });
    if (spec.zeroBased && lo > 0) lo = 0;
    if (hi === lo) { hi += 1; lo -= 1; }
    var step = spec.pace ? paceStep(hi - lo, 3) : niceStep(hi - lo, 3);
    var y0 = Math.floor(lo / step) * step, y1 = Math.ceil(hi / step) * step;
    if (spec.zeroBased && lo >= 0) y0 = Math.max(0, y0);
    var x0 = have[0].x, x1 = have[have.length - 1].x; if (x1 === x0) x1 = x0 + 1;
    var iw = Math.max(10, w - pad.l - pad.r), ih = Math.max(10, h - pad.t - pad.b);
    var X = function (x) { return pad.l + (x - x0) / (x1 - x0) * iw; };
    var Y = function (v) { var r = (v - y0) / (y1 - y0); return spec.pace ? pad.t + r * ih : pad.t + (1 - r) * ih; };
    /* Lueckenschwelle aus dem Median der Abstaende */
    var gaps = [], prevX = null;
    have.forEach(function (p) { if (prevX !== null) gaps.push(p.x - prevX); prevX = p.x; });
    var gs = gaps.slice().sort(function (a, b) { return a - b; }), med = gs.length ? gs[Math.floor(gs.length / 2)] : 1;
    var gapLimit = xs ? Math.max(med * 3, 60) : 1.5;
    var segs = [], cur = [], last = null;
    pts.forEach(function (p) {
      if (p.v === null || p.x === null) { if (cur.length) segs.push(cur); cur = []; last = null; return; }
      if (last && p.x - last.x > gapLimit) { if (cur.length) segs.push(cur); cur = []; }
      cur.push(p); last = p;
    });
    if (cur.length) segs.push(cur);
    var ticksY = []; for (var t = y0; t <= y1 + step * 1e-6; t += step) ticksY.push(Math.round(t * 1000) / 1000);
    var ticksX = [];
    if (xs) { var ts = timeStep(x1 - x0, w < 420 ? 4 : 8); for (var tx = Math.ceil(x0 / ts) * ts; tx <= x1; tx += ts) ticksX.push(tx); }
    else { var cs = niceStep(x1 - x0, w < 420 ? 4 : 8); cs = Math.max(1, Math.round(cs)); for (var cx = Math.ceil(x0 / cs) * cs; cx <= x1; cx += cs) ticksX.push(cx); }
    return { pad: pad, w: w, h: h, iw: iw, ih: ih, X: X, Y: Y, y0: y0, y1: y1, x0: x0, x1: x1, segs: segs, pts: pts, have: have, ticksY: ticksY, ticksX: ticksX, gapLimit: gapLimit, timeAxis: !!xs };
  }
  function pathOf(m, seg) { return seg.map(function (p, j) { return (j ? 'L' : 'M') + m.X(p.x).toFixed(1) + ' ' + m.Y(p.v).toFixed(1); }).join(''); }
  function areaOf(m, seg, spec) {
    if (seg.length < 2) return '';
    var base = spec.pace ? m.pad.t + m.ih : m.Y(m.y0);
    return pathOf(m, seg) + 'L' + m.X(seg[seg.length - 1].x).toFixed(1) + ' ' + base.toFixed(1) + 'L' + m.X(seg[0].x).toFixed(1) + ' ' + base.toFixed(1) + 'Z';
  }
  /* naechster Messpunkt zur x-Position (Pixel) */
  function nearest(m, px) {
    var best = null, bd = Infinity;
    m.have.forEach(function (p) { var d = Math.abs(m.X(p.x) - px); if (d < bd) { bd = d; best = p; } });
    return best;
  }

  function el(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]); return e; }

  function group() {
    var charts = [];
    return {
      add: function (c) { charts.push(c); },
      show: function (src, x) { charts.forEach(function (c) { if (c !== src) c.showAtX(x, true); }); },
      hide: function (src) { charts.forEach(function (c) { if (c !== src) c.hide(true); }); },
      charts: charts
    };
  }

  /* spec: { values, x (Sekunden) | null, area (Standard an), dots, labelX(i) für Kategorie-Achse, fmt(v) → Text, unit, pace, zeroBased, mean, meanLabel,
            ariaLabel, xLabel(x) optional, group, live (Element fuer Ansage), height } */
  function mount(host, spec) {
    if (!host || !spec) return null;
    var id = 'aac' + (++uid);
    host.innerHTML = '';
    host.classList.add('aac');
    var wrap = document.createElement('div'); wrap.className = 'aac-wrap';
    var tip = document.createElement('div'); tip.className = 'aac-tip'; tip.setAttribute('aria-hidden', 'true'); tip.hidden = true;
    host.appendChild(wrap); host.appendChild(tip);
    host.setAttribute('tabindex', '0'); host.setAttribute('role', 'group');
    if (spec.ariaLabel) host.setAttribute('aria-label', spec.ariaLabel);
    var fmtX = spec.xLabel || (spec.x ? clock : function (x) { return String(Math.round(x) + 1); });
    var fmtV = spec.fmt || function (v) { return String(Math.round(v)); };
    var m = null, cur = null, svg = null, cross = null, dot = null, api;

    function draw() {
      var w = Math.round(host.clientWidth || 320), h = Math.round(spec.height || host.clientHeight || 220);
      m = model(spec, w, h); wrap.innerHTML = '';
      if (!m) return;
      svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, width: w, height: h, class: 'aac-svg', 'aria-hidden': 'true', focusable: 'false' });
      var defs = el('defs', {}), lg = el('linearGradient', { id: id + 'g', x1: 0, y1: 0, x2: 0, y2: 1 });
      var s0 = el('stop', { offset: '0%', class: 'aac-g0' }), s1 = el('stop', { offset: '100%', class: 'aac-g1' });
      lg.appendChild(s0); lg.appendChild(s1); defs.appendChild(lg); svg.appendChild(defs);
      var gy = el('g', { class: 'aac-grid' });
      m.ticksY.forEach(function (t) {
        var y = m.Y(t); gy.appendChild(el('line', { x1: m.pad.l, x2: w - m.pad.r, y1: y.toFixed(1), y2: y.toFixed(1) }));
        var tx = el('text', { x: m.pad.l - 8, y: (y + 3.5).toFixed(1), 'text-anchor': 'end', class: 'aac-ty' }); tx.textContent = fmtV(t); gy.appendChild(tx);
      });
      m.ticksX.forEach(function (t) {
        var x = m.X(t); if (x < m.pad.l - 1 || x > w - m.pad.r + 1) return;
        var tx = el('text', { x: x.toFixed(1), y: h - 8, 'text-anchor': 'middle', class: 'aac-tx' }); tx.textContent = fmtX(t); gy.appendChild(tx);
      });
      svg.appendChild(gy);
      var ga = el('g', { class: 'aac-data' });
      if (spec.area !== false) m.segs.forEach(function (sg) { var d = areaOf(m, sg, spec); if (d) ga.appendChild(el('path', { d: d, fill: 'url(#' + id + 'g)', class: 'aac-area' })); });
      m.segs.forEach(function (sg) {
        if (sg.length === 1) ga.appendChild(el('circle', { cx: m.X(sg[0].x).toFixed(1), cy: m.Y(sg[0].v).toFixed(1), r: 1.6, class: 'aac-pt' }));
        else ga.appendChild(el('path', { d: pathOf(m, sg), class: 'aac-line', fill: 'none' }));
      });
      /* Kategorie-Achse (z. B. je Bahn): jeder Messpunkt als Punkt — einzelne Werte, kein Verlauf dazwischen behauptet */
      if (spec.dots) m.have.forEach(function (p) { ga.appendChild(el('circle', { cx: m.X(p.x).toFixed(1), cy: m.Y(p.v).toFixed(1), r: 2.2, class: 'aac-pt' })); });
      if (num(spec.mean) !== null && spec.mean >= Math.min(m.y0, m.y1) && spec.mean <= Math.max(m.y0, m.y1)) {
        var my = m.Y(spec.mean);
        ga.appendChild(el('line', { x1: m.pad.l, x2: w - m.pad.r, y1: my.toFixed(1), y2: my.toFixed(1), class: 'aac-mean' }));
        if (spec.meanLabel) { var ml = el('text', { x: w - m.pad.r - 2, y: (my - 5).toFixed(1), 'text-anchor': 'end', class: 'aac-ml' }); ml.textContent = spec.meanLabel; ga.appendChild(ml); }
      }
      svg.appendChild(ga);
      cross = el('line', { x1: 0, x2: 0, y1: m.pad.t, y2: m.pad.t + m.ih, class: 'aac-cross', visibility: 'hidden' });
      dot = el('circle', { cx: 0, cy: 0, r: 4.5, class: 'aac-dot', visibility: 'hidden' });
      svg.appendChild(cross); svg.appendChild(dot);
      wrap.appendChild(svg);
      if (cur) showPoint(cur, true);
    }
    function showPoint(p, silent) {
      if (!m || !p) return;
      cur = p;
      var x = m.X(p.x), y = m.Y(p.v);
      cross.setAttribute('x1', x.toFixed(1)); cross.setAttribute('x2', x.toFixed(1)); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', y.toFixed(1)); dot.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.innerHTML = '<b></b><span></span>';
      tip.firstChild.textContent = fmtV(p.v) + (spec.unit ? ' ' + spec.unit : '');
      tip.lastChild.textContent = fmtX(p.x);
      var tw = tip.offsetWidth || 90, left = Math.max(4, Math.min((host.clientWidth || 320) - tw - 4, x - tw / 2));
      tip.style.left = left + 'px'; tip.style.top = Math.max(0, Math.min(y - 46, m.pad.t + m.ih - 40)) + 'px';
      if (!silent && spec.live) spec.live.textContent = tip.firstChild.textContent + ' · ' + tip.lastChild.textContent;
    }
    function hide(fromGroup) {
      cur = null; if (cross) { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); } tip.hidden = true;
      if (!fromGroup && spec.group) spec.group.hide(api);
    }
    function atPixel(px) { if (!m) return; var p = nearest(m, px); if (p) { showPoint(p); if (spec.group) spec.group.show(api, p.x); } }
    function onMove(ev) { var r = host.getBoundingClientRect(); atPixel(ev.clientX - r.left); }
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerdown', onMove);
    host.addEventListener('pointerleave', function (ev) { if (ev.pointerType === 'mouse') hide(); });
    host.addEventListener('keydown', function (ev) {
      if (!m) return; var k = ev.key, list = m.have, i = cur ? list.indexOf(cur) : -1;
      if (k === 'ArrowRight' || k === 'ArrowLeft') { i = i < 0 ? 0 : Math.max(0, Math.min(list.length - 1, i + (k === 'ArrowRight' ? 1 : -1) * (ev.shiftKey ? 10 : 1))); }
      else if (k === 'Home') i = 0; else if (k === 'End') i = list.length - 1;
      else if (k === 'Escape') { hide(); return; } else return;
      ev.preventDefault(); showPoint(list[i]); if (spec.group) spec.group.show(api, list[i].x);
    });
    host.addEventListener('blur', function () { hide(); });
    api = {
      redraw: draw, hide: hide,
      showAtX: function (x, fromGroup) { if (!m) return; var best = null, bd = Infinity; m.have.forEach(function (p) { var d = Math.abs(p.x - x); if (d < bd) { bd = d; best = p; } }); if (best) showPoint(best, fromGroup); },
      model: function () { return m; }
    };
    draw();
    if (spec.group) spec.group.add(api);
    /* Breite aendert sich (Drehen, Desktop-Fenster) → neu zeichnen, nicht skalieren (scharfe Linien, lesbare Schrift) */
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
