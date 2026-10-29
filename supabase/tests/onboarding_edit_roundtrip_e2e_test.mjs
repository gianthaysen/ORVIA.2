/* ============================================================
   ORVIA · R1–R8 (2026-10-29) — „Profil bearbeiten" ist verlustfrei (echte App, Playwright)
   ------------------------------------------------------------
   BEFUND (Messung 29.10.): Einrichtung im Bearbeiten-Modus durchklicken und speichern veraenderte
   das Profil — Gym-Haeufigkeit geloescht, Laufen 3→4, Bestaetigung der Beschwerdefrage neu
   gestempelt, Geschlecht als „Keine Angabe" gezeigt; mit altem Entwurf zusaetzlich ein Ziel geloescht.

     A  ohne alten Entwurf: durchklicken + speichern → alle 15 Felder identisch
     B  mit altem Ersteinrichtungs-Entwurf (1 Ziel), danach 2. Ziel im Profil → identisch
     C  gezielte Aenderungen kommen an, Rest bleibt: Laufen 5–6×, Beschwerde „Nein" → Knie abgeklungen
     U  Vorbelegung sichtbar: Geschlecht, Beschwerde, genau EIN Dialog, Knopf „Änderungen speichern"
   Kein Feld wird vom Test nachgetragen: bleibt ein Schritt haengen, ist der Test rot.
   Ohne Playwright: uebersprungen (Exit 2), nie „bestanden".
   node supabase/tests/onboarding_edit_roundtrip_e2e_test.mjs
   ============================================================ */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.APPROOT || [path.join(HERE, '..', '..', 'app'), path.join(HERE, '..', '..')].find(p => fs.existsSync(path.join(p, 'index.html')) && fs.existsSync(path.join(p, 'js', 'onboarding')));
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('⏭️  ÜBERSPRUNGEN — Playwright fehlt; Bearbeiten-Rundlauf NICHT geprueft'); process.exit(2); }
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, path.normalize(p));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
let browser; try { browser = await chromium.launch(); } catch (e) { console.log('⏭️  ÜBERSPRUNGEN — Chromium startet nicht: ' + e.message.split('\n')[0]); server.close(); process.exit(2); }
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
await ctx.route('**supabase.co/**', r => r.abort()); await ctx.route('**fonts.g*/**', r => r.abort());
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' }); await page.waitForTimeout(1200);
/* einzige Test-Intervention: Auth-Gate oeffnen (App ist ohne Supabase fail-closed) */
await page.evaluate(() => { document.documentElement.classList.remove('orvia-gated'); document.querySelectorAll('.orvia-gate').forEach(e => e.remove()); });

const FIELDS = ['name', 'birthDate', 'ageEstimate', 'sex', 'heightCm', 'weightKg', 'sports', 'goals', 'availability', 'constraintsList', 'constraintsAcknowledgedAt', 'preferences', 'performance', 'recovery', 'riskTolerance'];
const seedProfile = extraGoal => page.evaluate(({ FIELDS, extraGoal }) => {
  const M = window.ORVIA.profileModel; const now = '2026-10-01T10:00:00.000Z';
  const P = Object.assign({}, window.PROFILE || {});
  Object.assign(P, { name: 'Lena', birthDate: '1998-04-17', ageEstimate: null, sex: 'f', heightCm: 168, weightKg: 61.5 });
  P.sports = M.normalizeSports([{ sportId: 'running', role: 'primary', level: 'intermediate', sessionsPerWeek: 3, typicalDuration: 45, includeInPlan: true, activeInApp: true },
                                { sportId: 'gym', role: 'secondary', includeInPlan: true, activeInApp: true, sessionsPerWeek: 2, preferredDays: ['di'] }]);
  const goals = [{ title: 'HM unter 2:00', category: 'half_marathon', targetValue: 7200, metricType: 'time', unit: 's', targetDate: '2027-04-12', priority: 1, status: 'active' }];
  if (extraGoal) goals.push({ title: 'Kniebeuge 80 kg', category: 'muscle_gain', priority: 2, status: 'active' });
  P.goals = M.normalizeGoals(goals);
  P.availability = M.normalizeAvailability({ days: { mo: { available: true }, mi: { available: true }, sa: { available: true } }, sessionDurationMin: 60 });
  P.constraintsList = [M.normalizeConstraint({ bodyRegion: 'knee', side: 'left', intensity: 3, status: 'active' }, now)];
  P.constraintsAcknowledgedAt = now;
  P.preferences = M.normalizePreferences ? M.normalizePreferences({ riskTolerance: 'balanced' }) : { riskTolerance: 'balanced' }; P.riskTolerance = 'balanced';
  P.performance = { personalBests: [M.normalizePersonalBest({ sportId: 'running', distance: '5 km', discipline: '5 km', timeSeconds: 1590, context: 'race' })], tests: [] };
  P.recovery = M.normalizeRecovery({ sleep: { averageHours: 7 } });
  window.PROFILE = P; window.saveProfile();
  const snap = {}; FIELDS.forEach(k => snap[k] = P[k] === undefined ? null : JSON.parse(JSON.stringify(P[k]))); return snap;
}, { FIELDS, extraGoal });
const clearDraft = () => page.evaluate(() => { document.querySelectorAll('.ob2-bg').forEach(e => e.remove()); document.documentElement.classList.remove('ob2-open');
  Object.keys(localStorage).filter(k => /onboard/i.test(k) && !/pending/.test(k)).forEach(k => localStorage.removeItem(k)); try { window.ORVIA.onboardingV2._reset(); } catch (e) {} });
const step = () => page.evaluate(() => { const S = window.ORVIA.onboardingV2._state; return S.draft && S.draft.currentStep; });
const click = id => page.evaluate(id => { const b = document.getElementById(id); if (b) { b.click(); return true; } return false; }, id);

/* Klickt die Einrichtung durch; actions[step] wird vor „Weiter" ausgefuehrt. Nichts wird nachgetragen. */
async function walk({ finish, actions = {} }) {
  await page.evaluate(() => window.ORVIA.openProfileEditor()); await page.waitForTimeout(500);
  const info = { layers: await page.evaluate(() => document.querySelectorAll('.ob2-bg').length), seen: [], stuck: null };
  for (let i = 0; i < 14; i++) {
    const st = await step(); info.seen.push(st);
    if (actions[st]) { await actions[st](); await page.waitForTimeout(250); }
    if (await page.$('#ob2-finish')) {
      info.finishLabel = await page.evaluate(() => document.getElementById('ob2-finish').innerText.trim());
      info.ui = await page.evaluate(() => { const d = window.ORVIA.onboardingV2._state.draft.draftData; return { sex: d.profile && d.profile.sex, safety: d.safety || null }; });
      if (finish) await click('ob2-finish'); else await click('ob2-later');
      await page.waitForTimeout(finish ? 1500 : 400); return info;
    }
    if (!(await click('ob2-next'))) { info.stuck = st + ' (kein Weiter)'; return info; }
    await page.waitForTimeout(350);
    if ((await step()) === st) { info.stuck = st + ': ' + (await page.evaluate(() => [...document.querySelectorAll('.ob2-err')].map(e => e.innerText).filter(Boolean).join(' / '))); return info; }
  }
  return info;
}
const after = () => page.evaluate(FIELDS => { const P = JSON.parse(localStorage.getItem('orvia_profile_v1') || '{}'); const o = {}; FIELDS.forEach(k => o[k] = P[k] === undefined ? null : P[k]); return o; }, FIELDS);
const PICK = { sports: s => (s || []).map(x => [x.sportId, x.role, x.level, x.sessionsPerWeek, x.typicalDuration, x.includeInPlan, x.activeInApp, (x.preferredDays || []).join('+')].join('/')).sort(),
  goals: g => (g || []).map(x => [x.title, x.category, x.targetValue, x.targetDate, x.priority].join('/')).sort(),
  constraintsList: c => (c || []).map(x => [x.id, x.bodyRegion, x.side, x.intensity, x.status].join('/')),
  performance: p => ((p && p.personalBests) || []).map(x => [x.distance, x.timeSeconds].join('/')) };
const diff = (a, b, skip = []) => Object.keys(a).filter(k => !skip.includes(k)).map(k => { const f = PICK[k] || (v => v); const x = JSON.stringify(f(a[k])), y = JSON.stringify(f(b[k])); return x === y ? null : k + ': ' + x.slice(0, 110) + ' → ' + y.slice(0, 110); }).filter(Boolean);

/* ---------- A ---------- */
await clearDraft(); let vorher = await seedProfile(true); let w = await walk({ finish: true }); let d = diff(vorher, await after());
ok('A1 Durchklicken ohne haengenbleibenden Schritt (nichts nachgetragen)', !w.stuck, w.stuck || w.seen.join('>'));
ok('A2 Speichern ohne Aenderung → alle 15 Felder identisch', d.length === 0, d.join(' | '));
ok('U1 genau EIN Einrichtungsdialog', w.layers === 1, 'Ebenen ' + w.layers);
ok('U2 Geschlecht „f" wird als weiblich vorbelegt (nicht „Keine Angabe")', w.ui && w.ui.sex === 'female', w.ui && w.ui.sex);
ok('U3 aktive Knie-Beschwerde ist als „Ja" vorbelegt', !!(w.ui && w.ui.safety && w.ui.safety.hasComplaints === true && w.ui.safety.constraint.bodyRegion === 'knee' && w.ui.safety.constraint.intensity === 3));
ok('U4 Abschlussknopf heisst im Bearbeiten-Modus „Änderungen speichern"', w.finishLabel === 'Änderungen speichern', w.finishLabel);

/* ---------- B ---------- */
await clearDraft(); await seedProfile(false); await walk({ finish: false });   // alter Entwurf mit 1 Ziel bleibt liegen
const hatEntwurf = await page.evaluate(() => Object.keys(localStorage).some(k => /onboard/i.test(k) && !/pending/.test(k)));
ok('B0 Vorbedingung: alter Entwurf liegt vor', hatEntwurf);
vorher = await seedProfile(true); w = await walk({ finish: true }); d = diff(vorher, await after());
ok('B1 mit altem Entwurf: Durchklicken ohne Haenger', !w.stuck, w.stuck || '');
ok('B2 mit altem Entwurf: alle 15 Felder identisch (spaeter angelegtes Ziel bleibt)', d.length === 0, d.join(' | '));

/* ---------- C · gezielte Aenderungen ---------- */
await clearDraft(); vorher = await seedProfile(true);
w = await walk({ finish: true, actions: { training_level: () => click('band-5-6'), safety: () => click('safety-no') } });
const nachC = await after(); d = diff(vorher, nachC, ['sports', 'constraintsList', 'constraintsAcknowledgedAt']);
const run = (nachC.sports || []).find(s => s.sportId === 'running'), gym = (nachC.sports || []).find(s => s.sportId === 'gym');
ok('C1 Laufen 5–6× gespeichert (6)', run && run.sessionsPerWeek === 6, run && run.sessionsPerWeek);
ok('C2 Gym unveraendert (2×, Dienstag, im Plan)', gym && gym.sessionsPerWeek === 2 && (gym.preferredDays || []).join() === 'di' && gym.includeInPlan === true, JSON.stringify(gym).slice(0, 120));
ok('C3 „Keine Beschwerden" → Knie-Eintrag abgeklungen, nicht geloescht, nicht verdoppelt', (nachC.constraintsList || []).length === 1 && nachC.constraintsList[0].status === 'resolved' && nachC.constraintsList[0].id === vorher.constraintsList[0].id);
ok('C4 geaenderte Antwort → Bestaetigung neu gestempelt', nachC.constraintsAcknowledgedAt && nachC.constraintsAcknowledgedAt !== vorher.constraintsAcknowledgedAt);
ok('C5 alles andere identisch', d.length === 0, d.join(' | '));

ok('E1 keine Seitenfehler', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close(); server.close();
console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
