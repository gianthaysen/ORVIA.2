/* ============================================================
   ORVIA · adaptive-card — Sichtscheibe auf den Shadow Mode

   REINES MODUL, IN NODE AUSFUEHRBAR. View-Aufbau und HTML-Erzeugung liegen
   bewusst NICHT in ui.js: Nur so laesst sich das entscheidende Versprechen als
   VERHALTEN testen statt als Quelltextsuche — Karte rendern, danach Plan und
   Profil byte-identisch, keine Speicherfunktion beruehrt. Ein Modul ohne
   Zugriff auf PROFILE, DOM, Storage und Uhr KANN diese Zusagen nicht brechen.

   NEUN REGELN, JEDE ALS TEST:
     1 dargestellt wird ausschliesslich der View aus buildView() —
       keine eigene Engine-Berechnung im Renderer
     2 buildView() rechnet nichts nach: Es liest Beobachtung, Machbarkeit und
       Uebersetzer-Vorschau aus DEMSELBEN eingefrorenen Snapshot
     3 stale, partial und insufficient_data sind sichtbar VERSCHIEDENE Zustaende
     4 `within_modeled_corridor` wird NIE zu „Ziel ist machbar" umformuliert —
       die Engine bewertet Modellgrenzen, nicht biologische Gewissheit
     5 population_prior, schwache Evidenz und individualized:false stehen
       verstaendlich an der Aussage, nicht im Kleingedruckten
     6 jede Aenderung nennt Sportart und Geltungsbereich
     7 ohne Erklaerung: fail-soft LEER — keine halb gefuellte Karte
     8 KEINE Anwenden-Schaltflaeche, solange die Shadow-Abnahme offen ist —
       der Renderer erzeugt ueberhaupt keine Schaltflaechen
     9 Rendern veraendert und speichert nichts — strukturell: render() ist
       String → String, buildView() fasst seine Eingaenge nicht an

   Kein DOM, keine Uhr, kein Zufall, kein Storage, kein PROFILE.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'adaptive-card@2';

  /* ZENTRALES ESCAPING. Jede dynamische Interpolation im Renderer laeuft
     durch diese eine Funktion — auch Gruende, Scope-Bezeichnungen und spaeter
     hinzukommende Meldungen. Ein Feld, das daran vorbeigeht, ist ein Fehler;
     der Fuzz-Test im Kartentest injiziert Angriffsnutzlasten in JEDES
     String-Feld des Views und prueft die Ausgabe. Auch einfache
     Anfuehrungszeichen werden ersetzt (Attributkontexte). */
  function _esc(x) {
    return String(x == null ? '' : x)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function _r1(x) { return x == null ? null : Math.round(x * 10) / 10; }

  /* ============================================================
     VIEW-AUFBAU — pur. Der Live-Plan kommt als ARGUMENT herein; das Modul
     liest ihn nirgends selbst. Der Uebersetzer laeuft ausschliesslich gegen
     den SNAPSHOT-Plan — nie gegen den Live-Plan: Beobachtung, Machbarkeit
     und Vorschau muessen aus demselben Einfrieren stammen, sonst ist eine
     Abweichung nicht mehr zuzuordnen.
     ============================================================ */
  function buildView(ctx, livePlan, registry) {
    try {
      var c = ctx || null;
      if (!c || !c.obs) return { available: false, reason: 'no_observation' };
      var obs = c.obs, snap = c.snap || {};

      /* Fail-closed: Im Zweifel gilt die Erklaerung als veraltet. */
      var stale = true;
      try { stale = JSON.stringify(livePlan) !== JSON.stringify(snap.currentPlan); }
      catch (e) { stale = true; }

      var prog = obs.progression || null, feas = obs.feasibility || null;
      var R = registry || O;

      var proposal = null;
      try {
        var T = R.planTranslator;
        if (T && T.translate && snap.currentPlan && prog) {
          proposal = T.translate({ plan: snap.currentPlan, progression: prog,
            snapshotHash: snap.hash || null, weekId: obs.weekId || null,
            planId: obs.planId || null,
            planRevision: snap.planRevision != null ? snap.planRevision : null });
        }
      } catch (e) { proposal = null; }
      var pj = proposal && proposal.projection ? proposal.projection : null;

      function scopeLabel(sc) {
        if (!sc || sc.all === true) return 'gesamter Plan';
        var teile = [];
        if (sc.sport) teile.push(sc.sport === 'running' ? 'Laufen'
          : sc.sport === 'cycling' ? 'Radfahren' : sc.sport === 'swimming' ? 'Schwimmen'
          : sc.sport === 'gym' ? 'Krafttraining' : sc.sport);
        if (sc.domain) teile.push(sc.domain === 'highIntensity' ? 'harte Einheiten'
          : sc.domain === 'endurance' ? 'Grundlageneinheiten' : sc.domain);
        return teile.length ? teile.join(' · ') : 'unbestimmt — wirkt nicht';
      }
      var tage = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
      function tag(ix) { return tage[ix] || ('Tag ' + (ix + 1)); }

      return {
        available: true,
        stale: stale,
        createdAt: c.at || null,
        observationStatus: obs.status || null,
        current: {
          sessions: Array.isArray(snap.currentPlan)
            ? snap.currentPlan.reduce(function (n, d) { return n + ((d && d.length) || 0); }, 0) : null,
          weeklyLoad: pj ? pj.currentWeeklyLoad : null
        },
        recommendation: prog ? {
          direction: obs.deviation && obs.deviation.volume ? obs.deviation.volume.direction : null,
          deltaPct: prog.delta != null ? prog.delta : null,
          targetLoad: prog.targetLoad != null ? prog.targetLoad : null,
          provisional: prog.targetLoad == null && prog.provisionalTargetLoad != null,
          autoApplicable: prog.autoApplicable === true,
          blocked: (obs.deviation && obs.deviation.blocked) || [],
          selectionReason: prog.selectionReason || null,
          rationale: prog.rationale || null
        } : null,
        feasibility: feas ? {
          status: feas.status || null,
          evidence: feas.evidence || null,
          model: (feas.achievableTrajectory && feas.achievableTrajectory.model) || null,
          individualized: feas.achievableTrajectory ? feas.achievableTrajectory.individualized === true : null,
          estimatedWeeksRange: feas.estimatedWeeksRange || null,
          limitingFactors: feas.limitingFactors || [],
          modelNote: feas.modelNote || null
        } : null,
        wouldChange: proposal ? {
          status: proposal.status,
          autoApplicable: proposal.autoApplicable === true,
          durations: (proposal.changes || []).map(function (ch) {
            return { day: tag(ch.dayIdx), unit: ch.l, fromMin: ch.fromMin, toMin: ch.toMin,
              scope: scopeLabel(ch.scope) };
          }),
          removals: (proposal.removals || []).map(function (ch) {
            return { day: tag(ch.dayIdx), unit: ch.l, scope: scopeLabel(ch.scope), why: ch.rationale || null };
          }),
          intensity: (proposal.intensityChanges || []).map(function (ch) {
            return { day: tag(ch.dayIdx), unit: ch.l, from: ch.from, to: ch.to, scope: scopeLabel(ch.scope) };
          })
        } : null,
        residualGap: pj ? { value: pj.residualGap, status: pj.gapStatus,
          reasons: pj.gapReasons || [], achievedWeekly: pj.achievedWeeklyLoad,
          targetWeekly: pj.targetWeeklyLoad } : null,
        notes: (proposal && proposal.notes) || []
      };
    } catch (e) { return { available: false, reason: 'error' }; }
  }

  /* ============================================================
     RENDERER — String → String. Kein DOM, keine Registry, kein Zustand.
     ============================================================ */

  /* DIE WORTWAHL IST VERTRAG. `within_modeled_corridor` heisst: Der Bedarf
     liegt in dem Bereich, den das heutige Modell traegt. „Machbar" waere eine
     biologische Zusage, die die Engine ausdruecklich nicht macht — dieselbe
     Grenze, die der Status seit Stufe 5 zieht. */
  var FEAS_TEXT = {
    within_modeled_corridor: 'Der Bedarf liegt im modellierten Bereich.',
    outside_modeled_corridor: 'Der Bedarf liegt über dem modellierten Bereich.',
    insufficient_data: 'Für eine Einschätzung fehlen belastbare Daten.'
  };
  var BLOCK_TEXT = {
    not_actionable: 'Entscheidung nicht handlungsfähig (offene Rückfrage)',
    not_auto_applicable: 'keine automatische Anwendung freigegeben',
    provisional_only: 'nur vorläufiger Sicherheitswert',
    status_review: 'Woche wartet auf Einordnung',
    scope_unknown: 'Geltungsbereich unbestimmt — wirkt nicht',
    no_progression_result: 'keine Progressionsentscheidung'
  };

  function render(view) {
    var v = view || null;
    /* FAIL-SOFT: keine Erklaerung ⇒ LEER. Eine halb gefuellte Karte suggeriert
       eine Aussage, die es nicht gibt. */
    if (!v || v.available !== true) return '';

    var h = [];
    h.push('<div class="adx-card" data-adx="1">');

    /* Kopf mit Zustand: stale / partial / vollstaendig — drei sichtbar
       verschiedene Zustaende, nicht eine Farbe fuer alles. */
    h.push('<div class="adx-head"><b>Adaptive Einschätzung</b>');
    if (v.stale) {
      h.push('<span class="adx-badge adx-stale">Veraltet — der Plan wurde seither geändert</span>');
    } else if (v.observationStatus === 'partial') {
      h.push('<span class="adx-badge adx-partial">Unvollständig — nicht jede Stufe konnte rechnen</span>');
    } else if (v.observationStatus === 'failed') {
      h.push('<span class="adx-badge adx-partial">Berechnung fehlgeschlagen — keine Aussage</span>');
    } else {
      h.push('<span class="adx-badge adx-ok">Beobachtung · verändert den Plan nicht</span>');
    }
    h.push('</div>');

    /* Aktueller Plan. */
    if (v.current && (v.current.sessions != null || v.current.weeklyLoad != null)) {
      h.push('<p class="adx-row"><span>Aktueller Plan</span><b>' +
        (v.current.sessions != null ? _esc(v.current.sessions) + ' Einheiten' : '—') +
        (v.current.weeklyLoad != null ? ' · Wochenlast ' + _esc(_r1(v.current.weeklyLoad)) : '') + '</b></p>');
    }

    /* Empfehlung — mit Sperrgruenden in Klartext. */
    if (v.recommendation) {
      var r = v.recommendation;
      var richtung = r.direction === 'increase' ? 'mehr Umfang'
        : r.direction === 'reduce' ? 'weniger Umfang'
        : r.direction === 'hold' ? 'Umfang halten' : 'keine Richtung bestimmbar';
      h.push('<p class="adx-row"><span>Adaptive Empfehlung</span><b>' + _esc(richtung) +
        (r.deltaPct != null ? ' (' + (r.deltaPct > 0 ? '+' : '') + _esc(r.deltaPct) + ' %)' : '') +
        (r.provisional ? ' · vorläufig, wird nicht angewendet' : '') + '</b></p>');
      if (r.rationale) h.push('<p class="adx-why">' + _esc(r.rationale) + '</p>');
      if (r.blocked && r.blocked.length) {
        h.push('<p class="adx-blocked">Nicht automatisch anwendbar: ' +
          r.blocked.map(function (b) { return _esc(BLOCK_TEXT[b] || b); }).join(' · ') + '</p>');
      }
    }

    /* Machbarkeit — Modellsprache, nicht Zusagensprache. */
    if (v.feasibility && v.feasibility.status) {
      var f = v.feasibility;
      h.push('<p class="adx-row"><span>Zielaussicht</span><b>' +
        _esc(FEAS_TEXT[f.status] || f.status) + '</b></p>');
      if (f.status === 'insufficient_data' && f.limitingFactors.length) {
        h.push('<p class="adx-why">Es fehlt: ' + f.limitingFactors.map(_esc).join(', ') + '</p>');
      }
      if (f.estimatedWeeksRange && f.estimatedWeeksRange.min != null) {
        h.push('<p class="adx-why">Geschätzter Zeitraum: etwa ' + _esc(f.estimatedWeeksRange.min) +
          (f.estimatedWeeksRange.max != null ? ' bis ' + _esc(f.estimatedWeeksRange.max) + ' Wochen'
            : ' Wochen oder deutlich mehr') + ' — Spanne, keine Terminzusage.</p>');
      }
      /* MODELLKENNZEICHNUNG — verstaendlich, nicht als Fachbegriff: */
      if (f.model === 'population_prior' || f.individualized === false) {
        h.push('<p class="adx-model">Grundlage: Erfahrungswerte vergleichbarer Sportler' +
          (f.evidence === 'weak' ? ', Beleglage schwach' : '') +
          ' — kein auf dich individualisiertes Modell.</p>');
      }
    }

    /* Was wuerde sich aendern — NUR wenn nicht veraltet. Eine scheinbar
       aktuelle Vorher/Nachher-Darstellung zu einem alten Zustand waere
       schlimmer als keine. */
    if (!v.stale && v.wouldChange &&
        (v.wouldChange.durations.length || v.wouldChange.removals.length || v.wouldChange.intensity.length)) {
      h.push('<div class="adx-changes"><span class="adx-sub">Was sich ändern würde</span>');
      v.wouldChange.durations.forEach(function (c) {
        h.push('<p class="adx-chg">' + _esc(c.day) + ' · ' + _esc(c.unit) + ': ' +
          _esc(c.fromMin) + ' → ' + _esc(c.toMin) + ' min <i>(' + _esc(c.scope) + ')</i></p>');
      });
      v.wouldChange.removals.forEach(function (c) {
        h.push('<p class="adx-chg">' + _esc(c.day) + ' · ' + _esc(c.unit) +
          ': würde entfallen <i>(' + _esc(c.scope) + ')</i></p>');
      });
      v.wouldChange.intensity.forEach(function (c) {
        h.push('<p class="adx-chg">' + _esc(c.day) + ' · ' + _esc(c.unit) + ': Intensität ' +
          _esc(c.from) + ' → ' + _esc(c.to) + ' <i>(' + _esc(c.scope) + ')</i></p>');
      });
      h.push('</div>');
    }

    /* Restluecke — eine Auskunft, kein Fehler. */
    if (!v.stale && v.residualGap && v.residualGap.status && v.residualGap.status !== 'met_within_tolerance') {
      h.push('<p class="adx-gap">Restlücke: ' + _esc(_r1(v.residualGap.value)) +
        ' (' + _esc(v.residualGap.status === 'under_target' ? 'unter dem Ziel' : 'über dem Ziel') + ')' +
        (v.residualGap.reasons.length ? ' — Grund: ' + v.residualGap.reasons.map(_esc).join(', ') : '') + '</p>');
    }

    /* BEWUSST KEINE SCHALTFLAECHE. Die Karte ist eine Sichtscheibe auf den
       Schattenbetrieb — ein Anwenden-Knopf existiert erst, wenn die acht
       Abnahmekriterien erfuellt sind, und dann als eigener, gepruefter Pfad. */
    h.push('<p class="adx-foot">Beobachtung aus dem Schattenbetrieb — dein Plan bleibt unverändert.</p>');
    h.push('</div>');
    return h.join('');
  }

  var api = { VERSION: VERSION, buildView: buildView, render: render, esc: _esc,
    FEAS_TEXT: FEAS_TEXT, BLOCK_TEXT: BLOCK_TEXT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.adaptiveCard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
