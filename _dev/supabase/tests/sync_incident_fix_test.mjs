/* ============================================================
   ORVIA · Incident-Fix (v8-183) — Dauer-Merge-Dialog blockierte die App.
   Root Causes:
   (1) iOS killt den JS-Kontext beim Schließen oft VOR markRev → eigene Cloud-Daten
       galten beim nächsten Start als fremd (Rev-Ungleichheit) → Dialog bei jedem Start.
   (2) getSession + SIGNED_IN ließen onAuthed doppelt laufen → gestapelte Dialoge,
       deren Fullscreen-Backdrop Tabs blockierte (wirkte wie Freeze/Trägheit).
   Verträge:
   - sync.start: eigene device_id ⇒ NIE Dialog; Dialog nur bei fremdem Gerät UND
     remoteRev NUMERISCH > knownRev; Reentrancy-Guard; Singleton-Dialog mit
     Sofort-Feedback; select lädt device_id.
   - auth.onAuthed: Latch je Nutzer (kein Doppel-Init), Reset bei SIGNED_OUT.
   - showTab: Renderer einzeln gekapselt (kein inkonsistenter Tab-Zustand).
   - ui-refresh: 150 ms Debounce (Hydrations-Burst beim Start).
   node supabase/tests/sync_incident_fix_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../../app/js/', import.meta.url);

/* ---------- 1) sync.js — Dialog-Regel + Guards ---------- */
{
  const s = readFileSync(new URL('sync.js', base), 'utf8');
  ok('S1 device_id wird mitgeladen und verglichen', /select\('data,updated_at,device_id'\)/.test(s) && /remoteDevice === deviceId\(\)/.test(s));
  ok('S2 eigenes Gerät ⇒ nie Dialog', /!isOwnDevice && remoteRev > knownRev/.test(s));
  ok('S3 Rev-Vergleich NUMERISCH (> statt !==)', /remoteRev > knownRev/.test(s) && !/remoteRev !== knownRev/.test(s));
  ok('S4 start-Reentrancy-Guard (kein Doppel-Dialog)', /start\._busy/.test(s) && /_startInner/.test(s));
  /* GM7.6 Cloud-Autoload: der Merge-Dialog wurde durch automatisches Zusammenfuehren
     ersetzt; ein Dialog (syncErrorPrompt) erscheint nur noch bei echtem technischem
     Fehler. Das Singleton-/Sofort-Feedback-Prinzip aus dem Incident-Fix bleibt erhalten,
     nur am neuen, selteneren Dialog. */
  ok('S5 Dialog-Singleton (ersetzt statt stapelt)', /_orviaSyncErrModal\) \{ try \{ window\._orviaSyncErrModal\.remove/.test(s));
  ok('S6 Dialog nur bei echtem Fehler, kein Routine-Dialog mehr', /function syncErrorPrompt/.test(s) && /setState\('error', 'Sync-Fehler'\)/.test(s));
  ok('S7 markRev nach eigenem Push bleibt', /markRev\(snap\.savedAt\)/.test(s));
  ok('S8 Fremd-Owner-Schutz unverändert', /owner && owner !== u\.id/.test(s));
}

/* ---------- 2) auth.js — onAuthed-Latch ---------- */
{
  const a = readFileSync(new URL('auth.js', base), 'utf8');
  ok('A1 Latch je Nutzer vor Init', /onAuthed\._initFor === session\.user\.id\) return;/.test(a));
  ok('A2 Latch wird VOR den Sync-/Hydrations-Schritten gesetzt', a.indexOf('onAuthed._initFor = session.user.id') < a.indexOf('orviaSyncStart'));
  ok('A3 Latch-Reset bei SIGNED_OUT', /onAuthed\._initFor = null/.test(a));
}

/* ---------- 3) showTab-Härtung + Debounce ---------- */
{
  const ui = readFileSync(new URL('ui.js', base), 'utf8');
  const st = ui.split('function showTab')[1].split('\n}')[0];
  ok('T1 Renderer einzeln gekapselt (_safe)', /_safe\(renderDay\)/.test(st) && /_safe\(renderPlan\)/.test(st) && /_safe\(renderDash\)/.test(st));
  ok('T2 Panel-/Button-Wechsel VOR den Renderern (Zustand nie halb)', st.indexOf("classList.toggle('on'") < st.indexOf('_safe(renderDay)'));
  const ur = readFileSync(new URL('ui-refresh.js', base), 'utf8');
  ok('T3 ui-refresh mit 150ms-Debounce', /\}, 150\);/.test(ur));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
