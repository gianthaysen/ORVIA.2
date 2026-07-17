/* ============================================================
   ORVIA · P2 — Körperwerte-Feldwelten, ehrliche Leerzustände, Hardcodes.
   Verträge:
   - Flache Felder KANONISCH: Editor-Seed (Altdaten editierbar) + Rückspiegelung
     inkl. hfMax==hfMaxMeasured (eine HFmax-Welt), Löschen ⇒ null (kein Zombie).
   - nutrition erfindet keine 75/175/30 mehr: fehlende Werte ⇒ null/Leerzustand.
   - Keine personenbezogenen Texte (Flensburg, „nimmst du bereits", Tendinopathie-Bezug).
   - Demo-Route ohne personenbezogene Geodaten.
   - time-Inputs mobile-safe (CSS-Vertrag).
   node supabase/tests/body_fields_p2_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../js/', import.meta.url);

function makeApp() {
  const store = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object; sb.String = String; sb.Number = Number;
  sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.Set = Set; sb.Intl = Intl;
  sb.Promise = Promise; sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout;
  sb.navigator = { onLine: true };
  sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
  const wl = {};
  sb.addEventListener = (t, f) => { (wl[t] = wl[t] || []).push(f); };
  sb.removeEventListener = () => {};
  sb.dispatchEvent = e => { (wl[e.type] || []).slice().forEach(f => f(e)); return true; };
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ classList: { add() {}, remove() {} }, style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [] }), body: { appendChild() {} }, documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } } };
  sb.escH = s => String(s == null ? '' : s); sb.toast = () => {}; sb.renderProfileScreen = () => {}; sb.renderZones = () => {}; sb.maybePlanImpact = () => {};
  sb.ORVIA = {};
  vm.createContext(sb);
  ['profile-model.js', 'onboarding/onboarding-profile-logic.js', 'profile.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  sb.ensureProfile();
  return { sb, store };
}

/* ---------- 1) Seed: Altdaten werden im Editor sichtbar/editierbar ---------- */
{
  const h = makeApp();
  const M = h.sb.ORVIA.profileModel;
  Object.assign(h.sb.PROFILE, { weightKg: 75, heightCm: 175, hfMaxMeasured: 198, restingHrMeasured: 58 });
  const perf = h.sb._perfSeedFromCanonical(M.normalizePerformance(h.sb.PROFILE.performance, h.sb.PROFILE.body));
  ok('S1 Seed übernimmt kanonische Altwerte', perf.body.weight.value === 75 && perf.body.height.value === 175 && perf.body.maxHr.value === 198 && perf.body.restingHr.value === 58);
  // Editorwerte gewinnen: vorhandene performance-Werte werden NICHT überschrieben
  h.sb.PROFILE.performance = { body: { weight: { value: 72, unit: 'kg' } } };
  const perf2 = h.sb._perfSeedFromCanonical(M.normalizePerformance(h.sb.PROFILE.performance, h.sb.PROFILE.body));
  ok('S2 Seed überschreibt keine vorhandenen Editor-Werte', perf2.body.weight.value === 72);
}

/* ---------- 2) Mirror: Save spiegelt in die kanonischen Felder ---------- */
{
  const h = makeApp();
  const M = h.sb.ORVIA.profileModel;
  const perf = M.normalizePerformance({ body: { weight: { value: 73 }, height: { value: 176 }, maxHr: { value: 195 }, restingHr: { value: 52 } } }, null);
  // Phase 5 (Garmin, 2026-07-17): _perfMirrorCanonical erwartet jetzt touchedBodyKeys —
  // hier werden testweise alle vier Felder als "in dieser Sitzung bearbeitet" markiert,
  // um den kompletten Mirror wie vorher zu prüfen (M1-M5 unverändertes Verhalten für
  // den Fall "Nutzer hat wirklich alles geändert").
  const p = h.sb._perfMirrorCanonical(perf, ['weight', 'height', 'restingHr', 'maxHr']);
  ok('M1 Mirror setzt alle vier kanonischen Felder (wenn alle vier als bearbeitet markiert sind)', p.weightKg === 73 && p.heightCm === 176 && p.hfMaxMeasured === 195 && p.restingHrMeasured === 52);
  ok('M2 eine HFmax-Welt: hfMax folgt der Messung', p.hfMax === 195);
  ok('M3 rhrBaseline aktualisiert', p.rhrBaseline === 52);
  // Löschen ⇒ null (kein Zombie-Altwert), aber Baseline bleibt
  const empty = M.normalizePerformance({}, null);
  const pe = h.sb._perfMirrorCanonical(empty, ['weight', 'height', 'restingHr', 'maxHr']);
  ok('M4 geleerte Felder ⇒ null (198/58/75/175 wären damit löschbar)', pe.weightKg == null && pe.hfMaxMeasured == null && pe.hfMax == null);
  ok('M5 rhrBaseline wird nie genullt', !('rhrBaseline' in pe));
  const src = readFileSync(new URL('profile.js', base), 'utf8');
  ok('M6 _perfSave nutzt den Mirror', /_perfMirrorCanonical\(PROFILE\.performance,touchedBodyKeys\)/.test(src.split('function _perfSave')[1].slice(0, 300)));
  ok('M7 Editor zeigt HFmax an', /row\('HFmax'/.test(src));

  /* ---------- 2b) Doppelwelt-Fix (Phase 5, 2026-07-17): NUR bearbeitete Felder mirrorn ---------- */
  // Ohne touchedBodyKeys (Aufrufer betrifft keine Körperdaten, z.B. Ausdauerwerte/Bestzeiten/
  // Kraftwerte-Editor) darf NICHTS zurückgeschrieben werden — sonst würde ein automatisch
  // synchronisierter Garmin-Wert durch einen veralteten, einmalig gecachten Editor-Wert
  // überschrieben.
  const pNone = h.sb._perfMirrorCanonical(perf);
  ok('D1 ohne touchedBodyKeys wird NICHTS gemirrort (Default sicher)', Object.keys(pNone).length === 0, JSON.stringify(pNone));
  const pNoneExplicit = h.sb._perfMirrorCanonical(perf, []);
  ok('D2 leeres touchedBodyKeys-Array ⇒ ebenfalls nichts gemirrort', Object.keys(pNoneExplicit).length === 0, JSON.stringify(pNoneExplicit));
  // Nur 'weight' bearbeitet ⇒ NUR weightKg im Patch, alle anderen Felder fehlen komplett
  // (nicht nur null — sie dürfen im Object.assign(PROFILE,...) gar nicht als Key auftauchen).
  const pWeightOnly = h.sb._perfMirrorCanonical(perf, ['weight']);
  ok('D3 nur weightKg im Patch, wenn nur weight bearbeitet wurde', 'weightKg' in pWeightOnly && !('heightCm' in pWeightOnly) && !('hfMaxMeasured' in pWeightOnly) && !('restingHrMeasured' in pWeightOnly) && !('hfMax' in pWeightOnly) && !('rhrBaseline' in pWeightOnly), JSON.stringify(pWeightOnly));
  // Nur 'restingHr' bearbeitet ⇒ restingHrMeasured UND rhrBaseline mitkommen (Baseline hängt
  // untrennbar an restingHr), aber weightKg/heightCm/hfMax* nicht.
  const pRhrOnly = h.sb._perfMirrorCanonical(perf, ['restingHr']);
  ok('D4 nur restingHr bearbeitet ⇒ restingHrMeasured+rhrBaseline, sonst nichts', pRhrOnly.restingHrMeasured === 52 && pRhrOnly.rhrBaseline === 52 && !('weightKg' in pRhrOnly) && !('hfMaxMeasured' in pRhrOnly), JSON.stringify(pRhrOnly));

  // Seed-Fix: stammte der letzte Section-Write von 'provider_sync' (Garmin), muss ein noch
  // unbearbeitetes Editor-Feld beim Seed korrekt als 'garmin' gelabelt werden, nicht 'manual'.
  const h2 = makeApp();
  const M2 = h2.sb.ORVIA.profileModel;
  Object.assign(h2.sb.PROFILE, { weightKg: 82 });
  M2.ensureSectionMeta(h2.sb.PROFILE);
  h2.sb.PROFILE._sectionMeta.body = { updatedAt: new Date().toISOString(), source: 'provider_sync', schemaVersion: h2.sb.PROFILE._sectionMeta.body.schemaVersion };
  const perfG = h2.sb._perfSeedFromCanonical(M2.normalizePerformance(h2.sb.PROFILE.performance, h2.sb.PROFILE.body));
  ok('D5 Seed labelt unbearbeiteten Garmin-Wert korrekt als \'garmin\' (nicht \'manual\')', perfG.body.weight.source === 'garmin', perfG.body.weight.source);
  // Kontrolle: ohne provider_sync-Herkunft bleibt der bisherige Default 'manual' erhalten.
  const h3 = makeApp();
  const M3 = h3.sb.ORVIA.profileModel;
  Object.assign(h3.sb.PROFILE, { weightKg: 82 });
  const perfM = h3.sb._perfSeedFromCanonical(M3.normalizePerformance(h3.sb.PROFILE.performance, h3.sb.PROFILE.body));
  ok('D6 Seed ohne provider_sync-Section-Quelle bleibt \'manual\' (Bestandsverhalten unverändert)', perfM.body.weight.source === 'manual', perfM.body.weight.source);
}

/* ---------- 3) nutrition: keine erfundenen Werte ---------- */
{
  const sb = { window: null, PROFILE: { nutrition: {} }, DB: {}, todayStr: () => '2026-07-09', Calc: { nutritionTargets: np => ({ protein: Math.round((np.weightKg || 0) * 1.9) }) }, console };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('nutrition.js', base), 'utf8'), sb, { filename: 'nutrition.js' });
  ok('N1 nutProfile ohne Fake-Defaults', sb.nutProfile().weightKg === null && sb.nutProfile().heightCm === null && sb.nutProfile().age === null);
  ok('N2 nutToday null bei fehlenden Werten', sb.nutToday() === null);
  ok('N3 trainingBurn 0 ohne Gewicht', sb.trainingBurnToday() === 0);
  ok('N4 nutWeekly null statt 140g-Fantasieziel', sb.nutWeekly() === null);
  sb.PROFILE = { weightKg: 70, heightCm: 180, age: 25, nutrition: {} };
  ok('N5 vollständige Daten ⇒ Berechnung läuft', sb.nutToday() !== null);
  const nsrc = readFileSync(new URL('nutrition.js', base), 'utf8');
  ok('N6 Leerzustand-Hinweis vorhanden', /Hinterlege Körperdaten/.test(nsrc));
}

/* ---------- 4) Personenbezogene Hardcodes entfernt ---------- */
{
  const supp = readFileSync(new URL('supplements.js', base), 'utf8');
  ok('H1 kein Flensburg in supplements', !/Flensburg/.test(supp));
  ok('H2 keine persönlichen Annahmen („nimmst du bereits"/Tendinopathie-Du-Bezug)', !/nimmst du bereits|deiner Tendinopathie/.test(supp));
  const act = readFileSync(new URL('activity.js', base), 'utf8');
  ok('H3 Demo-Route ohne personenbezogene Geodaten', !/Flensburg|54\.78/.test(act));
  const prof = readFileSync(new URL('profile.js', base), 'utf8');
  ok('H4 PROFILE_DEFAULTS weiter ohne Körperwerte', /weightKg:\s*null/.test(prof) && /heightCm:\s*null/.test(prof));
}

/* ---------- 5) CSS: time-Inputs mobile-safe ---------- */
{
  const css = readFileSync(new URL('../styles.css', base), 'utf8');
  ok('C1 input[type=time] in der Mobile-Safe-Regel', /input\[type=date\],\.gm-field input\[type=time\]\{[^}]*min-width:0[^}]*width:100%/.test(css));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
