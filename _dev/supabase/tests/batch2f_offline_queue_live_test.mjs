/* ============================================================
   ORVIA · Batch 2f/2g — Offline-Queue + 0026-Anker LIVE-Suite
   ------------------------------------------------------------
   AUFBAU (ehrlich benannt): Node-Lauf mit klar benannter IndexedDB-EMULATION
   (NodeIndexedDBEmulation, unten) + ECHTEM Supabase-Projekt. Die Queue-,
   Flush- und Store-Logik ist der echte Produktivcode; nur die Browser-
   IndexedDB ist emuliert — dies ist KEIN Browser-Test. Browser-spezifische
   IndexedDB-Semantik (Transaktions-Timing, Quota) deckt diese Suite nicht ab.

   STARTBEFEHL (dokumentiert und funktionierend, aus app/):
     SUPABASE_URL=… SUPABASE_ANON_KEY=… A_EMAIL=… A_PW=… \
       node supabase/tests/batch2f_offline_queue_live_test.mjs

   Prüft:
   - L1–L4: Offline-Start + Offline-Abschluss derselben client_session_id
     durch echte offline-queue.js → flush() gegen echtes Supabase → finale
     Zeile behält Status, Sport, Startzeit, planned_session_id (Occurrence)
     und den unveränderten Snapshot.
   - L5–L9: 0026-Szenarien direkt gegen die DB: gültiger INSERT,
     WIDERSPRÜCHLICHER INSERT (muss abgelehnt werden), gültige Erstergänzung
     beider Richtungen, widersprüchliche Erstergänzung BEIDER Richtungen,
     Anker-Überschreibung.
   Batch 2h — gegen falsche Positive gehärtet:
   - Jeder vorbereitende INSERT wird einzeln via .select().single() verifiziert
     (genau eine Zeile, korrekte client_session_id).
   - Jedes UPDATE nutzt .select(): error === null UND genau EINE zurück-
     gegebene Zielzeile sind Pflicht — error:null mit 0 betroffenen Zeilen
     besteht NICHT.
   - L9: UPDATE-Response wird gespeichert; eine trigger-ABGELEHNTE Operation
     (error != null) gilt NICHT als erfolgreicher Anker-Erhalt.
   Cleanup (fail-closed, in finally): jede Delete-Antwort wird geprüft
   (supabase-js WIRFT nicht, {error} wird ausgewertet), Cleanup-Fehler lassen
   die Suite fehlschlagen, danach Rest-Abfrage über ALLE erzeugten
   client_session_ids (muss exakt 0 Treffer liefern), eindeutiges
   Testdaten-Präfix pro Lauf, IDs werden VOR jedem Insert erfasst (auch bei
   Auswertungsfehlern vollständig), abschließend Abmeldung.

   Ohne ENV: ehrlicher Skip (Exit 2). NICHT gegen Supabase ausführen, bevor
   Migration 0026 ausdrücklich freigegeben und ausgeführt wurde.
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const miss = [];
for (const k of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'A_EMAIL', 'A_PW']) if (!process.env[k]) miss.push(k);
if (miss.length) { console.error('ENV fehlt: ' + miss.join(', ')); process.exit(2); }

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../../app/js/', import.meta.url);

/* ---------- NodeIndexedDBEmulation — klar benannte Minimal-Emulation der von
   offline-queue.js genutzten IndexedDB-Pfade (asynchron via setTimeout). ---------- */
function NodeIndexedDBEmulation() {
  const stores = {};
  function mkStore(name, opts) { const s = { keyPath: opts.keyPath, seq: 0, rows: new Map(), indexes: {} }; stores[name] = s; return s; }
  function req(fn) { const r = {}; setTimeout(() => { try { r.result = fn(); r.onsuccess && r.onsuccess(); } catch (e) { r.error = e; r.onerror && r.onerror(); } }, 0); return r; }
  const dbApi = {
    objectStoreNames: { contains: (n) => !!stores[n] },
    createObjectStore: (n, o) => { const s = mkStore(n, o); return { createIndex: (i, kp) => { s.indexes[i] = kp; } }; },
    transaction: (name) => {
      const s = stores[name]; const tx = {};
      tx.objectStore = () => ({
        add: (v) => { const c = JSON.parse(JSON.stringify(v)); c.id = ++s.seq; s.rows.set(c.id, c); return {}; },
        put: (v) => { s.rows.set(v.id, JSON.parse(JSON.stringify(v))); return {}; },
        delete: (id) => { s.rows.delete(id); return {}; },
        get: (id) => req(() => (s.rows.has(id) ? JSON.parse(JSON.stringify(s.rows.get(id))) : undefined)),
        index: (iname) => ({
          openCursor: (range) => {
            const r = {};
            const m = [...s.rows.values()].filter(v => v[s.indexes[iname]] === range.only).map(v => JSON.parse(JSON.stringify(v)));
            let i = 0;
            function step() { r.result = i < m.length ? { value: m[i], continue: () => { i++; setTimeout(step, 0); }, delete: () => { s.rows.delete(m[i].id); } } : null; r.onsuccess && r.onsuccess(); }
            setTimeout(step, 0); return r;
          }
        })
      });
      setTimeout(() => { setTimeout(() => { tx.oncomplete && tx.oncomplete(); }, 2); }, 1);
      return tx;
    }
  };
  return { open: () => { const r = {}; setTimeout(() => { r.result = dbApi; if (!stores.queue) { r.onupgradeneeded && r.onupgradeneeded(); if (!stores.queue) dbApi.createObjectStore('queue', { keyPath: 'id', autoIncrement: true }); } r.onsuccess && r.onsuccess(); }, 0); return r; } };
}

const { createClient } = await import('@supabase/supabase-js');
const sbClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const auth = await sbClient.auth.signInWithPassword({ email: process.env.A_EMAIL, password: process.env.A_PW });
if (auth.error || !auth.data.user) { console.error('Login fehlgeschlagen: ' + (auth.error && auth.error.message)); process.exit(1); }
const userId = auth.data.user.id;

// Sandbox mit Emulation + echtem Supabase-Client.
const store = {};
const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
sb.console = console; sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object;
sb.String = String; sb.Number = Number; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.Promise = Promise; sb.Intl = Intl;
sb.Map = Map; sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout; sb.Error = Error;
sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
sb.todayStr = (d) => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
sb.indexedDB = NodeIndexedDBEmulation();
sb.IDBKeyRange = { only: (v) => ({ only: v }) };
sb.navigator = { onLine: true };
sb.addEventListener = () => {};
sb.ORVIA = { user: { id: userId }, sb: sbClient, repoBase: { online: () => false } };
vm.createContext(sb);
['training-domain.js', 'activity-normalize.js', 'activity-store.js', 'offline-queue.js', 'workout-store.js'].forEach(f =>
  vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));

/* Eindeutiges Testdaten-Präfix pro Lauf: kollisionsfrei gegenüber echten
   Client-IDs und früheren (ggf. abgebrochenen) Testläufen. */
const RUN = 'e2e2h-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
const cleanupClientIds = [];
const probeIds = [];
/* INSERT-Verifikation: genau EINE Zeile mit der erwarteten client_session_id.
   Gibt {ok, info} zurück — die ID ist zu diesem Zeitpunkt bereits in probeIds
   erfasst (Cleanup greift auch bei Fehlschlag der Verifikation). */
async function insertVerified(row) {
  const r = await sbClient.from('workout_sessions').insert(row).select().single();
  const okIns = r.error === null && !!r.data && r.data.client_session_id === row.client_session_id;
  return { ok: okIns, info: r.error ? r.error.message : (r.data ? 'cid=' + r.data.client_session_id : 'keine Zeile') };
}
try {
  /* ---------- L1–L4: Queue → Flush → finale Zeile ---------- */
  const snap = { occurrenceId: 'po:2099-01-01:ps:e2e', templateSessionId: 'ps:e2e', plannedDate: '2099-01-01', t: 'Laufen', l: 'E2E', d: 'iv', capturedAt: Date.now() };
  const st = await sb.ORVIA.workoutStore.startFreeWorkout({ sport: 'Laufen', sessionType: 'planned', plannedSessionId: snap.occurrenceId, planSnapshot: snap });
  ok('L1 Offline-Start gequeued', st.success === true && st.sync_status === 'pending');
  const clientId = sb.ORVIA.workout.session.client_session_id;
  cleanupClientIds.push(clientId);
  const fin = await sb.ORVIA.workoutStore.finishWorkout({});
  ok('L2 Offline-Abschluss gequeued', fin.success === true);
  sb.ORVIA.repoBase.online = () => true;
  const fl = await sb.ORVIA.offlineQueue.flush();
  ok('L3 Flush gegen echtes Supabase erfolgreich', fl.failed === 0 && fl.flushed >= 2, JSON.stringify(fl));
  const { data: rows, error } = await sbClient.from('workout_sessions').select('*').eq('user_id', userId).eq('client_session_id', clientId);
  ok('L4 finale Zeile: Status/Sport/Startzeit/Occurrence/Snapshot intakt',
    !error && rows && rows.length === 1 && rows[0].status === 'completed' && rows[0].sport === 'Laufen' &&
    rows[0].started_at != null && rows[0].planned_session_id === snap.occurrenceId &&
    JSON.stringify(rows[0].planned_session_snapshot) === JSON.stringify(snap), error && error.message);

  /* ---------- L5–L9: 0026-Szenarien direkt gegen die DB ---------- */
  const mkRow = (cid, extra) => Object.assign({ user_id: userId, local_date: '2099-01-01', status: 'completed', sport: 'Test', client_session_id: cid, source: 'manual' }, extra);
  // L5 gültiger INSERT (ID + konsistenter Snapshot) — einzeln verifiziert.
  const c5 = RUN + '-valid'; probeIds.push(c5);
  const r5 = await insertVerified(mkRow(c5, { planned_session_id: 'po:x:1', planned_session_snapshot: { occurrenceId: 'po:x:1' } }));
  ok('L5 gültiger INSERT wird angenommen (genau eine Zeile zurück)', r5.ok, r5.info);
  // L6 WIDERSPRÜCHLICHER INSERT muss abgelehnt werden.
  const c6 = RUN + '-bad-insert'; probeIds.push(c6);
  const r6 = await sbClient.from('workout_sessions').insert(mkRow(c6, { planned_session_id: 'po:x:2', planned_session_snapshot: { occurrenceId: 'po:ANDERS' } }));
  ok('L6 widersprüchlicher INSERT wird abgelehnt (0026)', !!r6.error && /Plananker inkonsistent/.test(r6.error.message || ''), r6.error && r6.error.message);
  // L7 gültige Erstergänzung beider Richtungen — Vorbereitung einzeln
  //    verifiziert; jedes UPDATE muss GENAU EINE Zielzeile zurückgeben
  //    (error:null mit 0 betroffenen Zeilen besteht nicht).
  const c7a = RUN + '-add-id'; probeIds.push(c7a);
  const p7a = await insertVerified(mkRow(c7a, { planned_session_snapshot: { occurrenceId: 'po:x:3' } }));
  ok('L7a Vorbereitung: Snapshot-only-Zeile angelegt (verifiziert)', p7a.ok, p7a.info);
  const r7a = await sbClient.from('workout_sessions').update({ planned_session_id: 'po:x:3' })
    .eq('user_id', userId).eq('client_session_id', c7a).select();
  ok('L7b ID-Erstergänzung: error=null, genau EINE Zeile, Wert gesetzt',
    r7a.error === null && Array.isArray(r7a.data) && r7a.data.length === 1 && r7a.data[0].planned_session_id === 'po:x:3',
    r7a.error ? r7a.error.message : 'rows=' + (r7a.data ? r7a.data.length : 'null'));
  const c7b = RUN + '-add-snap'; probeIds.push(c7b);
  const p7b = await insertVerified(mkRow(c7b, { planned_session_id: 'po:x:4' }));
  ok('L7c Vorbereitung: ID-only-Zeile angelegt (verifiziert)', p7b.ok, p7b.info);
  const r7b = await sbClient.from('workout_sessions').update({ planned_session_snapshot: { occurrenceId: 'po:x:4' } })
    .eq('user_id', userId).eq('client_session_id', c7b).select();
  ok('L7d Snapshot-Erstergänzung: error=null, genau EINE Zeile, Wert gesetzt',
    r7b.error === null && Array.isArray(r7b.data) && r7b.data.length === 1 &&
    r7b.data[0].planned_session_snapshot && r7b.data[0].planned_session_snapshot.occurrenceId === 'po:x:4',
    r7b.error ? r7b.error.message : 'rows=' + (r7b.data ? r7b.data.length : 'null'));
  // L8 widersprüchliche Erstergänzung — BEIDE Richtungen.
  // L8a: Snapshot existiert, ID wird widersprüchlich ergänzt.
  const c8a = RUN + '-bad-add-id'; probeIds.push(c8a);
  const p8a = await insertVerified(mkRow(c8a, { planned_session_snapshot: { occurrenceId: 'po:x:5' } }));
  ok('L8a Vorbereitung: Snapshot-only-Zeile angelegt (verifiziert)', p8a.ok, p8a.info);
  const r8a = await sbClient.from('workout_sessions').update({ planned_session_id: 'po:WIDERSPRUCH' })
    .eq('user_id', userId).eq('client_session_id', c8a).select();
  const k8a = await sbClient.from('workout_sessions').select('planned_session_id').eq('user_id', userId).eq('client_session_id', c8a).single();
  ok('L8b widersprüchliche ID-Ergänzung wird abgelehnt, Zeile bleibt ohne ID',
    !!r8a.error && /Plananker inkonsistent/.test(r8a.error.message || '') &&
    k8a.error === null && k8a.data.planned_session_id === null,
    r8a.error ? r8a.error.message : 'kein Fehler');
  // L8c: ID existiert, Snapshot wird widersprüchlich ergänzt.
  const c8b = RUN + '-bad-add-snap'; probeIds.push(c8b);
  const p8b = await insertVerified(mkRow(c8b, { planned_session_id: 'po:x:6' }));
  ok('L8c Vorbereitung: ID-only-Zeile angelegt (verifiziert)', p8b.ok, p8b.info);
  const r8b = await sbClient.from('workout_sessions').update({ planned_session_snapshot: { occurrenceId: 'po:ANDERS' } })
    .eq('user_id', userId).eq('client_session_id', c8b).select();
  const k8b = await sbClient.from('workout_sessions').select('planned_session_snapshot').eq('user_id', userId).eq('client_session_id', c8b).single();
  ok('L8d widersprüchliche Snapshot-Ergänzung wird abgelehnt, Zeile bleibt ohne Snapshot',
    !!r8b.error && /Plananker inkonsistent/.test(r8b.error.message || '') &&
    k8b.error === null && k8b.data.planned_session_snapshot === null,
    r8b.error ? r8b.error.message : 'kein Fehler');
  // L9 Anker-Überschreibung bleibt wirkungslos: Erhalt heißt, das UPDATE
  //    läuft DURCH (error=null, genau eine Zeile) und der Altwert steht danach
  //    unverändert in der DB. Eine trigger-ABGELEHNTE Operation (error!=null)
  //    ist KEIN erfolgreicher Anker-Erhalt.
  const r9 = await sbClient.from('workout_sessions').update({ planned_session_id: 'po:9999' })
    .eq('user_id', userId).eq('client_session_id', c5).select();
  const k9 = await sbClient.from('workout_sessions').select('planned_session_id, planned_session_snapshot').eq('user_id', userId).eq('client_session_id', c5).single();
  ok('L9 Anker-Überschreibversuch: UPDATE angenommen (error=null, EINE Zeile), Altwert erhalten',
    r9.error === null && Array.isArray(r9.data) && r9.data.length === 1 &&
    r9.data[0].planned_session_id === 'po:x:1' &&
    k9.error === null && k9.data.planned_session_id === 'po:x:1' &&
    k9.data.planned_session_snapshot && k9.data.planned_session_snapshot.occurrenceId === 'po:x:1',
    r9.error ? r9.error.message : 'rows=' + (r9.data ? r9.data.length : 'null'));
} finally {
  /* Cleanup IMMER und FAIL-CLOSED: supabase-js wirft nicht, sondern liefert
     {error} — jede Antwort wird geprüft; jeder Cleanup-Fehler lässt die Suite
     fehlschlagen. Danach Rest-Abfrage über ALLE erzeugten IDs (exakt 0
     Treffer), erst dann Abmeldung. */
  const allIds = [...new Set(cleanupClientIds.concat(probeIds))];
  const cleanupErrors = [];
  for (const cid of allIds) {
    try {
      const d = await sbClient.from('workout_sessions').delete().eq('user_id', userId).eq('client_session_id', cid);
      if (d.error) cleanupErrors.push(cid + ': ' + d.error.message);
    } catch (e) { cleanupErrors.push(cid + ': throw ' + (e && e.message)); }
  }
  ok('C1 Cleanup: alle ' + allIds.length + ' Delete-Antworten fehlerfrei', cleanupErrors.length === 0, cleanupErrors.join(' | '));
  try {
    const res = await sbClient.from('workout_sessions').select('client_session_id').eq('user_id', userId).in('client_session_id', allIds);
    ok('C2 Rest-Abfrage über alle erzeugten client_session_ids: exakt 0 Treffer',
      res.error === null && Array.isArray(res.data) && res.data.length === 0,
      res.error ? res.error.message : 'rest=' + (res.data ? res.data.length : 'null'));
  } catch (e) { ok('C2 Rest-Abfrage über alle erzeugten client_session_ids: exakt 0 Treffer', false, 'throw ' + (e && e.message)); }
  try { await sbClient.auth.signOut(); } catch (e) { /* Abmeldung ist Komfort, kein Testkriterium */ }
}
console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
