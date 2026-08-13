/* ============================================================
   ORVIA · knowledge-ingest v1 — Wissen einspeisen, ohne den Vertrag zu kennen.

   WOZU. Gians Architekturvorgabe lautet: die App soll kein eigenes Denken
   haben, sondern ihr Wissen aus vielen externen Quellen ziehen — Coachwissen,
   Videos, Studien —, die ER einspeist. Der Wissensvertrag (v6) kann das
   tragen: er fuehrt ein versioniertes Quellenregister, atomare Claims mit
   Quellenbezug, Evidenzklassen und Offenlegung.

   Nur ist er zum Befuellen von Hand unbrauchbar. Eine einzige Regel verlangt
   20 Pflichtfelder, ein Claim elf, eine Quelle dreizehn — darunter Dinge wie
   `positionRole`, `seasonPhase`, `previousVersion` oder `conservativeFallback`.
   Wer damit taeglich Wissen einpflegen soll, hoert nach dem dritten Eintrag
   auf. Genau daran waere die Idee gescheitert.

   Dieses Modul ist die Bruecke. Eingabe ist eine schlanke deutsche Notiz;
   Ausgabe sind vertragskonforme Register- und Packstrukturen.

   DIE TRENNLINIE, UM DIE ES GEHT. Aufgefuellt wird ausschliesslich, was KEINE
   inhaltliche Entscheidung ist:
     · Formalien       version, packVersion, seasonPhase, positionRole,
                       previousVersion, changeReason
     · Governance      technisch ungeprueft, wissenschaftlich ungeprueft —
                       NIE eine fingierte Freigabe
     · Struktur        Claim-Huelle um die Aussage herum
   Erzwungen wird alles Inhaltliche — und zwar mit einer Fehlermeldung, die
   sagt, WAS zu tun ist, nicht nur was fehlt:
     · Wer sagt es, wann, wo nachzulesen
     · Fuer wen gilt es, fuer wen ausdruecklich NICHT
     · Was folgt daraus NICHT (Grenzen der Uebertragbarkeit)
     · Welche Unsicherheiten bleiben
     · Bei Zahlen: Einheiten, Gueltigkeitsbereich, Ausschluesse,
       Unsicherheit und Sicherheitsgrenzen

   URHEBERRECHT — eine harte Grenze, keine Empfehlung. Aufgenommen werden nur
   EIGENE Paraphrasen. Volltranskripte von Videos oder Studientexte sind
   geschuetzte Sprachwerke; Fakten und Zahlen darin sind es nicht. Das Modul
   kann nicht erkennen, ob ein Text abgeschrieben ist — es kann aber die
   Laenge begrenzen und eine ausdrueckliche Bestaetigung verlangen. Beides
   tut es. Was es NICHT tut, ist so zu tun, als koenne es Plagiate erkennen.

   REIN. Kein DOM, kein Storage, kein Netz, keine eigene Zeitquelle. Das
   Modul liest und schreibt keine Dateien — das tut das Werkzeug drumherum.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'knowledge-ingest@1';

  /* Laengengrenze der Paraphrase. Grosszuegig genug fuer eine ordentliche
     Zusammenfassung, zu knapp fuer ein Transkript. [A] Erfahrungswert, keine
     juristische Groesse. */
  var MAX_PARAPHRASE = 700;
  var MAX_STATEMENT = 400;

  /* Quellenarten in Gians Sprache → Vertragstypen. Bewusst eine geschlossene
     Liste: eine unbekannte Art wird abgewiesen, nicht auf gut Glueck
     eingeordnet — sonst entschiede ein Tippfehler ueber die Evidenzklasse. */
  var ART = {
    'video': 'coach_practice_video',
    'coachvideo': 'coach_practice_video',
    'coach': 'expert_practice',
    'coachprogramm': 'coach_curriculum',
    'lehrbuch': 'textbook',
    'verband': 'federation_guideline',
    'leitlinie': 'consensus_statement',
    'konsens': 'consensus_statement',
    'uebersichtsarbeit': 'systematic_review',
    'metaanalyse': 'systematic_review',
    'studie': 'primary_study',
    'rct': 'rct',
    'kohorte': 'cohort_study',
    'review': 'narrative_review',
    'praxissynthese': 'practice_synthesis'
  };
  /* Rolle einer Aussage in Gians Sprache → decisionRole. */
  var ROLLE = {
    'studie': 'evidence',
    'evidenz': 'evidence',
    'fachkonsens': 'expert_consensus',
    'coachkonsens': 'expert_consensus',
    'erfahrung': 'expert_consensus',
    'produktentscheidung': 'product_policy',
    'notfallregel': 'fallback'
  };
  var QUALITAET = { 'hoch': 'high', 'mittel': 'moderate', 'niedrig': 'low', 'unklar': 'unclear' };

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function str(v) { return (typeof v === 'string' && v.trim()) ? v.trim() : null; }
  function strList(v) {
    if (!Array.isArray(v)) return null;
    var out = [];
    for (var i = 0; i < v.length; i++) { var s = str(v[i]); if (!s) return null; out.push(s); }
    return out.length ? out : null;
  }
  function isIsoDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var t = Date.parse(s + 'T00:00:00Z');
    return isFinite(t) && (new Date(t)).toISOString().slice(0, 10) === s;
  }

  /* ---------- Fehler mit Handlungsanweisung ----------
     Ein Fehler, der nur sagt „Feld fehlt", hilft niemandem beim Einpflegen.
     Jeder Code traegt deshalb einen deutschen Satz, der die naechste Handlung
     benennt. */
  function _err(list, feld, code, hinweis) {
    list.push({ feld: feld, code: code, hinweis: hinweis });
  }

  /* ---------- Quelle ---------- */
  function buildSource(q, errs) {
    if (!isObj(q)) { _err(errs, 'quelle', 'quelle_fehlt', 'Es fehlt ein Abschnitt "quelle" mit Angaben zur Herkunft.'); return null; }
    var id = str(q.id);
    if (!id) _err(errs, 'quelle.id', 'id_fehlt', 'Vergib eine eindeutige Kennung, z. B. "SRC-COACH-MUSTER-2025".');
    else if (!/^SRC-[A-Z0-9-]+$/.test(id)) _err(errs, 'quelle.id', 'id_form', 'Die Kennung muss mit "SRC-" beginnen und darf nur Grossbuchstaben, Ziffern und Bindestriche enthalten.');

    var artRoh = str(q.art);
    var sourceType = artRoh ? ART[artRoh.toLowerCase()] : null;
    if (!artRoh) _err(errs, 'quelle.art', 'art_fehlt', 'Gib die Art an: ' + Object.keys(ART).join(', ') + '.');
    else if (!sourceType) _err(errs, 'quelle.art', 'art_unbekannt', 'Unbekannte Art "' + artRoh + '". Erlaubt: ' + Object.keys(ART).join(', ') + '.');

    var titel = str(q.titel);
    if (!titel) _err(errs, 'quelle.titel', 'titel_fehlt', 'Trage den Titel des Videos, Artikels oder Programms ein.');
    var wer = str(q.wer);
    if (!wer) _err(errs, 'quelle.wer', 'wer_fehlt', 'Wer sagt das? Name des Coaches, der Autoren oder der Organisation.');
    var jahr = (typeof q.jahr === 'number' && isFinite(q.jahr) && Math.floor(q.jahr) === q.jahr && q.jahr >= 1900 && q.jahr <= 2100) ? q.jahr : null;
    if (jahr === null) _err(errs, 'quelle.jahr', 'jahr_fehlt', 'Trage das Erscheinungsjahr als Zahl ein (z. B. 2025).');

    /* Nachweis: URL, DOI oder PMID — irgendetwas, womit man es wiederfindet.
       Ohne das waere die Quelle eine Behauptung ueber eine Behauptung. */
    var url = str(q.url), doi = str(q.doi), pmid = str(q.pmid);
    var identifier = {};
    if (doi && doi.indexOf('10.') === 0) identifier.doi = doi;
    if (pmid && /^\d{5,9}$/.test(pmid)) identifier.pmid = pmid;
    if (url && /^https?:\/\//.test(url)) identifier.url = url;
    if (!Object.keys(identifier).length) {
      _err(errs, 'quelle.url', 'nachweis_fehlt', 'Es braucht einen Nachweis: "url" (mit http…), "doi" (beginnt mit 10.) oder "pmid". Sonst ist die Quelle spaeter nicht mehr auffindbar.');
    }

    var sports = strList(q.sportarten);
    if (!sports) _err(errs, 'quelle.sportarten', 'sportarten_fehlen', 'Fuer welche Sportarten gilt das? Liste, z. B. ["gym"] oder ["running","cycling"].');
    var populations = strList(q.gilt_fuer);
    if (!populations) _err(errs, 'quelle.gilt_fuer', 'population_fehlt', 'Fuer wen gilt das? Z. B. ["freizeitsportler"] oder ["leistungslaeufer"]. „Alle" ist selten richtig.');
    var outcomes = strList(q.worum_gehts);
    if (!outcomes) _err(errs, 'quelle.worum_gehts', 'thema_fehlt', 'Worum geht es? Z. B. ["uebungsauswahl"] oder ["verletzungsrisiko"].');

    var qual = str(q.qualitaet);
    var methodQuality = qual ? QUALITAET[qual.toLowerCase()] : null;
    if (!qual) _err(errs, 'quelle.qualitaet', 'qualitaet_fehlt', 'Wie belastbar ist die Quelle? "hoch", "mittel", "niedrig" oder "unklar".');
    else if (!methodQuality) _err(errs, 'quelle.qualitaet', 'qualitaet_unbekannt', 'Erlaubt sind: hoch, mittel, niedrig, unklar.');

    var summary = str(q.kernaussage);
    if (!summary) _err(errs, 'quelle.kernaussage', 'kernaussage_fehlt', 'Fasse die Kernaussage in EIGENEN Worten zusammen. Kein Zitat, keine Abschrift.');
    else if (summary.length > MAX_PARAPHRASE) {
      _err(errs, 'quelle.kernaussage', 'kernaussage_zu_lang',
        'Die Zusammenfassung ist ' + summary.length + ' Zeichen lang, erlaubt sind ' + MAX_PARAPHRASE +
        '. Eine so lange Passage ist meist abgeschrieben — und fremder Text darf hier nicht gespeichert werden. Kuerze auf die Aussage.');
    }
    var limits = str(q.grenzen);
    if (!limits) _err(errs, 'quelle.grenzen', 'grenzen_fehlen', 'Was folgt daraus ausdruecklich NICHT? Z. B. „gilt nur fuer Trainierte, keine Aussage fuer Anfaenger".');

    /* Die Bestaetigung ist bewusst ein eigenes Pflichtfeld und kein Haken in
       einer Voreinstellung: sie soll bei JEDEM Eintrag bewusst gesetzt werden.
       EHRLICHE GRENZE: geprueft wird nur, dass die Bestaetigung dasteht —
       nicht, ob sie stimmt. Software kann kein Plagiat erkennen. */
    if (q.eigene_worte !== true) {
      _err(errs, 'quelle.eigene_worte', 'paraphrase_unbestaetigt',
        'Setze "eigene_worte": true. Damit bestaetigst du, dass die Zusammenfassung von dir formuliert ist und kein uebernommener Text. Fakten und Zahlen darfst du frei verwenden, fremde Formulierungen nicht.');
    }
    var geprueft = str(q.geprueft_am);
    if (!geprueft || !isIsoDate(geprueft)) {
      _err(errs, 'quelle.geprueft_am', 'datum_fehlt', 'Wann hast du die Quelle zuletzt angesehen? Format 2026-08-12.');
    }

    if (errs.length) return null;
    return {
      sourceId: id, title: titel, authorsOrOrg: wer, year: jahr,
      sourceType: sourceType, identifier: identifier,
      sports: sports, populations: populations, outcomes: outcomes,
      appraisal: {
        studyDesign: str(q.aufbau) || sourceType,
        methodQuality: methodQuality,
        /* Kein formales Risk-of-Bias-Verfahren — das ehrlich benennen, statt
           eine Bewertung zu behaupten, die niemand durchgefuehrt hat. */
        riskOfBias: 'not_formally_assessed'
      },
      summary: summary, limitsAndTransferability: limits, lastCheckedAt: geprueft
    };
  }

  /* ---------- Quantitatives Paket ---------- */
  function buildQuantitative(z, errs, pfad) {
    if (z === undefined || z === null) return null;
    if (!isObj(z)) { _err(errs, pfad, 'zahlen_form', 'Der Abschnitt "zahlen" muss ein Objekt sein.'); return null; }
    var f = function (k, name, hinweis) {
      var v = str(z[k]);
      if (!v) _err(errs, pfad + '.' + k, 'zahlen_' + k + '_fehlt', hinweis);
      return v;
    };
    var inputUnits = f('eingabe_einheit', 'eingabe_einheit', 'In welcher Einheit kommt der Wert herein? Z. B. "km/Woche".');
    var outputUnits = f('ausgabe_einheit', 'ausgabe_einheit', 'In welcher Einheit steht das Ergebnis? Z. B. "Saetze".');
    var population = f('gilt_fuer', 'gilt_fuer', 'Fuer wen gilt die Zahl? Eine Zahl ohne Population ist keine Aussage.');
    var quelltext = f('so_steht_es_da', 'so_steht_es_da', 'Wie ist die Zahl in der Quelle formuliert? Kurz, in eigenen Worten.');
    var umrechnung = f('umrechnung', 'umrechnung', 'Wurde umgerechnet? Sonst "keine".');
    var unsicherheit = f('unsicherheit', 'unsicherheit', 'Wie genau ist die Zahl? Z. B. "±2 Saetze" oder "grobe Groessenordnung".');
    var grenzen = f('sicherheitsgrenzen', 'sicherheitsgrenzen', 'Wo ist Schluss? Z. B. "nie mehr als 10 harte Saetze je Muskel und Einheit". Eine Vorgabe ohne Sicherheitsgrenze ist ein Risiko.');
    var bereich = z.bereich;
    var min = (isObj(bereich) && typeof bereich.min === 'number' && isFinite(bereich.min)) ? bereich.min : null;
    var max = (isObj(bereich) && typeof bereich.max === 'number' && isFinite(bereich.max)) ? bereich.max : null;
    if (min === null || max === null) {
      _err(errs, pfad + '.bereich', 'bereich_fehlt', 'Gib den Gueltigkeitsbereich an: {"min": 2, "max": 6}. Ausserhalb davon gilt die Zahl nicht.');
    } else if (min > max) {
      _err(errs, pfad + '.bereich', 'bereich_verdreht', 'min ist groesser als max — vertauscht?');
    }
    var aus = strList(z.nicht_bei);
    if (!Array.isArray(z.nicht_bei)) {
      _err(errs, pfad + '.nicht_bei', 'ausschluesse_fehlen', 'Wann gilt die Zahl NICHT? Liste, z. B. ["akute Verletzung"]. Leere Liste [] ist erlaubt, aber bewusst.');
    }
    if (errs.length) return null;
    return {
      schemaVersion: 1,
      inputUnits: inputUnits, outputUnits: outputUnits,
      validRange: { min: min, max: max },
      population: population,
      exclusions: aus || [],
      sourceQuantitativeStatement: quelltext,
      allowedTransformation: umrechnung,
      uncertaintyRange: unsicherheit,
      /* NIE aus der Notiz uebernehmbar: eine unabhaengige Validierung
         behauptet man nicht per Eingabefeld. Bleibt false, bis jemand sie
         wirklich durchgefuehrt und im Vertrag hinterlegt hat. */
      independentValidation: false,
      safetyBounds: grenzen
    };
  }

  /* ---------- Regel ---------- */
  function buildRule(r, ctx, errs) {
    if (!isObj(r)) { _err(errs, 'regel', 'regel_form', 'Jede Regel muss ein Objekt sein.'); return null; }
    var id = str(r.id);
    if (!id) _err(errs, 'regel.id', 'regel_id_fehlt', 'Vergib eine Kennung, z. B. "GYM-SEL-001".');
    var aussage = str(r.aussage);
    if (!aussage) _err(errs, 'regel.aussage', 'aussage_fehlt', 'Was besagt die Regel? Ein Satz, in eigenen Worten.');
    else if (aussage.length > MAX_STATEMENT) {
      _err(errs, 'regel.aussage', 'aussage_zu_lang', 'Die Aussage ist ' + aussage.length + ' Zeichen lang, erlaubt sind ' + MAX_STATEMENT + '. Teile sie in mehrere Regeln auf — eine Regel, eine Aussage.');
    }
    var thema = str(r.thema);
    if (!thema) _err(errs, 'regel.thema', 'thema_fehlt', 'Worum geht es? Z. B. "uebungsauswahl", "satzzahl", "pausenlaenge".');

    var rolleRoh = str(r.art);
    var decisionRole = rolleRoh ? ROLLE[rolleRoh.toLowerCase()] : null;
    if (!rolleRoh) _err(errs, 'regel.art', 'rolle_fehlt', 'Worauf beruht die Regel? ' + Object.keys(ROLLE).join(', ') + '.');
    else if (!decisionRole) _err(errs, 'regel.art', 'rolle_unbekannt', 'Unbekannt: "' + rolleRoh + '". Erlaubt: ' + Object.keys(ROLLE).join(', ') + '.');

    var quellen = strList(r.quellen);
    if (!quellen && decisionRole !== 'product_policy' && decisionRole !== 'fallback') {
      _err(errs, 'regel.quellen', 'quellen_fehlen', 'Nenne die Quellen-Kennungen, auf denen die Regel beruht, z. B. ["SRC-COACH-MUSTER-2025"]. Ohne Quelle ist es keine abgeleitete Regel — dann waehle art "produktentscheidung".');
    }
    if (quellen && ctx.bekannteQuellen) {
      for (var i = 0; i < quellen.length; i++) {
        if (ctx.bekannteQuellen.indexOf(quellen[i]) < 0) {
          _err(errs, 'regel.quellen', 'quelle_unbekannt', 'Die Quelle "' + quellen[i] + '" ist nirgends beschrieben. Lege sie im Abschnitt "quelle" an oder korrigiere die Kennung.');
        }
      }
    }
    /* Mehrere Quellen ⇒ die Kombinationsart ist Pflicht. Ohne sie gewinnt im
       Vertrag NIE automatisch die beste Quelle — das ist Absicht. */
    var KOMB = { 'alle_noetig': 'all_required', 'jede_reicht': 'each_sufficient', 'haupt_plus_zusatz': 'primary_plus_supplementary' };
    var kombRoh = str(r.quellen_zusammenspiel);
    var sourceCombination = kombRoh ? KOMB[kombRoh.toLowerCase()] : null;
    if (quellen && quellen.length > 1 && (decisionRole === 'evidence' || decisionRole === 'expert_consensus')) {
      if (!sourceCombination) {
        _err(errs, 'regel.quellen_zusammenspiel', 'zusammenspiel_fehlt',
          'Bei mehreren Quellen: wie spielen sie zusammen? "alle_noetig" (die schwaechste zaehlt), "jede_reicht" oder "haupt_plus_zusatz".');
      }
    }

    var geltung = strList(r.gilt_fuer);
    if (!geltung) _err(errs, 'regel.gilt_fuer', 'geltung_fehlt', 'Fuer wen gilt die Regel? Liste, z. B. ["freizeitsportler"].');
    if (!Array.isArray(r.nicht_fuer)) _err(errs, 'regel.nicht_fuer', 'ausschluss_fehlt', 'Fuer wen gilt sie ausdruecklich NICHT? Liste; [] ist erlaubt, aber bewusst.');
    var unsicher = strList(r.unsicherheiten);
    if (!unsicher) _err(errs, 'regel.unsicherheiten', 'unsicherheiten_fehlen', 'Was ist unsicher? Mindestens ein Punkt — eine Regel ohne Unsicherheit gibt es nicht.');
    var fallback = str(r.wenn_unsicher);
    if (!fallback) _err(errs, 'regel.wenn_unsicher', 'fallback_fehlt', 'Was gilt, wenn die Regel nicht anwendbar ist? Die vorsichtige Variante.');

    var medizinisch = r.medizinisch_heikel === true;
    var safety = Array.isArray(r.sicherheitsgrenzen) ? strList(r.sicherheitsgrenzen) : null;
    if (medizinisch && !safety) {
      _err(errs, 'regel.sicherheitsgrenzen', 'safety_fehlt', 'Eine medizinisch heikle Regel braucht Sicherheitsgrenzen. Ausserdem bleibt sie gesperrt, bis sie medizinisch freigegeben ist.');
    }
    if (typeof r.medizinisch_heikel !== 'boolean' && r.medizinisch_heikel !== undefined) {
      _err(errs, 'regel.medizinisch_heikel', 'medizinisch_form', 'Muss true oder false sein (nicht "true" als Text).');
    }

    var eingaben = strList(r.braucht) || ['profile.sports'];
    var ausgaben = strList(r.wirkt_auf);
    if (!ausgaben) _err(errs, 'regel.wirkt_auf', 'wirkung_fehlt', 'Worauf wirkt die Regel? Z. B. ["session.exercises"] oder ["session.sets"].');

    var quant = buildQuantitative(r.zahlen, errs, 'regel.zahlen');
    if (errs.length) return null;

    var claim = {
      claimId: id + '-C1',
      statement: aussage,
      sourceRefs: quellen || [],
      decisionRole: decisionRole,
      population: geltung.join(', '),
      applicability: (r.wann ? str(r.wann) : null) || geltung.join(', '),
      outcome: thema,
      directness: (str(r.bezug) === 'indirekt') ? 'indirect' : ((str(r.bezug) === 'teilweise') ? 'partial' : 'direct'),
      use: quant ? 'quantitative' : 'qualitative',
      uncertainties: unsicher,
      essential: true
    };
    if (quant) claim.quantitative = quant;
    if (sourceCombination) claim.sourceCombination = sourceCombination;
    if (decisionRole === 'evidence') {
      claim.supportBasis = str(r.beleg) || ('Aussage der Quelle zu: ' + thema);
      claim.synthesis = { consistency: (quellen && quellen.length > 1) ? 'consistent' : 'single_source' };
    }

    return {
      ruleId: id,
      version: 1,
      packVersion: ctx.packVersion,
      sport: ctx.sport,
      discipline: str(r.disziplin) || 'general',
      positionRole: str(r.position) || null,
      seasonPhase: str(r.saisonphase) || 'any',
      topic: thema,
      statement: aussage,
      inputs: eingaben,
      outputs: ausgaben,
      applicability: { populations: geltung },
      excludedPopulations: strList(r.nicht_fuer) || [],
      safetyLimits: safety || [],
      contraindications: strList(r.gegenanzeigen) || [],
      conservativeFallback: fallback,
      claims: [claim],
      medicalSafetyRelevant: medizinisch,
      /* NIE eine fingierte Freigabe. Alles Eingespeiste startet ungeprueft;
         freigeben kann nur ein qualifizierter Pruefer ueber den Vertragsweg. */
      governance: {
        technicalStatus: 'draft',
        scientificReviewStatus: 'unreviewed',
        medicalSafetyReviewStatus: medizinisch ? 'required_unreviewed' : 'not_required',
        reviews: []
      },
      changeReason: str(r.warum_neu) || 'eingespeist ueber knowledge-ingest',
      previousVersion: null
    };
  }

  /* ---------- Hauptfunktion ----------
     notiz: { sport, packId?, quelle: {...} | quellen: [{...}], regeln: [...] }
     Rueckgabe: { ok, sources[], rules[], fehler[], version }
     Bei ok:false ist NICHTS gebaut — es gibt keine halben Eintraege. */
  function ingest(notiz, opts) {
    opts = isObj(opts) ? opts : {};
    var errs = [];
    if (!isObj(notiz)) {
      return { ok: false, sources: [], rules: [], version: VERSION,
        fehler: [{ feld: '_', code: 'notiz_fehlt', hinweis: 'Es wurde keine Notiz uebergeben.' }] };
    }
    var sport = str(notiz.sport);
    if (!sport) _err(errs, 'sport', 'sport_fehlt', 'Fuer welche Sportart ist dieses Wissen? Z. B. "gym" oder "running".');

    var rohQuellen = Array.isArray(notiz.quellen) ? notiz.quellen : (notiz.quelle ? [notiz.quelle] : []);
    if (!rohQuellen.length) _err(errs, 'quelle', 'quelle_fehlt', 'Es fehlt mindestens eine Quelle ("quelle" oder "quellen").');

    var sources = [], ids = [];
    for (var i = 0; i < rohQuellen.length; i++) {
      var qErrs = [];
      var s = buildSource(rohQuellen[i], qErrs);
      qErrs.forEach(function (e) { e.feld = 'quellen[' + i + '].' + e.feld.replace(/^quelle\./, ''); errs.push(e); });
      if (s) {
        if (ids.indexOf(s.sourceId) >= 0) _err(errs, 'quellen[' + i + '].id', 'id_doppelt', 'Die Kennung "' + s.sourceId + '" kommt zweimal vor.');
        ids.push(s.sourceId); sources.push(s);
      }
    }

    var rohRegeln = Array.isArray(notiz.regeln) ? notiz.regeln : [];
    if (!rohRegeln.length) _err(errs, 'regeln', 'regeln_fehlen', 'Was folgt aus der Quelle? Mindestens eine Regel unter "regeln". Eine Quelle ohne abgeleitete Regel aendert am Verhalten der App nichts.');

    var rules = [], rIds = [];
    var ctx = { sport: sport || 'unknown', packVersion: opts.packVersion || 1,
      bekannteQuellen: ids.concat(opts.zusaetzlicheQuellen || []) };
    for (var j = 0; j < rohRegeln.length; j++) {
      var rErrs = [];
      var rr = buildRule(rohRegeln[j], ctx, rErrs);
      rErrs.forEach(function (e) { e.feld = 'regeln[' + j + '].' + e.feld.replace(/^regel\./, ''); errs.push(e); });
      if (rr) {
        if (rIds.indexOf(rr.ruleId) >= 0) _err(errs, 'regeln[' + j + '].id', 'id_doppelt', 'Die Regel-Kennung "' + rr.ruleId + '" kommt zweimal vor.');
        rIds.push(rr.ruleId); rules.push(rr);
      }
    }

    if (errs.length) return { ok: false, sources: [], rules: [], fehler: errs, version: VERSION };
    return { ok: true, sources: sources, rules: rules, fehler: [], version: VERSION };
  }

  /* Fehler als lesbarer Text — fuer das Werkzeug und fuer Fehlermeldungen in
     der Oberflaeche. Bewusst hier und nicht im Werkzeug, damit beide Wege
     dieselbe Formulierung zeigen. */
  function fehlerText(fehler) {
    if (!Array.isArray(fehler) || !fehler.length) return '';
    return fehler.map(function (e) {
      return '  • ' + e.feld + ': ' + e.hinweis + '   [' + e.code + ']';
    }).join('\n');
  }

  var api = { VERSION: VERSION, ART: ART, ROLLE: ROLLE, QUALITAET: QUALITAET,
    MAX_PARAPHRASE: MAX_PARAPHRASE, MAX_STATEMENT: MAX_STATEMENT,
    ingest: ingest, fehlerText: fehlerText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.knowledgeIngest = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
