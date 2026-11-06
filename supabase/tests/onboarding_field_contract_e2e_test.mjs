/* ============================================================
   ORVIA · Feldvertrag Einrichtung → Profil → Leser (echte App, Playwright) — v8-462
   ------------------------------------------------------------
   Frage: Kommt jede Angabe aus der Einrichtung dort an, wo Planer, Tagesentscheidung
   und Profilstärke sie lesen? Gemessen am ECHTEN Abschluss (Knopf „Profil erstellen")
   mit einem vollständig ausgefüllten Entwurf, danach über die echten Leser:
     P  Profilfelder nach dem Abschluss (Name, Geburtsdatum, Alter, Geschlecht m/f/d,
        Größe, Gewicht, Sportarten inkl. Niveau/Häufigkeit/Dauer/Plan, Ziel, Verfügbarkeit,
        Beschwerde, Bestzeit, Risikobereitschaft)
     L  Leser: Profilstärke (ORVIA.profileInputs) meldet „vorhanden" statt „fehlt",
        Wochenplaner (planEngineV2.build) braucht keine Ersatzannahme, HFmax-Schätzung aus Alter
   Der Entwurf wird gesetzt, nicht getippt — die Eingabefelder selbst prüfen die
   Onboarding-Tests; hier geht es um den Weg danach. Ohne Playwright: übersprungen (Exit 2).
   node supabase/tests/onboarding_field_contract_e2e_test.mjs
   ============================================================ */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.APPROOT || [path.join(HERE, '..', '..', 'app'), path.join(HERE, '..', '..')].find(p => fs.existsSync(path.join(p, 'index.html')) && fs.existsSync(path.join(p, 'js', 'onboarding')));
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('⏭️  ÜBERSPRUNGEN — Playwright fehlt; Feldvertrag NICHT geprueft'); process.exit(2); }
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, path.normalize(p));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
let browser; try { browser = await chromium.launch(); } catch (e) { console.log('⏭️  ÜBERSPRUNGEN — Chromium startet nicht'); server.close(); process.exit(2); }
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
await ctx.route('**supabase.co/**', r => r.abort()); await ctx.route('**fonts.g*/**', r => r.abort());
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' }); await page.waitForTimeout(1200);
await page.evaluate(() => { document.documentElement.classList.remove('orvia-gated'); document.querySelectorAll('.orvia-gate').forEach(e => e.remove()); });

/* leeres Profil, dann Einrichtung mit vollständigem Entwurf */
await page.evaluate(() => {
  const M = window.ORVIA.profileModel;
  window.PROFILE = Object.assign({}, window.PROFILE || {}, { name: '', birthDate: '', ageEstimate: null, age: null, sex: '', heightCm: null, weightKg: null, sports: [], goals: [], constraintsList: [], constraintsAcknowledgedAt: null, availability: M.normalizeAvailability({}), performance: { personalBests: [], tests: [] }, preferences: {}, riskTolerance: null });
  window.saveProfile();
  Object.keys(localStorage).filter(k => /onboard/i.test(k) && !/pending/.test(k)).forEach(k => localStorage.removeItem(k));
  try { window.ORVIA.onboardingV2._reset(); } catch (e) {}
  window.ORVIA.openProfileEditor();
  const S = window.ORVIA.onboardingV2._state;
  S.draft.draftData = {
    profile: { displayName: 'Lena', birthDate: '1998-04-17', sex: 'female', heightCm: 168, weightKg: 61.5, unitSystem: 'metric' },
    sports: { sports: [{ sportId: 'running', role: 'primary', enabled: true, visible: true, planningEnabled: true, level: 'intermediate', sessionsPerWeek: 4, typicalDuration: 45 },
                       { sportId: 'gym', role: 'secondary', enabled: true, visible: true, planningEnabled: true, level: 'beginner', sessionsPerWeek: 2, typicalDuration: 60 }] },
    goals: M.normalizeGoals([{ title: 'HM unter 1:50', category: 'half_marathon', targetValue: 6600, metricType: 'time', unit: 's', targetDate: '2027-04-12', priority: 1, status: 'active' }]),
    availability: M.normalizeAvailability({ days: { mo: { available: true, singleSession: { maxMinutes: 60 } }, mi: { available: true, singleSession: { maxMinutes: 60 } }, fr: { available: true, singleSession: { maxMinutes: 45 } }, sa: { available: true, singleSession: { maxMinutes: 90 } }, di: { available: false }, do: { available: false }, so: { available: false, restDay: true } } }),
    safety: { hasComplaints: true, constraint: { bodyRegion: 'knee', side: 'left', intensity: 3 } },
    performance: { distance: '5 km', timeText: '26:30', context: 'race', measuredAt: '2026-10-11' },
    preferences: { riskTolerance: 'balanced' }
  };
  S.seed = null;   // Einrichtungs-Antworten gelten als neu (wie bei der Ersteinrichtung)
  window.ORVIA.onboardingV2._editStep('profile');   // Formular mit dem Entwurf neu zeichnen
});
await page.waitForTimeout(400);
let stuck = null;
for (let i = 0; i < 14; i++) {
  if (await page.$('#ob2-finish')) { await page.evaluate(() => document.getElementById('ob2-finish').click()); await page.waitForTimeout(1500); break; }
  const st = await page.evaluate(() => window.ORVIA.onboardingV2._state.draft.currentStep);
  await page.evaluate(() => { const b = document.getElementById('ob2-next'); if (b) b.click(); }); await page.waitForTimeout(350);
  if ((await page.evaluate(() => window.ORVIA.onboardingV2._state.draft && window.ORVIA.onboardingV2._state.draft.currentStep)) === st) { stuck = st + ': ' + await page.evaluate(() => [...document.querySelectorAll('.ob2-err')].map(e => e.innerText).filter(Boolean).join(' / ')); break; }
}
ok('S1 Einrichtung mit vollständigem Entwurf bis zum Abschluss', !stuck, stuck || '');

const R = await page.evaluate(() => {
  const P = JSON.parse(localStorage.getItem('orvia_profile_v1') || '{}');
  const live = window.PROFILE || {};
  const ev = window.ORVIA.profileInputs.evaluate(gmProfInputsCtx());
  const st = {}; ev.rows ? ev.rows.forEach(r => { st[r.id] = r.state; }) : Object.keys(ev.groups || {}).forEach(g => ev.groups[g].forEach(r => { st[r.id] = r.state; }));
  const plan = window.ORVIA.planEngineV2.build({ sports: P.sports, availability: P.availability, goal: (P.goals || [])[0], today: new Date('2026-11-06T10:00:00') });
  return { P, age: live.age, st, plan: { missing: plan.missing || null, sessions: plan.volumeSummary && plan.volumeSummary.sessions, conf: plan.confidence, reasons: (plan.reasons || []).map(r => r.code || r.id || r.key).filter(Boolean) } };
});
const P = R.P, run = (P.sports || []).find(s => s.sportId === 'running'), gym = (P.sports || []).find(s => s.sportId === 'gym');
ok('P1 Name, Geburtsdatum, Größe, Gewicht gespeichert', P.name === 'Lena' && P.birthDate === '1998-04-17' && P.heightCm === 168 && P.weightKg === 61.5, JSON.stringify([P.name, P.birthDate, P.heightCm, P.weightKg]));
ok('P2 Geschlecht als App-Code „f" (Grundumsatz/Zyklus lesen „f")', P.sex === 'f', P.sex);
ok('P3 Alter wird aus dem Geburtsdatum abgeleitet (HFmax-Schätzung, Energiebedarf)', typeof R.age === 'number' && R.age >= 27 && R.age <= 29, String(R.age));
ok('P4 Laufen: Hauptsportart, Niveau, 4×, 45 min, im Plan', run && run.role === 'primary' && run.level === 'intermediate' && run.sessionsPerWeek === 4 && run.typicalDuration === 45 && run.includeInPlan === true, String(JSON.stringify(run)).slice(0, 160));
ok('P5 Gym: Nebensportart, Anfänger, 2×, 60 min', gym && gym.role === 'secondary' && gym.level === 'beginner' && gym.sessionsPerWeek === 2 && gym.typicalDuration === 60, String(JSON.stringify(gym)).slice(0, 160));
ok('P6 Ziel mit Datum und Zielzeit', (P.goals || []).length === 1 && P.goals[0].targetDate === '2027-04-12' && P.goals[0].targetValue === 6600);
const avd = Object.keys((P.availability && P.availability.days) || {}).filter(k => P.availability.days[k] && P.availability.days[k].available);
ok('P7 Verfügbarkeit: Mo/Mi/Fr/Sa', avd.sort().join() === ['fr', 'mi', 'mo', 'sa'].join(), avd.join());
ok('P8 Beschwerde Knie links, Stärke 3, aktiv + Bestätigung gestempelt', (P.constraintsList || []).length === 1 && P.constraintsList[0].bodyRegion === 'knee' && P.constraintsList[0].intensity === 3 && P.constraintsList[0].status === 'active' && !!P.constraintsAcknowledgedAt);
ok('P9 Bestzeit 5 km 26:30 mit Datum', ((P.performance && P.performance.personalBests) || []).some(b => b.distance === '5 km' && b.timeSeconds === 1590 && b.measuredAt === '2026-10-11'));
/* Hinweis (dokumentiert, kein Fehler): ohne Datum gilt eine Einrichtungs-Bestzeit nur als
   informativ (performance_ref = estimated) und steuert keine Zonen. */
ok('P10 Risikobereitschaft in preferences UND als Spiegel', P.preferences && P.preferences.riskTolerance === 'balanced' && P.riskTolerance === 'balanced');
for (const id of ['goal_date', 'goal_target', 'training_days', 'level_volume', 'birth', 'weight', 'constraints', 'risk', 'performance_ref'])
  ok('L ' + id + ': Profilstärke meldet „vorhanden"', R.st[id] === 'present', R.st[id]);
ok('L hfmax: aus dem Alter geschätzt (nicht „fehlt")', R.st.hfmax === 'estimated', R.st.hfmax);
ok('L Wochenplaner: keine Ersatzannahme für Einheiten/Woche, 4 Einheiten', !(R.plan.missing || []).includes('sessionsPerWeek') && R.plan.sessions >= 4, JSON.stringify(R.plan));
ok('E1 keine Seitenfehler', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close(); server.close();
console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
