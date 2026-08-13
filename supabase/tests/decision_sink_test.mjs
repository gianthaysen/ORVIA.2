/* ORVIA · decision-sink — die ECHTE Produktions-Senke, verhaltensgeprueft

   Der Befund (v8-304c-Review): Es gab ZWEI handgepflegte Spaltenabbildungen
   Record → engine_decision_log — die produktive _sink() in ui.js und ein
   eigenes toRow() im Live-Test. Sie waren bereits auseinandergelaufen: dem
   Live-Test fehlten parent_decision_id, supersedes_decision_id und week_id.
   Ein gruener Live-Test bewies damit NICHT, dass die App-Senke funktioniert.

   Seit v8-305 gibt es genau EINE Abbildung: decisionLog.toRow() (rein,
   fail-closed). v8-306 schliesst Gians drei Nachbefunde: (1) die Senke
   meldete {data,error}-Aufloesungen (echte supabase-js-Fehlersemantik!)
   als Erfolg; (2) die Registrierung setSink(_sink) war unbewiesen;
   (3) der Schemawaechter las nur 0032 statt der append-only-Kette.
   Dieser Test beweist am VERHALTEN:
     S1 Die echte _sink() aus ui.js schreibt exakt die toRow()-Zeile.
     S2 Die Zeile deckt exakt die client-geschriebenen Spalten der
        GESAMTEN Migrationskette (create table + spaetere add/drop column).
     S3 Fail-closed in jeder Richtung: kein User, kein toRow, verletzte
        NOT-NULL-Quelle, {data,error}-Aufloesung, Rejection.
     S4 Die drei historisch verlorenen Spalten sind in der Zeile.
     S5 Die echte Registrierungszeile laeuft; DL.logDecision() erreicht
        den Supabase-Spion — App -> registrierte Senke -> Client.

   node supabase/tests/decision_sink_test.mjs [appRoot] */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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

const DL = require(join(APP, 'js/engine/decision-log.js'));
const uiRaw = readFileSync(join(APP, 'js/ui.js'), 'utf8');

function sliceBalanced(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) throw new Error('Slice fehlt: ' + marker);
  let d = 0, started = false;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') { d++; started = true; }
    else if (ch === '}') { d--; if (started && d === 0) {
      let k = j + 1; while (k < src.length && /\s/.test(src[k])) k++;
      return src.slice(i, src[k] === ';' ? k + 1 : j + 1);
    } }
  }
  throw new Error('unbalancierter Slice: ' + marker);
}

/* Die ECHTE _sink() aus ui.js — kein Nachbau. Faellt der Marker weg oder
   aendert sich die Struktur, bricht der Slice und der Test wird rot. */
const sinkSrc = sliceBalanced(uiRaw, 'function _sink(');
const mkSink = O => new Function('O', sinkSrc + '\nreturn _sink;')(O);

/* Supabase-Spion: faengt insert-Zeilen, antwortet mit der ECHTEN
   supabase-js-Semantik (v8-306, Gians Befund): SQL-/Constraint-Fehler
   LEHNEN NICHT AB, sie loesen mit {data,error} auf. Nur Transportfehler
   (Netz) rejecten. Ein Spion, der nur Rejection nachbildet, verpasst
   genau den Pfad, auf dem die alte Senke jeden Constraint-Tod als
   Erfolg meldete. */
function mkSpy(behavior) {
  const inserts = [];
  return { inserts, sb: { from: table => ({ insert: row => {
    inserts.push({ table, row });
    if (behavior === 'reject') return Promise.reject(new Error('netz weg'));
    if (behavior === 'sqlerror') return Promise.resolve({ data: null, error: { message: 'violates check constraint', code: '23514' } });
    return Promise.resolve({ data: [row], error: null });
  } }) } };
}

/* Ein echter Record aus der echten Fabrik — inklusive Kettenfeldern. */
const built = DL.build({
  decisionType: 'shadow_observation', decisionId: 'dec:test:1',
  parentDecisionId: 'dec:test:0', supersedesDecisionId: 'dec:test:-1',
  timestamp: '2026-08-09T06:00:00Z', weekId: '2026-W32', planId: 'p-sink',
  inputs: { a: 1 }, derivedState: { b: 2 }, constraints: { c: 3 },
  rulesTriggered: ['r1'], registry: {}
});
if (!built.valid) throw new Error('Fixture-Record ungueltig: ' + built.errors.join(','));
const REC = built.record;

/* ══════════════════════════════════════════════════════════════ */
sec('S1 · Die echte _sink() schreibt exakt die toRow()-Zeile');
{
  const spy = mkSpy('ok');
  const sink = mkSink({ sb: spy.sb, user: { id: 'u-sink' }, decisionLog: DL });
  const r = await Promise.resolve(sink(REC));
  ok('die Senke meldet Erfolg', r === true, String(r));
  ok('genau EIN Insert in engine_decision_log',
    spy.inserts.length === 1 && spy.inserts[0].table === 'engine_decision_log',
    JSON.stringify(spy.inserts.map(x => x.table)));
  const row = spy.inserts[0] && spy.inserts[0].row;
  const expected = DL.toRow(REC, 'u-sink');
  ok('… und die Zeile ist BYTE-GLEICH zu decisionLog.toRow() — eine Abbildung, kein Nachbau',
    expected.ok === true && JSON.stringify(row) === JSON.stringify(expected.row));
  ok('… user_id entsteht in der Senke aus dem angemeldeten Nutzer',
    row && row.user_id === 'u-sink');
}

/* ══════════════════════════════════════════════════════════════ */
sec('S2 · Spaltenvertrag GEGEN DIE MIGRATIONSKETTE, nicht gegen eine Liste');
{
  /* v8-306 (Gians Beweisluecke 3): Migrationen sind append-only — eine
     kuenftige Spalte kaeme in 0035+, waehrend 0032 unveraendert bliebe.
     Nur 0032 zu lesen haette „neue Spalte ⇒ Test rot" NICHT eingeloest.
     Deshalb laeuft der Waechter ueber ALLE Migrationen in Reihenfolge:
     create table (0032) liefert die Basis, jedes spaetere
     add/drop column auf engine_decision_log wird eingerechnet.
     add constraint (0033: decision_type-CHECK) aendert keine Spalten. */
  const MIG = join(HERE, '..', 'migrations');
  const files = readdirSync(MIG).filter(f => f.endsWith('.sql')).sort();
  let base = null; const addedCols = [], droppedCols = [], unparsed = [];
  for (const f of files) {
    const sql = readFileSync(join(MIG, f), 'utf8');
    if (!/engine_decision_log/.test(sql)) continue;
    const ct = sql.match(/create table if not exists public\.engine_decision_log \(([\s\S]*?)\n\);/);
    if (ct) {
      base = ct[1].split('\n')
        .map(l => (l.match(/^\s{2}([a-z_]+)\s+\S/) || [])[1])
        .filter(Boolean)
        .filter(c => ['unique', 'constraint', 'check', 'primary', 'foreign'].indexOf(c) < 0);
    }
    const alters = sql.match(/alter\s+table[\s\S]*?engine_decision_log[\s\S]*?;/gi) || [];
    for (const a of alters) {
      let m;
      const ra = /add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_]+)/gi;
      while ((m = ra.exec(a))) addedCols.push(m[1]);
      const rd = /drop\s+column\s+(?:if\s+exists\s+)?([a-z_]+)/gi;
      while ((m = rd.exec(a))) droppedCols.push(m[1]);
      /* PARSER-VERTRAG (v8-306b, Gians Grenzbefund): Dieser Waechter
         versteht add/drop column und ignoriert BEWUSST Constraint-
         Aenderungen (0033: CHECK auf decision_type — aendert keine
         Spaltenmenge). Was er NICHT versteht, darf nicht stillschweigend
         passieren: ein rename (Spalte oder Tabelle) aenderte die
         Spaltenmenge, ohne dass add/drop es sichtbar macht — der
         Waechter bliebe gruen und wuerde luegen. Deshalb fail-closed:
         unverstandene Schemaaenderung ⇒ rot, bis der Parser (und
         toRow) sie ausdruecklich behandeln. */
      if (/rename\s+(column|to)\b/i.test(a)) unparsed.push(f + ': ' + a.replace(/\s+/g, ' ').slice(0, 90));
    }
  }
  ok('die Kette enthaelt das create table (0032)', Array.isArray(base) && base.length >= 20,
    String(base && base.length));
  ok('keine Schemaaenderung ausserhalb des Parser-Vertrags (add/drop column; Constraints bewusst frei)',
    unparsed.length === 0, unparsed.join(' | '));
  const cols = base.concat(addedCols)
    .filter(c => droppedCols.indexOf(c) < 0)
    .filter((c, i, arr) => arr.indexOf(c) === i)
    /* Serverseitig, entstehen NICHT im Client: */
    .filter(c => c !== 'id' && c !== 'created_at');
  const row = DL.toRow(REC, 'u-sink').row;
  const have = Object.keys(row).sort();
  const want = cols.slice().sort();
  ok('Plausibilitaet: >= 22 client-geschriebene Spalten in der Kette (heute: 22 + '
      + addedCols.length + ' nachtraeglich)',
    cols.length >= 22, String(cols.length));
  ok('toRow() deckt EXAKT die Spalten der GESAMTEN Kette — nichts fehlt, nichts erfunden',
    JSON.stringify(have) === JSON.stringify(want),
    'fehlt: ' + want.filter(c => have.indexOf(c) < 0).join(',') +
    ' | erfunden: ' + have.filter(c => want.indexOf(c) < 0).join(','));
}

/* ══════════════════════════════════════════════════════════════ */
sec('S3 · Fail-closed in jeder Richtung');
{
  const rec = REC;
  { const spy = mkSpy('ok');
    const sink = mkSink({ sb: spy.sb, user: null, decisionLog: DL });
    const r = await Promise.resolve(sink(rec));
    ok('ohne Nutzer: false, KEIN Insert', r === false && spy.inserts.length === 0); }
  { const spy = mkSpy('ok');
    const sink = mkSink({ sb: null, user: { id: 'u' }, decisionLog: DL });
    const r = await Promise.resolve(sink(rec));
    ok('ohne Supabase-Client: false', r === false); }
  { const spy = mkSpy('ok');
    const sink = mkSink({ sb: spy.sb, user: { id: 'u' }, decisionLog: { } });
    const r = await Promise.resolve(sink(rec));
    ok('decisionLog ohne toRow (Ladefehler-Szenario): false, KEIN Insert',
      r === false && spy.inserts.length === 0); }
  { const spy = mkSpy('ok');
    const sink = mkSink({ sb: spy.sb, user: { id: 'u' }, decisionLog: DL });
    const kaputt = Object.assign({}, rec); delete kaputt.decisionHash;
    const r = await Promise.resolve(sink(kaputt));
    ok('Record ohne decisionHash (NOT-NULL-Quelle): false, KEIN Insert — der Fehlerort ist toRow, nicht der Constraint',
      r === false && spy.inserts.length === 0); }
  { const m = DL.toRow(Object.assign({}, rec, { decisionId: null }), 'u');
    ok('… und toRow() benennt die verletzte Pflicht',
      m.ok === false && /not_null_missing:.*decision_id/.test(m.reason), m.reason); }
  { const spy = mkSpy('sqlerror');
    const sink = mkSink({ sb: spy.sb, user: { id: 'u' }, decisionLog: DL });
    const r = await Promise.resolve(sink(rec));
    ok('SQL-/Constraint-Fehler ({data,error}-Aufloesung, KEINE Rejection): false — der v8-305-Fehler meldete hier true',
      r === false, String(r)); }
  { const spy = mkSpy('reject');
    const sink = mkSink({ sb: spy.sb, user: { id: 'u' }, decisionLog: DL });
    const r = await Promise.resolve(sink(rec));
    ok('Transportfehler (Rejection): false, wirft NICHT', r === false); }
}

/* ══════════════════════════════════════════════════════════════ */
sec('S5 · DIE REGISTRIERUNG: DL.logDecision erreicht die Senke');
{
  /* Gians Beweisluecke 2: _sink() direkt aufzurufen beweist nicht, dass
     die App sie auch REGISTRIERT. Verschwaende die setSink-Zeile aus
     ui.js, blieben Senken- und Live-Test gruen — und die App persistierte
     nichts. Hier laeuft die ECHTE Registrierungszeile aus ui.js, danach
     muss ein Insert ueber das echte DL.logDecision() beim Spion ankommen. */
  const regLine = uiRaw.split('\n').find(l => l.indexOf('setSink(_sink)') >= 0);
  ok('die Registrierungszeile existiert in ui.js', !!regLine, 'setSink(_sink) fehlt');
  const spy = mkSpy('ok');
  const O = { sb: spy.sb, user: { id: 'u-reg' }, decisionLog: DL };
  new Function('O', sinkSrc + '\n' + (regLine || ''))(O);
  const res = DL.logDecision({ decisionType: 'shadow_observation',
    decisionId: 'dec:reg:1', timestamp: '2026-08-09T07:00:00Z',
    planId: 'p-reg', derivedState: { via: 'registration' }, registry: {} });
  await new Promise(r => setTimeout(r, 0));
  ok('logDecision meldet queued (Senke vorhanden)',
    res.stored === true && res.reason === 'queued', res.reason);
  ok('… und der Insert kommt beim Supabase-Spion an — App → registrierte Senke → Client',
    spy.inserts.length === 1 && spy.inserts[0].row.decision_id === 'dec:reg:1' &&
    spy.inserts[0].row.user_id === 'u-reg',
    String(spy.inserts.length));
  ok('… als vollstaendige toRow()-Zeile, nicht als Rohrecord',
    spy.inserts.length === 1 &&
    JSON.stringify(Object.keys(spy.inserts[0].row).sort()) ===
    JSON.stringify(Object.keys(DL.toRow(REC, 'x').row).sort()));
  DL.setSink(null); /* Modul-Singleton: Zustand fuer Folgetests zuruecksetzen */
}

/* ══════════════════════════════════════════════════════════════ */
sec('S4 · Die drei historisch verlorenen Spalten');
{
  const row = DL.toRow(REC, 'u-sink').row;
  ok('parent_decision_id ist in der Zeile (fehlte im alten Live-Test-toRow)',
    row.parent_decision_id === 'dec:test:0');
  ok('supersedes_decision_id ist in der Zeile (fehlte ebenda)',
    row.supersedes_decision_id === 'dec:test:-1');
  ok('week_id ist in der Zeile (fehlte ebenda)',
    row.week_id === '2026-W32');
  const live = readFileSync(join(HERE, 'prediction_observer_live_test.mjs'), 'utf8');
  ok('der Live-Test hat KEINE eigene Spaltenabbildung mehr (nutzt DL.toRow)',
    /DL\.toRow\(/.test(live) && !/parent_decision_id\s*:/.test(live));
  const sinkHasOwnMap = /user_id\s*:/.test(sinkSrc);
  ok('die Senke selbst hat KEINE eigene Spaltenabbildung mehr', !sinkHasOwnMap);
}

console.log('\n' + '═'.repeat(62));
console.log('Ergebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
if (fail) process.exit(1);
