/* ============================================================
   ORVIA · Phase 5A — Datenqualitäts-Audit `training_load_daily` (E-03)
   ------------------------------------------------------------
   READ-ONLY: liest die komplette Tabelle des angemeldeten Nutzers und erzeugt
   einen Bericht. Es wird NICHTS geschrieben, geändert oder gelöscht.

   Warum: Die Schreibpfade sind seit Langem produktiv (workout-store / ui.js /
   migrate-blob), aber es gab NIE einen Lesepfad — die Daten wurden nie geprüft.
   Vor der Umstellung der Belastungs-Konsumenten auf das kanonische Read-Modell
   (Phase 5B, readCanonicalRange) muss die Datenlage bekannt sein.

   Ausführen (auf dem Mac, gleiche ENV wie rls_test):
   SUPABASE_URL=… SUPABASE_ANON_KEY=… A_EMAIL=… A_PW=… \
   node tools/audit_training_load.mjs [--json bericht.json]

   Prüfungen (E-03):
     1  Duplikat-Verdacht: gleicher Tag + Sport + Dauer ohne Dedupe-Key
     2  Dedupe-Key-Abdeckung (external_id / client_session_id / keiner)
     3  Sportarten-Inventar (inkl. unbekannter/leerer Sportwerte)
     4  Datumsplausibilität (Zukunft, vor 2020, ungültig)
     5  Unplausible Werte (Dauer ≤ 0 / > 360 min · Distanz > 300 km · RPE außerhalb 1–10)
     6  computed_load = 0/NULL trotz vorhandener Dauer (Rechenweg-Divergenz)
     7  computed_load ≠ Dauer × RPE (Abweichung > 1 — abweichende Logik je Schreibpfad)
     8  Sessions ohne RPE (⇒ byIntensity 'unknown', Entscheidung ③: markieren, nie löschen)
     9  `intensity`-Spalte: Wertebereich (Altlast: Ø-HF, keine Kategorie — fließt NICHT ins Read-Modell)
    10  Quellen-Inventar (manual/strava/garmin/…) + Kanonisierungs-Vorschau (5B-Ableitung)
   ============================================================ */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';

const URL = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY;
const A = { email: process.env.A_EMAIL, pw: process.env.A_PW };
const miss = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'A_EMAIL', 'A_PW'].filter(k => !process.env[k]);
if (miss.length) { console.error('ENV fehlt: ' + miss.join(', ')); process.exit(2); }
const jsonOut = process.argv.indexOf('--json') >= 0 ? process.argv[process.argv.indexOf('--json') + 1] : null;

const sb = createClient(URL, ANON, { auth: { persistSession: false } });
const { data: auth, error: aerr } = await sb.auth.signInWithPassword({ email: A.email, password: A.pw });
if (aerr || !auth.user) { console.error('Login fehlgeschlagen: ' + (aerr && aerr.message)); process.exit(2); }

/* Vollständig laden (paginiert, read-only). */
let rows = [], from = 0;
for (;;) {
  const { data, error } = await sb.from('training_load_daily').select('*')
    .eq('user_id', auth.user.id).order('local_date', { ascending: true }).range(from, from + 999);
  if (error) { console.error('Query-Fehler: ' + error.message); process.exit(1); }
  rows = rows.concat(data || []);
  if (!data || data.length < 1000) break;
  from += 1000;
}

const today = new Date().toISOString().slice(0, 10);
const rep = { generatedAt: new Date().toISOString(), rowCount: rows.length, findings: {} };
const F = (k, v) => { rep.findings[k] = v; };

/* 1+2 Duplikate / Dedupe-Keys */
const keyCover = { external_id: 0, client_session_id: 0, none: 0 };
const dupMap = {};
rows.forEach(r => {
  if (r.external_id) keyCover.external_id++; else if (r.client_session_id) keyCover.client_session_id++; else keyCover.none++;
  if (!r.external_id && !r.client_session_id) {
    const k = r.local_date + '|' + r.sport + '|' + (r.duration_min == null ? '-' : r.duration_min);
    (dupMap[k] = dupMap[k] || []).push(r.id);
  }
});
const dupGroups = Object.entries(dupMap).filter(([, ids]) => ids.length > 1)
  .map(([k, ids]) => ({ key: k, count: ids.length, ids }));
F('dedupeKeyCoverage', keyCover);
F('duplicateSuspects', { groups: dupGroups.length, rows: dupGroups.reduce((a, g) => a + g.count, 0), sample: dupGroups.slice(0, 15) });

/* 3 Sportarten */
const sports = {};
rows.forEach(r => { const s = (r.sport == null || r.sport === '') ? '(leer)' : String(r.sport); sports[s] = (sports[s] || 0) + 1; });
F('sportInventory', sports);

/* 4 Datum */
const badDates = rows.filter(r => !/^\d{4}-\d{2}-\d{2}$/.test(String(r.local_date || '')) || r.local_date > today || r.local_date < '2020-01-01')
  .map(r => ({ id: r.id, local_date: r.local_date, sport: r.sport }));
F('implausibleDates', { count: badDates.length, sample: badDates.slice(0, 15) });

/* 5 Wertebereiche — inkl. deines 6-h-Workout-Vorfalls (Dauer > 360 min) */
const badVals = rows.filter(r =>
  (r.duration_min != null && (+r.duration_min <= 0 || +r.duration_min > 360)) ||
  (r.distance_km != null && +r.distance_km > 300) ||
  (r.session_rpe != null && (+r.session_rpe < 1 || +r.session_rpe > 10)))
  .map(r => ({ id: r.id, local_date: r.local_date, sport: r.sport, duration_min: r.duration_min, distance_km: r.distance_km, session_rpe: r.session_rpe }));
F('implausibleValues', { count: badVals.length, sample: badVals.slice(0, 15) });

/* 6 computed_load leer/0 trotz Dauer */
const zeroLoad = rows.filter(r => r.duration_min != null && +r.duration_min > 0 && !(+r.computed_load > 0))
  .map(r => ({ id: r.id, local_date: r.local_date, sport: r.sport, duration_min: r.duration_min, session_rpe: r.session_rpe, computed_load: r.computed_load }));
F('zeroLoadDespiteDuration', { count: zeroLoad.length, sample: zeroLoad.slice(0, 15) });

/* 7 Rechenweg-Divergenz: computed_load vs. Dauer × RPE (Mobilität fix RPE 2, sonst Default 5) */
const calcLoad = r => { const rpe = String(r.sport) === 'Mobilität' ? 2 : (r.session_rpe != null ? +r.session_rpe : 5); return (+r.duration_min || 0) * rpe; };
const divergent = rows.filter(r => r.duration_min != null && +r.computed_load > 0 && Math.abs(+r.computed_load - calcLoad(r)) > 1)
  .map(r => ({ id: r.id, local_date: r.local_date, sport: r.sport, source: r.source, expected: calcLoad(r), stored: +r.computed_load }));
F('loadFormulaDivergence', { count: divergent.length, sample: divergent.slice(0, 15) });

/* 8 Sessions ohne RPE ⇒ 'unknown' im 5B-Modell */
const noRpe = rows.filter(r => r.session_rpe == null);
F('sessionsWithoutRpe', { count: noRpe.length, share: rows.length ? Math.round(noRpe.length / rows.length * 100) + '%' : '—' });

/* 9 intensity-Altlast (Ø-HF) */
const intVals = rows.filter(r => r.intensity != null).map(r => +r.intensity);
F('intensityColumnLegacy', {
  filled: intVals.length,
  min: intVals.length ? Math.min(...intVals) : null,
  max: intVals.length ? Math.max(...intVals) : null,
  note: 'Enthält Ø-Herzfrequenz (Zahl), KEINE Kategorie — fließt bewusst nicht in byIntensity ein (E-11).'
});

/* 10 Quellen + 5B-Kanonisierungs-Vorschau (identische Ableitung wie readCanonicalRange) */
const srcs = {};
rows.forEach(r => { const s = r.source || '(leer)'; srcs[s] = (srcs[s] || 0) + 1; });
F('sourceInventory', srcs);
const band = rpe => rpe == null ? 'unknown' : (+rpe <= 4 ? 'easy' : +rpe <= 6 ? 'moderate' : 'hard');
const preview = { days: new Set(rows.map(r => r.local_date)).size, byIntensity: { easy: 0, moderate: 0, hard: 0, unknown: 0 } };
rows.forEach(r => { if (+r.computed_load > 0) preview.byIntensity[band(r.session_rpe)] += +r.computed_load; });
Object.keys(preview.byIntensity).forEach(k => { preview.byIntensity[k] = Math.round(preview.byIntensity[k]); });
F('canonicalPreview5B', preview);

/* ---- Bericht ---- */
console.log('\n===== ORVIA Phase 5A · training_load_daily Audit =====');
console.log('Zeilen gesamt: ' + rep.rowCount + ' · Kalendertage: ' + preview.days);
console.log('\nDedupe-Keys: ', keyCover);
console.log('Duplikat-Verdacht (ohne Key, gleicher Tag+Sport+Dauer): ' + dupGroups.length + ' Gruppen');
console.log('Sportarten: ', sports);
console.log('Quellen: ', srcs);
console.log('Unplausible Daten — Datum: ' + badDates.length + ' · Werte: ' + badVals.length + ' · load=0 trotz Dauer: ' + zeroLoad.length + ' · Formel-Divergenz: ' + divergent.length);
console.log('Ohne RPE (⇒ unknown): ' + noRpe.length + ' (' + rep.findings.sessionsWithoutRpe.share + ')');
console.log('intensity-Altlast (Ø-HF): ' + intVals.length + ' Zeilen befüllt' + (intVals.length ? ' [' + rep.findings.intensityColumnLegacy.min + '–' + rep.findings.intensityColumnLegacy.max + ']' : ''));
console.log('5B-Vorschau byIntensity (Load-Punkte): ', preview.byIntensity);
console.log('\nEMPFEHLUNG (Entscheidung ③ — markieren, nie löschen):');
if (dupGroups.length) console.log('  • ' + dupGroups.length + ' Duplikat-Gruppen manuell sichten (IDs im JSON-Bericht).');
if (badVals.length) console.log('  • ' + badVals.length + ' Zeilen mit unplausiblen Werten sichten (z. B. Dauer > 6 h → Dauer-Korrektur in der App nutzen).');
if (divergent.length) console.log('  • ' + divergent.length + ' Zeilen mit abweichender Load-Formel: Schreibpfad identifizieren (source-Feld im Sample).');
if (!dupGroups.length && !badVals.length && !divergent.length && !badDates.length) console.log('  • Keine Blocker — 5B-Konsumenten-Umschaltung kann starten.');
console.log('======================================================\n');

if (jsonOut) { writeFileSync(jsonOut, JSON.stringify(rep, null, 2)); console.log('JSON-Bericht: ' + jsonOut); }
await sb.auth.signOut();
