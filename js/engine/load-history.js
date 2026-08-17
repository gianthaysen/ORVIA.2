/* ============================================================
   ORVIA · load-history — Stufe 3 (C1) des Bauplans

   WOFÜR: Ohne diesen Baustein plant die Engine jede Woche, als wäre es die
   erste. Progression, Periodisierung und das Beschwerdemodell hängen alle
   daran.

   DREI DINGE, DIE HIER NICHT VERMISCHT WERDEN DÜRFEN — das ist die zentrale
   Entwurfsentscheidung dieses Moduls:

     1. TATSÄCHLICH ABSOLVIERTE LAST   was gemessen wurde
     2. DATENVOLLSTÄNDIGKEIT           was wir überhaupt wissen können
     3. ABGELEITETER TOLERANCE STATE   wie es vertragen wurde

   Werden sie vermischt, entsteht der gefährlichste Fehler dieses Moduls: Eine
   Woche ohne geloggte Aktivitäten sähe aus wie eine Woche ohne Training. Die
   Engine würde daraus „gut erholt, jetzt kann gesteigert werden" schließen —
   ausgerechnet bei jemandem, der vermutlich im Urlaub war oder das Loggen
   vergessen hat. FEHLENDE AKTIVITÄTEN SIND FEHLENDE DATEN, NIEMALS NULLBELASTUNG.
   `gaps[]` macht das sichtbar, `completeness` beziffert es, und ab zu vielen
   Lücken meldet die Ratio `insufficient_data` statt einer Zahl.

   EIN LASTMODELL, NICHT ZWEI: `load-profile.profileOf()` ist die einzige Quelle
   der Muskelsprache. Zwei Lastmodelle wären der sichere Weg in widersprüchliche
   Aussagen — der Plan würde nach der einen Rechnung ausweichen und nach der
   anderen nicht.

   KRAFTTRAINING ZÄHLT ÜBER SÄTZE, NICHT ÜBER EINHEITEN. Drei Sätze Kniebeugen
   sind nicht dieselbe Last wie zehn. Wo Satzdaten fehlen, wird das als Lücke
   geführt und nicht mit einem Mittelwert aufgefüllt.

   `trainingState` IST ADDITIV, NICHT ERSETZEND. Der Designer konsumiert die
   verdichtete Form, die Diagnose die Rohwerte. Eine abgeleitete Kennzahl, die
   man nicht zurückverfolgen kann, ist nicht debuggbar.

   MONOTONY UND STRAIN WERDEN BERECHNET UND ANGEZEIGT, GEHEN ABER NICHT IN
   PLANUNGSENTSCHEIDUNGEN EIN. Ihre Reproduzierbarkeit ist in Folgestudien
   deutlich schwächer ausgefallen als ihre Verbreitung vermuten lässt [A].
   Sie sind deshalb ausdrücklich als `advisory` gekennzeichnet.

   ACUTE:CHRONIC ALS KONTEXT, NICHT ALS AMPEL. Die prospektive Evidenz für
   ACWR-basierte Verletzungsvorhersage ist deutlich schwächer als die Verbreitung
   des Modells [F]. Ausgegeben wird ein Band, nie ein „du darfst nicht".

   Kein DOM, keine Uhr, kein Zufall, kein Storage. `today` kommt herein.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'load-history@3';

  /* POLICY-VERSION der Schwellenwerte. Getrennt von der Modulversion, weil eine
     geaenderte Schwelle RUECKWIRKEND andere Entscheidungen erzeugt haette: Was
     heute `insufficient_data` ist, koennte morgen eine Ratio sein. Ohne diese
     Kennung waere im Entscheidungs-Log nicht unterscheidbar, ob sich der Code
     oder die Politik geaendert hat. */
  var POLICY_VERSION = 'lh-policy@2';

  function _req(name) {
    if (typeof require !== 'function') return null;
    try { return require(name); } catch (e) { return null; }
  }
  var LP = O.loadProfile || _req('./load-profile.js');
  var EV = O.evidence || _req('./evidence.js');
  var SD = O.sessionDebrief || _req('./session-debrief.js');

  var MUSCLES = (LP && LP.MUSCLES) ? LP.MUSCLES.slice() : [];

  /* Ab wie vielen Lücken eine Kennzahl nicht mehr berichtet wird. Bewusst
     streng: Eine Ratio aus halber Datenlage sieht genauso aus wie eine aus
     voller — und wäre damit gefährlicher als gar keine. [A] */
  var MIN_COMPLETENESS = { acuteChronic: 0.75, trend: 0.6, monotony: 0.8 };

  /* Sportart-Aliase. Ohne sie zaehlt „Laufen" und „running" als zwei Sportarten
     und die Toleranzzellen zersplittern. */
  var SPORT_ALIAS = {
    run: 'running', laufen: 'running', lauf: 'running', jogging: 'running',
    bike: 'cycling', rad: 'cycling', radfahren: 'cycling', cycle: 'cycling',
    swim: 'swimming', schwimmen: 'swimming',
    kraft: 'gym', krafttraining: 'gym', strength: 'gym'
  };

  function _dayKey(x) { return String(x || '').slice(0, 10); }
  function _addDays(iso, n) {
    var d = Date.parse(_dayKey(iso) + 'T12:00:00Z');
    if (isNaN(d)) return null;
    return new Date(d + n * 86400000).toISOString().slice(0, 10);
  }
  function _daysBetween(a, b) {
    var x = Date.parse(_dayKey(a) + 'T12:00:00Z'), y = Date.parse(_dayKey(b) + 'T12:00:00Z');
    if (isNaN(x) || isNaN(y)) return null;
    return Math.round((y - x) / 86400000);
  }
  function _sum(a) { var s = 0, i; for (i = 0; i < a.length; i++) s += a[i]; return s; }
  function _mean(a) { return a.length ? _sum(a) / a.length : 0; }
  function _sd(a) {
    if (a.length < 2) return 0;
    var m = _mean(a), v = _mean(a.map(function (x) { return (x - m) * (x - m); }));
    return Math.sqrt(v);
  }
  function _r2(x) { return Math.round(x * 100) / 100; }

  /* ---- Last einer einzelnen Einheit ----
     Systemisch: Dauer × Intensitätsgewicht aus load-profile. Muskulär: das
     Profil derselben Quelle, mit der Dauer skaliert. Eine Einheit ohne Dauer
     liefert KEINE Last — sie wird als unvollständig geführt, nicht geschätzt. */
  /* NAHTSTELLE AKTIVITAET -> LASTMODELL.
     Eine Aktivitaet und eine Planeinheit haben verschiedene Formen: Die eine
     kennt `sportId`/`subType`, die andere `t`/`l`. load-profile.intensityOf()
     liest `l` — eine Aktivitaet direkt hineinzureichen ergibt deshalb IMMER
     'moderate', unabhaengig davon, ob es ein Regenerationslauf oder ein
     Intervalltraining war. Das ist kein kosmetischer Fehler: Die gesamte
     Historie waere dann eine Reihe gleich schwerer Einheiten, und jede
     Aussage ueber Trend, Erholung und Ratio waere flach falsch.
     Deshalb wird hier UEBERSETZT statt durchgereicht. */
  function asUnit(activity) {
    var a = activity || {};
    var lbl = a.l != null ? a.l
      : (a.subType || a.label || a.name || a.workoutType || a.intensity || '');
    var raw = String(a.sportId || a.sport || a.type || '').toLowerCase().trim();
    var sport = SPORT_ALIAS[raw] || raw || null;
    /* Dauer wird HIER normalisiert, nicht an drei Stellen einzeln: Minuten,
       Sekunden und Millisekunden kommen aus verschiedenen Quellen. */
    var min = a.durationMin != null ? a.durationMin
      : (a.durationSec > 0 ? a.durationSec / 60
        : (a.movingTimeSec > 0 ? a.movingTimeSec / 60
          : (a.elapsedMs > 0 ? a.elapsedMs / 60000 : null)));
    /* IDENTITAET. Eine echte ID ist eindeutig; ein Ersatzschluessel ist es
       NICHT. Zwei ehrliche 30-Minuten-Laeufe am selben Tag sind moeglich —
       sie stillschweigend zu einer Einheit zusammenzuziehen waere schlimmer
       als eine Doppelzaehlung, weil eine geloeschte Einheit unsichtbar ist,
       eine doppelte aber auffaellt. Deshalb: nur mit unterscheidenden
       Merkmalen wird sicher dedupliziert; sonst wird die moegliche Kollision
       AUSGEWIESEN und beide Einheiten bleiben stehen. */
    var id = a.id || a.activityId || a.externalId || a.garminActivityId || null;
    var startTime = a.startTime || a.startTimeLocal || a.startedAt ||
      (typeof a.startDate === 'string' && a.startDate.length > 10 ? a.startDate : null);
    var source = a.source || a.provider || a.deviceId || a.uploadId || null;
    return {
      t: a.t != null ? a.t : (a.sportLabel || null),
      l: String(lbl || ''),
      sportId: sport,
      split: a.split || a.gymSplit || null,
      durationMin: min,
      id: id, startTime: startTime || null, source: source || null,
      /* Tagesschluessel: lokale Datumsangaben gewinnen vor Zeitstempeln. Ein
         UTC-Zeitstempel um 23:30 Ortszeit landet sonst auf dem Folgetag und
         verschiebt die ganze Tagesbilanz. */
      dayKey: _dayKey(a.localDate || a.date || a.startDateLocal || a.startDate)
    };
  }
  /* Liefert Schluessel UND Sicherheit. `certain` heisst: Es gibt ein Merkmal,
     das zwei ECHTE Einheiten unterscheiden koennte (ID, Startzeit, Quelle).
     Ohne ein solches Merkmal ist der Schluessel nur ein Verdacht. */
  function identityOf(u) {
    if (u.id) return u.id;
    return [u.dayKey || '', u.sportId || '', u.l || '',
      u.durationMin == null ? '' : Math.round(u.durationMin),
      u.startTime || '', u.source || ''].join('|');
  }
  function identityCertain(u) {
    return !!(u.id || u.startTime || u.source);
  }

  function loadOf(activity) {
    var u = asUnit(activity);
    var min = u.durationMin;
    if (!(min > 0)) return { ok: false, reason: 'no_duration', systemic: 0, muscles: {} };

    var prof = LP ? LP.profileOf(u) : null;
    if (!prof) return { ok: false, reason: 'no_load_model', systemic: 0, muscles: {} };

    /* Systemische Last in „Belastungsminuten": Dauer × systemischem Gewicht.
       Bewusst KEIN TRIMP — dafür bräuchte es durchgehende Herzfrequenzdaten,
       die nicht für jede Einheit vorliegen. Eine Kennzahl, die nur bei der
       Hälfte der Einheiten funktioniert, macht die Reihe unvergleichbar. */
    var systemic = _r2(min * (prof.systemic != null ? prof.systemic : 0.45));
    var muscles = {};
    Object.keys(prof.muscles || {}).forEach(function (m) {
      muscles[m] = _r2(prof.muscles[m] * min / 60);
    });
    return { ok: true, systemic: systemic, muscles: muscles,
      sportId: prof.sportId, intensity: prof.intensity, unknownSport: !!prof.unknownSport,
      durationMin: min, identity: identityOf(u), identityCertain: identityCertain(u),
      dayKey: u.dayKey };
  }

  /* ---- Krafttraining: Sätze × Gewicht, nicht „eine Einheit" ----
     Wo Satzdaten fehlen, wird das gemeldet und NICHT durch einen Mittelwert
     ersetzt: Drei Sätze Kniebeugen sind nicht zehn. */
  function strengthLoadOf(sets) {
    var list = Array.isArray(sets) ? sets : [];
    if (!list.length) return { ok: false, reason: 'no_sets', muscles: {}, setCount: 0 };
    var muscles = {}, counted = 0, unclassified = 0;
    var GV = O.gymVolume || null;

    list.forEach(function (st) {
      if (!st) return;
      var reps = st.reps > 0 ? st.reps : null;
      var weight = st.weightKg > 0 ? st.weightKg : (st.weight > 0 ? st.weight : null);
      /* Ohne Wiederholungen ist ein Satz kein Datensatz. */
      if (!reps) { unclassified++; return; }
      var work = weight != null ? reps * weight : reps * 20;   /* Körpergewichtsannahme, konservativ */
      var ms = null;
      try { if (GV && GV.musclesFor) ms = GV.musclesFor(st.exerciseId || st.name || st.exercise || ''); } catch (e) { ms = null; }
      if (!ms || !Object.keys(ms).length) { unclassified++; return; }
      counted++;
      Object.keys(ms).forEach(function (m) {
        muscles[m] = _r2((muscles[m] || 0) + work * (ms[m] || 0) / 1000);
      });
    });
    return { ok: counted > 0, muscles: muscles, setCount: counted,
      unclassifiedSets: unclassified,
      reason: counted > 0 ? null : 'no_classified_sets' };
  }

  /* ============================================================
     HAUPTFUNKTION
     ============================================================ */
  function buildHistory(opts) {
    var o = opts || {};
    var today = _dayKey(o.today);
    var days = o.days > 0 ? Math.floor(o.days) : 28;
    if (!today) return _empty('no_today');

    /* --- 1. TATSÄCHLICH ABSOLVIERTE LAST --- */
    var byDay = {};
    var i, k;
    for (i = days - 1; i >= 0; i--) {
      k = _addDays(today, -i);
      if (k) byDay[k] = { date: k, systemic: 0, perMuscle: {}, sessions: [], logged: false };
    }

    var activities = Array.isArray(o.activities) ? o.activities : [];
    var skipped = [], seen = {}, duplicates = 0, possibleDuplicates = [];
    activities.forEach(function (a) {
      var u = asUnit(a);
      var d = u.dayKey;
      if (!d || !byDay[d]) return;
      /* DOPPELZAEHLUNG: Derselbe Datensatz aus zwei Sync-Laeufen darf die Last
         nicht verdoppeln — aber nur, wenn er sicher IDENTIFIZIERBAR ist. */
      var ident = identityOf(u);
      if (seen[ident]) {
        if (identityCertain(u)) { duplicates++; return; }
        /* Kein unterscheidendes Merkmal: Es KOENNTE eine Dublette sein, es
           koennten aber auch zwei echte Einheiten sein. Beide bleiben stehen,
           die Kollision wird gemeldet. */
        possibleDuplicates.push({ date: d, sportId: u.sportId, label: u.l,
          durationMin: u.durationMin,
          hint: 'Ohne Startzeit, Quelle oder ID nicht von zwei echten Einheiten zu unterscheiden.' });
      }
      seen[ident] = true;

      var L = loadOf(a);
      if (!L.ok) { skipped.push({ date: d, reason: L.reason }); byDay[d].logged = true; return; }
      byDay[d].logged = true;
      byDay[d].systemic = _r2(byDay[d].systemic + L.systemic);
      Object.keys(L.muscles).forEach(function (m) {
        byDay[d].perMuscle[m] = _r2((byDay[d].perMuscle[m] || 0) + L.muscles[m]);
      });
      byDay[d].sessions.push({ sportId: L.sportId, intensity: L.intensity,
        durationMin: L.durationMin, systemic: L.systemic, unknownSport: L.unknownSport,
        identity: ident, isStrength: L.sportId === 'gym' });
    });

    /* Krafttraining separat: Sätze × Gewicht. */
    var sets = Array.isArray(o.sets) ? o.sets : [];
    var byDaySets = {};
    sets.forEach(function (st) {
      var d = _dayKey(st && (st.date || st.performedAt));
      if (!d || !byDay[d]) return;
      (byDaySets[d] = byDaySets[d] || []).push(st);
    });
    Object.keys(byDaySets).forEach(function (d) {
      var S = strengthLoadOf(byDaySets[d]);
      byDay[d].logged = true;
      byDay[d].setCount = S.setCount;
      byDay[d].unclassifiedSets = S.unclassifiedSets;
      if (!S.ok) { skipped.push({ date: d, reason: S.reason }); return; }

      /* DOPPELZAEHLUNG KRAFT: Liegt am selben Tag eine Krafteinheit ALS
         AKTIVITAET vor (pauschale Muskelschaetzung aus dem Split) UND es gibt
         klassifizierte Saetze, dann beschreiben beide dieselbe Belastung. Die
         Saetze sind die genauere Quelle — sie ERSETZEN die Schaetzung, statt
         sich zu ihr zu addieren. Ohne diese Regel zaehlt ein sauber geloggtes
         Krafttraining doppelt, und ausgerechnet der gruendliche Nutzer
         bekaeme die uebertriebenste Lastbilanz. */
      var strengthSessions = byDay[d].sessions.filter(function (x) { return x.isStrength; });
      if (strengthSessions.length) {
        var reProfile = {};
        byDay[d].sessions.filter(function (x) { return !x.isStrength; }).forEach(function () {});
        /* Muskelanteile der Krafteinheiten herausrechnen: neu aufbauen aus den
           Nicht-Kraft-Einheiten, dann die Saetze addieren. */
        byDay[d].perMuscle = {};
        (o.activities || []).forEach(function (a) {
          var u2 = asUnit(a);
          if (u2.dayKey !== d) return;
          var L2 = loadOf(a);
          if (!L2.ok || L2.sportId === 'gym') return;
          Object.keys(L2.muscles).forEach(function (m) {
            reProfile[m] = _r2((reProfile[m] || 0) + L2.muscles[m]);
          });
        });
        byDay[d].perMuscle = reProfile;
        byDay[d].strengthFromSets = true;
      }

      Object.keys(S.muscles).forEach(function (m) {
        byDay[d].perMuscle[m] = _r2((byDay[d].perMuscle[m] || 0) + S.muscles[m]);
      });
    });

    /* --- 2. DATENVOLLSTÄNDIGKEIT — getrennt von der Last --- */
    /* Ein Tag OHNE Eintrag ist nicht „null trainiert", sondern „unbekannt".
       Genau hier liegt der Fehler, den dieses Modul verhindern soll. */
    var known = Array.isArray(o.knownDays) ? o.knownDays.map(_dayKey) : null;
    var gaps = [];
    Object.keys(byDay).forEach(function (d) {
      /* DER LAUFENDE TAG IST NOCH NICHT VORBEI. Ihn als Luecke zu zaehlen waere
         falsch — die Abendeinheit steht vielleicht noch aus. Er ist weder
         bekannt noch unbekannt, sondern unvollstaendig: Er faellt aus der
         Vollstaendigkeitsrechnung heraus, seine bereits geloggte Last zaehlt
         aber mit. */
      if (d === today && !byDay[d].logged) { byDay[d].partial = true; return; }
      if (d === today) { byDay[d].partial = true; return; }
      if (byDay[d].logged) return;
      /* Ausdrücklich als „nichts trainiert" bestätigte Tage sind KEINE Lücke —
         nur so kann ein echter Ruhetag von einem vergessenen Log unterschieden
         werden. */
      if (known && known.indexOf(d) >= 0) { byDay[d].confirmedRest = true; return; }
      gaps.push({ date: d, reason: 'no_entry' });
      byDay[d].unknown = true;
    });
    skipped.forEach(function (s) { gaps.push({ date: s.date, reason: s.reason }); });

    var dayList = Object.keys(byDay).sort();
    /* Der laufende Tag zaehlt weder als bekannt noch als fehlend. */
    var rated = dayList.filter(function (d) { return !byDay[d].partial; });
    var completeness = rated.length
      ? _r2(rated.filter(function (d) { return !byDay[d].unknown; }).length / rated.length)
      : 0;

    /* --- Rollierende Fenster (ROH — bleiben erhalten) --- */
    /* Fenster ueber ABGESCHLOSSENE Tage. Wuerde man `slice(-n)` auf alle Tage
       anwenden und den laufenden danach herausfiltern, waere ein „7-Tage-
       Fenster" in Wahrheit sechs Tage lang — und ein Vergleich mit dem
       28-Tage-Fenster verglichen ungleiche Beobachtungsraeume. */
    var completedList = dayList.filter(function (d) { return !byDay[d].partial; });
    function windowOf(n) {
      var ds = completedList.slice(-n);
      var certain = ds.filter(function (d) { return !byDay[d].unknown; });
      var vals = certain.map(function (d) { return byDay[d].systemic; });
      var pm = {};
      MUSCLES.forEach(function (m) {
        pm[m] = _r2(_sum(certain.map(function (d) { return byDay[d].perMuscle[m] || 0; })));
      });
      return {
        days: ds.length, knownDays: certain.length,
        completeness: ds.length ? _r2(certain.length / ds.length) : 0,
        /* Summe NUR über bekannte Tage — und die Zahl trägt mit, über wie
           viele Tage sie gebildet wurde. Ohne das wären 200 aus 7 Tagen und
           200 aus 3 bekannten Tagen ununterscheidbar. */
        systemic: _r2(_sum(vals)),
        systemicPerKnownDay: certain.length ? _r2(_sum(vals) / certain.length) : null,
        perMuscle: pm
      };
    }
    var rolling = { 7: windowOf(7), 14: windowOf(14), 28: windowOf(28) };

    /* --- Acute:Chronic — Kontext, keine Ampel --- */
    var acuteChronic;
    if (rolling[7].completeness < MIN_COMPLETENESS.acuteChronic ||
        rolling[28].completeness < MIN_COMPLETENESS.acuteChronic) {
      acuteChronic = { ratio: null, acute7: null, chronic28: null, band: 'insufficient_data',
        reason: 'completeness_below_threshold',
        completeness: { d7: rolling[7].completeness, d28: rolling[28].completeness } };
    } else {
      var acute = rolling[7].systemicPerKnownDay;
      var chronic = rolling[28].systemicPerKnownDay;
      var ratio = (chronic > 0) ? _r2(acute / chronic) : null;
      acuteChronic = {
        ratio: ratio, acute7: acute, chronic28: chronic,
        band: ratio == null ? 'insufficient_data'
          : ratio < 0.8 ? 'low' : ratio <= 1.3 ? 'ok' : ratio <= 1.5 ? 'high' : 'spike',
        note: 'Kontextgröße, keine Freigabe oder Sperre — die prospektive Evidenz ist schwächer als die Verbreitung des Modells.',
        advisory: true
      };
    }

    /* --- Muskelerholung --- */
    var muscleReadiness = {};
    MUSCLES.forEach(function (m) {
      var lastHeavy = null;
      for (i = dayList.length - 1; i >= 0; i--) {
        var v = byDay[dayList[i]].perMuscle[m] || 0;
        if (v >= 0.5) { lastHeavy = dayList[i]; break; }
      }
      if (lastHeavy == null) { muscleReadiness[m] = null; return; }
      var need = (LP && LP.RECOVERY_H && LP.RECOVERY_H[m]) ? LP.RECOVERY_H[m] : 48;
      var elapsedH = (_daysBetween(lastHeavy, today) || 0) * 24;
      muscleReadiness[m] = _r2(Math.max(0, Math.min(1, elapsedH / need)));
    });

    /* --- 3. VERDICHTETER ZUSTAND (additiv, nicht ersetzend) --- */
    var trainingState = _trainingState(byDay, dayList, rolling, completeness);

    /* --- Tolerance State — aus den Debriefs, NICHT aus der Last --- */
    var toleranceState = null;
    if (SD) {
      var debriefs = (Array.isArray(o.debriefs) ? o.debriefs : []).filter(function (d) {
        /* Nur eingefrorene Datensätze zählen: Ein Debrief ohne Snapshot könnte
           gegen heutige Zonen umgedeutet worden sein und wäre als Grundwahrheit
           nicht mehr belastbar. */
        return SD.isFrozen ? SD.isFrozen(d) : !!d;
      }).map(function (d) { return SD.fromRecord ? SD.fromRecord(d) : d; }).filter(Boolean);
      toleranceState = SD.toleranceState(debriefs, { sports: o.sports || null });
      toleranceState.fromRecords = debriefs.length;
      toleranceState.rejectedRecords = (Array.isArray(o.debriefs) ? o.debriefs.length : 0) - debriefs.length;
    }

    return {
      version: VERSION, policyVersion: POLICY_VERSION,
      /* ZWEI GETRENNTE SICHTEN AUF DIE LAST.
         `observed…` enthaelt den laufenden Tag — er soll sichtbar sein.
         `rolling`/`trainingState` enthalten ihn NICHT — ein halber Tag darf
         keinen Trend verzerren und keine Progression tragen. */
      observedToday: byDay[today] ? byDay[today].systemic : null,
      observedIncludingPartial: _r2(_sum(dayList.map(function (d) { return byDay[d].systemic; }))),
      decisionLoadCompletedDaysOnly: _r2(_sum(dayList
        .filter(function (d) { return !byDay[d].partial; })
        .map(function (d) { return byDay[d].systemic; }))),
      possibleDuplicates: possibleDuplicates,
      thresholds: { acuteChronic: MIN_COMPLETENESS.acuteChronic,
        trend: MIN_COMPLETENESS.trend, monotony: MIN_COMPLETENESS.monotony },
      today: today, days: days, duplicatesIgnored: duplicates,
      byDay: byDay, rolling: rolling, acuteChronic: acuteChronic,
      muscleReadiness: muscleReadiness,
      gaps: gaps, completeness: completeness,
      trainingState: trainingState,
      toleranceState: toleranceState
    };
  }

  /* Verdichtung für den Designer. Jede Kennzahl trägt ihren Belegzustand —
     eine Zahl aus halber Datenlage darf nicht aussehen wie eine aus voller. */
  function _trainingState(byDay, dayList, rolling, completeness) {
    var known = dayList.filter(function (d) { return !byDay[d].unknown; });
    var vals = known.map(function (d) { return byDay[d].systemic; });

    /* Trend: Mittel der letzten 7 bekannten Tage gegen die 8–21 davor. */
    var loadTrend = 'unknown', trendPct = null;
    if (rolling[7].completeness >= MIN_COMPLETENESS.trend && rolling[28].completeness >= MIN_COMPLETENESS.trend) {
      var recent = rolling[7].systemicPerKnownDay;
      var older = rolling[28].systemicPerKnownDay;
      if (recent != null && older > 0) {
        trendPct = _r2((recent - older) / older * 100);
        loadTrend = trendPct > 12 ? 'rising' : trendPct < -12 ? 'falling' : 'stable';
      }
    }

    /* Konsistenz: Anteil der bekannten Tage mit Training — NUR über bekannte
       Tage, sonst bestraft ein vergessenes Log die Konsistenz. */
    var consistency = known.length ? _r2(known.filter(function (d) { return byDay[d].systemic > 0; }).length / known.length) : null;

    /* Monotony/Strain (Foster). Berechnet und ausgewiesen, aber ADVISORY:
       Ihre Reproduzierbarkeit ist in Folgestudien deutlich schwächer ausgefallen
       als ihre Verbreitung vermuten lässt. Sie gehen NICHT in Planung ein. */
    var monotony = null, strain = null;
    var last7 = dayList.slice(-7).filter(function (d) { return !byDay[d].unknown; });
    if (last7.length >= 5 && rolling[7].completeness >= MIN_COMPLETENESS.monotony) {
      var v7 = last7.map(function (d) { return byDay[d].systemic; });
      var sd = _sd(v7);
      if (sd > 0) { monotony = _r2(_mean(v7) / sd); strain = _r2(_sum(v7) * monotony); }
    }

    var sessionDensity = known.length ? _r2(_sum(known.map(function (d) { return byDay[d].sessions.length; })) / known.length) : null;

    var evidence = 'unknown';
    if (EV) {
      evidence = completeness >= 0.9 ? 'moderate' : completeness >= 0.6 ? 'weak' : 'unknown';
    }

    return {
      loadTrend: loadTrend, trendPct: trendPct,
      consistency: consistency,
      monotony: monotony, strain: strain,
      monotonyAdvisory: true,
      sessionDensity: sessionDensity,
      knownDays: known.length, totalDays: dayList.length,
      completeness: completeness,
      evidence: evidence,
      /* Handlungsfähig erst ab belastbarer Datenlage — dieselbe Trennung wie
         bei der Toleranz (C3): Beobachtung ist nicht Handlungsgrundlage. */
      actionable: !!EV && EV.rank(evidence) >= EV.rank('moderate')
    };
  }

  function _empty(reason) {
    return { version: VERSION, today: null, byDay: {}, rolling: { 7: null, 14: null, 28: null },
      acuteChronic: { ratio: null, band: 'insufficient_data', reason: reason },
      muscleReadiness: {}, gaps: [], completeness: 0,
      trainingState: { loadTrend: 'unknown', consistency: null, monotony: null, strain: null,
        sessionDensity: null, completeness: 0, evidence: 'unknown', actionable: false },
      toleranceState: null, reason: reason };
  }

  var api = {
    VERSION: VERSION, POLICY_VERSION: POLICY_VERSION,
    MUSCLES: MUSCLES, MIN_COMPLETENESS: MIN_COMPLETENESS, SPORT_ALIAS: SPORT_ALIAS,
    identityOf: identityOf, identityCertain: identityCertain,
    buildHistory: buildHistory, loadOf: loadOf, strengthLoadOf: strengthLoadOf, asUnit: asUnit
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.loadHistory = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
