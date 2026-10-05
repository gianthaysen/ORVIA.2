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
  /* v8-431 — Gians Rueckmeldung zu v8-430 (drei Bildschirmfotos): „das geht immer noch besser".
     Befund an seinen Bildern: Kurve und Flaeche wirkten matt (Akzentfarbe statt leuchtender
     Diagrammfarbe), bei Leistung hing die Max-Linie bei 503 W in der Luft (gemittelte Kurve bis
     ~300 W, halbe Flaeche leer), unten blieb ein Drittel des Bildschirms leer.
     v8-430 — Rueckmeldung zu v8-429: „sieht immer noch billig aus". Massstab ist
     jetzt sein REFERENZBILD (nicht das mitgelieferte CSS): Tafel fast randlos mit eigenem
     Rahmen fuer die Zeichenflaeche, kantiger Linienzug von Rand zu Rand, Flaeche leuchtet
     direkt unter der Kurve, Max/Min als gestrichelte Bezugslinien mit Wert, Ø als helle
     Linie mit Schild — alles in der Zeichenflaeche. */
  const i = ui.indexOf('var _gmStoryChartSeq=0;'), j = ui.indexOf('/* Baut die Seiten NUR aus vorhandenen');
  const mk = calm => { const c = { gmEsc: s => String(s), window: { matchMedia: () => ({ matches: calm }) } }; vm.createContext(c); vm.runInContext(ui.slice(i, j) + '\nthis.F=gmStoryDotChart;this.M=gmMonoPath;', c); return c; };
  const ctx = mk(false);
  const vals = []; for (let k = 0; k < 300; k++) vals.push(120 + 30 * Math.sin(k / 20));
  const h = ctx.F(vals, ' bpm', 0, { avg: 135, max: 167 });
  const dLine = (/<path class="wst-line" d="([^"]+)"/.exec(h) || [])[1], dArea = (/<path class="wst-area" d="([^"]+)"/.exec(h) || [])[1];
  ok('B1 Kurve ist ein KANTIGER Linienzug (gerade Stuecke, keine Rundung) von Rand zu Rand', !!dLine && /^M0\.0,[\d.]+ L/.test(dLine) && !/C/.test(dLine) && / L360\.0,[\d.]+$/.test(dLine) && (dLine.match(/ L/g) || []).length === 83);
  ok('B2 Flaeche liegt genau unter DERSELBEN Kurve (Kurve + Grundlinie)', dArea === dLine + ' L360,300 L0,300 Z');
  const iRev = h.indexOf('<div class="wst-rev">'), iRevEnd = h.indexOf('</svg></div>', iRev);   /* Ende = nach dem Schein-SVG */
  const inRev = cls => { const p = h.indexOf('class="' + cls); return p > iRev && p < iRevEnd; };
  ok('B2a Flaeche, Schein UND Kurve liegen in EINER Aufdeck-Huelle (erscheinen gemeinsam)', iRev > 0 && inRev('wst-area') && inRev('wst-glow') && inRev('wst-line') && h.indexOf('class="wst-grid"') < iRev);
  ok('B2b Aufdecken per CSS (clip-path, 1,6 s, links → rechts) — kein SMIL im Markup', !/<animate/.test(h) && /\.gm-story \.wst-rev\{[^}]*clip-path:inset\(0\);animation:wstReveal 1\.6s cubic-bezier\(\.35,0,\.25,1\) both\}/.test(css) && /@keyframes wstReveal\{from\{[^}]*clip-path:inset\(0 100% 0 0\)\}to\{[^}]*clip-path:inset\(0\)\}\}/.test(css) && (css.match(/-webkit-clip-path:inset\(0/g) || []).length >= 3);
  const hc = mk(true).F(vals, ' bpm', 0);
  ok('B2c „Bewegung reduzieren": Diagramm steht sofort (Klasse calm + Medienabfrage)', /class="wst-dotwrap calm"/.test(hc) && /\.gm-story \.wst-dotwrap\.calm \.wst-rev\{animation:none\}/.test(css) && /prefers-reduced-motion:reduce\)\{[\s\S]{0,700}\.gm-story \.wst-rev\{animation:none\}[\s\S]{0,200}\.gm-story \.wst-avgline,\.gm-story \.wst-avgpill\{animation:none;opacity:1\}/.test(css));
  {
    /* Flaeche = waagerechter Verlauf K(x) × senkrechte Maske f(y): an der Kurve gilt Deckkraft min(f, A) */
    const stops = [...h.matchAll(/<stop offset="([\d.]+)" stop-opacity="([\d.]+)"\/>/g)].map(m => [+m[1], +m[2]]);
    const pts = dLine.replace(/^M/, '').split(' L').map(q => q.split(',').map(Number));
    const fOf = y => Math.pow(Math.max(0, 1 - y / 300), 1.6);
    const okK = stops.length === pts.length && stops.every((st, k) => Math.abs(st[0] - pts[k][0] / 360) < 0.0006 && Math.abs(st[1] - Math.min(1, 0.7 / fOf(pts[k][1]))) < 0.004);
    ok('B3 je Stuetzpunkt eine Deckkraft K = min(1, A/f) als waagerechter Verlauf (84 Stufen)', okK && /<linearGradient id="wstGrad\d+" class="wst-gk" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="360" y2="0">/.test(h), stops.length + ' Stufen');
    const fade = [...h.matchAll(/<stop offset="([\d.]+)" stop-color="rgb\((\d+),\2,\2\)"\/>/g)].map(m => [+m[1], +m[2]]);
    ok('B3a senkrechte Maske: oben weiss (1), Boden schwarz (0), dazwischen f(y) = (1−y)^1,6', fade.length === 9 && fade[0][1] === 255 && fade[8][1] === 0 && fade.every(q => Math.abs(q[1] - Math.round(255 * Math.pow(1 - q[0], 1.6))) <= 1) && /<mask id="(wstMask\d+)" maskUnits="userSpaceOnUse" x="0" y="0" width="360" height="300">/.test(h) && /class="wst-area"[^>]* fill="url\(#wstGrad\d+\)" mask="url\(#wstMask\d+\)"/.test(h));
    const at = k => stops[k][1] * fOf(pts[k][1]);
    ok('B3b Ergebnis an der Kurve: nie heller als A = 0,7 (× .32 Gesamtdeckkraft ⇒ rund 22 % direkt unter der Kurve, v8-439); hohe Spalten erreichen A, niedrige bleiben darunter', stops.every((st, k) => at(k) <= 0.7005) && stops.some((st, k) => at(k) < 0.45) && (() => { /* Kurve bis an die Max-Linie (ohne Summary-Max): dort wird A erreicht */ const hh = ctx.F(vals, ' bpm', 0); const s2 = [...hh.matchAll(/<stop offset="([\d.]+)" stop-opacity="([\d.]+)"\/>/g)].map(m => +m[2]); const p2 = ((/<path class="wst-line" d="([^"]+)"/.exec(hh) || [])[1] || '').replace(/^M/, '').split(' L').map(q => +q.split(',')[1]); return s2.some((o, k) => Math.abs(o * fOf(p2[k]) - 0.7) < 0.003) && s2.every((o, k) => o * fOf(p2[k]) <= 0.7005); })() && /\.gm-story \.wst-area\{fill-opacity:\.32\}/.test(css));
    ok('B3c EIN Flaechen-Pfad, keine Streifen/Punkte', (h.match(/class="wst-area"/g) || []).length === 1 && !/<rect x="[\d.]+" y="[\d.]+" width="2/.test(h) && !/<circle/.test(h));
  }
  ok('B4 Schein = derselbe Linienzug in einem eigenen SVG UNTER der Kurve, als Ganzes per CSS weichgezeichnet (kein SVG-Filter am Pfad)', (() => { const m = /<svg class="wst-dots wst-halo"[^>]*><path class="wst-glow" d="([^"]+)"\/><\/svg>/.exec(h); return !!m && m[1] === dLine && h.indexOf('wst-halo') > h.indexOf('class="wst-line"') && !/<filter|filter="/.test(h) && /\.gm-story \.wst-halo\{z-index:0;-webkit-filter:blur\(3px\);filter:blur\(3px\)\}/.test(css) && /\.gm-story \.wst-rev>\.wst-dots:not\(\.wst-halo\)\{z-index:1\}/.test(css); })());
  ok('B5 Max und Ø aus der Summary, mit Einheit, in der Zeichenflaeche', /class="wst-ref wst-refmax[^"]*" style="top:[\d.]+%"><i><\/i><b>167 bpm<\/b><u><\/u><\/span>/.test(h) && /class="wst-avgpill" style="top:[\d.]+%"><i><\/i><b><em>Ø<\/em> 135 bpm<\/b><\/span>/.test(h) && /class="wst-ref wst-refmin[^"]*"[^>]*><i><\/i><b>90 bpm<\/b>/.test(h));
  const h2 = ctx.F(vals, ' bpm', 0);
  ok('B6 ohne Summary: Ø/Max der Samples; Summary-Max unter dem Sample-Max wird ignoriert', /<em>Ø<\/em> 1\d\d bpm/.test(h2) && /wst-refmax[^>]*><i><\/i><b>150 bpm<\/b>/.test(h2) && /wst-refmax[^>]*><i><\/i><b>150 bpm<\/b>/.test(ctx.F(vals, ' bpm', 0, { max: 140 })));
  ok('B7 jede Grafik bekommt eigene ids (Verlauf, Maske)', (/id="(wstGrad\d+)"/.exec(h2) || [])[1] !== (/id="(wstGrad\d+)"/.exec(h) || [])[1] && (/id="(wstMask\d+)"/.exec(h2) || [])[1] !== (/id="(wstMask\d+)"/.exec(h) || [])[1]);
  ok('B8 zu wenige Werte ⇒ kein Diagramm', ctx.F([1, 2, 3], ' W', 0) === '' && ctx.F(null) === '');
  ok('B9 CSS: Striche skalieren nicht mit; Story auf breiten Bildschirmen im Handy-Format', /\.gm-story \.wst-line\{[^}]*stroke-width:2\.4;[^}]*vector-effect:non-scaling-stroke/.test(css) && !/wstLineIn/.test(css) && /@media\(min-width:700px\)\{\s*\.gm-story\{inset:0 auto 0 50%;width:440px/.test(css));
  {
    const top = cls => parseFloat((new RegExp('class="wst-ref ' + cls + '[^"]*" style="top:([\\d.]+)%"').exec(h) || [])[1]);
    ok('B10 Max-Linie oben (9 %), Min-Linie unten (91,5 %) — die Kurve nutzt die Hoehe dazwischen', Math.abs(top('wst-refmax') - 9) < 0.11 && Math.abs(top('wst-refmin') - 91.5) < 0.11);
    const side = (hh, cls) => (new RegExp('class="wst-ref ' + cls + '( r)?"').exec(hh) || [])[1] ? 'r' : 'l';
    /* Kurve beginnt unten links (Aufwaermen): Min-Wert weicht nach rechts aus, Max bleibt links */
    const warm = []; for (let k = 0; k < 400; k++) warm.push(k < 60 ? 96 + k * 0.6 : 140 + 12 * Math.sin(k / 9));
    const hw = ctx.F(warm, ' bpm', 0);
    /* Hoechstwert gleich am Anfang: Max-Wert weicht nach rechts aus */
    const early = []; for (let k = 0; k < 400; k++) early.push(k < 40 ? 170 - k * 0.2 : 130 + 8 * Math.sin(k / 11) - (k > 300 ? 20 : 0));
    const he = ctx.F(early, ' bpm', 0);
    ok('B11 Max/Min stehen links — ausser die Kurve laeuft dort durch den Text, dann rechts', side(h2, 'wst-refmax') === 'l' && side(hw, 'wst-refmin') === 'r' && side(hw, 'wst-refmax') === 'l' && side(he, 'wst-refmax') === 'r', [side(hw, 'wst-refmin'), side(he, 'wst-refmax')].join('/'));
    ok('B11a CSS: .r dreht die Zeile (Wert rechts, Linie links)', /\.gm-story \.wst-ref\.r\{flex-direction:row-reverse\}/.test(css) && /\.gm-story \.wst-ref u\{flex:1;height:1px;[^}]*repeating-linear-gradient/.test(css));
    /* Ø dicht am Max UND Max rechts: nur das Schild rueckt ab, die Linie bleibt auf dem echten Wert */
    const flat = []; for (let k = 0; k < 400; k++) flat.push(k < 110 ? 150 : (k > 200 && k < 208 ? 20 : (k >= 290 ? 135 : 147)));
    const hf = ctx.F(flat, ' W', 0);
    const lineP = parseFloat((/class="wst-avgline" style="top:([\d.]+)%"/.exec(hf) || [])[1]), pillP = parseFloat((/class="wst-avgpill" style="top:([\d.]+)%"/.exec(hf) || [])[1]), maxP = parseFloat((/class="wst-ref wst-refmax[^"]*" style="top:([\d.]+)%"/.exec(hf) || [])[1]);
    ok('B12 Ø nahe Max auf derselben Seite: Schild haelt 11 % Abstand, Linie bleibt wahr', side(hf, 'wst-refmax') === 'r' && pillP - maxP >= 10.99 && lineP < pillP && lineP > maxP, 'Linie ' + lineP + ' % · Schild ' + pillP + ' % · Max ' + maxP + ' %');
    const konst = ctx.F([140, 140, 140, 140, 140, 140], ' bpm', 0);
    ok('B13 konstante Reihe: keine doppelte Linie (Min entfaellt), kein Absturz', /wst-refmax/.test(konst) && !/wst-refmin/.test(konst) && !/NaN|Infinity/.test(konst));
    ok('B14 Raster: 5 waagerechte + 8 senkrechte Linien, fein gestrichelt, sehr zurueckhaltend', ((/<g class="wst-grid">(.*?)<\/g>/.exec(h) || [])[1] || '').split('<line').length - 1 === 13 && /\.gm-story \.wst-grid line\{stroke:var\(--orvia-chart-grid\);stroke-width:1;stroke-dasharray:2 3;vector-effect:non-scaling-stroke\}/.test(css) && /--orvia-chart-grid:rgba\(130,160,190,\.1[0-4]\)/.test(css));
    ok('B15 Ø: helle gestrichelte Linie ueber die ganze Breite, Punkt + Schild rechts; erscheinen nach dem Aufdecken', /\.gm-story \.wst-avgline\{position:absolute;left:0;right:0;height:1px;[^}]*rgba\(240,244,248,\.92\)[^}]*animation:wstDot \.5s ease-out 1\.5s forwards/.test(css) && /\.gm-story \.wst-avgpill\{position:absolute;right:8px;[^}]*animation:wstDot \.5s ease-out 1\.5s forwards/.test(css) && h.indexOf('class="wst-avgline"') > iRevEnd);
    ok('B16 Tafel fast randlos (ragt 13 px ueber den Seitenrand), ruhiger blaugrauer Rand ohne Aussenschein (v8-439), eigener Rahmen fuer die Zeichenflaeche auf der Diagrammflaeche des Farbsystems', /\.gm-story \.wst-dotwrap\{[^}]*margin:2px -13px 0;[^}]*border-radius:18px;border:1px solid var\(--orvia-chart-border\)/.test(css) && !/rgba\(70,150,245/.test((/\.gm-story \.wst-dotwrap\{([^}]*)\}/.exec(css) || [])[1] || 'rgba(70,150,245') && /\.gm-story \.wst-plot\{position:absolute;inset:15px 12px 13px;border-radius:12px;border:1px solid rgba\(130,160,190,\.16\);overflow:hidden;\s*background:var\(--orvia-chart-surface\)\}/.test(css) && /--orvia-chart-surface:#071321/.test(css));
    ok('B17 Tafel nimmt die freie Bildschirmhoehe auf (230–560 px), Gruppe steht unter dem Titel', /height:clamp\(230px,calc\(100dvh - 370px - var\(--sat,0px\) - env\(safe-area-inset-bottom,0px\)\),560px\)/.test(css) && /height:clamp\(230px,calc\(100vh - 370px\),560px\);height:clamp/.test(css) && /\.gm-story \.wst-in\.wst-chartpg \.wst-mid\{flex:0 0 auto;margin-top:clamp\(20px,6vh,60px\);/.test(css) && /\.gm-story \.wst-in\.wst-chartpg \.wst-foot\{margin-top:26px;margin-bottom:auto\}/.test(css) && (ui.match(/,'wst-chartpg'\)\);/g) || []).length === 3);
    ok('B18 Farbe folgt der Sportart ueber das Farbsystem (v8-439: EINE Farbe --activity-primary): Kurve, Flaeche, Ø-Zeichen; Schein leise (--activity-glow-strong); Werte in Textfarbe', /\.gm-story \.wst-line\{fill:none;stroke:var\(--activity-primary\);/.test(css) && /\.gm-story \.wst-glow\{fill:none;stroke:var\(--activity-glow-strong\);/.test(css) && /\.gm-story \.wst-gk stop\{stop-color:var\(--activity-primary\)\}/.test(css) && /\.gm-story \.wst-avgpill em\{font-style:normal;color:var\(--activity-primary\)\}/.test(css) && !/var\(--activity/.test((/\.gm-story \.wst-ref\{([^}]*)\}/.exec(css) || [])[1] || 'var(--activity') && !/--acchi|--accsoft/.test(css));
    {
      /* Spitzen erhalten: Leistung mit 1-Hz-Rauschen und einem 4-s-Sprint — die Kurve MUSS die Max-Linie beruehren */
      const pw = []; for (let k = 0; k < 3000; k++) pw.push(100 + ((k * 37) % 61) - 30); for (let q = 0; q < 4; q++) pw[2700 + q] = [470, 503, 488, 430][q]; pw[900] = 0;
      const hp = ctx.F(pw, ' W', 0, { avg: 101, max: 503 });
      const ys = ((/<path class="wst-line" d="([^"]+)"/.exec(hp) || [])[1] || '').replace(/^M/, '').split(' L').map(q => +q.split(',')[1]);
      const yMax = 300 * 0.09, yMin = 300 * (1 - 0.085);
      ok('B19a Kurve beruehrt die Max-Linie dort, wo der Hoechstwert gemessen wurde (nicht mehr nur das Spaltenmittel)', Math.abs(Math.min(...ys) - yMax) < 0.06 && ys.indexOf(Math.min(...ys)) === Math.floor(2701 * 84 / 3000), 'oben ' + Math.min(...ys).toFixed(1) + ' / Linie ' + yMax.toFixed(1));
      ok('B19b … und die Min-Linie am tiefsten Messwert', Math.abs(Math.max(...ys) - yMin) < 0.06 && ys.indexOf(Math.max(...ys)) === Math.floor(900 * 84 / 3000));
      ok('B19c alle uebrigen Spalten bleiben ihr Mittel (kein Zickzack aus Einzelwerten)', ys.filter(y => y < 300 * 0.5).length === 1);
    }
    {
      /* v8-439: keine eigene Farbtabelle der Story mehr — jede Seite traegt das Farbthema der Sportart als data-activity */
      ok('B19d die Story hat keine eigene Farbtabelle mehr; jede Seite traegt das Farbthema der Sportart (data-activity)', !/function gmStoryTheme\(/.test(ui) && !/accCss/.test(ui) && /var actAttr=gmActThemeAttr\(vm\.sportId\);/.test(ui) && /return '<div class="wst-bg" '\+actAttr\+'><\/div><div class="wst-in'\+\(cls\?' '\+cls:''\)\+'" '\+actAttr\+'>'\+top\+/.test(ui));
    }
    ok('B19 alte Bausteine sind restlos weg (Etikettenspalte, Ring, Streifen-Zuschnitt)', !/wst-axis|wst-axmax|wst-axavg|wst-pk|wst-avgdot|wst-avgbadge/.test(h + css) && !/<clipPath/.test(h));
  }
  {
    /* monoton-kubisch bleibt als Baustein erhalten (andere Diagramme) */
    const pts = [[0, 100], [10, 40], [20, 40], [30, 90], [40, 10], [50, 60]];
    const d = ctx.M(pts); const segs = d.trim().split(' C').filter(Boolean).map(x => x.trim().split(' ').map(q => q.split(',').map(Number)));
    const hit = segs.every((sg, k) => sg[2][0] === pts[k + 1][0] && sg[2][1] === pts[k + 1][1]);
    const bounded = segs.every((sg, k) => { const lo = Math.min(pts[k][1], pts[k + 1][1]) - 0.05, hi = Math.max(pts[k][1], pts[k + 1][1]) + 0.05; return sg[0][1] >= lo && sg[0][1] <= hi && sg[1][1] >= lo && sg[1][1] <= hi; });
    ok('B20 gmMonoPath trifft jeden Stuetzpunkt exakt und schwingt nie ueber', segs.length === 5 && hit && bounded);
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
