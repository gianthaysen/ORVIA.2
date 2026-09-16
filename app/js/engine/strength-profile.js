/* ============================================================
   ORVIA · engine/strength-profile — Kraftprofil (S2, Prototyp v14 „scrStr")

   WOFÜR. Krafttraining liefert bisher nur Rohdaten (Sätze mit Gewicht × Wdh.).
   Dieses Modul macht daraus Aussagen: geschätztes 1RM je Übung als Zeitreihe,
   Bestwerte, Einheitenhistorie mit Δ, Stagnation, Sätze je Muskel gegen den
   Korridor, Tonnage (Woche vs. 4-Wochen-Schnitt), Balance (Druck:Zug,
   Beine:Oberkörper) und die Prognose für ein Kraftziel.

   REGELN.
   - Rein und deterministisch: Snapshots + Optionen rein, Modell raus. Kein DOM,
     kein Date.now (Stichtag wird injiziert), kein Zufall. Node-testbar.
   - e1RM nach Epley: w × (1 + reps/30). Liegt RIR vor, werden die Reserve-
     Wiederholungen mitgerechnet (w × (1 + (reps+RIR)/30)) — sonst ist die
     Schätzung bei Sätzen mit Reserve systematisch zu niedrig. Kappung:
     reps (+RIR) > 12 ⇒ keine Schätzung (Formel wird dort unscharf).
   - Datenpunkt = bester Satz je EINHEIT (echte Punkte, kein Wochenraster,
     keine erfundenen Zwischenwerte). 1RM-Tests (setType 'test') sind eigene
     Marker, zählen aber nicht als Arbeitssatz.
   - Kurve erst ab MIN_SESSIONS Einheiten (Leerzustand n/6 davor).
   - Korridore kommen aus gym-volume (individuell je Muskel), NICHT als
     pauschale 10–20-Regel — derselbe Vertrag wie die Muskelkarte.
   - Balance auf Satzbasis (Tonnage verzerrt: Beinpresse 150 kg vs. Schulter-
     drücken 40 kg), Tonnage nur ergänzend.
   - Beschwerden: mit aktivem Injury-Lead wird der Balance-Vorschlag für die
     betroffene Gruppe unterdrückt und benannt (Rückkehr-Leiter).
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  /* @2 (v8-389): Delta ist die Regressionssteigung je 4 Wochen statt des Abstands zum
     Fensterrand; Fenster haengt am letzten Datenpunkt; Stagnation an der Steigung;
     Ausbelastung (RIR) wird je Punkt ausgewiesen; Koerpergewicht tagesgenau aus dem
     Morgenbericht; Wdh.-Reihen tragen ihre Zusatzlast; Test-Satz nur als 1RM-Test, wenn
     er den besten Arbeitssatz uebertrifft; Gruppe folgt dem direkt belasteten Muskel. */
  var VERSION = 'strength-profile@2';
  var DAY = 864e5, MIN_SESSIONS = 6, REP_CAP = 12, WINDOW_WEEKS = 12, STAG_SESSIONS = 3;
  var GROUPS = [['legs', 'Beine'], ['push', 'Druck'], ['pull', 'Zug'], ['core', 'Rumpf']];
  var MUSCLE_GROUP = { quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs',
    chest: 'push', front_delts: 'push', side_delts: 'push', triceps: 'push',
    lats: 'pull', upper_back: 'pull', rear_delts: 'pull', biceps: 'pull', forearms: 'pull',
    abs: 'core', lower_back: 'core' };
  /* Namens-Fallback nur, wenn gym-volume die Übung nicht kennt (kein erfundenes Muskel-Mapping, nur die Gruppe). */
  var NAME_GROUP = [
    [/kniebeuge|squat|beinpresse|leg ?press|ausfallschritt|lunge|kreuzheben|deadlift|rdl|beinbeuger|leg ?curl|beinstrecker|leg ?ext|wade|calf|hip ?thrust|glute|bulgarian|step.?up/i, 'legs'],
    [/bank|bench|schr[aä]gbank|incline|schulterdr|overhead|ohp|military|seithe|lateral|trizeps|tricep|dips?\b|butterfly|fly|push.?up|liegest/i, 'push'],
    [/rudern|row|latzug|lat ?pull|klimmz|pull.?up|chin.?up|reverse|face ?pull|bizeps|bicep|curl|shrug|nacken/i, 'pull'],
    [/plank|st[uü]tz|crunch|ab.?roller|beinheben|leg ?raise|pallof|hyperext|r[uü]ckenstreck|core|bauch|rumpf|hollow|dead ?bug|farmer/i, 'core']
  ];
  var BW_EXERCISE = /klimmz|pull.?up|chin.?up|dips?\b|push.?up|liegest|muscle.?up/i;

  function num(v) { var n = (typeof v === 'string' && v.trim() !== '') ? +v : v; return (typeof n === 'number' && isFinite(n)) ? n : null; }
  function _d(iso) { var t = Date.parse(String(iso || '').slice(0, 10) + 'T12:00:00Z'); return isNaN(t) ? null : t; }
  function _iso(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function normKey(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function exName(ex) { return String((ex && (ex.exerciseNameSnapshot || ex.exerciseName || ex.name)) || (ex && (ex.exerciseId || ex.exercise_id)) || '').trim(); }
  function exId(ex) { return (ex && (ex.exerciseId || ex.exercise_id)) || null; }
  function setType(st) { return (st && (st.setType || st.set_type)) || 'working'; }
  function isDone(st) { return !!st && st.completed === true; }
  function setDur(st) { return st ? num(st.durationS != null ? st.durationS : (st.timeS != null ? st.timeS : st.time_s)) : null; }
  function setWeight(st) { if (!st) return null; return st.weight != null ? num(st.weight) : (st.weightKg != null ? num(st.weightKg) : null); }
  function isWork(st) { if (!isDone(st)) return false; var t = setType(st); return t === 'working' || t === 'top_set' || t === 'top' || t === 'backoff' || t === 'amrap' || t === 'dropset' || t === 'myo_reps'; }
  function isTest(st) { return isDone(st) && setType(st) === 'test'; }

  /* ---------- e1RM ---------- */
  function e1rm(weight, reps, rir) {
    var w = num(weight), r = num(reps), q = num(rir);
    if (w == null || w <= 0 || r == null || r <= 0) return { value: null, method: null, reason: 'no_data' };
    var eff = r + (q != null && q >= 0 ? Math.min(q, 5) : 0);
    if (eff > REP_CAP) return { value: null, method: null, reason: 'reps_over_cap' };
    return { value: r1(w * (1 + eff / 30)), method: q != null ? 'epley_rir' : 'epley', reason: null };
  }

  /* ---------- Gruppe einer Übung ---------- */
  function groupOf(ex, deps) {
    var gv = deps && deps.gymVolume;
    try {
      if (gv && gv.musclesFor) {
        var mus = gv.musclesFor(ex);
        if (mus) {
          /* v8-389 (S2-B6): Die Gruppe folgt dem DIREKT belasteten Muskel. Vorher wurden
             nur Koeffizienten summiert — damit konnten mehrere indirekte Anteile einen
             direkten Muskel ueberstimmen: der Rueckenstrecker traegt lower_back direkt
             (1,0 → core) gegen glutes 0,6 + hamstrings 0,5 (1,1 → legs) und stand
             deshalb unter „Beine". Folge an echten Daten: die Balance-Zeile
             „Beine : Oberkoerper" stuetzte sich ausschliesslich auf Rueckenstrecker-Saetze,
             obwohl es in neun Wochen null Beinsaetze gab — die Warnung war richtig, ihre
             Zahl nicht. Nur wenn KEIN Muskel direkt belastet wird, entscheidet die Summe. */
          var score = {}, direct = {}, best = null, bestDirect = null;
          Object.keys(mus).forEach(function (mk) {
            var g = MUSCLE_GROUP[mk]; if (!g) return;
            var raw = mus[mk], c = gv.coeffOf ? gv.coeffOf(raw) : 1;
            score[g] = (score[g] || 0) + c;
            if (raw === 'direct') direct[g] = (direct[g] || 0) + c;
          });
          Object.keys(direct).forEach(function (g) { if (!bestDirect || direct[g] > direct[bestDirect]) bestDirect = g; });
          if (bestDirect) return bestDirect;
          Object.keys(score).forEach(function (g) { if (!best || score[g] > score[best]) best = g; });
          if (best) return best;
        }
      }
    } catch (e) {}
    var n = exName(ex);
    for (var i = 0; i < NAME_GROUP.length; i++) if (NAME_GROUP[i][0].test(n)) return NAME_GROUP[i][1];
    return 'other';
  }

  /* ---------- Übungen aus Snapshots: Einheiten → bester Satz → Serie ---------- */
  /* v8-389: Koerpergewicht ist tagesabhaengig. deps.bodyweightSeries kommt aus
     profileModel.weightSeries (Morgenbericht + Profilverlauf); fehlt sie, bleibt
     der Einzelwert deps.bodyweightKg die Quelle. Nie interpoliert. */
  function bwAt(deps, date) {
    var d = deps || {};
    try {
      var PM = O.profileModel;
      if (PM && PM.bodyweightAt && d.bodyweightSeries && d.bodyweightSeries.length) {
        var hit = PM.bodyweightAt(date, d.bodyweightSeries);
        if (hit && hit.kg > 0) return hit.kg;
      }
    } catch (e) {}
    var w = num(d.bodyweightKg);
    return (w != null && w > 0) ? w : null;
  }

  function collectExercises(snapshots, deps) {
    var map = {};
    (snapshots || []).forEach(function (w) {
      var date = w && w.startedAt ? String(w.startedAt).slice(0, 10) : null; if (!date) return;
      (w.exercises || []).forEach(function (ex) {
        var name = exName(ex); if (!name) return;
        /* v8-386: Platzhalter aus dem Legacy-Tagesspeicher (nur Satzanzahl, keine Uebung) ist keine Uebung */
        if (/ohne übungsdetail|ohne uebungsdetail/i.test(name)) return;
        var key = normKey(exId(ex) || name);
        var E = map[key] || (map[key] = { id: exId(ex) || null, key: key, name: name, group: groupOf(ex, deps), sessions: [], bodyweight: BW_EXERCISE.test(name) });
        var sets = (ex.sets || []).filter(isDone).map(function (st, i) {
          return { setNumber: st.setNumber != null ? st.setNumber : (i + 1), weight: setWeight(st), reps: num(st.reps), rir: num(st.rir), rpe: num(st.rpe), type: setType(st), durationS: setDur(st), work: isWork(st), test: isTest(st) };
        });
        if (!sets.length) return;
        var s = E.sessions.filter(function (x) { return x.date === date && x.workoutId === (w.workoutId || null); })[0];
        if (!s) { s = { date: date, workoutId: w.workoutId || null, sets: [] }; E.sessions.push(s); }
        s.sets = s.sets.concat(sets);
      });
    });
    var out = Object.keys(map).map(function (k) { return finishExercise(map[k], deps); });
    out.sort(function (a, b) { return (b.sessions.length - a.sessions.length) || a.name.localeCompare(b.name); });
    return out;
  }

  function sessionBest(s, bw) {
    var work = s.sets.filter(function (x) { return x.work; });
    /* v8-385: Koerpergewichtsuebung (bw uebergeben) — e1RM nur, wenn die Mehrheit der Saetze
       Zusatzlast traegt; sonst ist der Wiederholungsrekord die ehrliche Kurve. */
    if (bw != null && bw > 0) { var loaded = work.filter(function (x) { return x.weight != null && x.weight > 0; }).length;
      if (loaded * 2 < work.length) bw = null; else bw = { bw: bw, weighted: true }; }
    var best = null, bestE = null, maxReps = null, maxDur = null, ton = 0;
    work.forEach(function (x) {
      if (x.weight != null && x.reps != null) ton += x.weight * x.reps;
      var w = x.weight;
      if (bw && bw.weighted) w = bw.bw + (x.weight || 0);            /* Systemgewicht = Koerper + Zusatzlast */
      else if (bw == null && E_BW_FLAG.on) w = null;                 /* Koerpergewicht ohne Zusatzlast: kein e1RM, Wdh.-Rekord */
      var e = e1rm(w, x.reps, x.rir);
      if (e.value != null && (bestE == null || e.value > bestE)) { bestE = e.value; best = { weight: x.weight, reps: x.reps, rir: x.rir, e1rm: e.value, method: e.method, bwBased: (x.weight == null || x.weight === 0) }; }
      if (x.reps != null && (maxReps == null || x.reps > maxReps)) maxReps = x.reps;
      if (x.durationS != null && (maxDur == null || x.durationS > maxDur)) maxDur = x.durationS;
    });
    var test = null; s.sets.filter(function (x) { return x.test && x.weight != null; }).forEach(function (x) { if (!test || x.weight > test.weight) test = { weight: x.weight, reps: x.reps }; });
    /* v8-389 (S2-B4): Zusatzlast der Einheit — die Last des Satzes mit den meisten
       Wiederholungen (0 = reines Koerpergewicht). Ohne sie ist eine Wdh.-Reihe nicht
       lesbar: 14 Wdh. ohne Zusatz und 9 Wdh. mit +10 kg sind kein Rueckschritt. */
    var addedKg = null;
    work.forEach(function (x) { if (x.reps != null && x.reps === maxReps && addedKg == null) addedKg = (x.weight != null && x.weight > 0) ? x.weight : 0; });
    return { best: best, e1rm: bestE, maxReps: maxReps, maxDur: maxDur, tonnage: Math.round(ton), work: work.length, test: test, addedKg: addedKg };
  }

  function schemeText(sets) {
    var work = sets.filter(function (x) { return x.work; }); if (!work.length) return '';
    /* Gruppierung nach Gewicht: „4×6 @ 72,5 kg", bei Wdh.-Spanne „3×6–8 @ 70 kg", Körpergewicht „2×7–8" */
    var byW = {}; work.forEach(function (x) { var k = (x.weight != null && x.weight > 0) ? String(x.weight) : 'bw'; var r = x.reps != null ? x.reps : (x.durationS != null ? x.durationS + 's' : null); var g = byW[k] || (byW[k] = { n: 0, min: null, max: null }); g.n++; if (typeof r === 'number') { g.min = g.min == null ? r : Math.min(g.min, r); g.max = g.max == null ? r : Math.max(g.max, r); } else if (r != null) { g.min = g.max = r; } });
    var top = Object.keys(byW).sort(function (a, b) { return byW[b].n - byW[a].n || (a === 'bw' ? -1 : b === 'bw' ? 1 : +b - +a); })[0];
    var g0 = byW[top], reps = g0.min == null ? '?' : (g0.min === g0.max ? String(g0.min) : g0.min + '–' + g0.max);
    var txt = g0.n + '×' + reps + (top !== 'bw' ? ' @ ' + String(top).replace('.', ',') + ' kg' : '');
    if (Object.keys(byW).length > 1) txt += ' +' + (work.length - g0.n);
    var rirs = work.map(function (x) { return x.rir; }).filter(function (v) { return v != null; });
    if (rirs.length) txt += ' · RIR ' + Math.min.apply(null, rirs);
    return txt;
  }

  var E_BW_FLAG = { on: false, anyLoaded: false };
  function finishExercise(E, deps) {
    var bw = deps && num(deps.bodyweightKg);
    E.sessions.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    E_BW_FLAG.on = !!E.bodyweight;
    /* Traegt IRGENDEIN Arbeitssatz der Uebung Zusatzlast? Entscheidet ueber Systemlast (s. sessionBest). */
    E_BW_FLAG.anyLoaded = !!E.bodyweight && E.sessions.some(function (s) {
      return s.sets.some(function (x) { return x.work && x.weight != null && x.weight > 0; });
    });
    E.sessions.forEach(function (s) { var bwDay = E.bodyweight ? (bwAt(deps, s.date) || 0) : null; var b = sessionBest(s, bwDay); s.best = b.best; s.e1rm = b.e1rm; s.maxReps = b.maxReps; s.addedKg = b.addedKg; s.maxDur = b.maxDur; s.tonnage = b.tonnage; s.workSets = b.work; s.test = b.test; s.scheme = schemeText(s.sets); });
    var withE = E.sessions.filter(function (s) { return s.e1rm != null; });
    var withReps = E.sessions.filter(function (s) { return s.maxReps != null; });
    var withDur = E.sessions.filter(function (s) { return s.maxDur != null; });
    /* Modus: load nur, wenn e1RM-Punkte fuer die Kurve reichen (>= 2) und (bei Koerpergewicht)
       die Mehrheit der Einheiten Zusatzlast hat; sonst reps/time. Schwelle zaehlt Einheiten, nicht Punkte. */
    /* v8-389 (S2-B4): Bei einer Koerpergewichtsuebung mit GEMISCHTER Zusatzlast bleibt die
       Wiederholungsachse die ehrliche Darstellung. Eine e1RM-Kurve wuerde dort nur die
       belasteten Einheiten zeigen und die uebrigen stillschweigend weglassen — bei
       Klimmzuegen mit 12/14 Wdh. ohne Zusatz und 7/9 Wdh. mit +10 kg waeren das die
       Haelfte der Einheiten. Erst wenn jede Einheit Zusatzlast traegt, ist die Last die
       gemeinsame Achse. */
    var loadedSess = E.sessions.filter(function (s) { return s.workSets > 0 && s.sets.some(function (x) { return x.work && x.weight != null && x.weight > 0; }); }).length;
    var workSess = E.sessions.filter(function (s) { return s.workSets > 0; }).length;
    var bwMixed = !!E.bodyweight && loadedSess > 0 && loadedSess < workSess;
    E.mode = (!bwMixed && withE.length >= 2 && withE.length * 2 >= E.sessions.length) ? 'load'
      : (withDur.length && !withReps.length ? 'time' : (withReps.length ? 'reps' : (withE.length && !bwMixed ? 'load' : 'none')));
    E.count = E.sessions.filter(function (s) { return s.workSets > 0; }).length;
    E.ready = E.count >= MIN_SESSIONS;
    E_BW_FLAG.on = false; E_BW_FLAG.anyLoaded = false;
    /* v8-389 (S2-B5): Schwerster Arbeitssatz der Uebung — Massstab dafuer, ob ein als
       „test" markierter Satz wirklich ein Maximalversuch war (s. exerciseModel). */
    E.heaviestWork = null;
    E.sessions.forEach(function (s) { s.sets.forEach(function (x) { if (x.work && x.weight != null && (E.heaviestWork == null || x.weight > E.heaviestWork)) E.heaviestWork = x.weight; }); });
    E.sessions.forEach(function (s) { s.testIsReal = !!(s.test && s.test.weight != null && (E.heaviestWork == null || s.test.weight > E.heaviestWork)); });
    E.tests = E.sessions.filter(function (s) { return s.test; }).map(function (s) { return { date: s.date, weight: s.test.weight }; });
    return E;
  }

  /* ---------- Übungsmodell (Serie, Δ, PRs, Historie, Stagnation) ---------- */
  /* ============================================================
     S2-B2/B3 (v8-389) · Trend statt Fensterrand.
     Bisher war Δ = aktueller Wert − ERSTER Punkt im 12-Wochen-Fenster. Das ist
     keine Entwicklung, sondern ein Abstand zu einem zufaelligen Randpunkt: liegt
     dort ein Ausreisser nach unten, meldet die Seite Fortschritt, den es nicht
     gibt (belegt an der Brustpresse: Rohdifferenz +5,4 kg, Regression +0,75 kg je
     4 Wochen ueber 9 Wochen — also Rauschen). Und weil das Fenster mitwandert,
     springt die Aussage ohne neues Training.
     trendOf() legt eine Ausgleichsgerade durch die Punkte im Fenster und gibt die
     Steigung je 4 Wochen zurueck — mit Anzahl Punkte und Spanne, damit die Seite
     sagen kann, worauf die Zahl beruht. Unter 3 Punkten oder 21 Tagen: kein Trend,
     sondern der Grund dafuer.
     ============================================================ */
  var TREND_MIN_POINTS = 3, TREND_MIN_DAYS = 21, STAG_MIN_POINTS = 4, STAG_MIN_DAYS = 28;
  function trendOf(points) {
    var pts = (points || []).filter(function (p) { return p && p.value != null && _d(p.date) != null; });
    if (pts.length < TREND_MIN_POINTS) return { ok: false, reason: 'few_points', points: pts.length };
    var t0 = _d(pts[0].date), spanDays = Math.round((_d(pts[pts.length - 1].date) - t0) / DAY);
    if (spanDays < TREND_MIN_DAYS) return { ok: false, reason: 'short_span', points: pts.length, spanDays: spanDays };
    var xs = pts.map(function (p) { return (_d(p.date) - t0) / DAY; }), ys = pts.map(function (p) { return p.value; });
    var n = xs.length, mx = xs.reduce(function (a, b) { return a + b; }, 0) / n, my = ys.reduce(function (a, b) { return a + b; }, 0) / n;
    var sxy = 0, sxx = 0;
    for (var i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); }
    if (!(sxx > 0)) return { ok: false, reason: 'no_span', points: n, spanDays: spanDays };
    var perDay = sxy / sxx;
    var known = pts.filter(function (p) { return p.effort === true; }).length;
    var per4 = r1(perDay * 28), levelRef = Math.abs(ys[ys.length - 1]) || 1;
    /* v8-389: Eine Kurve, die sich je 4 Wochen um mehr als 15 % des Niveaus bewegt, bildet
       keine Kraftanpassung ab — so schnell veraendert sich Maximalkraft nicht. Real steckt
       dahinter fast immer ein Geraetewechsel (andere Steckgewichte, anderer Hebel) oder
       stark unterschiedliche Ausbelastung. Die Zahl wird nicht unterdrueckt, aber als
       unplausibel ausgewiesen, damit die Seite sie nicht als Fortschritt verkauft. */
    var implausible = Math.abs(per4) > 0.15 * levelRef;
    return { ok: true, perDay: perDay, per4Weeks: per4, points: n, spanDays: spanDays,
      effortKnown: known, effortUnknown: n - known, implausible: implausible };
  }

  function exerciseModel(E, opts) {
    var o = opts || {}, today = _d(o.today);
    /* v8-389 (S2-B2): Das Auswertungsfenster haengt am LETZTEN Datenpunkt, nicht am
       Kalendertag. Sonst schneidet eine Trainingspause die aeltere Haelfte der Reihe
       weg und die Steigung kippt: an den echten Daten meldete das kalendergebundene
       Fenster fuer die Brustpresse +6 kg je 4 Wochen (6 Punkte ab 20.07.), waehrend
       ueber die vollen 9 Wochen +0,75 kg je 4 Wochen stehen — Rauschen. Die Pause
       selbst ist eine eigene Aussage (staleDays), keine Trendaenderung. */
    var lastDate = null;
    E.sessions.forEach(function (s) { if (s.workSets > 0 && (lastDate == null || _d(s.date) > lastDate)) lastDate = _d(s.date); });
    var anchor = (lastDate != null && today != null) ? Math.min(today, lastDate) : today;
    var from = anchor != null ? anchor - WINDOW_WEEKS * 7 * DAY : null;
    var m = { id: E.id, key: E.key, name: E.name, group: E.group, mode: E.mode, count: E.count, ready: E.ready, minSessions: MIN_SESSIONS, bodyweight: E.bodyweight,
      series: [], current: null, currentDate: null, delta: null, prs: [], history: [], stagnant: false, lastScheme: null, lastTest: null, relative: null, method: null };
    if (E.mode === 'load') {
      /* v8-389 (S2-B1): effort = der Satz, aus dem der Wert stammt, trug eine
         RIR/RPE-Angabe. Epley setzt Ausbelastung voraus; ohne die Angabe misst der
         Punkt die Anstrengungswahl, nicht die Kraft. Das gehoert an den Punkt, nicht
         in eine Fussnote. */
      m.series = E.sessions.filter(function (s) { return s.e1rm != null; }).map(function (s) { return { date: s.date, value: s.e1rm, test: !!(s.test && s.testIsReal), testWeight: s.test ? s.test.weight : null, effort: !!(s.best && (s.best.rir != null || s.best.rpe != null)) }; });
      var last = m.series[m.series.length - 1];
      m.current = last ? last.value : null; m.currentDate = last ? last.date : null;
      var lastS = E.sessions.filter(function (s) { return s.e1rm != null; }).slice(-1)[0];
      m.method = lastS && lastS.best ? lastS.best.method : null;
      m.lastScheme = lastS ? lastS.scheme : null;
      var inWin = from != null ? m.series.filter(function (p) { return _d(p.date) >= from; }) : m.series;
      if (inWin.length >= 2) { var first = inWin[0]; m.delta = { kg: r1(m.current - first.value), weeks: Math.max(1, Math.round((_d(last.date) - _d(first.date)) / DAY / 7)), from: first.date }; }
      m.trend = trendOf(inWin);
      m.effortKnown = m.series.filter(function (p) { return p.effort; }).length;
      m.effortUnknown = m.series.length - m.effortKnown;
      /* v8-389 (S2-B1): Vertrauensgrad der Steigung. Epley setzt Ausbelastung voraus.
         Tragen weniger als die Haelfte der Punkte eine RIR/RPE-Angabe, misst die Kurve
         ueberwiegend die Anstrengungswahl — die Zahl bleibt sichtbar, aber sie wird
         als das ausgewiesen, was sie ist. Unterdruecken waere ebenso unehrlich wie
         sie als Kraftzuwachs zu verkaufen. */
      if (m.trend && m.trend.ok) m.trend.confidence = (m.trend.effortKnown * 2 >= m.trend.points && m.trend.effortKnown >= 2) ? 'ok' : 'low';
      if (lastDate != null && today != null) m.staleDays = Math.max(0, Math.round((today - lastDate) / DAY));
      /* PRs */
      var bestS = null; E.sessions.forEach(function (s) { if (s.e1rm != null && (!bestS || s.e1rm > bestS.e1rm)) bestS = s; });
      var lastT = E.tests[E.tests.length - 1];
      var bestT = null; E.tests.forEach(function (t) { if (!bestT || t.weight > bestT.weight) bestT = t; });
      /* v8-389 (S2-B5): Ein als „test" markierter Satz ist nur dann ein 1RM-Test, wenn er
         schwerer war als der beste Arbeitssatz. An den echten Daten stand sonst
         „1RM-Test 7,5 kg" unter den Bestwerten des Seithebens — die LEICHTESTE je
         geloggte Last dieser Uebung (Arbeitssaetze 12,5 kg). Ein Aufwaerm- oder
         Technikversuch ist kein Rekord. */
      var testIsReal = !!(bestT && (E.heaviestWork == null || bestT.weight > E.heaviestWork));
      m.lastTest = (lastT && testIsReal) ? lastT : null;
      if (testIsReal) m.prs.push({ kind: 'test', date: bestT.date, value: bestT.weight, unit: 'kg' });
      if (bestS) m.prs.push({ kind: 'best_set', date: bestS.date, value: bestS.e1rm, unit: 'kg e1RM', detail: bestS.best ? (bestS.best.reps + ' × ' + String(bestS.best.weight).replace('.', ',') + ' kg') : null });
      var heavy = null; E.sessions.forEach(function (s) { s.sets.forEach(function (x) { if (x.work && x.weight != null && x.reps != null && (!heavy || x.weight > heavy.weight || (x.weight === heavy.weight && x.reps > heavy.reps))) heavy = { weight: x.weight, reps: x.reps, date: s.date }; }); });
      if (heavy) m.prs.push({ kind: 'heaviest', date: heavy.date, value: heavy.weight, unit: 'kg', detail: heavy.reps + ' Wdh.' });
      var wk = {}; E.sessions.forEach(function (s) { var k = isoWeek(s.date); wk[k] = (wk[k] || 0) + (s.tonnage || 0); });
      var bestW = null; Object.keys(wk).forEach(function (k) { if (!bestW || wk[k] > wk[bestW]) bestW = k; });
      if (bestW && wk[bestW] > 0) m.prs.push({ kind: 'volume_week', date: null, week: bestW, value: wk[bestW], unit: 'kg' });
      /* Historie (letzte 6 Einheiten, Δ zur Vor-Einheit) */
      var hs = E.sessions.filter(function (s) { return s.workSets > 0; });
      hs.forEach(function (s, i) { var prev = i > 0 ? hs[i - 1] : null; var d = (s.e1rm != null && prev && prev.e1rm != null) ? r1(s.e1rm - prev.e1rm) : null; m.history.push({ date: s.date, scheme: s.scheme, e1rm: s.e1rm, delta: d, tonnage: s.tonnage }); });
      m.history = m.history.slice(-6).reverse();
      /* v8-389 (S2-B3): Stagnation an der STEIGUNG, nicht an Gleichheit. Die alte
         Regel verlangte Gewicht UND Wiederholungen des ersten Satzes ueber drei
         Einheiten unveraendert — reale Saetze streuen, also feuerte sie nie (an den
         echten Daten: 0 von 6 Uebungen, obwohl die Brustpresse seit 9 Wochen auf
         80 kg steht). Jetzt: flache Ausgleichsgerade ueber mindestens 4 Punkte und
         4 Wochen gilt als Plateau. Schwelle relativ zum Niveau (1 %, mind. 0,5 kg),
         damit sie bei 40 kg und bei 140 kg dasselbe bedeutet. */
      if (m.trend && m.trend.ok && m.trend.points >= STAG_MIN_POINTS && m.trend.spanDays >= STAG_MIN_DAYS && m.current != null) {
        var flat = Math.max(0.5, Math.abs(m.current) * 0.01);
        if (Math.abs(m.trend.per4Weeks) < flat) { m.stagnant = true; m.stagnantBy = 'trend'; }
      }
      try { var SP = o.strengthProgression; if (SP && SP.isStagnant) { var hist = hs.map(function (s) { return { sets: s.sets.filter(function (x) { return x.work; }).map(function (x, i) { return { setNumber: i + 1, weight: x.weight, reps: x.reps }; }) }; }); var legacy = E.ready && SP.isStagnant(hist, 1, STAG_SESSIONS); if (legacy && !m.stagnant) { m.stagnant = true; m.stagnantBy = m.stagnantBy || 'top_set'; } } } catch (e) {}
      if (num(o.bodyweightKg) != null && o.bodyweightKg > 0 && m.current != null && !E.bodyweight && /kniebeuge|squat|kreuzheben|deadlift|bankdr|bench|schulterdr|overhead|ohp|military/i.test(E.name) && !/maschine|machine|kabel|cable|smith|kurzhantel|dumbbell/i.test(E.name)) m.relative = Math.round(m.current / o.bodyweightKg * 100) / 100;
    } else if (E.mode === 'reps') {
      m.series = E.sessions.filter(function (s) { return s.maxReps != null; }).map(function (s) { return { date: s.date, value: s.maxReps, addedKg: s.addedKg != null ? s.addedKg : 0 }; });
      var l2 = m.series[m.series.length - 1]; m.current = l2 ? l2.value : null; m.currentDate = l2 ? l2.date : null;
      m.currentLoadKg = l2 ? l2.addedKg : null;
      m.loadLevels = m.series.reduce(function (a, p) { if (a.indexOf(p.addedKg) < 0) a.push(p.addedKg); return a; }, []).sort(function (a, b) { return a - b; });
      /* Bestwert je Lastniveau — ein Rekord ohne Last ist keine Aussage. */
      var bestByLoad = {};
      m.series.forEach(function (p) { var k = String(p.addedKg); if (!bestByLoad[k] || p.value > bestByLoad[k].value) bestByLoad[k] = p; });
      Object.keys(bestByLoad).sort(function (a, b) { return +b - +a; }).forEach(function (k) {
        var p = bestByLoad[k];
        m.prs.push({ kind: 'max_reps', date: p.date, value: p.value, unit: 'Wdh.', addedKg: +k });
      });
      /* v8-389 (S2-B4): Delta NUR zwischen Punkten gleicher Zusatzlast. Vorher verglich die
         Seite 9 Wdh. mit +10 kg gegen 14 Wdh. ohne Zusatz und meldete „−5 Wdh." als
         Rueckschritt — die Last war um 10 kg gestiegen. Gibt es keinen frueheren Punkt
         derselben Last, ist die ehrliche Antwort kein Delta, sondern der Grund dafuer. */
      var inW2 = from != null ? m.series.filter(function (p) { return _d(p.date) >= from; }) : m.series;
      var sameLoad = inW2.filter(function (p) { return p.addedKg === (l2 ? l2.addedKg : 0); });
      if (sameLoad.length >= 2) {
        m.delta = { reps: m.current - sameLoad[0].value, weeks: Math.max(1, Math.round((_d(l2.date) - _d(sameLoad[0].date)) / DAY / 7)), addedKg: l2.addedKg };
      } else if (inW2.length >= 2) {
        m.deltaBlocked = 'load_changed';
        m.deltaLoadFrom = inW2[0].addedKg; m.deltaLoadTo = l2 ? l2.addedKg : null;
      }
      m.lastScheme = E.sessions.slice(-1)[0].scheme;
    } else if (E.mode === 'time') {
      m.series = E.sessions.filter(function (s) { return s.maxDur != null; }).map(function (s) { return { date: s.date, value: s.maxDur }; });
      var l3 = m.series[m.series.length - 1]; m.current = l3 ? l3.value : null; m.currentDate = l3 ? l3.date : null;
      var bestD = null; m.series.forEach(function (p) { if (!bestD || p.value > bestD.value) bestD = p; });
      if (bestD) m.prs.push({ kind: 'max_hold', date: bestD.date, value: bestD.value, unit: 's' });
    }
    return m;
  }

  function isoWeek(iso) {
    var d = new Date(iso + 'T12:00:00Z'); var day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3);
    var y = d.getUTCFullYear(); var jan4 = new Date(Date.UTC(y, 0, 4)); var wk = 1 + Math.round(((d - jan4) / DAY - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
    return y + '-W' + String(wk).padStart(2, '0');
  }
  function weekStart(ms) { var d = new Date(ms); var day = (d.getUTCDay() + 6) % 7; return ms - day * DAY; }

  /* ---------- Gruppen: harte Sätze + Tonnage (aktuelle Woche vs. 4-Wochen-Schnitt) ---------- */
  function groupStats(exercises, opts) {
    var today = _d(opts.today); var ws = weekStart(today); var prevFrom = ws - 28 * DAY;
    var out = {}; GROUPS.forEach(function (g) { out[g[0]] = { key: g[0], label: g[1], setsWeek: 0, tonnageWeek: 0, tonnageAvg4: 0, sets28: 0, sets56: 0, tonnageLast: 0 }; });
    out.other = { key: 'other', label: 'Weitere', setsWeek: 0, tonnageWeek: 0, tonnageAvg4: 0, sets28: 0, sets56: 0, tonnageLast: 0 };
    /* v8-385: Einheiten je Fenster (Balance-Fenster) und letzte Trainingswoche (Tonnage-Fallback) */
    var sess28 = {}, sess56 = {}, lastWeekStart = null;
    exercises.forEach(function (E) { E.sessions.forEach(function (s) { var t = _d(s.date); if (t == null || t > today || !s.workSets) return; var k = s.workoutId || s.date; if (t >= today - 27 * DAY) sess28[k] = 1; if (t >= today - 55 * DAY) sess56[k] = 1; var wk = weekStart(t); if (wk < ws && (lastWeekStart == null || wk > lastWeekStart)) lastWeekStart = wk; }); });
    exercises.forEach(function (E) {
      var G = out[E.group] || out.other;
      E.sessions.forEach(function (s) {
        var t = _d(s.date); if (t == null || t > today) return;
        if (t >= ws) { G.setsWeek += s.workSets; G.tonnageWeek += s.tonnage || 0; }
        else if (t >= prevFrom) { G.tonnageAvg4 += (s.tonnage || 0) / 4; }
        if (t >= today - 27 * DAY) G.sets28 += s.workSets;
        if (t >= today - 55 * DAY) G.sets56 += s.workSets;
        if (lastWeekStart != null && t >= lastWeekStart && t < lastWeekStart + 7 * DAY) G.tonnageLast += s.tonnage || 0;
      });
    });
    Object.keys(out).forEach(function (k) { out[k].tonnageWeek = Math.round(out[k].tonnageWeek); out[k].tonnageAvg4 = Math.round(out[k].tonnageAvg4); out[k].tonnageLast = Math.round(out[k].tonnageLast); });
    out._meta = { sessions28: Object.keys(sess28).length, sessions56: Object.keys(sess56).length, lastWeekStart: lastWeekStart != null ? _iso(lastWeekStart) : null, weekHasSets: GROUPS.some(function (g) { return out[g[0]].setsWeek > 0; }) || out.other.setsWeek > 0 };
    return out;
  }

  /* ---------- Sätze je Muskel (7 Tage) gegen gym-volume-Korridor ---------- */
  function muscleRows(snapshots, opts) {
    var gv = opts.gymVolume; if (!gv || !gv.computeMuscleVolume) return null;
    var today = _d(opts.today), from = today - 6 * DAY;
    var win = (snapshots || []).filter(function (w) { var t = _d(w && w.startedAt); return t != null && t >= from && t <= today; });
    var mv = gv.computeMuscleVolume(win, {});
    var dataWeeks = opts.dataWeeks != null ? opts.dataWeeks : null;
    var corr = gv.targetCorridor ? gv.targetCorridor({ goal: opts.volumeGoal || 'hypertrophy', experience: opts.experience || 'beginner', dataWeeks: dataWeeks }) : { min: null, max: null };
    var rows = [];
    (gv.MUSCLES || Object.keys(mv.byMuscle)).forEach(function (mk) {
      var m = mv.byMuscle[mk]; var eff = m ? m.effectiveSets : 0;
      var st = corr.min == null ? 'none' : (eff < corr.min ? 'under' : (eff > corr.max ? 'over' : 'ok'));
      rows.push({ muscle: mk, label: (gv.MUSCLE_LABEL && gv.MUSCLE_LABEL[mk]) || mk, group: MUSCLE_GROUP[mk] || 'other', effective: r1(eff), real: m ? m.realWorkingSets : 0, min: corr.min, max: corr.max, status: st });
    });
    return { rows: rows, corridor: corr, unclassified: Object.keys(mv.unclassified || {}) };
  }

  /* ---------- Balance (28 Tage, harte Sätze) ---------- */
  function balance(groups, opts) {
    var meta = groups._meta || { sessions28: 0, sessions56: 0 };
    var win = meta.sessions28 >= 3 ? 28 : 56, key = win === 28 ? 'sets28' : 'sets56';
    var push = groups.push[key], pull = groups.pull[key], legs = groups.legs[key], upper = push + pull;
    function ratio(a, b) { return (a > 0 && b > 0) ? Math.round(a / b * 100) / 100 : null; }
    var pp = ratio(push, pull), lu = ratio(legs, upper);
    /* v8-389 (S2-B6b): „keine Beinsaetze" ist eine AUSSAGE, kein fehlender Wert. Solange
       die Zuordnung den Rueckenstrecker zu den Beinen zaehlte, kam nie eine Null zustande;
       seit die Gruppe dem direkt belasteten Muskel folgt, schon — und dann meldete die
       Zeile „zu wenig Daten", obwohl acht Einheiten mit 84 Oberkoerpersaetzen vorliegen.
       Bei belegter Oberkoerperarbeit und null Beinsaetzen ist das Verhaeltnis 0, nicht
       unbekannt. */
    var legsZero = (legs === 0 && upper > 0);
    if (legsZero) lu = 0;
    var inj = opts.injury || null; var legsBlocked = !!(inj && inj.active && inj.policy && inj.policy.legStrength === false);
    return {
      windowDays: win, sessions: win === 28 ? meta.sessions28 : meta.sessions56,
      pushPull: { ratio: pp, a: push, b: pull, lo: 0.8, hi: 1.2, status: pp == null ? 'none' : (pp >= 0.8 && pp <= 1.2 ? 'ok' : 'att') },
      legsUpper: { ratio: lu, a: legs, b: upper, lo: 0.8, hi: 1.5, zero: legsZero, status: lu == null ? 'none' : (legsBlocked ? 'blocked' : (lu >= 0.8 ? 'ok' : 'att')), blocked: legsBlocked, injuryLabel: legsBlocked ? (inj.label || null) : null, injuryStage: legsBlocked ? inj.stage : null }
    };
  }

  /* ---------- Kraftziel-Prognose (lineare Regression, ehrlich gekennzeichnet) ---------- */
  function goalForecast(exModel, goal, opts) {
    if (!exModel || !goal) return null;
    var target = num(goal.targetValue); if (target == null || target <= 0) return null;
    var today = _d(opts.today); var from = today - WINDOW_WEEKS * 7 * DAY;
    var pts = exModel.series.filter(function (p) { return !p.test && _d(p.date) >= from; });
    var out = { target: target, current: exModel.current, gap: exModel.current != null ? r1(target - exModel.current) : null, points: pts.length, reached: exModel.current != null && exModel.current >= target, slopePer4w: null, eta: null, weeksTo: null, reason: null, targetDate: goal.targetDate || null, onTrack: null };
    if (out.reached) return out;
    var spanDays = pts.length >= 2 ? (_d(pts[pts.length - 1].date) - _d(pts[0].date)) / DAY : 0;
    if (pts.length < MIN_SESSIONS || spanDays < 28) { out.reason = 'insufficient'; return out; }
    var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    pts.forEach(function (p) { var x = (_d(p.date) - from) / DAY / 7; sx += x; sy += p.value; sxx += x * x; sxy += x * p.value; });
    var den = n * sxx - sx * sx; if (!den) { out.reason = 'insufficient'; return out; }
    var slope = (n * sxy - sx * sy) / den; /* kg je Woche */
    out.slopePer4w = r1(slope * 4);
    if (slope <= 0.05) { out.reason = 'flat'; return out; }
    var weeks = (target - exModel.current) / slope; out.weeksTo = Math.ceil(weeks); out.eta = _iso(today + Math.ceil(weeks * 7) * DAY);
    if (goal.targetDate) { var td = _d(goal.targetDate); out.onTrack = td != null ? (today + weeks * 7 * DAY <= td) : null; }
    return out;
  }

  /* Kraftziel → Übung: Titel/Kategoriedaten nennen die Übung (lift_pr „Kniebeuge 100 kg") */
  function matchGoalExercise(goal, exercises) {
    if (!goal) return null;
    var txt = normKey([goal.title, goal.name, goal.categoryData && goal.categoryData.exercise, goal.exercise].filter(Boolean).join(' '));
    if (!txt) return null;
    var hit = null; exercises.forEach(function (E) { var nk = normKey(E.name); if (nk && txt.indexOf(nk) >= 0 && (!hit || nk.length > normKey(hit.name).length)) hit = E; });
    if (hit) return hit;
    var alias = [[/kniebeuge|squat/, /kniebeuge|squat/], [/kreuzheben|deadlift/, /kreuzheben|deadlift/], [/bankdr|bench/, /bankdr|bench/], [/schulterdr|ohp|overhead/, /schulterdr|ohp|overhead/], [/klimmz|pull.?up/, /klimmz|pull.?up/]];
    for (var i = 0; i < alias.length; i++) if (alias[i][0].test(txt)) { var c = exercises.filter(function (E) { return alias[i][1].test(normKey(E.name)); })[0]; if (c) return c; }
    return null;
  }

  /* ---------- Gesamtmodell ---------- */
  function build(snapshots, opts) {
    var o = opts || {}; var today = o.today || _iso(Date.now());
    var deps = { gymVolume: o.gymVolume, bodyweightKg: num(o.bodyweightKg), bodyweightSeries: o.bodyweightSeries || null };
    /* Heutiges Gewicht kanonisch aufloesen (Reihe schlaegt Einzelwert) — relative Kraft liest es. */
    deps.bodyweightKg = bwAt(deps, today);
    var exercises = collectExercises(snapshots, deps);
    var dates = []; (snapshots || []).forEach(function (w) { var t = _d(w && w.startedAt); if (t != null) dates.push(t); });
    var dataWeeks = dates.length ? Math.max(0, Math.round((Math.max.apply(null, dates) - Math.min.apply(null, dates)) / DAY / 7)) : 0;
    var groups = groupStats(exercises, { today: today });
    var m = { version: VERSION, today: today, sessions: (snapshots || []).length, dataWeeks: dataWeeks, exercises: exercises, groups: groups,
      muscles: muscleRows(snapshots, { today: today, gymVolume: o.gymVolume, experience: o.experience, volumeGoal: o.volumeGoal, dataWeeks: dataWeeks }),
      balance: balance(groups, { injury: o.injury || null }), minSessions: MIN_SESSIONS, windowWeeks: WINDOW_WEEKS,
      strengthGoals: [] };
    (o.goals || []).forEach(function (g) {
      if (!g || (g.status && g.status !== 'active')) return;
      var fam = null; try { fam = O.profileModel && O.profileModel.canonGoalCategory ? O.profileModel.canonGoalCategory(g.category) : null; } catch (e) {}
      var isStrength = /strength|lift|hypertroph|muscle/.test(String(fam || g.category || g.family || '')) || num(g.targetValue) != null && /kg/.test(String(g.unit || ''));
      if (!isStrength) return;
      var E = matchGoalExercise(g, exercises); if (!E) { m.strengthGoals.push({ goalId: g.id, title: g.title, exercise: null, forecast: null }); return; }
      var em = exerciseModel(E, { today: today, strengthProgression: o.strengthProgression, bodyweightKg: deps.bodyweightKg });
      m.strengthGoals.push({ goalId: g.id, title: g.title, exercise: E.key, exerciseName: E.name, forecast: goalForecast(em, g, { today: today }) });
    });
    m.bodyweight = deps.bodyweightSeries && deps.bodyweightSeries.length
      ? (function () { try { var h = O.profileModel && O.profileModel.bodyweightAt ? O.profileModel.bodyweightAt(today, deps.bodyweightSeries) : null; return h || null; } catch (e) { return null; } })()
      : (deps.bodyweightKg != null ? { kg: deps.bodyweightKg, date: null, source: 'profile', ageDays: null } : null);
    m.exerciseModel = function (key) { var E = exercises.filter(function (x) { return x.key === key; })[0]; return E ? exerciseModel(E, { today: today, strengthProgression: o.strengthProgression, bodyweightKg: deps.bodyweightKg }) : null; };
    return m;
  }

  var api = { VERSION: VERSION, MIN_SESSIONS: MIN_SESSIONS, REP_CAP: REP_CAP, WINDOW_WEEKS: WINDOW_WEEKS, GROUPS: GROUPS, MUSCLE_GROUP: MUSCLE_GROUP,
    e1rm: e1rm, groupOf: groupOf, collectExercises: collectExercises, exerciseModel: exerciseModel, groupStats: groupStats, muscleRows: muscleRows, balance: balance,
    goalForecast: goalForecast, matchGoalExercise: matchGoalExercise, isoWeek: isoWeek, build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.strengthProfile = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
