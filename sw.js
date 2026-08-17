const C = 'orvia-v8-355';   /* TEILDEPLOY REPARIEREN (2026-08-17) · v8-355:

   Der Upload von v8-354 war unvollstaendig: js/ und sw.js kamen an,
   styles.css NICHT (live weiterhin `.toast{z-index:99}`). Der Cache-Name
   stand aber schon auf v8-354 — Geraete, die das bereits geholt haben,
   haetten die alte styles.css unter der NEUEN Version einbetoniert und
   nie wieder nachgeladen. Deshalb eine weitere Versionsnummer: sie ist
   der einzige Hebel, der einen falsch gefuellten Cache aufbricht.
   Merksatz: die Versionsnummer darf erst steigen, wenn die Dateien
   OBEN sind — nicht, wenn sie hochgeladen werden sollen.
   (urspruenglicher v8-354-Text darunter unveraendert)

   v8-345 hat entschieden, Laufen NICHT zu verdrahten, und die Entscheidung
   mit einer Zahl begruendet:

       Regeln mit maschinenlesbarem Zahlwert:  Gym 2 von 4 · Laufen 0 von 14

   Verdrahten haette nichts transportiert. Das war richtig — fuer den Stand
   von v8-345. Seit v8-349 kommt jede Aussage als HINWEIS mit Herkunft,
   Grenzen und Ausschluessen auf der Karte an. Damit transportiert derselbe
   Anschluss auf einmal 14 belegte Aussagen statt null Zahlen. Nicht die
   Entscheidung war falsch, sondern ihre Voraussetzung hat sich geaendert —
   und das faellt nur auf, wenn man alte Entscheidungen noch einmal ansieht.

   WAS VERDRAHTET IST, und was ausdruecklich nicht:
     • NEU: running-notizen-knowledge-pack — 17 Regeln aus sechs
       Quellennotizen (QUELLE-04/07/08/09/11/13), erzeugt vom Einspeisewerkzeug.
     • UNVERAENDERT DRAUSSEN: running-knowledge-pack (14 handgepflegte
       Regeln). Es hat mit running-capacity-factory einen eigenen Konsumenten;
       es hier zusaetzlich einzuhaengen oeffnete zwei Wege auf dieselben
       Regeln. Die beiden Pakete haben KEINE gemeinsame Regel-Kennung —
       geprueft beim Erzeugen, das Werkzeug bricht bei jeder Kollision ab.

   GEMESSEN auf einer Laufkarte: 14 Hinweise mit Klasse B/C und Regel-ID.
   Drei Regeln bleiben gesperrt (RUN-ACH-001, RUN-ERHOL-001/002,
   medical_safety_review_pending) — auch jetzt, wo ihr Paket wirkt. Probe H13
   haelt genau diese Sperre offen: der gefaehrlichste Moment einer
   Verdrahtung ist der, in dem dabei eine Sperre faellt.

   DAS WERKZEUG NIMMT JETZT MEHRERE NOTIZEN. Bis hierher nahm es genau EINE
   und ersetzte damit das ganze Paket; sein eigener Ueberschreibschutz riet,
   „die bestehenden Regeln in die Notizdatei zu uebernehmen" — also alle
   Quellen in eine Datei zu kopieren. Das ist das Gegenteil der Ordnung, die
   docs/wissen pflegt: eine Datei je Quelle, mit eigener Herkunft und eigenem
   Pruefdatum. Jetzt fuegt es beliebig viele zusammen und bricht bei doppelter
   Regel- oder Quellen-Kennung ab. Neu ausserdem `--paket <praefix>`, damit
   ein handgepflegtes Paket nicht ueberschrieben werden KANN.

   EIN BEFUND, KEIN ERFOLG: 14 Hinweise auf einer Karte sind unlesbar. Jede
   Aussage ist richtig, hat eine Quelle und gehoert zum Thema — und alle
   zusammen sind unbrauchbar. „Alles kommt an" ist nicht dasselbe wie „alles
   gehoert auf jede Karte". Die Karte zeigt deshalb vier und schreibt die
   Restzahl hin: „10 weitere belegte Hinweise — auf dieser Karte nicht
   angezeigt". Gekuerzt ist kein Weglassen, so wie uebersprungen kein Beleg
   ist (v8-342) und nicht mitgezaehlt kein Uebersehen (v8-351). Die Vier ist
   ein PRODUKTWERT fuer diese Kartengroesse, keine Erkenntnis.

   ZWEI PROBEN MUSSTEN NACHGEZOGEN WERDEN, beide aus gutem Grund:
   • H12 blieb GRUEN. Meine Zusicherung verglich zwei Aufrufe mit DERSELBEN
     Eingabereihenfolge — und `Array.sort` ist stabil, also kam zweimal
     dasselbe heraus, auch ohne Sortierung. Die Eigenschaft, die die Ordnung
     schuetzt, ist eine andere: dieselbe MENGE in anderer Reihenfolge muss
     dieselben vier zeigen.
   • SCM3 meldete `not_applied`. Ihr Anker war die Zeile
     `knowledgePackWired: false` bei running — die es nicht mehr gibt. Sie
     zeigt jetzt auf den Vorgabewert in `entry()`, damit derselbe Befund an
     der Stelle geprueft wird, an der er heute noch entstehen kann. Ein Anker
     ins Leere ist kein Beleg, in keine Richtung.

   GEAENDERT: tools/knowledge-ingest.mjs (Mehrfacheingabe, --paket),
   running-notizen-knowledge-{pack,sources}.js (neu, erzeugt),
   knowledge-consumer.js (running eingetragen), prescription-format.js
   (Kuerzung mit Restzahl), ui.js + styles.css, sport-coverage-matrix (v4),
   index.html + ASSETS, knowledge_targets_test (zweites Laufpaket),
   knowledge_hinweise_test (+15), batch3b0_knowledge_test (mehrere Pakete je
   Sportart). Kohorten-Pin 023ee59b unveraendert.

   ============================================================
   DIE UNBELEGTE ZAHL SAH VERBINDLICHER AUS (2026-08-13) · v8-352:

   DER BEFUND, direkt aus v8-351 heraus. Seit v8-349 traegt auf der Karte
   jede Zahl aus eingespeistem Wissen ihre Herkunft: Evidenzklasse, Regel-ID,
   Ausschluesse, Grenzen. Zwei Bildschirme weiter stand auf der Muskelkarte:

       Ziel: 6–12/Woche

   Ohne Quelle. Ohne Klasse. Ohne Hinweis, dass ORVIA sich diese Zahl selbst
   gegeben hat. Und mit dem Wort „Ziel", das sie zur Vorgabe macht.

   Das ist die unglaubwuerdigste Stelle, die eine App haben kann: die
   Sorgfalt an der belegten Zahl laesst die unbelegte daneben glaubwuerdiger
   erscheinen, nicht weniger. Wer nur die Muskelkarte sieht, haelt 6–12 fuer
   dasselbe wie 120 s Satzpause aus Friedmann 2007.

   WAS SICH GEAENDERT HAT — nur die Ehrlichkeit, keine Zahl:
     • `targetCorridor` gibt `basis: 'produktwert'`, ein Klartext-Label
       („ORVIA-Richtwert, konservativ gesetzt — keine Quelle, fachlich
       ungeprueft") und seine Bezugsgroesse zurueck. Wer die Zahl herausgibt,
       gibt ihre Herkunft mit heraus; sie kann unterwegs nicht mehr
       verlorengehen.
     • Auf dem Bildschirm heisst der Bereich „Richtwert" statt „Ziel" — an
       allen drei Stellen (Kachel, anatomische Karte, Detail).
     • Im Profi-Modus wurde die Basis bisher sogar WEGGESTRICHEN:
       `conservative_start:` wurde aus dem Text entfernt und uebrig blieb
       „hypertrophy · intermediate". Genau der informative Teil fiel weg.

   DIE ZWEITE ZAHL, und warum nicht gerechnet wird. Zum selben Gegenstand
   fuehrt ORVIA jetzt zwei Werte:

       Richtwert   6–12 je Muskelgruppe und WOCHE     Produktwert, keine Quelle
       Quelle      5–6  je Muskelgruppe und EINHEIT   Klasse B, GYM-HYP-002

   Verbunden waeren sie ueber die Wochenfrequenz — die die Quelle
   ausdruecklich NICHT nennt („Keine Angabe zur Wochenfrequenz, ohne die eine
   Satzzahl je Einheit wenig aussagt"). Zwei Einheiten je Woche ergaeben
   10–12 und passten; drei ergaeben 15–18 und laegen darueber. Welche
   Rechnung stimmt, weiss niemand — also steht beides nebeneinander, jede
   Zahl mit ihrer Bezugsgroesse, und der Unterschied wird benannt. Das ist
   unbequemer als eine Zahl und das einzige, was ehrlich ist.

   WAS NICHT PASSIERT IST: keine Zahl geaendert, kein Korridor verschoben,
   keine Quelle erfunden. Die Probe KOR2 schmuggelt genau die Formulierung
   ein, die man beim Schoenschreiben waehlen wuerde — „Evidenzbasierter
   Richtwert nach aktueller Studienlage (Klasse B)" — und muss rot werden.

   GEAENDERT: gym-volume.js (basis/label/einheit), ui.js (Beschriftung an
   drei Stellen, Herkunft am Detail, Abgrenzung zur Quellenzahl), styles.css,
   gym_volume_test (+8), muscle_map_pilot_test (+6), neuer Probenkatalog
   gym-korridor.json (4). Suite 261/0 bei 7 uebersprungenen (268 Dateien),
   163 Proben in 20 Katalogen, 158 gefahren / 5 uebersprungen, jede
   angeschlagen. Kohorten-Pin 023ee59b unveraendert.

   ============================================================
   EINE ZAHL ANWENDEN, OHNE SIE VORZUSCHREIBEN (2026-08-13) · v8-351:

   DIE LETZTE QUITTUNG IST WEG — und zwar nicht, weil sie gestrichen wurde,
   sondern weil `plan.saetze_je_muskelgruppe` jetzt wirklich angewendet wird.
   Anders als jedes Ziel davor: es wird NICHT vorgeschrieben, sondern eine
   geplante Einheit wird dagegen GEPRUEFT.

       Kniebeuge 4 Saetze + Beinpresse 3 Saetze
       → Quadrizeps 7 Saetze geplant — die Quelle nennt 5 bis 6
         [Klasse B · GYM-HYP-002]
         laut Quelle: „Der Umfang wird je Muskelgruppe geplant, nicht je
         Uebung: fuenf bis sechs Saetze pro Muskelgruppe und Einheit …"
         nicht mitgezaehlt: Hantelrudern Jacob
         gilt nicht fuer: krafttraining_anfaenger, kinder_jugendliche …

   WARUM PRUEFEN UND NICHT SETZEN. Die Quelle verbietet es woertlich: „keine
   Umrechnung auf Saetze je Uebung. Diese Zahl darf session.sets nicht
   speisen." Sie gilt fuer eine Muskelgruppe, und die entsteht erst aus der
   Uebungsauswahl. v8-344 hat diesen Einheitenfehler fast gemacht und ihn
   dokumentiert; Probe PV7 haelt die Sperre jetzt offen, wo die Zahl endlich
   gelesen wird.

   DER MESSWERT, DER DEN WEG ENTSCHIEDEN HAT. Bevor irgendetwas gebaut wurde:
   wie viele Uebungen lassen sich ueberhaupt einer Muskelgruppe zuordnen?

       78 Systemuebungen · 71 zuordenbar (91 %) — theoretisch
                          · 26 zuordenbar (33 %) — tatsaechlich

   Die Luecke war EIN Feld. `gmExLibEnsure` speicherte je Uebung {name, slug}
   und warf `movement_pattern` weg, obwohl `select('*')` es mitliefert — und
   45 der 78 Uebungen haengen genau daran. Ohne diese Messung waere ein
   Pruefer entstanden, der bei zwei Dritteln der Uebungen schweigt und das
   wie Zustimmung aussehen laesst. Gemessen mit
   tools/messung-zuordnungsquote.mjs.

   NEU: js/engine/planned-volume.js (`planned-volume@1`). Zaehlt geplante
   Saetze je Muskelgruppe. Bewusst NICHT in gym-volume: dort geht es um
   ABSOLVIERTE Saetze mit `completed`, Satztypen und Ausschlussgruenden — ein
   geplanter Satz hat nichts davon. Die Muskelzuordnung wird von dort BENUTZT
   (musclesFor/coeffOf/roleOf), nicht kopiert: eine zweite Tabelle waere die
   dritte Stelle im Projekt mit zwei Wahrheiten.

   EIN ZWEITES REGISTER: `GEPRUEFTE_ZIELE`. `GELESENE_ZIELE` heisst „wird als
   Wert eingebaut". Ein Pruefer tut das nicht. Beides in eine Liste zu werfen
   waere bequem und falsch — der Sensor fragt „wird diese freigegebene Zahl
   angewendet?", und die ehrliche Antwort ist hier „ja, aber anders". Eine
   Liste, die zwei Dinge bedeutet, beantwortet keine Frage mehr.

   ZWEI PROBEN BLIEBEN GRUEN — und das war der nuetzlichste Teil des Tages:
   • PV7 zielte auf „DIE Zahl speist session.sets NICHT". In diesem Testfall
     tragen alle Uebungen eine eigene Satzzahl, die mutierte Stelle wird nie
     erreicht. Erst eine Uebung OHNE Satzzahl fuehrt dorthin — die
     Zusicherung fehlte.
   • PV8 zielte auf „ohne Wissen gibt es keinen Befund". Ohne Wissen greift
     die erste Sperre, die mutierte Stelle liegt dahinter. Der gefaehrliche
     Fall ist Wissen OHNE diese Regel: Vorgaben sind da, nur nicht die
     richtige, und 5–6 steht im Code. Auch diese Zusicherung fehlte.
   Beide Luecken sind geschlossen, beide Proben schlagen jetzt an. Ein Test,
   der gruen bleibt, wenn man den Code kaputtmacht, prueft nichts.

   WAS DER PRUEFER NICHT TUT: er aendert keine Satzzahl, keine Uebung, keine
   Pause. Er meldet nichts ohne Wissen — auch nicht bei zwoelf Saetzen. Er
   zaehlt nur DIREKTE Saetze: aus fuenf Kniebeugen „Gesaess 2,5 Saetze zu
   wenig" zu machen hiesse, eine Zahl zu verlangen, die niemand geplant hat.
   Und was er nicht zuordnen kann, steht als „nicht mitgezaehlt" an der
   Zeile — eine Summe ueber die Haelfte der Uebungen ist keine Summe.

   OFFEN BLEIBT: die Uebungsauswahl selbst. `scheduler-v2` leitet fuer Gym
   keine ab, und eine erfundene Standardliste ist ausgeschlossen — sie
   braucht eine Quelle, keine Programmierung. Der Pruefer wirkt deshalb heute
   an selbst geplanten Einheiten und wird unveraendert weiterlaufen, wenn die
   Liste eines Tages aus einem Kraft-Pack kommt.

   GEAENDERT: planned-volume.js (neu), prescription-factory.js (Pruefer,
   zweites Register), prescription-format.js (Befund vor Aussage), ui.js
   (Bewegungsmuster im Zwischenspeicher mit Formatversion, Befund an der
   selbst geplanten Einheit), index.html + ASSETS, knowledge_targets_test
   (zweites Register), knowledge_hinweise_test (Naht + zwei nachgetragene
   Zusicherungen), planned_volume_test (neu), _ziele-ohne-leser.json (1 → 0).
   Suite 261/0 bei 7 uebersprungenen (268 Dateien), 159 Proben in 19
   Katalogen, 154 gefahren / 5 uebersprungen, jede angeschlagen.
   Kohorten-Pin 023ee59b unveraendert.

   ============================================================
   EINE EINHEIT IST KEINE WOCHE (2026-08-13) · v8-350:

   REINE TEXTKORREKTUR, kein Codeverhalten geaendert. Aufgefallen beim Planen
   von Punkt 2 — und zwar erst, als ich die Regel im Paket nachgelesen habe,
   statt meiner eigenen Beschreibung davon zu glauben.

   WAS FALSCH WAR. Zu `plan.saetze_je_muskelgruppe` stand in
   `_ziele-ohne-leser.json` seit v8-344: „woechentlicher Umfang je
   Muskelgruppe — braucht einen Leser im Wochenplan (scheduler-v2)". In v8-349
   habe ich das uebernommen und in drei weitere Dateien geschrieben: diesen
   Kopf, Bauplan §39.5 und das neue Zielvokabular.

   WAS DIE QUELLE SAGT (GYM-HYP-002, woertlich aus dem Paket):
     statement          „fuenf bis sechs Saetze pro Muskelgruppe UND EINHEIT,
                         verteilt ueber alle Uebungen, die diese Muskelgruppe
                         belasten"
     inputUnits         „Saetze pro Muskelgruppe und Trainingseinheit"
     outputUnits        dasselbe
     allowedTransformation
                        „keine — und ausdruecklich KEINE Umrechnung auf Saetze
                         je Uebung. Diese Zahl darf session.sets nicht speisen."
     uncertainties      „Keine Angabe zur Wochenfrequenz, ohne die eine
                         Satzzahl je Einheit wenig aussagt"

   WARUM DAS MEHR IST ALS EIN WORT. Aus „Woche" folgte der Schluss, der
   Anwender sei die Wochenplanung — und damit stand Punkt 2 seit v8-344 als
   Scheduler-Aufgabe in der Liste. Er ist keine: der Anwender ist die
   EINHEIT, genauer die Stelle, an der die Uebungen einer Einheit feststehen.
   Ein falsches Wort hat eine Aufgabe an die falsche Stelle gehaengt.

   Die EINSPEISUNG war die ganze Zeit korrekt — die Notiz, das Paket und der
   v8-344-Kopf sagen alle „je Einheit", und v8-344 warnt sogar ausdruecklich
   vor genau dieser Einheitenverwechslung. Falsch war nur mein Begleittext.
   Das ist die unangenehme Sorte Fehler: die Daten stimmen, die Erzaehlung
   darueber nicht, und gelesen wird die Erzaehlung.

   GEAENDERT: _ziele-ohne-leser.json, _zielvokabular.json, sw.js (dieser Kopf
   und der v8-349-Absatz), ENGINE-BAUPLAN §39.5, STAND-UND-OFFENE-PUNKTE
   (Punkt 2). Neu: docs/PLAN-PUNKT-2-MUSKELGRUPPEN.md — der Umsetzungsplan mit
   der korrigierten Richtung. Kein Modul unter js/ angefasst.

   ============================================================
   WISSEN, DAS KEINE ZAHL IST, KOMMT JETZT AN (2026-08-13) · v8-349:

   DER AUFTRAG WAR: es darf nirgends stehen, dass etwas nicht wirkt. Was ich
   dabei gefunden habe, war schlimmer als die Formulierung — die Behauptung
   war NIE GEMESSEN worden.

   AUSGANGSLAGE. `_ziele-ohne-leser.json` fuehrte 45 Ziele mit dem Vermerk
   „wirkt derzeit auf nichts". Diese Zahl stammte nicht aus einer Messung,
   sondern aus einem Abgleich mit dem Zielregister: was die Verordnung nicht
   als ZAHL einbaut, galt als wirkungslos. Das war in beide Richtungen
   unbelegt — recherchiertes, geprueftes, eingespeistes Wissen wurde folgenlos
   genannt, ohne dass jemand geprueft hatte, ob es nicht anders ankommt.

   WAS SICH GEAENDERT HAT — die Kette endet nicht mehr an der Zahl:

     Vorgabe ohne Zahl  →  hinweise (Verordnung)
                        →  hinweisZeilen (Format)
                        →  Wochenkarte, mit Herkunft und Ausschluessen

   Ein Satz wie „aus isolierten Krafttests laesst sich die Laufleistung nicht
   vorhersagen" aendert keine Satzzahl. Er aendert, was der Nutzer von seinen
   Werten erwartet. Das IST Wirkung, und sie gehoert angezeigt.

   WAS ICH NICHT GETAN HABE, obwohl der Auftrag es nahelegen koennte: eine
   Aussage umdrehen. „Kein Zusammenhang" bleibt „kein Zusammenhang" — es steht
   jetzt nur nicht mehr wirkungslos herum, sondern als Hinweis auf der Karte.
   Einen Befund ins Gegenteil zu verkehren waere Erfindung, kein Fortschritt.

   VIER EIGENE FEHLER AUF DEM WEG, alle beim Nachpruefen gefunden:

   • DIE KETTE ENDETE DREI ZEILEN VOR DEM BILDSCHIRM. Die Bloecke A–D des
     neuen Tests waren gruen, und auf KEINER Karte stand ein Hinweis:
     `scheduler-v2` nahm aus der Verordnung nur `workout` und `flags`,
     `week-projection` kannte das Feld nicht, die Oberflaeche rief
     `hinweisZeilen` nirgends auf. Zum VIERTEN Mal dieselbe Fehlerklasse
     (v8-335 eingespeist/niemand liest, v8-341 Modul/kein Aufrufer, v8-344
     Ziel/kein Name). Sie faellt jedes Mal deshalb nicht auf, weil jedes
     Einzelstueck geprueft ist und die NAHT nicht. Jetzt drei Proben auf die
     Naht (H8, H9, H10).
   • DER NEUE WEG WAR SELBST UNGEPRUEFT. `hinweisZeilen` hatte keinen
     einzigen Test — aufgefallen erst beim Nachziehen der Zielregister-Proben.
     Daher `knowledge_hinweise_test.mjs` mit 32 Zusicherungen.
   • DERSELBE SATZ STAND ZWEIMAL AUF DER KARTE. GYM-HYP-003 nennt Last UND
     Wiederholungen und traegt EINEN Satz. Aufgefallen nicht durch eine
     Zusicherung, sondern beim LESEN der Testausgabe. Jetzt zusammengefasst
     (`hinweise[].ziele`) und als Zusicherung festgehalten.
   • DER SENSOR VERLOR EINE ABDECKUNG, DIE ER HATTE. Bis v8-348 fiel ein
     vertippter Zielname dadurch auf, dass nichts ankam. Seit v8-349 kommt die
     Aussage IMMER an — der Tippfehler waere unsichtbar geworden. Ersatz:
     `_zielvokabular.json`, 55 Namen mit Bedeutung; ein Name, der dort nicht
     steht, ist rot. Die Bremse sitzt jetzt am NAMEN statt an der Wirkung.

   DER SENSOR RAET NICHT MEHR. `knowledge_targets_test.mjs` misst durch die
   echte Kette: Paket → applyKnowledge → buildPrescription → hinweise/flags.
   Gemessenes Ergebnis am 13.08.:

       30 Paketziele · 1 als Wert · 24 als Hinweis · 5 bewusst gesperrt
        0 unerklaert verschwunden
       25 Notizziele · 21 kaemen nach technischer Freigabe an
                     ·  4 bleiben medizinisch gesperrt

   Die 5 + 4 gesperrten Ziele haengen an `medical_safety_review_pending`
   (RUN-RTR-001, RUN-SAFE-001, RUN-ACH-001, GYM-RUMPF-002, RUN-ERHOL-001/002).
   Das ist eine Entscheidung, kein Versaeumnis — und der Test verlangt fuer
   jede Sperre einen benannten CODE, damit ein DEFEKT nie wie eine
   Sicherheitssperre aussehen kann.

   DIE QUITTUNGSLISTE IST VON 45 AUF 1 GESCHRUMPFT und hat eine engere
   Bedeutung: sie fuehrt nur noch eine ZAHL, die der Vertrag zum Vorschreiben
   freigegeben hat und die niemand anwendet. Der eine Eintrag ist
   `plan.saetze_je_muskelgruppe` (5–6 Saetze je Muskelgruppe und EINHEIT) —
   offener Punkt 2, benannt statt verrechnet.
   [KORRIGIERT in v8-350: hier stand „und WOCHE, Anwender ist die
   Wochenplanung". Falsch, siehe Kopf von v8-350.]

   OFFEN GESAGT: die Zusicherung „jedes vorhandene Paket wird auch gemessen"
   ist NICHT probengedeckt. Sie haengt an einer Liste im Test, und das
   Probenwerkzeug mutiert nur Dateien unter app/. Steht so im Katalog.

   GEAENDERT: prescription-factory.js (Zusammenfassung), scheduler-v2.js +
   week-projection.js (die Naht), ui.js + styles.css (die Karte),
   knowledge_targets_test.mjs (misst statt raet), knowledge_hinweise_test.mjs
   (neu), _ziele-ohne-leser.json (45 → 1), _zielvokabular.json (neu).
   Kohorten-Pin 023ee59b unveraendert.

   ============================================================
   DIE SCHNITTMENGE IST KEINE ERFINDUNG (2026-08-13) · v8-348:

   ZWEI OFFENE PUNKTE ABGERAEUMT, beide aus der Liste, beide klein — und beide
   haben beim Bauen etwas ueber den Code verraten.

   PUNKT 4 · UEBERLAPPENDE ZAHLBEREICHE. Seit v8-341 notiert und bewusst
   zurueckgestellt, weil Aenderungen an der Zahlenlogik die riskantesten sind.
   Bis hierher galt JEDER Unterschied als Widerspruch:

       Quelle A: 120–180 s      Quelle B: 150–240 s
       → beide gegenseitig stumm, KEINE Vorgabe

   Dabei decken beide den Bereich 150–180 s ausdruecklich. Die Schnittmenge
   steht in JEDER beteiligten Quelle — sie ist der engste Bereich, den alle
   tragen. Der Unterschied zum Mitteln, das verboten bleibt: aus 3 und 5
   Saetzen wird NICHT 4; diese Bereiche beruehren sich nicht, und 4 hat
   niemand gesagt. Gemessen:

       120–180 / 150–240   → 150–180, eingeengtAus nennt beide Originale
       120–180 / 120–180   → 120–180, bestaetigtDurch (nichts eingeengt)
       120–140 / 200–240   → KEINE Vorgabe, Konflikt bleibt
       120–150 / 150–240   → genau 150
       drei Bereiche       → der engste gemeinsame

   NUR fuer Zahlen. Bei Auswahllisten waere die Schnittmenge zwar ebenfalls
   gedeckt, koennte aber LEER sein — und eine leere Uebungsliste ist keine
   Aussage, sondern ein stiller Ausfall.

   PUNKT „kuerzester Weg" · session.repetitions. Das Feld gab es in der
   Verordnung seit jeher, das Wissen seit v8-341 — nur die Verbindung fehlte.
   Ein zweiter ausWissen-Aufruf, mehr war es nicht. Die Quittungsliste ist
   damit um zwei Eintraege geschrumpft (session.exercises in v8-347,
   session.repetitions jetzt).

   DREI EIGENE FEHLER, alle vom Werkzeug gefangen:
   • Die Herkunft `eingeengtAus` zeigte beim ersten Eintrag bereits den
     EINGEENGTEN Bereich — ich mutiere das Objekt, bevor ich es protokolliere.
     Die Angabe haette behauptet, die Quelle habe von vornherein den engeren
     Bereich genannt. Beim ersten Probelauf sichtbar geworden.
   • `eingeengtAus` stand auch dann da, wenn gar nichts eingeengt wurde (zwei
     identische Bereiche). Jetzt nur noch bei echter Verengung.
   • Die bestehende Probe KA_K2 wurde durch den Umbau WIRKUNGSLOS: sie zielte
     auf den Zweig fuer deckungsgleiche Zahlbereiche, den die Schnittmenge
     seither ohnehin abfaengt. Der Zweig traegt jetzt vor allem die
     Auswahllisten — die Probe zielt entsprechend dorthin, und der Kommentar
     im Code sagt, warum.

   NICHT PROBENGEDECKT, offen gesagt: „bei Auswahllisten wird nicht
   geschnitten" wird von zwei unabhaengigen Bedingungen getragen; jede
   Einzelmutation bleibt wirkungslos oder laesst den Test abstuerzen, statt
   eine Zusicherung zu melden. Belegt ist die Regel nur durch den gruenen
   Testfall, nicht durch eine Probe.

   GEAENDERT: knowledge-application.js (Schnittmenge, Herkunft),
   prescription-factory.js (Wiederholungen, Register). Suite 259/0 bei 7
   uebersprungenen, 139 Proben in 17 Katalogen, 135 gefahren / 4
   uebersprungen, jede angeschlagen. Wissensmodule vor/nach gehasht:
   unveraendert. Kohorten-Pin 023ee59b unveraendert.

   ============================================================
   VERTRAG v7 — DER WERT GEHOERT ZUM ZIEL (2026-08-13) · v8-347:

   ERST DER BEFUND, DER BEIM PLANEN AUFTAUCHTE. Eine Regel darf mehrere
   `outputs` nennen, trug aber genau EINE Zahl — und die Anwendung gab diese
   Zahl JEDEM Ziel der Regel. Eine Regel mit `session.last_prozent_1rm` UND
   `session.repetitions` haette denselben Bereich fuer Last in Prozent und
   fuer Wiederholungen bedeutet. Nur weil keine Regel im Bestand beides mit
   Zahl fuehrt, ist es nie aufgefallen. Gemessen und im Test festgehalten:

       ALT: eine Zahl, zwei Ziele → beide bekommen {min:4,max:5} „Saetze"
       NEU: zwei Groessen         → 4–5 Saetze UND 3–4 Wiederholungen

   Die beiden bekannten Grenzen (§36) waren nur Folgen davon.

   WAS v7 AENDERT, und sonst nichts:
     1. `appliesTo` bindet einen Claim an ein Ziel. Fehlt das Feld, gilt er
        fuer alle Ziele — das Verhalten bis v6. Deshalb bleibt jedes
        bestehende Paket gueltig, ohne dass eine Zeile daran zu aendern war.
     2. `use:'liste'` mit `selection` ist die neue Wertart fuer Aufzaehlungen,
        mit denselben Pflichtangaben und DERSELBEN Autorisierung wie eine
        Zahl. Eine Uebungsliste aus schwacher Quelle darf so wenig
        vorschreiben wie eine Satzzahl daraus.

   ZUM ERSTEN MAL BIS AUF DIE KARTE. `session.exercises` war das Ziel von
   sechs Regeln aus drei Quellen und endete im Nichts. Jetzt:

       mit Wissen  → ["kniebeuge","ausfallschritt"]
                     flags exercises_aus_wissen:R-EX, sets_aus_wissen:R-SETS
       ohne Wissen → generische Einheit, unveraendert
       Uebungen ohne Satzzahl → Verordnung GESPERRT statt geraten

   NEU AUCH: ein Tippfehlerschutz. Eine Groesse, die auf ein Ziel zeigt, das
   die Regel nicht nennt, wird beim Einspeisen abgewiesen. Genau der Fall
   (`session.rest_secons`), der zum Zielregister gefuehrt hat, faellt jetzt
   schon eine Stufe frueher auf.

   VIER EIGENE FEHLER, alle vom Werkzeug gefangen:
   • Die erste Fassung von Probe V7B zielte auf eine technisch ungepruefte
     Regel — die wird schon bei der AUSWAHL ausgeschlossen, die Probe blieb
     wirkungslos ('gap'). Jetzt trifft sie eine Notfallregel, die die Auswahl
     besteht und genau an der Vorschreib-Autorisierung scheitert. Dabei kam
     eine echte Testluecke heraus, die jetzt geschlossen ist.
   • V7C zielte auf den Laengenvergleich zweier Listen — bei einelementigen
     Listen wirkungslos.
   • Meine neue Hilfsfunktion dupliziert eine Zeile aus `_zahl`; damit wurde
     der Anker der bestehenden Probe F12 MEHRDEUTIG. Eigener Variablenname,
     Anker wieder eindeutig.
   • Fuenf weitere Proben verloren durch die Umbauten ihren Anker
     ('not_applied'). Alle nachgezogen — not_applied ist kein Beleg.

   MIGRATION: Vertragsversion 6 → 7, Pins in knowledge-consumer und
   running-capacity-factory nachgezogen, zwei Testdateien mit gepinnter
   Version angepasst (dabei fiel auf, dass batch3b1 in der Ueberschrift noch
   „Contract 5" sagte, waehrend 6 geprueft wurde — beides steht jetzt auf 7).
   Der Kohorten-Pin 023ee59b ist NICHT betroffen und unveraendert.

   NICHT GETAN: die acht Zahlen aus den Notizen erfassen. Das ist jetzt
   moeglich, verlangt aber Zuordnungen und Sicherheitsgrenzen am echten
   Quellenmaterial — Gians Entscheidung, nicht meine.

   NACHTRAG BEIM AUSLIEFERN, zum zweiten Mal an einem Tag: waehrend dieser
   Arbeit sind QUELLE-12 (Schulze, Rumpfkraft) und QUELLE-13 (Roeh, Erholung)
   dazugekommen. Der Sensor wurde auf dem Geraet sofort rot und nannte fuenf
   neue wirkungslose Ziele, die es im Container nicht gab. Quittiert, jetzt 42
   Eintraege. Auffaellig: vier der fuenf sind NEGATIVaussagen („kein
   Zusammenhang mit der Sprintleistung", „sehr schwache Korrelationen") —
   Wissen, das verhindern soll, dass jemand etwas hineinliest. Dafuer braucht
   es einen anderen Lesertyp als fuer Dosisangaben: eine Sperre, keine Zahl.

   GEAENDERT: knowledge-contracts.js (v7, Listen), knowledge-ingest.js
   (mehrere Groessen, auswahl), knowledge-application.js (Claim je Ziel,
   Listen, Konfliktlogik), knowledge-consumer.js + running-capacity-factory.js
   (Pins), prescription-factory.js (Uebungsleser, Register).
   Suite 259/0 bei 7 uebersprungenen (266 Dateien), 135 Proben in 17
   Katalogen, 131 gefahren / 4 uebersprungen. Wissensmodule vor/nach dem
   Probenlauf gehasht: unveraendert.

   ============================================================
   DAS FELD IST ZU KLEIN FUER DIE AUSSAGE (2026-08-13) · v8-346:

   AUFTRAG WAR „behebe alle Probleme". Die verbleibenden liessen sich nicht
   beheben, sondern nur AUFKLAEREN — und das Ergebnis ist wichtiger als jede
   Verkabelung, die ich stattdessen haette bauen koennen.

   FRAGE: Warum kommt von 30 Zielen genau EINES an? Bisherige Antwort:
   „es fehlen Leser". Die richtige Antwort liegt eine Ebene tiefer.

   GRENZE 1 · DER VERTRAG KENNT NUR EINEN ZAHLBEREICH JE REGEL.
   `zahlen` fasst {min,max} mit EINER Ausgabe-Einheit. Reale Dosisangaben
   sind mehrdimensional:

       RUN-RE-003: „vier bis fuenf Serien zu drei bis vier Wiederholungen
                    je Trainingseinheit ueber sechs bis zehn Wochen"
                    → drei Groessen, ein Feld

   GEMESSEN: 8 Regeln nennen eine Zahl im Text, 2 fuehren sie strukturiert.
   Das ist keine Nachlaessigkeit der Einspeisenden — es passt schlicht nicht
   hinein. Der Test weist die Zahl ab jetzt bei jedem Lauf aus, ausdruecklich
   als AUSGABE und nicht als Rot: wer das rot faerbt, verlangt etwas, das die
   Struktur nicht hergibt.

   GRENZE 2 · DER VERTRAG KENNT KEINE LISTEN.
   `session.exercises` ist das Ziel von SECHS Regeln aus DREI Quellen und
   damit der lohnendste Anschluss im Projekt. Eine Uebungsliste ist aber kein
   Zahlbereich. Der Anschluss scheitert nicht an der Leitung und nicht an der
   Erfassung, sondern daran, dass es fuer ihn keine Wertart gibt.

   WAS ICH DESHALB NICHT GETAN HABE: Zahlen „nachtragen". Bei sechs der acht
   Kandidaten haette ich waehlen muessen, WELCHE der drei Groessen ins eine
   Feld kommt — und die anderen beiden waeren verschwunden. Eine Dosis, von
   der zwei Drittel fehlen, ist keine Erfassung, sondern eine neue Behauptung.
   Dasselbe gilt fuer die Pflichtfelder `sicherheitsgrenzen` und
   `unsicherheit`: die haette ich mir ausdenken muessen.

   WAS FAELLIG IST: Vertrag v6 → v7 mit (a) mehreren benannten Groessen je
   Regel und (b) einer Listen-Wertart. Das beruehrt Pins, Paket-Hashes, die
   Kohortenpruefung und jedes bestehende Paket — nichts, was nebenbei
   passiert. Umsetzungsplan und Freigabe stehen aus.

   GEAENDERT: supabase/tests/knowledge_targets_test.mjs (Zahlen-Ausgabe),
   docs/STAND-UND-OFFENE-PUNKTE.md (Punkt 3b neu). Kein Produktivcode.
   Suite 258/0 bei 7 uebersprungenen, 130 Proben in 16 Katalogen,
   126 gefahren / 4 uebersprungen. Kohorten-Pin 023ee59b unveraendert.

   ============================================================
   ES GIBT NICHTS ZU VERDRAHTEN (2026-08-13) · v8-345:

   AUFTRAG WAR „mache alles\" — also Sensor auf die Notizdateien erweitern UND
   das Laufpaket verdrahten. Der erste Teil ist gebaut. Der zweite nicht, und
   das ist das eigentliche Ergebnis dieser Runde.

   DIE MESSUNG, DIE DEN AUFTRAG BEENDET HAT:

       Regeln mit einem maschinenlesbaren Zahlwert
         Gym       2 von 4   (GYM-HYP-001 Pause, GYM-HYP-002 Saetze)
         Laufen    0 von 14

   Die 14 Laufregeln sind REIN QUALITATIV. Ihr Feld `outputs` nennt Namen wie
   `experienceTier` oder `dimensionBudgets.easy` — aber kein Modul im Projekt
   liest diese Namen, auch `running-capacity-factory` nicht, fuer die sie
   gedacht waren (nachgeprueft: null Treffer im Quelltext). `outputs` ist bei
   den Laufregeln eine ABSICHTSERKLAERUNG, keine Schnittstelle.

   Damit ist „Laufen an den Consumer haengen\" in jeder Variante kein
   Verkabeln, sondern Neubau: es gibt keinen Wert, der fliessen koennte.
   Verdrahtet haette es genau eine Wirkung gehabt — in der Coverage-Matrix
   waere `knowledgePackWired: true` erschienen und haette wie Fortschritt
   ausgesehen. Genau die Sorte Fortschritt, die dieses Projekt sich zweimal
   selbst vorgemacht hat (v8-335, v8-341). Deshalb: nicht gebaut, sondern
   gemessen und aufgeschrieben.

   WAS DER ERWEITERTE SENSOR SOFORT GEFUNDEN HAT. Block C prueft jetzt auch
   `docs/wissen/*.json`, also Wissen, BEVOR daraus ein Paket wird. Ergebnis:
   sechs weitere wirkungslose Ziele — darunter

       session.exercises  ← SECHS Regeln aus DREI Quellen (04, 07, 11)

   Das ist die fachliche Grundlage fuer den offenen Punkt 2 (Uebungsauswahl)
   und der lohnendste Anschluss im ganzen Projekt: die Verordnung FUEHRT eine
   Uebungsliste, liest sie aber ausschliesslich aus `req.exercises` und nie
   aus Wissen. Was fehlt, ist nicht die Leitung, sondern die Angabe WELCHE
   Uebungen — die steht in den Notizen nur im Fliesstext, nicht im Feld
   `zahlen`. Dasselbe bei `plan.plyometrie_frequenz`: „zwei bis drei
   Einheiten je Woche ueber sechs bis zwoelf Wochen\" steht da, aber
   maschinenlesbar ist es nicht.

   ZWEI EIGENE FEHLER, beide vom eigenen Werkzeug gefangen:
   • Die Karteileichen-Pruefung stand im falschen Block und hielt nach der
     Erweiterung JEDE Notizquittung fuer ueberfluessig. Der Test meldete das
     selbst, bevor irgendetwas ausgeliefert wurde.
   • Probe ZR6 zielte zuerst auf `plan.erwartungsrahmen` — das kommt AUCH in
     einer Notiz vor und bleibt deshalb bekannt, wenn man es aus dem Paket
     entfernt. Die Probe war wirkungslos und meldete `wrong_test`. Jetzt
     zielt sie auf `experienceTier`, das es nur im Paket gibt.

   GEAENDERT: supabase/tests/knowledge_targets_test.mjs (Block C + Umbau der
   Karteileichen-Pruefung), _ziele-ohne-leser.json (35 Quittungen, davon 25
   inhaltlich korrigiert: die Factory liest sie NICHT), Probenkatalog
   knowledge-targets (4 → 6 Proben). KEIN Produktivcode der App.
   NACHTRAG BEIM AUSLIEFERN: der Sensor hat sofort gegriffen. Auf Gians
   Rechner war QUELLE-11 inzwischen von EINER auf VIER Regeln gewachsen — der
   Test wurde auf dem Geraet rot und nannte drei neue wirkungslose Ziele
   (plan.leistungsprognose, plan.stabilitaetsfokus, plan.kraftreferenz), die
   im Container noch gar nicht existierten. Genau dafuer ist er gebaut: neue
   Regeln fallen auf, bevor jemand sie fuer wirksam haelt. Quittiert, 38
   Eintraege. RUN-KRAFTPROFIL-003 zielt zusaetzlich auf session.exercises —
   damit sind es sechs Regeln aus drei Quellen, die auf die Uebungsliste
   warten.

   Suite 258/0 bei 7 uebersprungenen (265 Dateien), 130 Proben in 16
   Katalogen, 126 gefahren / 4 uebersprungen. Kohorten-Pin 023ee59b
   unveraendert, Wissensmodule vor/nach gehasht: unveraendert.

   ============================================================
   EIN VON DREISSIG (2026-08-13) · v8-344:

   DIE ZAHL ZUERST. Bevor dieses Register existierte, hat NIEMAND geprueft,
   ob ein eingespeistes Wissen ueberhaupt einen Leser hat. Gemessen an den
   beiden vorhandenen Paketen:

       Gym-Paket      1 von 5 Zielen wird gelesen
       Laufpaket      0 von 25
       zusammen       1 von 30

   Das eine ist `session.rest_seconds` — die Pausenregel, an der seit v8-341
   die ganze Wissenskette vorgefuehrt wird. Alle anderen 29 Ziele erzeugen
   Vorgaben, die niemand abholt.

   WIE ES AUFFIEL. QUELLE-11 (Kanjuh) lief sauber durch Einspeisung, Vertrag
   und Anwendung und erzeugte eine Vorgabe fuer
   `plan.kraftvergleich_normierung` — ein Ziel, das in der ganzen App nicht
   vorkommt. Der Vertrag prueft Zielnamen nicht; jede Zeichenkette wird
   angenommen. Ein Tippfehler haette sich identisch verhalten: still, gruen,
   wirkungslos. Dritte Wiederholung derselben Fehlerklasse nach v8-335
   (niemand liest es) und v8-341 (applyKnowledge ohne Aufrufer).

   WAS JETZT DA IST.
   `prescriptionFactory.GELESENE_ZIELE` — die zwoelf Ziele, die diese
   Verordnung wirklich liest, als LITERAL. `knowledge_targets_test.mjs`
   prueft die Liste BEIDSEITIG gegen den Quelltext (keines fehlt, keines ist
   erfunden) und danach jedes Paketziel: hat es keinen Leser, muss es in
   `_ziele-ohne-leser.json` mit BEGRUENDUNG stehen. Ein neues wirkungsloses
   Ziel wird rot, ein bewusst quittiertes bleibt gruen. Fehlt die
   Quittungsdatei, ist der Test rot — dieselbe fail-closed-Regel wie beim
   Kohorten-Pin seit v8-343; bewusstes Neusetzen ueber
   `ORVIA_QUITTIERE_ZIELE=JJJJ-MM-TT`.

   WARUM QUITTIEREN STATT VERBIETEN. Ein Ziel ohne Leser ist kein
   Vertragsbruch, sondern Wissen, das noch keine Verwendung hat. Es zu
   verbieten hiesse, 29 gepflegte Regeln wegzuwerfen; es stillschweigend
   durchzulassen hiesse, sich reicher zu rechnen als man ist. Die
   Quittungsdatei zwingt zur dritten Moeglichkeit: hinschreiben, warum.

   EIGENE FEHLER IN DIESER RUNDE, beide vom Test bzw. von Proben gefangen:
   die erste Fassung der Quittungen enthielt vierzehnmal „dito.\" — der Test
   verlangt je Eintrag eine echte Begruendung und wurde rot. Und ZR4 sichert,
   dass der Test den Registerblock aus dem Quelltext SCHNEIDET, bevor er die
   gelesenen Ziele sucht; ohne diesen Schnitt faende er jeden erfundenen
   Eintrag im Register selbst wieder und bestaetigte ihn.

   WAS DAS FUER DIE OFFENE LISTE HEISST — und was ich NICHT gebaut habe.
   Punkt 1 („Laufen an den Consumer haengen\") war so nicht sinnvoll: die 14
   Laufregeln erzeugen ausschliesslich Analysegroessen (`experienceTier`,
   `dimensionBudgets.*`, `safetyGateState` …). Selbst perfekt verdrahtet
   erreichte KEINE von ihnen die Verordnung — sie sprechen eine andere
   Sprache. Die Verdrahtung ist deshalb gestoppt und liegt als Entscheidung
   bei Gian; hier steht nur der Sensor, der das kuenftig sofort zeigt.

   GEAENDERT: js/engine/prescription-factory.js (nur additiv: Registerliteral
   + Export), neu supabase/tests/knowledge_targets_test.mjs,
   supabase/tests/_ziele-ohne-leser.json, tools/probes/knowledge-targets.json.
   Suite 258/0 bei 7 uebersprungenen (265 Dateien), 128 Proben in 16
   Katalogen, 124 gefahren / 4 uebersprungen. Kohorten-Pin 023ee59b
   unveraendert, Wissensmodule vor/nach gehasht: unveraendert.

   ============================================================
   DAS PRUEFWERKZEUG WAR SELBST UNGEPRUEFT (2026-08-13) · v8-343:

   ZUERST EIN EIGENER FEHLER, ZURUECKGENOMMEN. In v8-342 stand hier und in
   der Standdatei, der Kohorten-Pin `023ee59b` sei "nur Fliesstext, kein Test
   prueft ihn". Das war falsch. `shadow_adaptive_test.mjs` vergleicht den Pin
   seit v8-299 gegen `_acceptance-cohort.json` — ich hatte nur `.js/.mjs/.md`
   durchsucht und die `.json` uebersehen. Die Behauptung ist zurueckgenommen;
   wer sie in v8-342 gelesen hat, hat eine falsche Auskunft bekommen.

   BEFUND 1 · EIN FEHLENDER PIN GALT ALS BESTAETIGTER PIN.
   Beim Nachpruefen fiel an derselben Stelle die eigentliche Luecke auf:

       if (!existsSync(PIN)) { writeFileSync(PIN, …); ok('neu eingefroren', true); }

   Der Weg, die Pruefung ABZUSCHALTEN, war identisch mit dem Weg, sie zu
   bestaetigen — eine geloeschte Datei fror die Kohorte still neu ein und
   meldete einen Haken. Dazu schrieb sie FESTE Werte: ein am 13.08. neu
   gesetzter Pin behauptete, seit dem 08.08. eingefroren zu sein.
   Jetzt fail-closed: fehlt das Manifest, ist die Kohorte ungeprueft und der
   Test rot. Neu einfrieren geht weiter, aber nur als Ansage —
   `ORVIA_REPIN_COHORT=JJJJ-MM-TT`, und dann mit echtem Datum und der
   Version, die wirklich in sw.js steht. Alle drei Faelle gemessen.

   BEFUND 2 · DER RUNNER HAT DEN GRUND GERATEN.
   `run-all.mjs` beschriftete JEDEN uebersprungenen Test mit "brauchen eine
   echte Supabase-Instanz". Auf Gians Rechner uebersprangen 22 Dateien wegen
   fehlendem Chromium und wurden als Datenbanksache ausgegeben — niemand kam
   dadurch auf den fehlenden Browser. Darunter stand "GRUEN, keine
   fehlgeschlagenen Tests", und damit sah ein Lauf ohne ein Zehntel seiner
   Abdeckung aus wie ein vollstaendiger.
   Jetzt wird der Grund AUS DER AUSGABE gelesen, nach Gruppen getrennt, ein
   unbekannter Grund ausdruecklich als unbekannt ausgewiesen (ein geratener
   Grund beendet die Suche), und die Schlusszeile sagt
   "GRUEN, aber UNVOLLSTAENDIG — N geprueft, M nicht gelaufen".

   NEU: `run_all_reporting_test.mjs` (12 Zusicherungen). Der Runner ist das
   Werkzeug, dem alle anderen Zahlen dieses Projekts vertrauen, und war
   selbst ungeprueft — dieselbe Konstellation, aus der er entstanden ist.
   Geprueft wird mit echten Prozessen in einem Wegwerfverzeichnis unter
   /tmp; keine Datei traegt den Namen echter Projektdaten (v8-338).

   BEFUND 3 · EINE PROBE HAT EINE ECHTE LUECKE GEFUNDEN.
   KOH3 entfernte `source` aus COHORT_FIELDS — und keine Feldzusicherung
   wurde rot: `source` gehoert seit @11 zur Kohorte, stand aber in der
   Pruefliste des Tests nicht drin. Rot wurde nur der Pin, und den kann man
   bewusst neu setzen; damit waere das fehlende Feld dauerhaft unbemerkt
   geblieben. Die Liste ist jetzt vollzaehlig und wird BEIDSEITIG geprueft
   (kein Feld fehlt, keines steht zu viel drin).

   NICHT PROBENGEDECKT, offen gesagt: der fail-closed-Zweig aus Befund 1
   liegt im Test selbst; das Probenwerkzeug mutiert nur Dateien unterhalb
   der App-Wurzel. Belegt ist er durch drei gemessene Laeufe (Pin da → gruen,
   Pin weg → rot mit Anleitung, Pin weg + Ansage → gruen und ehrlich datiert).

   GEAENDERT: supabase/tests/run-all.mjs, supabase/tests/shadow_adaptive_test.mjs,
   neu supabase/tests/run_all_reporting_test.mjs, neue Kataloge
   tools/probes/test-runner.json und tools/probes/acceptance-cohort.json.
   Kein Produktivcode der App. Kohorten-Pin 023ee59b unveraendert.

   ============================================================
   EIN ZAEHLER IST KEINE PRUEFUNG (2026-08-13) · v8-342:

   HERKUNFT. Keine neue Funktion, sondern das Ergebnis einer Bestandsaufnahme:
   jede Zahl aus STAND-UND-OFFENE-PUNKTE.md gegen ausgefuehrten Code gehalten.
   Die Suite stimmt (256/0 bei 7 uebersprungenen), die Proben stimmen
   (109 angeschlagen / 4 uebersprungen) — zwei Aussagen stimmten nicht.

   BEFUND 1 · DIE MATRIX LOG, UND EIN GRUENER TEST HIELT SIE FEST.
   `sport-coverage-matrix` fuehrte Gym als paketlos, obwohl Gym seit v8-339
   ein Wissenspaket hat und seit v8-341 die einzige Sportart ist, deren
   Wissen die Verordnung erreicht. Aufgefallen ist es nicht, weil die
   Zusicherung in batch3b0 nur ZAEHLTE:

       matrixSports.filter(s => COVERAGE[s].knowledgePack).length === 1

   Mit Gym faelschlich auf `false` ergab das weiterhin 1 — gruen. Ein
   Zaehler kann eine falsche Aussage nicht von einer richtigen
   unterscheiden; er friert den Stand des Tages ein. Dieselbe Fehlerklasse
   wie die Paritaets-Gates aus dem GM7-Audit, nur kleiner.

   NEU: C5/C6 vergleichen, statt zu zaehlen. C5 gegen die Pack-Module, die
   wirklich im Verzeichnis liegen (Sportart aus dem MODUL gelesen, nicht aus
   dem Dateinamen — der Dateiname waere nur eine Vermutung ueber den
   Inhalt), C6 gegen das, was `knowledgeConsumer.registrierteSportarten()`
   tatsaechlich zurueckgibt. Beides pflegt sich selbst: ein neues Paket
   laesst den Test anschlagen, bis die Matrix es fuehrt.

   BEFUND 2 · BESITZEN UND GELESEN WERDEN IST NICHT DASSELBE.
   Beim Korrigieren kam heraus, dass `O.runningCapacityFactory` von KEINER
   Stelle der App gerufen wird — nur vom eigenen Unittest und vom
   Modul-Ladetest. Das Laufpaket mit seinen 14 gepflegten Regeln wirkt
   heute auf nichts. Haette ich nur `knowledgePack: true` fuer Gym
   nachgetragen, behauptete die Matrix ab jetzt zwei wirksame Wissensbasen,
   wo es eine gibt — der falsche Eindruck waere durch die Korrektur erst
   entstanden. Deshalb die getrennte Dimension `knowledgePackWired`
   (running false, gym true), testerzwungen gegen den Consumer.

   Fuer die offene Liste heisst das: „erst zusammenfuehren, dann eintragen"
   stand mit einer falschen Begruendung dort. Es gibt keine zwei Wege auf
   dieselben Regeln, es gibt einen lebenden und einen toten.

   PROBEN. Neuer Katalog `tools/probes/sport-coverage-matrix.json`, vier
   Stueck, alle angeschlagen — darunter der Originalbefund (SCM1: Gym
   zurueck auf paketlos) und die gefaehrlichere Gegenrichtung (SCM3: ein
   unverdrahtetes Paket als wirksam ausgeben). Gesamtstand jetzt
   117 Proben in 13 Katalogen, 113 gefahren / 4 uebersprungen.

   GEAENDERT: js/engine/knowledge/sport-coverage-matrix.js (v2 → v3),
   supabase/tests/batch3b0_knowledge_test.mjs, tools/probes/sport-coverage-matrix.json.
   Suite danach 256/0 bei 7 uebersprungenen, Kohorten-Pin 023ee59b nicht beruehrt.

   ============================================================
   DAS WISSEN WURDE VON NIEMANDEM GELESEN (2026-08-13) · v8-341:

   ZWEI BEFUNDE, beide aus dem Weiterarbeiten an der eigenen Liste.

   BEFUND 1 · DER ANSCHLUSS FEHLTE VOLLSTAENDIG.
   Nach v8-339 hatte Gym ein Wissenspaket: eingebunden in index.html, im
   Offline-Vorrat, von einem Test bewacht, vertragskonform, Klasse B. Und es
   aenderte am Verhalten der App NICHTS. Eine Suche ueber das gesamte
   Projekt ergab den Grund in einer Zeile:

       applyKnowledge wird von KEINER Stelle der App aufgerufen.

   Die Kette Quelle → Regel → Vorgabe → Verordnung → Karte lief bis hierher
   ausschliesslich in meinen Pruefskripten. In der laufenden App endete sie
   an `scheduler-v2`, das `buildPrescription` seit v8-336 mit einem
   Parameter `knowledge` aufrufen KOENNTE — und ihn nie uebergab. Das ist
   exakt derselbe Befund wie v8-335 ("eingespeist, aber niemand liest es"),
   nur eine Ebene hoeher. Und er waere wieder nicht aufgefallen, weil alles
   gruen war: kein Test lud den Consumer, also konnte keiner ihn vermissen.

   NEU: `knowledge-consumer@1`. Es haelt die Pakete je Sportart samt Pins
   und reicht sie an applyKnowledge. Mehr nicht — es entscheidet nichts und
   kennt keine Trainingslehre. Die PINS stehen bewusst dort als LITERAL:
   laese der Consumer sie aus dem Paket, bestaetigte das Paket sich selbst.
   Wird ein Paket neu erzeugt, blockiert es, bis jemand die Zahl bewusst
   nachzieht. Fail-closed: fehlt ein Modul oder stimmt ein Hash nicht, gibt
   es kein Wissen und einen benannten Grund — nie ein stilles Teilergebnis.

   GEMESSEN, ueber die echten Module und das echte Paket:
       Verordnung ohne eigene Pausenangabe
       → flags ["rest_aus_wissen:GYM-HYP-001", "produktwert:rpeKraft"]
       → rest_seconds 120
       ohne Wissen: rest_seconds null (die 120 s sind KEIN Default)
       mit eigener Angabe 240 s: bleibt 240 (Wissen ergaenzt, ueberschreibt nicht)

   EHRLICH FESTGEHALTEN, als Zusicherung statt als Fussnote: im WOCHENPLAN
   greift die Pausenregel noch nicht. Der Scheduler leitet fuer Gym keine
   Uebungsliste ab, und ohne Uebungen gibt es keine Satzpause. Der Anschluss
   steht, die Uebungsauswahl fehlt. Der Test schlaegt an dem Tag an, an dem
   der Scheduler Uebungen liefert — dann gehoert die Zusicherung von der
   Factory auf den Wochenplan gehoben.

   BEFUND 2 · WAS "WIDERSPRUCH" HEISST, WAR ZU GROB GEFASST.
   Die Konfliktregel setzte "spricht zum selben Ziel" mit "sagt etwas
   Unvereinbares" gleich. Am ersten echten Wissensbestand hiess das:

       RUN-RE-001  "Krafttraining verbessert die Laufoekonomie"   Klasse B
       RUN-RE-002  "Kraftausdauertraining bewirkt nichts"         Klasse B
       beide auf session.exercises, beide aus DERSELBEN Quelle
       ⇒ Ergebnis: KEINE Vorgabe

   Diese Saetze widersprechen sich nicht, sie ergaenzen sich. Und je mehr
   Wissen eingespeist wurde, desto haeufiger schwieg die App — die falsche
   Richtung. Unvereinbar koennen nur WERTE sein.

   NEU, in dieser Reihenfolge:
     1. qualitative Vorgaben konkurrieren nie — sie gehen alle durch
     2. qualitativ und quantitativ zum selben Ziel konkurrieren nicht
     3. zwei Zahlbereiche gleicher Klasse, DECKUNGSGLEICH ⇒ Bestaetigung
        (`bestaetigtDurch`), nicht Streit
     4. zwei Zahlbereiche gleicher Klasse, ABWEICHEND ⇒ weiterhin KEINE
        Vorgabe, jetzt mit den strittigen Werten im Konflikt

   Gemittelt wird nach wie vor nirgends: aus "3 Saetze" und "5 Saetze" wird
   nie "4". Gemessen am Realfall: 24 → 27 Vorgaben, 1 → 0 Konflikte.

   DREI EIGENE FEHLER, offen benannt:
     - V3 und V9 ankerten auf Zeilen, die diese Umbauten umgeschrieben
       haben, und meldeten `not_applied`. Das ist KEIN gruener Lauf: die
       Zusicherungen waren bis zur Korrektur ungeprueft. Zweites Mal in drei
       Fassungen — Anker sind Wartungsgut.
     - Ein bestehender Test griff ungeschuetzt auf `konflikte[0].hinweis`
       zu. Fiel die Liste leer aus, WARF er — und alle folgenden Bloecke der
       Datei liefen nicht mehr. Die Sonde schrieb den Ausfall dann den
       falschen Tests zu. Ein Test, der beim Fehlschlag die Datei abbricht,
       versteckt genau das, wofuer er da ist.
     - KCO1 und KCO2 meldeten LUECKEN in meinen eigenen frischen Tests: der
       Ladefehlerpfad und die Pin-Unabhaengigkeit waren ungeprueft. Beide
       geschlossen, KCO2 mit einer Quelltextpruefung — die Verhaltensprobe
       allein konnte es nicht, weil die Pin-Tabelle beim Laden EINMAL
       ausgewertet wird.

   NEUE TESTDATEI knowledge_consumer_test.mjs (30 Zusicherungen), neuer
   Katalog knowledge-consumer (4 Proben). 15 neue Zusicherungen in der
   Anwendung (45→53), 4 neue Proben dort (KA_K1-K4).
   113 Proben in 12 Katalogen, 109 gefahren / 4 uebersprungen.
   App-Gesamtsuite 256/0 Dateien, Kohorten-Pin 023ee59b unveraendert.
   Wissensmodule vor und nach dem Probenlauf gehasht: unveraendert.

   OFFEN: Laufen haengt noch nicht am Consumer. Das handgepflegte Paket
   laeuft ueber seinen eigenen Weg (running-capacity-factory, Shadow), und
   zwei Wege auf dieselben Regeln waeren schlechter als einer. Erst
   zusammenfuehren, dann eintragen.

   EIN PAKET PRO SPORTART WAR DAS ENDE DER KETTE (2026-08-13) · v8-340:

   BEFUND, gefunden beim Versuch, Sperlich 2015 zu Laufen hinzuzufuegen:
   `applyKnowledge` nahm genau EIN Paket. Damit war die ganze Einspeisekette
   faktisch EINMAL PRO SPORTART benutzbar. Wer fuer "running" eine zweite
   Quelle einspeiste, hatte zwei Moeglichkeiten:

     a) das bestehende Paket mit 14 handgepflegten Regeln ERSETZEN — der
        Schreibweg kennt nichts anderes, und der Ueberschreibschutz aus
        v8-338 haette ihn zurecht gestoppt
     b) die neuen Regeln liegen lassen

   Beides ist falsch. Und es war der eigentliche Grund, warum Gym in v8-339
   ein Paket bekommen konnte und Laufen nicht: Gym hatte vorher keins.

   DER AUSWEG IST BEWUSST NICHT, PAKETE ZUSAMMENZUSCHREIBEN. Das kuratierte
   Quellenregister (registryVersion 2, 17 Quellen) und das handgepflegte
   Laufpaket bleiben unangetastet — sie zu regenerieren haette die
   gewachsene Begruendungsschicht vernichtet und 112 Zusicherungen gebrochen.
   Stattdessen laeuft JEDES Paket einzeln durch den Vertrag, mit seinen
   EIGENEN Pins und seinem EIGENEN Register; erst die AUSGEWAEHLTEN Regeln
   treffen sich. Zwei Eigenschaften fallen dabei ab:

     - ein Paket mit falschem Hash blockiert SICH SELBST und reisst die
       anderen nicht mit (gemessen: 20 statt 24 Vorgaben, Paket benannt)
     - die Konfliktloesung sieht endlich ALLES, was zum selben Ziel spricht,
       statt nur einen Ausschnitt

   DURCHGEMESSEN mit dem echten Laufpaket + Sperlich nebeneinander:
     17 Regeln geprueft, 24 Vorgaben, 1 Konflikt, 0 blockierte Pakete.
     Die 14 bestehenden Regeln kommen als Klasse D (ORVIA-Vertraege), die
     5 neuen als Klasse B (Studien). Der Unterschied steht jetzt
     nebeneinander in einer Liste — genau dafuer gibt es die Klassen.

   RUECKWAERTSKOMPATIBEL, und das ist zugesichert: der Einzelaufruf liefert
   Zeichen fuer Zeichen dasselbe wie die Einerliste, und ein einzelnes
   defektes Paket meldet weiterhin seinen eigenen Grund statt eines
   Sammelfehlers.

   EINE BESTEHENDE PROBE MUSSTE NACHGEZOGEN WERDEN: V9 ankerte auf einer
   Zeile, die dieser Umbau umgeschrieben hat, und meldete `not_applied`.
   Das ist KEIN gruener Lauf — die Zusicherung war bis zur Korrektur
   ungeprueft. Drei weitere Proben (KA_M1-M3) waren zuerst `wrong_test`,
   weil ihr expectTest fuehrende Leerzeichen trug und der Abgleich ein
   Praefixvergleich ist.

   VIER NEUE QUELLEN GELESEN, drei davon eingespeist:
     Sperlich/Engel/Zinner 2015 (DZSM 66/9) — 46 Studien zur Laufoekonomie,
       5 Regeln, Klasse B. Volltext der PDF selbst extrahiert und gelesen.
     Hoff/Kaehler/Helgerud 2006 (DZSM 57/5) — FUSSBALL, nicht Laufen. Klaert
       aber die Einheitenfrage aus v8-339: das "4-5 Serien a 3-4 Wdh" bei
       Sperlich ist das 4x4-Protokoll EINER halbtiefen Kniebeuge. Zwei
       Quellen, die sich gegenseitig lesbar machen. 2 Regeln.
     Hirschmueller et al. 2005 (DZSM 56/2) — Achillessehne. Als
       medizinisch_heikel markiert und damit vom Vertrag in JEDEM Modus
       abgewaehlt (medical_safety_review_pending). Zum ersten Mal ist die
       medizinische Sperre an ECHTEM Inhalt gelaufen, nicht an einer
       Testvorlage. Sie soll dokumentiert sein, nicht wirken.

   EINE QUELLE BEGRUENDET ABGELEHNT: die Bachelorarbeit Halbeck/Schultze
   2018. Ihre Praemisse — Krafttraining steigere das Muskelvolumen und
   wirke deshalb negativ auf die Laufleistung — wird von Sperlich 2015
   ausdruecklich widerlegt (keine Veraenderung von Koerpermasse, fettfreier
   Masse, Koerperfett oder Extremitaetenumfaengen; in KEINER Studie
   negative Effekte). Vier eingeschlossene Studien, keine Begutachtung.
   Die Begruendung steht vollstaendig in der Datei, nicht nur hier.

   8 neue Zusicherungen (Anwendung 37->45), 3 neue Proben (KA_M1-M3).
   105 Proben in 11 Katalogen, 101 gefahren / 4 uebersprungen.
   App-Gesamtsuite 255/0 Dateien, Kohorten-Pin 023ee59b unveraendert.
   Wissensmodule vor und nach dem Probenlauf gehasht: unveraendert.

   OFFEN, unveraendert und jetzt schaerfer belegt: die Konfliktloesung
   meldet Gleichstand, sobald zwei gleich stark belegte Regeln dasselbe
   Ziel betreffen — auch wenn sie sich ergaenzen. Gemessen an RUN-RE-001
   ("Krafttraining wirkt") und RUN-RE-002 ("Kraftausdauer wirkt nicht"):
   beide Klasse B, beide auf session.exercises, Ergebnis KEINE Vorgabe.
   Fail-closed ist richtig, die Granularitaet nicht. Wartet auf Gians Votum.

   ERSTE ZAHL AUS EINER ECHTEN QUELLE AUF DER KARTE (2026-08-13) · v8-339:

   Gian lieferte eine PDF, die abrufbar war: Birgit Friedmann, "Neuere
   Entwicklungen im Krafttraining", Deutsche Zeitschrift fuer Sportmedizin
   58(1)/2007. Damit ist zum ersten Mal etwas eingespeist, das ich wirklich
   gelesen habe — und Gym hat zum ersten Mal ein Wissenspaket.

   DURCHGEMESSEN, Ende zu Ende:
     Ingest 1 Quelle / 4 Regeln → Vertrag advisory 4/4 → Klasse B
     → Vorgabe session.rest_seconds {min:120,max:180}, Herkunft
       SRC-FRIEDMANN-2007 → Factory flags ["rest_aus_wissen:GYM-HYP-001",
       "produktwert:rpeKraft"] → Karte:

         back_squat — 4 × 5 · RPE 7 · 2 min Pause

   Die 2 Minuten stammen nicht aus dem Code. Sie stammen aus einer
   zitierbaren Arbeit, und die Verordnung sagt das an sich selbst. Das ist
   der Punkt, auf den v8-330 bis v8-338 hingearbeitet haben.

   ZAHLEN DOPPELT AUSGELESEN. Die entscheidenden Werte habe ich mit einem
   zweiten, unabhaengigen Auslesen derselben PDF gegengeprueft. Beide
   Lesungen stimmen ueberein. Dass ich die Arbeit ueber ein Abrufwerkzeug
   gelesen habe und nicht Seite fuer Seite, steht in `grenzen`.

   EIN EINHEITENFEHLER, DEN ICH FAST GEMACHT HAETTE: die 5-6 Saetze gelten
   PRO MUSKELGRUPPE, nicht pro Uebung. Auf session.sets gelegt waeren aus
   5 Saetzen Quadrizeps 5 Saetze Beinpresse UND 5 Saetze Kniebeuge geworden
   — eine Verdopplung des Umfangs durch eine Verwechslung von Einheiten.
   Die Regel liegt deshalb auf plan.saetze_je_muskelgruppe, einem Ziel, das
   die Factory nicht konsumiert. Lieber wirkungslos und richtig.

   EIN MODELLIERUNGSFEHLER, KORRIGIERT: die Streuung -3 bis +59 Prozent
   hatte ich als `zahlen` eingetragen. Der Vertrag stufte die Regel prompt
   als "darf eine Zahl vorgeben" ein — also als Verordnung. Genau falsch
   herum: diese Zahlen begruenden den VERZICHT auf eine Prognose. `zahlen`
   heisst im Format "die Regel schreibt einen Wert vor"; eine illustrative
   Zahl gehoert dort nicht hin. Sie steht jetzt in der Aussage.

   BEFUND · EIN EINGESPEISTES PAKET WURDE NICHT GELADEN.
   `--schreiben` erzeugt die Moduldateien, verdrahtet sie aber nicht. Das
   Werkzeug sagt "noch zu tun" — und danach prueft es niemand. Alle Tests
   laufen ueber require(), nicht ueber die Seite: ein Paket, das in
   index.html fehlt, waere im Browser schlicht nicht da, und im
   Offline-Vorrat von sw.js haette es ebenfalls gefehlt. Dasselbe Muster
   wie v8-335 (eingespeist, aber niemand liest es), eine Ebene frueher.
   Neu prueft ein Test das VERZEICHNIS, nicht eine gepflegte Liste: jede
   kuenftige Sportart ist damit automatisch mitgeprueft, in index.html, im
   Offline-Vorrat und in der Ladereihenfolge Register-vor-Paket.

   BEFUND · MEIN TESTARTEFAKT HIESS WIE ECHTE DATEN. Der Schutztest aus
   v8-338 legte sein Wegwerf-Paket unter "gym" an. Als Gym in dieser Fassung
   ein echtes Paket bekam, klagte die Zusicherung "im echten Projekt entstand
   nichts" eine legitime Datei an. Jetzt heisst der Wegwerf-Sport
   "testsport_wegwerf". Ein Testartefakt darf nie den Namen echter
   Projektdaten tragen.

   STAND DER ABDECKUNG, ehrlich: 2 von 24 Sportarten haben ein Wissenspaket
   (Laufen, Gym), beide wissenschaftlich ungeprueft. Gym besteht aus VIER
   Regeln aus EINER Uebersichtsarbeit von 2007 — das ist ein Anfang, kein
   Fundament.

   7 neue Zusicherungen (60 im Ingest-Test), 3 neue Proben (I_WIRE, I_SW und
   die Korrektur aus v8-338). 102 Proben in 11 Katalogen, 98 gefahren /
   4 uebersprungen. App-Gesamtsuite 255/0 Dateien, Kohorten-Pin 023ee59b
   unveraendert. Wissensmodule vor und nach dem Probenlauf gehasht:
   unveraendert.

   DER ERSTE ECHTE EINSPEISEVERSUCH — DREI BEFUNDE (2026-08-13) · v8-338:

   Gian hat drei Quellen geliefert. Die Kette wurde zum ersten Mal nicht mit
   einer Testvorlage, sondern mit echtem Material gefahren. Sie hat gehalten
   — und dabei drei Dinge freigelegt, die alle gruen waren.

   BEFUND 1 · DER SCHREIBWEG HAETTE DEN WISSENSSTAND GELOESCHT.
   `knowledge-ingest.mjs --schreiben` erzeugt `<sport>-knowledge-pack.js`.
   Erzeugt heisst: ERSETZT. Fuer "running" liegt dort ein von Hand
   gepflegtes Paket mit 14 Regeln. Eine Notizdatei mit zwei Regeln haette es
   kommentarlos ueberschrieben — keine Warnung, keine Sicherung, kein
   Rueckweg. Das ist kein Randfall: wer eine ZWEITE Quelle einspeist, hat
   fast immer schon ein Paket. Neu faellt der Schreibweg geschlossen aus
   (Exit 3), nennt die Regelzahl des Bestands und verlangt --ueberschreiben.

   BEFUND 2 · MEIN EIGENER SCHUTZTEST HAT DIE DATEI ZERSTOERT.
   Die erste Fassung des Tests spawnte das Werkzeug gegen das echte Projekt.
   Solange der Schutz stand, harmlos. Die Mutationsprobe schaltete ihn ab —
   und der Testlauf schrieb wirklich: 34 KB / 14 Regeln → 7 KB / 2 Regeln.
   Die Sonde stellt die Quelldatei wieder her; die NEBENWIRKUNGEN eines
   Tests kann sie nicht zuruecknehmen. Das Paket wurde vom Geraet
   zurueckgeholt (Hash 42ca48f4 wiederhergestellt und geprueft). Der Test
   laeuft jetzt in einem Wegwerf-Verzeichnis mit eigenen Modulkopien und
   einem kuenstlichen Bestandspaket, plus der Zusicherung "kein Lauf hat im
   echten Projekt geschrieben". Lehre: ein Test, der einen Prozess startet,
   ist so gefaehrlich wie der Prozess.

   BEFUND 3 · EINE UEBUNG HIESS "undefined".
   In der Factory stand `exercise_id: String(e.exerciseId || e.id)`. Fehlen
   beide, ergibt das die Zeichenkette "undefined" — die jede Schemapruefung
   passiert. Auf der Wochenkarte stand woertlich:

       undefined — 4 × 5 · RPE 7 · 3 min Pause

   Kein Fehler, kein Flag, keine Sperre. Der einzige Fail-Open, den v8-336
   in der Factory uebersehen hatte. Jetzt: keine Kennung ⇒ null ⇒ der
   Validator sperrt (blocks[0]:exercise_id), wie bei fehlender Satzzahl.

   WAS DIE KETTE MIT ECHTEM MATERIAL LIEFERT (durchgemessen):
     Ingest 2 Quellen / 2 Regeln → Vertrag advisory 2/2 → Klasse B,
     "aus Studienlage abgeleitet", Quellen SRC-LLANOS-2024|SRC-RAMOS-2025
     → Anwendung 1 Vorgabe + 1 gemeldeter Konflikt → Factory ok
     → Karte "back_squat — 4 × 5 · RPE 7 · 3 min Pause"

   OFFEN, ehrlich benannt: die Anwendung meldet Gleichstand-Konflikt, sobald
   ZWEI gleich stark belegte Regeln dasselbe Ziel betreffen — auch wenn sie
   sich inhaltlich ergaenzen statt widersprechen. Fail-closed ist richtig,
   aber es skaliert falsch herum: je mehr Wissen eingespeist wird, desto
   haeufiger schweigt die App. Das ist eine Entwurfsentscheidung, keine
   Reparatur, und wartet auf Gians Votum.

   Von den drei gelieferten Quellen ist KEINE eingespeist. Zwei YouTube-
   Videos und eine Google-Books-Seite: den Inhalt habe ich nicht gesehen
   (429 bzw. robots.txt), und aus Metadaten eine Kernaussage zu formulieren
   waere erfunden. Die Quellendateien liegen vorbereitet in docs/wissen/,
   mit allem Geprueften gefuellt und den drei Feldern, die nur er fuellen
   kann. Eingespeist ist stattdessen, was ich wirklich gelesen habe: zwei
   PubMed-Abstracts zu Krafttraining und Laufoekonomie.

   6 neue Zusicherungen in der Factory, 7 im Ingest-Test, 2 neue Proben
   (F14, I_UEB). 100 Proben in 11 Katalogen, 96 gefahren / 4 uebersprungen.
   App-Gesamtsuite 255/0 Dateien, Kohorten-Pin 023ee59b unveraendert.

   JEDE ZAHL AUF DER KARTE SAGT JETZT, WOHER SIE KOMMT (2026-08-13) · v8-337:

   AUSGANGSPUNKT ist der Satz, den ich in v8-336 selbst als "noch nicht
   behoben" ins Log geschrieben habe: `_rpeTarget(7)` und die Auf-/Auslauf-
   Anteile 0.25 / 0.15 standen weiter als nackte Zahlen im Code. v8-336 hat
   die KRAFT-Vorgaben aufgeraeumt, die Ausdauer-Vorgaben nicht. Diese Fassung
   holt das nach — und nur das.

   WARUM DAS UEBERHAUPT EIN BEFUND IST. Die Zahlen waren nicht falsch. 25%
   Aufwaermen und RPE 7 im Tempolauf sind vertretbare Faustwerte. Falsch war
   ihr STATUS: sie sahen aus wie Fachwissen, waren aber Produktentscheidungen
   ohne Quelle — verstreut ueber vier Templates, in Ternaeroperatoren
   versteckt, nicht auffindbar, nicht pruefbar, nicht ersetzbar. Wer gefragt
   haette "warum 7?", haette keine Antwort gefunden. Und genau diese Frage ist
   der Kern des Wissensvertrags.

   WAS SICH AENDERT — nicht der Wert, die Sichtbarkeit:

     var DEFAULTS = { warmupAnteil: 0.25, ..., rpeTempo: 7, rpeKraft: 7 }

   Eine benannte Tabelle, jeder Eintrag mit [A] markiert und begruendet. Jeder
   Zugriff laeuft ueber _zahl(schluessel, ziel, req, flags) mit derselben
   Rangfolge wie bei Kraft in v8-336:

     1. eingespeistes WISSEN  → Flag "warmupAnteil_aus_wissen:RUN-WU-001"
     2. Produktwert           → Flag "produktwert:rpeTempo"

   Damit traegt JEDE Verordnung an sich selbst, welche ihrer Zahlen eine
   Quelle hat und welche eine ORVIA-Entscheidung ist. Vorher war das eine
   Frage an den Quelltext, jetzt steht es in den Flags der Verordnung.

   BEWUSST NICHT in die Tabelle gezogen: die PACE-FAKTOREN der Templates. Sie
   sind der fachliche Kern der Vorlagen, in phase7_s5 einzeln geprueft und in
   Probe F1 abgesichert. Sie zu den Produktwerten zu stellen wuerde sie
   beliebiger aussehen lassen, als sie sind.

   EIN TEST MUSSTE NACHGEBEN — und ich habe geprueft, ob das legitim ist.
   `eigene.flags.length === 0` war die Zusicherung "wer alles selbst mitgibt,
   loest keine Ersatzlogik aus". Sie faellt jetzt, weil Produktwerte absichtlich
   geflaggt werden. Der Test prueft nicht mehr auf Leere, sondern auf die
   Aussage, um die es geht: KEIN Flag auf `_aus_wissen`. Der Code wurde nicht
   an den Test angepasst, sondern der Test praezisiert.

   ZWEI PROBEN MUSSTEN KORRIGIERT WERDEN, beide meine Fehler:
     F2  — Suchtext veraltet (zeigte auf die alte Ternaer-Form, die es nicht
           mehr gibt): "not_applied", also kein Beleg. Neu verankert.
     F13 — die verschobene Aufwaermzeit schlug im ERWARTETEN Test nicht an,
           weil dessen Dauertoleranz ±10% betraegt; angeschlagen hat ein
           anderer Test. Auf den umgehaengt, statt die Toleranz zu senken.

   8 neue Zusicherungen (33→41), 3 neue Proben (F11-F13). 98 Proben in 11
   Katalogen, 94 gefahren / 4 uebersprungen (fremde Wurzel — uebersprungen ist
   KEIN Beleg). App-Gesamtsuite 255/0 Dateien (7 uebersprungen, brauchen eine
   echte Supabase-Instanz), Kohorten-Pin 023ee59b unveraendert.

   AUSSERDEM, ohne Codeaenderung: docs/ENGINE-PLAN-AKTIVIEREN.md. Der
   Engine-Plan bleibt bewusst OHNE App-Knopf. `engine_v2_plan` liegt in
   user_feature_flags und wird serverseitig geholt; ein Knopf in der App, der
   das umgeht, wuerde den Kill-Switch entwerten. Die Anleitung beschreibt
   stattdessen SQL + ORVIA.enginePlanActivate() + Rueckweg — samt dem Absatz,
   was dabei NICHT geschuetzt ist: der Plan ist inhaltlich nur so gut wie das
   hinterlegte Wissen, und das ist derzeit eine Sportart, ungeprueft.

   DIE FACTORY RIET ZAHLEN, DIE SIE NICHT RATEN DARF (2026-08-13) · v8-336:

   BEFUND — ein Widerspruch INNERHALB des Projekts. In prescription-factory
   stand fuer Kraft:

       sets: e.sets >= 1 ? e.sets : 3
       rest_seconds: e.restSeconds != null ? e.restSeconds : 120

   Beides geratene Zahlen. Und `strength-plan@1` verbietet genau das
   woertlich, im Kommentar an der eigenen Pruefung:

       "Satzanzahl ist Pflicht. Kein Default — 3 waere geraten."

   Zwei Module desselben Projekts widersprachen sich also, und die Factory
   gewann still: wer eine Uebung ohne Satzangabe einplante, bekam drei Saetze
   vorgeschrieben, die keine Quelle je genannt hat — und niemand haette
   erkannt, woher die Zahl stammt. Genau das, was ORVIA an jeder anderen
   Stelle vermeidet.

   NEUE REIHENFOLGE, ohne Raten:
     1. was die Uebung selbst mitbringt        (unveraendert vorrangig)
     2. was aus eingespeistem WISSEN kommt     — mit Herkunft im Flag
        ("sets_aus_wissen:GYM-S-001")
     3. gar nichts — die Verordnung wird mit Grund BLOCKIERT
        (schema_invalid / blocks[0]:sets), statt eine Zahl zu erfinden

   Damit schliesst sich die Kette, die in v8-334/335 begonnen wurde:
   Coachvideo → Notiz → Regel → Vorgabe → Verordnung → lesbare Zeile. Am
   Beispiel durchgemessen:

       Wissen liefert: session.sets=3, session.rest_seconds=150
       Karte zeigt:    "Kniebeuge — 3 Sätze · RPE 7 · 3 min Pause"

   Erstmals stammt eine Zahl auf der Karte aus einer benannten Quelle statt
   aus dem Code.

   EINE PROBE, DIE ZUERST NICHTS BEWIES (F10): die Pruefung `art === 'zahl'`
   war redundant zur Wertpruefung, weil knowledge-application nie eine
   Empfehlung MIT Wert liefert — die Mutation blieb gruen. Geschlossen mit
   einem fehlerhaften Aufrufer, der beides widerspruechlich setzt: `art` ist
   massgeblich, nicht das blosse Vorhandensein eines Werts.

   NOCH NICHT BEHOBEN, ehrlich benannt: `_rpeTarget(7)` als Ziel-Default und
   die Aufwaerm-/Auslauf-Anteile (0.25 / 0.15) sind weiterhin Zahlen aus dem
   Code. Sie stehen als naechste auf derselben Liste — diese Fassung raeumt
   die Kraftvorgaben auf, nicht alles.

   8 neue Zusicherungen, 4 neue Proben (F7-F10). 95 Proben in 11 Katalogen,
   App-Gesamtsuite 255/0 Dateien, Kohorten-Pin 023ee59b unveraendert.

   EINGESPEISTES WISSEN WIRKT (2026-08-13) · v8-335:

   BEFUND direkt nach v8-334, gemessen statt vermutet: Wissen liess sich
   einspeisen, der Vertrag waehlte es im Advisory-Modus korrekt aus, die
   Einordnung stimmte — nur LAS es niemand. Die Suche nach Consumern ergab
   genau einen (`running-capacity-factory`), und der ist fest auf das
   Running-Pack im Shadow-Modus gepinnt. Ein eingespeistes Gym-Pack haette am
   Verhalten der App NICHTS geaendert. Das Einspeisen waere ein Ritual ohne
   Wirkung geblieben — und das haette niemand bemerkt, weil alles gruen war.

   NEU: `knowledge-application@1` uebersetzt ausgewaehlte Regeln in konkrete
   Vorgabewerte. Jede Vorgabe traegt Wert, Einheit, Sicherheitsgrenze,
   Ausschluesse, den vorsichtigen Weg — und ihre HERKUNFT. Der Anzeigesatz
   nennt beides untrennbar:

       "2–4 harte Sätze je Übung (Fach-/Coachkonsens, Klasse C)"

   DIE HAERTESTE ZUSAGE: ES WIRD KEIN WIDERSPRUCH GEGLAETTET. Sagen zwei
   gleich stark belegte Quellen etwas Unterschiedliches zum selben Ziel,
   entsteht KEINE Vorgabe — der Konflikt wird gemeldet, mit beiden Regeln und
   der Aufforderung, ihn zu entscheiden. Heimlich zu mitteln waere die
   bequemste und zugleich falscheste Loesung: aus "Coach A sagt 3 Saetze,
   Coach B sagt 5" wuerde "4 Saetze" — eine Zahl, die niemand gesagt hat, die
   aber voellig plausibel aussieht und deshalb in keinem Test aufgefallen
   waere.

   Die EINZIGE zulaessige Aufloesung ist eine nachweislich bessere
   Evidenzklasse. Dann wird das Ueberstimmen PROTOKOLLIERT, nicht
   verschwiegen: `ueberstimmt: ['GYM-COACH-001']`.

   WEITER FAIL-CLOSED: fehlender Pin, veraendertes Paket, fehlender Vertrag,
   werfender Selektor — alles endet in einer gemeldeten Blockade und nie in
   einem leeren Ergebnis, das wie "nichts gefunden" aussieht. Medizinisch
   heikle Regeln bleiben gesperrt; dieses Modul hebt nichts auf, was der
   Vertrag sperrt.

   EINE LUECKE, DIE ERST DIE PROBE ZEIGTE (V4): Die Zusicherung "eine nicht
   freigegebene Zahl wird nicht ausgegeben" war ungeprueft, weil ALLE bis
   dahin gebauten Faelle schon vom Vertrag aussortiert wurden und die
   Zahlenpruefung gar nicht erreichten. Geschlossen mit einer Notfallregel:
   sie wird ausgewaehlt, darf aber nie eine Zahl vorschreiben — sonst wuerde
   die vorsichtige Rueckfallebene zur Vorgabe. Dass eine Zahl DA WAR, aber
   gesperrt ist, bleibt sichtbar (`zahlGesperrt`); sonst saehe es aus, als
   haette die Quelle nie eine genannt.

   NOCH EIN EIGENER TESTFEHLER, ehrlich benannt: die erste Fassung des
   Vertrag-fehlt-Tests lautete `KA.applyKnowledge({…}) && true` — immer wahr,
   also ein gruener Test ohne jede Aussage. Zweiter Fall derselben Sorte in
   drei Fassungen. Ersetzt durch eine Pruefung, die den globalen Rueckfall
   ausdruecklich leert.

   Ausserdem: Anleitung und Vorlage unter docs/wissen/ — der Weg von einem
   YouTube-Video zur wirksamen Vorgabe steht jetzt vollstaendig beschrieben.

   37 neue Zusicherungen, 11 neue Proben (V1-V11). 91 Proben in 11 Katalogen,
   App-Gesamtsuite 255/0 Dateien, Kohorten-Pin 023ee59b unveraendert.

   OFFEN: die Vorgaben landen noch nicht auf der Wochenkarte — dafuer muss
   der Scheduler sie anfordern. Und ohne echte Quellen bleibt die Kette leer:
   das Beispiel ist eine Vorlage, kein Wissen.

   JETZT FUETTERST DU DIE APP (2026-08-13) · v8-334:

   Gians Architekturvorgabe lautet seit Monaten: die App soll kein eigenes
   Denken haben, sondern ihr Wissen aus vielen externen Quellen ziehen —
   Coachwissen, Videos, Studien —, die ER einspeist. Der Wissensvertrag kann
   das seit v8-329 tragen. Was fehlte, war der Weg hinein.

   WARUM ES OHNE DIESEN WEG GESCHEITERT WAERE. Eine einzige Regel verlangt im
   Vertrag 20 Pflichtfelder, ein Claim elf, eine Quelle dreizehn — darunter
   `positionRole`, `seasonPhase`, `previousVersion`, `conservativeFallback`.
   Wer damit taeglich Wissen einpflegen soll, hoert nach dem dritten Eintrag
   auf. Die Idee waere nicht an der Architektur gescheitert, sondern an der
   Eingabe.

   DIE TRENNLINIE, UM DIE ALLES GEHT. `knowledge-ingest` fuellt AUSSCHLIESSLICH
   auf, was keine inhaltliche Entscheidung ist — Formalien, Claim-Huelle,
   Governance-Grundzustand. Erzwungen wird alles Uebrige, und zwar mit einer
   Fehlermeldung, die die naechste HANDLUNG nennt statt nur den Feldnamen:

     "quellen[0].grenzen: Was folgt daraus ausdruecklich NICHT? Z. B. ‚gilt
      nur fuer Trainierte, keine Aussage fuer Anfaenger‘."

   Pflicht sind: wer sagt es, wann, wo nachzulesen; fuer wen gilt es und fuer
   wen ausdruecklich nicht; was folgt daraus NICHT; welche Unsicherheiten
   bleiben; und bei Zahlen zusaetzlich Einheiten, Gueltigkeitsbereich,
   Ausschluesse, Unsicherheit und Sicherheitsgrenzen. Eine Zahl ohne
   Sicherheitsgrenze ist keine Vorgabe, sondern ein Risiko.

   NIE AUFGEFUELLT WIRD:
     · eine Freigabe — alles Eingespeiste startet technisch UND
       wissenschaftlich ungeprueft, mit leerer reviews-Liste
     · ein Risk-of-Bias-Urteil — es bleibt ehrlich 'not_formally_assessed',
       weil niemand ein formales Verfahren durchgefuehrt hat
     · eine unabhaengige Validierung — die laesst sich nicht per Eingabefeld
       behaupten; das Feld wird ignoriert und bleibt false
     · eine Quellenart, die nicht in der geschlossenen Liste steht — sonst
       entschiede ein Tippfehler ueber die Evidenzklasse

   URHEBERRECHT ALS HARTE GRENZE, NICHT ALS EMPFEHLUNG. Aufgenommen werden
   nur eigene Paraphrasen: Laengengrenze (700 Zeichen fuer die Kernaussage,
   400 fuer eine Regelaussage) plus die ausdrueckliche Bestaetigung
   "eigene_worte": true bei JEDEM Eintrag. Fakten und Zahlen sind nicht
   schutzfaehig und duerfen frei verwendet werden, fremde Formulierungen
   nicht. EHRLICHE GRENZE: geprueft wird nur, dass die Bestaetigung dasteht —
   Software kann kein Plagiat erkennen, und das Modul tut auch nicht so.

   DER WEG IN ZAHLEN, am mitgelieferten Beispiel gemessen: ein Coachvideo
   ueber Krafttraining fuer Laeufer wird zu Klasse C mit Confidence medium,
   Basis "Fach-/Coachkonsens" — und darf im Advisory-Modus die Vorgabe "2–4
   harte Saetze" begruenden, aber erst nach technischer Pruefung und in
   production weiterhin nicht. Genau die Abstufung, die v8-329 eingefuehrt
   hat, greift hier zum ersten Mal an echtem Fremdwissen.

   ZWEITER GRIFF FUER DAS SCHREIBEN. Standard ist nur pruefen; erst
   --schreiben legt Module an, und der technische Pruefstatus kommt nur mit
   --technisch-geprueft "Name". Ohne ihn waehlt der Vertrag die Regeln in
   JEDEM Modus ab. Dasselbe Muster wie beim Garmin-Push (--send): der
   schreibende Weg braucht einen bewussten Griff.

   KEINE NEBENWIRKUNG AUF BESTEHENDES. Jede eingespeiste Sportart bekommt ihr
   EIGENES Quellenregister. Ein Eintrag im bestehenden `knowledge-sources.js`
   wuerde dessen Inhalts-Hash aendern und die gepinnte Running-Kette
   blockieren.

   EIN EIGENER TESTFEHLER, ehrlich benannt: die erste Fassung des
   Reinheitstests verbot jedes `new Date` und schlug an einer reinen
   Kalenderpruefung an, die der Wissensvertrag selbst genauso macht. Verboten
   ist eine eigene ZEITQUELLE (Date.now, new Date ohne Argument), nicht das
   Pruefen eines uebergebenen Datums. Test praezisiert statt Code verbogen.

   49 neue Zusicherungen, 12 neue Proben (N1-N12) auf genau der Trennlinie.
   80 Proben in 10 Katalogen, App-Gesamtsuite 254/0 Dateien, Kohorten-Pin
   023ee59b unveraendert.

   OFFEN: das Beispiel ist eine Vorlage, kein Wissen. Das Gym-Pack entsteht
   erst, wenn echte Quellen eingespeist werden — und die kommen von Gian.

   DIE VORGABE ERREICHT DEN PRODUKTIVEN WEG (2026-08-12) · v8-333:

   v8-332 hat die Verordnung sichtbar gemacht — in der VORSCHAU. Diese Fassung
   prueft nach, ob sie den produktiven Weg ueberhaupt ueberleben wuerde. Sie
   haette es nicht: an zwei Stellen waere sie erneut haengengeblieben.

   BEFUND 1 · DER FINGERABDRUCK WAR BLIND FUER DIE VERORDNUNG.
   `baselineFingerprint` entscheidet, ob eine neu gerechnete Woche als
   Aenderung gilt oder als 'unchanged' verworfen wird. Verglichen hat er nur
   Tag, Sportart, Einheitenname und Umfangstext. Gemessen:

       4 × 5 min                       →  "1|Laufen|Intervalle|32 min"
       5 × 4 min                       →  "1|Laufen|Intervalle|32 min"
       gleiche Struktur, and. Tempo    →  "1|Laufen|Intervalle|32 min"

   Alle drei identisch. Folge: Passt die Engine die Intervallstruktur an oder
   verschiebt sie das Tempofenster, weil eine neue Schwellenpace gemessen
   wurde, meldet activate() 'unchanged' und aktiviert NICHT. Die neue Vorgabe
   erreicht den Nutzer nie — er wuerde sich irgendwann wundern, warum sich
   sein Tempo nie anpasst. Ausgerechnet das, was v8-332 sichtbar gemacht hat,
   waere im Betrieb eingefroren gewesen.

   Behoben: der Abdruck traegt jetzt einen Hash der VOLLEN Verordnung. Bewusst
   der ganze Strukturvergleich statt einer Auswahl einzelner Felder — eine
   Auswahl waere wieder blind fuer alles, woran heute niemand denkt. Die
   Idempotenz bleibt, weil die prescription-factory nachweislich rein ist:
   gleiche Lage ⇒ gleiche Verordnung ⇒ gleicher Abdruck, also weiterhin keine
   Revision beim blossen Oeffnen des Plans.

   Warum es niemandem auffiel: alle Testfixtures trugen dieselbe simple
   Ein-Block-Verordnung. Muster `data_lacks_var` — die realen Daten uebten den
   Zweig nicht aus.

   NEBENBEFUND aus der Probe dazu: der catch-Zweig der neuen Hashfunktion warf
   ALLE nicht serialisierbaren Verordnungen auf denselben Ersatzwert 'rx?' —
   fuer genau diese Faelle waere der Vergleich wieder blind gewesen. Jetzt
   ein grober, aber stabiler Strukturabdruck als Notfallweg.

   BEFUND 2 · DIE ECHTE WOCHENKARTE LAS `rx` GAR NICHT.
   v8-332 hat die Verordnung ans Anzeige-Item gehaengt und in der VORSCHAU
   gerendert. Der produktive Kartenrenderer kannte sie nicht — nach dem
   Einschalten haette dort weiterhin nur "59 min" gestanden. Neu:
   `gmRxLinesHTML` neben dem bestehenden `gmPlannedLinesHTML` (Kraft), beide
   auf derselben Karte. Ohne `rx` liefert es '' — Altbestand und
   Legacy-Einheiten sehen Zeichen fuer Zeichen aus wie vorher.
   Aufwaermen und Auslaufen treten optisch zurueck, verschwinden aber NICHT:
   sonst fehlte dem Nutzer die halbe Einheit. Und die Zeile darf umbrechen —
   "5 × (Belastung 4 min @ 4:36–4:54 min/km · Pause 3 min)" abzuschneiden
   waere schlimmer als eine zweite Zeile, weil dann genau die Zahl fehlt,
   wegen der die Zeile ueberhaupt dasteht.

   MITGEPRUEFT: die Verordnung ueberlebt `baselineFromDays` und landet in der
   persistierten Baseline (gemessen: 945 statt 345 Zeichen je Einheit —
   Faktor 2,7, bei sieben Einheiten rund 6,6 KB statt 2,4 KB).

   EIN TESTHARNESS NACHGEZOGEN: gm2_plan_parity schneidet renderGMPlan aus
   ui.js heraus und evaluiert es isoliert; der neue Helfer fehlte dort und der
   Test brach ab. Stub ergaenzt, mit derselben Begruendung wie bei
   gmPlannedLinesHTML in v8-323 — die Ausgabe liegt innerhalb von
   .session-main und beruehrt die geprueften Blockklassen nicht.

   Zwei neue Proben (A7, A8). A7 stellt die Blindheit wieder her und belegt,
   dass sie jetzt auffiele.

   ZAHLENKORREKTUR (beim Nachzaehlen auf Nachfrage): hier stand zuerst
   "76 Proben", in v8-332 "73". Beides falsch — nachgezaehlt aus den
   Katalogdateien sind es 68 (v8-332: 66). Der Cache-Schluessel bleibt
   bewusst v8-333: am Verhalten aendert sich nichts, nur an einer Zahl in
   dieser Beschreibung. Aber eine falsche Zahl in der eigenen Buchfuehrung
   ist genau die Sorte Fehler, die dieses Projekt sonst bei anderen sucht.

   68 Proben in 9 Katalogen, App-Gesamtsuite 253/0
   Dateien, Kohorten-Pin 023ee59b unveraendert.

   DIE VORGABE WIRD SICHTBAR (2026-08-12) · v8-332:

   Der Punkt, um den es Gian von Anfang an ging: die App soll sagen, WAS man
   heute trainiert — nicht nur, dass man laeuft. Auf der Wochenkarte stand
   bisher "Laufen · Intervalle · 59 min". Was drinsteht — 15 min Aufwaermen,
   5 × 4 min bei 4:36–4:54 min/km mit 3 min Trabpause, 9 min Auslaufen —
   rechnet die Engine seit Monaten jeden Tag aus und warf es weg.

   1 · WO ES VERLOREN GING. `week-projection.js` baute das Anzeige-Item aus
   {t, l, d, id, prov} — und liess `prescription` an genau dieser Stelle
   fallen. Neu traegt das Item `rx`: die ROHE Verordnung, nicht fertiger Text.
   Formatieren ist Sache eines eigenen Moduls, Sprache und Aussehen Sache der
   Oberflaeche; waere hier schon Text, koennte niemand mehr etwas anderes
   daraus machen — und der Garmin-Exporter braucht ohnehin die Struktur.
   Es ist eine tiefe KOPIE, kein Verweis: das Anzeigemodell darf keine
   Struktur mit dem Scheduler teilen, sonst veraendert eine Bearbeitung der
   Karte rueckwirkend die Quelle (dieselbe Fehlerklasse wie A5/A6).

   2 · NEUES MODUL `prescription-format@1`. Macht aus einer Verordnung
   lesbare Zeilen — und sonst nichts. Kein DOM, kein Storage, keine
   Zeitquelle, und ausdruecklich KEIN HTML: der Rueckgabewert sind Daten mit
   Art und Text, damit die Oberflaeche ueber das Aussehen entscheidet.
   Seine einzige harte Zusage: es wird NICHTS erfunden.
     · fehlt das Pace-Fenster, steht kein Tempo da — kein geschaetztes
     · fehlt die Dauer, steht keine Dauer da
     · unbekannter Blocktyp wird GEMELDET, nicht mit "Einheit" ueberdeckt
     · Wiederholungsgruppe mit 0 oder -1 Durchgaengen: Warnung statt "0 ×"
     · Uebung ohne aufgeloesten Namen zeigt die exercise_id — sichtbar
       unaufgeloest statt stillschweigend "Übung"
   Nebenbei belegt: RUN-INT-001 haelt sich bis in die Anzeige durch. Ohne
   Pace-Evidenz erscheint in der ganzen Karte kein einziges min/km.

   3 · VORSCHAU STATT MUTPROBE. Um die Engine-Woche zu sehen, musste man
   bisher `engine_v2_plan` einschalten — und das ERSETZT den bestehenden
   Wochenplan. Man musste seinen Plan aufs Spiel setzen, um zu erfahren, ob
   der Ersatz ueberhaupt taugt. Der neue Abschnitt "Trainingsplan-Vorschau
   (Engine)" im Profil rechnet und ZEIGT, ohne zu aktivieren. Deshalb ist er
   auch kein versteckter Testweg wie der Gate-Abschnitt, sondern normal
   sichtbar — er kann nichts kaputt machen.

   4 · EINE ZUSAGE, DIE ICH ZURUECKNEHMEN MUSSTE. Erst geschrieben hatte ich
   "es wird nichts gespeichert". Der Browsertest hat das widerlegt:
   `buildWeekNow()` schreibt den ueblichen Schattenprotokoll-Eintrag. Das ist
   unschaedlich, weil der Eintrag je Woche ERSETZT statt angehaengt wird —
   aber die Formulierung war falsch und steht nicht mehr da. Statt der
   bequemen Zusage prueft der Test jetzt die Groesse, die wirklich zaehlt:
   die Zahl der protokollierten Wochen darf nicht wachsen, sonst
   verfaelschte ausgerechnet die Vorschau das ≥14-Tage-Gate, auf dessen
   Basis spaeter ueber die Aktivierung entschieden wird. Was gilt: der PLAN
   wird nicht angefasst, es entsteht kein Rueckweg-Schnappschuss, es wird
   nichts aktiviert — alles drei im Browser gemessen, nicht behauptet.

   5 · GEPRUEFT AN ZWEI EBENEN. Der Modultest belegt, dass die Verordnung
   lesbar wird; er belegt NICHT, dass die Oberflaeche sie zeigt. Genau diese
   Luecke zwischen "Modul rechnet richtig" und "Nutzer sieht es" war der
   Grund, warum die Engine monatelang unbemerkt ins Leere rechnete. Deshalb
   zusaetzlich `rx_preview_ui_test.mjs`: echte Seite, echter Browser, echter
   Scheduler-Durchlauf.

   11 neue Proben (R1–R11) auf genau den Stellen, an denen ein Wert
   stillschweigend entstehen koennte — Ersatzwerte, Sammelbegriffe, geteilte
   Strukturen. R11 stellt den Zustand VOR dieser Fassung wieder her und
   belegt, dass der Verlust der Verordnung jetzt auffallen wuerde.

   61 neue Zusicherungen (prescription_format 42, rx_preview_ui 19),
   66 Proben in 9 Katalogen, App-Gesamtsuite 253/0 Dateien,
   Kohorten-Pin 023ee59b unveraendert.

   NOCH NICHT AKTIV: der produktive Wochenplan kommt weiterhin aus dem
   Legacy-Pfad. Die Vorschau zeigt, was kaeme — das Einschalten bleibt eine
   ausdrueckliche Entscheidung.

   ERST DIE PROBLEME, ZWEITER DURCHGANG (2026-08-12) · v8-331:

   Fortsetzung von v8-330: die fuenf Module, die noch ohne Probenkatalog
   waren, stehen jetzt darunter. 30 neue Proben, SIEBEN weitere Testluecken —
   und zwei davon waren wieder echte Befunde im Produktivcode.

   ZWEI ECHTE BEFUNDE:

   B1 · week-projection: `if (!pr || typeof pr !== 'object')` liess ARRAYS
   durch, weil `typeof [] === 'object'`. Eine Vorgabe in Arrayform kam bis zur
   Typtabelle und wurde dort mit dem FALSCHEN Grund gemeldet
   ('unknown_session_type' statt 'prescription_missing') — die Fehlersuche
   haette also am falschen Ende begonnen. Das restliche Projekt prueft
   ueberall ausdruecklich auf Nicht-Array-Objekt; hier fehlte es. Behoben.

   B2 · workout-store/workoutRepository: `targetWeightKg: 0` haette bei einer
   truthy-Pruefung als NULL geschrieben. `strength-plan@1` haelt ausdruecklich
   fest, dass 0 kg "ohne Zusatzlast" bedeutet [A1] und nicht "keine Angabe" —
   Klimmzuege ohne Zusatzgewicht waeren nicht mehr von "Gewicht unbekannt" zu
   unterscheiden gewesen. Der Code war richtig, aber UNGEPRUEFT in BEIDEN
   Schreibwegen. Jetzt als Probenpaar T2/T2b abgesichert, weil genau diese
   Online/Offline-Paritaet in v8-322 schon einmal auseinanderlief.

   DIE UEBRIGEN FUENF LUECKEN:
     A6  revert() lieferte moeglicherweise die Referenz statt einer Kopie —
         geprueft wurde nur die GLEICHHEIT, die eine blosse Referenz genauso
         erfuellt. Wer den zurueckgenommenen Plan bearbeitet, haette den
         Schnappschuss rueckwirkend veraendert und kein zweites Mal zurueck
         gekonnt.
     J4  Dauer 0 s ⇒ kein Umfangslabel. Die Fixture enthielt keine Einheit
         mit Dauer 0.
     J5  Die Sieben-Tage-Grenze sitzt in weekPlanToComparable, nicht in
         projectWeek. Ein achter Tag waere mit `weekday: undefined` in den
         Gate-Vergleich Legacy/Engine gelaufen. Dieser Eingang war nie
         geprueft — meine erste Fassung des Tests traf den falschen Zweig und
         blieb ebenfalls gruen, bis die Probe es zeigte.
     F1  Geprueft war nur das EASY-Pace-Fenster. Tempo (1.02-1.08) und VO2
         (0.92-0.98) waren ungeprueft — also genau die Zahlen, die
         entscheiden, ob "5 km Tempolauf" ein Schwellenreiz oder ein
         Wettkampf wird. Neu inkl. Nachweis, dass sich die beiden Fenster
         nicht ueberschneiden.
     F6  `iterations >= 1` im Validator: eine Wiederholungsgruppe mit 0 oder
         -1 Durchgaengen waere durchgelaufen und auf der Uhr als leere Gruppe
         erschienen.
     T4  Der fail-OPEN-Zweig beim Anzeigenamen war ungeprueft. Wichtig fuer
         die Aussagekraft: er sitzt im catch der Namensabfrage und die laeuft
         NUR online — meine erste Testfassung lief offline, erreichte den
         Zweig gar nicht und war damit wertlos. Jetzt: online, Bibliothek
         wirft, Uebungen entstehen trotzdem. Plus Gegenprobe, dass die Uebung
         SELBST weiterhin fail-CLOSED ist.
     T6  Ohne Datenvertrag fehlte der Grund 'no_contract' — ein kaputter
         Aufbau waere nicht von einem leeren Plan zu unterscheiden gewesen.

   IN EIGENER SACHE. Beim Schliessen von T2 habe ich selbst einen Test
   geschrieben, der nichts prueft: `(...)() instanceof Promise ? true : true`
   ist immer wahr. Aufgefallen beim Nachlesen, sofort ersetzt durch eine
   awaitete Gegenprobe. Genau die Sorte Test, die Bauplan §17.8 verbietet —
   und ein Beleg dafuer, dass die Proben noetig sind, nicht nur die Tests.

   WERKZEUG. Neuer Status 'skipped' (⏭️) fuer zwei Faelle, die bisher als
   Fehler oder als Defekt gelesen wurden:
     (a) Kataloge, die eine ANDERE WURZEL brauchen — vorher meldete der
         Gesamtlauf die vier Worker-Proben als 'invalid', ein sauberer Lauf
         sah damit nach Fehler aus.
     (b) Zieltests, die sich in DIESER UMGEBUNG selbst ueberspringen. Auf dem
         Geraet fehlt im Bridge-VM das Chromium-Binary; die sechs
         week-projection-Proben wurden dadurch als 'crashed' gefuehrt — ein
         Umgebungsproblem sah aus wie ein Codedefekt. Erkannt wird jetzt
         Exitcode 2 zusammen mit der Ueberspringen-Meldung.
   Uebersprungen ist ausdruecklich KEIN Beleg und wird einzeln ausgewiesen,
   damit nichts still aus der Abdeckung faellt.

   STAND: 55 Proben in 8 Katalogen. 51 im App-Lauf, 4 im Worker-Lauf, alle
   schlagen an. App-Gesamtsuite 251/0 Dateien, Worker test_workout_push 51/0,
   Kohorten-Pin 023ee59b unveraendert.

   ERST DIE PROBLEME (2026-08-12) · v8-330:

   Auftrag: nicht weiterbauen, sondern die Ursache hinter den vier
   Testluecken aus v8-329 beheben. M6/M7/M10/M11 selbst waren dort bereits
   geschlossen; ungeloest war die Frage, wie viele gleichartige Luecken an
   Stellen liegen, an denen nie eine Probe gefahren wurde.

   DAS MUSTER HINTER DEN VIER. Aus den v8-329-Befunden lassen sich vier
   wiederkehrende Arten ableiten, auf die ein gruener Test hereinfaellt:
     value_not_type   Der Test prueft nur TYPWIDRIGE Werte, nie den gueltigen
                      aber falschen Wert. (M6: independentValidation false)
     fixture_masks    Das Fixture ist so schwach, dass eine ANDERE Sperre
                      vorher greift und die eigentliche Zusicherung maskiert.
                      (M7: moderate/not_formally_assessed deckelt ohnehin)
     data_lacks_var   Der Test laeuft gegen REALE Daten, die den fraglichen
                      Zweig gar nicht ausueben. (M10: je nur eine essenzielle
                      Rolle, Rangtabelle bleibt ungeprueft)
     neighbour_guard  Ein NACHBARSCHUTZ verdeckt die Zusicherung; gemessen
                      wird der falsche Mechanismus. (M11: Object.freeze
                      schluckt die Zuweisung still)

   1 · PROBEN SIND KEIN WEGWERFSKRIPT MEHR. tools/mutation-probe.mjs plus
   versionierter Katalog unter tools/probes/. Bis v8-329 wurden Proben je
   Runde neu getippt und danach geloescht — der Nachweis ging jedes Mal
   verloren, und niemand konnte pruefen, ob eine geschlossene Luecke wieder
   aufgegangen ist. Das Werkzeug sichert vierfach ab: Suchtext muss vorkommen,
   muss EINDEUTIG sein, die Datei muss sich messbar geaendert haben, und die
   Wiederherstellung wird bewiesen statt angenommen. Ohne diese Sicherungen
   liest sich eine nicht angewandte Probe exakt wie ein gruener Test (Y7).
   Es faehrt beide Testwelten (ORVIA-JS und pytest) und kann per --root auch
   ausserhalb von app/ arbeiten, weil der Python-Worker nur dort laeuft, wo
   seine Umgebung steht.

   2 · ERSTER DURCHLAUF, 26 PROBEN, DREI ECHTE LUECKEN:

     S7  value_not_type — Die Kuerzung ueberlanger Notizen auf 200 Zeichen war
         beschrieben, aber von keinem Test gedeckt. Eine Laenge ist eine
         WERTgrenze; geprueft wurden nur Typen.
     S8  neighbour_guard — Der teuerste Fund. Ein fehlgeschlagenes Einfuegen
         im Planeditor durfte die bereits geplanten Uebungen loeschen, ohne
         dass ein Test es bemerkt: der Editor haelt seinen Zustand selbst,
         dadurch fiel der Verlust nirgends auf. Neu wird an drei Wegen
         geprueft, dass die Liste bei Fehlern UNVERAENDERT stehenbleibt
         (ungueltige Uebung, Anschlag der Obergrenze, ungueltige Aenderung).
     E6  data_lacks_var — Der Zweig `ambiguous_reverse` im Rueckweg des
         Mappings ist mit den heutigen 10 eindeutigen Eintraegen durch reale
         Daten UNERREICHBAR. Die Mutation "nimm einfach den ersten Treffer"
         blieb gruen.

   2b · DER ERNSTESTE FUND — ein echter Defekt, keine blosse Testluecke.
   Im Worker (workout_push.py) blieben W3 und W4 gruen. W3 fuehrte auf einen
   realen Datenabfluss: `_safe_code` — die Erlaubnisliste fuer Fehlercodes —
   wurde AUSSCHLIESSLICH mit Konstanten aufgerufen und filterte damit nie
   etwas. Die einzige Stelle mit FREMDDATEN,
       await _set_reauth(db, user_id, getattr(e, "code", "AUTH_FAILED"))
   umging sie vollstaendig: der `code` einer von Garmin geworfenen AuthError
   ging ungefiltert in `data_providers.last_error_code`. Eine Fremd-Exception
   kann dort beliebigen Text tragen — Adressen, Token-Reste, Kennungen.
   Behoben mit einer eigenen Erlaubnisliste SAFE_REAUTH_CODES, deren
   Bereinigung IN `_set_reauth` sitzt und nicht bei den Aufrufern; so kann
   kein spaeterer Aufrufer sie versehentlich umgehen. Der neue Test wirft eine
   AuthError mit `code = "host=1.2.3.4 token=SECRET user=..."` und prueft, dass
   keiner dieser Bestandteile irgendwo in der Datenbank landet.
   W4 war die passende Testluecke dazu: der bestehende Test prueft
   Antwortcode, Status und last_error, aber NICHT, ob der Reauth-Status
   gesetzt wurde — das Entfernen von `_set_reauth` blieb deshalb gruen, und
   die App haette den Nutzer nie zur Neuanmeldung aufgefordert.

   3 · EINZIGE PRODUKTIVAENDERUNG IN DER APP: fromGarmin bekommt einen dritten,
   optionalen Parameter als PRUEFOEFFNUNG. Begruendung, weil das eine
   Aenderung an funktionierendem Code ist: Sobald das Mapping mit dem
   Gym-Pack waechst, zeigen zwangslaeufig mehrere ORVIA-Slugs auf dieselbe
   Garmin-Kombination — genau dann muss die Mehrdeutigkeit als solche
   gemeldet werden statt still den ersten Treffer zu waehlen. Ohne die
   Oeffnung waere der erste Nachweis der Tag, an dem es schiefgeht.
   Produktive Aufrufer uebergeben nichts und arbeiten unveraendert; ein
   uebergebener, aber untauglicher Wert wird fail-closed abgewiesen
   ('invalid_entries') statt still auf die echte Tabelle zurueckzufallen —
   sonst haette ein Tippfehler im Test die echte Tabelle geprueft.

   4 · KATALOG (26 Proben, alle schlagen an):
     knowledge-contracts  11  (M1-M11, inkl. der vier v8-329-Befunde mit
                               ihrer Vorgeschichte im Katalog festgehalten)
     strength-plan         9  (S1-S9, Schwerpunkt value_not_type — dieses
                               Modul sichert fast nur Wertgrenzen zu)
     garmin-export         6  (E1-E6, Schwerpunkt data_lacks_var, weil alle
                               10 Katalogeintraege 'mapped' sind und die
                               Zweige ambiguous/unmapped real nie laufen)
     worker-push           4  (W1-W4, pytest; --root garmin-worker) — hier
                               lagen die zwei schwersten Befunde

   Drei Nebenbefunde des Werkzeugs an meiner eigenen Arbeit: die Zuordnung von
   M7 zeigte auf PX2 statt PX2b; die erste Fassung von E5 war so grob, dass
   der Test abbrach statt eine Zusicherung zu melden ('crashed' ist kein Beleg
   und wird als solcher gemeldet, nicht als Erfolg); und das Werkzeug selbst
   scheiterte beim ersten Geraetelauf zweimal — es setzte Loeschrechte voraus
   (auf dem Mount gilt EPERM unlink; die Wiederherstellung laeuft jetzt aus
   dem Speicher, mit Notfall-Handler fuer SIGINT/Ausnahmen) und es nahm an,
   Code und Tests laegen unter derselben Wurzel (auf dem Geraet liegt der Code
   unter app/, die kanonische Testsammlung in der Repo-Wurzel — dafuer gibt es
   jetzt --test-root, und ein fehlender Zieltest wird als PFADFEHLER gemeldet
   statt als Codebefund).

   NICHT GEAENDERT: keine Trainingslogik, keine Oberflaeche, keine
   Wissenspakete. Der Wissensvertrag bleibt bei v6.

   FUENF echte Luecken in 26 Proben: S7, S8, E6 in der App, W3 und W4 im
   Worker. W3 war kein Testproblem, sondern ein Defekt.

   11 neue Zusicherungen in der App (strength_plan_contract 96 -> 101,
   garmin_exercise_map 93 -> 99), 3 neue im Worker (test_workout_push
   48 -> 51). App-Gesamtsuite 251/0 Dateien (7 uebersprungen), Kohorten-Pin
   023ee59b unveraendert.

   DIE APP DARF ENDLICH VORSCHREIBEN (2026-08-12) · v8-329:

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
  './js/avatar-store.js','./js/sync.js','./js/profile-model.js','./js/profile-ui-kit.js','./js/profile-center.js','./js/onboarding/onboarding-profile-logic.js','./js/onboarding/onboarding-sports-logic.js','./js/onboarding/onboarding-logic.js','./js/onboarding/onboarding-steps.js','./js/onboarding/onboarding-store.js','./js/onboarding/onboarding-ui.js','./js/coachmarks.js','./js/quick-actions.js','./js/auth-logic.js','./js/auth.js','./js/checkin-extra.js','./js/workout-ui.js','./js/ui-refresh.js','./js/engine/engine-contracts.js','./js/engine/readiness-engine-v2.js','./js/engine/decision-engine-v2.js','./js/engine/plan-engine-v2.js','./js/engine/training-input-resolver.js','./js/engine/shadow-runner.js','./js/engine/knowledge/knowledge-contracts.js','./js/engine/knowledge/knowledge-sources.js','./js/engine/knowledge/running-knowledge-pack.js','./js/engine/knowledge/gym-knowledge-sources.js','./js/engine/knowledge/gym-knowledge-pack.js','./js/engine/knowledge/running-notizen-knowledge-sources.js','./js/engine/knowledge/running-notizen-knowledge-pack.js','./js/engine/knowledge/sport-coverage-matrix.js','./js/engine/knowledge/knowledge-ingest.js','./js/engine/knowledge/knowledge-application.js','./js/engine/knowledge/knowledge-consumer.js','./js/engine/goal-portfolio.js','./js/engine/running-capacity-factory.js','./js/engine/scheduler-input-factory.js','./js/engine/scheduler-goal-allocation.js','./js/engine/scheduler-v1.js','./js/engine/capacity-adapter.js','./js/engine/constraint-solver.js','./js/engine/planned-volume.js','./js/engine/prescription-factory.js','./js/engine/scheduler-v2.js','./js/engine/shadow-eval.js','./js/engine/week-projection.js','./js/engine/prescription-format.js','./js/engine/evidence.js','./js/engine/performance-zones.js','./js/engine/load-profile.js','./js/engine/performance-resolver.js','./js/engine/performance-input.js','./js/engine/session-debrief.js','./js/engine/debrief-record.js','./js/engine/load-history.js','./js/engine/progression.js','./js/engine/goal-feasibility.js','./js/engine/shadow-adaptive.js','./js/engine/plan-translator.js','./js/adaptive-card.js','./js/engine/observer-source.js','./js/engine/observer-input.js','./js/engine/prediction-observer.js','./js/engine/week-plan-designer.js','./js/engine/plan-variants.js','./js/engine/week-plan-policy.js','./js/engine/decision-log.js','./js/engine/feature-flags.js','./js/engine/plan-activation.js','./js/engine/canary-eval.js','./js/engine/canary-report.js',
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
