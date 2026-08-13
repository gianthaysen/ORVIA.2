/* ============================================================
   ORVIA · M10 — Profilzentrale (Shell). Test-first.
   Verträge:
   - js/profile-center.js: ORVIA.profileCenter mit reinen Buildern
     (sectionSummary/sectionStatus/buildSmartPrompts/buildHeaderModel)
     + open() über bestehendes openSheet (kein drittes Overlay-System).
   - Liest NUR profile-model (Completeness/Freshness/_sectionMeta);
     Editor-Öffnung ausschließlich über openProfileSection(id)
     (ein Delegationspunkt, kein zweiter Schreibpfad).
   - Max. 2 Smart Prompts, priorisiert, datengetrieben, ehrlich
     (keine erfundenen Integrationen, kein nackter Prozentwert je Bereich).
   node supabase/tests/profile_center_m10_test.mjs
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

const store = {};
const sheetCalls = [];
const sectionCalls = [];
const sb = {}; sb.window = sb; sb.self = sb; sb.console = console;
sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.Array = Array; sb.Object = Object; sb.String = String; sb.Set = Set; sb.Number = Number; sb.isFinite = isFinite;
const wl = {}; sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
sb.addEventListener = (t, f) => { (wl[t] = wl[t] || []).push(f); };
sb.removeEventListener = (t, f) => { wl[t] = (wl[t] || []).filter(x => x !== f); };
sb.dispatchEvent = e => { (wl[e.type] || []).slice().forEach(f => f(e)); return true; };
sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
// Mini-DOM (Registry)
const reg = new Map();
function registerHtmlIds(html) { var m, re = /id="([^"]+)"/g; while ((m = re.exec(String(html || '')))) { if (!reg.has('#' + m[1])) reg.set('#' + m[1], mkEl()); } }
function mkEl() {
  const el = { style: {}, _html: '', value: '', textContent: '', disabled: false, _id: null, _ev: {}, _attr: {},
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c, f) { if (f === undefined) f = !this._s.has(c); if (f) this._s.add(c); else this._s.delete(c); return f; } },
    setAttribute(k, v) { this._attr[k] = String(v); if (k === 'id' && v) { this._id = v; reg.set('#' + v, this); } }, getAttribute(k) { return k in this._attr ? this._attr[k] : null; }, removeAttribute(k) { delete this._attr[k]; },
    addEventListener(ev, cb) { this._ev[ev] = cb; }, appendChild(c) { if (c && c._id) reg.set('#' + c._id, c); if (c) registerHtmlIds(c._html); return c; }, remove() {}, focus() { this._focused = true; },
    querySelector(s) { return reg.has(s) ? reg.get(s) : (reg.set(s, mkEl()), reg.get(s)); }, querySelectorAll() { return []; } };
  Object.defineProperty(el, 'innerHTML', { get() { return this._html; }, set(v) { this._html = v; registerHtmlIds(v); } });
  Object.defineProperty(el, 'id', { get() { return this._id; }, set(v) { this._id = v; if (v) reg.set('#' + v, this); } });
  return el;
}
sb.document = { getElementById: id => reg.has('#' + id) ? reg.get('#' + id) : null, createElement: () => mkEl(), body: { appendChild(c) { if (c) registerHtmlIds(c._html); } }, querySelector: s => (reg.has(s) ? reg.get(s) : (reg.set(s, mkEl()), reg.get(s))), querySelectorAll: () => [], documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } } };
sb.escH = s => String(s == null ? '' : s);
// Delegationspunkte als Spies (openSheet/_closeM/openProfileSection kommen produktiv aus profile.js)
sb.openSheet = opts => { sheetCalls.push(opts); registerHtmlIds(opts && opts.body); return mkEl(); };
sb._closeM = () => {};
sb.openProfileSection = id => { sectionCalls.push(id); };
vm.createContext(sb);
const base = new URL(_APPREL + 'js/', import.meta.url);
vm.runInContext(readFileSync(new URL('profile-model.js', base), 'utf8'), sb, { filename: 'profile-model.js' });
vm.runInContext(readFileSync(new URL('profile-center.js', base), 'utf8'), sb, { filename: 'profile-center.js' });
const PC = sb.ORVIA.profileCenter;
const M = sb.ORVIA.profileModel;
const NOW = new Date('2026-07-03T12:00:00.000Z');

ok('E1 Export profileCenter', !!PC);
['sectionSummary', 'sectionStatus', 'buildSmartPrompts', 'buildHeaderModel', 'open'].forEach(fn => ok('E2 Export: ' + fn, !!PC && typeof PC[fn] === 'function'));
if (!PC || typeof PC.buildSmartPrompts !== 'function') { console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen. (RED)'); process.exit(1); }

function fullProfile() {
  const p = {
    name: 'Gian', birthDate: '2003-08-01', sex: 'male', heightCm: 183, weightKg: 78,
    hfMaxMeasured: 195, restingHrMeasured: 48,
    sports: M.normalizeSports([{ sportId: 'running', role: 'primary', level: 'intermediate', sessionsPerWeek: 4, typicalDuration: 60, includeInPlan: true }, { sportId: 'gym', role: 'secondary', includeInPlan: true }]),
    goals: M.normalizeGoals([{ title: 'HM unter 1:50', category: 'half_marathon', priority: 1, targetDate: '2026-09-06' }]),
    availability: M.normalizeAvailability({ days: { di: { available: true }, do: { available: true }, sa: { available: true } } }),
    constraintsList: [], constraintsAcknowledgedAt: '2026-07-01T10:00:00.000Z',
    recovery: M.normalizeRecovery({ sleep: { averageHours: 7 } })
  };
  M.ensureSectionMeta(p);
  M.touchSectionMeta(p, ['personal', 'sports', 'goals', 'availability', 'constraints'], 'onboarding', '2026-07-01T10:00:00.000Z');
  return p;
}

/* ---------- Header-Modell ---------- */
{
  const h = PC.buildHeaderModel(fullProfile(), NOW);
  ok('H1 Initialen + Name', h.initials === 'G' && h.name === 'Gian');
  ok('H2 Hauptsport-Label', h.primarySportLabel === 'Laufen');
  ok('H3 Hauptziel + Datum', h.primaryGoalTitle === 'HM unter 1:50' && !!h.primaryGoalDate);
  ok('H4 Essential vollständig → ring 100 + ehrlicher Text', h.essentialComplete === true && h.ringPercent === 100);
  const empty = PC.buildHeaderModel({ name: '' }, NOW);
  ok('H5 leeres Profil: ehrlich unvollständig, keine Erfindungen', empty.essentialComplete === false && empty.ringPercent < 100 && empty.primarySportLabel === null);
}
/* ---------- Section-Status (ehrlich) ---------- */
{
  const p = fullProfile();
  ok('S1 sports vollständig → ok-Chip', PC.sectionStatus(p, 'sports', NOW).kind === 'ok');
  const p2 = fullProfile(); p2.goals = [];
  const st2 = PC.sectionStatus(p2, 'goals', NOW);
  ok('S2 goals leer → missing + Zähler', st2.kind === 'missing' && /fehl/i.test(st2.label));
  // Veraltete Beschwerden (zeitkritisch 14 Tage) → stale
  const p3 = fullProfile();
  p3.constraintsList = [M.normalizeConstraint({ bodyRegion: 'knee', intensity: 4, status: 'active' }, '2026-05-01T00:00:00.000Z')];
  p3._sectionMeta.constraints.updatedAt = '2026-05-01T00:00:00.000Z';
  const st3 = PC.sectionStatus(p3, 'constraints', NOW);
  ok('S3 alte aktive Beschwerde → veraltet/prüfen', st3.kind === 'stale' || st3.kind === 'review');
  const st4 = PC.sectionStatus({}, 'recovery', NOW);
  ok('S4 optionale Section ohne Daten → optional (nicht „fehlt")', st4.kind === 'optional');
}
/* ---------- Smart Prompts (max 2, priorisiert, ehrlich) ---------- */
{
  const pr0 = PC.buildSmartPrompts(fullProfile(), NOW);
  ok('P1 vollständiges frisches Profil → keine Prompts', Array.isArray(pr0) && pr0.length === 0);
  // Fehlende Essentials dominieren
  const p1 = fullProfile(); p1.goals = []; p1.availability = { days: {} };
  const pr1 = PC.buildSmartPrompts(p1, NOW);
  ok('P2 max. 2 Prompts', pr1.length === 2);
  ok('P3 Essential-Lücken zuerst', pr1.every(x => x.severity === 'high'));
  ok('P4 Prompt trägt sectionId für Delegation', pr1.every(x => typeof x.sectionId === 'string'));
  // Ziel ohne Datum → mittlere Priorität
  const p2 = fullProfile(); p2.goals = M.normalizeGoals([{ title: 'HM', category: 'half_marathon', priority: 1 }]);
  const pr2 = PC.buildSmartPrompts(p2, NOW);
  ok('P5 Ziel ohne Datum → Datums-Prompt', pr2.some(x => x.id === 'goal_date'));
  // Ausdauer-Hauptsport ohne gemessene HFmax → ehrlicher Mess-Hinweis (low)
  const p3 = fullProfile(); p3.hfMaxMeasured = null;
  const pr3 = PC.buildSmartPrompts(p3, NOW);
  ok('P6 HFmax-Prompt nur als „gemessen"-Hinweis', pr3.some(x => x.id === 'hfmax_measured' && /gemessen/i.test(x.hint || x.title)));
  // Gewicht fehlt → Ergänzungs-Prompt
  const p4 = fullProfile(); p4.weightKg = null;
  ok('P7 Gewicht fehlt → Prompt', PC.buildSmartPrompts(p4, NOW).some(x => x.id === 'weight_missing'));
  // Keine erfundenen Integrationen
  const src = readFileSync(new URL('profile-center.js', base), 'utf8');
  ok('P8 keine Integrations-Werbung (Garmin/Strava „verbinden")', !/verbinde\s+(dein\s+)?(Garmin|Strava)/i.test(src));
}
/* ---------- Rendering + Delegation ---------- */
{
  sb.PROFILE = fullProfile();
  sb.ORVIA.profile = { get: () => sb.PROFILE, load: () => sb.PROFILE, subscribe: fn => { (wl['orvia:profile-updated'] = wl['orvia:profile-updated'] || []).push(fn); return () => {}; } };
  sheetCalls.length = 0; sectionCalls.length = 0;
  PC.open();
  ok('R1 öffnet über openSheet (kein drittes Overlay-System)', sheetCalls.length === 1 && sheetCalls[0].id === '_profileCenter' && sheetCalls[0].size === 'full');
  const body = String(sheetCalls[0].body || '');
  ok('R2 Header: Name + Hauptsport + Ziel', body.indexOf('Gian') >= 0 && body.indexOf('Laufen') >= 0 && body.indexOf('HM unter 1:50') >= 0);
  ok('R3 Vollständigkeits-Ring als SVG', body.indexOf('pc-ring') >= 0 && body.indexOf('<svg') >= 0);
  ok('R4 vier Gruppen', ['Training', 'Gesundheit', 'Leistung', 'Einstellungen'].every(g => body.indexOf(g) >= 0));
  ok('R5 SectionCards mit Status-Chips', body.indexOf('pc-card') >= 0 && body.indexOf('pc-chip') >= 0);
  ok('R6 planImpact-Badge („beeinflusst Plan") vorhanden', body.indexOf('beeinflusst Plan') >= 0);
  ok('R7 Konto/Datenschutz ehrlich („in Vorbereitung")', body.indexOf('in Vorbereitung') >= 0);
  // Delegation: Karten-Klick öffnet bestehenden Editor über openProfileSection
  const goalsCard = reg.get('#pc-card-goals');
  ok('R8 Karte goals existiert', !!goalsCard);
  if (goalsCard && goalsCard._ev.click) { goalsCard._ev.click({ preventDefault() {} }); }
  else if (goalsCard && typeof goalsCard.onclick === 'function') { goalsCard.onclick(); }
  ok('R9 Klick delegiert an openProfileSection(goals)', sectionCalls.indexOf('goals') >= 0);
  // Kein direkter Schreibpfad
  const src = readFileSync(new URL('profile-center.js', base), 'utf8');
  ok('R10 kein saveProfile/_profileSave im Center (nur lesend)', !/saveProfile\s*\(|_profileSave\s*\(/.test(src));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
