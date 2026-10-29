/* ============================================================
   ORVIA · K2 (2026-10-29) — EINE Lesart für Zeiteingaben
   ------------------------------------------------------------
   BEFUND (Tester-Rückmeldung 28.10.): „42:39 für 5 km lässt sich nicht eingeben; 42 wird
   zu 42 Sekunden." Ursachen: inputmode=numeric (iPhone-Zifferntastatur ohne Doppelpunkt/
   Komma) + vier Parser mit widersprüchlichen Regeln (parseDuration: „42" = 42 s,
   „1:50" = 1 min 50; durMin: „42" = 42 min).

     P  parseUserTime: der gemeldete Fall, Halbmarathon-Falle, Plausibilität, leer, Unsinn
     R  validateRace (Leistungswerte) versteht „42,39"
     L  Lauf-Log durMin: „36,07" = 36:07, „36,5" = 36,5 min
     W  Verdrahtung: alle sechs Zeitfelder ohne inputmode=numeric, alle über die
        gemeinsame Lesart; Onboarding fällt NICHT still auf parseDuration zurück
     O  Onboarding: 3 km wählbar, Hinweis „leer lassen" vorhanden
     G  Gegenproben: der alte Parser erzeugt genau die gemeldeten Fehler
   node supabase/tests/time_input_k2_test.mjs
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const APP = [join(HERE, '..', '..'), join(HERE, '..', '..', 'app')].find(p => existsSync(join(p, 'js', 'engine', 'performance-input.js')));
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const src = f => readFileSync(join(APP, f), 'utf8');

globalThis.window = globalThis;
const PI = require(join(APP, 'js/engine/performance-input.js'));
require(join(APP, 'js/profile-model.js'));
const PM = globalThis.ORVIA.profileModel;

/* ---------- P · parseUserTime ---------- */
const sec = (t, km) => { const r = PI.parseUserTime(t, km); return r.ok ? r.seconds : 'ERR:' + r.reason; };
ok('P1 „42:39" bei 5 km = 42 min 39 s (der gemeldete Fall)', sec('42:39', 5) === 2559);
ok('P2 „42,39" / „42.39" / „42 39" (iPhone-Komma) = 42:39', sec('42,39', 5) === 2559 && sec('42.39', 5) === 2559 && sec('42 39', 5) === 2559);
ok('P3 „42" bei 5 km = 42 MINUTEN, nicht Sekunden', sec('42', 5) === 2520);
ok('P4 „4" bei 5 km → abgelehnt (unplausible Pace), nicht gespeichert', sec('4', 5) === 'ERR:implausible_pace');
ok('P5 Halbmarathon „1:50" / „1,50" = 1 h 50 min', sec('1:50', 21.0975) === 6600 && sec('1,50', 21.0975) === 6600);
ok('P6 Halbmarathon „1:50:00" / „1.50.00" = 1 h 50 min', sec('1:50:00', 21.0975) === 6600 && sec('1.50.00', 21.0975) === 6600);
ok('P7 Marathon „3:45" = 3 h 45 min', sec('3:45', 42.195) === 13500);
ok('P8 3 km „24:30" = 24 min 30 s', sec('24:30', 3) === 1470);
ok('P9 „42,5" bleibt Dezimalminuten (42:30)', sec('42,5', 5) === 2550);
ok('P10 leer → ok, kein Wert (optionales Feld)', PI.parseUserTime('', 5).ok === true && PI.parseUserTime('  ', 5).seconds === null);
ok('P11 Unsinn → verständliche Meldung', PI.parseUserTime('abc', 5).ok === false && /z\. B\./.test(PI.parseUserTime('abc', 5).error));
ok('P12 ohne Distanz und mehrdeutig („45:00") → Nachfrage statt Raten', sec('45:00', null) === 'ERR:ambiguous' && sec('1:15:00', null) === 4500);
ok('P13 kmForGoal: 5k/10k/HM/M bekannt, Triathlon ohne feste Laufdistanz', PI.kmForGoal('run_5k') === 5 && PI.kmForGoal('half_marathon') === 21.0975 && PI.kmForGoal('marathon') === 42.195 && PI.kmForGoal('triathlon') === null);
ok('P14 Unsinn-Distanzzeit 5 km „2:00:00" (24 min/km) → abgelehnt', sec('2:00:00', 5) === 'ERR:implausible_pace');

/* ---------- R · validateRace ---------- */
const vr = PI.validateRace({ sportId: 'running', distance: '5 km', time: '42,39' }, { today: '2026-10-29' });
ok('R1 Leistungswerte: „42,39" für 5 km akzeptiert', vr.status === 'ok', vr.status);
ok('R2 … als 42:39 gelesen', vr.entry && Math.round(vr.entry.timeSeconds || (vr.entry.value && vr.entry.value.timeSeconds) || 0) === 2559, JSON.stringify(vr.entry && (vr.entry.timeSeconds || vr.entry.value)).slice(0, 80));

/* ---------- L · Lauf-Log durMin (echte Funktion, v() injiziert) ---------- */
const ui = src('js/ui.js');
const i0 = ui.indexOf('function durMin(');
const i1 = ui.indexOf('\nfunction fmtDurInput(', i0);
ok('L0 durMin gefunden', i0 > 0 && i1 > i0);
const durMinOf = txt => new Function('v', 'window', ui.slice(i0, i1) + '\nreturn durMin("x",null,null);')(() => txt, { ORVIA: { performanceInput: PI } });
ok('L1 „36:07" = 36,12 min', Math.abs(durMinOf('36:07') - (36 + 7 / 60)) < 1e-9);
ok('L2 „36,07" (iPhone) = 36:07, nicht 36,07 min', Math.abs(durMinOf('36,07') - (36 + 7 / 60)) < 1e-9);
ok('L3 „36,5" bleibt 36,5 min', durMinOf('36,5') === 36.5);

/* ---------- W · Verdrahtung ---------- */
const ob = src('js/onboarding/onboarding-ui.js'), v14 = src('js/screens/profile-v14.js'), pf = src('js/profile.js');
const FELDER = [
  ['pf-pbTime', ob], ['pvg_time', v14], ['gmPerfTime', ui], ['l_dur', ui], ['gw_tgt_time', pf], ['gw_cur_time', pf]
];
for (const [id, s] of FELDER) {
  const m = s.match(new RegExp('<input[^>]*id=\\\\?"' + id + '\\\\?"[^>]*>|<input[^>]*id="' + id + '"[^\\n]{0,200}'));
  const tag = m ? m[0] : '';
  ok('W ' + id + ': keine Zifferntastatur ohne Trenner (inputmode=numeric)', tag !== '' && !/inputmode="numeric"/.test(tag), tag.slice(0, 90));
}
ok('W7 Onboarding Bestzeit + Zielzeit über _readTime (parseUserTime)', /function _readTime\(txt, km\)/.test(ob) && /PI\.parseUserTime\(txt, km\)/.test(ob) && /_readTime\(perf\.timeText, _pbKm\(perf\.distance\)\)/.test(ob) && /_readTime\(roh, PIg && PIg\.kmForGoal/.test(ob));
ok('W8 Onboarding: kein stiller Rückfall auf parseDuration bei Zeiteingaben', !/parseDuration\(perf\.timeText\)/.test(ob));
ok('W9 Ziel-Sheet (Profil) über parseUserTime mit Zieldistanz', /PI\.parseUserTime\(raw, PI\.kmForGoal\(m\.category\)\)/.test(v14) && !/parseDuration\(raw\)/.test(v14));
ok('W10 Zielassistent über parseUserTime mit Zieldistanz', /PIw\.parseUserTime\(tt\.value,kmW\)/.test(pf) && !/M2\.parseDuration\(tt\.value\)/.test(pf));
ok('W11 Lauf-Log normalisiert Trenner über dieselbe Regel', /PIn\.normalizeTimeText\(s\)/.test(ui));

/* ---------- O · Onboarding-Inhalt ---------- */
ok('O1 3 km als Bestzeit-Distanz wählbar', /\['3 km', 3\]/.test(ob));
const de = src('locales/de.js');
ok('O2 Hinweis „Noch keine Zeit? Einfach leer lassen." vorhanden und eingebunden', /'ob\.pb_noch_keine_zeit': 'Noch keine Zeit\? Einfach leer lassen\.'/.test(de) && /T\('ob\.pb_noch_keine_zeit'\)/.test(ob));
ok('O3 3-km-Bestzeit wird vom Profilmodell angenommen', PM.normalizePersonalBest({ sportId: 'running', distance: '3 km', discipline: '3 km', timeSeconds: 1470 }).timeSeconds === 1470);

/* ---------- G · Gegenproben ---------- */
ok('G1 alter Parser: „42" = 42 SEKUNDEN (der gemeldete Fehler)', PM.parseDuration('42') === 42);
ok('G2 alter Parser: „1:50" = 110 s statt 1 h 50 (Halbmarathon-Falle)', PM.parseDuration('1:50') === 110);
ok('G3 alter Parser: „42,39" unlesbar', PM.parseDuration('42,39') === null);

console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
