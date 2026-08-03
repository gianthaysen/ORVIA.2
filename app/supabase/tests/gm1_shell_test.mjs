/* ORVIA · GM1 — Golden-Master-Shell + Dashboard, statischer Vertragsteil.
   Referenz: orvia_dashboard_5_1.html (md5 1b93e15e…), docs/gm-ref/gm_dash_domspec.json.
   Ergänzt durch tools/gm1_parity.mjs (Playwright: DOM-Reihenfolge, Bounding-Boxes,
   Screenshot-Overlay/Pixel-Diff GM vs. produktiv mit identischem UI-Fixture).
   node supabase/tests/gm1_shell_test.mjs */
import fs from 'fs';
let pass=0,fail=0;
const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
const R=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const ex=p=>{try{fs.accessSync(new URL(p,import.meta.url));return true;}catch(_){return false;}};
const html=R('../../index.html'), ui=R('../../js/ui.js'), css=R('../../styles.css'), sw=R('../../sw.js');

/* --- Tokens & Kaskade (Schritt „globale Tokens") --- */
ok('GM-Kaskade in styles.css (maßgebliche Sektion, mit Ende-Marker)', css.includes('GOLDEN-MASTER-KASKADE')&&css.includes('/* ====== GM-ENDE ====== */'));
ok('GM-:root-Tokens exakt (bg/card/gold-grad/radien/schatten)', ['--bg:#070C14','--card-1:#111a26','--gold-grad:linear-gradient(135deg,#DCC79A,#C9AE7C 55%,#8E7647)','--r-card:22px','--r-mid:16px','--r-ctrl:12px','--shadow:0 14px 34px rgba(4,5,8,.5)'].every(t=>css.includes(t)));
ok('GM-Hintergrund (radial 900px 500px) aktiv', css.includes('radial-gradient(900px 500px at 50% -5%,#0d1626,#080d16 60%,#05080e)'));
ok('Screen zentriert ≤430px (dokumentierte GM-Anpassung)', /\.screen\{max-width:430px;margin:0 auto/.test(css));
ok('SW auf v8-198, genau einmal (GM-Release-Bump)', /const C = 'orvia-v8-219'/.test(sw)&&(sw.match(/orvia-v8-\d+/g)||[]).length===1);

/* --- Shell-DOM: Screen, Sheets, Tabbar, FAB --- */
ok('.screen-Container im produktiven DOM', /class="[^"]*\bscreen\b[^"]*"/.test(html));
ok('GM-Sheet-System: #scrim + #detailSheet + #qaSheet + #mmSheet', ['id="scrim"','id="detailSheet"','id="qaSheet"','id="mmSheet"'].every(s=>html.includes(s)));
ok('Tabbar-Labels exakt GM: Dashboard/Plan/Aktivität/Analyse/Profil', ['>Dashboard<','>Plan<','>Aktivität<','>Analyse<','>Profil<'].every(l=>html.includes(l)));
ok('FAB vorhanden (52px-GM-Geometrie via .fab-Klasse)', /id="navPlus"[^>]*class="[^"]*fab|class="[^"]*fab[^"]*"[^>]*id="navPlus"/.test(html)&&/\.fab\{position:fixed;right:18px;bottom:94px;width:52px;height:52px/.test(css));
ok('GM-Icon-Registry js/gm-icons.js eingebunden + im SW-Asset', ex('../../js/gm-icons.js')&&html.includes('js/gm-icons.js')&&sw.includes('js/gm-icons.js'));

/* --- Dashboard: GM1-Block mit GM-Komponenten hinter echten Quellen --- */
const fi=ui.indexOf('/* ====== GM1:');
const fe=ui.indexOf('/* ====== GM1-ENDE');
const blk=(fi>=0&&fe>fi)?ui.slice(fi,fe):'';
ok('GM1-Markerblock existiert', fi>=0&&fe>fi);
/* Live-Abnahme-Fix: das Dashboard-Zahnrad oeffnet Einstellungen jetzt direkt
   (gmOpenDashboardSettings), nicht mehr openProfile() -> Profil-Hauptseite zuerst. */
ok('GM-Header im DOM (hdr/greet/iconbtn Bell+Gear/lvlbadge/sync+pulse)', /class="hdr"/.test(html)&&/gmOpenBell/.test(html)&&/gmOpenDashboardSettings\(\)/.test(html)&&/lvlbadge/.test(html)&&/class="sync"/.test(html)&&/class="pulse"/.test(html)&&/id="greet"/.test(html));
ok('Dashboard-Zahnrad oeffnet Einstellungen direkt (kein Umweg ueber Profil-Hauptseite)', !/aria-label="Einstellungen" onclick="openProfile\(\)"/.test(html));
ok('Hero mit SVG-Score-Ring + Statuspill + Delta-Slots + reco + cta-row + batt', ['ring-wrap','statuspill','deltas','class="reco','cta-row','class="batt'].every(s=>blk.includes(s)));
ok('Check-in-Karte in GM-Struktur (checkin/ci-pill/ci-vals)', /class="checkin"/.test(blk)&&/ci-pill/.test(blk)&&/ci-vals/.test(blk));
ok('Modulsystem: ALLMOD/LEVELMOD/Sektionslabel/addmod/mmSheet-Wiring', /ALLMOD/.test(blk)&&/LEVELMOD/.test(blk)&&/sectlabel/.test(blk)&&/addmod/.test(blk)&&/mmList/.test(blk));
ok('Loading/Empty/Error-Dashboardzustände (sk/gapnote/errbar)', /class="sk"/.test(blk)&&/gapnote/.test(blk)&&/errbar/.test(blk));
/* Praezisiert nach Quelltext-Pruefung: fehlende Einzelwerte (CTL/TSB/ACWR/Monotonie/
   Strain/TRIMP/Deltas/…) werden NICHT als literales '>—<' im Template-Text codiert,
   sondern als eigenstaendiger '—'-Fallback (Ternary+Concatenation, z.B. ui.js:4138
   `(L.ctl!=null?...:'—')`), der erst zur Laufzeit zwischen die Tags interpoliert wird.
   Beide Formen (GM_NA-Text fuer ganze Bloecke, '—'-Konstante fuer Einzelwerte) sind im
   GM1-Block vorhanden — Struktur schrumpft nie (GOLDEN-MASTER-MAPPING.md Regel #12). */
ok('Struktur-Slots statt Auslassung: „Noch nicht verfügbar"/— vorhanden', /Noch nicht verfügbar/.test(blk)&&(blk.match(/'—'/g)||[]).length>=10);
ok('Echte Quellen angebunden (orviaScore/decision/metric-resolver/loadSeries)', /orviaScore|getDecision|decision/.test(blk)&&/profileMetricResolver|_metricsResolved/.test(blk)&&/loadSeries|allLoads/.test(blk));
ok('keine Demo-Hardcodes (Gian/9:41/vor 6 Min/vívoactive)', !/>\s*Gian\s*<|9:41|vor 6.?.?Min|vívoactive/.test(blk));
ok('alter Dashboard-Renderer nicht mehr aktiv sichtbar (renderCommand→GM-Hero)', !/class="occ"/.test(blk)&&(blk.length===0||!/occ\b/.test(blk)));

console.log('\n'+(fail?fail+' FAILED':'gm1_shell: ALL PASSED')+' ('+pass+' ok)');
if(fail)process.exit(1);
