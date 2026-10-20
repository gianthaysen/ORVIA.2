/* ============================================================
   ORVIA · story-share (v8-456, v8-457) — Teilen aus Highlights und Aktivitaetsseite: Story-Karten (PNG 2160 × 3840 bzw.
   1080 × 1920) und Aufkleber (PNG mit Alpha-Kanal, eng zugeschnitten, helle oder dunkle Schrift)

   Grundsaetze
   - Zeichnet NUR die uebergebenen Daten (Aufrufer: ui.js gmShareData — dieselbe gepruefte Datenbasis wie die Aktivitaetsseite:
     activity-analysis / metric-eligibility, Bestzeit-Kategorie wie im Bestzeiten-Register). Dieses Modul rechnet keine Kennzahl.
   - Karte ohne Kartenkacheln: die Strecke ist eine eigene Vektorlinie. Grund: keine Lizenz-/Attributionspflicht im Export und
     kein „verunreinigtes" Canvas durch fremde Kacheln (toBlob waere sonst gesperrt). Einziges Bild im Export: das eigene Foto
     des Nutzers (Vorlage „Foto"), lokal gelesen, nie hochgeladen; die Standortdaten der Fotodatei fallen beim Neuzeichnen weg.
   - v8-457: gezeichnet wird IMMER in der Zielaufloesung (Vektor: Schrift, Linien, Verlaeufe) — 4K = Massstab 2 auf 2160 × 3840,
     keine Hochskalierung eines kleinen Bildes. Scheitert die grosse Flaeche (Speicher auf aelteren Geraeten), wird einmal in
     1080 × 1920 gezeichnet und das gesagt.
   - Start-/Zielbereich ausblenden betrifft NUR die Exportdatei (Kopie der Punkte), nie die gespeicherte Strecke.
   - Teilen nur auf ausdruecklichen Tipp: die Datei wird beim Auswaehlen vorbereitet; der Tipp auf „Teilen" ruft
     navigator.share() SOFORT (ohne vorheriges await) — sonst verfaellt in Safari die Nutzeraktivierung.
   - Kein nachgebautes System-Menue. Ohne Datei-Teilen: Bild speichern; Aufkleber: zusaetzlich „Kopieren" (Clipboard API),
     Erfolg erst nach aufgeloestem write().
   - Video: bewusst KEIN Knopf (Video-Engine existiert noch nicht — dokumentierte Folgephase).
   - Keine Texte im Modul: alle Beschriftungen kommen ueber opts.t (i18n des Aufrufers) bzw. die Daten.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};
  var VERSION = 'story-share@2';
  var W = 1080, H = 1920;
  var FONT = 'Inter, "SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  var C = { navy0: '#050B14', navy1: '#0B1727', gold: '#D8BB7A', text: '#F5F2EA', muted: 'rgba(245,242,234,0.64)', faint: 'rgba(245,242,234,0.38)',
            start: '#43D69E', finish: '#FF6464' };
  /* Akzentfarbe der Sportart kommt vom Aufrufer (aus styles.css: --activity-primary) — kein Farbwert der Sportarten im Modul */
  /* Geometrie des Original-Logos: assets/brand/orvia-lockup-horizontal.svg (viewBox 0 0 1080 320) — 1:1 uebernommen,
     ein Test prueft die Uebereinstimmung mit der Datei. Gezeichnet als Path2D (kein <img>: verunreinigt in Safari das Canvas). */
  var LOGO = {
    vb: [1080, 320],
    mark: { tx: -15, ty: 39.5, s: 0.5, ring: 'M399.3 228.1 A146 146 0 1 1 322.3 125.9', ringW: 30, check: 'M168 246 L236 360 L432 122', checkW: 32,
            grad: [55, 61, 216, 180], stops: [[0, '#E7CF9A'], [0.5, '#D8B777'], [1, '#9F7A36']] },
    divider: { x1: 272, y1: 92, x2: 272, y2: 228, color: 'rgba(216,183,119,0.45)', w: 2 },
    word: { x: 312, y: 172, size: 92, weight: 600, ls: 17, text: 'ORVIA', fill: '#F5F2EA' }
  };

  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  /* „21,10 km" → { n: '21,10', u: 'km' }; „1:52:13" → { n: '1:52:13', u: '' } */
  function splitVal(txt) {
    var s = String(txt == null ? '' : txt).trim(), m = /^(\S+)\s+(.+)$/.exec(s);
    return m ? { n: m[1], u: m[2] } : { n: s, u: '' };
  }

  /* ---------- Strecke ---------- */
  function hav(a, b) {
    var R = 6371000, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function validPts(route) {
    return (Array.isArray(route) ? route : []).filter(function (p) { return Array.isArray(p) && num(p[0]) !== null && num(p[1]) !== null && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180; })
      .map(function (p) { return [p[0], p[1]]; });
  }
  /* Start-/Zielbereich ausblenden (nur Export). Zu kurze Strecke (< 3 × Bereich): Ausblenden wuerde fast alles entfernen →
     null = Strecke wird nicht gezeigt (sicherer als den Startpunkt zu verraten). */
  function privacyTrim(route, m) {
    var pts = validPts(route); m = +m || 0;
    if (pts.length < 2) return null;
    if (!m) return pts;
    var cum = [0]; for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + hav(pts[i - 1], pts[i]));
    var tot = cum[cum.length - 1]; if (tot < m * 3) return null;
    var out = pts.filter(function (_, k) { return cum[k] >= m && cum[k] <= tot - m; });
    return out.length >= 2 ? out : null;
  }
  function project(pts, box) {
    var mid = (Math.min.apply(null, pts.map(function (p) { return p[0]; })) + Math.max.apply(null, pts.map(function (p) { return p[0]; }))) / 2;
    var cos = Math.cos(mid * Math.PI / 180);
    var xs = pts.map(function (p) { return p[1] * cos; }), ys = pts.map(function (p) { return -p[0]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var sx = (x1 - x0) || 1e-9, sy = (y1 - y0) || 1e-9, sc = Math.min(box.w / sx, box.h / sy);
    var ox = box.x + (box.w - sx * sc) / 2, oy = box.y + (box.h - sy * sc) / 2;
    return xs.map(function (x, i) { return [ox + (x - x0) * sc, oy + (ys[i] - y0) * sc]; });
  }

  /* ---------- Zeichenhelfer ---------- */
  function font(px, w) { return (w || 700) + ' ' + Math.round(px) + 'px ' + FONT; }
  function spacedWidth(ctx, t, ls) { var w = 0; for (var i = 0; i < t.length; i++) w += ctx.measureText(t[i]).width + (i < t.length - 1 ? ls : 0); return w; }
  function textSpaced(ctx, t, x, y, ls, align) {
    t = String(t); if (!ls) { ctx.textAlign = align || 'left'; ctx.fillText(t, x, y); return; }
    var w = spacedWidth(ctx, t, ls), cx = align === 'right' ? x - w : (align === 'center' ? x - w / 2 : x);
    ctx.textAlign = 'left'; for (var i = 0; i < t.length; i++) { ctx.fillText(t[i], cx, y); cx += ctx.measureText(t[i]).width + ls; }
  }
  /* groesste Schrift <= px, bei der t in maxW passt */
  function fit(ctx, t, px, w, maxW, min) {
    var s = px; ctx.font = font(s, w);
    while (s > (min || 12) && ctx.measureText(String(t)).width > maxW) { s -= 2; ctx.font = font(s, w); }
    return s;
  }
  /* Zeilenumbruch (max. Zeilen, Auslassung) */
  function wrap(ctx, t, maxW, lines) {
    var words = String(t || '').split(/\s+/).filter(Boolean), out = [], cur = '';
    words.forEach(function (wd) { var nx = cur ? cur + ' ' + wd : wd; if (ctx.measureText(nx).width <= maxW || !cur) cur = nx; else { out.push(cur); cur = wd; } });
    if (cur) out.push(cur);
    if (out.length > lines) { out = out.slice(0, lines); var l = out[lines - 1]; while (l.length > 1 && ctx.measureText(l + '…').width > maxW) l = l.slice(0, -1); out[lines - 1] = l.replace(/\s+$/, '') + '…'; }
    out = out.map(function (l) { if (ctx.measureText(l).width <= maxW) return l; while (l.length > 1 && ctx.measureText(l + '…').width > maxW) l = l.slice(0, -1); return l + '…'; });
    return out;
  }
  function logo(ctx, x, y, h, opts) {
    opts = opts || {}; var s = h / LOGO.vb[1];
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    var mk = LOGO.mark;
    ctx.save(); ctx.translate(mk.tx, mk.ty); ctx.scale(mk.s, mk.s);
    var g = ctx.createLinearGradient(mk.grad[0], mk.grad[1], mk.grad[2], mk.grad[3]); mk.stops.forEach(function (st) { g.addColorStop(st[0], opts.mono || st[1]); });
    ctx.strokeStyle = g; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (typeof Path2D === 'function') { ctx.lineWidth = mk.ringW; ctx.stroke(new Path2D(mk.ring)); ctx.lineWidth = mk.checkW; ctx.stroke(new Path2D(mk.check)); }
    ctx.restore();
    if (!opts.markOnly) {
      var d = LOGO.divider; ctx.strokeStyle = opts.mono ? 'rgba(255,255,255,0.45)' : d.color; ctx.lineWidth = d.w; ctx.beginPath(); ctx.moveTo(d.x1, d.y1); ctx.lineTo(d.x2, d.y2); ctx.stroke();
      var wd = LOGO.word; ctx.fillStyle = opts.mono || wd.fill; ctx.font = font(wd.size, wd.weight); ctx.textBaseline = 'alphabetic'; textSpaced(ctx, wd.text, wd.x, wd.y, wd.ls);
    }
    ctx.restore();
    return (opts.markOnly ? 215 : 760) * s;     /* Breite der gezeichneten Marke (Zeichen bzw. Zeichen + Wort) */
  }
  /* v8-457 · Strecke fein und gleich in jeder Aufloesung: Masse in 1080er-Einheiten (bei 4K doppelt gezeichnet, nicht skaliert).
     Feiner Kern, nur ein sehr leiser Schein, KEINE dunkle Aussenkontur auf dunklem Grund; Aufkleber (ueber Fotos) bekommen
     eine kaum sichtbare dunkle Kante fuer helle Hintergruende. Start/Ziel klein (Radius ≈ Linienstaerke). */
  function routeDraw(ctx, pts, box, accent, lw, opts) {
    opts = opts || {};
    var P = project(pts, box);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var path = function () { ctx.beginPath(); P.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); };
    if (opts.glow) { ctx.shadowColor = hexA(accent, 0.55); ctx.shadowBlur = lw * 2.2; ctx.strokeStyle = hexA(accent, 0.35); ctx.lineWidth = lw; path(); ctx.stroke(); ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
    if (opts.edge) { ctx.strokeStyle = 'rgba(3,8,14,0.22)'; ctx.lineWidth = lw + 3; path(); ctx.stroke(); }
    ctx.strokeStyle = accent; ctx.lineWidth = lw; path(); ctx.stroke();
    var r = Math.max(4.5, lw * 1.05);
    [[P[0], C.start], [P[P.length - 1], C.finish]].forEach(function (d) { ctx.beginPath(); ctx.arc(d[0][0], d[0][1], r, 0, Math.PI * 2); ctx.fillStyle = d[1]; ctx.fill(); ctx.lineWidth = Math.max(2, lw * 0.4); ctx.strokeStyle = opts.edge ? 'rgba(255,255,255,0.9)' : 'rgba(5,11,20,0.9)'; ctx.stroke(); });
    ctx.restore();
  }
  /* Wert mit Einheit: Zahl gross, Einheit klein in der Akzentfarbe, gemeinsame Grundlinie */
  function valueAt(ctx, v, x, y, px, upx, color, ucolor, align, maxW) {
    var sv = splitVal(v.txt != null ? v.txt : v);
    var s = px, us = upx;
    for (var k = 0; k < 40; k++) {
      ctx.font = font(s, 800); var nw = ctx.measureText(sv.n).width; ctx.font = font(us, 650); var uw = sv.u ? ctx.measureText(sv.u).width + s * 0.12 : 0;
      if (!maxW || nw + uw <= maxW) break; s *= 0.94; us *= 0.94;
    }
    ctx.font = font(s, 800); var nW = ctx.measureText(sv.n).width; ctx.font = font(us, 650); var uW = sv.u ? ctx.measureText(sv.u).width + s * 0.12 : 0;
    var x0 = align === 'center' ? x - (nW + uW) / 2 : (align === 'right' ? x - nW - uW : x);
    ctx.textAlign = 'left'; ctx.fillStyle = color; ctx.font = font(s, 800); ctx.fillText(sv.n, x0, y);
    if (sv.u) { ctx.fillStyle = ucolor; ctx.font = font(us, 650); ctx.fillText(sv.u, x0 + nW + s * 0.12, y); }
    return { w: nW + uW, size: s };
  }
  function label(ctx, t, x, y, px, color, align, ls) { ctx.font = font(px, 700); ctx.fillStyle = color; textSpaced(ctx, String(t || '').toUpperCase(), x, y, ls == null ? px * 0.12 : ls, align); }
  /* Titel: erst kleiner, dann umbrechen (an Wortgrenzen), Auslassung nur als letzter Ausweg und nie mitten im Wort */
  function titleLines(ctx, t, maxW, px, minPx, lines, w) {
    var s = px;
    for (; s >= minPx; s -= 2) { ctx.font = font(s, w || 800); var l = wrapWords(ctx, t, maxW); if (l.length <= lines && l.every(function (x) { return ctx.measureText(x).width <= maxW; })) return { lines: l, size: s }; }
    ctx.font = font(minPx, w || 800); return { lines: wrap(ctx, t, maxW, lines), size: minPx };
  }
  function wrapWords(ctx, t, maxW) {
    var words = String(t || '').split(/\s+/).filter(Boolean), out = [], cur = '';
    words.forEach(function (wd) { var nx = cur ? cur + ' ' + wd : wd; if (ctx.measureText(nx).width <= maxW || !cur) cur = nx; else { out.push(cur); cur = wd; } });
    if (cur) out.push(cur); return out;
  }

  /* ---------- Vorlagen ---------- */
  /* Karten = die zehn freigegebenen Richtungen (v8-457): Minimal, Strecke, Bestleistung, Signature Ring, Foto, Abschnitte,
     Hoehenprofil, Intervallverlauf, (Aufkleber), Contour — jeweils NUR, wenn die Daten dafuer da sind. */
  var CARDS = [
    { id: 'hero', ok: function (d) { return d.metrics.length >= 1; } },
    { id: 'trio', ok: function (d) { return d.metrics.length >= 3; } },
    { id: 'route', ok: function (d) { return !!(d.route && d.route.length >= 2); }, route: true },
    { id: 'route_plus', ok: function (d) { return !!(d.route && d.route.length >= 2) && d.metrics.length >= 4; }, route: true },
    { id: 'pb', ok: function (d) { return !!d.pb; } },
    { id: 'ring', ok: function (d) { return d.metrics.length >= 1; } },
    { id: 'splits', ok: function (d) { return !!(d.splits && d.splits.rows && d.splits.rows.length >= 3); } },
    { id: 'intervals', ok: function (d) { return !!(d.ivtl && d.ivtl.blocks && d.ivtl.blocks.length >= 3 && d.ivtl.pace && d.ivtl.pace.v.length >= 20); } },
    { id: 'elev', ok: function (d) { return !!(d.elev && d.elev.pts && d.elev.pts.length >= 20 && d.elev.gain); } },
    { id: 'contour', ok: function (d) { return d.metrics.length >= 3; } },
    { id: 'summary', ok: function (d) { return d.metrics.length >= 4; } },
    { id: 'photo', ok: function (d) { return d.metrics.length >= 1; }, photo: true }
  ];
  var STICKERS = [
    { id: 's_stack', ok: function (d) { return d.metrics.length >= 3; } },
    { id: 's_main', ok: function (d) { return d.metrics.length >= 1; } },
    { id: 's_time', ok: function (d) { return !!byId(d, 'duration') && d.metrics[0].id !== 'duration'; } },
    { id: 's_rate', ok: function (d) { return !!rateOf(d); } },
    { id: 's_trio', ok: function (d) { return d.metrics.length >= 3; } },
    { id: 's_route', ok: function (d) { return !!(d.route && d.route.length >= 2); }, route: true },
    { id: 's_route_stats', ok: function (d) { return !!(d.route && d.route.length >= 2) && d.metrics.length >= 2; }, route: true },
    { id: 's_stats', ok: function (d) { return d.metrics.length >= 4; } },
    { id: 's_pb', ok: function (d) { return !!d.pb; } }
  ];
  function byId(d, id) { return d.metrics.filter(function (m) { return m.id === id; })[0] || null; }
  function rateOf(d) { var ids = d.rateIds || []; for (var i = 0; i < ids.length; i++) { var m = byId(d, ids[i]); if (m && d.metrics[0] !== m) return m; } return null; }
  function templates(d, kind) { return (kind === 'sticker' ? STICKERS : CARDS).filter(function (t) { try { return t.ok(d); } catch (e) { return false; } }); }
  /* v8-457 · Standardvorlage je Aktivitaet (eine einfache Regel, kein Empfehlungssystem): neue Bestzeit → Bestleistung;
     strukturiertes Intervalltraining mit echten Belastungen → Intervallverlauf; sonst drei Werte. Aufkleber: gestapelt. */
  function defaultTpl(d, kind) {
    var list = templates(d, kind).map(function (t) { return t.id; });
    var pref = kind === 'sticker' ? ['s_stack', 's_main'] : (d.pb ? ['pb', 'trio'] : (d.ivtl ? ['intervals', 'trio'] : ['trio', 'hero']));
    for (var i = 0; i < pref.length; i++) if (list.indexOf(pref[i]) >= 0) return pref[i];
    return list[0] || null;
  }
  function tplById(id) { return CARDS.concat(STICKERS).filter(function (t) { return t.id === id; })[0] || null; }
  var STICKER_H = { s_stack: 1500, s_main: 560, s_time: 560, s_rate: 560, s_trio: 520, s_route: 1080, s_route_stats: 1460, s_pb: 820 };
  function sizeOf(tpl, d) { if (!/^s_/.test(tpl.id)) return { w: W, h: H }; var h = tpl.id === 's_stats' ? 340 + Math.ceil(Math.min(6, d.metrics.length) / 2) * 300 : STICKER_H[tpl.id]; return { w: W, h: h }; }

  function bg(ctx, d) {
    var acc = d.accent || C.gold;
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.navy1); g.addColorStop(1, C.navy0); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var rg = ctx.createRadialGradient(W * 0.5, H * 0.2, 40, W * 0.5, H * 0.2, W * 0.95); rg.addColorStop(0, hexA(acc, 0.18)); rg.addColorStop(1, hexA(acc, 0)); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    var rg2 = ctx.createRadialGradient(W * 0.5, H * 1.02, 30, W * 0.5, H * 1.02, W * 0.8); rg2.addColorStop(0, 'rgba(216,187,122,0.09)'); rg2.addColorStop(1, 'rgba(216,187,122,0)'); ctx.fillStyle = rg2; ctx.fillRect(0, 0, W, H);
    return acc;
  }
  /* Kopf: Logo + Sportart, kurzer Titel (bis zwei Zeilen), Datum. Kein technischer Fuss mehr (v8-457) — keine Kartenkacheln,
     also keine Attributionspflicht; die Datenherkunft steht in ORVIA. */
  function cardBase(ctx, d, o) {
    o = o || {};
    var acc = o.noBg ? (d.accent || C.gold) : bg(ctx, d);
    logo(ctx, 92, 222, 104);
    label(ctx, d.sport, W - 96, 304, 28, acc, 'right', 4);
    var y = 300;
    if (!o.noTitle) {
      var tl = titleLines(ctx, d.title, W - 192, 64, 46, 2);
      ctx.font = font(tl.size, 800); ctx.fillStyle = C.text; ctx.textAlign = 'left'; y = 380 + tl.size;
      tl.lines.forEach(function (l, i) { ctx.fillText(l, 96, y + i * tl.size * 1.18); });
      y += (tl.lines.length - 1) * tl.size * 1.18;
      ctx.font = font(34, 500); ctx.fillStyle = C.muted; ctx.fillText(d.date || '', 96, y + 60);
      y += 60;
    }
    return { top: y + 80, bottom: 1660, acc: acc };
  }
  function hexA(hex, a) { var mm = /^rgba?\(([^)]+)\)/.exec(String(hex)); if (mm) { var q = mm[1].split(',').map(function (x) { return parseFloat(x); }); return 'rgba(' + q[0] + ',' + q[1] + ',' + q[2] + ',' + a + ')'; } var h = String(hex).replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); var n = parseInt(h, 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function metricRow(ctx, list, x, y, w, acc, vpx, color) {
    var n = list.length, cw = w / n;
    list.forEach(function (m, i) {
      var cx = x + i * cw; if (i) { ctx.strokeStyle = 'rgba(245,242,234,0.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, y - vpx - 46); ctx.lineTo(cx, y + 10); ctx.stroke(); }
      var px = i ? cx + 28 : cx;
      label(ctx, m.label, px, y - vpx - 18, 24, C.muted, 'left', 2.5);
      valueAt(ctx, m, px, y, vpx, vpx * 0.42, color || C.text, acc, 'left', cw - (i ? 44 : 20));
    });
  }
  function grid(ctx, list, x, y, w, rowH, cols, acc, vpx, color, lcolor) {
    var cw = w / cols;
    list.forEach(function (m, i) {
      var cx = x + (i % cols) * cw, cy = y + Math.floor(i / cols) * rowH;
      label(ctx, m.label, cx, cy, 26, lcolor || C.muted, 'left', 2.5);
      valueAt(ctx, m, cx, cy + vpx + 18, vpx, vpx * 0.42, color || C.text, acc, 'left', cw - 32);
    });
  }
  /* Drei Hauptwerte fuer Minimal/Ring/Contour/Foto: Distanz, Dauer, Tempo bzw. die ersten drei */
  function trioOf(d) { var ids = [d.metrics[0] && d.metrics[0].id, 'distance', 'duration'].concat(d.rateIds || []), out = []; ids.forEach(function (id) { var m = byId(d, id); if (m && out.indexOf(m) < 0 && out.length < 3) out.push(m); }); d.metrics.forEach(function (m) { if (out.length < 3 && out.indexOf(m) < 0) out.push(m); }); return out; }
  /* Kurvenzeichner (Hoehe/Tempo): Werte → Pfad in einem Feld; inv = kleinere Werte oben (Tempo) */
  function plot(ctx, xs, ys, box, lo, hi, inv) {
    var x0 = xs[0], x1 = xs[xs.length - 1] || 1; if (x1 === x0) x1 = x0 + 1;
    var X = function (x) { return box.x + (x - x0) / (x1 - x0) * box.w; }, Y = function (v) { var r = (v - lo) / ((hi - lo) || 1); return inv ? box.y + r * box.h : box.y + (1 - r) * box.h; };
    return { X: X, Y: Y };
  }

  var DRAW = {
    /* 1 · Minimal: eine grosse Zahl, darunter zwei Werte — wenig Text */
    hero: function (ctx, d) {
      var b = cardBase(ctx, d), t = trioOf(d), m = t[0], mid = (b.top + b.bottom) / 2 - 110;
      label(ctx, m.label, W / 2, mid - 190, 32, C.muted, 'center', 5);
      valueAt(ctx, m, W / 2, mid + 90, 300, 104, C.text, b.acc, 'center', W - 160);
      t.slice(1).forEach(function (x, i) { var y = mid + 300 + i * 200; valueAt(ctx, x, W / 2, y, 104, 44, C.text, b.acc, 'center', W - 200); label(ctx, x.label, W / 2, y + 52, 22, C.faint, 'center', 3.5); });
    },
    trio: function (ctx, d) {
      var b = cardBase(ctx, d), list = trioOf(d), step = (b.bottom - b.top) / 3;
      list.forEach(function (m, i) {
        var y = b.top + step * i + step * 0.3;
        if (i) { ctx.strokeStyle = 'rgba(245,242,234,0.10)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(96, y - 40); ctx.lineTo(W - 96, y - 40); ctx.stroke(); }
        label(ctx, m.label, 96, y + 20, 30, C.muted, 'left', 4);
        valueAt(ctx, m, 96, y + 20 + 170, 178, 66, C.text, b.acc, 'left', W - 192);
      });
    },
    /* 2 · Strecke im Fokus: echte GPS-Strecke fein mit leisem Schein, drei Werte */
    route: function (ctx, d, o) {
      var b = cardBase(ctx, d), rows = trioOf(d), boxB = b.bottom - 250;
      if (o.route) routeDraw(ctx, o.route, { x: 110, y: b.top - 10, w: W - 220, h: boxB - b.top - 10 }, b.acc, 7, { glow: true });
      if (d.routeTag) label(ctx, d.routeTag, W / 2, boxB + 26, 24, C.faint, 'center', 3);
      metricRow(ctx, rows, 96, b.bottom - 20, W - 192, b.acc, 84);
    },
    route_plus: function (ctx, d, o) {
      var b = cardBase(ctx, d), list = d.metrics.slice(0, 6), rowsN = Math.ceil(list.length / 3), gridH = rowsN * 190, boxB = b.bottom - gridH - 60;
      if (o.route) routeDraw(ctx, o.route, { x: 120, y: b.top - 10, w: W - 240, h: boxB - b.top - 20 }, b.acc, 6, { glow: true });
      if (d.routeTag) label(ctx, d.routeTag, W / 2, boxB + 4, 24, C.faint, 'center', 3);
      grid(ctx, list, 96, boxB + 70, W - 192, 190, 3, b.acc, 74, C.text);
    },
    /* 3 · Bestleistung: Kategorie · Distanz · Zeit als eine Komposition; kein Rechensatz */
    pb: function (ctx, d) {
      var b = cardBase(ctx, d), p = d.pb, mid = (b.top + b.bottom) / 2 - 60;
      ctx.font = font(28, 700); var kw = spacedWidth(ctx, String(p.kicker).toUpperCase(), 3.5) + 96;
      ctx.fillStyle = hexA(C.gold, 0.14); roundRect(ctx, W / 2 - kw / 2, mid - 330, kw, 70, 35); ctx.fill();
      label(ctx, p.kicker, W / 2, mid - 283, 28, C.gold, 'center', 3.5);
      ctx.font = font(fit(ctx, p.dist, 112, 800, W - 192), 800); ctx.fillStyle = C.text; ctx.textAlign = 'center'; ctx.fillText(p.dist, W / 2, mid - 120);
      ctx.font = font(fit(ctx, p.time, 270, 850, W - 160), 850); ctx.fillStyle = b.acc; ctx.fillText(p.time, W / 2, mid + 150);
      if (p.date) { ctx.font = font(34, 600); ctx.fillStyle = C.muted; ctx.fillText(p.date, W / 2, mid + 240); }
      var rest = trioOf(d); if (rest.length >= 2) metricRow(ctx, rest, 96, b.bottom - 20, W - 192, b.acc, 76);
    },
    /* 4 · Signature Ring: grosser leuchtender Ring als Dekoration (zeigt KEINEN Anteil/Fortschritt), Hauptwert innen */
    ring: function (ctx, d) {
      var b = cardBase(ctx, d), t = trioOf(d), m = t[0], cx = W / 2, cy = (b.top + b.bottom) / 2 - 120, R = 330;
      ctx.save();
      ctx.lineWidth = 2; ctx.strokeStyle = hexA(b.acc, 0.18); ctx.beginPath(); ctx.arc(cx, cy, R + 34, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowColor = hexA(b.acc, 0.65); ctx.shadowBlur = 42; ctx.lineWidth = 16; ctx.lineCap = 'round';
      var g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R); g.addColorStop(0, hexA(b.acc, 0.95)); g.addColorStop(0.5, hexA(b.acc, 0.45)); g.addColorStop(1, hexA(b.acc, 0.9));
      ctx.strokeStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      label(ctx, m.label, cx, cy - 120, 28, C.muted, 'center', 4);
      valueAt(ctx, m, cx, cy + 70, 210, 76, C.text, b.acc, 'center', R * 1.65);
      var rest = t.slice(1); if (rest.length) metricRow(ctx, rest, 150, b.bottom - 30, W - 300, b.acc, 86);
    },
    /* 5 · Foto: eigenes Trainingsfoto (lokal), dunkle Verlaeufe fuer Lesbarkeit, Hauptwert + drei Werte unten */
    photo: function (ctx, d, o) {
      ctx.fillStyle = C.navy0; ctx.fillRect(0, 0, W, H);
      if (o.photo) {
        var iw = o.photo.naturalWidth || o.photo.width, ih = o.photo.naturalHeight || o.photo.height, sc = Math.max(W / iw, H / ih), dw = iw * sc, dh = ih * sc;
        ctx.drawImage(o.photo, (W - dw) / 2, (H - dh) / 2, dw, dh);
      } else {
        var pg = ctx.createLinearGradient(0, 0, W, H); pg.addColorStop(0, '#26364C'); pg.addColorStop(1, '#0B1727'); ctx.fillStyle = pg; ctx.fillRect(0, 0, W, H);
        label(ctx, d.photoHint || '', W / 2, H / 2 - 120, 30, 'rgba(245,242,234,0.55)', 'center', 4);
      }
      var top = ctx.createLinearGradient(0, 0, 0, 520); top.addColorStop(0, 'rgba(3,8,14,0.62)'); top.addColorStop(1, 'rgba(3,8,14,0)'); ctx.fillStyle = top; ctx.fillRect(0, 0, W, 520);
      var bot = ctx.createLinearGradient(0, H * 0.48, 0, H); bot.addColorStop(0, 'rgba(3,8,14,0)'); bot.addColorStop(0.55, 'rgba(3,8,14,0.72)'); bot.addColorStop(1, 'rgba(3,8,14,0.92)'); ctx.fillStyle = bot; ctx.fillRect(0, H * 0.48, W, H * 0.52);
      cardBase(ctx, d, { noBg: true, noTitle: true });
      var t = trioOf(d);
      valueAt(ctx, t[0], 96, 1420, 230, 84, '#FFFFFF', d.accent, 'left', W - 192);
      if (t.length > 1) metricRow(ctx, t.slice(1).concat(byId(d, 'avgHr') && t.indexOf(byId(d, 'avgHr')) < 0 ? [byId(d, 'avgHr')] : []).slice(0, 3), 96, 1640, W - 192, d.accent, 70, '#FFFFFF');
    },
    /* 6 · Abschnitte: echte vergleichbare Belastungen; Abweichung zum Ziel (falls hinterlegt) bzw. zum eigenen Schnitt */
    splits: function (ctx, d) {
      var b = cardBase(ctx, d), sp = d.splits, rows = sp.rows.slice(0, 8), top = b.top + 40, rh = Math.min(132, (b.bottom - 330 - top) / rows.length);
      label(ctx, sp.title, 96, top, 30, C.text, 'left', 4);
      label(ctx, sp.refLabel, W - 96, top, 22, C.muted, 'right', 2.5);
      var vals = rows.map(function (r) { return r.v; }), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      rows.forEach(function (r, i) {
        var y = top + 70 + i * rh, better = sp.higherBetter ? r.delta > 0 : r.delta < 0, q = (hi - lo) ? (sp.higherBetter ? (r.v - lo) / (hi - lo) : (hi - r.v) / (hi - lo)) : 1;
        ctx.font = font(36, 800); ctx.fillStyle = C.text; ctx.textAlign = 'left'; ctx.fillText(r.label, 96, y + 40);
        var bx = 230, bw = 300 * (0.35 + 0.65 * q); ctx.fillStyle = hexA(b.acc, 0.22); roundRect(ctx, bx, y + 10, 300, 36, 18); ctx.fill(); ctx.fillStyle = b.acc; roundRect(ctx, bx, y + 10, bw, 36, 18); ctx.fill();
        ctx.font = font(44, 800); ctx.fillStyle = C.text; ctx.textAlign = 'right'; ctx.fillText(r.txt, 800, y + 44);
        if (r.dtxt) { ctx.font = font(38, 800); ctx.fillStyle = Math.abs(r.delta) < 0.5 ? C.muted : (better ? C.start : C.finish); ctx.fillText(r.dtxt, W - 96, y + 44); }
        if (i < rows.length - 1) { ctx.strokeStyle = 'rgba(245,242,234,0.08)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(96, y + rh - 22); ctx.lineTo(W - 96, y + rh - 22); ctx.stroke(); }
      });
      metricRow(ctx, trioOf(d), 96, b.bottom - 20, W - 192, b.acc, 76);
    },
    /* 7 · Hoehenprofil: echte Messreihe ueber die Distanz; Anstieg = Garmin (summiert), hoechster/tiefster Punkt aus der Reihe */
    elev: function (ctx, d) {
      var b = cardBase(ctx, d), e = d.elev, top = b.top + 20;
      label(ctx, e.gainLabel, 96, top + 6, 28, C.muted, 'left', 4);
      valueAt(ctx, e.gain, 96, top + 160, 150, 56, C.text, b.acc, 'left', 520);
      ctx.textAlign = 'right';
      [[e.hiLabel, e.hi], [e.loLabel, e.lo]].forEach(function (r, i) { ctx.font = font(26, 650); ctx.fillStyle = C.muted; ctx.fillText(r[0], W - 96, top + 30 + i * 100); ctx.font = font(44, 800); ctx.fillStyle = C.text; ctx.fillText(r[1], W - 96, top + 80 + i * 100); });
      var box = { x: 110, y: top + 260, w: W - 220, h: b.bottom - 300 - (top + 260) };
      var xs = e.pts.map(function (p) { return p[0]; }), ys = e.pts.map(function (p) { return p[1]; }), lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys), pad = (hi - lo) * 0.12 || 5;
      var pl = plot(ctx, xs, ys, box, lo - pad, hi + pad, false);
      ctx.strokeStyle = 'rgba(245,242,234,0.07)'; ctx.lineWidth = 2; [0, 0.5, 1].forEach(function (f) { var y = box.y + box.h * f; ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke(); });
      var path = function () { ctx.beginPath(); e.pts.forEach(function (p, i) { var x = pl.X(p[0]), y = pl.Y(p[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); };
      var gg = ctx.createLinearGradient(0, box.y, 0, box.y + box.h); gg.addColorStop(0, hexA(b.acc, 0.42)); gg.addColorStop(1, hexA(b.acc, 0.02));
      path(); ctx.lineTo(pl.X(xs[xs.length - 1]), box.y + box.h); ctx.lineTo(pl.X(xs[0]), box.y + box.h); ctx.closePath(); ctx.fillStyle = gg; ctx.fill();
      path(); ctx.strokeStyle = b.acc; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
      ctx.font = font(24, 600); ctx.fillStyle = C.faint; ctx.textAlign = 'left'; ctx.fillText(e.x0, box.x, box.y + box.h + 44); ctx.textAlign = 'right'; ctx.fillText(e.x1, box.x + box.w, box.y + box.h + 44);
      metricRow(ctx, trioOf(d), 96, b.bottom - 20, W - 192, b.acc, 76);
    },
    /* 8 · Intervallverlauf: Tempo ueber die Zeit, Belastungen als ruhige Baender dahinter (Tempoachse: schneller = oben) */
    intervals: function (ctx, d) {
      var b = cardBase(ctx, d), iv = d.ivtl, top = b.top + 30;
      label(ctx, iv.title, 96, top, 30, C.text, 'left', 4);
      var box = { x: 110, y: top + 70, w: W - 220, h: b.bottom - 330 - (top + 70) };
      var tv = iv.pace.t, vv = iv.pace.v, ok = vv.filter(function (v) { return v != null; }).slice().sort(function (a, c) { return a - c; });
      var lo = ok[Math.floor(ok.length * 0.03)], hi = ok[Math.floor(ok.length * 0.97)], sp = (hi - lo) || 30; lo -= sp * 0.15; hi += sp * 0.15;
      var pl = plot(ctx, [0, iv.total], [lo, hi], box, lo, hi, !!iv.inv);
      iv.blocks.forEach(function (bk) { if (bk.kind !== 'work') return; ctx.fillStyle = hexA(b.acc, 0.16); roundRect(ctx, pl.X(bk.start), box.y, Math.max(4, pl.X(bk.start + bk.dur) - pl.X(bk.start)), box.h, 14); ctx.fill(); });
      ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
      ctx.beginPath(); var pen = false;
      tv.forEach(function (t, i) { var v = vv[i]; if (v == null) { pen = false; return; } var x = pl.X(t), y = pl.Y(Math.max(lo, Math.min(hi, v))); if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; } });
      ctx.strokeStyle = b.acc; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
      ctx.font = font(24, 600); ctx.fillStyle = C.faint; ctx.textAlign = 'left';
      [[lo + sp * 0.15, 'top'], [hi - sp * 0.15, 'bot']].forEach(function (r) { ctx.fillText(iv.fmt(r[0]), box.x, pl.Y(r[0]) + (r[1] === 'top' ? 34 : -12)); });
      label(ctx, iv.legend, W / 2, box.y + box.h + 50, 22, C.faint, 'center', 2.5);
      metricRow(ctx, trioOf(d), 96, b.bottom - 20, W - 192, b.acc, 76);
    },
    /* 10 · Contour Minimal: abstrakte Hoehenlinien (rein dekorativ, aus der Aktivitaets-ID — kein Gelaende), drei Werte */
    contour: function (ctx, d) {
      var acc = bg(ctx, d), seed = 0; String(d.fileBase || 'orvia').split('').forEach(function (c) { seed = (seed * 31 + c.charCodeAt(0)) >>> 0; });
      var rnd = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      var cx = [W * (0.2 + rnd() * 0.6), W * (0.2 + rnd() * 0.6)], cy = [H * (0.25 + rnd() * 0.2), H * (0.6 + rnd() * 0.2)];
      ctx.save(); ctx.lineWidth = 2;
      for (var k = 1; k <= 26; k++) {
        ctx.strokeStyle = hexA(acc, k % 5 === 0 ? 0.26 : 0.13); ctx.beginPath();
        for (var a = 0; a <= 120; a++) {
          var th = a / 120 * Math.PI * 2, c = k % 2, r = k * 58 * (1 + 0.16 * Math.sin(th * 3 + k * 0.4 + seed % 7) + 0.08 * Math.cos(th * 5 + k));
          var x = cx[c] + Math.cos(th) * r, y = cy[c] + Math.sin(th) * r * 1.15;
          if (a) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
      var vg = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.62); vg.addColorStop(0, 'rgba(5,11,20,0.78)'); vg.addColorStop(1, 'rgba(5,11,20,0)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      var b = cardBase(ctx, d, { noBg: true }), t = trioOf(d), step = 280, y0 = (b.top + b.bottom) / 2 - step;
      t.forEach(function (m, i) { valueAt(ctx, m, W / 2, y0 + i * step + 40, 150, 56, C.text, acc, 'center', W - 200); label(ctx, m.label, W / 2, y0 + i * step + 96, 24, C.muted, 'center', 3.5); });
    },
    summary: function (ctx, d) {
      var b = cardBase(ctx, d), list = d.metrics.slice(0, 6), step = Math.min(170, (b.bottom - b.top) / list.length);
      list.forEach(function (m, i) {
        var y = b.top + 20 + step * i;
        ctx.strokeStyle = 'rgba(245,242,234,0.10)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(96, y + step - 46); ctx.lineTo(W - 96, y + step - 46); ctx.stroke();
        label(ctx, m.label, 96, y + 60, 28, C.muted, 'left', 3);
        valueAt(ctx, m, W - 96, y + 74, i ? 86 : 104, i ? 38 : 44, C.text, b.acc, 'right', 560);
      });
    },
    /* Aufkleber: transparenter Grund; Schrift hell (fuer dunkle Fotos) oder dunkel (fuer helle Fotos), nur ein feiner Schatten */
    s_stack: function (ctx, d, o) {
      var ink = inkOf(o), y = 120;
      if (d.title) { shadow(ctx, o); var tl = titleLines(ctx, d.title, W - 160, 64, 44, 2); ctx.font = font(tl.size, 800); ctx.fillStyle = ink.text; ctx.textAlign = 'center'; tl.lines.forEach(function (l, i) { ctx.fillText(l, W / 2, y + tl.size + i * tl.size * 1.16); }); y += tl.size + (tl.lines.length - 1) * tl.size * 1.16 + 70; }
      shadow(ctx, o);
      trioOf(d).forEach(function (m) { valueAt(ctx, m, W / 2, y + 190, 200, 76, ink.text, d.accent, 'center', W - 120); y += 270; });
      stickerMark(ctx, { h: y + 120 }, o);
    },
    s_main: function (ctx, d, o) { stickerVal(ctx, d.metrics[0], o, d); },
    s_time: function (ctx, d, o) { stickerVal(ctx, byId(d, 'duration'), o, d); },
    s_rate: function (ctx, d, o) { stickerVal(ctx, rateOf(d), o, d); },
    s_trio: function (ctx, d, o) {
      var ink = inkOf(o); shadow(ctx, o); var list = trioOf(d), cw = (W - 80) / 3;
      list.forEach(function (m, i) { var cx = 40 + cw * i + cw / 2; label(ctx, m.label, cx, 150, 26, ink.label, 'center', 3); valueAt(ctx, m, cx, 300, 108, 44, ink.text, d.accent, 'center', cw - 30); });
      stickerMark(ctx, o.size, o);
    },
    s_route: function (ctx, d, o) { if (o.route) routeDraw(ctx, o.route, { x: 90, y: 90, w: W - 180, h: o.size.h - 260 }, d.accent, 9, { edge: true }); stickerMark(ctx, o.size, o); },
    s_route_stats: function (ctx, d, o) {
      var ink = inkOf(o);
      if (o.route) routeDraw(ctx, o.route, { x: 110, y: 70, w: W - 220, h: o.size.h - 560 }, d.accent, 8, { edge: true });
      shadow(ctx, o); var list = trioOf(d), cw = (W - 80) / list.length;
      list.forEach(function (m, i) { var cx = 40 + cw * i + cw / 2; label(ctx, m.label, cx, o.size.h - 330, 26, ink.label, 'center', 3); valueAt(ctx, m, cx, o.size.h - 190, 100, 42, ink.text, d.accent, 'center', cw - 30); });
      stickerMark(ctx, o.size, o);
    },
    s_stats: function (ctx, d, o) {
      var ink = inkOf(o); shadow(ctx, o); var tl = titleLines(ctx, d.title, W - 160, 48, 36, 2); ctx.font = font(tl.size, 800); ctx.fillStyle = ink.text; ctx.textAlign = 'left';
      tl.lines.forEach(function (l, i) { ctx.fillText(l, 80, 130 + i * tl.size * 1.16); });
      var dy = (tl.lines.length - 1) * tl.size * 1.16;
      ctx.font = font(30, 600); ctx.fillStyle = ink.label; ctx.fillText(d.date || '', 80, 182 + dy);
      grid(ctx, d.metrics.slice(0, 6), 80, 300 + dy, W - 160, 300, 2, d.accent, 112, ink.text, ink.label);
      stickerMark(ctx, o.size, o);
    },
    s_pb: function (ctx, d, o) {
      var ink = inkOf(o); shadow(ctx, o); var p = d.pb;
      label(ctx, p.kicker, W / 2, 140, 32, ink.dark ? '#7A5E22' : C.gold, 'center', 4);
      ctx.font = font(fit(ctx, p.dist, 104, 800, W - 120), 800); ctx.fillStyle = ink.text; ctx.textAlign = 'center'; ctx.fillText(p.dist, W / 2, 290);
      ctx.font = font(fit(ctx, p.time, 250, 850, W - 120), 850); ctx.fillStyle = d.accent; ctx.fillText(p.time, W / 2, 540);
      if (p.date) { ctx.font = font(32, 600); ctx.fillStyle = ink.label; ctx.fillText(p.date, W / 2, 620); }
      stickerMark(ctx, o.size, o);
    }
  };
  function roundRect(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  /* Schrift der Aufkleber: hell (Standard) oder dunkel; Schatten nur als feine Abhebung (vorher 16 px Blur bei 38 % = grauer Hof) */
  function inkOf(o) { return o && o.ink === 'dark' ? { dark: true, text: '#0B1420', label: 'rgba(11,20,32,0.78)', sh: 'rgba(255,255,255,0.45)' } : { dark: false, text: '#FFFFFF', label: 'rgba(255,255,255,0.86)', sh: 'rgba(0,0,0,0.30)' }; }
  function shadow(ctx, o) { var ink = inkOf(o); ctx.shadowColor = ink.sh; ctx.shadowBlur = 5; ctx.shadowOffsetY = 1; }
  function stickerVal(ctx, m, o, d) {
    if (!m) return; var ink = inkOf(o); shadow(ctx, o);
    label(ctx, m.label, W / 2, 140, 34, ink.label, 'center', 5);
    valueAt(ctx, m, W / 2, 380, 240, 86, ink.text, d.accent, 'center', W - 100);
    stickerMark(ctx, o.size, o);
  }
  function stickerMark(ctx, size, o) { var ink = inkOf(o); ctx.save(); ctx.shadowColor = ink.sh; ctx.shadowBlur = 4; logo(ctx, W / 2 - 92, size.h - 96, 56, { mono: ink.dark ? 'rgba(11,20,32,0.9)' : 'rgba(255,255,255,0.94)' }); ctx.restore(); }

  /* Aufkleber eng zuschneiden: kleinster Rahmen um alle sichtbaren Pixel (+ Rand), Alpha bleibt erhalten */
  function trimCanvas(cv, pad) {
    try {
      var ctx = cv.getContext('2d'), w = cv.width, h = cv.height, data = ctx.getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) if (data[(y * w + x) * 4 + 3] > 6) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return cv;
      x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
      var out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
      out.getContext('2d').drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
      return out;
    } catch (e) { return cv; }
  }

  /* render(tplId, data, opts) → Canvas. opts.scale: 2 = 4K (2160 × 3840), 1 = 1080 × 1920, kleiner = Vorschaubild.
     opts.privacyM: ausgeblendete Meter je Ende (entlang der Strecke). opts.ink: 'light'|'dark' (Aufkleber). opts.photo: Bild.
     opts.trim: Aufkleber eng zuschneiden (Export). */
  function render(tplId, d, opts) {
    opts = opts || {}; var tpl = tplById(tplId); if (!tpl || !DRAW[tpl.id]) return null;
    if (!d.accent) d = Object.assign({}, d, { accent: C.gold });
    var size = sizeOf(tpl, d), sc = opts.scale || 1;
    var cv = (opts.canvas) || (typeof document !== 'undefined' ? document.createElement('canvas') : null); if (!cv) return null;
    cv.width = Math.round(size.w * sc); cv.height = Math.round(size.h * sc);
    var ctx = cv.getContext('2d'); if (!ctx) return null;
    ctx.setTransform(sc, 0, 0, sc, 0, 0); ctx.clearRect(0, 0, size.w, size.h); ctx.textBaseline = 'alphabetic';
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    var route = tpl.route ? (d.routeVirtual ? validPts(d.route) : privacyTrim(d.route, opts.privacyM || 0)) : null;
    if (tpl.route && route && route.length < 2) route = null;
    DRAW[tpl.id](ctx, d, { size: size, route: route, ink: opts.ink || 'light', photo: opts.photo || null });
    if (opts.trim && /^s_/.test(tpl.id)) return trimCanvas(cv, Math.round(28 * sc));
    return cv;
  }
  function toBlob(cv) {
    return new Promise(function (res, rej) { try { cv.toBlob(function (b) { b ? res(b) : rej(new Error('blob')); }, 'image/png'); } catch (e) { rej(e); } });
  }
  function fileName(d, tplId) {
    var s = String(d.fileBase || 'orvia').toLowerCase().replace(/[\u00e4\u00c4]/g, 'ae').replace(/[\u00f6\u00d6]/g, 'oe').replace(/[\u00fc\u00dc]/g, 'ue').replace(/\u00df/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return (s || 'orvia') + '-' + tplId.replace(/_/g, '-') + '.png';
  }

  /* ---------- Faehigkeiten des Geraets (zur Laufzeit gepruefte, keine Annahmen) ---------- */
  function caps(file) {
    var n = typeof navigator !== 'undefined' ? navigator : {};
    var shareFiles = false;
    try { shareFiles = !!(n.share && n.canShare && file && n.canShare({ files: [file] })); } catch (e) { shareFiles = false; }
    return { shareFiles: shareFiles, copyImage: !!(n.clipboard && n.clipboard.write && typeof root.ClipboardItem === 'function') };
  }

  /* ---------- Teilen-Auswahl (Sheet am Telefon, Dialog am Desktop) ---------- */
  var S = null;
  var SHARE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10.5H6.5A1.5 1.5 0 0 0 5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12a1.5 1.5 0 0 0-1.5-1.5H16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function open(d, opts) {
    if (S) close(true);
    opts = opts || {}; var t = opts.t || function (k) { return k; };
    var host = document.createElement('div'); host.className = 'shs'; host.setAttribute('role', 'dialog'); host.setAttribute('aria-modal', 'true'); host.setAttribute('aria-labelledby', 'shsTitle');
    host.setAttribute('data-sport', d.fam || 'other'); host.style.setProperty('--shs-acc', d.accent || C.gold);
    var key = String(d.fileBase || '');
    S = { host: host, d: d, opts: opts, t: t, kind: 'card', tpl: null, privacyM: d.routeVirtual ? 0 : (opts.privacyM != null ? opts.privacyM : 200), file: null, blob: null, url: null, seq: 0, ret: opts.returnFocus || document.activeElement, thumbs: {},
          key: key, scale: 2, ink: 'light', photo: null, photoUrl: null };
    host.innerHTML =
      '<div class="shs-scrim" data-act="close"></div>' +
      '<div class="shs-panel">' +
        '<div class="shs-grab" aria-hidden="true"></div>' +
        '<div class="shs-head"><h2 id="shsTitle">' + esc(t('share.title')) + '</h2><button type="button" class="shs-x" data-act="close" aria-label="' + esc(t('share.close')) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>' +
        '<div class="shs-seg" role="tablist" aria-label="' + esc(t('share.kind')) + '">' +
          '<button type="button" role="tab" data-kind="card" aria-selected="true">' + esc(t('share.cards')) + '</button>' +
          '<button type="button" role="tab" data-kind="sticker" aria-selected="false">' + esc(t('share.stickers')) + '</button></div>' +
        '<div class="shs-body">' +
          '<div class="shs-prev" aria-live="polite"><img class="shs-img" alt=""><span class="shs-busy" hidden>' + esc(t('share.preparing')) + '</span></div>' +
          '<div class="shs-side">' +
            '<div class="shs-strip" role="radiogroup" aria-label="' + esc(t('share.templates')) + '"></div>' +
            /* Aufkleber: Schrift fuer dunkle bzw. helle Fotos */
            '<div class="shs-ink" hidden><span id="shsInkL">' + esc(t('share.ink')) + '</span><div class="shs-pseg" role="radiogroup" aria-labelledby="shsInkL">' +
              ['light', 'dark'].map(function (k) { return '<button type="button" role="radio" data-ink="' + k + '" aria-checked="' + (k === 'light') + '">' + esc(t('share.ink_' + k)) + '</button>'; }).join('') + '</div></div>' +
            /* Foto: wird nur auf diesem Geraet gelesen und gezeichnet — nichts wird hochgeladen */
            '<div class="shs-photo" hidden><label class="shs-pick"><input type="file" accept="image/*" data-photo="1" class="shs-file"><span>' + esc(t('share.photo_pick')) + '</span></label><small>' + esc(t('share.photo_note')) + '</small></div>' +
            '<div class="shs-act">' +
              '<button type="button" class="shs-btn shs-primary" data-act="share" hidden>' + SHARE_SVG + '<span>' + esc(t('share.share')) + '</span></button>' +
              '<button type="button" class="shs-btn" data-act="copy" hidden><span>' + esc(t('share.copy')) + '</span></button>' +
              '<button type="button" class="shs-btn" data-act="save"><span>' + esc(t('share.save')) + '</span></button>' +
            '</div>' +
            '<p class="shs-status" role="status" aria-live="polite"></p>' +
            '<p class="shs-hint" hidden></p>' +
            /* Weitere Optionen: Standort schuetzen (nur Bilder mit Strecke) und Aufloesung — stoeren die Hauptaktionen nicht */
            '<details class="shs-more"><summary>' + esc(t('share.more')) + '</summary>' +
              '<div class="shs-priv" hidden><span id="shsPrivL">' + esc(t('share.privacy')) + '</span><div class="shs-pseg" role="radiogroup" aria-labelledby="shsPrivL">' +
                [0, 200, 500].map(function (m) { return '<button type="button" role="radio" data-priv="' + m + '" aria-checked="false">' + esc(m ? t('share.privacy_m', { m: m }) : t('share.privacy_off')) + '</button>'; }).join('') + '</div>' +
                '<small>' + esc(t('share.privacy_note')) + '</small></div>' +
              '<div class="shs-q"><span id="shsQL">' + esc(t('share.quality')) + '</span><div class="shs-pseg" role="radiogroup" aria-labelledby="shsQL">' +
                [2, 1].map(function (q) { return '<button type="button" role="radio" data-q="' + q + '" aria-checked="' + (q === 2) + '">' + esc(t(q === 2 ? 'share.q_4k' : 'share.q_std')) + '</button>'; }).join('') + '</div>' +
                '<small>' + esc(t('share.quality_note')) + '</small></div>' +
            '</details>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(host);
    host.addEventListener('click', onClick);
    host.addEventListener('keydown', onKey);
    host.addEventListener('change', onChange);
    setKind('card');
    requestAnimationFrame(function () { host.classList.add('on'); var f = host.querySelector('.shs-seg [aria-selected="true"]'); if (f) f.focus(); });
    return { close: close };
  }
  var _chosen = {};   /* manuell gewaehlte Vorlage je Aktivitaet und Format (fuer diese Sitzung) */
  function close(silent) {
    if (!S) return; var s = S; S = null;
    try { if (s.url) URL.revokeObjectURL(s.url); if (s.photoUrl) URL.revokeObjectURL(s.photoUrl); Object.keys(s.thumbs).forEach(function (k) { URL.revokeObjectURL(s.thumbs[k]); }); } catch (e) {}
    s.host.remove();
    try { if (s.ret && s.ret.focus) s.ret.focus({ preventScroll: true }); } catch (e) {}
    if (!silent && s.opts.onClose) s.opts.onClose();
  }
  function status(msg, kind) { if (!S) return; var el = S.host.querySelector('.shs-status'); el.textContent = msg || ''; el.setAttribute('data-kind', kind || ''); }
  function setKind(kind) {
    S.kind = kind;
    [].forEach.call(S.host.querySelectorAll('.shs-seg [data-kind]'), function (b) { var on = b.getAttribute('data-kind') === kind; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    S.host.querySelector('.shs-prev').classList.toggle('is-sticker', kind === 'sticker');
    S.host.querySelector('.shs-ink').hidden = kind !== 'sticker';
    var list = templates(S.d, kind), strip = S.host.querySelector('.shs-strip');
    var first = _chosen[S.key + '|' + kind]; if (!list.some(function (x) { return x.id === first; })) first = defaultTpl(S.d, kind);
    /* gewaehlte Standardvorlage steht vorn, die uebrigen in fester Reihenfolge */
    list = list.filter(function (x) { return x.id === first; }).concat(list.filter(function (x) { return x.id !== first; }));
    strip.innerHTML = list.map(function (tp, i) {
      return '<button type="button" role="radio" class="shs-th' + (kind === 'sticker' ? ' is-sticker' : '') + '" data-tpl="' + tp.id + '" aria-checked="' + (i === 0) + '" tabindex="' + (i ? -1 : 0) + '" aria-label="' + esc(S.t('share.tpl.' + tp.id)) + '"><span class="shs-thimg"></span><span class="shs-thl">' + esc(S.t('share.tpl.' + tp.id)) + '</span></button>';
    }).join('');
    thumbs(list);
    if (list.length) select(list[0].id, true); else status(S.t('share.none'), 'warn');
  }
  /* Vorschaubilder (klein, aus demselben Zeichner) — nacheinander, damit der erste Bildschirm sofort steht */
  function thumbs(list) {
    var tseq = S.tseq = (S.tseq || 0) + 1;
    list.forEach(function (tp, i) {
      setTimeout(function () {
        if (!S || S.tseq !== tseq) return;
        var cv = render(tp.id, thumbData(), { scale: 0.22, privacyM: S.privacyM, ink: S.ink, photo: S.photo, trim: S.kind === 'sticker' }); if (!cv) return;
        var span = S.host.querySelector('.shs-th[data-tpl="' + tp.id + '"] .shs-thimg'); if (!span) return;
        var im = new Image(); im.alt = ''; im.src = cv.toDataURL('image/png'); span.innerHTML = ''; span.appendChild(im);
      }, 30 + i * 16);
    });
  }
  function thumbData() { return S.d.photoHint ? S.d : Object.assign({}, S.d, { photoHint: S.t('share.photo_hint') }); }
  function select(id, auto) {
    S.tpl = id; S.file = null; S.blob = null;
    if (!auto) _chosen[S.key + '|' + S.kind] = id;
    [].forEach.call(S.host.querySelectorAll('.shs-th'), function (b) { var on = b.getAttribute('data-tpl') === id; b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; });
    var tp = tplById(id), priv = S.host.querySelector('.shs-priv');
    priv.hidden = !(tp && tp.route) || !!S.d.routeVirtual;
    [].forEach.call(priv.querySelectorAll('[data-priv]'), function (b) { b.setAttribute('aria-checked', +b.getAttribute('data-priv') === S.privacyM); });
    S.host.querySelector('.shs-photo').hidden = !(tp && tp.photo);
    prepare();
  }
  /* Datei vorbereiten (asynchron) — Teilen wird erst danach freigegeben. Gezeichnet in Zielaufloesung (4K: Massstab 2);
     gelingt das nicht (Speicher), einmal in 1080 × 1920 und Hinweis. */
  function prepare() {
    var seq = ++S.seq, id = S.tpl, d = thumbData(), tp = tplById(id);
    var busy = S.host.querySelector('.shs-busy'), img = S.host.querySelector('.shs-img');
    busy.hidden = false; S.host.classList.add('is-busy'); status('');
    ['share', 'copy', 'save'].forEach(function (a) { var b = S.host.querySelector('[data-act="' + a + '"]'); if (b) b.disabled = true; });
    if (tp && tp.photo && !S.photo) { busy.hidden = true; S.host.classList.remove('is-busy'); var cv0 = render(id, d, { scale: 0.4, ink: S.ink }); if (cv0) img.src = cv0.toDataURL('image/png'); status(S.t('share.photo_need'), ''); return; }
    setTimeout(function () {
      if (!S || S.seq !== seq) return;
      var o = { privacyM: S.privacyM, ink: S.ink, photo: S.photo, trim: true }, fell = false;
      var cv = null; try { cv = render(id, d, Object.assign({ scale: S.scale }, o)); } catch (e) { cv = null; }
      if ((!cv || !cv.width) && S.scale > 1) { fell = true; try { cv = render(id, d, Object.assign({ scale: 1 }, o)); } catch (e) { cv = null; } }
      if (!cv) { status(S.t('share.err_render'), 'err'); return; }
      toBlob(cv).catch(function (e) { if (S.scale > 1 && !fell) { fell = true; var c1 = render(id, d, Object.assign({ scale: 1 }, o)); cv = c1; return toBlob(c1); } throw e; }).then(function (blob) {
        if (!S || S.seq !== seq) return;
        if (S.url) URL.revokeObjectURL(S.url);
        S.blob = blob; S.url = URL.createObjectURL(blob);
        try { S.file = new File([blob], fileName(S.d, id), { type: 'image/png', lastModified: Date.now() }); } catch (e) { S.file = null; }
        img.src = S.url; img.alt = S.t('share.preview_alt', { t: S.t('share.tpl.' + id) });
        img.setAttribute('data-w', cv.width); img.setAttribute('data-h', cv.height);
        busy.hidden = true; S.host.classList.remove('is-busy');
        var cp = caps(S.file), sh = S.host.querySelector('[data-act="share"]'), cb = S.host.querySelector('[data-act="copy"]'), hint = S.host.querySelector('.shs-hint');
        sh.hidden = !cp.shareFiles; sh.disabled = !cp.shareFiles;
        cb.hidden = !(S.kind === 'sticker' && cp.copyImage); cb.disabled = cb.hidden;
        S.host.querySelector('[data-act="save"]').disabled = false;
        S.host.querySelector('[data-act="save"]').classList.toggle('shs-primary', !cp.shareFiles);
        hint.hidden = cp.shareFiles; hint.textContent = cp.shareFiles ? '' : S.t('share.no_native');
        if (fell) status(S.t('share.q_fallback'), 'warn');
        S.host.setAttribute('data-ready', id); S.host.setAttribute('data-px', cv.width + 'x' + cv.height);
      }).catch(function () { if (S && S.seq === seq) { busy.hidden = true; S.host.classList.remove('is-busy'); status(S.t('share.err_render'), 'err'); } });
    }, 16);
  }
  /* Teilen: synchron im Tipp (keine vorgeschaltete Wartezeit) */
  function doShare() {
    if (!S || !S.file) return;
    var file = S.file, t = S.t;
    var p; try { p = navigator.share({ files: [file], title: S.d.title || '' }); } catch (e) { status(t('share.err_share'), 'err'); return; }
    status(t('share.opened'), '');
    Promise.resolve(p).then(function () { if (S) status(t('share.done'), 'ok'); })
      .catch(function (e) { if (!S) return; if (e && e.name === 'AbortError') status('', ''); else status(t('share.err_share'), 'err'); });
  }
  function doSave() {
    if (!S || !S.url) return;
    var a = document.createElement('a'); a.href = S.url; a.download = fileName(S.d, S.tpl); a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    status(S.t('share.saved'), 'ok');
  }
  function doCopy() {
    if (!S || !S.blob) return;
    var t = S.t, blob = S.blob, p;
    try { p = navigator.clipboard.write([new root.ClipboardItem({ 'image/png': blob })]); } catch (e) { status(t('share.err_copy'), 'err'); return; }
    Promise.resolve(p).then(function () { if (S) status(t('share.copied'), 'ok'); }).catch(function () { if (S) status(t('share.err_copy'), 'err'); });
  }
  function onClick(ev) {
    var el = ev.target.closest('[data-act],[data-kind],[data-tpl],[data-priv],[data-ink],[data-q]'); if (!el || !S) return;
    if (el.hasAttribute('data-kind')) { if (el.getAttribute('data-kind') !== S.kind) setKind(el.getAttribute('data-kind')); return; }
    if (el.hasAttribute('data-tpl')) { if (el.getAttribute('data-tpl') !== S.tpl) select(el.getAttribute('data-tpl')); return; }
    if (el.hasAttribute('data-priv')) { S.privacyM = +el.getAttribute('data-priv'); select(S.tpl, true); return; }
    if (el.hasAttribute('data-ink')) { S.ink = el.getAttribute('data-ink'); [].forEach.call(S.host.querySelectorAll('[data-ink]'), function (b) { b.setAttribute('aria-checked', b === el); }); thumbs(templates(S.d, S.kind)); select(S.tpl, true); return; }
    if (el.hasAttribute('data-q')) { S.scale = +el.getAttribute('data-q'); [].forEach.call(S.host.querySelectorAll('[data-q]'), function (b) { b.setAttribute('aria-checked', b === el); }); select(S.tpl, true); return; }
    var a = el.getAttribute('data-act');
    if (a === 'close') close(); else if (a === 'share') doShare(); else if (a === 'save') doSave(); else if (a === 'copy') doCopy();
  }
  /* eigenes Foto: lokal lesen (Objekt-URL), nie hochladen; beim Neuzeichnen fallen Standortdaten der Datei weg */
  function onChange(ev) {
    var inp = ev.target; if (!S || !inp || !inp.getAttribute || inp.getAttribute('data-photo') !== '1') return;
    var f = inp.files && inp.files[0]; if (!f) return;
    if (S.photoUrl) { try { URL.revokeObjectURL(S.photoUrl); } catch (e) {} }
    var url = URL.createObjectURL(f), im = new Image();
    im.onload = function () { if (!S) return; S.photo = im; S.photoUrl = url; thumbs(templates(S.d, S.kind)); select('photo', false); };
    im.onerror = function () { status(S.t('share.photo_err'), 'err'); };
    im.src = url;
  }
  function onKey(ev) {
    if (!S) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); return; }
    /* Pfeiltasten in Gruppen (Karten|Aufkleber, Vorlagen, Ausblenden) */
    var grp = ev.target.closest('.shs-seg,.shs-strip,.shs-pseg');
    if (grp && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
      var bs = [].slice.call(grp.querySelectorAll('button')), i = bs.indexOf(ev.target); if (i < 0) return;
      i = (i + ((ev.key === 'ArrowRight' || ev.key === 'ArrowDown') ? 1 : -1) + bs.length) % bs.length; ev.preventDefault(); bs[i].focus(); bs[i].click(); return;
    }
    if (ev.key === 'Tab') {   /* Fokus bleibt im Dialog */
      var f = [].slice.call(S.host.querySelectorAll('button:not([hidden]):not([disabled]),[tabindex="0"]')).filter(function (x) { return x.offsetParent !== null && x.tabIndex >= 0; });
      if (!f.length) return; var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
    ev.stopPropagation();   /* Story-Tasten (← →, Leertaste) nicht ausloesen */
  }

  function wrapLines(ctx, t, maxW, lines) { return wrap(ctx, t, maxW, lines); }
  var api = { VERSION: VERSION, wrapLines: wrapLines, FONT: FONT, W: W, H: H, LOGO: LOGO, splitVal: splitVal, privacyTrim: privacyTrim, templates: templates, defaultTpl: defaultTpl, render: render, toBlob: toBlob, trimCanvas: trimCanvas,
              fileName: fileName, caps: caps, open: open, close: function () { close(); }, isOpen: function () { return !!S; }, SHARE_SVG: SHARE_SVG,
              _state: function () { return S; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA.storyShare = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
