/* ORVIA · v8-335 — aus eingespeistem Wissen wird eine Vorgabe.

   BEFUND, der zu diesem Modul führte: nach v8-334 ließ sich Wissen einspeisen
   und der Vertrag wählte es korrekt aus — nur LAS es niemand. Der einzige
   Consumer im Projekt ist fest auf das Running-Pack im Shadow-Modus gepinnt.
   Ein eingespeistes Gym-Pack hätte am Verhalten der App nichts geändert; das
   Einspeisen wäre ein Ritual ohne Wirkung geblieben.

   Die härteste Zusage dieses Moduls ist NICHT „es erzeugt Vorgaben", sondern:
   es GLÄTTET KEINEN WIDERSPRUCH. Sagen zwei gleich stark belegte Quellen
   etwas Unterschiedliches, entsteht KEINE Vorgabe. Heimlich zu mitteln wäre
   die bequemste und zugleich falscheste Lösung — aus „Coach A sagt 3 Sätze,
   Coach B sagt 5" würde „4 Sätze", eine Zahl, die niemand gesagt hat.

   Geprüft wird durch die ECHTE Kette: Notiz → ingest → Vertrag → Anwendung.

   node supabase/tests/knowledge_application_test.mjs */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = [_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
  .find(p => existsSync(join(p, 'js/engine/knowledge/knowledge-application.js'))) || _flat;

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

globalThis.ORVIA = globalThis.ORVIA || {};
const KC = require(join(APP, 'js/engine/knowledge/knowledge-contracts.js'));
globalThis.ORVIA.knowledgeContracts = KC;
const KI = require(join(APP, 'js/engine/knowledge/knowledge-ingest.js'));
const KA = require(join(APP, 'js/engine/knowledge/knowledge-application.js'));

/* ---- Werkzeug: aus einer Notiz ein einsatzbereites Paket bauen ---- */
const ZAHLEN = (min, max) => ({
  eingabe_einheit: 'Trainingseinheit', ausgabe_einheit: 'harte Sätze',
  bereich: { min: min, max: max }, gilt_fuer: 'Freizeitläufer',
  so_steht_es_da: min + ' bis ' + max + ' Sätze', umrechnung: 'keine',
  unsicherheit: 'grobe Größenordnung', nicht_bei: ['akute Verletzung'],
  sicherheitsgrenzen: 'nie mehr als zwei harte Beineinheiten je Woche'
});
const QUELLE = (id, art) => ({
  id: id, art: art || 'coachvideo', titel: 'Titel ' + id, wer: 'Urheber ' + id, jahr: 2025,
  url: 'https://example.org/' + id.toLowerCase(),
  sportarten: ['gym'], gilt_fuer: ['freizeitlaeufer'], worum_gehts: ['satzzahl'],
  qualitaet: art === 'uebersichtsarbeit' ? 'hoch' : 'mittel',
  kernaussage: 'Eigene Zusammenfassung zu ' + id + '.',
  grenzen: 'Keine Aussage außerhalb der genannten Gruppe.',
  eigene_worte: true, geprueft_am: '2026-08-13'
});
const REGEL = (id, quelle, zahlen, ziel, rolle) => ({
  id: id, thema: 'satzzahl', aussage: 'Vorgabe aus ' + id + '.',
  art: rolle || 'coachkonsens', quellen: [quelle],
  gilt_fuer: ['freizeitlaeufer'], nicht_fuer: [],
  unsicherheiten: ['Erfahrungswissen'], wenn_unsicher: 'Im Zweifel weniger.',
  wirkt_auf: [ziel || 'session.sets'],
  beleg: 'Ergebnisabschnitt',
  ...(zahlen ? { zahlen: zahlen } : {})
});

function paket(notiz, opts) {
  opts = opts || {};
  const r = KI.ingest(notiz);
  if (!r.ok) throw new Error('Notiz unbrauchbar: ' + KI.fehlerText(r.fehler));
  if (opts.technischGeprueft !== false) r.rules.forEach(x => { x.governance.technicalStatus = 'reviewed'; });
  const registry = { registryVersion: 1, sources: r.sources };
  registry.contentHash = KC.registryContentHash(registry);
  const pack = { packId: 'gym', version: 1, knowledgeVersion: 'kb-gym-v1.0.0',
    sport: 'gym', rules: r.rules, contentHash: null };
  pack.contentHash = KC.packContentHash(pack);
  const pins = {
    expectedKnowledgeContractVersion: KC.KNOWLEDGE_CONTRACT_VERSION,
    expectedKnowledgeVersion: pack.knowledgeVersion,
    expectedPackContentHash: pack.contentHash,
    expectedSourceRegistryVersion: registry.registryVersion,
    expectedSourceRegistryHash: registry.contentHash
  };
  return { pack, registry, pins };
}
const anwenden = (p, over) => KA.applyKnowledge(Object.assign(
  { pack: p.pack, registry: p.registry, pins: p.pins, sport: 'gym', contracts: KC }, over || {}));

/* ══ K · Die Kette funktioniert ══ */
sec('K · Notiz → Vertrag → Vorgabe');
{
  const p = paket({ sport: 'gym', quelle: QUELLE('SRC-A'),
    regeln: [REGEL('GYM-A-001', 'SRC-A', ZAHLEN(2, 4))] });
  const r = anwenden(p);
  ok('die Anwendung gelingt', r.ok === true, r.grund || '');
  ok('es entsteht genau eine Vorgabe für das genannte Ziel',
    r.vorgaben.length === 1 && r.vorgaben[0].ziel === 'session.sets');
  const v = r.vorgaben[0];
  ok('sie trägt den Wertebereich aus der Quelle — unverändert',
    v.art === 'zahl' && v.wert.min === 2 && v.wert.max === 4 && v.einheit === 'harte Sätze');
  ok('sie trägt ihre HERKUNFT mit (der Vertrag schreibt das vor)',
    v.herkunft && v.herkunft.mustDisplaySource === true &&
    v.herkunft.evidenceClass === 'C' && v.herkunft.basisLabel === 'Fach-/Coachkonsens');
  ok('sie trägt Sicherheitsgrenze, Ausschlüsse und den vorsichtigen Weg',
    typeof v.grenzen === 'string' && v.grenzen.length > 10 &&
    v.nichtBei.indexOf('akute Verletzung') >= 0 &&
    typeof v.wennUnsicher === 'string' && v.wennUnsicher.length > 5);
  ok('der Satz für die Anzeige nennt Wert UND Herkunft — untrennbar',
    /2–4 harte Sätze/.test(KA.vorgabeText(v)) && /Coachkonsens/.test(KA.vorgabeText(v)) &&
    /Klasse C/.test(KA.vorgabeText(v)), KA.vorgabeText(v));
}

/* ══ W · Widerspruch wird NICHT geglättet ══ */
sec('W · zwei Quellen, zwei Zahlen');
{
  const p = paket({ sport: 'gym', quellen: [QUELLE('SRC-A'), QUELLE('SRC-B')],
    regeln: [REGEL('GYM-A-001', 'SRC-A', ZAHLEN(3, 3)),
      REGEL('GYM-B-001', 'SRC-B', ZAHLEN(5, 5))] });
  const r = anwenden(p);
  ok('zwei gleich stark belegte Regeln zum selben Ziel ⇒ KEINE Vorgabe',
    r.ok === true && r.vorgaben.length === 0);
  ok('  … stattdessen ein benannter Konflikt mit beiden Regeln',
    r.konflikte.length === 1 && r.konflikte[0].ziel === 'session.sets' &&
    r.konflikte[0].regeln.sort().join(',') === 'GYM-A-001,GYM-B-001');
  ok('  … und NIRGENDS taucht ein gemittelter Wert auf (weder 4 noch 3–5)',
    JSON.stringify(r.vorgaben) === '[]' &&
    !/[^0-9]4[^0-9]/.test(JSON.stringify(r.konflikte).replace(/GYM-[AB]-00\d/g, '')));
  /* v8-341: der Zugriff war ungeschützt. Fiel `konflikte` bei einer Mutation
     leer aus, warf diese Zeile — und ALLE folgenden Blöcke der Datei liefen
     nicht mehr. Die Mutationssonde schrieb den Ausfall dann den Tests
     zu, die noch gelaufen waren, statt denen, die es hätten fangen sollen.
     Ein Test, der beim Fehlschlag die Datei abbricht, versteckt genau das,
     wofür er da ist. */
  ok('  … der Konflikt sagt, was zu tun ist',
    !!(r.konflikte[0] && /entscheide|ergänze/i.test(r.konflikte[0].hinweis)),
    r.konflikte.length ? '' : 'kein Konflikt gemeldet');
}
{
  /* Die EINZIGE zulässige Auflösung: eine nachweislich bessere Klasse. */
  const p = paket({ sport: 'gym',
    quellen: [QUELLE('SRC-COACH'), QUELLE('SRC-META', 'uebersichtsarbeit')],
    regeln: [REGEL('GYM-COACH-001', 'SRC-COACH', ZAHLEN(3, 3)),
      REGEL('GYM-META-001', 'SRC-META', ZAHLEN(5, 6), 'session.sets', 'studie')] });
  const r = anwenden(p);
  ok('eine besser belegte Quelle überstimmt die schwächere',
    r.ok === true && r.vorgaben.length === 1 && r.vorgaben[0].regelId === 'GYM-META-001' &&
    r.konflikte.length === 0, JSON.stringify(r.vorgaben.map(v => v.regelId)));
  ok('  … das Überstimmen wird PROTOKOLLIERT, nicht verschwiegen',
    Array.isArray(r.vorgaben[0].ueberstimmt) &&
    r.vorgaben[0].ueberstimmt.indexOf('GYM-COACH-001') >= 0);
  ok('  … und die durchgesetzte Vorgabe trägt die höhere Klasse',
    ['A', 'B'].indexOf(r.vorgaben[0].herkunft.evidenceClass) >= 0,
    r.vorgaben[0].herkunft.evidenceClass);
}
{
  /* Verschiedene Ziele sind kein Konflikt. */
  const p = paket({ sport: 'gym', quellen: [QUELLE('SRC-A'), QUELLE('SRC-B')],
    regeln: [REGEL('GYM-A-001', 'SRC-A', ZAHLEN(3, 3), 'session.sets'),
      REGEL('GYM-B-001', 'SRC-B', ZAHLEN(90, 180), 'session.rest_seconds')] });
  const r = anwenden(p);
  ok('zwei Regeln zu VERSCHIEDENEN Zielen ergeben zwei Vorgaben, keinen Konflikt',
    r.vorgaben.length === 2 && r.konflikte.length === 0 &&
    r.vorgaben.map(v => v.ziel).sort().join(',') === 'session.rest_seconds,session.sets');
}

/* ══ Z · Keine erfundene Zahl ══ */
sec('Z · eine Zahl entsteht nie aus dem Nichts');
{
  const p = paket({ sport: 'gym', quelle: QUELLE('SRC-A'),
    regeln: [REGEL('GYM-A-001', 'SRC-A', null)] });
  const r = anwenden(p);
  ok('eine Regel ohne Zahlenangabe liefert eine Empfehlung, aber keinen Wert',
    r.vorgaben.length === 1 && r.vorgaben[0].art === 'empfehlung' &&
    r.vorgaben[0].wert === null);
  ok('  … und der Anzeigesatz nennt die Aussage statt einer Zahl',
    /Vorgabe aus GYM-A-001/.test(KA.vorgabeText(r.vorgaben[0])) &&
    !/\d+–\d+/.test(KA.vorgabeText(r.vorgaben[0])));
}
{
  /* Technisch UNGEPRÜFT: der Vertrag lässt die Regel gar nicht erst durch. */
  const p = paket({ sport: 'gym', quelle: QUELLE('SRC-A'),
    regeln: [REGEL('GYM-A-001', 'SRC-A', ZAHLEN(2, 4))] }, { technischGeprueft: false });
  const r = anwenden(p);
  ok('technisch ungeprüftes Wissen erzeugt KEINE Vorgabe',
    r.ok === true && r.vorgaben.length === 0);
  ok('  … und der Grund bleibt sichtbar, statt als leeres Ergebnis zu erscheinen',
    r.ausgeschlossen.some(x => x.code === 'technical_review_pending'));
}
{
  /* Der Fall, den die Probe V4 aufgedeckt hat: eine Regel, die der Vertrag
     DURCHLÄSST, deren Zahl er aber NICHT freigibt. Eine Notfallregel wird
     ausgewählt — sie darf aber nie eine Zahl vorschreiben, sonst würde die
     vorsichtige Rückfallebene zur Vorgabe. Alle vorherigen Fälle wurden schon
     vom Vertrag aussortiert und erreichten die Zahlenprüfung gar nicht. */
  const p = paket({ sport: 'gym', quelle: QUELLE('SRC-A'),
    regeln: [REGEL('GYM-FB-001', 'SRC-A', ZAHLEN(2, 4), 'session.sets', 'notfallregel')] });
  const r = anwenden(p);
  ok('eine Notfallregel wird ausgewählt, gibt aber KEINE Zahl vor',
    r.ok === true && r.vorgaben.length === 1 &&
    r.vorgaben[0].art === 'empfehlung' && r.vorgaben[0].wert === null,
    JSON.stringify(r.vorgaben.map(v => v.art)));
  ok('  … und dass eine Zahl DA WAR, aber gesperrt ist, bleibt sichtbar',
    r.vorgaben[0].zahlGesperrt === true);
  ok('  … sonst sähe es aus, als hätte die Quelle nie eine Zahl genannt',
    r.geprueft === 1);
}
{
  /* Medizinisch heikel: in JEDEM Modus gesperrt — dieses Modul hebt das nicht auf. */
  const notiz = { sport: 'gym', quelle: QUELLE('SRC-A'),
    regeln: [Object.assign(REGEL('GYM-MED-001', 'SRC-A', ZAHLEN(2, 4)),
      { medizinisch_heikel: true, sicherheitsgrenzen: ['bei Schmerz abbrechen'] })] };
  const p = paket(notiz);
  const r = anwenden(p);
  ok('eine medizinisch heikle Regel erzeugt keine Vorgabe, solange die Freigabe fehlt',
    r.vorgaben.length === 0 &&
    r.ausgeschlossen.some(x => x.code === 'medical_safety_review_pending'));
}

/* ══ F · Fail-closed ══ */
sec('F · ohne Pins, ohne Vertrag, ohne Eingabe passiert nichts');
{
  const p = paket({ sport: 'gym', quelle: QUELLE('SRC-A'),
    regeln: [REGEL('GYM-A-001', 'SRC-A', ZAHLEN(2, 4))] });
  ok('ein fehlender Pin blockiert — die Blockade wird unverändert durchgereicht',
    ['expectedPackContentHash', 'expectedSourceRegistryHash', 'expectedKnowledgeVersion'].every(k => {
      const pins = Object.assign({}, p.pins); delete pins[k];
      const r = anwenden(p, { pins: pins });
      return r.ok === false && r.grund === 'auswahl_blockiert' && r.vorgaben.length === 0;
    }));
  ok('ein verändertes Paket bei altem Pin blockiert ebenfalls',
    (() => {
      const pack = JSON.parse(JSON.stringify(p.pack));
      pack.rules[0].statement = 'heimlich geändert';
      const r = anwenden(p, { pack: pack });
      return r.ok === false && r.vorgaben.length === 0;
    })());
  /* Der Fall „Vertrag fehlt" lässt sich nur prüfen, wenn auch der globale
     Rückfall leer ist — sonst greift O.knowledgeContracts und der Test misst
     nichts. Die erste Fassung dieser Zeile lautete `… && true` und war damit
     immer wahr: ein grüner Test ohne jede Aussage. */
  ok('ohne Vertrag wird gemeldet statt gerechnet',
    (() => {
      const sicher = globalThis.ORVIA.knowledgeContracts;
      globalThis.ORVIA.knowledgeContracts = null;
      let r;
      try { r = KA.applyKnowledge({ pack: p.pack, registry: p.registry, pins: p.pins, contracts: null }); }
      finally { globalThis.ORVIA.knowledgeContracts = sicher; }
      return r && r.ok === false && r.grund === 'vertrag_fehlt' && r.vorgaben.length === 0;
    })());
  ok('  … und ein Vertrag ohne selectRules zählt als fehlender Vertrag',
    (() => {
      const r = KA.applyKnowledge({ pack: p.pack, registry: p.registry, pins: p.pins,
        contracts: { keineAuswahl: true } });
      return r.ok === false && r.grund === 'vertrag_fehlt';
    })());
  ok('untaugliche Eingaben werfen nicht, sondern melden',
    [null, undefined, 'text', 42, [], {}].every(v => {
      let r; try { r = KA.applyKnowledge(v); } catch (e) { return false; }
      return r && r.ok === false && Array.isArray(r.vorgaben) && r.vorgaben.length === 0;
    }));
  ok('ein Selektor, der wirft, führt nicht zum Absturz',
    (() => {
      const r = anwenden(p, { contracts: Object.assign({}, KC, {
        selectRules: () => { throw new Error('kaputt'); } }) });
      return r.ok === false && r.grund === 'auswahl_warf';
    })());
}

/* ══ E · Ehrlichkeit über das, was fehlt ══ */
sec('E · was aussortiert wurde, bleibt sichtbar');
{
  const notiz = { sport: 'gym', quellen: [QUELLE('SRC-A'), QUELLE('SRC-B')],
    regeln: [REGEL('GYM-A-001', 'SRC-A', ZAHLEN(2, 4)),
      Object.assign(REGEL('GYM-MED-001', 'SRC-B', ZAHLEN(2, 4)),
        { medizinisch_heikel: true, sicherheitsgrenzen: ['bei Schmerz abbrechen'] })] };
  const p = paket(notiz);
  const r = anwenden(p);
  ok('eine gültige und eine gesperrte Regel: die gültige wirkt, die gesperrte wird genannt',
    r.vorgaben.length === 1 && r.vorgaben[0].regelId === 'GYM-A-001' &&
    r.ausgeschlossen.some(x => x.ruleId === 'GYM-MED-001'));
  ok('die Zahl der geprüften Regeln wird mitgeliefert (eine halbe Wissensbasis sieht sonst voll aus)',
    r.geprueft === 1);
}

/* ══ R · Reinheit ══ */
sec('R · rein und deterministisch');
{
  const p = paket({ sport: 'gym', quelle: QUELLE('SRC-A'),
    regeln: [REGEL('GYM-A-001', 'SRC-A', ZAHLEN(2, 4))] });
  const vorher = JSON.stringify(p.pack);
  const a = JSON.stringify(anwenden(p));
  const b = JSON.stringify(anwenden(p));
  ok('zweimal anwenden ergibt exakt dasselbe', a === b);
  ok('das Paket wird dabei NICHT verändert', JSON.stringify(p.pack) === vorher);
  const raw = readFileSync(join(APP, 'js/engine/knowledge/knowledge-application.js'), 'utf8');
  ok('kein DOM, kein Storage, kein Netz, keine eigene Zeitquelle, kein Dateizugriff',
    !/document\.|localStorage|sessionStorage|fetch\(|XMLHttpRequest|Date\.now|new Date\(\s*\)|readFileSync/.test(raw));
  ok('das Modul liefert DATEN, kein HTML',
    !/<div|<span|innerHTML/.test(raw));
}

/* ══ B · Am mitgelieferten Beispiel ══ */
sec('B · die Vorlage ergibt echte Vorgaben');
{
  const bsp = JSON.parse(readFileSync(join(APP, 'docs/wissen/BEISPIEL-gym.json'), 'utf8'));
  const p = paket(bsp);
  const r = anwenden(p);
  ok('die Beispielnotiz erzeugt Vorgaben für beide Ziele',
    r.ok === true && r.vorgaben.length === 2 && r.konflikte.length === 0,
    r.vorgaben.map(v => v.ziel).join(','));
  const sets = r.vorgaben.find(v => v.ziel === 'session.exercises');
  ok('  … die Satzvorgabe steht als 2–4 mit Coachkonsens-Herkunft da',
    sets && sets.art === 'zahl' && sets.wert.min === 2 && sets.wert.max === 4 &&
    sets.herkunft.evidenceClass === 'C', KA.vorgabeText(sets));
  ok('  … und die Pausenregel bleibt qualitativ (sie nennt keine Zahl)',
    r.vorgaben.find(v => v.ziel === 'session.rest_seconds').art === 'empfehlung');
}

/* ══ M · Mehrere Pakete gleichzeitig ══
   BEFUND (v8-340), gefunden beim Versuch, Sperlich 2015 zu Laufen
   hinzuzufügen: applyKnowledge nahm genau EIN Paket. Damit war die
   Einspeisekette faktisch einmal pro Sportart benutzbar — wer eine zweite
   Quelle einspeiste, musste das bestehende Paket mit vierzehn handgepflegten
   Regeln ERSETZEN (der Schreibweg kennt nur das) oder die neuen Regeln
   liegen lassen.

   Der Ausweg ist bewusst NICHT, Pakete zusammenzuschreiben. Jedes läuft
   einzeln durch den Vertrag, mit seinen EIGENEN Pins und seinem EIGENEN
   Register; erst die ausgewählten Regeln treffen sich. */
sec('M · mehrere Pakete');
{
  const a = paket({ sport: 'gym', quelle: QUELLE('SRC-A'),
    regeln: [REGEL('GYM-A-001', 'SRC-A', ZAHLEN(2, 4), 'session.sets')] });
  const b = paket({ sport: 'gym', quelle: QUELLE('SRC-B'),
    regeln: [REGEL('GYM-B-001', 'SRC-B', null, 'session.rest_seconds')] });

  const beide = KA.applyKnowledge({ packs: [
    { pack: a.pack, registry: a.registry, pins: a.pins, sport: 'gym' },
    { pack: b.pack, registry: b.registry, pins: b.pins, sport: 'gym' }] });
  ok('Regeln aus BEIDEN Paketen erreichen die Anwendung',
    beide.ok === true && beide.geprueft === 2 &&
    beide.vorgaben.some(v => v.regelId === 'GYM-A-001') &&
    beide.vorgaben.some(v => v.regelId === 'GYM-B-001'),
    JSON.stringify(beide.vorgaben.map(v => v.regelId)));

  /* Der Kern der Trennung: JEDES Paket wird gegen SEINE Pins geprüft.
     Würden die Pins des ersten auch auf das zweite angewandt, blockierte
     das zweite grundlos — und die Mehrpaket-Fähigkeit wäre wertlos. */
  ok('  … jedes Paket wird gegen seine EIGENEN Pins geprüft, nicht gegen fremde',
    a.pins.expectedPackContentHash !== b.pins.expectedPackContentHash &&
    beide.vorgaben.length === 2);

  /* Ein defektes Paket darf die übrigen nicht stumm schalten — sonst genügte
     eine falsch gepinnte Datei, um die ganze Wissensbasis abzuschalten. */
  const kaputt = Object.assign({}, b.pins, { expectedPackContentHash: 'fnv1a-deadbeef' });
  const halb = KA.applyKnowledge({ packs: [
    { pack: a.pack, registry: a.registry, pins: a.pins, sport: 'gym' },
    { pack: b.pack, registry: b.registry, pins: kaputt, sport: 'gym' }] });
  ok('  … ein blockiertes Paket reißt die übrigen NICHT mit',
    halb.ok === true && halb.vorgaben.some(v => v.regelId === 'GYM-A-001') &&
    !halb.vorgaben.some(v => v.regelId === 'GYM-B-001'));
  ok('  … und es verschwindet nicht still, sondern wird benannt',
    Array.isArray(halb.blockiertePakete) && halb.blockiertePakete.length === 1 &&
    halb.blockiertePakete[0].index === 1,
    JSON.stringify(halb.blockiertePakete));

  /* Sind ALLE blockiert, ist das kein Teilergebnis. Ein "ok" mit leerer Liste
     läse sich als „es gibt nichts zu sagen" statt „nichts war prüfbar". */
  const alleKaputt = KA.applyKnowledge({ packs: [
    { pack: a.pack, registry: a.registry, pins: Object.assign({}, a.pins, { expectedPackContentHash: 'fnv1a-0' }), sport: 'gym' },
    { pack: b.pack, registry: b.registry, pins: kaputt, sport: 'gym' }] });
  ok('  … sind ALLE Pakete blockiert, ist das ein Fehlschlag, kein leeres ok',
    alleKaputt.ok === false && alleKaputt.grund === 'alle_pakete_blockiert',
    alleKaputt.grund);

  ok('  … eine leere Paketliste ist ein Aufruffehler, keine leere Wissensbasis',
    (() => { const r = KA.applyKnowledge({ packs: [] });
      return r.ok === false && r.grund === 'keine_pakete'; })());

  /* Rückwärtskompatibilität: der alte Einzelaufruf muss Zeichen für Zeichen
     dasselbe liefern wie die Einerliste. Sonst hätte ich still das Verhalten
     aller bestehenden Aufrufer geändert. */
  const alt = KA.applyKnowledge({ pack: a.pack, registry: a.registry, pins: a.pins, sport: 'gym' });
  const neu = KA.applyKnowledge({ packs: [{ pack: a.pack, registry: a.registry, pins: a.pins, sport: 'gym' }] });
  ok('  … der Einzelaufruf liefert unverändert dasselbe wie die Einerliste',
    JSON.stringify(alt) === JSON.stringify(neu), JSON.stringify(alt).slice(0, 120));

  /* Und bei genau einem Paket bleibt der GRUND erhalten statt zu einem
     generischen Sammelfehler zu werden. */
  const einsKaputt = KA.applyKnowledge({ pack: b.pack, registry: b.registry, pins: kaputt, sport: 'gym' });
  ok('  … ein einzelnes defektes Paket meldet weiterhin seinen eigenen Grund',
    einsKaputt.ok === false && einsKaputt.grund === 'auswahl_blockiert', einsKaputt.grund);
}

/* ══ K · Was "Widerspruch" heißt ══
   BEFUND (v8-341): die Konfliktregel setzte „spricht zum selben Ziel" mit
   „sagt etwas Unvereinbares" gleich. Am ersten echten Wissensbestand hieß
   das: RUN-RE-001 („Krafttraining verbessert die Laufökonomie") und
   RUN-RE-002 („Kraftausdauertraining bewirkt nichts") — beide Klasse B,
   beide auf session.exercises, beide aus DERSELBEN Quelle — schalteten
   einander stumm. Ergebnis: keine Vorgabe.

   Unvereinbar können nur WERTE sein. Zwei Beschreibungen sind es nicht.

   Die Zusicherung, die dabei NICHT fallen darf, steht in Block V: zwei
   verschiedene ZAHLEN gleicher Klasse ergeben weiterhin keine Vorgabe. */
sec('K · Konflikt nur dort, wo sich Werte ausschließen');
{
  const zwei = (a, b) => {
    const n = { sport: 'gym', quelle: QUELLE('SRC-K'), regeln: [a, b] };
    const p = paket(n);
    return KA.applyKnowledge({ pack: p.pack, registry: p.registry, pins: p.pins, sport: 'gym' });
  };

  /* (1) Zwei qualitative Regeln zum selben Ziel — ergänzen sich. */
  const q = zwei(REGEL('GYM-Q-001', 'SRC-K', null, 'session.exercises'),
                 REGEL('GYM-Q-002', 'SRC-K', null, 'session.exercises'));
  ok('zwei qualitative Regeln zum selben Ziel stehen NEBENEINANDER',
    q.ok === true && q.konflikte.length === 0 &&
    q.vorgaben.filter(v => v.ziel === 'session.exercises').length === 2,
    JSON.stringify(q.vorgaben.map(v => v.regelId)) + ' Konflikte=' + q.konflikte.length);

  /* (2) Qualitativ + quantitativ — die Zahl entscheidet, der Satz bleibt. */
  const gm = zwei(REGEL('GYM-M-001', 'SRC-K', ZAHLEN(2, 4), 'session.sets'),
                  REGEL('GYM-M-002', 'SRC-K', null, 'session.sets'));
  ok('  … eine qualitative Regel blockiert keine Zahl zum selben Ziel',
    gm.konflikte.length === 0 &&
    gm.vorgaben.some(v => v.art === 'zahl' && v.wert.min === 2) &&
    gm.vorgaben.some(v => v.art !== 'zahl'),
    JSON.stringify(gm.vorgaben.map(v => v.art)));

  /* (3) Zwei gleiche Zahlen — Bestätigung, nicht Streit. */
  const gleich = zwei(REGEL('GYM-G-001', 'SRC-K', ZAHLEN(2, 4), 'session.sets'),
                      REGEL('GYM-G-002', 'SRC-K', ZAHLEN(2, 4), 'session.sets'));
  ok('  … zwei deckungsgleiche Zahlbereiche sind Bestätigung, kein Konflikt',
    gleich.konflikte.length === 0 &&
    gleich.vorgaben.filter(v => v.ziel === 'session.sets').length === 1 &&
    Array.isArray(gleich.vorgaben.find(v => v.ziel === 'session.sets').bestaetigtDurch) &&
    gleich.vorgaben.find(v => v.ziel === 'session.sets').bestaetigtDurch.length === 1,
    JSON.stringify(gleich.konflikte));

  /* (4) DIE ZUSICHERUNG, DIE NICHT FALLEN DARF. */
  const streit = zwei(REGEL('GYM-S-001', 'SRC-K', ZAHLEN(2, 4), 'session.sets'),
                      REGEL('GYM-S-002', 'SRC-K', ZAHLEN(5, 8), 'session.sets'));
  ok('  … zwei VERSCHIEDENE Zahlen gleicher Klasse ergeben weiterhin KEINE Vorgabe',
    streit.konflikte.length === 1 &&
    !streit.vorgaben.some(v => v.ziel === 'session.sets'),
    JSON.stringify(streit.vorgaben.map(v => v.ziel)));
  ok('  … und der Konflikt nennt die widersprüchlichen Werte, nicht nur die Regeln',
    Array.isArray(streit.konflikte[0].werte) && streit.konflikte[0].werte.length === 2 &&
    streit.konflikte[0].werte[0].min === 2 && streit.konflikte[0].werte[1].min === 5,
    JSON.stringify(streit.konflikte[0].werte));
  ok('  … gemittelt wird an keiner Stelle',
    !JSON.stringify(streit).includes('"min":3') && !JSON.stringify(streit).includes('"min":4'));

  /* (5) Die bessere Klasse sticht weiterhin — und das wird protokolliert. */
  const besser = (() => {
    const n = { sport: 'gym', quellen: [QUELLE('SRC-SCHWACH'), QUELLE('SRC-STARK', 'uebersichtsarbeit')],
      regeln: [REGEL('GYM-W-001', 'SRC-SCHWACH', ZAHLEN(2, 4), 'session.sets'),
        Object.assign(REGEL('GYM-W-002', 'SRC-STARK', ZAHLEN(5, 8), 'session.sets'), { art: 'studie' })] };
    const p = paket(n);
    return KA.applyKnowledge({ pack: p.pack, registry: p.registry, pins: p.pins, sport: 'gym' });
  })();
  ok('  … eine besser belegte Zahl überstimmt weiterhin und sagt, wen sie überstimmt',
    besser.konflikte.length === 0 &&
    besser.vorgaben.find(v => v.ziel === 'session.sets').regelId === 'GYM-W-002' &&
    (besser.vorgaben.find(v => v.ziel === 'session.sets').ueberstimmt || []).includes('GYM-W-001'),
    JSON.stringify(besser.vorgaben.map(v => v.regelId)));

  /* (6) Der Realfall, der den Befund ausgelöst hat — an der echten Datei. */
  const echt = (() => {
    const n = JSON.parse(readFileSync(join(APP, 'docs/wissen/QUELLE-07-sperlich-laufoekonomie-2015.json'), 'utf8'));
    const r = KI.ingest(n);
    if (!r.ok) return null;
    r.rules.forEach(x => { x.governance.technicalStatus = 'reviewed'; });
    const reg = { registryVersion: 1, sources: r.sources }; reg.contentHash = KC.registryContentHash(reg);
    const pk = { packId: 'running', version: 1, knowledgeVersion: 'kb-running-v1.0.0',
      sport: 'running', rules: r.rules, contentHash: null };
    pk.contentHash = KC.packContentHash(pk);
    return KA.applyKnowledge({ pack: pk, registry: reg, sport: 'running', pins: {
      expectedKnowledgeContractVersion: KC.KNOWLEDGE_CONTRACT_VERSION,
      expectedKnowledgeVersion: pk.knowledgeVersion, expectedPackContentHash: pk.contentHash,
      expectedSourceRegistryVersion: reg.registryVersion, expectedSourceRegistryHash: reg.contentHash } });
  })();
  ok('  … RUN-RE-001 und RUN-RE-002 erreichen beide die Anwendung (der auslösende Fall)',
    echt && echt.ok === true && echt.konflikte.length === 0 &&
    echt.vorgaben.some(v => v.regelId === 'RUN-RE-001' && v.ziel === 'session.exercises') &&
    echt.vorgaben.some(v => v.regelId === 'RUN-RE-002' && v.ziel === 'session.exercises'),
    echt ? ('Konflikte=' + echt.konflikte.length + ' Vorgaben=' + echt.vorgaben.length) : 'Notizdatei unbrauchbar');
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
