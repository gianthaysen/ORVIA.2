/* ============================================================
   ORVIA · Die letzte Meile — vom Wissen auf die Karte (v8-349)

   BEFUND, DER DIESEN TEST ERZWUNGEN HAT: v8-349 hat den Hinweisweg gebaut
   (`prescription-factory.hinweise` → `prescription-format.hinweisZeilen`),
   und beim Nachziehen der Proben fiel auf, dass KEIN Test ihn anfasst.
   Genau dieselbe Fehlerklasse, die ORVIA schon dreimal getroffen hat:

     v8-335  Wissen eingespeist — niemand liest es
     v8-341  applyKnowledge vorhanden — niemand ruft es auf
     v8-344  Ziel benannt — niemand kennt den Namen
     hier    Hinweise erzeugt — niemand stellt sie dar

   Jedes Mal war alles gruen. Der Weg dahin ist immer derselbe: man baut das
   Stueck, sieht es einmal von Hand laufen und haelt das fuer geprueft.

   WAS HIER GEPRUEFT WIRD, ist die Kette bis zum Ende:
     Paket → applyKnowledge → buildPrescription → hinweisZeilen

   UND WAS SIE NICHT DARF:
     • keine Zeile ohne Aussage
     • keine Zeile ohne Herkunft, wenn die Vorgabe eine hat
     • kein Hinweis fuer etwas, das bereits als ZAHL in der Verordnung steht
       (sonst stuende dieselbe Sache zweimal auf der Karte)
     • KEINE Hinweise ohne Wissen — dann ist die Liste leer, nicht voll
       allgemeiner Ratschlaege

   node supabase/tests/knowledge_hinweise_test.mjs
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
const KA = require(join(APP, 'js/engine/knowledge/knowledge-application.js'));
const PF = require(join(APP, 'js/engine/prescription-factory.js'));
const FMT = require(join(APP, 'js/engine/prescription-format.js'));

/* Das ECHTE Gym-Paket, nicht ein Prueflings-Paket: ein Weg, der nur mit
   eigens gebauten Daten funktioniert, ist kein gepruefter Weg. */
const pack = require(join(APP, 'js/engine/knowledge/gym-knowledge-pack.js'));
const registry = require(join(APP, 'js/engine/knowledge/gym-knowledge-sources.js'));
const wissen = KA.applyKnowledge({
  pack: pack, registry: registry, sport: 'gym', contracts: KC,
  pins: {
    expectedKnowledgeContractVersion: KC.KNOWLEDGE_CONTRACT_VERSION,
    expectedKnowledgeVersion: pack.knowledgeVersion,
    expectedPackContentHash: pack.contentHash,
    expectedSourceRegistryVersion: registry.registryVersion,
    expectedSourceRegistryHash: registry.contentHash
  }
});
const UEBUNG = [{ exerciseId: 'squat', sets: 3, reps: 8, rest_seconds: 120 }];
const bauen = (k) => PF.buildPrescription({ sportId: 'gym', sessionType: 'strength_general',
  knowledge: k, exercises: UEBUNG }, {});

sec('A · Das Wissen kommt überhaupt an');
{
  ok('das echte Gym-Paket wird angewendet', wissen && wissen.ok === true,
    wissen && wissen.ok ? (wissen.vorgaben || []).length + ' Vorgaben' : 'blockiert: ' + (wissen && wissen.grund));

  const p = bauen(wissen);
  ok('die Verordnung wird gebaut', p && p.ok === true, p && p.ok ? '' : 'blockiert: ' + (p && p.blocked));
  ok('sie führt Hinweise', Array.isArray(p.hinweise) && p.hinweise.length > 0,
    (p.hinweise || []).length + ' Hinweise: ' + (p.hinweise || []).map(h => h.ziel).join(', '));
  ok('die Anzahl steht als Flag in der Verordnung',
    (p.flags || []).some(f => f === 'hinweise_aus_wissen:' + p.hinweise.length),
    JSON.stringify((p.flags || []).filter(f => /hinweis/.test(f))));

  /* DIE DOPPELUNG. `session.rest_seconds` wird in dieser Einheit als ZAHL
     eingebaut (120 s aus GYM-HYP-001). Stuende es zusaetzlich als Hinweis
     da, laese der Nutzer dieselbe Sache zweimal — einmal als Vorgabe,
     einmal als Ratschlag. */
  const alsZahl = (p.flags || []).some(f => f.indexOf('rest_aus_wissen:') === 0);
  ok('das als Zahl eingebaute Ziel wird eingebaut', alsZahl,
    JSON.stringify((p.flags || []).filter(f => /_aus_wissen/.test(f))));
  ok('  … und NICHT zusätzlich als Hinweis wiederholt',
    !p.hinweise.some(h => h.ziel === 'session.rest_seconds'),
    JSON.stringify(p.hinweise.map(h => h.ziel)));
}

sec('B · Ohne Wissen keine Hinweise (kein Ersatzratschlag)');
{
  /* Der wichtigste Fall. Eine Karte, die ohne Quelle „allgemeine Tipps"
     zeigt, ist genau das, was ORVIA nicht sein will: die Hinweise sind
     BELEGT oder sie sind nicht da. */
  const p = bauen(null);
  ok('ohne Wissen wird die Verordnung trotzdem gebaut', p && p.ok === true, p && p.ok ? '' : 'blockiert: ' + (p && p.blocked));
  ok('ohne Wissen gibt es KEINE Hinweise', Array.isArray(p.hinweise) && p.hinweise.length === 0,
    JSON.stringify(p.hinweise));
  ok('ohne Wissen gibt es auch kein Hinweis-Flag',
    !(p.flags || []).some(f => f.indexOf('hinweise_aus_wissen') === 0));

  const leer = bauen({ ok: true, vorgaben: [], konflikte: [], ausgeschlossen: [] });
  ok('ein leeres Wissensergebnis erzeugt ebenfalls nichts',
    Array.isArray(leer.hinweise) && leer.hinweise.length === 0, JSON.stringify(leer.hinweise));
}

sec('C · Die Darstellung — hinweisZeilen');
{
  const p = bauen(wissen);
  ok('das Formatmodul stellt hinweisZeilen bereit', typeof FMT.hinweisZeilen === 'function');
  const zeilen = FMT.hinweisZeilen(p.hinweise);

  ok('jeder Hinweis wird zu genau einer Zeile', zeilen.length === p.hinweise.length,
    zeilen.length + ' Zeilen aus ' + p.hinweise.length + ' Hinweisen');

  /* KEIN SATZ ZWEIMAL. GYM-HYP-003 nennt Last UND Wiederholungen und trug
     bis v8-349 zwei Hinweise mit wortgleichem Text — auf der Karte stand
     derselbe Satz doppelt untereinander. Aufgefallen ist das nicht durch
     eine Zusicherung, sondern beim Lesen der Testausgabe. Deshalb steht es
     jetzt als Zusicherung hier. */
  const texte = zeilen.map(z => z.text);
  ok('kein Satz steht zweimal auf der Karte',
    texte.length === new Set(texte).size,
    JSON.stringify(texte.filter((t, i) => texte.indexOf(t) !== i).map(t => t.slice(0, 60))));
  ok('  … und das zusammengefasste Ziel geht dabei nicht verloren',
    p.hinweise.every(h => Array.isArray(h.ziele) && h.ziele.length >= 1 && h.ziele.indexOf(h.ziel) >= 0),
    JSON.stringify(p.hinweise.map(h => h.regelId + ':' + (h.ziele || []).join('+'))));
  ok('keine Zeile ist leer',
    zeilen.every(z => typeof z.text === 'string' && z.text.trim().length > 0));
  ok('jede Zeile nennt ihre Regel', zeilen.every(z => typeof z.regelId === 'string' && z.regelId),
    JSON.stringify(zeilen.filter(z => !z.regelId).map(z => z.ziel)));

  /* Ein Hinweis ohne Herkunft waere eine anonyme Behauptung — genau das,
     wogegen die ganze Wissenskette gebaut ist. */
  const mitHerkunft = p.hinweise.filter(h => h.herkunft && (h.herkunft.evidenceClass || h.herkunft.label));
  ok('jede Zeile zu einer Vorgabe mit Herkunft zeigt die Herkunft auch an',
    mitHerkunft.every(h => {
      const z = zeilen.find(x => x.regelId === h.regelId && x.ziel === h.ziel);
      return z && typeof z.herkunft === 'string' && z.herkunft.length > 0;
    }),
    mitHerkunft.length + ' von ' + p.hinweise.length + ' Vorgaben führen eine Herkunft');

  console.log('   So steht es auf der Karte:');
  zeilen.forEach(z => {
    console.log('     • ' + z.text.slice(0, 96) + (z.text.length > 96 ? '…' : ''));
    console.log('       [' + z.regelId + (z.herkunft ? ' · ' + z.herkunft : '') + ']');
    (z.zusatz || []).forEach(t => console.log('       ↳ ' + t.slice(0, 96)));
  });
}

sec('D · Was hinweisZeilen NICHT durchlässt');
{
  ok('nichts hinein, nichts heraus', FMT.hinweisZeilen([]).length === 0
    && FMT.hinweisZeilen(null).length === 0 && FMT.hinweisZeilen(undefined).length === 0);
  ok('ein Hinweis ohne Aussage wird verworfen, nicht mit leerem Text gezeigt',
    FMT.hinweisZeilen([{ ziel: 'x', regelId: 'R1' }, { ziel: 'y', regelId: 'R2', aussage: '   ' }]).length === 0);

  const z = FMT.hinweisZeilen([{
    ziel: 'plan.test', regelId: 'R9', aussage: 'Eine belegte Aussage.',
    giltNichtFuer: ['akute Verletzung'], grenzen: ['nie mehr als zwei harte Einheiten'],
    wennUnsicher: 'Im Zweifel weniger.', zahlGesperrt: true,
    herkunft: { evidenceClass: 'B' }
  }])[0];
  /* Die Einschraenkungen gehoeren SICHTBAR an die Aussage, nicht in eine
     Fussnote, die niemand aufklappt. */
  ok('Ausschlüsse stehen an der Zeile', (z.zusatz || []).some(t => /gilt nicht für/.test(t)), JSON.stringify(z.zusatz));
  ok('Sicherheitsgrenzen stehen an der Zeile', (z.zusatz || []).some(t => /^Grenze:/.test(t)));
  ok('der vorsichtige Weg steht an der Zeile', (z.zusatz || []).some(t => /^im Zweifel:/.test(t)));
  ok('eine gesperrte Zahl wird als gesperrt benannt, nicht verschwiegen',
    (z.zusatz || []).some(t => /nicht freigegeben/.test(t)));
  ok('die Evidenzklasse wird angezeigt, wenn kein Label da ist', z.herkunft === 'Klasse B', z.herkunft);
}

sec('E · Die wirkliche letzte Meile: Wochenplan → Anzeigemodell');
{
  /* DER BEFUND, DER DIESEN BLOCK ERZWUNGEN HAT (2026-08-13): Bloecke A–D
     oben waren gruen, und die Hinweise kamen trotzdem auf KEINER Karte an.
     `scheduler-v2` nahm aus der Verordnung nur `workout` und `flags` und warf
     `hinweise` weg; `week-projection` kannte das Feld nicht; die Oberflaeche
     rief `hinweisZeilen` nirgends auf. Ein vollstaendiger Weg im Motor, der
     drei Zeilen vor dem Bildschirm endet.

     Das ist zum VIERTEN Mal dieselbe Fehlerklasse (v8-335, v8-341, v8-344).
     Sie faellt jedes Mal deshalb nicht auf, weil jedes Einzelstueck fuer sich
     geprueft ist. Geprueft werden muss die NAHT. */
  const SOLV = require(join(APP, 'js/engine/constraint-solver.js'));
  require(join(APP, 'js/engine/knowledge/gym-knowledge-sources.js'));
  require(join(APP, 'js/engine/knowledge/gym-knowledge-pack.js'));
  require(join(APP, 'js/engine/knowledge/knowledge-consumer.js'));
  const SV2 = require(join(APP, 'js/engine/scheduler-v2.js'));
  const WP = require(join(APP, 'js/engine/week-projection.js'));

  const tage = {};
  ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'].forEach(wd => {
    tage[wd] = { available: true, restDay: false,
      singleSession: { maxMinutes: 90, intensityAllowed: 'intense' },
      doubleSession: { enabled: false }, fixedCommitments: [] };
  });
  tage.do = { available: false, restDay: true, singleSession: null,
    doubleSession: { enabled: false }, fixedCommitments: [] };
  const woche = SV2.buildWeek({ activationMode: 'shadow_only', weekKey: '2026-W33',
    sports: [{ sportId: 'gym', role: 'secondary' }],
    availability: { days: tage, maxSessionsPerWeek: null, maxIntenseSessions: 2,
      preferredRestDays: ['fr'], minimumFullRestDays: 1 },
    capacityPerSport: null, evidence: null });

  const s0 = woche.ok && woche.sessions && woche.sessions[0];
  ok('der Wochenplan entsteht', woche.ok === true && !!s0,
    woche.ok ? '' : JSON.stringify(woche.error));
  ok('der Scheduler reicht die Hinweise weiter (statt sie wegzuwerfen)',
    !!s0 && Array.isArray(s0.hinweise) && s0.hinweise.length > 0,
    s0 ? ((s0.hinweise || []).length + ' Hinweise') : '—');
  ok('  … mit Aussage und Regel, nicht als leere Huelle',
    !!s0 && (s0.hinweise || []).every(h => h.aussage && h.regelId),
    s0 ? JSON.stringify((s0.hinweise || []).map(h => h.regelId)) : '—');

  const proj = WP.projectWeek(woche);
  const alle = [].concat.apply([], proj.days || []);
  const mitHinweis = alle.filter(i => i.hinweise && i.hinweise.length);
  ok('die Projektion trägt sie ins Anzeigemodell', mitHinweis.length > 0,
    mitHinweis.length + ' von ' + alle.length + ' Einheiten');

  /* KEIN GETEILTER VERWEIS. Wird das Anzeigemodell spaeter bearbeitet, darf
     sich der Scheduler-Output nicht rueckwirkend aendern — dieselbe
     Fehlerklasse, die in plan-activation als A5/A6 gefunden wurde. */
  ok('  … als Kopie, nicht als Verweis auf den Scheduler-Output',
    mitHinweis.length > 0 && mitHinweis[0].hinweise !== s0.hinweise);

  /* Und der Fingerabdruck der Verordnung darf sich NICHT geaendert haben:
     sonst bekaeme der Nutzer fuer jede neue Quelle eine Aenderungsmeldung
     an einer Einheit, die unveraendert ist. */
  ok('  … ohne die Verordnung selbst anzufassen',
    mitHinweis.length > 0 && mitHinweis[0].rx && mitHinweis[0].rx.hinweise === undefined,
    'rx-Schlüssel: ' + JSON.stringify(Object.keys((mitHinweis[0] || {}).rx || {})));

  /* Der letzte Schritt: was die Karte daraus macht. Die Oberflaeche selbst
     laesst sich hier nicht laden (Browser-Globals), aber der Aufruf, den sie
     macht, ist genau dieser — und er ist der Beweis, dass am Ende Text
     herauskommt und nicht ein Objekt, das niemand anzeigen kann. */
  const kartenZeilen = FMT.hinweisZeilen(mitHinweis.length ? mitHinweis[0].hinweise : []);
  ok('aus dem Anzeigemodell werden Kartenzeilen', kartenZeilen.length > 0,
    kartenZeilen.length + ' Zeilen');
  ok('  … jede mit Text und Herkunft',
    kartenZeilen.every(z => z.text && z.herkunft),
    JSON.stringify(kartenZeilen.map(z => z.regelId + '/' + z.herkunft)));

  console.log('   So steht es am Ende auf der Wochenkarte:');
  kartenZeilen.forEach(z => console.log('     ℹ ' + z.text.slice(0, 88) + '  [' + z.herkunft + ' · ' + z.regelId + ']'));
}

console.log('\n' + '═'.repeat(62));
console.log('Ergebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
