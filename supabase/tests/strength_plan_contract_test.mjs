/* ORVIA · v8-321 — Kraft-Zielwerte und Datenvertrag (Kraftplan v2, K1 + K2-Vertrag)

   BEFUND (Repo-Audit 2026-08-12, gegen den ECHTEN Stand geprueft, nicht gegen
   den Plan v1 uebernommen):
     · Eine Lastvorgabe existierte NIRGENDS — weder in den 34 Migrationen noch
       im Client. `training_plan_exercises`/`workout_exercises` enden bei
       planned_sets/min_reps/max_reps/target_rir/target_rpe/rest_seconds.
       (`targetWeightKg` in js/nutrition.js ist KOERPERgewicht, `targetLoad` in
       js/engine/progression.js ist systemische Tageslast — beides anderes.)
     · Eine Gym-Karte im Wochenplan ist {t:'Gym', l:<Split>, d:'45 min'}; `d`
       ist eine KONSTANTE aus gpG() (js/ui.js:239). Es gab also keinen Ort, an
       dem Uebungen/Saetze/Gewichte ueberhaupt haetten stehen koennen.
     · `workout_sets.set_type` hatte KEIN CHECK — die Satztypliste lebte nur im
       Client (js/training-domain.js:75).
     · Es gab keine persistente Verbindung Occurrence -> Garmin-Workout ->
       Garmin-Aktivitaet. Der Rueckkanal haette auf Datum/Titel raten muessen.

   Geprueft wird VERHALTEN gegen die ECHTEN Module (trainingDomain,
   plan-domain) und gegen den ECHTEN Migrationstext — nicht die Rechnung des
   Pruef lings nachgebaut (Bauplan §17.8):
     S1 Migration ist additiv und traegt die Zielgewichts-Spalten
     S2 Satztyp und Importherkunft sind in der Datenbank kontrolliert
     S3 strength_workout_exports traegt die VOLLSTAENDIGE Identitaetskette
     S4 Datenvertrag: Reinheit und Vertragstreue
     S5 Fail-closed: Unbrauchbares wird abgewiesen, nicht repariert
     S6 Die zwei erlaubten Bedeutungsfaelle (feste Wdh., fehlende Reihenfolge)
     S7 Altbestand ohne Vorgaben bleibt gueltig
     S8 Anzeige benennt Unaufgeloestes, statt es zu erfinden
     S9 Dauer reagiert auf den Umfang (loest die Konstante '45 min' ab)
     S10 Nicht bewertbares Volumen ist NICHT 0
     S11 Fingerabdruck erkennt geaenderte Vorgaben
     S12 Sportart wird normalisiert, nicht per Teilstring geraten
     S13 Die Vorgaben ueberleben den ECHTEN Persistenzweg (plan-domain)
     S14 Das Modul ist in index.html geladen (sonst rein theoretisch)

   node supabase/tests/strength_plan_contract_test.mjs [appRoot] */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);
/* Migrationen liegen IMMER neben den Tests — layoutunabhaengig (wie 0031-Test). */
const MIG = join(HERE, '..', 'migrations');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const htmlRaw = readFileSync(join(APP, 'index.html'), 'utf8');
const migFile = readdirSync(MIG).find(f => /^0035_/.test(f));
const migRaw = migFile ? readFileSync(join(MIG, migFile), 'utf8') : '';
/* Kommentare duerfen den Fund dokumentieren, ohne die Vertragspruefung zu
   verfaelschen — die Kommentar-Stolperfalle aus v8-315/v8-317. */
const migSql = migRaw.replace(/--.*$/gm, '');

globalThis.window = globalThis;
globalThis.ORVIA = globalThis.ORVIA || {};
await import(pathToFileURL(join(APP, 'js/training-domain.js')).href);
await import(pathToFileURL(join(APP, 'js/engine/strength-plan.js')).href);
const SP = globalThis.ORVIA.strengthPlan;

/* Ein realistisches Oberkoerper-Beispiel — die Werte sind bewusst so gewaehlt,
   dass keine davon einer plausiblen Konstante im Prueflings-Code entspricht
   (die 0,42-Lehre aus v8-319). */
const EX = () => ([
  { exerciseId: 'bench_press', sets: 4, minReps: 6, maxReps: 8, targetWeightKg: 80, restSeconds: 150 },
  { exerciseId: 'barbell_row', sets: 3, minReps: 8, maxReps: 10, targetWeightKg: 65, restSeconds: 120 },
  { exerciseId: 'ohp', sets: 3, minReps: 8, maxReps: 8, targetWeightKg: 25 }
]);

/* ══ S1 · Migration additiv, Zielgewicht vorhanden ══ */
sec('S1 · Zielgewicht im Modell');
ok('Migration 0035 existiert', !!migFile, migFile || 'nicht gefunden');
ok('training_plan_exercises bekommt target_weight_kg',
  /alter\s+table\s+public\.training_plan_exercises[\s\S]{0,200}?add\s+column\s+if\s+not\s+exists\s+target_weight_kg/i.test(migSql));
ok('workout_exercises bekommt target_weight_kg (sonst ginge die Vorgabe beim Sessionstart verloren)',
  /alter\s+table\s+public\.workout_exercises[\s\S]{0,200}?add\s+column\s+if\s+not\s+exists\s+target_weight_kg/i.test(migSql));
ok('Zielgewicht ist begrenzt (Tippfehler-Riegel), NULL bleibt erlaubt',
  /tpe_target_weight_range[\s\S]{0,200}?target_weight_kg\s+is\s+null[\s\S]{0,120}?500/i.test(migSql) &&
  /we_target_weight_range[\s\S]{0,200}?target_weight_kg\s+is\s+null[\s\S]{0,120}?500/i.test(migSql));
ok('die Migration loescht nichts (additiv — kein drop table/column)',
  !/\bdrop\s+(table|column)\b/i.test(migSql));
ok('kein NOT NULL ohne Default auf einer BESTEHENDEN Tabelle (bräche laufende Schreibpfade)',
  !/add\s+column\s+if\s+not\s+exists\s+\w+\s+[\w()]+\s+not\s+null(?!\s+default)/i.test(migSql));

/* ══ S2 · Satztyp und Importherkunft kontrolliert ══ */
sec('S2 · Satztyp und Importherkunft in der Datenbank');
ok('set_type bekommt ein CHECK (bisher nahm die DB jede Zeichenkette an)',
  /workout_sets_set_type_check[\s\S]{0,400}?set_type\s+in\s*\(/i.test(migSql));
const SET_TYPES = globalThis.ORVIA.trainingDomain.SET_TYPES;
const checkBlock = (migSql.match(/workout_sets_set_type_check[\s\S]{0,500}?\)\s*\n?\s*not\s+valid/i) || [''])[0];
ok('das CHECK deckt ALLE Satztypen des Clients ab (sonst brechen bestehende Schreibpfade)',
  SET_TYPES.every(t => checkBlock.includes("'" + t + "'")),
  SET_TYPES.filter(t => !checkBlock.includes("'" + t + "'")).join(', ') || 'alle 10');
ok('das CHECK ist NOT VALID — Altbestand wird nicht rueckwirkend abgelehnt',
  /not\s+valid/i.test(checkBlock));
ok('workout_sets bekommt source mit Default manual (Altbestand bleibt gueltig)',
  /add\s+column\s+if\s+not\s+exists\s+source\s+text\s+not\s+null\s+default\s+'manual'/i.test(migSql));
ok('importierte Saetze tragen einen Pruefstatus',
  /ws_import_status_known[\s\S]{0,300}?'pending'[\s\S]{0,120}?'confirmed'/i.test(migSql));
/* BEIDE Richtungen pruefen. Nur die Import-Haelfte zu pruefen liess eine
   Mutation durch, die die Manual-Haelfte entfernte (Probe M10 blieb gruen) —
   dieselbe Familie wie die Volumenluecke M4: eine zweiseitige Zusage nur
   einseitig geprueft. */
ok('Herkunft und Pruefstatus muessen zusammenpassen (kein Import OHNE Status)',
  /ws_source_status_consistent[\s\S]{0,300}?source\s*=\s*'garmin_import'\s+and\s+import_status\s+is\s+not\s+null/i.test(migSql));
ok('… und kein manueller Satz MIT Status (sonst zaehlte „unklar" spaeter als bestaetigt)',
  /ws_source_status_consistent[\s\S]{0,300}?source\s*=\s*'manual'\s+and\s+import_status\s+is\s+null/i.test(migSql));
ok('wiederholter Sync kann keine Duplikate erzeugen (unique auf der externen Satzidentitaet)',
  /create\s+unique\s+index[\s\S]{0,200}?workout_sets\s*\(\s*user_id,\s*external_set_key\s*\)[\s\S]{0,120}?where\s+external_set_key\s+is\s+not\s+null/i.test(migSql));
ok('Erkennungswahrscheinlichkeit ist auf 0..1 begrenzt',
  /ws_recognition_range[\s\S]{0,200}?recognition_probability\s*>=\s*0[\s\S]{0,80}?<=\s*1/i.test(migSql));

/* ══ S3 · Identitaetskette vollstaendig ══ */
sec('S3 · Persistente Identitaetskette');
ok('Tabelle strength_workout_exports wird angelegt',
  /create\s+table\s+if\s+not\s+exists\s+public\.strength_workout_exports/i.test(migSql));
for (const col of ['occurrence_id', 'client_ref', 'garmin_workout_id', 'garmin_activity_id',
  'step_bindings', 'mapping_version', 'payload_version']) {
  ok('  Kette traegt ' + col, new RegExp('^\\s*' + col + '\\s', 'mi').test(migSql));
}
ok('derselbe Export kann nicht doppelt entstehen (unique user_id + client_ref)',
  /unique\s*\(\s*user_id,\s*client_ref\s*\)/i.test(migSql));
ok('zwei Exporte koennen nicht auf dasselbe Garmin-Workout zeigen (Zuordnung bliebe mehrdeutig)',
  /create\s+unique\s+index[\s\S]{0,200}?strength_workout_exports\s*\(\s*user_id,\s*garmin_workout_id\s*\)/i.test(migSql));
ok('„uebertragen" ohne Garmin-ID ist unmoeglich',
  /swe_pushed_needs_id[\s\S]{0,200}?garmin_workout_id\s+is\s+not\s+null/i.test(migSql));
ok('RLS ist aktiv und erzwungen',
  /alter\s+table\s+public\.strength_workout_exports\s+enable\s+row\s+level\s+security/i.test(migSql) &&
  /alter\s+table\s+public\.strength_workout_exports\s+force\s+row\s+level\s+security/i.test(migSql));
ok('alle vier Owner-Policies existieren',
  ['sel_own', 'ins_own', 'upd_own', 'del_own'].every(p =>
    new RegExp('create\\s+policy\\s+' + p + '\\s+on\\s+public\\.strength_workout_exports', 'i').test(migSql)));
ok('anon/public haben keinerlei Rechte',
  /revoke\s+all\s+on\s+public\.strength_workout_exports\s+from\s+anon,\s*public/i.test(migSql));

/* ══ S4 · Reinheit und Vertragstreue ══ */
sec('S4 · Datenvertrag: Reinheit');
const inA = EX();
const snapshot = JSON.stringify(inA);
const r1 = SP.normalizePlanned(inA);
const r2 = SP.normalizePlanned(EX());
ok('gleiche Eingabe ⇒ identische Ausgabe', JSON.stringify(r1) === JSON.stringify(r2));
ok('die Eingabe wird NICHT veraendert', JSON.stringify(inA) === snapshot);
ok('drei gueltige Uebungen kommen als drei zurueck', r1.ok === true && r1.exercises.length === 3);
const keys = Object.keys(r1.exercises[0]).sort().join(',');
ok('jede Uebung traegt genau die vertraglichen Felder',
  keys === 'exerciseId,maxReps,minReps,note,order,restSeconds,sets,targetRir,targetWeightKg', keys);
const withJunk = SP.normalizePlanned([{ exerciseId: 'x', sets: 3, evilField: 'DROP TABLE', __proto__x: 1 }]);
ok('unbekannte Felder wandern NICHT in den persistierten Plan',
  withJunk.ok && !('evilField' in withJunk.exercises[0]));
ok('attachPlanned gibt eine Kopie zurueck und laesst das Item unveraendert', (() => {
  const item = { t: 'Gym', l: 'Push', d: '45 min' };
  const out = SP.attachPlanned(item, EX());
  return !('plannedExercises' in item) && out.plannedExercises.length === 3 && out.l === 'Push';
})());
ok('eine leere Liste hinterlaesst KEIN leeres Array im Plan', (() => {
  const out = SP.attachPlanned({ t: 'Gym', plannedExercises: EX() }, []);
  return !('plannedExercises' in out);
})());

/* ══ S5 · Fail-closed ══ */
sec('S5 · Fail-closed statt Reparatur');
const noSets = SP.normalizeExercise({ exerciseId: 'bench_press', minReps: 8, maxReps: 8 });
ok('fehlende Satzanzahl wird ABGEWIESEN (3 waere geraten)',
  noSets.ok === false && noSets.errors.some(e => e.field === 'sets' && e.code === 'missing'));
ok('  … und es entsteht kein Ersatzwert', noSets.value === null);
const negW = SP.normalizeExercise({ exerciseId: 'x', sets: 3, targetWeightKg: -20 });
ok('negatives Zielgewicht wird abgewiesen, NICHT auf 0 gezogen',
  negW.ok === false && negW.errors.some(e => e.field === 'targetWeightKg' && e.code === 'out_of_range'));
ok('0 kg ist ausdruecklich erlaubt (Koerpergewichtsuebung)',
  SP.normalizeExercise({ exerciseId: 'x', sets: 3, targetWeightKg: 0 }).value.targetWeightKg === 0);
const rev = SP.normalizeExercise({ exerciseId: 'x', sets: 3, minReps: 12, maxReps: 6 });
ok('verdrehter Wiederholungsbereich wird abgewiesen, nicht stillschweigend getauscht',
  rev.ok === false && rev.errors.some(e => e.code === 'reversed_range'));
ok('fehlende Uebungskennung wird abgewiesen',
  SP.normalizeExercise({ sets: 3 }).errors.some(e => e.field === 'exerciseId' && e.code === 'missing'));
ok('Nicht-Zahlen werden nicht als Zahl gelesen',
  SP.normalizeExercise({ exerciseId: 'x', sets: '3' }).ok === false);
const mixed = SP.normalizePlanned([EX()[0], { exerciseId: 'kaputt' }, EX()[1]]);
ok('eine kaputte Zeile verwirft nicht die ganze Einheit',
  mixed.exercises.length === 2 && mixed.dropped === 1 && mixed.ok === false);
ok('  … und der Grund ist mit Zeilenindex benannt',
  mixed.errors.some(e => e.index === 1 && e.field === 'sets'));
const tooMany = SP.normalizePlanned(Array.from({ length: 25 }, (_, i) => ({ exerciseId: 'e' + i, sets: 3 })));
ok('die Obergrenze schneidet sichtbar ab, nicht still',
  tooMany.exercises.length === SP.LIMITS.maxExercises && tooMany.dropped === 5 &&
  tooMany.errors.some(e => e.code === 'too_many'));
ok('keine Liste ⇒ Fehler statt leerem Erfolg',
  SP.normalizePlanned('nicht-array').ok === false);

/* ── Luecken aus dem Probenlauf v8-330 ────────────────────────────────
   Beide Zusicherungen waren beschrieben, aber von keinem Test gedeckt:
   eine Mutation blieb gruen. Muster S7 = value_not_type (die Laenge ist
   eine Wertgrenze, kein Typ), Muster S8 = neighbour_guard (der Editor
   haelt den Zustand selbst, dadurch fiel der Verlust nirgends auf). */
{
  const langeNotiz = 'A'.repeat(SP.LIMITS.noteChars + 50);
  const gekuerzt = SP.normalizeExercise({ exerciseId: 'x', sets: 3, note: langeNotiz }).value;
  ok('ueberlange Notiz wird auf die Vertragsgrenze gekuerzt statt unbegrenzt gespeichert',
    gekuerzt.note.length === SP.LIMITS.noteChars && gekuerzt.note === 'A'.repeat(SP.LIMITS.noteChars),
    String(gekuerzt.note.length));
  const knapp = 'B'.repeat(SP.LIMITS.noteChars);
  ok('  … eine Notiz genau auf der Grenze bleibt unveraendert (kein Abschneiden auf Verdacht)',
    SP.normalizeExercise({ exerciseId: 'x', sets: 3, note: knapp }).value.note === knapp);
}
{
  /* Der teuerste denkbare Regressionsfall des Planeditors: eine ungueltige
     Eingabe darf die bereits geplanten Uebungen nicht loeschen. */
  const bestand = SP.normalizePlanned(EX()).exercises;
  const kaputt = SP.insertExercise(bestand, { exerciseId: 'ohne_saetze' }, 1);
  ok('fehlgeschlagenes Einfuegen laesst die bestehende Liste UNVERAENDERT (kein Datenverlust im Editor)',
    kaputt.ok === false && kaputt.exercises.length === bestand.length &&
    JSON.stringify(kaputt.exercises) === JSON.stringify(bestand),
    JSON.stringify(kaputt.exercises.map(e => e.exerciseId)));
  const voll = SP.normalizePlanned(Array.from({ length: SP.LIMITS.maxExercises }, (_, i) => ({ exerciseId: 'e' + i, sets: 3 }))).exercises;
  const zuViel = SP.insertExercise(voll, { exerciseId: 'einer_zuviel', sets: 3 }, 0);
  ok('  … das gilt auch beim Anschlagen der Obergrenze',
    zuViel.ok === false && zuViel.exercises.length === SP.LIMITS.maxExercises &&
    JSON.stringify(zuViel.exercises) === JSON.stringify(voll));
  const schlecht = SP.updateExerciseAt(bestand, 0, { sets: 999 });
  ok('  … und bei einer ungueltigen Aenderung bleibt die Liste ebenfalls stehen',
    schlecht.ok === false && JSON.stringify(schlecht.exercises) === JSON.stringify(bestand));
}

/* ══ S6 · Die zwei erlaubten Bedeutungsfaelle ══ */
sec('S6 · Bedeutung statt Raten');
const fix = SP.normalizeExercise({ exerciseId: 'x', sets: 4, maxReps: 8 }).value;
ok('nur maxReps gesetzt ⇒ feste Wiederholungszahl (min = max)', fix.minReps === 8 && fix.maxReps === 8);
const fix2 = SP.normalizeExercise({ exerciseId: 'x', sets: 4, minReps: 5 }).value;
ok('nur minReps gesetzt ⇒ ebenso', fix2.minReps === 5 && fix2.maxReps === 5);
ok('gar keine Wiederholungsangabe bleibt null (keine erfundene 10)',
  (() => { const v = SP.normalizeExercise({ exerciseId: 'x', sets: 4 }).value; return v.minReps === null && v.maxReps === null; })());
const ordered = SP.normalizePlanned([
  { exerciseId: 'c', sets: 3, order: 9 },
  { exerciseId: 'a', sets: 3, order: 2 },
  { exerciseId: 'b', sets: 3, order: 5 }
]).exercises;
ok('mitgelieferte Reihenfolge bestimmt die Sortierung',
  ordered.map(e => e.exerciseId).join('') === 'abc');
ok('… die gespeicherte Reihenfolge ist danach lueckenlos 1..n (keine Schrittabstaende fuer den Exporter)',
  ordered.map(e => e.order).join(',') === '1,2,3');
ok('ohne Reihenfolge zaehlt die Listenposition',
  SP.normalizePlanned(EX()).exercises.map(e => e.order).join(',') === '1,2,3');

/* ══ S7 · Altbestand ══ */
sec('S7 · Altbestand bleibt gueltig');
ok('ein Gym-Item OHNE Vorgaben ist kein Fehler',
  SP.readPlanned({ t: 'Gym', l: 'Ganzkörper', d: '45 min' }).length === 0);
ok('hasPlanned unterscheidet sauber',
  SP.hasPlanned({ t: 'Gym' }) === false && SP.hasPlanned(SP.attachPlanned({ t: 'Gym' }, EX())) === true);
ok('readPlanned liefert IMMER ein Array (auch bei Unsinn)',
  Array.isArray(SP.readPlanned(null)) && Array.isArray(SP.readPlanned(42)) &&
  Array.isArray(SP.readPlanned({ t: 'Gym', plannedExercises: 'kaputt' })));

/* ══ S8 · Anzeige ══ */
sec('S8 · Anzeige benennt Unaufgeloestes');
const NAMES = { bench_press: 'Bankdrücken', barbell_row: 'Rudern', ohp: 'Schulterdrücken' };
const lines = SP.summarizePlanned(EX(), id => NAMES[id]);
ok('Bereich wird als Bereich gezeigt', lines[0] === 'Bankdrücken — 4 × 6–8 · 80 kg · 150 s Pause', lines[0]);
ok('feste Wiederholung wird nicht als Bereich gezeigt', lines[2] === 'Schulterdrücken — 3 × 8 · 25 kg', lines[2]);
/* v8-323: die Pause gehoert in die Anzeige (Gians K2-Umfang). Fehlt sie —
   dritte Uebung im Fixture —, steht dort NICHTS statt eines erfundenen Werts. */
ok('die Pause wird gezeigt, wenn sie geplant ist', / · 150 s Pause$/.test(lines[0]), lines[0]);
ok('… und fehlt ersatzlos, wenn keine geplant ist', !/Pause/.test(lines[2]), lines[2]);
ok('ohne Wiederholungsangabe steht die Satzanzahl',
  SP.summarizeExercise(SP.normalizeExercise({ exerciseId: 'x', sets: 1 }).value, () => 'Klimmzug') === 'Klimmzug — 1 Satz');
ok('0 kg wird ausgeschrieben, nicht als „0 kg" gezeigt',
  /ohne Zusatzlast/.test(SP.summarizeExercise(SP.normalizeExercise({ exerciseId: 'x', sets: 3, targetWeightKg: 0 }).value, () => 'Liegestütz')));
ok('ein unbekannter Name wird NICHT erfunden — die Kennung bleibt sichtbar',
  SP.summarizeExercise(SP.normalizeExercise({ exerciseId: 'unbekannt_42', sets: 3 }).value, () => null)
    .startsWith('unbekannt_42'));

/* ══ S9 · Dauer reagiert auf den Umfang ══ */
sec('S9 · Dauer statt Konstante');
const dSmall = SP.estimateDurationMin(EX());
const dBig = SP.estimateDurationMin(Array.from({ length: 6 }, (_, i) =>
  ({ exerciseId: 'e' + i, sets: 5, minReps: 5, maxReps: 5, targetWeightKg: 60, restSeconds: 180 })));
ok('eine kleine Einheit ergibt 25 min (nachgerechnet: 610+360+360+120 s)', dSmall === 25, String(dSmall));
ok('eine grosse Einheit ergibt 95 min (nachgerechnet: 6×920+300 s)', dBig === 95, String(dBig));
ok('die Schaetzung ist NICHT die alte Konstante 45', dSmall !== 45 && dBig !== 45);
ok('mehr Umfang ⇒ mehr Zeit', dBig > dSmall);
ok('laengere Pausen ⇒ mehr Zeit (die Pause zaehlt wirklich mit)',
  SP.estimateDurationMin([{ exerciseId: 'x', sets: 5, restSeconds: 300 }]) >
  SP.estimateDurationMin([{ exerciseId: 'x', sets: 5, restSeconds: 60 }]));
ok('ohne geplante Uebung gibt es KEINE Zahl (0 min waere eine Aussage)',
  SP.estimateDurationMin([]) === null && SP.estimateDurationMin(null) === null);

/* ══ S10 · Nicht bewertbar ist nicht 0 ══ */
sec('S10 · Nicht bewertbares Volumen');
const vol = SP.plannedVolumeKg(EX());
ok('Volumen wird gerechnet, wenn Gewicht und Wiederholungen da sind',
  vol.applicable === true && vol.kg === Math.round(4 * 7 * 80 + 3 * 9 * 65 + 3 * 8 * 25), String(vol.kg));
/* Der unterscheidende Fall ist eine Uebung MIT Wiederholungen, aber OHNE
   Zielgewicht — nur er trennt „uebersprungen" von „als 0 kg mitgezaehlt".
   Eine Uebung ganz ohne Angaben faellt schon an der Wiederholungspruefung raus
   und beweist nichts (Mutationsprobe M4 blieb damit gruen — eigene Testluecke,
   siehe sw.js-Kopf v8-321). */
const volMixed = SP.plannedVolumeKg([EX()[0], { exerciseId: 'x', sets: 3, minReps: 10, maxReps: 10 }]);
ok('eine Uebung MIT Wdh. aber OHNE Zielgewicht zaehlt NICHT als 0 kg, sondern als uebersprungen',
  volMixed.kg === 4 * 7 * 80 && volMixed.counted === 1 && volMixed.skipped === 1,
  JSON.stringify(volMixed));
ok('eine Uebung ganz ohne Angaben wird ebenfalls uebersprungen',
  (() => { const v = SP.plannedVolumeKg([EX()[0], { exerciseId: 'x', sets: 3 }]); return v.counted === 1 && v.skipped === 1; })());
ok('gar nichts bewertbar ⇒ applicable=false statt einer erfundenen 0',
  (() => { const v = SP.plannedVolumeKg([{ exerciseId: 'x', sets: 3, minReps: 10, maxReps: 10 }]); return v.applicable === false && v.kg === null; })());

/* ══ S11 · Fingerabdruck ══ */
sec('S11 · Geaenderte Vorgaben sind erkennbar');
const f1 = SP.fingerprint(EX());
ok('gleicher Plan ⇒ gleicher Fingerabdruck', f1 === SP.fingerprint(EX()));
const changed = EX(); changed[0].targetWeightKg = 82.5;
ok('geaendertes Zielgewicht ⇒ anderer Fingerabdruck', SP.fingerprint(changed) !== f1);
const reordered = [EX()[2], EX()[1], EX()[0]].map((e, i) => Object.assign({}, e, { order: 3 - i }));
ok('nur umsortiert (mit order) ⇒ derselbe Plan, derselbe Fingerabdruck',
  SP.fingerprint(reordered) === f1);
ok('der Fingerabdruck traegt die Modulfassung (alte Werte sind erkennbar alt)',
  f1.startsWith(SP.VERSION + ':'));

/* ══ S12 · Sportart normalisieren, nicht raten ══ */
sec('S12 · Sportart-Erkennung');
ok('Gym wird erkannt', SP.isStrengthItem({ t: 'Gym' }) === true);
ok('gross/klein spielt keine Rolle', SP.isStrengthItem({ t: 'gym' }) === true);
ok('Laufen ist keine Krafteinheit', SP.isStrengthItem({ t: 'Laufen' }) === false);
ok('„Gymnastik" wird NICHT per Teilstring als Gym gelesen (der v8-316-Fehler)',
  SP.isStrengthItem({ t: 'Gymnastik' }) === false);
ok('ohne Normalisierer wird NICHTS geraten', (() => {
  const keep = globalThis.ORVIA.trainingDomain;
  globalThis.ORVIA.trainingDomain = undefined;
  const r = SP.isStrengthItem({ t: 'Gym' });
  globalThis.ORVIA.trainingDomain = keep;
  return r === false;
})());

/* ══ S13 · Persistenz gegen das ECHTE plan-domain ══ */
sec('S13 · Die Vorgaben ueberleben den echten Persistenzweg');
await import(pathToFileURL(join(APP, 'js/plan-domain.js')).href);
const PD = globalThis.ORVIA.planDomain;
ok('plan-domain ist geladen', !!PD);
if (PD) {
  /* Feste ps:-ID und injizierte Fabriken — der Test darf nicht von Zufall
     oder Uhr abhaengen (dieselbe Regel wie beim Wochen-Cache in v8-315). */
  const gymItem = SP.attachPlanned({ id: 'ps:test:gym1', t: 'Gym', l: 'Oberkörper', d: '45 min' }, EX());
  const week = [[], [], [gymItem], [], [], [], []];
  const plan = PD.fromLegacyWeekPlan(week, { source: 'manual_edit' },
    { weekKey: '2026-W33', now: 0, idFactory: (di, j) => 'ps:test:' + di + ':' + j });
  ok('  ein Wochenplan mit Kraftvorgaben laesst sich ins kanonische Modell ueberfuehren', !!plan);

  /* Der echte Persistenzweg ist JSON — genau das tut weekPlanRepository.toRow. */
  const roundTripped = JSON.parse(JSON.stringify(plan));
  const sess = (roundTripped.baseline.sessions || []).map(s => s.session).filter(s => s && s.t === 'Gym');
  ok('  die Gym-Einheit ueberlebt die Serialisierung', sess.length === 1);
  ok('  … MIT den geplanten Uebungen (das Feld wird nicht weggeschnitten)',
    sess.length === 1 && SP.readPlanned(sess[0]).length === 3);
  ok('  … und mit dem Zielgewicht der ersten Uebung',
    sess.length === 1 && SP.readPlanned(sess[0])[0].targetWeightKg === 80);
  /* validatePlan liefert eine FEHLERLISTE (leer = gueltig), keinen ok-Schalter. */
  const vErrs = PD.validatePlan(roundTripped);
  ok('  der Plan ist nach dem Anhaengen der Vorgaben weiterhin vertragsgueltig',
    Array.isArray(vErrs) && vErrs.length === 0, JSON.stringify(vErrs));

  /* Aenderungserkennung: aendert sich NUR das Zielgewicht, muss der
     Persistenzweg das als inhaltliche Aenderung sehen — sonst ginge eine
     Gewichtskorrektur beim naechsten Speichern still verloren. */
  const eff = PD.effectiveSessions(roundTripped);
  const week2 = JSON.parse(JSON.stringify(week));
  week2[2][0].plannedExercises[0].targetWeightKg = 85;
  const ovs = PD.diffEditedDays(eff, week2, { reason: 'test', now: 0, ovIdFactory: () => 'ov:test' });
  ok('  eine reine Gewichtsaenderung wird als inhaltliche Aenderung erkannt',
    ovs.length === 1 && ovs[0].type === 'replace', JSON.stringify(ovs.map(o => o.type)));
  ok('  … und der Override traegt das NEUE Gewicht',
    ovs.length === 1 && SP.readPlanned(ovs[0].session)[0].targetWeightKg === 85);
  const unchanged = PD.diffEditedDays(eff, JSON.parse(JSON.stringify(week)),
    { reason: 'test', now: 0, ovIdFactory: () => 'ov:test' });
  ok('  ein unveraenderter Plan erzeugt KEINEN Override (kein Rauschen in der Historie)',
    unchanged.length === 0, JSON.stringify(unchanged.map(o => o.type)));
}

/* ══ S14 · Wirklich geladen ══ */
sec('S14 · Im Produkt geladen');
ok('strength-plan.js ist in index.html eingebunden',
  /<script\s+src="js\/engine\/strength-plan\.js"><\/script>/.test(htmlRaw));
ok('… NACH training-domain.js (sonst faellt die Sportart-Erkennung aus)',
  htmlRaw.indexOf('js/engine/strength-plan.js') > htmlRaw.indexOf('js/training-domain.js'));

/* ══ S15 · Offline-Paritaet ══
   EIGENER FUND dieser Runde: js/engine/plan-quality.js wurde seit v8-316 von
   index.html geladen, stand aber NICHT im ASSETS-Vorrat des Service Workers —
   offline waeren die sechs Planqualitaets-Kacheln stumm ausgefallen, ohne dass
   irgendein Test das gemerkt haette. Diese Pruefung schliesst die Klasse.
   env.js ist die EINZIGE bewusste Ausnahme: die Umgebungskonfiguration darf
   nicht eingefroren werden, sonst zeigt ein Geraet nach einem Umzug dauerhaft
   auf die alte Instanz. */
sec('S15 · Offline-Paritaet index.html ⇄ Service Worker');
const swRaw = readFileSync(join(APP, 'sw.js'), 'utf8');
const OFFLINE_EXEMPT = ['env.js'];
const scripts = [...htmlRaw.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1])
  .filter(s => !/^https?:/.test(s));
const missing = scripts.filter(s => !OFFLINE_EXEMPT.includes(s) && !swRaw.includes("'./" + s + "'"));
ok('index.html laedt ueberhaupt Skripte', scripts.length > 100, String(scripts.length));
ok('JEDES geladene Skript liegt auch im Offline-Vorrat des Service Workers',
  missing.length === 0, missing.join(', '));
ok('env.js ist bewusst NICHT im Vorrat (Umgebung darf nicht einfrieren)',
  !swRaw.includes("'./env.js'"));

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
