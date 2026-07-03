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
  const el = { _id: id || null, _html: '', value: '', checked: false, dataset: {}, _ev: {},
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c);}, contains(c){return this._s.has(c);} },
    setAttribute(){}, removeAttribute(){}, getAttribute(){return null;}, addEventListener(){}, remove(){}, focus(){}, appendChild(c){ if(c&&c._html)registerHtmlIds(c._html); },
    querySelector(s){ return reg.has(s) ? reg.get(s) : (reg.set(s, makeEl(s.replace('#',''))), reg.get(s)); }, querySelectorAll(){ return []; } };
  Object.defineProperty(el, 'innerHTML', { get(){return this._html;}, set(v){ this._html=v; registerHtmlIds(v); } });
  Object.defineProperty(el, 'id', { get(){return this._id;}, set(v){ this._id=v; if(v)reg.set('#'+v, this); } });
  return el;
}
const docEl = { activeElement: null, visibilityState: 'visible', documentElement: { classList: { _s:new Set(), add(){}, remove(){}, contains(){return false;} } }, body: { appendChild(c){ if(c&&c._html)registerHtmlIds(c._html); } }, createElement: () => makeEl(), getElementById: id => reg.has('#'+id)?reg.get('#'+id):null, querySelector: s => reg.has(s)?reg.get(s):(reg.set(s,makeEl(s.replace(/[#.]/,''))),reg.get(s)), addEventListener(){} };
sb.document = docEl;
sb.escH = s => String(s == null ? '' : s); sb.toast = () => {}; sb.renderProfileScreen = () => {}; sb.renderZones = () => {};
vm.createContext(sb);
const base = new URL('../../js/', import.meta.url);
for (const f of ['profile-model.js', 'onboarding/onboarding-profile-logic.js', 'onboarding/onboarding-sports-logic.js', 'onboarding/onboarding-logic.js', 'onboarding/onboarding-steps.js', 'onboarding/onboarding-store.js', 'onboarding/onboarding-ui.js', 'profile.js'])
  vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f });
const OB = sb.ORVIA.onboardingV2, M = sb.ORVIA.profileModel;
function card() { return reg.get('.ob2-card'); }
function reset() { reg = new Map(); OB._reset(); }

// Neuer Nutzer (kein Profil) → braucht Onboarding
ok('4i.1-21 Bestandsnutzer kein Pflicht-Onboarding (mit Daten)', M.isOnboardingComplete({ sports: [{ sportId: 'running' }] }) === true);

// Onboarding starten, direkt zu Ziele-Schritt
reset(); OB.open({ fresh: false });
OB._state.draft.draftData = { profile: { displayName: 'Gian', heightCm: 180, weightKg: 75 }, sports: { sports: [{ sportId: 'running', visible: true, planningEnabled: true, role: 'primary' }] } };
OB._state.draft.currentStep = 'goals_placeholder'; OB.renderGoalsStep();
ok('4i.1-1 Zielschritt angezeigt', (card().innerHTML || '').indexOf('Ziele') >= 0 && (card().innerHTML || '').indexOf('Ziel hinzufügen') >= 0);
// Ziel anlegen (2x)
reg.get('#obg-add').onclick(); reg.get('#obg-add').onclick();
ok('4i.1-2/3 mehrere Ziele angelegt', OB._state.draft.draftData.goals.length === 2);
// Titel setzen
reg.get('#obg-title-0').value = 'Halbmarathon 1:50'; reg.get('#obg-title-1').value = 'Kraft erhalten';
reg.get('#obg-role-1').onclick(); // Rolle von Ziel 2 zyklisch ändern
ok('4i.1-4/7 Titel/Rolle erfasst + vorausgefüllt', OB._state.draft.draftData.goals[0].title === 'Halbmarathon 1:50');
// entfernen + Zurück/Weiter ohne Duplikate
let beforeDel = OB._state.draft.draftData.goals.length; reg.get('#obg-del-1').onclick();
ok('4i.1-5 Ziel entfernt', OB._state.draft.draftData.goals.length === beforeDel - 1);
reg.get('#ob2-next').onclick();
ok('4i.1-6/8 Weiter → Trainingsalltag, keine Duplikate', OB._state.draft.currentStep === 'schedule_placeholder' && (card().innerHTML || '').indexOf('Trainingsalltag') >= 0 && OB._state.draft.draftData.goals.length === 1);

// Trainingsalltag
reg.get('#obs-day-mo').classList.add('on'); reg.get('#obs-day-mi').classList.add('on'); reg.get('#obs-day-fr').classList.add('on');
OB._setSchedTime('evening'); reg.get('#obs-dur').value = '60'; reg.get('#obs-dur').onchange();
reg.get('#obs-maxS').value = '8'; reg.get('#obs-double').checked = true;
OB._state.lastNav = 0; reg.get('#ob2-next').onclick();
let av = OB._state.draft.draftData.availability;
ok('4i.1-9/10/11/14 Verfügbarkeit übernommen (Tage/Zeit/Dauer/maxEinheiten)', av.days.mo.available === true && av.days.mo.singleSession.preferredTime === 'evening' && av.days.mo.singleSession.maxMinutes === 60 && av.maxSessionsPerWeek === 8);
ok('4i.1-12/13 Ruhetage + Doppeleinheit-Grundsatz', av.days.di.available === false && av._doubleAllowed === true);

// Zusammenfassung
ok('4i.1-15 Zusammenfassung zeigt reale Werte', OB._state.draft.currentStep === 'review_placeholder' && (card().innerHTML || '').indexOf('Halbmarathon 1:50') >= 0 && (card().innerHTML || '').indexOf('Gian') >= 0 && (card().innerHTML || '').indexOf('verfügbare Tage') >= 0);
ok('4i.1-15b kein „Einrichtung vorgemerkt"/keine engl. Codes/kein <select>', (card().innerHTML || '').indexOf('Einrichtung vorgemerkt') < 0 && (card().innerHTML || '').indexOf('<select') < 0 && (card().innerHTML || '').indexOf('schedule_placeholder<') < 0);
// 16 Bearbeiten springt zurück
OB._editStep('goals_placeholder');
ok('4i.1-16 Bearbeiten springt zum Schritt', OB._state.draft.currentStep === 'goals_placeholder');
OB._state.draft.currentStep = 'review_placeholder'; OB.renderSummaryStep();

// Abschluss
reg.get('#ob2-finish').onclick();
await new Promise(r => setTimeout(r, 5));   // M4: Abschluss ist asynchron (Persistenz wird awaited)
let saved = JSON.parse(store['orvia_profile_v1']);
ok('4i.1-17 Abschluss schreibt zentral (goals/sports/availability/personal)', saved.goals.length === 1 && saved.goals[0].title === 'Halbmarathon 1:50' && saved.sports.some(s => s.sportId === 'running') && saved.availability.maxSessionsPerWeek === 8 && saved.name === 'Gian');
ok('4i.1-18 Onboarding-Status completed', saved.onboarding.status === 'completed' && !!saved.onboarding.completedAt);
ok('4i.1-22/23 keine Sport-/Zielduplikate', saved.sports.filter(s => s.sportId === 'running').length === 1 && M.normalizeGoals(saved.goals).length === 1);
ok('4i.1-19 Bestandsnutzer danach → kein Onboarding', M.isOnboardingComplete(saved) === true);

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
