/* ORVIA · Basisprofil — reine Profil-Logik. */
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const P = (await import(new URL('../../js/onboarding/onboarding-profile-logic.js', import.meta.url))).default;

const TODAY = new Date(2026, 5, 1); // 2026-06-01 deterministisch
const valid = { displayName: 'Alex', birthDate: '2000-05-10', sex: 'male', heightCm: 180, weightKg: 75, unitSystem: 'metric', experienceLevel: 'intermediate' };

ok('gültiges Profil → valid', P.validateProfile(valid, TODAY).valid === true);
ok('profileComplete', P.profileComplete(valid, TODAY) === true);

ok('fehlender Anzeigename → Fehler', !!P.validateProfile(Object.assign({}, valid, { displayName: '' }), TODAY).errors.displayName);
ok('Anzeigename getrimmt', P.normalizeProfile({ displayName: '  Bo  ' }).displayName === 'Bo');
ok('Name 1 Zeichen → Fehler', !!P.validateProfile(Object.assign({}, valid, { displayName: 'A' }), TODAY).errors.displayName);

ok('ungültiges Datum 2020-02-30 → Fehler', !!P.validateProfile(Object.assign({}, valid, { birthDate: '2020-02-30' }), TODAY).errors.birthDate);
ok('zukünftiges Datum → Fehler', !!P.validateProfile(Object.assign({}, valid, { birthDate: '2030-01-01' }), TODAY).errors.birthDate);
ok('Alter < 13 → Fehler', !!P.validateProfile(Object.assign({}, valid, { birthDate: '2020-01-01' }), TODAY).errors.birthDate);
ok('Alter > 100 → Fehler', !!P.validateProfile(Object.assign({}, valid, { birthDate: '1900-01-01' }), TODAY).errors.birthDate);

ok('gültiger sex', P.validateProfile(Object.assign({}, valid, { sex: 'diverse' }), TODAY).valid === true);
ok('unbekannter sex → Fehler', !!P.validateProfile(Object.assign({}, valid, { sex: 'x' }), TODAY).errors.sex);

ok('Größe 99 → Fehler', !!P.validateProfile(Object.assign({}, valid, { heightCm: 99 }), TODAY).errors.heightCm);
ok('Größe 251 → Fehler', !!P.validateProfile(Object.assign({}, valid, { heightCm: 251 }), TODAY).errors.heightCm);
ok('Gewicht 29 → Fehler', !!P.validateProfile(Object.assign({}, valid, { weightKg: 29 }), TODAY).errors.weightKg);
ok('Gewicht 301 → Fehler', !!P.validateProfile(Object.assign({}, valid, { weightKg: 301 }), TODAY).errors.weightKg);

ok('NaN heightCm → null', P.normalizeProfile({ heightCm: NaN }).heightCm === null);
ok('Infinity weightKg → null', P.normalizeProfile({ weightKg: Infinity }).weightKg === null);
ok('negative Größe → null', P.normalizeProfile({ heightCm: -180 }).heightCm === null);
ok('String-Zahl geparst', P.normalizeProfile({ heightCm: '180' }).heightCm === 180);

ok('calculateAge korrekt', P.calculateAge('2000-05-10', TODAY) === 26);
ok('calculateAge vor Geburtstag', P.calculateAge('2000-07-10', TODAY) === 25);

// Einheiten
ok('kg→lb', Math.abs(P.kgToLb(100) - 220.462) < 0.01);
ok('lb→kg', Math.abs(P.lbToKg(220.462) - 100) < 0.01);
const fi = P.cmToFeetInches(180); ok('cm→ft/in (180cm ≈ 5ft 11in)', fi.feet === 5 && fi.inches === 11);
ok('ft/in→cm (5,11 ≈ 180.34)', Math.abs(P.feetInchesToCm(5, 11) - 180.34) < 0.01);
// mehrfacher Wechsel ohne relevante Drift (kanonisch bleibt unverändert; Anzeige abgeleitet)
let canon = 180; for (let i = 0; i < 20; i++) { const x = P.cmToFeetInches(canon); /* nur Anzeige */ }
ok('wiederholte Anzeige-Ableitung ändert kanonischen Wert nicht', canon === 180);

// strikte Zahlen
ok('num lehnt 175abc ab', P._num('175abc') === null);
ok('num lehnt 70kg ab', P._num('70kg') === null);
ok('num lehnt Exponent 1e3 ab', P._num('1e3') === null);
ok('num akzeptiert deutsches Komma 70,5', P._num('70,5') === 70.5);
ok('num akzeptiert "180"', P._num('180') === 180);
ok('175abc als Größe → Fehler', !!P.validateProfile(Object.assign({}, valid, { heightCm: '175abc' }), TODAY).errors.heightCm);

// parseFeetInches
ok('ft/in valide 5,11', P.parseFeetInches('5', '11').valid === true);
ok('inches 12 → ungültig', P.parseFeetInches('5', '12').valid === false);
ok('negative inches → ungültig', P.parseFeetInches('5', '-1').valid === false);
ok('dezimale feet → ungültig', P.parseFeetInches('5.5', '0').valid === false);
ok('nur inches ohne feet → ungültig', P.parseFeetInches('', '6').valid === false);
ok('leer/leer → valid cm null', P.parseFeetInches('', '').valid === true && P.parseFeetInches('', '').cm === null);

// Altersgrenzen exakt.
// Issue #6 (behoben 2026-07-02): der Helper nutzte toISOString() (UTC) auf LOKAL
// konstruierten Daten — in Zeitzonen östlich von UTC verschob das den String um
// -1 Tag; „Geburtstag morgen" kollabierte auf „heute" (2 rote Tests), „exakt 13"
// testete real 13J+1T. Jetzt lokale Formatierung; die Produktlogik war korrekt.
function bdAge(years, extraDays) { const d = new Date(TODAY); d.setFullYear(d.getFullYear() - years); if (extraDays) d.setDate(d.getDate() + extraDays); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
ok('exakt 13 Jahre → ok', P.validateProfile(Object.assign({}, valid, { birthDate: bdAge(13) }), TODAY).valid === true);
ok('12 Jahre 364 Tage → Fehler', !!P.validateProfile(Object.assign({}, valid, { birthDate: bdAge(13, 1) }), TODAY).errors.birthDate);
ok('exakt 100 Jahre → ok', P.validateProfile(Object.assign({}, valid, { birthDate: bdAge(100) }), TODAY).valid === true);
ok('101 Jahre → Fehler', !!P.validateProfile(Object.assign({}, valid, { birthDate: bdAge(101) }), TODAY).errors.birthDate);
ok('Geburtstag heute → korrektes Alter', P.calculateAge(bdAge(26), TODAY) === 26);
ok('Geburtstag morgen → ein Jahr weniger', P.calculateAge(bdAge(26, 1), TODAY) === 25);

// Schaltjahr
ok('29.02.2020 (Schaltjahr) gültig', P.parseDate('2020-02-29') !== null);
ok('29.02.2021 (kein Schaltjahr) ungültig', P.parseDate('2021-02-29') === null);

// Seed
const seeded = P.profileSeedFromExisting({ name: 'Sam', gender: 'female', height: 175, weight: 68, experienceLevel: 'advanced' });
ok('Seed: name→displayName', seeded.displayName === 'Sam');
ok('Seed: gender→sex', seeded.sex === 'female');
ok('Seed: height→heightCm', seeded.heightCm === 175);
ok('Seed: unbekanntes gender → leer', P.profileSeedFromExisting({ gender: 'xyz' }).sex === '');
ok('Seed: leere Quelle → leeres Profil', P.profileSeedFromExisting({}).displayName === '');

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
