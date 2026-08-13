/* ORVIA · Prediction Observer — LIVE gegen die echte Supabase-Instanz

   Der Test, den kein Fixture ersetzen kann: Er beweist, dass Migration 0033
   tatsächlich eingespielt ist und die volle Kette gegen die ECHTE Datenbank
   läuft — genau die Lücke, durch die der 0032-Constraint alle Beobachtungen
   monatelang still hätte schlucken können.

     Vorhersage bauen → als prediction_record SPEICHERN
     → kanonisches Debrief bauen → Vorhersage FINDEN
     → Auswertung erzeugen → als prediction_evaluation SPEICHERN
     → BEIDE Records aus Supabase LESEN
     → Kalibrierung aus den gelesenen Records berechnen

   Läuft nur mit Umgebungsvariablen gegen eine echte Instanz (RLS-Testmuster);
   ohne sie: exit 2 = ÜBERSPRUNGEN, nie als grün gezählt.

   SUPABASE_URL=… SUPABASE_ANON_KEY=… A_EMAIL=… A_PW=… \
     node supabase/tests/prediction_observer_live_test.mjs [appRoot] */
import { existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);

const URL = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY;
const A = { email: process.env.A_EMAIL, pw: process.env.A_PW };
const miss = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'A_EMAIL', 'A_PW'].filter(k => !process.env[k]);
if (miss.length) {
  console.log('⏭️  ÜBERSPRUNGEN — Umgebungsvariablen fehlen: ' + miss.join(', '));
  process.exit(2);
}

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const { createClient } = require('@supabase/supabase-js');
const P = require(join(APP, 'js/engine/prediction-observer.js'));
require(join(APP, 'js/engine/evidence.js'));
require(join(APP, 'js/engine/load-profile.js'));
const SD = require(join(APP, 'js/engine/session-debrief.js'));
const DR = require(join(APP, 'js/engine/debrief-record.js'));
const DL = require(join(APP, 'js/engine/decision-log.js'));

/* Vollstaendiger Log-Record: 0032 verlangt decision_runtime_hash und
   decision_hash NOT NULL — ein Insert ohne sie scheitert am naechsten
   Constraint, sobald 0033 den Typ erlaubt. Der Record entsteht ueber
   DL.build() (dieselbe Fabrik wie produktiv) und die Zeile ueber DL.toRow()
   — DIESELBE Spaltenabbildung, die auch die produktive Senke in ui.js
   verwendet (v8-305). KEINE eigene Abbildung mehr: die alte handgepflegte
   Kopie hier hatte bereits parent_decision_id, supersedes_decision_id und
   week_id verloren — ein gruener Live-Test bewies die App-Senke nicht. */
function toRow(uid2, decisionType, decisionId, ts, planId2, derived, inputs2) {
  const built = DL.build({ decisionType, decisionId, timestamp: ts,
    planId: planId2, inputs: inputs2, derivedState: derived, registry: {} });
  if (!built.valid) throw new Error('DL.build invalid: ' + built.errors.join(','));
  const m = DL.toRow(built.record, uid2);
  if (!m || m.ok !== true) throw new Error('DL.toRow fail-closed: ' + (m && m.reason));
  return m.row;
}

const sb = createClient(URL, ANON);
const now = new Date();
const iso = d => d.toISOString();
const heute = iso(now).slice(0, 10);
const morgen = iso(new Date(now.getTime() + 86400000)).slice(0, 10);

const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email: A.email, password: A.pw });
if (authErr || !auth || !auth.user) { console.log('❌ Login fehlgeschlagen: ' + (authErr && authErr.message)); process.exit(1); }
const uid = auth.user.id;
const marker = 'live-po-' + now.getTime().toString(36);

/* ---- 1. Vorhersage fuer eine Einheit MORGEN (echt vor dem Ereignis) ---- */
const unit = { id: 'psg:live:' + marker, t: 'Laufen', l: 'Intervalle', d: '40 min' };
/* KEINE handgebaute Prescription (v8-307, Gians Live-Test-Befund): die alte
   rx (rx-live/7/moderate/threshold) lief gegen den echten C3-Snapshot
   (session-debrief@2/4.8/weak/null) not_comparable — und verdeckte dabei
   den typeOf-Fehler, der 'Intervalle · 40 min' als unknown klassifizierte.
   Die Prescription kommt jetzt aus DERSELBEN Funktion wie im Produkt und
   im C3-Snapshot. Werte hier zu fixieren waere genau der verbotene Weg,
   den Test gruen zu faerben und den Klassifikationsfehler zu verstecken. */
const rx = SD.prescriptionOf(unit, { durationMin: DR.plannedDurationOf(unit), targetZone: null });
if (rx.sessionType !== 'vo2') { console.log('❌ Gegenprobe: Intervalle + 40 min muss vo2 ergeben, ist ' + rx.sessionType); process.exit(1); }
const pred = P.predict({ userId: uid,
  sessionId: DR.occurrenceIdOf(morgen, unit),
  planId: 'plan-' + marker, planRevision: 'r1',
  sport: 'running',
  /* v8-309: kein separater sessionType — die Prescription ist die Quelle. */
  prescription: rx, predictedAt: iso(now), sessionDate: morgen });
ok('die Vorhersage entsteht', pred.ok === true, pred.reason || '');

/* ---- 2. prediction_record SPEICHERN — hier starb v8-288 am Constraint ---- */
const ins1 = await sb.from('engine_decision_log').insert(
  toRow(uid, 'prediction_record', 'dec-' + marker + '-p', iso(now), 'plan-' + marker,
    pred, { predictionId: pred.predictionId }));
ok('prediction_record wird von der Datenbank ANGENOMMEN (Migration 0033 wirkt)',
  !ins1.error, ins1.error ? ins1.error.message : '');

/* ---- 3. DIE GESPEICHERTE Vorhersage FINDEN — nicht die aus dem Speicher.
        Erst der Roundtrip beweist „speichern → finden → aufloesen": Ein
        Serialisierungsverlust (z. B. undefined-Felder, Zahlformate) faellt nur
        auf, wenn die Aufloesung mit dem GELESENEN Record rechnet. ---- */
const found = await sb.from('engine_decision_log')
  .select('derived_state')
  .eq('decision_type', 'prediction_record')
  .eq('plan_id', 'plan-' + marker)
  .order('decided_at', { ascending: false }).limit(1);
ok('die gespeicherte Vorhersage ist auffindbar',
  !found.error && found.data && found.data.length === 1,
  found.error ? found.error.message : String(found.data && found.data.length));
const storedPred = found.data && found.data[0] ? found.data[0].derived_state : null;
ok('… und nach dem Roundtrip integer', storedPred && P.verifyIntegrity(storedPred) === true);

/* ---- 4. Kanonisches Debrief (echter Builder) gegen den GELESENEN Record ---- */
const rec = DR.build({ key: morgen + '|Laufen|Intervalle', date: morgen, unit,
  planned: { t: 'Laufen', l: 'Intervalle', d: '40 min', sportId: 'running', durationMin: 40 },
  actual: { durationMin: 38, completedAt: morgen + 'T18:00:00Z' },
  rpe: 8, pain: false, userId: uid, planId: 'plan-' + marker, planRevision: 'r1',
  now: morgen + 'T19:00:00Z', SD });
const evaluation = P.resolve(storedPred, rec, { evaluatedAt: morgen + 'T19:05:00Z' });
ok('die GELESENE Vorhersage löst das echte Debrief auf', evaluation.resolution === 'scored',
  evaluation.resolution + '/' + (evaluation.reason || ''));

const ins2 = await sb.from('engine_decision_log').insert(
  toRow(uid, 'prediction_evaluation', 'dec-' + marker + '-e', iso(now), 'plan-' + marker,
    evaluation, { predictionId: pred.predictionId, debriefId: rec.id }));
ok('prediction_evaluation wird angenommen', !ins2.error, ins2.error ? ins2.error.message : '');

/* ---- 5. Auswertung zurücklesen ---- */
const read = await sb.from('engine_decision_log')
  .select('decision_type,derived_state')
  .eq('plan_id', 'plan-' + marker)
  .in('decision_type', ['prediction_record', 'prediction_evaluation'])
  .order('decided_at', { ascending: false }).limit(10);
ok('beide Records sind lesbar', !read.error && read.data && read.data.length === 2,
  read.error ? read.error.message : String(read.data && read.data.length));
const backEval = read.data && read.data.find(r => r.decision_type === 'prediction_evaluation');

/* ---- 6. Kalibrierung aus den GELESENEN Records ---- */
const cal = P.calibrate([backEval && backEval.derived_state].filter(Boolean));
ok('die Kalibrierung rechnet aus persistierten Auswertungen',
  cal.groups.length === 1 && cal.groups[0].counts.scored === 1 &&
  cal.groups[0].rpe && cal.groups[0].completion,
  JSON.stringify(cal.groups[0] ? cal.groups[0].counts : null));

/* ---- Aufraeumen (best effort — Log ist append-only per Design, Testdaten
        sind ueber plan_id markiert und stoeren keine Kohorte: fremder Typ) ---- */
await sb.from('engine_decision_log').delete().eq('plan_id', 'plan-' + marker).then(() => {}, () => {});

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
