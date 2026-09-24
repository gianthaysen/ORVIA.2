import fs from 'node:fs';
const f = 'supabase/tests/profile_v14_test.mjs'; let s = fs.readFileSync(f, 'utf8');
const anchor = `/* F · Verdrahtung */`; if (!s.includes(anchor)) throw new Error('F');
s = s.replace(anchor, `/* H · S1c (13.09., zweite Sichtpruefung): Saisonmodell mit Wochen, Profilstaerke-Karte bei 100 % weg, Schaetzquelle, rechte Werte */
{
  const sb = makeSb(); const PV = sb.ORVIA.screens.profileV14;
  const season = { model: 'season', totalWeeks: 13, weeksToRace: 5, daysTo: 35, targetDate: '2026-10-18', phases: [
    { key: 'base', n: 'Basis', weeks: 4, on: false, done: true, week: null }, { key: 'build', n: 'Aufbau', weeks: 4, on: true, done: false, week: 4 },
    { key: 'peak', n: 'Spitze', weeks: 3, on: false, done: false, week: null }, { key: 'taper', n: 'Tapering', weeks: 2, on: false, done: false, week: null }] };
  const h = PV.overviewHTML(baseData({ season }));
  ok('H1 Saison (Wochenmodell): „Aufbauphase · Woche 4 von 4", Basis „4 Wo · fertig", Spitze „3 Wo", Wettkampfdatum in der Quelle', /Aufbauphase · Woche 4 von 4/.test(h) && /pv-phase done"><b>Basis<\\/b><span>4 Wo · fertig/.test(h) && /<b>Spitze<\\/b><span>3 Wo</.test(h) && /Wettkampf 18\\.10\\.2026 \\(in 35 Tagen\\)/.test(h));
  ok('H2 Profil & Kontrolle: „3 aktiv" rechts, Provider rechts, Sync-Rest in der Zeile', /p-v">3 aktiv</.test(h));
  const h2 = makeSb({ gmProfSyncLabel: () => 'Garmin · vor 4 Min synchronisiert' }).ORVIA.screens.profileV14.overviewHTML(baseData({ season }));
  ok('H3 Geraete & Daten: Provider als rechter Wert, Rest als Untertitel', /p-d">vor 4 Min synchronisiert</.test(h2) && /p-v">Garmin</.test(h2));
  ok('H4 Profilstaerke-Karte nur bei Luecken: 100 % ohne Luecken ⇒ keine Karte; 80 % ⇒ Karte', PV.strengthNeedsCard({ score: 100, gaps: [] }) === false && PV.strengthNeedsCard({ score: 80, gaps: [{}] }) === true && PV.strengthNeedsCard({ score: 100, gaps: [{}] }) === true);
  const p = PV.performanceHTML(baseData({ bests: { t5: 1414, t10: 3270, t21: 8413, t42: 17537, real: { k5: 1, k10: 1, k21: 1 }, estFrom: { k42: 'k21' }, meas: { k21: { date: '2026-09-06' } } } }));
  ok('H5 Marathon-Schaetzung benennt ihre Quelle („geschätzt aus HM")', /4:52:17/.test(p) && /geschätzt aus HM \\(Riegel\\)/.test(p));
}
/* F · Verdrahtung */`);
s = s.replace("ok('F2 Modul in index.html (nach goal-detail.js) und im SW-Vorrat', idx.indexOf('js/screens/profile-v14.js') > idx.indexOf('js/goal-detail.js') && sw.indexOf(\"'./js/screens/profile-v14.js'\") > 0);",
  "ok('F2 Modul in index.html (nach goal-detail.js) und im SW-Vorrat; season-phases ebenso', idx.indexOf('js/screens/profile-v14.js') > idx.indexOf('js/goal-detail.js') && sw.indexOf(\"'./js/screens/profile-v14.js'\") > 0 && idx.indexOf('js/engine/season-phases.js') > 0 && sw.indexOf(\"'./js/engine/season-phases.js'\") > 0);");
fs.writeFileSync(f, s);

fs.writeFileSync('supabase/tests/season_phases_test.mjs', `/* ORVIA · engine/season-phases — Saisonphasen mit Wochen (S1c, 13.09.2026)
   node supabase/tests/season_phases_test.mjs */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const APP = ['../../app/', '../../'].map(p => new URL(p, import.meta.url)).find(u => existsSync(new URL('js/engine/season-phases.js', u)));
const S = require(new URL('js/engine/season-phases.js', APP).pathname);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const a = S.allocate(52);
ok('52 Wochen: Tapering 2, Spitze 4, Rest 46 → Basis 21 / Aufbau 25', JSON.stringify(a.map(p => [p.key, p.weeks])) === JSON.stringify([['base', 21], ['build', 25], ['peak', 4], ['taper', 2]]));
ok('12 Wochen: Tapering 2, Spitze 3, Basis 3 / Aufbau 4', JSON.stringify(S.allocate(12).map(p => p.weeks)) === JSON.stringify([3, 4, 3, 2]));
ok('7 Wochen: Tapering 1, Spitze 2, nur Aufbau 4 (kein Basis unter 5 Restwochen)', JSON.stringify(S.allocate(7).map(p => [p.key, p.weeks])) === JSON.stringify([['build', 4], ['peak', 2], ['taper', 1]]));
ok('3 Wochen: nur Aufbau', JSON.stringify(S.allocate(3).map(p => p.key)) === JSON.stringify(['build']));

const m = S.seasonPhases('2027-09-05', '2026-09-13', { startDate: '2026-09-12' });
ok('Marathon 05.09.2027 ab 12.09.2026: 52 Wochen, 357 Tage, aktuelle Phase Basis Woche 1 von 21', m.totalWeeks === 52 && m.daysToRace === 357 && m.current.key === 'base' && m.current.week === 1 && m.current.weeks === 21);
ok('Phasen luecken- und ueberlappungsfrei, letzte endet am Renntag', m.phases.every((p, i) => i === 0 || new Date(p.from) - new Date(m.phases[i - 1].to) === 864e5) && m.phases[m.phases.length - 1].to === '2027-09-05');
const h = S.seasonPhases('2026-10-18', '2026-09-13', { startDate: '2026-07-26' });
ok('HM 18.10. ab 26.07.: Aufbau Woche 4 von 4 aktiv, Basis fertig, Spitze/Tapering offen', h.current.key === 'build' && h.current.week === 4 && h.phases[0].done === true && h.phases[2].done === false);
ok('Planstart in der Zukunft wird auf heute gekappt; ohne Start = heute', S.seasonPhases('2026-12-01', '2026-09-13', { startDate: '2026-10-01' }).startDate === '2026-09-13' && S.seasonPhases('2026-12-01', '2026-09-13').startDate === '2026-09-13');
ok('Vergangenes oder fehlendes Zieldatum ⇒ null', S.seasonPhases('2026-09-01', '2026-09-13') === null && S.seasonPhases(null, '2026-09-13') === null);
ok('Renntag selbst: aktuelle Phase ist die letzte (Tapering), Woche = Dauer', (() => { const r = S.seasonPhases('2026-09-13', '2026-09-13', { startDate: '2026-06-01' }); return r.current.key === 'taper' && r.current.week === r.current.weeks; })());
console.log('\\nseason_phases: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
`);

const z = 'supabase/tests/performance_zones_test.mjs'; let zt = fs.readFileSync(z, 'utf8');
const zend = zt.lastIndexOf('\nconsole.log('); if (zend < 0) throw new Error('zones end');
zt = zt.slice(0, zend) + `
/* v3 (S1c): Referenzwahl nach Naehe zur 60-Minuten-Belastung innerhalb der belastbaren Gruppe */
{
  const r = Z.resolve({ today: '2026-09-13', races: [
    { distanceKm: 5, durationMin: 23.57, date: '2026-08-13', kind: 'test' },
    { distanceKm: 10, durationMin: 54.5, date: '2026-08-09', kind: 'test' },
    { distanceKm: 21.0975, durationMin: 140.2, date: '2026-09-06', kind: 'test' }] });
  ok('v3 Referenz: 10 km (54:30) statt des 7 Tage juengeren HM (2:20) — Schwelle 5:29/km, HM-Aequivalent 2:00', r.reference.distanceKm === 10 && r.thresholdPaceSecPerKm === 329 && Math.round(r.halfMarathonEquivalentMin) === 120);
  const r2 = Z.resolve({ today: '2026-09-13', races: [
    { distanceKm: 10, durationMin: 54.5, date: '2025-01-09', kind: 'test' },
    { distanceKm: 21.0975, durationMin: 140.2, date: '2026-09-06', kind: 'race' }] });
  ok('v3 ausserhalb der 80-%-Gruppe bleibt die Gewichtung: alter 10er (Frische 0,5) verliert gegen frischen Wettkampf-HM', r2.reference.distanceKm > 21);
}
` + zt.slice(zend);
fs.writeFileSync(z, zt);
console.log('tests written');
