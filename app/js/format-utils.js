/* ============================================================
   ORVIA · format-utils.js — reine, testbare Format-/Datums-Helfer.
   Kein DOM, kein Storage, keine Nebenwirkungen. Wird VOR ui.js geladen.
   Node-Tests: supabase/tests/format_utils_test.mjs
   ============================================================ */
(function (g) {
  'use strict';
  g.ORVIA = g.ORVIA || {};
  var F = g.ORVIA.fmt = g.ORVIA.fmt || {};

  /* Gültiger Datumsinput? null/undefined/''/false → false. 0 und andere
     Zahlen werden NICHT als Epoche interpretiert (ORVIA nutzt ISO-Strings) —
     new Date(null) === 1970 war Ursache des „2953 Wo"-Fehlers. */
  F.isValidDateInput = function (v) {
    if (v == null || v === '' || v === false) return false;
    if (typeof v === 'number') return false; /* keine Unix-Zeitstempel im Datenmodell */
    var d = new Date(v);
    return Number.isFinite(d.getTime());
  };

  /* Tage zwischen zwei ISO-Datumskeys (Anker 12:00, DST-sicher).
     Ungültige Eingabe → null (nie 1970-Arithmetik). */
  F.daysBetween = function (fromKey, toKey) {
    if (!F.isValidDateInput(fromKey) || !F.isValidDateInput(toKey)) return null;
    var a = new Date(String(fromKey).slice(0, 10) + 'T12:00');
    var b = new Date(String(toKey).slice(0, 10) + 'T12:00');
    if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return null;
    return Math.round((b - a) / 864e5);
  };

  /* Wochenlabel einer Phase {from,to}. Offener Anfang (from==null) → 'offen'.
     Unplausible Spannen (>400 Tage) → '—' statt „2953 Wo". */
  F.phaseWeeksLabel = function (p) {
    if (!p) return '—';
    if (p.from == null || p.from === '') return F.isValidDateInput(p.to) ? 'offen' : '—';
    var days = F.daysBetween(p.from, p.to);
    if (days == null) return '—';
    days += 1; /* inklusiv */
    if (days <= 0 || days > 400) return '—';
    return Math.max(1, Math.round(days / 7)) + ' Wo';
  };

  /* Wochen bis zum Ziel — dynamisch, nie Literal.
     → {state:'future'|'today'|'past'|'invalid', weeks:number|null, days:number|null} */
  F.weeksToGoal = function (raceDateKey, todayKey) {
    if (!F.isValidDateInput(raceDateKey) || !F.isValidDateInput(todayKey)) {
      return { state: 'invalid', weeks: null, days: null };
    }
    var d = F.daysBetween(todayKey, raceDateKey);
    if (d == null) return { state: 'invalid', weeks: null, days: null };
    if (d === 0) return { state: 'today', weeks: 0, days: 0 };
    if (d < 0) return { state: 'past', weeks: Math.ceil(-d / 7), days: d };
    return { state: 'future', weeks: Math.ceil(d / 7), days: d };
  };

  /* Relative Zeit aus echtem Zeitstempel (ms oder ISO). now injizierbar (Tests).
     Ungültig/fehlend → null (Aufrufer entscheidet über den NA-Zustand).
     Leichter Clock-Skew in der Zukunft (≤2 min) → 'gerade eben'; mehr → null. */
  F.fmtRelTime = function (ts, nowMs) {
    if (ts == null || ts === '') return null;
    var t = (typeof ts === 'number') ? ts : Date.parse(ts);
    if (!Number.isFinite(t)) return null;
    var now = (typeof nowMs === 'number') ? nowMs : Date.now();
    var diff = now - t;
    if (diff < -120000) return null;          /* echte Zukunft: kein „vor …" erfinden */
    if (diff < 90000) return 'gerade eben';
    var min = Math.round(diff / 60000);
    if (min < 60) return 'vor ' + min + ' Min';
    var h = Math.round(min / 60);
    if (h < 48) return 'vor ' + h + ' Std';
    var d = Math.round(h / 24);
    return 'vor ' + d + (d === 1 ? ' Tag' : ' Tagen');
  };

  /* --------- Einheitliches Zustandsmodell für datenhaltige Felder ---------
     status: 'ready' | 'loading' | 'unavailable' | 'error' | 'stale'
     0 ist ein echter Wert; '—' ist NUR die Darstellung eines klaren
     Nichtverfügbarkeitszustands, nie ein stiller Fallback. */
  F.field = function (o) {
    o = o || {};
    var st = o.status;
    if (st !== 'ready' && st !== 'loading' && st !== 'unavailable' && st !== 'error' && st !== 'stale') {
      st = (o.value != null) ? 'ready' : 'unavailable';
    }
    var disp;
    if (st === 'ready' || st === 'stale') {
      disp = (o.displayValue != null) ? String(o.displayValue)
        : (o.value != null ? String(o.value) : '—') + (o.unit ? o.unit : '');
    } else if (st === 'loading') disp = '…';
    else disp = '—';
    return {
      status: st, value: (st === 'ready' || st === 'stale') ? o.value : null,
      displayValue: disp, unit: o.unit || null, source: o.source || null,
      updatedAt: o.updatedAt || null, reason: o.reason || null,
      confidence: (o.confidence != null ? o.confidence : null)
    };
  };

  /* Wochenstart (Montag) als ISO-Key für ein Datum/Key — deutsche Wochenlogik. */
  F.mondayKey = function (key) {
    if (!F.isValidDateInput(key)) return null;
    var d = new Date(String(key).slice(0, 10) + 'T12:00');
    var wd = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - wd);
    var m = (d.getMonth() + 1), day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
