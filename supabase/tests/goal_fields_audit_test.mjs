/* ORVIA · S1/E6+E7 (12.09.2026) — Feld-Audit Ziel-Editor.
   Befund: 77 kategoriespezifische Felder (GOAL_CATEGORY_FIELDS) werden gespeichert, aber von keinem
   Engine-/Planer-Modul gelesen; „Verletzungshistorie" am Ziel lief ins Leere.
   Diese Probe haelt den Zustand EHRLICH: solange kein Konsument existiert, muss der Editor das sagen;
   sobald ein Modul categoryData liest, muss der Hinweis weg (dann schlaegt A1 an — gewollt). */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { srcHasText } from './_i18n-src.mjs';
const APP = ['../../app', '../..'].map(p => new URL(p + '/', import.meta.url)).find(u => existsSync(new URL('js/profile-model.js', u))).pathname;
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
function walk(d, out) { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) walk(f, out); else if (/\.js$/.test(n)) out.push(f); } return out; }
const files = walk(join(APP, 'js'), []).filter(f => !/profile\.js$|profile-model\.js$/.test(f));
const readers = files.filter(f => /categoryData\s*[.\[]/.test(readFileSync(f, 'utf8')));
ok('A1 kein Engine-/UI-Modul ausser dem Editor liest categoryData (sonst Hinweis im Editor entfernen)', readers.length === 0, readers.map(f => f.replace(APP, '')).join(', '));
const pf = readFileSync(join(APP, 'js/profile.js'), 'utf8');
ok('A2 Konkretisieren-Schritt traegt den ehrlichen Hinweis (keine Planwirkung)', /gw-audit/.test(pf) && srcHasText(pf, 'fließen aber derzeit nicht in die Planung ein'));
const sb = { window: null }; sb.window = sb; sb.self = sb; sb.globalThis = sb; vm.createContext(sb);
vm.runInContext(readFileSync(join(APP, 'js/profile-model.js'), 'utf8'), sb, { filename: 'profile-model.js' });
const M = sb.ORVIA.profileModel;
const run = M.categoryFieldsFor('half_marathon').concat(M.categoryFieldsFor('run_10k'));
const inj = run.find(f => f.key === 'injuryHistory');
ok('B1 Verletzungshistorie ist ein Link auf Beschwerden (type link, target constraints), kein Textfeld', !!inj && inj.type === 'link' && inj.target === 'constraints', JSON.stringify(inj));
ok('B2 Editor rendert link-Felder als Verweis auf openProfileSection(constraints)', /f\.type==='link'\)return '<div class="gm-field">[^\n]*openProfileSection\(\\''\+escH\(f\.target\|\|'constraints'\)/.test(pf));
ok('B3 _gwCollect ueberspringt link-Felder (kein leerer categoryData-Eintrag)', /if\(f\.type==='link'\)return;if\(f\.type==='select'\)/.test(pf));
const total = Object.keys(M.GOAL_CATEGORY_FIELDS).reduce((n, k) => n + M.GOAL_CATEGORY_FIELDS[k].length, 0);
ok('C1 Feldzahl dokumentiert (Stand 77) — Aenderung bewusst mitziehen', total === 77, String(total));
console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
