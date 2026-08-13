/* ============================================================
   ORVIA · progression — Stufe 4 (C2) des Bauplans

   WOFÜR: Fassung 1 des Bauplans schrieb „max. +8 % Wochenkilometer" so, als
   wäre das die Regel, nach der der Umfang wächst. Das war falsch herum. +8 % ist
   die DECKE, nicht der Motor. Die tatsächliche Steigerung soll so klein sein,
   wie es das Ziel zulässt — und sie darf 0 % oder negativ sein.

   Zur Einordnung: Die bekannte „10-%-Regel" ist NICHT evidenzbasiert. Die größte
   randomisierte Studie dazu (Buist et al. 2008, ~530 Laufanfänger) fand KEINEN
   Unterschied in der Verletzungsrate zwischen stufenweisem und Standardaufbau
   [F]. +8 % ist eine konservative Konvention — genau deshalb gehört sie an die
   Decke und nicht in den Motor.

   DIE ENTSCHEIDUNGSREIHENFOLGE IST HIERARCHISCH UND WIRD IN GENAU DIESER
   REIHENFOLGE DURCHLAUFEN. Sie ist kein Stilmittel: Wer zuerst rechnet, wie viel
   das Ziel verlangt, und erst danach fragt, ob überhaupt Daten vorliegen, hat
   die Begründung schon verloren.

     1. Sicherheits- und Unterbrechungskontext   (kann sofort abschließen)
     2. Ausreichende Daten?                      (sonst halten, nicht raten)
     3. Handlungsfähige Toleranzsignale?         (nur actionable bremst)
     4. Phase und Zielbedarf                     (wie viel wäre nötig)
     5. Gewünschte Veränderung                   (der eigentliche Wunsch)
     6. Guardrails und +8-%-Decke                (dürfen nur senken)
     7. Empfehlung mit Begründung

   EIN GUARDRAIL DARF DAS ZIEL SENKEN, NIE ERHÖHEN. Diese Invariante ist im Code
   als einzige Stelle umgesetzt (`_cap`) und im Test als Eigenschaft geprüft —
   sonst wird aus einer Sicherung irgendwann ein Antrieb.

   EINE REDUKTION IST KEINE FEHLLEISTUNG. Deload und Taper sind geplante
   Absenkungen. `direction` unterscheidet deshalb `reduce_planned` von
   `reduce_forced`; wer beides als „Rückschritt" anzeigt, erzieht den Nutzer
   dazu, den Deload zu überspringen.

   FEHLENDE DATEN FÜHREN ZU HALTEN, NIE ZU MEHR HEURISTIK. Eine unvollständige
   Historie kann eine Steigerung nicht begründen — sie kann sie nur verhindern.

   DAS ZIEL TREIBT DIE PROGRESSION NICHT. Das ist die wichtigste Korrektur
   gegenüber der ersten Fassung. Dort erzeugte `goalDemand` den Wunsch, und die
   Decken schnitten ihn zurecht — damit hätte ein unrealistisches Ziel dauerhaft
   Druck bis an die Guardrail-Decke erzeugt, Woche für Woche, ohne dass irgendwo
   „das geht nicht" gestanden hätte.

   Richtig herum:
     C2  berechnet aus Historie, Toleranz und Phase einen ZULÄSSIGEN KORRIDOR
         und eine adaptive Empfehlung darin — auch ganz ohne Ziel.
     Goal Feasibility (Stufe 5) VERGLEICHT diesen Korridor mit dem Zielbedarf
         und beantwortet, ob das Ziel rechtzeitig erreichbar ist.

   `goalDemand` darf deshalb nur noch INNERHALB des bereits zulässigen Korridors
   auswählen. Es kann die Empfehlung an den oberen Rand schieben, aber den Rand
   nicht verschieben. Training bestimmt die erreichbare Trajektorie; das
   Wunschziel darf die physiologische Trajektorie nicht diktieren.

   DIE BEZUGSBASIS GEHÖRT INS ERGEBNIS. `delta: +3` beantwortet für sich genommen
   nicht, worauf sich die 3 % beziehen — und die Antwort ist nicht trivial: Sie
   bezieht sich auf das STABILE 28-Tage-Mittel, nicht auf die letzte Woche. Ohne
   diese Angabe entstehen zwei Fehler in entgegengesetzte Richtungen:

     · Wer `delta` als „gegenüber letzter Woche" liest, plant bei einer bereits
       überhöhten Vorwoche zu viel — die absolute Ziellast überschritte die
       Decke, obwohl der Prozentwert im Korridor liegt.
     · Wer nicht sieht, dass die Vorwoche über dem Mittel lag, hält eine
       tatsächliche Absenkung für einen Aufbau.

   Deshalb stehen `reference`, `targetLoad`, `deltaFromReference`,
   `deltaFromLastWeek` und `absoluteCeiling` ausdrücklich im Ergebnis, und die
   Decke wirkt auf die ABSOLUTE Ziellast, nicht nur auf den Prozentwert. Sie ist
   an das stabile Mittel gebunden — eine Ausreißerwoche darf nie zum Sprungbrett
   für die nächste werden.

   DIE RÜCKKEHR AUF DIE CHRONISCHE BASIS IST KONDITIONIERT — und das ist der
   sicherheitsrelevanteste Teil dieses Moduls.

   Nach einer geplanten Entlastungswoche bei 75 % des Mittels ist die Rückkehr
   auf das Mittel ein Plus von rund 33 % gegenüber der Vorwoche und trotzdem
   harmlos: Die absolute Last liegt unter dem, was seit vier Wochen getragen
   wird. Eine pauschale Woche-zu-Woche-Decke würde diese normale Rückkehr
   blockieren und wäre der Rückfall in „letzte Woche als Bezugsgröße".

   ABER: „25 % unter dem Mittel" BEWEIST keine verkraftete Entlastungswoche.
   Dieselbe Zahl entsteht bei Krankheit, Verletzung, unvollständiger
   Aufzeichnung, ungeplanter Unterbrechung oder schlechter Verträglichkeit. Ein
   unkonditionierter Rücksprung würde ausgerechnet dort am stärksten steigern,
   wo die Ursache unbekannt ist.

     deload rebound  ≠  unexplained low-load rebound

   Zulässig ist die Rückkehr auf die chronische Basis nur bei
     · bestätigter oder plangemäßer Entlastung  (Phase oder `lowWeekReason`)
     · vollständigen Daten der betroffenen Woche
     · keiner aktiven Einschränkung          (Stufe 1 schließt sonst ohnehin ab)
     · keiner handlungsfähigen schlechten Verträglichkeit (Stufe 3)

   Fehlt eine dieser Bedingungen, fällt die Bezugsgröße für DIESE Entscheidung
   auf die letzte Woche zurück — die Rückkehr geschieht dann über mehrere Wochen
   statt in einem Sprung — und das Ergebnis erhält `status: 'review'` mit einer
   konkreten Rückfrage statt eines stillen Aufbaus.

   EIN BEKANNTER GRUND IST KEINE FREIGABE. Die Gründe-Tabelle validiert nicht nur
   Werte, sie ordnet jedem Wert genau EINE Folgewirkung zu:
     planned_rest · deload · race_taper · race_week · planned_travel → Rücksprung
     illness  → Krankheitspfad (Symptomfreiheit zuerst, kein Einstiegsprozent)
     injury   → Kriterienpfad (überhaupt kein Prozentwert)
     missing_data · unbekannt → review
   „Krank" ist ein bekannter Grund und trotzdem das Gegenteil einer Freigabe.
   Wird er als `lowWeekReason` genannt, ist das eine erklärte Unterbrechung —
   die Entscheidung landet dann in Stufe 1, nicht in einem allgemeinen Review.

   KEINE AUTOMATISCHE PLANÄNDERUNG OHNE HANDLUNGSFÄHIGKEIT — aber nur in der
   riskanten Richtung. Ist die Entscheidung nicht handlungsfähig UND wäre sie
   eine Steigerung, steht der Wert in `provisionalTargetLoad`, `targetLoad` ist
   null und `autoApplicable` false. Ein Konsument, der `targetLoad` blind liest,
   bekommt nichts, statt still eine ungeklärte Steigerung anzuwenden.
   Eine ABSENKUNG oder ein Halten bleibt dagegen immer anwendbar: Eine Reduktion
   nach Krankheit zu blockieren, weil die Entscheidung „nicht handlungsfähig"
   ist, würde das Gegenteil von Sicherheit bewirken — der Plan bliebe auf dem
   alten Niveau stehen. Dieselbe Asymmetrie wie bei den Guardrails: Senken darf
   immer.

   BELEGT IST DER KORRIDOR, NICHT DIE AUSWAHL DARIN. `midpoint_of_evidence` wäre
   irreführend: Der Mittelpunkt selbst ist nicht wissenschaftlich belegt, nur der
   Bereich. Die Auswahl ist Politik. Die Namen sagen das jetzt:
     policy_conservative_edge          — der äußerste Sicherheitswert des Korridors
     policy_midpoint_of_evidence_range — Mitte eines EVIDENZ-Korridors (Taper)
     policy_midpoint_of_convention_range — Mitte eines Konventions-Korridors
     policy_midpoint_of_range          — Mitte, wo weder Evidenz noch Konvention trägt
   „Konservativ" ist dabei eine RICHTUNG, kein Superlativ — außer bei
   `policy_conservative_edge`, wo tatsächlich der äußerste Rand gewählt wird.

   EIN PROZENTWERT BESCHREIBT VOLUMEN, NICHT ALLE DIMENSIONEN. „Taper −50 %" ist
   eine Volumenreduktion bei ERHALTENER Intensität und Frequenz — genau das ist
   der belegte Teil. Würde ein Planer daraus „alles halbieren" machen, wäre die
   evidenzgestützte Empfehlung beim Übersetzen in Einheiten fachlich verfälscht:
   Der Taper verlöre seine Wirkung, weil sie gerade am Erhalt der Intensität
   hängt. Deshalb trägt jede Empfehlung ein `dimensionPolicy` mit getrennten
   Angaben für Volumen, Intensität und Frequenz.

   UND MIT EINEM SCOPE. Ein Verträglichkeitssignal aus `highIntensity/running`
   rechtfertigt, die harten LAUFEINHEITEN zurückzunehmen — nicht die lockeren
   Läufe und schon gar nicht die Rad- oder Schwimmeinheiten. Ohne ausdrücklichen
   Geltungsbereich würde ein Planer `intensityPolicy: 'reduce'` pauschal auf
   alles anwenden und damit ein eng umrissenes Problem in eine allgemeine
   Drosselung übersetzen. `scope.key === 'all'` steht dort, wo die Maßnahme
   tatsächlich den ganzen Plan betrifft (Taper, Krankheit).

   DER SCOPE IST STRUKTURIERT, NICHT NUR EIN SCHLÜSSEL. `'highIntensity/running'`
   als blanker String wäre ausreichend, solange er ausschließlich als
   undurchsichtiger Schlüssel VERGLICHEN wird — aber er lädt dazu ein, an drei
   Stellen mit `split('/')` zerlegt zu werden, und beim vierten Aufruf steht dann
   ein Sportname mit Schrägstrich darin. Deshalb liegen `domain` und `sport`
   ausbuchstabiert daneben; der Schlüssel bleibt für den Vergleich erhalten. Die
   Form ist IMMER dieselbe, auch bei `all` — ein Feld, das mal String und mal
   Objekt ist, erzeugt genau die Fallunterscheidungen, die es vermeiden sollte.

   Kein DOM, keine Uhr, kein Zufall, kein Storage.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'progression@9';
  /* Getrennt versioniert: Eine geänderte Decke hätte rückwirkend andere
     Entscheidungen erzeugt. Ohne eigene Kennung wäre im Entscheidungs-Log nicht
     unterscheidbar, ob sich der Code oder die Politik geändert hat. */
  var POLICY_VERSION = 'prog-policy@9';

  function _req(n) { if (typeof require !== 'function') return null; try { return require(n); } catch (e) { return null; } }
  var EV = O.evidence || _req('./evidence.js');

  /* ---- Decken. Ausschließlich Obergrenzen für POSITIVE Progression. ---- */
  var CAPS = {
    runVolumePct: 8,        // gegen das Mittel der letzten 3 Wochen, nicht die Vorwoche
    absoluteMaxPct: 15,     // harte Grenze, auch wenn ein Ziel mehr verlangt
    readinessBlock: 0.5     // Muskelgruppe darunter: beinlastige Einheiten weichen aus
  };

  /* Adaptive Grundempfehlung OHNE Ziel. Bewusst klein: Sie soll den Aufbau nicht
     anhalten, aber auch nicht ersatzweise antreiben. [A] */
  var ADAPTIVE = {
    build: 3,               // stabiler Verlauf, gute Datenlage, kein Signal
    alreadyRising: 0,       // die Last steigt bereits — nicht zusätzlich schieben
    inconsistent: 0,        // Konsistenz unter der Schwelle
    minConsistency: 0.6
  };

  /* PHASEN ALS BEREICHE, NICHT ALS FESTWERTE. Auch eine Absenkung ist eine
     Auswahl aus einem Korridor — eine einzelne Zahl würde eine physiologische
     Genauigkeit behaupten, die die Evidenz nicht hergibt.
     Taper: metaanalytisch rund 40–60 % Volumenreduktion bei erhaltener
     Intensität und Frequenz [F]. Deload: Konvention, keine Messgröße [A]. */
  var PHASE_RANGES = {
    taper:  { min: -60, max: -40, pick: -50, why: 'policy_midpoint_of_evidence_range' },
    deload: { min: -30, max: -20, pick: -25, why: 'policy_midpoint_of_convention_range' }
  };

  /* AUSFÜHRUNGSVERTRAG JE FALL. Ein Prozentwert allein sagt nicht, WAS reduziert
     wird. Beim Taper hängt die Wirkung gerade am Erhalt von Intensität und
     Frequenz — eine pauschale Halbierung aller Dimensionen wäre das Gegenteil
     der belegten Maßnahme. */
  /* EINE Stelle baut den Scope — nirgends sonst wird der Schlüssel
     zusammengesetzt oder zerlegt. */
  function scopeOf(domain, sport) {
    if (!domain && !sport) return SCOPE_ALL;
    return { key: String(domain || '*') + '/' + String(sport || '*'),
      domain: domain || null, sport: sport || null, all: false };
  }
  var SCOPE_ALL = { key: 'all', domain: null, sport: null, all: true };

  var DIMENSION_POLICY = {
    /* Wortlaut und Vertrag müssen dieselbe Semantik haben: Die Metaanalyse zeigt
       ERHALTENE Intensität, die Frequenz darf leicht sinken. Eine Notiz, die
       „Intensität und Frequenz erhalten" sagt, während der Vertrag
       `maintain_or_slightly_reduce` führt, lädt zu genau der Fehlübersetzung
       ein, die dieser Block verhindern soll. */
    taper:      { intensityPolicy: 'maintain', frequencyPolicy: 'maintain_or_slightly_reduce',
                  scope: SCOPE_ALL,
                  note: 'Belegt ist die Volumenreduktion bei ERHALTENER Intensität; die Frequenz bleibt erhalten oder sinkt nur leicht.' },
    deload:     { intensityPolicy: 'reduce_or_maintain', frequencyPolicy: 'maintain',
                  scope: SCOPE_ALL,
                  note: 'Entlastung über das Volumen; einzelne Intensitätsreize dürfen bleiben.' },
    illness:    { intensityPolicy: 'reduce', frequencyPolicy: 'maintain_or_reduce',
                  scope: SCOPE_ALL,
                  note: 'Nach Krankheit zuerst das Volumen UND die Intensität zurücknehmen.' },
    breakReturn:{ intensityPolicy: 'reduce_initially', frequencyPolicy: 'maintain',
                  scope: SCOPE_ALL,
                  note: 'Frequenz früh wieder aufbauen, Intensität zuletzt.' },
    /* Der Scope wird zur Laufzeit aus der auslösenden Zelle gesetzt. */
    tolerance:  { intensityPolicy: 'reduce', frequencyPolicy: 'maintain',
                  scope: null,
                  note: 'Das Signal kam aus einer bestimmten Domäne und Sportart — NUR dort zurücknehmen, nicht pauschal.' },
    build:      { intensityPolicy: 'maintain', frequencyPolicy: 'maintain',
                  scope: SCOPE_ALL,
                  note: 'Aufbau über das Volumen, nicht über zusätzliche Härte.' },
    hold:       { intensityPolicy: 'maintain', frequencyPolicy: 'maintain',
                  scope: SCOPE_ALL, note: 'Unverändert.' }
  };

  /* Ab wann eine Woche als „ungewöhnlich niedrig" gilt und die Rückkehr auf die
     chronische Basis begründet werden muss. [A] */
  var REBOUND = {
    lowWeekBelowPct: 15,        // Vorwoche mehr als 15 % unter der Referenz
    minWeekCompleteness: 0.75   // darunter wissen wir nicht einmal, DASS sie niedrig war
  };
  /* Gründe für eine niedrige Woche — als geschlossene Liste MIT FESTGELEGTER
     FOLGEWIRKUNG. Eine reine Werteliste würde nur validieren; entscheidend ist,
     dass jeder Wert genau einen Pfad auslöst. Ein bekannter Grund erlaubt NICHT
     automatisch den Rücksprung: „krank" ist ein bekannter Grund und trotzdem
     das Gegenteil einer Freigabe. */
  var LOW_WEEK_REASONS = {
    deload:         { consequence: 'rebound_allowed', label: 'geplante Entlastungswoche' },
    planned_rest:   { consequence: 'rebound_allowed', label: 'geplante Pause' },
    race_taper:     { consequence: 'rebound_allowed', label: 'Taper vor dem Wettkampf' },
    race_week:      { consequence: 'rebound_allowed', label: 'Wettkampfwoche' },
    planned_travel: { consequence: 'rebound_allowed', label: 'geplante Reise' },
    /* Krankheit und Verletzung sind KEINE Freigaben — sie gehören in ihre
       eigenen Pfade mit Symptom- bzw. Kriterienführung. */
    illness:        { consequence: 'illness_path', label: 'Krankheit' },
    injury:         { consequence: 'criteria_path', label: 'Verletzung' },
    missing_data:   { consequence: 'review', label: 'fehlende Einträge' },
    unknown:        { consequence: 'review', label: 'unbekannt' }
  };
  /* Nur für Diagnose und Tests — die Wirkung steht in der Tabelle. */
  var PLANNED_LOW = Object.keys(LOW_WEEK_REASONS).filter(function (k) {
    return LOW_WEEK_REASONS[k].consequence === 'rebound_allowed';
  });

  /* ---- Wiedereinstieg: Bereiche, keine Festwerte ----
     Die Zahlen sind [A] — plausible Annahmen. Genau deshalb stehen sie als
     Korridor und nicht als einzelner, scheinbar wissenschaftlich fester Faktor.
     Wo die Planung einen Wert braucht, wird der KONSERVATIVE Rand genommen. */
  var RETURN_RANGES = {
    crossTraining: { min: 0.85, max: 0.95, why: 'Aerobe Basis bleibt bei fortgesetztem Crosstraining weitgehend erhalten.' },
    shortBreak: { min: 0.75, max: 0.85, why: 'Detraining ist in zwei Wochen gering.' },
    longBreak: { min: 0.60, max: 0.70, why: 'Nach mehr als vier Wochen ist Detraining messbar.' }
  };

  function _r2(x) { return x == null ? null : Math.round(x * 100) / 100; }
  function _r1(x) { return x == null ? null : Math.round(x * 10) / 10; }

  /* DIE EINZIGE STELLE, AN DER EINE DECKE WIRKT.
     Sie kann den Wunsch nur senken. Läge der Wunsch unter der Decke, bliebe er
     unverändert — eine Decke, die anhebt, wäre keine Sicherung mehr. */
  function _cap(wishPct, capPct, name, applied) {
    if (wishPct == null || capPct == null) return wishPct;
    if (wishPct <= capPct) return wishPct;
    applied.push({ guardrail: name, from: _r1(wishPct), to: _r1(capPct) });
    return capPct;
  }

  /* ============================================================
     WIEDEREINSTIEG — drei getrennte Pfade
     ============================================================ */
  function returnRecommendation(ctx) {
    var c = ctx || {};
    var reason = c.reason || null;
    if (!reason) return null;

    /* PFAD 3 — VERLETZUNG: kein Prozentwert.
       Nach einer Verletzung ist ein Prozentsatz vom letzten Niveau der falsche
       BEGRIFF. Das ist eine Kriterienprogression, kein Skalierungsfaktor. */
    if (reason === 'injury') {
      return {
        path: 'criteria',
        criteriaPath: (Array.isArray(c.returnCriteria) && c.returnCriteria.length)
          ? c.returnCriteria.slice()
          : [{ criterion: 'pain_free_at_current_load', over: 'N Einheiten', source: 'D1_pending' }],
        range: null, recommended: null,
        evidence: 'weak',
        pending: !(Array.isArray(c.returnCriteria) && c.returnCriteria.length),
        rationale: (Array.isArray(c.returnCriteria) && c.returnCriteria.length)
          ? 'Rückführung über Kriterien aus dem Beschwerdemodell.'
          : 'Kriterienführung fehlt noch (D1). Bis dahin gilt konservativ der untere Rand des längsten Pausenfalls — sichtbar gekennzeichnet.',
        fallbackFactor: RETURN_RANGES.longBreak.min
      };
    }

    /* PFAD 2 — KRANKHEIT: symptom- und kriterienabhängig, KEIN Einstiegsprozent.
       Dokumentiert ist der MECHANISMUS (u. a. Myokarditis-Risiko) [F], nicht
       eine bestimmte Prozentzahl [U]. Der Rückkehrverlauf hängt stark von
       Symptomatik und Krankheitsbild ab. */
    if (reason === 'illness') {
      var free = c.symptomFreeDays != null ? c.symptomFreeDays : null;
      if (free == null || free < 1) {
        return { path: 'criteria', criteriaPath: [{ criterion: 'symptom_free', over: 'mindestens 1 Tag' }],
          range: null, recommended: null, evidence: 'weak', blocked: true,
          rationale: 'Vor Symptomfreiheit gibt es keinen Wiedereinstiegswert — belegt ist der Mechanismus, nicht eine Prozentzahl.' };
      }
      var r = RETURN_RANGES.longBreak;
      return { path: 'range', range: { min: r.min, max: r.max }, recommended: r.min,
        criteriaPath: [{ criterion: 'symptom_free', over: free + ' Tage', met: true }],
        evidence: 'weak',
        rationale: 'Konservativer Wiedereinstieg nach Symptomfreiheit — am unteren Rand, weil der Verlauf stark vom Krankheitsbild abhängt.' };
    }

    /* PFAD 1 — NORMALE PAUSE: last- und kontextabhängiger Bereich. */
    var days = c.days > 0 ? c.days : 0;
    var cross = c.crossTrainingLoad > 0;
    var band = cross ? RETURN_RANGES.crossTraining
      : days > 28 ? RETURN_RANGES.longBreak
        : days >= 14 ? RETURN_RANGES.longBreak
          : RETURN_RANGES.shortBreak;
    if (days < 7 && !cross) return null;   /* unter einer Woche ist es keine Unterbrechung */
    return { path: 'range', range: { min: band.min, max: band.max },
      recommended: band.min, evidence: 'weak', criteriaPath: null,
      rationale: band.why + ' Der Planwert ist der untere Rand — die Zahlen sind Annahmen, keine Messgrößen.' };
  }

  /* ============================================================
     HAUPTFUNKTION — die sieben Stufen in genau dieser Reihenfolge
     ============================================================ */
  function progressionDecision(input) {
    var i = input || {};
    var LH = i.loadHistory || null;
    var TS = i.toleranceState || null;
    var guardrails = [];
    var steps = [];
    /* Wird in Stufe 2b gesetzt und von JEDEM Rückgabepfad mitgeführt — auch von
       den frühen (Taper, Deload, Sperre). Sonst fehlte die Auskunft genau dort,
       wo sie erklärt, warum die letzte Woche niedrig war. */
    var reboundCtx = null;

    var baseline = _baselineOf(LH);

    function out(status, delta, limiting, extra) {
      /* ABSOLUTE DECKE. Sie wirkt auf die Ziellast, nicht auf den Prozentwert —
         und sie ist an das STABILE Mittel gebunden. Wäre sie an die letzte Woche
         gebunden, würde jede Ausreißerwoche zum Sprungbrett für die nächste. */
      var ceiling = baseline.value != null
        ? _r2(baseline.value * (1 + CAPS.absoluteMaxPct / 100)) : null;
      var target = (baseline.value != null && delta != null)
        ? _r2(baseline.value * (1 + delta / 100)) : null;
      var clampedDelta = delta;
      if (target != null && ceiling != null && target > ceiling) {
        guardrails.push({ guardrail: 'absolute_ceiling', from: _r2(target), to: ceiling,
          detail: 'Die Ziellast hätte die absolute Decke überschritten — gedeckelt auf ' + ceiling + '.' });
        target = ceiling;
        clampedDelta = _r1((ceiling / baseline.value - 1) * 100);
      }
      /* NICHT HANDLUNGSFÄHIG ⇒ KEINE AUTOMATISCHE STEIGERUNG.
         Der Wert bleibt als `provisionalTargetLoad` erhalten — er ist eine
         Sicherheitsgröße, keine Vorgabe. `targetLoad` wird auf null gesetzt:
         Ein Konsument, der es blind liest, bekommt nichts, statt still eine
         ungeklärte Empfehlung anzuwenden.

         ABER DIE SPERRE GILT NUR FÜR DIE RISKANTE RICHTUNG. Eine Absenkung oder
         ein Halten ist immer sicher anzuwenden — eine Reduktion nach Krankheit
         zu blockieren, weil die Entscheidung „nicht handlungsfähig" ist, würde
         genau das Gegenteil von Sicherheit bewirken: Der Plan bliebe auf dem
         alten Niveau stehen. Gesperrt wird deshalb nur, was den Umfang ERHÖHT.
         Dieselbe Asymmetrie wie bei den Guardrails: Senken darf immer. */
      var isActionable = !!(extra && extra.actionable);
      var isIncrease = (delta != null && delta > 0);
      /* JEDE Ausgabe trägt ihren Korridor und den Grund der Auswahl — auch die
         Absenkungen. Sonst behauptete „−40 %" eine Genauigkeit, die aus einem
         Bereich von −40 bis −30 stammt. */
      var range = (extra && extra.range) || null;
      var dimKey = (extra && extra.dimension) || null;
      var dim = dimKey && DIMENSION_POLICY[dimKey] ? DIMENSION_POLICY[dimKey] : null;
      var o = {
        status: status,
        policyVersion: POLICY_VERSION, version: VERSION,
        allowableRange: range,
        selectedDelta: clampedDelta == null ? null : _r1(clampedDelta),
        selectionReason: (extra && extra.selectionReason) || null,
        /* Der Prozentwert beschreibt AUSSCHLIESSLICH das Volumen. */
        dimensionPolicy: dim ? {
          volumeDelta: clampedDelta == null ? null : _r1(clampedDelta),
          intensityPolicy: dim.intensityPolicy,
          frequencyPolicy: dim.frequencyPolicy,
          /* Geltungsbereich der Intensitätsvorgabe. 'all' = ganzer Plan;
             sonst genau die auslösende Domäne und Sportart. Fehlt der Scope,
             gilt fail-closed 'all' NICHT — dann steht null und der Planer muss
             nachfragen, statt pauschal zu drosseln. */
          scope: (extra && extra.scope) || dim.scope || null,
          /* Kurzform für Anzeige und Log — der Vergleich läuft über scope.key. */
          scopeKey: ((extra && extra.scope) || dim.scope || {}).key || null,
          note: dim.note
        } : null,
        actionable: isActionable,
        autoApplicable: isActionable || !isIncrease,
        provisional: !(isActionable || !isIncrease),
        /* Worauf sich alles bezieht — ausdrücklich, nicht implizit. */
        reference: { value: baseline.value, basis: baseline.source, windowDays: baseline.days || null,
          note: 'Stabile Bezugsgröße. `delta` und `targetLoad` beziehen sich hierauf, NICHT auf die letzte Woche.' },
        referenceLoad: baseline.value,
        baselineLoad: baseline.value,
        targetLoad: (isActionable || !isIncrease) ? target : null,
        provisionalTargetLoad: (isActionable || !isIncrease) ? null : target,
        absoluteCeiling: ceiling,
        lastWeekLoad: baseline.lastWeek,
        deltaFromReference: clampedDelta == null ? null : _r1(clampedDelta),
        /* Der ehrliche Woche-zu-Woche-Wert. Er kann dem Vorzeichen von
           `deltaFromReference` widersprechen — genau dann ist die Angabe
           nötig, damit niemand eine Absenkung für einen Aufbau hält. */
        deltaFromLastWeek: (target != null && baseline.lastWeek > 0)
          ? _r1((target / baseline.lastWeek - 1) * 100) : null,
        recentWeekAboveCeiling: (ceiling != null && baseline.lastWeek != null)
          ? baseline.lastWeek > ceiling : null,
        delta: clampedDelta == null ? null : _r1(clampedDelta),
        direction: delta == null ? 'unknown'
          : delta > 0.5 ? 'increase'
            : delta < -0.5 ? ((extra && extra.planned) ? 'reduce_planned' : 'reduce_forced')
              : 'hold',
        limitingFactor: limiting,
        limitingFactors: guardrails.map(function (g) { return g.guardrail; }),
        guardrails: guardrails,
        steps: steps,
        evidence: (extra && extra.evidence) || 'unknown',
        rationale: (extra && extra.rationale) || null,
        rebound: reboundCtx,
        returnRecommendation: (extra && extra.ret) || null
      };
      return o;
    }

    /* ---- 1. SICHERHEITS- UND UNTERBRECHUNGSKONTEXT ----
       Steht vorn, weil es alles Weitere überstimmt. Wer nach einer Verletzung
       zuerst den Zielbedarf rechnet, hat die falsche Frage gestellt. */
    steps.push('1_safety');
    var blocking = _blockingConstraint(i.constraints);
    if (blocking) {
      return out('blocked', null, 'constraint',
        { evidence: blocking.evidence || 'weak', actionable: false,
          rationale: 'Aktive Einschränkung (' + blocking.region + ') — die Progression wird nicht automatisch entschieden.' });
    }
    /* Ein als Krankheit oder Verletzung benannter Grund IST eine erklärte
       Unterbrechung — auch wenn `interruption` nicht gesetzt wurde. Sonst
       landete „krank" im allgemeinen Review statt im Symptompfad, und die
       Symptomfreiheit würde nie abgefragt. */
    var declared = LOW_WEEK_REASONS[String(i.lowWeekReason || '').toLowerCase()];
    var interruption = i.interruption || null;
    if (!interruption && declared &&
        (declared.consequence === 'illness_path' || declared.consequence === 'criteria_path')) {
      interruption = { reason: declared.consequence === 'illness_path' ? 'illness' : 'injury',
        days: i.lowWeekDays || null, symptomFreeDays: i.symptomFreeDays,
        returnCriteria: i.returnCriteria, declaredVia: 'lowWeekReason' };
    }
    var ret = returnRecommendation(interruption);
    if (ret) {
      if (ret.path === 'criteria') {
        return out('manual', null, 'return',
          { evidence: ret.evidence, actionable: false, ret: ret,
            rationale: ret.rationale });
      }
      /* Ein Wiedereinstieg ist eine GEPLANTE Absenkung, keine Fehlleistung. */
      var retDelta = baseline.value != null ? (ret.recommended - 1) * 100 : null;
      /* Der Korridor aus returnRecommendation darf hier nicht verloren gehen —
         sonst sähe „−40 %" aus wie eine physiologisch exakte Zahl statt wie die
         konservative Auswahl aus −40 bis −30. */
      var retRange = ret.range
        ? { min: _r1((ret.range.min - 1) * 100), max: _r1((ret.range.max - 1) * 100) } : null;
      return out('ok', retDelta, 'return',
        { evidence: ret.evidence, actionable: false, planned: true, ret: ret,
          range: retRange, selectionReason: 'policy_conservative_edge',
          dimension: (interruption && interruption.reason === 'illness') ? 'illness' : 'breakReturn',
          rationale: ret.rationale });
    }

    /* ---- 2. AUSREICHENDE DATEN? ----
       Ohne belastbare Historie kann keine Steigerung begründet werden. Sie darf
       aber sehr wohl verhindert werden — Halten ist die sichere Antwort. */
    steps.push('2_data');
    var ts = (LH && LH.trainingState) || null;
    if (!ts || baseline.value == null) {
      return out('insufficient_data', null, 'data',
        { evidence: 'unknown', actionable: false,
          rationale: 'Ohne Lasthistorie gibt es keine Bezugsgröße — es wird nichts geschätzt.' });
    }
    if (!ts.actionable) {
      return out('hold', 0, 'data',
        { evidence: ts.evidence || 'unknown', actionable: false, dimension: 'hold',
          rationale: 'Die Datenlage (' + Math.round((ts.completeness || 0) * 100) + ' % bekannte Tage) trägt keine Steigerung. Umfang halten.' });
    }

    /* ---- 2b. WAR DIE LETZTE WOCHE UNGEWÖHNLICH NIEDRIG — UND WARUM? ----
       Ohne diese Frage würde die Engine ausgerechnet dort am stärksten
       steigern, wo die Ursache unbekannt ist. */
    steps.push('2b_rebound');
    var rebound = _reboundContext(baseline, LH, phaseOf(i), i);
    reboundCtx = rebound;
    if (rebound.isLowWeek && !rebound.explained) {
      /* Bezugsgröße fällt für DIESE Entscheidung auf die letzte Woche zurück:
         Die Rückkehr geschieht über mehrere Wochen statt in einem Sprung. */
      baseline = { value: baseline.lastWeek, source: 'last_week_fallback',
        days: 7, lastWeek: baseline.lastWeek, chronic: baseline.value };
      guardrails.push({ guardrail: 'unexplained_low_week',
        from: _r2(rebound.chronic), to: _r2(rebound.lastWeek),
        detail: rebound.reason });
    }

    /* ---- 3. HANDLUNGSFÄHIGE TOLERANZSIGNALE? ----
       Nur `actionable` bremst. Ein `poor` aus einem Tabellen-Erwartungswert ist
       eine Beobachtung — es wird ausgewiesen, steuert aber nicht. */
    steps.push('3_tolerance');
    var tol = _worstActionableTolerance(TS);
    var observedOnly = _worstObservedTolerance(TS);
    if (tol && tol.status === 'poor') {
      return out('ok', -10, 'tolerance',
        { evidence: tol.evidence, actionable: true, planned: false,
          range: { min: -20, max: -5 }, selectionReason: 'policy_midpoint_of_range',
          dimension: 'tolerance', scope: scopeOf(tol.domain, tol.sport),
          rationale: 'Belastbares Verträglichkeitssignal (' + tol.domain + '/' + tol.sport +
            '): Umfang senken statt steigern (Korridor −20 bis −5 %).' });
    }

    /* ---- 4. PHASE UND ZIELBEDARF ---- */
    steps.push('4_phase_goal');
    var phase = phaseOf(i);
    if (phase === 'taper') {
      /* Der Taper ist die am besten belegte Absenkung der Trainingslehre:
         Fenster rund 8–14 Tage, Volumen −40 bis −60 %, Intensität und Frequenz
         weitgehend erhalten [F]. Er ist ausdrücklich GEPLANT. */
      var tp = PHASE_RANGES.taper;
      return out('ok', tp.pick, 'phase',
        { evidence: 'moderate', actionable: true, planned: true,
          range: { min: tp.min, max: tp.max }, selectionReason: tp.why, dimension: 'taper',
          rationale: 'Taper: Volumen deutlich herunter (Korridor ' + tp.min + ' bis ' + tp.max +
            ' %), Intensität und Frequenz bleiben. Das ist eine geplante Absenkung, kein Rückschritt.' });
    }
    if (phase === 'deload') {
      var dl = PHASE_RANGES.deload;
      return out('ok', dl.pick, 'phase',
        { evidence: ts.evidence, actionable: true, planned: true,
          range: { min: dl.min, max: dl.max }, selectionReason: dl.why, dimension: 'deload',
          rationale: 'Deload: geplante Entlastungswoche (Korridor ' + dl.min + ' bis ' + dl.max + ' %).' });
    }

    /* ---- 5. ADAPTIVE EMPFEHLUNG AUS DEM TRAINING SELBST ----
       Sie entsteht OHNE Ziel. Das ist der Kern der Richtungsumkehr: Der
       zulässige Korridor folgt aus Historie, Toleranz und Phase; ein Ziel kann
       darin auswählen, aber ihn nicht erzeugen. */
    steps.push('5_adaptive');
    var adaptive;
    if ((ts.consistency != null && ts.consistency < ADAPTIVE.minConsistency)) {
      adaptive = ADAPTIVE.inconsistent;
    } else if (ts.loadTrend === 'rising') {
      adaptive = ADAPTIVE.alreadyRising;
    } else if (tol && tol.status === 'borderline') {
      adaptive = 0;
    } else {
      adaptive = ADAPTIVE.build;
    }
    /* Ohne Zielbedarf bleibt es dabei; die Korridorgrenzen unten koennen den
       Wert nur noch senken. */

    /* ---- 6. GUARDRAILS: DER ZULÄSSIGE KORRIDOR — dürfen NUR senken ---- */
    steps.push('6_guardrails');
    var maxAllowed = CAPS.runVolumePct;
    maxAllowed = Math.min(maxAllowed, CAPS.absoluteMaxPct);
    var lowReadiness = _lowReadiness(LH);
    if (lowReadiness.length) {
      maxAllowed = _cap(maxAllowed, 0, 'muscle_readiness', guardrails);
    }
    /* KONSISTENZ IST EINE KORRIDORGRENZE, KEINE VORLIEBE. Auf ein Fundament,
       das nicht ausgefuehrt wird, laesst sich nichts aufbauen — und ein Ziel
       darf daran nichts aendern. Stuende das nur in der adaptiven Empfehlung,
       koennte ein ehrgeiziges Ziel es ueberstimmen. */
    if (ts.consistency != null && ts.consistency < ADAPTIVE.minConsistency) {
      maxAllowed = _cap(maxAllowed, 0, 'low_consistency', guardrails);
    }
    /* DASSELBE FUER EINEN BEREITS STEIGENDEN VERLAUF. „Rising" heisst, die Last
       liegt bereits deutlich ueber dem 28-Tage-Mittel. Noch einmal die volle
       Decke obendrauf hiesse, denselben Aufbau zweimal zu zaehlen — auch das
       darf ein Ziel nicht aushebeln. */
    if (ts.loadTrend === 'rising') {
      maxAllowed = _cap(maxAllowed, ADAPTIVE.build, 'already_rising', guardrails);
    }
    if (tol && tol.status === 'borderline') {
      maxAllowed = _cap(maxAllowed, ADAPTIVE.build, 'tolerance_borderline', guardrails);
    }
    /* Der Korridor: nach unten offen bis zur adaptiven Empfehlung (ohne Signal
       wird nichts erzwungen), nach oben durch die Decken begrenzt. */
    var allowableRange = { min: Math.min(0, adaptive), max: _r1(maxAllowed) };
    if (adaptive > maxAllowed) {
      guardrails.push({ guardrail: 'adaptive_above_cap', from: _r1(adaptive), to: _r1(maxAllowed) });
      adaptive = maxAllowed;
    }

    /* ---- 7. AUSWAHL INNERHALB DES KORRIDORS UND EMPFEHLUNG ----
       `goalDemand` darf hier NUR noch auswählen. Es kann die Empfehlung an den
       oberen Rand des bereits zulässigen Korridors schieben — nie darüber. */
    steps.push('7_recommend');
    var demand = i.goalDemand && i.goalDemand.requiredPctPerWeek != null
      ? i.goalDemand.requiredPctPerWeek : null;
    var chosen = adaptive, goalUsed = false;
    if (demand != null && demand > adaptive) {
      chosen = Math.min(demand, allowableRange.max);
      goalUsed = chosen > adaptive;
      if (demand > allowableRange.max) {
        guardrails.push({ guardrail: 'goal_beyond_corridor', from: _r1(demand), to: _r1(allowableRange.max),
          detail: 'Der Zielbedarf liegt über dem zulässigen Korridor. Ob das Ziel damit erreichbar bleibt, beantwortet Goal Feasibility — nicht die Progression.' });
      }
    }

    var limiting = guardrails.length ? guardrails[guardrails.length - 1].guardrail
      : (goalUsed ? 'goal_within_corridor' : 'adaptive');
    var rationale;
    if (demand != null && demand > allowableRange.max) {
      rationale = 'Zulässig sind höchstens ' + _r1(allowableRange.max) + ' %; das Ziel verlangt ' + _r1(demand) +
        ' %. Der Plan folgt dem Zulässigen — ob das Ziel damit noch erreichbar ist, entscheidet die Machbarkeitsprüfung.';
    } else if (goalUsed) {
      rationale = 'Adaptiv wären ' + _r1(adaptive) + ' %; das Ziel rechtfertigt ' + _r1(chosen) + ' % innerhalb des zulässigen Korridors.';
    } else if (chosen === 0 && lowReadiness.length) {
      rationale = 'Muskelerholung unter der Schwelle (' + lowReadiness.join(', ') + ') — Umfang halten.';
    } else if (chosen === 0 && ts.loadTrend === 'rising') {
      rationale = 'Die Last steigt bereits — kein zusätzlicher Aufbau, sonst wird derselbe Anstieg zweimal gezählt.';
    } else if (chosen === 0) {
      rationale = 'Die Konsistenz trägt noch keinen Aufbau — Umfang halten.';
    } else {
      rationale = 'Adaptiver Aufbau aus stabilem Verlauf: ' + _r1(chosen) + ' % (zulässig bis ' + _r1(allowableRange.max) + ' %).';
    }

    if (rebound.isLowWeek && !rebound.explained) {
      limiting = 'unexplained_low_week';
      rationale = 'Die letzte Woche lag deutlich unter dem Mittel, ohne erkennbaren Grund (' + rebound.reason +
        '). Die Rückkehr erfolgt schrittweise von der letzten Woche aus statt in einem Sprung. ' +
        'War es eine geplante Entlastung, eine Krankheit oder fehlen nur Einträge?';
    }
    var res = out(rebound.isLowWeek && !rebound.explained ? 'review' : 'ok', chosen, limiting,
      { evidence: EV ? EV.weakest([ts.evidence, tol ? tol.evidence : 'moderate']) : 'weak',
        actionable: !(rebound.isLowWeek && !rebound.explained), planned: false,
        range: allowableRange,
        selectionReason: goalUsed ? 'goal_within_corridor' : 'adaptive_default',
        dimension: chosen > 0 ? 'build' : 'hold',
        rationale: rationale });
    res.adaptiveDelta = _r1(adaptive);
    res.goalDemandPct = demand == null ? null : _r1(demand);
    res.goalWithinCorridor = demand == null ? null : (demand <= allowableRange.max);
    /* Beobachtungen, die NICHT gesteuert haben, werden trotzdem ausgewiesen —
       sonst wirkt die Entscheidung, als hätte es kein Signal gegeben. */
    if (observedOnly && (!tol || observedOnly.status !== tol.status)) {
      res.observedOnly = observedOnly;
    }
    return res;
  }

  /* ---- Hilfsfunktionen ---- */
  function phaseOf(i) { return String((i && i.phase) || '').toLowerCase(); }

  /* Beantwortet: War die letzte Woche ungewöhnlich niedrig, und ist der Grund
     bekannt? „Niedrig" allein rechtfertigt keinen Rücksprung. */
  function _reboundContext(baseline, LH, phase, i) {
    var out0 = { isLowWeek: false, explained: true, reason: null,
      chronic: baseline.value, lastWeek: baseline.lastWeek,
      weekCompleteness: null };
    if (baseline.value == null || baseline.lastWeek == null) return out0;
    if (baseline.source !== 'mean28') return out0;   /* ohne chronische Basis kein Rücksprung */

    var drop = (1 - baseline.lastWeek / baseline.value) * 100;
    out0.dropPct = _r1(drop);
    if (drop <= REBOUND.lowWeekBelowPct) return out0;
    out0.isLowWeek = true;

    /* 1. Plangemäß? */
    var reason = String((i && i.lowWeekReason) || '').toLowerCase();
    var byPhase = LOW_WEEK_REASONS[phase] || (phase === 'taper' ? LOW_WEEK_REASONS.race_taper : null);
    var byReason = LOW_WEEK_REASONS[reason] || null;
    var eff = byReason || byPhase;
    out0.declaredReason = reason || (byPhase ? phase : null);
    out0.consequence = eff ? eff.consequence : 'review';
    if (eff && eff.consequence === 'rebound_allowed') {
      out0.explained = true; out0.reason = 'planned:' + (reason || phase);
      return out0;
    }
    /* Bekannt, aber KEINE Freigabe (Krankheit, Verletzung, fehlende Daten). */
    if (eff) {
      out0.explained = false;
      out0.reason = 'declared_' + eff.consequence + ':' + (reason || phase);
      return out0;
    }
    /* 2. Vollständige Daten der betroffenen Woche? Ohne sie wissen wir nicht
       einmal, DASS die Woche niedrig war — der Wert könnte ein Artefakt
       fehlender Einträge sein. */
    var c7 = (LH && LH.rolling && LH.rolling[7] && LH.rolling[7].completeness != null)
      ? LH.rolling[7].completeness : null;
    out0.weekCompleteness = c7;
    if (c7 == null || c7 < REBOUND.minWeekCompleteness) {
      out0.explained = false;
      out0.reason = 'incomplete_week_data';
      return out0;
    }
    out0.explained = false;
    out0.reason = 'no_declared_reason';
    return out0;
  }

  function _baselineOf(LH) {
    if (!LH || !LH.rolling) return { value: null, source: 'none', lastWeek: null, days: null };
    /* Mittel über 28 Tage, NICHT die Vorwoche: Eine Ausreißerwoche würde sich
       sonst fortschreiben. Der Wert wird auf eine Woche hochgerechnet, damit
       Bezugsgröße und Ziellast dieselbe Einheit haben. */
    var r28 = LH.rolling[28], r7 = LH.rolling[7];
    var lastWeek = (r7 && r7.systemicPerKnownDay != null) ? _r2(r7.systemicPerKnownDay * 7) : null;
    if (r28 && r28.systemicPerKnownDay != null) {
      return { value: _r2(r28.systemicPerKnownDay * 7), source: 'mean28', days: 28, lastWeek: lastWeek };
    }
    /* Nur die letzte Woche bekannt: Sie MUSS dann die Basis sein, aber das wird
       ausgewiesen — eine einzelne Woche ist eine schwächere Bezugsgröße. */
    if (lastWeek != null) return { value: lastWeek, source: 'week7_only', days: 7, lastWeek: lastWeek };
    return { value: null, source: 'none', lastWeek: null, days: null };
  }

  function _blockingConstraint(cs) {
    var list = Array.isArray(cs) ? cs : [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (!c) continue;
      if (c.severity >= 2 || (c.blocks || []).indexOf('all') >= 0) return c;
    }
    return null;
  }

  function _cells(TS) {
    if (!TS) return [];
    if (Array.isArray(TS.cells)) return TS.cells;
    return [];
  }
  function _worstActionableTolerance(TS) {
    var bad = _cells(TS).filter(function (c) { return c && c.actionable === true && c.status === 'poor'; });
    if (bad.length) return bad[0];
    var bord = _cells(TS).filter(function (c) { return c && c.actionable === true && c.status === 'borderline'; });
    return bord.length ? bord[0] : null;
  }
  function _worstObservedTolerance(TS) {
    var bad = _cells(TS).filter(function (c) { return c && c.status === 'poor'; });
    return bad.length ? bad[0] : null;
  }

  function _lowReadiness(LH) {
    var out = [], mr = (LH && LH.muscleReadiness) || {};
    Object.keys(mr).forEach(function (m) {
      if (mr[m] != null && mr[m] < CAPS.readinessBlock) out.push(m);
    });
    return out;
  }

  var api = {
    VERSION: VERSION, POLICY_VERSION: POLICY_VERSION,
    CAPS: CAPS, ADAPTIVE: ADAPTIVE, REBOUND: REBOUND, PHASE_RANGES: PHASE_RANGES,
    DIMENSION_POLICY: DIMENSION_POLICY, SCOPE_ALL: SCOPE_ALL, scopeOf: scopeOf,
    LOW_WEEK_REASONS: LOW_WEEK_REASONS, PLANNED_LOW: PLANNED_LOW,
    RETURN_RANGES: RETURN_RANGES,
    progressionDecision: progressionDecision, returnRecommendation: returnRecommendation
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.progression = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
