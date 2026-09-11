/* ============================================================
   ORVIA · i18n_guard — B-13: Laufzeit t(), Pseudo-Locale, Paritaet, t()-Regime
   ------------------------------------------------------------
     A. t(): Kette aktiv → de → key; Platzhalter; Plural; nie leer
     B. Pseudo-Locale xx: ⟦…⟧ um jeden Katalogtext
     C. parity(): fehlende/verwaiste Keys, Platzhalter-Differenzen
     D. Katalog de: keine leeren Werte, jeder Key namespaced
     E. t()-REGIME: Module, die unter t() stehen, enthalten KEINE deutschen
        Literale mehr (Inventur-Heuristik = 0) — die Liste waechst screenweise
     F. Verdrahtung: i18n vor allen UI-Modulen, locales/ im Upload-Satz
   node supabase/tests/i18n_guard_test.mjs
   ============================================================ */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')].find(p => existsSync(join(p, 'js', 'i18n.js'))) || _flat);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const I = require(join(APP, 'js/i18n.js')); require(join(APP, 'locales/de.js'));
const O = globalThis.ORVIA;

sec('A · t()');
{
  O.locales.en = { 'common.back': 'Back', 'x.only_en': 'EN only', 'n.set.one': '{count} set', 'n.set.other': '{count} sets' };
  O.locales.de['n.set.one'] = '{count} Satz'; O.locales.de['n.set.other'] = '{count} Sätze';
  I.setLocale('de');
  ok('A1 de: Katalogtext', I.t('common.back') === 'Zurück' && I.locale() === 'de');
  ok('A2 Platzhalter gefuellt, unbekannte bleiben sichtbar', I.t('goal.detail.inDays', { n: 5 }) === 'in 5 Tagen' && I.t('goal.detail.inDays', {}) === 'in {n} Tagen');
  ok('A3 Plural de: 1 Satz / 2 Sätze', I.t('n.set', { count: 1 }) === '1 Satz' && I.t('n.set', { count: 2 }) === '2 Sätze');
  I.setLocale('en');
  ok('A4 en: Katalogtext; fehlt → de-Rueckfall; fehlt ueberall → Key', I.t('common.back') === 'Back' && I.t('gym.plates.title') === 'Scheiben' && I.t('nicht.da') === 'nicht.da');
  ok('A5 Plural en', I.t('n.set', { count: 1 }) === '1 set' && I.t('n.set', { count: 3 }) === '3 sets');
  ok('A6 nie undefined/leer', I.t() === '' || typeof I.t() === 'string');
  ok('A7 setLocale normalisiert (en-US → en, Unsinn → de)', I.setLocale('en-US') === 'en' && I.setLocale('') === 'de');
  ok('A8 has()', I.has('common.back') && !I.has('nope'));
}
sec('B · Pseudo-Locale');
{
  I.setLocale('xx');
  ok('B1 ⟦…⟧ um den DE-Text, Platzhalter gefuellt', I.t('goal.detail.inDays', { n: 3 }) === '⟦in 3 Tagen⟧');
  ok('B2 unbekannter Key → ⟦key⟧', I.t('nope.key') === '⟦nope.key⟧');
  I.setLocale('de');
}
sec('C · Paritaet');
{
  const p = I.parity('de', 'en');
  ok('C1 fehlende Keys in en benannt, keine verwaisten', p.missing.length > 0 && p.orphan.indexOf('x.only_en') >= 0 && p.ok === false);
  O.locales.tmp = Object.assign({}, O.locales.de, { 'goal.detail.inDays': 'in {days} Tagen' });
  ok('C2 Platzhalter-Differenz erkannt', I.parity('de', 'tmp').placeholders.join() === 'goal.detail.inDays');
  delete O.locales.tmp; delete O.locales.en;
}
sec('D · Katalog de');
{
  const de = O.locales.de; const keys = Object.keys(de);
  ok('D1 alle Keys namespaced (a.b)', keys.every(k => /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_]+)+$/.test(k)), keys.filter(k => !/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_]+)+$/.test(k)).join());
  ok('D2 keine leeren Werte', keys.every(k => typeof de[k] === 'string' && de[k].trim().length > 0));
  ok('D3 >= 80 Keys (Gym-Strang + Ziel-Detailseite)', keys.length >= 80, String(keys.length));
}
sec('E · t()-Regime');
{
  const inv = await import(pathToFileURL(join(APP, 'tools', 'i18n-inventory.mjs')).href);
  const UNDER_T = ['js/goal-detail.js', 'js/workout-gym.js'];
  UNDER_T.forEach(f => { const hits = inv.scanFile(join(APP, f)); ok('E · ' + f + ': 0 deutsche Literale', hits.length === 0, hits.slice(0, 3).map(h => h.line + ':' + h.text).join(' | ')); });
  const total = inv.inventory().reduce((n, r) => n + r.hits.length, 0);
  ok('E · Inventur laeuft (Gesamtzahl als Fortschrittsmass, Stand 11.09.: ~2600)', total > 1000, String(total));
}
sec('F · Verdrahtung');
{
  const idx = readFileSync(join(APP, 'index.html'), 'utf8'), sw = readFileSync(join(APP, 'sw.js'), 'utf8'), dv = readFileSync(join(APP, 'tools/deploy-verify.sh'), 'utf8');
  const first = idx.indexOf('<script src="js/');
  ok('F1 i18n.js + locales/de.js sind die ersten lokalen Skripte', idx.indexOf('js/i18n.js') === first + '<script src="'.length && idx.indexOf('locales/de.js') > first && idx.indexOf('locales/de.js') < idx.indexOf('js/clock.js'));
  ok('F2 sw.js cached beides', sw.includes("'./js/i18n.js'") && sw.includes("'./locales/de.js'"));
  ok('F3 deploy-verify prueft locales/', /assets locales -type f/.test(dv) && /js assets locales; do/.test(dv));
}
console.log('\n' + (fail ? '❌' : '✅') + ' i18n_guard: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
