/* ============================================================
   ORVIA · performance-input — Stufe 1 (G1) des Bauplans

   WOFÜR: Ohne erfasste Leistungswerte bleiben Intensität, Zielprognose,
   Wochenkilometer und Tagesziele bei „—" — egal wie gut die Engine dahinter
   ist. Das war der Auslöser des ganzen Umbaus. Dieses Modul ist die REINE
   Hälfte der Erfassung: Es prüft, normalisiert und baut den Eintrag. Die
   Oberfläche (js/ui.js) sammelt nur ein und speichert.

   NICHT „Erfassungsmaske", sondern EVIDENCE INPUT: Eine Maske speichert Werte.
   Hier bekommt jeder Wert seine Herkunft mit — Quelle, Datum, Belegstufe,
   Verfallsgrenze (Hülle aus js/engine/evidence.js, Stufe 0b). Ohne das müsste
   später jeder eingetragene Wert nachmigriert werden, und für die
   zwischenzeitlich erfassten Werte wäre die Herkunft nicht mehr rekonstruierbar.

   HÄRTESTE REGEL — ABLEHNEN STATT UMDEUTEN: Ein unplausibler Wert wird
   zurückgewiesen und benannt, nicht stillschweigend zurechtgebogen. Der Anlass
   ist real: „1:50" als Halbmarathon-Zielzeit meint 1 Stunde 50, „48:30" für
   10 km dagegen 48 Minuten 30. Eine frühere Fassung las beides als
   Minuten:Sekunden und machte aus 1:50 eine Halbmarathonzeit von 1,8 Minuten —
   die dann brav in Trainingszonen umgerechnet worden wäre. Aufgelöst wird das
   über Plausibilität (2–15 min/km), nicht über die Größe der Zahlen. Bleibt es
   mehrdeutig, wird gefragt statt geraten.

   DREI ZUSTÄNDE, NICHT ZWEI: `ok` · `rejected` · `needs_input`. Der dritte ist
   der wichtige — eine unvollständige Eingabe ist kein Fehler des Nutzers,
   sondern eine offene Frage.

   Kein DOM, keine Uhr, kein Zufall, kein Storage. `today` kommt herein.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'performance-input@1';

  var EV = O.evidence || (typeof require === 'function' ? (function () {
    try { return require('./evidence.js'); } catch (e) { return null; } })() : null);
  var PZ = O.performanceZones || (typeof require === 'function' ? (function () {
    try { return require('./performance-zones.js'); } catch (e) { return null; } })() : null);

  /* ---- Plausibilitätsgrenzen ----
     Bewusst weit: Sie sollen Tippfehler fangen, nicht Leistung bewerten. Wer
     wirklich 4 W/kg tritt, soll das eintragen können; wer 25 statt 250 tippt,
     soll es gesagt bekommen. [A] — Erfahrungswerte, keine Normen. */
  var LIMITS = {
    paceMinPerKm: [2, 15],      // Weltrekord ~2:35/km · sehr langsames Gehen ~15
    distanceKm: [0.2, 300],
    ftpWatts: [50, 600],
    avgWatts: [50, 800],
    avgHr: [90, 230],
    swimPer100Sec: [40, 240],
    swimDistanceM: [50, 5000],
    ageYears: 10                // älter ⇒ vermutlich Jahreszahl vertippt
  };

  function _num(x) {
    if (x == null || x === '') return null;
    var n = parseFloat(String(x).replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  var NAMED_KM = { '5k': 5, '10k': 10, hm: 21.0975, halbmarathon: 21.0975, marathon: 42.195, m: 42.195 };
  function distanceKm(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number') return raw > 0 ? raw : null;
    var s = String(raw).toLowerCase().replace(',', '.').trim();
    var named = NAMED_KM[s.replace(/[\s_-]/g, '')];
    if (named) return named;
    var m = s.match(/([\d.]+)\s*(km|k|m)\b/);
    if (m) { var n = parseFloat(m[1]); if (!(n > 0)) return null; return m[2] === 'm' ? n / 1000 : n; }
    var plain = parseFloat(s);
    return plain > 0 ? plain : null;
  }

  /* ---- Zeit lesen, ohne zu raten ----
     Liefert BEIDE Lesarten mit ihrer Plausibilität. Der Aufrufer entscheidet;
     bei Mehrdeutigkeit fragt die Oberfläche nach. Genau hier war der Fehler:
     Eine Funktion, die still eine Lesart wählt, kann nicht melden, dass sie
     geraten hat. */
  function readTime(raw, km) {
    if (raw == null || raw === '') return { ok: false, reason: 'empty' };
    if (typeof raw === 'number') return raw > 0 ? { ok: true, minutes: raw, reading: 'numeric', ambiguous: false } : { ok: false, reason: 'not_positive' };
    var s = String(raw).trim();
    if (!/^[\d:.,\s]+$/.test(s)) return { ok: false, reason: 'not_a_time' };
    var parts = s.split(':').map(function (x) { return parseFloat(String(x).replace(',', '.')); });
    if (parts.some(function (p) { return isNaN(p); })) return { ok: false, reason: 'not_a_time' };

    if (parts.length === 3) {
      var hms = parts[0] * 60 + parts[1] + parts[2] / 60;
      return hms > 0 ? { ok: true, minutes: hms, reading: 'h:m:s', ambiguous: false } : { ok: false, reason: 'not_positive' };
    }
    if (parts.length === 1) {
      return parts[0] > 0 ? { ok: true, minutes: parts[0], reading: 'minutes', ambiguous: false } : { ok: false, reason: 'not_positive' };
    }
    if (parts.length !== 2) return { ok: false, reason: 'not_a_time' };

    var asMinSec = parts[0] + parts[1] / 60;      // 48:30 → 48,5 min
    var asHourMin = parts[0] * 60 + parts[1];     // 1:50  → 110 min
    if (!(km > 0)) {
      /* Ohne Distanz ist die Lesart nicht entscheidbar. Das wird gemeldet,
         nicht überspielt. */
      return { ok: true, minutes: parts[0] < 10 ? asHourMin : asMinSec,
        reading: parts[0] < 10 ? 'h:m' : 'm:s', ambiguous: true,
        alternatives: { 'm:s': asMinSec, 'h:m': asHourMin } };
    }
    var lo = LIMITS.paceMinPerKm[0], hi = LIMITS.paceMinPerKm[1];
    var okA = (asMinSec / km) >= lo && (asMinSec / km) <= hi;
    var okB = (asHourMin / km) >= lo && (asHourMin / km) <= hi;
    if (okA && !okB) return { ok: true, minutes: asMinSec, reading: 'm:s', ambiguous: false };
    if (okB && !okA) return { ok: true, minutes: asHourMin, reading: 'h:m', ambiguous: false };
    if (!okA && !okB) {
      return { ok: false, reason: 'implausible_pace',
        detail: 'Weder als Minuten:Sekunden noch als Stunden:Minuten ergibt das eine realistische Pace ('
          + lo + '–' + hi + ' min/km).',
        alternatives: { 'm:s': Math.round((asMinSec / km) * 100) / 100, 'h:m': Math.round((asHourMin / km) * 100) / 100 } };
    }
    /* Beide plausibel — hier NICHT raten. */
    return { ok: true, minutes: asMinSec, reading: 'm:s', ambiguous: true,
      alternatives: { 'm:s': asMinSec, 'h:m': asHourMin } };
  }

  function _dateProblem(date, today) {
    if (!date) return null;                      // kein Datum ist erlaubt — es senkt nur die Frische
    var d = Date.parse(String(date).slice(0, 10) + 'T12:00:00Z');
    if (isNaN(d)) return 'date_unreadable';
    if (today) {
      var t = Date.parse(String(today).slice(0, 10) + 'T12:00:00Z');
      if (!isNaN(t)) {
        if (d > t) return 'date_in_future';
        if ((t - d) / 86400000 > LIMITS.ageYears * 365) return 'date_too_old';
      }
    }
    return null;
  }

  function _range(name, v, lim) {
    if (v == null) return null;
    if (v < lim[0] || v > lim[1]) return { field: name, reason: 'out_of_range', got: v, expected: lim };
    return null;
  }

  /* ============================================================
     WETTKAMPF ODER BESTZEIT
     ============================================================ */
  function validateRace(input, opts) {
    var i = input || {}, o = opts || {};
    var errors = [], warnings = [], needs = [];
    var sport = String(i.sportId || 'running').toLowerCase();
    var km = distanceKm(i.distance);

    if (km == null) needs.push({ field: 'distance', hint: 'Distanz fehlt (z. B. „10 km" oder „HM").' });
    var e = _range('distance', km, LIMITS.distanceKm); if (e) errors.push(e);

    var t = readTime(i.time != null && i.time !== '' ? i.time : i.timeSeconds != null ? i.timeSeconds / 60 : null, km);
    if (!t.ok && t.reason === 'empty') needs.push({ field: 'time', hint: 'Zeit fehlt.' });
    else if (!t.ok) errors.push({ field: 'time', reason: t.reason, detail: t.detail || null, alternatives: t.alternatives || null });

    if (t.ok && t.ambiguous) {
      /* Mehrdeutig ⇒ nachfragen, nicht entscheiden. Das ist die 1:50-Falle. */
      needs.push({ field: 'time', reason: 'ambiguous_reading',
        hint: 'Ist „' + i.time + '" als Minuten:Sekunden oder als Stunden:Minuten gemeint?',
        alternatives: t.alternatives });
    }

    if (t.ok && km > 0 && !t.ambiguous) {
      var pace = t.minutes / km;
      var pe = _range('pace', Math.round(pace * 100) / 100, LIMITS.paceMinPerKm);
      if (pe) errors.push({ field: 'time', reason: 'implausible_pace', got: Math.round(pace * 100) / 100, expected: LIMITS.paceMinPerKm });
    }

    var dp = _dateProblem(i.measuredAt || i.date, o.today);
    if (dp) errors.push({ field: 'measuredAt', reason: dp });
    if (!(i.measuredAt || i.date)) warnings.push({ field: 'measuredAt', reason: 'no_date',
      hint: 'Ohne Datum lässt sich nicht beurteilen, wie aktuell der Wert ist — er zählt als „ohne Datum", nicht als frisch.' });

    if (errors.length) return { status: 'rejected', errors: errors, warnings: warnings, needs: needs };
    if (needs.length) return { status: 'needs_input', errors: [], warnings: warnings, needs: needs };

    /* Wettkampf oder Test? Der Unterschied ist nicht kosmetisch — er bestimmt
       die Belegstufe und damit die Breite jeder Prognose. */
    var ctx = String(i.context || '').toLowerCase();
    var isRace = /wettkampf|race|rennen|wk/.test(ctx);
    var source = isRace ? 'race_result' : 'test';

    var hull = EV ? EV.make({
      value: Math.round(t.minutes * 60), source: source,
      measuredAt: i.measuredAt || i.date || null, today: o.today || null,
      method: (km === 21.0975 ? 'hm' : km === 42.195 ? 'marathon' : String(Math.round(km * 100) / 100) + 'km') + '_' + (isRace ? 'race' : 'test'),
      sourceId: i.sourceId || null
    }) : null;

    return {
      status: 'ok', errors: [], warnings: warnings, needs: [],
      target: 'personalBests',
      entry: {
        sportId: sport,
        distance: Math.round(km * 10000) / 10000,
        timeSeconds: Math.round(t.minutes * 60),
        context: isRace ? 'Wettkampf' : 'Test',
        measuredAt: i.measuredAt || i.date || null,
        evidence: hull
      },
      derived: { distanceKm: Math.round(km * 10000) / 10000, minutes: Math.round(t.minutes * 100) / 100,
        paceSecPerKm: Math.round((t.minutes * 60) / km), reading: t.reading },
      evidence: hull
    };
  }

  /* ============================================================
     TESTERGEBNIS — Protokolle aus performance-zones.TEST_PROTOCOLS
     ============================================================ */
  function protocolsFor(sportId) {
    if (!PZ || !PZ.TEST_PROTOCOLS) return [];
    return PZ.TEST_PROTOCOLS[String(sportId || 'running').toLowerCase()] || [];
  }
  function protocolById(sportId, id) {
    var list = protocolsFor(sportId), i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  var FIELD_LIMITS = {
    distanceKm: 'distanceKm', durationMin: null, avgWatts: 'avgWatts', avgHr: 'avgHr',
    distanceM: 'swimDistanceM', t400Sec: null, t200Sec: null
  };

  function validateTest(input, opts) {
    var i = input || {}, o = opts || {};
    var errors = [], warnings = [], needs = [];
    var sport = String(i.sportId || 'running').toLowerCase();
    var proto = protocolById(sport, i.id);
    if (!proto) return { status: 'rejected', errors: [{ field: 'id', reason: 'unknown_protocol', got: i.id }], warnings: [], needs: [] };

    /* Alle vom Protokoll verlangten Felder müssen da sein — ein Test mit halben
       Angaben ist kein Test. */
    (proto.needs || []).forEach(function (f) {
      var v = _num(i[f]);
      if (v == null) { needs.push({ field: f, hint: 'Für „' + proto.label + '" fehlt: ' + f }); return; }
      var limKey = FIELD_LIMITS[f];
      if (limKey) { var e = _range(f, v, LIMITS[limKey]); if (e) errors.push(e); }
      if (v <= 0) errors.push({ field: f, reason: 'not_positive', got: v });
    });

    /* Protokollspezifische Prüfungen, die eine reine Bereichsprüfung nicht sieht. */
    if (i.id === 'css400_200') {
      var t4 = _num(i.t400Sec), t2 = _num(i.t200Sec);
      if (t4 != null && t2 != null) {
        if (t4 <= t2) errors.push({ field: 't400Sec', reason: 'css_400_not_slower_than_200',
          detail: 'Die 400-m-Zeit muss größer sein als die 200-m-Zeit — sonst ergibt die CSS-Formel keinen Sinn.' });
        else {
          /* CSS = (400 − 200) / (t400 − t200) ist eine Geschwindigkeit in m/s.
             Sekunden je 100 m = 100 / CSS = (t400 − t200) / 2. */
          var css = (t4 - t2) / 2;
          var pe = _range('css', css, LIMITS.swimPer100Sec);
          if (pe) errors.push({ field: 't400Sec', reason: 'implausible_css', got: Math.round(css), expected: LIMITS.swimPer100Sec });
        }
      }
    }
    if (i.id === 'cooper12') {
      var d = _num(i.distanceKm);
      if (d != null && d > 0) {
        var p = 12 / d;
        if (p < LIMITS.paceMinPerKm[0] || p > LIMITS.paceMinPerKm[1]) {
          errors.push({ field: 'distanceKm', reason: 'implausible_pace', got: Math.round(p * 100) / 100,
            expected: LIMITS.paceMinPerKm,
            detail: 'In 12 Minuten diese Distanz ergäbe eine unrealistische Pace. Meintest du Meter statt Kilometer?' });
        }
      }
    }
    if (i.id === 'swim_tt') {
      var m = _num(i.distanceM);
      if (m != null && m > 0) {
        var per100 = (600 / m) * 100;
        var se = _range('per100', per100, LIMITS.swimPer100Sec);
        if (se) errors.push({ field: 'distanceM', reason: 'implausible_swim_pace', got: Math.round(per100), expected: LIMITS.swimPer100Sec });
      }
    }

    var dp = _dateProblem(i.date, o.today);
    if (dp) errors.push({ field: 'date', reason: dp });
    if (!i.date) warnings.push({ field: 'date', reason: 'no_date',
      hint: 'Ohne Datum zählt der Test als „ohne Datum" — die Alterung lässt sich dann nicht beurteilen.' });

    if (errors.length) return { status: 'rejected', errors: errors, warnings: warnings, needs: needs };
    if (needs.length) return { status: 'needs_input', errors: [], warnings: warnings, needs: needs, protocol: proto };

    var entry = { sportId: sport, id: proto.id, date: i.date || null };
    (proto.needs || []).forEach(function (f) { entry[f] = _num(i[f]); });

    var hull = EV ? EV.make({
      value: null, source: 'test', method: proto.id,
      measuredAt: i.date || null, today: o.today || null,
      /* Ein Protokoll darf eine schwächere Stufe vorgeben — die HF-Schwelle
         ohne Powermeter ist ausdrücklich nur `moderate`. */
      evidence: proto.confidence || null
    }) : null;
    if (hull) entry.evidence = hull;

    return { status: 'ok', errors: [], warnings: warnings, needs: [],
      target: 'tests', entry: entry, protocol: proto, evidence: hull };
  }

  /* ============================================================
     EINZELWERT (FTP, Schwellen-HF, 100-m-Pace)
     ============================================================ */
  var VALUE_FIELDS = {
    ftp: { sport: 'cycling', field: 'ftp', limit: 'ftpWatts', unit: 'W', label: 'FTP' },
    thresholdHr: { sport: 'cycling', field: 'thresholdHr', limit: 'avgHr', unit: 'bpm', label: 'Schwellen-HF' },
    pace100: { sport: 'swimming', field: 'pace100', limit: 'swimPer100Sec', unit: 's/100 m', label: '100-m-Pace' }
  };

  function validateValue(input, opts) {
    var i = input || {}, o = opts || {};
    var spec = VALUE_FIELDS[i.field];
    if (!spec) return { status: 'rejected', errors: [{ field: 'field', reason: 'unknown_field', got: i.field }], warnings: [], needs: [] };

    var v = i.field === 'pace100' ? (function () {
      var r = readTime(i.value, 0.1);
      return r.ok ? Math.round(r.minutes * 60) : _num(i.value);
    })() : _num(i.value);

    if (v == null) return { status: 'needs_input', errors: [], warnings: [], needs: [{ field: 'value', hint: spec.label + ' fehlt.' }] };
    var e = _range('value', v, LIMITS[spec.limit]);
    if (e) return { status: 'rejected', errors: [{ field: 'value', reason: 'out_of_range', got: v, expected: LIMITS[spec.limit], unit: spec.unit }], warnings: [], needs: [] };

    var dp = _dateProblem(i.date, o.today);
    if (dp) return { status: 'rejected', errors: [{ field: 'date', reason: dp }], warnings: [], needs: [] };

    /* Ein selbst eingetragener Einzelwert ohne Testprotokoll ist eine
       Selbstauskunft — auch wenn die Zahl aus einem Gerät stammt. Wer sie
       gemessen hat, trägt den Test ein und bekommt dafür die höhere Stufe. */
    var hull = EV ? EV.make({
      value: v, source: i.source === 'device' ? 'device' : 'self_report',
      measuredAt: i.date || null, today: o.today || null, method: spec.field
    }) : null;

    return { status: 'ok', errors: [], warnings: i.date ? [] : [{ field: 'date', reason: 'no_date' }],
      needs: [], target: 'sportField', sportId: spec.sport, field: spec.field,
      entry: { sportId: spec.sport, field: spec.field, value: v, evidence: hull }, evidence: hull };
  }

  /* ============================================================
     ABDECKUNG — „was fehlt mir?"
     Beantwortet die Frage, die den ganzen Umbau ausgelöst hat: WARUM steht da
     ein Strich. Nicht als Fehlermeldung, sondern als nächster Schritt.
     ============================================================ */
  function coverage(profile, opts) {
    var o = opts || {};
    var out = { sports: {}, anyOk: false, missing: [] };
    var res = null;
    try { res = O.performanceResolver ? O.performanceResolver.resolveAll(profile, o) : null; } catch (e) { res = null; }

    ['running', 'cycling', 'swimming'].forEach(function (s) {
      var r = res && res.sports ? res.sports[s] : null;
      var lvl = (PZ && PZ.levelForSport) ? PZ.levelForSport(profile, s) : null;
      var path = (PZ && PZ.diagnosticPathFor) ? PZ.diagnosticPathFor(s, lvl) : null;
      var ok = !!(r && r.ok);
      out.sports[s] = {
        ok: ok,
        evidence: ok ? r.confidence : 'unknown',
        freshness: ok ? r.freshness : null,
        ageDays: ok ? r.ageDays : null,
        level: lvl,
        /* Was der Nutzer konkret tun kann — je nach Sportlevel ein Test oder
           ein Wettkampfergebnis. Kein „bitte Daten ergänzen". */
        nextStep: path ? (path.primary === 'race_result' ? 'race_result' : 'test') : 'test',
        suggestion: path ? path.prompt : null,
        protocols: protocolsFor(s).map(function (p) {
          return { id: p.id, label: p.label, level: p.level, howto: p.howto, needs: p.needs };
        })
      };
      if (ok) out.anyOk = true; else out.missing.push(s);
      /* Auch ein vorhandener, aber veralteter Wert ist ein Hinweis — sonst
         merkt niemand, dass die Zonen seit einem Jahr aus derselben Zahl
         kommen. */
      if (ok && r.freshness === 'stale') out.sports[s].staleHint = true;
    });
    return out;
  }

  var api = {
    VERSION: VERSION, LIMITS: LIMITS, VALUE_FIELDS: VALUE_FIELDS,
    readTime: readTime, distanceKm: distanceKm,
    validateRace: validateRace, validateTest: validateTest, validateValue: validateValue,
    protocolsFor: protocolsFor, protocolById: protocolById,
    coverage: coverage
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.performanceInput = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
