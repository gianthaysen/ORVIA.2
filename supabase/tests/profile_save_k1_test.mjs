/* ============================================================
   ORVIA · K1 (2026-10-28) — Profil-Speicherung scheitert nicht mehr an leeren Feldern
   ------------------------------------------------------------
   BEFUND (live, Konto einer Testerin): Der Editor „Persönliche Grunddaten" speichert ein
   leeres Geburtsdatum als ''. Der Upsert schickte birth_date: '' an eine date-Spalte →
   Postgres lehnt ab → GESAMTER Upsert scheitert (Name, Ort, Regeneration …). Lokal stand
   „Gespeichert"; beim nächsten Start überschrieb der alte Serverstand alles.

     T  toRow: leer/whitespace/ungültig → null, gültige Werte exakt erhalten, nicht mutierend
     S  save() schickt genau toRow(profile) (keine zweite Abbildung)
     O  Offline-Queue nutzt dieselbe Abbildung und enthält recovery/preferences (vorher fehlend)
     N  Cloud-Fehler beim Editor-Speichern → ausdrücklicher Hinweis statt stillem „Gespeichert"
     G  Gegenprobe: die alte Abbildung (`?? null`) liefert birth_date '' — genau der Fehlerfall

   Dass Postgres '' für date ablehnt und toRow-Zeilen annimmt, belegt
   profile_save_k1_db_test.mjs gegen ein echtes Postgres.
   node supabase/tests/profile_save_k1_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _ex } from 'node:fs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

global.window = {}; global.PROFILE = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const _wl = {};
global.window.addEventListener = (t, f) => { (_wl[t] = _wl[t] || []).push(f); };
global.window.dispatchEvent = e => { (_wl[e.type] || []).slice().forEach(f => f(e)); return true; };
global.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
const toasts = []; global.toast = m => toasts.push(m);
const load = f => (0, eval)(fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js');
load('js/repos/profileRepository.js');
load('js/profile-store.js');
const O = global.window.ORVIA;
const toRow = O.repos.profile.toRow;

/* ---------- T · toRow ---------- */
ok('T0 toRow ist exportiert', typeof toRow === 'function');
const leer = { name: '', birthDate: '', ageEstimate: '', sex: '', heightCm: '', weightKg: '', hfMaxMeasured: '', restingHrMeasured: '',
  sleepGoalH: '', timezone: '', location: '  ', avatarPath: '', recovery: null, preferences: null, handle: '', bio: '' };
let r = toRow(leer);
ok('T1 alle leeren Felder → null (keine "" mehr an typisierte Spalten)', Object.values(r).every(v => v === null), JSON.stringify(r));
ok('T2 birth_date "" → null (die eigentliche Ursache)', r.birth_date === null);
const voll = { name: ' Lena ', birthDate: '1998-04-17', ageEstimate: 27, sex: 'w', heightCm: '168', weightKg: '61,5', hfMaxMeasured: 192, restingHrMeasured: '52',
  sleepGoalH: 8, timezone: 'Europe/Berlin', location: 'Hamburg', avatarPath: 'u/a.png', recovery: { sleepQuality: 3 }, preferences: { riskTolerance: 'balanced' },
  handle: 'lena', bio: 'Läuft.', constraintsAcknowledgedAt: '2026-10-28T10:00:00Z' };
const snap = JSON.stringify(voll);
r = toRow(voll);
ok('T3 gültige Werte bleiben erhalten (Name getrimmt; Editor-„w" → DB-Code f)', r.name === 'Lena' && r.birth_date === '1998-04-17' && r.sex === 'f' && r.location === 'Hamburg' && r.handle === 'lena' && r.bio === 'Läuft.');
ok('T4 Zahlen aus Text/Komma → Zahl', r.height_cm === 168 && r.weight_kg === 61.5 && r.resting_hr === 52 && r.hf_max === 192 && r.sleep_goal_h === 8);
ok('T5 age_estimate nur ohne Geburtsdatum', r.age_estimate === null && toRow({ ageEstimate: '27' }).age_estimate === 27);
ok('T6 recovery/preferences als Objekt durchgereicht', r.recovery && r.recovery.sleepQuality === 3 && r.preferences.riskTolerance === 'balanced');
ok('T7 constraints_acknowledged_at nur wenn belegt', r.constraints_acknowledged_at === '2026-10-28T10:00:00Z' && !('constraints_acknowledged_at' in toRow({})));
ok('T8 nicht mutierend', JSON.stringify(voll) === snap);
ok('T9 ungültige Daten → null (31.02., Freitext)', toRow({ birthDate: '2001-02-31' }).birth_date === null && toRow({ birthDate: 'gestern' }).birth_date === null);
ok('T10 Zahl-Müll → null statt Fehler', toRow({ heightCm: 'abc', hfMaxMeasured: 'x' }).height_cm === null && toRow({ hfMaxMeasured: 'x' }).hf_max === null);
ok('T11 recovery als Nicht-Objekt → null', toRow({ recovery: '' }).recovery === null);

/* ---------- X · Geschlecht: drei Schreibweisen → DB-Codes (K1b) ---------- */
ok('X1 Editor „w" → f, Onboarding „female" → f, „male" → m, „diverse" → d', toRow({ sex: 'w' }).sex === 'f' && toRow({ sex: 'female' }).sex === 'f' && toRow({ sex: 'male' }).sex === 'm' && toRow({ sex: 'diverse' }).sex === 'd');
ok('X2 DB-Codes bleiben (m/f/d)', toRow({ sex: 'm' }).sex === 'm' && toRow({ sex: 'f' }).sex === 'f' && toRow({ sex: 'd' }).sex === 'd');
ok('X3 „prefer_not_to_say"/Unbekanntes → null statt Totalausfall', toRow({ sex: 'prefer_not_to_say' }).sex === null && toRow({ sex: 'xyz' }).sex === null);
const pfSrc = fs.readFileSync(new URL(_APPREL + 'js/profile.js', import.meta.url), 'utf8');
ok('X4 Profil-Editor bietet „weiblich" als f an (nicht mehr w)', /\['f','' \+ T\('pf\.weiblich'\)/.test(pfSrc) && !/\['w','' \+ T\('pf\.weiblich'\)/.test(pfSrc));

/* ---------- S · save() nutzt toRow ---------- */
let gesendet = null;
O.user = { id: 'U1' };
O.sb = { from: () => { const q = { upsert: (row) => { gesendet = row; return q; }, select: () => Promise.resolve({ data: [gesendet], error: null }) }; return q; } };
navigator.onLine = true;
const rs = await O.repos.profile.save(leer);
ok('S1 save() mit leerem Profil: Erfolg, birth_date null, user_id gestempelt', rs.success === true && gesendet && gesendet.birth_date === null && gesendet.user_id === 'U1', JSON.stringify(gesendet).slice(0, 120));
ok('S2 save() sendet exakt toRow(profile) (+ user_id)', JSON.stringify(Object.assign({}, gesendet, { user_id: undefined })) === JSON.stringify(Object.assign({}, toRow(leer), { user_id: undefined })));

/* ---------- O · Offline-Queue ---------- */
let queued = null;
O.offlineQueue = { enqueue: async (t, row) => { queued = { t, row }; return { success: true }; } };
O.repoBase.online = () => false;
global.PROFILE = { name: 'Lena', birthDate: '', recovery: { sleepQuality: 2 }, preferences: { riskTolerance: 'ambitious' } };
const ro = await O.profileStore.persist();
ok('O1 offline: pending', ro.success === true && ro.sync_status === 'pending');
ok('O2 offline-Zeile: birth_date null statt ""', queued && queued.t === 'user_profiles' && queued.row.birth_date === null);
ok('O3 offline-Zeile enthält recovery + preferences (vorher fehlend)', queued.row.recovery && queued.row.recovery.sleepQuality === 2 && queued.row.preferences.riskTolerance === 'ambitious');
ok('O4 offline-Zeile = toRow + user_id', queued.row.user_id === 'U1' && queued.row.name === 'Lena');
O.repoBase.online = () => true;

/* ---------- N · Cloud-Fehler beim Editor-Speichern wird gemeldet ---------- */
O.sb = { from: () => { const q = { upsert: () => q, select: () => Promise.resolve({ data: null, error: { message: 'invalid input syntax for type date: ""' } }) }; return q; } };
toasts.length = 0;
global.PROFILE = { name: 'Lena' };
global.window.dispatchEvent(new CustomEvent('orvia:profile-updated', { detail: { changedSections: ['personal'] } }));
await new Promise(res => setTimeout(res, 20));
ok('N1 Upsert-Fehler → Hinweis „Cloud-Speicherung fehlgeschlagen"', toasts.some(t => /Cloud-Speicherung fehlgeschlagen/.test(t)), JSON.stringify(toasts));
O.sb = { from: () => { const q = { upsert: () => q, select: () => Promise.resolve({ data: [{ user_id: 'U1' }], error: null }) }; return q; } };
toasts.length = 0;
global.window.dispatchEvent(new CustomEvent('orvia:profile-updated', { detail: { changedSections: ['recovery'] } }));
await new Promise(res => setTimeout(res, 20));
ok('N2 Erfolg → kein Fehlerhinweis', !toasts.some(t => /fehlgeschlagen/.test(t)));

/* ---------- G · Gegenprobe: alte Abbildung ---------- */
const alt = p => ({ birth_date: p.birthDate ?? null, sex: p.sex ?? null, height_cm: p.heightCm ?? null });
ok('G1 alte Abbildung (`?? null`) ließ birth_date "" durch — der Live-Fehler', alt(leer).birth_date === '' && toRow(leer).birth_date === null);
const editorWrite = fs.readFileSync(new URL(_APPREL + 'js/profile.js', import.meta.url), 'utf8');
ok('G2 Editor schreibt weiterhin "" lokal (deshalb muss die Grenze normalisieren)', /p\.birthDate=d\.birthDate\|\|''/.test(editorWrite));

console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
