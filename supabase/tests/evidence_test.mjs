/* ORVIA · Evidence Provenance (Bauplan Stufe 0b, Fassung 2.1)

   Geprüfte Zusagen:
     E1  Nur die vier Stufen sind zulässig; unbekannte Quelle → unknown, nie geraten
     E2  Evidenz und Alter sind GETRENNTE Achsen — Alterung senkt evidence nie
     E3  freshness folgt aus measuredAt + staleAfter, wird nie gesetzt
     E4  Migration measured/derived/estimated/none ist verlustfrei — in BEIDE Richtungen
     E5  Ein abgeleiteter Wert ist nie stärker als seine schwächste Eingabe
     E6  Ohne Beleg gibt es kein Prognoseband (null), keine Ersatzzahl
     E7  Die Anzeige hat EINE Quelle (marker/describe), nicht drei
     E8  performance-zones spricht ausschließlich die neue Skala
     E9  Purität

   node supabase/tests/evidence_test.mjs [appRoot-absolut] */
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

const TODAY = '2026-08-07';

/* ══════════════════════════════════════════════════════════════ */
sec('E1 · Vier Stufen, nichts dazwischen');
{
  ok('genau vier Stufen', E.LEVELS.length === 4 && E.LEVELS.join('<') === 'unknown<weak<moderate<strong');
  ok('Reihenfolge ist der Vertrag', E.rank('unknown') < E.rank('weak') && E.rank('weak') < E.rank('moderate') && E.rank('moderate') < E.rank('strong'));

  const race = E.make({ value: 2910, source: 'race_result', measuredAt: '2026-07-20', today: TODAY });
  ok('Wettkampf ⇒ strong', race.evidence === 'strong', race.evidence);
  const wk = E.make({ value: 1, source: 'workout_derived', measuredAt: '2026-07-20', today: TODAY });
  ok('harte Einheit ⇒ moderate', wk.evidence === 'moderate', wk.evidence);
  const sr = E.make({ value: 1, source: 'self_report', measuredAt: '2026-07-20', today: TODAY });
  ok('Selbstauskunft ⇒ weak', sr.evidence === 'weak', sr.evidence);

  const unknownSrc = E.make({ value: 1, source: 'irgendwas_neues', measuredAt: TODAY, today: TODAY });
  ok('unbekannte Quelle ⇒ unknown, NICHT geraten', unknownSrc.evidence === 'unknown', unknownSrc.evidence);
  ok('unbekannte Quelle bekommt die Standardgrenze', unknownSrc.staleAfter === E.STALE_AFTER.default);

  const noSrc = E.make({ value: 1 });
  ok('ohne Quelle ⇒ unknown', noSrc.evidence === 'unknown' && noSrc.source === 'default');

  /* Eine ausdrückliche Stufe darf überschreiben — aber ein Tippfehler nicht. */
  const forced = E.make({ value: 1, source: 'race_result', evidence: 'weak', measuredAt: TODAY, today: TODAY });
  ok('ausdrückliche gültige Stufe gewinnt', forced.evidence === 'weak', forced.evidence);
  const typo = E.make({ value: 1, source: 'race_result', evidence: 'sehr_stark', measuredAt: TODAY, today: TODAY });
  ok('Tippfehler fällt NICHT still auf strong zurück, sondern auf die Quelle',
    typo.evidence === 'strong' && E.isLevel('sehr_stark') === false, typo.evidence);
  ok('isLevel lehnt Fremdwörter ab',
    !E.isLevel('measured') && !E.isLevel('high') && !E.isLevel('78%'));
}

/* ══════════════════════════════════════════════════════════════ */
sec('E2 · Evidenz und Alter sind getrennte Achsen');
{
  /* Der Kernpunkt: Ein starker Beleg von vor einem Jahr bleibt ein STARKER
     Beleg — nur ein alter. Würde die Alterung evidence senken, wäre „mittel"
     mehrdeutig (frische Selbstauskunft ODER alter Wettkampf) und die richtige
     Reaktion — messen lassen vs. nachtesten — nicht mehr ableitbar. */
  const alt = E.make({ value: 2910, source: 'race_result', measuredAt: '2025-06-01', today: TODAY });
  ok('alter Wettkampf behält evidence strong', alt.evidence === 'strong', alt.evidence);
  ok('… ist aber als veraltet erkennbar', alt.freshness === 'stale', alt.freshness);
  ok('… mit Verhältniszahl statt Etikett', alt.ageRatio > 1, 'ageRatio ' + alt.ageRatio);

  const frischSchwach = E.make({ value: 1, source: 'self_report', measuredAt: TODAY, today: TODAY });
  ok('frische Selbstauskunft bleibt weak', frischSchwach.evidence === 'weak' && frischSchwach.freshness === 'fresh');
  ok('die beiden Fälle sind unterscheidbar',
    alt.evidence !== frischSchwach.evidence && alt.freshness !== frischSchwach.freshness);

  /* effective() darf ableiten, aber nichts überschreiben. */
  const eff = E.effective(alt);
  ok('effective senkt eine veraltete Stufe ab', eff.level === 'moderate', eff.level);
  ok('effective benennt den Grund', eff.derivedFrom === 'aged_out', eff.derivedFrom);
  ok('effective lässt die Rohachse unberührt', alt.evidence === 'strong');
  ok('effective fällt nie unter weak, solange ein Beleg existiert',
    E.effective(E.make({ value: 1, source: 'self_report', measuredAt: '2020-01-01', today: TODAY })).level === 'weak');
  ok('ohne Beleg bleibt effective unknown',
    E.effective({ evidence: 'unknown', freshness: 'fresh' }).level === 'unknown');
}

/* ══════════════════════════════════════════════════════════════ */
sec('E3 · freshness folgt aus Datum + Grenze');
{
  const lim = 100;
  ok('0 % der Grenze ⇒ fresh', E.freshnessOf('2026-08-07', TODAY, lim).freshness === 'fresh');
  ok('40 % der Grenze ⇒ fresh', E.freshnessOf('2026-06-28', TODAY, lim).freshness === 'fresh');
  ok('80 % der Grenze ⇒ current', E.freshnessOf('2026-05-19', TODAY, lim).freshness === 'current');
  ok('über der Grenze ⇒ stale', E.freshnessOf('2026-01-01', TODAY, lim).freshness === 'stale');

  ok('fehlendes Datum ⇒ unknown, NICHT fresh',
    E.freshnessOf(null, TODAY, lim).freshness === 'unknown');
  ok('unlesbares Datum ⇒ unknown', E.freshnessOf('kein datum', TODAY, lim).freshness === 'unknown');
  ok('Datum in der Zukunft wird nicht belohnt',
    E.freshnessOf('2027-01-01', TODAY, lim).ageDays === 0);

  /* Dieselbe Zahl, verschiedene Quellen — genau dafür existiert staleAfter. */
  const d = '2026-06-08';   // 60 Tage her
  const race = E.make({ value: 1, source: 'race_result', measuredAt: d, today: TODAY });
  const pain = E.make({ value: 1, source: 'user_checkin', measuredAt: d, today: TODAY });
  ok('60 Tage sind für einen Wettkampf frisch', race.freshness === 'fresh', race.freshness);
  ok('60 Tage sind für eine Schmerzangabe veraltet', pain.freshness === 'stale', pain.freshness);
  ok('gleiches Alter, verschiedene Bewertung — das ist der Zweck von staleAfter',
    race.ageDays === pain.ageDays && race.freshness !== pain.freshness, 'beide ' + race.ageDays + ' Tage');

  ok('genau vier Frische-Zustände', E.FRESHNESS.length === 4);
  ok('kein Modul kann freshness setzen',
    E.make({ value: 1, source: 'test', measuredAt: TODAY, today: TODAY, freshness: 'stale' }).freshness === 'fresh');
}

/* ══════════════════════════════════════════════════════════════ */
sec('E4 · Migration verlustfrei, in beide Richtungen');
{
  const pairs = [['measured', 'strong'], ['derived', 'moderate'], ['estimated', 'weak'], ['none', 'unknown']];
  pairs.forEach(([alt, neu]) => {
    ok(`${alt} → ${neu}`, E.fromLegacy(alt) === neu);
    ok(`${neu} → ${alt} (Rückweg)`, E.toLegacy(neu) === alt);
  });
  ok('Hin- und Rückweg ergibt das Original',
    pairs.every(([alt]) => E.toLegacy(E.fromLegacy(alt)) === alt));
  ok('Rück- und Hinweg ergibt das Original',
    E.LEVELS.every(l => E.fromLegacy(E.toLegacy(l)) === l));
  ok('unbekanntes altes Wort ⇒ unknown, nicht geraten', E.fromLegacy('hoch') === 'unknown');

  /* Brücke zur Messwertschicht — eine Übersetzung, keine zweite Sprache. */
  ok('measured_validated ⇒ strong', E.fromSourceContract('measured_validated') === 'strong');
  ok('device_sync ⇒ moderate', E.fromSourceContract('device_sync') === 'moderate');
  ok('derived_estimate ⇒ weak', E.fromSourceContract('derived_estimate') === 'weak');
  ok('unbekanntes Metrik-Wort ⇒ unknown', E.fromSourceContract('irgendwas') === 'unknown');
}

/* ══════════════════════════════════════════════════════════════ */
sec('E2b · „hat Beleg" ≠ „darf den Plan steuern"');
{
  /* effective() kann diese Frage nicht beantworten: Es setzt nur eine Stufe
     herab und hört bei 'weak' auf. Ohne eigene Achse bliebe ein beliebig alter
     Wert planungswirksam. */
  const frisch = E.make({ value: 1, source: 'race_result', measuredAt: '2026-07-20', today: TODAY });
  const einJahr = E.make({ value: 1, source: 'race_result', measuredAt: '2025-06-01', today: TODAY });
  const uralt = E.make({ value: 1, source: 'race_result', measuredAt: '2006-01-01', today: TODAY });

  ok('frischer Wettkampf darf steuern',
    E.usability(frisch).usability === 'decision_eligible', E.usability(frisch).usability);
  ok('ein Jahr alt: innerhalb der Toleranz, darf noch steuern',
    E.usability(einJahr).usability === 'decision_eligible', E.usability(einJahr).usability);
  ok('zwanzig Jahre alt: darf NICHT mehr steuern',
    E.usability(uralt).usability !== 'decision_eligible', E.usability(uralt).usability);
  ok('… bleibt aber ein starker Beleg (Rohachse unangetastet)', uralt.evidence === 'strong');
  ok('… und die Empfehlung lautet Nachtest, nicht „ignorieren"',
    E.usability(uralt).usability === 'retest_required', E.usability(uralt).usability);

  /* Bei einer schwachen Quelle wäre „teste nach" ein leerer Rat — dort gibt es
     nichts nachzutesten, was vorher belastbar war. */
  const altSchwach = E.make({ value: 1, source: 'self_report', measuredAt: '2006-01-01', today: TODAY });
  ok('alt und schwach ⇒ informational, nicht retest_required',
    E.usability(altSchwach).usability === 'informational', E.usability(altSchwach).usability);

  ok('ohne Datum: anzeigen ja, steuern nein (fail-closed)',
    E.usability(E.make({ value: 1, source: 'race_result' })).usability === 'informational');
  ok('ohne Beleg: informational', E.usability({ evidence: 'unknown', ageRatio: 0 }).usability === 'informational');
  ok('jede Antwort nennt einen Grund',
    [frisch, einJahr, uralt, altSchwach].every(h => typeof E.usability(h).reason === 'string'));

  /* Die Schwelle ist relativ, nicht absolut: dasselbe Alter, andere Quelle. */
  const d = '2026-05-01';   // 98 Tage
  ok('98 Tage: Wettkampf steuert weiter',
    E.usability(E.make({ value: 1, source: 'race_result', measuredAt: d, today: TODAY })).usability === 'decision_eligible');
  ok('98 Tage: Check-in steuert nicht mehr',
    E.usability(E.make({ value: 1, source: 'user_checkin', measuredAt: d, today: TODAY })).usability !== 'decision_eligible');
}

/* ══════════════════════════════════════════════════════════════ */
sec('E4b · Invarianten der Brücke zur Messwertschicht');
{
  /* Vier Zusagen, ohne die eine Brücke zwischen zwei Vokabularen still
     Evidenz erzeugen würde, die es nicht gibt. */
  ok('unbekannt bleibt unknown',
    ['irgendwas', '', null, undefined, 42, {}].every(x => E.fromSourceContract(x) === 'unknown'));

  ok('fehlende Herkunft erzeugt keine Evidenz',
    E.fromSourceContract(undefined) === 'unknown' && E.fromSourceContract(null) === 'unknown');

  /* Nie optimistischer: Die Qualitätsstufe 'measured' kann aus
     measured_validated (strong) ODER device_sync (moderate) stammen. Die Brücke
     muss deshalb die NIEDRIGERE der möglichen Herkünfte annehmen — sonst würde
     ein Gerätewert über den Umweg der Qualitätsstufe zu 'strong'. */
  ok('Qualitätsstufe „measured" übersetzt auf moderate, nicht auf strong',
    E.fromSourceContract('measured') === 'moderate', E.fromSourceContract('measured'));
  ok('… also nie höher als die schwächste zugehörige Quelle',
    E.rank(E.fromSourceContract('measured')) <= E.rank(E.fromSourceContract('measured_validated')) &&
    E.rank(E.fromSourceContract('measured')) <= E.rank(E.fromSourceContract('device_sync')));
  ok('geschätzte Herkunft übersetzt nie über weak',
    E.rank(E.fromSourceContract('derived_estimate')) <= E.rank('weak') &&
    E.rank(E.fromSourceContract('estimated')) <= E.rank('weak'));
  ok('manuelle Profilangabe übersetzt nie über weak',
    E.rank(E.fromSourceContract('profile_manual')) <= E.rank('weak'));

  ok('deterministisch: derselbe Eingang, dieselbe Übersetzung',
    ['measured_validated', 'device_sync', 'profile_manual', 'derived_estimate', 'unbekannt']
      .every(x => E.fromSourceContract(x) === E.fromSourceContract(x) &&
        E.fromSourceContract(x) === E.fromSourceContract(String(x))));
  ok('jede Übersetzung ist eine gültige Stufe',
    ['measured_validated', 'device_sync', 'profile_manual', 'derived_estimate', 'measured', 'reported', 'estimated', 'xx']
      .every(x => E.isLevel(E.fromSourceContract(x))));
}

/* ══════════════════════════════════════════════════════════════ */
sec('E5 · Schwächste Eingabe bestimmt das Ergebnis');
{
  ok('strong + weak ⇒ weak', E.weakest(['strong', 'weak']) === 'weak');
  ok('strong + moderate ⇒ moderate', E.weakest(['strong', 'moderate']) === 'moderate');
  ok('alles strong ⇒ strong', E.weakest(['strong', 'strong']) === 'strong');
  ok('ein unknown zieht alles auf unknown', E.weakest(['strong', 'moderate', 'unknown']) === 'unknown');
  ok('leere Liste ⇒ unknown, nicht strong', E.weakest([]) === 'unknown');
  ok('Fremdwort in der Liste zählt als unknown', E.weakest(['strong', 'gemessen']) === 'unknown');
}

/* ══════════════════════════════════════════════════════════════ */
sec('E6 · Kein Band ohne Beleg');
{
  ok('unknown ⇒ kein Band (null), keine Ersatzzahl',
    E.bandFor({ evidence: 'unknown', ageRatio: 0 }) === null);
  const s0 = E.bandFor({ evidence: 'strong', ageRatio: 0.2 });
  const m0 = E.bandFor({ evidence: 'moderate', ageRatio: 0.2 });
  const w0 = E.bandFor({ evidence: 'weak', ageRatio: 0.2 });
  ok('schwächerer Beleg ⇒ breiteres Band', s0 < m0 && m0 < w0, `${s0} < ${m0} < ${w0}`);
  ok('innerhalb der Grenze keine Verbreiterung',
    E.bandFor({ evidence: 'strong', ageRatio: 1 }) === E.bandFor({ evidence: 'strong', ageRatio: 0 }));
  const alt1 = E.bandFor({ evidence: 'strong', ageRatio: 1.5 });
  const alt2 = E.bandFor({ evidence: 'strong', ageRatio: 3 });
  ok('stetige Verbreiterung mit dem Alter', alt1 > s0 && alt2 > alt1, `${s0} < ${alt1} < ${alt2}`);
  ok('Verbreiterung ist gedeckelt', E.bandFor({ evidence: 'strong', ageRatio: 50 }) <= 0.09);
  ok('fehlendes Datum verbreitert ebenfalls',
    E.bandFor({ evidence: 'strong', ageRatio: null }) > s0);
}

/* ══════════════════════════════════════════════════════════════ */
sec('E7 · Eine Quelle für die Anzeige');
{
  ok('strong ⇒ kein Marker', E.marker('strong') === '');
  ok('moderate ⇒ ≈', E.marker('moderate') === '≈');
  ok('weak ⇒ ~', E.marker('weak') === '~');
  ok('unknown ⇒ —', E.marker('unknown') === '—');
  ok('Fremdwort ⇒ Marker für unknown', E.marker('measured') === '—');

  const h = E.make({ value: 292, source: 'race_result', method: '10k_race', measuredAt: '2026-07-20', today: TODAY });
  const line = E.describe(h);
  ok('Anzeigezeile nennt Beleg, Quelle, Alter, Status',
    /Beleg: stark/.test(line) && /Quelle: Wettkampf/.test(line) && /Alter: 18 Tage/.test(line) && /Status: frisch/.test(line), line);
  ok('keine Prozentzahl in der Anzeige', !/%/.test(line), line);
  ok('Einzahl bei einem Tag',
    /Alter: 1 Tag(?!e)/.test(E.describe(E.make({ value: 1, source: 'test', measuredAt: '2026-08-06', today: TODAY }))));
  ok('ohne Datum kein erfundenes Alter',
    !/Alter:/.test(E.describe(E.make({ value: 1, source: 'test' }))));
}

/* ══════════════════════════════════════════════════════════════ */
sec('E8 · performance-zones spricht nur noch die neue Skala');
{
  const race = { races: [{ distanceKm: 10, durationMin: 48.5, date: '2026-07-20', kind: 'race' }], today: TODAY };
  const r = PZ.resolve(race);
  ok('Wettkampf ⇒ strong (vorher measured)', r.confidence === 'strong', r.confidence);
  ok('freshness statt staleness', r.freshness === 'fresh' && r.staleness === undefined, r.freshness + ' / ' + r.staleness);
  ok('ageRatio wird mitgeführt', typeof r.ageRatio === 'number', String(r.ageRatio));
  ok('staleAfter wird mitgeführt', r.staleAfter === E.STALE_AFTER.race_result, String(r.staleAfter));

  const w = PZ.resolve({ workouts: [{ distanceKm: 10, durationMin: 50, date: '2026-07-20', type: 'tempo' }], today: TODAY });
  ok('harter Trainingslauf ⇒ moderate', w.confidence === 'moderate', w.confidence);
  const g = PZ.resolve({ goalTarget: { distanceKm: 21.0975, targetMin: 110 }, today: TODAY });
  ok('nur Zielzeit ⇒ weak', g.confidence === 'weak', g.confidence);
  const n = PZ.resolve({ today: TODAY });
  ok('keine Referenz ⇒ unknown und ok=false', n.ok === false && n.confidence === 'unknown', n.confidence);

  /* Die Stufen der Zonen müssen aus der Menge des Vertrags stammen — sonst
     hätte das Modul eine eigene fünfte Stufe und der Vertrag wäre umgangen. */
  ok('jede von den Zonen gelieferte Stufe steht im Vertrag',
    [r, w, g, n].every(x => E.isLevel(x.confidence)),
    [r, w, g, n].map(x => x.confidence).join(','));

  const f = PZ.forecast(r, 21.0975);
  ok('Prognose liefert ein Band', f.ok === true && f.bandPct > 0, String(f.bandPct));
  ok('Prognose führt freshness statt staleness', f.freshness === 'fresh' && f.staleness === undefined);

  /* Ein alter Wettkampf: Beleg bleibt strong, Band wird breiter. */
  const old = PZ.resolve({ races: [{ distanceKm: 10, durationMin: 48.5, date: '2025-01-01', kind: 'race' }], today: TODAY });
  ok('alter Wettkampf behält strong', old.confidence === 'strong', old.confidence);
  ok('… ist als veraltet markiert', old.freshness === 'stale', old.freshness);
  const fOld = PZ.forecast(old, 21.0975);
  ok('… und erzeugt ein breiteres Prognoseband', fOld.bandPct > f.bandPct, `${f.bandPct} → ${fOld.bandPct}`);

  /* Quelltext: das alte Vokabular ist ENTFERNT, nicht ergänzt. */
  const src = readFileSync(join(APP, 'js/engine/performance-zones.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  ok('kein measured/derived/estimated mehr im Code',
    !/'measured'|'derived'|'estimated'/.test(src));
  ok('kein staleness-Feld mehr im Code', !/staleness/.test(src));
  ok('kein very_stale mehr im Code', !/very_stale/.test(src));

  const rsrc = readFileSync(join(APP, 'js/engine/performance-resolver.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  ok('auch der Resolver ist migriert', !/staleness/.test(rsrc));
}

/* ══════════════════════════════════════════════════════════════ */
sec('E9 · Purität');
{
  const src = readFileSync(join(APP, 'js/engine/evidence.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  ok('kein DOM-Zugriff', !/\bdocument\.|\bwindow\.(?!ORVIA)/.test(src));
  ok('keine Systemuhr', !/Date\.now\(|new Date\(\)/.test(src));
  ok('kein Zufall', !/Math\.random/.test(src));
  ok('kein Storage', !/localStorage|sessionStorage|indexedDB/.test(src));
  ok('kein Netz', !/fetch\(|XMLHttpRequest/.test(src));
  ok('keine Prozentskala im Vertrag', !/confidencePct|percent|0\.\.100/.test(src));

  /* Determinismus: gleiche Eingabe, gleiche Ausgabe. */
  const a = JSON.stringify(E.make({ value: 1, source: 'test', measuredAt: '2026-01-01', today: TODAY }));
  const b = JSON.stringify(E.make({ value: 1, source: 'test', measuredAt: '2026-01-01', today: TODAY }));
  ok('deterministisch', a === b);
}

console.log('\n' + '═'.repeat(62));
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
