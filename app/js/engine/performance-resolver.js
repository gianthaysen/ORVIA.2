/* ============================================================
   ORVIA · engine/performance-resolver — vom PROFIL zu den Leistungszonen

   `performance-zones.js` rechnet, kennt aber das Profil nicht: Es bekommt
   Referenzleistungen hereingereicht. Dieses Modul ist die fehlende Verbindung —
   es liest ALLES, was der Nutzer eingegeben hat, und macht daraus die Eingabe
   für jede Sportart. Vorgabe des Nutzers: „Bezieh dich immer auf das komplette
   Benutzerprofil, was so eingeht, was man eingibt."

   GELESEN WERDEN (und zwar alle, nicht eine Auswahl):
     performance.personalBests[]        Bestzeiten mit Distanz, Zeit, Datum
     sports[].fields.targetTime         Zielzeit → nur `estimated`, nie mehr
     sports[].fields.raceDate/distance  Zielwettkampf als Kontext
     sports[].fields.ftp                FTP aus dem Radprofil
     sports[].fields.pace100            Schwimm-Pace je 100 m
     sports[].fields.level              Leistungsstand → steuert den Testweg
     performance.tests[]                durchgeführte Einstiegstests
     Aktivitäten                        harte Läufe als abgeleitete Referenz

   WARUM ALLE QUELLEN UND NICHT DIE BESTE: Weil „die beste" erst nach dem
   Einsammeln feststeht. Ein Wettkampf von vor acht Monaten kann schlechter sein
   als ein Test von letzter Woche — die Gewichtung aus Quelle, Distanz und Alter
   entscheidet das in performance-zones, nicht eine Vorauswahl hier.

   WAS DIESES MODUL NICHT TUT: raten. Fehlt für eine Sportart jede Referenz,
   liefert es für diese Sportart `ok:false` samt passendem Testvorschlag — und
   für die anderen trotzdem echte Zonen. Kein Alles-oder-nichts.

   Liest das Profil, schreibt nichts. Das Bezugsdatum kommt herein.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'performance-resolver@2';

  /* Distanzangaben aus dem Profil sind Freitext („10 km", „half_marathon",
     „400m"). Sie werden hier EINMAL gedeutet, statt an jeder Auswertungsstelle
     erneut. Unbekanntes ergibt null und wird verworfen — nicht geschätzt. */
  var NAMED_KM = { '5k': 5, '5km': 5, '10k': 10, '10km': 10, 'halbmarathon': 21.0975,
    'half_marathon': 21.0975, 'hm': 21.0975, 'marathon': 42.195, 'zehner': 10, 'fuenfer': 5 };
  function distanceKmOf(raw) {
    if (raw == null) return null;
    if (typeof raw === 'number') return raw > 0 ? raw : null;
    var s = String(raw).toLowerCase().replace(',', '.').trim();
    var named = NAMED_KM[s.replace(/[\s_-]/g, '')];
    if (named) return named;
    var m = s.match(/([\d.]+)\s*(km|k|m)\b/);
    if (m) { var n = parseFloat(m[1]); if (!(n > 0)) return null; return m[2] === 'm' ? n / 1000 : n; }
    var plain = parseFloat(s);
    return plain > 0 ? plain : null;
  }
  /* Zeitangaben — und hier liegt eine Falle, die beim Testen aufgefallen ist:
     „1:50" als Zielzeit fuer einen Halbmarathon meint 1 Stunde 50 Minuten,
     „48:30" fuer 10 km dagegen 48 Minuten 30 Sekunden. Dieselbe Schreibweise,
     zwei Bedeutungen. Die erste Fassung las beides als Minuten:Sekunden und
     machte aus 1:50 → 1,8 Minuten — eine Halbmarathon-Zielzeit von unter zwei
     Minuten, die dann brav in Zonen umgerechnet worden waere.

     Aufgeloest wird das NICHT ueber die Groesse der Zahlen (fehleranfaellig),
     sondern ueber Plausibilitaet: Bei bekannter Distanz gewinnt die Lesart, die
     eine realistische Pace ergibt (2–15 min/km). Bleiben beide plausibel oder
     ist keine Distanz bekannt, entscheidet die konservative Regel — bei einem
     ersten Wert unter 10 ist Stunden:Minuten gemeint. */
  var PACE_MIN = 2, PACE_MAX = 15;
  function minutesOf(raw, distanceKm) {
    if (raw == null) return null;
    if (typeof raw === 'number') return raw > 0 ? raw : null;
    var s = String(raw).trim();
    var parts = s.split(':').map(function (x) { return parseFloat(x); });
    if (parts.some(isNaN)) return null;
    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
    if (parts.length !== 2) return parts[0] > 0 ? parts[0] : null;

    var asMinSec = parts[0] + parts[1] / 60;      // 48:30 → 48,5 min
    var asHourMin = parts[0] * 60 + parts[1];     // 1:50  → 110 min
    if (distanceKm > 0) {
      var pA = asMinSec / distanceKm, pB = asHourMin / distanceKm;
      var okA = pA >= PACE_MIN && pA <= PACE_MAX, okB = pB >= PACE_MIN && pB <= PACE_MAX;
      if (okA && !okB) return asMinSec;
      if (okB && !okA) return asHourMin;
    }
    return parts[0] < 10 ? asHourMin : asMinSec;
  }
  function _sportEntry(profile, sportId) {
    var sports = (profile && profile.sports) || [];
    for (var i = 0; i < sports.length; i++) {
      if (sports[i] && String(sports[i].sportId || '').toLowerCase() === sportId) return sports[i];
    }
    return null;
  }
  function _fields(entry) { return (entry && (entry.fields || entry)) || {}; }

  /* ---- Laufreferenzen aus dem gesamten Profil ---- */
  function runningInput(profile, opts) {
    var o = opts || {};
    var races = [], workouts = [], goalTarget = null;

    var pbs = (profile && profile.performance && profile.performance.personalBests) || [];
    (Array.isArray(pbs) ? pbs : []).forEach(function (b) {
      if (!b) return;
      var sid = String(b.sportId || 'running').toLowerCase();
      if (sid && sid !== 'running') return;
      var km = distanceKmOf(b.distance);
      var min = b.timeSeconds > 0 ? b.timeSeconds / 60 : minutesOf(b.time, km);
      if (!(km > 0) || !(min > 0)) return;
      /* Bestzeit im Wettkampfkontext ist ein Wettkampf; sonst ein Test. Der
         Unterschied ist nicht kosmetisch — er bestimmt die Konfidenz. */
      var ctx = String(b.context || '').toLowerCase();
      races.push({ distanceKm: km, durationMin: min, date: b.measuredAt || null,
        kind: /wettkampf|race|rennen/.test(ctx) ? 'race' : 'test' });
    });

    /* Ausdrücklich durchgeführte Einstiegstests. */
    var tests = (profile && profile.performance && profile.performance.tests) || [];
    (Array.isArray(tests) ? tests : []).forEach(function (t) {
      if (!t || String(t.sportId || 'running').toLowerCase() !== 'running') return;
      var conv = O.performanceZones && O.performanceZones.fromTest ? O.performanceZones.fromTest('running', t) : null;
      if (conv && conv.distanceKm > 0 && conv.durationMin > 0) {
        races.push({ distanceKm: conv.distanceKm, durationMin: conv.durationMin, date: t.date || null, kind: 'test' });
      }
    });

    /* Harte Läufe aus den Aktivitäten — abgeleitet, nie gemessen. */
    (Array.isArray(o.activities) ? o.activities : []).forEach(function (a) {
      if (!a) return;
      var sid = String(a.sportId || a.sport || '').toLowerCase();
      if (sid && sid.indexOf('run') < 0 && sid !== 'running' && sid !== 'laufen') return;
      var km = a.distanceKm != null ? a.distanceKm : (a.distanceM > 0 ? a.distanceM / 1000 : null);
      var min = a.durationMin != null ? a.durationMin : (a.durationSec > 0 ? a.durationSec / 60 : null);
      if (!(km > 0) || !(min > 0)) return;
      var lbl = String(a.subType || a.label || a.name || '').toLowerCase();
      var type = /interval/.test(lbl) ? 'interval' : /tempo|schwelle/.test(lbl) ? 'tempo'
        : /long/.test(lbl) ? 'long' : 'easy';
      workouts.push({ distanceKm: km, durationMin: min, date: a.date || a.localDate || null, type: type });
    });

    /* Zielzeit — der schwächste Beleg, aber besser als gar keiner. */
    var run = _fields(_sportEntry(profile, 'running'));
    var tKm = distanceKmOf(run.distance) || distanceKmOf((profile && profile.primaryGoal) || null);
    var tMin = minutesOf(run.targetTime, tKm);
    if (tKm > 0 && tMin > 0) goalTarget = { distanceKm: tKm, targetMin: tMin };

    return { today: o.today || null, races: races, workouts: workouts, goalTarget: goalTarget,
      level: run.level || (profile && profile.level) || null };
  }

  /* ---- Rad und Schwimmen ---- */
  function cyclingInput(profile, opts) {
    var o = opts || {}, f = _fields(_sportEntry(profile, 'cycling'));
    var tests = ((profile && profile.performance && profile.performance.tests) || [])
      .filter(function (t) { return t && String(t.sportId || '').toLowerCase() === 'cycling'; });
    var latest = tests.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); })[0] || null;
    var ftp = null; var n = parseFloat(f.ftp); if (n > 0) ftp = n;
    return { today: o.today || null, test: latest, ftpWatts: ftp,
      thresholdHr: parseFloat(f.thresholdHr) > 0 ? parseFloat(f.thresholdHr) : null,
      level: f.level || null };
  }
  function swimmingInput(profile, opts) {
    var o = opts || {}, f = _fields(_sportEntry(profile, 'swimming'));
    var tests = ((profile && profile.performance && profile.performance.tests) || [])
      .filter(function (t) { return t && String(t.sportId || '').toLowerCase() === 'swimming'; });
    var latest = tests.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); })[0] || null;
    /* pace100 im Profil ist eine TRAININGS-Pace, keine Schwelle — als CSS
       verwendet wäre sie systematisch zu langsam. Sie zählt daher nur, wenn
       kein Test vorliegt, und wird in performance-zones als `estimated`
       geführt (kein `test`-Objekt ⇒ direct === null). */
    var css = null; var p = O.performanceZones ? null : null;
    var pace = f.pace100 != null ? String(f.pace100) : '';
    var mm = pace.match(/(\d+):(\d{1,2})/);
    if (mm) css = parseInt(mm[1], 10) * 60 + parseInt(mm[2], 10);
    return { today: o.today || null, test: latest, cssSecPer100: css, level: f.level || null };
  }

  /* ---- Alles auf einmal: das Leistungsbild des Nutzers ---- */
  function resolveAll(profile, opts) {
    var o = opts || {};
    var PZ = O.performanceZones;
    if (!PZ) return { ok: false, reason: 'performance_zones_missing', version: VERSION, sports: {} };
    var out = { ok: true, version: VERSION, sports: {} };
    out.sports.running = PZ.resolve(runningInput(profile, o));
    out.sports.cycling = PZ.resolveFor('cycling', cyclingInput(profile, o));
    out.sports.swimming = PZ.resolveFor('swimming', swimmingInput(profile, o));
    /* Übersicht: wofür gibt es Zonen, wofür nicht — und was fehlt jeweils. */
    out.summary = ['running', 'cycling', 'swimming'].map(function (s) {
      var r = out.sports[s];
      return { sportId: s, ok: !!r.ok, confidence: r.confidence,
        /* 0b: freshness/ageRatio statt staleness — eine Skala fuer die ganze
           Engine, gemessen gegen die quellenspezifische Grenze. */
        freshness: r.ok ? r.freshness : null,
        ageRatio: r.ok ? r.ageRatio : null,
        missing: r.ok ? null : (r.path ? r.path.prompt : r.detail) };
    });
    out.anyOk = out.summary.some(function (x) { return x.ok; });
    return out;
  }

  var api = { VERSION: VERSION, resolveAll: resolveAll,
    runningInput: runningInput, cyclingInput: cyclingInput, swimmingInput: swimmingInput,
    distanceKmOf: distanceKmOf, minutesOf: minutesOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.performanceResolver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
