/* ============================================================
   ORVIA · Batch 3b.0 + Korrekturen 3b.0a/3b.0b — Knowledge Base:
   Pflicht-Pinning, versioniertes/gehashtes Register, Review-Bindung an
   Inhalts-Hashes, typisierte Qualifikationen, zentrale Quellen-
   Appraisals, semantische Validierung, 24er-Coverage.
   node supabase/tests/batch3b0_knowledge_test.mjs
   ============================================================ */
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL(_APPREL + 'js/', import.meta.url);
const src = f => readFileSync(new URL(f, base), 'utf8');

const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
sb.console = console; sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Object = Object; sb.Array = Array;
sb.String = String; sb.Number = Number; sb.Intl = Intl; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.RegExp = RegExp; sb.Error = Error;
sb.parseInt = parseInt; sb.parseFloat = parseFloat;
vm.createContext(sb);
['training-domain.js', 'activity-config.js', 'profile-model.js', 'onboarding/onboarding-sports-logic.js',
  'engine/knowledge/knowledge-contracts.js', 'engine/knowledge/knowledge-sources.js',
  'engine/knowledge/running-knowledge-pack.js', 'engine/knowledge/sport-coverage-matrix.js'].forEach(f =>
  vm.runInContext(src(f), sb, { filename: f }));
const KC = sb.ORVIA.knowledgeContracts;
const KS = sb.ORVIA.knowledgeSources;        // versionierter Registervertrag {registryVersion, sources, contentHash, byId}
const RP = sb.ORVIA.runningKnowledgePack;
const CM = sb.ORVIA.sportCoverageMatrix;
const AC = sb.ORVIA.activityConfig;
const TD = sb.ORVIA.trainingDomain;
const PM = sb.ORVIA.profileModel;
const OSL = sb.ORVIA.onboardingSportsLogic;

const clone = o => JSON.parse(JSON.stringify(o));
const codes = res => (res.errors || []).map(e => e.code);
/* Vollständige Pins wie ein echter Consumer (Testabbild der 3b.1-Konstanten).
   Jeder Selector-Test nutzt PINS — außer den expliziten Pin-Negativtests. */
const PINS = Object.freeze({
  mode: 'shadow',
  expectedKnowledgeContractVersion: 6,
  expectedKnowledgeVersion: 'kb-run-v3.0.0',
  expectedPackContentHash: KC.packContentHash(RP),
  expectedSourceRegistryVersion: 2,
  expectedSourceRegistryHash: KC.registryContentHash(KS)
});
const pinsFor = (pack, registry, over) => Object.assign({
  mode: 'shadow',
  expectedKnowledgeContractVersion: 6,
  expectedKnowledgeVersion: pack.knowledgeVersion,
  expectedPackContentHash: KC.packContentHash(pack),
  expectedSourceRegistryVersion: registry.registryVersion,
  expectedSourceRegistryHash: KC.registryContentHash(registry)
}, over || {});
const reHash = reg => { reg.contentHash = KC.registryContentHash(reg); return reg; };
/* Gültiger Review-Datensatz (Fixture) mit typisierter Qualifikation + Verifikation. */
const review = (rule, over) => Object.assign({
  reviewer: 'Dr. Erika Beispiel', role: 'externe Reviewerin',
  qualificationType: 'sports_science_academic',
  qualificationVerification: { verified: true, verifiedBy: 'ORVIA-Verifikationsdatensatz VD-1', verifiedAt: '2026-07-19' },
  scope: 'scientific', date: '2026-07-19', decision: 'approved', conflictsOfInterest: 'keine',
  reviewedVersion: rule.version,
  reviewedRuleEvidenceHash: KC.ruleEvidenceHash(rule),
  reviewedSourceRegistryHash: KC.registryContentHash(KS)
}, over || {});

/* ---------- G: Grundvalidität ---------- */
{
  const v = KC.validatePack(RP, KS);
  ok('G1 Pack v3 + Register v2 strukturell/semantisch vertragskonform', v.valid, codes(v).slice(0, 6).join(','));
  ok('G1b Registervertrag versioniert + gehasht: registryVersion 2, 17 Quellen (15 externe + 2 interne), declared Hash == computed',
    KS.registryVersion === 2 && KS.sources.length === 17 && new Set(KS.sources.map(s => s.sourceId)).size === 17 &&
    KS.sources.filter(s => s.sourceType === 'orvia_internal_contract').length === 2 &&
    KS.contentHash === KC.registryContentHash(KS) && /^fnv1a-[0-9a-f]{8}$/.test(KS.contentHash));
  ok('G1c Pack v3 / kb-run-v3.0.0 + deklarierter Hash; jede Quelle trägt zentrales Appraisal + Outcomes',
    RP.version === 3 && RP.knowledgeVersion === 'kb-run-v3.0.0' && KC.packContentHash(RP) === RP.contentHash &&
    KS.sources.every(s => s.appraisal && s.appraisal.studyDesign && s.appraisal.riskOfBias === 'not_formally_assessed' && Array.isArray(s.outcomes) && s.outcomes.length > 0));
}

/* ---------- S0: PFLICHT-PINNING (explizite Negativtests) ---------- */
{
  const expectCode = { expectedKnowledgeContractVersion: 'missing_pin_knowledge_contract_version', expectedKnowledgeVersion: 'missing_pin_knowledge_version', expectedPackContentHash: 'missing_pin_pack_content_hash', expectedSourceRegistryVersion: 'missing_pin_source_registry_version', expectedSourceRegistryHash: 'missing_pin_source_registry_hash' };
  const all = Object.keys(expectCode).every(k => {
    const p = Object.assign({}, PINS); delete p[k];
    const r = KC.selectRules(RP, KS, p);
    return r.blocked === true && r.rules.length === 0 && codes(r).indexOf(expectCode[k]) >= 0;
  });
  ok('S0 Auswahl ohne JEDEN einzelnen der 5 Pins wird blockiert (je eigener stabiler Fehlercode)', all);
  ok('S0c falscher Contract-Version-Pin blockiert (Semantik des ausführenden Vertrags ist gepinnt)',
    (() => { const r = KC.selectRules(RP, KS, Object.assign({}, PINS, { expectedKnowledgeContractVersion: 5 }));
      return r.blocked === true && codes(r).indexOf('knowledge_contract_version_mismatch') >= 0; })() &&
    KC.KNOWLEDGE_CONTRACT_VERSION === 6);
  const noMode = Object.assign({}, PINS); delete noMode.mode;
  ok('S0b fehlender Modus blockiert (missing_or_unknown_mode); leerer Pin ebenfalls',
    KC.selectRules(RP, KS, noMode).blocked && codes(KC.selectRules(RP, KS, noMode)).indexOf('missing_or_unknown_mode') >= 0 &&
    codes(KC.selectRules(RP, KS, Object.assign({}, PINS, { expectedPackContentHash: '' }))).indexOf('missing_pin_pack_content_hash') >= 0);
}

/* ---------- S: fail-closed Auswahl (immer mit vollständigen Pins) ---------- */
{
  // S1 approved-Regel mit erfundener Quellen-ID ⇒ blockiert.
  const bad = clone(RP);
  bad.rules[0].claims[0].sourceRefs = ['SRC-FREI-ERFUNDEN'];
  bad.rules[0].governance.scientificReviewStatus = 'approved';
  bad.rules[0].governance.reviews = [review(bad.rules[0])];
  bad.contentHash = KC.packContentHash(bad);
  const r1 = KC.selectRules(bad, KS, pinsFor(bad, KS, { mode: 'production' }));
  ok('S1 approved mit unbekannter Quellen-ID ⇒ rules:[], blocked:true', r1.blocked === true && r1.rules.length === 0 && codes(r1).indexOf('claim_unknown_source_ref') >= 0);
  // S2 gleiche Version, veränderter Inhalt ⇒ declared-Hash-Mismatch blockiert.
  const tampered = clone(RP); tampered.rules[0].statement = 'MANIPULIERT';
  const r2 = KC.selectRules(tampered, KS, PINS);
  ok('S2 gleiche Version + veränderter Inhalt ⇒ content_hash_mismatch_declared + pinned, blockiert',
    r2.blocked === true && codes(r2).indexOf('content_hash_mismatch_declared') >= 0 && codes(r2).indexOf('content_hash_mismatch_pinned') >= 0);
  // S3 veränderte Source-SUMMARY bei unverändertem Pack ⇒ blockiert (Pinned-Registry-Hash).
  const regMod = reHash(clone(KS)); regMod.sources[0].summary = 'VERÄNDERTE ZUSAMMENFASSUNG';
  regMod.contentHash = KC.registryContentHash(regMod);   // Angreifer aktualisiert sogar den declared Hash
  const r3 = KC.selectRules(RP, regMod, PINS);
  ok('S3 veränderte Source-Summary ⇒ source_registry_hash_mismatch_pinned (Consumer-Pin schützt)',
    r3.blocked === true && codes(r3).indexOf('source_registry_hash_mismatch_pinned') >= 0);
  // S3b veränderter Source-Type/Appraisal ⇒ ebenfalls blockiert; ohne declared-Update zusätzlich declared-Mismatch.
  const regMod2 = clone(KS); regMod2.sources[1].appraisal = { studyDesign: 'rct', methodQuality: 'high', riskOfBias: 'low' };
  const r3b = KC.selectRules(RP, regMod2, PINS);
  ok('S3b verändertes Source-Appraisal ⇒ registry_hash_mismatch_declared + pinned, blockiert',
    r3b.blocked === true && codes(r3b).indexOf('registry_hash_mismatch_declared') >= 0 && codes(r3b).indexOf('source_registry_hash_mismatch_pinned') >= 0);
  // S4 falsche gepinnte Version(en).
  ok('S4 Versions-Pins wirken (Pack + Register)',
    codes(KC.selectRules(RP, KS, Object.assign({}, PINS, { expectedKnowledgeVersion: 'kb-run-v2.0.0' }))).indexOf('knowledge_version_mismatch') >= 0 &&
    codes(KC.selectRules(RP, KS, Object.assign({}, PINS, { expectedSourceRegistryVersion: 1 }))).indexOf('source_registry_version_mismatch') >= 0);
  // S5 loses Array statt Registervertrag ⇒ blockiert.
  const r5 = KC.selectRules(RP, KS.sources, PINS);
  ok('S5 unversioniertes Register (loses Array) ⇒ registry_not_versioned, blockiert', r5.blocked && codes(r5).indexOf('registry_not_versioned') >= 0);
  // S6 production: alle 14 Regeln wissenschaftlich ungeprüft ⇒ 0 Regeln, explizit excluded.
  const rp = KC.selectRules(RP, KS, Object.assign({}, PINS, { mode: 'production', sport: 'running' }));
  ok('S6 production: 0 Regeln; 14 explizit excluded', rp.blocked === false && rp.rules.length === 0 && rp.excluded.length === 14);
  // S7 shadow: 12 Regeln; medizinische gesperrt.
  const rs = KC.selectRules(RP, KS, Object.assign({}, PINS, { sport: 'running' }));
  ok('S7 shadow: 12 Regeln sortiert; RUN-SAFE-001 + RUN-RTR-001 medizinisch gesperrt',
    rs.blocked === false && rs.rules.length === 12 &&
    rs.excluded.filter(x => x.code === 'medical_safety_review_pending').map(x => x.ruleId).sort().join(',') === 'RUN-RTR-001,RUN-SAFE-001');
  ok('S8 Determinismus bei identischen Pins', JSON.stringify(rs) === JSON.stringify(KC.selectRules(RP, KS, Object.assign({}, PINS, { sport: 'running' }))));
}

/* ---------- E: zentrale Appraisal-Autorität + KONSERVATIVE Ableitung ---------- */
{
  const byId = KS.byId;
  const evB = { claimId: 'T-B', statement: 'x', sourceRefs: ['SRC-BUIST-2008'], decisionRole: 'evidence', population: 'p', applicability: 'a', outcome: 'o', directness: 'direct', use: 'qualitative', uncertainties: ['u'], essential: true, supportBasis: 's', synthesis: { consistency: 'consistent' } };
  const evA = Object.assign({}, evB, { claimId: 'T-A', sourceRefs: ['SRC-IOC-LOAD-2016'] });
  const podD = { claimId: 'T-D', statement: 'x', sourceRefs: ['SRC-ORVIA-BATCH2-CONTRACT'], decisionRole: 'product_policy', population: 'p', applicability: 'a', outcome: 'o', directness: 'direct', use: 'qualitative', uncertainties: ['u'], essential: true };
  /* Fixture-Register mit FORMAL POSITIV bewerteter Konsensquelle (nur so ist A erreichbar). */
  const srcHigh = Object.assign(clone(KS.byId['SRC-IOC-LOAD-2016']), { sourceId: 'SRC-FIX-HIGH', appraisal: { studyDesign: 'consensus_statement', methodQuality: 'high', riskOfBias: 'low' } });
  const byIdHigh = Object.assign({}, byId, { 'SRC-FIX-HIGH': srcHigh });
  const evHigh = Object.assign({}, evA, { claimId: 'T-H', sourceRefs: ['SRC-FIX-HIGH'] });
  ok('E1 interne D-Quelle kann NIE A/B erscheinen; product_policy bleibt D trotz Studienzitat',
    KC.deriveClaimEvidenceClass(Object.assign({}, evA, { sourceRefs: ['SRC-ORVIA-BATCH2-CONTRACT'] }), byId) === 'D' &&
    KC.deriveClaimEvidenceClass(Object.assign({}, podD, { sourceRefs: ['SRC-IOC-LOAD-2016'] }), byId) === 'D');
  ok('E1b KONSERVATIV (3b.0c): Konsensquelle mit methodQuality moderate + riskOfBias not_formally_assessed ergibt NICHT A und NICHT high — der Quellentyp liefert nur den möglichen Ceiling',
    KC.deriveClaimEvidenceClass(evA, byId) === 'B' && KC.maxConfidenceFor({ claims: [evA] }, byId) === 'medium' &&
    KC.deriveClaimEvidenceClass(evHigh, byIdHigh) === 'A' && KC.maxConfidenceFor({ claims: [evHigh] }, byIdHigh) === 'high');
  ok('E1c derzeit kann KEINE Registerquelle als A-Evidenz erscheinen (alle not_formally_assessed) und keine Regel high erreichen',
    KS.sources.every(s => KC.sourceClassRank(s) <= 3) &&
    RP.rules.every(r => KC.maxConfidenceFor(r, byId) !== 'high'));
  ok('E2 deklarierte Evidenzklasse UND claimseitige Appraisal-Felder sind verboten',
    KC.validateClaim(Object.assign({}, evA, { evidenceClass: 'A' }), 'T', byId).some(e => e.code === 'claim_declares_evidence_class_forbidden') &&
    KC.validateClaim(Object.assign({}, evA, { appraisal: { methodQuality: 'high' } }), 'T', byId).some(e => e.code === 'claim_appraisal_fields_forbidden') &&
    KC.validateClaim(Object.assign({}, evA, { synthesis: { consistency: 'consistent', methodQuality: 'high' } }), 'T', byId).some(e => e.code === 'claim_appraisal_fields_forbidden'));
  ok('E2b Claim-Manipulation kann die Klasse nicht hochstufen (Ableitung liest NUR das Register)',
    KC.deriveClaimEvidenceClass(Object.assign({}, evB, { appraisal: { methodQuality: 'high', riskOfBias: 'low' } }), byId) ===
    KC.deriveClaimEvidenceClass(evB, byId));
  ok('E3 Ceiling = schwächste ESSENZIELLE Behauptung: essenzielles B + D ⇒ D ⇒ nie high; optionale bessere Quelle überstimmt nicht',
    KC.ruleEvidenceCeiling({ claims: [evB, podD] }, byId) === 'D' && KC.maxConfidenceFor({ claims: [evB, podD] }, byId) === 'medium' &&
    KC.maxConfidenceFor({ claims: [Object.assign({}, evHigh, { essential: false }), podD] }, byIdHigh) === 'medium');
  ok('E4 Abstufungen: directness indirect / synthesis mixed / Register-Qualität low senken die Klasse',
    KC.deriveClaimEvidenceClass(Object.assign({}, evHigh, { directness: 'indirect' }), byIdHigh) === 'B' &&
    KC.deriveClaimEvidenceClass(Object.assign({}, evB, { synthesis: { consistency: 'mixed' } }), byId) === 'C' &&
    (function () { const reg = clone(KS); reg.sources.filter(s => s.sourceId === 'SRC-BUIST-2008')[0].appraisal.methodQuality = 'low';
      return KC.deriveClaimEvidenceClass(evB, (function(){var m={};reg.sources.forEach(s=>m[s.sourceId]=s);return m;})()) === 'C'; })());
  // E5 Mehrquellen-Kombination ist PFLICHT; all_required nutzt die schwächste notwendige Basis.
  const multi = Object.assign({}, evA, { claimId: 'T-M', sourceRefs: ['SRC-FIX-HIGH', 'SRC-BERTELSEN-2017'] });
  ok('E5 mehrere notwendige Quellen ⇒ schwächste notwendige Basis; each_sufficient ⇒ beste; OHNE Angabe ⇒ D + Validierungsfehler (nie Auto-Best)',
    KC.deriveClaimEvidenceClass(Object.assign({}, multi, { sourceCombination: 'all_required' }), byIdHigh) === 'B' &&
    KC.deriveClaimEvidenceClass(Object.assign({}, multi, { sourceCombination: 'each_sufficient' }), byIdHigh) === 'A' &&
    KC.deriveClaimEvidenceClass(multi, byIdHigh) === 'D' &&
    KC.validateClaim(multi, 'T', byIdHigh).some(e => e.code === 'claim_missing_source_combination'));
  // E6 Quantitativ-Gate (v5): versioniertes, streng typisiertes Schema.
  //     TRUE nur mit formal bewerteter Quelle (byIdHigh) + vollständigem, korrekt
  //     typisiertem Paket (schemaVersion, typed validRange, independentValidation===true).
  const quantObj = { schemaVersion: KC.QUANT_SCHEMA_VERSION, inputUnits: 'bpm', outputUnits: 'bpm', validRange: { min: 30, max: 220 }, population: 'healthy_adults', exclusions: ['cardiac_patients'], sourceQuantitativeStatement: 'x', allowedTransformation: 'linear', uncertaintyRange: 'sd', independentValidation: true, safetyBounds: 'nie über gemessener HFmax' };
  const quantFull = Object.assign({}, evHigh, { use: 'quantitative', quantitative: quantObj });
  ok('E6 quantitative Nutzung nie allein aus A/B; vollständiges getyptes Paket + formal bewertete Quelle nötig; D nie quantitativ',
    KC.quantitativeUseAllowed(Object.assign({}, evHigh, { use: 'quantitative' }), byIdHigh) === false &&
    KC.quantitativeUseAllowed(quantFull, byIdHigh) === true &&
    KC.quantitativeUseAllowed(Object.assign({}, podD, { use: 'quantitative', quantitative: quantObj }), byIdHigh) === false &&
    RP.rules.every(r => r.claims.every(c => c.use !== 'quantitative')));
  ok('E6b unbewertete Registerquelle (not_formally_assessed) autorisiert KEINE quantitative Nutzung, selbst mit vollständigem Paket',
    KC.quantitativeUseAllowed(Object.assign({}, evA, { use: 'quantitative', quantitative: quantObj }), byId) === false);
}

/* ---------- R: Review-Governance mit Hash-Bindung + Qualifikation ---------- */
{
  const regHash = KC.registryContentHash(KS);
  const mk = () => clone(RP.rules[0]);
  // R1 approved ohne gebundenen Review.
  const g1 = mk(); g1.governance.scientificReviewStatus = 'approved'; g1.governance.reviews = [];
  ok('R1 approved ohne Review-Datensatz ⇒ rule_approved_without_bound_review',
    KC.validateRule(g1, KS.byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_approved_without_bound_review'));
  // R2 Freitext-Qualifikation "x" wird abgelehnt (typisiert statt Freitext).
  const g2 = mk(); g2.governance.scientificReviewStatus = 'approved';
  g2.governance.reviews = [review(g2, { qualificationType: 'x' })];
  ok('R2 Reviewer mit Freitext-Qualifikation "x" wird abgelehnt (untypisiert ⇒ Review strukturell ungültig, v4)',
    KC.validateRule(g2, KS.byId, { sourceRegistryHash: regHash }).errors.some(e =>
      e.code === 'rule_approved_without_bound_review' || e.code === 'rule_approved_without_valid_qualification'));
  // R2b Produkt-Owner-/Entwicklerrollen erzeugen KEINE wissenschaftliche/medizinische Freigabe.
  const g2b = mk(); g2b.governance.scientificReviewStatus = 'approved';
  g2b.governance.reviews = [review(g2b, { qualificationType: 'product_owner' })];
  ok('R2b product_owner-Qualifikation erzeugt keine wissenschaftliche Freigabe',
    KC.validateRule(g2b, KS.byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_approved_without_valid_qualification'));
  // R2c fehlender Verifikationsdatensatz ⇒ Review strukturell unvollständig.
  const g2c = mk(); g2c.governance.scientificReviewStatus = 'approved';
  g2c.governance.reviews = [review(g2c, { qualificationVerification: { verified: false, verifiedBy: 'x', verifiedAt: '2026-07-19' } })];
  ok('R2c Qualifikation ohne verifizierten Verifikationsdatensatz wird abgelehnt',
    KC.validateRule(g2c, KS.byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_approved_without_bound_review'));
  // R3 gültiger, gebundener, qualifizierter Review besteht.
  const g3 = mk(); g3.governance.scientificReviewStatus = 'approved'; g3.governance.reviews = [review(g3)];
  ok('R3 vollständiger, hash-gebundener, qualifizierter Review besteht', KC.validateRule(g3, KS.byId, { sourceRegistryHash: regHash }).valid);
  // R4 falscher Regelinhalt-Hash ⇒ abgelehnt.
  const g4 = mk(); g4.governance.scientificReviewStatus = 'approved';
  g4.governance.reviews = [review(g4, { reviewedRuleEvidenceHash: 'fnv1a-deadbeef' })];
  ok('R4 Review mit falschem ruleEvidenceHash wird abgelehnt',
    KC.validateRule(g4, KS.byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_approved_without_bound_review'));
  // R5 falscher Quellenregister-Hash ⇒ abgelehnt.
  const g5 = mk(); g5.governance.scientificReviewStatus = 'approved';
  g5.governance.reviews = [review(g5, { reviewedSourceRegistryHash: 'fnv1a-deadbeef' })];
  ok('R5 Review mit falschem Quellenregister-Hash wird abgelehnt',
    KC.validateRule(g5, KS.byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_approved_without_bound_review'));
  // R6 Inhaltsänderung NACH Review invalidiert die Freigabe automatisch (Hash-Bindung).
  const g6 = mk(); g6.governance.scientificReviewStatus = 'approved'; g6.governance.reviews = [review(g6)];
  const validBefore = KC.validateRule(g6, KS.byId, { sourceRegistryHash: regHash }).valid;
  g6.statement = g6.statement + ' — NACHTRÄGLICH GEÄNDERT';
  ok('R6 fachliche Änderung nach Review macht die Freigabe ungültig (Governance bleibt, Hash bindet)',
    validBefore === true && KC.validateRule(g6, KS.byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_approved_without_bound_review'));
  // R6b ruleEvidenceHash ignoriert Governance (kein Zirkularitätsproblem).
  const g7a = mk(), g7b = mk(); g7b.governance.reviews = [review(g7b)];
  ok('R6b ruleEvidenceHash unabhängig von Governance/Reviews (reproduzierbar, zirkularitätsfrei)',
    KC.ruleEvidenceHash(g7a) === KC.ruleEvidenceHash(g7b));
  // R7 medizinische Freigabe braucht medizinische Fachqualifikation.
  const g8 = mk(); g8.medicalSafetyRelevant = true; g8.governance.medicalSafetyReviewStatus = 'approved';
  g8.governance.reviews = [review(g8, { scope: 'medical_safety', qualificationType: 'sports_science_academic' })];
  const g8ok = mk(); g8ok.medicalSafetyRelevant = true; g8ok.governance.medicalSafetyReviewStatus = 'approved';
  g8ok.governance.reviews = [review(g8ok, { scope: 'medical_safety', qualificationType: 'licensed_physiotherapist' })];
  ok('R7 medizinische Freigabe nur mit zulässiger Fachqualifikation (Physio/Arzt), nicht mit Sportwissenschaft allein',
    KC.validateRule(g8, KS.byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_approved_without_valid_qualification') &&
    KC.validateRule(g8ok, KS.byId, { sourceRegistryHash: regHash }).valid);
  // R8 Ist-Zustand + medizinische Sperre in beiden Modi trotz wissenschaftlicher Freigabe.
  ok('R8 alle 14 Regeln technisch reviewed + wissenschaftlich unreviewed + reviews leer; medizinisch prüfpflichtig genau SAFE/RTR',
    RP.rules.length === 14 && RP.rules.every(r => r.governance.technicalStatus === 'reviewed' && r.governance.scientificReviewStatus === 'unreviewed' && r.governance.reviews.length === 0) &&
    RP.rules.filter(r => r.medicalSafetyRelevant).map(r => r.ruleId).sort().join(',') === 'RUN-RTR-001,RUN-SAFE-001');
  const packMed = clone(RP);
  packMed.rules.forEach(r => { if (r.ruleId === 'RUN-SAFE-001') { r.governance.scientificReviewStatus = 'approved'; r.governance.reviews = [review(r, { reviewedRuleEvidenceHash: KC.ruleEvidenceHash(r) })]; } });
  packMed.contentHash = KC.packContentHash(packMed);
  const rmShadow = KC.selectRules(packMed, KS, pinsFor(packMed, KS));
  ok('R8b medizinische Regel ohne Medical-Safety-Review bleibt auch mit wissenschaftlicher Freigabe gesperrt (production+shadow)',
    rmShadow.blocked === false && rmShadow.rules.every(r => r.ruleId !== 'RUN-SAFE-001') &&
    rmShadow.excluded.some(x => x.ruleId === 'RUN-SAFE-001' && x.code === 'medical_safety_review_pending'));
}

/* ---------- V: semantische Validierung ---------- */
{
  const regHash = KC.registryContentHash(KS);
  const mk = () => clone(RP.rules[0]);
  const r1 = mk(); r1.inputs = [];
  const r2 = mk(); r2.outputs = [''];
  ok('V1 leere Inputs/Outputs (bzw. leere Pfad-Strings) werden abgelehnt',
    KC.validateRule(r1, KS.byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_empty_inputs') &&
    KC.validateRule(r2, KS.byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_empty_outputs'));
  const s1 = clone(KS.sources[0]); s1.populations = [];
  const s2 = clone(KS.sources[0]); s2.sports = [];
  ok('V2 leere Source-Populationen/-Sportarten werden abgelehnt',
    KC.validateSource(s1).errors.some(e => e.code === 'source_empty_populations') &&
    KC.validateSource(s2).errors.some(e => e.code === 'source_empty_sports'));
  const s3 = clone(KS.sources[0]); s3.year = 1600;
  const s4 = clone(KS.sources[0]); s4.lastCheckedAt = '2026-13-99';
  const s5 = clone(KS.sources[0]); s5.identifier = { doi: 'kein-doi' };
  const s6 = clone(KS.sources[0]); delete s6.appraisal;
  ok('V3 unplausibles Jahr / ungültiges ISO-Datum / typwidriger Identifikator / fehlendes Zentral-Appraisal werden abgelehnt',
    KC.validateSource(s3).errors.some(e => e.code === 'source_invalid_year') &&
    KC.validateSource(s4).errors.some(e => e.code === 'source_invalid_checked_date') &&
    KC.validateSource(s5).errors.some(e => e.code === 'source_invalid_identifier') &&
    KC.validateSource(s6).errors.some(e => e.code === 'source_missing_central_appraisal'));
  const r3 = mk(); r3.applicability = { populations: [] };
  ok('V4 semantisch leere Applicability wird abgelehnt; bewusst leere Ausschlusslisten bleiben zulässig',
    KC.validateRule(r3, KS.byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_empty_applicability') &&
    KC.validateRule(mk(), KS.byId, { sourceRegistryHash: regHash }).valid && Array.isArray(mk().excludedPopulations));
  const r4 = clone(RP.rules.filter(r => r.ruleId === 'RUN-SAFE-001')[0]); r4.safetyLimits = [];
  ok('V5 medizinisch relevante Regel ohne Safety-Limits wird abgelehnt',
    KC.validateRule(r4, KS.byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_medical_without_safety_limits'));
  const dupRule = clone(RP); dupRule.rules = dupRule.rules.concat([clone(dupRule.rules[0])]); dupRule.contentHash = KC.packContentHash(dupRule);
  const dupReg = reHash(clone(KS)); dupReg.sources = dupReg.sources.concat([clone(dupReg.sources[0])]); dupReg.contentHash = KC.registryContentHash(dupReg);
  ok('V6 doppelte Rule- und Source-IDs werden abgelehnt',
    KC.validatePack(dupRule, KS).errors.some(e => e.code === 'rule_duplicate_id') &&
    KC.validateRegistry(dupReg).errors.some(e => e.code === 'source_duplicate_id'));
  ok('V7 Zielzeit als Regel-Input bleibt verboten; Evidenz ohne supportBasis/Synthese wird abgelehnt',
    KC.validateRule(Object.assign(mk(), { inputs: ['goal.targetValue'] }), KS.byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_uses_goal_target_as_input') &&
    (function () { const r = mk(); delete r.claims[0].supportBasis; return KC.validateRule(r, KS.byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'claim_missing_support_basis'); })() &&
    (function () { const r = mk(); delete r.claims[0].synthesis; return KC.validateRule(r, KS.byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'claim_missing_synthesis_consistency'); })());
}

/* ---------- F (3b.0c): totale, ausnahmesichere Validatoren + Fuzz ---------- */
{
  // F1 Pflicht-Gegenproben: Objekt statt Array wirft NICHT, sondern blockiert.
  const p1 = clone(RP); p1.rules = {}; p1.contentHash = KC.packContentHash(p1);
  let r1 = null, threw1 = false;
  try { r1 = KC.selectRules(p1, KS, pinsFor(p1, KS)); } catch (e) { threw1 = true; }
  ok('F1 pack.rules = {} ⇒ blocked mit stabilem Code (pack_rules_not_array), KEINE Exception',
    !threw1 && r1.blocked === true && r1.rules.length === 0 && codes(r1).indexOf('pack_rules_not_array') >= 0);
  const reg1 = clone(KS); reg1.sources = {}; reg1.contentHash = null;
  let r2 = null, threw2 = false;
  try { r2 = KC.selectRules(RP, reg1, PINS); } catch (e) { threw2 = true; }
  ok('F2 registry.sources = {} ⇒ blocked mit stabilem Code (registry_sources_not_array), KEINE Exception',
    !threw2 && r2.blocked === true && codes(r2).indexOf('registry_sources_not_array') >= 0);
  // F3 Fuzz: keine öffentliche Validierungs-/Selektionsfunktion wirft bei JSON-artigen Fixtures.
  const fuzz = [null, undefined, 42, 'x', true, [], {}, [[]], { a: [{}] }, { rules: 7 }, { sources: 'x' }, { claims: {} }, { governance: [] }];
  let throws = 0;
  fuzz.forEach(fx => {
    try { KC.validateRegistry(fx); } catch (e) { throws++; }
    try { KC.validatePack(fx, fx); } catch (e) { throws++; }
    try { KC.validateRule(fx, fx, fx); } catch (e) { throws++; }
    try { KC.validateClaim(fx, 'T', fx); } catch (e) { throws++; }
    try { KC.validateSource(fx); } catch (e) { throws++; }
    try { KC.selectRules(fx, fx, fx); } catch (e) { throws++; }
    try { KC.selectRules(RP, KS, fx); } catch (e) { throws++; }
    try { KC.deriveClaimEvidenceClass(fx, fx); } catch (e) { throws++; }
    try { KC.ruleEvidenceCeiling(fx, fx); } catch (e) { throws++; }
    try { KC.maxConfidenceFor(fx, fx); } catch (e) { throws++; }
  });
  ok('F3 Fuzz über alle öffentlichen Grenzen (null/Arrays/Objekte/Primitive): 0 ungefangene Exceptions', throws === 0, 'throws=' + throws);
  ok('F3b Fuzz-Selektionen liefern NIE Regeln (fail-closed Guard)',
    fuzz.every(fx => { try { const r = KC.selectRules(fx, fx, fx); return r && r.blocked === true && r.rules.length === 0; } catch (e) { return false; } }));
  // F4 malformed Claim-Felder werden abgelehnt (exakte Gegenprobe aus dem Audit).
  const badClaim = Object.assign(clone(RP.rules[0].claims[0]), { statement: [], population: {}, applicability: [], outcome: {} });
  const cErrs = KC.validateClaim(badClaim, 'T', KS.byId);
  ok('F4 Claim mit statement:[] / population:{} / applicability:[] / outcome:{} ist UNGÜLTIG (claim_invalid_field_type je Feld)',
    ['statement', 'population', 'applicability', 'outcome'].every(f => cErrs.some(e => e.code === 'claim_invalid_field_type' && e.detail.indexOf(':' + f) >= 0)));
  ok('F4b Produktregel mit sourceRefs:"not-an-array" ist UNGÜLTIG',
    KC.validateClaim(Object.assign(clone(RP.rules[0].claims[2] || RP.rules[0].claims[0]), { decisionRole: 'product_policy', sourceRefs: 'not-an-array' }), 'T', KS.byId)
      .some(e => e.code === 'claim_invalid_source_refs'));
  // F5 malformed Review-Felder erzeugen keine Freigabe.
  const regHash = KC.registryContentHash(KS);
  const rr = clone(RP.rules[0]); rr.governance.scientificReviewStatus = 'approved';
  rr.governance.reviews = [review(rr, { reviewer: { name: 'Objekt' }, role: ['Array'], date: 'not-a-date' })];
  ok('F5 Review mit Objekt statt Name, Array statt Rolle und ungültigem Datum verhindert die Freigabe',
    KC.validateRule(rr, KS.byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_approved_without_bound_review'));
  const rr2 = clone(RP.rules[0]); rr2.governance.scientificReviewStatus = 'approved';
  rr2.governance.reviews = [review(rr2, { date: '2026-02-30' })];
  ok('F5b ungültiges Kalender-Reviewdatum (2026-02-30) verhindert die Freigabe',
    KC.validateRule(rr2, KS.byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_approved_without_bound_review'));
  const rr3 = clone(RP.rules[0]); rr3.governance.reviews = {};
  ok('F5c governance.reviews als Objekt statt Array ⇒ strukturierter Fehler, keine Exception',
    KC.validateRule(rr3, KS.byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_reviews_not_array'));
}

/* ---------- T (3b.0d): strikte Typen, Boolean-Pflicht, Quant-Schema, fail-closed Kurzform ---------- */
{
  const regHash = KC.registryContentHash(KS);
  const mkRule = () => clone(RP.rules[0]);
  const byId = KS.byId;
  // T1 medicalSafetyRelevant MUSS strikt Boolean sein.
  const badVals = ['true', 'false', 1, 0, {}, [], null];
  ok('T1 medicalSafetyRelevant "true"/1/0/{}/[]/null ⇒ rule_invalid_medical_safety_relevant (validateRule)',
    badVals.every(v => { const r = mkRule(); r.medicalSafetyRelevant = v; return KC.validateRule(r, byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_invalid_medical_safety_relevant'); }));
  // T1b: auch mit passend NEU berechneten Hashes + Pins blockiert selectRules (kein Bypass der Reviewpflicht).
  const pMed = clone(RP);
  pMed.rules[0].medicalSafetyRelevant = 'true';
  pMed.contentHash = KC.packContentHash(pMed);
  const rMed = KC.selectRules(pMed, KS, pinsFor(pMed, KS));
  ok('T1b medicalSafetyRelevant:"true" blockiert selectRules trotz passend neu berechneter Hashes/Pins (kein Reviewpflicht-Bypass)',
    rMed.blocked === true && rMed.rules.length === 0 && codes(rMed).indexOf('rule_invalid_medical_safety_relevant') >= 0);
  // T2 malformte Source mit sourceId:[], title:{}, authorsOrOrg:[] ist ungültig; identifier/appraisal Nicht-Array-Objekt.
  const s = clone(KS.sources[0]); s.sourceId = []; s.title = {}; s.authorsOrOrg = [];
  const sErrs = KC.validateSource(s);
  ok('T2 Source mit sourceId:[] / title:{} / authorsOrOrg:[] ⇒ source_invalid_field_type je Feld',
    ['sourceId', 'title', 'authorsOrOrg'].every(f => sErrs.errors.some(e => e.code === 'source_invalid_field_type' && e.detail.indexOf(':' + f) >= 0)));
  const s2 = clone(KS.sources[0]); s2.identifier = ['x']; const s3 = clone(KS.sources[0]); s3.appraisal = ['x'];
  ok('T2b identifier bzw. appraisal als Array ⇒ abgelehnt (Nicht-Array-Objekt erforderlich)',
    KC.validateSource(s2).errors.some(e => e.code === 'source_missing_identifier') &&
    KC.validateSource(s3).errors.some(e => e.code === 'source_missing_central_appraisal'));
  // T3 vollständig truthy, aber TYPWIDRIGES Quantitativobjekt wird abgelehnt.
  const srcHigh = Object.assign(clone(KS.byId['SRC-IOC-LOAD-2016']), { sourceId: 'SRC-FIX-HIGH', appraisal: { studyDesign: 'consensus_statement', methodQuality: 'high', riskOfBias: 'low' } });
  const byIdHigh = Object.assign({}, byId, { 'SRC-FIX-HIGH': srcHigh });
  const evH = { claimId: 'T-QH', statement: 'x', sourceRefs: ['SRC-FIX-HIGH'], decisionRole: 'evidence', population: 'p', applicability: 'a', outcome: 'o', directness: 'direct', use: 'quantitative', uncertainties: ['u'], essential: true, supportBasis: 's', synthesis: { consistency: 'consistent' } };
  const goodQ = { schemaVersion: KC.QUANT_SCHEMA_VERSION, inputUnits: 'bpm', outputUnits: 'bpm', validRange: { min: 30, max: 220 }, population: 'a', exclusions: ['x'], sourceQuantitativeStatement: 'x', allowedTransformation: 'linear', uncertaintyRange: 'sd', independentValidation: true, safetyBounds: 'bound' };
  const allTruthyBadType = { schemaVersion: 1, inputUnits: ['bpm'], outputUnits: { u: 'bpm' }, validRange: '30-220', population: 'a', exclusions: 'not-array', sourceQuantitativeStatement: 'x', allowedTransformation: 'linear', uncertaintyRange: 'sd', independentValidation: 'ja', safetyBounds: 'bound' };
  ok('T3 vollständig truthy, aber typwidriges Quantitativobjekt (Array-Einheiten, String-validRange, String-exclusions) ⇒ abgelehnt',
    KC.quantitativeUseAllowed(Object.assign({}, evH, { quantitative: allTruthyBadType }), byIdHigh) === false &&
    KC.quantitativeUseAllowed(Object.assign({}, evH, { quantitative: goodQ }), byIdHigh) === true);
  // T4 independentValidation muss EXAKT Boolean true sein.
  ok('T4 independentValidation "ja"/1/{}/truthy ⇒ abgelehnt; nur Boolean true autorisiert',
    ['ja', 1, {}, 'true', [true]].every(v => KC.quantitativeUseAllowed(Object.assign({}, evH, { quantitative: Object.assign({}, goodQ, { independentValidation: v }) }), byIdHigh) === false) &&
    KC.quantitativeUseAllowed(Object.assign({}, evH, { quantitative: Object.assign({}, goodQ, { independentValidation: true }) }), byIdHigh) === true);
  // T4b fehlende schemaVersion / falsche Version ⇒ abgelehnt (versioniert).
  ok('T4b Quant-Schema versioniert: fehlende/falsche schemaVersion ⇒ abgelehnt',
    KC.quantitativeUseAllowed(Object.assign({}, evH, { quantitative: Object.assign({}, goodQ, { schemaVersion: undefined }) }), byIdHigh) === false &&
    KC.quantitativeUseAllowed(Object.assign({}, evH, { quantitative: Object.assign({}, goodQ, { schemaVersion: 99 }) }), byIdHigh) === false);
  // T5 unbewertete aktuelle Registerquelle autorisiert keine quantitative Nutzung.
  ok('T5 unbewertete aktuelle Registerquelle (not_formally_assessed) ⇒ keine quantitative Nutzung, selbst mit korrektem Paket',
    KS.sources.every(s0 => s0.appraisal.riskOfBias === 'not_formally_assessed') &&
    KC.quantitativeUseAllowed(Object.assign({}, evH, { sourceRefs: ['SRC-IOC-LOAD-2016'], quantitative: goodQ }), byId) === false);
  // T6 maxConfidenceFor Kurzform ist FAIL-CLOSED.
  ok('T6 maxConfidenceFor("A")/("B")/("C")/("D") ergeben NIE "high" (Kurzform fail-closed)',
    ['A', 'B', 'C', 'D'].every(c => KC.maxConfidenceFor(c) !== 'high') && KC.maxConfidenceFor('A') === 'low');
  // T7 erwartbare malformte Strukturen liefern FELDFEHLER, nicht internal_validator_error.
  const rIn = mkRule(); rIn.inputs = {}; const rOut = mkRule(); rOut.outputs = {};
  const eIn = KC.validateRule(rIn, byId, { sourceRegistryHash: regHash }).errors;
  const eOut = KC.validateRule(rOut, byId, { sourceRegistryHash: regHash }).errors;
  ok('T7 inputs:{} / outputs:{} ⇒ feldbezogene Fehler (rule_empty_inputs/outputs), KEIN internal_validator_error',
    eIn.some(e => e.code === 'rule_empty_inputs') && !eIn.some(e => e.code === 'internal_validator_error') &&
    eOut.some(e => e.code === 'rule_empty_outputs') && !eOut.some(e => e.code === 'internal_validator_error'));
  const rSyn = mkRule(); rSyn.claims[0].synthesis = 'x';
  const eSyn = KC.validateRule(rSyn, byId, { sourceRegistryHash: regHash }).errors;
  ok('T7b synthesis:"x" ⇒ feldbezogener Fehler (claim_missing_synthesis_consistency), KEIN internal_validator_error (in-Operator-Guard)',
    eSyn.some(e => e.code === 'claim_missing_synthesis_consistency') && !eSyn.some(e => e.code === 'internal_validator_error'));
  // T8 Versions-/Pflichtfeld-Typen.
  ok('T8 packVersion/previousVersion/seasonPhase/changeReason/positionRole/version streng typisiert; rule.packVersion muss pack.version entsprechen',
    KC.validateRule(Object.assign(mkRule(), { packVersion: '3' }), byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_invalid_pack_version') &&
    KC.validateRule(Object.assign(mkRule(), { previousVersion: 2.5 }), byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_invalid_previous_version') &&
    KC.validateRule(Object.assign(mkRule(), { seasonPhase: [] }), byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_invalid_season_phase') &&
    KC.validateRule(Object.assign(mkRule(), { positionRole: {} }), byId, { sourceRegistryHash: regHash }).errors.some(e => e.code === 'rule_invalid_position_role') &&
    KC.validateRule(Object.assign(mkRule(), { packVersion: 99 }), byId, { sourceRegistryHash: regHash, packVersion: 3 }).errors.some(e => e.code === 'rule_pack_version_mismatch'));
  const regBadV = reHash(clone(KS)); regBadV.registryVersion = 2.5; regBadV.contentHash = KC.registryContentHash(regBadV);
  const packBadV = clone(RP); packBadV.version = '3'; packBadV.contentHash = KC.packContentHash(packBadV);
  ok('T8b registryVersion/pack.version müssen positive Ganzzahlen sein',
    KC.validateRegistry(regBadV).errors.some(e => e.code === 'registry_missing_version') &&
    KC.validatePack(packBadV, KS).errors.some(e => e.code === 'pack_invalid_field_type' && e.detail === 'version'));
}

/* ---------- Q: korrigierte Quellen-/Regelaussagen (3b.0a) + Collins atomar (3b.0b) ---------- */
{
  const prog = RP.rules.filter(r => r.ruleId === 'RUN-PROG-001')[0];
  ok('Q1 Nielsen: Hauptvergleich ns + p=.07-Unsicherheit im Claim und in der Quelle',
    prog.claims.some(c => c.claimId === 'PROG-C2' && /NICHT signifikant/.test(c.statement) && /p = \.07/.test(c.statement)) &&
    /p = \.07/.test(KS.byId['SRC-NIELSEN-2014'].summary));
  ok('Q2 Damsted: zeitlich begrenzter, später nicht signifikanter Befund (PMID 30526231)',
    prog.claims.some(c => c.claimId === 'PROG-C3' && /zeitlich begrenzt/.test(c.statement)) &&
    KS.byId['SRC-DAMSTED-2019'].identifier.pmid === '30526231');
  ok('Q3 Progression: essenzielle Produktregel ⇒ Ceiling D, nie high',
    KC.ruleEvidenceCeiling(prog, KS.byId) === 'D' && KC.maxConfidenceFor(prog, KS.byId) === 'medium');
  const safe = RP.rules.filter(r => r.ruleId === 'RUN-SAFE-001')[0];
  ok('Q4 Collins-Evidenz und ORVIA-Produktinferenz sind GETRENNT: SAFE-C2 trägt nur Übungstherapie (hüft+knie, Schmerz/Funktion); „belastungsmodifizierend statt stoppen" ist D-Claim SAFE-P3',
    safe.claims.some(c => c.claimId === 'SAFE-C2' && /Übungstherapie/.test(c.statement) && /hüft- und kniefokussierter/.test(c.statement) && /Schmerz und Funktion/.test(c.statement) && !/belastungsmodifizierend/.test(c.statement)) &&
    safe.claims.some(c => c.claimId === 'SAFE-P3' && c.decisionRole === 'product_policy' && /NACHGELAGERTE ORVIA-Produktinferenz/.test(c.statement)) &&
    KC.deriveClaimEvidenceClass(safe.claims.filter(c => c.claimId === 'SAFE-P3')[0], KS.byId) === 'D');
  ok('Q5 Seiler/Haugen deskriptiv/indirekt + each_sufficient; ORVIA-Heuristik getrennt (kein 80/20-Budget)',
    RP.rules.some(r => r.ruleId === 'RUN-DIM-001' && r.claims.some(c => c.claimId === 'DIM-C1' && c.directness === 'indirect' && c.sourceCombination === 'each_sufficient') &&
      r.claims.some(c => c.claimId === 'DIM-P1' && /KEIN validiertes 80\/20-Budget/.test(c.statement))));
  ok('Q6 RTR-C1 all_required (schwächste notwendige Basis) + Protokoll als ungeprüfte Produktregel; RESP: sRPE ≠ 24-48h-Fenster',
    RP.rules.some(r => r.ruleId === 'RUN-RTR-001' && r.claims.some(c => c.claimId === 'RTR-C1' && c.sourceCombination === 'all_required')) &&
    RP.rules.some(r => r.ruleId === 'RUN-RESP-001' && r.claims.some(c => c.claimId === 'RESP-P1' && c.decisionRole === 'product_policy' && c.essential)));
  ok('Q7 ENV: nur Hitze quellenbelegt; MECH abgeschwächt (vorsichtshalber, kein Beleg)',
    RP.rules.some(r => r.ruleId === 'RUN-ENV-001' && r.claims.some(c => c.claimId === 'ENV-P1' && /KEINE eigene Quellenbasis/i.test(c.statement))) &&
    RP.rules.some(r => r.ruleId === 'RUN-MECH-001' && /VORSICHTSHALBER/.test(r.statement)));
}

/* ---------- P: Abgrenzung + Golden Case + Immutabilität ---------- */
{
  const packJson = JSON.stringify(RP);
  ok('P1 keine Pace-/Kilometer-/Trainingsplanvorgabe im Pack',
    !/min\/km/.test(packJson) && !/\d+(\.\d+)?\s*km\b/.test(packJson) && !/Wochenkilometer/.test(packJson));
  const longRule = RP.rules.filter(r => r.ruleId === 'RUN-LONG-001')[0];
  const acts = [
    { clientRecordId: 'a1', sportId: 'run', startedAt: '2026-07-12T07:30:00Z', durationSeconds: 1860, summary: { distanceKm: 5.2 } },
    { clientRecordId: 'a2', sportId: 'run', startedAt: '2026-07-12T08:03:00Z', durationSeconds: 1500, summary: { distanceKm: 4.0 } },
    { clientRecordId: 'a3', sportId: 'run', startedAt: '2026-07-12T08:30:00Z', durationSeconds: 1260, summary: { distanceKm: 3.21 } }];
  const g = AC.groupActivitySessions(acts, {}).groups.filter(x => x.sportId === 'running');
  ok('P2 12,41-Splitgruppierung = EINE Evidenzeinheit (Vertrag + realer Mechanismus)',
    longRule.evidenceUnit.countingRule === 'grouped_session_counts_once' && g.length === 1 && g[0].totalDistanceKm === 12.41 && g[0].segments === 3);
  ok('P3 Golden-Case-Anker + Scheduler-Abgrenzung',
    ['RUN-LONG-001', 'RUN-GOAL-001', 'RUN-INT-001', 'RUN-SAFE-001', 'RUN-PROG-001'].every(id => RP.goldenCase.anchors.some(a => a.ruleId === id)) &&
    /Scheduler/.test(RP.goldenCase.schedulingNote));
  const before = JSON.stringify(RP) + JSON.stringify(KS);
  try { RP.rules[0].governance.scientificReviewStatus = 'approved'; } catch (e) {}
  try { KS.sources[0].summary = 'HACK'; } catch (e) {}
  ok('P4 Pack + Register tief eingefroren', JSON.stringify(RP) + JSON.stringify(KS) === before);
  const raw = ['engine/knowledge/knowledge-contracts.js', 'engine/knowledge/knowledge-sources.js', 'engine/knowledge/running-knowledge-pack.js', 'engine/knowledge/sport-coverage-matrix.js']
    .map(f => src(f)).join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok('P5 Wissensmodule ohne DOM/Storage/Netz/eigene Zeitquelle',
    !/\bdocument\./.test(raw) && !/\blocalStorage\b/.test(raw) && !/\bfetch\s*\(/.test(raw) &&
    !/Date\.now\s*\(/.test(raw) && !/Math\.random\s*\(/.test(raw) && !/new Date\(\s*\)/.test(raw));
}

/* ---------- C: Coverage gegen den realen 24er-Produktkatalog ---------- */
{
  const matrixSports = Object.keys(CM.COVERAGE).sort();
  const onboarding = OSL.SPORT_CATALOG.map(s => s.id).sort();
  ok('C1 Coverage == realer 24er-Onboarding-Katalog (inkl. der acht zuvor fehlenden Sportarten)',
    onboarding.length === 24 && JSON.stringify(matrixSports) === JSON.stringify(onboarding) &&
    ['volleyball', 'hockey', 'rugby', 'badminton', 'golf', 'climbing', 'yoga', 'hyrox'].every(s => !!CM.COVERAGE[s]));
  ok('C2 Activity-Support ≠ Produktkatalog (getrennte Sichten, code-deckungsgleich)',
    matrixSports.every(s => CM.COVERAGE[s].activityTrackingSupported === (TD.ACTIVITY_SPORTS.indexOf(s) >= 0)) &&
    CM.COVERAGE.volleyball.onboardingSelectable === true && CM.COVERAGE.volleyball.activityTrackingSupported === false);
  ok('C3 profileSchema == reale sportFollowupSchema; positionRoleModel == POSITIONS; catalogPlanningFlag == Katalog',
    matrixSports.every(s => CM.COVERAGE[s].profileSchema === (PM.sportFollowupSchema(s) != null)) &&
    matrixSports.every(s => CM.COVERAGE[s].positionRoleModel === !!TD.POSITIONS[s]) &&
    matrixSports.every(s => CM.COVERAGE[s].catalogPlanningFlag === OSL.CATALOG_BY_ID[s].planningSupported));
  ok('C4 nichts produktionsreif/fachlich geprüft; kein Scheduler; mobility = Modalität',
    matrixSports.every(s => CM.COVERAGE[s].plannerSupport === false && CM.COVERAGE[s].safetyReview === false && CM.COVERAGE[s].productionStatus === 'none') &&
    CM.COVERAGE.mobility.modalityClassification === true);

  /* C5/C6 — BEFUND 2026-08-13, der diese beiden Zusicherungen erzwungen hat:
     Gym bekam in v8-339 ein Wissenspaket, die Matrix führte es weiter als
     paketlos, und die frühere Fassung von C4 hielt genau das für richtig
     (`… .filter(knowledgePack).length === 1`). Ein Zähler prüft nichts — er
     friert den Stand des Tages ein und bleibt grün, während die Aussage
     falsch wird. Deshalb wird ab jetzt gegen die WIRKLICHKEIT verglichen:
       C5  welche Pack-Module liegen tatsächlich im Verzeichnis,
       C6  welche davon holt der Consumer im Produktivweg wirklich.
     Beides ist selbstpflegend: ein neues Paket lässt den Test anschlagen,
     bis die Matrix es führt. */
  const packFiles = readdirSync(new URL('engine/knowledge/', base))
    .filter(f => /-knowledge-pack\.js$/.test(f)).sort();
  /* Die Sportart steht IM Modul, nicht im Dateinamen — der Dateiname wäre
     nur eine Vermutung über den Inhalt. Jede Datei bekommt eine frische
     Sandbox, damit die Pakete sich nicht gegenseitig überschreiben. */
  const packSportOf = (file) => {
    const s = {}; s.window = s; s.self = s; s.globalThis = s;
    s.console = console; s.Date = Date; s.Math = Math; s.JSON = JSON; s.Object = Object; s.Array = Array;
    s.String = String; s.Number = Number; s.Intl = Intl; s.isNaN = isNaN; s.isFinite = isFinite;
    s.RegExp = RegExp; s.Error = Error; s.parseInt = parseInt; s.parseFloat = parseFloat;
    vm.createContext(s);
    vm.runInContext(src('engine/knowledge/knowledge-contracts.js'), s, { filename: 'knowledge-contracts.js' });
    vm.runInContext(src('engine/knowledge/' + file), s, { filename: file });
    const treffer = Object.keys(s.ORVIA || {}).map(k => s.ORVIA[k])
      .filter(v => v && typeof v === 'object' && Array.isArray(v.rules) && typeof v.sport === 'string');
    return treffer.length === 1 ? treffer[0].sport : null;
  };
  const vorhanden = packFiles.map(packSportOf).filter(Boolean).sort();
  ok('C5 knowledgePack == die real vorhandenen Pack-Module (kein Zähler, ein Vergleich)',
    packFiles.length > 0 && vorhanden.length === packFiles.length &&
    JSON.stringify(matrixSports.filter(s => CM.COVERAGE[s].knowledgePack).sort()) === JSON.stringify(vorhanden),
    'Module: ' + JSON.stringify(vorhanden) + ' · Matrix: ' +
    JSON.stringify(matrixSports.filter(s => CM.COVERAGE[s].knowledgePack).sort()));
  ok('  … und jede Sportart mit Paket nennt ihren Prüfstand',
    vorhanden.every(s => CM.COVERAGE[s].knowledgePackStatus === 'technically_reviewed_scientifically_unreviewed'));

  /* C6: ein Paket zu BESITZEN und im Produktivweg GELESEN zu werden ist
     nicht dasselbe. Das Laufpaket erreicht heute keinen Aufrufer. */
  const sbW = {}; sbW.window = sbW; sbW.self = sbW; sbW.globalThis = sbW;
  sbW.console = console; sbW.Date = Date; sbW.Math = Math; sbW.JSON = JSON; sbW.Object = Object; sbW.Array = Array;
  sbW.String = String; sbW.Number = Number; sbW.Intl = Intl; sbW.isNaN = isNaN; sbW.isFinite = isFinite;
  sbW.RegExp = RegExp; sbW.Error = Error; sbW.parseInt = parseInt; sbW.parseFloat = parseFloat;
  vm.createContext(sbW);
  ['engine/knowledge/knowledge-contracts.js', 'engine/knowledge/knowledge-application.js',
    'engine/knowledge/knowledge-consumer.js'].forEach(f => vm.runInContext(src(f), sbW, { filename: f }));
  const verdrahtet = sbW.ORVIA.knowledgeConsumer.registrierteSportarten().slice().sort();
  ok('C6 knowledgePackWired == was der knowledge-consumer wirklich registriert',
    verdrahtet.length > 0 &&
    JSON.stringify(matrixSports.filter(s => CM.COVERAGE[s].knowledgePackWired).sort()) === JSON.stringify(verdrahtet),
    'Consumer: ' + JSON.stringify(verdrahtet) + ' · Matrix: ' +
    JSON.stringify(matrixSports.filter(s => CM.COVERAGE[s].knowledgePackWired).sort()));
  ok('  … und verdrahtet ist immer eine Teilmenge von vorhanden',
    verdrahtet.every(s => vorhanden.indexOf(s) >= 0));
}

/* ---------- PR: Vertrag v6 — Vorgabefähigkeit von Evidenzklasse entkoppelt ----------
   Kernfrage dieser Gruppe: Darf die App konkret vorschreiben, ohne dass die
   Sicherheits- und Medizinsperren aufweichen? Alle Prüfungen laufen gegen die
   ECHTEN Module (kein Mock des Vertrags). */
{
  const advPins = Object.assign({}, PINS, { mode: 'advisory', sport: 'running' });
  const prodPins = Object.assign({}, PINS, { mode: 'production', sport: 'running' });
  const shaPins = Object.assign({}, PINS, { mode: 'shadow', sport: 'running' });
  const adv = KC.selectRules(RP, KS, advPins);
  const prod = KC.selectRules(RP, KS, prodPins);
  const sha = KC.selectRules(RP, KS, shaPins);
  const MED = ['RUN-SAFE-001', 'RUN-RTR-001'];

  ok('PR1 advisory ist gültiger Modus und liefert Regeln, wo production nichts liefert (genau das war die Blockade)',
    KC.MODES.indexOf('advisory') >= 0 && adv.blocked === false && adv.rules.length > 0 &&
    prod.blocked === false && prod.rules.length === 0,
    'advisory=' + adv.rules.length + ' production=' + prod.rules.length);

  ok('PR2 production UNVERÄNDERT gesperrt: jede Regel mit scientific_review_pending ausgeschlossen',
    prod.rules.length === 0 && prod.excluded.length === RP.rules.length &&
    prod.excluded.every(x => x.code === 'scientific_review_pending' || x.code === 'medical_safety_review_pending'));

  ok('PR3 medizinisch relevante Regeln sind auch in ADVISORY gesperrt (die Sperre wird nicht mitgelockert)',
    MED.every(id => !adv.rules.some(r => r.ruleId === id)) &&
    MED.every(id => adv.excluded.some(x => x.ruleId === id && x.code === 'medical_safety_review_pending')) &&
    RP.rules.filter(r => r.medicalSafetyRelevant === true).map(r => r.ruleId).sort().join(',') === MED.slice().sort().join(','));

  ok('PR4 advisory hebt GENAU EINE Sperre auf: identischer Regelsatz wie shadow, nur ohne scientific-Pflicht',
    JSON.stringify(adv.rules.map(r => r.ruleId)) === JSON.stringify(sha.rules.map(r => r.ruleId)) &&
    adv.mode === 'advisory' && sha.mode === 'shadow');

  // V5 technisch ungeprüft / rejected bleiben in advisory draußen.
  {
    const t = clone(RP); t.rules[0].governance.technicalStatus = 'draft'; t.contentHash = KC.packContentHash(t);
    const rT = KC.selectRules(t, KS, pinsFor(t, KS, { mode: 'advisory' }));
    const j = clone(RP); j.rules[1].governance.scientificReviewStatus = 'rejected'; j.contentHash = KC.packContentHash(j);
    const rJ = KC.selectRules(j, KS, pinsFor(j, KS, { mode: 'advisory' }));
    ok('PR5 advisory schließt technisch ungeprüfte und rejected Regeln weiterhin aus',
      !rT.rules.some(r => r.ruleId === t.rules[0].ruleId) &&
      rT.excluded.some(x => x.ruleId === t.rules[0].ruleId && x.code === 'technical_review_pending') &&
      !rJ.rules.some(r => r.ruleId === j.rules[1].ruleId) &&
      rJ.excluded.some(x => x.ruleId === j.rules[1].ruleId && x.code === 'review_rejected'));
  }

  ok('PR6 jede gelieferte Regel trägt eine vollständige Offenlegung (Klasse, Confidence, Basis, Label, Quellen, Anzeigepflicht)',
    adv.rules.length > 0 && adv.rules.every(r => {
      const d = adv.disclosures[r.ruleId];
      return d && d.ruleId === r.ruleId && ['A', 'B', 'C', 'D'].indexOf(d.evidenceClass) >= 0 &&
        ['low', 'medium', 'high'].indexOf(d.confidence) >= 0 &&
        KC.DECISION_ROLES.indexOf(d.basis) >= 0 && typeof d.basisLabel === 'string' && d.basisLabel.length > 0 &&
        Array.isArray(d.sourceRefs) && d.mustDisplaySource === true;
    }));

  ok('PR6b Basis = SCHWÄCHSTE essenzielle Rolle (eine Regel ist nie besser begründet als ihre schwächste tragende Säule)',
    adv.rules.every(r => {
      const roles = r.claims.filter(c => c.essential === true).map(c => c.decisionRole);
      const rank = { evidence: 4, expert_consensus: 3, product_policy: 2, fallback: 1 };
      const weakest = roles.slice().sort((a, b) => rank[a] - rank[b])[0];
      return adv.disclosures[r.ruleId].basis === weakest;
    }) &&
    // Reale Ausprägung: alle Regeln tragen eine essenzielle Produktentscheidung ⇒ Klasse D.
    adv.rules.every(r => adv.disclosures[r.ruleId].evidenceClass === 'D' && adv.disclosures[r.ruleId].confidence !== 'high'));

  // V7 Offenlegungspflicht mit Zähnen: keine ableitbare Basis ⇒ Ausschluss statt Auslieferung ohne Herkunft.
  {
    const u = clone(RP);
    const victim = u.rules.find(r => r.medicalSafetyRelevant !== true);
    victim.claims.forEach(c => { c.decisionRole = 'unknown_role'; });
    u.contentHash = KC.packContentHash(u);
    const rU = KC.selectRules(u, KS, pinsFor(u, KS, { mode: 'advisory' }));
    // Das Pack ist durch die kaputte Rolle bereits ungültig ⇒ blockiert (fail-closed, noch strenger).
    ok('PR7 Regel ohne ableitbare Offenlegungs-Basis wird nie ohne Herkunft ausgeliefert (Pack blockiert fail-closed)',
      rU.blocked === true && rU.rules.length === 0 && codes(rU).indexOf('claim_unknown_decision_role') >= 0);
  }

  /* PR7b Die Offenlegungs-Zusicherung DIREKT an disclosureFor geprüft.
     Grund: der Zweig 'disclosure_underivable' in selectRules ist unter dem
     aktuellen Vertrag unerreichbar (validatePack blockt vorher) und zählt
     deshalb ausdrücklich NICHT als nachgewiesener Schutz. */
  ok('PR7b disclosureFor ist selbst fail-closed: kein Objekt / keine essenziellen Claims / unbekannte Rolle ⇒ keine ableitbare Basis',
    KC.disclosureFor(null) === null && KC.disclosureFor('x') === null && KC.disclosureFor([]) === null &&
    (() => { const d = KC.disclosureFor({ ruleId: 'R', claims: [], governance: {} }, {}); return d && d.basis === null && d.evidenceClass === null; })() &&
    (() => { const d = KC.disclosureFor({ ruleId: 'R', claims: [{ essential: true, decisionRole: 'quatsch', sourceRefs: [] }], governance: {} }, {}); return d && d.basis === null; })() &&
    (() => { const d = KC.disclosureFor({ ruleId: 'R', claims: [{ essential: true, decisionRole: 'evidence', sourceRefs: ['A', 'A', 'B'] }], governance: { scientificReviewStatus: 'unreviewed' } }, {});
      return d && d.basis === 'evidence' && JSON.stringify(d.sourceRefs) === '["A","B"]' && d.mustDisplaySource === true; })());

  /* PR6c Die Schwäche-Ordnung an einer SYNTHETISCHEN Regel mit GEMISCHTEN
     essenziellen Rollen. Die realen Pack-Regeln allein beweisen sie nicht:
     dort ist die schwächste Rolle ohnehin die einzige, die Rangtabelle bliebe
     ungeprüft (Befund aus Mutationsprobe M10). */
  ok('PR6c gemischte essenzielle Rollen: evidence + product_policy ⇒ Basis product_policy; nicht-essenzielle Claims zählen nicht',
    (() => {
      const mkC = (role, ess) => ({ essential: ess, decisionRole: role, sourceRefs: [] });
      const d1 = KC.disclosureFor({ ruleId: 'R', claims: [mkC('evidence', true), mkC('product_policy', true)], governance: {} }, {});
      const d2 = KC.disclosureFor({ ruleId: 'R', claims: [mkC('expert_consensus', true), mkC('fallback', true)], governance: {} }, {});
      const d3 = KC.disclosureFor({ ruleId: 'R', claims: [mkC('evidence', true), mkC('fallback', false)], governance: {} }, {});
      return d1.basis === 'product_policy' && d2.basis === 'fallback' && d3.basis === 'evidence' &&
        d1.basisLabel === KC.BASIS_LABELS.product_policy;
    })());

  /* PR8 gegen ein NICHT eingefrorenes Pack. Gegen das reale Pack wäre der
     Test wertlos: dort verhindert bereits das tiefe Einfrieren jede Zuweisung
     (Befund aus Mutationsprobe M11) — geprüft würde das Freeze, nicht der
     Selector. */
  ok('PR8 selectRules mutiert die Regelobjekte NICHT — auch ohne Schutz durch Object.freeze',
    (() => {
      const thawed = clone(RP);
      const before = JSON.stringify(thawed);
      const r = KC.selectRules(thawed, clone(KS), pinsFor(thawed, KS, { mode: 'advisory' }));
      return r.blocked === false && r.rules.length > 0 &&
        JSON.stringify(thawed) === before &&
        thawed.rules.every(x => !('disclosure' in x)) &&
        KC.packContentHash(thawed) === KC.packContentHash(RP);
    })(),
    'Pack-Hash unverändert');

  ok('PR8b reales Pack und Register bleiben nach der Auswahl hash-identisch',
    KC.packContentHash(RP) === PINS.expectedPackContentHash &&
    KC.registryContentHash(KS) === PINS.expectedSourceRegistryHash);

  ok('PR9 advisory unterliegt derselben Pin-Pflicht wie production (kein Schlupfloch)',
    (() => { const p = Object.assign({}, advPins); delete p.expectedPackContentHash;
      const r = KC.selectRules(RP, KS, p);
      return r.blocked === true && r.rules.length === 0 && codes(r).indexOf('missing_pin_pack_content_hash') >= 0; })());

  ok('PR10 Determinismus auch im Advisory-Modus (inkl. disclosures)',
    JSON.stringify(adv) === JSON.stringify(KC.selectRules(RP, KS, Object.assign({}, PINS, { mode: 'advisory', sport: 'running' }))));
}

/* ---------- QN: Quant-Struktur vs. Autorisierung + Vorgabe-Zahlen (v6) ---------- */
{
  const goodQ = {
    schemaVersion: KC.QUANT_SCHEMA_VERSION, inputUnits: 'km/Woche', outputUnits: 'km/Woche',
    validRange: { min: 0, max: 200 }, population: 'Freizeitläufer', exclusions: ['akute Verletzung'],
    sourceQuantitativeStatement: 'Coach-Praxis: Tempoblöcke 3–5 × 1 km', allowedTransformation: 'keine',
    uncertaintyRange: '±1 km', independentValidation: false, safetyBounds: 'max. 8 km Tempoanteil'
  };
  const dClaim = {
    claimId: 'W-D', statement: 'Tempolauf 5 km in 1-km-Blöcken', sourceRefs: ['SRC-ORVIA-BATCH2-CONTRACT'],
    decisionRole: 'product_policy', population: 'p', applicability: 'a', outcome: 'o',
    directness: 'direct', use: 'quantitative', uncertainties: ['u'], essential: true, quantitative: goodQ
  };
  const ruleCtx = { medicalSafetyRelevant: false, governance: { technicalStatus: 'reviewed', scientificReviewStatus: 'unreviewed', medicalSafetyReviewStatus: 'not_required' } };
  const byId = KC.validateRegistry(KS).sourcesById;

  ok('QN1 Struktur und Autorisierung sind GETRENNT: vollständige Struktur ist gültig, autorisiert aber nichts in production',
    KC.quantitativeSchemaValid(dClaim) === true &&
    KC.quantitativeUseAllowed(dClaim, byId) === false);

  ok('QN1b independentValidation: Struktur verlangt boolesch, production verlangt exakt true',
    KC.quantitativeSchemaValid(Object.assign({}, dClaim, { quantitative: Object.assign({}, goodQ, { independentValidation: 'ja' }) })) === false &&
    KC.quantitativeSchemaValid(Object.assign({}, dClaim, { quantitative: Object.assign({}, goodQ, { independentValidation: true }) })) === true);

  /* QN1c Der entscheidende Grenzfall: independentValidation ist BOOLESCH
     FALSE. Die Struktur ist damit gültig, production bleibt gesperrt, advisory
     erlaubt. Ohne diesen Fall prüft die Suite nur typwidrige Werte und
     übersieht das Weglassen der true-Pflicht (Befund aus Mutationsprobe M6). */
  ok('QN1c independentValidation === false: Struktur gültig, production GESPERRT, advisory erlaubt',
    (() => {
      const src = { 'SRC-HI': { sourceId: 'SRC-HI', sourceType: 'systematic_review', appraisal: { studyDesign: 'sr', methodQuality: 'high', riskOfBias: 'low' } } };
      const hi = Object.assign({}, dClaim, { sourceRefs: ['SRC-HI'], decisionRole: 'evidence', supportBasis: 'b', synthesis: { consistency: 'consistent' } });
      const qFalse = Object.assign({}, goodQ, { independentValidation: false });
      const qTrue = Object.assign({}, goodQ, { independentValidation: true });
      return KC.deriveClaimEvidenceClass(hi, src) === 'A' &&
        KC.quantitativeSchemaValid(Object.assign({}, hi, { quantitative: qFalse })) === true &&
        KC.quantitativeUseAllowed(Object.assign({}, hi, { quantitative: qFalse }), src) === false &&
        KC.quantitativeUseAllowed(Object.assign({}, hi, { quantitative: qTrue }), src) === true &&
        KC.prescriptiveNumberAllowed(Object.assign({}, hi, { quantitative: qFalse }), src, ruleCtx) === true;
    })());

  ok('QN2 ein quantitativer D-Claim macht die Regel NICHT mehr ungültig (bis v5 unmöglich, überhaupt eine Zahl zu hinterlegen)',
    (() => {
      const errs = KC.validateClaim(dClaim, 'W-RULE', byId);
      return errs.every(e => e.code !== 'claim_quantitative_not_authorized' && e.code !== 'claim_quantitative_schema_invalid');
    })());

  ok('QN2b unvollständige Quant-Struktur wird weiterhin abgelehnt — mit neuem, präziserem Fehlercode',
    KC.validateClaim(Object.assign({}, dClaim, { quantitative: Object.assign({}, goodQ, { safetyBounds: '' }) }), 'W-RULE', byId)
      .some(e => e.code === 'claim_quantitative_schema_invalid'));

  ok('QN3 prescriptiveNumberAllowed: Klasse-D-Regel DARF im Advisory-Modus eine konkrete Zahl vorgeben',
    KC.prescriptiveNumberAllowed(dClaim, byId, ruleCtx) === true &&
    KC.deriveClaimEvidenceClass(dClaim, byId) === 'D');

  ok('QN4 fail-closed ohne Regelkontext: ohne ruleCtx niemals eine Zahl',
    [undefined, null, 'x', 42, []].every(ctx => KC.prescriptiveNumberAllowed(dClaim, byId, ctx) === false));

  ok('QN5 fail-closed medizinisch: medicalSafetyRelevant ohne Freigabe ⇒ keine Zahl; mit Freigabe erlaubt',
    KC.prescriptiveNumberAllowed(dClaim, byId, { medicalSafetyRelevant: true, governance: { technicalStatus: 'reviewed', scientificReviewStatus: 'unreviewed', medicalSafetyReviewStatus: 'required_unreviewed' } }) === false &&
    KC.prescriptiveNumberAllowed(dClaim, byId, { medicalSafetyRelevant: true, governance: { technicalStatus: 'reviewed', scientificReviewStatus: 'unreviewed', medicalSafetyReviewStatus: 'approved' } }) === true);

  ok('QN6 fail-closed Rolle/Governance: fallback, technisch ungeprüft und rejected geben nie eine Zahl frei',
    KC.prescriptiveNumberAllowed(Object.assign({}, dClaim, { decisionRole: 'fallback' }), byId, ruleCtx) === false &&
    KC.prescriptiveNumberAllowed(Object.assign({}, dClaim, { decisionRole: 'quatsch' }), byId, ruleCtx) === false &&
    KC.prescriptiveNumberAllowed(dClaim, byId, { medicalSafetyRelevant: false, governance: { technicalStatus: 'draft', scientificReviewStatus: 'unreviewed', medicalSafetyReviewStatus: 'not_required' } }) === false &&
    KC.prescriptiveNumberAllowed(dClaim, byId, { medicalSafetyRelevant: false, governance: { technicalStatus: 'reviewed', scientificReviewStatus: 'rejected', medicalSafetyReviewStatus: 'not_required' } }) === false);

  ok('QN7 fail-closed Geltungsbereich: fehlender validRange / exclusions / uncertaintyRange / safetyBounds ⇒ keine Zahl',
    ['validRange', 'exclusions', 'uncertaintyRange', 'safetyBounds', 'population', 'inputUnits'].every(k => {
      const q = Object.assign({}, goodQ); delete q[k];
      return KC.prescriptiveNumberAllowed(Object.assign({}, dClaim, { quantitative: q }), byId, ruleCtx) === false;
    }));

  ok('QN8 nicht-quantitative Claims erzeugen nie eine Vorgabe-Zahl',
    KC.prescriptiveNumberAllowed(Object.assign({}, dClaim, { use: 'qualitative' }), byId, ruleCtx) === false &&
    KC.prescriptiveNumberAllowed(Object.assign({}, dClaim, { use: 'ordinal' }), byId, ruleCtx) === false);
}

/* ---------- PX: Praxisquellen (Coach/Video/Verband/Lehrbuch) — v6 ---------- */
{
  const mk = (type, over) => Object.assign({
    sourceId: 'SRC-TEST-' + type.toUpperCase(), title: 'Testquelle', authorsOrOrg: 'Coach Muster', year: 2025,
    sourceType: type, identifier: { url: 'https://example.org/quelle' },
    sports: ['gym'], populations: ['recreational_lifters'], outcomes: ['exercise_selection'],
    appraisal: { studyDesign: 'practice_description', methodQuality: 'moderate', riskOfBias: 'not_formally_assessed' },
    summary: 'Eigene Paraphrase der Kernaussage — kein Fremdtext.',
    limitsAndTransferability: 'Praxisbeschreibung; keine kontrollierte Untersuchung.',
    lastCheckedAt: '2026-08-12'
  }, over || {});
  const NEW_TYPES = ['federation_guideline', 'coach_curriculum', 'coach_practice_video', 'textbook', 'practice_synthesis'];

  ok('PX1 die fünf neuen Praxis-Quellentypen sind gültig (ohne sie ist Coach-/Videowissen gar nicht einspeisbar)',
    NEW_TYPES.every(t => KC.SOURCE_TYPES.indexOf(t) >= 0) &&
    NEW_TYPES.every(t => KC.validateSource(mk(t)).valid === true));

  ok('PX2 Praxisquellen erreichen NIE Klasse A: coach/textbook/synthesis ⇒ Ceiling C, Verbandsleitlinie ⇒ Ceiling B',
    ['coach_curriculum', 'coach_practice_video', 'textbook', 'practice_synthesis', 'expert_practice']
      .every(t => KC.sourceClassRank(mk(t)) === 2) &&
    KC.sourceClassRank(mk('federation_guideline')) === 3 &&
    // Auch mit bestem denkbarem Appraisal bleibt der Deckel: Verbreitung ist kein Evidenzmaß.
    ['coach_practice_video', 'coach_curriculum'].every(t =>
      KC.sourceClassRank(mk(t, { appraisal: { studyDesign: 'x', methodQuality: 'high', riskOfBias: 'low' } })) === 2));

  /* PX2b Der Deckel muss auch beim BESTEN denkbaren Appraisal halten. Mit dem
     Standard-Fixture (moderate/not_formally_assessed) greift ohnehin die
     A-Bremse — eine angehobene Typstufe bliebe unbemerkt (Befund aus
     Mutationsprobe M7). */
  ok('PX2b Verbandsleitlinie bleibt auch bei methodQuality high + riskOfBias low auf Ceiling B (nie A)',
    KC.sourceClassRank(mk('federation_guideline', { appraisal: { studyDesign: 'guideline', methodQuality: 'high', riskOfBias: 'low' } })) === 3 &&
    // Gegenprobe: ein Konsensuspapier mit demselben Appraisal erreicht sehr wohl Rang 4.
    KC.sourceClassRank(mk('consensus_statement', { appraisal: { studyDesign: 'consensus', methodQuality: 'high', riskOfBias: 'low' } })) === 4);

  ok('PX3 Coachquelle stuft einen Claim höchstens auf C — und C bleibt in production quantitativ gesperrt',
    (() => {
      const byId = { 'SRC-COACH': mk('coach_practice_video', { sourceId: 'SRC-COACH' }) };
      const c = { claimId: 'X', statement: 's', sourceRefs: ['SRC-COACH'], decisionRole: 'evidence',
        population: 'p', applicability: 'a', outcome: 'o', directness: 'direct', use: 'qualitative',
        uncertainties: ['u'], essential: true, supportBasis: 'b', synthesis: { consistency: 'single_source' } };
      return KC.deriveClaimEvidenceClass(c, byId) === 'C' &&
        KC.quantitativeUseAllowed(Object.assign({}, c, { use: 'quantitative' }), byId) === false;
    })());

  ok('PX4 Praxisquellen unterliegen derselben Formstrenge: fehlender Identifikator/Appraisal/Limits blockiert',
    KC.validateSource(mk('coach_practice_video', { identifier: {} })).valid === false &&
    KC.validateSource(mk('coach_curriculum', { appraisal: null })).valid === false &&
    KC.validateSource(mk('textbook', { limitsAndTransferability: '' })).valid === false);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
