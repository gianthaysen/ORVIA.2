/* ORVIA · Sofortmassnahme Wortbruch (2026-10-29)
   BEFUND: Auswahlkarten im Onboarding brachen Woerter an jeder Stelle („Laufe-n",
   „Kraftt-rainin-g", „Halbmarat-hon") — overflow-wrap:anywhere in .pf-choice-label/-desc
   bei zweispaltigem Raster mit Icon und reservierter Haekchenflaeche (~70 px Text).
   Geprueft im Browser auf 320/375/390/430 px: nach dem Fix kein Wort mehr ueber eine
   Zeilengrenze gerissen (nur Silbentrennung mit Trennstrich, lang="de").
   Dieser Test sichert die CSS-Zusagen statisch; der Browser-Nachweis laeuft im
   Layout-Pruefstand (Phase 0).
   node supabase/tests/onboarding_wordbreak_test.mjs */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const APP = [join(HERE, '..', '..', 'app'), join(HERE, '..', '..')].find(p => existsSync(join(p, 'styles.css')));
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const css = readFileSync(join(APP, 'styles.css'), 'utf8');
const html = readFileSync(join(APP, 'index.html'), 'utf8');
const rule = sel => { const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\:]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g'); let m, out = ''; while ((m = re.exec(css))) out += m[1] + ';'; return out; };

const fix = rule('.ob3-choicegrid .pf-choice-label,.ob3-choicegrid .pf-choice-desc');
ok('W1 Onboarding-Karten: kein Umbruch an beliebiger Stelle (overflow-wrap:normal, word-break:normal)', /overflow-wrap:normal/.test(fix) && /word-break:normal/.test(fix));
ok('W2 Silbentrennung statt Wortbruch (hyphens:auto, -webkit-hyphens:auto)', /(^|;)hyphens:auto/.test(fix) && /-webkit-hyphens:auto/.test(fix));
ok('W3 Silbentrennung braucht die Dokumentsprache: <html lang="de">', /<html[^>]*\blang="de"/.test(html));
ok('W4 Karten MIT Beschreibung einspaltig', /\.ob3-choicegrid:has\(\.pf-choice-desc\)\{grid-template-columns:1fr\}/.test(css));
ok('W5 Karten OHNE Beschreibung: Icon ueber dem Namen (volle Kartenbreite fuer den Text)', /\.ob3-choicegrid:not\(:has\(\.pf-choice-desc\)\) \.pf-choice\{flex-direction:column/.test(css));
ok('W6 Haekchen als Eckabzeichen (kostet keine Textbreite)', /position:absolute/.test(rule('.ob3-choicegrid .pf-choice-check')));
/* Gegenprobe: die alte Regel steht weiter im Basisbaustein — der Onboarding-Override muss NACH ihr kommen, sonst gewinnt sie. */
const base = css.indexOf('.pf-choice-label{'), over = css.indexOf('.ob3-choicegrid .pf-choice-label,');
ok('W7 Override steht nach der Basisregel (Kaskade) und ist spezifischer', base > 0 && over > base);
console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
