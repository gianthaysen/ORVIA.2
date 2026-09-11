/* ============================================================
   ORVIA · engine/goal-phase-plan — B-01, Schritt 5: Zielphase → Wochenplan

   WOFÜR. A-09 leitet aus dem Zieldatum die Phase ab (build / taper /
   race_week) und wurde bisher nur beobachtet. Der Wochenplan stand in der
   Taper- und sogar in der Rennwoche unveraendert mit Intervallen, Tempo und
   Long Run; nur die Long-Run-Kilometer (lrKm) sanken. Dieses Modul wendet die
   Phase auf einen fertigen Wochenplan an — LESEND, nicht persistierend, wie
   alignPlanToAvailability: der gespeicherte Plan bleibt unangetastet.

   REGELN (Coaching-Entscheidung, bewusst konservativ):
   - build / past / unbekannt: KEINE Aenderung. Bestandsschutz ist die
     wichtigste Regel — ohne Phase sieht die Woche aus wie heute.
   - taper (7–13 Tage): Struktur bleibt, Umfang sinkt. Harte Laufeinheiten
     werden als kurz markiert (Label-Suffix, Pace-Schluessel bleibt), lange
     Radeinheiten werden kuerzer, Kraft wird „leicht". Nichts wird geloescht —
     ein Taper ist Frische, kein Ausfall.
   - race_week (0–6 Tage): Long Run und Tempo fallen weg, EINE kurze
     Intervalleinheit bleibt als Anschwitzen, Kraft wird Mobility, lange
     Radeinheiten fallen weg. Liegt der Renntag in dieser Woche, traegt sein
     Tag die Einheit „Wettkampf" (mit Zielpace, wenn bekannt), der Vortag
     ist frei, die Tage danach sind frei (Erholung wird nicht erfunden).
   - Nur fuer Ausdauerziele (Familie run / tri / bike). Kraft-/Koerperziele
     haben kein Rennen, an dem sich eine Woche ausrichten muesste.

   Labels behalten ihre Schluesselwoerter (Long Run, Intervalle, Tempo), damit
   unitKind/unitPriority/isHardUnit in ui.js weiter richtig klassifizieren.
   REIN: kein DOM, kein Date.now — der Wochentag des Rennens kommt aus
   targetDate + today, beides injiziert.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'goal-phase-plan@2';

  var ENDURANCE = { run: 'Laufen', tri: 'Laufen', bike: 'Rad' };

  var KINDS = { interval: 1, long: 1, tempo: 1, easy: 1, gym: 1, gym_leg: 1, mob: 1, swim: 1, bike: 1, bike_long: 1, bike_hard: 1, bike_recovery: 1 };
  function _kind(it) {
    if (!it || typeof it !== 'object') return null;
    if (it.kind && KINDS[it.kind]) return it.kind;   /* B-13: Code gewinnt, Label-Raten nur Rueckfall */
    var l = String(it.l || '').toLowerCase(), d = it.d;
    if (it.t === 'Gym') return 'gym';
    if (it.t === 'Mobilität') return 'mob';
    if (it.t === 'Schwimmen') return 'swim';
    if (it.t === 'Rad') return /long/.test(l) ? 'bike_long' : (/interval/.test(l) ? 'bike_hard' : 'bike');
    if (it.t !== 'Laufen') return 'other';
    if (d === 'iv' || l.indexOf('interval') >= 0) return 'interval';
    if (d === 'lr' || l.indexOf('long') >= 0) return 'long';
    if (l.indexOf('tempo') >= 0 || l.indexOf('schwelle') >= 0) return 'tempo';
    return 'easy';
  }
  function _copy(it) { return Object.assign({}, it); }
  function _suffix(it, s) { var c = _copy(it); c.l = String(it.l || '') + s; return c; }
  function _mob() { return { t: 'Mobilität', l: 'Mobility', d: '15 min', kind: 'mob', phaseAdjusted: true }; }
  function _fmtPace(sec) { return Math.floor(sec / 60) + ':' + String(Math.round(sec % 60)).padStart(2, '0'); }

  /* Wochentag (0 = Mo) des Zieldatums, wenn es in der Woche von `today` liegt. */
  function raceDayIndex(targetDate, today) {
    if (typeof targetDate !== 'string' || typeof today !== 'string') return null;
    var a = new Date(targetDate + 'T12:00'), b = new Date(today + 'T12:00');
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    var todayIdx = (b.getDay() + 6) % 7;
    var mon = new Date(b.getTime()); mon.setDate(b.getDate() - todayIdx);
    var diff = Math.round((a - mon) / 864e5);
    return (diff >= 0 && diff <= 6) ? diff : null;
  }

  /* applyPhase(days, ctx) → { days, changed, changes[] }
       days  [7][] Wochenplan (Mo..So), Items {t,l,d,…}
       ctx   { phase, family, targetDate, today, pacePerKmSec } */
  function applyPhase(days, ctx) {
    var c = ctx || {};
    var out = { days: days, changed: false, changes: [], phase: c.phase || null, version: VERSION };
    if (!Array.isArray(days) || days.length !== 7) return out;
    var sport = ENDURANCE[c.family];
    if (!sport) return out;
    if (c.phase !== 'taper' && c.phase !== 'race_week') return out;

    var w = days.map(function (d) { return Array.isArray(d) ? d.slice() : []; });
    var changes = [];
    var note = function (day, what, it) { changes.push({ day: day, what: what, label: it ? (it.l || null) : null }); };

    if (c.phase === 'taper') {
      for (var d = 0; d < 7; d++) {
        w[d] = w[d].map(function (it) {
          var k = _kind(it);
          if (k === 'long')      { note(d, 'shortened', it); return Object.assign(_suffix(it, ' · Taper'), { phaseAdjusted: true }); }
          if (k === 'interval')  { note(d, 'shortened', it); return Object.assign(_suffix(it, ' · kurz'), { phaseAdjusted: true }); }
          if (k === 'tempo')     { note(d, 'shortened', it); return Object.assign(_suffix(it, ' · kurz'), { phaseAdjusted: true }); }
          if (k === 'bike_long') { note(d, 'shortened', it); return Object.assign(_copy(it), { l: String(it.l) + ' · Taper', d: '60–90 min', phaseAdjusted: true }); }
          if (k === 'gym')       { note(d, 'lightened', it); return Object.assign(_suffix(it, ' · leicht'), { phaseAdjusted: true }); }
          return it;
        });
      }
    } else { /* race_week */
      var keptInterval = false;
      for (var e = 0; e < 7; e++) {
        w[e] = w[e].map(function (it) {
          var k = _kind(it);
          if (k === 'long' || k === 'tempo' || k === 'bike_long' || k === 'bike_hard') { note(e, 'removed', it); return null; }
          if (k === 'interval') {
            if (keptInterval) { note(e, 'removed', it); return null; }
            keptInterval = true; note(e, 'replaced', it);
            return Object.assign(_copy(it), { l: 'Anschwitzen', d: 'iv', kind: 'interval', phaseAdjusted: true });
          }
          if (k === 'gym') { note(e, 'replaced', it); return _mob(); }
          return it;
        }).filter(Boolean);
      }
      var rd = raceDayIndex(c.targetDate, c.today);
      if (rd != null) {
        var pace = (typeof c.pacePerKmSec === 'number' && c.pacePerKmSec > 0) ? (_fmtPace(c.pacePerKmSec) + ' /km · Zielpace') : 'Zielpace';
        w[rd] = [{ t: sport, l: 'Wettkampf', d: pace, kind: 'race', race: true, phaseAdjusted: true }];
        note(rd, 'race', w[rd][0]);
        if (rd > 0 && w[rd - 1].length) { note(rd - 1, 'cleared_before_race', null); w[rd - 1] = []; }
        for (var a = rd + 1; a < 7; a++) { if (w[a].length) { note(a, 'cleared_after_race', null); w[a] = []; } }
      }
    }
    out.days = w; out.changes = changes; out.changed = changes.length > 0;
    return out;
  }

  var api = { VERSION: VERSION, applyPhase: applyPhase, raceDayIndex: raceDayIndex, ENDURANCE: ENDURANCE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.goalPhasePlan = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
