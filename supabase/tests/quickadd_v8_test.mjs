/* ORVIA · GM7.9j — Quick-Add („Schnell hinzufügen").
   Sichert die beiden behobenen Fehler ab:
   1) getFavorites() liefert AKTIONS-IDs, keine Objekte. Der Sheet-Renderer muss sie ueber
      den kanonischen Menuebauer composeQuickMenu() aufloesen — sonst bleiben alle Kacheln
      textlos, fallen auf das Blitz-Fallbacksymbol zurueck und der Tap laeuft ins Leere.
   2) buildContext() las den Tagesspeicher ueber window.DB. DB ist in js/data.js aber als
      `let` deklariert und damit KEINE window-Eigenschaft — morningDone/eveningDone waren
      dauerhaft false, der Kontext meldete erledigte Check-ins weiter als offen.
   node supabase/tests/quickadd_v8_test.mjs */
import fs from 'fs';
import { createRequire } from 'module';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const _appjs = p => (_exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/') + p;
const require = createRequire(import.meta.url);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const R = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const ui = R(_APPREL + 'js/ui.js');

/* Minimalumgebung: quick-actions.js bindet an globalThis und ruft bindPlusButton auf. */
globalThis.window = globalThis;
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = String(v); } };
globalThis.document = { getElementById: () => null, querySelectorAll: () => [], addEventListener() {} };
require(_appjs('js/quick-actions.js'));
const qa = globalThis.ORVIA.quickActions;

/* ---------- Vertrag ---------- */
ok('getFavorites liefert IDs (Strings), keine Aktionsobjekte — Grund des Fehlers',
   qa.getFavorites().every(x => typeof x === 'string'));
ok('jede Aktion hat label, description und icon',
   qa.ACTIONS.every(a => a.id && a.label && a.description && a.icon));
ok('Aktionssymbole sind unterschiedlich (kein Einheitsblitz)',
   new Set(qa.ACTIONS.filter(a => a.category !== 'context').map(a => a.icon)).size >= 8);

/* ---------- composeQuickMenu loest auf ---------- */
const menu = qa.composeQuickMenu({ hour: 14, morningDone: true, eveningDone: true }, qa.getFavorites(), qa.ACTIONS);
ok('composeQuickMenu liefert vollstaendige Aktionsobjekte',
   menu.favorites.length > 0 && menu.favorites.every(a => a && a.id && a.label && a.icon));
ok('keine Doppelung zwischen Kontext und Favoriten',
   (() => { const ids = menu.context.concat(menu.favorites).map(a => a.id); return new Set(ids).size === ids.length; })());
ok('hoechstens 2 Kontextaktionen', menu.context.length <= 2);

/* ---------- Kontext: erledigte Check-ins werden erkannt ---------- */
globalThis.todayStr = () => '2026-08-02';
/* Bewusst NUR als lexikalische Bindung simuliert (wie `let DB` in data.js): keine
   window-Eigenschaft. Vor dem Fix blieb morningDone dadurch false. */
delete globalThis.DB;
Object.defineProperty(globalThis, 'DB', {
  value: { '2026-08-02': { morning: { feel: 7 }, eve: { energy: 8 } } },
  configurable: true, enumerable: false, writable: true
});
const c1 = qa.buildContext(new Date('2026-08-02T09:00:00'));
ok('erledigter Morgen-Check-in wird erkannt (war dauerhaft false)', c1.morningDone === true);
ok('erledigter Abend-Check-in wird erkannt', c1.eveningDone === true);

globalThis.DB = { '2026-08-02': {} };
const c2 = qa.buildContext(new Date('2026-08-02T09:00:00'));
ok('offener Check-in bleibt korrekt offen', c2.morningDone === false && c2.eveningDone === false);
const m2 = qa.composeQuickMenu(c2, qa.getFavorites(), qa.ACTIONS);
ok('offener Morgen-Check-in wird vormittags nach vorn gestellt',
   m2.context.some(a => a.id === 'checkin_morning'));
const c3 = qa.buildContext(new Date('2026-08-02T09:00:00'));
globalThis.DB = { '2026-08-02': { morning: { feel: 7 } } };
const m3 = qa.composeQuickMenu(qa.buildContext(new Date('2026-08-02T09:00:00')), qa.getFavorites(), qa.ACTIONS);
ok('erledigter Morgen-Check-in wird NICHT mehr vorgeschlagen',
   !m3.context.some(a => a.id === 'checkin_morning'));

/* ---------- Renderer-Quelltext ---------- */
const SRC = ui.slice(ui.indexOf('function gmOpenQA()'), ui.indexOf('function gmRunQA('));
ok('Renderer nutzt composeQuickMenu statt getFavorites direkt als Objektliste',
   /composeQuickMenu\(/.test(SRC) && !/list=\(qa\.getFavorites&&qa\.getFavorites\(\)\)/.test(SRC));
ok('Renderer verwirft unvollstaendige Eintraege (kein textloser Slot)',
   /filter\(function\(a\)\{return a&&a\.id&&a\.label;\}\)/.test(SRC));
ok('Favoriten-Manager ist aus dem Sheet erreichbar (Zusage „anpassbar" eingeloest)',
   /gmOpenQAFavs\(\)/.test(SRC) && /openFavoritesManager/.test(ui));
ok('„anpassbar" wird nur behauptet, wenn der Manager wirklich verfuegbar ist',
   /canEdit\?' · anpassbar':''/.test(SRC));
ok('Kontextaktionen werden als solche gekennzeichnet', /Jetzt sinnvoll/.test(SRC));

/* ---------- GM7.9k: Profil-Luecke konkret benennen und direkt anspringen ---------- */
const GAPSRC = ui.slice(ui.indexOf('function gmProfileGap()'), ui.indexOf('function gmOpenQA()'));
ok('Luecke kommt aus dem kanonischen Vollstaendigkeitsvertrag, nicht aus eigener Bewertung',
   /computeProfileCompleteness/.test(GAPSRC) && !/score|missing\.length>\s*\d/.test(GAPSRC.replace(/essential\.missing/g, '')));
ok('Bereichsbezeichnung stammt aus profileCenter.SECTION_LABELS', /SECTION_LABELS/.test(GAPSRC));
ok('Tap springt direkt in den fehlenden Bereich (openProfileSection)',
   /openProfileSection\(/.test(GAPSRC) && /gmGotoProfileGap\('/.test(SRC));
ok('Fallback-Kette ohne toten Tap: Sektion -> Profilcenter -> Standardaktion',
   /profileCenter[\s\S]*open\(\)/.test(GAPSRC) && /gmRunQA\('profile_complete'\)/.test(GAPSRC));
ok('Beschreibung bleibt kurz (Bereich + Anzahl, kein Fliesstext)',
   /gap\.label\+\(gap\.rest>0\?' · \+'\+gap\.rest\+' weitere':''\)/.test(SRC));

console.log('\nquickadd_v8: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
