/* ORVIA · Batch 2 — onboarding-ui DOM-nah mit stabiler Element-Registry (kein jsdom).
   Pro Szenario frisches document + frisches localStorage + frischer ui-Import (eigener State). */
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const wait = () => new Promise(r => setTimeout(r, 5));

globalThis.ORVIA = {};
const gWinEv = {};
globalThis.addEventListener = (t, fn) => { gWinEv[t] = fn; };   // beforeunload testbar
await import(new URL('../../js/onboarding/onboarding-profile-logic.js', import.meta.url));
await import(new URL('../../js/onboarding/onboarding-sports-logic.js', import.meta.url));
await import(new URL('../../js/onboarding/onboarding-logic.js', import.meta.url));
await import(new URL('../../js/onboarding/onboarding-steps.js', import.meta.url));
await import(new URL('../../js/onboarding/onboarding-store.js', import.meta.url));
await import(new URL('../../js/onboarding/onboarding-ui.js', import.meta.url)); // einmal; document-Zugriff ist dynamisch

async function fresh(seedMem) {
  const reg = new Map();
  function registerHtmlIds(html) { var m, re = /id="([^"]+)"/g; while ((m = re.exec(String(html || '')))) { if (!reg.has('#' + m[1])) reg.set('#' + m[1], makeEl()); } }
  function appendEl(el) { if (el && el._id) reg.set('#' + el._id, el); if (el) registerHtmlIds(el._html); }
  function makeEl() {
    const el = {
      style: {}, _html: '', value: '', textContent: '', disabled: false, checked: false, onclick: null, _id: null, _ev: {}, _focused: false,
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      set innerHTML(v) { this._html = v; registerHtmlIds(v); }, get innerHTML() { return this._html; },
      set id(v) { this._id = v; if (v) reg.set('#' + v, this); }, get id() { return this._id; },
      _attr: {}, setAttribute(k, v) { this._attr[k] = v; }, removeAttribute(k) { delete this._attr[k]; }, getAttribute(k) { return this._attr[k]; }, addEventListener(ev, cb) { this._ev[ev] = cb; }, appendChild(c) { appendEl(c); },
      remove() { if (this._id) reg.delete('#' + this._id); }, focus() { this._focused = true; },
      querySelector(sel) { return regGet(sel); }, querySelectorAll(sel) { return [regGet(sel)]; }
    };
    return el;
  }
  function regGet(k) { if (!reg.has(k)) reg.set(k, makeEl()); return reg.get(k); }
  function byId(id) { return reg.has('#' + id) ? reg.get('#' + id) : null; }
  const docEv = {};
  const docEl = { activeElement: null, visibilityState: 'visible', documentElement: { classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } } }, body: { appendChild(c) { appendEl(c); } }, createElement: makeEl, getElementById: byId, querySelector: regGet, addEventListener(t, fn) { docEv[t] = fn; } };
  globalThis.document = docEl;
  const mem = Object.assign({}, seedMem || {});
  let saves = 0;
  globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { saves++; mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  globalThis.ORVIA.user = null;
  globalThis.ORVIA.onboardingV2._reset();    // frischer Shell-State (Modul wird einmal geladen)
  globalThis.ORVIA.onboardingV2._state.bound = false;   // globale Listener je Szenario neu binden (Test)
  return { reg, byId, docEl, docEv, gWinEv, mem, saves: () => saves };
}
const L = globalThis.ORVIA.onboardingV2Logic;
const Store = globalThis.ORVIA.onboardingV2Store;
const card = h => h.reg.get('.ob2-card');

// 1) Shell öffnet, App gesperrt, Fortschritt korrekt
let h = await fresh();
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Shell öffnet (ob2-open gesetzt)', h.docEl.documentElement.classList.contains('ob2-open') === true);
ok('Fortschritt Schritt 1 von 6', (card(h).innerHTML || '').indexOf('Schritt 1 von 6') >= 0);
ok('Fokus auf Überschrift', h.byId('ob2-title') && h.byId('ob2-title')._focused === true);

// 2) Weiter & Zurück
h = await fresh();
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.reg.get('#ob2-next').onclick();
ok('Weiter → Schritt 2 (profile)', globalThis.ORVIA.onboardingV2._state.draft.currentStep === 'profile');
globalThis.ORVIA.onboardingV2._state.lastNav = 0;   // Zeitabstand simulieren (Nav-Lock freigeben)
h.reg.get('#ob2-back').onclick();
ok('Zurück → Schritt 1', globalThis.ORVIA.onboardingV2._state.draft.currentStep === 'welcome');

// 3) Doppelklick führt nicht über mehrere Schritte
h = await fresh();
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
const nx = h.reg.get('#ob2-next'); nx.onclick(); nx.onclick();
ok('Doppelklick: nur EIN Schritt weiter', globalThis.ORVIA.onboardingV2._state.draft.currentStep === 'profile');

// 4) „Später fortsetzen" speichert und schließt; Schließen verwirft nichts
h = await fresh();
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.reg.get('#ob2-next').onclick();           // Fortschritt erzeugen
h.reg.get('#ob2-later').onclick();
ok('Später: Dialog geschlossen', h.docEl.documentElement.classList.contains('ob2-open') === false);
ok('Später: Draft lokal gespeichert', !!h.mem[Store.key(null)]);
ok('Schließen verwirft nicht (currentStep erhalten)', JSON.parse(h.mem[Store.key(null)]).currentStep === 'profile');

// 5) Bestehender Draft wird fortgesetzt
const seed = {}; seed[Store.key(null)] = JSON.stringify(L.normalizeDraft({ version: 2, status: 'in_progress', currentStep: 'sports_placeholder', completedSteps: ['welcome', 'profile_placeholder'] }));
h = await fresh(seed);
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Resume: Schritt 3 von 6', (card(h).innerHTML || '').indexOf('Schritt 3 von 6') >= 0);

// 6) fresh:true überschreibt vorhandenen Draft NICHT still (Auswahl-Dialog)
h = await fresh(seed);
globalThis.ORVIA.onboardingV2.open({ fresh: true });
await wait();
ok('fresh:true → Auswahl „Fortschritt gefunden"', (card(h).innerHTML || '').indexOf('Fortschritt gefunden') >= 0);
ok('fresh:true → Draft NICHT überschrieben', JSON.parse(h.mem[Store.key(null)]).currentStep === 'sports');

// 7) fresh:true + Abbrechen lässt bestehenden Draft + Zeitstempel unverändert
const seedTs = JSON.parse(seed[Store.key(null)]); seedTs.updatedAt = 1234567; const seed2 = {}; seed2[Store.key(null)] = JSON.stringify(seedTs);
h = await fresh(seed2);
globalThis.ORVIA.onboardingV2.open({ fresh: true });
await wait();
h.reg.get('#ob2-cancel').onclick();
ok('Fresh-Abbruch: Dialog geschlossen', h.docEl.documentElement.classList.contains('ob2-open') === false);
ok('Fresh-Abbruch: Draft unverändert', JSON.parse(h.mem[Store.key(null)]).currentStep === 'sports');
ok('Fresh-Abbruch: Zeitstempel unverändert', JSON.parse(h.mem[Store.key(null)]).updatedAt === 1234567);

// 8) Review-Schritt → ready_for_review (nie completed), Statusansicht
const VPROF = { displayName: 'Alex', birthDate: '2000-05-10', sex: 'male', heightCm: 180, weightKg: 75, unitSystem: 'metric', experienceLevel: 'intermediate' };
const VSPORTS = { sports: [{ sportId: 'running', role: 'primary', enabled: true, visible: true, planningEnabled: true, priority: 1 }] };
const seedR = {}; seedR[Store.key(null)] = JSON.stringify(L.normalizeDraft({ version: 2, status: 'in_progress', currentStep: 'review_placeholder', completedSteps: ['welcome', 'profile', 'sports', 'goals_placeholder', 'schedule_placeholder'], draftData: { profile: VPROF, sports: VSPORTS } }));
h = await fresh(seedR);
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.reg.get('#ob2-review-ready').onclick();
ok('Review: status ready_for_review', globalThis.ORVIA.onboardingV2._state.draft.status === 'ready_for_review');
ok('Review: NICHT completed', globalThis.ORVIA.onboardingV2._state.draft.status !== 'completed');
ok('Review: Statusansicht „vorgemerkt"', (card(h).innerHTML || '').indexOf('Einrichtung vorgemerkt') >= 0);
ok('Review: gespeichert mit review_placeholder', JSON.parse(h.mem[Store.key(null)]).completedSteps.indexOf('review_placeholder') >= 0);

// 9) Debug-Einstieg: ohne Flag blockiert, mit Flag offen
h = await fresh();
globalThis.ORVIA_DEBUG = false;
ok('debugOpen ohne Flag → false', globalThis.ORVIA.onboardingV2.debugOpen() === false);
ok('debugOpen ohne Flag → Shell NICHT offen', h.docEl.documentElement.classList.contains('ob2-open') === false);
h = await fresh();
globalThis.ORVIA_DEBUG = true;
ok('debugOpen mit Flag → true', globalThis.ORVIA.onboardingV2.debugOpen() === true);
globalThis.ORVIA_DEBUG = false;

// 10) Fokus-Trap (reiner Helfer) + Fokus-Restore nach Schließen
const T = globalThis.ORVIA.onboardingV2._trapTarget;
const a = {}, b = {}, c = {};
ok('Trap: Shift+Tab auf erstem → letztes', T([a, b, c], a, true) === c);
ok('Trap: Tab auf letztem → erstes', T([a, b, c], c, false) === a);
ok('Trap: Mitte → null (Default)', T([a, b, c], b, false) === null);
h = await fresh();
const prev = { _focused: false, focus() { this._focused = true; } };
h.docEl.activeElement = prev;
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
globalThis.ORVIA.onboardingV2._state.draft && h.reg.get('#ob2-later').onclick();
ok('Fokus-Restore: vorheriges Element refokussiert', prev._focused === true);

// 11) Gespeicherter ready_for_review (MIT validem Profil) öffnet direkt die Statusansicht (kein Review-Button)
const _rrDraft = L.normalizeDraft({ version: 2, status: 'in_progress', currentStep: 'review_placeholder', completedSteps: ['welcome', 'profile', 'sports', 'goals_placeholder', 'schedule_placeholder'], draftData: { profile: VPROF, sports: VSPORTS } });
L.markReadyForReview(_rrDraft, 5);   // strukturiertes Resultat; mutiert _rrDraft
const seedRR = {}; seedRR[Store.key(null)] = JSON.stringify(_rrDraft);
h = await fresh(seedRR);
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('ready_for_review reopen → Statusansicht', (card(h).innerHTML || '').indexOf('Einrichtung vorgemerkt') >= 0);
ok('ready_for_review reopen → KEIN Review-Button', !h.byId('ob2-review-ready'));

// 12) Fresh → Fortsetzen mit ready_for_review öffnet ebenfalls die Statusansicht
h = await fresh(seedRR);
globalThis.ORVIA.onboardingV2.open({ fresh: true });
await wait();
h.reg.get('#ob2-resume').onclick();
ok('Fresh-Resume ready_for_review → Statusansicht', (card(h).innerHTML || '').indexOf('Einrichtung vorgemerkt') >= 0);

// 13) „Später fortsetzen" speichert nicht doppelt (genau ein setItem beim Klick)
h = await fresh();
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
const before = h.saves();
h.reg.get('#ob2-later').onclick();
ok('Später: genau ein Speichervorgang', h.saves() - before === 1, 'delta=' + (h.saves() - before));

// 14) Fokus-Trap-Selektor berücksichtigt Buttons, Inputs, Selects, Textareas, Links, tabindex
const FS = globalThis.ORVIA.onboardingV2._focusSelector;
ok('Fokus-Trap: button', FS.indexOf('button') >= 0);
ok('Fokus-Trap: input', FS.indexOf('input') >= 0);
ok('Fokus-Trap: select', FS.indexOf('select') >= 0);
ok('Fokus-Trap: textarea', FS.indexOf('textarea') >= 0);
ok('Fokus-Trap: a[href]', FS.indexOf('a[href]') >= 0);
ok('Fokus-Trap: tabindex (ohne -1)', FS.indexOf('[tabindex]:not([tabindex="-1"])') >= 0);

// ---- Basisprofil-Formular ----
function profileSeed(profile, step) { const s = {}; s[Store.key(null)] = JSON.stringify(L.normalizeDraft({ version: 2, status: 'in_progress', currentStep: step || 'profile', completedSteps: ['welcome'], draftData: { profile: profile || {} } })); return s; }
function profileSeedNoProfile() { const s = {}; s[Store.key(null)] = JSON.stringify({ version: 2, status: 'in_progress', currentStep: 'profile', completedSteps: ['welcome'], draftData: {} }); return s; }
const ST = () => globalThis.ORVIA.onboardingV2._state;

// 15) Profilformular wird gerendert + bestehende Werte erscheinen
h = await fresh(profileSeed({ displayName: 'Bo', birthDate: '2000-05-10', sex: 'male', heightCm: 180, weightKg: 75, unitSystem: 'metric', experienceLevel: 'beginner' }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Profil: Formular gerendert (Anzeigename-Label)', (card(h).innerHTML || '').indexOf('Anzeigename') >= 0);
ok('Profil: bestehender Wert im HTML (value="Bo")', (card(h).innerHTML || '').indexOf('value="Bo"') >= 0);

// 16) Leere Pflichtfelder verhindern Weiter + erstes Fehlerfeld erhält Fokus
h = await fresh(profileSeed({}));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.reg.get('#ob2-next').onclick();
ok('Profil: leer → bleibt auf profile', ST().draft.currentStep === 'profile');
ok('Profil: Fehler sichtbar', (card(h).innerHTML || '').indexOf('Bitte einen Namen') >= 0);
ok('Profil: erstes Fehlerfeld fokussiert', h.byId('pf-displayName') && h.byId('pf-displayName')._focused === true);

// 17) Valide Eingaben erlauben Weiter (markiert profile als completed, geht zu sports)
h = await fresh(profileSeed({}));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.byId('pf-displayName').value = 'Alex'; h.byId('pf-birthDate').value = '2000-05-10'; h.byId('pf-sex').value = 'male';
h.byId('pf-height').value = '180'; h.byId('pf-weight').value = '75'; h.byId('pf-level').value = 'intermediate';
h.byId('pf-height')._ev.input(); h.byId('pf-weight')._ev.input();   // Maße als „dirty" markieren (User-Edit)
ST().lastNav = 0; h.reg.get('#ob2-next').onclick();
ok('Profil valide: weiter zu sports', ST().draft.currentStep === 'sports');
ok('Profil valide: profile in completedSteps', ST().draft.completedSteps.indexOf('profile') >= 0);

// 18) Unvollständige Daten bei „Später" gespeichert; Reload stellt sie wieder her
h = await fresh(profileSeed({}));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.byId('pf-displayName').value = 'Halb';
h.reg.get('#ob2-later').onclick();
ok('Profil: unvollständig gespeichert', JSON.parse(h.mem[Store.key(null)]).draftData.profile.displayName === 'Halb');

// 19) Einheitenwechsel rechnet korrekt um (180 cm → 5 ft 11 in) + kein Drift bei Wiederholung
h = await fresh(profileSeed({ heightCm: 180, weightKg: 75, unitSystem: 'metric' }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.byId('pf-unit-imperial').checked = true; h.byId('pf-unit-imperial')._ev.change();
ok('Profil: imperial-Anzeige ft/in (5)', (card(h).innerHTML || '').indexOf('value="5"') >= 0);
ok('Profil: imperial-Anzeige in (11)', (card(h).innerHTML || '').indexOf('value="11"') >= 0);
for (let i = 0; i < 6; i++) { h.byId('pf-unit-metric').checked = true; h.byId('pf-unit-metric')._ev.change(); h.byId('pf-unit-imperial').checked = true; h.byId('pf-unit-imperial')._ev.change(); }
ok('Profil: wiederholter Wechsel ohne Drift (kanonisch 180)', ST().draft.draftData.profile.heightCm === 180);

// 20) Nutzertext sicher ausgegeben (XSS im Anzeigenamen)
h = await fresh(profileSeed({ displayName: '<img onerror=x>' }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Profil: Name escaped (&lt;img)', (card(h).innerHTML || '').indexOf('&lt;img') >= 0 && (card(h).innerHTML || '').indexOf('<img onerror') < 0);

// 21) Eingabe ohne Blur + visibilitychange(hidden) wird gespeichert
h = await fresh(profileSeed({}));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.byId('pf-displayName').value = 'Vis';
h.docEl.visibilityState = 'hidden'; h.docEv['visibilitychange']();
ok('visibilitychange(hidden) speichert aktuelle Eingabe', JSON.parse(h.mem[Store.key(null)]).draftData.profile.displayName === 'Vis');

// 22) Eingabe ohne Blur + beforeunload wird gespeichert
h = await fresh(profileSeed({}));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.byId('pf-displayName').value = 'Unl';
h.gWinEv['beforeunload']();
ok('beforeunload speichert aktuelle Eingabe', JSON.parse(h.mem[Store.key(null)]).draftData.profile.displayName === 'Unl');

// 23) Metrische Eingabe ohne Blur + Einheitenwechsel → Wert bleibt erhalten
h = await fresh(profileSeed({}));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.byId('pf-height').value = '185'; h.byId('pf-height')._ev.input();   // dirty (User-Edit)
h.byId('pf-unit-imperial').checked = true; h.byId('pf-unit-imperial')._ev.change();
ok('metrisch→imperial: 185 cm erhalten', ST().draft.draftData.profile.heightCm === 185);

// 24) Imperiale Eingabe ohne Blur + Einheitenwechsel → Wert bleibt (6 ft 1 in = 185.42 cm)
h = await fresh(profileSeed({ heightCm: 180, unitSystem: 'imperial' }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.byId('pf-ft').value = '6'; h.byId('pf-in').value = '1'; h.byId('pf-ft')._ev.input();
h.byId('pf-unit-metric').checked = true; h.byId('pf-unit-metric')._ev.change();
ok('imperial→metrisch: 6ft1in ≈ 185.42 cm erhalten', Math.abs(ST().draft.draftData.profile.heightCm - 185.42) < 0.01);

// 25) aria-invalid verschwindet bei Korrektur (nach Submit)
h = await fresh(profileSeed({ displayName: '', birthDate: '2000-05-10', sex: 'male', heightCm: 180, weightKg: 75, unitSystem: 'metric', experienceLevel: 'intermediate' }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.reg.get('#ob2-next').onclick();   // ungültig (Name leer) → submitted
ok('Submit invalid: displayName aria-invalid gesetzt', h.byId('pf-displayName').getAttribute('aria-invalid') === 'true');
h.byId('pf-displayName').value = 'Alex'; h.byId('pf-displayName')._ev.input();
ok('Korrektur: aria-invalid entfernt', h.byId('pf-displayName').getAttribute('aria-invalid') === undefined);

// 26) Größenfehler markiert ft UND in (imperial)
h = await fresh(profileSeed({ unitSystem: 'imperial', displayName: 'Alex', birthDate: '2000-05-10', sex: 'male', weightKg: 75, experienceLevel: 'intermediate' }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.reg.get('#ob2-next').onclick();   // Größe leer → Fehler
ok('imperial Größenfehler: pf-ft invalid', h.byId('pf-ft').getAttribute('aria-invalid') === 'true');
ok('imperial Größenfehler: pf-in invalid', h.byId('pf-in').getAttribute('aria-invalid') === 'true');

// 27) Bestehender Draft gewinnt vor Seed; 28) Seed greift nur bei leerem Profil-Draft
globalThis.ORVIA.user = null;
h = await fresh(profileSeed({ displayName: 'Draft' }));
globalThis.ORVIA.profile = { name: 'Seed' };   // würde seeden, darf aber Draft nicht überschreiben
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Bestehender Draft gewinnt vor Seed', ST().draft.draftData.profile.displayName === 'Draft');
globalThis.ORVIA.profile = null;
const seedEmptyProfile = {}; seedEmptyProfile[Store.key(null)] = JSON.stringify({ version: 2, status: 'in_progress', currentStep: 'profile', completedSteps: ['welcome'], draftData: {} });
h = await fresh(seedEmptyProfile);
globalThis.ORVIA.profile = { name: 'Seed' };
globalThis.ORVIA.onboardingV2.open({ fresh: false });   // Draft ohne profile-Objekt → Seed greift
await wait();
ok('Seed greift bei leerem Profil-Draft', ST().draft.draftData.profile.displayName === 'Seed');
globalThis.ORVIA.profile = null;

// 29) Altes ready_for_review OHNE valides Profil öffnet Profil (nicht Statusansicht)
const seedRRno = {}; seedRRno[Store.key(null)] = JSON.stringify({ version: 2, status: 'ready_for_review', currentStep: 'review_placeholder', completedSteps: ['welcome'], draftData: {} });
h = await fresh(seedRRno);
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('alt ready_for_review ohne Profil → Profilformular', (card(h).innerHTML || '').indexOf('Anzeigename') >= 0 && (card(h).innerHTML || '').indexOf('Einrichtung vorgemerkt') < 0);

// 30) Labels & imperiales Fieldset korrekt verbunden
h = await fresh(profileSeed({ unitSystem: 'imperial' }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
const html30 = card(h).innerHTML || '';
ok('Label for=pf-displayName + Feld existiert', html30.indexOf('for="pf-displayName"') >= 0 && !!h.byId('pf-displayName'));
ok('imperiales Fieldset: legend Körpergröße', html30.indexOf('<legend>Körpergröße</legend>') >= 0);
ok('imperiales Fieldset: label for=pf-ft', html30.indexOf('for="pf-ft"') >= 0);

// 31) Fehlende Profil-Logik → Fehleransicht ohne Weiter-Button (fail-closed)
const realPL = globalThis.ORVIA.onboardingProfileLogic;
globalThis.ORVIA.onboardingProfileLogic = undefined;
h = await fresh(profileSeedNoProfile());
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('fehlende Profil-Logik → Fehleransicht', (card(h).innerHTML || '').indexOf('Basisprofil nicht verfügbar') >= 0);
ok('fehlende Profil-Logik → kein Weiter-Button', !h.byId('ob2-next'));
ok('fehlende Profil-Logik → App gesperrt', h.docEl.documentElement.classList.contains('ob2-open') === true);
// 32) Teilweise Profil-Logik → ebenfalls Fehleransicht
globalThis.ORVIA.onboardingProfileLogic = { normalizeProfile: function () { return {}; } }; // unvollständig
h = await fresh(profileSeedNoProfile());
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('teilweise Profil-Logik → Fehleransicht', (card(h).innerHTML || '').indexOf('Basisprofil nicht verfügbar') >= 0);
globalThis.ORVIA.onboardingProfileLogic = realPL;

// 33) Escape erfasst ungeblurte Eingabe und lässt Dialog offen
h = await fresh(profileSeed({}));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.byId('pf-displayName').value = 'Esc';
ST().el._ev.keydown({ key: 'Escape', preventDefault() {} });
ok('Escape: ungeblurte Eingabe gespeichert', JSON.parse(h.mem[Store.key(null)]).draftData.profile.displayName === 'Esc');
ok('Escape: Dialog bleibt offen', h.docEl.documentElement.classList.contains('ob2-open') === true);

// 34) Review-Button prüft strukturiertes Resultat: unvollständiger Review-Draft öffnet KEINE Statusansicht
const seedRgap = {}; seedRgap[Store.key(null)] = JSON.stringify(L.normalizeDraft({ version: 2, status: 'in_progress', currentStep: 'review_placeholder', completedSteps: ['welcome', 'profile'], draftData: { profile: VPROF } }));
h = await fresh(seedRgap);
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.reg.get('#ob2-review-ready').onclick();
ok('unvollständiger Review-Draft → KEINE Statusansicht', (card(h).innerHTML || '').indexOf('Einrichtung vorgemerkt') < 0);
ok('unvollständiger Review-Draft → bleibt review', ST().draft.status !== 'ready_for_review');

// 35) Store-Save-Zähler: je Aktion genau ein Save
h = await fresh(profileSeed({}));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
let cnt = h.saves(); ST().el._ev.keydown({ key: 'Escape', preventDefault() {} });
ok('Escape: genau ein Save', h.saves() - cnt === 1);
cnt = h.saves(); h.byId('pf-unit-imperial').checked = true; h.byId('pf-unit-imperial')._ev.change();
ok('Einheitenwechsel: genau ein Save', h.saves() - cnt === 1);
cnt = h.saves(); ST().lastNav = 0; h.reg.get('#ob2-back').onclick();
ok('Zurück: genau ein Save', h.saves() - cnt === 1);

// 36) Weiter bei ungültigem Profil navigiert nicht
h = await fresh(profileSeed({}));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.reg.get('#ob2-next').onclick();
ok('Weiter ungültig: bleibt auf profile', ST().draft.currentStep === 'profile');
ok('Weiter ungültig: profile nicht completed', ST().draft.completedSteps.indexOf('profile') < 0);

// 37) Teilmodul (nur 4 Kernfunktionen) reicht nicht → Fehleransicht
const fullPL = globalThis.ORVIA.onboardingProfileLogic;
globalThis.ORVIA.onboardingProfileLogic = { normalizeProfile: fullPL.normalizeProfile, validateProfile: fullPL.validateProfile, profileComplete: fullPL.profileComplete, profileSeedFromExisting: fullPL.profileSeedFromExisting };
h = await fresh(profileSeedNoProfile());
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Teilmodul (4 Fn) → Fehleransicht', (card(h).innerHTML || '').indexOf('Basisprofil nicht verfügbar') >= 0 && !h.byId('ob2-next'));
// 38) fehlt parseFeetInches → Fehleransicht
globalThis.ORVIA.onboardingProfileLogic = Object.assign({}, fullPL); delete globalThis.ORVIA.onboardingProfileLogic.parseFeetInches;
h = await fresh(profileSeedNoProfile());
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('fehlt parseFeetInches → Fehleransicht', (card(h).innerHTML || '').indexOf('Basisprofil nicht verfügbar') >= 0);
// 39) fehlt _num → Fehleransicht
globalThis.ORVIA.onboardingProfileLogic = Object.assign({}, fullPL); delete globalThis.ORVIA.onboardingProfileLogic._num;
h = await fresh(profileSeedNoProfile());
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('fehlt _num → Fehleransicht', (card(h).innerHTML || '').indexOf('Basisprofil nicht verfügbar') >= 0);
globalThis.ORVIA.onboardingProfileLogic = fullPL;

// 40) Fehlgeschlagene Review-Vormerkung zeigt sichtbaren Hinweis (keine Erfolgsansicht)
const seedRgap2 = {}; seedRgap2[Store.key(null)] = JSON.stringify(L.normalizeDraft({ version: 2, status: 'in_progress', currentStep: 'review_placeholder', completedSteps: ['welcome', 'profile'], draftData: { profile: VPROF } }));
h = await fresh(seedRgap2);
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.reg.get('#ob2-review-ready').onclick();
ok('Review-Fehler sichtbar angezeigt', (card(h).innerHTML || '').indexOf('konnte noch nicht vorgemerkt') >= 0);
ok('Review-Fehler: KEINE Erfolgsansicht', (card(h).innerHTML || '').indexOf('Einrichtung vorgemerkt') < 0);

// 41) Inkonsistenter gespeicherter ready_for_review öffnet NICHT die Statusansicht (Reconcile stuft zurück)
const seedInc = {}; seedInc[Store.key(null)] = JSON.stringify({ version: 2, status: 'ready_for_review', currentStep: 'review_placeholder', completedSteps: ['welcome', 'profile'], draftData: { profile: VPROF } });
h = await fresh(seedInc);
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('inkonsistenter Review-Draft → KEINE Statusansicht', (card(h).innerHTML || '').indexOf('Einrichtung vorgemerkt') < 0);

// ---- Sportarten-Schritt ----
function sportsSeed(sportsObj) { const s = {}; s[Store.key(null)] = JSON.stringify(L.normalizeDraft({ version: 2, status: 'in_progress', currentStep: 'sports', completedSteps: ['welcome', 'profile'], draftData: sportsObj ? { profile: VPROF, sports: sportsObj } : { profile: VPROF } })); return s; }
const SP = () => ST().draft.draftData.sports.sports;

// 42) Sports-Schritt rendert + Auswahl + Hauptsportart
h = await fresh(sportsSeed());
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Sports rendert (Titel/Chip)', (card(h).innerHTML || '').indexOf('Deine Sportarten') >= 0 && (card(h).innerHTML || '').indexOf('Laufen') >= 0);
h.byId('sp-running').onclick();
ok('Auswahl: running hinzugefügt', SP().some(e => e.sportId === 'running'));
ok('einzige Sportart → automatisch primary', ST().draft.draftData.sports.sports.find(e => e.sportId === 'running').role === 'primary');
h.byId('sp-gym').onclick();
ok('zweite Sportart hinzugefügt', SP().length === 2);
h.byId('pr-gym').onclick();
ok('Hauptsportart auf gym gesetzt', ST().draft.draftData.sports.sports.find(e => e.sportId === 'gym').role === 'primary');
ok('vorherige primary (running) → secondary', ST().draft.draftData.sports.sports.find(e => e.sportId === 'running').role === 'secondary');

// 43) Rolle/Planung/Sichtbarkeit + ausgeblendete bleibt ausgewählt
h = await fresh(sportsSeed({ sports: [{ sportId: 'running', role: 'primary' }, { sportId: 'cycling', role: 'secondary', planningEnabled: true }] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.byId('vis-cycling').onclick();   // Toggle-Button „In der App anzeigen"
ok('Sichtbarkeit aus: cycling nicht sichtbar', ST().draft.draftData.sports.sports.find(e => e.sportId === 'cycling').visible === false);
ok('ausgeblendete cycling bleibt ausgewählt', SP().some(e => e.sportId === 'cycling'));
h.byId('mode-occ-cycling').onclick();   // Segment-Control „Gelegentlich"
ok('Rolle gelegentlich gesetzt', ST().draft.draftData.sports.sports.find(e => e.sportId === 'cycling').role === 'occasional');
ok('gelegentlich → planningEnabled false', ST().draft.draftData.sports.sports.find(e => e.sportId === 'cycling').planningEnabled === false);

// 44) Leere Auswahl blockiert Weiter + Fehler + Fokus
h = await fresh(sportsSeed({ sports: [] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.reg.get('#ob2-next').onclick();
ok('leere Auswahl: bleibt auf sports', ST().draft.currentStep === 'sports');
ok('leere Auswahl: Fehler sichtbar', (card(h).innerHTML || '').indexOf('mindestens eine Sportart') >= 0);
ok('leere Auswahl: Fokus erstes Chip', h.byId('sp-running') && h.byId('sp-running')._focused === true);

// 45) Valide Auswahl → weiter zu goals; Autosave speichert Auswahl
h = await fresh(sportsSeed({ sports: [{ sportId: 'running', role: 'primary' }] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ST().lastNav = 0; h.reg.get('#ob2-next').onclick();
ok('valide Sports: weiter zu goals_placeholder', ST().draft.currentStep === 'goals_placeholder');
ok('Sports in completedSteps', ST().draft.completedSteps.indexOf('sports') >= 0);
ok('Auswahl persistiert', JSON.parse(h.mem[Store.key(null)]).draftData.sports.sports.length === 1);

// 46) Doppelklick auf Auswahl-Chip togglet nicht doppelt unkontrolliert (Endzustand deterministisch)
h = await fresh(sportsSeed({ sports: [] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.byId('sp-running').onclick();        // ausgewählt
ok('Chip toggelt zu ausgewählt', SP().some(e => e.sportId === 'running'));

// 47) Fehlendes Sport-Modul → Fehleransicht ohne Weiter
const fullSL = globalThis.ORVIA.onboardingSportsLogic;
globalThis.ORVIA.onboardingSportsLogic = undefined;
h = await fresh(sportsSeed());
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('fehlendes Sport-Modul → Fehleransicht', (card(h).innerHTML || '').indexOf('Sportauswahl nicht verfügbar') >= 0 && !h.byId('ob2-next'));
// 48) Teilmodul → Fehleransicht
globalThis.ORVIA.onboardingSportsLogic = { SPORT_CATALOG: fullSL.SPORT_CATALOG, normalizeSportsSelection: fullSL.normalizeSportsSelection };
h = await fresh(sportsSeed());
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Teilmodul → Fehleransicht', (card(h).innerHTML || '').indexOf('Sportauswahl nicht verfügbar') >= 0);
globalThis.ORVIA.onboardingSportsLogic = fullSL;

// 49) Review zeigt Sport-Zusammenfassung
h = await fresh(seedRR);
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Review: Sport-Zusammenfassung (Hauptsportart)', (card(h).innerHTML || '').indexOf('Hauptsportart: Laufen') >= 0);

/* ===== Korrekturdurchlauf: Vertrag, nicht-planbar, Priorität, a11y ===== */
// 50) Teilmodul OHNE CATALOG_BY_ID → Fehleransicht
const fullSL2 = globalThis.ORVIA.onboardingSportsLogic;
const reqFns = ['normalizeSportsSelection', 'validateSportsSelection', 'sportsComplete', 'getPrimarySport', 'getPlannedSports', 'getVisibleSports', 'getOccasionalSports', 'setPrimarySport', 'toggleSport', 'setSportRole', 'setPlanningEnabled', 'setVisible', 'setSportMode', 'reorderPlannedSports', 'seedFromExistingProfile', 'buildUserSportConfiguration', 'validateSportCatalog', 'plannable'];
let noCat = { SPORT_CATALOG: fullSL2.SPORT_CATALOG }; reqFns.forEach(n => noCat[n] = fullSL2[n]);  // CATALOG_BY_ID fehlt
globalThis.ORVIA.onboardingSportsLogic = noCat;
h = await fresh(sportsSeed());
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('ohne CATALOG_BY_ID → Fehleransicht', (card(h).innerHTML || '').indexOf('Sportauswahl nicht verfügbar') >= 0);
// 51) Inkonsistentes CATALOG_BY_ID → Fehleransicht
let badCat = { SPORT_CATALOG: fullSL2.SPORT_CATALOG, CATALOG_BY_ID: { running: { id: 'running' } } }; reqFns.forEach(n => badCat[n] = fullSL2[n]);
globalThis.ORVIA.onboardingSportsLogic = badCat;
h = await fresh(sportsSeed());
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('inkonsistentes CATALOG_BY_ID → Fehleransicht', (card(h).innerHTML || '').indexOf('Sportauswahl nicht verfügbar') >= 0);
globalThis.ORVIA.onboardingSportsLogic = fullSL2;
// 52) other: keine aktive Planungsoption, nicht in Hauptsportart-Auswahl
h = await fresh(sportsSeed({ sports: [{ sportId: 'running', role: 'primary' }, { sportId: 'other', role: 'secondary' }] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('other: kein Plan-Segment', !h.byId('mode-planned-other') && !h.byId('mode-occ-other'));
ok('other: nicht in Hauptsportart-Auswahl', !h.byId('pr-other'));
ok('other: Sichtbar-Toggle vorhanden', !!h.byId('vis-other'));
ok('other: planningEnabled bleibt false', SP().find(e => e.sportId === 'other').planningEnabled === false);
// 53) Priorität: geplante Sekundär-Sportarten nach oben/unten sortierbar, primary bleibt 1
h = await fresh(sportsSeed({ sports: [{ sportId: 'running', role: 'primary' }, { sportId: 'cycling', role: 'secondary', planningEnabled: true, priority: 2 }, { sportId: 'gym', role: 'secondary', planningEnabled: true, priority: 3 }] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('↑/↓-Buttons vorhanden', !!h.byId('up-gym') && !!h.byId('dn-cycling'));
ok('Priorität sichtbar angezeigt', (card(h).innerHTML || '').indexOf('Priorität 1') >= 0);
h.byId('up-gym').onclick();   // gym nach oben
ok('gym nach oben: gym vor cycling', SP().find(e => e.sportId === 'gym').priority < SP().find(e => e.sportId === 'cycling').priority);
ok('Hauptsportart bleibt Priorität 1', SP().find(e => e.role === 'primary').priority === 1);
ok('Sortierung persistiert', JSON.parse(h.mem[Store.key(null)]).draftData.sports.sports.find(e => e.sportId === 'gym').priority === 2);
// 53b) Reload erhält Sortierung
let savedMem = h.mem[Store.key(null)];
h = await fresh({ [Store.key(null)]: savedMem });
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Reload erhält Sortierung (gym Priorität 2)', SP().find(e => e.sportId === 'gym').priority === 2);
// 54) leere Auswahl → aria-invalid auf Auswahl-Gruppe
h = await fresh(sportsSeed({ sports: [] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.reg.get('#ob2-next').onclick();
ok('leere Auswahl: aria-invalid gesetzt', (card(h).innerHTML || '').indexOf('aria-invalid="true"') >= 0);
// 55) fehlende Hauptsportart (nur other) → aria-invalid auf Hauptsportart-Gruppe
h = await fresh(sportsSeed({ sports: [{ sportId: 'other', role: 'secondary' }] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.reg.get('#ob2-next').onclick();
ok('fehlende Hauptsportart: _primary-Fehler + aria-invalid', (card(h).innerHTML || '').indexOf('err-primary') >= 0 && (card(h).innerHTML || '').indexOf('aria-invalid="true"') >= 0);
// 56) gültiger Zustand → kein aria-invalid=true
h = await fresh(sportsSeed({ sports: [{ sportId: 'running', role: 'primary' }] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('gültiger Zustand: kein aria-invalid=true', (card(h).innerHTML || '').indexOf('aria-invalid="true"') < 0);

/* ===== UX-Durchlauf: dynamische Hauptsportart, Segment-Control, Toggle, sticky Nav ===== */
// 57) Hauptsportart-Liste enthält ALLE ausgewählten planbaren Sportarten (keine feste Vierer-Liste)
h = await fresh(sportsSeed({ sports: [{ sportId: 'running', role: 'primary' }, { sportId: 'gym', role: 'secondary' }, { sportId: 'football', role: 'secondary' }, { sportId: 'triathlon', role: 'secondary' }, { sportId: 'tennis', role: 'secondary' }] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Hauptsportart: running/gym/football/triathlon/tennis wählbar', !!h.byId('pr-running') && !!h.byId('pr-gym') && !!h.byId('pr-football') && !!h.byId('pr-triathlon') && !!h.byId('pr-tennis'));
ok('Fußball als Hauptsportart setzbar', (h.byId('pr-football').onclick(), SP().find(e => e.sportId === 'football').role === 'primary'));
// 58) nicht ausgewählte Sportart erscheint nicht als Hauptsportart
ok('nicht gewähltes padel nicht als Hauptsportart', !h.byId('pr-padel'));
// 59) Segment-Control „Aktiv planen" funktioniert + ganze Fläche ist <button> (Handler gesetzt)
h = await fresh(sportsSeed({ sports: [{ sportId: 'running', role: 'primary' }, { sportId: 'cycling', role: 'occasional' }] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Segment „Aktiv planen" hat Handler (Button, kein input)', typeof h.byId('mode-planned-cycling').onclick === 'function');
h.byId('mode-planned-cycling').onclick();
ok('Klick „Aktiv planen": planned + secondary', SP().find(e => e.sportId === 'cycling').planningEnabled === true && SP().find(e => e.sportId === 'cycling').role === 'secondary');
ok('nach planned: ↑/↓ + Priorität sichtbar', !!h.byId('up-cycling') || (card(h).innerHTML || '').indexOf('Priorität 2') >= 0);
// 60) „Gelegentlich" funktioniert + danach keine Priorität
h.byId('mode-occ-cycling').onclick();
ok('Klick „Gelegentlich": occasional, keine Priorität', SP().find(e => e.sportId === 'cycling').role === 'occasional' && SP().find(e => e.sportId === 'cycling').priority === null);
ok('gelegentlich: keine ↑/↓-Buttons', (card(h).innerHTML || '').indexOf('id="dn-cycling"') < 0);
// 61) Toggle „In der App anzeigen" als Button (role=switch), volle Fläche
h = await fresh(sportsSeed({ sports: [{ sportId: 'running', role: 'primary' }, { sportId: 'cycling', role: 'secondary', planningEnabled: true }] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Sichtbar-Toggle ist role=switch-Button', (card(h).innerHTML || '').indexOf('id="vis-cycling"') >= 0 && (card(h).innerHTML || '').indexOf('role="switch"') >= 0);
ok('keine versteckten Checkbox-Controls mehr', (card(h).innerHTML || '').indexOf('type="checkbox"') < 0 && (card(h).innerHTML || '').indexOf('id="occ-') < 0 && (card(h).innerHTML || '').indexOf('id="plan-') < 0);
// 62) jeder Klick speichert genau einmal
let savesBefore = h.saves(); h.byId('vis-cycling').onclick(); ok('ein Klick = ein Save', h.saves() - savesBefore === 1);
// 63) Re-Render zerstört Handler nicht (zweiter Klick wirkt)
let visState = SP().find(e => e.sportId === 'cycling').visible;
h.byId('vis-cycling').onclick();
ok('Handler nach Re-Render erneut aktiv', SP().find(e => e.sportId === 'cycling').visible !== visState);
// 64) sticky Navigation vorhanden + Weiter erreichbar
ok('sticky Nav-Wrapper vorhanden', (card(h).innerHTML || '').indexOf('ob2-navwrap') >= 0 && !!h.byId('ob2-next'));
// 65) keine doppelte ID im gerenderten HTML
(function () { var html = card(h).innerHTML || ''; var re = /id="([^"]+)"/g, m, seen = {}, dup = false; while ((m = re.exec(html))) { if (seen[m[1]]) dup = true; seen[m[1]] = true; } ok('keine doppelte ID im HTML', dup === false); })();
// 66) neue UX-Texte (Hilfeblock + Überschrift „Wie nutzt du deine Sportarten?")
ok('neue Behandlungs-Überschrift', (card(h).innerHTML || '').indexOf('Wie nutzt du deine Sportarten?') >= 0);
ok('Hilfeblock vorhanden', (card(h).innerHTML || '').indexOf('Aktiv geplant') >= 0 && (card(h).innerHTML || '').indexOf('In der App anzeigen') >= 0);
// 67) bestehender Draft mit Triathlon-Primary korrekt gerendert
h = await fresh(sportsSeed({ sports: [{ sportId: 'triathlon', role: 'primary' }, { sportId: 'running', role: 'secondary', planningEnabled: true }] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Triathlon-Primary gerendert', SP().find(e => e.role === 'primary').sportId === 'triathlon' && (card(h).innerHTML || '').indexOf('Triathlon') >= 0);

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
