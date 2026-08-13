/* ORVIA · v8-323 — K2: Kraftplanung sichtbar und bearbeitbar (End-to-End)

   BEFUND bis v8-322: Der Datenvertrag trug Übungen, Sätze, Wiederholungen und
   Zielgewicht; die Schreibpfade und die Übernahme beim Sessionstart waren
   angeschlossen. Sichtbar war davon NICHTS — `renderGMPlan` las
   `plannedExercises` nicht, `summarizePlanned()` hatte keinen Aufrufer, und es
   gab keinen Weg, Vorgaben überhaupt anzulegen: der Editor kopierte beim
   Hinzufügen nur `{t,l,d}`.

   Dieser Test fährt die VOLLE Kette mit den ECHTEN Modulen ab — Editor-
   Funktionen aus ui.js, Datenvertrag strength-plan.js, Persistenzmodell
   plan-domain.js, Store workout-store.js mit echter offline-queue.js. Gefälscht
   sind nur die Aussenwelt (Supabase, IndexedDB) und ein minimaler DOM.

     Planeditor → user_week_plans-JSON → Reload → Wochenplananzeige
       → Sessionstart → workout_exercises

     E1  Anzeige: Name, Sätze, Wiederholungen, Zielgewicht, Pause
     E2  Anzeige: unbekannte Übungskennung wird MARKIERT, nie geraten
     E3  Editor: hinzufügen
     E4  Editor: bearbeiten (und fail-closed bei Unsinn)
     E5  Editor: sortieren
     E6  Editor: entfernen
     E7  Auswahl ausschliesslich aus der kanonischen Bibliothek
     E8  0 kg bleibt 0, keine Vorgabe bleibt null — durch die GANZE Kette
     E9  Die volle Kette inkl. Reload und Sessionstart
     E10 Der Session-Snapshot friert ein: spätere Planänderungen ändern ihn nicht
     E11 Altbestand ohne Übungen bleibt kompatibel
     E12 Teilweise fehlgeschlagene Übernahme ⇒ kein stiller Erfolg
     E13 Online und Offline schreiben dieselbe Feldmenge (im E2E, nicht im Labor)

   node supabase/tests/strength_plan_ui_e2e_test.mjs */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const _APPREL = existsSync(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const base = new URL(_APPREL + 'js/', import.meta.url);
const src = f => readFileSync(new URL(f, base), 'utf8');
const cssRaw = readFileSync(new URL(_APPREL + 'styles.css', import.meta.url), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

/* ── Die ECHTEN Escaper und Konstanten aus dem Produktcode herausschneiden,
      statt sie nachzubauen. ── */
const uiSrc = src('ui.js');
const escFn = (src('data.js').match(/^function esc\(.*$/m) || [''])[0];
const escHFn = (src('profile.js').match(/^function escH\(.*$/m) || [''])[0];
const dayNames = (uiSrc.match(/^const DAYNAMES=.*$/m) || [''])[0];
const presetsStart = uiSrc.indexOf('var PLAN_PRESETS=[');
const presets = uiSrc.slice(presetsStart, uiSrc.indexOf('\n];', presetsStart) + 3);
/* Der zusammenhängende K2-Block: Namens-Cache, Anzeige-Helfer, Editor. */
const blkStart = uiSrc.indexOf('var _gmExLib=null,_gmExLibLoading=false;');
const rmIdx = uiSrc.indexOf('function removePlanItem(di,ii){');
const blkEnd = uiSrc.indexOf('\n', rmIdx);
const uiBlock = uiSrc.slice(blkStart, blkEnd);
/* Und der Kartenrenderer-Aufruf: gmPlannedLinesHTML muss WIRKLICH auf der
   Karte stehen — sonst wäre der ganze Anzeigepfad theoretisch. */
const cardCall = /gmPlannedLinesHTML\(it\)/.test(uiSrc);

/* ── IndexedDB-Shim (nur die von offline-queue.js benutzten Pfade) ── */
function makeIDB() {
  const stores = {};
  const mk = (n, o) => { const s = { name: n, keyPath: o.keyPath, seq: 0, rows: new Map(), indexes: {} }; stores[n] = s; return s; };
  const req = fn => { const r = {}; setTimeout(() => { try { r.result = fn(); r.onsuccess && r.onsuccess(); } catch (e) { r.error = e; r.onerror && r.onerror(); } }, 0); return r; };
  const dbApi = {
    objectStoreNames: { contains: n => !!stores[n] },
    createObjectStore: (n, o) => { const s = mk(n, o); return { createIndex: (i, kp) => { s.indexes[i] = kp; } }; },
    transaction: name => {
      const s = stores[name], tx = {};
      tx.objectStore = () => ({
        add: v => { const c = JSON.parse(JSON.stringify(v)); c.id = ++s.seq; s.rows.set(c.id, c); return {}; },
        put: v => { s.rows.set(v.id, JSON.parse(JSON.stringify(v))); return {}; },
        delete: id => { s.rows.delete(id); return {}; },
        get: id => req(() => (s.rows.has(id) ? JSON.parse(JSON.stringify(s.rows.get(id))) : undefined)),
        index: iname => ({
          openCursor: range => {
            const r = {}; const m = [...s.rows.values()].filter(v => v[s.indexes[iname]] === range.only).map(v => JSON.parse(JSON.stringify(v)));
            let i = 0;
            function step() { r.result = i < m.length ? { value: m[i], continue: () => { i++; setTimeout(step, 0); }, delete: () => { s.rows.delete(m[i].id); } } : null; r.onsuccess && r.onsuccess(); }
            setTimeout(step, 0); return r;
          }
        })
      });
      setTimeout(() => setTimeout(() => { tx.oncomplete && tx.oncomplete(); }, 2), 1);
      return tx;
    }
  };
  return {
    open: () => { const r = {}; setTimeout(() => { r.result = dbApi; if (!stores.queue) r.onupgradeneeded && r.onupgradeneeded(); if (!stores.queue) dbApi.createObjectStore('queue', { keyPath: 'id', autoIncrement: true }); r.onsuccess && r.onsuccess(); }, 0); return r; },
    _stores: stores
  };
}

/* Die kanonische Bibliothek, wie sie aus `exercises` käme. */
const LIB = [
  { id: 'ex-bench', slug: 'bench_press', name: 'Bankdrücken' },
  { id: 'ex-row', slug: 'barbell_row', name: 'Rudern' },
  { id: 'ex-ohp', slug: 'ohp', name: 'Schulterdrücken' },
  { id: 'ex-pullup', slug: 'pullup', name: 'Klimmzüge' }
];

function makeSb(opts) {
  opts = opts || {};
  const ls = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object;
  sb.String = String; sb.Number = Number; sb.Set = Set; sb.Map = Map; sb.Promise = Promise;
  sb.isNaN = isNaN; sb.isFinite = isFinite; sb.Intl = Intl; sb.Error = Error;
  sb.parseFloat = parseFloat; sb.parseInt = parseInt;
  sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout;
  sb.localStorage = { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } };
  sb._ls = ls;
  sb.todayStr = d => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  sb.navigator = { onLine: opts.online !== false };
  sb.addEventListener = () => {};
  sb.indexedDB = makeIDB();
  sb.IDBKeyRange = { only: v => ({ only: v }) };
  /* Minimaler DOM: nur getElementById. Der Editor braucht nicht mehr. */
  sb._els = { pe_scroll: { innerHTML: '' } };
  sb.document = { getElementById: id => sb._els[id] || null };
  sb.toasts = []; sb.toast = m => sb.toasts.push(m);
  sb.renderPlan = () => { sb._renderPlanCalls = (sb._renderPlanCalls || 0) + 1; };

  const upserts = []; sb._upserts = upserts;
  sb._rows = opts.rows || {};
  const mkQuery = table => { const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, then: r => r({ data: sb._rows[table] || [], error: null }) }; return q; };
  sb.ORVIA = { user: { id: 'u1' } };
  sb.ORVIA.sb = {
    from: table => ({
      upsert: (payload, o) => ({
        select: async () => {
          upserts.push({ table, payload: JSON.parse(JSON.stringify(payload)), onConflict: o && o.onConflict });
          if (opts.upsertFails && opts.upsertFails(table, payload)) return { data: null, error: { message: 'kaputt' } };
          return { data: [Object.assign({ id: 'srv-' + upserts.length }, payload)], error: null };
        }
      }),
      select: () => mkQuery(table),
      update: patch => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: [patch], error: null }) }) }) })
    })
  };
  vm.createContext(sb);
  ['training-domain.js', 'engine/strength-plan.js', 'plan-domain.js', 'repos/repoBase.js',
    'repos/workoutRepository.js', 'repos/trainingPlanRepository.js', 'repos/exerciseRepository.js',
    'activity-normalize.js', 'activity-store.js', 'offline-queue.js', 'workout-store.js']
    .forEach(f => vm.runInContext(src(f), sb, { filename: f }));
  vm.runInContext(escFn + '\n' + escHFn + '\n' + 'function gmEsc(x){return escH(x);}\n' + dayNames + '\n' + presets + '\n' + uiBlock,
    sb, { filename: 'ui.js#k2' });
  return sb;
}
const tick = () => new Promise(r => setTimeout(r, 25));

/* ══ E1/E2 · Anzeige ══ */
sec('E1/E2 · Die Übungen stehen auf der Wochenplan-Karte');
{
  const sb = makeSb({ rows: { exercises: LIB } });
  await new Promise(r => sb.gmExLibEnsure(r));
  const SP = sb.ORVIA.strengthPlan;
  const item = SP.attachPlanned({ t: 'Gym', l: 'Oberkörper', d: '45 min' }, [
    { exerciseId: 'ex-bench', sets: 4, minReps: 6, maxReps: 8, targetWeightKg: 82.5, restSeconds: 150 },
    { exerciseId: 'ex-row', sets: 3, minReps: 8, maxReps: 10, targetWeightKg: 65, restSeconds: 120 }
  ]);
  const html = sb.gmPlannedLinesHTML(item);
  ok('gmPlannedLinesHTML wird auf der ECHTEN Karte aufgerufen (sonst wäre alles theoretisch)', cardCall);
  ok('die Karte zeigt den Übungsnamen', /Bankdrücken/.test(html), html.slice(0, 160));
  ok('… Sätze und Wiederholungsbereich', /4 × 6–8/.test(html));
  ok('… das Zielgewicht', /82\.5 kg/.test(html));
  ok('… und die Pause', /150 s Pause/.test(html));
  ok('beide Übungen erscheinen', (html.match(/<li/g) || []).length === 2);
  ok('ein Item ohne Vorgaben erzeugt KEIN leeres Listengerüst',
    sb.gmPlannedLinesHTML({ t: 'Gym', l: 'Ganzkörper', d: '45 min' }) === '');
  ok('eine Laufeinheit ebenfalls nicht', sb.gmPlannedLinesHTML({ t: 'Laufen', l: 'Intervalle', d: 'iv' }) === '');

  const unknown = SP.attachPlanned({ t: 'Gym', l: 'Push' }, [{ exerciseId: 'ex-geloescht', sets: 3 }]);
  const uh = sb.gmPlannedLinesHTML(unknown);
  ok('eine unbekannte Übungskennung wird als unbekannt MARKIERT', /sc-plex-unknown/.test(uh), uh);
  ok('… die Kennung selbst bleibt sichtbar (nichts wird geraten)', /ex-geloescht/.test(uh));
  ok('… und es wird kein Name aus der Bibliothek untergeschoben', !/Bankdrücken|Rudern/.test(uh));
  /* Nicht nur „der Selektor existiert" — er muss auch eine eigene FARBE setzen.
     Die lose Fassung liess eine Mutation durch, die die Farbregel entfernte und
     nur das leere ::before-Geschwister stehen liess (Probe U12 blieb gruen). */
  ok('die Markierung hat eine eigene Darstellung (eigene Farbe, nicht nur ein Selektor)',
    /\.sc-plex li\.sc-plex-unknown\s*\{[^}]*color\s*:/.test(cssRaw),
    (cssRaw.match(/\.sc-plex li\.sc-plex-unknown[^}]*\}/g) || []).join(' | '));
}

/* ══ E3–E6 · Editor ══ */
sec('E3–E6 · Hinzufügen, bearbeiten, sortieren, entfernen');
{
  const sb = makeSb({ rows: { exercises: LIB } });
  await new Promise(r => sb.gmExLibEnsure(r));
  const SP = sb.ORVIA.strengthPlan;
  sb._planEdit = [[], [], [{ id: 'ps:g1', t: 'Gym', l: 'Oberkörper', d: '45 min' }], [], [], [], []];
  const cur = () => SP.readPlanned(sb._planEdit[2][0]);

  sb.peToggleEx(2, 0);
  ok('das Übungspanel lässt sich öffnen', /pe-expanel/.test(sb._els.pe_scroll.innerHTML));
  ok('… und es steht am richtigen Item (Gym, nicht Ruhetag)', /Übungen \(0\)/.test(sb._els.pe_scroll.innerHTML));

  /* E3 hinzufügen */
  sb._els['pe_ex_sel_2_0'] = { value: 'ex-bench' };
  sb._els['pe_ex_sets_2_0'] = { value: '4' };
  sb.peAddEx(2, 0);
  ok('E3 eine Übung wird hinzugefügt', cur().length === 1 && cur()[0].exerciseId === 'ex-bench', JSON.stringify(cur()));
  ok('… mit der eingegebenen Satzanzahl (kein stiller Standardwert)', cur()[0].sets === 4);
  ok('… und ohne erfundene Wiederholungen oder Gewichte',
    cur()[0].minReps === null && cur()[0].targetWeightKg === null, JSON.stringify(cur()[0]));
  sb._els['pe_ex_sel_2_0'] = { value: 'ex-row' }; sb._els['pe_ex_sets_2_0'] = { value: '3' };
  sb.peAddEx(2, 0);
  sb._els['pe_ex_sel_2_0'] = { value: 'ex-ohp' }; sb._els['pe_ex_sets_2_0'] = { value: '3' };
  sb.peAddEx(2, 0);
  ok('drei Übungen sind geplant (Gians DoD-Mindestumfang)', cur().length === 3);
  ok('die Reihenfolge ist lückenlos 1..3', cur().map(e => e.order).join(',') === '1,2,3');

  /* Ohne Auswahl passiert nichts — und der Grund steht sichtbar da. */
  sb._els['pe_ex_sel_2_0'] = { value: '' };
  sb.peAddEx(2, 0);
  ok('ohne ausgewählte Übung wird nichts angelegt', cur().length === 3);
  ok('… und der Grund wird angezeigt (kein stilles Nichts)',
    /Bitte zuerst eine Übung auswählen/.test(sb._els.pe_scroll.innerHTML));
  sb._els['pe_ex_sel_2_0'] = { value: 'ex-pullup' }; sb._els['pe_ex_sets_2_0'] = { value: '' };
  sb.peAddEx(2, 0);
  ok('ohne Satzanzahl wird nichts angelegt (3 wäre geraten)', cur().length === 3);
  ok('… mit sichtbarer Begründung', /Sätze/.test(sb._els.pe_scroll.innerHTML) && /pe-exerr/.test(sb._els.pe_scroll.innerHTML));

  /* Die Obergrenze des Datenvertrags muss ebenfalls SICHTBAR greifen — nicht
     nur intern. Ohne diese Zusage blieb eine Mutation unbemerkt, die die
     Fehlermeldung von peAddEx entfernte (Probe U4). */
  {
    const SPL = sb.ORVIA.strengthPlan;
    const many = [];
    for (let i = 0; i < SPL.LIMITS.maxExercises; i++) many.push({ exerciseId: 'ex-bench', sets: 3 });
    sb._planEdit[2][0] = SPL.attachPlanned(sb._planEdit[2][0], many);
    sb.renderPlanEditor();
    sb._els['pe_ex_sel_2_0'] = { value: 'ex-row' }; sb._els['pe_ex_sets_2_0'] = { value: '3' };
    sb.peAddEx(2, 0);
    ok('die Obergrenze verhindert eine 21. Übung', cur().length === SPL.LIMITS.maxExercises, String(cur().length));
    ok('… und sagt WARUM (kein stilles Nichtstun)',
      /pe-exerr/.test(sb._els.pe_scroll.innerHTML) && /Obergrenze erreicht/.test(sb._els.pe_scroll.innerHTML),
      (sb._els.pe_scroll.innerHTML.match(/pe-exerr[^<]*>[^<]*/) || [''])[0]);
    /* Ausgangslage fuer die folgenden Abschnitte wiederherstellen. */
    sb._planEdit[2][0] = SPL.attachPlanned(sb._planEdit[2][0],
      [{ exerciseId: 'ex-bench', sets: 4 }, { exerciseId: 'ex-row', sets: 3 }, { exerciseId: 'ex-ohp', sets: 3 }]);
    sb.renderPlanEditor();
  }

  /* E4 bearbeiten */
  sb.peUpdateEx(2, 0, 0, 'minReps', { value: '6' });
  sb.peUpdateEx(2, 0, 0, 'maxReps', { value: '8' });
  sb.peUpdateEx(2, 0, 0, 'targetWeightKg', { value: '82,5' });
  sb.peUpdateEx(2, 0, 0, 'restSeconds', { value: '150' });
  ok('E4 Wiederholungsbereich, Gewicht und Pause werden übernommen',
    cur()[0].minReps === 6 && cur()[0].maxReps === 8 && cur()[0].targetWeightKg === 82.5 && cur()[0].restSeconds === 150,
    JSON.stringify(cur()[0]));
  ok('… ein Komma wird als Dezimaltrenner verstanden', cur()[0].targetWeightKg === 82.5);
  const before = JSON.stringify(cur());
  sb.peUpdateEx(2, 0, 0, 'targetWeightKg', { value: '-20' });
  ok('ein negatives Gewicht wird ABGELEHNT', JSON.stringify(cur()) === before);
  ok('… und die anderen Übungen bleiben unangetastet', cur().length === 3);
  ok('… mit sichtbarer Begründung', /pe-exerr/.test(sb._els.pe_scroll.innerHTML));
  sb.peUpdateEx(2, 0, 1, 'sets', { value: 'viele' });
  ok('eine unlesbare Zahl wird abgelehnt statt verworfen', cur()[1].sets === 3);
  sb.peUpdateEx(2, 0, 0, 'restSeconds', { value: '' });
  ok('ein geleertes Feld heisst „keine Vorgabe" (null), nicht 0', cur()[0].restSeconds === null);

  /* E5 sortieren */
  const order0 = cur().map(e => e.exerciseId).join(',');
  sb.peMoveEx(2, 0, 0, 1);
  ok('E5 eine Übung lässt sich nach unten schieben',
    cur().map(e => e.exerciseId).join(',') === 'ex-row,ex-bench,ex-ohp', cur().map(e => e.exerciseId).join(','));
  ok('… die Sollwerte wandern mit', cur()[1].targetWeightKg === 82.5 && cur()[1].minReps === 6);
  ok('… und die Reihenfolge bleibt lückenlos', cur().map(e => e.order).join(',') === '1,2,3');
  sb.peMoveEx(2, 0, 1, -1);
  ok('… und wieder zurück', cur().map(e => e.exerciseId).join(',') === order0);
  const stable = JSON.stringify(cur());
  sb.peMoveEx(2, 0, 0, -1);
  ok('am Rand der Liste passiert nichts (kein Fehler, keine Veränderung)', JSON.stringify(cur()) === stable);

  /* E6 entfernen */
  sb.peRemoveEx(2, 0, 1);
  ok('E6 eine Übung lässt sich entfernen', cur().length === 2 && cur().map(e => e.exerciseId).join(',') === 'ex-bench,ex-ohp');
  ok('… die Reihenfolge schliesst die Lücke', cur().map(e => e.order).join(',') === '1,2');
  ok('das Panel meldet Anzahl und geschätzte Dauer', /2 Übungen/.test(sb._els.pe_scroll.innerHTML) &&
    /geschätzt \d+ min/.test(sb._els.pe_scroll.innerHTML), (sb._els.pe_scroll.innerHTML.match(/pe-exmeta[^<]*>[^<]*/) || [''])[0]);
}

/* ══ E7 · Auswahl nur aus der kanonischen Bibliothek ══ */
sec('E7 · Auswahl ausschliesslich aus der Bibliothek');
{
  const sb = makeSb({ rows: { exercises: LIB } });
  await new Promise(r => sb.gmExLibEnsure(r));
  sb._planEdit = [[{ id: 'ps:g1', t: 'Gym', l: 'Push' }], [], [], [], [], [], []];
  sb.peToggleEx(0, 0);
  const html = sb._els.pe_scroll.innerHTML;
  ok('die Auswahl enthält genau die Bibliotheksübungen',
    LIB.every(e => html.indexOf('value="' + e.id + '"') >= 0), 'fehlend: ' + LIB.filter(e => html.indexOf('value="' + e.id + '"') < 0).map(e => e.id).join(','));
  ok('… und keine Freitexteingabe für Übungsnamen', !/pe-exadd[\s\S]{0,300}?<input[^>]*type="text"/.test(html));
  ok('die Bibliothek wird über das ECHTE Repository geladen',
    /ORVIA\.repos\.exercise\.list\(\)/.test(uiSrc));
  /* Ohne Bibliothek gibt es KEINE Ersatzliste — die Oberfläche sagt das offen. */
  const off = makeSb({ online: false });
  off._planEdit = [[{ id: 'ps:g1', t: 'Gym', l: 'Push' }], [], [], [], [], [], []];
  off.peToggleEx(0, 0);
  ok('ohne Bibliothek wird KEINE Ersatzliste erfunden', !/pe-exadd/.test(off._els.pe_scroll.innerHTML));
  ok('… und der Grund steht sichtbar da', /pe-exwarn/.test(off._els.pe_scroll.innerHTML));
}

/* ══ E8 · 0 bleibt 0, null bleibt null — durch die ganze Kette ══ */
sec('E8 · 0 kg bleibt 0, keine Vorgabe bleibt null');
{
  const sb = makeSb({ rows: { exercises: LIB, workout_sessions: [] } });
  await new Promise(r => sb.gmExLibEnsure(r));
  const SP = sb.ORVIA.strengthPlan;
  sb._planEdit = [[], [], [{ id: 'ps:g1', t: 'Gym', l: 'Oberkörper', d: '45 min' }], [], [], [], []];
  sb._els['pe_ex_sel_2_0'] = { value: 'ex-pullup' }; sb._els['pe_ex_sets_2_0'] = { value: '3' };
  sb.peToggleEx(2, 0); sb.peAddEx(2, 0);
  sb.peUpdateEx(2, 0, 0, 'targetWeightKg', { value: '0' });
  sb._els['pe_ex_sel_2_0'] = { value: 'ex-bench' }; sb._els['pe_ex_sets_2_0'] = { value: '4' };
  sb.peAddEx(2, 0);
  const list = SP.readPlanned(sb._planEdit[2][0]);
  ok('0 kg wird als 0 gespeichert (nicht zu null zusammengefaltet)', list[0].targetWeightKg === 0, JSON.stringify(list[0]));
  ok('ohne Vorgabe bleibt null (nicht 0)', list[1].targetWeightKg === null, JSON.stringify(list[1]));
  ok('die Anzeige unterscheidet die beiden Fälle', (() => {
    const h = sb.gmPlannedLinesHTML(sb._planEdit[2][0]);
    return /ohne Zusatzlast/.test(h) && !/0 kg/.test(h);
  })(), sb.gmPlannedLinesHTML(sb._planEdit[2][0]));
  /* Bis in die Datenbank */
  const snap = { occurrenceId: 'po:2026-08-12:ps:g1', t: 'Gym', l: 'Oberkörper', capturedAt: 1, plannedExercises: list };
  await sb.ORVIA.workoutStore.startFreeWorkout({ sport: 'Gym', planSnapshot: snap });
  const rows = sb._upserts.filter(u => u.table === 'workout_exercises').map(u => u.payload);
  ok('0 kg erreicht die Datenbank als 0', rows[0].target_weight_kg === 0, JSON.stringify(rows[0].target_weight_kg));
  ok('keine Vorgabe erreicht die Datenbank als NULL', rows[1].target_weight_kg === null, JSON.stringify(rows[1].target_weight_kg));
}

/* ══ E9 · Die volle Kette ══ */
sec('E9 · Editor → user_week_plans → Reload → Anzeige → Sessionstart');
let E9 = null;
{
  const sb = makeSb({ rows: { exercises: LIB, workout_sessions: [] } });
  await new Promise(r => sb.gmExLibEnsure(r));
  const SP = sb.ORVIA.strengthPlan, PD = sb.ORVIA.planDomain;

  /* 1 · Im Editor drei Übungen anlegen und ausfüllen. */
  sb._planEdit = [[], [], [{ id: 'ps:g1', t: 'Gym', l: 'Oberkörper', d: '45 min' }], [], [], [], []];
  sb.peToggleEx(2, 0);
  const add = (id, sets) => { sb._els['pe_ex_sel_2_0'] = { value: id }; sb._els['pe_ex_sets_2_0'] = { value: String(sets) }; sb.peAddEx(2, 0); };
  add('ex-bench', 4); add('ex-row', 3); add('ex-ohp', 3);
  sb.peUpdateEx(2, 0, 0, 'minReps', { value: '6' }); sb.peUpdateEx(2, 0, 0, 'maxReps', { value: '8' });
  sb.peUpdateEx(2, 0, 0, 'targetWeightKg', { value: '82.5' }); sb.peUpdateEx(2, 0, 0, 'restSeconds', { value: '150' });
  sb.peUpdateEx(2, 0, 1, 'minReps', { value: '8' }); sb.peUpdateEx(2, 0, 1, 'maxReps', { value: '10' });
  sb.peUpdateEx(2, 0, 1, 'targetWeightKg', { value: '65' }); sb.peUpdateEx(2, 0, 1, 'restSeconds', { value: '120' });
  sb.peUpdateEx(2, 0, 2, 'minReps', { value: '8' }); sb.peUpdateEx(2, 0, 2, 'targetWeightKg', { value: '25' });
  /* Umsortieren, damit der Reload eine NICHT-triviale Reihenfolge trägt.
     peMoveEx nimmt eine RICHTUNG (±1), keine Zielposition — die Oberfläche hat
     Hoch/Runter-Knöpfe. Zweimal hoch schiebt die dritte Übung nach vorn. */
  sb.peMoveEx(2, 0, 2, -1);
  sb.peMoveEx(2, 0, 1, -1);
  const planned = SP.readPlanned(sb._planEdit[2][0]);
  ok('drei Übungen sind geplant', planned.length === 3);
  ok('die Reihenfolge nach dem Umsortieren ist ohp, bench, row',
    planned.map(e => e.exerciseId).join(',') === 'ex-ohp,ex-bench,ex-row', planned.map(e => e.exerciseId).join(','));

  /* 2 · Über das ECHTE Persistenzmodell speichern (kein UI-Schattenmodell). */
  const emptyWeek = [[], [], [{ id: 'ps:g1', t: 'Gym', l: 'Oberkörper', d: '45 min' }], [], [], [], []];
  let plan = PD.fromLegacyWeekPlan(emptyWeek, { source: 'manual_edit' }, { weekKey: '2026-W33', now: '2026-08-12T00:00:00Z', idFactory: () => 'ps:g1' });
  const ovs = PD.diffEditedDays(PD.effectiveSessions(plan), sb._planEdit, { now: '2026-08-12T00:01:00Z', reason: 'user_manual', ovIdFactory: () => 'ov:1' });
  ok('der Editor erzeugt genau EINEN inhaltlichen Override', ovs.length === 1 && ovs[0].type === 'replace', JSON.stringify(ovs.map(o => o.type)));
  ovs.forEach(o => { const r = PD.applyOverride(plan, o); if (!r.error) plan = r.plan; });

  /* 3 · Reload: exakt der Weg von weekPlanRepository (JSON in user_week_plans). */
  const reloaded = JSON.parse(JSON.stringify(plan));
  const eff = PD.effectiveSessions(reloaded);
  const item = (eff.sessions || []).map(s => s.session).find(s => s && s.t === 'Gym');
  const after = SP.readPlanned(item);
  ok('nach dem Reload sind es wieder drei Übungen', after.length === 3, JSON.stringify(after.length));
  ok('… in derselben Reihenfolge', after.map(e => e.exerciseId).join(',') === 'ex-ohp,ex-bench,ex-row', after.map(e => e.exerciseId).join(','));
  ok('… mit allen Sollwerten (Sätze, Wdh., Gewicht, Pause)',
    JSON.stringify(after) === JSON.stringify(planned), JSON.stringify(after));

  /* 4 · Anzeige nach dem Reload */
  const html = sb.gmPlannedLinesHTML(item);
  ok('die Wochenplan-Karte zeigt alle drei nach dem Reload', (html.match(/<li/g) || []).length === 3);
  ok('… mit Namen, Sätzen, Gewicht und Pause',
    /Schulterdrücken — 3 × 8 · 25 kg/.test(html) && /Bankdrücken — 4 × 6–8 · 82\.5 kg · 150 s Pause/.test(html), html);

  /* 5 · Sessionstart über den ECHTEN Store */
  const snap = { occurrenceId: 'po:2026-08-12:ps:g1', templateSessionId: 'ps:g1', plannedDate: '2026-08-12', t: item.t, l: item.l, d: item.d, capturedAt: 1, plannedExercises: after };
  const r = await sb.ORVIA.workoutStore.startFreeWorkout({ sport: 'Gym', plannedSessionId: snap.occurrenceId, planSnapshot: snap });
  ok('der Start meldet drei übernommene Übungen, keine fehlgeschlagene',
    r.data.plannedApplied.planned === 3 && r.data.plannedApplied.applied === 3 && r.data.plannedApplied.failed === 0,
    JSON.stringify(r.data.plannedApplied));
  const rows = sb._upserts.filter(u => u.table === 'workout_exercises').map(u => u.payload);
  ok('drei Zeilen in workout_exercises', rows.length === 3);
  ok('… in der geplanten Reihenfolge', rows.map(x => x.exercise_id).join(',') === 'ex-ohp,ex-bench,ex-row', rows.map(x => x.exercise_id).join(','));
  ok('… mit order_index 0,1,2', rows.map(x => x.order_index).join(',') === '0,1,2');
  ok('… mit exakt den geplanten Sollwerten',
    rows[1].target_weight_kg === 82.5 && rows[1].planned_sets === 4 && rows[1].min_reps === 6 && rows[1].max_reps === 8 && rows[1].rest_seconds === 150,
    JSON.stringify(rows[1]));
  ok('… und der Live-Logger kennt die Namen', sb.ORVIA.workout.exercises.map(e => (e.exercise || {}).name).join(',') === 'Schulterdrücken,Bankdrücken,Rudern',
    sb.ORVIA.workout.exercises.map(e => (e.exercise || {}).name).join(','));
  E9 = { sb, plan, PD, SP, snap, rows };
}

/* ══ E10 · Der Snapshot friert ein ══ */
sec('E10 · Spätere Planänderungen ändern die gestartete Einheit nicht');
{
  const { sb, snap } = E9;
  const sessRow = sb._upserts.filter(u => u.table === 'workout_sessions').map(u => u.payload).pop();
  const stored = sessRow.planned_session_snapshot;
  ok('der Snapshot ist in der Session gelandet', !!stored && Array.isArray(stored.plannedExercises), JSON.stringify(!!stored));
  ok('… mit den drei Vorgaben', stored.plannedExercises.length === 3);
  /* Jetzt den PLAN nachträglich ändern — der Snapshot darf sich nicht bewegen. */
  snap.plannedExercises[0].targetWeightKg = 999;
  snap.plannedExercises.push({ exerciseId: 'ex-pullup', order: 4, sets: 5, minReps: null, maxReps: null, targetWeightKg: null, targetRir: null, restSeconds: null, note: null });
  ok('eine spätere Planänderung erreicht den gespeicherten Snapshot NICHT',
    stored.plannedExercises.length === 3 && stored.plannedExercises[0].targetWeightKg === 25,
    JSON.stringify({ n: stored.plannedExercises.length, w: stored.plannedExercises[0].targetWeightKg }));
  ok('der Store hat eine TIEFE Kopie abgelegt (Quelltextvertrag)',
    /plannedSessionSnapshot:\s*opts\.planSnapshot\s*\?\s*JSON\.parse\(JSON\.stringify\(opts\.planSnapshot\)\)/.test(src('workout-store.js')));
  ok('und die Datenbank friert den Anker zusätzlich per Trigger ein (Migration 0026)',
    existsSync(new URL(_APPREL + 'supabase/migrations/0026_protect_planned_anchor.sql', import.meta.url)) ||
    existsSync(new URL('../migrations/0026_protect_planned_anchor.sql', import.meta.url)));
}

/* ══ E11 · Altbestand ══ */
sec('E11 · Bestehende Gym-Items ohne Übungen bleiben kompatibel');
{
  const sb = makeSb({ rows: { exercises: LIB, workout_sessions: [] } });
  await new Promise(r => sb.gmExLibEnsure(r));
  const PD = sb.ORVIA.planDomain;
  const old = [[], [], [{ id: 'ps:alt', t: 'Gym', l: 'Ganzkörper', d: '45 min' }], [], [], [], []];
  const plan = PD.fromLegacyWeekPlan(old, { source: 'manual_edit' }, { weekKey: '2026-W33', now: '2026-08-12T00:00:00Z', idFactory: () => 'ps:alt' });
  ok('ein Altbestands-Plan bleibt vertragsgültig', PD.validatePlan(JSON.parse(JSON.stringify(plan))).length === 0);
  const item = PD.effectiveSessions(plan).sessions[0].session;
  ok('die Karte sieht unverändert aus (kein leeres Gerüst)', sb.gmPlannedLinesHTML(item) === '');
  sb._planEdit = JSON.parse(JSON.stringify(old));
  sb.peToggleEx(2, 0);
  ok('der Editor öffnet sich trotzdem und zeigt „noch keine Übungen"',
    /Noch keine Übungen geplant/.test(sb._els.pe_scroll.innerHTML));
  const r = await sb.ORVIA.workoutStore.startFreeWorkout({ sport: 'Gym', planSnapshot: { occurrenceId: 'po:2026-08-12:ps:alt', t: 'Gym', l: 'Ganzkörper', capturedAt: 1 } });
  ok('der Start funktioniert unverändert und versucht keine Übernahme',
    r.success === true && r.data.plannedApplied === null);
}

/* ══ E12 · Kein stiller Erfolg ══ */
sec('E12 · Teilweise fehlgeschlagene Übernahme wird gemeldet');
{
  let n = 0;
  const sb = makeSb({
    rows: { exercises: LIB, workout_sessions: [] },
    upsertFails: table => (table === 'workout_exercises' ? (++n >= 2) : false)   /* erste geht durch, danach Fehler */
  });
  await new Promise(r => sb.gmExLibEnsure(r));
  const SP = sb.ORVIA.strengthPlan;
  const planned = SP.normalizePlanned([
    { exerciseId: 'ex-bench', sets: 4, targetWeightKg: 82.5 },
    { exerciseId: 'ex-row', sets: 3, targetWeightKg: 65 },
    { exerciseId: 'ex-ohp', sets: 3, targetWeightKg: 25 }
  ]).exercises;
  const r = await sb.ORVIA.workoutStore.startFreeWorkout({ sport: 'Gym', planSnapshot: { occurrenceId: 'po:x:ps:g1', t: 'Gym', capturedAt: 1, plannedExercises: planned } });
  ok('die Session entsteht trotzdem', r.success === true);
  ok('das Ergebnis nennt 1 von 3 übernommen und 2 fehlgeschlagen',
    r.data.plannedApplied.applied === 1 && r.data.plannedApplied.failed === 2 && r.data.plannedApplied.planned === 3,
    JSON.stringify(r.data.plannedApplied));
  ok('die Oberfläche meldet den Teilfehlschlag ausdrücklich (Quelltextvertrag workout-ui.js)',
    /pa\.failed\s*>\s*0/.test(src('workout-ui.js')) && /geplanten Übungen übernommen/.test(src('workout-ui.js')));
  ok('… und unterscheidet „gar keine" von „teilweise"',
    /Keine der .*geplanten Übungen/.test(src('workout-ui.js')));
}

/* ══ E13 · Feldparität im E2E ══ */
sec('E13 · Online und Offline schreiben dieselbe Feldmenge');
{
  const SP0 = makeSb({}).ORVIA.strengthPlan;
  const planned = SP0.normalizePlanned([{ exerciseId: 'ex-bench', sets: 4, minReps: 6, maxReps: 8, targetWeightKg: 82.5, targetRir: 2, restSeconds: 150 }]).exercises;
  const snap = { occurrenceId: 'po:x:ps:g1', t: 'Gym', capturedAt: 1, plannedExercises: planned };

  const on = makeSb({ online: true, rows: { exercises: LIB, workout_sessions: [] } });
  await on.ORVIA.workoutStore.startFreeWorkout({ sport: 'Gym', planSnapshot: snap });
  const onRow = on._upserts.find(u => u.table === 'workout_exercises').payload;

  const off = makeSb({ online: false, rows: { exercises: LIB } });
  await off.ORVIA.workoutStore.startFreeWorkout({ sport: 'Gym', planSnapshot: snap });
  await tick();
  const pending = await off.ORVIA.offlineQueue.pendingForCurrentUser();
  const offRow = (pending.find(p => p.table === 'workout_exercises') || {}).payload || {};

  const onK = Object.keys(onRow).filter(k => k !== 'user_id').sort();
  const offK = Object.keys(offRow).filter(k => k !== 'user_id').sort();
  ok('beide Wege wurden wirklich durchlaufen', onK.length > 5 && offK.length > 5, onK.length + ' / ' + offK.length);
  ok('dieselbe Spaltenmenge — auch am Ende der Nutzerkette', onK.join(',') === offK.join(','),
    'nur online: ' + onK.filter(k => offK.indexOf(k) < 0).join(',') + ' | nur offline: ' + offK.filter(k => onK.indexOf(k) < 0).join(','));
  ok('… und dieselben Werte für die Kraftvorgaben',
    onRow.target_weight_kg === offRow.target_weight_kg && onRow.planned_sets === offRow.planned_sets &&
    onRow.min_reps === offRow.min_reps && onRow.rest_seconds === offRow.rest_seconds,
    JSON.stringify({ on: onRow.target_weight_kg, off: offRow.target_weight_kg }));
}

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
