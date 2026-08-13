/* ORVIA · v8-332 — prescription-format: aus einer Verordnung lesbare Zeilen.

   Die zentrale Zusage ist NICHT „es sieht schön aus", sondern: es wird NICHTS
   erfunden. Fehlt ein Pace-Fenster, steht kein Tempo da. Fehlt eine Dauer,
   steht keine Dauer da. Ein Block unbekannten Typs wird gemeldet und NICHT
   mit einem Sammelbegriff überdeckt — genau dieses Überdecken war der
   Grundfehler, den ORVIA an allen anderen Stellen schon vermeidet.

   Geprüft wird gegen die ECHTE prescription-factory, nicht gegen
   handgeschriebene Wunsch-Fixtures: wenn die Factory ihre Struktur ändert,
   muss dieser Test es merken.

   node supabase/tests/prescription_format_test.mjs */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = [_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
  .find(p => existsSync(join(p, 'js', 'engine', 'prescription-format.js'))) || _flat;

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const F = require(join(APP, 'js/engine/prescription-format.js'));
const PF = require(join(APP, 'js/engine/prescription-factory.js'));
const WP = require(join(APP, 'js/engine/week-projection.js'));

const SCHWELLE = 300;                       // 5:00 min/km
const EV = { thresholdPaceSecPerKm: SCHWELLE, confidence: 'high' };

/* ══ E · Einheiten ══ */
sec('E · Einheiten — richtig oder gar nicht');
ok('Pace wird als m:ss geschrieben (306 s ⇒ 5:06, führende Null bei den Sekunden)',
  F.paceText(306) === '5:06' && F.paceText(300) === '5:00' && F.paceText(365) === '6:05');
ok('untaugliche Pace ergibt NICHTS statt 0:00',
  [0, -1, null, undefined, NaN, Infinity, '300', {}].every(v => F.paceText(v) === null));
ok('Dauer: unter 90 s in Sekunden, darüber in Minuten, ab 90 min als h:mm',
  F.durationText(45) === '45 s' && F.durationText(240) === '4 min' &&
  F.durationText(3600) === '60 min' && F.durationText(5700) === '1:35 h');
ok('untaugliche Dauer ergibt NICHTS',
  [0, -60, null, NaN, '600'].every(v => F.durationText(v) === null));
ok('Distanz: unter 1 km in Metern, darüber in Kilometern mit deutschem Komma',
  F.distanceText(800) === '800 m' && F.distanceText(1000) === '1 km' &&
  F.distanceText(1500) === '1,5 km' && F.distanceText(21097) === '21,1 km');
ok('die Einheit der Abbruchbedingung wird ernst genommen (km ≠ m)',
  F.completionText({ type: 'distance', value: 1, unit: 'km' }) === '1 km' &&
  F.completionText({ type: 'distance', value: 1000, unit: 'm' }) === '1 km' &&
  F.completionText({ type: 'distance', value: 5, unit: 'lichtjahre' }) === null);
ok('eine offene Abbruchbedingung erzeugt KEINEN Text (nicht „0" und nicht „offen")',
  F.completionText({ type: 'open' }) === null && F.completionText(null) === null);

/* ══ Z · Ziele ══ */
sec('Z · Ziele — Bereich, Wert, oder Schweigen');
ok('Pace-Bereich wird von schnell nach langsam geschrieben, nicht in Eingabereihenfolge',
  F.targetText({ type: 'pace', min: 306, max: 324 }) === '5:06–5:24 min/km' &&
  F.targetText({ type: 'pace', min: 324, max: 306 }) === '5:06–5:24 min/km');
ok('einzelne Grenzen werden als „ab" bzw. „bis" ausgewiesen',
  F.targetText({ type: 'pace', min: 300 }) === 'ab 5:00 min/km' &&
  F.targetText({ type: 'pace', max: 330 }) === 'bis 5:30 min/km');
ok('die weiteren Zieltypen tragen ihre Einheit',
  F.targetText({ type: 'rpe', value: 7 }) === 'RPE 7' &&
  F.targetText({ type: 'rir', value: 2 }) === 'RIR 2' &&
  F.targetText({ type: 'hr', min: 140, max: 155 }) === '140–155 bpm' &&
  F.targetText({ type: 'power', value: 240 }) === '240 W' &&
  F.targetText({ type: 'weight', value: 82.5 }) === '82,5 kg' &&
  F.targetText({ type: 'cadence', value: 180 }) === '180 /min');
ok('ein offenes oder unbekanntes Ziel erzeugt KEINEN Text (kein Raten)',
  F.targetText({ type: 'open' }) === null &&
  F.targetText({ type: 'gedankenkraft', value: 9 }) === null &&
  F.targetText(null) === null && F.targetText('schnell') === null);

/* ══ V · Verordnungen aus der ECHTEN Factory ══ */
sec('V · echte Verordnungen werden lesbar');
{
  const iv = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_intervals', durationMin: 60 }, EV);
  const r = F.formatPrescription(iv.workout);
  ok('Intervalle: die Wiederholungsgruppe steht als EINE Zeile mit Anzahl und Inhalt',
    r.ok === true && r.lines.some(l => l.kind === 'group' && /^\d+ × \(/.test(l.text)),
    JSON.stringify(r.lines.map(l => l.text)));
  const g = r.lines.find(l => l.kind === 'group');
  ok('  … die Gruppe nennt ihre Durchgangszahl auch strukturiert, nicht nur im Text',
    g && g.iterations >= 1 && Array.isArray(g.children) && g.children.length === 2);
  ok('  … Belastung und Pause sind darin unterscheidbar',
    g.children[0].kind === 'work' && g.children[1].kind === 'recovery');
  ok('  … das Pace-Fenster steht drin und stimmt mit der Verordnung überein',
    /4:36–4:54 min\/km/.test(g.text), g.text);
  ok('  … Aufwärmen und Auslaufen sind vorhanden, aber als eigene Zeilen',
    r.lines.some(l => l.kind === 'warmup') && r.lines.some(l => l.kind === 'cooldown'));
  ok('  … und es gibt keine Warnungen bei einer regulären Verordnung',
    r.warnings.length === 0, JSON.stringify(r.warnings));
}
{
  const t = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_tempo', durationMin: 75 }, EV);
  const s = F.summaryLine(t.workout);
  ok('Tempolauf: die Zusammenfassung nennt die BELASTUNG, nicht das Aufwärmen',
    typeof s === 'string' && /5:06–5:24 min\/km/.test(s) && !/Aufwärmen/.test(s), s);
}
{
  /* Ohne Pace-Evidenz darf NIRGENDS ein Tempo stehen — RUN-INT-001 muss sich
     bis in die Anzeige durchhalten, sonst nützt die Regel nichts. */
  const ohne = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_intervals', durationMin: 60 }, null);
  const r = F.formatPrescription(ohne.workout);
  const text = r.lines.map(l => l.text).join(' | ');
  ok('OHNE Pace-Evidenz erscheint in der ganzen Anzeige kein einziges Pace-Fenster',
    r.ok === true && !/min\/km/.test(text) && /RPE/.test(text), text);
}
{
  const gym = PF.buildPrescription({ sportId: 'strength', sessionType: 'strength_general',
    exercises: [{ exerciseId: 'bench_press', sets: 4, reps: 8, rir: 2, restSeconds: 150 }] }, null);
  const r = F.formatPrescription(gym.workout, { nameOf: id => ({ bench_press: 'Bankdrücken' })[id] });
  ok('Kraft: Name, Sätze, Wiederholungen, RIR und Pause stehen in einer Zeile',
    r.ok === true && r.lines[0].kind === 'exercise' &&
    r.lines[0].text === 'Bankdrücken — 4 × 8 · RIR 2 · 3 min Pause', r.lines[0].text);
  const roh = F.formatPrescription(gym.workout);
  ok('  … ohne Namensauflösung steht die exercise_id da — sichtbar unaufgelöst statt „Übung"',
    roh.lines[0].text.indexOf('bench_press') === 0, roh.lines[0].text);
}

/* ══ N · Nichts erfinden ══ */
sec('N · was nicht dasteht, wird nicht ergänzt');
ok('fehlende Verordnung ⇒ ok:false mit Grund, keine leere Zeile',
  [null, undefined, 'text', 42, []].every(v => {
    const r = F.formatPrescription(v);
    return r.ok === false && r.lines.length === 0 && r.warnings[0].code === 'prescription_missing';
  }));
ok('Verordnung ohne Blöcke ⇒ ok:false (blocks_empty), nicht „leeres Training"',
  F.formatPrescription({ blocks: [] }).warnings[0].code === 'blocks_empty' &&
  F.formatPrescription({ blocks: 'keine' }).warnings[0].code === 'blocks_empty');
ok('unbekannter Blocktyp wird GEMELDET und nicht mit einem Sammelbegriff überdeckt',
  (() => {
    const r = F.formatPrescription({ blocks: [{ type: 'meditation', completion: { type: 'duration', value: 600 } }] });
    return r.ok === false && r.warnings.some(w => w.code === 'unknown_block_type' && w.got === 'meditation');
  })());
ok('Wiederholungsgruppe mit 0, -1 oder gebrochener Anzahl ⇒ Warnung statt Gruppe',
  [0, -1, 2.5, null, 'vier'].every(n => {
    const r = F.formatPrescription({ blocks: [{ type: 'repeat', iterations: n,
      blocks: [{ type: 'work', completion: { type: 'duration', value: 60 } }] }] });
    return r.ok === false && r.warnings.some(w => w.code === 'repeat_iterations_invalid');
  }));
ok('leere Wiederholungsgruppe ⇒ Warnung statt „0 ×"',
  F.formatPrescription({ blocks: [{ type: 'repeat', iterations: 4, blocks: [] }] })
    .warnings.some(w => w.code === 'repeat_empty'));
ok('Übungsblock ohne exercise_id ⇒ Warnung statt namenloser Zeile',
  F.formatPrescription({ blocks: [{ type: 'exercise', sets: 3 }] })
    .warnings.some(w => w.code === 'exercise_without_id'));
ok('ein Block OHNE Dauer und OHNE Ziel ergibt nur seine Beschriftung, keine erfundene Angabe',
  (() => {
    const r = F.formatPrescription({ blocks: [{ type: 'warmup', completion: { type: 'open' } }] });
    return r.ok === true && r.lines[0].text === 'Aufwärmen' &&
      r.lines[0].completion === null && r.lines[0].target === null;
  })());
ok('gültige Blöcke überleben, auch wenn ein anderer Block unbrauchbar ist',
  (() => {
    const r = F.formatPrescription({ blocks: [
      { type: 'warmup', completion: { type: 'duration', value: 600 } },
      { type: 'unfug' },
      { type: 'work', completion: { type: 'duration', value: 1800 }, target: { type: 'rpe', value: 7 } }] });
    return r.ok === true && r.lines.length === 2 && r.warnings.length === 1;
  })());

/* ══ P · Reinheit ══ */
sec('P · rein und deterministisch');
{
  const iv = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_intervals', durationMin: 60 }, EV);
  const vorher = JSON.stringify(iv.workout);
  const a = JSON.stringify(F.formatPrescription(iv.workout));
  const b = JSON.stringify(F.formatPrescription(iv.workout));
  ok('zweimal formatieren ergibt exakt dasselbe', a === b);
  ok('die Verordnung wird dabei NICHT verändert', JSON.stringify(iv.workout) === vorher);
  const raw = readFileSync(join(APP, 'js/engine/prescription-format.js'), 'utf8');
  ok('kein DOM, kein Storage, kein Netz, keine eigene Zeitquelle im Modul',
    !/document\.|localStorage|sessionStorage|fetch\(|XMLHttpRequest|Date\.now|new Date/.test(raw));
  ok('das Modul liefert DATEN, kein HTML (Aussehen bleibt Sache der Oberfläche)',
    !/<div|<span|innerHTML/.test(raw));
}

/* ══ W · Die Kette bis zur Wochenkarte ══ */
sec('W · Scheduler → Projektion → Karte');
{
  const rx = PF.buildPrescription({ sportId: 'running', sessionType: 'endurance_intervals', durationMin: 60 }, EV).workout;
  const out = { ok: true, weekKey: '2026-W33', sessions: [{ sessionId: 's1', weekday: 'di',
    sportId: 'running', prescription: rx, provenance: { scheduler: 'scheduler-v2@1' } }] };
  const proj = WP.projectWeek(out);
  const it = proj.days[1][0];
  ok('die Verordnung erreicht das Anzeige-Item (genau das fiel bis v8-331 weg)',
    it && it.rx && Array.isArray(it.rx.blocks) && it.rx.blocks.length > 0);
  ok('  … verlustfrei: Feld für Feld dasselbe wie in der Verordnung',
    JSON.stringify(it.rx) === JSON.stringify(rx));
  ok('  … aber als KOPIE, nicht als geteilte Struktur',
    it.rx !== rx && (() => {
      it.rx.blocks.length = 0;
      return rx.blocks.length > 0;                    // die Quelle bleibt unberührt
    })());
  const it2 = WP.projectWeek(out).days[1][0];
  ok('  … und das bestehende Anzeigemodell bleibt unverändert erhalten',
    ['t', 'l', 'd', 'id', 'prov'].every(k => Object.prototype.hasOwnProperty.call(it2, k)) &&
    it2.t === 'Laufen' && typeof it2.d === 'string');
  const zeilen = F.formatPrescription(it2.rx).lines.map(l => l.text);
  ok('  … und aus der Karte wird eine echte Ansage statt nur „59 min"',
    zeilen.some(t => /× \(/.test(t) && /min\/km/.test(t)), zeilen.join(' | '));
}

/* ══ A · Anbindung in der App ══ */
sec('A · Modul ist geladen und offline verfügbar');
{
  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  ok('index.html lädt prescription-format', /js\/engine\/prescription-format\.js/.test(html));
  ok('sw.js hat es im Offline-Vorrat', /'\.\/js\/engine\/prescription-format\.js'/.test(sw));
  const ui = readFileSync(join(APP, 'js/ui.js'), 'utf8');
  ok('die Vorschau nutzt AUSSCHLIESSLICH dieses Modul (keine zweite Formatierung in der UI)',
    /ORVIA\.prescriptionFormat/.test(ui) && /formatPrescription\(/.test(ui));
  ok('die Vorschau persistiert nichts und aktiviert nichts (der Schatten-Eintrag der Engine ist bekannt und in rx_preview_ui geprüft)',
    (() => {
      const start = ui.indexOf('function gmRxPreviewBuild(');
      const ende = ui.indexOf('function gmRxPreviewSection(');
      const block = ui.slice(start, ende);
      return start > 0 && ende > start &&
        !/gmCanonPlanPersist|planActivation|PA\.activate|logEvent|saveProfile|localStorage/.test(block);
    })());
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
