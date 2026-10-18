/* ============================================================
   ORVIA · activity_analysis_v452 — Kennzahlen der Aktivitaetsansicht und sportartspezifische Analyse (ohne Browser)
   Befund 18.10.2026: Beim Schwimmen zeigte ORVIA fast nur die Herzfrequenz. Ursachen im Code: (1) die Schwimmfelder
   des Garmin-Listeneintrags stehen in metrics.ext, den der lokale Speicher bewusst nicht fuehrt; die Aktivitaetsseite
   las ihn nie; (2) die Zugfrequenz-Reihe steht in ext.series (gleicher Weg); (3) Runden/Bahnen ruft der Worker nur mit
   DETAIL_EXTRAS ab (Standard aus). v8-452: metric-eligibility.describeActivity urteilt je Kennzahl (Status, Pruefstand,
   Methode, Quelle), engine/activity-analysis.js baut daraus die Ansicht je Sportart.
   S  Schwimmen: Becken, Freiwasser, Intervalle, fehlende Werte, Einheiten, Plausibilitaet, Korrekturen, Altbestand
   O  andere Sportarten: Laufen, Rad (Leistung nur gemessen; virtuell), Kraft (eigene Daten, Garmin-Volumen gesperrt)
   L  Leistungsregister und Bestzeiten unveraendert
   U  Quelltext-Vertrag der Seite (Laden des Rohblocks, i18n, keine Rohdaten in der Hauptansicht)
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
  'js/activity-time.js', 'js/activity-effective.js', 'js/activity-streams.js', 'js/activity-capabilities.js', 'js/run-bests.js', 'js/engine/pb-sync.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const GEN = await import(new URL(_APPREL + 'tools/gen-eligibility-doc.mjs', import.meta.url));
for (const f of ['js/engine/performance-ledger.js', 'js/engine/activity-analysis.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const O = globalThis.ORVIA, ME = O.metricEligibility, AA = O.activityAnalysis, L = O.performanceLedger, AE = O.activityEffective, RB = O.runBests;
const M = (a, o) => ME.describeActivity(a, o).metrics;

/* Beckenschwimmen wie aus dem Worker: Listenfelder in ext.fields (Einheit der Bahnlaenge unbelegt: 2500 = cm) */
function pool(over) {
  const a = GEN.referenceActivity('swimming', 'best');
  a.id = 'sw-1'; a.summary = { distanceM: 1500, avgHr: 138, maxHr: 161, caloriesKcal: 420 }; a.durationSeconds = 2100;
  a.metrics.garmin.timer_duration_s = 2100; a.metrics.garmin.elapsed_duration_s = 2160; a.metrics.garmin.moving_duration_s = 1800;
  a.metrics.ext = { v: 1, fields: { distance: 1500, duration: 2100, averageHR: 138, activeLengths: 60, poolLength: 2500, unitOfPoolLength: 'meter', strokes: 1100, avgStrokes: 18.3, averageSwolf: 39, averageSwimCadenceInStrokesPerMinute: 28, maxSwimCadenceInStrokesPerMinute: 34, avgStrokeDistance: 182, averageSpeed: 0.83 } };
  return Object.assign(a, over || {});
}

sec('S · Schwimmen');
{
  const m = M(pool());
  ok('S1 Becken: Kontext aus dem Garmin-Typ (lap_swimming → pool)', m.environment.value === 'pool' && m.environment.validation === 'validated');
  ok('S2 Bahnlaenge 2500 (Listenfeld, Einheit unbelegt) → 25 m: nur die EINE plausible Lesart (Meter vs. Zentimeter)', m.poolLength.value === 25 && m.poolLength.raw === 2500);
  ok('S3 Gegenpruefung 60 Bahnen × 25 m = 1500 m: Distanz, Bahnen und Bahnlaenge „consistent" (in DIESER Einheit bestaetigt)', ['distance', 'activeLengths', 'poolLength'].every(k => m[k].validation === 'consistent'), J(['distance', 'activeLengths', 'poolLength'].map(k => m[k].validation)));
  ok('S4 SWOLF / Zugfrequenz / Zuege: vorhanden, aber „unverified" (Bedeutung in ORVIA nicht belegt) — nie als geprueft ausgegeben', m.swolf.value === 39 && m.swolf.validation === 'unverified' && m.strokeRate.value === 28 && m.strokes.value === 1100 && !m.swolf.ledger);
  ok('S5 Strecke je Zug (Einheit unbelegt): gesperrt, Wert nicht ausgegeben', m.strokeDistance.validation === 'blocked' && m.strokeDistance.value === null && m.strokeDistance.reason === 'unit_unresolved');
  ok('S6 Ø Tempo mit Garmins Zeitbegriff: 1500 m ÷ 1800 s trifft Garmins Ø-Geschwindigkeit 0,83 m/s → Bewegungszeit, 2:00 /100 m, „consistent"', Math.round(m.pace100.value) === 120 && m.pace100.paceBasis === 'moving' && m.pace100.validation === 'consistent' && m.pace100.method === 'derived');
  ok('S7 zweite Zahl: Tempo inkl. Pausen (2100 s / 15 = 2:20); „Tempo in Bewegung" entfaellt (= Ø Tempo)', Math.round(m.pace100Total.value) === 140 && m.pace100Moving.status === 'not_applicable' && m.pace100Moving.reason === 'same_as_main');
  ok('S8 Pausen = Gesamtzeit − Timer (60 s), berechnet', m.pause.value === 60 && m.pause.method === 'derived');
  ok('S9 Runden/Bahnen: „nicht abgefragt" (Zusatzabruf aus) — nicht „nicht geliefert"', m.laps.status === 'not_imported' && m.laps.reason === 'extras_disabled' && m.lengths.status === 'not_imported');
  const md = AA.analyze(pool());
  ok('S10 Ansicht: Hauptkennzahl Distanz, dann Dauer und Tempo; Karten mit Puls, Bahnen, SWOLF, Zugfrequenz …', md.hero.map(d => d.id).join() === 'distance,duration,pace100' && ['avgHr', 'activeLengths', 'swolf', 'strokeRate'].every(k => md.cards.some(d => d.id === k)), J(md.cards.map(d => d.id)));
  ok('S11 gesperrte Werte erscheinen nirgends in der Hauptansicht', !md.hero.concat(md.cards).some(d => d.validation === 'blocked'));
  ok('S12 ungepruefte Quellwerte werden markiert (Hinweis unter den Karten)', md.unverifiedShown === true);
}
{
  const ow = pool(); ow.metrics.garmin.type_key = 'open_water_swimming'; ow.metrics.route = [[47.1, 8.1], [47.2, 8.2], [47.3, 8.3]];
  const m = M(ow), md = AA.analyze(ow);
  ok('S13 Freiwasser: Bahnen, Bahnlaenge, SWOLF, Bahnen-Abruf „entfaellt" (not_applicable) — keine Gegenpruefung', ['poolLength', 'activeLengths', 'swolf', 'lengths', 'strokesPerLength'].every(k => m[k].status === 'not_applicable') && m.distance.validation !== 'consistent');
  ok('S14 Freiwasser: GPS-Strecke erkannt, Zugfrequenz bleibt (gibt es auch draussen)', m.route.status === 'available' && m.strokeRate.status === 'available' && md.context === 'open_water');
}
{
  const a = pool(); a.metrics.splits = [{ distance: 400, duration: 480, averageHR: 135 }, { distance: 0, duration: 60 }, { distance: 400, duration: 470, averageHR: 140 }, { distance: 0, duration: 60 }, { distance: 400, duration: 490, averageHR: 142 }, { distance: 300, duration: 380 }];
  a.metrics.splits_source = 'garmin_splits';
  const md = AA.analyze(a), iv = md.intervals;
  ok('S15 Intervalle: aktive Intervalle nummeriert, Pausen getrennt, Tempo je Intervall aus Distanz/Zeit DERSELBEN Runde', iv && iv.active === 4 && iv.rest === 2 && iv.rows[0].n === 1 && iv.rows[1].n === null && iv.rows[2].n === 2 && Math.round(iv.rows[0].pace) === 120 && iv.restTime === 120, J(iv && iv.rows.map(r => [r.n, r.rest, Math.round(r.pace || 0)])));
  ok('S16 Gleichmaessigkeit nur mit ≥ 3 aktiven Intervallen: Streuung (Variationskoeffizient), schnellstes/langsamstes benannt', md.efficiency && md.efficiency.intervals === 4 && md.efficiency.best === 2 && md.efficiency.cvPct > 0, J(md.efficiency));
  ok('S17 Zugzahl/SWOLF je Intervall: nicht vorhanden (schlanke Runden tragen sie nicht) — nichts erfunden', iv.perIntervalStrokes === false && iv.rows.every(r => !('swolf' in r) && !('strokes' in r)));
  const b = pool(); b.metrics.splits = [{ distance: 400, duration: 480 }, { distance: 400, duration: 470 }];
  ok('S18 ohne genug Intervalle keine Effizienz-Karte; ohne Runden keine Intervalle', AA.analyze(b).efficiency === null && AA.analyze(pool()).intervals === null);
}
{
  const a = pool(); delete a.metrics.ext.fields.poolLength;
  const m = M(a);
  ok('S19 fehlende Bahnlaenge: „nicht geliefert", keine Gegenpruefung, Distanz bleibt ungeprueft', m.poolLength.status === 'not_delivered' && m.distance.validation === 'unverified' && m.activeLengths.validation === 'unverified');
  const odd = pool(); odd.metrics.ext.fields.poolLength = 3;      // weder 3 m noch 3 cm plausibel
  ok('S20 unplausible Bahnlaenge (3): gesperrt, Einheit ungeklaert — nicht angezeigt', M(odd).poolLength.validation === 'blocked' && M(odd).poolLength.value === null);
  const mis = pool(); mis.metrics.ext.fields.activeLengths = 70;   // 70 × 25 = 1750 ≠ 1500
  ok('S21 Widerspruch Bahnen × Bahnlaenge ≠ Distanz: nicht „consistent" (bleibt ungeprueft), nichts wird umgerechnet', M(mis).distance.validation === 'unverified' && M(mis).distance.value === 1500 && ME.describeActivity(mis).poolCheck.ok === false);
}
{
  const a = pool(); a.summary = { distanceM: 1500 }; delete a.metrics.streams.heart_rate;
  const m = M(a), md = AA.analyze(a);
  ok('S22 fehlende Herzfrequenz: Puls „nicht geliefert", kein Puls-Diagramm, keine Puls-Karte', m.avgHr.status === 'not_delivered' && !md.charts.some(c => c.id === 'hr') && !md.cards.some(d => d.id === 'avgHr'));
  const nd = pool(); nd.summary = { avgHr: 138 };
  const m2 = M(nd);
  ok('S23 fehlende Distanz → kein Tempo (Grundwerte fehlen), keine Gegenpruefung', m2.distance.status === 'not_delivered' && m2.pace100.status === 'not_delivered' && m2.pace100.reason === 'needs_distance_and_duration');
  const bad = pool(); bad.summary.distanceM = 150000;          // 150 km im Becken in 35 min
  const m3 = M(bad);
  ok('S24 ungueltige Schwimmdistanz: Tempo unplausibel → gesperrt, nicht angezeigt', m3.pace100.validation === 'blocked' && !AA.analyze(bad).hero.some(d => d.id === 'pace100'));
  const ns = pool(); delete ns.metrics.ext.fields.averageSwolf;
  ok('S25 fehlender SWOLF: „nicht geliefert", keine Karte, kein erfundener Wert', M(ns).swolf.status === 'not_delivered' && !AA.analyze(ns).cards.some(d => d.id === 'swolf'));
}
{
  const a = AE.setManual(pool(), 'duration', 2400).activity;
  const m = M(a);
  ok('S26 manuelle Dauer-Korrektur gilt: Dauer = 2400 s (manuell), Tempo inkl. Pausen daraus (2:40)', m.duration.value === 2400 && m.duration.method === 'manual' && m.duration.validation === 'validated' && Math.round(m.pace100Total.value) === 160);
}
{
  const a = pool(); const local = clone(a); delete local.metrics.ext;
  const m = M(local), mp = M(local, { extState: 'pending' }), mu = M(local, { extState: 'unavailable' }), ml = M(local, { extState: 'loaded' });
  ok('S27 Rohblock nicht geladen: Schwimmfelder „not_loaded" (nicht „nicht geliefert")', m.swolf.status === 'not_loaded' && mp.swolf.reason === 'raw_block_pending' && mu.swolf.reason === 'raw_block_unavailable');
  ok('S28 Rohblock geladen, aber auf dem Server keiner (Altzeile): „nicht abgefragt" mit Grund', ml.swolf.status === 'not_imported' && ml.swolf.reason === 'no_raw_block');
  ok('S29 der lokale Datensatz bleibt unveraendert (keine Mutation durch die Auswertung)', J(local) === J((() => { const x = clone(a); delete x.metrics.ext; return x; })()));
  const twice = [AA.analyze(a), AA.analyze(clone(a))].map(x => J(x.hero.concat(x.cards).map(d => [d.id, d.value, d.validation])));
  ok('S30 Mehrfachimport/zweite Kopie: identisches Ergebnis, nichts wird zusammengezaehlt', twice[0] === twice[1]);
}
{
  const old = pool(); old.metrics.detailsVersion = 2; delete old.metrics.detailsFetchedAt; delete old.metrics.ext;
  const m = M(old, { extState: 'loaded' });
  ok('S31 Altbestand ohne neue Felder: Reihen „Details nicht geladen", Rohfelder „nicht abgefragt" — kein Fehler', m.strokeRateSeries.status === 'not_imported' && m.swolf.status === 'not_imported');
  const inc = pool({ status: 'in_progress' });
  ok('S32 unvollstaendige Einheit: Dauer nicht geprueft (not_completed), Anzeige bleibt moeglich', M(inc).duration.validation === 'unverified' && M(inc).duration.reason === 'not_completed');
  const thin = pool(); thin.metrics.streams = { heart_rate: [140, 141], time: [0, 2100] };
  ok('S33 geringe Aufloesung (2 Punkte): kein Diagramm (mindestens 3 Messpunkte), keine nachgebaute Kurve', AA.analyze(thin).charts.length === 0);
  const ser = pool(); ser.metrics.streams.speed = [0.8, 0.9, 0, 0.85, 0.82, 0.9]; ser.metrics.ext.series = { directSwimCadence: { values: [26, 27, 0, 28, 27, 26], garmin_unit: 'strokesPerMinute' }, directSwolf: { values: [38, 39, null, 40, 39, 38] } };
  const sm = AA.analyze(ser);
  ok('S34 Diagramme nur mit Reihe: Tempo (0 m/s = Wende/Pause weggelassen), Puls, Zugfrequenz, SWOLF; Zeitachse uebernommen', sm.charts.map(c => c.id).join() === 'pace100,hr,strokeRate,swolf' && sm.charts[0].values[2] === null && !!sm.charts[0].times, J(sm.charts.map(c => [c.id, c.points])));
}

sec('R · echte Schwimmeinheiten (Audit 18.10.2026)');
{
  const { SWIMS, swimRow } = await import('./_swim-realdata.mjs');
  const D = SWIMS.map((_, i) => ME.describeActivity(swimRow(i)));
  const pools = [2, 3, 4, 5], ows = [0, 1];
  ok('R1 vier Beckeneinheiten: Bahnlaenge 5000 / 2500 (Zentimeter) → 50 m / 50 m / 25 m / 25 m', pools.map(i => D[i].metrics.poolLength.value).join() === '50,50,25,25');
  ok('R2 Bahnen × Bahnlaenge = Distanz in allen vier (36×50=1800, 14×50=700, 28×25=700, 54×25=1350)', pools.every(i => D[i].poolCheck && D[i].poolCheck.ok));
  ok('R3 Garmins Ø-Geschwindigkeit = Distanz ÷ Bewegungszeit (Liste) im Becken, = Distanz ÷ Timer im Freiwasser', pools.every(i => D[i].swimCheck.paceBasis === 'moving') && ows.every(i => D[i].swimCheck.paceBasis === 'timer'));
  ok('R4 Becken: Bewegungszeit der Aufzeichnung = 0 → Listenwert (1374 / 768 / 1024 / 1457 s)', pools.map(i => Math.round(D[i].metrics.moving.value)).join() === '1374,768,1024,1457');
  ok('R5 Ø Tempo: 1:16 / 1:50 / 2:26 / 1:48 /100 m (Becken) · 5:10 / 5:36 (Freiwasser, Timer)', [2, 3, 4, 5, 0, 1].map(i => Math.round(D[i].metrics.pace100.value)).join() === '76,110,146,108,310,336', [2, 3, 4, 5, 0, 1].map(i => Math.round(D[i].metrics.pace100.value)).join());
  ok('R6 Zuege = Zuege je Bahn × Bahnen, SWOLF = Zuege je Bahn + Sekunden je Bahn, Zugfrequenz = Zuege ÷ Bewegungsminuten — alle vier Becken „consistent"', pools.every(i => ['strokes', 'strokesPerLength', 'swolf', 'strokeRate'].every(k => D[i].metrics[k].validation === 'consistent')));
  ok('R7 Freiwasser: Strecke je Zug in Zentimetern (103 ≈ 899,95 m ÷ 877) → 1,03 m „consistent"; Becken liefert 0 → nicht geliefert', ows.every(i => D[i].metrics.strokeDistance.validation === 'consistent') && D[0].metrics.strokeDistance.value === 1.03 && pools.every(i => D[i].metrics.strokeDistance.status === 'not_delivered'));
  ok('R8 Freiwasser: SWOLF/Bahnen entfallen (Garmin liefert SWOLF 102/114 ohne Bahnen — nicht angezeigt); Zugfrequenz bleibt ungeprueft', ows.every(i => D[i].metrics.swolf.status === 'not_applicable' && D[i].metrics.strokeRate.validation === 'unverified'));
  ok('R9 Ruhezeit = Timer − Bewegungszeit: 08.10. 51:03 von 1:08:07', D[4].metrics.restTime.value === 3063);
  ok('R10 Pulszonen in allen sechs geliefert (Garmin-Zonen, ungeprueft)', D.every(d => d.metrics.hrZones.status === 'available' && d.metrics.hrZones.validation === 'unverified'));
  ok('R11 Runden/Bahnen: in keiner Einheit abgefragt (Zusatzabruf aus) — obwohl Garmin lapCount 1–14 meldet', D.every(d => d.metrics.laps.status === 'not_imported' && d.metrics.laps.reason === 'extras_disabled'));
  const P = SWIMS.map((_, i) => AA.analyze(swimRow(i)));
  ok('R12 Ansicht Becken: Puls, Bahnen, SWOLF, Zugfrequenz, Ruhezeit, Bahnlaenge · Freiwasser: Puls, Zugfrequenz, Ruhezeit, Tempo in Bewegung, Zuege, Strecke je Zug', P[5].cards.map(d => d.id).join() === 'avgHr,activeLengths,swolf,strokeRate,restTime,poolLength' && P[0].cards.map(d => d.id).join() === 'avgHr,strokeRate,restTime,pace100Moving,strokes,strokeDistance', P[5].cards.map(d => d.id).join() + ' | ' + P[0].cards.map(d => d.id).join());
  ok('R13 Diagramme: Becken nur Puls (Garmin liefert dort weder Tempo- noch Zugreihe); Freiwasser Tempo, Puls, Zugfrequenz', P[5].charts.map(c => c.id).join() === 'hr' && P[0].charts.map(c => c.id).join() === 'pace100,hr,strokeRate');
}

sec('O · andere Sportarten');
{
  const run = diagRun(GEN, 12, DIAG[12]);                       // 13.08.: 5,006 km, Timer 1418, verstrichen 1997
  const m = M(run), md = AA.analyze(run);
  ok('O1 Laufen: Distanz/Dauer gepruefter Wert, Tempo berechnet, aktive und verstrichene Zeit getrennt, Pause 579 s', m.distance.validation === 'validated' && m.paceKm.method === 'derived' && m.timer.value === 1418 && m.elapsed.value === 1997 && m.pause.value === 579);
  ok('O2 Laufen: Hauptkennzahl Distanz, Tempo /km', md.family === 'running' && md.hero[0].id === 'distance' && md.hero.some(d => d.id === 'paceKm'));
  const legacy = GEN.referenceActivity('running', 'legacy');
  ok('O3 Laufen Altimport: Kadenz gesperrt (Halbwert-Risiko), nicht angezeigt', M(legacy).runningCadence.validation === 'blocked' && !AA.analyze(legacy).cards.some(d => d.id === 'runningCadence'));
  const bike = GEN.referenceActivity('cycling', 'best'), bm = M(bike);
  ok('O4 Rad mit Leistungsmesser: Ø Leistung vorhanden (ungeprueft — Quellname nicht belegt), Leistungskurve aus Worker-Bestwerten', bm.avgPower.status === 'available' && bm.avgPower.validation === 'unverified' && bm.powerCurve.status === 'available');
  const nopw = GEN.referenceActivity('cycling', 'best'); delete nopw.metrics.streams.power; delete nopw.metrics.best_efforts.power; delete nopw.metrics.best_efforts.stats.power; nopw.summary.avgSpeedKmh = 28;
  const nm = M(nopw);
  ok('O5 Rad ohne Leistungsmesser: keine Wattzahl — nie aus der Geschwindigkeit', nm.avgPower.status === 'not_delivered' && nm.avgPower.reason === 'no_power_meter' && nm.avgSpeed.value === 28);
  const zw = GEN.referenceActivity('cycling', 'best'); zw.metrics.garmin.type_key = 'virtual_ride';
  ok('O6 Zwift/virtuell: Distanz und Geschwindigkeit als modelliert gekennzeichnet (ungeprueft)', M(zw).distance.reason === 'modeled_distance' && M(zw).avgSpeed.reason === 'modeled_distance');
  const gym = GEN.referenceActivity('gym', 'own');
  const gm = M(gym);
  ok('O7 Kraft (eigene Daten): Saetze und Volumen „validated" (eigene Angabe), Dauer eigene Angabe', gm.workingSets.validation === 'validated' && gm.volume.value === 8400 && gm.duration.reason === 'own_data');
  const gg = GEN.referenceActivity('gym', 'best');
  ok('O8 Kraft von Garmin: Volumen (Einheit unbelegt) gesperrt, nie angezeigt', M(gg).volume.validation === 'blocked' && M(gg).volume.value === null);
  const gc = AE.setManual(GEN.referenceActivity('gym', 'best'), 'duration', 4500).activity;
  ok('O9 Kraft: manuelle Dauer-Korrektur bleibt massgeblich (4500 s, manuell)', M(gc).duration.value === 4500 && M(gc).duration.method === 'manual');
  ok('O10 jede Kennzahl traegt id, Einheit, Status, Pruefstand, Methode und Quelle', Object.values(M(pool())).every(d => d.id && d.unit && ME.DESCRIBE_STATUSES.includes(d.status) && (d.status !== 'available' || (ME.DESCRIBE_VALIDATIONS.includes(d.validation) && d.method && d.source))));
}

sec('L · Leistungsregister und Bestzeiten unveraendert');
{
  const RUNS = DIAG.map((r, i) => diagRun(GEN, i, r));
  const st = L.update(null, RUNS, { timeZone: 'Europe/Berlin' }).state, best = k => L.currentBest(st.events[k]);
  ok('L1 Register auf den 15 echten Laeufen: 4:21 / 23:38 aktiv / 29:11 / 57:55 aktiv / 1:01:49 / 2:20:47', best('running.fastest_1000m@standard').value === 261 && best('running.fastest_5000m_active@standard').value === 1418 && best('running.fastest_5000m@standard').value === 1751
    && best('running.fastest_10000m_active@standard').value === 3475 && best('running.fastest_10000m@standard').value === 3709 && best('running.fastest_21098m@standard').value === 8447);
  const rb = RB.measuredRunBests(RUNS);
  ok('L2 Bestzeiten der App (Flag aus) unveraendert', rb.k1.sec === 261 && rb.k5.sec === 1751 && rb.active.k5.sec === 1418 && rb.k21.sec === 8447);
  const a = pool(), before = J(ME.overview(a));
  ME.describeActivity(a); AA.analyze(a);
  ok('L3 describeActivity aendert kein Urteil von evaluate() (Register-Pruefung) und keine Belege', J(ME.overview(a)) === before && ME.EVIDENCE['list.swim'] && Object.keys(ME.EVIDENCE['list.swim']).length === 0);
  ok('L4 Schwimmwerte bleiben fuer Langzeitauswertungen gesperrt (ledger=false), bis ein Vergleich mit Garmin Connect sie belegt', ['swolf', 'strokeRate', 'activeLengths'].every(k => M(pool())[k].ledger === false));
}

sec('U · Quelltext-Vertrag der Seite');
const ui = readFileSync(new URL(_APPREL + 'js/ui.js', import.meta.url), 'utf8'), de = readFileSync(new URL(_APPREL + 'locales/de.js', import.meta.url), 'utf8');
const store = readFileSync(new URL(_APPREL + 'js/activity-store.js', import.meta.url), 'utf8'), repo = readFileSync(new URL(_APPREL + 'js/repos/activityRepository.js', import.meta.url), 'utf8');
const html = readFileSync(new URL(_APPREL + 'index.html', import.meta.url), 'utf8'), sw = readFileSync(new URL(_APPREL + 'sw.js', import.meta.url), 'utf8');
ok('U1 Rohblock wird je Aktivitaet bei Bedarf gelesen (nur eigene Zeile) und nur im Arbeitsspeicher gehalten — der Speicher fuehrt ihn weiter nicht', /select\('id,ext:metrics->ext'\)\.eq\('user_id', b\.currentUserId\(\)\)\.eq\('id', id\)/.test(repo) && /SERVER_ONLY_METRIC_KEYS = \['ext'\]/.test(store) && /var _gmActExt=\{\}/.test(ui));
ok('U2 die Seite nutzt eine vorhandene Serverkopie, bevor sie nachlaedt', /_serverActivities\.find\(function\(x\)\{return x&&x\.id===id;\}\)/.test(ui));
const lits = [...new Set([...ui.matchAll(/'(aa\.[a-z0-9_.]+)'/gi)].map(m => m[1]))];
ok('U3 alle aa.*-Texte stehen in locales/de.js (keine zusammengesetzten Schluessel)', lits.length >= 100 && lits.every(k => de.includes("'" + k + "':")) && !/_uiT\('aa\.[a-z_.]*'\s*\+/.test(ui), lits.filter(k => !de.includes("'" + k + "':")).join(','));
ok('U4 Modul eingebunden und vorab gespeichert', /src="js\/engine\/activity-analysis\.js"/.test(html) && /'\.\/js\/engine\/activity-analysis\.js'/.test(sw));
ok('U5 Hauptansicht ohne technische Feldnamen (Messdetails eingeklappt; Formeln in Klartext)', !/ext\.fields|best_efforts|directSwimCadence/.test(de.slice(de.indexOf("'aa.m.environment'"), de.indexOf("'aa.md.foot'") + 200)) && /<details class="bts-md aa-md">/.test(ui));
ok('U6 interne Diagnose nur in der Konsole (ORVIA.activityDiagnose), nicht in der Oberflaeche', /window\.ORVIA\.activityDiagnose=gmActivityDiagnose/.test(ui) && !/onclick="[^"]*activityDiagnose/.test(ui));

console.log('\n' + (fail ? '❌' : '✅') + ' activity_analysis_v452: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
