/* ============================================================
   ORVIA · power_story_line — Leistung (Watt) + Story-Kurve als harte Linie (v8-424)
   Gians Befunde 2.10.: Wattzahl fehlt in Aktivitaet und Story; die Story-Diagramme
   zeigen Hoehen und Tiefen nur ueber Punkte — gewuenscht: durchgezogene Linie, Punkte
   nur als Hintergrund und an der Linie abgeschnitten.
   node supabase/tests/power_story_line_test.mjs
   ============================================================ */
import fs from 'fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i != null ? '  — ' + i : '')); c ? pass++ : fail++; };
const ui = rd('js/ui.js'), act = rd('js/activity.js'), css = rd('styles.css');
globalThis.ORVIA = {};
const AN = (await import(new URL(_APPREL + 'js/activity-normalize.js', import.meta.url))).default;

{
  const s = AN.normalizeActivitySummary({ distance_m: 19960, avg_power_w: 141.4, max_power_w: 402, norm_power_w: 156 }, 'cycling');
  ok('A1 Summary: avg/max/NP → avgPowerW/maxPowerW/normPowerW (gerundet), snake_case entfernt', s.avgPowerW === 141 && s.maxPowerW === 402 && s.normPowerW === 156 && !('avg_power_w' in s) && !('norm_power_w' in s));
  const z = AN.normalizeActivitySummary({ distance_m: 5000, avg_power_w: 0, max_power_w: -3 }, 'cycling');
  ok('A2 0 W / negativ ist kein Messwert ⇒ kein Feld', !('avgPowerW' in z) && !('maxPowerW' in z) && !('normPowerW' in z));
  ok('A3 idempotent (zweite Normalisierung unveraendert)', JSON.stringify(AN.normalizeActivitySummary(s, 'cycling')) === JSON.stringify(s));
  const dm = AN.activityDetailModel('cycling', s, 3060, {});
  ok('A4 Detailmodell traegt die Leistung', dm.avgPowerW === 141 && dm.maxPowerW === 402 && dm.normPowerW === 156);
  ok('A5 View-Model: Summary fuehrt, sonst Ø/Max aus der echten Messreihe (powerSource stream)', /powerSource: \(dm && dm\.avgPowerW != null\) \? 'summary' : null/.test(act) && /vm\.avgPowerW = Math\.round\(_ps \/ _pn\); vm\.powerSource = 'stream';/.test(act) && /if \(_pn >= 5 && _pm > 0\)/.test(act));
}
{
  const i = ui.indexOf('var _gmStoryChartSeq=0;'), j = ui.indexOf('/* Baut die Seiten NUR aus vorhandenen');
  const mk = calm => { const c = { gmEsc: s => String(s), window: { matchMedia: () => ({ matches: calm }) } }; vm.createContext(c); vm.runInContext(ui.slice(i, j) + '\nthis.F=gmStoryDotChart;this.M=gmMonoPath;', c); return c; };
  const ctx = mk(false);
  const vals = []; for (let k = 0; k < 300; k++) vals.push(120 + 30 * Math.sin(k / 20));
  const h = ctx.F(vals, ' bpm', 0, { avg: 135, max: 167 });
  const clipId = (/<clipPath id="(wstClip\d+)">/.exec(h) || [])[1];
  ok('B1 durchgezogene Linie ueber dem Punktraster', /<path class="wst-line" d="M0,/.test(h) && h.indexOf('class="wst-line"') > h.lastIndexOf('<circle'));
  ok('B2 Punkte werden an der Kurve abgeschnitten (clipPath = Flaeche unter der Linie)', !!clipId && new RegExp('<g clip-path="url\\(#' + clipId + '\\)">').test(h) && /L360,430 L0,430 Z"\/><\/clipPath>/.test(h));
  /* v8-425: EINE gemeinsame Aufdeck-Bewegung, weiche Kurve, Verlaufsflaeche */
  const revId = (/<clipPath id="(wstRev\d+)">/.exec(h) || [])[1];
  const iRev = h.indexOf('<g clip-path="url(#' + revId + ')">');
  ok('B2a Flaeche, Punkte UND Linie liegen im selben Reveal-Zuschnitt (Linie zeichnet sich mit den Punkten)', !!revId && iRev > 0 && iRev < h.indexOf('class="wst-area"') && iRev < h.indexOf('<circle') && iRev < h.indexOf('class="wst-line"'));
  ok('B2b Reveal laeuft von links nach rechts; statische Breite = volle Breite (ohne SMIL sofort sichtbar)', /<rect x="0" y="-12" width="360" height="454"><animate attributeName="width" from="0" to="360" begin="0s" dur="1\.6s" fill="freeze"/.test(h));
  const hc = mk(true).F(vals, ' bpm', 0);
  ok('B2c „Bewegung reduzieren": keine Animation, Diagramm steht sofort', !/<animate/.test(hc) && /class="wst-dotwrap calm"/.test(hc) && /class="wst-line"/.test(hc));
  ok('B2d Kurve ist kubisch (weich), keine Polylinie', (h.match(/ C[\d.-]+,[\d.-]+ /g) || []).length >= 70 && /linearGradient id="wstGrad\d+"/.test(h));
  {
    /* monoton-kubisch: trifft jeden Stuetzpunkt, kein Ueberschwingen (Kontrollpunkte bleiben zwischen den Nachbarn) */
    const pts = [[0, 100], [10, 40], [20, 40], [30, 90], [40, 10], [50, 60]];
    const d = ctx.M(pts); const segs = d.trim().split(' C').filter(Boolean).map(x => x.trim().split(' ').map(q => q.split(',').map(Number)));
    const hit = segs.every((sg, k) => sg[2][0] === pts[k + 1][0] && sg[2][1] === pts[k + 1][1]);
    const bounded = segs.every((sg, k) => { const lo = Math.min(pts[k][1], pts[k + 1][1]) - 0.05, hi = Math.max(pts[k][1], pts[k + 1][1]) + 0.05; return sg[0][1] >= lo && sg[0][1] <= hi && sg[1][1] >= lo && sg[1][1] <= hi; });
    ok('B2e Kurve trifft jeden Stuetzpunkt exakt und schwingt nie ueber einen Messwert hinaus', segs.length === 5 && hit && bounded, JSON.stringify(segs.map(sg => [sg[0][1], sg[1][1]])));
  }
  const dLine = (/<path class="wst-line" d="([^"]+)"/.exec(h) || [])[1], dClip = (/<clipPath id="[^"]+"><path d="([^"]+)"/.exec(h) || [])[1];
  ok('B3 Linie und Zuschnitt folgen DERSELBEN Kurve', !!dLine && !!dClip && dClip.indexOf(dLine) === 0);
  ok('B4 Punkte ohne Hervorhebung (kein t0/t1/t2 mehr) — reiner Hintergrund', !/class="t[012]"/.test(h) && (h.match(/<circle/g) || []).length > 300 && (h.match(/<circle/g) || []).length < 2100);
  ok('B5 Ø/Max aus der Summary als Anzeige (eine Wahrheit mit dem Zahlenraster)', /class="wst-ax wst-axavg"[^>]*>Ø 135<\/span>/.test(h) && /class="wst-ax wst-axmax"[^>]*>167<i>bpm<\/i><\/span>/.test(h));
  const h2 = ctx.F(vals, ' bpm', 0);
  ok('B6 ohne Summary: Ø/Max der Samples; Summary-Max unter dem Sample-Max wird ignoriert', />Ø 1\d\d<\/span>/.test(h2) && />150<i>bpm<\/i>/.test(h2) && />150<i>bpm<\/i>/.test(ctx.F(vals, ' bpm', 0, { max: 140 })));
  ok('B7 jede Grafik bekommt eine eigene clipPath-id', (/<clipPath id="(wstClip\d+)">/.exec(h2) || [])[1] !== clipId);
  ok('B8 zu wenige Werte ⇒ kein Diagramm', ctx.F([1, 2, 3], ' W', 0) === '' && ctx.F(null) === '');
  ok('B9 CSS: Linie skaliert nicht mit, erscheint NICHT mehr per eigener Einblendung; Story auf breiten Bildschirmen im Handy-Format', /\.gm-story \.wst-line\{[^}]*vector-effect:non-scaling-stroke/.test(css) && !/wstLineIn/.test(css) && /@media\(min-width:700px\)\{\s*\.gm-story\{inset:0 auto 0 50%;width:440px/.test(css));

  /* v8-428 (Gian 2.10.: „sieht jetzt noch billiger aus"): duenne Linie, ruhiges Raster,
     Beschriftung als Werteachse NEBEN der Zeichenflaeche — nichts liegt mehr auf der Kurve. */
  {
    const iPlot = h.indexOf('<div class="wst-plot">'), iAxis = h.indexOf('<div class="wst-axis"'), iSvgEnd = h.indexOf('</svg>'), iPk = h.indexOf('class="wst-pk"');
    ok('B10 Zeichenflaeche und Werteachse sind getrennt: SVG + Marker in .wst-plot, Etiketten danach in .wst-axis', iPlot > 0 && iSvgEnd > iPlot && iPk > iSvgEnd && iAxis > iPk && h.indexOf('class="wst-ax ') > iAxis && !/wst-avgbadge/.test(h) && !/wst-avgbadge/.test(css));
    ok('B11 CSS: Zeichenflaeche laesst rechts Platz fuer die Achse; Achse liegt in diesem Rand', /\.gm-story \.wst-plot\{position:absolute;inset:0 50px 0 0\}/.test(css) && /\.gm-story \.wst-axis\{position:absolute;top:0;bottom:0;right:0;width:42px\}/.test(css));
    const lineCss = (/\.gm-story \.wst-line\{([^}]*)\}/.exec(css) || [])[1] || '';
    ok('B12 Linie: 2 px, runde Enden, KEIN Leuchten/Schatten', /stroke-width:2;/.test(lineCss) && /stroke-linecap:round/.test(lineCss) && !/filter|drop-shadow/.test(lineCss));
    const avgCss = (/\.gm-story \.wst-avg\{([^}]*)\}/.exec(css) || [])[1] || '';
    ok('B13 Ø-Linie: durchgezogene Haarlinie (nie gestrichelt), liegt HINTER der Kurve', /stroke-width:1;/.test(avgCss) && !/dasharray/.test(avgCss) && h.indexOf('class="wst-avg"') > 0 && h.indexOf('class="wst-avg"') < h.indexOf('<g clip-path="url(#' + revId + ')">'));
    ok('B14 Raster zurueckgenommen (≤ .18), Flaeche nur als Hauch (≤ .25)', (() => { const a = /\.gm-story \.wst-dots circle\{[^}]*opacity:(\.\d+)/.exec(css), g = /\.gm-story \.wst-g0\{[^}]*stop-opacity:(\.\d+)/.exec(css); return !!a && !!g && parseFloat(a[1]) <= 0.18 && parseFloat(g[1]) <= 0.25; })());
    ok('B15 Etiketten tragen Textfarbe, nie die Serienfarbe', (() => { const a = /\.gm-story \.wst-ax\{([^}]*)\}/.exec(css), b = /\.gm-story \.wst-axavg\{([^}]*)\}/.exec(css); return !!a && !!b && !/var\(--acc/.test(a[1]) && !/var\(--acc/.test(b[1]); })());
    const top = cls => parseFloat((new RegExp('class="wst-ax ' + cls + '" style="top:([\\d.]+)%"').exec(h) || [])[1]);
    ok('B16 Max oben, Min unten, Ø dazwischen auf seiner Hoehe', top('wst-axmax') < 5 && top('wst-axmin') > 95 && top('wst-axavg') > top('wst-axmax') && top('wst-axavg') < top('wst-axmin'), [top('wst-axmax'), top('wst-axavg'), top('wst-axmin')].join(' / '));
    /* Ø dicht am Maximum (gleichmaessige Fahrt mit einem Einbruch): nur das ETIKETT rueckt ab, die Haarlinie bleibt wahr */
    const flat = []; for (let k = 0; k < 400; k++) flat.push(k > 200 && k < 210 ? 60 : 150);
    const hf = ctx.F(flat, ' W', 0);
    const tf = cls => parseFloat((new RegExp('class="wst-ax ' + cls + '" style="top:([\\d.]+)%"').exec(hf) || [])[1]);
    const yLine = parseFloat((/class="wst-avg" x1="0" x2="360" y1="([\d.]+)"/.exec(hf) || [])[1]) / 430 * 100;
    ok('B17 Ø nahe Max: Etiketten halten ≥ 8 % Abstand, Haarlinie bleibt auf dem echten Wert', tf('wst-axavg') - tf('wst-axmax') >= 7.99 && yLine < tf('wst-axavg') && yLine > 0, 'Etikett ' + tf('wst-axavg') + ' % · Linie ' + yLine.toFixed(1) + ' %');
    /* Hoechstwert in der letzten Spalte: Marker bleibt ganz im Bild */
    const up = []; for (let k = 0; k < 300; k++) up.push(100 + k / 3);
    const pkL = parseFloat((/class="wst-pk" style="left:([\d.]+)%/.exec(ctx.F(up, ' bpm', 0)) || [])[1]);
    const dn = up.slice().reverse();
    const pkL2 = parseFloat((/class="wst-pk" style="left:([\d.]+)%/.exec(ctx.F(dn, ' bpm', 0)) || [])[1]);
    ok('B18 Marker am Hoechstwert wird am Rand nicht abgeschnitten (1,4 % … 98,6 %)', pkL <= 98.6 && pkL > 95 && pkL2 >= 1.4 && pkL2 < 5, pkL2 + ' / ' + pkL);
    ok('B19 Linie nutzt die volle Aufloesung (150 Stuetzpunkte), das Raster bleibt grob (58 Spalten)', /lcols=Math\.min\(150,vals\.length\),dcols=Math\.min\(58,vals\.length\)/.test(ui) && (h.match(/ C[\d.-]+,[\d.-]+ /g) || []).length >= 140);
  }
}
{
  ok('C1 Story: eigene Leistungs-Seite nur mit Messreihe UND Ø-Wert', /var pw=cleanArr\(st&&st\.power,/.test(ui) && /if\(pw&&vm\.avgPowerW!=null\)\{/.test(ui) && /gmStoryDotChart\(pw,' W',0,\{avg:vm\.avgPowerW,max:vm\.maxPowerW\}\)/.test(ui));
  ok('C2 Story-HF/-Tempo nutzen Summary-Ø/Max (kein „164" neben „167")', /gmStoryDotChart\(hr,' bpm',0,\{avg:hrAvg,max:hrMax\}\)/.test(ui) && /var hrMax=Math\.max\(Math\.max\.apply\(null,hr\),\(vm\.maxHr!=null\?vm\.maxHr:0\)\);/.test(ui) && /gmStoryDotChart\(spdC,' km\/h',1,\{avg:spAvg\}\)/.test(ui));
  ok('C3 Aktivitaetsseite: Leistungs-Kacheln (Ø/NP/Max) nur wenn belegt, Messreihe „Leistung (W)"', /if\(_pwC\.length\)kcells\.splice\.apply\(kcells,\[3,0\]\.concat\(_pwC\)\);/.test(ui) && /\{key:'power',label:'' \+ _uiT\('ui\.leistung_w'\)/.test(ui));
  ok('C4 Rad: Trittfrequenz in rpm statt „spm"', /sportId==='cycling'\s*\?\{key:'cadence',label:'' \+ _uiT\('ui\.trittfrequenz_rpm'\)/.test(ui));
  ok('C5 Kraft ohne Uebungslog: nur belegte Kacheln statt vier Striche', /if\(!_gym\|\|\(_gym\.exCount==null&&_gym\.setCount==null&&_gym\.volumeKg==null\)\)\{/.test(ui));
}
console.log('\n' + (fail ? '❌' : '✅') + ' power_story_line: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
