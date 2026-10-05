/* ============================================================
   ORVIA · route_map — echte Karte hinter der GPS-Strecke (v8-432)
   Gians Auftrag 5.10.: Strecke nicht mehr als Linie im Nichts; darunter eine echte,
   stark zurueckgenommene Karte. Ohne Schluessel KEINE Anfrage an einen Anbieter.
   Hier: reine Rechnung (Mercator, Ausschnitt, Kacheln, Kuerzen) + Markup + Verdrahtung.
   Der echte Browserlauf steht in route_map_e2e_test.mjs.
   node supabase/tests/route_map_test.mjs
   ============================================================ */
import fs from 'fs';
import vm from 'node:vm';
import { existsSync } from 'node:fs';
const _APPREL = existsSync(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i != null ? '  — ' + i : '')); c ? pass++ : fail++; };
const src = rd('js/route-map.js'), ui = rd('js/ui.js'), css = rd('styles.css'), idx = rd('index.html'), sw = rd('sw.js'), cfgSrc = rd('js/map-config.js'), de = rd('locales/de.js');
/* v8-434: Die Adressvorlagen stehen nur in map-config.js — die Tests rechnen deshalb mit der ECHTEN
   Einstellung und ersetzen allein den Schluessel (der echte kommt in keinem Test als Text vor). */
const REAL = (() => { const c = { window: {} }; vm.createContext(c); vm.runInContext(cfgSrc, c); return c.window.ORVIA_MAP_CONFIG; })();
const mk = conf => { const c = { ORVIA: {}, ORVIA_MAP_CONFIG: Object.assign({}, REAL, { key: '' }, conf), Math, isFinite, encodeURIComponent, String, Array, Infinity, Object }; c.window = c; c.globalThis = c; vm.createContext(c); vm.runInContext(src, c); return c.ORVIA.routeMap; };
const OFF = mk({ provider: 'maptiler', key: '', style: 'dataviz-dark' });
const ON = mk({ provider: 'maptiler', key: 'abc123', style: 'dataviz-dark' });

/* Strecke „Bochum": Rundkurs ~2,9 km */
const way = [[51.4800, 7.2160], [51.4800, 7.2200], [51.4820, 7.2200], [51.4820, 7.2240], [51.4850, 7.2240], [51.4850, 7.2180], [51.4830, 7.2180], [51.4830, 7.2140], [51.4780, 7.2140], [51.4780, 7.2160], [51.4797, 7.2160]];
const route = []; for (let i = 0; i < way.length - 1; i++) for (let k = 0; k < 12; k++) route.push([way[i][0] + (way[i + 1][0] - way[i][0]) * k / 12, way[i][1] + (way[i + 1][1] - way[i][1]) * k / 12]); route.push(way[way.length - 1]);

/* ---------- A) Web-Mercator ---------- */
{
  const R = OFF;
  ok('A1 Nullpunkt liegt in der Mitte der Welt', Math.abs(R.lonX(0) - 0.5) < 1e-12 && Math.abs(R.latY(0) - 0.5) < 1e-12);
  /* unabhaengige Gegenrechnung mit der klassischen Schreibweise ln(tan(π/4 + φ/2)) */
  const ref = lat => (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2;
  ok('A2 Breite stimmt mit der klassischen Mercator-Formel ueberein (Bochum, Flensburg, Sydney)', [51.4818, 54.7937, -33.8688].every(la => Math.abs(R.latY(la) - ref(la)) < 1e-12));
  const n = 2 ** 15;
  ok('A3 Bochum (51,4818 N · 7,2162 O) liegt auf Stufe 15 in Kachel 17040/10899', Math.floor(R.lonX(7.2162) * n) === 17040 && Math.floor(R.latY(51.4818) * n) === 10899, Math.floor(R.lonX(7.2162) * n) + '/' + Math.floor(R.latY(51.4818) * n));
  ok('A4 Hin- und Rueckweg heben sich auf', Math.abs(R.xLon(R.lonX(7.2162)) - 7.2162) < 1e-9 && Math.abs(R.yLat(R.latY(51.4818)) - 51.4818) < 1e-9);
  ok('A5 Pole werden begrenzt (kein Infinity)', isFinite(R.latY(90)) && isFinite(R.latY(-90)));
}

/* ---------- B) Ausschnitt: die ganze Strecke im Innenrand ---------- */
{
  const R = OFF, pad = { t: 140, r: 44, b: 95, l: 44 }, w = 390, h = 557;
  const v = R.fit(route, w, h, pad);
  const P = route.map(p => R.project(p[0], p[1], v));
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
  const inBox = Math.min(...xs) >= pad.l - 0.01 && Math.max(...xs) <= w - pad.r + 0.01 && Math.min(...ys) >= pad.t - 0.01 && Math.max(...ys) <= h - pad.b + 0.01;
  ok('B1 jeder Streckenpunkt liegt im Innenrand (nichts angeschnitten)', inBox, [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)].map(x => x.toFixed(1)).join(' / '));
  const fillsX = Math.abs((Math.max(...xs) - Math.min(...xs)) - (w - pad.l - pad.r)) < 0.01, fillsY = Math.abs((Math.max(...ys) - Math.min(...ys)) - (h - pad.t - pad.b)) < 0.01;
  ok('B2 die engere Richtung fuellt den Innenrand genau aus', fillsX || fillsY);
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2, midY = (Math.min(...ys) + Math.max(...ys)) / 2;
  ok('B3 Strecke sitzt mittig im Innenrand', Math.abs(midX - (pad.l + (w - pad.l - pad.r) / 2)) < 0.01 && Math.abs(midY - (pad.t + (h - pad.t - pad.b) / 2)) < 0.01);
  ok('B4 512er-Kacheln: Stufe eher niedriger, Bild leicht gestreckt (0,78 … 1,57) — spart Anfragen', v.tile === 512 && v.z === Math.floor(v.Z - 1 + 0.35) && v.scale > 0.78 && v.scale <= 1.5701 && Math.abs(256 * 2 ** v.Z - 512 * 2 ** v.z * v.scale) < 1e-6, 'Z ' + v.Z.toFixed(2) + ' → z ' + v.z + ' × ' + v.scale.toFixed(2));
  { const v6 = R.fit(route, w, h, pad, 256); ok('B4a 256er-Kacheln bleiben waehlbar (gleicher Ausschnitt, eine Stufe hoeher)', v6.tile === 256 && v6.z === v.z + 1 && Math.abs(v6.world - v.world) < 1e-6 && Math.abs(v6.ox - v.ox) < 1e-6); }
  const tiny = [[51.48, 7.216], [51.48001, 7.21601], [51.48002, 7.21602]];
  ok('B5 winzige Strecke (Bahn, Start/Stopp): Zoom gedeckelt bei 16,6 — nie bis auf Hausnummern', Math.abs(R.fit(tiny, w, h, pad).Z - 16.6) < 1e-9);
  ok('B6 Strecke ohne Ausdehnung / zu wenig Punkte / keine Groesse ⇒ kein Absturz', Math.abs(R.fit([[51.48, 7.2], [51.48, 7.2]], w, h, pad).Z - 16.6) < 1e-9 && R.fit([[51.48, 7.2]], w, h, pad) === null && R.fit(route, 0, 0, pad) === null && R.fit(null, w, h) === null);
  const far = [[47.3, 8.5], [54.8, 9.4]];
  const vf = R.fit(far, w, h, pad); const pf = far.map(p => R.project(p[0], p[1], vf));
  ok('B7 lange Strecke (Zuerich → Flensburg) passt ebenfalls vollstaendig', pf.every(p => p[0] >= pad.l - 0.01 && p[0] <= w - pad.r + 0.01 && p[1] >= pad.t - 0.01 && p[1] <= h - pad.b + 0.01) && vf.z >= 3 && vf.z <= 8, 'z ' + vf.z);
  ok('B8 ungueltige Punkte werden uebergangen', (() => { const v2 = R.fit([[51.48, 7.21], [null, 7], ['x', 'y'], [999, 7], [51.49, 7.22]], w, h, pad); return !!v2 && isFinite(v2.Z); })());
}

/* ---------- C) Kacheln: lueckenlos, ganzzahlige gemeinsame Kanten ---------- */
{
  const R = OFF;
  const cases = [[390, 557, { t: 140, r: 44, b: 95, l: 44 }], [440, 660, { t: 150, r: 44, b: 112, l: 44 }], [390, 255, { t: 26, r: 26, b: 30, l: 26 }], [320, 380, { t: 96, r: 44, b: 64, l: 44 }]];
  let allOk = true, maxN = 0, info = '';
  for (const [w, h, pad] of cases) {
    const v = R.fit(route, w, h, pad), T = R.tiles(v); maxN = Math.max(maxN, T.length);
    const xs = [...new Set(T.map(t => t.left))].sort((a, b) => a - b), ys = [...new Set(T.map(t => t.top))].sort((a, b) => a - b);
    const cover = Math.min(...xs) <= 0 && Math.min(...ys) <= 0 && Math.max(...T.map(t => t.left + t.width)) >= w && Math.max(...T.map(t => t.top + t.height)) >= h;
    const seamX = xs.slice(1).every((x, i) => T.find(t => t.left === xs[i]).width === x - xs[i]), seamY = ys.slice(1).every((y, i) => T.find(t => t.top === ys[i]).height === y - ys[i]);
    const ints = T.every(t => Number.isInteger(t.left) && Number.isInteger(t.top) && Number.isInteger(t.width) && Number.isInteger(t.height));
    const grid = T.length === xs.length * ys.length;
    if (!(cover && seamX && seamY && ints && grid)) { allOk = false; info = w + 'x' + h; }
  }
  ok('C1 Kacheln decken den Ausschnitt vollstaendig, Nachbarn teilen ganzzahlige Kanten (keine Fugen)', allOk, info || 'max. ' + maxN + ' Kacheln');
  ok('C2 Beispielstrecke: Story-Karte kommt mit hoechstens 4 Kacheln aus', R.tiles(R.fit(route, 390, 557, { t: 140, r: 44, b: 95, l: 44 })).length <= 4, String(R.tiles(R.fit(route, 390, 557, { t: 140, r: 44, b: 95, l: 44 })).length));
  {
    /* Anfragen sind die Abrechnungseinheit: ueber viele zufaellige Strecken (0,5–60 km, ganz DACH) messen */
    let seed = 5; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const sim = ts => { let sum = 0, max = 0, n = 4000; for (let i = 0; i < n; i++) { const lat = 47 + rnd() * 8, lon = 6 + rnd() * 9, km = 0.5 + Math.pow(rnd(), 2) * 60; const dLat = km / 111 * (0.2 + rnd()), dLon = km / 70 * (0.2 + rnd()); const r = [[lat, lon], [lat + dLat, lon + dLon * rnd()], [lat + dLat * rnd(), lon + dLon]]; const c = R.tiles(R.fit(r, 390, 557, { t: 140, r: 44, b: 95, l: 44 }, ts)).length; sum += c; if (c > max) max = c; } return { mean: sum / n, max }; };
    const a = sim(512), b = sim(256);
    ok('C2a Handy-Story (390 × 557): im Mittel < 4 Kacheln, nie mehr als 6', a.mean < 4 && a.max <= 6, 'Mittel ' + a.mean.toFixed(2) + ' · max ' + a.max);
    ok('C2b 512er-Kacheln halbieren die Anfragen gegenueber 256ern mindestens', b.mean / a.mean >= 2, '256er: Mittel ' + b.mean.toFixed(2) + ' · max ' + b.max);
  }
  /* Kachelecke: geografische Ecke der Kachel muss auf ihrer linken oberen Bildecke liegen (± Rundung) */
  const v = R.fit(route, 390, 557, { t: 140, r: 44, b: 95, l: 44 }), n = 2 ** v.z;
  const cornerOk = R.tiles(v).every(t => { const p = R.project(R.yLat(t.y / n), R.xLon(t.x / n), v); return Math.abs(p[0] - t.left) <= 0.51 && Math.abs(p[1] - t.top) <= 0.51; });
  ok('C3 Strecke und Kacheln teilen dieselbe Projektion (Kachelecke liegt auf ihrer Bildecke)', cornerOk);
  ok('C4 ohne Ausschnitt keine Kacheln', R.tiles(null).length === 0);
}

/* ---------- D) Anfang/Ende ausblenden (vorbereitet fuer geteilte Strecken) ---------- */
{
  const R = OFF, before = JSON.stringify(route);
  const total = route.slice(1).reduce((s, p, i) => s + R.haversineM(route[i], p), 0);
  ok('D0 Streckenlaenge plausibel (~2,9 km)', total > 2750 && total < 3050, Math.round(total) + ' m');
  const t = R.trim(route, { startM: 300, endM: 300 });
  const dStart = route.slice(1, route.findIndex(p => p[0] === t[0][0] && p[1] === t[0][1]) + 1).reduce((s, p, i) => s + R.haversineM(route[i], p), 0);
  ok('D1 die ersten 300 m fehlen (erster Punkt liegt ≥ 300 m hinter dem Start)', t.length < route.length && dStart >= 300 && dStart < 345, Math.round(dStart) + ' m');
  const tl = t.slice(1).reduce((s, p, i) => s + R.haversineM(t[i], p), 0);
  ok('D2 Rest ist um ~600 m kuerzer', tl < total - 560 && tl > total - 700, Math.round(tl) + ' m');
  ok('D3 Original bleibt unveraendert; ohne Angabe kommt die volle Strecke', JSON.stringify(route) === before && R.trim(route, {}).length === route.length);
  ok('D4 Kuerzen laenger als die Strecke ⇒ volle Strecke statt leerer (der Aufrufer entscheidet)', R.trim(route, { startM: 5000, endM: 5000 }).length === route.length);
}

/* ---------- E) Markup: ohne Schluessel KEINE Anbieter-Anfrage ---------- */
{
  const o = { w: 390, h: 557, pad: { t: 140, r: 44, b: 95, l: 44 }, cls: 'cover', draw: true, width: 4.5 };
  const off = OFF.html(route, o), on = ON.html(route, o);
  ok('E1 Schluessel leer ⇒ Karte aus: kein Bild, kein Anbieter, kein Quellenhinweis — nur die Strecke', OFF.enabled() === false && !/<img/.test(off) && !/maptiler|https?:\/\//.test(off) && /class="rmx cover"/.test(off) && /class="rmx-line gm-route-line"/.test(off));
  const nT = ON.tiles(ON.fit(route, 390, 557, o.pad)).length;
  ok('E2 mit Schluessel: genau ein Bild je Kachel', ON.enabled() === true && (on.match(/class="rmx-t"/g) || []).length === nT && /class="rmx has-tiles cover"/.test(on), String(nT));
  ok('E2a KEIN src im Markup — geladen wird erst durch hydrate() (sonst fragt jeder Seitenwechsel der Story neu an)', !/<img[^>]* src=/.test(on) && (on.match(/data-rmx-src="https:/g) || []).length === nT + 1);
  ok('E3 Kacheladresse 512er: Stil, OHNE Groessenangabe im Pfad (MapTiler kennt kein /512/), doppelte Aufloesung, Schluessel', /data-rmx-src="https:\/\/api\.maptiler\.com\/maps\/dataviz-dark\/14\/\d+\/\d+@2x\.png\?key=abc123"/.test(on) && !/\/512\//.test(on));
  ok('E3a tileSize 256 in der Einstellung ⇒ 256er-Adressen (eine Stufe hoeher, mit /256/)', /\/dataviz-dark\/256\/15\/\d+\/\d+@2x\.png\?key=abc"/.test(mk({ key: 'abc', tileSize: 256 }).html(route, o)));
  { const v5 = ON.fit(route, 390, 557, o.pad, 512), v2 = ON.fit(route, 390, 557, o.pad, 256), t5 = ON.tiles(v5), t2 = ON.tiles(v2);
    /* 512er z/x/y deckt dieselbe Flaeche wie die vier 256er (z+1, 2x…2x+1, 2y…2y+1): gleiche Lage auf dem Bildschirm */
    const q = t5[0], kids = t2.filter(k => k.z === q.z + 1 && (k.x >> 1) === q.x && (k.y >> 1) === q.y);
    ok('E3b 256er-Rueckfall deckt denselben Ausschnitt: vier 256er liegen exakt auf einer 512er (gleiche Kanten)', v2.z === v5.z + 1 && kids.length >= 1 && Math.min(...kids.map(k => k.left)) >= q.left && Math.max(...kids.map(k => k.left + k.width)) <= q.left + q.width && kids.some(k => k.left === q.left || k.left + k.width === q.left + q.width) && Math.abs(v2.world - v5.world) < 1e-6 && v2.ox === v5.ox, JSON.stringify([v5.z, v2.z, t5.length, t2.length])); }
  ok('E3c fehlt die Vorlage der gewuenschten Groesse, gilt die andere; fehlt jede, bleibt die Karte aus (kein Anbieter im Modul)', mk({ key: 'abc', tiles: { 256: REAL.tiles[256] } }).cfg().tileSize === 256 && mk({ key: 'abc', tileSize: 256, tiles: { 512: REAL.tiles[512] } }).cfg().tileSize === 512 && mk({ key: 'abc', tiles: {} }).enabled() === false && !/<img/.test(mk({ key: 'abc', tiles: {} }).html(route, o)) && mk({ key: 'abc', tiles: null }).enabled() === false);
  ok('E4 es geht nur die Herkunft der Seite mit (referrerpolicy strict-origin), nie die volle Adresse', (on.match(/referrerpolicy="strict-origin"/g) || []).length === nT + 1 && !/referrerpolicy="(unsafe-url|no-referrer-when-downgrade)"/.test(on));
  ok('E5 hydrate() haengt Erfolg/Fehlschlag an jede Kachel (Fehlschlag blendet die Kartenebene aus)', /ph\.onload = function \(\) \{ if \(!logo\) _ok\(ph\); _remember\(url, ph\); \};/.test(src) && /ph\.onerror = function \(\) \{ if \(logo\) ph\.style\.display = 'none'; else _err\(ph\); \};/.test(src));
  ok('E6 Quellenhinweis sichtbar: © MapTiler © OpenStreetMap contributors', /class="rmx-attr">.*© MapTiler © OpenStreetMap contributors/.test(on));
  const dCase = (/class="rmx-case[^"]*"[^>]* d="([^"]+)"/.exec(on) || [])[1], dLine = (/class="rmx-line[^"]*"[^>]* d="([^"]+)"/.exec(on) || [])[1];
  ok('E7 dunkler Rand und Strecke folgen demselben Pfad und zeichnen sich gemeinsam', !!dLine && dCase === dLine && /class="rmx-case gm-route-line" pathLength="1"/.test(on) && /class="rmx-line gm-route-line" pathLength="1"/.test(on));
  const v = ON.fit(route, 390, 557, o.pad), a = ON.project(route[0][0], route[0][1], v), b = ON.project(route[route.length - 1][0], route[route.length - 1][1], v);
  ok('E8 Start (Ring) und Ziel (Punkt) sitzen auf dem ersten/letzten Streckenpunkt', on.indexOf('class="rmx-start" cx="' + a[0].toFixed(1) + '" cy="' + a[1].toFixed(1) + '"') > 0 && on.indexOf('class="rmx-end" cx="' + b[0].toFixed(1) + '" cy="' + b[1].toFixed(1) + '"') > 0 && dLine.indexOf('M' + a[0].toFixed(1) + ',' + a[1].toFixed(1)) === 0);
  ok('E9 ohne draw keine Zeichen-Animation; tiles:false erzwingt „ohne Karte"', !/gm-route-line/.test(ON.html(route, { w: 390, h: 255 })) && !/<img/.test(ON.html(route, { w: 390, h: 255, tiles: false })));
  ok('E10 unbrauchbare Strecke / fehlende Groesse ⇒ leerer Text (Aufrufer faellt zurueck)', ON.html([[51, 7]], o) === '' && ON.html(route, { w: 0, h: 0 }) === '' && ON.html(null, o) === '');
  const own = mk({ url: 'https://karten.example/{z}/{x}/{y}{r}.png', attribution: '© OpenStreetMap contributors', logo: null });
  const ho = own.html(route, o);
  ok('E11 eigene Kachelquelle: Adressmuster wird befuellt, kein Schluessel noetig, kein Fremdlogo', own.enabled() === true && /data-rmx-src="https:\/\/karten\.example\/14\/\d+\/\d+@2x\.png"/.test(ho) && !/maptiler/.test(ho) && !/rmx-logo/.test(ho));
  ok('E12 enabled:false schaltet trotz Schluessel ab', mk({ key: 'abc', enabled: false }).enabled() === false);
  ok('E13 Sonderzeichen in Farbe/Klasse werden entschaerft', !/<script/.test(ON.html(route, { w: 390, h: 255, color: '"><script>', cls: '"><script>' })));
}

/* ---------- E') hydrate: laden + Wiederverwendung in der Sitzung ---------- */
{
  const R = mk({ key: 'abc' });
  const mkImg = (url, logo) => { const at = { 'data-rmx-src': url }; return { _at: at, style: { cssText: 'left:1px' }, classList: { _s: new Set(logo ? ['rmx-logo'] : ['rmx-t']), contains(c) { return this._s.has(c); }, add(c) { this._s.add(c); } }, getAttribute: k => at[k] ?? null, removeAttribute: k => { delete at[k]; }, complete: false, naturalWidth: 0, parentNode: null, closest: () => null, src: null }; };
  const mkRoot = imgs => { const root = { replaced: [], querySelectorAll: () => imgs.filter(i => i._at['data-rmx-src']) }; imgs.forEach(i => { i.parentNode = { replaceChild: (n, o) => { root.replaced.push([n, o]); } }; }); return root; };
  const a1 = mkImg('https://t/1.png'), a2 = mkImg('https://t/2.png'), lg = mkImg('https://t/logo.svg', true);
  const r1 = R.hydrate(mkRoot([a1, a2, lg]));
  ok('H\'1 erster Aufbau: jede Kachel (und das Logo) wird genau einmal angefragt', r1.started === 3 && r1.reused === 0 && a1.src === 'https://t/1.png' && a2.src === 'https://t/2.png' && !a1._at['data-rmx-src']);
  a1.complete = true; a1.naturalWidth = 1024; a1.onload(); a2.complete = true; a2.naturalWidth = 1024; a2.onload(); lg.complete = true; lg.naturalWidth = 80; lg.onload();
  ok('H\'2 geladene Kachel wird als sichtbar markiert und gemerkt', a1.classList.contains('ok') && R.stats().kept === 3);
  /* die Story setzt ihr Markup neu ⇒ neue Platzhalter mit denselben Adressen */
  const b1 = mkImg('https://t/1.png'), b2 = mkImg('https://t/2.png'), b3 = mkImg('https://t/3.png'); b1.style.cssText = 'left:7px';
  const root2 = mkRoot([b1, b2, b3]);
  const r2 = R.hydrate(root2);
  ok('H\'3 zweiter Aufbau: schon geladene Kacheln kommen aus dem Speicher (kein Netz), nur die neue wird angefragt', r2.reused === 2 && r2.started === 1 && b1.src === null && b3.src === 'https://t/3.png' && root2.replaced.length === 2 && root2.replaced[0][0] === a1, JSON.stringify(r2));
  ok('H\'4 wiederverwendetes Bild uebernimmt die Lage des Platzhalters', a1.style.cssText === 'left:7px');
  const bad = mkImg('https://t/9.png'); let failed = 0; bad.closest = () => ({ classList: { contains: () => false, remove() {}, add() { failed++; } }, dispatchEvent() {} });
  R.hydrate(mkRoot([bad])); bad.onerror();
  ok('H\'5 Fehlschlag: Kartenebene geht aus, das Bild wird NICHT gemerkt', failed === 1 && R.stats().kept === 3 && R.stats().failed === 1);
  { const c1 = mkImg('https://t/5.png'); let off = 0; c1.closest = () => ({ classList: { contains: () => false, remove() {}, add() { off++; } }, dispatchEvent() {} });
    const r5 = R.hydrate(mkRoot([c1]));
    ok('H\'5a nach einem Fehlschlag 5 min keine neuen Anfragen — die Karte bleibt aus, die Strecke steht', r5.started === 0 && r5.skipped === 1 && c1.src === null && off === 1 && R.stats().pausedMs > 4 * 60 * 1000);
    R._resume(); const c2 = mkImg('https://t/6.png'); ok('H\'5b danach wird wieder geladen', R.hydrate(mkRoot([c2])).started === 1); }
  ok('H\'6 ohne DOM / ohne Karten kein Fehler', R.hydrate(null).started === 0 && R.hydrate({ querySelectorAll: () => [] }).started === 0);
}

/* ---------- F) Einstellung + Einbindung ---------- */
{
  ok('F1 map-config.js: EINE Stelle — Anbieter, Schluessel, Stil, 512er-Kacheln, Story an, Aktivitaetsseite an (v8-435), Adressvorlagen, Logo, Quellenhinweis', /window\.ORVIA_MAP_CONFIG = \{\s*provider: 'maptiler',\s*key: '[A-Za-z0-9]*',\s*style: 'dataviz-dark',\s*tileSize: 512,\s*story: true,\s*detail: true,\s*tiles: \{\s*512: 'https:\/\/api\.maptiler\.com\/maps\/\{style\}\/\{z\}\/\{x\}\/\{y\}\{r\}\.png\?key=\{key\}',\s*256: 'https:\/\/api\.maptiler\.com\/maps\/\{style\}\/256\/\{z\}\/\{x\}\/\{y\}\{r\}\.png\?key=\{key\}'\s*\},\s*logo: 'https:\/\/api\.maptiler\.com\/resources\/logo\.svg',\s*attribution: '© MapTiler © OpenStreetMap contributors'\s*\};/.test(cfgSrc));
  ok('F1-434 der Schluessel ist eingetragen (Karte an) — Stil Dataviz Dark, 512er, Story und (seit v8-435) Aktivitaetsseite', /^[A-Za-z0-9]{12,}$/.test(REAL.key) && REAL.style === 'dataviz-dark' && REAL.tileSize === 512 && REAL.story === true && REAL.detail === true && mk({ key: REAL.key }).enabled() === true);
  ok('F1-434a der Schluessel steht in KEINER anderen Quelldatei der App (alle Ordner) und in keinem Test', (() => { const hits = []; const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { /* fixtures/ = von der Suite ERZEUGTE Kopien der App (gm6h.html bettet alle Skripte ein) — keine Quelle */ if (e.name === 'node_modules' || e.name === '.git' || e.name === 'fixtures') continue; const p = new URL(e.name + (e.isDirectory() ? '/' : ''), d); if (e.isDirectory()) walk(p); else if (/\.(js|mjs|cjs|html|css|json|webmanifest|md|sh|sql|ts|txt)$/.test(e.name)) { if (fs.readFileSync(p, 'utf8').includes(REAL.key)) hits.push(p.pathname.split('/').slice(-2).join('/')); } } }; walk(new URL(_APPREL, import.meta.url)); walk(new URL('./', import.meta.url)); return hits.length === 1 && hits[0] === 'js/map-config.js' ? true : (console.log('   Fundstellen: ' + hits.join(', ')), false); })());
  ok('F1-434b der Anbieter steht nur in map-config.js: kein anderes Modul (auch route-map.js nicht), kein Stylesheet, keine Seite kennt Anbieter-Namen oder -Adresse', (() => { const dir = new URL(_APPREL + 'js/', import.meta.url); const all = []; const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = new URL(e.name + (e.isDirectory() ? '/' : ''), d); if (e.isDirectory()) walk(p); else if (/\.js$/.test(e.name)) all.push(p); } }; walk(dir); const bad = all.filter(p => !/\/js\/map-config\.js$/.test(p.pathname) && /maptiler/i.test(fs.readFileSync(p, 'utf8'))).map(p => p.pathname.split('/').pop()); return all.length > 40 && bad.length === 0 && !/maptiler/i.test(src) && !/maptiler/i.test(idx + sw + css) ? true : (console.log('   Fundstellen: ' + bad.join(', ')), false); })());
  ok('F1-434c route-map.js baut Adressen nur aus der Vorlage ({style} {key} {z} {x} {y} {r}) und enthaelt selbst keine https-Adresse', !/https?:\/\//.test(src) && /c\.url\.replace\('\{style\}', encodeURIComponent\(c\.style\)\)\.replace\('\{key\}', encodeURIComponent\(c\.key\)\)/.test(src) && /enabled: c\.enabled !== false && !!url && \(!needKey \|\| !!key\)/.test(src));
  ok('F1a der Schluessel steht in keiner anderen Datei (nur map-config.js; route-map liest die Einstellung)', (() => { const dir = new URL(_APPREL + 'js/', import.meta.url); const others = fs.readdirSync(dir).filter(f => /\.js$/.test(f) && f !== 'map-config.js' && f !== 'route-map.js'); return others.length > 20 && others.every(f => { const x = fs.readFileSync(new URL(f, dir), 'utf8'); return !/api\.maptiler\.com|ORVIA_MAP_CONFIG/.test(x); }); })() && (src.match(/ORVIA_MAP_CONFIG/g) || []).length >= 1 && !/api\.maptiler\.com/.test(idx + sw) && (src.match(/c\.key/g) || []).length <= 3);
  { const R0 = mk({ key: 'abc', detail: undefined, story: undefined }); ok('F1b Voreinstellung OHNE Angabe im Modul: Story an, Aktivitaetsseite aus, 512er (eingeschaltet wird in map-config.js)', R0.cfg().story === true && R0.cfg().detail === false && R0.cfg().tileSize === 512 && mk({ key: 'abc', detail: true }).cfg().detail === true && mk({ key: 'abc', story: false }).cfg().story === false); }
  ok('F2 beide Dateien geladen (Einstellung VOR dem Modul) und im Precache', idx.indexOf('js/map-config.js') > 0 && idx.indexOf('js/map-config.js') < idx.indexOf('js/route-map.js') && /'\.\/js\/map-config\.js','\.\/js\/route-map\.js'/.test(sw));
  ok('F3 keine Kartenbibliothek eingebunden (Standbild aus Kacheln, kein MapLibre/Leaflet)', !/maplibre|leaflet|mapbox-gl/i.test(idx) && !/maplibregl\.|L\.map\(|mapboxgl\./.test(src) && !/maplibre|leaflet|mapbox-gl/i.test(sw));
  ok('F4 Service Worker faengt fremde Kacheln nicht ab (nur eigene Dateien)', /if \(!sameOrigin\) return;/.test(sw));
}

/* ---------- G) Story-Cover + Aktivitaetsseite + Texte ---------- */
{
  ok('G1 Cover: Karte als Seitenhintergrund ueber route-map, Strecke zeichnet sich', /ORVIA\.routeMap\.html\(route,\{w:_sw,h:_mh,cls:'cover',draw:true,width:4\.5,tiles:_mapOn,/.test(ui) && /<div class="wst-mapbg" style="'\+accCss\+'">'\+_map\+'<\/div>'/.test(ui));
  ok('G1a Cover: der Innenrand oben geht um den sicheren Rand des iPhones mit (--sat gemessen) — Strecke liegt nicht mehr auf der Datumszeile', /height:var\(--sat,0px\);visibility:hidden;pointer-events:none';document\.body\.appendChild\(_pb\);_sat=_pb\.offsetHeight\|\|0;document\.body\.removeChild\(_pb\);/.test(ui) && /pad:\{t:_sat\+Math\.round\(Math\.max\(112,Math\.min\(132,_vh\*0\.15\)\)\),r:44,b:Math\.round\(_mh\*0\.17\),l:44\}/.test(ui));
  ok('G2 Cover: Distanz als Hauptzahl + bis zu drei sportgerechte Kennzahlen (ohne Distanz)', /class="wst-heronum"><b>'\+gmEsc\(_dm\[1\]\)\+'<\/b>/.test(ui) && /gmActCardKpis\(a,vm\)\.filter\(function\(c\)\{return c\[0\]!=='—'&&c\[1\]!=='DISTANZ'/.test(ui) && /\.slice\(0,3\)/.test(ui));
  ok('G3 Rueckfall bleibt: ohne Modul/Strecke die bisherige Seite (routeSVG bzw. grosse Kennzahl)', /if\(!coverPage&&route&&typeof routeSVG==='function'\)\{/.test(ui) && /pages\.push\(coverPage\|\|page\(/.test(ui));
  ok('G3a Story laedt Kacheln nur fuer die sichtbare Seite und ueber hydrate (Wiederverwendung)', /var _on=host\.querySelector\('\.wst-page\.on'\);if\(_on&&window\.ORVIA&&ORVIA\.routeMap&&ORVIA\.routeMap\.hydrate\)ORVIA\.routeMap\.hydrate\(_on\);/.test(ui));
  ok('G3b Aktivitaetsseite: Karte dort nur mit detail:true in der Einstellung (Schalter bleibt)', /if\(!RM\.cfg\|\|RM\.cfg\(\)\.detail!==true\)return false;/.test(ui));
  ok('G4 Aktivitaetsseite: Karte nur bei eingeschalteter Quelle; scheitern die Kacheln, kommt exakt die alte Zeichnung zurueck', /if\(!pg\|\|!route\|\|route\.length<2\|\|!RM\|\|!RM\.enabled\|\|!RM\.enabled\(\)\)return false;/.test(ui) && /el\.addEventListener\('orvia:rmx-failed',function\(\)\{try\{el\.innerHTML=keep;el\.classList\.remove\('has-rmx'\);/.test(ui) && /new CustomEvent\('orvia:rmx-failed', \{ bubbles: true \}\)/.test(src));
  ok('G5 Aktivitaetsseite: Karte wird NACH dem Einsetzen der Seite gesetzt (braucht die echte Breite) — genau ein Aufruf', (ui.match(/gmActMountRouteMap\(pg,route,vm\);/g) || []).length === 1 && /pg\.innerHTML=h;\s*pg\.classList\.add\('on'\);\s*gmActMountRouteMap\(pg,route,vm\);/.test(ui));
  ok('G6 Diagramm-Seiten: Zahlen statt Erklaersaetzen (Ø · Max. · Quelle)', /foot\('Ø '\+em\(hrAvg\+' bpm'\),'' \+ _uiT\('ui\.max_kurz'\) \+ ''\+hrMax\+' bpm',srcLine\)/.test(ui) && /foot\('Ø '\+em\(fmtDe\(spAvg\)\+' km\/h'\),'' \+ _uiT\('ui\.max_kurz'\)/.test(ui) && /foot\('Ø '\+em\(vm\.avgPowerW\+' W'\),'' \+ _uiT\('ui\.max_kurz'\)/.test(ui) && /'ui\.max_kurz': 'Max\. '/.test(de));
  ok('G7 „nichts nachgerechnet" / „Einheitenumrechnung" stehen nicht mehr in der Story', !/_uiT\('ui\.bpm_gemessene_werte_nichts_nachgerechnet'\)/.test(ui) && !/_uiT\('ui\.gemessene_geschwindigkeit_reine_einheitenumrechnung_aus'\)/.test(ui) && !/_uiT\('ui\.leistung_story_sub'\)/.test(ui));
  ok('G8 Quelle kommt aus der Aktivitaet (kein erfundener Sensor)', /var srcLine=\(vm\.source&&typeof gmActSrcLabel==='function'\)\?gmActSrcLabel\(vm\.source\):null;/.test(ui));
}

/* ---------- H) Gestaltung ---------- */
{
  ok('H1 Abdunkeln ueber einen eigenen Schleier zwischen Karte und Strecke — KEINE Deckkraft/Helligkeit auf der ganzen Ebene', /\.rmx-tiles::before\{content:"";position:absolute;inset:0;z-index:1;background:rgba\(5,8,13,var\(--rmx-dim,\.30\)\);/.test(css) && /\.rmx-tiles\{position:absolute;inset:0;z-index:0\}/.test(css) && !/\.rmx-tiles\{[^}]*(opacity|brightness)/.test(css));
  ok('H1a Tonwerte am Bild, nicht an der Ebene: Strassen heben sich ab (Helligkeit × Kontrast), alle Werte einstellbar', /\.rmx-tiles img\.rmx-t,\.rmv-tiles img\.rmx-t\{[^}]*filter:saturate\(var\(--rmx-sat,\.6\)\) brightness\(var\(--rmx-bri,2\.2\)\) contrast\(var\(--rmx-con,2\.9\)\)\}/.test(css) && /-webkit-filter:saturate\(var\(--rmx-sat,\.6\)\) brightness\(var\(--rmx-bri,2\.2\)\) contrast\(var\(--rmx-con,2\.9\)\);/.test(css) && /\.gm-story \.wst-mapbg \.rmx-tiles\{--rmx-dim:\.30;/.test(css));
  { /* dieselbe Rechnung wie der Browser: Helligkeit (×b), dann Kontrast ((v−½)·c+½), dann Schleier */
    const tone = (v, dim) => { let x = Math.min(1, v / 255 * 2.2); x = Math.max(0, Math.min(1, (x - 0.5) * 2.9 + 0.5)); return Math.round((x * (1 - dim) + (8 / 255) * dim) * 255); };
    const land = tone(41, 0.30), road = tone(50, 0.30), haus = tone(34, 0.30), schrift = tone(124, 0.30), alt = Math.round(50 * 0.58 + 8 * 0.42) - Math.round(41 * 0.58 + 8 * 0.42);
    ok('H1b Wirkung an den echten Grauwerten des Stils (Flaeche 41, Strasse 50): Abstand Strasse–Flaeche vorher ~5, jetzt ≥ 35 Stufen; Flaeche bleibt dunkel', alt <= 6 && road - land >= 35 && land <= 30 && haus <= land && schrift >= 150, JSON.stringify({ vorher: alt, flaeche: land, strasse: road, gebaeude: haus, schrift })); }
  ok('H2 Story: Karte blendet nach unten per Maske aus (keine Farbkante), oben abgedunkelt fuer den Titel', /\.gm-story \.wst-mapbg \.rmx-tiles\{[^}]*-webkit-mask-image:linear-gradient\(180deg,#000 0,#000 52%,rgba\(0,0,0,\.55\) 72%,transparent 100%\);\s*mask-image:linear-gradient/.test(css) && /\.gm-story \.wst-mapbg \.rmx-tiles::after\{[^}]*rgba\(5,8,13,\.80\) 0/.test(css));
  ok('H3 Kacheln blenden weich ein; gescheiterte Karte + Quellenhinweis verschwinden', /\.rmx-tiles img\.rmx-t,\.rmv-tiles img\.rmx-t\{[^}]*opacity:0;transition:opacity \.6s ease/.test(css) && /\.rmx-tiles img\.rmx-t\.ok,\.rmv-tiles img\.rmx-t\.ok\{opacity:1\}/.test(css) && /\.rmx\.tiles-failed \.rmx-tiles,\.rmx\.tiles-failed \.rmx-attr\{display:none\}/.test(css));
  ok('H4 Start gruen (Ring), Ziel korall (Punkt)', /\.rmx-start\{fill:#05080d;stroke:#3FE89A;stroke-width:3\}/.test(css) && /\.rmx-end\{fill:#FF6B5E;/.test(css));
  ok('H5 Hauptzahl gross und tabellarisch; Kennzahlen als Zeile darunter', /\.gm-story \.wst-heronum b\{font-size:clamp\(76px,25vw,112px\);font-weight:850;[^}]*font-variant-numeric:tabular-nums/.test(css) && /\.gm-story \.wst-herostats\{display:flex;/.test(css));
  ok('H6 „Bewegung reduzieren": Strecke steht sofort, nichts blendet ein', /prefers-reduced-motion:reduce\)\{\s*\.gm-story \.wst-mapbg \.gm-route-line\{animation:none;stroke-dashoffset:0\}/.test(css));
  ok('H7 Aktivitaetsfeld: bestehende Groesse bleibt, nur der Hintergrund wechselt', /\.route-map\.has-rmx\{background-image:none;background-color:#0a1018\}/.test(css) && /\.route-map\{height:255px;/.test(css));
}
console.log('\n' + (fail ? '❌' : '✅') + ' route_map: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
