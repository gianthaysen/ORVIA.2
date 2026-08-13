/* ============================================================
   ORVIA · P8 — Quick-Add-Favoriten + Aktionskatalog.
   Verträge:
   - Klassifikation frequency daily/occasional/setup; goal_add/appointment_add
     sind setup und NICHT in den Default-Favoriten.
   - composeQuickMenu (pur): Kontext-Overlay max 2 (Training läuft dominiert,
     Check-in nach Tageszeit, Beschwerde/Profil), Favoriten in Nutzer-Reihenfolge
     ohne Kontext-Dubletten, Rest unter „Alle Aktionen" (ohne context-Aktionen).
   - Favoriten: max 6, user-scoped persistiert, Reload-stabil, unbekannte/
     context-IDs werden verworfen, Fallback = Defaults.
   - Routinen-Entry-Point existiert und ist auflösbar.
   node supabase/tests/quick_add_p8_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL(_APPREL + 'js/', import.meta.url);

function makeQA(store, userId) {
  store = store || {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb; sb.console = console;
  sb.Date = Date; sb.JSON = JSON; sb.Math = Math; sb.Array = Array; sb.Object = Object; sb.parseInt = parseInt;
  sb.setTimeout = fn => fn();
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb.document = { getElementById: () => null, querySelectorAll: () => [] };
  sb.navigator = { onLine: true };
  sb.ORVIA = { user: userId ? { id: userId } : null };
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('quick-actions.js', base), 'utf8'), sb, { filename: 'quick-actions.js' });
  return { qa: sb.ORVIA.quickActions, store };
}

/* ---------- 1) Klassifikation + Defaults ---------- */
{
  const { qa } = makeQA();
  ok('C1 jede Aktion trägt frequency', qa.ACTIONS.every(a => ['daily', 'occasional', 'setup'].indexOf(a.frequency) >= 0));
  const byId = {}; qa.ACTIONS.forEach(a => { byId[a.id] = a; });
  ok('C2 goal_add/appointment_add/profile_complete = setup', byId.goal_add.frequency === 'setup' && byId.appointment_add.frequency === 'setup' && byId.profile_complete.frequency === 'setup');
  ok('C3 Defaults ohne setup-Aktionen', qa.DEFAULT_FAVORITES.every(id => byId[id].frequency !== 'setup'));
  ok('C4 Defaults max 6', qa.DEFAULT_FAVORITES.length <= 6 && qa.MAX_FAVORITES === 6);
  ok('C5 Routinen-Aktion existiert + Entry-Point auflösbar', !!byId.routines_check && typeof qa.gotoRoutines === 'function' && qa.resolveEntryPoint('orvia:quickActions.gotoRoutines') === qa.gotoRoutines);
}

/* ---------- 2) composeQuickMenu (pur) ---------- */
{
  const { qa } = makeQA();
  const favs = ['activity_log', 'weight_update', 'training_start'];
  const m1 = qa.composeQuickMenu({ hour: 8, morningDone: false, activeWorkout: false }, favs, qa.ACTIONS);
  ok('M1 morgens: Morgen-Check-in im Kontext', m1.context.some(a => a.id === 'checkin_morning'));
  ok('M2 Favoriten in Nutzer-Reihenfolge', m1.favorites.map(a => a.id).join(',') === 'activity_log,weight_update,training_start');
  ok('M3 Kontext max 2', m1.context.length <= 2);
  const m2 = qa.composeQuickMenu({ hour: 8, morningDone: false, activeWorkout: true }, ['training_continue', 'checkin_morning'], qa.ACTIONS);
  ok('M4 laufendes Training dominiert Kontext', m2.context[0].id === 'training_continue');
  ok('M5 keine Dubletten Kontext↔Favoriten', m2.favorites.every(a => m2.context.indexOf(a) < 0 && a.id !== 'checkin_morning'));
  const m3 = qa.composeQuickMenu({ hour: 14, morningDone: true, eveningDone: true }, qa.DEFAULT_FAVORITES, qa.ACTIONS);
  ok('M6 „Alle Aktionen" enthält setup-Aktionen, keine context-Aktionen', m3.all.some(a => a.id === 'goal_add') && m3.all.every(a => a.category !== 'context'));
  ok('M7 nichts doppelt (context+favorites+all disjunkt)', (() => { const ids = m3.context.concat(m3.favorites, m3.all).map(a => a.id); return new Set(ids).size === ids.length; })());
}

/* ---------- 3) Persistenz (user-scoped, Reload-stabil) ---------- */
{
  const store = {};
  const a = makeQA(store, 'user-A');
  const saved = a.qa.setFavorites(['weight_update', 'activity_log', 'goal_add', 'training_start', 'checkin_morning', 'checkin_evening', 'complaint_log']);
  ok('P1 max 6 erzwungen', saved.length === 6);
  ok('P2 Reihenfolge persistiert (Reload)', makeQA(store, 'user-A').qa.getFavorites().join(',') === saved.join(','));
  ok('P3 user-scoped: Nutzer B bekommt Defaults', makeQA(store, 'user-B').qa.getFavorites().join(',') === a.qa.DEFAULT_FAVORITES.join(','));
  const b = makeQA(store, 'user-A');
  b.qa.setFavorites(['training_continue', 'kaputt', 'weight_update']);
  ok('P4 context-/unbekannte IDs verworfen', b.qa.getFavorites().join(',') === 'weight_update');
  store['orvia_qa_favs_user-A'] = '{kaputt';
  ok('P5 korrupter Storage ⇒ Defaults (kein Crash)', makeQA(store, 'user-A').qa.getFavorites().join(',') === a.qa.DEFAULT_FAVORITES.join(','));
}

/* ---------- 4) UI-Verträge ---------- */
{
  const src = readFileSync(new URL('quick-actions.js', base), 'utf8');
  ok('U1 Sheet mit „Deine Favoriten" + „Alle Aktionen"', /Deine Favoriten/.test(src) && /Alle Aktionen/.test(src));
  ok('U2 Favoriten-Verwaltung vorhanden (Toggle+Sortierung)', /openFavoritesManager/.test(src) && /data-mv/.test(src) && /data-add/.test(src));
  ok('U3 nur auflösbare Aktionen angezeigt (fail-soft bleibt)', /ACTIONS\.filter\(function \(a\) \{ return !!resolveEntryPoint/.test(src));
  const css = readFileSync(new URL('../styles.css', base), 'utf8');
  ok('U4 P8-Styles vorhanden', /qa-manage/.test(css) && /qa-fav-row/.test(css));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
