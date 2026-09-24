const fs=require('fs');const F='supabase/tests/strength_profile_test.mjs';let s=fs.readFileSync(F,'utf8');
const marker = "console.log('\\nstrength_profile: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');";
if(s.indexOf(marker)<0) throw new Error('marker');
const add = `sec('F · v8-389 — Trend statt Fensterrand, Ausbelastung, Zusatzlast, Gruppen');
{
  const PM = require(join(APP, 'js/profile-model.js'));

  /* F1 Gewichtsreihe: Morgenwert gewinnt am selben Tag, Aufloesung ist tagesgenau. */
  const wser = PM.weightSeries({ weightHistory: [{ valueKg: 80, measuredAt: '2026-06-01' }, { valueKg: 79, measuredAt: '2026-07-01' }] },
    [{ date: '2026-07-01', kg: 78.2 }, { date: '2026-08-01', kg: 77.4 }]);
  ok('F1 Reihe sortiert, Morgenwert schlägt Profilwert am selben Tag',
    wser.length === 3 && wser[1].date === '2026-07-01' && wser[1].kg === 78.2 && wser[1].source === 'morning');
  ok('F2 bodyweightAt nimmt den letzten Wert DAVOR, nicht den heutigen',
    PM.bodyweightAt('2026-07-20', wser).kg === 78.2 && PM.bodyweightAt('2026-08-15', wser).kg === 77.4);
  ok('F3 vor dem ersten Eintrag: naher Folgewert ja, ferner nein',
    PM.bodyweightAt('2026-05-25', wser).kg === 80 && PM.bodyweightAt('2026-01-01', wser) === null);

  /* F4 Trend: Steigung je 4 Wochen statt Abstand zum Fensterrand. */
  const mSq = MODEL('Kniebeuge');
  ok('F4 Trend vorhanden mit Punkten und Spanne',
    !!(mSq.trend && mSq.trend.ok && mSq.trend.points >= 3 && mSq.trend.spanDays >= 21), JSON.stringify(mSq.trend));
  ok('F5 Steigung positiv und in der Groessenordnung der echten Progression (+2,5 kg/Woche Last)',
    mSq.trend.per4Weeks > 5 && mSq.trend.per4Weeks < 20, 'per4Weeks=' + mSq.trend.per4Weeks);

  /* F6 Ausreisser am Fensterrand darf die Aussage nicht drehen. */
  const flat = [];
  for (let i = 0; i < 6; i++) flat.push({ workoutId: 'f' + i, startedAt: d(i) + 'T18:00:00Z',
    exercises: [{ exerciseNameSnapshot: 'Brustpresse', sets: [{ completed: true, weight: i === 0 ? 70 : 80, reps: 10 }, { completed: true, weight: i === 0 ? 70 : 80, reps: 9 }] }] });
  const mFlat = S.build(flat, { today: d(5), gymVolume: GV, strengthProgression: SPG }).exerciseModel('brustpresse');
  ok('F6 Rohdifferenz behauptet Fortschritt (alter Weg)', mFlat.delta && mFlat.delta.kg > 10, 'delta=' + JSON.stringify(mFlat.delta));
  ok('F7 Steigung bleibt klein — ein einzelner tiefer Randpunkt ist kein Trend',
    mFlat.trend.ok && Math.abs(mFlat.trend.per4Weeks) < 8, 'per4Weeks=' + mFlat.trend.per4Weeks);

  /* F8 Fenster haengt am letzten Datenpunkt, nicht am Kalendertag. */
  const mStale = S.build(flat, { today: '2026-11-01', gymVolume: GV, strengthProgression: SPG }).exerciseModel('brustpresse');
  ok('F8 nach langer Pause bleiben die Punkte im Fenster (Pause ist keine Trendaenderung)',
    mStale.trend.ok && mStale.trend.points === mFlat.trend.points, JSON.stringify(mStale.trend));
  ok('F9 … und die Pause wird als solche ausgewiesen', mStale.staleDays > 80, 'staleDays=' + mStale.staleDays);

  /* F10 Stagnation an der Steigung. */
  const mBench = MODEL('bankdruecken') || MODEL('Bankdrücken');
  ok('F10 konstante Last über 10 Einheiten gilt als Stagnation', mBench.stagnant === true, 'by=' + mBench.stagnantBy);

  /* F11 Ausbelastung: Vertrauensgrad. */
  ok('F11 ohne RIR ist das Vertrauen der Steigung niedrig',
    mFlat.trend.confidence === 'low' && mFlat.effortKnown === 0, JSON.stringify({ c: mFlat.trend.confidence, k: mFlat.effortKnown }));
  ok('F12 mit RIR an jedem Punkt ist es ok', mBench.trend && mBench.trend.confidence === 'ok', JSON.stringify(mBench.trend));

  /* F13 unplausibler Sprung (Geraetewechsel) wird benannt statt als Fortschritt gezeigt. */
  const jump = [];
  for (let i = 0; i < 5; i++) jump.push({ workoutId: 'j' + i, startedAt: d(i) + 'T18:00:00Z',
    exercises: [{ exerciseNameSnapshot: 'Trizepsdrücken', sets: [{ completed: true, weight: i < 2 ? 35 : 17.5, reps: 8 }] }] });
  const mJump = S.build(jump, { today: d(4), gymVolume: GV, strengthProgression: SPG }).exerciseModel('trizepsdruecken');
  ok('F13 Sprung über 15 % je 4 Wochen gilt als unplausibel', mJump.trend.ok && mJump.trend.implausible === true, 'per4Weeks=' + mJump.trend.per4Weeks);

  /* F14/F15 Koerpergewichtsuebung mit wechselnder Zusatzlast. */
  const pu = [];
  const puPlan = [[null, 12], [null, 14], [10, 7], [10, 9]];
  puPlan.forEach((p, i) => pu.push({ workoutId: 'p' + i, startedAt: d(i) + 'T18:00:00Z',
    exercises: [{ exerciseNameSnapshot: 'Klimmzüge', sets: [{ completed: true, weight: p[0], reps: p[1] }, { completed: true, weight: p[0], reps: p[1] - 1 }] }] }));
  const mPu = S.build(pu, { today: d(3), gymVolume: GV, strengthProgression: SPG, bodyweightSeries: [{ date: '2026-05-01', kg: 71 }] }).exerciseModel('klimmzuege');
  ok('F14 Delta nur bei GLEICHER Zusatzlast (+10 kg: 7 → 9 Wdh.)',
    mPu.delta && mPu.delta.reps === 2 && mPu.delta.addedKg === 10, JSON.stringify(mPu.delta));
  ok('F15 Wdh.-Rekorde getrennt je Zusatzlast (14 ohne Zusatz, 9 mit +10 kg)',
    mPu.prs.filter(p => p.kind === 'max_reps').length === 2 &&
    mPu.prs.some(p => p.addedKg === 0 && p.value === 14) && mPu.prs.some(p => p.addedKg === 10 && p.value === 9),
    JSON.stringify(mPu.prs.map(p => p.value + '@' + p.addedKg)));
  const puMixed = pu.slice(0, 3);
  const mMix = S.build(puMixed, { today: d(2), gymVolume: GV, strengthProgression: SPG }).exerciseModel('klimmzuege');
  ok('F16 Lastwechsel ohne Vergleichspunkt: kein Delta, sondern der Grund',
    mMix.delta == null && mMix.deltaBlocked === 'load_changed', JSON.stringify({ d: mMix.delta, b: mMix.deltaBlocked }));

  /* F17 Test-Satz nur als 1RM-Test, wenn er den besten Arbeitssatz uebertrifft. */
  const lightTest = [];
  for (let i = 0; i < 3; i++) lightTest.push({ workoutId: 'lt' + i, startedAt: d(i) + 'T18:00:00Z',
    exercises: [{ exerciseNameSnapshot: 'Seitheben', sets: [{ completed: true, weight: 12.5, reps: 10 }, { completed: true, setType: 'test', weight: 7.5, reps: 8 }] }] });
  const mLt = S.build(lightTest, { today: d(2), gymVolume: GV, strengthProgression: SPG }).exerciseModel('seitheben');
  ok('F17 leichter „test"-Satz ist kein 1RM-Test', !mLt.prs.some(p => p.kind === 'test') && mLt.lastTest == null);
  ok('F18 schwerer Test-Satz bleibt ein 1RM-Test', MODEL('Kniebeuge').prs.some(p => p.kind === 'test' && p.value === 90));

  /* F19 Gruppe folgt dem direkt belasteten Muskel. */
  const be = [{ workoutId: 'be', startedAt: d(0) + 'T18:00:00Z',
    exercises: [{ exerciseNameSnapshot: 'Rückenstrecker', slug: 'back_extension',
      muscles: { lower_back: { weight: 1, involvement: 'direct' }, glutes: { weight: 0.6, involvement: 'indirect' }, hamstrings: { weight: 0.5, involvement: 'indirect' } },
      sets: [{ completed: true, weight: 25, reps: 10 }] }] }];
  const mBe = S.build(be, { today: d(0), gymVolume: GV, strengthProgression: SPG });
  ok('F19 Rückenstrecker zählt zu Rumpf, nicht zu Beinen (direkt schlägt Summe indirekter)',
    mBe.exercises[0].group === 'core', 'group=' + mBe.exercises[0].group);
  ok('F20 null Beinsätze bei belegter Oberkörperarbeit: Verhältnis 0 mit Hinweis, nicht „zu wenig Daten"',
    mBe.balance.legsUpper.ratio === 0 && mBe.balance.legsUpper.zero === true && mBe.balance.legsUpper.status === 'att',
    JSON.stringify(mBe.balance.legsUpper));

  /* F21 Oberflaeche zeigt die neuen Aussagen. */
  const scr = readFileSync(join(APP, 'js/screens/strength-profile.js'), 'utf8');
  ok('F21 Kopfzahl ist die Steigung, Basis/Ausbelastung/Pause werden gezeigt',
    /kp\\.kg_je_4w/.test(scr) && /kp\\.trend_basis/.test(scr) && /kp\\.effort_d/.test(scr) && /kp\\.stale_d/.test(scr) && /kp\\.reps_last_gewechselt/.test(scr));
  ok('F22 Körpergewicht kommt aus dem Morgenbericht (Reihe), nicht nur aus dem Profil',
    /morningWeightSeries/.test(scr) && /bodyweightSeries/.test(scr));
}

`;
s=s.replace(marker, add+marker);
fs.writeFileSync(F,s); console.log('ok');
