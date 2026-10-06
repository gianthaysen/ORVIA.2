/* ============================================================
   ORVIA · route_map_view — Kartenansicht zum Umsehen (v8-435)
   Gians Auftrag 5.10.: auf der Aktivitaetsseite auf die Karte tippen ⇒ Karte mit Strecke
   oeffnet sich, verschieben und zoomen. Weiterhin Rasterkacheln, keine Kartenbibliothek.
   Hier: reine Rechnung (Ausschnitt, Zoom um einen Punkt, Verschieben, Abbildung gelegt →
   aktuell) + Verdrahtung. Der echte Browserlauf steht in route_map_view_e2e_test.mjs.
   node supabase/tests/route_map_view_test.mjs
   ============================================================ */
import fs from 'fs';
import vm from 'node:vm';
import { existsSync } from 'node:fs';
const _APPREL = existsSync(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i != null ? '  — ' + i : '')); c ? pass++ : fail++; };
const rmSrc = rd('js/route-map.js'), src = rd('js/route-map-view.js'), ui = rd('js/ui.js'), css = rd('styles.css'), idx = rd('index.html'), sw = rd('sw.js'), cfgSrc = rd('js/map-config.js'), de = rd('locales/de.js');
const REAL = (() => { const c = { window: {} }; vm.createContext(c); vm.runInContext(cfgSrc, c); return c.window.ORVIA_MAP_CONFIG; })();
const c = { ORVIA: {}, ORVIA_MAP_CONFIG: Object.assign({}, REAL, { key: 'abc' }), Math, isFinite, encodeURIComponent, String, Array, Infinity, Object, Date, setTimeout, clearTimeout };
c.window = c; c.globalThis = c; vm.createContext(c); vm.runInContext(rmSrc, c); vm.runInContext(src, c);
const R = c.ORVIA.routeMap, V = c.ORVIA.routeMapView;
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);

/* Strecke „Bochum": Rundkurs ~2,9 km */
const way = [[51.4800, 7.2160], [51.4800, 7.2200], [51.4820, 7.2200], [51.4820, 7.2240], [51.4850, 7.2240], [51.4850, 7.2180], [51.4830, 7.2180], [51.4830, 7.2140], [51.4780, 7.2140], [51.4780, 7.2160], [51.4797, 7.2160]];
const route = []; for (let i = 0; i < way.length - 1; i++) for (let k = 0; k < 12; k++) route.push([way[i][0] + (way[i + 1][0] - way[i][0]) * k / 12, way[i][1] + (way[i + 1][1] - way[i][1]) * k / 12]); route.push(way[way.length - 1]);
const W = 390, H = 844, PAD = { t: 110, r: 44, b: 135, l: 44 };
const scr = (lat, lon, v) => { const o = V.origin(v); return [R.lonX(lon) * o.W - o.ox, R.latY(lat) * o.W - o.oy]; };

/* ---------- A) Ausschnitt „ganze Strecke" ---------- */
{
  const f = V.fitView(route, W, H, PAD), v0 = R.fit(route, W, H, PAD, 512);
  ok('A1 fitView liefert Mittelpunkt (Mercator 0…1) + Zoomstufe; dieselbe Zoomstufe wie das Standbild (fit)', !!f && near(f.Z, v0.Z) && f.cx > 0.51 && f.cx < 0.53 && f.cy > 0.32 && f.cy < 0.34 && f.w === W && f.h === H, JSON.stringify([+f.Z.toFixed(3), +f.cx.toFixed(5), +f.cy.toFixed(5)]));
  const inside = route.every(p => { const s = scr(p[0], p[1], f); return s[0] >= PAD.l - 0.5 && s[0] <= W - PAD.r + 0.5 && s[1] >= PAD.t - 0.5 && s[1] <= H - PAD.b + 0.5; });
  ok('A2 die GANZE Strecke liegt innerhalb des Innenrands (Kopf oben, Knoepfe unten frei)', inside);
  const p0 = R.project(route[0][0], route[0][1], v0), s0 = scr(route[0][0], route[0][1], f);
  ok('A3 Lage deckt sich mit dem Standbild (gleicher Punkt, gleiche Bildschirmstelle ± 0,001 px)', near(p0[0], s0[0], 1e-3) && near(p0[1], s0[1], 1e-3), JSON.stringify([p0.map(x => +x.toFixed(2)), s0.map(x => +x.toFixed(2))]));
  ok('A4 unbrauchbare Strecke ⇒ null (Ansicht oeffnet nicht)', V.fitView([[51, 7]], W, H, PAD) === null && V.fitView(null, W, H, PAD) === null);
}

/* ---------- B) Zoomen um einen Punkt ---------- */
{
  const f = V.fitView(route, W, H, PAD), lim = V.limits(f.Z);
  const px = 120, py = 300, o = V.origin(f), gx = (o.ox + px) / o.W, gy = (o.oy + py) / o.W;
  let all = true, worst = 0;
  [1, 0.37, -1, -2.5, 2].forEach(dZ => { const z = V.zoomAt(f, px, py, dZ, lim), o2 = V.origin(z); const e = Math.max(Math.abs(gx * o2.W - o2.ox - px), Math.abs(gy * o2.W - o2.oy - py)); worst = Math.max(worst, e); if (e > 1e-6) all = false; });
  ok('B1 der Ort unter dem Finger bleibt unter dem Finger (hinein, heraus, gebrochene Stufen)', all, 'groesste Abweichung ' + worst.toExponential(1) + ' px');
  ok('B2 Zoomstufe aendert sich genau um dZ', near(V.zoomAt(f, px, py, 1, lim).Z, f.Z + 1) && near(V.zoomAt(f, px, py, -1, lim).Z, f.Z - 1));
  ok('B3 Grenzen: hoechstens ' + V.Z_OUT + ' Stufen heraus, hinein bis Stufe ' + V.Z_MAX + ' (⇒ 512er-Kachelstufe ≤ 17)', near(lim.min, f.Z - V.Z_OUT) && lim.max === V.Z_MAX && near(V.zoomAt(f, px, py, -9, lim).Z, lim.min) && near(V.zoomAt(f, px, py, +9, lim).Z, lim.max) && R.level(V.Z_MAX, 512).z <= 17, JSON.stringify([+lim.min.toFixed(2), lim.max, R.level(V.Z_MAX, 512)]));
  const two = V.zoomAt(V.zoomAt(f, px, py, 0.5, lim), px, py, 0.5, lim), one = V.zoomAt(f, px, py, 1, lim);
  ok('B4 viele kleine Schritte = ein grosser (Pinch ruckelt nicht weg)', near(two.cx, one.cx, 1e-12) && near(two.cy, one.cy, 1e-12) && near(two.Z, one.Z));
  ok('B5 Eingang bleibt unveraendert (reine Funktionen)', near(f.Z, V.fitView(route, W, H, PAD).Z) && near(f.cx, V.fitView(route, W, H, PAD).cx));
}

/* ---------- C) Verschieben + Abbildung gelegt → aktuell ---------- */
{
  const f = V.fitView(route, W, H, PAD), lim = V.limits(f.Z);
  const a = scr(route[0][0], route[0][1], f), p = V.panBy(f, -140, 95), b = scr(route[0][0], route[0][1], p);
  ok('C1 Verschieben um (−140, +95) px bewegt jeden Ort um genau diese Strecke', near(b[0] - a[0], -140, 1e-6) && near(b[1] - a[1], 95, 1e-6) && near(p.Z, f.Z));
  /* delta: die Kachelebene liegt fuer L und wird nur transformiert — stimmt jede Stelle? */
  let worst = 0;
  [[-60, 40, 0.8], [200, -310, -1.6], [15, 15, 2.2], [0, 0, 0]].forEach(([dx, dy, dZ]) => {
    const C = V.zoomAt(V.panBy(f, dx, dy), 211, 377, dZ, lim), d = V.delta(f, C);
    route.forEach(q => { const l = scr(q[0], q[1], f), cc = scr(q[0], q[1], C); worst = Math.max(worst, Math.abs(d.s * l[0] + d.tx - cc[0]), Math.abs(d.s * l[1] + d.ty - cc[1])); });
  });
  ok('C2 Abbildung „gelegt → aktuell" (eine Verschiebung + Streckung) trifft jeden Streckenpunkt (± 0,001 px)', worst < 1e-3, 'groesste Abweichung ' + worst.toExponential(1) + ' px');
  const d0 = V.delta(f, f);
  ok('C3 ohne Bewegung ist die Abbildung die Identitaet', near(d0.s, 1) && near(d0.tx, 0, 1e-6) && near(d0.ty, 0, 1e-6));
  const n = V.norm({ cx: 1.4, cy: -0.2, Z: 99, w: W, h: H }, lim);
  ok('C4 Ansicht bleibt in der Welt und in den Zoomgrenzen', n.cx === 1 && n.cy === 0 && n.Z === lim.max && V.norm({ cx: .5, cy: .3, Z: -4, w: W, h: H }, lim).Z === lim.min);
}

/* ---------- D) Kacheln der Ansicht ---------- */
{
  const f = V.fitView(route, W, H, PAD);
  const v = R.viewAt(f.cx, f.cy, f.Z, W, H, 512), t = R.tiles(v);
  const cover = Math.min(...t.map(x => x.left)) <= 0 && Math.min(...t.map(x => x.top)) <= 0 && Math.max(...t.map(x => x.left + x.width)) >= W && Math.max(...t.map(x => x.top + x.height)) >= H;
  ok('D1 viewAt: Kacheln decken den ganzen Bildschirm (390 × 844), hoechstens 9', cover && t.length >= 1 && t.length <= 9, 'Kacheln: ' + t.length + ', Stufe ' + v.z);
  ok('D2 dieselbe Kachelstufe wie das Standbild bei gleicher Zoomstufe (level ist EINE Stelle)', v.z === R.fit(route, W, H, PAD, 512).z && /var lv = level\(Z, T\);/.test(rmSrc) && (rmSrc.match(/var lv = level\(Z, T\)/g) || []).length === 2 && (rmSrc.match(/Math\.floor\(Zt \+ Z_BIAS\)/g) || []).length === 1);
  const p0 = R.project(route[0][0], route[0][1], v), s0 = scr(route[0][0], route[0][1], f);
  ok('D3 Streckenpfad der Ansicht nutzt dieselbe Projektion wie die Kacheln', near(p0[0], s0[0], 1e-6) && near(p0[1], s0[1], 1e-6));
  /* Anfragen-Abschaetzung: wie viele Kacheln braucht ein Bildschirm je Zoomstufe? */
  let max = 0, sum = 0, cnt = 0;
  for (let Z = f.Z - 3; Z <= 18; Z += 0.25) { const n = R.tiles(R.viewAt(f.cx, f.cy, Z, W, H, 512)).length; max = Math.max(max, n); sum += n; cnt++; }
  ok('D4 je Bildschirm im Mittel ≤ 6, nie mehr als 9 Kacheln (Handy 390 × 844, alle Zoomstufen)', max <= 9 && sum / cnt <= 6, 'Mittel ' + (sum / cnt).toFixed(1) + ', Maximum ' + max);
  ok('D5 viewAt mit unbrauchbaren Werten ⇒ null', R.viewAt(NaN, 0.3, 14, W, H) === null && R.viewAt(0.5, 0.3, 14, 0, H) === null);
}

/* ---------- E) Lange Strecken ---------- */
{
  const big = []; for (let i = 0; i < 9001; i++) big.push([51 + i * 1e-5, 7 + i * 1e-5]);
  const t = V.thin(big);
  ok('E1 mehr als 4000 Punkte werden ausgeduennt; Start und Ziel bleiben', t.length <= 4001 && t.length >= 2000 && t[0] === big[0] && t[t.length - 1] === big[big.length - 1], t.length + ' von ' + big.length);
  ok('E2 kurze Strecken bleiben unangetastet', V.thin(route) === route);
}

/* ---------- F) Modul: kein Anbieter, Anfragen sparsam, Rueckfall ---------- */
{
  ok('F1 ohne Dokument oeffnet nichts und nichts bricht (open ⇒ false)', V.open(route, {}) === false && V.isOpen() === false && V.close() === false);
  ok('F2 das Modul kennt keinen Anbieter und keine Adresse (alles ueber routeMap.cfg / tileUrl)', !/maptiler/i.test(src) && !/https?:\/\//.test(src) && !/ORVIA_MAP_CONFIG/.test(src) && /R\.tileUrl\(t, c\)/.test(src) && /var L = opts\.labels \|\| \{\}, c = R\.cfg\(\);/.test(src));
  ok('F3 keine Kartenbibliothek (kein MapLibre/Leaflet/WebGL)', !/maplibregl|L\.map\(|mapboxgl|getContext\(/.test(src) && !/maplibre|leaflet|mapbox-gl/i.test(idx));
  ok('F4 Kacheln gehen nur mit der Herkunft der Seite hinaus (referrerpolicy strict-origin)', /im\.setAttribute\('referrerpolicy', 'strict-origin'\);/.test(src) && /class="rmx-logo" alt="" referrerpolicy="strict-origin"/.test(src));
  ok('F5 waehrend zwei Finger zoomen wird NICHT nachgeladen — nur beim Schieben mit einem Finger, und nur wenn wirklich eine Kachel fehlt', /if \(c1\.n === 1\) \{\s*st\.trail\.push\(\{ t: now, x: c1\.x, y: c1\.y \}\); if \(st\.trail\.length > 6\) st\.trail\.shift\(\);[\s\S]{0,220}if \(now - st\.lastCheck > PAN_CHECK_MS\) \{ st\.lastCheck = now; if \(need\(\)\) layout\(\); \}/.test(src) && /var PAN_CHECK_MS = 160;/.test(src));
  ok('F5a Ruckler-Ursache beseitigt: der Streckenpfad wird EINMAL geschrieben (beim Oeffnen) und danach nur transformiert — nie beim Legen der Kacheln', (src.match(/S\.cas\.setAttribute\('d', d\)/g) || []).length === 1 && (src.match(/R\.pathD\(/g) || []).length === 1 && /var r = delta\(S\.R0, S\.C\);\s*S\.g\.setAttribute\('transform', 'translate\(' \+ \(r\.tx \+ EDGE\)\.toFixed\(2\)/.test(src) && !/pathD/.test(src.slice(src.indexOf('function layout()'), src.indexOf('function prune()'))));
  ok('F5a2 reines Verschieben zeichnet die Strecke nicht je Bild neu: die Ebene (140 px groesser als der Bildschirm) wird nur bewegt, neu gezeichnet erst nach 60 % des Rands oder bei geaenderter Zoomstufe', /var EDGE = 140;/.test(src) && /if \(S\.B && Math\.abs\(S\.C\.Z - S\.B\.Z\) < 1e-9\) \{\s*var m = delta\(S\.B, S\.C\);\s*if \(Math\.abs\(m\.tx\) <= EDGE \* 0\.6 && Math\.abs\(m\.ty\) <= EDGE \* 0\.6\) \{ S\.svg\.style\.transform = 'translate3d\('/.test(src) && /\.rmv-route\{position:absolute;left:-140px;top:-140px;width:calc\(100% \+ 280px\);height:calc\(100% \+ 280px\);[^}]*will-change:transform\}/.test(css));
  ok('F5b in Ruhe wird nur neu gelegt, wenn sich die Zoomstufe geaendert hat oder Kacheln fehlen', /function rest\(\) \{ if \(!S\) return; if \(Math\.abs\(S\.C\.Z - S\.L\.Z\) > 1e-9 \|\| need\(\)\) layout\(\); \}/.test(src) && /if \(!rec \|\| !rec\.cur\) return true;/.test(src));
  ok('F5c gezeichnet wird die geglaettete, ausgeduennte Anzeige-Strecke; der Ausschnitt kommt aus den Rohpunkten', /var pts = thin\(R\.display \? R\.display\(raw\) : raw\);/.test(src) && /var fit = fitView\(raw, w, h, pad\);/.test(src) && /\{ round: R\.ROUND_M, digits: 2 \}/.test(src));
  ok('F5d Unterlage beim Oeffnen: Kacheln des Kartenfelds (aus dem Zwischenspeicher), hoechstens 6; in der Pause keine', /function seed\(sd, c\) \{/.test(src) && /for \(var i = 0; i < t\.length && i < 6; i\+\+\)/.test(src) && /if \(!c\.enabled \|\| R\.paused\(\)\) noTiles\(false\);\s*else if \(sd\) seed\(sd, c\);/.test(src) && /startRaster\(S, opts\.seed\);/.test(src) && /seed:\{w:el\.clientWidth,h:el\.clientHeight,pad:GM_ACT_MAP_PAD\}/.test(ui) && /pad:GM_ACT_MAP_PAD\}\);/.test(ui));
  ok('F5e Schwung: ab 0,25 px/ms gleitet die Karte aus (hoechstens 3 px/ms), nicht bei „Bewegung reduzieren“', /var FLING_MIN = 0\.25;/.test(src) && /var FLING_TAU = 300;/.test(src) && /if \(!reduce && Math\.sqrt\(vx \* vx \+ vy \* vy\) >= FLING_MIN\) \{ var cap = 3 \/ Math\.max\(3, Math\.sqrt\(vx \* vx \+ vy \* vy\)\); fling\(vx \* cap, vy \* cap\); \}/.test(src));
  ok('F6 geladene Kachelbilder bleiben fuer die Sitzung (erneutes Oeffnen ohne Anfrage), hoechstens 32 (Speicher auf dem Handy), zuletzt Benutztes am laengsten', /if \(k && k\.complete && k\.naturalWidth > 0\) \{ _reused\+\+; touch\(url\); return k; \}/.test(src) && /var KEEP_MAX = 32;/.test(src) && /im\.onload = function \(\) \{ try \{ im\.classList\.add\('ok'\); \} catch \(e\) \{\} remember\(url, im\);/.test(src));
  ok('F7 Kachelfehler ⇒ gemeinsame 5-Minuten-Pause (route-map.js), Ansicht zeigt die Strecke ohne Hintergrund weiter', /try \{ RM\(\)\._err\(null\); \} catch \(e\) \{\}\s*if \(S === st\) noTiles\(true\);/.test(src) && /var want = \(S\.failed \|\| !c\.enabled \|\| R\.paused\(\)\) \? \[\] : R\.tiles\(v\);/.test(src) && /S\.el\.classList\.add\('rmv-notiles'\);/.test(src) && /paused: function \(\) \{ return _downUntil > _now\(\); \}/.test(rmSrc));
  ok('F8 Strichstaerke der Strecke bleibt beim Zoomen gleich (non-scaling-stroke), Start/Ziel werden mit jedem Zeichnen neu gesetzt', (src.match(/vector-effect="non-scaling-stroke"/g) || []).length === 2 && /S\.start\.setAttribute\('cx', \(a\[0\] \+ EDGE\)\.toFixed\(1\)\);/.test(src));
  ok('F9 Bedienung: Escape schliesst nur die Ansicht (Aktivitaetsseite bleibt), Fokus kehrt zurueck, Seite dahinter scrollt nicht', /if \(k === 'Escape'\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); close\(\); return; \}/.test(src) && /doc\.addEventListener\('keydown', st\.onKey, true\);/.test(src) && /if \(st\.prevFocus && st\.prevFocus\.focus\) st\.prevFocus\.focus\(\);/.test(src) && /doc\.documentElement\.style\.overflow = 'hidden';/.test(src) && /root\.document\.documentElement\.style\.overflow = st\.prevOverflow \|\| '';/.test(src));
  ok('F10 „Bewegung reduzieren": Zoomschritte springen statt zu gleiten', /if \(reduce\) \{ S\.C = norm\(at\(1\), S\.lim\); apply\(\); rest\(\); return; \}/.test(src));
  ok('F11 Texte kommen vom Aufrufer (kein fester deutscher Satz im Modul), Titel wird entschaerft', /esc\(opts\.title \|\| ''\)/.test(src) && /esc\(L\.unavailable \|\| ''\)/.test(src) && !/nicht verf/.test(src));
}

/* ---------- G) Verdrahtung ---------- */
{
  ok('G1 geladen NACH route-map.js und im Precache', idx.indexOf('js/map-config.js') < idx.indexOf('js/route-map.js') && idx.indexOf('js/route-map.js"') < idx.indexOf('js/route-map-view.js') && /'\.\/js\/route-map\.js','\.\/js\/route-map-view\.js',/.test(sw) && (idx.match(/js\/route-map-view\.js/g) || []).length === 1);
  ok('G2 Aktivitaetsseite: Tippen (oder Enter/Leertaste) auf das Kartenfeld oeffnet die Ansicht — nur solange dort wirklich die Karte steht', /function gmActBindRouteMapOpen\(el,route,vm\)\{/.test(ui) && /if\(!el\.classList\.contains\('can-open'\)\)return;/.test(ui) && /el\.addEventListener\('click',go\);/.test(ui) && /el\.onkeydown=function\(ev\)\{if\(ev\.key==='Enter'\|\|ev\.key===' '\)\{ev\.preventDefault\(\);go\(\);\}\};/.test(ui) && (ui.match(/gmActBindRouteMapOpen\(el,route,vm\);/g) || []).length === 1 && /V\.open\(route,\{activity:gmActThemeId\(vm&&vm\.sportId\),title:/.test(ui));
  ok('G3 Feld ist als Schaltflaeche ausgezeichnet (role, tabindex, Name) und traegt ein Oeffnen-Zeichen', /el\.setAttribute\('role','button'\);el\.setAttribute\('tabindex','0'\);el\.setAttribute\('aria-label',_uiT\('ui\.karte_oeffnen'\)\);/.test(ui) && /<span class="rmx-open" aria-hidden="true">/.test(ui));
  ok('G4 faellt die Karte im Feld aus, ist es wieder ein Bild: alte Zeichnung, nicht mehr antippbar', /el\.innerHTML=keep;el\.classList\.remove\('has-rmx'\);el\.classList\.remove\('can-open'\);el\.removeAttribute\('role'\);el\.removeAttribute\('tabindex'\);el\.removeAttribute\('aria-label'\);/.test(ui));
  ok('G5 laeuft schon die Pause nach einem Kachelfehler, kommt sofort die alte Zeichnung (kein leeres Kartenfeld)', /if\(ok&&el\.querySelector\('\.rmx\.tiles-failed'\)\)ok=false;/.test(ui));
  const keys = ['ui.karte', 'ui.karte_oeffnen', 'ui.karte_schliessen', 'ui.karte_groesser', 'ui.karte_kleiner', 'ui.karte_ganze_strecke', 'ui.karte_nicht_verfuegbar'];
  ok('G6 alle Texte stehen im Katalog und werden uebergeben', keys.every(k => de.indexOf("'" + k + "': '") > 0 && ui.indexOf("_uiT('" + k + "')") > 0), keys.filter(k => !(de.indexOf("'" + k + "': '") > 0 && ui.indexOf("_uiT('" + k + "')") > 0)).join(', '));
  ok('G7 Schalter in map-config.js: detail an', REAL.detail === true);
}

/* ---------- H) Gestaltung ---------- */
{
  ok('H1 Vollbild ueber der Aktivitaetsseite (z 190 > 140), unter der Story (200)', /\.rmv\{position:fixed;inset:0;z-index:190;/.test(css) && /\.gm-page\{z-index:140\}/.test(css) && /\.gm-story\{position:fixed;inset:0;z-index:200;/.test(css));
  ok('H2 Flaeche gehoert der Karte: der Browser scrollt/zoomt dort nicht selbst', /\.rmv-stage\{position:absolute;inset:0;overflow:hidden;touch-action:none;/.test(css) && /stage\.addEventListener\('touchmove', function \(e\) \{ if \(e\.cancelable\) e\.preventDefault\(\); \}, \{ passive: false \}\);/.test(src));
  ok('H3 nur die Kachelebene wird bewegt (eine Transformation, Ursprung oben links)', /\.rmv-layer\{position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:0 0;will-change:transform\}/.test(css) && /S\.layer\.style\.transform = 'translate3d\(' \+ d\.tx\.toFixed\(2\)/.test(src));
  ok('H4 Schleier steht still ueber den Kacheln (bewegt sich nicht mit), fast keiner: 0,04 (die Karte ist hier der Inhalt)', /\.rmv-dim\{position:absolute;inset:0;pointer-events:none;[^}]*rgba\(5,8,13,var\(--rmx-dim,\.04\)\)\}/.test(css));
  ok('H4b ueber der bewegten Karte liegt keine Unschaerfe-Flaeche und auf den Kacheln kein Filter (beides muesste je Bild neu gerechnet werden)', (() => { const a = css.indexOf('v8-435 · Kartenansicht zum Umsehen'), b = css.indexOf('/* Story-Cover: Karte ist Seitenhintergrund'); const blk = css.slice(css.indexOf('*/', a), b).replace(/\/\*[\s\S]*?\*\//g, ''); return a > 0 && b > a && !/backdrop-filter|filter:/.test(blk); })() && !/\.route-map \.rmx-open\{[^}]*backdrop-filter/.test(css));
  ok('H4a Kopf der Ansicht bleibt lesbar: fast deckendes Band ab dem sicheren Rand (px, nicht Prozent)', /\.rmv-dim\{[^}]*linear-gradient\(180deg,rgba\(5,8,13,\.90\) 0,rgba\(5,8,13,\.80\) calc\(var\(--sat,0px\) \+ 60px\),rgba\(5,8,13,0\) calc\(var\(--sat,0px\) \+ 132px\)/.test(css));
  ok('H5 Knoepfe 44 × 44 px (Fingerziel), sichtbarer Fokus, sichere Raender', /\.rmv-btn\{flex:none;width:44px;height:44px;/.test(css) && /\.rmv-btn:focus-visible\{outline:2px solid/.test(css) && /\.rmv-top\{[^}]*padding:calc\(var\(--sat,0px\) \+ 14px\)/.test(css) && /\.rmv-ctl\{[^}]*bottom:calc\(env\(safe-area-inset-bottom,0px\) \+ 40px\)/.test(css));
  ok('H6 Quellenhinweis bleibt sichtbar; ohne Karte erscheint stattdessen der Hinweis', /\.rmv \.rmx-attr\{right:10px;bottom:calc\(env\(safe-area-inset-bottom,0px\) \+ 10px\)\}/.test(css) && /\.rmv\.rmv-notiles \.rmv-note:not\(:empty\)\{display:block\}/.test(css) && /\.rmv\.rmv-notiles \.rmx-attr\{display:none\}/.test(css));
  ok('H7 Kartenfeld zeigt, dass es sich oeffnen laesst', /\.route-map\.can-open\{cursor:pointer;/.test(css) && /\.route-map \.rmx-open\{position:absolute;top:10px;right:10px;z-index:3;width:32px;height:32px;/.test(css) && /\.route-map\.can-open:focus-visible\{outline:/.test(css));
}
/* ---------- K) Karte V2 (v8-441): ORVIA-Gold als leise dritte Ebene der Bedienung ---------- */
{
  const glSrc = rd('js/route-map-gl.js');
  ok('K1 Gold-Tokens der Karte an EINER Stelle; die Grundtoene verweisen auf das Marken-Gold (keine zweite Definition)', /--map-gold:var\(--orvia-brand-gold\);--map-gold-soft:var\(--orvia-brand-gold-soft\);/.test(css) && /--map-gold-muted:rgba\(216,187,122,0\.16\);--map-gold-subtle:rgba\(216,187,122,0\.07\);/.test(css) && /--map-gold-line:rgba\(216,187,122,0\.28\);--map-gold-edge:rgba\(216,187,122,0\.045\);/.test(css) && (css.match(/--map-gold:/g) || []).length === 1);
  ok('K2 Knoepfe sind NICHT dauerhaft gold: Grundzustand neutral; Gold nur gedrueckt (Rand 28 %, Zeichen Gold) und als Fokusrahmen', /\.rmv-btn\{[^}]*border:1px solid rgba\(255,255,255,\.16\);color:#f3f1ea;/.test(css) && /\.rmv-btn:active\{transform:scale\(\.94\);background:rgba\(28,36,48,\.9\);border-color:var\(--map-gold-line\);color:var\(--map-gold\)\}/.test(css) && /\.rmv-btn:focus-visible\{outline:2px solid var\(--map-gold-soft\);outline-offset:2px\}/.test(css));
  ok('K3 gewaehlter Zustand: „ganze Strecke" traegt Gold, solange der Ausschnitt genau die ganze Strecke zeigt', /\.rmv-btn\.rmv-fit\.on\{border-color:var\(--map-gold-line\);color:var\(--map-gold\)\}/.test(css) && /class="rmv-btn rmv-fit on"/.test(src) && /fitBtn: el\.querySelector\('\.rmv-fit'\), fitOn: true,/.test(src));
  ok('K4 der Zustand folgt der Ansicht: gezeichnete Karte fragt route-map-gl (bei jeder Bewegung und wenn die Karte steht), Bildkacheln vergleichen mit der Ansicht „ganze Strecke"; die Klasse wechselt nur bei Aenderung', /function syncFit\(\) \{/.test(src) && /if \(S\.gl\) on = !!S\.gl\.atFit\(\);/.test(src) && /on = Math\.abs\(S\.C\.Z - S\.fit\.Z\) < 0\.02 && Math\.abs\(S\.C\.cx - S\.fit\.cx\) \* wd < 2 && Math\.abs\(S\.C\.cy - S\.fit\.cy\) \* wd < 2;/.test(src) && /if \(on === S\.fitOn\) return;/.test(src) && /onMove: function \(\) \{ if \(S === st\) syncFit\(\); \},/.test(src) && /el\.classList\.add\('rmv-glready'\); syncFit\(\);/.test(src) && /if \(!S\.gl\) syncFit\(\);/.test(src));
  ok('K5 route-map-gl: atFit() — Mittelpunkt auf 2 px und Zoomstufe auf 0,02 genau', /atFit: function \(\) \{/.test(glSrc) && /Math\.abs\(st\.map\.getZoom\(\) - c\.zoom\) < 0\.02 && Math\.abs\(p\.x - el\.clientWidth \/ 2\) < 2 && Math\.abs\(p\.y - el\.clientHeight \/ 2\) < 2;/.test(glSrc));
  ok('K6 Kartenfeld der Seite: Oeffnen-Zeichen neutral, Gold nur gedrueckt / im Tastaturfokus', /\.route-map\.can-open:focus-visible\{outline:2px solid var\(--map-gold-soft\);outline-offset:2px\}/.test(css) && /\.route-map\.can-open:active \.rmx-open,\.route-map\.can-open:focus-visible \.rmx-open\{border-color:var\(--map-gold-line\);color:var\(--map-gold\)\}/.test(css) && /\.route-map \.rmx-open\{[^}]*border:1px solid rgba\(255,255,255,\.16\);color:#f3f1ea;/.test(css));
  /* Gold NIE an Strecke, Start, Ziel: die Regeln der Strecke kennen nur Sportfarbe, Schwarz und die Zustandsfarben */
  const routeRules = (css.match(/\.rmx-(?:case|line|start|end|route)\{[^}]*\}/g) || []).join(' ');
  ok('K7 Gold nie an Strecke, Start oder Ziel (Regeln .rmx-case/-start/-end/-route ohne Gold)', routeRules.length > 0 && !/gold|216,187,122|D8BB7A|B99A5D/i.test(routeRules) && /\.rmx-start\{fill:var\(--orvia-bg-base\);stroke:var\(--orvia-route-start\);stroke-width:3\}/.test(css) && /\.rmx-end\{fill:var\(--orvia-route-finish\);stroke:var\(--orvia-bg-base\);stroke-width:2\}/.test(css));
  ok('K8 Start/Ziel in Standbild und Kartenansicht gleich gross (Ring r 6,5 · Punkt r 4,5)', /<circle class="rmx-start" cx="' \+ cx\(a\) \+ '" cy="' \+ cy\(a\) \+ '" r="6\.5"\/>/.test(rmSrc) && /<circle class="rmx-end" cx="' \+ cx\(b\) \+ '" cy="' \+ cy\(b\) \+ '" r="4\.5"\/>/.test(rmSrc) && /<circle class="rmx-start" r="6\.5"\/><circle class="rmx-end" r="4\.5"\/>/.test(src));
}
console.log('\n' + (fail ? '❌' : '✅') + ' route_map_view: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
