/* ============================================================
   ORVIA · Profil-Completion-Fix-Paket (nach v8-177/2B-①).
   Root Cause (Analyse 2026-07-09):
   - Completion prüft s.level / s.sessionsPerWeek / s.typicalDuration am
     Sport-Eintrag — der Sportprofil-Editor schrieb nur sportProfile.
     competitionLevel; für die zwei Zahlenfelder gab es KEINEN Editor-Pfad.
   - constraintsAcknowledgedAt setzte nur der Onboarding-Abschluss —
     kein „Ich habe keine Beschwerden"-Weg im Editor.
   - Plus-Button: `.tabbar button` (0,1,1) überschrieb `.nav-plus` (0,1,0)
     → Form/Gold-Verlauf verloren, Glow-Artefakt.
   Verträge dieses Pakets:
   1. profileModel.ESSENTIAL_FIELD_LABELS benennt JEDEN required-Key deutsch.
   2. Sportprofil-Editor schreibt die kanonischen Trainingsstand-Felder
      (Merge-Helfer pur testbar), Completion wird danach vollständig.
   3. orviaAcknowledgeNoConstraints() setzt constraintsAcknowledgedAt über
      _profileSave(['constraints']) → Completion vollständig, Event feuert.
   4. Profil-Center nennt fehlende Angaben konkret (nicht nur „x fehlen").
   5. Editoren zeigen einen Fehlt-Hinweis (pur testbar) + Quelltext-Vertrag.
   6. styles.css: Plus-Regeln mit Spezifität ≥ `.tabbar button.nav-plus`.
   node supabase/tests/profile_completion_fix_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

function makeApp() {
  const store = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.console = { log() {}, warn() {}, error() {}, debug() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN;
  sb.Array = Array; sb.Object = Object; sb.String = String; sb.Set = Set; sb.Number = Number; sb.isFinite = isFinite;
  sb.Promise = Promise; sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout; sb.Intl = Intl;
  sb.navigator = { onLine: true };
  sb.escH = s => String(s == null ? '' : s); sb.toast = () => {}; sb.renderProfileScreen = () => {}; sb.renderZones = () => {}; sb.maybePlanImpact = () => {};
  const wl = {}; sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
  sb.addEventListener = (t, f) => { (wl[t] = wl[t] || []).push(f); };
  sb.removeEventListener = () => {};
  sb.dispatchEvent = e => { (wl[e.type] || []).slice().forEach(f => f(e)); return true; };
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb.document = { getElementById: () => null, createElement: () => ({ classList: { add() {}, remove() {} }, style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [] }), body: { appendChild() {} }, querySelector: () => null, querySelectorAll: () => [], documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } }, addEventListener() {}, activeElement: null };
  sb.ORVIA = {};
  vm.createContext(sb);
  const base = new URL('../../js/', import.meta.url);
  ['profile-model.js', 'onboarding/onboarding-profile-logic.js', 'onboarding/onboarding-sports-logic.js', 'profile.js', 'profile-center.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  sb.ensureProfile();
  return { sb, store, O: sb.ORVIA, wl };
}

/* ---------- 1) Benennungs-SSoT: ESSENTIAL_FIELD_LABELS ---------- */
{
  const h = makeApp();
  const M = h.O.profileModel;
  ok('L1 ESSENTIAL_FIELD_LABELS exportiert', M && typeof M.ESSENTIAL_FIELD_LABELS === 'object' && M.ESSENTIAL_FIELD_LABELS !== null);
  if (M && M.ESSENTIAL_FIELD_LABELS) {
    // Jeder required-Key jeder Essential-Section MUSS benannt sein (keine anonymen Lücken).
    let missingLabels = [];
    ['personal', 'sports', 'goals', 'availability', 'constraints'].forEach(sec => {
      const r = M.computeSectionCompleteness({}, sec);
      r.required.forEach(k => { if (!M.ESSENTIAL_FIELD_LABELS[k]) missingLabels.push(sec + '.' + k); });
    });
    ok('L2 alle required-Keys deutsch benannt', missingLabels.length === 0, missingLabels.join(','));
    ok('L3 Kernlabels korrekt', M.ESSENTIAL_FIELD_LABELS.primary_level === 'Trainingsniveau' && /Einheiten pro Woche/.test(M.ESSENTIAL_FIELD_LABELS.primary_sessions_per_week || '') && /Dauer/.test(M.ESSENTIAL_FIELD_LABELS.primary_typical_duration || ''));
  } else { ok('L2 (übersprungen — L1 rot)', false); ok('L3 (übersprungen — L1 rot)', false); }
}

/* ---------- 2) Sports: Editor schreibt kanonische Trainingsstand-Felder ---------- */
{
  const h = makeApp();
  const M = h.O.profileModel;
  h.sb.PROFILE.sports = M.normalizeSports([{ sportId: 'running', role: 'primary' }]);
  const before = M.computeSectionCompleteness(h.sb.PROFILE, 'sports');
  ok('S1 Ausgang: 3 Angaben fehlen', before.missing.length === 3 && before.missing.indexOf('primary_level') >= 0);
  ok('S2 Merge-Helfer _sppMergeSport exportiert', typeof h.sb._sppMergeSport === 'function');
  if (typeof h.sb._sppMergeSport === 'function') {
    const s0 = h.sb.PROFILE.sports[0];
    const merged = h.sb._sppMergeSport(s0, 'primary', { competitionLevel: 'amateur' }, { level: 'intermediate', sessionsPerWeek: 4, typicalDuration: 60 });
    ok('S3 kanonische Felder gesetzt', merged.level === 'intermediate' && merged.sessionsPerWeek === 4 && merged.typicalDuration === 60);
    ok('S4 competitionLevel bleibt separat erhalten', merged.sportProfile && merged.sportProfile.competitionLevel === 'amateur');
    ok('S5 Nicht-Mutation des Eingabeobjekts', s0.level == null);
    h.sb.PROFILE.sports = [merged];
    const after = M.computeSectionCompleteness(h.sb.PROFILE, 'sports');
    ok('S6 Completion sports vollständig nach Merge', after.complete === true, JSON.stringify(after.missing));
    // leere Eingaben degradieren vorhandene Werte nicht
    const kept = h.sb._sppMergeSport(merged, 'primary', {}, { level: null, sessionsPerWeek: null, typicalDuration: null });
    ok('S7 leere Canon-Eingabe erhält Bestandswerte', kept.level === 'intermediate' && kept.sessionsPerWeek === 4);
  } else { ['S3', 'S4', 'S5', 'S6', 'S7'].forEach(n => ok(n + ' (übersprungen — S2 rot)', false)); }
  // Quelltext-Vertrag: Editor rendert + sammelt die drei Felder
  const src = readFileSync(new URL('../../js/profile.js', import.meta.url), 'utf8');
  ok('S8 Editor rendert Trainingsstand-Felder', /spp_canlevel/.test(src) && /spp_spw/.test(src) && /spp_dur/.test(src));
  ok('S9 Save nutzt Merge-Helfer', /_sppMergeSport\(/.test(src.split('function saveSportProfileEditor')[1] || ''));
}

/* ---------- 3) Constraints: „Keine Beschwerden"-Acknowledge ---------- */
{
  const h = makeApp();
  const M = h.O.profileModel;
  ok('C1 orviaAcknowledgeNoConstraints exportiert', typeof h.sb.orviaAcknowledgeNoConstraints === 'function');
  if (typeof h.sb.orviaAcknowledgeNoConstraints === 'function') {
    const before = M.computeSectionCompleteness(h.sb.PROFILE, 'constraints');
    ok('C2 Ausgang: Sicherheits-Check offen', before.complete === false);
    let evt = null;
    h.sb.addEventListener('orvia:profile-updated', e => { evt = e; });
    h.sb.orviaAcknowledgeNoConstraints();
    ok('C3 constraintsAcknowledgedAt gesetzt (ISO)', !!h.sb.PROFILE.constraintsAcknowledgedAt && !isNaN(Date.parse(h.sb.PROFILE.constraintsAcknowledgedAt)));
    const after = M.computeSectionCompleteness(h.sb.PROFILE, 'constraints');
    ok('C4 Completion constraints vollständig', after.complete === true);
    ok('C5 Event mit changedSections constraints', !!evt && (evt.detail.changedSections || []).indexOf('constraints') >= 0);
    ok('C6 _sectionMeta.constraints getoucht', !!(h.sb.PROFILE._sectionMeta && h.sb.PROFILE._sectionMeta.constraints && h.sb.PROFILE._sectionMeta.constraints.updatedAt));
    ok('C7 Blob persistiert (Reload-Erhalt)', !!h.store.orvia_profile_v1 && JSON.parse(h.store.orvia_profile_v1).constraintsAcknowledgedAt === h.sb.PROFILE.constraintsAcknowledgedAt);
  } else { ['C2', 'C3', 'C4', 'C5', 'C6', 'C7'].forEach(n => ok(n + ' (übersprungen — C1 rot)', false)); }
  const src = readFileSync(new URL('../../js/profile.js', import.meta.url), 'utf8');
  ok('C8 Beschwerden-Editor bietet den Bestätigen-Pfad an', /orviaAcknowledgeNoConstraints/.test(src.split('function openConstraintsEditor')[1] || ''));
}

/* ---------- 4) Profil-Center: fehlende Angaben KONKRET benannt ---------- */
{
  const h = makeApp();
  const M = h.O.profileModel;
  const p = {
    name: 'Gian', birthDate: '2003-07-01',
    sports: M.normalizeSports([{ sportId: 'running', role: 'primary' }]),
    goals: [{ type: 'event', title: 'HM sub 1:50', status: 'active' }]
  };
  const html = h.O.profileCenter._buildBodyHTML(p, new Date('2026-07-09T12:00:00Z'));
  ok('P1 sports-Karte nennt Trainingsniveau', /Trainingsniveau/.test(html));
  ok('P2 sports-Karte nennt Einheiten pro Woche', /Einheiten pro Woche/.test(html));
  ok('P3 sports-Karte nennt typische Dauer', /Dauer/.test(html));
  ok('P4 availability-Karte nennt Trainingstage', /Trainingstag/.test(html));
  ok('P5 constraints-Karte nennt Sicherheits-Check', /Sicherheits-Check/.test(html));
  ok('P6 Chip-Zählung bleibt („3 Angaben fehlen")', /3 Angaben fehlen/.test(html));
  // Vollständiges Profil: keine Fehlt-Nennung mehr
  const full = {
    name: 'Gian', birthDate: '2003-07-01',
    sports: M.normalizeSports([{ sportId: 'running', role: 'primary', level: 'intermediate', sessionsPerWeek: 4, typicalDuration: 60 }]),
    goals: [{ type: 'event', title: 'HM sub 1:50', status: 'active' }],
    availability: { days: { mo: { available: true } } },
    constraintsAcknowledgedAt: '2026-07-09T10:00:00.000Z'
  };
  const html2 = h.O.profileCenter._buildBodyHTML(full, new Date('2026-07-09T12:00:00Z'));
  ok('P7 vollständig: „Profil vollständig" im Header', /Profil vollständig/.test(html2));
  ok('P8 vollständig: keine „fehlt"-Nennung in Karten', !/Angaben fehlen|Angabe fehlt/.test(html2));
}

/* ---------- 5) Fehlt-Hinweis in Editoren (pur + Quelltext-Vertrag) ---------- */
{
  const h = makeApp();
  const M = h.O.profileModel;
  ok('H1 _missingHintHTML exportiert', typeof h.sb._missingHintHTML === 'function');
  if (typeof h.sb._missingHintHTML === 'function') {
    h.sb.PROFILE.sports = M.normalizeSports([{ sportId: 'running', role: 'primary' }]);
    const hint = h.sb._missingHintHTML('sports');
    ok('H2 Hinweis nennt alle 3 fehlenden Angaben', /Trainingsniveau/.test(hint) && /Einheiten pro Woche/.test(hint) && /Dauer/.test(hint));
    ok('H3 Hinweis mit role=alert (A11y)', /role="alert"/.test(hint));
    h.sb.PROFILE.sports = M.normalizeSports([{ sportId: 'running', role: 'primary', level: 'intermediate', sessionsPerWeek: 4, typicalDuration: 60 }]);
    ok('H4 vollständig → kein Hinweis (leerer String)', h.sb._missingHintHTML('sports') === '');
  } else { ['H2', 'H3', 'H4'].forEach(n => ok(n + ' (übersprungen — H1 rot)', false)); }
  const src = readFileSync(new URL('../../js/profile.js', import.meta.url), 'utf8');
  ok('H5 Verfügbarkeits-Editor bindet Hinweis ein', /_missingHintHTML\(\s*'availability'\s*\)/.test(src));
  ok('H6 Sportprofil-Editor bindet Hinweis ein', /_missingHintHTML\(\s*'sports'\s*\)/.test(src));
  ok('H7 Beschwerden-Editor bindet Hinweis ein', /_missingHintHTML\(\s*'constraints'\s*\)/.test(src));
}

/* ---------- 6) Plus-Button: CSS-Spezifität ≥ .tabbar button ---------- */
{
  const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
  ok('B1 Hauptregel mit .tabbar button.nav-plus', /\.tabbar button\.nav-plus\s*\{[^}]*width:\s*52px[^}]*height:\s*52px[^}]*border-radius:\s*50%/.test(css));
  ok('B2 Gold-Verlauf in der spezifischen Regel', /\.tabbar button\.nav-plus\s*\{[^}]*linear-gradient/.test(css));
  ok('B3 Icon-Regel spezifisch (.tabbar button.nav-plus .ic)', /\.tabbar button\.nav-plus \.ic\s*\{[^}]*width:\s*24px/.test(css));
  ok('B4 320px-Media-Query spezifisch', /@media \(max-width:\s*340px\)\s*\{\s*\.tabbar button\.nav-plus\s*\{[^}]*width:\s*48px[^}]*height:\s*48px/.test(css));
  // Keine schwache 52px-Regel mehr, die stillschweigend verliert:
  ok('B5 keine unterlegene .nav-plus-Größenregel übrig', !/(^|\})\s*\.nav-plus\s*\{[^}]*width:\s*52px/.test(css));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
