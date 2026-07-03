/* ORVIA · Issue #6 — Altersgrenzen-Vertrag (kanonisch, eine Implementierung).
   VERTRAG (Referenzdatum `now`, lokaler Kalendertag, Zeitanteile irrelevant):
   - 13. Geburtstag HEUTE → gültig · morgen → ungültig · gestern → gültig
   - exakt 100 → gültig · 100 Jahre + 1 Tag → ungültig
   - 29.02.-Geburtstag: in Nicht-Schaltjahren zählt das Jahr erst am 01.03. als voll
   - ageEstimate: 13/100 gültig, 12/101 ungültig (derselbe Bereich)
   - ohne `today`-Parameter zählt ORVIA.clock (injizierbar), nie stilles Date.now()
   - profile-store.computeAge delegiert an onboardingProfileLogic.calculateAge
     (KEINE parallele Altersmathematik) und behält nur Adapter-Regeln
     (ungültiges Datum → Schätzung, Anzeige-Klemme 0–119).
   Feste Uhr über _helpers.fixedClock. */
import { readFileSync } from 'node:fs';
import { fixedClock } from './_helpers.mjs';

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

globalThis.window = globalThis;   // Browser-Realität: window === globalThis (profile-store nutzt window.ORVIA)
globalThis.ORVIA = globalThis.ORVIA || {};
await import(new URL('../../js/clock.js', import.meta.url));
const P = (await import(new URL('../../js/onboarding/onboarding-profile-logic.js', import.meta.url))).default;
await import(new URL('../../js/onboarding/onboarding-sports-logic.js', import.meta.url));
const L = (await import(new URL('../../js/onboarding/onboarding-logic.js', import.meta.url))).default;
await import(new URL('../../js/profile-store.js', import.meta.url));
const O = globalThis.ORVIA;

const T = new Date(2026, 5, 15);            // 2026-06-15 lokal, 00:00
const base = { displayName: 'Alex' };
const v = (p, today) => P.validateProfile(Object.assign({}, base, p), today);

// 1) exakt 13 heute → gültig
ok('1 exakt 13 heute → gültig', v({ birthDate: '2013-06-15' }, T).valid === true && P.calculateAge('2013-06-15', T) === 13);
// 2) wird morgen 13 → noch 12 → ungültig
ok('2 wird morgen 13 → ungültig', !!v({ birthDate: '2013-06-16' }, T).errors.birthDate && P.calculateAge('2013-06-16', T) === 12);
// 3) wurde gestern 13 → gültig
ok('3 wurde gestern 13 → gültig', v({ birthDate: '2013-06-14' }, T).valid === true);
// 4) exakt 100 heute → gültig
ok('4 exakt 100 heute → gültig', v({ birthDate: '1926-06-15' }, T).valid === true && P.calculateAge('1926-06-15', T) === 100);
// 5) 100 Jahre + 1 Tag (seit gestern 101) → ungültig
ok('5 seit gestern 101 → ungültig', !!v({ birthDate: '1925-06-14' }, T).errors.birthDate && P.calculateAge('1925-06-14', T) === 101);
// 6) 29.02.-Geburtstag am 28.02. eines Nicht-Schaltjahres → Jahr noch nicht voll
const T28 = new Date(2025, 1, 28);
ok('6 29.02.-Geb. am 28.02.2025 → 12, ungültig', P.calculateAge('2012-02-29', T28) === 12 && !!v({ birthDate: '2012-02-29' }, T28).errors.birthDate);
// 7) 29.02.-Geburtstag am 01.03. → Jahr voll
const T01 = new Date(2025, 2, 1);
ok('7 29.02.-Geb. am 01.03.2025 → 13, gültig', P.calculateAge('2012-02-29', T01) === 13 && v({ birthDate: '2012-02-29' }, T01).valid === true);
// 8–11) ageEstimate: exakt derselbe Bereich 13–100 einschließlich
ok('8 ageEstimate 13 → gültig', v({ ageEstimate: 13 }, T).valid === true);
ok('9 ageEstimate 12 → ungültig', !!v({ ageEstimate: 12 }, T).errors.ageEstimate);
ok('10 ageEstimate 100 → gültig', v({ ageEstimate: 100 }, T).valid === true);
ok('11 ageEstimate 101 → ungültig', !!v({ ageEstimate: 101 }, T).errors.ageEstimate);
// 12) ungültiges Datum (29.02. im Nicht-Schaltjahr)
ok('12 ungültiges Datum → Fehler, Alter null', !!v({ birthDate: '2021-02-29' }, T).errors.birthDate && P.calculateAge('2021-02-29', T) === null);
// 13) Zukunftsdatum
ok('13 Zukunftsdatum → Fehler', !!v({ birthDate: '2030-01-01' }, T).errors.birthDate);
// 14) Zeitanteile verschieben das Ergebnis nicht (gleicher Kalendertag, drei Uhrzeiten)
const times = [new Date(2026, 5, 15, 0, 0), new Date(2026, 5, 15, 12, 0), new Date(2026, 5, 15, 23, 59)];
ok('14 Grenzfall stabil über Uhrzeiten (gültig)', times.every(t => v({ birthDate: '2013-06-15' }, t).valid === true));
ok('14b Grenzfall stabil über Uhrzeiten (ungültig)', times.every(t => !!v({ birthDate: '2013-06-16' }, t).errors.birthDate));

/* ===== 15) Ein Vertrag überall: Clock-Pfad + M5a-Submit-Pfad + profile-store ===== */
const CLK = fixedClock(new Date(2026, 5, 15, 12).getTime());
O.clock._setImplementation(CLK);
// 15a) validateProfile OHNE today-Parameter nutzt ORVIA.clock (nicht stilles Echtzeit-Date)
ok('15a ohne today: Clock zählt (morgen 13 → ungültig)', !!P.validateProfile(Object.assign({}, base, { birthDate: '2013-06-16' })).errors.birthDate);
ok('15b ohne today: Clock zählt (heute 13 → gültig)', P.validateProfile(Object.assign({}, base, { birthDate: '2013-06-15' })).valid === true);
// 15c) M5a-Submit-Pfad (advanceProfile) verwendet exakt denselben Vertrag
const mkDraft = bd => L.normalizeDraft({ version: 3, status: 'in_progress', currentStep: 'profile', completedSteps: ['welcome'], draftData: { profile: { displayName: 'Alex', birthDate: bd } } });
const r1 = L.advanceProfile(mkDraft('2013-06-16'));
ok('15c advanceProfile: morgen 13 → blockiert', r1.ok === false && !!r1.errors.birthDate);
const r2 = L.advanceProfile(mkDraft('2013-06-15'));
ok('15d advanceProfile: heute 13 → weiter', r2.ok === true);
// 15e) profile-store.computeAge: identisches Ergebnis, delegiert (keine Parallel-Mathematik)
ok('15e computeAge === calculateAge (Grenztag)', O.profileStore.computeAge('2013-06-16', null) === P.calculateAge('2013-06-16', new Date(CLK.now())));
ok('15f computeAge Adapter: ungültiges Datum → Schätzung', O.profileStore.computeAge('2023-13-40', 40) === 40);
ok('15g computeAge Adapter: unrealistisch → null (Klemme bleibt)', O.profileStore.computeAge('1800-01-01', null) === null);
const storeSrc = readFileSync(new URL('../../js/profile-store.js', import.meta.url), 'utf8');
ok('15h profile-store delegiert (keine eigene Jahresmathematik)', storeSrc.indexOf('onboardingProfileLogic') >= 0 && !/getMonth\(\)\s*-\s*\(mo\s*-\s*1\)/.test(storeSrc));
O.clock._setImplementation(null);

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
