const C = 'orvia-v8-329';   /* DIE APP DARF ENDLICH VORSCHREIBEN (2026-08-12) · v8-329:

   Diese Fassung aendert keine Oberflaeche und keine Trainingslogik. Sie loest
   eine Blockade im Wissensvertrag, die der eigentliche Grund dafuer war, dass
   ORVIA nie sagt "heute 5 km Tempolauf in 1-km-Bloecken" oder "heute Brust:
   zwei Saetze Bankdruecken".

   BEFUND. Der Wissensvertrag hat bis v5 zwei verschiedene Fragen an dieselbe
   Achse gehaengt:
     1. Wie gut ist die Evidenz fuer diese Aussage?   (Klasse A-D)
     2. Darf die App dem Nutzer ueberhaupt etwas Konkretes sagen?
   Frage 2 wurde aus Frage 1 abgeleitet. Da jede Engine-Wirkung eine ORVIA-
   Produktentscheidung enthaelt und Produktentscheidungen Klasse D sind, war
   der Ceiling ALLER 14 Running-Regeln D — und D durfte per Vertrag nichts
   Quantitatives. Im running-knowledge-pack steht das woertlich so drin:
   "Dieses Pack erzeugt weiterhin KEINEN Plan, KEINE Capacity-Formel, KEINE
   Wochenumfangs- oder Pace-Vorgabe." Die App war also nicht unwissend,
   sondern per Bauart stumm. Gemessen: mode 'production' liefert 0 von 14
   Regeln, quantitativeUseAllowed war fuer JEDE Registerquelle false, weil
   alle 17 Quellen riskOfBias 'not_formally_assessed' tragen.

   AENDERUNG. Der Vertrag geht auf v6 und trennt die beiden Achsen. Die
   Evidenzlogik bleibt unveraendert streng; neu ist ausschliesslich, dass eine
   schwach belegte Regel vorschreiben DARF, sofern sie ihre Herkunft OFFENLEGT.

   1. Modus 'advisory' zwischen 'shadow' und 'production'. Er hebt genau eine
      Sperre auf: die wissenschaftliche Freigabepflicht. Gemessen liefert er
      12 von 14 Regeln, wo production 0 liefert — und es sind Zeichen fuer
      Zeichen dieselben 12 wie im Shadow-Modus.
   2. Offenlegungspflicht statt Blockade. selectRules gibt je Regel ein
      disclosure-Objekt zurueck: Evidenzklasse, Confidence, Basis, deutsches
      Label, Quellen-IDs, mustDisplaySource. Die Basis ist die SCHWAECHSTE
      essenzielle Rolle — eine Regel ist nie besser begruendet als ihre
      schwaechste tragende Saeule. Nicht-mutierend: die Regelobjekte des Packs
      werden nicht angefasst, der Pack-Hash bleibt gueltig.
   3. Quantitative Struktur ist von quantitativer Autorisierung getrennt. Bis
      v5 pruefte validateClaim die AUTORISIERUNG — Folge: ein quantitativer
      Claim ohne Autorisierung machte Regel und damit das ganze Pack ungueltig.
      Es war also gar nicht moeglich, ueberhaupt eine Zahl zu hinterlegen. Neu
      prueft die Validierung nur die Struktur (quantitativeSchemaValid); ob die
      Zahl benutzt werden darf, entscheidet zur Laufzeit
      quantitativeUseAllowed (production, verhaltensgleich zu v5) bzw.
      prescriptiveNumberAllowed (advisory, neu).
   4. prescriptiveNumberAllowed ist fail-closed gegenueber der Regel: ohne
      Regelkontext keine Zahl, bei medicalSafetyRelevant ohne medizinische
      Freigabe keine Zahl, bei decisionRole 'fallback' keine Zahl, bei
      'rejected' oder technisch ungeprueft keine Zahl. Die Strenge verlagert
      sich von der Evidenzklasse auf den GELTUNGSBEREICH: Einheiten,
      validRange, exclusions, uncertaintyRange und safetyBounds muessen
      deklariert sein, sonst kommt keine Zahl heraus.
   5. Fuenf neue Quellentypen, damit Praxiswissen ueberhaupt einspeisbar ist:
      coach_practice_video, coach_curriculum, textbook, practice_synthesis
      (Ceiling C) und federation_guideline (Ceiling B). Vorher haette
      validateSource jedes Coachvideo mit source_unknown_type abgewiesen. Sie
      koennen per Konstruktion nie Klasse A erreichen, auch nicht bei bestem
      Appraisal: Verbreitung ist kein Evidenzmass. Tausend uebereinstimmende
      Videos ergeben Bro-Science-Konsens, nicht Wahrheit.

   WAS SICH NICHT AENDERT. Keine Lockerung bei Medizin oder Sicherheit:
   medizinisch relevante Regeln (RUN-SAFE-001, RUN-RTR-001) bleiben in JEDEM
   Modus gesperrt, bis eine medizinische Freigabe vorliegt. Technisch
   ungeprueft und 'rejected' bleiben ueberall ausgeschlossen. Die Pin-Pflicht
   gilt in advisory unveraendert — kein Schlupfloch. production und shadow
   verhalten sich exakt wie in v8-328.

   NACHGEZOGENE PINS. Eine Vertragsaenderung muss jeden Consumer zwingen,
   bewusst nachzuziehen — genau dafuer ist expectedKnowledgeContractVersion da.
   Nachgezogen auf 6: running-capacity-factory.js (bleibt im Modus 'shadow';
   'advisory' ist fuer Vorgaben gedacht, nicht fuer Capacity-Berechnung),
   batch3b0_knowledge_test.mjs, batch3b1_running_capacity_test.mjs.

   EHRLICH BENANNT. Der Zweig 'disclosure_underivable' in selectRules ist unter
   dem aktuellen Vertrag nicht erreichbar, weil validatePack vorher blockiert.
   Er bleibt als Verteidigung in der Tiefe stehen, zaehlt aber ausdruecklich
   NICHT als nachgewiesener Schutz; die Zusicherung wird direkt an
   disclosureFor geprueft (PR7b).

   VIER TESTLUECKEN, DIE DIE MUTATIONSPROBEN AUFGEDECKT HABEN — und die ohne
   die Proben unbemerkt geblieben waeren:
     M6  Das Entfernen der true-Pflicht bei independentValidation blieb gruen.
         Die Suite prueft nur typwidrige Werte ('ja', 1, {}); der eigentliche
         Grenzfall — boolesches false — fehlte. Neu: QN1c.
     M7  Das Anheben der Verbandsleitlinie auf Klasse-A-Ceiling blieb gruen,
         weil das Test-Fixture moderate/not_formally_assessed traegt und damit
         ohnehin gedeckelt wird. Neu: PX2b mit bestem denkbaren Appraisal plus
         Gegenprobe am Konsensuspapier.
     M10 Das Umdrehen der Schwaeche-Ordnung blieb gruen, weil die realen
         Pack-Regeln je nur eine essenzielle Rolle tragen — die Rangtabelle
         blieb ungeprueft. Neu: PR6c mit synthetisch gemischten Rollen.
     M11 Das Hineinschreiben der Offenlegung ins Regelobjekt blieb gruen, weil
         Object.freeze die Zuweisung still verschluckt. Der Test mass das
         Einfrieren, nicht den Selektor. Neu: PR8 gegen ein aufgetautes Pack.
   Nach dem Schliessen schlagen alle 11 Proben an. Jede Probe verifiziert
   zuerst, dass ihre Ersetzung ueberhaupt gegriffen hat — eine nicht
   angewandte Probe liest sich sonst wie ein gruener Test und hat keinen
   Aussagewert (Lehre aus Y7).

   Wissensvertrag 5 -> 6, 30 neue Tests in batch3b0 (82 -> 112).
   Gesamtsuite 251/0 (7 uebersprungen), Kohorten-Pin 023ee59b unveraendert.

   GERAETETEST-AUSLOESER IN DER APP (2026-08-12) · v8-328:
   Gian will den Test auf dem Handy ausloesen, nicht am Rechner. Zu Recht —
   er steht dabei im Gym. Das Terminalwerkzeug aus v8-327 bleibt, aber es war
   fuer diesen Moment das falsche Werkzeug.

   KEIN PRODUKTKNOPF, und das ist der ganze Entwurf:
   Der Abschnitt erscheint AUSSCHLIESSLICH, wenn die Seite mit ?gate=1
   geoeffnet wurde. Er wird NIRGENDS gespeichert — kein localStorage, kein
   Flag, keine Einstellung. Beim naechsten normalen Aufruf ist er weg. Es gibt
   damit keinen Weg, versehentlich hineinzugeraten, und der produktive Pfad
   bleibt geschlossen wie vereinbart. `?gate=0`, `?gate=true` oder ein blosses
   `?gate` schalten NICHTS frei; nur die exakte 1.

   WO: an der Seite „Geräte & Datenquellen", direkt unter der bestehenden
   Garmin-Flaeche. Nicht am Plan, nicht am Training — dort haette er neben
   echten Bedienelementen gestanden.

   ZWEISTUFIG: erst „Payload pruefen" (rechnet, zeigt die Kontrollwerte,
   geht NICHT ins Netz), dann in einem zweiten ausdruecklichen Griff
   „An Garmin senden". Vor dem Rechnen ist Senden gesperrt.

   EINE WAHRHEIT: der In-App-Pfad baut mit denselben ECHTEN Modulen wie das
   Terminalwerkzeug — geprueft wird nicht „sieht aehnlich aus", sondern
   Gleichheit der Werte: clientRef swe:po:<heute>:ps:devicetest:v1,
   payloadHash strength-plan@1:2cf88fd5, sechs Schritte in der Reihenfolge
   repeat/set/rest je Uebung, Gewichte 20000 und 30000. Der Test vergleicht
   ausserdem die geplanten Gewichte in ui.js gegen die in
   tools/device-test-push.mjs — laufen sie auseinander, prueft das Gate etwas
   anderes als die App sendet, und genau das faellt dann auf.

   BEQUEM UND TROTZDEM ENG: das Sitzungs-Token holt sich der Abschnitt selbst
   aus der laufenden Anmeldung (dasselbe Muster wie „Jetzt synchronisieren"),
   die Worker-Adresse aus der Konfiguration. Nichts wird von Hand kopiert —
   und im Rumpf steht kein user_id, der Nutzer kommt aus dem Token.

   FEHLER IM KLARTEXT statt roher Statuszahlen: 422 nennt ausdruecklich
   STRENGTH_PUSH_DEVICE_TEST als wahrscheinlichste Ursache, 409 den bereits
   verwendeten clientRef, 401 die abgelaufene Anmeldung. Ein unbekannter
   Status wird ehrlich mit seiner Zahl gemeldet. Ohne Sitzung, ohne
   konfigurierten Worker oder ohne geladene Module wird NICHT gesendet, und
   der Grund steht daneben.

   Tests: supabase/tests/gate_test_trigger_test.mjs (50, T1-T6), 10
   Mutationsproben, alle 10 sofort rot — darunter „Abschnitt immer sichtbar",
   „auch ?gate=0 schaltet frei", „Zustand wird gespeichert", „Senden ohne
   vorheriges Rechnen", „deviceTest faellt weg", „anderes Gewicht als im
   Werkzeug" und „user_id wandert in den Rumpf".
   Gesamtsuite 251/0 (7 uebersprungen), Kohorten-Pin 023ee59b unveraendert.

   ANMERKUNG ZUM STOPP: Du hattest „keine weiteren Aenderungen bis zum
   Geraetetest" gesagt. Diese Aenderung ist die Antwort auf deine Frage, wie
   der Test in der App laeuft — ohne sie waere der Test auf dem Handy nicht
   durchfuehrbar. Sie beruehrt kein Produktverhalten: ohne ?gate=1 ist die
   App Zeichen fuer Zeichen dieselbe wie in v8-327.

   ---------------------------------------------------------------
   GERAETETEST-WERKZEUG + EINE KORREKTUR (2026-08-12) · v8-327:
   Entwicklungsstopp fuer K6/K7 ist angenommen. Diese Runde baut KEIN neues
   Produktverhalten — sie liefert das Werkzeug fuer G1-G3 und korrigiert eine
   Aussage aus v8-326.

   BLOCKIERENDER PUNKT IN DEINEM ABLAUF, den ich vorab melden muss
   Dein Schritt 4 lautet „Push ausdruecklich mit deviceTest:true ausloesen".
   Diesen Ausloeser GIBT ES NICHT: `garminWorkoutExport` hat repo-weit keinen
   Aufrufer, und nichts in der App kennt /workout/push. Ich hatte das in
   v8-326 als „nicht in dieser Runde" vermerkt, aber nicht gesehen, dass es
   deinen Testablauf blockiert. Ein Knopf in der App waere allerdings genau
   die Produktflaeche, die du erst nach den Gates willst — deshalb ein
   WERKZEUG statt einer Oberflaeche:

     tools/device-test-push.mjs
       Baut die Payload mit den ECHTEN Modulen (strength-plan,
       garmin-exercise-map, garmin-workout-export) — kein Nachbau. Was dort
       herauskommt, ist zeichengleich mit dem, was die App spaeter erzeugen
       wuerde; ein Gate, das etwas anderes prueft als das Produkt, waere
       wertlos. Ohne --send passiert nichts ausser Rechnen und Anzeigen.
       Vorausberechnet fuer dein Testworkout:
         clientRef   swe:po:2026-08-12:ps:devicetest:v1
         payloadHash strength-plan@1:2cf88fd5
         Schritte    1 Gruppe(2x) / 2 Satz 8 Wdh / 3 Pause 60 s
                     4 Gruppe(2x) / 5 Satz 6 Wdh / 6 Pause 90 s
         Gewichte    20 kg -> 20000, 30 kg -> 30000 (Gramm-Annahme, Gate G3)

     garmin-worker/scripts/capture_workout_sets.py
       Erfasst die Saetze BEREINIGT fuer G2/G3. Arbeitet mit einer
       ERLAUBNISLISTE, nicht mit einer Verbotsliste: es kopiert nur die von
       dir benannten Felder heraus, statt Unerwuenschtes zu entfernen. Eine
       Verbotsliste vergisst irgendwann ein Feld — eine Erlaubnisliste kann
       das nicht. Gegen eine Rohantwort mit neun eingebauten Geheimnissen
       (Token, zwei E-Mail-Adressen, Klarname, GPS, Profil-ID, Freitextnotiz)
       geprueft: keines erscheint in der Ausgabe.

     docs/GERAETETEST-G1-G3-PROTOKOLL.md
       Ausfuellblatt mit den vorausberechneten Sollwerten.

   KORREKTUR AN v8-326
   Ich hatte geschrieben, in der Worker-Suite seien ZWEI Tests vorbestehend
   rot. Das war falsch, und der Fehler lag bei mir: der zweite Rotstand wurde
   von MEINEM eigenen Container-Behelf verursacht. In diesem Container liegt
   in dist-packages ein fremdes Paket namens `tests`, das das lokale
   Testverzeichnis verdeckt; ich hatte dagegen ein tests/__init__.py angelegt,
   und genau das bricht `from conftest import FakeGarminApi` in
   test_partial_failure_isolated_and_reported. Ohne meinen Behelf ist dieser
   Test gruen. Vorbestehend rot ist GENAU EINER.

   UND DER IST DIAGNOSTIZIERT — das Ergebnis ist wichtig fuer deinen
   Reparaturschritt:
     test_sync_writes_expected_rows erwartet activities.status == 'final'.
     sync.py schreibt 'completed'. Die Migration 0009_canonical_activities.sql
     erlaubt per CHECK ausschliesslich
       ('completed','aborted','cancelled','planned')
     — 'final' wuerde die Datenbank ABLEHNEN. Also ist der CODE richtig und
     der TEST veraltet. Wer das andersherum repariert, baut einen
     Produktionsfehler ein. Ich habe NICHTS davon angefasst: eine
     Testerwartung waehrend eines Entwicklungsstopps stillschweigend
     umzuschreiben waere genau der Griff, den man nicht tun soll.

   Keine Aenderung an Produktcode. Kein K6, kein K7. App-Gesamtsuite 250/0,
   Worker-Suite 155 bestanden / 1 vorbestehend rot (siehe oben),
   Kohorten-Pin 023ee59b unveraendert.

   ---------------------------------------------------------------
   WORKER-PUSH ALS KONTROLLIERTER SPIKE (2026-08-12) · v8-326, K5:
   ACHTUNG ZUR VERSION: In dieser Runde hat sich KEINE App-Laufzeitdatei
   geaendert — die Arbeit liegt vollstaendig im garmin-worker/. Ich zaehle die
   Version trotzdem hoch, damit das Verzeichnis der Runden lueckenlos bleibt;
   der einzige Preis ist ein einmaliger Cache-Neuabruf.

   K5 IST KEINE FREIGABE. Die numerische Sport-ID und die numerische ID der
   Abbruchbedingung `reps` sind weiterhin unbelegt (Gate G1). Der Endpunkt
   lehnt deshalb im REGELBETRIEB jedes Payload ab, das sie als null traegt —
   und ebenso jedes mit weightValue, solange G3 zu ist. Der produktive Pfad
   bleibt geschlossen, so wie du es verlangt hast.

   ZUERST DIE BELEGE (vor jeder Zeile Code am echten Worker geprueft)
     1. Auth-Bibliothek: garminconnect==0.3.2 (requirements.txt). Login ueber
        Garmin(email,password,return_on_mfa=True).login(); Token-String aus
        garmin.client.dumps().
     2. Tokens: Fernet-verschluesselt in provider_credentials
        (user_id, provider_type, credential_kind='session_tokens'). Geladen
        wird ueber crypto.decrypt_str(...) -> provider_factory(token_str).
     3. JWT-Pruefung: db.verify_supabase_jwt() gegen {SUPABASE_URL}/auth/v1/user,
        eingebunden als FastAPI-Dependency current_user_id. Client-gelieferte
        user_ids werden nirgends verwendet.
     4. Garmin-Aufruf fuer Workouts: GAB ES NOCH NICHT. Der Provider hatte
        keine Upload-Methode. Neu ergaenzt als upload_strength_workout() —
        hinter demselben Adapter wie alles andere, mit demselben
        _map_exception()-Pfad.
     5. Schreibrecht: ja, service_role ueber PostgREST. ABER: der globale
        ON_CONFLICT-Vertrag in db.py wird von test_sync_contract.py auf
        GLEICHHEIT mit dem Kommentarblock in Migration 0019 geprueft. Haette
        ich strength_workout_exports dort eingetragen, waere dieser
        Vertragstest gebrochen. Der Push uebergibt on_conflict deshalb NICHT
        global, sondern arbeitet mit select + insert + update — was ohnehin
        richtig ist, weil ein merge-upsert ein bestehendes Workout still
        ueberschreiben wuerde.

   IDEMPOTENZ UND RENNEN
   Ein SELECT allein waere ein Rennen. Der eigentliche Schutz ist der
   Unique-Index (user_id, client_ref) aus Migration 0035: der zweite
   gleichzeitige Insert scheitert mit 409, und erst dann wird der Stand des
   ersten gelesen. Zwei Faelle werden unterschieden:
     gleicher clientRef + gleicher Hash  -> 409 already_pushed
     gleicher clientRef + ANDERER Hash   -> 409 client_ref_conflict
   Der zweite Code ist eine Erweiterung deines Vertrags; er war noetig, weil
   du beide Faelle ausdruecklich getrennt haben wolltest. Ein bestehendes
   Garmin-Workout wird nie still ersetzt. Ein FEHLGESCHLAGENER Push darf
   dagegen wiederholt werden — er ist kein already_pushed.

   SICHERHEIT
   Das Body-Modell hat gar kein user_id-Feld und steht auf extra='forbid':
   ein mitgeschicktes user_id fuehrt zu 422, statt still ignoriert zu werden.
   `last_error` kennt nur einen festen Vorrat an Codes — kein Ausnahmetext
   aus einer fremden Bibliothek kann in die Datenbank sickern. Kein
   Passwort-Fallback: fehlt oder greift das Token nicht, endet der Vorgang mit
   reauthentication_required und setzt das Flag in data_providers, und zwar
   NUR beim eigenen Nutzer.

   EINE ECHTE TESTLUECKE, gefunden und geschlossen
     W17: Ich konnte die Entwurfszeile schon beim Anlegen auf status='pushed'
          setzen, ohne dass ein Test rot wurde — der Erfolgsfall ueberschreibt
          den Wert ohnehin, und kein Test beobachtete den Zwischenzustand.
          Genau das hattest du verlangt ("Status erst nach bestaetigter
          Garmin-Antwort"). Die Testdatenbank fuehrt jetzt eine Spur ALLER
          Statusschreibvorgaben; geprueft wird, dass 'draft' zuerst kommt und
          'pushed' nur zusammen mit der Garmin-ID geschrieben wird — und dass
          ein Fehlschlag ihn NIE erreicht. Zusaetzlich prueft der Test, dass
          die Datenbank es unabhaengig verbietet (swe_pushed_needs_id in 0035).
   Zwei weitere Proben waren AEQUIVALENTE Mutationen (sie aenderten das
   Verhalten nicht, weil ein vorgelagerter Riegel bereits greift) und eine
   griff wegen eines falschen Suchtexts gar nicht — alle drei nachgezogen und
   danach rot. Endstand: 21 Proben, 21 rot.

   Tests: garmin-worker/tests/test_workout_push.py (48, P1-P14). Wurde
   test_api_auth.py um den neuen Endpunkt erweitert. Worker-Suite im Container
   164 bestanden (vorher 113), 2 uebersprungen. Die zwei roten Tests in
   test_sync_contract.py sind VORBESTEHEND und beruehren K5 nicht — sie waren
   vor meiner ersten Zeile bereits rot (Aktivitaets-Sport-Mapping). Ich habe
   sie nicht angefasst und auch nicht stillschweigend uebergangen.
   App-Gesamtsuite unveraendert 250/0, Kohorten-Pin 023ee59b unveraendert.

   NICHT IN DIESER RUNDE: kein Aufruf aus der App heraus (die Oberflaeche
   kennt den Endpunkt noch nicht), kein schedule_workout, kein Rueckimport.
   K9 bleibt getrennt.

   ---------------------------------------------------------------
   KRAFT-WORKOUT-EXPORTER (2026-08-12) · v8-325, K4:
   Aus einer geplanten ORVIA-Krafteinheit wird ein Garmin-Workout-Payload.
   REIN: kein Netz, keine Uhr, kein Zufall. Drei Laeufe liefern byte-identische
   Ausgabe. K4 ENDET HIER — Persistenz, Auth und Push sind K5.

   DIE KERNENTSCHEIDUNG: WAS NICHT BELEGT IST, WIRD NICHT ERFUNDEN
   Die Payloadstruktur (ExecutableStepDTO, RepeatGroupDTO, workoutSegments,
   die displayOrder-Werte, ConditionType.TIME=2 und ITERATIONS=7,
   StepType.INTERVAL=3/REST=5/REPEAT=6, TargetType.NO_TARGET=1) stammt aus dem
   echten garminconnect/workout.py 0.3.2 — der Bibliothek, die euer Worker
   einsetzt. Diese Werte sind BELEGT und stehen in der Payload.

   ZWEI Zahlen sind es NICHT, und ich schreibe sie deshalb nicht hin:
     - Die Sport-ID fuer ein KRAFT-Workout. `SportType` in workout.py kennt
       nur running..other (1-8) und nennt sich selbst „common values" —
       Krafttraining fehlt. Das FIT-Profil kennt sport #10 `training` und
       sub_sport #20 `strength_training`. Die ZEICHENKETTE ist damit echtes
       Garmin-Vokabular und steht in der Payload; die ZAHL waere eine
       Uebertragung aus dem FIT- in den REST-Namensraum — geraten.
     - Die numerische ID der Abbruchbedingung „reps". `ConditionType` kennt
       distance/time/heart_rate/calories/cadence/power/iterations. REPS
       existiert dort NICHT.

   Beide stehen im Regelbetrieb als `null` in der Payload, mit gesetztem
   Schluessel. Eine erfundene Zahl saehe richtig aus, ginge durch jeden Test
   und wuerde beim ersten Push still etwas Falsches anlegen; ein sichtbares
   null bricht frueh und laut. Fuer den Geraetetest setzt
   `options.fillUnverifiedIds` die Kandidatenwerte ein — und erzeugt dabei
   eine Warnung mit Gate-Bezug, damit niemand den Testmodus fuer den
   Regelbetrieb haelt.

   GATE G3 BLEIBT ZU. `weightValue` wird standardmaessig GAR NICHT erzeugt.
   `options.includeWeight` schaltet es frei; die Skalierung kg x 1000 ist
   dabei ein beschriftetes Objekt (WEIGHT_SCALE_ASSUMPTION, verified:false,
   gate:'G3'), keine Konstante im Code. Gelesen wird nachweislich in Gramm
   (weight: 39000.0 = 39 kg); die Schreibrichtung ist unbestaetigt.

   PROVENIENZLUECKE BLEIBT SICHTBAR. Jedes Ergebnis traegt
   catalogSources: ['fit-sdk@21.213.0'] und eine Warnung `single_catalog_source`.
   Der Exporter behauptet nirgends eine doppelte Verifikation — die zweite
   Quelle (Connect-Uebungspicker) fehlt weiterhin.

   FESTGELEGTE REGELN
     - Nur status:'mapped' wird exportiert. ambiguous, unmapped, unbekannte
       Slugs und Zeilen ohne aufloesbaren Slug werden NAMENTLICH mit Grund und
       Zeilenindex ausgewiesen; jede Meldung sagt ausdruecklich, dass nichts
       ersetzt wurde.
     - Fehlende Wiederholungen ⇒ die Uebung wird NICHT exportiert. Garmin
       braucht eine Zahl; sie zu schaetzen ist ausgeschlossen.
     - Ein Bereich 6-8 geht als untere Grenze in die Payload — die zugesagte
       Vorgabe, mehr darf man immer. Dass der Bereich zusammenfaellt, steht als
       Warnung im Ergebnis.
     - Fehlende Pause ⇒ der DOKUMENTIERTE Vertragsdefault aus strength-plan.js
       ([A3] 120 s), plus Warnung. Kein hier neu erfundener Wert. Ein
       Kraftworkout ohne Pausenschritt waere auf der Uhr unbrauchbar, deshalb
       ist fail-closed hier die schlechtere Wahl.
     - Mehrere Saetze ⇒ RepeatGroupDTO mit numberOfIterations und der BELEGTEN
       Bedingung iterations (#7). Ein Einzelsatz erzeugt keine Gruppe.
     - Die Reihenfolge kommt AUSSCHLIESSLICH aus dem normalisierten
       Datenvertrag; der Exporter enthaelt kein einziges .sort().
     - row und squat melden ihr Rueckweg-Risiko als Warnung mit Gate G2 —
       und K4 leitet daraus KEINE Rueckkanalzuordnung ab (das Modul kennt
       fromGarmin gar nicht).
     - hip_thrust nutzt die Bankvariante #1. Die Entscheidung steht in der
       Zuordnungstabelle, nicht im Exporter — der Exporter kennt den Namen
       „hip_thrust" nirgends.

   EIN FEHLER BEIM BAUEN, gefunden und behoben: Der Datenvertrag reicht
   bewusst keine unbekannten Felder durch (v8-321) — ein an der Rohzeile
   mitgegebener `slug` ueberlebt die Normalisierung also NICHT. Der erste
   Entwurf las ihn von der normalisierten Zeile und fand nie einen. Jetzt wird
   die Zuordnung exerciseId -> slug VOR der Normalisierung aus der Rohliste
   gesammelt — nicht ueber den Listenindex, der sich verschiebt, sobald der
   Vertrag eine Zeile abweist.

   EINE LEHRE ZU DEN MUTATIONSPROBEN, die ich festhalte: Eine Probe, deren
   Suchtext nicht trifft, aendert nichts — und liest sich dann exakt wie ein
   gruener Test. Genau das ist mir bei „Sport-ID als Wahrheit festgeschrieben"
   passiert (falsche Einrueckung im Suchtext). Seither prueft die Probe
   ZUERST, ob sie ueberhaupt gegriffen hat, und meldet sonst ausdruecklich
   „kein Aussagewert". Nach der Korrektur: 15 Proben, 15 rot. Drei erzeugten
   zunaechst einen Absturz statt lesbarer roter Zeilen — defensiv nachgezogen.

   Tests: supabase/tests/garmin_workout_export_test.mjs (102, X1-X14).
   Gesamtsuite 250/0 (7 uebersprungen), Kohorten-Pin 023ee59b unveraendert.

   NICHT IN DIESER RUNDE: kein Push, keine Persistenz, keine Auth — das Modul
   enthaelt weder supabase- noch Token- noch repos-Bezuege. K9 bleibt getrennt.

   ---------------------------------------------------------------
   GARMIN-UEBUNGSZUORDNUNG (2026-08-12) · v8-324, K3:
   Gians MVP-Kernset (O2) gegen den OFFIZIELLEN Garmin-Katalog nachgewiesen.
   Ergebnis vorweg: 10 von 10 zugeordnet, keine Luecke, drei ausdrueckliche
   Variantenwahlen.

   ZUERST DIE VORFRAGE: Existieren die zehn Slugs ueberhaupt?
   Alle zehn stehen so in den echten Seeds aus 0003/0006 — bench_press,
   overhead_press, pullup, lat_pulldown, row, squat, leg_press,
   romanian_deadlift, leg_curl, hip_thrust. Keiner ist erfunden. Der Test
   prueft das gegen den Migrationstext, nicht gegen eine Liste in meinem Kopf.

   NACHWEISGRUNDLAGE
   Offizieller Garmin FIT SDK Profile-Katalog, Fassung 21.213.0 (PyPI-Paket
   garmin-fit-sdk): 51 Kategorien mit Code, 1846 Uebungsnamen. Vollstaendig
   abgelegt als supabase/tests/fixtures/garmin-fit-catalog-21.213.0.json —
   NICHT zur Laufzeit geladen. Weil die Datei ALLE 1846 Namen enthaelt und
   nicht nur die zehn zugeordneten, ist der Nachweis nicht zirkulaer; eine
   Mutationsprobe, die den Katalog auf die Zuordnung zurechtschneidet, faellt
   sofort durch.

   KORREKTUR AN MEINER EIGENEN FRUEHEREN RECHERCHE (die dritte dieser Art)
   Ich hatte als Zweitquelle `garminconnect/exercises.py` mit 1527 Uebungen
   genannt. Diese Datei existiert in KEINER geprueften Paketfassung — 0.2.20,
   0.2.25, 0.2.28 und 0.3.2 enthalten sie alle nicht. Die Angabe war falsch.
   Der Uebungspicker von Garmin Connect ist ueber connect.garmin.com per
   robots.txt gesperrt und damit hier nicht abrufbar. Es ist also genau EINE
   Quelle nachgewiesen — die offizielle. Das steht als [OFFEN-1] im Modul und
   wird vom Test erzwungen: `secondSource: null` darf nicht stillschweigend
   auf „vorhanden" gesetzt werden.

   DER WICHTIGSTE FUND
   Der exakte Name „overhead_press" EXISTIERT im Katalog — aber ausschliesslich
   unter der Kategorie `sandbag` (#10). Ein reiner Namensabgleich, wie ihn der
   Plan ausdruecklich verbietet, haette Gians Schulterdruecken auf eine
   Sandsack-Uebung gelegt. Genau deshalb lautet die Entscheidungsregel „exakter
   Name IN DER FACHLICH RICHTIGEN KATEGORIE"; die Kategorie entscheidet mit.
   Der Test prueft beides: dass die Falle wirklich existiert, und dass das
   Mapping ihr nicht aufgesessen ist.

   ENTSCHEIDUNGSREGEL (einheitlich, nicht von Fall zu Fall)
     1. Exakter Name in der fachlich richtigen Kategorie ⇒ nehmen.
        (Erlaubt ist dabei genau eine Schreibweisen-Differenz im Unterstrich:
        ORVIA fuehrt `pullup`, Garmin `pull_up` — identische Buchstabenfolge.
        Der Test prueft, dass diese Normalisierung eng genug ist, um
        `barbell_row` bei `row` NICHT durchzulassen.)
     2. Kein exakter Name ⇒ EINE Variante ausdruecklich festlegen und
        begruenden (variantChoice). Betrifft drei Eintraege:
          bench_press    -> bench_press/barbell_bench_press
          overhead_press -> shoulder_press/barbell_shoulder_press
          hip_thrust     -> hip_raise/barbell_hip_thrust_with_bench
     3. Weder noch ⇒ ambiguous/unmapped. Es wird nie geraten.

   GIANS VIER ZWEIFELSFAELLE, einzeln beantwortet
     row               exakter Name in der Kategorie `row` (#36) vorhanden ⇒
                       mapped. ABER der Rueckweg ist der wacklige Teil (s. u.).
     pullup            exakter Name (#38); der gleiche Name unter `suspension`
                       ist der Schlingentrainer und wird durch die Kategorie
                       getrennt ⇒ mapped.
     romanian_deadlift exakter Name, kategorieuebergreifend genau EIN Treffer
                       ⇒ mapped, kein Zweifelsfall.
     hip_thrust        kein exakter Name; genau zwei Eintraege, Boden (#0) und
                       Bank (#1), beide mit Langhantel. Festgelegt auf die
                       Bankfassung, weil der Hip Thrust definitionsgemaess mit
                       aufliegendem Oberkoerper ausgefuehrt wird — die
                       Bodenfassung ist fachlich eine Glute Bridge. Benannte
                       Entscheidung, mit einer Zeile umzustellen.

   WAS ICH NICHT VERSCHWEIGE: DER RUECKWEG
   Bei `row` und `squat` exportieren wir den NEUTRALEN Katalognamen. Die Uhr
   wird beim Ruecksync sehr wahrscheinlich eine konkrete Fassung melden
   (`barbell_row` #45, `barbell_back_squat` #6). Der Export funktioniert; der
   Rueckweg findet dann keine Zuordnung und meldet `unresolved` statt zu
   raten — was richtig ist, aber Handarbeit bedeutet. Beide sind als
   returnVariantRisk 'high' [A] markiert und werden im Testbericht NAMENTLICH
   ausgegeben. Aufloesen kann das nur der Geraetetest G2. Der saubere Ausweg
   waere, „Rudern" und „Kniebeuge" in der ORVIA-Bibliothek in die tatsaechlich
   trainierte Fassung aufzuteilen — das ist eine Bibliotheks-, keine
   Mappingfrage, und deshalb hier NICHT nebenbei entschieden.

   EIGENE TESTLUECKEN DIESER RUNDE (offen berichtet)
   Von 12 Mutationsproben blieb EINE zunaechst gruen:
     V7: Das Melden von `ambiguous`/`unmapped`-Luecken liess sich entfernen,
         ohne dass ein Test rot wurde — weil dieser Zweig bei 10/10 zugeordnet
         NIE LAEUFT. Gian hat diese Zustaende ausdruecklich gefordert, also
         muessen sie geprueft sein, BEVOR sie zum ersten Mal gebraucht werden.
         Jetzt haengt der Test zwei Pruefeintraege voruebergehend ein, prueft
         Zaehlung, Klartextgrund, Export- und Rueckwegverhalten, und weist
         danach nach, dass sie restlos entfernt sind.
   Zwei weitere Proben erzeugten einen Absturz statt lesbarer roter Zeilen
   (unvollstaendige Katalogdatei) — defensiv nachgezogen.

   Tests: supabase/tests/garmin_exercise_map_test.mjs (93, G1-G9). Der Bericht
   gibt Abdeckung, Zuordnungen mit Codes, offene Luecken, Variantenwahlen und
   Rueckweg-Risiken NAMENTLICH aus. Gesamtsuite 249/0 (7 uebersprungen),
   Kohorten-Pin 023ee59b unveraendert.

   NICHT IN DIESER RUNDE: kein Exporter (K4), kein Push (K5). K9 bleibt
   getrennt — training_plan_exercises und startPlannedWorkout werden nicht
   nebenbei umgebaut, der K2-Pfad bleibt unangetastet.

   ---------------------------------------------------------------
   KRAFTPLANUNG SICHTBAR UND BEARBEITBAR (2026-08-12) · v8-323:
   K2 als VOLLE Nutzerkette — Anzeige und Editor in derselben Runde, weil eine
   Anzeige ohne Eingabe wieder etwas waere, das nichts tut.

     Planeditor -> user_week_plans -> Reload -> Wochenplananzeige
       -> Sessionstart -> workout_exercises

   ANZEIGE
   Die Gym-Karte zeigt jede geplante Uebung mit Name, Saetzen,
   Wiederholungsbereich, Zielgewicht und Pause. Ein Item ohne Vorgaben erzeugt
   KEIN leeres Listengeruest — Altbestand sieht unveraendert aus.

   Die Uebungsnamen liegen in der DB-Tabelle `exercises`, der Wochenplan
   rendert aber SYNCHRON. Deshalb ein Namens-Cache: einmal ueber das echte
   exerciseRepository laden, in localStorage spiegeln (traegt den ersten
   Anstrich nach einem Neustart und offline), danach synchron nachschlagen und
   genau EINMAL neu zeichnen, wenn die Liste eintrifft. Eine Kennung, die sich
   nicht aufloesen laesst, wird als unbekannt MARKIERT und im Klartext gezeigt
   — es wird kein Name aus der Bibliothek untergeschoben.

   EDITOR
   Uebungen lassen sich hinzufuegen, bearbeiten, sortieren und entfernen. Die
   Auswahl kommt AUSSCHLIESSLICH aus der kanonischen Bibliothek; ist sie nicht
   erreichbar, gibt es keine Ersatzliste und kein Freitextfeld, sondern einen
   offenen Hinweis. Der Zustand liegt ausschliesslich in
   _planEdit[di][ii].plannedExercises — kein zweites UI-Modell.

   Alle vier Listenoperationen sind REIN und liegen im Datenvertrag
   (strengthPlan.insert/remove/move/updateExerciseAt), nicht in der
   Oberflaeche. Fail-closed beim Bearbeiten heisst hier: schlaegt die Pruefung
   fehl, kommt die UNVERAENDERTE Liste zurueck — eine ungueltige Eingabe in
   Zeile 2 darf die Zeilen 1 und 3 nicht mitreissen. Und jede Ablehnung wird
   BEGRUENDET angezeigt; stilles Nichtstun waere schlimmer als ein Fehler.

   Die Satzanzahl beim Hinzufuegen kommt aus einem sichtbaren, vorbelegten
   Eingabefeld — nicht aus einem stillen Standardwert im Code. Ein
   vorausgefuellter Wert, den der Nutzer sieht und aendern kann, ist etwas
   anderes als eine geratene Konstante. Wird das Feld geleert, entsteht KEINE
   Uebung, und der Grund steht daneben.

   ZWEI FEINHEITEN, die leicht falsch geworden waeren
   - 0 kg und „keine Vorgabe" sind NICHT dasselbe. 0 bedeutet ausdruecklich
     ohne Zusatzlast (Klimmzuege, Liegestuetz) und wird als „ohne Zusatzlast"
     angezeigt; keine Vorgabe bleibt null und erscheint gar nicht. Beides
     laeuft unveraendert bis in workout_exercises durch — geprueft.
   - Ein geleertes Zahlenfeld heisst „keine Vorgabe" (null), nicht 0. Eine
     unlesbare Eingabe wird abgelehnt und benannt, nicht stillschweigend
     verworfen. Komma wird als Dezimaltrenner verstanden.

   EIGENE FUNDE DIESER RUNDE (offen berichtet)
   - Von 12 Mutationsproben blieben ZWEI zunaechst gruen:
       U4:  Ich hatte nur die beiden fruehen Abbruchgruende (keine Uebung
            gewaehlt / keine Satzanzahl) geprueft, nicht die Ablehnung durch
            den Datenvertrag selbst. Eine Mutation, die die Fehlermeldung fuer
            „Obergrenze erreicht" entfernte, blieb unbemerkt. Nachgetragen:
            21. Uebung wird verhindert UND begruendet.
       U12: Die CSS-Zusage prueft, dass die Markierung fuer unbekannte
            Uebungen eine eigene Darstellung hat — sie traf aber auch auf das
            leere ::before-Geschwister zu. Verschaerft auf „setzt eine eigene
            Farbe".
     Beide nach der Schaerfung rot.
   - gm2_plan_parity_test stuerzte ab, weil der isoliert ausgewertete
     renderGMPlan-Block den neuen Helfer nicht kannte. Fixture ergaenzt — mit
     Begruendung, warum sie hier bewusst '' liefert (dieser Test prueft die
     STRUKTUR der Planseite; die Uebungsanzeige liegt innerhalb von
     .session-main und beruehrt die geprueften Blockklassen nicht).

   Tests: supabase/tests/strength_plan_ui_e2e_test.mjs (80, E1-E13) faehrt die
   volle Kette mit den ECHTEN Modulen ab — Editor aus ui.js, Datenvertrag,
   plan-domain, workout-store mit echter offline-queue; gefaelscht sind nur
   Supabase, IndexedDB und ein minimaler DOM. Darin auch: der Session-Snapshot
   friert ein (eine spaetere Planaenderung erreicht ihn nicht), und Online-
   und Offline-Pfad schreiben am ENDE der Nutzerkette dieselbe Feldmenge.
   Gesamtsuite 248/0 (7 uebersprungen: brauchen eine echte Supabase-Instanz),
   Kohorten-Pin 023ee59b unveraendert.

   BEWUSST NICHT IN DIESER RUNDE: kein Garmin-Export, kein Uebungsmapping
   (K3/K4 folgen getrennt). Der Wochenplan-Editor ist die einzige Eingabe;
   `training_plan_exercises` bleibt weiterhin unbenutzt und
   `startPlannedWorkout` weiterhin ohne Aufrufer — beide sind ein eigener
   Aufraeumschritt (K9) und werden nicht nebenbei mitgeaendert.

   ---------------------------------------------------------------
   DIE KRAFTVORGABE KOMMT WIRKLICH AN (2026-08-12) · v8-322:
   Ein externer Audit gegen den Mac-Checkout hat v8-321 geprueft — und er hat
   in einem zentralen Punkt RECHT. Ich habe in v8-321 mit Migration 0035 die
   Spalte `target_weight_kg` angelegt und die Runde als fertig gemeldet. Es
   gab aber KEINEN EINZIGEN Schreibpfad, der sie fuellt:
     - js/repos/trainingPlanRepository.js addPlanExercise: Feld fehlte
     - js/repos/workoutRepository.js addExercise: Feld fehlte
     - js/workout-store.js buildExerciseRow (Offline): Feld fehlte
   Der Datenvertrag konnte ein Zielgewicht ausdruecken, es waere nur nirgends
   gelandet. Das ist genau die Klasse „gebaut, aber nicht angeschlossen", die
   Gian bei den 59 % Engine-Modulen zu Recht beanstandet hat — und der Plan
   verlangt in K1 ausdruecklich „vorhandene Sollwerte vollstaendig durch
   Online- UND Offline-Schreibpfad fuehren". Das habe ich nicht getan. Mein
   Satz „bewusst nicht gebaut: Oberflaeche" hat das verdeckt: die fehlenden
   Schreibpfade waren keine Oberflaeche, sondern unfertiges K1.

   ZWEI WEITERE BEFUNDE DESSELBEN AUDITS, ebenfalls bestaetigt:
   - Der Offline-Builder verlor gegenueber dem Online-Mapper still
     `target_rpe`, `completed` und `replaced_by_exercise_id`
     (workout_exercises) sowie `plan_id`, `plan_day_id` und
     `perceived_effort` (workout_sessions). Wer offline arbeitete, verlor
     diese Angaben DAUERHAFT — die Queue schreibt die Payload unveraendert
     durch, also kann kein spaeterer Sync sie nachholen. `perceived_effort`
     schrieb ueberhaupt kein Pfad.
   - Der Plan-Snapshot trug nur t/l/d. Die geplanten Uebungen gingen beim
     Sessionstart verloren; der einzige Pfad, der ueberhaupt Planuebungen
     anlegte (startPlannedWorkout), hat weiterhin NULL Aufrufer. Der echte
     Weg (startPlannedUnit -> workoutUI.startSport -> startFreeWorkout) legte
     grundsaetzlich eine leere Session an.

   WAS JETZT DA IST
   - Zielgewicht in ALLEN drei Schreibpfaden, online wie offline, plus im
     DTO von workout-store.addExercise. Fehlt die Vorgabe, wird NULL
     geschrieben — kein Ersatzwert. 0 kg ueberlebt als eigener Wert
     (Koerpergewichtsuebung), es wird nicht zu NULL zusammengefaltet.
   - Offline-Paritaet geschlossen. Die drei Session-Felder fahren NUR mit,
     wenn sie belegt sind: als stille NULL koennten sie beim zweiten Upsert
     derselben client_session_id einen bereits gesetzten Wert ueberschreiben.
   - applyPlannedExercises(): die im Snapshot mitgereichten Kraftvorgaben
     werden beim Start zu echten Uebungen der Session — mit Saetzen,
     Wiederholungsbereich, Zielgewicht, Pause. Das Ergebnis
     {planned, applied, failed} wandert ins Startresultat, damit eine
     misslungene Uebernahme GEMELDET und nicht verschluckt wird. Der
     Anzeigename ist bewusst fail-open (offline gibt es die Bibliothek
     nicht), die Uebung selbst nicht: die exercise_id ist die Wahrheit.
   - startPlannedUnit und markPlannedDone haengen die geplanten Uebungen an
     den Plan-Snapshot — aber NUR, wenn tatsaechlich etwas geplant ist. Eine
     Laufeinheit bekommt kein leeres Feld in den unveraenderlichen Anker.
   - startPlannedWorkout uebernimmt das Zielgewicht ebenfalls. Der Pfad
     bleibt unaufgerufen; er soll aber nicht falsch bleiben, wenn er
     spaeter angeschlossen wird.

   DER EIGENTLICH WERTVOLLE TEST
   P1 prueft nicht „schreibt Feld X?", sondern die EIGENSCHAFT: Online-Mapper
   und Offline-Builder muessen fuer dieselbe Eingabe dieselbe Spaltenmenge
   erzeugen. Beide Wege werden dafuer wirklich durchlaufen — der Offline-Weg
   ueber die ECHTE offline-queue.js mit IndexedDB-Shim, inklusive Flush gegen
   einen Supabase-Fake. Diese eine Zusage haette den Fund vom 12.08. vorweg-
   genommen und faengt die ganze Klasse kuenftig ab.

   Beim Bau des Shims eigener Fehler gefunden: `onupgradeneeded` feuerte
   nicht, offline-queue.js legte seine Indizes nie an, und
   pendingForCurrentUser() lieferte 0 Zeilen, obwohl 2 im Store lagen. Ein
   Test, der still nichts prueft, waere schlimmer als keiner — behoben.

   Tests: supabase/tests/strength_target_wiring_test.mjs (42, P1-P10),
   11 Mutationsproben, alle 11 SOFORT rot (keine Nachschaerfung noetig; zwei
   erzeugten zunaechst einen Absturz statt einer lesbaren roten Zeile —
   defensiv nachgezogen). Gesamtsuite 247/0 (7 uebersprungen: brauchen eine
   echte Supabase-Instanz), Kohorten-Pin 023ee59b unveraendert.

   OFFEN UND BEWUSST NOCH NICHT GEBAUT: Die Uebungen sind im Wochenplan noch
   NICHT SICHTBAR, und es gibt noch keine Oberflaeche, um sie anzulegen —
   summarizePlanned() hat weiterhin keinen Aufrufer. Das ist der naechste
   Schritt (K2-Oberflaeche) und wird als solcher benannt, nicht als erledigt.

   ---------------------------------------------------------------
   KRAFT-ZIELWERTE UND IDENTITAETSKETTE (2026-08-12) · v8-321:
   Erster gebauter Schritt des Kraftplans v2 (Phase A, Bausteine K0-Spike +
   K1 + minimaler K2-Datenvertrag). NOCH KEINE Oberflaeche und NOCH KEIN
   Garmin-Push — beides kommt in eigenen Runden.

   ZWEI KORREKTUREN AN MEINEN EIGENEN FRUEHEREN AUSSAGEN
   (1) Ich hatte behauptet, der Garmin-Worker liege nicht in diesem Repository
       und der Zugang sei die wichtigste offene Entscheidung (O1). Falsch: der
       Worker liegt unter garmin-worker/ — FastAPI, Fernet-verschluesselte
       Tokens, 15 eigene Testdateien, Supabase-JWT als Nutzeridentitaet.
   (2) Ich hatte Risiko R1 (garth-Login seit 27.03.2026 abgekuendigt) als P0
       eingestuft und empfohlen, es VOR allem anderen zu beheben. Auch falsch:
       requirements.txt pinnt garminconnect==0.3.2, und diese Fassung benutzt
       garth GAR NICHT MEHR — sie hat auf den mobilen SSO-Fluss mit nativen
       DI-OAuth-Bearer-Tokens gewechselt (nachgeprueft im Rad selbst: kein
       einziger garth-Import, nur curl_cffi/requests/ua-generator).
       R1 in der Form, in der ich es aufgeschrieben habe, trifft dieses
       Projekt nicht. Was BLEIBT, ist kleiner und anders: die Bibliothek
       schreibt Tokens in einem neuen Format und verlangt nach dem Umstieg
       einmalig einen frischen Login. Ob der gespeicherte Tokenbestand des
       Workers noch aus der Zeit davor stammt, laesst sich nur an der
       laufenden Instanz feststellen — das bleibt der offene K0-Rest.

   BEFUND DES REPO-AUDITS (belegt, nicht aus dem Plan uebernommen)
   - Eine Lastvorgabe existierte NIRGENDS. training_plan_exercises und
     workout_exercises enden bei planned_sets/min_reps/max_reps/target_rir/
     target_rpe/rest_seconds. `targetWeightKg` in js/nutrition.js ist
     KOERPERgewicht, `targetLoad` in js/engine/progression.js ist systemische
     Tageslast; beides ist etwas anderes und wird nie in eine Spalte
     geschrieben. Ein Kraftplan "4 x 6-8 @ 80 kg" war schlicht nicht
     speicherbar.
   - Eine Gym-Karte im Wochenplan ist {t:'Gym', l:<Split>, d:'45 min'} — und
     `d` ist eine KONSTANTE aus gpG() (js/ui.js:239). Die Karte konnte gar
     nichts anzeigen, weil es nichts zu lesen gab.
   - workout_sets.set_type hatte KEIN CHECK; die Satztypliste lebte nur im
     Client (js/training-domain.js:75). Ein importierter Garmin-Satz mit
     unbekanntem Typ waere unbemerkt gelandet.
   - Es gab keine persistente Verbindung Occurrence -> Garmin-Workout ->
     Garmin-Aktivitaet. Der Rueckkanal haette auf Datum/Titel raten muessen —
     genau die Heuristik, die der Plan verbietet.
   - startPlannedWorkout (js/workout-store.js:124) hat NULL Aufrufer, und
     training_plan_exercises wird produktiv weder gelesen noch geschrieben.
     Der einzige Pfad, der Planuebungen in eine Session gebracht haette, war
     nie angeschlossen.

   WAS JETZT DA IST
   - Migration 0035: target_weight_kg auf BEIDEN Ebenen (Plan und Session —
     sonst ginge die Vorgabe beim Sessionstart verloren und K7 haette auf der
     Ist-Seite keine Referenz). set_type-CHECK als NOT VALID, damit neue
     Zeilen geprueft werden und der Altbestand nicht rueckwirkend abgelehnt
     wird. workout_sets bekommt Herkunft, Pruefstatus, externe Satzidentitaet,
     Schrittindex, Rohwerte und Erkennungswahrscheinlichkeit. Neue Tabelle
     strength_workout_exports traegt die vollstaendige Identitaetskette
     inklusive step_bindings — ohne sie waere ein zurueckkommender
     wktStepIndex eine Zahl ohne Bedeutung.
   - js/engine/strength-plan.js: der Datenvertrag. Rein, versioniert
     (strength-plan@1), fail-closed. Eine fehlende Satzanzahl wird ABGEWIESEN
     statt auf 3 gesetzt; ein negatives Zielgewicht wird abgewiesen statt auf
     0 gezogen; ein verdrehter Wiederholungsbereich wird abgewiesen statt
     stillschweigend getauscht. Genau zwei Faelle werden ausgelegt statt
     abgewiesen, und beide sind Bedeutungs- statt Ratefaelle: eine einzelne
     Wiederholungsgrenze meint eine feste Wiederholungszahl, und eine fehlende
     Reihenfolge meint die Listenposition.
   - estimateDurationMin() loest die Konstante '45 min' ab: dieselbe
     Beispieleinheit ergibt 25 min, eine grosse 95 min. Die Faustwerte
     (40 s Arbeitszeit je Satz, 60 s Uebungswechsel, 120 s Ersatzpause) sind
     im Code als [A] gekennzeichnet — sie sind gesetzt, nicht gemessen.
   - plannedVolumeKg() folgt dem plan-quality-Prinzip aus v8-316: eine Uebung
     ohne Zielgewicht zaehlt NICHT als 0 kg, sondern gilt als nicht bewertbar.

   EIGENE FUNDE UND TESTLUECKEN DIESER RUNDE (offen berichtet)
   - js/engine/plan-quality.js stand seit v8-316 NICHT im Offline-Vorrat des
     Service Workers, obwohl index.html es laedt. Offline waeren die sechs
     Planqualitaets-Kacheln stumm ausgefallen, und kein Test haette es
     bemerkt. Nachgetragen; Abschnitt S15 des neuen Tests prueft ab jetzt
     JEDES in index.html geladene Skript gegen den ASSETS-Vorrat (env.js ist
     die einzige, bewusste Ausnahme).
   - Zwei Mutationsproben blieben zunaechst GRUEN, beide aus derselben Familie:
     eine zweiseitige Zusage war nur einseitig geprueft.
       M4:  "fehlendes Zielgewicht zaehlt als 0 kg" blieb unentdeckt, weil
            mein Testfall gar keine Wiederholungen hatte und schon an der
            vorherigen Bedingung ausschied. Nachgeschaerft auf den
            unterscheidenden Fall (Wiederholungen JA, Gewicht NEIN).
       M10: "ein manueller Satz darf keinen Importstatus tragen" war nicht
            geprueft — nur die Gegenrichtung. Nachgetragen.
     Beide Proben werden nach der Schaerfung rot.
   - Insgesamt 13 Mutationsproben, 11 sofort rot, 2 nach Nachschaerfung rot.

   BEWUSST NICHT IN DIESER RUNDE (Plan §12 und §6 Phase C)
   Keine Oberflaeche zum Anlegen von Uebungen, kein Garmin-Uebungsmapping,
   kein Exporter, kein Push, kein Rueckimport. Der Datenvertrag steht bewusst
   VOR der Oberflaeche, damit Wochenplan, Editor, Sessionstart und Export
   spaeter dieselbe Form lesen und nicht drei Varianten entstehen.

   Tests: supabase/tests/strength_plan_contract_test.mjs (94, S1-S15),
   Gesamtsuite 246/0 (7 uebersprungen: brauchen eine echte Supabase-Instanz),
   Kohorten-Pin 023ee59b unveraendert (kein gepinntes Engine-Modul beruehrt).

   ---------------------------------------------------------------
   WIEDEREINSTIEG NACH KRANKHEIT (2026-08-11) · v8-320:
   Letzter offener Punkt aus Gians Score-Liste. `illness` war ein Ja/Nein: an
   dem Tag, an dem der Haken verschwand, war man sofort wieder voll belastbar —
   der Score sprang von gedeckelt (55) auf ungebremst. Nach einem Infekt steigt
   die Belastbarkeit aber graduell, und genau die ersten Tage danach sind die,
   an denen zu frueh wieder intensiv trainiert wird.

   JETZT: recoveryCtx leitet aus dem bereits laufenden 28-Tage-Durchlauf ab, wie
   viele Tage die letzte Krankheit her ist und wie lange die ZUSAMMENHAENGENDE
   Phase gedauert hat (eine Erkaeltung vor drei Wochen bremst heute nichts).
   illnessReturnWindow() bildet daraus ein Fenster:
     - Obergrenze steigt LINEAR von 68 zurueck auf 100,
     - der Tageszustand bleibt im Fenster mindestens YELLOW,
     - der Grund steht im Klartext bei den Begruendungen
       („Wiedereinstieg nach Krankheit (Tag 2 von 4)").
   Beispiel nach 4 Krankheitstagen: 68 · 76 · 84 · 92 · frei.

   [A] FAUSTREGEL, ausdruecklich als solche gekennzeichnet: ETWA EIN
   ZURUECKHALTENDER TAG JE KRANKHEITSTAG, gedeckelt bei 7. Das ist die in der
   Sportpraxis verbreitete Groessenordnung fuer den Wiedereinstieg nach einem
   banalen Infekt — KEIN gemessener Wert und keine Diagnose. Der Deckel bei 7
   verhindert, dass eine lange Krankheit wochenlang bremst.

   EIGENER ENTWURFSFEHLER, BEIM DURCHMESSEN GEFUNDEN: Der erste Entwurf hatte
   ein zusaetzliches `blocksHard` fuer das erste Drittel des Fensters. Das war
   eine SCHEINUNTERSCHEIDUNG — das Fenster setzt den Zustand ohnehin auf
   mindestens YELLOW, und YELLOW erlaubt per Definition keine harten Einheiten.
   Das Feld haette eine Feinsteuerung suggeriert, die es nicht gibt. Entfernt.

   Test: daily_score_continuity_test (101, +21). Fuenf Mutationsproben; eine
   blieb ZUNAECHST gruen — zum zweiten Mal dieselbe Klasse: der Test baut den
   checkin selbst und prueft damit nur calc.js, waehrend die VERDRAHTUNG in
   ui.js liegt. Faellt sie weg, bleibt calc.js korrekt und der Test gruen,
   obwohl im Produkt nichts mehr passiert. Jetzt als Kettenvertrag gedeckt.
   Kein Kohorten-Pin betroffen: 023ee59b.

   ---- vorher ----
   v8-319 · GEMESSENE SCHLAFDATEN STATT ERSATZWERTE (2026-08-11):
   Letzter offener Punkt aus Gians Score-Liste — und dabei ein Befund, der
   v8-318 nachtraeglich einordnet:

   1. sleep_need_min HATTE NULL VERWENDUNGSSTELLEN. Der Worker synchronisiert
      Garmins EIGENEN, personalisierten Schlafbedarf seit Langem. Im Produkt
      wurde er nirgends gelesen. Der 28-Tage-Median aus v8-318 war also ein
      Ersatz fuer etwas, das gemessen vorlag. Neue Rangfolge:
      GEMESSEN > eigener Median > fest (480). Ein unplausibler Messwert
      (<4 h oder >12 h) faellt auf den Median zurueck. Der 7–8-h-Deckel aus
      v8-318 gilt AUCH fuer den gemessenen Bedarf — die Begruendung ist
      dieselbe: chronischer Schlafmangel darf sich nicht selbst zur Norm
      erklaeren, und auch Garmins Bedarf folgt den Gewohnheiten.

   2. GARMINS SLEEP SCORE floss in KEINE Bewertung ein — er wurde nur
      angezeigt. Gians Vorgabe war ausdruecklich „der muss den Sleep Score
      bewerten". Jetzt als gemessene Schlafqualitaet im Score.
      DOPPELZAEHLUNG VERMIEDEN: Der Sleep Score enthaelt Dauer und Phasen
      bereits. Liegt er vor, TEILEN sich gemessene (9) und subjektive (5)
      Angabe das bisherige Gewicht 14 — die Messung fuehrt, das Empfinden
      bleibt als eigenstaendige Information (es traegt, was kein Geraet sieht).
      Ohne gemessenen Score behaelt die subjektive Angabe ihre vollen 14.

   3. SCHLAFPHASEN als eigener, kleiner Beitrag (Gewicht 6): Anteil aus Tief-
      und REM-Schlaf gegen die EIGENE Verteilung (Median 28 Naechte), nicht
      gegen eine Lehrbuchzahl. Der absolute Minutenwert haengt an der Dauer und
      steckt schon im Sleep Score; der ANTEIL relativ zur eigenen Norm ist die
      zusaetzliche Information. Wer von Natur aus eine niedrige Tief-/REM-Quote
      hat, bekommt auf SEINER Quote den Vollwert — gegen eine feste Zahl waere
      er dauerhaft abgewertet. Gewicht bewusst niedrig: die Phasenerkennung am
      Handgelenk ist die unsicherste der hier verwendeten Groessen.

   FAIL-CLOSED durchgehend: fehlender oder zu schmaler Metrik-Cache, weniger
   als 14 eigene Naechte, unplausible Werte ⇒ der jeweilige Beitrag entfaellt
   ersatzlos (die Gewichtung renormalisiert sich), nichts wird geschaetzt.

   Test: daily_score_continuity_test (80, +18). Fuenf Mutationsproben; zwei
   blieben ZUNAECHST gruen und deckten Testluecken auf: die Phasenprobe
   benutzte eine Quote (0,42) zu nah an einer denkbaren Lehrbuchkonstante
   (0,40) — beides ununterscheidbar, obwohl genau hier Gians Prinzip haengt;
   jetzt mit 0,26 und 0,58 geprueft. Und die Rangfolge-Zusage war ein
   Quelltextmuster, das auch ohne den gemessenen Zweig noch traf.
   Kein Kohorten-Pin betroffen: 023ee59b.

   ---- vorher ----
   v8-318 · DIE REFERENZEN WACHSEN MIT (2026-08-11):
   Zweite Haelfte von Gians Vorgabe: „Der Score darf nichts mit perfekten
   Werten zu tun haben … es gibt Daten, die sich mit der Zeit entwickeln, und
   das muss eingerechnet werden." Fuer HRV (hrvBase7/hrvSd28) und Ruhepuls
   (rhrBase, eigener Median) galt das laengst. Fuer Schlaf und Body Battery
   NICHT — und dort sass der eigentliche Dauerbremser:

   1. SCHLAFSCHULD MIT FEST VERDRAHTETEN 8 STUNDEN. sleepDebt rechnete
      `480 - x` fuer jeden Menschen gleich. Wer gewohnheitsmaessig 7 h
      schlaeft, sammelte JEDE Nacht 1 h „Schuld": 7 h pro Woche, Beitrag
      100 − 7·12 = 16 statt 100. Bei Gewicht 12 zieht das den Tagesscore
      dauerhaft um rund 8 Punkte — jeden Tag gleich, unbehebbar ausser durch
      8 h Schlaf jede Nacht. Das ist der zweite Grund fuer die konstante Zahl,
      die Gian beschrieben hat (nach dem Zustandsdeckel aus v8-317).
      Jetzt: Referenz ist der EIGENE Median der letzten 28 Tage.
      [A] BEWUSSTE ANNAHME: Die Referenz ist auf 7–8 h BEGRENZT. Ohne Deckel
      wuerde chronischer Schlafmangel sich selbst zur Norm erklaeren und die
      Schuld verschwinden — die Zahl waere angenehm und falsch. Wer gewohnt
      7 h schlaeft, wird an 7 h gemessen; wer chronisch 5 h schlaeft, weiter
      an 7 h. Die untere Grenze folgt der Erwachsenenempfehlung 7–9 h und ist
      damit die konservative Wahl.
   2. SCHLAFDAUER-SUBSCORE mit fester Rampe 5 h (=0) bis 8 h (=100). Mit
      eigener Historie zaehlt jetzt die Abweichung vom eigenen Bedarf, skaliert
      mit der EIGENEN Streuung (auf 30–120 min begrenzt, damit weder ein sehr
      regelmaessiger Schlaefer fuer 10 Minuten abgestraft wird noch eine
      chaotische Historie die Bewertung bedeutungslos macht). Mehr als der
      eigene Bedarf wird NICHT zusaetzlich belohnt — kein Ideal-Jagen.
   3. BODY BATTERY als Rohwert. Zwischen Personen nicht vergleichbar: wessen
      Morgenwert typischerweise bei 75 liegt, erreichte nie die vollen Punkte.
      Jetzt gegen den eigenen Median; auf oder ueber dem eigenen Normalwert
      = 100.

   FAIL-CLOSED: Jede Baseline braucht MINDESTENS 14 eigene Tage. Darunter
   bleibt sie null und es gilt exakt das bisherige Verhalten — ein neuer Nutzer
   bekommt keine Referenz aus drei Tagen. Altaufrufer von sleepDebt() ohne
   Bedarfsangabe rechnen unveraendert mit 480.

   WIRKUNG auf Gians typischen Tag (7 h gewohnt, 7 h geschlafen, BB 75, sonst
   unauffaellig): Readiness 85 → 94. Zusammen mit v8-317 ist die „ich komme nie
   ueber 85"-Decke damit an ihren beiden Ursachen behoben.

   BEWUSST NICHT GEBAUT: Gewicht als Tagesscore-Eingang. Das Koerpergewicht ist
   ein langsames Signal (Wochen) und gehoert zu Zielmachbarkeit und
   Energieverfuegbarkeit, nicht zur Tagesform — es taeglich in die Readiness zu
   rechnen wuerde Rauschen als Erholungssignal ausgeben. weightHint() bewertet
   es bereits an der richtigen Stelle.

   Test: daily_score_continuity_test (62, +17). Vier Mutationsproben; zwei
   blieben zunaechst gruen und deckten Testluecken auf: die 14-Tage-Schwelle
   lebt in ui.js und wurde vom Calc-Test gar nicht beruehrt (jetzt als
   Quelltext-Vertrag gedeckt), und die Body-Battery-Zusage prueft jetzt das
   BAUTEIL statt nur die Summe. Kein Kohorten-Pin betroffen: 023ee59b.

   ---- vorher ----
   v8-317 · DER TAGESSCORE WIRD STETIG (2026-08-11):
   Gians Messreihe, am Code REPRODUZIERT: Huftschmerz 0–10 ergab 79/79/79/79/
   64/64/44/44/44 — drei Werte statt einer Messung. Ursache in calc.js:
     applyDecisionCaps → {GREEN:100, YELLOW:79, ORANGE:64, RED:44}[state]
   Die angezeigte Zahl war die OBERGRENZE des Tageszustands. Weil die
   physiologische Readiness fast immer darueber lag, sah er wochenlang „79" —
   jede Verbesserung bei Schlaf, Stress oder HRV wurde von derselben Zahl
   abgeschnitten. Genau seine Beobachtung.

   FUENF FUNDE, alle bestaetigt und behoben:

   1. TREPPE ⇒ STETIGKEIT. Die Baender bleiben garantiert getrennt (ein
      ORANGE-Tag darf nie aussehen wie ein GREEN-Tag), aber die Obergrenze
      bewegt sich INNERHALB des Bandes stetig mit der tatsaechlichen Schwere
      (stateSeverity, pur, 0..1, jeder Beitrag gedeckelt). Neue Messreihe:
      91·89·87·85·74·60·42·40·35 — neun Werte statt drei.

   2. GARMINS HRV-KATEGORIEN. Garmin kennt Balanced · Unbalanced · Low · Poor.
      Ein 'Good' gibt es NICHT — der 100er-Zweig war toter Code, ueber den
      Statuspfad war bei 88 Schluss (eine Ursache der „ich komme nie ueber
      85"-Decke). 'Unbalanced' (leicht neben der eigenen Baseline) lag mit
      'Low' (deutlich darunter) gemeinsam auf 45; 'Poor' fiel ganz durch.
      DIE GEGENPROBE DECKTE AUF: 'Poor' landete dadurch in BESSEREN Zustaenden
      als 'Low', weil fuenf Stellen `hrv==='Low'` verglichen. Jetzt EIN Helfer
      (hrvBelowBaseline) fuer das ganze Produkt.

   3. MUSKELKATER IST REGIONAL. Beinmuskelkater 7/10 setzte auch an einem
      Oberkoerpertag ORANGE — und ORANGE verbietet Krafttraining komplett.
      Die Entscheidungsseite wusste die Region laengst (evaluateDomsImpact),
      Score UND Zustand nicht. Jetzt beide. Er verschwindet nicht ganz
      (systemische Ermuedung), aber er dominiert den Tag nicht mehr.

   4. SCHMERZ ZAEHLT, EGAL WO. readiness() kannte ausschliesslich m.knee.
      Gians Hueftschmerz lief in die ENTSCHEIDUNG, erreichte den ROHWERT aber
      nie — deshalb bewegte nur der Deckel die Zahl. ctx.painToday ist jetzt
      der groesste erfasste Schmerz ueber alle Regionen.

   5. 100 IST ERREICHBAR. Mit eigener HRV-Messreihe erreicht die Readiness 100;
      ein rundum guter Tag landet bei 99 statt bei der alten 85er-Decke.

   MITGEFANGEN: `hrvLowStreak` verglich `s===25` — den exakten alten Wert. Mit
   den korrigierten Kategorien haette ein Gleichheitsvergleich die Straehne
   still nie wieder erkannt; jetzt Schwelle (<=40).

   SICHERHEIT UNVERAENDERT: harte Deckel (Red Flags, Krankheit, Schmerz >=8)
   bleiben; die Baender ueberlappen nicht; RED < ORANGE < YELLOW < GREEN.

   Test: daily_score_continuity_test (45) gegen das ECHTE calc.js, end-to-end
   wie im Produkt verdrahtet. SECHS Mutationsproben. Zwei blieben ZUNAECHST
   gruen und deckten echte Testluecken auf: „Schmerz wieder nur Knie" (die
   Reihe variierte allein durch den Banddeckel weiter) und „harter Deckel
   entfernt" (ueber buildTrainingDecision ist er derzeit vom RED-Band
   subsumiert — er ist die Absicherung der FUNKTION gegen andere Aufrufer und
   wird jetzt direkt dort geprueft). Ein Bestandstest angepasst:
   gm61_contract brauchte den neuen Calc-Helfer als Fixture.
   Kein Kohorten-Pin betroffen: 023ee59b.

   ---- vorher ----
   v8-316 · PLANQUALITAET BEKOMMT EINEN RECHNER (2026-08-11):
   Die sechs Kacheln (Zielabdeckung · Erholungsverteilung · Belastungsbalance ·
   Zeitmachbarkeit · Sportbalance · Datenqualitaet) standen dauerhaft auf „—"
   mit Balken 0 %. ANDERS ALS bei v8-313/314 fehlte hier nicht die Verdrahtung,
   sondern der PRODUZENT: es existierte ausschliesslich der Validator
   engine-contracts.isPlanQuality(), der die sechs Feldnamen festschreibt.
   js/engine/plan-quality.js ist dieser Produzent — rein, versioniert, ohne
   DOM/Uhr/Zufall/Storage.

   DIE ENTSCHEIDENDE KONSTRUKTIONSFRAGE: Der Vertrag verlangt fuer JEDEN
   Subscore eine Zahl 0–100. Nicht jeder ist immer berechenbar — Sportbalance
   ist bei einer einzigen aktiven Sportart keine schlechte Bewertung, sondern
   GAR KEINE. Eine Zahl zu erfinden waere die Ersatzheuristik aus Bauplan
   §17.2. Loesung: jeder Subscore traegt zusaetzlich `applicable` und
   `evidence`; nicht bewertbare bekommen rating 'insufficient_data' (die Zahl
   bleibt 0, damit der Vertrag haelt — die WAHRHEIT steht im rating); die
   Gesamtnote wird AUSSCHLIESSLICH ueber die anwendbaren Subscores mit neu
   normierten Gewichten gebildet. Ein reiner Laeufer wird durch die fehlende
   Sportbalance also NICHT abgewertet — genau das prueft der Test. Sind unter
   60 % Gewicht bewertbar, ist das GANZE Ergebnis 'insufficient_data' statt
   einer Note aus zu wenig.

   DIE OBERFLAECHE SCHAUT AUF `applicable`, NICHT AUF DIE ZAHL: sonst stuende
   „0" fuer etwas, das gar nicht bewertet wurde. Nicht anwendbar ⇒ „—" plus
   Grund im Klartext („nur eine Sportart aktiv").

   ABGRENZUNG: planQualityChecks() (ui.js) bleibt unveraendert und liefert
   weiterhin Textwarnungen und die Note gut/moderat/riskant. Wo beide dieselbe
   Regel pruefen (Ruhetag, harte Tage hintereinander), ist sie BEWUSST identisch
   formuliert — zwei abweichende Urteile ueber denselben Plan waeren die
   Divergenz, die in v8-307 schon drei Erzeuger fuer eine Prescription
   hervorgebracht hat.

   EIGENER FEHLER, BEIM BAUEN GEFUNDEN: Der erste Entwurf verglich Sportarten
   per Teilstring — 'running' traf 'Laufen' nicht, ein Plan MIT Laufeinheit
   bekam faelschlich „Sportart fehlt im Plan". Jetzt ueber den EINEN kanonischen
   Normalisierer (trainingDomain.normSportStrict); fehlt er, ist der Subscore
   nicht anwendbar statt geraten. Genau davor warnt der eigene Dateikopf.

   Test: plan_quality_scores_test (39) gegen den ECHTEN Validator und das ECHTE
   trainingDomain. Fuenf Mutationsproben: nicht Anwendbares zaehlt mit 0 in die
   Note -> rot; Sportart wieder raten -> rot; Note trotz zu wenig Bewertbarem
   -> rot; UI zeigt die 0 statt „—" -> rot; Ruhetagsregel entschaerft -> rot.
   Kein Kohorten-Pin betroffen: 023ee59b.

   ---- vorher ----
   v8-315 · DIE WOCHE WIRD ADRESSIERBAR (2026-08-11):
   Gians Befund: „Jede Folgewoche sieht gleich aus." Ursache: der Plan-Renderer
   las activeWeekPlan() OHNE Wochenbezug. Der Blaetter-Versatz _wOff wirkte nur
   auf Datum und Ist-Aufloesung — der INHALT war immer die laufende Woche.
   Darin steckten ZWEI getrennte Probleme:

   1. WAHRHEIT (die schwerere Haelfte): user_week_plans ist nach week_key
      adressiert, weekPlanRepository.get(weekKey) existiert seit Langem. Lag
      fuer eine andere Woche ein EIGENER Plan vor — durch Engine-Aktivierung
      oder manuelle Aenderung —, wurde er NICHT gezeigt. Stattdessen die
      laufende Woche, beschriftet mit dem fremden Datum. Die Ansicht behauptete
      etwas, das nicht stimmte.
   2. STRUKTUR: PROFILE.weekPlan ist per Konstruktion eine WIEDERKEHRENDE
      Wochenstruktur. Ohne eigenen Plan fuer die Zielwoche ist sie die ehrliche
      Antwort — aber sie muss als VORSCHAU kenntlich sein.

   gmPlanForOffset(off) liefert jetzt {days, provenance, weekKey}. provenance
   ist Vertrag, nicht Kosmetik: 'planned_week' (eigener Plan dieser Woche),
   'recurring_preview' (wiederkehrende Struktur, noch nichts festgelegt),
   'loading', 'current'. Die Kopfnotiz benennt die Herkunft, statt pauschal
   „Vorschau" zu behaupten — bei einem echten Wochenplan waere dieser Text
   falsch.

   DIESE RUNDE ERZEUGT AUSDRUECKLICH KEINE WOCHENVARIATION. Eine in der
   Oberflaeche erfundene Progression waere die Ersatzheuristik, die Bauplan
   §17.2 verbietet. Periodisierung ist Stufe 10 und braucht die Engine — diese
   Runde macht sie erst MOEGLICH, indem es einen Ort gibt, an den eine
   Folgewoche ueberhaupt geschrieben werden kann.

   ZWEI RIEGEL, beim Bauen aufgefallen und getestet:
   a) KEINE BEOBACHTUNG FREMDER WOCHEN. gmObserveWeekPlan haengt den Plan an
      den Schatten-Snapshot mit weekId = HEUTIGE Woche. Eine Vorschauwoche
      darin waere eine unbemerkt falsche Kalibrierungsgrundlage.
   b) KEIN SCHREIBEN AUS DER VORSCHAU: kein saveProfile, keine ID-Vergabe,
      keine Selbstheilung — und die zurueckgegebene Woche ist eine Kopie,
      sonst wuerde Blaettern den gespeicherten Plan veraendern.

   EIGENER DEFEKT, VON DER TESTPROBE GEFUNDEN: Ohne kanonisches Modell
   entscheidet gmWeekPlanEnsure SYNCHRON (Cache=null). Der erste Entwurf gab
   danach blind 'loading' zurueck — die Ansicht haette dauerhaft „wird geladen
   …" gezeigt, obwohl nie etwas laedt. Jetzt wird nach dem Anstossen erneut
   geprueft.

   Test: week_addressable_plan_test (36) gegen das ECHTE plan-domain, mit
   injizierter Uhr (fester Dienstag) statt der Systemzeit. Vier Mutationsproben;
   die vierte („Referenz statt Kopie") blieb ZUNAECHST gruen, weil die Probe
   gegen eine unbeteiligte Konstante verglich statt gegen PROFILE.weekPlan
   selbst — Bezug korrigiert, danach faengt sie.
   ZWEI BESTANDSTESTS ANGEPASST, beide aus gutem Grund:
   - gm2_plan_parity: gmPlanForOffset lebt ausserhalb des GM2-Blocks und
     braucht ein Fixture am selben Vertrag — exakt wie unitPriority zuvor.
   - plan_week_nav: die Probe „Hinweis nur beim Blaettern" pruefte per
     ZEICHENABSTAND (200 Zeichen). Das ist eine Momentaufnahme der
     Formatierung, keine Eigenschaft (Bauplan §17.7). Jetzt strukturell:
     die Ausgabe muss IM Blaetter-Zweig liegen, plus Gegenprobe gegen einen
     zweiten, immer sichtbaren Hinweis.
   Kein Kohorten-Pin betroffen: 023ee59b.

   ---- vorher ----
   v8-314 · DIE ENGINE WIRD SICHTBAR — 2/n (2026-08-11):
   ADAPTIVE EINSCHAETZUNG. js/adaptive-card.js rendert seit v8-283 die volle
   Ausgabe des Schattenbetriebs: Anpassungsrichtung, Delta, Zielload,
   Sperrgruende, Auswahlgrund, Begruendung, Zielaussicht. Geschrieben wurde sie
   ausschliesslich in #adaptiveCard — direktes Kind von #tab-plan, das
   styles.css:3130 ausblendet — angestossen aus renderWeekPlan(), das nur vom
   ueberschriebenen renderPlan() gerufen wird. Zwei unabhaengige Sperren vor
   demselben Inhalt; der Nutzer hat diese Ausgabe nie gesehen.

   Der GM-Plan zeigt sie jetzt ueber DENSELBEN Renderer und DENSELBEN
   View-Vertrag (gmAdaptiveSection ist reine Weiterleitung). Bewusst KEIN
   Nachbau in ui.js: eine zweite Formatierung derselben Engine-Felder waere
   genau die Divergenz, die in v8-307 schon einmal drei Erzeuger fuer eine
   Prescription hervorgebracht hat. Die CSS-Regel bleibt unangetastet — sie
   haelt die gesamte Legacy-Planansicht zurueck, nicht nur diese Karte.

   FAIL-SOFT BLEIBT: ohne Beobachtung liefert render() den leeren String, dann
   entfaellt der Abschnitt ERSATZLOS — kein Titel ueber nichts. Sperrgruende
   und „vorlaeufig, wird nicht angewendet" werden ausdruecklich mit angezeigt:
   eine Empfehlung ohne ihren Sperrgrund waere eine Zusage, die die Engine
   nicht gibt.

   Test: adaptive_visibility_test (20) gegen den ECHTEN Renderer. Drei
   Mutationsproben: Abschnitt auch bei leerer Karte -> rot; Sperrgruende
   unterschlagen -> rot; ui.js baut die Karte selbst nach statt zu delegieren
   -> rot. Kein Kohorten-Pin betroffen: 023ee59b.

   ---- vorher ----
   v8-313 · DIE ENGINE WIRD SICHTBAR — 1/n (2026-08-11):
   Gians Befund: „Die Trainings-Engine hat gefuehlt noch gar nicht angefangen."
   Nachgemessen statt geschaetzt: von 13.923 Zeilen in js/engine/ steuern 8.182
   NICHTS. shadow-runner.js sagt es im eigenen Dateikopf: „v2 STEUERT NICHTS."

   ERSTE ANBINDUNG — ZIELPROGNOSE. Der Plan-Slot zeigte die String-Literale
   „vorsichtig — realistisch — optimistisch —" plus den Satz „erscheint mit der
   externen Trainingsengine". Diese Engine ist seit Langem im Haus:
     - performance-zones.forecast() liefert EXAKT dieses Tripel und hatte im
       gesamten Projekt NULL Aufrufer.
     - goal-feasibility.feasibility() (573 Zeilen) rechnet bei jedem Planlauf
       im Schatten mit; das Ergebnis wurde sogar als HTML gerendert
       (adaptive-card.js „Zielaussicht") — in #adaptiveCard, einem direkten
       Kind von #tab-plan, das styles.css:3130 ausblendet. Der zweite
       Renderpfad hing an renderWeekPlan(), das nur vom ueberschriebenen
       renderPlan() gerufen wird. Der Wert existierte, war aber doppelt
       unerreichbar.
   Der GM-Slot liest jetzt beide direkt (gmGoalForecastView/-Card), statt die
   CSS-Regel aufzuweichen — die haelt die gesamte Legacy-Planansicht zurueck.

   WAS BEWUSST GLEICH BLEIBT: Ohne belastbaren Leistungswert gibt es weiterhin
   KEINE Zahl. Der Evidenzvertrag ist unberuehrt — ein Wert OHNE Datum bleibt
   informational und darf nicht entscheiden (evidence.js usability()). Neu ist
   nur, dass der leere Zustand seinen GRUND nennt und den Weg zur Erfassung
   zeigt, statt auf eine externe Engine zu vertroesten, die es laengst gibt.
   Die Zielzeit wird gegen die KONSERVATIVE Korridorkante eingeordnet, nicht
   gegen den Punktwert — dieselbe Regel wie bei der Evidenzvererbung.

   Test: goal_forecast_wiring_test (31) gegen die ECHTEN Engine-Module, kein
   Mock des Rechners. Drei Mutationsproben: UI rechnet selbst statt zu lesen
   -> rot; Zielzeit gegen den Punktwert statt die konservative Kante -> rot;
   Ersatzwert im nicht-berechenbaren Zweig -> ZUNAECHST GRUEN. Diese dritte
   Probe deckte eine echte Testluecke auf: der Zweig „Leistung ok, aber
   Prognose nicht berechenbar" wurde von keinem Fall erreicht — genau dort
   saesse ein erfundener Wert am unauffaelligsten. Zwei Faelle ergaenzt, danach
   faengt die Probe. Kein Kohorten-Pin betroffen: 023ee59b.

   OFFEN UND BEWUSST NICHT IN DIESER RUNDE: engine_v2_plan bleibt AUS. Das
   Flag wuerde den v2-Scheduler den echten Wochenplan ueberschreiben lassen,
   bevor die Abnahme aus Bauplan §7b gelaufen ist (Fallabdeckung, nicht Zeit).
   Ebenfalls offen: Planqualitaets-Subscores (es existiert nur der Validator
   isPlanQuality, KEIN Rechner), Kraft (performance-resolver/-zones kennen nur
   running/cycling/swimming; kein Kraft-Wissenspaket) und die Wochenfolge
   (activeWeekPlan() nimmt keinen Wochenversatz — es gibt nur EINE Woche im
   Modell, deshalb sehen Folgewochen identisch aus). Reihenfolge dazu steht in
   docs/ENGINE-BAUPLAN-REST-2026-08.md.

   ---- vorher ----
   v8-312 · SPORT-ICON-IDENTITAET (2026-08-11):
   Gians Befund am Training-Start-Sheet (Screenshot, ohne Kommentar): "Fehler in
   diesem Screen". Code-Beleg statt Vermutung — gmOpenStartSheet's SPORTS-Array
   (ui.js) definierte Fussball/Mobility mit zweckentfremdeten Icon/Farb-Paaren:

   1. FARBKOLLISION: Fussball haengte an var(--ready) — derselben Gruenfarbe wie
      Laufen. Beide Kacheln im 7er-Sportraster waren farblich nicht zu unter-
      scheiden. Neue eigene Token --team (#DD7E4A) in styles.css.
   2. ICON-ZWECKENTFREMDUNG: Fussball nutzte 'target' (Zielscheibe) — dieses
      Icon ist im gesamten Produkt exklusiv fuer Ziel/Readiness/Meilenstein
      reserviert (Zielkarte, Readiness-Karte, Meilenstein-Kacheln). Mobility
      nutzte 'moon' + var(--sleep) — Icon UND Farbe sind ueberall sonst
      exklusiv "Schlaf" (Checkin-Karte, Erholungstrend, Schlaf-Kachel); direkt
      neben Schwimmen platziert las sich die Mobility-Kachel wie ein Schlaf-
      Symbol. Neue eigene Farbe --recovery (#CC8C9E) fuer Mobility.
   3. KEIN GERATENES ICON: Der Sport-Katalog (onboarding-sports-logic.js)
      definiert fuer Fussball/Mobility bereits die kanonischen Werte 'ball'/
      'stretch' — identisch zu den bereits produktiven Sprite-Symbolen
      #i-ball/#i-stretch (index.html), genutzt von ORVIA.activityConfig.
      sportIcon() in Aktivitaetenliste und Hub. gm-icons.js ist laut eigenem
      Dateikopf VERBATIM aus dem Golden Master und bleibt unangetastet; das
      Start-Sheet zieht die beiden fehlenden Glyphen ueber einen neuen, lokal
      begrenzten Helfer (GM_SPORT_ICON_EXTRA/gmSportTileIcon) als IDENTISCHES
      Pfad-Markup der Sprite-Symbole nach — keine neue Bildsprache.
   4. GESCHWISTERFEHLER MITGEFUNDEN UND MITGEFIXT: Bei der Verifikation von
      'ball' fielen zwei weitere, unabhaengige Whitelist-Luecken auf, die den
      identischen Sprite #i-ball fuer Fussball-Aktivitaeten silently auf
      'pulse' zurueckfallen liessen: js/activity.js SPRITE_ICONS
      (Aktivitaetenliste) und js/workout-ui.js HUB_SPRITE (Schnellstart-
      Kacheln) enthielten 'ball' nicht, obwohl der Sprite laengst existiert.
      Beide um 'ball' ergaenzt (ein-Token-Aenderungen, gleiche Fehlerklasse).
      HINWEIS FUER KUENFTIGE RUNDEN: dieselben zwei Whitelists fehlen fuer
      weitere Katalog-Sportarten (tennis/padel/badminton -> 'racket',
      rowing -> 'row', hiking -> 'hike', walking -> 'walk' — Symbole
      existieren bereits in index.html) — bewusst NICHT in dieser Runde
      mitgezogen, da groesserer, eigener Umsetzungsplan noetig (mehrere
      Sportarten, zwei Dateien, sichtbare Icon-Aenderung fuer bestehende
      Aktivitaeten). Separates Vorhaben.
   Test: gm3_activity_parity_test (60, +7 neue Assertionen: 7 paarweise
   verschiedene Kachelfarben, Fussball/Mobility-Icon-Fragmente positiv gegen
   das jeweils eigene Pfad-Markup gepruft — der globale icon()-Stub in diesem
   Testfile macht eine reine "ist nicht target/moon"-Pruefung wirkungslos,
   siehe Testkommentar) plus neuer sport_icon_whitelist_test (6, Quelltext-
   Vertragspruefung fuer SPRITE_ICONS/HUB_SPRITE). Drei Mutationsproben je
   Fund gefangen (Farbe zurueck, Icon zurueck, Whitelist-Eintrag entfernt) und
   Wiederherstellung verifiziert. Kein Kohorten-Pin betroffen (reine UI-
   Darstellung, keine Engine/Observer-Beruehrung): 023ee59b.

   ---- vorher ----
   v8-310b · DREI GETRENNTE KORREKTUREN (2026-08-10):
   Gians Befund: Ein frei gestartetes Krafttraining schien eine geplante
   Oberkoerper-Einheit zu erfuellen; eine versehentliche Erledigt-Markierung
   und die Activity selbst liessen sich nicht getrennt korrigieren.

   1. URSACHE HUB: Der geplante Start ignorierte die ausgewaehlte Sportart
      und band IMMER die erste heutige Planeinheit (Index 0). Jetzt wird eine
      eindeutig passende Sportart gesucht; kein/mehrere Treffer bleiben
      fail-closed und verweisen auf die konkrete Plankarte.
   2. FREI BLEIBT FREI: Eine Activity ohne explizite Occurrence erfuellt
      weiterhin keine Planeinheit — Tag+Sport allein wird nie geraten.
   3. DREI GETRENNTE KORREKTUREN: Activity loeschen (Tombstone), nur die
      Planzuordnung loesen (Activity/Saetze/Last bleiben), oder nur einen
      datenlosen plan_done-Marker zuruecknehmen. Kein Weg tut zwei Dinge.
   4. LINK-KORREKTUR MIT PROVENANCE: planLinkCorrection gewinnt auch gegen
      spaetere Workout-Snapshot-Retries und wird ueber metrics synchronisiert.
      Veraltete Ansichten duerfen keinen inzwischen anderen Link loesen.
   Test: activity_correction_310b_test (27) plus Kalender-, Activity-Detail-,
   Resolver- und Store-Bestandstests. Kein Kohorten-Pin betroffen: 023ee59b.

   ---- vorher ----
   v8-310a · DAS DATUM SPERRT AKTIONEN (2026-08-10):
   Ausbauplan v2.1, Runde v8-310a — Gians P0 aus dem Geraete-Review.

   1. HOISTING-FIX: _wOff wurde im Renderer benutzt, bevor es deklariert
      war — die Kopfzeile zeigte „undefined Wochen voraus" und „NaN.NaN."
      ohne Exception (setDate(NaN) wirft nicht). Der Wochenkopf kommt
      jetzt aus der puren, testbaren Funktion gmPlanWeekHeader(off).
   2. KALENDERIDENTITAET: planEntryClick reichte das Datum der
      geblaetterten Woche nicht durch — Occurrence-IDs rechneten immer
      die laufende Woche. Jetzt bildet der Klick den Kontext EINMAL
      (dateIso der gerenderten Karte) und reicht ihn unveraendert durch:
      planEntryClick -> openUnit/gmOpenSessionPage -> startPlannedUnit /
      markPlannedDone / gmOpenDebriefAt. plannedOccurrenceIdForDate ist
      die datumsgebundene Occurrence-Quelle.
   3. P0 — DAS DATUM SPERRT AKTIONEN: Die produktive Session-Vollseite
      (gmOpenSessionPage — openUnit ist auf sie umgelenkt!) und das alte
      Sheet entschieden per WOCHENTAGSINDEX ueber „Training starten" —
      naechste Woche, gleicher Wochentag war faelschlich startbar.
      Jetzt: Starten/Erledigen NUR wenn dateIso === heute; sonst der
      ehrliche Nur-lesbar-Hinweis. ZWEITER RIEGEL in den Funktionen
      selbst: startPlannedUnit/markPlannedDone verweigern fremde Tage
      mit code 'not_today' — auch gegen Konsolenaufrufe und kuenftige
      Renderfehler. Debrief: Vergangenheit erlaubt (Zweck des
      Zurueckblaetterns), Zukunft gesperrt; Klick-Datum statt
      gmPlanWeekOff-Rekonstruktion (Versatz koennte sich zwischen Render
      und Klick aendern).
   4. DREI TAGESZUSTAENDE (Gians Entscheidung): leer != Ruhetag.
      gmDayStateFor: 'rest' nur fuer den konfigurierten Ruhetag,
      'unavailable' nur bei gepflegter Verfuegbarkeit, sonst 'free' —
      der Nutzer sah ZWEI „Ruhetage", hatte aber einen eingestellt.
      Ohne gepflegte Verfuegbarkeit fail-open zu 'free', nie zu 'rest'.
   Tests: plan_calendar_identity_test (31) — inkl. Gians Pflicht-
   Gegenprobe (naechste Woche, gleicher Wochentag => kein Starten/
   Erledigen/Debrief). Drei Mutationsproben gefangen; dabei einen zu
   schwachen Emitter-Waechter geschaerft (onclick UND onkeydown werden
   gezaehlt — die erste Fassung uebersah den halben Verlust).
   KEIN Kohorten-Pin betroffen (reine ui.js-Runde): 023ee59b.

   ---- vorher ----
   v8-309 · EINE QUELLE FUER DEN SESSIONTYP (2026-08-09):
   prediction-observer@7. Gians P0 nach @6: Der Typ stand im
   Prescription-Hash, aber der RECORD las seine Kalibrierungsgruppe
   weiter aus input.sessionType. Repro: prescription 'threshold' +
   input 'tempo' => scored, Gruppe 'tempo' — der Hash-Vertrag sah es
   nicht, die Kalibrierung waere je Gruppe verunreinigt worden.

   FIX: prescription.sessionType (aus SD.prescriptionOf, derselben
   Quelle wie der C3-Snapshot) ist die EINZIGE autoritative Quelle.
   Fehlt er: fail-closed no_prescription_session_type — kein stilles
   'unknown'. Wird zusaetzlich input.sessionType uebergeben und weicht
   ab: fail-closed session_type_mismatch — Programmierfehler des
   Aufrufers, kein stiller Vorrang. ui.js (lwp) und Live-Test uebergeben
   KEINEN separaten Typ mehr. Sieben handkopierte sessionType-Angaben
   in Wiring-Fixtures entfernt — zwei davon waren bereits FALSCH
   ('threshold' auf Tempolauf-Einheiten): exakt die Fehlerklasse, die
   der neue Vertrag ab jetzt mit session_type_mismatch abweist.
   Mutationsproben: input wieder Recordquelle -> rot; Mismatch-Pruefung
   weg -> rot; stilles unknown wieder zugelassen -> rot.
   KEIN NEUER KOHORTEN-PIN: Observer ausserhalb der Kohorte, 023ee59b.
   Observer 161, Wiring 121, Drift 26. Flag bleibt AUS.
   Freigabeordnung: Live-Test (Gian, exakt 8/0) -> DANN Flag-Zeile.

   ---- vorher ----
   v8-308 · SESSIONTYP UND SPORT SIND VERGLEICHSVERTRAG (2026-08-09):
   prediction-observer@6. Gians P0 nach v8-307:

   1. sessionType FEHLTE IM PRESCRIPTION-HASH: Eine Tempo- und eine
      Threshold-Verordnung mit zufaellig gleichem expectedRpe/Evidenz/
      Zone hashten IDENTISCH (Gegenprobe reproduziert: beide 0c77ef96) —
      eine Threshold-Einheit konnte als Tempo-Auswertung scoren und
      haette die Kalibrierung verunreinigt, denn calibrate() trennt
      genau nach sessionType. Jetzt Teil des Hashes; beide Seiten
      tragen das Feld ohnehin aus SD.prescriptionOf.
   2. SPORT WIRD BEIM AUFLOESEN GEPRUEFT: Die Occurrence-ID bindet an
      den SLOT, nicht an die Sportart — eine umgewidmete Einheit (Rad
      statt Lauf im selben Slot) haette gegen die Lauf-Vorhersage
      scoren koennen. FAIL-CLOSED: sport unknown/fehlend auf einer
      Seite => not_comparable/sport_unknown; verschieden =>
      sport_mismatch.
   KEIN NEUER KOHORTEN-PIN: der Observer liegt ausserhalb der Kohorte
   (023ee59b unveraendert).
   AUSSERDEM (Gians zweiter Befund): prediction_wiring_test hing an der
   ECHTEN Uhr — am Sonntag liefen mehrere Produktketten als „entfaellt"
   und zaehlten trotzdem als bestanden. Das Kalenderfixture ist jetzt
   fest der MITTWOCH DER NAECHSTEN Woche (immer 4 strikt kuenftige
   Tage; naechste Woche, weil lwp predictedAt aus der echten Uhr nimmt
   und predict() am/nach dem Einheitstag ablehnt); Z0 wacht darueber.
   Dabei aufgedeckt: predsR.length===1 galt nur samstags — die Ketten
   pruefen jetzt zaehlgenau alle 4 Vorhersagen und identifizieren die
   Zieleinheit ueber die Occurrence. VIER weitere handkopierte
   rx-Feldlisten in Tests durch SD.prescriptionOf ersetzt (sie haetten
   sessionType still verloren — dieselbe Fehlerklasse wie v8-303).
   Mutationsproben: sessionType wieder raus -> Gegenprobe rot; Sport-
   Pruefung weg -> sport_mismatch-Test rot; Fixture zurueck auf echte
   Uhr -> Z0 rot am realen Sonntag. Observer 158, Wiring 121, Drift 26.
   Freigabeordnung: Live-Test (Gian, 8/0 noetig) -> DANN Flag-Zeile.

   ---- vorher ----
   v8-307 · DIE EINE PRESCRIPTION (2026-08-09):
   session-debrief@3. Gians Live-Test fand einen echten Vertragsfehler:
   die handgebaute Live-rx (rx-live/7/moderate/threshold) lief gegen den
   echten C3-Snapshot (session-debrief@2/4.8/weak/null) not_comparable —
   und die Divergenz VERDECKTE einen Produktfehler.

   1. PRODUKTFEHLER — typeOf LAS DEN DAUERTEXT ZUERST: Der alte Code
      nahm den ERSTEN WAHREN Text (type || d || l) und matchte NUR ihn.
      Bei {l:'Intervalle', d:'40 min'} wurde '40 min' gelesen, kein
      Muster traf, die Einheit wurde 'unknown' — falsche Erwartung
      (4.8/weak statt Intervallwert), falsche Domaenen. Betroffen war
      JEDE Einheit mit reinem Dauertext im d-Feld, also der Normalfall.
      Fix: Reihenfolge ist Vertrag — expliziter Typ -> Einheitenlabel ->
      Detail-/Dauertext, jeder Kandidat EINZELN geprueft mit Durchfall.
      Gegenprobe im Test: Intervalle + 40 min => vo2.
   2. EINE GEMEINSAME PRESCRIPTION: SD.prescriptionOf(unit,{durationMin,
      targetZone,history}) erzeugt die Vertragsfelder des
      prescriptionHash fuer ALLE DREI Erzeuger — Vorhersage
      (logWeekPredictions), C3-Snapshot (SD.debrief) und Live-Test.
      Keine inline-Konstruktion in ui.js mehr, keine handgebaute rx im
      Live-Test mehr (feste Werte haetten den naechsten
      Klassifikationsfehler wieder versteckt — Gians ausdrueckliche
      Warnung). BEWUSST ohne eigene Dauer-Parserei: durationMin kommt
      herein, die eine Parserquelle bleibt debrief-record.
      plannedDurationOf.
   KOHORTE BEWUSST NEU GEPINNT: 023ee59b (debrief: session-debrief@3).
   Gians Anordnung — die Sammlung war nie aktiv, es gehen keine Belege
   verloren. Mutationsproben: typeOf-Reihenfolge zurueck -> Gegenprobe
   rot (zeigt exakt 4.8); inline-Prescription zurueck -> Quelltext-
   Vertrag rot. Wiring 121, Observer 153 (inkl. Live-Test-Waechter:
   SD.prescriptionOf statt Handwerte, vo2-Abbruchbedingung).
   Freigabeordnung: Live-Test erneut (Gian, 8/0 noetig) -> DANN Flag.

   ---- vorher ----
   v8-306 · EHRLICHE FEHLERSEMANTIK DER SENKE (2026-08-09):
   Gians v8-305-Review: ein echter Fehler, zwei Beweisluecken.

   1. ECHTER FEHLER — DATENBANKFEHLER ALS ERFOLG: supabase-js lehnt bei
      SQL-/Constraint-Fehlern NICHT ab, es loest mit {data,error} auf.
      Der Erfolgszweig der Senke ignorierte das Argument und meldete
      jeden Constraint-Tod als true (Gians Repro gegen die echte
      ausgeschnittene _sink: sinkResult true, erwartet false). Fix:
      Erfolg ist NUR eine Aufloesung ohne error-Objekt; {error} und
      Rejection enden beide in false. Der Test-Spion bildet jetzt die
      ECHTE Semantik nach ({data,error}-Aufloesung, Rejection nur fuer
      Transportfehler) — der alte Spion konnte den Pfad nicht sehen.
   2. REGISTRIERUNG BEWIESEN (S5): _sink() direkt aufzurufen beweist
      nicht, dass die App sie registriert — ohne die setSink-Zeile
      blieben alle Tests gruen und nichts wuerde persistiert. Jetzt
      laeuft die ECHTE Registrierungszeile aus ui.js im Test, danach
      muss ein Insert ueber das echte DL.logDecision() beim Spion
      ankommen: App -> registrierte Senke -> Client.
   3. SCHEMAWAECHTER UEBER DIE GANZE KETTE (S2): Migrationen sind
      append-only — eine kuenftige Spalte kaeme in 0035+, 0032 bliebe
      unveraendert; nur 0032 zu lesen haette „neue Spalte ⇒ rot" nicht
      eingeloest. Der Waechter liest jetzt ALLE Migrationen (create
      table + spaetere add/drop column auf engine_decision_log).
   Drei Mutationsproben (Fehlersemantik zurueck -> S3 rot; setSink-Zeile
   weg -> S5 vierfach rot inkl. no_sink; synthetische 0099 mit
   add column -> S2 rot mit Spaltennamen) — alle gefangen.
   decision_sink_test 23. KEIN NEUER PIN: 86d1add8; decision-log@4
   unveraendert, Aenderung nur ui.js + Tests.
   Freigabeordnung unveraendert: Live-Test (Gian) -> DANN 0034 + Flag.

   ---- vorher ----
   v8-305 · EINE SPALTENABBILDUNG (2026-08-09):
   decision-log@4. Gians v8-304c-Review, beide Punkte am Code bestaetigt:

   1. DL.build() kann Datenbankpflichten nicht pruefen — es validiert nur
      Typ, Zeitstempel und ID; user_id entstand erst in der Senke, und
      runtime_hash/hash als NOT-NULL-Quellen prueft build() nicht.
   2. Der Live-Test hatte eine EIGENE handgepflegte Spaltenabbildung
      neben der produktiven _sink() in ui.js — und sie war BEREITS
      auseinandergelaufen: parent_decision_id, supersedes_decision_id
      und week_id fehlten. Ein gruener Live-Test bewies die App-Senke
      nicht.

   FIX (Gians Vorschlag, beide Wege kombiniert):
   · decisionLog.toRow(record, userId) — DIE eine reine Abbildung
     Record -> engine_decision_log-Zeile, fail-closed: fehlt eine
     NOT-NULL-Quelle (user_id/decision_id/decision_type/decided_at/
     decision_runtime_hash/decision_hash), gibt es KEINE Zeile und einen
     benannten Grund statt eines Constraint-Todes mit falschem Fehlerort.
     rejectedTruncated bewusst nicht abgebildet (keine Spalte).
   · _sink() in ui.js und der Live-Test nutzen DIESELBE Funktion.
   · decision_sink_test (17): fuehrt die ECHTE _sink() aus ui.js mit
     Supabase-Spion aus — Zeile byte-gleich zu toRow(); Spaltenvertrag
     GEGEN DIE MIGRATIONSDATEI 0032 gelesen (kommt eine Spalte hinzu,
     wird der Test rot); fail-closed ohne Nutzer/Client/Hash; die drei
     verlorenen Spalten nachgewiesen; Quelltextwaechter gegen die
     Rueckkehr einer Eigenabbildung in Senke UND Live-Test.
   Drei Mutationsproben (toRow verliert week_id -> Schema-Vertrag rot;
   Senke faellt auf Eigenabbildung zurueck -> Byte-Paritaet rot;
   toRow prueft decisionHash nicht mehr -> fail-closed rot) — alle
   gefangen. WICHTIG: Byte-Paritaet allein waere blind, wenn beide Seiten
   dieselbe fehlerhafte Abbildung nutzen — deshalb der unabhaengige
   Schema-Vertrag gegen 0032.
   KEIN NEUER KOHORTEN-PIN: 'log' ist kein COHORT_FIELD; Pin bleibt
   86d1add8. decisionRuntimeHash aendert sich planmaessig mit @4.
   Freigabeordnung unveraendert: Live-Test (Gian) -> DANN 0034 + Flag.

   ---- vorher ----
   v8-304 · KEINE ZWEITE FELDLISTE (2026-08-08):
   shadow-adaptive@12 + observer-source@2. Gians v8-303-Review:

   1. P0 — DER SHADOW-UEBERGANG VERWARF SICHERHEIT UND HERKUNFT:
      gmObserveWeekPlan uebergab constraints/inputHash/-Version/-Basis
      korrekt, aber O.logWeekShadow baute einen ZWEITEN handgepflegten
      Feldkatalog fuer SA.snapshot und verwarf alle vier — die
      Sicherheitsschicht erreichte C2 doch nicht, und das fail-closed-Gate
      haette jede reale Beobachtung ausgeschlossen. Fix nach Gians
      Vorschlag: SA.snapshot(Object.assign({},c,{userId})) — der Kontext
      geht VOLLSTAENDIG durch, SA waehlt seine Vertragsfelder selbst.
      BEIM BEHEBEN EINE SCHICHT TIEFER GEFUNDEN: toLogEntry war eine
      DRITTE Feldliste und verwarf die Herkunft beim PERSISTIEREN
      (shadow-adaptive@12 traegt inputHash/-Version/-Basis jetzt in den
      Log-Record). Der geforderte Kettentest laeuft: activeWeekPlan →
      gmObserveWeekPlan → ECHTES O.logWeekShadow → SA.snapshot →
      SA.observe → Decision Log, geprueft am FERTIGEN Record
      (Herkunft vorhanden, C2 blocked, Gate nimmt an; erster Render ohne
      aufgeloeste Performance wird vom Gate KORREKT ausgeschlossen).
   2. P1 — VOLLER SORTIERSCHLUESSEL (observer-source@2): Teilschluessel
      bodyRegion|side|title liess gleich benannte Beschwerden mit
      verschiedener Intensitaet/Status in Eingabereihenfolge — jetzt
      sortiert die vollstaendige stabile Serialisierung; Gians
      Zwillings-Gegenprobe ist der Test.
   VERTRAGSKLARSTELLUNG (aus dem Review uebernommen): Die Episode endet
   nicht „niemals durch Zeitablauf", sondern hat KEINE automatische
   Beendigung innerhalb der 180-Tage-Historie — Tag 181 ist eine
   ausdrueckliche Modellgrenze.
   KOHORTE BEWUSST NEU GEPINNT: 86d1add8 (shadow@12 + source@2 + input@5).
   Tests: Verdrahtung 113 (inkl. Z24-Kettentest), observer_source 21,
   Shadow 192, Drift 26. Drei Mutationsproben (zweite Feldliste zurueck,
   toLogEntry-Verwurf zurueck, Teilschluessel zurueck) — alle rot.
   Freigabeordnung: Live-Test (Gian) → DANN 0034 + Flag-Zeile.

   ---- vorher ----
   v8-303 · DIE QUELLE WIRD VERTRAG · observer-source@1:
   Gians Architekturbefund nach zwei P0 in der ui-Beschaffung:

     App-Speicher -> observer-source@1 -> observer-input@5 -> Schatten/Prediction

   1. P0 — DER 29-TAGE-PRODUKTFALL: Die ui-Abbruchbedingung
      (b>=27 && lastPos==null => break) KONNTE Tag 29 nie erreichen; der
      Adaptertest bestand nur, weil er seine Serie selbst baute.
      observer-source scannt IMMER das volle 180-Tage-Fenster — keine
      „intelligente" Abbruchbedingung mehr, genau die war der Fehler.
      Der geforderte Test laeuft durch das ECHTE activeWeekPlan mit
      DB[heute-29].morning.ill=true.
   2. P0 — HASH-STABILITAET: profileModel.activeConstraints() normalisiert
      mit Uhr (updatedAt) und Zufalls-IDs (Legacy-issues) — jeder Aufruf
      ein neuer Snapshot-Hash: Drossel wirkungslos, neue
      Idempotenzschluessel, Log-Volllauf, reproducible unerfuellbar.
      observer-source projiziert NUR fachliche Felder, deterministisch,
      inhaltssortiert. Test: unveraendertes Profil, 25 ms Abstand,
      EIN Hash, EINE Beobachtung.
   3. P1 — observed-POLITIK (Entscheid, dokumentiert): observed wird
      UEBERSETZT — profile-center und decision-engine-v2 behandeln
      active+observed als relevant, die Sicherheitsschicht folgt dieser
      Semantik. Ausgewiesen mit evidence weak + reviewStatus;
      currentlyTrainable:false blockiert auch als observed (der Nutzer
      HAT es gesagt). improved/resolved werden nicht projiziert.
   KOHORTE: shadow-adaptive@11 fuehrt 'source' als eigenes Feld — die
   QUELLENBEDEUTUNG gehoert zum Abnahmevertrag. Neuer Pin b8581b08
   (source@1 + input@5 + shadow@11). ui sammelt keine fachlichen
   Zustaende mehr selbst (Quelltext-Vertrag).
   Tests: observer_source 20 (neu), observer_input 58, Verdrahtung 108,
   Shadow 192, Drift 26. Vier Mutationsproben (28er-Abbruch zurueck,
   Uhr-Normalisierung zurueck, Kappe heimlich 28, observed raus) — rot.
   Freigabeordnung: Live-Test (Gian) → DANN 0034 + Flag-Zeile.

   ---- vorher ----
   v8-302 · PRODUKTQUELLEN UND KONSISTENTE KANTE (2026-08-08):
   observer-input@4 + shadow-adaptive@10 + goal-feasibility@4.
   Gians drei P0 und zwei P1 aus dem v8-301-Review:

   1. P0 — PROFILE.constraints EXISTIERT NICHT: Die kanonische Quelle ist
      constraintsList; ui liest jetzt profileModel.activeConstraints
      (constraintsList + Legacy-issues, nur aktive). Der Z23-Test hatte
      sich sein falsches Testprofil selbst gebaut — er setzt jetzt
      AUSDRUECKLICH nur constraintsList, und ein Quelltext-Vertrag
      verbietet die Phantom-Eigenschaft.
   2. P0 — EPISODE OHNE FENSTERABLAUF, RUECKWAERTS GEZAEHLT: Die ui-Serie
      reicht jetzt BIS ZUM LETZTEN POSITIVEN TAG (min. 28d, Kappe 180d,
      Kappung ausgewiesen); symptomFreeDays ist die AKTUELLE
      zusammenhaengende false-Serie rueckwaerts ab heute (die alte
      Vorwaertszaehlung blieb an der ersten Luecke stehen — 7 bestaetigt
      freie juengste Tage zaehlten 0). 29-Tage-Fall und Luecken-Fall sind
      Tests.
   3. P0 — GATE WIRKLICH FAIL-CLOSED: Reale Beobachtung ohne inputBasis
      oder mit einem Feld != 'provided' ist ausgeschlossen; checkins und
      profileConstraints sind Pflichtquellen. Fixtures bewertet weiterhin
      ihre eigene Kennzeichnung. Gians beide Gegenproben sind Tests.
   4. P1 — CACHE-SCHLUESSEL VOLLSTAENDIG: band, modelBasis, distanceRatio
      und modelVersion (Adapter setzt sie jetzt) stehen im inputHash —
      within und outside trugen vorher DENSELBEN Key.
   5. P1 — DIE KONSERVATIVE KANTE GILT IMMER: requiredPct rechnet bei
      vorhandenem Band grundsaetzlich ab der Kante (210er-Punktwert /
      190-230-Band / Ziel 200 ⇒ 13 % outside, nicht 4,76 % within);
      required fuehrt pointValue und conservativeEdge aus.
   KOHORTE BEWUSST NEU GEPINNT: dd2b773c. OFFEN (dokumentiert): die
   Bandspanne 1.04-1.08 braucht einen Quellen-/Annahmenverweis aus der
   Wissenskette; availability steuert weiterhin kein Urteil.
   Tests: observer_input 58, Verdrahtung 106, Shadow 192, GF 152,
   Drift 25. Fuenf Mutationsproben, alle rot.
   Freigabeordnung: Live-Test (Gian) → DANN 0034 + Flag-Zeile.

   ---- vorher ----
   v8-301 · SICHERHEIT UND EHRLICHE EVIDENZ (2026-08-08):
   observer-input@3 + shadow-adaptive@9 + goal-feasibility@3.
   Gians drei P0 und die Evidenzluecke aus dem v8-300-Review:

   1. P0 — KRANKHEITS-EPISODE STATT FENSTERZAEHLUNG (@3): Die alte
      7-Tage-Zaehlung kannte kein ill:false, liess die Episode am 8. Tag
      per Fensterablauf verschwinden und lieferte C2s symptomFreeDays nie.
      Jetzt: letzter positiver Tag; danach zaehlen NUR ausdruecklich freie
      Tage in ununterbrochener Folge (Luecke = unknown, zaehlt nicht);
      Ende NUR durch >=7 bestaetigte freie Tage, nie durch Zeitablauf
      (28-Tage-Fenster). C2 erreicht damit wirklich den konservativen
      Wiedereinstieg (range ab Symptomfreiheit) bzw. bleibt blockiert.
   2. P0 — DIE SICHERHEITSSCHICHT ERREICHT C2 (@3 + @9): Profilbeschwerden
      (intensity/currentlyTrainable) werden versioniert in C2-Form
      (severity/blocks) uebersetzt; Red Flags (Fieber, Brustschmerz,
      Atemnot, Schwindel, Neurologie) sind fail-closed systemische
      Vollsperren. shadow-adaptive@9 reicht constraints an
      progressionDecision durch — die Produktkette DB-Check-in ->
      Adapter -> SA -> C2 'blocked' ist als Verhalten getestet (die
      SA-Ketten-Probe entkam zuerst: der Test rief C2 direkt).
   3. P0 — PFLICHTQUELLEN-GATE IN DER ABNAHME (@9): Beobachtungen mit
      activities/debriefs/goal/performance = 'unavailable' zaehlen fuer
      KEIN Kriterium ausser plan_unchanged; ausgewiesen als
      excludedMissingSources. Gians Gegenprobe (3 formal gruene
      Beobachtungen ohne Aktivitaetsquelle erfuellten full_chain) ist
      jetzt der Test.
   4. P1 — RIEGEL ERBT KEINE EVIDENZ (@3 + gf@3): Extrapolation ueber
      Distanzen deckelt die Evidenz (moderate; >2.5x weak), weist
      modelBasis und sourceEvidence aus und traegt ein Unsicherheitsband
      (Exponent 1.04–1.08). goal-feasibility@3 prueft „Ziel bereits
      erreicht" gegen die KONSERVATIVE Bandkante und rechnet den Bedarf
      ab der Kante (required.conservativeEdge). Gians 5-km->Marathon-
      Gegenprobe ist der Test. availability steuert weiterhin kein
      Urteil — dokumentiert, eigener spaeterer Schritt.
   KOHORTE BEWUSST NEU GEPINNT: 19343e54 (input@3 + shadow@9 + gf@3).
   Tests: observer_input 51, Verdrahtung 105, Shadow 189, GF 152,
   Drift 25. Sieben Mutationsproben, alle rot.
   Freigabeordnung: Live-Test (Gian) → DANN 0034 + Flag-Zeile.

   ---- vorher ----
   v8-300 · PRODUKTFORMEN · observer-input@2 + shadow-adaptive@8:
   Gians vier Integrationsluecken aus dem v8-299-Pruefauftrag:

   1. P0 — STUFE 5 BEKAM NIE IHRE DATENFORM: goalOf() liefert
      targetMin/raceDate, der Resolver {sports:{...}} — Goal Feasibility
      erwartet targetValue/metricType und EINEN Leistungswert. Jede
      Produktbewertung war insufficient_data/current_performance.
      observer-input@2 traegt jetzt die ABGELEITETEN Formen
      (feasibilityGoal, feasibilityPerformance per Riegel auf die
      Zieldistanz, Evidenz/Alter unveraendert durchgereicht) — die
      Uebersetzung ist Verhalten und lebt im kohortengebundenen Adapter.
      Z21 beweist die ECHTE Kette: Produktformen -> activeWeekPlan ->
      Adapter -> SA.observe mit echtem Registry -> s5 'ok' mit realem
      Urteil (outside_modeled_corridor), NICHT insufficient_data.
   2. HERKUNFT WIRD PERSISTIERT (shadow-adaptive@8): inputHash/-Version/
      -Basis stehen jetzt im SA-Snapshot UND in der Beobachtung UND im
      Abnahme-Lesepfad — „activityStore fehlt" und „bewusst leer" bleiben
      in der persistierten Abnahme unterscheidbar.
   3. PREDICTION LIEST NUR DEN SNAPSHOT: Performance und Debriefs kommen
      als eingefrorene Kopien im Kontext mit; der Callback liest weder
      O._lastPlanPerf noch den lebenden Debrief-Speicher. (Z22 mit
      Kontrollhash-Vergleich; die Probe brauchte erst echte
      performanceZones in der Sandbox, um ueberhaupt fangen zu koennen.)
   4. STEUERFELDER VERDRAHTET: availability (profileModel), phase
      (Calc.racePhases -> taper/race_week/peak/build), interruption
      (Krankheit aus den ECHTEN Morgen-Check-ins der letzten 7 Tage),
      targetDate (aus goal.raceDate im Adapter) — C2 sieht Krankheit und
      Taper, Stufe 5 das fixe Zieldatum.
   KOHORTE ERNEUT NEU GEPINNT: de8b1585 (input@2 + shadow@8).
   Tests: observer_input 32 (inkl. Stufe-5-E2E), Verdrahtung 99,
   Shadow 185, Drift 25. Mutationsproben: rohe Form durchgereicht,
   Herkunft verworfen, Callback liest global, Riegel entfernt — alle rot.
   Freigabeordnung: Live-Test (Gian) → DANN 0034 + Flag-Zeile.

   ---- vorher ----
   v8-299 · DER EINE EINGANG · observer-input@1 (2026-08-08):
   Gians Architekturentscheid nach zwei P0-Befunden in Folge: Die
   Beobachtung sammelte ihre Eingaenge verstreut in ui.js — und zweimal
   war eine Quelle tot (DB.sessionDebriefs: nie geschrieben;
   activitiesAll(): existiert nicht — Z19 bewies nur den Test-Stub).
   Schlimmer: Die Kohorte kannte den Eingangsadapter nicht — semantisch
   verschiedene Beobachtungen trugen denselben Pin 9064d4f8.

   1. NEU js/engine/observer-input.js (@1), rein und versioniert:
        Profil + Aktivitaeten + Debriefs + Ziel + Performance
          + Planidentitaet → eingefrorener Snapshot + Hash
      Tiefe Kopie (Mutation der Rohquellen wirkungslos), deepFrozen,
      stabile Serialisierung; „Quelle fehlt" wird als basis:'unavailable'
      AUSGEWIESEN statt als leere Liste gedeutet. Aktivitaeten kommen aus
      dem ECHTEN ORVIA.activityStore.listActivities().
   2. EIN SNAPSHOT FUER ALLE: Schatten (inkl. planId der Altplan-Identitaet
      — war dort noch null), Prediction und Drossel arbeiten mit DEMSELBEN
      Zustand. DIE DROSSEL IST DER SNAPSHOT-HASH: Performance, Zielzeit,
      korrigierte Aktivitaet mit gleicher ID — alles zaehlt automatisch;
      setzt der Resolver _lastPlanPerf nach dem Render, aendert das den
      Hash und die naechste Beobachtung laeuft SOFORT mit Performance.
   3. KOHORTE NEU GEPINNT (bewusst): shadow-adaptive@7 fuehrt das Feld
      'input' (observer-input@1) — Beobachtungen verschiedener Adapter
      mischen sich nie mehr. Neuer Pin e8a0c381 (16 Felder). Altbelege
      unter 9064d4f8 zaehlen nicht mehr — sie entstanden mit toten
      Quellen, ihr Verlust ist kein Preis, sondern der Zweck.
   Harness-Ehrlichkeit: der Test stellt activitiesAll NICHT mehr bereit —
   genau das hatte Z19 gruen luegen lassen.
   Tests: observer_input_test (26), Verdrahtung 93, Shadow 185, Drift 25.
   Mutationsproben: tote Aktivitaetsquelle, planId-Verlust im Schatten,
   Performance aus dem Hash — alle rot.
   Freigabeordnung: Live-Test (Gian) → DANN 0034 + Flag-Zeile.

   ---- vorher ----
   v8-298 · P0 UND SPORTUEBERGREIFENDE KETTE (2026-08-08):
   Gians drei Restpunkte aus dem v8-297-Review:

   1. P0 — DER SCHATTEN BEKAM NIE ECHTE DEBRIEFS: DB.sessionDebriefs wird
      NIRGENDS geschrieben; die Schatten-Kette (Toleranz, Belastung,
      Abnahme) bekam seit v8-279 eine leere Liste, waehrend gmDbSave die
      echten C3-Records laengst in den kanonischen Store schrieb.
      Speichern funktionierte — kein Konsument las. Jetzt speist
      gmDbStore() den Schatten; der tote Pfad ist per Quelltext-Vertrag
      verboten. (Z18)
   2. SPORTUEBERGREIFEND: Der Debrief-Pfad mappte Rad->cycling/
      Schwimmen->swimming laengst, die Vorhersage nur das exakte 'Laufen' —
      Rad/Schwimmen wurden als sport:unknown prognostiziert und in der
      Kalibrierung vermengt. gmSportIdOfUnit ist jetzt die EINE Quelle
      beider Seiten (auch debrief-record@5-Rueckfall). Z17 fuehrt die
      volle Rad- UND Schwimm-Kette bis scored — mit echten FTP-/CSS-Zonen
      im Kontext, und EHRLICH festgehalten: paceForUnit ist heute
      Laufen-only, targetZone bleibt fuer Rad/Schwimmen beidseitig null —
      die Paritaet gilt genau deshalb. Eine Zonen-Integration fuer
      Rad/Schwimmen waere eine bewusste C3-/Kohortenaenderung.
   3. DROSSEL KENNT ALLE EINGANGSDATEN: Der Schluessel enthaelt jetzt auch
      Aktivitaeten (Anzahl + letzte), Ziel, Level und Sportarten — eine
      frisch synchronisierte Aktivitaet bei unveraendertem Plan wird
      SOFORT beobachtet. (Z19)
   prediction_wiring_test: 86. Mutationsproben: Laufen-only-Mapping,
   toter Schatten-Pfad, Aktivitaeten aus dem Schluessel — alle rot.
   Freigabeordnung: Live-Test (Gian) → DANN 0034 + Flag-Zeile.

   ---- vorher ----
   v8-297 · ALTPLAN-KETTE UND DROSSEL GESCHLOSSEN (2026-08-08):
   Gians zwei Restpunkte — und ein DRITTER, beim Verifizieren gefunden:

   1. ALTPLAN HAT JETZT EINE IDENTITAET: Bei gespeichertem PROFILE.weekPlan
      lieferte _gmCanonPlan null fuer planId/planRevision — der Observer
      wurde erreicht, predict() lehnte aber fail-closed ab: aufgerufen,
      wirkungslos. gmPlanIdentity(): kanonisch gewinnt das Modell, sonst
      weekplan:<Woche> als Plan-ID und der INHALT als Revision (eine
      Bearbeitung ist eine neue Revision — alte Vorhersagen ehrlich
      superseded). DIESELBE Funktion speist gmDbSave, sonst traefe sich
      nie etwas.
   2. DRITTER BEFUND — C3-PARITAET DER PRESCRIPTION: Die Wiring-Erwartung
      rechnete OHNE durationMin und MIT Historie; das C3-Urteil MIT
      durationMin und OHNE. Der Prescription-Hash war damit fuer jede
      dauer-abweichende Einheit verschieden — JEDE Aufloesung waere
      not_comparable gewesen, auch kanonisch. Jetzt exakt die Konstruktion
      des Debrief-Pfads: durationMin aus plannedDurationOf, KEINE
      Historie, Zone aus derselben paceForUnit-Aufloesung. (Z15: die
      volle Altplan-Kette bis scored, mit einer bewusst dauer-abweichenden
      Einheit — die 45-min-Einheit hat work==ref und liesse die Mutation
      entkommen; Hash-Paritaet zusaetzlich als eigener Vertrag.)
   3. DROSSEL VERSCHLUCKT KEINE NEUEN DATEN: Der Schluessel enthaelt jetzt
      den Debrief-Datenstand (Anzahl + letzter Zeitstempel), und gmDbSave
      bustet direkt nach dem Speichern — ein unveraenderter Plan mit neuem
      Debrief wird SOFORT beobachtet, nicht erst nach 60s. (Z16)
   prediction_wiring_test: 73. Mutationsproben: Identitaets-Zweig raus,
   durationMin-Paritaet raus (⇒ prescription_mismatch!), Datenstand aus
   dem Schluessel, Bust raus, Historie einseitig wieder rein — alle rot.
   Freigabeordnung: Live-Test (Gian) → DANN 0034 + Flag-Zeile.

   ---- vorher ----
   v8-296 · DER PRODUKTPFAD ERREICHT DEN OBSERVER (2026-08-08):
   Gians wichtigster Befund dieser Reihe: Die drei Observer-Funktionen
   waren getestet — der WEG DORTHIN nicht. activeWeekPlan() kehrt bei
   kanonischem oder gespeichertem Plan VOR dem Generator zurueck, und
   Schatten, Vorhersagen und Herzschlag hingen im Generator. Ein Nutzer
   mit bestehendem Plan (der Normalfall) erreichte den Observer NIE —
   das betraf auch logWeekShadow selbst, also die gesamte
   Abnahme-Datensammlung des Schattenbetriebs.

   1. BEOBACHTUNG AN DER ZENTRALEN PLANQUELLE: gmObserveWeekPlan(w,src)
      wrappt ALLE fuenf Rueckgabepfade von activeWeekPlan (kanonisch,
      kanonisch-catch, gespeichert, gespeichert-catch, generiert). Das
      Entscheidungs-Log der GENERIERUNG bleibt im Generator — es
      protokolliert die Entscheidung, nicht den Bestand. Render-Sturm-
      Drossel: unveraenderter Plan hoechstens einmal je Minute, ein
      GEAENDERTER sofort (Schluessel enthaelt den Planinhalt); die
      Drossel verliert nichts, weil alle drei Ebenen selbst deduplizieren.
      (Z13 fuehrt das ECHTE activeWeekPlan aus: gespeicherter UND
      kanonischer Plan erreichen alle drei Funktionen; Drossel-Verhalten
      als Test.)
   2. SUPERSEDED IST KEIN ENDZUSTAND DES DEBRIEFS: Das Herzschlag-Dedup
      galt fuer jede nicht-pending-Auswertung — ein fruehes superseded
      (alte Revision zuerst aufgeloest) haette das spaetere scored gegen
      die EXAKTE Vorhersage fuer immer blockiert. Jetzt: nur scored ist
      endgueltig; offene Faelle werden direkt mit exakter Praeferenz
      aufgeloest (Revision+Hash > Revision > Session), geloggt wird NUR
      das Upgrade auf scored. (Z14: superseded → exakte Vorhersage
      erscheint spaeter → Herzschlag liefert scored; scored bleibt final.)
   prediction_wiring_test: 59. Mutationsproben: stored-Pfad entwrappt,
   Dedup zurueckgedreht, Drossel ohne Planinhalt — alle rot.
   Freigabeordnung: Live-Test (Gian) → DANN 0034 + Flag-Zeile.

   ---- vorher ----
   v8-295 · OFFLINE-/RETRY-LEBENSZYKLUS GESCHLOSSEN (2026-08-08):
   Die zwei Restpunkte aus Gians v8-294-Urteil:

   1. PENDING IST AUCH IM FEHLERPFAD KEIN ENDZUSTAND:
      O.reconcilePendingPredictions haengt als HERZSCHLAG am Planlauf (der
      ohnehin regelmaessig kommt — kein Timer). Er sammelt offene pendings
      aus Ring UND persistierten Auswertungen, holt die Grundwahrheit aus
      dem uebergebenen Profil-Speicher, laedt die Vorhersagen der
      betroffenen Sessions SERVERSEITIG gefiltert und verbindet ueber
      P.reconcile (exakte Identitaet, Modellversion DER Vorhersage).
      Dedup ueber das ERGEBNIS: ein Debrief mit nicht-pending-Auswertung
      wird nie erneut aufgeloest — der Herzschlag ist idempotent.
      Budget: max. 10 pendings, eine Sammelabfrage je Richtung.
      (Z11: offline ⇒ pending ⇒ online-Herzschlag ⇒ scored OHNE erneutes
      Speichern; Neustart-Variante mit komplett leerem Ring; Idempotenz.)
   2. SESSION SERVERSEITIG VOR DEM LIMIT: Die resolve-Rueckgriff-Abfrage
      filtert jetzt derived_state->>sessionId in der Datenbank — vorher
      luden 50 beliebige Plan-Vorhersagen, und bei vielen Revisionen fiel
      die gesuchte aeltere Session still aus dem Fenster. (Z12: 60 neuere
      fremde Vorhersagen, die richtige wird trotzdem scored; der
      Test-Doppelgaenger WENDET die Filter an, statt sie nur zu notieren.)
   prediction_wiring_test: 49. Mutationsproben: Session-Filter raus,
   Herzschlag ohne Datenbank, Dedup raus — alle rot.
   Freigabeordnung: Live-Test (Gian) → DANN 0034 + Flag-Zeile.

   ---- vorher ----
   v8-294 · DREI LEBENSZYKLUSLUECKEN GESCHLOSSEN (2026-08-08):
   Gians v8-293-Review — keine der Luecken beruehrte Plan oder Debrief,
   aber alle drei haetten Lernmaterial verloren oder zeitlich verunreinigt:

   1. SNAPSHOT FRIERT WIRKLICH EIN: sel speicherte REFERENZEN auf die
      Plan-Einheiten, die Debrief-Historie ging als Referenz in den
      verzoegerten Callback — eine Bearbeitung zwischen Tick und Callback
      haette eine Vorhersage aus dem NEUEN Zustand mit dem ALTEN Stempel
      erzeugt. Jetzt: tiefe Kopie von Einheiten UND Historie im Tick.
      (Z8: Manipulation nach dem Anstoss ist wirkungslos, verglichen gegen
      einen Kontrolllauf; die Probe brauchte drei Anlaeufe an der Fixture —
      typeOf() haengt auch am d-Feld, erst ein voll vergleichbarer
      Historieneintrag machte die Referenz-Mutation sichtbar.)
   2. NEUSTART VERLIERT KEINE VORHERSAGE: resolve() kannte nur den
      Tab-Ring — nach einem Neustart waere jedes Debrief fuer immer
      pending geblieben (auch die Reconciliation las nur den Ring). Jetzt:
      Ring zuerst, sonst persistierte Vorhersagen der Plan-ID lesen
      (Typ+Plan serverseitig gefiltert VOR dem Limit, neueste zuerst);
      Abfragefehler ⇒ ehrlich pending, nie stiller Verlust. (Z9)
   3. DIE EXAKTE REVISION GEWINNT: Kandidatenwahl war „letzte der
      Session" — nach einer Planrevision griff sie die falsche und
      produzierte superseded, wo scored moeglich war. Jetzt Praeferenz
      (1) gleiche Revision + gleicher Prescription-Hash, (2) gleiche
      Revision, (3) neueste der Session — und NUR die alte Revision
      vorhanden bleibt ehrlich superseded. (Z10)
   prediction_wiring_test: 40 Tests; Mutationsproben: Referenz statt
   Kopie (Einheit UND Historie getrennt), Rueckgriff entfernt,
   Revisionswahl entfernt — alle rot.
   Freigabeordnung unveraendert: Live-Test (Gian) → DANN 0034 + Flag.

   ---- vorher ----
   v8-293 · VERDRAHTUNG GEBAUT, SAMMLUNG GESPERRT (2026-08-08):
   predict()/resolve() sind nach dem Shadow-Muster verdrahtet — hinter dem
   NEUEN serverseitigen Flag 'prediction_observer' (feature-flags@2,
   Migration 0034 erweitert den 0031-Constraint; 0031 unangetastet).
   Standard ist AUS, der Client kann das Flag nicht setzen: Die
   Freigabeordnung „erst gruener Live-Test, dann Sammlung" ist damit
   MECHANISMUS, nicht Absprache.

   Planlauf: Einheiten-Snapshot SYNCHRON im Plan-Tick (fixiertes Datum je
   Einheit, nur Tage STRIKT nach heute — fuer heutige ist die
   Vor-Ereignis-Garantie ohne Startzeit nicht beweisbar); predict()
   verzoegert + budgetiert (250ms); Erwartung aus C3 (SD.expectedRPE,
   dieselbe Funktion wie das spaetere Urteil); decisionId = predictionId
   (Dubletten scheitern am unique-Constraint, gewollt); bereits debriefte
   Einheiten werden nie versucht, Lookup-Fehler ⇒ fail-closed KEIN Versuch.

   Debrief: gmDbSave speichert ZUERST (upsert + saveProfile), resolve()
   laeuft danach verzoegert; fehlende Vorhersage ⇒ pending; die
   Reconciliation verbindet nachgelieferte Vorhersagen ueber die exakte
   Identitaet (key5 + Modellversion DER Vorhersage).

   prediction_wiring_test (31): fuehrt die ECHTEN ui.js-Slices in Node aus
   (gm61-Muster, kein Testhaken) — Flag aus ⇒ nichts; werfender Observer
   ⇒ Plan byte-identisch, nichts propagiert; falsche/fehlende Identitaet
   ⇒ kein Versuch; scored/pending/Reconciliation als Verhalten. Fuenf
   Mutationsproben (Flag raus, debriefExists false, Lookup fail-open,
   Session-Filter raus, resolve vor saveProfile) — alle gefangen; die
   Session-Filter-Probe erzwang eine schaerfere Ring-Reihenfolge im Test.

   AKTIVIERUNG (nur nach gruenem prediction_observer_live_test):
   0034 einspielen, dann Flag-Zeile je Nutzer inserten (SQL im
   Migrationskopf). Ohne beides bleibt alles beobachtungslos.

   ---- vorher ----
   v8-292 · DRITTE GEGENPRUEFUNG GESCHLOSSEN (2026-08-08):
   Drei Codebefunde aus Gians v8-291-Review:

   1. ROLLBACK RAUS AUS DEM VORWAERTSPFAD: 0028_user_metric_series_rollback
      trug dieselbe Versionsnummer wie die Vorwaertsmigration und LOESCHT
      deren Tabelle — je nach Werkzeug doppelte Version oder versehentliche
      Ausfuehrung. Liegt jetzt unter supabase/migrations_rollback/. NEU:
      migrations_chain_contract_test — kein Rollback im aktiven Ordner,
      keine doppelte Version, lueckenlose Kette (der _dev-Befund als
      Dauerwache), kein unbedingter Tabellen-/Spaltenverlust ohne Marker.
   2. DECISION-LOG-IDENTITAET WIE IM PROFIL: decisionId war 'db:'+key —
      kollidierte am unique(user_id, decision_id) fuer Zwillinge UND fuer
      jedes erneute Speichern. Jetzt Occurrence-ID + Ereigniszeit: jede
      Korrektur ist ein NEUER Eintrag (das Append-only-Versprechen von
      0032), planId wird mitgegeben.
   3. UPSERT ERSETZT GANZHEITLICH (debrief-record@4): Die feldweise Kopie
      liess Altfelder stehen, die der neue Record nicht trug — nach einem
      fehlgeschlagenen C3-Urteil haette der Record NEUES RPE mit ALTEM
      Snapshot kombiniert. Jetzt store[i]=rec: was der Builder nicht
      liefert, existiert nicht mehr. Chimaeren-Test + Mutationsprobe.
   Klarstellung: 0033 ist NICHT eingespielt — das war nie behauptet und
   bleibt Gians Schritt; der Live-Test laeuft nur mit seinen env-Variablen.
   Browser-Suiten (21) sind auf dem Geraet weiterhin uebersprungen, bis
   npm install im Repo-Stamm playwright bereitstellt — Engine-Verhalten ist
   geraeteverifiziert, UI-/Browserverhalten lokal noch nicht.

   ---- vorher ----
   v8-291 · ZWEITE GEGENPRUEFUNG GESCHLOSSEN (2026-08-08):
   Fuenf Befunde aus Gians dateibasiertem Review — in seiner Reihenfolge:

   1. SUITE IM TATSAECHLICHEN CHECKOUT GRUEN: Nicht 50, sondern ~180
      Testdateien trugen layoutabhaengige Pfade (URL-relative Sonden,
      require-Pfade, '../../'-Literale, APPROOT-Sonden, Live-Helfer). Alle
      laufen jetzt in BEIDEN Layouts (kanonisch app/supabase/tests und
      umstrukturiert supabase/tests neben app/) — verifiziert gegen ein
      1:1-Replikat des Geraete-Layouts: 232/0/7 in beiden. Und: die
      Migrationskette 0001–0033 gehoert VOLLSTAENDIG nach
      supabase/migrations — die Geschwisterpfad-Tests setzen sie voraus
      (auf dem Geraet lagen nur 0032+0033; 0001–0031 nur unter _dev).
   2. LIVE-TEST SCHREIBT VOLLSTAENDIGE RECORDS: toRow() baut den Insert
      ueber DL.build() — dieselbe Fabrik wie produktiv, inklusive
      decision_runtime_hash und decision_hash (NOT NULL seit 0032). Der
      alte Test waere nach 0033 am NAECHSTEN Constraint gestorben.
   3. ZWILLINGE AUCH IM SPEICHERPFAD GETRENNT (debrief-record@3):
      upsert(store,rec) lebt jetzt als reine, testbare Regel im Modul —
      ID-Treffer strikt, Bestandsrecords ohne ID werden EINMALIG per
      Schluessel migriert, verschiedene IDs mischen NIE. gmDbSave nutzt
      upsert statt Datum|Sport|Label; gmDbFind sucht zuerst die
      Occurrence-ID und faellt bei template_id-Basis NICHT aufs Label
      zurueck (sonst faende der Zwilling das Debrief seines Bruders).
   4. LIVE-TEST IST EIN ECHTER ROUNDTRIP: predict → INSERT → SELECT der
      GESPEICHERTEN Vorhersage → verifyIntegrity → resolve mit dem
      GELESENEN Record → Evaluation-INSERT → beide LESEN → Kalibrierung
      aus dem Gelesenen. Serialisierungsverluste koennen sich nicht mehr
      hinter der In-Memory-Kopie verstecken.
   5. PFLICHTEINGAENGE WIRKLICH EINGEFROREN (prediction-observer@5):
      deepFreeze(REQUIRED_INPUTS) — die Liste war zur Laufzeit erweiterbar.
      Dazu: modelView als EINZIGE Rechenquelle der Prognose — der
      Praesenz-Check prueft dieselben Felder, aus denen gerechnet wird.
   Tests: Observer 136+ inkl. V16 (Speicherpfad-Dedup als Verhalten,
   gmDbFind-Vertrag), Mutationsproben auf upsert/modelView/toRow.
   0033 MUSS WEITERHIN EINGESPIELT WERDEN; Live-Test danach mit env-Variablen
   ausfuehren. Verdrahtung von predict/resolve erst NACH gruenem Live-Test.

   ---- vorher ----
   v8-290 · FREIGABE-BLOCKER GESCHLOSSEN (2026-08-08):
   Sechs Befunde aus Gians zweiter Gegenpruefung:

   1. TESTPFADE ROBUST: Das Repo existiert in zwei Layouts (kanonisch
      app/supabase/tests · umstrukturiert supabase/tests neben app/). Die
      starre APP-Aufloesung fand im umstrukturierten Layout den falschen
      Ordner — 0/46 statt gruen. Alle 50 Testdateien suchen jetzt den ersten
      Kandidaten mit index.html UND js/engine; der Migrations-Lookup laeuft
      ueber den Geschwisterpfad (supabase/migrations neben supabase/tests),
      unabhaengig von der App-Wurzel.
   2. OCCURRENCE ECHT EINDEUTIG (debrief-record@2): Die App-Identitaet
      po:<datum>:<templateId> wird genutzt (Plan-Actual-Link) — zwei gleich
      benannte Einheiten am selben Tag kollidieren nicht mehr. Ohne
      Template-ID wird die schwaechere Basis AUSGEWIESEN
      (sessionIdBasis: label_fallback), nicht Eindeutigkeit behauptet.
   3. VORHERSAGE-IDENTITAET FAIL-CLOSED (prediction-observer@4): planId und
      planRevision sind Pflicht (no_plan_id/no_plan_revision); die
      predictionId umfasst Nutzer, Session, Plan, Revision, Prescription-Hash
      und Modellversion — zwei Plaene oder Verordnungen ergeben nie dieselbe
      ID, und resolve() wertete eine planlose Vorhersage nie mehr gegen einen
      fremden Plan.
   4. VORHANDEN-ABER-UNLESBAR IST NICHT FEHLEND: completedAt/sessionStartAt
      'not-a-date' ⇒ abgelehnt statt als „nicht absolviert" gedeutet; ein
      Debrief ohne lesbare Zeit oder ohne Revision ⇒ not_comparable — die
      Zeitrichtung ist beweispflichtig.
   5. SHADOW-FALLIDENTITAET OHNE SNAPSHOT-RUECKFALL (shadow-adaptive@6):
      ohne Woche/Plan kollabiert ALLES zu unidentified — der Snapshot-Hash
      blaeht dieselbe Woche nie wieder zu mehreren Faellen auf. BEWUSSTE
      Kohortenaenderung: neuer Pin 9064d4f8 (die alte Sammlung war wegen des
      0033-Constraints ohnehin leer — der Preis ist null).
   6. PFLICHTEINGAENGE JE MODELLVERSION (REQUIRED_INPUTS): Das Modell
      deklariert seine zeittragenden Eingaenge selbst; ein spaeteres Modell
      mit HRV/Schlaf MUSS sie listen, predict() weist Auslassungen ab.
   Dazu: prediction_observer_live_test.mjs — Insert→Read→Kalibrierung gegen
   die ECHTE Instanz (env-gesteuert, exit 2 = uebersprungen, nie gruen).
   Tests: 133 Observer, 184 Shadow, 6 neue Mutationsproben.
   0033 MUSS WEITERHIN EINGESPIELT WERDEN. Verdrahtung weiter ausstehend.

   ---- vorher ----
   v8-289 · INTEGRATIONSBEFUNDE GESCHLOSSEN (2026-08-08):
   Acht Befunde aus Gians Gegenproben gegen das ECHTE System — die
   Fixture-Tests waren gruen, die Integration war es nicht:

   1. MIGRATION 0033: Der 0032-Constraint kannte keine Beobachtungstypen —
      jeder Insert von shadow_observation/prediction_record/
      prediction_evaluation scheiterte STILL. 0033 ersetzt den Constraint
      (0032 bleibt unangetastet — produktiv ist produktiv) und traegt den
      Typ-Index fuers 500er-Fenster. MUSS EINGESPIELT WERDEN, sonst sammelt
      die Abnahme weiter nichts.
   2. KANONISCHER DEBRIEF-VERTRAG (debrief-record@1): gmDbSave delegiert an
      einen reinen Builder mit id, userId, planId, planRevision, createdAt,
      completed, completionPct und der OCCURRENCE-Session-ID
      (occ:<datum>|<t>|<l>) statt der Template-ID, die jede Woche wiederkehrt.
      Die Tests bauen ihre Debriefs mit DERSELBEN Funktion.
   3. OUTCOME LEAKAGE BESEITIGT: planned.durationMin=actual.durationMin ist
      raus — die Ausfuehrung diktierte die Erwartung (expectedRpe skaliert
      mit der Dauer) und completionPct war konstruktionsbedingt 1. Geplante
      Dauer kommt nur noch aus einem echten Minutenfeld; der Builder verwirft
      hineinkopierte Ist-Werte als Schutzschicht.
   4. SHADOW-FALLIDENTITAET: logWeekShadow uebergibt jetzt weekId
      (planDomain.weekKeyFor) und planId (kanonischer Plan) — der Rueckfall
      auf den Snapshot-Hash haette dieselbe Woche wieder mehrfach gezaehlt.
   5. TAGESPRUEFUNG ENTINVERTIERT (prediction-observer@3): day_level_only
      verlangt jetzt predictedAt VOR dem Tag (UTC, konservative Richtung) —
      vorher akzeptierte der Code bis Tagesende, gegen den eigenen Kommentar.
   6. UNLESBARE ZEITSTEMPEL fail-closed (unreadable_timestamp:<quelle>) statt
      still uebersprungen.
   7. IDENTITAET VOLLSTAENDIG: Debrief ohne userId oder planId ⇒
      not_comparable mit Grund — vorher wurde beides durchgewunken (scored!).
   8. RECONCILIATION nutzt die Modellversion DER VORHERSAGE — ein Pending-Fall
      ueberlebt jetzt einen Modellwechsel.
   Dazu: prescriptionHashOf + expectedRpeEvidence (veraendert die Bandbreite) ·
   PRIOR und API eingefroren (0.85 war zur Laufzeit auf 0.1 setzbar) ·
   calibrate weist pending als eigenen Zaehler aus, n = Summe der Unterzaehler.
   Test: prediction_observer_test.mjs (120) inkl. ECHTER Builder-Kette,
   7 Mutationsproben. Verdrahtung von predict/resolve weiterhin ausstehend.

   ---- vorher ----
   v8-288 · OBSERVER-HAERTUNG VOR DER VERDRAHTUNG (2026-08-08):
   prediction-observer@2 — vier Vertragspunkte aus dem Review geschlossen:

   1. EINE VORHERSAGE ENTSTEHT VOR DEM EREIGNIS — WIRKLICH. predictedAt allein
      beweist nichts: Ein Planlauf kann nach der Einheit stattfinden (alter
      Plan geoeffnet, Sync nachgeholt). Jetzt fail-closed: absolvierte Einheit
      oder vorhandenes Debrief ⇒ abgelehnt · bekannte Startzeit ⇒ predictedAt
      muss strikt davor liegen · nur Tagesdatum ⇒ Vorhersage nur VOR dem Tag,
      Record weist `timingBasis: day_level_only` aus · gar kein Zeitbezug ⇒
      abgelehnt. Eine „Vorhersage" ohne pruefbaren Zeitbezug ist eine
      Nacherzaehlung mit Stempel.

   2. INTEGRITAET, NICHT AUTHENTIZITAET. Der Hash im selben Record erkennt
      versehentliche Aenderungen — wer Record UND Hash aendern kann, berechnet
      beide neu. Der Befund heisst jetzt `integrity_mismatch`; „tampered"
      kommt im Modul nicht mehr vor (Test prueft das Wort). Echte
      Manipulationssicherheit braeuchte serverseitige Signaturen.

   3. ZEITTRAGENDE EINGAENGE SIND DEKLARATIONSPFLICHTIG. `inputs: [{name, at}]`
      ist die zentrale Liste; ein Eintrag ohne Zeitpunkt wird vom MODUL
      abgelehnt (input_without_timestamp:<name>) — nicht vom Aufrufer frei
      entschieden. Deklarierte Eingaenge laufen durch die Leakage-Pruefung.

   4. PREDICT UND RESOLVE DUERFEN SICH UEBERHOLEN. Fehlt die Vorhersage beim
      Debrief, ist das `pending` (KEIN Endzustand); reconcile() verbindet
      spaeter ueber die EXAKTE Kombination {userId, sessionId, planId,
      planRevision, prescriptionHash, modelVersion} — nichts Schwaecheres.
      Andere Revision oder andere Prescription verbinden nie.

   Dazu: PRIOR.basis maschinenlesbar im Record (0.85 population_prior [S],
   Bandbreiten policy_assumption [A]) — schwache Evidenz RECHTFERTIGT ein
   breiteres Band, sie beweist die Breite nicht.
   Test: prediction_observer_test.mjs (90), 6 neue Mutationsproben.
   Kohorten-Pin 1fe286bb weiterhin unberuehrt. Verdrahtung folgt getrennt.

   ---- vorher ----
   v8-287 · PREDICTION OBSERVER (2026-08-08):
   js/engine/prediction-observer.js — Vorhersage und Kalibrierung als reiner
   Beobachter AUSSERHALB der eingefrorenen Abnahmekohorte (der Pin 1fe286bb
   bleibt unberuehrt; ein Test prueft, dass der Observer kein Kohortenmodul
   importiert). Ein Messinstrument, keine Learning Engine: „Was hat ORVIA
   vorhergesagt, wie lag es daneben, wo ist das Modell systematisch zu
   optimistisch oder pessimistisch?"

   ERWARTUNG ≠ VORHERSAGE: prescriptionExpectation (Trainingsziel, normativ)
   und modelPrediction (RPE-Band, Completion-Wahrscheinlichkeit,
   Zone-Hit-Band; model population_prior, individualized false, evidence
   weak) sind getrennte Konzepte mit eigener MODELLVERSION — ein spaeteres
   individuelles Modell aendert die Prognose, nie die Prescription. KEINE
   Toleranz je Einheit: Toleranz ist ein abgeleiteter Zustand aus mehreren
   Einheiten, nicht die Prophezeiung der eigenen Klassifikation.

   INVARIANTEN: eingefroren VOR dem Ergebnis (deepFreeze + immutableHash,
   Manipulation faellt beim Nachrechnen auf) · Future Leakage fail-closed
   (kein Eingang nach predictedAt) · deterministische ID je Session +
   Planrevision + Modellversion · aufgeloest nur bei passendem Nutzer,
   Session, Revision und Prescription-Hash (sonst superseded /
   not_comparable, mit Grund) · KEIN Debrief heisst unresolved, niemals
   Misserfolg · append-only: die Auswertung ist ein eigener Record ·
   Kalibrierung nur je {Modellversion, Sportart, Sessiontyp}, jede Kennzahl
   mit Fallzahlen (RPE: mittlerer Fehler + Intervallabdeckung · Completion:
   Brier + Basisrate · Aufloesungsquote).

   decision-log@3: prediction_record / prediction_evaluation als eigene
   Beobachtungstypen, von explain() ausgeschlossen. Die Shadow-Abfrage
   filtert serverseitig VOR dem Limit — Vorhersagen koennen die
   Shadow-Beobachtungen nicht aus dem 500er-Fenster verdraengen (Test).
   Test: prediction_observer_test.mjs (67), 6 Mutationsproben.
   Verdrahtung (predict beim Planlauf, resolve beim Debrief) folgt getrennt.

   ---- vorher ----
   v8-286 · LETZTE INVARIANTEN + KOHORTE EINGEFROREN (2026-08-08):
   Vier Invarianten verifiziert, zwei davon mussten korrigiert werden
   (shadow-adaptive@5) — der letzte guenstige Moment, weil die Sammlung noch
   bei null stand:

   1. FALL-IDENTITAET ≠ IDEMPOTENZSCHLUESSEL. independentCases zaehlte
      Snapshots — dieselbe Woche, fuenfmal mit gewachsenen Daten gerendert,
      waere fuenf „unabhaengige" Faelle gewesen. Jetzt: caseKeyOf() =
      Nutzer + Woche + Plan; ohne bestimmbare Identitaet kollabiert alles
      fail-closed zu EINEM Fall (nichts wird aufgeblaeht).
   2. PARTIAL NIMMT KEINE FACHLICHEN ZUSTAENDE AB. Machbarkeitszustaende,
      review-Faelle und Sonderphasen zaehlen nur aus vollstaendigen (status
      ok) Beobachtungen — eine uebersprungene Stufe kann nichts belegen.
      plan_unchanged gilt weiter fuer ALLE, auch partial: Die Nicht-Mutation
      kennt keine Ausnahme.
   3. Ring-Filter FAIL-CLOSED: ohne eindeutige userId (und ohne bekannten
      aktuellen Nutzer) belegt der lokale Ring nichts.
   4. Reihenfolge-Unabhaengigkeit der Abnahme als Eigenschaftstest (die
      absteigende Datenbankabfrage praegt das Ergebnis nicht).

   DIE KOHORTE IST EINGEFROREN: supabase/tests/_acceptance-cohort.json pinnt
   die 15 Vertragsversionen (Schluessel 1fe286bb). Jede Aenderung an einem
   Kohortenmodul bricht den Test mit Klartext („Belegsammlung beginnt neu")
   und verlangt eine BEWUSSTE Bestaetigung — nebenbei passiert das nie mehr.
   Ab jetzt gilt: v8-286 stabil halten, Belege sammeln.
   Test: shadow_adaptive_test.mjs (183), 3 neue Mutationsproben + Pin-Probe.

   ---- vorher ----
   v8-285 · ABNAHMEVERTRAG VOLLSTAENDIG + BELEGSTAERKE (2026-08-08):
   Antwort auf das Review „bereit fuer Shadow, nicht fuer Anwendung":

   1. DER ABNAHMEVERTRAG UMFASST JETZT ALLE END-TO-END-ABHAENGIGKEITEN
      (shadow-adaptive@4 / shadow-policy@2). Die Vier-Module-Kohorte war zu
      eng: Die Shadow-Aussage haengt auch an load-history, session-debrief,
      evidence, load-profile, week-plan-designer und week-plan-policy.
      COHORT_FIELDS fuehrt 15 explizite Versionen — keine Registry, eine
      benannte Liste. Aendert sich load-history, trennen sich die Kohorten.

   2. ACHT GRUENE KAESTCHEN SIND KEINE ABNAHME. Jedes Kriterium traegt jetzt
      Belegstaerke: independentCases, realCases, fixtureCases,
      firstObservedAt, lastObservedAt — und MINDESTFALLZAHLEN [A]
      (plan_unchanged 5 · full_chain 3 · no_positive 5 · reproducible 3 ·
      deviation_explainable 2, echte unabhaengige Faelle). Reproduzierbar ist
      nur, was WIEDERHOLT und dabei identisch geblieben ist — Stille ist kein
      Beleg. Zehn Render desselben Plans bleiben EIN Fall.

   3. ZWEI BETRIEBSFEHLER GESCHLOSSEN: Die 500er-Abfrage sortierte AUFSTEIGEND
      und haette die aeltesten Eintraege geladen — irgendwann ausschliesslich
      fremde Kohorten, die aktuellen unsichtbar (jetzt neueste zuerst, als
      Vertrag getestet). Und der lokale Ring ueberlebt einen Nutzerwechsel im
      Tab — Beobachtungen tragen jetzt ihren Nutzer und werden gefiltert.

   Dazu: Stufendauern je _guard (injizierte Uhr) und operational.partialRate
   in der Abnahme — das 250-ms-Budget kann eine laufende Stufe nicht
   unterbrechen; ob es traegt, zeigt die Quote.
   Test: shadow_adaptive_test.mjs (174), 5 neue Mutationsproben.

   ---- vorher ----
   v8-284 · ABNAHME: PERSISTENZ, KOHORTE, BELEGARTEN (2026-08-07):
   Drei Schaerfungen VOR der Belegsammlung — sonst waere die Abnahme formal
   erfuellbar, ohne etwas zu belegen:

   1. VERSIONSKOHORTE (shadow-adaptive@3). Eine Beobachtung nimmt nur den Code
      ab, den sie AUSGEFUEHRT hat. acceptance() filtert auf identische
      Vertragsversionen (shadow-adaptive, goal-feasibility, progression,
      plan-translator, je Modul UND Policy); fremde Kohorten werden gezaehlt
      und ausgewiesen, nie bewertet. Der Uebersetzer steht mit in der
      Kohorte, weil die Abnahme SEINE Aktivierung gatet — jede Beobachtung
      fuehrt seine Version seit @3 mit.

   2. BELEGARTEN GETRENNT. Sicherheitspfade (Krankheit, Taper, Deload, review)
      duerfen per Fixture abgenommen werden — ein Pfad, der nie real auftritt,
      ist sonst nicht pruefbar. Der ALLTAG laesst sich nicht simulieren:
      plan_unchanged, full_chain, deviation_explainable,
      no_positive_without_auto und reproducible zaehlen NUR aus echten
      Beobachtungen (REQUIRE_REAL). Jedes Kriterium weist seine Belegbasis
      aus; „nur Fixtures" erfuellt kein Alltagskriterium.

   3. PERSISTENZ. shadowAcceptance() liest zuerst die dauerhafte Historie
      (engine_decision_log, RLS), der lokale Ring ist nur der AUSGEWIESENE
      Notbehelf (acc.source) — eine Abnahme, die nur den Tab liest, vergisst
      jede Woche neu.

   Dazu adaptive-card@2: zentrales Escaping inkl. einfacher Anfuehrungszeichen
   (Attributkontexte), als Fuzz ueber JEDES String-Feld des Views getestet —
   ein neues Feld, das am Escaping vorbeigeht, faellt im Test auf.
   Tests: shadow_adaptive_test.mjs (151), adaptive_card_test.mjs (50),
   6 neue Mutationsproben (Kohortenfilter entfernt · Fixtures als echt ·
   full_chain per Fixture · Uebersetzer aus der Kohorte · Apostroph-Escaping ·
   Escaping neutralisiert — jede gefangen).

   ---- vorher ----
   v8-283 · SICHTBARE ERKLAERUNG · ADAPTIVE KARTE (2026-08-07):
   js/adaptive-card.js + Container #adaptiveCard auf der Planseite. Die Karte
   ist eine SICHTSCHEIBE auf den Schattenbetrieb — kein Aktivierungspfad.

   ARCHITEKTUR FOLGT DEM TESTANSPRUCH: View-Aufbau und HTML-Erzeugung liegen in
   einem reinen, in Node ausfuehrbaren Modul (kein DOM, kein PROFILE, kein
   Storage, keine Uhr). Nur so ist das entscheidende Versprechen als VERHALTEN
   testbar statt als Quelltextsuche: Karte dreimal rendern -> Plan, Profil und
   Snapshot byte-identisch, keine Speicherfunktion aufgerufen (Spione auf
   save/saveProfile/savePlan/localStorage). ui.js behaelt nur die Delegation
   (getAdaptiveExplanation) und einen Einhaenger, der ausschliesslich
   render(view) in den Container schreibt.

   DIE NEUN REGELN, JEDE ALS TEST: nur der View wird dargestellt · keine eigene
   Engine-Rechnung im Renderer · stale/partial/insufficient_data sichtbar
   verschieden (bei stale KEINE scheinbar aktuelle Vorher/Nachher-Liste) ·
   within_modeled_corridor wird NIE zu „machbar" (verbotene Woerter ueber 16
   Karten geprueft) · population_prior verstaendlich uebersetzt („Erfahrungs-
   werte vergleichbarer Sportler — kein auf dich individualisiertes Modell",
   Beleglage benannt) · jede Aenderung nennt Sportart und Geltungsbereich ·
   fail-soft LEER statt halber Karte · GAR KEINE Schaltflaeche (eine Karte ohne
   Interaktionspfad kann nicht zum Aktivierungspfad werden) · Nutzereingaben
   escaped.

   Uebersetzer-Sperre Fassung 3: ui.js erwaehnt planTranslator wieder NIRGENDS;
   das Lesen fuer die Vorschau lebt im Kartenmodul, nur gegen den
   Snapshot-Plan, ohne preview(). Test: adaptive_card_test.mjs (45, davon der
   Verhaltenstest), plan_translator_test.mjs (102), 7 Mutationsproben (u.a.
   eingebauter Anwenden-Knopf, „machbar"-Formulierung, Live-Plan in der
   Vorschau — jede gefangen).

   ---- vorher ----
   v8-282 · ANKER-LEBENSZYKLUS + VIEW-VERTRAG (2026-08-07):
   Zwei Lebenszyklusfragen VOR der Erklaerungs-UI geschlossen:

   1. baseMin HAT EINEN LEBENSZYKLUS (plan-translator@2). Der Anker haengt
      nicht fuer immer an der ersten akzeptierten Dauer — sonst zoege die
      Ratschenklemme, die maschinelles Wegdriften verhindert, eine ECHTE
      Nutzerentscheidung zurueck (derselbe Fehler, umgekehrtes Vorzeichen).
      Der Stempel traegt seine Herkunft (basePlanId, basePlanRevision,
      baseSource) und gilt NUR fuer dieselbe: gleiche Revision -> halten;
      neue Revision, neuer Plan oder user_edit -> Anker = aktuelle Dauer.
      preview() stempelt die volle Herkunft und ERSETZT fremde Stempel.

   2. SICHTBARE ERKLAERUNG NUR UEBER DEN VIEW-VERTRAG. Die UI haengt nicht an
      der privaten Struktur _lastShadow, sondern an
      ORVIA.getAdaptiveExplanation(): Beobachtung, Machbarkeit und
      Uebersetzer-Vorschau stammen aus DEMSELBEN eingefrorenen Snapshot (der
      Uebersetzer laeuft gegen snap.currentPlan, NIE gegen den Live-Plan);
      weicht der Live-Plan ab -> stale:true, fail-closed auch im Fehlerfall.
      Datensparsam: keine Debriefs, keine Aktivitaeten, keine internen Hashes.

   DIE AKTIVIERUNGSSPERRE IST PRAEZISIERT, NICHT AUFGEWEICHT: Der Uebersetzer
   darf in ui.js NUR innerhalb von getAdaptiveExplanation vorkommen, nur
   lesend, nur gegen den Snapshot — kein preview()-Aufruf, kein Schreiben in
   PROFILE.weekPlan, kein saveProfile. Der Test prueft jede Fundstelle.
   Test: plan_translator_test.mjs (104), 16 Mutationsproben.

   ---- vorher ----
   v8-281 · STUFE 6a · PLAN-UEBERSETZER (2026-08-07):
   js/engine/plan-translator.js uebersetzt targetLoad + dimensionPolicy in
   einen AENDERUNGSVORSCHLAG — gebaut und vollstaendig getestet, aber NICHT
   verdrahtet: Die produktive Anwendung bleibt gesperrt, bis die acht
   Shadow-Abnahmekriterien erfuellt sind. plan_translator_test.mjs prueft die
   Sperre selbst (ui.js ruft den Uebersetzer nirgends auf); wer ihn aktiviert,
   muss diesen Test bewusst aendern und damit die Abnahmefrage beantworten.

   DAS PROBLEM IST UNTERBESTIMMT — viele Wochen erreichen dieselbe Ziellast.
   Auswahlregel: MINIMALE ABWEICHUNG VOM AKZEPTIERTEN PLAN. Einheiten erhalten
   -> Dauer im Rahmen anpassen -> nur bei Frequenz-Policy hoechstens EINE
   Einheit entfernen (nie erfinden) -> Intensitaet nur im Scope entschaerfen.

   DER WICHTIGSTE BEFUND BEIM BAU: Die Skalierklemme [0.75, 1.25] war zunaechst
   an der AKTUELLEN Dauer verankert. Bei geklemmtem Faktor holte sich jede
   erneute Uebersetzung ein weiteres Viertel (50 -> 65 -> 80 -> ...) — eine
   Ratsche, keine Uebersetzung; in der Reduktionsrichtung (Taper, 0.75^n) die
   gefaehrlichere Variante. Jetzt: `baseMin` haelt die akzeptierte Dauer fest,
   preview() stempelt sie beim ersten Anpassen, die Klemme bindet an SIE.
   Fuenf Runden Wiederanwendung veraendern nichts mehr (Eigenschaftstest).

   KEINE BEHAUPTETE EXAKTHEIT: achievedLoad, residualGap, gapStatus mit
   benannten Gruenden (scale_clamped, manual_units_fixed, ...). Manuelle
   Einheiten sind unantastbar UND werden nicht durch Extremaenderungen anderer
   kompensiert. Jeder Vorschlag traegt requiresPolicyPass — week-plan-policy
   bleibt der einzige Schreiber. refs fuehren targetLoad, Korridor,
   Auswahlgrund, Snapshot: Zwei Ziele koennen nach Klemmung und Rundung
   identische Aenderungen ergeben; der Vorschlag muss trotzdem sagen, WESSEN
   Uebersetzung er ist. Lasteinheit ausgewiesen (systemic_per_known_day, x7).
   Test: plan_translator_test.mjs (87), 11 Mutationsproben.

   ---- vorher ----
   v8-280 · SHADOW-BETRIEBSDETAILS (2026-08-07):
   Zwei Absicherungen VOR der Beobachtungsphase — beide Betriebs-, nicht
   Logikfragen:

   1. UI-LATENZ: try/catch schuetzt den Plan, aber nicht die Fluessigkeit der
      Oberflaeche. Der Snapshot entsteht weiterhin SYNCHRON im Plan-Tick (er
      muss exakt den Zustand einfrieren, aus dem der Plan hervorging); die
      Beobachtung laeuft danach verzoegert (requestIdleCallback, sonst
      setTimeout) und IMMER mit Uhr und Zeitbudget. Ein Test verhindert, dass
      die Produktionsverdrahtung je ohne Budget laeuft — ein Budget, das nur im
      Test uebergeben wird, schuetzt gar nichts.

   2. IDEMPOTENZBEREICH: Die Bewertungsidentitaet (userId, weekId, planId)
      steht jetzt AUSDRUECKLICH im Schluessel, nicht nur transitiv im
      Snapshot-Hash. Sonst koennten zwei Nutzer mit zufaellig identischen Daten
      zu EINER Beobachtung verschmelzen — und ein Snapshot-Umbau, der die
      Felder verloere, bliebe unbemerkt. shadow-adaptive@2.

   ZWEI TESTLUECKEN DABEI GESCHLOSSEN (Mutationsproben M9/M11): Die
   userId-Pruefung unterschied Nutzer nur ueber den Snapshot-Hash — jetzt mit
   festgehaltenem Hash direkt gegen die Schluesselkomposition. Und die
   Verzoegerungs-Regex traf das Wort `requestIdleCallback` im KOMMENTAR — ein
   Test, der Kommentare prueft, prueft Prosa. Anker ist jetzt der Aufruf.
   Test: shadow_adaptive_test.mjs (137), 12 Mutationsproben.

   ---- vorher ----
   v8-279 · SHADOW MODE (C1 -> C2 -> Stufe 5, 2026-08-07):
   js/engine/shadow-adaptive.js rechnet die adaptive Kette bei JEDEM Planlauf mit
   und schreibt sie als BEOBACHTUNG ins Decision Log — ohne den Plan zu
   veraendern. `planMutation: 'none'` ist keine Absprache, sondern Bauform: Das
   Modul bekommt den fertigen Plan und hat keinen Rueckgabepfad, ueber den eine
   Aenderung entstehen koennte.

   ACHT ZUSAGEN, JEDE ALS TEST:
     1 Shadow an/aus ⇒ byte-identische Plaene (Aufrufstelle im Quelltext geprueft)
     2 Fehler, Timeout, fehlende Daten aendern nichts — jede Stufe in _guard(),
       Zeitbudget mit INJIZIERTER Uhr
     3 EIN eingefrorener Snapshot fuer beide Zweige — sonst waere eine Abweichung
       nicht zuzuordnen: Logik oder zwischenzeitliche Datenaenderung?
     4 jeder Vergleich traegt Cache-Key, Audit-Hash und alle Vertragsversionen
     5 gleicher Snapshot + gleiche Versionen ⇒ gleicher idempotencyKey; der
       zweite Lauf ist `repeat`, nicht die zweite Beobachtung
     6 provisionalTargetLoad und autoApplicable:false bleiben beobachtend —
       mit benanntem Sperrgrund, und die C2-Asymmetrie bleibt: Senken darf immer
     7 Abweichungen strukturiert: Menge, Intensitaet, Frequenz, Scope, Begruendung
     8 acht FALLKRITERIEN entscheiden, nie die Kalenderzeit — 200 ereignislose
       Laeufe nehmen nichts ab

   ZWEI BEFUNDE BEIM BAU: Eine ausdrueckliche Registry gilt jetzt STRIKT (der
   Rueckfall auf global geladene Module haette einen Fehlzustand als „ok"
   gemeldet), und negative Kriterien brauchen mindestens eine Beobachtung —
   „kein Verstoss unter null Faellen" ist kein Beleg.

   decision-log@2: eigener Typ `shadow_observation`, von explain() ausgeschlossen.
   Eine Beobachtung hat den Plan nicht geformt und darf ihn nicht erklaeren.
   Test: shadow_adaptive_test.mjs (124), 8 Mutationsproben.

   ---- vorher ----
   v8-278 · CACHE-SCHLUESSEL UND MODELLSTATUS (Stufe 5, 2026-08-07):
   ZWEI HASHES STATT EINEM. Der Cache-Schluessel hing bisher an der gesamten
   globalen Modul-Registry — damit haette allein das Nachladen von
   `session-debrief` ihn veraendert, obwohl dieses Modul das Ergebnis gar nicht
   beeinflussen kann. Folge waeren ladezeitabhaengige Schluessel, unnoetige
   Cache-Misses und schlecht reproduzierbare Ergebnisse gewesen. Jetzt getrennt:
     cacheKey(input)             „darf ich das Urteil wiederverwenden?" — nur
                                 direkte und transitive Entscheidungsabhaengig-
                                 keiten, alle Versionen AUS DEM EINGANG
     auditHash(input, registry)  „unter welchem Gesamtzustand entstand es?" —
                                 bewusst breit, fuers Decision Log
   `feasibility()` nimmt deshalb keine Registry mehr: Sein Ergebnis haengt
   ausschliesslich vom Eingang ab.

   DAS ERREICHBARE BAND TRAEGT SEINEN MODELLSTATUS. C2 liefert zulaessige LAST;
   ohne individuelles Response Model folgt daraus keine vorhersagbare
   Leistungsverbesserung. Die Skalierung des Bandes mit dem Korridor war genau
   diese Abbildung — nur unbeschriftet. Jetzt: model 'population_prior',
   individualized false, Provenance je Bestandteil ([S] Erfahrungswerte,
   [A] Modellannahme). Sonst koennte `within_modeled_corridor` sauber aussehen
   und intern doch scheinpraezise sein.

   `earliestWeeks` -> `estimatedWeeksRange` {min, max, open}. Ein Feld namens
   „frueheste Wochen" darf keine spaeteste Grenze enthalten. Rate 0 ⇒ null statt
   „unendlich"; untere Kante 0 ⇒ open true statt einer erfundenen Zahl.
   goal-feasibility@2 / gf-policy@2.
   Test: goal_feasibility_test.mjs (152), 14 Mutationsproben.

   ---- vorher ----
   v8-277 · STUFE 5 · ZIELMACHBARKEIT (Bauplan Abschnitt 7, 2026-08-07):
   js/engine/goal-feasibility.js — ein REINER BEWERTER. Er beschreibt Zielbedarf,
   erreichbare Trajektorie, Luecke und Unsicherheit; er verordnet keine Belastung
   und veraendert den C2-Korridor nie. Die Abhaengigkeit laeuft von C2 hierher:
   C2 berechnet, was zulaessig ist, Stufe 5 VERGLEICHT es mit dem Bedarf. Waere es
   umgekehrt, erzeugte ein unrealistisches Ziel dauerhaft Druck bis an die
   Guardrail-Decke, ohne dass irgendwo „das geht nicht" stuende.

   DREI ZUSTAENDE, NIE „MACHBAR": within_modeled_corridor · outside_modeled_corridor
   · insufficient_data. Bewertet wird, was das heutige Modell traegt — Modellgrenze
   ist nicht biologische Gewissheit.

   VIER SPERREN, DIE EINE POSITIVE AUSSAGE VERHINDERN: kein entscheidungsfaehiger
   Leistungswert · kein Leistungsniveau · unbekannte Metrikrichtung · eine von C2
   nicht freigegebene Progression (targetLoad null bzw. autoApplicable false).
   Der letzte Punkt schliesst die Hintertuer, durch die `provisionalTargetLoad`
   sonst doch noch zu einer Erreichbarkeitsaussage gefuehrt haette.

   DIE RICHTUNG DER METRIK WIRD NIE GERATEN. Ob „besser" einen kleineren oder
   groesseren Zahlenwert bedeutet, entscheidet ueber das Vorzeichen des gesamten
   Bedarfs; ein falsches Vorzeichen macht aus „10 % noetig" ein „bereits erreicht"
   und sieht dabei nicht wie ein Fehler aus. Eine Heuristik ueber Teilzeichenketten
   waere an `cssSecPer100` und `metricType: 'time'` gescheitert. Deshalb: Tabelle
   oder ausdrueckliche Angabe — sonst insufficient_data.
   Test: goal_feasibility_test.mjs (123), sieben Mutationsproben.

   ---- vorher ----
   v8-276 · SCOPE STRUKTURIERT STATT ALS STRING (C2-Abschluss, 2026-08-07).
   `'highIntensity/running'` als blanker String waere ausreichend, solange er
   ausschliesslich als undurchsichtiger Schluessel VERGLICHEN wird — aber er
   laedt dazu ein, an mehreren Stellen mit split('/') zerlegt zu werden, und beim
   vierten Aufruf steht dann ein Sportname mit Schraegstrich darin. Deshalb:
     scope: { key: 'highIntensity/running',
              domain: 'highIntensity', sport: 'running', all: false }
     scope: { key: 'all', domain: null, sport: null, all: true }
   Die Form ist IMMER dieselbe, auch bei „all" — ein Feld, das mal String und mal
   Objekt ist, erzeugt genau die Fallunterscheidungen, die es vermeiden sollte.
   `scopeOf()` ist die EINZIGE Stelle, die den Schluessel baut; ein Test prueft,
   dass das Modul ihn nirgends per split zerlegt. Zusaetzlich `scopeKey` als
   Kurzform fuer Anzeige und Log.
   Test: progression_test.mjs (217).

   DAMIT IST DER C2-VERTRAG VOLLSTAENDIG:
     Bezugsbasis -> zulaessiger Korridor -> gewaehlte Veraenderung ->
     Policy-Begruendung -> absolute Ziellast -> Veraenderung gegenueber Referenz
     UND Vorwoche -> dimensions- und kontextspezifische Ausfuehrung mit
     strukturiertem Geltungsbereich.
   Naechster Baustein: Stufe 5 Goal Feasibility (reiner Bewerter).
   v8-275 · GELTUNGSBEREICH DER INTENSITAETSVORGABE + WORTLAUT = VERTRAG
   (C2-Abschluss, 2026-08-07).
   (1) SCOPE. Ein Vertraeglichkeitssignal aus `highIntensity/running`
   rechtfertigt, die harten LAUFEINHEITEN zurueckzunehmen — nicht die lockeren
   Laeufe und schon gar nicht Rad oder Schwimmen. Der Geltungsbereich war im Code
   bereits berechnet, wurde aber beim Zusammenbau des Ergebnisses VERWORFEN; ein
   Planer haette `intensityPolicy: 'reduce'` pauschal angewendet und ein eng
   umrissenes Problem in eine allgemeine Drosselung uebersetzt. `dimensionPolicy`
   traegt jetzt `scope`: 'all' bei Taper, Deload, Krankheit und Aufbau —
   'highIntensity/running' bzw. die tatsaechlich ausloesende Zelle bei einem
   Toleranzsignal. Fehlt der Scope, steht null: Der Planer muss nachfragen statt
   fail-open pauschal zu drosseln.
   (2) WORTLAUT UND VERTRAG MUESSEN DIESELBE SEMANTIK HABEN. Die Taper-Notiz sagte
   „bei ERHALTENER Intensitaet und Frequenz", waehrend der Vertrag
   `frequencyPolicy: 'maintain_or_slightly_reduce'` fuehrte — genau die
   Zweideutigkeit, die dieser Block verhindern soll. Die Notiz lautet jetzt
   „Volumenreduktion bei ERHALTENER Intensitaet; die Frequenz bleibt erhalten
   oder sinkt nur leicht" und wird gegen den Vertrag geprueft.
   Test: progression_test.mjs (211). Damit ist der C2-Vertrag vollstaendig:
   Bezugsbasis -> Korridor -> Auswahl -> Policy-Begruendung -> absolute Ziellast
   -> Veraenderung gegenueber Referenz und Vorwoche -> dimensions- und
   kontextspezifische Ausfuehrung mit Geltungsbereich.
   v8-274 · BELEGT IST DER KORRIDOR, NICHT DIE AUSWAHL + VOLUMEN != ALLE DIMENSIONEN
   (C2-Abschluss, 2026-08-07).
   (1) `midpoint_of_evidence` liess sich lesen, als sei der Mittelpunkt selbst
   belegt. Belegt ist der BEREICH; die Auswahl darin ist Politik. Die Namen sagen
   das jetzt: policy_conservative_edge (aeusserster Rand),
   policy_midpoint_of_evidence_range (Taper), policy_midpoint_of_convention_range
   (Deload), policy_midpoint_of_range. Ausserdem war „conservative_default" bei
   Toleranz `poor` doppelt ungenau: -10 % ist im Korridor -20 bis -5 die MITTE,
   nicht der konservativste Wert. Heisst jetzt policy_midpoint_of_range.
   (2) Ein Prozentwert beschreibt VOLUMEN, nicht alle Dimensionen. „Taper -50 %"
   ist eine Volumenreduktion bei ERHALTENER Intensitaet und Frequenz — genau
   daran haengt die Wirkung. Wuerde ein Planer daraus „alles halbieren" machen,
   waere die evidenzgestuetzte Empfehlung beim Uebersetzen in Einheiten fachlich
   verfaelscht. Jede Empfehlung traegt deshalb `dimensionPolicy` mit getrennten
   Angaben:
     Taper     vol -50 · Intensitaet maintain           · Frequenz maintain_or_slightly_reduce
     Deload    vol -25 · Intensitaet reduce_or_maintain · Frequenz maintain
     Krankheit vol -40 · Intensitaet reduce             · Frequenz maintain_or_reduce
     Pause     vol -40 · Intensitaet reduce_initially   · Frequenz maintain
     Toleranz  vol -10 · Intensitaet reduce             · Frequenz maintain
     Aufbau    vol  +3 · Intensitaet maintain           · Frequenz maintain
   Der Gegenbeweis steht im Test: Taper und Krankheit senken beide das Volumen,
   verlangen aber ENTGEGENGESETZTE Intensitaetspolitik.
   Test: progression_test.mjs (199).
   v8-273 · JEDE ZAHL IST EINE AUSWAHL AUS EINEM KORRIDOR.
   Auch eine ABSENKUNG ist eine Auswahl. „−40 %" nach Krankheit sah aus wie eine
   physiologisch exakte Zahl, stammt aber aus einem Bereich von −40 bis −30 —
   der Korridor existierte in returnRecommendation und ging im Ergebnis von
   progressionDecision verloren. Dasselbe galt fuer Taper (−50), Deload (−25)
   und die toleranzbedingte Absenkung (−10).
   Ab jetzt traegt JEDE Ausgabe `allowableRange`, `selectedDelta` und
   `selectionReason`:
     Krankheit/Pause  -40 aus [-40,-30]  conservative_default
     Taper            -50 aus [-60,-40]  midpoint_of_evidence   (metaanalytisch
                                          40-60 % Volumenreduktion bei erhaltener
                                          Intensitaet und Frequenz)
     Deload           -25 aus [-30,-20]  convention_midpoint    (Konvention,
                                          keine Messgroesse)
     Toleranz poor    -10 aus [-20,-5]   conservative_default
     Normalfall        +3 aus [0,8]      adaptive_default
   Damit bleibt erkennbar, dass die Engine konservativ aus einem Bereich
   ausgewaehlt hat, statt eine Genauigkeit zu behaupten, die die Evidenz nicht
   hergibt. Geprueft ueber alle sieben Ausgangsarten: jede traegt einen Korridor,
   die gewaehlte Zahl liegt immer darin, jede Auswahl nennt ihren Grund.
   Ausserdem: Die neun Invarianten fuer Stufe 5 (Goal Feasibility) stehen jetzt
   im Bauplan — reiner Bewerter, Leistungsraum statt Lastprozent, Band statt
   Punktprognose, `within_modeled_corridor` statt „machbar".
   Test: progression_test.mjs (183).
   v8-272 · GRUENDE MIT FOLGEWIRKUNG + KEINE STILLE STEIGERUNG (C2-Abschluss).
   (1) Ein BEKANNTER Grund ist keine Freigabe. Die Gruende-Tabelle validiert
   nicht nur Werte, sie ordnet jedem Wert genau EINE Folgewirkung zu:
   planned_rest/deload/race_taper/race_week/planned_travel -> Ruecksprung auf die
   chronische Basis; `illness` -> Krankheitspfad mit Symptomfreiheit zuerst und
   ohne Einstiegsprozent; `injury` -> Kriterienpfad ganz ohne Prozentwert;
   `missing_data` und unbekannt -> review. Vorher landeten „krank" und „verletzt"
   im allgemeinen Review — die Symptomfreiheit waere nie abgefragt worden.
   Ein als Krankheit oder Verletzung benannter Grund IST jetzt eine erklaerte
   Unterbrechung und landet in Stufe 1.
   (2) KEINE AUTOMATISCHE PLANAENDERUNG OHNE HANDLUNGSFAEHIGKEIT — aber nur in
   der riskanten Richtung. Nicht handlungsfaehige STEIGERUNGEN stehen in
   `provisionalTargetLoad`, `targetLoad` ist null, `autoApplicable` false: Wer
   `targetLoad` blind liest, bekommt nichts statt einer ungeklaerten Steigerung.
   Eine ABSENKUNG oder ein Halten bleibt immer anwendbar — eine Reduktion nach
   Krankheit zu blockieren waere das Gegenteil von Sicherheit, der Plan bliebe
   auf dem alten Niveau stehen. Dieselbe Asymmetrie wie bei den Guardrails.
   Geprueft ueber 14 Ausgaenge: nie eine automatisch anwendbare Steigerung ohne
   Handlungsfaehigkeit, nie beide Zielfelder gleichzeitig gesetzt.
   Test: progression_test.mjs (172).
   v8-271 · KONDITIONIERTER REBOUND (C2-Korrektur, 2026-08-07):
   deload rebound  !=  unexplained low-load rebound.
   Bisher kehrte die Progression nach einer niedrigen Vorwoche unbesehen auf die
   chronische Basis zurueck — ein Sprung von +37 % mit Status `ok`. „25 % unter
   dem Mittel" BEWEIST aber keine verkraftete Entlastungswoche: Dieselbe Zahl
   entsteht bei Krankheit, Verletzung, unvollstaendiger Aufzeichnung, ungeplanter
   Unterbrechung oder schlechter Vertraeglichkeit. Ein unkonditionierter
   Ruecksprung haette ausgerechnet dort am staerksten gesteigert, wo die Ursache
   unbekannt ist.
   Neue Stufe 2b: Ist die Vorwoche mehr als 15 % unter der Referenz, muss der
   Grund bekannt sein — plangemaess (Phase `deload`/`taper` oder ein Grund aus
   der geschlossenen Liste PLANNED_LOW) UND die Wochendaten vollstaendig
   (>= 75 %). Sonst faellt die Bezugsgroesse fuer diese Entscheidung auf die
   letzte Woche zurueck, die Rueckkehr geschieht ueber mehrere Wochen statt in
   einem Sprung, und das Ergebnis erhaelt `status: 'review'` mit
   `actionable: false` und einer konkreten Rueckfrage (geplante Entlastung,
   Krankheit oder fehlende Eintraege?) statt eines stillen Aufbaus.
   Ein unbekannter Grund ist kein Grund: Die Gruende-Liste ist geschlossen.
   Geprueft ueber 15 Kombinationen: ohne erklaerten Grund uebersteigt die
   Ziellast nie die letzte Woche plus die normale Decke.
   Test: progression_test.mjs (149).
   v8-270 · BEZUGSBASIS DER PROGRESSION (C2-Korrektur, 2026-08-07).
   `delta: +3` beantwortet fuer sich genommen nicht, worauf sich die 3 Prozent
   beziehen — und die Antwort ist nicht trivial: auf das STABILE 28-Tage-Mittel,
   nicht auf die letzte Woche. Ohne diese Angabe entstehen zwei Fehler in
   entgegengesetzte Richtungen: Wer `delta` als „gegenueber letzter Woche" liest,
   plant bei einer bereits ueberhoehten Vorwoche zu viel; wer nicht sieht, dass
   die Vorwoche ueber dem Mittel lag, haelt eine Absenkung fuer einen Aufbau.
   Neu im Ergebnis: `reference` (Wert, Basis, Fenster), `referenceLoad`,
   `targetLoad`, `absoluteCeiling`, `lastWeekLoad`, `deltaFromReference`,
   `deltaFromLastWeek`, `recentWeekAboveCeiling`. Die Decke wirkt jetzt auf die
   ABSOLUTE Ziellast und haengt am stabilen Mittel — eine Ausreisserwoche wird
   nie zum Sprungbrett fuer die naechste (geprueft ueber 60 Kombinationen).
   BEWUSST NICHT gedeckelt ist der Sprung gegenueber einer ungewoehnlich
   NIEDRIGEN Vorwoche: Die Rueckkehr von einer Entlastungswoche auf das Mittel
   ist ein grosser Woche-zu-Woche-Wert und trotzdem harmlos, weil die absolute
   Last unter dem liegt, was seit vier Wochen getragen wird. Eine
   Woche-zu-Woche-Decke waere der Rueckfall in „letzte Woche als Bezugsgroesse".
   Test: progression_test.mjs (123).
   v8-269 · RICHTUNGSUMKEHR ZIEL <-> PROGRESSION (C2/C1-Korrektur, 2026-08-07).
   FALSCH war: Goal Feasibility erzeugt requiredPctPerWeek -> C2 setzt sie um.
   Damit haette ein unrealistisches Ziel dauerhaft Druck bis an die Guardrail-
   Decke erzeugt, Woche fuer Woche, ohne dass irgendwo „das geht nicht" stuende.
   RICHTIG ist: C2 berechnet aus Historie, Toleranz und Phase einen ZULAESSIGEN
   KORRIDOR (`allowableRange`) plus eine adaptive Empfehlung darin — auch ganz
   ohne Ziel. Goal Feasibility VERGLEICHT diesen Korridor spaeter mit dem
   Zielbedarf. `goalDemand` darf nur noch INNERHALB des Korridors auswaehlen; es
   verschiebt den Rand nicht. Training bestimmt die erreichbare Trajektorie.
   Ohne Ziel liefert C2 deshalb NICHT mehr 0 %, sondern einen konservativen
   adaptiven Aufbau — und haelt nur, wenn Konsistenz, Verlauf oder Erholung das
   verlangen. Konsistenz und ein bereits steigender Verlauf begrenzen den
   KORRIDOR (nicht nur die Empfehlung), damit ein Ziel sie nicht ueberstimmt.
   C1-Korrekturen dazu: (1) Der Ersatzschluessel darf keine echten Einheiten
   loeschen — zwei ehrliche 30-Minuten-Laeufe am selben Tag sind moeglich. Sicher
   dedupliziert wird nur mit ID, Startzeit oder Quelle; sonst bleiben beide
   stehen und die Kollision wird als `possibleDuplicates` GEMELDET. Eine
   geloeschte Einheit ist unsichtbar, eine doppelte faellt auf.
   (2) Der laufende Tag darf die normierte Last nicht anheben: `observedToday`
   und `observedIncludingPartial` zeigen ihn, `decisionLoadCompletedDaysOnly`,
   `rolling` und `trainingState` schliessen ihn aus. Die Fenster umfassen n
   ABGESCHLOSSENE Tage und schrumpfen nicht auf n-1.
   Tests: progression_test.mjs (101), load_history_test.mjs (111).
   v8-268 · ADAPTIVE PROGRESSION (Bauplan Stufe 4 / C2, 2026-08-07): js/engine/progression.js.
   Fassung 1 schrieb „max. +8 % Wochenkilometer" so, als waere das die Regel, nach
   der der Umfang waechst. Falsch herum: +8 % ist die DECKE, nicht der Motor. Die
   bekannte „10-%-Regel" ist nicht evidenzbasiert — die groesste randomisierte
   Studie (Buist 2008, ~530 Laufanfaenger) fand KEINEN Unterschied in der
   Verletzungsrate. Deshalb gehoert sie an die Decke.
   SIEBEN STUFEN, HIERARCHISCH: Sicherheit/Unterbrechung, Datenlage, handlungs-
   faehige Toleranz, Phase und Zielbedarf, Wunsch, Guardrails, Empfehlung. Wer
   zuerst rechnet, wie viel das Ziel verlangt, und erst danach fragt, ob
   ueberhaupt Daten vorliegen, hat die Begruendung schon verloren.
   `delta` darf positiv, null oder NEGATIV sein. Ein Guardrail darf nur senken —
   als Eigenschaft ueber 60 Kombinationen geprueft, nicht als Stichprobe.
   Deload und Taper sind GEPLANTE Absenkungen (`reduce_planned`), keine
   Fehlleistungen; wer beides als Rueckschritt anzeigt, erzieht zum Ueberspringen.
   Unvollstaendige Historie kann eine Steigerung nicht begruenden, wohl aber
   verhindern. Ratio, Monotony und Strain loesen NIE allein aus. Ein `poor` ohne
   `actionable` wird ausgewiesen, bremst aber nicht.
   Wiedereinstieg mit DREI getrennten Pfaden: normale Pause als Korridor
   (Planwert am konservativen Rand), Krankheit symptomabhaengig ohne
   Einstiegsprozent, Verletzung ueber Kriterien statt Prozent.
   Zuvor in C1 nachgezogen: Dublettenerkennung (gleiche Aktivitaet aus zwei
   Sync-Laeufen zaehlt einmal), Saetze ERSETZEN die pauschale Split-Schaetzung
   derselben Krafteinheit statt sich zu addieren, der laufende Tag ist weder
   bekannt noch Luecke, asUnit normalisiert Sportart/Dauer/Identitaet, und die
   Schwellen sind als POLICY_VERSION versioniert. Tests: progression_test.mjs,
   load_history_test.mjs (100).
   v8-267 · LOAD HISTORY (Bauplan Stufe 3 / C1, 2026-08-07): js/engine/load-history.js.
   Ohne diesen Baustein plant die Engine jede Woche, als waere es die erste.
   DREI DINGE, DIE HIER NICHT VERMISCHT WERDEN: tatsaechlich absolvierte Last,
   Datenvollstaendigkeit und abgeleitete Vertraeglichkeit. Der gefaehrlichste
   Fehler waere, eine nicht geloggte Woche wie eine trainingsfreie zu behandeln —
   die Engine schloesse auf „gut erholt, jetzt steigern", ausgerechnet bei
   jemandem, der vielleicht durchtrainiert hat. Deshalb: `gaps[]` statt Nullen,
   `completeness` als eigene Groesse, `knownDays` zur Unterscheidung eines
   bestaetigten Ruhetags von einem vergessenen Log, und `insufficient_data`
   sobald die Datenlage unter der Schwelle liegt.
   Ein Lastmodell, nicht zwei: load-profile.profileOf() ist die einzige Quelle
   der Muskelsprache. Krafttraining zaehlt ueber Saetze, nicht ueber Einheiten.
   trainingState ist ADDITIV — die Rohfenster bleiben erhalten, weil eine
   abgeleitete Kennzahl ohne Rueckverfolgung nicht debuggbar ist. Monotony und
   Strain werden berechnet und angezeigt, sind aber als `advisory` markiert und
   gehen NICHT in Planungsentscheidungen ein. Acute:Chronic ebenso: ein Band als
   Kontext, nie eine Freigabe oder Sperre.
   Zuvor in C3 nachgezogen: das Debrief friert die damals sichtbare Vorgabe als
   `snapshot` ein (Zielzone, erwartetes RPE, Zonenbeleg und -zulaessigkeit).
   Ohne ihn haette ein Resolver-Lauf in sechs Monaten historische Debriefs gegen
   dann gueltige Zonen umgedeutet — aus „im Ziel" waere rueckwirkend „zu langsam"
   geworden. C1 uebernimmt nur eingefrorene Datensaetze und beziffert die
   abgewiesenen. Ausserdem trennt `actionable` jetzt Beobachtung von
   Handlungsgrundlage. Test: load_history_test.mjs.
   v8-266 · SESSION DEBRIEF (Bauplan Stufe 2 / C3, 2026-08-07): js/engine/session-debrief.js
   + Rueckmeldung an der absolvierten Einheit im Plan.
   WARUM DAS DER WICHTIGSTE BAUSTEIN NACH STUFE 0 IST: Das Debrief ist die
   EINZIGE Quelle gelabelter Daten. Ohne es kennt C1 die Last, aber nicht, wie
   sie vertragen wurde; C2 kann progressieren, aber nicht merken, dass es zu viel
   war. Bauplan-Fassung 1 hatte das mit „2 Tage" um Faktor zwei unterschaetzt.
   ZWEI EINGABEN IM NORMALFALL — RPE und Schmerz ja/nein. Elf Felder fuellt
   niemand ueber Monate aus, und lueckenhafte Selbstauskunft ist SCHLECHTER als
   keine: Schlechte Tage werden seltener geloggt, die Engine saehe also einen
   Athleten, der alles vertraegt. Der Grund einer Abweichung wird nur erfragt,
   wenn eine erkannt wurde, und dann als Auswahl statt Freitext.
   executionScore statt sessionQuality: das Produkt aus Zonentreffer und
   Erfuellungsgrad misst PLANERFUELLUNG. Wer perfekt in der Zone laeuft, dabei
   aber RPE 10 und Schmerz meldet, haette sonst eine „hochwertige" Einheit.
   expectedRPE kommt aus der Prescription (Typ, Arbeitsdauer, Pausenverhaeltnis,
   Blockstellung), nicht aus dem Sessionnamen — 4x8 min und 2x20 min heissen
   beide „Threshold" und sind nicht dasselbe. Ohne eigene Historie ist der Wert
   ausdruecklich nur `weak` belegt und darf melden, aber nichts bremsen.
   TOLERANZ IST KONTEXTSPEZIFISCH je {Domaene, Sportart}: schlechte
   VO2-Vertraeglichkeit beim Laufen schraenkt keine Rad-Intervalle ein. Unter drei
   vergleichbaren Einheiten bleibt es `unknown` — NICHT `good`; ausbleibende
   Belastungssignale sind kein Beleg fuer gute Vertraeglichkeit.
   Zusaetzlich in 0b nachgezogen: evidence.usability() trennt „hat Beleg" von
   „darf den aktuellen Plan steuern". Zonen aus einem zwanzig Jahre alten
   Wettkampf bleiben ein starker Beleg, dienen aber nicht mehr als
   Bewertungsmassstab. Tests: session_debrief_test.mjs (82), evidence (112).
   v8-265 · LEISTUNGSDATEN ERFASSEN (Bauplan Stufe 1 / G1, 2026-08-07):
   js/engine/performance-input.js + Profilseite „Leistungsdaten".
   ANLASS: Intensitaet, Zielprognose, Wochenkilometer und Tagesziele standen auf
   „—", weil es keinen Weg gab, Leistungswerte ueberhaupt einzutragen. Die Engine
   dahinter war fertig, die Eingabe fehlte.
   Nicht „Erfassungsmaske", sondern EVIDENCE INPUT: jeder Wert bekommt seine
   Herkunft mit (Huelle aus 0b) — sonst muesste jeder heute erfasste Wert spaeter
   nachmigriert werden, ohne dass die Herkunft rekonstruierbar waere.
   ABLEHNEN STATT UMDEUTEN: Unplausibles wird benannt, nicht zurechtgebogen.
   „1:50" auf HM wird als 1 h 50 gelesen, „48:30" auf 10 km als 48 min 30 —
   ueber Plausibilitaet (2–15 min/km), nicht ueber die Groesse der Zahlen. Ohne
   Distanz ist die Lesart nicht entscheidbar: dann wird GEFRAGT, nicht geraten.
   DREI ZUSTAENDE: ok · rejected · needs_input. Eine unvollstaendige Eingabe ist
   kein Fehler, sondern eine offene Frage; ein fehlendes Datum wird angenommen
   und als „ohne Datum" gefuehrt, nicht abgelehnt.
   Der leere Zustand ist in EINER Sitzung fuellbar: jedes Testprotokoll steht mit
   Anleitung direkt in der Maske. Test: performance_input_test.mjs.
   v8-264 · HERKUNFTSVERTRAG (Bauplan Stufe 0b, 2026-08-07): js/engine/evidence.js.
   Bisher erfand jedes Modul seine eigene Sicherheitsangabe — performance-zones
   sprach measured/derived/estimated/none, die Messwertschicht measured/estimated,
   die Oberflaeche „hoch". Ab jetzt EINE Skala fuer die Engine:
   unknown < weak < moderate < strong. Das alte Vokabular ist in
   performance-zones und performance-resolver ENTFERNT, nicht ergaenzt (Migration
   verlustfrei und in beide Richtungen geprueft).
   ZWEI GETRENNTE ACHSEN: Belegstaerke und Alter werden nie in eine Zahl gefaltet.
   Ein starker Beleg von vor einem Jahr bleibt ein starker Beleg — nur ein alter;
   die beiden verlangen verschiedene Reaktionen (messen lassen vs. nachtesten).
   Alter wird relativ zu einer QUELLENSPEZIFISCHEN Grenze gemessen: 60 Tage sind
   fuer ein Wettkampfergebnis frisch und fuer eine Schmerzangabe veraltet. Das
   Prognoseband rechnet ab jetzt stetig mit ageRatio statt in Etikettenstufen.
   Keine Prozentzahl: es gibt keine Rechnung, die aus „10-km-Wettkampf vor 18
   Tagen" serioes „78 %" macht. Die Messwertschicht (source-contract.js) behaelt
   ihr Vokabular und betritt die Engine nur ueber fromSourceContract() — eine
   Bruecke, keine zweite Sprache. Test: evidence_test.mjs (93).
   v8-263 · ENTSCHEIDUNGS-LOG (Bauplan Stufe 0a, 2026-08-07): js/engine/decision-log.js.
   Die Engine traf Entscheidungen, deren Begruendung nach dem Rendern verloren war —
   gespeichert wurde WELCHER Plan herauskam, nicht WARUM. Neu: append-only Beleg je
   Entscheidung mit Kandidaten (Top 5 + Gesamtzahl), ausgeloesten Regeln, Kette
   week_design -> policy_move -> user_override -> final_plan und ALLEN
   entscheidungsrelevanten Modulversionen. Der Runtime-Hash ist der Kern: Purität
   garantiert Determinismus nur INNERHALB einer Codeversion, deshalb verweigert
   explain() die Rekonstruktion, sobald sich eine Modulversion geaendert hat, statt
   Kandidaten aus heutigem Code als damalige auszugeben. Gesundheitsdaten
   (Schmerz, RPE) werden aus jeder Diagnoseausgabe redigiert; persistiert wird in
   engine_decision_log (Migration 0032) mit RLS und ohne update/delete-Policy.
   Das Log ist Beobachter, nie Beteiligter: bei defekter oder abgeschalteter Senke
   ist der Plan byte-fuer-byte identisch. Tests: decision_log_test.mjs (64),
   module_version_drift_test.mjs (13, verhindert VERSION-Drift — ohne ihn waere der
   Runtime-Hash Dekoration).
   v8-262 · WOCHENSTRUKTUR-FIX (Nutzerbefund „6x laufen, kein Ruhetag,
   ueberall Doppeleinheiten"): Drei im Profil erfassbare Felder wurden vom aktiven Generator
   NIE gelesen — availability.days[].restDay, availability.preferredRestDays und
   availability.days[].doubleSession.enabled (Feldmatrix: status 'prepared', einziger
   Konsument war die Shadow-Engine, die nichts steuert). „Doppeleinheit MOEGLICH" wurde
   als „Doppeleinheit ERWUENSCHT" gelesen, und der Ruhetag, den der Tagesdeckel erzeugte,
   wurde vom Auffuellen sofort wieder zugebaut. Neu: js/engine/week-plan-policy.js —
   Ruhetag garantiert, Doppel nur wo freigegeben, keine zwei harten Einheiten und keine
   beinlastige Kraft am Tag eines harten Laufs, kein zweimal dieselbe Sportart pro Tag.
   Verschieben vor Loeschen, mit Verdraengung: ein Kernreiz stirbt nie, nur weil er auf
   dem Ruhetag lag. Test: week_plan_policy_test.mjs (38).
   v8-256 · WOCHENAUFBAU STATT REPARATUR + LASTPROFIL. Zweiter Befund: „Mo/Di/So laufen
   direkt hintereinander, Tempo neben Intervallen." Ein nachgelagertes Regelwerk kann das
   nicht finden — es prueft TAGE, der Fehler liegt im RHYTHMUS. Neu:
   js/engine/week-plan-designer.js konstruiert die Woche (Kernreize zuerst, erschoepfende
   Suche ueber alle Tageskombinationen, 48 h Mindestabstand ZYKLISCH, keine drei Lauftage
   in Folge, Polarisierung nach Umfang, anteilige Kuerzung statt „wer zuerst kommt").
   js/engine/load-profile.js bildet JEDE Einheit auf dieselben 15 Muskelgruppen ab wie
   gym-volume.js — damit kollidieren nicht mehr Sportart-NAMEN, sondern Muskelgruppen:
   Rudern+Ruecken, Fussball+Beine, Laufen+Beine, 3x Ganzkoerper folgen aus EINER Regel
   statt aus hunderten Sonderfaellen. Tests: week_plan_designer (34), load_profile.
   Zuvor v8-254: Belegsammler js/engine/canary-report.js: EIN Befehl
   (await ORVIA.canaryReport({cohortSize:1})) statt handgebautem JSON. Der RLS-Schreibtest ist
   ein echter Versuch, keine Zusicherung — er meldet, ob die Datenbank den Client abweist.
   Zuvor v8-253: Phase 8 abgeschlossen, soweit ohne Wartezeit moeglich (2026-08-06):
   0031_feature_flags.sql (RLS: lesen ja, schreiben nein) + js/engine/feature-flags.js (fail-closed)
   entblocken 8.4; js/engine/plan-activation.js ist der flag-gesteuerte Aktivierungspfad — er
   VERWEIGERT, statt einen manuellen Override zu verlieren; js/engine/canary-eval.js misst die
   sieben Canary-Kriterien mit drei Zustaenden (insufficient_data ist NICHT pass).
   Zuvor v8-252: Suite auf Gruen (2026-08-06): 209 bestanden, 0 fehlgeschlagen, 6 uebersprungen
   (brauchen eine echte Supabase-Instanz). Behoben: activity_week_truth_dt1 pruefte seit einer
   Refaktorierung die falsche Funktion (renderWeekly ist nur noch ein Wrapper, die Logik liegt in
   weeklyReviewHTML) — der Vertrag war die ganze Zeit erfuellt, der Test zeigte auf die alte
   Stelle. Neu: supabase/tests/run-all.mjs wertet den Exit-Code aus statt Text zu durchsuchen.
   Zuvor v8-251: Wochenplan-Projektion (Phase 8.1/8.2). */
try { console.log('[ORVIA SW]', C); } catch (e) {}
const ASSETS = ['./','./index.html','./styles.css','./manifest.webmanifest',
  './assets/icons/icon-192.png','./assets/icons/icon-512.png','./assets/icons/apple-touch-icon.png',
  './assets/icons/maskable-icon-512.png','./assets/brand/orvia-symbol-only.svg','./assets/brand/orvia-favicon.svg','./assets/brand/profile-cover.jpg',
  './assets/og/orvia-og-image.png',
  './js/clock.js','./js/config.js','./js/supplements.js','./js/calc.js','./js/data.js','./js/profile.js','./js/issues.js','./js/intelligence.js','./js/orvia-pro.js','./js/charts.js','./js/orvia-charts.js',
  './js/gm-icons.js','./js/format-utils.js','./js/series-reader.js','./js/run-bests.js','./js/plan-domain.js','./js/achievements.js','./js/ui.js','./js/activity.js','./js/nutrition.js','./js/insights.js','./js/race.js','./js/story.js','./js/extras.js',
  './js/repos/repoBase.js','./js/repos/profileRepository.js','./js/repos/checkinRepository.js','./js/repos/trainingLoadRepository.js','./js/repos/readinessRepository.js','./js/repos/goalRepository.js','./js/repos/constraintRepository.js','./js/repos/availabilityRepository.js','./js/repos/activityRepository.js','./js/training-domain.js','./js/activity-normalize.js','./js/activity-store.js','./js/activity-config.js','./js/activity-sync.js','./js/gym-volume.js','./js/repos/exerciseRepository.js','./js/repos/sportRepository.js','./js/repos/trainingPlanRepository.js','./js/repos/weekPlanRepository.js','./js/repos/workoutRepository.js','./js/offline-queue.js','./js/profile-store.js','./js/checkin-store.js','./js/migrate-blob.js','./js/readiness-source.js','./js/readiness-store.js','./js/training-migration.js','./js/workout-store.js',
  './js/avatar-store.js','./js/sync.js','./js/profile-model.js','./js/profile-ui-kit.js','./js/profile-center.js','./js/onboarding/onboarding-profile-logic.js','./js/onboarding/onboarding-sports-logic.js','./js/onboarding/onboarding-logic.js','./js/onboarding/onboarding-steps.js','./js/onboarding/onboarding-store.js','./js/onboarding/onboarding-ui.js','./js/coachmarks.js','./js/quick-actions.js','./js/auth-logic.js','./js/auth.js','./js/checkin-extra.js','./js/workout-ui.js','./js/ui-refresh.js','./js/engine/engine-contracts.js','./js/engine/readiness-engine-v2.js','./js/engine/decision-engine-v2.js','./js/engine/plan-engine-v2.js','./js/engine/training-input-resolver.js','./js/engine/shadow-runner.js','./js/engine/knowledge/knowledge-contracts.js','./js/engine/knowledge/knowledge-sources.js','./js/engine/knowledge/running-knowledge-pack.js','./js/engine/knowledge/sport-coverage-matrix.js','./js/engine/goal-portfolio.js','./js/engine/running-capacity-factory.js','./js/engine/scheduler-input-factory.js','./js/engine/scheduler-goal-allocation.js','./js/engine/scheduler-v1.js','./js/engine/capacity-adapter.js','./js/engine/constraint-solver.js','./js/engine/prescription-factory.js','./js/engine/scheduler-v2.js','./js/engine/shadow-eval.js','./js/engine/week-projection.js','./js/engine/evidence.js','./js/engine/performance-zones.js','./js/engine/load-profile.js','./js/engine/performance-resolver.js','./js/engine/performance-input.js','./js/engine/session-debrief.js','./js/engine/debrief-record.js','./js/engine/load-history.js','./js/engine/progression.js','./js/engine/goal-feasibility.js','./js/engine/shadow-adaptive.js','./js/engine/plan-translator.js','./js/adaptive-card.js','./js/engine/observer-source.js','./js/engine/observer-input.js','./js/engine/prediction-observer.js','./js/engine/week-plan-designer.js','./js/engine/plan-variants.js','./js/engine/week-plan-policy.js','./js/engine/decision-log.js','./js/engine/feature-flags.js','./js/engine/plan-activation.js','./js/engine/canary-eval.js','./js/engine/canary-report.js',
  /* v8-321: plan-quality.js fehlte hier seit v8-316 — das Modul wurde von
     index.html geladen, war aber NICHT im Offline-Vorrat. Offline waeren die
     sechs Planqualitaets-Kacheln stumm ausgefallen. Zusammen mit dem neuen
     Kraft-Datenvertrag nachgetragen; der Paritaetstest in
     strength_plan_contract_test.mjs (S15) haelt die Luecke ab jetzt zu. */
  './js/engine/plan-quality.js','./js/engine/strength-plan.js','./js/engine/garmin-exercise-map.js','./js/engine/garmin-workout-export.js',
  './js/metrics/metric-registry.js','./js/metrics/metric-resolver.js','./js/metrics/profile-metric-resolver.js','./js/metrics/metric-envelope.js','./js/metrics/source-contract.js','./js/repos/metricsRepository.js',
  './js/checkin-fields.js','./js/checkin-field-resolver.js',
  './js/metrics/energy-expenditure-resolver.js','./js/repos/energyRepository.js'];

// Ausfalltolerantes Pre-Caching: EINE fehlende/umbenannte Datei darf NICHT das gesamte
// SW-Update blockieren (sonst bleibt der alte Worker aktiv und liefert die alte App aus).
// Nicht vorab gecachte Assets werden beim ersten Zugriff per fetch nachgeladen (cache-first unten).
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(C).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => null)))).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const req = e.request;
  /* INCIDENT-FIX (2026-07-16, ROOT CAUSE der gesamten Sync-Divergenz): Der Handler griff
     für ALLE GETs — auch für die Supabase-REST-API (cross-origin). Cache-first + ignoreSearch
     fror damit jede API-Antwort nach dem ersten Read ein: Writes kamen an, aber KEIN Gerät
     sah sie je wieder (eingefrorene Profile/Ziele/updated_at, Geräte-Divergenz, „vertauschte"
     Stände). Der SW cacht ab jetzt AUSSCHLIESSLICH eigene, versionierte App-Assets. */
  let sameOrigin = false;
  try { sameOrigin = new URL(req.url).origin === self.location.origin; } catch (err) {}
  if (!sameOrigin) return;   // API/CDN (Supabase, jsdelivr, cdnjs) NIE abfangen — Netz entscheidet
  const isNav = req.mode === 'navigate';
  const isEnv = req.url.indexOf('env.js') >= 0;

  // Navigation (index.html) + env.js: NETWORK-FIRST, damit der Auth-Guard und die
  // Konfiguration nach jedem Deploy sofort aktuell sind (nie eine alte Version ohne Guard).
  if (isNav || isEnv) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const cp = res.clone();
          caches.open(C).then(c => c.put(isNav ? './index.html' : req, cp));
        }
        return res;
      }).catch(() => caches.match(isNav ? './index.html' : req))
    );
    return;
  }

  // Übrige Assets (versioniert über C): cache-first.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(r =>
      r || fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(C).then(c => c.put(req, cp)); }
        return res;
      }).catch(() => Response.error())
    )
  );
});
