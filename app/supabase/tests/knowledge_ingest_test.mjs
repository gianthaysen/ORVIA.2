/* ORVIA · v8-334 — Wissen einspeisen.

   Die Zusage dieses Moduls ist nicht „es ist bequem", sondern: es füllt
   ausschließlich auf, was KEINE inhaltliche Entscheidung ist, und erzwingt
   alles Übrige. Fällt diese Trennlinie, entsteht genau das, was die App
   nicht sein soll — eine Maschine, die sich Randbedingungen selbst ausdenkt.

   Geprüft wird gegen den ECHTEN Wissensvertrag: was hier herauskommt, muss
   validateRegistry und validatePack bestehen. Ein eigener Nachbau des
   Vertrags im Test wäre wertlos.

   node supabase/tests/knowledge_ingest_test.mjs */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = [_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
  .find(p => existsSync(join(p, 'js/engine/knowledge/knowledge-ingest.js'))) || _flat;

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const KI = require(join(APP, 'js/engine/knowledge/knowledge-ingest.js'));
const KC = require(join(APP, 'js/engine/knowledge/knowledge-contracts.js'));

/* Eine vollständige, gültige Notiz — Grundlage aller Negativproben:
   jeweils EIN Feld wird daraus entfernt oder verdorben. */
const QUELLE = () => ({
  id: 'SRC-TEST-COACH-2025', art: 'coachvideo', titel: 'Krafttraining für Läufer',
  wer: 'Coach Muster', jahr: 2025, url: 'https://example.org/v',
  sportarten: ['gym'], gilt_fuer: ['freizeitlaeufer'], worum_gehts: ['uebungsauswahl'],
  qualitaet: 'mittel',
  kernaussage: 'Eigene Zusammenfassung der Kernaussage in kurzer Form.',
  grenzen: 'Erfahrungsbericht, keine kontrollierte Untersuchung.',
  eigene_worte: true, geprueft_am: '2026-08-12'
});
const REGEL = () => ({
  id: 'GYM-T-001', thema: 'uebungsauswahl',
  aussage: 'Einbeinige Übungen vor beidbeinigen.',
  art: 'coachkonsens', quellen: ['SRC-TEST-COACH-2025'],
  gilt_fuer: ['freizeitlaeufer'], nicht_fuer: [],
  unsicherheiten: ['Erfahrungswissen, nicht kontrolliert untersucht'],
  wenn_unsicher: 'Im Zweifel beidbeinig.',
  wirkt_auf: ['session.exercises']
});
const NOTIZ = () => ({ sport: 'gym', quelle: QUELLE(), regeln: [REGEL()] });

/* ══ G · Der Regelfall ══ */
sec('G · eine vollständige Notiz wird vertragskonform');
{
  const r = KI.ingest(NOTIZ());
  ok('die Notiz wird angenommen', r.ok === true, KI.fehlerText(r.fehler));
  ok('es entstehen genau eine Quelle und eine Regel', r.sources.length === 1 && r.rules.length === 1);

  const reg = { registryVersion: 1, sources: r.sources };
  reg.contentHash = KC.registryContentHash(reg);
  const rv = KC.validateRegistry(reg);
  ok('das Quellenregister besteht den ECHTEN Vertrag', rv.valid === true,
    rv.errors.map(e => e.code).join(','));

  const pack = { packId: 'gym', version: 1, knowledgeVersion: 'kb-gym-v1.0.0',
    sport: 'gym', rules: r.rules, contentHash: null };
  pack.contentHash = KC.packContentHash(pack);
  const pv = KC.validatePack(pack, reg);
  ok('das Wissenspaket besteht den ECHTEN Vertrag', pv.valid === true,
    pv.errors.map(e => e.code + ':' + e.detail).slice(0, 4).join(' | '));
}

/* ══ A · Aufgefüllt wird nur Formales ══ */
sec('A · aufgefüllt wird nur, was keine inhaltliche Entscheidung ist');
{
  const r = KI.ingest(NOTIZ());
  const rr = r.rules[0], q = r.sources[0];
  ok('Formalien werden gesetzt (version, seasonPhase, positionRole, previousVersion)',
    rr.version === 1 && rr.seasonPhase === 'any' && rr.positionRole === null && rr.previousVersion === null);
  ok('die Governance startet UNGEPRÜFT — es wird nie eine Freigabe erfunden',
    rr.governance.technicalStatus === 'draft' &&
    rr.governance.scientificReviewStatus === 'unreviewed' &&
    rr.governance.reviews.length === 0);
  ok('das Risk-of-Bias-Urteil ist ehrlich „nicht formal bewertet" statt einer erfundenen Note',
    q.appraisal.riskOfBias === 'not_formally_assessed');
  ok('die eingegebene Qualität landet unverändert als methodQuality',
    q.appraisal.methodQuality === 'moderate');
  ok('die Paraphrase wird wörtlich übernommen und NICHT umformuliert',
    q.summary === QUELLE().kernaussage);
  ok('die Grenzen der Übertragbarkeit ebenso',
    q.limitsAndTransferability === QUELLE().grenzen);
}

/* ══ P · Pflichtangaben ══ */
sec('P · alles Inhaltliche wird erzwungen');
{
  const felder = [
    ['titel', 'titel_fehlt'], ['wer', 'wer_fehlt'], ['jahr', 'jahr_fehlt'],
    ['sportarten', 'sportarten_fehlen'], ['gilt_fuer', 'population_fehlt'],
    ['worum_gehts', 'thema_fehlt'], ['qualitaet', 'qualitaet_fehlt'],
    ['kernaussage', 'kernaussage_fehlt'], ['grenzen', 'grenzen_fehlen'],
    ['geprueft_am', 'datum_fehlt']
  ];
  ok('jedes inhaltliche Quellenfeld ist Pflicht und hat einen eigenen Fehlercode',
    felder.every(([f, code]) => {
      const n = NOTIZ(); delete n.quelle[f];
      const r = KI.ingest(n);
      return r.ok === false && r.fehler.some(e => e.code === code);
    }), felder.map(f => f[0]).join(','));
  ok('  … und jeder Fehler nennt eine HANDLUNG, nicht nur den Feldnamen',
    (() => {
      const n = NOTIZ(); delete n.quelle.grenzen;
      const e = KI.ingest(n).fehler.find(x => x.code === 'grenzen_fehlen');
      return e && e.hinweis.length > 40 && /NICHT|nicht/.test(e.hinweis);
    })());
  ok('ohne Nachweis (url/doi/pmid) wird abgewiesen — eine Quelle ohne Fundstelle ist keine',
    (() => { const n = NOTIZ(); delete n.quelle.url;
      return KI.ingest(n).fehler.some(e => e.code === 'nachweis_fehlt'); })());
  ok('  … ein untauglicher Nachweis zählt nicht als Nachweis',
    (() => { const n = NOTIZ(); n.quelle.url = 'irgendwas'; n.quelle.doi = 'abc'; n.quelle.pmid = '12';
      return KI.ingest(n).fehler.some(e => e.code === 'nachweis_fehlt'); })());
}
{
  const felder = [
    ['aussage', 'aussage_fehlt'], ['thema', 'thema_fehlt'], ['art', 'rolle_fehlt'],
    ['gilt_fuer', 'geltung_fehlt'], ['nicht_fuer', 'ausschluss_fehlt'],
    ['unsicherheiten', 'unsicherheiten_fehlen'], ['wenn_unsicher', 'fallback_fehlt'],
    ['wirkt_auf', 'wirkung_fehlt']
  ];
  ok('jedes inhaltliche Regelfeld ist ebenso Pflicht',
    felder.every(([f, code]) => {
      const n = NOTIZ(); delete n.regeln[0][f];
      const r = KI.ingest(n);
      return r.ok === false && r.fehler.some(e => e.code === code);
    }), felder.map(f => f[0]).join(','));
  ok('eine Quelle ohne abgeleitete Regel wird abgewiesen (sie ändert am Verhalten nichts)',
    (() => { const n = NOTIZ(); n.regeln = [];
      return KI.ingest(n).fehler.some(e => e.code === 'regeln_fehlen'); })());
  ok('eine Regel, die auf eine unbekannte Quelle zeigt, wird abgewiesen',
    (() => { const n = NOTIZ(); n.regeln[0].quellen = ['SRC-GIBT-ES-NICHT'];
      return KI.ingest(n).fehler.some(e => e.code === 'quelle_unbekannt'); })());
}

/* ══ U · Urheberrecht ══ */
sec('U · nur eigene Worte');
ok('ohne die ausdrückliche Bestätigung „eigene_worte" wird abgewiesen',
  [undefined, false, 'ja', 1, null].every(v => {
    const n = NOTIZ(); n.quelle.eigene_worte = v;
    return KI.ingest(n).fehler.some(e => e.code === 'paraphrase_unbestaetigt');
  }));
ok('eine überlange Zusammenfassung wird abgewiesen (Transkriptverdacht)',
  (() => {
    const n = NOTIZ(); n.quelle.kernaussage = 'A'.repeat(KI.MAX_PARAPHRASE + 1);
    const e = KI.ingest(n).fehler.find(x => x.code === 'kernaussage_zu_lang');
    return !!e && /abgeschrieben|fremder Text/.test(e.hinweis);
  })());
ok('  … genau auf der Grenze ist sie noch zulässig',
  (() => { const n = NOTIZ(); n.quelle.kernaussage = 'A'.repeat(KI.MAX_PARAPHRASE);
    return KI.ingest(n).ok === true; })());
ok('eine überlange Regelaussage wird ebenfalls abgewiesen (eine Regel, eine Aussage)',
  (() => { const n = NOTIZ(); n.regeln[0].aussage = 'B'.repeat(KI.MAX_STATEMENT + 1);
    return KI.ingest(n).fehler.some(e => e.code === 'aussage_zu_lang'); })());

/* ══ K · Klassen und Rollen ══ */
sec('K · Quellenart und Rolle steuern die Einordnung — nicht der Zufall');
ok('eine unbekannte Quellenart wird abgewiesen, nicht auf gut Glück eingeordnet',
  (() => { const n = NOTIZ(); n.quelle.art = 'irgendwas';
    const r = KI.ingest(n);
    return r.fehler.some(e => e.code === 'art_unbekannt' && /Erlaubt/.test(e.hinweis)); })());
ok('eine unbekannte Rolle ebenso',
  (() => { const n = NOTIZ(); n.regeln[0].art = 'bauchgefuehl';
    return KI.ingest(n).fehler.some(e => e.code === 'rolle_unbekannt'); })());
ok('ein Coachvideo erreicht höchstens Klasse C — auch mit Qualität „hoch"',
  (() => {
    const n = NOTIZ(); n.quelle.qualitaet = 'hoch';
    const r = KI.ingest(n);
    const byId = {}; r.sources.forEach(s => byId[s.sourceId] = s);
    return KC.ruleEvidenceCeiling(r.rules[0], byId) === 'C';
  })());
ok('eine systematische Übersichtsarbeit kann höher steigen (die Art wirkt wirklich)',
  (() => {
    const n = NOTIZ(); n.quelle.art = 'uebersichtsarbeit'; n.quelle.qualitaet = 'hoch';
    n.regeln[0].art = 'studie'; n.regeln[0].beleg = 'Ergebnisabschnitt';
    const r = KI.ingest(n);
    const byId = {}; r.sources.forEach(s => byId[s.sourceId] = s);
    return ['A', 'B'].indexOf(KC.ruleEvidenceCeiling(r.rules[0], byId)) >= 0;
  })());
ok('eine Regel ohne Quelle geht nur als ausdrückliche Produktentscheidung durch',
  (() => {
    const ohne = NOTIZ(); delete ohne.regeln[0].quellen;
    const a = KI.ingest(ohne).fehler.some(e => e.code === 'quellen_fehlen');
    const b = NOTIZ(); delete b.regeln[0].quellen; b.regeln[0].art = 'produktentscheidung';
    return a && KI.ingest(b).ok === true;
  })());
ok('bei MEHREREN Quellen ist das Zusammenspiel Pflicht (sonst gewinnt nie automatisch die beste)',
  (() => {
    const n = NOTIZ();
    n.quellen = [QUELLE(), Object.assign(QUELLE(), { id: 'SRC-TEST-ZWEI-2025' })];
    delete n.quelle;
    n.regeln[0].quellen = ['SRC-TEST-COACH-2025', 'SRC-TEST-ZWEI-2025'];
    const a = KI.ingest(n).fehler.some(e => e.code === 'zusammenspiel_fehlt');
    n.regeln[0].quellen_zusammenspiel = 'alle_noetig';
    const r = KI.ingest(n);
    return a && r.ok === true && r.rules[0].claims[0].sourceCombination === 'all_required';
  })());

/* ══ Z · Zahlen ══ */
sec('Z · eine Zahl ohne Geltungsbereich ist keine Vorgabe');
{
  const ZAHLEN = () => ({
    eingabe_einheit: 'Trainingseinheit', ausgabe_einheit: 'harte Sätze',
    bereich: { min: 2, max: 4 }, gilt_fuer: 'Freizeitläufer',
    so_steht_es_da: 'zwei bis vier schwere Sätze', umrechnung: 'keine',
    unsicherheit: 'grobe Größenordnung', nicht_bei: ['akute Verletzung'],
    sicherheitsgrenzen: 'nie mehr als zwei harte Beineinheiten je Woche'
  });
  const mitZahl = () => { const n = NOTIZ(); n.regeln[0].zahlen = ZAHLEN(); return n; };
  ok('eine vollständige Zahlenangabe wird angenommen und als quantitativ geführt',
    (() => { const r = KI.ingest(mitZahl());
      return r.ok === true && r.rules[0].claims[0].use === 'quantitative' &&
        r.rules[0].claims[0].quantitative.schemaVersion === 1; })());
  ok('jedes Feld des Geltungsbereichs ist Pflicht — auch die Sicherheitsgrenze',
    ['eingabe_einheit', 'ausgabe_einheit', 'gilt_fuer', 'so_steht_es_da',
      'umrechnung', 'unsicherheit', 'sicherheitsgrenzen', 'bereich', 'nicht_bei'].every(f => {
      const n = mitZahl(); delete n.regeln[0].zahlen[f];
      return KI.ingest(n).ok === false;
    }));
  ok('ein verdrehter Bereich (min > max) wird erkannt',
    (() => { const n = mitZahl(); n.regeln[0].zahlen.bereich = { min: 9, max: 2 };
      return KI.ingest(n).fehler.some(e => e.code === 'bereich_verdreht'); })());
  ok('„unabhängig validiert" lässt sich NICHT per Eingabefeld behaupten',
    (() => { const n = mitZahl(); n.regeln[0].zahlen.independentValidation = true;
      n.regeln[0].zahlen.unabhaengig_validiert = true;
      return KI.ingest(n).rules[0].claims[0].quantitative.independentValidation === false; })());

  /* Der eigentliche Zweck: darf die Zahl am Ende eine Vorgabe begründen? */
  const r = KI.ingest(mitZahl());
  const byId = {}; r.sources.forEach(s => byId[s.sourceId] = s);
  const regel = r.rules[0], claim = regel.claims[0];
  ok('solange technisch ungeprüft, gibt die Zahl KEINE Vorgabe her',
    KC.prescriptiveNumberAllowed(claim, byId, regel) === false);
  const geprueft = JSON.parse(JSON.stringify(regel));
  geprueft.governance.technicalStatus = 'reviewed';
  ok('nach technischer Prüfung darf sie im Advisory-Modus vorgeben',
    KC.prescriptiveNumberAllowed(claim, byId, geprueft) === true);
  ok('in production bleibt sie gesperrt (Klasse C, keine formale Bewertung)',
    KC.quantitativeUseAllowed(claim, byId) === false);
}

/* ══ M · Medizinisch heikles Wissen ══ */
sec('M · medizinisch heikle Regeln bleiben gesperrt');
ok('eine medizinisch heikle Regel ohne Sicherheitsgrenzen wird abgewiesen',
  (() => { const n = NOTIZ(); n.regeln[0].medizinisch_heikel = true;
    return KI.ingest(n).fehler.some(e => e.code === 'safety_fehlt'); })());
ok('mit Sicherheitsgrenzen wird sie angenommen — aber als prüfpflichtig markiert',
  (() => {
    const n = NOTIZ(); n.regeln[0].medizinisch_heikel = true;
    n.regeln[0].sicherheitsgrenzen = ['bei Schmerz abbrechen'];
    const r = KI.ingest(n);
    return r.ok === true && r.rules[0].medicalSafetyRelevant === true &&
      r.rules[0].governance.medicalSafetyReviewStatus === 'required_unreviewed';
  })());
ok('  … und der Vertrag wählt sie in JEDEM Modus ab, solange die Freigabe fehlt',
  (() => {
    const n = NOTIZ(); n.regeln[0].medizinisch_heikel = true;
    n.regeln[0].sicherheitsgrenzen = ['bei Schmerz abbrechen'];
    const r = KI.ingest(n);
    r.rules[0].governance.technicalStatus = 'reviewed';
    const reg = { registryVersion: 1, sources: r.sources }; reg.contentHash = KC.registryContentHash(reg);
    const pack = { packId: 'gym', version: 1, knowledgeVersion: 'kb-gym-v1.0.0', sport: 'gym', rules: r.rules, contentHash: null };
    pack.contentHash = KC.packContentHash(pack);
    return ['advisory', 'shadow', 'production'].every(m => {
      const sel = KC.selectRules(pack, reg, { mode: m, sport: 'gym',
        expectedKnowledgeContractVersion: KC.KNOWLEDGE_CONTRACT_VERSION,
        expectedKnowledgeVersion: pack.knowledgeVersion,
        expectedPackContentHash: pack.contentHash,
        expectedSourceRegistryVersion: 1, expectedSourceRegistryHash: reg.contentHash });
      return sel.rules.length === 0 &&
        sel.excluded.some(x => x.code === 'medical_safety_review_pending');
    });
  })());

/* ══ N · Nichts halbes ══ */
sec('N · kein halbes Ergebnis');
ok('bei Fehlern wird NICHTS gebaut — auch die gültigen Teile nicht',
  (() => {
    const n = NOTIZ();
    n.regeln.push(Object.assign(REGEL(), { id: 'GYM-T-002' }));
    delete n.regeln[1].wenn_unsicher;
    const r = KI.ingest(n);
    return r.ok === false && r.sources.length === 0 && r.rules.length === 0;
  })());
ok('doppelte Kennungen werden erkannt (Quelle wie Regel)',
  (() => {
    const a = NOTIZ(); a.regeln.push(REGEL());
    const b = NOTIZ(); b.quellen = [QUELLE(), QUELLE()]; delete b.quelle;
    return KI.ingest(a).fehler.some(e => e.code === 'id_doppelt') &&
      KI.ingest(b).fehler.some(e => e.code === 'id_doppelt');
  })());
ok('eine Kennung in falscher Form wird abgewiesen',
  (() => { const n = NOTIZ(); n.quelle.id = 'meine quelle';
    return KI.ingest(n).fehler.some(e => e.code === 'id_form'); })());
ok('untaugliche Eingaben werfen nicht, sondern melden',
  [null, undefined, 'text', 42, [], { sport: 'gym' }].every(v => {
    let r; try { r = KI.ingest(v); } catch (e) { return false; }
    return r && r.ok === false && Array.isArray(r.fehler) && r.fehler.length > 0;
  }));

/* ══ R · Reinheit ══ */
sec('R · rein und deterministisch');
{
  const a = JSON.stringify(KI.ingest(NOTIZ()));
  const b = JSON.stringify(KI.ingest(NOTIZ()));
  ok('zweimal einspeisen ergibt exakt dasselbe', a === b);
  const n = NOTIZ(); const vorher = JSON.stringify(n);
  KI.ingest(n);
  ok('die Notiz wird dabei NICHT verändert', JSON.stringify(n) === vorher);
  const raw = readFileSync(join(APP, 'js/engine/knowledge/knowledge-ingest.js'), 'utf8');
  /* Präzise statt grob: verboten ist eine eigene ZEITQUELLE (Date.now, new
     Date ohne Argument) — nicht das Prüfen eines übergebenen Datums. Die erste
     Fassung dieses Tests verbot jedes `new Date` und schlug deshalb an einer
     reinen Kalenderprüfung an, die der Wissensvertrag selbst genauso macht. */
  ok('kein DOM, kein Storage, kein Netz, kein Dateizugriff',
    !/document\.|localStorage|sessionStorage|fetch\(|XMLHttpRequest|readFileSync|writeFileSync/.test(raw));
  ok('keine eigene Zeitquelle — ein übergebenes Datum darf geprüft werden, „jetzt" nicht gelesen',
    !/Date\.now|new Date\(\s*\)/.test(raw) && /new Date\(t\)/.test(raw));
}

/* ══ B · Die Beispieldatei muss funktionieren ══ */
sec('B · die mitgelieferte Beispieldatei');
{
  const p = join(APP, 'docs/wissen/BEISPIEL-gym.json');
  ok('sie existiert', existsSync(p));
  const bsp = JSON.parse(readFileSync(p, 'utf8'));
  const r = KI.ingest(bsp);
  ok('sie läuft ohne Fehler durch (sonst wäre die Vorlage eine Falle)',
    r.ok === true, KI.fehlerText(r.fehler));
  ok('  … und ihr Ergebnis besteht den echten Vertrag',
    (() => {
      const reg = { registryVersion: 1, sources: r.sources }; reg.contentHash = KC.registryContentHash(reg);
      const pack = { packId: 'gym', version: 1, knowledgeVersion: 'kb-gym-v1.0.0', sport: 'gym', rules: r.rules, contentHash: null };
      pack.contentHash = KC.packContentHash(pack);
      return KC.validateRegistry(reg).valid && KC.validatePack(pack, reg).valid;
    })());
  ok('  … sie erklärt das Urheberrecht ausdrücklich',
    /Urheberrecht/.test(JSON.stringify(bsp._hinweis)));
}

/* ══ C · Der Schreibweg darf kein bestehendes Paket löschen ══
   BEFUND aus dem ersten echten Einspeiseversuch (v8-338): `--schreiben`
   ersetzt `<sport>-knowledge-pack.js` VOLLSTÄNDIG. Für "running" existiert
   ein von Hand gepflegtes Paket mit 14 Regeln — eine Notizdatei mit zwei
   Regeln hätte es kommentarlos überschrieben. Kein Backup, kein Rückweg.

   ZWEITER BEFUND, aus diesem Test selbst: die erste Fassung spawnte das
   Werkzeug gegen das ECHTE Projekt. Solange der Schutz stand, war das
   harmlos. Sobald ihn die Mutationsprobe abschaltete, schrieb der Testlauf
   wirklich — und zerstörte genau die Datei, die er schützen sollte
   (34 KB / 14 Regeln → 7 KB / 2 Regeln). Die Sonde stellt die Quelldatei
   wieder her, die NEBENWIRKUNGEN des Tests kann sie nicht zurücknehmen.

   Deshalb läuft das Werkzeug hier in einem Wegwerf-Verzeichnis: eigene
   Kopie des Tools, eigene Modulkopien, ein künstliches Bestandspaket. Ein
   Testlauf darf das Projekt unter keinen Umständen verändern — auch nicht
   mit abgeschaltetem Schutz. */
sec('C · Überschreibschutz des Schreibwegs (in Wegwerf-Kopie)');
{
  const { spawnSync } = await import('node:child_process');
  const { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync, readdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');

  const T = mkdtempSync(join(tmpdir(), 'orvia-ingest-'));
  try {
    mkdirSync(join(T, 'tools'), { recursive: true });
    mkdirSync(join(T, 'js/engine/knowledge'), { recursive: true });
    mkdirSync(join(T, 'docs/wissen'), { recursive: true });
    copyFileSync(join(APP, 'tools/knowledge-ingest.mjs'), join(T, 'tools/knowledge-ingest.mjs'));
    for (const f of ['knowledge-ingest.js', 'knowledge-contracts.js'])
      copyFileSync(join(APP, 'js/engine/knowledge/' + f), join(T, 'js/engine/knowledge/' + f));
    /* Der Sportname ist bewusst einer, den es im Projekt nie geben wird.
       Erste Fassung nahm "gym" — und schlug fehl, sobald gym in v8-339 ein
       echtes Paket bekam: die Zusicherung „im echten Projekt entstand nichts"
       hätte dann eine legitime Datei angeklagt. Ein Testartefakt darf nie
       denselben Namen tragen wie echte Projektdaten. */
    const SPORT = 'testsport_wegwerf';
    const notizObj = JSON.parse(readFileSync(join(APP, 'docs/wissen/BEISPIEL-gym.json'), 'utf8'));
    notizObj.sport = SPORT;
    writeFileSync(join(T, 'docs/wissen/notiz.json'), JSON.stringify(notizObj), 'utf8');

    /* Ein künstliches Bestandspaket — inhaltlich egal, es geht nur darum,
       DASS eine Datei da ist und wie viele Regeln sie meldet. */
    const bestand = join(T, 'js/engine/knowledge/' + SPORT + '-knowledge-pack.js');
    writeFileSync(bestand, 'module.exports = { packId:"' + SPORT + '", rules:[1,2,3,4,5,6,7,8,9,10,11,12,13,14] };', 'utf8');
    const vorher = readFileSync(bestand, 'utf8');

    const lauf = (extra) => spawnSync(process.execPath,
      [join(T, 'tools/knowledge-ingest.mjs'), join(T, 'docs/wissen/notiz.json'),
       '--technisch-geprueft', 'Test'].concat(extra || []), { encoding: 'utf8' });

    const r = lauf(['--schreiben']);
    ok('der Lauf bricht ab statt zu schreiben (Exit 3)', r.status === 3, 'Exit ' + r.status);
    ok('  … das bestehende Paket ist Byte für Byte unverändert',
      readFileSync(bestand, 'utf8') === vorher);
    ok('  … der Text nennt die Regelzahl, die verloren ginge',
      /bisher: 14 Regel/.test(r.stdout || ''), (r.stdout || '').slice(-160));
    ok('  … und nennt den bewussten Ausweg', /--ueberschreiben/.test(r.stdout || ''));

    /* Gegenprobe 1: ohne --schreiben greift der Schutz nicht — sonst wäre
       schon das reine Prüfen blockiert und der Test bewiese nichts. */
    ok('  … beim reinen Prüfen greift der Schutz nicht', lauf([]).status === 0);

    /* Gegenprobe 2: mit --ueberschreiben MUSS geschrieben werden. Ohne diese
       Zusicherung könnte der Schutz alles blockieren und trotzdem grün sein. */
    const r3 = lauf(['--schreiben', '--ueberschreiben']);
    ok('  … mit --ueberschreiben wird tatsächlich geschrieben',
      r3.status === 0 && readFileSync(bestand, 'utf8') !== vorher, 'Exit ' + r3.status);

    /* Und die Kernzusicherung dieses Blocks: egal welcher Lauf — im echten
       Projekt darf nichts entstanden sein. */
    ok('  … kein Lauf hat im echten Projekt geschrieben',
      !existsSync(join(APP, 'js/engine/knowledge/' + SPORT + '-knowledge-pack.js')) &&
      !existsSync(join(APP, 'js/engine/knowledge/' + SPORT + '-knowledge-sources.js')));
  } finally {
    rmSync(T, { recursive: true, force: true });
  }
}

/* ══ D · Ein eingespeistes Paket muss auch geladen werden ══
   BEFUND aus dem ersten echten Schreiblauf (v8-339): `--schreiben` erzeugt
   die Moduldateien, verdrahtet sie aber nicht. Das Werkzeug sagt „noch zu
   tun", und danach prüft es niemand. Ein Paket, das in index.html fehlt,
   ist im Browser schlicht nicht da — und im Offline-Vorrat von sw.js fehlt
   es dann auch. Beides fällt nicht auf: alle Tests laufen über require(),
   nicht über die Seite. Genau das Muster aus v8-335 (eingespeist, aber
   niemand liest es), eine Ebene früher.

   Diese Prüfung gilt für JEDE künftige Sportart automatisch — sie liest das
   Verzeichnis, nicht eine gepflegte Liste. */
sec('D · jedes Wissensmodul ist eingebunden und offline verfügbar');
{
  const { readdirSync } = await import('node:fs');
  const dateien = readdirSync(join(APP, 'js/engine/knowledge'))
    .filter(f => /-knowledge-(pack|sources)\.js$/.test(f));
  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  /* Nur der Vorratsteil von sw.js zählt — der Kommentarkopf nennt Dateinamen
     erzählend, das wäre kein Beleg für Offline-Verfügbarkeit. */
  const vorrat = sw.slice(sw.indexOf('const ASSETS') >= 0 ? sw.indexOf('const ASSETS') : sw.length / 2);

  ok('es gibt überhaupt eingespeiste/gepflegte Wissensmodule', dateien.length > 0, dateien.join(','));
  ok('jedes ist in index.html eingebunden',
    dateien.every(f => html.includes('js/engine/knowledge/' + f)),
    dateien.filter(f => !html.includes('js/engine/knowledge/' + f)).join(',') || '—');
  ok('jedes liegt im Offline-Vorrat von sw.js',
    dateien.every(f => vorrat.includes('js/engine/knowledge/' + f)),
    dateien.filter(f => !vorrat.includes('js/engine/knowledge/' + f)).join(',') || '—');
  ok('  … und das Quellenregister steht VOR seinem Paket (Ladereihenfolge)',
    dateien.filter(f => /-knowledge-pack\.js$/.test(f)).every(pk => {
      const reg = pk.replace('-knowledge-pack.js', '-knowledge-sources.js');
      if (!dateien.includes(reg)) return true;          /* Paket nutzt das zentrale Register */
      return html.indexOf(reg) < html.indexOf(pk);
    }));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
