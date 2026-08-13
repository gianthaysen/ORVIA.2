/* ORVIA · v8-310a — Kalenderidentität und Aktionssperre (Gians P0)

   Drei Befunde einer Review-Runde am echten Geraet:
     1. _wOff wurde im Renderer benutzt, bevor es deklariert war (Hoisting) —
        die Kopfzeile zeigte „undefined Wochen voraus" und „NaN.NaN." OHNE
        Exception, weil setDate(NaN) nicht wirft.
     2. planEntryClick reichte das Datum der GEBLAETTERTEN Woche nicht durch —
        plannedOccurrenceIdFor rechnete immer die laufende Woche. Falsche
        Occurrence-IDs binden Erledigt-Status und Debriefs an falsche Tage.
     3. P0: openUnit entschied per WOCHENTAGSINDEX ueber „Training starten" —
        in einer geblaetterten Woche war derselbe Wochentag wie heute
        faelschlich bedienbar.

   Vertrag (v2.1): Jeder Klick erhaelt dateIso der dargestellten Woche;
   Starten/Erledigen NUR wenn dateIso === heute; Vergangenheit/Zukunft nur
   lesbar (Debrief: Vergangenheit erlaubt, Zukunft gesperrt); keine Aktion
   rekonstruiert das Datum spaeter aus _wOff oder di.

   node supabase/tests/plan_calendar_identity_test.mjs [appRoot] */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const uiRaw = readFileSync(join(APP, 'js/ui.js'), 'utf8');

function sliceBalanced(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) throw new Error('Slice fehlt: ' + marker);
  let d = 0, started = false;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') { d++; started = true; }
    else if (ch === '}') { d--; if (started && d === 0) {
      let k = j + 1; while (k < src.length && /\s/.test(src[k])) k++;
      return src.slice(i, src[k] === ';' ? k + 1 : j + 1);
    } }
  }
  throw new Error('unbalancierter Slice: ' + marker);
}

const todayIso = new Date().toISOString().slice(0, 10);
const addD = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const nextWeekSameWeekday = addD(todayIso, 7);

/* ══════════════════════════════════════════════════════════════ */
sec('K1 · Wochenkopf: pure Funktion, nie undefined/NaN');
{
  const src = sliceBalanced(uiRaw, 'function gmPlanWeekHeader(');
  const hdr = new Function(src + '\nreturn gmPlanWeekHeader;')();
  const cases = [[-2, ' Wochen zurück'], [-1, 'Letzte Woche'], [0, 'Diese Woche'], [1, 'Nächste Woche'], [2, ' Wochen voraus']];
  ok('alle Versaetze liefern ein Label ohne „undefined" und einen Zeitraum ohne NaN',
    cases.every(([o, frag]) => {
      const h = hdr(o);
      return h && h.label.indexOf(frag) >= 0 && !/undefined|NaN/.test(h.label + h.range) &&
        /^\d{1,2}\.\d{1,2}\. – \d{1,2}\.\d{1,2}\.$/.test(h.range);
    }), JSON.stringify(hdr(2)));
  ok('DER ALTE FEHLER: ein nicht-numerischer Versatz (undefined) faellt auf 0 zurueck statt NaN zu produzieren',
    hdr(undefined).label === 'Diese Woche' && !/NaN/.test(hdr(undefined).range));
  /* Quelltext-Vertrag: der Renderer nutzt die Funktion, und _wOff ist VOR der
     Kopfzeile deklariert — die Hoisting-Falle kann nicht zurueckkommen. */
  const declPos = uiRaw.indexOf("var _wOff=(typeof gmPlanWeekOff==='function')?gmPlanWeekOff():0;");
  const usePos = uiRaw.indexOf('gmPlanWeekHeader(_wOff)');
  ok('der Renderer deklariert _wOff VOR der Kopfzeile und nutzt gmPlanWeekHeader',
    declPos >= 0 && usePos >= 0 && declPos < usePos &&
    uiRaw.split("var _wOff=(typeof gmPlanWeekOff==='function')?gmPlanWeekOff():0;").length === 2,
    'decl@' + declPos + ' use@' + usePos);
}

/* ══════════════════════════════════════════════════════════════ */
sec('K2 · Occurrence der DARGESTELLTEN Woche — Datum vom Klick');
{
  const src = sliceBalanced(uiRaw, 'function plannedOccurrenceIdForDate(');
  const f = new Function(src + '\nreturn plannedOccurrenceIdForDate;')();
  ok('die Occurrence traegt exakt das Klick-Datum',
    f({ id: 'psg:0:0:iv' }, nextWeekSameWeekday) === 'po:' + nextWeekSameWeekday + ':psg:0:0:iv');
  ok('ohne Datum oder ohne Template-ID: null, nichts Erfundenes',
    f({ id: 'x' }, null) === null && f({}, todayIso) === null);

  /* Die volle Klickkette: planEntryClick reicht das Datum an den Resolver. */
  const chain = sliceBalanced(uiRaw, 'function planLocalDateForIndex(') + '\n' +
    sliceBalanced(uiRaw, 'function plannedOccurrenceIdForDate(') + '\n' +
    sliceBalanced(uiRaw, 'function planEntryClick(');
  const seen = [];
  const env = {
    window: { ORVIA: { activityUI: { resolvePlannedActivity: o => { seen.push(o); return { status: 'none' }; } } } },
    activeWeekPlan: () => [[{ id: 'psg:0:0:iv', t: 'Laufen', l: 'Intervalle', d: '40 min' }]],
    openUnit: () => {}, toast: () => {},
    todayStr: d => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000) : new Date(Date.now() - new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 10)
  };
  const run = new Function('window', 'activeWeekPlan', 'openUnit', 'toast', 'todayStr', 'ORVIA',
    chain + '\nreturn planEntryClick;')(env.window, env.activeWeekPlan, env.openUnit, env.toast, env.todayStr, env.window.ORVIA);
  run(0, 0, nextWeekSameWeekday);
  ok('planEntryClick fragt den Resolver mit der Occurrence der GEBLAETTERTEN Woche',
    seen.length === 1 && seen[0] === 'po:' + nextWeekSameWeekday + ':psg:0:0:iv', seen[0]);
  run(0, 0);
  ok('HAERTUNG: ohne Klick-Datum wird KEINE Occurrence rekonstruiert — der Resolver bleibt unbefragt',
    seen.length === 1);
}

/* ══════════════════════════════════════════════════════════════ */
sec('K3 · P0-GEGENPROBE: das Datum sperrt Aktionen, nicht der Wochentag');
{
  const src = sliceBalanced(uiRaw, 'function planLocalDateForIndex(') + '\n' +
    sliceBalanced(uiRaw, 'function openUnit(');
  const mk = captured => new Function('activeWeekPlan', 'unitKind', 'unitBodyRun', 'unitBodyBike', 'unitBodyOther',
    'uiDetailMode', 'escH', 'icon', 'oModal', 'todayStr', 'closeSupp', 'openPlanEditor',
    src + '\nreturn openUnit;')(
    () => [[{ id: 'psg:0:0:iv', t: 'Laufen', l: 'Intervalle', d: '40 min' }]],
    () => 'interval', () => 'body', () => 'body', () => 'body',
    () => 'fortgeschritten', s => s, () => '', (t, b, f) => captured.push(f),
    d => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000) : new Date(Date.now() - new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 10),
    () => {}, () => {});
  const today = [], future = [];
  mk(today)(0, 0, todayIso);
  mk(future)(0, 0, nextWeekSameWeekday);
  ok('HEUTE: Starten und Erledigen sind da',
    today.length === 1 && /Training starten/.test(today[0]) && /Als erledigt markieren/.test(today[0]));
  ok('GEGENPROBE — naechste Woche, GLEICHER Wochentag: kein Starten, kein Erledigen',
    future.length === 1 && !/Training starten/.test(future[0]) && !/Als erledigt markieren/.test(future[0]));
  ok('… stattdessen der ehrliche Nur-lesbar-Hinweis', /Nur lesbar/.test(future[0]));
  ok('… und die Buttons tragen das Klick-Datum weiter (kein di-Rueckbau)',
    new RegExp("startPlannedUnit\\(0,0,'" + todayIso + "'\\)").test(today[0]));
}

/* ══════════════════════════════════════════════════════════════ */
sec('K4 · Zweiter Riegel: die Aktionen selbst verweigern fremde Tage');
{
  const src = sliceBalanced(uiRaw, 'function planLocalDateForIndex(') + '\n' +
    sliceBalanced(uiRaw, 'function plannedOccurrenceIdForDate(') + '\n' +
    sliceBalanced(uiRaw, 'function planNoteFor(') + '\n' +
    sliceBalanced(uiRaw, 'function startPlannedUnit(');
  const started = [];
  const start = new Function('activeWeekPlan', 'closeSupp', 'toast', 'todayStr', 'window', 'unitKind', 'unitStruct',
    src + '\nreturn startPlannedUnit;')(
    () => [[{ id: 'psg:0:0:iv', t: 'Laufen', l: 'Intervalle', d: '40 min' }]],
    () => {}, () => {},
    d => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000) : new Date(Date.now() - new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 10),
    { ORVIA: { workoutUI: { startSport: (t, o) => started.push(o) } } },
    () => 'interval', () => null);
  const r1 = start(0, 0, nextWeekSameWeekday);
  ok('startPlannedUnit verweigert einen fremden Tag: not_today, KEIN Start',
    r1 && r1.ok === false && r1.code === 'not_today' && started.length === 0, JSON.stringify(r1));
  const r2 = start(0, 0, todayIso);
  ok('… heute startet er, mit heutiger Occurrence im Snapshot',
    r2 && r2.ok === true && started.length === 1 &&
    started[0].plannedSessionId === 'po:' + todayIso + ':psg:0:0:iv' &&
    started[0].planSnapshot.plannedDate === todayIso, JSON.stringify(started[0] && started[0].plannedSessionId));
  /* HAERTUNG (Gians Abschlussforderung): datumslose Aktionen sind ein
     benannter Vertragsbruch — keine stille Rekonstruktion, keine Mutation. */
  const r0 = start(0, 0);
  ok('GEGENPROBE datumsloser Start ⇒ missing_date_context, NICHTS gestartet',
    r0 && r0.ok === false && r0.code === 'missing_date_context' && started.length === 1, JSON.stringify(r0));
  const mpdSrc = uiRaw.slice(uiRaw.indexOf('function markPlannedDone('), uiRaw.indexOf('function markPlannedDone(') + 1200);
  ok('GEGENPROBE datumsloses Erledigen ⇒ missing_date_context VOR jeder Mutation',
    /missing_date_context/.test(mpdSrc) && mpdSrc.indexOf('missing_date_context') < mpdSrc.indexOf('not_today'));
  const dbSrc = uiRaw.slice(uiRaw.indexOf('function gmOpenDebriefAt('), uiRaw.indexOf('function gmOpenDebriefAt(') + 1400);
  ok('GEGENPROBE datumsloses Debrief ⇒ Abbruch; KEINE gmPlanWeekOff-Rekonstruktion mehr',
    /fehlender Datumskontext/.test(dbSrc) && !/gmPlanWeekOff/.test(dbSrc));
  ok('… und die Detailansichten ohne Datum sind nur lesbar (kein Rueckbau auf planLocalDateForIndex)',
    !/dateIso\|\|\(\(typeof planLocalDateForIndex/.test(uiRaw));

  /* markPlannedDone: der Slice ist gross — geprueft wird der Quelltext-Vertrag
     plus das not_today-Verhalten ueber die frueh liegende Sperre. */
  const mpd = uiRaw.slice(uiRaw.indexOf('function markPlannedDone('), uiRaw.indexOf('function markPlannedDone(') + 1600);
  ok('markPlannedDone traegt den Datumsparameter und die not_today-Sperre VOR jeder Mutation',
    /function markPlannedDone\(type,di,ii,dateIso\)/.test(mpd) &&
    /not_today/.test(mpd) && mpd.indexOf('not_today') < mpd.indexOf('entry(') &&
    /plannedOccurrenceIdForDate/.test(mpd) && !/plannedOccurrenceIdFor\(it,di\)/.test(mpd));
  ok('gmOpenDebriefAt: Klick-Datum statt gmPlanWeekOff-Rekonstruktion, Zukunft gesperrt',
    /function gmOpenDebriefAt\(di,ii,clickDateIso\)/.test(uiRaw) &&
    /dateIso>todayStr\(\)/.test(uiRaw.slice(uiRaw.indexOf('function gmOpenDebriefAt('))));
}

/* ══════════════════════════════════════════════════════════════ */
sec('K5 · Emitter: jede gerenderte Karte gibt ihr Datum mit');
{
  /* Der Waechter zaehlt BEIDE Emitter (onclick UND onkeydown) — die erste
     Fassung matchte nur EINEN Treffer und uebersah eine Mutation, die nur
     dem onclick das Datum nahm (Mutationsprobe B fing nicht). */
  ok('Wochenliste: planEntryClick erhaelt das Tagesdatum k in onclick UND onkeydown — und nirgends datumslos',
    uiRaw.split("planEntryClick('+di+','+ii+',\\''+gmEsc(k)+'\\')").length >= 3 &&
    uiRaw.indexOf("planEntryClick('+di+','+ii+')") < 0);
  ok('Dashboard-Karten (sess5): ebenfalls',
    uiRaw.indexOf("planEntryClick(${i},${idx},'${k}')") >= 0);
  ok('Debrief-Link: ebenfalls',
    /gmOpenDebriefAt\('\+di\+','\+ii\+',\\''\+gmEsc\(k\)\+'\\'\)/.test(uiRaw));
  ok('openUnit entscheidet NICHT mehr per Wochentagsindex ueber Aktionen',
    !/di===todayIdx/.test(uiRaw));
}

/* ══════════════════════════════════════════════════════════════ */
sec('K6 · Drei Tageszustaende: leer ≠ Ruhetag');
{
  const src = sliceBalanced(uiRaw, 'function gmDayStateFor(');
  const f = new Function(src + '\nreturn gmDayStateFor;')();
  const cfg = { restDayIdx: [3], preferredRestDayIdx: [], availableDayIdx: [0, 1, 2, 3, 4, 5] };
  ok('konfigurierter Ruhetag (Do) ⇒ rest', f(3, cfg) === 'rest');
  ok('DER NUTZERBEFUND: leerer Sonntag ohne Verfuegbarkeit ⇒ unavailable — nicht „Ruhetag"',
    f(6, cfg) === 'unavailable');
  ok('leerer verfuegbarer Tag ⇒ free', f(5, cfg) === 'free');
  ok('bevorzugter Ruhetag zaehlt als rest', f(2, { preferredRestDayIdx: [2] }) === 'rest');
  ok('ohne gepflegte Verfuegbarkeit ist NIEMAND „unavailable" (fail-open zu free, nie zu rest)',
    f(6, null) === 'free' && f(6, { availableDayIdx: [] }) === 'free');
  ok('beide leere-Tag-Renderer nutzen die Zustandsfunktion — kein hartkodiertes „Ruhetag" mehr',
    uiRaw.split('gmDayStateFor(').length >= 4 &&
    /Nicht verfügbar/.test(uiRaw) && uiRaw.indexOf('· Ruhetag</b>') < 0);
}

/* ══════════════════════════════════════════════════════════════ */
sec('K7 · GEGENPROBE Aktivitäten-Hub: expliziter heutiger Kontext, funktionsfähig');
{
  /* Gians Nachforderung: Der Hub-Einstieg („Aktivitäten → Training starten →
     Geplant") muss das heutige dateIso AUSDRUECKLICH uebergeben und weiter
     funktionieren — sonst repariert 310a die Plankarte und bricht den Hub. */
  ok('der Hub uebergibt Auswahl UND todayStr() ausdruecklich — kein Index-0-/Legacy-Fallback',
    /gmPlannedStartSelection\(sport\)/.test(uiRaw) &&
    /startPlannedUnit\(sel\.di,sel\.ii,todayStr\(\)\)/.test(uiRaw) &&
    !/startPlannedUnit\(\(new Date\(\)\.getDay\(\)\+6\)%7,0/.test(uiRaw));
  /* Verhaltensfall: die volle Hub-Kette startet die heutige Einheit. */
  const src = sliceBalanced(uiRaw, 'function planLocalDateForIndex(') + '\n' +
    sliceBalanced(uiRaw, 'function plannedOccurrenceIdForDate(') + '\n' +
    sliceBalanced(uiRaw, 'function planNoteFor(') + '\n' +
    sliceBalanced(uiRaw, 'function startPlannedUnit(') + '\n' +
    sliceBalanced(uiRaw, 'function gmPlannedStartSelection(') + '\n' +
    'var _gmStartCtx={mode:"planned",sport:"Laufen"};\n' +
    sliceBalanced(uiRaw, 'function gmStartFromPreStart(');
  const startedHub = [];
  const todayStrImpl = d => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000) : new Date(Date.now() - new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
  const hub = new Function('activeWeekPlan', 'closeSupp', 'gmCloseSheets', 'toast', 'todayStr', 'window', 'ORVIA', 'unitKind', 'unitStruct',
    src + '\nreturn gmStartFromPreStart;')(
    () => { const w = [[], [], [], [], [], [], []]; w[(new Date().getDay() + 6) % 7] = [{ id: 'psg:h:0:iv', t: 'Laufen', l: 'Intervalle', d: '40 min' }]; return w; },
    () => {}, () => {}, () => {}, todayStrImpl,
    { ORVIA: { workoutUI: { startSport: (t, o) => startedHub.push(o || { free: true }) } } },
    { workoutUI: { startSport: (t, o) => startedHub.push(o || { free: true }) } },
    () => 'interval', () => null);
  hub();
  ok('VERHALTENSFALL: der Hub startet die heutige Einheit mit heutiger Occurrence',
    startedHub.length === 1 && startedHub[0].plannedSessionId === 'po:' + todayIso + ':psg:h:0:iv',
    JSON.stringify(startedHub[0] && startedHub[0].plannedSessionId));
}

console.log('\n' + '═'.repeat(62));
console.log('Ergebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
if (fail) process.exit(1);
