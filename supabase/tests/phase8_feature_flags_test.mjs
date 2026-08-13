/* ORVIA · Phase 8.4 — serverseitiger Schaltkanal (Canary-Gate)

   WAS HIER BEWIESEN WERDEN MUSS: Das Canary-Gate verlangt „Feature serverseitig
   deaktivierbar". Diese Zusage ist nur so viel wert wie ihre schwächste Stelle.
   Die drei Stellen, an denen sie brechen könnte, sind:

     (A) FAIL-CLOSED. Jeder Ausgang außer „Zeile gelesen, enabled === true" muss
         AUS ergeben — kein Nutzer, kein Client, offline, Abfragefehler, fehlende
         Zeile, abgelaufener Zwischenstand. Ein Fehler, der ein Feature EINschaltet,
         wäre der gefährlichste Defekt dieses Moduls: er tritt genau dann auf, wenn
         man abschalten will.

     (B) DER CLIENT DARF NICHT SELBST EINSCHALTEN. Gäbe es einen Client-Weg zum
         Aktivieren, wäre die Serverkontrolle wertlos. Geprüft wird beides: das
         Modul bietet keine set-Funktion, UND die Migration vergibt keine
         Schreib-Policy für `authenticated` (ohne Policy blockt RLS jeden Write).

     (C) EIN ABGESCHALTETES FLAG DARF NICHT LOKAL WEITERLEBEN. Weder über einen
         Cache ohne Ablauf noch über einen Offline-Zustand, der den letzten
         bekannten Wert verlängert.

   Zusätzlich: Vertragsgleichheit zwischen Modul (KNOWN) und Migration
   (CHECK-Constraint). Driften die auseinander, ließe sich ein Flag setzen, das der
   Client nie liest — oder umgekehrt eines lesen, das die Datenbank ablehnt.

   Reines Node, kein Browser: das Modul hat bewusst keine DOM-Abhängigkeit.
   node supabase/tests/phase8_feature_flags_test.mjs [appRoot-absolut] */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
/* ROBUSTE APP-AUFLOESUNG: Das Repo existiert in zwei Layouts — kanonisch
   (app/supabase/tests, App-Wurzel = HERE/../..) und umstrukturiert
   (supabase/tests neben app/, App-Wurzel = HERE/../../app). Eine starre
   Aufloesung fand im jeweils anderen Layout den falschen Ordner und liess
   die GANZE Suite scheinbar fehlschlagen (0/46 statt gruen). Gesucht wird
   deshalb der erste Kandidat mit index.html UND js/engine. */
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

/* Steuerbare Uhr: das Modul nimmt ORVIA.clock.now, wenn vorhanden. Ohne diese
   Steuerung ließe sich der TTL-Ablauf nur durch echtes Warten prüfen. */
globalThis.ORVIA = globalThis.ORVIA || {};
let NOW = 1754400000000;
globalThis.ORVIA.clock = { now: () => NOW };
const setOnline = v => Object.defineProperty(globalThis, 'navigator', { value: { onLine: v }, configurable: true, writable: true });
setOnline(true);

const FF = require(join(APP, 'js/engine/feature-flags.js'));

/* Minimaler Supabase-Doppelgänger: nur das, was das Modul wirklich aufruft
   (from().select().eq() → Promise). Absichtlich kein echter Client — geprüft
   wird das Verhalten des Moduls, nicht das von supabase-js. */
function mkClient(handler) {
  return { from: (table) => ({ select: (cols) => ({ eq: (col, val) => Promise.resolve(handler({ table, cols, col, val })) }) }) };
}
const rows = (arr) => mkClient(() => ({ data: arr, error: null }));
const errClient = (msg) => mkClient(() => ({ data: null, error: new Error(msg || 'boom') }));

const reset = () => { FF.killSwitch(); delete globalThis.ORVIA.user; delete globalThis.ORVIA.sb; setOnline(true); };

/* ============ 1) Grundzustand ============ */
sec('A · Grundzustand ist AUS');
reset();
ok('vor jedem Laden ist jedes bekannte Flag aus',
   FF.KNOWN.every(f => FF.isEnabled(f) === false));
ok('describe meldet ehrlich „nie geladen"',
   FF.KNOWN.every(f => ['never_loaded', 'kill_switch'].indexOf(FF.describe(f).source) >= 0));
ok('ein unbekannter Flagname ist aus und wird als unbekannt markiert',
   FF.isEnabled('engine_v3_zauberei') === false && FF.describe('engine_v3_zauberei').known === false);
ok('snapshot deckt genau die bekannten Flags ab',
   JSON.stringify(Object.keys(FF.snapshot()).sort()) === JSON.stringify(FF.KNOWN.slice().sort()));

/* ============ 2) Fail-closed in jedem Fehlerausgang ============ */
sec('A · Fail-closed — jeder Fehlerausgang ergibt AUS');

const cases = [];

reset();
cases.push(FF.refresh({ force: true }).then(r => {
  ok('ohne Nutzer und ohne Client: aus, mit benanntem Grund',
     r.ok === false && r.reason === 'no_client_or_user' && FF.KNOWN.every(f => FF.isEnabled(f) === false));
}));

await Promise.all(cases.splice(0));

/* Nutzer vorhanden, aber kein Client */
globalThis.ORVIA.user = { id: 'u1' };
await FF.refresh({ force: true }).then(r => {
  ok('mit Nutzer, aber ohne Supabase-Client: aus',
     r.ok === false && r.reason === 'no_client_or_user' && FF.isEnabled('engine_v2_plan') === false);
});

/* Client vorhanden, aber kein Nutzer */
delete globalThis.ORVIA.user;
globalThis.ORVIA.sb = rows([{ flag: 'engine_v2_plan', enabled: true }]);
await FF.refresh({ force: true }).then(r => {
  ok('mit Client, aber ohne angemeldeten Nutzer: aus — auch wenn die Tabelle true enthielte',
     r.ok === false && FF.isEnabled('engine_v2_plan') === false);
});

/* Abfragefehler */
globalThis.ORVIA.user = { id: 'u1' };
globalThis.ORVIA.sb = errClient('relation does not exist');
await FF.refresh({ force: true }).then(r => {
  ok('Abfragefehler (z. B. Tabelle fehlt): aus, Grund query_failed',
     r.ok === false && r.reason === 'query_failed' && FF.isEnabled('engine_v2_plan') === false);
});

/* Antwort unlesbar (kein Array) */
globalThis.ORVIA.sb = mkClient(() => ({ data: { unerwartet: true }, error: null }));
await FF.refresh({ force: true });
ok('unlesbare Antwortform: aus statt Absturz',
   FF.KNOWN.every(f => FF.isEnabled(f) === false));

/* Client wirft synchron */
globalThis.ORVIA.sb = { from: () => { throw new Error('client kaputt'); } };
await FF.refresh({ force: true }).then(r => {
  ok('geworfener Fehler im Client: aus statt unbehandelter Ausnahme',
     r.ok === false && FF.isEnabled('engine_v2_plan') === false);
});

/* ============ 3) Nur ein ausdrückliches true schaltet ein ============ */
sec('A · Nur ein ausdrückliches true schaltet ein');
globalThis.ORVIA.user = { id: 'u1' };

globalThis.ORVIA.sb = rows([{ flag: 'engine_v2_plan', enabled: true, reason: 'canary', cohort: 'c1' }]);
await FF.refresh({ force: true });
ok('gelesene Zeile mit enabled === true schaltet ein', FF.isEnabled('engine_v2_plan') === true);
ok('Herkunft und Begründung bleiben nachvollziehbar (auditierbarer Rollback)',
   FF.describe('engine_v2_plan').source === 'server' &&
   FF.describe('engine_v2_plan').reason === 'canary' &&
   FF.describe('engine_v2_plan').cohort === 'c1');
ok('ein Flag ohne Zeile bleibt aus, obwohl die Abfrage erfolgreich war',
   FF.isEnabled('engine_v2_readiness') === false &&
   FF.describe('engine_v2_readiness').source === 'server_no_row');

for (const [label, value] of [['die Zeichenkette "true"', 'true'], ['die Zahl 1', 1], ['null', null], ['undefined', undefined], ['"yes"', 'yes']]) {
  globalThis.ORVIA.sb = rows([{ flag: 'engine_v2_plan', enabled: value }]);
  await FF.refresh({ force: true });
  ok('enabled = ' + label + ' schaltet NICHT ein', FF.isEnabled('engine_v2_plan') === false);
}

globalThis.ORVIA.sb = rows([{ flag: 'voellig_unbekannt', enabled: true }]);
await FF.refresh({ force: true });
ok('eine Zeile mit unbekanntem Flagnamen wird ignoriert',
   FF.KNOWN.every(f => FF.isEnabled(f) === false) && FF.isEnabled('voellig_unbekannt') === false);

/* ============ 4) Kein lokales Weiterleben ============ */
sec('C · Ein abgeschaltetes Flag lebt nicht lokal weiter');

globalThis.ORVIA.sb = rows([{ flag: 'engine_v2_plan', enabled: true }]);
await FF.refresh({ force: true });
ok('Ausgangslage: Flag ist an', FF.isEnabled('engine_v2_plan') === true);

NOW += FF.TTL_MS + 1;
ok('nach Ablauf der TTL zählt der Zwischenstand nicht mehr als Beleg → aus',
   FF.isEnabled('engine_v2_plan') === false && FF.describe('engine_v2_plan').stale === true);

NOW -= FF.TTL_MS + 1;
ok('innerhalb der TTL gilt der Zwischenstand weiterhin', FF.isEnabled('engine_v2_plan') === true);

/* Serverseitiges Abschalten greift beim nächsten Laden */
globalThis.ORVIA.sb = rows([{ flag: 'engine_v2_plan', enabled: false }]);
await FF.refresh({ force: true });
ok('serverseitig auf false gesetzt ⇒ beim nächsten Laden aus', FF.isEnabled('engine_v2_plan') === false);

/* Gelöschte Zeile = aus */
globalThis.ORVIA.sb = rows([{ flag: 'engine_v2_plan', enabled: true }]);
await FF.refresh({ force: true });
globalThis.ORVIA.sb = rows([]);
await FF.refresh({ force: true });
ok('serverseitig gelöschte Zeile ⇒ aus (fail-closed statt „letzter bekannter Wert")',
   FF.isEnabled('engine_v2_plan') === false);

/* Offline verlängert nichts */
globalThis.ORVIA.sb = rows([{ flag: 'engine_v2_plan', enabled: true }]);
await FF.refresh({ force: true });
setOnline(false);
await FF.refresh({ force: true }).then(r => {
  ok('offline verlängert einen zuvor aktiven Zustand NICHT — sonst bliebe ein abgeschaltetes Feature an',
     r.reason === 'offline' && FF.isEnabled('engine_v2_plan') === false);
});
setOnline(true);

/* Notabschaltung */
globalThis.ORVIA.sb = rows([{ flag: 'engine_v2_plan', enabled: true }, { flag: 'engine_v2_readiness', enabled: true }]);
await FF.refresh({ force: true });
FF.killSwitch();
ok('killSwitch schaltet sofort alles aus, ohne Serverabfrage',
   FF.KNOWN.every(f => FF.isEnabled(f) === false) &&
   FF.describe('engine_v2_plan').source === 'kill_switch');

/* ============ 5) Der Client kann nicht selbst aktivieren ============ */
sec('B · Der Client kann nicht selbst aktivieren');

const src = readFileSync(join(APP, 'js/engine/feature-flags.js'), 'utf8');
const publicApi = Object.keys(FF).filter(k => k.charAt(0) !== '_');
ok('die öffentliche API bietet keine set/enable/activate-Funktion',
   !publicApi.some(k => /^(set|enable|activate|turnOn|on)[A-Z]?/.test(k)),
   publicApi.join(','));
ok('es gibt kein Gegenstück zum killSwitch',
   typeof FF.killSwitch === 'function' && typeof FF.enableAll === 'undefined' && typeof FF.reviveSwitch === 'undefined');
ok('das Modul führt keinen schreibenden Supabase-Aufruf (insert/update/upsert/delete) aus',
   !/\.(insert|upsert|update|delete)\s*\(/.test(src));
/* Kommentare ausblenden: das Modul ERWÄHNT localStorage in der Begründung, warum es
   ihn NICHT benutzt. Geprüft wird der Code, nicht der Text. */
const srcCode = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
ok('das Modul persistiert den Schaltzustand nicht im localStorage (dort wäre er clientseitig manipulierbar)',
   !/localStorage\s*\./.test(srcCode));
ok('_setForTest ist als Testweg gekennzeichnet (Unterstrich + Name)',
   typeof FF._setForTest === 'function' && src.indexOf('_setForTest') > 0 && src.indexOf('nur für Tests') > 0);

/* ============ 6) Migration: RLS lässt keinen Client-Write zu ============ */
sec('B · Migration 0031 — RLS erlaubt lesen, nicht schreiben');

const mig = readFileSync(join(HERE, '..', 'migrations/0031_feature_flags.sql'), 'utf8');
const migL = mig.toLowerCase();
ok('Tabelle user_feature_flags wird angelegt', /create table if not exists public\.user_feature_flags/i.test(mig));
ok('RLS ist eingeschaltet', /enable row level security/i.test(mig));
ok('es gibt genau eine Policy, und die ist for select',
   (migL.match(/create policy/g) || []).length === 1 && /for\s+select/i.test(mig));
ok('keine insert/update/delete-Policy vorhanden — jeder Client-Write ist damit blockiert',
   !/for\s+(insert|update|delete|all)\b/i.test(mig.replace(/--[^\n]*/g, '')));
ok('die Lese-Policy ist auf den eigenen Nutzer beschränkt', /auth\.uid\(\)\s*=\s*user_id/i.test(mig));
ok('enabled ist standardmäßig false (fail-closed schon im Schema)',
   /enabled\s+boolean\s+not null\s+default\s+false/i.test(mig));
ok('user_id kaskadiert beim Löschen des Kontos (kein verwaistes aktives Flag)',
   /references auth\.users\(id\) on delete cascade/i.test(mig));
ok('(user_id, flag) ist eindeutig — kein Widerspruch aus zwei Zeilen', /unique \(user_id, flag\)/i.test(mig));
ok('ein Rollback ist dokumentiert', /drop table if exists public\.user_feature_flags/i.test(mig));

/* Vertragsgleichheit Modul ↔ Datenbank — MASSGEBLICH IST DIE LETZTE
   MIGRATION, die den CHECK-Constraint definiert (0034 ersetzt 0031er-Liste;
   0031 selbst bleibt unangetastet — Geschichtsfaelschungs-Verbot). In der
   Datenbank gewinnt ohnehin der zuletzt angelegte Constraint. */
const _migDir = join(HERE, '..', 'migrations');
const _flagMigs = readdirSync(_migDir).filter(f => f.endsWith('.sql')).sort()
  .filter(f => /check \(flag in \(/i.test(readFileSync(join(_migDir, f), 'utf8')));
const _lastFlagMig = readFileSync(join(_migDir, _flagMigs[_flagMigs.length - 1]), 'utf8');
const chk = _lastFlagMig.match(/check \(flag in \(([^)]*)\)\)/i);
const dbFlags = chk ? chk[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).sort() : [];
ok('CHECK-Constraint im Schema vorhanden', dbFlags.length > 0);
ok('bekannte Flags in Modul und Datenbank sind identisch',
   JSON.stringify(dbFlags) === JSON.stringify(FF.KNOWN.slice().sort()),
   'db=[' + dbFlags.join(',') + '] modul=[' + FF.KNOWN.slice().sort().join(',') + ']');

/* ============ 7) Einbindung ============ */
sec('Einbindung — das Modul ist tatsächlich Teil der App');

const html = readFileSync(join(APP, 'index.html'), 'utf8');
const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
ok('index.html lädt js/engine/feature-flags.js', html.indexOf('js/engine/feature-flags.js') > 0);
ok('feature-flags wird NACH dem Supabase-Client geladen (sonst wäre O.sb beim ersten Lauf leer)',
   html.indexOf('js/engine/feature-flags.js') > html.indexOf('js/config.js'));
ok('sw.js cacht die Datei mit (sonst fehlte sie offline und im Update)',
   sw.indexOf('./js/engine/feature-flags.js') > 0);
ok('die Cache-Version wurde für dieses Bündel angehoben',
   /const C = 'orvia-v8-(\d+)'/.test(sw) && Number(sw.match(/orvia-v8-(\d+)/)[1]) >= 253,
   (sw.match(/orvia-v8-\d+/) || [''])[0]);

console.log('\nphase8_feature_flags: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
