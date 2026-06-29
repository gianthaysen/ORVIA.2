/* ORVIA · Phase 3 — training_load_daily Aggregation + Lastsprung (Unit-Tests).
   node supabase/tests/training_load_phase3_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

global.window = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js');
load('js/repos/trainingLoadRepository.js');
const O = global.window.ORVIA;
const Calc = (await import(new URL('../../js/calc.js', import.meta.url))).default;

let ROWS = [], EQ = [], DELETED = [];
function sbStub() {
  const obj = {}; let _del = false;
  ['select', 'gte', 'lte', 'order', 'limit', 'insert', 'update', 'not', 'upsert'].forEach(m => obj[m] = () => obj);
  obj.delete = () => { _del = true; return obj; };
  obj.eq = (k, v) => { EQ.push([k, v]); if (_del && k === 'id') DELETED.push(v); return obj; };
  obj.then = (res, rej) => Promise.resolve({ data: ROWS, error: null }).then(res, rej);
  return { from: () => obj };
}
const shape = r => r && typeof r.success === 'boolean';

const run = async () => {
  O.user = { id: 'A' }; O.sb = sbStub(); navigator.onLine = true;

  // toRow: computed_load = dur * rpe (Mobilität rpe 2)
  const row = O.repos.trainingLoad.toRow('2026-06-19', 'Laufen', { dur: 40, rpe: 4, dist: 8, hr: 150, client_session_id: 'blob:2026-06-19:Laufen' });
  ok('toRow: computed_load = 40*4 = 160', row.computed_load === 160 && row.sport === 'Laufen' && row.client_session_id === 'blob:2026-06-19:Laufen');
  const mob = O.repos.trainingLoad.toRow('2026-06-19', 'Mobilität', { dur: 20 });
  ok('toRow: Mobilität rpe 2 → load 40', mob.computed_load === 40);

  // getDailyLoad: aggregiert Σ computed_load je Tag (mehrere Sessions/Tag korrekt)
  ROWS = [
    { local_date: '2026-06-18', computed_load: 100 },
    { local_date: '2026-06-19', computed_load: 160 },
    { local_date: '2026-06-19', computed_load: 40 },   // zweite Einheit am selben Tag
    { local_date: '2026-06-20', computed_load: 0 }
  ];
  const dl = await O.repos.trainingLoad.getDailyLoad('2026-06-01', '2026-06-30');
  ok('getDailyLoad aggregiert', shape(dl) && dl.success);
  const d19 = dl.data.find(x => x.local_date === '2026-06-19');
  ok('Mehrere Sessions/Tag summiert (160+40=200)', d19 && d19.load === 200);
  ok('Tag ohne Last = 0 (nicht fehlend)', dl.data.find(x => x.local_date === '2026-06-20').load === 0);

  // Dedupe-Prinzip: Konflikt-Key client_session_id (gleiche ID → Update, kein Doppelzählen)
  ok('Konflikt-Key client_session_id vorhanden', O.repos.trainingLoad.conflictKey({ client_session_id: 'x' }) === 'user_id,client_session_id');
  ok('externe Aktivität dedupe über external_id', O.repos.trainingLoad.conflictKey({ external_id: 'e1' }) === 'user_id,source,external_id');

  // loadSpikeInfo: genügend Historie → konkrete Zahlen
  const series = []; for (let i = 0; i < 7; i++) series.push({ local_date: 'd' + i, load: 100 });
  series[6].load = 220; series[5].load = 220; series[4].load = 220; // letzte 3 hoch
  const ls = Calc.loadSpikeInfo(series);
  ok('loadSpikeInfo: enough + konkrete acute/chronic/ratio', ls.enough === true && ls.acute > ls.chronic && typeof ls.spikePct === 'number');
  ok('loadSpikeInfo: spike erkannt (>1.4)', ls.spike === true);

  // zu wenig Historie → kein erfundener Prozentwert
  const lsShort = Calc.loadSpikeInfo([{ load: 100 }, { load: 100 }]);
  ok('zu wenig Historie → enough:false, kein %-Wert', lsShort.enough === false && lsShort.spikePct == null);

  // chronische Last 0 → kein Sprung (keine Division durch ~0)
  const lsZero = Calc.loadSpikeInfo([0, 0, 0, 0, 0, 0, 0].map((l, i) => ({ load: l })));
  ok('chronische Last 0 → enough:false (keine Division)', lsZero.enough === false);

  // gleichmäßige Last → kein Spike
  const flat = []; for (let i = 0; i < 10; i++) flat.push({ load: 100 });
  ok('gleichmäßige Last → kein Spike', Calc.loadSpikeInfo(flat).spike === false);
  // viele Nulltage → Datenqualität zu gering, kein Sprung
  const sparse = [0, 0, 0, 0, 0, 200, 0]; // nur 1 Aktivitätstag in 7
  ok('viele Nulltage → enough:false (Datenqualität)', Calc.loadSpikeInfo(sparse.map(l => ({ load: l }))).enough === false);

  // ---- getDailyLoadSeries: vollständige Tagesreihe mit Nulltagen ----
  ROWS = [{ local_date: '2026-06-02', computed_load: 100 }, { local_date: '2026-06-04', computed_load: 50 }];
  const dseries = await O.repos.trainingLoad.getDailyLoadSeries('2026-06-01', '2026-06-05', { fillMissing: true });
  ok('getDailyLoadSeries: 5 Punkte (Bereich vollständig)', dseries.success && dseries.data.length === 5);
  ok('fehlende Tage = 0 + hasData false', dseries.data[0].load === 0 && dseries.data[0].hasData === false && dseries.data.find(x => x.local_date === '2026-06-02').load === 100);
  ok('Reihe chronologisch + keine Doppeltage', dseries.data.map(x => x.local_date).join(',') === '2026-06-01,2026-06-02,2026-06-03,2026-06-04,2026-06-05');
  const raw = await O.repos.trainingLoad.getDailyLoad('2026-06-01', '2026-06-05');
  ok('Rohmodus bleibt nur 2 Tage', raw.data.length === 2);

  // ---- pruneManualDay: nur source=manual, externe bleiben, strukturierte Rückgabe ----
  EQ = []; DELETED = [];
  ROWS = [{ id: 'm1', client_session_id: 'blob:2026-06-19:Laufen', source: 'manual' }, { id: 'm2', client_session_id: 'blob:2026-06-19:Gym', source: 'manual' }];
  const pr = await O.repos.trainingLoad.pruneManualDay('2026-06-19', ['blob:2026-06-19:Laufen']);
  ok('pruneManualDay: SELECT filtert source=manual', EQ.some(e => e[0] === 'source' && e[1] === 'manual'));
  ok('pruneManualDay: nur nicht-gehaltene manuelle Zeile gelöscht (m2)', pr.success && pr.data.deleted === 1 && DELETED.includes('m2') && !DELETED.includes('m1'));
  ok('pruneManualDay: strukturierte Rückgabe {deleted,failed,errors}', pr.data.failed === 0 && Array.isArray(pr.data.errors));

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });
