/* ORVIA · Batch 2 — onboarding-store (nur lokale Persistenz, localStorage-Stub). */
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const mem = {};
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
globalThis.ORVIA = {};
const L = (await import(new URL('../../js/onboarding/onboarding-logic.js', import.meta.url))).default;
const Store = (await import(new URL('../../js/onboarding/onboarding-store.js', import.meta.url))).default;

// user-spezifische Keys
ok('key(u1) ≠ key(anonymous)', Store.key('u1') !== Store.key(null));
ok('anonymer Key', Store.key(null) === 'orvia_onboarding_v2:anonymous');

// speichern + laden roundtrip
const d = L.advance(L.startDraft(L.newDraft(), 1), 2); // currentStep profile
Store.save('u1', d);
const loaded = Store.load('u1');
ok('load: nicht corrupt', loaded && loaded.corrupt === false);
ok('Reload-Wiederherstellung: currentStep erhalten', loaded.draft.currentStep === 'profile');

// anonymer Draft wird NICHT automatisch dem Nutzer zugeordnet
Store.clear('u2'); Store.save(null, L.newDraft());
ok('anonymer Draft ≠ User-Draft (load(u2) = null)', Store.load('u2') === null);

// beschädigtes JSON → corrupt + Backup
mem[Store.key('u3')] = '{ kaputt';
const c1 = Store.load('u3');
ok('beschädigtes JSON → corrupt', c1 && c1.corrupt === true && c1.draft === null);
ok('beschädigtes JSON → Backup archiviert', mem[Store.backupKey('u3')] === '{ kaputt');
ok('beschädigtes JSON → Original entfernt', !(Store.key('u3') in mem));

// falsche Version → corrupt (nicht als v2 verwenden)
mem[Store.key('u4')] = JSON.stringify({ version: 1, currentStep: 'welcome' });
ok('Version 1 → corrupt', Store.load('u4').corrupt === true);

// löschen
Store.save('u5', L.newDraft()); Store.clear('u5');
ok('clear entfernt Draft', Store.load('u5') === null);

// Ausnahmesicherheit: fehlende Logik
mem[Store.key('u6')] = JSON.stringify({ version: 2, currentStep: 'welcome' });
const realLogic = globalThis.ORVIA.onboardingV2Logic;
globalThis.ORVIA.onboardingV2Logic = undefined;
let threw6 = false, res6;
try { res6 = Store.load('u6'); } catch (e) { threw6 = true; }
ok('fehlende Logik: load wirft NICHT', threw6 === false);
ok('fehlende Logik: corrupt', res6 && res6.corrupt === true);
ok('fehlende Logik: archiviert', mem[Store.backupKey('u6')] != null);
ok('fehlende Logik: Original entfernt', !(Store.key('u6') in mem));
// nächstes Laden verarbeitet nicht erneut denselben Draft (Original ist weg → null)
globalThis.ORVIA.onboardingV2Logic = realLogic;
ok('fehlende Logik: nächstes Laden = null (nicht erneut verarbeitet)', Store.load('u6') === null);
globalThis.ORVIA.onboardingV2Logic = undefined;

// Ausnahmesicherheit: werfendes normalizeDraft
mem[Store.key('u7')] = JSON.stringify({ version: 2, currentStep: 'welcome' });
globalThis.ORVIA.onboardingV2Logic = { normalizeDraft: function () { throw new Error('boom'); } };
let threw7 = false, res7;
try { res7 = Store.load('u7'); } catch (e) { threw7 = true; }
ok('werfendes normalizeDraft: load wirft NICHT', threw7 === false);
ok('werfendes normalizeDraft: corrupt + archiviert', res7 && res7.corrupt === true && mem[Store.backupKey('u7')] != null);
globalThis.ORVIA.onboardingV2Logic = realLogic;

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
