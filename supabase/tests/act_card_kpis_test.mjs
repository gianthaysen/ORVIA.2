/* ============================================================
   ORVIA · act_card_kpis — Kennzahlen der Aktivitaetskarte je Sportfamilie (v8-422)
   Gians Befund 1.10.: „Tempo bei Krafttraining" — Karten zeigten fuer jede Sportart
   Umfang/Dauer/Tempo/HF. Jetzt: sportgerechte vier Zellen, vorhandene zuerst,
   fehlende ehrlich „—", Reihenfolge der Familie bleibt.
   node supabase/tests/act_card_kpis_test.mjs
   ============================================================ */
import fs from 'fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const ui = rd('js/ui.js');
const slice = (name) => { const i = ui.indexOf('function ' + name + '('); if (i < 0) throw new Error('missing ' + name); const j = ui.indexOf('\nfunction ', i + 10); return ui.slice(i, j < 0 ? undefined : j); };
const code = slice('gmActCardKpis') + '\n' + slice('gmActFamily') + '\n' + slice('gmKg') + '\n' + slice('fmtDe') + '\n';
const ctx = { window: { ORVIA: { trainingDomain: { normSport: v => ({ gym: 'gym', running: 'running', cycling: 'cycling', swimming: 'swimming' })[v] || 'other' } } }, _uiT: k => ({ 'ui.hf_': 'Ø HF', 'ui.rpe': 'RPE ' })[k] || k, gmActGymAgg: () => ({ exCount: null, setCount: null, volumeKg: null }) };
vm.createContext(ctx); vm.runInContext(code + '\nthis.K=gmActCardKpis;', ctx);
const K = ctx.K;
const labels = r => r.map(c => c[1]).join('|'), vals = r => r.map(c => c[0]).join('|');

{
  const r = K({ sportId: 'gym', summary: { exerciseCount: 5, workingSetCount: 14, totalVolumeKg: 3240 }, durationSeconds: 1440 }, { sportId: 'gym', durationLabel: '24 min' });
  ok('A1 Kraft (ORVIA-Workout): Uebungen · Saetze · Dauer · Volumen — kein Tempo', labels(r) === 'ÜBUNGEN|SÄTZE|DAUER|VOLUMEN' && vals(r) === '5|14|24 min|3.240 kg', labels(r) + ' / ' + vals(r));
  const g = K({ sportId: 'gym', summary: { avgHr: 110, caloriesKcal: 412 }, durationSeconds: 3360 }, { sportId: 'gym', durationLabel: '56 min', avgHr: 110, caloriesKcal: 412 });
  ok('A2 Kraft (Garmin, ohne Uebungslog): Dauer · HF · Kalorien vorhanden, EINE ehrliche Luecke (Uebungen —), Familienreihenfolge', labels(g) === 'ÜBUNGEN|DAUER|Ø HF|KALORIEN' && vals(g) === '—|56 min|110 bpm|412 kcal', labels(g) + ' / ' + vals(g));
  const l = K({ sportId: 'running', summary: { distanceKm: 10.2, avgHr: 152, elevationM: 84 }, durationSeconds: 3000 }, { sportId: 'running', durationLabel: '50:00', distanceLabel: '10,2 km', paceLabel: '4:54/km', avgHr: 152, elevationM: 84 });
  ok('A3 Laufen: Distanz · Dauer · Pace · HF', labels(l) === 'DISTANZ|DAUER|PACE|Ø HF' && vals(l) === '10,2 km|50:00|4:54/km|152 bpm', labels(l) + ' / ' + vals(l));
  const c = K({ sportId: 'cycling', summary: { distanceKm: 40, avgHr: 130 }, durationSeconds: 5400 }, { sportId: 'cycling', durationLabel: '1:30:00', distanceLabel: '40 km', avgHr: 130 });
  ok('A4 Rad: Geschwindigkeit aus Distanz/Dauer (26,7 km/h), kein Lauf-Tempo', labels(c) === 'DISTANZ|DAUER|Ø KM/H|Ø HF' && vals(c) === '40 km|1:30:00|26,7 km/h|130 bpm', labels(c) + ' / ' + vals(c));
  const s = K({ sportId: 'swimming', summary: { distanceM: 1900 }, durationSeconds: 2700 }, { sportId: 'swimming', durationLabel: '45:00', distanceLabel: '1.900 m', paceLabel: '2:22/100 m' });
  ok('A5 Schwimmen: Distanz · Dauer · Tempo/100 m · HF (—)', labels(s) === 'DISTANZ|DAUER|TEMPO|Ø HF' && vals(s) === '1.900 m|45:00|2:22/100 m|—', labels(s) + ' / ' + vals(s));
  const o = K({ sportId: 'football', summary: { avgHr: 140 }, durationSeconds: 3600 }, { sportId: 'football', durationLabel: '60 min', avgHr: 140 });
  ok('A6 Sonstige: Dauer · HF · Distanz (—) · Kalorien (—), nie Pace', labels(o) === 'DAUER|Ø HF|DISTANZ|KALORIEN' && vals(o) === '60 min|140 bpm|—|—', labels(o) + ' / ' + vals(o));
  const e = K({}, {});
  ok('A7 leer ⇒ vier ehrliche Zellen, kein Throw', e.length === 4 && e.every(c => c[0] === '—'));
  ok('A8 Karte nutzt gmActCardKpis; Altpfad (UMFANG/TEMPO fuer alle) entfernt', /var kp=gmActCardKpis\(a,vm\);/.test(ui) && !/<span>TEMPO<\/span>/.test(ui));
}
console.log('\n' + (fail ? '❌' : '✅') + ' act_card_kpis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
