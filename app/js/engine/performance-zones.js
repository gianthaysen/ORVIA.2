/* ============================================================
   ORVIA · engine/performance-zones — Ebene 2: was kann dieser Körper abrufen?

   DER ENGPASS, DEN DIESES MODUL SCHLIESST:
   Im Plan stand bei jeder Laufeinheit „—". Nicht weil die Anzeige fehlte, sondern
   weil die Zahl nicht existierte. Ohne Schwellenwert gibt es keine Zielpace, keine
   Zonen, keine Wochenkilometer, keine Zielprognose und keine Tagesziele — all das
   sind Ableitungen aus EINER Größe, die bisher nirgends bestimmt wurde.

   WAS EINE REFERENZLEISTUNG IST: eine Distanz mit einer Zeit, die der Athlet
   wirklich gelaufen ist. Daraus lässt sich über die Riegel-Beziehung auf andere
   Distanzen schließen (`calc.js:riegel`, Exponent 1.06) und daraus wiederum das
   vollständige Zonenmodell ableiten (`calc.js:paceZones`). Beide Rechnungen sind
   im Projekt vorhanden und geprüft — dieses Modul liefert ihnen die EINGABE und
   sagt, wie belastbar sie ist.

   DIE KONFIDENZ IST DER EIGENTLICHE INHALT. Eine Zielpace aus einem echten
   10-km-Wettkampf von letzter Woche ist etwas völlig anderes als eine aus einem
   Trainingslauf von vor acht Monaten — auch wenn beide dieselbe Zahl ergeben.
   Wer diesen Unterschied nicht mitführt, baut aus einer Schätzung eine Vorgabe.
   Deshalb trägt jede abgeleitete Größe hier ihre Herkunft und ihr Alter mit:

     strong     Wettkampf oder ausdrücklicher Test          → volle Aussagekraft
     moderate   harter Trainingslauf (Tempo/Intervall/Long)  → belastbar, aber
                                                               tendenziell zu langsam
     weak       aus Profilangaben (Zielzeit, Selbsteinschätzung) → NUR Startpunkt
     unknown    keine verwertbare Referenz                   → KEINE Zonen

   MIGRATION (2026-08-07, Bauplan Stufe 0b): Dieses Modul sprach bisher
   measured/derived/estimated/none. Ab jetzt gilt ausschliesslich die vierstufige
   Skala aus js/engine/evidence.js — strong/moderate/weak/unknown — damit nicht
   zwei Taxonomien nebeneinander stehen und auf einem Bildschirm „stark" und
   „gemessen" dasselbe meinen, aber verschieden aussehen. Das alte Vokabular ist
   ENTFERNT, nicht ergaenzt.

   ALTER ist ab 0b relativ zur quellenspezifischen Grenze (`staleAfter`), nicht
   in festen Tagesschwellen: Ein Wettkampfergebnis altert anders als eine
   Selbstauskunft. Die Feinheit steckt in `ageRatio`, nicht in einem Etikett.

   `unknown` liefert bewusst kein Ergebnis statt eines vorsichtigen Schätzwerts. Ein
   erfundener Zonenbereich sieht genauso aus wie ein gemessener und wäre damit
   gefährlicher als das ehrliche „—", das er ersetzt.

   ALTERUNG: Leistung ist verderblich. Eine Referenz älter als ein halbes Jahr
   verliert an Aussagekraft, nach einem Jahr gilt sie nur noch als Anhaltspunkt.
   Das wird nicht weggerundet, sondern als `freshness` + `ageRatio` mitgeführt.

   PUR: keine Uhr aus dem System (das Bezugsdatum kommt herein), kein Zufall,
   kein DOM, kein Storage.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'performance-zones@2';

  /* Herkunftsvertrag (0b). In Node liegt er nicht auf globalThis, deshalb der
     require-Zweig — ohne ihn wuerde das Modul still auf eigene Schwellen
     zurueckfallen und damit genau den Parallelbetrieb erzeugen, den 0b beendet. */
  var EV = O.evidence || (typeof require === 'function' ? (function () {
    try { return require('./evidence.js'); } catch (e) { return null; } })() : null);

  var HM_KM = 21.0975;
  /* Riegel-Exponent — identisch zu calc.js, damit Plan und Analyse nicht
     auseinanderlaufen. 1.06 ist der etablierte Wert für Laufdistanzen. */
  var RIEGEL = 1.06;

  var CONFIDENCE_ORDER = ['unknown', 'weak', 'moderate', 'strong'];

  /* Wie stark eine Referenz zählt. Ein Wettkampf schlägt jeden Trainingslauf,
     auch einen schnelleren — im Wettkampf wird ausbelastet, im Training nicht. */
  var SOURCE_WEIGHT = { race: 100, test: 90, hard_workout: 60, long_run: 40, self_report: 20 };

  /* Distanzen unter 1,5 km und über 50 km sind für die Riegel-Umrechnung auf
     Halbmarathon zu weit weg — sie werden nicht verworfen, aber abgewertet. */
  function _distanceTrust(km) {
    if (!(km > 0)) return 0;
    if (km < 1.5) return .5;
    if (km > 50) return .6;
    if (km >= 3 && km <= 30) return 1;
    return .85;
  }

  function _daysBetween(aIso, bIso) {
    try {
      var a = Date.parse(String(aIso).slice(0, 10) + 'T12:00:00Z');
      var b = Date.parse(String(bIso).slice(0, 10) + 'T12:00:00Z');
      if (isNaN(a) || isNaN(b)) return null;
      return Math.round((b - a) / 86400000);
    } catch (e) { return null; }
  }
  /* Alterung: 0 Tage = 1.0, halbes Jahr ≈ 0.75, ein Jahr ≈ 0.5, danach fallend. */
  function _freshness(days) {
    if (days == null || days < 0) return .5;
    if (days <= 30) return 1;
    if (days <= 180) return 1 - (days - 30) * (0.25 / 150);
    if (days <= 365) return .75 - (days - 180) * (0.25 / 185);
    return Math.max(.25, .5 - (days - 365) * 0.0005);
  }

  function _riegel(distKm, durMin, targetKm) {
    if (!(distKm > 0) || !(durMin > 0) || !(targetKm > 0)) return null;
    return durMin * Math.pow(targetKm / distKm, RIEGEL);
  }

  /* ---- Referenzen einsammeln ----
     Eingaben (alle optional):
       races:       [{distanceKm, durationMin, date, kind:'race'|'test'}]
       workouts:    [{distanceKm, durationMin, date, type:'interval'|'tempo'|'long'|'easy'}]
       bests:       [{distanceKm, durationMin, date}]   (run-bests / Segmentbestzeiten)
       goalTarget:  {distanceKm, targetMin}             (Zielzeit — NUR weak)
       today:       ISO-Datum als Bezugspunkt (Pflicht für die Alterung) */
  function collectReferences(input) {
    var i = input || {};
    var today = i.today || null;
    var out = [];

    function add(distanceKm, durationMin, date, source) {
      if (!(distanceKm > 0) || !(durationMin > 0)) return;
      var ageDays = (today && date) ? _daysBetween(date, today) : null;
      out.push({
        distanceKm: distanceKm, durationMin: durationMin, date: date || null,
        source: source, ageDays: ageDays,
        weight: (SOURCE_WEIGHT[source] || 10) * _distanceTrust(distanceKm) * _freshness(ageDays)
      });
    }

    (Array.isArray(i.races) ? i.races : []).forEach(function (r) {
      add(r.distanceKm, r.durationMin, r.date, r.kind === 'test' ? 'test' : 'race');
    });
    (Array.isArray(i.bests) ? i.bests : []).forEach(function (b) {
      /* Bestzeiten aus dem Training sind KEINE Wettkämpfe — sie entstehen oft in
         einem Tempolauf und liegen dadurch systematisch über der Wettkampfform. */
      add(b.distanceKm, b.durationMin, b.date, 'hard_workout');
    });
    (Array.isArray(i.workouts) ? i.workouts : []).forEach(function (wk) {
      var t = String(wk.type || '').toLowerCase();
      if (t === 'interval' || t === 'tempo') add(wk.distanceKm, wk.durationMin, wk.date, 'hard_workout');
      else if (t === 'long') add(wk.distanceKm, wk.durationMin, wk.date, 'long_run');
      /* Lockere Dauerläufe sagen über die Leistungsfähigkeit nichts aus und
         werden bewusst NICHT als Referenz verwendet. */
    });
    if (i.goalTarget && i.goalTarget.distanceKm > 0 && i.goalTarget.targetMin > 0) {
      add(i.goalTarget.distanceKm, i.goalTarget.targetMin, null, 'self_report');
    }
    return out.sort(function (a, b) { return b.weight - a.weight; });
  }

  /* Quelle -> Belegstufe. Dieselbe Skala wie evidence.js; die Zuordnung bleibt
     hier, weil die Quellnamen dieses Moduls (race/hard_workout/long_run) seine
     eigenen sind und nicht in den Querschnittsvertrag gehoeren. */
  function _confidenceOf(ref) {
    if (!ref) return 'unknown';
    if (ref.source === 'race' || ref.source === 'test') return 'strong';
    if (ref.source === 'hard_workout' || ref.source === 'long_run') return 'moderate';
    return 'weak';
  }
  /* Wie schnell eine Referenz dieser Herkunft ihre Aussagekraft verliert. */
  function _staleAfterOf(ref) {
    var src = ref && ref.source;
    if (!EV) return 180;
    if (src === 'race' || src === 'test') return EV.STALE_AFTER.race_result;
    if (src === 'hard_workout' || src === 'long_run') return EV.STALE_AFTER.workout_derived;
    return EV.STALE_AFTER.self_report;
  }
  /* Alter relativ zur Grenze — liefert {freshness, ageRatio}. Ohne evidence.js
     ehrlich 'unknown' statt einer nachgebauten Ersatzrechnung. */
  function _ageOf(ref) {
    if (!EV || !ref || ref.ageDays == null) return { freshness: 'unknown', ageRatio: null };
    var lim = _staleAfterOf(ref), ratio = ref.ageDays / lim;
    return { freshness: ratio <= 0.5 ? 'fresh' : ratio <= 1 ? 'current' : 'stale',
      ageRatio: Math.round(ratio * 100) / 100 };
  }

  /* ---- Hauptfunktion ----
     Liefert das vollständige Leistungsbild oder ehrlich `none`. */
  function resolve(input) {
    var refs = collectReferences(input);
    if (!refs.length) {
      return { ok: false, sportId: 'running', confidence: 'unknown', reason: 'no_reference',
        detail: 'Keine verwertbare Referenzleistung — ohne sie gibt es keine Zonen, nur Schätzungen.',
        path: diagnosticPathFor('running', (input || {}).level),
        availableTests: testsFor('running', (input || {}).level),
        version: VERSION, references: [] };
    }
    var best = refs[0];
    var conf = _confidenceOf(best);

    /* Halbmarathon-Äquivalent als gemeinsame Bezugsgröße: Es ist die Zielgröße
       des Nutzers und liegt distanzmäßig zwischen Schwelle und Long Run. */
    var hmMin = _riegel(best.distanceKm, best.durationMin, HM_KM);
    /* Schwellenpace ≈ 1-Stunden-Renntempo. Ueber Riegel auf die Distanz
       umgerechnet, die der Athlet in ~60 min laufen wuerde. */
    var hourKm = _solveHourDistance(best.distanceKm, best.durationMin);
    var thresholdPaceSec = hourKm > 0 ? Math.round(3600 / hourKm) : null;

    /* Zonen: dieselbe Rechnung wie in calc.js (dort geprüft), hier über das
       HM-Äquivalent gespeist, damit alle Zonen aus EINER Quelle stammen. */
    var zones = _zonesFrom(HM_KM, hmMin);

    /* Zweitmeinung: Streuung über die besten Referenzen. Liegen sie weit
       auseinander, ist das Bild unsicher — das gehört sichtbar gemacht. */
    var equivalents = refs.slice(0, 5).map(function (r) {
      return { source: r.source, ageDays: r.ageDays, hmMin: _riegel(r.distanceKm, r.durationMin, HM_KM) };
    }).filter(function (x) { return x.hmMin > 0; });
    var spread = null;
    if (equivalents.length > 1) {
      var vals = equivalents.map(function (x) { return x.hmMin; });
      spread = Math.round((Math.max.apply(null, vals) - Math.min.apply(null, vals)) * 10) / 10;
    }

    return {
      ok: true, version: VERSION,
      confidence: conf,
      /* Alter der zugrunde liegenden Referenz — die Zahl, die am ehesten
         erklärt, warum eine Vorgabe nicht mehr passt. */
      ageDays: best.ageDays,
      freshness: _ageOf(best).freshness,
      ageRatio: _ageOf(best).ageRatio,
      staleAfter: _staleAfterOf(best),
      reference: { distanceKm: best.distanceKm, durationMin: best.durationMin,
        date: best.date, source: best.source },
      halfMarathonEquivalentMin: hmMin != null ? Math.round(hmMin * 10) / 10 : null,
      thresholdPaceSecPerKm: thresholdPaceSec,
      zones: zones,
      agreement: { count: equivalents.length, spreadMin: spread,
        note: spread != null && spread > 8
          ? 'Die Referenzen weichen deutlich voneinander ab — das Bild ist unsicher.' : null },
      references: refs.slice(0, 8)
    };
  }

  /* Distanz, die in 60 min gelaufen würde — Umkehrung der Riegel-Beziehung.
     Iterativ, weil die Gleichung nicht geschlossen lösbar ist; 40 Schritte
     Bisektion sind bei dieser Größenordnung deutlich genauer als nötig. */
  function _solveHourDistance(distKm, durMin) {
    if (!(distKm > 0) || !(durMin > 0)) return 0;
    var lo = 1, hi = 60;
    for (var i = 0; i < 40; i++) {
      var mid = (lo + hi) / 2;
      var t = _riegel(distKm, durMin, mid);
      if (t > 60) hi = mid; else lo = mid;
    }
    return Math.round(((lo + hi) / 2) * 1000) / 1000;
  }

  /* Zonenmodell — Struktur identisch zu calc.js:paceZones, hier ohne DOM und
     ohne globale Abhängigkeit, damit es auch im Test und im Worker läuft. */
  function _zonesFrom(distanceKm, targetMin) {
    if (!(distanceKm > 0) || !(targetMin > 0)) return null;
    var rt = function (d) { return targetMin * Math.pow(d / distanceKm, RIEGEL); };
    var pp = function (d) { return rt(d) * 60 / d; };
    var p3 = pp(3), p5 = pp(5), p10 = pp(10), pHM = pp(HM_KM), pM = pp(42.195), pMile = pp(1.609);
    var Z = [
      ['recovery', 'Recovery', pM + 70, pM + 108],
      ['easy', 'Easy / Z2', pM + 46, pM + 78],
      ['long', 'Long Run', pM + 36, pM + 68],
      ['marathon', 'Marathon', pM - 6, pM + 10],
      ['half', 'Halbmarathon', pHM - 6, pHM + 8],
      ['threshold', 'Tempo / Schwelle', p10, pHM],
      ['tenk', '10 km', p10 - 5, p10 + 7],
      ['fivek', '5 km', p5 - 5, p5 + 6],
      ['vo2', 'Intervall (VO2)', p3, p5],
      ['strides', 'Strides', pMile - 14, pMile + 4]
    ];
    var out = {};
    Z.forEach(function (z) {
      out[z[0]] = { key: z[0], label: z[1],
        loSecPerKm: Math.round(Math.min(z[2], z[3])), hiSecPerKm: Math.round(Math.max(z[2], z[3])) };
    });
    return out;
  }

  /* ---- Vorgabe für eine Planeinheit ----
     Aus „Z2 Dauerlauf" wird „45 min @ 5:40–6:05/km" — oder ehrlich nichts. */
  var UNIT_ZONE = { 'z2 dauerlauf': 'easy', 'easy z2': 'easy', 'dauerlauf': 'easy',
    'long run': 'long', 'tempo': 'threshold', 'schwelle': 'threshold',
    'intervalle': 'vo2', 'recovery': 'recovery', 'strides': 'strides',
    'wettkampf': 'half' };

  function paceForUnit(unit, perf) {
    if (!unit || unit.t !== 'Laufen') return null;
    if (!perf || !perf.ok || !perf.zones) {
      return { ok: false, reason: 'no_performance_data',
        /* Der Grund gehört mitgeliefert, damit die Oberfläche erklären kann,
           WARUM dort nichts steht — „—" ohne Grund ist die schlechteste Antwort. */
        hint: 'Für Pace-Vorgaben fehlt eine Referenzleistung (Wettkampf oder Test).' };
    }
    var l = String(unit.l || '').toLowerCase();
    var key = null;
    Object.keys(UNIT_ZONE).forEach(function (k) { if (!key && l.indexOf(k) >= 0) key = UNIT_ZONE[k]; });
    if (!key) return { ok: false, reason: 'unit_type_unknown', hint: 'Einheitstyp ohne hinterlegte Zone.' };
    var z = perf.zones[key];
    if (!z) return { ok: false, reason: 'zone_missing' };
    return { ok: true, zone: key, label: z.label,
      loSecPerKm: z.loSecPerKm, hiSecPerKm: z.hiSecPerKm,
      text: fmtPace(z.loSecPerKm) + '–' + fmtPace(z.hiSecPerKm) + '/km',
      confidence: perf.confidence, freshness: perf.freshness, ageRatio: perf.ageRatio };
  }

  function fmtPace(secPerKm) {
    if (!(secPerKm > 0)) return '—';
    var m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60);
    if (s === 60) { m++; s = 0; }
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* Zielprognose: erreichbare Zeit auf der Zieldistanz — als Korridor, nie als
     einzelne Zahl. Die Breite folgt aus Konfidenz und Alter der Referenz, nicht
     aus einem festen Prozentsatz. */
  function forecast(perf, targetDistanceKm) {
    if (!perf || !perf.ok || !(targetDistanceKm > 0)) return { ok: false, reason: 'no_performance_data' };
    var base = _riegel(perf.reference.distanceKm, perf.reference.durationMin, targetDistanceKm);
    if (!(base > 0)) return { ok: false, reason: 'not_computable' };
    /* Breite aus Belegstufe UND Alter. Ab 0b stetig ueber ageRatio statt in
       Stufen: Ein Wert 10 % ueber der Grenze ist nicht dasselbe wie einer, der
       dreimal so alt ist wie erlaubt. evidence.bandFor() ist die eine Rechnung
       dafuer; ohne das Modul bleibt der konservative Ersatzwert. */
    var band = null;
    if (EV) band = EV.bandFor({ evidence: perf.confidence, ageRatio: perf.ageRatio });
    if (band == null) band = perf.confidence === 'strong' ? .03 : perf.confidence === 'moderate' ? .05 : .08;
    if (perf.agreement && perf.agreement.spreadMin > 8) band += .02;
    return { ok: true,
      optimisticMin: Math.round(base * (1 - band) * 10) / 10,
      realisticMin: Math.round(base * 10) / 10,
      cautiousMin: Math.round(base * (1 + band) * 10) / 10,
      bandPct: Math.round(band * 1000) / 10,
      confidence: perf.confidence, freshness: perf.freshness, ageRatio: perf.ageRatio,
      basis: perf.reference };
  }


  /* ============================================================
     SPORTARTÜBERGREIFEND (2026-08-06, Nutzerbefund)

       „Das muss ja nicht nur fürs Laufen sein — ich will auch Radfahren und
        Schwimmen trainieren. Und wenn man das alles nicht weiß, dann muss man
        einmal eine Grundaktivität machen, und daran rechnet die App das aus."

     Beide Punkte sind der Kern eines Einstiegs, nicht ein Zusatz. Wer mit einer
     Sportart anfängt, hat per Definition keine Wettkämpfe — und ohne Referenz
     liefert dieses Modul bewusst NICHTS. Ein Anfänger bekäme also dauerhaft „—",
     was genau falsch herum ist: Er braucht die Orientierung am dringendsten.

     Die Lösung ist ein EINSTIEGSTEST je Sportart. Er ist kein Wettkampf, aber
     eine echte Messung — und liefert damit belastbare Zonen statt Schätzwerte.

     JEDE SPORTART HAT IHRE EIGENE PHYSIOLOGIE UND IHRE EIGENE EINHEIT:
       Laufen     Riegel-Beziehung über Distanzen · Pace in sec/km
       Radfahren  FTP (Schwellenleistung) · Watt, Zonen als % FTP (Coggan)
       Schwimmen  CSS (Critical Swim Speed) aus 400 m und 200 m · sec/100 m

     Eine gemeinsame Formel für alle drei gibt es nicht — Radfahren kennt keine
     „Pace" (Wind und Steigung machen Geschwindigkeit unbrauchbar), Schwimmen
     keine Riegel-Beziehung. Deshalb drei Modelle mit einer gemeinsamen
     Schnittstelle, nicht ein Modell mit Sonderfällen.
     ============================================================ */

  /* Einstiegstests — das, was der Nutzer „Grundaktivität" nennt. Jeder Test ist
     so gewählt, dass er ohne Vorwissen und ohne Wettkampf durchführbar ist. */
  var TEST_PROTOCOLS = {
    running: [
      { id: 'cooper12', label: '12-Minuten-Test (Cooper)', level: 'anfaenger',
        howto: '12 Minuten so weit wie möglich laufen, gleichmäßig eingeteilt. Vorher 10 min locker einlaufen.',
        needs: ['distanceKm'], durationMin: 12, confidence: 'strong' },
      { id: 'tt30', label: '30-Minuten-Zeitfahren', level: 'fortgeschritten',
        howto: '30 Minuten maximal gleichmäßig schnell. Die Durchschnittspace der letzten 20 Minuten entspricht etwa der Schwelle.',
        needs: ['distanceKm'], durationMin: 30, confidence: 'strong' },
      { id: 'test5k', label: '5-km-Test', level: 'fortgeschritten',
        howto: '5 km so schnell wie möglich, am besten auf flacher Strecke oder Bahn.',
        needs: ['durationMin'], distanceKm: 5, confidence: 'strong' }
    ],
    cycling: [
      { id: 'ftp20', label: '20-Minuten-FTP-Test', level: 'fortgeschritten',
        howto: '20 Minuten maximal gleichmäßige Leistung nach gutem Einfahren. FTP = 95 % der Durchschnittsleistung.',
        needs: ['avgWatts'], durationMin: 20, confidence: 'strong' },
      { id: 'ftp8', label: '2×8-Minuten-Test', level: 'anfaenger',
        howto: 'Zweimal 8 Minuten maximal, dazwischen 10 min locker. FTP = 90 % des besseren Intervalls.',
        needs: ['avgWatts'], durationMin: 8, confidence: 'strong' },
      { id: 'hr_threshold', label: 'Schwellen-Herzfrequenz (ohne Powermeter)', level: 'anfaenger',
        howto: '30 Minuten gleichmäßig hart fahren. Die durchschnittliche Herzfrequenz der letzten 20 Minuten ist die Schwellen-HF.',
        needs: ['avgHr'], durationMin: 30, confidence: 'moderate' }
    ],
    swimming: [
      { id: 'css400_200', label: 'CSS-Test (400 m + 200 m)', level: 'anfaenger',
        howto: '400 m zügig, danach vollständig erholen (mindestens 5 min), dann 200 m zügig. Beide Zeiten notieren.',
        needs: ['t400Sec', 't200Sec'], confidence: 'strong' },
      { id: 'swim_tt', label: '10-Minuten-Test', level: 'anfaenger',
        howto: '10 Minuten am Stück schwimmen, so weit wie möglich. Distanz in Metern notieren.',
        needs: ['distanceM'], durationMin: 10, confidence: 'moderate' }
    ]
  };

  /* ---- Radfahren: FTP-Modell (Coggan-Zonen als % der Schwellenleistung) ---- */
  var CYCLING_ZONES = [
    ['recovery', 'Recovery', 0, .55], ['easy', 'Grundlage / Z2', .56, .75],
    ['tempo', 'Tempo', .76, .90], ['threshold', 'Schwelle', .91, 1.05],
    ['vo2', 'VO2max', 1.06, 1.20], ['anaerobic', 'Anaerob', 1.21, 1.50]
  ];
  function _cyclingFrom(ftpWatts) {
    if (!(ftpWatts > 0)) return null;
    var out = {};
    CYCLING_ZONES.forEach(function (z) {
      out[z[0]] = { key: z[0], label: z[1], unit: 'W',
        loWatts: Math.round(ftpWatts * z[2]), hiWatts: Math.round(ftpWatts * z[3]) };
    });
    return out;
  }

  /* ---- Schwimmen: CSS-Modell ----
     CSS = Geschwindigkeit an der Dauerleistungsgrenze, aus zwei Zeiten über
     verschiedene Distanzen. Die Formel ist die Steigung der Strecke-Zeit-Geraden:
       CSS [m/s] = (400 - 200) / (t400 - t200)
     Zonen als Zuschlag/Abschlag auf die CSS-Pace je 100 m. */
  function _cssFromTests(t400Sec, t200Sec) {
    if (!(t400Sec > 0) || !(t200Sec > 0) || !(t400Sec > t200Sec)) return null;
    var mps = (400 - 200) / (t400Sec - t200Sec);
    if (!(mps > 0)) return null;
    return Math.round((100 / mps) * 10) / 10;          // sec pro 100 m
  }
  var SWIM_ZONES = [
    ['recovery', 'Locker / Technik', 12, 20], ['easy', 'Grundlage', 6, 12],
    ['tempo', 'Tempo', 2, 6], ['threshold', 'Schwelle (CSS)', -2, 2],
    ['vo2', 'VO2max', -8, -3]
  ];
  function _swimmingFrom(cssSecPer100) {
    if (!(cssSecPer100 > 0)) return null;
    var out = {};
    SWIM_ZONES.forEach(function (z) {
      out[z[0]] = { key: z[0], label: z[1], unit: 'sec/100m',
        loSecPer100: Math.round(cssSecPer100 + Math.min(z[2], z[3])),
        hiSecPer100: Math.round(cssSecPer100 + Math.max(z[2], z[3])) };
    });
    return out;
  }

  /* ---- Einstiegstest auswerten ---- */
  function fromTest(sportId, test) {
    var t = test || {};
    var sport = String(sportId || '').toLowerCase();
    if (sport === 'running') {
      if (t.id === 'cooper12' && t.distanceKm > 0) return { distanceKm: t.distanceKm, durationMin: 12, source: 'test' };
      if (t.id === 'tt30' && t.distanceKm > 0) return { distanceKm: t.distanceKm, durationMin: 30, source: 'test' };
      if (t.id === 'test5k' && t.durationMin > 0) return { distanceKm: 5, durationMin: t.durationMin, source: 'test' };
      return null;
    }
    if (sport === 'cycling') {
      /* Die Faktoren sind Standardwerte der Trainingslehre: aus 20 Minuten
         maximal ergibt sich die Stundenleistung mit rund 95 %, aus 8 Minuten
         mit rund 90 %. Sie sind hier sichtbar, damit sie prüfbar bleiben. */
      if (t.id === 'ftp20' && t.avgWatts > 0) return { ftpWatts: Math.round(t.avgWatts * 0.95), source: 'test' };
      if (t.id === 'ftp8' && t.avgWatts > 0) return { ftpWatts: Math.round(t.avgWatts * 0.90), source: 'test' };
      if (t.id === 'hr_threshold' && t.avgHr > 0) return { thresholdHr: Math.round(t.avgHr), source: 'test_hr' };
      return null;
    }
    if (sport === 'swimming') {
      if (t.id === 'css400_200') { var css = _cssFromTests(t.t400Sec, t.t200Sec); return css ? { cssSecPer100: css, source: 'test' } : null; }
      if (t.id === 'swim_tt' && t.distanceM > 0) {
        /* 10-Minuten-Distanz ≈ etwas über CSS; konservativ 3 % Abschlag, damit
           die abgeleiteten Vorgaben eher zu locker als zu hart ausfallen. */
        var sec100 = (600 / t.distanceM) * 100;
        return { cssSecPer100: Math.round(sec100 * 1.03 * 10) / 10, source: 'test_estimate' };
      }
      return null;
    }
    return null;
  }

  /* ---- Gemeinsame Schnittstelle über alle Sportarten ----
     resolveFor('cycling', {today, test:{id:'ftp20', avgWatts:263}, ftpWatts, ...}) */
  function resolveFor(sportId, input) {
    var sport = String(sportId || 'running').toLowerCase();
    var i = input || {};
    if (sport === 'running') return resolve(i);

    var direct = i.test ? fromTest(sport, i.test) : null;
    var testDate = (i.test && i.test.date) || i.date || null;
    var ageDays = (i.today && testDate) ? _daysBetween(testDate, i.today) : null;
    /* Rad und Schwimmen: FTP und CSS altern langsamer als eine Selbstauskunft,
       aber schneller als ein Wettkampfergebnis — Grenze aus evidence.js. */
    var _lim = EV ? EV.STALE_AFTER.test : 120;
    var _ratio = ageDays == null ? null : Math.round((ageDays / _lim) * 100) / 100;
    var stale = _ratio == null ? 'unknown' : _ratio <= 0.5 ? 'fresh' : _ratio <= 1 ? 'current' : 'stale';

    if (sport === 'cycling') {
      var ftp = (direct && direct.ftpWatts) || i.ftpWatts || null;
      var thr = (direct && direct.thresholdHr) || i.thresholdHr || null;
      if (!ftp && !thr) {
        return { ok: false, sportId: sport, confidence: 'unknown', reason: 'no_reference',
          detail: 'Für Radfahren fehlt FTP oder Schwellen-Herzfrequenz.',
          path: diagnosticPathFor('cycling', i.level),
          availableTests: testsFor('cycling', i.level), version: VERSION };
      }
      return { ok: true, sportId: sport, version: VERSION,
        /* Ohne Powermeter ist die HF-Ableitung belastbar, aber nicht so genau
           wie eine Leistungsmessung — das gehört in die Konfidenz, nicht in
           eine Fußnote. */
        confidence: ftp ? (direct ? 'strong' : 'weak') : 'moderate',
        ageDays: ageDays, freshness: stale, ageRatio: _ratio, staleAfter: _lim,
        ftpWatts: ftp || null, thresholdHr: thr || null,
        zones: ftp ? _cyclingFrom(ftp) : null,
        hrZones: thr ? _hrZonesFrom(thr) : null,
        reference: direct || { ftpWatts: ftp, thresholdHr: thr, source: 'profile' } };
    }
    if (sport === 'swimming') {
      var css = (direct && direct.cssSecPer100) || i.cssSecPer100 || null;
      if (!css) {
        return { ok: false, sportId: sport, confidence: 'unknown', reason: 'no_reference',
          detail: 'Für Schwimmen fehlt ein CSS-Wert (400 m + 200 m Test).',
          path: diagnosticPathFor('swimming', i.level),
          availableTests: testsFor('swimming', i.level), version: VERSION };
      }
      return { ok: true, sportId: sport, version: VERSION,
        confidence: (direct && direct.source === 'test') ? 'strong' : (direct ? 'moderate' : 'weak'),
        ageDays: ageDays, freshness: stale, ageRatio: _ratio, staleAfter: _lim,
        cssSecPer100: css, zones: _swimmingFrom(css),
        reference: direct || { cssSecPer100: css, source: 'profile' } };
    }
    return { ok: false, sportId: sport, confidence: 'unknown', reason: 'sport_not_modelled',
      detail: 'Für diese Sportart gibt es noch kein Leistungsmodell.', version: VERSION };
  }

  /* HF-Zonen aus der Schwellen-Herzfrequenz (Friel-Modell, % der Schwellen-HF). */
  var HR_ZONES = [
    ['recovery', 'Recovery', 0, .81], ['easy', 'Grundlage / Z2', .81, .89],
    ['tempo', 'Tempo', .90, .93], ['threshold', 'Schwelle', .94, 1.00],
    ['vo2', 'VO2max', 1.00, 1.06]
  ];
  function _hrZonesFrom(thresholdHr) {
    if (!(thresholdHr > 0)) return null;
    var out = {};
    HR_ZONES.forEach(function (z) {
      out[z[0]] = { key: z[0], label: z[1], unit: 'bpm',
        loBpm: Math.round(thresholdHr * z[2]), hiBpm: Math.round(thresholdHr * z[3]) };
    });
    return out;
  }

  /* ============================================================
     LEISTUNGSSTAND STEUERT DEN DIAGNOSTIK-WEG (2026-08-06, Nutzerbefund)

       „Wenn Du bei dem Sportlevel Anfänger hast, dann machst Du das, und bei
        Fortgeschritten anders, und bei wettkampforientiert kannst Du dann
        Wettkampfpace eingeben."

     Genau richtig — und es ist mehr als eine Sortierfrage. Die drei Stufen
     brauchen verschiedene WEGE, nicht denselben Weg in anderer Reihenfolge:

       beginner      Ein Test, der ohne Vorwissen funktioniert und niemanden
                     abschreckt. Ein 20-Minuten-FTP-Test als erste Begegnung mit
                     dem Rad ist der sichere Weg, die Sportart wieder aufzugeben.
       intermediate  Die genaueren Protokolle sind zumutbar und liefern
                     belastbarere Werte.
       competitive   Wer Wettkämpfe bestreitet, hat die beste denkbare Referenz
                     bereits: die Wettkampfleistung. Ihn zuerst nach einem Test
                     zu fragen, wäre unsinnig — der Wettkampf ist genauer als
                     jeder Test, weil dort wirklich ausbelastet wird.

     DAS LEVEL IST PRO SPORTART. Beim Laufen fortgeschritten und beim Schwimmen
     Anfänger zu sein ist der Normalfall, nicht die Ausnahme — deshalb wird das
     Level je Sportart aus `PROFILE.sports[].fields.level` gelesen und nie global.

     Die Bezeichnungen im Profil sind je Sportart unterschiedlich gewachsen
     (Laufen/Rad: „Einsteiger · fortgeschritten · ambitioniert · Wettkampf",
     Schwimmen: „Anfänger · fortgeschritten · erfahren"). Sie werden hier auf
     drei kanonische Stufen abgebildet, statt an jeder Auswertungsstelle erneut
     geraten zu werden.
     ============================================================ */
  var LEVELS = ['beginner', 'intermediate', 'competitive'];
  var LEVEL_MAP = {
    'einsteiger': 'beginner', 'anfaenger': 'beginner', 'anfänger': 'beginner', 'beginner': 'beginner',
    'fortgeschritten': 'intermediate', 'erfahren': 'intermediate', 'intermediate': 'intermediate',
    'ambitioniert': 'competitive', 'wettkampf': 'competitive', 'profi': 'competitive', 'competitive': 'competitive'
  };
  function normalizeLevel(raw) {
    var k = String(raw == null ? '' : raw).toLowerCase().trim();
    return LEVEL_MAP[k] || null;      /* unbekannt ⇒ null, nicht geraten */
  }
  /* Level einer Sportart aus dem Profil. Ohne Angabe: beginner — die
     vorsichtige Annahme, weil ein zu leichter Test niemandem schadet, ein zu
     harter aber schon. */
  function levelForSport(profile, sportId) {
    try {
      var sports = (profile && profile.sports) || [];
      for (var i = 0; i < sports.length; i++) {
        var sp = sports[i];
        if (!sp || String(sp.sportId || '').toLowerCase() !== String(sportId || '').toLowerCase()) continue;
        var lv = normalizeLevel((sp.fields && sp.fields.level) || sp.level);
        if (lv) return lv;
      }
      var top = normalizeLevel(profile && profile.level);
      if (top) return top;
    } catch (e) {}
    return 'beginner';
  }

  /* Welchen WEG schlägt die App diesem Nutzer für diese Sportart vor? */
  function diagnosticPathFor(sportId, level) {
    var sport = String(sportId || '').toLowerCase();
    var lv = normalizeLevel(level) || 'beginner';
    var list = TEST_PROTOCOLS[sport] || [];
    if (lv === 'competitive') {
      return { level: lv, primary: 'race_result',
        prompt: sport === 'swimming' ? 'Trag deine letzte Wettkampfzeit ein (Distanz + Zeit).'
          : 'Trag dein letztes Wettkampfergebnis ein (Distanz + Zeit) — genauer als jeder Test.',
        tests: list, note: 'Ein Test ist möglich, aber der Wettkampf ist die bessere Referenz.' };
    }
    var wanted = lv === 'beginner' ? 'anfaenger' : 'fortgeschritten';
    var primaryTests = list.filter(function (t) { return t.level === wanted; });
    var rest = list.filter(function (t) { return t.level !== wanted; });
    return { level: lv, primary: 'test',
      prompt: lv === 'beginner'
        ? 'Mach einmal diesen Test — daraus rechnet die App deine Bereiche aus.'
        : 'Für genauere Bereiche eignet sich eines dieser Protokolle.',
      tests: primaryTests.concat(rest),
      note: lv === 'beginner' ? 'Kein Wettkampf nötig. Der Test reicht als Start.' : null };
  }

  /* Welche Tests kann dieser Nutzer jetzt machen — passend zum Leistungsstand. */
  function testsFor(sportId, level) {
    return diagnosticPathFor(sportId, level).tests;
  }

  /* Vorgabe für eine Einheit — jetzt über alle Sportarten. */
  var SPORT_OF_LABEL = { 'laufen': 'running', 'rad': 'cycling', 'radfahren': 'cycling', 'schwimmen': 'swimming' };
  function targetForUnit(unit, perfBySport) {
    if (!unit) return null;
    var sport = SPORT_OF_LABEL[String(unit.t || '').toLowerCase()] || null;
    if (!sport) return null;
    var perf = perfBySport && perfBySport[sport];
    if (!perf || !perf.ok || !perf.zones) {
      return { ok: false, sportId: sport, reason: 'no_performance_data',
        hint: 'Für ' + (unit.t || 'diese Sportart') + ' fehlt eine Referenzleistung.',
        availableTests: (perf && perf.availableTests) || testsFor(sport, 'anfaenger') };
    }
    if (sport === 'running') return paceForUnit(unit, perf);
    var l = String(unit.l || '').toLowerCase();
    var key = /interval/.test(l) ? 'vo2' : /tempo|schwelle|z3/.test(l) ? 'tempo'
      : /long/.test(l) ? 'easy' : /recovery|regener/.test(l) ? 'recovery'
      : /technik/.test(l) ? 'recovery' : 'easy';
    var z = perf.zones[key];
    if (!z) return { ok: false, sportId: sport, reason: 'zone_missing' };
    var text = sport === 'cycling' ? (z.loWatts + '–' + z.hiWatts + ' W')
      : (fmtPace(z.loSecPer100) + '–' + fmtPace(z.hiSecPer100) + '/100m');
    return { ok: true, sportId: sport, zone: key, label: z.label, text: text,
      confidence: perf.confidence, freshness: perf.freshness, ageRatio: perf.ageRatio };
  }

  var api = { VERSION: VERSION, HM_KM: HM_KM, RIEGEL: RIEGEL,
    CONFIDENCE_ORDER: CONFIDENCE_ORDER.slice(), SOURCE_WEIGHT: SOURCE_WEIGHT,
    collectReferences: collectReferences, resolve: resolve,
    paceForUnit: paceForUnit, forecast: forecast, fmtPace: fmtPace,
    TEST_PROTOCOLS: TEST_PROTOCOLS, resolveFor: resolveFor, fromTest: fromTest,
    testsFor: testsFor, targetForUnit: targetForUnit,
    LEVELS: LEVELS.slice(), normalizeLevel: normalizeLevel,
    levelForSport: levelForSport, diagnosticPathFor: diagnosticPathFor,
    _zonesFrom: _zonesFrom, _solveHourDistance: _solveHourDistance };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.performanceZones = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
