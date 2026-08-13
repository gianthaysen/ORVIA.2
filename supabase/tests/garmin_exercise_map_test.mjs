/* ORVIA · v8-324 — K3: versionierte Garmin-Übungszuordnung

   AUFTRAG (Gians O2-Festlegung und K3-Regeln):
     · Jede Kombination muss im versionierten Garmin-Katalog NACHGEWIESEN werden.
     · Keine Zuordnung allein anhand von Namensähnlichkeit.
     · Bei mehreren Garmin-Varianten die genaue Variante ausdrücklich festlegen.
     · row / pullup / romanian_deadlift / hip_thrust: `ambiguous` oder
       `unmapped` statt einer Näherung, falls keine eindeutige Entsprechung.
     · K4 exportiert ausschliesslich `mapped`.
     · Die Tests geben Abdeckung und offene Lücken NAMENTLICH aus.

   NACHWEISGRUNDLAGE ist die versionierte Katalogdatei
   supabase/tests/fixtures/garmin-fit-catalog-21.213.0.json — erzeugt aus dem
   OFFIZIELLEN Garmin FIT SDK Profile (PyPI `garmin-fit-sdk` 21.213.0). Der
   Katalog wird NICHT zur Laufzeit geladen. Die Prüfung ist damit nicht
   zirkulär: der Katalog enthält alle 1846 Namen, nicht nur die zehn
   zugeordneten.

   OFFEN [OFFEN-1]: Die vom Plan vorgesehene ZWEITE Quelle (Übungspicker von
   Garmin Connect) war nicht erreichbar — connect.garmin.com ist per
   robots.txt gesperrt, und die von mir früher genannte Datei
   `garminconnect/exercises.py` existiert in KEINER geprüften Paketfassung
   (0.2.20 / 0.2.25 / 0.2.28 / 0.3.2). Diese frühere Angabe war falsch. Es ist
   also genau EINE Quelle nachgewiesen — die offizielle. Ob Connect beim
   Anlegen eines Workouts dieselben Paare akzeptiert, ist Gate G1 und wird
   hier NICHT behauptet. Dieser Test macht die Lücke sichtbar (G9).

     G1 Der Katalog ist echt, vollständig und trägt seine Herkunft
     G2 JEDE Kombination ist im Katalog nachgewiesen — Kategorie UND Name
     G3 Keine Zuordnung nach Namensähnlichkeit (inkl. der Sandsack-Falle)
     G4 Mehrfachvarianten sind ausdrücklich festgelegt und begründet
     G5 Die Rückrichtung verlangt die EXAKTE Kombination
     G6 K4-Regel: nur `mapped` verlässt den Exporter
     G7 Abdeckung und Lücken werden NAMENTLICH ausgegeben
     G8 Alle zugeordneten Slugs existieren in den ECHTEN ORVIA-Seeds
     G9 Reinheit, Vertragstreue, im Produkt geladen, offene Punkte sichtbar

   node supabase/tests/garmin_exercise_map_test.mjs [appRoot] */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);
const MIG = join(HERE, '..', 'migrations');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const CAT = JSON.parse(readFileSync(join(HERE, 'fixtures', 'garmin-fit-catalog-21.213.0.json'), 'utf8'));
const htmlRaw = readFileSync(join(APP, 'index.html'), 'utf8');
const swRaw = readFileSync(join(APP, 'sw.js'), 'utf8');
const mapRaw = readFileSync(join(APP, 'js/engine/garmin-exercise-map.js'), 'utf8');

globalThis.window = globalThis;
globalThis.ORVIA = globalThis.ORVIA || {};
await import(pathToFileURL(join(APP, 'js/engine/garmin-exercise-map.js')).href);
const GM = globalThis.ORVIA.garminExerciseMap;

/* ══ G1 · Der Katalog ══ */
sec('G1 · Der versionierte Katalog');
ok('die Katalogdatei ist vorhanden', !!CAT && !!CAT.categories);
ok('sie nennt ihre Herkunft (offizielles FIT SDK)', /FIT SDK/i.test(CAT.source || ''), CAT.source);
ok('sie nennt ihre Fassung', CAT.sdkVersion === '21.213.0', CAT.sdkVersion);
const catNames = Object.keys(CAT.categories);
const totalNames = catNames.reduce((a, c) => a + Object.keys(CAT.categories[c].names).length, 0);
ok('51 Kategorien mit Code', catNames.length === 51, String(catNames.length));
ok('1846 Übungsnamen — der Katalog ist VOLLSTÄNDIG, nicht auf die Zuordnung zugeschnitten',
  totalNames === 1846, String(totalNames));
ok('… damit ist der Nachweis nicht zirkulär (weit mehr Namen als Zuordnungen)',
  totalNames > GM.MVP_CORE.length * 100);
ok('jede Kategorie trägt ihren numerischen Code', catNames.every(c => Number.isInteger(CAT.categories[c].code)));
ok('das Modul verweist auf genau diese Fassung',
  GM.CATALOG.sdkVersion === CAT.sdkVersion && /21\.213\.0/.test(GM.CATALOG.fixture), JSON.stringify(GM.CATALOG.sdkVersion));
ok('der Katalog wird NICHT zur Laufzeit geladen (kein Netzzugriff im Modul)',
  !/fetch\(|XMLHttpRequest|import\(/.test(mapRaw));

/* ══ G2 · Jede Kombination nachgewiesen ══ */
sec('G2 · Jede Kombination im Katalog nachgewiesen');
const mapped = Object.keys(GM.entries).filter(s => GM.entries[s].status === 'mapped');
ok('es gibt überhaupt zugeordnete Einträge', mapped.length > 0, String(mapped.length));
for (const slug of mapped) {
  const e = GM.entries[slug];
  const cat = CAT.categories[e.category];
  const nameFromCode = cat ? cat.names[String(e.nameCode)] : undefined;
  ok('  ' + slug + ' → ' + e.category + '/' + e.name,
    !!cat && cat.code === e.categoryCode && nameFromCode === e.name,
    !cat ? 'Kategorie fehlt im Katalog'
      : cat.code !== e.categoryCode ? ('categoryCode ' + e.categoryCode + ' ≠ ' + cat.code)
        : nameFromCode !== e.name ? ('nameCode ' + e.nameCode + ' zeigt auf "' + nameFromCode + '"') : '');
}
ok('KEINE Zuordnung ohne numerische Codes (ein Name allein ist kein Nachweis)',
  mapped.every(s => Number.isInteger(GM.entries[s].categoryCode) && Number.isInteger(GM.entries[s].nameCode)));

/* ══ G3 · Keine Namensähnlichkeit ══ */
sec('G3 · Keine Zuordnung nach Namensähnlichkeit');
/* Der konkrete Fallstrick: „overhead_press" existiert im Katalog EXAKT — aber
   nur unter `sandbag`. Ein reiner Namensabgleich hätte Schulterdrücken auf
   eine Sandsack-Übung gelegt. */
const sandbagHasOhp = !!(CAT.categories.sandbag) &&
  Object.values(CAT.categories.sandbag.names).indexOf('overhead_press') >= 0;
ok('die Falle existiert wirklich: „overhead_press" steht im Katalog unter `sandbag`', sandbagHasOhp);
ok('… und das Mapping ist ihr NICHT aufgesessen',
  GM.entries.overhead_press.category === 'shoulder_press', GM.entries.overhead_press.category);
ok('… der Fund ist im Modul dokumentiert, nicht stillschweigend umschifft',
  /sandbag/i.test(GM.entries.overhead_press.note || ''));
/* Kein Eintrag darf sich auf einen Namen stützen, der in seiner Kategorie
   nicht existiert — das wäre die reine Ähnlichkeitszuordnung. */
ok('kein zugeordneter Name ist in seiner Kategorie erfunden',
  mapped.every(s => !!CAT.categories[GM.entries[s].category] &&
    Object.values(CAT.categories[GM.entries[s].category].names).indexOf(GM.entries[s].name) >= 0));
/* Und keine Zuordnung darf sich allein aus dem ORVIA-Slug ableiten lassen: bei
   drei Einträgen weicht der Garmin-Name bewusst ab. */
const differing = mapped.filter(s => GM.entries[s].name !== s);
ok('bei mehreren Einträgen weicht der Garmin-Name bewusst vom Slug ab (kein 1:1-Automatismus)',
  differing.length >= 3, differing.join(', '));
ok('… und jede solche Abweichung ist begründet',
  differing.every(s => (GM.entries[s].note || '').length > 40),
  differing.filter(s => (GM.entries[s].note || '').length <= 40).join(', '));

/* ══ G4 · Varianten ausdrücklich festgelegt ══ */
sec('G4 · Mehrfachvarianten ausdrücklich festgelegt');
const variants = mapped.filter(s => GM.entries[s].variantChoice === true);
ok('Varianten-Entscheidungen sind als solche gekennzeichnet', variants.length > 0, variants.join(', '));
for (const s of variants) {
  const e = GM.entries[s];
  /* Defensiv lesen: eine unvollständige Katalogdatei soll LESBARE rote Zeilen
     erzeugen, keinen Absturz (Mutationsprobe V12 stürzte sonst ab). */
  const cat = CAT.categories[e.category];
  const neutral = !!cat && Object.values(cat.names).indexOf(s) >= 0;
  ok('  ' + s + ': eine Variante war NÖTIG (kein neutraler Eintrag „' + s + '" in ' + e.category + ')',
    !!cat && !neutral,
    !cat ? 'Kategorie fehlt im Katalog' : neutral ? 'es gäbe einen neutralen Eintrag — dann wäre variantChoice falsch' : '');
  ok('  ' + s + ': die Entscheidung ist begründet', (e.note || '').length > 40);
}
/* Umgekehrt: wo KEINE Variante gewählt wurde, muss der Garmin-Name derselbe
   Begriff sein — sonst wäre es eine unmarkierte Variantenwahl. Erlaubt ist
   AUSSCHLIESSLICH eine Schreibweisen-Differenz im Unterstrich
   (ORVIA `pullup` ⇄ Garmin `pull_up`); die Buchstabenfolge muss identisch
   bleiben. Das ist eine Normalisierung, KEIN Ähnlichkeitsvergleich: weder
   `barbell_bench_press` noch `barbell_row` kommen dadurch durch. */
const bare = x => String(x).replace(/_/g, '');
const noVariant = mapped.filter(s => !GM.entries[s].variantChoice);
ok('ohne variantChoice ist der Garmin-Name derselbe Begriff (nur Unterstrich-Schreibweise darf abweichen)',
  noVariant.every(s => bare(GM.entries[s].name) === bare(s)),
  noVariant.filter(s => bare(GM.entries[s].name) !== bare(s)).join(', '));
ok('… und diese Normalisierung ist eng genug, um echte Varianten NICHT durchzulassen',
  bare('barbell_bench_press') !== bare('bench_press') && bare('barbell_row') !== bare('row') &&
  bare('barbell_hip_thrust_with_bench') !== bare('hip_thrust'));
ok('genau ein Eintrag nutzt die Schreibweisen-Ausnahme, und sie ist dokumentiert',
  noVariant.filter(s => GM.entries[s].name !== s).length === 1 &&
  /Schreibweise/i.test(GM.entries.pullup.note || ''),
  noVariant.filter(s => GM.entries[s].name !== s).join(', '));

/* ══ G5 · Rückrichtung ══ */
sec('G5 · Die Rückrichtung verlangt die exakte Kombination');
for (const s of mapped) {
  const e = GM.entries[s];
  const back = GM.fromGarmin(e.category, e.name);
  ok('  ' + e.category + '/' + e.name + ' → ' + s, back.ok === true && back.slug === s, JSON.stringify(back));
}
ok('zwei Slugs zeigen nie auf dieselbe Kombination (sonst wäre der Rückweg mehrdeutig)',
  new Set(mapped.map(s => GM.entries[s].category + '/' + GM.entries[s].name)).size === mapped.length);
ok('die Kategorie ALLEIN genügt nicht — sonst würde jedes Rudern zu „Rudern"',
  GM.fromGarmin('row', 'barbell_row').ok === false, JSON.stringify(GM.fromGarmin('row', 'barbell_row')));
ok('… und der Grund wird benannt', GM.fromGarmin('row', 'barbell_row').reason === 'unmapped_combination');
ok('der Name ALLEIN genügt ebenfalls nicht (Kategorie zählt mit)',
  GM.fromGarmin('sandbag', 'row').ok === false);
ok('eine unvollständige Eingabe wird abgewiesen, nicht geraten',
  GM.fromGarmin('row', null).ok === false && GM.fromGarmin(null, 'row').ok === false);

/* ══ G6 · K4-Regel ══ */
sec('G6 · Nur `mapped` verlässt den Exporter');
ok('eine zugeordnete Übung liefert Kategorie, Name und BEIDE Codes', (() => {
  const r = GM.toGarmin('bench_press');
  return r.ok && r.category === 'bench_press' && r.name === 'barbell_bench_press' &&
    r.categoryCode === 0 && r.nameCode === 1 && r.mappingVersion === GM.VERSION;
})(), JSON.stringify(GM.toGarmin('bench_press')));
ok('ein unbekannter Slug liefert KEINE Zuordnung, sondern einen Grund',
  GM.toGarmin('gibt_es_nicht').ok === false && GM.toGarmin('gibt_es_nicht').reason === 'unknown_slug');
ok('… und keine ähnlich klingende Ersatzübung',
  !('category' in GM.toGarmin('bench_press_dumbbell')), JSON.stringify(GM.toGarmin('bench_press_dumbbell')));
ok('leere/unsinnige Eingaben werden abgewiesen',
  GM.toGarmin(null).ok === false && GM.toGarmin('').ok === false && GM.toGarmin(42).ok === false);
ok('der Exportvertrag steht im Modul (nur `mapped` liefert ok)',
  /if \(e\.status !== 'mapped'\) return \{ ok: false/.test(mapRaw));

/* ══ G7 · Abdeckung und Lücken NAMENTLICH ══ */
sec('G7 · Abdeckung und offene Lücken');
const cov = GM.coverage();
console.log('\n   ┌─ MVP-Kernset (O2) ' + '─'.repeat(40));
console.log('   │ zugeordnet : ' + cov.mapped + ' / ' + cov.total + '  (' + Math.round(cov.ratio * 100) + ' %)');
console.log('   │ mehrdeutig : ' + cov.ambiguous + '   nicht zugeordnet: ' + cov.unmapped + '   unbekannt: ' + cov.unknown);
console.log('   ├─ zugeordnet ' + '─'.repeat(46));
for (const s of cov.mappedSlugs) {
  const e = GM.entries[s];
  console.log('   │   ' + s.padEnd(20) + ' → ' + (e.category + '/' + e.name).padEnd(46) + ' #' + e.categoryCode + '/' + e.nameCode);
}
if (cov.gaps.length) {
  console.log('   ├─ OFFENE LÜCKEN ' + '─'.repeat(42));
  for (const g of cov.gaps) console.log('   │   ' + g.slug.padEnd(20) + ' [' + g.status + '] ' + (g.why || '').slice(0, 90));
} else {
  console.log('   ├─ OFFENE LÜCKEN: keine ' + '─'.repeat(35));
}
console.log('   ├─ ausdrückliche Variantenwahl ' + '─'.repeat(29));
for (const v of cov.variantChoices) console.log('   │   ' + v.slug.padEnd(20) + ' → ' + v.name);
console.log('   ├─ [A] hohes Risiko beim RÜCKweg (Gate G2 klärt es) ' + '─'.repeat(8));
for (const r of cov.highReturnRisk) console.log('   │   ' + r.slug);
console.log('   └' + '─'.repeat(58) + '\n');

ok('das MVP-Kernset umfasst genau die zehn von Gian festgelegten Slugs', cov.total === 10, String(cov.total));
ok('die Abdeckung wird als Zahl UND mit Namen ausgegeben',
  Array.isArray(cov.mappedSlugs) && Array.isArray(cov.gaps) && typeof cov.ratio === 'number');
ok('jede Lücke trägt einen Grund im Klartext (eine Prozentzahl allein verbirgt genau das)',
  cov.gaps.every(g => typeof g.why === 'string'));
ok('das Kernset ist vollständig zugeordnet — Plan-DoD K3',
  cov.mapped === cov.total && cov.gaps.length === 0,
  cov.gaps.map(g => g.slug + '[' + g.status + ']').join(', '));
ok('ein unbekannter Slug taucht in der Abdeckung NAMENTLICH als Lücke auf', (() => {
  const c = GM.coverage(['bench_press', 'kennt_niemand']);
  return c.unknown === 1 && c.gaps.length === 1 && c.gaps[0].slug === 'kennt_niemand';
})(), JSON.stringify(GM.coverage(['bench_press', 'kennt_niemand']).gaps));
ok('die drei Varianten-Entscheidungen werden gesondert ausgewiesen',
  cov.variantChoices.length === 3 && cov.variantChoices.every(v => v.why && v.why.length > 40),
  cov.variantChoices.map(v => v.slug).join(', '));
ok('die Einträge mit hohem Rückweg-Risiko werden benannt (row, squat)',
  cov.highReturnRisk.map(r => r.slug).sort().join(',') === 'row,squat',
  cov.highReturnRisk.map(r => r.slug).join(','));

/* Der `ambiguous`/`unmapped`-Pfad ist heute UNBENUTZT, weil alle zehn Einträge
   zugeordnet sind. Genau deshalb blieb eine Mutation grün, die das Melden
   solcher Lücken entfernte (Probe V7): der Zweig lief in keinem Testfall.
   Gian hat diese Zustände ausdrücklich gefordert — also müssen sie geprüft
   sein, BEVOR sie zum ersten Mal gebraucht werden. Ein Eintrag wird dafür
   vorübergehend eingehängt und danach wieder entfernt. */
{
  const before = JSON.stringify(GM.entries);
  GM.entries.__probe_ambiguous = { de: 'Prüffall', status: 'ambiguous', note: 'zwei gleichwertige Garmin-Fassungen' };
  GM.entries.__probe_unmapped = { de: 'Prüffall', status: 'unmapped', note: 'kein Eintrag im Katalog' };
  const c = GM.coverage(['bench_press', '__probe_ambiguous', '__probe_unmapped']);
  ok('ein `ambiguous` Eintrag wird gezählt UND namentlich als Lücke gemeldet',
    c.ambiguous === 1 && c.gaps.some(g => g.slug === '__probe_ambiguous' && g.status === 'ambiguous'),
    JSON.stringify(c.gaps));
  ok('… mit dem Grund im Klartext',
    (c.gaps.find(g => g.slug === '__probe_ambiguous') || {}).why === 'zwei gleichwertige Garmin-Fassungen');
  ok('ein `unmapped` Eintrag ebenso',
    c.unmapped === 1 && c.gaps.some(g => g.slug === '__probe_unmapped' && g.status === 'unmapped'));
  ok('… und beide zählen NICHT als zugeordnet', c.mapped === 1 && c.mappedSlugs.join(',') === 'bench_press');
  ok('… und der Exporter gibt sie nicht heraus',
    GM.toGarmin('__probe_ambiguous').ok === false && GM.toGarmin('__probe_ambiguous').status === 'ambiguous' &&
    GM.toGarmin('__probe_unmapped').ok === false,
    JSON.stringify(GM.toGarmin('__probe_ambiguous')));
  ok('… und der Rückweg findet sie nicht (kein Status ausser mapped zaehlt)',
    GM.fromGarmin('row', 'row').slug === 'row');
  delete GM.entries.__probe_ambiguous; delete GM.entries.__probe_unmapped;
  ok('die Prüfeinträge sind restlos entfernt (der folgende Reinheitstest ist damit gültig)',
    JSON.stringify(GM.entries) === before);
}

/* ══ G8 · Die Slugs sind echte ORVIA-Übungen ══ */
sec('G8 · Alle Slugs existieren in den ECHTEN ORVIA-Seeds');
const seedFiles = readdirSync(MIG).filter(f => /^000[36]_/.test(f));
const seedSql = seedFiles.map(f => readFileSync(join(MIG, f), 'utf8')).join('\n');
const seeded = new Set([...seedSql.matchAll(/\('([a-z0-9_]+)',\s*true\s*,\s*'([^']+)'/g)].map(m => m[1]));
ok('die Seed-Migrationen wurden gefunden', seedFiles.length === 2, seedFiles.join(', '));
ok('sie enthalten die 79 Systemübungen', seeded.size === 79, String(seeded.size));
for (const s of GM.MVP_CORE) ok('  ' + s + ' ist eine echte ORVIA-Systemübung', seeded.has(s));
ok('KEIN Eintrag der Tabelle bezieht sich auf einen erfundenen Slug',
  Object.keys(GM.entries).every(s => seeded.has(s)),
  Object.keys(GM.entries).filter(s => !seeded.has(s)).join(', '));

/* ══ G9 · Reinheit, Vertrag, offene Punkte ══ */
sec('G9 · Reinheit, Vertrag und offene Punkte');
const snap = JSON.stringify(GM.entries);
GM.toGarmin('bench_press'); GM.fromGarmin('row', 'row'); GM.coverage();
ok('die Tabelle wird durch Benutzung nicht verändert', JSON.stringify(GM.entries) === snap);
ok('gleiche Eingabe ⇒ identische Ausgabe', JSON.stringify(GM.toGarmin('squat')) === JSON.stringify(GM.toGarmin('squat')));
ok('das Modul ist versioniert', /^garmin-exercise-map@\d+$/.test(GM.VERSION), GM.VERSION);
ok('jeder Status stammt aus der erlaubten Liste',
  Object.keys(GM.entries).every(s => GM.STATUS.indexOf(GM.entries[s].status) >= 0));
ok('das Modul ist in index.html geladen',
  /<script src="js\/engine\/garmin-exercise-map\.js"><\/script>/.test(htmlRaw));
ok('… und im Offline-Vorrat des Service Workers', swRaw.includes("'./js/engine/garmin-exercise-map.js'"));
/* Die fehlende Zweitquelle darf NICHT stillschweigend verschwinden. */
ok('die fehlende Zweitquelle ist im Modul ausdrücklich vermerkt',
  GM.CATALOG.secondSource === null && /OFFEN-1/.test(mapRaw));
ok('… und die frühere Falschangabe (garminconnect/exercises.py) ist benannt',
  /exercises\.py.*existiert in KEINER|KEINER der geprüften Paketfassungen/s.test(mapRaw));
ok('das [A] beim Rückweg-Risiko ist als Annahme gekennzeichnet, nicht als Messung',
  /\[A\]/.test(mapRaw) && /Gate|G2/.test(mapRaw));

/* ── Mehrdeutiger Rückweg (Lücke aus dem Probenlauf v8-330) ──────────────
   Muster data_lacks_var: Mit den heutigen 10 eindeutigen Einträgen kann
   `ambiguous_reverse` durch reale Daten NIE ausgelöst werden — die Mutation
   „nimm einfach den ersten Treffer" blieb deshalb grün. Sobald das Mapping
   mit dem Gym-Pack wächst, zeigen zwangsläufig mehrere ORVIA-Slugs auf
   dieselbe Garmin-Kombination. Geprüft wird gegen die Prüföffnung von
   fromGarmin, nicht gegen einen Mock des Moduls. */
{
  const zwei = {
    kniebeuge_a: { status: 'mapped', category: 'SQUAT', name: 'BARBELL_BACK_SQUAT' },
    kniebeuge_b: { status: 'mapped', category: 'SQUAT', name: 'BARBELL_BACK_SQUAT' },
    einzeln: { status: 'mapped', category: 'BENCH_PRESS', name: 'BARBELL_BENCH_PRESS' },
    nicht_zugeordnet: { status: 'unmapped', category: 'SQUAT', name: 'BARBELL_BACK_SQUAT' }
  };
  const amb = GM.fromGarmin('SQUAT', 'BARBELL_BACK_SQUAT', zwei);
  ok('mehrdeutiger Rückweg meldet ambiguous_reverse statt still den ersten Treffer zu nehmen',
    amb.ok === false && amb.reason === 'ambiguous_reverse', JSON.stringify(amb));
  ok('… und benennt ALLE Kandidaten (sonst könnte niemand entscheiden)',
    Array.isArray(amb.candidates) && amb.candidates.slice().sort().join(',') === 'kniebeuge_a,kniebeuge_b');
  ok('… nicht zugeordnete Einträge zählen dabei nicht als Kandidat',
    amb.candidates.indexOf('nicht_zugeordnet') < 0);
  ok('eindeutiger Treffer bleibt eindeutig, auch in derselben Tabelle',
    GM.fromGarmin('BENCH_PRESS', 'BARBELL_BENCH_PRESS', zwei).slug === 'einzeln');
  ok('die Prüföffnung ist fail-closed: untauglicher Wert fällt NICHT still auf die echte Tabelle zurück',
    [null, [], 'text', 42].every(v => {
      const r = GM.fromGarmin('BENCH_PRESS', 'BARBELL_BENCH_PRESS', v);
      return r.ok === false && r.reason === 'invalid_entries';
    }));
  ok('… und ohne dritten Parameter arbeitet der Rückweg unverändert gegen den echten Katalog',
    GM.fromGarmin('row', 'row').slug === 'row' &&
    GM.fromGarmin('row', 'row', undefined).slug === 'row');
}

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
