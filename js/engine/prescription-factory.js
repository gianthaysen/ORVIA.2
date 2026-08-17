/* ============================================================
   ORVIA · prescription-factory — S5 (Phase 7, 2026-08-05, SHADOW-ONLY).

   Erzeugt Session Prescriptions im NEUTRALEN Workout-Schema aus Vertrag 4
   (ENGINE-VERTRAEGE-2026-08.md): { sport_id, session_type, goal, priority,
   blocks[{type, completion, target, iterations, blocks, …}] }.
   ORVIA plant NIE im Geräteformat — Garmin/FIT sind spätere Adapter.

   Template-Modell: strukturierte, versionierte DATEN (kein Codepfad je Session-
   Typ). Ersetzt perspektivisch die hartcodierte PLAN_PRESETS-Frontend-Liste
   (ui.js) — diese bleibt bis zur Scheduler-v2-Umstellung unangetastet (kein
   Live-Eingriff). DB-Persistenz der Templates folgt mit eigener Migration,
   wenn der Scheduler live geht; shadow braucht keine DB.

   Fail-closed (RUN-INT-001 / Vertrag 6):
   - HARTE Pace-Zielbereiche NUR bei übergebener Pace-Evidenz
     (evidence.thresholdPaceSecPerKm + confidence != 'low'); sonst RPE-Ziel +
     Flag no_pace_evidence_rpe_fallback — es wird NIE eine Pace erfunden.
   - intensity 'intense' ohne jede Evidenz ⇒ Prescription wird NICHT quantitativ
     verschärft, sondern RPE-geführt ausgegeben (weniger Automatisierung,
     nicht mehr Heuristik).
   - Unbekannter Template-/Sporttyp ⇒ blocked mit Grund, nie ein Zufallsplan.

   Reinheit: pure + deterministisch (kein Date/Random/DOM/Storage/PROFILE).
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'prescription-v1.0.0';

  /* ---------- Vertrag-4-Validator (normativ, von Tests mitbenutzt) ---------- */
  var COMPLETION = ['duration', 'distance', 'reps', 'open'];
  var TARGET = ['pace', 'speed', 'power', 'hr', 'hr_zone', 'rpe', 'rir', 'weight', 'cadence', 'open'];
  var BLOCK = ['warmup', 'work', 'recovery', 'repeat', 'exercise', 'cooldown', 'skill', 'open'];
  function _vBlock(b, path, errs) {
    if (!b || typeof b !== 'object') { errs.push(path + ':no_object'); return; }
    if (BLOCK.indexOf(b.type) < 0) errs.push(path + ':unknown_block_type');
    if (b.type === 'repeat') {
      if (!(b.iterations >= 1) || b.iterations !== Math.floor(b.iterations)) errs.push(path + ':repeat_iterations');
      if (!Array.isArray(b.blocks) || !b.blocks.length) errs.push(path + ':repeat_empty');
      else b.blocks.forEach(function (x, i) { _vBlock(x, path + '.' + i, errs); });
      return;
    }
    if (b.type === 'exercise') {
      if (typeof b.exercise_id !== 'string' || !b.exercise_id) errs.push(path + ':exercise_id');
      if (!(b.sets >= 1)) errs.push(path + ':sets');
    } else {
      var c = b.completion;
      if (!c || COMPLETION.indexOf(c.type) < 0) errs.push(path + ':completion');
      else if (c.type !== 'open' && !(typeof c.value === 'number' && isFinite(c.value) && c.value > 0)) errs.push(path + ':completion_value');
    }
    var t = b.target;
    if (t != null) {
      if (TARGET.indexOf(t.type) < 0) errs.push(path + ':unknown_target');
      var hasVal = t.value != null, hasRange = t.min != null || t.max != null;
      if (hasVal && hasRange) errs.push(path + ':target_value_and_range');
      if (t.type !== 'open' && !hasVal && !hasRange) errs.push(path + ':target_empty');
    }
  }
  function validateWorkout(w) {
    var errs = [];
    if (!w || typeof w !== 'object') return ['no_object'];
    if (typeof w.sport_id !== 'string' || !w.sport_id) errs.push('sport_id');
    if (!Array.isArray(w.blocks) || !w.blocks.length) errs.push('blocks_empty');
    else w.blocks.forEach(function (b, i) { _vBlock(b, 'blocks[' + i + ']', errs); });
    return errs;
  }

  /* ---------- Zielhilfen: NUR echte Evidenz erzeugt harte Bereiche ---------- */
  function _paceEvidence(ev) {
    return !!(ev && typeof ev.thresholdPaceSecPerKm === 'number' && isFinite(ev.thresholdPaceSecPerKm)
      && ev.thresholdPaceSecPerKm > 120 && ev.thresholdPaceSecPerKm < 900 && ev.confidence && ev.confidence !== 'low');
  }
  function _rpeTarget(v) { return { type: 'rpe', value: v }; }
  function _paceRange(sec, lowPct, highPct) {
    return { type: 'pace', min: Math.round(sec * lowPct), max: Math.round(sec * highPct), unit: 's_per_km' };
  }

  /* ---------- v8-337 · ALLE Produktzahlen an EINEM Ort ----------
     Bis hierher lagen die Zahlen verstreut im Code: `_rpeTarget(7)` mitten in
     einem ternaeren Ausdruck, `0.25` und `0.15` als nackte Faktoren, `repMin
     = 4`. Sie sahen aus wie Fachwissen, waren aber Produktentscheidungen —
     und niemand konnte sie finden, pruefen oder ersetzen.

     Sie sind NICHT falsch. Sie sind ORVIA-Entscheidungen ohne Quelle, und
     genau so muessen sie dastehen: benannt, an einer Stelle, mit [A]
     gekennzeichnet und aus eingespeistem Wissen ueberschreibbar. Der
     Unterschied zu vorher ist nicht der Wert, sondern die Sichtbarkeit.

     Die PACE-FAKTOREN stehen bewusst NICHT hier: sie sind der fachliche Kern
     der Templates, in phase7_s5 einzeln geprueft und in Probe F1 abgesichert.
     Sie hierher zu ziehen wuerde sie zu beliebig aussehen lassen. */
  var DEFAULTS = {
    /* [A] Anteile der Einheit fuer Auf- und Auswaermen. Faustwerte, keine
       Messung. Untergrenzen, damit eine kurze Einheit nicht ohne Aufwaermen
       dasteht. */
    warmupAnteil: 0.25, warmupMinMin: 10,
    cooldownAnteil: 0.15, cooldownMinMin: 5,
    /* [A] Zuschnitt eines VO2-Intervalls. */
    intervallMin: 4, trabpauseMin: 3, intervalleMin: 3, intervalleMax: 6,
    /* [A] RPE-Rueckfallwerte, wenn keine belastbare Pace-Evidenz vorliegt.
       Sie ersetzen kein Tempo — sie sagen "nach Gefuehl, so ungefaehr". Der
       Rueckfall wird ohnehin geflaggt (no_pace_evidence_rpe_fallback). */
    rpeEasy: 3, rpeLong: 4, rpeTempo: 7, rpeIntervall: 8,
    /* [A] Aufwaermen laeuft locker. */
    rpeWarmup: 3,
    /* [A] Zielwert einer Kraftuebung ohne eigene RIR-Angabe. */
    rpeKraft: 7
  };
  /* Eine Zahl aus eingespeistem Wissen schlaegt den Produktwert — und sagt
     im Flag, woher sie kommt. Ohne Wissen bleibt der Produktwert, ebenfalls
     benannt: `produktwert:rpeTempo`. Damit ist an jeder Verordnung ablesbar,
     welche Zahl eine Quelle hat und welche nicht. */
  /* ============================================================
     v8-349 — WISSEN, DAS KEINE ZAHL IST, LANDET TROTZDEM AUF DER KARTE.

     Bis hierher galt: was die Verordnung nicht als Zahl oder Liste einbauen
     kann, wirkt nicht. 41 Ziele standen deshalb als „ohne Leser" in einer
     Quittungsliste — Wissen, das jemand recherchiert, geprueft und
     eingespeist hat, und das dann nirgends ankam.

     Das war eine zu enge Vorstellung davon, was WIRKEN heisst. Ein Satz wie
     „aus isolierten Krafttests laesst sich die Laufleistung nicht
     vorhersagen" aendert keine Satzzahl — er aendert, was der Nutzer von
     seinen Werten erwartet. Er gehoert angezeigt, nicht verwaltet.

     Ab jetzt gibt jede Verordnung `hinweise` zurueck: jede Wissensvorgabe,
     die nicht als Wert eingebaut wurde, mit Aussage, Herkunft, Grenzen und
     Ausschluessen. `prescription-format` macht daraus Zeilen.

     Die Grenzen bleiben: ein Hinweis aendert KEINE Zahl, sperrt nichts und
     wird nicht erfunden. Ohne Wissen gibt es keine Hinweise — nicht etwa
     allgemeine Ratschlaege. */
  function _hinweiseAus(req, verwendeteZiele) {
    var vorgaben = (req && req.knowledge && Array.isArray(req.knowledge.vorgaben)) ? req.knowledge.vorgaben : null;
    if (!vorgaben || !vorgaben.length) return [];
    var out = [], nachSatz = {};
    for (var i = 0; i < vorgaben.length; i++) {
      var v = vorgaben[i];
      if (!v || !v.ziel) continue;
      /* Was bereits als Zahl oder Liste in der Verordnung steht, wird nicht
         noch einmal als Hinweis wiederholt — sonst stuende dieselbe Aussage
         zweimal auf der Karte. */
      if (verwendeteZiele.indexOf(v.ziel) >= 0) continue;
      if (!v.aussage) continue;
      /* DERSELBE SATZ NUR EINMAL. Eine Regel darf mehrere Ziele nennen —
         GYM-HYP-003 nennt Last UND Wiederholungen — traegt aber EINEN Satz.
         Ohne diese Zusammenfassung stuende er wortgleich zweimal
         untereinander auf der Karte. Aufgefallen ist das im Ausgabetext von
         knowledge_hinweise_test.mjs, nicht durch eine Zusicherung: eine
         Doppelung ist technisch korrekt und trotzdem falsch. */
      var schluessel = (v.regelId || '?') + ' ' + v.aussage;
      if (nachSatz[schluessel]) {
        if (nachSatz[schluessel].ziele.indexOf(v.ziel) < 0) nachSatz[schluessel].ziele.push(v.ziel);
        continue;
      }
      var eintrag = {
        ziel: v.ziel,
        /* Alle Ziele, die derselbe Satz bedient — der Sensor liest diese
           Liste, damit ein zusammengefasstes Ziel nicht als „kommt nicht
           an" gezaehlt wird. */
        ziele: [v.ziel],
        regelId: v.regelId || null,
        aussage: v.aussage,
        /* Der vorsichtige Weg gehoert dazu, nicht in eine Fussnote. */
        wennUnsicher: v.wennUnsicher || null,
        grenzen: Array.isArray(v.sicherheitsgrenzen) ? v.sicherheitsgrenzen.slice()
          : (typeof v.grenzen === 'string' ? [v.grenzen] : []),
        giltNichtFuer: Array.isArray(v.giltNichtFuer) ? v.giltNichtFuer.slice() : [],
        /* Ein Hinweis ohne Herkunft waere eine anonyme Behauptung. */
        herkunft: v.herkunft || null,
        /* Ehrlich mitgefuehrt: eine Zahl WAERE da, ist aber nicht freigegeben. */
        zahlGesperrt: v.zahlGesperrt === true
      };
      nachSatz[schluessel] = eintrag;
      out.push(eintrag);
    }
    return out;
  }

  /* ============================================================
     v8-351 — DER ERSTE ANWENDER, DER EINE ZAHL PRUEFT STATT SIE ZU SETZEN.

     GYM-HYP-002 nennt „fuenf bis sechs Saetze pro Muskelgruppe und Einheit,
     verteilt ueber alle Uebungen, die diese Muskelgruppe belasten". Diese
     Zahl laesst sich NICHT vorschreiben: die Quelle verbietet die Umrechnung
     auf Saetze je Uebung woertlich („Diese Zahl darf session.sets nicht
     speisen"), und sie gilt fuer eine Muskelgruppe, die erst aus der
     Uebungsauswahl entsteht.

     Was sie kann, ist PRUEFEN: liegen die geplanten Saetze einer
     Muskelgruppe ausserhalb von 5 bis 6, wird das gemeldet — mit Herkunft,
     Grenzen und Ausschluessen wie jeder andere Hinweis.

     WAS DER PRUEFER NICHT TUT:
       • er aendert keine Satzzahl, keine Uebung, keine Pause
       • er erfindet keine Muskelzuordnung — was `planned-volume` nicht
         zuordnen kann, wird als unzugeordnet gemeldet, nicht weggelassen
       • er meldet nichts ohne Wissen: ohne Vorgabe gibt es keinen Befund,
         auch nicht bei zwoelf Saetzen auf einen Muskel

     WAS DER BEFUND VON DER QUELLE TRENNT: `aussage` bleibt der Satz der
     Quelle, unveraendert. Die Messung steht getrennt in `befund`. Wer beides
     zusammenzoege, legte ORVIA-Zahlen in den Mund einer Uebersichtsarbeit
     von 2007. ============================================================ */
  function _muskelHinweise(req, exs) {
    var vorgaben = (req && req.knowledge && Array.isArray(req.knowledge.vorgaben)) ? req.knowledge.vorgaben : null;
    if (!vorgaben || !Array.isArray(exs) || !exs.length) return [];
    var v = null;
    for (var i = 0; i < vorgaben.length; i++) {
      var c = vorgaben[i];
      if (c && c.ziel === 'plan.saetze_je_muskelgruppe' && c.art === 'zahl' && c.wert) { v = c; break; }
    }
    if (!v) return [];
    var PV = O.plannedVolume, GV = O.gymVolume;
    /* Ohne Zaehler wird NICHT geraten und auch nicht stillschweigend
       geschwiegen — der Aufrufer sieht am fehlenden Hinweis nichts, deshalb
       steht der Grund im Flag (siehe buildPrescription). */
    if (!PV || typeof PV.plannedMuscleSets !== 'function') return [];
    var erg = PV.plannedMuscleSets(exs, { gymVolume: GV });
    var raus = PV.ausserhalb(erg.byMuscle, v.wert.min, v.wert.max);
    if (!raus.length) return [];
    var label = function (mk) {
      return (GV && GV.MUSCLE_LABEL && GV.MUSCLE_LABEL[mk]) ? GV.MUSCLE_LABEL[mk] : mk;
    };
    var teile = raus.map(function (r) {
      return label(r.muscle) + ' ' + r.sets + (r.sets === 1 ? ' Satz' : ' Saetze');
    });
    /* EIN Hinweis fuer alle betroffenen Muskelgruppen, nicht einer je
       Gruppe: es ist dieselbe Regel und derselbe Satz. Fuenf Zeilen mit
       identischem Quellentext waeren genau die Doppelung, die v8-349
       abgestellt hat. */
    return [{
      ziel: 'plan.saetze_je_muskelgruppe',
      ziele: ['plan.saetze_je_muskelgruppe'],
      regelId: v.regelId || null,
      aussage: v.aussage,
      befund: teile.join(' · ') + ' geplant — die Quelle nennt '
        + v.wert.min + ' bis ' + v.wert.max
        + (v.einheit ? ' (' + v.einheit + ')' : ''),
      wennUnsicher: v.wennUnsicher || null,
      grenzen: Array.isArray(v.sicherheitsgrenzen) && v.sicherheitsgrenzen.length ? v.sicherheitsgrenzen.slice()
        : (typeof v.grenzen === 'string' && v.grenzen ? [v.grenzen] : []),
      giltNichtFuer: Array.isArray(v.giltNichtFuer) ? v.giltNichtFuer.slice() : [],
      herkunft: v.herkunft || null,
      zahlGesperrt: false,
      /* Mitgefuehrt, damit die Oberflaeche sagen kann, worauf sich der
         Befund NICHT stuetzt. Eine Summe ueber die Haelfte der Uebungen ist
         keine Summe. */
      nichtGezaehlt: erg.unclassified.slice()
    }];
  }

  /* v8-347: Aufzaehlungen aus Wissen (Vertrag v7, art 'liste'). Bewusst OHNE
     Produktwert-Fallback: eine erfundene Uebungsliste waere schlimmer als
     keine. Gibt es nichts, gibt es null — der Aufrufer entscheidet sichtbar. */
  function _ausWissenListe(ziel, req) {
    /* Eigener Variablenname (nicht `w` wie in _zahl): sonst steht diese Zeile
       zweimal wortgleich in der Datei und der Anker der Probe F12 wird
       mehrdeutig. Das Probenwerkzeug hat genau das gemeldet. */
    var vorgaben = (req && req.knowledge && Array.isArray(req.knowledge.vorgaben)) ? req.knowledge.vorgaben : null;
    if (!vorgaben || !ziel) return null;
    for (var i = 0; i < vorgaben.length; i++) {
      var v = vorgaben[i];
      if (v && v.ziel === ziel && v.art === 'liste' && Array.isArray(v.werte) && v.werte.length) return v;
    }
    return null;
  }

  function _zahl(schluessel, ziel, req, flags) {
    var w = (req && req.knowledge && Array.isArray(req.knowledge.vorgaben)) ? req.knowledge.vorgaben : null;
    if (w && ziel) {
      for (var i = 0; i < w.length; i++) {
        var v = w[i];
        if (v && v.ziel === ziel && v.art === 'zahl' && v.wert) {
          flags.push(schluessel + '_aus_wissen:' + v.regelId);
          return v.wert.min;
        }
      }
    }
    flags.push('produktwert:' + schluessel);
    return DEFAULTS[schluessel];
  }

  /* ---------- Endurance-Templates (Daten, versioniert) ----------
     buildFn(durMin, ev, flags) → blocks[]. Faktoren relativ zur Schwellenpace:
     easy 1.25–1.40 · long 1.20–1.35 · tempo 1.02–1.08 · vo2-Intervall 0.92–0.98. */
  var TEMPLATES = {
    endurance_easy: { v: 1, goal: 'aerobic_base', build: function (durMin, ev, flags, req) {
      var t = _paceEvidence(ev) ? _paceRange(ev.thresholdPaceSecPerKm, 1.25, 1.40)
        : (flags.push('no_pace_evidence_rpe_fallback'), _rpeTarget(_zahl('rpeEasy', 'session.rpe_easy', req, flags)));
      return [{ type: 'work', completion: { type: 'duration', value: durMin * 60, unit: 's' }, target: t }];
    } },
    endurance_long: { v: 1, goal: 'long_endurance', build: function (durMin, ev, flags, req) {
      var t = _paceEvidence(ev) ? _paceRange(ev.thresholdPaceSecPerKm, 1.20, 1.35)
        : (flags.push('no_pace_evidence_rpe_fallback'), _rpeTarget(_zahl('rpeLong', 'session.rpe_long', req, flags)));
      return [{ type: 'work', completion: { type: 'duration', value: durMin * 60, unit: 's' }, target: t }];
    } },
    endurance_tempo: { v: 1, goal: 'threshold', build: function (durMin, ev, flags, req) {
      var wu = Math.max(_zahl('warmupMinMin', null, req, flags), Math.round(durMin * _zahl('warmupAnteil', 'session.warmup_anteil', req, flags)));
      var cd = Math.max(_zahl('cooldownMinMin', null, req, flags), Math.round(durMin * _zahl('cooldownAnteil', 'session.cooldown_anteil', req, flags)));
      var core = durMin - wu - cd;
      var t = _paceEvidence(ev) ? _paceRange(ev.thresholdPaceSecPerKm, 1.02, 1.08)
        : (flags.push('no_pace_evidence_rpe_fallback'), _rpeTarget(_zahl('rpeTempo', 'session.rpe_tempo', req, flags)));
      return [
        { type: 'warmup', completion: { type: 'duration', value: wu * 60, unit: 's' }, target: _rpeTarget(_zahl('rpeWarmup', 'session.rpe_warmup', req, flags)) },
        { type: 'work', completion: { type: 'duration', value: core * 60, unit: 's' }, target: t },
        { type: 'cooldown', completion: { type: 'duration', value: cd * 60, unit: 's' }, target: { type: 'open' } }
      ];
    } },
    endurance_intervals: { v: 1, goal: 'vo2max', build: function (durMin, ev, flags, req) {
      var wu = Math.max(_zahl('warmupMinMin', null, req, flags), Math.round(durMin * _zahl('warmupAnteil', 'session.warmup_anteil', req, flags)));
      var cd = Math.max(_zahl('cooldownMinMin', null, req, flags), Math.round(durMin * _zahl('cooldownAnteil', 'session.cooldown_anteil', req, flags)));
      var core = durMin - wu - cd;
      var repMin = _zahl('intervallMin', 'session.intervall_min', req, flags);
      var recMin = _zahl('trabpauseMin', 'session.trabpause_min', req, flags);
      var iters = Math.max(_zahl('intervalleMin', null, req, flags),
        Math.min(_zahl('intervalleMax', null, req, flags), Math.floor(core / (repMin + recMin))));
      var t = _paceEvidence(ev) ? _paceRange(ev.thresholdPaceSecPerKm, 0.92, 0.98)
        : (flags.push('no_pace_evidence_rpe_fallback'), _rpeTarget(_zahl('rpeIntervall', 'session.rpe_intervall', req, flags)));
      return [
        { type: 'warmup', completion: { type: 'duration', value: wu * 60, unit: 's' }, target: _rpeTarget(_zahl('rpeWarmup', 'session.rpe_warmup', req, flags)) },
        { type: 'repeat', iterations: iters, blocks: [
          { type: 'work', completion: { type: 'duration', value: repMin * 60, unit: 's' }, target: t },
          { type: 'recovery', completion: { type: 'duration', value: recMin * 60, unit: 's' }, target: { type: 'open' } }
        ] },
        { type: 'cooldown', completion: { type: 'duration', value: cd * 60, unit: 's' }, target: { type: 'open' } }
      ];
    } },
    strength_general: { v: 1, goal: 'strength', build: function (durMin, ev, flags, req) {
      var exs = (req && Array.isArray(req.exercises) && req.exercises.length) ? req.exercises : null;
      /* v8-347 — SECHS REGELN AUS DREI QUELLEN zielen auf `session.exercises`,
         und bis hierher endete das Ziel im Nichts: die Verordnung fuehrte eine
         Uebungsliste, las sie aber ausschliesslich aus `req.exercises`.
         Seit Vertrag v7 kann Wissen Aufzaehlungen tragen — also wird hier
         gelesen, BEVOR die generische Einheit entsteht.

         Die Reihenfolge bleibt streng: (1) was der Aufrufer mitgibt,
         (2) was aus Wissen kommt — mit Herkunft im Flag, (3) die generische
         Einheit mit Flag. Ohne Wissen aendert sich kein Zeichen am bisherigen
         Verhalten; erfunden wird an keiner Stelle etwas. */
      if (!exs) {
        var wListe = _ausWissenListe('session.exercises', req);
        if (wListe) {
          flags.push('exercises_aus_wissen:' + wListe.regelId);
          exs = wListe.werte.map(function (name) { return { exerciseId: name }; });
        }
      }
      if (!exs) { flags.push('no_exercise_list_generic_session'); return [
        { type: 'exercise', exercise_id: 'generic_strength_session', sets: 1, repetitions: null, rest_seconds: null,
          target: _rpeTarget(_zahl('rpeKraft', 'session.rpe_kraft', req, flags)),
          notes: 'Übungsliste folgt aus dem Kraft-Pack — keine erfundene Übungsauswahl.' }]; }
      /* v8-336 — WIDERSPRUCH IM EIGENEN PROJEKT, hier behoben.
         Hier stand `sets: e.sets >= 1 ? e.sets : 3` und `rest_seconds: … : 120`.
         Beides waren geratene Zahlen — und `strength-plan@1` verbietet genau
         das woertlich: "Satzanzahl ist Pflicht. Kein Default — 3 waere
         geraten." Zwei Module desselben Projekts widersprachen sich, und die
         Factory gewann still.

         Neu gilt die Reihenfolge: (1) was die Uebung selbst mitbringt,
         (2) was aus eingespeistem WISSEN kommt — mit Herkunft, (3) gar
         nichts, sichtbar als Flag. Geraten wird an keiner Stelle mehr. */
      var wissen = (req && req.knowledge) || null;
      var ausWissen = function (ziel) {
        if (!wissen || !Array.isArray(wissen.vorgaben)) return null;
        for (var i = 0; i < wissen.vorgaben.length; i++) {
          var v = wissen.vorgaben[i];
          if (v && v.ziel === ziel && v.art === 'zahl' && v.wert) return v;
        }
        return null;
      };
      var setsV = ausWissen('session.sets'), restV = ausWissen('session.rest_seconds');
      /* v8-348: der kuerzeste offene Anschluss aus der Quittungsliste — das
         Feld `repetitions` gab es hier laengst, es wurde nur nie aus Wissen
         gefuellt. Reihenfolge wie ueberall: was die Uebung mitbringt, dann
         Wissen mit Herkunft, sonst nichts. */
      var repsV = ausWissen('session.repetitions');
      if (setsV) flags.push('sets_aus_wissen:' + setsV.regelId);
      if (restV) flags.push('rest_aus_wissen:' + restV.regelId);
      if (repsV) flags.push('reps_aus_wissen:' + repsV.regelId);
      return exs.map(function (e) {
        var sets = (e.sets >= 1) ? e.sets : (setsV ? setsV.wert.min : null);
        var rest = (e.restSeconds != null) ? e.restSeconds : (restV ? restV.wert.min : null);
        /* v8-338 — GEFUNDEN BEIM ERSTEN ECHTEN DURCHLAUF MIT EINGESPEISTEM
           WISSEN. Hier stand `String(e.exerciseId || e.id)`. Fehlen beide,
           ergibt das die Zeichenkette "undefined" — und auf der Wochenkarte
           stand woertlich:

               undefined — 4 × 5 · RPE 7 · 3 min Pause

           Kein Fehler, kein Flag, keine Sperre: eine Uebung ohne Kennung
           wurde zu einer Uebung NAMENS "undefined". Genau die Sorte
           Fail-Open, die der Rest der Factory seit v8-336 vermeidet.
           Jetzt: keine Kennung ⇒ null ⇒ der Validator sperrt die Verordnung,
           so wie er es bei fehlender Satzzahl auch tut. */
        var eid = (typeof e.exerciseId === 'string' && e.exerciseId) ? e.exerciseId
          : (typeof e.id === 'string' && e.id) ? e.id : null;
        var eidText = eid === null ? '(ohne Kennung)' : eid;
        if (eid === null) flags.push('uebung_ohne_kennung');
        if (sets === null) flags.push('sets_unbekannt:' + eidText);
        if (rest === null) flags.push('pause_unbekannt:' + eidText);
        return { type: 'exercise', exercise_id: eid, sets: sets,
          repetitions: (e.reps != null) ? e.reps : (repsV ? repsV.wert.min : null), rest_seconds: rest,
          target: (e.rir != null) ? { type: 'rir', value: e.rir } : _rpeTarget(_zahl('rpeKraft', 'session.rpe_kraft', req, flags)) };
      });
    } }
  };

  /* ---------- Hauptfunktion ----------
     req: { sportId, sessionType (Template-Key), durationMin, priority, exercises? }
     evidence: { thresholdPaceSecPerKm?, confidence? } — NUR echte Werte übergeben. */
  function buildPrescription(req, evidence) {
    req = req || {};
    var tpl = TEMPLATES[req.sessionType];
    if (!tpl) return { ok: false, blocked: 'unknown_session_type', sessionType: req.sessionType || null, workout: null };
    if (typeof req.sportId !== 'string' || !req.sportId) return { ok: false, blocked: 'sport_id_missing', workout: null };
    var durMin = (typeof req.durationMin === 'number' && isFinite(req.durationMin) && req.durationMin >= 15) ? Math.round(req.durationMin) : null;
    if (durMin == null && req.sessionType !== 'strength_general') return { ok: false, blocked: 'duration_missing_or_too_short', workout: null };
    var flags = [];
    var blocks = tpl.build(durMin || 0, evidence || null, flags, req);
    var workout = { sport_id: req.sportId, session_type: req.sessionType, goal: tpl.goal,
      priority: req.priority || 'build', blocks: blocks };
    var errs = validateWorkout(workout);
    if (errs.length) return { ok: false, blocked: 'schema_invalid', errors: errs, workout: null };   // Selbstprüfung
    /* Welche Ziele sind bereits als WERT eingebaut? Genau die stehen im
       Register — sie werden nicht zusaetzlich als Hinweis wiederholt. */
    var verwendet = [];
    (flags || []).forEach(function (f) {
      if (typeof f !== 'string') return;
      if (f.indexOf('sets_aus_wissen:') === 0) verwendet.push('session.sets');
      else if (f.indexOf('rest_aus_wissen:') === 0) verwendet.push('session.rest_seconds');
      else if (f.indexOf('reps_aus_wissen:') === 0) verwendet.push('session.repetitions');
      else if (f.indexOf('exercises_aus_wissen:') === 0) verwendet.push('session.exercises');
      else if (f.indexOf('_aus_wissen:') > 0) {
        var s2 = f.split('_aus_wissen:')[0];
        verwendet.push('session.' + s2.replace(/^rpe/, 'rpe_').toLowerCase());
      }
    });
    var hinweise = _hinweiseAus(req, verwendet);

    /* v8-351 — der Pruefbefund kommt HINTER die Quellenhinweise, weil er
       sich auf die konkrete Einheit bezieht und nicht allgemein gilt.
       `plan.saetze_je_muskelgruppe` steht dadurch zweimal im Ergebnis:
       einmal als Aussage der Quelle (aus _hinweiseAus), einmal als Befund.
       Das ist gewollt und NICHT die Doppelung aus v8-349 — dort stand
       zweimal derselbe Satz, hier stehen Aussage und Messung. Damit auf der
       Karte trotzdem nur eine Zeile steht, faellt die reine Aussage weg,
       sobald es einen Befund gibt. */
    var muskel = _muskelHinweise(req, (req && req.exercises) || null);
    if (muskel.length) {
      hinweise = hinweise.filter(function (h) { return h.ziel !== 'plan.saetze_je_muskelgruppe'; });
      hinweise = hinweise.concat(muskel);
      flags.push('muskelvolumen_geprueft:' + muskel[0].regelId);
      if (muskel[0].nichtGezaehlt && muskel[0].nichtGezaehlt.length) {
        flags.push('muskelvolumen_unvollstaendig:' + muskel[0].nichtGezaehlt.length);
      }
    }
    if (hinweise.length) flags.push('hinweise_aus_wissen:' + hinweise.length);

    return { ok: true, workout: workout, flags: flags, hinweise: hinweise,
      provenance: { factory: VERSION, templateId: req.sessionType, templateVersion: tpl.v,
        paceEvidenceUsed: _paceEvidence(evidence || null) } };
  }

  /* ============================================================
     DAS ZIELREGISTER (v8-344)

     WOZU. Eine Wissensregel nennt in `outputs`, worauf sie wirken will.
     Bis hierher hat das NIEMAND geprueft: jede Zeichenkette wurde
     angenommen. Eine Regel mit dem Ziel `plan.kraftvergleich_normierung`
     (QUELLE-11) lief durch Einspeisung, Vertrag und Anwendung, erzeugte
     eine Vorgabe — und wirkte auf nichts, weil diese Verordnung das Ziel
     gar nicht kennt. Ein Tippfehler (`session.rest_secons`) verhaelt sich
     exakt genauso: still, gruen, wirkungslos.

     GEMESSEN am 2026-08-13, bevor es dieses Register gab:
       Gym-Paket     1 von 5 Zielen hatte einen Leser
       Laufpaket     0 von 25

     Die Liste steht hier als LITERAL und wird nicht zur Laufzeit aus dem
     Code zusammengesucht. `knowledge_targets_test.mjs` prueft sie
     BEIDSEITIG gegen die tatsaechlich im Quelltext gelesenen Ziele: keines
     darf fehlen, keines zu viel drinstehen. Wer ein Ziel neu liest, traegt
     es hier ein — wer eines entfernt, ebenso.

     WAS DAS REGISTER NICHT TUT: es verbietet nichts. Ein Ziel ohne Leser
     ist kein Vertragsbruch, sondern Wissen, das noch keine Verwendung hat.
     Der Unterschied gehoert sichtbar gemacht, nicht bestraft.
     ============================================================ */
  var GELESENE_ZIELE = ['session.cooldown_anteil', 'session.exercises', 'session.intervall_min',
    'session.repetitions', 'session.rest_seconds', 'session.rpe_easy', 'session.rpe_intervall',
    'session.rpe_kraft', 'session.rpe_long', 'session.rpe_tempo', 'session.rpe_warmup',
    'session.sets', 'session.trabpause_min', 'session.warmup_anteil'];

  /* ============================================================
     DAS ZWEITE REGISTER (v8-351) — GEPRUEFTE ZIELE.

     WARUM ES NICHT IN GELESENE_ZIELE GEHOERT. Dort steht, was die Verordnung
     als WERT einbaut: eine Zahl aus Wissen ersetzt einen Produktwert und
     landet im Workout. `plan.saetze_je_muskelgruppe` tut das ausdruecklich
     NICHT — die Quelle verbietet es. Es wird gelesen, um eine geplante
     Einheit dagegen zu PRUEFEN.

     Beides in eine Liste zu werfen waere bequem und falsch: der Sensor
     fragt „wird diese freigegebene Zahl angewendet?", und die ehrliche
     Antwort lautet hier „ja, aber anders". Eine Liste, die zwei Dinge
     bedeutet, beantwortet keine Frage mehr — genau daran ist die
     Quittungsliste bis v8-348 unscharf geworden.

     Wer ein Ziel hier eintraegt, sagt zu: es wird gelesen, es aendert
     nichts, und der Befund ist auf der Karte sichtbar.
     ============================================================ */
  var GEPRUEFTE_ZIELE = ['plan.saetze_je_muskelgruppe'];

  function _freeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.keys(o).forEach(function (k) { _freeze(o[k]); }); Object.freeze(o); } return o; }
  O.prescriptionFactory = _freeze({ VERSION: VERSION, TEMPLATE_IDS: Object.keys(TEMPLATES).sort(),
    GELESENE_ZIELE: GELESENE_ZIELE, GEPRUEFTE_ZIELE: GEPRUEFTE_ZIELE,
    validateWorkout: validateWorkout, buildPrescription: buildPrescription,
    /* Oeffentlich, weil die Oberflaeche denselben Pruefer fuer selbst
       geplante Einheiten braucht — dort gibt es keine Verordnung, nur
       Uebungen. Zwei Pruefer waeren zwei Wahrheiten. */
    muskelHinweise: function (exercises, knowledge) {
      return _muskelHinweise({ knowledge: knowledge }, exercises);
    } });
  if (typeof module !== 'undefined' && module.exports) module.exports = O.prescriptionFactory;
})(typeof globalThis !== 'undefined' ? globalThis : this);
