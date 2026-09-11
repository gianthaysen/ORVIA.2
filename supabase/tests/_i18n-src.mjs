/* ORVIA · Test-Helfer B-13: Quelltext-Pruefungen auf deutschen Text, die auch nach der
   t()-Extraktion gelten. srcHasText(src, text) ist wahr, wenn der Text noch als Literal im
   Quelltext steht ODER ein im Quelltext benutzter Key T('ns.key') im DE-Katalog diesen Text
   enthaelt. Katalog + Laufzeit werden aus app/js/i18n.js und app/locales/de.js geladen. */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
function _exApp(u) { try { return existsSync(u); } catch (e) { return false; } }
const APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
export const I18N_FILES = ['js/i18n.js', 'locales/de.js'];
let _de = null;
export function catalog() {
  if (_de) return _de;
  const sb = { window: null }; sb.window = sb; sb.self = sb; vm.createContext(sb);
  I18N_FILES.forEach(f => vm.runInContext(readFileSync(new URL(APPREL + f, import.meta.url), 'utf8'), sb, { filename: f }));
  _de = sb.ORVIA.locales.de; return _de;
}
/* Alle Keys, die im Quelltext ueber T('…') / t('…') referenziert werden. */
export function keysIn(src) {
  const out = new Set(); let m; const re = /\b[tT]\(\s*'([a-z][a-zA-Z0-9]*\.[^']+)'/g;
  while ((m = re.exec(src))) out.add(m[1]);
  return out;
}
/* Text (String oder RegExp) im Quelltext ODER in einem dort benutzten Katalogtext. */
export function srcHasText(src, text) {
  const test = text instanceof RegExp ? (s => text.test(s)) : (s => s.indexOf(text) >= 0);
  if (test(src)) return true;
  const de = catalog();
  for (const k of keysIn(src)) { const v = de[k]; if (typeof v === 'string' && test(v)) return true; }
  return false;
}
/* Quelltext mit eingesetzten DE-Texten (fuer Regex-Pruefungen ueber Key-Grenzen hinweg). */
export function inlined(src) {
  const de = catalog();
  const esc = v => v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return src
    .replace(/' \+ [tT]\('([a-z][a-zA-Z0-9]*\.[^']+)'(?:, ?\{[^}]*\})?\) \+ '/g, (m, k) => (k in de ? esc(de[k]) : m))
    .replace(/\b[tT]\(\s*'([a-z][a-zA-Z0-9]*\.[^']+)'\s*\)/g, (m, k) => (k in de ? "'" + esc(de[k]) + "'" : m));
}
