/* ============================================================
   ORVIA · R1–R8 (2026-10-29) — Logik hinter verlustfreiem „Profil bearbeiten" (ohne Browser)
     S  Sport-Vorbelegung uebernimmt Rolle, Plan, Sichtbarkeit, Niveau, Haeufigkeit, Dauer (R2)
     B  Band antippen behaelt den genauen Wert im selben Band (R4)
     X  Geschlecht m/f/w/d → Onboarding-Werte; Abschluss schreibt wieder m/f/d (R5)
     W  Verdrahtung: frischer Entwurf im Bearbeiten-Modus (R1), Sport-Merge (R3),
        Beschwerde nur bei Aenderung (R6), ein Dialog (R7), Texte (R8)
   Den Rundlauf in der echten App prueft onboarding_edit_roundtrip_e2e_test.mjs (Playwright).
   node supabase/tests/onboarding_edit_logic_test.mjs
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const APP = [join(HERE, '..', '..', 'app'), join(HERE, '..', '..')].find(p => existsSync(join(p, 'js', 'onboarding', 'onboarding-ui.js')));
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const src = f => readFileSync(join(APP, f), 'utf8');
globalThis.window = globalThis;
const SL = require(join(APP, 'js/onboarding/onboarding-sports-logic.js'));
const PL = require(join(APP, 'js/onboarding/onboarding-profile-logic.js'));

/* ---------- S · R2 ---------- */
const seed = SL.seedFromExistingProfile({ sports: [
  { sportId: 'running', role: 'primary', level: 'intermediate', sessionsPerWeek: 3, typicalDuration: 45, includeInPlan: true, activeInApp: true },
  { sportId: 'gym', role: 'supplemental', sessionsPerWeek: 2, includeInPlan: false, activeInApp: true },
  { sportId: 'cycling', role: 'occasional', includeInPlan: false, activeInApp: false }] }).sports;
const by = id => seed.find(e => e.sportId === id);
ok('S1 Laufen: Hauptsportart, Niveau, 3×, 45 min, geplant', by('running').role === 'primary' && by('running').level === 'intermediate' && by('running').sessionsPerWeek === 3 && by('running').typicalDuration === 45 && by('running').planningEnabled === true);
ok('S2 Gym: „supplemental" → Nebensportart, 2×, NICHT geplant', by('gym').role === 'secondary' && by('gym').sessionsPerWeek === 2 && by('gym').planningEnabled === false);
ok('S3 Rad: gelegentlich, ausgeblendet', by('cycling').role === 'occasional' && by('cycling').visible === false);
const alt = SL.seedFromExistingProfile({ sports: ['running', 'gym'] }).sports;
ok('S4 alte ID-Liste: erste = Hauptsportart (wie bisher)', alt[0].role === 'primary' && alt[1].role === 'secondary');
const ohne = SL.seedFromExistingProfile({ sports: [{ sportId: 'gym', role: 'supplemental' }] }).sports;
ok('S5 keine Hauptsportart im Bestand → erste wird es', ohne[0].role === 'primary');
const src0 = { sports: [{ sportId: 'running', role: 'primary', sessionsPerWeek: 3 }] }; const snap = JSON.stringify(src0); SL.seedFromExistingProfile(src0);
ok('S6 Quelle wird nicht veraendert', JSON.stringify(src0) === snap);

/* ---------- B · R4 ---------- */
ok('B1 3× + Band „3–4" → bleibt 3', SL.sessionsForBandKeeping('3-4', 3) === 3);
ok('B2 3× + Band „5–6" → 6', SL.sessionsForBandKeeping('5-6', 3) === 6);
ok('B3 1× + Band „1–2" → bleibt 1; ohne Wert → oberer Bandwert', SL.sessionsForBandKeeping('1-2', 1) === 1 && SL.sessionsForBandKeeping('3-4', null) === 4);

/* ---------- X · R5 ---------- */
const sx = v => PL.profileSeedFromExisting({ sex: v }).sex;
ok('X1 f/w → weiblich, m → maennlich, d → divers', sx('f') === 'female' && sx('w') === 'female' && sx('m') === 'male' && sx('d') === 'diverse');
ok('X2 Onboarding-Werte bleiben, Unbekanntes wird nicht geraten', sx('female') === 'female' && sx('xyz') === '' && sx(null) === '');

/* ---------- W · Verdrahtung ---------- */
const ui = src('js/onboarding/onboarding-ui.js'); const de = src('locales/de.js');
ok('W1 R1: Bearbeiten ignoriert alten Entwurf', /S\.draft = \(opts\.edit \? null : existing\) \|\| L\(\)\.startDraft/.test(ui));
ok('W2 R1/R6: Bearbeiten belegt aus dem Profil vor', /_seedEditDraft\(\);/.test(ui) && /function safetyFromProfile\(P\)/.test(ui));
ok('W3 R3: Sportarten werden mit dem Bestand zusammengefuehrt (inkl. unbekannter)', /exById\[String\(e\.sportId\)\.toLowerCase\(\)\]/.test(ui) && /!_known\(s\.sportId\)/.test(ui) && !/patch\.sports = M\.normalizeSports\(sportsSel\.map/.test(ui));
ok('W4 R4: Band-Klick nutzt sessionsForBandKeeping', /sl\.sessionsForBandKeeping\(bandId/.test(ui));
ok('W5 R5: Abschluss schreibt m/f/d', /\{ male: 'm', female: 'f', diverse: 'd' \}\)\[pf\.sex\]/.test(ui));
ok('W6 R6: Beschwerde nur bei Aenderung, Basis = Profil-Liste', /curSig !== seedSig/.test(ui) && /existing\.constraintsList\.slice\(\)/.test(ui));
ok('W7 R7: verwaiste Dialoge werden vor dem Oeffnen entfernt', /querySelectorAll\('\.ob2-bg'\)/.test(ui));
ok('W8 R8: „Änderungen speichern" + Plural „weitere Ziele"', /'ob\.aenderungen_speichern': 'Änderungen speichern'/.test(de) && /'ob\.weitere_ziele': ' weitere Ziele'/.test(de) && /T\(S\.edit \? 'ob\.aenderungen_speichern'/.test(ui) && !/T\('ob\.weiteres_ziel'\) \+ '' \+ \(/.test(ui));

console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
