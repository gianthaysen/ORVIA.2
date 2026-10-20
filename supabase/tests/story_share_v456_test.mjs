/* ============================================================
   ORVIA · story_share_v456 — Teilen aus den Highlights (Modul + Verdrahtung, ohne Browser)
   M  Modul: Version, keine Texte im Modul, Logo = Originalgeometrie aus assets/brand, Wertaufteilung, Dateiname
   P  Datenschutz: Start/Ziel ausblenden nur in einer Kopie, kurze Strecke → keine Strecke, Original unveraendert
   V  Vorlagen je Datenlage (ohne Strecke keine Streckenvorlage, ohne Bestzeit keine Bestzeitvorlage)
   T  Teilen-Regeln: navigator.share ohne vorgeschaltetes Warten, canShare-Pruefung, Erfolg beim Kopieren erst nach write(),
      Abbruch (AbortError) ohne Fehlermeldung, kein Video-Knopf
   U  Verdrahtung: Daten aus dem Analyse-Modell (gesperrte Werte nie), Bestzeit-Kategorie wie im Register, Precache, ein Script-Tag
   ============================================================ */
import { createRequire } from 'node:module';
import { existsSync as _ex, readFileSync } from 'node:fs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const require = createRequire(import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const rd = f => readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
const S = require(new URL(_APPREL + 'js/story-share.js', import.meta.url).pathname);
const src = rd('js/story-share.js'), ui = rd('js/ui.js'), de = rd('locales/de.js'), idx = rd('index.html'), sw = rd('sw.js'), css = rd('styles.css');

sec('M · Modul');
ok('M1 Version story-share@2 (v8-457), Gestaltungsraster 1080 × 1920 (Export in 2160 × 3840 = Massstab 2)', S.VERSION === 'story-share@2' && S.W === 1080 && S.H === 1920);
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
ok('M2 keine Texte im Modul (alle Beschriftungen ueber t() bzw. Daten)', !/[äöüÄÖÜß]/.test(code) && !/'(Teilen|Speichern|Karten|Aufkleber)'/.test(code));
const logo = rd('assets/brand/orvia-lockup-horizontal.svg');
const paths = [...logo.matchAll(/<path d="([^"]+)" stroke-width="([\d.]+)"/g)].map(m => [m[1], +m[2]]);
ok('M3 Logo = Originalgeometrie aus assets/brand/orvia-lockup-horizontal.svg (Ring, Haken, Strichstaerken, Transformation, Wortmarke)',
  paths.length === 2 && paths[0][0] === S.LOGO.mark.ring && paths[0][1] === S.LOGO.mark.ringW && paths[1][0] === S.LOGO.mark.check && paths[1][1] === S.LOGO.mark.checkW &&
  /translate\(-15,39\.5\) scale\(\.5\)/.test(logo) && S.LOGO.mark.tx === -15 && S.LOGO.mark.ty === 39.5 && S.LOGO.mark.s === 0.5 &&
  /font-size="92" font-weight="600" letter-spacing="17"[^>]*>ORVIA</.test(logo.replace(/\s+/g, ' ')) && S.LOGO.word.size === 92 && S.LOGO.word.ls === 17, JSON.stringify(paths));
ok('M4 Logo als Path2D gezeichnet, nicht als <img> (Safari sperrt sonst den Export)', /new Path2D\(mk\.ring\)/.test(src) && !/new Image\(\)[\s\S]{0,80}orvia-lockup/.test(src));
ok('M5 Wert/Einheit: „21,10 km" · „1:07 /100 m" · „1:52:13" · „3.360 kg"', JSON.stringify([S.splitVal('21,10 km'), S.splitVal('1:07 /100 m'), S.splitVal('1:52:13'), S.splitVal('3.360 kg')]) ===
  JSON.stringify([{ n: '21,10', u: 'km' }, { n: '1:07', u: '/100 m' }, { n: '1:52:13', u: '' }, { n: '3.360', u: 'kg' }]));
ok('M6 Dateiname ohne Umlaute/Sonderzeichen, Endung .png', S.fileName({ fileBase: 'orvia-running-2026-09-06 Größe/Ü' }, 'route_plus') === 'orvia-running-2026-09-06-groesse-ue-route-plus.png');
ok('M7 Karten ohne Kartenkacheln (keine Lizenz-/Attributionspflicht, kein gesperrtes Canvas) — einziges Bild: das eigene Foto (lokal) bzw. der Zuschnitt des Aufklebers', !/tileUrl|api\.maptiler|rmx-tiles/.test(code) && (code.match(/drawImage\(/g) || []).length === 2 && /ctx\.drawImage\(o\.photo,/.test(code) && /drawImage\(cv, x0, y0,/.test(code));

sec('P · Datenschutz (nur Export)');
const R = Array.from({ length: 101 }, (_, i) => [51.48 + i * 0.0001, 7.2]);          /* ~1,1 km gerade Linie (frei gewaehlt) */
const R0 = JSON.stringify(R);
const t200 = S.privacyTrim(R, 200), t0 = S.privacyTrim(R, 0);
ok('P1 200 m: Anfang und Ende fehlen in der Exportkopie (erster/letzter Punkt ≥ 200 m vom Original-Start/Ziel)', t200 && t200.length < R.length && t200[0][0] - R[0][0] >= 0.0017 && R[100][0] - t200[t200.length - 1][0] >= 0.0017, t200 && t200.length);
ok('P2 Original-Strecke unveraendert (gespeicherte Garmin-Route bleibt)', JSON.stringify(R) === R0);
ok('P3 Aus: vollstaendige Kopie (kein Bezug auf das Original-Array)', t0.length === R.length && t0 !== R && t0[0] !== R[0]);
ok('P4 zu kurze Strecke (< 3 × Bereich): keine Strecke statt eines verratenen Startpunkts', S.privacyTrim(R.slice(0, 40), 200) === null);
ok('P5 ungueltige Punkte werden verworfen', S.privacyTrim([[0, 0], [null, 1], [95, 0], [0.001, 0]], 0).length === 2);
ok('P6 Virtuelle Strecke (Spielwelt): kein Ausblenden noetig, Auswahl dafuer verborgen', /priv\.hidden = !\(tp && tp\.route\) \|\| !!S\.d\.routeVirtual/.test(src) && /d\.routeVirtual \? validPts\(d\.route\)/.test(src));

sec('V · Vorlagen je Datenlage');
const m = (id, txt) => ({ id, label: id, txt, n: S.splitVal(txt).n, u: S.splitVal(txt).u });
const run = { metrics: [m('distance', '21,1 km'), m('duration', '1:52:13'), m('paceKm', '5:19 /km'), m('avgHr', '152 bpm'), m('elevationGain', '120 m')], rateIds: ['paceKm'], route: R, pb: { kicker: 'x', dist: '21,1 km', time: '1:52:13' } };
const swim = { metrics: [m('distance', '1.350 m'), m('pace100', '1:48 /100 m'), m('duration', '1:09:31'), m('activeLengths', '54')], rateIds: ['pace100'], route: null, pb: null };
const gym = { metrics: [m('volume', '3.360 kg'), m('duration', '1:07:00'), m('workingSets', '5')], rateIds: ['workingSets'], route: null, pb: null };
const ids = (d, k) => S.templates(d, k).map(t => t.id).join();
ok('V1 Laufen mit Strecke + Bestzeit (ohne Runden/Hoehe im Testdatensatz): Minimal, drei Werte, Strecke, Strecke + Werte, Bestzeit, Ring, Contour, Zusammenfassung, Foto', ids(run, 'card') === 'hero,trio,route,route_plus,pb,ring,contour,summary,photo', ids(run, 'card'));
ok('V2 Laufen: Aufkleber gestapelt (Titel, Distanz, Dauer, Tempo), Distanz, Zeit, Tempo, drei Werte, Strecke, Strecke + Werte, Statistik, Bestzeit', ids(run, 'sticker') === 's_stack,s_main,s_time,s_rate,s_trio,s_route,s_route_stats,s_stats,s_pb', ids(run, 'sticker'));
ok('V3 Schwimmen ohne GPS: keine Streckenvorlage, keine Bestzeit', !/route|pb/.test(ids(swim, 'card') + ids(swim, 'sticker')), ids(swim, 'card') + ' | ' + ids(swim, 'sticker'));
ok('V4 Kraft ohne Strecke: Volumen als Hauptwert, Zeit, Saetze; keine Strecke', ids(gym, 'card') === 'hero,trio,ring,contour,photo' && ids(gym, 'sticker') === 's_stack,s_main,s_time,s_rate,s_trio', ids(gym, 'card') + ' | ' + ids(gym, 'sticker'));
const splitsD = { rows: [1, 2, 3].map(i => ({ label: 'B' + i, v: 300 + i, txt: '5:0' + i, delta: i - 2, dtxt: '±0:0' + i })), title: 'x', refLabel: 'y' };
const ivtl = { blocks: [{ kind: 'work', start: 0, dur: 60 }, { kind: 'recovery', start: 60, dur: 60 }, { kind: 'work', start: 120, dur: 60 }], total: 180, pace: { t: Array.from({ length: 30 }, (_, i) => i * 6), v: Array.from({ length: 30 }, () => 300) } };
const elev = { pts: Array.from({ length: 30 }, (_, i) => [i / 10, 20 + i]), gain: '120 m' };
ok('V6 Abschnitte, Intervallverlauf und Hoehenprofil NUR mit echten Daten (ohne Daten: keine Vorlage)', !/splits|intervals|elev/.test(ids(run, 'card')) && /splits/.test(ids(Object.assign({}, run, { splits: splitsD }), 'card')) && /intervals/.test(ids(Object.assign({}, run, { ivtl }), 'card')) && /elev/.test(ids(Object.assign({}, run, { elev }), 'card')) && !/elev/.test(ids(Object.assign({}, run, { elev: Object.assign({}, elev, { gain: null }) }), 'card')));
ok('V7 Standardvorlage je Aktivitaet: Bestzeit → Bestleistung, echte Intervalle → Intervallverlauf, sonst drei Werte; Aufkleber gestapelt', S.defaultTpl(run, 'card') === 'pb' && S.defaultTpl(Object.assign({}, run, { pb: null, ivtl }), 'card') === 'intervals' && S.defaultTpl(Object.assign({}, run, { pb: null }), 'card') === 'trio' && S.defaultTpl(run, 'sticker') === 's_stack');
ok('V5 ohne Werte: keine Vorlage (nichts wird erfunden)', ids({ metrics: [], route: null, pb: null }, 'card') === '' && ids({ metrics: [], route: null, pb: null }, 'sticker') === '');

sec('T · Teilen-Regeln');
const share = src.slice(src.indexOf('function doShare()'), src.indexOf('function doSave()'));
ok('T1 navigator.share() direkt im Tipp — kein await/then davor (Nutzeraktivierung in Safari bleibt gueltig)', /function doShare\(\) \{\s*if \(!S \|\| !S\.file\) return;\s*var file = S\.file, t = S\.t;\s*var p; try \{ p = navigator\.share\(/.test(share) && !/await/.test(share));
ok('T2 Datei-Teilen nur nach Laufzeitpruefung navigator.canShare({ files }) — sonst kein Teilen-Knopf', /n\.share && n\.canShare && file && n\.canShare\(\{ files: \[file\] \}\)/.test(src) && /sh\.hidden = !cp\.shareFiles/.test(src));
ok('T3 Abbruch (AbortError) ohne Fehlermeldung; andere Fehler mit Hinweis auf Speichern', /e\.name === 'AbortError'\) status\('', ''\); else status\(t\('share\.err_share'\), 'err'\)/.test(share));
ok('T4 Kopieren: Erfolg erst nach aufgeloestem clipboard.write (ClipboardItem image/png), sonst Fallback-Hinweis', /navigator\.clipboard\.write\(\[new root\.ClipboardItem\(\{ 'image\/png': blob \}\)\]\)/.test(src) && /Promise\.resolve\(p\)\.then\(function \(\) \{ if \(S\) status\(t\('share\.copied'\)/.test(src));
ok('T5 Kopieren nur bei Aufklebern und nur, wenn ClipboardItem vorhanden', /cb\.hidden = !\(S\.kind === 'sticker' && cp\.copyImage\)/.test(src));
ok('T6 kein Video-Knopf (Video-Engine fehlt — dokumentierte Folgephase), kein nachgebautes System-Menue', !/data-act="video"|mp4|MediaRecorder/.test(src) && !/share\.tpl\.video|share\.video/.test(de));
ok('T7 Bedienung: Dialog mit aria-modal, Escape schliesst, Fokus bleibt im Dialog, Fokus kehrt zurueck', /aria-modal', 'true'/.test(src) && /ev\.key === 'Escape'/.test(src) && /Fokus bleibt im Dialog/.test(src) && /s\.ret\.focus/.test(src));
ok('T8 Telefon Bottom-Sheet mit sicherem Rand unten, Desktop Dialog; Aufkleber-Vorschau auf Schachbrett nur per CSS; reduzierte Bewegung', /\.shs-panel\{[^}]*env\(safe-area-inset-bottom,0px\)/.test(css) && /@media \(min-width:760px\)\{\s*\.shs\{align-items:center\}/.test(css) && /\.shs-prev\.is-sticker\{[^}]*linear-gradient\(45deg/.test(css) && /@media \(prefers-reduced-motion:reduce\)\{\.shs-panel,\.shs-scrim\{transition:none\}\}/.test(css));

sec('U · Verdrahtung');
const sd = ui.slice(ui.indexOf('function gmShareData(aid){'), ui.indexOf('/* v8-456 · vergleichbare Abschnitte'));
ok('U1 Werte aus dem Analyse-Modell (gmActAnalysisFor → gmAxOk: gesperrte Werte nie), Formatierung gmAaFmt', /var md=gmActAnalysisFor\(/.test(sd) && /if\(!gmAxOk\(d\)\)return;/.test(sd) && /gmAaFmt\(d,fam\)/.test(sd) && !/\.reduce\(/.test(sd));
ok('U2 Bestzeit fuer Story UND Teilen aus EINER Funktion mit Register-Kategorie (aktiv / einschliesslich Pausen)', /var distPB=\(fam==='pace'\)\?gmStoryPbOf\(a\):null;/.test(ui) && /var pb=gmStoryPbOf\(a\);/.test(sd) && /best\.catLabel=_uiT\(best\.cat==='active'\?'bt\.active_label':'bt\.elapsed_label'\)/.test(ui));
ok('U3 Teilen-Symbol in der Story + Abschlussseite rufen dieselbe Funktion (gmStoryShare)', (ui.match(/onclick="gmStoryShare\(\)"/g) || []).length === 2);
ok('U4 Story haelt waehrend der Auswahl an (Fortschritt bleibt stehen) und laeuft danach an derselben Stelle weiter (Restzeit, kein Neustart der Szene)', /gmStoryPause\('share'\);/.test(ui) && /onClose:function\(\)\{[\s\S]{0,200}if\(!wasHeld\)gmStoryResume\('share'\)/.test(ui) && /_gmStory\.left=Math\.max\(0,_gmStory\.dur-\(Date\.now\(\)-_gmStory\.t0\)\)/.test(ui));
ok('U5 Story-Tasten ruhen, solange die Auswahl offen ist', /ORVIA\.storyShare\.isOpen\(\)\)return;/.test(ui));
ok('U6 Modul genau einmal geladen und im Precache', idx.split('js/story-share.js').length === 2 && sw.includes("'./js/story-share.js'"));
ok('U7 alle Vorlagen-Namen uebersetzt', ['hero', 'trio', 'route', 'route_plus', 'pb', 'summary', 's_main', 's_time', 's_rate', 's_trio', 's_route', 's_route_stats', 's_stats', 's_pb'].every(k => de.includes("'share.tpl." + k + "'")));

ok('U8 Quick Highlights: Szene 3,6 s, Strecke kompakt 2,2 s (+1,6 s stehen) unabhaengig von der Distanz; Abschluss/Replay ohne Zeitgeber', /var GM_STORY_MS=3600;/.test(ui) && /var GM_STORY_QUICK_DRAW=2\.2;/.test(ui) && /if\(mode!=='replay'\)return GM_STORY_QUICK_DRAW;/.test(ui) && /data-st-ms="'\+\(_rm\?0:Math\.round\(_draw\*1000\+1600\)\)\+'"/.test(ui) && /_draw=gmStoryRouteDraw\(_km,'quick'\)/.test(ui) && /function gmStoryHolds\(page\)\{return \/data-st-end="1"\|data-st-replay="1"\/\.test\(page\|\|''\);\}/.test(ui));
ok('U8b Cinematic Replay getrennt: distanzproportional (Laufen 2 s/km, Rad 0,6 s/km, 4–120 s), Tempo 0,5×/1×/2×, Punkt auf derselben Linie', /var GM_STORY_REPLAY_SPKM=\{running:2,cycling:0\.6,other:1\.5\};/.test(ui) && /Math\.min\(120,Math\.max\(4,k\*spk\/f\)\)/.test(ui) && /\[0\.5,1,2\]\.map/.test(ui) && /pos:true/.test(ui) && /offset-path:path\(/.test(rd('js/route-map.js')));
const sp = ui.slice(ui.indexOf('function gmStoryPages(a){'), ui.indexOf('function gmStoryStop('));
ok('U9 Highlights-Kennzahlen aus demselben Modell wie Seite und Karte (Tempo, Distanz 21,18, Dauer h:mm:ss, Kadenz, Anstieg)',
  /var paceTxt=M\(mdS&&mdS\.family==='swimming'\?'pace100':'paceKm'\)\|\|vm\.paceLabel\|\|null;/.test(sp) && /var distTxt=M\('distance'\)/.test(sp) && /var durClock=M\('duration'\);/.test(sp) && /var cadTxt=M\('runningCadence'\);/.test(sp) &&
  !/subParts\.push\('Ø '\+vm\.paceLabel\)/.test(sp) && !/cells\.push\(\[vm\.paceLabel,/.test(sp) && !/cells\.push\(\[vm\.distanceLabel/.test(sp));
console.log('\n' + (fail ? '❌' : '✅') + ' story_share_v456: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
