/* ============================================================
   ORVIA · manual_day_edge (v8-447.1) — BEKANNTER REST, hier nachgestellt und festgehalten.

   Befund: Eine MANUELL eingegebene Einheit spaet am Abend wird nach dem Weg ueber den Server
   in Summen, Belastung und Plan-Zuordnung dem FOLGETAG zugerechnet — waehrend Liste und
   Detailseite (seit v8-447) weiter den eingegebenen Tag zeigen.

   Ursache:
     1. Die Eingabe erzeugt eine WANDZEIT ohne Zone:  '2026-07-12T22:30:00'   (activity.js)
     2. activity-sync sendet sie unveraendert; die Spalte ist timestamptz, die Datenbank
        liest den Text als UTC und liefert '2026-07-12T22:30:00+00:00' zurueck.
     3. activityConfig.dayOfActLocal behandelt jeden startedAt als ZEITPUNKT und rechnet in
        die Zone des Nutzers um: 22:30 UTC = 00:30 MESZ am 13.
     Solange die Einheit nur lokal liegt (Schritt 1), stimmt der Tag — der Fehler entsteht
     erst mit dem Abgleich.

   Betroffen: nur Quelle manual / import, nur mit eingegebener Uhrzeit ab 22:00 (Sommer)
   bzw. 23:00 (Winter). Ohne Uhrzeit wird 00:00 gespeichert — nicht betroffen.
   Garmin-Aktivitaeten und ORVIA-Workouts tragen echte Zeitpunkte — nicht betroffen.

   Schwere: MITTEL-NIEDRIG. Selten, aber dann falscher Tag in Wochensumme, Tagesbelastung,
   Plan-Zuordnung; an einem Sonntagabend falsche Woche.

   NICHT in v8-447.1 behoben (Auftrag: nicht still aendern): die Korrektur beruehrt jeden
   Verbraucher von dayOfActLocal (Belastung, Wochensumme, Plan-Zuordnung, Review, Kapazitaet)
   und einen Test, der import-Zeilen als Zeitpunkte festschreibt. Empfehlung am Ende.

   Abschnitt B dieses Tests HAELT DEN FEHLER FEST. Wird er behoben, muss B bewusst umgestellt
   werden — der Test schlaegt dann an, und das ist gewollt.
   node supabase/tests/manual_day_edge_v4471_test.mjs
   ============================================================ */
process.env.TZ = 'Europe/Berlin';            // vor jeder Datumsrechnung: die Zone des Geraets im Test
import { existsSync as _exApp } from 'node:fs';
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = v => JSON.stringify(v);

const mem = {};
globalThis.window = globalThis;
globalThis.ORVIA = { user: { id: 'u1' } };
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const imp = async f => (await import(new URL(_APPREL + f, import.meta.url))).default;
await imp('js/activity-effective.js');
await imp('js/activity-normalize.js');
await imp('js/training-domain.js');
globalThis.ORVIA.onboardingSportsLogic = await imp('js/onboarding/onboarding-sports-logic.js');
const C = await imp('js/activity-config.js');
const AT = await imp('js/activity-time.js');
const TZ = 'Europe/Berlin';

/* so entsteht die Einheit in der Eingabemaske (activity.js): Datum + 'T' + Uhrzeit + ':00' */
const entered = (date, time) => ({ id: 'm1', sportId: 'running', source: 'manual', sourceRecordId: 'manual:' + date + ':running',
  startedAt: date + 'T' + time + ':00', durationSeconds: 3600, status: 'completed', summary: {}, metrics: { time } });
/* so kommt sie vom Server zurueck: timestamptz, als UTC gelesen */
const fromServer = a => C.normalizeServerActivity({ id: 'srv1', sport_id: a.sportId, source: a.source, source_record_id: a.sourceRecordId,
  started_at: a.startedAt + '+00:00', duration_seconds: a.durationSeconds, status: 'completed', summary: {}, metrics: a.metrics });

sec('A · nur lokal: der Tag stimmt');
{
  const a = entered('2026-07-12', '22:30');
  ok('A1 Sommer 22:30, noch nicht abgeglichen: Tageszuordnung = eingegebener Tag', C.dayOfActLocal(a, TZ) === '2026-07-12', C.dayOfActLocal(a, TZ));
  ok('A2 Anzeige = eingegebene Uhrzeit', J(AT.localParts(a, TZ)) === J({ date: '2026-07-12', time: '22:30', basis: 'wall_clock' }));
}

sec('B · nach dem Abgleich: BEKANNTER FEHLER (hier festgehalten)');
{
  const s = fromServer(entered('2026-07-12', '22:30'));
  const shown = AT.localParts(s, TZ);
  const day = C.dayOfActLocal(s, TZ);
  ok('B1 Anzeige bleibt richtig: 12.07., 22:30 (v8-447)', shown.date === '2026-07-12' && shown.time === '22:30' && shown.basis === 'wall_clock', J(shown));
  ok('B2 BEKANNTER FEHLER: die Tageszuordnung faellt auf den 13.07.', day === '2026-07-13', day);
  ok('B3 … Anzeige und Tageszuordnung widersprechen sich also um einen Tag', shown.date !== day);

  const week = C.weeklyActivityTotals([s], {}, { weekRef: '2026-07-12', timezone: TZ });
  const inWeek = week.totals.sessionCount;
  const next = C.weeklyActivityTotals([s], {}, { weekRef: '2026-07-13', timezone: TZ });
  const inNext = next.totals.sessionCount;
  ok('B4 Folge am Sonntagabend (12.07.2026 ist ein Sonntag): die Einheit zaehlt in der FOLGEWOCHE', inWeek === 0 && inNext === 1, J({ dieseWoche: inWeek, folgewoche: inNext, tage: week.days && [week.days[0], week.days[6]] }));

  ok('B5 Grenze Sommer: 21:59 bleibt am Tag, 22:00 kippt', C.dayOfActLocal(fromServer(entered('2026-07-12', '21:59')), TZ) === '2026-07-12' && C.dayOfActLocal(fromServer(entered('2026-07-12', '22:00')), TZ) === '2026-07-13');
  ok('B6 Grenze Winter: 22:59 bleibt am Tag, 23:00 kippt', C.dayOfActLocal(fromServer(entered('2026-01-12', '22:59')), TZ) === '2026-01-12' && C.dayOfActLocal(fromServer(entered('2026-01-12', '23:00')), TZ) === '2026-01-13');
}

sec('C · nicht betroffen');
{
  ok('C1 manuell OHNE Uhrzeit (00:00): Tag stimmt auch nach dem Abgleich', C.dayOfActLocal(fromServer(entered('2026-07-12', '00:00')), TZ) === '2026-07-12');
  ok('C2 manuell tagsueber (07:15, 18:40): Tag stimmt', ['07:15', '18:40'].every(t => C.dayOfActLocal(fromServer(entered('2026-07-12', t)), TZ) === '2026-07-12'));
  /* Garmin: echter Zeitpunkt. 22:30 Ortszeit = 20:30 UTC */
  const g = C.normalizeServerActivity({ id: 'g1', sport_id: 'running', source: 'garmin', source_record_id: '4711', started_at: '2026-07-12T20:30:00+00:00',
    duration_seconds: 3600, status: 'completed', summary: {}, metrics: { garmin: { start_local: '2026-07-12T22:30:00', start_gmt: '2026-07-12T20:30:00Z', utc_offset_s: 7200 } } });
  ok('C3 Garmin 22:30 Ortszeit: Anzeige und Tageszuordnung stimmen ueberein', C.dayOfActLocal(g, TZ) === '2026-07-12' && AT.localParts(g, TZ).date === '2026-07-12' && AT.localParts(g, TZ).time === '22:30');
  const w = C.normalizeServerActivity({ id: 'w1', sport_id: 'gym', source: 'orvia_workout', source_record_id: 's1', started_at: '2026-07-12T21:45:00+00:00', duration_seconds: 2700, status: 'completed', summary: {}, metrics: {} });
  ok('C4 ORVIA-Workout 23:45 Ortszeit: gleicher Tag in Anzeige und Zuordnung', C.dayOfActLocal(w, TZ) === '2026-07-12' && AT.localParts(w, TZ).date === '2026-07-12' && AT.localParts(w, TZ).time === '23:45');
  /* Garmin nach Mitternacht Ortszeit: 00:30 MESZ am 13. = 22:30 UTC am 12. → Tag 13. (richtig!) */
  const late = C.normalizeServerActivity({ id: 'g2', sport_id: 'running', source: 'garmin', source_record_id: '4712', started_at: '2026-07-12T22:30:00+00:00', duration_seconds: 1800, status: 'completed', summary: {}, metrics: {} });
  ok('C5 Gegenprobe: derselbe gespeicherte Zeitpunkt ist bei Garmin WIRKLICH der 13.', C.dayOfActLocal(late, TZ) === '2026-07-13' && AT.localParts(late, TZ).date === '2026-07-13');
}

sec('D · was eine Korrektur leisten muesste (Vorgabe, nicht umgesetzt)');
{
  /* Die Regel, die Anzeige und Zuordnung in Einklang braechte: fuer Wandzeit-Quellen den Tag
     aus dem Text nehmen — genau das, was activity-time schon tut. Hier nur als Erwartung. */
  const s = fromServer(entered('2026-07-12', '22:30'));
  const wantDay = AT.kind(s) === 'wall' ? AT.localParts(s, TZ).date : C.dayOfActLocal(s, TZ);
  ok('D1 Zielbild: Tag einer Wandzeit-Quelle = angezeigter Tag', wantDay === '2026-07-12');
  ok('D2 … fuer Zeitpunkt-Quellen aendert sich dabei nichts', AT.kind({ source: 'garmin', startedAt: '2026-07-12T22:30:00+00:00' }) === 'instant');
}

console.log('\n' + (fail ? '❌' : '✅') + ' manual_day_edge_v4471: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
