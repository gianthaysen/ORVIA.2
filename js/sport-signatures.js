/* ============================================================
   ORVIA · sport-signatures (v8-446) — welche Sportart traegt welche Signatur.

   Eine Signatur ist die abstrakte Bildsprache einer Sportart (keine Illustration, kein
   Symbol): Schwimmen = Fluss, Laufen = Schritt, Rad = Drehung, Kraft = Last …
   Dieses Modul ist die EINE Stelle fuer die Zuordnung — wie activity-theme fuer die Farbe.
   Es zeichnet nichts und kennt keine Farben.

   Wahrheit ueber die Sportarten ist der Katalog (onboardingSportsLogic.SPORT_CATALOG).
   Jede Katalog-Sportart hat hier GENAU EINEN Eintrag:
     status 'implemented'  es gibt einen Zeichner (renderer), die App zeigt die Signatur
            'defined'      festgelegt, noch nicht gezeichnet — die App zeigt wie bisher nichts
            'fallback'     bewusst keine eigene Signatur; `reason` sagt warum
   Kommt eine Sportart in den Katalog, ohne hier zu stehen, schlaegt sport_signatures_test
   an und audit() meldet sie (auf einem Entwicklungsrechner auch in der Konsole).

   Drei Zustaende jeder Signatur (STATES):
     static     steht still — Rueckfall, Bildschirmfoto, „Bewegung reduzieren"
     ambient    ruhige Eigenbewegung
     reactive   echte Messwerte der Einheit steuern einen Parameter (reactiveMetric);
                `reactiveReady` sagt, ob diese Messwerte heute ueberhaupt gespeichert werden.
   Bewegung ist nie Voraussetzung, um etwas zu verstehen.

   STAND: Zuordnung fuer alle 24 Sportarten festgelegt; gezeichnet ist bisher nur Schwimmen
   (Wellenfeld, ui.js gmActWaves). Die uebrigen Zeichner sind ein eigener Schritt.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var STATES = ['static', 'ambient', 'reactive'];
  var FALLBACK_ID = 'other';

  /* family   Bildidee, mehrere Sportarten koennen sie teilen
     motion   wie sie sich in „ambient" bewegt
     reactiveMetric / reactiveReady   Messwert fuer „reactive" und ob er heute gespeichert wird
     (Stand der Datenlage: app/docs/ACTIVITY-EXPERIENCE-AUDIT.md) */
  var SIGNATURES = {
    /* Ausdauer */
    running:    { family: 'stride',     motion: 'alternating-impact',  reactiveMetric: 'cadence',     reactiveReady: false, status: 'defined',
                  note: 'Schrittfrequenz wird gespeichert, aber als halber Wert (Befund im Audit) — erst nach der Korrektur nutzbar.' },
    cycling:    { family: 'rotation',   motion: 'cadence-ring',        reactiveMetric: 'cadence',     reactiveReady: false, status: 'defined',
                  note: 'Trittfrequenz-Messreihe: der Feldname im Garmin-Abruf ist eine Annahme und am echten Abruf nicht bestaetigt.' },
    swimming:   { family: 'flow',       motion: 'waves',               reactiveMetric: 'strokeRate',  reactiveReady: false, status: 'implemented', renderer: 'waves',
                  note: 'Zugfrequenz wird vom Import nicht gelesen.' },
    rowing:     { family: 'stroke',     motion: 'drive-recover',       reactiveMetric: 'strokeRate',  reactiveReady: false, status: 'defined' },
    triathlon:  { family: 'sequence',   motion: 'three-phase',         reactiveMetric: null,          reactiveReady: false, status: 'defined',
                  note: 'Fluss → Drehung → Schritt als eine Folge; setzt die drei Einzel-Signaturen voraus.' },
    athletics:  { family: 'track',      motion: 'lane-curve',          reactiveMetric: null,          reactiveReady: false, status: 'defined' },
    /* Kraft / Hybrid */
    gym:        { family: 'load',       motion: 'tension-bars',        reactiveMetric: 'setCount',    reactiveReady: true,  status: 'defined' },
    hyrox:      { family: 'hybrid',     motion: 'run-station-blocks',  reactiveMetric: null,          reactiveReady: false, status: 'defined' },
    /* Mannschaft: eine Familie „Raum", je Sportart eine eigene Geometrie */
    football:   { family: 'space',      motion: 'pitch-lanes',         reactiveMetric: null,          reactiveReady: false, status: 'defined' },
    handball:   { family: 'space',      motion: 'arc-attack',          reactiveMetric: null,          reactiveReady: false, status: 'defined' },
    basketball: { family: 'space',      motion: 'shot-arc',            reactiveMetric: null,          reactiveReady: false, status: 'defined' },
    volleyball: { family: 'space',      motion: 'net-exchange',        reactiveMetric: null,          reactiveReady: false, status: 'defined' },
    hockey:     { family: 'space',      motion: 'glide-lanes',         reactiveMetric: null,          reactiveReady: false, status: 'defined' },
    rugby:      { family: 'space',      motion: 'phase-lines',         reactiveMetric: null,          reactiveReady: false, status: 'defined' },
    /* Rueckschlag */
    tennis:     { family: 'rally',      motion: 'baseline-exchange',   reactiveMetric: null,          reactiveReady: false, status: 'defined' },
    padel:      { family: 'reflection', motion: 'wall-rebound',        reactiveMetric: null,          reactiveReady: false, status: 'defined' },
    badminton:  { family: 'rally',      motion: 'high-arc',            reactiveMetric: null,          reactiveReady: false, status: 'defined' },
    golf:       { family: 'arc',        motion: 'single-trajectory',   reactiveMetric: null,          reactiveReady: false, status: 'defined' },
    /* Draussen */
    hiking:     { family: 'topography', motion: 'contour-lines',       reactiveMetric: 'elevation',   reactiveReady: true,  status: 'defined' },
    walking:    { family: 'stride',     motion: 'even-steps',          reactiveMetric: null,          reactiveReady: false, status: 'defined',
                  note: 'Teilt die Familie mit Laufen, eigene ruhige Bewegung — keine Kopie der Lauf-Signatur.' },
    climbing:   { family: 'ascent',     motion: 'hold-points',         reactiveMetric: null,          reactiveReady: false, status: 'defined' },
    /* Koerper & Atem */
    yoga:       { family: 'breath',     motion: 'slow-expand',         reactiveMetric: null,          reactiveReady: false, status: 'defined' },
    mobility:   { family: 'range',      motion: 'joint-arcs',          reactiveMetric: null,          reactiveReady: false, status: 'defined' },
    /* Sonstiges: bewusst KEINE eigene Bildidee — ueber eine unbekannte Sportart wird nichts behauptet */
    other:      { family: 'pulse',      motion: 'neutral-rhythm',      reactiveMetric: null,          reactiveReady: false, status: 'fallback',
                  reason: 'Sammelkategorie fuer nicht zuordenbare Aktivitaeten; eine sportartspezifische Signatur waere eine Behauptung ohne Grundlage.' }
  };

  function norm(v) {
    var raw = String(v == null ? '' : v).trim().toLowerCase();
    if (!raw) return FALLBACK_ID;
    if (SIGNATURES[raw]) return raw;                       // Katalog-ID direkt (auch die acht, die normSport auf „other" legt)
    try {
      var td = O.trainingDomain;
      if (td && td.normSport) { var c = td.normSport(raw); if (c && SIGNATURES[c]) return c; }
    } catch (e) {}
    return FALLBACK_ID;
  }
  function get(sportId) {
    var id = norm(sportId), d = SIGNATURES[id];
    return {
      sportId: id, family: d.family, motion: d.motion, status: d.status, renderer: d.renderer || null,
      reactiveMetric: d.reactiveMetric || null, reactiveReady: !!d.reactiveReady,
      note: d.note || null, reason: d.reason || null,
      /* Zustaende, die diese Signatur HEUTE anbieten kann */
      states: d.status !== 'implemented' ? [] : (d.reactiveMetric && d.reactiveReady ? STATES.slice() : STATES.slice(0, 2))
    };
  }
  function has(sportId) { var raw = String(sportId == null ? '' : sportId).trim().toLowerCase(); return Object.prototype.hasOwnProperty.call(SIGNATURES, raw); }
  /* Zeichner, den die App fuer diese Sportart HEUTE hat — sonst null. */
  function renderer(sportId) { var d = get(sportId); return d.status === 'implemented' ? d.renderer : null; }

  /* Abgleich mit dem Katalog. ids: Liste der Katalog-IDs (ohne Argument: der geladene Katalog). */
  function audit(ids) {
    var list = ids;
    if (!Array.isArray(list)) {
      var sl = O.onboardingSportsLogic;
      list = (sl && Array.isArray(sl.SPORT_CATALOG)) ? sl.SPORT_CATALOG.map(function (s) { return s.id; }) : null;
    }
    if (!list) return { ok: false, known: false, missing: [], orphan: [], count: Object.keys(SIGNATURES).length };
    var missing = list.filter(function (id) { return !has(id); });
    var orphan = Object.keys(SIGNATURES).filter(function (id) { return list.indexOf(id) < 0; });
    return { ok: missing.length === 0 && orphan.length === 0, known: true, missing: missing, orphan: orphan, count: Object.keys(SIGNATURES).length };
  }

  var api = {
    STATES: STATES.slice(), FALLBACK_ID: FALLBACK_ID,
    get: get, has: has, renderer: renderer, audit: audit,
    ids: function () { return Object.keys(SIGNATURES); },
    families: function () { var f = {}; Object.keys(SIGNATURES).forEach(function (k) { f[SIGNATURES[k].family] = true; }); return Object.keys(f); }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.sportSignatures = api;

  /* Entwicklungsrechner: eine Katalog-Sportart ohne Eintrag faellt in der Konsole auf. */
  try {
    var h = root.location && root.location.hostname;
    if (h && (h === 'localhost' || h === '127.0.0.1' || /\.(localhost|test)$/.test(h)) && root.addEventListener) {
      root.addEventListener('load', function () {
        var a = audit();
        if (a.known && !a.ok && root.console && console.warn) console.warn('[ORVIA sport-signatures] Katalog und Signaturen weichen ab', a);
      });
    }
  } catch (e) {}
})(typeof globalThis !== 'undefined' ? globalThis : this);
