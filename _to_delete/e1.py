p='js/run-bests.js'; s=open(p,encoding='utf-8').read()
a="  var TARGETS = [{ key: 'k1', km: 1 }, { key: 'k5', km: 5 }, { key: 'k10', km: 10 }];\n"; assert a in s
s=s.replace(a,"""  /* S1/E1 (12.09.2026): Bestzeiten je SPORT und Standarddistanz. Befund Produktionskonto: ein
     Halbmarathon (21,1 km), 20 km Rad und 400 m Schwimmen wurden nie als Bestzeit erkannt —
     TARGETS kannte nur 1/5/10 km und nur Laufen. Gleiche Fensterlogik fuer alle Sportarten
     (Runden > Messreihe > Gesamtaktivitaet), keine Hochrechnung. Schluessel: 'k' + km bzw.
     'm' + Meter (Schwimmen). */
  var SPORT_TARGETS = {
    running:  [{ key: 'k1', km: 1 }, { key: 'k5', km: 5 }, { key: 'k10', km: 10 }, { key: 'k21', km: 21.0975 }, { key: 'k42', km: 42.195 }],
    cycling:  [{ key: 'k20', km: 20 }, { key: 'k40', km: 40 }, { key: 'k90', km: 90 }, { key: 'k180', km: 180 }],
    swimming: [{ key: 'm400', km: 0.4 }, { key: 'm750', km: 0.75 }, { key: 'm1500', km: 1.5 }, { key: 'm1900', km: 1.9 }, { key: 'm3800', km: 3.8 }]
  };
  var TARGETS = SPORT_TARGETS.running;
""")
a="  function isRunning(a) { return !!(a && a.sportId != null && normSport(a.sportId) === 'running'); }\n"; assert a in s
s=s.replace(a,a+"""  /* Sportfamilie einer Aktivitaet fuer die Bestzeiten: running | cycling | swimming | null. */
  function sportFamily(a) {
    if (!a || a.sportId == null) return null;
    var n = normSport(a.sportId);
    if (n === 'running' || n === 'run' || n === 'trail_running' || n === 'treadmill_running') return 'running';
    if (n === 'cycling' || n === 'bike' || n === 'road_biking' || n === 'indoor_cycling' || n === 'virtual_ride' || n === 'gravel_cycling' || n === 'mountain_biking') return 'cycling';
    if (n === 'swimming' || n === 'swim' || n === 'lap_swimming' || n === 'open_water_swimming' || n === 'pool_swimming') return 'swimming';
    return null;
  }
""")
# measuredRunBests → measuredBests(activities, opts{sport})
a="  function measuredRunBests(activities, opts) {\n    opts = opts || {};"; assert a in s
s=s.replace(a,"""  function measuredBests(activities, opts) {
    opts = opts || {};
    var sport = opts.sport || 'running';
    var targets = Array.isArray(opts.targets) ? opts.targets : (SPORT_TARGETS[sport] || []);""")
a="    var res = { k1: null, k5: null, k10: null, scanned: 0, withSplits: 0,\n                withStreams: 0, withDerivedTime: 0, slack: slack };"; assert a in s
s=s.replace(a,"""    var res = { sport: sport, scanned: 0, withSplits: 0, withStreams: 0, withDerivedTime: 0, slack: slack };
    targets.forEach(function (t) { res[t.key] = null; });""")
a="      if (!isRunning(a)) return;\n      if (a.status && a.status !== 'completed') return;"; assert a in s
s=s.replace(a,"      if (sportFamily(a) !== sport) return;\n      if (a.status && a.status !== 'completed') return;")
a="      TARGETS.forEach(function (t) {\n        var cand = null;"; assert a in s
s=s.replace(a,"      targets.forEach(function (t) {\n        var cand = null;")
a="    return res;\n  }\n\n  var api = {"; assert a in s
s=s.replace(a,"""    return res;
  }
  /* Bisheriger Vertrag (Laufen) — unveraendert fuer bestTimes() in ui.js; kennt jetzt zusaetzlich k21/k42. */
  function measuredRunBests(activities, opts) { return measuredBests(activities, Object.assign({}, opts || {}, { sport: 'running' })); }
  /* Alle Sportfamilien auf einmal: { running: {...}, cycling: {...}, swimming: {...} }. */
  function measuredAllBests(activities, opts) {
    var out = {};
    Object.keys(SPORT_TARGETS).forEach(function (sp) { out[sp] = measuredBests(activities, Object.assign({}, opts || {}, { sport: sp })); });
    return out;
  }

  var api = {""")
a="    TARGETS: TARGETS, SLACK: SLACK,"; assert a in s
s=s.replace(a,"    TARGETS: TARGETS, SPORT_TARGETS: SPORT_TARGETS, SLACK: SLACK, sportFamily: sportFamily,\n    measuredBests: measuredBests, measuredAllBests: measuredAllBests,")
open(p,'w',encoding='utf-8').write(s); print('ok')
