/* ORVIA · Performance Evidence Input (Bauplan Stufe 1 / G1)

   Geprüfte Zusagen:
     G1  Jeder gespeicherte Wert trägt eine vollständige Evidence-Hülle
     G2  Unplausible Werte werden ABGELEHNT, nicht umgerechnet (die 1:50-Falle)
     G3  Mehrdeutigkeit führt zur Rückfrage, nicht zu einer stillen Entscheidung
     G4  Drei Zustände: ok · rejected · needs_input — nie nur zwei
     G5  Testprotokoll und Sportlevel passen zusammen; jedes Protokoll ist
         vollständig ausfüllbar (sonst ist der leere Zustand nicht zu verlassen)
     G6  Protokollspezifische Prüfungen, die eine Bereichsprüfung nicht sieht
     G7  Der geschriebene Eintrag ist genau die Form, die performance-resolver liest
     G8  coverage() benennt, WAS fehlt und WAS zu tun ist — nicht nur „fehlt"
     G9  Purität

   node supabase/tests/performance_input_test.mjs [appRoot-absolut] */
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
const PZ = require(join(APP, 'js/engine/performance-zones.js'));
const PR = require(join(APP, 'js/engine/performance-resolver.js'));
const PI = require(join(APP, 'js/engine/performance-input.js'));

const TODAY = '2026-08-07';
const T = { today: TODAY };

/* ══════════════════════════════════════════════════════════════ */
sec('G1 · Jeder Wert trägt seine Herkunft');
{
  const r = PI.validateRace({ distance: '10 km', time: '48:30', context: 'Wettkampf', measuredAt: '2026-07-20' }, T);
  ok('Wettkampf wird angenommen', r.status === 'ok', r.status);
  ok('Hülle ist vollständig',
    ['value', 'source', 'measuredAt', 'method', 'evidence', 'staleAfter', 'freshness', 'ageDays', 'ageRatio']
      .every(k => k in r.evidence), Object.keys(r.evidence).join(','));
  ok('Wettkampf ⇒ Quelle race_result', r.evidence.source === 'race_result', r.evidence.source);
  ok('Wettkampf ⇒ Beleg strong', r.evidence.evidence === 'strong', r.evidence.evidence);
  ok('Methode wird festgehalten', r.evidence.method === '10km_race', r.evidence.method);

  const t = PI.validateRace({ distance: '10 km', time: '48:30', context: 'Test', measuredAt: '2026-07-20' }, T);
  ok('Trainingsbestzeit ⇒ Quelle test, nicht race_result', t.evidence.source === 'test', t.evidence.source);
  ok('der Unterschied ist nicht kosmetisch: andere Haltbarkeit',
    t.evidence.staleAfter !== r.evidence.staleAfter, `${t.evidence.staleAfter} vs ${r.evidence.staleAfter}`);

  const v = PI.validateValue({ field: 'ftp', value: '250', date: '2026-08-01' }, T);
  ok('selbst eingetragener FTP ⇒ self_report, nicht test', v.evidence.source === 'self_report', v.evidence.source);
  ok('… und damit Beleg weak', v.evidence.evidence === 'weak', v.evidence.evidence);
  const vd = PI.validateValue({ field: 'ftp', value: '250', date: '2026-08-01', source: 'device' }, T);
  ok('Gerätewert ⇒ moderate', vd.evidence.evidence === 'moderate', vd.evidence.evidence);

  const ts = PI.validateTest({ sportId: 'cycling', id: 'ftp20', avgWatts: 263, date: '2026-08-01' }, T);
  ok('Test ⇒ Beleg strong (höher als Selbstauskunft)', ts.evidence.evidence === 'strong', ts.evidence.evidence);
  const hr = PI.validateTest({ sportId: 'cycling', id: 'hr_threshold', avgHr: 172, date: '2026-08-01' }, T);
  ok('HF-Test ohne Powermeter bleibt moderate — das Protokoll gibt es so vor',
    hr.evidence.evidence === 'moderate', hr.evidence.evidence);
}

/* ══════════════════════════════════════════════════════════════ */
sec('G2 · Ablehnen statt umdeuten — die 1:50-Falle');
{
  /* Der reale Anlass: „1:50" für einen Halbmarathon meint 1 Stunde 50, „48:30"
     für 10 km meint 48 Minuten 30. Eine frühere Fassung las beides als
     Minuten:Sekunden und machte aus 1:50 eine HM-Zeit von 1,8 Minuten. */
  const hm = PI.validateRace({ distance: 'HM', time: '1:50', measuredAt: '2026-07-20' }, T);
  ok('1:50 auf HM wird als 1 h 50 gelesen', hm.status === 'ok' && hm.derived.minutes === 110, String(hm.derived && hm.derived.minutes));
  ok('… über Plausibilität, nicht über die Größe der Zahlen', hm.derived.reading === 'h:m', hm.derived.reading);
  ok('… ergibt eine realistische Pace',
    hm.derived.paceSecPerKm > 120 && hm.derived.paceSecPerKm < 900, hm.derived.paceSecPerKm + ' s/km');

  const zehn = PI.validateRace({ distance: '10 km', time: '48:30', measuredAt: '2026-07-20' }, T);
  ok('48:30 auf 10 km wird als 48 min 30 gelesen', zehn.derived.minutes === 48.5, String(zehn.derived.minutes));
  ok('dieselbe Schreibweise, zwei Bedeutungen — beide richtig aufgelöst',
    hm.derived.reading !== zehn.derived.reading);

  /* Was in KEINER Lesart plausibel ist, wird abgelehnt. */
  const irr = PI.validateRace({ distance: '10 km', time: '5:00', measuredAt: '2026-07-20' }, T);
  ok('10 km in 5 min wird abgelehnt', irr.status === 'rejected', irr.status);
  ok('… mit benanntem Grund', irr.errors.some(e => e.reason === 'implausible_pace'), JSON.stringify(irr.errors));
  ok('… und mit beiden geprüften Lesarten',
    irr.errors.some(e => e.alternatives), JSON.stringify(irr.errors[0].alternatives || null));

  const langsam = PI.validateRace({ distance: '10 km', time: '4:00:00', measuredAt: '2026-07-20' }, T);
  ok('10 km in 4 Stunden wird abgelehnt', langsam.status === 'rejected', langsam.status);

  ok('unsinnige Distanz wird abgelehnt',
    PI.validateRace({ distance: '5000 km', time: '48:30' }, T).status === 'rejected');
  ok('Datum in der Zukunft wird abgelehnt',
    PI.validateRace({ distance: '10 km', time: '48:30', measuredAt: '2027-01-01' }, T).status === 'rejected');
  ok('Datum von vor 20 Jahren wird abgelehnt (vertippte Jahreszahl)',
    PI.validateRace({ distance: '10 km', time: '48:30', measuredAt: '2006-01-01' }, T).status === 'rejected');
  ok('Text statt Zeit wird abgelehnt',
    PI.validateRace({ distance: '10 km', time: 'schnell' }, T).status === 'rejected');
}

/* ══════════════════════════════════════════════════════════════ */
sec('G3 · Mehrdeutigkeit führt zur Rückfrage');
{
  /* Ohne Distanz ist „1:50" nicht entscheidbar. Eine Funktion, die still eine
     Lesart wählt, kann nicht melden, dass sie geraten hat. */
  const t = PI.readTime('1:50', null);
  ok('ohne Distanz ist die Lesart mehrdeutig', t.ok === true && t.ambiguous === true);
  ok('… beide Lesarten werden ausgewiesen',
    t.alternatives['m:s'] != null && t.alternatives['h:m'] === 110, JSON.stringify(t.alternatives));

  const r = PI.validateRace({ distance: '', time: '1:50' }, T);
  ok('Eingabe ohne Distanz ⇒ needs_input, nicht rejected', r.status === 'needs_input', r.status);
  ok('… und die Rückfrage benennt das fehlende Feld',
    r.needs.some(n => n.field === 'distance'), JSON.stringify(r.needs.map(n => n.field)));

  /* Eindeutig geschrieben ⇒ keine Rückfrage. */
  ok('1:50:00 ist eindeutig', PI.readTime('1:50:00', 21.0975).ambiguous === false);

  /* BEWEISBARE EIGENSCHAFT statt Stichprobe: Die Lesart „Stunden:Minuten" ist
     IMMER exakt das 60-Fache der Lesart „Minuten:Sekunden"
     (60·p0 + p1 = 60·(p0 + p1/60)). Das plausible Pace-Fenster ist aber nur
     15/2 = 7,5-fach breit. Bei BEKANNTER Distanz können deshalb nie beide
     Lesarten gleichzeitig plausibel sein — Mehrdeutigkeit entsteht
     ausschließlich, wenn die Distanz fehlt. Diese Eigenschaft ist stärker als
     ein Einzelfall und wird hier über den ganzen Eingaberaum geprüft. */
  const [pmin, pmax] = PI.LIMITS.paceMinPerKm;
  ok('das Pace-Fenster ist schmaler als der Faktor 60 zwischen den Lesarten',
    (pmax / pmin) < 60, `${pmax}/${pmin} = ${(pmax / pmin).toFixed(1)}×`);

  let ambigMitDistanz = [];
  for (let km of [0.4, 1, 5, 10, 21.0975, 42.195, 100]) {
    for (let h = 0; h <= 9; h++) {
      for (let m of [0, 5, 15, 30, 45, 59]) {
        const r = PI.readTime(h + ':' + ('0' + m).slice(-2), km);
        if (r.ok && r.ambiguous) ambigMitDistanz.push(`${h}:${m}@${km}km`);
      }
    }
  }
  ok('bei bekannter Distanz ist KEINE Eingabe mehrdeutig',
    ambigMitDistanz.length === 0, ambigMitDistanz.slice(0, 5).join(', '));
  ok('ohne Distanz dagegen schon',
    PI.readTime('1:50', null).ambiguous === true);
}

/* ══════════════════════════════════════════════════════════════ */
sec('G4 · Drei Zustände, nicht zwei');
{
  const states = [
    PI.validateRace({ distance: '10 km', time: '48:30', measuredAt: '2026-07-20' }, T).status,
    PI.validateRace({ distance: '10 km' }, T).status,
    PI.validateRace({ distance: '10 km', time: '5:00' }, T).status
  ];
  ok('alle drei Zustände kommen vor', new Set(states).size === 3, states.join(','));
  ok('unvollständig ist needs_input, kein Fehler', states[1] === 'needs_input');
  ok('unplausibel ist rejected', states[2] === 'rejected');

  /* Gegenprobe zur Abgrenzung: „2:00" auf 10 km ist NICHT unplausibel — als
     2 Stunden gelesen sind das 12 min/km, ein langsamer, aber realer Lauf. Die
     Prüfung darf nicht schon bei ungewohnten Werten abweisen, sonst kann ein
     langsamer Einsteiger seine Zeit nicht eintragen. */
  const langsamAberEcht = PI.validateRace({ distance: '10 km', time: '2:00', measuredAt: '2026-07-20' }, T);
  ok('2:00 auf 10 km wird angenommen (12 min/km, langsam aber real)',
    langsamAberEcht.status === 'ok' && langsamAberEcht.derived.minutes === 120,
    langsamAberEcht.status + ' ' + (langsamAberEcht.derived && langsamAberEcht.derived.paceSecPerKm) + ' s/km');

  const t = PI.validateTest({ sportId: 'running', id: 'cooper12' }, T);
  ok('Test ohne Werte ⇒ needs_input', t.status === 'needs_input', t.status);
  ok('… und nennt genau das fehlende Feld',
    t.needs.some(n => n.field === 'distanceKm'), JSON.stringify(t.needs.map(n => n.field)));

  /* Ein fehlendes Datum ist eine WARNUNG, keine Ablehnung — sonst wäre der
     leere Zustand für jemanden ohne Datumsgedächtnis nicht zu verlassen. */
  const nd = PI.validateRace({ distance: '10 km', time: '48:30' }, T);
  ok('ohne Datum: angenommen, aber gewarnt',
    nd.status === 'ok' && nd.warnings.some(w => w.reason === 'no_date'));
  ok('… und die Hülle sagt ehrlich „ohne Datum"', nd.evidence.freshness === 'unknown', nd.evidence.freshness);
}

/* ══════════════════════════════════════════════════════════════ */
sec('G5 · Jedes Protokoll ist vollständig ausfüllbar');
{
  /* Wäre ein Protokoll nicht befüllbar, könnte ein Einsteiger den leeren
     Zustand nicht verlassen — das Hauptrisiko dieser Stufe. */
  const SAMPLE = {
    cooper12: { distanceKm: 2.8 }, tt30: { distanceKm: 6.4 }, test5k: { durationMin: 24 },
    ftp20: { avgWatts: 263 }, ftp8: { avgWatts: 300 }, hr_threshold: { avgHr: 172 },
    css400_200: { t400Sec: 372, t200Sec: 178 }, swim_tt: { distanceM: 520 }
  };
  ['running', 'cycling', 'swimming'].forEach(sport => {
    const protos = PI.protocolsFor(sport);
    ok(sport + ': mindestens ein Protokoll vorhanden', protos.length > 0, String(protos.length));
    ok(sport + ': mindestens eins für Einsteiger',
      protos.some(p => p.level === 'anfaenger'), protos.map(p => p.level).join(','));
    protos.forEach(p => {
      ok(`${p.id}: Anleitung vorhanden`, typeof p.howto === 'string' && p.howto.length > 20);
      const input = Object.assign({ sportId: sport, id: p.id, date: '2026-08-01' }, SAMPLE[p.id] || {});
      const r = PI.validateTest(input, T);
      ok(`${p.id}: mit plausiblen Werten annehmbar`, r.status === 'ok',
        r.status + ' ' + JSON.stringify(r.errors || r.needs));
    });
  });

  /* Der Diagnosepfad muss zum Sportlevel passen. */
  const beg = PZ.diagnosticPathFor('running', 'beginner');
  const comp = PZ.diagnosticPathFor('running', 'competitive');
  ok('Einsteiger ⇒ Test als erster Schritt', beg.primary === 'test', beg.primary);
  ok('Wettkampforientiert ⇒ Wettkampfergebnis als erster Schritt', comp.primary === 'race_result', comp.primary);
  ok('Einsteiger bekommt zuerst ein Einsteigerprotokoll',
    beg.tests[0] && beg.tests[0].level === 'anfaenger', beg.tests[0] && beg.tests[0].level);
}

/* ══════════════════════════════════════════════════════════════ */
sec('G6 · Protokollspezifische Prüfungen');
{
  const bad = PI.validateTest({ sportId: 'swimming', id: 'css400_200', t400Sec: 170, t200Sec: 178, date: '2026-08-01' }, T);
  ok('400 m schneller als 200 m wird abgelehnt', bad.status === 'rejected', bad.status);
  ok('… mit der richtigen Begründung',
    bad.errors.some(e => e.reason === 'css_400_not_slower_than_200'), JSON.stringify(bad.errors));

  const meter = PI.validateTest({ sportId: 'running', id: 'cooper12', distanceKm: 2800, date: '2026-08-01' }, T);
  ok('Cooper mit Metern statt Kilometern wird gefangen', meter.status === 'rejected', meter.status);
  ok('… und der Hinweis nennt den wahrscheinlichen Grund',
    meter.errors.some(e => /Meter statt Kilometer/.test(e.detail || '')) ||
    meter.errors.some(e => e.reason === 'out_of_range'), JSON.stringify(meter.errors));

  const langsam = PI.validateTest({ sportId: 'swimming', id: 'swim_tt', distanceM: 60, date: '2026-08-01' }, T);
  ok('10 min für 60 m wird abgelehnt', langsam.status === 'rejected', langsam.status);

  ok('FTP von 25 W wird abgelehnt (Tippfehler für 250)',
    PI.validateValue({ field: 'ftp', value: '25' }, T).status === 'rejected');
  ok('FTP von 250 W wird angenommen',
    PI.validateValue({ field: 'ftp', value: '250' }, T).status === 'ok');
  ok('FTP von 900 W wird abgelehnt',
    PI.validateValue({ field: 'ftp', value: '900' }, T).status === 'rejected');
  ok('unbekanntes Protokoll wird abgelehnt, nicht geraten',
    PI.validateTest({ sportId: 'running', id: 'erfunden' }, T).status === 'rejected');
  ok('unbekanntes Einzelfeld wird abgelehnt',
    PI.validateValue({ field: 'erfunden', value: '1' }, T).status === 'rejected');
}

/* ══════════════════════════════════════════════════════════════ */
sec('G7 · Der Eintrag ist genau die Form, die der Resolver liest');
{
  /* Die eigentliche Zusage von G1: Was hier gespeichert wird, muss beim
     Resolver ankommen — sonst füllt die Maske ein Feld, das niemand liest. */
  const race = PI.validateRace({ distance: '10 km', time: '48:30', context: 'Wettkampf', measuredAt: '2026-07-20' }, T);
  const test = PI.validateTest({ sportId: 'cycling', id: 'ftp20', avgWatts: 263, date: '2026-08-01' }, T);
  const swim = PI.validateTest({ sportId: 'swimming', id: 'css400_200', t400Sec: 372, t200Sec: 178, date: '2026-08-01' }, T);

  ok('Wettkampf landet in personalBests', race.target === 'personalBests', race.target);
  ok('Test landet in tests', test.target === 'tests', test.target);

  const profile = {
    sports: [{ sportId: 'running', fields: { level: 'fortgeschritten' } },
      { sportId: 'cycling', fields: {} }, { sportId: 'swimming', fields: {} }],
    performance: { personalBests: [race.entry], tests: [test.entry, swim.entry] }
  };
  const all = PR.resolveAll(profile, { today: TODAY });

  ok('der Resolver findet die Laufzonen', all.sports.running.ok === true,
    all.sports.running.reason || '');
  ok('… mit dem Beleg des Wettkampfs', all.sports.running.confidence === 'strong', all.sports.running.confidence);
  ok('der Resolver findet die Radzonen', all.sports.cycling.ok === true, all.sports.cycling.reason || '');
  ok('… und rechnet FTP aus dem Test', all.sports.cycling.ftpWatts === 250, String(all.sports.cycling.ftpWatts));
  ok('der Resolver findet die Schwimmzonen', all.sports.swimming.ok === true, all.sports.swimming.reason || '');
  ok('alle drei Sportarten haben Zonen', all.summary.every(x => x.ok),
    JSON.stringify(all.summary.map(x => x.sportId + ':' + x.ok)));

  /* Und die Kette bis zur Plankarte: aus den Zonen muss eine Vorgabe werden. */
  const pace = PZ.paceForUnit({ t: 'Laufen', l: 'Long Run' }, all.sports.running);
  ok('aus den Zonen wird eine Pace-Vorgabe', pace.ok === true && /\d+:\d\d/.test(pace.text), pace.text || pace.reason);
  const fc = PZ.forecast(all.sports.running, 21.0975);
  ok('… und eine Zielprognose statt „—"', fc.ok === true && fc.realisticMin > 0, String(fc.realisticMin));
}

/* ══════════════════════════════════════════════════════════════ */
sec('G8 · coverage sagt, was fehlt UND was zu tun ist');
{
  const leer = { sports: [{ sportId: 'running', fields: { level: 'Einsteiger' } }] };
  const c0 = PI.coverage(leer, { today: TODAY });
  ok('leeres Profil: nichts ist ok', c0.anyOk === false, JSON.stringify(c0.missing));
  ok('alle drei Sportarten werden als fehlend benannt', c0.missing.length === 3, c0.missing.join(','));
  ok('für Einsteiger ist der nächste Schritt ein Test',
    c0.sports.running.nextStep === 'test', c0.sports.running.nextStep);
  ok('… mit konkretem Vorschlag statt „bitte Daten ergänzen"',
    typeof c0.sports.running.suggestion === 'string' && c0.sports.running.suggestion.length > 15,
    c0.sports.running.suggestion);
  ok('… und mit ausfüllbaren Protokollen',
    c0.sports.running.protocols.length > 0 && c0.sports.running.protocols[0].howto);

  const comp = { sports: [{ sportId: 'running', fields: { level: 'Wettkampf' } }] };
  const cc = PI.coverage(comp, { today: TODAY });
  ok('wettkampforientiert: nächster Schritt ist das Wettkampfergebnis',
    cc.sports.running.nextStep === 'race_result', cc.sports.running.nextStep);

  const race = PI.validateRace({ distance: '10 km', time: '48:30', context: 'Wettkampf', measuredAt: '2026-07-20' }, T);
  const voll = { sports: [{ sportId: 'running', fields: {} }], performance: { personalBests: [race.entry], tests: [] } };
  const c1 = PI.coverage(voll, { today: TODAY });
  ok('mit Wettkampf: Laufen ist abgedeckt', c1.sports.running.ok === true);
  ok('… mit Belegstufe strong', c1.sports.running.evidence === 'strong', c1.sports.running.evidence);
  ok('… Rad und Schwimmen bleiben offen', c1.missing.join(',') === 'cycling,swimming', c1.missing.join(','));

  /* Ein alter Wert ist vorhanden UND ein Hinweis — sonst merkt niemand, dass
     die Zonen seit Jahren aus derselben Zahl kommen. */
  const alt = PI.validateRace({ distance: '10 km', time: '48:30', context: 'Wettkampf', measuredAt: '2025-01-01' }, T);
  const cAlt = PI.coverage({ sports: [{ sportId: 'running', fields: {} }], performance: { personalBests: [alt.entry], tests: [] } }, { today: TODAY });
  ok('veralteter Wert zählt weiterhin als vorhanden', cAlt.sports.running.ok === true);
  ok('… wird aber als veraltet markiert', cAlt.sports.running.staleHint === true);
  ok('… und behält Beleg strong (getrennte Achsen)', cAlt.sports.running.evidence === 'strong');

  ok('coverage stürzt bei null nicht ab', !!PI.coverage(null, { today: TODAY }));
}

/* ══════════════════════════════════════════════════════════════ */
sec('G9 · Purität und Robustheit');
{
  const src = readFileSync(join(APP, 'js/engine/performance-input.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  ok('kein DOM-Zugriff', !/\bdocument\.|\bwindow\.(?!ORVIA)/.test(src));
  ok('keine Systemuhr', !/Date\.now\(|new Date\(\)/.test(src));
  ok('kein Zufall', !/Math\.random/.test(src));
  ok('kein Storage', !/localStorage|sessionStorage/.test(src));
  ok('kein Schreibzugriff auf PROFILE', !/PROFILE/.test(src));

  let threw = null;
  [undefined, null, {}, { distance: {} }, { time: [] }, { sportId: 42 }].forEach((x, i) => {
    try { PI.validateRace(x, T); PI.validateTest(x, T); PI.validateValue(x, T); }
    catch (e) { threw = i + ': ' + e.message; }
  });
  ok('keine Eingabe wirft', threw === null, threw || '');

  const a = JSON.stringify(PI.validateRace({ distance: '10 km', time: '48:30', measuredAt: '2026-07-20' }, T));
  const b = JSON.stringify(PI.validateRace({ distance: '10 km', time: '48:30', measuredAt: '2026-07-20' }, T));
  ok('deterministisch', a === b);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Oberfläche · Route und Einstieg vorhanden');
{
  const ui = readFileSync(join(APP, 'js/ui.js'), 'utf8');
  ok('Route performance ist registriert', /performance:function\(\)\{return gmProfPerformance\(\);\}/.test(ui));
  ok('Seite existiert', /function gmProfPerformance\(\)/.test(ui));
  ok('Einstieg im Profil vorhanden', /gmOpenProfPage\('performance'\)/.test(ui));
  ok('die Prüfung liegt NICHT in der Oberfläche — sie ruft das reine Modul',
    /gmPerfMod\(\)/.test(ui) && !/PACE_MIN|LIMITS\s*=/.test(ui.slice(ui.indexOf('function gmProfPerformance'))));
  ok('Testanleitung wird direkt in der Maske gezeigt (leerer Zustand füllbar)',
    /p\.howto/.test(ui));
  ok('Speichern läuft über saveProfile', /_gmPerfPersist/.test(ui));

  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  ok('Modul ist eingehängt', /js\/engine\/performance-input\.js/.test(html));
  ok('… nach evidence.js (Reihenfolge zählt)',
    html.indexOf('js/engine/evidence.js') < html.indexOf('js/engine/performance-input.js'));
  ok('… nach performance-zones.js (Protokolle)',
    html.indexOf('js/engine/performance-zones.js') < html.indexOf('js/engine/performance-input.js'));

  const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  ok('Modul ist im Cache-Manifest', /performance-input\.js/.test(sw));
}

console.log('\n' + '═'.repeat(62));
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
