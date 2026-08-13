/* ============================================================
   ORVIA · Vertrag v7 — der Wert gehört zum Ziel (v8-347)

   BEFUND, der v7 ausgelöst hat: Eine Regel darf mehrere `outputs` nennen,
   trug aber genau EINE Zahl — und `knowledge-application` gab diese Zahl
   JEDEM Ziel der Regel. Bei einer Regel mit `session.sets` UND
   `session.repetitions` hätte derselbe Bereich für Sätze und Wiederholungen
   gegolten. Nur weil keine Regel im Bestand beides mit Zahl führte, ist es
   nie aufgefallen.

   Daraus folgten die beiden bekannten Grenzen: mehrdimensionale Dosis
   („vier bis fünf Serien zu drei bis vier Wiederholungen über sechs bis zehn
   Wochen") ließ sich nicht erfassen, und Aufzählungen — Übungen — schon gar
   nicht.

   v7 ändert zwei Dinge und lässt alles andere gleich:
     1. `appliesTo` bindet einen Claim an ein Ziel. Fehlt das Feld, gilt er
        für alle Ziele — das ist das Verhalten bis v6.
     2. `use: 'liste'` mit `selection` ist die neue Wertart, mit denselben
        Pflichtangaben und derselben Autorisierung wie eine Zahl.

   Geprüft wird durch die ECHTE Kette: Notiz → ingest → Vertrag → Anwendung
   → Verordnung.

   node supabase/tests/knowledge_v7_test.mjs
   ============================================================ */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = [_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
  .find(p => existsSync(join(p, 'js/engine/prescription-factory.js'))) || _flat;

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

globalThis.ORVIA = globalThis.ORVIA || {};
const KC = require(join(APP, 'js/engine/knowledge/knowledge-contracts.js'));
globalThis.ORVIA.knowledgeContracts = KC;
const KI = require(join(APP, 'js/engine/knowledge/knowledge-ingest.js'));
const KA = require(join(APP, 'js/engine/knowledge/knowledge-application.js'));
const PF = require(join(APP, 'js/engine/prescription-factory.js'));

/* ---- Werkzeug ---- */
const QUELLE = (id) => ({ id, art: 'uebersichtsarbeit', titel: 'Titel ' + id, wer: 'Urheber ' + id, jahr: 2020,
  url: 'https://example.org/' + id.toLowerCase(), sportarten: ['gym'], gilt_fuer: ['freizeitlaeufer'],
  worum_gehts: ['dosis'], qualitaet: 'hoch', kernaussage: 'Eigene Zusammenfassung zu ' + id + '.',
  grenzen: 'Keine Aussage außerhalb der genannten Gruppe.', eigene_worte: true, geprueft_am: '2026-08-13' });
const ZAHL = (ziel, min, max, einheit) => {
  const z = { eingabe_einheit: 'Trainingseinheit', ausgabe_einheit: einheit, bereich: { min, max },
    gilt_fuer: 'Freizeitsportler', so_steht_es_da: min + ' bis ' + max + ' ' + einheit, umrechnung: 'keine',
    unsicherheit: 'grobe Größenordnung', nicht_bei: ['akute Verletzung'],
    sicherheitsgrenzen: 'nie mehr als zwei harte Einheiten je Woche' };
  if (ziel) z.ziel = ziel;
  return z;
};
const AUSWAHL = (ziel, werte) => ({ ziel, werte, gilt_fuer: 'Freizeitläufer',
  so_steht_es_da: 'schwere Mehrgelenksübungen für die Beine',
  unsicherheit: 'Beispiele, keine abschließende Liste', nicht_bei: ['akute Verletzung'],
  sicherheitsgrenzen: 'keine Sprungbelastung bei akuten Beschwerden' });
const REGEL = (id, ziele, extra) => Object.assign({ id, thema: 'dosis', aussage: 'Vorgabe aus ' + id + '.',
  art: 'studie', quellen: ['SRC-A'], gilt_fuer: ['freizeitlaeufer'], nicht_fuer: [],
  unsicherheiten: ['Studienlage'], wenn_unsicher: 'Im Zweifel weniger.', wirkt_auf: ziele,
  beleg: 'Ergebnisabschnitt' }, extra || {});

function anwenden(regeln, opts) {
  opts = opts || {};
  const r = KI.ingest({ sport: 'gym', quelle: QUELLE('SRC-A'), regeln: regeln });
  if (!r.ok) return { fehler: KI.fehlerText ? KI.fehlerText(r.fehler) : JSON.stringify(r.fehler) };
  /* Standard: technisch geprüft. Mit {technischGeprueft:false} bleibt der
     Entwurfsstatus stehen — dann darf NICHTS vorschreiben, weder Zahl noch
     Liste. */
  r.rules.forEach(x => { x.governance.technicalStatus = (opts.technischGeprueft === false) ? 'draft' : 'reviewed'; });
  const registry = { registryVersion: 1, sources: r.sources };
  registry.contentHash = KC.registryContentHash(registry);
  const pack = { packId: 'gym', version: 1, knowledgeVersion: 'kb-gym-v9', sport: 'gym', rules: r.rules, contentHash: null };
  pack.contentHash = KC.packContentHash(pack);
  return { erg: KA.applyKnowledge({ pack, registry, sport: 'gym', contracts: KC, pins: {
    expectedKnowledgeContractVersion: KC.KNOWLEDGE_CONTRACT_VERSION, expectedKnowledgeVersion: pack.knowledgeVersion,
    expectedPackContentHash: pack.contentHash, expectedSourceRegistryVersion: 1,
    expectedSourceRegistryHash: registry.contentHash } }), rules: r.rules };
}
const vonZiel = (erg, ziel) => (erg.vorgaben || []).find(v => v.ziel === ziel) || null;

/* ══ V · Die Vertragsversion ══ */
sec('V · der Vertrag ist auf 7');
{
  ok('KNOWLEDGE_CONTRACT_VERSION === 7', KC.KNOWLEDGE_CONTRACT_VERSION === 7, String(KC.KNOWLEDGE_CONTRACT_VERSION));
  ok('„liste" ist eine zulässige Verwendungsart', (KC.CLAIM_USES || []).indexOf('liste') >= 0);
  ok('die Listenprüfung ist exportiert und streng',
    typeof KC.selectionSchemaValid === 'function' && typeof KC.prescriptiveListAllowed === 'function' &&
    KC.selectionSchemaValid({ use: 'liste', selection: { schemaVersion: 1, values: [] } }) === false,
    'leere Werteliste wird abgewiesen');
}

/* ══ Z · Der Wert gehört zum Ziel ══ */
sec('Z · eine Zahl landet nur an ihrem Ziel');
{
  const a = anwenden([REGEL('R-ZWEI', ['session.sets', 'session.repetitions'],
    { zahlen: [ZAHL('session.sets', 4, 5, 'Sätze'), ZAHL('session.repetitions', 3, 4, 'Wiederholungen')] })]);
  ok('zwei Größen in einer Regel ergeben zwei Vorgaben', !a.fehler && (a.erg.vorgaben || []).length === 2,
    a.fehler || JSON.stringify((a.erg.vorgaben || []).map(v => v.ziel)));
  const sets = vonZiel(a.erg, 'session.sets'), reps = vonZiel(a.erg, 'session.repetitions');
  ok('  … und jede trägt IHREN Wert, nicht den der anderen',
    !!sets && !!reps && sets.wert.min === 4 && sets.wert.max === 5 && reps.wert.min === 3 && reps.wert.max === 4,
    JSON.stringify([sets && sets.wert, reps && reps.wert]));
  ok('  … samt eigener Einheit',
    !!sets && !!reps && sets.einheit === 'Sätze' && reps.einheit === 'Wiederholungen',
    JSON.stringify([sets && sets.einheit, reps && reps.einheit]));

  /* Der Altfall bleibt, wie er war — sonst wäre v7 keine Erweiterung,
     sondern ein Bruch. */
  const b = anwenden([REGEL('R-ALT', ['session.sets', 'session.repetitions'],
    { zahlen: ZAHL(null, 4, 5, 'Sätze') })]);
  const bs = vonZiel(b.erg, 'session.sets'), br = vonZiel(b.erg, 'session.repetitions');
  ok('die alte Form (ein Zahlblock ohne Ziel) verhält sich UNVERÄNDERT',
    !b.fehler && !!bs && !!br && bs.wert.min === 4 && br.wert.min === 4,
    'beide Ziele bekommen den Wert — genau wie bis v6');

  /* Der Tippfehlerschutz, den es vorher nicht gab. */
  const c = anwenden([REGEL('R-TIPP', ['session.sets'], { zahlen: [ZAHL('session.tippfehler', 4, 5, 'Sätze')] })]);
  ok('eine Größe für ein Ziel, das die Regel nicht nennt, wird ABGEWIESEN',
    !!c.fehler && /zahlen_ziel_unbekannt|steht nicht in wirkt_auf/.test(c.fehler),
    (c.fehler || 'durchgelassen!').slice(0, 90));
  const d = anwenden([REGEL('R-OHNEZIEL', ['session.sets', 'session.repetitions'],
    { zahlen: [ZAHL(null, 4, 5, 'Sätze')] })]);
  ok('bei MEHREREN Größen ist das Ziel Pflicht', !!d.fehler && /zahlen_ziel_fehlt/.test(d.fehler),
    (d.fehler || 'durchgelassen!').slice(0, 90));
}

/* ══ L · Listen ══ */
sec('L · Aufzählungen sind ein Wert wie jeder andere');
{
  const a = anwenden([REGEL('R-LISTE', ['session.exercises'],
    { auswahl: [AUSWAHL('session.exercises', ['kniebeuge', 'ausfallschritt', 'wadenheben'])] })]);
  const v = a.fehler ? null : vonZiel(a.erg, 'session.exercises');
  ok('eine Auswahlliste wird zur Vorgabe', !!v && v.art === 'liste', a.fehler || (v ? v.art : 'keine Vorgabe'));
  ok('  … mit genau den Werten der Quelle, ohne Ergänzung',
    !!v && JSON.stringify(v.werte) === JSON.stringify(['kniebeuge', 'ausfallschritt', 'wadenheben']),
    v ? JSON.stringify(v.werte) : '—');
  ok('  … und mit Grenzen und Ausschlüssen',
    !!v && typeof v.grenzen === 'string' && v.grenzen.length > 10 && Array.isArray(v.nichtBei) && v.nichtBei.length > 0);

  const doppelt = anwenden([REGEL('R-DOPP', ['session.exercises'],
    { auswahl: [AUSWAHL('session.exercises', ['kniebeuge', 'kniebeuge'])] })]);
  ok('doppelte Einträge sind ein Erfassungsfehler, kein Inhalt',
    !!doppelt.fehler && /doppelt/.test(doppelt.fehler), (doppelt.fehler || 'durchgelassen!').slice(0, 80));

  /* Die Autorisierung gilt für Listen genauso wie für Zahlen. Ohne sie darf
     eine Aufzählung nicht vorschreiben — sonst wäre die neue Wertart ein
     Schlupfloch an der ganzen Evidenzprüfung vorbei. */
  const ungeprueft = anwenden([REGEL('R-DRAFT', ['session.exercises'],
    { auswahl: [AUSWAHL('session.exercises', ['kniebeuge', 'ausfallschritt'])] })], { technischGeprueft: false });
  const u = ungeprueft.fehler ? null : vonZiel(ungeprueft.erg, 'session.exercises');
  /* Gemessen: der Vertrag schliesst die Regel schon bei der AUSWAHL aus
     (technical_review_pending) — es entsteht gar keine Vorgabe. Das ist
     strenger als „Liste ohne Vorschreibrecht" und genau richtig; die
     Zusicherung haelt beides fest, damit eine spaetere Lockerung auffliegt. */
  ok('eine technisch UNGEPRÜFTE Regel schreibt keine Liste vor',
    u === null && (ungeprueft.erg.ausgeschlossen || []).some(x => x.ruleId === 'R-DRAFT'),
    u ? ('art=' + u.art + ' werte=' + JSON.stringify(u.werte || null))
      : 'keine Vorgabe, Regel ausgeschlossen: ' + JSON.stringify((ungeprueft.erg.ausgeschlossen || []).map(x => x.code)));
  /* Der zweite Riegel, getrennt geprüft: eine Regel, die die AUSWAHL besteht,
     aber als Notfallregel keine Vorschrift begründen darf. Sonst prüft der
     Test nur die Auswahlsperre und die Listen-Autorisierung bliebe ungedeckt
     — genau das hat Probe V7B gemeldet. */
  const notfall = anwenden([Object.assign(REGEL('R-NOTFALL', ['session.exercises'],
    { auswahl: [AUSWAHL('session.exercises', ['kniebeuge'])] }), { art: 'notfallregel', quellen: undefined })]);
  const nf = notfall.fehler ? null : vonZiel(notfall.erg, 'session.exercises');
  ok('eine Notfallregel liefert eine Empfehlung, aber KEINE vorschreibende Liste',
    !!nf && nf.art !== 'liste' && !Array.isArray(nf.werte),
    notfall.fehler || (nf ? ('art=' + nf.art) : 'keine Vorgabe'));

  ok('  … und die Verordnung übernimmt daraus keine Übungen',
    (() => { const p = PF.buildPrescription({ sportId: 'gym', sessionType: 'strength_general',
        durationMin: 60, priority: 'build', exercises: null, knowledge: ungeprueft.erg }, null);
      return p.ok === true && (p.flags || []).indexOf('no_exercise_list_generic_session') >= 0; })());

  /* Zwei verschiedene Listen gleicher Stärke: Widerspruch, keine Mischung. */
  const streit = anwenden([
    REGEL('R-L1', ['session.exercises'], { auswahl: [AUSWAHL('session.exercises', ['kniebeuge'])] }),
    REGEL('R-L2', ['session.exercises'], { auswahl: [AUSWAHL('session.exercises', ['beinpresse'])] })]);
  ok('zwei verschiedene Listen gleicher Klasse ergeben KEINE Vorgabe, sondern einen Konflikt',
    !streit.fehler && !vonZiel(streit.erg, 'session.exercises') && (streit.erg.konflikte || []).length === 1,
    'gemischt würde eine Liste entstehen, die keine Quelle nennt');
  const einig = anwenden([
    REGEL('R-L3', ['session.exercises'], { auswahl: [AUSWAHL('session.exercises', ['kniebeuge', 'ausfallschritt'])] }),
    REGEL('R-L4', ['session.exercises'], { auswahl: [AUSWAHL('session.exercises', ['ausfallschritt', 'kniebeuge'])] })]);
  const e = einig.fehler ? null : vonZiel(einig.erg, 'session.exercises');
  ok('  … dieselbe Liste in anderer Reihenfolge ist dagegen Bestätigung',
    !!e && Array.isArray(e.bestaetigtDurch) && e.bestaetigtDurch.length === 1,
    e ? JSON.stringify(e.bestaetigtDurch) : '—');
}

/* ══ K · Bis auf die Karte ══ */
sec('K · die Verordnung liest die Übungen');
{
  const a = anwenden([
    REGEL('R-EX', ['session.exercises'], { auswahl: [AUSWAHL('session.exercises', ['kniebeuge', 'ausfallschritt'])] }),
    REGEL('R-SETS', ['session.sets'], { zahlen: ZAHL(null, 4, 5, 'Serien') })]);
  const bau = (k) => PF.buildPrescription({ sportId: 'gym', sessionType: 'strength_general',
    durationMin: 60, priority: 'build', exercises: null, knowledge: k }, null);

  const mit = bau(a.erg);
  const namen = mit.ok ? (mit.workout.blocks || []).map(b => b.exercise_id) : [];
  ok('mit Wissen entstehen die Übungen der Quelle',
    mit.ok === true && JSON.stringify(namen) === JSON.stringify(['kniebeuge', 'ausfallschritt']),
    JSON.stringify(namen));
  ok('  … mit Herkunft im Flag',
    (mit.flags || []).some(f => f === 'exercises_aus_wissen:R-EX'), JSON.stringify(mit.flags));
  ok('  … und die Satzzahl kommt ebenfalls aus Wissen',
    (mit.flags || []).some(f => f === 'sets_aus_wissen:R-SETS') &&
    (mit.workout.blocks || []).every(b => b.sets === 4));

  const ohne = bau(null);
  ok('ohne Wissen bleibt alles wie bisher (generische Einheit, kein stiller Ersatz)',
    ohne.ok === true && (ohne.flags || []).indexOf('no_exercise_list_generic_session') >= 0 &&
    (ohne.workout.blocks || []).length === 1,
    JSON.stringify(ohne.flags));

  /* Übungen ohne Satzzahl dürfen NICHT durchgehen — Raten ist verboten. */
  const nurEx = anwenden([REGEL('R-EX2', ['session.exercises'],
    { auswahl: [AUSWAHL('session.exercises', ['kniebeuge'])] })]);
  const halb = bau(nurEx.erg);
  ok('Übungen ohne Satzzahl sperren die Verordnung, statt eine Zahl zu erfinden',
    halb.ok === false && halb.blocked === 'schema_invalid',
    'blocked=' + halb.blocked);

  ok('session.exercises steht jetzt im Zielregister',
    (PF.GELESENE_ZIELE || []).indexOf('session.exercises') >= 0);
}

/* ══ S · Überlappende Zahlbereiche (v8-348) ══ */
sec('S · die Schnittmenge ist keine Erfindung');
{
  const PAUSE = (min, max) => ({ eingabe_einheit: 'Trainingseinheit', ausgabe_einheit: 'Sekunden',
    bereich: { min, max }, gilt_fuer: 'Freizeitsportler', so_steht_es_da: min + ' bis ' + max + ' Sekunden',
    umrechnung: 'keine', unsicherheit: 'grobe Größenordnung', nicht_bei: [],
    sicherheitsgrenzen: 'nie mehr als 300 Sekunden' });
  const paar = (a, b) => anwenden([
    Object.assign(REGEL('R-P1', ['session.rest_seconds']), { zahlen: PAUSE(a[0], a[1]) }),
    Object.assign(REGEL('R-P2', ['session.rest_seconds']), { zahlen: PAUSE(b[0], b[1]) })]);

  const ueber = paar([120, 180], [150, 240]);
  const u = ueber.fehler ? null : vonZiel(ueber.erg, 'session.rest_seconds');
  ok('überlappende Bereiche werden auf die Schnittmenge eingeengt',
    !!u && u.wert.min === 150 && u.wert.max === 180 && (ueber.erg.konflikte || []).length === 0,
    u ? JSON.stringify(u.wert) : 'keine Vorgabe');
  ok('  … und die Herkunft nennt die URSPRÜNGLICHEN Bereiche, nicht den engen',
    !!u && Array.isArray(u.eingeengtAus) && u.eingeengtAus.length === 2 &&
    u.eingeengtAus[0].wert.min === 120 && u.eingeengtAus[0].wert.max === 180,
    u ? JSON.stringify(u.eingeengtAus.map(x => x.wert)) : '—');

  const disjunkt = paar([120, 140], [200, 240]);
  ok('Bereiche OHNE Überschneidung bleiben ein Konflikt ohne Vorgabe',
    !vonZiel(disjunkt.erg, 'session.rest_seconds') && (disjunkt.erg.konflikte || []).length === 1,
    'aus 3 und 5 Sätzen wird weiterhin nicht 4');

  const beruehrt = paar([120, 150], [150, 240]);
  const b2 = beruehrt.fehler ? null : vonZiel(beruehrt.erg, 'session.rest_seconds');
  ok('  … Bereiche, die sich nur berühren, ergeben genau diesen einen Wert',
    !!b2 && b2.wert.min === 150 && b2.wert.max === 150, b2 ? JSON.stringify(b2.wert) : '—');

  const drei = anwenden([
    Object.assign(REGEL('R-D1', ['session.rest_seconds']), { zahlen: PAUSE(120, 200) }),
    Object.assign(REGEL('R-D2', ['session.rest_seconds']), { zahlen: PAUSE(150, 240) }),
    Object.assign(REGEL('R-D3', ['session.rest_seconds']), { zahlen: PAUSE(160, 180) })]);
  const d3 = drei.fehler ? null : vonZiel(drei.erg, 'session.rest_seconds');
  ok('  … bei drei Quellen zählt der engste gemeinsame Bereich',
    !!d3 && d3.wert.min === 160 && d3.wert.max === 180, d3 ? JSON.stringify(d3.wert) : '—');

  /* Listen bleiben ausgenommen — eine leere Schnittmenge wäre ein stiller
     Ausfall, keine Aussage. */
  const listen = anwenden([
    Object.assign(REGEL('R-LA', ['session.exercises']), { auswahl: [AUSWAHL('session.exercises', ['kniebeuge'])] }),
    Object.assign(REGEL('R-LB', ['session.exercises']), { auswahl: [AUSWAHL('session.exercises', ['beinpresse'])] })]);
  ok('bei Auswahllisten wird NICHT geschnitten (leere Liste wäre keine Aussage)',
    !vonZiel(listen.erg, 'session.exercises') && (listen.erg.konflikte || []).length === 1);
}

/* ══ W · session.repetitions (v8-348) ══ */
sec('W · Wiederholungen aus Wissen');
{
  const a = anwenden([
    Object.assign(REGEL('R-EXW', ['session.exercises']), { auswahl: [AUSWAHL('session.exercises', ['kniebeuge'])] }),
    Object.assign(REGEL('R-SETW', ['session.sets']), { zahlen: ZAHL(null, 4, 5, 'Serien') }),
    Object.assign(REGEL('R-REPW', ['session.repetitions']), { zahlen: ZAHL(null, 3, 4, 'Wiederholungen') })]);
  const p = PF.buildPrescription({ sportId: 'gym', sessionType: 'strength_general',
    durationMin: 60, priority: 'build', exercises: null, knowledge: a.erg }, null);
  ok('die Wiederholungszahl kommt aus Wissen, mit Herkunft',
    p.ok === true && (p.flags || []).some(f => f === 'reps_aus_wissen:R-REPW') &&
    (p.workout.blocks || []).every(b => b.repetitions === 3),
    JSON.stringify((p.workout && p.workout.blocks || []).map(b => b.repetitions)));
  ok('  … und session.repetitions steht im Zielregister',
    (PF.GELESENE_ZIELE || []).indexOf('session.repetitions') >= 0);
}

console.log('\n' + '═'.repeat(62));
console.log('Ergebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
