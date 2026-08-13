/* ORVIA · Kompakter Check-in auf der Startseite — Vertragstest.
   Kontrakt: Formular bleibt vollständig im DOM (nichts zerstört), ist aber standardmäßig
   eingeklappt; eine kompakte Statuskarte aus ECHTEN Daten ersetzt den großen Block.
   Alle Einstiege (Hero-CTA, Quick Action) klappen vor dem Scrollen auf.
   node supabase/tests/checkin_compact_test.mjs */
import fs from 'fs';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass=0,fail=0;
const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
const R=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const html=R(_APPREL + 'index.html'), ui=R(_APPREL + 'js/ui.js'), css=R(_APPREL + 'styles.css');

// Formular unangetastet + eingeklappt, Kompaktkarte davor
ok('morningForm bleibt im DOM', html.includes('id="morningForm"'));
ok('Check-in-Karte hat id + ci-collapsed (Standard eingeklappt)', /id="checkinCard"[^>]*class="[^"]*ci-collapsed|class="[^"]*ci-collapsed[^"]*"[^>]*id="checkinCard"/.test(html)||/id="checkinCard"/.test(html)&&/checkinCard[^>]*ci-collapsed|ci-collapsed[^>]*checkinCard/.test(html.replace(/\n/g,' ')));
ok('Kompaktkarte #checkinCompact existiert VOR der Formularkarte', html.indexOf('id="checkinCompact"')>0 && html.indexOf('id="checkinCompact"')<html.indexOf('id="checkinCard"'));
ok('Kompaktkarte ist Button-artig (role/tabindex)', /id="checkinCompact"[^>]*role="button"|role="button"[^>]*id="checkinCompact"/.test(html.replace(/\n/g,' ')));
ok('Speichern-CTA weiterhin vorhanden (saveMorning)', html.includes('onclick="saveMorning()"'));

// UI-Logik: echte Quellen, Modus-Dichte, Auf-/Zuklappen
ok('renderCheckinCompact existiert', /function renderCheckinCompact\(/.test(ui));
ok('liest echte morning-Daten (entry/DB)', /renderCheckinCompact[\s\S]{0,900}(entry\(|\.morning)/.test(ui));
ok('Dichte folgt uiDetailMode (nur Darstellung)', /renderCheckinCompact[\s\S]{0,1200}uiDetailMode/.test(ui));
ok('keine Demo-Chips (kein "Energie 8/10"-Hardcode)', !/Energie 8\/10|Stimmung Gut(?!\w)/.test(ui.slice(ui.indexOf('function renderCheckinCompact'),ui.indexOf('function renderCheckinCompact')+2500)));
ok('toggle + expand vorhanden', /function toggleCheckinCard\(/.test(ui) && /function expandCheckinCard\(/.test(ui));
ok('saveMorning klappt danach wieder ein + aktualisiert Kompaktkarte', /saveMorning[\s\S]{0,2200}(collapseCheckinCard|renderCheckinCompact)/.test(ui));
ok('Hero-CTA „Check-in starten" klappt zuerst auf', /expandCheckinCard\(\);document\.getElementById\('morningForm'\)\.scrollIntoView/.test(ui));
ok('Quick-Action-Einstieg wird gewrappt (erst aufklappen)', /gotoMorningCheckin[\s\S]{0,400}expandCheckinCard/.test(ui));
ok('renderDay aktualisiert die Kompaktkarte', /dayTitle[\s\S]{0,2000}renderCheckinCompact\(\)/.test(ui));

// CSS
ok('.ci-collapsed versteckt die Formularkarte', /\.ci-collapsed\{display:none/.test(css));
ok('Kompaktkarten-Styles vorhanden', /\.ci-compact\{/.test(css));

console.log('\n'+(fail?fail+' FAILED':'checkin_compact: ALL PASSED')+' ('+pass+' ok)');
if(fail)process.exit(1);
