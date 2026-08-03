/* ============================================================
   ORVIA · P5 — Zielsystem produktreif.
   Verträge:
   - metricType 'time': normalizeGoal parst „1:50:00"-Strings zu Sekunden,
     Kategorien-Inferenz (halfmarathon/ironman/… ⇒ time), unit default 's'.
   - „Ironman Sub 10 2028" & „HM sub 1:50" vollständig als Modellziel abbildbar.
   - Wizard-Verträge: Zeitfeld, customCategory-, Motivation-Feld, Collect + patch.
   - goalToRow-Adapter: category→goal_type, unit→target_unit, id→client_goal_id,
     priority 1..4→primary/secondary/maintain/longterm; 0012-Spalten nur wenn belegt.
   - Migration 0012 vorhanden (Enums erweitert, metric_type/current_value/section_updated_at).
   node supabase/tests/goals_p5_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../../app/js/', import.meta.url);

function modelSandbox() {
  const sb = { window: null, console }; sb.window = sb; sb.ORVIA = {};
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('profile-model.js', base), 'utf8'), sb, { filename: 'profile-model.js' });
  return sb.ORVIA.profileModel;
}

/* ---------- 1) Modell: Zeit-Semantik ---------- */
{
  const M = modelSandbox();
  ok('M1 goalMetricTypeFor: HM/Ironman ⇒ time', M.goalMetricTypeFor('halfmarathon') === 'time' && M.goalMetricTypeFor('ironman') === 'time');
  const g = M.normalizeGoal({ category: 'ironman', title: 'Ironman Sub 10', targetValue: '10:00:00', targetDate: '2028-07-01', priority: 1, sports: ['triathlon'] });
  ok('M2 „Sub 10" strukturiert: 36000 s', g.targetValue === 36000, 'targetValue=' + g.targetValue);
  ok('M3 metricType time + unit s automatisch', g.metricType === 'time' && g.unit === 's');
  ok('M4 Rolle/Datum/Sport verlustfrei', g.priority === 1 && g.targetDate === '2028-07-01' && g.sports[0] === 'triathlon');
  const hm = M.normalizeGoal({ category: 'halfmarathon', title: 'HM sub 1:50', targetValue: '1:50:00', currentValue: '1:58:30' });
  ok('M5 HM 1:50 ⇒ 6600 s, aktuell 7110 s', hm.targetValue === 6600 && hm.currentValue === 7110);
  const free = M.normalizeGoal({ category: 'custom', customCategory: 'HYROX', title: 'HYROX Finish', targetValue: 90, unit: 'min', motivation: 'Challenge' });
  ok('M6 freies Ziel: customCategory/motivation/Zahlenwert erhalten', free.customCategory === 'HYROX' && free.motivation === 'Challenge' && free.targetValue === 90 && free.unit === 'min' && free.metricType == null);
  const ftp = M.normalizeGoal({ category: 'ftp', title: 'FTP 300', targetValue: 300 });
  ok('M7 FTP ⇒ metricType power', ftp.metricType === 'power');
  // Idempotenz: normalize(normalize(x)) == normalize(x)
  const again = M.normalizeGoal(g);
  ok('M8 Normalisierung idempotent (Sekunden bleiben Sekunden)', again.targetValue === 36000 && again.metricType === 'time');
}

/* ---------- 2) Wizard-Verträge ---------- */
{
  const src = readFileSync(new URL('profile.js', base), 'utf8');
  ok('W1 Zeitfeld für zeitbasierte Kategorien', /gw_tgt_time/.test(src) && /goalMetricTypeFor/.test(src));
  ok('W2 customCategory-Feld bei custom', /gw_customcat/.test(src));
  ok('W3 Motivation-Feld vorhanden', /gw_motiv/.test(src));
  ok('W4 Collect parst Zeit über parseDuration', /parseDuration\(tt\.value\)/.test(src));
  ok('W5 patch trägt metricType/customCategory/motivation', /metricType:d\.metricType/.test(src) && /customCategory:d\.customCategory/.test(src));
}

/* ---------- 3) Repo-Adapter ---------- */
{
  const sb = { window: null, console }; sb.window = sb;
  sb.ORVIA = { repoBase: { selectAll: async () => ({}), upsert: async (t, row) => ({ success: true, data: row }), upsertMany: async () => ({}), remove: async () => ({}) }, repos: {} };
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('repos/goalRepository.js', base), 'utf8'), sb, { filename: 'goalRepository.js' });
  const R = sb.ORVIA.repos.goal;
  const row = R.goalToRow({ id: 'goal:abc', category: 'ironman', title: 'Ironman Sub 10', targetValue: 36000, unit: 's', metricType: 'time', currentValue: 39000, targetDate: '2028-07-01', priority: 1, status: 'active' });
  ok('R1 category→goal_type, unit→target_unit, id→client_goal_id', row.goal_type === 'ironman' && row.target_unit === 's' && row.client_goal_id === 'goal:abc');
  ok('R2 priority 1 → primary', row.priority === 'primary');
  ok('R3 Basis-Row OHNE 0012-Spalten (Kompatibilität)', !('metric_type' in row) && !('current_value' in row));
  const full = R.goalToRowFull({ id: 'g2', category: 'halfmarathon', priority: 3, status: 'achieved', metricType: 'time', currentValue: 7110, targetValue: 6600, unit: 's' });
  ok('R4 Full-Row mit metric_type/current_value', full.metric_type === 'time' && full.current_value === 7110);
  ok('R5 priority 3 → maintain, status achieved durchgereicht', full.priority === 'maintain' && full.status === 'achieved');
  const legacy = R.goalToRow({ clientGoalId: 'blob:primary:halfmarathon', type: 'halfmarathon', targetUnit: 'min', priority: 'primary' });
  ok('R6 Legacy-Migration unverändert kompatibel', legacy.client_goal_id === 'blob:primary:halfmarathon' && legacy.goal_type === 'halfmarathon' && legacy.target_unit === 'min' && legacy.priority === 'primary');
}

/* ---------- 4) Migration 0012 ---------- */
{
  const sql = readFileSync(new URL('../../_dev/supabase/migrations/0012_goal_enums_and_fields.sql', base), 'utf8');
  ok('S1 Enums erweitert (maintain/longterm/achieved/abandoned/archived)', /maintain','longterm/.test(sql) && /achieved','abandoned','archived/.test(sql));
  ok('S2 Altwerte bleiben gültig (completed/optional erhalten)', /'completed'/.test(sql) && /'optional'/.test(sql));
  ok('S3 additive Spalten inkl. section_updated_at (P9-Vorbereitung)', /metric_type/.test(sql) && /current_value/.test(sql) && /section_updated_at/.test(sql));
  ok('S4 idempotent (if not exists / drop if exists)', /add column if not exists/.test(sql) && /drop constraint if exists/.test(sql));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
