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

sec('F · Der Prüfer — eine Zahl anwenden, ohne sie vorzuschreiben (v8-351)');
{
  /* `plan.saetze_je_muskelgruppe` war die LETZTE Quittung in
     `_ziele-ohne-leser.json`: eine vom Vertrag zum Vorschreiben freigegebene
     Zahl, die niemand anwendet. Vorschreiben lässt sie sich nicht — die
     Quelle verbietet die Umrechnung auf `session.sets` wörtlich. Prüfen
     schon. Genau das wird hier durch die echte Kette belegt. */
  require(join(APP, 'js/gym-volume.js'));
  require(join(APP, 'js/engine/planned-volume.js'));

  const UE = (id, sets) => ({ exerciseId: id, sets: sets, restSeconds: 120 });
  const bauenMit = (exs, k) => PF.buildPrescription({ sportId: 'gym',
    sessionType: 'strength_general', knowledge: k === undefined ? wissen : k, exercises: exs }, {});

  /* Kniebeuge 4 + Beinpresse 3 = 7 Sätze Quadrizeps, Bereich ist 5–6. */
  const zuViel = bauenMit([UE('squat', 4), UE('leg_press', 3)]);
  const befund = (zuViel.hinweise || []).filter(h => h.befund);
  ok('sieben geplante Sätze auf einen Muskel erzeugen genau EINEN Befund',
    befund.length === 1, JSON.stringify((zuViel.hinweise || []).map(h => h.ziel)));
  ok('  … er nennt die Regel der Quelle', befund.length === 1 && befund[0].regelId === 'GYM-HYP-002',
    befund.length ? befund[0].regelId : '—');
  ok('  … und trägt die Messung, nicht die Quelle, als Befund',
    befund.length === 1 && /Quadrizeps 7/.test(befund[0].befund),
    befund.length ? befund[0].befund : '—');
  ok('  … die Aussage der Quelle bleibt wörtlich unverändert daneben stehen',
    befund.length === 1 && befund[0].aussage.indexOf('fuenf bis sechs Saetze pro Muskelgruppe') >= 0);
  ok('  … das Flag nennt die Regel', (zuViel.flags || []).includes('muskelvolumen_geprueft:GYM-HYP-002'),
    JSON.stringify((zuViel.flags || []).filter(f => /muskel/.test(f))));

  /* DIE REGEL DER QUELLE, wörtlich: „Diese Zahl darf session.sets nicht
     speisen." Wäre sie verletzt, stünden im Workout 5 Sätze je Übung. */
  const bloecke = zuViel.workout.blocks;
  ok('DIE Zahl speist session.sets NICHT — jede Übung behält ihre eigene',
    bloecke[0].sets === 4 && bloecke[1].sets === 3,
    JSON.stringify(bloecke.map(b => b.exercise_id + ':' + b.sets)));

  /* Im Bereich: kein Befund — aber die Aussage der Quelle bleibt sichtbar. */
  const passt = bauenMit([UE('squat', 5)]);
  ok('fünf Sätze lösen keinen Befund aus', (passt.hinweise || []).every(h => !h.befund),
    JSON.stringify((passt.hinweise || []).map(h => h.ziel)));
  ok('  … die Regel steht trotzdem als Aussage auf der Karte',
    (passt.hinweise || []).some(h => h.ziel === 'plan.saetze_je_muskelgruppe'));

  /* Ohne Wissen kein Befund — auch bei zwölf Sätzen. Das ist der Fall, in
     dem ein „hilfreicher" Ratschlag am verlockendsten wäre. */
  const ohne = bauenMit([UE('squat', 12)], null);
  ok('ohne Wissen gibt es KEINEN Befund, auch bei zwölf Sätzen',
    (ohne.hinweise || []).length === 0, JSON.stringify(ohne.hinweise));

  /* NACHGETRAGEN, weil eine Probe grün blieb (v8-351). Der Fall oben trifft
     die erste Sperre in `_muskelHinweise` (`vorgaben` fehlt ganz) und kommt
     nie bis zu der Stelle, an der eine erfundene Zahl entstehen könnte.
     Der gefährlichere Fall ist Wissen OHNE diese Regel: dann sind Vorgaben
     da, nur nicht die richtige — und 5–6 steht im Code. */
  const ohneRegel = { ok: true, konflikte: [], ausgeschlossen: [],
    vorgaben: (wissen.vorgaben || []).filter(v => v.ziel !== 'plan.saetze_je_muskelgruppe') };
  const oR = bauenMit([UE('squat', 12)], ohneRegel);
  ok('Wissen ohne diese Regel erzeugt ebenfalls keinen Befund',
    (oR.hinweise || []).every(h => !h.befund)
      && !(oR.flags || []).some(f => f.indexOf('muskelvolumen_geprueft') === 0),
    JSON.stringify((oR.hinweise || []).map(h => h.ziel)) + ' · ' + JSON.stringify((oR.flags || []).filter(f => /muskel/.test(f))));

  /* NACHGETRAGEN aus demselben Grund. Oben tragen alle Übungen eine eigene
     Satzzahl — die Stelle, an der die Muskelzahl in `session.sets` sickern
     könnte, wird dabei gar nicht erreicht. Hier trägt die Übung KEINE
     Satzzahl: die Verordnung muss sperren, nicht auffüllen. */
  const ohneSatzzahl = PF.buildPrescription({ sportId: 'gym', sessionType: 'strength_general',
    knowledge: wissen, exercises: [{ exerciseId: 'squat', restSeconds: 120 }] }, {});
  ok('eine Übung ohne Satzzahl SPERRT die Verordnung — die Muskelzahl füllt sie nicht auf',
    ohneSatzzahl.ok === false && ohneSatzzahl.blocked === 'schema_invalid',
    ohneSatzzahl.ok ? ('nicht gesperrt, sets=' + JSON.stringify(ohneSatzzahl.workout.blocks.map(b => b.sets)))
      : (ohneSatzzahl.blocked + ' ' + JSON.stringify(ohneSatzzahl.errors)));

  /* Was nicht gezählt werden konnte, muss am Befund hängen — sonst sieht
     eine halbe Summe aus wie eine ganze. */
  const halb = bauenMit([UE('squat', 4), UE('leg_press', 3), UE('gibtsnicht_xy', 4)]);
  const bh = (halb.hinweise || []).filter(h => h.befund)[0];
  ok('nicht zuordenbare Übungen hängen am Befund',
    !!bh && (bh.nichtGezaehlt || []).length === 1,
    JSON.stringify(bh ? bh.nichtGezaehlt : null));
  ok('  … und das Flag sagt es ebenfalls',
    (halb.flags || []).some(f => f.indexOf('muskelvolumen_unvollstaendig:') === 0),
    JSON.stringify((halb.flags || []).filter(f => /muskel/.test(f))));

  const zeilen = FMT.hinweisZeilen(halb.hinweise);
  const zb = zeilen.filter(z => z.ziel === 'plan.saetze_je_muskelgruppe')[0];
  ok('auf der Karte steht der Befund oben und die Quelle darunter',
    !!zb && /Quadrizeps 7/.test(zb.text) && (zb.zusatz || []).some(t => t.indexOf('laut Quelle:') === 0),
    zb ? zb.text : '—');
  ok('  … samt dem, was nicht mitgezählt wurde',
    !!zb && (zb.zusatz || []).some(t => t.indexOf('nicht mitgezählt:') === 0),
    JSON.stringify(zb ? zb.zusatz : null));
  ok('  … und genau EINE Zeile für dieses Ziel (keine je Muskelgruppe)',
    zeilen.filter(z => z.ziel === 'plan.saetze_je_muskelgruppe').length === 1);

  /* Das zweite Register: ein Prüfer ist kein Setzer. */
  ok('das Ziel steht im Register der GEPRÜFTEN Ziele',
    (PF.GEPRUEFTE_ZIELE || []).indexOf('plan.saetze_je_muskelgruppe') >= 0,
    JSON.stringify(PF.GEPRUEFTE_ZIELE));
  ok('  … und NICHT bei den als Wert eingebauten',
    (PF.GELESENE_ZIELE || []).indexOf('plan.saetze_je_muskelgruppe') < 0);
  ok('  … das zweite Register ist ebenfalls eingefroren',
    Object.isFrozen(PF.GEPRUEFTE_ZIELE));

  console.log('   So steht der Befund auf der Karte:');
  if (zb) {
    console.log('     ℹ ' + zb.text + '  [' + zb.herkunft + ' · ' + zb.regelId + ']');
    (zb.zusatz || []).forEach(t => console.log('       ↳ ' + t.slice(0, 92)));
  }
}

sec('G · Laufwissen und die Grenze der Karte (v8-353)');
{
  /* BEFUND beim Verdrahten: eine Laufeinheit erzeugt auf einmal 14 belegte
     Aussagen. Jede richtig, jede mit Quelle — und alle zusammen unlesbar.
     „Alles kommt an" ist nicht dasselbe wie „alles gehört auf jede Karte".
     Gekürzt wird deshalb SICHTBAR: die Restzahl steht als eigene Zeile. */
  require(join(APP, 'js/engine/knowledge/running-notizen-knowledge-sources.js'));
  require(join(APP, 'js/engine/knowledge/running-notizen-knowledge-pack.js'));
  const KCons = require(join(APP, 'js/engine/knowledge/knowledge-consumer.js'));

  ok('Laufen ist im Consumer registriert',
    KCons.registrierteSportarten().indexOf('running') >= 0,
    KCons.registrierteSportarten().join(', '));

  const wR = KCons.wissenFuer('running');
  ok('  … und das Laufwissen wird geholt (Pins stimmen)', wR && wR.ok === true,
    wR && wR.ok ? (wR.vorgaben.length + ' Vorgaben') : ('blockiert: ' + (wR && wR.grund)));

  const pR = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_easy',
    durationMin: 45, knowledge: wR }, {});
  ok('  … und kommt als Hinweis auf der Laufkarte an',
    pR.ok === true && (pR.hinweise || []).length > 0, (pR.hinweise || []).length + ' Hinweise');
  ok('  … jeder mit Regel und Herkunft, keiner anonym',
    (pR.hinweise || []).every(h => h.regelId && h.herkunft && h.herkunft.evidenceClass),
    JSON.stringify((pR.hinweise || []).filter(h => !h.regelId || !h.herkunft).map(h => h.ziel)));

  /* Die medizinisch pruefpflichtigen Regeln bleiben draussen — auch jetzt,
     wo das Paket verdrahtet ist. Das ist der Fall, in dem eine Verdrahtung
     eine Sperre aushebeln koennte. */
  const gesperrt = (wR.ausgeschlossen || []).map(a => a.ruleId);
  ok('  … die medizinisch pruefpflichtigen Regeln bleiben gesperrt',
    gesperrt.indexOf('RUN-ACH-001') >= 0 && gesperrt.indexOf('RUN-ERHOL-001') >= 0
      && gesperrt.indexOf('RUN-ERHOL-002') >= 0,
    JSON.stringify(wR.ausgeschlossen));
  ok('  … und keine ihrer Aussagen steht auf der Karte',
    !(pR.hinweise || []).some(h => ['RUN-ACH-001', 'RUN-ERHOL-001', 'RUN-ERHOL-002'].indexOf(h.regelId) >= 0),
    JSON.stringify((pR.hinweise || []).map(h => h.regelId)));

  /* ---- Die Kürzung ---- */
  const alle = FMT.hinweisZeilen(pR.hinweise);
  const kurz = FMT.hinweisZeilen(pR.hinweise, { max: 4 });
  ok('ohne max wird NICHT gekürzt', alle.length === (pR.hinweise || []).length,
    alle.length + ' von ' + (pR.hinweise || []).length);
  ok('mit max:4 stehen vier Hinweise plus eine Restzeile', kurz.length === 5, String(kurz.length));

  const rest = kurz[kurz.length - 1];
  ok('  … die Restzeile nennt die Zahl der weggelassenen',
    rest.art === 'gekuerzt' && rest.rest === alle.length - 4,
    JSON.stringify({ art: rest.art, rest: rest.rest, erwartet: alle.length - 4 }));
  ok('  … und sagt es im Text, nicht nur im Feld',
    /weitere belegte Hinweise/.test(rest.text), rest.text);

  /* Beliebigkeit ist das Gegenteil von belegt: dieselbe Einheit muss
     dieselben vier zeigen — sonst wirkt die Auswahl gewürfelt. */
  ok('  … die Auswahl ist bei gleicher Einheit stabil',
    JSON.stringify(kurz) === JSON.stringify(FMT.hinweisZeilen(pR.hinweise, { max: 4 })));

  /* NACHGETRAGEN, weil eine Probe grün blieb: der Vergleich oben schickt
     zweimal DIESELBE Reihenfolge hinein, und `Array.sort` ist stabil — es
     kommt auch ohne Sortierung zweimal dasselbe heraus. Die Eigenschaft,
     die die Ordnung wirklich schützt, ist diese: dieselbe MENGE in anderer
     Reihenfolge muss dieselben vier zeigen. Sonst hängt die Auswahl daran,
     in welcher Reihenfolge `applyKnowledge` die Vorgaben geliefert hat. */
  const gedreht = FMT.hinweisZeilen((pR.hinweise || []).slice().reverse(), { max: 4 });
  ok('  … dieselbe Menge in anderer Reihenfolge zeigt dieselben vier',
    JSON.stringify(gedreht.map(z => z.regelId)) === JSON.stringify(kurz.map(z => z.regelId)),
    JSON.stringify({ vorwaerts: kurz.map(z => z.regelId), rueckwaerts: gedreht.map(z => z.regelId) }));

  /* Ein Befund betrifft DIESE Einheit und steht deshalb vor allgemeinen
     Aussagen — sonst kürzt man ausgerechnet das Konkrete weg. */
  const mitBefund = [{ ziel: 'a', regelId: 'Z-999', aussage: 'Allgemein.', herkunft: { evidenceClass: 'B' } },
    { ziel: 'b', regelId: 'A-001', aussage: 'Auch allgemein.', herkunft: { evidenceClass: 'B' } },
    { ziel: 'c', regelId: 'M-002', aussage: 'Quelle.', befund: 'Diese Einheit: 7 Sätze.', herkunft: { evidenceClass: 'C' } }];
  const g = FMT.hinweisZeilen(mitBefund, { max: 1 });
  ok('  … und ein Befund steht vor allgemeinen Aussagen',
    g[0].regelId === 'M-002', JSON.stringify(g.map(x => x.regelId || x.art)));

  console.log('   So steht es auf der Laufkarte:');
  kurz.forEach(z => console.log('     ' + (z.art === 'gekuerzt' ? '… ' : 'ℹ ') + z.text.slice(0, 88)
    + (z.regelId ? '  [' + z.herkunft + ' · ' + z.regelId + ']' : '')));
}

console.log('\n' + '═'.repeat(62));
console.log('Ergebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
