/* ============================================================
   ORVIA · Batch 2f — Korrekturbatch:
   P  markPlannedDone FAIL CLOSED (kein Scheinerfolg, kein Überschreiben,
      idempotent über Occurrence-ID, Rollback bei Speicherfehler)
   Q  ECHTE offline-queue.js: Start- + Abschluss-Upsert derselben
      client_session_id durch Queue und Flush — Queue-INTEGRATIONSTEST mit
      IndexedDB-Shim + Supabase-Fake (ehrlich benannt: KEIN Live-E2E; die
      Live-Strecke ist batch2f_offline_queue_live_test — Node + benannte
      IndexedDB-Emulation + ECHTES Supabase, skippt ohne Supabase-ENV mit Exit 2)
   S  Migrationsevolution append-only: 0025 byte-eingefroren (ausgeführter
      Stand), Trigger/Konsistenzregel additiv in 0026
   node supabase/tests/batch2f_correctness_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');

/* ---------- P: markPlannedDone fail-closed (Punkt 2) ---------- */
{
  const planBlock = uiSrc.slice(0, uiSrc.indexOf('var PLAN_PRESETS'));
  const mpdBlock = (function (src) { const s = src.indexOf('function markPlannedDone'), e = src.indexOf('/* Wochenziele NICHT mehr aus festen Defaults'); return src.slice(s, e); })(uiSrc);
  function mkSb(opts) {
    opts = opts || {};
    const sb = {}; sb.window = sb; sb.globalThis = sb;
    sb.console = console; sb.Date = Date; sb.Math = Math; sb.Object = Object; sb.Array = Array;
    sb.String = String; sb.Number = Number; sb.Set = Set; sb.JSON = JSON;
    sb.todayStr = (d) => { const x = d || new Date('2026-07-15T12:00'); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    sb.goalOf = () => ({ type: 'half_marathon', raceDate: '2026-09-06' });
    sb.userLevel = () => 'fortgeschritten';
    sb.PROFILE = { sports: [{ sportId: 'running', activeInApp: true }], weekPlan: [[], [], [{ id: 'ps:tmplX', t: 'Laufen', l: 'Intervalle', d: 'iv' }], [], [], [], []], trainingDays: null, issues: [] };
    sb.ORVIA = { profileModel: { canonGoalCategory: t => t, effectiveTrainingConfig: () => ({ availableDayIdx: [0, 1, 2, 3, 4, 5, 6], targetDays: 1, daysSource: 'availability' }) } };
    sb.saveProfile = () => {};
    const DBv = {}; sb._DBv = DBv; sb.entry = (d) => (DBv[d] = DBv[d] || {});
    sb.toasts = []; sb.toast = (m) => sb.toasts.push(m);
    // Realer save()-Vertrag (data.js): true = persistiert, false = fehlgeschlagen, wirft nie.
    if (opts.saveMissing) { /* kein save definiert */ }
    else if (opts.saveThrows) sb.save = () => { throw new Error('quota'); };
    else if (opts.saveFalse) sb.save = () => { sb._saved = (sb._saved || 0) + 1; return false; };
    else sb.save = () => { sb._saved = (sb._saved || 0) + 1; return true; };
    sb.closeSupp = () => {}; sb.renderDay = () => {}; sb.renderWeekPlan = () => {};
    vm.createContext(sb);
    vm.runInContext(planBlock + '\n' + mpdBlock, sb, { filename: 'ui.js#mpd' });
    return sb;
  }
  const SUCCESS = /als erledigt markiert ✓/;
  // P1: leerer Slot ⇒ gespeichert + verifizierter Erfolg.
  const s1 = mkSb();
  const r1 = s1.markPlannedDone('Laufen', 2, 0, '2026-07-15');
  const rec1 = s1._DBv[s1.todayStr()].sessions['Laufen'];
  ok('P1 leerer Slot ⇒ ok/marked, Anker gespeichert, Erfolgstoast',
    r1.ok === true && r1.code === 'marked' && rec1.plannedSessionId === 'po:2026-07-15:ps:tmplX' && s1.toasts.some(t => SUCCESS.test(t)), JSON.stringify(r1));
  // P2: bestehende ECHTE Session derselben Sportart ⇒ Ablehnung, Daten unverändert, KEIN Erfolgstoast.
  const s2 = mkSb();
  s2.entry(s2.todayStr()).sessions = { Laufen: { dur: 45, rpe: 6, note: 'echter Lauf' } };
  const before = JSON.stringify(s2._DBv[s2.todayStr()].sessions['Laufen']);
  const r2 = s2.markPlannedDone('Laufen', 2, 0, '2026-07-15');
  ok('P2 belegter Slot (echte Daten) ⇒ abgelehnt, NICHTS überschrieben, kein Erfolgstoast',
    r2.ok === false && r2.code === 'slot_occupied' &&
    JSON.stringify(s2._DBv[s2.todayStr()].sessions['Laufen']) === before &&
    !s2.toasts.some(t => SUCCESS.test(t)) && s2.toasts.length > 0, JSON.stringify({ r: r2, toasts: s2.toasts }));
  // P3: wiederholter Klick auf DIESELBE Occurrence ⇒ idempotent, Eintrag unverändert.
  const s3 = mkSb();
  s3.markPlannedDone('Laufen', 2, 0, '2026-07-15');
  const snap1 = JSON.stringify(s3._DBv[s3.todayStr()].sessions['Laufen']);
  const savedAfterFirst = s3._saved;
  const r3 = s3.markPlannedDone('Laufen', 2, 0, '2026-07-15');
  ok('P3 Wiederholung selbe Occurrence ⇒ ok/already_marked, Eintrag byte-identisch, kein zweiter Save',
    r3.ok === true && r3.code === 'already_marked' &&
    JSON.stringify(s3._DBv[s3.todayStr()].sessions['Laufen']) === snap1 && s3._saved === savedAfterFirst, JSON.stringify(r3));
  // P4: leerer Tages-Slot im Plan (keine Einheit an di/ii) ⇒ ehrliche Ablehnung.
  // v8-310a: Der leere Slot muss am HEUTIGEN Tag liegen (ii ausserhalb) — ein
  // fremder Tag scheitert seither frueher an der Datumssperre (P4b unten).
  const s4 = mkSb();
  const r4 = s4.markPlannedDone('Laufen', 2, 5, '2026-07-15');
  ok('P4 kein Plan-Item am Slot ⇒ ok:false/no_plan_reference, nichts gespeichert',
    r4.ok === false && r4.code === 'no_plan_reference' && !(s4._DBv[s4.todayStr()] && s4._DBv[s4.todayStr()].sessions && s4._DBv[s4.todayStr()].sessions['Laufen']) && !s4.toasts.some(t => SUCCESS.test(t)));
  // P4b (v8-310a, Gians P0): Erledigen an einem FREMDEN Tag wird VOR jeder
  // Slot-Pruefung verweigert — das Datum sperrt Aktionen, nicht der Wochentag.
  const s4b = mkSb();
  const r4b = s4b.markPlannedDone('Laufen', 4, 0, '2026-07-17');
  ok('P4b fremder Tag ⇒ ok:false/not_today, nichts gespeichert',
    r4b.ok === false && r4b.code === 'not_today' && !(s4b._DBv[s4b.todayStr()] && s4b._DBv[s4b.todayStr()].sessions && s4b._DBv[s4b.todayStr()].sessions['Laufen']));
  // P5: save() WIRFT ⇒ Rollback + kein Scheinerfolg. (Die leere Tages-Hülle via
  // entry() ist Bestandsverhalten und wird von data.js-save() nie persistiert —
  // Vergleichsbasis ist der Zustand MIT existierender Hülle.)
  const s5 = mkSb({ saveThrows: true });
  s5.entry(s5.todayStr());
  const day5 = JSON.stringify(s5._DBv);
  const r5 = s5.markPlannedDone('Laufen', 2, 0, '2026-07-15');
  ok('P5 save() wirft ⇒ ok:false/save_failed, Tageszustand byte-identisch, kein Erfolgstoast',
    r5.ok === false && r5.code === 'save_failed' &&
    JSON.stringify(s5._DBv) === day5 && !s5.toasts.some(t => SUCCESS.test(t)), JSON.stringify({ r: r5, toasts: s5.toasts }));
  /* ---------- Batch 2g: echte save()-Semantik (false/fehlend/true) ---------- */
  // P6: save() gibt FALSE zurück (realer Quota-/saveBlocked-Pfad) ⇒ kein Scheinerfolg,
  //     kompletter Tageszustand byte-identisch (inkl. vorhandener sessions + _ts).
  const s6 = mkSb({ saveFalse: true });
  s6.entry(s6.todayStr()).sessions = { Gym: { dur: 30, rpe: 5 }, _ts: 111 };
  const day6 = JSON.stringify(s6._DBv);
  const r6 = s6.markPlannedDone('Laufen', 2, 0, '2026-07-15');
  ok('P6 save()===false ⇒ ok:false/save_failed, Zustand byte-identisch (inkl. _ts 111), kein Erfolgstoast',
    r6.ok === false && r6.code === 'save_failed' && JSON.stringify(s6._DBv) === day6 &&
    s6._DBv[s6.todayStr()].sessions._ts === 111 && !s6.toasts.some(t => SUCCESS.test(t)), JSON.stringify({ r: r6 }));
  // P6b: sessions existierte vorher NICHT ⇒ nach Fehler existiert es wieder nicht.
  const s6b = mkSb({ saveFalse: true });
  const r6b = s6b.markPlannedDone('Laufen', 2, 0, '2026-07-15');
  ok('P6b save()===false ohne vorherige sessions ⇒ sessions existiert danach NICHT',
    r6b.ok === false && s6b._DBv[s6b.todayStr()].sessions === undefined);
  // P7: save() FEHLT ⇒ fail closed (kein Persistenzweg = kein Erfolg).
  const s7 = mkSb({ saveMissing: true });
  const r7 = s7.markPlannedDone('Laufen', 2, 0, '2026-07-15');
  ok('P7 save() fehlt ⇒ ok:false/save_unavailable, nichts persistiert markiert, kein Erfolgstoast',
    r7.ok === false && r7.code === 'save_unavailable' &&
    (s7._DBv[s7.todayStr()] === undefined || s7._DBv[s7.todayStr()].sessions === undefined) && !s7.toasts.some(t => SUCCESS.test(t)), JSON.stringify(r7));
  // P8: save() === true ⇒ Erfolg (Gegenprobe zum neuen Vertrag).
  const s8 = mkSb();
  const r8 = s8.markPlannedDone('Laufen', 2, 0, '2026-07-15');
  ok('P8 save()===true ⇒ ok:true/marked + genau ein Save', r8.ok === true && r8.code === 'marked' && s8._saved === 1);
  // P9: REALES data.js-save(): localStorage.setItem wirft, save() fängt und liefert false.
  const saveBlock = (function () {
    const src = readFileSync(new URL('data.js', base), 'utf8');
    const s = src.indexOf('function save()'), e = src.indexOf('function resolveCorrupt()');
    if (s < 0 || e < 0 || e <= s) throw new Error('save()-Grenzen in data.js nicht gefunden');
    return src.slice(s, e);
  })();
  const s9 = mkSb({ saveMissing: true });
  s9.saveBlocked = false; s9.saveFailed = false; s9.DB = {}; s9.KEY = 'orvia_test'; s9.isDay = () => false;
  s9.localStorage = { setItem: () => { throw new Error('QuotaExceededError'); }, getItem: () => null, removeItem: () => {} };
  vm.runInContext(saveBlock, s9, { filename: 'data.js#save' });
  ok('P9a Vorbedingung: echtes save() liefert bei setItem-Fehler false (wirft nicht)', s9.save() === false);
  const r9 = s9.markPlannedDone('Laufen', 2, 0, '2026-07-15');
  ok('P9b markPlannedDone mit ECHTEM save() + Quota-Fehler ⇒ ok:false/save_failed, kein Erfolgstoast',
    r9.ok === false && r9.code === 'save_failed' && !s9.toasts.some(t => SUCCESS.test(t)), JSON.stringify(r9));
  /* ---------- Batch 2h: Rollback trennt EXISTENZ und WERT ---------- */
  // P10: sessions existierte mit Wert null ⇒ nach Speicherfehler wieder EXAKT
  //      null UND die Property existiert weiterhin (2g-Bug: wurde gelöscht).
  const s10 = mkSb({ saveFalse: true });
  s10.entry(s10.todayStr()).sessions = null;
  const r10 = s10.markPlannedDone('Laufen', 2, 0, '2026-07-15');
  const e10 = s10._DBv[s10.todayStr()];
  ok('P10 sessions:null ⇒ nach save()===false wieder null, Property vorhanden (hasOwnProperty)',
    r10.ok === false && r10.code === 'save_failed' &&
    Object.prototype.hasOwnProperty.call(e10, 'sessions') && e10.sessions === null,
    JSON.stringify({ has: Object.prototype.hasOwnProperty.call(e10, 'sessions'), v: String(e10.sessions) }));
  // P11: Property existiert mit Wert undefined (nicht JSON-serialisierbar) ⇒
  //      Existenz bleibt erhalten, Wert wieder undefined.
  const s11 = mkSb({ saveFalse: true });
  s11.entry(s11.todayStr()).sessions = undefined;
  const r11 = s11.markPlannedDone('Laufen', 2, 0, '2026-07-15');
  const e11 = s11._DBv[s11.todayStr()];
  ok('P11 vorhandene sessions:undefined ⇒ Property existiert weiter (hasOwnProperty true), Wert undefined',
    r11.ok === false && r11.code === 'save_failed' &&
    Object.prototype.hasOwnProperty.call(e11, 'sessions') && e11.sessions === undefined);
  // P11b: Gegenprobe — Property existierte NICHT ⇒ nach Fehler per
  //       hasOwnProperty weiterhin NICHT vorhanden (echte Existenzprüfung,
  //       nicht nur Wertvergleich wie in P6b).
  const s11b = mkSb({ saveFalse: true });
  s11b.entry(s11b.todayStr());
  const r11b = s11b.markPlannedDone('Laufen', 2, 0, '2026-07-15');
  ok('P11b fehlende sessions-Property ⇒ nach Fehler weiterhin nicht vorhanden (hasOwnProperty false)',
    r11b.ok === false && !Object.prototype.hasOwnProperty.call(s11b._DBv[s11b.todayStr()], 'sessions'));
  // P12: vollständiger Tageszustand + eigene Property-Keys (inkl. Reihenfolge)
  //      vor und nach fehlgeschlagenem Mark identisch.
  const s12 = mkSb({ saveFalse: true });
  const e12 = s12.entry(s12.todayStr());
  e12.mood = 3; e12.sessions = null; e12.sleep = 7.5;
  const keysBefore = JSON.stringify(Object.keys(e12));
  const dayBefore = JSON.stringify(s12._DBv);
  const r12 = s12.markPlannedDone('Laufen', 2, 0, '2026-07-15');
  ok('P12 Tageszustand + Object.keys byte-identisch nach fehlgeschlagenem Mark',
    r12.ok === false && JSON.stringify(Object.keys(e12)) === keysBefore && JSON.stringify(s12._DBv) === dayBefore,
    JSON.stringify({ keys: Object.keys(e12) }));
}

/* ---------- Q: ECHTE offline-queue.js durch Queue + Flush (Shim/Fake) ---------- */
{
  // Minimaler IndexedDB-Shim (asynchron wie das Original; nur die von
  // offline-queue.js genutzten Pfade). Ehrlich: Shim ≠ echte Browser-IndexedDB.
  function makeIDB() {
    const stores = {};
    function mkStore(name, opts) {
      const s = { name: name, keyPath: opts.keyPath, auto: !!opts.autoIncrement, seq: 0, rows: new Map(), indexes: {} };
      stores[name] = s; return s;
    }
    function req(fn) { const r = {}; setTimeout(() => { try { const v = fn(); r.result = v; r.onsuccess && r.onsuccess(); } catch (e) { r.error = e; r.onerror && r.onerror(); } }, 0); return r; }
    const dbApi = {
      objectStoreNames: { contains: (n) => !!stores[n] },
      createObjectStore: (n, o) => { const s = mkStore(n, o); return { createIndex: (iname, keyPath) => { s.indexes[iname] = keyPath; } }; },
      transaction: (name, mode) => {
        const s = stores[name];
        const tx = {};
        const osApi = {
          add: (v) => { const c = JSON.parse(JSON.stringify(v)); c.id = ++s.seq; s.rows.set(c.id, c); return {}; },
          put: (v) => { s.rows.set(v.id, JSON.parse(JSON.stringify(v))); return {}; },
          delete: (id) => { s.rows.delete(id); return {}; },
          get: (id) => req(() => (s.rows.has(id) ? JSON.parse(JSON.stringify(s.rows.get(id))) : undefined)),
          index: (iname) => ({
            openCursor: (range) => {
              const r = {};
              const matches = [...s.rows.values()].filter(v => v[s.indexes[iname]] === range.only).map(v => JSON.parse(JSON.stringify(v)));
              let i = 0;
              function step() {
                r.result = i < matches.length ? { value: matches[i], continue: () => { i++; setTimeout(step, 0); }, delete: () => { s.rows.delete(matches[i].id); } } : null;
                r.onsuccess && r.onsuccess();
              }
              setTimeout(step, 0);
              return r;
            }
          })
        };
        tx.objectStore = () => osApi;
        setTimeout(() => { setTimeout(() => { tx.oncomplete && tx.oncomplete(); }, 2); }, 1);
        return tx;
      }
    };
    return {
      open: () => { const r = {}; setTimeout(() => { r.result = dbApi; if (!stores.queue) { r.onupgradeneeded && (r.result = dbApi) && r.onupgradeneeded(); mkStore._done = true; } if (!stores.queue) dbApi.createObjectStore('queue', { keyPath: 'id', autoIncrement: true }); r.onsuccess && r.onsuccess(); }, 0); return r; },
      _stores: stores
    };
  }
  const store = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object;
  sb.String = String; sb.Number = Number; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.Promise = Promise; sb.Intl = Intl;
  sb.Map = Map; sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout; sb.Error = Error;
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb.todayStr = (d) => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const idb = makeIDB();
  sb.indexedDB = idb;
  sb.IDBKeyRange = { only: (v) => ({ only: v }) };
  sb.navigator = { onLine: true };
  sb.addEventListener = () => {};
  const upserted = [];
  sb.ORVIA = {
    user: { id: 'u1' },
    repoBase: { online: () => false },                       // Store-Sicht: offline ⇒ queuen
    sb: { from: (table) => ({ upsert: (payload, opts) => ({ select: async () => { upserted.push({ table, payload: JSON.parse(JSON.stringify(payload)), onConflict: opts && opts.onConflict }); return { data: [{ id: 'srv-' + upserted.length }], error: null }; } }) }) }
  };
  vm.createContext(sb);
  ['training-domain.js', 'activity-normalize.js', 'activity-store.js', 'offline-queue.js', 'workout-store.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  const WS = sb.ORVIA.workoutStore;
  const snap = { occurrenceId: 'po:2026-07-16:ps:tmpl1', templateSessionId: 'ps:tmpl1', plannedDate: '2026-07-16', t: 'Laufen', l: 'Intervalle', d: 'iv', capturedAt: 123 };
  await (async () => {
    const st = await WS.startFreeWorkout({ sport: 'Laufen', sessionType: 'planned', plannedSessionId: snap.occurrenceId, planSnapshot: snap });
    ok('Q1 Start läuft durch die ECHTE Queue (enqueue, sync_status pending)', st.success === true && st.sync_status === 'pending');
    const fin = await WS.finishWorkout({});
    ok('Q2 Abschluss läuft durch die ECHTE Queue', fin.success === true);
    const pending = await sb.ORVIA.offlineQueue.pendingForCurrentUser();
    const sessEntries = pending.filter(p => p.table === 'workout_sessions');
    ok('Q3 Queue hält beide Upserts derselben client_session_id', sessEntries.length === 2 &&
      sessEntries[0].payload.client_session_id === sessEntries[1].payload.client_session_id, JSON.stringify(sessEntries.map(p => p.payload.status)));
    const fl = await sb.ORVIA.offlineQueue.flush();
    ok('Q4 Flush überträgt beide Einträge (echte flush()-Logik, Supabase-Fake)', fl.flushed >= 2 && fl.failed === 0, JSON.stringify(fl));
    const finRow = upserted.filter(u => u.table === 'workout_sessions').map(u => u.payload).sort((a, b) => (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0)).pop();
    ok('Q5 final übertragener Datensatz: Status/Sport/Startzeit/Occurrence/Snapshot intakt',
      finRow.status === 'completed' && finRow.sport === 'Laufen' && finRow.started_at != null &&
      finRow.planned_session_id === snap.occurrenceId && JSON.stringify(finRow.planned_session_snapshot) === JSON.stringify(snap) &&
      finRow.user_id === 'u1', JSON.stringify({ st: finRow.status, occ: finRow.planned_session_id }));
    const after = await sb.ORVIA.offlineQueue.pendingForCurrentUser();
    ok('Q6 Queue nach Flush leer (synced-Einträge entfernt)', after.filter(p => p.table === 'workout_sessions').length === 0);
  })();
}

/* ---------- S: Migrationsevolution append-only (Punkt 1) ---------- */
{
  const sql25 = readFileSync(new URL('../migrations/0025_workout_planned_snapshot.sql', import.meta.url), 'utf8');
  const sql26 = readFileSync(new URL('../migrations/0026_protect_planned_anchor.sql', import.meta.url), 'utf8');
  const h25 = createHash('sha256').update(sql25).digest('hex');
  ok('S1 0025 byte-eingefroren auf den ausgeführten Stand (SHA256-Anker)',
    h25 === '57e21fd4baa2c84826518fc68901dc039698e5078f40bf2000fc756046410d86', h25.slice(0, 12));
  ok('S2 0025 enthält KEINE Trigger-Logik mehr (append-only)', !/trigger|function/i.test(sql25.replace(/--[^\n]*/g, '')));
  ok('S3 0026 trägt Anker-Erhalt (Update) + Erstbefüllungs-Konsistenz (raise exception)',
    /new\.planned_session_id := old\.planned_session_id/.test(sql26) &&
    /planned_session_snapshot->>'occurrenceId'/.test(sql26) && /raise exception/.test(sql26) &&
    /before insert or update on public\.workout_sessions/.test(sql26));
  ok('S4 0026 idempotent + migrationssicher für Bestandszeilen (kein CHECK/Backfill, nur neue Writes)',
    /create or replace function/.test(sql26) && /drop trigger if exists/.test(sql26) &&
    /BESTEHENDE ZEILEN/.test(sql26) && !/alter table[\s\S]*add constraint/i.test(sql26));
  ok('S5 0026 dokumentiert Live-Stand als NICHT technisch verifiziert + Release-Reihenfolge',
    /NICHT technisch[\s\S]{0,20}verifiziert/i.test(sql26) && /RELEASE-REIHENFOLGE/.test(sql26) && /vor dem Client-Bundle/i.test(sql26));
  /* ---------- Batch 2g: PL/pgSQL-Härtung + save()-Vertrag ---------- */
  // S6: INSERT- und UPDATE-Pfad strikt getrennt; im INSERT-Zweig KEIN OLD
  //     (PostgreSQL: OLD nur bei UPDATE/DELETE; keine garantierte Kurzauswertung).
  const insertBranch = (function () { const s = sql26.indexOf("if tg_op = 'INSERT' then"), e = sql26.indexOf("elsif tg_op = 'UPDATE' then"); return (s >= 0 && e > s) ? sql26.slice(s, e) : null; })();
  ok('S6 0026: getrennte IF/ELSIF-Zweige, INSERT-Zweig syntaktisch OHNE OLD',
    insertBranch !== null && !/\bold\./i.test(insertBranch), insertBranch === null ? 'Zweige nicht gefunden' : undefined);
  // S6b: UPDATE-Zweig: erst Erhalt, dann Erstergänzungs-Konsistenz (beide Richtungen + Altzeilen-Schutz).
  const updateBranch = sql26.slice(sql26.indexOf("elsif tg_op = 'UPDATE' then"));
  ok('S6b UPDATE-Zweig: Erhalt vor Konsistenz + Erstergänzung beider Richtungen',
    updateBranch.indexOf('new.planned_session_id := old.planned_session_id') <
    updateBranch.indexOf('id_added') && /id_added\s+or\s+snap_added/.test(updateBranch));
  // S7: markPlannedDone akzeptiert NUR save() === true als Persistenznachweis.
  ok('S7 markPlannedDone: Erfolg nur bei save() === true (kein In-Memory-Nachweis)',
    /persisted=\(save\(\)===true\)/.test(uiSrc.replace(/\s/g, '')) && /save_unavailable/.test(uiSrc));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
