/* ORVIA · 4i.1 — geführtes Onboarding: Ziele/Trainingsalltag/Zusammenfassung + zentraler Abschluss. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const store = {};
const sb = {}; sb.window = sb; sb.self = sb; sb.console = console;
sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.Array = Array; sb.Object = Object; sb.String = String; sb.Set = Set; sb.setTimeout = (f) => f && f();
const wl = {}; sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; }; sb.addEventListener = (t, f) => { (wl[t] = wl[t] || []).push(f); }; sb.removeEventListener = () => {}; sb.dispatchEvent = e => { (wl[e.type] || []).forEach(f => f(e)); return true; };
sb.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
// reg-basiertes DOM
let reg = new Map();
function registerHtmlIds(html) { var m, re = /id="([^"]+)"/g; while ((m = re.exec(String(html || '')))) { if (!reg.has('#' + m[1])) reg.set('#' + m[1], makeEl(m[1])); } }
function makeEl(id) {
  const el = { _id: id || null, _html: '', value: '', checked: false, dataset: {}, _ev: {}, style: {}, disabled: false, textContent: '',
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c);}, contains(c){return this._s.has(c);} },
    setAttribute(k,v){ if(k==='id'&&v){ this._id=String(v); reg.set('#'+v, this); } this._attr=this._attr||{}; this._attr[k]=String(v); }, removeAttribute(k){ if(this._attr)delete this._attr[k]; }, getAttribute(k){ return this._attr&&k in this._attr?this._attr[k]:null; }, addEventListener(ev,cb){ this._ev[ev]=cb; }, remove(){}, focus(){}, appendChild(c){ if(c&&c._id)reg.set('#'+c._id,c); if(c&&c._html)registerHtmlIds(c._html); },
    querySelector(s){ return reg.has(s) ? reg.get(s) : (reg.set(s, makeEl(s.replace('#',''))), reg.get(s)); }, querySelectorAll(){ return []; } };
  Object.defineProperty(el, 'innerHTML', { get(){return this._html;}, set(v){ this._html=v; registerHtmlIds(v); } });
  Object.defineProperty(el, 'id', { get(){return this._id;}, set(v){ this._id=v; if(v)reg.set('#'+v, this); } });
  return el;
}
const docEl = { activeElement: null, visibilityState: 'visible', documentElement: { classList: { _s:new Set(), add(){}, remove(){}, contains(){return false;} } }, body: { appendChild(c){ if(c&&c._html)registerHtmlIds(c._html); } }, createElement: () => makeEl(), getElementById: id => reg.has('#'+id)?reg.get('#'+id):null, querySelector: s => reg.has(s)?reg.get(s):(reg.set(s,makeEl(s.replace(/[#.]/,''))),reg.get(s)), addEventListener(){} };
sb.document = docEl;
sb.escH = s => String(s == null ? '' : s); sb.toast = () => {}; sb.renderProfileScreen = () => {}; sb.renderZones = () => {};
vm.createContext(sb);
const base = new URL('../../../app/js/', import.meta.url);
for (const f of ['profile-model.js', 'onboarding/onboarding-profile-logic.js', 'onboarding/onboarding-sports-logic.js', 'onboarding/onboarding-logic.js', 'onboarding/onboarding-steps.js', 'onboarding/onboarding-store.js', 'profile-ui-kit.js', 'onboarding/onboarding-ui.js', 'profile.js'])
  vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f });
const OB = sb.ORVIA.onboardingV2, M = sb.ORVIA.profileModel;
function card() { return reg.get('.ob2-card'); }
function reset() { reg = new Map(); OB._reset(); }

// Neuer Nutzer (kein Profil) → braucht Onboarding
ok('4i.1-21 Bestandsnutzer kein Pflicht-Onboarding (mit Daten)', M.isOnboardingComplete({ sports: [{ sportId: 'running' }] }) === true);

// Onboarding starten, direkt zu Ziele-Schritt
reset(); OB.open({ fresh: false });
OB._state.draft.draftData = { profile: { displayName: 'Gian', heightCm: 180, weightKg: 75 }, sports: { sports: [{ sportId: 'running', visible: true, planningEnabled: true, role: 'primary' }] } };
// M5b-Fixture: Trainingsstand der Hauptsportart (Review-Kette verlangt ihn)
OB._state.draft.draftData.sports.sports[0].level = 'intermediate';
OB._state.draft.draftData.sports.sports[0].sessionsPerWeek = 4;
OB._state.draft.currentStep = 'goals'; OB.renderGoalsStep();
ok('4i.1-1 Zielschritt (M6, Essential-Karten) angezeigt', !!reg.get('#goal-half_marathon') && !!reg.get('#goal-muscle_gain'));
// Essential-Ziel wählen → genau EIN kanonisches Ziel mit Auto-Titel
reg.get('#goal-half_marathon')._ev.click({ preventDefault() {} });
ok('4i.1-2/3 genau EIN Essential-Ziel (kanonische Kategorie)', OB._state.draft.draftData.goals.length === 1 && OB._state.draft.draftData.goals[0].category === 'half_marathon');
// Titel-Detail anpassen
reg.get('#obg-title').value = 'Halbmarathon 1:50';
if (reg.get('#obg-title')._ev.change) reg.get('#obg-title')._ev.change({});
ok('4i.1-4/7 Titel-Detail übernommen', OB._state.draft.draftData.goals[0].title === 'Halbmarathon 1:50');
// Umwahl ersetzt (kein Stapel) — und zurückwählen
reg.get('#goal-muscle_gain')._ev.click({ preventDefault() {} });
ok('4i.1-5 Umwahl ersetzt statt stapelt', OB._state.draft.draftData.goals.length === 1 && OB._state.draft.draftData.goals[0].category === 'muscle_gain');
reg.get('#goal-half_marathon')._ev.click({ preventDefault() {} });
reg.get('#obg-title').value = 'Halbmarathon 1:50';
if (reg.get('#obg-title')._ev.change) reg.get('#obg-title')._ev.change({});
OB._state.lastNav = 0; reg.get('#ob2-next').onclick();
ok('4i.1-6/8 Weiter → Verfügbarkeit (availability), keine Duplikate', OB._state.draft.currentStep === 'availability' && OB._state.draft.draftData.goals.length === 1);

// M7 (A5): Verfügbarkeit kompakt — Tages-Buttons + Dauer-Band
reg.get('#av-day-mo').onclick(); reg.get('#av-day-mi').onclick(); reg.get('#av-day-fr').onclick();
reg.get('#avdur-60')._ev.click({ preventDefault() {} });   // typische Dauer 60 min
OB._state.lastNav = 0; reg.get('#ob2-next').onclick();
let av = OB._state.draft.draftData.availability;
ok('4i.1-9/10/11 Verfügbarkeit übernommen (Tage + typische Dauer → maxMinutes)', av.days.mo.available === true && av.days.mo.singleSession.maxMinutes === 60 && av.days.fr.available === true);
ok('4i.1-12 nicht gewählte Tage bleiben Ruhetage', av.days.di.available === false);
ok('4i.1-13 Dauer erreicht sports[primary].typicalDuration', OB._state.draft.draftData.sports.sports.find(e => e.role === 'primary').typicalDuration === 60);

// M7 (A6): Sicherheitscheck — Nein-Pfad
ok('4i.1-13b Weiter → Sicherheitscheck', OB._state.draft.currentStep === 'safety');
reg.get('#safety-no')._ev.click({ preventDefault() {} });
OB._state.lastNav = 0; reg.get('#ob2-next').onclick();
ok('4i.1-13c Nein → Körperdaten (A7)', OB._state.draft.currentStep === 'body' && OB._state.draft.draftData.safety.hasComplaints === false);

// M7 (A7): Körperdaten optional — „Später ergänzen"
reg.get('#ob3-body-skip').onclick();
ok('4i.1-13d Skip → review (body in skippedSteps)', OB._state.draft.currentStep === 'review' && OB._state.draft.skippedSteps.indexOf('body') >= 0);

// Zusammenfassung
ok('4i.1-15 Zusammenfassung zeigt reale Werte (M8-ReviewCards)', OB._state.draft.currentStep === 'review' && (card().innerHTML || '').indexOf('Halbmarathon 1:50') >= 0 && (card().innerHTML || '').indexOf('Gian') >= 0 && (card().innerHTML || '').indexOf('Tage pro Woche') >= 0);
ok('4i.1-15b kein „Einrichtung vorgemerkt"/keine engl. Codes/kein <select>', (card().innerHTML || '').indexOf('Einrichtung vorgemerkt') < 0 && (card().innerHTML || '').indexOf('<select') < 0 && (card().innerHTML || '').indexOf('schedule_placeholder<') < 0);
// 16 Bearbeiten springt zurück
OB._editStep('goals');
ok('4i.1-16 Bearbeiten springt zum Schritt', OB._state.draft.currentStep === 'goals');
OB._state.draft.currentStep = 'review'; OB.renderSummaryStep();

// Abschluss
reg.get('#ob2-finish').onclick();
await new Promise(r => setTimeout(r, 5));   // M4: Abschluss ist asynchron (Persistenz wird awaited)
let saved = JSON.parse(store['orvia_profile_v1']);
ok('4i.1-17 Abschluss schreibt zentral (goals/sports/availability/personal)', saved.goals.length === 1 && saved.goals[0].title === 'Halbmarathon 1:50' && saved.sports.some(s => s.sportId === 'running') && saved.availability.days.mo.available === true && saved.name === 'Gian');
ok('4i.1-17b M7: Sicherheitscheck-Acknowledge persistiert', !!saved.constraintsAcknowledgedAt);
ok('4i.1-18 Onboarding-Status completed', saved.onboarding.status === 'completed' && !!saved.onboarding.completedAt);
ok('4i.1-22/23 keine Sport-/Zielduplikate', saved.sports.filter(s => s.sportId === 'running').length === 1 && M.normalizeGoals(saved.goals).length === 1);
ok('4i.1-19 Bestandsnutzer danach → kein Onboarding', M.isOnboardingComplete(saved) === true);

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
