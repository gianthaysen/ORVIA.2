/* ORVIA · Batch 2 — onboarding-ui DOM-nah mit stabiler Element-Registry (kein jsdom).
   Pro Szenario frisches document + frisches localStorage + frischer ui-Import (eigener State). */
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const wait = () => new Promise(r => setTimeout(r, 5));

globalThis.ORVIA = {};
const gWinEv = {};
globalThis.addEventListener = (t, fn) => { gWinEv[t] = fn; };   // beforeunload testbar
await import(new URL('../../../app/js/onboarding/onboarding-profile-logic.js', import.meta.url));
await import(new URL('../../../app/js/onboarding/onboarding-sports-logic.js', import.meta.url));
await import(new URL('../../../app/js/profile-model.js', import.meta.url));   // M6: goalsValid-Guard + Ziel-Renderer
await import(new URL('../../../app/js/onboarding/onboarding-logic.js', import.meta.url));
await import(new URL('../../../app/js/onboarding/onboarding-steps.js', import.meta.url));
await import(new URL('../../../app/js/onboarding/onboarding-store.js', import.meta.url));
await import(new URL('../../../app/js/profile-ui-kit.js', import.meta.url));   // M5a: A1 nutzt das UI-Kit (fail-closed ohne Kit)
await import(new URL('../../../app/js/onboarding/onboarding-ui.js', import.meta.url)); // einmal; document-Zugriff ist dynamisch

async function fresh(seedMem) {
  const reg = new Map();
  function registerHtmlIds(html) { var m, re = /id="([^"]+)"/g; while ((m = re.exec(String(html || '')))) { if (!reg.has('#' + m[1])) reg.set('#' + m[1], makeEl()); } }
  function appendEl(el) { if (el && el._id) reg.set('#' + el._id, el); if (el) registerHtmlIds(el._html); }
  function makeEl() {
    const el = {
      style: {}, _html: '', value: '', textContent: '', disabled: false, checked: false, onclick: null, _id: null, _ev: {}, _focused: false,
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c, f) { if (f === undefined) f = !this._s.has(c); if (f) this._s.add(c); else this._s.delete(c); return f; } },
      set innerHTML(v) { this._html = v; registerHtmlIds(v); }, get innerHTML() { return this._html; },
      set id(v) { this._id = v; if (v) reg.set('#' + v, this); }, get id() { return this._id; },
      _attr: {}, setAttribute(k, v) { this._attr[k] = v; if (k === 'id' && v) { this._id = v; reg.set('#' + v, this); } }, removeAttribute(k) { delete this._attr[k]; }, getAttribute(k) { return this._attr[k]; }, addEventListener(ev, cb) { this._ev[ev] = cb; }, appendChild(c) { appendEl(c); },
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
// M5a: Welcome (A0) zeigt KEINEN Schrittzähler (zählt nicht zum Fortschritt), sondern Claim + Start.
ok('Welcome: Claim + Start-Button, kein Schrittzähler', (card(h).innerHTML || '').indexOf('Know your state.') >= 0 && !!h.byId('ob3-start') && (card(h).innerHTML || '').indexOf('Schritt 1 von') < 0);
ok('Fokus auf Überschrift', h.byId('ob2-title') && h.byId('ob2-title')._focused === true);

// 2) Weiter & Zurück
h = await fresh();
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.reg.get('#ob3-start').onclick();
ok('Weiter → Schritt 2 (profile)', globalThis.ORVIA.onboardingV2._state.draft.currentStep === 'profile');
globalThis.ORVIA.onboardingV2._state.lastNav = 0;   // Zeitabstand simulieren (Nav-Lock freigeben)
h.reg.get('#ob2-back').onclick();
ok('Zurück → Schritt 1', globalThis.ORVIA.onboardingV2._state.draft.currentStep === 'welcome');

// 3) Doppelklick führt nicht über mehrere Schritte
h = await fresh();
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
const nx = h.reg.get('#ob3-start'); nx.onclick(); nx.onclick();
ok('Doppelklick: nur EIN Schritt weiter', globalThis.ORVIA.onboardingV2._state.draft.currentStep === 'profile');

// 4) „Später fortsetzen" speichert und schließt; Schließen verwirft nichts
h = await fresh();
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.reg.get('#ob3-start').onclick();          // Fortschritt erzeugen
h.reg.get('#ob2-later').onclick();
ok('Später: Dialog geschlossen', h.docEl.documentElement.classList.contains('ob2-open') === false);
ok('Später: Draft lokal gespeichert', !!h.mem[Store.key(null)]);
ok('Schließen verwirft nicht (currentStep erhalten)', JSON.parse(h.mem[Store.key(null)]).currentStep === 'profile');

// 5) Bestehender Draft wird fortgesetzt
// M5b: Draft muss ein VALIDES Profil tragen, sonst führt die Fail-closed-Rückführung korrekt
// auf den Profil-Schritt zurück (behaupteter Abschluss ohne Daten zählt nicht mehr).
const seed = {}; seed[Store.key(null)] = JSON.stringify(L.normalizeDraft({ version: 2, status: 'in_progress', currentStep: 'sports_placeholder', completedSteps: ['welcome', 'profile_placeholder'], draftData: { profile: { displayName: 'Alex', birthDate: '2000-05-10' } } }));
h = await fresh(seed);
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
/* M5b: Sports-Schritt nutzt jetzt den Kit-ProgressHeader (Zahlen aus getProgress, DOM-Elemente
   statt innerHTML-String) — Assertion auf den Fortschrittsvertrag statt auf den Label-Text. */
{
  const gpR = L.getProgress(globalThis.ORVIA.onboardingV2._state.draft);
  ok('Resume: sports-Schritt, Fortschritt 2 von 8 (getProgress, M7)', globalThis.ORVIA.onboardingV2._state.draft.currentStep === 'sports' && gpR.current === 2 && gpR.total === 8);
}

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
const VSPORTS = { sports: [{ sportId: 'running', role: 'primary', enabled: true, visible: true, planningEnabled: true, priority: 1, level: 'intermediate', sessionsPerWeek: 4, typicalDuration: 60 }] };   // M5b/M7: inkl. A3+A5-Angaben
const VGOALS = [{ id: 'goal:t1', title: 'Halbmarathon', category: 'half_marathon', priority: 1, status: 'active' }];   // M6: Essential-Ziel
const seedR = {}; seedR[Store.key(null)] = JSON.stringify(L.normalizeDraft({ version: 2, status: 'in_progress', currentStep: 'review_placeholder', completedSteps: ['welcome', 'profile', 'sports', 'training_level', 'goals_placeholder', 'schedule_placeholder', 'safety', 'body'], draftData: { profile: VPROF, sports: VSPORTS, goals: VGOALS, availability: { days: { di: { available: true } } }, safety: { hasComplaints: false } } }));
h = await fresh(seedR);
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
// 4i.1: review_placeholder ist jetzt der Zusammenfassungs-Schritt (Profil erstellen), kein „vormerken".
globalThis.ORVIA.onboardingV2._state.draft.currentStep = 'review_placeholder'; globalThis.ORVIA.onboardingV2.renderSummaryStep();
ok('Review→Summary: ReviewCards + Profil erstellen (M8)', (card(h).innerHTML || '').indexOf('Sieht gut aus.') >= 0 && !!h.byId('ob2-finish') && !!h.byId('rv-personal'));
ok('Review→Summary: kein „Einrichtung vorgemerkt"', (card(h).innerHTML || '').indexOf('vorgemerkt') < 0);

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
const _rrDraft = L.normalizeDraft({ version: 2, status: 'in_progress', currentStep: 'review_placeholder', completedSteps: ['welcome', 'profile', 'sports', 'training_level', 'goals_placeholder', 'schedule_placeholder', 'safety', 'body'], draftData: { profile: VPROF, sports: VSPORTS, goals: VGOALS, availability: { days: { di: { available: true } } }, safety: { hasComplaints: false } } });
L.markReadyForReview(_rrDraft, 5);   // strukturiertes Resultat; mutiert _rrDraft
const seedRR = {}; seedRR[Store.key(null)] = JSON.stringify(_rrDraft);
h = await fresh(seedRR);
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('ready_for_review reopen → Statusansicht', (card(h).innerHTML || '').indexOf('Einrichtung gespeichert') >= 0);
ok('ready_for_review reopen → KEIN Review-Button', !h.byId('ob2-review-ready'));
// 11b) BEARBEITEN: abgeschlossenes Profil bleibt editierbar (edit:true umgeht den Done-Screen)
h = await fresh(seedRR);
globalThis.ORVIA.onboardingV2.open({ fresh: false, edit: true });
await wait();
ok('edit:true reopen → bearbeitbare Profilformulare (kein Done-Screen)', (card(h).innerHTML || '').indexOf('Einrichtung gespeichert') < 0 && (card(h).innerHTML || '').indexOf('Deine Sportarten') < 0 && !!h.byId('pf-displayName'));
ok('edit:true: vorhandene Werte vorausgefüllt', (h.byId('pf-displayName') && h.byId('pf-displayName').value !== undefined));

// 11c) FIX v8-155: edit:true hat Vorrang vor readyForReview AUCH OHNE gespeicherten Onboarding-Draft
// (Profil aus Cloud/PROFILE, kein v2-Draft). Reproduziert den iPhone-Live-Fehler.
h = await fresh();   // KEIN seed → existing/Store-Draft = null
globalThis.ORVIA.onboardingV2.open({ fresh: false, edit: true });
await wait();
ok('11c edit:true ohne Store-Draft → Profilformular (kein Done-Screen)', (card(h).innerHTML || '').indexOf('Einrichtung gespeichert') < 0 && !!h.byId('pf-displayName'));

// 11d) Kanonischer Einstieg ORVIA.openProfileEditor() setzt fresh:false + edit:true und öffnet das Formular
h = await fresh(seedRR);
let _spyArgs = null; const _origOpen = globalThis.openOrviaOnboarding;
globalThis.openOrviaOnboarding = function (o) { _spyArgs = o; return _origOpen(o); };
const _ret = globalThis.ORVIA.openProfileEditor();
await wait();
globalThis.openOrviaOnboarding = _origOpen;
ok('11d openProfileEditor() → fresh:false', _spyArgs && _spyArgs.fresh === false);
ok('11d openProfileEditor() → edit:true', _spyArgs && _spyArgs.edit === true);
ok('11d openProfileEditor() → editierbares Formular (kein Done-Screen)', (card(h).innerHTML || '').indexOf('Einrichtung gespeichert') < 0 && !!h.byId('pf-displayName'));

// 11e) Done-Screen ist keine Sackgasse: „Profil bearbeiten" steigt in den Profil-Schritt ein
h = await fresh(seedRR);
globalThis.ORVIA.onboardingV2.open({ fresh: false });   // Ersteinrichtung → Done-Screen
await wait();
ok('11e Done-Screen bietet „Profil bearbeiten"', !!h.byId('ob2-edit'));
h.byId('ob2-edit').onclick();
await wait();
ok('11e Done-Screen → Bearbeiten öffnet Profilformular', (card(h).innerHTML || '').indexOf('Einrichtung gespeichert') < 0 && !!h.byId('pf-displayName'));

// 12) Fresh → Fortsetzen mit ready_for_review öffnet ebenfalls die Statusansicht
h = await fresh(seedRR);
globalThis.ORVIA.onboardingV2.open({ fresh: true });
await wait();
h.reg.get('#ob2-resume').onclick();
ok('Fresh-Resume ready_for_review → Statusansicht', (card(h).innerHTML || '').indexOf('Einrichtung gespeichert') >= 0);

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
ok('Profil: Formular gerendert (Namens-Label M5a)', (card(h).innerHTML || '').indexOf('Wie dürfen wir dich nennen?') >= 0);
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
// M5a: A1 verlangt NUR Name + Geburtsdatum (bzw. Alter). Geschlecht/Größe/Gewicht/Niveau sind optional bzw. A3/A7.
h.byId('pf-displayName').value = 'Alex'; h.byId('pf-birthDate').value = '2000-05-10';
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

// 19) M5a: Geburtsdatum ⇄ Alter (SegmentedControl) — Wechsel leert die jeweils andere Angabe (keine Doppelrepräsentanz)
h = await fresh(profileSeed({ displayName: 'Alex', birthDate: '2000-05-10' }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Datum-Modus: pf-birthDate gerendert, kein pf-age', (card(h).innerHTML || '').indexOf('id="pf-birthDate"') >= 0 && (card(h).innerHTML || '').indexOf('id="pf-age"') < 0);
h.byId('pf-birthmode-age')._ev.click();
ok('Wechsel → Alter: birthDate geleert', ST().draft.draftData.profile.birthDate === '');
ok('Wechsel → Alter: pf-age gerendert, kein pf-birthDate', (card(h).innerHTML || '').indexOf('id="pf-age"') >= 0 && (card(h).innerHTML || '').indexOf('id="pf-birthDate"') < 0);
h.byId('pf-age').value = '30'; h.byId('pf-age')._ev.change();
h.byId('pf-birthmode-date')._ev.click();
ok('Wechsel → Datum: ageEstimate geleert', ST().draft.draftData.profile.ageEstimate == null);

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

// 23) M5a: Alter-Modus — bestehender ageEstimate wird gerendert; ungeblurte Eingabe wird bei „Später" gespeichert
h = await fresh(profileSeed({ ageEstimate: 30 }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Alter-Modus (Seed): pf-age mit value="30"', (card(h).innerHTML || '').indexOf('id="pf-age"') >= 0 && (card(h).innerHTML || '').indexOf('value="30"') >= 0);
h.byId('pf-age').value = '31';
h.reg.get('#ob2-later').onclick();
ok('Alter ungeblurt + Später → gespeichert', String(JSON.parse(h.mem[Store.key(null)]).draftData.profile.ageEstimate) === '31');

// 24) M5a: ungültiges Alter (12) blockiert Weiter + markiert pf-age
h = await fresh(profileSeed({ displayName: 'Alex', ageEstimate: 30 }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.byId('pf-age').value = '12'; h.byId('pf-age')._ev.change();
ST().lastNav = 0; h.reg.get('#ob2-next').onclick();
ok('Alter 12: bleibt auf profile', ST().draft.currentStep === 'profile');
ok('Alter 12: Fehlertext sichtbar', (card(h).innerHTML || '').indexOf('zwischen 13 und 100') >= 0);
ok('Alter 12: pf-age aria-invalid', h.byId('pf-age').getAttribute('aria-invalid') === 'true');

// 25) aria-invalid verschwindet bei Korrektur (nach Submit)
h = await fresh(profileSeed({ displayName: '', birthDate: '2000-05-10', sex: 'male', heightCm: 180, weightKg: 75, unitSystem: 'metric', experienceLevel: 'intermediate' }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.reg.get('#ob2-next').onclick();   // ungültig (Name leer) → submitted
ok('Submit invalid: displayName aria-invalid gesetzt', h.byId('pf-displayName').getAttribute('aria-invalid') === 'true');
h.byId('pf-displayName').value = 'Alex'; h.byId('pf-displayName')._ev.input();
ok('Korrektur: aria-invalid entfernt', h.byId('pf-displayName').getAttribute('aria-invalid') === undefined);

// 26) M5a: Alter 13 (Grenze) genügt OHNE Geburtsdatum → Weiter zu sports
h = await fresh(profileSeed({ ageEstimate: 30 }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.byId('pf-displayName').value = 'Alex'; h.byId('pf-age').value = '13';
ST().lastNav = 0; h.reg.get('#ob2-next').onclick();
ok('Alter 13 ohne Geburtsdatum: weiter zu sports', ST().draft.currentStep === 'sports');

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
ok('alt ready_for_review ohne Profil → Profilformular', (card(h).innerHTML || '').indexOf('id="pf-displayName"') >= 0 && (card(h).innerHTML || '').indexOf('Einrichtung gespeichert') < 0);

// 30) M5a: Labels & A11y des A1-Formulars (Geschlecht als ChoiceCard-Gruppe, „Keine Angabe" neutral vorbelegt)
h = await fresh(profileSeed({}));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
const html30 = card(h).innerHTML || '';
ok('Label for=pf-displayName + Feld existiert', html30.indexOf('for="pf-displayName"') >= 0 && !!h.byId('pf-displayName'));
ok('Geschlecht: role=group + aria-labelledby + (optional)', html30.indexOf('role="group"') >= 0 && html30.indexOf('aria-labelledby="lbl-sex"') >= 0 && html30.indexOf('(optional)') >= 0);
ok('Geschlecht: 4 ChoiceCards erreichbar', !!h.byId('pf-sex-male') && !!h.byId('pf-sex-female') && !!h.byId('pf-sex-diverse') && !!h.byId('pf-sex-prefer_not_to_say'));
ok('„Keine Angabe" vorbelegt (aria-pressed)', h.byId('pf-sex-prefer_not_to_say').getAttribute('aria-pressed') === 'true');
ok('Vorbelegung schreibt NICHT in den Draft', (ST().draft.draftData.profile.sex || '') === '');
ok('Keine Größen-/Gewichts-/Niveau-Felder in A1', html30.indexOf('pf-height') < 0 && html30.indexOf('pf-weight') < 0 && html30.indexOf('pf-level') < 0 && html30.indexOf('pf-ft') < 0);

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
ST().draft.currentStep = 'review_placeholder'; globalThis.ORVIA.onboardingV2.renderSummaryStep();
ok('Review→Summary statt Statusansicht', (card(h).innerHTML || '').indexOf('Einrichtung gespeichert') < 0 && !!h.byId('ob2-finish'));

// 35) Store-Save-Zähler: je Aktion genau ein Save
h = await fresh(profileSeed({}));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
let cnt = h.saves(); ST().el._ev.keydown({ key: 'Escape', preventDefault() {} });
ok('Escape: genau ein Save', h.saves() - cnt === 1);
cnt = h.saves(); h.byId('pf-sex-male')._ev.click();
ok('Geschlecht-ChoiceCard: genau ein Save + Draft-Write', h.saves() - cnt === 1 && ST().draft.draftData.profile.sex === 'male');
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
ST().draft.currentStep = 'review_placeholder'; globalThis.ORVIA.onboardingV2.renderSummaryStep();
ok('Review→Summary: Abschluss-Button, keine Erfolgs-Statusansicht', !!h.byId('ob2-finish') && (card(h).innerHTML || '').indexOf('Einrichtung gespeichert') < 0);

// 41) Inkonsistenter gespeicherter ready_for_review öffnet NICHT die Statusansicht (Reconcile stuft zurück)
const seedInc = {}; seedInc[Store.key(null)] = JSON.stringify({ version: 2, status: 'ready_for_review', currentStep: 'review_placeholder', completedSteps: ['welcome', 'profile'], draftData: { profile: VPROF } });
h = await fresh(seedInc);
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('inkonsistenter Review-Draft → KEINE Statusansicht', (card(h).innerHTML || '').indexOf('Einrichtung gespeichert') < 0);

// ---- Sportarten-Schritt ----
function sportsSeed(sportsObj) { const s = {}; s[Store.key(null)] = JSON.stringify(L.normalizeDraft({ version: 2, status: 'in_progress', currentStep: 'sports', completedSteps: ['welcome', 'profile'], draftData: sportsObj ? { profile: VPROF, sports: sportsObj } : { profile: VPROF } })); return s; }
const SP = () => ST().draft.draftData.sports.sports;

// 42) M5b: Sports-Schritt (Essential) — ChoiceCard-Grid, Auswahl + Auto-Primary + Hauptsport-Wechsel
h = await fresh(sportsSeed());
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Sports rendert (Grid + Kit-Karten)', !!h.byId('ob3-sportgrid') && !!h.byId('spc-running') && (card(h).innerHTML || '').indexOf('Welche Sportarten machst du?') >= 0);
h.byId('spc-running')._ev.click({ preventDefault() {} });
await wait();
ok('Auswahl: running hinzugefügt', SP().some(e => e.sportId === 'running'));
ok('einzige Sportart → automatisch primary', ST().draft.draftData.sports.sports.find(e => e.sportId === 'running').role === 'primary');
h.byId('spc-gym')._ev.click({ preventDefault() {} });
await wait();
ok('zweite Sportart hinzugefügt', SP().length === 2);
h.byId('prc-gym')._ev.click({ preventDefault() {} });
await wait();
ok('Hauptsport auf gym gesetzt', ST().draft.draftData.sports.sports.find(e => e.sportId === 'gym').role === 'primary');
ok('vorherige primary (running) → secondary', ST().draft.draftData.sports.sports.find(e => e.sportId === 'running').role === 'secondary');

// 43) M5b: Ebene-B-Einstellungen (Modus/Sichtbarkeit/Priorität) sind NICHT mehr im Essential —
// vorhandene Werte müssen den Schritt aber VERLUSTFREI überleben (Adversarial: kein stilles Zurücksetzen).
h = await fresh(sportsSeed({ sports: [{ sportId: 'running', role: 'primary', level: 'beginner', sessionsPerWeek: 2 }, { sportId: 'cycling', role: 'occasional', visible: false }] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('keine Ebene-B-Controls im Essential', !h.byId('vis-cycling') && !h.byId('mode-occ-cycling') && (card(h).innerHTML || '').indexOf('role="switch"') < 0);
h.byId('spc-gym')._ev.click({ preventDefault() {} });   // unabhängige Änderung + Re-Render + Persist
await wait();
const _cyc = SP().find(e => e.sportId === 'cycling');
ok('cycling: occasional + unsichtbar überlebt Roundtrip', _cyc.role === 'occasional' && _cyc.visible === false && _cyc.planningEnabled === false);
const _run43 = SP().find(e => e.sportId === 'running');
ok('primary level/sessionsPerWeek überleben Roundtrip', _run43.level === 'beginner' && _run43.sessionsPerWeek === 2);

// 44) Leere Auswahl blockiert Weiter + Fehler + Fokus
h = await fresh(sportsSeed({ sports: [] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.reg.get('#ob2-next').onclick();
ok('leere Auswahl: bleibt auf sports', ST().draft.currentStep === 'sports');
ok('leere Auswahl: Fehler sichtbar', (card(h).innerHTML || '').indexOf('mindestens eine Sportart') >= 0);
ok('leere Auswahl: Fokus erste Karte', h.byId('spc-running') && h.byId('spc-running')._focused === true);

// 45) Valide Auswahl → weiter zu training_level (M5b); Autosave speichert Auswahl
h = await fresh(sportsSeed({ sports: [{ sportId: 'running', role: 'primary' }] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ST().lastNav = 0; h.reg.get('#ob2-next').onclick();
ok('valide Sports: weiter zu training_level', ST().draft.currentStep === 'training_level');
ok('Sports in completedSteps', ST().draft.completedSteps.indexOf('sports') >= 0);
ok('Auswahl persistiert', JSON.parse(h.mem[Store.key(null)]).draftData.sports.sports.length === 1);

// 46) Toggle deterministisch: Karte wählt aus (Kit re-rendert je Klick)
h = await fresh(sportsSeed({ sports: [] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.byId('spc-running')._ev.click({ preventDefault() {} });
await wait();
ok('Karte toggelt zu ausgewählt', SP().some(e => e.sportId === 'running'));

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
// 52) other: nie Hauptsport, planningEnabled bleibt false; keine Ebene-B-Controls im Essential
h = await fresh(sportsSeed({ sports: [{ sportId: 'running', role: 'primary' }, { sportId: 'other', role: 'secondary' }] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('other: nicht in Hauptsport-Auswahl', !h.byId('prc-other'));
ok('other: planningEnabled bleibt false', SP().find(e => e.sportId === 'other').planningEnabled === false);
ok('other: keine Modus-/Sichtbar-Controls', !h.byId('mode-planned-other') && !h.byId('mode-occ-other') && !h.byId('vis-other'));
// 53) M5b: Prioritäten (Ebene B) überleben den Essential-Schritt + Reload verlustfrei
h = await fresh(sportsSeed({ sports: [{ sportId: 'running', role: 'primary' }, { sportId: 'cycling', role: 'secondary', planningEnabled: true, priority: 2 }, { sportId: 'gym', role: 'secondary', planningEnabled: true, priority: 3 }] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.byId('spc-padel')._ev.click({ preventDefault() {} });   // unabhängige Auswahl → Re-Render + Persist
await wait();
ok('bestehende Prioritäten unangetastet (cycling 2, gym 3)', SP().find(e => e.sportId === 'cycling').priority === 2 && SP().find(e => e.sportId === 'gym').priority === 3);
ok('Hauptsport bleibt Priorität 1', SP().find(e => e.role === 'primary').priority === 1);
ok('Sortierung persistiert', JSON.parse(h.mem[Store.key(null)]).draftData.sports.sports.find(e => e.sportId === 'gym').priority === 3);
// 53b) Reload erhält Sortierung
let savedMem = h.mem[Store.key(null)];
h = await fresh({ [Store.key(null)]: savedMem });
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Reload erhält Sortierung (gym Priorität 3)', SP().find(e => e.sportId === 'gym').priority === 3);
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

/* ===== UX-Durchlauf (M5b Essential): dynamische Hauptsport-Liste, Save-Verhalten, sticky Nav ===== */
// 57) Hauptsport-Liste enthält ALLE ausgewählten planbaren Sportarten (keine feste Vierer-Liste)
h = await fresh(sportsSeed({ sports: [{ sportId: 'running', role: 'primary' }, { sportId: 'gym', role: 'secondary' }, { sportId: 'football', role: 'secondary' }, { sportId: 'triathlon', role: 'secondary' }, { sportId: 'tennis', role: 'secondary' }] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Hauptsport: running/gym/football/triathlon/tennis wählbar', !!h.byId('prc-running') && !!h.byId('prc-gym') && !!h.byId('prc-football') && !!h.byId('prc-triathlon') && !!h.byId('prc-tennis'));
h.byId('prc-football')._ev.click({ preventDefault() {} });
await wait();
ok('Fußball als Hauptsport setzbar', SP().find(e => e.sportId === 'football').role === 'primary');
// 58) nicht ausgewählte Sportart erscheint nicht als Hauptsport-Option
ok('nicht gewähltes padel nicht als Hauptsport-Option', !h.byId('prc-padel'));
// 59) Ein Toggle = genau ein Save; Handler nach Re-Render weiterhin aktiv (Abwahl wirkt)
h = await fresh(sportsSeed({ sports: [{ sportId: 'running', role: 'primary' }] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
let savesBefore = h.saves();
h.byId('spc-cycling')._ev.click({ preventDefault() {} });
await wait();
ok('ein Toggle = ein Save', h.saves() - savesBefore === 1);
h.byId('spc-cycling')._ev.click({ preventDefault() {} });
await wait();
ok('Handler nach Re-Render aktiv (Abwahl wirkt)', !SP().some(e => e.sportId === 'cycling'));
// 64) sticky Navigation vorhanden + Weiter erreichbar
ok('sticky Nav-Wrapper vorhanden', (card(h).innerHTML || '').indexOf('ob2-navwrap') >= 0 && !!h.byId('ob2-next'));
// 65) keine doppelte ID im gerenderten HTML
(function () { var html = card(h).innerHTML || ''; var re = /id="([^"]+)"/g, m, seen = {}, dup = false; while ((m = re.exec(html))) { if (seen[m[1]]) dup = true; seen[m[1]] = true; } ok('keine doppelte ID im HTML', dup === false); })();
// 66) Essential-Texte: Auswahlfrage + Hauptsport-Frage
ok('Auswahlfrage vorhanden', (card(h).innerHTML || '').indexOf('Welche Sportarten machst du?') >= 0);
ok('Hauptsport-Frage vorhanden', (card(h).innerHTML || '').indexOf('Hauptsport') >= 0);
// 67) bestehender Draft mit Triathlon-Primary korrekt gerendert (Kit-Karte trägt aria-pressed)
h = await fresh(sportsSeed({ sports: [{ sportId: 'triathlon', role: 'primary' }, { sportId: 'running', role: 'secondary', planningEnabled: true }] }));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Triathlon-Primary gerendert', SP().find(e => e.role === 'primary').sportId === 'triathlon' && h.byId('prc-triathlon') && h.byId('prc-triathlon').getAttribute('aria-pressed') === 'true');

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
