/* ORVIA · Phase 1b — Attrappen entfernt (KF-007).

   REGEL (docs/ENTSCHEIDUNGEN-2026-08.md, 1.1):
     Kein sichtbares BEDIENELEMENT ohne funktionierenden, getesteten Endzustand.
     ANZEIGESLOTS bleiben dagegen bestehen und duerfen ehrlich „—" zeigen
     (docs/GOLDEN-MASTER-MAPPING.md:47, „Struktur schrumpft NIE").

   Dieser Test prueft BEIDE Seiten:
     • die Attrappen sind weg
     • die Struktur ist dabei NICHT geschrumpft (gm_structure_contract_test
       deckt die Slots ab; hier zusaetzlich die Zeilen, die bleiben mussten)

   Ein aria-disabled-Element ist nur dann zulaessig, wenn die Sperre einen
   ECHTEN, datenabhaengigen Grund hat (z. B. „Noch keine Aktivitaet").

   node supabase/tests/phase1b_attrappen_test.mjs [appRoot-absolut] */
import { readFileSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const _hx = join(HERE, '..', '..');
import { existsSync as _exApp2 } from 'node:fs';
const APP = process.argv[2] ? normalize(process.argv[2]) : ([_hx, join(_hx, 'app'), join(_hx, '..', 'app')].find(p => _exApp2(join(p, 'index.html'))) || _hx);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const R = f => readFileSync(join(APP, f), 'utf8');

const ui = R('js/ui.js');
const html = R('index.html');
const css = R('styles.css');
const code = ui.replace(/\/\*[\s\S]*?\*\//g, '');   /* Kommentare nennen die Begriffe selbst */

/* ---------- entfernte Bedienelemente ---------- */
ok('Glocke im Header entfernt', html.indexOf('id="gmBell"') < 0);
ok('gmOpenBell entfernt (kein toter Handler zurueckgeblieben)', !/function gmOpenBell\(/.test(code));
ok('keine Schein-Schalter mehr (aria-disabled toggle)', !/class="toggle[^"]*"[^>]*aria-disabled/.test(code));
ok('ueberhaupt kein .toggle-Element mehr im Einstellungsbereich', !/class="toggle/.test(code));
ok('Drag-Griff entfernt', !/class="mm-drag"/.test(code));
ok('Zeitraum-Chevrons ohne Handler entfernt',
   !/transform:scaleX\(-1\)[^>]*aria-disabled/.test(code));
ok('Subtab „Vorlage" entfernt', !/aria-disabled="true">Vorlage</.test(code));
ok('„Nur an Uhr uebergeben" entfernt', !/Nur an Uhr übergeben/.test(code));
ok('Tagesziel-Stepper ohne tote ±-Knoepfe',
   !/stepper"><button disabled/.test(code));
ok('Anpassungs-Chips nicht mehr als Bedienelement getarnt',
   !/adjchip"[^>]*aria-disabled/.test(code));

/* ---------- was bleiben MUSSTE ---------- */
ok('Einstellungszeilen bleiben als Anzeigeslot erhalten',
   /gmPToggleNA\(/.test(code) && (code.match(/gmPToggleNA\(/g) || []).length >= 9,
   (code.match(/gmPToggleNA\(/g) || []).length + ' Zeilen');
ok('sie zeigen jetzt einen ehrlichen Status statt eines Schalters',
   /gmPToggleNA[\s\S]{0,400}setting-value/.test(ui));
ok('Safety-Hinweise bleiben sichtbar und als „Immer aktiv" gekennzeichnet',
   /Erholung &amp; Warnzeichen/.test(ui) && /Immer aktiv/.test(ui));
ok('Tagesziel-Zeilen bleiben mit ehrlichem Wert', /stepper-na"><strong>—<\/strong>/.test(ui));
ok('Anpassungs-Chips bleiben als Information sichtbar', /adjchip adj-na/.test(ui));
ok('Stile fuer die entschaerften Elemente vorhanden',
   /\.adjchip\.adj-na/.test(css) && /\.stepper\.stepper-na/.test(css));

/* ---------- zulaessige Sperren: nur mit echtem Grund ---------- */
const disabled = (code.match(/aria-disabled="true"/g) || []).length;
ok('verbleibende Sperren sind wenige und begruendet', disabled <= 3, disabled + ' verbleibend');
ok('„Letzte wiederholen" bleibt datenabhaengig gesperrt (echter Grund)',
   /disabled aria-disabled="true"[^>]*>[\s\S]{0,200}Noch keine Aktivität/.test(code));
ok('„starten" bleibt fail-closed gesperrt, wenn kein Start moeglich ist',
   /canStart/.test(code) && /cta prim" disabled aria-disabled/.test(code));

/* ---------- keine Regression in der Ehrlichkeit ---------- */
ok('GM_NA wird weiterhin verwendet (Ehrlichkeit nicht wegoptimiert)',
   (ui.match(/GM_NA/g) || []).length >= 40, (ui.match(/GM_NA/g) || []).length + ' Vorkommen');

console.log('\nphase1b_attrappen: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
