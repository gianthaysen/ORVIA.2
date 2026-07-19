/* ============================================================
   ORVIA · Goal-G1 Contract — Vertragstest: Ziel-Detailfelder auf einem Zweitgerät
   (Stand G1c: Kern-Erhaltung G1-1..G1-6 + Clear-Semantik C0-1..C12. Historisch
   als Goal-G1a begonnen, seither um G1b/G1c erweitert — Titel bewusst neutral.)
   Lädt die ECHTEN Dateien profile-model.js, repos/goalRepository.js,
   profile-store.js in zwei unabhängige vm-Sandboxes ("Gerät A"/"Gerät B").
   Die Cloud wird durch eine gemeinsame In-Memory-„Tabelle" simuliert (kein
   echter Netzwerkzugriff) — NUR O.repos.goal.list/replaceUserGoals (die
   Netzwerk-I/O) werden umgeleitet. Die eigentliche Vertragslogik
   (goalToRow/goalToRowFull-Mapping, _goalsCycle.toRows/applyRows in
   profile-store.js) bleibt UNVERÄNDERTER Produktivcode.
   node supabase/tests/goal_g1_contract_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const results = [];
const ok = (n, c, i) => {
  console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  — ' + JSON.stringify(i) : ''));
  c ? pass++ : fail++;
  results.push({ n, c });
};
const base = new URL('../../js/', import.meta.url);

function makeDevice(cloudTable) {
  const store = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log(){}, warn(){}, error(){} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object; sb.String = String; sb.Number = Number;
  sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.Set = Set; sb.Intl = Intl;
  sb.Promise = Promise; sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout;
  sb.navigator = { onLine: true };
  const wl = {}; sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
  sb.addEventListener = (t, f) => { (wl[t] = wl[t] || []).push(f); };
  sb.removeEventListener = () => {}; sb.dispatchEvent = e => { (wl[e.type] || []).slice().forEach(f => f(e)); return true; };
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  // ORVIA.repos MUSS existieren, bevor goalRepository.js läuft (setzt O.repos.goal = {...}).
  sb.ORVIA = { repos: {} };
  vm.createContext(sb);
  ['profile-model.js', 'repos/goalRepository.js', 'profile-store.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  // Simulierte Cloud: NUR die Netzwerk-Methoden umleiten. goalToRow/goalToRowFull
  // (das eigentliche Mapping, unter Test) bleiben die echten Funktionen.
  sb.ORVIA.repoBase = { online: () => true };
  sb.ORVIA.repos.goal.list = async () => ({ success: true, data: cloudTable.slice() });
  sb.ORVIA.repos.goal.replaceUserGoals = async (rows) => { cloudTable.length = 0; rows.forEach(r => cloudTable.push(Object.assign({}, r))); return { success: true, data: { upserted: rows.length, deleted: 0 } }; };
  sb.ORVIA.user = { id: 'u:test' };
  sb.PROFILE = sb.ORVIA.profileModel.migrateProfile({ version: 1, onboarded: true, name: 'Testgerät' });
  sb.PROFILE.goals = [];
  return sb;
}

/* ================= Setup: Gerät A mit kanonischem, vollständig befülltem Ziel ================= */
const cloudTable = [];
const deviceA = makeDevice(cloudTable);
const deviceB = makeDevice(cloudTable);

const richGoalRaw = {
  id: 'g:rich', category: 'shredded', title: 'Wettkampfgewicht', priority: 1, status: 'active',
  targetDate: '2027-03-01', metricType: 'percent', unit: '%', targetValue: 11, currentValue: 15,
  description: 'Für die nächste Saison',
  sports: ['gym', 'running'],
  motivation: 'Bessere Leistungsfähigkeit im Wettkampf',
  timeHorizon: 'mid',
  customCategory: 'Wettkampfvorbereitung',
  categoryData: { currentWeight: 78, targetBodyFat: 11, maintainMuscle: true },
  milestones: [{ id: 'ms:1', title: '13% KFA erreicht', status: 'planned', order: 0 }]
};
const bareGoalRaw = { id: 'g:bare', category: 'gym', title: 'Kraftaufbau ohne Details', priority: 2, status: 'active' };
deviceA.PROFILE.goals = deviceA.ORVIA.profileModel.normalizeGoals([richGoalRaw, bareGoalRaw]);

/* ================= Gerät A -> Cloud (echter Sync-Pfad: persistGoals -> toRows(goalToRowFull) -> repoReplace) ================= */
const persistResult = await deviceA.ORVIA.profileStore.persistGoals();
ok('Setup-1 Gerät A persistiert erfolgreich in die simulierte Cloud', persistResult.success);
ok('Setup-2 Cloud enthält beide Zeilen', cloudTable.length === 2);

const richRow = cloudTable.find(r => r.client_goal_id === 'g:rich');
ok('Setup-3 Cloud-Row für das reiche Ziel existiert', !!richRow);

/* ---- Diagnose (nach G1b GRÜN): die Cloud-Row trägt jetzt die sechs Detailspalten
   (goalToRowFull mappt sie „nur wenn belegt"). Das reiche Ziel hat alle sechs belegt,
   also MÜSSEN alle sechs Spalten vorhanden sein und den Ursprungswert tragen. Damit ist
   dies kein Blindtest mehr, sondern der Repository-Ebenen-Nachweis, dass der Transport
   existiert (die eigentliche Zweitgeräte-Wiederherstellung prüfen G1-1..G1-6). ---- */
const D0 = {
  sports: JSON.stringify(richRow.sports) === JSON.stringify(['gym', 'running']),
  motivation: richRow.motivation === richGoalRaw.motivation,
  time_horizon: richRow.time_horizon === 'mid',
  custom_category: richRow.custom_category === 'Wettkampfvorbereitung',
  category_data: !!richRow.category_data && JSON.stringify(richRow.category_data) === JSON.stringify(richGoalRaw.categoryData),
  milestones: Array.isArray(richRow.milestones) && richRow.milestones.length === 1 && richRow.milestones[0].title === '13% KFA erreicht'
};
Object.keys(D0).forEach(col => {
  ok('D0 (Diagnose) Cloud-Row trägt Spalte „' + col + '" belegt (Transport nach G1b vorhanden)', D0[col], richRow[col]);
});

/* ================= Gerät B: kein lokales prev, hydratisiert aus derselben Cloud-Row ================= */
ok('Setup-4 Gerät B startet mit leeren Zielen (kein prev)', deviceB.PROFILE.goals.length === 0);
const hydrateResult = await deviceB.ORVIA.profileStore.hydrateGoals();
ok('Setup-5 Gerät B hydratisiert erfolgreich', hydrateResult.success);
const bRich = deviceB.PROFILE.goals.find(g => g.id === 'g:rich');
const bBare = deviceB.PROFILE.goals.find(g => g.id === 'g:bare');
ok('Setup-6 Reiches Ziel kommt auf Gerät B an (Kernfelder-Transport funktioniert grundsätzlich)', !!bRich);

/* ================= Kernfelder MÜSSEN unverändert transportiert werden (muss grün sein) ================= */
if (bRich) {
  ok('K1 id/client_goal_id', bRich.id === 'g:rich');
  ok('K2 title', bRich.title === 'Wettkampfgewicht');
  ok('K3 category/goal_type', bRich.category === 'shredded');
  ok('K4 priority', bRich.priority === 1);
  ok('K5 status', bRich.status === 'active');
  ok('K6 targetValue', bRich.targetValue === 11);
  ok('K7 unit', bRich.unit === '%');
  ok('K8 targetDate', bRich.targetDate === '2027-03-01');
  ok('K9 metricType', bRich.metricType === 'percent');
  ok('K10 currentValue', bRich.currentValue === 15);
  ok('K11 description', bRich.description === 'Für die nächste Saison');
}

/* ================= Kern-Assertion: die 6 Detailfelder MÜSSEN erhalten bleiben ================= */
/* Ab G1b/G1c grün: applyRows() in profile-store.js mappt diese Felder explizit aus der
   Cloud-Row; goalToRowFull() in goalRepository.js sendet sie beim Persist. Vor G1b waren
   genau diese 6 Assertions der Rot-Beweis für den Goal-G1-Datenverlust; sie sind jetzt der
   Regressionsschutz dafür, dass Zieldetails auf einem Zweitgerät ankommen. */
if (bRich) {
  ok('G1-1 sports bleibt erhalten', JSON.stringify(bRich.sports) === JSON.stringify(['gym', 'running']), bRich.sports);
  ok('G1-2 motivation bleibt erhalten', bRich.motivation === richGoalRaw.motivation, bRich.motivation);
  ok('G1-3 timeHorizon bleibt erhalten', bRich.timeHorizon === 'mid', bRich.timeHorizon);
  ok('G1-4 customCategory bleibt erhalten', bRich.customCategory === 'Wettkampfvorbereitung', bRich.customCategory);
  ok('G1-5 categoryData bleibt erhalten', JSON.stringify(bRich.categoryData) === JSON.stringify(richGoalRaw.categoryData), bRich.categoryData);
  ok('G1-6 milestones bleibt erhalten', JSON.stringify((bRich.milestones || []).map(m => m.title)) === JSON.stringify(['13% KFA erreicht']), bRich.milestones);
}

/* ================= Leere optionale Detailfelder dürfen nicht als falsche Daten erscheinen ================= */
/* (muss grün sein — normalizeGoals liefert saubere Defaults, keine „undefined"/korrupten Werte,
   unabhängig vom G1-Bug oben) */
if (bBare) {
  ok('E1 sports: sauberes leeres Array, kein undefined', Array.isArray(bBare.sports) && bBare.sports.length === 0);
  ok('E2 motivation: sauberer leerer String, kein undefined', bBare.motivation === '');
  ok('E3 timeHorizon: sauberes null, kein undefined/leerer String', bBare.timeHorizon === null);
  ok('E4 customCategory: sauberes null', bBare.customCategory === null);
  ok('E5 categoryData: sauberes leeres Objekt', bBare.categoryData && typeof bBare.categoryData === 'object' && Object.keys(bBare.categoryData).length === 0);
  ok('E6 milestones: sauberes leeres Array', Array.isArray(bBare.milestones) && bBare.milestones.length === 0);
}

/* ================= Gerät A selbst darf beim erneuten Hydrate NICHT schlechter werden ================= */
/* (muss grün sein — Gerät A hat noch ein lokales prev mit den vollen Detaildaten; applyRows()
   überschreibt sports/motivation/... nicht explizit, sondern übernimmt sie per Object.assign
   aus prev — das ist der bereits vorhandene "Ebene B"-Schutz für das GLEICHE Gerät.) */
const reHydrateA = await deviceA.ORVIA.profileStore.hydrateGoals();
ok('Setup-7 Gerät A re-hydratisiert erfolgreich', reHydrateA.success);
const aRichAfter = deviceA.PROFILE.goals.find(g => g.id === 'g:rich');
if (aRichAfter) {
  ok('P1 Gerät A behält sports nach erneutem Hydrate', JSON.stringify(aRichAfter.sports) === JSON.stringify(['gym', 'running']), aRichAfter.sports);
  ok('P2 Gerät A behält motivation nach erneutem Hydrate', aRichAfter.motivation === richGoalRaw.motivation);
  ok('P3 Gerät A behält categoryData nach erneutem Hydrate', JSON.stringify(aRichAfter.categoryData) === JSON.stringify(richGoalRaw.categoryData));
  ok('P4 Gerät A behält milestones nach erneutem Hydrate', (aRichAfter.milestones || []).length === 1);
}

/* ================= G1c: bewusstes Leeren muss ankommen, nicht der alte Cloud-Wert ================= */
/* Eigene Cloud-Tabelle + eigene Geräte, isoliert von den Sektionen oben. Gerät A legt ein
   reiches Ziel an, persistiert, LEERT danach alle sechs Detailfelder bewusst und persistiert
   erneut. Gerät B (kein prev) hydratisiert. Erwartung: Gerät B sieht die geleerten Werte,
   NICHT die ursprünglichen reichen Werte — das beweist, dass goalToRowFull() jetzt einen
   klaren Wert sendet statt das Feld beim Leeren einfach wegzulassen (was den alten
   Cloud-Wert stehen lassen und später wieder zurück-hydratisieren würde). */
{
  const cloudTableC = [];
  const devA = makeDevice(cloudTableC);
  const devB = makeDevice(cloudTableC);
  devA.PROFILE.goals = devA.ORVIA.profileModel.normalizeGoals([Object.assign({}, richGoalRaw, { id: 'g:clear' })]);
  const p1 = await devA.ORVIA.profileStore.persistGoals();
  ok('C0-1 Gerät A persistiert das reiche Ziel', p1.success);
  const rowBefore = cloudTableC.find(r => r.client_goal_id === 'g:clear');
  ok('C0-2 Cloud-Row trägt vor dem Leeren noch die reichen Werte', !!rowBefore && JSON.stringify(rowBefore.sports) === JSON.stringify(['gym', 'running']));

  // Gerät A leert alle sechs Detailfelder bewusst und persistiert erneut.
  const gClear = devA.PROFILE.goals.find(g => g.id === 'g:clear');
  gClear.sports = []; gClear.motivation = ''; gClear.timeHorizon = null;
  gClear.customCategory = null; gClear.categoryData = {}; gClear.milestones = [];
  devA.PROFILE.goals = devA.ORVIA.profileModel.normalizeGoals(devA.PROFILE.goals);
  const p2 = await devA.ORVIA.profileStore.persistGoals();
  ok('C0-3 Gerät A persistiert das geleerte Ziel erneut', p2.success);

  const rowAfter = cloudTableC.find(r => r.client_goal_id === 'g:clear');
  ok('C1 Cloud-Row trägt time_horizon explizit als null (Spalte vorhanden, nicht weggelassen)', rowAfter && 'time_horizon' in rowAfter && rowAfter.time_horizon === null);
  ok('C2 Cloud-Row trägt custom_category explizit als null', rowAfter && 'custom_category' in rowAfter && rowAfter.custom_category === null);
  ok('C3 Cloud-Row trägt motivation explizit als leeren String', rowAfter && rowAfter.motivation === '');
  ok('C4 Cloud-Row trägt sports explizit als leeres Array', rowAfter && Array.isArray(rowAfter.sports) && rowAfter.sports.length === 0);
  ok('C5 Cloud-Row trägt category_data explizit als leeres Objekt', rowAfter && rowAfter.category_data && Object.keys(rowAfter.category_data).length === 0);
  ok('C6 Cloud-Row trägt milestones explizit als leeres Array', rowAfter && Array.isArray(rowAfter.milestones) && rowAfter.milestones.length === 0);

  // Gerät B (kein prev) hydratisiert — muss die GELEERTEN Werte sehen, nicht die alten.
  const h = await devB.ORVIA.profileStore.hydrateGoals();
  ok('C0-4 Gerät B hydratisiert erfolgreich', h.success);
  const bCleared = devB.PROFILE.goals.find(g => g.id === 'g:clear');
  ok('C7 Gerät B sieht geleertes sports, nicht die alten Werte', !!bCleared && Array.isArray(bCleared.sports) && bCleared.sports.length === 0);
  ok('C8 Gerät B sieht geleerte motivation, nicht die alten Werte', !!bCleared && bCleared.motivation === '');
  ok('C9 Gerät B sieht geleertes timeHorizon, nicht die alten Werte', !!bCleared && bCleared.timeHorizon === null);
  ok('C10 Gerät B sieht geleerte customCategory, nicht die alten Werte', !!bCleared && bCleared.customCategory === null);
  ok('C11 Gerät B sieht geleertes categoryData, nicht die alten Werte', !!bCleared && bCleared.categoryData && Object.keys(bCleared.categoryData).length === 0);
  ok('C12 Gerät B sieht geleerte milestones, nicht die alten Werte', !!bCleared && Array.isArray(bCleared.milestones) && bCleared.milestones.length === 0);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
/* G1b-Zielzustand: die 6 zuvor roten Detailfeld-Assertions (G1-1..G1-6) müssen jetzt
   grün sein — die Detailfelder überleben den Zweitgerät-Hydrate. Dieser Test ist damit
   von einem Rot-Beweis (G1a) zu einem grünen Regressionsschutz (ab G1b) geworden. */
const g1Detail = results.filter(r => r.n.indexOf('G1-') === 0);   // G1-1..G1-6
const g1Failing = g1Detail.filter(r => !r.c).length;
console.log('Goal-G1-Detailfeld-Wiederherstellung (G1-1..G1-6): ' + g1Detail.length + ' Assertions, davon rot: ' + g1Failing);
if (fail === 0) {
  console.log('Status: GRÜN — Ziel-Detailfelder werden cloud-persistiert und auf dem Zweitgerät wiederhergestellt (Goal-G1 behoben).');
} else {
  console.log('Status: ' + fail + ' Assertion(en) rot — Goal-G1-Vertrag NICHT erfüllt.');
}
process.exit(fail ? 1 : 0);
