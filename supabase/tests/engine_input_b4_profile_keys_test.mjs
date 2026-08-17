/* ============================================================
   ORVIA · B4 — Vertragstest: der Snapshot liest die Schlüssel, die es gibt
   ------------------------------------------------------------
   WARUM ES DIESEN TEST GIBT (Fund 2026-08-13, behoben 2026-08-16):
   `collectRaw()` las `PROFILE.trainingPreferences` und `PROFILE.equipment`.
   Beide Schlüssel schreibt im ganzen Baum NIEMAND. Der erste lieferte deshalb
   immer null; der zweite steht in PROFILE_DEFAULTS als [] und lieferte eine
   LEERE LISTE — der Snapshot sah vollständig aus und war leer. Genau diese
   Fehlerklasse (ein Leser, den nichts widerlegt) fällt ohne Test nie auf.

   Dritter Teil desselben Befunds: `buildSnapshot` kopierte die Ausrüstung mit
   `Object.assign({}, raw.equipment)`. Aus einer Liste wurde ein Objekt mit
   Zahlen-Schlüsseln; jeder Leser mit `Array.isArray` sah danach nichts.

   GEGENPROBE (dokumentiert, am 2026-08-16 gefahren): Mit dem alten Code sind
   B4-1 und B4-2 rot; danach bricht der Lauf ab, weil `raw.equipment[0]` in der
   leeren Liste gar nicht existiert. Exit 1. Ein Test, der auch ohne den Fix
   grün wäre, würde hier nichts sichern.

   node supabase/tests/engine_input_b4_profile_keys_test.mjs
   ============================================================ */
import { readFileSync, existsSync as _exApp } from 'node:fs';
import vm from 'node:vm';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobust: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const base = new URL(_APPREL + 'js/', import.meta.url);
const TODAY = '2026-08-16';

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

function makeSb(PROFILE) {
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object;
  sb.String = String; sb.Number = Number; sb.Intl = Intl; sb.isNaN = isNaN; sb.isFinite = isFinite;
  sb.ORVIA = {};
  sb.todayStr = (d) => { const x = d || new Date(TODAY + 'T12:00:00'); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  if (PROFILE) sb.PROFILE = PROFILE;
  vm.createContext(sb);
  ['engine/engine-contracts.js', 'engine/readiness-engine-v2.js', 'engine/decision-engine-v2.js',
   'checkin-field-resolver.js', 'engine/training-input-resolver.js']
    .forEach(f => vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  return sb;
}

/* ---------- A) collectRaw liest die kanonischen Profilschlüssel ---------- */
{
  const equipment = [{ id: 'kb16', name: 'Kettlebell 16 kg' }, { id: 'bar', name: 'Langhantel' }];
  const sb = makeSb({
    v: 1,
    preferences: { intensityPreference: 'easy', adaptationMode: 'assisted', preferredEnvironment: 'outdoor' },
    devices: { equipment: equipment },
    equipment: [],                 // PROFILE_DEFAULTS-Altlast: existiert, ist aber nie gefüllt
    sports: [], goals: [], constraintsList: []
  });
  const raw = sb.ORVIA.trainingInputResolver.collectRaw();

  ok('B4-1 Präferenzen kommen an (PROFILE.preferences, nicht trainingPreferences)',
    !!raw.preferences && raw.preferences.intensityPreference === 'easy',
    raw.preferences ? 'intensityPreference=' + raw.preferences.intensityPreference : 'null — der alte Schlüssel war leer');

  ok('B4-2 Ausrüstung kommt an (PROFILE.devices.equipment, nicht PROFILE.equipment)',
    Array.isArray(raw.equipment) && raw.equipment.length === 2 && raw.equipment[0].id === 'kb16',
    Array.isArray(raw.equipment) ? raw.equipment.length + ' Einträge' : JSON.stringify(raw.equipment));

  raw.equipment[0].id = 'VERAENDERT';
  ok('B4-3 nicht-mutierend: das Profil bleibt unangetastet',
    equipment[0].id === 'kb16', 'Profilwert: ' + equipment[0].id);
}

/* ---------- B) Legacy-Profil: trainingPrefs ist die dokumentierte Altquelle ---------- */
{
  const sb = makeSb({ v: 1, trainingPrefs: { indoorOutdoor: 'outdoor' }, sports: [], goals: [], constraintsList: [] });
  const raw = sb.ORVIA.trainingInputResolver.collectRaw();
  ok('B4-4 Altprofil ohne `preferences` verliert seine Präferenzen nicht',
    !!raw.preferences && raw.preferences.indoorOutdoor === 'outdoor',
    JSON.stringify(raw.preferences));
}

/* ---------- C) Leer ist nicht dasselbe wie nicht erfasst ---------- */
{
  const sb = makeSb({ v: 1, devices: { equipment: [] }, sports: [], goals: [], constraintsList: [] });
  const raw = sb.ORVIA.trainingInputResolver.collectRaw();
  ok('B4-5 keine erfasste Ausrüstung ⇒ null, nicht []',
    raw.equipment === null,
    JSON.stringify(raw.equipment) + ' (eine leere Liste behauptet „erfasst und leer")');
}

/* ---------- D) buildSnapshot zerstört die Listen-Natur nicht ---------- */
{
  const sb = makeSb(null);
  const R = sb.ORVIA.trainingInputResolver;
  const quelle = [{ id: 'kb16' }];
  const snap = R.buildSnapshot({
    now: 1789000000000, timezone: 'Europe/Berlin', today: TODAY,
    equipment: quelle, preferences: { intensityPreference: 'easy' },
    sports: [], goals: [], constraints: [], collectErrors: []
  });
  ok('B4-6 snapshot.equipment bleibt eine Liste (Array.isArray-Leser sehen sie)',
    Array.isArray(snap.equipment) && snap.equipment.length === 1,
    Array.isArray(snap.equipment) ? 'Array' : typeof snap.equipment + ': ' + JSON.stringify(snap.equipment));

  snap.equipment[0].id = 'VERAENDERT';
  ok('B4-7 buildSnapshot bleibt nicht-mutierend', quelle[0].id === 'kb16', 'Quelle: ' + quelle[0].id);

  ok('B4-8 snapshot.preferences kommt durch', !!snap.preferences && snap.preferences.intensityPreference === 'easy');

  const leer = R.buildSnapshot({ now: 1, timezone: 'Europe/Berlin', today: TODAY, collectErrors: [] });
  ok('B4-9 ohne Ausrüstung bleibt der Snapshot ehrlich null', leer.equipment === null, JSON.stringify(leer.equipment));
}

console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
