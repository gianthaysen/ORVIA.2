/* ORVIA · profile-ui — DOM-Integrationstest (vm-Sandbox) für Ziel-Wizard, Profilbereiche,
   Meilensteine, Unsaved-Schutz. Lädt profile-model.js + profile.js in eine gemeinsame Sandbox
   mit DOM-/localStorage-Stubs und ruft die echten UI-Funktionen auf (kein Mock der Speicherpfade). */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

// ---- DOM-/Umgebungs-Stubs ----
const store = {};
function mkEl(extra) {
  const el = { value: '', checked: false, textContent: '', dataset: {}, _html: '', _kids: [],
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c);}, contains(c){return this._s.has(c);} },
    querySelectorAll() { return []; }, addEventListener() {}, remove() {}, appendChild() {} };
  Object.defineProperty(el, 'innerHTML', { get() { return this._html; }, set(v) { this._html = v; } });
  return Object.assign(el, extra || {});
}
const els = {};
function clearEls() { for (const k in els) delete els[k]; }
const sandbox = {};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.console = console;
sandbox.Date = Date; sandbox.Math = Math; sandbox.JSON = JSON; sandbox.parseInt = parseInt; sandbox.parseFloat = parseFloat;
sandbox.isNaN = isNaN; sandbox.Array = Array; sandbox.Object = Object; sandbox.String = String; sandbox.Set = Set;
sandbox.escH = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
sandbox.toast = () => {};
sandbox.renderProfileScreen = () => {};
sandbox.renderZones = () => {};
sandbox.localStorage = { _d: store, getItem(k){ return store[k] || null; }, setItem(k, v){ store[k] = v; } };
sandbox.document = {
  getElementById: (id) => els[id] || null,
  createElement: () => mkEl(),
  body: { appendChild() {} },
  querySelectorAll: () => []
};
sandbox.module = undefined;
vm.createContext(sandbox);
const base = new URL('../../js/', import.meta.url);
vm.runInContext(readFileSync(new URL('profile-model.js', base), 'utf8'), sandbox, { filename: 'profile-model.js' });
vm.runInContext(readFileSync(new URL('profile.js', base), 'utf8'), sandbox, { filename: 'profile.js' });

ok('UI-Setup: profileModel + profile.js geladen', !!sandbox.ORVIA && !!sandbox.ORVIA.profileModel && typeof sandbox.openGoalEditor === 'function');

// Frisches Profil (v2, leere Ziele)
sandbox.PROFILE = sandbox.ORVIA.profileModel.migrateProfile({ version: 1, onboarded: true, name: 'Gian', weightKg: 75 });
sandbox.PROFILE.goals = [];

// ---- Ziel-Wizard: Shredded vollständig über die Save-Pipeline ----
sandbox.openGoalEditor();
ok('19-1 Wizard öffnet (Schritt 0, Entwurf vorhanden)', sandbox._gw && sandbox._gw.step === 0 && sandbox._gw.draft.category === 'custom');
// Schritt 1 (type): Felder seeden + gwNext (validiert Titel)
els.gw_cat = mkEl({ value: 'shredded' }); els.gw_title = mkEl({ value: '' }); els.gw_desc = mkEl({ value: '' }); els.gw_err = mkEl();
sandbox.gwNext();
ok('19-3 Weiter blockt ohne Titel (Pflichtfeld)', sandbox._gw.step === 0 && els.gw_err.textContent.length > 0);
els.gw_title.value = 'Sehr definiert werden';
sandbox.gwNext();
ok('Weiter mit Titel → Schritt 1; Kategorie im Entwurf', sandbox._gw.step === 1 && sandbox._gw.draft.category === 'shredded' && sandbox._gw.draft.title === 'Sehr definiert werden');
// Schritt 2 (details): Spezialfelder seeden
delete els.gw_cat; delete els.gw_title;
els['gwf_currentWeight'] = mkEl({ value: '78' }); els['gwf_targetBodyFat'] = mkEl({ value: '12' });
els['gwf_maintainMuscle'] = mkEl({ checked: true }); els['gwf_keepPerformance'] = mkEl({ checked: true });
sandbox.gwNext();
ok('19-8 Shredded-Spezialfelder im Entwurf (categoryData)', sandbox._gw.draft.categoryData.currentWeight === 78 && sandbox._gw.draft.categoryData.targetBodyFat === 12 && sandbox._gw.draft.categoryData.maintainMuscle === true);
// restliche Schritte ohne weitere Eingaben durchlaufen bis Summary
while (sandbox._gw.step < 6) sandbox.gwNext();
ok('19-42 Wizard erreicht Zusammenfassung', sandbox._gw.step === 6);
sandbox.gwSave();
let g = sandbox.PROFILE.goals[0];
ok('19-8 Shredded gespeichert (categoryData persistiert)', sandbox.PROFILE.goals.length === 1 && g.category === 'shredded' && g.categoryData.currentWeight === 78 && g.categoryData.targetBodyFat === 12);
ok('Persistenz: in localStorage geschrieben', !!store['orvia_profile_v1'] && JSON.parse(store['orvia_profile_v1']).goals.length === 1);

// ---- Ziel ohne Datum + Ironman parallel ----
sandbox.openGoalEditor();
els.gw_cat = mkEl({ value: 'ironman' }); els.gw_title = mkEl({ value: 'Ironman 2028' }); els.gw_desc = mkEl({ value: '' }); els.gw_err = mkEl();
sandbox.gwNext(); // type→details
while (sandbox._gw.step < 6) sandbox.gwNext();
sandbox.gwSave();
ok('19-9/10 Ironman ohne Datum parallel zu Shredded', sandbox.PROFILE.goals.length === 2 && sandbox.PROFILE.goals.some(x => x.category === 'ironman' && x.targetDate === null) && sandbox.PROFILE.goals.some(x => x.category === 'shredded'));

// ---- Bearbeiten füllt vor + Unsaved-Schutz ----
let sid = sandbox.PROFILE.goals.find(x => x.category === 'shredded').id;
clearEls();
sandbox.openGoalEditor(sid);
ok('19-5 Bearbeiten füllt Entwurf vor', sandbox._gw.draft.title === 'Sehr definiert werden' && sandbox._gw.draft.categoryData.currentWeight === 78);
// Unverändert → cancel schließt direkt (kein Discard-Modal). Keine Stub-Inputs → _gwCollect liest null.
sandbox._gwDiscard = null;
sandbox.gwCancel();
ok('19-7/43 Unverändert schließt direkt (kein Discard, Werte erhalten)', !sandbox._gwDiscard && sandbox.PROFILE.goals.find(x => x.id === sid).categoryData.currentWeight === 78);
// Geändert → Discard-Dialog erscheint
sandbox.openGoalEditor(sid);
sandbox._gw.draft.title = 'Geändert';
sandbox.gwCancel();
ok('19-6 Ungespeicherte Änderung → Discard-Dialog', !!sandbox._gwDiscard);
sandbox._closeM('_gwDiscard'); sandbox._closeM('_goalEd');

// ---- Meilensteine im Wizard ----
clearEls();
sandbox.openGoalEditor(sid);
els.gw_ms_title = mkEl({ value: '1500 m am Stück schwimmen' });
els.gwMs = mkEl();
sandbox.gwAddMs();
ok('19-19 Meilenstein im Wizard hinzugefügt', sandbox._gw.draft.milestones.length === 1 && sandbox._gw.draft.milestones[0].title.indexOf('1500') >= 0);
sandbox.gwSave && (function(){ while (sandbox._gw.step < 6) sandbox.gwNext(); sandbox.gwSave(); })();
ok('19-11 Meilenstein persistiert', sandbox.PROFILE.goals.find(x => x.id === sid).milestones.length === 1);

// ---- Detailansicht: keine technischen IDs ----
clearEls();
sandbox._goalDet = null;
sandbox.openGoalDetail(sid);
let detHTML = sandbox._goalDet && sandbox._goalDet._html;
ok('18 Detailansicht zeigt Spezialdaten', detHTML && detHTML.indexOf('Spezialdaten') >= 0 && detHTML.indexOf('78') >= 0);
// "Keine technischen IDs sichtbar" = nicht als sichtbarer Text; in onclick-Handlern unvermeidbar → diese ausblenden.
let visibleText = (detHTML || '').replace(/onclick="[^"]*"/g, '');
ok('39 Keine technischen IDs als sichtbarer Text', visibleText.indexOf(sid) < 0);
sandbox._closeM('_goalDet');

// ---- Profilbereich: Persönliche Grunddaten bearbeiten ----
clearEls();
sandbox.openProfileSection('personal');
els['gwf_name'] = mkEl({ value: 'Gian Thaysen' }); els['gwf_location'] = mkEl({ value: 'Flensburg' });
els['gwf_birthDate'] = mkEl({ value: '2003-12-22' }); els['gwf_sex'] = mkEl({ value: 'm' });
sandbox.saveProfileSection();
ok('24 Persönliche Grunddaten gespeichert', sandbox.PROFILE.name === 'Gian Thaysen' && sandbox.PROFILE.location === 'Flensburg');

// ---- Beschwerde hinzufügen + behoben markieren ----
sandbox.openConstraintEditor();
els.c_region = mkEl({ value: 'knee_left' }); els.c_title = mkEl({ value: 'Patellasehne' }); els.c_int = mkEl({ value: '4' });
els.c_trig = mkEl({ value: 'Bergablauf' }); els.c_since = mkEl({ value: 'Juni 2026' }); els.c_adapt = mkEl({ value: 'kein Laufen' });
els.c_med = mkEl({ checked: false }); els.c_train = mkEl({ checked: true }); els.c_status = mkEl({ value: 'active' });
sandbox.saveConstraint('');
ok('27 Beschwerde hinzugefügt + in issues gespiegelt', sandbox.PROFILE.constraintsList.length === 1 && sandbox.PROFILE.issues.indexOf('knee_left') >= 0);
let cid = sandbox.PROFILE.constraintsList[0].id;
sandbox.constraintStatus(cid, 'resolved');
ok('29 Beschwerde behoben (aus issues entfernt)', sandbox.PROFILE.constraintsList[0].status === 'resolved' && sandbox.PROFILE.issues.indexOf('knee_left') < 0);
sandbox.constraintStatus(cid, 'active');
ok('30 Beschwerde reaktiviert', sandbox.PROFILE.constraintsList[0].status === 'active' && sandbox.PROFILE.issues.indexOf('knee_left') >= 0);

// ---- Verfügbarkeit bearbeiten ----
sandbox.openProfileSection('availability');
sandbox.ORVIA.profileModel.WEEKDAYS.forEach(d => { ['av','team','match','dbl','int','rest'].forEach(s => els['av_' + d + '_' + s] = mkEl({ checked: s === 'av' || s === 'int' })); els['av_' + d + '_min'] = mkEl({ value: '' }); els['av_' + d + '_tod'] = mkEl({ value: '' }); });
els.av_maxS = mkEl({ value: '8' }); els.av_maxI = mkEl({ value: '3' }); els.av_rest = mkEl({ value: '2' }); els.av_travel = mkEl({ value: '' }); els.av_alt = mkEl({ checked: false });
sandbox.saveAvailabilityEditor();
ok('26 Verfügbarkeit gespeichert (Wochenlimit)', sandbox.PROFILE.availability.maxSessions === 8 && sandbox.PROFILE.availability.maxIntense === 3);

// ---- Plan-Impact-Bündelung (mehrere Änderungen, ein Eintrag) ----
ok('40/41 Plan-Impact gebündelt + Plan nicht gelöscht', sandbox.PROFILE.planImpact && sandbox.PROFILE.planImpact.fields.indexOf('constraints') >= 0 && sandbox.PROFILE.planImpact.fields.indexOf('availability') >= 0 && !('weekPlan' in sandbox.PROFILE && sandbox.PROFILE.weekPlan === null));

// ---- Werte nach „App-Neustart": Profil aus localStorage rekonstruierbar ----
let reloaded = JSON.parse(store['orvia_profile_v1']);
ok('34 Werte nach Neustart erhalten (goals+constraints+availability)', reloaded.goals.length >= 2 && reloaded.constraintsList.length === 1 && reloaded.availability.maxSessions === 8 && reloaded.name === 'Gian Thaysen');

// ---- Legacy-Projektion nach allen Änderungen weiter korrekt ----
ok('36/37 Legacy-Projektion: primaryGoal aus aktivem Ziel', !!sandbox.PROFILE.primaryGoal && !!sandbox.PROFILE.primaryGoalLabel);

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
