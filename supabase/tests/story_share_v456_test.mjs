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
ok('M1 Version story-share@1, Story-Format 1080 × 1920', S.VERSION === 'story-share@1' && S.W === 1080 && S.H === 1920);
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
ok('M7 Karten ohne Kartenkacheln (keine Lizenz-/Attributionspflicht, kein gesperrtes Canvas)', !/tileUrl|api\.maptiler|rmx-tiles|drawImage\(/.test(code));

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
ok('V1 Laufen mit Strecke + Bestzeit: alle Karten (Hauptwert, drei Werte, Strecke, Strecke + Werte, Bestzeit, Zusammenfassung)', ids(run, 'card') === 'hero,trio,route,route_plus,pb,summary', ids(run, 'card'));
ok('V2 Laufen: Aufkleber Distanz, Zeit, Tempo, drei Werte, Strecke, Strecke + Werte, Statistik, Bestzeit', ids(run, 'sticker') === 's_main,s_time,s_rate,s_trio,s_route,s_route_stats,s_stats,s_pb', ids(run, 'sticker'));
ok('V3 Schwimmen ohne GPS: keine Streckenvorlage, keine Bestzeit', !/route|pb/.test(ids(swim, 'card') + ids(swim, 'sticker')), ids(swim, 'card') + ' | ' + ids(swim, 'sticker'));
ok('V4 Kraft ohne Strecke: Volumen als Hauptwert, Zeit, Saetze; keine Strecke', ids(gym, 'card') === 'hero,trio' && ids(gym, 'sticker') === 's_main,s_time,s_rate,s_trio', ids(gym, 'card') + ' | ' + ids(gym, 'sticker'));
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
ok('U4 Story pausiert waehrend der Auswahl und laeuft danach an derselben Seite weiter', /gmStoryStop\(\);\s*var host=document\.getElementById\('gmStory'\);if\(host\)host\.classList\.add\('st-paused'\)/.test(ui) && /onClose:function\(\)\{[\s\S]{0,400}gmStoryRender\(\)/.test(ui));
ok('U5 Story-Tasten ruhen, solange die Auswahl offen ist', /ORVIA\.storyShare\.isOpen\(\)\)return;/.test(ui));
ok('U6 Modul genau einmal geladen und im Precache', idx.split('js/story-share.js').length === 2 && sw.includes("'./js/story-share.js'"));
ok('U7 alle Vorlagen-Namen uebersetzt', ['hero', 'trio', 'route', 'route_plus', 'pb', 'summary', 's_main', 's_time', 's_rate', 's_trio', 's_route', 's_route_stats', 's_stats', 's_pb'].every(k => de.includes("'share.tpl." + k + "'")));

ok('U8 Highlights: Seite mit Strecke bleibt bis Zeichnung + 2,5 s (Fortschrittsbalken gleich lang), Abschlussseite ohne Zeitgeber', /data-st-ms="'\+\(_rm\?0:Math\.round\(_draw\*1000\+2650\)\)\+'"/.test(ui) && /var _ms=gmStoryPageMs\(_gmStory\.pages\[_gmStory\.idx\]\);\s*try\{host\.style\.setProperty\('--st-dur',\(_ms\/1000\)\+'s'\)/.test(ui) && /data-st-end="1"\/\.test\(_gmStory\.pages\[_gmStory\.idx\]\|\|''\)\)\{[\s\S]{0,240}?\}return;\}/.test(ui));
const sp = ui.slice(ui.indexOf('function gmStoryPages(a){'), ui.indexOf('function gmStoryStop('));
ok('U9 Highlights-Tempo aus demselben Modell wie Seite und Karte (Schwimmen: nie Gesamtzeit/Distanz inkl. Pausen als „Ø")',
  /var paceTxt=\(function\(\)\{try\{var md0=gmActAnalysisFor\(a,vm,null\)/.test(sp) && /md0\.family==='swimming'\?'pace100'/.test(sp) && /gmAxOk\(d0\)\?gmAaFmt\(d0,md0\.family\)/.test(sp) &&
  !/subParts\.push\('Ø '\+vm\.paceLabel\)/.test(sp) && !/cells\.push\(\[vm\.paceLabel,/.test(sp) && /c\[1\]==='TEMPO'\|\|c\[1\]==='PACE'/.test(sp));
console.log('\n' + (fail ? '❌' : '✅') + ' story_share_v456: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
