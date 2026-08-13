/* ORVIA · v8-341 — der Anschluss zwischen Wissen und Wochenplan.

   BEFUND, der dieses Modul und diesen Test ausgelöst hat: nach v8-339 hatte
   Gym ein Wissenspaket, eingebunden, im Offline-Vorrat, testgedeckt — und es
   änderte am Verhalten der App NICHTS. Eine Suche über das ganze Projekt
   ergab: `applyKnowledge` wurde von keiner Stelle der App aufgerufen. Die
   Kette lief ausschließlich in Prüfskripten.

   Dieser Test prüft deshalb NICHT, ob die Module existieren, sondern ob eine
   eingespeiste Zahl bis in eine Verordnung des Wochenplans durchkommt —
   über den echten Scheduler, mit den echten Modulen.

   Die zweite Zusage ist so wichtig wie die erste: die Pins im Consumer
   müssen zum tatsächlichen Paket passen. Driften sie auseinander (weil
   jemand das Paket neu erzeugt und die Pins vergisst), blockiert der Vertrag
   still — die App verhielte sich wie ohne Wissen, und alles bliebe grün.
   Genau das fängt hier eine eigene Prüfung ab.

   node supabase/tests/knowledge_consumer_test.mjs [appRoot-absolut] */
import { existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

/* Ladereihenfolge wie in index.html: Vertrag, dann Register, dann Paket. */
globalThis.ORVIA = globalThis.ORVIA || {};
const KC = require(join(APP, 'js/engine/knowledge/knowledge-contracts.js'));
const GS = require(join(APP, 'js/engine/knowledge/gym-knowledge-sources.js'));
const GP = require(join(APP, 'js/engine/knowledge/gym-knowledge-pack.js'));
require(join(APP, 'js/engine/knowledge/knowledge-application.js'));
const KCons = require(join(APP, 'js/engine/knowledge/knowledge-consumer.js'));
require(join(APP, 'js/engine/constraint-solver.js'));
require(join(APP, 'js/engine/prescription-factory.js'));
const SV2 = require(join(APP, 'js/engine/scheduler-v2.js'));

/* ══ P · Die Pins dürfen nicht vom Paket abdriften ══ */
sec('P · Pins und Paket passen zusammen');
{
  const eintrag = (() => {
    /* Der Consumer legt seine Tabelle nicht offen — das ist richtig so.
       Geprüft wird deshalb über das Verhalten, plus ein direkter Vergleich
       der Werte, die das Paket selbst trägt. */
    return { pack: GP, registry: GS };
  })();
  ok('das Gym-Paket ist registriert', KCons.registrierteSportarten().includes('gym'),
    KCons.registrierteSportarten().join(','));

  const w = KCons.wissenFuer('gym');
  ok('  … und der Consumer bekommt Wissen heraus (Pins passen zum Paket)',
    w.ok === true, 'grund=' + (w.grund || '—'));
  ok('  … sonst wäre die App still ohne Wissen gelaufen, obwohl alles grün ist',
    w.ok === true && w.vorgaben.length > 0, 'Vorgaben=' + (w.vorgaben || []).length);

  /* Die Hashes, gegen die gepinnt wird, sind berechenbar — driften Paket und
     Pin auseinander, muss das hier auffallen und nicht im Betrieb. */
  ok('  … der deklarierte Paket-Hash stimmt mit dem berechneten überein',
    eintrag.pack.contentHash === KC.packContentHash(eintrag.pack),
    eintrag.pack.contentHash + ' vs ' + KC.packContentHash(eintrag.pack));
  ok('  … dasselbe für das Quellenregister',
    eintrag.registry.contentHash === KC.registryContentHash(eintrag.registry));
}

/* ══ F · Fail-closed ══ */
sec('F · ohne Paket passiert nichts Stilles');
{
  const unbekannt = KCons.wissenFuer('gibtesnicht');
  ok('eine unbekannte Sportart liefert einen benannten Grund, kein leeres ok',
    unbekannt.ok === false && unbekannt.grund === 'kein_paket_fuer_sportart', unbekannt.grund);
  ok('  … und in jedem Fall eine leere, nutzbare Vorgabenliste',
    Array.isArray(unbekannt.vorgaben) && unbekannt.vorgaben.length === 0);
  ok('  … auch bei unbrauchbarer Eingabe',
    [null, undefined, '', 42, {}, []].every(v => {
      const r = KCons.wissenFuer(v);
      return r.ok === false && typeof r.grund === 'string' && Array.isArray(r.vorgaben);
    }));
}

/* ══ D · Die Zahl kommt bis in die Verordnung ══
   Das ist die Zusage, um die es geht. Alles davor ist Vorbereitung. */
sec('D · eine eingespeiste Zahl erreicht die Verordnung');
{
  const PF = require(join(APP, 'js/engine/prescription-factory.js'));
  const wissen = KCons.wissenFuer('gym');

  /* OHNE eigene Pausenangabe: die Zahl muss aus dem Wissen kommen. Der Weg
     ist der echte — Paket → Vertrag → Anwendung → Consumer → Factory. Keine
     Attrappe, keine handgebaute Vorgabe. */
  const ohne = PF.buildPrescription({ sportId: 'gym', sessionType: 'strength_general',
    durationMin: 60, exercises: [{ exerciseId: 'back_squat', sets: 4, reps: 5 }],
    knowledge: wissen }, null);
  ok('die Verordnung entsteht', ohne.ok === true, JSON.stringify(ohne.blocked || ohne.errors));
  ok('  … die Satzpause stammt aus dem eingespeisten Wissen, nicht aus dem Code',
    (ohne.flags || []).includes('rest_aus_wissen:GYM-HYP-001'), JSON.stringify(ohne.flags));
  ok('  … und steht als konkreter Wert in der Verordnung (120 s = 2 min)',
    ohne.ok && ohne.workout.blocks[0].rest_seconds === 120,
    ohne.ok ? String(ohne.workout.blocks[0].rest_seconds) : '—');
  ok('  … die Regel-Kennung reist mit, nicht nur der Wert (Anzeigepflicht)',
    (ohne.flags || []).join(',').includes('GYM-HYP-001'));

  /* Gegenprobe: die eigene Angabe bleibt vorrangig. Ohne sie wüsste man
     nicht, ob Wissen ergänzt oder überschreibt. */
  const mit = PF.buildPrescription({ sportId: 'gym', sessionType: 'strength_general',
    durationMin: 60, exercises: [{ exerciseId: 'back_squat', sets: 4, reps: 5, restSeconds: 240 }],
    knowledge: wissen }, null);
  ok('  … eine eigene Pausenangabe wird vom Wissen NICHT überschrieben',
    mit.ok && mit.workout.blocks[0].rest_seconds === 240,
    mit.ok ? String(mit.workout.blocks[0].rest_seconds) : '—');

  /* Gegenprobe: OHNE Wissen greift wieder der bisherige Zustand — die
     Verordnung blockiert, weil die Pause unbekannt ist. Damit ist belegt,
     dass die 120 s wirklich aus dem Paket kamen und nicht aus einem Default. */
  const leer = PF.buildPrescription({ sportId: 'gym', sessionType: 'strength_general',
    durationMin: 60, exercises: [{ exerciseId: 'back_squat', sets: 4, reps: 5 }] }, null);
  ok('  … ohne Wissen bleibt die Pause unbekannt (die 120 s sind kein Default)',
    leer.ok === false || leer.workout.blocks[0].rest_seconds !== 120,
    JSON.stringify(leer.blocked || leer.errors || leer.workout));
}

/* ══ S · Der Scheduler reicht es weiter — und was er noch nicht kann ══ */
sec('S · Scheduler-Weg, ehrlich vermessen');
{
  const fullAvail = () => {
    const days = {};
    ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'].forEach(wd => {
      days[wd] = { available: true, restDay: false,
        singleSession: { maxMinutes: 90, intensityAllowed: 'intense' },
        doubleSession: { enabled: false }, fixedCommitments: [] };
    });
    days.do = { available: false, restDay: true, singleSession: null,
      doubleSession: { enabled: false }, fixedCommitments: [] };
    return { days, maxSessionsPerWeek: null, maxIntenseSessions: 2,
      preferredRestDays: ['fr'], minimumFullRestDays: 1 };
  };
  const w = SV2.buildWeek({ activationMode: 'shadow_only', weekKey: '2026-W33',
    sports: [{ sportId: 'gym', role: 'secondary' }], availability: fullAvail(),
    capacityPerSport: null, evidence: null });
  const s0 = w.ok && w.sessions && w.sessions[0];
  ok('der Wochenplan entsteht', w.ok === true && !!s0,
    w.ok ? JSON.stringify(w.unplaced) : JSON.stringify(w.error));

  /* EHRLICHER BEFUND, hier festgeschrieben statt beschönigt: der Scheduler
     leitet für Gym keine Übungsliste ab (er kennt keine Übungsauswahl, und
     das ist Absicht — sie käme aus einem Kraft-Pack, das es nicht gibt).
     Damit greift die Pausenregel im Wochenplan noch nicht: sie hängt an
     Übungen. Der Anschluss steht, die Übungsauswahl fehlt.

     Fällt dieses Flag eines Tages weg, weil der Scheduler Übungen liefert,
     schlägt dieser Test an — und dann gehört die Zusicherung oben von der
     Factory auf den Wochenplan gehoben. */
  ok('  … Gym erhält (noch) keine Übungsliste — die Pausenregel greift dort noch nicht',
    !!s0 && (s0.flags || []).includes('no_exercise_list_generic_session'),
    s0 ? JSON.stringify(s0.flags) : '—');
  ok('  … und es entsteht kein stiller Ersatzwert für die Pause',
    !!s0 && s0.prescription.blocks[0].rest_seconds === null,
    s0 ? String(s0.prescription.blocks[0].rest_seconds) : '—');
  ok('  … das Wissen wird trotzdem geholt, ohne Fehlerflag',
    !!s0 && !(w.flags || []).some(f => f.indexOf('wissen_nicht_verfuegbar') === 0),
    JSON.stringify(w.flags));
  ok('  … zweimal derselbe Aufruf ergibt Zeichen für Zeichen dasselbe',
    JSON.stringify(SV2.buildWeek({ activationMode: 'shadow_only', weekKey: '2026-W33',
      sports: [{ sportId: 'gym', role: 'secondary' }], availability: fullAvail(),
      capacityPerSport: null, evidence: null })) === JSON.stringify(w));
}

/* ══ V · Die Verdrahtung selbst ══ */
sec('V · der Consumer ist eingebunden und offline verfügbar');
{
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  const vorrat = sw.slice(sw.indexOf('const ASSETS') >= 0 ? sw.indexOf('const ASSETS') : sw.length / 2);
  ok('knowledge-consumer.js steht in index.html',
    html.includes('js/engine/knowledge/knowledge-consumer.js'));
  ok('  … NACH knowledge-application.js (es liest dessen Namensraum)',
    html.indexOf('knowledge-application.js') < html.indexOf('knowledge-consumer.js'));
  ok('  … und im Offline-Vorrat von sw.js',
    vorrat.includes('js/engine/knowledge/knowledge-consumer.js'));
  ok('scheduler-v2 reicht das Wissen tatsächlich weiter',
    readFileSync(join(APP, 'js/engine/scheduler-v2.js'), 'utf8').includes('knowledge: wissen'));
}

/* ══ L · Ladefehler und Pin-Unabhängigkeit ══
   Beide Zusicherungen wurden von den eigenen Mutationssonden als LÜCKE
   gemeldet (KCO1, KCO2) — die Prüfungen oben deckten sie nicht ab, weil im
   Normalfall alle Module da sind und der deklarierte Hash stimmt. Beide
   Fälle lassen sich nur durch gezieltes Kaputtmachen zur Laufzeit prüfen. */
sec('L · fehlendes Modul, verfälschtes Paket');
{
  /* (1) Fehlt ein Modul, ist das ein Ladefehler — kein leeres Wissen.
     Würde der Consumer den Eintrag stattdessen überspringen, liefe die App
     lautlos ohne dieses Paket weiter. */
  const merk = globalThis.ORVIA.knowledgeSources_gym;
  delete globalThis.ORVIA.knowledgeSources_gym;
  const fehlt = KCons.wissenFuer('gym');
  globalThis.ORVIA.knowledgeSources_gym = merk;
  ok('ein fehlendes Registermodul ergibt einen benannten Ladefehler',
    fehlt.ok === false && String(fehlt.grund).indexOf('modul_fehlt:') === 0, fehlt.grund);
  ok('  … und danach funktioniert es wieder (der Test hinterlässt keinen Schaden)',
    KCons.wissenFuer('gym').ok === true);

  /* (2) Der erwartete Hash muss UNABHÄNGIG hinterlegt sein. Läse ihn der
     Consumer aus dem Paket, bestätigte das Paket sich selbst — und ein
     verfälschtes Paket käme unbemerkt durch. Deshalb: Paket verfälschen,
     Consumer muss blockieren. */
  const echterHash = GP.contentHash;
  GP.contentHash = 'fnv1a-00000000';
  const verfaelscht = KCons.wissenFuer('gym');
  GP.contentHash = echterHash;
  ok('ein verfälschtes Paket wird blockiert — der Pin steht unabhängig davon',
    verfaelscht.ok === false, 'grund=' + (verfaelscht.grund || 'ok!'));
  ok('  … und der echte Zustand ist danach wiederhergestellt',
    GP.contentHash === echterHash && KCons.wissenFuer('gym').ok === true);

  /* Die Verhaltensprobe oben reicht NICHT aus, und das hat die Sonde KCO2
     gezeigt: die Pin-Tabelle wird beim Laden EINMAL ausgewertet. Läse sie
     den Hash aus dem Paket, stünde danach trotzdem der damals richtige Wert
     darin — verfälscht man das Paket später, blockiert es so oder so. Der
     Unterschied wird erst sichtbar, wenn ein NEU erzeugtes Paket geladen
     wird, und genau dann soll er blockieren.

     Deshalb hier eine Prüfung am Quelltext: der erwartete Hash muss als
     Literal dastehen. Ein Ausdruck, der ihn aus dem Paket zieht, macht die
     Pinprüfung zur Selbstbestätigung. */
  const quelle = (await import('node:fs')).readFileSync(
    join(APP, 'js/engine/knowledge/knowledge-consumer.js'), 'utf8');
  ok('der erwartete Paket-Hash steht als LITERAL im Consumer',
    /expectedPackContentHash:\s*'fnv1a-[0-9a-f]{8}'/.test(quelle));
  ok('  … und wird nirgends aus dem Paket selbst gelesen',
    !/expected(Pack|SourceRegistry)(ContentHash|Hash|Version):[^,\n]*(knowledgePack|knowledgeSources|\.contentHash)/.test(quelle));
  ok('  … dasselbe gilt für den Register-Hash und die Versionen',
    /expectedSourceRegistryHash:\s*'fnv1a-[0-9a-f]{8}'/.test(quelle) &&
    /expectedKnowledgeVersion:\s*'kb-/.test(quelle) &&
    /expectedKnowledgeContractVersion:\s*\d+/.test(quelle));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
