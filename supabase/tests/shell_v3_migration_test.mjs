/* ORVIA · Shell-v3-Migration — Vertragstest (statisch, node-runnable).
   Prüft die verbindliche v3-Shell: 5 beschriftete Hauptziele, Liquid-Glass-Tabbar mit Indikator,
   separater FAB (Quick Actions), v3-Header ohne Demo-Hardcodes, SW-Bump, idempotente Bindung.
   node supabase/tests/shell_v3_migration_test.mjs */
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
const html=R(_APPREL + 'index.html'), ui=R(_APPREL + 'js/ui.js'), css=R(_APPREL + 'styles.css'), sw=R(_APPREL + 'sw.js');

// --- Tabbar: 5 beschriftete Hauptziele, kein Training-Tab mehr in der Bar ---
/* 2026-08-06 (Liquid-Glass-Umbau): Die Bar ist jetzt ein semantisches <nav> mit
   aria-label statt eines <div> — eine Accessibility-Verbesserung, kein Bruch der
   hier geprueften Zusage. Der Ausschnitt wird deshalb tagunabhaengig gebildet;
   die Pruefungen darunter (5 Ziele, Labels, .tl-Spans, kein Training-Tab, FAB
   ausserhalb) bleiben WORTGLEICH bestehen. */
const bar=(html.match(/<(?:div|nav) class="tabbar"[^>]*>[\s\S]*?<\/(?:div|nav)>/)||[''])[0];
ok('Bar ist semantische Navigation mit Label', /<nav class="tabbar" aria-label="[^"]+"/.test(html));
const tabs=[...bar.matchAll(/data-tab="([a-z]+)"/g)].map(m=>m[1]);
ok('Tabbar hat genau die 5 Ziele heute/plan/akt/dash/mehr', JSON.stringify(tabs)===JSON.stringify(['heute','plan','akt','dash','mehr']), tabs.join(','));
ok('Tabbar-Labels: Dashboard/Plan/Aktivität/Analyse/Profil', ['>Dashboard<','>Plan<','>Aktivität<','>Analyse<','>Profil<'].every(l=>bar.includes(l)));
ok('kein data-tab="training" in der Tabbar', !bar.includes('data-tab="training"'));
ok('Labels als .tl-Spans (v3-System)', (bar.match(/class="tl"/g)||[]).length===5);

// --- FAB: separat, außerhalb der Tabwrap, behält navPlus-ID für bestehende Quick-Action-Bindung ---
ok('FAB #navPlus existiert außerhalb der Tabwrap', !bar.includes('id="navPlus"') && /id="navPlus"[^>]*class="fab"|class="fab"[^>]*id="navPlus"/.test(html));
ok('FAB behält aria-haspopup (Quick-Action-Dialog)', /id="navPlus"[^>]*aria-haspopup="dialog"|aria-haspopup="dialog"[^>]*id="navPlus"/.test(html));

// --- v3-Header: echte Quellen, keine Demo-Hardcodes, funktionale IDs bleiben ---
ok('Header-IDs greet/dayTitle/dateLabel bleiben erhalten', ['id="greet"','id="dayTitle"','id="dateLabel"'].every(s=>html.includes(s)));
ok('Name-Element #hdrName vorhanden', html.includes('id="hdrName"'));
ok('Name wird aus PROFILE gefüllt (ui.js)', /hdrName[\s\S]{0,200}PROFILE/.test(ui));
ok('Modus-Badge #modeBadge aus uiDetailMode', html.includes('id="modeBadge"') && /modeBadge[\s\S]{0,260}uiDetailMode/.test(ui));
ok('Sync-Zeile #syncLine aus echtem Sync-Zustand', html.includes('id="syncLine"') && /orviaSyncState/.test(ui));
ok('kein Hardcode "Gian" im Shell-Markup', !/>\s*Gian\s*</.test(html));
ok('kein Hardcode "Garmin · vor 6" (Demo-Sync)', !html.includes('vor 6&nbsp;Min') && !html.includes('vor 6 Min synchronisiert'));
ok('keine Demo-Bar/Statusbar/Phone-Rahmen', !html.includes('class="demobar"') && !html.includes('class="statusbar"') && !html.includes('class="phone"'));

// --- Tabbar-Bindung: idempotent, delegiert, Drag + Tastatur, Indikator ---
ok('idempotente Bindung (dataset.bound-Guard)', /tabwrap[\s\S]{0,400}dataset\.bound/.test(ui));
ok('Glass-Indicator wird erzeugt', /glass-indicator/.test(ui) && /glass-indicator/.test(css));
ok('Drag-Navigation (pointerdown/pointermove) auf der Bar', /tabwrap[\s\S]{0,2600}pointerdown/.test(ui) && /pointermove/.test(ui));
ok('Tastatur: Pfeilnavigation', /ArrowRight|ArrowLeft/.test(ui.slice(ui.indexOf('dataset.bound')>-1?ui.indexOf('dataset.bound')-200:0)));
ok('mehr → openProfile (Profil-Overlay, kein showTab)', /['"]mehr['"][\s\S]{0,240}openProfile/.test(ui));
ok('alte per-Button-Bindung entfernt', !/\.tabbar button\[data-tab\]'\)\.forEach\(b=>b\.onclick/.test(ui));

// --- v3-Tokens & Shell-CSS additiv ---
ok('v3-Status-Tokens (--ready/--attention/--crit + Tints)', ['--ready:','--attention:','--crit:','--ready-t:'].every(t=>css.includes(t)));
ok('v3-Karten-Tokens (--card-1/--card-2)', css.includes('--card-1:')&&css.includes('--card-2:'));
ok('FAB-Styles vorhanden', /\.fab\{/.test(css));
/* GM7 (Legacy-Deaktivierung + Gesamtabgleich): der v3-Legacy-Hero-Skin .occ ist entfallen.
   renderCommand rendert seit der GM-Migration ausschliesslich die GM-Kette
   (gmHero/gmDashVM bzw. die Zustands-Heroes); der massgebliche Hero-Skin ist .hero aus der
   GM-Kaskade. Die Invariante "renderCommand hat einen verbindlichen Hero-Skin" bleibt und
   wird auf den Zielzustand gedreht — geprueft werden jetzt DREI Bedingungen statt einer:
   GM-.hero vorhanden, .occ vollstaendig fort, renderCommand delegiert an gmHero(gmDashVM()). */
const _cssNoCom = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
const _gmHero   = /\.hero\{margin:8px 18px 14px/.test(_cssNoCom);
const _occFort  = !/\.occ/.test(_cssNoCom);
const _deleg    = /function renderCommand\(\)\{[\s\S]{0,3000}gmHero\(gmDashVM\(\)\)/.test(ui);
ok('Hero-Skin für renderCommand vorhanden (GM7: GM-.hero statt Legacy-.occ)',
   _gmHero && _occFort && _deleg,
   'gm-hero=' + _gmHero + ' occ-fort=' + _occFort + ' delegiert=' + _deleg);

// --- Service Worker: genau ein Bump auf die nächste echte Version ---
/* Version wandert je Release-Slice weiter (D2: v8-196). Invariante: genau EINE definierte
   Cache-Version, mindestens v8-195 (die Version des Shell-Releases). */
const _swv=sw.match(/const C = 'orvia-v8-(\d+)'/);
ok('SW-Cache-Version definiert und ≥ v8-195', !!_swv && +_swv[1]>=195);
ok('SW-Version nur einmal definiert', (sw.match(/orvia-v8-\d+/g)||[]).length===1);

console.log('\n'+(fail?fail+' FAILED':'shell_v3_migration: ALL PASSED')+' ('+pass+' ok)');
if(fail)process.exit(1);
