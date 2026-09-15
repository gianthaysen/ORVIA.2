/* ORVIA · strength_profile — S2 Kraftprofil: Engine (rein) + Screen + Verdrahtung
   node supabase/tests/strength_profile_test.mjs */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')].find(p => existsSync(join(p, 'js', 'engine', 'strength-profile.js'))) || _flat);
require(join(APP, 'js/i18n.js')); require(join(APP, 'locales/de.js'));
const GV = require(join(APP, 'js/gym-volume.js'));
const SPG = require(join(APP, 'js/engine/strength-progression.js'));
const S = require(join(APP, 'js/engine/strength-profile.js'));
require(join(APP, 'js/screens/strength-profile.js'));
const SCR = globalThis.ORVIA.strengthProfileScreen;
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

/* Fixture: 10 Wochen Kniebeuge (+2,5 kg/Wo), Bank konstant (Stagnation), Klimmzüge (Körpergewicht), Plank (Zeit), Beinpresse 3× (unter Schwelle) */
function d(i) { return new Date(Date.UTC(2026, 5, 1) + i * 7 * 864e5).toISOString().slice(0, 10); }
function sess(i, squatW) {
  const ex = [
    { exerciseNameSnapshot: 'Kniebeuge', sets: [{ completed: true, setType: 'warmup', weight: 40, reps: 8 }].concat([1, 2, 3, 4].map(n => ({ completed: true, setType: 'working', weight: squatW, reps: 6, rir: 2, setNumber: n }))) },
    { exerciseNameSnapshot: 'Bankdrücken', sets: [{ completed: true, weight: 60, reps: 5, rir: 1 }, { completed: true, weight: 60, reps: 5, rir: 1 }, { completed: true, weight: 60, reps: 5, rir: 0 }] },
    { exerciseNameSnapshot: 'Rudern LH', sets: [{ completed: true, weight: 50, reps: 8 }, { completed: true, weight: 50, reps: 8 }, { completed: true, weight: 50, reps: 7 }] },
    { exerciseNameSnapshot: 'Klimmzüge', sets: [{ completed: true, reps: 8 + (i > 5 ? 1 : 0) }, { completed: true, reps: 7 }] },
    { exerciseNameSnapshot: 'Plank', sets: [{ completed: true, durationS: 60 + i * 5 }] }
  ];
  if (i < 3) ex.push({ exerciseNameSnapshot: 'Beinpresse', sets: [{ completed: true, weight: 150, reps: 10 }] });
  return { workoutId: 'w' + i, startedAt: d(i) + 'T18:00:00Z', exercises: ex };
}
const SNAPS = []; for (let i = 0; i < 10; i++) SNAPS.push(sess(i, 60 + i * 2.5));
SNAPS[3].exercises[0].sets.push({ completed: true, setType: 'test', weight: 90, reps: 1 });
const TODAY = '2026-08-04'; /* Dienstag nach der 10. Einheit (03.08.) */
const OPTS = { today: TODAY, gymVolume: GV, strengthProgression: SPG, bodyweightKg: 75, experience: 'intermediate',
  goals: [{ id: 'g1', title: 'Kniebeuge 120 kg', category: 'lift_pr', targetValue: 120, status: 'active', targetDate: '2026-12-01' }, { id: 'g2', title: 'Halbmarathon', category: 'half_marathon', targetValue: 6600, status: 'active' }] };

sec('A · e1RM');
ok('A1 Epley 72,5 kg × 6 = 87 kg', S.e1rm(72.5, 6).value === 87 && S.e1rm(72.5, 6).method === 'epley');
ok('A2 RIR eingerechnet: 72,5 × 6 @ RIR 2 = 91,8 (8 effektive Wdh.)', S.e1rm(72.5, 6, 2).value === 91.8 && S.e1rm(72.5, 6, 2).method === 'epley_rir');
ok('A3 Kappung: > 12 effektive Wdh. ⇒ keine Schätzung', S.e1rm(50, 12, 3).value === null && S.e1rm(50, 12, 3).reason === 'reps_over_cap' && S.e1rm(50, 12).value === 70);
ok('A4 ohne Gewicht/Wdh. ⇒ no_data', S.e1rm(0, 5).reason === 'no_data' && S.e1rm(60, 0).reason === 'no_data');

sec('B · Übungen, Gruppen, Serie');
const m = S.build(SNAPS, OPTS);
const byName = n => m.exercises.filter(e => e.name === n)[0];
ok('B1 Gruppen aus gym-volume-Mapping: Kniebeuge→Beine, Bank→Druck, Rudern→Zug, Plank→Rumpf', byName('Kniebeuge').group === 'legs' && byName('Bankdrücken').group === 'push' && byName('Rudern LH').group === 'pull' && byName('Plank').group === 'core');
ok('B2 Schwelle 6 Einheiten: Kniebeuge ready, Beinpresse (3) nicht', byName('Kniebeuge').ready === true && byName('Beinpresse').ready === false && byName('Beinpresse').count === 3);
const sq = m.exerciseModel(byName('Kniebeuge').key);
ok('B3 Serie = ein Punkt je Einheit (10), Aufwärmsatz zählt nicht, e1RM RIR-korrigiert (82,5×6@2 → 104,5)', sq.series.length === 10 && sq.current === 104.5 && sq.method === 'epley_rir');
ok('B4 Δ im 12-Wochen-Fenster: +28,5 kg in 9 Wochen', sq.delta && sq.delta.kg === 28.5 && sq.delta.weeks === 9);
ok('B5 1RM-Test als Marker (22.06., 90 kg) und als PR', sq.series[3].test === true && sq.series[3].testWeight === 90 && sq.prs.some(p => p.kind === 'test' && p.value === 90) && sq.lastTest.weight === 90);
ok('B6 PRs: bester Satz 104,5 e1RM, schwerstes Gewicht 82,5 kg, Volumen-Woche vorhanden', sq.prs.some(p => p.kind === 'best_set' && p.value === 104.5) && sq.prs.some(p => p.kind === 'heaviest' && p.value === 82.5) && sq.prs.some(p => p.kind === 'volume_week' && p.value > 0));
ok('B7 Historie: letzte 6 Einheiten, neueste zuerst, Δ zur Vor-Einheit +3,2', sq.history.length === 6 && sq.history[0].date === '2026-08-03' && sq.history[0].delta === 3.2 && /4×6 @ 82,5 kg · RIR 2/.test(sq.history[0].scheme));
ok('B8 relative Kraft 104,5 / 75 = 1,39', sq.relative === 1.39);
const bp = m.exerciseModel(byName('Bankdrücken').key);
ok('B9 Stagnation über strength-progression: Bank 10× gleich ⇒ stagnant, Kniebeuge nicht', bp.stagnant === true && sq.stagnant === false);
const pu = m.exerciseModel(byName('Klimmzüge').key);
ok('B10 Körpergewichtsübung ohne Zusatzlast: Modus reps (Wdh.-Rekord ist die Kurve), Schema „2×7–8", relative Kraft entfällt', pu.mode === 'reps' && pu.bodyweight === true && pu.current === 9 && /2×7–9|2×7–8/.test(pu.lastScheme) && pu.relative === null);
const pl = m.exerciseModel(byName('Plank').key);
ok('B11 Halteübung: Modus time, längste Haltezeit 105 s', pl.mode === 'time' && pl.current === 105 && pl.prs[0].kind === 'max_hold');
const lp = m.exerciseModel(byName('Beinpresse').key);
ok('B12 Leerzustand unter Schwelle: count 3, ready false, bisher bester Satz trotzdem bekannt', lp.ready === false && lp.count === 3 && lp.current === 200);

sec('C · Gruppen, Korridor, Balance, Ziel');
ok('C1 Tonnage: aktuelle Woche (03.08.) Beine 4×6×82,5 = 1980, 4-W-Schnitt > 0', m.groups.legs.tonnageWeek === 1980 && m.groups.legs.tonnageAvg4 > 0 && m.groups.push.tonnageWeek === 900);
ok('C2 harte Sätze 28 Tage: Beine 16, Druck 12, Zug 20 (Rudern + Klimmzüge), Rumpf 4', m.groups.legs.sets28 === 16 && m.groups.push.sets28 === 12 && m.groups.pull.sets28 === 20 && m.groups.core.sets28 === 4);
ok('C3 Balance auf Satzbasis: Druck:Zug 0,6 att (Zug dominiert) · Beine:Oberkörper 0,5 att', m.balance.pushPull.ratio === 0.6 && m.balance.pushPull.status === 'att' && m.balance.legsUpper.ratio === 0.5 && m.balance.legsUpper.status === 'att');
const mi = S.build(SNAPS, Object.assign({}, OPTS, { injury: { active: true, label: 'Knie links', stage: 0, policy: { legStrength: false } } }));
ok('C4 Beschwerden-Kopplung: Injury-Lead ohne Beinkraft ⇒ Beine:Oberkörper blocked, Label + Stufe', mi.balance.legsUpper.status === 'blocked' && mi.balance.legsUpper.injuryLabel === 'Knie links' && mi.balance.legsUpper.injuryStage === 0);
ok('C5 Muskelzeilen aus gym-volume (7 Tage): Quadrizeps 4 effektive Sätze, Korridor intermediate 6–12 ⇒ under', (() => { const r = m.muscles.rows.filter(x => x.muscle === 'quads')[0]; return r && r.effective === 4 && r.min === 6 && r.max === 12 && r.status === 'under'; })());
ok('C6 dataWeeks < 2 ⇒ kein Korridor (insufficient_data)', (() => { const m2 = S.build(SNAPS.slice(-1), OPTS); return m2.muscles.corridor.min === null && m2.muscles.rows.every(r => r.status === 'none'); })());
const g = m.strengthGoals.filter(x => x.goalId === 'g1')[0];
ok('C7 Kraftziel erkannt (lift_pr), Übung über Titel gematcht, HM-Ziel ignoriert', m.strengthGoals.length === 1 && g.exerciseName === 'Kniebeuge');
ok('C8 Prognose: Regression ≈ +12,7 kg/4 Wo, Lücke 15,5 kg, ETA vor Richtwert ⇒ onTrack', g.forecast && g.forecast.slopePer4w > 12 && g.forecast.slopePer4w < 13.5 && g.forecast.gap === 15.5 && g.forecast.onTrack === true && /^2026-09/.test(g.forecast.eta));
ok('C9 Prognose ehrlich: Bank (flach) ⇒ reason flat; < 6 Punkte ⇒ insufficient', S.goalForecast(bp, { targetValue: 100 }, { today: TODAY }).reason === 'flat' && S.goalForecast(lp, { targetValue: 300 }, { today: TODAY }).reason === 'insufficient');
ok('C10 erreicht: Ziel unter aktuellem e1RM ⇒ reached', S.goalForecast(sq, { targetValue: 100 }, { today: TODAY }).reached === true);

sec('C2 · Pausenwoche, Fenster, relative Kraft (v8-385)');
{
  const mi2 = S.build(SNAPS, Object.assign({}, OPTS, { today: '2026-08-20' }));
  ok('C11 laufende Woche ohne Einheit: weekHasSets false, letzte Trainingswoche 03.08. (Mo 03.08.–So 09.08.)', mi2.groups._meta.weekHasSets === false && mi2.groups._meta.lastWeekStart === '2026-08-03' && mi2.groups.legs.tonnageLast === 1980);
  ok('C12 Balance-Fenster: nur 2 Einheiten in 28 Tagen ⇒ 56-Tage-Fenster mit 6 Einheiten', mi2.balance.windowDays === 56 && mi2.balance.sessions === 6 && m.balance.windowDays === 28);
  ok('C13 relative Kraft nur an Langhantel-Grundbewegungen (Kniebeuge ja, Bankdrücken ja, Rudern LH nein)', sq.relative === 1.39 && bp.relative != null && m.exerciseModel(byName('Rudern LH').key).relative === null);
  SCR._state.grp = 'legs'; SCR._state.ex = byName('Kniebeuge').key; SCR._state.pt = null;
  const hi = SCR.body(mi2);
  ok('C14 Screen in Pausenwoche: Muskelkarte nur Hinweis (kein „unter dem Korridor"), Tonnage zeigt letzte Trainingswoche, Balance nennt Fenster', /Diese Woche noch keine Krafteinheit/.test(hi) && !/unter dem Korridor/.test(hi) && /Tonnage · Woche 03\.08\.–09\.08\./.test(hi) && /56 Tage · 6 Einheiten/.test(hi));
  ok('C15 Monatsmarken an echter Position (absolute Labels)', /kp-xlbl-abs/.test(hi) && /style="left:0\.0%">Jun</.test(hi));
}
ok('C16 Platzhalter „Krafttraining (ohne Übungsdetail)" wird nicht als Übung geführt', S.build([{ workoutId: 'x', startedAt: '2026-07-01T10:00:00Z', exercises: [{ exerciseNameSnapshot: 'Krafttraining (ohne Übungsdetail)', sets: [{ completed: true, reps: null, weight: null }] }] }], OPTS).exercises.length === 0);
sec('D · Screen (rein, HTML)');
{
  SCR._state.grp = null; SCR._state.ex = null; SCR._state.pt = null;
  const html = SCR.body(m);
  ok('D1 Filter: Gruppen + Übungen, nicht-bereite Übung mit Punkt', /data-a="kpgrp" data-v="legs"/.test(html) && /data-a="kpex"[^>]*>Beinpresse ·</.test(html));
  ok('D2 Default = Übung mit den meisten Einheiten: Übungskarte mit e1RM-Hero, Kurve mit 10 Punkten, Test-Marker', /kp-hero/.test(html) && (html.match(/class="kp-pt/g) || []).length === 10 && /kp-pt test/.test(html) && /data-gm-slot="strength-exercise"/.test(html));
  ok('D3 Karten: Bestwerte, Letzte Einheiten, Sätze je Muskel (Slot), Ziel (Slot), Tonnage (Slot), Balance (Slot)', /Bestwerte/.test(html) && /Letzte Einheiten/.test(html) && /data-gm-slot="strength-muscles"/.test(html) && /data-gm-slot="strength-goal"/.test(html) && /data-gm-slot="strength-tonnage"/.test(html) && /data-gm-slot="strength-balance"/.test(html));
  ok('D4 Balance-Befund Beine unterversorgt mit konkretem Vorschlag', /Beine unterversorgt/.test(html) && /Ausfallschritte/.test(html));
  SCR._state.ex = byName('Beinpresse').key;
  const h2 = SCR.body(m);
  ok('D5 Leerzustand unter Schwelle: „Noch keine Kurve", 3 / 6 Einheiten, keine PR-/Historienkarte', /Noch keine Kurve/.test(h2) && /3 \/ 6 Einheiten/.test(h2) && !/Letzte Einheiten/.test(h2));
  SCR._state.grp = 'push'; SCR._state.ex = null;
  const h3 = SCR.body(m);
  ok('D6 Stagnations-Badge + Deload-Hinweis bei Bank', /Stagnation<\/span>/.test(h3) && /Deload/.test(h3));
  SCR._state.grp = null; SCR._state.ex = null;
  const h4 = SCR.body(mi);
  ok('D7 Mit Knie-Constraint: Balance nennt „Beine wegen Knie links ausgesetzt (Stufe 1)" statt Vorschlag', /Beine wegen Knie links ausgesetzt \(Rückkehr-Leiter Stufe 1\)/.test(h4) && !/Ausfallschritte 3×10/.test(h4));
  const h5 = SCR.body(S.build([], OPTS));
  ok('D8 Ohne Krafteinheit: Leerzustand mit „Training starten"', /Noch keine Krafteinheit geloggt/.test(h5) && /data-a="kpstart"/.test(h5));
  const bad = (html + h2 + h3 + h4 + h5).match(/kp\.[a-z0-9_]+/g) || [];
  ok('D9 keine unaufgelösten kp.*-Schlüssel im HTML', bad.length === 0, bad.slice(0, 5).join(','));
  /* Niveau-Vertrag */
  SCR._state.grp = 'legs'; SCR._state.ex = byName('Kniebeuge').key; SCR._state.pt = null;
  globalThis.gmLevel = () => 'a'; const ha = SCR.body(m);
  ok('D10 Anfänger: kein e1RM/RIR/Korridor-Jargon, keine Historie/Muskelzeilen/Tonnage, Balance nur als Satz', !/e1RM|RIR|Korridor/.test(ha) && !/Letzte Einheiten/.test(ha) && !/strength-muscles/.test(ha) && !/strength-tonnage/.test(ha) && /strength-balance/.test(ha) && !/kp-duo/.test(ha) && /geschätztes Maximum/.test(ha) && /Beine unterversorgt/.test(ha));
  globalThis.gmLevel = () => 'f'; const hf = SCR.body(m);
  ok('D11 Fortgeschritten: alles außer relativer Kraft', /Letzte Einheiten/.test(hf) && /strength-muscles/.test(hf) && /kp-duo/.test(hf) && !/Körpergewicht/.test(hf));
  globalThis.gmLevel = () => 'p'; const hp = SCR.body(m);
  ok('D12 Profi: relative Kraft + Methode (RIR eingerechnet)', /× Körpergewicht/.test(hp) && /RIR eingerechnet/.test(hp));
  delete globalThis.gmLevel;
}

sec('E · Verdrahtung');
{
  const ui = readFileSync(join(APP, 'js/ui.js'), 'utf8'), pv = readFileSync(join(APP, 'js/screens/profile-v14.js'), 'utf8'), gd = readFileSync(join(APP, 'js/goal-detail.js'), 'utf8'), idx = readFileSync(join(APP, 'index.html'), 'utf8'), sw = readFileSync(join(APP, 'sw.js'), 'utf8'), css = readFileSync(join(APP, 'styles.css'), 'utf8');
  ok('E1 Analyse · Körper: Teaser-Karte (Slot analysis-strength) öffnet openStrengthProfile()', /function gmStrengthTeaserHTML/.test(ui) && /data-gm-slot="analysis-strength"/.test(ui) && /h\+=gmStrengthTeaserHTML\(\)/.test(ui));
  ok('E2 Profil · Leistung · Kraftwerte → Kraftprofil', /openStrengthProfile\(\)/.test(pv));
  ok('E3 Ziel-Detail: Kraftziel → Zeile „Kraftprofil" mit goalTitle', /gd-strength/.test(gd) && /openStrengthProfile\(\{ goalTitle/.test(gd));
  ok('E4 Skripte in index.html (Engine vor Screen) + sw.js', idx.indexOf('js/engine/strength-profile.js') > 0 && idx.indexOf('js/engine/strength-profile.js') < idx.indexOf('js/screens/strength-profile.js') && sw.includes('./js/engine/strength-profile.js') && sw.includes('./js/screens/strength-profile.js'));
  ok('E5 CSS-Block kp-* vorhanden', /\.kp-hero\{/.test(css) && /\.kp-crow/.test(css) && /\.kp-duo/.test(css));
}
console.log('\nstrength_profile: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
if (fail) process.exit(1);
