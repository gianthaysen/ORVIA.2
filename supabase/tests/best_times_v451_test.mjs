/* ============================================================
   ORVIA · best_times_v451 — Bestzeiten: eine Rechnung, reduzierte Karten (ohne Browser, laeuft ueberall)
   Befund 17.10.2026: Bei ausgeschaltetem Leistungsregister zeigte die App 1 km 4:24, 5 km (Gesamtzeit) 29:29 und
   HM 2:21:08, der Register-Probelauf 4:21 / 29:11 / 2:20:47. Ursache: run-bests rechnete aus der auf ≤ 300 Punkte
   reduzierten Anzeige-Reihe, das Register aus den Worker-Bestwerten (alle Messzeilen). Zweiter Befund: das Sheet
   wies „5,1 km" aus — die auf eine Nachkommastelle gerundete Strecke einer ANDEREN Aktivitaet.
   D  Daten: ausgeschaltetes Register = dieselben Werte wie das Register (15 echte Laeufe)
   R  Regel: Worker-Bestwerte vorhanden → nur metric-eligibility; sonst bisherige Fenster; nie gemischt je Aktivitaet
   S  Strecke: tatsaechliche Distanz je Rekord (13.08. = 5,006 km), auch ueber die Register-Bruecke
   U  Oberflaeche (Quelltext): Karte ohne Methode/Kategorie, Sheet-Bausteine, i18n, Barrierefreiheit, Bewegung
   ============================================================ */
import { createRequire } from 'node:module';
import { existsSync as _ex, readFileSync } from 'node:fs';
import { DIAG, diagRun } from './_ledger-realdata.mjs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const require = createRequire(import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = v => JSON.stringify(v);
const clone = o => JSON.parse(JSON.stringify(o));

globalThis.window = globalThis;
for (const f of ['js/i18n.js', 'locales/de.js', 'js/onboarding/onboarding-sports-logic.js', 'js/training-domain.js', 'js/activity-normalize.js', 'js/activity-config.js',
  'js/activity-time.js', 'js/activity-effective.js', 'js/run-bests.js', 'js/engine/pb-sync.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const GEN = await import(new URL(_APPREL + 'tools/gen-eligibility-doc.mjs', import.meta.url));
for (const f of ['js/engine/performance-ledger.js', 'js/engine/feature-flags.js', 'js/engine/records-bridge.js', 'js/performance-ledger-store.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const O = globalThis.ORVIA, L = O.performanceLedger, RB = O.runBests, BR = O.recordsBridge;
const RUNS = DIAG.map((r, i) => diagRun(GEN, i, r));
const byDate = d => RUNS.find(a => a.metrics.garmin.start_gmt.startsWith(d));
const R0813 = byDate('2026-08-13');
const KM = { k1: 1000, k5: 5000, k10: 10000, k21: 21098 };

sec('D · ausgeschaltetes Register = Register');
const off = RB.measuredRunBests(RUNS);
ok('D0 Register-Bruecke ist aus (Flag aus)', BR.mode() === 'off' && off.source !== 'ledger');
ok('D1 Gesamtzeit: 1 km 4:21 · 5 km 29:11 · 10 km 1:01:49 · HM 2:20:47', off.k1.sec === 261 && off.k5.sec === 1751 && off.k10.sec === 3709 && off.k21.sec === 8447, [off.k1.sec, off.k5.sec, off.k10.sec, off.k21.sec].join('/'));
ok('D2 Aktiv: 5 km 23:38 (13.08.) · 10 km 57:55 (15.07.)', off.active.k5.sec === 1418 && off.active.k5.date === '2026-08-13' && off.active.k10.sec === 3475 && off.active.k10.date === '2026-07-15');
const ST = L.update(null, RUNS, { timeZone: 'Europe/Berlin' }).state;
const lb = k => L.currentBest(ST.events[k]);
const same = Object.keys(KM).every(k => {
  const e = lb('running.fastest_' + KM[k] + 'm@standard'), a = lb('running.fastest_' + KM[k] + 'm_active@standard');
  return e && a && e.value === off[k].sec && a.value === off.active[k].sec;
});
ok('D3 jede Laufdistanz, beide Zeitbegriffe: Wert identisch mit dem Register (eine Rechnung)', same,
   Object.keys(KM).map(k => k + ' ' + off[k].sec + '/' + (lb('running.fastest_' + KM[k] + 'm@standard') || {}).value).join(', '));
ok('D4 Quelle der Gesamtzeit benannt (worker_window), keine Reihen-Fenster mehr fuer Laeufe mit Worker-Bestwerten', ['k1', 'k5', 'k10', 'k21'].every(k => off[k].method === 'worker_window') && off.withWorker === 15);
ok('D5 Bisherige Vertraege bleiben: Prognose/Ziel-Engine lesen out[k] (Gesamtzeit), aktive Zeit nur unter .active', off.k5.timing === 'elapsed' && off.active.k5.timing === 'active');

sec('R · Regel: eine Rechnung je Aktivitaet');
{
  /* Ohne Worker-Bestwerte (Altbestand): bisherige Fenster aus der Anzeige-Reihe, unveraendert */
  const legacy = RUNS.map(a => { const b = clone(a); delete b.metrics.best_efforts.distance; return b; });
  const lg = RB.measuredRunBests(legacy);
  ok('R1 ohne Worker-Bestwerte: bisherige Rechnung (Reihe/ganze Aktivitaet), keine Worker-Methode', lg.k5 && lg.k5.method !== 'worker_window' && !lg.withWorker, lg.k5 && lg.k5.method);
  /* Laufband: Register verwirft die Strecke — die App auch (kein Rueckfall auf die Reihe) */
  const tm = clone(R0813); tm.metrics.garmin.type_key = 'treadmill_running';
  const t1 = RB.measuredRunBests([tm]);
  ok('R2 Laufband mit Worker-Bestwerten: keine Bestzeit (wie im Register), kein stiller Rueckfall', t1.k5 === null && t1.active.k5 === null, J(t1.k5));
  /* Veralteter Details-Vertrag: Register wertet nicht → App rechnet wie bisher (Altbestand) */
  const old = clone(R0813); old.metrics.detailsVersion = 0;
  const t2 = RB.measuredRunBests([old]);
  ok('R3 alter Details-Vertrag: bisherige Rechnung statt Register-Pruefung', t2.k5 && t2.k5.method !== 'worker_window', t2.k5 && t2.k5.method);
  /* Nie das Minimum beider Welten derselben Aktivitaet: die schnellere Reihen-Zeit darf den Worker-Wert nicht unterbieten */
  const fast = clone(R0813); fast.metrics.streams = { time: [0, 600], distance: [0, 5005.73] };
  const t3 = RB.measuredRunBests([fast]);
  ok('R4 Reihe zeigt scheinbar 10:00 fuer 5 km — zaehlt nicht, der Worker-Wert gilt (33:15)', t3.k5 && t3.k5.sec === 1995 && t3.k5.method === 'worker_window', t3.k5 && t3.k5.sec);
  /* Eigene Laeufe ohne Worker-Bestwerte: unveraendert */
  const own = { id: 'own1', clientRecordId: 'own1', sportId: 'running', source: 'manual', status: 'completed', startedAt: '2026-09-20T07:00:00.000Z', durationSeconds: 1500, summary: { distanceM: 5000 }, metrics: {} };
  const t4 = RB.measuredRunBests([own]);
  ok('R5 eigene Eingabe 5 km 25:00: bisherige Rechnung (ganze Aktivitaet), aktiv = Angabe', t4.k5 && t4.k5.sec === 1500 && t4.k5.method === 'activity_total' && t4.active.k5 && t4.active.k5.sec === 1500);
  /* Rad und Schwimmen: unberuehrt */
  ok('R6 Rad/Schwimmen: keine Register-Pruefung (nur Laufen)', RB.measuredBests(RUNS, { sport: 'cycling' }).withWorker === undefined);
  /* Leistung: 405 Laeufe */
  const big = []; for (let i = 0; i < 27; i++) RUNS.forEach((a, j) => { const b = clone(a); b.id = 'b' + i + '-' + j; b.clientRecordId = b.id; big.push(b); });
  const t0 = Date.now(); RB.measuredRunBests(big); const dt = Date.now() - t0;
  ok('R7 405 Laeufe in unter 400 ms (Vorfilter: kuerzer als die Zielstrecke wird nicht geprueft)', dt < 400, dt + ' ms');
}

sec('S · tatsaechliche Strecke je Rekord');
ok('S1 5 km aktiv (13.08.): 5,006 km — die Strecke DIESES Laufs, nicht einer anderen Aktivitaet', off.active.k5.activityId === R0813.clientRecordId && Math.abs(off.active.k5.distM - 5005.73) < 0.01 && off.active.k5.km === 5.006, J({ km: off.active.k5.km, distM: off.active.k5.distM }));
ok('S2 5 km Gesamtzeit (06.09.): Fenster 5000,0 m (Ziel + Ueberhang des Workers)', off.k5.date === '2026-09-06' && off.k5.distM === 5000, String(off.k5.distM));
ok('S3 Pausen der aktiven Bestzeit: 9:39 angehalten (1997 − 1418 s)', off.active.k5.pausedS === 579);
ok('S4 jede Laufbestzeit traegt ihre Strecke (distM)', ['k1', 'k5', 'k10', 'k21'].every(k => off[k].distM > KM[k] - 1 && off.active[k].distM > KM[k] - 1));
{
  const realStore = O.performanceLedgerStore, on = { isEnabled: () => true };
  O.featureFlags._setForTest && O.featureFlags._setForTest('performance_ledger', true);
  const fakeStore = Object.assign({}, realStore, { enabled: () => true, ready: () => true,
    bestOf: k => { const e = lb(k); return e ? Object.assign({}, e) : null; },
    entryOf: (id, mk) => L.entryOf(ST, id, mk) });
  O.performanceLedgerStore = fakeStore;
  try {
    const ov = RB.measuredRunBests(RUNS);
    ok('S5 Register an: Bruecke liefert die Strecke beider Zeitbegriffe (aktiv 5,006 km, Gesamtzeit 5,000 km)', ov.source === 'ledger' && Math.abs(ov.active.k5.distM - 5005.73) < 0.01 && ov.k5.distM === 5000 && ov.k5.measure === 'elapsed_window', J([ov.k5 && ov.k5.distM, ov.active.k5 && ov.active.k5.distM]));
    ok('S6 Register an und aus: identische Werte', Object.keys(KM).every(k => ov[k].sec === off[k].sec && ov.active[k].sec === off.active[k].sec));
  } finally { O.performanceLedgerStore = realStore; O.featureFlags._setForTest && O.featureFlags._setForTest('performance_ledger', false); }
}

sec('U · Oberflaeche (Quelltext-Vertrag)');
const ui = readFileSync(new URL(_APPREL + 'js/ui.js', import.meta.url), 'utf8');
const de = readFileSync(new URL(_APPREL + 'locales/de.js', import.meta.url), 'utf8');
const css = readFileSync(new URL(_APPREL + 'styles.css', import.meta.url), 'utf8');
const fnSrc = name => { const i = ui.indexOf('function ' + name + '('); if (i < 0) return ''; const j = ui.indexOf('\nfunction ', i + 10); return ui.slice(i, j < 0 ? undefined : j); };
const card = fnSrc('gmProfBestTimes'), sheet = fnSrc('gmOpenBtRowSheet');
ok('U1 Karte: keine Methode, keine Kategorie, keine Vergleichszeit, kein Pausentext (bt-sub/bt-from/bt-alt/bt-hint entfallen)', card && !/bt-sub|bt-from|bt-alt|bt-hint|mini-note/.test(card));
ok('U2 Karte: Distanz, Zeit, Datum, optional Pausenzeichen bzw. „geschätzt"', /bt-dist/.test(card) && /bt-time/.test(card) && /bt-date/.test(card) && /bt-pz/.test(card) && /bt\.est_tag/.test(card));
ok('U3 Karte: Bildschirmleser bekommt alles in einem Satz (aria-label mit Kategorie und Datum)', /aria-label="'\+gmEsc\(aria\)/.test(card) && /bt\.aria_measured/.test(card));
ok('U4 Zeiten einheitlich h:mm:ss (kein fmtPace mehr — vorher „73:18" statt 1:13:18)', !/fmtPace/.test(card) && /_btFmt/.test(card));
ok('U5 Sheet: Kopf, Hauptleistung, zwei Vergleichskacheln mit eigenem Datum, Hinweis nur bei Bedarf', /bts-head/.test(sheet) && /bts-hero/.test(sheet) && /bts-tile/.test(sheet) && /bt\.tile_active/.test(sheet) && /bt\.tile_elapsed/.test(sheet) && /if\(run&&s\.act&&\(differ\|\|s\.act\.pausedS>0\)\)/.test(sheet));
ok('U6 Sheet: „Messdetails anzeigen" als eingeklapptes <details> (ohne open)', /<details class="bts-md">/.test(sheet) && !/<details[^>]*\bopen\b/.test(sheet));
ok('U7 Messdetails: Datenquelle, Messmethode, gemessene Distanz, Pausendauer, Datenherkunft, Genauigkeit', ['md_source', 'md_method', 'md_dist', 'md_pause', 'md_origin', 'md_acc'].every(k => sheet.includes("'bt." + k + "'")));
ok('U8 Distanz im Sheet aus dem angezeigten Rekord mit 3 Nachkommastellen (nicht fmtDe, nicht s.meas einer anderen Zeile)', /_btDist\(rec,s\.sport\)/.test(sheet) && !/fmtDe/.test(sheet) && /maximumFractionDigits:dg/.test(fnSrc('_btDist')));
const lits = [...new Set([...ui.matchAll(/'(bt\.[a-z0-9_]+)'/g)].map(m => m[1]))];
ok('U9 alle bt.*-Texte (auch aus Tabellen) stehen in locales/de.js', lits.length >= 60 && lits.every(k => de.includes("'" + k + "':")), lits.filter(k => !de.includes("'" + k + "':")).join(','));
ok('U10 keine zusammengesetzten Schluessel (Pruefbarkeit)', !/_uiT\('bt\.[a-z_]*'\s*\+/.test(ui));
ok('U11 Sheet: sichere Zone unten, sanfte Animation, reduzierte Bewegung respektiert', /#detailSheet \.bts\{[^}]*safe-area-inset-bottom/.test(css) && /@keyframes btsIn/.test(css) && /prefers-reduced-motion:reduce\)\{\s*#detailSheet \.bts/.test(css));
ok('U12 kleine Displays (< 360 px) und helles Design haben eigene Regeln', /@media \(max-width:359px\)\{\s*#gmProfPage \.bt-page/.test(css) && /\[data-theme="light"\] #detailSheet \.bts-eye/.test(css));
ok('U13 Champagne Gold #D8BB7A als Akzent, kein Neon', /#D8BB7A/.test(css) && !/#gmProfPage \.bt-[^{]*\{[^}]*(#0ff|#39ff14|#ff00ff)/i.test(css));
ok('U14 Fokus sichtbar an Karte, Umschalter und Messdetails', /#gmProfPage \.bt-row:focus-visible/.test(css) && /#gmProfPage \.bt-mode button:focus-visible/.test(css) && /\.bts-md summary:focus-visible/.test(css));

console.log('\n' + (fail ? '❌' : '✅') + ' best_times_v451: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
