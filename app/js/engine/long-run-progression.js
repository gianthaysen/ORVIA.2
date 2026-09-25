/* ============================================================
   ORVIA · engine/long-run-progression — datengetriebener Long-Run-Kandidat
   (S3 · P2, SHADOW — 25.09.2026)

   BEFUND (S3-PLANERSTELLUNG-EINGABEN.md, B3): ui.lrKm(wk) setzt bei einem
   Laufziel mit Renndatum eine feste Tabelle an — max(7, min(20, wk−2)),
   Taper 12/10/8 — ohne Leistungsstand, ohne gemessenen laengsten Lauf.
   Ein Einsteiger in Woche 3 bekommt 7 km Long Run, auch wenn sein laengster
   Lauf 3 km war. Das ist die Runna-Form ohne die Runna-Eingaben.

   DIESES MODUL RECHNET DEN KANDIDATEN aus dem, was ORVIA MISST:
     - laengster Lauf der letzten 28 Tage (Store/Garmin, distanzbasiert)
     - Leistungsstand (kanonisch: beginner|intermediate|advanced|competitive)
     - Zieldistanz und Wochen bis zum Rennen
   Regeln [A] (Produktregeln, dokumentiert, keine Messgroessen):
     1. Der naechste Long Run liegt hoechstens STEP ueber dem gemessenen
        laengsten Lauf (Einsteiger 8 %, sonst 10 %) — die verbreitete
        Steigerungsregel, hier auf die Einzeleinheit angewandt.
     2. Deckel je Zieldistanz und Stand (PEAK): 5 km 10, 10 km 14,
        HM 18/20/22, Marathon 28/32/35 (Einsteiger/Mittel/Wettkampf).
     3. Taper: 3 Wochen vor dem Rennen 70 %, 2 Wochen 55 %, Rennwoche 40 %
        des Deckels — nie mehr als der Kandidat aus Regel 1.
     4. Ohne Messung (kein Lauf in 28 Tagen): Startwert je Stand
        (5 / 8 / 12 km), Basis 'default', Konfidenz niedrig.
     5. Untergrenze FLOOR 5 km — darunter ist es kein Long Run.

   SHADOW: Dieses Modul zeigt nichts an. ui.lrKm rechnet weiter die Tabelle
   und protokolliert daneben den Kandidaten (shadowLongRun.record). Die
   Umschaltung ist eine Produktentscheidung nach Sichtung des Protokolls.

   Rein: kein DOM, keine Uhr, kein Storage (das Protokoll liegt in ui.js).
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'long-run-progression@1';
  var STEP = { beginner: 0.08, intermediate: 0.10, advanced: 0.10, competitive: 0.10 };
  var START = { beginner: 5, intermediate: 8, advanced: 8, competitive: 12 };
  var PEAK = {
    5:       { beginner: 10, intermediate: 10, advanced: 10, competitive: 10 },
    10:      { beginner: 12, intermediate: 14, advanced: 14, competitive: 14 },
    21.0975: { beginner: 18, intermediate: 20, advanced: 20, competitive: 22 },
    42.195:  { beginner: 28, intermediate: 32, advanced: 32, competitive: 35 }
  };
  var TAPER = { 3: 0.70, 2: 0.55, 1: 0.40 };
  var FLOOR = 5;
  var LEVELS = ['beginner', 'intermediate', 'advanced', 'competitive'];

  function _r1(x) { return Math.round(x * 10) / 10; }
  function _level(x) {
    var k = String(x == null ? '' : x).toLowerCase();
    if (LEVELS.indexOf(k) >= 0) return k;
    if (/anf|einsteig|wieder/.test(k)) return 'beginner';
    if (/profi|wettkampf|leistung/.test(k)) return 'competitive';
    if (/fortgeschr|erfahren|ambition/.test(k)) return 'intermediate';
    return null;
  }
  function _peakFor(raceKm, level) {
    if (!(raceKm > 0)) return null;
    var keys = Object.keys(PEAK).map(Number), best = null;
    keys.forEach(function (k) { if (best == null || Math.abs(k - raceKm) < Math.abs(best - raceKm)) best = k; });
    if (best == null || Math.abs(best - raceKm) > best * 0.15) return null;   /* keine passende Distanzklasse */
    return PEAK[best][level];
  }

  /* candidate({ level, longest28Km, raceKm, weeksToRace }) →
       { km, basis:'measured'|'default', peakKm, step, cap:'progression'|'peak'|'taper'|'floor'|'none', reasons[] }
     km null ⇒ kein Kandidat (Rennwoche/Datum vorbei oder Distanzklasse unbekannt). */
  function candidate(input) {
    var i = input || {};
    var out = { version: VERSION, km: null, basis: null, peakKm: null, step: null, cap: 'none', level: null, reasons: [] };
    var level = _level(i.level) || 'intermediate';
    out.level = level;
    if (!_level(i.level)) out.reasons.push('level_unknown_default_intermediate');
    var peak = _peakFor(i.raceKm, level);
    if (peak == null) { out.reasons.push('race_distance_unknown'); return out; }
    out.peakKm = peak;
    var wtr = (typeof i.weeksToRace === 'number' && isFinite(i.weeksToRace)) ? i.weeksToRace : null;
    if (wtr != null && wtr < 0) { out.reasons.push('race_in_past'); return out; }
    if (wtr != null && wtr < 1) { out.reasons.push('race_week'); return out; }
    var longest = (typeof i.longest28Km === 'number' && i.longest28Km > 0) ? i.longest28Km : null;
    var step = STEP[level]; out.step = step;
    var base, basis;
    if (longest != null) { base = longest * (1 + step); basis = 'measured'; out.reasons.push('from_longest_28d'); }
    else { base = START[level]; basis = 'default'; out.reasons.push('no_run_28d_default_start'); }
    var km = base, cap = 'progression';
    if (km > peak) { km = peak; cap = 'peak'; }
    if (wtr != null && wtr <= 3) {
      var tf = TAPER[Math.max(1, Math.ceil(wtr))];
      if (tf != null) { var tk = peak * tf; if (tk < km) { km = tk; cap = 'taper'; } }
    }
    if (km < FLOOR) { km = FLOOR; cap = 'floor'; }
    out.km = _r1(km); out.basis = basis; out.cap = cap;
    return out;
  }

  /* Vergleich mit der festen Tabelle (ui.lrKm-Rennpfad) — fuer das Protokoll. */
  function legacyTable(wk) {
    if (!(wk >= 1)) return null;
    if (wk >= 25) return null; if (wk >= 22) return [12, 10, 8][wk - 22];
    return Math.max(7, Math.min(20, wk - 2));
  }

  var api = { VERSION: VERSION, STEP: STEP, START: START, PEAK: PEAK, TAPER: TAPER, FLOOR: FLOOR, candidate: candidate, legacyTable: legacyTable };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.longRunProgression = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
