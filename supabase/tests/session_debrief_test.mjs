/* ORVIA · Session Debrief (Bauplan Stufe 2 / C3)

   Geprüfte Zusagen:
     C1  Der Standardfall kommt mit ZWEI manuellen Eingaben aus (RPE, Schmerz)
     C2  executionScore misst PLANERFÜLLUNG, nicht Qualität — RPE/Schmerz gehen
         ausdrücklich nicht ein
     C3  expectedRPE kommt aus der Prescription, nicht aus dem Sessionnamen
     C4  Vergleichbarkeit ist verbindlich definiert und greift
     C5  tolerance bei < 3 vergleichbaren Einheiten `unknown`, NICHT `good`
     C6  Toleranz ist kontextspezifisch — Laufen färbt nicht auf Rad ab
     C7  Ohne Plan-Referenz kein Urteil; ohne belastbare Zonen keine Bewertung
     C8  Die Aggregation ist schwächer belegt als jede Einzelzelle
     C9  Purität und Robustheit

   node supabase/tests/session_debrief_test.mjs [appRoot-absolut] */
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

const E = require(join(APP, 'js/engine/evidence.js'));
const SD = require(join(APP, 'js/engine/session-debrief.js'));

const TODAY = '2026-08-07';
const ZONES = { ok: true, confidence: 'strong', ageRatio: 0.1 };
const PLAN = (o = {}) => Object.assign({
  t: 'Laufen', l: 'Long Run', sportId: 'running',
  durationMin: 90, distanceKm: 18, targetLoSecPerKm: 330, targetHiSecPerKm: 360
}, o);
const ACT = (o = {}) => Object.assign({ durationMin: 90, distanceKm: 18, paceSecPerKm: 345 }, o);

/* ══════════════════════════════════════════════════════════════ */
sec('C1 · Der Standardfall braucht zwei Eingaben');
{
  /* Elf Felder pro Einheit fuellt niemand ueber Monate aus — und lueckenhafte
     Selbstauskunft ist schlechter als keine, weil schlechte Tage seltener
     geloggt werden. Der Normalfall muss deshalb mit RPE + Schmerz auskommen. */
  const d = SD.debrief({ planned: PLAN(), actual: ACT(), zones: ZONES, rpe: 6, today: TODAY });
  ok('vollständiges Urteil mit nur RPE als Eingabe', d.judged === true && d.adherence === 'im Ziel', d.adherence);
  ok('Erfüllungsgrad wird abgeleitet, nicht erfragt', d.completionPct != null, String(d.completionPct));
  ok('Zonentreffer wird abgeleitet', d.zoneHit != null, String(d.zoneHit));
  ok('Dauerabweichung wird abgeleitet', d.deltaDuration != null);
  ok('Klartextnotiz entsteht ohne Zutun', /geplant .* gelaufen .* im Ziel/.test(d.note), d.note);

  const p = SD.debrief({ planned: PLAN(), actual: ACT(), zones: ZONES, rpe: 6, painDuring: true, painRegion: 'knee', today: TODAY });
  ok('Schmerz erzeugt ein Constraint-Signal',
    p.adaptationEvidence.constraintSignal && p.adaptationEvidence.constraintSignal.region === 'knee');
  ok('… mit Zeitpunkt', p.adaptationEvidence.constraintSignal.when === 'during');
  ok('ohne Schmerzangabe kein Signal',
    SD.debrief({ planned: PLAN(), actual: ACT(), zones: ZONES, rpe: 6 }).adaptationEvidence.constraintSignal === null);

  /* Ohne RPE bleibt das Urteil moeglich, aber die Adaptationsaussage offen. */
  const noRpe = SD.debrief({ planned: PLAN(), actual: ACT(), zones: ZONES, today: TODAY });
  ok('ohne RPE: Plan-Ist weiterhin beurteilt', noRpe.judged === true && noRpe.adherence === 'im Ziel');
  ok('… aber Verträglichkeit unbekannt', noRpe.adaptationEvidence.tolerance === 'unknown');
  ok('… und Progressionssignal unbekannt', noRpe.adaptationEvidence.progressionSignal === 'unknown');
}

/* ══════════════════════════════════════════════════════════════ */
sec('C2 · executionScore ist Planerfüllung, nicht Qualität');
{
  /* Der entscheidende Gegenbeweis: perfekt erfuellt, aber RPE 10 und Schmerz.
     Wuerde executionScore das mitrechnen, hiesse diese Einheit „hochwertig". */
  const perfekt = SD.debrief({ planned: PLAN(), actual: ACT(), zones: ZONES, rpe: 5, today: TODAY });
  const perfektAberHart = SD.debrief({
    planned: PLAN(), actual: ACT(), zones: ZONES,
    rpe: 10, painDuring: true, painRegion: 'achilles', today: TODAY
  });
  ok('perfekt erfüllte Einheit: executionScore 1.0', perfekt.executionScore === 1, String(perfekt.executionScore));
  ok('dieselbe Einheit mit RPE 10 und Schmerz: executionScore UNVERÄNDERT',
    perfektAberHart.executionScore === perfekt.executionScore,
    `${perfekt.executionScore} vs ${perfektAberHart.executionScore}`);
  ok('… aber die Verträglichkeit ist eine andere',
    perfektAberHart.adaptationEvidence.tolerance !== perfekt.adaptationEvidence.tolerance,
    `${perfekt.adaptationEvidence.tolerance} → ${perfektAberHart.adaptationEvidence.tolerance}`);
  ok('… und der Schmerz ist getrennt festgehalten',
    perfektAberHart.adaptationEvidence.constraintSignal !== null);
  ok('das Feld heißt nicht sessionQuality',
    perfekt.sessionQuality === undefined && 'executionScore' in perfekt);

  const halb = SD.debrief({ planned: PLAN(), actual: ACT({ distanceKm: 9, durationMin: 45 }), zones: ZONES, rpe: 5, today: TODAY });
  ok('halb absolvierte Einheit ⇒ abgebrochen', halb.adherence === 'abgebrochen', halb.adherence);
  ok('… und executionScore fällt', halb.executionScore < perfekt.executionScore,
    `${perfekt.executionScore} → ${halb.executionScore}`);
  ok('Übererfüllung wird nicht über 1.0 belohnt',
    SD.debrief({ planned: PLAN(), actual: ACT({ distanceKm: 30, durationMin: 150 }), zones: ZONES }).executionScore <= 1);
}

/* ══════════════════════════════════════════════════════════════ */
sec('C3 · expectedRPE kommt aus der Prescription');
{
  /* „Threshold" sagt nichts darueber, ob 4x8 min oder 2x20 min gemeint sind. */
  const kurz = SD.expectedRPE({ sessionType: 'threshold', workDuration: 32, recoveryRatio: 2 });
  const lang = SD.expectedRPE({ sessionType: 'threshold', workDuration: 40, recoveryRatio: 8 });
  ok('gleicher Sessionname, andere Vorgabe ⇒ anderer Erwartungswert',
    kurz.value !== lang.value, `4×8: ${kurz.value} · 2×20: ${lang.value}`);
  ok('dichteres Pausenverhältnis erhöht den Erwartungswert',
    SD.expectedRPE({ sessionType: 'vo2', workDuration: 18, recoveryRatio: 4 }).value >
    SD.expectedRPE({ sessionType: 'vo2', workDuration: 18, recoveryRatio: 1 }).value);
  ok('längere Arbeitsdauer erhöht den Erwartungswert',
    SD.expectedRPE({ sessionType: 'long', workDuration: 180 }).value >
    SD.expectedRPE({ sessionType: 'long', workDuration: 90 }).value);
  ok('spät im Block erhöht den Erwartungswert',
    SD.expectedRPE({ sessionType: 'tempo', workDuration: 25, progressionStage: 'late' }).value >
    SD.expectedRPE({ sessionType: 'tempo', workDuration: 25, progressionStage: 'early' }).value);
  ok('lockere Einheit erwartet weniger als Intervalle',
    SD.expectedRPE({ sessionType: 'easy', workDuration: 50 }).value <
    SD.expectedRPE({ sessionType: 'vo2', workDuration: 18 }).value);
  ok('Werte bleiben auf der Skala 1–10',
    [1, 5, 20, 300].every(w => {
      const v = SD.expectedRPE({ sessionType: 'vo2', workDuration: w }).value;
      return v >= 1 && v <= 10;
    }));

  /* Ohne eigene Historie ist der Erwartungswert eine Konvention — und sagt das. */
  ok('Tabellenwert ⇒ evidence weak', kurz.evidence === 'weak', kurz.evidence);

  /* Mit genug eigenen vergleichbaren Einheiten wird personalisiert. */
  const eigene = Array.from({ length: 6 }, () => ({
    sessionType: 'threshold', sportId: 'running', t: 'Laufen', durationMin: 32, rpe: 9
  }));
  const pers = SD.expectedRPE({ sessionType: 'threshold', sportId: 'running', t: 'Laufen', workDuration: 32, durationMin: 32 }, eigene);
  ok('genug eigene Einheiten ⇒ personalisiert', pers.evidence === 'moderate', pers.evidence + ' n=' + pers.n);
  ok('… und der eigene Median gewinnt gegen die Tabelle', pers.value === 9, String(pers.value));
  const zuWenig = SD.expectedRPE({ sessionType: 'threshold', sportId: 'running', t: 'Laufen', workDuration: 32, durationMin: 32 }, eigene.slice(0, 3));
  ok('zu wenige eigene Einheiten ⇒ weiter Tabelle', zuWenig.evidence === 'weak', zuWenig.evidence);

  /* Ohne recoveryRatio wird NICHT angenommen, es sei dicht. */
  ok('fehlendes Pausenverhältnis erzeugt keinen Aufschlag',
    SD.expectedRPE({ sessionType: 'vo2', workDuration: 18 }).factors.indexOf('recoveryRatio') < 0);
}

/* ══════════════════════════════════════════════════════════════ */
sec('C4 · Vergleichbarkeit ist verbindlich definiert');
{
  const ref = { sessionType: 'threshold', sportId: 'running', durationMin: 30, zone: 'threshold' };
  ok('gleicher Typ, gleiche Dauer, gleiche Zone ⇒ vergleichbar',
    SD.comparable(Object.assign({}, ref), ref) === true);
  ok('Dauer +15 % ⇒ noch vergleichbar',
    SD.comparable(Object.assign({}, ref, { durationMin: 34.5 }), ref) === true);
  ok('Dauer +40 % ⇒ NICHT vergleichbar',
    SD.comparable(Object.assign({}, ref, { durationMin: 42 }), ref) === false);
  ok('anderer Sessiontyp ⇒ nicht vergleichbar',
    SD.comparable(Object.assign({}, ref, { sessionType: 'vo2' }), ref) === false);
  ok('andere Zone ⇒ nicht vergleichbar',
    SD.comparable(Object.assign({}, ref, { zone: 'vo2' }), ref) === false);
  ok('andere Sportart ⇒ nicht vergleichbar',
    SD.comparable(Object.assign({}, ref, { sportId: 'cycling' }), ref) === false);
  ok('die Toleranz ist als Konstante offengelegt', SD.DURATION_TOLERANCE === 0.2);
  ok('null-Eingaben ⇒ nicht vergleichbar', SD.comparable(null, ref) === false && SD.comparable(ref, null) === false);
}

/* ══════════════════════════════════════════════════════════════ */
sec('C5 · Ohne Belege keine Aussage — unknown, nicht good');
{
  const mk = (rpe, n = 1) => Array.from({ length: n }, () => SD.debrief({
    planned: PLAN({ l: 'Intervalle', durationMin: 60, distanceKm: 12 }),
    actual: ACT({ durationMin: 60, distanceKm: 12 }), zones: ZONES, rpe, today: TODAY
  })).map(d => Object.assign(d, { sportId: 'running' }));

  ok('null Einheiten ⇒ unknown',
    SD.toleranceFor([], { domain: 'highIntensity', sport: 'running' }).status === 'unknown');
  ok('eine Einheit ⇒ unknown',
    SD.toleranceFor(mk(5, 1), { domain: 'highIntensity', sport: 'running' }).status === 'unknown');
  ok('zwei Einheiten ⇒ unknown',
    SD.toleranceFor(mk(5, 2), { domain: 'highIntensity', sport: 'running' }).status === 'unknown');
  ok('… auch wenn alle gut liefen: ausbleibende Signale sind kein Beleg',
    SD.toleranceFor(mk(4, 2), { domain: 'highIntensity', sport: 'running' }).status === 'unknown',
    SD.toleranceFor(mk(4, 2), { domain: 'highIntensity', sport: 'running' }).status);
  ok('die Schwelle ist als Konstante offengelegt', SD.MIN_COMPARABLE === 3);

  const drei = mk(5, 3);
  ok('drei Einheiten ⇒ Aussage möglich',
    SD.toleranceFor(drei, { domain: 'highIntensity', sport: 'running' }).status !== 'unknown');

  /* ≥ 2 von 3 mit RPE ≥ 2 über Erwartung ⇒ poor. */
  const hart = mk(11, 3).map(d => Object.assign({}, d, { deltaRpe: 3, deltaPace: 5 }));
  const t = SD.toleranceFor(hart, { domain: 'highIntensity', sport: 'running' });
  ok('drei deutlich zu harte Einheiten ⇒ poor', t.status === 'poor', t.status);
  ok('… mit ausgewiesener Anzahl', t.flagged >= 2, `flagged ${t.flagged}/${t.considered}`);

  const eineHart = drei.slice(0, 2).concat(hart.slice(0, 1));
  ok('nur EINE zu harte Einheit reicht nicht für poor',
    SD.toleranceFor(eineHart, { domain: 'highIntensity', sport: 'running' }).status !== 'poor');

  /* Schneller gelaufen als vorgegeben ⇒ hoeheres RPE ist erklaerbar und zaehlt
     NICHT als schlechte Vertraeglichkeit. */
  const schneller = mk(9, 3).map(d => Object.assign({}, d, { deltaRpe: 3, deltaPace: -25 }));
  ok('höheres RPE bei höherem Tempo zählt nicht als poor',
    SD.toleranceFor(schneller, { domain: 'highIntensity', sport: 'running' }).status !== 'poor',
    SD.toleranceFor(schneller, { domain: 'highIntensity', sport: 'running' }).status);
}

/* ══════════════════════════════════════════════════════════════ */
sec('C6 · Toleranz ist kontextspezifisch — kein Übersprechen');
{
  /* Der konkrete Fall aus dem Bauplan: Schlechte VO2-Vertraeglichkeit beim
     LAUFEN darf keine Rad-Intervalle einschraenken. */
  const laufHart = Array.from({ length: 3 }, () => ({
    judged: true, sportId: 'running', domains: ['systemic', 'highIntensity', 'impact'],
    deltaRpe: 3, deltaPace: 5, expectedRpeEvidence: 'moderate'
  }));
  const radGut = Array.from({ length: 3 }, () => ({
    judged: true, sportId: 'cycling', domains: ['systemic', 'highIntensity'],
    deltaRpe: 0, deltaPace: 0, expectedRpeEvidence: 'moderate'
  }));
  const alle = laufHart.concat(radGut);

  const run = SD.toleranceFor(alle, { domain: 'highIntensity', sport: 'running' });
  const bike = SD.toleranceFor(alle, { domain: 'highIntensity', sport: 'cycling' });
  ok('Laufen: harte Intensität ⇒ poor', run.status === 'poor', run.status);
  ok('Rad: dieselbe Domäne, andere Sportart ⇒ NICHT poor', bike.status !== 'poor', bike.status);
  ok('… sondern good', bike.status === 'good', bike.status);

  /* Und die Domaenen trennen ebenfalls: Impact betrifft nur das Laufen. */
  const vol = SD.toleranceFor(alle, { domain: 'volume', sport: 'running' });
  ok('eine unberührte Domäne bleibt unknown', vol.status === 'unknown', vol.status);

  const st = SD.toleranceState(alle, { sports: ['running', 'cycling'] });
  ok('toleranceState liefert alle Zellen', st.cells.length === 2 * SD.DOMAINS.length, String(st.cells.length));
  ok('… nach Sportart aufgeschlüsselt',
    st.bySport.running.highIntensity.status === 'poor' && st.bySport.cycling.highIntensity.status === 'good');
  ok('… und Zellen ohne Daten bleiben unknown',
    st.bySport.running.volume.status === 'unknown');
}

/* ══════════════════════════════════════════════════════════════ */
sec('C7 · Ohne Referenz kein Urteil');
{
  const frei = SD.debrief({ actual: ACT(), zones: ZONES, rpe: 5, today: TODAY });
  ok('freie Einheit ohne Plan ⇒ kein Urteil', frei.judged === false, String(frei.judged));
  ok('… und ausdrücklich nicht „falsch"', frei.adherence === 'nicht vergleichbar', frei.adherence);
  ok('… mit Begründung', frei.reason === 'no_plan_reference', frei.reason);
  ok('… und die Notiz erklärt es', /nicht geplant|nichts zu vergleichen/.test(frei.note), frei.note);

  const ohneAkt = SD.debrief({ planned: PLAN(), zones: ZONES, today: TODAY });
  ok('Plan ohne Aktivität ⇒ kein Urteil', ohneAkt.judged === false && ohneAkt.reason === 'no_activity');

  /* Ohne belastbare Zonen: beschreiben, nicht bewerten. */
  const ohneZonen = SD.debrief({ planned: PLAN(), actual: ACT(), zones: null, rpe: 5, today: TODAY });
  ok('ohne Zonen kein Zonenurteil', ohneZonen.zoneHit === null, String(ohneZonen.zoneHit));
  ok('… und keine Pace-Bewertung', ohneZonen.adherence === 'nicht vergleichbar', ohneZonen.adherence);
  ok('… aber der Erfüllungsgrad bleibt ableitbar', ohneZonen.completionPct != null);
  ok('… und die Notiz sagt warum', /beschrieben, nicht bewertet/.test(ohneZonen.note), ohneZonen.note);

  /* ANBINDUNG AN 0b: Zonen aus einem zwanzig Jahre alten Wettkampf haben
     weiterhin evidence 'strong', duerfen den Plan aber nicht steuern — und
     damit auch nicht als Bewertungsmassstab dienen. */
  const uralt = { ok: true, confidence: 'strong', ageRatio: 42 };
  const gegenUralt = SD.debrief({ planned: PLAN(), actual: ACT(), zones: uralt, rpe: 5, today: TODAY });
  ok('veraltete Zonen bewerten nicht mit', gegenUralt.zoneHit === null, String(gegenUralt.zoneHit));
  ok('… obwohl ihre Belegstufe strong ist',
    E.usability({ evidence: 'strong', ageRatio: 42 }).usability !== 'decision_eligible');
  const nochGut = { ok: true, confidence: 'strong', ageRatio: 2 };
  ok('alternde, aber noch zulässige Zonen bewerten weiterhin',
    SD.debrief({ planned: PLAN(), actual: ACT(), zones: nochGut, rpe: 5 }).zoneHit != null);
}

/* ══════════════════════════════════════════════════════════════ */
sec('C8 · Aggregation ist schwächer belegt als die Einzelzelle');
{
  const gut = Array.from({ length: 8 }, () => ({
    judged: true, sportId: 'running', domains: ['systemic', 'highIntensity'],
    deltaRpe: 0, deltaPace: 0, expectedRpeEvidence: 'moderate'
  }));
  const st = SD.toleranceState(gut, { sports: ['running'] });
  const zelle = st.bySport.running.highIntensity;
  ok('Zelle mit vielen Einheiten ist belegt', zelle.status === 'good' && zelle.evidence !== 'unknown', zelle.evidence);
  ok('die systemische Gesamtaussage ist eine Stufe schwächer',
    E.rank(st.systemic.evidence) < E.rank(zelle.evidence),
    `${zelle.evidence} → ${st.systemic.evidence}`);
  ok('… und sagt das im Klartext', /schwächer als jede Einzelzelle/.test(st.systemic.note || ''));
  ok('ohne aufgelöste Zelle bleibt die Gesamtaussage unknown',
    SD.toleranceState([], { sports: ['running'] }).systemic.status === 'unknown');

  /* Der Beleg kann nie besser sein als der schwaechste Bestandteil: Wenn der
     Erwartungswert nur aus der Tabelle stammt, ist die Aussage schwach. */
  const tabelle = gut.map(d => Object.assign({}, d, { expectedRpeEvidence: 'weak' }));
  ok('Tabellen-Erwartungswert begrenzt den Beleg der Zelle',
    E.rank(SD.toleranceFor(tabelle, { domain: 'highIntensity', sport: 'running' }).evidence) <= E.rank('weak'),
    SD.toleranceFor(tabelle, { domain: 'highIntensity', sport: 'running' }).evidence);
}

/* ══════════════════════════════════════════════════════════════ */
sec('C10 · Der Snapshot friert die damals sichtbare Vorgabe ein');
{
  /* Dass beim Oeffnen die letzte Renderaufloesung verwendet wird, verhindert den
     Fehler im MOMENT der Eingabe. Er verhindert ihn NICHT bei spaeterer
     Neuberechnung: Ein Resolver-Lauf in sechs Monaten koennte aus „im Ziel"
     rueckwirkend „zu langsam" machen. Der Snapshot schliesst genau diese Luecke. */
  const d = SD.debrief({ planned: PLAN(), actual: ACT(), zones: ZONES, rpe: 6, today: TODAY });
  ok('jedes Urteil trägt einen Snapshot', !!d.snapshot);
  ['prescriptionVersion', 'sessionType', 'targetZone', 'targetLoSecPerKm', 'targetHiSecPerKm',
    'expectedRpe', 'expectedRpeEvidence', 'zoneEvidence', 'zoneFreshness', 'zoneUsability']
    .forEach(k => ok('Snapshot enthält ' + k, k in d.snapshot));
  ok('die Prescription-Version ist festgehalten',
    d.snapshot.prescriptionVersion === SD.VERSION, d.snapshot.prescriptionVersion);
  ok('die Zulässigkeit der Zonen ist mitgespeichert',
    d.snapshot.zoneUsability === 'decision_eligible', d.snapshot.zoneUsability);

  /* Der Kernbeweis: Ein gespeicherter Datensatz wird NICHT gegen neue Zonen
     umgedeutet. */
  const rec = Object.assign({ sportId: 'running' }, d);
  ok('ein Datensatz mit Snapshot gilt als abgeschlossen', SD.isFrozen(rec) === true);
  ok('ein Datensatz ohne Snapshot nicht', SD.isFrozen({ adherence: 'im Ziel' }) === false);

  const gelesen = SD.fromRecord(rec);
  ok('fromRecord liest aus dem Snapshot, nicht aus dem Jetzt',
    gelesen.expectedRpe === d.snapshot.expectedRpe && gelesen.zoneEvidence === 'strong');

  /* Gegenprobe: Dieselbe Einheit heute gegen VERAENDERTE Zonen neu bewertet
     ergibt ein anderes Urteil — der gespeicherte Datensatz bleibt davon
     unberuehrt. */
  const neueZonen = { ok: true, confidence: 'strong', ageRatio: 0.1, freshness: 'fresh' };
  const neuBewertet = SD.debrief({
    planned: PLAN({ targetLoSecPerKm: 300, targetHiSecPerKm: 320 }),
    actual: ACT(), zones: neueZonen, rpe: 6, today: TODAY
  });
  ok('mit anderen Zonen fällt das Urteil anders aus',
    neuBewertet.adherence !== d.adherence, `${d.adherence} → ${neuBewertet.adherence}`);
  ok('der gespeicherte Datensatz behält sein Urteil',
    SD.fromRecord(rec).adherence === d.adherence, SD.fromRecord(rec).adherence);
  ok('… und seinen Erwartungswert',
    SD.fromRecord(rec).expectedRpe === d.snapshot.expectedRpe);

  ok('fromRecord liefert für nicht eingefrorene Datensätze null',
    SD.fromRecord({ adherence: 'im Ziel' }) === null);

  /* Auch unzulaessige Zonen werden als solche eingefroren — sonst waere spaeter
     nicht mehr erkennbar, warum eine Einheit nicht bewertet wurde. */
  const alt = SD.debrief({ planned: PLAN(), actual: ACT(), zones: { ok: true, confidence: 'strong', ageRatio: 42 }, rpe: 6 });
  ok('unzulässige Zonen werden als solche festgehalten',
    alt.snapshot.zoneUsability === 'retest_required', alt.snapshot.zoneUsability);
  ok('fehlende Zonen ebenfalls',
    SD.debrief({ planned: PLAN(), actual: ACT(), zones: null, rpe: 6 }).snapshot.zoneUsability === 'unavailable');
}

/* ══════════════════════════════════════════════════════════════ */
sec('C11 · Beobachtung ist nicht Handlungsgrundlage');
{
  /* Ohne `actionable` koennte ein Konsument auf status==='poor' reagieren und
     dabei den Evidenzvertrag umgehen. */
  const schwach = Array.from({ length: 3 }, () => ({
    judged: true, sportId: 'running', domains: ['systemic', 'highIntensity'],
    deltaRpe: 3, deltaPace: 5, expectedRpeEvidence: 'weak'
  }));
  const t1 = SD.toleranceFor(schwach, { domain: 'highIntensity', sport: 'running' });
  ok('schwach belegtes poor wird gemeldet', t1.status === 'poor', t1.status);
  ok('… ist aber NICHT handlungsfähig', t1.actionable === false, String(t1.actionable));
  ok('… und der Beleg sagt warum', t1.evidence === 'weak', t1.evidence);

  const stark = Array.from({ length: 8 }, () => ({
    judged: true, sportId: 'running', domains: ['systemic', 'highIntensity'],
    deltaRpe: 3, deltaPace: 5, expectedRpeEvidence: 'moderate'
  }));
  const t2 = SD.toleranceFor(stark, { domain: 'highIntensity', sport: 'running' });
  ok('gut belegtes poor ist handlungsfähig', t2.status === 'poor' && t2.actionable === true,
    `${t2.status}/${t2.evidence}/${t2.actionable}`);

  ok('unknown ist nie handlungsfähig',
    SD.toleranceFor([], { domain: 'systemic', sport: 'running' }).actionable === false);
  ok('jede Zelle trägt das Feld',
    SD.toleranceState(stark, { sports: ['running'] }).cells.every(c => 'actionable' in c));
  ok('die systemische Aggregation steuert grundsätzlich nicht',
    SD.toleranceState(stark, { sports: ['running'] }).systemic.actionable === false);
}

/* ══════════════════════════════════════════════════════════════ */
sec('C9 · Purität und Robustheit');
{
  const src = readFileSync(join(APP, 'js/engine/session-debrief.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  ok('kein DOM-Zugriff', !/\bdocument\.|\bwindow\.(?!ORVIA)/.test(src));
  ok('keine Systemuhr', !/Date\.now\(|new Date\(\)/.test(src));
  ok('kein Zufall', !/Math\.random/.test(src));
  ok('kein Storage', !/localStorage|sessionStorage/.test(src));
  ok('kein sessionQuality im Code', !/sessionQuality/.test(src));
  ok('kein perceivedDifficulty im Code', !/perceivedDifficulty/.test(src));

  let threw = null;
  [undefined, null, {}, { planned: {} }, { planned: null, actual: {} },
    { planned: PLAN(), actual: ACT(), rpe: 'viel' }].forEach((x, i) => {
    try { SD.debrief(x); } catch (e) { threw = i + ': ' + e.message; }
  });
  [undefined, null, [], [null], [{}]].forEach((x, i) => {
    try { SD.toleranceFor(x, { domain: 'systemic', sport: 'running' }); SD.toleranceState(x, {}); }
    catch (e) { threw = 'tol' + i + ': ' + e.message; }
  });
  ok('keine Eingabe wirft', threw === null, threw || '');

  const a = JSON.stringify(SD.debrief({ planned: PLAN(), actual: ACT(), zones: ZONES, rpe: 6, today: TODAY }));
  const b = JSON.stringify(SD.debrief({ planned: PLAN(), actual: ACT(), zones: ZONES, rpe: 6, today: TODAY }));
  ok('deterministisch', a === b);

  ok('Sessiontyp wird aus dem Label erkannt',
    SD.typeOf({ t: 'Laufen', l: 'Intervalle' }) === 'vo2' &&
    SD.typeOf({ t: 'Laufen', l: 'Long Run' }) === 'long' &&
    SD.typeOf({ t: 'Gym', l: 'Beine' }) === 'strength');
  ok('unbekanntes Label ⇒ unknown, nicht geraten',
    SD.typeOf({ t: 'Laufen', l: 'Irgendwas' }) === 'unknown');
}

console.log('\n' + '═'.repeat(62));
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
