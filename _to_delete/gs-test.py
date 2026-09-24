p='supabase/tests/goal_shadow_test.mjs'; s=open(p,encoding='utf-8').read()
anchor="console.log('\\n' + '═'.repeat(62) + '\\nErgebnis: '"
assert anchor in s
new = r'''/* F · 'session' (@2, 12.09.2026): Laufzeit-Beleg ohne Zielmutation. Acht Tage Flag-Betrieb
   ohne Bearbeitung ergaben NULL Zeilen — deshalb ein Ereignis je Geraet und Kalendertag. */
console.log('\nF · session-Ereignis');
{
  ok('F1 Modulversion @2 (Typenliste erweitert)', GS.VERSION === 'goal-shadow@2', GS.VERSION);
  ok('F2 TYPES enthaelt session — und die vier alten unveraendert',
    ['add', 'update', 'remove', 'status', 'session'].every(t => GS.TYPES.indexOf(t) >= 0) && GS.TYPES.length === 5);
  const b = GS.buildRecord({ eventType: 'session', eventId: 'gs_f', now: '2026-09-12T08:00:00.000Z',
    mainGoal: { id: 'a', category: 'half_marathon', targetDate: '2026-11-01', targetValue: 6600 },
    legacyGoal: { _canonicalId: 'a', type: 'halfmarathon', raceDate: '2026-11-01', targetMin: 110 }, activeGoalCount: 1, gcat });
  ok('F3 session-Ereignis ist gueltig und vergleicht wie die anderen (hier: kein Widerspruch)', b.valid && b.record.contradiction === false, (b.errors || []).join(','));
  const MIG = join(REPO, 'supabase/migrations/0043_goal_shadow_session.sql');
  ok('F4 Migration 0043 erweitert den CHECK um session', existsSync(MIG) && /check \(event_type in \('add','update','remove','status','session'\)\)/.test(readFileSync(MIG, 'utf8')));
  const PROF = ['app/js/profile.js', 'js/profile.js'].map(p => join(REPO, p)).find(existsSync);
  const src = readFileSync(PROF, 'utf8');
  ok('F5 profile.js: _goalShadowSession haengt an orvia:auth-ready, per setTimeout (nicht im Login-Pfad)',
    /addEventListener\('orvia:auth-ready',function\(\)\{setTimeout\(_goalShadowSession,\d+\);\}\)/.test(src));
  /* Verhalten: einmal je Kalendertag je Geraet — im vm-Sandbox mit localStorage-Stub. */
  const vm = await import('node:vm');
  const store = {}; const notes = [];
  const sb = { window: null, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, Date, _goalShadowNote: e => notes.push(e) };
  sb.window = sb; vm.createContext(sb);
  const fn = src.slice(src.indexOf('function _goalShadowSession()'), src.indexOf('function _goalShadowId()'));
  vm.runInContext(fn.replace(/try\{window\.addEventListener[^\n]*\n/, '') + '\n;this._r1=_goalShadowSession();this._r2=_goalShadowSession();', sb);
  ok('F6 erster Aufruf am Tag meldet session, zweiter nicht', sb._r1 === true && sb._r2 === false && notes.length === 1 && notes[0] === 'session');
  store.orvia_gs_session_day = '2000-01-01';
  vm.runInContext('this._r3=_goalShadowSession();', sb);
  ok('F7 neuer Kalendertag ⇒ erneut genau ein Ereignis', sb._r3 === true && notes.length === 2);
}

'''
s=s.replace(anchor, new+anchor)
open(p,'w',encoding='utf-8').write(s)
