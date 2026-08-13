/* ORVIA · Phase 5B (2026-08-05) — kanonisches Load-Read-Modell (trainingLoadRepository).
   Ableitungsvertrag Intensitaet: E-11 Dimension A aus RPE (1-4 easy · 5-6 moderate ·
   7-10 hard · fehlend unknown). NEGATIVKONTROLLE: die intensity-Spalte (Ø-HF-Altlast)
   darf byIntensity NIE beeinflussen.
   node supabase/tests/load_read_model_5b_test.mjs */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

/* Zwei Checkout-Layouts: Cloud (App unter ../../) und Geraet (App unter ../../../app). */
const _flat = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

/* Sandbox: Repository mit repoBase-Stub evaluieren (reine Ableitung braucht kein I/O). */
const sb = { window: null, console };
sb.window = sb; sb.globalThis = sb;
sb.ORVIA = { repoBase: { ok: (d, x) => Object.assign({ success: true, data: d }, x), fail: () => ({ success: false }) }, repos: {} };
vm.createContext(sb);
vm.runInContext(readFileSync(join(APP, 'js/repos/trainingLoadRepository.js'), 'utf8'), sb, { filename: 'trainingLoadRepository.js' });
const TL = sb.ORVIA.repos.trainingLoad;

/* ---------- Intensitaets-Ableitungsvertrag (E-11 Dimension A) ---------- */
ok('RPE 1 und 4 ⇒ easy (Bandgrenze)', TL.intensityBandOf(1) === 'easy' && TL.intensityBandOf(4) === 'easy');
ok('RPE 5 und 6 ⇒ moderate', TL.intensityBandOf(5) === 'moderate' && TL.intensityBandOf(6) === 'moderate');
ok('RPE 7 und 10 ⇒ hard (konsistent mit intensityHard RPE>=7)', TL.intensityBandOf(7) === 'hard' && TL.intensityBandOf(10) === 'hard');
ok('RPE fehlt ⇒ unknown (Entscheidung ③: markieren, nie raten)', TL.intensityBandOf(null) === 'unknown' && TL.intensityBandOf(undefined) === 'unknown');

/* ---------- Sport-Kanonisierung ---------- */
ok('deutsche Legacy-Namen kanonisch', TL.canonicalSportOf('Laufen') === 'running' && TL.canonicalSportOf('Rad') === 'cycling'
   && TL.canonicalSportOf('Gym') === 'gym' && TL.canonicalSportOf('Schwimmen') === 'swimming' && TL.canonicalSportOf('Mobilität') === 'mobility');
ok('unbekannte Sportart verschwindet nicht ⇒ other', TL.canonicalSportOf('Fechten') === 'other');
ok('leere Sportart ⇒ unknown', TL.canonicalSportOf('') === 'unknown' && TL.canonicalSportOf(null) === 'unknown');

/* ---------- deriveCanonicalDays ---------- */
const rows = [
  /* Tag 1: Lauf easy (60x4=240) + Gym hard (45x8=360) + Session OHNE RPE (30 min, load 150) */
  { local_date: '2026-08-03', sport: 'Laufen', duration_min: 60, session_rpe: 4, computed_load: 240, intensity: 152 },
  { local_date: '2026-08-03', sport: 'Gym', duration_min: 45, session_rpe: 8, computed_load: 360, intensity: 141 },
  { local_date: '2026-08-03', sport: 'Rad', duration_min: 30, session_rpe: null, computed_load: 150, intensity: 138 },
  /* Tag 2: Session ohne belastbare Last (Dauer da, load 0) + moderate Einheit */
  { local_date: '2026-08-04', sport: 'Schwimmen', duration_min: 40, session_rpe: 5, computed_load: 0, intensity: null },
  { local_date: '2026-08-04', sport: 'Laufen', duration_min: 50, session_rpe: 6, computed_load: 300, intensity: 149 },
  /* Unsortierter Nachzuegler fuer Tag 1 (Sortier-Kontrolle) */
  { local_date: '2026-08-03', sport: 'Fechten', duration_min: 20, session_rpe: 3, computed_load: 60, intensity: null }
];
const days = TL.deriveCanonicalDays(rows);
ok('Tage sortiert, ein Objekt je Kalendertag', days.length === 2 && days[0].date === '2026-08-03' && days[1].date === '2026-08-04');
const d1 = days[0], d2 = days[1];
ok('totalLoad = Summe belastbarer Sessions (240+360+150+60=810)', d1.totalLoad === 810, String(d1.totalLoad));
ok('bySport kanonisch: running 240 · gym 360 · cycling 150 · other 60',
   d1.bySport.running === 240 && d1.bySport.gym === 360 && d1.bySport.cycling === 150 && d1.bySport.other === 60, JSON.stringify(d1.bySport));
ok('byIntensity: easy 300 (240+60) · hard 360 · unknown 150 (Session ohne RPE)',
   d1.byIntensity.easy === 300 && d1.byIntensity.hard === 360 && d1.byIntensity.unknown === 150 && d1.byIntensity.moderate === 0, JSON.stringify(d1.byIntensity));
ok('completeness Tag 1 = 1 (alle 4 Sessions mit Dauer+Load)', d1.completeness === 1, String(d1.completeness));
ok('Tag 2: load=0-Session traegt KEINE Punkte bei, drueckt aber die completeness (1 von 2 = 0.5)',
   d2.totalLoad === 300 && d2.completeness === 0.5 && d2.byIntensity.moderate === 300, JSON.stringify(d2));
ok('Tag 2: Sportart der load=0-Session bleibt sichtbar (swimming: 0, verschwindet nicht)',
   d2.bySport.swimming === 0);

/* NEGATIVKONTROLLE — der historische Fehler: intensity (Ø-HF, Zahl 130-160) als
   Kategorie interpretieren. Wuerde die Spalte einfliessen, laege easy/hard voellig
   anders. Wir bauen die falsche Ableitung nach und zeigen, dass sie ein ANDERES
   Ergebnis liefert als der Vertrag. */
{
  const wrongBand = (hr) => hr == null ? 'unknown' : (hr < 140 ? 'easy' : hr < 150 ? 'moderate' : 'hard');
  const wrong = { easy: 0, moderate: 0, hard: 0, unknown: 0 };
  rows.filter(r => r.local_date === '2026-08-03' && +r.computed_load > 0).forEach(r => { wrong[wrongBand(r.intensity)] += +r.computed_load; });
  ok('NEGATIVKONTROLLE: Ø-HF-Fehlinterpretation ergaebe ein anderes Bild (Vertrag schuetzt davor)',
     JSON.stringify(wrong) !== JSON.stringify(d1.byIntensity), JSON.stringify(wrong));
}
/* Determinismus + Eingabe unangetastet */
ok('deterministisch', JSON.stringify(TL.deriveCanonicalDays(rows)) === JSON.stringify(days));
ok('Eingabezeilen werden nicht mutiert', rows[0].session_rpe === 4 && !('byIntensity' in rows[0]));
ok('leere Eingabe ⇒ leeres Ergebnis (kein erfundener Tag)', TL.deriveCanonicalDays([]).length === 0 && TL.deriveCanonicalDays(null).length === 0);

/* readCanonicalRange nutzt listRange (I/O-Huelle) — Stub-Kontrolle */
{
  const rows2 = [{ local_date: '2026-08-03', sport: 'Laufen', duration_min: 60, session_rpe: 4, computed_load: 240 }];
  TL.listRange = async () => sb.ORVIA.repoBase.ok(rows2);
  const r = await TL.readCanonicalRange('2026-08-01', '2026-08-07');
  ok('readCanonicalRange liefert das kanonische Tagesmodell', r.success && r.data.length === 1 && r.data[0].totalLoad === 240);
}

console.log('\nload_read_model_5b: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
