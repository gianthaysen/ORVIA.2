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
// Stub für ORVIA-Segment-Control: Wert liegt in dataset.val (ersetzt natives <select>)
function mkSeg(val) { return mkEl({ dataset: { val: val } }); }
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
// Event-/CustomEvent-Stubs für den zentralen Profil-Adapter (orvia:profile-updated)
const winListeners = {};
sandbox.CustomEvent = function (type, init) { this.type = type; this.detail = (init && init.detail) || null; };
sandbox.addEventListener = (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); };
sandbox.removeEventListener = (t, fn) => { winListeners[t] = (winListeners[t] || []).filter(f => f !== fn); };
sandbox.dispatchEvent = (ev) => { (winListeners[ev.type] || []).forEach(fn => fn(ev)); return true; };
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
els.gw_cat = mkSeg('shredded'); els.gw_title = mkEl({ value: '' }); els.gw_desc = mkEl({ value: '' }); els.gw_err = mkEl();
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
els.gw_cat = mkSeg('ironman'); els.gw_title = mkEl({ value: 'Ironman 2028' }); els.gw_desc = mkEl({ value: '' }); els.gw_err = mkEl();
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
els['gwf_birthDate'] = mkEl({ value: '2003-12-22' }); els['gwf_sex'] = mkSeg('m');
sandbox.saveProfileSection();
ok('24 Persönliche Grunddaten gespeichert', sandbox.PROFILE.name === 'Gian Thaysen' && sandbox.PROFILE.location === 'Flensburg');

// ---- Beschwerde hinzufügen + behoben markieren ----
sandbox.openConstraintEditor();
els.c_region = mkSeg('knee'); els.c_side = mkSeg('left'); els.c_int = mkEl({ value: '4' });
els.c_trig = mkEl({ value: 'Bergablauf' }); els.c_since = mkEl({ value: 'Juni 2026' }); els.c_avoid = mkEl({ value: 'tiefe Kniebeuge' });
els.c_train = mkEl({ checked: true }); els.c_adapt = mkEl({ value: 'kein Laufen' }); els.c_status = mkSeg('active');
sandbox.saveConstraint('');
ok('27 Beschwerde hinzugefügt + in issues gespiegelt', sandbox.PROFILE.constraintsList.length === 1 && sandbox.PROFILE.issues.indexOf('knee') >= 0);
let cid = sandbox.PROFILE.constraintsList[0].id;
sandbox.constraintStatus(cid, 'resolved');
ok('29 Beschwerde behoben (aus issues entfernt)', sandbox.PROFILE.constraintsList[0].status === 'resolved' && sandbox.PROFILE.issues.indexOf('knee') < 0);
sandbox.constraintStatus(cid, 'active');
ok('30 Beschwerde reaktiviert', sandbox.PROFILE.constraintsList[0].status === 'active' && sandbox.PROFILE.issues.indexOf('knee') >= 0);

// ---- Verfügbarkeit bearbeiten (4e.1: days-Struktur, Wochenlimits) ----
clearEls(); els.avBody = mkEl();
sandbox.openProfileSection('availability');
els.av_maxS = mkEl({ value: '8' }); els.av_maxI = mkEl({ value: '3' }); els.av_minRest = mkEl({ value: '1' }); els.av_prefRest = mkEl();
sandbox.saveAvailabilityEditor();
ok('26 Verfügbarkeit gespeichert (Wochenlimit)', sandbox.PROFILE.availability.maxSessionsPerWeek === 8 && sandbox.PROFILE.availability.maxIntenseSessions === 3);

// ---- Plan-Impact-Bündelung (mehrere Änderungen, ein Eintrag) ----
ok('40/41 Plan-Impact gebündelt + Plan nicht gelöscht', sandbox.PROFILE.planImpact && sandbox.PROFILE.planImpact.fields.indexOf('constraints') >= 0 && sandbox.PROFILE.planImpact.fields.indexOf('availability') >= 0 && !('weekPlan' in sandbox.PROFILE && sandbox.PROFILE.weekPlan === null));

// ---- Werte nach „App-Neustart": Profil aus localStorage rekonstruierbar ----
let reloaded = JSON.parse(store['orvia_profile_v1']);
ok('34 Werte nach Neustart erhalten (goals+constraints+availability)', reloaded.goals.length >= 2 && reloaded.constraintsList.length === 1 && reloaded.availability.maxSessionsPerWeek === 8 && reloaded.name === 'Gian Thaysen');

// ---- Legacy-Projektion nach allen Änderungen weiter korrekt ----
ok('36/37 Legacy-Projektion: primaryGoal aus aktivem Ziel', !!sandbox.PROFILE.primaryGoal && !!sandbox.PROFILE.primaryGoalLabel);

/* ===== Inkrement 4a: keine nativen Selects + deutsche Werte (Lokalisierung) ===== */
clearEls();
els.gwBody = mkEl();   // Wizard rendert in #gwBody
sandbox.openGoalEditor();
let wizHTML = els.gwBody._html;
ok('4a Wizard nutzt ORVIA-Segment-Control statt <select>', wizHTML && wizHTML.indexOf('<select') < 0 && wizHTML.indexOf('seg-ctl') >= 0);
sandbox._closeM('_goalEd');

clearEls();
sandbox.openProfileSection('personal');
let persHTML = sandbox._secEdM && sandbox._secEdM._html;
ok('4a Persönliche Grunddaten: kein <select>', persHTML && persHTML.indexOf('<select') < 0);
ok('4a Geschlecht deutsch (Männlich/Weiblich/Divers, keine Codes m/w/d als Label)', persHTML && persHTML.indexOf('Männlich') >= 0 && persHTML.indexOf('Weiblich') >= 0 && /data-v="m"/.test(persHTML));
sandbox._closeM('_secEdM');

clearEls();
sandbox.openConstraintEditor();
let cstrHTML = sandbox._cstrEd && sandbox._cstrEd._html;
ok('4a Beschwerde-Status deutsch + Segment-Control (kein <select>)', cstrHTML && cstrHTML.indexOf('<select') < 0 && cstrHTML.indexOf('aktiv') >= 0 && cstrHTML.indexOf('behoben') >= 0);
sandbox._closeM('_cstrEd');

clearEls(); els.avBody = mkEl();
sandbox.openAvailabilityEditor();
sandbox.avToggleOpen('mo');
let avHTML = els.avBody._html;
ok('4a Verfügbarkeit: Tageszeit als Segment-Control, kein <select>', avHTML && avHTML.indexOf('<select') < 0 && avHTML.indexOf('Morgens') >= 0 && avHTML.indexOf('Abends') >= 0);
sandbox._closeM('_secEdM');

// Zentrale Label-Map vorhanden + korrekt
let LB = sandbox.ORVIA.profileModel;
ok('4a PROFILE_LABELS zentral (gender/timeOfDay/constraintStatus)', LB.labelOf('gender', 'm') === 'Männlich' && LB.labelOf('timeOfDay', 'evening') === 'Abends' && LB.labelOf('constraintStatus', 'resolved') === 'behoben');

/* ===== Inkrement 4b: zentraler Profil-Adapter ORVIA.profile ===== */
ok('4b Adapter ORVIA.profile vorhanden (API komplett)', !!sandbox.ORVIA.profile && ['load','save','get','updateSection','subscribe','migrate','buildLegacyProjection','getFieldUsage','buildSummary','activeSports','planSports','activeConstraints'].every(k => typeof sandbox.ORVIA.profile[k] === 'function'));

// Profil mit Sportflags + Konsolidierung
sandbox.PROFILE = sandbox.ORVIA.profileModel.consolidateProfile({ v: 1, onboarded: true, name: 'Gian', primaryGoal: 'halfmarathon', primaryGoalLabel: 'HM < 1:50', sports: [{ sportId: 'running', activeInApp: true, includeInPlan: true }, { sportId: 'padel', activeInApp: false }], constraintsList: [{ id: 'c1', bodyRegion: 'knee_left', status: 'active' }], issues: ['shoulder'] });

ok('4b activeSports() liefert nur aktive', sandbox.ORVIA.profile.activeSports().some(s => s.sportId === 'running') && !sandbox.ORVIA.profile.activeSports().some(s => s.sportId === 'padel'));
ok('4b planSports() liefert nur includeInPlan', sandbox.ORVIA.profile.planSports().some(s => s.sportId === 'running'));
ok('4b activeConstraints() vereint Profil + Startseiten-issues', (function () { var a = sandbox.ORVIA.profile.activeConstraints(); return a.some(c => c.bodyRegion === 'knee_left') && a.some(c => c.bodyRegion === 'shoulder'); })());
ok('4b buildSummary() aus zentraler Quelle (keine IDs/Codes)', (function () { var s = sandbox.ORVIA.profile.buildSummary(); return s.primaryGoal === 'HM < 1:50' && s.activeSports.indexOf('running') >= 0; })());
ok('4b getFieldUsage() spiegelt Matrix', sandbox.ORVIA.profile.getFieldUsage('constraints').status === 'active');

// Event genau einmal + ohne sensitive Werte
let evCount = 0, evDetail = null;
let unsub = sandbox.ORVIA.profile.subscribe(ev => { evCount++; evDetail = ev.detail; });
sandbox.ORVIA.profile.updateSection('preferences', { trainingPrefs: { intensity: 'Eher locker' } }, ['preferences']);
ok('4b-28 orvia:profile-updated genau einmal ausgelöst', evCount === 1);
ok('4b-29 Event enthält changedSections + updatedAt, keine sensitiven Werte', evDetail && evDetail.changedSections.indexOf('preferences') >= 0 && !!evDetail.updatedAt && !('name' in evDetail) && !('weightKg' in evDetail));
unsub(); sandbox.ORVIA.profile.updateSection('preferences', {}, ['preferences']);
ok('4b unsubscribe stoppt Benachrichtigung', evCount === 1);

// Gemeinsame Beschwerdenquelle: Profil-Änderung projiziert in issues[] (Startseiten-Leser)
sandbox.PROFILE.constraintsList.push(sandbox.ORVIA.profileModel.normalizeConstraint({ bodyRegion: 'achilles', status: 'active' }));
sandbox.ORVIA.profile.save(['constraints']);
ok('4b-21 Profiländerung aktualisiert issues[]-Projektion (Startseitenquelle)', sandbox.PROFILE.issues.indexOf('achilles') >= 0 && sandbox.PROFILE.issues.indexOf('knee_left') >= 0);
ok('4b Legacy-issues bleiben kompatibel (shoulder weiter aktiv via Vereinigung)', sandbox.ORVIA.profile.activeConstraints().some(c => c.bodyRegion === 'shoulder'));

/* ===== Inkrement 4c: sportartspezifischer Profil-Editor (echte Save-Pipeline) ===== */
clearEls();
sandbox.PROFILE = sandbox.ORVIA.profileModel.consolidateProfile({ v: 1, onboarded: true, name: 'Gian', sports: [{ sportId: 'football', activeInApp: true, role: 'primary' }] });
els.sppBody = mkEl();
sandbox.openSportProfileEditor('football');
let sppHTML = els.sppBody._html;
ok('4c Sportprofil-Editor öffnet (Fußball, Positionen gerendert)', !!sandbox._sppEd && sppHTML.indexOf('Hauptposition') >= 0 && sppHTML.indexOf('Innenverteidiger') >= 0);
ok('4c-39 Editor ohne natives <select>', sppHTML.indexOf('<select') < 0 && sppHTML.indexOf('seg-ctl') >= 0);
ok('4c-38 deutsche Werte (keine Codes wie centre_back sichtbar als Label)', sppHTML.indexOf('Innenverteidiger') >= 0 && sppHTML.indexOf('>centre_back<') < 0);
// Eingaben seeden: Rolle/Niveau/Position + Spielrolle + Belastung + Leistungsziele
els.spp_sportrole = mkSeg('primary'); els.spp_level = mkSeg('amateur');
els.spp_pos = mkSeg('centre_back');
sandbox.sppPosChange(); // rendert Rollencontainer für IV neu
els.spp_role = mkSeg('ball_playing_cb');
els.spp_team = mkEl({ value: '2' }); els.spp_min = mkEl({ value: '90' }); els.spp_extra = mkEl({ value: '' });
els.spp_matchday = mkSeg('sunday'); els.spp_lineup = mkSeg('starter'); els.spp_season = mkSeg('inseason');
els.spp_secpos = mkEl(); els.spp_secpos.querySelectorAll = (s) => [{ dataset: { v: 'full_back' }, classList: { contains: () => true } }];
// Leistungsziele-Chips (Antritt, Maximalkraft, Sprungkraft) als "on"
els.spp_perf = mkEl(); els.spp_perf.querySelectorAll = (s) => ['acceleration', 'maxStrength', 'jumpAbility'].map(k => ({ dataset: { v: k } }));
sandbox.saveSportProfileEditor();
let fbSport = sandbox.ORVIA.profileModel.normalizeSports(sandbox.PROFILE.sports).find(s => s.sportId === 'football');
ok('4c-2/3 Hauptposition + sekundäre Position persistiert', fbSport.sportProfile.primaryPosition === 'centre_back' && fbSport.sportProfile.secondaryPositions.indexOf('full_back') >= 0);
ok('4c Spielrolle persistiert', fbSport.sportProfile.playingRole === 'ball_playing_cb');
ok('4c-13/14/15/16 Belastung persistiert (Team/Spieltag/Minuten/Saison)', fbSport.sportProfile.teamSessionsPerWeek === 2 && fbSport.sportProfile.matchDay === 'sunday' && fbSport.sportProfile.typicalMatchMinutes === 90 && fbSport.sportProfile.seasonPhase === 'inseason');
ok('4c-11 Leistungsziele persistiert (3 Prioritäten)', fbSport.sportProfile.performancePriorities.length === 3 && fbSport.sportProfile.performancePriorities.some(p => p.key === 'acceleration'));

// App-Neustart: Sportprofil bleibt erhalten
let reSport = JSON.parse(store['orvia_profile_v1']).sports.find(s => s.sportId === 'football');
ok('4c-41 Sportprofil nach Neustart erhalten', reSport.sportProfile.primaryPosition === 'centre_back' && reSport.sportProfile.playingRole === 'ball_playing_cb');

// Sportarten-Manager zeigt Position/Rolle (42)
clearEls();
sandbox.openSportsManager();
let mgrHTML = sandbox._sportMgr && sandbox._sportMgr._html;
ok('4c-42 Sportarten-Manager zeigt Position + Rolle', mgrHTML && mgrHTML.indexOf('Innenverteidiger') >= 0 && mgrHTML.indexOf('Ballspielender Innenverteidiger') >= 0 && mgrHTML.indexOf('Spiel So') >= 0);
sandbox._closeM('_sportMgr');

/* ===== Inkrement 4d: Trainingsstart-/Aktivitäts-Sport-API ===== */
sandbox.PROFILE = sandbox.ORVIA.profileModel.consolidateProfile({ v: 1, onboarded: true, name: 'Gian', sports: [{ sportId: 'gym', activeInApp: true, role: 'secondary' }, { sportId: 'football', activeInApp: true, role: 'primary' }, { sportId: 'basketball', activeInApp: false, role: 'supplemental' }, { sportId: 'running', activeInApp: true, includeInPlan: true, role: 'supplemental' }] });
ok('4d-1 activeSports() nur aktive (Basketball fehlt)', sandbox.ORVIA.profile.activeSports().some(s => s.sportId === 'football') && !sandbox.ORVIA.profile.activeSports().some(s => s.sportId === 'basketball'));
ok('4d-2 planSports() nur includeInPlan', sandbox.ORVIA.profile.planSports().length === 1 && sandbox.ORVIA.profile.planSports()[0].sportId === 'running');
ok('4d-9 trainingStartSports() Hauptsportart zuerst', sandbox.ORVIA.profile.trainingStartSports()[0].sportId === 'football');
ok('4d manualActivitySports() = trainingStartSports()', sandbox.ORVIA.profile.manualActivitySports()[0].sportId === 'football');
ok('4d sportById() findet Sport', sandbox.ORVIA.profile.sportById('gym') && sandbox.ORVIA.profile.sportById('gym').sportId === 'gym');
ok('4d-3 deaktivierte Sportart nicht in trainingStartSports', !sandbox.ORVIA.profile.trainingStartSports().some(s => s.sportId === 'basketball'));

// Profil-Event bei Sportänderung (Consumer-Refresh-Signal)
let sportEv = 0; let un4d = sandbox.ORVIA.profile.subscribe(ev => { if (ev.detail.changedSections.indexOf('sports') >= 0) sportEv++; });
sandbox.ORVIA.profile.updateSection('sports', { sports: sandbox.ORVIA.profileModel.normalizeSports(sandbox.PROFILE.sports.concat([{ sportId: 'padel', activeInApp: true }])) }, ['sports']);
ok('4d-11 Sportänderung löst profile-updated(sports) aus', sportEv === 1 && sandbox.ORVIA.profile.activeSports().some(s => s.sportId === 'padel'));
un4d();

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
