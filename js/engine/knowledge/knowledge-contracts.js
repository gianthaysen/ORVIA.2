/* ============================================================
   ORVIA · knowledge-contracts — Vertrag v3 (Korrekturbatch 3b.0b).

   Änderungen v2 → v3 (v2 wird nie wiederverwendet):
   - PFLICHT-PINNING: selectRules blockiert, wenn eines der Felder
     expectedKnowledgeVersion / expectedPackContentHash /
     expectedSourceRegistryVersion / expectedSourceRegistryHash / mode
     fehlt (eigene stabile Fehlercodes). Der Consumer muss die Werte als
     UNABHÄNGIGE Konstanten pinnen — niemals pack.contentHash zur
     Laufzeit als Erwartung zurückreichen.
   - VERSIONIERTES QUELLENREGISTER: öffentlicher Vertrag ist
     { registryVersion, sources, contentHash } (registryContentHash über
     alle entscheidungsrelevanten Felder). Jede inhaltliche Änderung
     unter derselben Source-ID ändert den Hash und blockiert bis zum
     ausdrücklichen Consumer-Update.
   - REVIEW-BINDUNG: reproduzierbarer ruleEvidenceHash (fachlicher
     Regelinhalt OHNE Governance — löst das Zirkularitätsproblem) +
     sourceRegistryHash. Ein Review ist nur gültig, wenn
     reviewedRuleEvidenceHash, reviewedSourceRegistryHash,
     reviewedVersion und scope exakt passen — jede nachträgliche
     fachliche Änderung invalidiert Freigaben automatisch.
   - QUALIFIKATION: typisierte Qualifikationsbereiche je Review-Scope +
     dokumentierter Verifikationsdatensatz. Produkt-Owner-/Entwickler-
     rollen können keine wissenschaftliche/medizinische Freigabe
     erzeugen. EHRLICH: Software prüft nur den HINTERLEGTEN
     Verifikationsstatus, nicht die reale Echtheit eines Abschlusses.
   - APPRAISAL-AUTORITÄT: Studiendesign/Methodenqualität/Risk-of-Bias/
     Population/Outcomes liegen ZENTRAL im Quellenregister; Claims
     steuern nur Direktheit, Anwendbarkeit und Synthese-Konsistenz.
     Claim-Manipulation kann die Klasse nicht hochstufen. Bei mehreren
     Quellen ist die Kombinationsart PFLICHT (all_required ⇒ schwächste
     notwendige Basis; each_sufficient; primary_plus_supplementary) —
     ohne Angabe gewinnt NICHT automatisch die beste Quelle.
   - SEMANTISCHE VALIDIERUNG: nichtleere kanonische Pfade, plausible
     Jahre, ISO-Daten, typgerechte Identifikatoren, gefüllte
     Applicability, Safety-Pflichten je Relevanz; leere Listen sind von
     FEHLENDEN Feldern unterschieden.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  /* v5 (Korrekturbatch 3b.0d; v4 wird nie wiederverwendet):
     - medicalSafetyRelevant MUSS strikt Boolean sein — "true"/1/0/Objekt/
       Array/null blockieren validateRule/validatePack/selectRules und
       umgehen nie die medizinische Reviewpflicht.
     - Alle kanonischen Source-Felder typisiert (sourceId/title/authorsOrOrg
       nichtleere Strings; identifier/appraisal Nicht-Array-Objekte).
     - Quantitatives Schema explizit UND versioniert (QUANT_SCHEMA_VERSION):
       Einheiten/Textfelder nichtleere Strings, exclusions String-Array,
       validRange typisiertes {min,max}-Objekt, independentValidation exakt
       Boolean true; nicht formal bewertete Quellen autorisieren KEINE
       quantitative Nutzung.
     - maxConfidenceFor mit bloßer Klassen-Kurzform ist FAIL-CLOSED: hohe
       Confidence entsteht ausschließlich aus vollständigem Regelobjekt +
       gepinntem Register; maxConfidenceFor('A') ist nie 'high'.
     - Erwartbare malformte Strukturen (inputs:{}, synthesis:'x', Arrays an
       Objektstellen) liefern FELDBEZOGENE Fehler statt in den Catch zu
       laufen; internal_validator_error bleibt nur letzter Schutz.
     - Vollständige Typ-/Beziehungsprüfung der Versions-/Pflichtfelder
       (registryVersion, pack.version, packVersion, previousVersion,
       seasonPhase, changeReason, positionRole, medicalSafetyRelevant;
       positive Ganzzahlen; rule.packVersion === pack.version).

     v4-Erbe (Korrekturbatch 3b.0c): TOTALE ausnahmesichere Validatoren,
     strikte Typprüfung, konservative Evidenzklasse (A nur bei high +
     riskOfBias low; not_formally_assessed nie A/high), Pflicht-Pin
     expectedKnowledgeContractVersion. */
  var KNOWLEDGE_CONTRACT_VERSION = 5;
  var QUANT_SCHEMA_VERSION = 1;

  function _deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.keys(o).forEach(function (k) { _deepFreeze(o[k]); });
      Object.freeze(o);
    }
    return o;
  }

  /* ---------- Vokabulare ---------- */
  var EVIDENCE_CLASSES = {
    A: { rank: 4, label: 'Leitlinie/Konsens/hochwertige systematische Übersicht — abgeleitet' },
    B: { rank: 3, label: 'Peer-reviewte Primärstudie / validiertes Modell — abgeleitet' },
    C: { rank: 2, label: 'Experten-/Konsensregel bzw. abgestufte Evidenz — abgeleitet' },
    D: { rank: 1, label: 'ORVIA-Produktheuristik/Fallback — nie allein hohe Confidence, nie quantitativ' }
  };
  var DECISION_ROLES = ['evidence', 'product_policy', 'expert_consensus', 'fallback'];
  var CLAIM_USES = ['qualitative', 'ordinal', 'quantitative'];
  var DIRECTNESS = ['direct', 'partial', 'indirect'];
  var METHOD_QUALITY = ['high', 'moderate', 'low', 'unclear'];
  var RISK_OF_BIAS = ['low', 'some_concerns', 'high', 'not_formally_assessed'];
  var CONSISTENCY = ['consistent', 'mixed', 'single_source', 'unknown'];
  var SOURCE_COMBINATIONS = ['all_required', 'each_sufficient', 'primary_plus_supplementary'];
  var TECHNICAL_STATUSES = ['draft', 'reviewed'];
  var SCIENTIFIC_STATUSES = ['unreviewed', 'approved', 'rejected'];
  var MEDICAL_STATUSES = ['not_required', 'required_unreviewed', 'approved', 'rejected'];
  var MODES = ['production', 'shadow'];
  var SOURCE_TYPES = ['consensus_statement', 'position_stand', 'systematic_review', 'rct', 'cohort_study', 'primary_study', 'narrative_review', 'expert_practice', 'orvia_internal_contract'];
  /* Typisierte Qualifikationsbereiche. Produkt-/Entwicklerrollen sind bewusst
     KEINEM Freigabe-Scope zugeordnet. */
  var QUALIFICATION_TYPES = ['sports_science_academic', 'exercise_physiology_academic', 'physician', 'physician_sports_medicine', 'licensed_physiotherapist', 'product_owner', 'software_engineer'];
  var SCIENTIFIC_QUALIFICATIONS = ['sports_science_academic', 'exercise_physiology_academic', 'physician', 'physician_sports_medicine', 'licensed_physiotherapist'];
  var MEDICAL_QUALIFICATIONS = ['physician', 'physician_sports_medicine', 'licensed_physiotherapist'];

  /* ---------- Deterministische Hashes (FNV-1a) ---------- */
  function _fnv(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return 'fnv1a-' + ('0000000' + h.toString(16)).slice(-8);
  }
  function packContentHash(pack) {
    if (!pack || typeof pack !== 'object') return null;
    var clone = {};
    Object.keys(pack).forEach(function (k) { if (k !== 'contentHash') clone[k] = pack[k]; });
    return _fnv(JSON.stringify(clone));
  }
  /* Fachlicher Regelinhalt OHNE Governance-/Review-Metadaten — Grundlage der
     Review-Bindung (kein Zirkularitätsproblem, reproduzierbar). */
  function ruleEvidenceHash(rule) {
    if (!rule || typeof rule !== 'object') return null;
    var clone = {};
    Object.keys(rule).forEach(function (k) { if (k !== 'governance') clone[k] = rule[k]; });
    return _fnv(JSON.stringify(clone));
  }
  /* Registerhash über ALLE entscheidungsrelevanten Source-Felder
     (registryVersion + sources; ohne das eigene contentHash-Feld). */
  function registryContentHash(registry) {
    if (!registry || typeof registry !== 'object' || !Array.isArray(registry.sources)) return null;
    return _fnv(JSON.stringify({ registryVersion: registry.registryVersion, sources: registry.sources }));
  }

  /* ---------- Evidenzklasse: zentral aus dem QUELLENREGISTER abgeleitet ----------
     Quellenbezogen (Register): sourceType, studyDesign, methodQuality,
     riskOfBias. Claimbezogen: directness, synthesis.consistency,
     sourceCombination. Claim-Felder können die Basis NIE hochstufen. */
  function _rankToClass(rank) { return rank >= 4 ? 'A' : rank === 3 ? 'B' : rank === 2 ? 'C' : 'D'; }
  /* Der Quellentyp liefert nur den MÖGLICHEN Ceiling — nicht die endgültige
     Qualität. Klasse A (Rang 4) erfordert geeigneten Typ UND methodQuality
     'high' UND formal positives Risk-of-Bias-Appraisal ('low').
     'not_formally_assessed' oder 'some_concerns' ⇒ konservativer Ceiling B;
     'moderate' Qualität ⇒ nie automatisch A. */
  function sourceClassRank(src) {
    if (!src || typeof src !== 'object') return 0;
    if (src.sourceType === 'orvia_internal_contract') return 1;
    var typeCeiling = (src.sourceType === 'consensus_statement' || src.sourceType === 'position_stand' || src.sourceType === 'systematic_review') ? 4
      : (src.sourceType === 'rct' || src.sourceType === 'cohort_study' || src.sourceType === 'primary_study' || src.sourceType === 'narrative_review') ? 3
        : 2;
    var ap = (src.appraisal && typeof src.appraisal === 'object') ? src.appraisal : {};
    var r = typeCeiling;
    if (!(ap.methodQuality === 'high' && ap.riskOfBias === 'low')) r = Math.min(r, 3);   // A nur mit formal positivem Appraisal
    if (ap.methodQuality === 'low' || ap.methodQuality === 'unclear') r -= 1;
    if (ap.riskOfBias === 'high') r -= 1;
    return r < 1 ? 1 : r;
  }
  /* Hohe Confidence erfordert formal bewertete Quellen: liefert true, wenn
     ALLE Referenzen aller essenziellen Evidenz-Claims riskOfBias 'low' oder
     'some_concerns' tragen ('not_formally_assessed'/'high' ⇒ false). */
  function _essentialSourcesFormallyAssessed(rule, sourcesById) {
    var claims = (rule && Array.isArray(rule.claims)) ? rule.claims : [];
    for (var i = 0; i < claims.length; i++) {
      var c = claims[i];
      if (!c || c.essential !== true || c.decisionRole !== 'evidence') continue;
      var refs = Array.isArray(c.sourceRefs) ? c.sourceRefs : [];
      for (var j = 0; j < refs.length; j++) {
        var src = sourcesById && sourcesById[refs[j]];
        var rob = src && src.appraisal && src.appraisal.riskOfBias;
        if (rob !== 'low' && rob !== 'some_concerns') return false;
      }
    }
    return true;
  }
  function deriveClaimEvidenceClass(claim, sourcesById) {
    if (!claim) return 'D';
    if (claim.decisionRole === 'product_policy' || claim.decisionRole === 'fallback') return 'D';
    if (claim.decisionRole === 'expert_consensus') return 'C';
    var refs = Array.isArray(claim.sourceRefs) ? claim.sourceRefs : [];
    if (!refs.length) return 'D';
    var ranks = [];
    for (var i = 0; i < refs.length; i++) {
      var src = sourcesById && sourcesById[refs[i]];
      if (!src) return 'D';                                           // unauflösbar ⇒ fail-closed
      if (src.sourceType === 'orvia_internal_contract') return 'D';   // intern kann nie A/B werden
      ranks.push(sourceClassRank(src));
    }
    var candidate;
    if (refs.length === 1) candidate = ranks[0];
    else if (claim.sourceCombination === 'all_required') candidate = Math.min.apply(null, ranks);       // schwächste NOTWENDIGE Basis
    else if (claim.sourceCombination === 'each_sufficient') candidate = Math.max.apply(null, ranks);
    else if (claim.sourceCombination === 'primary_plus_supplementary') candidate = ranks[0];            // Primärquelle trägt
    else return 'D';                                                   // Kombinationsart fehlt ⇒ fail-closed, NIE Bestquelle
    if (claim.directness === 'indirect') candidate -= 1;
    if (claim.synthesis && claim.synthesis.consistency === 'mixed') candidate -= 1;
    if (candidate < 1) candidate = 1;
    return _rankToClass(candidate);
  }
  function ruleEvidenceCeiling(rule, sourcesById) {
    var claims = (rule && Array.isArray(rule.claims)) ? rule.claims.filter(function (c) { return c && c.essential === true; }) : [];
    if (!claims.length) return null;
    var worst = 5;
    claims.forEach(function (c) {
      var rank = EVIDENCE_CLASSES[deriveClaimEvidenceClass(c, sourcesById)].rank;
      if (rank < worst) worst = rank;
    });
    return _rankToClass(worst);
  }
  function maxConfidenceFor(rule, sourcesById) {
    /* FAIL-CLOSED (v5): die bloße Klassen-Kurzform (nur eine Klasse, KEIN
       Regelobjekt + KEIN gepinntes Register) darf nie hohe Confidence
       erzeugen — hohe Confidence entsteht ausschließlich aus einem
       vollständigen Regelobjekt mit formal bewerteten essenziellen Quellen. */
    if (typeof rule === 'string') return 'low';
    var ceiling = ruleEvidenceCeiling(rule, sourcesById);
    if (ceiling === 'A' || ceiling === 'B') {
      if (!_essentialSourcesFormallyAssessed(rule, sourcesById)) return 'medium';   // not_formally_assessed nie high
      return 'high';
    }
    if (ceiling === 'C' || ceiling === 'D') return 'medium';
    return 'low';
  }

  /* ---------- Quantitative Nutzung: EXPLIZITES, VERSIONIERTES Schema ----------
     Keine bloße Anwesenheitsprüfung — jedes Feld typgeprüft; nicht formal
     bewertete Quellen autorisieren keine quantitative Engine-Nutzung. */
  var QUANT_REQUIRED = ['schemaVersion', 'inputUnits', 'outputUnits', 'validRange', 'population', 'exclusions',
    'sourceQuantitativeStatement', 'allowedTransformation', 'uncertaintyRange', 'independentValidation', 'safetyBounds'];
  var QUANT_STRING_FIELDS = ['inputUnits', 'outputUnits', 'population', 'sourceQuantitativeStatement', 'allowedTransformation', 'uncertaintyRange', 'safetyBounds'];
  function _validRangeTyped(r) {
    return !!(r && typeof r === 'object' && !Array.isArray(r) &&
      typeof r.min === 'number' && isFinite(r.min) &&
      typeof r.max === 'number' && isFinite(r.max) && r.min <= r.max);
  }
  function quantitativeUseAllowed(claim, sourcesById) {
    if (!claim || typeof claim !== 'object' || claim.use !== 'quantitative') return false;
    var cls = deriveClaimEvidenceClass(claim, sourcesById);
    if (cls !== 'A' && cls !== 'B') return false;
    /* Nicht formal bewertete Quellen dürfen keine quantitative Nutzung
       autorisieren (derzeit alle Registerquellen not_formally_assessed). */
    var refs = Array.isArray(claim.sourceRefs) ? claim.sourceRefs : [];
    for (var r = 0; r < refs.length; r++) {
      var s = sourcesById && sourcesById[refs[r]];
      var rob = s && s.appraisal && s.appraisal.riskOfBias;
      if (rob !== 'low' && rob !== 'some_concerns') return false;
    }
    var q = claim.quantitative;
    if (!q || typeof q !== 'object' || Array.isArray(q)) return false;
    if (q.schemaVersion !== QUANT_SCHEMA_VERSION) return false;                 // versioniert
    for (var i = 0; i < QUANT_STRING_FIELDS.length; i++) { if (!_isNonEmptyString(q[QUANT_STRING_FIELDS[i]])) return false; }
    if (!_validRangeTyped(q.validRange)) return false;                          // eindeutig typisiert {min,max}
    if (!Array.isArray(q.exclusions) || !q.exclusions.every(_isNonEmptyString)) return false;
    if (q.independentValidation !== true) return false;                         // EXAKT Boolean true — 'ja'/1/{} unzulässig
    return true;
  }

  /* ---------- semantische Hilfsprüfungen ---------- */
  function _isNonEmptyString(v) { return typeof v === 'string' && v.trim() !== ''; }
  function _isNonEmptyStringArray(v) { return Array.isArray(v) && v.length > 0 && v.every(_isNonEmptyString); }
  function _isArrayOfStrings(v) { return Array.isArray(v) && v.every(_isNonEmptyString); }   // darf bewusst leer sein
  function _isIsoDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var t = Date.parse(s + 'T00:00:00Z');
    return isFinite(t) && (new Date(t)).toISOString().slice(0, 10) === s;
  }
  function _isPlausibleYear(y) { return typeof y === 'number' && isFinite(y) && Math.floor(y) === y && y >= 1900 && y <= 2100; }
  function _isPositiveInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= 1; }

  /* ---------- Quellen-Validierung (inkl. zentralem Appraisal) ---------- */
  var SOURCE_REQUIRED = ['sourceId', 'title', 'authorsOrOrg', 'year', 'sourceType', 'identifier',
    'sports', 'populations', 'outcomes', 'appraisal', 'summary', 'limitsAndTransferability', 'lastCheckedAt'];
  var SOURCE_STRING_FIELDS = ['sourceId', 'title', 'authorsOrOrg', 'sourceType', 'summary', 'limitsAndTransferability', 'lastCheckedAt'];
  function validateSource(src) {
    try { return _validateSourceInner(src); }
    catch (e) { return { valid: false, errors: [{ code: 'internal_validator_error', detail: String(e && e.message || e) }] }; }
  }
  function _validateSourceInner(src) {
    var errors = [];
    function err(code, detail) { errors.push({ code: code, detail: ((src && src.sourceId) || '?') + (detail ? ':' + detail : '') }); }
    if (!src || typeof src !== 'object' || Array.isArray(src)) return { valid: false, errors: [{ code: 'source_not_object', detail: '' }] };
    SOURCE_REQUIRED.forEach(function (k) { if (!(k in src) || src[k] == null || src[k] === '') err('source_missing_field', k); });
    /* Strikte Typen (v5): kanonische Stringfelder als nichtleere Strings —
       Arrays/Objekte an diesen Stellen blockieren das Register. */
    SOURCE_STRING_FIELDS.forEach(function (k) { if (k in src && src[k] != null && !_isNonEmptyString(src[k])) err('source_invalid_field_type', k); });
    if (src.sourceType && SOURCE_TYPES.indexOf(src.sourceType) < 0) err('source_unknown_type', String(src.sourceType));
    if (!_isPlausibleYear(src.year)) err('source_invalid_year', String(src.year));
    if (!_isIsoDate(src.lastCheckedAt)) err('source_invalid_checked_date', String(src.lastCheckedAt));
    if (!_isNonEmptyStringArray(src.sports)) err('source_empty_sports');
    if (!_isNonEmptyStringArray(src.populations)) err('source_empty_populations');
    if (!_isNonEmptyStringArray(src.outcomes)) err('source_empty_outcomes');
    if (!_isNonEmptyString(src.summary)) err('source_empty_summary');
    if (!_isNonEmptyString(src.limitsAndTransferability)) err('source_empty_limits');
    var idf = src.identifier;
    if (!idf || typeof idf !== 'object' || Array.isArray(idf)) err('source_missing_identifier');   // Nicht-Array-Objekt
    else if (src.sourceType === 'orvia_internal_contract') {
      if (!_isNonEmptyString(idf.internalPath)) err('source_invalid_identifier', 'internalPath_required');
    } else {
      var okId = (_isNonEmptyString(idf.doi) && idf.doi.indexOf('10.') === 0) ||
        (_isNonEmptyString(idf.pmid) && /^\d{5,9}$/.test(idf.pmid)) ||
        (_isNonEmptyString(idf.url) && /^https?:\/\//.test(idf.url));
      if (!okId) err('source_invalid_identifier', 'doi_pmid_or_url_required');
    }
    var ap = src.appraisal;
    if (!ap || typeof ap !== 'object' || Array.isArray(ap) || !_isNonEmptyString(ap.studyDesign) ||   // Nicht-Array-Objekt
      METHOD_QUALITY.indexOf(ap.methodQuality) < 0 || RISK_OF_BIAS.indexOf(ap.riskOfBias) < 0) {
      err('source_missing_central_appraisal');
    }
    return { valid: errors.length === 0, errors: errors };
  }

  /* ---------- Claim-Validierung ---------- */
  var CLAIM_REQUIRED = ['claimId', 'statement', 'sourceRefs', 'decisionRole', 'population', 'applicability', 'outcome', 'directness', 'use', 'uncertainties', 'essential'];
  var CLAIM_STRING_FIELDS = ['claimId', 'statement', 'population', 'applicability', 'outcome'];
  function validateClaim(claim, ruleId, sourcesById) {
    try { return _validateClaimInner(claim, ruleId, sourcesById); }
    catch (e) { return [{ code: 'internal_validator_error', detail: String(e && e.message || e) }]; }
  }
  function _validateClaimInner(claim, ruleId, sourcesById) {
    var errors = [];
    function err(code, detail) { errors.push({ code: code, detail: ruleId + '/' + ((claim && typeof claim.claimId === 'string' && claim.claimId) || '?') + (detail ? ':' + detail : '') }); }
    if (!claim || typeof claim !== 'object' || Array.isArray(claim)) { err('claim_not_object'); return errors; }
    CLAIM_REQUIRED.forEach(function (k) { if (!(k in claim) || claim[k] == null || claim[k] === '') err('claim_missing_field', k); });
    /* Strikte Typen: kanonische Stringfelder als nichtleere Strings —
       Arrays/Objekte/Primitive an deren Stelle sind ungültig. */
    CLAIM_STRING_FIELDS.forEach(function (k) { if (k in claim && claim[k] != null && !_isNonEmptyString(claim[k])) err('claim_invalid_field_type', k); });
    /* sourceRefs IMMER Array nichtleerer Strings — auch bei Produktregeln. */
    if (!Array.isArray(claim.sourceRefs) || !claim.sourceRefs.every(_isNonEmptyString)) err('claim_invalid_source_refs');
    if ('evidenceClass' in claim) err('claim_declares_evidence_class_forbidden');
    /* Appraisal-Autorität: Design/Qualität/RoB liegen NUR im Register —
       Claim-Manipulation kann die Klasse nicht steuern. Der `in`-Operator
       wird NUR auf ein Nicht-Array-Objekt angewandt (v5: sonst würfe
       synthesis:'x' einen TypeError statt eines Feldfehlers). */
    var _synObj = (claim.synthesis && typeof claim.synthesis === 'object' && !Array.isArray(claim.synthesis)) ? claim.synthesis : null;
    if ('appraisal' in claim || (_synObj && ('methodQuality' in _synObj || 'studyDesign' in _synObj || 'riskOfBias' in _synObj))) {
      err('claim_appraisal_fields_forbidden');
    }
    if (DECISION_ROLES.indexOf(claim.decisionRole) < 0) err('claim_unknown_decision_role', String(claim.decisionRole));
    if (CLAIM_USES.indexOf(claim.use) < 0) err('claim_unknown_use', String(claim.use));
    if (DIRECTNESS.indexOf(claim.directness) < 0) err('claim_unknown_directness', String(claim.directness));
    if (typeof claim.essential !== 'boolean') err('claim_essential_not_boolean');
    if (!_isNonEmptyStringArray(claim.uncertainties)) err('claim_missing_uncertainties');
    var refs = Array.isArray(claim.sourceRefs) ? claim.sourceRefs : [];
    refs.forEach(function (id) { if (sourcesById && !sourcesById[id]) err('claim_unknown_source_ref', id); });
    if (claim.decisionRole === 'evidence' || claim.decisionRole === 'expert_consensus') {
      if (!refs.length) err('claim_evidence_without_source_refs');
      if (refs.length > 1 && SOURCE_COMBINATIONS.indexOf(claim.sourceCombination) < 0) {
        err('claim_missing_source_combination');   // ohne Angabe gewinnt NIE automatisch die beste Quelle
      }
      if (claim.decisionRole === 'evidence') {
        if (!_isNonEmptyString(claim.supportBasis)) err('claim_missing_support_basis');
        if (!claim.synthesis || typeof claim.synthesis !== 'object' || Array.isArray(claim.synthesis) ||
          CONSISTENCY.indexOf(claim.synthesis.consistency) < 0) err('claim_missing_synthesis_consistency');
      }
    }
    if (claim.use === 'quantitative' && !quantitativeUseAllowed(claim, sourcesById)) err('claim_quantitative_not_authorized');
    return errors;
  }

  /* ---------- Review-Validierung (typisierte Qualifikation + Hash-Bindung) ----------
     EHRLICHE GRENZE: Software prüft ausschließlich den HINTERLEGTEN
     Verifikationsdatensatz (verified/verifiedBy/verifiedAt) — nicht die
     reale Echtheit einer Qualifikation. */
  var REVIEW_REQUIRED = ['reviewer', 'role', 'qualificationType', 'qualificationVerification', 'scope', 'date', 'decision', 'conflictsOfInterest', 'reviewedVersion', 'reviewedRuleEvidenceHash', 'reviewedSourceRegistryHash'];
  var REVIEW_SCOPES = ['scientific', 'medical_safety'];
  var REVIEW_DECISIONS = ['approved', 'rejected'];
  /* STRIKT typisiert: Objekte/Arrays statt Name/Rolle, ungültige Daten,
     untypisierte Scopes/Entscheidungen/Qualifikationen oder unvollständige
     Verifikationsdatensätze verhindern die Freigabe. Ehrliche Grenze:
     geprüft wird der HINTERLEGTE Verifikationsdatensatz, nicht die reale
     Echtheit des Abschlusses. */
  function _reviewStructurallyComplete(rec) {
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return false;
    for (var i = 0; i < REVIEW_REQUIRED.length; i++) {
      var v = rec[REVIEW_REQUIRED[i]];
      if (v == null || v === '') return false;
    }
    if (!_isNonEmptyString(rec.reviewer) || !_isNonEmptyString(rec.role)) return false;
    if (REVIEW_SCOPES.indexOf(rec.scope) < 0) return false;
    if (REVIEW_DECISIONS.indexOf(rec.decision) < 0) return false;
    if (!_isIsoDate(rec.date)) return false;
    if (!_isNonEmptyString(rec.conflictsOfInterest)) return false;
    if (QUALIFICATION_TYPES.indexOf(rec.qualificationType) < 0) return false;
    if (!_isNonEmptyString(rec.reviewedRuleEvidenceHash) || !_isNonEmptyString(rec.reviewedSourceRegistryHash)) return false;
    var qv = rec.qualificationVerification;
    return !!(qv && typeof qv === 'object' && !Array.isArray(qv) && qv.verified === true && _isNonEmptyString(qv.verifiedBy) && _isIsoDate(qv.verifiedAt));
  }
  function reviewBindsToRule(rec, rule, sourceRegistryHash) {
    return _reviewStructurallyComplete(rec) &&
      rec.decision === 'approved' &&
      rec.reviewedVersion === rule.version &&
      rec.reviewedRuleEvidenceHash === ruleEvidenceHash(rule) &&
      rec.reviewedSourceRegistryHash === sourceRegistryHash;
  }
  function _qualifiedFor(rec, scope) {
    if (QUALIFICATION_TYPES.indexOf(rec.qualificationType) < 0) return false;
    if (scope === 'scientific') return SCIENTIFIC_QUALIFICATIONS.indexOf(rec.qualificationType) >= 0;
    if (scope === 'medical_safety') return MEDICAL_QUALIFICATIONS.indexOf(rec.qualificationType) >= 0;
    return false;
  }

  /* ---------- Regel-Validierung ---------- */
  var RULE_REQUIRED = ['ruleId', 'version', 'packVersion', 'sport', 'discipline', 'positionRole', 'seasonPhase',
    'statement', 'inputs', 'outputs', 'applicability', 'excludedPopulations', 'safetyLimits', 'contraindications',
    'conservativeFallback', 'claims', 'governance', 'medicalSafetyRelevant', 'changeReason', 'previousVersion'];
  function validateRule(rule, sourcesById, ctx) {
    try { return _validateRuleInner(rule, sourcesById, ctx); }
    catch (e) { return { valid: false, errors: [{ code: 'internal_validator_error', detail: String(e && e.message || e) }] }; }
  }
  function _validateRuleInner(rule, sourcesById, ctx) {
    ctx = ctx || {};
    var errors = [];
    function err(code, detail) { errors.push({ code: code, detail: ((rule && typeof rule.ruleId === 'string' && rule.ruleId) || '?') + (detail ? ':' + detail : '') }); }
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) { err('rule_not_object'); return { valid: false, errors: errors }; }
    RULE_REQUIRED.forEach(function (k) { if (!(k in rule)) err('rule_missing_field', k); });
    if (!_isNonEmptyString(rule.ruleId)) err('rule_invalid_field_type', 'ruleId');
    ['sport', 'discipline', 'topic'].forEach(function (k) { if (k in rule && rule[k] != null && !_isNonEmptyString(rule[k])) err('rule_invalid_field_type', k); });
    if (typeof rule.version !== 'number' || !isFinite(rule.version) || Math.floor(rule.version) !== rule.version || rule.version < 1) err('rule_missing_version');
    /* v5: Versions-/Pflichtfeld-Typen strikt gegen den dokumentierten Vertrag. */
    if (!_isPositiveInt(rule.packVersion)) err('rule_invalid_pack_version', String(rule.packVersion));
    if (ctx.packVersion != null && rule.packVersion !== ctx.packVersion) err('rule_pack_version_mismatch', 'rule=' + rule.packVersion + ' pack=' + ctx.packVersion);
    if (!(rule.previousVersion === null || _isPositiveInt(rule.previousVersion))) err('rule_invalid_previous_version', String(rule.previousVersion));
    if (!_isNonEmptyString(rule.seasonPhase)) err('rule_invalid_season_phase', String(rule.seasonPhase));
    if (!_isNonEmptyString(rule.changeReason)) err('rule_invalid_change_reason');
    if (!(rule.positionRole === null || _isNonEmptyString(rule.positionRole))) err('rule_invalid_position_role', String(rule.positionRole));
    /* medicalSafetyRelevant MUSS strikt Boolean sein — typwidrige Kennzeichnung
       ("true"/1/0/{}/[]/null) blockiert und umgeht nie die Reviewpflicht. */
    if (typeof rule.medicalSafetyRelevant !== 'boolean') err('rule_invalid_medical_safety_relevant', Object.prototype.toString.call(rule.medicalSafetyRelevant));
    if ('evidenceClass' in rule) err('rule_declares_evidence_class_forbidden');
    /* Semantik: Inputs/Outputs = nichtleere Arrays nichtleerer kanonischer Pfade. */
    if (!_isNonEmptyStringArray(rule.inputs)) err('rule_empty_inputs');
    if (!_isNonEmptyStringArray(rule.outputs)) err('rule_empty_outputs');
    if (!_isNonEmptyString(rule.statement)) err('rule_empty_statement');
    if (!_isNonEmptyString(rule.conservativeFallback)) err('rule_empty_fallback');
    if (!rule.applicability || typeof rule.applicability !== 'object' || !_isNonEmptyStringArray(rule.applicability.populations)) err('rule_empty_applicability');
    /* Leere Listen sind ZULÄSSIG, aber nur als bewusste leere Arrays (fehlende Felder fängt RULE_REQUIRED). */
    if (!_isArrayOfStrings(rule.excludedPopulations)) err('rule_invalid_excluded_populations');
    if (!_isArrayOfStrings(rule.contraindications)) err('rule_invalid_contraindications');
    if (!_isArrayOfStrings(rule.safetyLimits)) err('rule_invalid_safety_limits');
    if (rule.medicalSafetyRelevant === true && (!Array.isArray(rule.safetyLimits) || !rule.safetyLimits.length)) err('rule_medical_without_safety_limits');
    if (!Array.isArray(rule.claims) || !rule.claims.length) err('rule_missing_claims');
    else {
      var claimIds = {}, hasEssential = false;
      rule.claims.forEach(function (c) {
        if (c && claimIds[c.claimId]) err('claim_duplicate_id', c.claimId);
        if (c) claimIds[c.claimId] = true;
        if (c && c.essential === true) hasEssential = true;
        errors.push.apply(errors, validateClaim(c, rule.ruleId, sourcesById));
      });
      if (!hasEssential) err('rule_no_essential_claim');
    }
    (Array.isArray(rule.inputs) ? rule.inputs : []).forEach(function (inp) {   // v5: nur Arrays iterieren (inputs:{} ⇒ Feldfehler oben, kein throw)
      if (/goal\.(targetValue|targetTime|targetDate)/.test(String(inp))) err('rule_uses_goal_target_as_input', String(inp));
    });
    var g = rule.governance;
    if (!g || typeof g !== 'object') err('rule_missing_governance');
    else {
      if (TECHNICAL_STATUSES.indexOf(g.technicalStatus) < 0) err('rule_unknown_technical_status', String(g.technicalStatus));
      if (SCIENTIFIC_STATUSES.indexOf(g.scientificReviewStatus) < 0) err('rule_unknown_scientific_status', String(g.scientificReviewStatus));
      if (MEDICAL_STATUSES.indexOf(g.medicalSafetyReviewStatus) < 0) err('rule_unknown_medical_status', String(g.medicalSafetyReviewStatus));
      if (rule.medicalSafetyRelevant === true && g.medicalSafetyReviewStatus === 'not_required') err('rule_medical_relevance_mismatch');
      if ('reviews' in g && g.reviews != null && !Array.isArray(g.reviews)) err('rule_reviews_not_array');
      function checkApproved(scope, code) {
        var recs = (Array.isArray(g.reviews) ? g.reviews : []).filter(function (r) { return r && r.scope === scope; });
        var bound = recs.filter(function (r) { return reviewBindsToRule(r, rule, ctx.sourceRegistryHash); });
        if (!bound.length) { err(code, scope); return; }
        if (!bound.some(function (r) { return _qualifiedFor(r, scope); })) err('rule_approved_without_valid_qualification', scope);
      }
      if (g.scientificReviewStatus === 'approved') checkApproved('scientific', 'rule_approved_without_bound_review');
      if (g.medicalSafetyReviewStatus === 'approved') checkApproved('medical_safety', 'rule_approved_without_bound_review');
    }
    return { valid: errors.length === 0, errors: errors };
  }

  /* ---------- Register-/Pack-Validierung (TOTAL: falsche Typen erzeugen
     Fehlercodes, nie Exceptions — vor JEDER Iteration wird der exakte Typ
     geprüft) ---------- */
  function _validateRegistryInner(registry) {
    var errors = [];
    if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
      return { valid: false, errors: [{ code: 'registry_not_versioned', detail: 'erwartet {registryVersion, sources, contentHash}' }], sourcesById: {} };
    }
    if (!_isPositiveInt(registry.registryVersion)) errors.push({ code: 'registry_missing_version', detail: String(registry.registryVersion) });
    var srcIds = {};
    if (!Array.isArray(registry.sources) || !registry.sources.length) {
      errors.push({ code: 'registry_sources_not_array', detail: Object.prototype.toString.call(registry.sources) });
      return { valid: false, errors: errors, sourcesById: srcIds };   // keine Iteration über Nicht-Arrays
    }
    var computed = registryContentHash(registry);
    if (registry.contentHash == null || registry.contentHash !== computed) {
      errors.push({ code: 'registry_hash_mismatch_declared', detail: 'declared=' + registry.contentHash + ' computed=' + computed });
    }
    registry.sources.forEach(function (s) {
      if (s && typeof s === 'object' && !Array.isArray(s) && _isNonEmptyString(s.sourceId)) {
        if (srcIds[s.sourceId]) errors.push({ code: 'source_duplicate_id', detail: s.sourceId });
        srcIds[s.sourceId] = s;
      }
      var sv = validateSource(s);
      if (!sv.valid) errors.push.apply(errors, sv.errors);
    });
    return { valid: errors.length === 0, errors: errors, sourcesById: srcIds };
  }
  function validateRegistry(registry) {
    try { return _validateRegistryInner(registry); }
    catch (e) { return { valid: false, errors: [{ code: 'internal_validator_error', detail: String(e && e.message || e) }], sourcesById: {} }; }
  }
  function _validatePackInner(pack, registry) {
    var errors = [];
    var reg = validateRegistry(registry);
    errors.push.apply(errors, reg.errors);
    if (!pack || typeof pack !== 'object' || Array.isArray(pack)) {
      return { valid: false, errors: errors.concat([{ code: 'pack_not_object', detail: '' }]), sourcesById: reg.sourcesById };
    }
    ['packId', 'version', 'knowledgeVersion', 'sport', 'rules', 'contentHash'].forEach(function (k) {
      if (pack[k] == null) errors.push({ code: 'pack_missing_field', detail: k });
    });
    ['packId', 'knowledgeVersion', 'sport'].forEach(function (k) {
      if (pack[k] != null && !_isNonEmptyString(pack[k])) errors.push({ code: 'pack_invalid_field_type', detail: k });
    });
    if (pack.version != null && !_isPositiveInt(pack.version)) errors.push({ code: 'pack_invalid_field_type', detail: 'version' });
    var computed = packContentHash(pack);
    if (pack.contentHash != null && pack.contentHash !== computed) {
      errors.push({ code: 'content_hash_mismatch_declared', detail: 'declared=' + pack.contentHash + ' computed=' + computed });
    }
    if (!Array.isArray(pack.rules)) {
      errors.push({ code: 'pack_rules_not_array', detail: Object.prototype.toString.call(pack.rules) });
      return { valid: false, errors: errors, sourcesById: reg.sourcesById };   // keine Iteration über Nicht-Arrays
    }
    var regHash = registryContentHash(registry);
    var ruleIds = {};
    pack.rules.forEach(function (r) {
      if (r && typeof r === 'object' && !Array.isArray(r) && _isNonEmptyString(r.ruleId)) {
        if (ruleIds[r.ruleId]) errors.push({ code: 'rule_duplicate_id', detail: r.ruleId });
        ruleIds[r.ruleId] = true;
      }
      var rv = validateRule(r, reg.sourcesById, { sourceRegistryHash: regHash, packVersion: (_isPositiveInt(pack.version) ? pack.version : null) });
      if (!rv.valid) errors.push.apply(errors, rv.errors);
    });
    return { valid: errors.length === 0, errors: errors, sourcesById: reg.sourcesById };
  }
  function validatePack(pack, registry) {
    try { return _validatePackInner(pack, registry); }
    catch (e) { return { valid: false, errors: [{ code: 'internal_validator_error', detail: String(e && e.message || e) }], sourcesById: {} }; }
  }

  /* ---------- FAIL-CLOSED Auswahl mit PFLICHT-PINNING ---------- */
  var REQUIRED_PINS = [
    ['expectedKnowledgeContractVersion', 'missing_pin_knowledge_contract_version'],
    ['expectedKnowledgeVersion', 'missing_pin_knowledge_version'],
    ['expectedPackContentHash', 'missing_pin_pack_content_hash'],
    ['expectedSourceRegistryVersion', 'missing_pin_source_registry_version'],
    ['expectedSourceRegistryHash', 'missing_pin_source_registry_hash']
  ];
  function _selectRulesInner(pack, registry, criteria) {
    criteria = (criteria && typeof criteria === 'object' && !Array.isArray(criteria)) ? criteria : {};
    var errors = [];
    /* Auch die SEMANTIK des ausführenden Vertrags ist gepinnt: eine geänderte
       Ableitungs-/Validierungslogik (neue Vertragsversion) darf unter alten
       Consumer-Pins nie unbemerkt andere Ergebnisse erzeugen. */
    if (criteria.expectedKnowledgeContractVersion != null && criteria.expectedKnowledgeContractVersion !== '' &&
      criteria.expectedKnowledgeContractVersion !== KNOWLEDGE_CONTRACT_VERSION) {
      errors.push({ code: 'knowledge_contract_version_mismatch', detail: 'expected=' + criteria.expectedKnowledgeContractVersion + ' actual=' + KNOWLEDGE_CONTRACT_VERSION });
    }
    REQUIRED_PINS.forEach(function (p) {
      if (criteria[p[0]] == null || criteria[p[0]] === '') errors.push({ code: p[1], detail: p[0] + ' ist Pflicht (unabhängige Consumer-Konstante, nie zur Laufzeit aus dem Pack gelesen)' });
    });
    var mode = criteria.mode;
    if (MODES.indexOf(mode) < 0) errors.push({ code: 'missing_or_unknown_mode', detail: String(mode) });
    var pv = validatePack(pack, registry);
    if (!pv.valid) errors.push.apply(errors, pv.errors);
    if (pack && criteria.expectedKnowledgeVersion != null && pack.knowledgeVersion !== criteria.expectedKnowledgeVersion) {
      errors.push({ code: 'knowledge_version_mismatch', detail: 'expected=' + criteria.expectedKnowledgeVersion + ' actual=' + (pack && pack.knowledgeVersion) });
    }
    if (pack && criteria.expectedPackContentHash != null) {
      var computedPack = packContentHash(pack);
      if (computedPack !== criteria.expectedPackContentHash) errors.push({ code: 'content_hash_mismatch_pinned', detail: 'expected=' + criteria.expectedPackContentHash + ' actual=' + computedPack });
    }
    if (registry && criteria.expectedSourceRegistryVersion != null && registry.registryVersion !== criteria.expectedSourceRegistryVersion) {
      errors.push({ code: 'source_registry_version_mismatch', detail: 'expected=' + criteria.expectedSourceRegistryVersion + ' actual=' + (registry && registry.registryVersion) });
    }
    if (registry && criteria.expectedSourceRegistryHash != null) {
      var computedReg = registryContentHash(registry);
      if (computedReg !== criteria.expectedSourceRegistryHash) errors.push({ code: 'source_registry_hash_mismatch_pinned', detail: 'expected=' + criteria.expectedSourceRegistryHash + ' actual=' + computedReg });
    }
    if (errors.length) return { rules: [], blocked: true, errors: errors, excluded: [] };

    var regHash = registryContentHash(registry);
    var excluded = [];
    var rules = pack.rules
      .filter(function (r) {
        if (criteria.sport && r.sport !== criteria.sport) return false;
        if (criteria.topic && r.topic !== criteria.topic) return false;
        return true;
      })
      .filter(function (r) {
        var g = r.governance;
        if (g.technicalStatus !== 'reviewed') { excluded.push({ ruleId: r.ruleId, code: 'technical_review_pending' }); return false; }
        if (r.medicalSafetyRelevant === true && g.medicalSafetyReviewStatus !== 'approved') {
          excluded.push({ ruleId: r.ruleId, code: 'medical_safety_review_pending' }); return false;
        }
        if (mode === 'production' && g.scientificReviewStatus !== 'approved') {
          excluded.push({ ruleId: r.ruleId, code: 'scientific_review_pending' }); return false;
        }
        if (g.scientificReviewStatus === 'rejected' || g.medicalSafetyReviewStatus === 'rejected') {
          excluded.push({ ruleId: r.ruleId, code: 'review_rejected' }); return false;
        }
        return true;
      })
      .slice()
      .sort(function (a, b) { return a.ruleId < b.ruleId ? -1 : (a.ruleId > b.ruleId ? 1 : 0); });
    return { rules: rules, blocked: false, errors: [], excluded: excluded, sourceRegistryHash: regHash };
  }
  /* Letzter Fail-closed-Guard des gesamten Selektionspfads: interne
     Programmfehler liefern NIE Regeln, sondern blocked + internal_error. */
  function selectRules(pack, registry, criteria) {
    try { return _selectRulesInner(pack, registry, criteria); }
    catch (e) { return { rules: [], blocked: true, errors: [{ code: 'internal_error', detail: String(e && e.message || e) }], excluded: [] }; }
  }

  var KNOWLEDGE_ARCHITECTURE = {
    version: 3,
    layers: [
      { id: 'source_registry', label: 'Quellenregister (versioniert + gehasht)', owner: 'knowledge-sources.js' },
      { id: 'sport_rule_packs', label: 'Fachliche Sport-Rule-Packs', owner: 'knowledge/<sport>-knowledge-pack.js' },
      { id: 'exercise_library', label: 'Übungsbibliothek', owner: 'DB exercise_library (bestehend)' },
      { id: 'session_templates', label: 'Session-Templates', owner: 'Batch 4+' },
      { id: 'capacity_rules', label: 'Capacity-Regeln', owner: 'Batch 3b.1+ (konsumiert NUR gepinnte validierte Auswahl)' },
      { id: 'safety_rules', label: 'Sicherheitsregeln', owner: 'engine-contracts/decision-engine (tighten_only)' },
      { id: 'scheduler_prescription_rules', label: 'Scheduler-/Prescription-Regeln', owner: 'Batch 4/5' },
      { id: 'user_data', label: 'Nutzerspezifische Mess- und Verlaufsdaten', owner: 'EngineInputSnapshot / kanonische Aktivitäten — NIE mit Wissen vermischt' }
    ],
    principle: 'geprüftes ORVIA-Wissen + kanonische Nutzerdaten → deterministische Engine-Entscheidung',
    llmPolicy: 'LLM darf erklären und formulieren, aber keine verbindlichen Trainings-, Belastungs- oder Sicherheitsregeln erfinden oder überschreiben; kein Live-Wissensbezug aus LLM oder Internet.',
    verificationHonesty: 'Software prüft ausschließlich hinterlegte Verifikationsdatensätze (Qualifikation/Review) — nicht die reale Echtheit von Abschlüssen oder Identitäten.'
  };

  O.knowledgeContracts = _deepFreeze({
    KNOWLEDGE_CONTRACT_VERSION: KNOWLEDGE_CONTRACT_VERSION,
    EVIDENCE_CLASSES: EVIDENCE_CLASSES,
    DECISION_ROLES: DECISION_ROLES,
    CLAIM_USES: CLAIM_USES,
    DIRECTNESS: DIRECTNESS,
    METHOD_QUALITY: METHOD_QUALITY,
    RISK_OF_BIAS: RISK_OF_BIAS,
    CONSISTENCY: CONSISTENCY,
    SOURCE_COMBINATIONS: SOURCE_COMBINATIONS,
    TECHNICAL_STATUSES: TECHNICAL_STATUSES,
    SCIENTIFIC_STATUSES: SCIENTIFIC_STATUSES,
    MEDICAL_STATUSES: MEDICAL_STATUSES,
    MODES: MODES,
    SOURCE_TYPES: SOURCE_TYPES,
    QUALIFICATION_TYPES: QUALIFICATION_TYPES,
    SCIENTIFIC_QUALIFICATIONS: SCIENTIFIC_QUALIFICATIONS,
    MEDICAL_QUALIFICATIONS: MEDICAL_QUALIFICATIONS,
    QUANT_REQUIRED: QUANT_REQUIRED,
    QUANT_SCHEMA_VERSION: QUANT_SCHEMA_VERSION,
    REVIEW_REQUIRED: REVIEW_REQUIRED,
    REVIEW_SCOPES: REVIEW_SCOPES,
    REVIEW_DECISIONS: REVIEW_DECISIONS,
    RULE_REQUIRED: RULE_REQUIRED,
    SOURCE_REQUIRED: SOURCE_REQUIRED,
    CLAIM_REQUIRED: CLAIM_REQUIRED,
    KNOWLEDGE_ARCHITECTURE: KNOWLEDGE_ARCHITECTURE,
    packContentHash: packContentHash,
    ruleEvidenceHash: ruleEvidenceHash,
    registryContentHash: registryContentHash,
    sourceClassRank: sourceClassRank,
    deriveClaimEvidenceClass: deriveClaimEvidenceClass,
    ruleEvidenceCeiling: ruleEvidenceCeiling,
    maxConfidenceFor: maxConfidenceFor,
    quantitativeUseAllowed: quantitativeUseAllowed,
    reviewBindsToRule: reviewBindsToRule,
    validateSource: validateSource,
    validateClaim: validateClaim,
    validateRule: validateRule,
    validateRegistry: validateRegistry,
    validatePack: validatePack,
    selectRules: selectRules
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = O.knowledgeContracts;
})(typeof globalThis !== 'undefined' ? globalThis : this);
