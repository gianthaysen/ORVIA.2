/* ============================================================
   ORVIA · pacing-plan — Pacing-Plan aus Distanz + Zielzeit (Prototyp v14 rcCalc, S5c)
   ------------------------------------------------------------
   Negativer Split in drei Abschnitten: Anlaufen (+OFFSET s/km ueber dem
   Schnitt), Rhythmus (Schnitt), Freigeben (so schnell, dass die Gesamtzeit
   exakt aufgeht). Abschnittsgrenzen: 5 / 15 km fuer 20–30 km (v14-HM-Regel),
   sonst 25 % / 75 % der Distanz (Marathon: 10,5 / 31,6 km). Rein, kein DOM, keine Uhr. Liefert null
   fuer unbrauchbare Eingaben — nie eine erfundene Tabelle.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'pacing-plan@1';
  var OFFSET_SEC = 4;          /* Anlaufen: +4 s/km ueber dem Schnitt */
  var MIN_KM = 3, MAX_KM = 300;

  function fmtPace(s) { if (s == null || !isFinite(s)) return '—'; var m = Math.floor(s / 60), r = Math.round(s % 60); if (r === 60) { m++; r = 0; } return m + ':' + (r < 10 ? '0' : '') + r; }
  function fmtTime(s) { if (s == null || !isFinite(s)) return '—'; s = Math.round(s); var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (r < 10 ? '0' : '') + r; }
  function fmtKm(k) { return String(Math.round(k * 10) / 10).replace('.', ','); }

  function plan(distKm, totalSec, opts) {
    var o = opts || {};
    var D = Number(distKm), T = Number(totalSec);
    if (!(D >= MIN_KM && D <= MAX_KM) || !(T > 0) || !isFinite(D) || !isFinite(T)) return null;
    var avg = T / D;
    if (avg < 120 || avg > 1200) return null;      /* unter 2:00 oder ueber 20:00 /km: keine Laufvorgabe */
    var fixed = (D >= 20 && D < 30);   /* HM-Regel des Prototyps; Marathon & kurze Strecken proportional */
    var a = fixed ? 5 : Math.round(D * 0.25 * 10) / 10;
    var b = fixed ? 15 : Math.round(D * 0.75 * 10) / 10;
    var off = o.offsetSec != null ? Number(o.offsetSec) : OFFSET_SEC;
    var p1 = avg + off, p2 = avg;
    var rest = D - b;
    var p3 = (T - a * p1 - (b - a) * p2) / rest;
    if (!(p3 > 0) || p3 < avg * 0.9) return null;   /* Schlussabschnitt duerfte > 10 % schneller sein muessen: unplausibel */
    var c1 = a * p1, c2 = c1 + (b - a) * p2, c3 = T;
    var half = D / 2, h1 = half <= a ? half * p1 : (half <= b ? c1 + (half - a) * p2 : c2 + (half - b) * p3);
    return {
      version: VERSION, distanceKm: D, totalSec: T, avgSecPerKm: avg, offsetSec: off,
      segments: [
        { key: 'start', fromKm: 0, toKm: a, paceSecPerKm: p1, cumSec: c1 },
        { key: 'rhythm', fromKm: a, toKm: b, paceSecPerKm: p2, cumSec: c2 },
        { key: 'release', fromKm: b, toKm: D, paceSecPerKm: p3, cumSec: c3 }
      ],
      halves: { firstSec: h1, secondSec: T - h1, negative: (T - h1) < h1 },
      fmt: { avg: fmtPace(avg), total: fmtTime(T), h1: fmtTime(h1), h2: fmtTime(T - h1),
        segments: [[fmtKm(0) + '–' + fmtKm(a), fmtPace(p1), fmtTime(c1)], [fmtKm(a) + '–' + fmtKm(b), fmtPace(p2), fmtTime(c2)], [fmtKm(b) + '–' + fmtKm(D), fmtPace(p3), fmtTime(c3)]] }
    };
  }

  var api = { VERSION: VERSION, plan: plan, fmtPace: fmtPace, fmtTime: fmtTime, OFFSET_SEC: OFFSET_SEC };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.pacingPlan = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
