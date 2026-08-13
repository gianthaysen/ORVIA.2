/* ORVIA · observer-source@2 — die versionierte Quellenbeschaffung

   Der Architekturbefund (v8-302-Review): observer-input war versioniert,
   die Beschaffung steckte unversioniert in ui.js — und dort entstanden
   zwei P0 (29-Tage-Abbruchbedingung; Uhr/Zufall im Beschwerdepfad ueber
   normalizeConstraint). Beides ist jetzt VERTRAG dieses Moduls, und seine
   Version steht in der Abnahmekohorte (shadow-adaptive@12, Feld 'source').

   node supabase/tests/observer_source_test.mjs [appRoot] */
import { readFileSync, existsSync } from 'node:fs';
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

const OS = require(join(APP, 'js/engine/observer-source.js'));
const tick = ms => new Promise(r => setTimeout(r, ms));

sec('Q1 · Determinismus: keine Uhr, kein Zufall');
{
  const profile = {
    constraintsList: [
      { bodyRegion: 'knee', title: 'Knie', intensity: 6, currentlyTrainable: true, status: 'active' },
      { bodyRegion: 'back', title: 'Rücken', intensity: 3, status: 'observed' }
    ],
    issues: ['achilles']
  };
  const a = JSON.stringify(OS.safetyConstraints(profile));
  await tick(25);
  const b = JSON.stringify(OS.safetyConstraints(profile));
  ok('zweimal dasselbe Profil (25 ms Abstand) ⇒ BYTE-GLEICHE Projektion — der v8-302-P0',
    a === b);
  ok('… ohne updatedAt und ohne erfundene IDs',
    !/updatedAt/.test(a) && !/"id"/.test(a), a.slice(0, 120));
  const src = readFileSync(join(APP, 'js/engine/observer-source.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  ok('Quelltext-Vertrag: keine Uhr, kein Zufall, kein DOM, keine Normalisierungs-Delegation',
    !/Date\.now|new Date\(\)|Math\.random|document\.|window\.|localStorage|normalizeConstraint/.test(src));
  ok('… und die Ordnung ist Inhalt, nicht Einfügereihenfolge',
    JSON.stringify(OS.safetyConstraints({ constraintsList: [profile.constraintsList[1], profile.constraintsList[0]], issues: ['achilles'] })) === a);
  /* GIANS GEGENPROBE (v8-303-Review): gleiche bodyRegion|side|title,
     verschiedene Intensitaet/Status — der Teilschluessel liess die
     Eingabereihenfolge stehen und die Reihenfolge aenderte den Hash. */
  const zw1 = [{ bodyRegion: 'knee', title: 'Knie', intensity: 3, status: 'active' },
    { bodyRegion: 'knee', title: 'Knie', intensity: 7, status: 'observed' }];
  const zw2 = [zw1[1], zw1[0]];
  ok('gleich benannte Beschwerden mit verschiedener Intensität: Reihenfolge egal (voller Schlüssel)',
    JSON.stringify(OS.safetyConstraints({ constraintsList: zw1 })) ===
    JSON.stringify(OS.safetyConstraints({ constraintsList: zw2 })));
}

sec('Q2 · Check-in-Serie: IMMER volles Fenster — der 29-Tage-P0');
{
  const day = n => { const d = new Date('2026-08-08T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const db = {};
  db[day(29)] = { morning: { ill: true } };
  const serie = OS.checkinSeries(db, '2026-08-08');
  ok('die Serie umfasst das volle Fenster (' + OS.CHECKIN_WINDOW_DAYS + ' Tage), keine Abbruchbedingung',
    serie.length === OS.CHECKIN_WINDOW_DAYS, String(serie.length));
  ok('der positive Tag 29 IST in der Serie (v8-302: nie erreichbar)',
    serie.some(c => c.date === day(29) && c.ill === true));
  const db179 = {}; db179[day(179)] = { morning: { ill: true } };
  ok('Tag 179 wird gefunden', OS.checkinSeries(db179, '2026-08-08').some(c => c.ill === true));
  const db181 = {}; db181[day(181)] = { morning: { ill: true } };
  ok('Tag 181 liegt jenseits der dokumentierten Kappe',
    !OS.checkinSeries(db181, '2026-08-08').some(c => c.ill === true));
  ok('ohne DB oder Datum: undefined (Quelle fehlt ⇒ basis unavailable, nicht leere Serie)',
    OS.checkinSeries(null, '2026-08-08') === undefined && OS.checkinSeries({}, null) === undefined);
}

sec('Q3 · observed-Politik: übersetzt, ausgewiesen, konsistent');
{
  const cs = OS.safetyConstraints({ constraintsList: [
    { bodyRegion: 'knee', intensity: 8, status: 'observed' },
    { bodyRegion: 'hip', intensity: 8, status: 'resolved' },
    { bodyRegion: 'foot', intensity: 8, status: 'improved' },
    { bodyRegion: 'back', intensity: 2, currentlyTrainable: false, status: 'observed' }
  ] });
  ok('observed wird projiziert (profile-center/decision-engine-Semantik)',
    cs.some(c => c.bodyRegion === 'knee' && c.status === 'observed'));
  ok('resolved und improved werden NICHT projiziert',
    !cs.some(c => c.bodyRegion === 'hip') && !cs.some(c => c.bodyRegion === 'foot'));
  ok('currentlyTrainable:false bleibt auch als observed erhalten',
    cs.some(c => c.bodyRegion === 'back' && c.currentlyTrainable === false));
  /* Und die Uebersetzung (observer-input@5) weist observed aus. */
  const OI = require(join(APP, 'js/engine/observer-input.js'));
  const snap = OI.build({ userId: 'u1', today: '2026-08-08', profileConstraints: cs });
  const knee = snap.derived.constraints.find(c => c.region === 'knee');
  const back = snap.derived.constraints.find(c => c.region === 'back');
  ok('observed ⇒ evidence weak + reviewStatus observed (Politik-Entscheid @5)',
    knee && knee.evidence === 'weak' && knee.reviewStatus === 'observed' && knee.severity === 2);
  ok('observed + currentlyTrainable:false ⇒ trotzdem Vollsperre (der Nutzer HAT es gesagt)',
    back && back.severity === 3 && back.blocks.indexOf('all') >= 0);
}

sec('Q4 · Kohorte und Einhängung');
{
  const SA = require(join(APP, 'js/engine/shadow-adaptive.js'));
  ok('die Kohorte führt die Quellenbeschaffung als eigenes Feld',
    SA.COHORT_FIELDS.indexOf('source') >= 0);
  ok('currentCohort liest die Quellversion',
    SA.currentCohort({ observerSource: OS }).versions.source === 'observer-source@2');
  const pin = JSON.parse(readFileSync(join(HERE, '_acceptance-cohort.json'), 'utf8'));
  ok('der Pin führt sie', pin.versions.source === 'observer-source@2', pin.key);
  ok('Modul ist eingehängt (VOR observer-input)',
    (() => { const h = readFileSync(join(APP, 'index.html'), 'utf8');
      return h.indexOf('observer-source.js') > 0 && h.indexOf('observer-source.js') < h.indexOf('observer-input.js'); })());
  ok('Modul ist im Cache-Manifest', /observer-source\.js/.test(readFileSync(join(APP, 'sw.js'), 'utf8')));
  ok('Modul ist in der Versionsdrift-Bewachung',
    /observer-source\.js/.test(readFileSync(join(HERE, 'module_version_drift_test.mjs'), 'utf8')));
}

console.log('\n' + '═'.repeat(62));
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
