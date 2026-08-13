/* ============================================================
   ORVIA · H3 — Blob-Sync-Sicherheit (Master-Anweisung Priorität 1).
   (a) Abend-Check-in cloudfähig (evening in BLOCK_TYPES, Persist-Aufruf,
       evening-Rekonstruktion beim Hydrat mit Ernährungs-Feld-Erhalt).
   (b) GPX/TCX-/JSON-Import wird kanonisch gespiegelt (activityStore, source import).
   (c) issues.js läuft über den kanonischen Constraints-Pfad (kein Direkt-Write).
   (d) sync.js: fremde neuere Cloud-Rev ⇒ kein Blind-Push; GM7.6 Cloud-Autoload:
       ohne lokale Aenderungen automatisch laden, mit lokalen Aenderungen erst sichern
       dann neu laden, syncErrorPrompt nur bei echtem technischem Fehler.
   node supabase/tests/blob_hardening_h3_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL(_APPREL + 'js/', import.meta.url);

/* ---------- (a) evening: Store-Verträge + Repo-Row ---------- */
{
  const cs = readFileSync(new URL('checkin-store.js', base), 'utf8');
  ok('A1 evening in BLOCK_TYPES (persist+hydrate)', /BLOCK_TYPES = \['morning', 'live', 'pre', 'post', 'evening'\]/.test(cs));
  ok('A2 evening-Rekonstruktion mit eigenem Format + Ernährungs-Erhalt', /checkin_type === 'evening'/.test(cs) && /Object\.assign\(\{\}, prev,/.test(cs));
  const ui = readFileSync(new URL('ui.js', base), 'utf8');
  ok('A3 saveEve/autoEve persistieren evening', /_persistEve\(\)/.test(ui.split('function saveEve')[1].slice(0, 200)) && /_persistEve\(\)/.test(ui.split('function autoEve')[1].slice(0, 200)));
  ok('A4 mood→feel-Mapping im Aufrufer', /feel:ev\.mood/.test(ui));
  const auth = readFileSync(new URL('auth.js', base), 'utf8');
  ok('A5 Login hydriert evening', /'evening'\]\)/.test(auth));
  // Repo: energy/note nur wenn belegt (0015-Kompatibilität)
  const sb = { window: null, console }; sb.window = sb; sb.ORVIA = { repoBase: { requireAuth: () => null, online: () => true, sb: () => null, fail: () => ({}), ok: () => ({}), upsert: async () => ({}), selectAll: async () => ({}) }, repos: {} };
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('repos/checkinRepository.js', base), 'utf8'), sb, { filename: 'checkinRepository.js' });
  const row1 = sb.ORVIA.repos.checkin.toRow('2026-07-11', 'evening', { feel: 7, energy: 6, note: 'ok', knee: 2 });
  ok('A6 evening-Row: feel/energy/note + Knie→complaints', row1.feel === 7 && row1.energy === 6 && row1.note === 'ok' && row1.complaints.some(c => c.type === 'knee' && c.score === 2));
  const row2 = sb.ORVIA.repos.checkin.toRow('2026-07-11', 'morning', { sleepMin: 480 });
  ok('A7 morning-Row OHNE 0015-Spalten (Kompatibilität)', !('energy' in row2) && !('note' in row2));
  const sql = readFileSync(new URL('../migrations/0015_checkin_evening_fields.sql', import.meta.url), 'utf8');
  ok('A8 Migration 0015 additiv (energy/note)', /add column if not exists energy/.test(sql) && /add column if not exists note/.test(sql));
}

/* ---------- (b) Import kanonisch gespiegelt ---------- */
{
  const act = readFileSync(new URL('activity.js', base), 'utf8');
  ok('B1 _importToCanonical existiert', /function _importToCanonical/.test(act));
  ok('B2 beide Import-Pfade spiegeln (Datei + JSON)', (act.match(/_importToCanonical\(/g) || []).length >= 3);
  ok('B3 source import + deterministische sourceRecordId', /source:'import'/.test(act) && /sourceRecordId:'import:'\+a\.date/.test(act));
  ok('B4 sportId über trainingDomain.normSport', /trainingDomain\.normSport\)sportId=ORVIA\.trainingDomain\.normSport\(a\.type\)/.test(act.replace(/\s/g, '').replace(/ORVIA\.trainingDomain\.normSport\)/, 'trainingDomain.normSport)')) || /normSport\(a\.type\)/.test(act));
}

/* ---------- (c) issues über kanonischen Constraints-Pfad (funktional) ---------- */
{
  const store = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object; sb.String = String; sb.Number = Number;
  sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.Set = Set; sb.Intl = Intl;
  sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout; sb.Promise = Promise;
  sb.navigator = { onLine: true };
  const wl = {}; sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
  sb.addEventListener = (t, f) => { (wl[t] = wl[t] || []).push(f); };
  sb.removeEventListener = () => {}; sb.dispatchEvent = e => { (wl[e.type] || []).slice().forEach(f => f(e)); return true; };
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ classList: { add() {}, remove() {} }, style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [] }), body: { appendChild() {} }, documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } } };
  sb.escH = s => String(s == null ? '' : s); sb.toast = () => {}; sb.renderProfileScreen = () => {}; sb.renderZones = () => {}; sb.maybePlanImpact = () => {};
  sb.ORVIA = {};
  vm.createContext(sb);
  ['profile-model.js', 'onboarding/onboarding-profile-logic.js', 'profile.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  // issues.js braucht: entry/cur/save/renderModules/ORVIA_MODULES/todayStr
  vm.runInContext(`var cur='2026-07-11';var DB={};function entry(d){DB[d]=DB[d]||{date:d};return DB[d];}
    function save(){}function renderModules(){}function closeSupp(){}function todayStr(){return cur;}
    var ORVIA_MODULES={shin:{label:'Schienbein'},knee:{label:'Knie'}};`, sb);
  vm.runInContext(readFileSync(new URL('issues.js', base), 'utf8'), sb, { filename: 'issues.js' });
  sb.ensureProfile();
  let events = [];
  sb.addEventListener('orvia:profile-updated', e => events.push((e.detail.changedSections || []).join(',')));
  // Modul-Aktivierung ⇒ Constraint entsteht + kanonischer Save (constraints-Event)
  sb.logIssue('shin', 4);
  ok('C1 logIssue legt Constraint an (bodyRegion=shin, aktiv)', (sb.PROFILE.constraintsList || []).some(c => c.bodyRegion === 'shin' && c.status === 'active'));
  ok('C2 issues-Projektion enthält shin (aus constraintsList)', (sb.PROFILE.issues || []).indexOf('shin') >= 0);
  ok('C3 kanonischer Save gefeuert (constraints)', events.some(x => x === 'constraints'));
  const evBefore = events.length;
  sb.logIssue('shin', 6);
  ok('C4 erneutes Loggen ⇒ KEIN Save-Sturm (Modul schon aktiv)', events.length === evBefore);
  // Pausieren ⇒ Constraint observed, Projektion bereinigt
  sb.removeModule('shin');
  ok('C5 removeModule ⇒ Status observed', sb.PROFILE.constraintsList.some(c => c.bodyRegion === 'shin' && c.status === 'observed'));
  ok('C6 Projektion ohne shin nach Pause', (sb.PROFILE.issues || []).indexOf('shin') < 0);
  const isrc = readFileSync(new URL('issues.js', base), 'utf8');
  ok('C7 kein direkter PROFILE.issues.push + saveProfile mehr', !/PROFILE\.issues\.push\([^)]*\);.*saveProfile/.test(isrc.replace(/\n/g, ' ')));
}

/* ---------- (d) sync.js Zweitgeräte-Merge (GM7.6 Cloud-Autoload) ---------- */
{
  const sy = readFileSync(new URL('sync.js', base), 'utf8');
  // Incident-Fix v8-183: Regel verschärft — numerisch neuer UND fremdes Gerät.
  ok('D1 kein Blind-Push mehr: fremde NEUERE Cloud-Rev wird vor push() geprüft', /remoteRev > knownRev/.test(sy) && /isOwnDevice/.test(sy));
  ok('D2 ohne lokale Aenderungen: Cloud automatisch geladen (kein Dialog)', /if \(!isLocalDirty\(\)\) \{/.test(sy) && /Punkt 1:/.test(sy));
  ok('D3a Fremd-Owner-Schutz bleibt (kein A→B-Push)', /owner && owner !== u\.id/.test(sy));
  ok('D3b mit lokalen Aenderungen: erst push() (sichern), danach frisch geladen', /Punkt 2\+3/.test(sy) && (sy.match(/await push\(\);/g) || []).length >= 2);
  ok('D4 offline/Fehler ⇒ kein Haenger, ehrlicher Zustand statt Blind-Push', /offline\/Fehler/.test(sy) || /lokal weiterarbeiten/.test(sy));
  ok('D5 Dialog nur noch bei echtem technischem Fehler (syncErrorPrompt), kein Routine-Dialog', /function syncErrorPrompt/.test(sy) && !/function migratePrompt/.test(sy) && /syncErrorPrompt\(\)/.test(sy));
  ok('D6 lokale Aenderungen werden nie blind verworfen: dirty-Flag treibt die Entscheidung', /isLocalDirty\(\)/.test(sy) && /markDirty/.test(sy) && /markClean/.test(sy));
  ok('D7 online-Reconnect prueft vollstaendig neu statt blind zu pushen', /addEventListener\(\s*'online'.*start\(\)/.test(sy.replace(/\n/g,' ')));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
