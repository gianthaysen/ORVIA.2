/* ORVIA · S1/E4 (12.09.2026) — pb-sync: gemessene Bestzeiten aus Aktivitaeten ins Profil.
   Befund: der Resolver las nur manuelle personalBests/tests — ein realer Wettkampf zaehlte nicht. */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const APP = ['../../app/', '../../'].map(p => new URL(p, import.meta.url)).find(u => existsSync(new URL('js/engine/pb-sync.js', u)));
const PB = require(new URL('js/engine/pb-sync.js', APP).pathname);
const RB = require(new URL('js/run-bests.js', APP).pathname);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const act = (id, sport, km, sec, date) => ({ clientRecordId: id, sportId: sport, status: 'completed', startedAt: date + 'T08:00:00Z', summary: { distance_m: km * 1000 }, durationSeconds: sec });

const acts = [act('hm', 'running', 21.18, 6730, '2026-09-06'), act('b1', 'cycling', 20.4, 2400, '2026-08-30'), act('s1', 'swimming', 0.41, 540, '2026-09-01')];
const meas = RB.measuredAllBests(acts);

/* A · entries */
{
  const e = PB.entries(meas);
  ok('A1 drei Eintraege (HM, Rad 20, Schwimmen 400)', e.length === 3, e.map(x => x.id).join(','));
  const hm = e.find(x => x.sportId === 'running');
  ok('A2 HM: distance „21.0975 km", timeSeconds 6730, source activity, measuredAt 2026-09-06', hm.distance === '21.0975 km' && hm.timeSeconds === 6730 && hm.source === 'activity' && hm.measuredAt === '2026-09-06');
  ok('A3 extra traegt activityId + Methode + gemessene km', hm.extra.activityId === 'hm' && hm.extra.method === 'activity_total' && hm.extra.measuredKm === 21.18);
  ok('A4 Kontext ohne Wettkampf-Kennung: „Aktivität (gemessen)"', hm.context === 'Aktivität (gemessen)');
  const e2 = PB.entries(meas, { raceActivityIds: ['hm'] });
  ok('A5 als Wettkampf gekennzeichnete Aktivitaet ⇒ Kontext „Wettkampf" (Resolver stuft als race ein)', e2.find(x => x.sportId === 'running').context === 'Wettkampf');
  ok('A6 Schwimmen: „400 m"', e.find(x => x.sportId === 'swimming').distance === '400 m');
}
/* B · merge: manuelle Eintraege bleiben, Auto-Eintraege folgen den Aktivitaeten */
{
  const manual = { id: 'pb_m1', sportId: 'running', distance: '10 km', timeSeconds: 2900, source: 'manual', context: 'Wettkampf', measuredAt: '2026-06-21' };
  const r1 = PB.merge([manual], meas);
  ok('B1 erster Lauf: 3 hinzugefuegt, manueller Eintrag bleibt, changed', r1.added === 3 && r1.removed === 0 && r1.changed && r1.list.length === 4 && r1.list[0].id === 'pb_m1');
  const r2 = PB.merge(r1.list, meas);
  ok('B2 zweiter Lauf mit gleichen Daten: nichts geaendert (kein Schreibsturm)', r2.added === 0 && r2.removed === 0 && !r2.changed);
  const less = RB.measuredAllBests(acts.filter(a => a.clientRecordId !== 'b1'));
  const r3 = PB.merge(r1.list, less);
  ok('B3 Aktivitaet weg (Tombstone) ⇒ ihr Eintrag weg, manueller bleibt', r3.removed === 1 && r3.changed && r3.list.length === 3 && r3.list.some(x => x.id === 'pb_m1'));
  const faster = RB.measuredAllBests(acts.concat([act('hm3', 'running', 21.2, 6500, '2026-10-18')]));
  const r4 = PB.merge(r1.list, faster);
  ok('B4 schnellerer HM ersetzt den alten Auto-Eintrag (eine Zeile je Sport/Distanz)', r4.list.filter(x => x.sportId === 'running' && x.source === 'activity').length === 1 && r4.list.find(x => x.sportId === 'running' && x.source === 'activity').timeSeconds === 6500 && r4.changed);
  ok('B5 merge ist rein (Eingabe unveraendert)', r1.list.length === 4);
}
/* C · Modell + Resolver akzeptieren die Quelle */
{
  const sb = { window: null }; sb.window = sb; sb.self = sb; sb.globalThis = sb; vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('js/profile-model.js', APP), 'utf8'), sb, { filename: 'profile-model.js' });
  const M = sb.ORVIA.profileModel;
  ok('C1 PERF_SOURCES kennt activity (sonst wuerde normalize auf manual zurueckfallen)', M.PERF_SOURCES.indexOf('activity') >= 0);
  const norm = M.normalizePerformance({ personalBests: PB.entries(meas, { raceActivityIds: ['hm'] }) }, {});
  ok('C2 normalizePerformance behaelt source activity und extra', norm.personalBests[0].source === 'activity' && norm.personalBests[0].extra.activityId === 'hm');
  ['js/engine/evidence.js', 'js/engine/performance-zones.js', 'js/engine/performance-resolver.js'].forEach(f => { try { vm.runInContext(readFileSync(new URL(f, APP), 'utf8'), sb, { filename: f }); } catch (e) {} });
  const PR = sb.ORVIA.performanceResolver;
  if (PR && typeof PR.runningInput === 'function') {
    const inp = PR.runningInput({ performance: norm });
    ok('C3 Resolver: HM-Aktivitaet wird zum Wettkampf-Beleg (race, 21.0975 km)', inp.races.some(r => r.kind === 'race' && Math.abs(r.distanceKm - 21.0975) < 0.01), JSON.stringify(inp.races));
  } else ok('C3 Resolver-Eingang pruefbar (runningInput exportiert)', false, 'runningInput fehlt im Export — Pruefung ueber resolveAll noetig');
}
/* D · Verdrahtung */
{
  const pf = readFileSync(new URL('js/profile.js', APP), 'utf8');
  ok('D1 profile.js: _pbSyncFromActivities haengt an auth-ready, activities-pulled, activity-updated', /addEventListener\('orvia:auth-ready',function\(\)\{setTimeout\(_pbSyncFromActivities/.test(pf) && /orvia:activities-pulled/.test(pf) && /orvia:activity-updated',function\(\)\{setTimeout\(_pbSyncFromActivities/.test(pf));
  ok('D2 … schreibt nur bei changed und ueber _profileSave', /if\(!r\.changed\)return r;[\s\S]{0,200}_profileSave\(\['performance'\]/.test(pf));
  const idx = readFileSync(new URL('index.html', APP), 'utf8'), sw = readFileSync(new URL('sw.js', APP), 'utf8');
  ok('D3 pb-sync.js in index.html (nach run-bests.js) und im SW-Vorrat', idx.indexOf('js/engine/pb-sync.js') > idx.indexOf('js/run-bests.js') && sw.indexOf("'./js/engine/pb-sync.js'") > 0);
}
console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
