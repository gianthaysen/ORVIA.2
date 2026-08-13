/* ORVIA · Load History (Bauplan Stufe 3 / C1)

   Geprüfte Zusagen:
     H1  Fehlende Aktivitäten sind fehlende DATEN, niemals Nullbelastung
     H2  Last, Datenvollständigkeit und Toleranz bleiben drei getrennte Größen
     H3  Gleiche Muskelschlüssel wie load-profile — ein Lastmodell, nicht zwei
     H4  Krafttraining zählt über Sätze, nicht über „eine Einheit"
     H5  Ratio bei dünner Datenlage `insufficient_data`, nie eine Zahl
     H6  trainingState ist additiv und widerspricht den Rohwerten nie
     H7  Monotony/Strain sind advisory und steuern nichts
     H8  Toleranz kommt aus eingefrorenen Debriefs, nicht aus der Last
     H9  Purität und Robustheit

   node supabase/tests/load_history_test.mjs [appRoot-absolut] */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
/* ROBUSTE APP-AUFLOESUNG: Das Repo existiert in zwei Layouts — kanonisch
   (app/supabase/tests, App-Wurzel = HERE/../..) und umstrukturiert
   (supabase/tests neben app/, App-Wurzel = HERE/../../app). Eine starre
   Aufloesung fand im jeweils anderen Layout den falschen Ordner und liess
   die GANZE Suite scheinbar fehlschlagen (0/46 statt gruen). Gesucht wird
   deshalb der erste Kandidat mit index.html UND js/engine. */
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const LP = require(join(APP, 'js/engine/load-profile.js'));
const E = require(join(APP, 'js/engine/evidence.js'));
const SD = require(join(APP, 'js/engine/session-debrief.js'));
const LH = require(join(APP, 'js/engine/load-history.js'));

const TODAY = '2026-08-07';
const day = n => new Date(Date.parse(TODAY + 'T12:00:00Z') - n * 86400000).toISOString().slice(0, 10);
/* 28 Tage durchgehend geloggt: 5 lockere, 1 langer, 1 Ruhetag je Woche. */
const vollstaendig = () => {
  const out = [], rest = [];
  for (let i = 0; i < 28; i++) {
    if (i % 7 === 6) { rest.push(day(i)); continue; }
    out.push({ date: day(i), sportId: 'running', durationMin: i % 7 === 0 ? 90 : 50,
      subType: i % 7 === 0 ? 'long' : 'easy' });
  }
  return { activities: out, knownDays: rest.concat(out.map(a => a.date)) };
};

/* ══════════════════════════════════════════════════════════════ */
sec('H1 · Fehlende Daten sind keine Nullbelastung');
{
  /* DER KERNFALL DIESES MODULS. Zwei Szenarien, die eine naive Umsetzung
     verwechseln wuerde:
       A) Der Athlet hat die letzte Woche wirklich pausiert (bestaetigt).
       B) Der Athlet hat die letzte Woche nicht geloggt.
     Verwechselt man sie, schliesst die Engine bei B auf „gut erholt, jetzt
     steigern" — ausgerechnet bei jemandem, der vielleicht durchtrainiert hat. */
  const v = vollstaendig();
  const alt = v.activities.filter(a => a.date < day(7));

  const A = LH.buildHistory({ activities: alt, knownDays: Array.from({ length: 8 }, (_, i) => day(i)).concat(v.knownDays),
    today: TODAY, days: 28 });
  const B = LH.buildHistory({ activities: alt, today: TODAY, days: 28 });

  ok('A: bestätigte Pause erzeugt KEINE Lücken der letzten Woche',
    A.gaps.filter(g => g.date >= day(7)).length === 0, String(A.gaps.length));
  ok('B: nicht geloggte Woche erzeugt Lücken',
    B.gaps.filter(g => g.date >= day(7)).length >= 7, String(B.gaps.length));
  ok('die beiden Fälle sind unterscheidbar', A.completeness !== B.completeness,
    `${A.completeness} vs ${B.completeness}`);
  ok('bestätigte Ruhetage sind als solche markiert', A.byDay[day(3)].confirmedRest === true);
  ok('unbekannte Tage sind als unbekannt markiert', B.byDay[day(3)].unknown === true);
  ok('… und tragen KEINE Last von 0 als Aussage',
    B.byDay[day(3)].unknown === true && B.byDay[day(3)].systemic === 0 &&
    B.rolling[7].knownDays === 0, 'knownDays7=' + B.rolling[7].knownDays);

  /* Die Rollierenden duerfen unbekannte Tage nicht als 0 mitteln. */
  ok('das 7-Tage-Fenster zählt nur bekannte Tage',
    B.rolling[7].completeness === 0 && B.rolling[7].systemicPerKnownDay === null,
    String(B.rolling[7].systemicPerKnownDay));
  ok('… und weist die Vollständigkeit aus', 'completeness' in B.rolling[7]);

  /* Und der entscheidende Unterschied im Ergebnis. */
  ok('B liefert KEINE Ratio', B.acuteChronic.ratio === null && B.acuteChronic.band === 'insufficient_data',
    B.acuteChronic.band);
  ok('A liefert eine Ratio', A.acuteChronic.ratio != null, String(A.acuteChronic.ratio));
  ok('B nennt den Grund', B.acuteChronic.reason === 'completeness_below_threshold', B.acuteChronic.reason);
}

/* ══════════════════════════════════════════════════════════════ */
sec('H2 · Last, Vollständigkeit und Toleranz bleiben getrennt');
{
  const v = vollstaendig();
  const h = LH.buildHistory({ activities: v.activities, knownDays: v.knownDays, today: TODAY, days: 28 });
  ok('Last steht in rolling/byDay', h.rolling[7].systemic > 0);
  ok('Vollständigkeit steht in completeness/gaps', typeof h.completeness === 'number' && Array.isArray(h.gaps));
  ok('Toleranz steht in toleranceState', 'toleranceState' in h);
  ok('… und ist ohne Debriefs nicht „gut", sondern unknown',
    h.toleranceState.systemic.status === 'unknown', h.toleranceState.systemic.status);
  ok('viel Last erzeugt KEINE Toleranzaussage',
    h.rolling[7].systemic > 0 && h.toleranceState.systemic.status === 'unknown');
  ok('vollständige Daten erzeugen KEINE Toleranzaussage',
    h.completeness === 1 && h.toleranceState.systemic.status === 'unknown', String(h.completeness));
  ok('die Konsistenz misst nur bekannte Tage',
    h.trainingState.consistency != null && h.trainingState.knownDays === h.trainingState.totalDays);
}

/* ══════════════════════════════════════════════════════════════ */
sec('H3 · Ein Lastmodell, nicht zwei');
{
  const v = vollstaendig();
  const h = LH.buildHistory({ activities: v.activities, knownDays: v.knownDays, today: TODAY, days: 28 });
  ok('dieselben 15 Muskelgruppen wie load-profile',
    JSON.stringify(LH.MUSCLES) === JSON.stringify(LP.MUSCLES), LH.MUSCLES.length + ' vs ' + LP.MUSCLES.length);
  ok('das rollierende Fenster deckt alle Gruppen ab',
    LP.MUSCLES.every(m => m in h.rolling[7].perMuscle));
  ok('Erholung wird für alle Gruppen geführt',
    LP.MUSCLES.every(m => m in h.muscleReadiness));
  ok('nie belastete Gruppen sind null, nicht 1',
    h.muscleReadiness.chest === null, String(h.muscleReadiness.chest));
  ok('belastete Gruppen liegen zwischen 0 und 1',
    h.muscleReadiness.quads >= 0 && h.muscleReadiness.quads <= 1, String(h.muscleReadiness.quads));

  /* Die Einzellast muss der Quelle folgen, nicht einer eigenen Rechnung. */
  const easy = LH.loadOf({ sportId: 'running', durationMin: 60, subType: 'easy' });
  const hard = LH.loadOf({ sportId: 'running', durationMin: 60, subType: 'interval' });
  ok('gleiche Dauer, härtere Einheit ⇒ mehr systemische Last',
    hard.systemic > easy.systemic, `${easy.systemic} → ${hard.systemic}`);
  ok('Einheit ohne Dauer liefert KEINE Last',
    LH.loadOf({ sportId: 'running' }).ok === false, LH.loadOf({ sportId: 'running' }).reason);
  ok('unbekannte Sportart wird ausgewiesen',
    LH.loadOf({ sportId: 'unterwasserhockey', durationMin: 60 }).unknownSport === true);

  /* NAHTSTELLE: Eine Aktivitaet kennt `subType`, eine Planeinheit `l`.
     Wird die Aktivitaet ungeuebersetzt durchgereicht, liest das Lastmodell
     IMMER 'moderate' — die ganze Historie waere dann eine Reihe gleich
     schwerer Einheiten und jede Trendaussage flach falsch. */
  ok('subType einer Aktivität wird in die Einheitenform übersetzt',
    LH.asUnit({ sportId: 'running', subType: 'interval' }).l === 'interval');
  ok('label und name werden ebenfalls erkannt',
    LH.asUnit({ name: 'Tempolauf' }).l === 'Tempolauf' && LH.asUnit({ label: 'Long Run' }).l === 'Long Run');
  ok('die Intensität kommt tatsächlich im Lastmodell an',
    LP.intensityOf(LH.asUnit({ sportId: 'running', subType: 'interval' })) === 'interval',
    LP.intensityOf(LH.asUnit({ sportId: 'running', subType: 'interval' })));
  ok('alle Intensitätsstufen erzeugen verschiedene Lasten',
    new Set(['recovery', 'easy', 'long', 'tempo', 'interval'].map(x =>
      LH.loadOf({ sportId: 'running', durationMin: 60, subType: x }).systemic)).size >= 4,
    ['recovery', 'easy', 'long', 'tempo', 'interval'].map(x =>
      LH.loadOf({ sportId: 'running', durationMin: 60, subType: x }).systemic).join('/'));
}

/* ══════════════════════════════════════════════════════════════ */
sec('H4 · Krafttraining zählt über Sätze');
{
  const s3 = LH.strengthLoadOf([
    { exerciseId: 'squat', reps: 5, weightKg: 100, date: TODAY },
    { exerciseId: 'squat', reps: 5, weightKg: 100, date: TODAY },
    { exerciseId: 'squat', reps: 5, weightKg: 100, date: TODAY }
  ]);
  const s10 = LH.strengthLoadOf(Array.from({ length: 10 }, () => ({ exerciseId: 'squat', reps: 5, weightKg: 100, date: TODAY })));
  ok('drei Sätze werden gezählt', s3.setCount === 3 || s3.setCount === 0, String(s3.setCount));
  if (s3.ok && s10.ok) {
    ok('zehn Sätze sind mehr Last als drei',
      Object.keys(s10.muscles).some(m => s10.muscles[m] > (s3.muscles[m] || 0)),
      JSON.stringify(s10.muscles).slice(0, 60));
    ok('… und zwar etwa um den Faktor der Satzzahl',
      Object.keys(s3.muscles).every(m => s10.muscles[m] >= s3.muscles[m] * 2.5));
  } else {
    ok('ohne Übungsklassifikation wird nichts erfunden',
      s3.ok === false && s3.reason === 'no_classified_sets', s3.reason);
    ok('… und die unklassifizierten Sätze werden beziffert', s3.unclassifiedSets === 3, String(s3.unclassifiedSets));
  }
  ok('leere Satzliste ⇒ kein Ergebnis, kein Mittelwert',
    LH.strengthLoadOf([]).ok === false && LH.strengthLoadOf([]).reason === 'no_sets');
  ok('Satz ohne Wiederholungen zählt nicht als Datensatz',
    LH.strengthLoadOf([{ exerciseId: 'squat', weightKg: 100 }]).setCount === 0);

  /* Ein Krafttag darf nicht als Luecke gelten, nur weil keine Aktivitaet
     vorliegt — die Saetze SIND der Beleg. */
  const h = LH.buildHistory({ activities: [], sets: [{ exerciseId: 'squat', reps: 5, weightKg: 100, date: day(1) }],
    today: TODAY, days: 7 });
  ok('ein Tag mit Sätzen gilt als geloggt', h.byDay[day(1)].logged === true);
  ok('… und erzeugt keine Lücke für diesen Tag',
    h.gaps.filter(g => g.date === day(1) && g.reason === 'no_entry').length === 0);
}

/* ══════════════════════════════════════════════════════════════ */
sec('H5 · Dünne Datenlage liefert keine Zahl');
{
  const dünn = [{ date: day(1), sportId: 'running', durationMin: 60, subType: 'easy' }];
  const h = LH.buildHistory({ activities: dünn, today: TODAY, days: 28 });
  ok('Ratio bleibt null', h.acuteChronic.ratio === null);
  ok('Band ist insufficient_data', h.acuteChronic.band === 'insufficient_data', h.acuteChronic.band);
  ok('Trend bleibt unknown', h.trainingState.loadTrend === 'unknown', h.trainingState.loadTrend);
  ok('Monotony bleibt null', h.trainingState.monotony === null);
  ok('… und nichts davon ist handlungsfähig', h.trainingState.actionable === false);
  ok('die Schwellen sind offengelegt',
    LH.MIN_COMPLETENESS.acuteChronic > 0 && LH.MIN_COMPLETENESS.trend > 0);

  const v = vollstaendig();
  const voll = LH.buildHistory({ activities: v.activities, knownDays: v.knownDays, today: TODAY, days: 28 });
  ok('vollständige Daten liefern eine Ratio', voll.acuteChronic.ratio != null, String(voll.acuteChronic.ratio));
  ok('… ein Band', ['low', 'ok', 'high', 'spike'].indexOf(voll.acuteChronic.band) >= 0, voll.acuteChronic.band);
  ok('… und sind als Kontext markiert, nicht als Freigabe',
    voll.acuteChronic.advisory === true && /keine Freigabe oder Sperre/.test(voll.acuteChronic.note || ''));
}

/* ══════════════════════════════════════════════════════════════ */
sec('H6 · trainingState ist additiv und widerspruchsfrei');
{
  const v = vollstaendig();
  const h = LH.buildHistory({ activities: v.activities, knownDays: v.knownDays, today: TODAY, days: 28 });
  ok('die Rohfenster bleiben erhalten', !!h.rolling[7] && !!h.rolling[14] && !!h.rolling[28]);
  ok('… mit Rohwerten je Muskelgruppe', Object.keys(h.rolling[28].perMuscle).length === LP.MUSCLES.length);
  ok('byDay bleibt vollständig zurückverfolgbar',
    Object.keys(h.byDay).length === 28 && Array.isArray(h.byDay[day(1)].sessions));

  /* Widerspruchsfreiheit: Der verdichtete Trend muss zu den Rohwerten passen. */
  const steigend = [];
  for (let i = 27; i >= 0; i--) {
    steigend.push({ date: day(i), sportId: 'running', durationMin: 30 + (27 - i) * 3, subType: 'easy' });
  }
  const hs = LH.buildHistory({ activities: steigend, today: TODAY, days: 28 });
  ok('steigende Last ⇒ loadTrend rising', hs.trainingState.loadTrend === 'rising', hs.trainingState.loadTrend);
  ok('… und die Rohwerte bestätigen es',
    hs.rolling[7].systemicPerKnownDay > hs.rolling[28].systemicPerKnownDay,
    `${hs.rolling[28].systemicPerKnownDay} → ${hs.rolling[7].systemicPerKnownDay}`);

  const fallend = steigend.map((a, idx) => ({ ...a, durationMin: 30 + (steigend.length - 1 - idx) * 3 }));
  const hf = LH.buildHistory({ activities: fallend, today: TODAY, days: 28 });
  ok('fallende Last ⇒ loadTrend falling', hf.trainingState.loadTrend === 'falling', hf.trainingState.loadTrend);
  ok('… und auch hier stimmen die Rohwerte',
    hf.rolling[7].systemicPerKnownDay < hf.rolling[28].systemicPerKnownDay);

  ok('der Zustand trägt seinen Belegwert', E.isLevel(hs.trainingState.evidence), hs.trainingState.evidence);
  ok('vollständige Daten ⇒ handlungsfähig', hs.trainingState.actionable === true);
}

/* ══════════════════════════════════════════════════════════════ */
sec('H7 · Monotony und Strain steuern nichts');
{
  const v = vollstaendig();
  const h = LH.buildHistory({ activities: v.activities, knownDays: v.knownDays, today: TODAY, days: 28 });
  ok('Monotony wird berechnet', h.trainingState.monotony != null, String(h.trainingState.monotony));
  ok('Strain wird berechnet', h.trainingState.strain != null, String(h.trainingState.strain));
  ok('beide sind ausdrücklich als advisory markiert', h.trainingState.monotonyAdvisory === true);

  /* Die Kennzahlen duerfen den Trend nicht beeinflussen: gleiche Last, andere
     Verteilung ⇒ anderer Monotony-Wert, gleicher loadTrend. */
  const gleichmaessig = [], schwankend = [];
  for (let i = 27; i >= 0; i--) {
    gleichmaessig.push({ date: day(i), sportId: 'running', durationMin: 60, subType: 'easy' });
    schwankend.push({ date: day(i), sportId: 'running', durationMin: i % 2 ? 20 : 100, subType: 'easy' });
  }
  const a = LH.buildHistory({ activities: gleichmaessig, today: TODAY, days: 28 });
  const b = LH.buildHistory({ activities: schwankend, today: TODAY, days: 28 });
  ok('unterschiedliche Verteilung ⇒ unterschiedliche Monotony',
    a.trainingState.monotony !== b.trainingState.monotony,
    `${a.trainingState.monotony} vs ${b.trainingState.monotony}`);
  ok('… aber derselbe loadTrend',
    a.trainingState.loadTrend === b.trainingState.loadTrend, a.trainingState.loadTrend);
  ok('… und dieselbe Handlungsfähigkeit',
    a.trainingState.actionable === b.trainingState.actionable);
}

/* ══════════════════════════════════════════════════════════════ */
sec('H8 · Toleranz kommt aus eingefrorenen Debriefs');
{
  const mk = (deltaRpe, frozen = true) => {
    const d = SD.debrief({
      planned: { t: 'Laufen', l: 'Intervalle', sportId: 'running', durationMin: 60, distanceKm: 12,
        targetLoSecPerKm: 250, targetHiSecPerKm: 270 },
      actual: { durationMin: 60, distanceKm: 12, paceSecPerKm: 265 },
      zones: { ok: true, confidence: 'strong', ageRatio: 0.1 }, rpe: 5
    });
    const rec = Object.assign({}, d, { sportId: 'running', deltaRpe, deltaPace: 5,
      snapshot: Object.assign({}, d.snapshot, { expectedRpeEvidence: 'moderate' }) });
    if (!frozen) delete rec.snapshot;
    return rec;
  };

  const h = LH.buildHistory({ activities: [], debriefs: [mk(3), mk(3), mk(3)], today: TODAY, days: 28 });
  ok('Toleranz wird aus den Debriefs gebildet', h.toleranceState != null);
  ok('… drei eingefrorene Datensätze werden übernommen', h.toleranceState.fromRecords === 3, String(h.toleranceState.fromRecords));
  ok('… und ergeben eine Aussage',
    h.toleranceState.bySport.running.highIntensity.status === 'poor',
    h.toleranceState.bySport.running.highIntensity.status);

  /* Datensaetze OHNE Snapshot koennten gegen heutige Zonen umgedeutet worden
     sein und sind als Grundwahrheit nicht belastbar. */
  const h2 = LH.buildHistory({ activities: [], debriefs: [mk(3, false), mk(3, false), mk(3, false)], today: TODAY, days: 28 });
  ok('Datensätze ohne Snapshot werden abgewiesen', h2.toleranceState.fromRecords === 0, String(h2.toleranceState.fromRecords));
  ok('… und die Zahl wird ausgewiesen', h2.toleranceState.rejectedRecords === 3, String(h2.toleranceState.rejectedRecords));
  ok('… die Aussage bleibt unknown', h2.toleranceState.systemic.status === 'unknown');

  /* Die Last darf die Toleranz nicht faerben. */
  const v = vollstaendig();
  const h3 = LH.buildHistory({ activities: v.activities, knownDays: v.knownDays,
    debriefs: [mk(3), mk(3), mk(3)], today: TODAY, days: 28 });
  ok('viel Last ändert die Toleranzaussage nicht',
    h3.toleranceState.bySport.running.highIntensity.status ===
    h.toleranceState.bySport.running.highIntensity.status);
}

/* ══════════════════════════════════════════════════════════════ */
sec('H10 · Randbedingungen der Eingabe');
{
  /* --- Doppelzaehlung: derselbe Datensatz aus zwei Sync-Laeufen --- */
  const zwei = [{ id: 'x', date: day(1), sportId: 'running', durationMin: 60, subType: 'easy' },
    { id: 'x', date: day(1), sportId: 'running', durationMin: 60, subType: 'easy' }];
  const eins = [zwei[0]];
  const a = LH.buildHistory({ activities: zwei, today: TODAY, days: 7 });
  const b = LH.buildHistory({ activities: eins, today: TODAY, days: 7 });
  ok('gleiche ID zählt einmal', a.byDay[day(1)].systemic === b.byDay[day(1)].systemic,
    `${a.byDay[day(1)].systemic} vs ${b.byDay[day(1)].systemic}`);
  ok('… und die Dublette wird beziffert', a.duplicatesIgnored === 1, String(a.duplicatesIgnored));

  /* OHNE unterscheidendes Merkmal darf NICHT sicher dedupliziert werden: Zwei
     ehrliche 30-Minuten-Laeufe am selben Tag sind moeglich. Eine geloeschte
     Einheit ist unsichtbar, eine doppelte faellt auf — deshalb bleiben beide
     stehen und die Kollision wird gemeldet. */
  const ohneMerkmal = [{ date: day(1), sportId: 'running', durationMin: 30, subType: 'easy' },
    { date: day(1), sportId: 'running', durationMin: 30, subType: 'easy' }];
  const om = LH.buildHistory({ activities: ohneMerkmal, today: TODAY, days: 7 });
  const einzeln = LH.buildHistory({ activities: [ohneMerkmal[0]], today: TODAY, days: 7 });
  ok('ohne unterscheidendes Merkmal bleiben beide stehen',
    om.byDay[day(1)].systemic > einzeln.byDay[day(1)].systemic,
    `${einzeln.byDay[day(1)].systemic} → ${om.byDay[day(1)].systemic}`);
  ok('… und die mögliche Kollision wird ausgewiesen',
    om.possibleDuplicates.length === 1, JSON.stringify(om.possibleDuplicates));
  ok('… mit Hinweis, was fehlt', /Startzeit, Quelle oder ID/.test(om.possibleDuplicates[0].hint));
  ok('… und NICHT als sichere Dublette gezählt', om.duplicatesIgnored === 0, String(om.duplicatesIgnored));

  /* Mit unterscheidendem Merkmal: zwei echte Einheiten, keine Meldung. */
  const mitZeit = [{ date: day(1), startTime: '07:00', sportId: 'running', durationMin: 30, subType: 'easy' },
    { date: day(1), startTime: '18:00', sportId: 'running', durationMin: 30, subType: 'easy' }];
  const mz = LH.buildHistory({ activities: mitZeit, today: TODAY, days: 7 });
  ok('mit Startzeit sind zwei Einheiten eindeutig zwei',
    mz.byDay[day(1)].systemic === om.byDay[day(1)].systemic && mz.possibleDuplicates.length === 0);
  ok('Startzeit, Quelle oder ID machen die Identität sicher',
    LH.identityCertain(LH.asUnit({ startTime: '07:00' })) === true &&
    LH.identityCertain(LH.asUnit({ source: 'garmin' })) === true &&
    LH.identityCertain(LH.asUnit({ id: 'x' })) === true &&
    LH.identityCertain(LH.asUnit({ date: day(1) })) === false);

  ok('zwei ECHTE Einheiten mit verschiedener Dauer zählen ohnehin beide',
    LH.buildHistory({ activities: [ohneMerkmal[0], { date: day(1), sportId: 'running', durationMin: 40, subType: 'interval' }],
      today: TODAY, days: 7 }).byDay[day(1)].systemic > einzeln.byDay[day(1)].systemic);

  /* --- Krafttraining: Aktivitaet UND Saetze beschreiben dieselbe Belastung --- */
  const gymAct = [{ id: 'g1', date: day(1), sportId: 'gym', subType: 'beine', durationMin: 60 }];
  const gymSets = Array.from({ length: 6 }, () => ({ exerciseId: 'squat', reps: 5, weightKg: 100, date: day(1) }));
  const nurAkt = LH.buildHistory({ activities: gymAct, today: TODAY, days: 7 });
  const beides = LH.buildHistory({ activities: gymAct, sets: gymSets, today: TODAY, days: 7 });
  const summeAkt = Object.values(nurAkt.byDay[day(1)].perMuscle).reduce((x, y) => x + y, 0);
  const summeBeides = Object.values(beides.byDay[day(1)].perMuscle).reduce((x, y) => x + y, 0);
  ok('Sätze ersetzen die pauschale Split-Schätzung, statt sich zu addieren',
    beides.byDay[day(1)].strengthFromSets === true || summeBeides <= summeAkt * 1.05,
    `nur Aktivität ${summeAkt.toFixed(2)} → mit Sätzen ${summeBeides.toFixed(2)}`);
  ok('die systemische Last der Einheit bleibt erhalten',
    beides.byDay[day(1)].systemic === nurAkt.byDay[day(1)].systemic);

  /* --- Der laufende Tag --- */
  const heute = LH.buildHistory({ activities: [], today: TODAY, days: 7 });
  ok('der laufende Tag ist KEINE Lücke',
    heute.gaps.filter(g => g.date === TODAY).length === 0);
  ok('… sondern als unvollständig markiert', heute.byDay[TODAY].partial === true);
  ok('… und zählt nicht in die Vollständigkeit',
    LH.buildHistory({ activities: [{ date: day(1), sportId: 'running', durationMin: 60, subType: 'easy' }],
      knownDays: [day(1), day(2), day(3), day(4), day(5), day(6)], today: TODAY, days: 7 }).completeness === 1);
  /* ZWEI GETRENNTE SICHTEN. Die heutige Last soll sichtbar sein, darf aber
     keinen Trend verzerren: Ginge sie in den Zaehler ein, waehrend der Tag
     nicht im Nenner steht, stiege `systemicPerKnownDay` ohne echten Grund. */
  const mitHeute = LH.buildHistory({
    activities: [{ date: TODAY, sportId: 'running', durationMin: 120, subType: 'interval' },
      { date: day(1), sportId: 'running', durationMin: 60, subType: 'easy' }],
    knownDays: [day(1), day(2), day(3), day(4), day(5), day(6)], today: TODAY, days: 7 });
  const ohneHeute = LH.buildHistory({
    activities: [{ date: day(1), sportId: 'running', durationMin: 60, subType: 'easy' }],
    knownDays: [day(1), day(2), day(3), day(4), day(5), day(6)], today: TODAY, days: 7 });
  ok('die heutige Last ist sichtbar', mitHeute.observedToday > 0, String(mitHeute.observedToday));
  ok('… und in observedIncludingPartial enthalten',
    mitHeute.observedIncludingPartial > ohneHeute.observedIncludingPartial);
  ok('… aber NICHT in der Entscheidungslast',
    mitHeute.decisionLoadCompletedDaysOnly === ohneHeute.decisionLoadCompletedDaysOnly,
    `${ohneHeute.decisionLoadCompletedDaysOnly} vs ${mitHeute.decisionLoadCompletedDaysOnly}`);
  ok('… und verzerrt den normierten Wert nicht',
    mitHeute.rolling[7].systemicPerKnownDay === ohneHeute.rolling[7].systemicPerKnownDay,
    `${ohneHeute.rolling[7].systemicPerKnownDay} vs ${mitHeute.rolling[7].systemicPerKnownDay}`);
  ok('… und ändert den Trend nicht',
    mitHeute.trainingState.loadTrend === ohneHeute.trainingState.loadTrend);

  /* Das Fenster bleibt n ABGESCHLOSSENE Tage breit, schrumpft also nicht. */
  const v2 = vollstaendig();
  const w = LH.buildHistory({ activities: v2.activities, knownDays: v2.knownDays, today: TODAY, days: 28 });
  ok('das 7-Tage-Fenster umfasst 7 abgeschlossene Tage', w.rolling[7].days === 7, String(w.rolling[7].days));
  ok('das 28-Tage-Fenster ist entsprechend breit', w.rolling[28].days >= 27, String(w.rolling[28].days));

  /* --- Zeitzone: lokale Datumsangaben gewinnen vor UTC-Zeitstempeln --- */
  ok('localDate gewinnt vor startDate',
    LH.asUnit({ localDate: day(1), startDate: day(0) + 'T23:30:00Z' }).dayKey === day(1));
  ok('ohne localDate wird date verwendet', LH.asUnit({ date: day(2) }).dayKey === day(2));

  /* --- asUnit normalisiert vollständig --- */
  ok('Sportart-Aliase werden vereinheitlicht',
    LH.asUnit({ sport: 'Laufen' }).sportId === 'running' &&
    LH.asUnit({ sportId: 'RUN' }).sportId === 'running' &&
    LH.asUnit({ sport: 'Radfahren' }).sportId === 'cycling' &&
    LH.asUnit({ sport: 'Krafttraining' }).sportId === 'gym');
  ok('Dauer wird aus Minuten, Sekunden und Millisekunden normalisiert',
    LH.asUnit({ durationMin: 60 }).durationMin === 60 &&
    LH.asUnit({ durationSec: 3600 }).durationMin === 60 &&
    LH.asUnit({ elapsedMs: 3600000 }).durationMin === 60);
  ok('Identität ist deterministisch',
    LH.identityOf(LH.asUnit({ date: day(1), sportId: 'running', subType: 'easy', durationMin: 60 })) ===
    LH.identityOf(LH.asUnit({ date: day(1), sportId: 'running', subType: 'easy', durationMin: 60 })));
  ok('… und unterscheidet verschiedene Einheiten',
    LH.identityOf(LH.asUnit({ date: day(1), sportId: 'running', durationMin: 60 })) !==
    LH.identityOf(LH.asUnit({ date: day(1), sportId: 'running', durationMin: 40 })));

  /* --- Schwellen sind versioniert --- */
  ok('die Politik trägt eine eigene Version', typeof LH.POLICY_VERSION === 'string' && /@/.test(LH.POLICY_VERSION));
  ok('… getrennt von der Modulversion', LH.POLICY_VERSION !== LH.VERSION);
  ok('das Ergebnis führt die Politik mit',
    heute.policyVersion === LH.POLICY_VERSION && heute.thresholds.acuteChronic === LH.MIN_COMPLETENESS.acuteChronic,
    heute.policyVersion);
  ok('… und die konkreten Schwellen, gegen die entschieden wurde',
    heute.thresholds.trend === LH.MIN_COMPLETENESS.trend && heute.thresholds.monotony === LH.MIN_COMPLETENESS.monotony);
}

/* ══════════════════════════════════════════════════════════════ */
sec('H9 · Purität und Robustheit');
{
  const src = readFileSync(join(APP, 'js/engine/load-history.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  ok('kein DOM-Zugriff', !/\bdocument\.|\bwindow\.(?!ORVIA)/.test(src));
  ok('keine Systemuhr', !/Date\.now\(|new Date\(\)/.test(src));
  ok('kein Zufall', !/Math\.random/.test(src));
  ok('kein Storage', !/localStorage|sessionStorage/.test(src));
  ok('kein eigenes Muskel-Array (eine Quelle)', !/'quads',\s*'hamstrings'/.test(src));

  let threw = null;
  [undefined, null, {}, { activities: null }, { activities: [null, {}, { date: 'x' }] },
    { today: 'kaputt' }, { activities: [], sets: 'nope' }, { debriefs: [null, 1, 'x'] }]
    .forEach((x, i) => { try { LH.buildHistory(x); } catch (e) { threw = i + ': ' + e.message; } });
  ok('keine Eingabe wirft', threw === null, threw || '');
  ok('ohne today: ehrlich leer statt geraten',
    LH.buildHistory({ activities: [] }).acuteChronic.band === 'insufficient_data');

  const v = vollstaendig();
  const a = JSON.stringify(LH.buildHistory({ activities: v.activities, knownDays: v.knownDays, today: TODAY, days: 28 }));
  const b = JSON.stringify(LH.buildHistory({ activities: v.activities, knownDays: v.knownDays, today: TODAY, days: 28 }));
  ok('deterministisch', a === b);

  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  ok('Modul ist eingehängt', /js\/engine\/load-history\.js/.test(html));
  ok('… nach load-profile (Lastmodell)',
    html.indexOf('js/engine/load-profile.js') < html.indexOf('js/engine/load-history.js'));
  ok('… nach session-debrief (Toleranz)',
    html.indexOf('js/engine/session-debrief.js') < html.indexOf('js/engine/load-history.js'));
  ok('Modul ist im Cache-Manifest', /load-history\.js/.test(readFileSync(join(APP, 'sw.js'), 'utf8')));
}

console.log('\n' + '═'.repeat(62));
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
