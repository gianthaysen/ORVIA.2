/* ============================================================
   ORVIA · garmin-exercise-map — versionierte Übungszuordnung (Kraftplan v2, K3)

   ZWECK
   Übersetzt eine ORVIA-Übung (stabiler `slug` aus `public.exercises`) in ein
   Garmin-Paar aus Kategorie und Übungsname — und zurück. Der Exporter (K4)
   darf AUSSCHLIESSLICH Einträge mit Status `mapped` verwenden.

   QUELLE UND FASSUNG (Provenienz, nicht Behauptung)
   Nachgewiesen gegen den OFFIZIELLEN Garmin FIT SDK Profile-Katalog,
   Fassung 21.213.0 (PyPI-Paket `garmin-fit-sdk`): 51 Kategorien mit Code,
   1846 Übungsnamen. Der vollständige Katalog liegt als versionierte Datei
   unter supabase/tests/fixtures/garmin-fit-catalog-21.213.0.json und wird
   NICHT zur Laufzeit geladen; er dient dem Vertragstest als Nachweisgrundlage.

   OFFENE ZWEITQUELLE [OFFEN-1]
   Der Plan sieht den Übungspicker von Garmin Connect als zweite, „praktisch
   massgebliche" Quelle vor. Er war in dieser Umgebung nicht erreichbar
   (connect.garmin.com ist per robots.txt gesperrt), und die früher von mir
   genannte Datei `garminconnect/exercises.py` existiert in KEINER der
   geprüften Paketfassungen (0.2.20, 0.2.25, 0.2.28, 0.3.2) — diese frühere
   Angabe war falsch. Damit ist genau EINE Quelle nachgewiesen, und zwar die
   offizielle. Ob Connect beim Anlegen eines Workouts dieselben Paare
   akzeptiert, bleibt die Gate-Frage G1 und ist hier nicht behauptet.

   ENTSCHEIDUNGSREGEL (einheitlich für alle Einträge, damit die Auswahl
   nachvollziehbar und nicht von Fall zu Fall begründet ist):
     1. Gibt es in der FACHLICH richtigen Kategorie einen Namen, der dem
        ORVIA-Slug EXAKT entspricht, wird dieser genommen.
     2. Gibt es keinen, wird EINE Variante ausdrücklich festgelegt und mit
        Begründung vermerkt (`variantChoice: true`). Das ist keine Näherung
        nach Namensähnlichkeit, sondern eine benannte Entscheidung.
     3. Gibt es weder das eine noch das andere, lautet der Status `ambiguous`
        oder `unmapped`. Es wird NIEMALS eine ähnlich klingende Übung geraten.

   WARUM SCHRITT 1 „in der FACHLICH richtigen Kategorie" sagt:
   Ein reiner Namensabgleich über alle Kategorien hätte `overhead_press` auf
   `sandbag / overhead_press` (#10) gelegt — eine Sandsack-Übung. Der exakte
   Name existiert dort, und nur dort. Die Kategorie entscheidet mit.

   [A] ANNAHME `returnVariantRisk`: eine Einschätzung, wie wahrscheinlich die
   Uhr beim Rücksync GENAU dieses Paar meldet. Sie ist gesetzt, nicht gemessen,
   und wird durch den Gerätetest G2 ersetzt. Sie beeinflusst den Export NICHT.
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {};
  var O = window.ORVIA;

  var VERSION = 'garmin-exercise-map@1';
  var CATALOG = {
    source: 'Garmin FIT SDK (offiziell), PyPI-Paket garmin-fit-sdk',
    sdkVersion: '21.213.0',
    fixture: 'supabase/tests/fixtures/garmin-fit-catalog-21.213.0.json',
    verifiedAt: '2026-08-12',
    secondSource: null   /* [OFFEN-1] Connect-Picker nicht erreichbar */
  };

  var STATUS = ['mapped', 'unmapped', 'ambiguous', 'deprecated'];

  /* Das MVP-Kernset (Gians Festlegung O2). Alle zehn Slugs sind gegen die
     echten Seeds aus 0003/0006 geprüft — keiner ist erfunden. */
  var MVP_CORE = ['bench_press', 'overhead_press', 'pullup', 'lat_pulldown', 'row',
    'squat', 'leg_press', 'romanian_deadlift', 'leg_curl', 'hip_thrust'];

  /* categoryCode/nameCode stammen unverändert aus dem FIT-SDK-Profil und
     werden vom Vertragstest gegen die Katalogdatei nachgewiesen. */
  var ENTRIES = {
    bench_press: {
      de: 'Bankdrücken', status: 'mapped',
      category: 'bench_press', categoryCode: 0,
      name: 'barbell_bench_press', nameCode: 1,
      variantChoice: true,
      note: 'Kein neutraler Eintrag „bench_press" im Katalog — die Kategorie kennt 28 Varianten, alle mit Gerät. Festgelegt auf die Langhantelfassung, weil der ORVIA-Eintrag ohne Gerätezusatz geführt wird und die Kurzhantelfassung in der Bibliothek einen eigenen Platz bekäme.',
      returnVariantRisk: 'medium',
      riskNote: '[A] Erkennt die Uhr Kurzhantel-Bankdrücken, meldet sie #6 statt #1 — der Rückimport findet dann keine Zuordnung und meldet `unresolved` statt zu raten.'
    },
    overhead_press: {
      de: 'Schulterdrücken', status: 'mapped',
      category: 'shoulder_press', categoryCode: 24,
      name: 'barbell_shoulder_press', nameCode: 4,
      variantChoice: true,
      note: 'ACHTUNG-FUND: Der exakte Name „overhead_press" existiert im Katalog NUR unter `sandbag` (#10) — ein reiner Namensabgleich hätte Schulterdrücken auf eine Sandsack-Übung gelegt. Fachlich richtige Kategorie ist `shoulder_press`; dort gibt es keinen neutralen Eintrag, deshalb ausdrücklich die Langhantelfassung.',
      returnVariantRisk: 'medium',
      riskNote: '[A] Kurzhantel-Variante wäre #24 derselben Kategorie.'
    },
    pullup: {
      de: 'Klimmzüge', status: 'mapped',
      category: 'pull_up', categoryCode: 21,
      name: 'pull_up', nameCode: 38,
      variantChoice: false,
      note: 'Exakter Name in der fachlich richtigen Kategorie — bis auf die Schreibweise des Unterstrichs (ORVIA fuehrt den Slug als `pullup`, Garmin als `pull_up`; identische Buchstabenfolge, keine Variantenwahl). Derselbe Name existiert zusaetzlich unter `suspension` (#19) — das ist die Schlingentrainer-Fassung und hier nicht gemeint; die Kategorie trennt beide sauber.',
      returnVariantRisk: 'low'
    },
    lat_pulldown: {
      de: 'Latzug', status: 'mapped',
      category: 'pull_up', categoryCode: 21,
      name: 'lat_pulldown', nameCode: 13,
      variantChoice: false,
      note: 'Exakter Name, kategorieübergreifend eindeutig (genau ein Treffer im gesamten Katalog).',
      returnVariantRisk: 'low'
    },
    row: {
      de: 'Rudern', status: 'mapped',
      category: 'row', categoryCode: 23,
      name: 'row', nameCode: 36,
      variantChoice: false,
      note: 'Gian hatte diesen Eintrag ausdrücklich als Zweifelsfall benannt. Ergebnis der Prüfung: ein exakter Name „row" existiert in der fachlich richtigen Kategorie (#36) — der Eintrag ist damit NICHT mehrdeutig im Sinne des Exports. Der Name kommt zusätzlich in vier Gerätekategorien vor (banded_exercises, sandbag, sled, suspension); die Kategorie trennt sie.',
      returnVariantRisk: 'high',
      riskNote: '[A] Die Kategorie `row` enthält 53 Namen, darunter `barbell_row` (#45), `seated_cable_row` (#18) und `dumbbell_row` (#2). Die Uhr wird beim Rücksync sehr wahrscheinlich eine dieser konkreten Fassungen melden, nicht den neutralen Namen. Der Export funktioniert; der Rückweg ist der wacklige Teil. Sauberer wäre, „Rudern" in der ORVIA-Bibliothek in die tatsächlich trainierte Fassung aufzuteilen — das ist eine Bibliotheks-, keine Mappingfrage.'
    },
    squat: {
      de: 'Kniebeuge', status: 'mapped',
      category: 'squat', categoryCode: 28,
      name: 'squat', nameCode: 61,
      variantChoice: false,
      note: 'Exakter Name in der fachlich richtigen Kategorie (#61). Zusätzlich in `banded_exercises` (#42) und `suspension` (#31) — durch die Kategorie getrennt.',
      returnVariantRisk: 'high',
      riskNote: '[A] Die Uhr meldet für eine Langhantelkniebeuge vermutlich `barbell_back_squat` (#6) statt des neutralen Namens. Gleiche Lage wie bei `row`.'
    },
    leg_press: {
      de: 'Beinpresse', status: 'mapped',
      category: 'squat', categoryCode: 28,
      name: 'leg_press', nameCode: 0,
      variantChoice: false,
      note: 'Exakter Name, kategorieübergreifend eindeutig. Dass die Beinpresse bei Garmin unter `squat` einsortiert ist, ist überraschend, aber Katalogtatsache — nicht korrigiert.',
      returnVariantRisk: 'low'
    },
    romanian_deadlift: {
      de: 'Rumänisches Kreuzheben', status: 'mapped',
      category: 'deadlift', categoryCode: 8,
      name: 'romanian_deadlift', nameCode: 23,
      variantChoice: false,
      note: 'Gian hatte auch diesen als Zweifelsfall benannt. Ergebnis: exakter Name, kategorieübergreifend eindeutig (genau ein Treffer). Kein Zweifelsfall.',
      returnVariantRisk: 'low'
    },
    leg_curl: {
      de: 'Beinbeuger', status: 'mapped',
      category: 'leg_curl', categoryCode: 15,
      name: 'leg_curl', nameCode: 0,
      variantChoice: false,
      note: 'Exakter Name in der gleichnamigen Kategorie.',
      returnVariantRisk: 'low'
    },
    hip_thrust: {
      de: 'Hip Thrust', status: 'mapped',
      category: 'hip_raise', categoryCode: 10,
      name: 'barbell_hip_thrust_with_bench', nameCode: 1,
      variantChoice: true,
      note: 'Gian hatte auch diesen als Zweifelsfall benannt. Der Katalog kennt genau ZWEI Hip-Thrust-Einträge: #0 auf dem Boden, #1 mit Bank. Beide mit Langhantel, sie unterscheiden sich nur im Aufbau. Festgelegt auf die Bankfassung, weil der Hip Thrust definitionsgemäss mit aufliegendem Oberkörper ausgeführt wird; die Bodenfassung ist fachlich eine Glute Bridge. Das ist eine benannte Entscheidung, keine Namensähnlichkeit — und mit einer Zeile umzustellen.',
      returnVariantRisk: 'low'
    }
  };

  function forSlug(slug) {
    if (!slug || typeof slug !== 'string') return null;
    return Object.prototype.hasOwnProperty.call(ENTRIES, slug) ? ENTRIES[slug] : null;
  }

  /* K4 exportiert AUSSCHLIESSLICH `mapped`. Alles andere liefert einen
     benannten Grund — der Aufrufer soll die Übung überspringen und melden,
     nicht ersetzen. */
  function toGarmin(slug) {
    var e = forSlug(slug);
    if (!e) return { ok: false, reason: 'unknown_slug', status: 'unmapped', slug: slug || null };
    if (e.status !== 'mapped') return { ok: false, reason: 'not_mapped', status: e.status, slug: slug };
    return {
      ok: true, slug: slug, status: 'mapped',
      category: e.category, categoryCode: e.categoryCode,
      name: e.name, nameCode: e.nameCode,
      mappingVersion: VERSION
    };
  }

  /* Rückrichtung: NUR die exakte Kombination zählt. Ein Teiltreffer auf die
     Kategorie allein ist kein Treffer — sonst würde jedes Rudern der Welt zu
     „Rudern" und der Rückkanal begänne zu raten. */
  /* Der dritte Parameter ist eine PRUEFOEFFNUNG, kein Produktweg (v8-330).
     Grund: mit den heutigen 10 eindeutigen Eintraegen ist der Zweig
     `ambiguous_reverse` durch reale Daten nicht erreichbar — eine
     Mutationsprobe blieb deshalb gruen. Sobald das Mapping mit dem Gym-Pack
     waechst, zeigen zwangslaeufig mehrere ORVIA-Slugs auf dieselbe
     Garmin-Kombination; dann muss die Mehrdeutigkeit nachweislich als solche
     gemeldet werden statt still den ersten Treffer zu waehlen. Ohne diese
     Oeffnung waere der erste Nachweis genau der Tag, an dem es schiefgeht.
     Produktive Aufrufer uebergeben nichts und arbeiten unveraendert gegen
     ENTRIES; ein uebergebener, aber untauglicher Wert wird fail-closed
     abgewiesen statt still auf die echte Tabelle zurueckzufallen. */
  function fromGarmin(category, name, entriesForTest) {
    if (!category || !name) return { ok: false, reason: 'incomplete_input' };
    var table = ENTRIES;
    if (entriesForTest !== undefined) {
      if (!entriesForTest || typeof entriesForTest !== 'object' || Array.isArray(entriesForTest)) {
        return { ok: false, reason: 'invalid_entries' };
      }
      table = entriesForTest;
    }
    var hits = [];
    for (var slug in table) {
      if (!Object.prototype.hasOwnProperty.call(table, slug)) continue;
      var e = table[slug];
      if (e.status === 'mapped' && e.category === category && e.name === name) hits.push(slug);
    }
    if (hits.length === 1) return { ok: true, slug: hits[0], mappingVersion: VERSION };
    if (hits.length > 1) return { ok: false, reason: 'ambiguous_reverse', candidates: hits };
    return { ok: false, reason: 'unmapped_combination', category: category, name: name };
  }

  /* Abdeckung mit NAMENTLICHEN Lücken — eine blosse Prozentzahl verbirgt
     genau die Information, die man braucht (Plan K3: „jede Lücke ist
     sichtbar"). */
  function coverage(slugs) {
    var list = Array.isArray(slugs) ? slugs : MVP_CORE;
    var out = { total: list.length, mapped: 0, ambiguous: 0, unmapped: 0, deprecated: 0, unknown: 0,
      mappedSlugs: [], gaps: [], variantChoices: [], highReturnRisk: [] };
    for (var i = 0; i < list.length; i++) {
      var s = list[i], e = forSlug(s);
      if (!e) { out.unknown++; out.gaps.push({ slug: s, status: 'unknown', why: 'kein Eintrag in der Zuordnungstabelle' }); continue; }
      if (e.status === 'mapped') {
        out.mapped++; out.mappedSlugs.push(s);
        if (e.variantChoice) out.variantChoices.push({ slug: s, name: e.name, why: e.note });
        if (e.returnVariantRisk === 'high') out.highReturnRisk.push({ slug: s, why: e.riskNote || '' });
      } else {
        out[e.status] = (out[e.status] || 0) + 1;
        out.gaps.push({ slug: s, status: e.status, why: e.note || '' });
      }
    }
    out.ratio = out.total ? out.mapped / out.total : 0;
    return out;
  }

  O.garminExerciseMap = {
    VERSION: VERSION, CATALOG: CATALOG, STATUS: STATUS, MVP_CORE: MVP_CORE,
    entries: ENTRIES, forSlug: forSlug, toGarmin: toGarmin, fromGarmin: fromGarmin,
    coverage: coverage
  };
})();
