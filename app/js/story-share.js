/* ============================================================
   ORVIA · story-share (v8-456) — Teilen aus den Highlights: Story-Karten (PNG 1080 × 1920) und Aufkleber (PNG mit Alpha-Kanal)

   Grundsaetze
   - Zeichnet NUR die uebergebenen Daten (Aufrufer: ui.js gmShareData — dieselbe gepruefte Datenbasis wie die Aktivitaetsseite:
     activity-analysis / metric-eligibility, Bestzeit-Kategorie wie im Bestzeiten-Register). Dieses Modul rechnet keine Kennzahl.
   - Karte ohne Kartenkacheln: die Strecke ist eine eigene Vektorlinie. Grund: keine Lizenz-/Attributionspflicht im Export und
     kein „verunreinigtes" Canvas durch fremde Kacheln (toBlob waere sonst gesperrt).
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
  var VERSION = 'story-share@1';
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
  function routeDraw(ctx, pts, box, accent, lw, glow) {
    var P = project(pts, box);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var path = function () { ctx.beginPath(); P.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); };
    if (glow) { ctx.shadowColor = accent; ctx.shadowBlur = lw * 3; ctx.globalAlpha = 0.55; ctx.strokeStyle = accent; ctx.lineWidth = lw * 1.4; path(); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
    ctx.strokeStyle = 'rgba(3,8,14,0.55)'; ctx.lineWidth = lw * 1.75; path(); ctx.stroke();
    ctx.strokeStyle = accent; ctx.lineWidth = lw; path(); ctx.stroke();
    [[P[0], C.start], [P[P.length - 1], C.finish]].forEach(function (d) { ctx.beginPath(); ctx.arc(d[0][0], d[0][1], lw * 1.15, 0, Math.PI * 2); ctx.fillStyle = d[1]; ctx.fill(); ctx.lineWidth = lw * 0.45; ctx.strokeStyle = 'rgba(3,8,14,0.85)'; ctx.stroke(); });
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

  /* ---------- Vorlagen ---------- */
  var CARDS = [
    { id: 'hero', ok: function (d) { return d.metrics.length >= 1; } },
    { id: 'trio', ok: function (d) { return d.metrics.length >= 3; } },
    { id: 'route', ok: function (d) { return !!(d.route && d.route.length >= 2); }, route: true },
    { id: 'route_plus', ok: function (d) { return !!(d.route && d.route.length >= 2) && d.metrics.length >= 4; }, route: true },
    { id: 'pb', ok: function (d) { return !!d.pb; } },
    { id: 'summary', ok: function (d) { return d.metrics.length >= 4; } }
  ];
  var STICKERS = [
    { id: 's_main', ok: function (d) { return d.metrics.length >= 1; }, h: 520 },
    { id: 's_time', ok: function (d) { return !!byId(d, 'duration') && d.metrics[0].id !== 'duration'; }, h: 520 },
    { id: 's_rate', ok: function (d) { return !!rateOf(d); }, h: 520 },
    { id: 's_trio', ok: function (d) { return d.metrics.length >= 3; }, h: 500 },
    { id: 's_route', ok: function (d) { return !!(d.route && d.route.length >= 2); }, route: true, h: 1080 },
    { id: 's_route_stats', ok: function (d) { return !!(d.route && d.route.length >= 2) && d.metrics.length >= 2; }, route: true, h: 1460 },
    { id: 's_stats', ok: function (d) { return d.metrics.length >= 4; }, h: function (d) { return 300 + Math.ceil(Math.min(6, d.metrics.length) / 2) * 300; } },
    { id: 's_pb', ok: function (d) { return !!d.pb; }, h: 800 }
  ];
  function byId(d, id) { return d.metrics.filter(function (m) { return m.id === id; })[0] || null; }
  function rateOf(d) { var ids = d.rateIds || []; for (var i = 0; i < ids.length; i++) { var m = byId(d, ids[i]); if (m && d.metrics[0] !== m) return m; } return null; }
  function templates(d, kind) { return (kind === 'sticker' ? STICKERS : CARDS).filter(function (t) { try { return t.ok(d); } catch (e) { return false; } }); }
  function tplById(id) { return CARDS.concat(STICKERS).filter(function (t) { return t.id === id; })[0] || null; }
  function sizeOf(tpl, d) { if (!/^s_/.test(tpl.id)) return { w: W, h: H }; var h = typeof tpl.h === 'function' ? tpl.h(d) : tpl.h; return { w: W, h: h }; }

  function cardBase(ctx, d) {
    var acc = d.accent || C.gold;
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.navy1); g.addColorStop(1, C.navy0); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var rg = ctx.createRadialGradient(W * 0.5, H * 0.2, 40, W * 0.5, H * 0.2, W * 0.95); rg.addColorStop(0, hexA(acc, 0.20)); rg.addColorStop(1, hexA(acc, 0)); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    var rg2 = ctx.createRadialGradient(W * 0.5, H * 1.02, 30, W * 0.5, H * 1.02, W * 0.8); rg2.addColorStop(0, 'rgba(216,187,122,0.10)'); rg2.addColorStop(1, 'rgba(216,187,122,0)'); ctx.fillStyle = rg2; ctx.fillRect(0, 0, W, H);
    /* Kopf (unterhalb der Instagram-Kopfzeile, ~ 250 px frei) */
    logo(ctx, 92, 222, 104);
    label(ctx, d.sport, W - 96, 304, 28, acc, 'right', 4);
    ctx.font = font(70, 800); ctx.fillStyle = C.text; ctx.textAlign = 'left';
    var tl = wrap(ctx, d.title, W - 192, 2), y = 452;
    tl.forEach(function (l) { ctx.fillText(l, 96, y); y += 84; });
    ctx.font = font(34, 500); ctx.fillStyle = C.muted; ctx.fillText(d.date || '', 96, y - 84 + 58);
    var top = y - 84 + 58 + 70;
    /* Fuss (oberhalb der Instagram-Antwortzeile) */
    ctx.strokeStyle = 'rgba(216,187,122,0.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(96, 1606); ctx.lineTo(W - 96, 1606); ctx.stroke();
    ctx.font = font(28, 600); ctx.fillStyle = C.faint; ctx.textAlign = 'left'; ctx.fillText(d.footer || '', 96, 1656);
    logo(ctx, W - 96 - 52, 1618, 52 * 320 / 215 * 0.66, { markOnly: true });
    return { top: top, bottom: 1560, acc: acc };
  }
  function hexA(hex, a) { var mm = /^rgba?\(([^)]+)\)/.exec(String(hex)); if (mm) { var q = mm[1].split(',').map(function (x) { return parseFloat(x); }); return 'rgba(' + q[0] + ',' + q[1] + ',' + q[2] + ',' + a + ')'; } var h = String(hex).replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); var n = parseInt(h, 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function metricRow(ctx, list, x, y, w, acc, vpx) {
    var n = list.length, cw = w / n;
    list.forEach(function (m, i) {
      var cx = x + i * cw; if (i) { ctx.strokeStyle = 'rgba(245,242,234,0.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, y - vpx - 46); ctx.lineTo(cx, y + 10); ctx.stroke(); }
      var px = i ? cx + 28 : cx;
      label(ctx, m.label, px, y - vpx - 18, 24, C.muted, 'left', 2.5);
      valueAt(ctx, m, px, y, vpx, vpx * 0.42, C.text, acc, 'left', cw - (i ? 44 : 20));
    });
  }
  function grid(ctx, list, x, y, w, rowH, cols, acc, vpx, color) {
    var cw = w / cols;
    list.forEach(function (m, i) {
      var cx = x + (i % cols) * cw, cy = y + Math.floor(i / cols) * rowH;
      label(ctx, m.label, cx, cy, 26, color === C.text ? C.muted : 'rgba(255,255,255,0.82)', 'left', 2.5);
      valueAt(ctx, m, cx, cy + vpx + 18, vpx, vpx * 0.42, color || C.text, acc, 'left', cw - 32);
    });
  }

  var DRAW = {
    hero: function (ctx, d) {
      var b = cardBase(ctx, d), m = d.metrics[0], mid = (b.top + b.bottom) / 2;
      label(ctx, m.label, W / 2, mid - 150, 34, C.muted, 'center', 5);
      valueAt(ctx, m, W / 2, mid + 120, 300, 104, C.text, b.acc, 'center', W - 192);
      var rest = d.metrics.slice(1, 3); if (rest.length) metricRow(ctx, rest, 96, b.bottom - 20, W - 192, b.acc, 86);
    },
    trio: function (ctx, d) {
      var b = cardBase(ctx, d), list = d.metrics.slice(0, 3), step = (b.bottom - b.top) / 3;
      list.forEach(function (m, i) {
        var y = b.top + step * i + step * 0.36;
        if (i) { ctx.strokeStyle = 'rgba(245,242,234,0.10)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(96, y - 40); ctx.lineTo(W - 96, y - 40); ctx.stroke(); }
        label(ctx, m.label, 96, y + 20, 30, C.muted, 'left', 4);
        valueAt(ctx, m, 96, y + 20 + 160, 168, 64, i ? C.text : C.text, b.acc, 'left', W - 192);
      });
    },
    route: function (ctx, d, o) {
      var b = cardBase(ctx, d), rows = d.metrics.slice(0, 3), boxB = b.bottom - 230;
      var pts = o.route; if (pts) routeDraw(ctx, pts, { x: 120, y: b.top + 10, w: W - 240, h: boxB - b.top - 30 }, b.acc, 13, true);
      if (d.routeTag) { label(ctx, d.routeTag, W / 2, boxB + 10, 24, C.faint, 'center', 3); }
      metricRow(ctx, rows, 96, b.bottom - 20, W - 192, b.acc, 80);
    },
    route_plus: function (ctx, d, o) {
      var b = cardBase(ctx, d), list = d.metrics.slice(0, 6), rowsN = Math.ceil(list.length / 3), gridH = rowsN * 190, boxB = b.bottom - gridH - 60;
      var pts = o.route; if (pts) routeDraw(ctx, pts, { x: 130, y: b.top, w: W - 260, h: boxB - b.top - 30 }, b.acc, 11, true);
      if (d.routeTag) label(ctx, d.routeTag, W / 2, boxB + 4, 24, C.faint, 'center', 3);
      grid(ctx, list, 96, boxB + 70, W - 192, 190, 3, b.acc, 74, C.text);
    },
    pb: function (ctx, d) {
      var b = cardBase(ctx, d), p = d.pb, mid = (b.top + b.bottom) / 2 - 40;
      ctx.fillStyle = hexA(C.gold, 0.14); roundRect(ctx, W / 2 - 330, mid - 300, 660, 70, 35); ctx.fill();
      label(ctx, p.kicker, W / 2, mid - 253, 28, C.gold, 'center', 3.5);
      ctx.font = font(fit(ctx, p.dist, 110, 800, W - 192), 800); ctx.fillStyle = C.text; ctx.textAlign = 'center'; ctx.fillText(p.dist, W / 2, mid - 90);
      ctx.font = font(fit(ctx, p.time, 260, 850, W - 192), 850); ctx.fillStyle = b.acc; ctx.fillText(p.time, W / 2, mid + 170);
      ctx.font = font(32, 500); ctx.fillStyle = C.muted; wrap(ctx, p.sub || '', W - 240, 2).forEach(function (l, i) { ctx.fillText(l, W / 2, mid + 270 + i * 44); });
      var rest = d.metrics.slice(0, 3); if (rest.length >= 2) metricRow(ctx, rest, 96, b.bottom - 20, W - 192, b.acc, 72);
    },
    summary: function (ctx, d) {
      var b = cardBase(ctx, d), list = d.metrics.slice(0, 6), step = Math.min(170, (b.bottom - b.top) / list.length);
      list.forEach(function (m, i) {
        var y = b.top + 40 + step * i;
        ctx.strokeStyle = 'rgba(245,242,234,0.10)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(96, y + step - 46); ctx.lineTo(W - 96, y + step - 46); ctx.stroke();
        label(ctx, m.label, 96, y + 60, 28, C.muted, 'left', 3);
        valueAt(ctx, m, W - 96, y + 74, i ? 86 : 104, i ? 38 : 44, C.text, b.acc, 'right', 560);
      });
    },
    /* Aufkleber: transparenter Grund, helle Schrift mit leichtem Schatten (lesbar ueber Fotos) */
    s_main: function (ctx, d, o) { stickerVal(ctx, d.metrics[0], o.size, d); },
    s_time: function (ctx, d, o) { stickerVal(ctx, byId(d, 'duration'), o.size, d); },
    s_rate: function (ctx, d, o) { stickerVal(ctx, rateOf(d), o.size, d); },
    s_trio: function (ctx, d, o) {
      shadow(ctx); var list = d.metrics.slice(0, 3), cw = (W - 80) / 3;
      list.forEach(function (m, i) { var cx = 40 + cw * i + cw / 2; label(ctx, m.label, cx, 150, 26, 'rgba(255,255,255,0.86)', 'center', 3); valueAt(ctx, m, cx, 300, 108, 44, '#FFFFFF', d.accent, 'center', cw - 30); });
      stickerMark(ctx, o.size);
    },
    s_route: function (ctx, d, o) { if (o.route) routeDraw(ctx, o.route, { x: 90, y: 90, w: W - 180, h: o.size.h - 260 }, d.accent, 16, false); stickerMark(ctx, o.size); },
    s_route_stats: function (ctx, d, o) {
      if (o.route) routeDraw(ctx, o.route, { x: 110, y: 70, w: W - 220, h: o.size.h - 560 }, d.accent, 15, false);
      shadow(ctx); var list = d.metrics.slice(0, 3), cw = (W - 80) / list.length;
      list.forEach(function (m, i) { var cx = 40 + cw * i + cw / 2; label(ctx, m.label, cx, o.size.h - 330, 26, 'rgba(255,255,255,0.86)', 'center', 3); valueAt(ctx, m, cx, o.size.h - 190, 100, 42, '#FFFFFF', d.accent, 'center', cw - 30); });
      stickerMark(ctx, o.size);
    },
    s_stats: function (ctx, d, o) {
      shadow(ctx); ctx.font = font(44, 800); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left'; ctx.fillText(wrap(ctx, d.title, W - 160, 1)[0] || '', 80, 130);
      ctx.font = font(30, 600); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(d.date || '', 80, 182);
      grid(ctx, d.metrics.slice(0, 6), 80, 300, W - 160, 300, 2, d.accent, 112, '#FFFFFF');
      stickerMark(ctx, o.size);
    },
    s_pb: function (ctx, d, o) {
      shadow(ctx); var p = d.pb;
      label(ctx, p.kicker, W / 2, 140, 32, C.gold, 'center', 4);
      ctx.font = font(fit(ctx, p.dist, 104, 800, W - 120), 800); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.fillText(p.dist, W / 2, 290);
      ctx.font = font(fit(ctx, p.time, 250, 850, W - 120), 850); ctx.fillStyle = d.accent; ctx.fillText(p.time, W / 2, 540);
      ctx.font = font(30, 600); ctx.fillStyle = 'rgba(255,255,255,0.86)'; ctx.fillText(wrap(ctx, p.sub || '', W - 160, 1)[0] || '', W / 2, 620);
      stickerMark(ctx, o.size);
    }
  };
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function shadow(ctx) { ctx.shadowColor = 'rgba(0,0,0,0.38)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 2; }
  function stickerVal(ctx, m, size, d) {
    if (!m) return; shadow(ctx);
    label(ctx, m.label, W / 2, 140, 34, 'rgba(255,255,255,0.88)', 'center', 5);
    valueAt(ctx, m, W / 2, 360, 230, 82, '#FFFFFF', d.accent, 'center', W - 100);
    stickerMark(ctx, size);
  }
  function stickerMark(ctx, size) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 10; logo(ctx, W / 2 - 92, size.h - 96, 56, { mono: 'rgba(255,255,255,0.92)' }); ctx.restore(); }

  /* render(tplId, data, opts) → Canvas in Exportgroesse (opts.scale fuer Vorschaubilder). opts.privacyM: ausgeblendete Meter je Ende. */
  function render(tplId, d, opts) {
    opts = opts || {}; var tpl = tplById(tplId); if (!tpl || !DRAW[tpl.id]) return null;
    if (!d.accent) d = Object.assign({}, d, { accent: C.gold });
    var size = sizeOf(tpl, d), sc = opts.scale || 1;
    var cv = (opts.canvas) || (typeof document !== 'undefined' ? document.createElement('canvas') : null); if (!cv) return null;
    cv.width = Math.round(size.w * sc); cv.height = Math.round(size.h * sc);
    var ctx = cv.getContext('2d'); ctx.setTransform(sc, 0, 0, sc, 0, 0); ctx.clearRect(0, 0, size.w, size.h); ctx.textBaseline = 'alphabetic';
    var route = tpl.route ? (d.routeVirtual ? validPts(d.route) : privacyTrim(d.route, opts.privacyM || 0)) : null;
    if (tpl.route && route && route.length < 2) route = null;
    DRAW[tpl.id](ctx, d, { size: size, route: route });
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
    S = { host: host, d: d, opts: opts, t: t, kind: 'card', tpl: null, privacyM: d.routeVirtual ? 0 : (opts.privacyM != null ? opts.privacyM : 200), file: null, blob: null, url: null, seq: 0, ret: opts.returnFocus || document.activeElement, thumbs: {} };
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
            '<div class="shs-priv" hidden><span id="shsPrivL">' + esc(t('share.privacy')) + '</span><div class="shs-pseg" role="radiogroup" aria-labelledby="shsPrivL">' +
              [0, 200, 500].map(function (m) { return '<button type="button" role="radio" data-priv="' + m + '" aria-checked="false">' + esc(m ? t('share.privacy_m', { m: m }) : t('share.privacy_off')) + '</button>'; }).join('') + '</div>' +
              '<small>' + esc(t('share.privacy_note')) + '</small></div>' +
            '<div class="shs-act">' +
              '<button type="button" class="shs-btn shs-primary" data-act="share" hidden>' + SHARE_SVG + '<span>' + esc(t('share.share')) + '</span></button>' +
              '<button type="button" class="shs-btn" data-act="copy" hidden><span>' + esc(t('share.copy')) + '</span></button>' +
              '<button type="button" class="shs-btn" data-act="save"><span>' + esc(t('share.save')) + '</span></button>' +
            '</div>' +
            '<p class="shs-status" role="status" aria-live="polite"></p>' +
            '<p class="shs-hint" hidden></p>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(host);
    host.addEventListener('click', onClick);
    host.addEventListener('keydown', onKey);
    setKind('card');
    requestAnimationFrame(function () { host.classList.add('on'); var f = host.querySelector('.shs-seg [aria-selected="true"]'); if (f) f.focus(); });
    return { close: close };
  }
  function close(silent) {
    if (!S) return; var s = S; S = null;
    try { if (s.url) URL.revokeObjectURL(s.url); Object.keys(s.thumbs).forEach(function (k) { URL.revokeObjectURL(s.thumbs[k]); }); } catch (e) {}
    s.host.remove();
    try { if (s.ret && s.ret.focus) s.ret.focus({ preventScroll: true }); } catch (e) {}
    if (!silent && s.opts.onClose) s.opts.onClose();
  }
  function status(msg, kind) { if (!S) return; var el = S.host.querySelector('.shs-status'); el.textContent = msg || ''; el.setAttribute('data-kind', kind || ''); }
  function setKind(kind) {
    S.kind = kind;
    [].forEach.call(S.host.querySelectorAll('.shs-seg [data-kind]'), function (b) { var on = b.getAttribute('data-kind') === kind; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    S.host.querySelector('.shs-prev').classList.toggle('is-sticker', kind === 'sticker');
    var list = templates(S.d, kind), strip = S.host.querySelector('.shs-strip');
    strip.innerHTML = list.map(function (tp, i) {
      return '<button type="button" role="radio" class="shs-th' + (kind === 'sticker' ? ' is-sticker' : '') + '" data-tpl="' + tp.id + '" aria-checked="' + (i === 0) + '" tabindex="' + (i ? -1 : 0) + '" aria-label="' + esc(S.t('share.tpl.' + tp.id)) + '"><span class="shs-thimg"></span><span class="shs-thl">' + esc(S.t('share.tpl.' + tp.id)) + '</span></button>';
    }).join('');
    /* Vorschaubilder (klein, aus demselben Zeichner) — nacheinander, damit der erste Bildschirm sofort steht */
    var tseq = S.tseq = (S.tseq || 0) + 1;
    list.forEach(function (tp, i) {
      setTimeout(function () {
        if (!S || S.tseq !== tseq) return;
        var cv = render(tp.id, S.d, { scale: 0.22, privacyM: S.privacyM }); if (!cv) return;
        var span = S.host.querySelector('.shs-th[data-tpl="' + tp.id + '"] .shs-thimg'); if (!span) return;
        var im = new Image(); im.alt = ''; im.src = cv.toDataURL('image/png'); span.innerHTML = ''; span.appendChild(im);
      }, 30 + i * 16);
    });
    if (list.length) select(list[0].id); else status(S.t('share.none'), 'warn');
  }
  function select(id) {
    S.tpl = id; S.file = null; S.blob = null;
    [].forEach.call(S.host.querySelectorAll('.shs-th'), function (b) { var on = b.getAttribute('data-tpl') === id; b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; });
    var tp = tplById(id), priv = S.host.querySelector('.shs-priv');
    priv.hidden = !(tp && tp.route) || !!S.d.routeVirtual;
    [].forEach.call(priv.querySelectorAll('[data-priv]'), function (b) { b.setAttribute('aria-checked', +b.getAttribute('data-priv') === S.privacyM); });
    prepare();
  }
  /* Datei vorbereiten (asynchron) — Teilen wird erst danach freigegeben */
  function prepare() {
    var seq = ++S.seq, id = S.tpl, d = S.d;
    var busy = S.host.querySelector('.shs-busy'), img = S.host.querySelector('.shs-img');
    busy.hidden = false; S.host.classList.add('is-busy'); status('');
    ['share', 'copy', 'save'].forEach(function (a) { var b = S.host.querySelector('[data-act="' + a + '"]'); if (b) b.disabled = true; });
    setTimeout(function () {
      if (!S || S.seq !== seq) return;
      var cv = render(id, d, { privacyM: S.privacyM });
      if (!cv) { status(S.t('share.err_render'), 'err'); return; }
      toBlob(cv).then(function (blob) {
        if (!S || S.seq !== seq) return;
        if (S.url) URL.revokeObjectURL(S.url);
        S.blob = blob; S.url = URL.createObjectURL(blob);
        try { S.file = new File([blob], fileName(d, id), { type: 'image/png', lastModified: Date.now() }); } catch (e) { S.file = null; }
        img.src = S.url; img.alt = S.t('share.preview_alt', { t: S.t('share.tpl.' + id) });
        img.setAttribute('data-w', cv.width); img.setAttribute('data-h', cv.height);
        busy.hidden = true; S.host.classList.remove('is-busy');
        var cp = caps(S.file), sh = S.host.querySelector('[data-act="share"]'), cb = S.host.querySelector('[data-act="copy"]'), hint = S.host.querySelector('.shs-hint');
        sh.hidden = !cp.shareFiles; sh.disabled = !cp.shareFiles;
        cb.hidden = !(S.kind === 'sticker' && cp.copyImage); cb.disabled = cb.hidden;
        S.host.querySelector('[data-act="save"]').disabled = false;
        S.host.querySelector('[data-act="save"]').classList.toggle('shs-primary', !cp.shareFiles);
        hint.hidden = cp.shareFiles; hint.textContent = cp.shareFiles ? '' : S.t('share.no_native');
        S.host.setAttribute('data-ready', id);
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
    var el = ev.target.closest('[data-act],[data-kind],[data-tpl],[data-priv]'); if (!el || !S) return;
    if (el.hasAttribute('data-kind')) { if (el.getAttribute('data-kind') !== S.kind) setKind(el.getAttribute('data-kind')); return; }
    if (el.hasAttribute('data-tpl')) { if (el.getAttribute('data-tpl') !== S.tpl) select(el.getAttribute('data-tpl')); return; }
    if (el.hasAttribute('data-priv')) { S.privacyM = +el.getAttribute('data-priv'); select(S.tpl); return; }
    var a = el.getAttribute('data-act');
    if (a === 'close') close(); else if (a === 'share') doShare(); else if (a === 'save') doSave(); else if (a === 'copy') doCopy();
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
  var api = { VERSION: VERSION, wrapLines: wrapLines, FONT: FONT, W: W, H: H, LOGO: LOGO, splitVal: splitVal, privacyTrim: privacyTrim, templates: templates, render: render, toBlob: toBlob,
              fileName: fileName, caps: caps, open: open, close: function () { close(); }, isOpen: function () { return !!S; }, SHARE_SVG: SHARE_SVG,
              _state: function () { return S; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA.storyShare = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
